/* ============================================================
   ORVIA · superset_model — B-05 Schritt 1
   ------------------------------------------------------------
   Der fehleranfaellige Kern von Supersets ist die AUSFUEHRUNGSREIHENFOLGE,
   besonders bei UNGLEICHER Satzzahl. Geprueft:
     A. Bestandsschutz — ohne Gruppen exakt heutiges sequenzielles Verhalten
     B. Abwechselnde Reihenfolge (A1→B1→A2→B2), auch bei ungleicher Satzzahl
     C. Entartete Faelle — Gruppe mit einer Uebung ist KEIN Superset
     D. Mehrere Gruppen vermischen sich nicht; Trisets funktionieren
     E. Robustheit — kaputte Eingaben werfen nicht, erfinden nichts

   node supabase/tests/superset_model_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'superset-model.js'))) || _flat);
const S = require(join(APP, 'js/engine/superset-model.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ex = (id, oi, sets, group) => ({ id, orderIndex: oi, plannedSets: sets, supersetGroup: group });
const seq = list => S.executionOrder(list).map(x => x.exerciseId + x.setNumber).join(' ');

console.log('\nA · Bestandsschutz: ohne Gruppen unveraendert sequenziell');
{
  const l = [ex('A', 0, 3), ex('B', 1, 2)];
  ok('A1 alle Saetze am Stueck, Reihenfolge nach orderIndex', seq(l) === 'A1 A2 A3 B1 B2', seq(l));
  ok('A2 group ist null (keine erfundene Gruppe)', S.executionOrder(l).every(x => x.group === null));
  ok('A3 groupsOf liefert leere Liste', S.groupsOf(l).length === 0);
  /* Reihenfolge folgt orderIndex, nicht der Array-Reihenfolge. */
  const l2 = [ex('B', 5, 1), ex('A', 1, 1)];
  ok('A4 orderIndex bestimmt die Reihenfolge, nicht die Array-Position', seq(l2) === 'A1 B1', seq(l2));
}

console.log('\nB · Superset: abwechselnd — der Kern');
{
  const gl = [ex('A', 0, 3, 1), ex('B', 1, 3, 1)];
  ok('B1 gleiche Satzzahl → A1 B1 A2 B2 A3 B3', seq(gl) === 'A1 B1 A2 B2 A3 B3', seq(gl));
  ok('B2 jeder Satz traegt die Gruppe', S.executionOrder(gl).every(x => x.group === 1));
  ok('B3 round entspricht der Satznummer', S.executionOrder(gl).every(x => x.round === x.setNumber));
  /* DER Fall, den Implementierungen falsch machen: */
  const un = [ex('A', 0, 3, 1), ex('B', 1, 2, 1)];
  ok('B4 UNGLEICHE Satzzahl (3/2) → A1 B1 A2 B2 A3', seq(un) === 'A1 B1 A2 B2 A3', seq(un));
  ok('B5 die kuerzere Uebung bekommt KEINE erfundenen Saetze',
    S.executionOrder(un).filter(x => x.exerciseId === 'B').length === 2);
  ok('B6 die laengere Uebung verliert KEINEN Satz',
    S.executionOrder(un).filter(x => x.exerciseId === 'A').length === 3);
  const un2 = [ex('A', 0, 1, 1), ex('B', 1, 4, 1)];
  ok('B7 auch umgekehrt (1/4) korrekt', seq(un2) === 'A1 B1 B2 B3 B4', seq(un2));
}

console.log('\nC · Entartete Faelle');
{
  const one = [ex('A', 0, 2, 7)];
  ok('C1 Gruppe mit EINER Uebung ist kein Superset (group null)',
    S.executionOrder(one).every(x => x.group === null) && seq(one) === 'A1 A2', seq(one));
  ok('C2 groupsOf zaehlt eine 1er-Gruppe nicht', S.groupsOf(one).length === 0);
  ok('C3 isSuperset ist dort false', S.isSuperset(one, 'A') === false);
  const zero = [ex('A', 0, 0, 1), ex('B', 1, 2, 1)];
  ok('C4 Uebung mit 0 Saetzen erzeugt keine Eintraege', seq(zero) === 'B1 B2', seq(zero));
}

console.log('\nD · Mehrere Gruppen & Trisets');
{
  const tri = [ex('A', 0, 2, 1), ex('B', 1, 2, 1), ex('C', 2, 2, 1)];
  ok('D1 Triset rotiert ueber drei Uebungen', seq(tri) === 'A1 B1 C1 A2 B2 C2', seq(tri));
  const two = [ex('A', 0, 2, 1), ex('B', 1, 2, 1), ex('C', 2, 2, 2), ex('D', 3, 2, 2)];
  ok('D2 zwei Gruppen laufen getrennt (keine Vermischung)', seq(two) === 'A1 B1 A2 B2 C1 D1 C2 D2', seq(two));
  const mix = [ex('A', 0, 2, 1), ex('X', 1, 2), ex('B', 2, 2, 1)];
  /* Die Gruppe wird an ihrer ERSTEN Uebung abgearbeitet — X bleibt danach normal. */
  ok('D3 Gruppe + normale Uebung gemischt', seq(mix) === 'A1 B1 A2 B2 X1 X2', seq(mix));
  ok('D4 groupsOf liefert beide Gruppen mit rounds', (() => {
    const g = S.groupsOf(two);
    return g.length === 2 && g[0].group === 1 && g[0].rounds === 2 && g[1].group === 2;
  })());
  ok('D5 isSuperset erkennt Mitglieder', S.isSuperset(two, 'A') === true && S.isSuperset(mix, 'X') === false);
}

console.log('\nE · Robustheit — kein Wurf, keine Erfindung');
{
  ok('E1 leere Liste → leere Ausgabe', S.executionOrder([]).length === 0 && S.groupsOf([]).length === 0);
  ok('E2 null/undefined → leer, kein Wurf', S.executionOrder(null).length === 0 && S.groupsOf(undefined).length === 0);
  ok('E3 Muell-Eintraege werden ignoriert', S.executionOrder([null, 'x', 5, ex('A', 0, 1)]).length === 1);
  ok('E4 fehlende plannedSets → keine Saetze (kein Ersatzwert)',
    S.executionOrder([{ id: 'A', orderIndex: 0 }]).length === 0);
  ok('E5 negative/ungueltige Satzzahl erzeugt nichts',
    S.executionOrder([{ id: 'A', orderIndex: 0, plannedSets: -3 }]).length === 0);
  const d = S.executionOrder([ex('A', 0, 2, 1), ex('B', 1, 2, 1)]);
  ok('E6 deterministisch', JSON.stringify(d) === JSON.stringify(S.executionOrder([ex('A', 0, 2, 1), ex('B', 1, 2, 1)])));
}

console.log('\n' + '─'.repeat(60));
console.log('superset_model: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
