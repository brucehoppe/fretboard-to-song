'use client';
import { DEGREES, INLAYS, NOTES, STRING_NAMES, TUNING, degree, inPosition, isScaleNote, noteAt, type QuizTarget } from '@/lib/music';

export type FretboardProps = {
  root: number; box: string; frets: number[]; blues: boolean; intervals: boolean; hidden: boolean; connect: boolean;
  pathString?: number; sounding: string; onPlay: (string: number, fret: number) => void;
  quiz?: { target: QuizTarget; revealed: boolean } | null;
  /** Map mode: show every scale note, dimming those outside these boxes (0–4). Empty = all boxes. */
  selection?: number[];
  compact?: boolean;
};

export function Fretboard({ root, box, frets, blues, intervals, hidden, connect, pathString, sounding, onPlay, quiz, selection, compact }: FretboardProps) {
  const boxNum = box === 'all' ? -1 : +box;
  return (
    <div className="board-scroll" tabIndex={0} aria-label="Scroll fretboard horizontally">
      <div className={'fretboard' + (compact ? ' compact' : '')} style={{ gridTemplateColumns: `34px repeat(${frets.length},minmax(${compact ? 36 : 43}px,1fr))` }}>
        <span />
        {frets.map(f => <span className={'fret-number ' + (f === 12 || f === 24 ? 'octave' : '')} key={f}>{f}</span>)}
        {TUNING.map((_, s) => (
          <div className="string-row" key={s}>
            <span className="string-name">{STRING_NAMES[s]}</span>
            {frets.map(f => {
              const d = degree(s, f, root);
              const scale = isScaleNote(s, f, root, blues);
              const primary = !!selection || boxNum < 0 || inPosition(s, f, root, boxNum, blues);
              const neighbor = boxNum >= 0 && connect && inPosition(s, f, root, (boxNum + 1) % 5, blues);
              const dimmed = !!selection?.length && !selection.some(b => inPosition(s, f, root, b, blues));
              const isTarget = !!quiz && quiz.target.string === s && quiz.target.fret === f;
              const on = scale && (primary || neighbor || isTarget);
              const name = NOTES[noteAt(s, f)];
              const concealed = (hidden || !!quiz) && !(isTarget && quiz?.revealed);
              const label = isTarget && !quiz?.revealed ? '?' : concealed ? '·' : intervals ? DEGREES[d] : name;
              const cls = ['note', d === 0 && 'root', d === 6 && 'blue', !primary && !isTarget && 'neighbor', dimmed && 'dimmed',
                concealed && !isTarget && 'hidden-note', isTarget && 'quiz-target', pathString === s && 'path-note',
                sounding === `${s}-${f}` && 'sounding'].filter(Boolean).join(' ');
              return (
                <div key={f} className={'fret-cell ' + (f === 0 ? 'nut ' : '') + (f === 12 ? 'octave-cell' : '')}>
                  <span className="string-line" style={{ height: 1 + s * 0.35 }} />
                  {on && (
                    <button type="button" className={cls} onClick={() => onPlay(s, f)}
                      aria-label={`String ${STRING_NAMES[s]}, fret ${f}${concealed ? '' : `, ${name}, ${d === 0 ? 'root' : DEGREES[d]}`}${isTarget ? ', quiz note' : ''}`}>
                      {label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <span />
        {frets.map(f => <span className="inlay" key={f}>{INLAYS.includes(f) ? '●' : f === 12 || f === 24 ? '● ●' : ''}</span>)}
      </div>
    </div>
  );
}
