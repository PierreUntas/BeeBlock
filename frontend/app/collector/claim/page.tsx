'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import Image from 'next/image';
import { useSendTransaction } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { encodeFunctionData } from 'viem';
import { publicClient } from '@/lib/client';

function ClaimTokenForm() {
    const { address } = useAccount();
    const searchParams = useSearchParams();

    const [editionId, setEditionId] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [merkleProofInput, setMerkleProofInput] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        claiming: false,
    });

    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();

    useEffect(() => {
        const editionIdParam = searchParams.get('editionId');
        const secretKeyParam = searchParams.get('secretKey');
        const merkleProofParam = searchParams.get('merkleProof');

        if (editionIdParam) setEditionId(editionIdParam);
        if (secretKeyParam) setSecretKey(secretKeyParam);
        if (merkleProofParam) setMerkleProofInput(merkleProofParam);
    }, [searchParams]);

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!address) {
            setError('Veuillez connecter votre wallet');
            return;
        }

        if (!editionId || !secretKey) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setLoadingStates(prev => ({ ...prev, claiming: true }));
        let transactionAttempted = false;
        try {
            const editionData = await publicClient.readContract({
                address: ARTWORK_REGISTRY_ADDRESS,
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'getArtworkEdition',
                args: [BigInt(editionId)],
            }) as any;
            if (editionData[2] === true) {
                setError('Cette édition a été désactivée et n\'accepte plus de nouvelles réclamations.');
                return;
            }

            const merkleProof = merkleProofInput.trim()
                ? merkleProofInput.split(',').map(hash => hash.trim() as `0x${string}`)
                : [];

            await publicClient.simulateContract({
                address: ARTWORK_REGISTRY_ADDRESS,
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'claimCertificate',
                args: [BigInt(editionId), secretKey, merkleProof],
                account: address,
            });

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'claimCertificate',
                args: [BigInt(editionId), secretKey, merkleProof],
            });

            transactionAttempted = true;
            const txResult = await sendTransaction(
                {
                    to: ARTWORK_REGISTRY_ADDRESS,
                    data: data,
                },
                {
                    sponsor: true,
                }
            );

            const receipt = await publicClient.waitForTransactionReceipt({ hash: txResult.hash });
            if (receipt.status === 'success') {
                setSuccess(true);
                await showAlert('Token réclamé avec succès !');
                setEditionId('');
                setSecretKey('');
                setMerkleProofInput('');
            } else {
                setError('La transaction a échoué sur la blockchain.');
            }
        } catch (err: any) {
            console.error('Error claiming token:', err);
            if (transactionAttempted && editionId && secretKey) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const claimed = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'isKeyClaimed',
                        args: [BigInt(editionId), secretKey],
                    });
                    if (claimed) {
                        setSuccess(true);
                        await showAlert('Token réclamé avec succès !');
                        setEditionId(''); setSecretKey(''); setMerkleProofInput('');
                        return;
                    }
                } catch {}
            }
            setError(`Erreur: ${err.message || 'Clé invalide ou déjà utilisée'}`);
        } finally {
            setLoadingStates(prev => ({ ...prev, claiming: false }));
        }
    };

    if (!address) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className=" italic text-[22px] text-[#a8a29e]">
                    Veuillez connecter votre wallet
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
            <div className="text-center mb-12">
                <img
                    src="/logo-mona.svg"
                    alt="Mona Editions Logo"
                    className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                />
                <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                    Réclamer un <em className="italic text-[#78716c]">Certificat</em>
                </h1>
            </div>

            <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                    Scannez le QR code de l'œuvre afin que les champs se remplissent automatiquement. Ce certificat vous permettra d'émettre un avis sur l'œuvre.
                </p>
            </div>

            <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                <form onSubmit={handleClaim} className="space-y-6">

                    {/* Advanced parameters toggle */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-[12px] font-normal tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] transition-colors underline"
                        >
                            {showAdvanced ? '− Masquer les détails techniques' : '+ Afficher les détails techniques'}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="space-y-6 pb-6 border-b border-[#d6d0c8]">
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                    Numéro de l'œuvre *
                                </label>
                                <input
                                    type="number"
                                    value={editionId}
                                    onChange={(e) => setEditionId(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                    placeholder="Ex: 1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                    Clé secrète *
                                </label>
                                <input
                                    type="text"
                                    value={secretKey}
                                    onChange={(e) => setSecretKey(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                    placeholder="Ex: abc123def456..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                    Preuve Merkle (séparée par des virgules) *
                                </label>
                                <textarea
                                    value={merkleProofInput}
                                    onChange={(e) => setMerkleProofInput(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors font-mono text-[11px] min-h-[100px]"
                                    placeholder="Ex: 0x123...,0xabc...,0xdef..."
                                />
                                <p className="text-[11px] text-[#a8a29e] mt-2 font-light">
                                    Format : hash1,hash2,hash3 (avec 0x devant chaque hash)
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="border border-[#d6d0c8] bg-[#ede9e3] p-4">
                            <p className="text-[13px] font-light text-[#78716c]">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="border border-[#d6d0c8] bg-[#ede9e3] p-4">
                            <p className="text-[13px] font-light text-[#1c1917]">Certificat réclamé avec succès !</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loadingStates.claiming}
                        className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                    >
                        {loadingStates.claiming ? 'Transaction en cours…' : 'Réclamer mon certificat'}
                    </button>
                </form>
            </div>

            {/* Footer mark */}
            <div className="flex justify-center mt-20">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-px h-12 bg-[#d6d0c8]" />
                    <span className=" italic text-[13px] text-[#a8a29e]">Mona Editions</span>
                </div>
            </div>
        </div>
    );
}

export default function ClaimTokenPage() {
    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement…</p>
                </div>
            }>
                <ClaimTokenForm />
            </Suspense>
        </div>
    );
}
