import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildReportPdf } from '../src/lib/pdf.ts';
import { createPdfBlob } from '../src/lib/download.ts';
import { EMPTY_REPORT } from '../src/lib/report.ts';

const logos = {
  archdioceseLogo: { bytes: new Uint8Array(readFileSync(new URL('../public/identite/archidiocese-cotonou.jpg', import.meta.url))), mimeType: 'image/jpeg' },
  renewalLogo: { bytes: new Uint8Array(readFileSync(new URL('../public/identite/renouveau-charismatique.jpg', import.meta.url))), mimeType: 'image/jpeg' },
};
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHZsAAAAASUVORK5CYII=', 'base64'));

function sample(overrides = {}) {
  return { ...EMPTY_REPORT, activityName: 'Veillée de prière', activityDate: '2026-10-27', place: 'Cotonou', theme: 'Grandir dans la foi', ...overrides };
}

test('génère un PDF lisible sans photo facultative', async () => {
  const bytes = await buildReportPdf(sample(), logos);
  const pdf = Buffer.from(bytes);
  assert.ok(pdf.toString('latin1').startsWith('%PDF-'));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getTitle(), 'Rapport d’activité — Veillée de prière');
  assert.equal(document.getPageCount(), 1);
  assert.ok((pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= 2, 'les deux logos officiels sont intégrés');
});

test('intègre plusieurs photos directement au PDF', async () => {
  const bytes = await buildReportPdf(sample({ photos: [
    { name: 'photo-1.png', bytes: png, mimeType: 'image/png', caption: 'Prière communautaire.' },
    { name: 'photo-2.png', bytes: png, mimeType: 'image/png', caption: 'Temps de partage.' },
  ] }), logos);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 1);
  assert.ok((Buffer.from(bytes).toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= 4);
});

test('préserve les accents français et pagine les contenus longs', async () => {
  const longText = 'Célébration, fraternité, prière et évangélisation : les participants ont partagé leur expérience et préparé la prochaine activité. '.repeat(55);
  const bytes = await buildReportPdf(sample({ context: longText, course: longText, conclusion: 'La communauté a été édifiée.' }), logos);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1, 'le texte long doit se poursuivre sur une nouvelle page');
});

test('prépare le PDF téléchargeable avec le type MIME attendu', async () => {
  const bytes = await buildReportPdf(sample(), logos);
  const blob = createPdfBlob(bytes);
  assert.equal(blob.type, 'application/pdf');
  assert.equal(blob.size, bytes.byteLength);
  assert.ok(Buffer.from(await blob.arrayBuffer()).toString('latin1').startsWith('%PDF-'));
});
