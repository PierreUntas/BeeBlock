/**
 * Artist details page — server component shell.
 *
 * This file is intentionally minimal: its only job is to expose
 * `generateMetadata` so that links to /explore/artist/[address] produce
 * rich OpenGraph/Twitter share previews (artist name, photo, edition
 * count). The interactive UI lives in `ArtistPageClient.tsx`, which is
 * a regular client component using Wagmi/Privy hooks.
 *
 * Caching: the page is statically renderable per (locale, address) but
 * we set `revalidate = 3600` so OG cards stay fresh as artists update
 * their metadata or add new editions, without thrashing IPFS on every
 * social-bot scrape.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { parseAbiItem } from 'viem';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { buildLocalizedUrl, fetchIPFSSafe, ogImageUrl, buildShareMetadata, DEFAULT_OG_IMAGE } from '@/lib/og';
import ArtistPageClient from './ArtistPageClient';

export const revalidate = 3600; // 1h ISR for OG metadata freshness

interface PageProps {
    params: Promise<{ locale: string; address: string }>;
}

interface ArtistIPFSData {
    name?: string;
    location?: string;
    bio?: string;
    portfolio?: string[];
    logo?: string;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, address } = await params;
    const t = await getTranslations({ locale, namespace: 'Explore.artist' });
    const canonicalUrl = buildLocalizedUrl(`/explore/artist/${address}`, locale);

    // Validate address shape early to avoid contract call on bogus input.
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return buildShareMetadata({
            title: 'Mona Editions',
            description: t('notFound'),
            url: canonicalUrl,
            image: DEFAULT_OG_IMAGE,
            imageAlt: 'Mona Editions',
        });
    }

    try {
        // Fetch the artist's on-chain registration. If the address is
        // unregistered, `metadata` will be empty and we fall back below.
        const artistData = await publicClient.readContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'getArtist',
            args: [address as `0x${string}`],
        }) as { metadata?: string };

        const ipfsData = artistData.metadata?.trim()
            ? await fetchIPFSSafe<ArtistIPFSData>(artistData.metadata)
            : null;

        const name = ipfsData?.name?.trim() || t('anonymous');
        const heroImage = ogImageUrl(ipfsData?.portfolio?.[0] || ipfsData?.logo);

        // Count editions via the event log. Best-effort: if it fails we
        // simply produce metadata with zero editions instead of crashing.
        let editionsCount = 0;
        try {
            const logs = await publicClient.getLogs({
                address: ARTWORK_REGISTRY_ADDRESS,
                event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
                args: { artist: address as `0x${string}` },
                fromBlock: getDeploymentBlock(),
                toBlock: 'latest',
            });
            editionsCount = logs.length;
        } catch (e) {
            console.error('[og] failed to count editions for', address, e);
        }

        const title = `${name} — Mona Editions`;
        const description = t('ogDescription', { name, editionsCount });

        return buildShareMetadata({
            title,
            description,
            url: canonicalUrl,
            image: heroImage,
            imageAlt: name,
            type: 'profile',
        });
    } catch (e) {
        console.error('[og] artist metadata generation failed for', address, e);
        return buildShareMetadata({
            title: 'Mona Editions',
            description: t('notFound'),
            url: canonicalUrl,
            image: DEFAULT_OG_IMAGE,
            imageAlt: 'Mona Editions',
        });
    }
}

export default function ArtistDetailsPage() {
    return <ArtistPageClient />;
}
