# Procédure de migration Supabase — audit préalable

Cette procédure concerne `schema.sql`. Le fichier n'a pas été exécuté sur une instance Supabase réelle. Ne l'exécuter qu'après revue des résultats ci-dessous et autorisation explicite.

## Ce que fait le script

- Crée les tables/colonnes/index/fonctions nécessaires sans supprimer de table, de ligne ou d'objet Storage.
- Remplace uniquement les politiques dont les noms exacts sont déclarés comme gérés par ce script (`admins ...`, `public reads ...` et `rcc guard ...`). Les politiques de tout autre nom restent en place.
- Ajoute des politiques restrictives comme plafonds d'accès : PostgreSQL combine les politiques permissives par `OR`, puis les restrictives par `AND`. Elles empêchent donc les anciennes politiques permissives d'élargir l'accès pour les cinq tables et trois buckets gérés.
- Révoque `PUBLIC`/`anon`/`authenticated` des privilèges non requis, puis accorde à nouveau les droits de l'application : lecture publique des rapports/médias/liens publiés et paramètres; CRUD de rapports/médias/liens et édition de paramètres aux utilisateurs authentifiés, filtrés par RLS; lecture de sa propre ligne `admin_users` à un utilisateur connecté. L'adhésion admin ne peut pas être modifiée via l'API.
- Ne modifie jamais la visibilité ni la configuration d'un bucket déjà existant (`ON CONFLICT DO NOTHING`). Si l'état initial est inattendu, le garde-fou s'arrête avant tout DDL.
- Un `site-assets` absent serait créé public sur installation neuve. Les objets de ce bucket sont donc publics par URL. Ne pas exécuter sans décision explicite de rendre publics les nouveaux visuels de marque.

La révocation des privilèges `PUBLIC` peut affecter d'autres applications/roles qui utilisent ces mêmes tables. Confirmer d'abord qu'aucun consommateur distinct ne dépend de ces privilèges implicites. Les droits explicites `anon` et `authenticated` requis par le site sont accordés ensuite.

## 1. Préparation (avant migration)

1. Faire une sauvegarde/restauration de test du projet et relever les rôles/API consommateurs.
2. Dans le SQL Editor Supabase (lecture seule), vérifier les buckets et leur visibilité :

```sql
select b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types,
       count(o.id) as object_count
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
where b.id in ('site-assets', 'report-media', 'report-covers')
group by b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types
order by b.id;
```

3. Lister les objets existants avant toute décision sur la visibilité :

```sql
select bucket_id, name, owner_id, created_at, metadata
from storage.objects
where bucket_id in ('site-assets', 'report-media', 'report-covers')
order by bucket_id, name;
```

4. Inspecter toutes les politiques table et Storage, y compris celles inconnues de cette migration :

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('admin_users','reports','report_media','report_links','site_settings'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

5. Vérifier l'activation RLS et les privilèges effectifs déclarés :

```sql
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('admin_users','reports','report_media','report_links','site_settings');

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('admin_users','reports','report_media','report_links','site_settings')
order by table_name, grantee, privilege_type;
```

6. Vérifier `is_admin()` (signature, propriétaire, sécurité definer et définition) :

```sql
select p.oid::regprocedure as function_name, r.rolname as owner, p.prosecdef as security_definer,
       p.proconfig, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.oid = 'public.is_admin()'::regprocedure;
```

7. Comptabiliser brouillons/publiés et repérer les associations de couverture avant la migration :

```sql
select status, count(*) from public.reports group by status order by status;
select count(*) as media_rows from public.report_media;
select count(*) as link_rows from public.report_links;
select id, status, cover_asset_path from public.reports where cover_asset_path is not null;
```

### Conditions d'arrêt / décision manuelle

- `site-assets` existe privé : le script s'arrête volontairement. Auditer chaque objet et choisir manuellement si le bucket reste privé (il faudra alors adapter l'app qui attend des URL publiques) ou si sa publication est approuvée. Aucun changement d'accès public n'est automatique.
- `report-covers` ou `report-media` existe public : le script s'arrête. Ne pas basculer sa visibilité avant audit des fichiers et approbation explicite.
- `site-assets` existe public : ses objets sont déjà lisibles publiquement par URL, quelles que soient les politiques Storage. Auditer les fichiers; déplacer ou protéger des fichiers sensibles exige une décision et une procédure séparées.
- Examiner les contraintes existantes sur `report_links` avant exécution : la migration remplace les contraintes nommées `report_links_media_type_check` et `report_links_url_check` pour inclure YouTube et les domaines HTTPS autorisés. Détecter les lignes incompatibles avant de poser ces contraintes :

```sql
select id, media_type, url from public.report_links
where media_type not in ('photos_album','drive_video','drive_document','youtube_video')
   or length(url) > 2048
   or url !~* '^https://(photos\.google\.com|photos\.app\.goo\.gl|drive\.google\.com|docs\.google\.com|youtube\.com|www\.youtube\.com|youtu\.be)(/|[?#]|$)';
```

Corriger manuellement les lignes incompatibles, sans les supprimer, ou arrêter et adapter la migration.

## 2. Exécution progressive

1. Revoir et archiver les sorties de contrôle, confirmer sauvegarde et consommation des privilèges.
2. D'abord exécuter sur une copie/staging Supabase réaliste. Comparer les politiques et grants avant/après.
3. L'installation neuve crée `site-assets` public; sur l'existant, le script refuse `site-assets` privé et n'altère pas sa visibilité. Un bucket existant n'est jamais reconfiguré par ce script.
4. Après accord explicite seulement, exécuter `schema.sql` une fois sur le projet réel via le SQL Editor. Les DDL sont largement répétables, mais restent soumis aux garde-fous et aux contraintes de données. En cas d'erreur, arrêter, conserver le message et diagnostiquer; ne pas lancer de reset.

## 3. Contrôles après migration

Relancer les requêtes des étapes 2, 4, 5 et 7. Vérifier en particulier :

- Les buckets et les fichiers préexistants sont toujours présents et leur visibilité n'a pas changé.
- Les politiques inconnues sont toujours listées; les politiques `rcc guard ...` sont présentes en mode restrictive.
- `anon` ne peut pas lire les brouillons, ni les médias/liens non publics/non publiés; les utilisateurs non-admin ne peuvent pas écrire.
- Les admins voient les brouillons, publient, dépublient et gèrent les rapports, les réglages et les objets Storage gérés.
- Les couvertures du bucket privé ne sont signées côté serveur que pour un rapport publié ou par un admin. La signature temporaire obtenue avant dépublication demeure valable jusqu'à son expiration; ne jamais considérer une URL signée existante comme immédiatement révoquée.
- `site-assets` public ne contient que des visuels destinés au public.

### Tests d'accès recommandés en staging

Le SQL Editor utilise des privilèges élevés et ne constitue pas un test d'accès utilisateur. Utiliser l'API de staging avec trois sessions distinctes (anon, utilisateur Auth non-admin, admin) et données temporaires clairement identifiées :

| Opération | Anonyme | Auth non-admin | Admin |
|---|---:|---:|---:|
| Lire rapport publié | Oui | Oui | Oui |
| Lire brouillon | Non | Non | Oui |
| Lire média/lien public d'un rapport publié | Oui | Oui | Oui |
| Lire média/lien privé ou brouillon | Non | Non | Oui |
| Insérer/modifier/supprimer rapport, liens ou média | Non | Non | Oui |
| Lire réglages du site | Oui | Oui | Oui |
| Modifier réglages ou téléverser/remplacer/supprimer visuel | Non | Non | Oui |
| Lire fichier `report-covers` non associé à un rapport publié | Non | Non | Oui |
| Lire couverture privée associée à rapport publié via signature serveur | Selon signature accordée par serveur | Selon signature accordée par serveur | Oui |

Les tests d'accès intégrés ne peuvent pas être exécutés dans cet environnement : Supabase CLI, Docker et identifiants de staging ne sont pas disponibles. Aucun accès à une instance Supabase n'a été tenté.
