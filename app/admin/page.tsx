import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { saveReport, setPublished, signOut } from './actions';
import Upload from './upload';
import ConfirmDelete from './confirm-delete';
import ReportLinks from './report-links';
import ReportCover from './report-cover';

export default async function Admin({ searchParams }: { searchParams: Promise<{ id?: string; notice?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: reports, error } = await supabase.from('reports').select('id,title,status,activity_date,location,summary,body,cover_path,cover_asset_path').order('updated_at', { ascending: false });
  const selected = params.id ? (reports ?? []).find(report => report.id === params.id) : undefined;
  const { data: media } = selected ? await supabase.from('report_media').select('*').eq('report_id', selected.id).order('sort_order') : { data: null };
  const { data: links } = selected ? await supabase.from('report_links').select('*').eq('report_id', selected.id).order('sort_order') : { data: null };
  const publishedCount = (reports ?? []).filter(report => report.status === 'published').length;
  const draftCount = (reports ?? []).length - publishedCount;

  return <><header className="bar admin-bar"><Link href="/">Site public</Link><strong className="admin-bar-label">Espace d’administration</strong><form action={signOut}><button className="button button-quiet">Déconnexion</button></form></header>
    <main className="wrap admin-wrap">
      <div className="dashboard-heading"><div><div className="eyebrow">Gestion des contenus</div><h1>Tableau de bord</h1><p className="page-intro">Créez, mettez à jour et publiez les rapports d’activités.</p></div><Link className="button" href="/admin">＋ Nouveau rapport</Link></div>
      <nav className="admin-shortcuts" aria-label="Outils d’administration"><Link className="shortcut-card" href="/admin/identite-visuelle"><span className="shortcut-icon">✳</span><span><strong>Identité visuelle et médias</strong><small>Logos, couvertures et modèle PDF</small></span><span aria-hidden="true">→</span></Link></nav>
      <section className="dashboard-stats" aria-label="Résumé des rapports"><div><span>Rapports publiés</span><strong>{publishedCount}</strong></div><div><span>Brouillons</span><strong>{draftCount}</strong></div><div><span>Total des contenus</span><strong>{reports?.length ?? 0}</strong></div></section>
      {params.notice&&<p role="status" className="form-success">Action effectuée.</p>}
      {params.error&&<p role="alert" className="form-error">{params.error==='link'?'Lien non enregistré : vérifiez le titre, le type et une URL HTTPS autorisée.':'Une erreur est survenue. Vérifiez les champs et la migration Supabase.'}</p>}
      {error&&<div className="security-note"><strong>Le tableau des rapports n’a pas pu être chargé.</strong><span>Vérifiez la configuration Supabase et les migrations applicables.</span></div>}

      <section className="admin-editor card">
        <div className="editor-heading"><div><div className="eyebrow">{selected?'Édition':'Nouveau contenu'}</div><h2>{selected?'Modifier le rapport':'Créer un rapport'}</h2></div>{selected&&<span className={`status-pill ${selected.status==='published'?'is-published':'is-draft'}`}>{selected.status==='published'?'Publié':'Brouillon'}</span>}</div>
        <form action={saveReport} className="stack report-form">
          <input type="hidden" name="id" value={selected?.id??''}/>
          <div className="settings-grid"><label>Titre<input name="title" required defaultValue={selected?.title??''}/></label><label>Date de l’activité<input type="date" name="activity_date" required defaultValue={selected?.activity_date??''}/></label><label className="full-field">Lieu<input name="location" defaultValue={selected?.location??''}/></label><label className="full-field">Résumé<textarea name="summary" rows={3} defaultValue={selected?.summary??''}/></label><label className="full-field">Contenu du rapport<textarea name="body" rows={8} defaultValue={selected?.body??''}/></label></div>
          <input type="hidden" name="cover_path" value={selected?.cover_path??''}/><button className="button" type="submit">Enregistrer le rapport</button>
        </form>
        {selected&&<div className="stack report-management">
          <ReportCover reportId={selected.id} initialPath={selected.cover_asset_path}/>
          <Upload reportId={selected.id} initial={media??[]} coverPath={selected.cover_path}/>
          <ReportLinks reportId={selected.id} links={links??[]}/>
          <div className="admin-actions"><Link className="button button-quiet" href={`/admin/preview/${selected.id}`} target="_blank">Prévisualiser</Link><Link className="button button-outline" href={`/api/reports/${selected.id}/pdf`}>Générer / télécharger le PDF</Link><form action={setPublished}><input type="hidden" name="id" value={selected.id}/><input type="hidden" name="status" value={selected.status==='published'?'draft':'published'}/><button className={selected.status==='published'?'button button-quiet':'button'}>{selected.status==='published'?'Dépublier':'Publier'}</button></form><ConfirmDelete id={selected.id}/></div>
        </div>}
      </section>

      <section className="admin-list"><div className="section-heading"><div><div className="eyebrow">Bibliothèque</div><h2>Activités et rapports</h2></div></div>
        {reports?.length ? <div className="report-list">{reports.map(report=><article className="report-list-item" key={report.id}><div><span className={`status-pill ${report.status==='published'?'is-published':'is-draft'}`}>{report.status==='published'?'Publié':'Brouillon'}</span><h3>{report.title}</h3><p>{new Date(`${report.activity_date}T00:00:00`).toLocaleDateString('fr-FR')} · {report.location||'Lieu non précisé'}</p></div><Link className="button button-outline" href={`/admin?id=${report.id}`}>Modifier</Link></article>)}</div> : <div className="empty-state"><span className="empty-mark">R</span><h3>Aucun rapport pour le moment</h3><p>Créez un premier brouillon pour préparer une publication.</p></div>}
      </section>
    </main>
  </>;
}
