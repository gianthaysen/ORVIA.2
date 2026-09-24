/* S2-Pruefstand: echte Saetze -> strength-profile.js, unabhaengig nachgerechnet. */
const fs=require('fs');
const MIG=fs.readFileSync('supabase/migrations/0047_exercise_catalog_variants.sql','utf8');
// Katalog: Muskeln je slug aus der Migration
const mus={}; const re=/\('([a-z0-9_]+)','([a-z_]+)',([0-9.]+),'(direct|indirect)'\)/g; let m;
const musBlock=MIG.slice(MIG.indexOf('insert into public.exercise_muscles'), MIG.indexOf('insert into public.exercise_equipment'));
while((m=re.exec(musBlock))){ (mus[m[1]]=mus[m[1]]||[]).push({muscle_key:m[2],weight:+m[3],involvement:m[4]}); }
global.window=global; global.ORVIA={};
const GV=require(process.cwd()+'/app/js/gym-volume.js');
const SP=require(process.cwd()+'/app/js/engine/strength-profile.js');
const PROG=require(process.cwd()+'/app/js/engine/strength-progression.js');
GV.setCatalog(Object.keys(mus).map(s=>({slug:s, muscles:Object.fromEntries(mus[s].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}]))})));
// Daten
const rows=fs.readFileSync('_to_delete/s2/data.txt','utf8').trim().split('\n').map(l=>l.split('|'));
const bySid={};
for(const [tag,sid,slug,name,sets] of rows){
  const S=bySid[sid]||(bySid[sid]={startedAt:tag+'T16:00:00.000Z', workoutId:sid, date:tag, exercises:[]});
  const parsed=(sets||'').trim()? sets.trim().split(/\s+/).map((tok,i)=>{
    const t=tok.replace('!','' ); const done=!tok.includes('!');
    const type=t.includes('#')? t.split('#')[1] : 'working';
    const core=t.split('#')[0];
    const [w,rest]=core.split('x'); const [r,rir]=rest.split('@');
    return {setNumber:i+1, weight: w==='-'?null:+w, reps: r==='-'?null:+r, rir: rir!=null?+rir:null, setType:type, completed:done};
  }):[];
  S.exercises.push({exerciseNameSnapshot:name, slug:slug, sets:parsed,
    muscles: mus[slug]? Object.fromEntries(mus[slug].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}])):null});
}
const snaps=Object.values(bySid).sort((a,b)=>a.date<b.date?-1:1);
const TODAY='2026-09-16';
const BW=process.argv[2]?+process.argv[2]:null;
const out=SP.build(snaps,{today:TODAY, gymVolume:GV, strengthProgression:PROG, bodyweightKg:BW});
console.log('EINHEITEN im Snapshot:', snaps.length, '| Uebungen gesamt:', out.exercises.length);
console.log('\n=== UEBUNGEN ===');
out.exercises.forEach(E=>{
  console.log([E.name.padEnd(24), 'grp='+String(E.group).padEnd(5), 'mode='+String(E.mode).padEnd(5),
    'n='+String(E.count).padStart(2), E.ready?'KURVE':'(n/6)',
    'aktuell='+(E.current!=null?E.current:'-'),
    'delta='+(E.delta? JSON.stringify(E.delta):'-'),
    E.stagnant?'STAGNATION':''].join(' '));
  if(E.prs&&E.prs.length) console.log('     PR:', E.prs.map(p=>p.kind+'='+p.value+(p.unit?' '+p.unit:'')+(p.detail?' ('+p.detail+')':'')).join(' · '));
});
console.log('\n=== GRUPPEN (Saetze/Tonnage) ===');
Object.keys(out.groups).forEach(k=>{const g=out.groups[k];
  console.log(k.padEnd(6), 'Saetze Woche='+g.setsWeek, '28T='+g.sets28, '56T='+g.sets56, 'Tonnage Woche='+g.tonnageWeek, 'Schnitt4W='+g.tonnageAvg4, 'letzte TW='+g.tonnageLast);});
console.log('meta:', JSON.stringify(out.groups._meta||out.meta||null));
console.log('\n=== BALANCE ==='); console.log(JSON.stringify(out.balance,null,1));
console.log('\n=== MUSKELN (7 Tage) ==='); console.log(JSON.stringify(out.muscles,null,1).slice(0,900));

console.log('\n=== MODELLE (nur ready) ===');
out.exercises.filter(E=>E.ready).forEach(E=>{
  const M=out.exerciseModel(E.key);
  console.log('\n--- '+M.name+'  ['+M.group+', mode='+M.mode+', n='+M.count+']');
  console.log('  Serie:', M.series.map(p=>p.date.slice(5)+':'+p.value+(p.test?'(T)':'')).join(' '));
  console.log('  aktuell='+M.current+'  delta='+JSON.stringify(M.delta)+'  stagnant='+M.stagnant+'  relativ='+JSON.stringify(M.relative));
  console.log('  letztes Schema:', M.lastScheme, '| Methode:', M.method);
  console.log('  PRs:', M.prs.map(p=>p.kind+'='+p.value+' '+(p.unit||'')+(p.detail?' ('+p.detail+')':'')+(p.date?' @'+p.date:'')+(p.week?' @'+p.week:'')).join(' · '));
});
