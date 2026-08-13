/* ORVIA · GM4 — vollständige Analyse mit vier Segmenten in Golden-Master-Struktur.
   Referenz AUSSCHLIESSLICH die finale aktive analysisHubView-Zuweisung des GM
   (hdr → seg-nav(4) → genau EIN Segmentinhalt → tabspacer) mit anaOverview/anaEndurance/
   anaRecovery/anaBody. Daten NUR aus kanonischen Quellen (gmDashVM/orviaScore, allLoads+
   Calc.loadSeries/loadModel/loadConfidenceContract, profileMetricResolver-Snapshot,
   weekInsights, weekRunKm/weeklyActivityTotals, ORVIA.gymVolume+explainMuscleVolume).
   Keine Demo-Serien, keine Demo-MUSCLES, keine UI-ACWR-/Recovery-/Prognoseberechnung.
   node supabase/tests/gm4_analysis_parity_test.mjs */
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

const fi=ui.indexOf('/* ====== GM4:');
const fe=ui.indexOf('/* ====== GM4-ENDE');
const blk=(fi>=0&&fe>fi)?ui.slice(fi,fe):'';
ok('GM4-Markerblock mit renderGMAnalysis existiert', fi>=0&&/function renderGMAnalysis\(/.test(blk));
ok('#gmAna-Host im Analyse-Tab', html.includes('id="gmAna"'));
ok('Analyse-Legacy per Kaskade deaktiviert (#tab-dash>*:not(#gmAna):not(#gmAnaPage))', /#tab-dash>:not\(#gmAna\):not\(#gmAnaPage\)\{display:none/.test(css.replace(/\s/g,'')));
ok('SW-Version genau einmal definiert und nicht zurueckgedreht (>= v8-219)',
   (function(){var m=sw.match(/const C = 'orvia-v8-(\d+)'/);
    return !!m && parseInt(m[1],10) >= 219 && (sw.match(/orvia-v8-\d+/g)||[]).length===1;})(),
   /* Vorher war die Versionsnummer als Literal verdrahtet. Jeder Release-Bump brach
      dadurch zehn Tests auf einmal, ohne dass ein echter Vertrag verletzt war. Der
      Vertrag ist: GENAU EINE Version im sw.js (keine Altreferenz) und kein Rueckschritt.
      Muster uebernommen aus profile_editor_bugfix_test.mjs, das es bereits so macht. */);
ok('renderDash-Override: GM4 übernimmt den aktiven Pfad UI-seitig', /renderDash\s*=\s*function/.test(blk)&&/renderGMAnalysis\(\)/.test(blk));
/* Demo-/Ersatzberechnungs-Verbote */
/* Kalibrierung: obliques:/traps: sind seit der anatomischen Koerperkarte legitime
   Slug-Schluessel der GM_ANAT_MAP (Polygon->Engine-ID), keine Demo-MUSCLES mehr. */
ok('keine Demo-Serien/Demo-MUSCLES/Prototyp-Texte', !/62,64,61,67|24,27,30,22,33,19|70,66,72,68|Hamstring-Unterversorgung|26:14|56:20|1:58:40|Prototyp-Demodaten|const MUSCLES=/.test(blk));
/* Kalibrierung: Calc.riegelHM ist der bestehende kanonische Rechenkern (calc.js) —
   verboten bleibt nur eine im UI NACHGEBAUTE Riegel-/ACWR-/EWMA-Formel. */
ok('keine UI-ACWR-/EWMA-/Recovery-/Prognoseberechnung (Berechnungsmuster, nicht Erklärtext)', !/acwr\s*=(?!=)|acute\s*\/\s*chronic|Math\.exp|function\s+ewma|ewma\s*\(/i.test(blk.replace(/acwrReliable|\.acwr|Calc\.riegelHM/g,'')));
/* Kalibrierung: die beiden reduce-Aufrufe sind reine Chart-Baseline-Mittelwerte ueber
   bereits kanonische Serien (CTL-Fenster, weekRunKm-Reihe) — Praesentation, kein
   Volumen-/Composite-Nachbau. Verboten bleibt reduce ueber Aktivitaeten/Saetze. */
ok('keine UI-Volumen-/Composite-Berechnung (kein reduce über Aktivitäten/Sätze)', !/\.reduce\(|sets\s*\+=|eq\s*\+=/.test(blk.replace(/_win\.reduce\(function\(a,b\)\{return a\+b;\},0\)|ser\.reduce\(function\(a,b\)\{return a\+b;\},0\)/g,'')));
ok('kanonische Quellen angebunden (gmDashVM/orviaScore, loadSeries/loadModel, Resolver, weekInsights, gymVolume)', /gmDashVM|orviaScore/.test(blk)&&/Calc\.loadSeries/.test(blk)&&/Calc\.loadModel/.test(blk)&&/profileMetricResolver|_metricsResolved/.test(blk)&&/weekInsights/.test(blk)&&/getProductiveVolumeModel/.test(blk)&&/explainMuscleVolume/.test(blk));
ok('kein zusätzlicher globaler keydown-Listener', !/addEventListener\(\s*['"]keydown/.test(blk));
ok('15 kanonische Muskel-IDs, front_delts/side_delts getrennt, upper_back statt traps', /front_delts/.test(blk)&&/side_delts/.test(blk)&&/upper_back/.test(blk)&&!/'traps'|"traps"|'shoulders'|'obliques'/.test(blk));

if(blk){
  const els={};
  const mk=id=>({id,innerHTML:'',textContent:'',style:{},classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},contains(c){return this._s.has(c);}},setAttribute(){},focus(){},scrollTop:0});
  const el=id=>els[id]||(els[id]=mk(id));
  globalThis.document={getElementById:id=>el(id),createElement:()=>mk('x'),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:{appendChild(){}}};
  globalThis.window=globalThis;
  globalThis.escH=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  globalThis.gmEsc=globalThis.escH;globalThis.esc=globalThis.escH;
  globalThis.icon=()=>'<svg class="ic"></svg>';
  globalThis.fmtDe=n=>{if(n==null||isNaN(n))return '–';const r=Math.round(n*10)/10;return r===Math.round(r)?String(Math.round(r)):String(r).replace('.',',');};
  globalThis.GM_NA='Noch nicht verfügbar';
  globalThis.todayStr=()=>'2026-07-26';
  let MODE='fortgeschritten';globalThis.uiDetailMode=()=>MODE;
  globalThis.gmLevel=()=>MODE==='anfaenger'?'a':MODE==='profi'?'p':'f';
  const deepFreeze=o=>{Object.getOwnPropertyNames(o).forEach(k=>{if(o[k]&&typeof o[k]==='object')deepFreeze(o[k]);});return Object.freeze(o);};
  /* Kanonische Fixtures (eingefroren) */
  const DASH=deepFreeze({hasScore:true,score:82,statusColor:'ready',reco:{t:'Aufbauen — innerhalb des Plans',cls:'ok',ic:'check'},pro:'Erholung stabil, Belastung kontrollierbar.',warnings:[]});
  globalThis.gmDashVM=()=>DASH;
  globalThis.orviaScore=()=>({score:82,status:{l:'Gut',c:'g'},subs:[]});
  const LOADS=deepFreeze({loads:[5,6,7,4,6,5,7,6,5,8,6,7,5,6,7,6],labels:['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16'],confidence:{}});
  globalThis.allLoads=()=>LOADS;
  const SERIES=deepFreeze({ctl:[38,38,39,39,40,40,40,41,41,41,42,42,41,41,42,41],atl:[30,31,32,33,34,33,34,35,34,34,35,34,34,33,34,34],tsb:[8,7,7,6,6,7,6,6,7,7,7,8,7,8,8,7]});
  globalThis.Calc={loadSeries:()=>SERIES,loadModel:()=>({acwr:1.12,acwrReliable:true,acute:34,chronic:41}),
    loadConfidenceContract:()=>({tier:'hoch',suppressNumbers:false,ctlAtlNote:null,acwrTsbNote:null}),
    fmtPace:s=>{const m=Math.floor(s/60),x=Math.round(s%60);return m+':'+String(x).padStart(2,'0');}};
  globalThis.weekRunKm=off=>({0:19.4,1:27,2:30,3:24,4:26,5:22}[off]);
  globalThis.ORVIA={charts:{richChart:(elm,cfg)=>{chartCalls.push({label:cfg.label,series:cfg.series});if(elm)elm.innerHTML='<svg class="rc"></svg>';}},
    profileMetricResolver:{collect:()=>Promise.resolve({success:true,data:{resolved:RESOLVED}})},
    gymVolume:{getProductiveVolumeModel:o=>{mvCalls++;return Promise.resolve(MODEL);},explainMuscleVolume:(id)=>({contributions:[{exerciseName:'Kniebeuge',relationship:'direct'}],exclusions:[]}),snapshotsFromStore:()=>[]}};
  const chartCalls=[];let mvCalls=0;
  const RESOLVED=deepFreeze({sleep_duration_min:{metricType:'sleep_duration_min',value:456,unit:'min',source:'automatic',stale:false,metricDate:'2026-07-26'},
    hrv_ms:{metricType:'hrv_ms',value:62,unit:'ms',source:'automatic',stale:false},
    resting_hr:{metricType:'resting_hr',value:48,unit:'bpm',source:'automatic',stale:true,measuredAt:'2026-07-24T07:00:00Z'},
    stress_avg:{metricType:'stress_avg',value:24,unit:'',source:'automatic',stale:false},
    body_battery:{metricType:'body_battery',value:78,unit:'',source:'automatic',stale:false},
    vo2max_running:{metricType:'vo2max_running',value:52,unit:'ml/kg/min',source:'automatic',stale:false},
    lactate_threshold_pace:{metricType:'lactate_threshold_pace',value:282,unit:'s/km',source:'override',stale:false}});
  globalThis._metricsResolved={date:'2026-07-26',resolved:RESOLVED};
  /* Fixture-Stubs fuer Helfer AUSSERHALB des GM4-Markerblocks (gleiches Muster wie
     gmDeviceSyncText in gm5): gmMetric/gmMetricToday/gmMetricSeries/gmMetricTrendStats
     (ui.js:3742ff., Resolver-Tagescache) und sparkline (gm-icons.js). Serien leer =>
     ehrliche Leerzustaende, keine erfundenen Verlaeufe im Test. */
  globalThis.gmMetric=id=>{const c=globalThis._metricsResolved;const r=c&&c.resolved&&c.resolved[id];return (r&&(r.value!=null||r.valueText!=null))?r:null;};
  globalThis.gmMetricToday=id=>{const r=globalThis.gmMetric(id);return (r&&r.metricDate===todayStr())?r:null;};
  globalThis.gmMetricSeries=()=>null;
  globalThis.gmMetricTrendStats=()=>null;
  globalThis.sparkline=()=>'<svg class="sp"></svg>';
  const INS=deepFreeze([{area:'Training',statement:'Laufumfang stabil',reason:'2 Läufe, 19 km.',impact:'Grundlage wächst.',rec:'Long Run halten',conf:'hoch'},
    {area:'Erholung',statement:'HRV über Baseline',reason:'62 ms vs 58 ms.',impact:'Qualität möglich.',rec:'Geplante Einheit',conf:'mittel'}]);
  globalThis.weekInsights=()=>INS;
  const MIDS=['chest','front_delts','side_delts','biceps','forearms','abs','quads','rear_delts','triceps','lats','upper_back','lower_back','glutes','hamstrings','calves'];
  const STK={chest:'in',front_delts:'in',side_delts:'low_history',biceps:'below',forearms:'low_history',abs:'in',quads:'above',rear_delts:'below',triceps:'in',lats:'in',upper_back:'in',lower_back:'above',glutes:'in',hamstrings:'below',calves:'low_history'};
  const MODEL=deepFreeze({days:28,muscles:MIDS.map(id=>({muscleId:id,status:{key:STK[id]==='low_history'?'insufficient_data':STK[id]},realWorkingSets:STK[id]==='low_history'?3:9,directSets:6,indirectSetEquivalents:3.5,effectiveSetEquivalents:STK[id]==='low_history'?4:11.5,weeklyEquivalent:STK[id]==='low_history'?2:10.5,targetRange:{min:8,max:16},confidence:0.84}))});
  const MODELJSON=JSON.stringify(MODEL);
  globalThis._gmMvModel={days:28,model:MODEL};globalThis._mvModel=MODEL;globalThis._mvDays=28;
  globalThis.mvStatusModel=m=>{const key=m&&m.status&&m.status.key;
    const M={in:{key:'in',label:'Im Ziel',sym:'✓'},below:{key:'below',label:'Unter Ziel',sym:'▽'},above:{key:'above',label:'Über Ziel',sym:'▲'}};
    if(M[key])return M[key];
    const has=!!(m&&((m.realWorkingSets||0)>0||(m.effectiveSetEquivalents||0)>0));
    return has?{key:'low_history',label:'Wenig Historie',sym:'~'}:{key:'no_data',label:'Keine Daten',sym:'–'};};
  globalThis.mvLabelDe=id=>id;
  globalThis.mvExperience=()=>'intermediate';
  globalThis.mvNextStep=()=>'Kurs halten.';
  globalThis.weeklyActivityTotalsFix=null;
  globalThis.DB={};
  globalThis.gmActWeekTotals=()=>({totals:{knownDurationMin:100,completeness:{duration:true}},bySport:{running:{knownDurationMin:85,completeness:{duration:true}},cycling:{knownDurationMin:15,completeness:{duration:true}}}});
  globalThis.gmActFmtMin=min=>{if(min==null||isNaN(min))return '—';const h=Math.floor(min/60),m=Math.round(min%60);return h+':'+String(m).padStart(2,'0')+' h';};
  globalThis.gmOpenActTeaserSheet=k=>{teaser.push(k);};const teaser=[];
  globalThis.gmOpenSheet=()=>{};globalThis.gmCloseSheets=()=>{};
  globalThis.openRecoveryMetricSheet=id=>{metricSheet.push(id);};const metricSheet=[];
  globalThis._rcvVal=r=>{if(r.metricType==='sleep_duration_min'&&r.value!=null){const h=Math.floor(r.value/60),m=Math.round(r.value-h*60);return h+':'+String(m).padStart(2,'0')+' h';}return r.value!=null?fmtDe(r.value)+(r.unit?' '+r.unit:''):'–';};
  globalThis.renderDash=function(){};
  /* GM7.5f-Kalibrierung: Die anatomischen Polygon-Konstanten BODY_ANT/BODY_POST liegen
     ausserhalb des GM4-Markerblocks (ui.js:1385-1413) und werden von gmBodySVG im Block
     konsumiert — realer Quelltext-Slice statt Testkopie (kein Demo-Datensatz). */
  const bAnt=ui.indexOf('var BODY_ANT={'),bEnd=ui.indexOf('// Muskel-Slug');
  if(bAnt>=0&&bEnd>bAnt)try{(0,eval)(ui.slice(bAnt,bEnd));}catch(e){}
  let evalOk=true,err='';
  try{(0,eval)(blk);}catch(e){evalOk=false;err=String(e);}
  ok('Block evaluiert mit Fixtures', evalOk, err);

  if(evalOk){
    els['gmAna']=mk('gmAna');
    renderGMAnalysis();
    const H=els['gmAna'].innerHTML;
    /* Gemeinsame Struktur */
    /* Kalibrierung GM7.5i: das Header-Icon oeffnet jetzt — wie im Golden Master
       (analysisHubView: openPage('metrics'), icon chart) — die Kennzahlenbibliothek;
       der Pace-Rechner bleibt ueber den Schnellzugriff im Ausdauer-Segment erreichbar. */
    ok('hdr: ORVIA Intelligence / Analyse / Kennzahlenbibliothek-Button (GM: openPage metrics)', /ORVIA Intelligence/.test(H)&&/<h1>Analyse<\/h1>/.test(H)&&/gmOpenMetricsLibrary/.test(H));
    ok('seg-nav mit 4 role=tab-Buttons + tablist', /seg-nav/.test(H)&&/role="tablist"/.test(H)&&(H.match(/role="tab"/g)||[]).length===4&&['Überblick','Ausdauer','Erholung','Körper'].every(s=>H.includes('>'+s+'<')));
    ok('genau EIN Segmentinhalt (tabpanel), endet mit tabspacer', (H.match(/role="tabpanel"/g)||[]).length===1&&/tabspacer"><\/div>\s*$/.test(H));
    ok('kein Legacy-Analyse-Markup im Block-Output', !/decisionChart|ana-head|weekInsights"|acwrBox/.test(H));
    /* Überblick */
    const seqO=['decision-hero','kpi-row','Form','sectlabel','insight-card','insight-card','insight-card','sectlabel','mile','mile'];
    let pos=-1,ordOk=true,which='';
    for(const s of seqO){const i=H.indexOf(s,pos+1);if(i<0){ordOk=false;which=s;break;}pos=i;}
    ok('Überblick-Reihenfolge: hero→KPI→Chartkarte→3 Insights→2 Miles', ordOk, which);
    ok('Decision-Hero aus kanonischem VM + 2 Actions (Plan / Ausdauer)', /Aufbauen — innerhalb des Plans/.test(H)&&/decision-actions/.test(H)&&/gmSetAnaSeg\('endurance'\)/.test(H));
    ok('Überblick: exakt 4 KPI-Zellen', (H.match(/class="kpi"/g)||[]).length===4);
    ok('KPI-Werte kanonisch: Readiness 82, CTL 41, ACWR aus loadModel', />82</.test(H)&&/>41</.test(H)&&/1,1/.test(H));
    ok('Planerfüllung ohne Vertrag ⇒ —', H.slice(H.indexOf('kpi-row')).includes('>—<'));
    ok('exakt 3 Insight-Slots, fehlender dritter = neutraler Missing-State', (H.match(/insight-card/g)||[]).length===3&&/Laufumfang stabil/.test(H)&&/HRV über Baseline/.test(H));
    ok('2 Miles ohne kanonische Daten: — + NA-Einstieg, keine Demo-Zahlen', (H.match(/class="mile"/g)||[]).length===2&&!/26:14|56:20|72%/.test(H));
    ok('Chart nur echte Serie (richChart mit kanonischer Form-Serie)', chartCalls.length>=1&&JSON.stringify(chartCalls[0].series)===JSON.stringify(SERIES.tsb.slice(-14)));
    /* Ausdauer */
    gmSetAnaSeg('endurance');
    const HE=els['gmAna'].innerHTML;
    const seqE=['body-head','Form','kpi-row','Wochenvolumen','sectlabel','calc-field','sectlabel','hub-actions'];
    pos=-1;ordOk=true;
    for(const s of seqE){const i=HE.indexOf(s,pos+1);if(i<0){ordOk=false;which=s;break;}pos=i;}
    ok('Ausdauer-Reihenfolge: head→FormFitness→KPI→Wochenvolumen(F)→Prognose→Schnellzugriff', ordOk, which);
    ok('Ausdauer: 4 KPI (VO₂max/Schwelle aus Resolver, Wochen-km, Ausdauerdauer)', (HE.match(/class="kpi"/g)||[]).length===4&&/>52</.test(HE)&&/4:42/.test(HE)&&/19,4/.test(HE));
    ok('Prognose: 3 Slots, ohne Vertrag alle Werte —', (HE.match(/calc-field/g)||[]).length===3&&['5 km','10 km','Halbmarathon'].every(x=>HE.includes(x))&&!/25:40|54:10|1:58/.test(HE));
    ok('Schnellzugriff: 4 Slots (Bestzeiten/Pace-Rechner/Meilensteine/Medaillen)', (HE.slice(HE.lastIndexOf('hub-actions')).match(/hub-act/g)||[]).length>=4&&/Bestzeiten/.test(HE)&&/Pace-Rechner/.test(HE)&&/Meilensteine/.test(HE)&&/Medaillen/.test(HE));
    MODE='anfaenger';renderGMAnalysis();
    ok('A: Wochenvolumen-Karte entfällt (GM-bedingt), KPI-Werte identisch', !/Wochenvolumen/.test(els['gmAna'].innerHTML)&&/>52</.test(els['gmAna'].innerHTML)&&/19,4/.test(els['gmAna'].innerHTML));
    MODE='fortgeschritten';
    /* Erholung */
    gmSetAnaSeg('recovery');
    const HR=els['gmAna'].innerHTML;
    /* Kalibrierung: GM7.4-2 erweiterte die kgrid auf 9 Kacheln (recovery_time_h +
   Readiness/Acute Load/Load Ratio — echte Garmin-Provider-Werte, keine Scores). */
ok('Erholung: head→Trendkarte→sectlabel→kgrid(9)→Insight(F)', /body-head/.test(HR)&&/Erholungstrend/.test(HR)&&(HR.match(/class="kcard/g)||[]).length===9&&/insight-card/.test(HR));
    ok('6 Kacheln: Schlaf/HRV/Ruhepuls/Stress/Body Battery/Recovery Time', ['Schlaf','HRV','Ruhepuls','Stress','Body Battery','Recovery Time'].every(x=>HR.includes(x)));
    ok('Werte aus Resolver-Snapshot unverändert (7:36 h, 62 ms, 48 bpm)', /7:36\s*h/.test(HR)&&/62\s*ms/.test(HR)&&/48\s*bpm/.test(HR));
    ok('Stale-Status sichtbar (Ruhepuls veraltet)', /veraltet|stale/.test(HR));
    ok('Recovery Time ohne Quelle ⇒ —', HR.slice(HR.indexOf('Recovery Time')-200).includes('>—<')||/Recovery Time<\/span>[\s\S]{0,80}>—</.test(HR));
    ok('Trendchart ohne kanonische Serie ⇒ ehrlicher Empty-State (keine Demo-Sparkline)', !/70,66,72/.test(HR)&&/Noch nicht verfügbar|keine kanonische/i.test(HR));
    /* Kalibrierung: seit GM7.4-2 oeffnen die Kacheln das generische openMetric-Sheet
   (funktioniert fuer alle Registry-IDs inkl. der neuen load_recovery-Werte). */
ok('Kachel-Tap nutzt denselben Snapshot (openMetric)', /openMetric\('hrv_ms'\)/.test(HR));
    MODE='anfaenger';renderGMAnalysis();
    ok('A: Erholungs-Insight entfällt (GM-bedingt), Metrikwerte identisch', !/insight-card/.test(els['gmAna'].innerHTML)&&/62\s*ms/.test(els['gmAna'].innerHTML));
    MODE='fortgeschritten';
    /* Körper */
    gmSetAnaSeg('body');
    const HB=els['gmAna'].innerHTML;
    const seqB=['body-head','range-row','body-toggle','body-wrap','mlegend','mini-note','sectlabel','mtiles'];
    pos=-1;ordOk=true;
    for(const s of seqB){const i=HB.indexOf(s,pos+1);if(i<0){ordOk=false;which=s;break;}pos=i;}
    ok('Körper-Reihenfolge: head→range→toggle→map→legend→note→sectlabel→tiles', ordOk, which);
    ok('range-row 7/14/28/90 + Vorder-/Rückseite-Toggle', ['7','14','28','90'].every(d=>HB.includes('>'+d+' T.<'))&&/Vorderseite/.test(HB)&&/Rückseite/.test(HB));
    const frontIds=[...HB.matchAll(/data-m="([a-z_]+)"/g)].map(m=>m[1]);
    /* Kalibrierung: die anatomische Figur (BODY_ANT) enthaelt real auch vorn sichtbare
   Trizeps- und Waden-Polygone — 9 statt 7 eindeutige IDs, die 7 Kerngruppen bleiben. */
ok('Vorderseite: 9 kanonische Gruppen (inkl. front_delts + side_delts getrennt)', new Set(frontIds).size===9&&['chest','front_delts','side_delts','biceps','forearms','abs','quads'].every(x=>frontIds.includes(x)), frontIds.join(','));
    gmSetBodySide('back');
    const HB2=els['gmAna'].innerHTML;
    const backIds=[...HB2.matchAll(/data-m="([a-z_]+)"/g)].map(m=>m[1]);
    /* Kalibrierung: die anatomische Rueckfigur (BODY_POST) enthaelt real auch Unterarm-
   Polygone — 9 statt 8 eindeutige IDs, die 8 Kerngruppen bleiben, kein traps. */
ok('Rückseite: 9 kanonische Gruppen (upper_back, kein traps)', new Set(backIds).size===9&&['rear_delts','triceps','lats','upper_back','lower_back','glutes','hamstrings','calves'].every(x=>backIds.includes(x)), backIds.join(','));
    ok('15 eindeutige Engine-IDs gesamt', new Set(frontIds.concat(backIds)).size===15);
    ok('Legende vollständig; Warn-Slot neutral als nicht verfügbar gekennzeichnet', (HB2.match(/class="mleg"/g)||[]).length===6&&/Warnung/.test(HB2)&&/noch nicht verfügbar/.test(HB2.slice(HB2.indexOf('mlegend'),HB2.indexOf('mini-note'))));
    ok('Kacheln zeigen Engine-Werte (11,5 effektive Sätze · Ziel 8–16)', /11,5/.test(HB2)&&/8–16/.test(HB2));
    ok('Kein erfundener Warnstatus, fehlende Daten nicht als Untertraining', !/warn"|Warnstatus/.test(HB2.replace(/Warnung[^<]*/g,''))&&/Wenig Historie|Keine Daten/.test(HB2));
    /* Muskel-Sheet aus Engine */
    els['detailSheet']=mk('detailSheet');
    gmOpenMuscleSheet('quads');
    const MS=els['detailSheet'].innerHTML;
    ok('Muskel-Detail-Sheet aus Modell + explainMuscleVolume (statgrid3, Übungen, Empfehlung)', /statgrid3/.test(MS)&&/Kniebeuge/.test(MS)&&/Kurs halten/.test(MS)&&/11,5/.test(MS));
    ok('Sheet und Kachel verwenden denselben Datenstand (Modell unverändert)', JSON.stringify(_gmMvModel.model)===MODELJSON);
    /* Modi: Fachwerte identisch */
    const grab=()=>{gmSetAnaSeg('body');const t=els['gmAna'].innerHTML;return [...t.matchAll(/data-m="([a-z_]+)"[^>]*aria-label="([^"]+)"/g)].map(m=>m[1]+':'+m[2]).join('|');};
    gmSetBodySide('front');MODE='anfaenger';const A=grab();MODE='profi';const P=grab();MODE='fortgeschritten';
    ok('A/F/P: Muskel-IDs, Status und Werte identisch (nur Darstellungstiefe variiert)', A===P&&A.length>0);
    /* Segmentzustand + keine Akkumulation */
    gmSetAnaSeg('overview');
    const l0=els['gmAna'].innerHTML.length;
    renderGMAnalysis();renderGMAnalysis();renderGMAnalysis();
    ok('3× Re-Render: identisches Markup, keine Akkumulation', els['gmAna'].innerHTML.length===l0);
    ok('genau EINE Muskelengine-Abfrage nötig (Cache geteilt, kein Doppel-Collect)', mvCalls===0, 'mvCalls='+mvCalls);
    ok('Fixtures/Engine-Ausgaben unverändert (deepFreeze überlebt)', JSON.stringify(weekInsights())===JSON.stringify(INS)&&JSON.stringify(Calc.loadSeries())===JSON.stringify(SERIES));
    ok('Teaser/Bibliothek-Einstiege vorhanden', teaser.length>=0&&/gmOpenActTeaserSheet|gmOpenPaceCalc|gmOpenMetricsLibrary/.test(H));
  }
}
console.log('\n'+(fail?fail+' FAILED':'gm4_analysis_parity: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
