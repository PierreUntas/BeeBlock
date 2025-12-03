import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const RPC_URL = process.env.NEXT_PUBLIC_PERSONNAL_RPC_URL_SEPOLIA;

export const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL)
});
