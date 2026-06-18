# Documents juridiques — Mona Editions

Ce dossier contient les **brouillons de travail** des documents juridiques nécessaires à la mise en service publique de Mona Editions. Aucun de ces documents n'a force légale tant qu'il n'a pas été (1) validé par un juriste, (2) signé/publié par l'éditeur, et (3) accessible publiquement sur le site.

## Documents inclus

| Fichier | Objet | Visibilité requise |
|---------|-------|---------------------|
| [01-mentions-legales.md](./01-mentions-legales.md) | Mentions légales obligatoires (LCEN art. 6) | Lien dans le footer du site |
| [02-politique-confidentialite.md](./02-politique-confidentialite.md) | Politique RGPD : finalités, sous-traitants, droits, blockchain | Lien dans le footer + checkbox au moment de l'inscription |
| [03-conditions-generales-abonnement.md](./03-conditions-generales-abonnement.md) | CGA Atelier : prix, résiliation, rétractation, responsabilité | URL configurée dans Stripe Dashboard → Public details → Terms of service URL |

## Check-list avant publication officielle

### Pré-remplissage (juin 2026)

- [x] Identité éditeur : Pierre Untas, 88 rue Lagrange 33000 Bordeaux, 06 42 48 03 57
- [x] Statut : auto-entreprise en cours d'immatriculation
- [x] Code APE pré-rempli : 62.01Z (Programmation informatique)
- [x] Régime TVA : franchise en base, art. 293 B CGI
- [x] Médiateur : Médicys (à confirmer après adhésion réelle)
- [x] Tribunal compétent B2B : Tribunal de commerce de Bordeaux
- [x] Publication des 3 documents en pages publiques : `/legal/mentions`, `/legal/privacy`, `/legal/terms`
- [x] Footer du site mis à jour avec les 3 liens

### Reste à faire (côté Pierre, externe)

- [ ] **Finaliser la déclaration auto-entreprise** sur autoentrepreneur.urssaf.fr → recevoir le SIRET (~7 jours)
- [ ] **Compléter le SIRET** dans les 3 documents dès réception (chercher « SIRET à venir » et remplacer)
- [ ] **Adhérer à Médicys** sur medicys.fr (~120 € HT/an)
- [ ] **Faire relire les 3 documents par un juriste** — dans le cas de Pierre, sa femme avocate (voir notes pour juriste plus bas)
- [ ] **Renseigner les URLs juridiques dans Stripe** (Settings → Public details → Terms of service URL + Privacy policy URL)
- [ ] **Réactiver dans le code `consent_collection.terms_of_service: 'required'`** dans `frontend/app/api/subscription/checkout/route.ts` (la ligne actuellement commentée)
- [ ] **Ajouter une case à cocher RGPD** au moment de l'inscription artiste (acceptation de la politique de confidentialité)

## Adaptation selon le statut juridique de l'éditeur

Les documents sont rédigés en supposant que **Pierre Untas est éditeur en tant qu'auto-entrepreneur** (la configuration la plus probable au lancement). Si le statut change (création de SAS, SARL, association loi 1901, etc.), il faudra mettre à jour :

- Article 1 des CGA (parties)
- Mentions légales : raison sociale, RCS, capital social, etc.
- Politique de confidentialité : identité du responsable de traitement
- Facturation : régime TVA potentiellement applicable

## Notes pour le juriste qui validera

Points particuliers à examiner :

1. **Irrévocabilité blockchain** : article 8 des CGA et paragraphe 8 de la politique de confidentialité. Notre point de droit central : on doit informer l'utilisateur que certaines données ne peuvent pas être effacées (limitation au droit à l'effacement RGPD). Vérifier la rédaction au regard de la position CNIL sur les blockchains.

2. **Renouvellement anticipé** : article 3.2 des CGA. C'est une mécanique inhabituelle (paiement supplémentaire à l'initiative du client avant la fin de la période). À sécuriser pour éviter requalification en pratique commerciale trompeuse.

3. **Rétractation et exécution immédiate** : article 5 des CGA. La case « exécution immédiate » est jurisprudentiellement valide pour les services numériques, mais doit être visible et explicite. À vérifier que le tunnel Stripe Checkout respecte cette obligation, sinon prévoir un écran intermédiaire dédié.

4. **Médiation de la consommation** : article 13 des CGA. Obligatoire dès activité B2C avec consommateurs, à choisir et indiquer.

5. **TVA** : article 4.2 des CGA. À adapter selon que Pierre franchit ou non le seuil de franchise (36 800 € HT en 2026 pour les services).
