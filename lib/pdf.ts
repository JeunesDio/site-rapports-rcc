import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib';

export type PdfImageAsset = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' };
export type PdfOptions = {
  organizationName?: string;
  reportTitle?: string;
  footer?: string;
  logo?: PdfImageAsset | null;
  header?: PdfImageAsset | null;
  cover?: PdfImageAsset | null;
};

async function embedAsset(document: PDFDocument, asset?: PdfImageAsset | null): Promise<PDFImage | null> {
  if (!asset) return null;
  try { return asset.mimeType === 'image/png' ? await document.embedPng(asset.bytes) : await document.embedJpg(asset.bytes); }
  catch { return null; }
}

function drawFit(page: PDFPage, image: PDFImage, box: { x: number; y: number; width: number; height: number }) {
  const fitted = image.scaleToFit(box.width, box.height);
  page.drawImage(image, { x: box.x + (box.width - fitted.width) / 2, y: box.y + (box.height - fitted.height) / 2, width: fitted.width, height: fitted.height });
}

export async function makePdf(title: string, lines: string[], options: PdfOptions = {}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setAuthor(options.organizationName ?? 'Diocèse des Jeunes RCC de Cotonou');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedAsset(document, options.logo);
  const header = await embedAsset(document, options.header);
  const cover = await embedAsset(document, options.cover);
  const width = 595.28, height = 841.89, margin = 48;
  const pages: PDFPage[] = [];
  let page = document.addPage([width, height]); pages.push(page);
  let y = height - 48;

  function drawPageHeader(target: PDFPage) {
    target.drawLine({ start: { x: margin, y: height - 88 }, end: { x: width - margin, y: height - 88 }, thickness: 0.7, color: rgb(0.83, 0.85, 0.82) });
    if (logo) drawFit(target, logo, { x: margin, y: height - 76, width: 60, height: 40 });
    const offset = logo ? 72 : 0;
    target.drawText(options.organizationName ?? 'Diocèse des Jeunes RCC de Cotonou', { x: margin + offset, y: height - 55, size: 9, font: bold, color: rgb(0.09, 0.29, 0.22), maxWidth: width - margin * 2 - offset });
    if (header) drawFit(target, header, { x: width - margin - 82, y: height - 78, width: 82, height: 38 });
  }
  drawPageHeader(page);

  if (cover) {
    drawFit(page, cover, { x: margin, y: height - 360, width: width - margin * 2, height: 235 });
    y = height - 390;
  }
  page.drawText(options.reportTitle ?? 'Rapport d’activité', { x: margin, y, size: 10, font: bold, color: rgb(0.64, 0.48, 0.21) });
  y -= 25;
  const titleWords = title.split(/\s+/); let titleLine = '';
  for (const word of titleWords) {
    const candidate = titleLine ? `${titleLine} ${word}` : word;
    if (regular.widthOfTextAtSize(candidate, 21) > width - margin * 2 && titleLine) {
      page.drawText(titleLine, { x: margin, y, size: 21, font: bold, color: rgb(0.10, 0.17, 0.14) }); y -= 27; titleLine = word;
    } else titleLine = candidate;
  }
  if (titleLine) { page.drawText(titleLine, { x: margin, y, size: 21, font: bold, color: rgb(0.10, 0.17, 0.14) }); y -= 30; }
  y -= 8;

  function addPage() {
    page = document.addPage([width, height]); pages.push(page); drawPageHeader(page); y = height - 120;
  }
  function drawWrapped(text: string) {
    if (!text.trim()) { y -= 9; return; }
    const words = text.split(/\s+/); let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(candidate, 10.5) > width - margin * 2 && line) {
        if (y < 64) addPage();
        page.drawText(line, { x: margin, y, size: 10.5, font: regular, color: rgb(0.19, 0.23, 0.21) }); y -= 16; line = word;
      } else line = candidate;
    }
    if (line) { if (y < 64) addPage(); page.drawText(line, { x: margin, y, size: 10.5, font: regular, color: rgb(0.19, 0.23, 0.21) }); y -= 16; }
  }
  lines.forEach(drawWrapped);
  pages.forEach((target, index) => {
    target.drawLine({ start: { x: margin, y: 48 }, end: { x: width - margin, y: 48 }, thickness: 0.6, color: rgb(0.83, 0.85, 0.82) });
    const footer = options.footer?.trim();
    if (footer) target.drawText(footer.slice(0, 100), { x: margin, y: 31, size: 8, font: regular, color: rgb(0.38, 0.42, 0.39), maxWidth: width - margin * 2 - 60 });
    target.drawText(`${index + 1} / ${pages.length}`, { x: width - margin - 48, y: 31, size: 8, font: regular, color: rgb(0.38, 0.42, 0.39) });
  });
  return document.save({ useObjectStreams: false });
}
