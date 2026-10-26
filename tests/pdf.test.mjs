import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { makePdf } from '../lib/pdf.ts';

test('writes a valid PDF header and cross-reference offsets', async () => {
  const bytes = Buffer.from(await makePdf('Rapport RCC', ['Résumé : action réalisée.']));
  const pdf = bytes.toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  const start = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  assert.equal(pdf.slice(start, start + 4), 'xref');
  for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) assert.match(pdf.slice(Number(match[1])), /^\d+ 0 obj/);
});

test('wraps long reports across pages', async () => {
  const bytes = Buffer.from(await makePdf('Rapport RCC', Array.from({ length: 60 }, (_, i) => `Ligne ${i} · résumé de l’activité`)));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 2);
  assert.equal(document.getTitle(), 'Rapport RCC');
});

test('embeds a configured PNG cover in the PDF', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHZsAAAAASUVORK5CYII=', 'base64');
  const bytes = Buffer.from(await makePdf('Rapport illustré', ['Contenu'], { cover: { bytes: png, mimeType: 'image/png' } }));
  assert.match(bytes.toString('latin1'), /\/Subtype \/Image/);
});
