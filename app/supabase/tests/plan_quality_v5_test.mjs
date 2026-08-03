/* ORVIA · E3 — Planqualität als v5-Karte, in place statt pq-Altdarstellung.
   Kontrakt: Bewertung AUSSCHLIESSLICH aus planQualityChecks() (Status + Warnungen verbatim),
   keine UI-Neubewertung, keine erfundenen Scores/Prozente, Safety-Hinweise in allen Modi,
   Sheet mit identischen Daten, keine Planmutation.
   Teststrategie: ausführbarer Verhaltens-/DOM-Vertrag. Der Markerblock wird mit gestubbtem
   planQualityChecks evaluiert — activeWeekPlan/goalOf/userLevel/DB/isHardUnit sind BEWUSST
   nicht definiert: jede in die UI kopierte Engine-Regel wirft ReferenceError.
   node supabase/tests/plan_quality_v5_test.mjs */
import fs from 'fs';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R('../../index.html'), ui=R('../../js/ui.js'), css=R('../../styles.css'), sw=R('../../sw.js');

/* --- Markup/Struktur: Host bleibt, Karte unverändert sichtbar --- */
ok('Karte „Planqualität & Sicherheit" mit #planQualityBox, nicht adv-only', /<div class="card(?! adv-only)[^"]*"><h2>[\s\S]{0,160}Planqualität &amp; Sicherheit<\/h2><div id="planQualityBox">/.test(html));

/* --- E3-Block: in place, kanonisch, Engine bleibt außerhalb --- */
const fi=ui.indexOf('/* ====== E3: Planqualität');
const fe=ui.indexOf('/* ====== E3-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('E3-Markerblock mit renderPlanQuality existiert (in place)', fi>=0&&/function renderPlanQuality\(/.test(blk));
ok('nur EINE renderPlanQuality-Definition in ui.js', (ui.match(/function renderPlanQuality\(/g)||[]).length===1);
ok('planQualityChecks wird aufgerufen, aber NICHT im Block definiert', /planQualityChecks\(\)/.test(blk)&&!/function planQualityChecks/.test(blk));
ok('keine Engine-Eingaben im UI (activeWeekPlan/goalOf/userLevel/DB/isHardUnit/todayPrimaryUnit)', !/activeWeekPlan|goalOf\(|userLevel\(|isHardUnit|todayPrimaryUnit|DB\[/.test(blk));
ok('keine Planmutation, kein Optimieren-Button', !/Plan optimieren|savePlanEdit|resetPlan\(|PROFILE\.|saveProfile/.test(blk));
ok('Sheet openPlanQualitySheet im Block definiert', /function openPlanQualitySheet\(/.test(blk));
ok('Aufrufer renderPlan bleibt verbunden', /renderPlanQuality==='function'\)renderPlanQuality\(\)/.test(ui));
ok('.pqv5-Styles vorhanden (additiv)', /\.pqv5-chip\{/.test(css)&&/\.pqv5-w\{/.test(css));
ok('SW auf gemeinsamem GM-Release v8-198, genau einmal', /const C = 'orvia-v8-219'/.test(sw)&&(sw.match(/orvia-v8-\d+/g)||[]).length===1);

/* --- Verhalten (Stub-DOM, gestubbte Engine) --- */
if(blk){
  const els={};const el=id=>els[id]||(els[id]={id,innerHTML:'',style:{},classList:{add(){},remove(){},contains:()=>false},setAttribute(){},focus(){}});
  globalThis.document={getElementById:id=>el(id),addEventListener(){},activeElement:null};
  globalThis.escH=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.oModal=(t,b)=>{globalThis.__sheet={title:t,body:b};};
  const deepFreeze=o=>{Object.getOwnPropertyNames(o).forEach(k=>{if(o[k]&&typeof o[k]==='object')deepFreeze(o[k]);});return Object.freeze(o);};
  const W1=['Harte Tage direkt hintereinander','Zwischen zwei harte Einheiten einen leichten Tag oder Ruhetag legen.'];
  const W2=['Knie 5/10 und harte Einheit geplant','Heute ersetzen (Easy/Bike) — siehe Tagesanpassung auf „Heute“.'];
  let FIX=deepFreeze({rating:{l:'moderat',c:'y'},warns:[W1,W2]});
  const FIXJSON=JSON.stringify(FIX);
  const calls={};globalThis.planQualityChecks=()=>{calls[MODE]=(calls[MODE]||0)+1;return FIX;};
  let evalOk=true,evalErr='';
  try{(0,eval)(blk);}catch(e){evalOk=false;evalErr=String(e);}
  ok('Block evaluiert ohne Engine-Stubs (keine kopierte Regel)', evalOk, evalErr);
  if(evalOk){
    const out={};
    for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;el('planQualityBox').innerHTML='';globalThis.renderPlanQuality();out[m]=el('planQualityBox').innerHTML;}
    ok('genau 1 Engine-Aufruf pro Render (je Modus)', calls.anfaenger===1&&calls.fortgeschritten===1&&calls.profi===1, JSON.stringify(calls));
    const fact=h=>((h.match(/data-pq-rating="[^"]*"/)||[''])[0])+'|'+((h.match(/data-pq-warns="[^"]*"/)||[''])[0]);
    ok('A/F/P: identischer Status + Warnanzahl (data-pq)', fact(out.anfaenger)===fact(out.profi)&&fact(out.anfaenger)===fact(out.fortgeschritten)&&fact(out.anfaenger).includes('data-pq-rating="y"')&&fact(out.anfaenger).includes('data-pq-warns="2"'));
    ok('Safety-Hinweis (Knie) in ALLEN Modi sichtbar', [out.anfaenger,out.fortgeschritten,out.profi].every(h=>h.includes('Knie 5/10 und harte Einheit geplant')));
    ok('beide Warnungen mit kanonischem Handlungstext in Anfänger-Modus', out.anfaenger.includes(W1[0])&&out.anfaenger.includes(W1[1])&&out.anfaenger.includes(W2[1]));
    ok('Status verbatim mit Symbol (moderat + ▲)', /▲/.test(out.fortgeschritten)&&out.fortgeschritten.includes('moderat'));
    ok('keine erfundenen Scores/Prozente', ![out.anfaenger,out.fortgeschritten,out.profi].some(h=>/\d+\s*\/\s*100|\d+\s?%/.test(h)));
    ok('Fixture nicht mutiert (keine Planmutation/Datenänderung)', JSON.stringify(FIX)===FIXJSON);
    ok('Profi ergänzt nur Erklärtiefe (Datenbasis-Meta), A nicht', /pqv5-meta/.test(out.profi)&&!/pqv5-meta/.test(out.anfaenger));
    // Sheet == Karte (identische Datenbasis)
    MODE='profi';globalThis.__sheet=null;globalThis.openPlanQualitySheet();
    ok('Sheet zeigt denselben Status + beide Warnungen', !!globalThis.__sheet&&globalThis.__sheet.body.includes('data-pq-rating="y"')&&globalThis.__sheet.body.includes(W1[0])&&globalThis.__sheet.body.includes(W2[0])&&globalThis.__sheet.body.includes('moderat'));
    // Kein UI-Re-Rating: inkonsistente Engine-Antwort wird verbatim übernommen
    FIX=deepFreeze({rating:{l:'riskant',c:'r'},warns:[]});
    el('planQualityBox').innerHTML='';globalThis.renderPlanQuality();
    ok('kein UI-Re-Rating: riskant trotz 0 Warnungen verbatim (‼)', el('planQualityBox').innerHTML.includes('riskant')&&el('planQualityBox').innerHTML.includes('data-pq-rating="r"')&&/‼/.test(el('planQualityBox').innerHTML));
    // Grün nur aus kanonisch positivem Ergebnis
    FIX=deepFreeze({rating:{l:'gut',c:'g'},warns:[]});
    el('planQualityBox').innerHTML='';globalThis.renderPlanQuality();
    const gOut=el('planQualityBox').innerHTML;
    ok('gut-Status: ✓ + gut, 0 Warnzeilen', /✓/.test(gOut)&&gOut.includes('gut')&&gOut.includes('data-pq-warns="0"')&&!/pqv5-w"/.test(gOut));
    // Escaping (Titel/Erklärung laufen durch HTML-Escape)
    FIX=deepFreeze({rating:{l:'moderat',c:'y'},warns:[['<i>Injiziert</i>','x<b>y</b>']]});
    el('planQualityBox').innerHTML='';globalThis.renderPlanQuality();
    ok('Warntexte werden HTML-escaped', !el('planQualityBox').innerHTML.includes('<i>')&&el('planQualityBox').innerHTML.includes('&lt;i&gt;'));
  }
}
console.log('\n'+(fail?fail+' FAILED':'plan_quality_v5: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
