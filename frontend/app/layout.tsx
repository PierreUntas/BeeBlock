import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    metadataBase: new URL('https://monaeditions.com'),
    title: "Mona Editions",
    description: "Mona Editions est une plateforme de certification d'œuvres d'art sur la blockchain, garantissant l'authenticité et la provenance de chaque création artistique.",
    keywords: ["blockchain", "art", "certification", "NFT", "artiste", "collectionneur", "authenticité", "provenance", "Web3"],
    authors: [{ name: "Mona Editions" }],
    openGraph: {
        title: "Mona Editions - Certification d'Art sur Blockchain",
        description: "Certification décentralisée d'œuvres d'art avec provenance vérifiable",
        type: "website",
        images: [{ url: "/monaeditions-logo.png", width: 512, height: 512, alt: "Mona Editions" }],
    },
};

/**
 * Mobile viewport configuration.
 *
 * Without this declaration, mobile browsers fall back to a virtual viewport of
 * ~980px and zoom out to fit the screen. That broke the Privy modal (which
 * sizes itself against the visual viewport), and was the root cause of a wide
 * range of mobile responsive issues across the app.
 *
 * `maximumScale: 5` keeps user pinch-zoom available for accessibility while
 * still ensuring the initial render uses the device width.
 */
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

/**
 * Inline script injected before React hydrates.
 *
 * Reads the persisted theme from localStorage (key `mona-theme`) and adds
 * the `.dark` class to <html> SYNCHRONOUSLY, before any component renders.
 * Without this, the page paints in light mode briefly even for users who
 * chose dark — the dreaded "flash of wrong theme".
 *
 * Falls back to system preference (prefers-color-scheme) on first visit.
 * Wrapped in try/catch so a missing localStorage (private mode in some
 * browsers) silently degrades to light mode rather than crashing the boot.
 */
const themeInitScript = `
(function() {
    try {
        var saved = localStorage.getItem('mona-theme');
        var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var useDark = saved === 'dark' || (saved === null && systemPrefersDark);
        if (useDark) document.documentElement.classList.add('dark');
    } catch (e) { /* localStorage unavailable, default to light */ }
})();
`;

/**
 * Root layout — minimal shell. The locale-aware layout that holds providers
 * lives at app/[locale]/layout.tsx. The `<html lang>` attribute is set there
 * via Next.js's automatic locale propagation, but we keep `lang="fr"` here
 * as a safe fallback for any edge case that bypasses the locale segment.
 *
 * `suppressHydrationWarning` on <html> tells React not to complain about
 * the className mismatch caused by the theme-init script — it intentionally
 * mutates <html> before hydration.
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}
