/* ============================================================
   ORVIA · workout_gym_wiring — Phase B, Gym-Strang im Player
   ------------------------------------------------------------
   Prueft die ANBINDUNG (nicht die Module — die haben eigene Tests):
     A. Fail-open: ohne workout-gym.js rendert der Player wie bisher
     B. Haken sichtbar: Superset / Alternative / Scheiben im Player-HTML
     C. B-05: koppeln → Badge an beiden Chips; nach Satz A → B → A;
        loesen → kein Badge; Store schreibt superset_group ueber updateExercise
     D. B-08: Vorschlag aus Repo-Historie erscheint und ist antippbar
     E. B-07: Scheiben-Sheet rechnet aus dem kg-Feld
     F. Anlegen einer Uebung schickt KEIN superset_group (Vorfallklasse 0035)

   node supabase/tests/workout_gym_wiring_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ---- Mini-DOM: gerade genug fuer renderOverlay/Sheets/Inputs ---- */
const ELS = {};
function el(id) {
  const cls = new Set();
  const e = { id, innerHTML: '', textContent: '', value: '', placeholder: '', onclick: null, style: {},
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { f ? cls.add(c) : cls.delete(c); } },
    appendChild: () => {}, focus: () => {}, setAttribute: () => {}, querySelectorAll: () => [], querySelector: () => null };
  if (id) ELS[id] = e; return e;
}
global.window = { addEventListener: () => {}, dispatchEvent: () => {}, matchMedia: () => ({ matches: false }) };
global.document = { getElementById: id => ELS[id] || null, createElement: () => el(null), body: { appendChild: e => { if (e.id) ELS[e.id] = e; } },
  addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete', hidden: false };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-09-03';
global.getDecision = () => null;
global.toast = m => { CAP.toasts.push(m); };
/* IDs, die renderOverlay per innerHTML erzeugt — der Mini-DOM parst nicht, also vorab anlegen. */
el('workoutOverlay'); el('workoutPicker'); el('woLast'); el('woSuggest'); el('wiW'); el('wiR');
const load = f => (0, eval)(fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
/* Engine-Module registrieren auf globalThis.ORVIA (im Browser === window.ORVIA). */
globalThis.ORVIA = global.window.ORVIA;
load('js/engine/superset-model.js'); load('js/engine/exercise-alternatives.js'); load('js/engine/plate-calculator.js'); load('js/engine/strength-progression.js'); load('js/engine/gym-adapters.js');
load('js/workout-ui.js');
const O = global.window.ORVIA, WS = O.workoutStore;
O.user = { id: 'u1' };

let idn = 0; const CAP = { toasts: [], exerciseRows: [], patches: [] };
O.repos = O.repos || {};
O.repos.workout = {
  getActiveSession: async () => ({ success: true, data: null, error: null, source: 'empty', sync_status: 'synced' }),
  createSession: async (s) => ({ success: true, data: { id: 'sess1', status: 'active', local_date: s.localDate, started_at: s.started_at, sport: s.sport, client_session_id: s.clientSessionId }, error: null, source: 'supabase', sync_status: 'synced' }),
  addExercise: async (sid, ex) => { CAP.exerciseRows.push(ex); return { success: true, data: { id: 'we' + (++idn), workout_session_id: sid, client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId, order_index: ex.order, planned_sets: ex.plannedSets != null ? ex.plannedSets : null }, error: null, source: 'supabase', sync_status: 'synced' }; },
  updateExercise: async (id, patch) => { CAP.patches.push({ id, patch }); return { success: true, data: Object.assign({ id }, patch), error: null, source: 'supabase', sync_status: 'synced' }; },
  addSet: async (weid, set) => ({ success: true, data: { id: 'set' + (++idn), workout_exercise_id: weid, client_set_id: set.client_set_id, set_number: set.set_number, weight: set.weight, reps: set.reps, completed: !!set.completed }, error: null, source: 'supabase', sync_status: 'synced' }),
  getPreviousExercisePerformance: async () => ({ success: true, data: { date: '2026-08-27', sets: [{ set_number: 1, weight: 60, reps: 10, rir: 2 }], history: [
    { session: { local_date: '2026-08-20', status: 'completed' }, workout_sets: [{ set_number: 1, weight: 60, reps: 8, rir: 2, completed: true, set_type: 'working' }] },
    { session: { local_date: '2026-08-27', status: 'completed' }, workout_sets: [{ set_number: 1, weight: 60, reps: 10, rir: 2, completed: true, set_type: 'working' }, { set_number: 2, weight: 60, reps: 10, rir: 0, completed: true, set_type: 'working' }] }
  ] }, error: null, source: 'supabase', sync_status: 'synced' })
};
O.repos.exercise = { list: async () => ({ success: true, data: [
  { id: 'ex-bench', slug: 'bench_press', name: 'Bankdrücken', movementPattern: 'horizontal_push' },
  { id: 'ex-incline', slug: 'incline_bench_press', name: 'Schrägbankdrücken', movementPattern: 'horizontal_push' },
  { id: 'ex-row', slug: 'barbell_row', name: 'Langhantelrudern', movementPattern: 'horizontal_pull' }
] }) };
O.gymVolume = { musclesFor: ex => ({ bench_press: { chest: 'direct', triceps: 0.5 }, incline_bench_press: { chest: 'direct', front_delts: 0.5 }, barbell_row: { upper_back: 'direct' } })[ex.exerciseId] || null };
const ov = ELS.workoutOverlay;
const tick = () => new Promise(r => setTimeout(r, 5));

sec('A · Fail-open ohne workout-gym.js');
{
  const r = await WS.startFreeWorkout({ sport: 'Gym' }); ok('A0 Session gestartet', r.success);
  await WS.addExercise('ex-bench', { plannedSets: 3, exercise: { id: 'ex-bench', name: 'Bankdrücken' } });
  await WS.addExercise('ex-row', { plannedSets: 3, exercise: { id: 'ex-row', name: 'Langhantelrudern' } });
  O.workoutUI.open(); await tick();
  ok('A1 Player rendert', ov.innerHTML.indexOf('wo-exchip') >= 0);
  ok('A2 keine Gym-Haken sichtbar', ov.innerHTML.indexOf('Superset') < 0 && ov.innerHTML.indexOf('Alternative') < 0 && ov.innerHTML.indexOf('Scheiben') < 0);
  ok('A3 Vorschlagsflaeche vorhanden, aber leer', ov.innerHTML.indexOf('id="woSuggest"') >= 0 && (ELS.woSuggest || { innerHTML: '' }).innerHTML === '');
}

load('js/workout-gym.js');
const G = O.workoutGym;

sec('B · Haken sichtbar');
{
  O.workoutUI._render(); await tick();
  ok('B1 Superset-Aktion', ov.innerHTML.indexOf('workoutGym.superset(') >= 0);
  ok('B2 Alternative-Aktion', ov.innerHTML.indexOf('workoutGym.alternatives(') >= 0);
  ok('B3 Scheiben-Button', ov.innerHTML.indexOf('workoutGym.plates()') >= 0);
  ok('B4 Ersetzen/Entfernen unveraendert da', ov.innerHTML.indexOf('replaceExercise(') >= 0 && ov.innerHTML.indexOf('removeExercise(') >= 0);
}

sec('C · B-05 Superset im Player');
{
  ok('C0 kein Badge vor dem Koppeln', ov.innerHTML.indexOf('wo-ssb') < 0);
  await G._pair(0, 1); await tick();
  const html = ov.innerHTML;
  ok('C1 beide Chips tragen Badge A', (html.match(/wo-ssb">A</g) || []).length === 2, String((html.match(/wo-ssb/g) || []).length));
  ok('C2 Store: superset_group=1 an beiden Uebungen', WS.state().exercises.every(e => e.workoutExercise.superset_group === 1));
  ok('C3 DB-Patch nur superset_group', CAP.patches.length === 2 && CAP.patches.every(p => JSON.stringify(p.patch) === '{"superset_group":1}'), JSON.stringify(CAP.patches));
  WS.setCurrentExercise(0);
  ok('C4 nach Satz an A → Wechsel zu B', G.afterSetSaved(0) === true && WS.state().currentIndex === 1);
  ok('C5 nach Satz an B → zurueck zu A', G.afterSetSaved(1) === true && WS.state().currentIndex === 0);
  ok('C6 Aktion zeigt Gruppe', ov.innerHTML.indexOf('>Superset A<') >= 0);
  await G._ungroup(0); await tick();
  ok('C7 loesen: kein echtes Superset mehr, kein Badge', ov.innerHTML.indexOf('wo-ssb') < 0 && WS.state().exercises[0].workoutExercise.superset_group === null);
  ok('C8 ohne Gruppe kein Wechsel', G.afterSetSaved(1) === false);
  const bad = await WS.setSupersetGroup(0, 0); ok('C9 Gruppe 0 abgelehnt', bad.success === false);
}

sec('D · B-08 Vorschlag');
{
  WS.setCurrentExercise(0); O.workoutUI._render(); await tick(); await tick();
  const sg = ELS.woSuggest.innerHTML;
  ok('D1 Vorschlag gerendert', sg.indexOf('Vorschlag') >= 0, sg.slice(0, 80));
  ok('D2 Satz 1 steigern (62,5 × 6), Satz 2 halten (RIR 0)', sg.indexOf('62,5 kg × 6') >= 0 && sg.indexOf('steigern') >= 0 && sg.indexOf('RIR 0') >= 0, sg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200));
  G._take(62.5, 6);
  ok('D3 antippen fuellt kg/Wdh', ELS.wiW.value === 62.5 && ELS.wiR.value === 6);
  G.renderSuggestion({ workoutExercise: {} }, { date: 'x', sets: [], history: [{ session: { local_date: '2026-09-01', status: 'active' }, workout_sets: [{ set_number: 1, weight: 50, reps: 8, completed: true }] }] });
  ok('D4 ohne Historie: Flaeche leer (keine Erfindung)', ELS.woSuggest.innerHTML === '', ELS.woSuggest.innerHTML.slice(0, 80));
  G.renderSuggestion({ workoutExercise: {} }, { date: 'x', sets: [] });
  ok('D5 ohne history-Feld (altes Repo): Flaeche leer, kein Absturz', ELS.woSuggest.innerHTML === '');
}

sec('E · B-07 Scheiben');
{
  ELS.wiW.value = '102.5'; G.plates();
  const sh = ELS.woSheet ? ELS.woSheet.innerHTML : '';
  ok('E1 Sheet mit „je Seite"', sh.indexOf('je Seite') >= 0, sh.slice(0, 120));
  ok('E2 102,5 kg = je Seite 41,25 = 1×25 + 1×15 + 1×1,25, exakt', sh.indexOf('1 ×</b> 25 kg') >= 0 && sh.indexOf('1 ×</b> 15 kg') >= 0 && sh.indexOf('1 ×</b> 1,25 kg') >= 0 && sh.indexOf('Stange 20 kg') >= 0 && sh.indexOf('exakt') >= 0, sh.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
  G._setBar(15, 102.5);
  const sh2 = ELS.woSheet.innerHTML;
  ok('E3 Stange 15 kg → je Seite 43,75 = 1×25 + 1×15 + 1×2,5 + 1×1,25', sh2.indexOf('1 ×</b> 25 kg') >= 0 && sh2.indexOf('1 ×</b> 2,5 kg') >= 0 && sh2.indexOf('Stange 15 kg') >= 0);
  G._setUnit('lb', 135);
  const sh3 = ELS.woSheet.innerHTML;
  ok('E3b lb: 135 lb bei 45-lb-Stange = 1×45 je Seite, exakt, kein Uebernehmen (Feld ist kg)', sh3.indexOf('1 ×</b> 45 lb') >= 0 && sh3.indexOf('Stange 45 lb') >= 0 && sh3.indexOf('exakt') >= 0 && sh3.indexOf('übernehmen') < 0);
  G._setUnit('kg', 100); G._setBar(20, 100);
  ok('E3c zurueck auf kg, Stange 20: 100 kg = je Seite 40 = 1×25 + 1×15 (gierig absteigend)', ELS.woSheet.innerHTML.indexOf('1 ×</b> 25 kg') >= 0 && ELS.woSheet.innerHTML.indexOf('1 ×</b> 15 kg') >= 0 && ELS.woSheet.innerHTML.indexOf('Stange 20 kg') >= 0);
  ELS.wiW.value = ''; ELS.wiW.placeholder = ''; CAP.toasts.length = 0; G.plates();
  ok('E4 ohne Gewicht: Hinweis statt Rechnung', CAP.toasts.some(t => /Gewicht/.test(t)));
}

sec('F · Anlegen schickt kein superset_group');
{
  ok('F1 addExercise-Zeilen ohne superset_group', CAP.exerciseRows.length === 2 && CAP.exerciseRows.every(r => !('superset_group' in r) && !('supersetGroup' in r)));
}

sec('G · Historie zeigt die Gruppierung');
{
  load('js/activity-store.js');
  const snap = O.activityStore.snapshotExercises([
    { workoutExercise: { order_index: 0, exercise_id: 'a', superset_group: 1 }, exercise: { name: 'A' }, sets: [] },
    { workoutExercise: { order_index: 1, exercise_id: 'b', superset_group: 1 }, exercise: { name: 'B' }, sets: [] },
    { workoutExercise: { order_index: 2, exercise_id: 'c' }, exercise: { name: 'C' }, sets: [] },
    { workoutExercise: { order_index: 3, exercise_id: 'd', superset_group: 2 }, exercise: { name: 'D' }, sets: [] }
  ]);
  ok('G1 Snapshot fuehrt supersetGroup (null = keine)', snap[0].supersetGroup === 1 && snap[2].supersetGroup === null && snap[3].supersetGroup === 2);
  /* _workoutDetailHtml aus activity.js herausschneiden (globale Datei, kein Modul). */
  const actRaw = fs.readFileSync(new URL(_APPREL + 'js/activity.js', import.meta.url), 'utf8');
  const i0 = actRaw.indexOf('function _workoutDetailHtml('); let d = 0, st0 = false, i1 = -1;
  for (let j = i0; j < actRaw.length; j++) { const ch = actRaw[j]; if (ch === '{') { d++; st0 = true; } else if (ch === '}') { d--; if (st0 && d === 0) { i1 = j + 1; break; } } }
  const fn = new Function('escH', 'window', 'ORVIA', actRaw.slice(i0, i1) + '; return _workoutDetailHtml;')(s => String(s), global.window, O);
  const html = fn({ source: 'orvia_workout', workoutDetail: snap });
  ok('G2 A und B tragen „Superset A", C nichts', (html.match(/Superset A/g) || []).length === 2 && html.indexOf('>C</span></div>') >= 0);
  ok('G3 Einzel-Gruppe (D) bekommt KEIN Label', html.indexOf('Superset B') < 0);
  ok('G4 alte Snapshots ohne Feld rendern unveraendert', fn({ source: 'orvia_workout', workoutDetail: [{ exerciseNameSnapshot: 'X' }] }).indexOf('Superset') < 0);
}

console.log('\n' + (fail ? '❌' : '✅') + ' workout_gym_wiring: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
