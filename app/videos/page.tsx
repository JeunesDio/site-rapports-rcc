import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

/* eslint-disable @next/next/no-img-element -- Existing private video media is served through short-lived signed URLs. */

export default async function VideosPage() {
  const supabase=await createClient();const settings=await loadSiteSettings(supabase).catch(()=>defaultSiteSettings);
  const {data:reports}=await supabase.from('reports').select('id,title,activity_date').eq('status','published').order('activity_date',{ascending:false});
  const ids=(reports??[]).map(report=>report.id);const reportById=new Map((reports??[]).map(report=>[report.id,report]));
  const [{data:links},{data:legacy}]=ids.length?await Promise.all([
    supabase.from('report_links').select('id,report_id,title,url,media_type').eq('is_public',true).in('media_type',['drive_video','youtube_video']).in('report_id',ids).order('created_at',{ascending:false}),
    supabase.from('report_media').select('id,report_id,file_name,storage_path').eq('media_type','video').eq('is_public',true).in('report_id',ids).order('sort_order'),
  ]):[{data:[]},{data:[]}];
  const clips=await Promise.all((legacy??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl,report:reportById.get(item.report_id)};}));
  const banner=getAssetUrl(settings.videosImagePath);
  return <><SiteHeader settings={settings}/><main className="wrap public-list-page"><div className="page-masthead">{banner&&<img src={banner} alt="" loading="lazy"/>}<div><span className="eyebrow">Images en mouvement</span><h1>Vidéos</h1><p>Retrouvez les vidéos et enregistrements partagés avec le public.</p></div></div>
    {links?.length||clips.some(item=>item.url)?<div className="video-library">{links?.map(link=><article className="video-link-card" key={link.id}><span className="video-play" aria-hidden="true">▶</span><div><small>{reportById.get(link.report_id)?.title} · {link.media_type==='youtube_video'?'YouTube':'Google Drive'}</small><h2>{link.title}</h2></div><a className="button button-outline" href={link.url} target="_blank" rel="noopener noreferrer">Regarder la vidéo ↗</a></article>)}{clips.filter(item=>item.url).map(item=><article className="legacy-video-card" key={item.id}><video src={item.url!} controls preload="metadata" aria-label={item.file_name}/><div><h2>{item.report?.title}</h2><Link href={`/activites/${item.report?.id}`}>Voir l’activité ↗</Link></div></article>)}</div>:<div className="empty-state"><span className="empty-mark">▷</span><h2>Aucune vidéo publiée</h2><p>Les vidéos apparaîtront ici lorsque des liens autorisés auront été ajoutés.</p></div>}
  </main><SiteFooter settings={settings}/></>;
}
