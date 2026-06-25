'use client';

/**
 * /artist/editions — list of all artworks the connected artist has
 * published, with quick actions: view public page, edit metadata (if not
 * locked yet), see claim progress at a glance.
 *
 * Polish goals over the previous version:
 *  - Display each artwork's thumbnail image (horizontal card, like
 *    /collector). Reading a list of titles felt like a CRUD admin
 *    screen, not an artist portfolio.
 *  - Progress bar per edition showing claimed / total — instant ROI
 *    feedback that visualizes momentum.
 *  - Header now includes a count subtitle ("3 works certified…") so the
 *    artist sees their cumulative output in the eyebrow.
 *  - Hardcoded French strings replaced by translated keys, including
 *    permission gates (loading / not-connected / not-authorized).
 *  - Trust footer matching the rest of the site polish.
 *
 * Edition-locking semantics (v2 contract): an edition is "locked" once
 * any copy has left the artist wallet (claim, direct transfer, market
 * sale). Locked = no metadata edits allowed.
 */

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
    ARTWORK_TOKENIZATION_ADDRESS,
    ARTWORK_TOKENIZATION_ABI,
} from '@/config/contracts';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { getCategoryLabel } from '@/app/utils/categories';

interface EditionIPFSData {
    title?: string;
    year?: number;
    description?: string;
    technique?: string;
    dimensions?: string;
    images?: string[];
    editionSize?: number;
    category?: string;
}

interface EditionInfo {
    tokenId: bigint;
    title: string;
    metadata: string;
    merkleRoot: string;
    remainingTokens: bigint;
    disabled: boolean;
    ipfsData?: EditionIPFSData;
}

export default function ArtistEditionsPage() {
    const t = useTranslations('Artist.editions');
    const { address } = useAccount();
    const { user, ready: privyReady } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;

    const [editions, setEditions] = useState<EditionInfo[]>([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
    const [loadingStates, setLoadingStates] = useState({
        fetchingEditions: false,
        loadingIPFS: false,
    });

    // -------- Authorization gate --------
    const { data: artistData, isLoading: isLoadingArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    useEffect(() => {
        if (artistData) {
            const artist = artistData as { authorized: boolean };
            setIsAuthorized(artist.authorized);
            setIsCheckingAuthorization(false);
        } else if (!isLoadingArtist && artistData !== undefined) {
            setIsCheckingAuthorization(false);
        }
    }, [artistData, isLoadingArtist]);

    /**
     * v2 metadata lock invariant: an edition becomes immutable once any
     * copy has been transferred from the artist's wallet (by any means).
     * We compare the on-chain balance against the IPFS-declared
     * editionSize — if the balance is lower, at least one copy has left.
     */
    const isEditionLocked = (edition: EditionInfo): boolean => {
        const initial = edition.ipfsData?.editionSize;
        if (!initial) return false;
        try {
            return edition.remainingTokens < BigInt(initial);
        } catch {
            return false;
        }
    };

    // -------- Load editions for this artist --------
    useEffect(() => {
        const fetchEditions = async () => {
            if (!activeAddress || !isAuthorized || !publicClient) return;
            setLoadingStates(prev => ({ ...prev, fetchingEditions: true }));
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    args: { artist: activeAddress },
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                });

                const editionsData: EditionInfo[] = [];
                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;
                    const [editionMetadata, editionMerkleRoot, editionDisabled] = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getArtworkEdition',
                        args: [tokenId],
                    }) as readonly [string, string, boolean];

                    const balance = await publicClient.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'balanceOf',
                        args: [activeAddress, tokenId],
                    }) as bigint;

                    let artworkTitle = t('untitled');
                    if (editionMetadata?.trim()) {
                        try {
                            const ipfsData = await getFromIPFSGateway(editionMetadata);
                            artworkTitle = ipfsData?.title || t('untitled');
                        } catch (e) {
                            console.error('Error loading IPFS:', e);
                        }
                    }

                    editionsData.push({
                        tokenId,
                        title: artworkTitle,
                        metadata: editionMetadata,
                        merkleRoot: editionMerkleRoot,
                        remainingTokens: balance,
                        disabled: editionDisabled,
                    });
                }

                editionsData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setEditions(editionsData);

                // Second pass: enrich with full IPFS payload (image, technique,
                // editionSize). Done serially so the page paints earliest
                // editions first and the artist sees immediate feedback.
                setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                for (const edition of editionsData) {
                    if (!edition.metadata) continue;
                    try {
                        const ipfsData = await getFromIPFSGateway(edition.metadata) as EditionIPFSData;
                        setEditions(prev =>
                            prev.map(e =>
                                e.tokenId === edition.tokenId ? { ...e, ipfsData } : e,
                            ),
                        );
                    } catch (error) {
                        console.error(`Error loading IPFS for edition ${edition.tokenId}:`, error);
                    }
                }
                setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
            } catch (error) {
                console.error('Error loading editions:', error);
            } finally {
                setLoadingStates(prev => ({ ...prev, fetchingEditions: false }));
            }
        };

        fetchEditions();
    // t stable per locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAddress, isAuthorized]);

    // ============== EARLY-RETURN GUARDS ==============

    if (!privyReady || isCheckingAuthorization || isLoadingArtist) {
        return (
            <Shell>
                <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">
                        {t('checkingPermissions')}
                    </p>
                </div>
            </Shell>
        );
    }

    if (!activeAddress) {
        return (
            <Shell>
                <Centered message={t('notConnected')} />
            </Shell>
        );
    }

    if (!isAuthorized) {
        return (
            <Shell>
                <Centered message={t('notAuthorized')} />
            </Shell>
        );
    }

    // ============== MAIN ==============

    return (
        <Shell>
            {/* Hero */}
            <header className="text-center mb-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-8 h-px bg-[var(--border)]" />
                    <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[var(--text-muted)]">
                        Mona Editions
                    </span>
                    <div className="w-8 h-px bg-[var(--border)]" />
                </div>
                <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight mb-3">
                    {t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em>
                </h1>
                {!loadingStates.fetchingEditions && (
                    <p className="text-[13px] font-light text-[var(--text-secondary)] mb-6">
                        {t('subtitle', { count: editions.length })}
                    </p>
                )}
                <Link
                    href="/artist/editions/create"
                    className="inline-block bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-8 border border-[var(--text-primary)] no-underline hover:bg-[var(--accent-hover)] transition-all duration-200"
                >
                    {t('createButton')}
                </Link>
            </header>

            {/* Content */}
            {loadingStates.fetchingEditions ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">
                        {t('loading')}
                    </p>
                </div>
            ) : editions.length === 0 ? (
                <EmptyEditions />
            ) : (
                <div className="space-y-px">
                    {editions.map(edition => (
                        <EditionRow
                            key={edition.tokenId.toString()}
                            edition={edition}
                            locked={isEditionLocked(edition)}
                        />
                    ))}
                </div>
            )}

            {/* Trust footer */}
            <div className="mt-20 border-t border-[var(--border)] pt-12">
                <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions"
                        className="w-24 h-12 object-contain opacity-60 dark:invert"
                    />
                    <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                        {t('trustTitle')}
                    </p>
                    <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.8]">
                        {t('trustBody')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                        <Link
                            href="/about"
                            className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                        >
                            {t('trustLinkAbout')}
                        </Link>
                        <span className="text-[var(--border)]">·</span>
                        <Link
                            href="/artist"
                            className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                        >
                            {t('trustLinkDashboard')}
                        </Link>
                    </div>
                </div>
            </div>
        </Shell>
    );
}

// =========================================================================
// Layout shell
// =========================================================================

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">{children}</div>
        </div>
    );
}

function Centered({ message }: { message: string }) {
    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
            <p className="italic text-[16px] text-[var(--text-secondary)] max-w-md mx-auto leading-[1.7]">
                {message}
            </p>
        </div>
    );
}

function EmptyEditions() {
    const t = useTranslations('Artist.editions');
    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
            <img
                src="/logo-mona.svg"
                alt=""
                className="w-16 h-16 object-contain mx-auto mb-6 opacity-30 dark:invert"
            />
            <h2 className="text-[24px] font-normal text-[var(--text-primary)] mb-3">
                {t('emptyTitle')}
            </h2>
            <p className="text-[14px] font-light text-[var(--text-secondary)] max-w-md mx-auto leading-[1.7] mb-6">
                {t('emptyBody')}
            </p>
            <Link
                href="/artist/editions/create"
                className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-on-inverse)] bg-[var(--bg-inverse)] px-5 py-3 no-underline hover:bg-[var(--accent-hover)] transition-all duration-200"
            >
                {t('emptyCta')} <span aria-hidden>→</span>
            </Link>
        </div>
    );
}

// =========================================================================
// EditionRow — horizontal card with image, info, claim progress, actions
// =========================================================================

function EditionRow({
    edition,
    locked,
}: {
    edition: EditionInfo;
    locked: boolean;
}) {
    const t = useTranslations('Artist.editions');
    const imageUrl = edition.ipfsData?.images?.[0] ? ipfsToHttp(edition.ipfsData.images[0]) : null;
    const totalSize = edition.ipfsData?.editionSize;
    const remaining = Number(edition.remainingTokens);
    const claimed = totalSize ? Math.max(0, totalSize - remaining) : 0;
    const claimPct = totalSize && totalSize > 0
        ? Math.min(100, Math.round((claimed / totalSize) * 100))
        : 0;

    return (
        <article className="border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="flex flex-col md:flex-row">
                {/* ---- Image ---- */}
                <Link
                    href={`/explore/edition/${edition.tokenId}`}
                    className="block md:w-52 flex-shrink-0 bg-[var(--border-soft)] aspect-[4/3] md:aspect-square overflow-hidden no-underline group"
                    aria-label={edition.title}
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={edition.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <img src="/logo-mona.svg" alt="" className="w-12 h-12 object-contain opacity-25 dark:invert" />
                        </div>
                    )}
                </Link>

                {/* ---- Info + actions ---- */}
                <div className="flex-1 p-6 flex flex-col">
                    {/* Title + badges */}
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-1">
                                {t('tokenIdLabel', { id: edition.tokenId.toString() })}
                            </p>
                            <h2 className="text-[22px] font-normal text-[var(--text-primary)] leading-tight">
                                <Link
                                    href={`/explore/edition/${edition.tokenId}`}
                                    className="hover:text-[var(--text-secondary)] no-underline transition-colors"
                                >
                                    {edition.title}
                                </Link>
                            </h2>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            {edition.disabled && (
                                <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-[#dc2626] border border-[#dc2626] px-2 py-0.5">
                                    {t('disabled')}
                                </span>
                            )}
                            {locked && !edition.disabled && (
                                <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-[var(--text-secondary)] border border-[var(--border)] px-2 py-0.5">
                                    {t('lockedBadge')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Meta line */}
                    {(edition.ipfsData?.category || edition.ipfsData?.technique || edition.ipfsData?.year) && (
                        <p className="text-[12px] font-light text-[var(--text-secondary)] mb-4">
                            {[
                                edition.ipfsData?.category && getCategoryLabel(edition.ipfsData.category),
                                edition.ipfsData?.technique,
                                edition.ipfsData?.dimensions,
                                edition.ipfsData?.year,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    )}

                    {/* Claim progress bar */}
                    {totalSize && totalSize > 0 && (
                        <div className="mb-5">
                            <div className="w-full h-1.5 bg-[var(--border-soft)] overflow-hidden mb-1.5">
                                <div
                                    className={`h-full ${edition.disabled ? 'bg-[var(--text-muted)]' : 'bg-[#4a5240]'}`}
                                    style={{ width: `${claimPct}%` }}
                                    aria-hidden="true"
                                />
                            </div>
                            <p className="text-[11px] font-light text-[var(--text-secondary)]">
                                {t('claimRate', { claimed, total: totalSize })}
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-auto flex flex-wrap gap-2">
                        <Link
                            href={`/explore/edition/${edition.tokenId}`}
                            className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] bg-[var(--bg-page)] border border-[var(--border)] px-3.5 py-2 no-underline hover:border-[var(--text-primary)] transition-all duration-200"
                        >
                            {t('viewPublicCta')} <span aria-hidden>↗</span>
                        </Link>
                        {!locked && !edition.disabled && (
                            <Link
                                href={`/artist/editions/${edition.tokenId}/edit`}
                                className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] bg-[var(--bg-page)] border border-[var(--border)] px-3.5 py-2 no-underline hover:border-[var(--text-primary)] transition-all duration-200"
                            >
                                {t('editCta')}
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}
