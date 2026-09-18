import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Fretboard, type FretboardProps } from '@/components/app/fretboard';
import { DEGREES, NOTES, STRING_NAMES, degree, inPosition, isScaleNote, noteAt, visibleFrets } from '@/lib/music';

const base: FretboardProps = { root: 4, box: 'all', frets: visibleFrets('low', 24), blues: false, intervals: false, hidden: false, connect: true, sounding: '', onPlay: () => {} };
const notes = () => screen.queryAllByRole('button').map(b => {
  const m = /String (\w), fret (\d+)/.exec(b.getAttribute('aria-label')!)!;
  return { s: STRING_NAMES.indexOf(m[1]), f: +m[2], el: b };
});
const key = (n: { s: number; f: number }) => `${n.s}:${n.f}`;

function expected(p: FretboardProps) {
  const out: string[] = [];
  for (let s = 0; s < 6; s++) for (const f of p.frets) {
    if (!isScaleNote(s, f, p.root, p.blues)) continue;
    const b = p.box === 'all' ? -1 : +p.box;
    const primary = b < 0 || inPosition(s, f, p.root, b, p.blues);
    const neighbor = b >= 0 && p.connect && inPosition(s, f, p.root, (b + 1) % 5, p.blues);
    if (primary || neighbor) out.push(`${s}:${f}`);
  }
  return out.sort();
}

describe('Fretboard shows exactly the right notes', () => {
  for (const blues of [false, true]) for (const connect of [true, false]) {
    it(`all 12 keys × 6 positions (blues ${blues}, next box ${connect})`, () => {
      for (let root = 0; root < 12; root++) for (const box of ['all', '0', '1', '2', '3', '4']) {
        const p = { ...base, root, box, blues, connect };
        const { unmount } = render(<Fretboard {...p} />);
        expect(notes().map(key).sort(), `key ${root} box ${box}`).toEqual(expected(p));
        unmount();
      }
    });
  }
  for (const range of ['low', 'high', 'full'] as const) for (const count of [22, 24]) {
    it(`fret range ${range} on a ${count}-fret guitar`, () => {
      const frets = visibleFrets(range, count);
      render(<Fretboard {...base} frets={frets} />);
      const numbers = [...document.querySelectorAll('.fret-number')].map(e => +e.textContent!);
      expect(numbers).toEqual(frets);
      expect(Math.max(...notes().map(n => n.f))).toBeLessThanOrEqual(count);
      expect(notes().map(key).sort()).toEqual(expected({ ...base, frets }));
    });
  }
});

describe('Fretboard labels and styling', () => {
  it('shows note names by default, intervals when toggled, dots when hidden', () => {
    const { rerender } = render(<Fretboard {...base} />);
    for (const n of notes()) expect(n.el).toHaveTextContent(NOTES[noteAt(n.s, n.f)]);
    rerender(<Fretboard {...base} intervals />);
    for (const n of notes()) expect(n.el).toHaveTextContent(DEGREES[degree(n.s, n.f, 4)]);
    rerender(<Fretboard {...base} hidden />);
    for (const n of notes()) { expect(n.el).toHaveTextContent('·'); expect(n.el).toHaveClass('hidden-note'); expect(n.el.getAttribute('aria-label')).not.toMatch(/root|minor|[A-G]$/); }
  });
  it('marks roots, blue notes and next-box notes', () => {
    render(<Fretboard {...base} box="0" blues connect />);
    for (const n of notes()) {
      const d = degree(n.s, n.f, 4);
      expect(n.el.classList.contains('root')).toBe(d === 0);
      expect(n.el.classList.contains('blue')).toBe(d === 6);
      expect(n.el.classList.contains('neighbor')).toBe(!inPosition(n.s, n.f, 4, 0, true));
    }
    expect(document.querySelectorAll('.note.neighbor').length).toBeGreaterThan(0);
  });
  it('highlights a path string', () => {
    render(<Fretboard {...base} pathString={2} />);
    for (const n of notes()) expect(n.el.classList.contains('path-note')).toBe(n.s === 2);
  });
  it('shows the sounding note', () => {
    render(<Fretboard {...base} sounding="5-0" />);
    expect(notes().filter(n => n.el.classList.contains('sounding')).map(key)).toEqual(['5:0']);
  });
  it('reports every tapped note', () => {
    const onPlay = vi.fn();
    render(<Fretboard {...base} onPlay={onPlay} />);
    for (const n of notes()) { fireEvent.click(n.el); expect(onPlay).toHaveBeenLastCalledWith(n.s, n.f); }
    expect(onPlay).toHaveBeenCalledTimes(notes().length);
  });
  it('draws inlays at 3 5 7 9, double at 12', () => {
    render(<Fretboard {...base} />);
    const inlays = [...document.querySelectorAll('.inlay')].map(e => e.textContent);
    expect(inlays[3]).toBe('●'); expect(inlays[12]).toBe('● ●'); expect(inlays[4]).toBe('');
  });
  it('quiz mode hides names, shows ? on the target, reveals after answering', () => {
    const target = { string: 5, fret: 3 };
    const { rerender } = render(<Fretboard {...base} quiz={{ target, revealed: false }} />);
    const t = notes().find(n => n.s === 5 && n.f === 3)!;
    expect(t.el).toHaveTextContent('?'); expect(t.el).toHaveClass('quiz-target');
    expect(t.el.getAttribute('aria-label')).not.toContain('G');
    for (const n of notes().filter(n => !(n.s === 5 && n.f === 3))) expect(n.el).toHaveTextContent('·');
    rerender(<Fretboard {...base} quiz={{ target, revealed: true }} />);
    expect(notes().find(n => n.s === 5 && n.f === 3)!.el).toHaveTextContent('G');
  });
  it('quiz target is shown even outside the selected box', () => {
    render(<Fretboard {...base} box="2" connect={false} quiz={{ target: { string: 5, fret: 0 }, revealed: false }} />);
    expect(notes().some(n => n.s === 5 && n.f === 0)).toBe(true);
  });
});
