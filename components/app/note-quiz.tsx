'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NOTES, noteAt, pickQuizTarget, quizPool, ratingFor, type QuizTarget, type Rating } from '@/lib/music';

export const QUIZ_LENGTH = 10;

export type QuizState = { target: QuizTarget; revealed: boolean } | null;

/**
 * Mount with a `key` that changes with key/box/range so a new view starts a new quiz.
 * Active recall: the fretboard shows a "?" and you name the note.
 * Unlike the self-assessed exercises, this is scored.
 */
export function NoteQuiz({ root, box, frets, blues, onTarget, onPlay, onLog, busy }: {
  root: number; box: string; frets: number[]; blues: boolean;
  onTarget: (q: QuizState) => void; onPlay: (s: number, f: number) => void;
  onLog: (label: string, rating: Rating) => Promise<void>; busy: boolean;
}) {
  const pool = useMemo(() => quizPool(root, box, frets, blues), [root, box, frets, blues]);
  const [target, setTarget] = useState<QuizTarget | null>(() => pool.length ? pickQuizTarget(pool) : null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [logged, setLogged] = useState(false);
  const [finished, setFinished] = useState(false);

  function restart() {
    setScore({ correct: 0, total: 0 }); setAnswer(null); setLogged(false); setFinished(false);
    setTarget(pool.length ? pickQuizTarget(pool) : null);
  }
  useEffect(() => { onTarget(target && !finished ? { target, revealed: answer !== null } : null); }, [target, answer, finished, onTarget]);
  useEffect(() => () => onTarget(null), [onTarget]);

  if (!target) return <p>No notes in this view. Choose a different position or fret range.</p>;
  const truth = noteAt(target.string, target.fret);

  function choose(n: number) {
    if (answer !== null || !target) return;
    setAnswer(n);
    setScore(s => ({ correct: s.correct + (n === truth ? 1 : 0), total: s.total + 1 }));
    onPlay(target.string, target.fret);
  }
  function next() {
    setAnswer(null);
    if (score.total >= QUIZ_LENGTH) setFinished(true);
    else setTarget(pickQuizTarget(pool, target ?? undefined));
  }
  async function log() {
    await onLog(`Note quiz · ${score.correct}/${score.total}${box === 'all' ? '' : ` · box ${+box + 1}`}`, ratingFor(score.correct, score.total));
    setLogged(true);
  }

  if (finished) {
    const rating = ratingFor(score.correct, score.total);
    return (
      <div className="quiz-summary" role="status">
        <p className="quiz-score"><b>{score.correct}</b> / {score.total}</p>
        <p>{rating === 'Comfortable' ? 'Solid. Try hiding hints in a new position, or switch to the whole neck.' : rating === 'Getting there' ? 'Good progress. Run it again in the same box before moving on.' : 'Slow down: say each note aloud from the nearest root, then try again.'}</p>
        <div className="exercise-actions">
          <Button onClick={log} disabled={busy || logged}><Check />{logged ? 'Logged' : 'Log result'}</Button>
          <Button variant="outline" onClick={restart}><RotateCcw />Another round</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="progress-label"><span>Question {score.total + (answer === null ? 1 : 0)} of {QUIZ_LENGTH}</span><span>{score.correct} correct</span></div>
      <Progress value={(score.total / QUIZ_LENGTH) * 100} />
      <p className="quiz-prompt">Name the note marked <b>?</b> on the fretboard.</p>
      <div className="quiz-answers" role="group" aria-label="Choose the note name">
        {NOTES.map((n, i) => (
          <button key={n} type="button" onClick={() => choose(i)} disabled={answer !== null}
            className={'quiz-answer' + (answer !== null && i === truth ? ' correct' : '') + (answer === i && i !== truth ? ' wrong' : '')}>{n}</button>
        ))}
      </div>
      {answer !== null && (
        <div className="quiz-feedback" role="status">
          <span>{answer === truth ? 'Correct.' : `It's ${NOTES[truth]}.`}</span>
          <Button onClick={next} autoFocus>{score.total >= QUIZ_LENGTH ? 'See result' : 'Next note'}</Button>
        </div>
      )}
    </div>
  );
}
