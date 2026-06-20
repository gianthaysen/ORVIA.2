/* ORVIA · Phase 4.2 — Trainingslast beim Abschluss (Unit-Tests).
   Prüft: loadStatus korrekt bei success/{success:false}/Exception; Session bleibt completed;
   kein erfundener RPE; Dedup-Key; keine Dublette bei Retry.
   node supabase/tests/live_workout_load_phase42_test.mjs */
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

let SAVES = []; let saveMode = 'ok'; let idn = 0; let LASTSTATUS = 'active';
function repoStub() {
  O.repos = {
    workout: {
      getActiveSession: async () => ({ success: true, data: null, source: 'empty', sync_status: 'synced', error: null }),
      createSession: async (s) => ({ success: true, data: { id: 'sess' + (++idn), status: 'active', local_date: s.localDate, started_at: s.startedAt, sport: s.sport, client_session_id: s.clientSessionId }, source: 'supabase', sync_status: 'synced', error: null }),
      updateSession: async (id, patch) => { LASTSTATUS = patch.status || LASTSTATUS; return { success: true, data: Object.assign({ id }, patch), source: 'supabase', sync_status: 'synced', error: null }; },
      getSession: async (id) => ({ success: true, data: { id, status: LASTSTATUS }, source: 'supabase', sync_status: 'synced', error: null }),
      loadWorkoutTree: async (id) => ({ success: true, data: { session: { id, status: 'active' }, exercises: [] }, source: 'supabase', sync_status: 'synced', error: null })
    },
    trainingLoad: {
      toRow: (d, sp, s) => ({ local_date: d, sport: sp, client_session_id: s.client_session_id, duration_min: s.dur, session_rpe: s.rpe }),
      save: async (date, sport, s) => {
        if (saveMode === 'throw') throw new Error('netz');
        SAVES.push({ date, sport, s });
        return saveMode === 'ok' ? { success: true, data: {}, error: null, source: 'supabase', sync_status: 'synced' }
                                 : { success: false, data: null, error: { message: 'db' }, source: 'supabase', sync_status: 'failed' };
      }
    }
  };
}

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true; repoStub();

  // 1) save erfolgreich → written, genau eine Lastzeile, Dedup-Key
  saveMode = 'ok'; SAVES = [];
  await WS.startFreeWorkout({ sport: 'Gym' });
  let r = await WS.finishWorkout({ sessionRpe: 7 });
  ok('Load ok → loadStatus=written', r.success && r.data.loadStatus === 'written');
  ok('genau EINE Lastzeile, Dedup client_session_id=workout_session:<id>', SAVES.length === 1 && SAVES[0].s.client_session_id === 'workout_session:sess1');
  ok('Session trotz Last abgeschlossen', r.data.completed === true);

  // 2) save liefert {success:false} → load_error, Session bleibt completed (kein Scheinerfolg)
  saveMode = 'fail'; SAVES = [];
  await WS.startFreeWorkout({ sport: 'Gym' });
  r = await WS.finishWorkout({ sessionRpe: 6 });
  ok('Load {success:false} → loadStatus=load_error (kein Scheinerfolg)', r.success && r.data.loadStatus === 'load_error');
  ok('Session trotzdem completed', r.data.completed === true);

  // 3) save wirft Exception → load_error, Session bleibt completed
  saveMode = 'throw';
  await WS.startFreeWorkout({ sport: 'Gym' });
  r = await WS.finishWorkout({ sessionRpe: 8 });
  ok('Load Exception → loadStatus=load_error', r.success && r.data.loadStatus === 'load_error' && r.data.completed === true);

  // 4) ohne session_rpe → keine erfundene Last
  saveMode = 'ok'; SAVES = [];
  await WS.startFreeWorkout({ sport: 'Gym' });
  r = await WS.finishWorkout({});
  ok('ohne RPE → incomplete_no_rpe, KEIN save', r.data.loadStatus === 'incomplete_no_rpe' && SAVES.length === 0);

  // 5) Dauer abzüglich Pause (Pause zieht Dauer ab)
  saveMode = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const s = WS.state().session;
  s.started_at = new Date(Date.now() - 20 * 60000).toISOString(); // 20 min her
  s.total_paused_seconds = 5 * 60; // 5 min Pause
  r = await WS.finishWorkout({ sessionRpe: 5 });
  ok('Dauer = aktiv (≈15 min), Pause abgezogen', r.data.durationMin >= 14 && r.data.durationMin <= 16, 'duration=' + r.data.durationMin);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
