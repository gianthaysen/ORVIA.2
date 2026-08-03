/* ORVIA · E2 — Laufumfang Woche (Plan/Ist) als v5-Karte, in place statt renderRamp-Altdarstellung.
   Kontrakt: Ziel NUR weekKmTarget/effectiveKmTarget, Ist NUR weekRunKm (kanonische Kette),
   keine UI-Summierung, missing ≠ 0, Lauf-Beschriftung, A/F/P identische Fachwerte.
   node supabase/tests/plan_weekvolume_v5_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../../app/index.html'), ui=R('../../../app/js/ui.js'), css=R('../../../app/styles.css'), sw=R('../../../app/sw.js');

/* --- Markup: bestehender Host, Lauf-Beschriftung, alle Modi --- */
ok('#rampBox-Karte nicht mehr adv-only, Titel nennt LAUF', /<div class="card(?! adv-only)[^"]*"><h2>[\s\S]{0,140}Lauf[\s\S]{0,90}id="rampBox"/.test(html));

/* --- Renderer: in place, kanonisch, keine eigene Aggregation --- */
const fi=ui.indexOf('/* ====== E2: Laufumfang');
const fe=ui.indexOf('/* ====== E2-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('E2-Block mit renderRamp existiert (in place)', fi>=0&&/function renderRamp\(/.test(blk));
ok('nur EINE renderRamp-Definition', (ui.match(/function renderRamp\(/g)||[]).length===1);
ok('Ziel aus weekKmTarget + effectiveKmTarget', /Calc\.weekKmTarget\(/.test(blk)&&/Calc\.effectiveKmTarget\(/.test(blk));
ok('Ist aus weekRunKm (kanonische Kette)', /weekRunKm\(0\)/.test(blk));
ok('KEINE zweite Summierung über Aktivitäten im UI', !/listActivities|\.reduce\(|sessions\.Laufen|\.dist\b/.test(blk));
ok('keine eigene Statusbewertung (kein planStatus-Missbrauch, keine Ampelwörter)', !/planStatus\(/.test(blk)&&!/kritisch|überlastet/i.test(blk));
ok('Lauf-Beschriftung im Renderer', /Lauf/.test(blk));
ok('kein Demo-Ziel/-Kilometer', !/34 km|19,0|'34'/.test(blk));
ok('Sheet mit denselben Daten vorhanden', /function openWeekVolumeSheet\(/.test(blk));
ok('.wkv5-Styles vorhanden', /\.wkv5-bar\{/.test(css)&&/\.wkv5-over\{/.test(css));
ok('SW auf gemeinsamem GM-Release v8-198, genau einmal', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-\d+/g)||[]).length===1);

/* --- Funktional (Stub) --- */
if(blk){
  const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',style:{},classList:{add(){},remove(){},contains:()=>false},setAttribute(){},focus(){}});
  globalThis.document={getElementById:id=>el(id),addEventListener(){},activeElement:null};
  globalThis.escH=x=>String(x==null?'':x);
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.todayStr=(d)=>{const x=d||new Date('2026-07-29T12:00:00');return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  globalThis.daysTo=()=>38;
  globalThis.RACE={date:'2026-09-05'};
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.oModal=(t,b)=>{globalThis.__sheet={title:t,body:b};};
  globalThis.Calc={weekKmTarget:(d,ahead)=>ahead===0?34:(ahead===1?36:ahead===2?26:38),effectiveKmTarget:(cal,l3)=>Math.min(cal,Math.round(1.10*Math.max(...l3,0)))};
  let WK={0:19.4,1:27,2:30,3:24};
  globalThis.weekRunKm=off=>WK[off];
  (0,eval)(blk);
  const out={};
  for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;el('rampBox').innerHTML='';globalThis.renderRamp();out[m]=el('rampBox').innerHTML;}
  const fact=h=>(h.match(/data-wk="[^"]*"/)||[''])[0];
  ok('A/F/P: identisches Ist/Ziel (data-wk)', fact(out.anfaenger)===fact(out.profi)&&fact(out.anfaenger).length>5);
  ok('Effektivziel 33 (Ist-Kopplung, nicht Kalender 34)', /data-wk="19,4\|33/.test(out.profi.replace(/&#?\w+;/g,''))||/19,4[\s\S]{0,40}33/.test(out.profi));
  ok('Deload/Deckelung ehrlich erklärt (Fortg./Profi)', /gedeckelt|Entlastung|Kalenderziel/.test(out.profi));
  ok('Lauf-Label sichtbar, kein Multisport-Anspruch', /Lauf/.test(out.anfaenger)&&!/Trainingsvolumen gesamt|Multisport/.test(out.profi));
  ok('Restwert in Fortgeschritten (13,6 km offen)', /13,6/.test(out.fortgeschritten));
  // Sheet == Karte
  MODE='profi';globalThis.openWeekVolumeSheet();
  ok('Sheet zeigt dieselben Werte (19,4 / 33)', !!globalThis.__sheet&&/19,4/.test(globalThis.__sheet.body)&&/33/.test(globalThis.__sheet.body));
  // Überschreitung: Balken gedeckelt, echter Wert bleibt
  WK={0:41.2,1:34,2:36,3:33};MODE='profi';el('rampBox').innerHTML='';globalThis.renderRamp();
  ok('Überschreitung: Balken ≤100 %, echter Wert 41,2 sichtbar', /wkv5-over/.test(el('rampBox').innerHTML)&&/41,2/.test(el('rampBox').innerHTML)&&!/width:1[1-9]\d%/.test(el('rampBox').innerHTML));
  // Ist unbekannt ⇒ kein 0
  WK={0:null,1:27,2:30,3:24};el('rampBox').innerHTML='';globalThis.renderRamp();
  ok('Ist unbekannt ⇒ „nicht bestimmbar", keine 0 km', /nicht bestimmbar/i.test(el('rampBox').innerHTML)&&!/0 km/.test(el('rampBox').innerHTML));
  // Wochenziel fehlt (Renndatum vorbei ⇒ Kalenderziel 0) ⇒ kein "0 km Ziel"
  WK={0:12,1:10,2:11,3:9};globalThis.Calc.weekKmTarget=()=>0;el('rampBox').innerHTML='';globalThis.renderRamp();
  ok('kein Wochenziel ⇒ ehrlicher Zustand statt „0 km Ziel"', /kein Wochenziel|Renndatum/i.test(el('rampBox').innerHTML)&&!/\/ 0 km/.test(el('rampBox').innerHTML));
  // echte 0-Woche (Vertrag da, keine Läufe) ⇒ 0 erlaubt
  globalThis.Calc.weekKmTarget=(d,a)=>a===0?30:28;WK={0:0,1:27,2:30,3:24};el('rampBox').innerHTML='';globalThis.renderRamp();
  ok('belastbare 0-Woche wird als 0 gezeigt (unterscheidbar von unbekannt)', /data-wk="0\|/.test(el('rampBox').innerHTML.replace(/&#?\w+;/g,''))||/>0<|0 \//.test(el('rampBox').innerHTML));
}
console.log('\n'+(fail?fail+' FAILED':'plan_weekvolume_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
