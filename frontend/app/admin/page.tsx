'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { encodeFunctionData, keccak256 } from 'viem';
import { MerkleTree } from 'merkletreejs';
import { publicClient } from '@/lib/client';
import { BASE_URL } from '@/config/constants';
import { downloadFile } from '@/app/utils/file';

export default function AdminPage() {
    const { address } = useAccount();
    const [newArtistAddress, setNewArtistAddress] = useState('');
    const [removeArtistAddress, setRemoveArtistAddress] = useState('');
    const [checkArtistAddress, setCheckArtistAddress] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
    const [isAuthorizingArtist, setIsAuthorizingArtist] = useState(false);
    const [isRevokingArtist, setIsRevokingArtist] = useState(false);
    const [disableEditionId, setDisableEditionId] = useState('');
    const [isDisablingEdition, setIsDisablingEdition] = useState(false);
    const [replaceEditionId, setReplaceEditionId] = useState('');
    const [replaceMerkleRoot, setReplaceMerkleRoot] = useState('');
    const [isReplacingMerkleRoot, setIsReplacingMerkleRoot] = useState(false);

    const [recoveryEditionId, setRecoveryEditionId] = useState('');
    const [recoveryRemainingCount, setRecoveryRemainingCount] = useState<number | null>(null);
    const [recoveryArtistAddress, setRecoveryArtistAddress] = useState('');
    const [recoveryKeys, setRecoveryKeys] = useState<string[]>([]);
    const [recoveryTree, setRecoveryTree] = useState<MerkleTree | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

    // Subscription comp section (off-chain Atelier grant/revoke)
    const [compArtistAddress, setCompArtistAddress] = useState('');
    const [isGrantingAtelier, setIsGrantingAtelier] = useState(false);
    const [isRevokingAtelier, setIsRevokingAtelier] = useState(false);

    // Artists dashboard
    interface ArtistRow {
        walletAddress: string;
        email: string | null;
        plan: 'free' | 'atelier';
        status: string;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        freeQuotaUsed: number;
        privacyAcceptedAt: string | null;
        createdAt: string;
        editionsCount: number;
        hasStripeSubscription: boolean;
    }
    const [artists, setArtists] = useState<ArtistRow[]>([]);
    const [isLoadingArtists, setIsLoadingArtists] = useState(false);
    const [artistsSearch, setArtistsSearch] = useState('');

    const router = useRouter();
    const { sendTransaction } = useSendTransaction();
    const { getAccessToken } = usePrivy();
    const { showAlert, showConfirm } = useModal();

    const { data: isAdminResult, isLoading: isLoadingAdmin } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'isAdmin',
        args: address ? [address] : undefined,
    });

    const { data: artistData } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: checkArtistAddress ? [checkArtistAddress as `0x${string}`] : undefined,
    });

    useEffect(() => {
        if (isAdminResult !== undefined) {
            setIsAdmin(isAdminResult as boolean);
            setIsCheckingAdmin(false);
        } else if (!isLoadingAdmin && isAdminResult !== undefined) {
            setIsCheckingAdmin(false);
        }
    }, [isAdminResult, isLoadingAdmin]);

    useEffect(() => {
        if (!isCheckingAdmin && !isLoadingAdmin && address && !isAdmin) {
            router.replace('/');
        }
    }, [isCheckingAdmin, isLoadingAdmin, address, isAdmin, router]);

const isArtistAuthorized = artistData ? (artistData as any).authorized : undefined;

    const handleAuthorizeArtist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newArtistAddress) return;

        setIsAuthorizingArtist(true);
        let transactionAttempted1 = false;
        try {
            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'authorizeArtist',
                args: [newArtistAddress as `0x${string}`, true],
            });

            transactionAttempted1 = true;
            const txResult1 = await sendTransaction(
                {
                    to: ARTWORK_REGISTRY_ADDRESS,
                    data: data,
                },
                {
                    sponsor: true,
                }
            );
            await publicClient.waitForTransactionReceipt({ hash: txResult1.hash });
            setNewArtistAddress('');
        } catch (error) {
            console.error('Error authorizing artist:', error);
            if (transactionAttempted1) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const artist = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtist', args: [newArtistAddress as `0x${string}`] }) as any;
                    if (artist.authorized) { setNewArtistAddress(''); return; }
                } catch {}
            }
        } finally {
            setIsAuthorizingArtist(false);
        }
    };

    const handleRevokeArtist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!removeArtistAddress) return;

        setIsRevokingArtist(true);
        let transactionAttempted2 = false;
        try {
            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'authorizeArtist',
                args: [removeArtistAddress as `0x${string}`, false],
            });

            transactionAttempted2 = true;
            const txResult2 = await sendTransaction(
                {
                    to: ARTWORK_REGISTRY_ADDRESS,
                    data: data,
                },
                {
                    sponsor: true,
                }
            );
            await publicClient.waitForTransactionReceipt({ hash: txResult2.hash });
            setRemoveArtistAddress('');
        } catch (error) {
            console.error('Error revoking artist:', error);
            if (transactionAttempted2) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const artist = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtist', args: [removeArtistAddress as `0x${string}`] }) as any;
                    if (!artist.authorized) { setRemoveArtistAddress(''); return; }
                } catch {}
            }
        } finally {
            setIsRevokingArtist(false);
        }
    };

    const loadArtists = async () => {
        setIsLoadingArtists(true);
        try {
            const token = await getAccessToken();
            const res = await fetch('/api/admin/artists', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'fetch_failed');
            setArtists(data.artists || []);
        } catch (err: any) {
            console.error('Failed to load artists:', err);
        } finally {
            setIsLoadingArtists(false);
        }
    };

    // Auto-load on first render when the user is confirmed as admin
    useEffect(() => {
        if (isAdmin) loadArtists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin]);

    const handleGrantAtelier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!compArtistAddress) return;
        const confirmed = await showConfirm(
            `Offrir un abonnement Atelier gratuit (illimité) à ${compArtistAddress.slice(0, 6)}…${compArtistAddress.slice(-4)} ?`,
        );
        if (!confirmed) return;
        setIsGrantingAtelier(true);
        try {
            const token = await getAccessToken();
            const res = await fetch('/api/admin/grant-atelier', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ walletAddress: compArtistAddress }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'request_failed');
            await showAlert('Abonnement Atelier offert avec succès.');
            setCompArtistAddress('');
            loadArtists();
        } catch (err: any) {
            await showAlert(`Erreur : ${err?.message || 'inconnue'}`);
        } finally {
            setIsGrantingAtelier(false);
        }
    };

    const handleRevokeAtelier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!compArtistAddress) return;
        const confirmed = await showConfirm(
            `Révoquer l'abonnement Atelier offert à ${compArtistAddress.slice(0, 6)}…${compArtistAddress.slice(-4)} ? L'artiste rebascule sur le palier Découverte.`,
        );
        if (!confirmed) return;
        setIsRevokingAtelier(true);
        try {
            const token = await getAccessToken();
            const res = await fetch('/api/admin/revoke-atelier', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ walletAddress: compArtistAddress }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.error === 'cannot_revoke_stripe_managed_subscription') {
                    throw new Error("Cet artiste a un abonnement Stripe actif — ne peut pas être révoqué depuis ici. Il doit annuler depuis son Customer Portal.");
                }
                throw new Error(data.error || 'request_failed');
            }
            await showAlert('Abonnement Atelier révoqué.');
            setCompArtistAddress('');
            loadArtists();
        } catch (err: any) {
            await showAlert(`Erreur : ${err?.message || 'inconnue'}`);
        } finally {
            setIsRevokingAtelier(false);
        }
    };

    const handleAnalyzeEdition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recoveryEditionId) return;
        setIsAnalyzing(true);
        setRecoveryRemainingCount(null);
        setRecoveryKeys([]);
        setRecoveryTree(null);
        try {
            const artistAddress = await publicClient.readContract({
                address: ARTWORK_TOKENIZATION_ADDRESS,
                abi: ARTWORK_TOKENIZATION_ABI,
                functionName: 'tokenArtist',
                args: [BigInt(recoveryEditionId)],
            }) as `0x${string}`;
            const remaining = await publicClient.readContract({
                address: ARTWORK_TOKENIZATION_ADDRESS,
                abi: ARTWORK_TOKENIZATION_ABI,
                functionName: 'balanceOf',
                args: [artistAddress, BigInt(recoveryEditionId)],
            }) as bigint;
            setRecoveryArtistAddress(artistAddress);
            setRecoveryRemainingCount(Number(remaining));
        } catch (error) {
            console.error('Error analyzing edition:', error);
            await showAlert('Impossible de lire l\'édition. Vérifiez l\'ID.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateRecoveryKeys = () => {
        if (recoveryRemainingCount === null || recoveryRemainingCount === 0) return;
        setIsGeneratingKeys(true);
        try {
            const keys: string[] = [];
            for (let i = 0; i < recoveryRemainingCount; i++) {
                const randomBytes = crypto.getRandomValues(new Uint8Array(32));
                keys.push(Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
            }
            const leaves = keys.map(key => {
                const innerHash = keccak256(`0x${Buffer.from(key).toString('hex')}` as `0x${string}`);
                return keccak256(innerHash);
            });
            const tree = new MerkleTree(leaves, (data: Buffer) => {
                const hex = `0x${data.toString('hex')}` as `0x${string}`;
                return Buffer.from(keccak256(hex).slice(2), 'hex');
            }, { sortPairs: true });
            const root = `0x${tree.getRoot().toString('hex')}`;
            setRecoveryKeys(keys);
            setRecoveryTree(tree);
            setReplaceEditionId(recoveryEditionId);
            setReplaceMerkleRoot(root);
        } finally {
            setIsGeneratingKeys(false);
        }
    };

    const handleDownloadRecoveryKeys = () => {
        if (!recoveryKeys.length || !recoveryTree || !recoveryEditionId) return;
        const rows = ['Index,Secret Key,Merkle Proof,Claim URL'];
        recoveryKeys.forEach((key, i) => {
            const innerHash = keccak256(`0x${Buffer.from(key).toString('hex')}` as `0x${string}`);
            const leaf = Buffer.from(keccak256(innerHash).slice(2), 'hex');
            const proof = recoveryTree.getProof(leaf).map((p: { data: Buffer }) => `0x${p.data.toString('hex')}`).join('|');
            const claimUrl = `${BASE_URL}/collector/claim?editionId=${recoveryEditionId}&secretKey=${key}&merkleProof=${encodeURIComponent(proof.replace(/\|/g, ','))}`;
            rows.push(`${i + 1},"${key}","${proof}","${claimUrl}"`);
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        downloadFile(url, `recovery-keys-edition-${recoveryEditionId}-${Date.now()}.csv`);
    };

    const handleDisableEdition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!disableEditionId) return;
        if (!(await showConfirm(`Désactiver l'édition #${disableEditionId} ? Aucun certificat ne pourra plus être réclamé.`))) return;

        setIsDisablingEdition(true);
        let transactionAttempted3 = false;
        try {
            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'disableEdition',
                args: [BigInt(disableEditionId)],
            });
            transactionAttempted3 = true;
            const txResult3 = await sendTransaction({ to: ARTWORK_REGISTRY_ADDRESS, data }, { sponsor: true });
            await publicClient.waitForTransactionReceipt({ hash: txResult3.hash });
            await showAlert(`Édition #${disableEditionId} désactivée.`);
            setDisableEditionId('');
        } catch (error) {
            console.error('Error disabling edition:', error);
            if (transactionAttempted3) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const edition = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtworkEdition', args: [BigInt(disableEditionId)] }) as any;
                    if (edition[2] === true) { await showAlert(`Édition #${disableEditionId} désactivée.`); setDisableEditionId(''); return; }
                } catch {}
            }
            await showAlert('Erreur lors de la désactivation.');
        } finally {
            setIsDisablingEdition(false);
        }
    };

    const handleReplaceMerkleRoot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replaceEditionId || !replaceMerkleRoot) return;
        if (!replaceMerkleRoot.startsWith('0x') || replaceMerkleRoot.length !== 66) {
            await showAlert('La racine Merkle doit être un hash bytes32 (0x suivi de 64 caractères hex).');
            return;
        }
        if (!(await showConfirm(`Remplacer la racine Merkle de l'édition #${replaceEditionId} ? Les anciennes clés secrètes seront invalidées et l'édition sera réactivée.`))) return;

        setIsReplacingMerkleRoot(true);
        let transactionAttempted4 = false;
        try {
            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'replaceEditionMerkleRoot',
                args: [BigInt(replaceEditionId), replaceMerkleRoot as `0x${string}`],
            });
            transactionAttempted4 = true;
            const txResult4 = await sendTransaction({ to: ARTWORK_REGISTRY_ADDRESS, data }, { sponsor: true });
            await publicClient.waitForTransactionReceipt({ hash: txResult4.hash });
            await showAlert(`Racine Merkle de l'édition #${replaceEditionId} remplacée. L'édition est réactivée.`);
            setReplaceEditionId('');
            setReplaceMerkleRoot('');
        } catch (error) {
            console.error('Error replacing merkle root:', error);
            if (transactionAttempted4) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const edition = await publicClient.readContract({ address: ARTWORK_REGISTRY_ADDRESS, abi: ARTWORK_REGISTRY_ABI, functionName: 'getArtworkEdition', args: [BigInt(replaceEditionId)] }) as any;
                    if (edition[1] === replaceMerkleRoot) { await showAlert(`Racine Merkle de l'édition #${replaceEditionId} remplacée. L'édition est réactivée.`); setReplaceEditionId(''); setReplaceMerkleRoot(''); return; }
                } catch {}
            }
            await showAlert('Erreur lors du remplacement.');
        } finally {
            setIsReplacingMerkleRoot(false);
        }
    };

    // Loading state while checking permissions
    if (isCheckingAdmin || isLoadingAdmin) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Vérification des permissions…</p>
                </div>
            </div>
        );
    }

    if (!address) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[#a8a29e]">Veuillez connecter votre wallet</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[#a8a29e]">Accès refusé : vous n'êtes pas admin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Gestion des <em className="italic text-[#78716c]">Artistes</em>
                    </h1>
                </div>

                {/* Authorize an artist */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        Autoriser un <em className="italic text-[#78716c]">Artiste</em>
                    </h2>
                    <form onSubmit={handleAuthorizeArtist} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Adresse de l'artiste
                            </label>
                            <input
                                type="text"
                                value={newArtistAddress}
                                onChange={(e) => setNewArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAuthorizingArtist}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                        >
                            {isAuthorizingArtist ? 'Autorisation en cours…' : 'Autoriser Artiste'}
                        </button>
                    </form>
                </div>

                {/* Revoke an artist */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        Révoquer un <em className="italic text-[#78716c]">Artiste</em>
                    </h2>
                    <form onSubmit={handleRevokeArtist} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Adresse de l'artiste
                            </label>
                            <input
                                type="text"
                                value={removeArtistAddress}
                                onChange={(e) => setRemoveArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isRevokingArtist}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                        >
                            {isRevokingArtist ? 'Révocation en cours…' : 'Révoquer Artiste'}
                        </button>
                    </form>
                </div>

                {/* Check artist status */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        Vérifier le <em className="italic text-[#78716c]">Statut Artiste</em>
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Adresse à vérifier
                            </label>
                            <input
                                type="text"
                                value={checkArtistAddress}
                                onChange={(e) => setCheckArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        {checkArtistAddress && isArtistAuthorized !== undefined && (
                            <div className="p-4 border border-[#d6d0c8] bg-[#f5f3ef] text-[14px] font-light text-[#1c1917]">
                                {isArtistAuthorized ? '✓ Cette adresse est autorisée comme artiste' : '✗ Cette adresse n\'est pas autorisée comme artiste'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Disable an edition */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className="text-[22px] font-normal text-[#1c1917] mb-2">
                        Désactiver une <em className="italic text-[#78716c]">Édition</em>
                    </h2>
                    <p className="text-[13px] font-light text-[#78716c] mb-5 leading-[1.7]">
                        Désactive immédiatement tous les rachats de certificats pour cette édition. Les certificats déjà réclamés ne sont pas affectés. Utilisez cette action en cas de contenu inapproprié ou de compromission des QR codes.
                    </p>
                    <form onSubmit={handleDisableEdition} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                ID de l'édition
                            </label>
                            <input
                                type="number"
                                value={disableEditionId}
                                onChange={(e) => setDisableEditionId(e.target.value)}
                                placeholder="Ex: 1"
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                min="1"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isDisablingEdition}
                            className="w-full bg-[#dc2626] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#dc2626] disabled:opacity-50 hover:bg-[#b91c1c] transition-all duration-200"
                        >
                            {isDisablingEdition ? 'Désactivation en cours…' : 'Désactiver cette édition'}
                        </button>
                    </form>
                </div>

                {/* Replace Merkle root — full recovery flow */}
                <div className="border-2 border-[#d97706] bg-[#fffbeb] p-8 mb-px space-y-8">
                    <div>
                        <h2 className="text-[22px] font-normal text-[#1c1917] mb-2">
                            Récupération après compromission des <em className="italic text-[#78716c]">QR codes</em>
                        </h2>
                        <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                            Utilisez ce flux en cas de compromission des clés secrètes. Désactivez d'abord l'édition ci-dessus, puis suivez les étapes ci-dessous pour générer de nouvelles clés uniquement pour les certificats non encore réclamés et soumettre la nouvelle racine Merkle.
                        </p>
                    </div>

                    {/* Step 1 — Analyze */}
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-3">Étape 1 — Analyser l'édition</p>
                        <form onSubmit={handleAnalyzeEdition} className="flex gap-3">
                            <input
                                type="number"
                                value={recoveryEditionId}
                                onChange={(e) => { setRecoveryEditionId(e.target.value); setRecoveryRemainingCount(null); setRecoveryKeys([]); setRecoveryTree(null); }}
                                placeholder="ID de l'édition"
                                className="flex-1 px-4 py-3 bg-white border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                min="1"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isAnalyzing}
                                className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200 whitespace-nowrap"
                            >
                                {isAnalyzing ? 'Lecture…' : 'Analyser'}
                            </button>
                        </form>
                        {recoveryRemainingCount !== null && (
                            <div className="mt-3 p-4 border border-[#d6d0c8] bg-white text-[13px] font-light text-[#1c1917]">
                                <span className="font-medium">{recoveryRemainingCount}</span> certificat{recoveryRemainingCount > 1 ? 's' : ''} non réclamé{recoveryRemainingCount > 1 ? 's' : ''} — artiste : <span className="font-mono text-[11px]">{recoveryArtistAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* Step 2 — Generate keys */}
                    {recoveryRemainingCount !== null && recoveryRemainingCount > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-3">Étape 2 — Générer de nouvelles clés secrètes</p>
                            <button
                                onClick={handleGenerateRecoveryKeys}
                                disabled={isGeneratingKeys}
                                className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                            >
                                {isGeneratingKeys ? 'Génération…' : `Générer ${recoveryRemainingCount} nouvelle${recoveryRemainingCount > 1 ? 's' : ''} clé${recoveryRemainingCount > 1 ? 's' : ''}`}
                            </button>
                            {recoveryKeys.length > 0 && (
                                <div className="mt-3 p-4 border border-[#d6d0c8] bg-white space-y-2">
                                    <p className="text-[12px] font-light text-[#78716c]">Nouvelle racine Merkle générée :</p>
                                    <p className="font-mono text-[11px] text-[#1c1917] break-all">{replaceMerkleRoot}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3 — Download new keys */}
                    {recoveryKeys.length > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-3">Étape 3 — Télécharger les nouvelles clés</p>
                            <button
                                onClick={handleDownloadRecoveryKeys}
                                className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] hover:bg-[#292524] transition-all duration-200"
                            >
                                Télécharger les nouvelles clés (CSV)
                            </button>
                            <p className="text-[11px] font-light text-[#a8a29e] mt-2">Redistribuez ces clés aux collectionneurs concernés avant de soumettre la nouvelle racine.</p>
                        </div>
                    )}

                    {/* Step 4 — Submit new root */}
                    {recoveryKeys.length > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-3">Étape 4 — Soumettre la nouvelle racine Merkle</p>
                            <form onSubmit={handleReplaceMerkleRoot} className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">ID de l'édition</label>
                                    <input type="number" value={replaceEditionId} onChange={(e) => setReplaceEditionId(e.target.value)} placeholder="Ex: 1" className="w-full px-4 py-3 bg-white border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors" min="1" required />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">Nouvelle racine Merkle (bytes32)</label>
                                    <input type="text" value={replaceMerkleRoot} onChange={(e) => setReplaceMerkleRoot(e.target.value)} placeholder="0x..." className="w-full px-4 py-3 bg-white border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors" pattern="^0x[a-fA-F0-9]{64}$" required />
                                </div>
                                <button type="submit" disabled={isReplacingMerkleRoot} className="w-full bg-[#d97706] text-white font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#d97706] disabled:opacity-50 hover:bg-[#b45309] transition-all duration-200">
                                    {isReplacingMerkleRoot ? 'Soumission en cours…' : 'Soumettre et réactiver l\'édition'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Subscription comp — off-chain Atelier grant/revoke */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className="text-[22px] font-normal text-[#1c1917] mb-2">
                        Offrir un <em className="italic text-[#78716c]">abonnement Atelier</em>
                    </h2>
                    <p className="text-[13px] font-light text-[#78716c] mb-5 leading-[1.7]">
                        Octroi off-chain d'un abonnement Atelier gratuit illimité à un artiste (typiquement pour les pilotes). Aucune transaction Stripe n'est créée. Pour révoquer un abonnement Stripe payant, l'artiste doit passer par son Customer Portal.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Adresse du wallet artiste
                            </label>
                            <input
                                type="text"
                                value={compArtistAddress}
                                onChange={(e) => setCompArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleGrantAtelier}
                                disabled={isGrantingAtelier || isRevokingAtelier || !compArtistAddress}
                                className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                            >
                                {isGrantingAtelier ? 'Octroi en cours…' : "Offrir l'Atelier"}
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeAtelier}
                                disabled={isGrantingAtelier || isRevokingAtelier || !compArtistAddress}
                                className="w-full bg-[#f5f3ef] text-[#1c1917] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#d6d0c8] disabled:opacity-50 hover:border-[#1c1917] transition-all duration-200"
                            >
                                {isRevokingAtelier ? 'Révocation…' : "Révoquer l'Atelier offert"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Artists dashboard */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
                        <div>
                            <h2 className="text-[22px] font-normal text-[#1c1917]">
                                Artistes <em className="italic text-[#78716c]">inscrits</em>
                            </h2>
                            <p className="text-[13px] font-light text-[#78716c] mt-1">
                                {artists.length} artiste{artists.length > 1 ? 's' : ''} en base — toutes plateformes confondues
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={loadArtists}
                            disabled={isLoadingArtists}
                            className="text-[11px] font-medium tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] border border-[#d6d0c8] hover:border-[#1c1917] px-4 py-2 transition-all"
                        >
                            {isLoadingArtists ? 'Chargement…' : '↻ Rafraîchir'}
                        </button>
                    </div>

                    <input
                        type="text"
                        value={artistsSearch}
                        onChange={(e) => setArtistsSearch(e.target.value)}
                        placeholder="Filtrer par adresse, email…"
                        className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors mb-5"
                    />

                    {artists.length === 0 && !isLoadingArtists && (
                        <p className="text-[13px] italic text-[#a8a29e] text-center py-8">
                            Aucun artiste inscrit pour l'instant.
                        </p>
                    )}

                    <div className="space-y-px">
                        {artists
                            .filter((a) => {
                                if (!artistsSearch) return true;
                                const q = artistsSearch.toLowerCase();
                                return (
                                    a.walletAddress.toLowerCase().includes(q) ||
                                    (a.email?.toLowerCase().includes(q) ?? false)
                                );
                            })
                            .map((a) => {
                                const isAtelierActive = a.plan === 'atelier' && a.status === 'active';
                                const isPastDue = a.status === 'past_due';
                                const isCanceled = a.status === 'canceled';
                                const isComp = isAtelierActive && !a.hasStripeSubscription;
                                let planLabel = 'Découverte';
                                let planClass = 'text-[#78716c] border-[#d6d0c8]';
                                if (isAtelierActive) {
                                    planLabel = isComp ? 'Atelier (offert)' : 'Atelier';
                                    planClass = 'text-[#1c1917] border-[#1c1917]';
                                }
                                if (isPastDue) {
                                    planLabel = 'Atelier (paiement échoué)';
                                    planClass = 'text-[#991b1b] border-[#dc2626]';
                                }
                                if (isCanceled) {
                                    planLabel = 'Atelier (annulé)';
                                    planClass = 'text-[#a8a29e] border-[#d6d0c8]';
                                }

                                return (
                                    <div
                                        key={a.walletAddress}
                                        className="border border-[#d6d0c8] bg-[#f5f3ef] p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3"
                                    >
                                        <div className="space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setCompArtistAddress(a.walletAddress)}
                                                    className="font-mono text-[12px] text-[#1c1917] hover:underline cursor-pointer text-left"
                                                    title="Copier dans le champ de comp"
                                                >
                                                    {a.walletAddress.slice(0, 10)}…{a.walletAddress.slice(-6)}
                                                </button>
                                                <span className={`inline-block text-[10px] font-medium tracking-[0.06em] uppercase border px-2 py-0.5 ${planClass}`}>
                                                    {planLabel}
                                                </span>
                                                {a.privacyAcceptedAt && (
                                                    <span className="inline-block text-[10px] font-medium tracking-[0.06em] uppercase text-[#4a5240] border border-[#4a5240] px-2 py-0.5">
                                                        RGPD ✓
                                                    </span>
                                                )}
                                                {!a.privacyAcceptedAt && (
                                                    <span className="inline-block text-[10px] font-medium tracking-[0.06em] uppercase text-[#a8a29e] border border-[#d6d0c8] px-2 py-0.5">
                                                        RGPD —
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[12px] font-light text-[#78716c] truncate">
                                                {a.email || <em className="italic">email non renseigné</em>}
                                            </p>
                                            <p className="text-[11px] font-light text-[#a8a29e]">
                                                {a.editionsCount} œuvre{a.editionsCount > 1 ? 's' : ''} certifiée{a.editionsCount > 1 ? 's' : ''}
                                                {a.plan === 'free' && ` · ${a.freeQuotaUsed}/5 quota Découverte`}
                                                {isAtelierActive && a.currentPeriodEnd && ` · expire le ${new Date(a.currentPeriodEnd).toLocaleDateString('fr-FR')}`}
                                            </p>
                                            <p className="text-[10px] font-light text-[#a8a29e]">
                                                Inscrit le {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Footer mark */}
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