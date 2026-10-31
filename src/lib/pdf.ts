import {
  PDFDocument,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { REPORT_RUBRICS, type ImageAsset, type PhotoAsset, type ReportDraft } from './report.ts';

export type PdfImage = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' };
export type PdfBranding = { leftLogo?: PdfImage; rightLogo?: PdfImage };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const GREEN = rgb(0.08, 0.27, 0.21);
const DEEP_GREEN = rgb(0.04, 0.18, 0.15);
const GOLD = rgb(0.69, 0.49, 0.17);
const INK = rgb(0.15, 0.18, 0.17);
const MUTED = rgb(0.39, 0.43, 0.41);
const RULE = rgb(0.82, 0.84, 0.81);
const PALE = rgb(0.96, 0.96, 0.92);
const WHITE = rgb(1, 1, 1);

async function embedImage(document: PDFDocument, image: PdfImage | ImageAsset): Promise<PDFImage> {
  return image.mimeType === 'image/png' ? document.embedPng(image.bytes) : document.embedJpg(image.bytes);
}

function fit(image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: x + (maxWidth - width) / 2, y: y + (maxHeight - height) / 2, width, height };
}

function drawCroppedImage(target: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  target.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  target.drawImage(image, {
    x: x + (width - drawnWidth) / 2,
    y: y + (height - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  });
  target.pushOperators(popGraphicsState());
  target.drawRectangle({ x, y, width, height, borderColor: RULE, borderWidth: 0.6 });
}

function wrap(text: string, fontSize: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { result.push(''); continue; }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) { line = candidate; continue; }
      if (line) result.push(line);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) line = word;
      else {
        let fragment = '';
        for (const character of word) {
          if (fragment && font.widthOfTextAtSize(fragment + character, fontSize) > maxWidth) {
            result.push(fragment);
            fragment = character;
          } else fragment += character;
        }
        line = fragment;
      }
    }
    if (line) result.push(line);
  }
  return result;
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

export async function buildReportPdf(report: ReportDraft, branding: PdfBranding = {}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  if (report.testimonialAudio) {
    await document.attach(report.testimonialAudio.bytes, report.testimonialAudio.name, {
      mimeType: report.testimonialAudio.mimeType,
      description: 'Enregistrement audio du témoignage',
    });
  }
  document.setTitle(`Rapport d’activité — ${report.activityName}`);
  if (report.organization.trim()) document.setAuthor(report.organization.trim());
  document.setSubject('Rapport d’activité');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const leftLogo = branding.leftLogo ? await embedImage(document, branding.leftLogo) : undefined;
  const rightLogo = branding.rightLogo ? await embedImage(document, branding.rightLogo) : undefined;
  const embeddedCoverPhotos = await Promise.all((report.coverPhotos ?? []).map((photo) => embedImage(document, photo)));
  const cover = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const drawCoverHeader = () => {
    const logoBox = 62;
    const logoY = PAGE_HEIGHT - 103;
    if (leftLogo) cover.drawImage(leftLogo, fit(leftLogo, MARGIN, logoY, logoBox, 62));
    if (rightLogo) cover.drawImage(rightLogo, fit(rightLogo, PAGE_WIDTH - MARGIN - logoBox, logoY, logoBox, 62));

    const organization = report.organization.trim();
    if (organization) {
      const centerWidth = PAGE_WIDTH - MARGIN * 2 - logoBox * 2 - 22;
      const lines = wrap(organization, 9.2, bold, centerWidth);
      const lineHeight = 12;
      let lineY = PAGE_HEIGHT - 54 + ((Math.max(lines.length, 1) - 1) * lineHeight) / 2;
      for (const line of lines) {
        const textWidth = bold.widthOfTextAtSize(line, 9.2);
        cover.drawText(line, { x: (PAGE_WIDTH - textWidth) / 2, y: lineY, size: 9.2, font: bold, color: GREEN });
        lineY -= lineHeight;
      }
    }
    cover.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 119 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 119 }, thickness: 1.2, color: GOLD });
  };

  let coverY = PAGE_HEIGHT - 158;
  const drawCoverLabel = (text: string, y: number) => cover.drawText(text, { x: MARGIN, y, size: 8.8, font: bold, color: GOLD });
  const drawCoverValue = (text: string, x: number, y: number, width: number, size: number, color = INK, maxLines = 4) => {
    const lines = wrap(text, size, regular, width).slice(0, maxLines);
    for (const [index, line] of lines.entries()) cover.drawText(line, { x, y: y - index * (size + 3), size, font: regular, color });
    return lines.length * (size + 3);
  };

  drawCoverHeader();
  drawCoverLabel('RAPPORT D’ACTIVITÉ', coverY);
  coverY -= 27;
  const title = report.activityName.trim();
  let titleSize = 27;
  let titleLines = wrap(title, titleSize, bold, PAGE_WIDTH - MARGIN * 2);
  if (titleLines.length > 3) {
    titleSize = 21;
    titleLines = wrap(title, titleSize, bold, PAGE_WIDTH - MARGIN * 2);
  }
  if (titleLines.length > 4) {
    titleSize = 17;
    titleLines = wrap(title, titleSize, bold, PAGE_WIDTH - MARGIN * 2);
  }
  for (const line of titleLines) {
    cover.drawText(line, { x: MARGIN, y: coverY, size: titleSize, font: bold, color: DEEP_GREEN });
    coverY -= titleSize + 5;
  }
  coverY -= 9;

  const theme = report.theme.trim();
  if (theme) {
    const themeLines = wrap(theme, 14.2, bold, PAGE_WIDTH - MARGIN * 2 - 34);
    const panelHeight = Math.max(65, themeLines.length * 18 + 34);
    const panelTop = coverY;
    cover.drawRectangle({ x: MARGIN, y: panelTop - panelHeight, width: PAGE_WIDTH - MARGIN * 2, height: panelHeight, color: GREEN });
    cover.drawText('THÈME', { x: MARGIN + 17, y: panelTop - 20, size: 8, font: bold, color: rgb(0.94, 0.82, 0.55) });
    for (const [index, line] of themeLines.entries()) cover.drawText(line, { x: MARGIN + 17, y: panelTop - 43 - index * 17, size: 14.2, font: bold, color: WHITE });
    coverY = panelTop - panelHeight - 10;
  }

  const date = dateLabel(report.activityDate.trim());
  const coverInfo: Array<[string, string]> = [
    ...(date ? [['DATE', date] as [string, string]] : []),
    ...(report.place.trim() ? [['LIEU', report.place.trim()] as [string, string]] : []),
    ...(report.organizer.trim() ? [['ORGANISATEUR', report.organizer.trim()] as [string, string]] : []),
    ...(report.preparedBy.trim() ? [['RESPONSABLE DU RAPPORT', report.preparedBy.trim()] as [string, string]] : []),
  ];
  for (let index = 0; index < coverInfo.length; index += 2) {
    const pair = coverInfo.slice(index, index + 2);
    const cellWidth = (PAGE_WIDTH - MARGIN * 2 - (pair.length === 2 ? 10 : 0)) / pair.length;
    const values = pair.map(([, value]) => wrap(value, 10.5, regular, cellWidth - 28).slice(0, 3));
    const cardHeight = Math.max(55, ...values.map((lines) => 31 + lines.length * 13));
    for (const [cell, [label, value]] of pair.entries()) {
      const x = MARGIN + cell * (cellWidth + (pair.length === 2 ? 10 : 0));
      cover.drawRectangle({ x, y: coverY - cardHeight, width: cellWidth, height: cardHeight, color: PALE, borderColor: RULE, borderWidth: 0.5 });
      cover.drawText(label, { x: x + 14, y: coverY - 17, size: 7.6, font: bold, color: GOLD });
      drawCoverValue(value, x + 14, coverY - 36, cellWidth - 28, 10.5, INK, 3);
    }
    coverY -= cardHeight + 9;
  }

  if (embeddedCoverPhotos.length) {
    const remainingHeight = Math.max(118, coverY - 75);
    const gridHeight = Math.min(252, remainingHeight);
    const gridTop = coverY - 9;
    const gridBottom = Math.max(64, gridTop - gridHeight);
    const gridX = MARGIN;
    const gridWidth = PAGE_WIDTH - MARGIN * 2;
    const mainIndex = Math.max(0, Math.min(report.coverPhotoIndex ?? 0, embeddedCoverPhotos.length - 1));
    const order = [mainIndex, ...embeddedCoverPhotos.map((_, index) => index).filter((index) => index !== mainIndex)];
    const photoGap = 7;
    if (order.length === 1) {
      drawCroppedImage(cover, embeddedCoverPhotos[order[0]], gridX, gridBottom, gridWidth, gridTop - gridBottom);
    } else {
      const mainWidth = gridWidth * 0.64;
      const secondaryX = gridX + mainWidth + photoGap;
      const secondaryWidth = gridWidth - mainWidth - photoGap;
      const secondaryCount = order.length - 1;
      const cellHeight = (gridTop - gridBottom - photoGap * (secondaryCount - 1)) / secondaryCount;
      drawCroppedImage(cover, embeddedCoverPhotos[order[0]], gridX, gridBottom, mainWidth, gridTop - gridBottom);
      for (let index = 0; index < secondaryCount; index += 1) {
        const cellTop = gridTop - index * (cellHeight + photoGap);
        drawCroppedImage(cover, embeddedCoverPhotos[order[index + 1]], secondaryX, cellTop - cellHeight, secondaryWidth, cellHeight);
      }
    }
  } else {
    cover.drawRectangle({ x: MARGIN, y: 106, width: PAGE_WIDTH - MARGIN * 2, height: 1, color: RULE });
    cover.drawCircle({ x: PAGE_WIDTH - MARGIN - 26, y: 139, size: 7, color: GOLD });
    cover.drawCircle({ x: PAGE_WIDTH - MARGIN - 26, y: 139, size: 2.4, color: WHITE });
  }

  const innerPages: PDFPage[] = [];
  let page: PDFPage | undefined;
  let y = 0;
  const drawInnerHeader = (target: PDFPage) => {
    if (leftLogo) target.drawImage(leftLogo, fit(leftLogo, MARGIN, PAGE_HEIGHT - 66, 25, 27));
    if (rightLogo) target.drawImage(rightLogo, fit(rightLogo, PAGE_WIDTH - MARGIN - 25, PAGE_HEIGHT - 66, 25, 27));
    const organization = report.organization.trim();
    if (organization) {
      const size = 8;
      const lines = wrap(organization, size, bold, PAGE_WIDTH - MARGIN * 2 - 76).slice(0, 2);
      for (const [index, line] of lines.entries()) {
        const textWidth = bold.widthOfTextAtSize(line, size);
        target.drawText(line, { x: (PAGE_WIDTH - textWidth) / 2, y: PAGE_HEIGHT - 48 - index * 10, size, font: bold, color: GREEN });
      }
    }
    target.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 77 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 77 }, thickness: 0.7, color: RULE });
  };
  const addContentPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    innerPages.push(page);
    drawInnerHeader(page);
    y = PAGE_HEIGHT - 105;
  };
  const ensurePage = () => { if (!page) addContentPage(); };
  const ensureSpace = (height: number) => {
    ensurePage();
    if (y - height < 58) addContentPage();
  };
  const drawParagraph = (text: string, font = regular, fontSize = 10.3, color = INK, maxWidth = PAGE_WIDTH - MARGIN * 2) => {
    const lines = wrap(text, fontSize, font, maxWidth);
    for (const line of lines) {
      ensureSpace(line ? fontSize + 7 : 8);
      if (line) page!.drawText(line, { x: MARGIN, y, size: fontSize, font, color });
      y -= line ? fontSize + 6 : 7;
    }
  };
  const drawSectionTitle = (titleText: string) => {
    // Keep the heading together with the first field label and its first line.
    ensureSpace(64);
    y -= 2;
    page!.drawText(titleText.toLocaleUpperCase('fr-FR'), { x: MARGIN, y, size: 9.2, font: bold, color: GREEN });
    y -= 7;
    page!.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.45, color: RULE });
    y -= 16;
  };
  const drawField = (label: string, value: string) => {
    if (!value.trim()) return;
    const formatted = label.startsWith('Date') ? dateLabel(value) : value;
    drawParagraph(label, bold, 8.8, GOLD);
    drawParagraph(formatted, regular, 10.2, INK);
    y -= 5;
  };

  for (const rubric of REPORT_RUBRICS.filter((entry) => entry.id !== 'general')) {
    const fields = rubric.fields.map((field) => ({ field, value: fieldValue(report, field.key) })).filter(({ value }) => value);
    const audioTestimonial = rubric.id === 'testimonials' ? report.testimonialAudio : null;
    if (!fields.length && !audioTestimonial) continue;
    drawSectionTitle(rubric.title);
    for (const { field, value } of fields) drawField(field.label, value);
    if (audioTestimonial) drawField('Enregistrement audio joint au PDF', audioTestimonial.name);
  }

  const albumUrl = report.photoAlbumUrl.trim();
  if (albumUrl) {
    drawSectionTitle('Album de l’activité');
    drawParagraph(albumUrl, regular, 9.5, GREEN);
  }

  const photos: PhotoAsset[] = report.photos ?? [];
  if (photos.length) {
    const firstEmbedded = await embedImage(document, photos[0]);
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const maxHeight = 245;
    const firstDimensions = fit(firstEmbedded, 0, 0, maxWidth, maxHeight);
    const firstCaptionLines = photos[0].caption.trim() ? wrap(photos[0].caption.trim(), 8.7, regular, maxWidth) : [];
    ensureSpace(36 + firstDimensions.height + 28 + firstCaptionLines.length * 14);
    drawSectionTitle('Photographies complémentaires');
    for (const [index, photo] of photos.entries()) {
      const embedded = index === 0 ? firstEmbedded : await embedImage(document, photo);
      const dimensions = fit(embedded, 0, 0, maxWidth, maxHeight);
      const captionLines = photo.caption.trim() ? wrap(photo.caption.trim(), 8.7, regular, maxWidth) : [];
      ensureSpace(dimensions.height + 18 + captionLines.length * 14);
      page!.drawImage(embedded, fit(embedded, MARGIN, y - dimensions.height, maxWidth, dimensions.height));
      y -= dimensions.height + 10;
      if (captionLines.length) drawParagraph(photo.caption.trim(), regular, 8.7, MUTED);
      y -= 12;
    }
  }

  for (let index = 0; index < innerPages.length; index += 1) {
    const current = innerPages[index];
    current.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: PAGE_WIDTH - MARGIN, y: 43 }, thickness: 0.5, color: RULE });
    if (report.organization.trim()) current.drawText(report.organization.trim(), { x: MARGIN, y: 28, size: 7.1, font: regular, color: MUTED, maxWidth: PAGE_WIDTH - MARGIN * 2 - 78 });
    const pagination = `Page ${index + 1} / ${innerPages.length}`;
    const paginationWidth = regular.widthOfTextAtSize(pagination, 7.3);
    current.drawText(pagination, { x: PAGE_WIDTH - MARGIN - paginationWidth, y: 28, size: 7.3, font: regular, color: MUTED });
  }

  return document.save({ useObjectStreams: false });
}
