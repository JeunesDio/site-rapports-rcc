const CREDENTIAL_KEY = 'rccc-admin-credential-v1';
const SESSION_KEY = 'rccc-admin-session-v1';
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 310_000;

type Credential = {
  username?: string;
  identifierSalt?: string;
  identifierDigest?: string;
  salt: string;
  digest: string;
  iterations: number;
};
type Session = { username?: string; expiresAt: number };

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error('Données de connexion invalides.');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

async function derive(value: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('Ce navigateur ne prend pas en charge le chiffrement Web requis.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const cryptoSalt = new Uint8Array(salt).buffer;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: cryptoSalt, iterations }, key, 256));
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function readCredential(): Credential | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CREDENTIAL_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<Credential>;
    const hasLegacyIdentifier = typeof value.username === 'string';
    const hasHashedIdentifier = typeof value.identifierSalt === 'string' && typeof value.identifierDigest === 'string';
    if ((!hasLegacyIdentifier && !hasHashedIdentifier) || typeof value.salt !== 'string' || typeof value.digest !== 'string' || typeof value.iterations !== 'number') return null;
    return value as Credential;
  } catch { return null; }
}

export function hasAdminCredential(): boolean {
  return readCredential() !== null;
}

export function isAdminSessionValid(now = Date.now()): boolean {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<Session> | null;
    if (!session || typeof session.expiresAt !== 'number' || session.expiresAt <= now) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    if (typeof session.username === 'string') localStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: session.expiresAt }));
    return true;
  } catch { return false; }
}

function startSession() {
  const session: Session = { expiresAt: Date.now() + SESSION_DURATION_MS };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function withoutLegacyIdentifier(credential: Credential): Promise<Credential> {
  if (credential.identifierSalt && credential.identifierDigest) {
    const current = { ...credential };
    delete current.username;
    return current;
  }
  if (!credential.username) throw new Error('Identifiant administrateur invalide.');
  const identifierSalt = randomSalt();
  const identifierDigest = encodeHex(await derive(normalizeIdentifier(credential.username), identifierSalt, credential.iterations));
  const migrated: Credential = { ...credential, identifierSalt: encodeHex(identifierSalt), identifierDigest };
  delete migrated.username;
  return migrated;
}

async function saveCredential(identifier: string, password: string): Promise<void> {
  const cleanIdentifier = normalizeIdentifier(identifier);
  if (cleanIdentifier.length < 3) throw new Error('L’identifiant doit contenir au moins 3 caractères.');
  if (password.length < 12) throw new Error('Choisissez un mot de passe d’au moins 12 caractères.');
  const salt = randomSalt();
  const identifierSalt = randomSalt();
  const [digest, identifierDigest] = await Promise.all([
    derive(password, salt, PBKDF2_ITERATIONS),
    derive(cleanIdentifier, identifierSalt, PBKDF2_ITERATIONS),
  ]);
  const credential: Credential = {
    identifierSalt: encodeHex(identifierSalt), identifierDigest: encodeHex(identifierDigest),
    salt: encodeHex(salt), digest: encodeHex(digest), iterations: PBKDF2_ITERATIONS,
  };
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
  startSession();
}

export async function createAdminCredential(username: string, password: string): Promise<void> {
  if (hasAdminCredential()) throw new Error('Un compte administrateur est déjà configuré sur ce navigateur.');
  await saveCredential(username, password);
}

export async function signInAdmin(username: string, password: string): Promise<boolean> {
  const credential = readCredential();
  if (!credential) return false;
  const normalized = normalizeIdentifier(username);
  const identifierMatches = credential.username
    ? normalizeIdentifier(credential.username) === normalized
    : !!credential.identifierSalt && !!credential.identifierDigest
      && encodeHex(await derive(normalized, decodeHex(credential.identifierSalt), credential.iterations)) === credential.identifierDigest;
  if (!identifierMatches) return false;
  const candidate = await derive(password, decodeHex(credential.salt), credential.iterations);
  if (encodeHex(candidate) !== credential.digest) return false;
  if (credential.username) localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(await withoutLegacyIdentifier(credential)));
  startSession();
  return true;
}

export async function updateAdminPassword(currentPassword: string, nextPassword: string): Promise<void> {
  const credential = readCredential();
  if (!credential) throw new Error('Aucun compte administrateur n’est configuré.');
  const current = await derive(currentPassword, decodeHex(credential.salt), credential.iterations);
  if (encodeHex(current) !== credential.digest) throw new Error('Le mot de passe actuel est incorrect.');
  const migrated = await withoutLegacyIdentifier(credential);
  if (nextPassword.length < 12) throw new Error('Choisissez un mot de passe d’au moins 12 caractères.');
  const salt = randomSalt();
  const digest = await derive(nextPassword, salt, credential.iterations);
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ ...migrated, salt: encodeHex(salt), digest: encodeHex(digest) }));
  startSession();
}

export async function updateAdminEmail(currentPassword: string, nextEmail: string): Promise<void> {
  const credential = readCredential();
  if (!credential) throw new Error('Aucun compte administrateur n’est configuré.');
  const email = normalizeIdentifier(nextEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Saisissez une adresse e-mail valide.');
  const current = await derive(currentPassword, decodeHex(credential.salt), credential.iterations);
  if (encodeHex(current) !== credential.digest) throw new Error('Le mot de passe actuel est incorrect.');
  const migrated = await withoutLegacyIdentifier(credential);
  const identifierSalt = randomSalt();
  const identifierDigest = await derive(email, identifierSalt, credential.iterations);
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({
    ...migrated,
    identifierSalt: encodeHex(identifierSalt),
    identifierDigest: encodeHex(identifierDigest),
  }));
  startSession();
}

export function signOutAdmin(): void {
  localStorage.removeItem(SESSION_KEY);
}
