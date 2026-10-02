/* ORVIA · activity-sync + activityRepository — Outbox/RPC-Vertrag (Inkrement 2B, OFFLINE-Stub).
   Verifiziert Kontrakt/Idempotenz mit Supabase-Stub — NICHT live (keine echte DB). */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = globalThis;
globalThis.ORVIA = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const load = f => (0, eval)(fs.readFileSync(new URL(_APPREL + '' + f, import.meta.url), 'utf8'));
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

/* v8-423/424 · Gians Konsole 2.10.: 400-Sturm auf orvia_upsert_activity_from_session */
await (async () => {
  reset(); sync._backoffReset();
  let updateCalls = [];
  const serverMetrics = {};                         // id -> aktueller Serverstand von metrics
  const origFrom = globalThis.ORVIA.sb.from;
  globalThis.ORVIA.sb.from = (table) => Object.assign(origFrom(table), {
    select: () => ({ eq: (k1, v1) => ({ eq: () => ({ limit: () => Promise.resolve(Object.prototype.hasOwnProperty.call(serverMetrics, v1) ? { data: [{ metrics: serverMetrics[v1] }], error: null } : { data: [], error: null }) }) }) }),
    update: (patch) => ({ eq: (k1, v1) => ({ eq: (k2, v2) => ({ select: () => { updateCalls.push({ table, id: v1, patch });
      if (v1 === DEAD) return Promise.resolve({ data: null, error: { message: 'boom' } });
      return Promise.resolve({ data: [Object.assign({ id: v1 }, patch)], error: null }); } }) }) })
  });
  /* der echte RPC gibt die BESTEHENDE Zeile zurueck (gleiche id) — der Basis-Stub erfindet 'srv-<session>' */
  const origRpc = globalThis.ORVIA.sb.rpc;
  globalThis.ORVIA.sb.rpc = (name, args) => origRpc(name, args).then(res => (res && res.data && args.p_session_id === 'sessQ') ? { data: [Object.assign({}, res.data[0], { id: UUID })], error: null } : res);
  const UUID = '0f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c21', DEAD = '2f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c23', G = '1f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c22', CONF = '3f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c24';
  /* A) Workout eines anderen Geraets, Server-crid uebernommen ⇒ der RPC laeuft OHNE Konflikt (Normalfall) */
  S.mergeServerActivities([{ id: UUID, client_record_id: 'act:iphone:q1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessQ', workout_session_id: 'sessQ', started_at: '2026-09-24T05:32:00.000Z', duration_seconds: 720, status: 'completed', summary: {}, metrics: {} }]);
  const lk = S.linkActivityToPlan(UUID, 'po:2026-09-23:psg:2:1:ok', { reason: 'auto_same_week', method: 'auto' });
  ok('A1 Zuordnung lokal pending', lk.ok && S.pendingActivities().length === 1);
  let rA = await sync.flushPendingActivities();
  ok('A2 Workout mit uebernommener Server-crid: RPC mit DIESER crid, kein Konflikt, kein Direkt-Update', rA.pushed === 1 && rpcCalls.length === 1 && rpcCalls[0].args.p_client_record_id === 'act:iphone:q1' && rpcCalls[0].args.p_metrics.plannedSessionId === 'po:2026-09-23:psg:2:1:ok' && updateCalls.length === 0, JSON.stringify(rA));
  ok('A3 danach synced, id bleibt', S.getActivityById(UUID).syncStatus === 'synced' && S.pendingActivities().length === 0);
  /* A') RPC meldet Identitaetskonflikt ⇒ Rueckfall: nur die Zuordnungsfelder in den Serverstand mergen */
  S.mergeServerActivities([{ id: CONF, sport_id: 'gym', source: 'orvia_workout', source_record_id: 'wconf', workout_session_id: 'wconf', started_at: '2026-09-25T05:32:00.000Z', duration_seconds: 900, status: 'completed', summary: { exerciseCount: 4 }, metrics: { exercises: ['a'] } }]);
  serverMetrics[CONF] = { exercises: ['a', 'b'], serverOnly: 1 };
  S.linkActivityToPlan(CONF, 'po:2026-09-26:psg:5:1:ok');
  rpcCalls = []; updateCalls = [];
  let rA2 = await sync.flushPendingActivities();
  const pc = updateCalls[0] && updateCalls[0].patch;
  ok('A4 Konflikt ⇒ Rueckfall auf activities.update(id): Zuordnung gesetzt, Inhalt des aufzeichnenden Geraets unberuehrt, keine Summary', rA2.pushed === 1 && rA2.conflicts === 0 && rpcCalls.length === 1 && updateCalls.length === 1 && updateCalls[0].id === CONF && pc.metrics.plannedSessionId === 'po:2026-09-26:psg:5:1:ok' && JSON.stringify(pc.metrics.exercises) === '["a","b"]' && pc.metrics.serverOnly === 1 && !('summary' in pc) && !('duration_seconds' in pc), JSON.stringify(pc));
  /* B) Garmin: Worker hat die Zeile inzwischen angereichert — das darf der Client NIE loeschen */
  S.mergeServerActivities([{ id: G, sport_id: 'gym', source: 'garmin', source_record_id: 'g-77', started_at: '2026-09-24T05:42:00.000Z', duration_seconds: 3360, status: 'completed', summary: { avgHr: 110 }, metrics: { training_load: 30 } }]);
  serverMetrics[G] = { training_load: 31, streams: { heart_rate: [100, 110] }, route: [[1, 2], [3, 4]], detailsFetchedAt: '2026-09-24T07:00:00Z' };
  S.linkActivityToPlan(G, 'po:2026-09-22:psg:1:1:ok');
  rpcCalls = []; updateCalls = [];
  let rB = await sync.flushPendingActivities();
  const pg = updateCalls[0] && updateCalls[0].patch;
  ok('B1 Garmin-Zuordnung wird synchronisiert — ohne RPC, ueber die Server-id', rB.pushed === 1 && rB.skipped === 0 && rpcCalls.length === 0 && updateCalls.length === 1 && updateCalls[0].id === G);
  ok('B2 metrics wird GEMERGED: Messreihen/Route/detailsFetchedAt des Workers bleiben, Serverwert gewinnt (training_load 31), nur Zuordnungsfelder kommen dazu', pg && pg.metrics.streams && pg.metrics.streams.heart_rate.length === 2 && pg.metrics.route.length === 2 && pg.metrics.detailsFetchedAt === '2026-09-24T07:00:00Z' && pg.metrics.training_load === 31 && pg.metrics.plannedSessionId === 'po:2026-09-22:psg:1:1:ok' && pg.metrics.planLinkCorrection.toOccurrenceId === 'po:2026-09-22:psg:1:1:ok', JSON.stringify(pg && Object.keys(pg.metrics)));
  ok('B3 duration_seconds wird OHNE manuelle Korrektur nicht geschrieben', pg && !('duration_seconds' in pg));
  /* B') Loesen: lokal entfernter Schluessel wird auch am Server entfernt */
  serverMetrics[G] = pg.metrics;
  S.unlinkActivityFromPlan(G, 'po:2026-09-22:psg:1:1:ok');
  updateCalls = [];
  await sync.flushPendingActivities();
  const pu = updateCalls[0] && updateCalls[0].patch;
  ok('B4 „Zuordnung loesen" entfernt plannedSessionId am Server, Korrektur protokolliert (user_unlinked), Messreihen bleiben', pu && !('plannedSessionId' in pu.metrics) && pu.metrics.planLinkCorrection.reason === 'user_unlinked' && pu.metrics.streams.heart_rate.length === 2);
  /* B'') Zeile am Server nicht (mehr) vorhanden ⇒ not_found, kein blinder Schreibversuch */
  const rNF = await repo.updateFields('9f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c29', { metrics: { plannedSessionId: 'x' } }, { metricsMerge: { ownedKeys: ['plannedSessionId'] } });
  ok('B5 unbekannte Zeile ⇒ not_found (kein Update abgesetzt)', rNF.success === false && rNF.error.code === 'not_found');
  /* C) dauerhaft abgelehnter Datensatz: Rueckzug — kein zweiter Versuch im selben Fenster */
  S.mergeServerActivities([{ id: DEAD, sport_id: 'gym', source: 'garmin', source_record_id: 'g-dead', started_at: '2026-09-25T05:32:00.000Z', duration_seconds: 600, status: 'completed', summary: {}, metrics: {} }]);
  serverMetrics[DEAD] = {};
  S.linkActivityToPlan(DEAD, 'po:2026-09-21:psg:0:1:ok');
  rpcCalls = []; updateCalls = [];
  let rC1 = await sync.flushPendingActivities();
  let rC2 = await sync.flushPendingActivities();
  let rC3 = await sync.flushPendingActivities();
  ok('C1 Fehlschlag wird NICHT sofort wiederholt (1 Versuch, danach deferred)', rC1.failed === 1 && rC2.failed === 0 && rC2.deferred === 1 && rC3.deferred === 1 && updateCalls.length === 1, JSON.stringify([rC1, rC2, rC3]));
  ok('C2 Datensatz bleibt pending (keine Datenverluste), remaining 1', rC3.remaining === 1);
  /* D) Nachlauf-Schleife: ein waehrend des Flushes angeforderter Flush laeuft genau EINMAL nach */
  sync._backoffReset(); updateCalls = [];
  const p1 = sync.flushPendingActivities();
  const p2 = sync.flushPendingActivities();
  const [d1, d2] = await Promise.all([p1, p2]);
  await new Promise(r => setTimeout(r, 30));
  ok('D1 kein Endlos-Flush: hoechstens 2 Versuche am abgelehnten Datensatz', d2.busy === true && updateCalls.length <= 2, 'update=' + updateCalls.length);
  ok('D2 Quelle: Nachlauf ruft flushPendingActivities genau einmal, keine .then-Doppelung', !/flushPendingActivities\(\)\.then \? flushPendingActivities\(\)/.test(fs.readFileSync(new URL(_APPREL + 'js/activity-sync.js', import.meta.url), 'utf8')));
  globalThis.ORVIA.sb.from = origFrom; globalThis.ORVIA.sb.rpc = origRpc;
})();

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
