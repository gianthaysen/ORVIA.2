/* ORVIA · Phase 4.2 — Pause-Semantik + Resttimer (Unit-Tests).
   Pause zieht echte Dauer ab; Timer nutzt absolutes endAt (+15s bleibt, reload-fest, Ablauf einmal).
   node supabase/tests/live_workout_pause_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-19';
global.getDecision = () => ({ _r: { score: 90 }, dayState: 'GREEN', statusText: 'Bereit', todayAction: 'perform', readinessReasons: [] });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;

let idn = 0;
O.repos = {
  workout: {
    getActiveSession: async () => ({ success: true, data: null, source: 'empty', sync_status: 'synced', error: null }),
    createSession: async (s) => ({ success: true, data: { id: 'sess' + (++idn), status: 'active', local_date: s.localDate, started_at: s.startedAt, sport: s.sport, client_session_id: s.clientSessionId, total_paused_seconds: 0 }, source: 'supabase', sync_status: 'synced', error: null }),
    updateSession: async (id, patch) => ({ success: true, data: Object.assign({ id }, patch), source: 'supabase', sync_status: 'synced', error: null }),
    addExercise: async (sid, ex) => ({ success: true, data: { id: 'we1', client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId, planned_sets: ex.plannedSets, rest_seconds: ex.restSeconds }, source: 'supabase', sync_status: 'synced', error: null })
  },
  trainingLoad: { save: async () => ({ success: true, data: {}, error: null, source: 'supabase', sync_status: 'synced' }) }
};

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;

  // ---- Pause ----
  await WS.startFreeWorkout({ sport: 'Gym' });
  const s = WS.state().session;
  s.started_at = new Date(Date.now() - 20 * 60000).toISOString(); // vor 20 min gestartet
  let r = WS.pauseWorkout();
  ok('pauseWorkout → isPaused true', WS.isPaused() && r.success);
  // 10-min-Pause simulieren
  s.paused_at = new Date(Date.now() - 10 * 60000).toISOString();
  r = WS.resumeWorkout();
  ok('resumeWorkout → ~600s Pause summiert, nicht mehr pausiert', !WS.isPaused() && s.total_paused_seconds >= 595 && s.total_paused_seconds <= 605);
  r = await WS.finishWorkout({ sessionRpe: 6 });
  ok('Dauer = 20 min − 10 min Pause ≈ 10 min', r.data.session.duration_min >= 9 && r.data.session.duration_min <= 11, 'duration=' + r.data.session.duration_min);

  // Abschluss WÄHREND laufender Pause: laufende Pause wird ebenfalls abgezogen
  idn = 0; await WS.startFreeWorkout({ sport: 'Gym' });
  const s2 = WS.state().session;
  s2.started_at = new Date(Date.now() - 30 * 60000).toISOString();
  WS.pauseWorkout();
  s2.paused_at = new Date(Date.now() - 12 * 60000).toISOString(); // seit 12 min pausiert
  r = await WS.finishWorkout({ sessionRpe: 6 });
  ok('Abschluss während Pause: laufende Pause abgezogen (≈18 min)', r.data.session.duration_min >= 17 && r.data.session.duration_min <= 19, 'duration=' + r.data.session.duration_min);

  // ---- Timer ----
  idn = 0; await WS.startFreeWorkout({ sport: 'Gym' });
  await WS.addExercise('ex1', { plannedSets: 3, restSeconds: 90 });
  let t = WS.startRestTimer(60);
  ok('startRestTimer: läuft, endAt gesetzt', t.running && t.endAt > Date.now() && WS.restRemaining() >= 59 && WS.restRemaining() <= 60);
  WS.addRestTime(15);
  ok('+15s: Restzeit ~75s (bleibt erhalten, kein Reset)', WS.restRemaining() >= 74 && WS.restRemaining() <= 75);
  // „nächster Tick" verliert die Zusatzzeit NICHT (endAt ist absolut)
  const before = WS.restRemaining();
  ok('Tick verliert +15s nicht', WS.restRemaining() <= before && WS.restRemaining() >= before - 1);
  // Reload-fest: timer ist in localStorage; endAt absolut → Restzeit nach Reload korrekt
  const persisted = JSON.parse(localStorage.getItem('orvia_active_workout_A'));
  ok('Timer in lokaler Kopie (reload-fest)', persisted.timer && persisted.timer.endAt === t.endAt);
  // Ablauf
  t.endAt = Date.now() - 1000;
  ok('abgelaufen → restRemaining 0', WS.restRemaining() === 0);
  WS.skipRest();
  ok('skipRest → Timer aus', !WS.state().timer.running && WS.restRemaining() === 0);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
