import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePhotoAlbumUrl, validatePublishedReports } from '../src/lib/published-reports.ts';

test('valide les métadonnées des rapports publiés', () => {
  assert.deepEqual(validatePublishedReports([{ id: 'r-1', title: 'Rencontre', date: '2026-10-27', pdf: 'rapports/rencontre.pdf' }]), [
    { id: 'r-1', title: 'Rencontre', date: '2026-10-27', pdf: 'rapports/rencontre.pdf' },
  ]);
  assert.throws(() => validatePublishedReports([{ id: 'r-2', title: 'Mauvais chemin', date: '2026-10-27', pdf: '../private.pdf' }]));
});

test('accepte uniquement les liens d’albums Google Photos en HTTPS', () => {
  assert.equal(validatePhotoAlbumUrl('https://photos.google.com/share/example'), null);
  assert.notEqual(validatePhotoAlbumUrl('http://photos.google.com/share/example'), null);
  assert.notEqual(validatePhotoAlbumUrl('https://evil.example/photos'), null);
});
