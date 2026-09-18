import { z } from 'zod';
import { database } from '@/lib/database';

/*
 * Single-owner practice API. Records are stored as validated JSON blobs in D1,
 * with an integer `revision` for optimistic concurrency (two open tabs cannot
 * silently overwrite each other).
 */

const uuid = z.string().uuid();
const section = z.object({ id: uuid, name: z.string().trim().min(1, 'Section names cannot be empty').max(80), bpm: z.number().int().min(30).max(300), status: z.enum(['New', 'Learning', 'Steady']), transition: z.boolean() });
const song = z.object({ id: uuid, title: z.string().trim().min(1, 'Song title is required').max(120), artist: z.string().max(120), key: z.number().int().min(0).max(11), target: z.number().int().min(30).max(300), sections: z.array(section).max(40), notes: z.string().max(4000), runs: z.number().int().nonnegative(), lastRun: z.string().max(50), revision: z.number().int().nonnegative() });
const session = z.object({ id: uuid, exercise: z.string().min(1).max(120), key: z.number().int().min(0).max(11), rating: z.enum(['Needs work', 'Getting there', 'Comfortable']), date: z.string().datetime() });
const lick = z.object({ id: uuid, title: z.string().trim().min(1, 'Lick title is required').max(120), key: z.number().int().min(0).max(11), box: z.enum(['all', '0', '1', '2', '3', '4']), technique: z.string().max(80), tab: z.string().max(2000), notes: z.string().max(4000), status: z.enum(['Idea', 'Practising', 'Learned']), songId: uuid.or(z.literal('')), revision: z.number().int().nonnegative() });
const byId = z.object({ id: uuid });

const SESSION_HISTORY = 200; // enough for streaks and weekly counts
const MAX_BODY = 25_000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    const db = database();
    const [s, h, l] = await Promise.all([
      db.prepare('SELECT data, revision FROM songs ORDER BY updated_at DESC').all<{ data: string; revision: number }>(),
      db.prepare('SELECT data FROM sessions ORDER BY created_at DESC LIMIT ?').bind(SESSION_HISTORY).all<{ data: string }>(),
      db.prepare('SELECT data, revision FROM licks ORDER BY updated_at DESC').all<{ data: string; revision: number }>(),
    ]);
    return json({
      songs: s.results.map(r => ({ ...JSON.parse(r.data), revision: r.revision })),
      sessions: h.results.map(r => JSON.parse(r.data)),
      licks: l.results.map(r => ({ ...JSON.parse(r.data), revision: r.revision })),
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'Your saved practice is unavailable. Please retry.' }, 503);
  }
}

/** Insert when revision is 0, otherwise update only if nobody else saved first. */
async function upsert(db: D1Database, table: 'songs' | 'licks', id: string, data: unknown, revision: number) {
  const now = new Date().toISOString(), blob = JSON.stringify(data);
  const result = revision === 0
    ? await db.prepare(`INSERT OR IGNORE INTO ${table} (id, data, revision, updated_at) VALUES (?, ?, 1, ?)`).bind(id, blob, now).run()
    : await db.prepare(`UPDATE ${table} SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`).bind(blob, now, id, revision).run();
  return result.meta.changes > 0;
}

function friendly(e: z.ZodError) {
  const issue = e.issues[0];
  if (!issue) return 'Check your entry.';
  const field = issue.path.filter(p => typeof p === 'string').at(-1);
  if (field === 'bpm' || field === 'target') return 'Tempos must be whole numbers from 30 to 300 BPM.';
  return issue.message.includes('required') || issue.message.includes('empty') ? issue.message : `Check ${field ?? 'your entry'}: ${issue.message}`;
}

export async function POST(req: Request) {
  try {
    // Check the declared size first so we never read an oversized body.
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'Entry too large' }, 413);
    // Always read the body before replying. Returning early with an unread body on a
    // kept-alive connection crashed the local Workers runtime (found by the e2e tests).
    const raw = await req.text();
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: 'Invalid origin' }, 403);
    if (raw.length > MAX_BODY) return json({ error: 'Entry too large' }, 413);
    const body = JSON.parse(raw) as { type?: string; data?: unknown };
    const db = database();

    switch (body.type) {
      case 'song': {
        const s = song.parse(body.data);
        if (!(await upsert(db, 'songs', s.id, s, s.revision))) return json({ error: 'This song changed in another tab. Copy any unsaved notes, then reload before editing.' }, 409);
        return json({ revision: s.revision + 1 });
      }
      case 'lick': {
        const l = lick.parse(body.data);
        if (!(await upsert(db, 'licks', l.id, l, l.revision))) return json({ error: 'This lick changed in another tab. Reload before editing.' }, 409);
        return json({ revision: l.revision + 1 });
      }
      case 'session': {
        const s = session.parse(body.data);
        await db.prepare('INSERT OR IGNORE INTO sessions (id, data, created_at) VALUES (?, ?, ?)').bind(s.id, JSON.stringify(s), s.date).run();
        return json({ ok: true });
      }
      case 'delete-song': {
        const { id } = byId.parse(body.data);
        await db.prepare('DELETE FROM songs WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      case 'delete-lick': {
        const { id } = byId.parse(body.data);
        await db.prepare('DELETE FROM licks WHERE id = ?').bind(id).run();
        return json({ ok: true });
      }
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: friendly(e) }, 400);
    if (e instanceof SyntaxError) return json({ error: 'Malformed request.' }, 400);
    console.error(e);
    return json({ error: 'Could not save. Your edits are still here; please retry.' }, 503);
  }
}
