# Système d'abonnement artiste (Stripe + Postgres)

Cette note documente l'architecture du système de quotas et d'abonnement payant introduit pour permettre la monétisation de Mona Editions sans nouvelle version des smart contracts. La logique est entièrement off-chain : Stripe pour le paiement, Vercel Postgres pour l'état, vérification côté API avant chaque création d'édition.

## Modèle métier

Deux paliers :

| Palier | Prix | Quota |
|--------|------|-------|
| **Découverte** (free) | 0 € | 5 éditions à vie (lifetime, non renouvelable automatiquement) |
| **Atelier** | 14,90 €/mois | 50 éditions par fenêtre glissante de 30 jours |

Règles fines :

- Une « édition » = une œuvre certifiée (un appel à `createArtworkEdition`), peu importe le nombre de certificats à l'intérieur. Une édition de 1 et une édition de 100 comptent chacune pour 1.
- **Free → Atelier** : la souscription débloque le quota Atelier. Le quota Free déjà consommé n'est pas restitué (il reste à 5/5 utilisés, c'est juste qu'il devient sans effet tant que l'Atelier est actif).
- **Atelier → annulation** : l'artiste conserve l'accès Atelier jusqu'à la fin de la période payée, puis bascule en Free. S'il avait déjà épuisé ses 5 Free avant l'abonnement, il se retrouve à 0 quota.
- **Renouvellement libre** : un artiste peut, à tout moment, payer un nouveau cycle pour réinitialiser sa fenêtre de 30 jours à zéro. Utile quand il épuise ses 50 avant les 30 jours. Le nouveau cycle remplace l'ancien, l'auto-renouvellement Stripe est repositionné en conséquence.
- **Dépassement Atelier sans renouveler** : bloqué jusqu'à ce que des éditions sortent de la fenêtre glissante (les plus anciennes vieillissent au-delà de 30 jours).

Devise : **EUR uniquement**.

## Stack

| Brique | Choix |
|--------|-------|
| Paiement | Stripe Subscriptions + Customer Portal |
| Webhooks | Routes Next.js API dans `app/api/subscription/` |
| Base de données | Vercel Postgres |
| Driver | `@vercel/postgres` (ESM, top-level await compatible Next.js) |
| Gating | Hook React `useSubscription` + composant `SubscriptionGate` |

## Schéma de données

Deux tables :

### `artist_subscriptions`

Une ligne par wallet artiste. Crée à la première interaction (création de profil ou de la première édition).

| Colonne | Type | Rôle |
|---------|------|------|
| `wallet_address` | `varchar(42)` PRIMARY KEY | adresse 0x du wallet artiste (lowercase, indexé) |
| `email` | `varchar(255)` | email Privy au moment de la création, pour relances |
| `stripe_customer_id` | `varchar(255)` | `cus_…` Stripe, créé à la première session Checkout |
| `stripe_subscription_id` | `varchar(255)` | `sub_…`, présent quand l'artiste est en Atelier actif |
| `plan` | `varchar(20)` | `'free'` ou `'atelier'` |
| `status` | `varchar(20)` | `'active'`, `'canceled'`, `'past_due'`, `'incomplete'`, `'none'` |
| `current_period_start` | `timestamp` | Début de la période Atelier en cours (depuis Stripe, ou date de renouvellement manuel) |
| `current_period_end` | `timestamp` | Fin de la période Atelier en cours |
| `cancel_at_period_end` | `boolean` | true si l'utilisateur a annulé mais bénéficie encore de la période |
| `free_quota_used` | `int` | Compteur lifetime du palier Free, max 5 |
| `created_at` | `timestamp` | Date de création de la ligne |
| `updated_at` | `timestamp` | Date de dernière modification |

### `edition_events`

Une ligne par création d'édition réussie. Permet le calcul de la fenêtre glissante de 30 jours pour Atelier.

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | `serial` PRIMARY KEY | identifiant interne |
| `wallet_address` | `varchar(42)` | artiste créateur (indexé) |
| `edition_id` | `int` | l'editionId on-chain retourné par le contrat |
| `created_at` | `timestamp` DEFAULT NOW() | timestamp de l'enregistrement (indexé) |

Un index composé `(wallet_address, created_at DESC)` accélère le comptage des 30 derniers jours.

## Flux de bout en bout

### A) Premier accès artiste (jamais inscrit)

1. Artiste arrive sur `/artist` après connexion Privy
2. Frontend appelle `GET /api/subscription/status?wallet=0x…`
3. L'API n'a pas de ligne pour ce wallet → en crée une avec `plan='free'`, `status='none'`, `free_quota_used=0`
4. Retourne `{ plan: 'free', remainingQuota: 5, ... }`
5. Frontend affiche normalement les pages artiste

### B) Création d'édition

1. Artiste arrive sur `/artist/editions/create`
2. Hook `useSubscription` appelle `GET /api/subscription/status` → récupère `remainingQuota`
3. Si `remainingQuota > 0` → formulaire normal
4. Si `remainingQuota === 0` → composant `SubscriptionGate` qui propose Atelier (avec un CTA vers Stripe Checkout)
5. Quand l'artiste soumet le formulaire, le flux IPFS + transaction blockchain se déroule normalement
6. **Après confirmation on-chain**, le frontend appelle `POST /api/editions/increment` avec `wallet` + `editionId` + `txHash` pour incrémenter le compteur correspondant

### C) Souscription Atelier

1. Artiste clique « Passer à l'Atelier » → frontend appelle `POST /api/subscription/checkout` avec `wallet`
2. L'API crée un `Stripe.checkout.Session` en mode `subscription`, avec le `STRIPE_PRICE_ID` Atelier, et retourne `{ url }`
3. Frontend redirige le navigateur vers cette URL Stripe
4. Artiste paie via la page Stripe Checkout (CB, Apple Pay, etc.)
5. Stripe redirige sur `/artist/subscription?success=true`
6. **En parallèle**, Stripe envoie un webhook `checkout.session.completed` puis `customer.subscription.created` → notre route webhook met à jour la DB : `plan='atelier'`, `status='active'`, `current_period_start/end`, `stripe_subscription_id`
7. Quand l'artiste revient sur le site, son `useSubscription` détecte le passage en `atelier`

### D) Annulation

1. Artiste va sur `/artist/subscription` → clique « Gérer mon abonnement »
2. `POST /api/subscription/portal` génère un lien Stripe Customer Portal, frontend redirige
3. Sur le portail Stripe, l'artiste annule
4. Stripe envoie un webhook `customer.subscription.updated` avec `cancel_at_period_end=true`
5. La route webhook met à jour la DB : `cancel_at_period_end=true`, mais on garde `plan='atelier'` et `status='active'` jusqu'à la fin de la période
6. Quand la période expire, Stripe envoie `customer.subscription.deleted` → la route webhook bascule `plan='free'`, `status='canceled'`, vide `current_period_*`

### E) Renouvellement libre (épuisement avant 30 jours)

1. Artiste a utilisé 50 éditions en 18 jours → `SubscriptionGate` s'affiche
2. L'artiste clique « Renouveler maintenant » → `POST /api/subscription/renew`
3. L'API crée une nouvelle session Checkout *en remplacement* de la subscription actuelle :
   - Annule la subscription Stripe actuelle (immédiat, sans pro-rata)
   - Crée une nouvelle subscription avec un nouveau cycle de 30 jours qui démarre maintenant
4. Une fois payée, le webhook met à jour `current_period_start` à la date du nouveau paiement
5. Comme la fenêtre glissante est basée sur `created_at >= current_period_start`, le compteur effectif repart à 0/50

Détail technique : on aurait pu garder une seule subscription Stripe et juste ajouter une charge ad hoc, mais l'approche « cancel + new » est plus claire pour les artistes (une seule subscription active à la fois) et plus simple à maintenir.

## Calcul du quota côté API

```typescript
function computeRemainingQuota(sub: ArtistSubscription, periodCount: number): number {
    if (sub.plan === 'atelier' && sub.status === 'active') {
        return Math.max(0, 50 - periodCount);
    }
    if (sub.plan === 'free' || (sub.plan === 'atelier' && sub.status !== 'active')) {
        return Math.max(0, 5 - sub.free_quota_used);
    }
    return 0;
}
```

Où `periodCount` est le résultat de :

```sql
SELECT COUNT(*) FROM edition_events
WHERE wallet_address = $1
  AND created_at >= $2;
```

Avec `$2 = sub.current_period_start` pour Atelier, ou la date d'inscription pour Free (en pratique, comme Free utilise `free_quota_used` à la place, ce calcul ne sert qu'à Atelier).

## Sécurité

- **Validation du wallet côté API** : chaque endpoint qui modifie la DB exige une signature Privy ou une vérification d'identité côté serveur, pas juste un wallet passé en query string. Sans cela, n'importe qui pourrait incrémenter le compteur d'un autre artiste depuis l'extérieur.
- **Webhook Stripe** : vérification de signature avec `STRIPE_WEBHOOK_SECRET` obligatoire, sinon un attaquant pourrait faire passer des paiements fictifs.
- **Idempotence des webhooks** : Stripe peut renvoyer un webhook plusieurs fois. La logique de webhook doit être idempotente (utiliser l'`event.id` pour skip si déjà traité, ou faire des updates absolus type `UPDATE ... SET status = $1` plutôt qu'incréments).
- **Race condition au moment de la création** : si un artiste a 1 quota restant et envoie 2 requêtes simultanées, le frontend autoriserait les deux. Solution : `POST /api/editions/increment` doit vérifier *à nouveau* le quota côté API et refuser si dépassé (avec une transaction Postgres). La transaction blockchain restera valide on-chain, juste que le compteur off-chain ne dépassera pas la limite — soft cap.
- **Limite douce** : un artiste techniquement compétent peut appeler `createArtworkEdition` directement via Etherscan en bypassant notre frontend. Acceptable au stade actuel. À durcir en v3 avec quotas on-chain si nécessaire.

## Variables d'environnement requises

```
# Stripe
STRIPE_SECRET_KEY=sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
NEXT_PUBLIC_STRIPE_PRICE_ID=price_…

# Postgres (auto-injectées par Vercel Storage)
POSTGRES_URL=…
POSTGRES_PRISMA_URL=…
POSTGRES_URL_NON_POOLING=…
POSTGRES_USER=…
POSTGRES_HOST=…
POSTGRES_PASSWORD=…
POSTGRES_DATABASE=…

# URL publique pour les redirections Stripe
NEXT_PUBLIC_APP_URL=https://www.monaeditions.com
```

## Routes API

| Méthode | Route | Auth | Rôle |
|---------|-------|------|------|
| GET  | `/api/subscription/status` | Privy session | Retourne plan, status, quota restant pour le wallet appelant |
| POST | `/api/subscription/checkout` | Privy session | Crée une session Stripe Checkout pour l'Atelier |
| POST | `/api/subscription/portal` | Privy session | Génère un lien Customer Portal |
| POST | `/api/subscription/renew` | Privy session | Annule la subscription actuelle et redirige vers une nouvelle Checkout |
| POST | `/api/subscription/webhook` | Stripe signature | Met à jour la DB depuis les événements Stripe |
| POST | `/api/editions/increment` | Privy session | Enregistre la création réussie d'une édition |

## Effort estimé

| Étape | Effort |
|-------|--------|
| Migration SQL + helper DB | 0,5 jour |
| 6 routes API | 2 jours |
| Hook React + paywall + page subscription | 1,5 jour |
| Intégration sur les pages artistes existantes | 0,5 jour |
| Tests (Stripe test mode, simulation webhook) | 1 jour |
| Polish, edge cases, copy | 0,5 jour |
| **Total** | **5-6 jours** |

## Limites connues, à traiter plus tard

- Pas de période d'essai. Au démarrage, Free → Atelier est une transition payante directe. Possible évolution : 7 jours gratuits sur Atelier.
- Pas de remise annuelle. Tous les paiements sont mensuels. Évolution possible : prix annuel à 149 € (12 → 10 mois équivalents).
- Pas de facturation HT/TTC explicite. À mettre en place quand l'artiste sera assujetti à TVA (au-delà du seuil de franchise).
- Pas de gestion automatique des reçus / factures aux artistes (Stripe le fait mais on ne les redirige pas vers leur reçu depuis le frontend).
- Pas de hard cap on-chain : un artiste techniquement avancé peut bypasser. À durcir en v3 si nécessaire.

## Migration des artistes existants

Au déploiement de cette feature, tous les artistes déjà autorisés (Ursula, Mona, etc.) doivent être basculés en palier **Free** avec `free_quota_used = 0` (même s'ils ont déjà créé des éditions avant). Cela leur laisse 5 éditions de grâce après le déploiement avant de devoir s'abonner. Communication par mail recommandée pour expliquer la transition.

Si tu veux récompenser tes premiers pilotes (Ursula, Mona, Michel…) avec une période gratuite indéfinie, tu peux les marquer en `plan='atelier'`, `status='active'` manuellement en DB et leur permettre 50 éditions / 30 jours sans payer. C'est une opération SQL ponctuelle.
