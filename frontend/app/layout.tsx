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
    // PWA — iOS Safari ignore le manifest.webmanifest pour le comportement
    // "Add to Home Screen". Il faut ces meta apple-* explicites :
    //  - apple-touch-icon : l'icône visible sur le springboard iOS
    //  - capable / status-bar-style : lance l'app en plein écran sans la barre Safari
    //  - title : le nom court qui apparaît sous l'icône iPhone
    appleWebApp: {
        capable: true,
        title: 'Mona Editions',
        statusBarStyle: 'default',
    },
    icons: {
        icon: [
            { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [
            { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
        ],
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
    // Color of the OS status bar when the app runs in standalone mode (PWA
    // installed on home screen). Adapts to the active theme : warm beige in
    // light mode, near-black in dark mode — mirrors our globals.css tokens.
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f5f3ef' },
        { media: '(prefers-color-scheme: dark)', color: '#0f0e0c' },
    ],
};

/**
 * Inline script injected before React hydrates.
 *
 * Reads the persisted theme from localStorage (key `mona-theme`) and adds
 * the `.dark` class to <html> SYNCHRONOUSLY, before any component renders.
 * Without this, the page paints in light mode briefly even for users who
 * chose dark — the dreaded "flash of wrong theme".
 *
 * Default policy : **dark mode unless the user has explicitly chosen light**.
 * Mona Editions est une plateforme éditoriale de présentation d'œuvres ; le
 * dark donne plus de présence aux images. La préférence système est ignorée
 * — on n'hérite plus du light si l'OS est en clair.
 *
 * Wrapped in try/catch so a missing localStorage (private mode in some
 * browsers) silently degrades — and in that fallback we still default dark
 * by adding the .dark class unconditionally before the catch is reached.
 */
const themeInitScript = `
(function() {
    try {
        var saved = localStorage.getItem('mona-theme');
        var useDark = saved !== 'light';
        if (useDark) document.documentElement.classList.add('dark');
    } catch (e) {
        document.documentElement.classList.add('dark');
    }
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
