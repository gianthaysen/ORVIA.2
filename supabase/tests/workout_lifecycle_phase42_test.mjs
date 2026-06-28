/* ORVIA · Phase 4.2f — Workout-Lifecycle mit Server-Verifikation (Unit-Tests).
   Abschluss/Abbrechen/Löschen löschen lokalen Zustand NUR nach bestätigtem Serverstatus.
   Kein Scheinerfolg; bei Serverfehler bleibt die Session lokal aktiv. node supabase/tests/workout_lifecycle_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-20';
global.getDecision = () => ({ _r: { score: 90 }, dayState: 'GREEN', statusText: 'Bereit', todayAction: 'perform', readinessReasons: [] });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;

// Fake-Server-Tabelle (wie echtes Supabase: kein Scheinerfolg, getSession liest zurück).
let SERVER = {}; let n = 0; let UPDATE_MODE = 'ok'; // 'ok' | 'fail' | 'unverified'
const okR = (d) => ({ success: true, data: d, error: null, source: 'supabase', sync_status: 'synced' });
const failR = (c, m) => ({ success: false, data: null, error: { code: c, message: m }, source: 'supabase', sync_status: 'failed' });
O.repos = {
  workout: {
    getActiveSession: async () => { const a = Object.values(SERVER).find(r => r.status === 'active'); return okR(a ? { ...a } : null); },
    createSession: async (s) => { const id = 's' + (++n); SERVER[id] = { id, status: 'active', local_date: s.localDate, sport: s.sport, started_at: s.startedAt, client_session_id: s.clientSessionId, total_paused_seconds: 0 }; return okR({ ...SERVER[id] }); },
    // Atomare RPC: schließt aktive eigene Session in EINEM Schritt (oder Fehler).
    closeActiveSession: async (id, target, opts) => {
      if (UPDATE_MODE === 'fail') return failR('workout_close_failed', 'rpc error');
      const row = SERVER[id];
      if (!row || row.status !== 'active') return failR('workout_close_unconfirmed', 'Workout-Status wurde nicht bestätigt.');
      if (UPDATE_MODE === 'unverified') return failR('workout_close_unconfirmed', 'Workout-Status wurde nicht bestätigt.');
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      row.status = target; row.finished_at = new Date().toISOString();
      row.duration_min = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000)) : 0;
      if (target === 'completed' && opts && opts.sessionRpe != null) row.session_rpe = opts.sessionRpe;
      if (target !== 'completed' && opts && opts.cancelReason) row.cancel_reason = opts.cancelReason;
      return okR({ ...row });
    },
    updateSession: async (id, patch) => { if (!SERVER[id]) return failR('no_row_updated', 'x'); Object.assign(SERVER[id], patch); return okR({ ...SERVER[id] }); },
    getSession: async (id) => okR(SERVER[id] ? { ...SERVER[id] } : null),
    deleteSession: async (id) => { if (!SERVER[id]) return failR('no_row_deleted', 'Es wurde keine Session gelöscht.'); delete SERVER[id]; return okR({ deleted: 1 }); },
    loadWorkoutTree: async (id) => okR({ session: SERVER[id] ? { ...SERVER[id] } : { id, status: 'active' }, exercises: [] }),
    listExercises: async () => okR([]), listSets: async () => okR([])
  },
  trainingLoad: { save: async () => okR({}), toRow: (d, sp, s) => ({ local_date: d, sport: sp, client_session_id: s.client_session_id }) }
};
const activeCount = () => Object.values(SERVER).filter(r => r.status === 'active').length;

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;

  // 1) FINISH erfolgreich: Server completed + lokaler Zustand geleert
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id1 = WS.state().session.id;
  let r = await WS.finishWorkout({ sessionRpe: 7 });
  ok('finish: erfolgreich', r.success && r.data.completed === true);
  ok('finish: Serverzeile status=completed', SERVER[id1].status === 'completed' && SERVER[id1].finished_at);
  ok('finish: lokaler Store geleert', WS.state().session === null && WS.state().exercises.length === 0);
  ok('finish: keine aktive Session mehr', activeCount() === 0);

  // 2) FINISH-Fehler (Update schlägt fehl): Store BLEIBT aktiv, kein Scheinerfolg
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  UPDATE_MODE = 'fail';
  r = await WS.finishWorkout({ sessionRpe: 7 });
  ok('finish-Fehler: kein Erfolg', !r.success);
  ok('finish-Fehler: Session bleibt lokal aktiv', WS.state().session && WS.state().session.status === 'active');
  ok('finish-Fehler: Serverzeile bleibt active', activeCount() === 1);

  // 3) FINISH unverifiziert (Update meldet ok, Server bleibt active) → Fehler, Store aktiv
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  UPDATE_MODE = 'unverified';
  r = await WS.finishWorkout({ sessionRpe: 7 });
  ok('finish unverifiziert: kein Erfolg (Server nicht completed)', !r.success && r.error.code === 'workout_close_unconfirmed');
  ok('finish unverifiziert: Store bleibt aktiv', WS.state().session && WS.state().session.status === 'active');

  // 4) ABORT erfolgreich
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id4 = WS.state().session.id;
  r = await WS.cancelWorkout('aborted', 'kein Bock');
  ok('abort: erfolgreich, Server aborted', r.success && SERVER[id4].status === 'aborted');
  ok('abort: Store geleert, 0 aktive', WS.state().session === null && activeCount() === 0);

  // 5) ABORT-Fehler: Store bleibt aktiv (nach Reload weiter fortsetzbar)
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  UPDATE_MODE = 'fail';
  r = await WS.cancelWorkout('aborted');
  ok('abort-Fehler: kein Erfolg, Store bleibt aktiv', !r.success && WS.state().session && WS.state().session.status === 'active' && activeCount() === 1);

  // 6) DELETE erfolgreich (verifiziert: getSession danach null)
  SERVER = {}; UPDATE_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id6 = WS.state().session.id;
  r = await WS.cancelWorkout('delete');
  ok('delete: erfolgreich, Serverzeile weg', r.success && !SERVER[id6]);
  ok('delete: Store geleert, 0 aktive', WS.state().session === null && activeCount() === 0);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
