'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import { useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';

export default function AdminPage() {
    const { address } = useAccount();
    const [newProducerAddress, setNewProducerAddress] = useState('');
    const [removeProducerAddress, setRemoveProducerAddress] = useState('');
    const [checkProducerAddress, setCheckProducerAddress] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAuthorizingProducer, setIsAuthorizingProducer] = useState(false);
    const [isRevokingProducer, setIsRevokingProducer] = useState(false);

    const { sendTransaction } = useSendTransaction();

    const { data: isAdminResult } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'isAdmin',
        args: address ? [address] : undefined,
    });

    const { data: producerData } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'getProducer',
        args: checkProducerAddress ? [checkProducerAddress as `0x${string}`] : undefined,
    });

    useEffect(() => {
        if (isAdminResult !== undefined) {
            setIsAdmin(isAdminResult as boolean);
        }
    }, [isAdminResult]);

    const isProducerAuthorized = producerData ? (producerData as any).authorized : undefined;

    const handleAuthorizeProducer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProducerAddress) return;

        setIsAuthorizingProducer(true);
        try {
            const data = encodeFunctionData({
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'authorizeProducer',
                args: [newProducerAddress as `0x${string}`, true],
            });

            const txHash = await sendTransaction(
                {
                    to: HONEY_TRACE_STORAGE_ADDRESS,
                    data: data,
                },
                {
                    sponsor: true,
                }
            );
            
            console.log('Transaction hash:', txHash);
            setNewProducerAddress('');
        } catch (error) {
            console.error('Erreur lors de l\'autorisation du producteur:', error);
        } finally {
            setIsAuthorizingProducer(false);
        }
    };

    const handleRevokeProducer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!removeProducerAddress) return;

        setIsRevokingProducer(true);
        try {
            const data = encodeFunctionData({
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'authorizeProducer',
                args: [removeProducerAddress as `0x${string}`, false],
            });

            const txHash = await sendTransaction(
                {
                    to: HONEY_TRACE_STORAGE_ADDRESS,
                    data: data,
                },
                {
                    sponsor: true,
                }
            );
            
            console.log('Transaction hash:', txHash);
            setRemoveProducerAddress('');
        } catch (error) {
            console.error('Erreur lors de la révocation du producteur:', error);
        } finally {
            setIsRevokingProducer(false);
        }
    };

    if (!address) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">Veuillez connecter votre wallet</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">Accès refusé : vous n'êtes pas admin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-xl">
                <h1 className="text-4xl font-[Carbon_Phyber] mb-6 text-center text-[#000000]">Gestion des Producteurs</h1>

                {/* Autoriser un producteur */}
                <div className="bg-yellow-bee rounded-lg p-4 mb-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Autoriser un Producteur</h2>
                    <form onSubmit={handleAuthorizeProducer} className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse du producteur</label>
                            <input
                                type="text"
                                value={newProducerAddress}
                                onChange={(e) => setNewProducerAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAuthorizingProducer}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-1.5 px-4 rounded-lg text-sm disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isAuthorizingProducer ? 'Autorisation en cours...' : 'Autoriser Producteur'}
                        </button>
                    </form>
                </div>

                {/* Révoquer un producteur */}
                <div className="bg-yellow-bee rounded-lg p-4 mb-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Révoquer un Producteur</h2>
                    <form onSubmit={handleRevokeProducer} className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse du producteur</label>
                            <input
                                type="text"
                                value={removeProducerAddress}
                                onChange={(e) => setRemoveProducerAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isRevokingProducer}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-1.5 px-4 rounded-lg text-sm disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isRevokingProducer ? 'Révocation en cours...' : 'Révoquer Producteur'}
                        </button>
                    </form>
                </div>

                {/* Vérifier le statut de producteur */}
                <div className="bg-yellow-bee rounded-lg p-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Vérifier le Statut Producteur</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse à vérifier</label>
                            <input
                                type="text"
                                value={checkProducerAddress}
                                onChange={(e) => setCheckProducerAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        {checkProducerAddress && isProducerAuthorized !== undefined && (
                            <div className="p-3 rounded-lg font-[Olney_Light] text-sm border border-[#000000] text-[#000000]">
                                {isProducerAuthorized ? '✓ Cette adresse est autorisée comme producteur' : '✗ Cette adresse n\'est pas autorisée comme producteur'}
                            </div>
                        )}
                    </div>
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
