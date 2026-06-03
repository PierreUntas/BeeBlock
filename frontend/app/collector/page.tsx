'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { getFromIPFSGateway, uploadToIPFS } from '@/app/utils/ipfs';
import Link from 'next/link';
import { parseAbiItem, encodeFunctionData, isAddress } from 'viem';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { useSendTransaction } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';

interface OwnedToken {
    tokenId: bigint;
    balance: bigint;
    title: string;
    metadata: string;
    artist: string;
    artistName: string;
}

export default function CollectorPage() {
    const { address } = useAccount();
    const [ownedTokens, setOwnedTokens] = useState<OwnedToken[]>([]);
    
    const [loadingStates, setLoadingStates] = useState({
        fetchingTokens: true,
        commenting: false,
        transferring: false,
    });

    const [selectedToken, setSelectedToken] = useState<bigint | null>(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    const [transferToken, setTransferToken] = useState<OwnedToken | null>(null);
    const [transferStep, setTransferStep] = useState<'form' | 'confirm'>('form');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [transferAmount, setTransferAmount] = useState(1);
    const [recipientError, setRecipientError] = useState('');

    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();

    useEffect(() => {
        const fetchOwnedTokens = async () => {
            if (!address || !publicClient) { setLoadingStates(prev => ({ ...prev, fetchingTokens: false })); return; }

            setLoadingStates(prev => ({ ...prev, fetchingTokens: true }));
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest'
                });

                const tokensData: OwnedToken[] = [];

                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;
                    const artistAddress = log.args.artist as `0x${string}`;

                    const balance = await publicClient.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'balanceOf',
                        args: [address, tokenId]
                    }) as bigint;

                    if (balance > 0n) {
                        const [[editionMetadata], artistData] = await Promise.all([
                            publicClient.readContract({
                                address: ARTWORK_REGISTRY_ADDRESS,
                                abi: ARTWORK_REGISTRY_ABI,
                                functionName: 'getArtworkEdition',
                                args: [tokenId]
                            }) as Promise<any>,
                            publicClient.readContract({
                                address: ARTWORK_REGISTRY_ADDRESS,
                                abi: ARTWORK_REGISTRY_ABI,
                                functionName: 'getArtist',
                                args: [artistAddress]
                            }) as Promise<any>
                        ]);

                        let artworkTitle = 'Œuvre sans titre';
                        if (editionMetadata?.trim()) {
                            try {
                                const editionIpfs = await getFromIPFSGateway(editionMetadata);
                                artworkTitle = editionIpfs.title || 'Œuvre sans titre';
                            } catch (e) {
                                console.error('Error loading edition metadata:', e);
                            }
                        }

                        let artistName = 'Artiste anonyme';
                        if (artistData.metadata?.trim()) {
                            try {
                                const artistIpfs = await getFromIPFSGateway(artistData.metadata);
                                artistName = artistIpfs.name || 'Artiste anonyme';
                            } catch (e) {
                                console.error('Error loading artist metadata:', e);
                            }
                        }

                        tokensData.push({
                            tokenId,
                            balance,
                            title: artworkTitle,
                            metadata: editionMetadata,
                            artist: artistAddress,
                            artistName: artistName
                        });
                    }
                }

                tokensData.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
                setOwnedTokens(tokensData);
            } catch (error) {
                console.error('Error loading tokens:', error);
            } finally {
                setLoadingStates(prev => ({ ...prev, fetchingTokens: false }));
            }
        };

        fetchOwnedTokens();
    }, [address]);

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedToken) return;

        const token = ownedTokens.find(t => t.tokenId === selectedToken);
        if (token && address && token.artist.toLowerCase() === address.toLowerCase()) {
            await showAlert('Vous ne pouvez pas laisser un avis sur vos propres œuvres');
            return;
        }

        setLoadingStates(prev => ({ ...prev, commenting: true }));
        let transactionAttempted = false;
        let countBefore = 0n;
        try {
            countBefore = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviewsCount', args: [selectedToken] }) as bigint;
        } catch {}
        try {
            const reviewMetadata = { rating, comment };
            const cid = await uploadToIPFS(reviewMetadata);

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'addReview',
                args: [selectedToken, rating, cid]
            });

            transactionAttempted = true;
            const txResult = await sendTransaction({ to: ARTWORK_REGISTRY_ADDRESS, data }, { sponsor: true });
            await publicClient.waitForTransactionReceipt({ hash: txResult.hash });

            await showAlert('Avis envoyé avec succès !');
            setSelectedToken(null);
            setRating(5);
            setComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            if (transactionAttempted) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const countAfter = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getEditionReviewsCount', args: [selectedToken] }) as bigint;
                    if (countAfter > countBefore) {
                        await showAlert('Avis envoyé avec succès !');
                        setSelectedToken(null); setRating(5); setComment('');
                        return;
                    }
                } catch {}
            }
            await showAlert('Erreur lors de l\'ajout du commentaire');
        } finally {
            setLoadingStates(prev => ({ ...prev, commenting: false }));
        }
    };

    const openTransferModal = (token: OwnedToken) => {
        setTransferToken(token);
        setTransferStep('form');
        setRecipientAddress('');
        setTransferAmount(1);
        setRecipientError('');
    };

    const closeTransferModal = () => {
        setTransferToken(null);
        setTransferStep('form');
        setRecipientAddress('');
        setRecipientError('');
    };

    const handleTransferPreview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAddress(recipientAddress)) {
            setRecipientError('Adresse invalide — elle doit commencer par 0x et faire 42 caractères');
            return;
        }
        if (address && recipientAddress.toLowerCase() === address.toLowerCase()) {
            setRecipientError('Vous ne pouvez pas transférer vers votre propre adresse');
            return;
        }
        setRecipientError('');
        setTransferStep('confirm');
    };

    const handleTransferConfirm = async () => {
        if (!transferToken || !address) return;
        setLoadingStates(prev => ({ ...prev, transferring: true }));
        try {
            const data = encodeFunctionData({
                abi: ARTWORK_TOKENIZATION_ABI,
                functionName: 'safeTransferFrom',
                args: [address, recipientAddress as `0x${string}`, transferToken.tokenId, BigInt(transferAmount), '0x'],
            });
            const tx = await sendTransaction({ to: ARTWORK_TOKENIZATION_ADDRESS, data }, { sponsor: true });
            await publicClient.waitForTransactionReceipt({ hash: tx.hash });

            setOwnedTokens(prev => {
                const updated = prev.map(t => {
                    if (t.tokenId !== transferToken.tokenId) return t;
                    return { ...t, balance: t.balance - BigInt(transferAmount) };
                }).filter(t => t.balance > 0n);
                return updated;
            });

            closeTransferModal();
            await showAlert(`Transfert effectué avec succès !`);
        } catch (error) {
            console.error('Transfer error:', error);
            await showAlert('Erreur lors du transfert');
        } finally {
            setLoadingStates(prev => ({ ...prev, transferring: false }));
        }
    };

    const isOwnArtist = (token: OwnedToken) =>
        address && token.artist.toLowerCase() === address.toLowerCase();

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-[860px] mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Mes <em className="italic text-[#78716c]">Certificats</em>
                    </h1>
                </div>

                {loadingStates.fetchingTokens || !address ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement de vos certificats…</p>
                    </div>
                ) : ownedTokens.length === 0 ? (
                    <div className="border border-[#d6d0c8] bg-[#fafaf8] p-12 text-center">
                        <p className=" italic text-[18px] text-[#78716c]">
                            Vous ne possédez pas encore de certificat
                        </p>
                    </div>
                ) : (
                    <div className="space-y-px">
                        {ownedTokens.map((token) => (
                            <div key={token.tokenId.toString()} className="border border-[#d6d0c8] bg-[#fafaf8] p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className=" text-[28px] font-normal text-[#1c1917] mb-2 leading-tight">
                                            {token.title}
                                        </h2>
                                        <p className="text-[12px] font-light tracking-[0.06em] text-[#a8a29e] mb-1">
                                            ŒUVRE #{token.tokenId.toString()}
                                        </p>
                                        <p className="text-[13px] font-light text-[#78716c] mb-2">
                                            Par {token.artistName}
                                        </p>
                                        {isOwnArtist(token) && (
                                            <p className="text-[11px] font-medium text-[#1c1917] bg-[#ede9e3] px-3 py-1.5 border border-[#d6d0c8] inline-block tracking-[0.06em]">
                                                Votre création
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-6">
                                        <p className="text-[11px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                            Exemplaires
                                        </p>
                                        <p className=" text-[36px] font-normal text-[#1c1917] leading-none">
                                            {token.balance.toString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Link
                                        href={`/explore/edition/${token.tokenId}`}
                                        className="flex-1 bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200 text-center"
                                    >
                                        Voir les détails
                                    </Link>
                                    {!isOwnArtist(token) && (
                                        <button
                                            onClick={() => setSelectedToken(token.tokenId)}
                                            className="flex-1 bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#d6d0c8] hover:border-[#1c1917] transition-all duration-200"
                                        >
                                            Laisser un avis
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openTransferModal(token)}
                                        className="flex-1 bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#d6d0c8] hover:border-[#1c1917] transition-all duration-200"
                                    >
                                        Transférer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Review modal */}
                {selectedToken && (
                    <div className="fixed inset-0 bg-[#1c1917]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 max-w-md w-full">
                            <h3 className=" text-[28px] font-normal text-[#1c1917] mb-6 leading-tight">
                                Laisser un avis
                            </h3>
                            <form onSubmit={handleAddComment} className="space-y-5">
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                        Note
                                    </label>
                                    <select
                                        value={rating}
                                        onChange={(e) => setRating(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors cursor-pointer"
                                        required
                                    >
                                        <option value={5}>⭐⭐⭐⭐⭐ 5 / 5</option>
                                        <option value={4}>⭐⭐⭐⭐ 4 / 5</option>
                                        <option value={3}>⭐⭐⭐ 3 / 5</option>
                                        <option value={2}>⭐⭐ 2 / 5</option>
                                        <option value={1}>⭐ 1 / 5</option>
                                        <option value={0}>0 / 5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                        Commentaire (5–500 caractères)
                                    </label>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        minLength={5}
                                        maxLength={500}
                                        rows={4}
                                        className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[100px]"
                                        required
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedToken(null)}
                                        className="flex-1 bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#d6d0c8] hover:border-[#1c1917] transition-all duration-200"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loadingStates.commenting}
                                        className="flex-1 bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                                    >
                                        {loadingStates.commenting ? 'Envoi…' : 'Envoyer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Transfer modal */}
                {transferToken && (
                    <div className="fixed inset-0 bg-[#1c1917]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 max-w-md w-full">

                            {transferStep === 'form' ? (
                                <>
                                    <h3 className="text-[28px] font-normal text-[#1c1917] mb-1 leading-tight">
                                        Transférer le certificat
                                    </h3>
                                    <p className="text-[13px] font-light text-[#78716c] mb-6">
                                        {transferToken.title}
                                    </p>
                                    <form onSubmit={handleTransferPreview} className="space-y-5">
                                        <div>
                                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                                Adresse du destinataire
                                            </label>
                                            <input
                                                type="text"
                                                value={recipientAddress}
                                                onChange={(e) => { setRecipientAddress(e.target.value); setRecipientError(''); }}
                                                placeholder="0x..."
                                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] font-mono text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                                required
                                            />
                                            {recipientError && (
                                                <p className="mt-2 text-[12px] text-[#dc2626]">{recipientError}</p>
                                            )}
                                        </div>
                                        {transferToken.balance > 1n && (
                                            <div>
                                                <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                                    Nombre d'exemplaires à transférer
                                                </label>
                                                <input
                                                    type="number"
                                                    value={transferAmount}
                                                    onChange={(e) => setTransferAmount(Math.min(Number(e.target.value), Number(transferToken.balance)))}
                                                    min={1}
                                                    max={Number(transferToken.balance)}
                                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors"
                                                    required
                                                />
                                                <p className="mt-1.5 text-[11px] text-[#a8a29e]">
                                                    Vous possédez {transferToken.balance.toString()} exemplaire{transferToken.balance > 1n ? 's' : ''}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={closeTransferModal}
                                                className="flex-1 bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#d6d0c8] hover:border-[#1c1917] transition-all duration-200"
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-[2] bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200"
                                            >
                                                Prévisualiser le transfert →
                                            </button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-[28px] font-normal text-[#1c1917] mb-6 leading-tight">
                                        Confirmer le transfert
                                    </h3>
                                    <div className="border border-[#d6d0c8] bg-[#f5f3ef] p-5 space-y-3 mb-6">
                                        <div>
                                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-0.5">Œuvre</p>
                                            <p className="text-[13px] text-[#1c1917]">{transferToken.title} <span className="text-[#a8a29e]">#{transferToken.tokenId.toString()}</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-0.5">Exemplaires</p>
                                            <p className="text-[13px] text-[#1c1917]">{transferAmount}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-0.5">Destinataire</p>
                                            <p className="text-[12px] font-mono text-[#1c1917] break-all">{recipientAddress}</p>
                                        </div>
                                    </div>
                                    <p className="text-[12px] font-medium text-[#dc2626] mb-6">
                                        Cette action est irréversible. Vérifiez bien l'adresse du destinataire avant de confirmer.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setTransferStep('form')}
                                            disabled={loadingStates.transferring}
                                            className="flex-1 bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#d6d0c8] hover:border-[#1c1917] transition-all duration-200 disabled:opacity-50"
                                        >
                                            Modifier
                                        </button>
                                        <button
                                            onClick={handleTransferConfirm}
                                            disabled={loadingStates.transferring}
                                            className="flex-[2] bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                                        >
                                            {loadingStates.transferring ? 'Transfert en cours…' : 'Confirmer le transfert'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-center mt-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-px h-12 bg-[#d6d0c8]" />
                        <span className=" italic text-[13px] text-[#a8a29e]">Mona Editions</span>
                    </div>
                </div>
            </div>
        </div>
    );
}