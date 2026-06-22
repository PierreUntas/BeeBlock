# Journal des décisions juridiques — Mona Editions

**Pour :** Pierre (référence interne) et Maître Untas (revue ultérieure)
**Date des décisions :** 20 juin 2026
**Documents finalisés :**
- [01-mentions-legales.md](./01-mentions-legales.md)
- [02-politique-confidentialite.md](./02-politique-confidentialite.md)
- [03-conditions-generales-abonnement.md](./03-conditions-generales-abonnement.md)

---

## Contexte

Ma femme avocate étant indisponible pour relire avant une semaine, j'ai pris la décision de **finaliser moi-même les 3 documents juridiques** en appliquant les positions que je jugeais les plus défendables au regard des références juridiques mobilisables (CNIL 2018-352, Code de la consommation, RGPD).

Ce document a deux objectifs :

1. **Documenter mes choix** pour que je puisse les défendre si on m'interroge avant la revue de Maître Untas.
2. **Faciliter la revue ultérieure** : ma femme pourra prendre les décisions une par une, valider ou contester, sans tout relire à froid.

**Statut des documents** : les 3 fichiers Markdown peuvent être **publiés en l'état** sur les pages publiques du site (`/legal/mentions`, `/legal/privacy`, `/legal/terms`). Si la revue ultérieure remet en cause des positions importantes, on republiera la version corrigée.

---

## Architecture technique rappelée (pour ancrer les décisions)

**Sont publiés on-chain (Base mainnet, permanents et publics) :**
- Adresses de portefeuille (artistes, collectionneurs, admins) — données pseudonymes au sens du RGPD (considérant 26)
- Hashes IPFS (CID) des métadonnées d'œuvres et d'avis — pointent vers du contenu en clair stocké hors chaîne
- Notes numériques des avis (entiers 0-5)
- Identifiants techniques : tokenId, editionId, taille édition, merkleRoot
- Booléens (artiste autorisé, édition désactivée), timestamps de bloc

**Ne sont PAS publiés on-chain :**
- Aucun nom, prénom, email, adresse postale, téléphone
- Aucun contenu en clair (titres, descriptions, images, biographies, textes d'avis) → IPFS uniquement via Pinata

---

## §1 — Corrections factuelles appliquées (faible enjeu)

| Document | Avant | Après | Justification |
|---|---|---|---|
| Mentions légales, identité éditeur | APE 62.01Z (Programmation) | APE **63.11Z** (Traitement de données, hébergement) | Code assigné par l'INPI à l'inscription |
| CGV Article 13 | « Médicys, médiateur dont l'Éditeur relève » | « L'Éditeur procède à son adhésion auprès de Médicys » | Adhésion non encore effective (cotisation ~120 €/an), évite l'affirmation fausse |
| CGV — URL canonique | `https://www.monaeditions.com` | `https://monaeditions.com` | Cohérence avec le canonical des meta HTML et les contrats blockchain |

**Pas de validation nécessaire** — fixes mécaniques.

---

## §2 — Décisions de fond (5 points sensibles)

Pour chaque point : extrait du texte tel qu'il est désormais publié + raisonnement + références mobilisées + niveau de risque résiduel.

### 2.1 — Rétractation et exécution immédiate (CGV Article 5)

**Décision prise :**
Réécrire l'article 5 pour rendre la case **obligatoire et distincte** des CGV (au lieu de « le cas échéant »). Texte de la case adopté :

> « J'accepte que l'exécution du service Atelier commence immédiatement et je renonce expressément à mon droit de rétractation pour la partie du service déjà exécutée. »

Le moment de l'acceptation est horodaté côté serveur et confirmé par email.

**Raisonnement :**
L'article L.221-28 §13° du Code de la consommation autorise le renoncement à la rétractation pour un service numérique uniquement si le consommateur consent **expressément** ET **reconnaît qu'il perd son droit**. Une case présentée « le cas échéant » risque d'être inopposable. La nouvelle formulation force le double consentement (CGV + renoncement explicite).

**Implication technique (côté code) :**
Je dois ajouter un **écran intermédiaire** dans le tunnel de souscription, AVANT la redirection Stripe, avec cette case obligatoire. Loggué en base avec timestamp. Le `consent_collection.terms_of_service: 'required'` de Stripe seul ne suffit pas — il valide l'acceptation des CGV mais pas le renoncement.

**Risque résiduel :** faible. La rédaction est conservative.

**Question pour Maître Untas :**
- [ ] La formulation de la case te paraît-elle suffisante ? Faut-il l'enrichir (« je reconnais que la prestation a commencé », mention explicite de la durée de rétractation, etc.) ?

---

### 2.2 — Résiliation par l'Éditeur (CGV Article 6.2)

**Décision prise :**
Refondre en deux catégories au lieu d'une liste fourre-tout :

- **(a) Avec préavis 30 jours + mise en demeure** : manquement substantiel, atteinte aux droits d'autres utilisateurs
- **(b) Effet immédiat sans préavis** : activités illégales manifestes (contrefaçon, blanchiment, terrorisme), fraude avérée, injonction d'autorité

Dans les deux cas, **droit d'observation de 7 jours** ouvert à l'Artiste.

J'ai **supprimé** la formule fourre-tout « tout comportement de nature à porter atteinte à la réputation ou à l'intégrité de la plateforme » qui était la plus exposée au reproche de clause abusive.

**Raisonnement :**
L'article L.212-1 du Code de la consommation interdit les clauses créant un déséquilibre significatif au détriment du consommateur. Une faculté de résiliation discrétionnaire et large est l'archétype de la clause abusive en B2C. La nouvelle rédaction :
- Restreint à des motifs **objectifs et énumérés**
- Introduit un **préavis** pour les cas non-graves
- Garantit le **principe du contradictoire** (droit d'observation)

**Risque résiduel :** faible. La liste reste suffisamment large pour mes cas opérationnels mais protège contre l'arbitraire.

**Question pour Maître Untas :**
- [ ] La distinction (a) / (b) te paraît-elle équilibrée ? Le préavis de 30 jours et le droit d'observation de 7 jours sont-ils des durées standard ou faut-il les ajuster ?

---

### 2.3 — Blockchain et droit à l'effacement (CGV Article 8) — **LE point central**

**Décisions prises :**

**§8.2** — La liste des données on-chain a été complétée pour inclure les **notes numériques des avis** (0-5) qui étaient oubliées dans la version précédente, et pour distinguer clairement « donnée nominative au sens strict » (aucune) vs « donnée pseudonyme » (adresses).

**§8.4** — Refondu pour :
1. Poser l'**information préalable** explicite avant souscription (article 13 RGPD)
2. Énumérer les **mesures alternatives compensatoires** (dépinnage IPFS, suppression off-chain, cessation d'affichage) — alignées sur la délibération CNIL 2018-352
3. Affirmer que ces mesures rendent les données on-chain restantes **non rattachables** par Mona Editions à une personne identifiée
4. Reconnaître que le caractère pseudonyme persiste sur la blockchain publique indépendamment de la volonté de l'Éditeur

**Raisonnement :**
La position de la CNIL sur la blockchain (délibération 2018-352, complétée par la note 2022) est claire :
- Le droit à l'effacement on-chain n'est pas techniquement applicable
- L'éditeur peut **compenser** par des mesures hors chaîne qui rendent les données restantes effectivement anonymes pour lui
- La condition est que l'utilisateur ait été **informé et consente** en connaissance de cause

J'ai choisi de :
1. **Citer explicitement** la délibération 2018-352 dans le texte (référence opposable)
2. **Lister les mesures compensatoires** de manière concrète et engageante
3. **Ne pas surpromettre** : je reconnais que le pseudonyme persiste sur la blockchain — c'est une honnêteté qui me protège

**Risque résiduel :** moyen. C'est le point le plus original juridiquement et celui qui pourrait faire l'objet d'une plainte CNIL si un artiste se sentait lésé. Mais ma rédaction est alignée sur la doctrine actuelle et je n'ai vu aucune décision plus récente qui remettrait en cause cette approche.

**Questions pour Maître Untas (les plus importantes) :**
- [ ] La référence à la délibération 2018-352 est-elle toujours la bonne, ou y a-t-il eu des décisions plus récentes (post-MICA, 2023-2025) à intégrer ?
- [ ] La formulation « rendent les données on-chain restantes non rattachables par Mona Editions à une personne physique identifiée » est-elle juridiquement défendable ?
- [ ] Faut-il ajouter une **case dédiée à cocher** au moment de la souscription artiste (« J'ai compris que mes données blockchain seront permanentes ») en plus du clic général d'acceptation des CGV ?

---

### 2.4 — Affichage post-résiliation (CGV Article 9.3)

**Décision prise :**
Distinguer ce qui est retiré et ce qui demeure :

- **Retiré sous 7 jours ouvrés** : profil public de l'artiste (page, bio, photos, logo, liens sociaux)
- **Maintenu au titre de l'intérêt légitime des Collectionneurs** : pages individuelles des œuvres déjà certifiées et réclamées, métadonnées on-chain et IPFS

J'invoque l'**article 6 §1 f) du RGPD** (intérêt légitime des tiers — les collectionneurs détenteurs).

**Raisonnement :**
Il y a une tension réelle : l'artiste résilie son abonnement et a le droit de voir sa visibilité cesser, mais des collectionneurs ont payé pour des œuvres avec son nom dessus. La solution standard en doctrine RGPD est de fonder le maintien sur l'intérêt légitime des tiers concernés, qui prime sur le droit à l'opposition de la personne dans ce cas spécifique.

**Risque résiduel :** faible si la dissymétrie est bien acceptée à la souscription (ce que dit le nouveau texte). Risque modéré si un artiste « cancel » conteste : il faudra défendre la balance des intérêts.

**Question pour Maître Untas :**
- [ ] Cette dissymétrie te paraît-elle solide juridiquement ? Faut-il fournir un mécanisme supplémentaire (ex. : possibilité pour l'artiste de remplacer son nom par un pseudonyme sur les pages d'œuvres post-résiliation, sans casser la chaîne de propriété) ?

---

### 2.5 — Plafond de responsabilité (CGV Article 10.2)

**Décision prise :**
Rédaction tripartite :

- **(a) Dommages directs** : plafond aux sommes versées sur les 12 derniers mois
- **(b) Dommages indirects** : exclus (pertes de profits, image, opportunités)
- **(c) Exceptions au plafond** : faute lourde, dol, manquement à une obligation essentielle, atteinte à l'intégrité physique, cas où la loi prohibe la limitation

Plus une section **(d) cas exclus** : force majeure, défaillance services tiers, perte de clés par l'utilisateur.

**Raisonnement :**
L'article R.212-1 du Code de la consommation interdit certaines limitations de responsabilité en B2C. La rédaction antérieure (plafond brut à 12 mois = 178,80 € sans exception) était dans la zone grise. La nouvelle :
- **Pose un plafond** (acceptable juridiquement avec exceptions)
- **Réserve explicitement** les cas où la loi prohibe la limitation (clause de sauvegarde)
- **Distingue** dommages directs / indirects (cohérent avec la jurisprudence)
- **Liste** les exceptions classiques (faute lourde, obligation essentielle)

**Risque résiduel :** faible. C'est la rédaction standard SaaS B2C française.

**Question pour Maître Untas :**
- [ ] La rédaction tripartite te paraît-elle équilibrée ? Le plafond 12 mois sur les dommages directs est-il acceptable, ou faut-il un montant plancher (ex. : 500 € minimum) pour ne pas tomber sous le seuil du dérisoire ?

---

## §3 — Décisions RGPD (Politique de confidentialité)

### 3.1 — Adresse de portefeuille du Collectionneur (§2.4)

**Décision prise :**
Reformulation pour reconnaître que l'adresse wallet **est** une donnée pseudonyme au sens du RGPD (et non « aucune donnée personnelle »), et préciser que les notes numériques d'avis sont également on-chain en clair.

**Raisonnement :**
L'affirmation antérieure « aucune donnée personnelle n'est collectée sur le collectionneur » était techniquement fausse (la CNIL a tranché : les adresses publiques de portefeuille sont des données pseudonymes au sens du considérant 26 du RGPD). Mieux vaut être précis et défendre une qualification correcte que d'être attaqué sur une affirmation maladroite.

**Question pour Maître Untas :**
- [ ] La nouvelle rédaction est-elle assez précise sans être anxiogène pour les collectionneurs ?

---

### 3.2 — Délai de réponse aux demandes d'exercice de droits (§6)

**Décision prise :**
« Une réponse vous sera apportée sous 30 jours maximum » → « Conformément à l'article 12 §3 du RGPD, une réponse vous sera apportée dans un délai d'**un mois** à compter de la réception de votre demande. Ce délai peut être prolongé de deux mois supplémentaires si la complexité ou le nombre de demandes le justifie ; vous en serez alors informé dans le délai initial d'un mois. »

**Raisonnement :**
Le RGPD impose 1 mois renouvelable à 3 mois. La formulation « 30 jours maximum » était techniquement plus restrictive que ce que la loi exige. Sans valeur ajoutée et risque de se retrouver hors délai sur un cas complexe. La nouvelle formulation est la rédaction RGPD-standard.

**Risque résiduel :** nul.

---

### 3.3 — Cookies et stockage local (§9)

**Décision prise :**
Reformulation pour :
1. Citer explicitement la délibération CNIL 2020-091 (cookies)
2. Détailler chaque cookie utilisé (Privy, WalletConnect, next-intl) et sa fonction
3. Mentionner les **relays WalletConnect** comme service tiers (transparence) tout en argumentant qu'ils restent dans le champ de l'exception « strictement nécessaire »
4. Citer l'**article 82 de la loi Informatique et Libertés** comme base de l'obligation d'information
5. Mentionner une **note discrète** lors de la première visite (à implémenter côté code)

**Raisonnement :**
La doctrine CNIL post-2020 exige une **information de l'utilisateur** même pour les cookies strictement nécessaires (pas de consentement, mais notification). La formulation antérieure « le consentement explicite n'est donc pas requis » occultait l'obligation d'info. La nouvelle est conforme et plus transparente.

**Implication technique (côté code) :**
Je dois ajouter un **bandeau discret** (pas une modal bloquante) lors de la première visite, accessible ensuite depuis le footer.

**Question pour Maître Untas :**
- [ ] Le bandeau discret est-il suffisant, ou faut-il une notification plus visible ? L'argumentation sur les relays WalletConnect comme « strictement nécessaires » te paraît-elle tenable ?

---

## §4 — Points où je n'ai pas modifié, mais qui méritent vérification

### 4.1 — Déclaration TRACFIN ?

**État actuel :** aucune mention dans les documents.
**Ma position par défaut :** non requise, car Mona Editions :
- N'achète, ne vend, n'est pas intermédiaire dans une transaction d'œuvre
- N'émet pas de cryptoactif au sens MICA (les ERC-1155 ne sont pas fongibles)

**Question pour Maître Untas :**
- [ ] Confirmer ma position. Si je me trompe, identifier les démarches.

### 4.2 — Mention « Entrepreneur Individuel »

**État actuel :** mention « Entrepreneur individuel — auto-entreprise en cours d'immatriculation » dans Mentions légales et Politique conf. Pas dans les CGV.

**Question pour Maître Untas :**
- [ ] Faut-il harmoniser : ajouter « Pierre Untas, EI » ou « Pierre Untas, entrepreneur individuel » systématiquement (CGV, factures, emails) ?

### 4.3 — Garantie de l'Artiste (CGV Article 9.2)

**État actuel :** garantie large et inchangée. *« L'Artiste garantit Mona Editions contre toute revendication d'un tiers en lien avec une œuvre certifiée. »*

**Question pour Maître Untas :**
- [ ] Faut-il limiter cette garantie aux droits que l'Artiste « connaissait ou aurait dû raisonnablement connaître » au moment de la certification ? Ou la garantie large est-elle préférable pour protéger Mona Editions ?

---

## §5 — Pile d'actions techniques à faire côté code (conséquences des choix)

Décisions juridiques qui impliquent du code à modifier :

1. **Tunnel de souscription Atelier** — Ajouter un écran intermédiaire AVANT la redirection Stripe avec la case obligatoire de renoncement à la rétractation (§2.1). Logguer le timestamp en base.
2. **Bandeau cookies** — Ajouter une note discrète première visite, accessible depuis le footer (§3.3).
3. **Stripe Checkout** — Réactiver `consent_collection.terms_of_service: 'required'` dans `app/api/subscription/checkout/route.ts` (la ligne commentée actuellement).
4. **Stripe Dashboard** — Renseigner les URLs CGV et Politique de confidentialité dans Settings → Public details → Terms of service URL + Privacy policy URL.
5. **Adhésion Médicys** — Souscrire (~120 € HT/an) sur medicys.fr, puis mettre à jour CGV Article 13 (passer de « procède à son adhésion » à coordonnées définitives).
6. **Profil artiste résilié** — Côté frontend, prévoir le retrait sous 7 jours du profil public lors d'une résiliation (§2.4). Maintenir les pages d'œuvres réclamées.

---

## §6 — Workflow de revue ultérieure

Quand Maître Untas aura le temps (dans la semaine ou plus tard) :

1. Elle ouvre ce journal (`00-brief-revue-juridique.md`).
2. Pour chaque section §2.1 à §2.5 et §3.1 à §3.3 : elle valide / rejette / propose une nuance via les checkboxes.
3. Elle me répond ses 4 questions ouvertes §4.1, §4.2, §4.3.
4. Je modifie les documents juridiques en fonction de ses retours.
5. Je republie les pages `/legal/*` mises à jour.

Si une de ses décisions implique un changement de comportement utilisateur substantiel (par exemple : ajouter la case dédiée pour la blockchain), j'en informe les utilisateurs déjà inscrits par email avec un préavis de 30 jours (conformément à l'article 11 des CGV).

---

## Annexe — Références juridiques mobilisées

### Blockchain et RGPD
- [Délibération CNIL n° 2018-352 du 24 septembre 2018](https://www.cnil.fr/fr/blockchain-et-rgpd-quelles-solutions-pour-un-usage-responsable-en-presence-de-donnees-personnelles)
- Note CNIL 2022 « Solutions pour un usage responsable de la blockchain »
- Considérant 26 du RGPD (données anonymes vs pseudonymes)
- Article 17 §3 RGPD (exceptions au droit à l'effacement)

### Droit de la consommation
- [Article L.221-25 Code de la consommation (modalités du renoncement à rétractation)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227230/)
- [Article L.221-28 §13° (exception pour services numériques)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045312631)
- [Article L.212-1 Code de la consommation (clauses abusives)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227167/)
- [Article R.212-1 (clauses abusives de plein droit)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032808997)
- Articles L.612-1 et suivants (médiation de la consommation)

### RGPD général
- [Article 12 §3 RGPD (délai de réponse)](https://gdpr-info.eu/art-12-gdpr/)
- [Article 13 RGPD (information préalable)](https://gdpr-info.eu/art-13-gdpr/)
- [Article 6 §1 f) RGPD (intérêt légitime)](https://gdpr-info.eu/art-6-gdpr/)
- [Article 30 RGPD (registre des traitements)](https://gdpr-info.eu/art-30-gdpr/)
- [Délibération CNIL 2020-091 (cookies)](https://www.cnil.fr/fr/sites/default/files/atoms/files/recommandation-cookies-et-autres-traceurs.pdf)

### Droit français spécifique
- Article 82 Loi 78-17 (Informatique et Libertés — cookies)
- Code de commerce L.123-22 (conservation comptable 10 ans)
- [Loi 2022-172 (statut entrepreneur individuel)](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045167459)
- Articles 1170, 1231-3 Code civil (limitations contractuelles de responsabilité)

---

*Date du journal : 20 juin 2026. Si une décision est ultérieurement modifiée par Maître Untas, mettre à jour cette section avec la date et la nature du changement.*
