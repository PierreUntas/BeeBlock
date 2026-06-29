# Tests fonctionnels — Mona Editions

> Procédure de tests de bout en bout à exécuter avant la mise en production publique, et après chaque déploiement majeur. À traiter comme une checklist linéaire la première fois ; ensuite à sélectionner par parcours selon les zones touchées par un changement.

---

## 0. Préambule

### Environnements

| Environnement | URL | Stripe | Base de données |
|---|---|---|---|
| **Production** | https://monaeditions.com | Live (`sk_live_…`) | Neon Postgres `neondb` |
| **Preview Vercel** | URL ad hoc Vercel | Live (mêmes clés) | Neon `neondb` (partagé) |
| **Local dev** | http://localhost:3000 | Live ou Test selon `.env.local` | Neon ou Postgres local |

⚠️ La majorité des tests de cette doc se font en **production**. Pour éviter de polluer la DB, créer des comptes de test avec un alias Gmail (`pierre.untas+test1@gmail.com`, `+test2`, etc.).

### Outils requis

- Navigateur en navigation privée (pour isoler les sessions)
- Accès Stripe Dashboard (Live mode)
- Accès Neon SQL Editor
- Accès Resend dashboard
- Accès Sentry dashboard
- Téléphone avec lecteur QR pour tester les claims

### Comptes de test (à créer une fois pour toutes)

| Email | Rôle | Wallet (généré au login) |
|---|---|---|
| `pierre.untas+artist-test@gmail.com` | Artiste test | (noter à la 1ère connexion) |
| `pierre.untas+collector-test@gmail.com` | Collectionneur test | (idem) |
| `pierre.untas+admin-test@gmail.com` | Admin de test | (idem) |

---

## 1. Smoke tests post-déploiement (5 min)

À exécuter systématiquement après chaque `git push origin main` qui déclenche un build Vercel. Vérifie qu'aucune régression évidente n'est apparue.

### 1.1 Pages publiques chargent en 3 langues

- [ ] https://monaeditions.com/fr → home FR sans erreur visible
- [ ] https://monaeditions.com/de → home DE
- [ ] https://monaeditions.com/en → home EN
- [ ] /fr/about → page about correctement rendue
- [ ] /fr/explore/editions → galerie chargée
- [ ] /fr/legal/mentions → mentions légales avec SIREN visible
- [ ] /fr/legal/privacy → politique confidentialité
- [ ] /fr/legal/terms → CGV avec mention "Tribunal judiciaire"

### 1.2 Console navigateur propre

- [ ] Ouvre DevTools → Console → aucune erreur rouge sur la home
- [ ] Network tab → toutes les requêtes en 2xx (pas de 4xx/5xx sur les assets)

### 1.3 Sentry n'a pas explosé

- [ ] https://sentry.io → projet Mona Editions → Issues : pas de nouvelle erreur dans les 5 dernières minutes liée au déploiement

---

## 2. Smoke test Sentry (5 min, à faire 1 fois)

Vérifie que les erreurs JS en prod arrivent réellement dans Sentry.

1. Ouvre https://monaeditions.com en mode navigation privée
2. F12 → onglet **Console**
3. Tape :
   ```javascript
   throw new Error("sentry-smoke-test-" + Date.now());
   ```
4. Attends 1-2 min
5. https://sentry.io → ton projet → Issues
6. ✅ L'erreur "sentry-smoke-test-XXXX" doit apparaître

Si l'erreur n'apparaît pas → souci de config (DSN manquant, source maps mal upload, env `NEXT_PUBLIC_SENTRY_DSN` absent côté Vercel).

---

## 3. Test bout-en-bout Stripe (cycle complet abonnement, 30 min)

Le test le plus critique. Valide toute la chaîne paiement → webhook → DB → email.

### 3.1 Pré-requis — créer le coupon de test

À faire une seule fois pour pouvoir tester sans débourser 14,90 €.

**Stripe Dashboard (Live) → Products → Coupons → Create coupon** :

| Champ | Valeur |
|---|---|
| ID | `TEST-LAUNCH` |
| Type | Percentage discount |
| Percentage off | 100 % |
| Duration | Once (1 mois seulement) |
| Redemption limits | Limit redemptions → 5 |
| Expiration | Dans 7 jours |
| Apply to | Specific products → Atelier |

Puis créer un **promotion code** lié à ce coupon :
- Code visible utilisateur : `LAUNCH100`
- Activer : ✅

Activer les promo codes au Checkout :
- https://dashboard.stripe.com/settings/checkout
- Section "Promotion codes" → cocher "Allow promotion codes"
- Save

### 3.2 Cycle souscription

1. Ouvrir **monaeditions.com** en navigation privée
2. Login avec `pierre.untas+artist-test@gmail.com`
3. Aller sur `/fr/artist/subscription`
4. Cliquer "Souscrire à Atelier"
5. **Vérifier** : la modale de rétractation s'ouvre
6. **Vérifier** : tenter de cliquer "Continuer" sans cocher → bouton désactivé
7. Cocher la case rétractation → "Continuer"
8. **Vérifier** : redirect vers Stripe Checkout
9. Dans le Checkout : cliquer "Add promotion code" → taper `LAUNCH100` → Apply
10. **Vérifier** : le total passe à `0,00 €`
11. Remplir une CB (Stripe accepte les cartes test en mode Live aussi pour montant 0)
12. **Vérifier** : la case "J'accepte les CGV" est présente et obligatoire
13. Cocher CGV → Souscrire

### 3.3 Vérifications post-paiement

| Vérification | Où | Attendu |
|---|---|---|
| Redirect | Sur monaeditions.com | Page de confirmation, status "Atelier actif" |
| Webhook Stripe | https://dashboard.stripe.com/webhooks → ton webhook → Events | `customer.subscription.created` en vert (200) |
| Row DB | Neon SQL Editor : `SELECT * FROM artist_subscriptions WHERE email = 'pierre.untas+artist-test@gmail.com';` | `status='active'`, `plan='atelier'`, `withdrawal_waiver_accepted_at` non NULL, `stripe_customer_id` rempli, `stripe_subscription_id` rempli |
| Email Welcome | Boîte `pierre.untas+artist-test@gmail.com` | Email "Bienvenue dans l'Atelier" reçu via Resend (vérifier From: `noreply@monaeditions.com`) |
| Sentry | https://sentry.io | Aucune nouvelle erreur sur la timeline du test |

### 3.4 Création d'une œuvre (paywall passé)

1. Toujours connecté → `/fr/artist/profile` → remplir profil minimal → Save
2. **Vérifier** : badge "Profil créé" ou similaire
3. `/fr/artist/editions/create` → étape 1
4. **Vérifier** : le paywall ne bloque pas, compteur "0/50 œuvres certifiées (fenêtre 30 jours)" visible
5. Remplir tous les champs requis (titre, année, catégorie, technique, dimensions, description, 1 image min, edition size 5)
6. Étape 2 → Étape 3 → signer la transaction
7. **Vérifier** : redirect vers la page de succès avec QR codes téléchargeables
8. **Vérifier en DB** : `SELECT editions_created_count FROM artist_subscriptions WHERE email = '…';` → 1

### 3.5 Désabonnement

1. `/fr/artist/subscription` → "Gérer mon abonnement"
2. **Vérifier** : Stripe Customer Portal s'ouvre sans 500
3. Cliquer "Cancel subscription"
4. Retour sur le site
5. **Vérifier** : status affiché → `pending_cancellation` ou similaire selon impl
6. **Vérifier webhook** : `customer.subscription.deleted` reçu (200)
7. **Vérifier email** : "Subscription Canceled" reçu

### 3.6 Cleanup

```sql
-- Dans Neon SQL Editor — efface la row de test
DELETE FROM artist_subscriptions WHERE email = 'pierre.untas+artist-test@gmail.com';
```

---

## 4. Parcours artiste (complet, 20 min)

### 4.1 Inscription et autorisation

1. Login `pierre.untas+artist-test@gmail.com` (nouveau compte)
2. **Vérifier** : créé en DB → statut `none`, plan `free`
3. Se déconnecter
4. Login avec un compte ADMIN (toi)
5. `/fr/admin` → champ "Autoriser un artiste" → coller l'adresse wallet du compte test
6. **Vérifier** : transaction signée, message succès, l'adresse apparaît dans la liste des autorisés

### 4.2 Création du profil artiste

1. Reconnecter le compte artiste test
2. `/fr/artist/profile`
3. **Vérifier** : la case RGPD est présente (première inscription)
4. Cocher RGPD → remplir nom, location, bio, logo, photos (jusqu'à 7)
5. **Vérifier** : limite 7 photos enforced (impossible d'ajouter une 8ème, alerte si tentative)
6. Save → transaction signée
7. **Vérifier** : redirect ou message succès, profil visible sur `/fr/explore/artist/[adresse]`

### 4.3 Création d'une édition

Voir 3.4 ci-dessus.

### 4.4 Édition d'une œuvre existante

1. `/fr/artist/editions` → liste de tes œuvres
2. Cliquer "Modifier" sur l'œuvre que tu viens de créer
3. **Pré-condition** : aucun claim n'a encore été effectué sur cette édition (sinon l'invariant balance bloque l'édition)
4. Modifier la description → Save
5. **Vérifier** : transaction signée, IPFS upload, contrat appelé
6. Recharger la page de détail → la nouvelle description est visible

### 4.5 Téléchargement du CSV de secret keys

1. Sur la page de succès de création (ou page édition) → bouton "Télécharger CSV"
2. **Vérifier** : fichier CSV téléchargé avec colonnes `secretKey,merkleProof`
3. Ouvrir avec Excel/Numbers → nombre de lignes = edition size

---

## 5. Parcours collectionneur (15 min)

### 5.1 Claim depuis un QR code

**Pré-requis** : avoir le CSV de secret keys d'une édition créée à l'étape 4.3.

1. Prendre la 1ère ligne du CSV : `secretKey1, proof1`
2. Construire l'URL de claim : `https://monaeditions.com/fr/collector/claim?editionId=X&key=secretKey1` (récupérer le tokenId réel de l'édition)
3. Ouvrir l'URL en navigation privée
4. **Vérifier** : page de claim chargée avec preview de l'œuvre
5. Login `pierre.untas+collector-test@gmail.com`
6. Cliquer "Réclamer mon certificat"
7. **Vérifier** : transaction signée (gas sponsorisé), message succès

### 5.2 Vérifications post-claim

| Vérification | Où | Attendu |
|---|---|---|
| Token ERC-1155 | `/fr/collector` connecté avec le compte test | L'édition apparaît dans la liste "Mes certificats" |
| Email | Boîte `pierre.untas+collector-test@gmail.com` | Email "Votre certificat" reçu avec lien vers la page de l'édition |
| Page édition publique | `/fr/explore/edition/[id]` | "1 collectionneur" affiché |
| Re-claim impossible | Retenter la même URL avec la même clé | Message d'erreur "Ce certificat a déjà été réclamé" |

### 5.3 Page certificat

1. Depuis `/fr/collector`, cliquer sur l'œuvre claimée
2. **Vérifier** : page de détail avec preuve blockchain (adresse contrat, transaction hash, lien Basescan)
3. Cliquer le lien Basescan → la transaction de mint apparaît avec ton wallet collector

---

## 6. Tests responsive mobile (15 min)

À exécuter sur un vrai téléphone (iPhone Safari + Android Chrome) OU via DevTools en mode "Responsive Device" (largeur 375-390px pour iPhone, 360 pour Android).

### 6.1 Pages publiques

- [ ] Home : pas de scroll horizontal, hero lisible, CTA cliquables
- [ ] /explore/editions : grid 1 col, cards bien proportionnées
- [ ] /explore/artist/[address] : avatar overlap visible, bouton Partager seul à droite
- [ ] /explore/edition/[id] : galerie image + bouton Partager → popover s'ouvre dans la zone visible (left-0)
- [ ] /about : 15 disciplines lisibles, CTA dark cliquable
- [ ] /contact : formulaire complet, inputs n'auto-zoom pas au focus

### 6.2 Toggle langue mobile

- [ ] Header → bouton compact `FR ▾` (pas les 3 boutons inline)
- [ ] Cliquer → popover avec les 2 autres langues
- [ ] Changer de langue → la page recharge correctement

### 6.3 Modal Privy en mobile

- [ ] Déclencher une transaction (par exemple "Réclamer un certificat" ou "Autoriser un artiste" depuis `/admin`)
- [ ] **Vérifier** : la modale Privy s'affiche entièrement dans la zone visible (pas de rognage gauche/droit)
- [ ] Toutes les lignes (Network, Estimated fee, etc.) lisibles intégralement

### 6.4 Formulaires sans iOS auto-zoom

- [ ] `/admin` → cliquer dans le champ "Adresse de l'artiste"
- [ ] **Vérifier** : iOS ne zoom PAS au focus (l'écran ne change pas de taille)
- [ ] Idem sur `/contact`, `/artist/profile`, `/artist/editions/create`

---

## 7. Tests emails (10 min)

Vérifier que tous les emails partent bien et arrivent sans atterrir en spam.

### 7.1 Emails Resend (envoyés depuis `noreply@monaeditions.com`)

| Email | Trigger | Test |
|---|---|---|
| Welcome Atelier | Première souscription Stripe | Voir 3.3 |
| Renewal Confirmation | Renouvellement mensuel | À tester par avance de date dans Stripe (Customer details → Subscription → "Advance test clock") |
| Subscription Canceled | Annulation Customer Portal | Voir 3.5 |
| Payment Failed | CB refusée | Simuler avec une CB de test échec (`4000 0000 0000 0341`) |
| Claim Receipt | Collectionneur claime un certificat | Voir 5.2 |

### 7.2 Email formulaire contact

1. `/fr/contact` → remplir + Send
2. **Vérifier** : email reçu sur `contact@monaeditions.com` avec From `contact@monaeditions.com`, replyTo = email saisi dans le formulaire

### 7.3 Emails Privy magic link

1. Logout, puis login avec un email frais
2. **Vérifier** : code 6 chiffres reçu via `noreply@privy.io`

### 7.4 Test deliverability (anti-spam)

À faire 1 fois en envoyant les emails de test vers 3 boîtes différentes :
- [ ] Gmail
- [ ] Outlook / Hotmail
- [ ] iCloud / Yahoo

**Vérifier** que chacun arrive bien en boîte de réception, **pas dans Spam**. Si spam → vérifier SPF/DKIM/DMARC dans Resend dashboard.

---

## 8. Tests sécurité & RGPD (5 min)

### 8.1 Bandeau cookies

- [ ] Visiter https://monaeditions.com en navigation privée fraîche
- [ ] **Vérifier** : bandeau cookies en bas
- [ ] Cliquer "Accepter" ou "OK"
- [ ] **Vérifier** : bandeau disparaît, cookie `cookies-ack` créé (DevTools → Application → Cookies)
- [ ] Recharger → bandeau ne réapparaît pas

### 8.2 Acceptation CGV obligatoire

- [ ] Tenter de souscrire sans cocher la case rétractation → modale ne se ferme pas
- [ ] Au niveau Stripe Checkout : la case "J'accepte les CGV" est visible et requise

### 8.3 Privacy policy au signup

- [ ] Première inscription artiste → case "J'accepte la politique de confidentialité" présente
- [ ] **Vérifier en DB** : `privacy_accepted_at` rempli après acceptation

### 8.4 Footer links légaux

- [ ] Mentions, Privacy, Terms accessibles depuis le footer sur toutes les pages

---

## 9. Annexes

### 9.1 Requêtes SQL utiles

```sql
-- Voir tous les abonnés actifs
SELECT email, plan, status, current_period_end, editions_created_count
FROM artist_subscriptions
WHERE status = 'active'
ORDER BY current_period_end DESC;

-- Voir les artistes pilotes (Atelier offert)
SELECT email, plan, status
FROM artist_subscriptions
WHERE plan = 'atelier' AND stripe_customer_id IS NULL;

-- Voir le dernier événement webhook (debug)
SELECT * FROM artist_subscriptions
WHERE email = 'pierre.untas+artist-test@gmail.com'
ORDER BY updated_at DESC LIMIT 1;

-- Reset d'un compte de test
DELETE FROM artist_subscriptions WHERE email LIKE 'pierre.untas+%';
```

### 9.2 Cartes de test Stripe (mode Live aussi)

| Numéro | Effet |
|---|---|
| `4242 4242 4242 4242` | Succès classique (NB : en mode Live, ces cartes ne marchent pas, utiliser une vraie CB + coupon 100% off) |
| `4000 0000 0000 0341` | Décline avec "Insufficient funds" — utile pour tester `payment_failed` en mode Test uniquement |
| `4000 0025 0000 3155` | Force 3D Secure — pour tester le flow d'auth |

### 9.3 Commandes pratiques

```bash
# Tester un webhook Stripe localement
stripe listen --forward-to localhost:3000/api/subscription/webhook

# Vérifier que le build prod passe sans erreur TS
cd frontend && npx tsc --noEmit

# Voir les logs Vercel en temps réel
vercel logs --follow
```

### 9.4 Liens utiles

- Stripe Dashboard : https://dashboard.stripe.com
- Neon Console : https://console.neon.tech
- Resend Dashboard : https://resend.com/emails
- Sentry : https://sentry.io
- Basescan (transactions blockchain) : https://basescan.org
- Pinata (IPFS) : https://app.pinata.cloud
- INPI Entreprises (suivi) : https://entreprises.inpi.fr
- data.inpi.fr (page publique Mona) : https://data.inpi.fr/entreprises/507553550

---

## 10. Rituel post-lancement

### À chaque déploiement (à automatiser plus tard)

1. Smoke tests 1.1 + 1.2 + 1.3 (5 min)
2. Si changement Stripe/paiement : section 3 complète
3. Si changement contrat blockchain : sections 4.3 + 5
4. Si changement frontend visuel : section 6 (mobile)

### À fréquence régulière

- **Hebdomadaire** : check Sentry pour erreurs anormales
- **Mensuel** : vérifier la deliverability emails (test 7.4)
- **Trimestriel** : check expiration coupons Stripe, certificats SSL, renouvellement domaine

---

*Document maintenu par Pierre. Dernière mise à jour : 25 juin 2026.*
