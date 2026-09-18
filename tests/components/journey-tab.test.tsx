import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyTab } from '@/components/app/journey-tab';
import { useAudio, useMetronome } from '@/hooks/use-audio';
import { useFretboardView } from '@/hooks/use-fretboard-view';
import { NOTES, STRING_NAMES, TUNING, type Session } from '@/lib/music';
import { audio, hz, near } from '../helpers/fake-audio';
import { choose, optionsOf, selected, setup } from '../helpers/ui';

function Harness({ sessions = [], onLog = vi.fn(async () => {}), loaded = true, busy = false }: { sessions?: Session[]; onLog?: any; loaded?: boolean; busy?: boolean }) {
  const view = useFretboardView(); const a = useAudio(); const m = useMetronome(a);
  return <JourneyTab view={view} audio={a} metronome={m} sessions={sessions} onLog={onLog} loaded={loaded} busy={busy} />;
}
const board = () => screen.getByRole('region', { name: 'Interactive guitar fretboard' });
const caption = () => document.querySelector('.board-caption')!.textContent!;
const fretNumbers = () => [...board().querySelectorAll('.fret-number')].map(e => +e.textContent!);
const noteButtons = () => within(board()).queryAllByRole('button').filter(b => b.classList.contains('note'));
const toggle = (name: string) => screen.getByRole('switch', { name });

describe('Journey toolbar — every option', () => {
  it('Key: all 12 options update the caption and are remembered', async () => {
    const user = setup(); render(<Harness />);
    expect(await optionsOf(user, 'Key', board())).toHaveLength(12);
    for (const n of NOTES) {
      await choose(user, 'Key', `${n} minor`, board());
      expect(caption()).toContain(`${n} minor`);
    }
    expect(localStorage.getItem('fts:root')).toBe('11');
  });
  it('Position: all six options; "Next box" only appears for a single box', async () => {
    const user = setup(); render(<Harness />);
    expect(await optionsOf(user, 'Position', board())).toEqual(['All five boxes', 'Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5']);
    const all = noteButtons().length;
    expect(screen.queryByRole('switch', { name: 'Next box' })).toBeNull();
    for (const b of ['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5']) {
      await choose(user, 'Position', b, board());
      expect(noteButtons().length).toBeLessThan(all);
      expect(toggle('Next box')).toBeInTheDocument();
    }
    await choose(user, 'Position', 'All five boxes', board());
    expect(noteButtons()).toHaveLength(all);
  });
  it('Fret range × guitar: every combination shows the right frets', async () => {
    const user = setup(); render(<Harness />);
    for (const guitar of ['22', '24']) {
      await choose(user, 'Your guitar', `${guitar} frets`, board());
      const n = +guitar;
      expect(await optionsOf(user, 'Fret range', board())).toEqual(['0–12', `12–${n}`, `Whole neck · 0–${n}`]);
      await choose(user, 'Fret range', '0–12', board()); expect(fretNumbers()).toEqual([...Array(13).keys()]);
      await choose(user, 'Fret range', `12–${n}`, board()); expect(fretNumbers()[0]).toBe(12); expect(fretNumbers().at(-1)).toBe(n);
      await choose(user, 'Fret range', `Whole neck · 0–${n}`, board()); expect(fretNumbers()).toHaveLength(n + 1);
    }
  });
  it('Intervals switch toggles note names ↔ intervals', async () => {
    const user = setup(); render(<Harness />);
    const text = () => noteButtons().map(b => b.textContent).join(' ');
    expect(text()).toMatch(/\bE\b/);
    await user.click(toggle('Intervals'));
    expect(text()).toMatch(/R/); expect(text()).not.toMatch(/\bE\b/);
    await user.click(toggle('Intervals'));
    expect(text()).toMatch(/\bE\b/);
  });
  it('Blue note switch adds ♭5 to the board, caption, pill and legend', async () => {
    const user = setup(); render(<Harness />);
    expect(document.querySelectorAll('.note.blue')).toHaveLength(0);
    await user.click(toggle('Blue note'));
    expect(document.querySelectorAll('.note.blue').length).toBeGreaterThan(0);
    expect(caption()).toContain('minor blues'); expect(caption()).toContain('B♭ (♭5)');
    expect(screen.getByText('MINOR BLUES')).toBeInTheDocument();
    expect(screen.getByText('Blue note (♭5)')).toBeInTheDocument();
  });
  it('Hide hints hides every note name', async () => {
    const user = setup(); render(<Harness />);
    await user.click(toggle('Hide hints'));
    for (const b of noteButtons()) expect(b).toHaveTextContent('·');
  });
  it('Next box switch shows/hides neighbouring notes', async () => {
    const user = setup(); render(<Harness />);
    await choose(user, 'Position', 'Box 1', board());
    const withNext = noteButtons().length;
    expect(document.querySelectorAll('.note.neighbor').length).toBeGreaterThan(0);
    await user.click(toggle('Next box'));
    expect(noteButtons().length).toBeLessThan(withNext);
    expect(document.querySelectorAll('.note.neighbor')).toHaveLength(0);
  });
  it('tapping a note plays its pitch and highlights it briefly', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = setup(); render(<Harness />);
    const low = within(board()).getByRole('button', { name: /String E, fret 0,/ });
    await user.click(low);
    expect(near(audio().tones.at(-1)!.freqs[0], hz(TUNING[5]))).toBe(true);
    expect(low).toHaveClass('sounding');
    act(() => { vi.advanceTimersByTime(500); });
    expect(low).not.toHaveClass('sounding');
    vi.useRealTimers();
  });
  it('restores remembered settings on the next visit', async () => {
    const user = setup();
    const { unmount } = render(<Harness />);
    await choose(user, 'Key', 'A minor', board());
    await choose(user, 'Position', 'Box 3', board());
    await user.click(toggle('Blue note'));
    unmount(); render(<Harness />);
    expect(selected('Key', board())).toBe('A minor');
    expect(selected('Position', board())).toBe('Box 3');
    expect(toggle('Blue note')).toBeChecked();
  });
  it('ignores corrupt remembered settings', () => {
    localStorage.setItem('fts:root', '99'); localStorage.setItem('fts:box', '"7"'); localStorage.setItem('fts:frets', '{bad');
    render(<Harness />);
    expect(selected('Key', board())).toBe('E minor');
    expect(selected('Position', board())).toBe('All five boxes');
    expect(selected('Your guitar', board())).toBe('24 frets');
  });
});

describe('Guided exercises — every exercise and rating', () => {
  const expectations: [string, () => void][] = [
    ['Find your home notes', () => { expect(selected('Position', board())).toBe('All five boxes'); expect(selected('Fret range', board())).toBe('0–12'); }],
    ['Connect two positions', () => { expect(selected('Position', board())).toBe('Box 1'); expect(toggle('Next box')).toBeChecked(); }],
    ['Travel on one string', () => {
      expect(selected('Fret range', board())).toMatch(/Whole neck/);
      const path = [...document.querySelectorAll('.note.path-note')].map(b => b.getAttribute('aria-label')!);
      expect(path.length).toBeGreaterThan(0);
      for (const l of path) expect(l).toMatch(/^String G,/);
    }],
    ['Take it above twelve', () => expect(selected('Fret range', board())).toBe('12–24')],
    ['Make a musical sentence', () => { expect(selected('Position', board())).toBe('Box 1'); expect(toggle('Next box')).toBeChecked(); }],
    ['Add the blue note', () => { expect(toggle('Blue note')).toBeChecked(); expect(selected('Position', board())).toBe('Box 1'); }],
  ];
  it.each(expectations.map((e, i) => [i + 1, ...e] as const))('%i. %s sets up the board', async (i, name, check) => {
    const user = setup(); render(<Harness />);
    await choose(user, 'Choose an exercise', `${i}. ${name}`);
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    check();
  });
  it.each(['Needs work', 'Getting there', 'Comfortable'])('logs with rating "%s"', async rating => {
    const user = setup(); const onLog = vi.fn(async () => {});
    render(<Harness onLog={onLog} />);
    await choose(user, 'Key', 'G minor', board());
    await choose(user, 'How did it feel?', rating);
    await user.click(screen.getByRole('button', { name: 'Log practice' }));
    expect(onLog).toHaveBeenCalledWith('Find your home notes', 7, rating);
  });
  it('the next arrow cycles through all six and wraps', async () => {
    const user = setup(); render(<Harness />);
    const names = expectations.map(e => e[0]);
    for (let i = 1; i <= 6; i++) {
      await user.click(screen.getByRole('button', { name: 'Next exercise' }));
      expect(screen.getByRole('heading', { name: names[i % 6] })).toBeInTheDocument();
    }
  });
  it('log is disabled until data has loaded, and while saving', () => {
    const { rerender } = render(<Harness loaded={false} />);
    expect(screen.getByRole('button', { name: 'Log practice' })).toBeDisabled();
    rerender(<Harness busy />);
    expect(screen.getByRole('button', { name: 'Log practice' })).toBeDisabled();
  });
});

describe('Practice modes', () => {
  it('switches to the quiz and back', async () => {
    const user = setup(); render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Note quiz' }));
    expect(screen.getByRole('tab', { name: 'Note quiz' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('.quiz-target')).toHaveLength(1);
    expect(caption()).toContain('Name the ? note');
    expect(toggle('Hide hints')).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Guided exercise' }));
    expect(document.querySelectorAll('.quiz-target')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Log practice' })).toBeInTheDocument();
  });
  it('changing key restarts the quiz', async () => {
    const user = setup(); render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Note quiz' }));
    await user.click(screen.getAllByRole('button', { name: 'C' })[0]);
    await user.click(screen.getByRole('button', { name: 'Next note' }));
    expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
    await choose(user, 'Key', 'D minor', board());
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  });
  it('quiz results are logged against the current key', async () => {
    const user = setup(); const onLog = vi.fn(async () => {});
    render(<Harness onLog={onLog} />);
    await choose(user, 'Key', 'A minor', board());
    await user.click(screen.getByRole('tab', { name: 'Note quiz' }));
    for (let i = 0; i < 10; i++) {
      await user.click(screen.getAllByRole('button', { name: 'C♯' })[0]);
      await user.click(screen.getByRole('button', { name: /Next note|See result/ }));
    }
    await user.click(screen.getByRole('button', { name: 'Log result' }));
    expect(onLog).toHaveBeenCalledWith('Note quiz · 0/10', 9, 'Needs work');
  }, 20_000);
});

describe('Metronome panel and stats', () => {
  it('+ / − / typed tempo / start-stop / tap', async () => {
    const user = setup(); render(<Harness />);
    const field = screen.getByLabelText('Metronome tempo');
    await user.click(screen.getByRole('button', { name: 'Faster by 5 BPM' })); expect(field).toHaveValue(80);
    await user.click(screen.getByRole('button', { name: 'Slower by 5 BPM' }));
    await user.click(screen.getByRole('button', { name: 'Slower by 5 BPM' })); expect(field).toHaveValue(70);
    await user.clear(field); await user.type(field, '132{Enter}'); expect(field).toHaveValue(132);
    await user.click(screen.getByRole('button', { name: 'Start metronome' }));
    expect(screen.getByRole('button', { name: 'Stop metronome' })).toHaveTextContent('Stop');
    await user.click(screen.getByRole('button', { name: 'Stop metronome' }));
    expect(screen.getByRole('button', { name: 'Start metronome' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tap tempo' }));
  });
  it('− and + stop at 30 and 240', async () => {
    const user = setup(); render(<Harness />);
    const field = screen.getByLabelText('Metronome tempo');
    await user.clear(field); await user.type(field, '32{Enter}');
    await user.click(screen.getByRole('button', { name: 'Slower by 5 BPM' })); expect(field).toHaveValue(30);
    await user.clear(field); await user.type(field, '238{Enter}');
    await user.click(screen.getByRole('button', { name: 'Faster by 5 BPM' })); expect(field).toHaveValue(240);
  });
  it('shows an empty history, then streak, weekly count, the 4 latest and a nudge', () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByText(/first logged exercise/)).toBeInTheDocument();
    const day = (n: number, ex = `Ex ${n}`): Session => ({ id: String(n), exercise: ex, key: 4, rating: 'Comfortable', date: new Date(Date.now() - n * 864e5).toISOString() });
    rerender(<Harness sessions={[1, 2, 3, 4, 5].map(n => day(n))} />);
    const stats = document.querySelector('.stats')!;
    expect(stats.textContent).toContain('5day streak');
    expect(stats.textContent).toContain('5sessions this week');
    expect(document.querySelectorAll('.history-row')).toHaveLength(4);
    expect(screen.getByText(/Nothing logged today/)).toBeInTheDocument();
    rerender(<Harness sessions={[day(0)]} />);
    expect(screen.queryByText(/Nothing logged today/)).toBeNull();
    expect(screen.getByText('Ex 0')).toBeInTheDocument();
    expect(within(document.querySelector('.recent') as HTMLElement).getByText(/E minor ·/)).toBeInTheDocument();
  });
  it('string names are all rendered', () => {
    render(<Harness />);
    for (const s of STRING_NAMES) expect(within(board()).getAllByText(s).length).toBeGreaterThan(0);
  });
});
