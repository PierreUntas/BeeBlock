'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { encodeFunctionData, keccak256, parseAbiItem } from 'viem';
import { MerkleTree } from 'merkletreejs';
import { publicClient, getDeploymentBlock } from '@/lib/client';
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

    // On-chain enrichment per artist wallet — claims, unique collectors,
    // last activity timestamp. Built from a single TransferSingle log scan
    // covering the whole tokenization contract, then grouped client-side.
    interface PilotStats {
        totalClaims: number;
        recentClaims: number;       // last 7 days
        uniqueCollectors: number;
        lastActivityDate: Date | null;
    }
    const [pilotStatsMap, setPilotStatsMap] = useState<Map<string, PilotStats>>(new Map());
    const [isLoadingPilotStats, setIsLoadingPilotStats] = useState(false);
    const [pilotFilter, setPilotFilter] = useState<'all' | 'attention' | 'active' | 'dormant'>('all');

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

    /**
     * Aggregate on-chain claim activity per artist wallet. Done in one
     * RPC call by scanning all TransferSingle events from the tokenization
     * contract since deployment. Each event with from=artist represents
     * a single claim by a collector.
     *
     * Used to enrich the admin pilot dashboard with "real" activity data
     * the off-chain DB doesn't have (the DB tracks edition creations, not
     * collector claims).
     */
    const loadPilotStats = async () => {
        if (!publicClient) return;
        setIsLoadingPilotStats(true);
        try {
            const [transferLogs, latestBlock] = await Promise.all([
                publicClient.getLogs({
                    address: ARTWORK_TOKENIZATION_ADDRESS,
                    event: parseAbiItem('event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                }),
                publicClient.getBlock({ blockTag: 'latest' }),
            ]);

            const latestBlockNum = latestBlock.number;
            const latestTs = Number(latestBlock.timestamp);
            // Base average block time ≈ 2s. Close enough for relative
            // "X days ago" labels; not used for legal/financial calc.
            const BLOCK_SECONDS = 2;
            const SEVEN_DAYS = 7 * 86400;
            const cutoff7d = latestTs - SEVEN_DAYS;

            type Accum = {
                totalClaims: number;
                recentClaims: number;
                uniqueCollectors: Set<string>;
                lastBlock: bigint;
            };
            const accum = new Map<string, Accum>();

            for (const log of transferLogs) {
                const from = (log.args.from as string | undefined)?.toLowerCase();
                const to = (log.args.to as string | undefined)?.toLowerCase();
                const value = Number(log.args.value ?? 0n);
                const blockNum = log.blockNumber;
                if (!from || !to || from === to) continue;
                // Skip mints (from == zero address) — those are the artist
                // receiving their own initial supply, not collector claims.
                if (from === '0x0000000000000000000000000000000000000000') continue;

                const existing: Accum = accum.get(from) ?? {
                    totalClaims: 0,
                    recentClaims: 0,
                    uniqueCollectors: new Set<string>(),
                    lastBlock: 0n,
                };
                existing.totalClaims += value;
                existing.uniqueCollectors.add(to);
                if (blockNum !== null) {
                    if (blockNum > existing.lastBlock) existing.lastBlock = blockNum;
                    const approxTs = latestTs - Number(latestBlockNum - blockNum) * BLOCK_SECONDS;
                    if (approxTs >= cutoff7d) existing.recentClaims += value;
                }
                accum.set(from, existing);
            }

            const finalMap = new Map<string, PilotStats>();
            for (const [wallet, a] of accum.entries()) {
                let lastActivityDate: Date | null = null;
                if (a.lastBlock > 0n) {
                    const approxTs = latestTs - Number(latestBlockNum - a.lastBlock) * BLOCK_SECONDS;
                    lastActivityDate = new Date(approxTs * 1000);
                }
                finalMap.set(wallet, {
                    totalClaims: a.totalClaims,
                    recentClaims: a.recentClaims,
                    uniqueCollectors: a.uniqueCollectors.size,
                    lastActivityDate,
                });
            }

            setPilotStatsMap(finalMap);
        } catch (e) {
            console.error('Failed to load pilot stats:', e);
        } finally {
            setIsLoadingPilotStats(false);
        }
    };

    // Trigger on-chain enrichment once artists are loaded
    useEffect(() => {
        if (artists.length > 0) loadPilotStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artists.length]);

    /**
     * Compute the health bucket for an artist row based on subscription
     * state + recent on-chain activity. Used both to render the row badge
     * and to bucket-filter the list.
     */
    type HealthBucket = 'attention' | 'active' | 'dormant';
    const computeHealth = (a: ArtistRow, stats: PilotStats | undefined): HealthBucket => {
        // Past-due payment is always "attention" regardless of activity.
        if (a.status === 'past_due' || a.status === 'incomplete') return 'attention';

        // Atelier subscribers with no editions after 14 days → attention.
        const isAtelier = a.plan === 'atelier' && a.status === 'active';
        const ageMs = Date.now() - new Date(a.createdAt).getTime();
        const ageDays = ageMs / (24 * 3600 * 1000);
        if (isAtelier && a.editionsCount === 0 && ageDays > 14) return 'attention';

        // Recent on-chain activity = active.
        const last = stats?.lastActivityDate;
        if (last) {
            const sinceMs = Date.now() - last.getTime();
            const sinceDays = sinceMs / (24 * 3600 * 1000);
            if (sinceDays < 30) return 'active';
            return 'dormant';
        }

        // No on-chain activity yet. Recent signup → active; old → dormant.
        if (ageDays < 7) return 'active';
        if (ageDays > 30) return 'dormant';
        return 'active';
    };

    /** Format a date as "il y a 2j" / "il y a 3h" / "à l'instant". */
    const formatRelative = (date: Date | null): string => {
        if (!date) return '—';
        const sec = Math.max(0, (Date.now() - date.getTime()) / 1000);
        if (sec < 60) return "à l'instant";
        if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`;
        if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`;
        const days = Math.floor(sec / 86400);
        if (days < 30) return `il y a ${days} j`;
        const months = Math.floor(days / 30);
        if (months < 12) return `il y a ${months} mois`;
        return `il y a ${Math.floor(months / 12)} an${months >= 24 ? 's' : ''}`;
    };

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
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">Vérification des permissions…</p>
                </div>
            </div>
        );
    }

    if (!address) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[var(--text-muted)]">Veuillez connecter votre wallet</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[var(--text-muted)]">Accès refusé : vous n'êtes pas admin</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6 dark:invert"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight">
                        Gestion des <em className="italic text-[var(--text-secondary)]">Artistes</em>
                    </h1>
                </div>

                {/* Authorize an artist */}
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[var(--text-primary)] mb-5">
                        Autoriser un <em className="italic text-[var(--text-secondary)]">Artiste</em>
                    </h2>
                    <form onSubmit={handleAuthorizeArtist} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                Adresse de l'artiste
                            </label>
                            <input
                                type="text"
                                value={newArtistAddress}
                                onChange={(e) => setNewArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAuthorizingArtist}
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {isAuthorizingArtist ? 'Autorisation en cours…' : 'Autoriser Artiste'}
                        </button>
                    </form>
                </div>

                {/* Revoke an artist */}
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[var(--text-primary)] mb-5">
                        Révoquer un <em className="italic text-[var(--text-secondary)]">Artiste</em>
                    </h2>
                    <form onSubmit={handleRevokeArtist} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                Adresse de l'artiste
                            </label>
                            <input
                                type="text"
                                value={removeArtistAddress}
                                onChange={(e) => setRemoveArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isRevokingArtist}
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {isRevokingArtist ? 'Révocation en cours…' : 'Révoquer Artiste'}
                        </button>
                    </form>
                </div>

                {/* Check artist status */}
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[var(--text-primary)] mb-5">
                        Vérifier le <em className="italic text-[var(--text-secondary)]">Statut Artiste</em>
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                Adresse à vérifier
                            </label>
                            <input
                                type="text"
                                value={checkArtistAddress}
                                onChange={(e) => setCheckArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        {checkArtistAddress && isArtistAuthorized !== undefined && (
                            <div className="p-4 border border-[var(--border)] bg-[var(--bg-page)] text-[14px] font-light text-[var(--text-primary)]">
                                {isArtistAuthorized ? '✓ Cette adresse est autorisée comme artiste' : '✗ Cette adresse n\'est pas autorisée comme artiste'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Disable an edition */}
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <h2 className="text-[22px] font-normal text-[var(--text-primary)] mb-2">
                        Désactiver une <em className="italic text-[var(--text-secondary)]">Édition</em>
                    </h2>
                    <p className="text-[13px] font-light text-[var(--text-secondary)] mb-5 leading-[1.7]">
                        Désactive immédiatement tous les rachats de certificats pour cette édition. Les certificats déjà réclamés ne sont pas affectés. Utilisez cette action en cas de contenu inapproprié ou de compromission des QR codes.
                    </p>
                    <form onSubmit={handleDisableEdition} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                ID de l'édition
                            </label>
                            <input
                                type="number"
                                value={disableEditionId}
                                onChange={(e) => setDisableEditionId(e.target.value)}
                                placeholder="Ex: 1"
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                min="1"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isDisablingEdition}
                            className="w-full bg-[#dc2626] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#dc2626] disabled:opacity-50 hover:bg-[#b91c1c] transition-all duration-200"
                        >
                            {isDisablingEdition ? 'Désactivation en cours…' : 'Désactiver cette édition'}
                        </button>
                    </form>
                </div>

                {/* Replace Merkle root — full recovery flow */}
                <div className="border-2 border-[#d97706] bg-[#fffbeb] p-8 mb-px space-y-8">
                    <div>
                        <h2 className="text-[22px] font-normal text-[var(--text-primary)] mb-2">
                            Récupération après compromission des <em className="italic text-[var(--text-secondary)]">QR codes</em>
                        </h2>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">
                            Utilisez ce flux en cas de compromission des clés secrètes. Désactivez d'abord l'édition ci-dessus, puis suivez les étapes ci-dessous pour générer de nouvelles clés uniquement pour les certificats non encore réclamés et soumettre la nouvelle racine Merkle.
                        </p>
                    </div>

                    {/* Step 1 — Analyze */}
                    <div>
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">Étape 1 — Analyser l'édition</p>
                        <form onSubmit={handleAnalyzeEdition} className="flex gap-3">
                            <input
                                type="number"
                                value={recoveryEditionId}
                                onChange={(e) => { setRecoveryEditionId(e.target.value); setRecoveryRemainingCount(null); setRecoveryKeys([]); setRecoveryTree(null); }}
                                placeholder="ID de l'édition"
                                className="flex-1 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                min="1"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isAnalyzing}
                                className="bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 whitespace-nowrap"
                            >
                                {isAnalyzing ? 'Lecture…' : 'Analyser'}
                            </button>
                        </form>
                        {recoveryRemainingCount !== null && (
                            <div className="mt-3 p-4 border border-[var(--border)] bg-[var(--bg-card)] text-[13px] font-light text-[var(--text-primary)]">
                                <span className="font-medium">{recoveryRemainingCount}</span> certificat{recoveryRemainingCount > 1 ? 's' : ''} non réclamé{recoveryRemainingCount > 1 ? 's' : ''} — artiste : <span className="font-mono text-[11px]">{recoveryArtistAddress}</span>
                            </div>
                        )}
                    </div>

                    {/* Step 2 — Generate keys */}
                    {recoveryRemainingCount !== null && recoveryRemainingCount > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">Étape 2 — Générer de nouvelles clés secrètes</p>
                            <button
                                onClick={handleGenerateRecoveryKeys}
                                disabled={isGeneratingKeys}
                                className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                            >
                                {isGeneratingKeys ? 'Génération…' : `Générer ${recoveryRemainingCount} nouvelle${recoveryRemainingCount > 1 ? 's' : ''} clé${recoveryRemainingCount > 1 ? 's' : ''}`}
                            </button>
                            {recoveryKeys.length > 0 && (
                                <div className="mt-3 p-4 border border-[var(--border)] bg-[var(--bg-card)] space-y-2">
                                    <p className="text-[12px] font-light text-[var(--text-secondary)]">Nouvelle racine Merkle générée :</p>
                                    <p className="font-mono text-[11px] text-[var(--text-primary)] break-all">{replaceMerkleRoot}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3 — Download new keys */}
                    {recoveryKeys.length > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">Étape 3 — Télécharger les nouvelles clés</p>
                            <button
                                onClick={handleDownloadRecoveryKeys}
                                className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all duration-200"
                            >
                                Télécharger les nouvelles clés (CSV)
                            </button>
                            <p className="text-[11px] font-light text-[var(--text-muted)] mt-2">Redistribuez ces clés aux collectionneurs concernés avant de soumettre la nouvelle racine.</p>
                        </div>
                    )}

                    {/* Step 4 — Submit new root */}
                    {recoveryKeys.length > 0 && (
                        <div>
                            <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-3">Étape 4 — Soumettre la nouvelle racine Merkle</p>
                            <form onSubmit={handleReplaceMerkleRoot} className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">ID de l'édition</label>
                                    <input type="number" value={replaceEditionId} onChange={(e) => setReplaceEditionId(e.target.value)} placeholder="Ex: 1" className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors" min="1" required />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">Nouvelle racine Merkle (bytes32)</label>
                                    <input type="text" value={replaceMerkleRoot} onChange={(e) => setReplaceMerkleRoot(e.target.value)} placeholder="0x..." className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors" pattern="^0x[a-fA-F0-9]{64}$" required />
                                </div>
                                <button type="submit" disabled={isReplacingMerkleRoot} className="w-full bg-[#d97706] text-white font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#d97706] disabled:opacity-50 hover:bg-[#b45309] transition-all duration-200">
                                    {isReplacingMerkleRoot ? 'Soumission en cours…' : 'Soumettre et réactiver l\'édition'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Subscription comp — off-chain Atelier grant/revoke */}
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <h2 className="text-[22px] font-normal text-[var(--text-primary)] mb-2">
                        Offrir un <em className="italic text-[var(--text-secondary)]">abonnement Atelier</em>
                    </h2>
                    <p className="text-[13px] font-light text-[var(--text-secondary)] mb-5 leading-[1.7]">
                        Octroi off-chain d'un abonnement Atelier gratuit illimité à un artiste (typiquement pour les pilotes). Aucune transaction Stripe n'est créée. Pour révoquer un abonnement Stripe payant, l'artiste doit passer par son Customer Portal.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                Adresse du wallet artiste
                            </label>
                            <input
                                type="text"
                                value={compArtistAddress}
                                onChange={(e) => setCompArtistAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleGrantAtelier}
                                disabled={isGrantingAtelier || isRevokingAtelier || !compArtistAddress}
                                className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                            >
                                {isGrantingAtelier ? 'Octroi en cours…' : "Offrir l'Atelier"}
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeAtelier}
                                disabled={isGrantingAtelier || isRevokingAtelier || !compArtistAddress}
                                className="w-full bg-[var(--bg-page)] text-[var(--text-primary)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--border)] disabled:opacity-50 hover:border-[var(--text-primary)] transition-all duration-200"
                            >
                                {isRevokingAtelier ? 'Révocation…' : "Révoquer l'Atelier offert"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* =========================================================
                    OPS PILOT DASHBOARD — at-a-glance health of each artist,
                    backed by both off-chain DB (subscription, profile) and
                    on-chain enrichment (claims, collectors, last activity).
                ========================================================= */}
                {(() => {
                    // -------- Aggregate stats for top cards --------
                    const totalArtists = artists.length;
                    const totalEditions = artists.reduce((sum, a) => sum + a.editionsCount, 0);
                    let totalClaims = 0;
                    let recentClaims = 0;
                    let atelierCount = 0;
                    let attentionCount = 0;
                    const enriched = artists.map(a => {
                        const stats = pilotStatsMap.get(a.walletAddress.toLowerCase());
                        if (stats) {
                            totalClaims += stats.totalClaims;
                            recentClaims += stats.recentClaims;
                        }
                        if (a.plan === 'atelier' && a.status === 'active') atelierCount++;
                        const health = computeHealth(a, stats);
                        if (health === 'attention') attentionCount++;
                        return { artist: a, stats, health };
                    });

                    const filtered = enriched.filter(({ artist: a, health }) => {
                        if (pilotFilter !== 'all' && health !== pilotFilter) return false;
                        if (!artistsSearch) return true;
                        const q = artistsSearch.toLowerCase();
                        return (
                            a.walletAddress.toLowerCase().includes(q) ||
                            (a.email?.toLowerCase().includes(q) ?? false)
                        );
                    });

                    // Sort: attention first, then by last activity desc, then by signup desc
                    filtered.sort((a, b) => {
                        if (a.health === 'attention' && b.health !== 'attention') return -1;
                        if (b.health === 'attention' && a.health !== 'attention') return 1;
                        const aLast = a.stats?.lastActivityDate?.getTime() ?? 0;
                        const bLast = b.stats?.lastActivityDate?.getTime() ?? 0;
                        if (aLast !== bLast) return bLast - aLast;
                        return new Date(b.artist.createdAt).getTime() - new Date(a.artist.createdAt).getTime();
                    });

                    return (
                        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-[22px] font-normal text-[var(--text-primary)]">
                                        Pilotes <em className="italic text-[var(--text-secondary)]">en cours</em>
                                    </h2>
                                    <p className="text-[13px] font-light text-[var(--text-secondary)] mt-1">
                                        Vue ops : santé, activité, abonnements
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { loadArtists(); loadPilotStats(); }}
                                    disabled={isLoadingArtists || isLoadingPilotStats}
                                    className="text-[11px] font-medium tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--text-primary)] px-4 py-2 transition-all disabled:opacity-50"
                                >
                                    {(isLoadingArtists || isLoadingPilotStats) ? 'Chargement…' : '↻ Rafraîchir'}
                                </button>
                            </div>

                            {/* Top stats cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] mb-6">
                                <PilotStatCard label="Pilotes" value={totalArtists} />
                                <PilotStatCard label="Éditions totales" value={totalEditions} />
                                <PilotStatCard label="Claims (vie)" value={totalClaims} subtle={isLoadingPilotStats ? '…' : `${recentClaims} sur 7 j`} />
                                <PilotStatCard label="À surveiller" value={attentionCount} accent={attentionCount > 0 ? 'red' : 'neutral'} />
                            </div>

                            {/* Filters */}
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                                {([
                                    { key: 'all', label: `Tous (${enriched.length})` },
                                    { key: 'attention', label: `À surveiller (${enriched.filter(e => e.health === 'attention').length})` },
                                    { key: 'active', label: `Actifs (${enriched.filter(e => e.health === 'active').length})` },
                                    { key: 'dormant', label: `Dormants (${enriched.filter(e => e.health === 'dormant').length})` },
                                ] as const).map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setPilotFilter(opt.key)}
                                        className={`text-[11px] font-medium tracking-[0.06em] uppercase border px-3 py-1.5 transition-all ${
                                            pilotFilter === opt.key
                                                ? 'bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] border-[var(--text-primary)]'
                                                : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={artistsSearch}
                                onChange={(e) => setArtistsSearch(e.target.value)}
                                placeholder="Filtrer par adresse, email…"
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors mb-5"
                            />

                            {artists.length === 0 && !isLoadingArtists && (
                                <p className="text-[13px] italic text-[var(--text-muted)] text-center py-8">
                                    Aucun pilote inscrit pour l'instant.
                                </p>
                            )}

                            {filtered.length === 0 && artists.length > 0 && (
                                <p className="text-[13px] italic text-[var(--text-muted)] text-center py-8">
                                    Aucun pilote ne correspond à ce filtre.
                                </p>
                            )}

                            <div className="space-y-px">
                                {filtered.map(({ artist: a, stats, health }) => {
                                    const isAtelierActive = a.plan === 'atelier' && a.status === 'active';
                                    const isPastDue = a.status === 'past_due';
                                    const isCanceled = a.status === 'canceled';
                                    const isComp = isAtelierActive && !a.hasStripeSubscription;
                                    let planLabel = 'Découverte';
                                    let planClass = 'text-[var(--text-secondary)] border-[var(--border)]';
                                    if (isAtelierActive) {
                                        planLabel = isComp ? 'Atelier (offert)' : 'Atelier';
                                        planClass = 'text-[var(--text-primary)] border-[var(--text-primary)]';
                                    }
                                    if (isPastDue) {
                                        planLabel = 'Atelier (paiement échoué)';
                                        planClass = 'text-[#991b1b] border-[#dc2626]';
                                    }
                                    if (isCanceled) {
                                        planLabel = 'Atelier (annulé)';
                                        planClass = 'text-[var(--text-muted)] border-[var(--border)]';
                                    }

                                    const healthDot = health === 'attention' ? 'bg-[#dc2626]' : health === 'active' ? 'bg-[#4a5240]' : 'bg-[var(--border)]';
                                    const healthLabel = health === 'attention' ? 'À surveiller' : health === 'active' ? 'Actif' : 'Dormant';

                                    return (
                                        <div
                                            key={a.walletAddress}
                                            className="border border-[var(--border)] bg-[var(--bg-page)] p-4"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                                <div className="space-y-1.5 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span
                                                            className={`inline-block w-2 h-2 rounded-full ${healthDot}`}
                                                            title={healthLabel}
                                                            aria-label={healthLabel}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setCompArtistAddress(a.walletAddress)}
                                                            className="font-mono text-[12px] text-[var(--text-primary)] hover:underline cursor-pointer text-left"
                                                            title="Copier dans le champ de comp"
                                                        >
                                                            {a.walletAddress.slice(0, 10)}…{a.walletAddress.slice(-6)}
                                                        </button>
                                                        <span className={`inline-block text-[10px] font-medium tracking-[0.06em] uppercase border px-2 py-0.5 ${planClass}`}>
                                                            {planLabel}
                                                        </span>
                                                        {a.privacyAcceptedAt ? (
                                                            <span className="inline-block text-[10px] font-medium tracking-[0.06em] uppercase text-[#4a5240] border border-[#4a5240] px-2 py-0.5">
                                                                RGPD ✓
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block text-[10px] font-medium tracking-[0.06em] uppercase text-[var(--text-muted)] border border-[var(--border)] px-2 py-0.5">
                                                                RGPD —
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[12px] font-light text-[var(--text-secondary)] truncate">
                                                        {a.email || <em className="italic">email non renseigné</em>}
                                                    </p>
                                                    {/* On-chain activity line */}
                                                    <p className="text-[11px] font-light text-[var(--text-secondary)]">
                                                        <span className="text-[var(--text-primary)] font-medium">{a.editionsCount}</span> éd ·{' '}
                                                        <span className="text-[var(--text-primary)] font-medium">{stats?.totalClaims ?? (isLoadingPilotStats ? '…' : '0')}</span> claims ·{' '}
                                                        <span className="text-[var(--text-primary)] font-medium">{stats?.uniqueCollectors ?? (isLoadingPilotStats ? '…' : '0')}</span> collect.
                                                        {stats?.lastActivityDate && (
                                                            <> · dernier claim {formatRelative(stats.lastActivityDate)}</>
                                                        )}
                                                    </p>
                                                    {/* Quota / period info */}
                                                    <p className="text-[10px] font-light text-[var(--text-muted)]">
                                                        {a.plan === 'free' && `Quota Découverte : ${a.freeQuotaUsed}/5 — `}
                                                        {isAtelierActive && a.currentPeriodEnd && `Expire le ${new Date(a.currentPeriodEnd).toLocaleDateString('fr-FR')} — `}
                                                        Inscrit le {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>

                                                {/* Quick actions */}
                                                <div className="flex items-start gap-2 flex-wrap">
                                                    <a
                                                        href={`/explore/artist/${a.walletAddress}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.06em] uppercase text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] px-2.5 py-1.5 no-underline transition-all"
                                                    >
                                                        Profil ↗
                                                    </a>
                                                    {a.email && (
                                                        <a
                                                            href={`mailto:${a.email}?subject=${encodeURIComponent('Mona Editions — un message de Pierre')}`}
                                                            className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.06em] uppercase text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] px-2.5 py-1.5 no-underline transition-all"
                                                        >
                                                            Contacter →
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Footer mark */}
                <div className="flex justify-center mt-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-px h-12 bg-[var(--border)]" />
                        <span className=" italic text-[13px] text-[var(--text-muted)]">Mona Editions</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Stat card used in the ops pilot dashboard top row.
 * `accent="red"` switches the value color to red — used to flag the
 * "à surveiller" count when it's >0.
 */
function PilotStatCard({
    label,
    value,
    subtle,
    accent = 'neutral',
}: {
    label: string;
    value: number | string;
    subtle?: string;
    accent?: 'neutral' | 'red';
}) {
    const valueClass = accent === 'red' && Number(value) > 0
        ? 'text-[#dc2626]'
        : 'text-[var(--text-primary)]';
    return (
        <div className="bg-[var(--bg-card)] p-5">
            <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-2">
                {label}
            </p>
            <p className={`text-[clamp(24px,3vw,32px)] font-normal leading-none tracking-[-0.5px] ${valueClass}`}>
                {value}
            </p>
            {subtle && (
                <p className="text-[10px] font-light text-[var(--text-muted)] mt-2">{subtle}</p>
            )}
        </div>
    );
}