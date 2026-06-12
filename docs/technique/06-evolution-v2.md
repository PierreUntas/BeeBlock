# Évolution v2 des smart contracts

Cette note documente la prochaine évolution des contrats de Mona Editions. Le scope est volontairement minimaliste : deux corrections ciblées, pas de refonte d'architecture, pas d'ajout de fonctionnalités. Objectif : 2-3 heures de code, 1 journée de tests, déploiement Sepolia puis Base mainnet.

## Pourquoi une v2 maintenant

Le contrat actuel sur Base mainnet est déployé et fonctionnel pour le flux nominal (artiste autorisé → création d'édition → distribution QR codes → claim collectionneur). Mais deux limitations ont été identifiées qui méritent d'être corrigées avant le passage à l'échelle. Tant que la plateforme n'a qu'un nombre limité d'artistes, le coût de migration est négligeable. Plus tard, il deviendra prohibitif.

## Changement 1 — Invariant métadonnée basé sur la possession

### Le problème actuel

Dans `ArtworkRegistry.updateEditionMetadata`, la modification de la métadonnée est bloquée par le flag `hasBeenClaimed`, qui passe à `true` lors du premier `claimCertificate` exécuté avec succès.

Ce modèle a un trou : un artiste peut faire sortir des certificats de son wallet **sans passer par `claimCertificate`** — par exemple via un `safeTransferFrom` direct ERC-1155 vers un acheteur, une vente sur OpenSea, ou un airdrop manuel. Dans ces cas, `hasBeenClaimed` reste à `false`, ce qui autorise toujours l'artiste à appeler `updateEditionMetadata`. La modification se propage alors à tous les détenteurs, y compris ceux qui ont acquis leur certificat hors flux QR.

L'invariant promis aux acheteurs (« la métadonnée ne changera plus après que vous avez votre certificat ») n'est donc pas tenu dans tous les chemins d'exécution.

### La correction v2

Remplacer le test sur `hasBeenClaimed` par un test sur la balance effective de l'artiste. Tant que l'artiste détient encore l'intégralité du tirage initial, la modification reste possible. Dès qu'un seul exemplaire a quitté son wallet — quelle qu'en soit la raison —, la métadonnée est gelée.

### Modifications de code

Dans `ArtworkRegistry.sol`, ajouter un mapping pour mémoriser la taille initiale de chaque édition :

```solidity
/// @dev Mapping de la taille initiale par édition (utilisé pour le check d'immutabilité)
mapping(uint256 => uint256) private initialEditionSize;
```

Renseigner cette valeur lors de la création de l'édition :

```solidity
function createArtworkEdition(...) external onlyAuthorizedArtist {
    // ... validations existantes
    
    uint tokenId = artworkTokenization.mintArtworkEdition(msg.sender, _amount, _metadata);
    
    ArtworkEdition storage edition = artworkEditions[tokenId];
    edition.merkleRoot = _merkleRoot;
    initialEditionSize[tokenId] = _amount;  // ← nouveau
    
    emit NewArtworkEdition(msg.sender, tokenId);
}
```

Remplacer la condition de blocage dans `updateEditionMetadata` :

```solidity
function updateEditionMetadata(
    uint256 _editionId,
    string memory _newMetadata
) external onlyAuthorizedArtist {
    ArtworkEdition storage edition = artworkEditions[_editionId];
    require(edition.merkleRoot != bytes32(0), EditionDoesNotExist());
    
    address artist = artworkTokenization.tokenArtist(_editionId);
    require(artist == msg.sender, NotYourEdition());
    
    // Nouveau check : l'artiste doit encore détenir l'intégralité du tirage initial
    uint256 currentBalance = artworkTokenization.balanceOf(artist, _editionId);
    require(currentBalance == initialEditionSize[_editionId], MetadataLocked());
    
    require(
        bytes(_newMetadata).length >= 40 && bytes(_newMetadata).length <= 100,
        InvalidIPFSCID()
    );
    
    artworkTokenization.updateTokenMetadata(_editionId, _newMetadata);
    
    emit EditionMetadataUpdated(msg.sender, _editionId, _newMetadata);
}
```

Le flag `hasBeenClaimed` reste utile pour `isEditionLocked()` côté frontend et pour d'autres usages futurs. On le garde et on le continue à mettre à jour dans `claimCertificate`. La logique du blocage métadonnée passe juste sur le check de balance.

### Tests à ajouter

- Modification de la métadonnée autorisée tant que la balance artiste = taille initiale.
- Modification refusée après un claim officiel (cas nominal — devrait passer comme avant).
- Modification refusée après un transfert direct ERC-1155 hors flux QR (nouveau cas couvert).
- Modification refusée après une vente OpenSea simulée (transfert vers un wallet tiers).
- Modification refusée avec une balance partielle multiple (artiste a vendu 2 sur 5).

## Changement 2 — Émission de l'événement URI standard EIP-1155

### Le problème actuel

`ArtworkTokenization.updateTokenMetadata` émet uniquement un événement custom `TokenMetadataUpdated`. Cet événement est compris par l'indexeur Mona Editions mais ignoré par les marketplaces externes (OpenSea, Rarible, Magic Eden, Zerion, Rainbow, etc.), qui écoutent uniquement l'événement standard défini par EIP-1155 :

```solidity
event URI(string _value, uint256 indexed _id);
```

Conséquence : quand un artiste corrige sa métadonnée avant le premier claim, la correction n'est jamais propagée aux caches des marketplaces externes. Les acheteurs voient la version d'avant correction dans leurs explorateurs habituels.

Le même problème existe lors de la création initiale d'une édition : `_mint` d'OpenZeppelin n'émet pas l'événement `URI`, donc les marketplaces ne détectent pas automatiquement les nouvelles éditions.

### La correction v2

Émettre l'événement `URI` à deux endroits dans `ArtworkTokenization.sol`.

Lors du mint initial :

```solidity
function mintArtworkEdition(address _artist, uint _amount, string memory _uri)
    external onlyOwner returns (uint256)
{
    if (_artist == address(0)) revert InvalidArtistAddress();
    if (_amount == 0) revert InvalidAmount();
    if (bytes(_uri).length < 40 || bytes(_uri).length > 100) revert InvalidIPFSCID();
    
    _currentTokenId++;
    uint256 newTokenId = _currentTokenId;
    
    tokenArtist[newTokenId] = _artist;
    _tokenURIs[newTokenId] = _uri;
    _mint(_artist, newTokenId, _amount, "");
    
    emit ArtworkEditionMinted(_artist, newTokenId, _amount);
    emit URI(_uri, newTokenId);  // ← informer les marketplaces dès la création
    
    return newTokenId;
}
```

Lors d'une mise à jour de métadonnée :

```solidity
function updateTokenMetadata(uint256 _tokenId, string memory _newMetadata) external onlyOwner {
    if (bytes(_newMetadata).length < 40 || bytes(_newMetadata).length > 100) revert InvalidIPFSCID();
    
    _tokenURIs[_tokenId] = _newMetadata;
    
    emit TokenMetadataUpdated(_tokenId, _newMetadata);  // event custom conservé
    emit URI(_newMetadata, _tokenId);                    // ← event standard EIP-1155
}
```

L'événement `URI` est déjà déclaré dans le contrat parent `ERC1155` d'OpenZeppelin, donc rien à déclarer ; il suffit de l'émettre.

### Tests à ajouter

- Vérifier que `URI` est émis lors du mint, avec le bon CID et le bon tokenId.
- Vérifier que `URI` est émis lors d'une mise à jour, avec le nouveau CID.
- Vérifier que `TokenMetadataUpdated` (custom) reste émis en parallèle pour ne pas casser l'indexation interne.

## Stratégie de migration

### Phase 1 — Développement et tests (Sepolia)

1. Modifier `ArtworkRegistry.sol` et `ArtworkTokenization.sol` localement.
2. Compléter la suite de tests existante avec les cas listés ci-dessus.
3. Déployer sur Sepolia via Hardhat Ignition.
4. Vérifier les contrats sur Sepolia Etherscan.
5. Faire un parcours complet de bout en bout sur Sepolia : création artiste, autorisation, création d'édition, claim, tentative de mise à jour métadonnée après claim, vérification de l'événement URI dans les logs.

### Phase 2 — Déploiement Base mainnet

1. Déployer la v2 sur Base mainnet, garder les anciennes adresses v1 actives en parallèle.
2. Mettre à jour `frontend/config/contracts.ts` pour pointer sur la v2.
3. Recréer le profil de l'artiste actuel (le.s seul.s sur la plateforme) sur la v2.
4. Re-autoriser cet artiste depuis le compte admin.
5. Communiquer la migration à l'artiste (re-connexion email, re-création des éditions à venir sur la nouvelle adresse).

### Phase 3 — Décommissionnement v1 (optionnel)

Les contrats v1 restent on-chain de toute façon (immuables), mais on les retire du frontend. Aucune action destructive nécessaire. Les éventuels collectionneurs ayant claim un certificat sur la v1 le conservent ; il reste lisible via `getArtworkEdition` sur l'adresse v1.

## Adresses

À renseigner après déploiement :

| Réseau | ArtworkRegistry v2 | ArtworkTokenization v2 |
|--------|---------------------|------------------------|
| Sepolia | _à déployer_ | _à déployer_ |
| Base mainnet | _à déployer_ | _à déployer_ |

Pour mémoire, les adresses v1 sont :

- Base mainnet : ArtworkRegistry `0x157DbA323117DC54A7907E55d0cA7553974E79a5`, ArtworkTokenization `0x73D6Dd9498Fed8F85cc7ceBAc8593eE6C93b3A54`.
- Sepolia : ArtworkRegistry `0xfa954e2AEC0827Bb69433db64F99F6E9df562113`, ArtworkTokenization `0x1f7Bac7B3F6B49E2147541aB58f2C6365A7Ed148`.

## Estimation d'effort

| Étape | Effort |
|-------|--------|
| Modifications Solidity (2 contrats) | 2-3 heures |
| Tests Hardhat (cas existants + nouveaux) | 4-6 heures |
| Déploiement Sepolia + vérification | 1 heure |
| Test parcours complet sur Sepolia | 1-2 heures |
| Déploiement Base mainnet + migration frontend | 1-2 heures |
| **Total** | **environ 1 à 1,5 jour de travail** |

## Ce que la v2 ne fait pas (volontairement)

Pour éviter le scope creep, la v2 ne contient pas :

- Refonte de la custodie des certificats (toujours détenus par l'artiste — H1 et H2 restent ouverts).
- Migration vers un système d'enchères ou de vente directe (payment link, escrow, etc.).
- Ownable2Step ou multisig owner (à traiter séparément côté ops).
- Modifications du frontend autres que la mise à jour des adresses.
- Mécanique de remboursement, vesting, ou autres primitives DeFi.

Ces évolutions plus structurelles sont gardées pour une éventuelle v3 ou pour des projets satellites.

## Bénéfices attendus

- **Intégrité de l'invariant métadonnée** : un acheteur hors flux QR (cas rare mais possible) est désormais protégé au même niveau qu'un acheteur officiel.
- **Compatibilité marketplaces** : les certificats Mona Editions deviennent des objets ERC-1155 « citoyens du monde », correctement indexés par OpenSea, Rarible, Magic Eden, et tous les wallets qui affichent des NFT.
- **Crédibilité technique** : émettre l'événement `URI` standard est une marque de respect du protocole. Petit détail qui distingue les contrats « bricolés » des contrats « standards-compliant ».
