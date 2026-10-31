import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_REPORT, REPORT_RUBRICS, slugify, validatePhotoAlbumUrl, validatePublishedReports, validateReport } from '../src/lib/report.ts';
import { makePublicationEntry } from '../src/lib/publication.ts';
import { BRANDING } from '../src/data/branding.ts';

test('le modèle institutionnel conserve les rubriques et leur ordre', () => {
  assert.deepEqual(Object.values(BRANDING.mentions), [
    'ARCHIDIOCÈSE DE COTONOU',
    'GROUPE DE PRIÈRE DU RENOUVEAU CHARISMATIQUE DE COTONOU',
    'SERVICE JEUNE DU RENOUVEAU CHARISMATIQUE CATHOLIQUE DE COTONOU',
  ]);
  assert.deepEqual(REPORT_RUBRICS.map((rubric) => rubric.title), [
    'Informations générales de l’activité', 'Contexte et objectifs', 'Déroulement', 'Effectif',
    'Résultats et faits marquants', 'Témoignages', 'Difficultés éventuelles', 'Conclusion et perspectives', 'Rédaction et validation',
  ]);
  assert.deepEqual(REPORT_RUBRICS.find((rubric) => rubric.id === 'headcount')?.fields.map((field) => field.key), ['participants']);
  assert.ok(!Object.hasOwn(EMPTY_REPORT, 'participation'));
  assert.deepEqual(REPORT_RUBRICS[0].fields.slice(0, 5).map((field) => field.label), ['Titre du rapport / activité', 'Église, communauté, paroisse ou service', 'Thème de l’activité', 'Date de l’activité', 'Lieu']);
});

test('valide les chemins et les métadonnées des rapports publics', () => {
  assert.deepEqual(validatePublishedReports([{ id: 'r-1', title: 'Rencontre', date: '2026-10-27', pdf: 'rapports/rencontre.pdf' }]), [
    { id: 'r-1', title: 'Rencontre', date: '2026-10-27', pdf: 'rapports/rencontre.pdf' },
  ]);
  assert.throws(() => validatePublishedReports([{ id: 'r-2', title: 'Mauvais chemin', date: '2026-10-27', pdf: '../private.pdf' }]));
});

test('valide les champs requis et les liens Google Photos HTTPS', () => {
  assert.equal(validateReport(EMPTY_REPORT).length, 2);
  const complete = { ...EMPTY_REPORT, activityName: 'Rencontre fraternelle', activityDate: '2026-10-27' };
  assert.deepEqual(validateReport(complete), []);
  assert.equal(validatePhotoAlbumUrl('https://photos.google.com/share/example'), null);
  assert.notEqual(validatePhotoAlbumUrl('http://photos.google.com/share/example'), null);
  assert.notEqual(validatePhotoAlbumUrl('https://evil.example/photos'), null);
});

test('prépare une fiche de publication sans inclure de photos locales', () => {
  const report = { ...EMPTY_REPORT, activityName: 'Veillée du Renouveau', activityDate: '2026-10-27', place: 'Cotonou', results: 'Temps de prière et de partage.', photoAlbumUrl: 'https://photos.google.com/share/album' };
  const entry = makePublicationEntry(report, 'rapports/veillee.pdf', '2026-10-27-veillee');
  assert.deepEqual(entry, { id: '2026-10-27-veillee', title: 'Veillée du Renouveau', date: '2026-10-27', place: 'Cotonou', summary: 'Temps de prière et de partage.', pdf: 'rapports/veillee.pdf', photoAlbumUrl: 'https://photos.google.com/share/album' });
  assert.equal(slugify('Prière & Fraternité'), 'priere-fraternite');
});
