/* ORVIA · INCIDENT 2026-07-15 — Stuck-Session-Recovery (no_row_deleted-Deadlock).
   Bug: Der Hub zeigte eine lokale/stale „aktive" Session, die serverseitig bereits
   beendet/gelöscht war. „Endgültig löschen" → deleteSession → no_row_deleted;
   „Festhängendes Training beenden" → closeActiveSession → workout_close_unconfirmed.
   Beide Pfade weigerten sich, den lokalen Zustand zu leeren → Nutzer saß dauerhaft fest.
   Verträge:
   - delete: Session serverseitig WEG → idempotenter Erfolg, Store geleert.
   - delete: Session existiert noch (z. B. RLS/Deploy-Problem) → Fehler bleibt, Store bleibt (fail closed).
   - aborted: Session bereits terminal ODER weg → Erfolg, Store geleert.
   - aborted: Session noch aktiv, RPC-Fehler → Fehler bleibt, Store bleibt (bestehendes Verhalten).
   - getSession nicht erreichbar → kein Scheinerfolg.
   node supabase/tests/workout_stuck_session_recovery_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-07-15';
global.getDecision = () => null;
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;

let SERVER = {}; let n = 0; let GET_SESSION_MODE = 'ok'; // 'ok' | 'fail'
const okR = (d) => ({ success: true, data: d, error: null, source: 'supabase', sync_status: 'synced' });
const failR = (c, m) => ({ success: false, data: null, error: { code: c, message: m }, source: 'supabase', sync_status: 'failed' });
O.repos = {
  workout: {
    getActiveSession: async () => { const a = Object.values(SERVER).find(r => r.status === 'active'); return okR(a ? { ...a } : null); },
    createSession: async (s) => { const id = 's' + (++n); SERVER[id] = { id, status: 'active', local_date: s.localDate, sport: s.sport, started_at: s.startedAt, client_session_id: s.clientSessionId, total_paused_seconds: 0 }; return okR({ ...SERVER[id] }); },
    closeActiveSession: async (id, target, opts) => {
      const row = SERVER[id];
      if (!row || row.status !== 'active') return failR('workout_close_unconfirmed', 'Workout-Status wurde nicht bestätigt.');
      row.status = target; row.finished_at = new Date().toISOString(); row.duration_min = 1;
      return okR({ ...row });
    },
    updateSession: async (id, patch) => { if (!SERVER[id]) return failR('no_row_updated', 'x'); Object.assign(SERVER[id], patch); return okR({ ...SERVER[id] }); },
    getSession: async (id) => GET_SESSION_MODE === 'fail' ? failR('query_failed', 'offline') : okR(SERVER[id] ? { ...SERVER[id] } : null),
    deleteSession: async (id) => { if (!SERVER[id]) return failR('no_row_deleted', 'Es wurde keine Session gelöscht.'); delete SERVER[id]; return okR({ deleted: 1 }); },
    loadWorkoutTree: async (id) => okR({ session: SERVER[id] ? { ...SERVER[id] } : null, exercises: [] }),
    listExercises: async () => okR([]), listSets: async () => okR([])
  },
  trainingLoad: { save: async () => okR({}), toRow: () => ({}) }
};

const run = async () => {
  O.user = { id: 'A' }; navigator.onLine = true;

  // 1) DELETE einer serverseitig BEREITS GELÖSCHTEN Session → Erfolg, Store geleert (der Incident-Fall)
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Krafttraining' });
  const id1 = WS.state().session.id;
  delete SERVER[id1];                                    // Server-Zeile ist weg (z. B. anderes Gerät/früherer Versuch)
  let r = await WS.cancelWorkout('delete');
  ok('S1 delete bei fehlender Server-Zeile → idempotenter Erfolg', r.success === true, r.error && r.error.code);
  ok('S1 Store geleert (kein Deadlock mehr)', WS.state().session === null);

  // 2) DELETE, aber Zeile EXISTIERT noch und Delete liefert 0 Zeilen (RLS/Deploy-Problem) → Fehler bleibt
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id2 = WS.state().session.id;
  const origDelete = O.repos.workout.deleteSession;
  O.repos.workout.deleteSession = async () => failR('no_row_deleted', 'Es wurde keine Session gelöscht.'); // Zeile bleibt in SERVER
  r = await WS.cancelWorkout('delete');
  O.repos.workout.deleteSession = origDelete;
  ok('S2 delete bei existierender, nicht löschbarer Zeile → Fehler bleibt sichtbar', !r.success && r.error.code === 'no_row_deleted');
  ok('S2 Store bleibt aktiv (fail closed)', WS.state().session && WS.state().session.id === id2);
  await WS.cancelWorkout('delete');                      // aufräumen (jetzt löschbar)

  // 3) ABORT einer serverseitig bereits TERMINALEN Session → Erfolg, Store geleert
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id3 = WS.state().session.id;
  SERVER[id3].status = 'completed';                      // z. B. auf anderem Gerät abgeschlossen
  r = await WS.cancelWorkout('aborted', 'stale_session_recovery');
  ok('S3 abort bei bereits terminaler Session → Erfolg', r.success === true, r.error && r.error.code);
  ok('S3 Store geleert', WS.state().session === null);
  ok('S3 Server-Status NICHT überschrieben (completed bleibt)', SERVER[id3].status === 'completed');

  // 4) ABORT einer serverseitig GELÖSCHTEN Session → Erfolg, Store geleert
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  delete SERVER[WS.state().session.id];
  r = await WS.cancelWorkout('aborted', 'stale_session_recovery');
  ok('S4 abort bei fehlender Server-Zeile → Erfolg', r.success === true, r.error && r.error.code);
  ok('S4 Store geleert', WS.state().session === null);

  // 5) ABORT, Session noch aktiv, RPC scheitert → Fehler bleibt, Store bleibt (Bestandsvertrag)
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  const id5 = WS.state().session.id;
  const origClose = O.repos.workout.closeActiveSession;
  O.repos.workout.closeActiveSession = async () => failR('workout_close_failed', 'rpc error');
  r = await WS.cancelWorkout('aborted');
  O.repos.workout.closeActiveSession = origClose;
  ok('S5 abort bei aktiver Session + RPC-Fehler → Fehler bleibt', !r.success && r.error.code === 'workout_close_failed');
  ok('S5 Store bleibt aktiv, Server bleibt aktiv', WS.state().session && SERVER[id5].status === 'active');

  // 6) Verifikation selbst nicht möglich (getSession fail) → kein Scheinerfolg
  SERVER = {}; GET_SESSION_MODE = 'ok';
  await WS.startFreeWorkout({ sport: 'Gym' });
  delete SERVER[WS.state().session.id];
  GET_SESSION_MODE = 'fail';
  r = await WS.cancelWorkout('delete');
  ok('S6 Serverzustand unbekannt → Fehler bleibt (kein Scheinerfolg)', !r.success && r.error.code === 'no_row_deleted');
  ok('S6 Store bleibt (Nutzer kann erneut versuchen)', !!WS.state().session);

  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  process.exit(fail ? 1 : 0);
};
run();
