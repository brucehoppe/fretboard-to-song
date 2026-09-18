export const NOTES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
export const TUNING = [64,59,55,50,45,40];
export const MINOR = [0,3,5,7,10];
export const DEGREES: Record<number,string> = {0:'R',3:'♭3',5:'4',7:'5',10:'♭7'};
const SHAPES = [
 [[0,3],[0,2],[0,2],[0,2],[0,3],[0,3]],
 [[3,5],[2,5],[2,5],[2,4],[3,5],[3,5]],
 [[5,7],[5,7],[5,7],[4,7],[5,8],[5,7]],
 [[7,10],[7,10],[7,9],[7,9],[8,10],[7,10]],
 [[10,12],[10,12],[9,12],[9,12],[10,12],[10,12]],
];
export function degree(string:number,fret:number,root:number) { return (TUNING[string]+fret-root+120)%12; }
export function inBox(string:number,fret:number,root:number,box:number) {
 const offset=(root-4+12)%12;
 return SHAPES[box][5-string].some(n=>(fret-offset-n)%12===0);
}
export type Section = { id:string; name:string; bpm:number; status:'New'|'Learning'|'Steady'; transition:boolean };
export type Song = {id:string; title:string; artist:string; key:number; target:number; sections:Section[]; notes:string; runs:number; lastRun:string; revision:number};
export type Session = {id:string; exercise:string; key:number; rating:string; date:string};
export type Lick = {id:string; title:string; key:number; box:string; technique:string; tab:string; notes:string; status:'Idea'|'Practising'|'Learned'; songId:string; revision:number};

export type LickMove = 'question'|'bend'|'slide'|'legato'|'descending'|'repeat';
export type LickIdea = {title:string; technique:string; purpose:string; steps:string[]; intervals:string; tab:string; notes:string; events:{string:number;fret:number}[]; development:string};

const at = (fret:number, shift:number) => fret + shift;

/** A set of small, playable E-minor box-one phrases transposed to every minor key. */
export function buildLickIdea(key:number, move:LickMove, variation=0, maxFret=24):LickIdea {
  let shift=(key-4+12)%12;
  while(shift>maxFret-17) shift-=12; // Keep the longest bend phrase inside the selected neck.
  const f=(n:number)=>at(n,shift);
  const developments=['Leave the last beat empty, then listen to the silence.','Repeat the final note, but use a different rhythm.','End one string lower and compare the colour.'];
  const leaveSpace=developments[variation%developments.length];
  const common=`Play this in ${NOTES[key]} minor, box 1 around fret ${f(12)}. ${leaveSpace}`;
  const ideas:Record<LickMove,LickIdea>={
    question:{title:'Ask, then answer',technique:'Short phrase · space · response',purpose:'A lick feels intentional when the second phrase changes the first one instead of adding more notes.',steps:['Play the first two notes as a question.','Rest for one beat.','Answer lower and finish on the root.'],intervals:'5 → ♭7  |  ♭3 → R',tab:`e|----------------${f(12)}--|\nB|--${f(12)}--${f(15)}--------------|\nG|------------${f(14)}--${f(12)}----|`,notes:common,events:[{string:1,fret:f(12)},{string:1,fret:f(15)},{string:2,fret:f(14)},{string:2,fret:f(12)},{string:0,fret:f(12)}],development:leaveSpace},
    bend:{title:'Bend into home',technique:'Whole-step bend · release · root',purpose:'The bend creates tension; the root gives the line a clear landing place.',steps:['Bend the ♭7 up one whole step.','Release it slowly.','Answer on the root without rushing.'],intervals:'♭7 ↑ R → ♭7 → R',tab:`e|----------------${f(12)}--|\nB|--${f(15)}b${f(17)}r${f(15)}----------|\nG|------------------------|`,notes:common,events:[{string:1,fret:f(15)},{string:1,fret:f(17)},{string:1,fret:f(15)},{string:0,fret:f(12)}],development:leaveSpace},
    slide:{title:'Slide into the third',technique:'Slide · hold · answer',purpose:'A slide makes the destination note sound chosen, then the response gives it direction.',steps:['Slide from the 4th into the 5th.','Let the 5th ring for one beat.','Answer with ♭3 then root.'],intervals:'4 / 5 → ♭3 → R',tab:`e|----------------${f(12)}--|\nB|------------------------|\nG|--${f(12)}/${f(14)}--${f(12)}------------|`,notes:common,events:[{string:2,fret:f(12)},{string:2,fret:f(14)},{string:2,fret:f(12)},{string:0,fret:f(12)}],development:leaveSpace},
    legato:{title:'Legato answer',technique:'Hammer-on · pull-off · resolve',purpose:'Hammer-ons and pull-offs create a connected vocal line when the picked note still has a clear destination.',steps:['Pick the first note firmly.','Hammer on, then pull off without speeding up.','Move to the root and let it ring.'],intervals:'R → ♭3 → R → 5 → R',tab:`e|----------------${f(12)}--|\nB|--${f(12)}h${f(15)}p${f(12)}--${f(15)}----------|\nG|------------------------|`,notes:common,events:[{string:1,fret:f(12)},{string:1,fret:f(15)},{string:1,fret:f(12)},{string:1,fret:f(15)},{string:0,fret:f(12)}],development:leaveSpace},
    descending:{title:'Descend and resolve',technique:'Descending sequence',purpose:'Descending pentatonic lines become musical when they know where to stop.',steps:['Play the six notes evenly.','Do not speed up as you descend.','Hold the final root for a full beat.'],intervals:'♭3 → R → ♭7 → 5 → 4 → R',tab:`e|--${f(15)}--${f(12)}----------------|\nB|------------${f(15)}--${f(12)}--------|\nG|----------------------${f(14)}--${f(12)}--|`,notes:common,events:[{string:0,fret:f(15)},{string:0,fret:f(12)},{string:1,fret:f(15)},{string:1,fret:f(12)},{string:2,fret:f(14)},{string:2,fret:f(12)}],development:leaveSpace},
    repeat:{title:'Repeat one idea',technique:'Motif · rhythmic change',purpose:'A good lick can come from four notes if you repeat them with a new ending.',steps:['Play the first three notes twice.','Change only the final note on the second pass.','Finish on the root.'],intervals:'R → ♭3 → 4  |  R → ♭3 → R',tab:`e|----------------${f(12)}------${f(12)}--|\nB|--${f(12)}--${f(15)}--${f(12)}--${f(15)}----------|\nG|--------------------------------|`,notes:common,events:[{string:1,fret:f(12)},{string:1,fret:f(15)},{string:0,fret:f(12)},{string:1,fret:f(12)},{string:1,fret:f(15)},{string:0,fret:f(12)}],development:leaveSpace},
  };
  return ideas[move];
}
