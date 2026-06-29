/* ORVIA · Phase 4.2 — Active-Session-Race (23505 / one_active) Unit-Test.
   Schlägt der eindeutige Index trotz Vorabprüfung zu, wird KEIN technischer Fehler ausgegeben,
   sondern die bestehende aktive Session geladen/geöffnet. node supabase/tests/live_workout_active_race_phase42_test.mjs */
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

// getActiveSession liefert ZUERST null (Vorabprüfung), nach der 23505-Kollision dann die echte Session.
let activeCalls = 0; const REAL = { id: 'sessReal', status: 'active', local_date: '2026-06-19', sport: 'Gym', client_session_id: 'wk_real' };
O.repos = {
  workout: {
    getActiveSession: async () => { activeCalls++; return activeCalls === 1 ? ({ success: true, data: null, source: 'empty', sync_status: 'synced', error: null }) : ({ success: true, data: REAL, source: 'supabase', sync_status: 'synced', error: null }); },
    createSession: async () => ({ success: false, data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "workout_sessions_one_active"' }, source: 'supabase', sync_status: 'failed' }),
    loadWorkoutTree: async (id) => ({ success: true, data: { session: REAL, exercises: [] }, source: 'supabase', sync_status: 'synced', error: null })
  }
};

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;
  const r = await WS.startFreeWorkout({ sport: 'Gym' });
  ok('23505 → KEIN technischer Fehler, sondern active_exists', !r.success && r.error.code === 'active_exists');
  ok('Meldung ist nutzerfreundlich (kein SQL-Text)', !/duplicate|constraint|23505/i.test(r.error.message));
  ok('Bestehende aktive Session wurde geladen', WS.state().session && WS.state().session.id === 'sessReal');
  ok('getActiveSession erneut aufgerufen (Recovery)', activeCalls >= 2);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
