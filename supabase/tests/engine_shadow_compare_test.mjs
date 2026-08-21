/* ============================================================
   ORVIA · engine_shadow_compare — Regression: comparableDays blieb 0
   ------------------------------------------------------------
   BEFUND (2026-08-21, live belegt): der Engine-v2-Shadow-Runner feuerte
   taeglich, aber `report()` zeigte 5 Laeufe / 0 vergleichbare Tage. Ursache:
   buildTrainingDecision (v1) liefert die Ampel als `dayState`, die agree-Zeile
   las aber das rohe `v1.state` (undefined) → agree war IMMER null, selbst wenn
   v1 UND v2 denselben Zustand hatten (08-17: YELLOW/YELLOW, agree null).
   Damit erreichte S1 (>=14 Vergleichstage, Gate-A #5) NIE die Schwelle.

   Diese Pruefung sichert die pure Vergleichseinheit (_state/_compare), die jetzt
   die EINE Quelle fuer Tageseintrag und agree ist.

   node supabase/tests/engine_shadow_compare_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'shadow-runner.js'))) || _flat);

/* Runner-IIFE in diesem Kontext laufen lassen; sie haengt an globalThis.ORVIA. */
globalThis.ORVIA = globalThis.ORVIA || {};
vm.runInThisContext(readFileSync(join(APP, 'js/engine/shadow-runner.js'), 'utf8'));
const SR = globalThis.ORVIA.engineShadow;

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

console.log('\nA · _state extrahiert die Ampel unabhaengig vom Feldnamen');
ok('A1 dayState wird gelesen (der eigentliche Bug)', SR._state({ dayState: 'YELLOW' }) === 'YELLOW', String(SR._state({ dayState: 'YELLOW' })));
ok('A2 state wird gelesen', SR._state({ state: 'GREEN' }) === 'GREEN');
ok('A3 state hat Vorrang, dayState faellt zurueck', SR._state({ state: 'RED', dayState: 'GREEN' }) === 'RED');
ok('A4 null-Objekt → null (kein Wurf)', SR._state(null) === null);
ok('A5 Objekt ohne Ampel → null', SR._state({ score: 70 }) === null);

console.log('\nB · _compare bildet agree korrekt (die Regression)');
{
  const same = SR._compare({ dayState: 'YELLOW' }, { dayState: 'YELLOW' });
  ok('B1 v1.dayState==v2.dayState → agree TRUE (vorher faelschlich null)', same.agree === true, JSON.stringify(same));
  const diff = SR._compare({ dayState: 'YELLOW' }, { dayState: 'GREEN' });
  ok('B2 verschiedene Zustaende → agree FALSE', diff.agree === false, JSON.stringify(diff));
  ok('B3 v1state/v2state werden mitgegeben', same.v1state === 'YELLOW' && same.v2state === 'YELLOW');
}

console.log('\nC · Datenluecke bleibt null — kein erfundener Vergleich');
ok('C1 v1 fehlt → agree null', SR._compare(null, { dayState: 'GREEN' }).agree === null);
ok('C2 v2 ohne dayState → agree null', SR._compare({ dayState: 'YELLOW' }, { dayState: null }).agree === null);
ok('C3 v2 fehlt → agree null', SR._compare({ dayState: 'YELLOW' }, null).agree === null);
ok('C4 beide fehlen → agree null', SR._compare(null, null).agree === null);

console.log('\nD · realer v1-Vertrag (buildTrainingDecision liefert dayState)');
{
  /* exakt die Form aus calc.js:1703 */
  const v1 = { dayState: 'YELLOW', score: 62, todayAction: 'KEEP' };
  const v2 = { dayState: 'YELLOW', action: 'KEEP', confidence: 'medium' };
  const c = SR._compare(v1, v2);
  ok('D1 echter v1(dayState)+v2 → vergleichbar, agree true', c.agree === true, JSON.stringify(c));
}

console.log('\n' + '─'.repeat(60));
console.log('engine_shadow_compare: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
