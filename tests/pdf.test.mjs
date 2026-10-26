import assert from 'node:assert/strict';
import test from 'node:test';
import { makePdf } from '../lib/pdf.ts';

test('writes a valid PDF header and cross-reference offsets', () => {
  const bytes = makePdf('Rapport RCC', ['Résumé : action réalisée.']);
  const pdf = bytes.toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  const start = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  assert.equal(pdf.slice(start, start + 4), 'xref');
  for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) {
    assert.match(pdf.slice(Number(match[1])), /^\d+ 0 obj/);
  }
});

test('escapes PDF syntax and wraps content over multiple pages', () => {
  const bytes = makePdf('Rapport (année)', Array.from({ length: 60 }, (_, i) => `Ligne ${i} \\ à`));
  const pdf = bytes.toString('latin1');
  assert.equal((pdf.match(/\/Type \/Page \/Parent/g) ?? []).length, 2);
  const slash = String.fromCharCode(92);
  assert.ok(pdf.includes(`Rapport ${slash}(ann${slash}351e${slash})`));
  assert.ok(pdf.includes(`${slash}${slash} ${slash}340`));
});
