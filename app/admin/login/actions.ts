'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(form:FormData){const supabase=await createClient();const email=String(form.get('email')||'');const password=String(form.get('password')||'');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)redirect('/admin/login?error=credentials');const {data:{user}}=await supabase.auth.getUser();if(!user){await supabase.auth.signOut();redirect('/admin/login?error=credentials')}const {data}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(!data){await supabase.auth.signOut();redirect('/admin/login?error=unauthorized')}redirect('/admin')}
