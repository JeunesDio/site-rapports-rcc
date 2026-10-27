# Rapports d’activités — Service Jeune RCCC de Cotonou

Application statique, sans serveur ni base distante. Le formulaire crée et prévisualise le rapport dans le navigateur; le PDF est téléchargé localement. Les rapports ne deviennent publics qu’après une revue humaine et leur ajout au dépôt GitHub.

Le modèle de rapport est une création institutionnelle originale. Il ne s’agit pas d’un formulaire officiel de l’INH.

## Organisation

- `src/components/report-form.tsx` : formulaire local, sélection/compression des photos, aperçu PDF et téléchargements.
- `src/lib/report.ts` : modèle de données, validations et rubriques éditoriales.
- `src/lib/pdf.ts` : génération PDF côté navigateur, avec logos, pagination, sections optionnelles et photos intégrées.
- `src/data/branding.ts` : mentions institutionnelles et chemins des logos réutilisés dans le site et les PDF.
- `src/data/reports.json` : index versionné des rapports publics. Il est vide au départ; aucune activité fictive n’est publiée.
- `public/rapports/` : PDF publiés.
- `public/identite/` : les deux logos fournis par les responsables.

Les rubriques et leur ordre sont centralisés dans `REPORT_RUBRICS`. Pour modifier le modèle, adaptez cette configuration et ses tests; le moteur PDF parcourt les mêmes rubriques que le formulaire. Les champs vides sont omis du PDF.

## Modèle institutionnel

L’en-tête du PDF affiche les trois mentions demandées, dans cet ordre :

1. ARCHIDIOCÈSE DE COTONOU
2. GROUPE DE PRIÈRE DU RENOUVEAU CHARISMATIQUE DE COTONOU
3. SERVICE JEUNE DU RENOUVEAU CHARISMATIQUE CATHOLIQUE DE COTONOU

Le logo de l’Archidiocèse est placé à gauche, celui du Renouveau à droite. Les images sont ajustées proportionnellement, sans cadre ajouté. Les fichiers fournis sont des JPEG à fond blanc incorporé; un futur logo PNG avec transparence sera aussi pris en charge si son chemin `.png` est déclaré dans `src/data/branding.ts`.

## Créer un rapport

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrez l’adresse locale affichée par Vite, puis choisissez **Créer un rapport**. Seuls l’intitulé et la date sont obligatoires; les rubriques sans contenu sont omises. Les liens d’album Google Photos sont facultatifs et doivent être des liens HTTPS partagés avec les visiteurs visés. Le site ne peut pas vérifier les droits configurés sur Google Photos.

Les photos locales sont facultatives. JPEG, PNG et WebP sont redimensionnés et compressés dans le navigateur avant leur intégration au PDF; jusqu’à 12 images et 18 Mo après compression sont acceptés. Elles ne sont pas téléversées. Le PDF et une fiche JSON prête à intégrer sont téléchargés séparément.

La page ne conserve pas les brouillons après fermeture ou rechargement. Elle n’a pas d’authentification et ne doit pas servir à préparer un document confidentiel. Aucun rapport ni témoignage n’est envoyé ou publié automatiquement.

## Publier un rapport

GitHub Pages ne permet pas au navigateur d’écrire dans le dépôt. La publication se fait donc par revue et commit :

1. Télécharger le PDF et la fiche JSON depuis le formulaire.
2. Vérifier le rapport, les autorisations de publication, les photos, les témoignages et le partage de l’album.
3. Copier le PDF dans `public/rapports/`.
4. Ajouter l’objet JSON fourni à la liste `src/data/reports.json`. Le chemin `pdf` y est relatif à `public/`, par exemple `rapports/2026-10-27-veillee.pdf`.
5. Exécuter les commandes de vérification ci-dessous et consulter le site local.
6. Faire relire les changements, puis les committer et pousser sur `main`.

Le workflow `.github/workflows/deploy.yml` construit le site et déploie `dist/` sur GitHub Pages quand `main` reçoit un push. Aucun jeton GitHub n’est utilisé par le site ou le navigateur. Dans GitHub, régler **Settings → Pages → Build and deployment → GitHub Actions**. La première mise en ligne et les pushes futurs déclencheront le workflow; aucun push n’est réalisé dans le cadre de cette refonte.

Vite est configuré avec la base `/site-rapports-rcc/`, adaptée à l’adresse de projet `https://jeunesdio.github.io/site-rapports-rcc/`. Pour un domaine ou un dépôt différent, changer `base` dans `vite.config.ts`. [Guide officiel Vite pour GitHub Pages](https://vite.dev/guide/static-deploy).

## Contrôles locaux

```sh
pnpm lint
pnpm typecheck
pnpm test:pdf
pnpm build
pnpm test:pages
```

Les tests vérifient les rubriques et leur ordre, les champs obligatoires, les liens Google Photos, la création d’un PDF sans photo et avec plusieurs photos, les textes longs accentués, ainsi que le préfixe et les fichiers du build GitHub Pages.

## Anciennes données Supabase

Cette refonte ne se connecte pas à Supabase, n’exécute aucune migration et ne supprime aucune donnée distante. Le dépôt ne contient pas de PDF de rapport ni d’index de publications à migrer. Les éventuels rapports, médias et réglages de l’ancienne instance Supabase n’ont pas pu être inventoriés; avant de remplacer le site actuellement publié, exportez et relisez les rapports que vous souhaitez conserver, puis ajoutez-les manuellement au nouvel index public. Ne publiez pas de brouillon ni de contenu personnel sans autorisation.

Les anciennes pages Next.js, routes API, fonctions d’administration, configuration Supabase et scripts SQL ne sont plus utilisés par cette version statique. Leur code reste consultable dans l’historique Git; leur retrait local n’affecte pas la base ou les fichiers Supabase existants.

## Confidentialité et limites

- Les fichiers placés dans `public/rapports/` et les liens inscrits dans `src/data/reports.json` seront publics.
- Un lien Google Photos peut être accessible à toute personne qui le possède selon le partage Google configuré; son absence de l’accueil ne le rend pas privé.
- Les brouillons et les images locales ne quittent pas le navigateur, mais il n’existe pas de synchronisation ni de récupération de brouillon.
- Un site GitHub Pages est public et sans contrôle d’accès. Pour des rapports privés, utilisez un service avec authentification et stockage privé; cette version ne répond pas à ce besoin.
- Le formulaire produit le PDF dans les navigateurs compatibles avec `createImageBitmap`, le canevas et `Blob`. Aucune clé ou variable secrète de production n’est nécessaire.
