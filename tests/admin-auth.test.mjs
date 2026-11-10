import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { createAdminCredential, hasAdminCredential, isAdminSessionValid, signInAdmin, signOutAdmin, updateAdminPassword } from '../src/lib/admin-auth.ts';

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

test('la configuration refuse un identifiant trop court ou un mot de passe trop faible', async () => {
  await assert.rejects(createAdminCredential('ab', 'mot de passe assez long'));
  await assert.rejects(createAdminCredential('admin', 'court'));
  assert.equal(hasAdminCredential(), false);
});
