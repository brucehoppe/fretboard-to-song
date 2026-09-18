'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Choice, keyItems } from '@/components/app/fields';
import { Fretboard } from '@/components/app/fretboard';
import { NOTES, boxTip, boxesLowToHigh, type Register } from '@/lib/music';

const REGISTERS: [Register, string][] = [['down', 'Octave down'], ['standard', 'Standard'], ['up', 'Octave up']];
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

export function FiveBoxes({ root, setRoot, blues, intervals, fretCount, sounding, onPlay }: {
  root: number; setRoot: (root: number) => void; blues: boolean; intervals: boolean; fretCount: number;
  sounding: string; onPlay: (string: number, fret: number) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [register, setRegister] = useState<Register>('standard');
  const toggle = (box: number) =>
    setSelected(sel => sel.includes(box) ? sel.filter(b => b !== box) : [...sel, box].sort((a, b) => a - b));

  const placed = boxesLowToHigh(root, register, fretCount);
  const outOfOrder = placed.some((p, i) => p.box !== i);
  const neck = useMemo(() => range(0, fretCount), [fretCount]);
  const names = selected.map(b => b + 1).join(' + ');
  const mapLabel = selected.length === 0 ? 'Full neck — all boxes'
    : `Full neck — ${selected.length === 1 ? 'Box' : 'Boxes'} ${names} selected`;

  return (
    <section className="panel five-boxes" aria-label="The five boxes">
      <div className="section-heading">
        <div><p className="eyebrow">SHAPES</p><h2>The five boxes</h2></div>
        <span className="boxes-span">{NOTES[root]} minor · frets {placed[0].lo}–{Math.max(...placed.map(p => p.hi))}</span>
      </div>
      <p className="boxes-tip">Select one or more boxes to practise moving between them. Tap a selected box again to remove it.
        Start slowly: play a short phrase in one box, pause, find the root in the next box, then move.</p>
      <div className="boxes-controls">
        <Choice label="Key" value={String(root)} onChange={v => setRoot(+v)} items={keyItems(NOTES)} />
        <div className="boxes-group" role="group" aria-label="Register">
          {REGISTERS.map(([r, label]) => (
            <Button key={r} size="sm" variant={register === r ? 'default' : 'outline'} aria-pressed={register === r} onClick={() => setRegister(r)}>{label}</Button>
          ))}
        </div>
        <div className="boxes-group" role="group" aria-label="Select practice boxes">
          {[0, 1, 2, 3, 4].map(b => (
            <Button key={b} size="sm" variant={selected.includes(b) ? 'default' : 'outline'} aria-pressed={selected.includes(b)} onClick={() => toggle(b)}>Box {b + 1}</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelected([])} disabled={selected.length === 0}>Show all</Button>
        </div>
      </div>
      <p className="map-label" aria-live="polite">{mapLabel}</p>
      <div role="group" aria-label="Five boxes neck map">
        <Fretboard root={root} box="all" frets={neck} blues={blues} intervals={intervals} hidden={false} connect={false}
          sounding={sounding} onPlay={onPlay} selection={selected} />
      </div>
      {outOfOrder && (
        <p className="boxes-order">Laid out low to high on the neck: <b>{placed.map(p => `Box ${p.box + 1}`).join(' · ')}</b>.
          Here the boxes no longer run in numeric order — Box 1 is a shape, not a place.</p>
      )}
      <div className="box-grid">
        {placed.map(p => {
          const on = selected.includes(p.box);
          return (
            // Clicking anywhere on the card selects it, as in the practice desk; the header
            // button is the keyboard and screen-reader control, and notes still just play.
            <article key={p.box} aria-label={`Box ${p.box + 1}`} className={'box-card' + (on ? ' selected' : '')}
              onClick={e => { if (!(e.target as HTMLElement).closest('.note, .box-card-head')) toggle(p.box); }}>
              <button type="button" className="box-card-head" aria-pressed={on} onClick={() => toggle(p.box)}>
                <b>Box {p.box + 1}</b><span>fret {p.lo}–{p.hi}</span>
              </button>
              <Fretboard compact root={root} box={String(p.box)} frets={range(p.lo, blues ? Math.min(p.hi + 1, fretCount) : p.hi)}
                blues={blues} intervals={intervals} hidden={false} connect={false} sounding={sounding} onPlay={onPlay} />
              <p>{boxTip(p.box)}</p>
              {register !== 'standard' && !p.moved && (
                <p className="stayed">Standard position — there is no room for this shape {register === 'down'
                  ? 'an octave lower; its bottom note would fall past the nut'
                  : `an octave higher; its top note would run past fret ${fretCount}`}.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
