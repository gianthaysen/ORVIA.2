/* ORVIA · GM2 — vollständige Planseite in Golden-Master-Struktur (finale aktive planView).
   Referenz ausschließlich die letzte planView-Zuweisung des GM (pvar/session-card/pq-grid/
   fc-corridor/phase-track/vol-row/daily-goals). Kein plan-hero der überschriebenen Altansicht,
   keine week-days, kein Tagebuch. Engine read-only, Missingness schrumpft die Struktur nie.
   node supabase/tests/gm2_plan_parity_test.mjs */
import fs from 'fs';
import { createRequire } from 'node:module';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const _req = createRequire(import.meta.url);
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
/* Zwei Checkout-Layouts (Cloud: ../../, Geraet: App unter ../../../app/). */
const APPPFX=fs.existsSync(new URL(_APPREL + 'index.html',import.meta.url))?_APPREL + '':_APPREL + '../app/';
const R=p=>fs.readFileSync(new URL(p.replace(/^\.\.\/\.\.\/(js\/|styles\.css|index\.html|sw\.js)/,APPPFX+'$1'),import.meta.url),'utf8');
const html=R(_APPREL + 'index.html'), ui=R(_APPREL + 'js/ui.js'), css=R(_APPREL + 'styles.css'), sw=R(_APPREL + 'sw.js');

const fi=ui.indexOf('/* ====== GM2:');
const fe=ui.indexOf('/* ====== GM2-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('GM2-Markerblock mit renderGMPlan existiert', fi>=0&&/function renderGMPlan\(/.test(blk));
ok('#gmPlan-Host als erstes Element im Plan-Tab', /id="tab-plan"[^>]*>\s*<div id="gmPlan">/.test(html.replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ').replace(/> </g,'><').replace(/></g,'>\n<').replace(/\n/g,'')) || (html.indexOf('id="gmPlan"')>0&&html.indexOf('id="gmPlan"')<html.indexOf('id="raceHeader"')));
ok('Plan-Legacy per Kaskade deaktiviert (#tab-plan>*:not(#gmPlan))', /#tab-plan>:not\(#gmPlan\):not\(#gmPage\)\{display:none/.test(css.replace(/\s/g,'')));
ok('SW-Version genau einmal definiert und nicht zurueckgedreht (>= v8-219)',
   (function(){var m=sw.match(/const C = 'orvia-v8-(\d+)'/);
    return !!m && parseInt(m[1],10) >= 219 && (sw.match(/orvia-v8-\d+/g)||[]).length===1;})(),
   /* Vorher war die Versionsnummer als Literal verdrahtet. Jeder Release-Bump brach
      dadurch zehn Tests auf einmal, ohne dass ein echter Vertrag verletzt war. Der
      Vertrag ist: GENAU EINE Version im sw.js (keine Altreferenz) und kein Rueckschritt.
      Muster uebernommen aus profile_editor_bugfix_test.mjs, das es bereits so macht. */);
ok('keine UI-Variantenberechnung/Planmutation im Block', !/generateWeekPlan|savePlanEdit|PROFILE\.weekPlan=|saveProfile\(/.test(blk));
ok('keine Demo-Zahlen (86/79\\/100/1:52/19\\/34)', !/Gesamt 79|86,|'19\/34'|1:5[24]/.test(blk));
ok('kein Tagebuch/week-days im Block (plan-hero nur in der Session-Vollseite)', !/tb-strip|week-days|Tagebuch/.test(blk));

if(blk){
  const els={};const mk=id=>({id,innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},contains:()=>false},setAttribute(){},focus(){}});
  const el=id=>els[id]||(els[id]=mk(id));
  globalThis.document={getElementById:id=>el(id),createElement:t=>mk('x'),addEventListener(){},querySelectorAll:()=>[],activeElement:null};
  globalThis.window=globalThis;
  /* Die Engine-Module, die der Block wirklich benutzt — ohne sie prueft der Test
     nur den Ausfallpfad. plan-variants rechnet die Variantenzaehler, load-profile
     liefert ihm die Kernreiz-Einstufung. */
  _req(new URL(APPPFX+'js/engine/load-profile.js', import.meta.url).pathname);
  _req(new URL(APPPFX+'js/engine/plan-variants.js', import.meta.url).pathname);
  globalThis.escH=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  globalThis.gmEsc=globalThis.escH;globalThis.esc=globalThis.escH;
  globalThis.icon=()=>'<svg class="ic"></svg>';globalThis.SC={};globalThis.TINT={};
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.GM_NA='Noch nicht verfügbar';
  globalThis.todayStr=d=>{const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  globalThis.DAYNAMES=['Mo','Di','Mi','Do','Fr','Sa','So'];
  globalThis.TYPES={Laufen:{ic:'<svg class="ic"></svg>'},Gym:{ic:'<svg class="ic"></svg>'},Rad:{ic:'<svg class="ic"></svg>'},Schwimmen:{ic:'<svg class="ic"></svg>'},Mobilität:{ic:'<svg class="ic"></svg>'}};
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.gmLevel=()=>MODE==='anfaenger'?'a':MODE==='profi'?'p':'f';
  globalThis.gmOpenSheet=()=>{};globalThis.gmCloseSheets=()=>{};
  globalThis.RACE={date:'2026-09-05'};
  globalThis.daysTo=()=>46;
  globalThis.isRunDistanceGoal=()=>true;
  globalThis.goalOf=()=>({type:'half_marathon',raceDate:'2026-09-05'});
  const deepFreeze=o=>{Object.getOwnPropertyNames(o).forEach(k=>{if(o[k]&&typeof o[k]==='object')deepFreeze(o[k]);});return Object.freeze(o);};
  const WEEK=deepFreeze([[{t:'Laufen',l:'Intervalle',d:'iv',id:'s1'}],[],[{t:'Gym',l:'Ganzkörper',d:'45 min',id:'s2'}],[],[{t:'Laufen',l:'Long Run',d:'lr',id:'s3'}],[],[]]);
  globalThis.activeWeekPlan=()=>WEEK;const WEEKJSON=JSON.stringify(WEEK);
  /* v8-315: gmPlanForOffset ist — wie unitPriority weiter unten — eine produktive
     Funktion AUSSERHALB des GM2-Blocks (sie lebt beim kanonischen Planmodell).
     Hier als Fixture am SELBEN Vertrag nachgestellt: {days, provenance, weekKey}.
     Bewusst NICHT die Rechnung des Pruesflings nachgebaut — der Block bekommt
     fuer Offset 0 exakt dieselbe Woche wie zuvor, damit die Sektionsfolge
     weiterhin gegen unveraenderte Eingaben geprueft wird. */
  globalThis.gmPlanForOffset=off=>({days:WEEK,provenance:off?'recurring_preview':'current',weekKey:'2026-W33'});
  globalThis.GM_PROV_NOTE={planned_week:null,recurring_preview:'Vorschau',loading:'…'};
  const now=new Date();const wd=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-wd);
  const monKey=globalThis.todayStr(mon);
  globalThis.planActualResolveForDates=()=>({byOcc:{['po:'+monKey+':s1']:{state:'completed'}},resolverAvailable:true});
  const PQ=deepFreeze({rating:{l:'moderat',c:'y'},warns:[['Harte Tage direkt hintereinander','Zwischen zwei harte Einheiten einen leichten Tag legen.']]});
  globalThis.planQualityChecks=()=>PQ;const PQJSON=JSON.stringify(PQ);
  globalThis.Calc={runnaWeek:()=>14,resolvePlanActual:()=>({}),
    racePhases:()=>[{n:'Aufbau',from:'2026-06-01',to:'2026-08-02',d:'x',on:true},{n:'Peak',from:'2026-08-03',to:'2026-08-23',d:'x',on:false},{n:'Taper',from:'2026-08-24',to:'2026-09-05',d:'x',on:false},{n:'Race',from:'2026-09-06',to:'2026-09-06',d:'x',on:false}],
    weekKmTarget:(d,a)=>a===0?34:a===1?36:a===2?26:38,
    effectiveKmTarget:(cal,l3)=>33};
  globalThis.weekRunKm=off=>({0:19.4,1:27,2:30}[off]!==undefined?{0:19.4,1:27,2:30}[off]:null);
  globalThis.planEntryClick=()=>{};
  /* Planvarianten (2026-08-04): unitPriority ist eine produktive Funktion AUSSERHALB
     des GM2-Blocks (ui.js) — hier als Fixture am selben Vertrag nachgestellt, exakt
     wie planQualityChecks/activeWeekPlan weiter oben. Fixture-Woche: s1 Intervalle
     (Kern A), s2 Gym (Aufbau B), s3 Long Run (Kern A). localStorage fehlt bewusst —
     die Auswahl muss dann fail-safe auf Variante A stehen. */
  globalThis.unitPriority=it=>it.t==='Laufen'?'A':it.t==='Gym'?'B':'C';
  /* v8-323: die Gym-Karte ruft jetzt gmPlannedLinesHTML() auf (geplante
     Kraftuebungen). Dieser Test prueft die STRUKTUR der Planseite, nicht die
     Uebungsanzeige — dafuer ist strength_plan_ui_e2e_test zustaendig. Fixture
     liefert deshalb bewusst '' (Item ohne Vorgaben), genau wie die uebrigen
     Stubs hier (activeWeekPlan, unitPriority). Die Ausgabe liegt ohnehin
     INNERHALB von .session-main und beruehrt die geprueften Blockklassen
     nicht — waere das anders, muesste diese Zeile echt werden. */
  globalThis.gmPlannedLinesHTML=()=>'';
  /* v8-332b: dieselbe Begruendung fuer die Ausdauer-Vorgabe. Auch sie liegt
     INNERHALB von .session-main und beruehrt die hier geprueften Blockklassen
     nicht. Der Stub liefert '' — was die Karte mit einer echten Verordnung
     zeigt, prueft rx_preview_ui_test im Browser. */
  globalThis.gmRxLinesHTML=()=>'';
  let evalOk=true,err='';
  try{(0,eval)(blk);}catch(e){evalOk=false;err=String(e);}
  ok('Block evaluiert mit Fixtures', evalOk, err);
  if(evalOk){
    const out={};
    for(const m of ['anfaenger','fortgeschritten','profi']){MODE=m;el('gmPlan').innerHTML='';globalThis.renderGMPlan();out[m]=el('gmPlan').innerHTML;}
    const seq=h=>[...h.matchAll(/<div class="(hdr|sectlabel|pvar-row|card[^"]*|plan-list|daily-goals|tabspacer)"/g)].map(x=>x[1].split(' ')[0]);
    const F=['hdr','sectlabel','pvar-row','card','sectlabel','plan-list','sectlabel','card','sectlabel','card','sectlabel','card','sectlabel','card','sectlabel','daily-goals','tabspacer'];
    const A=['hdr','sectlabel','pvar-row','card','sectlabel','plan-list','sectlabel','card','sectlabel','daily-goals','tabspacer'];
    ok('F: exakte GM-Sektionsfolge', seq(out.fortgeschritten).join('|')===F.join('|'), seq(out.fortgeschritten).join('|'));
    ok('P: identisch zu F', seq(out.profi).join('|')===F.join('|'));
    ok('A: Prognose/Phasen/Wochen-km ausgeblendet wie im GM', seq(out.anfaenger).join('|')===A.join('|'), seq(out.anfaenger).join('|'));
    /* AKTUALISIERT (2026-08-04, Produktentscheidung — analog KF-018): Die alten
       Assertions verlangten den ATTRAPPEN-Zustand (B fest „ausgewählt" + „Empfohlen"
       ohne Funktion, 4 Zellen hart „—"). Neuer Vertrag: A/B/C sind echte, waehlbare
       Teilmengen des realen Plans; Standard ist A (Optimal); die Zellen zeigen echte
       Zahlen aus dem Fixture-Plan (A: 3 Einheiten, 3 Trainingstage, 2 Kernreize,
       4 Ruhetage); keine Zeit-/Belastungsprognose (ZEITBEDARF/BELASTUNG entfernt). */
    ok('pvar A/B/C waehlbar, Standard A, echte Zaehler, Sheet erreichbar',
       (out.fortgeschritten.match(/<button class="pvar/g)||[]).length===3
       &&/class="pvar on"[^>]*gmSetPlanVariant\('A'\)/.test(out.fortgeschritten)
       &&(out.fortgeschritten.match(/gmSetPlanVariant\('/g)||[]).length===3
       &&/gmOpenVariantSheet/.test(out.fortgeschritten));
    ok('Variantenkarte: echte Zellen EINHEITEN/TRAININGSTAGE/KERNREIZE/RUHETAGE, kein Schein-Zustand',
       (out.fortgeschritten.match(/class="wp"/g)||[]).length===4
       &&/<b>3<\/b><span>EINHEITEN/.test(out.fortgeschritten)
       &&/<b>3<\/b><span>TRAININGSTAGE/.test(out.fortgeschritten)
       &&/<b>2<\/b><span>KERNREIZE/.test(out.fortgeschritten)
       &&/<b>4<\/b><span>RUHETAGE/.test(out.fortgeschritten)
       &&!/ZEITBEDARF|BELASTUNG<|Empfohlen/.test(out.fortgeschritten)
       &&/Variante A · Vollständig/.test(out.fortgeschritten));
    ok('Wochenliste: exakt Fixture-Sessions in Reihenfolge + Ruhetage', (()=>{const s=[...out.fortgeschritten.matchAll(/data-sid="([^"]*)"/g)].map(x=>x[1]);return s.join(',')==='s1,s2,s3'&&(out.fortgeschritten.match(/session-card rest/g)||[]).length===4;})());
    ok('Completed nur aus Resolver (s1 Erledigt), sonst neutral —', /data-sid="s1"[\s\S]{0,400}?Erledigt/.test(out.fortgeschritten)&&!/data-sid="s2"[\s\S]{0,400}?Erledigt/.test(out.fortgeschritten.split('data-sid="s3"')[0].split('data-sid="s2"')[1]||''));
    ok('keine Kern/Geschützt/Flexibel-Ableitung', !/Kern<|Geschützt|Flexibel/.test(out.fortgeschritten));
    ok('pq-grid: exakt 6 Zellen, Werte —, kanonisches Rating in mini-note', (out.fortgeschritten.match(/class="pq"/g)||[]).length===6&&/moderat/.test(out.fortgeschritten)&&/Harte Tage direkt hintereinander/.test(out.fortgeschritten)&&!/pqv-num/.test(out.fortgeschritten));
    ok('Prognose: 3 Zeitwerte —, neutraler Korridor ohne Marker, NA-Hinweis', /vorsichtig —/.test(out.fortgeschritten)&&/optimistisch —/.test(out.fortgeschritten)&&!/fc-mid/.test(out.fortgeschritten)&&/Noch nicht verfügbar/.test(out.fortgeschritten));
    /* Redesign 2026-08-05 (Nutzerentscheidung): Die frueheren .phase-track-Chips waren
       strukturell zu eng (jeder Phasenname musste in ~60 px passen — erst Ueberlappung,
       dann Ellipsis, dann Umbruch, nie lesbar). Ersetzt durch textfreie Segmentleiste
       (.ph-bar) + grosse aktuelle Phase (.ph-now) + Vollbreiten-Liste (.ph-list).
       Der Test prueft weiterhin dieselbe INHALTLICHE Zusage — die aktuelle Phase kommt
       aus dem kanonischen `on`-Feld —, nur an der neuen Struktur. */
    ok('Phasen: Segmentleiste + aktuelle Phase gross aus kanonischem on (kein enges Chip-Raster mehr)',
       /ph-bar/.test(out.fortgeschritten)&&/ph-list/.test(out.fortgeschritten)
       &&/class="ph-now"><b>Aufbau</.test(out.fortgeschritten)
       &&/class="ph-row now"/.test(out.fortgeschritten));
    ok('Phasen: kein Text mehr in den Segmenten (dort kann per Konstruktion nichts abgeschnitten werden)',
       !/class="ph-seg[^"]*"[^>]*>[^<]+</.test(out.fortgeschritten));
    ok('Wochen-km: exakt 6 vol-col; Vergangenheit ohne Plan ⇒ —; Zukunft aus weekKmTarget', (out.fortgeschritten.match(/class="vol-col"/g)||[]).length===6&&/>36</.test(out.fortgeschritten)&&/>38</.test(out.fortgeschritten));
    ok('Tagesziele: 4 Plätze, Istwerte —, keine Demo-Istwerte', (out.fortgeschritten.match(/class="daily-goal"/g)||[]).length===4&&!/3\.240|7:42/.test(out.fortgeschritten)&&/— \//.test(out.fortgeschritten));
    ok('Hauptansicht ohne plan-hero (nur Session-Vollseite nutzt ihn)', !/plan-hero/.test(out.fortgeschritten));
    ok('endet mit tabspacer', /tabspacer"><\/div>\s*$/.test(out.fortgeschritten.trim())||out.fortgeschritten.lastIndexOf('tabspacer')>out.fortgeschritten.lastIndexOf('daily-goals'));
    ok('Fixtures nicht mutiert', JSON.stringify(WEEK)===WEEKJSON&&JSON.stringify(PQ)===PQJSON);
    ok('Session-Aktion planEntryClick verdrahtet', /planEntryClick\(0,0,'\d{4}-\d{2}-\d{2}'\)/.test(out.fortgeschritten)&&/planEntryClick\(4,0,'\d{4}-\d{2}-\d{2}'\)/.test(out.fortgeschritten));
    ok('kein E1–E4-Legacy-Markup im GM2-Output', !/phv5|wkv5|pqv5|sess5|pweek-nav/.test(out.fortgeschritten));
    // Session-Vollseite
    globalThis.unitKind=()=>'interval';globalThis.planNoteFor=it=>null;globalThis.startPlannedUnit=()=>{};
    if(typeof globalThis.gmOpenSessionPage==='function'){
      globalThis.gmOpenSessionPage(0,0);
      const pg=el('gmPage').innerHTML;
      ok('Session-Vollseite: pageHead + plan-hero + 4 wp + coach-card', /page-head/.test(pg)&&/plan-hero/.test(pg)&&(pg.match(/class="wp"/g)||[]).length===4&&/coach-card/.test(pg));
      ok('Session-KPIs ohne Quelle ⇒ —, Coach ohne kanonischen Text ⇒ Missing-State', (pg.match(/<b>—<\/b>/g)||[]).length>=3&&/noch nicht verfügbar|Noch nicht verfügbar/.test(pg));
    } else ok('gmOpenSessionPage existiert', false);
  }
}
console.log('\n'+(fail?fail+' FAILED':'gm2_plan_parity: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
