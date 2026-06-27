import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — turns Mona Editions into an installable PWA.
 *
 * On iOS Safari : the user can "Add to Home Screen" and the app launches
 * full-screen with our icon — visually indistinguishable from a native app.
 * On Android Chrome : same plus a system "Install app" prompt.
 *
 * Served at /manifest.webmanifest by Next.js (auto-generated from this file).
 *
 * Note : Apple Safari ignores most fields of this manifest (theme_color,
 * background_color, display). The iOS-specific behaviour is driven by the
 * <meta apple-*> tags in app/layout.tsx instead. This manifest mostly
 * serves Android and future browsers.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Mona Editions',
        short_name: 'Mona Editions',
        description:
            "Certification d'œuvres d'art sur la blockchain Base. Authenticité, provenance et transmission durables.",
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f3ef',
        theme_color: '#1c1917',
        lang: 'fr',
        categories: ['art', 'photo', 'lifestyle', 'productivity'],
        icons: [
            {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    };
}
