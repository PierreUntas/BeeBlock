'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI, HONEY_TOKENIZATION_ADDRESS, HONEY_TOKENIZATION_ABI } from '@/config/contracts';
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
    const [isApproved, setIsApproved] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [secretKeys, setSecretKeys] = useState<string[]>([]);
    const [merkleRoot, setMerkleRoot] = useState<string>('');
    const [merkleTree, setMerkleTree] = useState<MerkleTree | null>(null);

    const { writeContract, isPending: isCreating } = useWriteContract();

    const { data: producerData } = useReadContract({
        address: HONEY_TRACE_STORAGE_ADDRESS,
        abi: HONEY_TRACE_STORAGE_ABI,
        functionName: 'getProducer',
        args: address ? [address] : undefined,
    });

    const { data: approvalStatus, refetch: refetchApproval } = useReadContract({
        address: HONEY_TOKENIZATION_ADDRESS,
        abi: HONEY_TOKENIZATION_ABI,
        functionName: 'isApprovedForAll',
        args: address ? [address, HONEY_TRACE_STORAGE_ADDRESS] : undefined,
    });

    useEffect(() => {
        if (producerData) {
            const producer = producerData as any;
            setIsAuthorized(producer.authorized);
        }
    }, [producerData]);

    useEffect(() => {
        if (approvalStatus !== undefined) {
            setIsApproved(approvalStatus as boolean);
            if (approvalStatus && isApproving) {
                setIsApproving(false);
                alert('✅ Approbation confirmée ! Vous pouvez maintenant créer des lots.');
            }
        }
    }, [approvalStatus, isApproving]);

    const generateSecretKeys = (count: number) => {
        const keys: string[] = [];
        for (let i = 0; i < count; i++) {
            const randomKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            keys.push(randomKey);
        }
        return keys;
    };

    const handleAmountChange = (value: string) => {
        setAmount(value);
        if (value) {
            const count = parseInt(value);
            if (count > 0 && count <= 100000) {
                const keys = generateSecretKeys(count);
                setSecretKeys(keys);

                const leaves = keys.map(key => keccak256(`0x${Buffer.from(key).toString('hex')}`));
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
                const root = tree.getHexRoot();

                setMerkleTree(tree);
                setMerkleRoot(root);
            }
        } else {
            setSecretKeys([]);
            setMerkleRoot('');
            setMerkleTree(null);
        }
    };

    const downloadSecretKeys = () => {
        if (secretKeys.length === 0 || !merkleTree) return;

        const data = secretKeys.map((key, index) => {
            const leaf = keccak256(Buffer.from(key));
            const proof = merkleTree.getHexProof(leaf);
            return {
                index: index + 1,
                secretKey: key,
                merkleProof: proof.join(',')
            };
        });

        const content = data.map(item =>
            `${item.index},"${item.secretKey}","${item.merkleProof}"`
        ).join('\n');

        const blob = new Blob(
            [`Index,SecretKey,MerkleProof\n${content}`],
            { type: 'text/csv' }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secret-keys-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    const handleApprove = async () => {
        try {
            setIsApproving(true);
            await writeContract({
                address: HONEY_TOKENIZATION_ADDRESS,
                abi: HONEY_TOKENIZATION_ABI,
                functionName: 'setApprovalForAll',
                args: [HONEY_TRACE_STORAGE_ADDRESS, true]
            });

            alert('⏳ Approbation en cours... La transaction doit être confirmée sur la blockchain (~12 sec). Attendez la confirmation avant de créer votre lot.');

            // Polling pour vérifier l'approbation
            const checkApproval = setInterval(async () => {
                const result = await refetchApproval();
                if (result.data === true) {
                    clearInterval(checkApproval);
                    setIsApproving(false);
                    setIsApproved(true);
                }
            }, 3000);

            // Arrêter après 60 secondes
            setTimeout(() => {
                clearInterval(checkApproval);
                setIsApproving(false);
            }, 60000);

        } catch (error) {
            console.error('Erreur lors de l\'approbation:', error);
            alert('❌ Erreur lors de l\'approbation. Vérifiez que vous avez bien confirmé la transaction dans MetaMask.');
            setIsApproving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!honeyType || !metadata || !amount || !merkleRoot) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        if (!isApproved) {
            alert('⚠️ Vous devez d\'abord approuver le contrat HoneyTraceStorage');
            return;
        }

        try {
            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'addHoneyBatch',
                args: [honeyType, metadata, BigInt(amount), merkleRoot as `0x${string}`]
            });

            alert('✅ Lot créé avec succès !');
        } catch (error) {
            console.error('Erreur lors de la création du lot:', error);
            alert('❌ Erreur lors de la création du lot');
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
            <div className="container mx-auto p-6 max-w-2xl">
                {isAuthorized && !isApproved && (
                    <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold">⚠️ Action requise</p>
                                <p className="text-sm">Vous devez approuver le contrat HoneyTraceStorage avant de créer des lots.</p>
                            </div>
                            <button
                                onClick={handleApprove}
                                disabled={isApproving}
                                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isApproving ? '⏳ En cours...' : '✅ Approuver maintenant'}
                            </button>
                        </div>
                    </div>
                )}

                <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-6">
                    Créer un nouveau lot de miel
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-[Olney_Light] text-[#000000] mb-2">
                            Type de miel *
                        </label>
                        <input
                            type="text"
                            value={honeyType}
                            onChange={(e) => setHoneyType(e.target.value)}
                            className="w-full px-4 py-2 border border-[#000000] rounded-lg focus:ring-2 focus:ring-[#666666] font-[Olney_Light]"
                            placeholder="Ex: Lavande, Acacia..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-[Olney_Light] text-[#000000] mb-2">
                            Métadonnées (JSON) *
                        </label>
                        <textarea
                            value={metadata}
                            onChange={(e) => setMetadata(e.target.value)}
                            className="w-full px-4 py-2 border border-[#000000] rounded-lg focus:ring-2 focus:ring-[#666666] font-[Olney_Light] font-mono text-sm"
                            placeholder='{"origin":"Provence","harvestDate":"2024-06"}'
                            rows={4}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-[Olney_Light] text-[#000000] mb-2">
                            Quantité de tokens *
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => handleAmountChange(e.target.value)}
                            className="w-full px-4 py-2 border border-[#000000] rounded-lg focus:ring-2 focus:ring-[#666666] font-[Olney_Light]"
                            placeholder="Ex: 100"
                            min="1"
                            max="100000"
                            required
                        />
                    </div>

                    {merkleRoot && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-[Olney_Light] text-green-800 mb-2">
                                ✅ Merkle Root généré
                            </p>
                            <p className="text-xs font-mono text-green-600 break-all">
                                {merkleRoot}
                            </p>
                            <p className="text-xs font-[Olney_Light] text-green-600 mt-2">
                                {secretKeys.length} clés secrètes générées
                            </p>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={downloadSecretKeys}
                            disabled={!merkleRoot}
                            className="flex-1 bg-blue-500 text-white font-[Olney_Light] py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            📥 Télécharger les clés
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating || !merkleRoot || !isApproved}
                            className="flex-1 bg-[#666666] text-white font-[Olney_Light] py-3 rounded-lg hover:bg-[#555555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreating ? 'Création en cours...' : '✨ Créer le lot'}
                        </button>
                    </div>
                </form>

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
