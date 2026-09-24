/* Teaser mit echten Daten pruefen (ohne DOM): collect() wird umgangen, Modell direkt. */
const fs=require('fs'), vm=require('vm');
const MIG=fs.readFileSync('supabase/migrations/0047_exercise_catalog_variants.sql','utf8');
const mus={}; const re=/\('([a-z0-9_]+)','([a-z_]+)',([0-9.]+),'(direct|indirect)'\)/g; let m;
const mb=MIG.slice(MIG.indexOf('insert into public.exercise_muscles'), MIG.indexOf('insert into public.exercise_equipment'));
while((m=re.exec(mb))){ (mus[m[1]]=mus[m[1]]||[]).push({muscle_key:m[2],weight:+m[3],involvement:m[4]}); }
const ctx={console}; ctx.window=ctx; ctx.globalThis=ctx; ctx.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
vm.createContext(ctx); const run=f=>vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
run('app/js/i18n.js'); run('app/locales/de.js');
ctx.ORVIA.trainingDomain={normSport:v=>String(v||'').toLowerCase(),normSportStrict:v=>String(v||'').toLowerCase()};
run('app/js/activity-normalize.js'); run('app/js/profile-model.js'); run('app/js/gym-volume.js');
run('app/js/engine/strength-progression.js'); run('app/js/engine/strength-profile.js'); run('app/js/screens/strength-profile.js');
const GV=ctx.ORVIA.gymVolume, SP=ctx.ORVIA.strengthProfile;
GV.setCatalog(Object.keys(mus).map(s=>({slug:s,muscles:Object.fromEntries(mus[s].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}]))})));
const rows=fs.readFileSync('_to_delete/s2/data.txt','utf8').trim().split('\n').map(l=>l.split('|'));
const bySid={};
for(const [tag,sid,slug,name,sets] of rows){
  const S=bySid[sid]||(bySid[sid]={startedAt:tag+'T16:00:00.000Z',workoutId:sid,date:tag,exercises:[]});
  const parsed=(sets||'').trim()? sets.trim().split(/\s+/).map((tok,i)=>{const t=tok.replace('!','');const done=!tok.includes('!');
    const type=t.includes('#')?t.split('#')[1]:'working';const core=t.split('#')[0];const [w,rest]=core.split('x');const [r,rir]=rest.split('@');
    return {setNumber:i+1,weight:w==='-'?null:+w,reps:r==='-'?null:+r,rir:rir!=null?+rir:null,setType:type,completed:done};}):[];
  S.exercises.push({exerciseNameSnapshot:name,slug,sets:parsed,muscles:mus[slug]?Object.fromEntries(mus[slug].map(x=>[x.muscle_key,{weight:x.weight,involvement:x.involvement}])):null});
}
const snaps=Object.values(bySid).sort((a,b)=>a.date<b.date?-1:1);
const series=ctx.ORVIA.profileModel.weightSeries({},[{date:'2026-09-17',kg:71}]);
const model=SP.build(snaps,{today:'2026-09-18',gymVolume:GV,strengthProgression:ctx.ORVIA.strengthProgression,bodyweightSeries:series});
// Auswahl-Logik des Teasers nachbilden
let best=null,bestEm=null;
model.exercises.forEach(E=>{ if(!E.ready||E.mode!=='load')return; const em=model.exerciseModel(E.key); if(!em||em.current==null)return;
  const tr=em.trend&&em.trend.ok&&!em.trend.implausible?em.trend:null; const sc=tr?tr.per4Weeks:-Infinity;
  const bs=(bestEm&&bestEm.trend&&bestEm.trend.ok&&!bestEm.trend.implausible)?bestEm.trend.per4Weeks:-Infinity;
  if(!best||sc>bs){best=E;bestEm=em;} });
console.log('Teaser-Uebung:', bestEm.name, '| aktuell', bestEm.current,
  '| Trend', bestEm.trend&&bestEm.trend.ok? (bestEm.trend.per4Weeks+' kg je 4 Wochen ('+bestEm.trend.confidence+(bestEm.trend.implausible?', unplausibel':'')+')') : JSON.stringify(bestEm.trend));
console.log('Text:', (bestEm.trend&&bestEm.trend.confidence==='low'?'≈':'')+(bestEm.trend.per4Weeks>=0?'+':'−')+String(Math.abs(bestEm.trend.per4Weeks)).replace('.',',')+' kg je 4 Wochen');
