/* ============================================================
   ORVIA · gym_adapters — Phase B, Gym-Strang (Uebersetzer)
   ------------------------------------------------------------
   Die vier Gym-Module sind rein; diese Datei uebersetzt App-Datenformen in
   ihre Eingaben. Geprueft wird die Uebersetzung selbst UND dass die Module
   die uebersetzte Form tatsaechlich verstehen (Roundtrip).

     A. B-08 Historie: nur abgeschlossene Sessions, nur zaehlbare Saetze,
        aufsteigend, Satznummern neu durchnummeriert, Datenluecke bleibt null
     B. B-08 Zielbereich aus workout_exercises
     C. B-06 Katalog: Muskelzuordnung injiziert, Luecken fallen aus
     D. B-05 Baum → Superset-Eingabe; Wechsel A→B→A; null-Gruppe = kein Wechsel
     E. Roundtrip in die Module

   node supabase/tests/gym_adapters_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'gym-adapters.js'))) || _flat);
const A = require(join(APP, 'js/engine/gym-adapters.js'));
const SP = require(join(APP, 'js/engine/strength-progression.js'));
const EA = require(join(APP, 'js/engine/exercise-alternatives.js'));
const SM = require(join(APP, 'js/engine/superset-model.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);

const row = (date, status, sets) => ({ session: { local_date: date, status }, workout_sets: sets });
const set = (n, w, r, rir, extra) => Object.assign({ set_number: n, weight: w, reps: r, rir, completed: true, set_type: 'working' }, extra || {});

sec('A · B-08 Historie aus workout_exercises-Zeilen');
{
  const rows = [
    row('2026-08-20', 'completed', [set(1, 60, 10, 2), set(2, 60, 9, 1)]),
    row('2026-08-13', 'completed', [set(1, 40, 10, 5, { set_type: 'warmup' }), set(2, 60, 8, 2), set(3, 60, 8, 1)]),
    row('2026-08-27', 'active', [set(1, 62.5, 6, 3)]),
    row('2026-08-06', 'completed', [set(1, 57.5, 10, 2, { completed: false }), set(2, 57.5, 10, 2)])
  ];
  const h = A.historyFromExerciseRows(rows);
  ok('A1 nur abgeschlossene Sessions, aufsteigend', J(h.map(x => x.date)) === J(['2026-08-06', '2026-08-13', '2026-08-20']), J(h.map(x => x.date)));
  ok('A2 Aufwaermsatz faellt raus, Satznummern neu ab 1', J(h[1].sets.map(s => [s.setNumber, s.weight, s.reps])) === J([[1, 60, 8], [2, 60, 8]]), J(h[1].sets));
  ok('A3 nicht abgeschlossener Satz faellt raus', h[0].sets.length === 1 && h[0].sets[0].setNumber === 1);
  ok('A4 beforeDate schneidet ab', A.historyFromExerciseRows(rows, { beforeDate: '2026-08-20' }).map(x => x.date).join() === '2026-08-06,2026-08-13');
  ok('A5 limit behaelt die JUENGSTEN', A.historyFromExerciseRows(rows, { limit: 2 }).map(x => x.date).join() === '2026-08-13,2026-08-20');
  const gap = A.historyFromExerciseRows([row('2026-08-20', 'completed', [{ set_number: 1, weight: null, reps: 8, completed: true }])]);
  ok('A6 fehlendes Gewicht bleibt null (kein 0)', gap[0].sets[0].weight === null && gap[0].sets[0].rir === null);
  ok('A7 Unsinn-Eingabe → leere Historie, kein Absturz', A.historyFromExerciseRows(null).length === 0 && A.historyFromExerciseRows([null, {}, { session: null }]).length === 0);
  ok('A8 String-Zahlen werden gelesen', A.historyFromExerciseRows([row('2026-08-20', 'completed', [set(1, '62.5', '8', '2')])])[0].sets[0].weight === 62.5);
}

sec('B · Zielbereich');
{
  ok('B1 min/max → Bereich', J(A.repRangeFromWorkoutExercise({ min_reps: 6, max_reps: 10 })) === J({ min: 6, max: 10 }));
  ok('B2 nur min → min=max', J(A.repRangeFromWorkoutExercise({ min_reps: 8 })) === J({ min: 8, max: 8 }));
  ok('B3 nichts → null (Modul-Default, nicht 0–0)', A.repRangeFromWorkoutExercise({}) === null && A.repRangeFromWorkoutExercise(null) === null);
  ok('B4 max < min → null statt kaputter Bereich', A.repRangeFromWorkoutExercise({ min_reps: 10, max_reps: 6 }) === null);
}

sec('C · B-06 Katalog');
{
  const mf = ex => ex.exerciseId === 'bench_press' ? { chest: 'direct', triceps: 0.5 } : (ex.name === 'Dips' ? { chest: 'direct', triceps: 'direct' } : null);
  const cat = A.catalogFromExercises([
    { id: 'u1', slug: 'bench_press', name: 'Bankdrücken', movementPattern: 'horizontal_push' },
    { id: 'u2', name: 'Dips', movementPattern: null },
    { id: 'u3', name: 'Unbekannt', movementPattern: null },
    { id: 'u4', name: 'Nur Muster', movementPattern: 'squat' },
    null, { name: 'ohne id' }
  ], mf);
  ok('C1 Uebungen mit Zuordnung ODER Muster bleiben, Rest faellt', cat.map(c => c.id).join() === 'u1,u2,u4', cat.map(c => c.id).join());
  ok('C2 Muskeln + Muster + Name uebernommen', cat[0].muscles.chest === 'direct' && cat[0].pattern === 'horizontal_push' && cat[0].name === 'Bankdrücken');
  ok('C3 nur Muster → leere Muskeln, nicht undefined', J(cat[2].muscles) === '{}' && cat[2].pattern === 'squat');
  ok('C4 Zuordnung wirft → Uebung ohne Zuordnung, kein Absturz', A.catalogFromExercises([{ id: 'x', name: 'y', movementPattern: 'hinge' }], () => { throw new Error('boom'); }).length === 1);
  ok('C5 ohne Zuordnungsfunktion → nur Muster-Uebungen', A.catalogFromExercises([{ id: 'x', name: 'y' }, { id: 'z', movementPattern: 'squat' }]).map(c => c.id).join() === 'z');
}

sec('D · B-05 Baum → Superset');
{
  const tree = [
    { workoutExercise: { order_index: 0, planned_sets: 3, superset_group: 1 }, sets: [] },
    { workoutExercise: { order_index: 1, planned_sets: 3, superset_group: 1 }, sets: [] },
    { workoutExercise: { order_index: 2, planned_sets: 2, superset_group: null }, sets: [] },
    { workoutExercise: { order_index: 3, planned_sets: null, superset_group: 2 }, sets: [{}, {}, {}, {}] },
    { workoutExercise: { order_index: 4, planned_sets: 2, superset_group: 2 }, sets: [{}, {}, {}] }
  ];
  const inp = A.supersetInputFromTree(tree);
  ok('D1 id = Baum-Index, Gruppe uebernommen', inp[0].id === 0 && inp[1].supersetGroup === 1 && inp[2].supersetGroup === null);
  ok('D2 planned_sets fehlt → geloggte Saetze (4), nicht 0', inp[3].plannedSets === 4);
  ok('D3 mehr geloggt als geplant → das Groessere (3)', inp[4].plannedSets === 3);
  ok('D4 Wechsel A→B→A innerhalb der Gruppe', A.nextInSuperset(tree, 0, SM) === 1 && A.nextInSuperset(tree, 1, SM) === 0);
  ok('D5 zweite Gruppe unabhaengig', A.nextInSuperset(tree, 3, SM) === 4 && A.nextInSuperset(tree, 4, SM) === 3);
  ok('D6 null-Gruppe → kein Wechsel (heutiges Verhalten)', A.nextInSuperset(tree, 2, SM) === null);
  ok('D7 Einzel-Gruppe ist kein Superset → kein Wechsel', A.nextInSuperset([{ workoutExercise: { order_index: 0, planned_sets: 3, superset_group: 7 } }, { workoutExercise: { order_index: 1, planned_sets: 3 } }], 0, SM) === null);
  ok('D8 ohne Modul → null, kein Absturz', A.nextInSuperset(tree, 0, null) === null);
  ok('D9 Gruppenlabel 1→A, 2→B, null→null', A.groupLabel(1) === 'A' && A.groupLabel(2) === 'B' && A.groupLabel(null) === null && A.groupLabel(0) === null);
}

sec('E · Roundtrip in die Module');
{
  const rows = [
    row('2026-08-13', 'completed', [set(1, 60, 8, 2), set(2, 60, 8, 2)]),
    row('2026-08-20', 'completed', [set(1, 60, 10, 2), set(2, 60, 8, 0)])
  ];
  const r = SP.suggest({ history: A.historyFromExerciseRows(rows), repRange: A.repRangeFromWorkoutExercise({ min_reps: 6, max_reps: 10 }) });
  ok('E1 Progression: Satz 1 steigt (Obergrenze, RIR 2), Satz 2 haelt (RIR 0)', r.perSet.length === 2 && r.perSet[0].action === 'increase' && r.perSet[1].action === 'hold', J(r.perSet.map(p => p.action)));
  const cat = A.catalogFromExercises([
    { id: 'a', slug: 'bench_press', name: 'Bankdrücken', movementPattern: 'horizontal_push' },
    { id: 'b', slug: 'incline_bench_press', name: 'Schrägbank', movementPattern: 'horizontal_push' },
    { id: 'c', slug: 'squat', name: 'Kniebeuge', movementPattern: 'squat' }
  ], ex => ({ bench_press: { chest: 'direct', triceps: 0.5 }, incline_bench_press: { chest: 'direct', front_delts: 0.5 }, squat: { quads: 'direct' } })[ex.exerciseId] || null);
  const alt = EA.suggest({ exerciseId: 'a', catalog: cat });
  ok('E2 Alternativen: Schrägbank vor Kniebeuge, Kniebeuge gar nicht', alt.alternatives.length === 1 && alt.alternatives[0].id === 'b', J(alt.alternatives.map(x => x.id)));
  const order = SM.executionOrder(A.supersetInputFromTree([
    { workoutExercise: { order_index: 0, planned_sets: 2, superset_group: 1 } },
    { workoutExercise: { order_index: 1, planned_sets: 2, superset_group: 1 } }
  ]));
  ok('E3 Superset: A1→B1→A2→B2', order.map(x => x.exerciseId + '' + x.setNumber).join() === '01,11,02,12', order.map(x => x.exerciseId + '' + x.setNumber).join());
}

console.log('\n' + (fail ? '❌' : '✅') + ' gym_adapters: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
