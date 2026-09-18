import { render, renderHook, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LicksTab } from '@/components/app/licks-tab';
import { useAudio } from '@/hooks/use-audio';
import { NOTES, buildLickIdea, type Lick, type Song } from '@/lib/music';
import { choose, optionsOf, selected, setup } from '../helpers/ui';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const lick = (n: number, o: Partial<Lick> = {}): Lick => ({ id: uuid(n), title: `Lick ${n}`, key: 4, box: '0', technique: 'bend', tab: '', notes: '', status: 'Idea', songId: '', revision: 1, ...o });
const songs: Song[] = [
  { id: uuid(100), title: 'Little Wing', artist: '', key: 4, target: 70, sections: [], notes: '', runs: 0, lastRun: '', revision: 1 },
  { id: uuid(101), title: 'Red House', artist: '', key: 11, target: 60, sections: [], notes: '', runs: 0, lastRun: '', revision: 1 },
];

function renderTab(initial: Lick[] = [], opts: { saveFails?: boolean; busy?: boolean; loaded?: boolean } = {}) {
  const onSave = vi.fn(), onDelete = vi.fn(), onShow = vi.fn();
  const a = renderHook(() => useAudio()).result.current;
  function Harness() {
    const [licks, setLicks] = useState(initial);
    return <LicksTab licks={licks} songs={songs} loaded={opts.loaded ?? true} busy={opts.busy ?? false} audio={a} root={7} box="2" fretCount={24} onShow={onShow}
      onSave={async l => { onSave(l); if (opts.saveFails) return null; const s = { ...l, revision: l.revision + 1 }; setLicks(ls => [s, ...ls.filter(x => x.id !== s.id)]); return s; }}
      onDelete={async l => { onDelete(l); setLicks(ls => ls.filter(x => x.id !== l.id)); return true; }} />;
  }
  render(<Harness />);
  return { onSave, onDelete, onShow };
}
const list = () => screen.getByRole('complementary', { name: 'Your licks' });
const editor = () => document.querySelector('.lick-editor') as HTMLElement;
const listItems = () => within(list()).queryAllByRole('button').filter(b => b.classList.contains('lick'));

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });

describe('Lick Notebook', () => {
  it('empty state → new lick defaults to the current key and position', async () => {
    const user = setup(); renderTab();
    expect(screen.getByText(/Save the ideas you want to find again/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save your first lick' }));
    expect(selected('Key', editor())).toBe('G minor');
    expect(selected('Position', editor())).toBe('Box 3');
    expect(selected('Status', editor())).toBe('Idea');
    expect(selected('Use in song', editor())).toBe('No song yet');
  });
  it('both "Save a lick" buttons are disabled until loaded', () => {
    renderTab([], { loaded: false });
    for (const b of screen.getAllByRole('button', { name: /Save (a|your first) lick/ })) expect(b).toBeDisabled();
  });
  it('requires a title', async () => {
    const user = setup(); renderTab();
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const save = within(editor()).getByRole('button', { name: 'Save lick' });
    expect(save).toBeDisabled();
    expect(within(editor()).getByPlaceholderText(/Slow bend/)).toHaveAttribute('aria-invalid', 'true');
    await user.type(within(editor()).getByPlaceholderText(/Slow bend/), 'x');
    expect(save).toBeEnabled();
  });
  it('every field option is offered and saved', async () => {
    const user = setup(); const { onSave } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    expect(await optionsOf(user, 'Key', editor())).toEqual(NOTES.map(n => `${n} minor`));
    expect(await optionsOf(user, 'Position', editor())).toEqual(['Whole neck', 'Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5']);
    expect(await optionsOf(user, 'Status', editor())).toEqual(['Idea', 'Practising', 'Learned']);
    expect(await optionsOf(user, 'Use in song', editor())).toEqual(['No song yet', 'Little Wing', 'Red House']);
    await user.type(within(editor()).getByPlaceholderText(/Slow bend/), 'SRV turnaround');
    await choose(user, 'Key', 'B minor', editor());
    await choose(user, 'Position', 'Whole neck', editor());
    await user.type(within(editor()).getByPlaceholderText(/Bend, slide/), 'double stops');
    await choose(user, 'Status', 'Practising', editor());
    await choose(user, 'Use in song', 'Red House', editor());
    await user.type(within(editor()).getByLabelText(/Tab or note sequence/), 'B|7-9|');
    await user.type(within(editor()).getByLabelText(/How it sounds/), 'lazy');
    await user.click(within(editor()).getByRole('button', { name: 'Save lick' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'SRV turnaround', key: 11, box: 'all', technique: 'double stops', status: 'Practising', songId: uuid(101), tab: 'B|7-9|', notes: 'lazy', revision: 0 }));
    expect(within(editor()).getByRole('button', { name: 'Saved' })).toBeDisabled();
    expect(listItems()[0]).toHaveTextContent('SRV turnaround');
    expect(listItems()[0]).toHaveTextContent('B minor · whole neck · Red House');
  });
  it.each([['Idea', '○'], ['Practising', '◐']] as const)('%s licks show their status icon', (status, icon) => {
    renderTab([lick(1, { status })]);
    expect(listItems()[0].querySelector('.lick-status')).toHaveTextContent(icon);
  });
  it('Learned licks show a check', () => {
    renderTab([lick(1, { status: 'Learned' })]);
    expect(listItems()[0].querySelector('.lick-status svg')).not.toBeNull();
  });
  it('search matches title, technique and notes', async () => {
    const user = setup();
    renderTab([lick(1, { title: 'Alpha' }), lick(2, { title: 'Beta', technique: 'Vibrato' }), lick(3, { title: 'Gamma', notes: 'from Hendrix' })]);
    const search = screen.getByLabelText('Filter licks');
    for (const [q, expected] of [['alpha', ['Alpha']], ['VIBRATO', ['Beta']], ['hendrix', ['Gamma']], ['', ['Alpha', 'Beta', 'Gamma']]] as const) {
      await user.clear(search); if (q) await user.type(search, q);
      expect(listItems().map(b => b.querySelector('b')!.textContent)).toEqual(expected);
    }
    await user.type(search, 'zzz');
    expect(screen.getByText('No licks match.')).toBeInTheDocument();
  });
  it('status filter shows counts and filters', async () => {
    const user = setup();
    renderTab([lick(1, { status: 'Idea' }), lick(2, { status: 'Practising' }), lick(3, { status: 'Learned' }), lick(4, { status: 'Learned' })]);
    const group = screen.getByRole('group', { name: 'Filter by status' });
    for (const [name, count] of [['All 4', 4], ['Idea 1', 1], ['Practising 1', 1], ['Learned 2', 2]] as const) {
      await user.click(within(group).getByRole('button', { name }));
      expect(listItems()).toHaveLength(count);
      expect(within(group).getByRole('button', { name })).toHaveClass('on');
    }
  });
  it('switching licks with unsaved edits saves first, then opens the other (regression)', async () => {
    const user = setup(); const { onSave } = renderTab([lick(1), lick(2)]);
    await user.click(listItems()[0]);
    await user.type(within(editor()).getByDisplayValue('Lick 1'), ' edited');
    await user.click(listItems().find(b => b.textContent!.includes('Lick 2'))!);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lick 1 edited' }));
    expect(within(editor()).getByDisplayValue('Lick 2')).toBeInTheDocument(); // old bug: jumped back to Lick 1
    expect(window.confirm).not.toHaveBeenCalled();
  });
  it('asks before discarding an untitled draft; cancelling keeps it', async () => {
    const user = setup(); renderTab([lick(1)]);
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    await user.type(within(editor()).getByLabelText(/How it sounds/), 'precious idea');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(listItems()[0]);
    expect(within(editor()).getByDisplayValue('precious idea')).toBeInTheDocument();
    await user.click(listItems()[0]);
    expect(within(editor()).getByDisplayValue('Lick 1')).toBeInTheDocument();
  });
  it('asks before discarding when the save fails', async () => {
    const user = setup(); renderTab([lick(1), lick(2)], { saveFails: true });
    await user.click(listItems()[0]);
    await user.type(within(editor()).getByDisplayValue('Lick 1'), '!');
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(listItems()[1]);
    expect(window.confirm).toHaveBeenCalled();
    expect(within(editor()).getByDisplayValue('Lick 1!')).toBeInTheDocument();
  });
  it('Close closes a clean lick without prompting', async () => {
    const user = setup(); renderTab([lick(1)]);
    await user.click(listItems()[0]);
    await user.click(within(editor()).getByRole('button', { name: 'Close' }));
    expect(screen.getByText(/Save the ideas/)).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });
  it('Discard drops a never-saved lick without calling the server', async () => {
    const user = setup(); const { onDelete } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    await user.click(within(editor()).getByRole('button', { name: 'Discard' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/Save the ideas/)).toBeInTheDocument();
  });
  it('Delete asks for confirmation', async () => {
    const user = setup(); const { onDelete } = renderTab([lick(1)]);
    await user.click(listItems()[0]);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await user.click(within(editor()).getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(within(editor()).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: uuid(1) }));
    expect(listItems()).toHaveLength(0);
  });
  it('Show on fretboard passes key, box and frets parsed from the tab', async () => {
    const user = setup(); const { onShow } = renderTab([lick(1, { key: 2, box: '3', tab: 'B|15b17|\nG|14|' }), lick(2, { tab: 'no numbers' })]);
    await user.click(listItems()[0]);
    await user.click(within(editor()).getByRole('button', { name: /Show on fretboard/ }));
    expect(onShow).toHaveBeenCalledWith(2, '3', [15, 17, 14]);
    await user.click(listItems()[1]);
    await user.click(within(editor()).getByRole('button', { name: /Show on fretboard/ }));
    expect(onShow).toHaveBeenLastCalledWith(4, '0', undefined);
  });
  it('a lick linked to a deleted song shows "No song yet"', async () => {
    const user = setup(); renderTab([lick(1, { songId: uuid(999) })]);
    expect(listItems()[0]).not.toHaveTextContent('·  ·');
    await user.click(listItems()[0]);
    expect(selected('Use in song', editor())).toBe('No song yet');
  });
  it('Lab → Open in Lick Notebook fills a new draft (saving any open edits first)', async () => {
    const user = setup(); const { onSave } = renderTab([lick(1)]);
    await user.click(listItems()[0]);
    await user.type(within(editor()).getByDisplayValue('Lick 1'), '+');
    await user.click(screen.getByRole('button', { name: 'Open in Lick Notebook' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lick 1+' }));
    const idea = buildLickIdea(7, 'question', 0);
    expect(within(editor()).getByDisplayValue(idea.title)).toBeInTheDocument();
    expect(within(editor()).getByLabelText(/Tab or note sequence/)).toHaveValue(idea.tab);
    expect(selected('Position', editor())).toBe('Box 1');
    expect(selected('Key', editor())).toBe('G minor');
  });
  it('Lab → See the position shows box 1 with the phrase frets', async () => {
    const user = setup(); const { onShow } = renderTab();
    await user.click(screen.getByRole('button', { name: 'See the position' }));
    expect(onShow).toHaveBeenCalledWith(7, '0', buildLickIdea(7, 'question', 0).events.map(e => e.fret));
  });
  it('locks the form while saving', async () => {
    const user = setup(); renderTab([lick(1)], { busy: true });
    expect(listItems()[0]).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    expect(editor().querySelector('fieldset')).toBeDisabled();
  });
  it('warns before leaving the page with unsaved edits', async () => {
    const user = setup(); renderTab();
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
