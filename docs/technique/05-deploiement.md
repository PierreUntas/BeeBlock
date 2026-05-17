# Déploiement et exploitation

## Réseaux supportés

| Réseau | Usage | Chain ID |
|--------|-------|----------|
| Base mainnet | Production | 8453 |
| Base Sepolia | Pré-production (optionnel) | 84532 |
| Sepolia | Tests d'intégration | 11155111 |

## Contrats — pré-requis

- Node.js 20+ et npm
- Compte Alchemy (clé RPC Base / Sepolia)
- Clé privée du wallet de déploiement, financée en ETH sur le réseau cible
- Clé Basescan pour la vérification

Les variables d'environnement nécessaires sont listées dans le `CLAUDE.md` du projet.

## Déploiement des contrats

Hardhat Ignition gère les deux contrats en une seule passe via le module `ArtworkCertificationSystem.ts`. Le module :

1. Déploie `ArtworkTokenization(uriIpfs)`.
2. Déploie `ArtworkRegistry(addressArtworkTokenization)`.
3. Transfère l'ownership de `ArtworkTokenization` vers `ArtworkRegistry` (pour que seul le registre puisse mint).

### Sepolia

```bash
cd contracts
npx hardhat ignition deploy ignition/modules/ArtworkCertificationSystem.ts --network sepolia
```

### Base mainnet

```bash
cd contracts
npx hardhat ignition deploy ignition/modules/ArtworkCertificationSystem.ts --network base
```

À la fin, noter les deux adresses affichées et les reporter dans le `CLAUDE.md` et dans `frontend/config/contracts.ts`.

### Vérification Basescan

```bash
npx hardhat verify --network base <ARTWORK_TOKENIZATION_ADDRESS> "<uriIpfs>"
npx hardhat verify --network base <ARTWORK_REGISTRY_ADDRESS> "<ARTWORK_TOKENIZATION_ADDRESS>"
```

Basescan affiche alors le code source et permet l'interaction « read/write » directement depuis l'explorateur.

## Tests

```bash
cd contracts
npx hardhat test
```

Exécute la suite (Hardhat + Chai + ethers). Le helper `generateSecretKeys(n)` dans `test/ArtworkRegistry.ts` construit un Merkle Tree de test et retourne les couples `(secret, proof)` utilisés par les scénarios.

Pour cibler un seul fichier :

```bash
npx hardhat test test/ArtworkRegistry.ts
```

## Déploiement du frontend

Le frontend est packagé pour Vercel.

### Variables d'environnement requises (côté Vercel)

Voir la section « Environment Variables » du `CLAUDE.md`. Les `NEXT_PUBLIC_*` sont publiques (build-time, exposées au client). Les autres restent côté serveur uniquement.

### Build local

```bash
cd frontend
npm install
npm run build
npm run start
```

### Build Vercel

Pousser sur la branche connectée au projet Vercel. Le build se déclenche automatiquement.

`next.config.ts` applique des alias webpack (stub de `fs`, `net`, `tls` et de quelques packages React Native qui apparaissent en dépendance transitoire des SDK Web3). Sans ces alias, le build échoue.

## Procédure de release type

1. **Dév + tests sur Sepolia** : déployer un build des contrats sur Sepolia, exécuter les tests, valider les flux frontend en pointant les `NEXT_PUBLIC_*` vers Sepolia.
2. **Pre-prod Base Sepolia** (optionnel) : si on veut tester l'écosystème Base sans engager de fonds, redeployer sur Base Sepolia.
3. **Production Base mainnet** :
   - Déployer les contrats avec Ignition.
   - Vérifier sur Basescan.
   - Mettre à jour les adresses dans `frontend/config/contracts.ts`.
   - Push frontend → Vercel.
   - Smoke-test : créer une édition test en interne, scanner un QR, vérifier le claim.
4. **Ouverture aux artistes** : ajouter le ou les admin(s) opérationnel(s) via `addAdmin`, puis autoriser les premiers artistes via `authorizeArtist`.

## Gas sponsoring

L'expérience utilisateur est entièrement « gasless » : artistes, admins et collectionneurs n'ont jamais besoin de détenir de l'ETH. Le frontend route leurs transactions via Privy avec l'option `sponsor: true`, qui les fait porter par un paymaster.

**Seule exception** : `addAdmin` et `removeAdmin`, appelées par l'owner depuis `/owner`, qui s'exécutent en transaction wagmi classique. Le wallet owner doit donc être financé en ETH sur Base (provision modeste — quelques opérations par an).

**Configuration côté Privy** :

- Dans le dashboard Privy, activer le paymaster sur Base mainnet (et Sepolia si nécessaire pour le staging).
- Définir les policies : adresses contractuelles whitelistées (`ArtworkRegistry` et `ArtworkTokenization`), fonctions sponsorisables, plafonds par utilisateur et par fenêtre temporelle pour éviter l'abus.
- Provisionner le compte paymaster en ETH sur Base. Un suivi régulier du solde est nécessaire — si le paymaster tombe à zéro, **toutes** les opérations utilisateur sont bloquées (l'app devient inutilisable hors du dashboard owner).

**À surveiller** :

- Solde du paymaster (alerting si < seuil).
- Consommation moyenne par claim / création d'édition / autorisation d'artiste.
- Détection d'abus : un même utilisateur qui réclamerait massivement des certificats pour drainer le paymaster (le contrat empêche le double-claim, mais une boucle de tentatives échouées sponsorisées reste un risque théorique — vérifier que Privy ne sponsorise pas les transactions reverted).

## Modèle de sécurité

### Contrats

| Surface | Mitigation |
|---------|------------|
| Réentrance sur `claimCertificate` | `nonReentrant` (OpenZeppelin) |
| Replay d'un QR code | `claimedKeys[editionId][hash(key)]` |
| Forge d'une clé non-incluse | Vérif Merkle (`OpenZeppelin MerkleProof.verify`) avec double-hash anti-second-preimage |
| Mint frauduleux | `mintArtworkEdition` est `onlyOwner` ⇒ seul `ArtworkRegistry` peut mint |
| Élévation de privilèges | Trois rôles séparés ; owner ne peut pas autoriser un artiste sans passer admin |
| Modification de métadonnées après vente | `hasBeenClaimed` verrouille `updateEditionMetadata` |
| Compromission de QR codes | `disableEdition` + `replaceEditionMerkleRoot` |
| Edition immortelle | `disableEdition` permet la modération sans casser les certificats déjà émis |
| Validation des CID IPFS | Longueur 40-100 caractères contrôlée à chaque écriture |

### Application

| Surface | Mitigation |
|---------|------------|
| Exfiltration du JWT Pinata | JWT côté serveur uniquement (`/api/ipfs/add`), jamais exposé au client |
| Génération des secrets prévisible | `crypto.getRandomValues` (CSPRNG navigateur) |
| Phishing du QR code | URL `https://app.mona-editions.com/...` exclusivement ; tout autre domaine est suspect |
| Wallet du collectionneur | Embedded wallet Privy (clé privée chiffrée côté Privy) ou wallet externe ; aucun secret côté Mona Editions |
| Form-spam contact | Resend + rate-limit côté endpoint |

### Pertes acceptées

- Si un collectionneur perd l'accès à son wallet, le certificat ne peut pas être restitué — c'est la contrepartie de la décentralisation. Les artistes sont sensibilisés à expliquer ce point à leurs collectionneurs.
- Si un QR code est perdu avant d'être réclamé, l'admin peut désactiver l'édition et remplacer la racine pour invalider la clé perdue et la redistribuer.

## Monitoring opérationnel

- **Basescan** — vue des transactions, événements, contract state.
- **Alchemy dashboard** — métriques RPC (latence, erreurs, quotas).
- **Vercel analytics** — trafic frontend, erreurs runtime, build status.
- **Pinata dashboard** — usage de stockage IPFS, status des pins.

Suivre en particulier :

- Le nombre d'événements `CertificateClaimed` par jour (volume de claims).
- Le ratio claims réussis vs claims échoués (signal d'usabilité).
- Les `EditionDisabled` et `EditionMerkleRootReplaced` (incidents de sécurité).
