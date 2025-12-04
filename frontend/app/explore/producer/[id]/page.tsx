'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/lib/client';

interface ProducerDetails {
    address: string;
    name: string;
    location: string;
    companyRegisterNumber: string;
    metadata: string;
    authorized: boolean;
}

interface BatchInfo {
    tokenId: bigint;
    honeyType: string;
    metadata: string;
    remainingTokens: bigint;
}

export default function ProducerDetailsPage() {
    const params = useParams();
    const producerAddress = params.id as string;

    const [producer, setProducer] = useState<ProducerDetails | null>(null);
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalBatches, setTotalBatches] = useState(0);
    const [totalTokensDistributed, setTotalTokensDistributed] = useState(0);

    useEffect(() => {
        const fetchProducerDetails = async () => {
            if (!publicClient || !producerAddress) {
                setIsLoading(false);
                return;
            }

            try {
                const address = producerAddress as `0x${string}`;

                // Récupérer les infos du producteur
                const producerData = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getProducer',
                    args: [address]
                }) as any;

                setProducer({
                    address: producerAddress,
                    name: producerData.name,
                    location: producerData.location,
                    companyRegisterNumber: producerData.companyRegisterNumber,
                    metadata: producerData.metadata,
                    authorized: producerData.authorized
                });

                // Récupérer tous les lots du producteur
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
                let totalDistributed = 0;

                // Pour chaque événement, récupérer les détails
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
                        remainingTokens: balance
                    });

                    // Calculer le total distribué (on suppose que le batch initial = balance actuel)
                    totalDistributed += Number(balance);
                }

                // Trier par tokenId décroissant
                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));

                setBatches(batchesData);
                setTotalBatches(batchesData.length);
                setTotalTokensDistributed(totalDistributed);

            } catch (error) {
                console.error('Erreur lors du chargement des détails du producteur:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducerDetails();
    }, [producerAddress]);

    const uniqueHoneyTypes = Array.from(new Set(batches.map(b => b.honeyType)));

    if (isLoading) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-[#000000] font-[Olney_Light] opacity-70">
                        Chargement des détails du producteur...
                    </p>
                </div>
            </div>
        );
    }

    if (!producer || !producer.authorized) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-[#000000] font-[Olney_Light] opacity-70">
                        Producteur introuvable ou non autorisé
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-6xl">
                <Link
                    href="/explore"
                    className="inline-flex items-center text-[#000000] font-[Olney_Light] opacity-70 hover:opacity-100 mb-6"
                >
                    ← Retour à l'exploration
                </Link>

                {/* En-tête du producteur */}
                <div className="bg-yellow-bee rounded-lg p-8 opacity-70 border border-[#000000] mb-6">
                    <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-4">
                        {producer.name}
                    </h1>

                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                Localisation
                            </p>
                            <p className="text-lg font-[Olney_Light] text-[#000000]">
                                {producer.location}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                N° SIRET
                            </p>
                            <p className="text-lg font-[Olney_Light] text-[#000000]">
                                {producer.companyRegisterNumber}
                            </p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                            Adresse Ethereum
                        </p>
                        <p className="text-sm font-mono text-[#000000] break-all">
                            {producer.address}
                        </p>
                    </div>

                    {producer.metadata && (
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                À propos
                            </p>
                            <p className="text-base font-[Olney_Light] text-[#000000]">
                                {producer.metadata}
                            </p>
                        </div>
                    )}
                </div>

                {/* Statistiques */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] text-center">
                        <p className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-2">
                            {totalBatches}
                        </p>
                        <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                            Lots créés
                        </p>
                    </div>
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] text-center">
                        <p className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-2">
                            {uniqueHoneyTypes.length}
                        </p>
                        <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                            Types de miel
                        </p>
                    </div>
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] text-center">
                        <p className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-2">
                            {totalTokensDistributed}
                        </p>
                        <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                            Tokens disponibles
                        </p>
                    </div>
                </div>

                {/* Types de miel */}
                {uniqueHoneyTypes.length > 0 && (
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                        <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                            Types de miel produits
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {uniqueHoneyTypes.map(type => (
                                <span
                                    key={type}
                                    className="px-4 py-2 bg-[#666666] text-white font-[Olney_Light] rounded-lg border border-[#000000]"
                                >
                                    {type}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Liste des lots */}
                <div className="mb-6">
                    <h2 className="text-3xl font-[Carbon_Phyber] text-[#000000] mb-4">
                        Lots disponibles
                    </h2>
                    {batches.length === 0 ? (
                        <div className="bg-yellow-bee rounded-lg p-8 opacity-70 text-center border border-[#000000]">
                            <p className="text-[#000000] font-[Olney_Light]">
                                Aucun lot disponible
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {batches.map((batch) => (
                                <Link
                                    key={batch.tokenId.toString()}
                                    href={`/explore/batch/${batch.tokenId}`}
                                    className="block"
                                >
                                    <div className="bg-yellow-bee rounded-lg p-5 opacity-70 hover:opacity-100 transition-opacity border border-[#000000] h-full">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-xl font-[Carbon_bl] text-[#000000] mb-1">
                                                    {batch.honeyType}
                                                </h3>
                                                <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                                    Lot #{batch.tokenId.toString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-[Carbon_Phyber] text-[#000000]">
                                                    {batch.remainingTokens.toString()}
                                                </p>
                                                <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                                    disponibles
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-xs font-[Olney_Light] text-[#000000]/40 text-right">
                                            Voir les détails →
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

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
