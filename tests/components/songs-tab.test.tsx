import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SongsTab } from '@/components/app/songs-tab';
import { useAudio, useMetronome, type Metronome } from '@/hooks/use-audio';
import { NOTES, type Lick, type Song } from '@/lib/music';
import { choose, optionsOf, selected, setup } from '../helpers/ui';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const song = (n: number, o: Partial<Song> = {}): Song => ({
  id: uuid(n), title: `Song ${n}`, artist: 'Artist', key: 4, target: 100, notes: '', runs: 0, lastRun: '', revision: 1,
  sections: ['Intro', 'Verse', 'Chorus'].map((name, i) => ({ id: uuid(n * 10 + i), name, bpm: 60, status: 'New' as const, transition: false })), ...o,
});

function renderTab(initial: Song[] = [], opts: { saveFails?: boolean; licks?: Lick[] } = {}) {
  const onSave = vi.fn(), onDelete = vi.fn(), onExploreKey = vi.fn(), onOpenLicks = vi.fn();
  let metronome!: Metronome;
  function Harness() {
    const [songs, setSongs] = useState(initial);
    const a = useAudio(); metronome = useMetronome(a);
    return <SongsTab songs={songs} licks={opts.licks ?? []} loaded busy={false} root={9} metronome={metronome}
      onExploreKey={onExploreKey} onOpenLicks={onOpenLicks}
      onSave={async s => { onSave(s); if (opts.saveFails) return null; const saved = { ...s, revision: s.revision + 1 }; setSongs(l => [saved, ...l.filter(x => x.id !== s.id)]); return saved; }}
      onDelete={async s => { onDelete(s); setSongs(l => l.filter(x => x.id !== s.id)); return true; }} />;
  }
  render(<Harness />);
  return { onSave, onDelete, onExploreKey, onOpenLicks, metronome: () => metronome };
}
const editor = () => document.querySelector('.song-editor') as HTMLElement;
const listItem = (name: string) => within(screen.getByRole('complementary', { name: 'Your songs' })).getByRole('button', { name: new RegExp(name) });
const sectionNames = () => [...editor().querySelectorAll<HTMLInputElement>('.song-section input[aria-label$="name"]')].map(i => i.value);
const row = (i: number) => editor().querySelectorAll<HTMLElement>('.song-section')[i];
const progress = () => editor().querySelector('.progress-label')!.textContent;
const save = () => within(editor()).getByRole('button', { name: /Save changes|Saved|Saving/ });

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });

describe('Song Finisher — creating', () => {
  it('empty state → add form → song with five starter sections in the current key', async () => {
    const user = setup(); const { onSave } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Choose your first song' }));
    await user.type(screen.getByPlaceholderText('A song you want to play'), '  Little Wing  ');
    await user.type(screen.getByPlaceholderText('Artist name'), 'Hendrix');
    await user.click(screen.getByRole('button', { name: 'Create song' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Little Wing', artist: 'Hendrix', key: 9, target: 100, runs: 0, revision: 0 }));
    expect(sectionNames()).toEqual(['Intro', 'Verse', 'Chorus', 'Bridge / Solo', 'Ending']);
    expect(screen.queryByPlaceholderText('A song you want to play')).toBeNull();
  });
  it('a title is required', async () => {
    const user = setup(); const { onSave } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    await user.click(screen.getByRole('button', { name: 'Create song' }));
    expect(onSave).not.toHaveBeenCalled();
  });
  it('Cancel and the toggle button close the form', async () => {
    const user = setup(); renderTab();
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('A song you want to play')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    expect(screen.queryByPlaceholderText('A song you want to play')).toBeNull();
  });
  it('keeps the form open if the save fails', async () => {
    const user = setup(); renderTab([], { saveFails: true });
    await user.click(screen.getByRole('button', { name: 'Add a song' }));
    await user.type(screen.getByPlaceholderText('A song you want to play'), 'X');
    await user.click(screen.getByRole('button', { name: 'Create song' }));
    expect(screen.getByPlaceholderText('A song you want to play')).toHaveValue('X');
  });
});

describe('Song Finisher — editing every field', () => {
  it('title, artist, key (12 options), target BPM and notes are saved', async () => {
    const user = setup(); const { onSave } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    expect(save()).toHaveTextContent('Saved');
    const [title, artist] = within(editor()).getAllByRole('textbox');
    await user.clear(title); await user.type(title, 'Renamed');
    await user.clear(artist); await user.type(artist, 'Someone');
    expect(await optionsOf(user, 'Key for lead practice', editor())).toEqual(NOTES.map(n => `${n} minor`));
    await choose(user, 'Key for lead practice', 'D minor', editor());
    const target = within(editor()).getByLabelText('Target BPM', { selector: 'input' });
    await user.clear(target); await user.type(target, '120{Enter}');
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'watch the bends');
    expect(save()).toHaveTextContent('Save changes');
    await user.click(save());
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Renamed', artist: 'Someone', key: 2, target: 120, notes: 'watch the bends' }));
    expect(save()).toHaveTextContent('Saved');
  });
  it('Explore this key sends the song key', async () => {
    const user = setup(); const { onExploreKey } = renderTab([song(1, { key: 7 })]);
    await user.click(listItem('Song 1'));
    await user.click(within(editor()).getByRole('button', { name: /Explore this key/ }));
    expect(onExploreKey).toHaveBeenCalledWith(7);
  });
  it('section name, clean BPM, all three confidence levels and transition', async () => {
    const user = setup(); const { onSave } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    const name = within(row(1)).getByLabelText('Section 2 name');
    await user.clear(name); await user.type(name, 'Verse 1');
    const bpm = within(row(1)).getByLabelText('Verse 1 clean BPM');
    await user.clear(bpm); await user.type(bpm, '95{Enter}');
    expect(await optionsOf(user, 'Confidence', row(1))).toEqual(['New', 'Learning', 'Steady']);
    for (const c of ['Learning', 'Steady', 'New', 'Steady']) { await choose(user, 'Confidence', c, row(1)); expect(selected('Confidence', row(1))).toBe(c); }
    await user.click(within(row(1)).getByRole('checkbox'));
    await user.click(save());
    expect(onSave.mock.calls.at(-1)![0].sections[1]).toMatchObject({ name: 'Verse 1', bpm: 95, status: 'Steady', transition: true });
  });
  it('the first section is always a start (checkbox locked)', async () => {
    const user = setup(); renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    expect(within(row(0)).getByRole('checkbox')).toBeDisabled();
    expect(within(row(0)).getByRole('checkbox')).toBeChecked();
    expect(row(0)).toHaveTextContent('Start of song');
    expect(row(1)).toHaveTextContent('Entry is smooth');
  });
  it('move up, move down and remove sections', async () => {
    const user = setup(); renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    expect(within(row(0)).getByRole('button', { name: 'Move Intro up' })).toBeDisabled();
    expect(within(row(2)).getByRole('button', { name: 'Move Chorus down' })).toBeDisabled();
    await user.click(within(row(0)).getByRole('button', { name: 'Move Intro down' }));
    expect(sectionNames()).toEqual(['Verse', 'Intro', 'Chorus']);
    await user.click(within(row(2)).getByRole('button', { name: 'Move Chorus up' }));
    expect(sectionNames()).toEqual(['Verse', 'Chorus', 'Intro']);
    await user.click(within(row(1)).getByRole('button', { name: 'Remove Chorus' }));
    expect(sectionNames()).toEqual(['Verse', 'Intro']);
  });
  it('add section, up to the 40-section limit', async () => {
    const user = setup(); renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    await user.click(within(editor()).getByRole('button', { name: 'Add section' }));
    expect(sectionNames().at(-1)).toBe('New section');
    for (let i = sectionNames().length; i < 40; i++) await user.click(within(editor()).getByRole('button', { name: 'Add section' }));
    expect(sectionNames()).toHaveLength(40);
    expect(within(editor()).getByRole('button', { name: 'Add section' })).toBeDisabled();
  }, 30_000);
});

describe('Song Finisher — practice tools', () => {
  it('▶ starts the metronome at the section tempo; +5 nudges tempo and a running metronome', async () => {
    const user = setup(); const { metronome } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    await user.click(within(row(1)).getByRole('button', { name: '60' }));
    expect(metronome()).toMatchObject({ playing: true, bpm: 60 });
    await user.click(within(row(1)).getByRole('button', { name: '+5' }));
    expect(within(row(1)).getByLabelText('Verse clean BPM')).toHaveValue(65);
    expect(metronome().bpm).toBe(65);
    await user.click(within(row(1)).getByRole('button', { name: '65' }));
    expect(metronome().bpm).toBe(65);
    expect(screen.getByRole('region', { name: 'Metronome' })).toHaveClass('compact');
  });
  it('+5 leaves a stopped metronome alone and stops at 300', async () => {
    const user = setup(); const { metronome } = renderTab([song(1, { sections: [{ id: uuid(5), name: 'Solo', bpm: 298, status: 'New', transition: false }] })]);
    await user.click(listItem('Song 1'));
    await user.click(within(row(0)).getByRole('button', { name: '+5' }));
    expect(within(row(0)).getByLabelText('Solo clean BPM')).toHaveValue(300);
    expect(within(row(0)).getByRole('button', { name: '+5' })).toBeDisabled();
    expect(metronome().bpm).toBe(75);
  });
  it('progress, ready ticks and next focus follow the readiness rule', async () => {
    const user = setup();
    renderTab([song(1, { target: 80, sections: [
      { id: uuid(1), name: 'A', bpm: 80, status: 'Steady', transition: false },
      { id: uuid(2), name: 'B', bpm: 90, status: 'Steady', transition: true },
      { id: uuid(3), name: 'C', bpm: 70, status: 'Steady', transition: true },
      { id: uuid(4), name: 'D', bpm: 80, status: 'Learning', transition: true },
    ] })]);
    await user.click(listItem('Song 1'));
    expect(progress()).toBe('2 of 4 sections ready50%');
    expect([0, 1, 2, 3].map(i => row(i).classList.contains('ready'))).toEqual([true, true, false, false]);
    expect(row(2)).toHaveClass('focus');
    expect(editor().querySelector('.subtle')).toHaveTextContent('Next focus: C.');
    expect(listItem('Song 1')).toHaveTextContent('2/4 ready');
    await user.clear(within(row(2)).getByLabelText('C clean BPM')); await user.type(within(row(2)).getByLabelText('C clean BPM'), '80{Enter}');
    await choose(user, 'Confidence', 'Steady', row(3));
    expect(progress()).toBe('4 of 4 sections ready100%');
    expect(editor().querySelector('.subtle')).not.toHaveTextContent('Next focus');
  });
  it('raising the target un-readies sections', async () => {
    const user = setup(); renderTab([song(1, { target: 60, sections: [{ id: uuid(1), name: 'A', bpm: 60, status: 'Steady', transition: false }] })]);
    await user.click(listItem('Song 1'));
    expect(progress()).toContain('1 of 1');
    const t = within(editor()).getByLabelText('Target BPM', { selector: 'input' });
    await user.clear(t); await user.type(t, '61{Enter}');
    expect(progress()).toContain('0 of 1');
  });
  it('an empty song shows 0% and cannot log a run', async () => {
    const user = setup(); renderTab([song(1, { sections: [] })]);
    await user.click(listItem('Song 1'));
    expect(progress()).toBe('0 of 0 sections ready0%');
    expect(within(editor()).getByRole('button', { name: 'Log a full play-through' })).toBeDisabled();
  });
  it('logging a play-through increments runs and saves pending edits too', async () => {
    const user = setup(); const { onSave } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    expect(editor()).toHaveTextContent('0 complete play-throughs');
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'note');
    await user.click(within(editor()).getByRole('button', { name: 'Log a full play-through' }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ runs: 1, notes: 'note', lastRun: expect.stringMatching(/^\d{4}-/) }));
    expect(editor()).toHaveTextContent('1 complete play-through');
    expect(editor()).toHaveTextContent('Last played');
    await user.click(within(editor()).getByRole('button', { name: 'Log a full play-through' }));
    expect(editor()).toHaveTextContent('2 complete play-throughs');
  });
  it('lists linked licks with a shortcut to the notebook', async () => {
    const user = setup();
    const licks = [{ id: uuid(50), title: 'Bend lick', key: 4, box: '0', technique: '', tab: '', notes: '', status: 'Idea', songId: uuid(1), revision: 1 } as Lick];
    const { onOpenLicks } = renderTab([song(1), song(2)], { licks });
    await user.click(listItem('Song 1'));
    expect(editor()).toHaveTextContent('Bend lick');
    await user.click(within(editor()).getByRole('button', { name: /Open Lick Notebook/ }));
    expect(onOpenLicks).toHaveBeenCalled();
    await user.click(listItem('Song 2'));
    expect(editor()).not.toHaveTextContent('Licks for this song');
  });
});

describe('Song Finisher — switching, deleting, guarding', () => {
  it('switching songs saves unsaved edits first', async () => {
    const user = setup(); const { onSave } = renderTab([song(1), song(2)]);
    await user.click(listItem('Song 1'));
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'x');
    await user.click(listItem('Song 2'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: uuid(1), notes: 'x' }));
    expect(within(editor()).getByRole('heading', { name: 'Song 2' })).toBeInTheDocument();
  });
  it('if saving fails, asks before discarding; cancelling stays put', async () => {
    const user = setup(); renderTab([song(1), song(2)], { saveFails: true });
    await user.click(listItem('Song 1'));
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'x');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(listItem('Song 2'));
    expect(within(editor()).getByRole('heading', { name: 'Song 1' })).toBeInTheDocument();
    await user.click(listItem('Song 2'));
    expect(within(editor()).getByRole('heading', { name: 'Song 2' })).toBeInTheDocument();
  });
  it('re-selecting the open song does nothing', async () => {
    const user = setup(); const { onSave } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'x');
    await user.click(listItem('Song 1'));
    expect(onSave).not.toHaveBeenCalled();
  });
  it('delete asks first, then removes the song', async () => {
    const user = setup(); const { onDelete } = renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(within(editor()).getByRole('button', { name: 'Delete song' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(within(editor()).getByRole('button', { name: 'Delete song' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: uuid(1) }));
    expect(screen.getByText(/One song, all the way through/)).toBeInTheDocument();
  });
  it('warns before leaving the page with unsaved edits', async () => {
    const user = setup(); renderTab([song(1)]);
    await user.click(listItem('Song 1'));
    await user.type(within(editor()).getByPlaceholderText(/chorus entry/), 'x');
    const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
  it('list shows artist fallback and run count', () => {
    renderTab([song(1, { artist: '', runs: 3 })]);
    expect(listItem('Song 1')).toHaveTextContent('Your repertoire · 0/3 ready · 3 runs');
  });
});
