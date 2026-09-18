/**
 * Recording fake for the Web Audio API. Every oscillator logs the frequencies it
 * was set to, so tests can assert that the right pitches sound.
 */
export type ToneLog = { type: string; freqs: number[]; start: number; ramps: number };

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  state = 'running';
  tones: ToneLog[] = [];
  destination = {};
  constructor() { FakeAudioContext.instances.push(this); }
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() {
    const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: param, connect() {}, disconnect() {} };
  }
  createOscillator() {
    const log: ToneLog = { type: 'sine', freqs: [], start: 0, ramps: 0 };
    this.tones.push(log);
    const frequency = {
      set value(v: number) { log.freqs.push(v); },
      setValueAtTime(v: number) { log.freqs.push(v); },
      linearRampToValueAtTime(v: number) { log.freqs.push(v); log.ramps++; },
    };
    return {
      frequency,
      set type(t: string) { log.type = t; },
      connect() {}, disconnect() {},
      start(t: number) { log.start = t; }, stop() {},
      onended: null as null | (() => void),
    };
  }
}

/** The single context the app creates (it shares one). */
export const audio = () => FakeAudioContext.instances.at(-1)!;
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
