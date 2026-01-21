import PrivyProvider from "@/app/PrivyProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Layout from "../components/shared/Layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeeBlock - Traçabilité du Miel sur Blockchain",
  description: "BeeBlock est une plateforme de traçabilité décentralisée pour le miel, utilisant la blockchain pour garantir l'authenticité et la transparence de chaque pot de miel.",
  keywords: ["blockchain", "miel", "traçabilité", "NFT", "producteur", "apiculture", "honey", "Web3"],
  authors: [{ name: "BeeBlock" }],
  openGraph: {
    title: "BeeBlock - Traçabilité du Miel sur Blockchain",
    description: "Traçabilité décentralisée du miel de la ruche au consommateur",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PrivyProvider>
          <Layout>
            {children}
          </Layout>
        </PrivyProvider>
      </body>
    </html>
  );
}
