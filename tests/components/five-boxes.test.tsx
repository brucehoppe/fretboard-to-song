import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyTab } from '@/components/app/journey-tab';
import { useAudio, useMetronome } from '@/hooks/use-audio';
import { useFretboardView } from '@/hooks/use-fretboard-view';
import { NOTES, TUNING } from '@/lib/music';
import { audio, hz, near } from '../helpers/fake-audio';
import { choose, selected, setup } from '../helpers/ui';

function Harness() {
  const view = useFretboardView(); const a = useAudio(); const m = useMetronome(a);
  return <JourneyTab view={view} audio={a} metronome={m} sessions={[]} onLog={vi.fn(async () => {})} loaded busy={false} />;
}
const section = () => screen.getByRole('region', { name: 'The five boxes' });
const mainBoard = () => screen.getByRole('region', { name: 'Interactive guitar fretboard' });
const neckMap = () => within(section()).getByRole('group', { name: 'Five boxes neck map' });
const mapLabel = () => section().querySelector('.map-label')!.textContent;
const boxButton = (n: number) => within(section()).getByRole('button', { name: `Box ${n}` });
const card = (n: number) => within(section()).getByRole('article', { name: `Box ${n}` });
const cardOrder = () => within(section()).getAllByRole('article').map(a => a.getAttribute('aria-label'));
const cardSpan = (n: number) => card(n).querySelector('.box-card-head span')!.textContent;
const mapNote = (string: string, fret: number) => within(neckMap()).getByRole('button', { name: new RegExp(`^String ${string}, fret ${fret},`) });
const dimmedCount = () => neckMap().querySelectorAll('.note.dimmed').length;

describe('Five boxes section', () => {
  it('starts with every box shown and five cards laid out low to high', () => {
    render(<Harness />);
    expect(mapLabel()).toBe('Full neck — all boxes');
    expect(dimmedCount()).toBe(0);
    expect(cardOrder()).toEqual(['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5']);
    expect([1, 2, 3, 4, 5].map(cardSpan)).toEqual(['fret 12–15', 'fret 14–17', 'fret 16–20', 'fret 19–22', 'fret 21–24']);
    expect(within(section()).getByRole('button', { name: 'Show all' })).toBeDisabled();
    expect(card(2)).toHaveTextContent('Roots on the D and B strings.');
  });

  it('selects several boxes at once; the map dims everything outside them', async () => {
    const user = setup(); render(<Harness />);
    await user.click(boxButton(1));
    await user.click(boxButton(3));
    expect(mapLabel()).toBe('Full neck — Boxes 1 + 3 selected');
    expect(boxButton(1)).toHaveAttribute('aria-pressed', 'true');
    expect(boxButton(2)).toHaveAttribute('aria-pressed', 'false');
    expect(boxButton(3)).toHaveAttribute('aria-pressed', 'true');
    expect(card(1)).toHaveClass('selected');
    expect(card(3)).toHaveClass('selected');
    expect(card(2)).not.toHaveClass('selected');
    // E minor: low-E fret 12 is Box 1; fret 22 belongs only to Boxes 4 and 5.
    expect(mapNote('E', 12)).not.toHaveClass('dimmed');
    expect(mapNote('E', 22)).toHaveClass('dimmed');
    expect(dimmedCount()).toBeGreaterThan(0);
  });

  it('tapping a selected box again removes it; "Show all" clears the selection', async () => {
    const user = setup(); render(<Harness />);
    await user.click(boxButton(2)); await user.click(boxButton(4)); await user.click(boxButton(2));
    expect(mapLabel()).toBe('Full neck — Box 4 selected');
    await user.click(within(section()).getByRole('button', { name: 'Show all' }));
    expect(mapLabel()).toBe('Full neck — all boxes');
    expect(dimmedCount()).toBe(0);
    [1, 2, 3, 4, 5].forEach(n => expect(boxButton(n)).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking a card or its header toggles it; tapping a note in a card only plays it', async () => {
    const user = setup(); render(<Harness />);
    await user.click(card(5).querySelector('p')!);
    expect(mapLabel()).toBe('Full neck — Box 5 selected');
    const head = within(card(2)).getByRole('button', { name: /^Box 2/ });
    await user.click(head);
    expect(head).toHaveAttribute('aria-pressed', 'true');
    expect(mapLabel()).toBe('Full neck — Boxes 2 + 5 selected');
    await user.click(within(card(1)).getByRole('button', { name: /^String E, fret 12,/ }));
    expect(near(audio().tones.at(-1)!.freqs[0], hz(TUNING[5] + 12))).toBe(true);
    expect(mapLabel()).toBe('Full neck — Boxes 2 + 5 selected');
  });

  it('the key picker is shared with the main fretboard, both ways', async () => {
    const user = setup(); render(<Harness />);
    await choose(user, 'Key', 'A minor', section());
    expect(selected('Key', mainBoard())).toBe('A minor');
    expect(mainBoard().querySelector('.board-caption')!.textContent).toContain('A minor');
    expect(section()).toHaveTextContent('A minor · frets');
    expect(cardSpan(1)).toBe('fret 5–8');
    await choose(user, 'Key', 'C minor', mainBoard());
    expect(selected('Key', section())).toBe('C minor');
    expect(cardSpan(1)).toBe('fret 8–11');
    for (const n of NOTES) {
      await choose(user, 'Key', `${n} minor`, section());
      expect(within(card(1)).getAllByRole('button', { name: new RegExp(`, ${n}, root$`) }).length).toBeGreaterThan(0);
    }
  });

  it('registers move the boxes by octaves, flag shapes that cannot move, and note out-of-order layouts', async () => {
    const user = setup(); render(<Harness />);
    const reg = (name: string) => within(section()).getByRole('button', { name });
    await user.click(reg('Octave down'));
    expect(reg('Octave down')).toHaveAttribute('aria-pressed', 'true');
    expect(cardSpan(1)).toBe('fret 0–3');
    expect(section().querySelector('.boxes-order')).toBeNull();
    await user.click(reg('Octave up'));
    expect(cardSpan(1)).toBe('fret 12–15');
    expect(card(1)).toHaveTextContent(/no room for this shape an octave higher; its top note would run past fret 24/);
    await choose(user, 'Key', 'A minor', section());
    await user.click(reg('Octave down'));
    // A minor Box 1 already starts at fret 5, so it stays; Box 4 drops from 12 to 0 and now leads.
    expect(card(1)).toHaveTextContent(/no room for this shape an octave lower/);
    expect(cardOrder()[0]).toBe('Box 4');
    expect(section().querySelector('.boxes-order')!.textContent).toContain('Box 1 is a shape, not a place');
    await user.click(reg('Standard'));
    expect(section().querySelectorAll('.stayed')).toHaveLength(0);
  });

  it('follows the guitar, blue-note and interval settings from the main toolbar', async () => {
    const user = setup(); render(<Harness />);
    await choose(user, 'Your guitar', '22 frets', mainBoard());
    const frets = [...neckMap().querySelectorAll('.fret-number')].map(e => +e.textContent!);
    expect(frets.at(-1)).toBe(22);
    expect(cardOrder()[0]).toBe('Box 5'); // no room at 21–24 on a 22-fret neck
    expect(section().querySelector('.boxes-order')).not.toBeNull();
    expect(neckMap().querySelectorAll('.note.blue')).toHaveLength(0);
    await user.click(screen.getByRole('switch', { name: 'Blue note' }));
    expect(neckMap().querySelectorAll('.note.blue').length).toBeGreaterThan(0);
    expect(card(1).querySelectorAll('.note.blue').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('switch', { name: 'Intervals' }));
    expect(within(card(1)).getAllByRole('button', { name: /root$/ })[0]).toHaveTextContent('R');
  });
});
