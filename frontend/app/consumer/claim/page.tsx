'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { HONEY_TRACE_STORAGE_ADDRESS, HONEY_TRACE_STORAGE_ABI } from '@/config/contracts';
import Navbar from '@/components/shared/Navbar';
import Image from 'next/image';

function ClaimTokenForm() {
    const { address } = useAccount();
    const searchParams = useSearchParams();

    const [batchId, setBatchId] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [merkleProofInput, setMerkleProofInput] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const { writeContract, isPending } = useWriteContract();

    useEffect(() => {
        const batchIdParam = searchParams.get('batchId');
        const secretKeyParam = searchParams.get('secretKey');
        const merkleProofParam = searchParams.get('merkleProof');

        if (batchIdParam) setBatchId(batchIdParam);
        if (secretKeyParam) setSecretKey(secretKeyParam);
        if (merkleProofParam) setMerkleProofInput(merkleProofParam);
    }, [searchParams]);

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!address) {
            setError('❌ Veuillez connecter votre wallet');
            return;
        }

        if (!batchId || !secretKey || !merkleProofInput) {
            setError('❌ Veuillez remplir tous les champs');
            return;
        }

        try {
            const merkleProof = merkleProofInput
                .split(',')
                .map(hash => hash.trim() as `0x${string}`);

            await writeContract({
                address: HONEY_TRACE_STORAGE_ADDRESS,
                abi: HONEY_TRACE_STORAGE_ABI,
                functionName: 'claimHoneyToken',
                args: [BigInt(batchId), secretKey, merkleProof],
            });

            setSuccess(true);
            alert('✅ Token réclamé avec succès !');
            setBatchId('');
            setSecretKey('');
            setMerkleProofInput('');
        } catch (err: any) {
            console.error('Erreur lors de la réclamation:', err);
            setError(`❌ Erreur: ${err.message || 'Clé invalide ou déjà utilisée'}`);
        }
    };

    if (!address) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">
                    Veuillez connecter votre wallet
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <h1 className="text-4xl font-[Carbon_Phyber] text-[#000000] mb-6">
                Réclamer un Token de Miel
            </h1>

            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
                <p className="font-[Olney_Light] text-sm">
                    💡 <strong>Mode test :</strong> Entrez manuellement le numéro de lot, la clé secrète et la preuve Merkle.<br/>
                    <em>À terme, ces informations seront contenues dans le QR code à l'intérieur du pot.</em>
                </p>
            </div>

            <form onSubmit={handleClaim} className="space-y-6">
                <div>
                    <label className="block text-[#000000] font-[Olney_Light] mb-2">
                        Numéro de lot *
                    </label>
                    <input
                        type="number"
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        className="w-full p-3 rounded-lg border border-[#000000] bg-yellow-bee text-[#000000] font-[Olney_Light] focus:outline-none focus:ring-2 focus:ring-[#666666]"
                        placeholder="Ex: 1"
                        required
                    />
                </div>

                <div>
                    <label className="block text-[#000000] font-[Olney_Light] mb-2">
                        Clé secrète *
                    </label>
                    <input
                        type="text"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        className="w-full p-3 rounded-lg border border-[#000000] bg-yellow-bee text-[#000000] font-[Olney_Light] focus:outline-none focus:ring-2 focus:ring-[#666666]"
                        placeholder="Ex: abc123def456..."
                        required
                    />
                </div>

                <div>
                    <label className="block text-[#000000] font-[Olney_Light] mb-2">
                        Preuve Merkle (séparée par des virgules) *
                    </label>
                    <textarea
                        value={merkleProofInput}
                        onChange={(e) => setMerkleProofInput(e.target.value)}
                        className="w-full p-3 rounded-lg border border-[#000000] bg-yellow-bee text-[#000000] font-[Olney_Light] focus:outline-none focus:ring-2 focus:ring-[#666666] font-mono text-xs"
                        placeholder="Ex: 0x123...,0xabc...,0xdef..."
                        rows={4}
                        required
                    />
                    <p className="text-xs text-[#000000]/60 mt-1 font-[Olney_Light]">
                        Format : hash1,hash2,hash3 (avec 0x devant chaque hash)
                    </p>
                </div>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                        <p className="font-[Olney_Light]">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
                        <p className="font-[Olney_Light]">✅ Token réclamé avec succès !</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-[#666666] text-white font-[Olney_Light] py-3 px-6 rounded-lg hover:bg-[#555555] transition-colors border border-[#000000] disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isPending ? 'Transaction en cours...' : 'Réclamer mon token'}
                </button>
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
    );
}

export default function ClaimTokenPage() {
    return (
        <div className="min-h-screen bg-yellow-bee pt-14">
            <Navbar />
            <Suspense fallback={
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="text-center text-[#000000] font-[Olney_Light] text-xl opacity-70">
                        Chargement...
                    </p>
                </div>
            }>
                <ClaimTokenForm />
            </Suspense>
        </div>
    );
}
