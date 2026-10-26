import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { reportLinkLabel } from '@/lib/report-links';
import { defaultSiteSettings, getAssetUrl, loadSiteSettings } from '@/lib/site-settings';
import { getReportCoverUrl } from '@/lib/report-assets';

/* eslint-disable @next/next/no-img-element -- Supabase signed URLs are intentionally served directly so a Next image cache cannot outlive their expiry. */

export default async function AdminPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [settings, { data: report }] = await Promise.all([
    loadSiteSettings(supabase).catch(() => defaultSiteSettings),
    supabase.from('reports').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!report) notFound();

  const [{ data: media }, { data: links }] = await Promise.all([
    supabase.from('report_media').select('*').eq('report_id', report.id).order('sort_order'),
    supabase.from('report_links').select('*').eq('report_id', report.id).order('sort_order'),
  ]);
  const items = await Promise.all((media ?? []).map(async (item) => {
    const { data } = await supabase.storage.from('report-media').createSignedUrl(item.storage_path, 900);
    return { ...item, url: data?.signedUrl };
  }));

  let cover = await getReportCoverUrl(supabase, report.cover_asset_path, report.id);
  if (!cover && report.cover_path) {
    const { data } = await supabase.storage.from('report-media').createSignedUrl(report.cover_path, 900);
    cover = data?.signedUrl ?? null;
  }
  cover ??= getAssetUrl(settings.defaultReportCoverPath);

  return (
    <>
      <div className="preview-banner">Aperçu privé · {report.status === 'published' ? 'Publié' : 'Brouillon'} — non visible aux visiteurs</div>
      <header className="bar admin-bar">
        <Link href={`/admin?id=${report.id}`}>← Retour à la modification</Link>
        <Link className="button button-quiet" href={`/api/reports/${report.id}/pdf`}>Télécharger l’aperçu PDF</Link>
      </header>
      <main className="public-detail wrap">
        {cover && <div className="detail-cover"><img src={cover} alt={`Couverture : ${report.title}`} /></div>}
        <h1>{report.title}</h1>
        <p className="detail-kicker">{report.activity_date} · {report.location}</p>
        <p className="detail-summary">{report.summary}</p>
        {report.body && <article className="report-body"><h2>Rapport</h2><div><p style={{ whiteSpace: 'pre-wrap' }}>{report.body}</p></div></article>}
        <h2>Galerie legacy</h2>
        <div className="media-grid">{items.filter((item) => item.url && item.media_type === 'photo').map((item) => <img key={item.id} src={item.url!} alt={item.caption ?? ''} />)}</div>
        <div className="media-grid">{items.filter((item) => item.url && item.media_type === 'video').map((item) => <video key={item.id} src={item.url!} controls preload="metadata" />)}</div>
        {links && links.length > 0 && <section>
          <h2>Liens partagés</h2>
          <p>L’accès configuré auprès de Google ou YouTube n’est pas vérifiable depuis ce site. Contrôlez le partage avec une session visiteur.</p>
          {links.map((link) => <p key={link.id}>{link.is_public ? 'Affiché sur le site — accès externe à vérifier' : 'Privé — masqué aux visiteurs'} · <a href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel(link.media_type)} : {link.title}</a></p>)}
        </section>}
        <h2>Témoignages autorisés</h2>
        {items.filter((item) => item.is_testimonial && item.is_public && item.caption).map((item) => <blockquote key={item.id}>{item.caption}</blockquote>)}
      </main>
    </>
  );
}
