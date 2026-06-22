/* ORVIA · Phase 4.2 F2 — Planerfüllung (geplant vs. absolviert), mehrstufig statt binär.
   node supabase/tests/plan_fulfillment_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const Calc = globalThis.Calc;
const k = (p, d, o) => Calc.planStatus(p, d, o).key;

ok('alles geplant + gemacht → erfuellt', k(['Laufen'], ['Laufen']) === 'erfuellt');
ok('mehrere geplant, alle gemacht → erfuellt', k(['Laufen', 'Gym'], ['Gym', 'Laufen']) === 'erfuellt');
ok('teils gemacht → teilweise', k(['Laufen', 'Gym'], ['Laufen']) === 'teilweise');
ok('anderes gemacht → alternativ', k(['Laufen'], ['Rad']) === 'alternativ');
ok('geplant, nichts gemacht, vergangen → ausgefallen', k(['Laufen'], [], { isPast: true }) === 'ausgefallen');
ok('geplant, nichts gemacht, heute → offen', k(['Laufen'], [], { isPast: false }) === 'offen');
ok('nicht geplant, aber gemacht → ungeplant', k([], ['Rad']) === 'ungeplant');
ok('nichts geplant, nichts gemacht → keins', k([], []) === 'keins');
ok('robust gegen null-Eingaben', k(null, null) === 'keins');
ok('Label vorhanden für erfuellt', Calc.planStatus(['Gym'], ['Gym']).label === 'Plan erfüllt');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
