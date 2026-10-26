import type { Database, Json } from '@/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ColorPreset = 'forest' | 'evergreen' | 'olive';
export const colorPresets: Record<ColorPreset, { label: string; primary: string; deep: string; gold: string; pale: string }> = {
  forest: { label: 'Forêt & or', primary: '#174a38', deep: '#0c3025', gold: '#c49b4f', pale: '#eef3ed' },
  evergreen: { label: 'Émeraude & or', primary: '#145b45', deep: '#0a3c30', gold: '#d0ab61', pale: '#edf5f0' },
  olive: { label: 'Olive & ivoire', primary: '#52613a', deep: '#303c25', gold: '#b8914e', pale: '#f4f3e9' },
};

export type SiteSettings = {
  organizationName: string;
  siteTitle: string;
  tagline: string;
  footerContact: string;
  colorPreset: ColorPreset;
  primaryLogoPath: string | null;
  secondaryLogoPath: string | null;
  faviconPath: string | null;
  homeCoverPath: string | null;
  activitiesImagePath: string | null;
  galleryImagePath: string | null;
  videosImagePath: string | null;
  reportOrganizationName: string;
  reportTitle: string;
  reportFooter: string;
  reportLogoPath: string | null;
  reportHeaderPath: string | null;
  defaultReportCoverPath: string | null;
};

export const defaultSiteSettings: SiteSettings = {
  organizationName: 'Diocèse des Jeunes RCC de Cotonou',
  siteTitle: 'Rapports d’activités',
  tagline: 'Renouveau Charismatique Catholique · Cotonou',
  footerContact: '',
  colorPreset: 'forest',
  primaryLogoPath: null,
  secondaryLogoPath: null,
  faviconPath: null,
  homeCoverPath: null,
  activitiesImagePath: null,
  galleryImagePath: null,
  videosImagePath: null,
  reportOrganizationName: 'Diocèse des Jeunes RCC de Cotonou',
  reportTitle: 'Rapport d’activité',
  reportFooter: '',
  reportLogoPath: null,
  reportHeaderPath: null,
  defaultReportCoverPath: null,
};

const textKeys = ['organizationName', 'siteTitle', 'tagline', 'footerContact', 'reportOrganizationName', 'reportTitle', 'reportFooter'] as const;
const pathKeys = ['primaryLogoPath', 'secondaryLogoPath', 'faviconPath', 'homeCoverPath', 'activitiesImagePath', 'galleryImagePath', 'videosImagePath', 'reportLogoPath', 'reportHeaderPath', 'defaultReportCoverPath'] as const;
export type SiteAssetKey = (typeof pathKeys)[number];

export function isSiteAssetPath(value: unknown): value is string {
  return typeof value === 'string' && /^site\/[a-z-]+\/[a-f0-9-]+\.(?:webp|png|jpe?g|ico)$/i.test(value) && !value.includes('..');
}

export function isReportAssetPath(value: unknown, reportId: string): value is string {
  return typeof value === 'string' && value.startsWith(`reports/${reportId}/`) && /^reports\/[a-f0-9-]+\/[a-f0-9-]+\.(?:png|jpe?g)$/i.test(value);
}

export function normalizeSiteSettings(value: unknown): SiteSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const settings = { ...defaultSiteSettings };
  for (const key of textKeys) {
    const candidate = source[key];
    if (typeof candidate === 'string') settings[key] = candidate.slice(0, key === 'footerContact' || key === 'reportFooter' ? 500 : 160);
  }
  const preset = source.colorPreset;
  if (preset === 'forest' || preset === 'evergreen' || preset === 'olive') settings.colorPreset = preset;
  for (const key of pathKeys) {
    const candidate = source[key];
    settings[key] = isSiteAssetPath(candidate) ? candidate : null;
  }
  return settings;
}

export function siteSettingsJson(settings: SiteSettings): Json {
  return settings as unknown as Json;
}

export function getAssetUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !isSiteAssetPath(path) || !base) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/site-assets/${encoded}`;
}

export async function loadSiteSettings(client: SupabaseClient<Database>): Promise<SiteSettings> {
  const { data } = await client.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
  return normalizeSiteSettings(data?.settings);
}
