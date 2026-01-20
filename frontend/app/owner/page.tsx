'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';

export default function AdminPage() {
    const { address } = useAccount();
    const [newAdminAddress, setNewAdminAddress] = useState('');
    const [removeAdminAddress, setRemoveAdminAddress] = useState('');
    const [checkAdminAddress, setCheckAdminAddress] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [isCheckingOwner, setIsCheckingOwner] = useState(true);

    const { writeContract, isPending: isAddingAdmin } = useWriteContract();
    const { writeContract: writeRemoveAdmin, isPending: isRemovingAdmin } = useWriteContract();

    const { data: ownerAddress, isLoading: isLoadingOwner } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'owner',
    });

    const { data: isAdminResult, refetch: refetchIsAdmin } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'isAdmin',
        args: checkAdminAddress ? [checkAdminAddress as `0x${string}`] : undefined,
    });

    useEffect(() => {
        if (address && ownerAddress) {
            setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
            setIsCheckingOwner(false);
        } else if (!isLoadingOwner && ownerAddress) {
            setIsCheckingOwner(false);
        }
    }, [address, ownerAddress, isLoadingOwner]);

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminAddress) return;

        try {
            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'addAdmin',
                args: [newAdminAddress as `0x${string}`],
            });
            setNewAdminAddress('');
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'admin:', error);
        }
    };

    const handleRemoveAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!removeAdminAddress) return;

        try {
            await writeRemoveAdmin({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'removeAdmin',
                args: [removeAdminAddress as `0x${string}`],
            });
            setRemoveAdminAddress('');
        } catch (error) {
            console.error('Erreur lors de la suppression de l\'admin:', error);
        }
    };

    // État de chargement pendant la vérification
    if (isCheckingOwner || isLoadingOwner) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black/70 mb-4"></div>
                        <p className="text-[#000000] font-[Olney_Light] text-xl opacity-70">Vérification des permissions...</p>
                    </div>
                </div>
            </div>
        );
    }

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

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-yellow-bee">
                <Navbar />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">Accès refusé : vous n'êtes pas le propriétaire du contrat</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <div className="container mx-auto p-6 max-w-xl">
                <h1 className="text-4xl font-[Carbon_Phyber] mb-6 text-center text-[#000000]">Gestion des Admins</h1>

                {/* Ajouter un admin */}
                <div className="bg-yellow-bee rounded-lg p-4 mb-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Ajouter un Admin</h2>
                    <form onSubmit={handleAddAdmin} className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse de l'admin</label>
                            <input
                                type="text"
                                value={newAdminAddress}
                                onChange={(e) => setNewAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAddingAdmin}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-1.5 px-4 rounded-lg text-sm disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isAddingAdmin ? 'Ajout en cours...' : 'Ajouter Admin'}
                        </button>
                    </form>
                </div>

                {/* Retirer un admin */}
                <div className="bg-yellow-bee rounded-lg p-4 mb-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Retirer un Admin</h2>
                    <form onSubmit={handleRemoveAdmin} className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse de l'admin</label>
                            <input
                                type="text"
                                value={removeAdminAddress}
                                onChange={(e) => setRemoveAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isRemovingAdmin}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-1.5 px-4 rounded-lg text-sm disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isRemovingAdmin ? 'Suppression en cours...' : 'Retirer Admin'}
                        </button>
                    </form>
                </div>

                {/* Vérifier le statut d'admin */}
                <div className="bg-yellow-bee rounded-lg p-4 opacity-70">
                    <h2 className="text-xl font-[Carbon_bl] mb-3 text-[#000000]">Vérifier le Statut Admin</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">Adresse à vérifier</label>
                            <input
                                type="text"
                                value={checkAdminAddress}
                                onChange={(e) => setCheckAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-3 py-1.5 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        {checkAdminAddress && isAdminResult !== undefined && (
                            <div className="p-3 rounded-lg font-[Olney_Light] text-sm border border-[#000000] text-[#000000]">
                                {isAdminResult ? '✓ Cette adresse est admin' : '✗ Cette adresse n\'est pas admin'}
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