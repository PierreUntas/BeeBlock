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

export default function ArtistDetailsPage() {
    const params = useParams();
    const artistAddress = params.address as string;

    const [artist, setArtist] = useState<ArtistInfo | null>(null);
    const [artistIPFSData, setArtistIPFSData] = useState<ArtistIPFSData | null>(null);
    const [editions, setEditions] = useState<EditionInfo[]>([]);

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

                let artistName = 'Artiste anonyme';
                let artistLocation = '';

                if (artistData.metadata?.trim()) {
                    setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                    try {
                        const ipfsData = await getFromIPFSGateway(artistData.metadata) as ArtistIPFSData;
                        setArtistIPFSData(ipfsData);
                        artistName = ipfsData.name || 'Artiste anonyme';
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

                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    args: { artist: artistAddress as `0x${string}` },
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest'
                });

                const editionsData: EditionInfo[] = [];
                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;
                    const [[editionMetadata, , , editionDisabled], balance] = await Promise.all([
                        publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtworkEdition', args: [tokenId] }) as Promise<any>,
                        publicClient.readContract({ address: ARTWORK_TOKENIZATION_ADDRESS, abi: ARTWORK_TOKENIZATION_ABI, functionName: 'balanceOf', args: [artistAddress as `0x${string}`, tokenId] }) as Promise<bigint>
                    ]);

                    let artworkTitle = 'Œuvre sans titre';
                    if (editionMetadata?.trim()) {
                        try {
                            const editionIpfsData = await getFromIPFSGateway(editionMetadata);
                            artworkTitle = editionIpfsData.title || 'Œuvre sans titre';
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
    }, [artistAddress]);

    if (loadingStates.fetchingArtist) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement du profil…</p>
            </div>
        </div>
    );

    if (!artist) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className=" italic text-[22px] text-[#a8a29e]">Artiste introuvable</p>
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
                    ← Retour aux artistes
                </Link>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6">
                        Chargement des données IPFS…
                    </p>
                )}

                {/* Artist header */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px">

                    {/* Hero — first portfolio photo */}
                    {portfolio?.[0] && (
                        <div className="w-full aspect-[21/9] overflow-hidden bg-[#e7e3dc]">
                            <img
                                src={ipfsToHttp(portfolio[0])}
                                alt={artist.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    <div className="p-8">
                        {/* Name + logo */}
                        <div className="flex items-start justify-between gap-6 mb-8 pb-8 border-b border-[#e7e3dc]">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-6 h-px bg-[#d6d0c8]" />
                                    <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                                        Artiste certifié
                                    </span>
                                </div>
                                <h1 className=" text-[clamp(32px,5vw,52px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-2">
                                    {artist.name}
                                </h1>
                                <p className="text-[14px] font-light text-[#78716c]">{artist.location}</p>
                            </div>
                            {artistIPFSData?.logo && (
                                <img
                                    src={ipfsToHttp(artistIPFSData.logo)}
                                    alt={`Logo ${artist.name}`}
                                    className="w-20 h-20 object-contain flex-shrink-0 border border-[#e7e3dc] bg-[#f5f3ef]"
                                />
                            )}
                        </div>

                        {/* Info grid */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Left — bio + exhibitions */}
                            <div className="flex flex-col gap-6">
                                {artistIPFSData?.bio && (
                                    <div>
                                        <Label>À propos</Label>
                                        <p className="text-[14px] font-light text-[#1c1917] leading-[1.8]">
                                            {artistIPFSData.bio}
                                        </p>
                                    </div>
                                )}
                                {exhibitions && exhibitions.length > 0 && (
                                    <div>
                                        <Label>Expositions</Label>
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
                                <InfoRow label="Localisation" value={artist.location} />

                                {artistIPFSData?.website && (
                                    <div className="flex flex-col gap-1 pb-4 border-b border-[#f0ede8]">
                                        <Label>Site web</Label>
                                        <a
                                            href={artistIPFSData.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[13px] font-light text-[#4a5240] underline underline-offset-2 hover:opacity-70 transition-opacity"
                                        >
                                            {artistIPFSData.website}
                                        </a>
                                    </div>
                                )}

                                {hasSocialMedia && (
                                    <div className="flex flex-col gap-1 pb-4 border-b border-[#f0ede8]">
                                        <Label>Réseaux sociaux</Label>
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
                                    <Label>Adresse Ethereum</Label>
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
                            Portfolio <em className="italic text-[#78716c]">photos</em>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                            {portfolio.slice(1).map((photo, i) => (
                                <div key={i} className="aspect-square overflow-hidden bg-[#e7e3dc]">
                                    <img
                                        src={ipfsToHttp(photo)}
                                        alt={`Photo ${i + 2} — ${artist.name}`}
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
                            Œuvres <em className="italic text-[#78716c]">certifiées</em>
                        </h2>
                        <span className=" italic text-[36px] text-[#e7e3dc] leading-none">
                            {editions.length}
                        </span>
                    </div>
                </div>

                {editions.length === 0 ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-12 text-center">
                        <p className=" italic text-[18px] text-[#a8a29e]">
                            Cet artiste n'a pas encore certifié d'œuvre.
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
                                        Certifié
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
                                        {edition.averageRating?.toFixed(1)} · {edition.commentsCount} avis vérifié{edition.commentsCount > 1 ? 's' : ''}
                                    </p>
                                )}

                                <div className="border-t border-[#e7e3dc] pt-3 flex items-center justify-between">
                                    <p className="text-[10px] font-mono text-[#a8a29e]">
                                        #{edition.tokenId.toString()}
                                    </p>
                                    <p className="text-[12px] font-light text-[#78716c]">
                                        {edition.remainingTokens.toString()} exemplaire{Number(edition.remainingTokens) > 1 ? 's' : ''}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Footer mark */}
                <div className="flex justify-center mt-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-px h-12 bg-[#d6d0c8]" />
                        <span className=" italic text-[13px] text-[#a8a29e]">Mona Editions</span>
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