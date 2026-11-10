import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createAdminCredential, hasAdminCredential, isAdminSessionValid, signInAdmin, signOutAdmin, updateAdminEmail, updateAdminPassword } from '../src/lib/admin-auth.ts';

const values = new Map();
const storage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});
afterEach(() => values.clear());

test('un compte local utilise un mot de passe dérivé et une session persistante à durée limitée', async () => {
  await createAdminCredential(' Responsable ', 'une phrase secrète solide');
  assert.equal(hasAdminCredential(), true);
  assert.equal(isAdminSessionValid(), true);
  assert.equal(await signInAdmin('responsable', 'incorrect'), false);
  signOutAdmin();
  assert.equal(isAdminSessionValid(), false);
  assert.equal(await signInAdmin('RESPONSABLE', 'une phrase secrète solide'), true);
  assert.equal(isAdminSessionValid(), true);
  assert.equal(isAdminSessionValid(Date.now() + 4 * 60 * 60 * 1000 + 1), false);
});

test('le mot de passe administrateur peut être modifié après vérification du précédent', async () => {
  await createAdminCredential('admin', 'ancien mot de passe sécurisé');
  await assert.rejects(updateAdminPassword('faux mot de passe actuel', 'nouveau mot de passe sécurisé'));
  await updateAdminPassword('ancien mot de passe sécurisé', 'nouveau mot de passe sécurisé');
  signOutAdmin();
  assert.equal(await signInAdmin('admin', 'ancien mot de passe sécurisé'), false);
  assert.equal(await signInAdmin('admin', 'nouveau mot de passe sécurisé'), true);
});

test('l’adresse e-mail de connexion peut être changée après vérification du mot de passe', async () => {
  await createAdminCredential('ancienne@example.com', 'mot de passe administrateur fort');
  await assert.rejects(updateAdminEmail('mot de passe erroné', 'nouvelle@example.com'));
  await assert.rejects(updateAdminEmail('mot de passe administrateur fort', 'adresse invalide'));
  await updateAdminEmail('mot de passe administrateur fort', 'Nouvelle@Example.com');
  assert.doesNotMatch(values.get('rccc-admin-credential-v1'), /nouvelle@example\.com/i);
  assert.doesNotMatch(values.get('rccc-admin-session-v1'), /nouvelle@example\.com/i);
  signOutAdmin();
  assert.equal(await signInAdmin('ancienne@example.com', 'mot de passe administrateur fort'), false);
  assert.equal(await signInAdmin('NOUVELLE@example.com', 'mot de passe administrateur fort'), true);
});

test('les anciens identifiants sont convertis sans conserver l’adresse en clair après connexion', async () => {
  await createAdminCredential('admin@example.com', 'mot de passe administrateur fort');
  const credential = JSON.parse(values.get('rccc-admin-credential-v1'));
  credential.username = 'admin@example.com';
  delete credential.identifierSalt;
  delete credential.identifierDigest;
  values.set('rccc-admin-credential-v1', JSON.stringify(credential));
  signOutAdmin();
  assert.equal(await signInAdmin('ADMIN@example.com', 'mot de passe administrateur fort'), true);
  assert.doesNotMatch(values.get('rccc-admin-credential-v1'), /admin@example\.com/i);
});

test('la configuration refuse un identifiant trop court ou un mot de passe trop faible', async () => {
  await assert.rejects(createAdminCredential('ab', 'mot de passe assez long'));
  await assert.rejects(createAdminCredential('admin', 'court'));
  assert.equal(hasAdminCredential(), false);
});
