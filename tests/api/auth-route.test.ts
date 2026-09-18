import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../helpers/cloudflare-workers';
import { DELETE, POST } from '@/app/api/auth/route';
import { verifySessionToken } from '@/lib/session';

const URL_ = 'https://fts.example/api/auth';
const send = (raw: string) => POST(new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw }));
const login = (passphrase: unknown) => send(JSON.stringify({ passphrase }));

function cookieValue(setCookie: string | null) {
  const match = setCookie?.match(/^session=([^;]*)/);
  return match?.[1];
}

beforeEach(() => {
  env.PRACTICE_PASSPHRASE = 'correct horse battery staple';
  env.AUTH_SECRET = 'test-auth-secret';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/auth', () => {
  it('sets a valid, verifiable session cookie on the correct passphrase', async () => {
    const r = await login(env.PRACTICE_PASSPHRASE);
    expect(r.status).toBe(200);
    const token = cookieValue(r.headers.get('set-cookie'));
    expect(token).toBeTruthy();
    expect(await verifySessionToken(env.AUTH_SECRET!, token)).toBe(true);
  });
  it('the cookie is HttpOnly, Secure, SameSite=Lax', async () => {
    const setCookie = (await login(env.PRACTICE_PASSPHRASE)).headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
  });
  it('rejects the wrong passphrase with 401 and no cookie', async () => {
    const r = await login('not it');
    expect(r.status).toBe(401);
    expect(r.headers.get('set-cookie')).toBeNull();
  });
  it('rejects a passphrase that is merely a prefix or superstring of the real one', async () => {
    expect((await login(env.PRACTICE_PASSPHRASE + 'x')).status).toBe(401);
    expect((await login((env.PRACTICE_PASSPHRASE as string).slice(0, -1))).status).toBe(401);
  });
  it('rejects malformed bodies', async () => {
    expect((await send('{not json')).status).toBe(400);
    expect((await login({ not: 'a string' })).status).toBe(400);
    expect((await login('')).status).toBe(400);
  });
  it('returns 503 and issues no cookie when sign-in is not configured', async () => {
    env.PRACTICE_PASSPHRASE = undefined;
    const r = await login('anything');
    expect(r.status).toBe(503);
    expect(r.headers.get('set-cookie')).toBeNull();
  });
});

describe('DELETE /api/auth', () => {
  it('clears the session cookie', async () => {
    const setCookie = (await DELETE()).headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/session=;/);
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
