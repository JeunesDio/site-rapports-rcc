import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { reportLinkLabel } from '@/lib/report-links';

/* eslint-disable @next/next/no-img-element -- Supabase signed URLs are intentionally served directly so a Next image cache cannot outlive their expiry. */

export default async function AdminPreview({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {supabase}=await requireAdmin();const {data:report}=await supabase.from('reports').select('*').eq('id',id).maybeSingle();if(!report)notFound();
 const {data:media}=await supabase.from('report_media').select('*').eq('report_id',report.id).order('sort_order');
 const items=await Promise.all((media??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl};}));
 const {data:links}=await supabase.from('report_links').select('*').eq('report_id',report.id).order('sort_order');
 return <><header className="bar"><Link href={`/admin?id=${report.id}`}>← Retour à la modification</Link><strong>Aperçu privé · {report.status==='published'?'Publié':'Brouillon'}</strong></header><main className="wrap"><h1>{report.title}</h1><p>{report.activity_date} · {report.location}</p><p>{report.summary}</p>{report.body&&<section><h2>Rapport</h2><p style={{whiteSpace:'pre-wrap'}}>{report.body}</p></section>}<h2>Galerie</h2><div className="media-grid">{items.filter(x=>x.url&&x.media_type==='photo').map(x=><img key={x.id} src={x.url!} alt={x.caption??''}/>)}</div><div className="media-grid">{items.filter(x=>x.url&&x.media_type==='video').map(x=><video key={x.id} src={x.url!} controls preload="metadata"/>)}</div>{links&&links.length>0&&<section><h2>Liens Google</h2><p>L’accès Google n’est pas vérifiable depuis ce site; contrôlez le partage du fichier auprès de Google.</p>{links.map(link=><p key={link.id}>{link.is_public?'Marqué pour affichage public; accès Google à vérifier':'Privé — masqué aux visiteurs'} · <a href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel(link.media_type)}: {link.title}</a></p>)}</section>}<h2>Témoignages autorisés</h2>{items.filter(x=>x.is_testimonial&&x.is_public&&x.caption).map(x=><blockquote key={x.id}>{x.caption}</blockquote>)}</main></>;
}
