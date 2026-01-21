'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway, getIPFSUrl } from '@/app/utils/ipfs';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { parseAbiItem } from 'viem';
import { publicClient } from '@/lib/client';

interface ProducerInfo {
    name: string;
    location: string;
    companyRegisterNumber: string;
    metadata: string;
}

interface ProducerIPFSData {
    labelsCertifications: string[];
    anneeCreation: number;
    description: string;
    photos: string[];
    logo: string;
    contact: {
        email: string;
        telephone: string;
        adresseCourrier: string;
    };
    siteWeb: string;
}

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
    remainingTokens: bigint;
    ipfsData?: BatchIPFSData;
    averageRating?: number;
    commentsCount?: number;
}

export default function ProducerDetailsPage() {
    const params = useParams();
    const producerAddress = params.address as string;

    const [producer, setProducer] = useState<ProducerInfo | null>(null);
    const [producerIPFSData, setProducerIPFSData] = useState<ProducerIPFSData | null>(null);
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingIPFS, setIsLoadingIPFS] = useState(false);

    useEffect(() => {
        const fetchProducerDetails = async () => {
            if (!publicClient || !producerAddress) {
                setIsLoading(false);
                return;
            }

            try {
                const producerData = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getProducer',
                    args: [producerAddress as `0x${string}`]
                }) as any;

                const producerInfo = {
                    name: producerData.name,
                    location: producerData.location,
                    companyRegisterNumber: producerData.companyRegisterNumber,
                    metadata: producerData.metadata
                };

                setProducer(producerInfo);

                if (producerData.metadata && producerData.metadata.trim() !== '') {
                    setIsLoadingIPFS(true);
                    try {
                        const ipfsData = await getFromIPFSGateway(producerData.metadata);
                        setProducerIPFSData(ipfsData);
                    } catch (error) {
                        console.error('Erreur chargement IPFS producteur:', error);
                    } finally {
                        setIsLoadingIPFS(false);
                    }
                }

                const logs = await publicClient.getLogs({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    event: parseAbiItem('event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId)'),
                    args: {
                        producer: producerAddress as `0x${string}`
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
                        args: [producerAddress as `0x${string}`, tokenId]
                    }) as bigint;

                    batchesData.push({
                        tokenId,
                        honeyType: batchInfo.honeyType,
                        metadata: batchInfo.metadata,
                        remainingTokens: balance
                    });
                }

                batchesData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setBatches(batchesData);

                // Charger les données IPFS et les notes en parallèle
                for (let i = 0; i < batchesData.length; i++) {
                    const tokenId = batchesData[i].tokenId;
                    
                    // Récupérer les commentaires pour calculer la note moyenne
                    const commentsCount = await publicClient.readContract({
                        address: HONEY_TRACE_STORAGE_ADDRESS,
                        abi: HONEY_TRACE_STORAGE_ABI,
                        functionName: 'getHoneyBatchCommentsCount',
                        args: [tokenId]
                    }) as bigint;

                    let averageRating = 0;
                    if (commentsCount > 0n) {
                        const comments = await publicClient.readContract({
                            address: HONEY_TRACE_STORAGE_ADDRESS,
                            abi: HONEY_TRACE_STORAGE_ABI,
                            functionName: 'getHoneyBatchComments',
                            args: [tokenId, 0n, commentsCount]
                        }) as any[];

                        const sum = comments.reduce((acc: number, comment: any) => acc + Number(comment.rating), 0);
                        averageRating = sum / comments.length;
                    }

                    if (batchesData[i].metadata && batchesData[i].metadata.trim() !== '') {
                        try {
                            const batchIPFSData = await getFromIPFSGateway(batchesData[i].metadata);
                            setBatches(prev => prev.map(b =>
                                b.tokenId === tokenId
                                    ? { ...b, ipfsData: batchIPFSData, averageRating, commentsCount: Number(commentsCount) }
                                    : b
                            ));
                        } catch (error) {
                            console.error(`Erreur chargement IPFS lot ${tokenId}:`, error);
                            setBatches(prev => prev.map(b =>
                                b.tokenId === tokenId
                                    ? { ...b, averageRating, commentsCount: Number(commentsCount) }
                                    : b
                            ));
                        }
                    } else {
                        setBatches(prev => prev.map(b =>
                            b.tokenId === tokenId
                                ? { ...b, averageRating, commentsCount: Number(commentsCount) }
                                : b
                        ));
                    }
                }

            } catch (error) {
                console.error('Erreur lors du chargement des détails:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducerDetails();
    }, [producerAddress]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black/70 mb-4"></div>
                        <p className="text-[#000000] font-[Olney_Light] text-xl opacity-70">Chargement des détails du producteur...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!producer) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-[#000000] font-[Olney_Light] opacity-70">
                        Producteur introuvable
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

                {isLoadingIPFS && (
                    <div className="text-center text-[#000000] font-[Olney_Light] mb-4 opacity-70">
                        Chargement des données IPFS...
                    </div>
                )}

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <div className="flex items-start gap-6 mb-4">
                        <div className="flex-1">
                            <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000]">
                                {producer.name}
                            </h1>
                        </div>
                        {producerIPFSData?.logo && (
                            <div className="flex-shrink-0">
                                <img
                                    src={producerIPFSData.logo.startsWith('ipfs://')
                                        ? `https://ipfs.io/ipfs/${producerIPFSData.logo.replace('ipfs://', '')}`
                                        : producerIPFSData.logo}
                                    alt={`Logo ${producer.name}`}
                                    className="w-24 h-24 object-contain rounded-lg border border-[#000000]"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Localisation
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {producer.location}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    N° d'immatriculation
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {producer.companyRegisterNumber}
                                </p>
                            </div>
                            {producerIPFSData?.anneeCreation && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                        Année de création
                                    </p>
                                    <p className="text-base font-[Olney_Light] text-[#000000]">
                                        {producerIPFSData.anneeCreation}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Adresse Ethereum
                                </p>
                                <p className="text-xs font-mono text-[#000000] break-all">
                                    {producerAddress}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {producerIPFSData?.description && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                        Description
                                    </p>
                                    <p className="text-base font-[Olney_Light] text-[#000000]">
                                        {producerIPFSData.description}
                                    </p>
                                </div>
                            )}
                            {producerIPFSData?.contact?.email && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                        Email
                                    </p>
                                    <p className="text-base font-[Olney_Light] text-[#000000]">
                                        {producerIPFSData.contact.email}
                                    </p>
                                </div>
                            )}
                            {producerIPFSData?.contact?.telephone && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                        Téléphone
                                    </p>
                                    <p className="text-base font-[Olney_Light] text-[#000000]">
                                        {producerIPFSData.contact.telephone}
                                    </p>
                                </div>
                            )}
                            {producerIPFSData?.siteWeb && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                        Site web
                                    </p>
                                    <a
                                        href={producerIPFSData.siteWeb}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-base font-[Olney_Light] text-blue-600 hover:underline"
                                    >
                                        {producerIPFSData.siteWeb}
                                    </a>
                                </div>
                            )}
                            {producerIPFSData?.labelsCertifications && producerIPFSData.labelsCertifications.length > 0 && (
                                <div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]/60 mb-2">
                                        Labels et certifications
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {producerIPFSData.labelsCertifications.map((label, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1 bg-green-100 text-green-800 text-xs font-[Olney_Light] rounded-full border border-green-300"
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {producerIPFSData?.photos && producerIPFSData.photos.length > 0 && (
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                        <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                            Photos
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {producerIPFSData.photos.map((photo, index) => (
                                <div key={index} className="relative">
                                    <img
                                        src={photo.startsWith('ipfs://')
                                            ? `https://ipfs.io/ipfs/${photo.replace('ipfs://', '')}`
                                            : photo}
                                        alt={`Photo ${index + 1} de ${producer.name}`}
                                        className="w-full h-64 object-cover rounded-lg border border-[#000000]"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <h2 className="text-3xl font-[Carbon_Phyber] text-[#000000] mb-4">
                    Lots de miel ({batches.length})
                </h2>

                {batches.length === 0 ? (
                    <div className="text-center text-[#000000] font-[Olney_Light] opacity-70 py-12">
                        Ce producteur n'a pas encore créé de lot.
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {batches.map((batch) => (
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
                                
                                <h3 className="text-xl font-[Carbon_bl] text-[#000000] mb-2">
                                    {batch.honeyType}
                                </h3>
                                {batch.ipfsData?.identifiant && (
                                    <p className="text-xs font-[Olney_Light] text-[#000000]/60 mb-2">
                                        {batch.ipfsData.identifiant}
                                    </p>
                                )}
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
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {batch.ipfsData.certifications.map((cert, index) => (
                                            <span
                                                key={index}
                                                className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-[Olney_Light] rounded-full border border-green-300"
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
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#000000]/20">
                                    <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                        Lot #{batch.tokenId.toString()}
                                    </p>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]">
                                        {batch.remainingTokens.toString()} tokens
                                    </p>
                                </div>
                            </Link>
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
