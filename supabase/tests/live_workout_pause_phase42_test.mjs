/* ORVIA · Phase 4.2 — Pause-Semantik + Resttimer (Unit-Tests).
   Pause zieht echte Dauer ab; Timer nutzt absolutes endAt (+15s bleibt, reload-fest, Ablauf einmal).
   P0 (TEST-GAP-PLAN): deterministische Zeit über feste ORVIA.clock — exakte Asserts statt Toleranzfenster.
   node supabase/tests/live_workout_pause_phase42_test.mjs */
import fs from 'fs';
import { fixedClock, installClock } from './_helpers.mjs';
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
const CLK = fixedClock(Date.parse('2026-06-19T10:00:00Z'));
installClock(O, CLK);
const NOW = () => CLK.now();

let idn = 0; let LASTSTATUS = 'active';
O.repos = {
  workout: {
    getActiveSession: async () => ({ success: true, data: null, source: 'empty', sync_status: 'synced', error: null }),
    createSession: async (s) => ({ success: true, data: { id: 'sess' + (++idn), status: 'active', local_date: s.localDate, started_at: s.startedAt, sport: s.sport, client_session_id: s.clientSessionId, total_paused_seconds: 0 }, source: 'supabase', sync_status: 'synced', error: null }),
    updateSession: async (id, patch) => { LASTSTATUS = patch.status || LASTSTATUS; return { success: true, data: Object.assign({ id }, patch), source: 'supabase', sync_status: 'synced', error: null }; },
    getSession: async (id) => ({ success: true, data: { id, status: LASTSTATUS }, source: 'supabase', sync_status: 'synced', error: null }),
    closeActiveSession: async (id, target, opts) => { const s = O.workoutStore.state().session || {}; const sa = s.started_at ? new Date(s.started_at) : null; let paused = (s.total_paused_seconds || 0); if (s.paused_at) paused += Math.max(0, (NOW() - new Date(s.paused_at).getTime()) / 1000); const dur = sa ? Math.max(0, Math.round((NOW() - sa.getTime() - paused * 1000) / 60000)) : 0; LASTSTATUS = target; return { success: true, data: { id, status: target, duration_min: dur, session_rpe: (opts && opts.sessionRpe != null) ? opts.sessionRpe : null }, source: 'supabase', sync_status: 'synced', error: null }; },
    addExercise: async (sid, ex) => ({ success: true, data: { id: 'we1', client_exercise_id: ex.clientExerciseId, exercise_id: ex.exerciseId, planned_sets: ex.plannedSets, rest_seconds: ex.restSeconds }, source: 'supabase', sync_status: 'synced', error: null })
  },
  trainingLoad: { save: async () => ({ success: true, data: {}, error: null, source: 'supabase', sync_status: 'synced' }) }
};

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;

  // ---- Pause ----
  await WS.startFreeWorkout({ sport: 'Gym' });
  const s = WS.state().session;
  s.started_at = new Date(NOW() - 20 * 60000).toISOString(); // vor 20 min gestartet (feste Uhr)
  let r = WS.pauseWorkout();
  ok('pauseWorkout → isPaused true', WS.isPaused() && r.success);
  // 10-min-Pause simulieren
  s.paused_at = new Date(NOW() - 10 * 60000).toISOString();
  r = WS.resumeWorkout();
  ok('resumeWorkout → exakt 600s Pause summiert, nicht mehr pausiert', !WS.isPaused() && s.total_paused_seconds === 600, 'paused=' + s.total_paused_seconds);
  r = await WS.finishWorkout({ sessionRpe: 6 });
  ok('Dauer = 20 min − 10 min Pause = exakt 10 min', r.data.durationMin === 10, 'duration=' + r.data.durationMin);

  // Abschluss WÄHREND laufender Pause: laufende Pause wird ebenfalls abgezogen
  idn = 0; await WS.startFreeWorkout({ sport: 'Gym' });
  const s2 = WS.state().session;
  s2.started_at = new Date(NOW() - 30 * 60000).toISOString();
  WS.pauseWorkout();
  s2.paused_at = new Date(NOW() - 12 * 60000).toISOString(); // seit 12 min pausiert
  r = await WS.finishWorkout({ sessionRpe: 6 });
  ok('Abschluss während Pause: laufende Pause abgezogen (exakt 18 min)', r.data.durationMin === 18, 'duration=' + r.data.durationMin);

  // ---- Timer ----
  idn = 0; await WS.startFreeWorkout({ sport: 'Gym' });
  await WS.addExercise('ex1', { plannedSets: 3, restSeconds: 90 });
  let t = WS.startRestTimer(60);
  ok('startRestTimer: läuft, endAt gesetzt, exakt 60s', t.running && t.endAt === NOW() + 60000 && WS.restRemaining() === 60);
  WS.addRestTime(15);
  ok('+15s: Restzeit exakt 75s (bleibt erhalten, kein Reset)', WS.restRemaining() === 75);
  // „nächster Tick" (5s später) verliert die Zusatzzeit NICHT (endAt ist absolut)
  CLK.advance(5000);
  ok('Tick nach 5s: exakt 70s Rest', WS.restRemaining() === 70);
  // Reload-fest: timer ist in localStorage; endAt absolut → Restzeit nach Reload korrekt
  const persisted = JSON.parse(localStorage.getItem('orvia_active_workout_A'));
  ok('Timer in lokaler Kopie (reload-fest)', persisted.timer && persisted.timer.endAt === t.endAt);
  // Ablauf
  t.endAt = NOW() - 1000;
  ok('abgelaufen → restRemaining 0', WS.restRemaining() === 0);
  WS.skipRest();
  ok('skipRest → Timer aus', !WS.state().timer.running && WS.restRemaining() === 0);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
