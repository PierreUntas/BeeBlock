'use client';

import { useState, useEffect } from 'react';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway, getIPFSUrl } from '@/app/utils/ipfs';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/lib/client';
import dynamic from 'next/dynamic';

interface BatchIPFSData {
    identifiant: string;
    typeMiel: string;
    periodeRecolte: string;
    dateMiseEnPot: string;
    lieuMiseEnPot: string;
    certifications: string[];
    composition: string;
    formatPot: string;
    etiquetage: string;
}

interface BatchInfo {
    tokenId: bigint;
    producer: string;
    honeyType: string;
    metadata: string;
    totalSupply: bigint;
    remainingTokens: bigint;
    ipfsData?: BatchIPFSData;
    averageRating?: number;
    commentsCount?: number;
}

interface ProducerInfo {
    name: string;
    location: string;
}

export default function ExplorePage() {
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [producers, setProducers] = useState<Map<string, ProducerInfo>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingIPFS, setIsLoadingIPFS] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        const fetchAllBatches = async () => {
            if (!publicClient) {
                setIsLoading(false);
                return;
            }

            try {
                const logs = await publicClient.getLogs({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    event: parseAbiItem('event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId)'),
                    fromBlock: 9753823n,
                    toBlock: 'latest'
                });

                // Récupérer toutes les données blockchain en parallèle
                const batchesPromises = logs.map(async (log) => {
                    const tokenId = log.args.honeyBatchId as bigint;
                    const producerAddress = log.args.producer as `0x${string}`;

                    // Exécuter les 3 appels en parallèle pour chaque lot
                    const [batchInfo, balance, producerData] = await Promise.all([
                        publicClient.readContract({
                            address: HONEY_TRACE_STORAGE_ADDRESS,
                            abi: HONEY_TRACE_STORAGE_ABI,
                            functionName: 'getHoneyBatch',
                            args: [tokenId]
                        }) as Promise<any>,
                        publicClient.readContract({
                            address: HONEY_TOKENIZATION_ADDRESS,
                            abi: HONEY_TOKENIZATION_ABI,
                            functionName: 'balanceOf',
                            args: [producerAddress, tokenId]
                        }) as Promise<bigint>,
                        publicClient.readContract({
                            address: HONEY_TRACE_STORAGE_ADDRESS,
                            abi: HONEY_TRACE_STORAGE_ABI,
                            functionName: 'getProducer',
                            args: [producerAddress]
                        }) as Promise<any>
                    ]);

                    return {
                        batch: {
                            tokenId,
                            producer: producerAddress,
                            honeyType: batchInfo.honeyType,
                            metadata: batchInfo.metadata,
                            totalSupply: balance,
                            remainingTokens: balance
                        },
                        producerInfo: {
                            address: producerAddress,
                            name: producerData.name || 'Producteur anonyme',
                            location: producerData.location || 'Non spécifié'
                        }
                    };
                });

                // Attendre toutes les requêtes blockchain
                const results = await Promise.all(batchesPromises);

                // Construire la map des producteurs
                const producersMap = new Map<string, ProducerInfo>();
                const batchesData = results.map(({ batch, producerInfo }) => {
                    if (!producersMap.has(producerInfo.address)) {
                        producersMap.set(producerInfo.address, {
                            name: producerInfo.name,
                            location: producerInfo.location
                        });
                    }
                    return batch;
                });

                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setBatches(batchesData);
                setProducers(producersMap);
                setIsLoading(false);

                // Charger les données IPFS en parallèle
                setIsLoadingIPFS(true);
                const ipfsPromises = batchesData.map(async (batch) => {
                    if (!batch.metadata) return null;

                    try {
                        const ipfsData = await getFromIPFSGateway(batch.metadata);
                        return { tokenId: batch.tokenId, ipfsData };
                    } catch (error) {
                        console.error(`Erreur chargement IPFS lot ${batch.tokenId}:`, error);
                        return null;
                    }
                });

                const ipfsResults = await Promise.all(ipfsPromises);

                // Mettre à jour tous les lots avec leurs données IPFS
                setBatches(prev => {
                    const updated = [...prev];
                    ipfsResults.forEach(result => {
                        if (result) {
                            const index = updated.findIndex(b => b.tokenId === result.tokenId);
                            if (index !== -1) {
                                updated[index] = { ...updated[index], ipfsData: result.ipfsData };
                            }
                        }
                    });
                    return updated;
                });

                // Charger les notes et avis pour chaque lot
                const ratingsPromises = batchesData.map(async (batch) => {
                    try {
                        const commentsCount = await publicClient.readContract({
                            address: HONEY_TRACE_STORAGE_ADDRESS,
                            abi: HONEY_TRACE_STORAGE_ABI,
                            functionName: 'getHoneyBatchCommentsCount',
                            args: [batch.tokenId]
                        }) as bigint;

                        if (commentsCount > 0n) {
                            const comments = await publicClient.readContract({
                                address: HONEY_TRACE_STORAGE_ADDRESS,
                                abi: HONEY_TRACE_STORAGE_ABI,
                                functionName: 'getHoneyBatchComments',
                                args: [batch.tokenId, 0n, commentsCount]
                            }) as any[];

                            const totalRating = comments.reduce((sum, comment) => sum + Number(comment.rating), 0);
                            const averageRating = totalRating / comments.length;

                            return {
                                tokenId: batch.tokenId,
                                averageRating,
                                commentsCount: Number(commentsCount)
                            };
                        }
                        return null;
                    } catch (error) {
                        console.error(`Erreur chargement avis lot ${batch.tokenId}:`, error);
                        return null;
                    }
                });

                const ratingsResults = await Promise.all(ratingsPromises);

                // Mettre à jour les lots avec les notes
                setBatches(prev => {
                    const updated = [...prev];
                    ratingsResults.forEach(result => {
                        if (result) {
                            const index = updated.findIndex(b => b.tokenId === result.tokenId);
                            if (index !== -1) {
                                updated[index] = {
                                    ...updated[index],
                                    averageRating: result.averageRating,
                                    commentsCount: result.commentsCount
                                };
                            }
                        }
                    });
                    return updated;
                });

                setIsLoadingIPFS(false);

            } catch (error) {
                console.error('Erreur lors du chargement des lots:', error);
                setIsLoading(false);
            }
        };

        fetchAllBatches();
    }, []);


    const filteredBatches = filterType === 'all'
        ? batches
        : batches.filter(b => b.honeyType.toLowerCase().includes(filterType.toLowerCase()));

    const uniqueHoneyTypes = Array.from(new Set(batches.map(b => b.honeyType)));

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-6xl">
                <div className="mb-8">
                    <h1 className="text-5xl font-[Carbon_Phyber] text-[#000000] mb-2">
                        Explorer les Lots de Miel
                    </h1>
                    <p className="text-lg font-[Olney_Light] text-[#000000] opacity-70">
                        Découvrez tous les lots de miel traçables sur la blockchain
                    </p>
                </div>

                <div className="mb-6 flex gap-2 flex-wrap">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-lg font-[Olney_Light] transition-colors border border-[#000000] ${
                            filterType === 'all'
                                ? 'bg-[#666666] text-white'
                                : 'bg-yellow-bee text-[#000000] opacity-70 hover:opacity-100'
                        }`}
                    >
                        Tous ({batches.length})
                    </button>
                    {uniqueHoneyTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-lg font-[Olney_Light] transition-colors border border-[#000000] cursor-pointer ${
                                filterType === type
                                    ? 'bg-[#666666] text-white'
                                    : 'bg-yellow-bee text-[#000000] opacity-70 hover:opacity-100'
                            }`}
                        >
                            {type} ({batches.filter(b => b.honeyType === type).length})
                        </button>
                    ))}
                </div>

                {isLoadingIPFS && (
                    <div className="text-center text-[#000000] font-[Olney_Light] mb-4 opacity-70">
                        Chargement des données IPFS...
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black/70 mb-4"></div>
                            <p className="text-[#000000] font-[Olney_Light] text-xl opacity-70">Chargement des lots...</p>
                        </div>
                    </div>
                ) : filteredBatches.length === 0 ? (
                    <div className="bg-yellow-bee rounded-lg p-8 opacity-70 text-center border border-[#000000]">
                        <p className="text-[#000000] font-[Olney_Light] text-lg">
                            Aucun lot trouvé
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredBatches.map((batch) => (
                            <Link
                                key={batch.tokenId.toString()}
                                href={`/explore/batch/${batch.tokenId}`}
                                className="bg-yellow-bee rounded-lg p-4 opacity-70 border border-[#000000] hover:opacity-100 transition-opacity"
                            >
                                {batch.ipfsData?.etiquetage && (
                                    <div className="mb-3 rounded-lg overflow-hidden">
                                        <img
                                            src={getIPFSUrl(batch.ipfsData.etiquetage)}
                                            alt={`Étiquette ${batch.honeyType}`}
                                            className="w-full h-32 object-cover"
                                        />
                                    </div>
                                )}
                                
                                <div className="mb-3">
                                    <h3 className="text-2xl font-[Carbon_bl] text-[#000000] mb-1">
                                        {batch.honeyType}
                                    </h3>
                                    {batch.ipfsData?.identifiant && (
                                        <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                            {batch.ipfsData.identifiant}
                                        </p>
                                    )}
                                </div>

                                {batch.ipfsData?.periodeRecolte && (
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/80 mb-2">
                                        📅 {batch.ipfsData.periodeRecolte}
                                    </p>
                                )}

                                {batch.ipfsData?.formatPot && (
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/80 mb-2">
                                        📦 {batch.ipfsData.formatPot}
                                    </p>
                                )}

                                {batch.ipfsData?.certifications && batch.ipfsData.certifications.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {batch.ipfsData.certifications.map((cert, index) => (
                                            <span
                                                key={index}
                                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                                            >
                                                {cert}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {batch.commentsCount !== undefined && batch.commentsCount > 0 && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-yellow-500">⭐</span>
                                        <span className="text-sm font-[Olney_Light] text-[#000000]">
                                            {batch.averageRating?.toFixed(1)} ({batch.commentsCount} avis)
                                        </span>
                                    </div>
                                )}

                                <div className="border-t border-[#000000]/20 pt-3 mt-3">
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60 mb-1">
                                        Producteur
                                    </p>
                                    <p className="text-sm font-[Olney_Light] text-[#000000] mb-2">
                                        {producers.get(batch.producer)?.name}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                            Lot #{batch.tokenId.toString()}
                                        </p>
                                        <p className="text-sm font-[Olney_Light] text-[#000000]">
                                            {batch.remainingTokens.toString()} tokens
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                <div className="flex justify-center mt-12 mb-6">
                    <Image
                        src="/logo-png-noir.png"
                        alt="Logo"
                        width={120}
                        height={120}
                        className="opacity-70"
                    />
                </div>
            </div>
        </div>
    );
}
