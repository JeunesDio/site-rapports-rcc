import type { PublishedReport, ReportDraft } from './report';

export function makePublicationEntry(report: ReportDraft, pdfPath: string, id = `${report.activityDate}-${report.activityName}`): PublishedReport {
  const summary = report.results.trim() || report.conclusion.trim() || report.objectives.trim();
  return {
    id,
    title: report.activityName.trim(),
    date: report.activityDate,
    ...(report.place.trim() ? { place: report.place.trim() } : {}),
    ...(summary ? { summary } : {}),
    pdf: pdfPath.replace(/^\/+/, ''),
    ...(report.photoAlbumUrl.trim() ? { photoAlbumUrl: report.photoAlbumUrl.trim() } : {}),
  };
}
