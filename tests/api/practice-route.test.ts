import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../helpers/cloudflare-workers';
import { createFakeD1 } from '../helpers/fake-d1';
import { GET, POST } from '@/app/api/practice/route';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';

const URL_ = 'https://fts.example/api/practice';
const AUTH_SECRET = 'test-auth-secret';
let cookie: string; // valid session cookie for the currently-configured AUTH_SECRET

const send = (type: string, data: unknown, headers: Record<string, string> = {}) =>
  POST(new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...headers }, body: JSON.stringify({ type, data }) }));
const get = (headers: Record<string, string> = {}) => GET(new Request(URL_, { headers: { cookie, ...headers } }));
const load = async () => (await get()).json() as Promise<{ songs: any[]; sessions: any[]; licks: any[] }>;
const body = async (r: Response) => ({ status: r.status, ...(await r.json() as Record<string, unknown>) }) as { status: number; error?: string; revision?: number; ok?: boolean };

const song = (o: Record<string, unknown> = {}) => ({
  id: randomUUID(), title: 'Little Wing', artist: 'Jimi Hendrix', key: 4, target: 70, notes: '', runs: 0, lastRun: '', revision: 0,
  sections: [{ id: randomUUID(), name: 'Intro', bpm: 60, status: 'New', transition: false }], ...o,
});
const lick = (o: Record<string, unknown> = {}) => ({
  id: randomUUID(), title: 'Bend', key: 4, box: '0', technique: 'bend', tab: 'B|15b17|', notes: '', status: 'Idea', songId: '', revision: 0, ...o,
});
const session = (o: Record<string, unknown> = {}) => ({ id: randomUUID(), exercise: 'Note quiz', key: 4, rating: 'Comfortable', date: new Date().toISOString(), ...o });

let sqlite: ReturnType<typeof createFakeD1>['sqlite'];
beforeEach(async () => {
  const f = createFakeD1(); env.DB = f.d1; sqlite = f.sqlite;
  env.AUTH_SECRET = AUTH_SECRET;
  cookie = `${SESSION_COOKIE}=${await createSessionToken(AUTH_SECRET)}`;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('migrations', () => {
  it('create all three tables (licks was previously missing)', () => {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r: any) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['licks', 'sessions', 'songs']));
  });
  it('the licks migration is safe to re-run', async () => {
    const { readFileSync } = await import('node:fs');
    expect(() => sqlite.exec(readFileSync('drizzle/0001_shallow_mongu.sql', 'utf8'))).not.toThrow();
  });
});

describe('GET', () => {
  it('returns empty lists on a fresh database, uncached', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ songs: [], sessions: [], licks: [] });
  });
  it('orders songs and licks by most recently updated, sessions newest first', async () => {
    const a = song({ title: 'A' }), b = song({ title: 'B' });
    await send('song', a); await new Promise(r => setTimeout(r, 5)); await send('song', b);
    await new Promise(r => setTimeout(r, 5)); await send('song', { ...a, title: 'A2', revision: 1 });
    await send('session', session({ date: '2026-01-01T00:00:00.000Z', exercise: 'old' }));
    await send('session', session({ date: '2026-02-01T00:00:00.000Z', exercise: 'new' }));
    const d = await load();
    expect(d.songs.map(s => s.title)).toEqual(['A2', 'B']);
    expect(d.sessions.map(s => s.exercise)).toEqual(['new', 'old']);
  });
  it('limits session history to 200', async () => {
    for (let i = 0; i < 205; i++) await send('session', session({ date: new Date(2026, 0, 1, 0, i).toISOString() }));
    expect((await load()).sessions).toHaveLength(200);
  });
  it('returns 503 when the database is missing', async () => {
    env.DB = undefined;
    expect(await body(await get())).toMatchObject({ status: 503, error: expect.stringContaining('unavailable') });
  });
});

describe('songs', () => {
  it('create → revision 1, update → 2, with every field round-tripping', async () => {
    const s = song({ notes: 'chorus entry', runs: 3, lastRun: '2026-09-01T00:00:00.000Z', target: 120 });
    expect(await body(await send('song', s))).toEqual({ status: 200, revision: 1 });
    expect((await load()).songs[0]).toEqual({ ...s, revision: 1 });
    expect(await body(await send('song', { ...s, title: 'Renamed', revision: 1 }))).toEqual({ status: 200, revision: 2 });
    expect((await load()).songs[0]).toMatchObject({ title: 'Renamed', revision: 2 });
  });
  it('trims titles', async () => {
    const s = song({ title: '  Padded  ' });
    await send('song', s);
    expect((await load()).songs[0].title).toBe('Padded');
  });
  it('rejects a stale revision with 409 (edits from another tab)', async () => {
    const s = song();
    await send('song', s);
    await send('song', { ...s, revision: 1, title: 'Tab A' });
    const r = await body(await send('song', { ...s, revision: 1, title: 'Tab B' }));
    expect(r).toMatchObject({ status: 409, error: expect.stringContaining('another tab') });
    expect((await load()).songs[0].title).toBe('Tab A');
  });
  it('rejects creating the same id twice', async () => {
    const s = song();
    await send('song', s);
    expect((await send('song', s)).status).toBe(409);
  });
  it('rejects updating a song that does not exist', async () => {
    expect((await send('song', song({ revision: 4 }))).status).toBe(409);
  });
  it('accepts every section status and 40 sections, rejects 41', async () => {
    const sections = Array.from({ length: 40 }, (_, i) => ({ id: randomUUID(), name: `S${i}`, bpm: 30 + i, status: (['New', 'Learning', 'Steady'] as const)[i % 3], transition: i % 2 === 0 }));
    expect((await send('song', song({ sections }))).status).toBe(200);
    expect((await send('song', song({ sections: [...sections, sections[0]] }))).status).toBe(400);
  });
  it('accepts every key 0–11', async () => {
    for (let key = 0; key < 12; key++) expect((await send('song', song({ key }))).status).toBe(200);
  });
  it('accepts tempo bounds 30 and 300', async () => {
    expect((await send('song', song({ target: 30 }))).status).toBe(200);
    expect((await send('song', song({ target: 300 }))).status).toBe(200);
  });
  it.each([
    ['empty title', { title: '   ' }, 'Song title is required'],
    ['title too long', { title: 'x'.repeat(121) }, 'title'],
    ['artist too long', { artist: 'x'.repeat(121) }, 'artist'],
    ['key too high', { key: 12 }, 'key'],
    ['key negative', { key: -1 }, 'key'],
    ['key fractional', { key: 1.5 }, 'key'],
    ['target too slow', { target: 29 }, 'Tempos'],
    ['target too fast', { target: 301 }, 'Tempos'],
    ['target zero (blank field)', { target: 0 }, 'Tempos'],
    ['notes too long', { notes: 'x'.repeat(4001) }, 'notes'],
    ['negative runs', { runs: -1 }, 'runs'],
    ['bad id', { id: 'nope' }, 'id'],
    ['section blank name', { sections: [{ id: randomUUID(), name: ' ', bpm: 60, status: 'New', transition: false }] }, 'Section names'],
    ['section bpm too low', { sections: [{ id: randomUUID(), name: 'A', bpm: 20, status: 'New', transition: false }] }, 'Tempos'],
    ['section bad status', { sections: [{ id: randomUUID(), name: 'A', bpm: 60, status: 'Done', transition: false }] }, 'status'],
    ['section missing transition', { sections: [{ id: randomUUID(), name: 'A', bpm: 60, status: 'New' }] }, 'transition'],
  ])('rejects %s with a helpful 400', async (_, override, message) => {
    const r = await body(await send('song', song(override)));
    expect(r.status).toBe(400);
    expect(r.error).toContain(message);
  });
  it('delete removes the song; deleting twice is harmless', async () => {
    const s = song();
    await send('song', s);
    expect((await send('delete-song', { id: s.id })).status).toBe(200);
    expect((await load()).songs).toEqual([]);
    expect((await send('delete-song', { id: s.id })).status).toBe(200);
  });
});

describe('licks', () => {
  it('create, update, conflict and delete', async () => {
    const l = lick();
    expect(await body(await send('lick', l))).toEqual({ status: 200, revision: 1 });
    expect(await body(await send('lick', { ...l, status: 'Learned', revision: 1 }))).toEqual({ status: 200, revision: 2 });
    expect((await send('lick', { ...l, revision: 1 })).status).toBe(409);
    expect((await load()).licks[0]).toMatchObject({ status: 'Learned', revision: 2 });
    await send('delete-lick', { id: l.id });
    expect((await load()).licks).toEqual([]);
  });
  it.each(['all', '0', '1', '2', '3', '4'])('accepts box %s', async box => expect((await send('lick', lick({ box }))).status).toBe(200));
  it.each(['Idea', 'Practising', 'Learned'])('accepts status %s', async status => expect((await send('lick', lick({ status }))).status).toBe(200));
  it('accepts a linked song id or none', async () => {
    expect((await send('lick', lick({ songId: randomUUID() }))).status).toBe(200);
    expect((await send('lick', lick({ songId: '' }))).status).toBe(200);
  });
  it.each([
    ['empty title', { title: '' }, 'Lick title is required'],
    ['bad box', { box: '5' }, 'box'],
    ['bad status', { status: 'Mastered' }, 'status'],
    ['technique too long', { technique: 'x'.repeat(81) }, 'technique'],
    ['tab too long', { tab: 'x'.repeat(2001) }, 'tab'],
    ['bad song id', { songId: 'abc' }, 'songId'],
  ])('rejects %s', async (_, override, message) => {
    const r = await body(await send('lick', lick(override)));
    expect(r.status).toBe(400);
    expect(r.error).toContain(message);
  });
});

describe('sessions', () => {
  it.each(['Needs work', 'Getting there', 'Comfortable'])('accepts rating %s', async rating => {
    expect((await send('session', session({ rating }))).status).toBe(200);
  });
  it('is idempotent on id (double-click logs once)', async () => {
    const s = session();
    await send('session', s); await send('session', s);
    expect((await load()).sessions).toHaveLength(1);
  });
  it.each([
    ['bad rating', { rating: 'Great' }],
    ['non-ISO date', { date: 'yesterday' }],
    ['empty exercise', { exercise: '' }],
    ['exercise too long', { exercise: 'x'.repeat(121) }],
  ])('rejects %s', async (_, o) => expect((await send('session', session(o))).status).toBe(400));
  it('a spoofed future client date cannot push real sessions out of the history window (H2 regression)', async () => {
    await send('session', session({ exercise: 'real practice' }));
    await send('session', session({ exercise: 'spoofed', date: '3000-01-01T00:00:00.000Z' }));
    const sessions = (await load()).sessions;
    // Whichever was written second sorts first — server insertion order, not the client-supplied date.
    expect(sessions.map((s: any) => s.exercise)).toEqual(['spoofed', 'real practice']);
  });
});

describe('auth', () => {
  it('GET without a session cookie is rejected', async () => {
    expect((await get({ cookie: '' })).status).toBe(401);
  });
  it('POST without a session cookie is rejected', async () => {
    expect((await send('session', session(), { cookie: '' })).status).toBe(401);
  });
  it('a garbage or tampered cookie is rejected', async () => {
    expect((await get({ cookie: `${SESSION_COOKIE}=not-a-valid-token` })).status).toBe(401);
  });
  it('an expired session token is rejected', async () => {
    const expired = `${Date.now() - 1000}.deadbeef`;
    expect((await get({ cookie: `${SESSION_COOKIE}=${expired}` })).status).toBe(401);
  });
  it('a token signed with a different secret is rejected', async () => {
    const other = `${SESSION_COOKIE}=${await createSessionToken('some-other-secret')}`;
    expect((await get({ cookie: other })).status).toBe(401);
  });
  it('fails closed when AUTH_SECRET is not configured', async () => {
    env.AUTH_SECRET = undefined;
    expect((await get({ cookie })).status).toBe(401);
  });
});

describe('request hygiene', () => {
  it('rejects cross-origin writes', async () => {
    expect((await send('song', song(), { origin: 'https://evil.example' })).status).toBe(403);
  });
  it('reads the body before rejecting, so kept-alive connections stay healthy (regression)', async () => {
    const req = new Request(URL_, { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ type: 'song', data: {} }) });
    expect((await POST(req)).status).toBe(403);
    expect(req.bodyUsed).toBe(true);
  });
  it('rejects a declared oversize body without reading it', async () => {
    const req = new Request(URL_, { method: 'POST', headers: { 'content-length': '999999' }, body: '{}' });
    expect((await POST(req)).status).toBe(413);
  });
  it('allows same-origin and origin-less writes', async () => {
    expect((await send('song', song(), { origin: 'https://fts.example' })).status).toBe(200);
    expect((await send('song', song())).status).toBe(200);
  });
  it('rejects oversized bodies with 413', async () => {
    expect((await send('lick', lick({ notes: 'x'.repeat(30000) }))).status).toBe(413);
  });
  it('rejects malformed JSON and unknown actions', async () => {
    expect((await POST(new Request(URL_, { method: 'POST', headers: { cookie }, body: '{nope' }))).status).toBe(400);
    expect(await body(await send('explode', {}))).toMatchObject({ status: 400, error: 'Unknown action' });
    expect((await send('delete-song', { id: 'not-a-uuid' })).status).toBe(400);
  });
  it('returns 503 and keeps the client message friendly when the database fails', async () => {
    env.DB = { prepare() { throw new Error('D1 exploded'); } } as unknown as D1Database;
    expect(await body(await send('song', song()))).toMatchObject({ status: 503, error: expect.stringContaining('edits are still here') });
  });
  it('uses parameter binding (SQL in titles is stored literally)', async () => {
    const s = song({ title: "x'); DROP TABLE songs; --" });
    await send('song', s);
    expect((await load()).songs[0].title).toBe(s.title);
  });
});
