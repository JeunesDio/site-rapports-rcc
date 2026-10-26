import type { Database } from '@/lib/supabase/database.types';
import { deleteReportLink, saveReportLink } from './actions';
import ConfirmLinkDelete from './confirm-link-delete';

type ReportLink = Database['public']['Tables']['report_links']['Row'];
const typeNames = { photos_album: 'Album Google Photos', drive_video: 'Vidéo Google Drive', youtube_video: 'Vidéo YouTube', drive_document: 'Document Google Drive' } as const;

function LinkFields({ reportId, item }: { reportId: string; item?: ReportLink }) {
  return <form action={saveReportLink} className="stack card card-body">
    <input type="hidden" name="reportId" value={reportId}/>
    {item && <input type="hidden" name="linkId" value={item.id}/>}
    <label>Type de lien<select name="media_type" defaultValue={item?.media_type ?? 'photos_album'}>
      <option value="photos_album">Album Google Photos</option>
      <option value="drive_video">Vidéo ou dossier Google Drive</option>
      <option value="youtube_video">Vidéo YouTube</option>
      <option value="drive_document">Document ou dossier Google Drive</option>
    </select></label>
    <label>Titre affiché<input name="title" maxLength={160} required defaultValue={item?.title ?? ''} placeholder="Ex. Album de la célébration"/></label>
    <label>Lien de partage (HTTPS)<input name="url" type="url" required defaultValue={item?.url ?? ''} placeholder="Google Photos, Google Drive ou YouTube"/></label>
    <label><input style={{width:'auto'}} type="checkbox" name="is_public" defaultChecked={item?.is_public ?? false}/> Afficher ce lien sur le site public</label>
    <small>Avant de cocher, vérifiez dans Google que les visiteurs visés ont accès. Le site ne peut pas vérifier les droits configurés chez Google. Un lien privé restera affiché seulement dans l’administration.</small>
    <button>{item ? 'Enregistrer le lien' : 'Ajouter le lien'}</button>
    {item && <ConfirmLinkDelete reportId={reportId} linkId={item.id} action={deleteReportLink}/>}
  </form>;
}

export default function ReportLinks({ reportId, links }: { reportId: string; links: ReportLink[] }) {
  return <section className="stack"><h3>Liens Google</h3>
    <p>Les fichiers restent dans Google Photos, Drive ou YouTube. Seuls les liens HTTPS des domaines autorisés sont acceptés. Rien n’est rendu public automatiquement.</p>
    {links.map(link => <div key={link.id}><p><strong>{typeNames[link.media_type]}</strong> · {link.is_public ? 'Affiché sur le site public' : 'Privé · non affiché aux visiteurs'}</p><LinkFields reportId={reportId} item={link}/></div>)}
    <h4>Ajouter un lien</h4><LinkFields reportId={reportId}/>
  </section>;
}
