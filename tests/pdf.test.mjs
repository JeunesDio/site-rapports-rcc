import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { buildReportPdf } from '../src/lib/pdf.ts';
import { createPdfBlob } from '../src/lib/download.ts';
import { EMPTY_REPORT } from '../src/lib/report.ts';

const archdioceseLogo = { bytes: new Uint8Array(readFileSync(new URL('../public/identite/archidiocese-cotonou.jpg', import.meta.url))), mimeType: 'image/jpeg' };
const renewalLogo = { bytes: new Uint8Array(readFileSync(new URL('../public/identite/renouveau-charismatique.jpg', import.meta.url))), mimeType: 'image/jpeg' };
const logos = { leftLogo: archdioceseLogo, rightLogo: renewalLogo };
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHZsAAAAASUVORK5CYII=', 'base64'));

function sample(overrides = {}) {
  return { ...EMPTY_REPORT, activityName: 'Veillée de prière', organization: 'Service Jeune RCCC', activityDate: '2026-10-27', place: 'Cotonou', theme: 'Grandir dans la foi', ...overrides };
}

function imageCountOnPage(document, index) {
  const resources = document.getPages()[index].node.Resources();
  const xObjects = resources?.lookup(PDFName.of('XObject'), PDFDict);
  return xObjects?.keys().length ?? 0;
}

test('génère un PDF lisible sans photo facultative', async () => {
  const bytes = await buildReportPdf(sample(), logos);
  const pdf = Buffer.from(bytes);
  assert.ok(pdf.toString('latin1').startsWith('%PDF-'));
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getTitle(), 'Rapport d’activité — Veillée de prière');
  assert.equal(document.getPageCount(), 1, 'les champs de couverture seuls ne créent pas de page intérieure vide');
  assert.ok((pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= 2, 'les deux logos officiels sont intégrés');
  assert.equal(imageCountOnPage(document, 0), 2, 'la couverture contient les deux logos');
});

test('intègre plusieurs photos directement au PDF', async () => {
  const bytes = await buildReportPdf(sample({ photos: [
    { name: 'photo-1.png', bytes: png, mimeType: 'image/png', caption: 'Prière communautaire.' },
    { name: 'photo-2.png', bytes: png, mimeType: 'image/png', caption: 'Temps de partage.' },
  ] }), logos);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 2, 'les photos complémentaires commencent après la couverture');
  assert.ok((Buffer.from(bytes).toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length >= 4);
  assert.equal(imageCountOnPage(document, 0), 2, 'les photos complémentaires ne sont pas placées sur la couverture');
  assert.equal(imageCountOnPage(document, 1), 4, 'les deux logos de page et les deux photos complémentaires sont dans les pages intérieures');
});

test('place plusieurs photos de couverture sur la première page avec deux logos', async () => {
  const photos = [
    { name: 'carree.jpg', bytes: archdioceseLogo.bytes, mimeType: 'image/jpeg', caption: 'Photo principale.' },
    { name: 'portrait.jpg', bytes: renewalLogo.bytes, mimeType: 'image/jpeg', caption: 'Vue verticale.' },
  ];
  const document = await PDFDocument.load(await buildReportPdf(sample({ coverPhotos: photos, coverPhotoIndex: 1 }), logos));
  assert.equal(document.getPageCount(), 1);
  assert.equal(imageCountOnPage(document, 0), 4, 'les deux logos et les deux images de couverture sont sur la première page');
});

test('place une seule photo de couverture et un seul logo sans décaler l’en-tête', async () => {
  const coverPhoto = { name: 'photo-unique.jpg', bytes: renewalLogo.bytes, mimeType: 'image/jpeg', caption: '' };
  const document = await PDFDocument.load(await buildReportPdf(sample({ coverPhotos: [coverPhoto] }), { rightLogo: renewalLogo }));
  assert.equal(document.getPageCount(), 1);
  assert.equal(imageCountOnPage(document, 0), 2, 'la couverture garde le logo et la photo');
});

test('accepte un seul logo, aucun logo et aucune photo de couverture', async () => {
  const oneLogo = await PDFDocument.load(await buildReportPdf(sample(), { leftLogo: archdioceseLogo }));
  const noLogos = await PDFDocument.load(await buildReportPdf(sample(), {}));
  const noCoverPhoto = await PDFDocument.load(await buildReportPdf(sample({ coverPhotos: [] }), logos));
  assert.equal(imageCountOnPage(oneLogo, 0), 1);
  assert.equal(imageCountOnPage(noLogos, 0), 0);
  assert.equal(imageCountOnPage(noCoverPhoto, 0), 2, 'sans photo, les logos restent alignés et la couverture est complète');
  assert.equal(noLogos.getPageCount(), 1);
});

test('omet les champs facultatifs vides et ne crée pas de valeurs fictives', async () => {
  const bytes = await buildReportPdf({ ...EMPTY_REPORT, activityName: 'Rapport partiel', activityDate: '2026-10-27' });
  const document = await PDFDocument.load(bytes);
  const raw = Buffer.from(bytes).toString('latin1');
  assert.equal(document.getPageCount(), 1);
  assert.doesNotMatch(raw, /undefined|null/);
  assert.equal(imageCountOnPage(document, 0), 0);
});

test('préserve les accents français et pagine les contenus longs', async () => {
  const longText = 'Célébration, fraternité, prière et évangélisation : les participants ont partagé leur expérience et préparé la prochaine activité. '.repeat(55);
  const bytes = await buildReportPdf(sample({ context: longText, course: longText, conclusion: 'La communauté a été édifiée.' }), logos);
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 2, 'le texte détaillé commence après la couverture et le contenu long continue sur plusieurs pages');
});

test('prépare le PDF téléchargeable avec le type MIME attendu', async () => {
  const bytes = await buildReportPdf(sample(), logos);
  const blob = createPdfBlob(bytes);
  assert.equal(blob.type, 'application/pdf');
  assert.equal(blob.size, bytes.byteLength);
  assert.ok(Buffer.from(await blob.arrayBuffer()).toString('latin1').startsWith('%PDF-'));
});
