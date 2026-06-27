/* ORVIA · Phase 4.2 — Offline-Queue-Flush (Unit-Tests, In-Memory-IndexedDB + Fake-Supabase).
   Prüft: Parent-FK-Auflösung über Client-IDs (keine Null-FK), Reihenfolge, Delete-Ops idempotent,
   Teilfehler bleibt in Queue, Konto-Isolation (A-Queue nie bei B geflusht).
   node supabase/tests/live_workout_flush_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = { addEventListener: () => {} };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

// ---- Minimaler In-Memory-IndexedDB-Shim (deckt genau die Nutzung von offline-queue.js) ----
function fakeIDB() {
  const stores = { queue: { recs: new Map(), seq: 0, indexes: { user_id: 'user_id', status: 'sync_status' } } };
  function tx(name) {
    const st = stores[name];
    const t = { oncomplete: null, onerror: null };
    const store = {
      add: (obj) => { const id = ++st.seq; obj.id = id; st.recs.set(id, obj); },
      put: (obj) => { st.recs.set(obj.id, obj); },
      get: (id) => { const rq = {}; queueMicrotask(() => { rq.result = st.recs.get(id); rq.onsuccess && rq.onsuccess(); }); return rq; },
      delete: (id) => { st.recs.delete(id); },
      index: (field) => ({
        openCursor: (range) => {
          const rq = {};
          const list = [...st.recs.values()].filter(v => v[field] === range.value);
          let i = 0;
          function step() { queueMicrotask(() => { if (i < list.length) { const v = list[i++]; rq.result = { value: v, continue: step, delete: () => st.recs.delete(v.id) }; rq.onsuccess && rq.onsuccess(); } else { rq.result = null; rq.onsuccess && rq.onsuccess(); } }); }
          step(); return rq;
        }
      })
    };
    t.objectStore = () => store;
    queueMicrotask(() => { t.oncomplete && t.oncomplete(); });
    return t;
  }
  return {
    open: () => { const rq = {}; queueMicrotask(() => { const db = { objectStoreNames: { contains: () => true }, transaction: (n) => tx(n), createObjectStore: () => ({ createIndex: () => {} }) }; rq.result = db; rq.onsuccess && rq.onsuccess(); }); return rq; }
  };
}
global.indexedDB = fakeIDB();
global.IDBKeyRange = { only: (v) => ({ value: v }) };

// ---- Fake-Supabase (dedupe per Conflict-Key, Server-IDs, select/delete) ----
function makeSb(db) {
  return {
    from(table) {
      const t = db[table] = db[table] || { rows: [], seq: 0 };
      const q = { table, op: null, row: null, conflict: null, filters: [] };
      const api = {
        upsert(row, opts) { q.op = 'upsert'; q.row = row; q.conflict = opts && opts.onConflict; return api; },
        delete() { q.op = 'delete'; return api; },
        select() { if (!q.op) q.op = 'select'; return api; },
        eq(f, v) { q.filters.push([f, v]); return api; },
        limit() { return api; },
        then(res, rej) { return Promise.resolve().then(() => exec(t, q)).then(res, rej); }
      };
      return api;
    }
  };
}
function exec(t, q) {
  if (q.op === 'upsert') {
    const cols = (q.conflict || '').split(',').map(s => s.trim()).filter(Boolean);
    let row = null;
    if (cols.length) row = t.rows.find(r => cols.every(c => r[c] === q.row[c]));
    if (row) Object.assign(row, q.row); else { row = Object.assign({ id: 'srv_' + t.table + '_' + (++t.seq) }, q.row); t.rows.push(row); }
    return { data: [row], error: null };
  }
  if (q.op === 'select') { const m = t.rows.filter(r => q.filters.every(f => r[f[0]] === f[1])); return { data: m, error: null }; }
  if (q.op === 'delete') { const keep = t.rows.filter(r => !q.filters.every(f => r[f[0]] === f[1])); const removed = t.rows.length - keep.length; t.rows = keep; return { data: null, error: null, removed: removed }; }
  return { data: null, error: null };
}

const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/offline-queue.js');
const O = global.window.ORVIA, Q = O.offlineQueue;

const run = async () => {
  const DB = {};
  O.sb = makeSb(DB);

  // --- A: Offline Session→Exercise→Set enqueuen (Kinder ohne Server-FK) ---
  O.user = { id: 'A' };
  await Q.enqueue('workout_sets', { client_set_id: 'set:1', workout_exercise_id: null, weight: 100 }, { operation: 'upsert', onConflict: 'user_id,client_set_id', clientId: 'set:1', parentClientId: 'we:1', fkField: 'workout_exercise_id' });
  await Q.enqueue('workout_exercises', { client_exercise_id: 'we:1', workout_session_id: null, order_index: 0 }, { operation: 'upsert', onConflict: 'user_id,client_exercise_id', clientId: 'we:1', parentClientId: 'wk:1', fkField: 'workout_session_id' });
  await Q.enqueue('workout_sessions', { client_session_id: 'wk:1', status: 'active', local_date: '2026-06-19' }, { operation: 'upsert', onConflict: 'user_id,client_session_id', clientId: 'wk:1' });

  const res = await Q.flush();
  ok('flush: alle 3 Upserts synchronisiert', res.flushed === 3 && res.failed === 0, JSON.stringify(res));
  const sess = DB.workout_sessions.rows[0], exe = DB.workout_exercises.rows[0], set = DB.workout_sets.rows[0];
  ok('Session auf Server vorhanden', !!sess && sess.user_id === 'A');
  ok('Exercise-FK aufgelöst (kein Null)', exe && exe.workout_session_id === sess.id);
  ok('Set-FK aufgelöst (kein Null)', set && set.workout_exercise_id === exe.id);

  // Queue danach leer (synced → entfernt)
  let pend = await Q.pendingForCurrentUser();
  ok('Queue nach Flush leer', pend.length === 0);

  // --- Idempotenz: erneuter Flush erzeugt keine Dubletten ---
  await Q.enqueue('workout_sets', { client_set_id: 'set:1', workout_exercise_id: null, weight: 105 }, { operation: 'upsert', onConflict: 'user_id,client_set_id', clientId: 'set:1', parentClientId: 'we:1', fkField: 'workout_exercise_id' });
  await Q.flush();
  ok('Idempotent: Set bleibt EINE Zeile (Upsert über client_set_id)', DB.workout_sets.rows.length === 1 && DB.workout_sets.rows[0].weight === 105);

  // --- Delete-Op: offline gelöschter Satz wird serverseitig entfernt, idempotent ---
  await Q.enqueue('workout_sets', {}, { operation: 'delete', clientId: 'set:1', clientField: 'client_set_id' });
  const rDel = await Q.flush();
  ok('Delete-Op: Satz serverseitig entfernt', DB.workout_sets.rows.length === 0 && rDel.failed === 0);
  // erneuter Delete (Zeile existiert nicht mehr) → idempotenter Erfolg
  await Q.enqueue('workout_sets', {}, { operation: 'delete', clientId: 'set:1', clientField: 'client_set_id' });
  const rDel2 = await Q.flush();
  ok('Delete idempotent (nicht vorhanden → Erfolg, raus aus Queue)', rDel2.failed === 0 && (await Q.pendingForCurrentUser()).length === 0);

  // --- Teilfehler: Kind ohne auflösbaren Parent bleibt in Queue (kein Null-FK) ---
  await Q.enqueue('workout_sets', { client_set_id: 'set:x', workout_exercise_id: null }, { operation: 'upsert', onConflict: 'user_id,client_set_id', clientId: 'set:x', parentClientId: 'we:GHOST', fkField: 'workout_exercise_id' });
  const rOrphan = await Q.flush();
  ok('Parent unauflösbar → failed, bleibt in Queue (kein Null-FK)', rOrphan.failed === 1 && (await Q.pendingForCurrentUser()).length === 1);
  ok('Kein Set mit Null-FK auf Server', !DB.workout_sets.rows.some(r => r.workout_exercise_id == null));

  // --- Konto-Isolation: B flusht NICHT die Queue von A ---
  O.user = { id: 'B' };
  const rB = await Q.flush();
  ok('B-Flush verarbeitet A-Queue NICHT', rB.flushed === 0 && rB.failed === 0 && rB.total === 0);
  // A sieht ihren verbliebenen Eintrag weiterhin
  O.user = { id: 'A' };
  ok('A-Queue-Eintrag weiterhin user-scoped vorhanden', (await Q.pendingForCurrentUser()).length === 1);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
