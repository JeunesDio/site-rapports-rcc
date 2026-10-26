-- Apply in the Supabase SQL Editor. All report media stays in one PRIVATE bucket.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
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
  status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
  media_type text not null check (media_type in ('photos_album','drive_video','drive_document')),
  title text not null check (length(trim(title)) between 1 and 160),
  url text not null check (
    length(url) <= 2048 and
    url ~* '^https://(photos\.google\.com|photos\.app\.goo\.gl|drive\.google\.com|docs\.google\.com)(/|[?#]|$)'
  ),
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
alter table public.report_media enable row level security;
alter table public.report_links enable row level security;
grant select on public.report_links to anon, authenticated;
grant insert, update, delete on public.report_links to authenticated;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "public reads published reports" on public.reports;
drop policy if exists "admins create reports" on public.reports;
drop policy if exists "admins update reports" on public.reports;
drop policy if exists "admins delete reports" on public.reports;
create policy "public reads published reports" on public.reports for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "admins create reports" on public.reports for insert to authenticated with check (public.is_admin());
create policy "admins update reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete reports" on public.reports for delete to authenticated using (public.is_admin());

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

create index if not exists reports_public_date_idx on public.reports(status, activity_date desc);
create index if not exists report_media_report_idx on public.report_media(report_id, sort_order);
create index if not exists report_media_storage_path_idx on public.report_media(storage_path);
create index if not exists report_links_report_idx on public.report_links(report_id, sort_order);

-- Bucket is private. Configure the same limits in Storage settings. Raise the
-- cap only if the Supabase plan allows it and the upload implementation is upgraded.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-media','report-media',false,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict(id) do update set public=false,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;

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

-- Update updated_at on each report edit.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists reports_touch_updated_at on public.reports;
create trigger reports_touch_updated_at before update on public.reports for each row execute function public.touch_updated_at();
