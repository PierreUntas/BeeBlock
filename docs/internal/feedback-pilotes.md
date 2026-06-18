# Suivi feedback — Artistes pilotes

> Document interne. À mettre à jour au fil des retours des 3 artistes pilotes : **Ursula**, **Mona**, **Michel**. Sert à prioriser les correctifs avant l'ouverture publique.

## Comment utiliser ce document

Chaque fois qu'un pilote rapporte quelque chose (par téléphone, email, en face à face, screenshot), tu ouvres ce fichier et tu rajoutes une entrée dans la section appropriée. Format léger pour rester rapide, mais structuré pour pouvoir trier.

**Trois sections** :

- **Bugs** : ce qui ne marche pas comme prévu
- **UX / friction** : ce qui marche mais qui n'est pas évident, ce qui frustre
- **Demandes / idées** : ce qu'ils aimeraient avoir, suggestions

**Trois priorités** :

- `P0` — bloquant, à corriger avant tout autre travail
- `P1` — important, à fixer cette semaine
- `P2` — nice-to-have, à reporter

**Trois statuts** :

- `🔴 Ouvert`
- `🟡 En cours`
- `🟢 Résolu`

---

## Bugs

| Date | Pilote | Description | Repro | Priorité | Statut | Notes |
|------|--------|-------------|-------|----------|--------|-------|
| _exemple_ | Ursula | « Quand je clique sur Certifier, rien ne se passe sur Safari iPhone » | iOS 18 + Safari + connexion 4G | P0 | 🔴 | À tester localement |
|  |  |  |  |  |  |  |

## UX / friction

| Date | Pilote | Observation | Idée de fix | Priorité | Statut |
|------|--------|-------------|-------------|----------|--------|
| _exemple_ | Mona | « Je n'ai pas compris à quoi sert le QR code de mon profil » | Ajouter une tooltip ou réécrire le libellé | P1 | 🔴 |
|  |  |  |  |  |  |

## Demandes / idées

| Date | Pilote | Demande | Faisabilité | Priorité | Statut |
|------|--------|---------|-------------|----------|--------|
| _exemple_ | Michel | « Possibilité d'ajouter un PDF de COA en plus des photos » | Moyenne (storage IPFS + UI) | P2 | 🔴 |
|  |  |  |  |  |  |

---

## Questions ouvertes à poser proactivement aux 3 pilotes

À chaque rendez-vous ou point d'étape, cocher au fur et à mesure.

### Ursula
- [ ] L'inscription Privy (email + code 6 chiffres) s'est-elle passée sans accroc ?
- [ ] As-tu compris le rôle du quota Découverte 5/5 ?
- [ ] Le rendu de tes images sur la galerie te plaît-il ? (résolution, recadrage, ordre)
- [ ] Le QR code de ton profil t'a-t-il servi ? Si oui, dans quel contexte ?
- [ ] Le téléchargement Excel des clés secrètes t'a-t-il semblé clair ?

### Mona
- [ ] L'aspect « certificat blockchain » t'a-t-il intriguée ou rebutée ? Pourquoi ?
- [ ] Aurais-tu envie d'inviter d'autres artistes ? Si oui, quel serait ton pitch en 1 phrase ?
- [ ] Le tarif Atelier 14,90 €/mois te semblait-il juste, cher, ou trop bon marché ?
- [ ] As-tu rencontré une œuvre que tu n'aurais PAS voulu certifier ? Pourquoi ?

### Michel
- [ ] Aurais-tu confiance pour rediriger un collectionneur étranger vers Mona Editions ?
- [ ] La langue (français uniquement pour l'instant) te limite-t-elle ?
- [ ] As-tu déjà reçu une question d'un de tes collectionneurs sur la certification ?

---

## Décisions prises suite aux feedbacks

Garder une trace des arbitrages, pour expliquer plus tard pourquoi telle ou telle feature a été (ou n'a pas été) ajoutée.

| Date | Décision | Sources (qui a déclenché) | Raison |
|------|----------|----------------------------|--------|
| _exemple_ | Garder la limite 5 œuvres en Découverte (vs 10 demandée par Mona) | Mona | Plus large = moins d'incitation à passer en Atelier |
|  |  |  |  |

---

## Pour aller plus loin (quand les pilotes seront actifs)

Ces idées dépendent du volume de feedback réel et de tes priorités du moment :

- **Sondage NPS** envoyé après 1 mois d'usage : « Recommanderiez-vous Mona Editions à un autre artiste ? (0-10) »
- **Mini-entretien filmé** (30 min) avec chacun à la fin du mois 1 : où ils ouvrent l'app, ce qu'ils tentent en premier, ce qui les fait hésiter
- **Public dashboard d'usage** (en mode test) : nombre d'œuvres certifiées par jour, taux de claim collectionneur, etc.
