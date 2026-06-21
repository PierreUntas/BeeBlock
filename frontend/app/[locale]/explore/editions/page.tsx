'use client';

import { useState, useEffect, Suspense } from 'react';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { getCategoryLabel } from '@/app/utils/categories';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

// New artwork IPFS structure
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
    artist: string;
    title: string;
    metadata: string;
    remainingTokens: bigint;
    disabled: boolean;
    ipfsData?: EditionIPFSData;
    averageRating?: number;
    commentsCount?: number;
}

interface ArtistInfo {
    name: string;
    location: string;
}

function ExplorePageContent() {
    const t = useTranslations('Explore.editions');
    const searchParams = useSearchParams();
    const categoryFromUrl = searchParams.get('category');
    const [editions, setEditions] = useState<EditionInfo[]>([]);
    const [artists, setArtists] = useState<Map<string, ArtistInfo>>(new Map());
    
    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        fetchingEditions: true,
        loadingIPFS: false,
    });
    
    const [filterCategory, setFilterCategory] = useState<string>(categoryFromUrl || 'all');

    useEffect(() => {
        const fetchAllEditions = async () => {
            if (!publicClient) { setLoadingStates(prev => ({ ...prev, fetchingEditions: false })); return; }
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest'
                });

                const editionsPromises = logs.map(async (log) => {
                    const tokenId = log.args.editionId as bigint;
                    const artistAddress = log.args.artist as `0x${string}`;
                    const [[editionMetadata, , editionDisabled], balance, artistData] = await Promise.all([
                        publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtworkEdition', args: [tokenId] }) as Promise<any>,
                        publicClient.readContract({ address: ARTWORK_TOKENIZATION_ADDRESS, abi: ARTWORK_TOKENIZATION_ABI, functionName: 'balanceOf', args: [artistAddress, tokenId] }) as Promise<bigint>,
                        publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtist', args: [artistAddress] }) as Promise<any>
                    ]);

                    let artistName = t('anonymousArtist');
                    let artistLocation = t('locationUnknown');
                    if (artistData.metadata?.trim()) {
                        try {
                            const artistIpfsData = await getFromIPFSGateway(artistData.metadata);
                            artistName = artistIpfsData.name || t('anonymousArtist');
                            artistLocation = artistIpfsData.location || t('locationUnknown');
                        } catch (e) {
                            console.error('Error loading artist IPFS data:', e);
                        }
                    }

                    let artworkTitle = t('untitled');
                    if (editionMetadata?.trim()) {
                        try {
                            const editionIpfsData = await getFromIPFSGateway(editionMetadata);
                            artworkTitle = editionIpfsData.title || t('untitled');
                        } catch (e) {
                            console.error('Error loading edition IPFS data:', e);
                        }
                    }

                    return {
                        edition: { tokenId, artist: artistAddress, title: artworkTitle, metadata: editionMetadata, remainingTokens: balance, disabled: editionDisabled },
                        artistInfo: { address: artistAddress, name: artistName, location: artistLocation }
                    };
                });

                const results = await Promise.all(editionsPromises);
                const artistsMap = new Map<string, ArtistInfo>();
                const editionsData = results.map(({ edition, artistInfo }) => {
                    if (!artistsMap.has(artistInfo.address))
                        artistsMap.set(artistInfo.address, { name: artistInfo.name, location: artistInfo.location });
                    return edition;
                });

                editionsData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setEditions(editionsData);
                setArtists(artistsMap);
                setLoadingStates(prev => ({ ...prev, fetchingEditions: false }));

                // Load full IPFS data for each artwork (images, category, technique, etc.)
                setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                const ipfsResults = await Promise.all(editionsData.map(async (edition) => {
                    if (!edition.metadata) return null;
                    try { return { tokenId: edition.tokenId, ipfsData: await getFromIPFSGateway(edition.metadata) as EditionIPFSData }; }
                    catch { return null; }
                }));

                setEditions(prev => {
                    const updated = [...prev];
                    ipfsResults.forEach(r => {
                        if (r) { const i = updated.findIndex(b => b.tokenId === r.tokenId); if (i !== -1) updated[i] = { ...updated[i], ipfsData: r.ipfsData }; }
                    });
                    return updated;
                });

                const ratingsResults = await Promise.all(editionsData.map(async (edition) => {
                    try {
                        const count = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviewsCount', args: [edition.tokenId] }) as bigint;
                        if (count > 0n) {
                            const comments = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviews', args: [edition.tokenId, 0n, count] }) as any[];
                            const avg = comments.length > 0 ? comments.reduce((s, c) => s + Number(c[1]), 0) / comments.length : undefined;
                            return { tokenId: edition.tokenId, averageRating: avg, commentsCount: Number(count) };
                        }
                        return null;
                    } catch { return null; }
                }));

                setEditions(prev => {
                    const updated = [...prev];
                    ratingsResults.forEach(r => {
                        if (r) { const i = updated.findIndex(b => b.tokenId === r.tokenId); if (i !== -1) updated[i] = { ...updated[i], averageRating: r.averageRating, commentsCount: r.commentsCount }; }
                    });
                    return updated;
                });
                setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
            } catch (e) {
                console.error('Error loading editions:', e);
                setLoadingStates(prev => ({ ...prev, fetchingEditions: false }));
            }
        };
        fetchAllEditions();
    }, []);

    // Filter by category (from new IPFS structure)
    const activeEditions = editions.filter(e => !e.disabled);
    const uniqueCategories = Array.from(new Set(activeEditions.map(b => b.ipfsData?.category).filter(Boolean))) as string[];
    const filteredEditions = filterCategory === 'all'
        ? activeEditions
        : activeEditions.filter(b => b.ipfsData?.category === filterCategory);

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">

                {/* Header */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-px bg-[#d6d0c8]" />
                        <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">{t('title')}</span>
                    </div>
                    <div className="flex items-end justify-between border-b border-[#d6d0c8] pb-8">
                        <div>
                            <h1 className=" text-[clamp(40px,6vw,64px)] font-normal leading-[1.05] tracking-[-1.5px] text-[#1c1917] mb-3">
                                {t('title')} <em className="italic text-[#78716c]">{t('titleAccent')}</em>
                            </h1>
                        </div>
                        <div className="text-right hidden md:block">
                            <span className=" italic text-[48px] text-[#e7e3dc] leading-none">{activeEditions.length}</span>
                            <span className="block text-[11px] font-light tracking-[0.08em] text-[#a8a29e] mt-1">{t('certifiedSuffix')}</span>
                        </div>
                    </div>
                </div>

                {/* Filters by category */}
                <div className="flex gap-2 flex-wrap mb-10">
                    <FilterBtn active={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>
                        {t('filterAll')} ({activeEditions.length})
                    </FilterBtn>
                    {uniqueCategories.map(cat => (
                        <FilterBtn key={cat} active={filterCategory === cat} onClick={() => setFilterCategory(cat)}>
                            {getCategoryLabel(cat)} ({activeEditions.filter(b => b.ipfsData?.category === cat).length})
                        </FilterBtn>
                    ))}
                </div>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6">
                        {t('ipfsLoading')}
                    </p>
                )}

                {loadingStates.fetchingEditions ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{t('loading')}</p>
                    </div>
                ) : filteredEditions.length === 0 ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-12 text-center">
                        <p className=" italic text-[22px] text-[#a8a29e]">{t('empty')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                        {filteredEditions.map((edition) => (
                            <Link
                                key={edition.tokenId.toString()}
                                href={`/explore/edition/${edition.tokenId}`}
                                className="bg-[#fafaf8] p-6 flex flex-col gap-4 hover:bg-[#f5f3ef] transition-colors duration-200 no-underline group"
                            >
                                {/* First image from portfolio, or placeholder */}
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

                                {/* Info */}
                                <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            {edition.ipfsData?.category && (
                                                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#a8a29e] mb-1">
                                                    {getCategoryLabel(edition.ipfsData.category)}
                                                </p>
                                            )}
                                            <h3 className=" text-[18px] font-normal text-[#1c1917] leading-tight">
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

                                    {edition.commentsCount !== undefined && edition.commentsCount > 0 && edition.averageRating !== undefined && !isNaN(edition.averageRating) && (
                                        <p className="text-[12px] font-light text-[#78716c]">
                                            {edition.averageRating.toFixed(1)} · {t('verifiedReviews', { count: edition.commentsCount })}
                                        </p>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="border-t border-[#e7e3dc] pt-4 flex items-end justify-between">
                                    <div>
                                        <p className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#a8a29e] mb-0.5">{t('artistLabel')}</p>
                                        <p className="text-[13px] font-light text-[#1c1917]">{artists.get(edition.artist)?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-medium tracking-[0.1em] uppercase text-[#a8a29e] mb-0.5">{t('editionLabel')}</p>
                                        <p className="text-[13px] font-light text-[#78716c] font-mono">
                                            {edition.remainingTokens.toString()}
                                            {edition.ipfsData?.editionSize ? ` / ${edition.ipfsData.editionSize}` : ''}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Trust footer — same pattern as artist/edition/collector pages */}
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

export default function ExplorePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="max-w-[960px] mx-auto px-6 pt-28 pb-20">
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement…</p>
                    </div>
                </div>
            </div>
        }>
            <ExplorePageContent />
        </Suspense>
    );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`text-[11px] font-medium tracking-[0.06em] px-4 py-2 border transition-all duration-200 cursor-pointer
                ${active
                    ? 'bg-[#1c1917] text-[#f5f3ef] border-[#1c1917]'
                    : 'bg-[#fafaf8] text-[#78716c] border-[#d6d0c8] hover:border-[#1c1917] hover:text-[#1c1917]'
                }`}
        >
            {children}
        </button>
    );
}