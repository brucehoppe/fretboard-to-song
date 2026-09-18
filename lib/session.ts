/*
 * Signed session cookie for the single-owner passphrase gate. Not a general
 * auth system: one shared passphrase, one HMAC-signed cookie, no user table.
 */

export const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toBase64Url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string compare so passphrase checks don't leak timing info. */
export function timingSafeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

export async function createSessionToken(secret: string) {
  const exp = Date.now() + SESSION_TTL_MS;
  const key = await hmacKey(secret);
  const sig = toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(exp))));
  return `${exp}.${sig}`;
}

export async function verifySessionToken(secret: string, token: string | undefined | null) {
  if (!token) return false;
  const [expPart, sig] = token.split('.');
  const exp = Number(expPart);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const key = await hmacKey(secret);
  const expected = toBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expPart)));
  return timingSafeEqual(sig, expected);
}

export function sessionCookieHeader(token: string | null) {
  if (token === null) return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
