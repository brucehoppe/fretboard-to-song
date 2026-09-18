'use client';
import { useState } from 'react';
import { ArrowRight, Play, Plus, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Choice, keyItems } from '@/components/app/fields';
import type { Audio } from '@/hooks/use-audio';
import { LICK_MOVES, NOTES, buildLickIdea, type LickIdea, type LickMove } from '@/lib/music';

export function LickLab({ initialKey, fretCount, audio, onOpen, onShow }: {
  initialKey: number; fretCount: number; audio: Audio;
  onOpen: (idea: LickIdea, key: number) => void; onShow: (idea: LickIdea, key: number) => void;
}) {
  const [key, setKey] = useState(initialKey);
  const [move, setMove] = useState<LickMove>('question');
  const [variation, setVariation] = useState(0);
  const [tempo, setTempo] = useState('80');
  const [playing, setPlaying] = useState(false);
  const idea = buildLickIdea(key, move, variation, fretCount);

  function play() {
    if (playing) { audio.stopPhrase(); setPlaying(false); return; }
    try {
      const ms = audio.playPhrase(idea.events, +tempo);
      setPlaying(true);
      setTimeout(() => setPlaying(false), ms);
    } catch { toast.error('Audio is unavailable in this browser.'); }
  }

  return (
    <section className="panel lick-lab" aria-label="Lick development lab">
      <div className="lab-heading">
        <div>
          <p className="eyebrow">LICK DEVELOPMENT LAB</p>
          <h2>Start with one musical move.</h2>
          <p>Do not try to invent a full solo. Play this phrase slowly, then change one thing: its ending, rhythm, or final note.</p>
        </div>
        <span className="lab-count">ENDING {variation % 3 + 1} OF 3</span>
      </div>
      <div className="lab-controls">
        <Choice label="Pentatonic key" value={String(key)} onChange={v => setKey(+v)} items={keyItems(NOTES)} />
        <Choice label="Musical move" value={move} onChange={v => { setMove(v as LickMove); setVariation(0); }} items={LICK_MOVES} />
        <Choice label="Playback tempo" value={tempo} onChange={setTempo} items={[['60', '60 BPM · slow'], ['80', '80 BPM'], ['100', '100 BPM']]} />
        <Button variant="outline" onClick={() => setVariation(v => (v + 1) % 3)}><ArrowRight />Change the ending</Button>
      </div>
      <div className="idea-card">
        <div className="idea-title">
          <span className="idea-number">{String(LICK_MOVES.findIndex(([m]) => m === move) + 1).padStart(2, '0')}</span>
          <div><h3>{idea.title}</h3><p>{idea.technique} · ending: {idea.endingLabel.toLowerCase()}</p></div>
          <span className="idea-intervals">{idea.intervals}</span>
        </div>
        <div className="idea-grid">
          <div>
            <h4>Why it works</h4><p>{idea.purpose}</p>
            <h4>Build it in three moves</h4>
            <ol>{idea.steps.map(step => <li key={step}>{step}</li>)}</ol>
            <div className="development-prompt"><b>Then change one thing</b><span>{idea.development}</span></div>
          </div>
          <div>
            <pre aria-label="Starter guitar tab">{idea.tab}</pre>
            <p className="tab-key">h hammer-on · p pull-off · / slide · b bend · r release</p>
          </div>
        </div>
        <div className="idea-actions">
          <Button variant="secondary" onClick={play}>{playing ? <Square /> : <Play />}{playing ? 'Stop' : 'Hear starter'}</Button>
          <Button onClick={() => onOpen(idea, key)}><Plus />Open in Lick Notebook</Button>
          <Button variant="outline" onClick={() => onShow(idea, key)}>See the position<ArrowRight /></Button>
        </div>
      </div>
    </section>
  );
}
