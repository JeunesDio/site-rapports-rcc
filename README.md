# Site public et espace administrateur

Socle Next.js et Supabase pour publier des rapports d’activités sans manipuler GitHub au quotidien. Aucun contenu de démonstration n’est embarqué.

## Configuration locale

1. Créez un projet Supabase et exécutez [`supabase/schema.sql`](supabase/schema.sql) dans son SQL Editor.
2. Copiez `.env.example` vers `.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL`, la clé publishable et `SUPABASE_SERVICE_ROLE_KEY`. La clé service role sert uniquement au nettoyage des médias lors d’une suppression, reste côté serveur et ne doit jamais porter le préfixe `NEXT_PUBLIC_`.
3. Dans Supabase Auth, désactivez l’inscription publique. Créez le premier utilisateur depuis Auth > Users (invitation ou utilisateur créé par un opérateur de confiance), puis ajoutez son UUID à `public.admin_users` via SQL Editor:

   ```sql
   insert into public.admin_users(user_id) values ('UUID_DE_L_UTILISATEUR');
   ```

   N’accordez jamais la création du premier compte admin à un formulaire public. Gardez une procédure de récupération via le tableau de bord Supabase et retirez un administrateur en supprimant sa ligne `admin_users`.
4. Installez Node.js 22.13 ou plus récent et pnpm 11.25.0, puis exécutez `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test:pdf` et `pnpm dev`. Ouvrez `/admin/login`.

## Utilisation et publication

- Les visiteurs ne voient que les rapports avec `status = published`.
- Dans `/admin`, créez/enregistrez d’abord le rapport. Les brouillons restent privés. Sélectionnez plusieurs fichiers depuis le sélecteur natif du navigateur; sur téléphone, celui-ci peut proposer galerie ou caméra selon l’appareil et le navigateur. L’interface affiche la progression, permet d’annuler un fichier et de relancer les échecs.
- Pour les nouveaux médias, utilisez la section **Liens Google** du rapport : album Google Photos, vidéo/dossier Drive, documents/dossier Drive. Les liens sont enregistrés dans `report_links`, privés par défaut, puis ne sont affichés sur le site que si l’administrateur coche l’autorisation de publication. Les URL doivent être HTTPS et utiliser `photos.google.com`, `photos.app.goo.gl`, `drive.google.com` ou `docs.google.com`.
- Le site ne vérifie pas les réglages de partage Google et ne les modifie jamais. Avant de rendre un lien public sur le site, réglez son accès dans Google pour le public voulu puis vérifiez-le avec un navigateur non connecté au compte propriétaire. Les visiteurs peuvent sinon voir une page « accès refusé » même si le lien est affiché sur le site. Les fichiers Google restent gouvernés par les autorisations de leur propriétaire.
- Les photos, vidéos et couvertures déjà téléversées dans le bucket privé Supabase restent prises en charge. Les migrations et suppressions de rapports ne suppriment pas les objets existants liés à des médias Google; le bucket et ses fichiers legacy ne sont pas supprimés par cette évolution.
- Le PDF est généré à la demande par une route serveur et téléchargé au format PDF. Il contient le titre, la date, le lieu, le résumé, le contenu textuel et les liens publiables (ou tous les liens lorsqu’un administrateur génère le PDF d’un brouillon); la galerie legacy n’est pas incorporée au PDF.
- Le code est hébergé dans GitHub; les administrateurs éditent le contenu dans le site, jamais dans GitHub.

## Limites de cette première livraison

Cette base de code ne constitue pas une mise en production vérifiée. Le téléversement XHR indique une progression et autorise 100 Mo par fichier; il ne reprend pas les octets d'un envoi interrompu (le bouton de reprise réessaie le fichier depuis le début). Les médias volumineux nécessitent un téléversement resumable TUS ou un plafond inférieur adapté au plan Supabase. La compression vidéo n’est pas incluse. Les parcours doivent être exercés avec un vrai projet Supabase sur ordinateur et téléphone avant le lancement.

## Migration et hébergement

Pour un projet déjà configuré, réexécutez `supabase/schema.sql` dans le SQL Editor Supabase avant d’ajouter des liens Google. Le script crée `report_links`, active RLS, installe les politiques admin/public, valide le domaine HTTPS et ajoute l’index. Il ne supprime ni ne modifie les lignes du bucket ou de `report_media`. Vérifiez la migration avec un rapport brouillon et des liens de test avant d’utiliser les rapports réels.

GitHub peut héberger le code source, mais **GitHub Pages ne convient pas à cette application** : elle dépend du runtime Next.js pour l’authentification via cookies, `proxy`, Server Actions, routes dynamiques privées et le PDF dynamique. L’export statique Next.js ne prend pas en charge ces fonctions serveur ([documentation Next.js sur l’export statique](https://nextjs.org/docs/app/guides/static-exports)). Utilisez une plateforme compatible avec le runtime Next.js; le guide ci-dessous prend Vercel comme exemple. Cette architecture n’ajoute aucun service Google payant ni API Google.

## Variables et déploiement

### Déploiement exact (à exécuter après les validations)

1. Créez un dépôt GitHub privé, ajoutez ce dossier, puis poussez la branche principale (`git init`, `git add .`, `git commit -m "Initial report site"`, `git branch -M main`, `git remote add origin <URL_DU_DEPOT>`, `git push -u origin main`). GitHub héberge le code; il ne stocke aucun média.
2. Dans Supabase, ouvrez SQL Editor et exécutez `supabase/schema.sql`. Créez l’utilisateur initial et inscrivez son UUID dans `admin_users` comme ci-dessus. Désactivez le signup public.
3. Dans Vercel, importez le dépôt GitHub. Gardez le framework Next.js détecté, la commande d’installation `pnpm install` et la commande de build `pnpm build`.
4. Dans Vercel > Project > Settings > Environment Variables, définissez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview seulement si souhaité, Development selon votre politique). La service role key est secrète, serveur uniquement.
5. Déployez. Dans Supabase Auth > URL Configuration, fixez le domaine Vercel ou le domaine personnalisé en Site URL et ajoutez les URLs de redirection permises. N’ajoutez que les domaines que vous contrôlez.
6. Configurez le domaine et HTTPS dans Vercel. Dans Supabase Storage, confirmez que `report-media` est privé et que les limites MIME/poids correspondent au plan.
7. Avant lancement, suivez la grille de vérification ci-dessous sur un déploiement de prévisualisation avec des fichiers de test autorisés. Ne publiez aucun rapport réel avant d’avoir confirmé l’accord de publication des médias et témoignages.

### Grille de vérification de lancement

- Liens Google : domaines acceptés/refusés, ajout/modification/suppression, brouillon privé, lien autorisé visible après publication, lien non autorisé masqué, partage réglé avec et sans session Google, liens présents dans le PDF.
- Ordinateur : visiteur anonyme, absence de données sans contenu, affichage de rapports publiés uniquement, consultation d’un rapport, médias autorisés, téléchargement du PDF.
- Admin : connexion valide/invalide, refus d’un utilisateur non inscrit à `admin_users`, création/enregistrement d’un brouillon, prévisualisation, sélection de couverture, cases de publication et témoignage, publication/dépublication, édition et suppression confirmée.
- Téléversement : plusieurs photos et vidéos, progression, annulation, erreurs de format/taille, tentative de reprise après erreur, accès public avant et après publication.
- Téléphone réel : connexion, saisie et édition, sélecteur de fichiers/caméra selon le navigateur, envoi sur Wi-Fi et réseau mobile, aperçu et lecture vidéo, mise en page portrait/paysage.
- Vérifiez dans DevTools et les journaux qu’aucune clé service role n’est envoyée au navigateur; inspectez les politiques RLS avec un compte anonyme et un compte non admin.

### Commandes de vérification

```sh
pnpm typecheck
pnpm lint
pnpm test:pdf
pnpm build
```

Cette grille n’a pas été exécutée dans cette livraison : aucun projet Supabase, compte admin, domaine de déploiement ou appareil mobile de test n’est connecté à cette session.
