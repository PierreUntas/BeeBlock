# Brief de revue juridique — Mona Editions

**Pour :** Maître Untas
**Préparé par :** Pierre, le 20 juin 2026
**Documents à relire :**
- [01-mentions-legales.md](./01-mentions-legales.md)
- [02-politique-confidentialite.md](./02-politique-confidentialite.md)
- [03-conditions-generales-abonnement.md](./03-conditions-generales-abonnement.md)

**Contexte rapide.** Mona Editions est une plateforme web sur laquelle des artistes peuvent enregistrer leurs œuvres et émettre un certificat numérique (jeton ERC-1155 sur la blockchain Base). Les collectionneurs réclament ces certificats via un QR code. Il y a un abonnement Atelier à 14,90 €/mois (Stripe), et un palier gratuit limité à 5 œuvres à vie. Statut éditeur : auto-entreprise en cours d'immatriculation (Pierre Untas). Cible B2C grand public côté artistes, B2C côté collectionneurs.

---

## A. Erreurs factuelles à corriger AVANT la revue

Ces points ne nécessitent pas ton expertise — je les rectifie cette semaine. Je les liste pour transparence et pour que tu ne perdes pas de temps à les remettre en cause.

1. **Code APE.** Les documents indiquent **62.01Z (Programmation informatique)**. À mon inscription INPI hier, l'arborescence m'a fait sélectionner **63.11Z (Traitement de données, hébergement et activités connexes)** car « Services d'information » → « 62.01 Programmation » n'était pas proposé à cet endroit. À harmoniser dans les 3 documents dès réception du code définitif INSEE.

2. **Médicys (médiateur de consommation).** L'article 13 des CGA présente Médicys comme « le médiateur de la consommation dont l'Éditeur relève ». **Je n'ai pas encore adhéré** (cotisation ~120 € HT/an). Il faut soit reformuler en « l'Éditeur procède actuellement à son adhésion auprès de Médicys », soit publier après adhésion effective. Légalement, l'obligation d'avoir un médiateur opérationnel est immédiate dès activité B2C.

3. **URL du site.** Le code utilise `https://monaeditions.com` (sans www) comme URL canonique, mais les CGA mentionnent `https://www.monaeditions.com` (avec www). Harmoniser sur la version sans www, qui est celle déclarée dans les meta tags HTML et utilisée pour les certificats blockchain.

---

## B. Points sensibles à examiner en priorité (risque juridique)

### B1. Article 8 CGA — Irrévocabilité blockchain et droit à l'effacement RGPD
*Document : [CGA](./03-conditions-generales-abonnement.md), Article 8*

C'est le sujet le plus structurant du dossier. La rédaction s'appuie sur la **délibération CNIL n°2018-352 du 24 septembre 2018** pour justifier une limitation au droit à l'effacement (art. 17 RGPD) sur les données on-chain (adresses de portefeuille, hash IPFS) et IPFS (métadonnées et images).

**Points à valider :**
- La délibération 2018-352 est-elle toujours la référence pertinente, ou y a-t-il eu des décisions plus récentes de la CNIL ou du Conseil d'État (notamment 2023-2025) qui affineraient la position ?
- La distinction « données en clair stockées hors blockchain (effaçables) » vs « hash et adresses sur blockchain (non effaçables) » est-elle juridiquement bien posée ? Notre architecture ne publie jamais d'identifiant direct on-chain — uniquement le hash IPFS — ce qui devrait satisfaire le principe de minimisation.
- La rédaction de l'article 8.4 « impossibilité technique d'effacement » est-elle suffisamment précise pour résister à une plainte CNIL, ou faut-il ajouter la mention explicite que l'utilisateur **consent en connaissance de cause** à cette limitation avant souscription ?
- Côté IPFS, on s'engage à « dépinner » sur demande mais on prévient qu'on ne peut pas garantir la purge si d'autres nœuds ont répliqué. Est-ce une formulation acceptable ?

### B2. Article 5 CGA — Rétractation et renoncement
*Document : [CGA](./03-conditions-generales-abonnement.md), Article 5*

La rédaction prévoit que l'Artiste consommateur renonce à son droit de rétractation s'il coche « j'accepte de commencer immédiatement le service » **OU** s'il certifie une première œuvre avant la fin des 14 jours.

**Points à valider :**
- La formule « le cas échéant » concernant la case à cocher m'inquiète. D'après ma compréhension de l'art. L.221-25 du Code de la consommation, le **renoncement exprès** par case dédiée est obligatoire. Si je l'omets parfois, le renoncement est-il opposable ?
- Le fait que la certification d'une œuvre vaille demande d'exécution immédiate (interprétation par comportement) est-il valable, ou faut-il que la case soit cochée **avant** toute action ?
- Aujourd'hui, le tunnel Stripe Checkout n'affiche pas de case dédiée (cf. note du dossier interne). On a une option `consent_collection.terms_of_service` que je peux activer côté Stripe, mais elle pointe juste vers les CGA — elle ne dit pas « j'accepte l'exécution immédiate ». Faut-il un écran intermédiaire dédié dans notre interface pour recueillir ce consentement explicite ?

### B3. Article 6.2 CGA — Résiliation par l'Éditeur
*Document : [CGA](./03-conditions-generales-abonnement.md), Article 6.2*

La liste des motifs inclut « tout comportement de nature à porter atteinte à la réputation ou à l'intégrité de la plateforme ou de ses utilisateurs ».

**Question :** ce motif générique présente-t-il un risque de qualification en **clause abusive** au sens de l'article L.212-1 du Code de la consommation (déséquilibre significatif au détriment du consommateur) ? Faut-il restreindre à une liste exhaustive ou ajouter une condition de proportionnalité / contradictoire ?

### B4. Article 9.3 CGA — Cessation d'autorisation après résiliation
*Document : [CGA](./03-conditions-generales-abonnement.md), Article 9.3*

L'article dit que l'autorisation d'affichage **cesse à la résiliation de l'abonnement**, MAIS l'article 8 dit que les certificats sur blockchain sont **permanents**.

**Tension à résoudre :** si un artiste résilie, doit-on supprimer sa page publique `/explore/artist/[adresse]` ? Si oui, comment justifier qu'on continue d'afficher les certificats émis (qui contiennent son nom dans les métadonnées IPFS) au profit des collectionneurs ayant payé pour leur œuvre ? Il faut probablement préciser que :
- Le profil artiste est retiré
- Les œuvres déjà émises restent visibles (intérêt légitime des collectionneurs détenteurs)
- L'artiste accepte cette dissymétrie au moment de l'inscription

Ta vision sur la formulation appropriée ?

### B5. Article 10.2 CGA — Plafond de responsabilité
*Document : [CGA](./03-conditions-generales-abonnement.md), Article 10.2*

Plafond fixé à **12 mois d'abonnement** (= 178,80 € au prix actuel).

**Question :** acceptable en B2C, ou risque de clause abusive (le préjudice potentiel pour un artiste qui aurait certifié de fausses informations on-chain est manifestement supérieur) ? Faut-il distinguer les cas — par exemple, plafond classique pour les manquements légers, exclusion pour fraude/faute lourde de notre part ?

---

## C. Conformité RGPD — points à valider

### C1. Politique de confidentialité, paragraphe 2.4 — Collectionneur
*Document : [Confidentialité](./02-politique-confidentialite.md), §2.4*

Affirmation : « Aucune donnée personnelle n'est collectée par Mona Editions sur le collectionneur. » Or l'adresse blockchain du collectionneur **est** publiée on-chain, et **est** une donnée pseudonyme au sens du RGPD (CNIL le confirme dans sa délibération 2018-352).

Faut-il :
- Reformuler : « Mona Editions ne collecte aucune donnée nominative auprès du collectionneur. L'adresse de portefeuille (donnée pseudonyme) est publiée sur la blockchain Base, conformément au paragraphe 8 ci-après » ?
- Ou la rédaction actuelle suffit-elle ?

### C2. Politique de confidentialité, paragraphe 9 — Cookies sans consentement
*Document : [Confidentialité](./02-politique-confidentialite.md), §9*

J'invoque l'exception « cookies strictement nécessaires » de la recommandation CNIL pour ne pas demander de consentement explicite. Les cookies utilisés sont :
- Session Privy (authentification)
- WalletConnect (connexion portefeuille externe)
- Préférences (langue)

**Question :** WalletConnect ouvre des connexions vers des serveurs tiers (relays) pour la communication portefeuille. Cette communication est-elle bien couverte par l'exception « strictement nécessaire » au service demandé, ou pourrait-on argumenter qu'il s'agit d'un service tiers nécessitant consentement ?

### C3. Mentions légales — Cookies « implicite »
*Document : [Mentions légales](./01-mentions-legales.md), section « Cookies »*

La phrase « L'utilisation de ces cookies est implicite à la consultation du site » est-elle juridiquement valide ? La CNIL préconise au minimum une **information explicite** (bandeau ou note) même pour les cookies sans consentement requis.

### C4. Politique de confidentialité, paragraphe 6 — Délai de réponse
*Document : [Confidentialité](./02-politique-confidentialite.md), §6*

Annonce « réponse sous 30 jours ». Le RGPD prévoit en réalité **1 mois renouvelable jusqu'à 3 mois** pour les demandes complexes. Faut-il être plus précis pour ne pas se retrouver en défaut sur un cas compliqué ?

---

## D. Points secondaires (bon réflexe, pas bloquant)

1. **Sous-traitants (politique confidentialité §4)** : tous américains sauf Neon (Allemagne). DPF + clauses contractuelles types mentionnés. À vérifier que j'ai bien signé les DPA Stripe / Privy / Vercel / Pinata / Resend. Y a-t-il une obligation de **registre des sous-traitants** que je dois tenir formellement à côté ?

2. **Durée de conservation des données comptables** (§5) : 10 ans annoncés. C'est l'obligation Code de commerce. Toujours d'actualité en 2026 ?

3. **Garantie de l'Artiste sur les droits (CGA art. 9.2)** : l'Artiste garantit Mona Editions contre toute revendication tiers. C'est large. Est-ce que ça tient devant les yeux d'un juge si un Artiste de bonne foi a certifié une œuvre dont il ignorait qu'elle contenait un emprunt non autorisé ?

4. **Inscription RCS / mention « Entrepreneur Individuel »** : depuis la réforme du statut d'entrepreneur individuel (loi 2022), la mention « EI » ou « entrepreneur individuel » doit-elle apparaître à côté de mon nom dans les mentions légales et factures ?

---

## E. Ton point central, à valider en deux mots

> **La rédaction de l'article 8 des CGA (irrévocabilité blockchain + limitation du droit à l'effacement) suffit-elle à protéger Mona Editions face à une plainte CNIL d'un artiste ou d'un collectionneur, étant entendu que :**
> - aucune donnée nominative en clair n'est jamais publiée on-chain,
> - seuls les hashes IPFS et les adresses de portefeuille (pseudonymes) sont sur la blockchain,
> - l'utilisateur est informé avant souscription,
> - on s'engage à dépinner IPFS et à anonymiser les bases off-chain à la demande ?

Si oui : feu vert pour publier (sous réserve des corrections factuelles et tes annotations sur les articles B2-B5). Si non : qu'est-ce qu'il faut changer en priorité ?

Merci ❤️

— Pierre
