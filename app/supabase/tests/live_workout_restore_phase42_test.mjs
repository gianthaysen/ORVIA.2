/* ORVIA · Phase 4.2a — Restore / Reload (Unit-Tests).
   node supabase/tests/live_workout_restore_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-19';
global.getDecision = () => ({ _r: { score: 88 }, dayState: 'GREEN', todayAction: 'perform', readinessReasons: [] });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;

let ACTIVE = null, TREE = null, idn = 0;
O.repos = { workout: {
  getActiveSession: async () => ({ success: true, data: ACTIVE, source: ACTIVE ? 'supabase' : 'empty', sync_status: 'synced', error: null }),
  createSession: async (s) => { ACTIVE = { id: 'sess1', status: 'active', local_date: s.localDate, started_at: s.started_at, sport: s.sport, client_session_id: s.clientSessionId }; return { success: true, data: ACTIVE, source: 'supabase', sync_status: 'synced', error: null }; },
  addExercise: async (sid, ex) => ({ success: true, data: { id: 'we1', workout_session_id: sid, client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId, order_index: ex.order, planned_sets: ex.plannedSets }, source: 'supabase', sync_status: 'synced', error: null }),
  addSet: async (weid, set) => ({ success: true, data: { id: 'set1', workout_exercise_id: weid, client_set_id: set.client_set_id, set_number: set.set_number, weight: set.weight, reps: set.reps, completed: !!set.completed }, source: 'supabase', sync_status: 'synced', error: null }),
  loadWorkoutTree: async () => ({ success: true, data: TREE, source: 'supabase', sync_status: 'synced', error: null })
} };

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;
  await WS.startFreeWorkout({ sport: 'Gym' });
  await WS.addExercise('ex1', { plannedSets: 3 });
  await WS.addSet(0, { setType: 'working', weight: 100, reps: 8, completed: true });
  ok('Setup: Session + Übung + Satz', WS.state().session.id === 'sess1' && WS.state().exercises[0].sets.length === 1);

  // Server-Tree für Restore vorbereiten
  TREE = { session: ACTIVE, exercises: [{ workoutExercise: { id: 'we1', client_exercise_id: WS.state().exercises[0].workoutExercise.client_exercise_id, exercise_id: 'ex1', order_index: 0, planned_sets: 3 }, exercise: { id: 'ex1', name: 'Bankdrücken' }, sets: [{ id: 'set1', set_number: 1, weight: 100, reps: 8, completed: true }] }] };

  // Reload simulieren: In-Memory leeren, localStorage + Server bleiben
  WS.state().session = null; WS.state().exercises = [];
  const r = await WS.restoreActiveWorkout();
  ok('restoreActiveWorkout: Session wiederhergestellt', r.success && WS.state().session.id === 'sess1');
  ok('Übungen + Sätze wiederhergestellt', WS.state().exercises.length === 1 && WS.state().exercises[0].sets[0].weight === 100);
  ok('keine zweite Session angelegt (gleiche sess1)', WS.state().session.id === 'sess1');

  // Offline-Restore aus localStorage (Server nicht erreichbar)
  navigator.onLine = false;
  WS.state().session = null; WS.state().exercises = [];
  const r2 = await WS.restoreActiveWorkout();
  ok('Offline-Restore aus lokaler Kopie', r2.success && r2.source === 'indexeddb' && WS.state().session && WS.state().exercises.length === 1);
  navigator.onLine = true;

  // Keine aktive Session → leerer Zustand, kein zweites Workout
  ACTIVE = null;
  WS.state().session = null; WS.state().exercises = [];
  _ls['orvia_active_workout_A'] && delete _ls['orvia_active_workout_A'];
  const r3 = await WS.restoreActiveWorkout();
  ok('keine aktive Session → leerer Zustand', r3.success && WS.state().session === null);

  // Accountwechsel: clearForUserSwitch leert lokale Kopie + State
  ACTIVE = { id: 'sessX', status: 'active' }; await WS.restoreActiveWorkout();
  WS.clearForUserSwitch();
  ok('clearForUserSwitch: State + lokale Kopie leer', WS.state().session === null && localStorage.getItem('orvia_active_workout_A') === null);

  // KRITISCH: loadWorkoutTree schlägt fehl (z.B. Embed-Fehler), getActiveSession liefert Session.
  // Erwartung: Session wird TROTZDEM hydriert (Fallback via listExercises) — kein Steckenbleiben.
  navigator.onLine = true;
  WS.state().session = null; WS.state().exercises = [];
  delete _ls['orvia_active_workout_A'];
  ACTIVE = { id: 'sessFail', status: 'active', sport: 'Gym', local_date: '2026-06-19' };
  O.repos.workout.loadWorkoutTree = async () => ({ success: false, data: null, source: 'supabase', sync_status: 'failed', error: { message: 'embed_failed' } });
  O.repos.workout.listExercises = async (id) => ({ success: true, data: [{ id: 'weR', workout_session_id: id, exercise_id: 'ex1', order_index: 0, client_exercise_id: 'we:r' }], source: 'supabase', sync_status: 'synced', error: null });
  O.repos.workout.listSets = async () => ({ success: true, data: [{ id: 'setR', set_number: 1, weight: 50, reps: 8, completed: true, client_set_id: 'set:r' }], source: 'supabase', sync_status: 'synced', error: null });
  const rf = await WS.restoreActiveWorkout();
  ok('Tree-Fehler → Session trotzdem hydriert (kein Steckenbleiben)', rf.success && WS.state().session && WS.state().session.id === 'sessFail');
  ok('Fallback lädt Übungen + Sätze separat', WS.state().exercises.length === 1 && WS.state().exercises[0].sets.length === 1 && WS.state().exercises[0].sets[0].weight === 50);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
