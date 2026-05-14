import PrivyProvider from "@/app/PrivyProvider";
import { ModalProvider } from "@/app/ModalProvider";
import type { Metadata } from "next";
import "./globals.css";
import Layout from "../components/shared/Layout";

export const metadata: Metadata = {
  metadataBase: new URL('https://monaeditions.com'),
  title: "Mona Editions - Certification d'Art sur Blockchain",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <PrivyProvider>
          <ModalProvider>
            <Layout>
              {children}
            </Layout>
          </ModalProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
