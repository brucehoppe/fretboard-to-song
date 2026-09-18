import { z } from 'zod';
import { database } from '@/lib/database';
const section=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),bpm:z.number().int().min(30).max(300),status:z.enum(['New','Learning','Steady']),transition:z.boolean()});
const song=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(120),artist:z.string().max(120),key:z.number().int().min(0).max(11),target:z.number().int().min(30).max(300),sections:z.array(section).max(40),notes:z.string().max(4000),runs:z.number().int().nonnegative(),lastRun:z.string().max(50),revision:z.number().int().nonnegative()});
const session=z.object({id:z.string().uuid(),exercise:z.string().min(1).max(120),key:z.number().int().min(0).max(11),rating:z.enum(['Needs work','Getting there','Comfortable']),date:z.string().datetime()});
const lick=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(120),key:z.number().int().min(0).max(11),box:z.enum(['all','0','1','2','3','4']),technique:z.string().max(80),tab:z.string().max(2000),notes:z.string().max(4000),status:z.enum(['Idea','Practising','Learned']),songId:z.string().uuid().or(z.literal('')),revision:z.number().int().nonnegative()});
export async function GET() { try { const db=database(); const [s,h,l]=await Promise.all([db.prepare('SELECT data, revision FROM songs ORDER BY updated_at DESC').all<{data:string;revision:number}>(),db.prepare('SELECT data FROM sessions ORDER BY created_at DESC LIMIT 30').all<{data:string}>(),db.prepare('SELECT data, revision FROM licks ORDER BY updated_at DESC').all<{data:string;revision:number}>()]); return Response.json({songs:s.results.map(r=>({...JSON.parse(r.data),revision:r.revision})),sessions:h.results.map(r=>JSON.parse(r.data)),licks:l.results.map(r=>({...JSON.parse(r.data),revision:r.revision}))},{headers:{'Cache-Control':'no-store'}}); } catch(e){console.error(e);return Response.json({error:'Your saved practice is unavailable. Please retry.'},{status:503});} }
export async function POST(req:Request){
 try {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host!==new URL(req.url).host) return Response.json({error:'Invalid origin'},{status:403});
  const raw=await req.text(); if(raw.length>25000) return Response.json({error:'Entry too large'},{status:413});
  const body=JSON.parse(raw); const db=database();
  if(body.type==='song'){
   const s=song.parse(body.data); const now=new Date().toISOString();
   const result=s.revision===0 ? await db.prepare('INSERT OR IGNORE INTO songs (id,data,revision,updated_at) VALUES (?,?,1,?)').bind(s.id,JSON.stringify(s),now).run() : await db.prepare('UPDATE songs SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(s),now,s.id,s.revision).run();
   if(!result.meta.changes) return Response.json({error:'This song changed in another tab. Copy any unsaved notes, then reload before editing.'},{status:409});
   return Response.json({revision:s.revision+1});
  }
  if(body.type==='session') {const s=session.parse(body.data);await db.prepare('INSERT OR IGNORE INTO sessions (id,data,created_at) VALUES (?,?,?)').bind(s.id,JSON.stringify(s),s.date).run();return Response.json({ok:true});}
  if(body.type==='lick') { const l=lick.parse(body.data); const now=new Date().toISOString(); const result=l.revision===0 ? await db.prepare('INSERT OR IGNORE INTO licks (id,data,revision,updated_at) VALUES (?,?,1,?)').bind(l.id,JSON.stringify(l),now).run() : await db.prepare('UPDATE licks SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(l),now,l.id,l.revision).run(); if(!result.meta.changes)return Response.json({error:'This lick changed in another tab. Reload before editing.'},{status:409}); return Response.json({revision:l.revision+1}); }
  return Response.json({error:'Unknown action'},{status:400});
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError) return Response.json({error:'Check your entry: names are required and tempos must be 30–300 BPM.'},{status:400});console.error(e);return Response.json({error:'Could not save. Your edits are still here; please retry.'},{status:503});}
}
