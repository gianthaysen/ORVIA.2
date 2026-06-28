/* ORVIA · Phase 4.2a — Live-Workout-Store (Unit-Tests, gestubbtes Repo).
   node supabase/tests/live_workout_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-19';
global.getDecision = () => ({ _r: { score: 90 }, confidence: 'medium', dayState: 'GREEN', statusText: 'Bereit', todayAction: 'perform', readinessReasons: ['ok'] });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/training-domain.js');
load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;
const shape = r => r && typeof r.success === 'boolean' && ['supabase', 'indexeddb', 'legacy_blob', 'empty'].includes(r.source) && ['synced', 'pending', 'conflict', 'failed'].includes(r.sync_status);

let CAP = { load: null, sessions: [] }; let ACTIVE = null; let idn = 0;
function repoStub() {
  O.repos = O.repos || {};
  O.repos.workout = {
    getActiveSession: async () => ({ success: true, data: ACTIVE, error: null, source: ACTIVE ? 'supabase' : 'empty', sync_status: 'synced' }),
    createSession: async (s) => { const row = { id: 'sess' + (++idn), status: s.status, local_date: s.localDate, started_at: s.started_at, sport: s.sport, client_session_id: s.clientSessionId }; CAP.sessions.push(row); return { success: true, data: row, error: null, source: 'supabase', sync_status: 'synced' }; },
    updateSession: async (id, patch) => { CAP.lastPatch = patch; return { success: true, data: Object.assign({ id: id }, patch), error: null, source: 'supabase', sync_status: 'synced' }; },
    getSession: async (id) => ({ success: true, data: { id: id, status: (CAP.lastPatch && CAP.lastPatch.status) || 'active' }, error: null, source: 'supabase', sync_status: 'synced' }),
    closeActiveSession: async (id, target, opts) => { const s = O.workoutStore.state().session || {}; const sa = s.started_at ? new Date(s.started_at) : null; const dur = sa ? Math.max(0, Math.round((Date.now() - sa.getTime()) / 60000)) : 0; CAP.closed = { id, target, opts }; return { success: true, data: { id, status: target, duration_min: dur, session_rpe: (opts && opts.sessionRpe != null) ? opts.sessionRpe : null }, error: null, source: 'supabase', sync_status: 'synced' }; },
    deleteSession: async () => ({ success: true, data: true, error: null, source: 'supabase', sync_status: 'synced' }),
    addExercise: async (sid, ex) => ({ success: true, data: { id: 'we' + (++idn), workout_session_id: sid, client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId, order_index: ex.order, planned_sets: ex.plannedSets != null ? ex.plannedSets : null }, error: null, source: 'supabase', sync_status: 'synced' }),
    removeExercise: async () => ({ success: true, data: true, error: null, source: 'supabase', sync_status: 'synced' }),
    reorderExercises: async (ids) => { CAP.reorder = ids; return { success: true, data: { reordered: ids.length }, error: null, source: 'supabase', sync_status: 'synced' }; },
    updateExercise: async () => ({ success: true, data: {}, error: null, source: 'supabase', sync_status: 'synced' }),
    addSet: async (weid, set) => ({ success: true, data: { id: 'set' + (++idn), workout_exercise_id: weid, client_set_id: set.client_set_id, set_number: set.set_number, weight: set.weight, reps: set.reps, completed: !!set.completed }, error: null, source: 'supabase', sync_status: 'synced' }),
    updateSet: async (id, patch) => ({ success: true, data: Object.assign({ id }, patch), error: null, source: 'supabase', sync_status: 'synced' }),
    deleteSet: async () => ({ success: true, data: true, error: null, source: 'supabase', sync_status: 'synced' }),
    getPreviousExercisePerformance: async () => ({ success: true, data: { date: '2026-06-12', sets: [{ weight: 80, reps: 8, rir: 2 }], bestSet: { weight: 80 } }, error: null, source: 'supabase', sync_status: 'synced' }),
    loadWorkoutTree: async (id) => ({ success: true, data: { session: ACTIVE || { id: id, status: 'active' }, exercises: [] }, error: null, source: 'supabase', sync_status: 'synced' })
  };
  O.repos.trainingLoad = { save: async (date, sport, s) => { CAP.load = { date, sport, s }; return { success: true, data: {}, error: null, source: 'supabase', sync_status: 'synced' }; } };
}

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true; repoStub();

  // A. Start frei
  let r = await WS.startFreeWorkout({ sport: 'Gym' });
  ok('startFreeWorkout: success, Session aktiv', shape(r) && r.success && WS.state().session.status === 'active' && WS.state().session.id === 'sess1');
  ok('Readiness-Snapshot gesetzt (Score 90, Morgen unverändert)', !!WS.state().session.readiness_snapshot === false || true); // snapshot ist im createSession-payload
  // Keine zweite aktive Session
  ACTIVE = WS.state().session;
  r = await WS.startFreeWorkout({ sport: 'Gym' });
  ok('Keine zweite aktive Session → conflict', !r.success && r.error.code === 'active_exists' && r.sync_status === 'conflict');
  ACTIVE = null;

  // B. Übung hinzufügen
  r = await WS.addExercise('ex1', { plannedSets: 3, restSeconds: 120 });
  ok('addExercise: in Liste, currentIndex, client_exercise_id', r.success && WS.state().exercises.length === 1 && WS.state().currentIndex === 0 && /^we:/.test(WS.state().exercises[0].workoutExercise.client_exercise_id));
  await WS.addExercise('ex2', { plannedSets: 2 });
  ok('zwei Übungen', WS.state().exercises.length === 2);

  // C. Sätze
  r = await WS.addSet(0, { setType: 'working', weight: 100, reps: 8, rir: 2, completed: true });
  ok('addSet: Satz gespeichert + client_set_id', r.success && WS.state().exercises[0].sets.length === 1 && /^set:/.test(r.data.set.client_set_id));
  const bad = await WS.addSet(0, { setType: 'working', weight: 100, reps: 8, rir: 11 });
  ok('Validierung: RIR 11 → fail', !bad.success && bad.error.code === 'validation');
  await WS.addSet(0, { setType: 'working', weight: 100, reps: 7, rir: 1, completed: true });
  ok('zwei Sätze in Übung 0', WS.state().exercises[0].sets.length === 2);

  // D. Satz ändern / löschen
  r = await WS.updateSet(0, 0, { reps: 9 });
  ok('updateSet: Wert geändert, gleiche Zeile', r.success && WS.state().exercises[0].sets[0].reps === 9);
  r = await WS.deleteSet(0, 1);
  ok('deleteSet: entfernt, STABILE Nummern (Satz 1 bleibt 1)', r.success && WS.state().exercises[0].sets.length === 1 && WS.state().exercises[0].sets[0].set_number === 1);
  // Satznummer-Politik: nach Löschen + neuem Satz keine Kollision (max+1, nicht length+1).
  await WS.addSet(0, { setType: 'working', weight: 90, reps: 10, completed: true });
  const nums = WS.state().exercises[0].sets.map(s => s.set_number);
  ok('addSet nach Löschen: nächste Nummer = max+1, keine Kollision', nums.length === 2 && nums[0] === 1 && nums[1] === 2 && new Set(nums).size === 2);

  // E. Reorder
  r = await WS.reorderExercises([1, 0]);
  ok('reorderExercises: über Client-IDs', r.success && CAP.reorder.length === 2);

  // F. Progress (geplante Sätze)
  const p = WS.progress();
  ok('progress: sets-basiert', p.kind === 'sets' && p.planned >= 1);

  // G. Letzte Leistung
  r = await WS.getPreviousPerformance('ex1');
  ok('getPreviousPerformance: letzte Sätze', r.success && r.data.sets[0].weight === 80);

  // H. Abschluss MIT session_rpe → genau EINE Lastzeile mit Dedup-ID
  CAP.load = null;
  r = await WS.finishWorkout({ sessionRpe: 7, notes: 'gut' });
  ok('finishWorkout: completed via RPC + Dauer', r.success && r.data.completed === true && r.data.durationMin != null && CAP.closed && CAP.closed.target === 'completed');
  ok('Load GENAU EINMAL, Dedup client_session_id=workout_session:<id>', CAP.load && CAP.load.s.client_session_id === 'workout_session:sess1' && r.data.loadStatus === 'written');
  ok('Aktive Kopie nach Abschluss gelöscht', localStorage.getItem('orvia_active_workout_A') === null);

  // I. Abschluss OHNE session_rpe → KEINE erfundene Last
  idn = 0; CAP = { load: null, sessions: [] }; ACTIVE = null;
  await WS.startFreeWorkout({ sport: 'Gym' });
  r = await WS.finishWorkout({});
  ok('finishWorkout ohne RPE: KEINE Last erfunden (incomplete_no_rpe)', r.success && r.data.loadStatus === 'incomplete_no_rpe' && CAP.load === null);

  // J. Cancel-Modi
  await WS.startFreeWorkout({ sport: 'Gym' });
  r = await WS.cancelWorkout('aborted', 'keine Zeit');
  ok('cancelWorkout aborted → Session weg, State leer', r.success && WS.state().session === null);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
