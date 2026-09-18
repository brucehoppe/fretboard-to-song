import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPractice, newId, post } from '@/lib/api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('newId', () => {
  it('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 500 }, newId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(UUID);
  });
  it('falls back when randomUUID is unavailable (non-secure context)', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try { expect(newId()).toMatch(UUID); }
    finally { delete (crypto as { randomUUID?: unknown }).randomUUID; }
  });
});

describe('loadPractice', () => {
  it('returns data and fills missing lists', async () => {
    vi.stubGlobal('fetch', reply({ songs: [{ id: 1 }], sessions: [] }));
    expect(await loadPractice()).toEqual({ songs: [{ id: 1 }], sessions: [], licks: [] });
  });
  it('throws the server error message', async () => {
    vi.stubGlobal('fetch', reply({ error: 'DB down' }, 503));
    await expect(loadPractice()).rejects.toThrow('DB down');
  });
  it('throws a default message when the server gives none', async () => {
    vi.stubGlobal('fetch', reply({}, 500));
    await expect(loadPractice()).rejects.toThrow('unavailable');
  });
});

describe('post', () => {
  it('sends the action and data as JSON', async () => {
    const f = reply({ revision: 3 });
    vi.stubGlobal('fetch', f);
    expect(await post('song', { a: 1 })).toEqual({ revision: 3 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/practice');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ type: 'song', data: { a: 1 } });
  });
  it('throws the server error, or a default one for non-JSON errors', async () => {
    vi.stubGlobal('fetch', reply({ error: 'Conflict' }, 409));
    await expect(post('lick', {})).rejects.toThrow('Conflict');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })));
    await expect(post('lick', {})).rejects.toThrow('Unable to save');
  });
});
