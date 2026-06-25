'use client';

/**
 * Artist dashboard — the landing page for authenticated artists at /artist.
 *
 * This is intentionally read-only: it surfaces stats and quick actions so
 * a returning artist immediately sees what's happening with their editions
 * without scrolling through a profile form. Profile editing lives at
 * /artist/profile (the previous content of this page).
 *
 * All data is read on-chain or from IPFS. No new contracts, no DB writes.
 *
 * Sections (in display order):
 *  1. Hero — name, member-since, links to public page and profile editing
 *  2. Subscription card (state-aware: active / past_due / inactive)
 *  3. Stats — editions / claims / unique collectors + 30-day activity
 *  4. Recent editions — 3 latest with claim-rate progress bar
 *  5. Primary CTA — Create new edition (or first edition for newcomers)
 *  6. QR code download — preserved from the old page; useful for printing
 *     a physical card with the artist's public page URL.
 */

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';
import { parseAbiItem } from 'viem';
import QRCode from 'qrcode';
import Link from 'next/link';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { BASE_URL } from '@/config/constants';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp, base64ToBlob, downloadFile } from '@/app/utils/file';
import { useModal } from '@/app/ModalProvider';
import { useSubscription } from '@/app/hooks/useSubscription';

interface ArtistIPFSData {
    name?: string;
    location?: string;
    logo?: string;
    portfolio?: string[];
}

interface EditionSummary {
    tokenId: bigint;
    title: string;
    imageUrl: string | null;
    editionSize: number; // total mintable supply (from IPFS metadata)
    claimed: number;     // editionSize - artist's current balance
    disabled: boolean;
}

interface DashboardStats {
    editionsCount: number;
    totalClaims: number;
    uniqueCollectors: number;
    claimsLast30Days: number;
    memberSinceYear?: number;
}

const SECONDS_PER_DAY = 86400;

export default function ArtistDashboardPage() {
    const t = useTranslations('Artist.dashboard');
    const tArtist = useTranslations('Artist');
    const { address } = useAccount();
    const { user, ready: privyReady, authenticated } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;

    const { showAlert } = useModal();
    const { snapshot: subscription } = useSubscription();

    const [artistIPFSData, setArtistIPFSData] = useState<ArtistIPFSData | null>(null);
    const [recentEditions, setRecentEditions] = useState<EditionSummary[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isGeneratingQR, setIsGeneratingQR] = useState(false);

    // -------- Authorization gate --------
    const { data: artistData, isLoading: isLoadingArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    const onChainArtist = artistData as { authorized?: boolean; metadata?: string } | undefined;
    const isAuthorized = !!onChainArtist?.authorized;
    const isRegistered = !!onChainArtist?.metadata && onChainArtist.metadata.length > 0;

    // -------- Load IPFS profile + stats once we have the address --------
    useEffect(() => {
        if (!activeAddress || !isRegistered || !onChainArtist?.metadata) {
            // Either no address yet or no on-chain registration: nothing to load.
            // We still flip isLoadingData off once authorization check is done.
            if (!isLoadingArtist) setIsLoadingData(false);
            return;
        }

        let cancelled = false;

        const load = async () => {
            setIsLoadingData(true);
            try {
                // 1. Artist IPFS profile (name, photo) — best-effort
                let ipfs: ArtistIPFSData | null = null;
                try {
                    ipfs = await getFromIPFSGateway(onChainArtist.metadata!) as ArtistIPFSData;
                } catch (e) {
                    console.error('Failed to load artist IPFS profile:', e);
                }
                if (cancelled) return;
                setArtistIPFSData(ipfs);

                // 2. Editions of this artist via NewArtworkEdition log
                const editionLogs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    args: { artist: activeAddress },
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                });

                // 3. Claim activity via TransferSingle from artist wallet.
                //    Each such transfer represents one collector claim.
                const transferLogs = await publicClient.getLogs({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    event: parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'),
                    args: { from: activeAddress },
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                });

                const collectors = new Set<string>();
                let totalClaims = 0;
                for (const log of transferLogs) {
                    const to = (log.args.to as string | undefined)?.toLowerCase();
                    const value = log.args.value as bigint | undefined;
                    if (!to || to === activeAddress.toLowerCase()) continue;
                    collectors.add(to);
                    totalClaims += Number(value ?? 0n);
                }

                // 4. 30-day activity — bucket recent claim events by current
                //    block timestamp minus 30 days. We fetch the latest block
                //    once and compare block numbers vs. an approximate cutoff.
                let claimsLast30Days = 0;
                try {
                    const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
                    const cutoffTimestamp = Number(latestBlock.timestamp) - 30 * SECONDS_PER_DAY;
                    // To stay efficient, batch the timestamp lookups.
                    const blockNumbers = Array.from(new Set(
                        transferLogs
                            .filter(l => l.blockNumber !== null)
                            .map(l => l.blockNumber as bigint)
                    ));
                    const blockTimestamps = await Promise.all(
                        blockNumbers.map(bn => publicClient.getBlock({ blockNumber: bn }).then(b => [bn, Number(b.timestamp)] as const).catch(() => [bn, 0] as const))
                    );
                    const blockTsMap = new Map(blockTimestamps);
                    for (const log of transferLogs) {
                        if (log.blockNumber === null) continue;
                        const ts = blockTsMap.get(log.blockNumber);
                        if (ts && ts >= cutoffTimestamp) {
                            claimsLast30Days += Number(log.args.value ?? 0n);
                        }
                    }
                } catch (e) {
                    console.error('Failed to compute 30-day claims:', e);
                }

                // 5. Member-since year — earliest edition timestamp.
                let memberSinceYear: number | undefined;
                if (editionLogs.length > 0) {
                    try {
                        const earliest = editionLogs.reduce((min, l) =>
                            (l.blockNumber !== null && (min.blockNumber === null || l.blockNumber < min.blockNumber)) ? l : min
                        );
                        if (earliest.blockNumber !== null) {
                            const block = await publicClient.getBlock({ blockNumber: earliest.blockNumber });
                            memberSinceYear = new Date(Number(block.timestamp) * 1000).getFullYear();
                        }
                    } catch (e) {
                        console.error('Failed to fetch earliest edition timestamp:', e);
                    }
                }

                if (cancelled) return;
                setStats({
                    editionsCount: editionLogs.length,
                    totalClaims,
                    uniqueCollectors: collectors.size,
                    claimsLast30Days,
                    memberSinceYear,
                });

                // 6. Recent editions — keep 3 most recent (highest tokenId),
                //    fetch their IPFS metadata + remaining supply in parallel.
                const sortedLogs = [...editionLogs].sort((a, b) =>
                    Number((b.args.editionId as bigint) - (a.args.editionId as bigint))
                );
                const top3 = sortedLogs.slice(0, 3);

                const recent: EditionSummary[] = await Promise.all(
                    top3.map(async (log) => {
                        const tokenId = log.args.editionId as bigint;
                        let title = `#${tokenId.toString()}`;
                        let imageUrl: string | null = null;
                        let editionSize = 0;
                        let claimed = 0;
                        let disabled = false;
                        try {
                            const [editionMetadata, , editionDisabled] = await publicClient.readContract({
                                address: ARTWORK_REGISTRY_ADDRESS,
                                abi: ARTWORK_REGISTRY_ABI,
                                functionName: 'getArtworkEdition',
                                args: [tokenId],
                            }) as readonly [string, string, boolean];
                            disabled = editionDisabled;

                            const balance = await publicClient.readContract({
                                address: ARTWORK_TOKENIZATION_ADDRESS,
                                abi: ARTWORK_TOKENIZATION_ABI,
                                functionName: 'balanceOf',
                                args: [activeAddress, tokenId],
                            }) as bigint;

                            if (editionMetadata?.trim()) {
                                try {
                                    const meta = await getFromIPFSGateway(editionMetadata);
                                    if (meta?.title) title = meta.title;
                                    if (meta?.images?.[0]) imageUrl = ipfsToHttp(meta.images[0]);
                                    if (typeof meta?.editionSize === 'number') editionSize = meta.editionSize;
                                } catch (e) {
                                    console.error('IPFS fetch failed for edition', tokenId.toString(), e);
                                }
                            }
                            claimed = Math.max(0, editionSize - Number(balance));
                        } catch (e) {
                            console.error('Failed to fetch edition', tokenId.toString(), e);
                        }
                        return { tokenId, title, imageUrl, editionSize, claimed, disabled };
                    })
                );
                if (cancelled) return;
                setRecentEditions(recent);
            } finally {
                if (!cancelled) setIsLoadingData(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [activeAddress, isRegistered, onChainArtist?.metadata, isLoadingArtist]);

    // -------- QR code download (preserved from old /artist page) --------
    const downloadQRCode = async () => {
        if (!activeAddress || !isRegistered) return;
        setIsGeneratingQR(true);
        try {
            const url = `${BASE_URL}/explore/artist/${activeAddress}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 1000,
                margin: 4,
                color: { dark: '#000000', light: '#FFFFFF' },
                errorCorrectionLevel: 'H',
            });
            const blob = base64ToBlob(dataUrl.split(',')[1]);
            const fileUrl = URL.createObjectURL(blob);
            const safeName = (artistIPFSData?.name || 'artist').replace(/\s+/g, '_');
            downloadFile(fileUrl, `QR_${safeName}_${activeAddress.slice(0, 8)}.png`);
        } catch (e) {
            console.error('QR generation failed:', e);
            await showAlert(tArtist('qrGenerating'));
        } finally {
            setIsGeneratingQR(false);
        }
    };

    // ============== EARLY-RETURN GUARDS ==============

    if (!privyReady || isLoadingArtist) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">{t('loading')}</p>
                </div>
            </DashboardShell>
        );
    }

    if (!authenticated || !activeAddress) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[40vh]">
                    <p className="italic text-[18px] text-[var(--text-muted)] text-center max-w-md px-6">{t('notConnected')}</p>
                </div>
            </DashboardShell>
        );
    }

    if (!isAuthorized) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center min-h-[40vh]">
                    <p className="italic text-[18px] text-[var(--text-muted)] text-center max-w-md px-6">{t('notAuthorized')}</p>
                </div>
            </DashboardShell>
        );
    }

    // Authorized but no profile yet — block with a clear single CTA.
    if (!isRegistered) {
        return (
            <DashboardShell>
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center">
                    <h1 className="text-[clamp(24px,3vw,32px)] font-normal tracking-[-0.5px] text-[var(--text-primary)] mb-3">
                        {t('welcomeFirst')}
                    </h1>
                    <p className="text-[14px] font-light text-[var(--text-secondary)] leading-[1.7] max-w-md mx-auto mb-8">
                        {t('needsProfileBody')}
                    </p>
                    <Link
                        href="/artist/profile"
                        className="inline-block bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] no-underline hover:bg-[var(--accent-hover)] transition-all duration-200"
                    >
                        {t('needsProfileCta')}
                    </Link>
                </div>
            </DashboardShell>
        );
    }

    // ============== FULL DASHBOARD ==============

    const displayName = artistIPFSData?.name?.trim() || t('anonymousName');
    const logoUrl = artistIPFSData?.logo ? ipfsToHttp(artistIPFSData.logo) : null;

    return (
        <DashboardShell>
            {/* ---------- Hero ---------- */}
            <section className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                <div className="flex items-start gap-6 flex-wrap">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt=""
                            className="w-20 h-20 object-contain border border-[var(--border-soft)] bg-[var(--bg-page)] flex-shrink-0"
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-px bg-[var(--border)]" />
                            <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                                Mona Editions
                            </span>
                        </div>
                        <h1 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight mb-2">
                            {t('welcomeBack', { name: displayName })}
                        </h1>
                        {stats?.memberSinceYear && (
                            <p className="text-[13px] font-light text-[var(--text-secondary)]">
                                {t('memberSince', { year: stats.memberSinceYear })}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-5">
                            <Link
                                href={`/explore/artist/${activeAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[var(--text-primary)]
                                    border border-[var(--border)] bg-[var(--bg-page)] px-4 py-2 no-underline uppercase
                                    hover:border-[var(--text-primary)] transition-all duration-200"
                            >
                                {t('viewPublicPage')} <span aria-hidden>↗</span>
                            </Link>
                            <Link
                                href="/artist/profile"
                                className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[var(--text-secondary)]
                                    border border-[var(--border)] px-4 py-2 no-underline uppercase
                                    hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all duration-200"
                            >
                                {t('editProfile')}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ---------- Subscription card ---------- */}
            <SubscriptionCard status={subscription?.status ?? 'none'} t={t} />

            {/* ---------- Stats ---------- */}
            <section className="border border-[var(--border)] border-t-0 bg-[var(--bg-card)] p-8 mb-px">
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-6">
                    {t('statsLabel')}
                </p>

                {isLoadingData || !stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)]">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="bg-[var(--bg-card)] p-6 min-h-[110px] flex items-center justify-center">
                                <div className="w-6 h-6 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)]">
                            <StatCard label={t('statEditions')} value={stats.editionsCount} />
                            <StatCard label={t('statClaims')} value={stats.totalClaims} />
                            <StatCard label={t('statCollectors')} value={stats.uniqueCollectors} />
                        </div>
                        <p className="mt-6 text-[12px] font-light text-[var(--text-secondary)] tracking-[0.02em]">
                            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mr-3">
                                {t('activityTitle')}
                            </span>
                            {t('statClaimsThisMonth', { count: stats.claimsLast30Days })}
                        </p>
                    </>
                )}
            </section>

            {/* ---------- Recent editions ---------- */}
            <section className="border border-[var(--border)] border-t-0 bg-[var(--bg-card)] p-8 mb-px">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-[22px] font-normal text-[var(--text-primary)]">
                        {t('recentEditionsTitle')}
                    </h2>
                    {stats && stats.editionsCount > 0 && (
                        <Link
                            href="/artist/editions"
                            className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)] transition-colors"
                        >
                            {t('viewAllEditions')} <span aria-hidden>→</span>
                        </Link>
                    )}
                </div>

                {isLoadingData ? (
                    <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    </div>
                ) : recentEditions.length === 0 ? (
                    <div className="border border-dashed border-[var(--border)] bg-[var(--bg-page)] p-10 text-center">
                        <p className="italic text-[18px] text-[var(--text-primary)] mb-2">{t('noEditionsTitle')}</p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7] max-w-md mx-auto">
                            {t('noEditionsBody')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)]">
                        {recentEditions.map(ed => (
                            <EditionCard key={ed.tokenId.toString()} edition={ed} t={t} />
                        ))}
                    </div>
                )}
            </section>

            {/* ---------- Primary CTA ---------- */}
            <section className="border border-[var(--border)] border-t-0 bg-[var(--bg-card-alt)] p-8 mb-px">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-[14px] font-light text-[var(--text-primary)]">
                        {stats && stats.editionsCount === 0
                            ? t('ctaFirstEdition')
                            : t('ctaCreateEdition')}
                    </p>
                    <Link
                        href="/artist/editions/create"
                        className="inline-block bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] no-underline uppercase hover:bg-[var(--accent-hover)] transition-all duration-200"
                    >
                        {stats && stats.editionsCount === 0
                            ? t('ctaFirstEdition')
                            : t('ctaCreateEdition')}
                    </Link>
                </div>
            </section>

            {/* ---------- QR code (preserved) ---------- */}
            <section className="border border-[var(--border)] border-t-0 bg-[var(--bg-card)] p-8 mb-px">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                            {tArtist('qrTitle')}
                        </p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">
                            {tArtist('qrDescription')}
                        </p>
                    </div>
                    <button
                        onClick={downloadQRCode}
                        disabled={isGeneratingQR}
                        className="bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[11px] tracking-[0.06em] py-3 px-6 border border-[var(--border)] disabled:opacity-50 hover:border-[var(--text-primary)] transition-all duration-200 uppercase cursor-pointer"
                    >
                        {isGeneratingQR ? tArtist('qrGenerating') : tArtist('qrDownload')}
                    </button>
                </div>
            </section>
        </DashboardShell>
    );
}

/* ================================================================== */
/* Layout shell + small presentational components                     */
/* ================================================================== */

function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-5xl mx-auto px-6 pt-28 pb-20">
                {children}
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-[var(--bg-card)] p-6">
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">
                {label}
            </p>
            <p className="text-[clamp(32px,5vw,44px)] font-normal text-[var(--text-primary)] leading-none tracking-[-1px]">
                {value}
            </p>
        </div>
    );
}

function EditionCard({
    edition,
    t,
}: {
    edition: EditionSummary;
    t: ReturnType<typeof useTranslations>;
}) {
    const total = edition.editionSize;
    const claimed = edition.claimed;
    const pct = total > 0 ? Math.min(100, Math.round((claimed / total) * 100)) : 0;

    return (
        <Link
            href={`/explore/edition/${edition.tokenId}`}
            className="bg-[var(--bg-card)] p-5 flex flex-col gap-3 no-underline group"
        >
            {edition.imageUrl ? (
                <div className="w-full aspect-[4/3] overflow-hidden bg-[var(--border-soft)]">
                    <img
                        src={edition.imageUrl}
                        alt={edition.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                </div>
            ) : (
                <div className="w-full aspect-[4/3] bg-[var(--border-soft)] flex items-center justify-center">
                    <img src="/logo-mona.svg" alt="" className="w-12 h-12 object-contain opacity-20 dark:invert" />
                </div>
            )}

            <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-normal text-[var(--text-primary)] leading-tight flex-1">
                    {edition.title}
                </h3>
                {edition.disabled && (
                    <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                        {t('disabled')}
                    </span>
                )}
            </div>

            {total > 0 && (
                <>
                    <div className="w-full h-1.5 bg-[var(--border-soft)] overflow-hidden">
                        <div
                            className="h-full bg-[#4a5240]"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                        />
                    </div>
                    <p className="text-[11px] font-light text-[var(--text-secondary)]">
                        {t('claimRate', { claimed, total })}
                    </p>
                </>
            )}
        </Link>
    );
}

function SubscriptionCard({
    status,
    t,
}: {
    status: 'none' | 'active' | 'canceled' | 'past_due' | 'incomplete';
    t: ReturnType<typeof useTranslations>;
}) {
    // Three visual variants: success (active), urgent (past_due/incomplete),
    // neutral (inactive). canceled with no current period still shows as
    // inactive — the upstream API decides whether to keep status='active'
    // until period end.
    if (status === 'active') {
        return (
            <section className="border border-[var(--border)] border-t-0 bg-[#f0fdf4] p-6 mb-px">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#166534] mb-2">
                            ● {t('subActiveTitle')}
                        </p>
                        <p className="text-[13px] font-light text-[var(--text-primary)] leading-[1.7]">
                            {t('subActiveBody')}
                        </p>
                    </div>
                    <Link
                        href="/artist/subscription"
                        className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 no-underline hover:border-[var(--text-primary)] transition-all duration-200"
                    >
                        {t('subManageCta')}
                    </Link>
                </div>
            </section>
        );
    }

    if (status === 'past_due' || status === 'incomplete') {
        return (
            <section className="border-2 border-[#dc2626] border-t-2 bg-[#fef2f2] p-6 mb-px">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#991b1b] mb-2">
                            ● {t('subPastDueTitle')}
                        </p>
                        <p className="text-[13px] font-light text-[#991b1b] leading-[1.7]">
                            {t('subPastDueBody')}
                        </p>
                    </div>
                    <Link
                        href="/artist/subscription"
                        className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-on-inverse)] bg-[#dc2626] px-4 py-2 no-underline hover:bg-[#b91c1c] transition-colors"
                    >
                        {t('subManageCta')}
                    </Link>
                </div>
            </section>
        );
    }

    // status === 'none' or 'canceled'
    return (
        <section className="border border-[var(--border)] border-t-0 bg-[var(--bg-card-alt)] p-6 mb-px">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                    <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-secondary)] mb-2">
                        {t('subInactiveTitle')}
                    </p>
                    <p className="text-[13px] font-light text-[var(--text-primary)] leading-[1.7]">
                        {t('subInactiveBody')}
                    </p>
                </div>
                <Link
                    href="/artist/subscription"
                    className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-on-inverse)] bg-[var(--bg-inverse)] px-4 py-2 no-underline hover:bg-[var(--accent-hover)] transition-colors"
                >
                    {t('subActivateCta')}
                </Link>
            </div>
        </section>
    );
}
