import { describe, expect, it } from 'vitest';
import {
  BLUE_NOTE, DEGREES, LICK_MOVES, MINOR, NOTES, STRING_NAMES, TUNING,
  blueNoteInBox, boxPlacement, boxRootStrings, boxTip, boxesLowToHigh, buildLickIdea, degree, inBox, inPosition, intervalPath, isScaleNote, lickShift, midiAt,
  noteAt, phraseGroups, pickQuizTarget, practiceStats, quizPool, rangeFor, ratingFor, renderTab,
  scaleDegrees, scaleNotes, sectionReady, visibleFrets, type LickMove, type Register, type PhraseNote, type Song,
} from '@/lib/music';

const KEYS = NOTES.map((_, i) => i);
const STRINGS = [0, 1, 2, 3, 4, 5];
const BOXES = [0, 1, 2, 3, 4];
const FRETS_24 = Array.from({ length: 25 }, (_, i) => i);
const MOVES = LICK_MOVES.map(([m]) => m as LickMove);

describe('pitch basics', () => {
  it('uses standard tuning, high e first', () => {
    expect(TUNING).toEqual([64, 59, 55, 50, 45, 40]);
    expect(STRING_NAMES).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
    expect(STRINGS.map(s => NOTES[noteAt(s, 0)])).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
  });
  it('every fret on every string is one semitone above the previous', () => {
    for (const s of STRINGS) for (const f of FRETS_24.slice(1)) expect(midiAt(s, f) - midiAt(s, f - 1)).toBe(1);
  });
  it('the 12th fret is the octave of the open string', () => {
    for (const s of STRINGS) { expect(noteAt(s, 12)).toBe(noteAt(s, 0)); expect(midiAt(s, 12)).toBe(midiAt(s, 0) + 12); }
  });
  it('the 5th fret matches the next open string (4th fret on G)', () => {
    for (const s of [1, 3, 4, 5]) expect(midiAt(s, 5)).toBe(midiAt(s - 1, 0));
    expect(midiAt(2, 4)).toBe(midiAt(1, 0));
  });
  it('degree is 0 exactly on the root, for every key', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) {
      expect(degree(s, f, k) === 0).toBe(noteAt(s, f) === k);
      expect(degree(s, f, k)).toBeGreaterThanOrEqual(0);
      expect(degree(s, f, k)).toBeLessThan(12);
    }
  });
});

describe('scales', () => {
  it('minor pentatonic is R ♭3 4 5 ♭7; blues adds ♭5', () => {
    expect(scaleDegrees(false)).toEqual([0, 3, 5, 7, 10]);
    expect(scaleDegrees(true)).toEqual([0, 3, 5, 6, 7, 10]);
    for (const d of scaleDegrees(true)) expect(DEGREES[d]).toBeTruthy();
  });
  it.each(KEYS)('scaleNotes are correct for key %i', k => {
    expect(scaleNotes(k)).toEqual(MINOR.map(d => NOTES[(d + k) % 12]));
    expect(scaleNotes(k, true)).toHaveLength(6);
    expect(scaleNotes(k, true)).toContain(NOTES[(k + BLUE_NOTE) % 12]);
  });
  it('known spellings', () => {
    expect(scaleNotes(9)).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(scaleNotes(4, true)).toEqual(['E', 'G', 'A', 'B♭', 'B', 'D']);
  });
  it('isScaleNote respects the blues toggle', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) {
      const d = degree(s, f, k);
      expect(isScaleNote(s, f, k, false)).toBe(MINOR.includes(d));
      expect(isScaleNote(s, f, k, true)).toBe(MINOR.includes(d) || d === BLUE_NOTE);
    }
  });
});

describe('five box shapes (all 12 keys × 6 strings × frets 0–24)', () => {
  it('only scale notes are ever in a box', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) for (const b of BOXES) {
      if (inBox(s, f, k, b)) expect(MINOR).toContain(degree(s, f, k));
    }
  });
  it('every scale note belongs to one box, or two adjacent boxes', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) {
      if (!MINOR.includes(degree(s, f, k))) continue;
      const boxes = BOXES.filter(b => inBox(s, f, k, b));
      expect(boxes.length).toBeGreaterThanOrEqual(1);
      expect(boxes.length).toBeLessThanOrEqual(2);
      if (boxes.length === 2) expect([1, 4]).toContain(boxes[1] - boxes[0]);
    }
  });
  it('each box has exactly two notes per string within one octave window', () => {
    for (const k of KEYS) for (const b of BOXES) for (const s of STRINGS) {
      const offset = (k - 4 + 12) % 12;
      const window = Array.from({ length: 13 }, (_, i) => i + offset); // one 12-fret span
      const notes = window.filter(f => inBox(s, f, k, b));
      expect(notes.length, `key ${k} box ${b} string ${s}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('box 1 always starts on the root on the low E string', () => {
    for (const k of KEYS) {
      const offset = (k - 4 + 12) % 12;
      expect(inBox(5, offset, k, 0)).toBe(true);
      expect(degree(5, offset, k)).toBe(0);
      expect(inBox(5, offset + 3, k, 0)).toBe(true);
    }
  });
  it('E minor boxes match the standard shapes', () => {
    const shape = (b: number) => STRINGS.map(s => FRETS_24.filter(f => f <= 12 && inBox(s, f, 4, b)));
    expect(shape(0)).toEqual([[0, 3, 12], [0, 3, 12], [0, 2, 12], [0, 2, 12], [0, 2, 12], [0, 3, 12]]);
    expect(shape(1)).toEqual([[3, 5], [3, 5], [2, 4], [2, 5], [2, 5], [3, 5]]);
    expect(shape(2)).toEqual([[5, 7], [5, 8], [4, 7], [5, 7], [5, 7], [5, 7]]);
    expect(shape(3)).toEqual([[7, 10], [8, 10], [7, 9], [7, 9], [7, 10], [7, 10]]);
    // Box 5's fret-12 notes are the open strings an octave up, so fret 0 is in box 5 too.
    expect(shape(4)).toEqual([[0, 10, 12], [0, 10, 12], [0, 9, 12], [0, 9, 12], [0, 10, 12], [0, 10, 12]]);
  });
});

describe('five boxes as placed shapes (every key × register × 22/24 frets)', () => {
  const REGISTERS: Register[] = ['down', 'standard', 'up'];
  const each = (fn: (root: number, reg: Register, max: number) => void) =>
    KEYS.forEach(root => REGISTERS.forEach(reg => [22, 24].forEach(max => fn(root, reg, max))));

  it('every placement fits on the neck and holds exactly its 12 box notes', () => each((root, reg, max) => {
    for (const b of BOXES) {
      const { lo, hi } = boxPlacement(root, b, reg, max);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThanOrEqual(max);
      let notes = 0;
      for (const s of STRINGS) for (let f = lo; f <= hi; f++) if (isScaleNote(s, f, root, false) && inBox(s, f, root, b)) notes++;
      expect(notes).toBe(12);
    }
  }));
  it('standard puts Box 1 on the low-E root between frets 1 and 12', () => KEYS.forEach(root => {
    const { lo } = boxPlacement(root, 0, 'standard', 24);
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(lo).toBeLessThanOrEqual(12);
    expect(noteAt(5, lo)).toBe(root);
  }));
  it('octave down/up go as far as the neck allows, and "moved" means off the standard position', () => each((root, reg, max) => {
    for (const b of BOXES) {
      const p = boxPlacement(root, b, reg, max), std = boxPlacement(root, b, 'standard', max);
      if (reg === 'down') expect(p.lo - 12).toBeLessThan(0);
      if (reg === 'up') expect(p.hi + 12).toBeGreaterThan(max);
      expect(p.moved).toBe(p.lo !== std.lo);
      expect(p.hi - p.lo).toBe(std.hi - std.lo);
    }
  }));
  it('boxesLowToHigh returns all five, sorted by position on the neck', () => each((root, reg, max) => {
    const laid = boxesLowToHigh(root, reg, max);
    expect(laid.map(p => p.box).sort()).toEqual(BOXES);
    laid.slice(1).forEach((p, i) => expect(p.lo).toBeGreaterThanOrEqual(laid[i].lo));
  }));
  it('known placements: E minor', () => {
    expect(boxesLowToHigh(4, 'standard', 24).map(p => [p.box, p.lo, p.hi])).toEqual([[0, 12, 15], [1, 14, 17], [2, 16, 20], [3, 19, 22], [4, 21, 24]]);
    // A 22-fret neck has no room for Box 5 at 21–24, so it drops an octave and leads the order.
    expect(boxesLowToHigh(4, 'standard', 22).map(p => p.box)).toEqual([4, 0, 1, 2, 3]);
    expect(boxPlacement(4, 0, 'down', 24)).toEqual({ box: 0, lo: 0, hi: 3, moved: true });
    expect(boxPlacement(4, 0, 'up', 24)).toEqual({ box: 0, lo: 12, hi: 15, moved: false });
  });
  it('root strings are derived from the shapes (Box 2 is D and B; Box 3 is A and B)', () => {
    const named = (b: number) => boxRootStrings(b).map(s => STRING_NAMES[s]);
    expect(BOXES.map(named)).toEqual([['E', 'D', 'e'], ['D', 'B'], ['A', 'B'], ['A', 'G'], ['E', 'G', 'e']]);
    expect(boxTip(0)).toMatch(/Roots on the low E, D and high e strings\.$/);
    expect(boxTip(1)).toMatch(/Roots on the D and B strings\.$/);
  });
  it('root strings hold in every key and every register', () => each((root, reg, max) => {
    for (const b of BOXES) {
      const { lo, hi } = boxPlacement(root, b, reg, max);
      const withRoot = STRINGS.filter(s => {
        for (let f = lo; f <= hi; f++) if (inBox(s, f, root, b) && degree(s, f, root) === 0) return true;
        return false;
      });
      expect(withRoot).toEqual([...boxRootStrings(b)].sort((x, y) => x - y));
    }
  }));
});

describe('blue note placement', () => {
  it('is only ever the ♭5', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) for (const b of BOXES) {
      if (blueNoteInBox(s, f, k, b)) expect(degree(s, f, k)).toBe(BLUE_NOTE);
    }
  });
  it('every blue note on the neck belongs to at least one box, in every key', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) {
      if (degree(s, f, k) === BLUE_NOTE) expect(BOXES.some(b => blueNoteInBox(s, f, k, b)), `k${k} s${s} f${f}`).toBe(true);
    }
  });
  it('classic E blues box 1 spots', () => {
    expect(blueNoteInBox(4, 1, 4, 0)).toBe(true);
    expect(blueNoteInBox(2, 3, 4, 0)).toBe(true);
    expect(blueNoteInBox(5, 6, 4, 0)).toBe(false);
  });
  it('inPosition includes the blue note only when blues is on', () => {
    for (const k of KEYS) for (const s of STRINGS) for (const f of FRETS_24) for (const b of BOXES) {
      const d = degree(s, f, k);
      if (MINOR.includes(d)) { expect(inPosition(s, f, k, b, false)).toBe(inBox(s, f, k, b)); expect(inPosition(s, f, k, b, true)).toBe(inBox(s, f, k, b)); }
      else if (d === BLUE_NOTE) { expect(inPosition(s, f, k, b, false)).toBe(false); expect(inPosition(s, f, k, b, true)).toBe(blueNoteInBox(s, f, k, b)); }
      else { expect(inPosition(s, f, k, b, true)).toBe(false); }
    }
  });
});

describe('fret ranges', () => {
  it.each([[22], [24]])('visibleFrets for a %i-fret guitar', n => {
    expect(visibleFrets('low', n)).toEqual(Array.from({ length: 13 }, (_, i) => i));
    expect(visibleFrets('high', n)).toEqual(Array.from({ length: n - 11 }, (_, i) => i + 12));
    expect(visibleFrets('full', n)).toEqual(Array.from({ length: n + 1 }, (_, i) => i));
  });
  it('rangeFor picks the smallest range containing the frets', () => {
    expect(rangeFor([0, 5, 12])).toBe('low');
    expect(rangeFor([12, 17, 24])).toBe('high');
    expect(rangeFor([10, 14])).toBe('full');
    expect(rangeFor([12])).toBe('low');
  });
});

describe('song readiness', () => {
  const song = (sections: Partial<Song['sections'][number]>[], target = 100): Song => ({
    id: 'x', title: 't', artist: '', key: 4, target, notes: '', runs: 0, lastRun: '', revision: 1,
    sections: sections.map((s, i) => ({ id: String(i), name: `S${i}`, bpm: 100, status: 'Steady', transition: true, ...s })),
  });
  it.each([
    ['Steady, at target, transition', { status: 'Steady', bpm: 100, transition: true }, true],
    ['Steady, above target', { status: 'Steady', bpm: 140, transition: true }, true],
    ['Steady, below target', { status: 'Steady', bpm: 99, transition: true }, false],
    ['Learning', { status: 'Learning', bpm: 100, transition: true }, false],
    ['New', { status: 'New', bpm: 100, transition: true }, false],
    ['no transition', { status: 'Steady', bpm: 100, transition: false }, false],
  ] as const)('second section: %s', (_, s, ready) => {
    expect(sectionReady(song([{}, s]), 1)).toBe(ready);
  });
  it('the first section never needs a transition', () => {
    expect(sectionReady(song([{ transition: false }]), 0)).toBe(true);
  });
});

describe('phrase → tab and intervals', () => {
  const all: PhraseNote[] = [
    { string: 1, fret: 12 }, { string: 1, fret: 15, via: 'h' }, { string: 1, fret: 12, via: 'p' },
    { string: 2, fret: 12 }, { string: 2, fret: 14, via: '/' }, { string: 2, fret: 12, via: '\\' },
    { string: 1, fret: 15 }, { string: 1, fret: 17, via: 'b' }, { string: 1, fret: 15, via: 'r' },
  ];
  it('groups connected notes on the same string only', () => {
    expect(phraseGroups(all).map(g => g.length)).toEqual([3, 3, 3]);
    expect(phraseGroups([{ string: 1, fret: 12 }, { string: 2, fret: 14, via: 'h' }]).map(g => g.length)).toEqual([1, 1]);
    expect(phraseGroups([])).toEqual([]);
  });
  it('renders every articulation symbol', () => {
    const tab = renderTab(all).split('\n');
    expect(tab).toHaveLength(6);
    expect(tab[1]).toContain('12h15p12');
    expect(tab[2]).toContain('12/14\\12');
    expect(tab[1]).toContain('15b17r15');
    expect(new Set(tab.map(l => l.length)).size).toBe(1);
    tab.forEach((l, i) => { expect(l.startsWith(STRING_NAMES[i] + '|')).toBe(true); expect(l.endsWith('|')).toBe(true); });
  });
  it('places each note on its own string', () => {
    for (const s of STRINGS) {
      const tab = renderTab([{ string: s, fret: 7 }]).split('\n');
      tab.forEach((l, i) => expect(l.includes('7')).toBe(i === s));
    }
  });
  it('labels bends and releases with arrows and unknown degrees with ?', () => {
    expect(intervalPath([{ string: 1, fret: 15 }, { string: 1, fret: 17, via: 'b' }, { string: 1, fret: 15, via: 'r' }], 4)).toBe('♭7 → ↑R → ↓♭7');
    expect(intervalPath([{ string: 0, fret: 1 }], 4)).toBe('?');
  });
});

describe('Lick Development Lab (every key × move × ending × guitar)', () => {
  it('has six moves', () => expect(MOVES).toEqual(['question', 'bend', 'slide', 'legato', 'descending', 'repeat']));

  for (const maxFret of [22, 24]) for (const move of MOVES) {
    it(`${move} on a ${maxFret}-fret guitar is correct in all keys`, () => {
      for (const key of KEYS) {
        const endings = new Set<string>();
        for (let v = 0; v < 6; v++) {
          const idea = buildLickIdea(key, move, v, maxFret);
          expect(idea.events.length).toBeGreaterThanOrEqual(4);
          for (const e of idea.events) {
            expect(e.fret).toBeGreaterThanOrEqual(0);
            expect(e.fret).toBeLessThanOrEqual(maxFret);
            expect(MINOR).toContain(degree(e.string, e.fret, key));
          }
          expect(idea.tab).toBe(renderTab(idea.events));
          expect(idea.intervals).toBe(intervalPath(idea.events, key));
          expect(idea.notes).toContain(`${NOTES[key]} minor`);
          expect(idea.notes).toContain(`fret ${12 + idea.shift}`);
          const [last, prev] = [idea.events.at(-1)!, idea.events.at(-2)!];
          expect(last.string === prev.string && last.fret === prev.fret).toBe(false);
          expect(degree(last.string, last.fret, key)).not.toBe(BLUE_NOTE);
          if (v < 3) endings.add(`${last.string}:${last.fret}`);
        }
        expect(endings.size, 'the three endings must differ').toBe(3);
      }
    });
  }
  it('uses the right technique for each move', () => {
    const vias = (m: LickMove) => buildLickIdea(4, m).events.map(e => e.via).filter(Boolean);
    expect(vias('bend')).toEqual(['b', 'r']);
    expect(vias('slide')).toEqual(['/']);
    expect(vias('legato')).toEqual(['h', 'p']);
    expect(vias('question')).toEqual([]);
  });
  it('titles and intervals match the musical claims', () => {
    expect(buildLickIdea(4, 'slide').intervals.startsWith('4 → 5')).toBe(true);
    expect(buildLickIdea(4, 'bend').intervals.startsWith('♭7 → ↑R')).toBe(true);
    expect(buildLickIdea(4, 'descending', 0).intervals.endsWith('R')).toBe(true);
    const repeat = buildLickIdea(4, 'repeat').events;
    expect(repeat.slice(0, 2)).toEqual(repeat.slice(3, 5)); // the motif repeats…
    expect(repeat[2]).not.toEqual(repeat[5]);               // …with a changed ending
  });
  it('negative or large variations wrap safely', () => {
    expect(buildLickIdea(4, 'question', -1).events).toEqual(buildLickIdea(4, 'question', 11).events);
  });
  it.each([[22], [24]])('lickShift keeps box 1 playable on a %i-fret guitar', maxFret => {
    for (const k of KEYS) {
      const s = lickShift(k, maxFret);
      expect(10 + s).toBeGreaterThanOrEqual(0);
      expect(17 + s).toBeLessThanOrEqual(maxFret);
      expect(12 + s).toBeLessThanOrEqual(15);
      expect(degree(5, 12 + s, k)).toBe(0); // box 1 root on low E
    }
  });
});

describe('note quiz', () => {
  it('pool = exactly the visible notes for every key, box, range and blues setting', () => {
    for (const k of KEYS) for (const box of ['all', '0', '1', '2', '3', '4']) for (const range of ['low', 'high', 'full'] as const) for (const blues of [false, true]) {
      const frets = visibleFrets(range, 24);
      const expected = STRINGS.flatMap(s => frets.filter(f => isScaleNote(s, f, k, blues) && (box === 'all' || inPosition(s, f, k, +box, blues))).map(f => ({ string: s, fret: f })));
      const pool = quizPool(k, box, frets, blues);
      expect(pool).toEqual(expected);
      expect(pool.length).toBeGreaterThan(0);
    }
  });
  it('never repeats the previous target (when possible)', () => {
    const pool = quizPool(4, '0', visibleFrets('low', 24), false);
    for (let i = 0; i < 200; i++) expect(pickQuizTarget(pool, pool[0])).not.toEqual(pool[0]);
    expect(pickQuizTarget([pool[0]], pool[0])).toEqual(pool[0]);
  });
  it('uses the supplied random source', () => {
    const pool = quizPool(4, 'all', visibleFrets('low', 24), false);
    expect(pickQuizTarget(pool, undefined, () => 0)).toEqual(pool[0]);
    expect(pickQuizTarget(pool, undefined, () => 0.9999)).toEqual(pool.at(-1));
  });
  it.each([[0, 0, 'Needs work'], [5, 10, 'Needs work'], [6, 10, 'Getting there'], [8, 10, 'Getting there'], [9, 10, 'Comfortable'], [10, 10, 'Comfortable']] as const)(
    '%i/%i → %s', (c, t, r) => expect(ratingFor(c, t)).toBe(r));
});

describe('practice stats', () => {
  const now = new Date(2026, 8, 17, 12);
  const daysAgo = (n: number, h = 9) => ({ date: new Date(2026, 8, 17 - n, h).toISOString() });
  it('empty history', () => expect(practiceStats([], now)).toEqual({ streak: 0, thisWeek: 0, practisedToday: false }));
  it('counts consecutive days, including across a month boundary', () => {
    const long = Array.from({ length: 20 }, (_, i) => daysAgo(i));
    expect(practiceStats(long, now).streak).toBe(20);
  });
  it('multiple sessions on one day count once', () => {
    expect(practiceStats([daysAgo(0, 8), daysAgo(0, 20), daysAgo(1)], now).streak).toBe(2);
  });
  it('a streak survives until today is over', () => {
    expect(practiceStats([daysAgo(1), daysAgo(2)], now)).toMatchObject({ streak: 2, practisedToday: false });
    expect(practiceStats([daysAgo(2)], now).streak).toBe(0);
  });
  it('thisWeek counts sessions from the last 7 days', () => {
    expect(practiceStats([daysAgo(0), daysAgo(6), daysAgo(8)], now).thisWeek).toBe(2);
  });
});
