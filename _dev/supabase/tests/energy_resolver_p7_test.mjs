/* ============================================================
   ORVIA · Phase 7 — energy-expenditure-resolver + Kalorien-Integration
   Verträge:
   - BMR: Katch-McArdle nur bei plausiblem Körperfett (3–60 %), sonst Mifflin
     (identisch zu Calc.bmr); ohne Körperdaten null (P2: keine Fantasiewerte).
   - Provider-Modus: total > active+resting > active+BMR; NIE zusätzlich
     Schritte/Training addieren (Double-Counting-Matrix).
   - ORVIA-Modus: BMR + Schrittenergie (0,0004 kcal/Schritt/kg) + Training
     + 10 % TEF; ohne Schritte NEAT-Pauschale 15 % BMR (estimated).
   - Adaptive Korrektur: erst ab ≥8 Gewichten über ≥14 Tage; ±250-Kappung;
     Dämpfung 50 %; TDEE nie unter BMR.
   - nutritionTargets: p.tdee ersetzt Faktor+Burn-Addition (Audit-Befund 4);
     Fallback-Pfad addiert NEAT-Faktor + burn (dokumentiert), Default 'light'.
   node supabase/tests/energy_resolver_p7_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);

function makeSb() {
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
  sb.Number = Number; sb.isFinite = isFinite; sb.isNaN = isNaN; sb.JSON = JSON;
  sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('metrics/energy-expenditure-resolver.js', base), 'utf8'), sb, { filename: 'energy-expenditure-resolver.js' });
  return sb.ORVIA.energyResolver;
}
const ER = makeSb();
const BODY = { weightKg: 75, heightCm: 180, age: 22, sex: 'm' };

/* ---------- 1) BMR ---------- */
{
  const m = ER.bmrOf(BODY);
  ok('B1 Mifflin ohne Körperfett (75/180/22/m ⇒ 1770)', m.value === 1770 && m.method === 'mifflin', JSON.stringify(m));
  const k = ER.bmrOf(Object.assign({}, BODY, { bodyFatPct: 12 }));
  ok('B2 Katch-McArdle bei validem KFA (12 % ⇒ LBM 66 ⇒ 1796)', k.value === 1796 && k.method === 'katch_mcardle', JSON.stringify(k));
  ok('B3 KFA außerhalb 3–60 ⇒ Mifflin', ER.bmrOf(Object.assign({}, BODY, { bodyFatPct: 75 })).method === 'mifflin');
  ok('B4 ohne Gewicht ⇒ null (keine Fantasiewerte)', ER.bmrOf({ heightCm: 180 }).value === null);
}

/* ---------- 2) Provider-Modus + Double-Counting-Matrix ---------- */
{
  const total = ER.computeDay(Object.assign({}, BODY, { totalKcalProvider: 2900, activeKcal: 900, restingKcal: 1900, steps: 12000, trainingKcal: 600 }));
  ok('P1 total gewinnt, Schritte/Training werden NICHT addiert', total.mode === 'provider' && total.provider.source === 'total' && total.tdee === 2900, JSON.stringify({ tdee: total.tdee }));
  const ar = ER.computeDay(Object.assign({}, BODY, { activeKcal: 900, restingKcal: 1900, steps: 12000, trainingKcal: 600 }));
  ok('P2 active+resting als Fallback (2800), weiterhin keine Addition', ar.provider.source === 'active_plus_resting' && ar.tdee === 2800);
  const ao = ER.computeDay(Object.assign({}, BODY, { activeKcal: 900 }));
  ok('P3 nur active ⇒ BMR + active (partial)', ao.provider.source === 'active_plus_bmr' && ao.tdee === 1770 + 900);
  ok('P4 ORVIA-Modus wird PARALLEL mitberechnet (Vergleichswert vorhanden)', total.orvia && total.orvia.tdee > 0);
}

/* ---------- 3) ORVIA-Modus ---------- */
{
  const o = ER.computeDay(Object.assign({}, BODY, { steps: 10000, trainingKcal: 500 }));
  // 1770 + (10000×75×0,0004=300) + 500 = 2570; TEF 257; ⇒ 2827
  ok('O1 BMR+Schritte+Training+TEF (⇒ 2701)', o.mode === 'orvia' && o.orvia.stepKcal === 300 && o.orvia.tefKcal === 257 && o.tdee === 2827, JSON.stringify(o.orvia));
  const noSteps = ER.computeDay(Object.assign({}, BODY, { trainingKcal: 0 }));
  ok('O2 ohne Schritte: NEAT-Pauschale 15 % BMR, als Schätzung markiert', noSteps.orvia.stepsEstimated === true && noSteps.orvia.stepKcal === Math.round(1770 * 0.15));
  ok('O3 ohne Körperdaten ⇒ null (ehrlicher Leerzustand)', ER.computeDay({ steps: 10000 }) === null);
}

/* ---------- 4) Adaptive Korrektur ---------- */
{
  const series = (n, slopePerDay) => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 5, 15 + i)).toISOString().slice(0, 10), kg: 75 + slopePerDay * i }));
  ok('A1 Trend berechnet (+0,9 kg/28 d bei +0,032/Tag)', Math.abs(ER.weightTrendKgPer28d(series(28, 0.032)) - 0.9) < 0.05);
  ok('A2 <8 Punkte ⇒ null', ER.weightTrendKgPer28d(series(5, 0.03)) === null);
  ok('A3 <14 Tage Spannweite ⇒ null', ER.weightTrendKgPer28d(series(10, 0.03)) === null);
  const up = ER.computeDay(Object.assign({}, BODY, { steps: 10000, trainingKcal: 500, weightSeries: series(28, 0.032) }));
  // adj = −(0,9×7700)/28×0,5 ≈ −124
  ok('A4 steigendes Gewicht ⇒ TDEE nach unten korrigiert (≈−124)', up.adaptive.adjKcal <= -110 && up.adaptive.adjKcal >= -140 && up.tdee === 2827 + up.adaptive.adjKcal, JSON.stringify(up.adaptive));
  const crash = ER.computeDay(Object.assign({}, BODY, { steps: 0, trainingKcal: 0, weightSeries: series(28, -0.2) }));
  ok('A5 Kappung ±250 greift, TDEE nie unter BMR', crash.adaptive.adjKcal === 250 && crash.tdee >= crash.bmr);
}

/* ---------- 5) nutritionTargets-Integration (echtes Calc) ---------- */
{
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.Number = Number;
  sb.isFinite = isFinite; sb.isNaN = isNaN; sb.JSON = JSON; sb.console = { log() {}, warn() {}, error() {} };
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('calc.js', base), 'utf8'), sb, { filename: 'calc.js' });
  const NT = sb.Calc.nutritionTargets;
  const p = Object.assign({}, BODY, { goal: 'maintain', activity: 'light', trainingBurn: 500, dayType: 'easy' });
  const withT = NT(Object.assign({}, p, { tdee: 2701 }));
  ok('N1 p.tdee ⇒ maint == TDEE (KEINE zusätzliche Addition)', withT.maint === 2701 && withT.kcal === 2701 && withT.base === 2701 - 500, JSON.stringify({ maint: withT.maint, base: withT.base }));
  const noT = NT(p);
  ok('N2 Fallback: NEAT-Faktor light (1,35) + burn — Struktur unverändert', noT.maint === Math.round(1770 * 1.35) + 500 && noT.base === Math.round(1770 * 1.35));
  ok('N3 Fallback rechnet NICHT mehr mit implizitem Trainings-Faktor als Default',
    (() => { const src = readFileSync(new URL('nutrition.js', base), 'utf8'); return /activity:\s*n\.activity\s*\|\|\s*'light'/.test(src); })());
  ok('N4 Defizit-Logik bleibt (fatloss −400, hart max −200)', NT(Object.assign({}, p, { tdee: 2701, goal: 'fatloss' })).kcal === 2301 && NT(Object.assign({}, p, { tdee: 2701, goal: 'fatloss', dayType: 'long' })).kcal === 2501);
}

/* ---------- 6) nutrition.js-Integration (echtes Modul) ---------- */
{
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.Number = Number;
  sb.isFinite = isFinite; sb.isNaN = isNaN; sb.JSON = JSON; sb.console = { log() {}, warn() {}, error() {} };
  sb.todayStr = () => '2026-07-18';
  sb.dkey = off => { const d = new Date('2026-07-18T12:00:00Z'); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
  sb.PROFILE = { weightKg: 75, heightCm: 180, age: 22, nutrition: {}, performance: { body: { bodyFat: { value: 12 } } } };
  sb.DB = { '2026-07-18': { sessions: { Laufen: { dist: 8, dur: 40 } } } };
  const saved = [];
  sb.ORVIA = { repos: { energy: { saveDay: (d, p) => { saved.push([d, p]); return Promise.resolve({ success: true }); } } } };
  sb.Calc = null;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('metrics/energy-expenditure-resolver.js', base), 'utf8'), sb, { filename: 'er.js' });
  vm.runInContext(readFileSync(new URL('calc.js', base), 'utf8'), sb, { filename: 'calc.js' });
  vm.runInContext(readFileSync(new URL('nutrition.js', base), 'utf8'), sb, { filename: 'nutrition.js' });
  // Heutige Provider-Metriken im Cache (wie von _ciAutoLoad gestasht).
  sb._metricsResolved = { date: '2026-07-18', resolved: {
    total_kcal_provider: { value: 2950, source: 'automatic', stale: false, metricDate: '2026-07-18' },
    steps: { value: 12000, source: 'automatic', stale: false, metricDate: '2026-07-18' }
  } };
  const t = sb.nutToday();
  ok('I1 nutToday nutzt Provider-TDEE (maint 2950, kein Faktor+Burn-Stack)', t && t.maint === 2950, JSON.stringify(t && { maint: t.maint, kcal: t.kcal }));
  ok('I2 Tagesergebnis wird in daily_energy_expenditure gesichert (mode provider)', saved.length === 1 && saved[0][0] === '2026-07-18' && saved[0][1].mode === 'provider' && saved[0][1].tdee_chosen === 2950);
  const before = saved.length; sb.nutToday();
  ok('I3 Persistenz gedrosselt (unverändertes Ergebnis ⇒ kein zweiter Upsert)', saved.length === before);
  // Gestrige Metriken zählen nicht (TDEE nur aus Tageswerten).
  sb._metricsResolved = { date: '2026-07-18', resolved: { total_kcal_provider: { value: 2950, source: 'automatic', stale: false, metricDate: '2026-07-17' } } };
  sb._nutEnergySaved = null;
  const t2 = sb.nutToday();
  ok('I4 gestrige Provider-Werte ⇒ ORVIA-Modus statt veraltetem total', t2 && t2.maint !== 2950 && t2.maint > 0);
  // P2-Verträge: ohne Körperdaten weiter null.
  sb.PROFILE = { nutrition: {} };
  ok('I5 ohne Körperdaten weiterhin ehrlicher Leerzustand (null)', sb.nutToday() === null);
}

/* ---------- 7) Verdrahtung ---------- */
{
  const idx = readFileSync(new URL('../index.html', base), 'utf8');
  ok('W1 Resolver + energyRepository in index.html', idx.includes('js/metrics/energy-expenditure-resolver.js') && idx.includes('js/repos/energyRepository.js'));
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  ok('W2 beide in sw-ASSETS', sw.includes("'./js/metrics/energy-expenditure-resolver.js'") && sw.includes("'./js/repos/energyRepository.js'"));
  const v = (sw.match(/orvia-v8-(\d+)/) || [])[1];
  ok('W3 SW-Version ≥ v8-192', Number(v) >= 192, 'v8-' + v);
  const mig = readFileSync(new URL('../../_dev/supabase/migrations/0022_daily_energy_expenditure.sql', base), 'utf8');
  ok('W4 Migration 0022 mit RLS-Policies + unique(user_id, local_date)', /daily_energy_expenditure/.test(mig) && /enable row level security/.test(mig) && /unique \(user_id, local_date\)/.test(mig));
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  /* Kalibrierung: der Stash traegt seit GM7 zusaetzlich days/entries und laeuft seit GM7.5f
   ueber den zentralen Setter gmStashResolved (schuetzt breiteren Tagescache). */
ok('W5 _ciAutoLoad stasht die Resolver-Map für nutrition.js', /gmStashResolved\(\{date:t,days:3,resolved:r\.data\.resolved/.test(ui));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
