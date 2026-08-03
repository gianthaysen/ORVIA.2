#!/usr/bin/env node
/* GM7 · format_utils_test.mjs — reine Helfer (Datum/relative Zeit/Zustandsmodell).
   Enthält die Regressionstests für den „2953 Wo"-Fehler (new Date(null) → 1970)
   und für die Täuschungsklasse „— gilt als echter Wert". */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'app');
const src = readFileSync(join(APP, 'js', 'format-utils.js'), 'utf8');
const g = {}; new Function('window', 'globalThis', src)(g, g);
const F = g.ORVIA.fmt;

let n = 0, fail = 0;
function ok(name, cond) { n++; if (!cond) { fail++; console.error('FAIL:', name); } else console.log('ok:', name); }

/* --- isValidDateInput: null/undefined/''/0 sind KEINE Daten (keine Epoche 1970) --- */
ok('isValidDateInput(null) === false', F.isValidDateInput(null) === false);
ok('isValidDateInput(undefined) === false', F.isValidDateInput(undefined) === false);
ok("isValidDateInput('') === false", F.isValidDateInput('') === false);
ok('isValidDateInput(0) === false — Zahl wird nicht als Epoche interpretiert', F.isValidDateInput(0) === false);
ok("isValidDateInput('kaputt') === false", F.isValidDateInput('kaputt') === false);
ok("isValidDateInput('2026-09-06') === true", F.isValidDateInput('2026-09-06') === true);
ok("isValidDateInput('2026-01-01') Vergangenheit ok", F.isValidDateInput('2026-01-01') === true);

/* --- phaseWeeksLabel: exakt der 2953-Fall --- */
ok("Phase from=null → 'offen' (nicht 2953 Wo)", F.phaseWeeksLabel({ n: 'Aufbau', from: null, to: '2026-08-02' }) === 'offen');
ok('Phase 21 Tage → 3 Wo', F.phaseWeeksLabel({ from: '2026-08-03', to: '2026-08-23' }) === '3 Wo');
ok('Phase 1 Tag → 1 Wo (Wettkampf)', F.phaseWeeksLabel({ from: '2026-09-06', to: '2026-09-06' }) === '1 Wo');
ok("Phase ungültiges to → '—'", F.phaseWeeksLabel({ from: '2026-08-03', to: 'nope' }) === '—');
ok("Phase >400 Tage → '—' (Plausibilitätskappe)", F.phaseWeeksLabel({ from: '2020-01-01', to: '2026-08-02' }) === '—');
ok("Phase null → '—'", F.phaseWeeksLabel(null) === '—');
const wLabel = F.phaseWeeksLabel({ from: null, to: '2026-08-02' });
ok('Regressionswache: Label enthält NIE eine 4-stellige Wochenzahl', !/\d{4}\s*Wo/.test(wLabel));

/* --- weeksToGoal: dynamisch, alle Zustände --- */
ok('Ziel in 41 Tagen → 6 Wochen/future', JSON.stringify(F.weeksToGoal('2026-09-06', '2026-07-27')) === JSON.stringify({ state: 'future', weeks: 6, days: 41 }));
ok('Ziel heute → today/0', F.weeksToGoal('2026-07-27', '2026-07-27').state === 'today');
ok('Ziel überschritten → past', F.weeksToGoal('2026-07-01', '2026-07-27').state === 'past');
ok('Ziel fehlt → invalid', F.weeksToGoal(null, '2026-07-27').state === 'invalid');
ok('Ziel ungültig → invalid', F.weeksToGoal('xx', '2026-07-27').state === 'invalid');

/* --- fmtRelTime: echte Zeitstempel, injizierbares now --- */
const NOW = Date.parse('2026-07-27T19:00:00+02:00');
ok("vor 6 Min", F.fmtRelTime(NOW - 6 * 60000, NOW) === 'vor 6 Min');
ok("gerade eben (<90s)", F.fmtRelTime(NOW - 30000, NOW) === 'gerade eben');
ok("vor 3 Std", F.fmtRelTime(NOW - 3 * 3600000, NOW) === 'vor 3 Std');
ok("vor 5 Tagen", F.fmtRelTime(NOW - 5 * 86400000, NOW) === 'vor 5 Tagen');
ok('leichter Clock-Skew (Zukunft ≤2min) → gerade eben', F.fmtRelTime(NOW + 60000, NOW) === 'gerade eben');
ok('echte Zukunft → null (nichts erfinden)', F.fmtRelTime(NOW + 3600000, NOW) === null);
ok('fehlender Zeitstempel → null', F.fmtRelTime(null, NOW) === null);
ok('ungültiger Zeitstempel → null', F.fmtRelTime('nope', NOW) === null);
ok('ISO-String wird akzeptiert', F.fmtRelTime('2026-07-27T18:54:00+02:00', NOW) === 'vor 6 Min');

/* --- field(): Zustandsmodell — 0 ist ein Wert, '—' nur für klare NA-Zustände --- */
const f0 = F.field({ status: 'ready', value: 0, unit: ' km' });
ok('0 km ist ein echter Wert (status ready, display "0 km")', f0.status === 'ready' && f0.displayValue === '0 km' && f0.value === 0);
const fna = F.field({ status: 'unavailable', reason: 'kein Vertrag' });
ok("unavailable → '—' + reason", fna.displayValue === '—' && fna.reason === 'kein Vertrag');
const ferr = F.field({ status: 'error', reason: 'Quelle fehlgeschlagen' });
ok("error ist NICHT unavailable", ferr.status === 'error' && ferr.displayValue === '—' && ferr.reason === 'Quelle fehlgeschlagen');
const fld = F.field({ status: 'loading' });
ok("loading sieht nicht wie ein fertiger Nullwert aus ('…')", fld.displayValue === '…');
const fauto = F.field({ value: 12.5, unit: ' km' });
ok('Wert ohne Status → ready', fauto.status === 'ready' && fauto.displayValue === '12,5 km'.replace(',', '.') || fauto.displayValue === '12.5 km');
/* Täuschungs-Regression: ready-Feld darf nie als '—' erscheinen */
ok("REGRESSION: status ready ⇒ display ≠ '—'", F.field({ status: 'ready', value: 12.5, unit: ' km' }).displayValue !== '—');
ok("REGRESSION: '—' ist nie gleichwertig mit einem ready-Wert",
  F.field({ status: 'ready', value: 12.5, unit: ' km' }).displayValue !== F.field({ status: 'unavailable' }).displayValue);

/* --- mondayKey: deutsche Wochenlogik (Montag) --- */
ok('Mo 2026-07-27 → selbe Woche', F.mondayKey('2026-07-27') === '2026-07-27');
ok('So 2026-07-26 → Montag 2026-07-20', F.mondayKey('2026-07-26') === '2026-07-20');
ok('ungültig → null', F.mondayKey('x') === null);

console.log(`\nformat_utils_test: ${n - fail}/${n} bestanden`);
process.exit(fail ? 1 : 0);
