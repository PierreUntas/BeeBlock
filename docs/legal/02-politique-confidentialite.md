# Politique de confidentialité — Mona Editions

> **Statut de ce document** : brouillon de travail à valider par un juriste avant publication. Conformité RGPD à vérifier ligne par ligne.

## 1. Responsable du traitement

Le responsable du traitement des données personnelles collectées sur Mona Editions est :

**Pierre Untas**
Email : pierre.untas@gmail.com

Au stade actuel du projet, l'éditeur n'a pas désigné de Délégué à la Protection des Données (DPO) — non requis légalement compte tenu de la nature et du volume des traitements.

## 2. Données collectées et finalités

### 2.1 Lors de l'inscription comme artiste

| Donnée | Source | Finalité |
|--------|--------|----------|
| Adresse email | Saisie utilisateur (via Privy) | Authentification, communication transactionnelle, demande de validation par l'éditeur |
| Adresse de portefeuille blockchain | Générée par Privy (embedded wallet) ou liée par l'utilisateur | Identification unique sur la plateforme, signature des transactions, propriété des certificats émis |
| Nom de l'atelier / nom d'artiste | Saisie utilisateur | Affichage public sur les pages artistes et œuvres |
| Lieu de l'atelier | Saisie utilisateur | Affichage public |
| Biographie, expositions, réseaux sociaux | Saisie utilisateur | Affichage public |
| Logo, photographies | Upload utilisateur | Affichage public, stockage IPFS |

### 2.2 Lors de la création d'une œuvre certifiée

| Donnée | Source | Finalité |
|--------|--------|----------|
| Titre, description, technique, dimensions, année | Saisie artiste | Métadonnées du certificat (publiques, stockées sur IPFS) |
| Images de l'œuvre | Upload artiste | Affichage public, stockage IPFS |
| Taille d'édition | Saisie artiste | Émission du nombre correspondant de certificats |

### 2.3 Lors de la souscription à un abonnement Atelier

| Donnée | Source | Finalité |
|--------|--------|----------|
| Identifiant client Stripe | Stripe | Lien entre l'artiste et son moyen de paiement |
| Statut, dates de période, plan | Stripe (via webhooks) | Calcul du quota d'éditions disponibles |
| Nombre d'éditions créées par période | Notre application | Application du quota |

**Les données de carte bancaire ne sont jamais collectées ni stockées par Mona Editions**. Elles sont gérées exclusivement par Stripe sur leur infrastructure certifiée PCI-DSS.

### 2.4 Lors de la réclamation d'un certificat (collectionneur)

Aucune donnée personnelle n'est collectée par Mona Editions sur le collectionneur. La réclamation se fait en signant une transaction blockchain depuis un portefeuille — seule l'adresse de ce portefeuille (publique par nature) apparaît dans l'historique du certificat.

## 3. Bases légales du traitement

- **Exécution du contrat** : pour les données nécessaires à la fourniture du service de certification et de gestion d'abonnement.
- **Consentement** : pour l'affichage public du profil artiste et de ses œuvres.
- **Obligation légale** : pour les données comptables et fiscales liées aux paiements (conservation 10 ans selon le Code de commerce).
- **Intérêt légitime** : pour les logs techniques de fonctionnement et la prévention de la fraude.

## 4. Sous-traitants et destinataires

Vos données sont traitées par les sous-traitants suivants, tous engagés contractuellement à respecter le RGPD :

| Sous-traitant | Localisation des données | Rôle | Politique |
|---------------|--------------------------|------|-----------|
| Privy.io | États-Unis (clauses contractuelles types UE-US) | Authentification email, gestion des portefeuilles embarqués | https://privy.io/privacy-policy |
| Stripe | États-Unis (DPF, clauses contractuelles types) | Traitement des paiements, abonnements | https://stripe.com/fr/privacy |
| Vercel | États-Unis (DPF) | Hébergement du site et des fonctions API | https://vercel.com/legal/privacy-policy |
| Neon Inc. (via Vercel) | Allemagne (Francfort) | Base de données des abonnements et événements | https://neon.tech/privacy-policy |
| Pinata Technologies | États-Unis | Stockage IPFS des métadonnées et images d'œuvres | https://www.pinata.cloud/privacy-policy |
| Resend | États-Unis | Envoi des emails transactionnels (si activé) | https://resend.com/legal/privacy-policy |

Aucune donnée n'est cédée, vendue ou louée à des tiers à des fins commerciales.

## 5. Durée de conservation

| Catégorie de données | Durée |
|----------------------|-------|
| Données du compte artiste | Durée du compte + 1 an après suppression |
| Données comptables et de paiement | 10 ans (obligation légale) |
| Logs techniques | 12 mois |
| Données blockchain (certificats émis, métadonnées IPFS) | **Permanente et irrévocable** — voir paragraphe 8 |

## 6. Vos droits

Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants sur vos données :

- **Droit d'accès** : obtenir copie des données vous concernant
- **Droit de rectification** : corriger des données inexactes
- **Droit à l'effacement** : supprimer vos données (limitations en paragraphe 8)
- **Droit à la portabilité** : recevoir vos données dans un format structuré
- **Droit d'opposition** : refuser certains traitements
- **Droit de limitation** : geler temporairement certains traitements

Pour exercer ces droits, écrivez à : **pierre.untas@gmail.com**. Une réponse vous sera apportée sous 30 jours maximum.

Si vous estimez vos droits non respectés, vous pouvez introduire une réclamation auprès de la **CNIL** : https://www.cnil.fr/fr/plaintes

## 7. Sécurité

Les mesures suivantes sont en place pour protéger vos données :

- Chiffrement en transit (HTTPS partout)
- Chiffrement au repos (base de données Neon)
- Authentification forte via Privy
- Vérification de signature sur tous les webhooks
- Accès limité aux administrateurs identifiés
- Code source audité (audit de sécurité disponible sur demande)

## 8. Cas particulier des données blockchain

Mona Editions s'appuie sur la blockchain Base pour l'émission de certificats. Les données suivantes, une fois publiées sur la blockchain, sont **publiques, permanentes et impossibles à effacer ou modifier** :

- L'adresse de portefeuille d'un artiste ayant créé une édition
- L'adresse de portefeuille d'un collectionneur ayant réclamé un certificat
- L'identifiant et la taille des éditions créées
- Le hash des métadonnées (CID IPFS)

Les métadonnées IPFS elles-mêmes (titres, descriptions, images) sont également hébergées de manière redondante par Pinata et difficiles à retirer une fois propagées sur le réseau IPFS public.

**Avant toute inscription**, l'utilisateur est invité à prendre conscience de cette irréversibilité. Le droit à l'effacement ne peut pas s'appliquer à ces données. Il s'applique en revanche à toutes les autres données détenues par Mona Editions hors blockchain (compte, email, données de facturation).

## 9. Cookies

Mona Editions utilise uniquement des cookies techniques strictement nécessaires au fonctionnement :

- Cookies de session Privy pour maintenir l'authentification
- Cookies WalletConnect pour la connexion de portefeuilles externes
- Cookies de préférences (langue, etc.)

Aucun cookie de traçage publicitaire, de profilage marketing, ou de mesure d'audience tiers n'est utilisé. Le consentement explicite n'est donc pas requis (CNIL, recommandation cookies).

## 10. Modifications de la politique

Cette politique peut être modifiée pour refléter l'évolution du service ou de la législation. Toute modification substantielle vous sera notifiée par email à l'adresse de votre compte artiste avec un préavis de 30 jours.

---

*Dernière mise à jour : à dater à la publication officielle.*
