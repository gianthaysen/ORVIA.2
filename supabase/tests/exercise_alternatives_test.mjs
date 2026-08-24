/* ============================================================
   ORVIA · exercise_alternatives — B-06 Kern
   ------------------------------------------------------------
   „Tausch in <= 2 Taps" heisst: die Liste ist kurz und die passende Alternative
   steht OBEN. Geprueft:
     A. Muskeldeckung (0..1) rechnet korrekt, 'direct' zaehlt 1
     B. Rangfolge: kuratiert > Deckung > gleiches Muster > ID (stabil)
     C. Ausruestung filtert (nicht: bestraft); unbekannte Ausruestung filtert NICHT
     D. Nie sich selbst; unbekannte Uebung erfindet nichts
     E. Robustheit + Determinismus

   node supabase/tests/exercise_alternatives_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'exercise-alternatives.js'))) || _flat);
const A = require(join(APP, 'js/engine/exercise-alternatives.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ids = r => r.alternatives.map(a => a.id).join(' ');
/* Zugriffe auf den Spitzenplatz muessen eine ROTE ZUSICHERUNG liefern, keinen
   Absturz: eine Mutationsprobe, die die Liste leert, brach den Lauf sonst ab
   („crashed" statt „gap") — und ein abgebrochener Test prueft gar nichts. */
const top = r => (r && r.alternatives && r.alternatives[0]) || {};

const CAT = [
  { id: 'bench_press',         muscles: { chest: 'direct', triceps: 0.5, front_delts: 0.5 }, equipment: ['barbell'], pattern: 'horizontal_push' },
  { id: 'bench_press_machine', muscles: { chest: 'direct', triceps: 0.5, front_delts: 0.5 }, equipment: ['machine'], pattern: 'horizontal_push' },
  { id: 'dumbbell_press',      muscles: { chest: 'direct', triceps: 0.5 },                   equipment: ['dumbbell'], pattern: 'horizontal_push' },
  { id: 'push_up',             muscles: { chest: 'direct', triceps: 0.5, front_delts: 0.5 }, equipment: [],           pattern: 'horizontal_push' },
  { id: 'lat_pulldown',        muscles: { lats: 'direct', biceps: 0.5 },                     equipment: ['cable'],   pattern: 'vertical_pull' },
  { id: 'leg_curl',            muscles: { hamstrings: 'direct' },                            equipment: ['machine'], pattern: 'knee_flexion' }
];

console.log('\nA · Muskeldeckung');
{
  const bp = CAT[0], mach = CAT[1], db = CAT[2], curl = CAT[5];
  ok('A1 identische Muskulatur → 1.0', A.coverage(bp, mach) === 1, String(A.coverage(bp, mach)));
  /* Brust 1 + Trizeps .5 + Front .5 = 2 gesamt; dumbbell trifft 1 + .5 = 1.5 → .75 */
  ok('A2 Teildeckung wird anteilig gerechnet', A.coverage(bp, db) === 0.75, String(A.coverage(bp, db)));
  ok('A3 keine gemeinsame Muskulatur → 0', A.coverage(bp, curl) === 0);
  ok('A4 Überdeckung zählt nicht extra (>1 unmöglich)',
    A.coverage(db, bp) === 1 && A.coverage(bp, mach) <= 1, String(A.coverage(db, bp)));
  ok('A5 leere/kaputte Eingabe → 0, kein Wurf', A.coverage(null, bp) === 0 && A.coverage(bp, null) === 0 && A.coverage({}, {}) === 0);
}

console.log('\nB · Rangfolge');
{
  const r = A.suggest({ exerciseId: 'bench_press', catalog: CAT });
  ok('B1 beste Deckung oben', top(r).coverage === 1, ids(r));
  ok('B2 nur passende Übungen in der Liste (kein Latzug/Beinbeuger)',
    !/lat_pulldown|leg_curl/.test(ids(r)), ids(r));
  ok('B3 Teildeckung steht hinter Volldeckung',
    r.alternatives.findIndex(a => a.id === 'dumbbell_press') >
    r.alternatives.findIndex(a => a.coverage === 1), ids(r));
  /* Gleichstand 1.0 zwischen bench_press_machine und push_up → ID entscheidet. */
  ok('B4 Gleichstand wird stabil über die ID gelöst',
    ids(r).indexOf('bench_press_machine') < ids(r).indexOf('push_up'), ids(r));

  const cur = A.suggest({ exerciseId: 'bench_press', catalog: CAT,
    curated: [{ exerciseId: 'bench_press', alternativeExerciseId: 'dumbbell_press', relation: 'alternative' }] });
  ok('B5 kuratiert schlägt bessere Deckung', top(cur).id === 'dumbbell_press', ids(cur));
  ok('B6 kuratiert wird als solches gekennzeichnet',
    top(cur).curated === true && top(cur).reason === 'curated' &&
    top(cur).relation === 'alternative');
  ok('B7 kuratiert für eine ANDERE Übung wirkt nicht',
    A.suggest({ exerciseId: 'bench_press', catalog: CAT,
      curated: [{ exerciseId: 'leg_curl', alternativeExerciseId: 'dumbbell_press' }] })
      .alternatives[0] !== undefined &&
    A.suggest({ exerciseId: 'bench_press', catalog: CAT,
      curated: [{ exerciseId: 'leg_curl', alternativeExerciseId: 'dumbbell_press' }] })
      .alternatives[0].coverage === 1);
  ok('B8 limit kürzt die Liste (2-Tap: kurz halten)',
    A.suggest({ exerciseId: 'bench_press', catalog: CAT, limit: 2 }).alternatives.length === 2);
}

console.log('\nC · Ausrüstung filtert, bestraft nicht');
{
  const r = A.suggest({ exerciseId: 'bench_press', catalog: CAT, equipmentAvailable: ['machine'] });
  ok('C1 Übung ohne verfügbares Gerät ist NICHT in der Liste', !/dumbbell_press/.test(ids(r)), ids(r));
  ok('C2 … sondern mit Grund ausgeschlossen',
    r.excluded.some(e => e.id === 'dumbbell_press' && e.excluded === 'equipment_unavailable'),
    JSON.stringify(r.excluded));
  ok('C3 Übung ohne Geräteanforderung bleibt (Liegestütz)', /push_up/.test(ids(r)), ids(r));
  const un = A.suggest({ exerciseId: 'bench_press', catalog: CAT });
  ok('C4 UNBEKANNTE Ausrüstung filtert nicht (Datenlücke ≠ Verbot)',
    /dumbbell_press/.test(ids(un)) && un.excluded.length === 0, ids(un));
}

console.log('\nD · Nie sich selbst, nichts erfinden');
{
  const r = A.suggest({ exerciseId: 'bench_press', catalog: CAT });
  ok('D1 die Übung selbst steht nie in ihrer Alternativenliste', !r.alternatives.some(a => a.id === 'bench_press'));
  const unk = A.suggest({ exerciseId: 'gibt_es_nicht', catalog: CAT });
  ok('D2 unbekannte Übung → leer mit Grund', unk.alternatives.length === 0 && unk.reason === 'exercise_unknown');
  ok('D3 ohne Übung → no_exercise', A.suggest({ catalog: CAT }).reason === 'no_exercise');
  ok('D4 Katalog mit nur einer Übung → catalog_too_small',
    A.suggest({ exerciseId: 'x', catalog: [{ id: 'x', muscles: { a: 'direct' } }] }).reason === 'catalog_too_small');
}

console.log('\nE · Robustheit & Determinismus');
{
  ok('E1 leerer/kaputter Katalog wirft nicht',
    A.suggest({ exerciseId: 'a', catalog: null }).reason === 'exercise_unknown' &&
    A.suggest({ exerciseId: 'a', catalog: [null, 'x', 7] }).reason === 'exercise_unknown');
  ok('E2 ohne Argumente → no_exercise, kein Wurf', A.suggest().reason === 'no_exercise');
  const a = JSON.stringify(A.suggest({ exerciseId: 'bench_press', catalog: CAT }));
  const b = JSON.stringify(A.suggest({ exerciseId: 'bench_press', catalog: CAT }));
  ok('E3 deterministisch', a === b);
}

console.log('\n' + '─'.repeat(60));
console.log('exercise_alternatives: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail === 0 ? 0 : 1);
