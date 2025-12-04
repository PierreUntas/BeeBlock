'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/lib/client';



interface BatchInfo {
    tokenId: bigint;
    honeyType: string;
    metadata: string;
    merkleRoot: string;
    remainingTokens: bigint;
}

export default function ProducerBatchesPage() {
    const { address } = useAccount();
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
                // Récupérer les événements NewHoneyBatch du producteur
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

                // Pour chaque événement, récupérer les détails du lot
                for (const log of logs) {
                    const tokenId = log.args.honeyBatchId as bigint;

                    // Récupérer les infos du batch
                    const batchInfo = await publicClient.readContract({
                        address: HONEY_TRACE_STORAGE_ADDRESS,
                        abi: HONEY_TRACE_STORAGE_ABI,
                        functionName: 'getHoneyBatch',
                        args: [tokenId]
                    }) as any;

                    // Récupérer le solde restant
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

                // Trier par tokenId décroissant (plus récents en premier)
                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));

                setBatches(batchesData);
            } catch (error) {
                console.error('Erreur lors du chargement des lots:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBatches();
    }, [address, isAuthorized, publicClient]);

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
                    <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000]">Mes Lots de Miel</h1>
                    <Link
                        href="/producer/batches/create"
                        className="bg-[#666666] text-white font-[Olney_Light] py-2 px-6 rounded-lg hover:bg-[#555555] transition-colors border border-[#000000]"
                    >
                        Créer un nouveau lot
                    </Link>
                </div>

                {isLoading ? (
                    <div className="text-center py-12">
                        <p className="text-[#000000] font-[Olney_Light] opacity-70">Chargement des lots...</p>
                    </div>
                ) : batches.length === 0 ? (
                    <div className="bg-yellow-bee rounded-lg p-8 opacity-70 text-center">
                        <p className="text-[#000000] font-[Olney_Light] mb-4">Vous n'avez pas encore créé de lots</p>
                        <Link
                            href="/producer/batches/create"
                            className="inline-block bg-[#666666] text-white font-[Olney_Light] py-2 px-6 rounded-lg hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            Créer mon premier lot
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {batches.map((batch) => (
                            <div key={batch.tokenId.toString()} className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000]">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-2">
                                            Lot #{batch.tokenId.toString()} - {batch.honeyType}
                                        </h2>
                                        <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                            Merkle Root: {batch.merkleRoot.substring(0, 10)}...{batch.merkleRoot.substring(batch.merkleRoot.length - 8)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-[Olney_Light] text-[#000000]">
                                            Tokens restants
                                        </p>
                                        <p className="text-3xl font-[Carbon_Phyber] text-[#000000]">
                                            {batch.remainingTokens.toString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm font-[Olney_Light] text-[#000000] mb-1">Métadonnées :</p>
                                    <div className="bg-yellow-bee/50 rounded p-3 font-mono text-xs text-[#000000] overflow-x-auto">
                                        {batch.metadata}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Link
                                        href={`/explore/batch/${batch.tokenId}`}
                                        className="flex-1 bg-[#666666] text-white font-[Olney_Light] py-2 px-4 rounded-lg hover:bg-[#555555] transition-colors border border-[#000000] text-center text-sm"
                                    >
                                        Voir les détails
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
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
