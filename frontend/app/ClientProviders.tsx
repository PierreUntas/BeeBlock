"use client";
import React, { PropsWithChildren } from 'react';
import RainbowKitAndWagmiProvider from './RainbowKitAndWagmiProvider';

export default function ClientProviders({ children }: PropsWithChildren<{}>) {
  return <RainbowKitAndWagmiProvider>{children}</RainbowKitAndWagmiProvider>;
}
