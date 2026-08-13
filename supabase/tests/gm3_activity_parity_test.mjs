/* ORVIA · GM3 — Aktivitäten-Hub, Aktivitätsdetail und Start-Einstieg in Golden-Master-Struktur.
   Referenz AUSSCHLIESSLICH die finale aktive activityView-Zuweisung des GM
   (hdr → hub-actions(5) → subtabs → kpi-row → Verteilungs-card (nur F/P) →
   hub-actions(2) → filter-row(5) → activity-list → tabspacer) sowie die im finalen
   Router aktive activityDetailView und das Start-Sheet (sport-grid → Pre-Start).
   Keine alte Summary/Toolbar/Legacy-Liste. Store/Import/Dedupe/Matching read-only,
   keine UI-Aggregation roher Aktivitäten, Missingness wird nie zu Null.
   node supabase/tests/gm3_activity_parity_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
/* Zwei Checkout-Layouts (Cloud: ../../, Geraet: App unter ../../../app/). */
const APPPFX=fs.existsSync(new URL(_APPREL + 'index.html',import.meta.url))?_APPREL + '':_APPREL + '../app/';
const R=p=>fs.readFileSync(new URL(p.replace(/^\.\.\/\.\.\/(js\/|styles\.css|index\.html|sw\.js)/,APPPFX+'$1'),import.meta.url),'utf8');
const html=R(_APPREL + 'index.html'), ui=R(_APPREL + 'js/ui.js'), css=R(_APPREL + 'styles.css'), sw=R(_APPREL + 'sw.js');

const fi=ui.indexOf('/* ====== GM3:');
const fe=ui.indexOf('/* ====== GM3-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('GM3-Markerblock mit renderGMActivity existiert', fi>=0&&/function renderGMActivity\(/.test(blk));
ok('#gmAkt-Host im Aktivitäten-Tab, #gmActPage-Overlay vorhanden', html.includes('id="gmAkt"')&&html.includes('id="gmActPage"'));
ok('Aktivitäten-Legacy per Kaskade deaktiviert (#tab-akt>*:not(#gmAkt))', /#tab-akt>:not\(#gmAkt\):not\(#gmActPage\)\{display:none/.test(css.replace(/\s/g,'')));
ok('SW-Version genau einmal definiert und nicht zurueckgedreht (>= v8-219)',
   (function(){var m=sw.match(/const C = 'orvia-v8-(\d+)'/);
    return !!m && parseInt(m[1],10) >= 219 && (sw.match(/orvia-v8-\d+/g)||[]).length===1;})(),
   /* Vorher war die Versionsnummer als Literal verdrahtet. Jeder Release-Bump brach
      dadurch zehn Tests auf einmal, ohne dass ein echter Vertrag verletzt war. Der
      Vertrag ist: GENAU EINE Version im sw.js (keine Altreferenz) und kein Rueckschritt.
      Muster uebernommen aus profile_editor_bugfix_test.mjs, das es bereits so macht. */);
ok('renderAkt-Override: GM3 übernimmt den aktiven Pfad UI-seitig', /renderAkt\s*=\s*function/.test(blk)&&/renderGMActivity\(\)/.test(blk));
/* Nur die FINALE activityView: keine alte Summary/as-grid, kein act-actions-Toolbar-Markup */
ok('keine überschriebene Altansicht (activity-summary/as-grid/act-actions)', !/activity-summary|as-grid|act-actions/.test(blk));
/* Demo-Verbote der GM-Vorlage */
ok('keine Demo-Gerätenamen/-Metriken (vívoactive/26:14/sub-55/Readiness 82/Demo-Splits)', !/vívoactive|vívoactive|26:14|sub-55|Readiness 82|6\.48,6\.36/.test(blk));
/* Kalibrierung GM7.7: der einzige reduce im Block ist der Ø-Baselinewert EINER bereits
   kanonischen Messreihe fuer den Chart (Praesentation, wie in den Metrik-Sheets) — kein
   Summieren roher Aktivitaeten. Verboten bleibt jede Aggregation ueber Activities. */
ok('keine UI-Ersatzaggregation (kein reduce/Summieren roher Activities im Renderer)', !/dist\s*\+=|km\s*\+=|kcal\s*\+=/.test(blk)&&!/\.reduce\(/.test(blk.replace(/c\.vals\.reduce\(function\(a,b\)\{return a\+b;\},0\)/g,'')));
ok('kanonische Aggregatoren angebunden (weeklyActivityTotals/weekRunKm, listActivitiesUnified, activityDetailViewModel)', /weeklyActivityTotals|weekRunKm/.test(blk)&&/listActivitiesUnified/.test(blk)&&/activityDetailViewModel/.test(blk));
ok('keine Sportarterkennung aus Titeln / keine Statusableitung', !/title\.match|title\.includes|\.l\.match/.test(blk)&&!/status\s*=\s*['"]/.test(blk));
ok('keine Planmutation im Block', !/savePlanEdit|PROFILE\.weekPlan\s*=|saveProfile\(|generateWeekPlan/.test(blk));
ok('kein zusätzlicher globaler keydown-Listener im Block', !/addEventListener\(\s*['"]keydown/.test(blk));

if(blk){
  /* ---------- Sandbox: DOM-Mock + eingefrorene Fixtures ---------- */
  const els={};
  const mk=id=>({id,innerHTML:'',textContent:'',style:{},classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},contains(c){return this._s.has(c);}},setAttribute(){},focus(){},scrollTop:0});
  const el=id=>els[id]||(els[id]=mk(id));
  globalThis.document={getElementById:id=>el(id),createElement:()=>mk('x'),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:{appendChild(){}}};
  globalThis.window=globalThis;
  globalThis.escH=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  globalThis.gmEsc=globalThis.escH;globalThis.esc=globalThis.escH;
  globalThis.icon=()=>'<svg class="ic"></svg>';
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.fmtDate=d=>d;
  globalThis.GM_NA='Noch nicht verfügbar';
  globalThis.todayStr=d=>{const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
  globalThis.DAYNAMES=['Mo','Di','Mi','Do','Fr','Sa','So'];
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.gmLevel=()=>MODE==='anfaenger'?'a':MODE==='profi'?'p':'f';
  globalThis.RACE={date:'2026-09-05'};globalThis.daysTo=()=>42;
  const deepFreeze=o=>{Object.getOwnPropertyNames(o).forEach(k=>{if(o[k]&&typeof o[k]==='object')deepFreeze(o[k]);});return Object.freeze(o);};
  /* Kanonische vereinheitlichte Liste — Reihenfolge/IDs sind der Vertrag. x3 ohne Distanz/HF
     (Missingness), x4 unbekannte Sportart (bleibt unter „Alle"). */
  const ACTS=deepFreeze([
    {id:'x1',clientRecordId:'x1',sportId:'running',startedAt:'2026-07-22T18:05:00',durationSeconds:2560,status:'completed',source:'import',summary:{distanceKm:6.5,avgHr:148},_legacy:null},
    {id:'x2',clientRecordId:'x2',sportId:'gym',startedAt:'2026-07-21T17:30:00',durationSeconds:3252,status:'completed',source:'orvia_workout',summary:{exerciseCount:8,rpe:7}},
    {id:'x3',clientRecordId:'x3',sportId:'running',startedAt:'2026-07-20T09:00:00',durationSeconds:null,status:'completed',source:'manual',summary:{}},
    {id:'x4',clientRecordId:'x4',sportId:'tennis',startedAt:'2026-07-19T10:00:00',durationSeconds:3600,status:'completed',source:'manual',summary:{}}
  ]);
  const ACTSJSON=JSON.stringify(ACTS);
  globalThis.listActivitiesUnified=()=>ACTS;
  /* Kanonisches Detail-View-Model (AD1b) — Missingness bleibt null, wird NIE 0. */
  globalThis._resolveActivityAny=aid=>ACTS.find(a=>a.clientRecordId===aid||a.id===aid)||null;
  globalThis.activityDetailViewModel=a=>({id:a.clientRecordId,sportId:a.sportId,sportLabel:({running:'Laufen',gym:'Krafttraining',tennis:'Tennis'})[a.sportId]||'Aktivität',
    title:a.sportId==='running'?(a.clientRecordId==='x3'?null:'Lockerer Dauerlauf'):a.sportId==='gym'?'Unterkörper · Stabilität':null,
    date:a.startedAt?a.startedAt.slice(0,10):null,time:a.startedAt?a.startedAt.slice(11,16):null,
    durationSeconds:a.durationSeconds,durationLabel:a.durationSeconds!=null?Math.round(a.durationSeconds/60)+' min':null,
    distanceLabel:(a.summary&&a.summary.distanceKm!=null)?fmtDe(a.summary.distanceKm)+' km':null,
    paceLabel:(a.summary&&a.summary.distanceKm&&a.durationSeconds)?'6:34/km':null,
    elevationM:null,avgHr:(a.summary&&a.summary.avgHr!=null)?a.summary.avgHr:null,maxHr:null,caloriesKcal:null,
    source:a.source,planLink:null,workoutDetail:null,storyRef:a.clientRecordId==='x1'?{date:'2026-07-22',typ:'Laufen'}:null,
    missing:{}});
  /* Kanonischer Wochenvertrag (DT1) — Werte stammen NUR hierher, nicht aus der Liste. */
  const WK=deepFreeze({weekStart:'2026-07-20',weekEnd:'2026-07-26',timezone:'UTC',
    totals:{sessionCount:3,durationMin:179,knownDurationMin:179,distanceKm:null,knownDistanceKm:6.5,loadUnits:null,knownLoadUnits:0,completeness:{duration:true,distance:false,load:false}},
    bySport:{running:{sessionCount:2,knownDurationMin:85,knownDistanceKm:6.5,knownLoadUnits:0,completeness:{duration:true,distance:false,load:false}},gym:{sessionCount:1,knownDurationMin:54,knownDistanceKm:0,knownLoadUnits:0,completeness:{duration:true,distance:true,load:false}},tennis:{sessionCount:1,knownDurationMin:60,knownDistanceKm:0,knownLoadUnits:0,completeness:{duration:true,distance:true,load:false}}},
    provenance:{activityIds:['x1','x2','x3','x4'],excludedDuplicateIds:[],missingFields:[]}});
  globalThis.ORVIA={activityStore:{listActivities:()=>ACTS,isTombstoned:()=>false},
    activityConfig:{weeklyActivityTotals:()=>WK,sportLabel:id=>({running:'Laufen',gym:'Krafttraining',tennis:'Tennis'})[id]||'Aktivität'},
    profileStore:{effectiveTimezone:()=>'UTC'},
    workoutUI:{startSport:(s,o)=>{calls.startSport.push([s,o||null]);}}};
  globalThis.DB={'2026-07-22':{sessions:{Laufen:{dist:6.5,dur:42,splits:[{km:1,sec:389},{km:2,sec:396},{km:3,sec:382},{km:4,sec:391},{km:5,sec:377},{km:6,sec:385}],route:[[47.1,11.1],[47.2,11.2],[47.3,11.15]]}}}};
  globalThis.actRoute=s=>(s&&Array.isArray(s.route)&&s.route.length>1)?s.route:null;
  globalThis.routeSVG=r=>'<svg class="gm-route-svg" data-pts="'+r.length+'"></svg>';
  globalThis.rateActivity=(typ,s)=>(typ==='Laufen'&&s&&s.dist&&s.dur)?{badge:'kontrolliert',cls:'g',txt:'Sauber im Easy-Bereich.',next:'So weitermachen.'}:null;
  const WEEK=deepFreeze([[],[],[],[],[{t:'Laufen',l:'Tempolauf 3×8',d:'tempo',id:'s9'}],[],[]]);
  globalThis.activeWeekPlan=()=>WEEK;const WEEKJSON=JSON.stringify(WEEK);
  const calls={startSport:[],startPlanned:[],manual:0,importSheet:0};
  globalThis.startPlannedUnit=(di,ii)=>{calls.startPlanned.push([di,ii]);};
  globalThis.openManualActivity=()=>{calls.manual++;};
  globalThis.openImportSheet=()=>{calls.importSheet++;};
  globalThis._fetchServerActivities=()=>{};
  globalThis.weekRunKm=off=>off===0?6.5:null;
  globalThis.getDecision=()=>({title:'Stabil bleiben',reco:'Heute wie geplant trainieren.'});
  globalThis.gmOpenSheet=()=>{};globalThis.gmCloseSheets=()=>{};globalThis.closeSheets=()=>{};
  globalThis.openSheet=id=>{sheetOpened=id;};let sheetOpened=null;
  globalThis.toast=()=>{throw new Error('toast im GM3-Pfad (vorgetäuschte Funktion)');};
  globalThis.renderAkt=function(){};/* wird vom Block überschrieben */
  let evalOk=true,err='';
  try{(0,eval)(blk);}catch(e){evalOk=false;err=String(e);}
  ok('Block evaluiert mit Fixtures', evalOk, err);

  if(evalOk){
    els['gmAkt']=mk('gmAkt');
    renderGMActivity();
    const H=els['gmAkt'].innerHTML;
    /* 1) exakte Hub-Reihenfolge */
    const seq=['class="hdr"','hub-actions','class="subtabs"','kpi-row','dist-bar','hub-actions','filter-row','activity-list','tabspacer'];
    let pos=-1,ordOk=true,which='';
    for(const s of seq){const i=H.indexOf(s,pos+1);if(i<0||i<pos){ordOk=false;which=s;break;}pos=i;}
    ok('Hub-Reihenfolge exakt (hdr→Aktionen→subtabs→KPI→Verteilung→Teaser→Filter→Liste→tabspacer)', ordOk, which);
    ok('Hub endet nach .tabspacer', /tabspacer"><\/div>\s*$/.test(H));
    ok('Header: Trainingszentrale + Aktivitäten + Verbindungs-Button (bestehender Import-/Verbindungs-Einstieg)', /Trainingszentrale/.test(H)&&/<h1>Aktivitäten<\/h1>/.test(H)&&/openImportSheet\(\)/.test(H));
    /* 2) genau 5 primäre Aktions-Slots, Reihenfolge + ehrliche NA-Deaktivierung */
    const first=H.slice(H.indexOf('hub-actions'),H.indexOf('subtabs'));
    ok('erste hub-actions: genau 5 Slots', (first.match(/class="hub-act/g)||[]).length===5, String((first.match(/class="hub-act/g)||[]).length));
    ok('Slot-Reihenfolge: Starten/Geplant/Frei/Manuell/Wiederholen', ['Training starten','Geplante Einheit','Freies Training','Manuell hinzufügen','Letzte wiederholen'].every((t,i,arr)=>{const p=first.indexOf(t);return p>=0&&(i===0||p>first.indexOf(arr[i-1]));}));
    ok('Geplante Einheit zeigt heutige kanonische Session', /Tempolauf 3×8|Heute: —/.test(first));
    /* Testkalibrierung: die Fixture (ACTS x1..x4) hat eine echte letzte Aktivität (x1, Laufen
       22.07.), listActivitiesUnified(1) liefert sie real -> der Slot ist AKTIV mit echtem
       Handler (gmOpenStartSheet('repeat'), ui.js:5104 „Letztes Training wiederholen") und
       echtem Label (Sportart + Distanz aus activityDetailViewModel), NICHT deaktiviert. Der
       leere/deaktivierte Zweig („Noch keine Aktivität") existiert weiterhin im Code für den
       Fall ohne jede Aktivität — hier nur nicht der aktive Pfad. */
    ok('„Letzte wiederholen": echter Handler + echtes Label aus der letzten Aktivität, keine Demo-Aktion', /onclick="gmOpenStartSheet\('repeat'\)"/.test(first)&&/Letzte wiederholen/.test(first)&&/Laufen/.test(first.slice(first.indexOf('Letzte wiederholen')))&&!/hub-act[^>]*disabled[^>]*repeat|repeat[^>]*disabled/.test(first));
    /* 3) KPI-Slots: F 6, A 3; nur kanonische Werte, Rest — */
    const kpis=(H.match(/class="kpi"/g)||[]).length;
    ok('F: sechs KPI-Zellen', kpis===6, String(kpis));
    ok('KPI Distanz eindeutig als Laufdistanz + kanonischer Wert', /6,5\s*km/.test(H)&&/Lauf/.test(H.slice(H.indexOf('kpi-row'),H.indexOf('dist-bar'))));
    ok('KPI kcal/Planerfüllung ohne Aggregator ⇒ —', (H.slice(H.indexOf('kpi-row'),H.indexOf('hub-actions',H.indexOf('kpi-row'))).match(/>—</g)||[]).length>=2);
    /* 4) Sportverteilung nur F/P, Segmente nur aus kanonischem Aggregator */
    ok('Verteilungs-Karte mit dist-bar + dist-leg (F)', /dist-bar/.test(H)&&/dist-leg/.test(H));
    MODE='anfaenger';renderGMActivity();const HA=els['gmAkt'].innerHTML;
    ok('A: drei KPI-Zellen, keine Verteilungs-Karte', (HA.match(/class="kpi"/g)||[]).length===3&&!/dist-bar/.test(HA));
    MODE='fortgeschritten';renderGMActivity();
    /* 5) Teaser + Filter */
    const H2=els['gmAkt'].innerHTML;
    const teaser=H2.slice(H2.lastIndexOf('hub-actions'),H2.indexOf('filter-row'));
    ok('genau 2 Teaser-Slots (Bestleistung/Meilenstein), ehrlich ohne Demo-Werte', (teaser.match(/class="hub-act/g)||[]).length===2&&/Bestleistung/.test(teaser)&&/Meilenstein/.test(teaser)&&!/26:14|sub-55/.test(teaser));
    ok('fünf GM-Filter', ['Alle','Laufen','Kraft','Radfahren','Schwimmen'].every(f=>H2.includes('>'+f+'<'))&&(H2.match(/filter-pill/g)||[]).length===5);
    /* 6) Aktivitätskarten: IDs+Reihenfolge exakt, GM-Markup, Missingness ⇒ — */
    const ids=[...H2.matchAll(/data-aid="([^"]+)"/g)].map(m=>m[1]);
    ok('Activity-IDs und Reihenfolge exakt aus der kanonischen Liste', JSON.stringify(ids)===JSON.stringify(['x1','x2','x3','x4']), ids.join(','));
    ok('GM-Kartenmarkup (activity-card/-visual/-body/-row/-metrics à 4 Zellen)', /activity-card/.test(H2)&&/activity-visual/.test(H2)&&/activity-body/.test(H2)&&/activity-row/.test(H2)&&(H2.match(/activity-metrics/g)||[]).length===4);
    const x3card=H2.slice(H2.indexOf('data-aid="x3"'),H2.indexOf('data-aid="x4"'));
    ok('fehlende Distanz/Dauer/Pace/HF ⇒ — (nie 0)', (x3card.match(/>—</g)||[]).length>=4&&!/>0 km<|>0 min<|>0 bpm</.test(x3card));
    ok('unbekannte Sportart bleibt unter „Alle" sichtbar', ids.includes('x4'));
    ok('Status nur kanonisch (kein „Analysiert" ohne Analyse-Status)', !/Analysiert/.test(H2));
    ok('Karten mit Tap + Enter und korrekter ID', /gmOpenActivityPage\('x1'\)/.test(H2)&&/tabindex="0"/.test(H2)&&/keydown/.test(H2)===false?/onkeydown/.test(H2):/onkeydown/.test(H2));
    /* 7) Filter-Verhalten + Empty-State */
    gmSetActivityFilter('Schwimmen');const HE=els['gmAkt'].innerHTML;
    ok('Filter ohne Treffer: GM-Empty-State (empty/e-ic/et)', /class="empty"/.test(HE)&&/e-ic/.test(HE)&&/Keine Aktivität in diesem Filter/.test(HE));
    gmSetActivityFilter('Laufen');
    ok('Filter Laufen: nur kanonische running-Aktivitäten', [...els['gmAkt'].innerHTML.matchAll(/data-aid="([^"]+)"/g)].map(m=>m[1]).join(',')==='x1,x3');
    gmSetActivityFilter('Alle');
    /* 8) Monat: strukturell vorhanden, ehrliche Missingness (kein kanonischer Monatsvertrag) */
    gmSetActScope('month');const HM=els['gmAkt'].innerHTML;
    ok('Monat: 6 KPI-Slots bleiben, Werte ehrlich —', (HM.match(/class="kpi"/g)||[]).length===6&&(HM.slice(HM.indexOf('kpi-row'),HM.indexOf('hub-actions',HM.indexOf('kpi-row'))).match(/>—</g)||[]).length===6);
    gmSetActScope('week');
    /* 9) Detailseite */
    gmOpenActivityPage('x1');
    const D=els['gmActPage'].innerHTML;
    ok('Detail x1: pageHead→route→detail-title→6 KPIs→coach-card→Chart+Splits', /page-head/.test(D)&&/route-map/.test(D)&&/detail-title/.test(D)&&(D.slice(D.indexOf('detail-kpis')).match(/<b>/g)||[]).length>=6&&/coach-card/.test(D)&&/split-row/.test(D));
    ok('Route nur aus echten GPS-Daten (routeSVG der kanonischen Route)', /gm-route-svg/.test(D)&&/data-pts="3"/.test(D));
    ok('Splits nur aus echten Splits (6 Zeilen, keine Demo-12)', (D.match(/split-row/g)||[]).length===6);
    ok('Debrief aus bestehender Bewertung, keine erfundene Analyse', /Sauber im Easy-Bereich/.test(D));
    gmOpenActivityPage('x3');
    const D3=els['gmActPage'].innerHTML;
    ok('Lauf ohne GPS/Serien: Route-Slot bleibt mit ehrlichem Empty-State, keine Demo-Route', /route-map/.test(D3)&&!/gm-route-svg/.test(D3)&&!/route-seg|map-pin/.test(D3)&&/route|GPS/i.test(D3));
    ok('Lauf ohne Splits: keine split-rows, ehrlicher Hinweis', (D3.match(/split-row/g)||[]).length===0);
    gmOpenActivityPage('x2');
    const D2=els['gmActPage'].innerHTML;
    ok('Kraftdetail: GM-Bedingung ohne Route/Chart/Splits, ÜBUNGEN/BELASTUNG-Zellen', !/route-map/.test(D2)&&!/split-row/.test(D2)&&/BUNGEN/.test(D2)&&/BELASTUNG/.test(D2));
    ok('Kraftdetail ohne kanonische Details ⇒ —, nie 0', !/>0</.test(D2));
    /* 10) Start-Sheet */
    els['detailSheet']=mk('detailSheet');
    gmOpenStartSheet();
    const S=els['detailSheet'].innerHTML;
    ok('Start-Sheet: Titel/Untertitel/sport-grid mit 7 Kacheln', /Training starten/.test(S)&&/sh-sub/.test(S)&&(S.match(/sport-tile/g)||[]).length===7);
    /* v8-312: jede Sport-Kachel braucht eine EIGENE Icon+Farb-Identität — vorher teilten
       sich Laufen/Fussball dieselbe Farbe (var(--ready)) und Fussball/Mobility nutzten
       zweckentfremdete Icons (target=Ziel/Readiness, moon=exklusiv Schlaf) aus anderen
       Kontexten des Produkts. Prüft konkret: alle 7 Hintergrundfarben paarweise
       verschieden; Fussball/Mobility hängen NICHT mehr an --ready/--sleep; das Fussball-
       und Mobility-Icon rendern das jeweils EIGENE, kanonische Pfad-Markup aus
       GM_SPORT_ICON_EXTRA (ball/stretch — identisch zu index.html #i-ball/#i-stretch,
       der bereits produktiven Ikone in Aktivitätenliste/Hub). WICHTIG: dieses Testfile
       stubbt globalThis.icon() auf ein leeres Platzhalter-SVG (s.o., Sandbox-Setup) —
       eine reine „ist nicht das target/moon-SVG"-Prüfung wäre daher unter dem Stub
       immer wahr (vacuous pass), egal welcher Icon-Key tatsächlich verwendet wird.
       Stattdessen wird POSITIV auf das eindeutige eigene Pfad-Fragment geprüft, das
       NUR über den GM_SPORT_ICON_EXTRA-Zweig entsteht (Stub-Bypass) — das faengt
       sowohl eine Rückkehr zu target/moon als auch ein versehentliches Vertauschen. */
    (function(){
      var tileRe=/<button class="sport-tile" onclick="gmStartSport\('([^']+)'\)"><span class="st-ic" style="background:([^;]+);color:#0c1017">(<svg[^]*?<\/svg>)<\/span>/g;
      var tiles={},bgs=[],m;
      while((m=tileRe.exec(S))){tiles[m[1]]={bg:m[2],svg:m[3]};bgs.push(m[2]);}
      var names=Object.keys(tiles);
      ok('Sport-Kacheln: 7 Icon/Farb-Paare extrahiert', names.length===7);
      ok('Sport-Kacheln: alle 7 Hintergrundfarben paarweise verschieden', new Set(bgs).size===7);
      ok('Fußball nutzt eigene Farbe (nicht var(--ready) wie Laufen)', tiles['Fußball']&&tiles['Fußball'].bg!==tiles['Laufen'].bg&&tiles['Fußball'].bg==='var(--team)');
      ok('Mobility nutzt eigene Farbe (nicht var(--sleep))', tiles['Mobility']&&tiles['Mobility'].bg==='var(--recovery)');
      ok('Fußball-Icon rendert das eigene Ball-Pfad-Fragment (nicht Zielscheibe/target, nicht der Icon-Stub)', tiles['Fußball']&&tiles['Fußball'].svg.indexOf('cx="12" cy="12" r="8.6"')>=0);
      ok('Mobility-Icon rendert das eigene Stretch-Pfad-Fragment (nicht Mond/moon, nicht der Icon-Stub)', tiles['Mobility']&&tiles['Mobility'].svg.indexOf('cx="12" cy="4.6" r="1.9"')>=0&&tiles['Mobility'].svg.indexOf('M12 7.4v6')>=0);
      ok('Fußball und Mobility haben unterschiedliches Icon-Markup', tiles['Fußball']&&tiles['Mobility']&&tiles['Fußball'].svg!==tiles['Mobility'].svg);
    })();
    gmStartSport('Laufen');
    const P=els['detailSheet'].innerHTML;
    /* Phase 1b (KF-007): Die Regel hat sich GEAENDERT. Vorher galt „Attrappe
   sichtbar, aber deaktiviert"; die Assertion zaehlte deshalb disabled-
   Vorkommen. Seit docs/ENTSCHEIDUNGEN-2026-08.md 1.1 gilt: kein sichtbares
   BEDIENELEMENT ohne funktionierenden Endzustand. Die ZEILEN bleiben
   (Anzeigeslot), das Schein-Bedienelement ist weg. Geprueft wird jetzt die
   neue Regel — die Absicht (nicht bedienbar, ehrlich beschriftet) ist
   unveraendert, nur der Nachweis. */
    /* AKTUALISIERT (Phase 3, E-21 · 2026-08-05): Das Start-Sheet traegt jetzt
       zusaetzlich DREI gemessene Vor-Start-Zeilen (Body Battery / Stress /
       Readiness aus Garmin-/Check-in-Daten) — die App stellt keine Fragen,
       deren Antwort bereits gemessen vorliegt. 6 Basiszeilen + 3 Messzeilen = 9;
       fehlende Messwerte bleiben ehrlich „—" (Zeile 199 prueft das weiter). */
    ok('Pre-Start: Segmente + prestart-Karte + 9 ps-rows (6 Basis + 3 Vor-Start-Messwerte) + Hinweis + Start-CTA',
       /subtabs/.test(P)&&/prestart/.test(P)&&(P.match(/ps-row/g)||[]).length===9&&/Vor-Start-Werte \(gemessen\)/.test(P)&&/mode-hint/.test(P)&&/Laufen starten/.test(P)&&/Wearable/.test(P));
    ok('Pre-Start Missingness bleibt — (keine erfundene Ausrüstung/Readiness/kein Wearable-Fake)', !/Uhr \+ Brustgurt|Garmin verbunden|Readiness 82/.test(P)&&(P.match(/>—</g)||[]).length>=3);
    ok('Safety-/Readiness-Hinweis aus kanonischer Ausgabe, nie ausgeblendet', /mode-hint/.test(P)&&/Heute wie geplant trainieren\.|Keine kanonische/.test(P));
    ok('Wearable-Uebergabe ohne Endzustand ist entfernt, die Zeile bleibt (Phase 1b)',
       !/Nur an Uhr übergeben/.test(P)&&/Wearable/.test(P));
    /* Start-CTA nutzt bestehenden produktiven Handler, kein Plan-/Fixture-Mutieren */
    gmStartFromPreStart&&gmStartFromPreStart();
    ok('Start nutzt produktiven Handler (workoutUI.startSport/startPlannedUnit), Plan unverändert',
       (calls.startSport.length+calls.startPlanned.length)>=1&&JSON.stringify(activeWeekPlan())===WEEKJSON);
    /* 11) Fixtures unverändert, keine Mutation */
    ok('Aktivitäten-Fixture unverändert (keine Mutation der Store-Objekte)', JSON.stringify(listActivitiesUnified())===ACTSJSON);
    /* 12) mehrfaches Rendern: keine Zustands-/Listener-Akkumulation, keine doppelten IDs */
    const before=els['gmAkt'].innerHTML.length;
    renderGMActivity();renderGMActivity();renderGMActivity();
    ok('3× Re-Render: identisches Markup (keine Akkumulation)', els['gmAkt'].innerHTML.length===before);
    const idm=[...els['gmAkt'].innerHTML.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
    ok('keine doppelten IDs im Hub-Markup', new Set(idm).size===idm.length, idm.join(','));
  }
}
console.log('\n'+(fail?fail+' FAILED':'gm3_activity_parity: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
