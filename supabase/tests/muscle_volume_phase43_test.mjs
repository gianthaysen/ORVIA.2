/* ORVIA · Phase 4.3 — Muskelvolumen: Aggregation, Wochen-Normalisierung, differenzierter Status.
   node supabase/tests/muscle_volume_phase43_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const C = globalThis.Calc;

const agg = C.aggregateMuscleVolume([{ muscle_key: 'chest', weight: 1, sets: 4 }, { muscle_key: 'triceps', weight: 0.5, sets: 4 }, { muscle_key: 'chest', weight: 1, sets: 3 }]);
ok('chest = 7', agg.chest === 7);
ok('triceps (indirekt 0.5) = 2', agg.triceps === 2);
ok('Dezimalgewicht', C.aggregateMuscleVolume([{ muscle_key: 'lats', weight: 0.3, sets: 10 }]).lats === 3);
ok('negative Sätze ignoriert', C.aggregateMuscleVolume([{ muscle_key: 'lats', weight: 1, sets: -5 }]).lats === undefined);
ok('ungültiges weight → 0-fach', C.aggregateMuscleVolume([{ muscle_key: 'abs', weight: NaN, sets: 4 }]).abs === 0);
ok('leer/undefiniert robust', Object.keys(C.aggregateMuscleVolume()).length === 0);

ok('30 Sätze in 30 Tagen → 7/Woche', C.muscleWeeklyEquivalent(30, 30) === 7);
ok('14 Sätze in 14 Tagen → 7/Woche', C.muscleWeeklyEquivalent(14, 14) === 7);
ok('days<=0 → 0 (kein Inf)', C.muscleWeeklyEquivalent(10, 0) === 0);

ok('0/null → no_data', C.muscleVolumeStatus(0).key === 'no_data' && C.muscleVolumeStatus(null).key === 'no_data');
ok('not_prioritized', C.muscleVolumeStatus(15, { priority: 'not_prioritized' }).key === 'not_prioritized');
ok('kein vergleichbarer Vorzeitraum → insufficient', C.muscleVolumeStatus(12, { historyConfidence: 'insufficient' }).key === 'insufficient');
ok('vergleichbarer Vorzeitraum → normale Einordnung', C.muscleVolumeStatus(15, { historyConfidence: 'comparable_period' }).key === 'in_target');
ok('8/Wo → below_target', C.muscleVolumeStatus(8).key === 'below_target');
ok('15/Wo → in_target', C.muscleVolumeStatus(15).key === 'in_target');
ok('30/Wo OHNE Baseline → above_target (NICHT overloaded)', C.muscleVolumeStatus(30).key === 'above_target');
ok('großer Sprung ggü. Baseline → large_increase', C.muscleVolumeStatus(20, { baselineWeekly: 8 }).key === 'large_increase');
ok('weak_point: höherer Zielbereich (13 < low)', C.muscleVolumeStatus(13, { priority: 'weak_point' }).key === 'below_target');
ok('maintain: niedrigerer Zielbereich (10 im Ziel)', C.muscleVolumeStatus(10, { priority: 'maintain' }).key === 'in_target');
ok('Farben getrennt: below=low, above=high', C.muscleVolumeStatus(8).color === 'low' && C.muscleVolumeStatus(30).color === 'high');
ok('über Ziel + Beschwerden → Warnung (warn)', C.muscleVolumeStatus(30, { hasComplaint: true }).color === 'warn' && C.muscleVolumeStatus(30, { hasComplaint: true }).key === 'above_target');
ok('im Ziel + Beschwerden bleibt grün (keine Pseudo-Warnung)', C.muscleVolumeStatus(15, { hasComplaint: true }).color === 'good');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
