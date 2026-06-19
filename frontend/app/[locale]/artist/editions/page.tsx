'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { getCategoryLabel } from '@/app/utils/categories';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient, getDeploymentBlock } from '@/lib/client';

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
    merkleRoot: string;
    remainingTokens: bigint;
    disabled: boolean;
    ipfsData?: EditionIPFSData;
}

export default function ArtistEditionsPage() {
    const { address } = useAccount();
    const { user } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;
    const [editions, setEditions] = useState<EditionInfo[]>([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);

    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        fetchingEditions: false,
        loadingIPFS: false,
    });

    const { data: artistData, isLoading: isLoadingArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    useEffect(() => {
        if (artistData) {
            const artist = artistData as any;
            setIsAuthorized(artist.authorized);
            setIsCheckingAuthorization(false);
        } else if (!isLoadingArtist && artistData !== undefined) {
            setIsCheckingAuthorization(false);
        }
    }, [artistData, isLoadingArtist]);

    // Verrouillage métadonnée v2 : l'édition est figée dès qu'au moins
    // un certificat a quitté le portefeuille de l'artiste, peu importe
    // par quel canal (claim QR officiel, transfert ERC-1155 direct,
    // vente sur marketplace tierce).
    const isEditionLocked = (edition: EditionInfo): boolean => {
        const initial = edition.ipfsData?.editionSize;
        if (!initial) return false; // métadonnée IPFS pas encore chargée
        try {
            return edition.remainingTokens < BigInt(initial);
        } catch {
            return false;
        }
    };

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
                    toBlock: 'latest'
                });

                const editionsData: EditionInfo[] = [];

                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;

                    const [editionMetadata, editionMerkleRoot, editionDisabled] = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getArtworkEdition',
                        args: [tokenId]
                    }) as any;

                    const balance = await publicClient.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'balanceOf',
                        args: [activeAddress, tokenId]
                    }) as bigint;

                    let artworkTitle = 'Œuvre sans titre';
                    if (editionMetadata?.trim()) {
                        try {
                            const ipfsData = await getFromIPFSGateway(editionMetadata);
                            artworkTitle = ipfsData.title || 'Œuvre sans titre';
                        } catch (e) {
                            console.error('Error loading IPFS:', e);
                        }
                    }

                    editionsData.push({ tokenId, title: artworkTitle, metadata: editionMetadata, merkleRoot: editionMerkleRoot, remainingTokens: balance, disabled: editionDisabled });
                }

                editionsData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setEditions(editionsData);

                setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
                for (const edition of editionsData) {
                    if (edition.metadata) {
                        try {
                            const ipfsData = await getFromIPFSGateway(edition.metadata) as EditionIPFSData;
                            setEditions(prev => prev.map(e => e.tokenId === edition.tokenId ? { ...e, ipfsData } : e));
                        } catch (error) {
                            console.error(`Error loading IPFS for edition ${edition.tokenId}:`, error);
                        }
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
    }, [activeAddress, isAuthorized]);

    if (isCheckingAuthorization || isLoadingArtist) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Vérification des permissions…</p>
                </div>
            </div>
        );
    }

    if (!activeAddress) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[#a8a29e]">Veuillez connecter votre wallet</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[#a8a29e] text-center max-w-md px-6">
                        Accès refusé : vous n'êtes pas autorisé comme artiste
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-[860px] mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-8">
                        Mes <em className="italic text-[#78716c]">Œuvres</em>
                    </h1>
                    <Link
                        href="/artist/editions/create"
                        className="inline-block bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-8 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200"
                    >
                        + Créer une œuvre
                    </Link>
                </div>

                {loadingStates.fetchingEditions ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement de vos œuvres…</p>
                    </div>
                ) : editions.length === 0 ? (
                    <div className="text-center  italic text-[18px] text-[#a8a29e] py-12">
                        Vous n'avez pas encore créé d'œuvre.
                    </div>
                ) : (
                    <>
                        {loadingStates.loadingIPFS && (
                            <div className="text-center text-[13px] font-light text-[#a8a29e] mb-4 tracking-[0.06em]">
                                Chargement des données IPFS…
                            </div>
                        )}
                        <div className="space-y-px">
                            {editions.map((edition) => (
                                <div
                                    key={edition.tokenId.toString()}
                                    className="border border-[#d6d0c8] bg-[#fafaf8]"
                                >
                                    <Link
                                        href={`/explore/edition/${edition.tokenId}`}
                                        className="block p-8 hover:bg-[#f5f3ef] transition-colors duration-200"
                                    >
                                        <div className="flex justify-between items-start gap-8">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <h2 className=" text-[28px] font-normal text-[#1c1917] leading-tight">
                                                        {edition.title}
                                                    </h2>
                                                    {edition.disabled && (
                                                        <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#dc2626] border border-[#dc2626] px-2 py-0.5 flex-shrink-0">
                                                            Désactivée
                                                        </span>
                                                    )}
                                                    {isEditionLocked(edition) && !edition.disabled && (
                                                        <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-[#78716c] border border-[#d6d0c8] px-2 py-0.5 flex-shrink-0">
                                                            Verrouillée
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-[12px] font-light tracking-[0.06em] text-[#a8a29e]">
                                                        ŒUVRE #{edition.tokenId.toString()}
                                                    </p>
                                                    {edition.ipfsData?.category && (
                                                        <p className="text-[13px] font-light text-[#78716c]">
                                                            {getCategoryLabel(edition.ipfsData.category)}
                                                        </p>
                                                    )}
                                                    {edition.ipfsData?.technique && (
                                                        <p className="text-[13px] font-light text-[#78716c]">
                                                            {edition.ipfsData.technique}
                                                            {edition.ipfsData.dimensions ? ` — ${edition.ipfsData.dimensions}` : ''}
                                                        </p>
                                                    )}
                                                    {edition.ipfsData?.year && (
                                                        <p className="text-[13px] font-light text-[#a8a29e]">
                                                            {edition.ipfsData.year}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-[11px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                                    Exemplaires restants
                                                </p>
                                                <p className=" text-[36px] font-normal text-[#1c1917] leading-none">
                                                    {edition.remainingTokens.toString()}
                                                </p>
                                                {edition.ipfsData?.editionSize && (
                                                    <p className="text-[11px] text-[#a8a29e] mt-1">/ {edition.ipfsData.editionSize}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    {!isEditionLocked(edition) && !edition.disabled && (
                                        <div className="px-8 pb-4 border-t border-[#f0ece6]">
                                            <Link
                                                href={`/artist/editions/${edition.tokenId}/edit`}
                                                className="inline-block mt-3 text-[11px] font-medium tracking-[0.08em] text-[#78716c] border border-[#d6d0c8] px-4 py-1.5 hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200"
                                            >
                                                Modifier les métadonnées
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
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