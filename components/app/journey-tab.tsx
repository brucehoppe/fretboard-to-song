'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Flame, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Choice, keyItems } from '@/components/app/fields';
import { Fretboard } from '@/components/app/fretboard';
import { MetronomePanel } from '@/components/app/metronome-panel';
import { NoteQuiz, type QuizState } from '@/components/app/note-quiz';
import type { Audio, Metronome } from '@/hooks/use-audio';
import type { FretboardView } from '@/hooks/use-fretboard-view';
import { NOTES, practiceStats, scaleDegrees, scaleNotes, visibleFrets, DEGREES, type Rating, type Session } from '@/lib/music';

const EXERCISES = [
  { name: 'Find your home notes', time: '3 MIN', body: 'Find a root on each string. Say its name, then play it on your guitar. Hide the hints and repeat from memory.', goal: 'Six strings. Six confident root notes.' },
  { name: 'Connect two positions', time: '5 MIN', body: 'Use the two highlighted boxes. Play a four-note phrase in one, slide into the other, and finish on a root. Repeat without restarting at the bottom of the scale.', goal: 'A smooth shift that sounds like part of the phrase.' },
  { name: 'Travel on one string', time: '4 MIN', body: 'Follow the highlighted G string from low to high. Use slides to connect notes. Then make a short melody using only three of them.', goal: 'Hear a melody as you move along the neck.' },
  { name: 'Take it above twelve', time: '5 MIN', body: 'Play a short phrase below fret 12, then move every note up 12 frets. Switch the fret range to compare both versions. Keep the rhythm identical.', goal: 'The same phrase, one octave higher.' },
  { name: 'Make a musical sentence', time: '5 MIN', body: 'Create a two-bar question. Leave one bar of space. Answer with a changed rhythm and end on a root. Use two neighboring positions.', goal: 'One idea developed, with room to breathe.' },
  { name: 'Add the blue note', time: '4 MIN', body: 'Turn on the blue note. In one box, play ♭5 only as a passing note between 4 and 5 — never land on it. Then try bending the 4 up a half step to reach it.', goal: 'Grit on the way through, not a place to stop.' },
];

export function JourneyTab({ view, audio, metronome, sessions, onLog, loaded, busy }: {
  view: FretboardView; audio: Audio; metronome: Metronome; sessions: Session[];
  onLog: (exercise: string, key: number, rating: Rating) => Promise<void>; loaded: boolean; busy: boolean;
}) {
  const { root, setRoot, box, setBox, range, setRange, fretCount, setFretCount, blues, setBlues, intervals, setIntervals, connect, setConnect } = view;
  const [mode, setMode] = useState<'exercise' | 'quiz'>('exercise');
  const [exercise, setExercise] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [rating, setRating] = useState<Rating>('Getting there');
  const [sounding, setSounding] = useState('');
  const [quiz, setQuiz] = useState<QuizState>(null);
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frets = useMemo(() => visibleFrets(range, fretCount), [range, fretCount]);
  const stats = practiceStats(sessions);

  const play = useCallback((s: number, f: number) => {
    try {
      audio.playNote(s, f);
      setSounding(`${s}-${f}`);
      if (soundTimer.current) clearTimeout(soundTimer.current);
      soundTimer.current = setTimeout(() => setSounding(''), 450);
    } catch { toast.error('Audio is unavailable in this browser.'); }
  }, [audio]);

  function chooseExercise(i: number) {
    setExercise(i); setHidden(false);
    if (i === 0) { setBox('all'); setRange('low'); }
    if (i === 1 || i === 4) { setBox('0'); setConnect(true); }
    if (i === 2) { setBox('all'); setRange('full'); }
    if (i === 3) setRange('high');
    if (i === 5) { setBlues(true); setBox('0'); }
  }

  const ex = EXERCISES[exercise];
  const degrees = scaleDegrees(blues);
  return (
    <>
      <div className="page-title">
        <div><p className="eyebrow">EXPLORE · CONNECT · PLAY</p><h1>Make the whole neck yours.</h1></div>
        <span className="pill">{blues ? 'MINOR BLUES' : 'MINOR PENTATONIC'}</span>
      </div>
      <section className="panel fret-panel" aria-label="Interactive guitar fretboard">
        <div className="toolbar">
          <Choice label="Key" value={String(root)} onChange={v => setRoot(+v)} items={keyItems(NOTES)} />
          <Choice label="Position" value={box} onChange={setBox} items={[['all', 'All five boxes'], ...[0, 1, 2, 3, 4].map(i => [String(i), `Box ${i + 1}`] as [string, string])]} />
          <Choice label="Fret range" value={range} onChange={v => setRange(v as typeof range)} items={[['low', '0–12'], ['high', `12–${fretCount}`], ['full', `Whole neck · 0–${fretCount}`]]} />
          <Choice label="Your guitar" value={String(fretCount)} onChange={v => setFretCount(+v)} items={[['22', '22 frets'], ['24', '24 frets']]} />
          <div className="switches">
            <label><Switch checked={intervals} onCheckedChange={setIntervals} />Intervals</label>
            <label><Switch checked={blues} onCheckedChange={setBlues} />Blue note</label>
            <label><Switch checked={hidden} onCheckedChange={setHidden} disabled={mode === 'quiz'} />Hide hints</label>
            {box !== 'all' && <label><Switch checked={connect} onCheckedChange={setConnect} />Next box</label>}
          </div>
        </div>
        <div className="board-caption">
          <span><b>{NOTES[root]} minor{blues ? ' blues' : ''}</b> · {scaleNotes(root, blues).map((n, i) => `${n} (${DEGREES[degrees[i]]})`).join('  ·  ')}</span>
          <span>{mode === 'quiz' && quiz ? 'Name the ? note below' : 'Tap a note to hear it'}</span>
        </div>
        <Fretboard root={root} box={box} frets={frets} blues={blues} intervals={intervals} hidden={hidden} connect={connect}
          pathString={mode === 'exercise' && exercise === 2 ? 2 : undefined} sounding={sounding} onPlay={play} quiz={mode === 'quiz' ? quiz : null} />
        <div className="board-footer">
          <div className="legend">
            <span><i className="root-dot" />Root / home</span><span><i />Scale note</span>
            {blues && <span><i className="blue-dot" />Blue note (♭5)</span>}
            {box !== 'all' && connect && <span><i className="next-dot" />Next box</span>}
          </div>
          <span>Standard tuning · high e at top</span>
        </div>
      </section>

      <div className="practice-layout">
        <section className="panel challenge">
          <div className="mode-switch" role="tablist" aria-label="Practice mode">
            <button role="tab" aria-selected={mode === 'exercise'} className={mode === 'exercise' ? 'on' : ''} onClick={() => setMode('exercise')}>Guided exercise</button>
            <button role="tab" aria-selected={mode === 'quiz'} className={mode === 'quiz' ? 'on' : ''} onClick={() => setMode('quiz')}>Note quiz</button>
          </div>
          {mode === 'exercise' ? (
            <>
              <div className="section-heading"><span className="eyebrow">TODAY’S FOCUS</span><span className="time">{ex.time}</span></div>
              <Choice label="Choose an exercise" value={String(exercise)} onChange={v => chooseExercise(+v)} items={EXERCISES.map((x, i) => [String(i), `${i + 1}. ${x.name}`])} />
              <h2>{ex.name}</h2><p>{ex.body}</p>
              <div className="goal"><Target size={19} /><span>{ex.goal}</span></div>
              <div className="exercise-actions">
                <Choice label="How did it feel?" value={rating} onChange={v => setRating(v as Rating)} items={(['Needs work', 'Getting there', 'Comfortable'] as const).map(s => [s, s])} />
                <Button disabled={busy || !loaded} onClick={() => onLog(ex.name, root, rating)}><Check />Log practice</Button>
                <Button variant="ghost" onClick={() => chooseExercise((exercise + 1) % EXERCISES.length)} aria-label="Next exercise"><ArrowRight /></Button>
              </div>
              <small>Play on your guitar, then assess yourself honestly. For a scored check, switch to Note quiz.</small>
            </>
          ) : (
            <NoteQuiz key={`${root}-${box}-${range}-${fretCount}-${blues}`} root={root} box={box} frets={frets} blues={blues} onTarget={setQuiz} onPlay={play} busy={busy || !loaded}
              onLog={(label, r) => onLog(label, root, r)} />
          )}
        </section>
        <div className="right-column">
          <MetronomePanel m={metronome} />
          <section className="panel recent">
            <div className="stats">
              <div><Flame size={18} /><b>{stats.streak}</b><small>day streak</small></div>
              <div><b>{stats.thisWeek}</b><small>sessions this week</small></div>
            </div>
            <h2>Recent practice</h2>
            {!stats.practisedToday && sessions.length > 0 && <p className="nudge">Nothing logged today yet — five minutes keeps the streak alive.</p>}
            {sessions.length === 0 ? <p>Your first logged exercise will appear here.</p> : sessions.slice(0, 4).map(h => (
              <div className="history-row" key={h.id}>
                <span>{h.exercise}<small>{NOTES[h.key]} minor · {new Date(h.date).toLocaleDateString()}</small></span>
                <span className="rating">{h.rating}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
