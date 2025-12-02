'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';

export default function ProducerRegisterPage() {
    const { address } = useAccount();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [companyRegisterNumber, setCompanyRegisterNumber] = useState('');
    const [metadata, setMetadata] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    const { writeContract, isPending: isRegistering } = useWriteContract();

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
            setIsRegistered(producer.name && producer.name.length > 0);

            if (producer.name) setName(producer.name);
            if (producer.location) setLocation(producer.location);
            if (producer.companyRegisterNumber) setCompanyRegisterNumber(producer.companyRegisterNumber);
            if (producer.metadata) setMetadata(producer.metadata);
        }
    }, [producerData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'addProducer',
                args: [name, location, companyRegisterNumber, metadata],
            });
        } catch (error) {
            console.error('Erreur lors de l\'enregistrement:', error);
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
        <div className="min-h-screen bg-yellow-bee">
            <Navbar />
            <div className="container mx-auto p-6 max-w-xl">
                <h1 className="text-4xl font-[Carbon_Phyber] mb-6 text-center text-[#000000]">
                    {isRegistered ? 'Modifier mes informations' : 'Enregistrement Producteur'}
                </h1>

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
                                placeholder="Rucher du Soleil"
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
                                placeholder="Provence, France"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Numéro SIRET *
                            </label>
                            <input
                                type="text"
                                value={companyRegisterNumber}
                                onChange={(e) => setCompanyRegisterNumber(e.target.value)}
                                placeholder="123 456 789 00012"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={64}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Informations complémentaires (JSON)
                            </label>
                            <textarea
                                value={metadata}
                                onChange={(e) => setMetadata(e.target.value)}
                                placeholder='{"certifications": ["Bio", "AOP"], "website": "https://..."}'
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50 min-h-[100px]"
                                maxLength={1024}
                            />
                            <p className="text-xs font-[Olney_Light] mt-1 text-[#000000]/60">
                                Format JSON optionnel pour certifications, site web, etc.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isRegistering}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-2 px-4 rounded-lg disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isRegistering
                                ? 'Enregistrement en cours...'
                                : isRegistered
                                    ? 'Mettre à jour'
                                    : 'Enregistrer mes informations'}
                        </button>
                    </form>
                </div>

                {/* Logo */}
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
