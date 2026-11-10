import { useEffect, useMemo, useState, type FormEvent } from 'react';
import reportsData from './data/reports.json';
import ReportForm from './components/report-form';
import { createAdminCredential, hasAdminCredential, isAdminSessionValid, signInAdmin, signOutAdmin, updateAdminEmail, updateAdminPassword } from './lib/admin-auth';
import { validatePublishedReports, type PublishedReport } from './lib/published-reports';
import { publicAsset, reportPdfUrl } from './lib/site';
import { BRANDING } from './data/branding';

const reports = validatePublishedReports(reportsData);
const diocesanLogo = publicAsset(BRANDING.logos.archdiocese);
const renewalLogo = publicAsset(BRANDING.logos.renewal);
function routeFromHash() {
  return window.location.hash.replace(/^#/, '') || '/';
}

function SiteHeader() {
  return <header className="site-header">
    <a className="identity" href="#/" aria-label="Accueil du Service Jeune RCCC">
      <img className="identity-logo" src={diocesanLogo} alt="Logo de l’Archidiocèse de Cotonou" />
      <span className="identity-text"><strong>{BRANDING.mentions.archdiocese}</strong><b>{BRANDING.mentions.prayerGroup}</b><span>{BRANDING.mentions.service}</span></span>
      <img className="identity-logo identity-logo-secondary" src={renewalLogo} alt="Emblème du Renouveau Charismatique" />
    </a>
    <nav aria-label="Navigation principale">
      <a href="#/">Accueil</a><a href="#/rapports">Rapports</a><a href="#/administration">Administration</a><a className="nav-action" href="#/nouveau">Créer un rapport</a>
    </nav>
  </header>;
}

function SiteFooter() {
  return <footer className="site-footer"><span>Service Jeune du Renouveau Charismatique Catholique de Cotonou</span><span>Foi · Fraternité · Mission</span></footer>;
}

function ReportCard({ report }: { report: PublishedReport }) {
  const date = new Date(`${report.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return <article className="report-card">
    <div className="report-card-date">{date}</div>
    <h3><a href={`#/rapport/${encodeURIComponent(report.id)}`}>{report.title}</a></h3>
    {report.place && <p className="report-place">{report.place}</p>}
    {report.summary && <p>{report.summary}</p>}
    <div className="report-card-actions"><a className="text-action" href={`#/rapport/${encodeURIComponent(report.id)}`}>Consulter le rapport <span aria-hidden="true">→</span></a><a className="pdf-action" href={reportPdfUrl(report.pdf)} target="_blank" rel="noopener noreferrer">Télécharger le PDF</a></div>
  </article>;
}

function HomePage() {
  const recent = useMemo(() => [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3), []);
  return <main>
    <section className="hero">
      <div className="eyebrow">SERVICE JEUNE RCCC · COTONOU</div>
      <h1>Servir, témoigner,<br /><em>faire grandir la foi.</em></h1>
      <p>Retrouvez les comptes rendus des activités du Service Jeune du Renouveau Charismatique Catholique de Cotonou.</p>
      <div className="hero-actions"><a className="button" href="#/rapports">Consulter les rapports</a><a className="button button-light" href="#/nouveau">Créer un rapport</a></div>
      <div className="hero-note">Chaque rapport est relu par un responsable avant sa publication sur ce site.</div>
    </section>
    <section className="content-section">
      <div className="section-heading"><div><div className="eyebrow">La mémoire de nos activités</div><h2>Rapports publiés</h2></div><a href="#/rapports" className="text-action">Tous les rapports <span aria-hidden="true">→</span></a></div>
      {recent.length ? <div className="report-grid">{recent.map((report) => <ReportCard report={report} key={report.id} />)}</div> : <div className="empty-state"><span className="empty-symbol">✳</span><h3>Aucun rapport publié pour le moment</h3><p>Les rapports validés apparaîtront ici après leur ajout au dépôt du site.</p><a className="text-action" href="#/rapports">Voir la liste des rapports</a></div>}
    </section>
  </main>;
}

function ReportsPage() {
  const ordered = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  return <main className="content-section page-content"><div className="eyebrow">Archives d’activités</div><h1>Rapports publiés</h1><p className="page-intro">Consultez les comptes rendus et ouvrez les albums photos partagés.</p>
    {ordered.length ? <div className="report-grid">{ordered.map((report) => <ReportCard report={report} key={report.id} />)}</div> : <div className="empty-state"><span className="empty-symbol">R</span><h2>La liste est encore vide</h2><p>Aucun rapport n’a été ajouté à la publication. Revenez bientôt.</p></div>}
  </main>;
}

function ReportDetail({ report }: { report: PublishedReport }) {
  const date = new Date(`${report.date}T00:00:00`).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  return <main className="content-section page-content report-detail"><a className="back-link" href="#/rapports">← Tous les rapports</a><div className="eyebrow">Compte rendu d’activité</div><h1>{report.title}</h1><p className="detail-meta">{date}{report.place ? ` · ${report.place}` : ''}</p>{report.summary && <p className="detail-summary">{report.summary}</p>}
    <div className="detail-actions"><a className="button" href={reportPdfUrl(report.pdf)} target="_blank" rel="noopener noreferrer">Télécharger le rapport PDF</a>{report.photoAlbumUrl && <a className="button button-light" href={report.photoAlbumUrl} target="_blank" rel="noopener noreferrer">Voir l’album Google Photos</a>}</div>
    <div className="public-info"><strong>Rapport publié</strong><p>La version détaillée est disponible dans le PDF. Les albums photos restent hébergés sur Google Photos.</p></div>
  </main>;
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [authenticated, setAuthenticated] = useState(isAdminSessionValid);
  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash());
    const refreshSession = () => setAuthenticated(isAdminSessionValid());
    window.addEventListener('hashchange', updateRoute);
    window.addEventListener('storage', refreshSession);
    const timer = window.setInterval(refreshSession, 30_000);
    return () => { window.removeEventListener('hashchange', updateRoute); window.removeEventListener('storage', refreshSession); window.clearInterval(timer); };
  }, []);
  const updateAuth = (value: boolean) => setAuthenticated(value);
  let content;
  if (route === '/administration') content = <AdminAccess authenticated={authenticated} onAuthChange={updateAuth} createFlow={false} />;
  else if (route === '/nouveau') content = authenticated ? <ReportForm onSignOut={() => { signOutAdmin(); updateAuth(false); window.location.hash = '/administration'; }} /> : <AdminAccess authenticated={false} onAuthChange={updateAuth} createFlow />;
  else if (route === '/rapports') content = <ReportsPage />;
  else if (route.startsWith('/rapport/')) {
    const id = decodeURIComponent(route.slice('/rapport/'.length));
    const report = reports.find((entry) => entry.id === id);
    content = report ? <ReportDetail report={report} /> : <main className="content-section page-content"><h1>Rapport introuvable</h1><a href="#/rapports">Retour aux rapports</a></main>;
  } else content = <HomePage />;
  return <><SiteHeader />{content}<SiteFooter /></>;
}

function AdminAccess({ authenticated, onAuthChange, createFlow }: { authenticated: boolean; onAuthChange: (value: boolean) => void; createFlow: boolean }) {
  const [configured, setConfigured] = useState(hasAdminCredential);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      if (configured) {
        if (!await signInAdmin(username, password)) throw new Error('Identifiant ou mot de passe incorrect.');
      } else {
        await createAdminCredential(username, password);
        setConfigured(true);
      }
      onAuthChange(true);
      window.location.hash = createFlow ? '/nouveau' : '/administration';
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'La connexion a échoué.'); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage('');
    if (newPassword !== confirmation) { setError('Les deux nouveaux mots de passe ne correspondent pas.'); return; }
    try {
      await updateAdminPassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      setMessage('Mot de passe modifié sur ce navigateur.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Le mot de passe n’a pas pu être modifié.'); }
  };

  const changeEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setEmailError(''); setEmailMessage('');
    try {
      await updateAdminEmail(emailPassword, newEmail);
      setEmailPassword(''); setNewEmail('');
      setEmailMessage('Adresse mise à jour. Utilise-la à ta prochaine connexion.');
    } catch (problem) { setEmailError(problem instanceof Error ? problem.message : 'L’adresse e-mail n’a pas pu être modifiée.'); }
  };

  const logout = () => { signOutAdmin(); onAuthChange(false); setMessage(''); window.location.hash = '/'; };

  if (authenticated) return <main className="content-section page-content form-page admin-page">
    <div className="eyebrow">Administration RCCC</div><h1>Espace Administrateur</h1>
    <p className="page-intro">Préparez les rapports dans votre navigateur, puis publiez les fichiers manuellement sur GitHub.</p>
    <div className="admin-actions"><a className="button" href="#/nouveau">Créer un rapport</a><button type="button" className="button button-light" onClick={logout}>Se déconnecter</button></div>
    <div className="privacy-note"><strong>Limite de cette connexion locale</strong><span>Le mot de passe est vérifié par le navigateur et n’est pas envoyé au serveur. GitHub Pages ne fournit pas de contrôle d’accès serveur : cette barrière peut être contournée par une personne qui inspecte ou modifie le code de la page.</span></div>
    <section className="admin-password-panel"><h2>Modifier le mot de passe</h2><form className="form-grid" onSubmit={changePassword}>
      <label className="field"><span>Mot de passe actuel</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
      <label className="field"><span>Nouveau mot de passe (12 caractères minimum)</span><input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
      <label className="field"><span>Confirmer le nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      <div className="field"><span>&nbsp;</span><button className="button" type="submit">Modifier le mot de passe</button></div>
    </form>{message && <p className="success-message" role="status">{message}</p>}{error && <p className="error-message" role="alert">{error}</p>}</section>
    <section className="admin-password-panel"><h2>Modifier l’adresse e-mail</h2>
      <form className="form-grid" onSubmit={changeEmail}>
        <label className="field"><span>Nouvelle adresse e-mail</span><input type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /></label>
        <label className="field"><span>Confirme avec ton mot de passe</span><input type="password" autoComplete="current-password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} required /></label>
        <div className="field"><span>&nbsp;</span><button className="button" type="submit">Mettre à jour l’adresse</button></div>
      </form>
      <p className="field-help">Cette adresse deviendra l’identifiant utilisé pour te connecter sur ce navigateur. Aucune confirmation par e-mail n’est envoyée.</p>
      {emailMessage && <p className="success-message" role="status">{emailMessage}</p>}{emailError && <p className="error-message" role="alert">{emailError}</p>}
    </section>
  </main>;

  return <main className="content-section page-content form-page admin-page">
    <a className="back-link" href="#/">← Accueil</a><div className="eyebrow">Accès administrateur local</div>
    <h1>{configured ? 'Connexion à l’administration' : 'Créer le compte administrateur'}</h1>
    <p className="page-intro">{configured ? 'Saisissez l’identifiant et le mot de passe enregistrés dans ce navigateur.' : 'Définissez ici l’unique identifiant et le mot de passe administrateur pour ce navigateur.'}</p>
    <div className="privacy-note"><strong>À savoir avant de continuer</strong><span>Cette connexion locale améliore l’accès dans l’interface, mais ne constitue pas une protection forte : tout visiteur peut techniquement contourner le code d’un site GitHub Pages. La première personne à ouvrir cette page peut configurer le compte dans son navigateur.</span></div>
    <form className="admin-login" onSubmit={authenticate}>
      <label className="field"><span>Identifiant ou adresse e-mail</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      <label className="field"><span>Mot de passe {configured ? '' : '(12 caractères minimum)'}</span><input type="password" autoComplete={configured ? 'current-password' : 'new-password'} minLength={configured ? undefined : 12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <button className="button" type="submit">{configured ? 'Se connecter' : 'Configurer le compte'}</button>
    </form>
  </main>;
}

