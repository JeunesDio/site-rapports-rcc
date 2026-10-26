import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { reportLinkLabel } from '@/lib/report-links';

/* eslint-disable @next/next/no-img-element -- Supabase signed URLs are intentionally served directly so a Next image cache cannot outlive their expiry. */

export default async function ReportPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const supabase=await createClient();
 const {data:report}=await supabase.from('reports').select('*').eq('id',id).eq('status','published').maybeSingle();
 if(!report) notFound();
 const {data:media}=await supabase.from('report_media').select('*').eq('report_id',report.id).eq('is_public',true).order('sort_order');
 const items=await Promise.all((media??[]).map(async item=>{const {data}=await supabase.storage.from('report-media').createSignedUrl(item.storage_path,900);return {...item,url:data?.signedUrl};}));
 const {data:links}=await supabase.from('report_links').select('id,media_type,title,url').eq('report_id',report.id).eq('is_public',true).order('sort_order');
 const photoLinks=(links??[]).filter(x=>x.media_type==='photos_album');const videoLinks=(links??[]).filter(x=>x.media_type==='drive_video');const documentLinks=(links??[]).filter(x=>x.media_type==='drive_document');
 return <><header className="bar"><Link href="/">← Tous les rapports</Link><span>Rapports d’activités</span></header><main className="wrap" id="report"><h1>{report.title}</h1><p>{new Date(report.activity_date+'T00:00:00').toLocaleDateString('fr-FR')} · {report.location}</p><p>{report.summary}</p><div className="actions"><a className="button" href={`/api/reports/${report.id}/pdf`}>Télécharger le rapport PDF</a></div>{report.body&&<section><h2>Rapport</h2><p style={{whiteSpace:'pre-wrap'}}>{report.body}</p></section>}<section><h2>Galerie</h2><div className="media-grid">{items.filter(x=>x.url&&x.media_type==='photo').map(x=><img key={x.id} src={x.url!} alt={x.caption??''}/>)}</div><div className="media-grid">{items.filter(x=>x.url&&x.media_type==='video').map(x=><video key={x.id} src={x.url!} controls preload="metadata"/>)}</div>{photoLinks.length>0&&<div className="actions">{photoLinks.map(link=><a className="button" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel('photos_album')}{photoLinks.length>1?`: ${link.title}`:''}</a>)}</div>}</section>{videoLinks.length>0&&<section><h2>Vidéos</h2><div className="actions">{videoLinks.map(link=><a className="button" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel('drive_video')}: {link.title}</a>)}</div></section>}{documentLinks.length>0&&<section><h2>Documents complémentaires</h2><div className="actions">{documentLinks.map(link=><a className="button secondary" key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{reportLinkLabel('drive_document')}: {link.title}</a>)}</div></section>}{items.some(x=>x.is_testimonial&&x.url)&&<section><h2>Témoignages</h2>{items.filter(x=>x.is_testimonial&&x.caption).map(x=><blockquote key={x.id}>{x.caption}</blockquote>)}</section>}</main></>;
}
