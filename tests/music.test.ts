import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTES, TUNING, MINOR, degree, inBox, blueNoteInBox, isScaleNote, buildLickIdea, LICK_MOVES,
  renderTab, intervalPath, practiceStats, quizPool, pickQuizTarget, ratingFor, lickShift, type LickMove,
} from '../lib/music.ts';

test('every minor pentatonic note on frets 0–24 belongs to at least one box, in all 12 keys', () => {
  for (let root = 0; root < 12; root++) for (let s = 0; s < 6; s++) for (let f = 0; f <= 24; f++) {
    const inScale = MINOR.includes(degree(s, f, root));
    const boxes = [0, 1, 2, 3, 4].filter(b => inBox(s, f, root, b));
    if (inScale) assert.ok(boxes.length >= 1, `${NOTES[root]}m string ${s} fret ${f}`);
    else assert.equal(boxes.length, 0, `non-scale note marked in box: ${NOTES[root]}m s${s} f${f}`);
  }
});

test('E minor box 1 is the familiar open shape', () => {
  const box1 = [0, 1, 2, 3, 4, 5].map(s => [0, 1, 2, 3].filter(f => inBox(s, f, 4, 0)));
  assert.deepEqual(box1, [[0, 3], [0, 3], [0, 2], [0, 2], [0, 2], [0, 3]]);
});

test('blue note appears in the classic box 1 spots (A string fret 1, G string fret 3 in E)', () => {
  assert.ok(blueNoteInBox(4, 1, 4, 0));
  assert.ok(blueNoteInBox(2, 3, 4, 0));
  assert.ok(!blueNoteInBox(5, 6, 4, 0));
  assert.ok(isScaleNote(4, 1, 4, true) && !isScaleNote(4, 1, 4, false));
});

test('lick ideas stay on the neck and their labels match their notes in every key', () => {
  for (const maxFret of [22, 24]) for (let key = 0; key < 12; key++) for (const [move] of LICK_MOVES) for (let v = 0; v < 4; v++) {
    const idea = buildLickIdea(key, move as LickMove, v, maxFret);
    for (const e of idea.events) {
      assert.ok(e.fret >= 0 && e.fret <= maxFret, `${move} key ${key} fret ${e.fret}`);
      assert.ok(MINOR.includes(degree(e.string, e.fret, key)), `${move} plays a non-scale note`);
    }
    assert.equal(idea.intervals, intervalPath(idea.events, key));
    const last = idea.events.at(-1)!, prev = idea.events.at(-2)!;
    assert.ok(!(last.string === prev.string && last.fret === prev.fret), 'ending repeats the previous note');
  }
});

test('changing the variation changes the notes, not just the text', () => {
  const a = buildLickIdea(4, 'question', 0), b = buildLickIdea(4, 'question', 1);
  assert.notDeepEqual(a.events, b.events);
});

test('renderTab groups legato notes into one column', () => {
  const tab = renderTab([{ string: 1, fret: 12 }, { string: 1, fret: 15, via: 'h' }, { string: 1, fret: 12, via: 'p' }]);
  assert.match(tab.split('\n')[1], /12h15p12/);
  assert.equal(new Set(tab.split('\n').map(l => l.length)).size, 1, 'all tab lines same length');
});

test('bend lick is labelled ♭7 bent up to the root', () => {
  assert.match(buildLickIdea(4, 'bend', 0).intervals, /^♭7 → ↑R → ↓♭7/);
});

test('lickShift keeps E at 12 on a 24-fret guitar', () => {
  assert.equal(lickShift(4, 24), 0);
  assert.ok(lickShift(11, 22) < 0);
});

test('practice streak counts consecutive days and tolerates today not yet logged', () => {
  const now = new Date(2026, 8, 17, 12);
  const day = (n: number) => ({ date: new Date(2026, 8, 17 - n, 9).toISOString() });
  assert.equal(practiceStats([day(0), day(1), day(2)], now).streak, 3);
  assert.equal(practiceStats([day(1), day(2)], now).streak, 2);
  assert.equal(practiceStats([day(2)], now).streak, 0);
  assert.equal(practiceStats([day(0), day(3), day(9)], now).thisWeek, 2);
});

test('quiz pool respects box filter and never repeats the previous target', () => {
  const frets = Array.from({ length: 13 }, (_, i) => i);
  const all = quizPool(4, 'all', frets, false), box = quizPool(4, '0', frets, false);
  assert.ok(box.length > 0 && box.length < all.length);
  const prev = box[0];
  for (let i = 0; i < 50; i++) assert.notDeepEqual(pickQuizTarget(box, prev), prev);
  assert.equal(ratingFor(9, 10), 'Comfortable');
  assert.equal(ratingFor(5, 10), 'Needs work');
  assert.equal(TUNING.length, 6);
});
