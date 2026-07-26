'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { parseAbiItem } from 'viem';
import {
    ARTWORK_REGISTRY_ADDRESS,
    ARTWORK_REGISTRY_ABI,
} from '@/config/contracts';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';
import { publicClient, getDeploymentBlock } from '@/lib/client';

interface RecentEdition {
    tokenId: bigint;
    title: string;
    imageUrl: string | null;
    artistName: string;
}

export default function Home() {
    const t = useTranslations('Home');
    const { login, authenticated } = usePrivy();
    const [recent, setRecent] = useState<RecentEdition[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchRecent = async () => {
            try {
                const logs = await publicClient.getLogs({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    event: parseAbiItem(
                        'event NewArtworkEdition(address indexed artist, uint indexed editionId)',
                    ),
                    fromBlock: getDeploymentBlock(),
                    toBlock: 'latest',
                });
                const latest = logs.slice(-3).reverse();
                const resolved = await Promise.all(
                    latest.map(async (log) => {
                        try {
                            const tokenId = log.args.editionId as bigint;
                            const artistAddress = log.args.artist as `0x${string}`;
                            const [editionData, artistInfo] = await Promise.all([
                                publicClient.readContract({
                                    address: ARTWORK_REGISTRY_ADDRESS,
                                    abi: ARTWORK_REGISTRY_ABI,
                                    functionName: 'getArtworkEdition',
                                    args: [tokenId],
                                }) as Promise<readonly [string, string, boolean]>,
                                publicClient.readContract({
                                    address: ARTWORK_REGISTRY_ADDRESS,
                                    abi: ARTWORK_REGISTRY_ABI,
                                    functionName: 'getArtist',
                                    args: [artistAddress],
                                }) as Promise<{ authorized: boolean; metadata: string }>,
                            ]);

                            const [editionMeta, artistMeta] = await Promise.all([
                                getFromIPFSGateway(editionData[0]).catch(() => null),
                                artistInfo.metadata
                                    ? getFromIPFSGateway(artistInfo.metadata).catch(() => null)
                                    : Promise.resolve(null),
                            ]);

                            const title = (editionMeta as any)?.title || 'Œuvre certifiée';
                            const artistName = (artistMeta as any)?.name || 'Artiste';
                            const firstImage = (editionMeta as any)?.images?.[0];
                            const imageUrl = firstImage ? ipfsToHttp(firstImage) : null;

                            return { tokenId, title, imageUrl, artistName } as RecentEdition;
                        } catch {
                            return null;
                        }
                    }),
                );
                if (!cancelled) {
                    setRecent(resolved.filter(Boolean) as RecentEdition[]);
                }
            } catch (e) {
                console.warn('Failed to load recent editions:', e);
            } finally {
                if (!cancelled) setLoadingRecent(false);
            }
        };
        fetchRecent();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen bg-[var(--bg-page)]">
            <div className="max-w-[1080px] mx-auto px-6 pt-28 pb-20">

                {/* Hero */}
                <section className="text-center mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[var(--text-muted)] mb-6">
                        {t('hero.eyebrow')}
                    </p>
                    <h1 className="text-[clamp(44px,7vw,72px)] font-normal tracking-[-1.5px] leading-[1.05] mb-7 text-[var(--text-primary)]">
                        {t('hero.titleStart')} <em className="italic text-[var(--text-secondary)]">{t('hero.titleAccent')}</em><br />
                        {t('hero.titleEnd')}
                    </h1>
                    <p className="text-[15px] font-light leading-[1.8] text-[var(--text-secondary)] max-w-[540px] mx-auto">
                        {t('hero.subtitle')}
                    </p>
                </section>

                {/* 3 cards personas */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-px mb-24 bg-[var(--border)] border border-[var(--border)]">
                    <PersonaCard
                        eyebrow={t('personas.artist.eyebrow')}
                        title={t('personas.artist.title')}
                        description={t('personas.artist.description')}
                        cta={t('personas.artist.cta')}
                        href="/artist"
                    />
                    <PersonaCard
                        eyebrow={t('personas.collector.eyebrow')}
                        title={t('personas.collector.title')}
                        description={t('personas.collector.description')}
                        cta={t('personas.collector.cta')}
                        href="/collector"
                    />
                    <PersonaCard
                        eyebrow={t('personas.visitor.eyebrow')}
                        title={t('personas.visitor.title')}
                        description={t('personas.visitor.description')}
                        cta={t('personas.visitor.cta')}
                        href="/explore/editions"
                    />
                </section>

                {/* Comment ça marche */}
                <section className="mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[var(--text-muted)] mb-3 text-center">
                        {t('howItWorks.eyebrow')}
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] mb-12 text-[var(--text-primary)] text-center">
                        {t('howItWorks.title')} <em className="italic text-[var(--text-secondary)]">{t('howItWorks.titleAccent')}</em>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                        <Step number="01" title={t('howItWorks.step1.title')}>
                            {t('howItWorks.step1.description')}
                        </Step>
                        <Step number="02" title={t('howItWorks.step2.title')}>
                            {t('howItWorks.step2.description')}
                        </Step>
                        <Step number="03" title={t('howItWorks.step3.title')}>
                            {t('howItWorks.step3.description')}
                        </Step>
                    </div>
                </section>

                {/* Galerie aperçu */}
                {(loadingRecent || recent.length > 0) && (
                    <section className="mb-24">
                        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                            <div>
                                <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[var(--text-muted)] mb-2">
                                    {t('gallery.eyebrow')}
                                </p>
                                <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] text-[var(--text-primary)]">
                                    {t('gallery.titleStart')} <em className="italic text-[var(--text-secondary)]">{t('gallery.titleAccent')}</em>
                                </h2>
                            </div>
                            <Link
                                href="/explore/editions"
                                className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] hover:opacity-60 inline-flex items-center gap-2 transition-opacity no-underline"
                            >
                                <span className="hidden sm:inline">{t('gallery.viewAll')}</span>
                                <span className="inline-block w-12 h-px bg-[var(--bg-inverse)]" />
                            </Link>
                        </div>

                        {loadingRecent ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div className="aspect-[4/5] bg-[var(--bg-card-alt)] animate-pulse" />
                                <div className="grid grid-rows-2 gap-4 md:gap-6">
                                    <div className="bg-[var(--bg-card-alt)] animate-pulse" />
                                    <div className="bg-[var(--bg-card-alt)] animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {recent[0] && (
                                    <ArtworkTile
                                        edition={recent[0]}
                                        variant="featured"
                                        eyebrow={t('gallery.featured')}
                                        noImageLabel={t('gallery.noImage')}
                                    />
                                )}
                                <div className="grid grid-rows-1 md:grid-rows-2 gap-4 md:gap-6">
                                    {recent[1] && (
                                        <ArtworkTile
                                            edition={recent[1]}
                                            variant="secondary"
                                            noImageLabel={t('gallery.noImage')}
                                        />
                                    )}
                                    {recent[2] && (
                                        <ArtworkTile
                                            edition={recent[2]}
                                            variant="secondary"
                                            noImageLabel={t('gallery.noImage')}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Pérennité / Sécurité */}
                <section className="mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[var(--text-muted)] mb-3 text-center">
                        {t('trust.eyebrow')}
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] mb-12 text-[var(--text-primary)] text-center">
                        {t('trust.titleStart')} <em className="italic text-[var(--text-secondary)]">{t('trust.titleAccent')}</em>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
                        <TrustCell title={t('trust.blockchain.title')}>
                            {t('trust.blockchain.description')}
                        </TrustCell>
                        <TrustCell title={t('trust.contracts.title')}>
                            {t('trust.contracts.description')}
                        </TrustCell>
                        <TrustCell title={t('trust.ipfs.title')}>
                            {t('trust.ipfs.description')}
                        </TrustCell>
                    </div>
                </section>

                {/* CTA final (visiteurs non authentifiés seulement) */}
                {!authenticated && (
                    <section className="border border-[var(--border)] bg-[var(--bg-inverse)] py-16 px-10 text-center">
                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-on-inverse)]/40 mb-5">
                            {t('cta.eyebrow')}
                        </p>
                        <h2 className="text-[clamp(28px,4vw,40px)] font-normal text-[var(--text-on-inverse)] leading-[1.2] mb-4 tracking-[-0.5px]">
                            {t('cta.titleStart')} <em className="italic text-[var(--text-on-inverse)]/55">{t('cta.titleAccent')}</em>
                        </h2>
                        <p className="text-[14px] font-light text-[var(--text-on-inverse)]/65 max-w-[420px] mx-auto mb-7 leading-[1.7]">
                            {t('cta.subtitle')}
                        </p>
                        <button
                            onClick={login}
                            className="text-[12px] font-medium tracking-[0.06em] text-[var(--bg-inverse)] bg-[var(--text-on-inverse)] py-3.5 px-8 cursor-pointer hover:bg-[var(--bg-page)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)] transition-all duration-200"
                        >
                            {t('cta.button')}
                        </button>
                    </section>
                )}

                {/* About link */}
                <div className="text-center mt-10">
                    <Link
                        href="/about"
                        className="text-[12px] font-normal tracking-[0.06em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 transition-colors"
                    >
                        {t('aboutLink')}
                    </Link>
                </div>

            </div>
        </div>
    );
}

/* ───────────────────────────── Sub-components ─────────────────────────────── */

function PersonaCard({
    eyebrow,
    title,
    description,
    cta,
    href,
}: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="bg-[var(--bg-card)] p-8 flex flex-col group no-underline hover:bg-[var(--bg-card-alt)] transition-colors duration-300"
        >
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[var(--text-muted)] mb-4">
                {eyebrow}
            </p>
            <h3 className="text-[22px] font-normal text-[var(--text-primary)] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7] mb-7 flex-1">
                {description}
            </p>
            <span className="text-[12px] font-medium tracking-[0.06em] text-[var(--text-primary)] group-hover:translate-x-1 transition-transform inline-block">
                {cta} →
            </span>
        </Link>
    );
}

function Step({
    number,
    title,
    children,
}: {
    number: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <p className="text-[40px] font-light text-[var(--border)] leading-none mb-4 tracking-tight">
                {number}
            </p>
            <h3 className="text-[18px] font-normal text-[var(--text-primary)] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">
                {children}
            </p>
        </div>
    );
}

function TrustCell({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-[var(--bg-card)] p-8">
            <h3 className="text-[16px] font-medium text-[var(--text-primary)] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[var(--text-secondary)] leading-[1.7]">
                {children}
            </p>
        </div>
    );
}

function ArtworkTile({
    edition,
    variant,
    eyebrow,
    noImageLabel,
}: {
    edition: RecentEdition;
    variant: 'featured' | 'secondary';
    eyebrow?: string;
    noImageLabel: string;
}) {
    const aspectClass =
        variant === 'featured' ? 'aspect-[4/5] md:h-full' : 'aspect-[16/10] md:h-full';

    return (
        <Link
            href={`/explore/edition/${edition.tokenId}`}
            className={`group relative block overflow-hidden bg-[var(--bg-inverse)] no-underline ${aspectClass}`}
        >
            {edition.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={edition.imageUrl}
                    alt={edition.title}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out group-hover:scale-[1.04] group-hover:opacity-90"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--text-on-inverse)]/55 tracking-[0.1em] uppercase">
                    {noImageLabel}
                </div>
            )}

            {eyebrow && (
                <div className="absolute top-5 left-5 z-10">
                    <span className="inline-block text-[10px] font-medium tracking-[0.18em] uppercase text-white bg-[#1c1917]/80 backdrop-blur-sm px-3 py-1.5">
                        {eyebrow}
                    </span>
                </div>
            )}

            <div className="absolute inset-x-0 bottom-0 z-10 p-6 bg-gradient-to-t from-[#1c1917]/85 via-[#1c1917]/40 to-transparent">
                <p
                    className={`font-normal text-white leading-tight tracking-[-0.5px] mb-1 ${variant === 'featured' ? 'text-[22px] md:text-[28px]' : 'text-[16px] md:text-[18px]'}`}
                >
                    {edition.title}
                </p>
                <p
                    className={`font-light text-white/70 italic ${variant === 'featured' ? 'text-[14px]' : 'text-[12px]'}`}
                >
                    {edition.artistName}
                </p>
            </div>

            <div className="absolute inset-3 border border-white/0 group-hover:border-white/30 transition-colors duration-500 pointer-events-none" />
        </Link>
    );
}
