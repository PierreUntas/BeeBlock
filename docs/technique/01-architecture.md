# Architecture technique — Mona Editions

## Vue d'ensemble

Mona Editions est une plateforme de certification d'œuvres d'art déployée sur le réseau **Base mainnet** (L2 Ethereum, opéré par Coinbase). Elle permet à des artistes vérifiés d'émettre des certificats d'authenticité numériques pour leurs œuvres, et à des collectionneurs de les réclamer via un QR code physique attaché à l'œuvre.

Le système combine trois briques principales :

1. **Une paire de smart contracts** déployés sur Base, écrits en Solidity 0.8.28
2. **Une application Next.js 16** qui sert d'interface aux artistes, aux collectionneurs et aux administrateurs
3. **Un système de stockage décentralisé** sur IPFS (via Pinata) pour les métadonnées d'artistes, d'éditions et d'avis

## Schéma de haut niveau

```
┌────────────────────────┐         ┌────────────────────────┐
│   Frontend Next.js     │◄───────►│   Privy (Auth Web3)    │
│   (Vercel)             │         └────────────────────────┘
│                        │
│   - App Router         │         ┌────────────────────────┐
│   - Wagmi + viem       │◄───────►│   Alchemy / RPC Base   │
│   - Tailwind CSS       │         └────────────────────────┘
│   - Privy SDK          │
│                        │         ┌────────────────────────┐
│                        │◄───────►│   Pinata (IPFS)        │
└──────────┬─────────────┘         └────────────────────────┘
           │
           │ JSON-RPC
           ▼
┌────────────────────────┐         ┌────────────────────────┐
│   ArtworkRegistry      │────────►│   ArtworkTokenization  │
│   (logique métier)     │  owns   │   (ERC-1155)           │
└────────────────────────┘         └────────────────────────┘
                 │
                 │ déployé sur
                 ▼
        ┌────────────────────┐
        │   Base Mainnet     │
        └────────────────────┘
```

## Choix d'architecture

### Pourquoi Base ?

Base est un rollup optimiste de seconde couche Ethereum opéré par Coinbase. Trois raisons justifient ce choix :

- **Coût de transaction très faible** : un claim de certificat coûte quelques centimes au niveau réseau, ce qui rend le gas sponsoring (cf. ci-dessous) économiquement viable à grande échelle.
- **Sécurité héritée d'Ethereum** : la finalité repose sur le L1 Ethereum.
- **Onboarding utilisateur facilité** : la couche Coinbase Smart Wallet et l'intégration Privy permettent à un non-utilisateur crypto de réclamer un certificat avec son email seul.

### Gas sponsoring (paymaster Privy)

**Toutes les transactions** émises par les artistes, les admins et les collectionneurs sont **sponsorisées** : aucun utilisateur final n'a besoin d'ETH dans son wallet pour utiliser la plateforme. Les transactions sont envoyées via `sendTransaction({ to, data }, { sponsor: true })` de Privy, qui les route à travers un paymaster qui paie le gas pour le compte de l'utilisateur.

**Seule exception** : la fonction `addAdmin` (et accessoirement `removeAdmin`) du contrat `ArtworkRegistry`, appelée par l'owner depuis le dashboard `/owner`. Comme l'owner est un wallet opérationnel de l'équipe Mona Editions, il dispose de son propre ETH sur Base et utilise une écriture wagmi standard (`useWriteContract`), sans sponsoring.

Conséquences :

- L'expérience utilisateur est complètement « gasless » : ni l'artiste qui crée une édition, ni le collectionneur qui réclame son certificat n'a à comprendre ou à manipuler de cryptomonnaie.
- Le coût marginal de chaque action utilisateur est porté par le paymaster — donc par Mona Editions. Le modèle économique doit absorber ce coût (volume × coût gas moyen sur Base, soit de l'ordre du dixième de centime à quelques centimes par opération).
- Le paymaster Privy applique ses propres policies (whitelist d'adresses contractuelles, quotas par utilisateur) — paramétrables depuis le dashboard Privy.

Un environnement de staging fonctionne sur **Sepolia** pour les tests d'intégration et de pré-production.

### Pourquoi deux contrats ?

La séparation entre `ArtworkRegistry` (logique métier) et `ArtworkTokenization` (tokens ERC-1155) suit le pattern « ownership transfer » :

- `ArtworkTokenization` ne connaît que la mécanique ERC-1155 et délègue toute autorisation de mint à son `owner`.
- `ArtworkRegistry` est ce propriétaire. Il porte toute la logique de rôles, de Merkle-tree, d'anti-rejeu, d'avis collectionneurs.

Cela permet de remplacer la couche métier sans toucher au registre des tokens déjà émis, et inversement, de migrer le contrat de tokens en cas d'évolution de standard.

### Pourquoi un Merkle Tree pour la distribution ?

Lorsqu'un artiste crée une édition de N certificats, on a besoin de N « clés secrètes » uniques (une par certificat physique / QR code). Stocker ces N hash on-chain serait coûteux : sur une édition de 1 000 pièces, cela représente 1 000 SSTORE.

Avec un Merkle Tree, on ne stocke qu'**un seul hash racine** (la merkle root) on-chain. Chaque certificat embarque sa preuve de Merkle hors-chaîne. La vérification on-chain est O(log N) et coûte une dizaine de milliers de gas, indépendamment de la taille de l'édition.

## Flux de données

### Création d'édition (artiste)

1. L'artiste prépare ses métadonnées d'édition (titre, année, images, technique) côté client.
2. Le client génère **N clés secrètes** aléatoires.
3. Le client construit le Merkle Tree à partir de ces clés.
4. Les métadonnées de l'édition sont uploadées sur IPFS via `/api/ipfs/add` (proxy serveur, JWT Pinata caché).
5. L'artiste signe une transaction `createArtworkEdition(metadataCID, amount, merkleRoot)`.
6. Un CSV est exporté côté client contenant `(secretKey, merkleProof)` pour chaque certificat. Ce CSV alimente la fabrication des QR codes physiques.

### Réclamation (collectionneur)

1. Le collectionneur scanne un QR code physique → ouvre une URL `/collector/claim?edition=X&key=Y`.
2. Le client résout la preuve de Merkle associée à `Y`.
3. Le collectionneur s'authentifie via Privy (email ou wallet).
4. Le client appelle `claimCertificate(editionId, secretKey, proof)` sur `ArtworkRegistry`.
5. Le contrat vérifie la preuve, marque la clé comme consommée, et transfère 1 ERC-1155 de l'artiste vers le collectionneur.

## Découpage des modules

| Module | Rôle | Localisation |
|--------|------|--------------|
| `ArtworkRegistry.sol` | Logique métier, rôles, claims, avis | `contracts/contracts/` |
| `ArtworkTokenization.sol` | ERC-1155, mint et URI | `contracts/contracts/` |
| `frontend/app/artist/` | Routes artiste (création d'édition, QR codes) | `frontend/app/` |
| `frontend/app/collector/` | Réclamation de certificat | `frontend/app/` |
| `frontend/app/admin/` | Dashboard admin (autorisation d'artistes) | `frontend/app/` |
| `frontend/app/owner/` | Dashboard owner (gestion des admins) | `frontend/app/` |
| `frontend/app/api/ipfs/` | Proxy Pinata côté serveur | `frontend/app/api/` |
| `frontend/config/contracts.ts` | ABIs et adresses des contrats | `frontend/config/` |
| `frontend/utils/ipfs.ts` | Helpers IPFS (upload, fetch, cache) | `frontend/utils/` |

## Dépendances externes

- **Privy** — authentification multi-méthode (email + wallet)
- **Pinata** — pinning IPFS
- **Alchemy** — fournisseur RPC pour Base / Sepolia
- **Vercel** — hébergement du frontend
- **OpenZeppelin Contracts** — primitives sécurisées (Ownable, ReentrancyGuard, MerkleProof, ERC1155)
- **Resend** — envoi d'emails transactionnels (formulaire de contact)

## Adresses déployées

**Base mainnet :**

- `ArtworkRegistry` : `0x157DbA323117DC54A7907E55d0cA7553974E79a5`
- `ArtworkTokenization` : `0x73D6Dd9498Fed8F85cc7ceBAc8593eE6C93b3A54`

**Sepolia (testnet) :**

- `ArtworkRegistry` : `0xfa954e2AEC0827Bb69433db64F99F6E9df562113`
- `ArtworkTokenization` : `0x1f7Bac7B3F6B49E2147541aB58f2C6365A7Ed148`
