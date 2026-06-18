# Documents juridiques — Mona Editions

Ce dossier contient les **brouillons de travail** des documents juridiques nécessaires à la mise en service publique de Mona Editions. Aucun de ces documents n'a force légale tant qu'il n'a pas été (1) validé par un juriste, (2) signé/publié par l'éditeur, et (3) accessible publiquement sur le site.

## Documents inclus

| Fichier | Objet | Visibilité requise |
|---------|-------|---------------------|
| [01-mentions-legales.md](./01-mentions-legales.md) | Mentions légales obligatoires (LCEN art. 6) | Lien dans le footer du site |
| [02-politique-confidentialite.md](./02-politique-confidentialite.md) | Politique RGPD : finalités, sous-traitants, droits, blockchain | Lien dans le footer + checkbox au moment de l'inscription |
| [03-conditions-generales-abonnement.md](./03-conditions-generales-abonnement.md) | CGA Atelier : prix, résiliation, rétractation, responsabilité | URL configurée dans Stripe Dashboard → Public details → Terms of service URL |

## Check-list avant publication officielle

- [ ] Compléter les champs `(à compléter)` (SIRET, adresse, médiateur conso, etc.)
- [ ] Faire relire par un juriste spécialisé en droit du numérique ou de la consommation (budget indicatif : 150-400 €)
- [ ] Adhérer à un dispositif de médiation de la consommation (obligatoire dès l'activité B2C, env. 80-200 €/an selon CMAP, Médicys, etc.)
- [ ] Publier les 3 documents en pages publiques sur le site :
  - `/mentions-legales`
  - `/confidentialite`
  - `/conditions-abonnement`
- [ ] Renseigner ces URLs dans Stripe Dashboard (Settings → Public details → Terms of service URL + Privacy policy URL)
- [ ] Réactiver dans le code `consent_collection.terms_of_service: 'required'` dans `frontend/app/api/subscription/checkout/route.ts` (ligne commentée)
- [ ] Ajouter une case à cocher RGPD au moment de l'inscription artiste (acceptation de la politique de confidentialité)
- [ ] Mettre à jour le footer du site avec les 3 liens

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
