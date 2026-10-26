'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { isReportAssetPath, isSiteAssetPath, normalizeSiteSettings, siteSettingsJson } from '@/lib/site-settings';
import type { SiteSettings } from '@/lib/site-settings';

function settingsPaths(value: unknown): string[] {
  const settings = normalizeSiteSettings(value);
  return Object.values(settings).filter((value): value is string => isSiteAssetPath(value));
}

function revalidateSite() {
  for (const path of ['/', '/activites', '/rapports', '/galerie', '/videos', '/admin/identite-visuelle']) revalidatePath(path);
}

export async function saveSiteSettings(input: SiteSettings): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireAdmin();
  const next = normalizeSiteSettings(input);
  if (!next.organizationName.trim() || !next.siteTitle.trim() || !next.reportOrganizationName.trim() || !next.reportTitle.trim()) {
    return { ok: false, message: 'Complétez le nom de l’organisation et les titres.' };
  }

  const { data: existing } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
  const { error } = await supabase.from('site_settings').upsert({ id: 'global', settings: siteSettingsJson(next), updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: 'Enregistrement impossible. Vérifiez que la migration SQL a été appliquée.' };

  const oldPaths = [...new Set(settingsPaths(existing?.settings))];
  const keep = new Set(settingsPaths(next));
  const candidates = oldPaths.filter(path => !keep.has(path));
  let cleanupWarning = false;
  if (candidates.length) {
    const { data: reports, error: reportError } = await supabase.from('reports').select('cover_asset_path').in('cover_asset_path', candidates);
    if (reportError) cleanupWarning = true;
    else {
      const referenced = new Set((reports ?? []).map(row => row.cover_asset_path).filter((path): path is string => !!path));
      const removable = candidates.filter(path => !referenced.has(path));
      if (removable.length) {
        const { error: removeError } = await supabase.storage.from('site-assets').remove(removable);
        cleanupWarning = !!removeError;
      }
    }
  }
  revalidateSite();
  return { ok: true, message: cleanupWarning ? 'Paramètres enregistrés. Un ancien fichier encore référencé ou non supprimé a été conservé.' : 'Paramètres enregistrés.' };
}

export async function saveReportCover(reportId: string, path: string | null): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireAdmin();
  if (!reportId || (path !== null && !isReportAssetPath(path, reportId))) return { ok: false, message: 'Image de couverture invalide.' };
  const { data: current, error: readError } = await supabase.from('reports').select('cover_asset_path').eq('id', reportId).maybeSingle();
  if (readError || !current) return { ok: false, message: 'Rapport introuvable. Vérifiez la migration SQL.' };
  const { error } = await supabase.from('reports').update({ cover_asset_path: path }).eq('id', reportId);
  if (error) return { ok: false, message: 'Couverture non enregistrée.' };

  let cleanupWarning = false;
  const oldPath = current.cover_asset_path;
  if (oldPath && oldPath !== path) {
    const { data: otherReports, error: reportsError } = await supabase.from('reports').select('id').eq('cover_asset_path', oldPath).neq('id', reportId).limit(1);
    const { data: siteRow, error: settingsError } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
    if (reportsError || settingsError) cleanupWarning = true;
    else if (!otherReports?.length && !settingsPaths(siteRow?.settings).includes(oldPath)) {
      const { error: removeError } = await supabase.storage.from('report-covers').remove([oldPath]);
      cleanupWarning = !!removeError;
    }
  }
  revalidateSite();
  revalidatePath(`/rapports/${reportId}`);
  revalidatePath(`/activites/${reportId}`);
  revalidatePath(`/api/reports/${reportId}/pdf`);
  return { ok: true, message: cleanupWarning ? 'Couverture enregistrée; l’ancienne image a été conservée car elle peut encore être référencée.' : 'Couverture enregistrée.' };
}
