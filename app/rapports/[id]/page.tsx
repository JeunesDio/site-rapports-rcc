import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';
import { reportLinkLabel } from '@/lib/report-links';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

/* eslint-disable @next/next/no-img-element -- Images are public or signed Supabase URLs with responsive CSS sizing. */

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [settings, reportResult] = await Promise.all([
    loadSiteSettings(supabase).catch(() => defaultSiteSettings),
    supabase.from('reports').select('*').eq('id',id).eq('status','published').maybeSingle(),
  ]);
  const report = reportResult.data;
  if (!report) notFound();
  const [{data:media}, {data:links}] = await Promise.all([
    supabase.from('report_media').select('*').eq('report_id',report.id).eq('is_public',true).order('sort_order'),
    supabase.from('report_links').select('id,media_type,title,url').eq('report_id',report.id).eq('is_public',true).order('sort_order'),
  ]);
  const items=await Promise.all((media??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl};}));
  let cover=await getReportCoverUrl(supabase,report.cover_asset_path,report.id);
  if(!cover&&report.cover_path){const {data}=await supabase.storage.from('report-media').createSignedUrl(report.cover_path,900);cover=data?.signedUrl??null;}
  cover??=getAssetUrl(settings.defaultReportCoverPath);
  const photos=(links??[]).filter(item=>item.media_type==='photos_album');
  const videos=(links??[]).filter(item=>item.media_type==='drive_video'||item.media_type==='youtube_video');
  const docs=(links??[]).filter(item=>item.media_type==='drive_document');

  return <><SiteHeader settings={settings}/><main className="public-detail wrap">
    <Link className="back-link" href="/rapports">← Tous les rapports</Link>
    {cover&&<div className="detail-cover"><img src={cover} alt={`Couverture : ${report.title}`} fetchPriority="high"/></div>}
    <div className="detail-kicker">{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}{report.location&&` · ${report.location}`}</div>
    <h1>{report.title}</h1><p className="detail-summary">{report.summary}</p>
    <div className="detail-actions"><Link className="button" href={`/api/reports/${report.id}/pdf`}>Télécharger le rapport PDF <span aria-hidden="true">↓</span></Link><Link className="button button-quiet" href={`/activites/${report.id}`}>Voir l’activité</Link></div>
    {report.body&&<article className="report-body"><h2>Le rapport</h2><div>{report.body.split(/\r?\n/).map((line,index)=><p key={index}>{line||' '}</p>)}</div></article>}
    {items.some(item=>item.url&&(item.media_type==='photo'||item.media_type==='video'))&&<section className="detail-media"><div className="section-topline"><span className="eyebrow">Archives visuelles</span><span className="section-line"/></div><h2>Photos et vidéos</h2><div className="media-grid">{items.filter(item=>item.url&&item.media_type==='photo').map(item=><img key={item.id} src={item.url!} alt={item.caption??''} loading="lazy" decoding="async"/>)}{items.filter(item=>item.url&&item.media_type==='video').map(item=><video key={item.id} src={item.url!} controls preload="metadata" aria-label={item.file_name}/>)}</div></section>}
    {photos.length>0&&<section className="external-link-section"><h2>Albums photos</h2><div className="detail-actions">{photos.map(link=><a className="button button-outline" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">Voir les photos{photos.length>1?`: ${link.title}`:''}</a>)}</div></section>}
    {videos.length>0&&<section className="external-link-section"><h2>Vidéos</h2><div className="detail-actions">{videos.map(link=><a className="button button-outline" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel(link.media_type)} · {link.title}</a>)}</div></section>}
    {docs.length>0&&<section className="external-link-section"><h2>Documents complémentaires</h2><div className="detail-actions">{docs.map(link=><a className="button button-outline" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">Consulter les documents · {link.title}</a>)}</div></section>}
    {items.some(item=>item.is_testimonial&&item.caption)&&<section className="report-testimonials"><h2>Témoignages autorisés</h2>{items.filter(item=>item.is_testimonial&&item.caption).map(item=><blockquote key={item.id}>{item.caption}</blockquote>)}</section>}
  </main><SiteFooter settings={settings}/></>;
}
