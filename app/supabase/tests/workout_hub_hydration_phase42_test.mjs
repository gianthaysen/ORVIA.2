/* ORVIA · Phase 4.2e — Active-Workout-Hydrierung + Home-Routing + Schnellstart-Sperre.
   Behebt: Hub zeigt „Training starten", obwohl serverseitig eine aktive Session existiert.
   node supabase/tests/workout_hub_hydration_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

// --- DOM-light Stubs (workout-ui referenziert document/localStorage/showTab) ---
global.window = { addEventListener: () => {}, ORVIA: {} };
global.document = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-20';
global.showTab = () => {};

const O = global.window.ORVIA;
O.user = { id: 'A' };
O.trainingDomain = { MUSCLE_GROUPS_DE: [], labelMovement: x => x || '', groupOfMovement: () => null };

// Stub-Store: Server „besitzt" eine aktive Session; restoreActiveWorkout hydriert den lokalen State.
let SERVER_ACTIVE = { id: 'srv1', status: 'active', sport: 'Gym', started_at: new Date(Date.now() - 18 * 60000).toISOString(), total_paused_seconds: 0 };
let restoreCalls = 0, startCalls = 0;
const ST = { session: null, exercises: [], currentIndex: 0, timer: {} };
O.workoutStore = {
  state: () => ST,
  restoreActiveWorkout: async () => { restoreCalls++; await new Promise(r => setTimeout(r, 5)); if (SERVER_ACTIVE) { ST.session = SERVER_ACTIVE; ST.exercises = [{ workoutExercise: {}, exercise: null, sets: [] }, { workoutExercise: {}, exercise: null, sets: [] }]; } return { success: true, data: { session: ST.session }, source: 'supabase', sync_status: 'synced', error: null }; },
  startFreeWorkout: async () => { startCalls++; ST.session = { id: 'new', status: 'active', sport: 'Gym', started_at: new Date().toISOString() }; return { success: true, data: { session: ST.session }, source: 'supabase', sync_status: 'synced', error: null }; },
  progress: () => ({ kind: 'exercises', total: 2, completed: 0, pct: 0 }),
  restRemaining: () => 0, isPaused: () => false
};
O.repos = { exercise: { list: async () => ({ success: true, data: [] }) }, workout: { listSessions: async () => ({ success: true, data: [] }) } };

const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/workout-ui.js');
const UI = O.workoutUI;

const run = async () => {
  // 1) Store leer, Server hat aktive Session → Hydrierung erkennt „aktiv"
  ST.session = null; ST.exercises = []; restoreCalls = 0;
  let res = await UI.ensureActiveWorkoutLoaded();
  ok('ensureActiveWorkoutLoaded: Server-Session hydriert → active', res.active === true && ST.session && ST.session.id === 'srv1');
  ok('Workout-Tree geladen (Übungen im Store)', ST.exercises.length === 2);

  // 2) Single-Flight: parallele Aufrufe teilen einen Restore
  ST.session = null; ST.exercises = []; restoreCalls = 0;
  const [a, b, c] = await Promise.all([UI.ensureActiveWorkoutLoaded(), UI.ensureActiveWorkoutLoaded(), UI.ensureActiveWorkoutLoaded()]);
  ok('Single-Flight: nur EIN Restore trotz 3 paralleler Aufrufe', restoreCalls === 1 && a.active && b.active && c.active);

  // 3) openFromToday bei aktiver Session → Overlay öffnen (kein Tab-Wechsel)
  let opened = 0; UI.open = () => { opened++; };
  ST.session = null; ST.exercises = [];
  await UI.openFromToday();
  ok('openFromToday (aktiv) → Overlay geöffnet', opened === 1);

  // 4) openFromToday ohne aktive Session → KEIN Overlay (Training-Tab)
  SERVER_ACTIVE = null; ST.session = null; ST.exercises = []; opened = 0;
  await UI.openFromToday();
  ok('openFromToday (keine Session) → Overlay NICHT geöffnet', opened === 0);

  // 5) Schnellstart bei bereits aktiver Session → KEIN neuer Insert, Overlay öffnen
  SERVER_ACTIVE = { id: 'srv2', status: 'active', sport: 'Gym', started_at: new Date().toISOString(), total_paused_seconds: 0 };
  ST.session = null; ST.exercises = []; startCalls = 0; opened = 0;
  await UI.startSport('Gym');
  ok('Schnellstart bei aktiver Session: kein zweiter Start, Overlay öffnen', startCalls === 0 && opened === 1);

  // 6) Schnellstart ohne aktive Session → neue Session
  SERVER_ACTIVE = null; ST.session = null; ST.exercises = []; startCalls = 0; opened = 0;
  await UI.startSport('Laufen');
  ok('Schnellstart ohne aktive Session → genau ein Start', startCalls === 1 && opened === 1);

  // 7) resumeActive hydriert und öffnet
  SERVER_ACTIVE = { id: 'srv3', status: 'active', sport: 'Gym', started_at: new Date().toISOString(), total_paused_seconds: 0 };
  ST.session = null; ST.exercises = []; opened = 0;
  await UI.resumeActive();
  ok('resumeActive: hydriert + Overlay geöffnet', opened === 1 && ST.session.id === 'srv3');

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
