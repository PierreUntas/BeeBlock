# Documentation Mona Editions

Cette documentation est répartie en deux espaces :

- **`technique/`** — pour les développeurs, intégrateurs et personnes qui veulent comprendre comment la plateforme est construite.
- **`commercial/`** — pour les artistes, galeries, collectionneurs, partenaires et la presse.

---

## Documentation technique

| Fichier | Sujet |
|---------|-------|
| [01-architecture.md](technique/01-architecture.md) | Vue d'ensemble : choix d'architecture, schéma système, dépendances, adresses déployées |
| [02-smart-contracts.md](technique/02-smart-contracts.md) | Détail des contrats `ArtworkRegistry` et `ArtworkTokenization` : rôles, fonctions, événements, erreurs, modèle d'autorisation, procédure de remédiation |
| [03-frontend.md](technique/03-frontend.md) | Architecture Next.js : routes, auth Privy, intégration Wagmi, IPFS, wizard de création d'édition, design system |
| [04-flux-certification.md](technique/04-flux-certification.md) | Cycle de vie complet : onboarding artiste, création d'édition, distribution physique, claim collectionneur, remédiation |
| [05-deploiement.md](technique/05-deploiement.md) | Procédure de déploiement Hardhat Ignition, vérification Basescan, build Vercel, gas sponsoring, modèle de sécurité, monitoring |
| [06-evolution-v2.md](technique/06-evolution-v2.md) | Note de scope minimaliste pour la v2 des contrats : invariant métadonnée basé sur la possession + émission de l'événement URI standard ERC-1155 |

---

## Documentation commerciale

| Fichier | Sujet |
|---------|-------|
| [01-pitch.md](commercial/01-pitch.md) | Pitch général : problème, solution, marché, différenciation |
| [02-plaquette-artistes.md](commercial/02-plaquette-artistes.md) | Présentation destinée aux artistes : bénéfices, parcours, FAQ |
| [03-plaquette-collectionneurs.md](commercial/03-plaquette-collectionneurs.md) | Présentation destinée aux collectionneurs : ce qu'est un certificat, comment le réclamer, FAQ |
| [04-faq-grand-public.md](commercial/04-faq-grand-public.md) | FAQ générale (projet, technologie, usage, sécurité, modèle économique) |
| [05-cas-usage.md](commercial/05-cas-usage.md) | Cinq scénarios concrets : artiste indépendant, galerie, revente long terme, école d'art, catalogue raisonné |
| [06-email-onboarding-artiste-fr.md](commercial/06-email-onboarding-artiste-fr.md) | Template de mail de premier contact à un·e artiste (français), validé et prêt à adapter |
| [07-email-onboarding-artiste-de.md](commercial/07-email-onboarding-artiste-de.md) | Template de mail de premier contact à un·e artiste (allemand), traduction du précédent |

---

## Lectures recommandées par profil

**Développeur qui rejoint le projet :**
`01-architecture.md` → `02-smart-contracts.md` → `03-frontend.md` → `04-flux-certification.md` → `05-deploiement.md`

**Artiste qui découvre la plateforme :**
`02-plaquette-artistes.md` → `04-faq-grand-public.md`

**Collectionneur qui vient de scanner un QR code :**
`03-plaquette-collectionneurs.md`

**Investisseur ou partenaire qui veut une vue d'ensemble :**
`01-pitch.md` → `05-cas-usage.md` → `01-architecture.md`

**Journaliste ou personne préparant un article :**
`01-pitch.md` → `04-faq-grand-public.md` → `05-cas-usage.md`
