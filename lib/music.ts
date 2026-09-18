/**
 * Music theory core for Fretboard to Song.
 * Pure functions only — no React, no DOM — so they can be unit-tested with `pnpm test`.
 */

export const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** MIDI pitches of the open strings, index 0 = high e (top row of the fretboard). */
export const TUNING = [64, 59, 55, 50, 45, 40];
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
export const MINOR = [0, 3, 5, 7, 10];
export const BLUE_NOTE = 6;
export const DEGREES: Record<number, string> = { 0: 'R', 3: '♭3', 5: '4', 6: '♭5', 7: '5', 10: '♭7' };
export const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

/**
 * E minor pentatonic box shapes as [lowest, highest] fret per string,
 * listed from low E (index 0) to high e (index 5). Transposed by `root` at runtime.
 */
const SHAPES = [
  [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const boxOffset = (root: number) => mod12(root - 4);

export function midiAt(string: number, fret: number) { return TUNING[string] + fret; }
export function noteAt(string: number, fret: number) { return mod12(TUNING[string] + fret); }
export function degree(string: number, fret: number, root: number) { return mod12(TUNING[string] + fret - root); }
export function scaleDegrees(blues: boolean) { return blues ? [...MINOR, BLUE_NOTE].sort((a, b) => a - b) : MINOR; }
export function scaleNotes(root: number, blues = false) { return scaleDegrees(blues).map(d => NOTES[mod12(d + root)]); }

/** True when a minor-pentatonic note at (string, fret) belongs to `box` (0–4) in `root`. */
export function inBox(string: number, fret: number, root: number, box: number) {
  const offset = boxOffset(root);
  return SHAPES[box][5 - string].some(n => mod12(fret - offset - n) === 0);
}

/**
 * The blue note (♭5) belongs to a box when it sits inside that string's span
 * or one fret above it — the conventional one-finger reach in each shape.
 */
export function blueNoteInBox(string: number, fret: number, root: number, box: number) {
  if (degree(string, fret, root) !== BLUE_NOTE) return false;
  const [lo, hi] = SHAPES[box][5 - string];
  const rel = fret - boxOffset(root);
  for (let octave = -24; octave <= 24; octave += 12) {
    if (rel - octave >= lo && rel - octave <= hi + 1) return true;
  }
  return false;
}

export function inPosition(string: number, fret: number, root: number, box: number, blues: boolean) {
  const d = degree(string, fret, root);
  if (MINOR.includes(d)) return inBox(string, fret, root, box);
  return blues && blueNoteInBox(string, fret, root, box);
}

export function isScaleNote(string: number, fret: number, root: number, blues: boolean) {
  return scaleDegrees(blues).includes(degree(string, fret, root));
}

export type FretRange = 'low' | 'high' | 'full';
export function visibleFrets(range: FretRange, fretCount: number) {
  if (range === 'high') return Array.from({ length: fretCount - 11 }, (_, i) => i + 12);
  if (range === 'full') return Array.from({ length: fretCount + 1 }, (_, i) => i);
  return Array.from({ length: 13 }, (_, i) => i);
}
export function rangeFor(frets: number[]): FretRange {
  if (frets.every(f => f <= 12)) return 'low';
  if (frets.every(f => f >= 12)) return 'high';
  return 'full';
}

/* ------------------------------------------------------------------ */
/* Persisted record types (shared by client and API validation)        */
/* ------------------------------------------------------------------ */

export type SectionStatus = 'New' | 'Learning' | 'Steady';
export type Section = { id: string; name: string; bpm: number; status: SectionStatus; transition: boolean };
export type Song = { id: string; title: string; artist: string; key: number; target: number; sections: Section[]; notes: string; runs: number; lastRun: string; revision: number };
export type Rating = 'Needs work' | 'Getting there' | 'Comfortable';
export type Session = { id: string; exercise: string; key: number; rating: Rating; date: string };
export type LickStatus = 'Idea' | 'Practising' | 'Learned';
export type Lick = { id: string; title: string; key: number; box: string; technique: string; tab: string; notes: string; status: LickStatus; songId: string; revision: number };

export function sectionReady(song: Song, index: number) {
  const s = song.sections[index];
  return s.status === 'Steady' && s.bpm >= song.target && (index === 0 || s.transition);
}

/* ------------------------------------------------------------------ */
/* Phrases: one source of truth for tab text, interval labels, audio   */
/* ------------------------------------------------------------------ */

/** How a note is reached from the previous note on the same string. */
export type Articulation = 'h' | 'p' | '/' | '\\' | 'b' | 'r';
export type PhraseNote = { string: number; fret: number; via?: Articulation; beats?: number };

const CONNECTED: Articulation[] = ['h', 'p', '/', '\\', 'b', 'r'];

/** Groups notes that are played in one pick stroke (legato, slides, bends). */
export function phraseGroups(notes: PhraseNote[]) {
  const groups: PhraseNote[][] = [];
  notes.forEach((n, i) => {
    const prev = notes[i - 1];
    if (prev && n.via && CONNECTED.includes(n.via) && prev.string === n.string) groups[groups.length - 1].push(n);
    else groups.push([n]);
  });
  return groups;
}

/** Renders standard six-line ASCII tab. The tab can never disagree with the audio. */
export function renderTab(notes: PhraseNote[]) {
  const lines = STRING_NAMES.map(n => `${n}|-`);
  for (const group of phraseGroups(notes)) {
    const text = group.map((n, i) => (i > 0 && n.via ? n.via : '') + n.fret).join('');
    const width = text.length + 2;
    lines.forEach((_, s) => {
      lines[s] += s === group[0].string ? text + '--' : '-'.repeat(width);
    });
  }
  return lines.map(l => l + '|').join('\n');
}

export function intervalPath(notes: PhraseNote[], root: number) {
  return notes.map(n => {
    const d = DEGREES[degree(n.string, n.fret, root)] ?? '?';
    return n.via === 'b' ? `↑${d}` : n.via === 'r' ? `↓${d}` : d;
  }).join(' → ');
}

/* ------------------------------------------------------------------ */
/* Lick Development Lab                                                */
/* ------------------------------------------------------------------ */

export type LickMove = 'question' | 'bend' | 'slide' | 'legato' | 'descending' | 'repeat';
export type LickIdea = {
  title: string; technique: string; purpose: string; steps: string[];
  intervals: string; tab: string; notes: string; events: PhraseNote[];
  development: string; endingLabel: string; shift: number;
};

export const LICK_MOVES: [LickMove, string][] = [
  ['question', 'Ask, then answer'], ['bend', 'Bend into home'], ['slide', 'Slide into the fifth'],
  ['legato', 'Hammer-on / pull-off'], ['descending', 'Descend and resolve'], ['repeat', 'Repeat one idea'],
];

type MoveTemplate = { title: string; technique: string; purpose: string; steps: string[]; body: PhraseNote[] };

/** Written in E minor, box 1 at fret 12. `shift` transposes to any key. */
const MOVES: Record<LickMove, MoveTemplate> = {
  question: {
    title: 'Ask, then answer', technique: 'Short phrase · space · response',
    purpose: 'A lick feels intentional when the second phrase answers the first instead of just adding more notes.',
    steps: ['Play the first two notes as a question.', 'Rest for one beat.', 'Answer lower, then land on the ending note.'],
    body: [{ string: 1, fret: 12 }, { string: 1, fret: 15, beats: 1.5 }, { string: 2, fret: 14 }, { string: 2, fret: 12 }],
  },
  bend: {
    title: 'Bend into home', technique: 'Whole-step bend · release · resolve',
    purpose: 'The bend creates tension by pushing ♭7 up to the root; the release and landing give it a clear destination.',
    steps: ['Bend the ♭7 up one whole step — check the pitch against the root.', 'Release it slowly back to ♭7.', 'Land on the ending note without rushing.'],
    body: [{ string: 1, fret: 15 }, { string: 1, fret: 17, via: 'b', beats: 1 }, { string: 1, fret: 15, via: 'r' }],
  },
  slide: {
    title: 'Slide into the fifth', technique: 'Slide · hold · answer',
    purpose: 'A slide makes the destination note sound chosen; the answer then gives it direction.',
    steps: ['Slide from the 4th up into the 5th on the B string.', 'Let the 5th ring for a full beat.', 'Answer with the ♭3, then land on the ending note.'],
    body: [{ string: 1, fret: 10, beats: 0.25 }, { string: 1, fret: 12, via: '/', beats: 1.25 }, { string: 2, fret: 12 }],
  },
  legato: {
    title: 'Legato answer', technique: 'Hammer-on · pull-off · resolve',
    purpose: 'Hammer-ons and pull-offs create a vocal, connected line when the picked note still has a clear destination.',
    steps: ['Pick the first note firmly.', 'Hammer on, then pull off without speeding up.', 'Move to the ending note and let it ring.'],
    body: [{ string: 1, fret: 12 }, { string: 1, fret: 15, via: 'h' }, { string: 1, fret: 12, via: 'p' }, { string: 2, fret: 14 }],
  },
  descending: {
    title: 'Descend and resolve', technique: 'Descending sequence',
    purpose: 'Descending pentatonic lines become musical when they know where to stop.',
    steps: ['Play the notes evenly.', 'Do not speed up as you descend.', 'Hold the final note for a full beat.'],
    body: [{ string: 0, fret: 15 }, { string: 0, fret: 12 }, { string: 1, fret: 15 }, { string: 1, fret: 12 }, { string: 2, fret: 14 }, { string: 2, fret: 12 }],
  },
  repeat: {
    title: 'Repeat one idea', technique: 'Motif · changed ending',
    purpose: 'A good lick can come from three notes if you repeat them and change only the ending.',
    steps: ['Play the three-note motif.', 'Play it again — the ending note is the only thing that changes.', 'Hold the last note.'],
    body: [{ string: 1, fret: 12 }, { string: 1, fret: 15 }, { string: 0, fret: 15, beats: 1 }, { string: 1, fret: 12 }, { string: 1, fret: 15 }],
  },
};

/** Endings are real note changes, not just advice. */
const ENDINGS: { note: PhraseNote; label: string; development: string }[] = [
  { note: { string: 0, fret: 12, beats: 2 }, label: 'Resolve high on the root', development: 'Now leave the last beat empty and listen to the silence before you repeat it.' },
  { note: { string: 3, fret: 14, beats: 2 }, label: 'Resolve low on the root', development: 'Same note name, one octave lower. Notice how much darker and more final it sounds.' },
  { note: { string: 2, fret: 12, beats: 2 }, label: 'Leave it hanging on ♭3', development: 'Ending on ♭3 sounds like a question. Play it, then answer it with ending 1.' },
  { note: { string: 1, fret: 12, beats: 2 }, label: 'Rest on the 5th', development: 'The 5th is stable but not home. Try it over a backing chord and hear it float.' },
];

function sameNote(a: PhraseNote, b: PhraseNote) { return a.string === b.string && a.fret === b.fret; }

export function lickShift(key: number, maxFret = 24) {
  let shift = mod12(key - 4);
  // Box 1 sits at fret 12–15 for E–G; above that, drop an octave (A minor → fret 5).
  if (12 + shift > 15 && 10 + shift - 12 >= 0) shift -= 12;
  while (17 + shift > maxFret) shift -= 12; // keep the highest bend inside the neck
  return shift;
}

export function buildLickIdea(key: number, move: LickMove, variation = 0, maxFret = 24): LickIdea {
  const shift = lickShift(key, maxFret);
  const t = MOVES[move];
  const last = t.body[t.body.length - 1];
  const endings = ENDINGS.filter(e => !sameNote(e.note, last));
  const ending = endings[mod12(variation) % endings.length];
  const events = [...t.body, ending.note].map(n => ({ ...n, fret: n.fret + shift }));
  const where = `${NOTES[key]} minor, box 1 around fret ${12 + shift}`;
  return {
    title: t.title, technique: t.technique, purpose: t.purpose, steps: t.steps, events, shift,
    intervals: intervalPath(events, key), tab: renderTab(events),
    endingLabel: ending.label, development: ending.development,
    notes: `Play this in ${where}. Ending: ${ending.label.toLowerCase()}. ${ending.development}`,
  };
}

/* ------------------------------------------------------------------ */
/* Note quiz                                                           */
/* ------------------------------------------------------------------ */

export type QuizTarget = { string: number; fret: number };
export function quizPool(root: number, box: string, frets: number[], blues: boolean): QuizTarget[] {
  const pool: QuizTarget[] = [];
  TUNING.forEach((_, s) => frets.forEach(f => {
    if (!isScaleNote(s, f, root, blues)) return;
    if (box !== 'all' && !inPosition(s, f, root, +box, blues)) return;
    pool.push({ string: s, fret: f });
  }));
  return pool;
}
export function pickQuizTarget(pool: QuizTarget[], previous?: QuizTarget, random = Math.random) {
  const options = pool.length > 1 && previous ? pool.filter(p => !sameNote(p, previous)) : pool;
  return options[Math.floor(random() * options.length)];
}
export function ratingFor(correct: number, total: number): Rating {
  const pct = total ? correct / total : 0;
  return pct >= 0.9 ? 'Comfortable' : pct >= 0.6 ? 'Getting there' : 'Needs work';
}

/* ------------------------------------------------------------------ */
/* Practice stats                                                      */
/* ------------------------------------------------------------------ */

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
export function practiceStats(sessions: Pick<Session, 'date'>[], now = new Date()) {
  const days = new Set(sessions.map(s => dayKey(new Date(s.date))));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // today not logged yet: streak can still be alive
  let streak = 0;
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const weekAgo = now.getTime() - 7 * 864e5;
  const thisWeek = sessions.filter(s => new Date(s.date).getTime() >= weekAgo).length;
  return { streak, thisWeek, practisedToday: days.has(dayKey(now)) };
}
