import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/* eslint-disable @next/next/no-img-element -- Supabase signed URLs are intentionally served directly so a Next image cache cannot outlive their expiry. */

export default async function Home() {
  const supabase = await createClient();
  const { data: reports } = await supabase.from('reports').select('id,title,activity_date,location,cover_path,summary').eq('status','published').order('activity_date',{ascending:false});
  const covers = await Promise.all((reports ?? []).map(async report => {
    if (!report.cover_path) return [report.id, null] as const;
    const { data } = await supabase.storage.from('report-media').createSignedUrl(report.cover_path, 900);
    return [report.id, data?.signedUrl ?? null] as const;
  }));
  const coverById = new Map(covers);
  return <><header className="bar"><strong>Rapports d’activités</strong><Link href="/admin/login">Administration</Link></header><main className="wrap"><h1>Activités et rapports</h1><p>Consultez les rapports rendus publics.</p>{reports?.length ? <div className="cards">{reports.map(r=><article className="card" key={r.id}>{coverById.get(r.id)&&<img src={coverById.get(r.id)!} alt=""/>}<div className="card-body"><h2>{r.title}</h2><p>{new Date(r.activity_date+'T00:00:00').toLocaleDateString('fr-FR')} · {r.location}</p><p>{r.summary}</p><Link href={`/rapports/${r.id}`}>Consulter le rapport</Link></div></article>)}</div>:<p>Aucun rapport publié pour le moment.</p>}</main></>;
}
