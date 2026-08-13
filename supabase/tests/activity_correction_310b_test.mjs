/* ORVIA · v8-310b — drei getrennte Korrekturwege
   1) Activity loeschen => Tombstone
   2) Plan-Link loesen => Activity bleibt
   3) plan_done ruecknehmen => nur Marker verschwindet
   Dazu die Ursache des Nutzerbefunds: freies Gym erfuellt nie automatisch
   eine gleichartige Planeinheit; geplanter Hub-Start waehlt sportgenau. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE=dirname(fileURLToPath(import.meta.url));
const APPREL=existsSync(new URL('../../js/',import.meta.url))?'../../':'../../app/';
const JS=new URL(APPREL+'js/',import.meta.url);
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i!=null?'  — '+i:''));c?pass++:fail++;};
const sec=n=>console.log('\n── '+n+' '+ '─'.repeat(Math.max(1,58-n.length)));
function sliceBalanced(src,needle){
  const s=src.indexOf(needle);if(s<0)throw new Error('nicht gefunden: '+needle);
  const b=src.indexOf('{',s);let d=0,q=null,esc=false;
  for(let i=b;i<src.length;i++){const ch=src[i];
    if(q){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===q)q=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){q=ch;continue;}if(ch==='{')d++;else if(ch==='}'&&--d===0)return src.slice(s,i+1);
  }throw new Error('unbalanciert: '+needle);
}

const mem={};let failWrites=false;
globalThis.localStorage={
  getItem:k=>(k in mem?mem[k]:null),
  setItem:(k,v)=>{if(failWrites)throw new Error('quota');mem[k]=String(v);},
  removeItem:k=>{delete mem[k];}
};
globalThis.ORVIA={user:{id:'u310b'}};
globalThis.ORVIA.activityNormalize=(await import(new URL('activity-normalize.js',JS))).default;
globalThis.ORVIA.trainingDomain={normSport:v=>String(v||'').toLowerCase()};
const S=(await import(new URL('activity-store.js',JS))).default;
const reset=()=>{Object.keys(mem).forEach(k=>delete mem[k]);failWrites=false;};

sec('A · Plan-Link loesen behaelt die Activity');
reset();
const OCC='po:2026-08-10:ps:gym1';
const sess={id:'wg1',sport:'Gym',sport_key:'gym',status:'completed',local_date:'2026-08-10',started_at:'2026-08-10T18:00:00Z',finished_at:'2026-08-10T18:45:00Z',duration_min:45,session_rpe:6,planned_session_id:OCC};
const snap=[{workoutExercise:{exercise_id:'bench',order_index:0},exercise:{name:'Bankdruecken'},sets:[{set_number:1,weight:60,reps:10,completed:true}]}];
const made=S.upsertActivityFromWorkout(sess,snap,{syncStatus:'synced'}).activity;
const before={duration:made.durationSeconds,summary:JSON.stringify(made.summary),snapshot:JSON.stringify(made.workoutSnapshot),count:S.listActivities().length,tombs:S.tombstones().length};
ok('Ausgangsaktivitaet ist explizit verknuepft',S.planLinkOf(made)===OCC);
const stale=S.unlinkActivityFromPlan(made.clientRecordId,'po:anders');
ok('veraltete Ansicht darf keinen anderen Link loesen',!stale.ok&&stale.code==='plan_link_changed'&&S.planLinkOf(S.getActivityById(made.clientRecordId))===OCC);
const un=S.unlinkActivityFromPlan(made.clientRecordId,OCC);
const after=S.getActivityById(made.clientRecordId);
ok('Link wird als eigene Korrektur geloest',un.ok&&un.code==='unlinked'&&S.planLinkOf(after)===null);
ok('Activity bleibt exakt einmal erhalten',S.listActivities().length===before.count&&after.clientRecordId===made.clientRecordId);
ok('Dauer, Summary und Saetze bleiben erhalten',after.durationSeconds===before.duration&&JSON.stringify(after.summary)===before.summary&&JSON.stringify(after.workoutSnapshot)===before.snapshot);
ok('Link-Korrektur erzeugt KEINEN Tombstone',S.tombstones().length===before.tombs);
ok('Korrektur ist fuer Cloud-Sync pending',after.syncStatus==='pending');
ok('Provenance nennt alten Link und bewusste Loesung',after.metrics.planLinkCorrection.fromOccurrenceId===OCC&&after.metrics.planLinkCorrection.toOccurrenceId===null&&after.metrics.planLinkCorrection.reason==='user_unlinked');
S.upsertActivityFromWorkout(sess,snap,{syncStatus:'pending'});
const retried=S.getActivityById(made.clientRecordId);
ok('spaeterer Snapshot-Retry setzt den geloesten Link nicht zurueck',S.planLinkOf(retried)===null);
ok('Retry schreibt auch keinen widerspruechlichen Roh-Link neben die Korrektur',!Object.prototype.hasOwnProperty.call(retried.metrics||{},'plannedSessionId'));
ok('wiederholtes Loesen ist idempotent',S.unlinkActivityFromPlan(made.clientRecordId,OCC).code==='already_unlinked');

reset();
const p2=S.upsertActivityFromWorkout(Object.assign({},sess,{id:'wg2'}),snap,{}).activity;
const rawBefore=mem['orvia_activities_u310b'];failWrites=true;
const pf=S.unlinkActivityFromPlan(p2.clientRecordId,OCC);failWrites=false;
ok('Speicherfehler ist fail-closed',!pf.ok&&pf.code==='persist_failed'&&mem['orvia_activities_u310b']===rawBefore);

sec('B · Freies Training und sportgenaue Hub-Auswahl');
globalThis.window=globalThis;
(0,eval)(readFileSync(new URL('calc.js',JS),'utf8'));
const T='2026-08-10';
const rr=globalThis.Calc.resolvePlanActual(
  [{occurrenceId:OCC,sportId:'gym',localDate:T}],
  [{activityId:'free:gym',sportId:'gym',localDate:T,plannedSessionId:null}],
  {today:T,activitiesLoaded:true,planLoaded:true});
ok('freies Krafttraining am selben Tag erfuellt die Planeinheit NICHT',rr.results[0]&&rr.results[0].state!=='completed',rr.results[0]&&rr.results[0].state);

const ui=readFileSync(new URL('ui.js',JS),'utf8');
const selSrc=sliceBalanced(ui,'function gmPlannedStartSelection(');
const sb={window:null,ORVIA:{trainingDomain:{normSportStrict:v=>({gym:'gym',krafttraining:'gym',laufen:'running',radfahren:'cycling'}[String(v||'').toLowerCase()]||null)}},Date};sb.window=sb;
vm.createContext(sb);vm.runInContext(selSrc+'\nthis.pick=gmPlannedStartSelection;',sb);
const plan=Array.from({length:7},()=>[]);plan[2]=[{id:'ps:run',t:'Laufen'},{id:'ps:gym',t:'Gym'}];
let pick=sb.pick('Krafttraining',plan,2);
ok('Krafttraining waehlt die Gym-Einheit statt blind Index 0',pick.status==='unique'&&pick.ii===1&&pick.item.id==='ps:gym',JSON.stringify({status:pick.status,ii:pick.ii}));
ok('nicht geplante Sportart bleibt fail-closed',sb.pick('Radfahren',plan,2).status==='none');
plan[2].push({id:'ps:gym2',t:'Gym'});
ok('zwei passende Einheiten sind mehrdeutig statt blind verknuepft',sb.pick('Krafttraining',plan,2).status==='ambiguous');
const startSrc=sliceBalanced(ui,'function gmStartFromPreStart(');
ok('produktiver Start nutzt die sportgenaue Auswahl',/gmPlannedStartSelection\(sport\)/.test(startSrc)&&!/gmActTodayItem\(\)/.test(startSrc)&&!/startPlannedUnit\([^)]*,0,/.test(startSrc));

sec('C · plan_done ruecknehmen loescht nur den Marker');
const pdSrc=sliceBalanced(ui,'function planDoneMarkerFor(')+'\n'+sliceBalanced(ui,'function undoPlanDone(');
function pdCtx(saveResult=true){
  const DB={};DB[T]={mood:8,sessions:{Gym:{source:'plan_done',plannedSessionId:OCC,note:'marker'},Laufen:{source:'manual',dur:30,rpe:5},_ts:11}};
  const c={DB,save:()=>saveResult,renderDay:()=>{},renderWeekPlan:()=>{},renderGMPlan:()=>{},window:{dispatchEvent:()=>{}},CustomEvent:function(){},toast:()=>{},JSON,Object,Date};
  vm.createContext(c);vm.runInContext(pdSrc+'\nthis.find=planDoneMarkerFor;this.undo=undoPlanDone;',c);return c;
}
let c=pdCtx(true);const otherBefore=JSON.stringify(c.DB[T].sessions.Laufen);
ok('exakter plan_done-Marker wird gefunden',!!c.find('Gym',T,OCC));
const ur=c.undo('Gym',T,OCC);
ok('Ruecknahme erfolgreich',ur.ok&&ur.code==='unmarked');
ok('nur Marker weg; andere Session und Tag bleiben',!c.DB[T].sessions.Gym&&JSON.stringify(c.DB[T].sessions.Laufen)===otherBefore&&c.DB[T].mood===8);
ok('echte Session ist kein plan_done und nicht ruecknehmbar',c.undo('Laufen',T,OCC).code==='marker_not_found');
c=pdCtx(false);const dbBefore=JSON.stringify(c.DB);
ok('save-Fehler stellt den DB-Zustand bytegleich wieder her',c.undo('Gym',T,OCC).code==='save_failed'&&JSON.stringify(c.DB)===dbBefore);

sec('D · Sichtbare Wege und Trennung im Quelltext');
const act=readFileSync(new URL('activity.js',JS),'utf8');
ok('GM-Aktivitaetsseite bietet Link loesen UND Aktivitaet loeschen getrennt an',/Vom Wochenplan lösen/.test(ui)&&/Aktivität löschen/.test(ui));
const unlinkSrc=sliceBalanced(act,'function unlinkActivityPlanCanonical(');
const deleteSrc=sliceBalanced(act,'function deleteActivityCanonical(');
ok('Link loesen ruft keinen Loesch-/Tombstone-Pfad',/unlinkActivityFromPlan/.test(unlinkSrc)&&!/deleteActivity|Tombstone/.test(unlinkSrc));
ok('Aktivitaet loeschen bleibt am kanonischen Loeschpfad',/doDeleteActivity/.test(deleteSrc));
ok('Planresolver liest den korrigierten effektiven Link',/\(store&&store\.planLinkOf\)\?store\.planLinkOf\(a\)/.test(ui));
ok('plan_done-Ruecknahme ist kein Activity-Tombstone',!/deleteActivity|tombstone/i.test(pdSrc));

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
