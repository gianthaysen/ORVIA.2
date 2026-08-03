/* ORVIA · Phase D1 — Ausdauer „Form & Fitness" an ORVIA.charts.richChart.
   Vertrags- + Funktionstest: kanonisches Lastmodell (allLoads→Calc.loadSeries),
   loadConfidenceContract-Missingness, Modus ändert nur Text, Overlay-Vertrag im Modul.
   node supabase/tests/analysis_endurance_v5_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../index.html'), ui=R('../../js/ui.js'), css=R('../../styles.css');
const mod=(()=>{try{return R('../../js/orvia-charts.js');}catch(e){return '';}})();

/* --- Modul: rückwärtskompatibler Overlay-Vertrag --- */
ok('Modul: overlays-Vertrag vorhanden (cfg.overlays → .g-ov-Pfade)', /cfg\.overlays/.test(mod)&&/g-ov/.test(mod));
ok('Modul: Overlay-Werte fließen in die Skala ein', /overlays[\s\S]{0,700}vals/.test(mod)||/vals[\s\S]{0,700}overlays/.test(mod));
ok('Modul: Replace-Vertrag (mount.innerHTML ersetzt alten Chart)', /mount\.innerHTML=/.test(mod));
ok('CSS: .g-ov Overlay-Stil', /\.oc2 \.g-ov\{/.test(css));

/* --- Markup: Karte im Ausdauer-Segment, Überblick-cForm unangetastet --- */
const segA=(html.match(/<div id="seg-ausdauer"[\s\S]*?<div id="seg-erholung"/)||[''])[0];
ok('Form&Fitness-Karte im Ausdauer-Segment (#formFitnessV5)', segA.includes('id="formFitnessV5"'));
ok('Karte steht oben (vor goalDetail2)', segA.indexOf('formFitnessV5')<segA.indexOf('goalDetail2'));
ok('Überblick-cForm (Chart.js) bleibt exakt einmal erhalten', (html.match(/id="cForm"/g)||[]).length===1);

/* --- UI-Adapter: kanonisch, keine Neuberechnung, Vertrag respektiert --- */
const fi=ui.indexOf('function renderFormFitnessV5(');
ok('renderFormFitnessV5 existiert', fi>=0);
const fn=fi>=0?ui.slice(fi,ui.indexOf('\nfunction ',fi+10)>0?ui.indexOf('\nfunction ',fi+10):fi+6000):'';
ok('nutzt allLoads() + Calc.loadSeries (SSOT)', /allLoads\(\)/.test(fn)&&/Calc\.loadSeries/.test(fn));
ok('keine eigene EWMA-/Glättungsrechnung im UI', !/ewma\(|Math\.exp|\*0\.9|alpha/.test(fn));
ok('respektiert loadConfidenceContract (suppressNumbers ⇒ kein Chart)', /loadConfidenceContract/.test(fn)&&/suppressNumbers/.test(fn));
ok('Partial-State bei kurzer Historie (<14 T)', /14/.test(fn)&&/Lasthistorie|Historie/.test(fn));
ok('keine Demo-Arrays', !/\[62,64|\[30,31,33|\[24,27,30/.test(fn));
ok('Fehlerpfad mit Retry vorhanden', /catch/.test(fn)&&/Erneut versuchen/.test(fn));
ok('renderSegAusdauer ruft renderFormFitnessV5 auf', /function renderSegAusdauer\(\)\{[\s\S]{0,200}renderFormFitnessV5\(\)/.test(ui));
ok('Legende mit drei Reihen (Fitness/Ermüdung/Form)', /Fitness/.test(fn)&&/Ermüdung/.test(fn)&&/Form/.test(fn));
ok('.ffv-legend-Styles vorhanden', /\.ffv-legend\{/.test(css));

/* --- Funktional: Modus ändert NUR Text, nie Daten; Missingness-Zweige --- */
if(fi>=0){
  const calls=[];
  const els={};
  function el(id){return els[id]||(els[id]={id,innerHTML:'',style:{}});}
  globalThis.document={getElementById:id=>el(id)};
  globalThis.window={ORVIA:{charts:{richChart:(m,cfg)=>{calls.push(JSON.parse(JSON.stringify(cfg)));}}}};
  globalThis.ORVIA=globalThis.window.ORVIA;
  globalThis.escH=x=>String(x==null?'':x);
  globalThis.Calc={
    loadSeries:loads=>{const n=loads.length;return {ctl:loads.map((_,i)=>40+i*0.1),atl:loads.map((_,i)=>30+i*0.2),tsb:loads.map((_,i)=>+(10-i*0.1).toFixed(1))};},
    loadConfidenceContract:c=>c==='not_assessable'?{tier:'not_assessable',suppressNumbers:true,ctlAtlNote:'CTL/ATL nicht belastbar (Test).'}:c==='hoch'?{tier:'hoch',suppressNumbers:false,ctlAtlNote:null}:{tier:'reduziert',suppressNumbers:false,ctlAtlNote:'Schätzwert (Test).'}
  };
  let LD={loads:Array.from({length:60},(_,i)=>50+i),labels:Array.from({length:60},(_,i)=>'T'+i),confidence:'hoch'};
  globalThis.allLoads=()=>LD;
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  /* GM6 · reines Testgeruest — es wurde KEINE Zusicherung dieses Tests geaendert.
     Die systemweiten Zustandskomponenten (.sk / .card>.empty / .errbar) liegen
     ausserhalb der hier evaluierten Funktion. Statt Ersatzmarkup zu erfinden,
     wird ihr ECHTER Produktivquelltext unveraendert aus js/ui.js uebernommen
     (samt gmEsc). icon() wird — wie am Kopf von js/ui.js — neutral ergaenzt:
     reine Grafik ohne Fachaussage. */
  globalThis.icon=(n,c)=>'<svg class="ic '+(c||'')+'" viewBox="0 0 24 24"></svg>';
  (0,eval)(ui.slice(ui.indexOf('function gmEsc('),ui.indexOf('\n',ui.indexOf('function gmEsc('))));
  (0,eval)(ui.slice(ui.indexOf('/* --- GM6: systemweite Zustandskomponenten'),ui.indexOf('/* --- GM6-ENDE Zustandskomponenten')));
  (0,eval)(fn.replace('function renderFormFitnessV5(','globalThis.renderFormFitnessV5=function('));
  // 1) drei Modi → identische Serien, unterschiedlicher Text
  const texts={},byMode={};
  for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;calls.length=0;el('formFitnessV5').innerHTML='';renderFormFitnessV5();byMode[m]=calls[0];texts[m]=el('formFitnessV5').innerHTML;}
  ok('A/F/P: je Modus genau 1 Chart-Aufruf mit IDENTISCHEN Serien',
    !!byMode.anfaenger&&!!byMode.fortgeschritten&&!!byMode.profi&&
    JSON.stringify(byMode.anfaenger.series)===JSON.stringify(byMode.fortgeschritten.series)&&
    JSON.stringify(byMode.fortgeschritten.series)===JSON.stringify(byMode.profi.series)&&
    JSON.stringify(byMode.anfaenger.overlays.map(o=>o.series))===JSON.stringify(byMode.profi.overlays.map(o=>o.series)));
  ok('A/F/P: Erklärtext unterscheidet sich', texts.anfaenger!==texts.profi);
  ok('28-Tage-Fenster + zwei Overlays (ATL/TSB)', byMode.profi.series.length===28&&byMode.profi.overlays.length===2);
  // 2) not_assessable → Empty-State, KEIN Chart, keine 0-Kurve
  LD={loads:Array.from({length:60},()=>null),labels:[],confidence:'not_assessable'};calls.length=0;renderFormFitnessV5();
  ok('not_assessable ⇒ Empty-State statt Chart', calls.length===0&&/nicht belastbar/.test(el('formFitnessV5').innerHTML));
  // 3) kurze Historie → Partial-State
  LD={loads:[50,60,55,70,65,60,58,62],labels:['a','b','c','d','e','f','g','h'],confidence:'hoch'};calls.length=0;renderFormFitnessV5();
  ok('<14 Tage ⇒ Partial-State statt Chart', calls.length===0&&/Tage/.test(el('formFitnessV5').innerHTML));
  // 4) reduziert → Chart + Hinweisnote
  LD={loads:Array.from({length:40},(_,i)=>50+i),labels:Array.from({length:40},(_,i)=>'T'+i),confidence:'reduziert'};calls.length=0;renderFormFitnessV5();
  ok('reduziert ⇒ Chart + Hinweisnote', calls.length===1&&/Schätzwert/.test(el('formFitnessV5').innerHTML));
}

console.log('\n'+(fail?fail+' FAILED':'analysis_endurance_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
