'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway, getIPFSUrl } from '@/app/utils/ipfs';
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
    const [batchIPFSData, setBatchIPFSData] = useState<BatchIPFSData | null>(null);
    const [producer, setProducer] = useState<ProducerInfo | null>(null);
    const [producerIPFSData, setProducerIPFSData] = useState<ProducerIPFSData | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingIPFS, setIsLoadingIPFS] = useState(false);
    const [labelImageError, setLabelImageError] = useState(false);

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

                const batchData = {
                    tokenId,
                    producer: producerAddress,
                    honeyType: batchInfo.honeyType,
                    metadata: batchInfo.metadata,
                    merkleRoot: batchInfo.merkleRoot,
                    remainingTokens: balance
                };

                setBatch(batchData);

                if (batchInfo.metadata && batchInfo.metadata.trim() !== '') {
                    setIsLoadingIPFS(true);
                    try {
                        const ipfsData = await getFromIPFSGateway(batchInfo.metadata);
                        setBatchIPFSData(ipfsData);
                    } catch (error) {
                        console.error('Erreur chargement IPFS du lot:', error);
                    } finally {
                        setIsLoadingIPFS(false);
                    }
                }

                const producerData = await publicClient.readContract({
                    address: HONEY_TRACE_STORAGE_ADDRESS,
                    abi: HONEY_TRACE_STORAGE_ABI,
                    functionName: 'getProducer',
                    args: [producerAddress]
                }) as any;

                const producerInfo = {
                    name: producerData.name,
                    location: producerData.location,
                    companyRegisterNumber: producerData.companyRegisterNumber,
                    metadata: producerData.metadata
                };

                setProducer(producerInfo);

                if (producerData.metadata && producerData.metadata.trim() !== '') {
                    try {
                        const producerIpfsData = await getFromIPFSGateway(producerData.metadata);
                        setProducerIPFSData(producerIpfsData);
                    } catch (error) {
                        console.error('Erreur chargement IPFS du producteur:', error);
                    }
                }

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

    const isImageFile = (url: string): boolean => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.endsWith('.png') ||
            lowerUrl.endsWith('.jpg') ||
            lowerUrl.endsWith('.jpeg') ||
            lowerUrl.endsWith('.gif') ||
            lowerUrl.endsWith('.webp') ||
            !lowerUrl.endsWith('.pdf');
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

                {isLoadingIPFS && (
                    <div className="text-center text-[#000000] font-[Olney_Light] mb-4 opacity-70">
                        Chargement des données IPFS...
                    </div>
                )}

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-2">
                                {batch.honeyType}
                            </h1>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Lot #{batch.tokenId.toString()}
                            </p>
                            {batchIPFSData?.identifiant && (
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Identifiant: {batchIPFSData.identifiant}
                                </p>
                            )}
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

                {/* Section Étiquette */}
                {batchIPFSData?.etiquetage && (
                    <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                        <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                            Étiquette
                        </h2>
                        <div className="flex justify-center">
                            {isImageFile(batchIPFSData.etiquetage) && !labelImageError ? (
                                <div className="relative">
                                    <img
                                        src={getIPFSUrl(batchIPFSData.etiquetage)}
                                        alt="Étiquette du lot"
                                        className="max-w-full max-h-96 rounded-lg shadow-lg"
                                        onError={() => setLabelImageError(true)}
                                    />
                                </div>
                            ) : (
                                <a
                                    href={getIPFSUrl(batchIPFSData.etiquetage)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-3 bg-[#000000]/10 rounded-lg hover:bg-[#000000]/20 transition-colors"
                                >
                                    <span className="text-2xl">📄</span>
                                    <span className="font-[Olney_Light] text-[#000000]">
                                        Voir l'étiquette (PDF)
                                    </span>
                                </a>
                            )}
                        </div>
                        <p className="text-xs font-mono text-[#000000]/50 mt-3 text-center break-all">
                            {batchIPFSData.etiquetage}
                        </p>
                    </div>
                )}

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <h2 className="text-2xl font-[Carbon_bl] text-[#000000] mb-4">
                        Informations du lot
                    </h2>
                    <div className="space-y-3">
                        {batchIPFSData?.periodeRecolte && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Période de récolte
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {batchIPFSData.periodeRecolte}
                                </p>
                            </div>
                        )}
                        {batchIPFSData?.dateMiseEnPot && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Date de mise en pot
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {new Date(batchIPFSData.dateMiseEnPot).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                        )}
                        {batchIPFSData?.lieuMiseEnPot && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Lieu de mise en pot
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {batchIPFSData.lieuMiseEnPot}
                                </p>
                            </div>
                        )}
                        {batchIPFSData?.composition && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Composition
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {batchIPFSData.composition}
                                </p>
                            </div>
                        )}
                        {batchIPFSData?.formatPot && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Format
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {batchIPFSData.formatPot}
                                </p>
                            </div>
                        )}
                        {batchIPFSData?.certifications && batchIPFSData.certifications.length > 0 && (
                            <div>
                                <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                    Certifications
                                </p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {batchIPFSData.certifications.map((cert, index) => (
                                        <span
                                            key={index}
                                            className="px-2 py-1 bg-[#000000]/10 rounded text-xs font-[Olney_Light] text-[#000000]"
                                        >
                                            {cert}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                CID Metadata (IPFS)
                            </p>
                            <p className="text-xs font-mono text-[#000000] break-all">
                                {batch.metadata}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Merkle Root
                            </p>
                            <p className="text-xs font-mono text-[#000000] break-all">
                                {batch.merkleRoot}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-bee rounded-lg p-6 opacity-70 border border-[#000000] mb-6">
                    <div className="flex items-start gap-6 mb-4">
                        <div className="flex-1">
                            <h2 className="text-2xl font-[Carbon_bl] text-[#000000]">
                                Producteur
                            </h2>
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

                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Nom
                            </p>
                            <p className="text-base font-[Olney_Light] text-[#000000]">
                                {producer.name}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Localisation
                            </p>
                            <p className="text-base font-[Olney_Light] text-[#000000]">
                                {producer.location}
                            </p>
                        </div>
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
                                    Contact
                                </p>
                                <p className="text-base font-[Olney_Light] text-[#000000]">
                                    {producerIPFSData.contact.email}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-[Olney_Light] text-[#000000]/60">
                                Adresse
                            </p>
                            <p className="text-xs font-mono text-[#000000] break-all">
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
                                <div key={index} className="border-b border-[#000000]/10 pb-3 last:border-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-yellow-500">
                                            {'★'.repeat(comment.rating)}
                                        </span>
                                        <span className="text-xs font-[Olney_Light] text-[#000000]/60">
                                            {comment.consumer.slice(0, 6)}...{comment.consumer.slice(-4)}
                                        </span>
                                    </div>
                                    <p className="text-sm font-[Olney_Light] text-[#000000]">
                                        {comment.metadata}
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
