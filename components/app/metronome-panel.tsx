'use client';
import { Minus, Pause, Play, Plus, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/app/fields';
import { useBeat, type Metronome } from '@/hooks/use-audio';

export function MetronomePanel({ m, compact }: { m: Metronome; compact?: boolean }) {
  return (
    <section className={'panel pulse' + (compact ? ' compact' : '')} aria-label="Metronome">
      {!compact && <div className="section-heading"><h2>Keep your time</h2><Volume2 size={18} /></div>}
      <div className="tempo">
        <Button variant="ghost" size="icon" aria-label="Slower by 5 BPM" onClick={() => m.setBpm(m.bpm - 5)}><Minus /></Button>
        <NumberField aria-label="Metronome tempo" min={30} max={240} value={m.bpm} onCommit={m.setBpm} />
        <Button variant="ghost" size="icon" aria-label="Faster by 5 BPM" onClick={() => m.setBpm(m.bpm + 5)}><Plus /></Button>
        <span>BPM</span>
        <Button aria-label={m.playing ? 'Stop metronome' : 'Start metronome'} onClick={() => m.playing ? m.setPlaying(false) : m.start()}>
          {m.playing ? <Pause /> : <Play />}{m.playing ? 'Stop' : 'Start'}
        </Button>
      </div>
      <div className="beat-row">
        <BeatLights m={m} />
        <Button variant="outline" size="sm" onClick={m.tap}>Tap tempo</Button>
      </div>
      {!compact && <p>Four beats, accent on the first. Tap along with a recording to find its tempo.</p>}
    </section>
  );
}

function BeatLights({ m }: { m: Metronome }) {
  const beat = useBeat(m);
  return <div className="beats" aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} className={(beat === i ? 'on ' : '') + (i === 0 ? 'accent' : '')} />)}</div>;
}
