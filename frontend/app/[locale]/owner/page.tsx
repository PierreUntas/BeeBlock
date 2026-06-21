'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { useTranslations } from 'next-intl';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';

export default function AdminPage() {
    const t = useTranslations('Owner');
    const { address } = useAccount();
    const [newAdminAddress, setNewAdminAddress] = useState('');
    const [removeAdminAddress, setRemoveAdminAddress] = useState('');
    const [checkAdminAddress, setCheckAdminAddress] = useState('');
    const [isOwner, setIsOwner] = useState(false);
    const [isCheckingOwner, setIsCheckingOwner] = useState(true);

    const { writeContract, isPending: isAddingAdmin } = useWriteContract();
    const { writeContract: writeRemoveAdmin, isPending: isRemovingAdmin } = useWriteContract();

    const { data: ownerAddress, isLoading: isLoadingOwner } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'owner',
    });

    const { data: isAdminResult } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'isAdmin',
        args: checkAdminAddress ? [checkAdminAddress as `0x${string}`] : undefined,
    });

    useEffect(() => {
        if (address && ownerAddress) {
            setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
            setIsCheckingOwner(false);
        } else if (!isLoadingOwner) {
            setIsCheckingOwner(false);
        }
    }, [address, ownerAddress, isLoadingOwner]);

    const handleAddAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminAddress) return;
        writeContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'addAdmin',
            args: [newAdminAddress as `0x${string}`],
        });
        setNewAdminAddress('');
    };

    const handleRemoveAdmin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!removeAdminAddress) return;
        writeRemoveAdmin({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'removeAdmin',
            args: [removeAdminAddress as `0x${string}`],
        });
        setRemoveAdminAddress('');
    };

    if (isCheckingOwner || isLoadingOwner) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
                    <div className="w-8 h-8 border border-[#d6d0c8] border-t-[#1c1917] rounded-full animate-spin" />
                    <p className="text-[13px] font-light text-[#a8a29e] tracking-[0.06em]">{t('checkingPermissions')}</p>
                </div>
            </div>
        );
    }

    if (!address) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="italic text-[18px] text-[#a8a29e] text-center max-w-md px-6">{t('notConnected')}</p>
                </div>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-[#f5f3ef]">
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <p className="italic text-[18px] text-[#a8a29e] text-center max-w-md px-6">
                        {t('notOwner')}
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
                        alt={t('logoAlt')}
                        className="w-[100px] h-[100px] object-contain mx-auto mb-6"
                    />
                    <h1 className=" text-[clamp(32px,5vw,48px)] font-normal tracking-[-1px] text-[#1c1917] leading-tight">
                        {t('titleStart')} <em className="italic text-[#78716c]">{t('titleAccent')}</em>
                    </h1>
                </div>

                {/* Add an admin */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        {t('addTitleStart')} <em className="italic text-[#78716c]">{t('addTitleAccent')}</em>
                    </h2>
                    <form onSubmit={handleAddAdmin} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('addressLabel')}
                            </label>
                            <input
                                type="text"
                                value={newAdminAddress}
                                onChange={(e) => setNewAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAddingAdmin}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] uppercase py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                        >
                            {isAddingAdmin ? t('addingButton') : t('addButton')}
                        </button>
                    </form>
                </div>

                {/* Remove an admin */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        {t('removeTitleStart')} <em className="italic text-[#78716c]">{t('removeTitleAccent')}</em>
                    </h2>
                    <form onSubmit={handleRemoveAdmin} className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('addressLabel')}
                            </label>
                            <input
                                type="text"
                                value={removeAdminAddress}
                                onChange={(e) => setRemoveAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isRemovingAdmin}
                            className="w-full bg-[#1c1917] text-[#fafaf8] font-medium text-[12px] tracking-[0.06em] uppercase py-3.5 px-8 border border-[#1c1917] disabled:opacity-50 hover:bg-[#292524] transition-all duration-200 cursor-pointer"
                        >
                            {isRemovingAdmin ? t('removingButton') : t('removeButton')}
                        </button>
                    </form>
                </div>

                {/* Check admin status */}
                <div className="border border-[#d6d0c8] bg-[#fafaf8] p-8 mb-px">
                    <h2 className=" text-[22px] font-normal text-[#1c1917] mb-5">
                        {t('checkTitleStart')} <em className="italic text-[#78716c]">{t('checkTitleAccent')}</em>
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[12px] font-normal tracking-[0.12em] uppercase text-[#a8a29e] mb-2">
                                {t('checkAddressLabel')}
                            </label>
                            <input
                                type="text"
                                value={checkAdminAddress}
                                onChange={(e) => setCheckAdminAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-[#f5f3ef] border border-[#d6d0c8] font-mono text-[13px] text-[#1c1917] placeholder:text-[#a8a29e] focus:outline-none focus:border-[#1c1917] transition-colors"
                                pattern="^0x[a-fA-F0-9]{40}$"
                            />
                        </div>
                        {checkAdminAddress && isAdminResult !== undefined && (
                            <div className="p-4 border border-[#d6d0c8] bg-[#f5f3ef] text-[14px] font-light text-[#1c1917]">
                                {isAdminResult ? t('isAdminYes') : t('isAdminNo')}
                            </div>
                        )}
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
