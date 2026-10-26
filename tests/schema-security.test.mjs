import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/MIGRATION.md', import.meta.url), 'utf8');

test('existing bucket visibility is guarded and never upserted', () => {
  const guardEnd = sql.indexOf('create extension if not exists pgcrypto;');
  assert.ok(guardEnd > 0);
  const guard = sql.slice(0, guardEnd);
  assert.match(guard, /site-assets already exists as a PRIVATE bucket/i);
  assert.match(guard, /report-covers already exists as a PUBLIC bucket/i);
  assert.match(guard, /report-media already exists as a PUBLIC bucket/i);
  assert.equal((sql.match(/on conflict\s*\(id\)\s*do nothing/gi) ?? []).length, 3);
  assert.doesNotMatch(sql, /on conflict\s*\(id\)\s*do update/i);
});

test('explicit grants preserve app operations while preventing public/admin membership writes', () => {
  assert.match(sql, /revoke insert, update, delete on table public\.admin_users from public, anon, authenticated/i);
  assert.match(sql, /grant select on table public\.admin_users to authenticated/i);
  assert.match(sql, /grant select on table public\.reports, public\.report_media, public\.report_links to anon, authenticated/i);
  assert.match(sql, /grant insert, update, delete on table public\.reports, public\.report_media, public\.report_links to authenticated/i);
  assert.match(sql, /grant insert, update on table public\.site_settings to authenticated/i);
  assert.match(sql, /revoke select on table public\.reports, public\.report_media, public\.report_links, public\.site_settings from public/i);
});

test('restrictive table policies limit anonymous reads and all non-admin writes', () => {
  for (const table of ['reports', 'report_media', 'report_links']) {
    assert.match(sql, new RegExp(`create policy \\\"rcc guard ${table === 'reports' ? 'reports' : table === 'report_media' ? 'report media' : 'report links'} read\\\" on public\\.${table} as restrictive`, 'i'));
  }
  assert.match(sql, /status = 'published' or public\.is_admin\(\)/i);
  assert.match(sql, /is_public and exists\(select 1 from public\.reports r where r\.id = report_id and r\.status = 'published'\)/i);
  assert.match(sql, /create policy "rcc guard site settings update" on public\.site_settings as restrictive/i);
});

test('restrictive Storage policies keep report files private and managed writes admin-only', () => {
  assert.match(sql, /create policy "rcc guard managed object read" on storage\.objects as restrictive/i);
  assert.match(sql, /bucket_id = 'report-covers' and exists\(\s*select 1 from public\.reports r where r\.cover_asset_path = name and r\.status = 'published'/i);
  for (const action of ['insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`create policy \\\"rcc guard managed object ${action}\\\" on storage\\.objects as restrictive`, 'i'));
  }
});

test('migration is non-destructive and documents manual checks and user-role tests', () => {
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\s+table\b|\bdelete\s+from\b/i);
  assert.match(migration, /Conditions d'arrêt \/ décision manuelle/i);
  assert.match(migration, /anon/i);
  assert.match(migration, /Auth non-admin/i);
  assert.match(migration, /admin/i);
  assert.match(migration, /aucun accès à une instance Supabase n'a été tenté/i);
});
