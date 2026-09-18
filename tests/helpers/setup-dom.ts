import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { FakeAudioContext } from './fake-audio';

// jsdom gaps that Radix primitives (Select, Switch, Checkbox) rely on.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {},
  scrollIntoView: () => {},
});
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
