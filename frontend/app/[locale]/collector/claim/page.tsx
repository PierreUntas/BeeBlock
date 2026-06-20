'use client';

/**
 * /collector/claim — the "magic moment" of Mona Editions.
 *
 * The collector scans a QR code on a physical artwork, lands here with
 * editionId+secretKey+merkleProof pre-filled in the URL, and walks
 * through 4 phases:
 *
 *   1. Loading: fetching artwork metadata + artist info to show *before*
 *      asking the user to claim. Makes the experience emotional, not
 *      transactional.
 *   2. Ready: artwork on display, big claim button, gentle copy.
 *   3. Claiming: the wallet signs and the tx mines; UI is contemplative,
 *      not anxious.
 *   4. Success: celebration of the new acquisition with share button and
 *      links to the collection / artwork page.
 *
 * Error cases (already-claimed, disabled, rejected, network) are mapped
 * to friendly human-readable messages — never the raw Solidity revert.
 *
 * Everything is read-only on-chain; the only mutation is the
 * claimCertificate call itself. URL parameters: editionId, secretKey,
 * merkleProof (comma-separated). Advanced fields stay accessible via a
 * toggle for the rare case where the QR didn't fully populate.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { encodeFunctionData } from 'viem';
import Link from 'next/link';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';

import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
    ARTWORK_TOKENIZATION_ADDRESS,
    ARTWORK_TOKENIZATION_ABI,
} from '@/config/contracts';
import { publicClient } from '@/lib/client';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import ShareMenu from '@/components/shared/ShareMenu';

// =========================================================================
// Types
// =========================================================================

interface ArtworkData {
    editionId: bigint;
    title: string;
    technique?: string;
    dimensions?: string;
    year?: number;
    image: string | null;
    disabled: boolean;
    artistAddress: `0x${string}` | null;
    artistName: string;
}

type Phase = 'idle' | 'claiming' | 'success' | 'error';

type ErrorCode =
    | 'already-claimed'
    | 'disabled'
    | 'rejected'
    | 'network'
    | 'tx-failed'
    | 'generic';

// =========================================================================
// Page entry — Suspense boundary for useSearchParams (App Router req.)
// =========================================================================

export default function ClaimTokenPage() {
    const t = useTranslations('Claim');
    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <Suspense fallback={<LoadingShell label={t('artworkLoading')} />}>
                <ClaimFlow />
            </Suspense>
        </div>
    );
}

// =========================================================================
// Main flow
// =========================================================================

function ClaimFlow() {
    const t = useTranslations('Claim');
    const params = useSearchParams();
    const { address } = useAccount();
    const { sendTransaction } = useSendTransaction();
    const { getAccessToken, ready: privyReady } = usePrivy();

    // ---------- URL-derived inputs ----------
    const editionIdParam = params.get('editionId') ?? '';
    const secretKeyParam = params.get('secretKey') ?? '';
    const merkleProofParam = params.get('merkleProof') ?? '';

    // ---------- Mutable input state (filled from URL by default) ----------
    const [editionId, setEditionId] = useState(editionIdParam);
    const [secretKey, setSecretKey] = useState(secretKeyParam);
    const [merkleProofInput, setMerkleProofInput] = useState(merkleProofParam);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // ---------- Artwork enrichment ----------
    const [artwork, setArtwork] = useState<ArtworkData | null>(null);
    const [artworkLoading, setArtworkLoading] = useState(true);
    const [artworkMissing, setArtworkMissing] = useState(false);

    // ---------- Flow phase ----------
    const [phase, setPhase] = useState<Phase>('idle');
    const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    // ---------- Sync URL params back into state (e.g. on QR rescan) ----------
    useEffect(() => {
        if (editionIdParam) setEditionId(editionIdParam);
        if (secretKeyParam) setSecretKey(secretKeyParam);
        if (merkleProofParam) setMerkleProofInput(merkleProofParam);
    }, [editionIdParam, secretKeyParam, merkleProofParam]);

    // ---------- Fetch artwork data on mount ----------
    useEffect(() => {
        if (!editionId) {
            setArtworkLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            setArtworkLoading(true);
            try {
                const data = await fetchArtworkData(editionId);
                if (!cancelled) {
                    setArtwork(data);
                    setArtworkMissing(false);
                }
            } catch (e) {
                console.error('Failed to load artwork for claim page:', e);
                if (!cancelled) setArtworkMissing(true);
            } finally {
                if (!cancelled) setArtworkLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [editionId]);

    // ---------- Post-claim email notification (best-effort) ----------
    const sendClaimNotification = useCallback(
        async (txHashStr: string) => {
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
                        editionId: Number(editionId),
                        txHash: txHashStr,
                        artworkTitle: artwork?.title ?? '',
                        artistName: artwork?.artistName ?? '',
                    }),
                });
            } catch (e) {
                console.warn('Claim notification failed (non-blocking):', e);
            }
        },
        [getAccessToken, editionId, artwork?.title, artwork?.artistName],
    );

    // ---------- Claim handler ----------
    const handleClaim = useCallback(async () => {
        if (!address || !editionId || !secretKey) return;
        setErrorCode(null);
        setPhase('claiming');
        let transactionAttempted = false;

        try {
            // Guard: refuse if edition was just disabled between page load
            // and click. We always re-read on submit since the artist could
            // have disabled in the meantime.
            const editionData = await publicClient.readContract({
                address: ARTWORK_REGISTRY_ADDRESS,
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'getArtworkEdition',
                args: [BigInt(editionId)],
            }) as readonly [string, string, boolean];
            if (editionData[2] === true) {
                setErrorCode('disabled');
                setPhase('error');
                return;
            }

            // Pre-flight: see if this key was already claimed by someone.
            // Cheaper than waiting for the contract to revert.
            try {
                const claimedAlready = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'isKeyClaimed',
                    args: [BigInt(editionId), secretKey],
                });
                if (claimedAlready) {
                    setErrorCode('already-claimed');
                    setPhase('error');
                    return;
                }
            } catch {
                // Non-blocking — proceed to the actual claim and let the
                // contract decide.
            }

            const merkleProof = merkleProofInput.trim()
                ? merkleProofInput.split(',').map(h => h.trim() as `0x${string}`)
                : [];

            // Simulate first to surface bad merkle proofs cleanly.
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
                { to: ARTWORK_REGISTRY_ADDRESS, data },
                { sponsor: true },
            );

            const receipt = await publicClient.waitForTransactionReceipt({
                hash: txResult.hash,
            });
            if (receipt.status !== 'success') {
                setErrorCode('tx-failed');
                setPhase('error');
                return;
            }

            setTxHash(txResult.hash);
            setPhase('success');
            void sendClaimNotification(txResult.hash);
        } catch (err: any) {
            console.error('Claim error:', err);

            // Privy sometimes throws even when the tx actually succeeded
            // (race between bundler relay and Privy's own UI). Re-check
            // on-chain before declaring failure.
            if (transactionAttempted && editionId && secretKey) {
                await new Promise(r => setTimeout(r, 4000));
                try {
                    const claimed = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'isKeyClaimed',
                        args: [BigInt(editionId), secretKey],
                    });
                    if (claimed) {
                        setPhase('success');
                        void sendClaimNotification('');
                        return;
                    }
                } catch {}
            }

            setErrorCode(mapError(err));
            setPhase('error');
        }
    }, [address, editionId, secretKey, merkleProofInput, sendTransaction, sendClaimNotification]);

    // =====================================================================
    // RENDER
    // =====================================================================

    // No editionId at all — broken QR or someone landed on the page directly
    if (!editionIdParam && !editionId) {
        return (
            <Shell>
                <EmptyState message={t('noEditionId')} />
                <TrustFooter t={t} />
            </Shell>
        );
    }

    // Loading the artwork
    if (artworkLoading) {
        return (
            <Shell>
                <LoadingShell label={t('artworkLoading')} />
            </Shell>
        );
    }

    // Edition data couldn't be fetched
    if (artworkMissing || !artwork) {
        return (
            <Shell>
                <EmptyState message={t('artworkNotFound')} />
                <TrustFooter t={t} />
            </Shell>
        );
    }

    // ---------- Phase: SUCCESS ----------
    if (phase === 'success') {
        return (
            <Shell>
                <SuccessView
                    artwork={artwork}
                    txHash={txHash}
                    onClaimAnother={() => {
                        setPhase('idle');
                        setErrorCode(null);
                        setTxHash(null);
                        setEditionId('');
                        setSecretKey('');
                        setMerkleProofInput('');
                    }}
                />
                <TrustFooter t={t} />
            </Shell>
        );
    }

    // ---------- Phase: CLAIMING ----------
    if (phase === 'claiming') {
        return (
            <Shell>
                <ClaimingView artwork={artwork} />
            </Shell>
        );
    }

    // ---------- Phase: ERROR ----------
    if (phase === 'error' && errorCode) {
        return (
            <Shell>
                <ErrorView
                    code={errorCode}
                    onRetry={() => {
                        setPhase('idle');
                        setErrorCode(null);
                    }}
                />
                <TrustFooter t={t} />
            </Shell>
        );
    }

    // ---------- Phase: IDLE (ready to claim) ----------
    return (
        <Shell>
            <ReadyView
                artwork={artwork}
                walletConnected={!!address && privyReady}
                onClaim={handleClaim}
            />
            <AdvancedFields
                visible={showAdvanced}
                onToggle={() => setShowAdvanced(v => !v)}
                editionId={editionId}
                setEditionId={setEditionId}
                secretKey={secretKey}
                setSecretKey={setSecretKey}
                merkleProof={merkleProofInput}
                setMerkleProof={setMerkleProofInput}
            />
            <TrustFooter t={t} />
        </Shell>
    );
}

// =========================================================================
// Data fetching helpers
// =========================================================================

/**
 * Fetch everything we need to display the artwork emotionally before the
 * claim: title, image, technique, artist name. Best-effort on each piece
 * — a missing IPFS image is OK, the page still works.
 */
async function fetchArtworkData(editionIdStr: string): Promise<ArtworkData> {
    const tokenId = BigInt(editionIdStr);

    // 1. Edition record + artist address in parallel.
    const [editionRecord, artistAddress] = await Promise.all([
        publicClient.readContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'getArtworkEdition',
            args: [tokenId],
        }) as Promise<readonly [string, string, boolean]>,
        publicClient.readContract({
            address: ARTWORK_TOKENIZATION_ADDRESS,
            abi: ARTWORK_TOKENIZATION_ABI,
            functionName: 'tokenArtist',
            args: [tokenId],
        }) as Promise<`0x${string}`>,
    ]);

    const [editionMetadataCid, , disabled] = editionRecord;

    // 2. IPFS edition metadata + artist on-chain record in parallel.
    const [editionIpfs, artistRecord] = await Promise.all([
        editionMetadataCid?.trim()
            ? getFromIPFSGateway(editionMetadataCid).catch(() => null)
            : Promise.resolve(null),
        artistAddress
            ? publicClient.readContract({
                address: ARTWORK_REGISTRY_ADDRESS,
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'getArtist',
                args: [artistAddress],
            }) as Promise<{ authorized: boolean; metadata: string }>
            : Promise.resolve(null),
    ]);

    // 3. Artist IPFS (best-effort).
    let artistName = '';
    if (artistRecord?.metadata?.trim()) {
        try {
            const artistIpfs = await getFromIPFSGateway(artistRecord.metadata);
            artistName = (artistIpfs as any)?.name?.trim() || '';
        } catch (e) {
            console.warn('Artist IPFS fetch failed:', e);
        }
    }

    return {
        editionId: tokenId,
        title: (editionIpfs as any)?.title?.trim() || '',
        technique: (editionIpfs as any)?.technique || undefined,
        dimensions: (editionIpfs as any)?.dimensions || undefined,
        year: (editionIpfs as any)?.year || undefined,
        image: (editionIpfs as any)?.images?.[0] ? ipfsToHttp((editionIpfs as any).images[0]) : null,
        disabled,
        artistAddress,
        artistName,
    };
}

/** Map a raw error to a friendly code. */
function mapError(err: any): ErrorCode {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        return 'rejected';
    }
    if (msg.includes('already claimed') || msg.includes('alreadyclaimed') || msg.includes('keyclaimed')) {
        return 'already-claimed';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        return 'network';
    }
    return 'generic';
}

// =========================================================================
// Shell + small views
// =========================================================================

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="max-w-3xl mx-auto px-6 pt-24 pb-20">{children}</div>
    );
}

function LoadingShell({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
            <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{label}</p>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
            <img
                src="/logo-mona.svg"
                alt=""
                className="w-16 h-16 object-contain mx-auto mb-6 opacity-50"
            />
            <p className="italic text-[18px] text-[#1c1917] leading-[1.6] max-w-md mx-auto">
                {message}
            </p>
        </div>
    );
}

// =========================================================================
// READY view — artwork shown, claim button below
// =========================================================================

function ReadyView({
    artwork,
    walletConnected,
    onClaim,
}: {
    artwork: ArtworkData;
    walletConnected: boolean;
    onClaim: () => void;
}) {
    const t = useTranslations('Claim');

    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px overflow-hidden">

            {/* ---- Artwork hero ---- */}
            {artwork.image && (
                <div className="w-full aspect-[4/3] bg-[#e7e3dc] overflow-hidden">
                    <img
                        src={artwork.image}
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* ---- Title + artist ---- */}
            <div className="p-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-6 h-px bg-[#d6d0c8]" />
                    <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                        {t('editionLabel', { id: artwork.editionId.toString() })}
                    </span>
                    <div className="w-6 h-px bg-[#d6d0c8]" />
                </div>
                <h1 className="text-[clamp(28px,4vw,42px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-2">
                    {artwork.title || '—'}
                </h1>
                {artwork.artistName && (
                    <p className="text-[15px] italic text-[#78716c] mb-1">
                        {t('byArtist', { artist: artwork.artistName })}
                    </p>
                )}
                {(artwork.technique || artwork.dimensions || artwork.year) && (
                    <p className="text-[12px] font-light text-[#a8a29e] mt-3">
                        {[artwork.technique, artwork.dimensions, artwork.year]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                )}
            </div>

            {/* ---- CTA ---- */}
            <div className="border-t border-[#e7e3dc] p-8 bg-[#ede9e3]">
                {walletConnected ? (
                    <>
                        <button
                            type="button"
                            onClick={onClaim}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[13px] tracking-[0.08em] py-4 px-8 border border-[#1c1917] uppercase hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                        >
                            {t('claimCta')}
                        </button>
                        <p className="text-[11px] font-light text-[#78716c] text-center mt-4 leading-[1.6]">
                            {t('claimHint')}
                        </p>
                    </>
                ) : (
                    <p className="text-[13px] font-light text-[#78716c] text-center leading-[1.7]">
                        {t('connectWallet')}
                    </p>
                )}
            </div>
        </div>
    );
}

// =========================================================================
// CLAIMING view — contemplative loading
// =========================================================================

function ClaimingView({ artwork }: { artwork: ArtworkData }) {
    const t = useTranslations('Claim');
    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
            {artwork.image && (
                <div className="w-32 h-32 mx-auto mb-8 overflow-hidden bg-[#e7e3dc]">
                    <img src={artwork.image} alt="" className="w-full h-full object-cover opacity-60" />
                </div>
            )}
            <div className="flex justify-center mb-6">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
            </div>
            <h2 className="text-[clamp(22px,3vw,28px)] font-normal text-[#1c1917] mb-3 tracking-[-0.5px]">
                {t('claimingTitle')}
            </h2>
            <p className="text-[13px] font-light text-[#78716c] leading-[1.7] max-w-md mx-auto">
                {t('claimingBody')}
            </p>
        </div>
    );
}

// =========================================================================
// SUCCESS view — celebration + share + CTAs
// =========================================================================

function SuccessView({
    artwork,
    txHash,
    onClaimAnother,
}: {
    artwork: ArtworkData;
    txHash: string | null;
    onClaimAnother: () => void;
}) {
    const t = useTranslations('Claim');

    // The shareable URL points to the *public* edition page, NOT the claim
    // page (which contains a secret key in its query string). Built from
    // window.location.origin so it works on prod, preview, and localhost.
    const [editionUrl, setEditionUrl] = useState('');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setEditionUrl(`${window.location.origin}/explore/edition/${artwork.editionId.toString()}`);
        }
    }, [artwork.editionId]);

    const artistName = artwork.artistName || '—';
    const successTitle = t('successTitle', { artist: artistName });

    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px overflow-hidden">

            {artwork.image && (
                <div className="w-full aspect-[4/3] bg-[#e7e3dc] overflow-hidden">
                    <img
                        src={artwork.image}
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <div className="p-10 text-center">
                <span className="inline-block text-[10px] font-medium tracking-[0.2em] uppercase text-[#4a5240] border border-[#4a5240] px-3 py-1 mb-6">
                    {t('successEyebrow')}
                </span>

                <h1 className="text-[clamp(26px,4vw,38px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-3">
                    {successTitle}
                </h1>

                <p className="text-[15px] italic text-[#78716c] mb-6">
                    « {artwork.title} »
                </p>

                <p className="text-[13px] font-light text-[#1c1917] leading-[1.7] max-w-md mx-auto mb-2">
                    {t('successBody')}
                </p>

                <p className="text-[11px] font-mono text-[#a8a29e] mb-8">
                    {t('successCertNumber', { id: artwork.editionId.toString() })}
                </p>

                {/* Share + primary CTAs */}
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                    <ShareMenu
                        data={{
                            pageUrl: editionUrl,
                            twitterText: t('shareSocialText', {
                                title: artwork.title || '—',
                                artist: artistName,
                                url: editionUrl,
                            }),
                            emailSubject: t('shareEmailSubject', {
                                title: artwork.title || '—',
                                artist: artistName,
                            }),
                            emailBody: t('shareEmailBody', {
                                title: artwork.title || '—',
                                artist: artistName,
                                url: editionUrl,
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
                        variant="inverted"
                    />
                    <Link
                        href={`/explore/edition/${artwork.editionId.toString()}`}
                        className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[#1c1917] border border-[#d6d0c8] bg-[#f5f3ef] px-4 py-2 no-underline hover:border-[#1c1917] transition-all duration-200"
                    >
                        {t('viewArtworkCta')}
                    </Link>
                    <Link
                        href="/collector"
                        className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] uppercase text-[#1c1917] border border-[#d6d0c8] bg-[#f5f3ef] px-4 py-2 no-underline hover:border-[#1c1917] transition-all duration-200"
                    >
                        {t('viewCollectionCta')}
                    </Link>
                </div>

                {/* Secondary links */}
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px]">
                    {txHash && (
                        <a
                            href={`https://basescan.org/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-light text-[#78716c] underline underline-offset-4 hover:text-[#1c1917] transition-colors"
                        >
                            {t('viewOnBasescan')} <span aria-hidden>↗</span>
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={onClaimAnother}
                        className="font-light text-[#78716c] underline underline-offset-4 hover:text-[#1c1917] transition-colors cursor-pointer"
                    >
                        {t('claimAnother')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// =========================================================================
// ERROR view — friendly message + retry
// =========================================================================

function ErrorView({ code, onRetry }: { code: ErrorCode; onRetry: () => void }) {
    const t = useTranslations('Claim');

    const messageKey: Record<ErrorCode, string> = {
        'already-claimed': 'errorAlreadyClaimed',
        'disabled': 'disabledEdition',
        'rejected': 'errorRejected',
        'network': 'errorNetwork',
        'tx-failed': 'txFailed',
        'generic': 'errorFriendly',
    };

    // Already-claimed and disabled are terminal — no retry button.
    const isTerminal = code === 'already-claimed' || code === 'disabled';

    return (
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 text-center">
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#a8a29e] mb-5">
                ●
            </p>
            <p className="text-[14px] font-light text-[#1c1917] leading-[1.7] max-w-md mx-auto mb-8">
                {t(messageKey[code])}
            </p>
            {!isTerminal && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-8 border border-[#1c1917] uppercase hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                >
                    {t('retry')}
                </button>
            )}
        </div>
    );
}

// =========================================================================
// ADVANCED fields — hidden by default, exposed for power users / debug
// =========================================================================

function AdvancedFields({
    visible,
    onToggle,
    editionId,
    setEditionId,
    secretKey,
    setSecretKey,
    merkleProof,
    setMerkleProof,
}: {
    visible: boolean;
    onToggle: () => void;
    editionId: string;
    setEditionId: (s: string) => void;
    secretKey: string;
    setSecretKey: (s: string) => void;
    merkleProof: string;
    setMerkleProof: (s: string) => void;
}) {
    const t = useTranslations('Claim');
    return (
        <div className="border border-[#d6d0c8] border-t-0 bg-[#fafaf8] p-6 mb-px">
            <button
                type="button"
                onClick={onToggle}
                className="text-[11px] font-normal tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] transition-colors underline cursor-pointer"
            >
                {visible ? t('hideAdvanced') : t('showAdvanced')}
            </button>

            {visible && (
                <div className="mt-6 space-y-5 pt-6 border-t border-[#e7e3dc]">
                    <Field
                        label={t('editionIdLabel')}
                        value={editionId}
                        onChange={setEditionId}
                        type="number"
                    />
                    <Field
                        label={t('secretKeyLabel')}
                        value={secretKey}
                        onChange={setSecretKey}
                    />
                    <Field
                        label={t('merkleProofLabel')}
                        value={merkleProof}
                        onChange={setMerkleProof}
                        textarea
                        hint={t('merkleProofHint')}
                    />
                </div>
            )}
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    type = 'text',
    textarea = false,
    hint,
}: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    type?: string;
    textarea?: boolean;
    hint?: string;
}) {
    return (
        <div>
            <label className="block text-[11px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                {label}
            </label>
            {textarea ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[12px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors font-mono min-h-[80px]"
                />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[12px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                />
            )}
            {hint && (
                <p className="text-[11px] text-[#a8a29e] mt-2 font-light">{hint}</p>
            )}
        </div>
    );
}

// =========================================================================
// TRUST footer — for the visitor landing here from a shared link
// =========================================================================

function TrustFooter({ t }: { t: ReturnType<typeof useTranslations> }) {
    return (
        <div className="mt-20 border-t border-[#d6d0c8] pt-12">
            <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                <img
                    src="/logo-mona.svg"
                    alt="Mona Editions"
                    className="w-24 h-12 object-contain opacity-60"
                />
                <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e]">
                    {t('trustTitle')}
                </p>
                <p className="text-[13px] font-light text-[#78716c] leading-[1.8]">
                    {t('trustBody')}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                    <Link
                        href="/about"
                        className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                    >
                        {t('trustLinkAbout')}
                    </Link>
                    <span className="text-[#d6d0c8]">·</span>
                    <Link
                        href="/collector"
                        className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                    >
                        {t('trustLinkCollection')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
