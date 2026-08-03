/* ORVIA · GM7.9i — Riegel-Verallgemeinerung in calc.js.
   Belegt, dass die neue Funktion riegel(distKm,durMin,targetKm) rein ADDITIV ist:
   riegelHM verhaelt sich bitgenau wie vorher (es besteht jetzt aus riegel), Randfaelle
   liefern weiterhin null statt NaN/Infinity, und die Formel ist unveraendert
   (Riegel mit Exponent 1.06).
   node supabase/tests/calc_riegel_general_test.mjs */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Calc = require('../../js/calc.js');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Referenzimplementierung = der Stand VOR der Aenderung (fest verdrahtet auf HM). */
const HM = Calc.HM_KM;
const riegelHM_alt = (d, t) => (!(d > 0) || !(t > 0)) ? null : t * Math.pow(HM / d, 1.06);

ok('riegel und riegelHM sind exportiert',
   typeof Calc.riegel === 'function' && typeof Calc.riegelHM === 'function');

/* Aequivalenz ueber ein breites Raster echter Lauf-Wertepaare */
let maxDiff = 0, n = 0, allEqual = true;
for (let d = 1; d <= 42; d += 0.5) {
  for (let t = 4; t <= 300; t += 7) {
    const a = Calc.riegelHM(d, t), b = riegelHM_alt(d, t), c = Calc.riegel(d, t, HM);
    n++;
    if (a !== b || a !== c) { allEqual = false; }
    maxDiff = Math.max(maxDiff, Math.abs(a - b));
  }
}
ok('riegelHM bitgenau unveraendert gegenueber der Vorversion', allEqual && maxDiff === 0,
   n + ' Wertepaare, maximale Abweichung ' + maxDiff);

ok('riegelHM(d,t) === riegel(d,t,HM_KM)',
   Calc.riegelHM(10, 52.5) === Calc.riegel(10, 52.5, HM));

/* Randfaelle: weiterhin null, niemals NaN/Infinity */
const edges = [[0, 50, 5], [10, 0, 5], [10, 50, 0], [-1, 50, 5], [10, -1, 5], [10, 50, -1],
               [null, 50, 5], [10, null, 5], [10, 50, null], [NaN, 50, 5], [10, NaN, 5]];
ok('Randfaelle liefern null (keine Division durch 0, kein NaN/Infinity)',
   edges.every(e => Calc.riegel(e[0], e[1], e[2]) === null));
ok('riegelHM-Randfaelle unveraendert null',
   Calc.riegelHM(0, 50) === null && Calc.riegelHM(10, 0) === null && Calc.riegelHM(-1, 50) === null);

/* Formel-Identitaeten (Riegel, Exponent 1.06) */
ok('Zieldistanz = Eingangsdistanz ⇒ Eingangszeit', Math.abs(Calc.riegel(10, 52.5, 10) - 52.5) < 1e-9);
ok('Exponent ist 1.06', Math.abs(Calc.riegel(10, 50, 20) - 50 * Math.pow(2, 1.06)) < 1e-9);
ok('kuerzere Zieldistanz ⇒ kuerzere Zeit', Calc.riegel(10, 52.5, 5) < 52.5);
ok('laengere Zieldistanz ⇒ laengere Zeit', Calc.riegel(10, 52.5, 21.0975) > 52.5);
ok('streng monoton in der Zieldistanz',
   (() => { let prev = -1, mono = true;
     for (let k = 1; k <= 42; k += 0.5) { const v = Calc.riegel(10, 52.5, k); if (v <= prev) mono = false; prev = v; }
     return mono; })());

/* Keine Mutation / keine Seiteneffekte */
ok('reine Funktion (gleiche Eingabe ⇒ gleiche Ausgabe)',
   Calc.riegel(12.3, 61.7, 21.0975) === Calc.riegel(12.3, 61.7, 21.0975));

console.log('\ncalc_riegel_general: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
