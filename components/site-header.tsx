'use client';

/* eslint-disable @next/next/no-img-element -- The configured logo URL uses a Supabase project host selected at runtime. */
import Link from 'next/link';
import { getAssetUrl, type SiteSettings } from '@/lib/site-settings';

export default function SiteHeader({ settings }: { settings: SiteSettings }) {
  const logo = getAssetUrl(settings.primaryLogoPath);
  const links = [['/activites', 'Activités'], ['/rapports', 'Rapports'], ['/galerie', 'Photos'], ['/videos', 'Vidéos']] as const;
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="brand-lockup" aria-label={`${settings.organizationName} — accueil`}>
        {logo ? <img className="brand-logo" src={logo} alt=""/> : <span className="brand-rule" aria-hidden="true"/>}
        <span className="brand-copy"><strong>{settings.organizationName}</strong><small>{settings.tagline}</small></span>
      </Link>
      <nav className="site-nav" aria-label="Navigation principale">
        {links.map(([href, label])=><Link href={href} key={href}>{label}</Link>)}
        <Link className="nav-admin" href="/admin/login">Administration</Link>
      </nav>
    </div>
  </header>;
}
