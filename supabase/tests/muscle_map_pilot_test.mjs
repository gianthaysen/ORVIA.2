/* ORVIA · Muskelkarte-Pilot — Pflichtprüfungen (Engine-Bindung, Modustrennung, Missingness, Dedup, Zeitfenster).
   node supabase/tests/muscle_map_pilot_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const G=(await import(new URL(_APPREL + 'js/gym-volume.js',import.meta.url))).default;

// --- reine UI-Funktionen aus ui.js extrahieren (Block zwischen Pilot-Marker und `var _mvReq=0;`) ---
const ui=fs.readFileSync(new URL(_APPREL + 'js/ui.js',import.meta.url),'utf8');
const start=ui.indexOf('function mvExperience(');
const end=ui.indexOf('var _mvReq=0;',start);
if(start<0||end<0){console.error('Pilot-Block nicht gefunden');process.exit(1);}
const block=ui.slice(start,end);
// Stubs für die Auswertung reiner Funktionen (keine echten Renderpfade).
globalThis.window={};
globalThis.escH=x=>String(x==null?'':x);
globalThis.ORVIA={gymVolume:{MUSCLE_LABEL:G.MUSCLE_LABEL},profileModel:{primarySportLevel:()=> _levelStub}};
globalThis.window.ORVIA=globalThis.ORVIA;
let _levelStub='intermediate';
globalThis.uiDetailMode=()=> _modeStub;   // Anzeige-Modus (darf Fachzahlen NICHT beeinflussen)
let _modeStub='fortgeschritten';
globalThis.PROFILE={level:'fortgeschritten'};
(0,eval)(block+';globalThis.__mv={mvExperience,mvStatusModel,mvDetailNumbers,mvNextStep,MV_FRONT_IDS,MV_BACK_IDS,MV_MAP_POS,MV_STATUS_META,renderMuscleMap};');
const M=globalThis.__mv;

const set=o=>Object.assign({setType:'working',completed:true,weight:70,reps:10},o);
const ex=(n,sets)=>({exerciseNameSnapshot:n,sets});
const iso=d=>new Date(Date.now()-d*864e5).toISOString();

// (4) direkte/indirekte Satzäquivalente entsprechen gym-volume.js + mvDetailNumbers reicht sie unverändert durch
const bp=G.computeMuscleVolume([{workoutId:'w1',startedAt:iso(1),exercises:[ex('Bankdrücken',[set(),set(),set()])]}]).byMuscle;
ok('4a Engine: Bankdrücken → Brust 3 direkt / Trizeps 1,5 indirekt', bp.chest.directSets===3 && bp.triceps.indirectSetEquivalents===1.5);
const mChest={muscleId:'chest',realWorkingSets:3,directSets:3,indirectSetEquivalents:0,effectiveSetEquivalents:3,weeklyEquivalent:3,targetRange:{min:6,max:12,displayStatus:'ok',source:'x'},status:{key:'below'},confidence:'medium'};
const dn=M.mvDetailNumbers(mChest,{exclusions:[{reason:'warmup'}]});
ok('4b mvDetailNumbers reicht Engine-Zahlen unverändert durch', dn.directSets===3 && dn.indirectSetEquivalents===0 && dn.effectiveSetEquivalents===3 && dn.exclusionCount===1);

// (1) derselbe Datensatz erzeugt in allen drei UI-Modi identische Fachzahlen
_modeStub='anfaenger'; const a=M.mvDetailNumbers(mChest,null);
_modeStub='fortgeschritten'; const f=M.mvDetailNumbers(mChest,null);
_modeStub='profi'; const p=M.mvDetailNumbers(mChest,null);
ok('1 Fachzahlen identisch über Anfänger/Fortgeschritten/Profi', JSON.stringify(a)===JSON.stringify(f)&&JSON.stringify(f)===JSON.stringify(p));

// (2/3) Zielkorridor + experience stammen aus der Fähigkeitsstufe, NICHT aus uiDetailMode
_levelStub='advanced'; _modeStub='anfaenger';
ok('3a experience aus primarySportLevel (advanced), unabhängig vom Anzeige-Modus', M.mvExperience()==='advanced');
_levelStub='beginner'; _modeStub='profi';
ok('3b Anzeige-Modus ändert experience NICHT', M.mvExperience()==='beginner');
const snapsAdv=[{workoutId:'w',startedAt:iso(2),exercises:[ex('Bankdrücken',[set(),set(),set()])]}];
const exBeg=G.explainMuscleVolume('chest',snapsAdv,{weeks:4,experience:'beginner'});
const exAdv=G.explainMuscleVolume('chest',snapsAdv,{weeks:4,experience:'advanced'});
ok('3c Korridor kommt aus Engine & variiert mit Fähigkeitsstufe', exBeg.targetRange.min===4&&exBeg.targetRange.max===8&&exAdv.targetRange.min===8&&exAdv.targetRange.max===16);
ok('2 PROFILE.level durch Modus/Detail unverändert', PROFILE.level==='fortgeschritten');

// (5) fehlende Daten = unbekannt, nicht 0/„unter Ziel"
ok('5a insufficient_data ohne Sätze → keine Daten (nicht below)', M.mvStatusModel({status:{key:'insufficient_data'},realWorkingSets:0}).key==='no_data');
ok('5b insufficient_data mit Sätzen → wenig Historie', M.mvStatusModel({status:{key:'insufficient_data'},realWorkingSets:5,effectiveSetEquivalents:5}).key==='low_history');
ok('5c below bleibt below (echter Status)', M.mvStatusModel({status:{key:'below'}}).key==='below');

// (6) doppelte Aktivitäten werden nicht doppelt gezählt (Engine-Dedup über stabile ID)
const act={id:'W1',sportId:'gym',status:'completed',startedAt:iso(2),exercises:[ex('Bankdrücken',[set(),set()])]};
const pipe=G.gymPipeline({days:14,serverActivities:[act,JSON.parse(JSON.stringify(act))]});
ok('6 identische Workout-ID → nur ein Snapshot', pipe.snapshots.length===1, 'len='+pipe.snapshots.length);

// (7) ausgeschlossene Sätze bleiben nachvollziehbar
const exExpl=G.explainMuscleVolume('chest',[{workoutId:'w',startedAt:iso(1),exercises:[ex('Bankdrücken',[set({setType:'warmup'}),set(),set()])]}],{weeks:2});
ok('7 Ausschluss (warmup) mit Grund gelistet', exExpl.exclusions.some(e=>e.reason==='warmup'));

// (8) Front-/Rückseitenregionen liefern korrekten muscleId-Key & decken alle 15 IDs disjunkt ab
const uni=M.MV_FRONT_IDS.concat(M.MV_BACK_IDS).sort();
ok('8a Front∪Back == 15 Engine-Muskeln, disjunkt', uni.length===15 && new Set(uni).size===15 && uni.join(',')===G.MUSCLES.slice().sort().join(','));
globalThis.window._mvSide='front';
const svgF=M.renderMuscleMap({muscles:[{muscleId:'chest',status:{key:'in'},realWorkingSets:3,effectiveSetEquivalents:3}]});
ok('8b Front-Region verlinkt korrekten Key', svgF.indexOf('data-m="chest"')>=0 && svgF.indexOf("showMuscleDetail('chest')")>=0 && svgF.indexOf('data-m="hamstrings"')<0);
globalThis.window._mvSide='back';
const svgB=M.renderMuscleMap({muscles:[{muscleId:'hamstrings',status:{key:'below'},realWorkingSets:4,effectiveSetEquivalents:4}]});
ok('8c Rückseite zeigt Rücken-Muskeln (hamstrings), nicht chest', svgB.indexOf('data-m="hamstrings"')>=0 && svgB.indexOf('data-m="chest"')<0);

// (9) Zeitfenster nutzt korrekte Datumsgrenzen (fromMs = now-(days-1)*Tag)
const recent={id:'R',sportId:'gym',status:'completed',startedAt:iso(3),exercises:[ex('Kniebeuge',[set(),set()])]};
const oldA={id:'O',sportId:'gym',status:'completed',startedAt:iso(12),exercises:[ex('Kniebeuge',[set(),set()])]};
const p7=G.gymPipeline({days:7,serverActivities:[recent,oldA]});
const p28=G.gymPipeline({days:28,serverActivities:[recent,oldA]});
ok('9 7-Tage-Fenster schließt 12 Tage alte Einheit aus; 28-Tage schließt sie ein', p7.snapshots.length===1 && p28.snapshots.length===2);

/* ══ (10) v8-352 · Der Korridor darf nicht mehr „Ziel" heissen ══
   BEFUND: „Ziel: 6–12/Woche" stand ohne jede Herkunft auf der Karte, und
   die Basis (`conservative_start`) wurde im Profi-Modus sogar noch aus dem
   Text gestrichen. Daneben tragen die Hinweise aus eingespeistem Wissen
   Evidenzklasse und Regel-ID. Die unbelegte Zahl sah damit verbindlicher
   aus als die belegte — genau verkehrt herum. */
const numK=M.mvDetailNumbers({muscleId:'chest',targetRange:{min:6,max:12,source:'conservative_start:hypertrophy:intermediate',basis:'produktwert',label:'ORVIA-Richtwert, konservativ gesetzt — keine Quelle, fachlich ungeprüft'}},null);
ok('10a Basis und Label wandern bis in die Darstellung',
  numK.targetBasis==='produktwert' && /keine Quelle/.test(numK.targetLabel||''), JSON.stringify({b:numK.targetBasis,l:numK.targetLabel}));
ok('10b die Kennung wird nicht mehr unterwegs verkuerzt',
  numK.targetSource==='conservative_start:hypertrophy:intermediate', numK.targetSource);

/* Der Quelltext selbst: ein Produktwert, der „Ziel" heisst, ist eine
   Vorgabe — auch wenn daneben steht, woher er kommt. Diese Zusicherung
   haengt bewusst am Text, weil genau die Beschriftung der Befund war. */
const uiKorr=ui.slice(ui.indexOf('function gmMuscleTile('), ui.indexOf('function gmMuscleTile(')+1200);
ok('10c die Kachel nennt den Korridor Richtwert, nicht Ziel',
  /Richtwert/.test(uiKorr) && !/· Ziel /.test(uiKorr));
ok('10d das Detail nennt ihn ebenfalls Richtwert',
  /'Richtwert: '\+fmtDe\(num.targetMin\)/.test(ui) && ui.indexOf("'Zielkorridor: '+fmtDe(num.targetMin)")<0);

/* Und die Abgrenzung zur Quellenzahl existiert wirklich — mit dem Satz,
   der das Umrechnen ausschliesst. Ohne ihn stuenden zwei Zahlen zum selben
   Gegenstand nebeneinander und der Nutzer muesste raten, welche gilt. */
ok('10e die Abgrenzung zur Quellenzahl steht im Detail',
  /gmKorridorAbgrenzungHTML\(\)/.test(ui) && /nennt keine Wochenfrequenz/.test(ui));
ok('10f … und rechnet die eine NICHT in die andere um',
  !/wert\.min\s*\*|\*\s*einheitenProWoche|proWoche\s*\*/.test(ui.slice(ui.indexOf('function gmKorridorAbgrenzungHTML'), ui.indexOf('function mvDetailNumbers'))));

console.log('\n'+(fail?fail+' FAILED':'muscle_map_pilot: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
