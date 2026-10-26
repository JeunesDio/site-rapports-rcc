/* eslint-disable @next/next/no-img-element -- Covers can be signed legacy URLs or Supabase assets from a project-specific host. */
import Link from 'next/link';

export type ReportSummary = { id: string; title: string; activity_date: string; location: string; summary: string; image: string | null };

export function ReportCard({ report }: { report: ReportSummary }) {
  return <article className="activity-card">
    <Link className="activity-image-link" href={`/activites/${report.id}`} aria-label={`Découvrir ${report.title}`}>
      {report.image ? <img className="activity-image" src={report.image} alt="" loading="lazy" decoding="async"/> : <span className="activity-image activity-image-empty"><span>Activité</span></span>}
    </Link>
    <div className="activity-card-body"><div className="activity-meta"><span>{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>{report.location&&<><i aria-hidden="true">·</i><span>{report.location}</span></>}</div>
      <h3><Link href={`/activites/${report.id}`}>{report.title}</Link></h3><p>{report.summary||'Consultez le compte rendu de cette activité.'}</p>
      <Link className="text-link" href={`/activites/${report.id}`}>Découvrir l’activité <span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}
