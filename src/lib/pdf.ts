import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import { REPORT_RUBRICS, type PhotoAsset, type ReportDraft } from './report.ts';
import { BRANDING } from '../data/branding.ts';

export type PdfImage = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' };
export type PdfBranding = { archdioceseLogo: PdfImage; renewalLogo: PdfImage };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const GREEN = rgb(0.08, 0.27, 0.21);
const GOLD = rgb(0.69, 0.49, 0.17);
const INK = rgb(0.15, 0.18, 0.17);
const MUTED = rgb(0.39, 0.43, 0.41);
const RULE = rgb(0.82, 0.84, 0.81);

async function embedImage(document: PDFDocument, image: PdfImage): Promise<PDFImage> {
  return image.mimeType === 'image/png' ? document.embedPng(image.bytes) : document.embedJpg(image.bytes);
}

function fit(image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { x: x + (maxWidth - image.width * scale) / 2, y: y + (maxHeight - image.height * scale) / 2, width: image.width * scale, height: image.height * scale };
}

function fieldValue(report: ReportDraft, key: keyof ReportDraft): string {
  const value = report[key];
  return typeof value === 'string' ? value.trim() : '';
}

function dateLabel(value: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

export async function buildReportPdf(report: ReportDraft, branding: PdfBranding): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Rapport d’activité — ${report.activityName}`);
  document.setAuthor('Service Jeune du Renouveau Charismatique Catholique de Cotonou');
  document.setSubject('Rapport d’activité');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const archdioceseLogo = await embedImage(document, branding.archdioceseLogo);
  const renewalLogo = await embedImage(document, branding.renewalLogo);
  const pageList: PDFPage[] = [];
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pageList.push(page);
  let y = PAGE_HEIGHT - 132;

  const drawHeader = (target: PDFPage) => {
    const logoY = PAGE_HEIGHT - 94;
    target.drawImage(archdioceseLogo, fit(archdioceseLogo, MARGIN, logoY, 54, 60));
    target.drawImage(renewalLogo, fit(renewalLogo, PAGE_WIDTH - MARGIN - 54, logoY, 54, 60));
    const centerX = PAGE_WIDTH / 2;
    const lines: Array<[string, number, ReturnType<typeof rgb>]> = [
      [BRANDING.mentions.archdiocese, 8.6, rgb(0.10, 0.20, 0.35)],
      [BRANDING.mentions.prayerGroup, 7.3, GREEN],
      [BRANDING.mentions.service, 6.5, GOLD],
    ];
    let lineY = PAGE_HEIGHT - 50;
    const centerWidth = PAGE_WIDTH - MARGIN * 2 - 54 * 2 - 18;
    for (const [text, size, color] of lines) {
      for (const wrappedLine of wrap(text, size, bold, centerWidth)) {
        const textWidth = bold.widthOfTextAtSize(wrappedLine, size);
        target.drawText(wrappedLine, { x: centerX - textWidth / 2, y: lineY, size, font: bold, color });
        lineY -= 10;
      }
    }
    target.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 106 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 106 }, thickness: 1, color: GOLD });
  };
  const addPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageList.push(page);
    drawHeader(page);
    y = PAGE_HEIGHT - 132;
  };
  const ensureSpace = (height: number) => { if (y - height < 58) addPage(); };
  const wrap = (text: string, fontSize: number, font: typeof regular, maxWidth: number): string[] => {
    const result: string[] = [];
    for (const paragraph of text.replace(/\r/g, '').split('\n')) {
      if (!paragraph.trim()) { result.push(''); continue; }
      const words = paragraph.trim().split(/\s+/);
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) { line = candidate; continue; }
        if (line) result.push(line);
        if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) line = word;
        else {
          let fragment = '';
          for (const character of word) {
            if (fragment && font.widthOfTextAtSize(fragment + character, fontSize) > maxWidth) { result.push(fragment); fragment = character; }
            else fragment += character;
          }
          line = fragment;
        }
      }
      if (line) result.push(line);
    }
    return result;
  };
  const drawParagraph = (text: string, font: typeof regular = regular, fontSize = 10.3, color = INK, maxWidth = PAGE_WIDTH - MARGIN * 2) => {
    const lines = wrap(text, fontSize, font, maxWidth);
    for (const line of lines) {
      ensureSpace(line ? fontSize + 7 : 8);
      if (line) page.drawText(line, { x: MARGIN, y, size: fontSize, font, color });
      y -= line ? fontSize + 6 : 7;
    }
  };
  const drawSectionTitle = (title: string) => {
    ensureSpace(36);
    y -= 2;
    page.drawText(title.toLocaleUpperCase('fr-FR'), { x: MARGIN, y, size: 9.2, font: bold, color: GREEN });
    y -= 7;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.45, color: RULE });
    y -= 16;
  };
  const drawField = (label: string, value: string) => {
    if (!value.trim()) return;
    const dateValue = label.startsWith('Date') ? dateLabel(value) : value;
    drawParagraph(label, bold, 9.1, GOLD);
    drawParagraph(dateValue, regular, 10.3, INK);
    y -= 5;
  };

  drawHeader(page);
  page.drawText('RAPPORT D’ACTIVITÉ', { x: MARGIN, y, size: 9.2, font: bold, color: GOLD });
  y -= 22;
  drawParagraph(report.activityName.trim(), bold, 18, GREEN);
  y -= 6;

  for (const rubric of REPORT_RUBRICS) {
    const populatedFields = rubric.fields.filter((field) => fieldValue(report, field.key));
    if (!populatedFields.length) continue;
    drawSectionTitle(rubric.title);
    for (const field of populatedFields) drawField(field.label, fieldValue(report, field.key));
  }

  const photos: PhotoAsset[] = report.photos ?? [];
  if (photos.length) {
    const photoMaxHeight = 230;
    const firstCaptionHeight = photos[0].caption.trim() ? wrap(photos[0].caption.trim(), 8.7, regular, PAGE_WIDTH - MARGIN * 2).length * 14 : 0;
    ensureSpace(36 + photoMaxHeight + 24 + firstCaptionHeight);
    drawSectionTitle('Photographies de l’activité');
    for (const photo of photos) {
      const embedded = await embedImage(document, photo);
      const maxHeight = photoMaxHeight;
      const captionLines = photo.caption.trim() ? wrap(photo.caption.trim(), 8.7, regular, PAGE_WIDTH - MARGIN * 2) : [];
      const estimated = maxHeight + 24 + captionLines.length * 14;
      ensureSpace(Math.min(estimated, PAGE_HEIGHT - 180));
      const fitted = fit(embedded, MARGIN, y - maxHeight, PAGE_WIDTH - MARGIN * 2, maxHeight);
      page.drawImage(embedded, fitted);
      y = fitted.y - 12;
      if (captionLines.length) {
        drawParagraph(photo.caption.trim(), regular, 8.7, MUTED);
      }
      y -= 10;
    }
  }

  for (let index = 0; index < pageList.length; index += 1) {
    const current = pageList[index];
    current.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: PAGE_WIDTH - MARGIN, y: 43 }, thickness: 0.5, color: RULE });
    current.drawText(BRANDING.mentions.service, { x: MARGIN, y: 28, size: 7.3, font: regular, color: MUTED, maxWidth: PAGE_WIDTH - MARGIN * 2 - 70 });
    const pagination = `Page ${index + 1} sur ${pageList.length}`;
    const paginationWidth = regular.widthOfTextAtSize(pagination, 7.3);
    current.drawText(pagination, { x: PAGE_WIDTH - MARGIN - paginationWidth, y: 28, size: 7.3, font: regular, color: MUTED });
  }
  return document.save({ useObjectStreams: false });
}

