-- Supabase schema and additive migration for the RCC reports site.
-- Review supabase/MIGRATION.md first. Existing bucket visibility is never changed.
-- This guard runs before all DDL so an unexpected bucket state aborts early.
do $$
declare
  site_assets_public boolean;
  report_covers_public boolean;
  report_media_public boolean;
begin
  select public into site_assets_public from storage.buckets where id = 'site-assets';
  if site_assets_public is false then
    raise exception 'Migration stopped: site-assets already exists as a PRIVATE bucket. Audit its objects and decide separately; this script will not make it public.';
  end if;

  select public into report_covers_public from storage.buckets where id = 'report-covers';
  if report_covers_public is true then
    raise exception 'Migration stopped: report-covers already exists as a PUBLIC bucket. Audit and resolve separately; report covers must remain private.';
  end if;

  select public into report_media_public from storage.buckets where id = 'report-media';
  if report_media_public is true then
    raise exception 'Migration stopped: report-media already exists as a PUBLIC bucket. Audit legacy files and resolve separately; this script will not change its visibility.';
  end if;
end $$;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Idempotency note: DROP POLICY statements in this file name only policies
-- owned by this migration (the exact "admins...", "public reads...", and
-- "rcc guard..." names below). They are recreated with the definitions here;
-- policies with any other name are preserved and restrictive guards constrain
-- their effective access on managed tables/buckets.
drop policy if exists "admins can see their membership" on public.admin_users;
create policy "admins can see their membership" on public.admin_users for select to authenticated using (user_id = auth.uid());

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  activity_date date not null,
  location text not null default '',
  summary text not null default '',
  body text not null default '',
  cover_path text,
  cover_asset_path text,
  status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reports add column if not exists cover_asset_path text;
create table if not exists public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check(media_type in ('photo','video')),
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check(file_size > 0 and file_size <= 104857600),
  caption text,
  is_public boolean not null default false,
  is_testimonial boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.report_media add column if not exists is_testimonial boolean not null default false;
-- Google links live in the database; the legacy Storage bucket and rows above stay intact.
create table if not exists public.report_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  media_type text not null check (media_type in ('photos_album','drive_video','drive_document','youtube_video')),
  title text not null check (length(trim(title)) between 1 and 160),
  url text not null check (
    length(url) <= 2048 and
    url ~* '^https://(photos\.google\.com|photos\.app\.goo\.gl|drive\.google\.com|docs\.google\.com|youtube\.com|www\.youtube\.com|youtu\.be)(/|[?#]|$)'
  ),
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
-- Allow the added YouTube link type when upgrading an existing report_links table.
alter table public.report_links drop constraint if exists report_links_media_type_check;
alter table public.report_links add constraint report_links_media_type_check check (media_type in ('photos_album','drive_video','drive_document','youtube_video'));
alter table public.report_links drop constraint if exists report_links_url_check;
alter table public.report_links add constraint report_links_url_check check (
  length(url) <= 2048 and
  url ~* '^https://(photos\.google\.com|photos\.app\.goo\.gl|drive\.google\.com|docs\.google\.com|youtube\.com|www\.youtube\.com|youtu\.be)(/|[?#]|$)'
);

create table if not exists public.site_settings (
  id text primary key check (id = 'global'),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
alter table public.reports enable row level security;
alter table public.report_media enable row level security;
alter table public.report_links enable row level security;

-- RLS does not constrain TRUNCATE. Remove non-application DDL privileges while
-- preserving the application's required SELECT and authenticated CRUD grants.
revoke truncate, references, trigger on table
  public.admin_users, public.reports, public.report_media, public.report_links, public.site_settings
from public, anon, authenticated;

revoke insert, update, delete on table public.admin_users from public, anon, authenticated;
revoke select on table public.admin_users from public, anon;
grant select on table public.admin_users to authenticated;

revoke select on table public.reports, public.report_media, public.report_links, public.site_settings from public;
revoke insert, update, delete on table public.reports, public.report_media, public.report_links
from public, anon, authenticated;
grant select on table public.reports, public.report_media, public.report_links to anon, authenticated;
grant insert, update, delete on table public.reports, public.report_media, public.report_links to authenticated;

revoke insert, update, delete on table public.site_settings from public, anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "public reads site settings" on public.site_settings;
drop policy if exists "admins insert site settings" on public.site_settings;
drop policy if exists "admins update site settings" on public.site_settings;
create policy "public reads site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admins insert site settings" on public.site_settings for insert to authenticated with check (public.is_admin());
create policy "admins update site settings" on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Restrictive ceilings ensure unrelated legacy permissive policies cannot widen writes.
drop policy if exists "rcc guard site settings insert" on public.site_settings;
create policy "rcc guard site settings insert" on public.site_settings as restrictive for insert to anon, authenticated with check (public.is_admin());
drop policy if exists "rcc guard site settings update" on public.site_settings;
create policy "rcc guard site settings update" on public.site_settings as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rcc guard admin membership read" on public.admin_users;
create policy "rcc guard admin membership read" on public.admin_users as restrictive for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "public reads published reports" on public.reports;
drop policy if exists "admins create reports" on public.reports;
drop policy if exists "admins update reports" on public.reports;
drop policy if exists "admins delete reports" on public.reports;
create policy "public reads published reports" on public.reports for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "admins create reports" on public.reports for insert to authenticated with check (public.is_admin());
create policy "admins update reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete reports" on public.reports for delete to authenticated using (public.is_admin());
drop policy if exists "rcc guard reports read" on public.reports;
create policy "rcc guard reports read" on public.reports as restrictive for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists "rcc guard reports insert" on public.reports;
create policy "rcc guard reports insert" on public.reports as restrictive for insert to anon, authenticated with check (public.is_admin());
drop policy if exists "rcc guard reports update" on public.reports;
create policy "rcc guard reports update" on public.reports as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rcc guard reports delete" on public.reports;
create policy "rcc guard reports delete" on public.reports as restrictive for delete to anon, authenticated using (public.is_admin());

drop policy if exists "public reads released media on published reports" on public.report_media;
drop policy if exists "admins add media" on public.report_media;
drop policy if exists "admins update media" on public.report_media;
drop policy if exists "admins delete media" on public.report_media;
create policy "public reads released media on published reports" on public.report_media for select to anon, authenticated using (
  public.is_admin() or (is_public and exists(select 1 from public.reports r where r.id = report_id and r.status = 'published'))
);
create policy "admins add media" on public.report_media for insert to authenticated with check (public.is_admin());
create policy "admins update media" on public.report_media for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete media" on public.report_media for delete to authenticated using (public.is_admin());
drop policy if exists "rcc guard report media read" on public.report_media;
create policy "rcc guard report media read" on public.report_media as restrictive for select to anon, authenticated using (
  public.is_admin() or (is_public and exists(select 1 from public.reports r where r.id = report_id and r.status = 'published'))
);
drop policy if exists "rcc guard report media insert" on public.report_media;
create policy "rcc guard report media insert" on public.report_media as restrictive for insert to anon, authenticated with check (public.is_admin());
drop policy if exists "rcc guard report media update" on public.report_media;
create policy "rcc guard report media update" on public.report_media as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rcc guard report media delete" on public.report_media;
create policy "rcc guard report media delete" on public.report_media as restrictive for delete to anon, authenticated using (public.is_admin());

drop policy if exists "public reads released links on published reports" on public.report_links;
drop policy if exists "admins add report links" on public.report_links;
drop policy if exists "admins update report links" on public.report_links;
drop policy if exists "admins delete report links" on public.report_links;
create policy "public reads released links on published reports" on public.report_links for select to anon, authenticated using (
  public.is_admin() or (is_public and exists(select 1 from public.reports r where r.id = report_id and r.status = 'published'))
);
create policy "admins add report links" on public.report_links for insert to authenticated with check (public.is_admin());
create policy "admins update report links" on public.report_links for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete report links" on public.report_links for delete to authenticated using (public.is_admin());
drop policy if exists "rcc guard report links read" on public.report_links;
create policy "rcc guard report links read" on public.report_links as restrictive for select to anon, authenticated using (
  public.is_admin() or (is_public and exists(select 1 from public.reports r where r.id = report_id and r.status = 'published'))
);
drop policy if exists "rcc guard report links insert" on public.report_links;
create policy "rcc guard report links insert" on public.report_links as restrictive for insert to anon, authenticated with check (public.is_admin());
drop policy if exists "rcc guard report links update" on public.report_links;
create policy "rcc guard report links update" on public.report_links as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rcc guard report links delete" on public.report_links;
create policy "rcc guard report links delete" on public.report_links as restrictive for delete to anon, authenticated using (public.is_admin());

create index if not exists reports_public_date_idx on public.reports(status, activity_date desc);
create index if not exists report_media_report_idx on public.report_media(report_id, sort_order);
create index if not exists report_media_storage_path_idx on public.report_media(storage_path);
create index if not exists report_links_report_idx on public.report_links(report_id, sort_order);

-- Bucket is private. Configure the same limits in Storage settings. Raise the
-- cap only if the Supabase plan allows it and the upload implementation is upgraded.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-media','report-media',false,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict(id) do nothing;

-- Public branding assets are separate from private legacy report uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-assets','site-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/x-icon','image/vnd.microsoft.icon'])
on conflict(id) do nothing;

-- Per-report covers remain private. Server-rendered pages issue short-lived
-- signed URLs only after confirming the report is published (or admin access).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-covers','report-covers',false,5242880,array['image/jpeg','image/png'])
on conflict(id) do nothing;

-- Restrictive storage ceilings prevent any unrelated permissive legacy policy
-- from widening access to the three buckets managed by this site. Policies for
-- other buckets are unaffected. Public site-assets reads are intentionally public.
drop policy if exists "rcc guard managed object read" on storage.objects;
create policy "rcc guard managed object read" on storage.objects as restrictive for select to anon, authenticated using (
  bucket_id not in ('report-media', 'report-covers')
  or public.is_admin()
  or (bucket_id = 'report-media' and exists(
    select 1 from public.report_media m join public.reports r on r.id = m.report_id
    where m.storage_path = name and m.is_public and r.status = 'published'
  ))
  or (bucket_id = 'report-covers' and exists(
    select 1 from public.reports r where r.cover_asset_path = name and r.status = 'published'
  ))
);
drop policy if exists "rcc guard managed object insert" on storage.objects;
create policy "rcc guard managed object insert" on storage.objects as restrictive for insert to anon, authenticated with check (
  bucket_id not in ('site-assets', 'report-media', 'report-covers') or public.is_admin()
);
drop policy if exists "rcc guard managed object update" on storage.objects;
create policy "rcc guard managed object update" on storage.objects as restrictive for update to anon, authenticated using (
  bucket_id not in ('site-assets', 'report-media', 'report-covers') or public.is_admin()
) with check (bucket_id not in ('site-assets', 'report-media', 'report-covers') or public.is_admin());
drop policy if exists "rcc guard managed object delete" on storage.objects;
create policy "rcc guard managed object delete" on storage.objects as restrictive for delete to anon, authenticated using (
  bucket_id not in ('site-assets', 'report-media', 'report-covers') or public.is_admin()
);

drop policy if exists "admins upload media" on storage.objects;
drop policy if exists "admins update media files" on storage.objects;
drop policy if exists "admins delete media files" on storage.objects;
drop policy if exists "public reads media linked to published reports" on storage.objects;
create policy "admins upload media" on storage.objects for insert to authenticated with check (
  bucket_id = 'report-media' and public.is_admin() and (storage.foldername(name))[1] <> ''
);
create policy "admins update media files" on storage.objects for update to authenticated using (bucket_id='report-media' and public.is_admin()) with check (bucket_id='report-media' and public.is_admin());
create policy "admins delete media files" on storage.objects for delete to authenticated using (bucket_id='report-media' and public.is_admin());
create policy "public reads media linked to published reports" on storage.objects for select to anon, authenticated using (
  bucket_id='report-media' and (public.is_admin() or exists(
    select 1 from public.report_media m join public.reports r on r.id=m.report_id
    where m.storage_path=name and m.is_public and r.status='published'
  ))
);

drop policy if exists "public reads site branding assets" on storage.objects;
drop policy if exists "admins upload site branding assets" on storage.objects;
drop policy if exists "admins update site branding assets" on storage.objects;
drop policy if exists "admins delete site branding assets" on storage.objects;
create policy "public reads site branding assets" on storage.objects for select to anon, authenticated using (bucket_id='site-assets');
create policy "admins upload site branding assets" on storage.objects for insert to authenticated with check (bucket_id='site-assets' and public.is_admin());
create policy "admins update site branding assets" on storage.objects for update to authenticated using (bucket_id='site-assets' and public.is_admin()) with check (bucket_id='site-assets' and public.is_admin());
create policy "admins delete site branding assets" on storage.objects for delete to authenticated using (bucket_id='site-assets' and public.is_admin());

drop policy if exists "admins read report covers" on storage.objects;
drop policy if exists "public reads published report covers" on storage.objects;
drop policy if exists "admins upload report covers" on storage.objects;
drop policy if exists "admins update report covers" on storage.objects;
drop policy if exists "admins delete report covers" on storage.objects;
create policy "public reads published report covers" on storage.objects for select to anon, authenticated using (
  bucket_id='report-covers' and (public.is_admin() or exists(
    select 1 from public.reports r where r.cover_asset_path=name and r.status='published'
  ))
);
create policy "admins upload report covers" on storage.objects for insert to authenticated with check (bucket_id='report-covers' and public.is_admin() and (storage.foldername(name))[1]='reports');
create policy "admins update report covers" on storage.objects for update to authenticated using (bucket_id='report-covers' and public.is_admin()) with check (bucket_id='report-covers' and public.is_admin());
create policy "admins delete report covers" on storage.objects for delete to authenticated using (bucket_id='report-covers' and public.is_admin());

-- Update updated_at on each report edit.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists reports_touch_updated_at on public.reports;
create trigger reports_touch_updated_at before update on public.reports for each row execute function public.touch_updated_at();
