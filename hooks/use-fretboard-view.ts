'use client';
import { isBool, isInt, isOneOf, useStoredState } from '@/hooks/use-stored-state';
import type { FretRange } from '@/lib/music';

const BOXES = ['all', '0', '1', '2', '3', '4'] as const;
const RANGES = ['low', 'high', 'full'] as const;

/** Fretboard view settings, remembered between visits on this device. */
export function useFretboardView() {
  const [root, setRoot] = useStoredState('root', 4, isInt(0, 11));
  const [box, setBox] = useStoredState<string>('box', 'all', isOneOf(BOXES));
  const [range, setRange] = useStoredState<FretRange>('range', 'low', isOneOf(RANGES));
  const [fretCount, setFretCount] = useStoredState('frets', 24, (v): v is number => v === 22 || v === 24);
  const [blues, setBlues] = useStoredState('blues', false, isBool);
  const [intervals, setIntervals] = useStoredState('intervals', false, isBool);
  const [connect, setConnect] = useStoredState('connect', true, isBool);
  return { root, setRoot, box, setBox, range, setRange, fretCount, setFretCount, blues, setBlues, intervals, setIntervals, connect, setConnect };
}
export type FretboardView = ReturnType<typeof useFretboardView>;
