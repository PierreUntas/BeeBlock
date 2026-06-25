"use client";

import { PrivyProvider as PrivyProviderCore } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base, sepolia } from "viem/chains";
import { http, createConfig } from "wagmi";
import { activeChain, isProduction } from "@/config/constants";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

/**
 * Watches the `.dark` class on <html> and returns the current Privy theme
 * value ('light' | 'dark'). The initial value is read at mount; subsequent
 * toggles by ThemeToggle are picked up via a MutationObserver so Privy's
 * embedded UI (login, transaction approval) re-skins on the fly.
 */
function usePrivyTheme(): 'light' | 'dark' {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    useEffect(() => {
        const sync = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return theme;
}

const wagmiConfig = createConfig({
    chains: isProduction ? [base] : [base, sepolia],
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL_BASE),
        [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA),
    },
});

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyTheme = usePrivyTheme();

    if (!appId) {
        console.error("NEXT_PUBLIC_PRIVY_APP_ID is not defined in .env");
        return (
            <div className="flex items-center justify-center min-h-screen bg-yellow-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration manquante</h2>
                    <p className="text-gray-700 mb-4">
                        Veuillez configurer <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code> dans votre fichier <code className="bg-gray-100 px-2 py-1 rounded">.env</code>
                    </p>
                    <p className="text-sm text-gray-600">
                        Obtenez votre App ID sur <a href="https://console.privy.io" target="_blank" className="text-blue-600 hover:underline">console.privy.io</a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <PrivyProviderCore
            appId={appId}
            config={{
                loginMethods: ["email"], // ["email", "wallet"]
                appearance: {
                    theme: privyTheme,
                    accentColor: privyTheme === 'dark' ? "#f5f3ef" : "#1c1917",
                    logo: "/monaeditions-logo.png",
                    landingHeader: "Bienvenue chez Mona Editions",
                    loginMessage: "Authentifiez vos œuvres ou réclamez votre certificat",
                },
                // embeddedWallets: {
                //     createOnLogin: "users-without-wallets",
                // },
                defaultChain: activeChain,
                supportedChains: isProduction ? [base] : [base, sepolia],
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiConfig}>
                    {children}
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProviderCore>
    );
}
