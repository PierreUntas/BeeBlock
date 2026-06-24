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
 * Root layout — minimal shell. The locale-aware layout that holds providers
 * lives at app/[locale]/layout.tsx. The `<html lang>` attribute is set there
 * via Next.js's automatic locale propagation, but we keep `lang="fr"` here
 * as a safe fallback for any edge case that bypasses the locale segment.
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr">
            <body className="antialiased">{children}</body>
        </html>
    );
}
