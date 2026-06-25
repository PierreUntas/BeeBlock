"use client";

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useReadContract } from 'wagmi';
import { useEffect, useState } from 'react';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';

const Footer = () => {
    const t = useTranslations('Footer');
    const { authenticated } = usePrivy();
    const { address } = useAccount();
    const [isArtist, setIsArtist] = useState(false);

    const { data: artistData } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: address ? [address] : undefined,
    });

    useEffect(() => {
        if (artistData) setIsArtist((artistData as any).authorized === true);
    }, [artistData]);

    const colCount = 2 + (authenticated ? 1 : 0) + (isArtist ? 1 : 0);
    const gridClass = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
    }[colCount] ?? 'md:grid-cols-2';

    return (
        <footer className="bg-[var(--bg-page)] border-t border-[var(--border)] mt-auto">
            <div className="max-w-6xl mx-auto px-6 py-16">

                {/* Top row — sections conditionnelles */}
                <div className={`grid grid-cols-1 ${gridClass} gap-12 pb-12 border-b border-[var(--border)]`}>

                    {/* Brand */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo-mona.svg"
                                alt="Mona Editions Logo"
                                className="w-28 h-14 object-contain dark:invert"
                            />
                        </div>
                        <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7] max-w-[220px]">
                            {t('tagline')}
                        </p>
                    </div>

                    {/* Explorer — toujours visible */}
                    <div className="flex flex-col gap-4">
                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                            {t('exploreTitle')}
                        </p>
                        <nav className="flex flex-col gap-2.5">
                            <FooterLink href="/explore/editions">{t('galleryWorks')}</FooterLink>
                            <FooterLink href="/explore/artists">{t('artistsList')}</FooterLink>
                            <FooterLink href="/about">{t('aboutLink')}</FooterLink>
                        </nav>
                    </div>

                    {/* Collectionneur — connecté uniquement */}
                    {authenticated && (
                        <div className="flex flex-col gap-4">
                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                                {t('collectorTitle')}
                            </p>
                            <nav className="flex flex-col gap-2.5">
                                <FooterLink href="/collector">{t('myCertificates')}</FooterLink>
                            </nav>
                        </div>
                    )}

                    {/* Espace artiste — artiste autorisé uniquement */}
                    {isArtist && (
                        <div className="flex flex-col gap-4">
                            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                                {t('artistTitle')}
                            </p>
                            <nav className="flex flex-col gap-2.5">
                                <FooterLink href="/artist">{t('dashboard')}</FooterLink>
                                <FooterLink href="/artist/editions">{t('myArtworks')}</FooterLink>
                                <FooterLink href="/artist/editions/create">{t('certifyWork')}</FooterLink>
                            </nav>
                        </div>
                    )}
                </div>

                {/* Contact + Légal — ligne unique */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-6 border-b border-[var(--border)]">
                    <a href="mailto:pierre.untas@gmail.com" className="text-[12px] font-light text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors no-underline">pierre.untas@gmail.com</a>
                    <span className="text-[var(--border)]">·</span>
                    <FooterLink href="/contact">{t('contactUs')}</FooterLink>
                    <span className="text-[var(--border)]">·</span>
                    <FooterLink href="/faq">{t('faq')}</FooterLink>
                    <span className="text-[var(--border)]">·</span>
                    <FooterLink href="/legal/mentions">{t('legalNotice')}</FooterLink>
                    <span className="text-[var(--border)]">·</span>
                    <FooterLink href="/legal/terms">{t('termsOfService')}</FooterLink>
                    <span className="text-[var(--border)]">·</span>
                    <FooterLink href="/legal/privacy">{t('privacyPolicy')}</FooterLink>
                </div>

                {/* Copyright */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
                    <div className="flex items-center gap-3">
                        <div className="w-px h-4 bg-[var(--border)]" />
                        <span className=" italic text-[13px] text-[var(--text-muted)]">Mona Editions</span>
                    </div>
                    <p className="text-[12px] font-light text-[var(--text-muted)] tracking-[0.04em]">
                        &copy; Mona Editions {new Date().getFullYear()} — {t('copyright')}
                    </p>
                </div>
            </div>
        </footer>
    );
};

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="text-[13px] font-light text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors no-underline">
            {children}
        </Link>
    );
}

export default Footer;