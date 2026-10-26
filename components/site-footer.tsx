import Link from 'next/link';
import type { SiteSettings } from '@/lib/site-settings';

export default function SiteFooter({ settings }: { settings: SiteSettings }) {
  return <footer className="site-footer"><div className="site-footer-inner">
    <div><strong>{settings.organizationName}</strong><p>{settings.tagline}</p>{settings.footerContact&&<p className="footer-contact">{settings.footerContact}</p>}</div>
    <nav aria-label="Liens de pied de page"><Link href="/activites">Activités</Link><Link href="/rapports">Rapports</Link><Link href="/galerie">Galerie photos</Link><Link href="/videos">Vidéos</Link></nav>
    <small>Contenus publiés par le diocèse. Les coordonnées et liens apparaissent uniquement lorsqu’ils sont renseignés par l’administration.</small>
  </div></footer>;
}
