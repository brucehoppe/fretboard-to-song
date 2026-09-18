import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBool, isInt, isOneOf, useStoredState } from '@/hooks/use-stored-state';
import { useUnsavedWarning } from '@/hooks/use-unsaved-warning';
import { useFretboardView } from '@/hooks/use-fretboard-view';
import { useWebMcp } from '@/hooks/use-webmcp';

describe('useStoredState', () => {
  it('starts at the default, persists, and restores', () => {
    const a = renderHook(() => useStoredState('k', 5, isInt(0, 10)));
    expect(a.result.current[0]).toBe(5);
    act(() => a.result.current[1](7));
    expect(a.result.current[0]).toBe(7);
    expect(localStorage.getItem('fts:k')).toBe('7');
    const b = renderHook(() => useStoredState('k', 5, isInt(0, 10)));
    expect(b.result.current[0]).toBe(7);
  });
  it('keeps two hooks with the same key in sync', () => {
    const a = renderHook(() => useStoredState('shared', false, isBool));
    const b = renderHook(() => useStoredState('shared', false, isBool));
    act(() => a.result.current[1](true));
    expect(b.result.current[0]).toBe(true);
  });
  it('follows changes made in another browser tab', () => {
    const a = renderHook(() => useStoredState('tab', 'x', isOneOf(['x', 'y'] as const)));
    act(() => { localStorage.setItem('fts:tab', '"y"'); window.dispatchEvent(new StorageEvent('storage')); });
    expect(a.result.current[0]).toBe('y');
  });
  it.each(['not json', '"wrong type"', '42', 'null'])('ignores invalid stored value %s', raw => {
    localStorage.setItem('fts:v', raw);
    expect(renderHook(() => useStoredState('v', true, isBool)).result.current[0]).toBe(true);
  });
  it('still works in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const a = renderHook(() => useStoredState('blocked', 1, isInt(0, 9)));
    act(() => a.result.current[1](3));
    expect(a.result.current[0]).toBe(3);
  });
  it('validators', () => {
    expect(isInt(0, 11)(11)).toBe(true); expect(isInt(0, 11)(12)).toBe(false); expect(isInt(0, 11)(1.5)).toBe(false); expect(isInt(0, 11)('1')).toBe(false);
    expect(isOneOf(['a'] as const)('a')).toBe(true); expect(isOneOf(['a'] as const)('b')).toBe(false); expect(isOneOf(['a'] as const)(1)).toBe(false);
    expect(isBool(false)).toBe(true); expect(isBool(0)).toBe(false);
  });
  it('useFretboardView only accepts 22 or 24 frets', () => {
    localStorage.setItem('fts:frets', '21');
    expect(renderHook(() => useFretboardView()).result.current.fretCount).toBe(24);
    localStorage.setItem('fts:frets', '22');
    expect(renderHook(() => useFretboardView()).result.current.fretCount).toBe(22);
  });
});

describe('useUnsavedWarning', () => {
  const fire = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
  it('warns only while dirty', () => {
    const { rerender, unmount } = renderHook(({ d }) => useUnsavedWarning(d), { initialProps: { d: false } });
    expect(fire()).toBe(false);
    rerender({ d: true }); expect(fire()).toBe(true);
    rerender({ d: false }); expect(fire()).toBe(false);
    rerender({ d: true }); unmount(); expect(fire()).toBe(false);
  });
});

describe('useWebMcp', () => {
  type Tool = { name: string; inputSchema: unknown; execute: (i: unknown) => unknown };
  function mount() {
    let tool: Tool | undefined; let signal: AbortSignal | undefined;
    (document as any).modelContext = { registerTool: (t: Tool, o: { signal: AbortSignal }) => { tool = t; signal = o.signal; } };
    const showJourney = vi.fn();
    const hook = renderHook(() => { const view = useFretboardView(); useWebMcp(view, showJourney); return view; });
    return { hook, showJourney, tool: () => tool!, signal: () => signal! };
  }
  afterEach(() => { delete (document as any).modelContext; });

  it('does nothing without document.modelContext', () => {
    expect(() => renderHook(() => { const view = useFretboardView(); useWebMcp(view, () => {}); })).not.toThrow();
  });
  it('registers configure_fretboard and applies key, box, range and blues', () => {
    const m = mount();
    expect(m.tool().name).toBe('configure_fretboard');
    let r: unknown;
    act(() => { r = m.tool().execute({ key: 9, box: '2', range: 'full', blues: true }); });
    expect(r).toEqual({ key: 'A minor', box: '2', range: 'full', blues: true });
    expect(m.hook.result.current).toMatchObject({ root: 9, box: '2', range: 'full', blues: true });
    expect(m.showJourney).toHaveBeenCalled();
  });
  it('leaves blues unchanged when omitted', () => {
    const m = mount();
    act(() => { m.tool().execute({ key: 0, box: 'all', range: 'low' }); });
    expect(m.hook.result.current.blues).toBe(false);
  });
  it.each([
    [{ key: 12, box: 'all', range: 'low' }], [{ key: 1.5, box: 'all', range: 'low' }], [{ key: 0, box: '5', range: 'low' }],
    [{ key: 0, box: 'all', range: 'mid' }], [null],
  ])('rejects invalid input %j', input => {
    const m = mount();
    expect(() => m.tool().execute(input)).toThrow('Invalid');
  });
  it('unregisters on unmount', () => {
    const m = mount();
    m.hook.unmount();
    expect(m.signal().aborted).toBe(true);
  });
  it('logs (does not crash) if registration fails', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    (document as any).modelContext = { registerTool: () => { throw new Error('nope'); } };
    renderHook(() => { const view = useFretboardView(); useWebMcp(view, () => {}); });
    expect(err).toHaveBeenCalled();
  });
});
