import { useEffect, useRef, useState, type FormEvent } from 'react';
import { makePublicationEntry } from '../lib/publication';
import { EMPTY_REPORT, REPORT_RUBRICS, slugify, validateReport, type PhotoAsset, type ReportDraft } from '../lib/report';
import { publicAsset } from '../lib/site';
import { BRANDING } from '../data/branding';
import { createPdfBlob } from '../lib/download';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_PHOTOS = 12;
const MAX_TOTAL_PHOTO_BYTES = 18 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1800;

async function preparePhoto(file: File): Promise<PhotoAsset> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`${file.name} : format non autorisé.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} : fichier supérieur à 12 Mo.`);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de préparer cette photo.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Compression de la photo impossible.')), 'image/jpeg', 0.84));
    return { name: file.name, bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/jpeg', caption: '' };
  } finally { bitmap.close(); }
}

async function loadPdfLogo(path: string): Promise<{ bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' }> {
  const response = await fetch(publicAsset(path));
  if (!response.ok) throw new Error('Impossible de charger un des logos du rapport.');
  const mimeType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ReportForm() {
  const [report, setReport] = useState<ReportDraft>(EMPTY_REPORT);
  const [errors, setErrors] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [working, setWorking] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('');
  const localUrls = useRef<string[]>([]);
  const activePdfUrl = useRef('');
  useEffect(() => () => { localUrls.current.forEach(URL.revokeObjectURL); if (activePdfUrl.current) URL.revokeObjectURL(activePdfUrl.current); }, []);

  const update = (key: keyof Omit<ReportDraft, 'photos'>, value: string) => setReport((current) => ({ ...current, [key]: value }));

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError('');
    const selected = Array.from(files);
    if (report.photos.length + selected.length > MAX_PHOTOS) { setPhotoError(`Limite de ${MAX_PHOTOS} photos par rapport.`); return; }
    const prepared: PhotoAsset[] = [];
    try {
      for (const file of selected) {
        const photo = await preparePhoto(file);
        prepared.push({ ...photo, previewUrl: URL.createObjectURL(new Blob([new Uint8Array(photo.bytes) as BlobPart], { type: photo.mimeType })) });
      }
      const total = [...report.photos, ...prepared].reduce((sum, photo) => sum + photo.bytes.byteLength, 0);
      if (total > MAX_TOTAL_PHOTO_BYTES) {
        prepared.forEach((photo) => photo.previewUrl && URL.revokeObjectURL(photo.previewUrl));
        setPhotoError('Les photos compressées dépassent 18 Mo au total. Retirez-en quelques-unes ou choisissez des images plus petites.');
        return;
      }
      prepared.forEach((photo) => { if (photo.previewUrl) localUrls.current.push(photo.previewUrl); });
      setReport((current) => ({ ...current, photos: [...current.photos, ...prepared] }));
    } catch (error) {
      prepared.forEach((photo) => photo.previewUrl && URL.revokeObjectURL(photo.previewUrl));
      setPhotoError(error instanceof Error ? error.message : 'Une photo n’a pas pu être lue.');
    }
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateReport(report);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    setWorking(true);
    try {
      const { buildReportPdf } = await import('../lib/pdf');
      const [archdioceseLogo, renewalLogo] = await Promise.all([
        loadPdfLogo(BRANDING.logos.archdiocese),
        loadPdfLogo(BRANDING.logos.renewal),
      ]);
      const bytes = await buildReportPdf(report, { archdioceseLogo, renewalLogo });
      const datePart = report.activityDate || new Date().toISOString().slice(0, 10);
      const name = `rapport-${datePart}-${slugify(report.activityName)}.pdf`;
      const url = URL.createObjectURL(createPdfBlob(bytes));
      setPdfUrl((previous) => { if (previous) URL.revokeObjectURL(previous); activePdfUrl.current = url; return url; });
      setPdfName(name);
      setErrors([]);
      window.setTimeout(() => document.getElementById('pdf-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Le PDF n’a pas pu être généré.']);
    } finally { setWorking(false); }
  };

  const downloadPublicationEntry = () => {
    const path = `rapports/${pdfName}`;
    const entry = makePublicationEntry(report, path, `${report.activityDate}-${slugify(report.activityName)}`);
    downloadBlob(new Blob([`${JSON.stringify(entry, null, 2)}\n`], { type: 'application/json;charset=utf-8' }), `publication-${slugify(report.activityName)}.json`);
  };

  return <main className="content-section page-content form-page">
    <a className="back-link" href="#/">← Accueil</a>
    <div className="eyebrow">Création locale · sans compte</div>
    <h1>Préparer un rapport d’activité</h1>
    <p className="page-intro">Remplissez les rubriques utiles, ajoutez des photos si vous le souhaitez, puis générez le PDF dans votre navigateur.</p>
    <div className="privacy-note"><strong>Avant de commencer</strong><span>Cette page ne publie ni n’enregistre vos saisies. N’y inscrivez pas d’informations confidentielles. La publication du rapport et de son album reste une étape humaine distincte.</span></div>
    <form className="report-editor" onSubmit={generate}>
      {REPORT_RUBRICS.map((rubric) => <fieldset className="form-section" key={rubric.id}>
        <legend>{rubric.title}</legend>
        <div className="form-grid">
          {rubric.fields.map((field) => <label className={field.kind === 'textarea' || field.kind === 'url' ? 'field full-field' : 'field'} key={field.key}>
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.kind === 'textarea' ? <textarea name={field.key} rows={4} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />
              : <input name={field.key} type={field.kind === 'number' ? 'number' : field.kind} min={field.kind === 'number' ? '0' : undefined} step={field.kind === 'number' ? '1' : undefined} max={field.kind === 'number' ? '1000000' : undefined} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />}
            {field.help && <small>{field.help}</small>}
          </label>)}
        </div>
      </fieldset>)}
      <fieldset className="form-section">
        <legend>Photos intégrées au PDF <span className="optional">facultatif</span></legend>
        <p className="field-help">Jusqu’à 12 photos JPEG, PNG ou WebP. Elles sont redimensionnées dans ce navigateur avant insertion au PDF (12 Mo par fichier, 18 Mo compressés au total).</p>
        <label className="file-picker"><span>Sélectionner des photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos(event.target.files); event.currentTarget.value = ''; }} /></label>
        {photoError && <p className="error-message" role="alert">{photoError}</p>}
        {report.photos.length > 0 && <div className="photo-editor-grid">{report.photos.map((photo, index) => <figure className="photo-editor-card" key={`${photo.name}-${index}`}>
          {photo.previewUrl && <img src={photo.previewUrl} alt={`Aperçu de ${photo.name}`} />}
          <figcaption><strong>{photo.name}</strong><label>Légende facultative<input value={photo.caption} onChange={(event) => setReport((current) => ({ ...current, photos: current.photos.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) }))} /></label><button type="button" className="text-button danger-text" onClick={() => setReport((current) => ({ ...current, photos: current.photos.filter((_, itemIndex) => itemIndex !== index) }))}>Retirer la photo</button></figcaption>
        </figure>)}</div>}
      </fieldset>
      {errors.length > 0 && <div className="error-summary" role="alert"><strong>Vérifiez les éléments suivants :</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <button className="button submit-button" type="submit" disabled={working}>{working ? 'Génération du PDF…' : 'Générer et prévisualiser le PDF'}</button>
    </form>
    {pdfUrl && <section className="preview-section" id="pdf-preview"><div className="section-heading"><div><div className="eyebrow">Document généré localement</div><h2>Aperçu du rapport</h2></div><a className="button" href={pdfUrl} download={pdfName}>Télécharger le PDF</a></div>
      <p>Pour publier ce rapport : placez le PDF dans <code>public/rapports/</code>, ajoutez la fiche ci-dessous au fichier <code>src/data/reports.json</code>, vérifiez l’autorisation de publication, puis faites relire et pousser ces changements.</p>
      <div className="publication-actions"><button type="button" className="button button-light" onClick={downloadPublicationEntry}>Télécharger la fiche de publication JSON</button></div>
      <iframe className="pdf-frame" title="Aperçu du PDF généré" src={pdfUrl} />
    </section>}
  </main>;
}

