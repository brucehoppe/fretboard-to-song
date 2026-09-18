import { act, render, renderHook, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { LickLab } from '@/components/app/lick-lab';
import { useAudio } from '@/hooks/use-audio';
import { LICK_MOVES, NOTES, buildLickIdea, type LickMove } from '@/lib/music';
import { audio } from '../helpers/fake-audio';
import { choose, optionsOf, setup } from '../helpers/ui';

function renderLab(fretCount = 24) {
  const onOpen = vi.fn(), onShow = vi.fn();
  const a = renderHook(() => useAudio()).result.current;
  render(<LickLab initialKey={4} fretCount={fretCount} audio={a} onOpen={onOpen} onShow={onShow} />);
  return { onOpen, onShow };
}
const tab = () => screen.getByLabelText('Starter guitar tab').textContent;
const intervals = () => document.querySelector('.idea-intervals')!.textContent;
const endingBadge = () => document.querySelector('.lab-count')!.textContent;

describe('Lick Development Lab', () => {
  it('offers 12 keys, 6 moves and 3 tempos', async () => {
    const user = setup(); renderLab();
    expect(await optionsOf(user, 'Pentatonic key')).toEqual(NOTES.map(n => `${n} minor`));
    expect(await optionsOf(user, 'Musical move')).toEqual(LICK_MOVES.map(m => m[1]));
    expect(await optionsOf(user, 'Playback tempo')).toEqual(['60 BPM · slow', '80 BPM', '100 BPM']);
  });
  for (const fretCount of [24, 22]) {
    it(`every key × every move shows the correct phrase (${fretCount} frets)`, async () => {
      const user = setup(); renderLab(fretCount);
      for (const [k, n] of NOTES.entries()) {
        await choose(user, 'Pentatonic key', `${n} minor`);
        for (const [move, label] of LICK_MOVES) {
          await choose(user, 'Musical move', label);
          const idea = buildLickIdea(k, move as LickMove, 0, fretCount);
          expect(tab()).toBe(idea.tab);
          expect(intervals()).toBe(idea.intervals);
          expect(screen.getByRole('heading', { name: idea.title })).toBeInTheDocument();
          for (const step of idea.steps) expect(screen.getByText(step)).toBeInTheDocument();
        }
      }
    }, 120_000);
  }
  it('"Change the ending" cycles three different endings and wraps; changing move resets it', async () => {
    const user = setup(); renderLab();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(endingBadge()).toBe(`ENDING ${i + 1} OF 3`);
      expect(tab()).toBe(buildLickIdea(4, 'question', i).tab);
      expect(screen.getByText(buildLickIdea(4, 'question', i).development)).toBeInTheDocument();
      seen.push(tab()!);
      await user.click(screen.getByRole('button', { name: 'Change the ending' }));
    }
    expect(new Set(seen).size).toBe(3);
    expect(endingBadge()).toBe('ENDING 1 OF 3');
    await user.click(screen.getByRole('button', { name: 'Change the ending' }));
    await choose(user, 'Musical move', 'Bend into home');
    expect(endingBadge()).toBe('ENDING 1 OF 3');
  });
  it.each([['60 BPM · slow', 60], ['80 BPM', 80], ['100 BPM', 100]])('plays at %s', async (label, bpm) => {
    const user = setup(); renderLab();
    await choose(user, 'Playback tempo', label);
    await user.click(screen.getByRole('button', { name: 'Hear starter' }));
    const [a, b] = audio().tones;
    expect(b.start - a.start).toBeCloseTo(0.5 * 60 / bpm, 5); // first note is an eighth
  });
  it('Hear starter → Stop → back to Hear starter when finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = setup(); renderLab();
    await user.click(screen.getByRole('button', { name: 'Hear starter' }));
    expect(audio().tones.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('button', { name: 'Hear starter' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hear starter' }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole('button', { name: 'Hear starter' })).toBeInTheDocument();
    vi.useRealTimers();
  });
  it('reports audio problems instead of crashing', async () => {
    const err = vi.spyOn(toast, 'error').mockImplementation(() => 0);
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('no audio'); } });
    const user = setup(); renderLab();
    await user.click(screen.getByRole('button', { name: 'Hear starter' }));
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Audio is unavailable'));
  });
  it('Open in Lick Notebook and See the position pass the current idea and key', async () => {
    const user = setup(); const { onOpen, onShow } = renderLab();
    await choose(user, 'Pentatonic key', 'A minor');
    await choose(user, 'Musical move', 'Hammer-on / pull-off');
    await user.click(screen.getByRole('button', { name: 'Change the ending' }));
    const idea = buildLickIdea(9, 'legato', 1);
    await user.click(screen.getByRole('button', { name: 'Open in Lick Notebook' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ tab: idea.tab, title: idea.title }), 9);
    await user.click(screen.getByRole('button', { name: 'See the position' }));
    expect(onShow).toHaveBeenCalledWith(expect.objectContaining({ events: idea.events }), 9);
  });
});
