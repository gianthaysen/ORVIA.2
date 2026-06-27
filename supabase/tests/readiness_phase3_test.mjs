/* ORVIA · Phase 3 — Readiness-Persistenz + Baselines (Unit-Tests, gestubbtes Supabase).
   node supabase/tests/readiness_phase3_test.mjs */
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

let CAP = {};
function sbStub(scoreRow) {
  const obj = {};
  ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'delete', 'insert', 'update', 'not'].forEach(m => obj[m] = () => obj);
  obj.upsert = (row, opts) => { CAP[CAP._t] = { row: row, opts: opts }; return obj; };
  obj.maybeSingle = () => Promise.resolve({ data: null, error: null });
  obj.then = (res, rej) => Promise.resolve({ data: [scoreRow || { id: 's1' }], error: null }).then(res, rej);
  return { from: (t) => { CAP._t = t; return obj; } };
}
const shape = r => r && typeof r.success === 'boolean' && ('data' in r) && ('error' in r);

const run = async () => {
  // ---- buildBaselines: Metriken + robuste Statistik ----
  const cks = [];
  for (let i = 0; i < 20; i++) cks.push({ resting_hr: 55, hrv_ms: 45, sleep_minutes: 480, sleep_quality: 8, body_battery: 80, feel: 8, leg_strength: 7, doms: 1 });
  const b = O.readinessSource.buildBaselines(cks, 8);
  const metrics = b.persisted.map(x => x.metric);
  ok('Baselines: 8 Metriken (rhr,hrv_ln,sleep_min,sleep_q,bb,feel,legs,doms)',
    ['rhr', 'hrv_ln', 'sleep_min', 'sleep_q', 'body_battery', 'feel', 'leg_strength', 'doms'].every(m => metrics.includes(m)));
  const rhrB = b.persisted.find(x => x.metric === 'rhr');
  ok('rhr-Baseline: Median 55, validDays 20', rhrB.median === 55 && rhrB.validDays === 20);

  // Robust gegen Ausreißer (Median statt Mittelwert)
  const out = []; for (let i = 0; i < 6; i++) out.push({ resting_hr: 55 }); out.push({ resting_hr: 200 });
  const bo = O.readinessSource.buildBaselines(out, 8).persisted.find(x => x.metric === 'rhr');
  ok('Ausreißer robust: Median 55 (nicht Mittelwert ~75)', bo.median === 55);

  // Zu wenig Daten → keine rhr-Baseline (null), maturity none
  const few = [{ resting_hr: 55 }, { resting_hr: 56 }];
  const bf = O.readinessSource.buildBaselines(few, 8).persisted.find(x => x.metric === 'rhr');
  ok('1–6 Tage → keine rhr-Baseline (null), maturity none', bf.median === null && bf.maturity === 'none');

  // statusFromValidDays-Policy
  ok('Status: <7 insufficient', O.readinessSource.statusFromValidDays(5) === 'insufficient');
  ok('Status: 7–13 building', O.readinessSource.statusFromValidDays(10) === 'building');
  ok('Status: ≥14 active', O.readinessSource.statusFromValidDays(20) === 'active');

  // Determinismus
  ok('buildBaselines deterministisch', JSON.stringify(O.readinessSource.buildBaselines(cks, 8)) === JSON.stringify(O.readinessSource.buildBaselines(cks, 8)));

  // ---- readinessRepository.saveScore: Upsert-Konflikt + Komponenten ----
  O.user = { id: 'A' }; O.sb = sbStub({ id: 's1' }); navigator.onLine = true; CAP = {};
  const headline = { score: 95, parts: [['HRV', 88, 20], ['Befinden', 90, 18], ['Ruhepuls', 76, 15]] };
  const comps = O.readinessStore.buildComponents(headline.parts, { hrvMs: 46, feel: 9, rhr: 62 }, { rhrBase: 58, hrvBase7: Math.log(43) });
  const sres = await O.repos.readiness.saveScore('2026-06-19', { score: 95, confidence: 'high', engine: 'v2' }, comps);
  ok('saveScore Erfolg, Konflikt-Key user_id,local_date,engine_version', shape(sres) && sres.success && CAP['readiness_scores'] && CAP['readiness_scores'].opts && CAP['readiness_scores'].opts.onConflict === 'user_id,local_date,engine_version');

  // Komponenten angereichert (raw/baseline-Reason)
  const rc = comps.find(c => c.name === 'Ruhepuls');
  ok('Komponente Ruhepuls: raw=62, reason mit Baseline', rc.raw === 62 && /Baseline 58/.test(rc.reason || ''));
  const hc = comps.find(c => c.name === 'HRV');
  // Contribution = norm·weight/ΣW (verifiziert: weight roh, Score=Σ(norm·weight)/ΣW). W=20+18+15=53.
  ok('Komponente HRV: contribution = norm·weight/ΣW (≤100, NICHT 1760)', hc.norm === 88 && hc.weight === 20 && hc.contribution === Math.round(88 * 20 / 53 * 10) / 10 && hc.contribution <= 100);
  const sumC = comps.reduce((s, c) => s + c.contribution, 0);
  const expScore = (88 * 20 + 90 * 18 + 76 * 15) / 53;
  ok('Σ Contributions ≈ Score (plausibel)', Math.abs(sumC - expScore) < 0.6, 'Σ=' + sumC.toFixed(1) + ' score≈' + expScore.toFixed(1));
  ok('Contribution deterministisch', JSON.stringify(O.readinessStore.buildComponents(headline.parts, {}, {})) === JSON.stringify(O.readinessStore.buildComponents(headline.parts, {}, {})));

  // ---- readiness-store.persistForDay: speichert HEADLINE-Score (kein Cap), Confidence aus Baseline ----
  // Stub: genügend Morgen-Check-ins → status active → confidence high.
  O.repos.checkin = { listRange: async () => ({ success: true, data: (() => { const a = []; for (let i = 0; i < 20; i++) a.push({ local_date: '2026-06-0' + (i % 9 + 1), checkin_type: 'morning', resting_hr: 55, hrv_ms: 45, sleep_minutes: 480 }); return a; })() }) };
  CAP = {}; O.sb = sbStub({ id: 's2' });
  const pr = await O.readinessStore.persistForDay('2026-06-19', headline, { hrvMs: 46, feel: 9, rhr: 62, doms: 0 }, { rhrBase: 58, hrvBase7: Math.log(43) });
  ok('persistForDay Erfolg', shape(pr) && pr.success);
  ok('Gespeicherter Score = HEADLINE 95 (kein Load-Cap)', pr.data && pr.data.score === 95);
  ok('Confidence aus Baseline-Status (active→high)', pr.data && pr.data.confidence === 'high' && pr.data.baselineStatus === 'active');

  // Auth fehlt → strukturierter Fehler, kein falsches success
  O.user = null; const pf = await O.readinessStore.persistForDay('2026-06-19', headline, {}, {});
  ok('persistForDay ohne Sitzung → success false', shape(pf) && !pf.success && pf.source === 'empty');

  // Trennung: derselbe Headline-Score wird gespeichert, unabhängig von Last/Decision
  O.user = { id: 'A' };
  const pr2 = await O.readinessStore.persistForDay('2026-06-19', { score: 95, parts: [] }, {}, {});
  ok('Trennung: Score bleibt 95 (Last/Decision fließen nicht ein)', pr2.success && pr2.data.score === 95);

  // ---- HRV-Baseline: MIN_POINTS=7, ≤0/null ignoriert ----
  const hrvN = (n) => O.readinessSource.buildBaselines(Array.from({ length: n }, () => ({ hrv_ms: 45 })), 8).persisted.find(x => x.metric === 'hrv_ln');
  ok('HRV 4 Werte → keine Baseline (median null)', hrvN(4).median === null);
  ok('HRV 6 Werte → keine Baseline', hrvN(6).median === null);
  ok('HRV 7 Werte → Baseline vorhanden', hrvN(7).median != null);
  const hrvBad = O.readinessSource.buildBaselines(Array.from({ length: 7 }, () => ({ hrv_ms: 45 })).concat([{ hrv_ms: 0 }, { hrv_ms: null }, { hrv_ms: NaN }]), 8).perMetric.hrv_ln;
  ok('HRV ≤0/null/NaN ignoriert (validDays=7)', hrvBad === 7);
  // Robust gegen HRV-Ausreißer (Log-Median)
  const hrvOut = O.readinessSource.buildBaselines(Array.from({ length: 6 }, () => ({ hrv_ms: 45 })).concat([{ hrv_ms: 500 }]), 8).persisted.find(x => x.metric === 'hrv_ln');
  ok('HRV-Ausreißer robust (Log-Median ~ln45)', Math.abs(hrvOut.median - Math.log(45)) < 0.01);

  // ---- Gesamt-Status aus Kernmetriken (nicht checkins.length / nicht max) ----
  const S = O.readinessSource.statusFromBaselines;
  ok('Status 1: viele Check-ins, Metriken sparse → insufficient', S({ hrv_ln: 2, rhr: 2, sleep_min: 2 }) === 'insufficient');
  ok('Status 2: nur Ruhepuls 14 → nicht active (insufficient)', S({ rhr: 14, hrv_ln: 0, sleep_min: 0 }) === 'insufficient');
  ok('Status 3: HRV+RHR+Schlaf ≥14 → active', S({ hrv_ln: 14, rhr: 14, sleep_min: 14 }) === 'active');
  ok('Status 4: alle 3 Kernmetriken ≥7 → building', S({ hrv_ln: 8, rhr: 8, sleep_min: 8 }) === 'building');
  ok('Status 5: 4 valide Tage → insufficient', S({ hrv_ln: 4, rhr: 4, sleep_min: 4 }) === 'insufficient');
  ok('Status: fehlende HRV trotz RHR+Schlaf 14 → NICHT active (building)', S({ hrv_ln: 2, rhr: 14, sleep_min: 14 }) === 'building');

  // ---- Fenster aus forDate (nicht Systemdatum) ----
  ok('windowStart(2026-06-20,35) = 2026-05-16', O.readinessSource.windowStart('2026-06-20', 35) === '2026-05-16');
  ok('historisch windowStart(2026-05-01,35) relativ zu Mai (2026-03-27)', O.readinessSource.windowStart('2026-05-01', 35) === '2026-03-27');
  ok('Jahreswechsel windowStart(2026-01-10,35) = 2025-12-06', O.readinessSource.windowStart('2026-01-10', 35) === '2025-12-06');
  ok('windowStart ungültiges Datum → null', O.readinessSource.windowStart('bad', 35) === null);
  const badRb = await O.readinessSource.refreshBaselines('2026-13-99');
  ok('refreshBaselines ungültiges forDate → success false, bad_date', badRb.success === false && badRb.error && badRb.error.code === 'bad_date');

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
