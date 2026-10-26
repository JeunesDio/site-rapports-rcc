import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getAssetUrl, type SiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';

export async function getPublishedReports(client: SupabaseClient<Database>, settings: SiteSettings) {
  const { data } = await client.from('reports').select('id,title,activity_date,location,summary,cover_path,cover_asset_path').eq('status','published').order('activity_date',{ascending:false});
  return Promise.all((data??[]).map(async report=>{
    let image=await getReportCoverUrl(client,report.cover_asset_path,report.id);
    if(!image&&report.cover_path){const {data:cover}=await client.storage.from('report-media').createSignedUrl(report.cover_path,900);image=cover?.signedUrl??null;}
    image??=getAssetUrl(settings.defaultReportCoverPath);
    return {...report,image};
  }));
}
