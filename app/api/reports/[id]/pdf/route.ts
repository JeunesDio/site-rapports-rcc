import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { makePdf } from '@/lib/pdf';
import { defaultSiteSettings, loadSiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';

async function readPdfImage(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null | undefined) {
  if (!path) return null;
  const isAllowedSitePath = /^site\/(?:pdf|logos)\/[a-f0-9-]+\.(?:png|jpe?g)$/i.test(path);
  if (!isAllowedSitePath) return null;
  const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(path);
  return readImageUrl(publicUrl);
}

async function readImageUrl(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const mimeType = response.headers.get('content-type')?.split(';')[0];
    const length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || length > 5 * 1024 * 1024 || (mimeType !== 'image/png' && mimeType !== 'image/jpeg')) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) return null;
    return { bytes, mimeType } as const;
  } catch { return null; }
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();let isAdmin=false;let {data:r}=await supabase.from('reports').select('title,activity_date,location,summary,body,cover_path,cover_asset_path').eq('id',id).eq('status','published').maybeSingle();
  if(!r){const {data:{user}}=await supabase.auth.getUser();if(user){const {data:admin}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(admin){const result=await supabase.from('reports').select('title,activity_date,location,summary,body,cover_path,cover_asset_path').eq('id',id).maybeSingle();r=result.data;isAdmin=!!r;}}}
  if(!r)return new NextResponse('Not found',{status:404});
  let linkQuery=supabase.from('report_links').select('media_type,title,url').eq('report_id',id).order('sort_order');if(!isAdmin)linkQuery=linkQuery.eq('is_public',true);const {data:links}=await linkQuery;
  const linkLines=(links??[]).flatMap(link=>[`${link.media_type==='photos_album'?'Photos Google':link.media_type==='drive_video'||link.media_type==='youtube_video'?'Vidéo': 'Document'} : ${link.title}`,link.url,'']);
  const lines=[`Date : ${r.activity_date}`,`Lieu : ${r.location}`,'',r.summary,...(r.body||'').split(/\r?\n/),'',...linkLines];
  const settings=await loadSiteSettings(supabase).catch(()=>defaultSiteSettings);
  const [logo,header]=await Promise.all([
    readPdfImage(supabase,settings.reportLogoPath??settings.primaryLogoPath),
    readPdfImage(supabase,settings.reportHeaderPath),
  ]);
  let ownCover=null;
  const ownCoverUrl=await getReportCoverUrl(supabase,r.cover_asset_path,id);
  if(ownCoverUrl)ownCover=await readImageUrl(ownCoverUrl);
  let cover=ownCover;
  if(!cover&&r.cover_path){const {data}=await supabase.storage.from('report-media').createSignedUrl(r.cover_path,60);if(data?.signedUrl)cover=await readImageUrl(data.signedUrl);}
  if(!cover)cover=await readPdfImage(supabase,settings.defaultReportCoverPath);
  const pdf=await makePdf(r.title,lines,{organizationName:settings.reportOrganizationName,reportTitle:settings.reportTitle,footer:settings.reportFooter,logo,header,cover});
  return new NextResponse(new Uint8Array(pdf), {headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rapport-${id}.pdf"`, "Cache-Control": "private, no-store" }});
}
