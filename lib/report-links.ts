export const reportLinkTypes = ['photos_album', 'drive_video', 'drive_document'] as const;
export type ReportLinkType = (typeof reportLinkTypes)[number];

const allowedHosts = new Set([
  'photos.google.com',
  'photos.app.goo.gl',
  'drive.google.com',
  'docs.google.com',
]);

export function validateReportLink(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      !allowedHosts.has(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port ||
      url.href.length > 2048
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export function reportLinkLabel(type: ReportLinkType) {
  if (type === 'photos_album') return 'Voir les photos';
  if (type === 'drive_video') return 'Regarder la vidéo';
  return 'Consulter les documents';
}
