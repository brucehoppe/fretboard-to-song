'use client';
import { useCallback, useSyncExternalStore } from 'react';

/*
 * UI preferences (key, box, fret range…) remembered in localStorage.
 * useSyncExternalStore gives the server/first render the default value and then
 * the stored one, without hydration mismatches. An in-memory mirror keeps things
 * working when storage is blocked (e.g. some private-browsing modes).
 */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const PREFIX = 'fts:';

function read(key: string) {
  // localStorage is the source of truth (so other tabs stay in sync);
  // memory is only used when storage is blocked.
  try { return localStorage.getItem(PREFIX + key); } catch { return memory.get(key) ?? null; }
}
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => { listeners.delete(onChange); window.removeEventListener('storage', onChange); };
}

export function useStoredState<T>(key: string, initial: T, valid: (v: unknown) => v is T) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = initial;
  if (raw !== null) {
    try { const parsed: unknown = JSON.parse(raw); if (valid(parsed)) value = parsed; } catch { /* ignore corrupt value */ }
  }
  const setValue = useCallback((next: T) => {
    const text = JSON.stringify(next);
    try { localStorage.setItem(PREFIX + key, text); } catch { memory.set(key, text); }
    listeners.forEach(l => l());
  }, [key]);
  return [value, setValue] as const;
}

export const isInt = (min: number, max: number) => (v: unknown): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
export const isOneOf = <T extends string>(options: readonly T[]) => (v: unknown): v is T => typeof v === 'string' && (options as readonly string[]).includes(v);
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
