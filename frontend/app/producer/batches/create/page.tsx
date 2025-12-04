'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';

export default function CreateBatchPage() {
    const { address } = useAccount();
    const [honeyType, setHoneyType] = useState('');
    const [metadata, setMetadata] = useState('');
    const [amount, setAmount] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [secretKeys, setSecretKeys] = useState<string[]>([]);
    const [merkleRoot, setMerkleRoot] = useState<string>('');

    const { writeContract, isPending: isCreating } = useWriteContract();

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

    const generateSecretKeys = (count: number) => {
        const keys: string[] = [];
        for (let i = 0; i < count; i++) {
            const randomKey = `BEE-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            keys.push(randomKey);
        }
        return keys;
    };

    const handleAmountChange = (value: string) => {
        setAmount(value);
        const numAmount = parseInt(value);

        if (!isNaN(numAmount) && numAmount > 0 && numAmount <= 100000) {
            const keys = generateSecretKeys(numAmount);
            setSecretKeys(keys);

            // Créer le Merkle Tree
            const leaves = keys.map(key => keccak256(new TextEncoder().encode(key)));
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const root = tree.getRoot().toString('hex');
            setMerkleRoot(`0x${root}`);
        } else {
            setSecretKeys([]);
            setMerkleRoot('');
        }
    };

    const downloadSecretKeys = () => {
        const content = secretKeys.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-secret-keys-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!merkleRoot || secretKeys.length === 0) {
            alert('Veuillez générer les clés secrètes en spécifiant une quantité');
            return;
        }

        try {
            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'addHoneyBatch',
                args: [honeyType, metadata, BigInt(amount), merkleRoot as `0x${string}`],
            });

            // Télécharger automatiquement les clés après création
            downloadSecretKeys();

            // Réinitialiser le formulaire
            setHoneyType('');
            setMetadata('');
            setAmount('');
            setSecretKeys([]);
            setMerkleRoot('');
        } catch (error) {
            console.error('Erreur lors de la création du lot:', error);
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
                    Créer un Lot de Miel
                </h1>

                <div className="bg-yellow-bee rounded-lg p-4 opacity-70">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Type de miel *
                            </label>
                            <input
                                type="text"
                                value={honeyType}
                                onChange={(e) => setHoneyType(e.target.value)}
                                placeholder="Acacia, Lavande, Châtaignier..."
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                maxLength={64}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Métadonnées (JSON) *
                            </label>
                            <textarea
                                value={metadata}
                                onChange={(e) => setMetadata(e.target.value)}
                                placeholder='{"origine": "Provence", "date": "2024-06", "bio": true}'
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50 min-h-[100px]"
                                maxLength={1024}
                                required
                            />
                            <p className="text-xs font-[Olney_Light] mt-1 text-[#000000]/60">
                                Format JSON avec origine, date de récolte, certifications, etc.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-[Olney_Light] mb-1.5 text-[#000000]">
                                Quantité (nombre de pots) *
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="1-100000"
                                className="w-full px-3 py-2 bg-yellow-bee border border-[#000000] rounded-lg font-[Olney_Light] text-sm text-[#000000] placeholder:text-[#000000]/50"
                                min="1"
                                max="100000"
                                required
                            />
                            <p className="text-xs font-[Olney_Light] mt-1 text-[#000000]/60">
                                Maximum: 100 000 pots par lot
                            </p>
                        </div>

                        {secretKeys.length > 0 && (
                            <div className="p-3 rounded-lg border border-[#000000] bg-yellow-bee/50">
                                <p className="text-sm font-[Olney_Light] text-[#000000] mb-2">
                                    ✓ {secretKeys.length} clés secrètes générées
                                </p>
                                <p className="text-xs font-[Olney_Light] text-[#000000]/60">
                                    Merkle Root: {merkleRoot.substring(0, 10)}...{merkleRoot.substring(merkleRoot.length - 8)}
                                </p>
                                <button
                                    type="button"
                                    onClick={downloadSecretKeys}
                                    className="mt-2 text-xs font-[Olney_Light] underline text-[#000000]"
                                >
                                    Télécharger les clés maintenant
                                </button>
                            </div>
                        )}

                        <div className="p-3 rounded-lg border border-[#000000] bg-yellow-bee/30">
                            <p className="text-xs font-[Olney_Light] text-[#000000]">
                                ⚠️ Important : Les clés secrètes seront téléchargées automatiquement après la création du lot.
                                Conservez-les précieusement pour générer les QR codes.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreating || secretKeys.length === 0}
                            className="w-full bg-[#666666] text-white font-[Olney_Light] py-2 px-4 rounded-lg disabled:opacity-50 hover:bg-[#555555] transition-colors border border-[#000000]"
                        >
                            {isCreating ? 'Création en cours...' : 'Créer le lot'}
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
