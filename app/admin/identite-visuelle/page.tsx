import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { loadSiteSettings } from '@/lib/site-settings';
import BrandingForm from '../branding-form';

export default async function VisualIdentityPage() {
  const { supabase } = await requireAdmin();
  const settings = await loadSiteSettings(supabase);
  return <><header className="bar admin-bar"><Link href="/admin">← Tableau de bord</Link><span className="admin-bar-label">Administration du site</span></header>
    <main className="wrap admin-wrap">
      <div className="eyebrow">Personnalisation</div><h1>Identité visuelle et médias</h1>
      <p className="page-intro">Personnalisez les éléments publics et la présentation des rapports sans modifier le code.</p>
      <div className="security-note"><strong>Les images ajoutées ici sont publiques.</strong><span>Réservez cette rubrique aux logos et illustrations autorisés pour le site. Les médias privés des activités restent dans leur stockage privé ou leur lien Google non publié.</span></div>
      <BrandingForm initial={settings}/>
    </main>
  </>;
}
