# Frontend — Mona Editions

Application Next.js 16 (App Router, mode Webpack), hébergée sur Vercel.

## Stack

| Brique | Choix | Rôle |
|--------|-------|------|
| Framework | Next.js 16 (App Router) | Rendu serveur + routes API |
| Auth | Privy (`@privy-io/react-auth` + `@privy-io/wagmi`) | Login email ou wallet |
| Web3 | wagmi 2 + viem 2 | Lecture/écriture contrats |
| State | TanStack React Query | Cache des reads on-chain et IPFS |
| Style | Tailwind CSS 4 | Design system |
| Token UX | merkletreejs, qrcode, jszip, xlsx | Génération des QR codes et exports |
| IPFS | pinata SDK côté serveur | Upload de métadonnées |
| Email | resend | Formulaire de contact |

## Arborescence des routes (App Router)

```
app/
├── layout.tsx              Provider stack (Privy → Wagmi → React Query)
├── page.tsx                Landing page
├── PrivyProvider.tsx       Configuration Privy
├── ModalProvider.tsx       Modales globales
├── about/                  Présentation du projet
├── faq/                    FAQ utilisateur
├── contact/                Formulaire de contact (Resend)
├── legal/                  Mentions légales
├── explore/
│   └── edition/[id]/       Page publique d'une édition
├── artist/
│   ├── page.tsx            Dashboard artiste
│   └── editions/
│       └── create/         Wizard de création d'édition
├── collector/
│   ├── page.tsx            Dashboard collectionneur
│   └── claim/              Réclamation déclenchée par QR code
├── admin/                  Dashboard admin (autoriser artistes, désactiver éditions)
├── owner/                  Dashboard owner (gestion des admins, config)
└── api/
    ├── ipfs/               Proxy Pinata (upload de JSON et fichiers)
    └── contact/            Endpoint Resend pour le formulaire de contact
```

## Auth et configuration Web3

Stack de providers (de l'extérieur vers l'intérieur) :

```tsx
<PrivyProvider appId={NEXT_PUBLIC_PRIVY_APP_ID}>
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </WagmiProvider>
</PrivyProvider>
```

- `app/PrivyProvider.tsx` configure les méthodes de login (`email`, `wallet`) et la chaîne par défaut (`base`).
- `config/wagmi.ts` exporte le wagmi config avec les chaînes Base + Sepolia et les transports Alchemy.
- `lib/client.ts` expose un `publicClient` viem pour les usages serveur / scripts ; il pointe par défaut vers Sepolia en environnement de dev.

Privy gère pour l'utilisateur final l'embedded wallet (signature email-only) ou la connexion d'un wallet existant (MetaMask, Coinbase Wallet, Rainbow…). Tout est exposé en `useAccount`, `useSignMessage`, `useWriteContract` via wagmi.

## Interaction avec les contrats

`config/contracts.ts` exporte :

- `artworkRegistryAbi` et `artworkTokenizationAbi`
- `artworkRegistryAddress` et `artworkTokenizationAddress` indexées par chainId

**Lectures** — hook wagmi standard :

```tsx
const { data: edition } = useReadContract({
  address: artworkRegistryAddress[chain.id],
  abi: artworkRegistryAbi,
  functionName: "getArtworkEdition",
  args: [BigInt(editionId)],
});
```

**Écritures sponsorisées (cas général)** — toutes les transactions artistes/admins/collectionneurs passent par le `sendTransaction` de Privy avec `sponsor: true`, ce qui les route vers le paymaster Privy :

```tsx
import { useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData } from "viem";

const { sendTransaction } = useSendTransaction();

const data = encodeFunctionData({
  abi: artworkRegistryAbi,
  functionName: "claimCertificate",
  args: [BigInt(editionId), secretKey, proof],
});

await sendTransaction(
  { to: ARTWORK_REGISTRY_ADDRESS, data },
  { sponsor: true }
);
```

Pages concernées : `/artist/editions/create` (approval ERC-1155 + `createArtworkEdition`), `/artist` (modifications profil/édition), `/collector/claim` (`claimCertificate`), `/collector` (avis), `/admin` (`authorizeArtist`, `disableEdition`, `replaceEditionMerkleRoot`).

**Écriture non sponsorisée (cas unique)** — `addAdmin` / `removeAdmin` depuis `/owner/page.tsx` utilise `useWriteContract` de wagmi. L'owner est un wallet opérationnel financé en ETH sur Base, donc le sponsoring n'est ni nécessaire ni souhaitable (limiter l'exposition du paymaster aux seuls flux à fort volume utilisateur).

```tsx
const { writeContract } = useWriteContract();
writeContract({
  address: ARTWORK_REGISTRY_ADDRESS,
  abi: artworkRegistryAbi,
  functionName: "addAdmin",
  args: [newAdminAddress],
});
```

## IPFS

### Upload (server → Pinata)

`/app/api/ipfs/add/route.ts` reçoit un fichier ou un JSON, l'envoie à Pinata avec le JWT serveur (jamais exposé côté client), et renvoie le CID. Toutes les écritures IPFS du frontend passent par cet endpoint.

### Lecture

`utils/ipfs.ts` expose `fetchIPFS(cid)` qui :

1. Vérifie un cache mémoire en premier (évite les requêtes redondantes pendant une session).
2. Construit l'URL `https://ipfs.io/ipfs/{cid}` (gateway publique).
3. Parse en JSON ou retourne le binaire selon le content-type.

Le fallback vers la gateway Pinata est possible via `IPFS_GATEWAY_URL` si besoin.

## Wizard de création d'édition (`/artist/editions/create`)

Étapes typiques :

1. **Métadonnées** — formulaire (titre, année, technique, description, image principale, images secondaires).
2. **Upload IPFS** — l'image et le JSON de métadonnées sont uploadés via `/api/ipfs/add`. On récupère le CID de l'édition.
3. **Génération des secrets** — `merkletreejs` génère N clés aléatoires (`crypto.getRandomValues`), construit les feuilles `keccak256(keccak256(secret))`, puis le Merkle Tree.
4. **Vérification d'approval** — `isArtistApproved(address)`. Si `false`, on demande à l'artiste de signer `setApprovalForAll(ArtworkRegistry, true)` avant toute création.
5. **Transaction** — `createArtworkEdition(cid, amount, root)`.
6. **Export CSV / ZIP** — pour chaque clé, on assemble `(editionId, secretKey, proof[])` et l'URL de claim `https://app.mona-editions.com/collector/claim?edition=X&key=Y`. Le QR code est généré avec `qrcode`. Les QR codes peuvent être packagés en ZIP via `jszip`, et un export XLSX (`xlsx`) liste les paires pour archivage.

## Page de claim (`/collector/claim`)

1. Lecture des query params `edition` et `key`.
2. Si le collectionneur n'est pas connecté → flow Privy.
3. Vérification on-chain `isKeyClaimed(editionId, key)`. Si oui → message « déjà réclamé », option de scanner un autre QR code.
4. Reconstruction de la preuve : le frontend doit avoir accès aux preuves (soit l'artiste les a publiées sur IPFS, soit elles sont passées dans le QR code).
5. Appel `claimCertificate(editionId, key, proof)`.
6. Affichage de la transaction puis du certificat fraîchement obtenu (image, métadonnées).

## Design system

Tailwind CSS 4 avec les tokens couleur :

| Token | Valeur | Usage |
|-------|--------|-------|
| Background | `#f5f3ef` | Fond global beige chaud |
| Cards | `#fafaf8` | Surfaces élevées |
| Texte secondaire | `#78716c` | Labels, légendes |
| Texte primaire | `#1c1917` | Corps de texte |
| Bordures | `#d6d0c8` | Séparateurs fins |

Typographie : serif pour les titres, sans-serif `font-light` pour le corps, majuscules + tracking large pour les labels de section. Style éditorial cohérent avec l'univers galerie d'art.

Composants UI custom (pas de framework type shadcn imposé) ; les icônes proviennent de `lucide-react`.

## Configuration Next.js

`next.config.ts` ajoute des alias webpack pour stub :

- `fs`, `net`, `tls` → `false` (modules Node absents côté browser)
- Packages React Native qui apparaissent dans la chaîne de dépendances de certains SDK Web3, remplacés par `null-loader` / `ignore-loader`

Sans ces alias, le build webpack casse sur les packages qui supposent un environnement Node.

## Variables d'environnement frontend

Documentées dans le `CLAUDE.md` du projet. Les variables `NEXT_PUBLIC_*` sont exposées au client, les autres restent côté serveur (Pinata JWT, Resend API key).

## Performance et UX

- Reads on-chain mis en cache par React Query (clé = `[address, functionName, args]`).
- Reads IPFS mis en cache mémoire pour la durée de la session.
- Pré-chargement des images d'édition via `next/image` avec `priority` sur les vues détail.
- Les transactions affichent un état pending → confirmed avec lien Basescan.

## Tests et qualité

- `npm run lint` — ESLint config Next + TypeScript.
- Pas de suite de tests E2E packagée dans le repo à ce stade ; les flux critiques sont validés manuellement sur Sepolia avant chaque release vers Base.
