'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { NOTES } from '@/lib/music';
import type { FretboardView } from '@/hooks/use-fretboard-view';

type ModelContext = { registerTool: (tool: unknown, options: { signal: AbortSignal }) => unknown };

/**
 * Optional WebMCP tool so a browser agent can set up the fretboard view.
 * Feature-detected; the normal UI never depends on it.
 */
export function useWebMcp(view: FretboardView, showJourney: () => void) {
  const latest = useRef({ view, showJourney });
  useEffect(() => { latest.current = { view, showJourney }; });
  useEffect(() => {
    const mc = (document as unknown as { modelContext?: ModelContext }).modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: 'configure_fretboard',
      description: 'Set the visible minor pentatonic key, box, fret range and blue-note toggle. Does not log practice or change songs.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['key', 'box', 'range'],
        properties: {
          key: { type: 'integer', minimum: 0, maximum: 11, description: 'C=0, C-sharp=1, … B=11' },
          box: { enum: ['all', '0', '1', '2', '3', '4'], description: 'Zero-based box index, or all' },
          range: { enum: ['low', 'high', 'full'] },
          blues: { type: 'boolean', description: 'Show the ♭5 blue note' },
        },
      },
      annotations: { readOnlyHint: false },
      execute(input: unknown) {
        const p = input as { key: number; box: string; range: 'low' | 'high' | 'full'; blues?: boolean };
        if (!p || !Number.isInteger(p.key) || p.key < 0 || p.key > 11 || !['all', '0', '1', '2', '3', '4'].includes(p.box) || !['low', 'high', 'full'].includes(p.range)) throw new Error('Invalid key, box, or range');
        const { view: v, showJourney } = latest.current;
        flushSync(() => { showJourney(); v.setRoot(p.key); v.setBox(p.box); v.setRange(p.range); if (typeof p.blues === 'boolean') v.setBlues(p.blues); });
        return { key: `${NOTES[p.key]} minor`, box: p.box, range: p.range, blues: p.blues ?? v.blues };
      },
    };
    try { void Promise.resolve(mc.registerTool(tool, { signal: lifecycle.signal })).catch(console.error); } catch (e) { console.error(e); }
    return () => lifecycle.abort();
  }, []);
}
