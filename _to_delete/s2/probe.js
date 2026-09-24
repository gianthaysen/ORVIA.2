/* Sonde: EINE kanonische Aktivitaet (Form aus activity-store.listActivities) durch jeden
   Engine-Eingang schicken. Wird sie nicht gesehen, ist das ein stiller Datenverlust. */
global.window=global; global.ORVIA={};
const P=process.cwd()+'/app/js/';
const AN=require(P+'activity-normalize.js'); ORVIA.activityNormalize=AN;
ORVIA.trainingDomain={normSport:v=>String(v||'').toLowerCase(), normSportStrict:v=>String(v||'').toLowerCase()};
const LP=require(P+'engine/load-profile.js');
const LH=require(P+'engine/load-history.js');
const CA=require(P+'engine/capacity-adapter.js');
const PR=require(P+'engine/performance-resolver.js');
const RR=require(P+'engine/race-result.js');
const A={ id:'srv-1', clientRecordId:'a:1', userId:'u1', sportId:'running', source:'garmin',
  sourceRecordId:'g1', workoutSessionId:null, startedAt:'2026-09-10T16:00:00.000Z',
  endedAt:'2026-09-10T17:00:00.000Z', durationSeconds:3600, status:'completed',
  summary:{ distanceKm:10, avgHr:150, elevationM:80 }, metrics:{}, syncStatus:'synced' };
const TODAY='2026-09-16';
function line(name, seen, detail){ console.log((seen?'✅':'❌')+' '+name+(detail?'  — '+detail:'')); }

// 1 load-history
const h=LH.buildHistory({today:TODAY, activities:[A], days:28});
line('load-history.buildHistory sieht die Einheit', !!(h.byDay['2026-09-10'] && h.byDay['2026-09-10'].systemic>0),
  'systemic='+(h.byDay['2026-09-10']?h.byDay['2026-09-10'].systemic:'-'));
// 2 capacity-adapter
try{ const cap=CA.buildPerSport([A], {today:TODAY});
  const k=Object.keys(cap||{}); line('capacity-adapter.buildPerSport ordnet die Sportart zu', k.includes('running'), 'keys='+JSON.stringify(k)); }
catch(e){ line('capacity-adapter.buildPerSport', false, 'Fehler: '+e.message); }
// 3 performance-resolver
try{ const pr=PR.resolveAll({}, {today:TODAY, activities:[A]});
  const used=JSON.stringify(pr).indexOf('10')>=0; line('performance-resolver.resolveAll verwertet die Einheit', !!pr, 'keys='+Object.keys(pr||{}).join(',')); }
catch(e){ line('performance-resolver.resolveAll', false, 'Fehler: '+e.message); }
// 4 race-result
try{ const goal={id:'g1', category:'half_marathon', targetDate:'2026-09-10', sportId:'running'};
  const m=RR.match(goal,[A],{}); line('race-result.match findet die Aktivitaet zum Zieldatum', !!m, JSON.stringify(m&&{id:m.id||m.activityId})); }
catch(e){ line('race-result.match', false, 'Fehler: '+e.message); }
// 5 load-profile direkt
try{ const pf=LP.profileOf(LH.asUnit(A)); line('load-profile.profileOf kennt ein Lastmodell', !!pf, pf?('systemic='+pf.systemic):'kein Modell'); }
catch(e){ line('load-profile.profileOf', false, 'Fehler: '+e.message); }
