const CREDENTIAL_KEY = 'rccc-admin-credential-v1';
const SESSION_KEY = 'rccc-admin-session-v1';
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 310_000;

type Credential = { username: string; salt: string; digest: string; iterations: number };
type Session = { username: string; expiresAt: number };

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error('Données de connexion invalides.');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('Ce navigateur ne prend pas en charge le chiffrement Web requis.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const cryptoSalt = new Uint8Array(salt).buffer;
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: cryptoSalt, iterations }, key, 256));
}

function readCredential(): Credential | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CREDENTIAL_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Partial<Credential>;
    if (typeof value.username !== 'string' || typeof value.salt !== 'string' || typeof value.digest !== 'string' || typeof value.iterations !== 'number') return null;
    return value as Credential;
  } catch { return null; }
}

export function hasAdminCredential(): boolean {
  return readCredential() !== null;
}

export function isAdminSessionValid(now = Date.now()): boolean {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<Session> | null;
    if (!session || typeof session.username !== 'string' || typeof session.expiresAt !== 'number' || session.expiresAt <= now) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch { return false; }
}

function startSession(username: string) {
  const session: Session = { username, expiresAt: Date.now() + SESSION_DURATION_MS };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function saveCredential(username: string, password: string) {
  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) throw new Error('L’identifiant doit contenir au moins 3 caractères.');
  if (password.length < 12) throw new Error('Choisissez un mot de passe d’au moins 12 caractères.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  const credential: Credential = { username: cleanUsername, salt: encodeHex(salt), digest: encodeHex(digest), iterations: PBKDF2_ITERATIONS };
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
  startSession(cleanUsername);
}

export async function createAdminCredential(username: string, password: string): Promise<void> {
  if (hasAdminCredential()) throw new Error('Un compte administrateur est déjà configuré sur ce navigateur.');
  await saveCredential(username, password);
}

export async function signInAdmin(username: string, password: string): Promise<boolean> {
  const credential = readCredential();
  if (!credential || credential.username !== username.trim().toLowerCase()) return false;
  const candidate = await derivePassword(password, decodeHex(credential.salt), credential.iterations);
  if (encodeHex(candidate) !== credential.digest) return false;
  startSession(credential.username);
  return true;
}

export async function updateAdminPassword(currentPassword: string, nextPassword: string): Promise<void> {
  const credential = readCredential();
  if (!credential) throw new Error('Aucun compte administrateur n’est configuré.');
  const current = await derivePassword(currentPassword, decodeHex(credential.salt), credential.iterations);
  if (encodeHex(current) !== credential.digest) throw new Error('Le mot de passe actuel est incorrect.');
  await saveCredential(credential.username, nextPassword);
}

export function signOutAdmin(): void {
  localStorage.removeItem(SESSION_KEY);
}
