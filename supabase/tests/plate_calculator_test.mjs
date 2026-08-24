/* ============================================================
   ORVIA · plate_calculator — B-07
   ------------------------------------------------------------
   Prueft die Rundungslogik des Scheibenrechners (DoD B-07). Schwerpunkte:
   exakte Ladungen, konservatives Abrunden (nie ueber Ziel), Stange-nur,
   unter-der-Stange als ehrliche Unmoeglichkeit, konfigurierbare Stange,
   kg/lb, eigene Scheibensaetze — und die Gleitkomma-Fallen (2.5/1.25/0.25).

   node supabase/tests/plate_calculator_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'plate-calculator.js'))) || _flat);
const P = require(join(APP, 'js/engine/plate-calculator.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
/* Summe: Stange + 2×(Scheiben je Seite) muss == achieved sein. */
const sumOf = r => r.bar + 2 * r.perSide.reduce((s, p) => s + p.plate * p.count, 0);

console.log('\nA · exakte Ladungen');
{
  const r = P.compute({ target: 100 });                 // 20 + 2×40
  ok('A1 100kg exakt', r.exact && r.achieved === 100 && r.delta === 0, JSON.stringify(r.perSide));
  ok('A2 perSide summiert auf achieved', sumOf(r) === r.achieved);
  ok('A3 greedy nutzt die groessten Scheiben (25+15, nicht 20+20)',
    r.perSide.length === 2 && r.perSide[0].plate === 25 && r.perSide[1].plate === 15, JSON.stringify(r.perSide));
  const lb = P.compute({ target: 135, unit: 'lb' });     // 45 + 2×45
  ok('A4 135lb exakt (Standardstange 45lb)', lb.exact && lb.achieved === 135 && lb.bar === 45);
}

console.log('\nB · konservatives Abrunden (nie ueber Ziel)');
{
  const r = P.compute({ target: 101 });   // 0.5/Seite nicht ladbar
  ok('B1 101kg → 100 geladen, delta -1, nicht exakt', r.achieved === 100 && r.delta === -1 && r.exact === false, JSON.stringify(r));
  ok('B2 achieved ueberschreitet das Ziel NIE', r.achieved <= 101 && r.delta <= 0);
  const r2 = P.compute({ target: 63.75 });  // 21.875/Seite → 21.25 ladbar (20+1.25)
  ok('B3 63.75kg → rundet nach unten, delta<=0', r2.achieved <= 63.75 && r2.delta <= 0 && sumOf(r2) === r2.achieved, JSON.stringify(r2));
}

console.log('\nC · Stange-nur und unter-der-Stange');
{
  const bar = P.compute({ target: 20 });
  ok('C1 target==Stange → keine Scheiben, exakt', bar.feasible && bar.perSide.length === 0 && bar.exact);
  const below = P.compute({ target: 15 });
  ok('C2 unter der Stange → feasible:false, reason below_bar', below.feasible === false && below.reason === 'below_bar', JSON.stringify(below));
  ok('C3 below_bar erfindet keinen Plan', below.perSide.length === 0);
}

console.log('\nD · Gleitkomma-Fallen (die eigentliche Testfrage)');
{
  const r = P.compute({ target: 22.5 });   // 1.25/Seite — klassischer Float-Fehler
  ok('D1 22.5kg exakt (1.25 je Seite, kein Float-Drift)', r.exact && r.achieved === 22.5, JSON.stringify(r.perSide));
  const r2 = P.compute({ target: 62.5 });  // 21.25/Seite = 20 + 1.25
  ok('D2 62.5kg exakt', r2.exact && r2.achieved === 62.5 && sumOf(r2) === 62.5);
  const r3 = P.compute({ target: 20.5, plates: [0.25, 0.5, 1.25, 2.5, 5] }); // 0.25/Seite
  ok('D3 20.5kg mit Mikroscheiben exakt (0.25 je Seite)', r3.exact && r3.achieved === 20.5, JSON.stringify(r3.perSide));
}

console.log('\nE · konfigurierbare Stange & eigene Scheiben');
{
  const r = P.compute({ target: 60, bar: 15 });   // 22.5/Seite
  ok('E1 15kg-Stange: 60kg → 22.5 je Seite exakt', r.exact && r.bar === 15 && r.achieved === 60, JSON.stringify(r.perSide));
  const lim = P.compute({ target: 100, plates: [20, 10] }); // pro Seite 40 = 2×20
  ok('E2 begrenzter Satz [20,10]: 100kg exakt', lim.exact && lim.perSide[0].plate === 20 && lim.perSide[0].count === 2);
  const lim2 = P.compute({ target: 95, plates: [20] });     // pro Seite 37.5 → 1×20 (rest 17.5 nicht ladbar)
  ok('E3 nur 20er-Scheiben, 95kg → rundet auf 60 ab', lim2.achieved === 60 && lim2.delta === -35 && sumOf(lim2) === lim2.achieved, JSON.stringify(lim2));
}

console.log('\nF · Datenluecke ≠ Wert / Robustheit');
{
  ok('F1 target fehlt → invalid_input, feasible false', P.compute({}).reason === 'invalid_input' && P.compute({}).feasible === false);
  ok('F2 negative Stange → invalid_input', P.compute({ target: 50, bar: -5 }).reason === 'invalid_input');
  ok('F3 leerer Scheibensatz → no_plates', P.compute({ target: 50, plates: [] }).reason === 'no_plates' || P.compute({ target: 50, plates: [0, -1] }).reason === 'no_plates');
  ok('F4 unsortierte/duplizierte Scheiben werden normalisiert',
    P.compute({ target: 100, plates: [15, 25, 25, 15] }).exact === true);
  ok('F5 describe() liefert lesbaren Text', /je Seite/.test(P.describe(P.compute({ target: 100 }))) && P.describe(P.compute({ target: 15 })) === null);
}

console.log('\nG · Determinismus');
{
  const a = JSON.stringify(P.compute({ target: 87.5, bar: 20 }));
  const b = JSON.stringify(P.compute({ target: 87.5, bar: 20 }));
  ok('G1 gleiche Eingabe → byte-gleiche Ausgabe', a === b);
}

console.log('\n' + '─'.repeat(60));
console.log('plate_calculator: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
