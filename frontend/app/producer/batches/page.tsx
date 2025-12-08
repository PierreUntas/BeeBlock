'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/lib/client';

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
    honeyType: string;
    metadata: string;
    merkleRoot: string;
    remainingTokens: bigint;
    ipfsData?: BatchIPFSData;
}

export default function ProducerBatchesPage() {
    const { address } = useAccount();
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingIPFS, setIsLoadingIPFS] = useState(false);

    const { data: producerData } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'getProducer',
        args: address ? [address] : undefined,
    });

    useEffect(() => {
        if (producerData) {
            const producer = producerData as any;
            setIsAuthorized(producer.authorized);
        }
    }, [producerData]);

    useEffect(() => {
        const fetchBatches = async () => {
            if (!address || !isAuthorized || !publicClient) {
                setIsLoading(false);
                return;
            }

            try {
                const logs = await publicClient.getLogs({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    event: parseAbiItem('event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId)'),
                    args: {
                        producer: address
                    },
                    fromBlock: 9753823n,
                    toBlock: 'latest'
                });

                const batchesData: BatchInfo[] = [];

                for (const log of logs) {
                    const tokenId = log.args.honeyBatchId as bigint;

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
                        args: [address, tokenId]
                    }) as bigint;

                    batchesData.push({
                        tokenId,
                        honeyType: batchInfo.honeyType,
                        metadata: batchInfo.metadata,
                        merkleRoot: batchInfo.merkleRoot,
                        remainingTokens: balance
                    });
                }

                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setBatches(batchesData);

                // Charger les données IPFS pour chaque lot
                setIsLoadingIPFS(true);
                for (let i = 0; i < batchesData.length; i++) {
                    if (batchesData[i].metadata) {
                        try {
                            const ipfsData = await getFromIPFSGateway(batchesData[i].metadata);
                            setBatches(prev => prev.map(batch =>
                                batch.tokenId === batchesData[i].tokenId
                                    ? { ...batch, ipfsData }
                                    : batch
                            ));
                        } catch (error) {
                            console.error(`Erreur chargement IPFS pour lot ${batchesData[i].tokenId}:`, error);
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

        fetchBatches();
    }, [address, isAuthorized]);

    if (!address) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">
                        Veuillez connecter votre wallet
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">
                        Accès refusé : vous n'êtes pas autorisé comme producteur
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000]">
                        Mes lots de miel
                    </h1>
                    <Link
                        href="/producer/batches/create"
                        className="bg-[#666666] text-white px-6 py-2 rounded-lg font-[Olney_Light] hover:bg-[#555555] transition-colors border border-[#000000]"
                    >
                        + Créer un lot
                    </Link>
                </div>

                {isLoading ? (
                    <div className="text-center text-[#000000] font-[Olney_Light] opacity-70 py-12">
                        Chargement de vos lots...
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center text-[#000000] font-[Olney_Light] opacity-70 py-12">
                        Vous n'avez pas encore créé de lot.
                    </div>
                ) : (
                    <>
                        {isLoadingIPFS && (
                            <div className="text-center text-[#000000] font-[Olney_Light] mb-4 opacity-70">
                                Chargement des données IPFS...
                            </div>
                        )}
                        <div className="grid gap-4">
                            {batches.map((batch) => (
                                <Link
                                    key={batch.tokenId.toString()}
                                    href={`/explore/batch/${batch.tokenId}`}
                                    className="bg-yellow-bee rounded-lg p-4 opacity-70 border border-[#000000] hover:opacity-100 transition-opacity"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h2 className="text-2xl font-[Carbon_Phyber] text-[#000000] mb-2">
                                                {batch.honeyType}
                                            </h2>
                                            <div className="space-y-1">
                                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                                    Lot #{batch.tokenId.toString()}
                                                </p>
                                                {batch.ipfsData?.identifiant && (
                                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                                        Identifiant: {batch.ipfsData.identifiant}
                                                    </p>
                                                )}
                                                {batch.ipfsData?.periodeRecolte && (
                                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                                        Récolte: {batch.ipfsData.periodeRecolte}
                                                    </p>
                                                )}
                                                {batch.ipfsData?.formatPot && (
                                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                                        Format: {batch.ipfsData.formatPot}
                                                    </p>
                                                )}
                                                {batch.ipfsData?.certifications && batch.ipfsData.certifications.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {batch.ipfsData.certifications.map((cert, index) => (
                                                            <span
                                                                key={index}
                                                                className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded"
                                                            >
                                                                {cert}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-[Olney_Light] text-[#000000]/60 mb-1">
                                                Tokens restants
                                            </p>
                                            <p className="text-3xl font-[Carbon_Phyber] text-[#000000]">
                                                {batch.remainingTokens.toString()}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}

                <div className="flex justify-center mt-8 mb-6">
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
