"use client"

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useReadContract } from "wagmi";
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import ThemeToggle from "@/components/shared/ThemeToggle";

export default function Navbar() {
    const t = useTranslations('Navbar');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const { login, logout, authenticated, user, exportWallet } = usePrivy();
    const { address, chain } = useAccount();

    const switchLocale = (newLocale: 'fr' | 'de' | 'en') => {
        router.replace(pathname, { locale: newLocale });
    };

    const [isOwner, setIsOwner] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isArtist, setIsArtist] = useState(false);

    const wallet = user?.wallet || user?.linkedAccounts?.find((a: any) => a.type === 'wallet');
    const walletAddress = (wallet as any)?.address;
    const chainId = (wallet as any)?.chainId;
    
    const activeAddress = walletAddress || address;
    
    const getNetworkName = () => {
        if (chain) {
            switch(chain.id) {
                case 8453: return 'Base';
                case 84532: return 'Base Sepolia';
                case 11155111: return 'Sepolia';
                case 1: return 'Ethereum';
                default: return chain.name;
            }
        }
        if (chainId) {
            const numId = typeof chainId === 'string' ? parseInt(chainId.replace('eip155:', '')) : chainId;
            switch(numId) {
                case 8453: return 'Base';
                case 84532: return 'Base Sepolia';
                case 11155111: return 'Sepolia';
                case 1: return 'Ethereum';
                default: return `Chain ${numId}`;
            }
        }
        return 'Non connecté';
    };

    const networkName = getNetworkName();

    const { data: ownerAddress } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'owner',
    });
    const { data: isAdminResult } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'isAdmin',
        args: activeAddress ? [activeAddress] : undefined,
    });
    const { data: artistData } = useReadContract({
        address: ARTWORK_REGISTRY_ADDRESS,
        abi: ARTWORK_REGISTRY_ABI,
        functionName: 'getArtist',
        args: activeAddress ? [activeAddress] : undefined,
    });

    useEffect(() => {
        if (activeAddress && ownerAddress)
            setIsOwner(activeAddress.toLowerCase() === (ownerAddress as string).toLowerCase());
    }, [activeAddress, ownerAddress]);

    useEffect(() => {
        if (isAdminResult !== undefined) setIsAdmin(isAdminResult as boolean);
    }, [isAdminResult]);

    useEffect(() => {
        if (artistData) setIsArtist((artistData as any).authorized === true);
    }, [artistData]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const copyAddress = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <>
            {/* Top bar */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-10 transition-all duration-300
                    bg-[var(--bg-page)]/95 backdrop-blur-md
                    ${scrolled ? 'border-b border-[var(--border)] shadow-sm' : 'border-b border-transparent'}`}
            >
                {/* Logo — SVG monochrome noir, inversé en blanc via CSS filter en dark mode */}
                <a href="/" className="flex items-center gap-2.5 group no-underline">
                    <img
                        src="/logo-mona.svg"
                        alt="Mona Editions Logo"
                        className="w-[100px] h-[100px] object-contain flex-shrink-0 dark:invert"
                    />
                </a>

                {/* Center links */}
                <nav className="hidden md:flex gap-9 absolute left-1/2 -translate-x-1/2">
                    {[
                        { href: '/explore/editions', label: t('gallery') },
                        { href: '/explore/artists', label: t('artists') },
                        { href: '/about', label: t('about') },
                    ].map(({ href, label }) => (
                        <a key={href} href={locale === 'fr' ? href : `/${locale}${href}`}
                            className="text-xs font-normal tracking-[0.06em] text-[var(--text-secondary)] no-underline
                                pb-0.5 border-b border-transparent
                                hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all duration-200">
                            {label}
                        </a>
                    ))}
                </nav>

                {/* Right */}
                <div className="flex items-center gap-2.5">
                    {/* Theme toggle (light / dark) — placed just before the
                        language switcher so all user preferences group together. */}
                    <ThemeToggle />

                    {/* Language switcher — compact popover on all viewports.
                        Shows the active locale as a button; popover lists the
                        other available locales for one-click switch. */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setLangOpen(o => !o)}
                            aria-label="Language switcher"
                            aria-haspopup="true"
                            aria-expanded={langOpen}
                            className="flex items-center gap-1 border border-[var(--border)] bg-[var(--bg-card)] h-8 px-2.5
                                text-[10px] font-medium tracking-[0.08em] text-[var(--text-primary)]
                                hover:border-[var(--text-primary)] transition-all duration-200 cursor-pointer"
                        >
                            {locale.toUpperCase()}
                            <svg
                                width="8"
                                height="8"
                                viewBox="0 0 10 6"
                                fill="none"
                                className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            >
                                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        {langOpen && (
                            <>
                                {/* Click-outside backdrop */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setLangOpen(false)}
                                />
                                <div
                                    role="menu"
                                    className="absolute right-0 top-full mt-1 z-50 min-w-[60px] bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col"
                                >
                                    {(['fr', 'de', 'en'] as const).filter(l => l !== locale).map(l => (
                                        <button
                                            key={l}
                                            type="button"
                                            onClick={() => { switchLocale(l); setLangOpen(false); }}
                                            role="menuitem"
                                            className="text-[10px] font-medium tracking-[0.08em] uppercase text-[var(--text-secondary)]
                                                px-3 py-2 hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)] transition-colors cursor-pointer
                                                border-b border-[var(--border-soft)] last:border-b-0 text-left"
                                        >
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {authenticated ? (
                        <div
                            onClick={() => setIsOpen(!isOpen)}
                            className="w-8 h-8 border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-center
                                 italic text-sm text-[var(--text-secondary)] cursor-pointer
                                hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all duration-200">
                            {user?.email?.address?.[0]?.toUpperCase() ?? '?'}
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="text-[11px] font-medium tracking-[0.08em] text-[var(--text-primary)] bg-transparent
                                border border-[var(--border)] px-[18px] py-[7px] cursor-pointer
                                hover:bg-[var(--bg-inverse)] hover:text-[var(--text-on-inverse)] hover:border-[var(--text-primary)] transition-all duration-200">
                            {t('connect')}
                        </button>
                    )}

                    {/* Hamburger */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-8 h-8 border border-[var(--border)] bg-[var(--bg-card)] flex flex-col items-center justify-center gap-1
                            cursor-pointer hover:border-[var(--text-primary)] transition-all duration-200 p-0"
                        aria-label={t('menu')}
                    >
                        <span className={`block w-3.5 h-px bg-[var(--text-secondary)] transition-all duration-250
                            ${isOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
                        <span className={`block w-3.5 h-px bg-[var(--text-secondary)] transition-all duration-250
                            ${isOpen ? 'opacity-0' : ''}`} />
                        <span className={`block w-3.5 h-px bg-[var(--text-secondary)] transition-all duration-250
                            ${isOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-[var(--bg-inverse)]/40 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Slide panel */}
            <nav className={`fixed top-0 right-0 h-screen w-[300px] z-50 bg-[var(--bg-page)] border-l border-[var(--border)]
                flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                <div className="flex flex-col h-full pt-20">

                    {/* Auth section */}
                    <div className="px-6 pb-5 border-b border-[var(--border)]">
                        {authenticated ? (
                            <div className="space-y-2.5">
                                <div className="border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
                                    <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-1.5">
                                        {t('connected')}
                                    </p>
                                    {user?.email?.address && (
                                        <p className="text-[13px] text-[var(--text-primary)] truncate mb-1">
                                            {user.email.address}
                                        </p>
                                    )}
                                    {walletAddress && (
                                        <>
                                            <button
                                                onClick={copyAddress}
                                                className="text-[11px] font-mono text-[var(--text-secondary)] bg-transparent border-0 p-0
                                                    cursor-pointer flex items-center gap-2 w-full">
                                                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                                                <span className="ml-auto text-[#4a5240]">{copied ? '✓' : '⧉'}</span>
                                            </button>
                                            {user?.wallet && (
                                                <button
                                                    onClick={() => exportWallet()}
                                                    className="mt-1.5 text-[10px] tracking-[0.06em] text-[var(--text-muted)] bg-transparent border-0 p-0
                                                        cursor-pointer hover:text-[var(--text-secondary)] transition-colors duration-150 text-left">
                                                    {t('exportPrivateKey')}
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {(isOwner || isAdmin || isArtist) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border-soft)]">
                                            {isOwner && <RoleBadge>{t('roles.owner')}</RoleBadge>}
                                            {isAdmin && <RoleBadge>{t('roles.admin')}</RoleBadge>}
                                            {isArtist && <RoleBadge>{t('roles.artist')}</RoleBadge>}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { logout(); setIsOpen(false); }}
                                    className="w-full text-xs font-normal text-[var(--text-secondary)] bg-transparent
                                        border border-[var(--border)] py-2.5 cursor-pointer
                                        hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all duration-200">
                                    {t('logout')}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { login(); setIsOpen(false); }}
                                className="w-full text-xs font-medium tracking-[0.06em] text-[var(--text-on-inverse)] bg-[var(--bg-inverse)]
                                    border-0 py-3 cursor-pointer hover:opacity-80 transition-opacity duration-200">
                                {t('signIn')}
                            </button>
                        )}
                    </div>

                    {/* Nav links */}
                    <div className="flex-1 px-6 py-4 overflow-y-auto space-y-0.5">
                        <PanelLink locale={locale} href="/" onClick={() => setIsOpen(false)}>{t('panel.home')}</PanelLink>

                        <PanelDivider>{t('panel.explore')}</PanelDivider>
                        <PanelLink locale={locale} href="/explore/editions" onClick={() => setIsOpen(false)}>{t('panel.galleryWorks')}</PanelLink>
                        <PanelLink locale={locale} href="/explore/artists" onClick={() => setIsOpen(false)}>{t('panel.artistsList')}</PanelLink>

                        <PanelDivider>{t('panel.info')}</PanelDivider>
                        <PanelLink locale={locale} href="/about" onClick={() => setIsOpen(false)}>{t('panel.aboutLink')}</PanelLink>

                        {(isOwner || isAdmin) && (
                            <>
                                <PanelDivider>{t('panel.admin')}</PanelDivider>
                                {isOwner && <PanelLink locale={locale} href="/owner" onClick={() => setIsOpen(false)}>{t('panel.owner')}</PanelLink>}
                                {isAdmin && <PanelLink locale={locale} href="/admin" onClick={() => setIsOpen(false)}>{t('panel.adminLink')}</PanelLink>}
                            </>
                        )}

                        {authenticated && (
                            <>
                                <PanelDivider>{t('panel.collector')}</PanelDivider>
                                <PanelLink locale={locale} href="/collector" onClick={() => setIsOpen(false)}>{t('panel.myWorks')}</PanelLink>
                            </>
                        )}

                        {isArtist && (
                            <>
                                <PanelDivider>{t('panel.artist')}</PanelDivider>
                                <PanelLink locale={locale} href="/artist" onClick={() => setIsOpen(false)}>{t('panel.myDashboard')}</PanelLink>
                                <PanelLink locale={locale} href="/artist/editions" onClick={() => setIsOpen(false)}>{t('panel.myArtworks')}</PanelLink>
                                <PanelLink locale={locale} href="/artist/editions/create" onClick={() => setIsOpen(false)}>{t('panel.certifyWork')}</PanelLink>
                                <PanelLink locale={locale} href="/artist/profile" onClick={() => setIsOpen(false)}>{t('panel.myProfile')}</PanelLink>
                                <PanelLink locale={locale} href="/artist/subscription" onClick={() => setIsOpen(false)}>{t('panel.mySubscription')}</PanelLink>
                            </>
                        )}

                    </div>

                    {/* Panel footer */}
                    <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
                        <span className=" italic text-[13px] text-[var(--text-muted)]">Mona Editions</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-light text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4a5240] inline-block" />
                            {networkName}
                        </span>
                    </div>
                </div>
            </nav>
        </>
    );
}

function PanelLink({
    href,
    children,
    onClick,
    locale,
}: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    locale?: string;
}) {
    // Prepend the locale prefix only when it's a non-default locale.
    // Default locale ('fr') stays at the root for backward compatibility
    // with existing URLs (e.g. QR codes already deployed in the wild).
    // Non-default locales (de, en, ...) get prefixed.
    const localizedHref =
        !locale || locale === 'fr' ? href : `/${locale}${href === '/' ? '' : href}`;
    return (
        <a href={localizedHref} onClick={onClick}
            className="block text-[13px] font-light text-[var(--text-secondary)] no-underline
                px-3 py-2.5 border-l border-transparent
                hover:text-[var(--text-primary)] hover:border-l-[var(--text-primary)] hover:pl-4 hover:bg-[var(--bg-inverse)]/[0.03]
                transition-all duration-150">
            {children}
        </a>
    );
}

function PanelDivider({ children }: { children: React.ReactNode }) {
    return (
        <div className="pt-4 pb-1.5 px-3">
            <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)]">
                {children}
            </p>
        </div>
    );
}

function RoleBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[10px] font-medium tracking-[0.06em] text-[#4a5240]
            border border-[#4a5240] px-2 py-0.5">
            {children}
        </span>
    );
}