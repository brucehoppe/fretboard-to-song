'use client';
import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Check, Music2, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Choice, NumberField, keyItems } from '@/components/app/fields';
import { MetronomePanel } from '@/components/app/metronome-panel';
import type { Metronome } from '@/hooks/use-audio';
import { useUnsavedWarning } from '@/hooks/use-unsaved-warning';
import { newId } from '@/lib/api';
import { NOTES, sectionReady, type Lick, type Section, type SectionStatus, type Song } from '@/lib/music';

const STARTER_SECTIONS = ['Intro', 'Verse', 'Chorus', 'Bridge / Solo', 'Ending'];

export function SongsTab({ songs, licks, loaded, busy, root, metronome, onSave, onDelete, onExploreKey, onOpenLicks }: {
  songs: Song[]; licks: Lick[]; loaded: boolean; busy: boolean; root: number; metronome: Metronome;
  onSave: (s: Song) => Promise<Song | null>; onDelete: (s: Song) => Promise<boolean>;
  onExploreKey: (key: number) => void; onOpenLicks: () => void;
}) {
  const [draft, setDraft] = useState<Song | null>(null);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  useUnsavedWarning(dirty);

  function edit(change: Partial<Song>) { setDraft(d => d ? { ...d, ...change } : d); setDirty(true); }
  function editSection(id: string, change: Partial<Section>) {
    if (draft) edit({ sections: draft.sections.map(x => x.id === id ? { ...x, ...change } : x) });
  }
  function moveSection(i: number, by: number) {
    if (!draft) return;
    const next = [...draft.sections]; const [s] = next.splice(i, 1); next.splice(i + by, 0, s);
    edit({ sections: next });
  }

  async function save(value = draft) {
    if (!value) return false;
    const saved = await onSave(value);
    if (saved) { setDraft(saved); setDirty(false); }
    return !!saved;
  }
  async function leaveDraft() {
    if (!dirty || !draft) return true;
    if (await save()) return true;
    return window.confirm(`Could not save “${draft.title}”. Discard your unsaved changes?`);
  }
  async function select(s: Song) { if (s.id !== draft?.id && await leaveDraft()) { setDraft(s); setDirty(false); } }
  async function add() {
    if (!title.trim() || !(await leaveDraft())) return;
    const s: Song = {
      id: newId(), title: title.trim(), artist: artist.trim(), key: root, target: 100,
      sections: STARTER_SECTIONS.map(name => ({ id: newId(), name, bpm: 60, status: 'New', transition: false })),
      notes: '', runs: 0, lastRun: '', revision: 0,
    };
    if (await save(s)) { setTitle(''); setArtist(''); setAdding(false); }
  }
  async function remove() {
    if (!draft || !window.confirm(`Delete “${draft.title}” and all its section progress? This cannot be undone.`)) return;
    if (await onDelete(draft)) { setDraft(null); setDirty(false); }
  }

  const done = draft ? draft.sections.filter((_, i) => sectionReady(draft, i)).length : 0;
  const pct = draft?.sections.length ? Math.round(done / draft.sections.length * 100) : 0;
  const songLicks = draft ? licks.filter(l => l.songId === draft.id) : [];
  // The weakest section is the best use of the next practice session.
  const focus = draft?.sections.map((s, i) => ({ s, i })).find(({ i }) => !sectionReady(draft, i));

  return (
    <>
      <div className="page-title">
        <div><p className="eyebrow">FROM FIRST RIFF TO FINAL CHORD</p><h1>Finish the song.</h1></div>
        <Button onClick={() => setAdding(!adding)} disabled={!loaded}><Plus />Add a song</Button>
      </div>
      {adding && (
        <form className="panel add-form" onSubmit={e => { e.preventDefault(); void add(); }}>
          <label>Song title<Input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="A song you want to play" autoFocus /></label>
          <label>Artist · optional<Input maxLength={120} value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name" /></label>
          <Button disabled={busy} type="submit">Create song</Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      )}
      {!songs.length && !draft ? (
        <section className="panel empty-state">
          <Music2 size={36} /><h2>One song, all the way through.</h2>
          <p>Add something you enjoy. Track the sections, connect the transitions, then play it from beginning to end.</p>
          <Button onClick={() => setAdding(true)} disabled={!loaded}><Plus />Choose your first song</Button>
        </section>
      ) : (
        <div className="songs-layout">
          <aside className="song-list" aria-label="Your songs">
            {songs.map(s => {
              const ready = s.sections.filter((_, i) => sectionReady(s, i)).length;
              return (
                <button key={s.id} className={draft?.id === s.id ? 'song selected' : 'song'} onClick={() => void select(s)} disabled={busy}>
                  <Music2 size={18} />
                  <span><b>{s.title}</b><small>{s.artist || 'Your repertoire'} · {ready}/{s.sections.length} ready · {s.runs} runs</small></span>
                </button>
              );
            })}
          </aside>
          <section className="panel song-editor">
            {draft ? (
              <>
                <div className="section-heading">
                  <div><h2>{draft.title}</h2><p>{draft.artist || 'Your next complete song'}</p></div>
                  <Button disabled={busy || !dirty} onClick={() => void save()}><Save />{busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Button>
                </div>
                <fieldset disabled={busy}>
                  <div className="song-settings">
                    <label>Title<Input value={draft.title} maxLength={120} onChange={e => edit({ title: e.target.value })} /></label>
                    <label>Artist<Input value={draft.artist} maxLength={120} onChange={e => edit({ artist: e.target.value })} /></label>
                    <Choice label="Key for lead practice" value={String(draft.key)} onChange={v => edit({ key: +v })} items={keyItems(NOTES)} />
                    <label className="narrow">Target BPM<NumberField min={30} max={300} value={draft.target} onCommit={v => edit({ target: v })} /></label>
                    <Button variant="outline" onClick={() => onExploreKey(draft.key)}>Explore this key<ArrowRight /></Button>
                  </div>
                  <div className="progress-label"><span>{done} of {draft.sections.length} sections ready</span><span>{pct}%</span></div>
                  <Progress value={pct} />
                  <p className="subtle">Ready = Steady at the target tempo, with the entry from the previous section secure.
                    {focus && <> Next focus: <b>{focus.s.name}</b>.</>}</p>

                  <MetronomePanel m={metronome} compact />

                  <div className="sections">
                    {draft.sections.map((s, i) => (
                      <div className={'song-section' + (sectionReady(draft, i) ? ' ready' : '') + (focus?.i === i ? ' focus' : '')} key={s.id}>
                        <span className="section-index">{sectionReady(draft, i) ? <Check size={16} aria-label="Ready" /> : String(i + 1).padStart(2, '0')}</span>
                        <label>Section<Input aria-label={`Section ${i + 1} name`} value={s.name} maxLength={80} onChange={e => editSection(s.id, { name: e.target.value })} /></label>
                        <label>Clean BPM<NumberField aria-label={`${s.name} clean BPM`} min={30} max={300} value={s.bpm} onCommit={v => editSection(s.id, { bpm: v })} /></label>
                        <Choice label="Confidence" value={s.status} onChange={v => editSection(s.id, { status: v as SectionStatus })} items={(['New', 'Learning', 'Steady'] as const).map(v => [v, v])} />
                        <label className="transition">
                          <Checkbox checked={i === 0 || s.transition} disabled={i === 0} onCheckedChange={v => editSection(s.id, { transition: v === true })} />
                          {i === 0 ? 'Start of song' : 'Entry is smooth'}
                        </label>
                        <div className="section-tools">
                          <Button variant="outline" size="sm" title={`Start the metronome at ${s.bpm} BPM`} onClick={() => metronome.start(s.bpm)}><Play />{s.bpm}</Button>
                          <Button variant="ghost" size="sm" title="Played it cleanly? Nudge the tempo up 5 BPM" disabled={s.bpm >= 300}
                            onClick={() => { const bpm = Math.min(300, s.bpm + 5); editSection(s.id, { bpm }); if (metronome.playing) metronome.setBpm(bpm); }}>+5</Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => moveSection(i, -1)}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} down`} disabled={i === draft.sections.length - 1} onClick={() => moveSection(i, 1)}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.name}`} onClick={() => edit({ sections: draft.sections.filter(x => x.id !== s.id) })}><X /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" disabled={draft.sections.length >= 40} onClick={() => edit({ sections: [...draft.sections, { id: newId(), name: 'New section', bpm: 60, status: 'New', transition: false }] })}><Plus />Add section</Button>

                  {songLicks.length > 0 && (
                    <div className="song-licks">
                      <h3>Licks for this song</h3>
                      <p>{songLicks.map(l => l.title).join(' · ')}</p>
                      <Button variant="link" onClick={onOpenLicks}>Open Lick Notebook<ArrowRight /></Button>
                    </div>
                  )}

                  <label className="notes-label">Next time, work on…<Textarea value={draft.notes} maxLength={4000} onChange={e => edit({ notes: e.target.value })} placeholder="The chorus entry, the ending, a tricky shift…" /></label>
                  <div className="run-panel">
                    <div>
                      <h3>{draft.runs} complete play-through{draft.runs === 1 ? '' : 's'}</h3>
                      <p>{draft.lastRun ? `Last played ${new Date(draft.lastRun).toLocaleDateString()}` : 'Keep going through mistakes. Practise recovering.'}</p>
                    </div>
                    <Button disabled={busy || draft.sections.length === 0} onClick={() => void save({ ...draft, runs: draft.runs + 1, lastRun: new Date().toISOString() })}><Check />Log a full play-through</Button>
                  </div>
                  <div className="danger-zone"><Button variant="ghost" className="danger" onClick={() => void remove()}><Trash2 />Delete song</Button></div>
                </fieldset>
              </>
            ) : (
              <div className="empty-state"><h2>Pick a song to continue.</h2><p>Your section tempos, transitions, and notes are saved here.</p></div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
