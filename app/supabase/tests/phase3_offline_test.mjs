/* ORVIA · Phase 3 — Offline-Queue für Readiness (Unit-Tests).
   readiness_components (FK auf Score-id) + Baselines (Tabellendaten) werden offline bewusst
   verschoben; nur der Score wird gequeued. Kein Scheinerfolg. node supabase/tests/phase3_offline_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/repos/checkinRepository.js');
load('js/repos/readinessRepository.js');
load('js/readiness-source.js');
load('js/readiness-store.js');
const O = global.window.ORVIA;
const shape = r => r && typeof r.success === 'boolean' && ['supabase', 'indexeddb', 'legacy_blob', 'empty'].includes(r.source) && ['synced', 'pending', 'conflict', 'failed'].includes(r.sync_status);
const headline = { score: 95, parts: [['HRV', 88, 20]] };

const run = async () => {
  O.user = { id: 'A' }; O.baselineState = { status: 'building', perMetric: {} };

  // 1) Score offline → Queue, pending, user_id aus Auth, Komponenten/Baselines deferred
  navigator.onLine = false; let ENQ = null;
  O.offlineQueue = { enqueue: async (t, row, ck) => { ENQ = { t, row, ck }; return { success: true, data: row, error: null, source: 'indexeddb', sync_status: 'pending' }; } };
  let r = await O.readinessStore.persistForDay('2026-06-19', headline, { hrvMs: 46 }, {});
  ok('Score offline → pending, indexeddb', shape(r) && r.success && r.source === 'indexeddb' && r.sync_status === 'pending');
  ok('Queue: Tabelle readiness_scores + Konflikt-Key', ENQ.t === 'readiness_scores' && ENQ.ck === 'user_id,local_date,engine_version');
  ok('user_id aus Auth (A), confidence aus Baseline-Status', ENQ.row.user_id === 'A' && ENQ.row.confidence === 'medium' && ENQ.row.score === 95);
  ok('Komponenten + Baselines offline deferred (kein Scheinerfolg)', r.data.componentsDeferred === true && r.data.baselinesDeferred === true);

  // 2) fremde user_id im Payload spielt keine Rolle — Store setzt user_id aus Auth
  ENQ = null; await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('fremde user_id ignoriert (immer Auth-uid)', ENQ.row.user_id === 'A');

  // 3) Queue fehlt → success false, kein Scheinerfolg
  O.offlineQueue = undefined; r = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('Queue fehlt → success false, indexeddb', shape(r) && !r.success && r.source === 'indexeddb');

  // 4) Queue wirft → success false, failed
  O.offlineQueue = { enqueue: () => { throw new Error('idb'); } }; r = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('Queue wirft → success false, failed', shape(r) && !r.success && r.sync_status === 'failed');

  // 5) Queue meldet success:false → durchgereicht, kein ✓
  O.offlineQueue = { enqueue: async () => ({ success: false, error: { message: 'voll' }, source: 'indexeddb', sync_status: 'failed' }) };
  r = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('Queue success:false → kein Scheinerfolg', shape(r) && !r.success);

  // 6) Auth fehlt → success false (vor Queue)
  O.user = null; r = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('Auth fehlt → success false, empty', shape(r) && !r.success && r.source === 'empty');

  // 7) Online → NICHT die Queue (saveScore-Pfad)
  O.user = { id: 'A' }; navigator.onLine = true; ENQ = null;
  O.offlineQueue = { enqueue: async (t, row) => { ENQ = { t, row }; return { success: true }; } };
  O.repos.checkin = { listRange: async () => ({ success: true, data: [] }) };
  O.sb = (function () { const o = {}; ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'delete', 'not'].forEach(m => o[m] = () => o); o.upsert = () => o; o.then = (res) => Promise.resolve({ data: [{ id: 's1' }], error: null }).then(res); return { from: () => o }; })();
  r = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('Online → Score über saveScore, NICHT über Queue', r.success && ENQ === null);

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
