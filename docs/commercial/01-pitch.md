# Mona Editions — Pitch

## En une phrase

**Mona Editions est la plateforme qui transforme chaque œuvre d'art en certificat numérique authentifié, infalsifiable et transmissible, sans demander à l'artiste ni au collectionneur d'être experts en blockchain.**

## Le problème

Le marché de l'art repose encore largement sur des certificats papier signés à la main. Cette pratique pose trois problèmes structurels :

1. **Falsification facile.** Un certificat papier, même tamponné par une galerie, est imitable et difficile à vérifier à distance.
2. **Pertes irrémédiables.** Un certificat égaré ou détruit fait perdre l'essentiel de la valeur de revente. Les ayants droit d'un artiste décédé n'ont aucun moyen fiable de réattester.
3. **Traçabilité opaque.** L'historique de propriété (provenance) reste éparpillé entre galeries, maisons de vente et catalogues raisonnés. Vérifier la chaîne complète d'une œuvre relève souvent de l'enquête.

À l'autre extrême, le marché « NFT art » a montré ses limites : œuvres entièrement virtuelles, spéculation déconnectée de la valeur artistique, expérience utilisateur réservée aux initiés.

## La solution

Mona Editions ancre chaque œuvre physique à un **certificat numérique on-chain**, accessible via un simple QR code apposé sur l'œuvre. Le collectionneur scanne, s'authentifie avec son email, et devient propriétaire vérifiable du certificat — sans jamais avoir à comprendre ce qu'est une blockchain.

**Concrètement :**

- L'artiste crée une édition de N exemplaires depuis son espace Mona Editions.
- La plateforme génère N QR codes uniques, à apposer sur chaque exemplaire physique.
- Le collectionneur scanne, se connecte avec son email, et reçoit son certificat dans un wallet créé pour lui à la volée.
- Le certificat est ensuite consultable, transférable et permet au collectionneur de laisser un avis vérifié sur l'édition.

## Pourquoi maintenant

- **Coût d'infrastructure devenu négligeable.** Sur Base (L2 Ethereum, opéré par Coinbase), une transaction coûte quelques centimes. Mona Editions prend ces frais à sa charge via un paymaster : artistes et collectionneurs n'ont jamais à payer de gas. Cela ouvre l'usage à l'art émergent et aux éditions à petit prix.
- **L'onboarding email-first est mature.** Les services type Privy permettent à un utilisateur lambda de réclamer un NFT sans installer de wallet, sans comprendre la blockchain. La friction qui bloquait l'adoption en 2021-2022 est largement résolue.
- **La demande de provenance vérifiable monte.** Maisons de vente, assureurs, douanes et plateformes secondaires demandent toutes des preuves d'authenticité numériques. Le marché institutionnel est prêt.

## Pour qui

| Cible | Bénéfice principal |
|-------|--------------------|
| **Artistes contemporains** émettant des tirages limités (estampes, sérigraphies, photographies, sculptures éditées) | Lien permanent et infalsifiable entre l'œuvre et son auteur, valorisation de chaque édition |
| **Galeries** | Outil de différenciation, gestion centralisée des certificats, suivi de la revente secondaire |
| **Collectionneurs** | Garantie d'authenticité, preuve de propriété à présenter pour assurance/revente, accès à un suivi de provenance |
| **Maisons de vente** | Vérification automatisée de l'origine, réduction du risque de litige |

## Ce qui rend Mona Editions différent

1. **Œuvres physiques, pas seulement digitales.** Le certificat est l'extension numérique d'une œuvre tangible — il ne la remplace pas.
2. **UX sans friction.** Scan + email. Pas de seed phrase à mémoriser, pas de wallet à installer.
3. **Zéro frais pour l'utilisateur.** Émettre et réclamer un certificat est totalement gratuit pour l'artiste comme pour le collectionneur. Mona Editions sponsorise toutes les transactions blockchain via un paymaster intégré.
4. **Curation des artistes.** Le système de rôles garantit qu'un artiste sur la plateforme a été vérifié — pas d'open-bar à la spéculation.
5. **Métadonnées gelées après vente.** Une fois un certificat réclamé, les informations de l'édition deviennent immuables — la garantie d'authenticité ne peut plus être modifiée par l'artiste ou la plateforme.
6. **Procédure de remédiation prévue.** Si des QR codes sont compromis avant remise, l'équipe peut les invalider en masse et en émettre de nouveaux, sans toucher aux certificats déjà détenus.

## Stack et infrastructure (résumé)

- Smart contracts en Solidity sur **Base mainnet** (L2 Ethereum opéré par Coinbase).
- Application web Next.js, authentification Privy (email + wallet).
- Stockage des métadonnées sur **IPFS** (via Pinata).
- Audit des transactions accessible publiquement sur Basescan.

## Status

- Contrats déployés et vérifiés sur Base mainnet et Sepolia.
- Application web opérationnelle.
- Phase de premiers déploiements avec artistes pilotes.

## Prochaines étapes

- Partenariats avec galeries indépendantes et écoles d'art.
- Intégration avec les principales plateformes de vente secondaire.
- Outils dédiés aux ayants droit et catalogues raisonnés.
- Programme d'ambassadeurs pour artistes émergents.
