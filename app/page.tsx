import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import { ReportCard, type ReportSummary } from '@/components/report-card';

/* eslint-disable @next/next/no-img-element -- Supabase object URLs are dynamic user-managed assets; CSS sizing and native lazy loading keep them responsive without stale signed-URL image optimization. */

export default async function Home() {
  const supabase = await createClient();
  const [settings, reportResult] = await Promise.all([
    loadSiteSettings(supabase).catch(() => defaultSiteSettings),
    supabase.from('reports').select('id,title,activity_date,location,summary,cover_path,cover_asset_path').eq('status','published').order('activity_date',{ascending:false}),
  ]);
  const reports = reportResult.data ?? [];
  const cards: ReportSummary[] = await Promise.all(reports.slice(0,3).map(async report=>{
    let image = await getReportCoverUrl(supabase,report.cover_asset_path,report.id);
    if (!image && report.cover_path) {
      const {data}=await supabase.storage.from('report-media').createSignedUrl(report.cover_path,900);
      image=data?.signedUrl??null;
    }
    image ??=getAssetUrl(settings.defaultReportCoverPath);
    return {...report,image};
  }));
  const reportIds=reports.slice(0,12).map(report=>report.id);
  const {data:links}=reportIds.length ? await supabase.from('report_links').select('id,report_id,media_type,title,url').in('report_id',reportIds).eq('is_public',true).order('created_at',{ascending:false}) : {data:[]};
  const photos=(links??[]).filter(link=>link.media_type==='photos_album');
  const videos=(links??[]).filter(link=>link.media_type==='drive_video'||link.media_type==='youtube_video');
  const hero=getAssetUrl(settings.homeCoverPath);
  const activitiesImage=getAssetUrl(settings.activitiesImagePath);
  const galleryImage=getAssetUrl(settings.galleryImagePath);
  const videosImage=getAssetUrl(settings.videosImagePath);

  return <><SiteHeader settings={settings}/>
    <main>
      <section className={`home-hero${hero?' has-photo':''}`} style={hero?{'--hero-image':`url("${hero}")` } as React.CSSProperties:undefined}>
        <div className="hero-grain" aria-hidden="true"/>
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow"><span/> {settings.tagline}</div>
          <h1>{settings.siteTitle}<br/><em>au cœur du diocèse.</em></h1>
          <p>Retrouvez les activités et les rapports publiés par le {settings.organizationName}.</p>
          <div className="hero-actions"><Link className="button button-light" href="/activites">Découvrir les activités <span aria-hidden="true">↗</span></Link><Link className="hero-secondary-link" href="/rapports">Consulter les rapports</Link></div>
          {hero&&<small className="image-caption">Image d’illustration</small>}
        </div>
        <div className="hero-side-note"><span>01</span><span>Foi · Fraternité · Mission</span></div>
        <div className="hero-shape" aria-hidden="true"><span/><span/><span/></div>
      </section>

      <section className="section-block section-activities" id="activites">
        <div className="section-topline"><span className="eyebrow">La vie du diocèse</span><span className="section-line"/></div>
        <div className="section-heading section-heading-wide"><div><h2>Activités récentes</h2><p>Les dernières activités rendues publiques.</p></div><Link className="text-link" href="/activites">Toutes les activités <span aria-hidden="true">↗</span></Link></div>
        {activitiesImage&&<div className="section-image-ribbon"><img src={activitiesImage} alt="Illustration de la section activités" loading="lazy"/></div>}
        {cards.length ? <div className="activity-grid">{cards.map(report=><ReportCard key={report.id} report={report}/>)}</div> : <div className="empty-state"><span className="empty-mark">✳</span><h3>Les activités paraîtront ici</h3><p>Aucun contenu n’a encore été publié. Revenez bientôt pour découvrir les nouvelles du diocèse.</p></div>}
      </section>

      <section className="latest-reports-section">
        <div className="latest-reports-inner"><div className="section-topline"><span className="eyebrow">Garder une trace</span><span className="section-line"/></div>
          <div className="section-heading section-heading-wide"><div><h2>Derniers rapports publiés</h2><p>Lire le compte rendu ou télécharger sa version PDF.</p></div><Link className="text-link" href="/rapports">Tous les rapports <span aria-hidden="true">↗</span></Link></div>
          {reports.length ? <div className="latest-report-list">{reports.slice(0,4).map(report=><article key={report.id} className="latest-report-row"><div className="report-date-tile"><span>{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR',{day:'2-digit'})}</span><small>{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR',{month:'short',year:'numeric'})}</small></div><div className="latest-report-title"><h3><Link href={`/rapports/${report.id}`}>{report.title}</Link></h3><p>{report.location||settings.organizationName}</p></div><div className="latest-report-actions"><Link href={`/rapports/${report.id}`}>Lire le rapport</Link><a href={`/api/reports/${report.id}/pdf`} aria-label={`Télécharger le PDF : ${report.title}`}>PDF ↓</a></div></article>)}</div> : <div className="empty-state empty-state-light"><h3>Aucun rapport publié pour le moment</h3><p>Les rapports apparaîtront ici après leur publication.</p></div>}
        </div>
      </section>

      <section className="media-hub section-block">
        <div className="section-topline"><span className="eyebrow">En images et en récits</span><span className="section-line"/></div>
        <div className="section-heading"><h2>Revivez les temps forts</h2><p>Parcourez les albums et vidéos partagés avec le public.</p></div>
        <div className="media-hub-grid">
          <Link className="media-feature media-feature-photos" href="/galerie">{galleryImage&&<img src={galleryImage} alt="" loading="lazy"/>}<span className="media-feature-tint"/><span className="media-feature-content"><small>Galerie · {photos.length} album{photos.length===1?'':'s'}</small><strong>Photos des activités</strong><span>Explorer les albums <b aria-hidden="true">↗</b></span></span></Link>
          <Link className="media-feature media-feature-videos" href="/videos">{videosImage&&<img src={videosImage} alt="" loading="lazy"/>}<span className="media-feature-tint"/><span className="media-feature-content"><small>Vidéos · {videos.length} lien{videos.length===1?'':'s'}</small><strong>Voir et partager</strong><span>Accéder aux vidéos <b aria-hidden="true">↗</b></span></span></Link>
        </div>
      </section>
    </main>
    <SiteFooter settings={settings}/>
  </>;
}
