'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { BASE_URL, activeChain, activeRpcUrl } from '@/config/constants';
import { uploadToIPFS, uploadFileToIPFS } from '@/app/utils/ipfs';
import { base64ToBlob, downloadFile } from '@/app/utils/file';
import { CATEGORIES_EN, CATEGORIES_FR } from '@/app/utils/categories';
import { MerkleTree } from 'merkletreejs';
import { keccak256, encodeFunctionData, decodeEventLog, createPublicClient, http } from 'viem';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { useSubscription, incrementEdition } from '@/app/hooks/useSubscription';
import SubscriptionGate, { QuotaBadge } from '@/components/shared/SubscriptionGate';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// Utility function

const getMerkleProofForKey = (key: string, merkleTree: MerkleTree): string => {
    const innerHash = keccak256(`0x${Buffer.from(key).toString('hex')}`);
    const leaf = keccak256(innerHash);
    const proof = merkleTree.getHexProof(leaf);
    return proof.join(',');
};

export default function CreateEditionPage() {
    const t = useTranslations('Create');
    const { address } = useAccount();
    const { user, getAccessToken } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;
    const { snapshot: subscription, refresh: refreshSubscription } = useSubscription();
    const [amount, setAmount] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
    const [isApproved, setIsApproved] = useState(false);
    
    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        approving: false,
        uploading: false,
        uploadingImage: false,
        creating: false,
        generatingQR: false,
    });
    
    const [secretKeys, setSecretKeys] = useState<string[]>([]);
    const [merkleRoot, setMerkleRoot] = useState<string>('');
    const [merkleTree, setMerkleTree] = useState<MerkleTree | null>(null);
    const [createdEditionId, setCreatedEditionId] = useState<string | null>(null);
    const [hasDownloadedKeys, setHasDownloadedKeys] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();

    const [editionData, setEditionData] = useState({
        title: '',
        year: new Date().getFullYear(),
        description: '',
        technique: '',
        dimensions: '',
        images: [] as string[],
        editionSize: 0,
        category: ''
    });

    // Auto-resize the Technique textarea to match its content. Keeps the
    // field visually compact at rest (rows=1) but lets it grow as the user
    // types longer entries, instead of stretching to a tall fixed height.
    const techniqueRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const el = techniqueRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [editionData.technique]);

    const { data: artistData, isLoading: isLoadingArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    const { data: approvalStatus, refetch: refetchApproval } = useReadContract({
        address: ARTWORK_TOKENIZATION_ADDRESS,
        abi: ARTWORK_TOKENIZATION_ABI,
        functionName: 'isApprovedForAll',
        args: activeAddress ? [activeAddress, ARTWORK_REGISTRY_ADDRESS] : undefined,
    });
    useEffect(() => {
        if (artistData) {
            const artist = artistData as any;
            setIsAuthorized(artist.authorized);
            setIsCheckingAuthorization(false);
        } else if (!isLoadingArtist && artistData !== undefined) {
            setIsCheckingAuthorization(false);
        }
    }, [artistData, isLoadingArtist]);

    useEffect(() => {
        if (approvalStatus !== undefined) {
            setIsApproved(approvalStatus as boolean);
        }
    }, [approvalStatus]);

    // Warn the user if they try to leave without downloading the keys
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (createdEditionId && secretKeys.length > 0 && !hasDownloadedKeys) {
                e.preventDefault();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [createdEditionId, secretKeys, hasDownloadedKeys]);

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
            if (count > 100) {
                showAlert(t('alerts.maxEditionSize'));
                setAmount('');
                setSecretKeys([]);
                setMerkleRoot('');
                setMerkleTree(null);
                setEditionData(prev => ({ ...prev, editionSize: 0 }));
            } else if (count > 0 && count <= 100) {
                const keys = generateSecretKeys(count);
                setSecretKeys(keys);
                setEditionData(prev => ({ ...prev, editionSize: count }));

                const leaves = keys.map(key => {
                    const innerHash = keccak256(`0x${Buffer.from(key).toString('hex')}`);
                    return keccak256(innerHash);
                });
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
                setMerkleTree(tree);
                setMerkleRoot(tree.getHexRoot());
            }
        } else {
            setSecretKeys([]);
            setMerkleRoot('');
            setMerkleTree(null);
            setEditionData(prev => ({ ...prev, editionSize: 0 }));
        }
    };

    // Upload one or several images to IPFS and add their CIDs to editionData.images
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const oversized = files.filter(f => f.size > 20 * 1024 * 1024);
        if (oversized.length > 0) {
            await showAlert(t('alerts.photosTooLargeError', {
                count: oversized.length,
                names: oversized.map(f => f.name).join(', '),
            }));
            return;
        }

        setLoadingStates(prev => ({ ...prev, uploadingImage: true }));
        try {
            const newCids: string[] = [];
            for (const file of files) {
                const cid = await uploadFileToIPFS(file);
                newCids.push(`ipfs://${cid}`);
            }
            setEditionData(prev => {
                const updated = { ...prev, images: [...prev.images, ...newCids] };
                console.log('Images uploadées:', updated.images.length);
                return updated;
            });
            await showAlert(t('alerts.imagesUploadedSuccess', { count: newCids.length }));
        } catch (error) {
            console.error('Error uploading image:', error);
            await showAlert(t('alerts.imageUploadError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, uploadingImage: false }));
            // Reset input so the same file can be re-selected if needed
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setEditionData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const generateQRCodeImage = async (text: string): Promise<string> => {
        return QRCode.toDataURL(text, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
    };

    const downloadEditionPageQRCode = async () => {
        if (!createdEditionId || createdEditionId === 'pending' || createdEditionId === 'confirmed') return;
        setLoadingStates(prev => ({ ...prev, generatingQR: true }));
        try {
            const editionPageUrl = `${BASE_URL}/explore/edition/${createdEditionId}`;
            const qrCodeDataUrl = await QRCode.toDataURL(editionPageUrl, {
                width: 1000, margin: 4,
                color: { dark: '#000000', light: '#FFFFFF' },
                errorCorrectionLevel: 'H'
            });
            const base64Data = qrCodeDataUrl.split(',')[1];
            const blob = base64ToBlob(base64Data);
            const url = URL.createObjectURL(blob);
            downloadFile(url, `QR_Edition_Page_${createdEditionId}.png`);
            await showAlert(t('alerts.qrPageDownloadedSuccess'));
        } catch (error) {
            console.error('Error generating edition page QR code:', error);
            await showAlert(t('alerts.qrPageError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, generatingQR: false }));
        }
    };

    const downloadExcelWithQRCodes = async () => {
        if (secretKeys.length === 0 || !merkleTree || !createdEditionId) return;
        setLoadingStates(prev => ({ ...prev, generatingQR: true }));
        try {
            const excelData = [];
            for (let index = 0; index < secretKeys.length; index++) {
                const key = secretKeys[index];
                const merkleProofParam = getMerkleProofForKey(key, merkleTree);
                const claimUrl = `${BASE_URL}/collector/claim?editionId=${createdEditionId}&secretKey=${key}&merkleProof=${encodeURIComponent(merkleProofParam)}`;
                const qrCodeDataUrl = await generateQRCodeImage(claimUrl);
                excelData.push({
                    'Index': index + 1,
                    'Secret Key': key,
                    'Merkle Proof': merkleProofParam,
                    'Claim URL': claimUrl,
                    'QR Code': qrCodeDataUrl
                });
                if ((index + 1) % 10 === 0 || index === secretKeys.length - 1) {
                    console.log(`Génération des QR codes: ${index + 1}/${secretKeys.length}`);
                }
            }
            const ws = XLSX.utils.json_to_sheet(excelData);
            ws['!cols'] = [{ wch: 8 }, { wch: 65 }, { wch: 50 }, { wch: 80 }, { wch: 40 }];
            const rowHeights = [{ hpx: 20 }];
            for (let i = 0; i < excelData.length; i++) rowHeights.push({ hpx: 150 });
            ws['!rows'] = rowHeights;
            if (!ws['!images']) ws['!images'] = [];
            for (let i = 0; i < excelData.length; i++) {
                const qrCodeBase64 = excelData[i]['QR Code'].split(',')[1];
                ws['!images'].push({
                    name: `qr_${i + 1}.png`,
                    data: qrCodeBase64,
                    opts: { positioning: { type: 'oneCellAnchor', from: { col: 4, row: i + 1 } } }
                });
            }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Secret Keys');
            XLSX.writeFile(wb, `secret-keys-edition-${createdEditionId}-${Date.now()}.xlsx`);
            setHasDownloadedKeys(true); // Mark as downloaded
            await showAlert(t('alerts.excelSuccess', { count: secretKeys.length }));
        } catch (error) {
            console.error('Error generating Excel with QR codes:', error);
            await showAlert(t('alerts.excelError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, generatingQR: false }));
        }
    };

    const downloadQRCodesZip = async () => {
        if (secretKeys.length === 0 || !merkleTree || !createdEditionId) return;
        setLoadingStates(prev => ({ ...prev, generatingQR: true }));
        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            for (let index = 0; index < secretKeys.length; index++) {
                const key = secretKeys[index];
                const merkleProofParam = getMerkleProofForKey(key, merkleTree);
                const claimUrl = `${BASE_URL}/collector/claim?editionId=${createdEditionId}&secretKey=${key}&merkleProof=${merkleProofParam}`;
                const qrCodeDataUrl = await generateQRCodeImage(claimUrl);
                const base64Data = qrCodeDataUrl.split(',')[1];
                zip.file(`QR_Claim_${createdEditionId}_${(index + 1).toString().padStart(5, '0')}.png`, base64Data, { base64: true });
                if ((index + 1) % 10 === 0 || index === secretKeys.length - 1) {
                    console.log(`Génération des QR codes: ${index + 1}/${secretKeys.length}`);
                }
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            downloadFile(url, `qr-codes-claim-edition-${createdEditionId}-${Date.now()}.zip`);
            setHasDownloadedKeys(true); // Mark as downloaded
            await showAlert(t('alerts.qrZipSuccess', { count: secretKeys.length }));
        } catch (error) {
            console.error('Error generating QR codes:', error);
            await showAlert(t('alerts.qrZipError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, generatingQR: false }));
        }
    };

    const handleApprove = async () => {
        const publicClientInstance = createPublicClient({ chain: activeChain, transport: http(activeRpcUrl) });
        let transactionAttempted = false;
        try {
            setLoadingStates(prev => ({ ...prev, approving: true }));
            const data = encodeFunctionData({
                abi: ARTWORK_TOKENIZATION_ABI,
                functionName: 'setApprovalForAll',
                args: [ARTWORK_REGISTRY_ADDRESS, true]
            });
            transactionAttempted = true;
            const txResult = await sendTransaction({ to: ARTWORK_TOKENIZATION_ADDRESS, data }, { sponsor: true });
            await publicClientInstance.waitForTransactionReceipt({ hash: txResult.hash });
            await refetchApproval();
            setLoadingStates(prev => ({ ...prev, approving: false }));
        } catch (error) {
            console.error('Error during approval:', error);
            if (transactionAttempted && activeAddress) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const approved = await publicClientInstance.readContract({
                        address: ARTWORK_TOKENIZATION_ADDRESS,
                        abi: ARTWORK_TOKENIZATION_ABI,
                        functionName: 'isApprovedForAll',
                        args: [activeAddress, ARTWORK_REGISTRY_ADDRESS],
                    });
                    if (approved) { await refetchApproval(); setLoadingStates(prev => ({ ...prev, approving: false })); return; }
                } catch {}
            }
            await showAlert(t('alerts.approveError'));
            setLoadingStates(prev => ({ ...prev, approving: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editionData.title || !amount || !merkleRoot) {
            await showAlert(t('alerts.missingFields'));
            return;
        }
        if (editionData.images.length === 0) {
            await showAlert(t('alerts.missingImage'));
            return;
        }
        if (!isApproved) {
            await showAlert(t('alerts.mustApproveFirst'));
            return;
        }

        setLoadingStates(prev => ({ ...prev, uploading: true }));
        let transactionAttempted = false;
        const publicClientInstance = createPublicClient({ chain: activeChain, transport: http(activeRpcUrl) });
        try {
            const artworkMetadata: {
                name: string;
                image: string;
                title: string;
                year: number;
                description: string;
                technique: string;
                dimensions: string;
                images: string[];
                editionSize: number;
                category: string;
            } = {
                name: editionData.title,
                image: editionData.images[0] ?? '',
                title: editionData.title,
                year: editionData.year,
                description: editionData.description,
                technique: editionData.technique,
                dimensions: editionData.dimensions,
                images: editionData.images,
                editionSize: parseInt(amount),
                category: editionData.category,
            };

            const cid = await uploadToIPFS(artworkMetadata);

            setLoadingStates(prev => ({ ...prev, uploading: false, creating: true }));

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'createArtworkEdition',
                args: [cid, BigInt(amount), merkleRoot as `0x${string}`]
            });

            transactionAttempted = true;
            const txHash = await sendTransaction(
                { to: ARTWORK_REGISTRY_ADDRESS, data },
                { sponsor: true }
            );

            const receipt = await publicClientInstance.waitForTransactionReceipt({
                hash: txHash.hash as `0x${string}`,
            });

            const editionCreatedEvent = receipt.logs.find(log => {
                try {
                    const decoded = decodeEventLog({ abi: ARTWORK_REGISTRY_ABI, data: log.data, topics: log.topics });
                    return decoded.eventName === 'NewArtworkEdition';
                } catch { return false; }
            });

            if (editionCreatedEvent) {
                const decoded = decodeEventLog({
                    abi: ARTWORK_REGISTRY_ABI,
                    data: editionCreatedEvent.data,
                    topics: editionCreatedEvent.topics,
                }) as any;
                const editionId = decoded.args.editionId?.toString();
                setCreatedEditionId(editionId);
                // Record the edition off-chain for quota tracking (fire and forget)
                try {
                    await incrementEdition(getAccessToken, BigInt(editionId), txHash.hash);
                    await refreshSubscription();
                } catch (e) {
                    console.warn('Failed to increment subscription counter:', e);
                }
                await showAlert(t('alerts.createSuccess', { id: editionId }));
            } else {
                console.error('NewArtworkEdition event not found in logs');
                await showAlert(t('alerts.createSuccessNoId'));
                setCreatedEditionId('confirmed');
            }
        } catch (error) {
            console.error('Error creating artwork:', error);
            if (transactionAttempted && activeAddress) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const logs = await publicClientInstance.getLogs({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        event: { type: 'event', name: 'NewArtworkEdition', inputs: [{ type: 'address', name: 'artist', indexed: true }, { type: 'uint256', name: 'editionId', indexed: true }] } as any,
                        args: { artist: activeAddress },
                        fromBlock: BigInt(Math.max(0, Number(await publicClientInstance.getBlockNumber()) - 5)),
                        toBlock: 'latest',
                    });
                    if (logs.length > 0) {
                        const editionId = (logs[logs.length - 1] as any).args?.editionId?.toString();
                        setCreatedEditionId(editionId);
                        try {
                            await incrementEdition(getAccessToken, BigInt(editionId));
                            await refreshSubscription();
                        } catch (e) {
                            console.warn('Failed to increment subscription counter:', e);
                        }
                        await showAlert(t('alerts.createSuccess', { id: editionId }));
                        return;
                    }
                } catch {}
            }
            await showAlert(t('alerts.createError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false, creating: false }));
        }
    };

    if (isCheckingAuthorization || isLoadingArtist) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[var(--text-muted)] tracking-[0.06em]">{t('checkingPermissions')}</p>
                </div>
            </div>
        );
    }

    if (!address) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[18px] text-[var(--text-muted)] text-center max-w-md px-6">{t('notConnected')}</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[18px] text-[var(--text-muted)] text-center max-w-md px-6">
                        {t('notAuthorized')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">

                {isAuthorized && !isApproved && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-6 mb-px">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">{t('actionRequired')}</p>
                                <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.6]">{t('approveBannerBody')}</p>
                            </div>
                            <button
                                onClick={handleApprove}
                                disabled={loadingStates.approving}
                                className="bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3 px-6 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 whitespace-nowrap cursor-pointer"
                            >
                                {loadingStates.approving ? t('approveInProgress') : t('approveCta')}
                            </button>
                        </div>
                    </div>
                )}

                {createdEditionId && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-6 mb-px">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">{t('successBannerTitle')}</p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)]">
                            {t('successBannerIdLabel')} <span className="font-mono">{createdEditionId}</span>
                        </p>
                        {!hasDownloadedKeys && (
                            <p className="text-[14px] font-medium text-[#dc2626] mt-3 leading-[1.7]">
                                {t('successBannerWarning')}
                            </p>
                        )}
                        {hasDownloadedKeys && (
                            <p className="text-[13px] font-light text-[#16a34a] mt-2">
                                {t('successBannerDownloaded')}
                            </p>
                        )}
                    </div>
                )}

                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions Logo"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6 dark:invert"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[var(--text-primary)] leading-tight">
                        {t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em>
                    </h1>
                </div>

                {subscription && subscription.remainingQuota > 0 && (
                    <div className="mb-px">
                        <QuotaBadge snapshot={subscription} />
                    </div>
                )}

                {subscription && subscription.remainingQuota === 0 && !createdEditionId ? (
                    <SubscriptionGate snapshot={subscription} />
                ) : (
                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

                        {/* Title */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.titleLabel')}
                            </label>
                            <input
                                type="text"
                                value={editionData.title}
                                onChange={(e) => setEditionData({ ...editionData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                placeholder={t('form.titlePlaceholder')}
                                required
                            />
                        </div>

                        {/* Year */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.yearLabel')}
                            </label>
                            <input
                                type="number"
                                value={editionData.year}
                                onChange={(e) => setEditionData({ ...editionData, year: parseInt(e.target.value) })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                min="1900"
                                max={new Date().getFullYear()}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.categoryLabel')}
                            </label>
                            <select
                                value={editionData.category}
                                onChange={(e) => setEditionData({ ...editionData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                            >
                                <option value="">{t('form.categoryPlaceholder')}</option>
                                {CATEGORIES_EN.map(cat => (
                                    <option key={cat} value={cat}>{CATEGORIES_FR[cat]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Technique */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.techniqueLabel')}
                            </label>
                            <textarea
                                ref={techniqueRef}
                                value={editionData.technique}
                                onChange={(e) => setEditionData({ ...editionData, technique: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors resize-none overflow-hidden min-h-[60px]"
                                placeholder={t('form.techniquePlaceholder')}
                                rows={2}
                            />
                        </div>

                        {/* Dimensions */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.dimensionsLabel')}
                            </label>
                            <input
                                type="text"
                                value={editionData.dimensions}
                                onChange={(e) => setEditionData({ ...editionData, dimensions: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                placeholder={t('form.dimensionsPlaceholder')}
                                autoComplete="new-password"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.descriptionLabel')}
                            </label>
                            <textarea
                                value={editionData.description}
                                onChange={(e) => setEditionData({ ...editionData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors min-h-[120px]"
                                placeholder={t('form.descriptionPlaceholder')}
                            />
                        </div>

                        {/* Images */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.imagesLabel')}
                            </label>
                            <input
                                type="file"
                                ref={imageInputRef}
                                onChange={handleImageUpload}
                                accept=".png,.jpg,.jpeg,.webp,.gif"
                                multiple
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={loadingStates.uploadingImage}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-card-alt)] transition-colors disabled:opacity-50 text-left"
                            >
                                {loadingStates.uploadingImage ? t('form.uploadingImage') : t('form.imagesButton')}
                            </button>
                            {editionData.images.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {editionData.images.map((img, i) => (
                                        <li key={i} className="flex items-center justify-between gap-2 bg-[var(--bg-page)] border border-[var(--border)] px-3 py-2">
                                            <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{img}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs flex-shrink-0"
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Number of copies */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.editionSizeLabel')}
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                min="1"
                                max="100"
                                required
                            />
                            <p className="text-[11px] text-[var(--text-muted)] mt-1 font-light">{t('form.editionSizeHint')}</p>
                        </div>

                        {merkleRoot && (
                            <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-4">
                                <p className="text-[13px] font-medium text-[var(--text-primary)] mb-2">{t('form.merkleRootLabel')}</p>
                                <p className="text-[11px] font-mono text-[var(--text-secondary)] break-all">{merkleRoot}</p>
                                <p className="text-[12px] font-light text-[var(--text-secondary)] mt-2">
                                    {t('form.secretKeysLabel', { n: secretKeys.length })}
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loadingStates.creating || loadingStates.uploading || loadingStates.uploadingImage || !merkleRoot || !isApproved || editionData.images.length === 0}
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {loadingStates.uploadingImage
                                ? t('form.uploadingImage')
                                : loadingStates.uploading
                                    ? t('form.uploading')
                                    : loadingStates.creating
                                        ? t('form.creating')
                                        : editionData.images.length === 0
                                            ? t('form.noImageWarning')
                                            : t('form.submit')}
                        </button>
                    </form>
                </div>
                )}

                {/* Post-creation: QR codes */}
                {createdEditionId && secretKeys.length > 0 && merkleTree && (
                    <div className="space-y-px">
                        {!hasDownloadedKeys && (
                            <div className="border-2 border-[#dc2626] bg-[#fef2f2] p-6 mb-px">
                                <p className="text-[16px] font-bold text-[#dc2626] mb-3">
                                    {t('postCreation.urgentTitle')}
                                </p>
                                <p className="text-[14px] font-medium text-[#991b1b] mb-2 leading-[1.7]">
                                    {t('postCreation.urgentBody1')}
                                </p>
                                <p className="text-[13px] font-medium text-[#991b1b] leading-[1.7]">
                                    {t('postCreation.urgentBody2')}
                                </p>
                            </div>
                        )}
                        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-6">
                            <p className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                                {t('postCreation.qrSectionTitle')}
                            </p>
                            <p className="text-[13px] font-light text-[var(--text-secondary)] mb-4 leading-[1.7]">
                                {t('postCreation.qrSectionBody')}
                            </p>
                            <div className="space-y-2">
                                <button
                                    onClick={downloadExcelWithQRCodes}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                >
                                    {loadingStates.generatingQR ? t('postCreation.generating') : t('postCreation.qrExcelCta')}
                                </button>
                                <button
                                    onClick={downloadQRCodesZip}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                >
                                    {loadingStates.generatingQR ? t('postCreation.generating') : t('postCreation.qrZipCta')}
                                </button>
                            </div>
                        </div>

                        {createdEditionId !== 'pending' && createdEditionId !== 'confirmed' && (
                            <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-6">
                                <p className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                                    {t('postCreation.editionQrSectionTitle')}
                                </p>
                                <p className="text-[13px] font-light text-[var(--text-secondary)] mb-4 leading-[1.7]">
                                    {t('postCreation.editionQrSectionBody')}
                                </p>
                                <button
                                    onClick={downloadEditionPageQRCode}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] uppercase py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                                >
                                    {loadingStates.generatingQR ? t('postCreation.generating') : t('postCreation.editionQrCta')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Trust footer — cohérent avec /artist/editions et /artist/editions/[id]/edit */}
                <div className="mt-20 border-t border-[var(--border)] pt-12">
                    <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                        <img
                            src="/logo-mona.svg"
                            alt="Mona Editions"
                            className="w-24 h-12 object-contain opacity-60"
                        />
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                            {t('trustFooter.title')}
                        </p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.8]">
                            {t('trustFooter.body')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                            <Link
                                href="/artist/editions"
                                className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustFooter.linkEditions')}
                            </Link>
                            <span className="text-[var(--border)]">·</span>
                            <Link
                                href="/artist"
                                className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustFooter.linkDashboard')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}