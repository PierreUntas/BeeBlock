# Documents juridiques — Mona Editions

Ce dossier contient les **documents juridiques publiés** de Mona Editions, à jour de l'immatriculation effective de l'éditeur (Pierre Untas, EI, SIREN 507553550, RNE 24 juin 2026). Les versions publiques sont servies depuis `frontend/content/legal/` ; ce dossier en est le miroir interne, enrichi d'annotations et de pistes de revue juridique.

## Documents inclus

| Fichier | Objet | Visibilité requise |
|---------|-------|---------------------|
| [01-mentions-legales.md](./01-mentions-legales.md) | Mentions légales obligatoires (LCEN art. 6) | Lien dans le footer du site |
| [02-politique-confidentialite.md](./02-politique-confidentialite.md) | Politique RGPD : finalités, sous-traitants, droits, blockchain | Lien dans le footer + checkbox au moment de l'inscription |
| [03-conditions-generales-abonnement.md](./03-conditions-generales-abonnement.md) | CGA Atelier : prix, résiliation, rétractation, responsabilité | URL configurée dans Stripe Dashboard → Public details → Terms of service URL |

## Check-list avant publication officielle

### Identité éditeur — état au 24 juin 2026

- [x] **Pierre Untas**, 88 rue Lagrange 33000 Bordeaux, 06 42 48 03 57
- [x] Statut : entrepreneur individuel (auto-entreprise) — **activité libérale non réglementée**
- [x] **SIREN 507553550** — immatriculé au RNE le 24 juin 2026
- [x] Code APE : **62.01Z** (Programmation informatique) — confirmé par l'INSEE
- [x] Régime TVA : franchise en base, art. 293 B CGI
- [x] Régime social : URSSAF Bretagne (micro-social, versement mensuel)
- [x] Médiateur : Médicys (à confirmer après adhésion réelle)
- [x] Tribunal compétent B2B : Tribunal judiciaire de Bordeaux (l'activité étant libérale, pas commerciale, c'est le TJ et non le tribunal de commerce — à vérifier dans CGV)
- [x] Publication des 3 documents en pages publiques : `/legal/mentions`, `/legal/privacy`, `/legal/terms`
- [x] Footer du site mis à jour avec les 3 liens

### Reste à faire (côté Pierre, externe)

- [ ] **Adhérer à Médicys** sur medicys.fr (~120 € HT/an)
- [ ] **Faire relire les 3 documents par un juriste** — dans le cas de Pierre, sa femme avocate (voir notes pour juriste plus bas)
- [ ] **Renseigner les URLs juridiques dans Stripe** (Settings → Public details → Terms of service URL + Privacy policy URL)
- [ ] **Mettre à jour Stripe** avec le SIREN 507553550 (Settings → Business details)
- [ ] **Vérifier la mention « Tribunal de commerce »** dans CGV : l'activité étant désormais libérale (et non commerciale), c'est le **Tribunal judiciaire** qui est compétent en cas de litige B2B

## Adaptation selon le statut juridique de l'éditeur

Les documents reflètent le statut **entrepreneur individuel — activité libérale non réglementée** (validé INSEE/URSSAF au 24 juin 2026). Si le statut change ultérieurement (création de SAS, SARL, dépassement du seuil micro-entreprise, etc.), il faudra mettre à jour :

- Article 1 des CGA (parties)
- Mentions légales : raison sociale, éventuel RCS, capital social
- Politique de confidentialité : identité du responsable de traitement
- Facturation : régime TVA potentiellement applicable

## Notes pour le juriste qui validera

Points particuliers à examiner :

1. **Irrévocabilité blockchain** : article 8 des CGA et paragraphe 8 de la politique de confidentialité. Notre point de droit central : on doit informer l'utilisateur que certaines données ne peuvent pas être effacées (limitation au droit à l'effacement RGPD). Vérifier la rédaction au regard de la position CNIL sur les blockchains.

2. **Renouvellement anticipé** : article 3.2 des CGA. C'est une mécanique inhabituelle (paiement supplémentaire à l'initiative du client avant la fin de la période). À sécuriser pour éviter requalification en pratique commerciale trompeuse.

3. **Rétractation et exécution immédiate** : article 5 des CGA. La case « exécution immédiate » est jurisprudentiellement valide pour les services numériques, mais doit être visible et explicite. À vérifier que le tunnel Stripe Checkout respecte cette obligation, sinon prévoir un écran intermédiaire dédié.

4. **Médiation de la consommation** : article 13 des CGA. Obligatoire dès activité B2C avec consommateurs, à choisir et indiquer.

5. **TVA** : article 4.2 des CGA. À adapter selon que Pierre franchit ou non le seuil de franchise (36 800 € HT en 2026 pour les services).
