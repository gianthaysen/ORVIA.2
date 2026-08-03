/* ORVIA · E1 — Planseite „Phasen bis zum Ziel" als v5-Phase-Track.
   Kontrakt: NUR Calc.racePhases + goalOf (kanonisch), keine eigene Phasenlogik,
   kein Demo-Ziel, past-Goal ehrlich, A/F/P identische Fachdaten.
   node supabase/tests/plan_phases_v5_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../index.html'), ui=R('../../js/ui.js'), css=R('../../styles.css'), sw=R('../../sw.js');

/* --- Markup: bestehender Host bleibt, für alle Modi sichtbar --- */
ok('#phaseBox-Karte existiert und ist NICHT mehr adv-only', /<div class="card(?! adv-only)[^"]*"><h2>[\s\S]{0,120}Phasen bis zum (Rennen|Ziel)[\s\S]{0,80}id="phaseBox"/.test(html));

/* --- Renderer: kanonisch, keine eigene Phasenberechnung --- */
const fi=ui.indexOf('/* ====== E1: Phasen');
const fe=ui.indexOf('/* ====== E1-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('E1-Block mit renderPhases existiert', fi>=0&&/function renderPhases\(/.test(blk));
ok('alter renderPhases ersetzt (nur EINE Definition)', (ui.match(/function renderPhases\(/g)||[]).length===1);
ok('konsumiert Calc.racePhases', /Calc[\s\S]{0,40}racePhases\(/.test(blk));
ok('Ziel ausschließlich aus goalOf (kanonische Auswahl)', /goalOf\(\)/.test(blk)&&!/PROFILE\.goals/.test(blk));
ok('KEINE eigene Phasenberechnung (keine Offsets/Perioden im Renderer)', !/-35|-34|-14|-13|setDate\(/.test(blk));
ok('kein Demo-Ziel / kein festes Datum', !/2026-09|06\.09|Halbmarathon unter/.test(blk));
ok('vergangenes Ziel ⇒ ehrlicher Zustand (kein aktiver Block)', /daysTo\(/.test(blk)&&/zurück|Vergangenheit/i.test(blk));
ok('Phasen-Sheet vorhanden (Tap ⇒ vorhandene Details)', /function openPhaseSheet\(/.test(blk));
ok('.phv5-Styles vorhanden', /\.phv5-track\{/.test(css)&&/\.phv5-seg\{/.test(css));

/* --- SW: Arbeitsbaum bleibt v8-196, genau einmal (kein E1-Bump im selben Release) --- */
ok('SW auf gemeinsamem GM-Release v8-198, genau einmal', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-\d+/g)||[]).length===1);

/* --- Funktional: Stub-DOM --- */
if(blk){
  const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',style:{},classList:{add(){},remove(){},contains:()=>false},setAttribute(){},focus(){}});
  globalThis.document={getElementById:id=>el(id),addEventListener(){},activeElement:null};
  globalThis.escH=x=>String(x==null?'':x);
  globalThis.todayStr=()=>'2026-07-26';
  globalThis.daysTo=d=>Math.round((new Date(d+'T00:00')-new Date('2026-07-26T00:00'))/864e5);
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.oModal=(t,b)=>{globalThis.__sheet={title:t,body:b};};
  const PH=[
    {n:'Aufbau',from:null,to:'2026-08-01',d:'Volumen & Grundlage aufbauen',on:false},
    {n:'Peak',from:'2026-08-02',to:'2026-08-22',d:'Höchste Last, wettkampfspezifische Reize',on:false},
    {n:'Taper',from:'2026-08-23',to:'2026-09-04',d:'Volumen senken, Frische aufbauen',on:false},
    {n:'Wettkampf',from:'2026-09-05',to:'2026-09-05',d:'Renntag',on:false}
  ];PH[0].on=true;
  globalThis.Calc={racePhases:(rd,t)=>rd==='2026-09-05'?JSON.parse(JSON.stringify(PH)):[]};
  let GOAL={raceDate:'2026-09-05',type:'half_marathon'};
  globalThis.goalOf=()=>GOAL;
  (0,eval)(blk);
  const out={};
  for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;el('phaseBox').innerHTML='';globalThis.renderPhases();out[m]=el('phaseBox').innerHTML;}
  const facts=h=>(h.match(/data-ph="[^"]*"/g)||[]).join('|');
  ok('A/F/P: identische Phasen/Reihenfolge/Daten (data-ph)', facts(out.anfaenger)===facts(out.profi)&&facts(out.anfaenger).split('|').length===4);
  ok('aktive Phase markiert (is-now), genau eine', (out.profi.match(/is-now/g)||[]).length>=1&&(out.profi.match(/data-state="now"/g)||[]).length===1);
  ok('vergangen/kommend unterscheidbar (done/upcoming)', /data-state="done"|data-state="upcoming"/.test(out.profi));
  ok('Resttage aus daysTo (41 Tage)', /41/.test(out.profi));
  MODE='profi';globalThis.openPhaseSheet('Peak');
  ok('Sheet zeigt vorhandene Phasendetails (Zeitraum + Beschreibung)', !!globalThis.__sheet&&/Peak/.test(globalThis.__sheet.title)&&/wettkampfspezifische/.test(globalThis.__sheet.body)&&/02\.08|2026-08-02/.test(globalThis.__sheet.body));
  MODE='anfaenger';globalThis.openPhaseSheet('Peak');const anfB=globalThis.__sheet.body;
  MODE='profi';globalThis.openPhaseSheet('Peak');
  ok('Sheet: Modus nur Tiefe, Kern identisch', /wettkampfspezifische/.test(anfB)&&anfB!==globalThis.__sheet.body);
  // vergangenes Ziel
  GOAL={raceDate:'2026-06-01',type:'half_marathon'};
  globalThis.Calc.racePhases=()=>JSON.parse(JSON.stringify(PH)).map(p=>({...p,on:false}));
  el('phaseBox').innerHTML='';globalThis.renderPhases();
  ok('vergangenes Ziel ⇒ kein data-state="now", ehrlicher Text', !/data-state="now"/.test(el('phaseBox').innerHTML)&&/zurück|Vergangenheit/i.test(el('phaseBox').innerHTML));
  // kein Ziel
  GOAL={raceDate:'',type:'health'};globalThis.Calc.racePhases=()=>[];
  el('phaseBox').innerHTML='';globalThis.renderPhases();
  ok('kein Ziel ⇒ Empty-State ohne Phasen', !/data-ph=/.test(el('phaseBox').innerHTML)&&/Wettkampfdatum|Ziel/i.test(el('phaseBox').innerHTML));
}
console.log('\n'+(fail?fail+' FAILED':'plan_phases_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
