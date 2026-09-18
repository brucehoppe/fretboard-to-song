import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteQuiz, QUIZ_LENGTH, type QuizState } from '@/components/app/note-quiz';
import { NOTES, noteAt, quizPool, visibleFrets } from '@/lib/music';
import { setup, type User } from '../helpers/ui';

const frets = visibleFrets('low', 24);
function renderQuiz(props: Partial<Parameters<typeof NoteQuiz>[0]> = {}) {
  const onTarget = vi.fn<(q: QuizState) => void>(), onPlay = vi.fn(), onLog = vi.fn(async () => {});
  const utils = render(<NoteQuiz root={4} box="all" frets={frets} blues={false} busy={false} onTarget={onTarget} onPlay={onPlay} onLog={onLog} {...props} />);
  const current = () => onTarget.mock.calls.filter(c => c[0]).at(-1)![0]!.target;
  const truth = () => NOTES[noteAt(current().string, current().fret)];
  return { ...utils, onTarget, onPlay, onLog, current, truth };
}
async function answer(user: User, q: ReturnType<typeof renderQuiz>, correct: boolean) {
  const right = q.truth();
  const name = correct ? right : NOTES.find(n => n !== right)!;
  await user.click(screen.getByRole('button', { name }));
}
async function next(user: User) { await user.click(screen.getByRole('button', { name: /Next note|See result/ })); }

beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.37); });

describe('NoteQuiz', () => {
  it('asks for a note that is in the visible pool and offers all 12 names', () => {
    const q = renderQuiz();
    expect(quizPool(4, 'all', frets, false)).toContainEqual(q.current());
    expect(screen.getByText(`Question 1 of ${QUIZ_LENGTH}`)).toBeInTheDocument();
    for (const n of NOTES) expect(screen.getByRole('button', { name: n })).toBeEnabled();
  });
  it('a correct answer is confirmed, revealed and played', async () => {
    const user = setup(); const q = renderQuiz();
    const target = q.current();
    await answer(user, q, true);
    expect(screen.getByText('Correct.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: q.truth() })).toHaveClass('correct');
    expect(q.onPlay).toHaveBeenCalledWith(target.string, target.fret);
    expect(q.onTarget).toHaveBeenLastCalledWith({ target, revealed: true });
    expect(screen.getByText('1 correct')).toBeInTheDocument();
    for (const n of NOTES) expect(screen.getByRole('button', { name: n })).toBeDisabled();
  });
  it('a wrong answer shows the right note', async () => {
    const user = setup(); const q = renderQuiz();
    const right = q.truth();
    await answer(user, q, false);
    expect(screen.getByText(`It's ${right}.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: right })).toHaveClass('correct');
    expect(document.querySelector('.quiz-answer.wrong')).not.toBeNull();
    expect(screen.getByText('0 correct')).toBeInTheDocument();
  });
  it('moves to a different note each question', async () => {
    const user = setup(); const q = renderQuiz();
    const first = q.current();
    await answer(user, q, true); await next(user);
    expect(q.current()).not.toEqual(first);
    expect(screen.getByText(`Question 2 of ${QUIZ_LENGTH}`)).toBeInTheDocument();
  });
  it.each([
    [10, 'Comfortable', /Solid/],
    [7, 'Getting there', /Good progress/],
    [2, 'Needs work', /Slow down/],
  ] as const)('%i/10 → %s summary, logs the result, then restarts', async (right, rating, text) => {
    const user = setup(); const q = renderQuiz({ box: '2' });
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      await answer(user, q, i < right);
      if (i === QUIZ_LENGTH - 1) expect(screen.getByRole('button', { name: 'See result' })).toBeInTheDocument();
      await next(user);
    }
    expect(screen.getByText(String(right))).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(q.onTarget).toHaveBeenLastCalledWith(null); // board clears when finished
    await user.click(screen.getByRole('button', { name: 'Log result' }));
    expect(q.onLog).toHaveBeenCalledWith(`Note quiz · ${right}/10 · box 3`, rating);
    expect(screen.getByRole('button', { name: 'Logged' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Another round' }));
    expect(screen.getByText(`Question 1 of ${QUIZ_LENGTH}`)).toBeInTheDocument();
    expect(screen.getByText('0 correct')).toBeInTheDocument();
  });
  it('omits the box from the log label for the whole neck', async () => {
    const user = setup(); const q = renderQuiz();
    for (let i = 0; i < QUIZ_LENGTH; i++) { await answer(user, q, true); await next(user); }
    await user.click(screen.getByRole('button', { name: 'Log result' }));
    expect(q.onLog).toHaveBeenCalledWith('Note quiz · 10/10', 'Comfortable');
  });
  it('disables logging while busy', async () => {
    const user = setup(); const q = renderQuiz({ busy: true });
    for (let i = 0; i < QUIZ_LENGTH; i++) { await answer(user, q, true); await next(user); }
    expect(screen.getByRole('button', { name: 'Log result' })).toBeDisabled();
  });
  it('explains when there are no notes to quiz', () => {
    render(<NoteQuiz root={4} box="all" frets={[]} blues={false} busy={false} onTarget={() => {}} onPlay={() => {}} onLog={async () => {}} />);
    expect(screen.getByText(/No notes in this view/)).toBeInTheDocument();
  });
  it('clears the board target when unmounted', () => {
    const q = renderQuiz();
    q.unmount();
    expect(q.onTarget).toHaveBeenLastCalledWith(null);
  });
  it('blues quizzes can ask for the blue note', () => {
    const pool = quizPool(4, 'all', frets, true);
    const blue = pool.findIndex(p => noteAt(p.string, p.fret) === 10);
    vi.spyOn(Math, 'random').mockReturnValue((blue + 0.5) / pool.length);
    const q = renderQuiz({ blues: true });
    expect(q.truth()).toBe('B♭');
  });
});
