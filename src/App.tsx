import { useEffect, useMemo, useState } from 'react';
import reportsData from './data/reports.json';
import ReportForm from './components/report-form';
import { validatePublishedReports, type PublishedReport } from './lib/report';
import { publicAsset, reportPdfUrl } from './lib/site';
import { BRANDING } from './data/branding';

const reports = validatePublishedReports(reportsData);
const diocesanLogo = publicAsset(BRANDING.logos.archdiocese);
const renewalLogo = publicAsset(BRANDING.logos.renewal);

function routeFromHash() {
  return window.location.hash.replace(/^#/, '') || '/';
}

function SiteHeader() {
  return <header className="site-header">
    <a className="identity" href="#/" aria-label="Accueil du Service Jeune RCCC">
      <img className="identity-logo" src={diocesanLogo} alt="Logo de l’Archidiocèse de Cotonou" />
      <span className="identity-text"><strong>{BRANDING.mentions.archdiocese}</strong><b>{BRANDING.mentions.prayerGroup}</b><span>{BRANDING.mentions.service}</span></span>
      <img className="identity-logo identity-logo-secondary" src={renewalLogo} alt="Emblème du Renouveau Charismatique" />
    </a>
    <nav aria-label="Navigation principale">
      <a href="#/">Accueil</a><a href="#/rapports">Rapports</a><a className="nav-action" href="#/nouveau">Créer un rapport</a>
    </nav>
  </header>;
}

function SiteFooter() {
  return <footer className="site-footer"><span>Service Jeune du Renouveau Charismatique Catholique de Cotonou</span><span>Foi · Fraternité · Mission</span></footer>;
}

function ReportCard({ report }: { report: PublishedReport }) {
  const date = new Date(`${report.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return <article className="report-card">
    <div className="report-card-date">{date}</div>
    <h3><a href={`#/rapport/${encodeURIComponent(report.id)}`}>{report.title}</a></h3>
    {report.place && <p className="report-place">{report.place}</p>}
    {report.summary && <p>{report.summary}</p>}
    <div className="report-card-actions"><a className="text-action" href={`#/rapport/${encodeURIComponent(report.id)}`}>Consulter le rapport <span aria-hidden="true">→</span></a><a className="pdf-action" href={reportPdfUrl(report.pdf)} target="_blank" rel="noopener noreferrer">Télécharger le PDF</a></div>
  </article>;
}

function HomePage() {
  const recent = useMemo(() => [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), []);
  return <main>
    <section className="hero">
      <div className="eyebrow">SERVICE JEUNE RCCC · COTONOU</div>
      <h1>Servir, témoigner,<br /><em>faire grandir la foi.</em></h1>
      <p>Retrouvez les comptes rendus des activités du Service Jeune du Renouveau Charismatique Catholique de Cotonou.</p>
      <div className="hero-actions"><a className="button" href="#/rapports">Consulter les rapports</a><a className="button button-light" href="#/nouveau">Créer un rapport</a></div>
      <div className="hero-note">Chaque rapport est relu par un responsable avant sa publication sur ce site.</div>
    </section>
    <section className="content-section">
      <div className="section-heading"><div><div className="eyebrow">La mémoire de nos activités</div><h2>Rapports publiés</h2></div><a href="#/rapports" className="text-action">Tous les rapports <span aria-hidden="true">→</span></a></div>
      {recent.length ? <div className="report-grid">{recent.map((report) => <ReportCard report={report} key={report.id} />)}</div> : <div className="empty-state"><span className="empty-symbol">✳</span><h3>Aucun rapport publié pour le moment</h3><p>Les rapports validés apparaîtront ici après leur ajout au dépôt du site.</p><a className="text-action" href="#/rapports">Voir la liste des rapports</a></div>}
    </section>
  </main>;
}

function ReportsPage() {
  const ordered = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  return <main className="content-section page-content"><div className="eyebrow">Archives d’activités</div><h1>Rapports publiés</h1><p className="page-intro">Consultez les comptes rendus et ouvrez les albums photos partagés.</p>
    {ordered.length ? <div className="report-grid">{ordered.map((report) => <ReportCard report={report} key={report.id} />)}</div> : <div className="empty-state"><span className="empty-symbol">R</span><h2>La liste est encore vide</h2><p>Aucun rapport n’a été ajouté à la publication. Revenez bientôt.</p></div>}
  </main>;
}

function ReportDetail({ report }: { report: PublishedReport }) {
  const date = new Date(`${report.date}T00:00:00`).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  return <main className="content-section page-content report-detail"><a className="back-link" href="#/rapports">← Tous les rapports</a><div className="eyebrow">Compte rendu d’activité</div><h1>{report.title}</h1><p className="detail-meta">{date}{report.place ? ` · ${report.place}` : ''}</p>{report.summary && <p className="detail-summary">{report.summary}</p>}
    <div className="detail-actions"><a className="button" href={reportPdfUrl(report.pdf)} target="_blank" rel="noopener noreferrer">Télécharger le rapport PDF</a>{report.photoAlbumUrl && <a className="button button-light" href={report.photoAlbumUrl} target="_blank" rel="noopener noreferrer">Voir l’album Google Photos</a>}</div>
    <div className="public-info"><strong>Rapport publié</strong><p>La version détaillée est disponible dans le PDF. Les albums photos restent hébergés sur Google Photos.</p></div>
  </main>;
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  let content;
  if (route === '/nouveau') content = <ReportForm />;
  else if (route === '/rapports') content = <ReportsPage />;
  else if (route.startsWith('/rapport/')) {
    const id = decodeURIComponent(route.slice('/rapport/'.length));
    const report = reports.find((entry) => entry.id === id);
    content = report ? <ReportDetail report={report} /> : <main className="content-section page-content"><h1>Rapport introuvable</h1><a href="#/rapports">Retour aux rapports</a></main>;
  } else content = <HomePage />;
  return <><SiteHeader />{content}<SiteFooter /></>;
}

