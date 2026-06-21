/* ORVIA · Phase 3 — Hydrierung + Accountwechsel (Unit-Tests).
   node supabase/tests/phase3_hydration_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/readiness-source.js');
load('js/readiness-store.js');
const O = global.window.ORVIA;

// Konfigurierbares readiness-Repo (statt echtem Supabase).
function setRepo(scores, baselines) {
  O.repos = O.repos || {};
  O.repos.readiness = {
    listScores: async () => ({ success: true, data: scores, error: null, source: 'supabase', sync_status: 'synced' }),
    getBaselines: async () => ({ success: true, data: baselines, error: null, source: 'supabase', sync_status: 'synced' })
  };
}

const run = async () => {
  // Nutzer A: Scores + Baselines (alle 3 Kernmetriken ≥14 → active)
  O.user = { id: 'A' };
  setRepo(
    [{ local_date: '2026-06-18', score: 88, confidence: 'high' }, { local_date: '2026-06-19', score: 92, confidence: 'high' }],
    [{ metric: 'hrv_ln', valid_days: 16, maturity: 'good' }, { metric: 'rhr', valid_days: 20, maturity: 'good' }, { metric: 'sleep_min', valid_days: 18, maturity: 'good' }]
  );
  let r = await O.readinessStore.hydrateRecentScores(60);
  ok('Hydrierung A: 2 Scores geladen', r.success && r.data.scored === 2);
  ok('getScoreFor liefert Tabellenwert (92)', O.readinessStore.getScoreFor('2026-06-19').score === 92);
  ok('Baseline-Status aus Kernmetriken (alle ≥14) → active', O.readinessStore.getBaselineStatus() === 'active');

  // Accountwechsel: Caches leeren (wie sync.clearLocalUserData) → dann B hydrieren
  O.readinessHistory = {}; O.baselineState = { status: 'insufficient', perMetric: {} };
  O.user = { id: 'B' };
  setRepo(
    [{ local_date: '2026-06-19', score: 60, confidence: 'low' }],
    [{ metric: 'hrv_ln', valid_days: 3 }, { metric: 'rhr', valid_days: 4 }, { metric: 'sleep_min', valid_days: 2 }]
  );
  r = await O.readinessStore.hydrateRecentScores(60);
  ok('Nach Wechsel: nur B-Scores (keine A-Daten)', O.readinessStore.getScoreFor('2026-06-18') === null && O.readinessStore.getScoreFor('2026-06-19').score === 60);
  ok('B Baseline-Status insufficient (kein falsches active/high)', O.readinessStore.getBaselineStatus() === 'insufficient');

  // Zurück zu A: korrekte Werte
  O.readinessHistory = {}; O.baselineState = { status: 'insufficient', perMetric: {} };
  O.user = { id: 'A' };
  setRepo(
    [{ local_date: '2026-06-19', score: 92, confidence: 'high' }],
    [{ metric: 'hrv_ln', valid_days: 16 }, { metric: 'rhr', valid_days: 20 }, { metric: 'sleep_min', valid_days: 18 }]
  );
  await O.readinessStore.hydrateRecentScores(60);
  ok('Zurück zu A: Score 92, active', O.readinessStore.getScoreFor('2026-06-19').score === 92 && O.readinessStore.getBaselineStatus() === 'active');

  // Status NICHT aus bloßer Score-Anzahl: viele Scores aber sparse Baselines → nicht active
  setRepo(
    Array.from({ length: 30 }, (_, i) => ({ local_date: '2026-05-' + String(i % 28 + 1).padStart(2, '0'), score: 80 })),
    [{ metric: 'hrv_ln', valid_days: 2 }, { metric: 'rhr', valid_days: 3 }, { metric: 'sleep_min', valid_days: 1 }]
  );
  await O.readinessStore.hydrateRecentScores(60);
  ok('Viele Scores, sparse Kernmetriken → NICHT active (insufficient)', O.readinessStore.getBaselineStatus() === 'insufficient');

  // Offline-Hydrierung → strukturierter Fehler statt Crash
  O.repos.readiness = { listScores: async () => ({ success: false, error: { message: 'offline' }, offline: true, source: 'indexeddb', sync_status: 'pending' }) };
  r = await O.readinessStore.hydrateRecentScores(60);
  ok('Hydrierung offline → success false, pending', !r.success && r.sync_status === 'pending');

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
