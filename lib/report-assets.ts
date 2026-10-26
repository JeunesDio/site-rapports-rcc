import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isReportAssetPath } from '@/lib/site-settings';

export async function getReportCoverUrl(client: SupabaseClient<Database>, path: string | null, reportId: string, expiresIn = 900) {
  if (!path || !isReportAssetPath(path, reportId)) return null;
  const { data, error } = await client.storage.from('report-covers').createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}
