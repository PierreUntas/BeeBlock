'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { getCategoryLabel } from '@/app/utils/categories';
import Link from 'next/link';
import { publicClient } from '@/lib/client';

interface EditionDetails {
    tokenId: bigint;
    artist: string;
    title: string;
    metadata: string;
    merkleRoot: string;
    remainingTokens: bigint;
    disabled: boolean;
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

export default function EditionDetailsPage() {
    const params = useParams();
    const editionId = params.id as string;

    const [edition, setEdition] = useState<EditionDetails | null>(null);
    const [editionIPFSData, setEditionIPFSData] = useState<EditionIPFSData | null>(null);
    const [artist, setArtist] = useState<ArtistInfo | null>(null);
    const [artistIPFSData, setArtistIPFSData] = useState<ArtistIPFSData | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsIPFS, setCommentsIPFS] = useState<Record<number, CommentIPFSData>>({});

    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        fetchingEdition: true,
        loadingIPFS: false,
    });

    const [selectedImage, setSelectedImage] = useState<number>(0);

    useEffect(() => {
        const fetchEditionDetails = async () => {
            if (!publicClient || !editionId) { setLoadingStates(prev => ({ ...prev, fetchingEdition: false })); return; }

            try {
                const tokenId = BigInt(editionId);

                const [editionMetadata, editionMerkleRoot, , editionDisabled] = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtworkEdition',
                    args: [tokenId]
                }) as any;

                const artistAddress = await publicClient.readContract({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    abi: ARTWORK_TOKENIZATION_ABI,
                    functionName: 'tokenArtist',
                    args: [tokenId]
                }) as `0x${string}`;

                const balance = await publicClient.readContract({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    abi: ARTWORK_TOKENIZATION_ABI,
                    functionName: 'balanceOf',
                    args: [artistAddress, tokenId]
                }) as bigint;

                let artworkTitle = 'Œuvre sans titre';
                if (editionMetadata?.trim()) {
                    setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                    try {
                        const ipfsData = await getFromIPFSGateway(editionMetadata) as EditionIPFSData;
                        setEditionIPFSData(ipfsData);
                        artworkTitle = ipfsData.title || 'Œuvre sans titre';
                    } catch (error) {
                        console.error('Error loading edition IPFS data:', error);
                    } finally {
                        setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
                    }
                }

                setEdition({ tokenId, artist: artistAddress, title: artworkTitle, metadata: editionMetadata, merkleRoot: editionMerkleRoot, remainingTokens: balance, disabled: editionDisabled });

                const artistData = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtist',
                    args: [artistAddress]
                }) as any;

                let artistName = 'Artiste anonyme';
                let artistLocation = '';
                if (artistData.metadata?.trim()) {
                    try {
                        const artistIpfsData = await getFromIPFSGateway(artistData.metadata) as ArtistIPFSData;
                        setArtistIPFSData(artistIpfsData);
                        artistName = artistIpfsData.name || 'Artiste anonyme';
                        artistLocation = artistIpfsData.location || '';
                    } catch (error) {
                        console.error('Error loading artist IPFS data:', error);
                    }
                }

                setArtist({ name: artistName, location: artistLocation, metadata: artistData.metadata });

                const commentsCount = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getEditionReviewsCount',
                    args: [tokenId]
                }) as bigint;

                if (commentsCount > 0n) {
                    const commentsData = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getEditionReviews',
                        args: [tokenId, 0n, 10n]
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
    }, [editionId]);

    const calculateAverageRating = () => {
        if (comments.length === 0) return 0;
        return (comments.reduce((acc, c) => acc + c.rating, 0) / comments.length).toFixed(1);
    };

    if (loadingStates.fetchingEdition) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement des détails de l'œuvre…</p>
            </div>
        </div>
    );

    if (!edition || !artist) return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className=" italic text-[22px] text-[#a8a29e]">Œuvre introuvable</p>
            </div>
        </div>
    );

    const images = editionIPFSData?.images ?? [];

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">

                <Link
                    href="/explore/editions"
                    className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-[#78716c]
                        border border-[#d6d0c8] px-4 py-2 mb-12 no-underline
                        hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200"
                >
                    ← Retour à l'exploration
                </Link>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6 text-center">
                        Chargement des données IPFS…
                    </p>
                )}

                {/* Header */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-8">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            {editionIPFSData?.category && (
                                <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] border border-[#d6d0c8] px-2 py-0.5 mb-3 inline-block">
                                    {getCategoryLabel(editionIPFSData.category)}
                                </span>
                            )}
                            <h1 className=" text-[clamp(32px,5vw,42px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-1">
                                {edition.title}
                            </h1>
                            <p className="text-[14px] text-[#78716c]">Œuvre #{edition.tokenId.toString()}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-6">
                            <p className="mb-1 text-[12px] text-[#a8a29e]">Exemplaires</p>
                            <p className=" text-4xl font-normal text-[#1c1917]">
                                {edition.remainingTokens.toString()}
                            </p>
                            {editionIPFSData?.editionSize && (
                                <p className="text-[11px] text-[#a8a29e]">/ {editionIPFSData.editionSize}</p>
                            )}
                        </div>
                    </div>
                    {comments.length > 0 && (
                        <div className="flex items-center gap-2 pt-3 border-t border-[#e7e3dc]">
                            <span className=" text-2xl font-normal text-[#1c1917]">{calculateAverageRating()}</span>
                            <span className="text-[#1c1917]">★★★★★</span>
                            <span className="text-[14px] text-[#78716c]">({comments.length} avis)</span>
                        </div>
                    )}
                </div>

                {/* Image gallery */}
                {images.length > 0 && (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-8">
                        <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                            Images de l'<em className="italic text-[#78716c]">œuvre</em>
                        </h2>
                        {/* Main image */}
                        <div className="w-full aspect-[4/3] overflow-hidden bg-[#e7e3dc] border border-[#d6d0c8] mb-3">
                            <img
                                src={ipfsToHttp(images[selectedImage])}
                                alt={`${edition.title} — image ${selectedImage + 1}`}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-2 flex-wrap">
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedImage(i)}
                                        className={`w-16 h-16 overflow-hidden border transition-all duration-200 ${
                                            selectedImage === i
                                                ? 'border-[#1c1917]'
                                                : 'border-[#d6d0c8] opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={ipfsToHttp(img)} alt={`Miniature ${i + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Artwork details */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-8">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        Informations de l'<em className="italic text-[#78716c]">œuvre</em>
                    </h2>
                    <div className="space-y-4">
                        {editionIPFSData?.description && (
                            <InfoBlock label="Description">
                                <p className="text-[15px] text-[#1c1917] leading-[1.75]">{editionIPFSData.description}</p>
                            </InfoBlock>
                        )}
                        {editionIPFSData?.year && (
                            <InfoBlock label="Année">
                                <p className="text-[15px] text-[#1c1917]">{editionIPFSData.year}</p>
                            </InfoBlock>
                        )}
                        {editionIPFSData?.technique && (
                            <InfoBlock label="Technique">
                                <p className="text-[15px] text-[#1c1917]">{editionIPFSData.technique}</p>
                            </InfoBlock>
                        )}
                        {editionIPFSData?.dimensions && (
                            <InfoBlock label="Dimensions">
                                <p className="text-[15px] text-[#1c1917]">{editionIPFSData.dimensions}</p>
                            </InfoBlock>
                        )}
                        {editionIPFSData?.editionSize && (
                            <InfoBlock label="Taille de l'édition">
                                <p className="text-[15px] text-[#1c1917]">{editionIPFSData.editionSize} exemplaires</p>
                            </InfoBlock>
                        )}
                        <InfoBlock label="Lien metadata" noBorder>
                            <a
                                href={`https://ipfs.io/ipfs/${edition.metadata}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[14px] text-[#4a5240] hover:opacity-70 transition-opacity break-all"
                            >
                                https://ipfs.io/ipfs/{edition.metadata}
                            </a>
                        </InfoBlock>
                    </div>
                </div>

                {/* Artist section */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-8">
                    <div className="flex items-start gap-6 mb-6 pb-6 border-b border-[#e7e3dc]">
                        <h2 className=" text-[22px] font-normal text-[#1c1917] flex-1">
                            L'<em className="italic text-[#78716c]">artiste</em>
                        </h2>
                        {artistIPFSData?.logo && (
                            <img
                                src={ipfsToHttp(artistIPFSData.logo)}
                                alt={`Logo ${artist.name}`}
                                className="w-20 h-20 object-contain flex-shrink-0 border border-[#d6d0c8] bg-[#f5f3ef]"
                            />
                        )}
                    </div>

                    <div className="space-y-4">
                        <InfoBlock label="Nom">
                            <p className="text-[15px] text-[#1c1917]">{artist.name}</p>
                        </InfoBlock>
                        <InfoBlock label="Localisation">
                            <p className="text-[15px] text-[#1c1917]">{artist.location}</p>
                        </InfoBlock>
                        {artistIPFSData?.bio && (
                            <InfoBlock label="Biographie">
                                <p className="text-[15px] text-[#1c1917] leading-[1.75]">{artistIPFSData.bio}</p>
                            </InfoBlock>
                        )}
                        {artistIPFSData?.website && (
                            <InfoBlock label="Site web">
                                <a
                                    href={artistIPFSData.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[14px] text-[#4a5240] hover:opacity-70 transition-opacity"
                                >
                                    {artistIPFSData.website}
                                </a>
                            </InfoBlock>
                        )}
                        {artistIPFSData?.socialMedia && (artistIPFSData.socialMedia.instagram || artistIPFSData.socialMedia.twitter || artistIPFSData.socialMedia.facebook) && (
                            <InfoBlock label="Réseaux sociaux">
                                <div className="flex flex-col gap-1">
                                    {artistIPFSData.socialMedia.instagram && (
                                        <a href={`https://instagram.com/${artistIPFSData.socialMedia.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#4a5240] hover:opacity-70 transition-opacity">
                                            Instagram · {artistIPFSData.socialMedia.instagram}
                                        </a>
                                    )}
                                    {artistIPFSData.socialMedia.twitter && (
                                        <a href={`https://x.com/${artistIPFSData.socialMedia.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#4a5240] hover:opacity-70 transition-opacity">
                                            Twitter / X · {artistIPFSData.socialMedia.twitter}
                                        </a>
                                    )}
                                    {artistIPFSData.socialMedia.facebook && (
                                        <a href={artistIPFSData.socialMedia.facebook.startsWith('http') ? artistIPFSData.socialMedia.facebook : `https://facebook.com/${artistIPFSData.socialMedia.facebook.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#4a5240] hover:opacity-70 transition-opacity">
                                            Facebook · {artistIPFSData.socialMedia.facebook}
                                        </a>
                                    )}
                                </div>
                            </InfoBlock>
                        )}
                        <div>
                            <p className="mb-1 text-[12px] text-[#a8a29e] uppercase tracking-[0.12em]">Adresse Ethereum</p>
                            <p className="text-[11px] font-mono break-all text-[#a8a29e]">{edition.artist}</p>
                        </div>
                    </div>

                    <Link
                        href={`/explore/artist/${edition.artist}`}
                        className="text-right block mt-6 text-[13px] text-[#4a5240] hover:text-[#1c1917] underline underline-offset-2 transition-colors"
                    >
                        Voir toutes ses œuvres →
                    </Link>
                </div>

                {/* Reviews */}
                {comments.length > 0 && (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-8">
                        <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                            Avis des <em className="italic text-[#78716c]">collectionneurs</em>
                        </h2>
                        <div className="space-y-4">
                            {comments.map((comment, index) => (
                                <div
                                    key={index}
                                    className={index < comments.length - 1 ? 'pb-4 border-b border-[#e7e3dc]' : 'pb-4'}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[#1c1917]">{'★'.repeat(comment.rating)}</span>
                                        <span className="font-mono text-[12px] text-[#a8a29e]">
                                            {comment.collector.slice(0, 6)}…{comment.collector.slice(-4)}
                                        </span>
                                    </div>
                                    <p className="text-[14px] text-[#1c1917] leading-[1.75]">
                                        {commentsIPFS[index]?.comment ?? '…'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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

function InfoBlock({ label, children, noBorder }: { label: string; children: React.ReactNode; noBorder?: boolean }) {
    return (
        <div className={noBorder ? '' : 'pb-4 border-b border-[#e7e3dc]'}>
            <p className="mb-1 text-[12px] text-[#a8a29e] uppercase tracking-[0.12em]">{label}</p>
            {children}
        </div>
    );
}