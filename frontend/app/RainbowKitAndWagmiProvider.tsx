"use client";
import React, { PropsWithChildren } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const config = getDefaultConfig({
    appName: "BeeBlock",
    projectId: "dadb200892fc0800f89f564492f096da",
    chains: [mainnet, polygon, optimism, arbitrum, base],
    ssr: true,
});

const queryClient = new QueryClient();

const RainbowKitAndWagmiProvider = ({ children }: PropsWithChildren<{}>) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>{children}</RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default RainbowKitAndWagmiProvider;
