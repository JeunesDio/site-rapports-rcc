import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultSiteSettings, loadSiteSettings } from '@/lib/site-settings';
import { getPublishedReports } from '@/lib/public-reports';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import { ReportCard } from '@/components/report-card';

export default async function ReportsPage() {
  const supabase=await createClient();const settings=await loadSiteSettings(supabase).catch(()=>defaultSiteSettings);const reports=await getPublishedReports(supabase,settings);
  return <><SiteHeader settings={settings}/><main className="wrap public-list-page"><div className="page-masthead page-masthead-simple"><div><span className="eyebrow">Mémoire et témoignage</span><h1>Rapports publiés</h1><p>Consultez les comptes rendus et téléchargez leur version PDF.</p></div></div>
    {reports.length?<div className="reports-with-pdf">{reports.map(report=><article key={report.id} className="report-with-pdf"><ReportCard report={report}/><Link className="pdf-download" href={`/api/reports/${report.id}/pdf`}>Télécharger le PDF <span aria-hidden="true">↓</span></Link></article>)}</div>:<div className="empty-state"><span className="empty-mark">R</span><h2>Aucun rapport publié</h2><p>Les rapports seront disponibles ici après validation par l’administration.</p></div>}
  </main><SiteFooter settings={settings}/></>;
}
