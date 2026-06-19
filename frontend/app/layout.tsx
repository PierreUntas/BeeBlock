import type { Metadata } from "next";
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
