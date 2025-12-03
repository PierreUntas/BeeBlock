import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA;

export const config = createConfig({
    chains: [sepolia],
    connectors: [
        injected(),
        ...(projectId ? [walletConnect({ projectId })] : []),
    ],
    transports: {
        [sepolia.id]: http(rpcUrl),
    },
});
