'use client';

/**
 * Client-rendered UI for /explore/edition/[id].
 *
 * Editorial layout, mirroring the polished artist page treatment:
 *   1. Hero — large artwork image (and thumbnails if multiple)
 *   2. Title block — category, title, "par <artist>", availability, share
 *   3. About the work — description, then meta grid (year/technique/dim.)
 *   4. About the artist — compact preview card linking to full artist page
 *   5. Reviews — verified collector reviews (if any)
 *   6. Provenance — IPFS metadata link + on-chain artist address
 *   7. Trust footer — same pattern as the artist page so the visual story
 *      is consistent across all public-facing pages.
 *
 * The accompanying server component (`page.tsx`) generates the OpenGraph
 * metadata, so this file only needs to render — no SSR data fetching.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { publicClient } from '@/lib/client';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { getCategoryLabel } from '@/app/utils/categories';
import ShareMenu from '@/components/shared/ShareMenu';

// =========================================================================
// Types
// =========================================================================

interface EditionDetails {
    tokenId: bigint;
    artistAddress: `0x${string}`;
    title: string;
    metadataCid: string;
    remainingTokens: bigint;
    disabled: boolean;
}

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

interface ArtistInfo {
    name: string;
    location: string;
    metadataCid: string;
}

interface ArtistIPFSData {
    name?: string;
    location?: string;
    website?: string;
    bio?: string;
    logo?: string;
    portfolio?: string[];
    exhibitions?: string[];
    socialMedia?: {
        instagram?: string;
        twitter?: string;
        facebook?: string;
    };
}

interface Comment {
    collector: string;
    rating: number;
    editionId: bigint;
    metadata: string;
}

interface CommentIPFSData {
    rating: number;
    comment: string;
}

// =========================================================================
// Main component
// =========================================================================

export default function EditionPageClient() {
    const t = useTranslations('Explore.edition');
    const params = useParams();
    const editionId = params.id as string;

    const [edition, setEdition] = useState<EditionDetails | null>(null);
    const [editionIPFSData, setEditionIPFSData] = useState<EditionIPFSData | null>(null);
    const [artist, setArtist] = useState<ArtistInfo | null>(null);
    const [artistIPFSData, setArtistIPFSData] = useState<ArtistIPFSData | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsIPFS, setCommentsIPFS] = useState<Record<number, CommentIPFSData>>({});
    const [loadingStates, setLoadingStates] = useState({
        fetchingEdition: true,
        loadingIPFS: false,
    });
    const [selectedImage, setSelectedImage] = useState<number>(0);

    useEffect(() => {
        const fetchEditionDetails = async () => {
            if (!publicClient || !editionId) {
                setLoadingStates(prev => ({ ...prev, fetchingEdition: false }));
                return;
            }

            try {
                const tokenId = BigInt(editionId);

                // Edition record + artist resolution in parallel
                const [editionRecord, artistAddress] = await Promise.all([
                    publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getArtworkEdition',
                        args: [tokenId],
                    }) as Promise<readonly [string, string, boolean]>,
                    publicClient.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'tokenArtist',
                        args: [tokenId],
                    }) as Promise<`0x${string}`>,
                ]);
                const [editionMetadataCid, , editionDisabled] = editionRecord;

                // Balance of the artist (= remaining unclaimed copies)
                const balance = await publicClient.readContract({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    abi: ARTWORK_TOKENIZATION_ABI,
                    functionName: 'balanceOf',
                    args: [artistAddress, tokenId],
                }) as bigint;

                // IPFS title fallback for the on-chain record
                let artworkTitle = t('untitled');
                if (editionMetadataCid?.trim()) {
                    setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                    try {
                        const ipfsData = await getFromIPFSGateway(editionMetadataCid) as EditionIPFSData;
                        setEditionIPFSData(ipfsData);
                        artworkTitle = ipfsData.title || t('untitled');
                    } catch (e) {
                        console.error('Error loading edition IPFS data:', e);
                    } finally {
                        setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
                    }
                }

                setEdition({
                    tokenId,
                    artistAddress,
                    title: artworkTitle,
                    metadataCid: editionMetadataCid,
                    remainingTokens: balance,
                    disabled: editionDisabled,
                });

                // Artist record + IPFS in serial (depends on artistAddress)
                const artistData = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtist',
                    args: [artistAddress],
                }) as { authorized: boolean; metadata: string };

                let artistName = t('anonymousArtist');
                let artistLocation = '';
                if (artistData.metadata?.trim()) {
                    try {
                        const artistIpfs = await getFromIPFSGateway(artistData.metadata) as ArtistIPFSData;
                        setArtistIPFSData(artistIpfs);
                        artistName = artistIpfs.name || t('anonymousArtist');
                        artistLocation = artistIpfs.location || '';
                    } catch (e) {
                        console.error('Error loading artist IPFS data:', e);
                    }
                }
                setArtist({ name: artistName, location: artistLocation, metadataCid: artistData.metadata });

                // Reviews
                const commentsCount = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getEditionReviewsCount',
                    args: [tokenId],
                }) as bigint;

                if (commentsCount > 0n) {
                    const commentsData = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getEditionReviews',
                        args: [tokenId, 0n, 10n],
                    }) as Comment[];
                    setComments(commentsData);

                    const ipfsData: Record<number, CommentIPFSData> = {};
                    for (let i = 0; i < commentsData.length; i++) {
                        try {
                            const data = await getFromIPFSGateway(commentsData[i].metadata) as CommentIPFSData;
                            ipfsData[i] = data;
                        } catch (e) {
                            console.error('Error loading comment IPFS data:', e);
                        }
                    }
                    setCommentsIPFS(ipfsData);
                }
            } catch (error) {
                console.error('Error loading edition details:', error);
            } finally {
                setLoadingStates(prev => ({ ...prev, fetchingEdition: false }));
            }
        };

        fetchEditionDetails();
    // t is stable per locale (next-intl).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editionId]);

    const averageRating = comments.length === 0
        ? 0
        : Number((comments.reduce((acc, c) => acc + c.rating, 0) / comments.length).toFixed(1));

    if (loadingStates.fetchingEdition) {
        return (
            <Shell>
                <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{t('loading')}</p>
                </div>
            </Shell>
        );
    }

    if (!edition || !artist) {
        return (
            <Shell>
                <div className="flex items-center justify-center min-h-[40vh]">
                    <p className="italic text-[20px] text-[#a8a29e]">{t('notFound')}</p>
                </div>
            </Shell>
        );
    }

    const images = editionIPFSData?.images ?? [];
    const total = editionIPFSData?.editionSize ?? Number(edition.remainingTokens);
    const remaining = Number(edition.remainingTokens);
    const isSoldOut = total > 0 && remaining === 0;

    return (
        <Shell>
            {/* ---- Back link ---- */}
            <Link
                href="/explore/editions"
                className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[#78716c]
                    border border-[#d6d0c8] px-4 py-2 mb-10 no-underline
                    hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200"
            >
                {t('back')}
            </Link>

            {loadingStates.loadingIPFS && (
                <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6">
                    {t('ipfsLoading')}
                </p>
            )}

            {/* ============================================================ */}
            {/* HERO: image + thumbnails + title + share                     */}
            {/* ============================================================ */}
            <section className="border border-[#d6d0c8] bg-[#fafaf8] mb-px overflow-hidden">

                {/* Main image */}
                {images.length > 0 ? (
                    <>
                        <div className="w-full bg-[#e7e3dc] flex items-center justify-center" style={{ minHeight: '50vh' }}>
                            <img
                                src={ipfsToHttp(images[selectedImage])}
                                alt={t('imageAlt', { n: selectedImage + 1, title: edition.title })}
                                className="max-w-full max-h-[75vh] object-contain"
                            />
                        </div>
                        {images.length > 1 && (
                            <div className="flex gap-2 p-4 border-t border-[#e7e3dc] overflow-x-auto">
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedImage(i)}
                                        aria-label={t('thumbnailAlt', { n: i + 1 })}
                                        className={`flex-shrink-0 w-16 h-16 overflow-hidden border transition-all duration-200 cursor-pointer ${
                                            selectedImage === i
                                                ? 'border-[#1c1917]'
                                                : 'border-[#d6d0c8] opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img
                                            src={ipfsToHttp(img)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full bg-[#e7e3dc] flex items-center justify-center" style={{ minHeight: '40vh' }}>
                        <img src="/logo-mona.svg" alt="" className="w-20 h-20 object-contain opacity-20" />
                    </div>
                )}

                {/* Title block */}
                <div className="p-8">
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                        <div className="flex-1 min-w-[260px]">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-6 h-px bg-[#d6d0c8]" />
                                {editionIPFSData?.category ? (
                                    <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                        {getCategoryLabel(editionIPFSData.category)}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                        {t('editionLabel', { id: edition.tokenId.toString() })}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-[clamp(30px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-2">
                                {edition.title}
                            </h1>
                            <p className="text-[15px] italic text-[#78716c]">
                                <Link
                                    href={`/explore/artist/${edition.artistAddress}`}
                                    className="hover:text-[#1c1917] no-underline transition-colors"
                                >
                                    {t('byArtist', { artist: artist.name })}
                                </Link>
                            </p>
                        </div>

                        <ShareEditionButton title={edition.title} artistName={artist.name} />
                    </div>

                    {/* Status bar */}
                    <div className="mt-6 pt-6 border-t border-[#e7e3dc] flex flex-wrap items-center gap-x-6 gap-y-3">
                        {isSoldOut ? (
                            <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                {t('soldOutLabel')}
                            </span>
                        ) : (
                            <span className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] uppercase">
                                {t('editionStatus', { remaining, total })}
                            </span>
                        )}
                        {editionIPFSData?.year && (
                            <>
                                <span className="text-[#d6d0c8]">·</span>
                                <span className="text-[12px] font-light text-[#78716c]">
                                    {editionIPFSData.year}
                                </span>
                            </>
                        )}
                        {comments.length > 0 && (
                            <>
                                <span className="text-[#d6d0c8]">·</span>
                                <span className="text-[12px] font-light text-[#78716c]">
                                    {averageRating.toFixed(1)} ★ ({t('reviewsCount', { n: comments.length })})
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ============================================================ */}
            {/* ABOUT THE WORK: description + meta grid                      */}
            {/* ============================================================ */}
            {(editionIPFSData?.description || editionIPFSData?.technique || editionIPFSData?.dimensions) && (
                <section className="border border-[#d6d0c8] border-t-0 bg-[#fafaf8] p-8 mb-px">
                    {editionIPFSData?.description && (
                        <p className="text-[16px] font-light text-[#1c1917] leading-[1.85] mb-8 italic">
                            {editionIPFSData.description}
                        </p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#e7e3dc] border border-[#e7e3dc]">
                        {editionIPFSData?.year && (
                            <MetaCell label={t('year')} value={String(editionIPFSData.year)} />
                        )}
                        {editionIPFSData?.technique && (
                            <MetaCell label={t('technique')} value={editionIPFSData.technique} />
                        )}
                        {editionIPFSData?.dimensions && (
                            <MetaCell label={t('dimensions')} value={editionIPFSData.dimensions} />
                        )}
                        {editionIPFSData?.editionSize && (
                            <MetaCell
                                label={t('editionSize')}
                                value={t('editionSizeValue', { n: editionIPFSData.editionSize })}
                            />
                        )}
                    </div>
                </section>
            )}

            {/* ============================================================ */}
            {/* ARTIST PREVIEW                                               */}
            {/* ============================================================ */}
            <section className="border border-[#d6d0c8] border-t-0 bg-[#fafaf8] p-8 mb-px">
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-5">
                    {t('artistTitleStart')} {t('artistTitleAccent')}
                </p>

                <div className="flex items-start gap-5 flex-wrap">
                    {artistIPFSData?.logo ? (
                        <img
                            src={ipfsToHttp(artistIPFSData.logo)}
                            alt={t('logoAlt', { name: artist.name })}
                            className="w-16 h-16 object-contain border border-[#e7e3dc] bg-[#f5f3ef] flex-shrink-0"
                        />
                    ) : (
                        <div className="w-16 h-16 bg-[#e7e3dc] flex items-center justify-center flex-shrink-0">
                            <img src="/logo-mona.svg" alt="" className="w-8 h-8 object-contain opacity-30" />
                        </div>
                    )}

                    <div className="flex-1 min-w-[200px]">
                        <h3 className="text-[20px] font-normal text-[#1c1917] mb-1">
                            {artist.name}
                        </h3>
                        {artist.location && (
                            <p className="text-[13px] font-light text-[#78716c] mb-3">
                                {artist.location}
                            </p>
                        )}
                        {artistIPFSData?.bio && (
                            <p className="text-[14px] font-light text-[#1c1917] leading-[1.75] mb-4 line-clamp-3">
                                {artistIPFSData.bio}
                            </p>
                        )}
                        <Link
                            href={`/explore/artist/${edition.artistAddress}`}
                            className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[#1c1917] border border-[#d6d0c8] px-4 py-2 no-underline hover:border-[#1c1917] transition-all duration-200"
                        >
                            {t('viewAllWorks')} <span aria-hidden>→</span>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ============================================================ */}
            {/* REVIEWS                                                      */}
            {/* ============================================================ */}
            {comments.length > 0 && (
                <section className="border border-[#d6d0c8] border-t-0 bg-[#fafaf8] p-8 mb-px">
                    <h2 className="text-[22px] font-normal text-[#1c1917] mb-6">
                        {t('reviewsTitleStart')} <em className="italic text-[#78716c]">{t('reviewsTitleAccent')}</em>
                    </h2>
                    <div className="space-y-5">
                        {comments.map((comment, index) => (
                            <div
                                key={index}
                                className={index < comments.length - 1 ? 'pb-5 border-b border-[#e7e3dc]' : ''}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[14px] text-[#1c1917] tracking-[0.1em]">
                                        {'★'.repeat(comment.rating)}{'☆'.repeat(5 - comment.rating)}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#a8a29e]">
                                        {comment.collector.slice(0, 6)}…{comment.collector.slice(-4)}
                                    </span>
                                </div>
                                <p className="text-[14px] font-light text-[#1c1917] leading-[1.75]">
                                    {commentsIPFS[index]?.comment ?? '…'}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ============================================================ */}
            {/* PROVENANCE — technical, sober, for the curious               */}
            {/* ============================================================ */}
            <section className="border border-[#d6d0c8] border-t-0 bg-[#f5f3ef] p-8 mb-px">
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-4">
                    {t('provenanceTitle')}
                </p>
                <p className="text-[13px] font-light text-[#78716c] leading-[1.75] mb-5 max-w-2xl">
                    {t('provenanceBody')}
                </p>
                <div className="space-y-3 text-[11px]">
                    <ProvLine
                        label={t('ethAddress')}
                        value={edition.artistAddress}
                        href={`https://basescan.org/address/${edition.artistAddress}`}
                    />
                    <ProvLine
                        label={t('metadataLink')}
                        value={`ipfs://${edition.metadataCid}`}
                        href={`https://ipfs.io/ipfs/${edition.metadataCid}`}
                    />
                </div>
            </section>

            {/* ============================================================ */}
            {/* TRUST FOOTER                                                  */}
            {/* ============================================================ */}
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
        </Shell>
    );
}

// =========================================================================
// Layout shell
// =========================================================================

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">{children}</div>
        </div>
    );
}

// =========================================================================
// Small presentational components
// =========================================================================

function MetaCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-[#fafaf8] p-4">
            <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-2">
                {label}
            </p>
            <p className="text-[13px] font-light text-[#1c1917] leading-tight">
                {value}
            </p>
        </div>
    );
}

function ProvLine({ label, value, href }: { label: string; value: string; href: string }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
            <span className="font-medium tracking-[0.12em] uppercase text-[#a8a29e] flex-shrink-0 min-w-[120px]">
                {label}
            </span>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity break-all"
            >
                {value} <span aria-hidden>↗</span>
            </a>
        </div>
    );
}

/**
 * Page-specific share button wrapper. Builds the share text from the
 * Explore.edition translations and tracks the current URL client-side.
 */
function ShareEditionButton({ title, artistName }: { title: string; artistName: string }) {
    const t = useTranslations('Explore.edition');
    const [pageUrl, setPageUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') setPageUrl(window.location.href);
    }, []);

    return (
        <ShareMenu
            data={{
                pageUrl,
                twitterText: t('shareSocialText', { title, artist: artistName, url: pageUrl }),
                emailSubject: t('shareEmailSubject', { title, artist: artistName }),
                emailBody: t('shareEmailBody', { title, artist: artistName, url: pageUrl }),
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
