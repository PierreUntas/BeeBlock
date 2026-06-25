'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import { BASE_URL } from '@/config/constants';
import { uploadToIPFS, uploadFileToIPFS, getFromIPFSGateway } from '@/app/utils/ipfs';
import { base64ToBlob, downloadFile, gatewayUrlToIpfsUri } from '@/app/utils/file';
import { useSendTransaction, usePrivy } from '@privy-io/react-auth';
import { useModal } from '@/app/ModalProvider';
import { publicClient } from '@/lib/client';
import { encodeFunctionData } from 'viem';
import QRCode from 'qrcode';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSubscription, acceptPrivacy } from '@/app/hooks/useSubscription';

export default function ArtistProfilePage() {
    const t = useTranslations('Artist');
    const tCommon = useTranslations('Common');
    const { address } = useAccount();
    const { user, getAccessToken } = usePrivy();
    const walletAddress = (user?.wallet || (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'wallet'))?.address;
    const activeAddress = (walletAddress || address) as `0x${string}` | undefined;
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Grouped loading states
    const [loadingStates, setLoadingStates] = useState({
        uploading: false,
        loadingIPFS: false,
        generatingQR: false,
    });

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const photosInputRef = useRef<HTMLInputElement>(null);

    const [additionalData, setAdditionalData] = useState({
        website: '',
        bio: '',
        exhibitions: [] as string[],
        socialMedia: {
            instagram: '',
            twitter: '',
            facebook: ''
        }
    });

    const { isPending: isRegistering } = useWriteContract();
    const { sendTransaction } = useSendTransaction();
    const { showAlert } = useModal();
    const { snapshot: subscription, refresh: refreshSubscription } = useSubscription();

    // RGPD: the artist must accept the privacy policy on first registration.
    // Once accepted (server-side timestamp set), the checkbox is hidden.
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const needsPrivacyAcceptance =
        subscription !== null && subscription.privacyAcceptedAt === null;

    const { data: artistData, isLoading: isLoadingArtist, refetch: refetchArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    const MAX_PHOTOS = 7;

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                showAlert(t('form.logoTooLargeError', { sizeMb: (file.size / 1024 / 1024).toFixed(1) }));
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        // Reset the input value immediately so the user can re-select the same
        // files after a rejection (browsers de-duplicate by reference otherwise).
        e.target.value = '';

        if (files.length === 0) return;

        const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
        if (oversized.length > 0) {
            showAlert(t('form.photosTooLargeError', {
                count: oversized.length,
                names: oversized.map(f => f.name).join(', '),
            }));
            return;
        }

        // Enforce the MAX_PHOTOS cap. If the user picks more than the remaining
        // slots, accept what fits and tell them how many were dropped.
        const remainingSlots = Math.max(0, MAX_PHOTOS - photoFiles.length);
        if (remainingSlots === 0) {
            showAlert(t('form.photosTooManyError', { max: MAX_PHOTOS, dropped: files.length }));
            return;
        }

        const accepted = files.slice(0, remainingSlots);
        const dropped = files.length - accepted.length;
        if (dropped > 0) {
            showAlert(t('form.photosTooManyError', { max: MAX_PHOTOS, dropped }));
        }

        setPhotoFiles(prev => [...prev, ...accepted]);
        accepted.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removePhoto = (index: number) => {
        setPhotoFiles(prev => prev.filter((_, i) => i !== index));
        setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const downloadArtistPageQRCode = async () => {
        if (!address || !isRegistered) return;
        setLoadingStates(prev => ({ ...prev, generatingQR: true }));
        try {
            const artistPageUrl = `${BASE_URL}/explore/artist/${address}`;
            const qrCodeDataUrl = await QRCode.toDataURL(artistPageUrl, {
                width: 1000,
                margin: 4,
                color: { dark: '#000000', light: '#FFFFFF' },
                errorCorrectionLevel: 'H'
            });
            const base64Data = qrCodeDataUrl.split(',')[1];
            const blob = base64ToBlob(base64Data);
            const url = URL.createObjectURL(blob);
            downloadFile(url, `QR_Artist_${name.replace(/\s+/g, '_')}_${address.slice(0, 8)}.png`);
            await showAlert(t('form.qrSuccess'));
        } catch (error) {
            console.error('Error generating artist page QR code:', error);
            await showAlert(t('form.qrError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, generatingQR: false }));
        }
    };

    const loadIPFSData = async (cid: string) => {
        setLoadingStates(prev => ({ ...prev, loadingIPFS: true }));
        try {
            const ipfsData = await getFromIPFSGateway(cid);
            if (ipfsData) {
                if (ipfsData.name) setName(ipfsData.name);
                if (ipfsData.location) setLocation(ipfsData.location);

                setAdditionalData({
                    website: ipfsData.website || '',
                    bio: ipfsData.bio || '',
                    exhibitions: ipfsData.exhibitions || [],
                    socialMedia: {
                        instagram: ipfsData.socialMedia?.instagram || '',
                        twitter: ipfsData.socialMedia?.twitter || '',
                        facebook: ipfsData.socialMedia?.facebook || ''
                    }
                });

                if (ipfsData.logo) {
                    const logoUrl = ipfsData.logo.startsWith('ipfs://')
                        ? `https://ipfs.io/ipfs/${ipfsData.logo.replace('ipfs://', '')}`
                        : ipfsData.logo;
                    setLogoPreview(logoUrl);
                }

                // portfolio is the photos array
                if (ipfsData.portfolio && ipfsData.portfolio.length > 0) {
                    const existingPhotos = ipfsData.portfolio.map((photo: string) =>
                        photo.startsWith('ipfs://')
                            ? `https://ipfs.io/ipfs/${photo.replace('ipfs://', '')}`
                            : photo
                    );
                    setPhotoPreviews(existingPhotos);
                }
            }
        } catch (error) {
            console.error('Error loading IPFS data:', error);
        } finally {
            setLoadingStates(prev => ({ ...prev, loadingIPFS: false }));
        }
    };

    useEffect(() => {
        if (artistData) {
            const artist = artistData as any;
            setIsAuthorized(artist.authorized);
            setIsRegistered(artist.metadata && artist.metadata.length > 0);
            setIsCheckingAuthorization(false);
            if (artist.metadata) {
                loadIPFSData(artist.metadata);
            }
        } else if (!isLoadingArtist && artistData !== undefined) {
            setIsCheckingAuthorization(false);
        }
    }, [artistData, isLoadingArtist]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // RGPD: require explicit acceptance of the privacy policy before
        // creating an artist account. Once accepted server-side, the
        // checkbox is hidden so existing artists aren't prompted again.
        if (needsPrivacyAcceptance) {
            if (!privacyAccepted) {
                showAlert(t('form.privacyRequired'));
                return;
            }
            const ok = await acceptPrivacy(getAccessToken);
            if (!ok) {
                showAlert(t('form.privacyError'));
                return;
            }
            await refreshSubscription();
        }

        setLoadingStates(prev => ({ ...prev, uploading: true }));

        let savedCid = '';
        let transactionAttempted = false;
        try {
            // Upload logo if a new file was selected, otherwise keep existing IPFS URI
            let logoUri: string | undefined = logoPreview.startsWith('https://ipfs.io/ipfs/')
                ? gatewayUrlToIpfsUri(logoPreview)
                : undefined;

            if (logoFile) {
                // Upload the file directly to IPFS and get its CID
                const logoCid = await uploadFileToIPFS(logoFile);
                logoUri = `ipfs://${logoCid}`;
            }

            // Upload newly added local photos to IPFS and collect their URIs
            const newPhotoUris = await Promise.all(
                photoFiles.map(async (file) => {
                    const cid = await uploadFileToIPFS(file);
                    return `ipfs://${cid}`;
                })
            );

            // Preserve existing IPFS photos that weren't removed by the user
            // They are stored in photoPreviews as resolved gateway URLs
            const existingIpfsPhotos = photoPreviews
                .filter(preview => preview.startsWith('https://ipfs.io/ipfs/'))
                .map(preview => gatewayUrlToIpfsUri(preview));

            const artistMetadata: {
                name: string;
                location: string;
                website: string;
                bio: string;
                logo?: string;
                portfolio: string[];
                exhibitions: string[];
                socialMedia: { instagram: string; twitter: string; facebook: string };
            } = {
                name,
                location,
                website: additionalData.website,
                bio: additionalData.bio,
                ...(logoUri ? { logo: logoUri } : {}),
                portfolio: [...existingIpfsPhotos, ...newPhotoUris],
                exhibitions: additionalData.exhibitions,
                socialMedia: additionalData.socialMedia,
            };

            savedCid = await uploadToIPFS(artistMetadata);

            const data = encodeFunctionData({
                abi: ARTWORK_REGISTRY_ABI,
                functionName: 'setArtistInfo',
                args: [savedCid],
            });

            transactionAttempted = true;
            const txResult = await sendTransaction(
                { to: ARTWORK_REGISTRY_ADDRESS, data },
                { sponsor: true }
            );
            await publicClient.waitForTransactionReceipt({ hash: txResult.hash });

            setIsRegistered(true);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 6000);
            refetchArtist();
        } catch (error) {
            console.error('Error saving artist:', error);
            // Privy sometimes shows its own error notification even when the
            // transaction succeeds. If we attempted the transaction, wait for
            // a potential in-flight transaction to mine before concluding failure.
            if (transactionAttempted && savedCid && activeAddress) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const current = await publicClient.readContract({
                        address: ARTWORK_REGISTRY_ADDRESS,
                        abi: ARTWORK_REGISTRY_ABI,
                        functionName: 'getArtist',
                        args: [activeAddress],
                    }) as any;
                    if (current.metadata === savedCid) {
                        setIsRegistered(true);
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 6000);
                        return;
                    }
                } catch {}
            }
            await showAlert(t('form.saveError'));
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false }));
        }
    };

    if (isCheckingAuthorization || isLoadingArtist) {
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
                    <p className=" italic text-[22px] text-[var(--text-muted)]">
                        Veuillez connecter votre wallet
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[var(--bg-page)]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className=" italic text-[22px] text-[var(--text-muted)] text-center max-w-md px-6">
                        Accès refusé : vous n'êtes pas autorisé comme artiste
                    </p>
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
                        {isRegistered ? (
                            <>{t('title')} <em className="italic text-[var(--text-secondary)]">{t('titleAccent')}</em></>
                        ) : (
                            <>{t('createTitleStart')} <em className="italic text-[var(--text-secondary)]">{t('createTitleAccent')}</em></>
                        )}
                    </h1>
                </div>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[var(--text-muted)] tracking-[0.06em] mb-6 text-center">
                        {tCommon('ipfsLoading')}
                    </p>
                )}

                {subscription?.status === 'past_due' && (
                    <div className="border-2 border-[#dc2626] bg-[#fef2f2] p-5 mb-px">
                        <p className="text-[14px] font-medium text-[#991b1b] mb-1">
                            {t('pastDue.title')}
                        </p>
                        <p className="text-[13px] font-light text-[#991b1b] leading-[1.7]">
                            {t('pastDue.description')}{' '}
                            <a href="/artist/subscription" className="underline underline-offset-4 hover:no-underline">
                                {t('pastDue.linkText')}
                            </a>{' '}
                            {t('pastDue.descriptionEnd')}
                        </p>
                    </div>
                )}

                {isRegistered && (
                    <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-6 mb-px">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                            {t('qrTitle')}
                        </p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] mb-4 leading-[1.7]">
                            {t('qrDescription')}
                        </p>
                        <button
                            onClick={downloadArtistPageQRCode}
                            disabled={loadingStates.generatingQR}
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200"
                        >
                            {loadingStates.generatingQR ? t('qrGenerating') : t('qrDownload')}
                        </button>
                    </div>
                )}

                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.nameLabel')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('form.namePlaceholder')}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.locationLabel')}
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder={t('form.locationPlaceholder')}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.bioLabel')}
                            </label>
                            <textarea
                                value={additionalData.bio}
                                onChange={(e) => setAdditionalData({...additionalData, bio: e.target.value})}
                                placeholder={t('form.bioPlaceholder')}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors min-h-[120px]"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.logoLabel')}
                            </label>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => logoInputRef.current?.click()}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-card-alt)] transition-colors text-left"
                            >
                                {logoFile ? logoFile.name : t('form.logoButton')}
                            </button>
                            {logoPreview && (
                                <div className="mt-3">
                                    <img
                                        src={logoPreview}
                                        alt={t('form.logoPreviewAlt')}
                                        className="w-24 h-24 object-contain border border-[var(--border)] bg-[var(--bg-page)]"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.photosLabel', { max: MAX_PHOTOS })}
                            </label>
                            <input
                                ref={photosInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => photosInputRef.current?.click()}
                                disabled={photoFiles.length >= MAX_PHOTOS}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-card-alt)] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--bg-page)]"
                            >
                                {photoFiles.length > 0
                                    ? t('form.photosSelected', { count: photoFiles.length, max: MAX_PHOTOS })
                                    : t('form.photosButton')}
                            </button>
                            {photoPreviews.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {photoPreviews.map((preview, index) => (
                                        <div key={index} className="relative">
                                            <img
                                                src={preview}
                                                alt={`Photo ${index + 1}`}
                                                className="w-full h-24 object-cover border border-[var(--border)] bg-[var(--border-soft)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(index)}
                                                className="absolute top-1 right-1 bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] w-5 h-5 flex items-center justify-center text-xs hover:bg-[var(--accent-hover)] transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.websiteLabel')}
                            </label>
                            <input
                                type="url"
                                value={additionalData.website}
                                onChange={(e) => setAdditionalData({...additionalData, website: e.target.value})}
                                placeholder={t('form.websitePlaceholderExample')}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.exhibitionsLabel')}
                            </label>
                            <textarea
                                value={additionalData.exhibitions.join('\n')}
                                onChange={(e) => setAdditionalData({
                                    ...additionalData,
                                    exhibitions: e.target.value.split('\n').filter(Boolean)
                                })}
                                placeholder={t('form.exhibitionsExamplePlaceholder')}
                                className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors min-h-[100px]"
                            />
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('form.exhibitionsPlaceholder')}</p>
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[var(--text-muted)] mb-2">
                                {t('form.instagramLabel')} / {t('form.twitterLabel')} / {t('form.facebookLabel')}
                            </label>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.instagram}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, instagram: e.target.value }
                                    })}
                                    placeholder={t('form.instagramPlaceholder')}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                />
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.twitter}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, twitter: e.target.value }
                                    })}
                                    placeholder={t('form.twitterPlaceholder')}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                />
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.facebook}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, facebook: e.target.value }
                                    })}
                                    placeholder={t('form.facebookPlaceholder')}
                                    className="w-full px-4 py-3 bg-[var(--bg-page)] border border-[var(--border)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                                />
                            </div>
                        </div>

                        {saveSuccess && (
                            <div className="border border-[var(--border)] bg-[#f0fdf4] p-4">
                                <p className="text-[13px] font-medium text-[#166534]">
                                    {tCommon('saveSuccess')}
                                </p>
                            </div>
                        )}

                        {needsPrivacyAcceptance && (
                            <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-5">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={privacyAccepted}
                                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                        required
                                        className="mt-1 w-4 h-4 accent-[var(--text-primary)] cursor-pointer flex-shrink-0"
                                    />
                                    <span className="text-[13px] font-light text-[var(--text-primary)] leading-[1.7]">
                                        {t('form.privacyLabel')}{' '}
                                        <a
                                            href="/legal/privacy"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline underline-offset-2 hover:no-underline font-medium"
                                        >
                                            {t('form.privacyLink')}
                                        </a>
                                        {t('form.privacyEnd')}
                                    </span>
                                </label>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={
                                isRegistering ||
                                loadingStates.uploading ||
                                loadingStates.loadingIPFS ||
                                (needsPrivacyAcceptance && !privacyAccepted)
                            }
                            className="w-full bg-[var(--bg-inverse)] text-[var(--text-on-inverse)] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[var(--text-primary)] disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-all duration-200 cursor-pointer"
                        >
                            {loadingStates.uploading
                                ? tCommon('uploadIPFS')
                                : isRegistering
                                    ? tCommon('saving')
                                    : isRegistered
                                        ? tCommon('update')
                                        : tCommon('save')}
                        </button>
                    </form>
                </div>

                {/* Trust footer — for cohérence with the rest of the artist area */}
                <div className="mt-20 border-t border-[var(--border)] pt-12">
                    <div className="flex flex-col items-center text-center max-w-2xl mx-auto gap-4">
                        <img
                            src="/logo-mona.svg"
                            alt="Mona Editions"
                            className="w-24 h-12 object-contain opacity-60"
                        />
                        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                            {t('profileTrust.title')}
                        </p>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.8]">
                            {t('profileTrust.body')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2">
                            {activeAddress && isRegistered && (
                                <>
                                    <Link
                                        href={`/explore/artist/${activeAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                                    >
                                        {t('profileTrust.linkPublicProfile')} ↗
                                    </Link>
                                    <span className="text-[var(--border)]">·</span>
                                </>
                            )}
                            <Link
                                href="/artist"
                                className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] underline underline-offset-4 hover:opacity-70 transition-opacity"
                            >
                                {t('profileTrust.linkDashboard')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}