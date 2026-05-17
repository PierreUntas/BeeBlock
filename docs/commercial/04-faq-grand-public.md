# FAQ — questions fréquentes

Une compilation des questions revenant le plus souvent — utile pour les médias, partenaires, galeries, journalistes, ou toute personne découvrant Mona Editions.

## Sur le projet

**Qu'est-ce que Mona Editions ?**
Une plateforme qui certifie des œuvres d'art physiques en éditions limitées. Chaque exemplaire reçoit un certificat numérique infalsifiable, lié on-chain à son auteur, et transmissible avec l'œuvre lors de chaque revente.

**Quelle est la différence avec un NFT « classique » ?**
Les NFT spéculatifs des années 2021-2022 étaient le plus souvent des œuvres entièrement numériques, sans existence physique, achetées et revendues pour leur valeur de marché. Mona Editions fait l'inverse : l'œuvre est physique, le certificat est son extension numérique, et la valeur reste celle de l'œuvre, pas du token.

**Pourquoi parler de « certification » plutôt que de « NFT » ?**
Parce que c'est exactement la fonction du certificat : prouver l'authenticité, identifier l'auteur, suivre la provenance. Le mot « NFT » a été tellement associé à la spéculation qu'il occulte cet usage. Techniquement, un certificat Mona Editions est un token ERC-1155 — mais ce qui compte, c'est son rôle.

**Quel est le statut juridique d'un certificat Mona Editions ?**
Le certificat est une représentation numérique d'authenticité, équivalent fonctionnel d'un certificat papier. Le cadre légal applicable est celui du droit de la propriété intellectuelle et de la vente d'œuvres d'art en vigueur dans la juridiction de l'acheteur et du vendeur.

## Sur la technologie

**Pourquoi avoir choisi Base et pas Ethereum directement ?**
Base est une « couche 2 » d'Ethereum opérée par Coinbase. Les transactions y coûtent quelques centimes au lieu de plusieurs euros, ce qui rend viable la certification d'éditions à prix modéré. La sécurité est héritée d'Ethereum, le réseau le plus établi.

**Et si Base disparaît ?**
Les données restent ancrées sur Ethereum (Base étant un rollup, ses preuves sont publiées sur Ethereum mainnet). En cas de défaillance de Base, des procédures de sortie permettent de récupérer les actifs. Au pire, les certificats peuvent être migrés vers un autre réseau ; au mieux, ils restent vérifiables tels quels.

**Où sont stockées les informations sur l'œuvre (image, titre, etc.) ?**
Sur IPFS, un système de stockage décentralisé. Les fichiers sont pinés via Pinata. La référence du fichier (son CID) est inscrite on-chain, ce qui garantit qu'aucune altération ultérieure ne peut passer inaperçue.

**Vos contrats sont-ils auditables ?**
Oui. Le code source des contrats est public et vérifié sur Basescan. Toute personne peut le lire, l'analyser, et vérifier que le comportement réel correspond aux promesses.

## Sur l'usage

**Combien ça coûte pour un artiste ?**
Zéro frais blockchain. Mona Editions sponsorise toutes les transactions des artistes (création d'édition, mise à jour de métadonnées, configuration de compte). Côté commercial, le modèle exact dépend du contexte — contactez l'équipe pour les conditions applicables à votre cas (artiste indépendant, galerie, école d'art, etc.).

**Combien ça coûte pour un collectionneur ?**
Zéro. Réclamer un certificat est entièrement gratuit. La plateforme prend en charge les frais blockchain via un paymaster intégré, pour que le collectionneur n'ait jamais à manipuler de cryptomonnaie ni à comprendre comment fonctionne le gas.

**Est-ce que je peux émettre des éditions « ouvertes » (non limitées) ?**
Non. Mona Editions est conçu pour les éditions limitées (de 1 à 100 000 exemplaires par défaut). C'est cohérent avec la logique d'authentification d'œuvres d'art — la rareté est partie intégrante de la valeur certifiée.

**Est-ce que je peux certifier une œuvre unique (pas une édition) ?**
Oui : créez une édition de 1 exemplaire. Le mécanisme est exactement le même.

**Est-ce que je peux certifier une œuvre déjà existante, ou seulement de nouvelles productions ?**
Les deux. Vous pouvez créer une édition pour une production en cours comme pour un travail ancien que vous souhaitez authentifier rétroactivement. La date d'émission du certificat est celle de la création sur la plateforme ; la date de l'œuvre figure dans les métadonnées.

## Sur la sécurité

**Qu'est-ce qui empêche quelqu'un de se faire passer pour un artiste ?**
La curation : chaque artiste autorisé sur la plateforme est vérifié par un administrateur Mona Editions avant de pouvoir publier. Un imposteur ne peut pas s'inscrire seul.

**Qu'est-ce qui empêche quelqu'un de scanner un QR code à ma place ?**
Tant que le QR code n'a pas été remis au collectionneur, le risque existe physiquement. C'est pourquoi les bonnes pratiques recommandent de garder les QR codes scellés jusqu'à remise. En cas d'incident, l'équipe peut désactiver une édition compromise et émettre de nouveaux QR codes pour les exemplaires restants.

**Qu'est-ce qui empêche un collectionneur de scanner deux fois le même QR code ?**
Le contrat refuse tout claim sur une clé déjà consommée. Chaque QR code est à usage unique.

**Et si quelqu'un trouve un moyen d'usurper l'identité d'un artiste autorisé ?**
La sécurité repose sur le contrôle du wallet de l'artiste. Tant que sa clé privée est protégée, son identité on-chain est inviolable. C'est pourquoi nous recommandons aux artistes de protéger leur wallet avec soin (méthode de récupération sécurisée, pas de partage de clé).

## Sur le modèle économique

**Comment Mona Editions gagne de l'argent ?**
Le modèle commercial est en cours de structuration. Les pistes incluent : commission sur la création d'édition pour les artistes professionnels, abonnements pour galeries et institutions, partenariats avec maisons de vente. L'accès reste gratuit pour les artistes émergents dans une phase d'amorçage.

**Quelle est l'équipe derrière Mona Editions ?**
Le projet est porté à l'origine dans le cadre d'une formation Alyra (école blockchain). L'équipe et les partenariats sont en cours de développement.

## Pour aller plus loin

- Documentation technique complète : voir `docs/technique/` dans le repository.
- Code source et contrats vérifiés : Basescan + GitHub.
- Contact : `app.mona-editions.com/contact`.
