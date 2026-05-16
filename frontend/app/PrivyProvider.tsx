"use client";

import { PrivyProvider as PrivyProviderCore } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base, sepolia } from "viem/chains";
import { http, createConfig } from "wagmi";
import { activeChain, isProduction } from "@/config/constants";

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
    chains: isProduction ? [base] : [base, sepolia],
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL_BASE),
        [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA),
    },
});

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    
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
                    theme: "light",
                    accentColor: "#fbbf24",
                    logo: "/monaeditions-logo.png",
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
