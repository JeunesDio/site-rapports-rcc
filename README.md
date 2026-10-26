# Rapports d’activités — Diocèse des Jeunes RCC de Cotonou

Site public responsive et espace de gestion sous Next.js, TypeScript et Supabase. Les pages publiques lisent uniquement les rapports publiés; aucun contenu de démonstration n’est inclus.

## Démarrage local

1. Utilisez Node.js 22.13+ et pnpm 11.25.0.
2. Créez un projet Supabase et exécutez [`supabase/schema.sql`](supabase/schema.sql) dans le SQL Editor. Pour un projet existant, faites d’abord une sauvegarde et relisez le script : il ajoute les paramètres, les politiques et le bucket public réservé aux images d’identité, tout en conservant le bucket privé et les médias legacy. Cette livraison ne l’applique pas à votre instance.
3. Copiez `.env.example` vers `.env.local` et renseignez les variables. `SUPABASE_SERVICE_ROLE_KEY` ne doit exister que côté serveur pour les opérations existantes qui le nécessitent; ne la préfixez jamais par `NEXT_PUBLIC_` et ne l’incluez jamais dans Git. La clé publishable et l’URL Supabase sont les seules valeurs Supabase utilisées dans le navigateur.
4. Dans Supabase Auth, désactivez les inscriptions publiques. Créez le premier utilisateur depuis Auth > Users par une invitation ou par un opérateur de confiance, puis ajoutez son UUID dans `public.admin_users` depuis SQL Editor :

   ```sql
   insert into public.admin_users(user_id) values ('UUID_DE_L_UTILISATEUR');
   ```

   Aucun formulaire public ne crée de compte administrateur. Retirez un administrateur en supprimant sa ligne de `admin_users`.
5. Exécutez `pnpm install`, puis `pnpm dev`. Le site est à `/`; la connexion admin est à `/admin/login`.

## Pages publiques et médias

- L’accueil rassemble les activités récentes, rapports publiés, photos et vidéos. Des états vides invitent à revenir quand aucun contenu n’est publié.
- Les routes comprennent `/activites`, `/activites/[id]`, `/rapports`, `/rapports/[id]`, `/galerie` et `/videos`.
- Les activités sont alimentées par les rapports réels publiés; il n’y a pas de fausses cartes. Sans couverture configurée, le site utilise une composition graphique abstraite et non une photo présentée comme réelle.
- Les nouveaux médias peuvent être des liens HTTPS Google Photos, Google Drive, Google Docs ou YouTube. Les liens sont privés par défaut dans le formulaire; seuls les liens explicitement autorisés apparaissent sur le site et dans le PDF public. L’application ne peut pas vérifier le partage Google/YouTube ni le changer. Testez les liens en navigation privée avant publication; un lien peut rester inaccessible si son propriétaire le garde privé.
- Les lignes et objets du bucket legacy `report-media` restent compatibles et le bucket demeure privé. Les objets existants ne sont pas supprimés par le script SQL.

## Administration et identité visuelle

Dans `/admin`, les administrateurs peuvent gérer les rapports, les liens, les brouillons, la prévisualisation, le PDF, la publication/dépublication et la suppression avec confirmation. Le serveur contrôle le rôle via `admin_users`; RLS protège également les écritures.

La rubrique **Identité visuelle et médias** permet d’enregistrer les coordonnées éditoriales, le logo, le favicon, la couverture d’accueil, les visuels des sections et le modèle PDF. Les paramètres sont stockés dans `public.site_settings`, ils persistent aux redéploiements. Les éléments destinés à l’identité publique sont enregistrés dans `site-assets` (lecture publique; écriture/suppression admins uniquement). Limite : 5 Mo et formats JPEG/PNG/WebP; les logos PDF acceptent JPEG/PNG. Les images de configuration n’acceptent pas de fichiers vidéo.

Les couvertures de rapports peuvent être propres à chaque rapport. L’ordre d’affichage est : couverture dédiée du rapport, couverture legacy de ce rapport, puis couverture PDF par défaut. Les nouvelles couvertures individuelles résident dans le bucket privé `report-covers`; seules des URLs temporaires sont émises pour les rapports publiés, après contrôle du statut. Le preview et le PDF de brouillon sont réservés aux admins. Un remplacement met à jour la référence persistante avant de tenter le retrait contrôlé de l’ancien objet. Ne placez pas de document privé dans `site-assets`.

Les palettes disponibles sont prédéfinies. L’aperçu PDF reprend l’identité et la couverture retenues. La génération s’effectue côté serveur avec `pdf-lib` (images PNG/JPEG intégrées dans le PDF; [documentation de l’API PDF-LIB](https://pdf-lib.js.org/docs/api/classes/pdfdocument)).

## Migration Supabase

Le fichier [`supabase/schema.sql`](supabase/schema.sql) est le schéma et script de mise à niveau idempotent à utiliser dans le SQL Editor. Il ajoute `reports.cover_asset_path`, le type de lien `youtube_video`, `site_settings`, les buckets `site-assets` et `report-covers` et les politiques associées. Les visiteurs peuvent lire les paramètres d’identité destinés au site; seuls les administrateurs RLS peuvent les écrire. `site-assets` contient les images publiques; `report-covers` est privé et ses politiques n’autorisent la lecture qu’aux admins ou aux objets associés à un rapport publié. Les pages émettent des URLs signées pour ces rapports publiés. Le bucket `report-media` et les rapports legacy restent privés selon leurs politiques existantes.

Avant la mise en production, examinez les politiques existantes de votre projet Supabase et sauvegardez-le. L’exécution de la migration réelle, la création du premier admin et la configuration Auth/Storage sont des étapes opérateur séparées; elles ne sont pas effectuées par le code de cette livraison.

## Vérifications locales

```sh
pnpm typecheck
pnpm lint
pnpm test:pdf
pnpm build
```

## Déploiement Vercel

GitHub héberge le code source. GitHub Pages ne convient pas à cette application dynamique (authentification serveur, cookies, routes privées, Server Actions et génération PDF); utilisez Vercel ou une plateforme compatible avec le runtime Next.js. L’export statique ne prend pas en charge ces fonctions serveur ([documentation Next.js](https://nextjs.org/docs/app/guides/static-exports)).

1. Poussez le dépôt vers GitHub après revue et validation. Aucun push ni déploiement n’est réalisé par ce guide.
2. Dans Supabase, sauvegardez puis exécutez le schéma, créez le premier utilisateur admin et désactivez l’inscription publique.
3. Importez le dépôt GitHub dans Vercel, laissez le framework Next.js détecté et utilisez `pnpm install` / `pnpm build`.
4. Ajoutez les variables de `.env.example` aux environnements souhaités dans Vercel. La clé service role est exclusivement serveur et ne doit jamais être ajoutée à une variable `NEXT_PUBLIC_*`.
5. Configurez les URLs Auth Supabase avec le domaine contrôlé de Vercel ou le domaine personnalisé, puis vérifiez HTTPS et les règles de Storage.
6. Avant le lancement, testez les liens, accès visiteur/admin, états sans contenu, PDF et formats mobiles avec un compte Supabase et des appareils/navigateurs réels. La validation locale ne remplace pas ces tests d’intégration.
