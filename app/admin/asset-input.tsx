'use client';

/* eslint-disable @next/next/no-img-element -- Object URLs are short-lived upload previews before the storage path exists. */

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { getAssetUrl } from '@/lib/site-settings';

const maxBytes = 5 * 1024 * 1024;

async function optimizeImage(file: File, pdfSafe: boolean): Promise<{ blob: Blob; extension: string }> {
  if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') return { blob: file, extension: 'ico' };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / bitmap.width, 1800 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const outputType = pdfSafe ? file.type : 'image/webp';
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Compression d’image impossible.')), outputType, 0.86));
  if (blob.size > maxBytes) throw new Error('L’image optimisée dépasse 5 Mo. Choisissez une image plus légère.');
  return { blob, extension: outputType === 'image/jpeg' ? 'jpg' : outputType === 'image/png' ? 'png' : 'webp' };
}

export default function AssetInput({ label, value, folder, onChange, pdfSafe = false, compact = false, bucket = 'site-assets' }: {
  label: string;
  value: string | null;
  folder: string;
  onChange: (path: string | null) => void;
  pdfSafe?: boolean;
  compact?: boolean;
  bucket?: 'site-assets' | 'report-covers';
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [privatePreview, setPrivatePreview] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (bucket !== 'report-covers' || !value) return;
    let active = true;
    void createBrowserSupabaseClient().storage.from(bucket).createSignedUrl(value, 900).then(({ data }) => {
      if (active && data?.signedUrl) setPrivatePreview({ path: value, url: data.signedUrl });
    });
    return () => { active = false; };
  }, [bucket, value]);
  const preview = bucket === 'report-covers' ? (privatePreview?.path === value ? privatePreview.url : null) : getAssetUrl(value);
  const accept = pdfSafe ? 'image/jpeg,image/png' : folder === 'site/favicon' ? 'image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon' : 'image/jpeg,image/png,image/webp';

  async function upload(file?: File) {
    if (!file) return;
    const allowed = pdfSafe ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'image/webp', ...(folder === 'site/favicon' ? ['image/x-icon', 'image/vnd.microsoft.icon'] : [])];
    if (!allowed.includes(file.type)) { setError('Format refusé. Utilisez JPG ou PNG pour les images PDF.'); return; }
    if (file.size > maxBytes) { setError('Le fichier dépasse la limite de 5 Mo.'); return; }
    setError(''); setBusy(true);
    try {
      const optimized = await optimizeImage(file, pdfSafe);
      const path = `${folder}/${crypto.randomUUID()}.${optimized.extension}`;
      const { error: uploadError } = await createBrowserSupabaseClient().storage.from(bucket).upload(path, optimized.blob, {
        cacheControl: '3600', upsert: false, contentType: optimized.blob.type,
      });
      if (uploadError) throw new Error(uploadError.message);
      if (bucket === 'report-covers') {
        const { data: signed } = await createBrowserSupabaseClient().storage.from(bucket).createSignedUrl(path, 900);
        if (signed?.signedUrl) setPrivatePreview({ path, url: signed.signedUrl });
      }
      setPreviewFailed(false);
      onChange(path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Envoi impossible. Réessayez.');
    } finally { setBusy(false); }
  }

  return <div className={`asset-field${compact ? ' asset-field-compact' : ''}`}>
    <div className="asset-preview">
      {preview && !previewFailed ? <img src={preview} alt={`Aperçu : ${label}`} onError={() => setPreviewFailed(true)}/> : <span>{value ? 'Aperçu indisponible' : 'Aucune image choisie'}</span>}
    </div>
    <div className="asset-controls">
      <label>{label}<input type="file" accept={accept} disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label>
      <small>JPG, PNG{!pdfSafe && folder !== 'site/favicon' ? ' ou WebP' : ''} · 5 Mo max · redimensionnement automatique</small>
      {value && <button className="button button-quiet" type="button" disabled={busy} onClick={() => { if (window.confirm(`Retirer « ${label} » ? Le changement sera appliqué après enregistrement.`)) onChange(null); }}>Retirer l’image</button>}
      {busy && <p role="status">Optimisation et envoi…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>;
}
