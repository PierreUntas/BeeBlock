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
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

// Utility function

const getMerkleProofForKey = (key: string, merkleTree: MerkleTree): string => {
    const innerHash = keccak256(`0x${Buffer.from(key).toString('hex')}`);
    const leaf = keccak256(innerHash);
    const proof = merkleTree.getHexProof(leaf);
    return proof.join(',');
};

export default function CreateEditionPage() {
    const { address } = useAccount();
    const { user } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;
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
                showAlert('La taille de l\'édition ne peut pas dépasser 100 exemplaires pour limiter les coûts de gas.');
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
            await showAlert(`${oversized.length > 1 ? 'Ces fichiers dépassent' : 'Ce fichier dépasse'} la limite de 20 Mo : ${oversized.map(f => f.name).join(', ')}`);
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
            await showAlert(`${newCids.length} image${newCids.length > 1 ? 's uploadées' : ' uploadée'} sur IPFS !`);
        } catch (error) {
            console.error('Error uploading image:', error);
            await showAlert('Erreur lors de l\'upload de l\'image');
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
            await showAlert('QR Code de la page du lot téléchargé avec succès !');
        } catch (error) {
            console.error('Error generating edition page QR code:', error);
            await showAlert('Erreur lors de la génération du QR code de la page');
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
            await showAlert(`Fichier Excel avec ${secretKeys.length} QR codes généré avec succès !`);
        } catch (error) {
            console.error('Error generating Excel with QR codes:', error);
            await showAlert('Erreur lors de la génération du fichier Excel avec QR codes');
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
            await showAlert(`${secretKeys.length} QR codes téléchargés avec succès !`);
        } catch (error) {
            console.error('Error generating QR codes:', error);
            await showAlert('Erreur lors de la génération des QR codes');
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
            await showAlert('Erreur lors de l\'approbation. Veuillez réessayer.');
            setLoadingStates(prev => ({ ...prev, approving: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editionData.title || !amount || !merkleRoot) {
            await showAlert('Veuillez remplir tous les champs obligatoires');
            return;
        }
        if (editionData.images.length === 0) {
            await showAlert('Vous devez ajouter au moins une image de l\'œuvre');
            return;
        }
        if (!isApproved) {
            await showAlert('Vous devez d\'abord approuver le contrat');
            return;
        }

        setLoadingStates(prev => ({ ...prev, uploading: true }));
        let transactionAttempted = false;
        const publicClientInstance = createPublicClient({ chain: activeChain, transport: http(activeRpcUrl) });
        try {
            // IPFS object matching the target structure
            const artworkMetadata: {
                title: string;
                year: number;
                description: string;
                technique: string;
                dimensions: string;
                images: string[];
                editionSize: number;
                category: string;
            } = {
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
                await showAlert(`Œuvre créée avec succès ! ID : ${editionId}`);
            } else {
                console.error('NewArtworkEdition event not found in logs');
                await showAlert('Transaction confirmée mais impossible de récupérer l\'ID de l\'œuvre. Vérifiez la console.');
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
                        await showAlert(`Œuvre créée avec succès ! ID : ${editionId}`);
                        return;
                    }
                } catch {}
            }
            await showAlert('Erreur lors de la création de l\'œuvre');
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false, creating: false }));
        }
    };

    if (isCheckingAuthorization || isLoadingArtist) {
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

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[#a8a29e] text-center max-w-md px-6">
                        Accès refusé : vous n'êtes pas autorisé comme artiste
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">

                {isAuthorized && !isApproved && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[14px] font-medium text-[#1c1917] mb-1">Action requise</p>
                                <p className="text-[13px] font-light text-[#78716c]">Vous autorisez Mona Editions à transférer des certificats en votre nom pour faciliter le transfert de propriété en toute sécurité.</p>
                            </div>
                            <button
                                onClick={handleApprove}
                                disabled={loadingStates.approving}
                                className="bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3 px-6 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200 whitespace-nowrap"
                            >
                                {loadingStates.approving ? 'En cours…' : 'Approuver'}
                            </button>
                        </div>
                    </div>
                )}

                {createdEditionId && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                        <p className="text-[14px] font-medium text-[#1c1917] mb-1">Œuvre créée avec succès !</p>
                        <p className="text-[13px] font-light text-[#78716c]">ID de l'œuvre : <span className="font-mono">{createdEditionId}</span></p>
                        {!hasDownloadedKeys && (
                            <p className="text-[14px] font-medium text-[#dc2626] mt-3 leading-[1.7]">
                                IMPORTANT : Vous devez télécharger les clés secrètes maintenant. Une fois cette page fermée, vous ne pourrez plus les récupérer !
                            </p>
                        )}
                        {hasDownloadedKeys && (
                            <p className="text-[13px] font-light text-[#16a34a] mt-2">
                                Clés secrètes téléchargées avec succès
                            </p>
                        )}
                    </div>
                )}

                <div className="text-center mb-12">
                    <img 
                        src="/logo-mona.svg" 
                        alt="Mona Editions Logo" 
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Créer une nouvelle <em className="italic text-[#78716c]">œuvre</em>
                    </h1>
                </div>

                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

                        {/* Title */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Titre de l'œuvre *
                            </label>
                            <input
                                type="text"
                                value={editionData.title}
                                onChange={(e) => setEditionData({ ...editionData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder="Ex: Sakura Dreams"
                                required
                            />
                        </div>

                        {/* Year */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Année de création *
                            </label>
                            <input
                                type="number"
                                value={editionData.year}
                                onChange={(e) => setEditionData({ ...editionData, year: parseInt(e.target.value) })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                min="1900"
                                max={new Date().getFullYear()}
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Catégorie
                            </label>
                            <select
                                value={editionData.category}
                                onChange={(e) => setEditionData({ ...editionData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors"
                            >
                                <option value="">Sélectionner une catégorie</option>
                                {CATEGORIES_EN.map(cat => (
                                    <option key={cat} value={cat}>{CATEGORIES_FR[cat]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Technique */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Technique
                            </label>
                            <input
                                type="text"
                                value={editionData.technique}
                                onChange={(e) => setEditionData({ ...editionData, technique: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder="Ex : Huile sur toile, Aquarelle, Bronze..."
                            />
                        </div>

                        {/* Dimensions */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Dimensions
                            </label>
                            <input
                                type="text"
                                value={editionData.dimensions}
                                onChange={(e) => setEditionData({ ...editionData, dimensions: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder="Ex: 100x150 cm"
                                autoComplete="new-password"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Description
                            </label>
                            <textarea
                                value={editionData.description}
                                onChange={(e) => setEditionData({ ...editionData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[120px]"
                                placeholder="Décrivez votre œuvre, la technique utilisée, les matériaux, l'inspiration..."
                            />
                        </div>

                        {/* Images */}
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Images de l'œuvre *
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
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] hover:bg-[#e7e3dc] transition-colors disabled:opacity-50 text-left"
                            >
                                {loadingStates.uploadingImage ? 'Upload en cours…' : 'Ajouter des images (upload IPFS)'}
                            </button>
                            {editionData.images.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {editionData.images.map((img, i) => (
                                        <li key={i} className="flex items-center justify-between gap-2 bg-[#f5f3ef] border border-[#d6d0c8] px-3 py-2">
                                            <span className="text-[11px] font-mono text-[#a8a29e] truncate">{img}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                className="text-[#a8a29e] hover:text-[#1c1917] transition-colors text-xs flex-shrink-0"
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
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Taille de l'édition (nombre d'exemplaires) *
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder="Ex: 50"
                                min="1"
                                max="100"
                                required
                            />
                        </div>

                        {merkleRoot && (
                            <div className="border border-[#d6d0c8] bg-[#ede9e3] p-4">
                                <p className="text-[13px] font-medium text-[#1c1917] mb-2">Merkle Root généré</p>
                                <p className="text-[11px] font-mono text-[#78716c] break-all">{merkleRoot}</p>
                                <p className="text-[12px] font-light text-[#78716c] mt-2">
                                    {secretKeys.length} clé{secretKeys.length > 1 ? 's' : ''} secrète{secretKeys.length > 1 ? 's' : ''} générée{secretKeys.length > 1 ? 's' : ''}
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loadingStates.creating || loadingStates.uploading || loadingStates.uploadingImage || !merkleRoot || !isApproved || editionData.images.length === 0}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                        >
                            {loadingStates.uploadingImage
                                ? 'Upload image en cours…'
                                : loadingStates.uploading
                                    ? 'Upload IPFS…'
                                    : loadingStates.creating
                                        ? 'Création en cours…'
                                        : editionData.images.length === 0
                                            ? 'Ajoutez au moins une image'
                                            : 'Créer l\'œuvre'}
                        </button>
                    </form>
                </div>

                {/* Post-creation: QR codes */}
                {createdEditionId && secretKeys.length > 0 && merkleTree && (
                    <div className="space-y-px">
                        {!hasDownloadedKeys && (
                            <div className="border-2 border-[#dc2626] bg-[#fef2f2] p-6 mb-px">
                                <p className="text-[16px] font-bold text-[#dc2626] mb-3">
                                    ACTION REQUISE - TÉLÉCHARGEMENT OBLIGATOIRE
                                </p>
                                <p className="text-[14px] font-medium text-[#991b1b] mb-2 leading-[1.7]">
                                    Les clés secrètes ne sont disponibles que maintenant. Si vous quittez cette page sans les télécharger, 
                                    vos collectionneurs ne pourront JAMAIS réclamer leurs certificats.
                                </p>
                                <p className="text-[13px] font-medium text-[#991b1b] leading-[1.7]">
                                    Téléchargez au moins un des formats ci-dessous avant de quitter !
                                </p>
                            </div>
                        )}
                        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-6">
                            <p className="text-[14px] font-medium text-[#1c1917] mb-2">
                                QR Codes pour les collectionneurs
                            </p>
                            <p className="text-[13px] font-light text-[#78716c] mb-4 leading-[1.7]">
                                Ces QR codes permettent aux collectionneurs de réclamer leur certificat numérique.
                            </p>
                            <div className="space-y-2">
                                <button
                                    onClick={downloadExcelWithQRCodes}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                                >
                                    {loadingStates.generatingQR ? 'Génération en cours…' : 'Télécharger Excel avec QR codes'}
                                </button>
                                <button
                                    onClick={downloadQRCodesZip}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                                >
                                    {loadingStates.generatingQR ? 'Génération en cours…' : 'Télécharger QR codes (ZIP)'}
                                </button>
                            </div>
                        </div>

                        {createdEditionId !== 'pending' && createdEditionId !== 'confirmed' && (
                            <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6">
                                <p className="text-[14px] font-medium text-[#1c1917] mb-2">
                                    QR Code pour l'étiquette de l'œuvre
                                </p>
                                <p className="text-[13px] font-light text-[#78716c] mb-4 leading-[1.7]">
                                    Ce QR code pointe vers la page de l'œuvre et peut être apposé au dos.
                                </p>
                                <button
                                    onClick={downloadEditionPageQRCode}
                                    disabled={loadingStates.generatingQR}
                                    className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                                >
                                    {loadingStates.generatingQR ? 'Génération…' : 'Télécharger QR Code Œuvre'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

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