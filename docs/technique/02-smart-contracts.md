# Smart contracts — Mona Editions

Deux contrats Solidity (0.8.28) déployés sur Base mainnet et Sepolia. Ils s'appuient sur OpenZeppelin Contracts pour les briques `Ownable`, `ReentrancyGuard`, `MerkleProof` et `ERC1155`.

## ArtworkRegistry

Contrat principal portant toute la logique métier : rôles, gestion d'artistes, création d'éditions, claims, avis collectionneurs et procédures de remédiation.

### Hiérarchie de rôles

- **Owner** — déployeur du contrat, peut ajouter/retirer des admins et modifier les paramètres de configuration.
- **Admin(s)** — peuvent autoriser/révoquer des artistes, désactiver des éditions, remplacer une racine de Merkle compromise.
- **Artiste autorisé** — peut renseigner ses métadonnées et créer des éditions.
- **Collectionneur** — wallet standard (aucun rôle on-chain), peut réclamer un certificat puis publier des avis.

Les modifiers `onlyOwner`, `onlyAdmin` et `onlyAuthorizedArtist` gardent les fonctions correspondantes.

### Variables de configuration

| Variable | Valeur par défaut | Effet |
|----------|-------------------|-------|
| `maxEditionSize` | `100 000` | Taille maximale d'une édition |
| `maxReviewsPerUserAndEdition` | `5` | Nombre d'avis maximum par utilisateur et par édition |
| `maxReviewsQuery` | `100` | Pagination maximale de la fonction `getEditionReviews` |

Chacune est ajustable par l'owner via les setters `setMaxEditionSize`, `setMaxReviewsPerUserAndEdition`, `setMaxReviewsQuery`.

### Fonctions principales

#### Administration

- `addAdmin(address)` / `removeAdmin(address)` — gestion des admins (owner uniquement).
- `authorizeArtist(address, bool)` — accorde ou révoque le statut artiste (admin).
- `disableEdition(uint256)` — désactive une édition (modération ou compromission).
- `replaceEditionMerkleRoot(uint256, bytes32)` — remplace la racine de Merkle d'une édition désactivée par une nouvelle, puis ré-active l'édition. Utilisée pour invalider en masse des QR codes compromis.

#### Artiste

- `setArtistInfo(string metadataCID)` — enregistre ou met à jour les métadonnées d'artiste (IPFS CID).
- `createArtworkEdition(string metadataCID, uint256 amount, bytes32 merkleRoot)` — crée une nouvelle édition de `amount` certificats. Mint les ERC-1155 sur le wallet de l'artiste. Pré-requis : l'artiste doit avoir appelé `setApprovalForAll(ArtworkRegistry, true)` sur le contrat de tokens.
- `updateEditionMetadata(uint256 editionId, string newMetadataCID)` — modifie les métadonnées de l'édition **tant qu'aucun certificat n'a été réclamé**. Après le premier claim, les métadonnées sont gelées (`MetadataLocked`).

#### Collectionneur

- `claimCertificate(uint256 editionId, string secretKey, bytes32[] merkleProof)` — réclame un certificat. Vérifie l'existence de l'édition, sa disponibilité (`balanceOf > 0`), la non-réutilisation de la clé, la validité de la preuve de Merkle, puis transfère 1 token de l'artiste vers `msg.sender`.
- `addReview(uint editionId, uint8 rating, string metadataCID)` — publie un avis (note 0-5 + IPFS CID). Réservé aux détenteurs d'un certificat de cette édition, limité à `maxReviewsPerUserAndEdition` par utilisateur.

#### Lecture

- `getArtist(address)` — retourne `Artist { authorized, metadata }`.
- `getArtworkEdition(uint id)` — retourne `(metadataURI, merkleRoot, hasBeenClaimed, disabled)`.
- `getEditionReviews(uint editionId, uint start, uint limit)` — avis paginés.
- `getEditionReviewsCount(uint editionId)`, `isKeyClaimed`, `isAdmin`, `isEditionLocked`, `isArtistApproved`.

### Événements

`NewAdmin`, `AdminRemoved`, `AuthorizationArtist`, `ArtistInfoUpdated`, `NewArtworkEdition`, `CertificateClaimed`, `NewReview`, `EditionMetadataUpdated`, `EditionDisabled`, `EditionMerkleRootReplaced`, `MaxEditionSizeUpdated`, `MaxReviewsPerUserAndEditionUpdated`, `MaxReviewsQueryUpdated`.

Le frontend s'abonne à `NewArtworkEdition` et `CertificateClaimed` pour mettre à jour les vues collectionneur en quasi-temps réel.

### Erreurs custom (sélection)

- `OnlyAdminAuthorized`, `ArtistNotAuthorized`, `AuthorizationAlreadyApplied`
- `InvalidMerkleProof`, `KeyAlreadyClaimed`, `NoCertificateLeft`
- `EditionSizeTooLarge`, `EditionMustHaveCertificates`, `EmptyMerkleRoot`
- `EditionIsDisabled`, `EditionAlreadyDisabled`, `EditionNotDisabled`
- `MetadataLocked`, `NotYourEdition`, `EditionDoesNotExist`
- `RatingOutOfRange`, `ReviewLimitReached`, `NotAllowedToReview`
- `InvalidIPFSCID`, `ArtistMustApproveContract`, `AlreadyAdmin`, `NotAnAdmin`, `QueryLimitTooHigh`, `InvalidConfigValue`

### Calcul de la feuille de Merkle

```solidity
bytes32 leaf = keccak256(abi.encodePacked(keccak256(abi.encodePacked(secretKey))));
```

Le double-hash protège contre les collisions de second-pré-image inhérentes à certains usages naïfs de Merkle Tree (cf. [OpenZeppelin docs](https://docs.openzeppelin.com/contracts/4.x/api/utils#MerkleProof)). Le frontend doit produire les feuilles avec exactement la même formule.

---

## ArtworkTokenization

Contrat ERC-1155 minimal, propriétaire = `ArtworkRegistry`.

### Particularités

- Chaque `tokenId` correspond à une édition.
- L'`uri(tokenId)` retourne un CID IPFS spécifique à l'édition, pas un template avec placeholder.
- Le mapping `tokenArtist[tokenId]` permet de retrouver l'auteur d'une édition à partir du token, sans rejouer les événements.

### Fonctions

- `mintArtworkEdition(address artist, uint256 amount, string uri)` — mint `amount` certificats au profit de l'artiste. **OnlyOwner** (donc seul `ArtworkRegistry` peut mint).
- `updateTokenMetadata(uint256 tokenId, string newMetadata)` — change l'URI d'un token. Appelé par `ArtworkRegistry` quand un artiste met à jour les métadonnées avant le premier claim.
- `uri(uint256 tokenId)` — surcharge `ERC1155.uri` pour retourner le CID propre au token.

### Approval pour le transfert

Pour qu'un collectionneur puisse réclamer, l'artiste doit avoir donné son accord au registre :

```solidity
artworkTokenization.setApprovalForAll(ArtworkRegistry, true);
```

Sans cela, `safeTransferFrom` dans `claimCertificate` échoue avec `ERC1155MissingApprovalForAll`. Le frontend détecte cet état via `isArtistApproved(address)` et propose à l'artiste de signer l'approval lors de son onboarding.

---

## Modèle d'autorisation à chaud

```
                    ┌─────────────┐
                    │    Owner    │
                    └──────┬──────┘
            addAdmin /     │     setMaxEditionSize, etc.
            removeAdmin    ▼
                    ┌─────────────┐
                    │   Admin(s)  │
                    └──────┬──────┘
        authorizeArtist /  │  disableEdition / replaceMerkleRoot
        revoke             ▼
                    ┌─────────────┐
                    │   Artiste   │
                    └──────┬──────┘
                           │ createArtworkEdition / updateEditionMetadata
                           ▼
                    ┌─────────────┐
                    │ Certificat  │  (ERC-1155, claimable)
                    └──────┬──────┘
                           │ claimCertificate (Merkle proof)
                           ▼
                    ┌─────────────┐
                    │Collectionneur│
                    └─────────────┘
```

L'owner ne peut pas autoriser un artiste directement (il doit d'abord s'ajouter comme admin) — cela maintient le principe de moindre privilège dans les opérations courantes.

## Procédure de remédiation (compromission de QR codes)

Si un lot de QR codes est volé ou photographié avant remise au collectionneur :

1. Admin appelle `disableEdition(editionId)` — empêche immédiatement tout nouveau claim.
2. Côté off-chain, on régénère N nouvelles clés secrètes pour les certificats **non encore réclamés**.
3. On reconstruit un nouveau Merkle Tree à partir de ces nouvelles clés.
4. Admin appelle `replaceEditionMerkleRoot(editionId, newRoot)` — l'édition est ré-activée avec la nouvelle racine. Les anciennes clés ne valident plus la preuve.
5. De nouveaux QR codes sont produits pour les certificats restants.

Les certificats déjà réclamés ne sont pas affectés (les tokens ERC-1155 sont déjà chez les collectionneurs légitimes).
