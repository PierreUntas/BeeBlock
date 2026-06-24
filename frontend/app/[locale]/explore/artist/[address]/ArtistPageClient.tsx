'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { getCategoryLabel } from '@/app/utils/categories';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { useTranslations } from 'next-intl';
import ShareMenu from '@/components/shared/ShareMenu';

interface ArtistInfo {
    name: string;
    location: string;
    metadata: string;
}

interface ArtistIPFSData {
    name: string;
    location: string;
    website: string;
    bio: string;
    logo?: string;
    portfolio: string[];
    exhibitions: string[];
    socialMedia: {
        instagram: string;
        twitter: string;
        facebook: string;
    };
}

interface EditionIPFSData {
    title: string;
    year: number;
    description: string;
    technique: string;
    dimensions: string;
    images: string[];
    editionSize: number;
    category: string;
}

interface EditionInfo {
    tokenId: bigint;
    title: string;
    metadata: string;
    remainingTokens: bigint;
    disabled: boolean;
    ipfsData?: EditionIPFSData;
    averageRating?: number;
    commentsCount?: number;
}

interface ArtistStats {
    editionsCount: number;
    collectorsCount: number;
    memberSinceYear?: number;
}

/**
 * Client-rendered UI of the artist details page. The actual page.tsx
 * file is a server component that wraps this and exports
 * `generateMetadata` so that share previews (OpenGraph/Twitter cards)
 * are populated per artist server-side.
 */
export default function ArtistPageClient() {
    const t = useTranslations('Explore.artist');
    const params = useParams();
    const artistAddress = params.address as string;

    const [artist, setArtist] = useState<ArtistInfo | null>(null);
    const [artistIPFSData, setArtistIPFSData] = useState<ArtistIPFSData | null>(null);
    const [editions, setEditions] = useState<EditionInfo[]>([]);
    const [stats, setStats] = useState<ArtistStats | null>(null);

    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        fetchingArtist: true,
        loadingIPFS: false,
    });

    useEffect(() => {
        const fetchArtistDetails = async () => {
            if (!publicClient || !artistAddress) { setLoadingStates(prev => ({ ...prev, fetchingArtist: false })); return; }
            try {
                const artistData = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtist',
                    args: [artistAddress as `0x${string}`]
                }) as any;

                let artistName = t('anonymous');
                let artistLocation = '';

                if (artistData.metadata?.trim()) {
                    setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                    try {
                        const ipfsData = await getFromIPFSGateway(artistData.metadata) as ArtistIPFSData;
                        setArtistIPFSData(ipfsData);
                        artistName = ipfsData.name || t('anonymous');
                        artistLocation = ipfsData.location || '';
                    } catch (e) {
                        console.error('Error loading artist IPFS data:', e);
                    } finally {
                        setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
                    }
                }

                setArtist({
                    name: artistName,
                    location: artistLocation,
                    metadata: artistData.metadata
                });

                // -------- editions of this artist --------
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    args: { artist: artistAddress as `0x${string}` },
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest'
                });

                // -------- stats: unique collectors + member since year --------
                // Compute these in parallel with the edition fetching loop to
                // keep latency down. Both are best-effort: failures don't break
                // the rest of the page.
                let computedStats: ArtistStats = { editionsCount: logs.length, collectorsCount: 0 };
                try {
                    // Member since: timestamp of the earliest NewArtworkEdition event.
                    if (logs.length > 0) {
                        const earliestLog = logs.reduce((min, l) =>
                            (l.blockNumber !== null && (min.blockNumber === null || l.blockNumber < min.blockNumber)) ? l : min
                        );
                        if (earliestLog.blockNumber !== null) {
                            const block = await publicClient.getBlock({ blockNumber: earliestLog.blockNumber });
                            computedStats.memberSinceYear = new Date(Number(block.timestamp) * 1000).getFullYear();
                        }
                    }

                    // Unique collectors: every TransferSingle outgoing from the
                    // artist wallet represents a claim. We dedupe by destination
                    // address (excluding the artist self-transfer corner case).
                    const transferLogs = await publicClient.getLogs({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        event: parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'),
                        args: { from: artistAddress as `0x${string}` },
                        fromBlock: getDeploymentBlock(),
                        toBlock: 'latest'
                    });
                    const collectors = new Set<string>();
                    for (const log of transferLogs) {
                        const to = (log.args.to as string | undefined)?.toLowerCase();
                        if (to && to !== artistAddress.toLowerCase()) collectors.add(to);
                    }
                    computedStats.collectorsCount = collectors.size;
                } catch (e) {
                    console.error('Error computing artist stats:', e);
                }
                setStats(computedStats);

                // -------- edition details --------
                const editionsData: EditionInfo[] = [];
                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;
                    const [[editionMetadata, , editionDisabled], balance] = await Promise.all([
                        publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtworkEdition', args: [tokenId] }) as Promise<any>,
                        publicClient.readContract({ address: ARTWORK_TOKENIZATION_ADDRESS, abi: ARTWORK_TOKENIZATION_ABI, functionName: 'balanceOf', args: [artistAddress as `0x${string}`, tokenId] }) as Promise<bigint>
                    ]);

                    let artworkTitle = t('untitled');
                    if (editionMetadata?.trim()) {
                        try {
                            const editionIpfsData = await getFromIPFSGateway(editionMetadata);
                            artworkTitle = editionIpfsData.title || t('untitled');
                        } catch (e) {
                            console.error('Error loading edition IPFS data:', e);
                        }
                    }

                    editionsData.push({ tokenId, title: artworkTitle, metadata: editionMetadata, remainingTokens: balance, disabled: editionDisabled });
                }

                editionsData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setEditions(editionsData);

                for (const edition of editionsData) {
                    const count = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviewsCount', args: [edition.tokenId] }) as bigint;
                    let avgRating = 0;
                    if (count > 0n) {
                        const comments = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviews', args: [edition.tokenId, 0n, count] }) as any[];
                        avgRating = comments.reduce((a: number, c: any) => {
                        return a + Number(c[1]); }, 0) / comments.length;
                    }
                    if (edition.metadata?.trim()) {
                        try {
                            const ipfs = await getFromIPFSGateway(edition.metadata);
                            setEditions(prev => prev.map(e => e.tokenId === edition.tokenId ? { ...e, ipfsData: ipfs, averageRating: avgRating, commentsCount: Number(count) } : e));
                        } catch {
                            setEditions(prev => prev.map(e => e.tokenId === edition.tokenId ? { ...e, averageRating: avgRating, commentsCount: Number(count) } : e));
                        }
                    } else {
                        setEditions(prev => prev.map(e => e.tokenId === edition.tokenId ? { ...e, averageRating: avgRating, commentsCount: Number(count) } : e));
                    }
                }
            } catch (e) {
                console.error('Error loading artist details:', e);
            } finally {
                setLoadingStates(prev => ({ ...prev, fetchingArtist: false }));
            }
        };
        fetchArtistDetails();
    // t is stable across renders for a given locale (next-intl) so excluding it is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artistAddress]);

    if (loadingStates.fetchingArtist) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{t('loading')}</p>
            </div>
        </div>
    );

    if (!artist) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className=" italic text-[22px] text-[#a8a29e]">{t('notFound')}</p>
            </div>
        </div>
    );

    const { socialMedia, exhibitions, portfolio } = artistIPFSData ?? {};
    const hasSocialMedia = socialMedia && (socialMedia.instagram || socialMedia.twitter || socialMedia.facebook);

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">

                {/* Back */}
                <Link
                    href="/explore/artists"
                    className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[#78716c]
                        border border-[#d6d0c8] px-4 py-2 mb-12 no-underline
                        hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200"
                >
                    {t('back')}
                </Link>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6">
                        {t('ipfsLoading')}
                    </p>
                )}

                {/* Artist header */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px">

                    {/*
                     * Hero — first portfolio photo, with the artist avatar
                     * overlapping the bottom-left of the cover (Instagram/
                     * Twitter pattern). The avatar is positioned outside the
                     * cover's overflow-hidden container so the bottom half
                     * actually extends into the content area below.
                     */}
                    {portfolio?.[0] && (
                        <div className="relative">
                            <div className="w-full aspect-[21/9] overflow-hidden bg-[#e7e3dc]">
                                <img
                                    src={ipfsToHttp(portfolio[0])}
                                    alt={artist.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {artistIPFSData?.logo && (
                                <img
                                    src={ipfsToHttp(artistIPFSData.logo)}
                                    alt={t('logoAlt', { name: artist.name })}
                                    className="absolute left-6 md:left-8 bottom-0 translate-y-1/2 w-24 h-24 md:w-28 md:h-28 object-cover border-2 border-[#fafaf8] bg-[#f5f3ef] shadow-md z-10"
                                />
                            )}
                        </div>
                    )}

                    <div
                        className={
                            // Reserve extra top padding when the avatar overlaps,
                            // so the name doesn't sit underneath it.
                            portfolio?.[0] && artistIPFSData?.logo
                                ? 'p-6 pt-20 md:p-8 md:pt-24'
                                : 'p-6 md:p-8'
                        }
                    >
                        {/*
                         * Fallback avatar when there's no hero cover to overlap.
                         * Renders inline at the top of the content block so the
                         * artist still has a portrait without floating in space.
                         */}
                        {!portfolio?.[0] && artistIPFSData?.logo && (
                            <img
                                src={ipfsToHttp(artistIPFSData.logo)}
                                alt={t('logoAlt', { name: artist.name })}
                                className="w-24 h-24 md:w-28 md:h-28 object-cover border border-[#e7e3dc] bg-[#f5f3ef] mb-6"
                            />
                        )}

                        {/* Name + share */}
                        <div className="flex items-start justify-between gap-6 mb-6 pb-6 border-b border-[#e7e3dc] flex-wrap">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-6 h-px bg-[#d6d0c8]" />
                                    <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                        {t('certifiedArtist')}
                                    </span>
                                </div>
                                <h1 className=" text-[clamp(32px,5vw,52px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-2">
                                    {artist.name}
                                </h1>
                                {artist.location && (
                                    <p className="text-[14px] font-light text-[#78716c]">{artist.location}</p>
                                )}
                            </div>

                            <div className="flex-shrink-0">
                                <ArtistShareButton artistName={artist.name} />
                            </div>
                        </div>

                        {/* Stats bar — editions count · collectors · member since */}
                        {stats && (
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-8 border-b border-[#e7e3dc]">
                                <StatItem value={t('statsEditions', { count: stats.editionsCount })} />
                                <StatDot />
                                <StatItem value={t('statsCollectors', { count: stats.collectorsCount })} />
                                {stats.memberSinceYear && (
                                    <>
                                        <StatDot />
                                        <StatItem value={t('memberSince', { year: stats.memberSinceYear })} />
                                    </>
                                )}
                            </div>
                        )}

                        {/* Info grid */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Left — bio + exhibitions */}
                            <div className="flex flex-col gap-6">
                                {artistIPFSData?.bio && (
                                    <div>
                                        <Label>{t('about')}</Label>
                                        <p className="text-[14px] font-light text-[#1c1917] leading-[1.8]">
                                            {artistIPFSData.bio}
                                        </p>
                                    </div>
                                )}
                                {exhibitions && exhibitions.length > 0 && (
                                    <div>
                                        <Label>{t('exhibitions')}</Label>
                                        <ul className="flex flex-col gap-1.5">
                                            {exhibitions.map((ex, i) => (
                                                <li key={i} className="text-[13px] font-light text-[#1c1917] leading-[1.7] border-l-2 border-[#d6d0c8] pl-3">
                                                    {ex}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Right — contact & links */}
                            <div className="flex flex-col gap-4">
                                {artist.location && (
                                    <InfoRow label={t('location')} value={artist.location} />
                                )}

                                {artistIPFSData?.website && (
                                    <div className="flex flex-col gap-1 pb-4 border-b border-[#f0ede8]">
                                        <Label>{t('website')}</Label>
                                        <a
                                            href={artistIPFSData.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[13px] font-light text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity break-all"
                                        >
                                            {artistIPFSData.website}
                                        </a>
                                    </div>
                                )}

                                {hasSocialMedia && (
                                    <div className="flex flex-col gap-1 pb-4 border-b border-[#f0ede8]">
                                        <Label>{t('socialMedia')}</Label>
                                        <div className="flex flex-col gap-1.5">
                                            {socialMedia.instagram && (
                                                <a
                                                    href={`https://instagram.com/${socialMedia.instagram.replace('@', '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] font-light text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity"
                                                >
                                                    Instagram · {socialMedia.instagram}
                                                </a>
                                            )}
                                            {socialMedia.twitter && (
                                                <a
                                                    href={`https://x.com/${socialMedia.twitter.replace('@', '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] font-light text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity"
                                                >
                                                    Twitter / X · {socialMedia.twitter}
                                                </a>
                                            )}
                                            {socialMedia.facebook && (
                                                <a
                                                    href={socialMedia.facebook.startsWith('http') ? socialMedia.facebook : `https://facebook.com/${socialMedia.facebook.replace('@', '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[13px] font-light text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity"
                                                >
                                                    Facebook · {socialMedia.facebook}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label>{t('ethAddress')}</Label>
                                    <p className="text-[11px] font-mono text-[#a8a29e] break-all">{artistAddress}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Photo gallery — portfolio (skip first used as hero) */}
                {portfolio && portfolio.length > 1 && (
                    <div className="border border-[#d6d0c8] border-t-0 bg-[#fafaf8] p-8 mb-px">
                        <h2 className=" text-[22px] font-normal text-[#1c1917] mb-6">
                            {t('portfolioTitleStart')} <em className="italic text-[#78716c]">{t('portfolioTitleAccent')}</em>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                            {portfolio.slice(1).map((photo, i) => (
                                <div key={i} className="aspect-square overflow-hidden bg-[#e7e3dc]">
                                    <img
                                        src={ipfsToHttp(photo)}
                                        alt={t('photoAlt', { index: i + 2, name: artist.name })}
                                        className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Works section */}
                <div className="mt-16 mb-8">
                    <div className="flex items-end justify-between border-b border-[#d6d0c8] pb-6 mb-0">
                        <h2 className=" text-[clamp(24px,3vw,36px)] font-normal tracking-[-0.5px] text-[#1c1917]">
                            {t('worksTitleStart')} <em className="italic text-[#78716c]">{t('worksTitleAccent')}</em>
                        </h2>
                        <span className=" italic text-[36px] text-[#e7e3dc] leading-none">
                            {editions.length}
                        </span>
                    </div>
                </div>

                {editions.length === 0 ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-12 text-center">
                        <p className=" italic text-[18px] text-[#a8a29e]">
                            {t('noWorks')}
                        </p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                        {editions.filter(e => !e.disabled).map((edition) => (
                            <Link
                                key={edition.tokenId.toString()}
                                href={`/explore/edition/${edition.tokenId}`}
                                className="bg-[#fafaf8] p-5 flex flex-col gap-3 hover:bg-[#f5f3ef] transition-colors duration-200 no-underline group"
                            >
                                {edition.ipfsData?.images?.[0] ? (
                                    <div className="w-full aspect-[4/3] overflow-hidden bg-[#e7e3dc]">
                                        <img
                                            src={ipfsToHttp(edition.ipfsData.images[0])}
                                            alt={edition.title}
                                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full aspect-[4/3] bg-[#e7e3dc] flex items-center justify-center">
                                        <img src="/logo-mona.svg" alt="Logo" className="w-16 h-16 object-contain opacity-20" />
                                    </div>
                                )}

                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        {edition.ipfsData?.category && (
                                            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-1">
                                                {getCategoryLabel(edition.ipfsData.category)}
                                            </p>
                                        )}
                                        <h3 className=" text-[17px] font-normal text-[#1c1917] leading-tight">
                                            {edition.title}
                                        </h3>
                                    </div>
                                    <span className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#4a5240] border border-[#4a5240] px-1.5 py-0.5 flex-shrink-0 mt-1">
                                        {t('certifiedBadge')}
                                    </span>
                                </div>

                                {edition.ipfsData?.technique && (
                                    <p className="text-[12px] font-light text-[#78716c]">
                                        {edition.ipfsData.technique}
                                        {edition.ipfsData.dimensions ? ` — ${edition.ipfsData.dimensions}` : ''}
                                    </p>
                                )}

                                {edition.ipfsData?.year && (
                                    <p className="text-[11px] font-light text-[#a8a29e]">{edition.ipfsData.year}</p>
                                )}

                                {edition.commentsCount !== undefined && edition.commentsCount > 0 && (
                                    <p className="text-[12px] font-light text-[#78716c]">
                                        {edition.averageRating?.toFixed(1)} · {t('verifiedReviews', { count: edition.commentsCount })}
                                    </p>
                                )}

                                <div className="border-t border-[#e7e3dc] pt-3 flex items-center justify-between">
                                    <p className="text-[10px] font-mono text-[#a8a29e]">
                                        #{edition.tokenId.toString()}
                                    </p>
                                    <p className="text-[12px] font-light text-[#78716c]">
                                        {t('copies', { count: Number(edition.remainingTokens) })}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Trust block — for visitors landing here from social media */}
                <div className="mt-20 border-t border-[#d6d0c8] pt-12">
                    <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                        <img
                            src="/logo-mona.svg"
                            alt="Mona Editions"
                            className="w-24 h-12 object-contain opacity-60"
                        />
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                            {t('trustTitle')}
                        </p>
                        <p className="text-[13px] font-light text-[#78716c] leading-[1.8]">
                            {t('trustBody')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                            <Link
                                href="/about"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustLinkAbout')}
                            </Link>
                            <span className="text-[#d6d0c8]">·</span>
                            <Link
                                href="/explore/artists"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustLinkArtists')}
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[9px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-2">{children}</p>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 pb-4 border-b border-[#f0ede8]">
            <Label>{label}</Label>
            <p className="text-[13px] font-light text-[#1c1917]">{value}</p>
        </div>
    );
}

function StatItem({ value }: { value: string }) {
    return (
        <span className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] uppercase">
            {value}
        </span>
    );
}

function StatDot() {
    return <span className="text-[#d6d0c8] text-[12px]">·</span>;
}

/**
 * Page-specific wrapper around the shared <ShareMenu/>. Fills in the
 * collector-facing copy from the Explore.artist translation namespace and
 * tracks the current URL client-side (window.location.href is the source
 * of truth — locale prefix is already in the path).
 */
function ArtistShareButton({ artistName }: { artistName: string }) {
    const t = useTranslations('Explore.artist');
    const [pageUrl, setPageUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPageUrl(window.location.href);
        }
    }, []);

    return (
        <ShareMenu
            data={{
                pageUrl,
                twitterText: t('shareSocialText', { name: artistName, url: pageUrl }),
                emailSubject: t('shareEmailSubject', { name: artistName }),
                emailBody: t('shareEmailBody', { name: artistName, url: pageUrl }),
            }}
            labels={{
                share: t('share'),
                shareCopied: t('shareCopied'),
                shareCopyLink: t('shareCopyLink'),
                shareTwitter: t('shareTwitter'),
                shareFacebook: t('shareFacebook'),
                shareEmail: t('shareEmail'),
            }}
        />
    );
}
