/* ORVIA · activity-sync + activityRepository — Outbox/RPC-Vertrag (Inkrement 2B, OFFLINE-Stub).
   Verifiziert Kontrakt/Idempotenz mit Supabase-Stub — NICHT live (keine echte DB). */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = globalThis;
globalThis.ORVIA = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/activityRepository.js');
load('js/activity-normalize.js');
load('js/activity-store.js');
load('js/activity-sync.js');
globalThis.ORVIA.user = { id: 'u1' };

// Supabase-Stub: rpc liefert serverseitige Activity zurück; from().select... liefert leer.
let rpcCalls = [];
globalThis.ORVIA.sb = {
  rpc: (name, args) => { rpcCalls.push({ name, args }); return Promise.resolve({ data: [{ id: 'srv-' + args.p_session_id, source: 'orvia_workout', source_record_id: args.p_session_id }], error: null }); },
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }), limit: () => Promise.resolve({ data: [], error: null }) }) }) })
};
const S = globalThis.ORVIA.activityStore;
const sync = globalThis.ORVIA.activitySync;
const repo = globalThis.ORVIA.repos.activity;
function reset() { for (const k of Object.keys(mem)) delete mem[k]; rpcCalls = []; }

await (async () => {
  // Seed: ein abgeschlossenes Workout (workoutSessionId = Server-uuid 'w1')
  reset();
  S.upsertActivityFromWorkout({ id: 'w1', sport_key: 'gym', status: 'completed', duration_min: 60 }, [{ workoutExercise: { exercise_id: 'b' }, exercise: { name: 'X' }, sets: [{ set_number: 1, set_type: 'working', weight: 70, reps: 10, completed: true }] }], { syncStatus: 'pending' });
  ok('vor Flush: 1 pending', S.pendingActivities().length === 1);
  let r = await sync.flushPendingActivities();
  ok('Flush ok, pushed 1', r.ok && r.pushed === 1);
  ok('RPC genau einmal mit p_session_id=w1', rpcCalls.length === 1 && rpcCalls[0].name === 'orvia_upsert_activity_from_session' && rpcCalls[0].args.p_session_id === 'w1');
  ok('lokale Activity jetzt synced + Server-id', (function () { var a = S.getActivityById('srv-w1'); return a && a.syncStatus === 'synced' && a.id === 'srv-w1'; })());
  ok('keine pending mehr', S.pendingActivities().length === 0);
  // Idempotent: zweiter Flush macht nichts
  let r2 = await sync.flushPendingActivities();
  ok('zweiter Flush: pushed 0 (idempotent)', r2.pushed === 0 && rpcCalls.length === 1);

  // Offline → No-Op, kein RPC
  reset();
  S.upsertActivityFromWorkout({ id: 'w2', sport_key: 'gym', status: 'completed', duration_min: 30 }, [], { syncStatus: 'pending' });
  globalThis.navigator.onLine = false;
  let r3 = await sync.flushPendingActivities();
  ok('offline: kein Push, kein RPC', r3.ok === false && r3.error === 'offline' && rpcCalls.length === 0);
  ok('offline: bleibt pending', S.pendingActivities().length === 1);
  globalThis.navigator.onLine = true;

  // Nur offline-Session (kein workoutSessionId) → übersprungen, nicht gepusht
  reset();
  // Session ohne id (offline) → activityRowFromSession workout_session_id null
  S.upsertActivityFromWorkout({ id: null, client_session_id: 'c9', sport_key: 'gym', status: 'completed', duration_min: 20 }, [], { syncStatus: 'pending' });
  let r4 = await sync.flushPendingActivities();
  ok('offline-only-Session übersprungen (kein RPC)', r4.skipped === 1 && rpcCalls.length === 0);
  ok('übersprungene bleibt pending', S.pendingActivities().length === 1);

  // Repo offline → strukturierter Fehler
  globalThis.navigator.onLine = false;
  let ro = await repo.upsertFromSession('w1', {});
  ok('repo.upsertFromSession offline → pending/offline', ro.success === false && ro.error.code === 'offline');
  globalThis.navigator.onLine = true;
  // Repo ohne sessionId
  let ri = await repo.upsertFromSession(null, {});
  ok('repo.upsertFromSession ohne id → invalid_session_id', ri.success === false && ri.error.code === 'invalid_session_id');
  // Repo list mit Stub → success
  let rl = await repo.list();
  ok('repo.list liefert success', rl.success === true);
})();

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
