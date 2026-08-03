#!/usr/bin/env node
/* GM7 · gm7_contracts_test.mjs — die neu explizierten, noch unproduzierten
   Engine-Verträge (planQuality/forecast/planVariants/dailyTargets/loadCap).
   Sie definieren, WANN das UI die heute ehrlich leeren Bereiche füllen darf. */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'app');
const EC = require(join(APP, 'js', 'engine', 'engine-contracts.js'));

let n = 0, fail = 0;
const ok = (name, cond) => { n++; if (!cond) { fail++; console.error('FAIL:', name); } else console.log('ok:', name); };

/* planQuality */
const pq = { total: 79, ruleVersion: 'pq-1', limitingFactors: ['sportBalance'], subscores: {
  goalCoverage: { value: 86, rating: 'gut' }, recoveryDistribution: { value: 78, rating: 'gut' },
  loadBalance: { value: 72, rating: 'ok' }, timeFeasibility: { value: 90, rating: 'gut' },
  sportBalance: { value: 64, rating: 'ok' }, dataQuality: { value: 82, rating: 'gut' } } };
ok('isPlanQuality akzeptiert vollständiges Objekt', EC.isPlanQuality(pq) === true);
ok('isPlanQuality verwirft fehlenden Subscore', EC.isPlanQuality({ ...pq, subscores: { ...pq.subscores, dataQuality: undefined } }) === false);
ok('isPlanQuality verwirft total>100', EC.isPlanQuality({ ...pq, total: 140 }) === false);
ok('isPlanQuality verwirft null', EC.isPlanQuality(null) === false);

/* forecast */
const fc = { goalId: 'half_marathon', metric: 'finish_time_sec', conservative: 6820, realistic: 6670, optimistic: 6560,
  uncertainty: { plusMinusSec: 80 }, confidence: 'medium', asOf: '2026-07-27' };
ok('isForecast akzeptiert konsistenten Korridor', EC.isForecast(fc) === true);
ok('isForecast verwirft invertierten Korridor', EC.isForecast({ ...fc, optimistic: 9999 }) === false);
ok('isForecast verwirft ohne Unsicherheit', EC.isForecast({ ...fc, uncertainty: null }) === false);

/* planVariants */
const wk = [[], [], [], [], [], [], []];
const pv = { recommendedVariantId: 'B', variants: [
  { id: 'A', name: 'Fokus', timeBudgetHours: 7, loadLevel: 'hoch', coreSessions: 3, restDays: 1, week: wk },
  { id: 'B', name: 'Ausgewogen', timeBudgetHours: 6, loadLevel: 'mittel', coreSessions: 2, restDays: 2, week: wk } ] };
ok('isPlanVariants akzeptiert A/B', EC.isPlanVariants(pv) === true);
ok('isPlanVariants verwirft Woche ≠ 7 Tage', EC.isPlanVariants({ ...pv, variants: [{ ...pv.variants[0], week: [[]] }, pv.variants[1]] }) === false);
ok('isPlanVariants verwirft Einzelvariante', EC.isPlanVariants({ recommendedVariantId: 'A', variants: [pv.variants[0]] }) === false);

/* dailyTargets — 0 ist ein gültiges Ziel, null = kein Ziel */
ok('isDailyTargets akzeptiert 0/null korrekt', EC.isDailyTargets({ steps: 10000, activeKcal: 0, waterMl: null, sleepMin: 480, source: 'provider', updatedAt: '2026-07-27' }) === true);
ok('isDailyTargets verwirft negative Werte', EC.isDailyTargets({ steps: -1, activeKcal: 0, waterMl: null, sleepMin: 480, source: 'x', updatedAt: 'y' }) === false);
ok('isDailyTargets verwirft ohne Quelle', EC.isDailyTargets({ steps: 1, activeKcal: 0, waterMl: null, sleepMin: 480, updatedAt: 'y' }) === false);

/* loadCap */
ok('isLoadCap akzeptiert dynamischen Cap', EC.isLoadCap({ mode: 'dynamic', value: null, unit: 'sRPE' }) === true);
ok('isLoadCap verwirft ohne mode', EC.isLoadCap({ value: 300, unit: 'sRPE' }) === false);

/* bestehende Verträge unverändert nutzbar */
ok('Bestandsvertrag isPlanResult weiterhin exportiert', typeof EC.isPlanResult === 'function');
ok('RULE_VERSION unverändert vorhanden', typeof EC.RULE_VERSION === 'string');

console.log(`\ngm7_contracts_test: ${n - fail}/${n} bestanden`);
process.exit(fail ? 1 : 0);
