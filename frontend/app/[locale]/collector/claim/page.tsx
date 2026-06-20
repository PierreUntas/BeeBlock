'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
    ARTWORK_TOKENIZATION_ADDRESS,
    ARTWORK_TOKENIZATION_ABI,
} from '@/config/contracts';
import Image from 'next/image';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { encodeFunctionData } from 'viem';
import { publicClient } from '@/lib/client';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { useTranslations } from 'next-intl';

function ClaimTokenForm() {
    const t = useTranslations('Claim');
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
    const { getAccessToken } = usePrivy();
    const { showAlert } = useModal();

    /**
     * Best-effort enrichment + email notification after a successful claim.
     * Failures are silenced — the on-chain transaction has already succeeded.
     */
    const sendClaimNotification = async (
        editionIdValue: string,
        txHash: string,
    ): Promise<void> => {
        let artworkTitle = '';
        let artistName = '';
        try {
            const id = BigInt(editionIdValue);
            const [editionData, artistAddress] = await Promise.all([
                publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtworkEdition',
                    args: [id],
                }) as Promise<readonly [string, string, boolean]>,
                publicClient.readContract({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    abi: ARTWORK_TOKENIZATION_ABI,
                    functionName: 'tokenArtist',
                    args: [id],
                }) as Promise<`0x${string}`>,
            ]);

            const [editionMeta, artistInfo] = await Promise.all([
                getFromIPFSGateway(editionData[0]).catch(() => null),
                publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtist',
                    args: [artistAddress],
                }) as Promise<{ authorized: boolean; metadata: string }>,
            ]);

            if (editionMeta && (editionMeta as any).title) {
                artworkTitle = (editionMeta as any).title;
            }
            if (artistInfo?.metadata) {
                const artistMeta = await getFromIPFSGateway(artistInfo.metadata).catch(() => null);
                if (artistMeta && (artistMeta as any).name) {
                    artistName = (artistMeta as any).name;
                }
            }
        } catch (e) {
            console.warn('Could not enrich claim email:', e);
        }

        try {
            const token = await getAccessToken();
            if (!token) return;
            await fetch('/api/collector/notify-claim', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    editionId: Number(editionIdValue),
                    txHash,
                    artworkTitle,
                    artistName,
                }),
            });
        } catch (e) {
            console.warn('Could not send claim notification:', e);
        }
    };

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
            setError(t('connectWallet'));
            return;
        }

        if (!editionId || !secretKey) {
            setError(t('fillAllFields'));
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
                setError(t('disabledEdition'));
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
                // Best-effort confirmation email — runs in background, doesn't block UX
                void sendClaimNotification(editionId, txResult.hash);
                await showAlert(t('successAlert'));
                setEditionId('');
                setSecretKey('');
                setMerkleProofInput('');
            } else {
                setError(t('txFailed'));
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
                        // No tx hash available in this fallback path — pass empty
                        // string so the API skips Basescan link gracefully.
                        void sendClaimNotification(editionId, '');
                        await showAlert(t('successAlert'));
                        setEditionId(''); setSecretKey(''); setMerkleProofInput('');
                        return;
                    }
                } catch {}
            }
            setError(t('genericError', { message: err.message || '—' }));
        } finally {
            setLoadingStates(prev => ({ ...prev, claiming: false }));
        }
    };

    if (!address) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                <p className=" italic text-[22px] text-[#a8a29e]">
                    {t('connectWallet')}
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
                    {t('title')} <em className="italic text-[#78716c]">{t('titleAccent')}</em>
                </h1>
            </div>

            <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                    {t('instructions')}
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
                            {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="space-y-6 pb-6 border-b border-[#d6d0c8]">
                            <div>
                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                    {t('editionIdLabel')}
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
                                    {t('secretKeyLabel')}
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
                                    {t('merkleProofLabel')}
                                </label>
                                <textarea
                                    value={merkleProofInput}
                                    onChange={(e) => setMerkleProofInput(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors font-mono text-[11px] min-h-[100px]"
                                    placeholder="Ex: 0x123...,0xabc...,0xdef..."
                                />
                                <p className="text-[11px] text-[#a8a29e] mt-2 font-light">
                                    {t('merkleProofHint')}
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
                            <p className="text-[13px] font-light text-[#1c1917]">{t('success')}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loadingStates.claiming}
                        className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                    >
                        {loadingStates.claiming ? t('submitLoading') : t('submit')}
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
