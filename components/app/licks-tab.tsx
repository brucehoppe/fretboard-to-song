'use client';
import { useState } from 'react';
import { ArrowRight, Check, Music2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Choice, keyItems } from '@/components/app/fields';
import { LickLab } from '@/components/app/lick-lab';
import type { Audio } from '@/hooks/use-audio';
import { useUnsavedWarning } from '@/hooks/use-unsaved-warning';
import { newId } from '@/lib/api';
import { NOTES, type Lick, type LickIdea, type LickStatus, type Song } from '@/lib/music';

const BOX_ITEMS: [string, string][] = [['all', 'Whole neck'], ...[0, 1, 2, 3, 4].map(i => [String(i), `Box ${i + 1}`] as [string, string])];

export function LicksTab({ licks, songs, loaded, busy, audio, root, box, fretCount, onSave, onDelete, onShow }: {
  licks: Lick[]; songs: Song[]; loaded: boolean; busy: boolean; audio: Audio; root: number; box: string; fretCount: number;
  onSave: (l: Lick) => Promise<Lick | null>; onDelete: (l: Lick) => Promise<boolean>;
  onShow: (key: number, box: string, frets?: number[]) => void;
}) {
  const [draft, setDraft] = useState<Lick | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LickStatus>('all');
  useUnsavedWarning(dirty);

  function edit(change: Partial<Lick>) { setDraft(d => d ? { ...d, ...change } : d); setDirty(true); }

  async function save() {
    if (!draft) return false;
    if (!draft.title.trim()) { toast.error('Give the lick a title before saving.'); return false; }
    const saved = await onSave(draft);
    if (saved) { setDraft(saved); setDirty(false); }
    return !!saved;
  }

  /** Before replacing the draft: save it, or ask before throwing edits away. */
  async function leaveDraft() {
    if (!dirty || !draft) return true;
    if (draft.title.trim() && await save()) return true;
    return window.confirm(`Discard unsaved changes to “${draft.title || 'Untitled lick'}”?`);
  }

  async function open(l: Lick | null) { if (await leaveDraft()) { setDraft(l); setDirty(false); } }
  async function create(values: Partial<Lick> = {}) {
    if (!(await leaveDraft())) return;
    setDraft({ id: newId(), title: '', key: root, box, technique: '', tab: '', notes: '', status: 'Idea', songId: '', revision: 0, ...values });
    setDirty(true);
  }
  async function openIdea(idea: LickIdea, key: number) {
    await create({ title: idea.title, key, box: '0', technique: idea.technique, tab: idea.tab, notes: `${idea.purpose}\n\n${idea.notes}` });
    toast.success('Starter lick opened in your notebook — edit it, then save.');
  }
  async function remove() {
    if (!draft) return;
    if (draft.revision === 0) { setDraft(null); setDirty(false); return; }
    if (!window.confirm(`Delete “${draft.title}”? This cannot be undone.`)) return;
    if (await onDelete(draft)) { setDraft(null); setDirty(false); }
  }

  const q = filter.toLowerCase();
  const visible = licks.filter(l => (statusFilter === 'all' || l.status === statusFilter) && (l.title + ' ' + l.technique + ' ' + l.notes).toLowerCase().includes(q));
  const songName = (id: string) => songs.find(s => s.id === id)?.title;

  return (
    <>
      <div className="page-title">
        <div><p className="eyebrow">CAPTURE · MOVE · USE</p><h1>Keep the phrases worth remembering.</h1></div>
        <Button onClick={() => void create()} disabled={!loaded}><Plus />Save a lick</Button>
      </div>
      <LickLab initialKey={root} fretCount={fretCount} audio={audio} onOpen={openIdea}
        onShow={(idea, key) => onShow(key, '0', idea.events.map(e => e.fret))} />
      <div className="licks-layout">
        <aside className="lick-list" aria-label="Your licks">
          <Input aria-label="Filter licks" placeholder="Search title, technique, notes" value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="status-filter" role="group" aria-label="Filter by status">
            {(['all', 'Idea', 'Practising', 'Learned'] as const).map(s => (
              <button key={s} className={statusFilter === s ? 'on' : ''} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? `All ${licks.length}` : `${s} ${licks.filter(l => l.status === s).length}`}
              </button>
            ))}
          </div>
          {visible.length === 0 && licks.length > 0 && <p className="subtle">No licks match.</p>}
          {visible.map(l => (
            <button key={l.id} className={draft?.id === l.id ? 'lick selected' : 'lick'} onClick={() => void open(l)} disabled={busy}>
              <span className="lick-status" aria-label={l.status}>{l.status === 'Learned' ? <Check size={14} /> : l.status === 'Practising' ? '◐' : '○'}</span>
              <span><b>{l.title || 'Untitled lick'}</b><small>{NOTES[l.key]} minor · {l.box === 'all' ? 'whole neck' : `box ${+l.box + 1}`}{songName(l.songId) ? ` · ${songName(l.songId)}` : ''}</small></span>
            </button>
          ))}
        </aside>
        <section className="panel lick-editor">
          {draft ? (
            <>
              <div className="section-heading">
                <div><h2>{draft.title || 'New lick'}</h2><p>Store the sound, the shape, and where you want to use it.</p></div>
                <Button disabled={busy || !dirty || !draft.title.trim()} onClick={() => void save()}><Save />{dirty ? 'Save lick' : 'Saved'}</Button>
              </div>
              <fieldset disabled={busy}>
                <div className="lick-fields">
                  <label>Title<Input value={draft.title} maxLength={120} onChange={e => edit({ title: e.target.value })} placeholder="e.g. Slow bend into the root" aria-invalid={dirty && !draft.title.trim()} /></label>
                  <Choice label="Key" value={String(draft.key)} onChange={v => edit({ key: +v })} items={keyItems(NOTES)} />
                  <Choice label="Position" value={draft.box} onChange={v => edit({ box: v })} items={BOX_ITEMS} />
                  <label>Technique<Input value={draft.technique} maxLength={80} onChange={e => edit({ technique: e.target.value })} placeholder="Bend, slide, vibrato…" /></label>
                  <Choice label="Status" value={draft.status} onChange={v => edit({ status: v as LickStatus })} items={(['Idea', 'Practising', 'Learned'] as const).map(v => [v, v])} />
                  <Choice label="Use in song" value={songName(draft.songId) ? draft.songId : 'none'} onChange={v => edit({ songId: v === 'none' ? '' : v })} items={[['none', 'No song yet'], ...songs.map(s => [s.id, s.title] as [string, string])]} />
                </div>
                <div className="lick-notes">
                  <label>Tab or note sequence<Textarea value={draft.tab} maxLength={2000} onChange={e => edit({ tab: e.target.value })} placeholder={'e|----------------|\nB|--8b10--8------|'} /></label>
                  <label>How it sounds / what to remember<Textarea value={draft.notes} maxLength={4000} onChange={e => edit({ notes: e.target.value })} placeholder="Start behind the beat; resolve to the root on beat 1…" /></label>
                </div>
                <div className="lick-actions">
                  <Button variant="outline" onClick={() => onShow(draft.key, draft.box, rangeFromTab(draft.tab))}>Show on fretboard<ArrowRight /></Button>
                  <Button variant="ghost" onClick={() => void open(null)}>Close</Button>
                  <Button variant="ghost" className="danger" onClick={() => void remove()}><Trash2 />{draft.revision === 0 ? 'Discard' : 'Delete'}</Button>
                </div>
              </fieldset>
            </>
          ) : (
            <div className="empty-state">
              <Music2 size={36} /><h2>Save the ideas you want to find again.</h2>
              <p>Capture a phrase while it is fresh, then move it to another box or attach it to a song.</p>
              <Button onClick={() => void create()} disabled={!loaded}><Plus />Save your first lick</Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** Pull fret numbers out of free-text tab so "Show on fretboard" opens the right range. */
function rangeFromTab(tab: string) {
  const frets = (tab.match(/\d+/g) ?? []).map(Number).filter(n => n <= 24);
  return frets.length ? frets : undefined;
}
