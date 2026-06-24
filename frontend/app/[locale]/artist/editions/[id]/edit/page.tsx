'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI, ARTWORK_TOKENIZATION_ADDRESS, ARTWORK_TOKENIZATION_ABI } from '@/config/contracts';
import { uploadToIPFS, uploadFileToIPFS, getFromIPFSGateway, getIPFSUrl } from '@/app/utils/ipfs';
import { CATEGORIES_EN, CATEGORIES_FR } from '@/app/utils/categories';
import { useModal } from '@/app/ModalProvider';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

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
    const t = useTranslations('Edit');
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

    // Auto-resize the Technique textarea to match its content. Keeps it
    // compact at rest (rows=1) but grows as needed — important on the edit
    // page where the field is pre-filled from IPFS, so the resize has to
    // run on the initial mount as well as on every keystroke.
    const techniqueRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const el = techniqueRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [editionData.technique]);

    const [isLoading, setIsLoading] = useState(true);
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

    // v2 : on lit la balance courante de l'artiste pour cette édition,
    // afin de détecter aussi les sorties de certificats hors flux QR
    // (transferts directs ERC-1155, ventes sur marketplace tierce).
    const { data: artistBalance } = useReadContract({
        address: ARTWORK_TOKENIZATION_ADDRESS,
        abi: ARTWORK_TOKENIZATION_ABI,
        functionName: 'balanceOf',
        args: activeAddress ? [activeAddress, editionId] : undefined,
    });

    useEffect(() => {
        if (artistData) setIsAuthorized((artistData as any).authorized === true);
    }, [artistData]);

    // Verrouillage métadonnée selon l'invariant v2 :
    // la modification n'est possible que si l'artiste détient encore
    // l'intégralité du tirage initial. Tout transfert sortant (claim,
    // transfert direct ERC-1155, vente sur marketplace tierce) verrouille.
    const metadataIsLocked = useMemo(() => {
        if (artistBalance === undefined) return false; // pas encore chargé
        if (!editionData.editionSize) return false;     // métadonnée IPFS pas encore chargée
        try {
            return BigInt(artistBalance as bigint) < BigInt(editionData.editionSize);
        } catch {
            return false;
        }
    }, [artistBalance, editionData.editionSize]);

    useEffect(() => {
        if (!editionOnChain) return;
        const [metadata] = editionOnChain as [string, `0x${string}`, boolean];

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
            await showAlert(t('form.uploadError'));
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
            await showAlert(t('form.minOneImageError'));
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
            await showAlert(t('updateSuccess'));
        } catch (error: any) {
            const rawMessage = error?.message || '';
            if (rawMessage.includes('MetadataLocked')) {
                await showAlert(t('errorMetadataLocked'));
            } else {
                await showAlert(t('errorGeneric', { message: rawMessage || '—' }));
            }
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false, saving: false }));
        }
    };

    if (isLoadingArtist || isLoading) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{t('loading')}</p>
            </div>
        );
    }

    if (!activeAddress) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
                <p className="italic text-[22px] text-[#a8a29e]">{t('connectWallet')}</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
                <p className="italic text-[22px] text-[#a8a29e] text-center max-w-md px-6">
                    {t('notOwner')}
                </p>
            </div>
        );
    }

    if (metadataIsLocked) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
                    <div className="text-center mb-12">
                        <img src="/logo-mona.svg" alt="Mona Editions Logo" className="w-[100px] h-[100px] object-contain mx-auto mb-6" />
                        <h1 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight mb-4">
                            {t('lockedTitleStart')} <em className="italic text-[#78716c]">{t('lockedTitleAccent')}</em>
                        </h1>
                        <p className="text-[14px] font-light text-[#78716c] max-w-md mx-auto mb-8">
                            {t('lockedExplanation')}
                        </p>
                        <Link
                            href="/artist/editions"
                            className="inline-block text-[12px] font-medium tracking-[0.06em] text-[#1c1917] border border-[#d6d0c8] px-8 py-3 hover:border-[#1c1917] transition-all duration-200"
                        >
                            ← {t('back')}
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
                        <p className="text-[14px] font-medium text-[#1c1917]">{t('updateSuccess')}</p>
                        <p className="text-[13px] font-light text-[#78716c] mt-1">
                            {t('updateSuccessHint')}
                        </p>
                    </div>
                )}

                <div className="text-center mb-12">
                    <img src="/logo-mona.svg" alt="Mona Editions Logo" className="w-[100px] h-[100px] object-contain mx-auto mb-6" />
                    <h1 className="text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        {t('title')} <em className="italic text-[#78716c]">{t('titleAccent', { id: params.id as string })}</em>
                    </h1>
                </div>

                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('form.titleLabel')}
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
                                {t('form.yearLabel')}
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
                                {t('form.categoryLabel')}
                            </label>
                            <select
                                value={editionData.category}
                                onChange={(e) => setEditionData({ ...editionData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] focus:outline-none focus:border-[#1c1917] transition-colors"
                            >
                                <option value="">{t('form.categoryPlaceholder')}</option>
                                {CATEGORIES_EN.map(cat => (
                                    <option key={cat} value={cat}>{CATEGORIES_FR[cat]}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('form.techniqueLabel')}
                            </label>
                            <textarea
                                ref={techniqueRef}
                                value={editionData.technique}
                                onChange={(e) => setEditionData({ ...editionData, technique: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors resize-none overflow-hidden min-h-[60px]"
                                placeholder={t('form.techniquePlaceholder')}
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('form.dimensionsLabel')}
                            </label>
                            <input
                                type="text"
                                value={editionData.dimensions}
                                onChange={(e) => setEditionData({ ...editionData, dimensions: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                placeholder={t('form.dimensionsPlaceholder')}
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('form.descriptionLabel')}
                            </label>
                            <textarea
                                value={editionData.description}
                                onChange={(e) => setEditionData({ ...editionData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[120px]"
                                placeholder={t('form.descriptionPlaceholder')}
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
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
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] hover:bg-[#e7e3dc] transition-colors disabled:opacity-50 text-left"
                            >
                                {loadingStates.uploadingImage ? t('form.uploadingImages') : t('form.addImagesCta')}
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
                                {t('cancel')}
                            </Link>
                            <button
                                type="submit"
                                disabled={isBusy || editionData.images.length === 0}
                                className="flex-[2] bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                            >
                                {loadingStates.uploadingImage
                                    ? t('uploadingButton')
                                    : loadingStates.uploading
                                        ? t('submitLoading')
                                        : loadingStates.saving
                                            ? t('savingTxButton')
                                            : t('submit')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Trust footer */}
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
                                href="/artist/editions"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustLinkEditions')}
                            </Link>
                            <span className="text-[#d6d0c8]">·</span>
                            <Link
                                href="/artist"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('trustLinkDashboard')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
