'use client';

import { useState, useEffect } from 'react';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
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

                const batchesData: BatchInfo[] = [];
                const producersMap = new Map<string, ProducerInfo>();

                for (const log of logs) {
                    const tokenId = log.args.honeyBatchId as bigint;
                    const producerAddress = log.args.producer as `0x${string}`;

                    const batchInfo = await publicClient.readContract({
                        address: HONEY_TRACE_STORAGE_ADDRESS,
                        abi: HONEY_TRACE_STORAGE_ABI,
                        functionName: 'getHoneyBatch',
                        args: [tokenId]
                    }) as any;

                    const balance = await publicClient.readContract({
                        address: HONEY_TOKENIZATION_ADDRESS,
                        abi: HONEY_TOKENIZATION_ABI,
                        functionName: 'balanceOf',
                        args: [producerAddress, tokenId]
                    }) as bigint;

                    if (!producersMap.has(producerAddress)) {
                        const producerData = await publicClient.readContract({
                            address: HONEY_TRACE_STORAGE_ADDRESS,
                            abi: HONEY_TRACE_STORAGE_ABI,
                            functionName: 'getProducer',
                            args: [producerAddress]
                        }) as any;

                        producersMap.set(producerAddress, {
                            name: producerData.name || 'Producteur anonyme',
                            location: producerData.location || 'Non spécifié'
                        });
                    }

                    batchesData.push({
                        tokenId,
                        producer: producerAddress,
                        honeyType: batchInfo.honeyType,
                        metadata: batchInfo.metadata,
                        totalSupply: balance,
                        remainingTokens: balance
                    });
                }

                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setBatches(batchesData);
                setProducers(producersMap);

                // Charger les données IPFS pour chaque lot
                setIsLoadingIPFS(true);
                for (let i = 0; i < batchesData.length; i++) {
                    if (batchesData[i].metadata) {
                        try {
                            const batchIPFSData = await getFromIPFSGateway(batchesData[i].metadata);
                            setBatches(prev => prev.map(b =>
                                b.tokenId === batchesData[i].tokenId
                                    ? { ...b, ipfsData: batchIPFSData }
                                    : b
                            ));
                        } catch (error) {
                            console.error(`Erreur chargement IPFS lot ${batchesData[i].tokenId}:`, error);
                        }
                    }
                }
                setIsLoadingIPFS(false);

            } catch (error) {
                console.error('Erreur lors du chargement des lots:', error);
            } finally {
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
                            className={`px-4 py-2 rounded-lg font-[Olney_Light] transition-colors border border-[#000000] ${
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
                    <div className="text-center py-12">
                        <p className="text-[#000000] font-[Olney_Light] opacity-70">
                            Chargement des lots...
                        </p>
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
