/* ORVIA · D2 — Erholung (Analyse) als v5-Kacheln + Detail-Sheet.
   Kontrakt: ausschließlich kanonischer Resolver (collect, NIE refresh), missing≠0,
   stale sichtbar, Kachel==Sheet-Datenbasis, A/F/P nur Texttiefe, A11y-Sheet.
   node supabase/tests/analysis_recovery_v5_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../../app/index.html'), ui=R('../../../app/js/ui.js'), css=R('../../../app/styles.css'), sw=R('../../../app/sw.js');

/* --- Markup --- */
const segE=(html.match(/<div id="seg-erholung"[\s\S]*?<div id="recovNote">/)||[''])[0];
ok('Host #recoveryTilesV5 oben im Erholungssegment', segE.includes('id="recoveryTilesV5"') && segE.indexOf('recoveryTilesV5')<segE.indexOf('cReady'));
ok('bestehende Chart.js-Karten bleiben (cReady/cHRV/cSleep/cBB)', ['cReady','cHRV','cSleep','cBB'].every(id=>html.includes('id="'+id+'"')));

/* --- UI-Code: kanonisch, read-only, eine Datenbasis --- */
const fi=ui.indexOf('/* ====== D2: Erholung heute');
ok('D2-Block + renderRecoveryTilesV5 existieren', fi>=0&&ui.includes('function renderRecoveryTilesV5('));
const blockEnd=ui.indexOf('/* ====== D2-ENDE',fi);
const blk=fi>=0?ui.slice(fi,blockEnd>0?blockEnd:fi+12000):'';
ok('nutzt profileMetricResolver.collect (read-only)', /profileMetricResolver[\s\S]{0,400}collect\(/.test(blk));
ok('ruft NIE refresh() auf (schreibt ins Profil)', !/\.refresh\(/.test(blk));
ok('nutzt Tagescache _metricsResolved, wenn frisch', /_metricsResolved/.test(blk));
ok('openRecoveryMetricSheet existiert und liest DIESELBE Map', /function openRecoveryMetricSheet\(/.test(blk));
ok('keine Metrik-/Trend-/Score-Berechnung im UI (keine avg/ewma/median)', !/ewma\(|median\(|avg\(|reduce\([^)]*\)\s*\/|Math\.exp/.test(blk));
ok('keine Demo-/Hardcode-Werte', !/62 ms|48 bpm|7,6 h|78\/100|'82'|"82"/.test(blk));
ok('renderSegErholung ruft renderRecoveryTilesV5 auf', /function renderSegErholung\(\)\{[\s\S]{0,120}renderRecoveryTilesV5\(\)/.test(ui));
ok('stale wird sichtbar gekennzeichnet (Text, nicht nur Farbe)', /veraltet/i.test(blk));
ok('A11y-Sheet: Escape + Fokus-Rückgabe (idempotent)', /Escape/.test(blk)&&/_rcvEscBound|escBound|dataset\.esc/.test(blk)&&/focus\(\)/.test(blk));

/* --- CSS + SW --- */
ok('.rcv-Kachel-Styles vorhanden', /\.rcv-tile\{/.test(css)&&/\.rcv-stale\{/.test(css));
/* Kalibrierung: die frueher genau einmal erlaubte Alt-Versionsnennung (v8-19x-Kommentar)
   wurde aus sw.js entfernt — jetzt duerfen NULL Alt-Referenzen vorkommen. */
ok('SW auf orvia-v8-219 erhöht, keine Alt-Versionsreferenz mehr', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-19[678]/g)||[]).length===0);

/* --- Funktional (Stub-DOM): Werte identisch über Modi, Kachel==Sheet, missing≠0 --- */
if(fi>=0){
  const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},focus(){}});
  globalThis.document={getElementById:id=>el(id),addEventListener(){},activeElement:null};
  globalThis.escH=x=>String(x==null?'':x);
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.todayStr=()=>'2026-07-26';
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  const RESOLVED={
    hrv_ms:{metricType:'hrv_ms',value:61,valueText:null,unit:'ms',source:'automatic',sourceType:'device_measurement',measuredAt:'2026-07-26T06:10:00Z',metricDate:'2026-07-26',stale:false},
    resting_hr:{metricType:'resting_hr',value:47,valueText:null,unit:'bpm',source:'automatic',sourceType:'device_measurement',measuredAt:'2026-07-22T06:00:00Z',metricDate:'2026-07-22',stale:true},
    sleep_duration_min:{metricType:'sleep_duration_min',value:472,valueText:null,unit:'min',source:'automatic',sourceType:'device_measurement',measuredAt:'2026-07-26T07:02:00Z',metricDate:'2026-07-26',stale:false}
    /* stress_avg + body_battery FEHLEN bewusst → keine Kachel, nie 0 */
  };
  let collectCalls=0;
  globalThis.window={_metricsResolved:{date:'2026-07-26',resolved:RESOLVED},ORVIA:{profileMetricResolver:{collect:async()=>{collectCalls++;return {success:true,data:{resolved:RESOLVED}};}}}};
  globalThis.ORVIA=globalThis.window.ORVIA;
  globalThis.oModal=(t,b)=>{globalThis.__sheet={title:t,body:b};};
  /* GM6 · reines Testgeruest — es wurde KEINE Zusicherung dieses Tests geaendert.
     Die systemweiten Zustandskomponenten (.sk / .card>.empty / .errbar) liegen
     ausserhalb des hier evaluierten D2-Ausschnitts. Statt Ersatzmarkup zu
     erfinden, wird ihr ECHTER Produktivquelltext unveraendert aus js/ui.js
     uebernommen (samt gmEsc). icon() wird — wie am Kopf von js/ui.js — neutral
     ergaenzt: reine Grafik ohne Fachaussage. */
  globalThis.icon=(n,c)=>'<svg class="ic '+(c||'')+'" viewBox="0 0 24 24"></svg>';
  (0,eval)(ui.slice(ui.indexOf('function gmEsc('),ui.indexOf('\n',ui.indexOf('function gmEsc('))));
  (0,eval)(ui.slice(ui.indexOf('/* --- GM6: systemweite Zustandskomponenten'),ui.indexOf('/* --- GM6-ENDE Zustandskomponenten')));
  (0,eval)(blk); // indirektes eval → Deklarationen werden global
  const renderRecoveryTilesV5=globalThis.renderRecoveryTilesV5, openRecoveryMetricSheet=globalThis.openRecoveryMetricSheet;
  const out={};
  for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;el('recoveryTilesV5').innerHTML='';renderRecoveryTilesV5();out[m]=el('recoveryTilesV5').innerHTML;}
  const vals=h=>(h.match(/data-val="[^"]*"/g)||[]).join('|');
  ok('A/F/P: byte-identische Fachwerte (data-val)', vals(out.anfaenger)===vals(out.profi)&&vals(out.anfaenger).length>0);
  ok('Cache genutzt: kein collect()-Aufruf nötig', collectCalls===0);
  ok('HRV-Kachel zeigt 61 ms', /61/.test(out.profi)&&/ms/.test(out.profi));
  ok('Schlaf: Minuten menschenlesbar (7:52 h)', /7:52/.test(out.profi));
  ok('fehlende Metriken (Stress/Body Battery) NICHT als Kachel/0', !/data-m="stress_avg"/.test(out.profi)&&!/data-m="body_battery"/.test(out.profi)&&!/>0<\/(b|span)>/.test(out.profi));
  ok('stale-Kachel gekennzeichnet (Ruhepuls veraltet + Datum)', /veraltet/i.test(out.profi)&&/22\.07|22\.7/.test(out.profi));
  // Kachel == Sheet: gleiche Datenbasis
  MODE='profi';openRecoveryMetricSheet('hrv_ms');
  ok('Sheet zeigt DENSELBEN Wert + Quelle', !!globalThis.__sheet&&/61/.test(globalThis.__sheet.body)&&/ms/.test(globalThis.__sheet.body)&&/automatisch|Garmin|Gerät|device/i.test(globalThis.__sheet.body));
  MODE='anfaenger';openRecoveryMetricSheet('hrv_ms');const anfB=globalThis.__sheet.body;
  MODE='profi';openRecoveryMetricSheet('hrv_ms');
  ok('Sheet: Modus ändert nur Tiefe, Wert identisch', /61/.test(anfB)&&anfB!==globalThis.__sheet.body);
  // Empty-State: gar keine Metriken
  globalThis.window._metricsResolved={date:'2026-07-26',resolved:{}};
  el('recoveryTilesV5').innerHTML='';renderRecoveryTilesV5();
  ok('Empty-State ohne Kacheln, ehrlich formuliert', /keine|noch/i.test(el('recoveryTilesV5').innerHTML)&&!/data-m=/.test(el('recoveryTilesV5').innerHTML));
}
console.log('\n'+(fail?fail+' FAILED':'analysis_recovery_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
