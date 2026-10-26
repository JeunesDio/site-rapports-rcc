import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReportLink } from '../lib/report-links.ts';

test('accepts HTTPS Google Photos, Drive, Docs, and YouTube share URLs', () => {
  for (const url of [
    'https://photos.google.com/share/album123',
    'https://photos.app.goo.gl/album123',
    'https://drive.google.com/drive/folders/folder123',
    'https://docs.google.com/document/d/document123/edit',
    'https://www.youtube.com/watch?v=video123',
    'https://youtu.be/video123',
  ]) assert.ok(validateReportLink(url), url);
});

test('rejects non-HTTPS URLs, unapproved hosts, credentials, and ports', () => {
  for (const url of [
    'http://drive.google.com/file/d/file123',
    'https://drive.google.com.evil.example/file/d/file123',
    'https://drive.google.com@evil.example/file/d/file123',
    'https://user:pass@drive.google.com/file/d/file123',
    'https://drive.google.com:8443/file/d/file123',
    'https://youtube.com.evil.example/watch?v=video123',
  ]) assert.equal(validateReportLink(url), null, url);
});

test('rejects oversized URLs', () => {
  assert.equal(validateReportLink(`https://drive.google.com/${'a'.repeat(2048)}`), null);
});
