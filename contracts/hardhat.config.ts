import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
    plugins: [hardhatToolboxMochaEthersPlugin],
    solidity: {
        profiles: {
            default: {
                version: "0.8.28",
            },
            production: {
                version: "0.8.28",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1000000,
                    },
                },
            },
        },
    },
    networks: {
        hardhatMainnet: {
            type: "edr-simulated",
            chainType: "l1",
        },
        hardhatOp: {
            type: "edr-simulated",
            chainType: "op",
        },
        sepolia: {
            type: "http",
            chainType: "l1",
            url: process.env.SEPOLIA_RPC_URL || "",
            accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
        },
        base: {
            type: "http",
            chainType: "op",
            url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
            accounts: process.env.BASE_PRIVATE_KEY ? [process.env.BASE_PRIVATE_KEY] : [],
            gasPrice: "auto",
        },
    },
    etherscan: {
        apiKey: {
            base: process.env.BASESCAN_API_KEY || "",
            sepolia: process.env.ETHERSCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org"
                }
            }
        ]
    },
});