import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import { reportLinkLabel } from '@/lib/report-links';

/* eslint-disable @next/next/no-img-element -- Dynamic public asset URLs use responsive CSS sizing. */

export default async function ActivityDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;const supabase=await createClient();
  const [settings, reportResult]=await Promise.all([
    loadSiteSettings(supabase).catch(()=>defaultSiteSettings),
    supabase.from('reports').select('*').eq('id',id).eq('status','published').maybeSingle(),
  ]);
  const report=reportResult.data;if(!report)notFound();
  const [{data:links},{data:media}]=await Promise.all([
    supabase.from('report_links').select('id,media_type,title,url').eq('report_id',report.id).eq('is_public',true).order('sort_order'),
    supabase.from('report_media').select('*').eq('report_id',report.id).eq('is_public',true).order('sort_order'),
  ]);
  const oldMedia=await Promise.all((media??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl};}));
  let cover=await getReportCoverUrl(supabase,report.cover_asset_path,report.id);
  if(!cover&&report.cover_path){const {data}=await supabase.storage.from('report-media').createSignedUrl(report.cover_path,900);cover=data?.signedUrl??null;}
  cover??=getAssetUrl(settings.defaultReportCoverPath);
  return <><SiteHeader settings={settings}/><main className="public-detail wrap"><Link className="back-link" href="/activites">← Toutes les activités</Link>
    {cover&&<div className="detail-cover"><img src={cover} alt={`Couverture : ${report.title}`} fetchPriority="high"/></div>}
    <div className="detail-kicker">{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}{report.location&&` · ${report.location}`}</div>
    <span className="eyebrow">Activité publiée</span><h1>{report.title}</h1><p className="detail-summary">{report.summary}</p>
    {report.body&&<article className="report-body"><h2>À propos de cette activité</h2><div>{report.body.split(/\r?\n/).map((line,index)=><p key={index}>{line||' '}</p>)}</div></article>}
    {oldMedia.some(item=>item.url)||links?.length?<section className="detail-media"><h2>Photos et vidéos</h2><div className="media-grid">{oldMedia.map(item=>item.url&&(item.media_type==='photo'?<img key={item.id} src={item.url} alt={item.caption??''} loading="lazy"/>:<video key={item.id} src={item.url} controls preload="metadata"/>))}</div><div className="detail-actions">{(links??[]).filter(link=>link.media_type==='photos_album'||link.media_type==='drive_video'||link.media_type==='youtube_video').map(link=><a className="button button-outline" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel(link.media_type)} · {link.title}</a>)}</div></section>:<div className="empty-state compact-empty"><p>Aucun média n’a été partagé pour cette activité.</p></div>}
    <div className="activity-report-cta"><div><span className="eyebrow">Compte rendu</span><h2>Lire le rapport complet</h2><p>Consultez le détail et téléchargez le document PDF.</p></div><Link className="button" href={`/rapports/${report.id}`}>Consulter le rapport <span aria-hidden="true">↗</span></Link></div>
  </main><SiteFooter settings={settings}/></>;
}
