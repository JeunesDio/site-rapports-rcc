'use client';

export default function ConfirmLinkDelete({ reportId, linkId, action }: { reportId: string; linkId: string; action: (formData: FormData) => void | Promise<void> }) {
  return <form action={action} onSubmit={event => { if (!window.confirm('Supprimer ce lien du rapport ?')) event.preventDefault(); }}>
    <input type="hidden" name="reportId" value={reportId}/><input type="hidden" name="linkId" value={linkId}/>
    <button type="submit" className="secondary">Supprimer le lien</button>
  </form>;
}
