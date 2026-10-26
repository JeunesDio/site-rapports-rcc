import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import { getPublishedReports } from '@/lib/public-reports';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import { ReportCard } from '@/components/report-card';

/* eslint-disable @next/next/no-img-element -- User-managed and signed asset URLs are sized responsively with CSS. */

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const {year}=await searchParams;const supabase=await createClient();
  const settings=await loadSiteSettings(supabase).catch(()=>defaultSiteSettings);
  const reports=await getPublishedReports(supabase,settings);
  const years=[...new Set(reports.map(report=>report.activity_date.slice(0,4)))];
  const filtered=year&&years.includes(year)?reports.filter(report=>report.activity_date.startsWith(year)):reports;
  const banner=getAssetUrl(settings.activitiesImagePath);
  return <><SiteHeader settings={settings}/><main className="wrap public-list-page">
    <div className="page-masthead">{banner&&<img src={banner} alt="" loading="lazy"/>}<div><span className="eyebrow">Découvrir le diocèse</span><h1>Activités</h1><p>Les activités publiées par le {settings.organizationName}.</p></div></div>
    <div className="filter-bar"><p>{filtered.length} activité{filtered.length===1?'':'s'} publiée{filtered.length===1?'':'s'}</p><form method="get"><label htmlFor="year-filter">Année</label><select id="year-filter" name="year" defaultValue={year??''}><option value="">Toutes les années</option>{years.map(value=><option value={value} key={value}>{value}</option>)}</select><button className="button button-quiet">Filtrer</button></form></div>
    {filtered.length?<div className="activity-grid">{filtered.map(report=><ReportCard key={report.id} report={report}/>)}</div>:<div className="empty-state"><span className="empty-mark">✳</span><h2>{reports.length?'Aucune activité pour cette année':'Aucune activité publiée pour le moment'}</h2><p>{reports.length?'Choisissez une autre année pour consulter les activités.':'Les activités apparaîtront ici après leur publication. Revenez bientôt.'}</p>{reports.length>0&&<Link className="text-link" href="/activites">Effacer le filtre</Link>}</div>}
  </main><SiteFooter settings={settings}/></>;
}
