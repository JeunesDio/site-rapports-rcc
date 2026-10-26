import './styles.css';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { colorPresets, defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  let settings = defaultSiteSettings;
  try { settings = await loadSiteSettings(await createClient()); } catch { /* Keep default metadata if Supabase is unavailable. */ }
  return {
    title: `${settings.siteTitle} | ${settings.organizationName}`,
    description: settings.tagline,
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let settings = defaultSiteSettings;
  try { settings = await loadSiteSettings(await createClient()); } catch { /* Keep the site shell renderable when optional branding is not configured. */ }
  const palette = colorPresets[settings.colorPreset];
  const favicon = getAssetUrl(settings.faviconPath);
  const style = { '--brand': palette.primary, '--brand-deep': palette.deep, '--gold': palette.gold, '--brand-pale': palette.pale } as CSSProperties;
  return <html lang="fr"><head>{favicon&&<link rel="icon" href={favicon}/>}</head><body style={style}>{children}</body></html>;
}
