'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { publicClient } from '@/lib/client';

interface BatchDetails {
    tokenId: bigint;
    producer: string;
    honeyType: string;
    metadata: string;
    merkleRoot: string;
    remainingTokens: bigint;
}

interface ProducerInfo {
    name: string;
    location: string;
    companyRegisterNumber: string;
    metadata: string;
}

interface Comment {
    consumer: string;
    honeyBatchId: bigint;
    rating: number;
    metadata: string;
}

export default function BatchDetailsPage() {
    const params = useParams();
    const batchId = params.id as string;

    const [batch, setBatch] = useState<BatchDetails | null>(null);
    const [producer, setProducer] = useState<ProducerInfo | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBatchDetails = async () => {
            if (!publicClient || !batchId) {
                setIsLoading(false);
                return;
            }

            try {
                const tokenId = BigInt(batchId);

                const batchInfo = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getHoneyBatch',
                    args: [tokenId]
                }) as any;

                const producerAddress = await publicClient.readContract({
                    address: HONEY_TOKENIZATION_ADDRESS,
                    abi: HONEY_TOKENIZATION_ABI,
                    functionName: 'tokenProducer',
                    args: [tokenId]
                }) as `0x${string}`;

                const balance = await publicClient.readContract({
                    address: HONEY_TOKENIZATION_ADDRESS,
                    abi: HONEY_TOKENIZATION_ABI,
                    functionName: 'balanceOf',
                    args: [producerAddress, tokenId]
                }) as bigint;

                setBatch({
                    tokenId,
                    producer: producerAddress,
                    honeyType: batchInfo.honeyType,
                    metadata: batchInfo.metadata,
                    merkleRoot: batchInfo.merkleRoot,
                    remainingTokens: balance
                });

                const producerData = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getProducer',
                    args: [producerAddress]
                }) as any;

                setProducer({
                    name: producerData.name,
                    location: producerData.location,
                    companyRegisterNumber: producerData.companyRegisterNumber,
                    metadata: producerData.metadata
                });

                const commentsCount = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getHoneyBatchCommentsCount',
                    args: [tokenId]
                }) as bigint;

                if (commentsCount > 0n) {
                    const commentsData = await publicClient.readContract({
                        address: HONEY_TRACE_STORAGE_ADDRESS,
                        abi: HONEY_TRACE_STORAGE_ABI,
                        functionName: 'getHoneyBatchComments',
                        args: [tokenId, 0n, 10n]
                    }) as any[];

                    setComments(commentsData);
                }

            } catch (error) {
                console.error('Erreur lors du chargement des détails:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBatchDetails();
    }, [batchId]);

    const calculateAverageRating = () => {
        if (comments.length === 0) return 0;
        const sum = comments.reduce((acc, comment) => acc + comment.rating, 0);
        return (sum / comments.length).toFixed(1);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-[#000000] font-[Olney_Light] opacity-70">
                        Chargement des détails du lot...
                    </p>
                </div>
            </div>
        );
    }

    if (!batch || !producer) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-[#000000] font-[Olney_Light] opacity-70">
                        Lot introuvable
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-4xl">
                <Link
                    href="/explore"
                    className="inline-flex items-center text-[#000000] font-[Olney_Light] opacity-70 hover:opacity-100 mb-6"
                >
                    ← Retour à l'exploration
                </Link>

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-2">
                                {batch.honeyType}
                            </h1>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Lot #{batch.tokenId.toString()}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60 mb-1">
                                Tokens disponibles
                            </p>
                            <p className="text-4xl font-[Carbon_Phyber] text-[#000000]">
                                {batch.remainingTokens.toString()}
                            </p>
                        </div>
                    </div>

                    {comments.length > 0 && (
                        <div className="flex items-center gap-2 pt-3 border-t border-[#000000]/20">
                            <span className="text-2xl font-[Carbon_Phyber] text-[#000000]">
                                {calculateAverageRating()}
                            </span>
                            <span className="text-yellow-500">★★★★★</span>
                            <span className="text-sm font-[Olney_Light] text-[#000000]/60">
                                ({comments.length} avis)
                            </span>
                        </div>
                    )}
                </div>

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                        Informations du lot
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                Métadonnées
                            </p>
                            <div className="bg-yellow-bee/50 rounded p-3 font-mono text-sm text-[#000000]">
                                {batch.metadata}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                Merkle Root
                            </p>
                            <p className="text-sm font-mono text-[#000000] break-all">
                                {batch.merkleRoot}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                        Producteur
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                Nom
                            </p>
                            <p className="text-lg font-[Olney_Light] text-[#000000]">
                                {producer.name}
                            </p>
                        </div>
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
                        <div>
                            <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-1">
                                Adresse Ethereum
                            </p>
                            <p className="text-sm font-mono text-[#000000] break-all">
                                {batch.producer}
                            </p>
                        </div>
                    </div>

                    <Link
                        href={`/explore/producer/${batch.producer}`}
                        className="text-xs font-[Olney_Light] text-[#000000]/40 hover:text-[#000000]/60 text-right block mt-4"
                    >
                        Voir tous ses lots →
                    </Link>
                </div>

                {comments.length > 0 && (
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                        <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                            Avis des consommateurs
                        </h2>
                        <div className="space-y-4">
                            {comments.map((comment, index) => (
                                <div key={index} className="border-t border-[#000000]/20 pt-4 first:border-t-0 first:pt-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg font-[Carbon_Phyber] text-[#000000]">
                                            {comment.rating}/5
                                        </span>
                                        <span className="text-yellow-500">★★★★★</span>
                                    </div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000] mb-2">
                                        {comment.metadata}
                                    </p>
                                    <p className="text-xs font-mono text-[#000000]/40">
                                        {comment.consumer.substring(0, 6)}...{comment.consumer.substring(38)}
                                    </p>
                                </div>
                            ))}
                        </div>
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
