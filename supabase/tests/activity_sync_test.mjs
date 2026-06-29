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
  rpc: (name, args) => {
    rpcCalls.push({ name, args });
    if (args.p_session_id === 'wconf') return Promise.resolve({ data: null, error: { message: 'activity_identity_conflict' } });
    return Promise.resolve({ data: [{ id: 'srv-' + args.p_session_id, source: 'orvia_workout', source_record_id: args.p_session_id, client_record_id: args.p_client_record_id }], error: null });
  },
  from: (table) => ({
    select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }), limit: () => Promise.resolve({ data: [], error: null }) }) }),
    upsert: (row) => ({ select: () => { upsertCalls.push({ table, row }); return Promise.resolve({ data: [Object.assign({ id: 'srv-manual-1' }, row)], error: null }); } }),
    delete: () => ({ eq: (k1, v1) => ({ eq: (k2, v2) => { deleteCalls.push({ table, v1 }); return Promise.resolve({ error: null }); } }) })
  })
};
let upsertCalls = [];
let deleteCalls = [];
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

  // RPC sendet client_record_id + metrics
  reset();
  S.upsertActivityFromWorkout({ id: 'w7', sport_key: 'gym', status: 'completed', duration_min: 40 }, [], { syncStatus: 'pending' });
  await sync.flushPendingActivities();
  ok('RPC erhält client_record_id + metrics', rpcCalls.length === 1 && 'p_client_record_id' in rpcCalls[0].args && 'p_metrics' in rpcCalls[0].args);

  // activity_identity_conflict → bleibt pending, NICHT synced
  reset();
  S.upsertActivityFromWorkout({ id: 'wconf', sport_key: 'gym', status: 'completed', duration_min: 50 }, [], { syncStatus: 'pending' });
  let rc = await sync.flushPendingActivities();
  ok('Konflikt: failed≥1, pushed 0', rc.pushed === 0 && rc.failed === 1 && rc.conflicts === 1);
  ok('Konflikt: bleibt pending (nicht synced)', S.pendingActivities().length === 1 && S.pendingActivities()[0].syncStatus === 'pending');

  // Manuelle Activity → upsertManual, markSynced
  reset();
  S.upsertManualActivity({ sportId: 'padel', source: 'manual', sourceRecordId: 'manual:2026-06-27:padel', durationSeconds: 4800, summary: { rpe: 7 }, metrics: { sessionKind: 'match' } });
  let rm = await sync.flushPendingActivities();
  ok('manuelle Activity: upsertManual aufgerufen', upsertCalls.length === 1 && upsertCalls[0].table === 'activities');
  ok('manuelle Activity: gepusht + synced', rm.pushed === 1 && S.pendingActivities().length === 0);

  // Single-Flight: zweiter Aufruf während laufendem Flush → busy, kein paralleler Durchlauf
  reset();
  S.upsertActivityFromWorkout({ id: 'w8', sport_key: 'gym', status: 'completed', duration_min: 30 }, [], { syncStatus: 'pending' });
  let p1 = sync.flushPendingActivities();
  let p2 = sync.flushPendingActivities();   // synchron vor erstem await → sieht _flushing=true
  let [res1, res2] = await Promise.all([p1, p2]);
  ok('Single-Flight: zweiter Aufruf busy (kein paralleler Flush)', res2.busy === true);

  // legacy_local wird NIE gepusht
  reset();
  S.upsertManualActivity({ sportId: 'running', source: 'legacy_local', sourceRecordId: 'legacy:2026-01-01:running', durationSeconds: 1800 });
  let rleg = await sync.flushPendingActivities();
  ok('legacy_local nicht gepusht (skipped)', rleg.pushed === 0 && rleg.skipped === 1);

  // ---- Delete-Outbox ----
  // Workout-Tombstone → repo.deleteWorkout (RPC), danach entfernt
  reset(); deleteCalls = [];
  let dw = S.upsertActivityFromWorkout({ id: 'wDel', sport_key: 'gym', status: 'completed', duration_min: 60 }, [], { syncStatus: 'pending' });
  S.markSynced(dw.activity.clientRecordId, 'srv-wDel');
  S.deleteActivity('srv-wDel');
  ok('vor Flush: 1 pendingDelete (workout)', S.pendingDeletes().length === 1);
  let rd = await sync.flushPendingActivities();
  ok('Workout-Delete via RPC orvia_delete_workout', rpcCalls.some(c => c.name === 'orvia_delete_workout' && c.args.p_session_id === 'wDel'));
  ok('Workout-Tombstone nach Erfolg entfernt', rd.deleted === 1 && S.pendingDeletes().length === 0);
  // Manuelle synchronisierte Activity → repo.deleteActivity (Tabellen-Delete)
  reset(); deleteCalls = [];
  let dm = S.upsertManualActivity({ sportId: 'padel', source: 'manual', sourceRecordId: 'manual:x:padel', durationSeconds: 4800 });
  S.markSynced(dm.activity.clientRecordId, 'srv-dm');
  S.deleteActivity('srv-dm');
  let rdm = await sync.flushPendingActivities();
  ok('manuelle Server-Activity: Tabellen-Delete aufgerufen', deleteCalls.some(c => c.table === 'activities'));
  ok('manueller Delete-Tombstone entfernt', rdm.deleted === 1 && S.pendingDeletes().length === 0);
  // Offline: Delete bleibt pending
  reset(); deleteCalls = [];
  let do1 = S.upsertActivityFromWorkout({ id: 'wOff', sport_key: 'gym', status: 'completed', duration_min: 30 }, [], { syncStatus: 'pending' });
  S.markSynced(do1.activity.clientRecordId, 'srv-wOff'); S.deleteActivity('srv-wOff');
  globalThis.navigator.onLine = false;
  let rdo = await sync.flushPendingActivities();
  ok('offline: Delete bleibt pending', rdo.error === 'offline' && S.pendingDeletes().length === 1);
  globalThis.navigator.onLine = true;
})();

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
