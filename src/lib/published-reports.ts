export type PublishedReport = {
  id: string;
  title: string;
  date: string;
  place?: string;
  summary?: string;
  pdf: string;
  photoAlbumUrl?: string;
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
