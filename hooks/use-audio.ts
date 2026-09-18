'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { midiAt, phraseGroups, type PhraseNote } from '@/lib/music';

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * One shared AudioContext for note taps, phrase playback and the metronome.
 * Created lazily on first user gesture (browsers block autoplay otherwise).
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const phraseNodes = useRef<OscillatorNode[]>([]);

  const ctx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  /** A plucked-string-ish voice: triangle + quick attack + exponential decay. */
  const voice = useCallback((at: number, duration: number, level = 0.18, type: OscillatorType = 'triangle') => {
    const c = ctx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.007);
    g.gain.exponentialRampToValueAtTime(0.001, at + duration);
    o.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + duration + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    return o;
  }, [ctx]);

  const playNote = useCallback((string: number, fret: number) => {
    const c = ctx();
    voice(c.currentTime, 0.7).frequency.value = hz(midiAt(string, fret));
  }, [ctx, voice]);

  const click = useCallback((at: number, accent: boolean) => {
    voice(at, 0.04, accent ? 0.12 : 0.08, 'sine').frequency.value = accent ? 1100 : 750;
  }, [voice]);

  const stopPhrase = useCallback(() => {
    phraseNodes.current.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
    phraseNodes.current = [];
  }, []);

  /**
   * Plays a phrase with rhythm. Each pick stroke is one oscillator; hammer-ons and
   * pull-offs step the pitch, slides glide quickly, bends glide slowly.
   * Returns the total duration in ms.
   */
  const playPhrase = useCallback((notes: PhraseNote[], bpm = 80) => {
    stopPhrase();
    const c = ctx(), beat = 60 / bpm;
    let t = c.currentTime + 0.08;
    for (const group of phraseGroups(notes)) {
      const length = group.reduce((sum, n) => sum + (n.beats ?? 0.5) * beat, 0);
      const o = voice(t, length + 0.25);
      let at = t;
      group.forEach((n, i) => {
        const f = hz(midiAt(n.string, n.fret));
        if (i === 0) o.frequency.setValueAtTime(f, at);
        else if (n.via === 'b' || n.via === 'r') o.frequency.linearRampToValueAtTime(f, at + Math.min(0.28, beat * 0.6));
        else if (n.via === '/' || n.via === '\\') o.frequency.linearRampToValueAtTime(f, at + 0.09);
        else o.frequency.setValueAtTime(f, at);
        at += (n.beats ?? 0.5) * beat;
      });
      phraseNodes.current.push(o);
      t += length;
    }
    return Math.round((t - c.currentTime) * 1000) + 250;
  }, [ctx, voice, stopPhrase]);

  // Stable identity matters: the metronome effect depends on this object.
  return useMemo(() => ({ ctx, playNote, playPhrase, stopPhrase, click }), [ctx, playNote, playPhrase, stopPhrase, click]);
}

export type Audio = ReturnType<typeof useAudio>;

/** Look-ahead metronome scheduler (Chris Wilson's "tale of two clocks" pattern). */
export function useMetronome(audio: Audio) {
  const [bpm, setBpmState] = useState(75);
  const [playing, setPlaying] = useState(false);
  const taps = useRef<number[]>([]);
  // The beat is published outside React state: it changes several times a second, and as
  // state it re-rendered every component holding the metronome. Only useBeat() listens.
  const beat = useRef(-1);
  const listeners = useRef(new Set<() => void>());
  const setBeat = useCallback((n: number) => { beat.current = n; listeners.current.forEach(l => l()); }, []);
  const subscribeBeat = useCallback((l: () => void) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; }, []);
  const getBeat = useCallback(() => beat.current, []);

  const setBpm = useCallback((value: number) => setBpmState(Math.max(30, Math.min(240, Math.round(value)))), []);

  useEffect(() => {
    if (!playing) return;
    const c = audio.ctx();
    let next = c.currentTime + 0.07, count = 0;
    const visuals: ReturnType<typeof setTimeout>[] = [];
    const schedule = () => {
      while (next < c.currentTime + 0.12) {
        const n = count % 4;
        audio.click(next, n === 0);
        visuals.push(setTimeout(() => setBeat(n), Math.max(0, (next - c.currentTime) * 1000)));
        next += 60 / bpm; count++;
      }
    };
    schedule();
    const timer = setInterval(schedule, 25);
    const stopWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      clearInterval(timer); visuals.forEach(clearTimeout); setBeat(-1);
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [playing, bpm, audio, setBeat]);

  /** Tap tempo: average of the last few intervals; resets after a 2 s pause. */
  const tap = useCallback(() => {
    const now = performance.now();
    taps.current = taps.current.filter(t => now - t < 2000).concat(now).slice(-5);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
    }
  }, [setBpm]);

  const start = useCallback((at?: number) => { if (at) setBpm(at); audio.ctx(); setPlaying(true); }, [audio, setBpm]);

  return useMemo(() => ({ bpm, setBpm, playing, setPlaying, start, tap, subscribeBeat, getBeat }),
    [bpm, setBpm, playing, start, tap, subscribeBeat, getBeat]);
}
export type Metronome = ReturnType<typeof useMetronome>;

/** The current beat (0–3), or -1 when stopped; re-renders only the component that calls it. */
export function useBeat(m: Pick<Metronome, 'subscribeBeat' | 'getBeat'>) {
  return useSyncExternalStore(m.subscribeBeat, m.getBeat, () => -1);
}
