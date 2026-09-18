import type { Lick, Session, Song } from '@/lib/music';

export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for non-secure contexts (e.g. a LAN IP during development).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type PracticeData = { songs: Song[]; sessions: Session[]; licks: Lick[] };
export type Action = 'song' | 'session' | 'lick' | 'delete-song' | 'delete-lick';

/** Thrown when the server responds 401; callers show the sign-in gate instead of a generic error. */
export class UnauthorizedError extends Error {
  constructor() { super('Sign in required.'); this.name = 'UnauthorizedError'; }
}

export async function loadPractice(): Promise<PracticeData> {
  const r = await fetch('/api/practice');
  if (r.status === 401) throw new UnauthorizedError();
  const p = await r.json() as Partial<PracticeData> & { error?: string };
  if (!r.ok) throw new Error(p.error || 'Your saved practice is unavailable.');
  return { songs: p.songs ?? [], sessions: p.sessions ?? [], licks: p.licks ?? [] };
}

export async function post(type: Action, data: unknown) {
  const r = await fetch('/api/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, data }) });
  if (r.status === 401) throw new UnauthorizedError();
  const p = await r.json().catch(() => ({})) as { error?: string; revision?: number };
  if (!r.ok) throw new Error(p.error || 'Unable to save');
  return p;
}

export async function signIn(passphrase: string) {
  const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) });
  const p = await r.json().catch(() => ({})) as { error?: string };
  if (!r.ok) throw new Error(p.error || 'Could not sign in.');
}

export async function signOut() {
  await fetch('/api/auth', { method: 'DELETE' });
}
