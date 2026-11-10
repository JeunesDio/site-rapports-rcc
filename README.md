# Rapports d’activités — Service Jeune RCCC de Cotonou

Site public statique, sans serveur ni base distante. Il présente l’archive et les PDF publiés. L’outil de création est maintenu dans le dépôt privé `JeunesDio/site-rapports-rcc-admin` et s’ouvre dans un Codespace privé.

Le modèle de rapport est une création institutionnelle originale. Il ne s’agit pas d’un formulaire officiel de l’INH.

## Organisation

- `src/App.tsx` : accueil public, archive et pages des rapports publiés.
- `src/lib/published-reports.ts` : validation de l’index public.
- `src/data/branding.ts` : mentions institutionnelles et chemins des logos réutilisés dans le site et les PDF.
- `src/data/reports.json` : index versionné des rapports publics. Il est vide au départ; aucune activité fictive n’est publiée.
- `public/rapports/` : PDF publiés.
- `public/identite/` : les deux logos fournis par les responsables.

Le générateur n’est pas inclus dans le build public GitHub Pages. Il reste disponible dans le dépôt privé pour le Codespace administrateur.

## Modèle institutionnel

L’en-tête du PDF affiche les trois mentions demandées, dans cet ordre :

1. ARCHIDIOCÈSE DE COTONOU
2. GROUPE DE PRIÈRE DU RENOUVEAU CHARISMATIQUE DE COTONOU
3. SERVICE JEUNE DU RENOUVEAU CHARISMATIQUE CATHOLIQUE DE COTONOU

Le logo de l’Archidiocèse est placé à gauche, celui du Renouveau à droite. Les images sont ajustées proportionnellement, sans cadre ajouté. Les fichiers fournis sont des JPEG à fond blanc incorporé; un futur logo PNG avec transparence sera aussi pris en charge si son chemin `.png` est déclaré dans `src/data/branding.ts`.

## Site public et outil de création privé

Ce dépôt public sert l’accueil, l’archive et les PDF publiés sur GitHub Pages. Le formulaire de création n’est pas inclus dans le site public. Le bouton **Créer un rapport** mène au dépôt privé `JeunesDio/site-rapports-rcc-admin`, accessible après connexion au compte GitHub autorisé.

L’outil privé s’ouvre dans GitHub Codespaces. Le port de l’application doit rester **Private** (valeur par défaut) ; GitHub authentifie l’accès au port. Le site public reste consultable sans connexion.

Dans l’outil privé, seuls l’intitulé et la date sont obligatoires. Jusqu’à 12 photos et 18 Mo après compression sont acceptés, toutes rubriques confondues. Les photos de témoignage sont prévisualisées, remplaçables et supprimables, puis intégrées à la section correspondante du PDF. Les brouillons et photos restent dans le navigateur ; ils ne sont pas téléversés vers une base ou un stockage distant.

Codespaces protège l’accès à l’instance de création. Le code a toutefois figuré dans l’historique public de ce dépôt ; il ne doit pas être considéré comme secret et peut encore être récupéré pour être exécuté ailleurs. La session du port privé expire et peut demander une nouvelle authentification.

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
pnpm build
pnpm test:public
```

Les tests du dépôt public vérifient les métadonnées publiées et le contenu du build GitHub Pages. Les tests PDF et formulaire se trouvent dans le dépôt privé de l’outil.

## Anciennes données Supabase

Cette refonte ne se connecte pas à Supabase, n’exécute aucune migration et ne supprime aucune donnée distante. Le dépôt ne contient pas de PDF de rapport ni d’index de publications à migrer. Les éventuels rapports, médias et réglages de l’ancienne instance Supabase n’ont pas pu être inventoriés; avant de remplacer le site actuellement publié, exportez et relisez les rapports que vous souhaitez conserver, puis ajoutez-les manuellement au nouvel index public. Ne publiez pas de brouillon ni de contenu personnel sans autorisation.

Les anciennes pages Next.js, routes API, fonctions d’administration, configuration Supabase et scripts SQL ne sont plus utilisés par cette version statique. Leur code reste consultable dans l’historique Git; leur retrait local n’affecte pas la base ou les fichiers Supabase existants.

## Confidentialité et limites

- Les fichiers placés dans `public/rapports/` et les liens inscrits dans `src/data/reports.json` seront publics.
- Un lien Google Photos peut être accessible à toute personne qui le possède selon le partage Google configuré; son absence de l’accueil ne le rend pas privé.
- Les brouillons et les images locales ne quittent pas le navigateur, mais il n’existe pas de synchronisation ni de récupération de brouillon.
- Un site GitHub Pages est public et sans contrôle d’accès. Pour des rapports privés, utilisez un service avec authentification et stockage privé; cette version ne répond pas à ce besoin.
- Le formulaire produit le PDF dans les navigateurs compatibles avec `createImageBitmap`, le canevas et `Blob`. Aucune clé ou variable secrète de production n’est nécessaire.
