# Flux de certification — bout en bout

Ce document décrit le cycle de vie complet d'une œuvre certifiée sur Mona Editions, du recrutement de l'artiste jusqu'à la transmission d'un certificat entre collectionneurs.

> **Note transverse — gas sponsoring.** Toutes les transactions décrites ci-dessous (admin → autorisation, artiste → approval & création d'édition, collectionneur → claim & avis) sont sponsorisées par le paymaster Privy. Aucun de ces acteurs n'a besoin de détenir de l'ETH. Seule exception : `addAdmin` / `removeAdmin` appelées par l'owner depuis le dashboard `/owner`, qui s'exécutent en transaction classique payée par le wallet opérationnel de l'équipe.

## Étape 0 — Onboarding de l'artiste

**Acteurs** : équipe Mona Editions (admin) + artiste.

1. L'artiste prend contact (formulaire `/contact`, partenariat galerie, etc.).
2. Un admin évalue la candidature et signe `authorizeArtist(artistAddress, true)` depuis le dashboard `/admin`.
3. L'artiste se connecte à `/artist`, complète son profil (nom, bio, portfolio, site web, localisation). Le JSON est uploadé sur IPFS et le CID est enregistré on-chain via `setArtistInfo(cid)`.
4. **Étape clé** : l'artiste signe `setApprovalForAll(ArtworkRegistry, true)` sur le contrat de tokens (transaction sponsorisée). Sans cela, les futurs claims échoueront. Le frontend vérifie cet état avec `isArtistApproved(address)` et bloque la création d'édition tant que l'approval n'est pas posé.

## Étape 1 — Création d'une édition

**Acteur** : artiste autorisé.

### 1.1 Préparation des métadonnées

Dans le wizard `/artist/editions/create`, l'artiste renseigne :

- Titre, année, technique, dimensions, description.
- Image principale (haute résolution) et galerie d'images secondaires.
- Nombre de certificats à émettre (1 à `maxEditionSize`, défaut 100 000).

### 1.2 Génération des secrets et du Merkle Tree

Côté client (jamais côté serveur — les secrets ne doivent jamais quitter le navigateur de l'artiste pour des raisons de chain-of-custody) :

1. Génération de N clés aléatoires avec `crypto.getRandomValues` (32 octets, encodage hex).
2. Calcul des feuilles : `leaf = keccak256(keccak256(secretKey))`.
3. Construction du Merkle Tree avec `merkletreejs`, en mode `{ sortPairs: true }` pour cohérence avec `MerkleProof.verify` d'OpenZeppelin.
4. Récupération de la racine `merkleRoot` et, pour chaque clé, de sa preuve `proof[]`.

### 1.3 Upload IPFS

Le JSON de métadonnées de l'édition est uploadé via `POST /api/ipfs/add`. Le CID renvoyé sera passé au contrat.

### 1.4 Transaction on-chain

L'artiste signe :

```solidity
createArtworkEdition(metadataCID, amount, merkleRoot)
```

Le registre :

- Vérifie l'authorization de l'artiste, l'approval ERC-1155, la taille de l'édition, la validité du CID, la non-nullité de la racine.
- Délègue à `ArtworkTokenization.mintArtworkEdition(artist, amount, metadataCID)` qui mint les `amount` certificats sur l'adresse de l'artiste.
- Stocke `ArtworkEdition { merkleRoot, hasBeenClaimed: false, disabled: false }`.
- Émet `NewArtworkEdition(artist, editionId)`.

### 1.5 Export des QR codes

À la fin du wizard, le client produit :

- Un **CSV** (ou XLSX) listant pour chaque certificat : numéro, `secretKey`, `proof`, URL de claim.
- Un **ZIP de QR codes PNG** (un par certificat), encodant l'URL `https://app.mona-editions.com/collector/claim?edition=<id>&key=<secret>`.

L'artiste télécharge ces fichiers, les imprime ou les fait graver sur un support physique (sticker, plaque, NFC) qui accompagnera chaque exemplaire de l'œuvre.

### 1.6 Phase de relecture (optionnelle)

Tant qu'aucun certificat n'a été réclamé (`hasBeenClaimed == false`), l'artiste peut corriger les métadonnées via `updateEditionMetadata(editionId, newCID)`. Dès le premier claim, les métadonnées sont gelées définitivement — c'est la garantie d'authenticité pour le collectionneur.

## Étape 2 — Distribution physique

Hors-chain. L'artiste ou la galerie associe chaque QR code à un exemplaire physique de l'œuvre (au dos, dans un emballage scellé, en sticker holographique, etc.). Cette étape relève de la logistique et n'est pas portée par la plateforme.

**Bonne pratique** : ne jamais photographier les QR codes ni les exposer publiquement avant remise au collectionneur — un QR code lu et réclamé par un tiers ne peut plus servir à l'acquéreur légitime.

## Étape 3 — Réclamation par le collectionneur

**Acteur** : collectionneur (wallet ou email).

1. Le collectionneur scanne le QR code → ouvre `https://app.mona-editions.com/collector/claim?edition=X&key=Y`.
2. S'il n'est pas authentifié, Privy affiche le modal de login (email ou wallet). En cas d'email, un embedded wallet Privy est provisionné automatiquement.
3. Le frontend résout la preuve de Merkle associée à la clé (depuis un index IPFS publié par l'artiste, ou directement depuis le QR code si la preuve y est embarquée).
4. Vérifications côté client :
   - L'édition existe ? `getArtworkEdition(editionId)`
   - L'édition n'est pas désactivée ?
   - La clé n'a pas déjà été claimée ? `isKeyClaimed(editionId, secretKey)`
5. Si tout est OK, le collectionneur signe `claimCertificate(editionId, secretKey, proof)`.
6. Le contrat :
   - Vérifie l'existence + l'état actif de l'édition.
   - Vérifie qu'il reste des certificats (`balanceOf(artist, editionId) > 0`).
   - Vérifie que la clé n'a pas été utilisée.
   - Vérifie la preuve de Merkle contre `merkleRoot`.
   - Marque la clé comme consommée.
   - Met `hasBeenClaimed = true` (gel des métadonnées).
   - `safeTransferFrom(artist, collector, editionId, 1, "")` — transfert ERC-1155.
   - Émet `CertificateClaimed(collector, editionId)`.
7. Le frontend affiche la confirmation, le certificat, le lien Basescan de la transaction, et propose d'ajouter le NFT au wallet.

## Étape 4 — Vie du certificat

Le certificat est un token ERC-1155 standard. Le collectionneur peut :

- **Le conserver** dans son wallet (visible dans tout explorateur compatible : Basescan, OpenSea, Zerion…).
- **Le transférer** à un autre collectionneur via une transaction ERC-1155 standard (`safeTransferFrom`). Aucun lien on-chain n'est conservé entre l'identité du collectionneur initial et le nouveau détenteur — seule l'adresse wallet courante fait foi.
- **Publier un avis** sur l'édition via `addReview(editionId, rating, metadataCID)` (limité à `maxReviewsPerUserAndEdition`).

## Étape 5 — Remédiation (cas exceptionnel)

Si un lot de QR codes est compromis (vol, fuite, photographie) :

1. Un admin appelle `disableEdition(editionId)` — bloque immédiatement tout nouveau claim.
2. Hors-chain : on régénère N' nouvelles clés pour les certificats **non encore réclamés** (les déjà réclamés ne bougent pas).
3. On reconstruit le Merkle Tree et on calcule la nouvelle racine.
4. Un admin appelle `replaceEditionMerkleRoot(editionId, newRoot)` — l'édition est ré-activée. Les anciennes clés ne valident plus.
5. De nouveaux QR codes sont produits et redistribués via le processus logistique.

## Récapitulatif des invariants

| Invariant | Mécanisme |
|-----------|-----------|
| Une clé ne peut être utilisée qu'une seule fois | `claimedKeys[editionId][hash(key)]` |
| Seules les clés du Merkle Tree initial sont valides | `MerkleProof.verify` contre `merkleRoot` |
| Les métadonnées d'une édition réclamée sont immuables | `hasBeenClaimed` verrouille `updateEditionMetadata` |
| Seul l'artiste peut créer une édition à son nom | `onlyAuthorizedArtist` + check d'approval |
| Seul `ArtworkRegistry` peut mint des tokens | `ArtworkTokenization.mintArtworkEdition` est `onlyOwner` |
| Aucune réentrance possible sur le claim | `nonReentrant` modifier |
| Seul un détenteur peut publier un avis | `balanceOf(msg.sender, editionId) > 0` |
