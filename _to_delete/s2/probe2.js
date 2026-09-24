global.window=global; global.ORVIA={};
const P=process.cwd()+'/app/js/';
ORVIA.activityNormalize=require(P+'activity-normalize.js');
ORVIA.trainingDomain={normSport:v=>String(v||'').toLowerCase(),normSportStrict:v=>String(v||'').toLowerCase()};
try{require(P+'onboarding/onboarding-sports-logic.js');}catch(e){}
require(P+'activity-config.js');
require(P+'engine/load-profile.js');
const LH=require(P+'engine/load-history.js');
const CA=require(P+'engine/capacity-adapter.js');
const RR=require(P+'engine/race-result.js');
const GP=require(P+'engine/goal-portfolio.js');
const RCF=require(P+'engine/running-capacity-factory.js');
const A={ id:'srv-1', clientRecordId:'a:1', userId:'u1', sportId:'running', source:'garmin',
  sourceRecordId:'g1', startedAt:'2026-09-10T16:00:00.000Z', endedAt:'2026-09-10T17:00:00.000Z',
  durationSeconds:3600, status:'completed', summary:{distanceKm:10, avgHr:150}, metrics:{}, syncStatus:'synced' };
const TODAY='2026-09-16';
const line=(n,s,d)=>console.log((s?'✅':'❌')+' '+n+(d?'  — '+d:''));
// capacity-adapter mit vorhandener activityConfig
const cap=CA.buildPerSport([A],{today:TODAY});
line('capacity-adapter.buildPerSport', cap && cap.ok && cap.perSport && Object.keys(cap.perSport).length>0,
  cap&&cap.ok?('sports='+Object.keys(cap.perSport).join(',')):JSON.stringify(cap).slice(0,120));
// race-result mit passendem Ziel (10 km)
const g10={id:'g1',category:'race_10k',distanceKm:10,targetDate:'2026-09-10',targetValue:3000,unit:'s',sportId:'running'};
const m=RR.match(g10,[A],{});
line('race-result.match', !!m, m?('id='+m.activityId+' '+m.distanceKm+'km'):'kein Treffer');
// activity-config Wochenwahrheit
const AC=ORVIA.activityConfig;
const units=AC.dailyLoadUnits? AC.dailyLoadUnits([A],{today:TODAY,timezone:'UTC'}) : null;
line('activity-config.dailyLoadUnits', !!(units && (Array.isArray(units)?units.length:Object.keys(units).length)), JSON.stringify(units).slice(0,140));
const wk=AC.weeklyActivityTotals? AC.weeklyActivityTotals([A],{today:TODAY,timezone:'UTC'}):null;
line('activity-config.weeklyActivityTotals', !!wk, JSON.stringify(wk).slice(0,160));
// goal-portfolio
try{ const ev=GP.evidenceFromActivities([A],{today:TODAY});
  line('goal-portfolio.evidenceFromActivities', !!ev, JSON.stringify(ev).slice(0,140)); }catch(e){ line('goal-portfolio.evidenceFromActivities',false,e.message); }
// running-capacity-factory
try{ const ev2=RCF.evidenceFromActivities([A],{today:TODAY});
  line('running-capacity-factory.evidenceFromActivities', !!ev2, JSON.stringify(ev2).slice(0,140)); }catch(e){ line('running-capacity-factory.evidenceFromActivities',false,e.message); }
