export type ImageAsset = {
  name: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
  previewUrl?: string;
};

export type PhotoAsset = ImageAsset & { caption: string };

export type ReportDraft = {
  activityName: string;
  organization: string;
  activityDate: string;
  place: string;
  theme: string;
  organizer: string;
  participants: string;
  context: string;
  objectives: string;
  course: string;
  results: string;
  testimonials: string;
  difficulties: string;
  conclusion: string;
  perspectives: string;
  preparedBy: string;
  validatedBy: string;
  validationDate: string;
  photoAlbumUrl: string;
  logoLeft?: ImageAsset | null;
  logoRight?: ImageAsset | null;
  coverPhotos: PhotoAsset[];
  coverPhotoIndex: number;
  photos: PhotoAsset[];
};

export type ReportField = {
  key: Exclude<keyof ReportDraft, 'coverPhotos' | 'photos' | 'coverPhotoIndex' | 'logoLeft' | 'logoRight'>;
  label: string;
  kind: 'text' | 'date' | 'number' | 'textarea' | 'url';
  required?: boolean;
  help?: string;
};

export type ReportRubric = { id: string; title: string; fields: ReportField[] };

// The form and PDF share this registry: labels and section order can be changed here.
export const REPORT_RUBRICS: ReportRubric[] = [
  {
    id: 'general',
    title: 'Informations générales de l’activité',
    fields: [
      { key: 'activityName', label: 'Titre du rapport / activité', kind: 'text', required: true },
      { key: 'organization', label: 'Église, communauté, paroisse ou service', kind: 'text' },
      { key: 'theme', label: 'Thème de l’activité', kind: 'text' },
      { key: 'activityDate', label: 'Date de l’activité', kind: 'date', required: true },
      { key: 'place', label: 'Lieu', kind: 'text' },
      { key: 'organizer', label: 'Organisateur', kind: 'text' },
      { key: 'preparedBy', label: 'Responsable du rapport', kind: 'text' },
      { key: 'photoAlbumUrl', label: 'Lien de l’album Google Photos', kind: 'url', help: 'Facultatif. Le lien doit être partagé avec les visiteurs autorisés.' },
    ],
  },
  {
    id: 'preparation',
    title: 'Contexte et objectifs',
    fields: [
      { key: 'context', label: 'Contexte', kind: 'textarea' },
      { key: 'objectives', label: 'Objectifs', kind: 'textarea' },
    ],
  },
  { id: 'course', title: 'Déroulement', fields: [{ key: 'course', label: 'Déroulement de l’activité', kind: 'textarea' }] },
  {
    id: 'headcount',
    title: 'Effectif',
    fields: [{ key: 'participants', label: 'Nombre de participants', kind: 'number' }],
  },
  { id: 'results', title: 'Résultats et faits marquants', fields: [{ key: 'results', label: 'Résultats et faits marquants', kind: 'textarea' }] },
  { id: 'testimonials', title: 'Témoignages', fields: [{ key: 'testimonials', label: 'Témoignages autorisés', kind: 'textarea', help: 'N’ajoutez que des témoignages dont la publication a été autorisée.' }] },
  { id: 'difficulties', title: 'Difficultés éventuelles', fields: [{ key: 'difficulties', label: 'Difficultés rencontrées', kind: 'textarea' }] },
  {
    id: 'closing',
    title: 'Conclusion et perspectives',
    fields: [
      { key: 'conclusion', label: 'Conclusion', kind: 'textarea' },
      { key: 'perspectives', label: 'Perspectives', kind: 'textarea' },
    ],
  },
  {
    id: 'validation',
    title: 'Rédaction et validation',
    fields: [
      { key: 'validatedBy', label: 'Rapport validé par', kind: 'text' },
      { key: 'validationDate', label: 'Date de validation', kind: 'date' },
    ],
  },
];

export const EMPTY_REPORT: ReportDraft = {
  activityName: '', organization: '', activityDate: '', place: '', theme: '', organizer: '', participants: '', context: '', objectives: '',
  course: '', results: '', testimonials: '', difficulties: '', conclusion: '',
  perspectives: '', preparedBy: '', validatedBy: '', validationDate: '', photoAlbumUrl: '', coverPhotos: [], coverPhotoIndex: 0, photos: [],
};

export function validatePhotoAlbumUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !['photos.google.com', 'photos.app.goo.gl'].includes(url.hostname) || url.username || url.password || url.port) return 'Utilisez un lien HTTPS Google Photos valide.';
    return null;
  } catch {
    return 'Utilisez un lien HTTPS Google Photos valide.';
  }
}

export function validateReport(report: ReportDraft): string[] {
  const errors: string[] = [];
  if (!report.activityName.trim()) errors.push('L’intitulé de l’activité est requis.');
  if (!report.activityDate || Number.isNaN(Date.parse(report.activityDate))) errors.push('Une date d’activité valide est requise.');
  if (report.participants.trim() && (!/^\d+$/.test(report.participants.trim()) || Number(report.participants) > 1000000)) errors.push('L’effectif doit être un nombre entier positif.');
  const albumError = validatePhotoAlbumUrl(report.photoAlbumUrl);
  if (albumError) errors.push(albumError);
  return errors;
}

export type PublishedReport = {
  id: string;
  title: string;
  date: string;
  place?: string;
  summary?: string;
  pdf: string;
  photoAlbumUrl?: string;
};

export function validatePublishedReports(value: unknown): PublishedReport[] {
  if (!Array.isArray(value)) throw new Error('src/data/reports.json doit contenir une liste de rapports.');
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') throw new Error(`La fiche de rapport ${index + 1} est invalide.`);
    const report = candidate as Record<string, unknown>;
    if (typeof report.id !== 'string' || !report.id.trim() || typeof report.title !== 'string' || !report.title.trim()) throw new Error(`La fiche de rapport ${index + 1} doit avoir un identifiant et un titre.`);
    if (typeof report.date !== 'string' || Number.isNaN(Date.parse(report.date))) throw new Error(`La date de la fiche ${report.title} est invalide.`);
    if (typeof report.pdf !== 'string' || !report.pdf.startsWith('rapports/') || report.pdf.includes('..') || report.pdf.startsWith('/')) throw new Error(`Le chemin PDF de la fiche ${report.title} doit désigner un fichier dans public/rapports/.`);
    for (const key of ['place', 'summary'] as const) if (report[key] !== undefined && typeof report[key] !== 'string') throw new Error(`Le champ ${key} de la fiche ${report.title} doit être du texte.`);
    if (report.photoAlbumUrl !== undefined && typeof report.photoAlbumUrl !== 'string') throw new Error(`Le lien Google Photos de la fiche ${report.title} est invalide.`);
    if (typeof report.photoAlbumUrl === 'string' && validatePhotoAlbumUrl(report.photoAlbumUrl)) throw new Error(`Le lien Google Photos de la fiche ${report.title} doit être HTTPS et utiliser un domaine autorisé.`);
    return report as unknown as PublishedReport;
  });
}

export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rapport-activite';
}

