'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import { uploadToIPFS, getFromIPFSGateway } from '@/app/utils/ipfs';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';

export default function ProducerPage() {
    const { address } = useAccount();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [companyRegisterNumber, setCompanyRegisterNumber] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingIPFS, setIsLoadingIPFS] = useState(false);

    const [additionalData, setAdditionalData] = useState({
        labelsCertifications: [] as string[],
        anneeCreation: new Date().getFullYear(),
        description: '',
        photos: [] as string[],
        logo: '',
        contact: {
            email: '',
            telephone: '',
            adresseCourrier: ''
        },
        siteWeb: ''
    });

    const { writeContract, isPending: isRegistering } = useWriteContract();

    const { data: producerData } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'getProducer',
        args: address ? [address] : undefined,
    });

    const loadIPFSData = async (cid: string) => {
        setIsLoadingIPFS(true);
        try {
            const ipfsData = await getFromIPFSGateway(cid);

            if (ipfsData) {
                setAdditionalData({
                    labelsCertifications: ipfsData.labelsCertifications || [],
                    anneeCreation: ipfsData.anneeCreation || new Date().getFullYear(),
                    description: ipfsData.description || '',
                    photos: ipfsData.photos || [],
                    logo: ipfsData.logo || '',
                    contact: {
                        email: ipfsData.contact?.email || '',
                        telephone: ipfsData.contact?.telephone || '',
                        adresseCourrier: ipfsData.contact?.adresseCourrier || ''
                    },
                    siteWeb: ipfsData.siteWeb || ''
                });
            }
        } catch (error) {
            console.error('Erreur chargement données IPFS:', error);
        } finally {
            setIsLoadingIPFS(false);
        }
    };

    useEffect(() => {
        if (producerData) {
            const producer = producerData as any;
            setIsAuthorized(producer.authorized);
            setIsRegistered(producer.name && producer.name.length > 0);

            if (producer.name) setName(producer.name);
            if (producer.location) setLocation(producer.location);
            if (producer.companyRegisterNumber) setCompanyRegisterNumber(producer.companyRegisterNumber);

            // Récupérer les données IPFS
            if (producer.metadata) {
                loadIPFSData(producer.metadata);
            }
        }
    }, [producerData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);

        try {
            // Construire l'objet JSON complet
            const producerData = {
                address: address,
                nom: name,
                localisation: location,
                numeroImmatriculation: companyRegisterNumber,
                labelsCertifications: additionalData.labelsCertifications,
                anneeCreation: additionalData.anneeCreation,
                description: additionalData.description,
                photos: additionalData.photos,
                logo: additionalData.logo,
                contact: additionalData.contact,
                siteWeb: additionalData.siteWeb
            };

            // Upload sur IPFS
            const cid = await uploadToIPFS(producerData);
            console.log('CID IPFS:', cid);

            // Enregistrer avec le CID comme metadata
            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'addProducer',
                args: [name, location, companyRegisterNumber, cid],
            });
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
        } finally {
            setIsUploading(false);
        }
    };

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
            <div className="container mx-auto p-6 max-w-xl">
                <h1 className="text-4xl font-[Carbon_Phyber] mb-6 text-center text-[#000000]">
                    {isRegistered ? 'Modifier mes informations' : 'Enregistrement Producteur'}
                </h1>

                {isLoadingIPFS && (
                    <div className="text-center text-[#000000] font-[Olney_Light] mb-4 opacity-70">
                        Chargement des données IPFS...
                    </div>
                )}

                <div className="bg-yellow-bee rounded-lg p-4 opacity-70">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Nom de l'entreprise *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Les Ruchers de Bordeaux"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Localisation *
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="33 Bordeaux, Nouvelle-Aquitaine, France"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Numéro d'immatriculation *
                            </label>
                            <input
                                type="text"
                                value={companyRegisterNumber}
                                onChange={(e) => setCompanyRegisterNumber(e.target.value)}
                                placeholder="FR-AB123456"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={64}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Description
                            </label>
                            <textarea
                                value={additionalData.description}
                                onChange={(e) => setAdditionalData({...additionalData, description: e.target.value})}
                                placeholder="Producteur de miel bio renommé dans la région..."
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50 min-h-[100px]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Année de création
                            </label>
                            <input
                                type="number"
                                value={additionalData.anneeCreation}
                                onChange={(e) => setAdditionalData({...additionalData, anneeCreation: parseInt(e.target.value)})}
                                placeholder="2010"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Site web
                            </label>
                            <input
                                type="url"
                                value={additionalData.siteWeb}
                                onChange={(e) => setAdditionalData({...additionalData, siteWeb: e.target.value})}
                                placeholder="https://ruchers-bordeaux.fr"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Email
                            </label>
                            <input
                                type="email"
                                value={additionalData.contact.email}
                                onChange={(e) => setAdditionalData({
                                    ...additionalData,
                                    contact: {...additionalData.contact, email: e.target.value}
                                })}
                                placeholder="contact@ruchers-bordeaux.fr"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Téléphone
                            </label>
                            <input
                                type="tel"
                                value={additionalData.contact.telephone}
                                onChange={(e) => setAdditionalData({
                                    ...additionalData,
                                    contact: {...additionalData.contact, telephone: e.target.value}
                                })}
                                placeholder="+33 5 56 00 00 00"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Adresse courrier
                            </label>
                            <input
                                type="text"
                                value={additionalData.contact.adresseCourrier}
                                onChange={(e) => setAdditionalData({
                                    ...additionalData,
                                    contact: {...additionalData.contact, adresseCourrier: e.target.value}
                                })}
                                placeholder="12 rue des abeilles, 33000 Bordeaux"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isRegistering || isUploading || isLoadingIPFS}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-2 px-4 rounded-lg disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isUploading
                                ? 'Upload IPFS en cours...'
                                : isRegistering
                                    ? 'Enregistrement en cours...'
                                    : isRegistered
                                        ? 'Mettre à jour'
                                        : 'Enregistrer mes informations'}
                        </button>
                    </form>
                </div>

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
