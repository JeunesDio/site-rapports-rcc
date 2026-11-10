import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

test('le build GitHub Pages utilise le préfixe du dépôt et embarque les logos', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /\/site-rapports-rcc\/assets\//);
  const bundle = readdirSync(new URL('../dist/assets/', import.meta.url))
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(new URL(`../dist/assets/${name}`, import.meta.url), 'utf8'))
    .join('\n');
  assert.match(bundle, /site-rapports-rcc\//, 'les chemins générés utilisent la base du dépôt');
  assert.match(bundle, /site-rapports-rcc-admin-jeunesdio\.onrender\.com\/#\/nouveau/, 'le lien ouvre le formulaire sécurisé dans le navigateur');
  assert.doesNotMatch(bundle, /Préparer un rapport d’activité|Témoignages et photos/, 'le formulaire et le générateur ne sont pas inclus dans le site public');
  assert.ok(existsSync(new URL('../dist/identite/archidiocese-cotonou.jpg', import.meta.url)));
  assert.ok(existsSync(new URL('../dist/identite/renouveau-charismatique.jpg', import.meta.url)));
});

test('la liste de rapports générée ne contient aucune donnée fictive', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/reports.json', import.meta.url), 'utf8'));
  assert.deepEqual(data, []);
});
