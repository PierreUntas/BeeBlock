# TODO — Mise en Live de Mona Editions

> Document interne. Tout ce qu'il reste à faire **côté Pierre, en dehors du code**, pour passer Mona Editions du mode Test au mode Live et accueillir des artistes payants. Le code est prêt — il ne reste que de l'administratif et de la configuration externe.

## Légende

- 🟢 Quick win (15 min ou moins)
- 🟡 Demande un peu de coordination ou attente extérieure
- 🔴 Bloque la mise en Live

---

## Phase 1 — Pré-requis juridiques (cette semaine)

### Validation des CGV par ta femme (avocate) 🟡 🔴

À lui faire relire avec attention sur **5 points** où une jurisprudence ou un point pratique pourrait nuancer ma rédaction :

- [ ] **Article 5** des CGA — Renonciation au droit de rétractation : formalisme attendu pour que la renonciation soit opposable (art. L.221-25 Code conso)
- [ ] **Article 6.1** des CGA — Pas de remboursement à la résiliation en cours de période : vérifier le caractère non abusif au sens du Code conso
- [ ] **Article 8.4** des CGA — Limitation du droit à l'effacement par impossibilité technique : vérifier la rédaction au regard de la jurisprudence post-2018
- [ ] **Article 9.3** des CGA — « Autorisation technique d'affichage » non requalifiable en licence d'exploitation
- [ ] **Article 3.2 + 4.2** des CGA — Renouvellement anticipé volontaire : vérifier la directive Omnibus 2019/2161 sur l'info précontractuelle

**Fichiers à lui transmettre** :
- `docs/legal/01-mentions-legales.md`
- `docs/legal/02-politique-confidentialite.md`
- `docs/legal/03-conditions-generales-abonnement.md`

Une fois ses corrections intégrées, **resynchroniser** dans `frontend/content/legal/` (commande : `cp docs/legal/01-*.md frontend/content/legal/mentions.md` etc.) puis push.

### Déclaration auto-entreprise 🟡 🔴

- [ ] Aller sur **autoentrepreneur.urssaf.fr**
- [ ] Activité principale : « Programmation informatique »
- [ ] Code APE 62.01Z (sera ajusté par l'INSEE)
- [ ] Régime fiscal : franchise en base de TVA
- [ ] Adresse : 88 rue Lagrange, 33000 Bordeaux
- [ ] Recevoir le SIRET sous **7 jours**
- [ ] Mettre à jour dans `docs/legal/01-mentions-legales.md` (chercher « SIRET à venir » → remplacer)
- [ ] Resynchroniser `frontend/content/legal/mentions.md`

### Adhésion à un médiateur de la consommation 🟢

- [ ] Aller sur **medicys.fr** → adhésion en ligne (~10 min)
- [ ] Payer ~120 € HT pour 1 an
- [ ] Recevoir confirmation d'adhésion
- [ ] Mettre à jour `docs/legal/03-conditions-generales-abonnement.md` si Médicys te donne un numéro d'adhérent ou un texte spécifique à inclure

### Ouverture compte bancaire pro 🟡

- [ ] Choisir une banque pro (Qonto, Shine, Boursorama Pro… ~10 €/mois)
- [ ] Ouvrir avec le SIRET reçu
- [ ] Récupérer l'IBAN pour Stripe

---

## Phase 2 — Configuration Stripe (après validation juridique) 🔴

### Configuration des URLs publiques (mode Test d'abord)

- [ ] Stripe Dashboard (mode Test) → rechercher « terms of service » dans la barre de recherche
- [ ] Champ **Terms of service URL** → `https://www.monaeditions.com/legal/terms`
- [ ] Champ **Privacy policy URL** → `https://www.monaeditions.com/legal/privacy`
- [ ] Champ **Site web** → `https://www.monaeditions.com`
- [ ] Sauvegarder
- [ ] Tester sur Mona Editions : « Passer à l'Atelier » → vérifier que la case « J'accepte les CGV » apparaît sur le Checkout Stripe

### Activation Stripe Live 🟡 🔴

- [ ] Stripe Dashboard → toggle vers Live mode
- [ ] Compléter l'activation : SIRET, RIB, justificatif d'identité, déclaration d'activité
- [ ] Attendre la vérification Stripe (1-3 jours)

### Configuration Live (une fois activé)

- [ ] Recréer le produit **Atelier** en mode Live (14,90 €, Recurring, Monthly)
- [ ] Récupérer le nouveau `price_xxx` Live
- [ ] Récupérer les clés `sk_live_...` et `pk_live_...`
- [ ] Recréer le webhook en Live (URL : `https://www.monaeditions.com/api/subscription/webhook`, 5 événements identiques au Test)
- [ ] Récupérer le nouveau `whsec_...` Live
- [ ] Configurer les **URLs publiques** côté Live aussi (mêmes valeurs que Test)

### Bascule Vercel

- [ ] Vercel → Settings → Environment Variables
- [ ] Modifier `STRIPE_SECRET_KEY` → `sk_live_...`
- [ ] Modifier `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- [ ] Modifier `NEXT_PUBLIC_STRIPE_PRICE_ID` → nouveau `price_...` Live
- [ ] Modifier `STRIPE_WEBHOOK_SECRET` → nouveau `whsec_...` Live
- [ ] Redéployer (Deployments → ⋯ → Redeploy)

### Nettoyage DB des résidus Test

```sql
-- Suite à la bascule Test → Live, les anciens customers Stripe (cus_xxxx)
-- du mode Test ne sont plus valides en Live. On les déréférence.
UPDATE artist_subscriptions
SET stripe_customer_id = NULL,
    stripe_subscription_id = NULL,
    plan = 'free',
    status = 'none',
    current_period_start = NULL,
    current_period_end = NULL,
    cancel_at_period_end = FALSE;
```

⚠️ N'oublie pas de remettre les artistes pilotes (Ursula, Mona, Michel) en Atelier gratuit illimité APRÈS cette purge, via l'outil admin `/admin` (section « Offrir un abonnement Atelier »).

---

## Phase 3 — Onboarding des pilotes (pendant les phases 1 et 2)

- [ ] Envoyer l'email d'onboarding à **Ursula** (en allemand : `docs/commercial/07-email-onboarding-artiste-de.md`)
- [ ] Envoyer l'email d'onboarding à **Mona** (en français : `docs/commercial/06-email-onboarding-artiste-fr.md`)
- [ ] Envoyer l'email d'onboarding à **Michel** (en français)
- [ ] Quand chacun se connecte pour la 1ère fois → l'autoriser comme artiste depuis `/admin` (section existante)
- [ ] Lui offrir l'Atelier gratuit depuis `/admin` (nouvelle section « Offrir un abonnement Atelier »)
- [ ] Démarrer le suivi de leur feedback dans `docs/internal/feedback-pilotes.md`

---

## Phase 4 — Migration SQL (à faire avant le push du dernier batch de code)

- [ ] Sur Neon SQL Editor, exécuter la migration de la colonne RGPD :

```sql
ALTER TABLE artist_subscriptions
    ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
```

- [ ] Vérifier que la colonne existe :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'artist_subscriptions'
  AND column_name = 'privacy_accepted_at';
```

- [ ] Pousser le code (case RGPD + outil admin + ToS Stripe) :

```bash
git add -A && git commit -m "feat: RGPD + admin comp + ToS"
git push origin main
```

---

## Phase 5 — Post-launch (optionnel, à faire selon priorité)

### À court terme (utile dès les pilotes actifs)

- [ ] **Monitoring d'erreurs** (Sentry ou équivalent) — 2h
- [ ] **Email automatique au collectionneur** lors d'un claim — 2h
- [ ] **Dashboard admin** avec liste de tous les artistes inscrits — 3h

### À moyen terme (utile dès quelques dizaines d'artistes)

- [ ] **i18n / version multilingue** (allemand pour Ursula, anglais) — plusieurs jours
- [ ] **SEO** : meta tags par œuvre/artiste, sitemap dynamique, OG images — 1 jour
- [ ] **Analytics anonymes** (Plausible ou Vercel Analytics) — 30 min

### À long terme (utile dès volume significatif)

- [ ] **Recherche / filtres sur la Galerie** — utile à partir de 50+ œuvres
- [ ] **Version mobile / PWA** — selon usage observé
- [ ] **Migration smart contracts v3** — quand 30+ artistes ou H1/H2 deviennent tangibles

---

## Suivi global

| Phase | Statut | Notes |
|-------|--------|-------|
| 1 — Juridique | 🟡 En cours | Wife review + URSSAF + Médicys |
| 2 — Stripe Live | ⚪ À démarrer | Bloqué par fin phase 1 |
| 3 — Pilotes | ⚪ À démarrer | Peut démarrer en parallèle (Atelier offert via comp) |
| 4 — Migration SQL | ⚪ Immédiat | À faire avant le prochain push |
| 5 — Post-launch | ⚪ Reporté | Selon priorité après ouverture |
