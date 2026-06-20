/**
 * OpenGraph metadata helpers.
 *
 * Server-only utilities used by `generateMetadata` in dynamic pages to
 * produce per-resource share previews. Each artist and edition page
 * builds its own OG card with the right title, description, and image.
 *
 * Design notes:
 *  - All IPFS fetches are wrapped with a tight timeout (5s default).
 *    OG generation must NEVER block page rendering for long; if IPFS is
 *    slow we fall back to a neutral Mona Editions card.
 *  - URLs are built localized: /fr/... has no prefix (default locale),
 *    /de/... and /en/... do. This matches `localePrefix: 'as-needed'`
 *    in i18n/routing.ts.
 *  - The fallback image is the same logo used in the site-wide layout
 *    so a failed fetch still yields a recognizable card.
 */

import type { Metadata } from 'next';
import { BASE_URL } from '@/config/constants';
import { getFromIPFSGateway } from '@/app/utils/ipfs';
import { ipfsToHttp } from '@/app/utils/file';

/** Default OG image when the resource has no own image or IPFS fails. */
export const DEFAULT_OG_IMAGE = `${BASE_URL}/monaeditions-logo.png`;

/**
 * Build a fully-qualified URL for a given locale, matching the routing
 * convention (FR has no prefix, DE/EN do). Used for canonical URLs and
 * OG `url` field.
 */
export function buildLocalizedUrl(path: string, locale: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return locale === 'fr' ? `${BASE_URL}${cleanPath}` : `${BASE_URL}/${locale}${cleanPath}`;
}

/**
 * Fetch IPFS metadata with a hard timeout. Returns null on any failure
 * (timeout, parse error, gateway unreachable) so callers can fall back
 * to a neutral card without crashing the page.
 */
export async function fetchIPFSSafe<T = any>(cid: string, timeoutMs = 5000): Promise<T | null> {
    if (!cid?.trim()) return null;
    try {
        const result = await Promise.race([
            getFromIPFSGateway(cid) as Promise<T>,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('IPFS timeout')), timeoutMs)
            ),
        ]);
        return result;
    } catch (e) {
        console.error(`[og] IPFS fetch failed for ${cid}:`, (e as Error).message);
        return null;
    }
}

/**
 * Convert an IPFS hash/URI to an absolute HTTP URL suitable for OG image.
 * Returns the default Mona Editions logo URL if input is falsy.
 */
export function ogImageUrl(ipfsRef: string | undefined | null): string {
    if (!ipfsRef) return DEFAULT_OG_IMAGE;
    const url = ipfsToHttp(ipfsRef);
    // ipfsToHttp returns the input unchanged if it doesn't start with ipfs://,
    // so we still need to make sure we end up with an http(s) URL.
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return DEFAULT_OG_IMAGE;
}

/**
 * Build a standard Metadata object with both OpenGraph and Twitter Card
 * fields filled in. Centralizes the "shape" of every share preview so
 * artist and edition pages stay consistent.
 */
export function buildShareMetadata(opts: {
    title: string;
    description: string;
    url: string;
    image: string;
    imageAlt: string;
    type?: 'profile' | 'article' | 'website';
}): Metadata {
    const { title, description, url, image, imageAlt, type = 'website' } = opts;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title,
            description,
            url,
            siteName: 'Mona Editions',
            type,
            images: [{ url: image, alt: imageAlt }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
    };
}
