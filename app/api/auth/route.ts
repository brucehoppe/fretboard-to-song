import { z } from 'zod';
import { env } from '@/lib/database';
import { createSessionToken, sessionCookieHeader, timingSafeEqual } from '@/lib/session';

const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } });

const login = z.object({ passphrase: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const passphrase = env.PRACTICE_PASSPHRASE;
  const secret = env.AUTH_SECRET;
  if (!passphrase || !secret) {
    console.error('PRACTICE_PASSPHRASE / AUTH_SECRET not configured');
    return json({ error: 'Sign-in is not configured.' }, 503);
  }
  try {
    const raw = await req.text();
    if (raw.length > 500) return json({ error: 'Malformed request.' }, 400);
    const { passphrase: attempt } = login.parse(JSON.parse(raw));
    if (!timingSafeEqual(attempt, passphrase)) return json({ error: 'Incorrect passphrase.' }, 401);
    const token = await createSessionToken(secret);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(token) });
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError) return json({ error: 'Malformed request.' }, 400);
    console.error(e);
    return json({ error: 'Could not sign in.' }, 503);
  }
}

export async function DELETE() {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(null) });
}
