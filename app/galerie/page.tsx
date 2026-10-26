import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

/* eslint-disable @next/next/no-img-element -- Supabase signed media URLs require direct responsive rendering. */

export default async function GalleryPage() {
  const supabase=await createClient();const settings=await loadSiteSettings(supabase).catch(()=>defaultSiteSettings);
  const {data:reports}=await supabase.from('reports').select('id,title,activity_date').eq('status','published').order('activity_date',{ascending:false});
  const ids=(reports??[]).map(report=>report.id);const reportById=new Map((reports??[]).map(report=>[report.id,report]));
  const [{data:albums},{data:legacy}]=ids.length?await Promise.all([
    supabase.from('report_links').select('id,report_id,title,url').eq('media_type','photos_album').eq('is_public',true).in('report_id',ids).order('created_at',{ascending:false}),
    supabase.from('report_media').select('id,report_id,file_name,caption,storage_path,media_type').eq('media_type','photo').eq('is_public',true).in('report_id',ids).order('sort_order'),
  ]):[{data:[]},{data:[]}];
  const images=await Promise.all((legacy??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl,report:reportById.get(item.report_id)};}));
  const banner=getAssetUrl(settings.galleryImagePath);
  return <><SiteHeader settings={settings}/><main className="wrap public-list-page"><div className="page-masthead">{banner&&<img src={banner} alt="" loading="lazy"/>}<div><span className="eyebrow">Souvenirs partagés</span><h1>Galerie photos</h1><p>Albums et images partagés sur les activités publiées.</p></div></div>
    {albums?.length||images.some(item=>item.url)?<div className="gallery-content">{albums&&albums.length>0&&<section><div className="section-heading"><h2>Albums</h2><p>Les albums s’ouvrent sur le service de partage d’origine.</p></div><div className="album-grid">{albums.map(album=><article className="album-card" key={album.id}><span className="album-icon" aria-hidden="true">◈</span><div><small>{reportById.get(album.report_id)?.activity_date}</small><h3>{album.title}</h3><p>{reportById.get(album.report_id)?.title}</p></div><a href={album.url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir l’album ${album.title}`}>Voir l’album ↗</a></article>)}</div></section>}{images.some(item=>item.url)&&<section className="legacy-gallery"><div className="section-heading"><h2>Photos intégrées</h2><p>Images déjà conservées dans l’espace privé historique.</p></div><div className="gallery-grid">{images.filter(item=>item.url).map(item=><figure key={item.id}><img src={item.url!} alt={item.caption??item.file_name} loading="lazy" decoding="async"/><figcaption><strong>{item.caption||item.report?.title}</strong><Link href={`/activites/${item.report?.id}`}>Voir l’activité</Link></figcaption></figure>)}</div></section>}</div>:<div className="empty-state"><span className="empty-mark">◈</span><h2>Aucune photo publiée</h2><p>Les albums et photos apparaîtront ici lorsqu’ils auront été partagés avec le public.</p></div>}
  </main><SiteFooter settings={settings}/></>;
}
