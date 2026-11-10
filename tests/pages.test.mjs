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
  assert.match(bundle, /Espace Administrateur/, 'l’espace administrateur est inclus dans le site');
  assert.match(bundle, /PBKDF2/, 'le navigateur dérive le condensat du mot de passe avec PBKDF2');
  assert.match(bundle, /Préparer un rapport d’activité|Témoignages et photos/, 'le formulaire et les témoignages sont disponibles sur le site');
  assert.doesNotMatch(bundle, /onrender\.com|\/api\/auth|\/api\/reports\/generate/i, 'aucun service externe ou serveur de génération n’est requis');
  assert.ok(existsSync(new URL('../dist/identite/archidiocese-cotonou.jpg', import.meta.url)));
  assert.ok(existsSync(new URL('../dist/identite/renouveau-charismatique.jpg', import.meta.url)));
});

test('les routes de création vérifient la session locale et la session a une durée limitée', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../src/lib/admin-auth.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/report-form.tsx', import.meta.url), 'utf8');
  assert.match(app, /route === '\/nouveau'.*authenticated \? <ReportForm/s);
  assert.match(app, /AdminAccess authenticated=\{false\}.*createFlow/);
  assert.match(auth, /SESSION_DURATION_MS = 4 \* 60 \* 60 \* 1000/);
  assert.match(form, /if \(!isAdminSessionValid\(\)\)/);
});

test('chaque témoignage permet de prévisualiser, remplacer et supprimer ses photos', () => {
  const form = readFileSync(new URL('../src/components/report-form.tsx', import.meta.url), 'utf8');
  assert.match(form, /Ajouter des photos à ce témoignage/);
  assert.match(form, /Aperçu de \$\{photo\.name\}/);
  assert.match(form, /Remplacer la photo/);
  assert.match(form, /Supprimer la photo/);
  assert.match(form, /replaceTestimonialPhoto/);
  assert.match(form, /removeTestimonialPhoto/);
});

test('la liste de rapports générée ne contient aucune donnée fictive', () => {
  const data = JSON.parse(readFileSync(new URL('../src/data/reports.json', import.meta.url), 'utf8'));
  assert.deepEqual(data, []);
});
