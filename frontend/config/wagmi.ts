import { createConfig, http } from 'wagmi';
import { base, sepolia } from 'wagmi/chains';

export const config = createConfig({
    chains: [base, sepolia],
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL_BASE),
        [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA),
    },
});
