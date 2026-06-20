/**
 * Edition details page — server component shell.
 *
 * Mirrors the artist page split: this server component owns
 * `generateMetadata` so QR-code claim links and "share this artwork"
 * URLs produce rich previews (artwork image, title, artist name) on
 * Slack, WhatsApp, X, Facebook, etc. The interactive UI lives in
 * `EditionPageClient.tsx`.
 *
 * Caching: ISR with 1h revalidation — edition metadata (title, image)
 * is effectively immutable on-chain so a longer cache would be safe,
 * but 1h matches the artist page and keeps things consistent.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { parseAbiItem } from 'viem';
import { ARTWORK_REGISTRY_ADDRESS, ARTWORK_REGISTRY_ABI } from '@/config/contracts';
import { publicClient, getDeploymentBlock } from '@/lib/client';
import { buildLocalizedUrl, fetchIPFSSafe, ogImageUrl, buildShareMetadata, DEFAULT_OG_IMAGE } from '@/lib/og';
import EditionPageClient from './EditionPageClient';

export const revalidate = 3600; // 1h ISR

interface PageProps {
    params: Promise<{ locale: string; id: string }>;
}

interface EditionIPFSData {
    title?: string;
    description?: string;
    technique?: string;
    dimensions?: string;
    images?: string[];
    editionSize?: number;
    year?: number;
}

interface ArtistIPFSData {
    name?: string;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, id } = await params;
    const t = await getTranslations({ locale, namespace: 'Explore.edition' });
    const tArtist = await getTranslations({ locale, namespace: 'Explore.artist' });
    const canonicalUrl = buildLocalizedUrl(`/explore/edition/${id}`, locale);

    // Validate id shape (must be a positive integer; bigint parsing handles
    // overflow but we avoid wasting a contract call on garbage).
    if (!/^\d+$/.test(id)) {
        return buildShareMetadata({
            title: 'Mona Editions',
            description: t('notFound'),
            url: canonicalUrl,
            image: DEFAULT_OG_IMAGE,
            imageAlt: 'Mona Editions',
        });
    }

    try {
        const tokenId = BigInt(id);

        // Fetch the on-chain edition record. Returns a tuple destructured
        // as [metadata, merkleRoot, disabled] — see ArtworkRegistry.sol.
        const editionData = await publicClient.readContract({
            address: ARTWORK_REGISTRY_ADDRESS,
            abi: ARTWORK_REGISTRY_ABI,
            functionName: 'getArtworkEdition',
            args: [tokenId],
        }) as readonly [string, string, boolean];

        const editionMetadataCID = editionData[0];

        // Find the artist via NewArtworkEdition event — registry doesn't
        // expose a direct edition→artist getter, so we query the event log.
        // Done in parallel with the edition IPFS fetch to save round trips.
        const [editionIpfs, artistAddress] = await Promise.all([
            fetchIPFSSafe<EditionIPFSData>(editionMetadataCID),
            findArtistForEdition(tokenId),
        ]);

        // Now resolve the artist's display name from their own IPFS metadata.
        let artistName = tArtist('anonymous');
        if (artistAddress) {
            try {
                const artistData = await publicClient.readContract({
                    address: ARTWORK_REGISTRY_ADDRESS,
                    abi: ARTWORK_REGISTRY_ABI,
                    functionName: 'getArtist',
                    args: [artistAddress],
                }) as { metadata?: string };

                if (artistData.metadata?.trim()) {
                    const artistIpfs = await fetchIPFSSafe<ArtistIPFSData>(artistData.metadata);
                    if (artistIpfs?.name?.trim()) artistName = artistIpfs.name;
                }
            } catch (e) {
                console.error('[og] failed to resolve artist for edition', id, e);
            }
        }

        const title = editionIpfs?.title?.trim() || tArtist('untitled');
        const image = ogImageUrl(editionIpfs?.images?.[0]);
        const editionSize = editionIpfs?.editionSize ?? 0;

        const fullTitle = `${title} — ${artistName} — Mona Editions`;
        const description = t('ogDescription', { artist: artistName, size: editionSize });

        return buildShareMetadata({
            title: fullTitle,
            description,
            url: canonicalUrl,
            image,
            imageAlt: title,
            type: 'article',
        });
    } catch (e) {
        console.error('[og] edition metadata generation failed for', id, e);
        return buildShareMetadata({
            title: 'Mona Editions',
            description: t('notFound'),
            url: canonicalUrl,
            image: DEFAULT_OG_IMAGE,
            imageAlt: 'Mona Editions',
        });
    }
}

/**
 * Locate the artist who created a given edition by scanning the
 * NewArtworkEdition events. We search across the full deployment range
 * because editionId is indexed in the event signature. Returns null on
 * any failure so callers can fall back gracefully.
 */
async function findArtistForEdition(editionId: bigint): Promise<`0x${string}` | null> {
    try {
        const logs = await publicClient.getLogs({
            address: ARTWORK_REGISTRY_ADDRESS,
            event: parseAbiItem('event NewArtworkEdition(address indexed artist, uint indexed editionId)'),
            args: { editionId },
            fromBlock: getDeploymentBlock(),
            toBlock: 'latest',
        });
        const log = logs[0];
        return (log?.args.artist as `0x${string}` | undefined) ?? null;
    } catch (e) {
        console.error('[og] findArtistForEdition failed:', e);
        return null;
    }
}

export default function EditionDetailsPage() {
    return <EditionPageClient />;
}
