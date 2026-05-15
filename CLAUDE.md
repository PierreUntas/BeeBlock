# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mona Editions** — blockchain-based artwork certification platform (Alyra graduation project). Artists register, create limited editions with secret-key-based certificates, and collectors claim ERC-1155 tokens via Merkle proof verification.

## Repository Structure

Two independent workspaces:
- `contracts/` — Hardhat smart contracts (Solidity 0.8.28)
- `frontend/` — Next.js 16 app (app router)

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev          # Start dev server (webpack mode)
npm run build        # Production build
npm run lint         # ESLint
```

### Contracts (`cd contracts`)
```bash
npx hardhat test                                   # Run all tests
npx hardhat test test/ArtworkRegistry.ts           # Run single test file
npx hardhat compile                                # Compile contracts
npx hardhat ignition deploy ignition/modules/ArtworkCertificationSystem.ts --network sepolia
npx hardhat ignition deploy ignition/modules/ArtworkCertificationSystem.ts --network base
npx hardhat verify --network base <address>        # Verify on Basescan
```

## Smart Contract Architecture

**Two contracts** with ownership transfer pattern:

- `ArtworkRegistry.sol` — main certification logic, owns the tokenization contract
- `ArtworkTokenization.sol` — ERC-1155, only the registry can mint

**Three-tier roles**: Owner → Admins → Artists (collectors are regular wallets with no on-chain role)

**Certification flow**:
1. Admin registers artist (stores IPFS CID with artist metadata)
2. Artist creates edition: generates N secret keys off-chain → builds Merkle tree → uploads IPFS metadata → calls contract with merkle root
3. CSV exported with `(secretKey, merkleProof)` pairs — QR codes embed the claim URL + secretKey
4. Collector calls `claimCertificate(editionId, secretKey, proof)` → contract verifies Merkle proof → mints ERC-1155

**Key security**: `claimedKeys[editionId][keccak256(secretKey)]` prevents replay. ReentrancyGuard on mint.

**Deployed addresses** (Base mainnet):
- `ArtworkRegistry`: `0x527F8FF17CC7980E69a69d667E7D90D4A129aE52`
- `ArtworkTokenization`: `0xD46013F87C0bb62A273Ea5CFdF61F64896321958`

**Deployed addresses** (Sepolia testnet):
- `ArtworkRegistry`: `0xfa954e2AEC0827Bb69433db64F99F6E9df562113`
- `ArtworkTokenization`: `0x1f7Bac7B3F6B49E2147541aB58f2C6365A7Ed148`

Test helper `generateSecretKeys(n)` in `test/ArtworkRegistry.ts` builds the full Merkle tree and returns keys with proofs.

## Frontend Architecture

**Auth & Web3**: Privy (email + wallet login) → WagmiProvider → React Query. Config in `app/PrivyProvider.tsx` and `config/wagmi.ts`. Default chain is `base`; dev client in `lib/client.ts` defaults to `sepolia`.

**Contract interaction**: ABIs and addresses in `config/contracts.ts`. Use Wagmi hooks (`useReadContract`, `useWriteContract`) throughout pages.

**IPFS**: All uploads go through `/api/ipfs/add` (server-side Pinata JWT). Reads use `https://ipfs.io/ipfs/` public gateway with in-memory cache. See `utils/ipfs.ts`.

**Route structure**:
- `/artist/editions/create` — edition creation wizard (generates Merkle tree client-side, uploads to IPFS, calls contract)
- `/collector/claim` — QR-code-triggered certificate claiming
- `/explore/edition/[id]` — public edition detail
- `/admin`, `/owner` — role-gated dashboards

**Next.js config** (`next.config.ts`) has webpack aliases to stub Node.js modules (`fs`, `net`, `tls`) and React Native packages that conflict in browser.

## Environment Variables

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_ENVIRONMENT=production|development
NEXT_PUBLIC_RPC_URL_BASE=
NEXT_PUBLIC_RPC_URL_SEPOLIA=
NEXT_PUBLIC_ARTWORK_REGISTRY_ADDRESS=
NEXT_PUBLIC_ARTWORK_TOKENIZATION_ADDRESS=
NEXT_PUBLIC_PRIVY_APP_ID=
PINATA_JWT=
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
RESEND_API_KEY=           # optional, for contact form
```

**Contracts** (`.env`):
```
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
BASE_RPC_URL=
BASE_PRIVATE_KEY=
BASE_SEPOLIA_RPC_URL=
BASE_SEPOLIA_PRIVATE_KEY=
BASESCAN_API_KEY=
```

## Design System

Tailwind CSS 4. Color tokens (use via inline styles or CSS vars):
- Background: `#f5f3ef` (warm beige)
- Cards: `#fafaf8`
- Secondary text: `#78716c`
- Primary text: `#1c1917`
- Borders: `#d6d0c8`

Typography: serif for headings, `font-light` sans-serif for body, uppercase + wide tracking for section labels.
