const fs=require('fs');
const MIG=fs.readFileSync('supabase/migrations/0047_exercise_catalog_variants.sql','utf8');
const mus={}; const re=/\('([a-z0-9_]+)','([a-z_]+)',([0-9.]+),'(direct|indirect)'\)/g; let m;
const musBlock=MIG.slice(MIG.indexOf('insert into public.exercise_muscles'), MIG.indexOf('insert into public.exercise_equipment'));
while((m=re.exec(musBlock))){ (mus[m[1]]=mus[m[1]]||[]).push({muscle_key:m[2],weight:+m[3],involvement:m[4]}); }
global.window=global; global.ORVIA={};
const PM=require(process.cwd()+'/app/js/profile-model.js');
const GV=require(process.cwd()+'/app/js/gym-volume.js');
const SP=require(process.cwd()+'/app/js/engine/strength-profile.js');
const PROG=require(process.cwd()+'/app/js/engine/strength-progression.js');
GV.setCatalog(Object.keys(mus).map(s=>({slug:s, muscles:Object.fromEntries(mus[s].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}]))})));
const rows=fs.readFileSync('_to_delete/s2/data.txt','utf8').trim().split('\n').map(l=>l.split('|'));
const bySid={};
for(const [tag,sid,slug,name,sets] of rows){
  const S=bySid[sid]||(bySid[sid]={startedAt:tag+'T16:00:00.000Z', workoutId:sid, date:tag, exercises:[]});
  const parsed=(sets||'').trim()? sets.trim().split(/\s+/).map((tok,i)=>{
    const t=tok.replace('!',''); const done=!tok.includes('!');
    const type=t.includes('#')? t.split('#')[1] : 'working'; const core=t.split('#')[0];
    const [w,rest]=core.split('x'); const [r,rir]=rest.split('@');
    return {setNumber:i+1, weight: w==='-'?null:+w, reps: r==='-'?null:+r, rir: rir!=null?+rir:null, setType:type, completed:done};
  }):[];
  S.exercises.push({exerciseNameSnapshot:name, slug:slug, sets:parsed,
    muscles: mus[slug]? Object.fromEntries(mus[slug].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}])):null});
}
const snaps=Object.values(bySid).sort((a,b)=>a.date<b.date?-1:1);
// Gewichtsreihe wie aus dem Morgenbericht: Juni 73, Juli 72, August 71,5, September 71
const morning=[{date:'2026-06-20',kg:73.0},{date:'2026-07-05',kg:72.4},{date:'2026-07-20',kg:72.0},
  {date:'2026-08-05',kg:71.6},{date:'2026-08-20',kg:71.3},{date:'2026-09-15',kg:71.0}];
const series=PM.weightSeries({}, morning);
console.log('Reihe:', series.map(e=>e.date+':'+e.kg).join(' '));
console.log('bodyweightAt 23.06.:', JSON.stringify(PM.bodyweightAt('2026-06-23',series)));
console.log('bodyweightAt 23.08.:', JSON.stringify(PM.bodyweightAt('2026-08-23',series)));
const out=SP.build(snaps,{today:'2026-09-16', gymVolume:GV, strengthProgression:PROG, bodyweightSeries:series});
console.log('heutiges Gewicht laut Modell:', JSON.stringify(out.bodyweight));
const K=out.exerciseModel(out.exercises.filter(E=>/Klimm/.test(E.name))[0].key);
console.log('\nKlimmzüge: mode='+K.mode+'  n='+K.count);
console.log('  Serie:', K.series.map(p=>p.date.slice(5)+':'+p.value).join(' '));
console.log('  aktuell='+K.current+'  delta='+JSON.stringify(K.delta));
console.log('  PRs:', K.prs.map(p=>p.kind+'='+p.value+' '+(p.unit||'')).join(' · '));

const E=out.exercises.filter(E=>/Klimm/.test(E.name))[0];
console.log('\nDEBUG Sessions:');
E.sessions.forEach(s=>console.log(' ', s.date, 'workSets='+s.workSets, 'e1rm='+s.e1rm, 'maxReps='+s.maxReps,
  'sets='+JSON.stringify(s.sets.map(x=>({w:x.weight,r:x.reps,work:x.work})))));
