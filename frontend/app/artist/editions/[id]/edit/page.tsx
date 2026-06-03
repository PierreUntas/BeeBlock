'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import { uploadToIPFS, uploadFileToIPFS, getFromIPFSGateway, getIPFSUrl } from '@/app/utils/ipfs';
import { CATEGORIES_EN, CATEGORIES_FR } from '@/app/utils/categories';
import { useModal } from '@/app/ModalProvider';
import Link from 'next/link';

interface EditionData {
    title: string;
    year: number;
    description: string;
    technique: string;
    dimensions: string;
    images: string[];
    editionSize: number;
    category: string;
}

export default function EditEditionPage() {
    const params = useParams();
    const editionId = BigInt(params.id as string);

    const { address } = useAccount();
    const { user } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;

    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [editionData, setEditionData] = useState<EditionData>({
        title: '',
        year: new Date().getFullYear(),
        description: '',
        technique: '',
        dimensions: '',
        images: [],
        editionSize: 0,
        category: '',
    });

    const [isLoading, setIsLoading] = useState(true);
    const [hasBeenClaimed, setHasBeenClaimed] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
        uploadingImage: false,
        uploading: false,
        saving: false,
    });
    const [saved, setSaved] = useState(false);

    const { data: artistData, isLoading: isLoadingArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    const { data: editionOnChain } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtworkEdition',
        args: [editionId],
    });

    useEffect(() => {
        if (artistData) setIsAuthorized((artistData as any).authorized === true);
    }, [artistData]);

    useEffect(() => {
        if (!editionOnChain) return;
        const [metadata, , claimed] = editionOnChain as [string, `0x${string}`, boolean, boolean];
        setHasBeenClaimed(claimed);

        if (!metadata) { setIsLoading(false); return; }

        getFromIPFSGateway(metadata)
            .then((ipfsData: any) => {
                setEditionData({
                    title: ipfsData.title || ipfsData.name || '',
                    year: ipfsData.year || new Date().getFullYear(),
                    description: ipfsData.description || '',
                    technique: ipfsData.technique || '',
                    dimensions: ipfsData.dimensions || '',
                    images: ipfsData.images || (ipfsData.image ? [ipfsData.image] : []),
                    editionSize: ipfsData.editionSize || 0,
                    category: ipfsData.category || '',
                });
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [editionOnChain]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setLoadingStates(prev => ({ ...prev, uploadingImage: true }));
        try {
            const newCids: string[] = [];
            for (const file of Array.from(files)) {
                const cid = await uploadFileToIPFS(file);
                newCids.push(`ipfs://${cid}`);
            }
            setEditionData(prev => ({ ...prev, images: [...prev.images, ...newCids] }));
        } catch (error) {
            await showAlert('Erreur lors de l\'upload de l\'image');
        } finally {
            setLoadingStates(prev => ({ ...prev, uploadingImage: false }));
            if (imageInputRef.current) imageInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setEditionData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editionData.images.length === 0) {
            await showAlert('Vous devez conserver au moins une image de l\'œuvre');
            return;
        }

        setLoadingStates(prev => ({ ...prev, uploading: true }));
        try {
            const metadata = {
                name: editionData.title,
                image: editionData.images[0] ?? '',
                title: editionData.title,
                year: editionData.year,
                description: editionData.description,
                technique: editionData.technique,
                dimensions: editionData.dimensions,
                images: editionData.images,
                editionSize: editionData.editionSize,
                category: editionData.category,
            };

            const cid = await uploadToIPFS(metadata);

            setLoadingStates(prev => ({ ...prev, uploading: false, saving: true }));

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'updateEditionMetadata',
                args: [editionId, cid],
            });

            await sendTransaction({ to: ARTWORK_REGISTRY_ADDRESS, data }, { sponsor: true });

            setSaved(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await showAlert('Métadonnées mises à jour avec succès !');
        } catch (error: any) {
            await showAlert(`Erreur : ${error?.message || 'Échec de la mise à jour'}`);
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false, saving: false }));
        }
    };

    if (isLoadingArtist || isLoading) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">Chargement…</p>
            </div>
        );
    }

    if (!activeAddress) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
                <p className="italic text-[22px] text-[#a8a29e]">Veuillez connecter votre wallet</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
                <p className="italic text-[22px] text-[#a8a29e] text-center max-w-md px-6">
                    Accès refusé : vous n'êtes pas autorisé comme artiste
                </p>
            </div>
        );
    }

    if (hasBeenClaimed) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
                    <div className="text-center mb-12">
                        <img src="/logo-mona.svg" alt="Mona Editions Logo" className="w-[100px] h-[100px] object-contain mx-auto mb-6" />
                        <h1 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-4">
                            Métadonnées <em className="italic text-[#78716c]">verrouillées</em>
                        </h1>
                        <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8">
                            Au moins un certificat a été réclamé pour cette édition. Les métadonnées sont désormais immuables afin de garantir l'authenticité des œuvres.
                        </p>
                        <Link
                            href="/artist/editions"
                            className="inline-block text-[12px] font-medium tracking-[0.06em] text-[#1c1917] border border-[#d6d0c8] px-8 py-3 hover:border-[#1c1917] transition-all duration-200"
                        >
                            ← Retour à mes œuvres
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isBusy = loadingStates.uploadingImage || loadingStates.uploading || loadingStates.saving;

    return (
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">

                {saved && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                        <p className="text-[14px] font-medium text-[#1c1917]">Métadonnées mises à jour avec succès !</p>
                        <p className="text-[13px] font-light text-[#78716c] mt-1">
                            Les plateformes comme OpenSea et MetaMask rafraîchiront les données sous peu.
                        </p>
                    </div>
                )}

                <div className="text-center mb-12">
                    <img src="/logo-mona.svg" alt="Mona Editions Logo" className="w-[100px] h-[100px] object-contain mx-auto mb-6" />
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        Modifier <em className="italic text-[#78716c]">l'œuvre #{params.id}</em>
                    </h1>
                </div>

                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Titre de l'œuvre *
                            </label>
                            <input
                                type="text"
                                value={editionData.title}
                                onChange={(e) => setEditionData({ ...editionData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Année de création *
                            </label>
                            <input
                                type="number"
                                value={editionData.year}
                                onChange={(e) => setEditionData({ ...editionData, year: parseInt(e.target.value) })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors"
                                min="1900"
                                max={new Date().getFullYear()}
                                required
                            />
                        </div>

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

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Technique
                            </label>
                            <input
                                type="text"
                                value={editionData.technique}
                                onChange={(e) => setEditionData({ ...editionData, technique: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder="Ex : Huile sur toile, Aquarelle, Bronze…"
                            />
                        </div>

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
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Description
                            </label>
                            <textarea
                                value={editionData.description}
                                onChange={(e) => setEditionData({ ...editionData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[120px]"
                                placeholder="Décrivez votre œuvre…"
                            />
                        </div>

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
                                            <a
                                                href={getIPFSUrl(img)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] font-mono text-[#a8a29e] truncate hover:text-[#78716c] transition-colors"
                                            >
                                                {img}
                                            </a>
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

                        <div className="flex gap-3 pt-2">
                            <Link
                                href="/artist/editions"
                                className="flex-1 text-center text-[12px] font-normal tracking-[0.06em] text-[#78716c] border border-[#d6d0c8] py-3.5 hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200"
                            >
                                Annuler
                            </Link>
                            <button
                                type="submit"
                                disabled={isBusy || editionData.images.length === 0}
                                className="flex-[2] bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                            >
                                {loadingStates.uploadingImage
                                    ? 'Upload image…'
                                    : loadingStates.uploading
                                        ? 'Upload IPFS…'
                                        : loadingStates.saving
                                            ? 'Enregistrement…'
                                            : 'Enregistrer les modifications'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="flex justify-center mt-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-px h-12 bg-[#d6d0c8]" />
                        <span className="italic text-[13px] text-[#a8a29e]">Mona Editions</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
