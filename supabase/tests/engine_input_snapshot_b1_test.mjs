/* ============================================================
   ORVIA · Batch 1 — EngineInputSnapshot (Vertrags-/Verhaltenstests)
   Kanonische, versionierte Input-Pipeline (Trainingsengine-Prompt §5):
   buildSnapshot (PURE, deterministisch, nicht-mutierend, nichts erfinden),
   Provenienz/Einheiten/Missingness, Snapshot-Adapter für Readiness- und
   Decision-Engine v2, unveränderter collect()-Alt-Vertrag.
   node supabase/tests/engine_input_snapshot_b1_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);
const TODAY = '2026-07-18';

function makeSb(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Intl = Intl; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.ORVIA = {};
  /* Punkt 10 (Batch 3a.1): Testuhr VOLLSTÄNDIG injiziert — todayStr() ohne
     Argument fiel vorher auf die ECHTE Systemuhr zurück; der Test war damit
     tagesabhängig (grün am Fixture-Tag 2026-07-18, rot ab 2026-07-19).
     Produktionscode bleibt unverändert; nur die Sandbox-Uhr ist fixiert. */
  const fixedDay = opts.fixedDay || TODAY;
  sb.todayStr = (d) => { const x = d || new Date(fixedDay + 'T12:00:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  if (opts.DB) sb.DB = opts.DB;
  if (opts.recoveryCtx) sb.recoveryCtx = opts.recoveryCtx;
  if (opts.Calc) sb.Calc = opts.Calc;
  if (opts.PROFILE) sb.PROFILE = opts.PROFILE;
  if (opts.stash) sb._metricsResolved = opts.stash;
  vm.createContext(sb);
  const files = ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js', 'checkin-field-resolver.js', 'engine/training-input-resolver.js'];
  files.forEach(f => vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}

/* ---------- A) buildSnapshot: pur, deterministisch, ehrlich ---------- */
{
  const sb = makeSb({});
  const R = sb.ORVIA.trainingInputResolver;
  const raw = {
    now: 1789000000000, timezone: 'Europe/Vienna', today: TODAY,
    morning: { sleepMin: 432, sleepQ: 7, feel: 8, doms: 2, stress: 'Low', ill: false, redFlags: {} },
    autoMap: { rhr: { value: 49, metricId: 'resting_hr', metricDate: TODAY, measuredAt: '2026-07-18T06:01:00Z', source: 'garmin' } },
    ctx: { rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 },
    sleepGoalHours: 8,
    sports: [{ sportId: 'running', role: 'primary' }],
    goals: [{ id: 'g1', category: 'half_marathon', priority: 1 }],
    constraints: [{ id: 'c1', bodyRegion: 'knee', intensity: 3, status: 'active' }],
    availability: { availableToday: true, availableDayIdx: [0, 1, 3, 5], targetDays: 4, source: 'availability' },
    plannedSession: { sport: 'running', intensity: 'easy', label: 'DL locker' },
    recentLoad: { acute7: 900, chronic28PerWeek: 800, dataDays: 14, hardYesterday: false, hardStreak: 0 },
    goalDaysToEvent: 50,
    collectErrors: []
  };
  const s1 = R.buildSnapshot(raw);
  const s2 = R.buildSnapshot(raw);
  ok('A1 deterministisch: gleicher raw ⇒ identischer Snapshot', JSON.stringify(s1) === JSON.stringify(s2));
  ok('A2 schemaVersion/now/timezone/today explizit', s1.schemaVersion === 1 && s1.now === 1789000000000 && s1.timezone === 'Europe/Vienna' && s1.today === TODAY);
  // Nicht-Mutation: Eingaben bleiben unverändert, Snapshot-Sektionen sind Kopien.
  s1.constraints[0].intensity = 9; s1.goals[0].priority = 4; s1.availability.availableToday = false;
  ok('A3 nicht-mutierend: raw bleibt unangetastet (Kopien im Snapshot)',
    raw.constraints[0].intensity === 3 && raw.goals[0].priority === 1 && raw.availability.availableToday === true);
  ok('A4 Provenienz: Check-in vs. Metric Store inkl. Metrikzeitpunkt',
    s2.provenance.sleepMin.source === 'checkin' && s2.provenance.rhr.source === 'metric_store' &&
    s2.provenance.rhr.metricDate === TODAY && s2.provenance.rhr.measuredAt === '2026-07-18T06:01:00Z');
  ok('A5 Einheiten je Feld explizit (min/bpm/ms)', s2.currentMetrics.units.sleepMin === 'min' && s2.provenance.rhr.unit === 'bpm');
  ok('A6 Belastungsquelle ehrlich benannt (legacy_sessions, Batch-2-Grenze)', s2.loadHistory.source === 'legacy_sessions' && s2.loadHistory.acute7 === 900);
  ok('A7 Zukunftssektionen null + not_supported (kein Raten)',
    s2.activities === null && s2.capacity === null &&
    s2.dataQuality.missing.some(x => x.path === 'activities' && x.kind === 'not_supported'));
  const kinds = s2.dataQuality.missing.map(x => x.kind);
  ok('A8 alle Missingness-Arten aus dem kanonischen Katalog', kinds.every(k => R.MISSING_KINDS.indexOf(k) >= 0), JSON.stringify([...new Set(kinds)]));
}
{
  // Leerer raw: nichts erfinden.
  const sb = makeSb({});
  const R = sb.ORVIA.trainingInputResolver;
  const s = R.buildSnapshot({});
  const v = s.currentMetrics.values;
  ok('A9 leerer raw ⇒ alle Werte null, keine Defaults (kein 420/7/2)',
    v.sleepMin === null && v.rhr === null && v.feel === null && v.soreness === null && s.athlete.sleepGoalHours === null);
  ok('A10 Missingness fachlich: morning not_captured + Baselines module_missing',
    s.dataQuality.missing.some(x => x.path === 'checkin.morning' && x.kind === 'not_captured') &&
    s.dataQuality.missing.some(x => x.path === 'recovery.baselines' && x.kind === 'module_missing'));
  ok('A11 constraints immer Array, Sektionen ohne Daten ehrlich null', Array.isArray(s.constraints) && s.constraints.length === 0 && s.goals === null && s.sports === null && s.availability === null);
  const sStale = R.buildSnapshot({ autoMap: null, autoMapStale: true });
  ok('A12 alter Stash ⇒ Missingness-Art stale', sStale.dataQuality.missing.some(x => x.path === 'metrics.store_stash' && x.kind === 'stale'));
}

/* ---------- B) Snapshot-Adapter: exakte v2-Verträge ---------- */
{
  const sb = makeSb({});
  const R = sb.ORVIA.trainingInputResolver;
  const morning = { sleepMin: 432, sleepQ: 7, feel: 8, doms: 2, stress: 'Low', ill: false };
  const autoMap = { rhr: { value: 49, metricId: 'resting_hr', metricDate: TODAY, source: 'garmin' } };
  const ctx = { rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 };
  const snap = R.buildSnapshot({ now: 1, today: TODAY, morning, autoMap, ctx, sleepGoalHours: 8 });
  const viaSnap = R.readinessInputFromSnapshot(snap);
  const direct = R.buildReadinessInput({ morning, autoMap, ctx, sleepGoalHours: 8 });
  ok('B1 readinessInputFromSnapshot ≡ buildReadinessInput (Vertragsgleichheit)', JSON.stringify(viaSnap) === JSON.stringify(direct), JSON.stringify(viaSnap));
  const r = sb.ORVIA.readinessEngineV2.evaluate(viaSnap);
  ok('B2 Readiness-Engine akzeptiert Snapshot-Input (Score gerechnet)', r.score != null && sb.ORVIA.engineContracts.isReadinessResult(r));
  const snap2 = R.buildSnapshot({ now: 1, today: TODAY, morning: { ill: true, redFlags: { chestPain: true } }, ctx,
    availability: { availableToday: false, availableDayIdx: [1], targetDays: 1, source: 'availability' },
    recentLoad: { acute7: 100, chronic28PerWeek: 90, dataDays: 10, hardYesterday: false, hardStreak: 0 } });
  const di = R.decisionInputFromSnapshot(snap2, r);
  ok('B3 decisionInputFromSnapshot: safetyFlags/illness/availability aus Snapshot',
    di.safetyFlags.chestPain === true && di.illness === true && di.availabilityToday === false && di.recentLoad.acute7 === 100);
  const dec = sb.ORVIA.decisionEngineV2.evaluate(di);
  ok('B4 Kette Snapshot→Decision: Red Flag ⇒ RED/REST + v2-Vertrag erfüllt',
    dec.dayState === 'RED' && dec.action === 'REST' && sb.ORVIA.engineContracts.isDecisionResult(dec));
}

/* ---------- C) collect()-Alt-Vertrag bleibt (Snapshot intern) ---------- */
{
  const DB = {}; DB[TODAY] = { morning: { sleepMin: 420, sleepQ: 7, feel: 8, doms: 3, stress: 'Low', rhr: 50, hrvMs: 58, bb: 66, illness: true } };
  const sb = makeSb({ DB, recoveryCtx: () => ({ rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 }),
    Calc: { sessionLoad: () => 0 }, PROFILE: { constraintsList: [{ id: 'c1', bodyRegion: 'knee', intensity: 4, status: 'active' }] } });
  const R = sb.ORVIA.trainingInputResolver;
  const input = R.collect();
  ok('C1 collect(): Alt-Vertrag unverändert (readiness/safetyFlags/illness/constraints)',
    typeof input.safetyFlags === 'object' && !Array.isArray(input.safetyFlags) && input.readiness.score != null &&
    input.illness === true && input.constraints.length === 1 && Array.isArray(input._shadowMissing));
  ok('C2 collect() trägt Snapshot-Version (_snapshotVersion=1)', input._snapshotVersion === 1);
  ok('C3 _shadowMissing-Strings kompatibel (metric_store_stash ohne Stash)', input._shadowMissing.indexOf('metric_store_stash') >= 0 && input._shadowMissing.indexOf('morning_checkin') < 0);
  const snap = R.collectSnapshot();
  ok('C4 collectSnapshot: now/timezone/today gesetzt', typeof snap.now === 'number' && snap.today === sb.todayStr() && snap.schemaVersion === 1);
  // Ohne Check-in UND ohne Stash: ehrliche Missingness, kein Crash.
  const sb2 = makeSb({ DB: {}, Calc: { sessionLoad: () => 0 } });
  const i2 = sb2.ORVIA.trainingInputResolver.collect();
  ok('C5 ohne Daten: morning_checkin + metric_store_stash gemeldet, nichts erfunden',
    i2._shadowMissing.indexOf('morning_checkin') >= 0 && i2._shadowMissing.indexOf('metric_store_stash') >= 0 && i2.readiness.score === null);
  /* C6 · Gegenprobe SIMULIERTER FOLGETAG: identisches Verhalten mit fixierter
     Uhr auf 2026-07-19 — der Test ist damit an jedem Kalendertag stabil. */
  const NEXT = '2026-07-19';
  const DB3 = {}; DB3[NEXT] = { morning: { sleepMin: 420, sleepQ: 7, feel: 8, doms: 3, stress: 'Low', rhr: 50, hrvMs: 58, bb: 66, illness: true } };
  const sb3 = makeSb({ fixedDay: NEXT, DB: DB3, recoveryCtx: () => ({ rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 }),
    Calc: { sessionLoad: () => 0 }, PROFILE: { constraintsList: [{ id: 'c1', bodyRegion: 'knee', intensity: 4, status: 'active' }] } });
  const i3 = sb3.ORVIA.trainingInputResolver.collect();
  ok('C6 Folgetag-Gegenprobe (fixierte Uhr 2026-07-19): gleicher Vertrag, gleiche Missingness',
    i3.illness === true && i3.readiness.score != null && i3.constraints.length === 1 &&
    i3._shadowMissing.indexOf('metric_store_stash') >= 0 && i3._shadowMissing.indexOf('morning_checkin') < 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
