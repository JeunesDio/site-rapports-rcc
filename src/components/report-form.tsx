import { useEffect, useRef, useState, type FormEvent } from 'react';
import { makePublicationEntry } from '../lib/publication';
import { EMPTY_REPORT, REPORT_RUBRICS, slugify, validateReport, type AudioAsset, type ImageAsset, type PhotoAsset, type ReportDraft } from '../lib/report';
import { publicAsset } from '../lib/site';
import { BRANDING } from '../data/branding';
import { createPdfBlob } from '../lib/download';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_LOGO_BYTES = 8 * 1024 * 1024;
const MAX_TESTIMONIAL_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 12;
const MAX_COVER_PHOTOS = 4;
const MAX_TOTAL_PHOTO_BYTES = 18 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1800;
const MAX_LOGO_EDGE = 1200;
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm',
};
type LogoKey = 'logoLeft' | 'logoRight';
type PhotoGroup = 'coverPhotos' | 'photos';

function imageMimeIsSupported(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

function canvasBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('La conversion de cette image a échoué.')),
    mimeType,
    quality,
  ));
}

async function preparePhoto(file: File): Promise<PhotoAsset> {
  if (!imageMimeIsSupported(file)) throw new Error(`${file.name} : choisissez une image PNG, JPEG ou WebP.`);
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
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.84);
    return {
      name: file.name,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType: 'image/jpeg',
      caption: '',
      previewUrl: URL.createObjectURL(blob),
    };
  } finally { bitmap.close(); }
}

async function prepareLogo(file: File): Promise<ImageAsset> {
  if (!imageMimeIsSupported(file)) throw new Error(`${file.name} : le logo doit être une image PNG, JPEG ou WebP.`);
  if (file.size > MAX_LOGO_BYTES) throw new Error(`${file.name} : le logo doit faire au maximum 8 Mo.`);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de préparer ce logo.');
    if (file.type === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await canvasBlob(canvas, mimeType, mimeType === 'image/jpeg' ? 0.9 : undefined);
    return {
      name: file.name,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mimeType,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally { bitmap.close(); }
}

async function prepareTestimonialAudio(file: File): Promise<AudioAsset> {
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const mimeType = AUDIO_MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new Error('Choisissez un enregistrement AAC, M4A, MP3, OGG, WAV ou WebM.');
  if (!file.size) throw new Error('Le fichier audio est vide.');
  if (file.size > MAX_TESTIMONIAL_AUDIO_BYTES) throw new Error('L’enregistrement audio doit faire au maximum 25 Mo.');
  return {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    mimeType,
    previewUrl: URL.createObjectURL(file),
  };
}

async function loadDefaultLogo(path: string): Promise<ImageAsset> {
  const response = await fetch(publicAsset(path));
  if (!response.ok) throw new Error('Impossible de charger un logo institutionnel. Réessayez ou importez un autre logo.');
  const mimeType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { name: path.split('/').at(-1) ?? 'Logo RCCC', bytes: new Uint8Array(await response.arrayBuffer()), mimeType };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fileLabel(file: ImageAsset) {
  return `${file.name} · ${(file.bytes.byteLength / 1024).toFixed(0)} Ko`;
}

export default function ReportForm() {
  const [report, setReport] = useState<ReportDraft>(() => ({ ...EMPTY_REPORT, organization: BRANDING.reportHeader.join('\n') }));
  const [errors, setErrors] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [coverPhotoError, setCoverPhotoError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [working, setWorking] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfName, setPdfName] = useState('');
  const localUrls = useRef<string[]>([]);
  const activePdfUrl = useRef('');

  useEffect(() => () => {
    localUrls.current.forEach(URL.revokeObjectURL);
    if (activePdfUrl.current) URL.revokeObjectURL(activePdfUrl.current);
  }, []);

  const trackUrl = (url?: string) => { if (url) localUrls.current.push(url); };
  const releaseUrl = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    localUrls.current = localUrls.current.filter((candidate) => candidate !== url);
  };
  const update = (key: keyof Omit<ReportDraft, 'coverPhotos' | 'photos' | 'coverPhotoIndex' | 'logoLeft' | 'logoRight' | 'testimonialAudio'>, value: string) => {
    setReport((current) => ({ ...current, [key]: value }));
  };

  const chooseLogo = async (key: LogoKey, file: File | undefined) => {
    if (!file) return;
    setLogoError('');
    try {
      const logo = await prepareLogo(file);
      trackUrl(logo.previewUrl);
      setReport((current) => {
        const previous = current[key];
        if (previous?.previewUrl) releaseUrl(previous.previewUrl);
        return { ...current, [key]: logo };
      });
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Ce logo n’a pas pu être lu.');
    }
  };

  const setLogoState = (key: LogoKey, value: ImageAsset | null | undefined) => {
    setReport((current) => {
      const previous = current[key];
      if (previous?.previewUrl) releaseUrl(previous.previewUrl);
      return { ...current, [key]: value };
    });
  };

  const chooseTestimonialAudio = async (file: File | undefined) => {
    if (!file) return;
    setAudioError('');
    try {
      const audio = await prepareTestimonialAudio(file);
      trackUrl(audio.previewUrl);
      setReport((current) => {
        if (current.testimonialAudio) releaseUrl(current.testimonialAudio.previewUrl);
        return { ...current, testimonialAudio: audio };
      });
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'Cet enregistrement n’a pas pu être lu.');
    }
  };

  const addPhotos = async (group: PhotoGroup, files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const currentCount = report.coverPhotos.length + report.photos.length;
    if (currentCount + selected.length > MAX_IMAGES) {
      const message = `Limite de ${MAX_IMAGES} photos au total par rapport.`;
      if (group === 'coverPhotos') setCoverPhotoError(message); else setPhotoError(message);
      return;
    }
    if (group === 'coverPhotos' && report.coverPhotos.length + selected.length > MAX_COVER_PHOTOS) {
      setCoverPhotoError(`Choisissez jusqu’à ${MAX_COVER_PHOTOS} photos pour la couverture. Ajoutez les autres dans les photos complémentaires.`);
      return;
    }
    if (group === 'coverPhotos') setCoverPhotoError(''); else setPhotoError('');
    const prepared: PhotoAsset[] = [];
    try {
      for (const file of selected) prepared.push(await preparePhoto(file));
      const total = [...report.coverPhotos, ...report.photos, ...prepared].reduce((sum, photo) => sum + photo.bytes.byteLength, 0);
      if (total > MAX_TOTAL_PHOTO_BYTES) {
        prepared.forEach((photo) => URL.revokeObjectURL(photo.previewUrl!));
        const message = 'Les photos compressées dépassent 18 Mo au total. Retirez-en quelques-unes ou choisissez des images plus petites.';
        if (group === 'coverPhotos') setCoverPhotoError(message); else setPhotoError(message);
        return;
      }
      prepared.forEach((photo) => trackUrl(photo.previewUrl));
      setReport((current) => ({ ...current, [group]: [...current[group], ...prepared] }));
    } catch (error) {
      prepared.forEach((photo) => { if (photo.previewUrl) releaseUrl(photo.previewUrl); });
      const message = error instanceof Error ? error.message : 'Une image n’a pas pu être lue.';
      if (group === 'coverPhotos') setCoverPhotoError(message); else setPhotoError(message);
    }
  };

  const removePhoto = (group: PhotoGroup, index: number) => {
    setReport((current) => {
      const target = current[group][index];
      if (target?.previewUrl) releaseUrl(target.previewUrl);
      const nextPhotos = current[group].filter((_, photoIndex) => photoIndex !== index);
      if (group !== 'coverPhotos') return { ...current, photos: nextPhotos };
      const nextMain = current.coverPhotos.length <= 1 ? 0
        : index === current.coverPhotoIndex ? Math.min(index, nextPhotos.length - 1)
          : index < current.coverPhotoIndex ? current.coverPhotoIndex - 1 : current.coverPhotoIndex;
      return { ...current, coverPhotos: nextPhotos, coverPhotoIndex: Math.max(nextMain, 0) };
    });
  };

  const reorderCoverPhoto = (from: number, to: number) => {
    setReport((current) => {
      if (to < 0 || to >= current.coverPhotos.length) return current;
      const coverPhotos = [...current.coverPhotos];
      [coverPhotos[from], coverPhotos[to]] = [coverPhotos[to], coverPhotos[from]];
      let coverPhotoIndex = current.coverPhotoIndex;
      if (coverPhotoIndex === from) coverPhotoIndex = to;
      else if (from < coverPhotoIndex && to >= coverPhotoIndex) coverPhotoIndex -= 1;
      else if (from > coverPhotoIndex && to <= coverPhotoIndex) coverPhotoIndex += 1;
      return { ...current, coverPhotos, coverPhotoIndex };
    });
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateReport(report);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    setWorking(true);
    try {
      const { buildReportPdf } = await import('../lib/pdf');
      const [leftLogo, rightLogo] = await Promise.all([
        report.logoLeft === undefined ? loadDefaultLogo(BRANDING.logos.archdiocese) : Promise.resolve(report.logoLeft ?? undefined),
        report.logoRight === undefined ? loadDefaultLogo(BRANDING.logos.renewal) : Promise.resolve(report.logoRight ?? undefined),
      ]);
      const bytes = await buildReportPdf(report, { leftLogo, rightLogo });
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

  const renderLogoCard = (key: LogoKey, title: string, defaultPath: string) => {
    const value = report[key];
    const defaultLogo = value === undefined;
    const removed = value === null;
    const preview = value?.previewUrl ?? (defaultLogo ? publicAsset(defaultPath) : '');
    const name = value && !defaultLogo ? fileLabel(value) : defaultLogo ? 'Logo institutionnel RCCC' : 'Aucun logo';
    return <div className="logo-editor-card" key={key}>
      <div className="logo-preview-box">{preview ? <img src={preview} alt={`Aperçu : ${title}`} /> : <span>Sans logo</span>}</div>
      <div className="logo-card-copy"><strong>{title}</strong><span>{name}</span></div>
      <div className="logo-card-actions">
        <label className="file-picker"><span>{defaultLogo || removed ? 'Importer un logo' : 'Remplacer le logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void chooseLogo(key, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
        {defaultLogo ? <button type="button" className="text-button danger-text" onClick={() => setLogoState(key, null)}>Supprimer</button>
          : removed ? <button type="button" className="text-button" onClick={() => setLogoState(key, undefined)}>Rétablir le logo RCCC</button>
            : <button type="button" className="text-button danger-text" onClick={() => setLogoState(key, null)}>Supprimer</button>}
      </div>
    </div>;
  };

  const renderCoverPhoto = (photo: PhotoAsset, index: number) => <figure className={`photo-editor-card ${report.coverPhotoIndex === index ? 'photo-editor-card-main' : ''}`} key={`${photo.name}-${index}`}>
    {photo.previewUrl && <img src={photo.previewUrl} alt={`Aperçu de ${photo.name}`} />}
    <figcaption>
      <strong>{photo.name}</strong>
      {report.coverPhotoIndex === index && <span className="photo-main-badge">Photo principale</span>}
      <label>Légende facultative<input value={photo.caption} onChange={(event) => setReport((current) => ({ ...current, coverPhotos: current.coverPhotos.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) }))} /></label>
      <div className="photo-actions">
        {report.coverPhotoIndex !== index && <button type="button" className="text-button" onClick={() => setReport((current) => ({ ...current, coverPhotoIndex: index }))}>Désigner comme photo principale</button>}
        <button type="button" className="text-button" disabled={index === 0} onClick={() => reorderCoverPhoto(index, index - 1)}>Monter</button>
        <button type="button" className="text-button" disabled={index === report.coverPhotos.length - 1} onClick={() => reorderCoverPhoto(index, index + 1)}>Descendre</button>
        <button type="button" className="text-button danger-text" onClick={() => removePhoto('coverPhotos', index)}>Retirer</button>
      </div>
    </figcaption>
  </figure>;

  const renderAdditionalPhoto = (photo: PhotoAsset, index: number) => <figure className="photo-editor-card" key={`${photo.name}-${index}`}>
    {photo.previewUrl && <img src={photo.previewUrl} alt={`Aperçu de ${photo.name}`} />}
    <figcaption><strong>{photo.name}</strong><label>Légende facultative<input value={photo.caption} onChange={(event) => setReport((current) => ({ ...current, photos: current.photos.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) }))} /></label><button type="button" className="text-button danger-text" onClick={() => removePhoto('photos', index)}>Retirer</button></figcaption>
  </figure>;

  return <main className="content-section page-content form-page">
    <a className="back-link" href="#/">← Accueil</a>
    <div className="eyebrow">Création locale · sans compte</div>
    <h1>Préparer un rapport d’activité</h1>
    <p className="page-intro">Renseignez les informations essentielles, choisissez les visuels de couverture, puis prévisualisez le PDF avant de le télécharger.</p>
    <div className="privacy-note"><strong>Avant de commencer</strong><span>Cette page ne publie ni n’enregistre vos saisies. N’y inscrivez pas d’informations confidentielles. La publication du rapport et de son album reste une étape humaine distincte.</span></div>
    <form className="report-editor" onSubmit={generate}>
      <fieldset className="form-section">
        <legend>1. Identification du rapport</legend>
        <div className="form-grid">
          {REPORT_RUBRICS[0].fields.map((field) => <label className={`field field-${field.key}${field.kind === 'textarea' || field.kind === 'url' ? ' full-field' : ''}`} key={field.key}>
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.kind === 'textarea' ? <textarea name={field.key} rows={4} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />
              : <input name={field.key} type={field.kind === 'number' ? 'number' : field.kind} min={field.kind === 'number' ? '0' : undefined} step={field.kind === 'number' ? '1' : undefined} max={field.kind === 'number' ? '1000000' : undefined} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />}
            {field.help && <small>{field.help}</small>}
          </label>)}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>2. Identité visuelle et logos</legend>
        <p className="field-help">Les logos sont indépendants. Les logos institutionnels sont préchargés; vous pouvez les remplacer, les supprimer ou rétablir la paire RCCC. Les PNG transparents sont conservés.</p>
        <div className="logo-editor-grid">
          {renderLogoCard('logoLeft', 'Logo de gauche', BRANDING.logos.archdiocese)}
          {renderLogoCard('logoRight', 'Logo de droite', BRANDING.logos.renewal)}
        </div>
        {logoError && <p className="error-message" role="alert">{logoError}</p>}
      </fieldset>

      <fieldset className="form-section photo-groups-section">
        <legend>3. Photos <span className="optional">facultatif</span></legend>
        <section className="photo-subsection">
          <h2>Photos de couverture</h2>
          <p className="field-help">Ajoutez jusqu’à {MAX_COVER_PHOTOS} photos sur la première page. Désignez la photo principale et réorganisez-les. Les images sont recadrées sans déformation dans le PDF.</p>
          <label className="file-picker"><span>Ajouter des photos de couverture</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos('coverPhotos', event.target.files); event.currentTarget.value = ''; }} /></label>
          {coverPhotoError && <p className="error-message" role="alert">{coverPhotoError}</p>}
          {report.coverPhotos.length > 0 && <div className="photo-editor-grid">{report.coverPhotos.map(renderCoverPhoto)}</div>}
        </section>
        <section className="photo-subsection">
          <h2>Photos complémentaires</h2>
          <p className="field-help">Ces photos apparaîtront dans les pages intérieures, après le contenu du rapport. Limite combinée : {MAX_IMAGES} photos et 18 Mo après compression.</p>
          <label className="file-picker"><span>Ajouter des photos complémentaires</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addPhotos('photos', event.target.files); event.currentTarget.value = ''; }} /></label>
          {photoError && <p className="error-message" role="alert">{photoError}</p>}
          {report.photos.length > 0 && <div className="photo-editor-grid">{report.photos.map(renderAdditionalPhoto)}</div>}
        </section>
      </fieldset>

      <fieldset className="form-section report-content-sections">
        <legend>4. Contenu du rapport</legend>
        {REPORT_RUBRICS.slice(1).map((rubric) => <section className="content-rubric" key={rubric.id}>
          <h2>{rubric.title}</h2>
          <div className="form-grid">
            {rubric.fields.map((field) => <label className={`field field-${field.key}${field.kind === 'textarea' || field.kind === 'url' ? ' full-field' : ''}`} key={field.key}>
              <span>{field.label}{field.required ? ' *' : ''}</span>
              {field.kind === 'textarea' ? <textarea name={field.key} rows={4} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />
                : <input name={field.key} type={field.kind === 'number' ? 'number' : field.kind} min={field.kind === 'number' ? '0' : undefined} step={field.kind === 'number' ? '1' : undefined} max={field.kind === 'number' ? '1000000' : undefined} required={field.required} value={report[field.key]} onChange={(event) => update(field.key, event.target.value)} />}
              {field.help && <small>{field.help}</small>}
            </label>)}
          </div>
          {rubric.id === 'testimonials' && <div className="testimonial-audio">
            <h3>Enregistrement audio <span className="optional">facultatif</span></h3>
            <p className="field-help">Importez un enregistrement AAC, M4A, MP3, OGG, WAV ou WebM (25 Mo maximum). Il sera joint au PDF. Pour le récupérer, téléchargez le PDF et ouvrez sa liste de pièces jointes dans un lecteur compatible.</p>
            <label className="file-picker"><span>{report.testimonialAudio ? 'Remplacer l’enregistrement' : 'Importer un enregistrement'}</span><input type="file" accept="audio/*,.aac,.m4a,.mp3,.ogg,.wav,.webm" onChange={(event) => { void chooseTestimonialAudio(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
            {audioError && <p className="error-message" role="alert">{audioError}</p>}
            {report.testimonialAudio && <div className="testimonial-audio-preview"><strong>{report.testimonialAudio.name}</strong><audio controls preload="metadata" src={report.testimonialAudio.previewUrl}>La lecture audio n’est pas prise en charge par ce navigateur.</audio><button type="button" className="text-button danger-text" onClick={() => { if (report.testimonialAudio) releaseUrl(report.testimonialAudio.previewUrl); setReport((current) => ({ ...current, testimonialAudio: null })); }}>Retirer l’enregistrement</button></div>}
          </div>}
        </section>)}
      </fieldset>

      {errors.length > 0 && <div className="error-summary" role="alert"><strong>Vérifiez les éléments suivants :</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <section className="generate-panel">
        <div><div className="eyebrow">5. Aperçu et génération</div><h2>Vérifier le rapport</h2><p>Le document complet s’ouvrira juste sous ce formulaire pour une dernière vérification avant téléchargement.</p></div>
        <button className="button submit-button" type="submit" disabled={working}>{working ? 'Génération du PDF…' : 'Prévisualiser et générer le PDF'}</button>
      </section>
    </form>

    {pdfUrl && <section className="preview-section" id="pdf-preview"><div className="section-heading"><div><div className="eyebrow">Document généré localement</div><h2>Aperçu du rapport complet</h2></div><a className="button" href={pdfUrl} download={pdfName}>Télécharger le PDF</a></div>
      <p>L’aperçu affiche le PDF qui sera téléchargé. Revenez aux champs ci-dessus pour corriger les informations, logos ou photos et générer une nouvelle version.</p>
      <div className="publication-actions"><button type="button" className="button button-light" onClick={downloadPublicationEntry}>Télécharger la fiche de publication JSON</button></div>
      <iframe className="pdf-frame" title="Aperçu du PDF généré" src={pdfUrl} />
    </section>}
  </main>;
}
