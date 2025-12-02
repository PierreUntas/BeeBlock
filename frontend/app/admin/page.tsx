'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';

export default function AdminPage() {
    const { address } = useAccount();
    const [newAdminAddress, setNewAdminAddress] = useState('');
    const [removeAdminAddress, setRemoveAdminAddress] = useState('');
    const [checkAdminAddress, setCheckAdminAddress] = useState('');
    const [isOwner, setIsOwner] = useState(false);

    const { writeContract, isPending: isAddingAdmin } = useWriteContract();
    const { writeContract: writeRemoveAdmin, isPending: isRemovingAdmin } = useWriteContract();

    const { data: ownerAddress } = useReadContract({
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
        }
    }, [address, ownerAddress]);


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

    const handleCheckAdmin = () => {
        if (checkAdminAddress) {
            refetchIsAdmin();
        }
    };

    if (!address) {
        return (
            <div className="container mx-auto p-6">
                <p className="text-center text-red-600">Veuillez connecter votre wallet</p>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="container mx-auto p-6">
                <p className="text-center text-red-600">Accès refusé : vous n'êtes pas le propriétaire du contrat</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">Gestion des Admins</h1>

            {/* Ajouter un admin */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Ajouter un Admin</h2>
                <form onSubmit={handleAddAdmin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Adresse de l'admin</label>
                        <input
                            type="text"
                            value={newAdminAddress}
                            onChange={(e) => setNewAdminAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                            pattern="^0x[a-fA-F0-9]{40}$"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isAddingAdmin}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                        {isAddingAdmin ? 'Ajout en cours...' : 'Ajouter Admin'}
                    </button>
                </form>
            </div>

            {/* Retirer un admin */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Retirer un Admin</h2>
                <form onSubmit={handleRemoveAdmin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Adresse de l'admin</label>
                        <input
                            type="text"
                            value={removeAdminAddress}
                            onChange={(e) => setRemoveAdminAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                            pattern="^0x[a-fA-F0-9]{40}$"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isRemovingAdmin}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                    >
                        {isRemovingAdmin ? 'Suppression en cours...' : 'Retirer Admin'}
                    </button>
                </form>
            </div>

            {/* Vérifier le statut d'admin */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Vérifier le Statut Admin</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Adresse à vérifier</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={checkAdminAddress}
                                onChange={(e) => setCheckAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                            <button
                                onClick={handleCheckAdmin}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg"
                            >
                                Vérifier
                            </button>
                        </div>
                    </div>
                    {checkAdminAddress && isAdminResult !== undefined && (
                        <div className={`p-4 rounded-lg ${isAdminResult ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isAdminResult ? '✓ Cette adresse est admin' : '✗ Cette adresse n\'est pas admin'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
