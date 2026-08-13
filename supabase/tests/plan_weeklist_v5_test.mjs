/* ORVIA · E4 — Wochen-/Sessionliste als v5-Session-Cards, in place in renderWeekPlan.
   Kontrakt: exakt die Sessions aus activeWeekPlan() (Fixture), unveränderte Reihenfolge,
   Erledigt NUR aus planActualResolveForDates().byOcc (state==='completed'), Priorität NUR
   aus unitPriority(), keine UI-Klassifikation, keine Demoangaben, A/F/P identische Fachwerte,
   bestehende Session-Aktion planEntryClick erhalten, kein zusätzlicher globaler Escape-Handler.
   Teststrategie: ausführbares Rendering — der E4-Markerblock wird mit eingefrorenen
   Engine-Fixtures evaluiert; eigene Klassifikationslogik würde vom Fixture abweichen
   oder als ReferenceError scheitern.
   node supabase/tests/plan_weeklist_v5_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R(_APPREL + 'index.html'), ui=R(_APPREL + 'js/ui.js'), css=R(_APPREL + 'styles.css'), sw=R(_APPREL + 'sw.js');

/* --- Struktur: Host bleibt, Block in place, kein neuer Escape-Handler --- */
ok('Wochenplan-Karte mit #weekPlanBox bleibt', html.includes('id="weekPlanBox"'));
const fi=ui.indexOf('/* ====== E4: Wochenliste');
const fe=ui.indexOf('/* ====== E4-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('E4-Markerblock mit renderWeekPlan existiert (in place)', fi>=0&&/function renderWeekPlan\(/.test(blk));
ok('nur EINE renderWeekPlan-Definition in ui.js', (ui.match(/function renderWeekPlan\(/g)||[]).length===1);
ok('Session-Aktion planEntryClick bleibt verdrahtet', /planEntryClick\(/.test(blk));
ok('Erledigt nur über kanonischen Resolver (byOcc + completed)', /planActualResolveForDates/.test(blk)&&/state==='completed'/.test(blk));
ok('Priorität nur über unitPriority (keine Neudefinition im Block)', /unitPriority/.test(blk)&&!/function unitPriority/.test(blk));
ok('keine UI-Klassifikation im Block (isHardUnit/unitKind/Titel-Heuristik)', !/isHardUnit|function unitKind|\/interval\/|\/tempo\/i?\.test/.test(blk));
ok('kein zusätzlicher globaler Escape-Handler (nur _pqEscBound-Wiederverwendung)', (blk.match(/addEventListener\('keydown'/g)||[]).length<=1 && !/_wpEscBound|_e4EscBound/.test(blk) && (!/addEventListener\('keydown'/.test(blk)||/window\._pqEscBound/.test(blk)));
ok('.sess5-Styles vorhanden (additiv)', /\.sess5\{/.test(css)&&/\.sess5-rest\{/.test(css));
ok('SW-Version genau einmal definiert und nicht zurueckgedreht (>= v8-219)',
   (function(){var m=sw.match(/const C = 'orvia-v8-(\d+)'/);
    return !!m && parseInt(m[1],10) >= 219 && (sw.match(/orvia-v8-\d+/g)||[]).length===1;})(),
   /* Vorher war die Versionsnummer als Literal verdrahtet. Jeder Release-Bump brach
      dadurch zehn Tests auf einmal, ohne dass ein echter Vertrag verletzt war. Der
      Vertrag ist: GENAU EINE Version im sw.js (keine Altreferenz) und kein Rueckschritt.
      Muster uebernommen aus profile_editor_bugfix_test.mjs, das es bereits so macht. */);

/* --- Verhalten (Stub-DOM + eingefrorene Engine-Fixtures) --- */
if(blk){
  const els={};const mk=id=>({id,innerHTML:'',textContent:'',style:{},parentNode:{insertBefore(){}},setAttribute(){},focus(){}});
  const el=id=>els[id]||(els[id]=mk(id));
  globalThis.document={getElementById:id=>el(id),createElement:t=>mk('dyn'),addEventListener(){},activeElement:null};
  globalThis.window=globalThis;
  globalThis.esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  globalThis.escH=globalThis.esc;
  globalThis.DAYNAMES=['Mo','Di','Mi','Do','Fr','Sa','So'];
  globalThis.TYPES={Laufen:{ic:'<svg class="ic"></svg>',sub:'Run'},Gym:{ic:'<svg class="ic"></svg>',sub:'Kraft'},Rad:{ic:'<svg class="ic"></svg>',sub:'Cycling'},Schwimmen:{ic:'<svg class="ic"></svg>',sub:'Pool'},Mobilität:{ic:'<svg class="ic"></svg>',sub:'Stretch'}};
  globalThis.PROFILE={};globalThis.DB={};globalThis.RACE={date:null};
  globalThis.todayStr=d=>{const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  globalThis.buildGoal=()=>({state:'nodata'});
  globalThis.isRunDistanceGoal=()=>false;
  globalThis.goalOf=()=>({type:'health'});
  globalThis.gcat=x=>x;
  globalThis.goalTargetMin=()=>null;
  globalThis.fmtPace=()=>'';
  globalThis.daysTo=()=>null;
  globalThis.lrKm=()=>null;
  globalThis.pauseFor=()=>null;
  globalThis.Calc={runnaWeek:()=>1,resolvePlanActual:()=>({})}; // Gate: Adapter läuft nur mit vorhandenem kanonischen Resolver
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  // Wochen-Fixture (eingefroren): Mo 2 Sessions, Mi 1 Session mit langem Titel, Rest Ruhetage
  const deepFreeze=o=>{Object.getOwnPropertyNames(o).forEach(k=>{if(o[k]&&typeof o[k]==='object')deepFreeze(o[k]);});return Object.freeze(o);};
  const WEEK=deepFreeze([
    [{t:'Laufen',l:'Intervalle',d:'iv',id:'s1'},{t:'Gym',l:'Ganzkörper',d:'45 min',id:'s2'}],
    [],
    [{t:'Laufen',l:'Außerordentlich langer deutscher Dauerlauftitel für die Umbruchprüfung',d:'ez',id:'s3'}],
    [],[],[],[]
  ]);
  const WEEKJSON=JSON.stringify(WEEK);
  globalThis.activeWeekPlan=()=>WEEK;
  // Montag der aktuellen Testwoche für die occurrence-ID bestimmen (wie der Renderer)
  const now=new Date();const wd=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-wd);
  const monKey=globalThis.todayStr(mon);
  // Resolver-Fixture: NUR s1 am Montag completed
  globalThis.planActualResolveForDates=()=>({byOcc:{['po:'+monKey+':s1']:{state:'completed'}},results:[],unmatched:[],byDay:{},resolverAvailable:true});
  // Prioritäts-Fixture: bewusst kontraintuitiv — Gym s2 = 'A' (eigene UI-Logik ergäbe B/C)
  globalThis.unitPriority=it=>it.id==='s2'?'A':(it.id==='s1'?'B':'');
  let evalOk=true,evalErr='';
  try{(0,eval)(blk);}catch(e){evalOk=false;evalErr=String(e);}
  ok('Block evaluiert mit Fixtures', evalOk, evalErr);
  if(evalOk){
    const out={};
    for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;globalThis._planWeekOff=0;el('weekPlanBox').innerHTML='';globalThis.renderWeekPlan();out[m]=el('weekPlanBox').innerHTML;}
    const sids=h=>[...h.matchAll(/data-sid="([^"]*)"/g)].map(x=>x[1]).join(',');
    ok('exakt die Fixture-Sessions in Fixture-Reihenfolge (s1,s2,s3)', sids(out.fortgeschritten)==='s1,s2,s3', sids(out.fortgeschritten));
    ok('A/F/P: identische Session-IDs und Reihenfolge', sids(out.anfaenger)===sids(out.fortgeschritten)&&sids(out.fortgeschritten)===sids(out.profi));
    ok('Titel in allen Modi identisch vorhanden', ['Intervalle','Ganzkörper','Dauerlauftitel'].every(t=>[out.anfaenger,out.fortgeschritten,out.profi].every(h=>h.includes(t))));
    const doneOf=h=>[...h.matchAll(/data-sid="([^"]*)"[^>]*data-done="([^"]*)"/g)].map(x=>x[1]+':'+x[2]).join(',');
    ok('Erledigt exakt aus Resolver-Fixture (nur s1)', ['anfaenger','fortgeschritten','profi'].every(m=>doneOf(out[m])==='s1:1,s2:0,s3:0'), doneOf(out.fortgeschritten));
    ok('Priorität exakt aus Fixture: Gym s2=A (keine UI-Klassifikation)', /data-sid="s2"[\s\S]{0,400}?ppri-A/.test(out.fortgeschritten)&&!/data-sid="s1"[^§]{0,400}?ppri-A/.test(out.fortgeschritten.split('data-sid="s2"')[0]));
    ok('Fixture nicht mutiert', JSON.stringify(WEEK)===WEEKJSON);
    ok('Session-Aktion planEntryClick(dayIdx,itemIdx) verdrahtet', /planEntryClick\(0,0,'\d{4}-\d{2}-\d{2}'\)/.test(out.fortgeschritten)&&/planEntryClick\(2,0,'\d{4}-\d{2}-\d{2}'\)/.test(out.fortgeschritten));
    ok('Sessions als Buttons (Tastatur nativ)', /<button[^>]*data-sid="s1"/.test(out.fortgeschritten));
    ok('leere Tage als Ruhetag, nicht interaktiv', (out.fortgeschritten.match(/sess5-rest/g)||[]).length===5&&!/<button[^>]*sess5-rest/.test(out.fortgeschritten));
    ok('keine Demoangaben bei fehlenden Feldern (keine erfundene Dauer/Distanz)', !/km<\/|:\d\d h|Ø HF|Garmin/.test(out.fortgeschritten));
    ok('Detailzeile nur aus vorhandenem d-Feld (iv-Cue, 45 min)', out.fortgeschritten.includes('45 min')&&/zügig, kontrolliert/.test(out.fortgeschritten));
    ok('Profi ergänzt nur Erklärtiefe (Meta), Anfänger nicht', /sess5-meta/.test(out.profi)&&!/sess5-meta/.test(out.anfaenger));
    ok('Wochennavigation bleibt (pweek-nav + shiftPlanWeek)', /pweek-nav/.test(out.fortgeschritten)&&/shiftPlanWeek\(-1\)/.test(out.fortgeschritten));
    // Mehrfaches Rendern: keine Duplikate
    globalThis.renderWeekPlan();globalThis.renderWeekPlan();
    ok('3× Rendern: weiterhin exakt 3 Session-Cards', (el('weekPlanBox').innerHTML.match(/data-sid="/g)||[]).length===3);
    // Reine Ruhewoche / leerer Plan
    globalThis.activeWeekPlan=()=>[[],[],[],[],[],[],[]];
    el('weekPlanBox').innerHTML='';globalThis.renderWeekPlan();
    ok('Ruhewoche/leerer Plan: 7 Ruhetage, 0 Sessions, kein Fehler', (el('weekPlanBox').innerHTML.match(/sess5-rest/g)||[]).length===7&&!/data-sid=/.test(el('weekPlanBox').innerHTML));
    // Resolver nicht verfügbar ⇒ fail-closed: nichts als erledigt zeigen
    globalThis.activeWeekPlan=()=>WEEK;
    globalThis.planActualResolveForDates=()=>({byOcc:{},results:[],unmatched:[],byDay:{},resolverAvailable:false});
    el('weekPlanBox').innerHTML='';globalThis.renderWeekPlan();
    ok('Resolver fehlt ⇒ keine Session erledigt (fail-closed)', !/data-done="1"/.test(el('weekPlanBox').innerHTML));
  }
}
console.log('\n'+(fail?fail+' FAILED':'plan_weeklist_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
