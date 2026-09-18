import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudio, useBeat, useMetronome } from '@/hooks/use-audio';
import { TUNING, buildLickIdea, midiAt, LICK_MOVES, type LickMove } from '@/lib/music';
import { audio, hz, near } from '../helpers/fake-audio';

describe('useAudio', () => {
  it('creates the AudioContext lazily and reuses it', () => {
    const { result } = renderHook(() => useAudio());
    expect(globalThis.AudioContext && (AudioContext as any).instances).toHaveLength(0);
    act(() => { result.current.playNote(0, 0); result.current.playNote(1, 0); });
    expect((AudioContext as any).instances).toHaveLength(1);
  });
  it('plays the correct pitch for every string and fret', () => {
    const { result } = renderHook(() => useAudio());
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 24; f++) {
      act(() => result.current.playNote(s, f));
      expect(near(audio().tones.at(-1)!.freqs[0], hz(TUNING[s] + f))).toBe(true);
    }
    expect(near(audio().tones[0].freqs[0], 329.63)).toBe(true); // open high e
  });
  it('closes the context on unmount', () => {
    const { result, unmount } = renderHook(() => useAudio());
    act(() => result.current.playNote(0, 0));
    unmount();
    expect(audio().state).toBe('closed');
  });
  it('keeps a stable identity across renders (metronome depends on it)', () => {
    const { result, rerender } = renderHook(() => useAudio());
    const first = result.current; rerender();
    expect(result.current).toBe(first);
  });
  for (const [move] of LICK_MOVES) {
    it(`phrase playback for "${move}" sounds every note, one oscillator per pick stroke`, () => {
      const { result } = renderHook(() => useAudio());
      const idea = buildLickIdea(4, move as LickMove, 0);
      let ms = 0;
      act(() => { ms = result.current.playPhrase(idea.events, 80); });
      const freqs = audio().tones.flatMap(t => t.freqs);
      for (const e of idea.events) expect(freqs.some(f => near(f, hz(midiAt(e.string, e.fret)))), `${move} ${e.string}/${e.fret}`).toBe(true);
      const strokes = idea.events.filter((e, i) => !(e.via && idea.events[i - 1]?.string === e.string)).length;
      expect(audio().tones).toHaveLength(strokes);
      const beats = idea.events.reduce((s, e) => s + (e.beats ?? 0.5), 0);
      expect(ms).toBeGreaterThan(beats * 750 - 50);
    });
  }
  it('bends and slides glide; hammer-ons step', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playPhrase(buildLickIdea(4, 'bend').events); });
    expect(audio().tones[0].ramps).toBe(2);
    act(() => { result.current.playPhrase(buildLickIdea(4, 'slide').events); });
    expect(audio().tones.some(t => t.ramps === 1)).toBe(true);
    const before = audio().tones.length;
    act(() => { result.current.playPhrase(buildLickIdea(4, 'legato').events); });
    expect(audio().tones.slice(before).every(t => t.ramps === 0)).toBe(true);
  });
  it('tempo changes the phrase length', () => {
    const { result } = renderHook(() => useAudio());
    const events = buildLickIdea(4, 'question').events;
    let slow = 0, fast = 0;
    act(() => { slow = result.current.playPhrase(events, 60); fast = result.current.playPhrase(events, 100); });
    expect(slow).toBeGreaterThan(fast);
  });
  it('stopPhrase stops scheduled notes safely (twice)', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playPhrase(buildLickIdea(4, 'question').events); });
    expect(() => act(() => { result.current.stopPhrase(); result.current.stopPhrase(); })).not.toThrow();
  });
});

describe('useMetronome', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const setup = () => renderHook(() => { const a = useAudio(); const m = useMetronome(a); return { ...m, beat: useBeat(m) }; });
  const clicks = () => audio().tones.filter(t => t.type === 'sine');

  it('defaults to 75 BPM, stopped', () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ bpm: 75, playing: false, beat: -1 });
  });
  it.each([[29, 30], [30, 30], [120, 120], [240, 240], [500, 240], [99.6, 100]])('setBpm(%s) → %i', (v, e) => {
    const { result } = setup();
    act(() => result.current.setBpm(v));
    expect(result.current.bpm).toBe(e);
  });
  it('clicks at the tempo with an accent on beat one', () => {
    const { result } = setup();
    act(() => result.current.start(120));
    for (let i = 0; i < 40; i++) act(() => { audio().currentTime += 0.05; vi.advanceTimersByTime(25); });
    const c = clicks();
    expect(c.length).toBeGreaterThanOrEqual(4);
    expect(c.map(t => t.freqs[0]).slice(0, 5)).toEqual([1100, 750, 750, 750, 1100]);
    const gaps = c.slice(1, 5).map((t, i) => t.start - c[i].start);
    for (const g of gaps) expect(g).toBeCloseTo(0.5, 5);
  });
  it('animates the beat indicator and resets it on stop', () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.beat).toBe(0);
    act(() => result.current.setPlaying(false));
    expect(result.current.beat).toBe(-1);
  });
  it('beats re-render only useBeat subscribers, not everything holding the metronome', () => {
    let holderRenders = 0;
    const { result } = renderHook(() => { holderRenders++; const a = useAudio(); return useMetronome(a); });
    const beats = renderHook(() => useBeat(result.current));
    act(() => result.current.start(240));
    const afterStart = holderRenders;
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) { act(() => { audio().currentTime += 0.05; vi.advanceTimersByTime(25); }); seen.add(beats.result.current); }
    expect([...seen].filter(b => b >= 0).length).toBeGreaterThanOrEqual(3); // the lights did move
    expect(holderRenders).toBe(afterStart);                                 // the holder never re-rendered
  });
  it('keeps a stable identity while nothing changes', () => {
    const { result, rerender } = renderHook(() => { const a = useAudio(); return useMetronome(a); });
    const first = result.current; rerender();
    expect(result.current).toBe(first);
  });
  it('stops scheduling after stop', () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.setPlaying(false));
    const n = clicks().length;
    for (let i = 0; i < 20; i++) act(() => { audio().currentTime += 0.1; vi.advanceTimersByTime(25); });
    expect(clicks().length).toBe(n);
  });
  it('stops when the tab is hidden', () => {
    const { result } = setup();
    act(() => result.current.start());
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.playing).toBe(false);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
  it('tap tempo averages taps and resets after a pause', () => {
    const { result } = setup();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    for (let i = 0; i < 4; i++) { act(() => result.current.tap()); now += 500; }
    expect(result.current.bpm).toBe(120);
    now += 5000;
    act(() => result.current.tap()); now += 1000; act(() => result.current.tap());
    expect(result.current.bpm).toBe(60);
  });
  it('a single tap does not change tempo', () => {
    const { result } = setup();
    act(() => result.current.tap());
    expect(result.current.bpm).toBe(75);
  });
});
