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
const morning=[{date:'2026-06-20',kg:73.0},{date:'2026-07-20',kg:72.0},{date:'2026-08-20',kg:71.3},{date:'2026-09-15',kg:71.0}];
const series=PM.weightSeries({}, morning);
const out=SP.build(snaps,{today:'2026-09-16', gymVolume:GV, strengthProgression:PROG, bodyweightSeries:series});
console.log('Gruppen:', out.exercises.map(E=>E.name+'='+E.group).join(' | '));
out.exercises.filter(E=>E.ready).forEach(E=>{
  const M=out.exerciseModel(E.key);
  console.log('\n--- '+M.name+' ['+M.mode+']');
  if(M.mode==='load'){
    console.log('  Rohdifferenz (alt):', M.delta? ('+'+M.delta.kg+' kg in '+M.delta.weeks+' W ab '+M.delta.from):'-');
    console.log('  TREND (neu):', M.trend && M.trend.ok ? (M.trend.per4Weeks+' kg je 4 Wochen · '+M.trend.points+' Punkte über '+M.trend.spanDays+' Tage · Vertrauen='+M.trend.confidence+(M.trend.implausible?' UNPLAUSIBEL':'')) : JSON.stringify(M.trend), '| Pause '+M.staleDays+' Tage');
    console.log('  PRs:', M.prs.map(p=>p.kind+'='+p.value).join(' · '));
    console.log('  Ausbelastung bekannt:', M.effortKnown+'/'+(M.effortKnown+M.effortUnknown), '| stagnant='+M.stagnant+(M.stagnantBy?' ('+M.stagnantBy+')':''));
  } else {
    console.log('  aktuell='+M.current+' Wdh. @ +'+M.currentLoadKg+' kg | delta='+JSON.stringify(M.delta)+(M.deltaBlocked?' BLOCKIERT: '+M.deltaBlocked:''));
    console.log('  PRs:', M.prs.map(p=>p.value+' '+p.unit+' @ +'+p.addedKg+' kg').join(' · '));
  }
});

console.log('
console.log(JSON.stringify(out.balance));
