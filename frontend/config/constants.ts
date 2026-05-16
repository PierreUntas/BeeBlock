import { base, sepolia } from 'viem/chains';

export const BASE_URL = 'https://monaeditions.com';

export const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
export const activeChain = isProduction ? base : sepolia;
export const activeRpcUrl = isProduction
    ? process.env.NEXT_PUBLIC_RPC_URL_BASE
    : process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA;
