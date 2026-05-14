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

export default function ArtistPage() {
    const { address } = useAccount();
    const { user } = usePrivy();
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

    const { data: artistData, isLoading: isLoadingArtist, refetch: refetchArtist } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setPhotoFiles(prev => [...prev, ...files]);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPhotoPreviews(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
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
            await showAlert('QR Code de votre page artiste téléchargé avec succès !');
        } catch (error) {
            console.error('Error generating artist page QR code:', error);
            await showAlert('Erreur lors de la génération du QR code');
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
            await showAlert('Erreur lors de l\'enregistrement');
        } finally {
            setLoadingStates(prev => ({ ...prev, uploading: false }));
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
                    <p className=" italic text-[22px] text-[#a8a29e]">
                        Veuillez connecter votre wallet
                    </p>
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
            <div className="max-w-2xl mx-auto px-6 pt-28 pb-20">
                <div className="text-center mb-12">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions Logo"
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        {isRegistered ? (
                            <>Modifier mes <em className="italic text-[#78716c]">informations</em></>
                        ) : (
                            <>Enregistrement <em className="italic text-[#78716c]">Artiste</em></>
                        )}
                    </h1>
                </div>

                {loadingStates.loadingIPFS && (
                    <p className="text-[12px] font-light text-[#a8a29e] tracking-[0.06em] mb-6 text-center">
                        Chargement des données IPFS…
                    </p>
                )}

                {isRegistered && (
                    <div className="border border-[#d6d0c8] bg-[#ede9e3] p-6 mb-px">
                        <p className="text-[14px] font-medium text-[#1c1917] mb-2">
                            QR Code de votre page artiste
                        </p>
                        <p className="text-[13px] font-light text-[#78716c] mb-4 leading-[1.7]">
                            Téléchargez votre QR code pour le partager avec vos collectionneurs. Il pointe vers votre page artiste.
                        </p>
                        <button
                            onClick={downloadArtistPageQRCode}
                            disabled={loadingStates.generatingQR}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200"
                        >
                            {loadingStates.generatingQR ? 'Génération…' : 'Télécharger mon QR Code'}
                        </button>
                    </div>
                )}

                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Nom de l'artiste / atelier *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Atelier Claire Dubois"
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Localisation *
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Paris, Île-de-France, France"
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                maxLength={256}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Biographie
                            </label>
                            <textarea
                                value={additionalData.bio}
                                onChange={(e) => setAdditionalData({...additionalData, bio: e.target.value})}
                                placeholder="Présentez votre démarche artistique, votre style, vos inspirations..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[120px]"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Logo / Portrait
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
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] hover:bg-[#e7e3dc] transition-colors text-left"
                            >
                                {logoFile ? logoFile.name : 'Choisir un logo'}
                            </button>
                            {logoPreview && (
                                <div className="mt-3">
                                    <img
                                        src={logoPreview}
                                        alt="Aperçu du logo"
                                        className="w-24 h-24 object-contain border border-[#d6d0c8] bg-[#f5f3ef]"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Portfolio — Photos de l'atelier / œuvres
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
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] hover:bg-[#e7e3dc] transition-colors text-left"
                            >
                                {photoFiles.length > 0
                                    ? `${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''} sélectionnée${photoFiles.length > 1 ? 's' : ''}`
                                    : 'Sélectionner des photos'}
                            </button>
                            {photoPreviews.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {photoPreviews.map((preview, index) => (
                                        <div key={index} className="relative">
                                            <img
                                                src={preview}
                                                alt={`Photo ${index + 1}`}
                                                className="w-full h-24 object-cover border border-[#d6d0c8] bg-[#e7e3dc]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(index)}
                                                className="absolute top-1 right-1 bg-[#1c1917] text-[#fafaf8] w-5 h-5 flex items-center justify-center text-xs hover:bg-[#292524] transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Site web
                            </label>
                            <input
                                type="url"
                                value={additionalData.website}
                                onChange={(e) => setAdditionalData({...additionalData, website: e.target.value})}
                                placeholder="https://mon-atelier.fr"
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Expositions
                            </label>
                            <textarea
                                value={additionalData.exhibitions.join('\n')}
                                onChange={(e) => setAdditionalData({
                                    ...additionalData,
                                    exhibitions: e.target.value.split('\n').filter(Boolean)
                                })}
                                placeholder={"2024 — Galerie Perrotin, Paris\n2023 — Art Basel, Bâle"}
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors min-h-[100px]"
                            />
                            <p className="text-[11px] text-[#a8a29e] mt-1">Une exposition par ligne</p>
                        </div>

                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                Réseaux sociaux
                            </label>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.instagram}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, instagram: e.target.value }
                                    })}
                                    placeholder="Instagram (@handle)"
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                />
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.twitter}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, twitter: e.target.value }
                                    })}
                                    placeholder="Twitter / X (@handle)"
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                />
                                <input
                                    type="text"
                                    value={additionalData.socialMedia.facebook}
                                    onChange={(e) => setAdditionalData({
                                        ...additionalData,
                                        socialMedia: { ...additionalData.socialMedia, facebook: e.target.value }
                                    })}
                                    placeholder="Facebook (URL ou @page)"
                                    className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                />
                            </div>
                        </div>

                        {saveSuccess && (
                            <div className="border border-[#d6d0c8] bg-[#f0fdf4] p-4">
                                <p className="text-[13px] font-medium text-[#166534]">
                                    Informations enregistrées avec succès. La transaction est en cours de confirmation sur la blockchain.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isRegistering || loadingStates.uploading || loadingStates.loadingIPFS}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                        >
                            {loadingStates.uploading
                                ? 'Upload IPFS en cours…'
                                : isRegistering
                                    ? 'Enregistrement en cours…'
                                    : isRegistered
                                        ? 'Mettre à jour'
                                        : 'Enregistrer'}
                        </button>
                    </form>
                </div>

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