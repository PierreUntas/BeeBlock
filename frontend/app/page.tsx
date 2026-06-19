'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
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
    const { login, authenticated } = usePrivy();
    const [recent, setRecent] = useState<RecentEdition[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);

    /**
     * Fetch the 4 most recent NewArtworkEdition events and resolve their
     * IPFS metadata for display in the homepage gallery preview.
     * Best-effort: silent failure leaves the section empty.
     */
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
                // Take the 3 most recent (1 featured + 2 secondary in the layout below)
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
                            const artistName =
                                (artistMeta as any)?.name || 'Artiste';
                            const firstImage = (editionMeta as any)?.images?.[0];
                            const imageUrl = firstImage ? ipfsToHttp(firstImage) : null;

                            return {
                                tokenId,
                                title,
                                imageUrl,
                                artistName,
                            } as RecentEdition;
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
        <div className="min-h-screen bg-[#f5f3ef]">
            <div className="max-w-[1080px] mx-auto px-6 pt-28 pb-20">

                {/* ─── Hero ─────────────────────────────────────────────── */}
                <section className="text-center mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-6">
                        Plateforme de certification d'art
                    </p>
                    <h1 className="text-[clamp(44px,7vw,72px)] font-normal tracking-[-1.5px] leading-[1.05] mb-7 text-[#1c1917]">
                        Certifier <em className="italic text-[#78716c]">vos œuvres</em><br />
                        sur la blockchain
                    </h1>
                    <p className="text-[15px] font-light leading-[1.8] text-[#78716c] max-w-[540px] mx-auto">
                        Mona Editions permet aux artistes de certifier leurs œuvres physiques par jeton numérique, et à leurs collectionneurs de recevoir un certificat permanent qui les accompagne pour toujours.
                    </p>
                </section>

                {/* ─── 3 cards personas ────────────────────────────────── */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-px mb-24 bg-[#d6d0c8] border border-[#d6d0c8]">
                    <PersonaCard
                        eyebrow="Vous êtes artiste"
                        title="Certifier mes œuvres"
                        description="Enregistrez votre profil et émettez des certificats que vous remettez à vos collectionneurs."
                        cta="Mon profil artiste"
                        href="/artist"
                    />
                    <PersonaCard
                        eyebrow="Vous êtes collectionneur"
                        title="Mes certificats"
                        description="Consultez la liste des œuvres dont vous êtes propriétaire et accédez aux certificats associés à chacune d'entre elles."
                        cta="Voir mes certificats"
                        href="/collector"
                    />
                    <PersonaCard
                        eyebrow="Simple visiteur"
                        title="Explorer les œuvres"
                        description="Parcourez la galerie des œuvres certifiées et découvrez le travail des artistes inscrits."
                        cta="Voir la galerie"
                        href="/explore/editions"
                    />
                </section>

                {/* ─── Comment ça marche ───────────────────────────────── */}
                <section className="mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-3 text-center">
                        Comment ça marche
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] mb-12 text-[#1c1917] text-center">
                        Trois étapes <em className="italic text-[#78716c]">simples</em>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                        <Step number="01" title="L'artiste s'inscrit">
                            Il crée son profil (nom, bio, photos) et soumet sa demande d'autorisation. Une fois validée par Mona Editions, il peut commencer à certifier.
                        </Step>
                        <Step number="02" title="Il certifie une œuvre">
                            Il décrit son œuvre, choisit la taille de l'édition, et reçoit un fichier Excel avec autant de QR codes que d'exemplaires à distribuer.
                        </Step>
                        <Step number="03" title="Le collectionneur réclame">
                            Le QR code remis avec l'œuvre physique mène à une page où le collectionneur signe gratuitement la transaction. Le certificat est à lui pour toujours.
                        </Step>
                    </div>
                </section>

                {/* ─── Galerie aperçu (mise en page éditoriale asymétrique) ─── */}
                {(loadingRecent || recent.length > 0) && (
                    <section className="mb-24">
                        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                            <div>
                                <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-2">
                                    Œuvres récemment certifiées
                                </p>
                                <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] text-[#1c1917]">
                                    Le catalogue <em className="italic text-[#78716c]">vivant</em>
                                </h2>
                            </div>
                            <Link
                                href="/explore/editions"
                                className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] hover:opacity-60 inline-flex items-center gap-2 transition-opacity no-underline"
                            >
                                <span className="hidden sm:inline">Toute la galerie</span>
                                <span className="inline-block w-12 h-px bg-[#1c1917]" />
                            </Link>
                        </div>

                        {loadingRecent ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div className="aspect-[4/5] bg-[#ede9e3] animate-pulse" />
                                <div className="grid grid-rows-2 gap-4 md:gap-6">
                                    <div className="bg-[#ede9e3] animate-pulse" />
                                    <div className="bg-[#ede9e3] animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {/* Featured large work (left column on desktop) */}
                                {recent[0] && (
                                    <ArtworkTile
                                        edition={recent[0]}
                                        variant="featured"
                                        eyebrow="À LA UNE"
                                    />
                                )}
                                {/* 2 stacked smaller works (right column on desktop) */}
                                <div className="grid grid-rows-1 md:grid-rows-2 gap-4 md:gap-6">
                                    {recent[1] && (
                                        <ArtworkTile edition={recent[1]} variant="secondary" />
                                    )}
                                    {recent[2] && (
                                        <ArtworkTile edition={recent[2]} variant="secondary" />
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* ─── Confiance / Sécurité ─────────────────────────────── */}
                <section className="mb-24">
                    <p className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-3 text-center">
                        Pérennité et sécurité
                    </p>
                    <h2 className="text-[clamp(28px,4vw,40px)] font-normal tracking-[-1px] leading-[1.15] mb-12 text-[#1c1917] text-center">
                        Pour <em className="italic text-[#78716c]">toujours</em>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#d6d0c8] border border-[#d6d0c8]">
                        <TrustCell title="Blockchain publique Base">
                            Les certificats sont émis sur Base, un réseau Layer 2 d'Ethereum exploité par Coinbase. Ils existent indépendamment de Mona Editions.
                        </TrustCell>
                        <TrustCell title="Smart contracts vérifiés">
                            Notre code source est public et auditable sur Basescan. Aucune modification cachée n'est possible.
                        </TrustCell>
                        <TrustCell title="Stockage IPFS redondant">
                            Les images et descriptions sont stockées sur IPFS, un réseau de fichiers distribué qui répartit le contenu sur plusieurs nœuds.
                        </TrustCell>
                    </div>
                </section>

                {/* ─── CTA final (visiteurs non authentifiés seulement) ───── */}
                {!authenticated && (
                    <section className="border border-[#d6d0c8] bg-[#1c1917] py-16 px-10 text-center">
                        <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-white/30 mb-5">
                            Prêt à commencer
                        </p>
                        <h2 className="text-[clamp(28px,4vw,40px)] font-normal text-white leading-[1.2] mb-4 tracking-[-0.5px]">
                            Connectez-vous en <em className="italic text-white/40">quelques secondes</em>
                        </h2>
                        <p className="text-[14px] font-light text-white/50 max-w-[420px] mx-auto mb-7 leading-[1.7]">
                            Avec une simple adresse email. Aucun téléchargement requis, aucune connaissance technique nécessaire.
                        </p>
                        <button
                            onClick={login}
                            className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] bg-white py-3.5 px-8 cursor-pointer hover:bg-[#f5f3ef] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)] transition-all duration-200"
                        >
                            Se connecter
                        </button>
                    </section>
                )}

                {/* ─── About link ──────────────────────────────────────── */}
                <div className="text-center mt-10">
                    <Link
                        href="/about"
                        className="text-[12px] font-normal tracking-[0.06em] text-[#78716c] hover:text-[#1c1917] underline underline-offset-4 transition-colors"
                    >
                        En savoir plus sur Mona Editions →
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
            className="bg-[#fafaf8] p-8 flex flex-col group no-underline hover:bg-[#f0ece6] transition-colors duration-300"
        >
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#a8a29e] mb-4">
                {eyebrow}
            </p>
            <h3 className="text-[22px] font-normal text-[#1c1917] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[#78716c] leading-[1.7] mb-7 flex-1">
                {description}
            </p>
            <span className="text-[12px] font-medium tracking-[0.06em] text-[#1c1917] group-hover:translate-x-1 transition-transform inline-block">
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
            <p className="text-[40px] font-light text-[#d6d0c8] leading-none mb-4 tracking-tight">
                {number}
            </p>
            <h3 className="text-[18px] font-normal text-[#1c1917] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
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
        <div className="bg-[#fafaf8] p-8">
            <h3 className="text-[16px] font-medium text-[#1c1917] mb-3 leading-tight">
                {title}
            </h3>
            <p className="text-[13px] font-light text-[#78716c] leading-[1.7]">
                {children}
            </p>
        </div>
    );
}

/**
 * Editorial-style artwork tile with two variants:
 *  - 'featured' : tall portrait ratio for the leftmost spot
 *  - 'secondary' : landscape ratio for the two stacked on the right
 *
 * Both share a refined hover treatment with a dark overlay that reveals
 * the artwork's metadata, in the style of art-magazine sites.
 */
function ArtworkTile({
    edition,
    variant,
    eyebrow,
}: {
    edition: RecentEdition;
    variant: 'featured' | 'secondary';
    eyebrow?: string;
}) {
    const aspectClass =
        variant === 'featured' ? 'aspect-[4/5] md:h-full' : 'aspect-[16/10] md:h-full';

    return (
        <Link
            href={`/explore/edition/${edition.tokenId}`}
            className={`group relative block overflow-hidden bg-[#1c1917] no-underline ${aspectClass}`}
        >
            {edition.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={edition.imageUrl}
                    alt={edition.title}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-[1200ms] ease-out group-hover:scale-[1.04] group-hover:opacity-90"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/40 tracking-[0.1em] uppercase">
                    Pas d'image
                </div>
            )}

            {/* Eyebrow tag (only on featured) */}
            {eyebrow && (
                <div className="absolute top-5 left-5 z-10">
                    <span className="inline-block text-[10px] font-medium tracking-[0.18em] uppercase text-white bg-[#1c1917]/80 backdrop-blur-sm px-3 py-1.5">
                        {eyebrow}
                    </span>
                </div>
            )}

            {/* Always-visible bottom gradient + caption */}
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

            {/* Hover-only fine-line frame */}
            <div className="absolute inset-3 border border-white/0 group-hover:border-white/30 transition-colors duration-500 pointer-events-none" />
        </Link>
    );
}
