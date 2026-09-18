'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Music2, Route } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JourneyTab } from '@/components/app/journey-tab';
import { LicksTab } from '@/components/app/licks-tab';
import { SignInGate } from '@/components/app/sign-in-gate';
import { SongsTab } from '@/components/app/songs-tab';
import { useAudio, useMetronome } from '@/hooks/use-audio';
import { useFretboardView } from '@/hooks/use-fretboard-view';
import { useWebMcp } from '@/hooks/use-webmcp';
import { loadPractice, newId, post, signOut, UnauthorizedError } from '@/lib/api';
import { rangeFor, type Lick, type Rating, type Session, type Song } from '@/lib/music';

export default function Home() {
  const [tab, setTab] = useState('journey');
  const [songs, setSongs] = useState<Song[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [licks, setLicks] = useState<Lick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = useFretboardView();
  const audio = useAudio();
  const metronome = useMetronome(audio);
  const showJourney = useCallback(() => setTab('journey'), []);
  useWebMcp(view, showJourney);

  const load = useCallback(() => loadPractice().then(
    data => { setSongs(data.songs); setSessions(data.sessions); setLicks(data.licks); setLoaded(true); setNeedsSignIn(false); },
    (e: Error) => { if (e instanceof UnauthorizedError) setNeedsSignIn(true); else setError(e.message); },
  ), []);
  useEffect(() => { void load(); }, [load]);

  if (needsSignIn) return <SignInGate onSignedIn={() => void load()} />;

  /** Runs a server write with a shared busy flag and toast feedback. */
  async function write<T>(fn: () => Promise<T>, success?: string): Promise<T | null> {
    setBusy(true);
    try { const r = await fn(); if (success) toast.success(success); return r; }
    catch (e) {
      if (e instanceof UnauthorizedError) { setNeedsSignIn(true); return null; }
      toast.error((e as Error).message);
      return null;
    }
    finally { setBusy(false); }
  }

  const logSession = async (exercise: string, key: number, rating: Rating) => {
    const s: Session = { id: newId(), exercise, key, rating, date: new Date().toISOString() };
    if (await write(() => post('session', s), 'Practice logged')) setSessions(h => [s, ...h]);
  };
  const saveSong = (value: Song) => write(async () => {
    const p = await post('song', value);
    const saved = { ...value, revision: p.revision ?? value.revision + 1 };
    setSongs(list => [saved, ...list.filter(x => x.id !== saved.id)]);
    return saved;
  }, 'Song saved');
  const deleteSong = async (s: Song) => !!(await write(async () => {
    await post('delete-song', { id: s.id });
    setSongs(list => list.filter(x => x.id !== s.id));
    setLicks(list => list.map(l => l.songId === s.id ? { ...l, songId: '' } : l));
    return true;
  }, 'Song deleted'));
  const saveLick = (value: Lick) => write(async () => {
    const p = await post('lick', value);
    const saved = { ...value, revision: p.revision ?? value.revision + 1 };
    setLicks(list => [saved, ...list.filter(x => x.id !== saved.id)]);
    return saved;
  }, 'Lick saved');
  const deleteLick = async (l: Lick) => !!(await write(async () => {
    await post('delete-lick', { id: l.id });
    setLicks(list => list.filter(x => x.id !== l.id));
    return true;
  }, 'Lick deleted'));

  function showOnFretboard(key: number, box: string, frets?: number[]) {
    view.setRoot(key); view.setBox(box);
    if (frets?.length) view.setRange(rangeFor(frets));
    setTab('journey');
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-icon"><Music2 size={23} /></span><span>Fretboard <em>to</em> Song</span></Link>
        <span className="edition">YOUR PRACTICE STUDIO</span>
        <Button variant="outline" size="sm" onClick={() => { void signOut().then(() => setNeedsSignIn(true)); }}>Sign out</Button>
      </header>
      <main>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="navline">
            <TabsList className="main-tabs">
              <TabsTrigger value="journey"><Route />Fretboard Journey</TabsTrigger>
              <TabsTrigger value="songs"><BookOpen />Song Finisher</TabsTrigger>
              <TabsTrigger value="licks"><Music2 />Lick Notebook</TabsTrigger>
            </TabsList>
            <span className="saved-hint">{loaded ? 'Progress saved between visits' : error ? 'Offline — changes cannot be saved' : 'Connecting to your practice…'}</span>
          </div>
          {error && <div className="error" role="alert">{error}<Button onClick={() => { setError(''); void load(); }} variant="outline">Retry</Button></div>}
          {/* forceMount keeps unsaved drafts alive when switching tabs; CSS hides inactive panels. */}
          <TabsContent value="journey" forceMount>
            <JourneyTab view={view} audio={audio} metronome={metronome} sessions={sessions} onLog={logSession} loaded={loaded} busy={busy} />
          </TabsContent>
          <TabsContent value="songs" forceMount>
            <SongsTab songs={songs} licks={licks} loaded={loaded} busy={busy} root={view.root} metronome={metronome}
              onSave={saveSong} onDelete={deleteSong} onExploreKey={k => showOnFretboard(k, view.box)} onOpenLicks={() => setTab('licks')} />
          </TabsContent>
          <TabsContent value="licks" forceMount>
            <LicksTab licks={licks} songs={songs} loaded={loaded} busy={busy} audio={audio} root={view.root} box={view.box}
              fretCount={view.fretCount} onSave={saveLick} onDelete={deleteLick} onShow={showOnFretboard} />
          </TabsContent>
        </Tabs>
        <footer>Small phrases. Connected positions. Complete songs.</footer>
      </main>
    </>
  );
}
