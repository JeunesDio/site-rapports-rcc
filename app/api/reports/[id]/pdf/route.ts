import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { makePdf } from '@/lib/pdf';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();let isAdmin=false;let {data:r}=await supabase.from('reports').select('title,activity_date,location,summary,body').eq('id',id).eq('status','published').maybeSingle();
  if(!r){const {data:{user}}=await supabase.auth.getUser();if(user){const {data:admin}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(admin){const result=await supabase.from('reports').select('title,activity_date,location,summary,body').eq('id',id).maybeSingle();r=result.data;isAdmin=!!r;}}}
  if(!r)return new NextResponse('Not found',{status:404});
  let linkQuery=supabase.from('report_links').select('media_type,title,url').eq('report_id',id).order('sort_order');if(!isAdmin)linkQuery=linkQuery.eq('is_public',true);const {data:links}=await linkQuery;
  const linkLines=(links??[]).flatMap(link=>[`${link.media_type==='photos_album'?'Photos Google':link.media_type==='drive_video'?'Vidéo Google Drive':'Document Google Drive'} : ${link.title}`,link.url,'']);
  const lines=[`Date : ${r.activity_date}`,`Lieu : ${r.location}`,'',r.summary,...(r.body||'').split(/\r?\n/),'',...linkLines].flatMap(line=>{const text=line||' ';const out:string[]=[];for(let i=0;i<text.length;i+=88)out.push(text.slice(i,i+88));return out;});
  const pdf=makePdf(r.title,lines);
  return new NextResponse(new Uint8Array(pdf), {headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rapport-${id}.pdf"`, "Cache-Control": "private, no-store" }});
}
