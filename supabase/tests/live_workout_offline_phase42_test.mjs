/* ORVIA · Phase 4.2a — Offline-Workout (Unit-Tests).
   node supabase/tests/live_workout_offline_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const _ls = {}; global.localStorage = { getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); }, removeItem: k => { delete _ls[k]; } };
global.todayStr = () => '2026-06-19';
global.getDecision = () => ({ _r: { score: 88 }, dayState: 'GREEN', todayAction: 'perform', readinessReasons: [] });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js'); load('js/training-domain.js'); load('js/workout-store.js');
const O = global.window.ORVIA, WS = O.workoutStore;
const shape = r => r && typeof r.success === 'boolean' && ['supabase', 'indexeddb', 'legacy_blob', 'empty'].includes(r.source) && ['synced', 'pending', 'conflict', 'failed'].includes(r.sync_status);

let ENQ = [];
O.repos = { workout: { getActiveSession: async () => ({ success: true, data: null, source: 'empty', sync_status: 'synced', error: null }) } };

const run = async () => {
  O.user = { id: 'A' };
  O.offlineQueue = { enqueue: async (table, row, opts) => { opts = (typeof opts === 'string') ? { onConflict: opts } : (opts || {}); ENQ.push({ table, row, conflict: opts.onConflict, opts }); return { success: true, data: row, error: null, source: 'indexeddb', sync_status: 'pending' }; } };

  // Offline starten
  navigator.onLine = false;
  let r = await WS.startFreeWorkout({ sport: 'Gym' });
  ok('Offline-Start → pending, in Queue', shape(r) && r.success && r.sync_status === 'pending' && ENQ[0].table === 'workout_sessions' && ENQ[0].conflict === 'user_id,client_session_id');
  ok('Session-Row user-scoped (user_id=A)', ENQ[0].row.user_id === 'A' && ENQ[0].row.status === 'active');
  ok('Session: started_at gesetzt (nicht null)', ENQ[0].row.started_at != null);
  ok('Session-Queue: clientId für Kind-Auflösung', !!ENQ[0].opts.clientId && /^workout:/.test(ENQ[0].opts.clientId));

  // Offline Übung + Satz
  r = await WS.addExercise('ex1', { plannedSets: 3 });
  ok('Offline addExercise → Queue (Konflikt-Key client_exercise_id)', r.success && ENQ[1].table === 'workout_exercises' && ENQ[1].conflict === 'user_id,client_exercise_id' && ENQ[1].row.user_id === 'A');
  ok('Übung: parent_client_session_id + fkField (FK-sicher)', ENQ[1].opts.parentClientId === ENQ[0].opts.clientId && ENQ[1].opts.fkField === 'workout_session_id');
  r = await WS.addSet(0, { setType: 'working', weight: 100, reps: 8, completed: true });
  ok('Offline addSet → Queue (Konflikt-Key client_set_id)', r.success && ENQ[2].table === 'workout_sets' && ENQ[2].conflict === 'user_id,client_set_id' && ENQ[2].row.user_id === 'A');
  ok('Satz: parent_client_exercise_id + fkField (FK-sicher)', ENQ[2].opts.parentClientId === ENQ[1].opts.clientId && ENQ[2].opts.fkField === 'workout_exercise_id');
  ok('Parent-Reihenfolge: Session vor Exercise vor Set', ENQ[0].table === 'workout_sessions' && ENQ[1].table === 'workout_exercises' && ENQ[2].table === 'workout_sets');
  ok('Stabile Client-IDs (kein Dubletten-Risiko)', /^set:/.test(ENQ[2].row.client_set_id) && /^we:/.test(ENQ[1].row.client_exercise_id));

  // Satz lokal sichtbar trotz Offline (kein Datenverlust)
  ok('Satz lokal im State (kein Verlust)', WS.state().exercises[0].sets.length === 1 && WS.state().exercises[0].sets[0].weight === 100);

  // Offline-Delete → echte Delete-Operation in der Queue (nicht nur lokal entfernt)
  r = await WS.deleteSet(0, 0);
  ok('Offline deleteSet → Delete-Op in Queue (user-scoped, client_set_id)', r.success && r.sync_status === 'pending' && ENQ[3].table === 'workout_sets' && ENQ[3].opts.operation === 'delete' && ENQ[3].opts.clientField === 'client_set_id' && !!ENQ[3].opts.clientId);
  ok('Offline-Delete: lokal sofort weg', WS.state().exercises[0].sets.length === 0);

  // Queue fehlt → kein Scheinerfolg
  O.offlineQueue = undefined;
  r = await WS.addSet(0, { setType: 'working', weight: 100, reps: 6, completed: true });
  ok('Queue fehlt → success false (kein Scheinerfolg)', shape(r) && !r.success && r.source === 'indexeddb');

  // Lokale aktive Kopie vorhanden (Reload-Restore möglich)
  ok('Lokale aktive Kopie gespeichert', localStorage.getItem('orvia_active_workout_A') != null);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
