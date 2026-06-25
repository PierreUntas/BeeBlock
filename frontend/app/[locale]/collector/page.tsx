'use client';

/**
 * /collector — the collector's "My collection" page.
 *
 * Lists every ERC-1155 the connected wallet currently holds, with the
 * artwork's title, image, artist, and quick actions: view detail page,
 * leave a verified review, transfer to another wallet, share publicly.
 *
 * Polish goals (vs. the older text-only list):
 *  - Each owned token displays its IPFS image — the collector should
 *    see their collection, not read about it.
 *  - Horizontal layout (image + info side-by-side) reads like a
 *    catalogue, not a form.
 *  - Share button per token using the shared <ShareMenu/>.
 *  - Empty state is engaging (collection icon + helpful CTA) instead
 *    of an italic gray line.
 *  - All copy is in the Collector i18n namespace — modals included.
 *  - Trust footer matches the artist / claim / edition pages.
 */

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useSendTransaction } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { parseAbiItem, encodeFunctionData, isAddress } from 'viem';

import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
    ARTWORK_TOKENIZATION_ADDRESS,
    ARTWORK_TOKENIZATION_ABI,
} from '@/config/contracts';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { getFromIPFSGateway, uploadToIPFS } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { useModal } from '@/app/ModalProvider';
import ShareMenu from '@/components/shared/ShareMenu';

// =========================================================================
// Types
// =========================================================================

interface OwnedToken {
    tokenId: bigint;
    balance: bigint;
    title: string;
    metadataCid: string;
    artist: `0x${string}`;
    artistName: string;
    image: string | null;
}

// =========================================================================
// Main component
// =========================================================================

export default function CollectorPage() {
    const t = useTranslations('Collector');
    const { address } = useAccount();
    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();

    const [ownedTokens, setOwnedTokens] = useState<OwnedToken[]>([]);
    const [loadingStates, setLoadingStates] = useState({
        fetchingTokens: true,
        commenting: false,
        transferring: false,
    });

    // Review modal
    const [selectedToken, setSelectedToken] = useState<bigint | null>(null);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    // Transfer modal
    const [transferToken, setTransferToken] = useState<OwnedToken | null>(null);
    const [transferStep, setTransferStep] = useState<'form' | 'confirm'>('form');
    const [recipientAddress, setRecipientAddress] = useState('');
    const [transferAmount, setTransferAmount] = useState(1);
    const [recipientError, setRecipientError] = useState('');

    // -------- Load owned tokens on wallet change --------
    useEffect(() => {
        const fetchOwnedTokens = async () => {
            if (!address || !publicClient) {
                setLoadingStates(prev => ({ ...prev, fetchingTokens: false }));
                return;
            }
            setLoadingStates(prev => ({ ...prev, fetchingTokens: true }));
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                });

                const tokensData: OwnedToken[] = [];

                for (const log of logs) {
                    const tokenId = log.args.editionId as bigint;
                    const artistAddress = log.args.artist as `0x${string}`;

                    const balance = await publicClient.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'balanceOf',
                        args: [address, tokenId],
                    }) as bigint;

                    if (balance > 0n) {
                        const [editionRecord, artistData] = await Promise.all([
                            publicClient.readContract({
                                address: ARTWORK_REGISTRY_ADDRESS,
                                abi: ARTWORK_REGISTRY_ABI,
                                functionName: 'getArtworkEdition',
                                args: [tokenId],
                            }) as Promise<readonly [string, string, boolean]>,
                            publicClient.readContract({
                                address: ARTWORK_REGISTRY_ADDRESS,
                                abi: ARTWORK_REGISTRY_ABI,
                                functionName: 'getArtist',
                                args: [artistAddress],
                            }) as Promise<{ authorized: boolean; metadata: string }>,
                        ]);

                        const [editionMetadataCid] = editionRecord;

                        let artworkTitle = t('untitled');
                        let imageUrl: string | null = null;
                        if (editionMetadataCid?.trim()) {
                            try {
                                const editionIpfs = await getFromIPFSGateway(editionMetadataCid);
                                if (editionIpfs?.title) artworkTitle = editionIpfs.title;
                                if (editionIpfs?.images?.[0]) imageUrl = ipfsToHttp(editionIpfs.images[0]);
                            } catch (e) {
                                console.error('Error loading edition metadata:', e);
                            }
                        }

                        let artistName = t('anonymousArtist');
                        if (artistData.metadata?.trim()) {
                            try {
                                const artistIpfs = await getFromIPFSGateway(artistData.metadata);
                                if (artistIpfs?.name) artistName = artistIpfs.name;
                            } catch (e) {
                                console.error('Error loading artist metadata:', e);
                            }
                        }

                        tokensData.push({
                            tokenId,
                            balance,
                            title: artworkTitle,
                            metadataCid: editionMetadataCid,
                            artist: artistAddress,
                            artistName,
                            image: imageUrl,
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
    // t is stable per locale (next-intl).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address]);

    // -------- Review submission --------
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedToken) return;

        const token = ownedTokens.find(t => t.tokenId === selectedToken);
        if (token && address && token.artist.toLowerCase() === address.toLowerCase()) {
            await showAlert(t('review.errorOwnArtwork'));
            return;
        }

        setLoadingStates(prev => ({ ...prev, commenting: true }));
        let transactionAttempted = false;
        let countBefore = 0n;
        try {
            countBefore = await publicClient.readContract({
                address: ARTWORK_REGISTRY_ADDRESS,
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'getEditionReviewsCount',
                args: [selectedToken],
            }) as bigint;
        } catch {}
        try {
            const reviewMetadata = { rating, comment };
            const cid = await uploadToIPFS(reviewMetadata);

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'addReview',
                args: [selectedToken, rating, cid],
            });

            transactionAttempted = true;
            const txResult = await sendTransaction(
                { to: ARTWORK_REGISTRY_ADDRESS, data },
                { sponsor: true },
            );
            await publicClient.waitForTransactionReceipt({ hash: txResult.hash });

            await showAlert(t('review.success'));
            setSelectedToken(null);
            setRating(5);
            setComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            // Privy may surface an error even when the tx succeeded. Re-check
            // the on-chain review count before declaring failure.
            if (transactionAttempted) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const countAfter = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getEditionReviewsCount',
                        args: [selectedToken],
                    }) as bigint;
                    if (countAfter > countBefore) {
                        await showAlert(t('review.success'));
                        setSelectedToken(null);
                        setRating(5);
                        setComment('');
                        return;
                    }
                } catch {}
            }
            await showAlert(t('review.errorGeneric'));
        } finally {
            setLoadingStates(prev => ({ ...prev, commenting: false }));
        }
    };

    // -------- Transfer flow --------
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
            setRecipientError(t('transfer.errorInvalidAddress'));
            return;
        }
        if (address && recipientAddress.toLowerCase() === address.toLowerCase()) {
            setRecipientError(t('transfer.errorSelfTransfer'));
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
                args: [
                    address,
                    recipientAddress as `0x${string}`,
                    transferToken.tokenId,
                    BigInt(transferAmount),
                    '0x',
                ],
            });
            const tx = await sendTransaction(
                { to: ARTWORK_TOKENIZATION_ADDRESS, data },
                { sponsor: true },
            );
            await publicClient.waitForTransactionReceipt({ hash: tx.hash });

            setOwnedTokens(prev =>
                prev
                    .map(t =>
                        t.tokenId !== transferToken.tokenId
                            ? t
                            : { ...t, balance: t.balance - BigInt(transferAmount) },
                    )
                    .filter(t => t.balance > 0n),
            );

            closeTransferModal();
            await showAlert(t('transfer.success'));
        } catch (error) {
            console.error('Transfer error:', error);
            await showAlert(t('transfer.errorGeneric'));
        } finally {
            setLoadingStates(prev => ({ ...prev, transferring: false }));
        }
    };

    const isOwnArtist = (token: OwnedToken) =>
        address && token.artist.toLowerCase() === address.toLowerCase();

    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">

                {/* ============================================================ */}
                {/* HERO                                                         */}
                {/* ============================================================ */}
                <header className="text-center mb-12">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-8 h-px bg-[var(--border)]" />
                        <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[var(--text-muted)]">
                            Mona Editions
                        </span>
                        <div className="w-8 h-px bg-[var(--border)]" />
                    </div>
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight mb-3">
                        {t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em>
                    </h1>
                    {address && !loadingStates.fetchingTokens && (
                        <p className="text-[13px] font-light text-[var(--text-secondary)]">
                            {t('heroSubtitle', { count: ownedTokens.length })}
                        </p>
                    )}
                </header>

                {/* ============================================================ */}
                {/* CONTENT                                                      */}
                {/* ============================================================ */}
                {!address ? (
                    <EmptyShell message={t('notConnected')} />
                ) : loadingStates.fetchingTokens ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                        <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">
                            {t('loading')}
                        </p>
                    </div>
                ) : ownedTokens.length === 0 ? (
                    <EmptyCollection />
                ) : (
                    <div className="space-y-px">
                        {ownedTokens.map(token => (
                            <CollectionCard
                                key={token.tokenId.toString()}
                                token={token}
                                isOwnArtist={!!isOwnArtist(token)}
                                onReview={() => setSelectedToken(token.tokenId)}
                                onTransfer={() => openTransferModal(token)}
                            />
                        ))}
                    </div>
                )}

                {/* ============================================================ */}
                {/* TRUST FOOTER                                                  */}
                {/* ============================================================ */}
                {address && (
                    <div className="mt-20 border-t border-[var(--border)] pt-12">
                        <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                            <img
                                src="/logo-mona.svg"
                                alt="Mona Editions"
                                className="w-24 h-12 object-contain opacity-60 dark:invert"
                            />
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                                {t('trustTitle')}
                            </p>
                            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.8]">
                                {t('trustBody')}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                                <Link
                                    href="/about"
                                    className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                                >
                                    {t('trustLinkAbout')}
                                </Link>
                                <span className="text-[var(--border)]">·</span>
                                <Link
                                    href="/explore/editions"
                                    className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                                >
                                    {t('trustLinkExplore')}
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* REVIEW MODAL                                                  */}
                {/* ============================================================ */}
                {selectedToken && (
                    <Modal onClose={() => setSelectedToken(null)}>
                        <h3 className="text-[24px] font-normal text-[var(--text-primary)] mb-6 leading-tight">
                            {t('review.title')}
                        </h3>
                        <form onSubmit={handleAddComment} className="space-y-5">
                            <div>
                                <label className="block text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                    {t('review.ratingLabel')}
                                </label>
                                <select
                                    value={rating}
                                    onChange={e => setRating(Number(e.target.value))}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors cursor-pointer"
                                    required
                                >
                                    <option value={5}>{t('review.rating5')}</option>
                                    <option value={4}>{t('review.rating4')}</option>
                                    <option value={3}>{t('review.rating3')}</option>
                                    <option value={2}>{t('review.rating2')}</option>
                                    <option value={1}>{t('review.rating1')}</option>
                                    <option value={0}>{t('review.rating0')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                    {t('review.commentLabel')}
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    minLength={5}
                                    maxLength={500}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors min-h-[100px]"
                                    required
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedToken(null)}
                                    className="flex-1 bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--border)] hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer"
                                >
                                    {t('review.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingStates.commenting}
                                    className="flex-1 bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                >
                                    {loadingStates.commenting ? t('review.submitting') : t('review.submit')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}

                {/* ============================================================ */}
                {/* TRANSFER MODAL                                                */}
                {/* ============================================================ */}
                {transferToken && (
                    <Modal onClose={closeTransferModal}>
                        {transferStep === 'form' ? (
                            <>
                                <h3 className="text-[24px] font-normal text-[var(--text-primary)] mb-1 leading-tight">
                                    {t('transfer.title')}
                                </h3>
                                <p className="text-[13px] font-light italic text-[var(--text-secondary)] mb-6">
                                    {transferToken.title}
                                </p>
                                <form onSubmit={handleTransferPreview} className="space-y-5">
                                    <div>
                                        <label className="block text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                            {t('transfer.recipientLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            value={recipientAddress}
                                            onChange={e => {
                                                setRecipientAddress(e.target.value);
                                                setRecipientError('');
                                            }}
                                            placeholder={t('transfer.recipientPlaceholder')}
                                            className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                            required
                                        />
                                        {recipientError && (
                                            <p className="mt-2 text-[12px] text-[#dc2626]">{recipientError}</p>
                                        )}
                                    </div>
                                    {transferToken.balance > 1n && (
                                        <div>
                                            <label className="block text-[11px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                                {t('transfer.amountLabel')}
                                            </label>
                                            <input
                                                type="number"
                                                value={transferAmount}
                                                onChange={e => setTransferAmount(Math.min(Number(e.target.value), Number(transferToken.balance)))}
                                                min={1}
                                                max={Number(transferToken.balance)}
                                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                                required
                                            />
                                            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                                                {t('transfer.youHave', { count: Number(transferToken.balance) })}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={closeTransferModal}
                                            className="flex-1 bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--border)] hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer"
                                        >
                                            {t('transfer.cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                        >
                                            {t('transfer.previewCta')} <span aria-hidden>→</span>
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <>
                                <h3 className="text-[24px] font-normal text-[var(--text-primary)] mb-6 leading-tight">
                                    {t('transfer.confirmTitle')}
                                </h3>
                                <div className="border border-[var(--border)] bg-[var(--bg-page)] p-5 space-y-3 mb-6">
                                    <div>
                                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-0.5">
                                            {t('transfer.labelArtwork')}
                                        </p>
                                        <p className="text-[13px] text-[var(--text-primary)]">
                                            {transferToken.title} <span className="text-[var(--text-muted)]">#{transferToken.tokenId.toString()}</span>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-0.5">
                                            {t('transfer.labelCopies')}
                                        </p>
                                        <p className="text-[13px] text-[var(--text-primary)]">{transferAmount}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-0.5">
                                            {t('transfer.labelRecipient')}
                                        </p>
                                        <p className="text-[12px] font-mono text-[var(--text-primary)] break-all">{recipientAddress}</p>
                                    </div>
                                </div>
                                <p className="text-[12px] font-medium text-[#dc2626] mb-6 leading-[1.6]">
                                    {t('transfer.warning')}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTransferStep('form')}
                                        disabled={loadingStates.transferring}
                                        className="flex-1 bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--border)] hover:border-[var(--text-primary)] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                                    >
                                        {t('transfer.back')}
                                    </button>
                                    <button
                                        onClick={handleTransferConfirm}
                                        disabled={loadingStates.transferring}
                                        className="flex-[2] bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                    >
                                        {loadingStates.transferring ? t('transfer.submitting') : t('transfer.confirmCta')}
                                    </button>
                                </div>
                            </>
                        )}
                    </Modal>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// CollectionCard — single owned token displayed as a horizontal card
// =========================================================================

function CollectionCard({
    token,
    isOwnArtist,
    onReview,
    onTransfer,
}: {
    token: OwnedToken;
    isOwnArtist: boolean;
    onReview: () => void;
    onTransfer: () => void;
}) {
    const t = useTranslations('Collector');
    const [pageUrl, setPageUrl] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPageUrl(`${window.location.origin}/explore/edition/${token.tokenId.toString()}`);
        }
    }, [token.tokenId]);

    return (
        <article className="border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="flex flex-col md:flex-row">
                {/* ---- Image ---- */}
                <Link
                    href={`/explore/edition/${token.tokenId}`}
                    className="block md:w-56 flex-shrink-0 bg-[var(--border-soft)] aspect-[4/3] md:aspect-square overflow-hidden no-underline group"
                    aria-label={token.title}
                >
                    {token.image ? (
                        <img
                            src={token.image}
                            alt={token.title}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <img src="/logo-mona.svg" alt="" className="w-12 h-12 object-contain opacity-25 dark:invert" />
                        </div>
                    )}
                </Link>

                {/* ---- Info + actions ---- */}
                <div className="flex-1 p-6 flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-1">
                                {t('edition', { id: token.tokenId.toString() })}
                            </p>
                            <h2 className="text-[22px] font-normal text-[var(--text-primary)] leading-tight mb-1">
                                <Link
                                    href={`/explore/edition/${token.tokenId}`}
                                    className="hover:text-[var(--text-secondary)] no-underline transition-colors"
                                >
                                    {token.title}
                                </Link>
                            </h2>
                            <p className="text-[13px] italic text-[var(--text-secondary)]">
                                <Link
                                    href={`/explore/artist/${token.artist}`}
                                    className="hover:text-[var(--text-primary)] no-underline transition-colors"
                                >
                                    {t('byArtist', { artist: token.artistName })}
                                </Link>
                            </p>
                        </div>
                        {isOwnArtist && (
                            <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#4a5240] border border-[#4a5240] px-2 py-0.5 flex-shrink-0">
                                {t('ownCreationBadge')}
                            </span>
                        )}
                    </div>

                    <p className="text-[12px] font-light text-[var(--text-secondary)] mb-5">
                        {t('copiesLabel', { count: Number(token.balance) })}
                    </p>

                    {/* Actions */}
                    <div className="mt-auto flex flex-wrap gap-2">
                        <Link
                            href={`/explore/edition/${token.tokenId}`}
                            className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-on-inverse)] bg-[var(--bg-inverse)] border border-[var(--text-primary)] px-3.5 py-2 no-underline hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {t('viewDetailsCta')}
                        </Link>
                        {!isOwnArtist && (
                            <button
                                type="button"
                                onClick={onReview}
                                className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] bg-[var(--bg-page)] border border-[var(--border)] px-3.5 py-2 hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer"
                            >
                                {t('reviewCta')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onTransfer}
                            className="text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] bg-[var(--bg-page)] border border-[var(--border)] px-3.5 py-2 hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer"
                        >
                            {t('transferCta')}
                        </button>
                        <ShareMenu
                            data={{
                                pageUrl,
                                twitterText: t('shareSocialText', {
                                    title: token.title,
                                    artist: token.artistName,
                                    url: pageUrl,
                                }),
                                emailSubject: t('shareEmailSubject', {
                                    title: token.title,
                                    artist: token.artistName,
                                }),
                                emailBody: t('shareEmailBody', {
                                    title: token.title,
                                    artist: token.artistName,
                                    url: pageUrl,
                                }),
                            }}
                            labels={{
                                share: t('share'),
                                shareCopied: t('shareCopied'),
                                shareCopyLink: t('shareCopyLink'),
                                shareTwitter: t('shareTwitter'),
                                shareFacebook: t('shareFacebook'),
                                shareEmail: t('shareEmail'),
                            }}
                        />
                    </div>
                </div>
            </div>
        </article>
    );
}

// =========================================================================
// Empty states
// =========================================================================

function EmptyShell({ message }: { message: string }) {
    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
            <p className="italic text-[16px] text-[var(--text-secondary)] max-w-md mx-auto leading-[1.7]">
                {message}
            </p>
        </div>
    );
}

function EmptyCollection() {
    const t = useTranslations('Collector');
    return (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
            <img
                src="/logo-mona.svg"
                alt=""
                className="w-16 h-16 object-contain mx-auto mb-6 opacity-30 dark:invert"
            />
            <h2 className="text-[24px] font-normal text-[var(--text-primary)] mb-3">
                {t('emptyTitle')}
            </h2>
            <p className="text-[14px] font-light text-[var(--text-secondary)] max-w-md mx-auto leading-[1.7] mb-6">
                {t('empty')}
            </p>
            <Link
                href="/explore/editions"
                className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[var(--text-primary)] border border-[var(--border)] bg-[var(--bg-page)] px-4 py-2 no-underline hover:border-[var(--text-primary)] transition-all duration-200"
            >
                {t('emptyLinkExplore')} <span aria-hidden>→</span>
            </Link>
        </div>
    );
}

// =========================================================================
// Modal wrapper (shared between Review and Transfer)
// =========================================================================

function Modal({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose: () => void;
}) {
    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-[var(--bg-inverse)]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="border border-[var(--border)] bg-[var(--bg-card)] p-8 max-w-md w-full"
                onClick={e => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}
