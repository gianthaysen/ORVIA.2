/* ORVIA · v8-325 — K4: reiner Garmin-Kraft-Workout-Exporter

   VERTRAG (Gians Festlegung):
     buildGarminStrengthWorkout({occurrence, plannedExercises, mapping})
       => { ok, workout, stepBindings, unmapped, warnings, version }

   Geprüft wird VERHALTEN gegen die ECHTEN Module (strength-plan, die
   versionierte garmin-exercise-map) — kein Nachbau der Rechnung des Prüflings.

     X1  Exakte Payload für ein Fixture mit drei Übungen
     X2  stepOrder und stepBindings sind stabil und vollständig zurückführbar
     X3  Gemischte Liste: mapped / ambiguous / unmapped / unbekannt
     X4  Fehlende Wiederholungen — nicht exportiert, nicht geschätzt
     X5  Gewicht: 0 / null / positiv, bei gesperrtem UND offenem G3-Gate
     X6  Fehlende Pause — Vertragsdefault plus Warnung
     X7  Nur ungültige Übungen ⇒ ok:false, reason:'no_mappable_exercise'
     X8  Die Eingabe bleibt unverändert
     X9  Determinismus: gleiche Eingabe ⇒ byte-identische Ausgabe
     X10 Gates: unbelegte IDs bleiben leer; Testmodus ist gekennzeichnet
     X11 Provenienz: nie fälschlich als doppelt verifiziert
     X12 row/squat melden das Rückweg-Risiko, ohne daraus etwas abzuleiten
     X13 hip_thrust nutzt die dokumentierte Bankvariante
     X14 Reinheit, Vertragsform, im Produkt geladen

   node supabase/tests/garmin_workout_export_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const htmlRaw = readFileSync(join(APP, 'index.html'), 'utf8');
const swRaw = readFileSync(join(APP, 'sw.js'), 'utf8');
const expRaw = readFileSync(join(APP, 'js/engine/garmin-workout-export.js'), 'utf8');

globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
await import(pathToFileURL(join(APP, 'js/training-domain.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/strength-plan.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/garmin-exercise-map.js')).href);
await import(pathToFileURL(join(APP, 'js/engine/garmin-workout-export.js')).href);
const EXP = globalThis.ORVIA.garminWorkoutExport;
const MAP = globalThis.ORVIA.garminExerciseMap;
const build = EXP.buildGarminStrengthWorkout;

/* Drei Übungen aus Gians MVP-Kernset. Der Slug steht direkt an der Planzeile —
   so kommt er auch aus dem Editor, sobald K5 ihn mitgibt. */
const OCC = { occurrenceId: 'po:2026-08-12:ps:g1', l: 'Oberkörper', t: 'Gym' };
const THREE = () => ([
  { exerciseId: 'ex-1', slug: 'bench_press', sets: 4, minReps: 6, maxReps: 8, targetWeightKg: 82.5, restSeconds: 150 },
  { exerciseId: 'ex-2', slug: 'lat_pulldown', sets: 3, minReps: 10, maxReps: 10, targetWeightKg: 60, restSeconds: 120 },
  { exerciseId: 'ex-3', slug: 'leg_curl', sets: 1, minReps: 12, maxReps: 12, targetWeightKg: 40, restSeconds: 90 }
]);
const run = (over) => build(Object.assign({ occurrence: OCC, plannedExercises: THREE(), mapping: MAP }, over || {}));

/* ══ X1 · Exakte Payload ══ */
sec('X1 · Exakte Payload für drei Übungen');
const r1 = run();
ok('der Export gelingt', r1.ok === true, JSON.stringify(r1.reason || ''));
ok('das Ergebnis trägt genau die vertraglichen Felder',
  ['ok', 'workout', 'stepBindings', 'unmapped', 'warnings', 'version'].every(k => k in r1), Object.keys(r1).join(','));
ok('die Fassung ist benannt', /^garmin-workout-export@\d+$/.test(r1.version), r1.version);
const w = r1.workout;
ok('der Name kommt aus der geplanten Einheit', w.workoutName === 'Oberkörper', w.workoutName);
ok('die Occurrence steht in der Beschreibung (Anker für K5/K6)',
  w.description === 'ORVIA po:2026-08-12:ps:g1', w.description);
ok('es gibt genau ein Segment', w.workoutSegments.length === 1 && w.workoutSegments[0].segmentOrder === 1);
const steps = w.workoutSegments[0].workoutSteps;
ok('zwei Wiederholungsgruppen (4 und 3 Sätze) plus ein Einzelsatz-Paar',
  steps.length === 4 && steps[0].type === 'RepeatGroupDTO' && steps[1].type === 'RepeatGroupDTO' &&
  steps[2].type === 'ExecutableStepDTO' && steps[3].type === 'ExecutableStepDTO',
  steps.map(s => s.type).join(','));
const g0 = steps[0];
ok('Gruppe 1 wiederholt 4-mal', g0.numberOfIterations === 4 && g0.endConditionValue === 4);
ok('… mit der BELEGTEN Abbruchbedingung „iterations" (#7)',
  g0.endCondition.conditionTypeId === 7 && g0.endCondition.conditionTypeKey === 'iterations');
/* Defensiv lesen: ein fehlender Pausenschritt soll eine LESBARE rote Zeile
   erzeugen, keinen Absturz (Mutationsprobe Y2 stürzte sonst ab). */
ok('… und enthält genau Satz- und Pausenschritt', g0.workoutSteps.length === 2 &&
  ((g0.workoutSteps[0] || {}).stepType || {}).stepTypeKey === 'interval' &&
  ((g0.workoutSteps[1] || {}).stepType || {}).stepTypeKey === 'rest',
  g0.workoutSteps.map(s => ((s.stepType || {}).stepTypeKey) || '?').join(','));
const set0 = g0.workoutSteps[0] || {}, rest0 = g0.workoutSteps[1] || {};
ok('der Satzschritt trägt Kategorie und Übungsname aus der Zuordnung',
  set0.category === 'bench_press' && set0.exerciseName === 'barbell_bench_press');
ok('… samt beider numerischer Codes', set0.exerciseCategoryId === 0 && set0.exerciseNameId === 1);
ok('… und die untere Wiederholungsgrenze als Zielwert', set0.endConditionValue === 6);
ok('der Pausenschritt trägt die geplanten 150 s per Zeitbedingung (#2)',
  rest0.endConditionValue === 150 && (rest0.endCondition || {}).conditionTypeId === 2 &&
  (rest0.endCondition || {}).conditionTypeKey === 'time', JSON.stringify(rest0.endCondition));
ok('ein Einzelsatz erzeugt KEINE Wiederholungsgruppe',
  steps[2].category === 'leg_curl' && steps[2].endConditionValue === 12 && steps[3].endConditionValue === 90);
ok('die geschätzte Dauer stimmt mit der Rechnung überein (4·(40+150) + 3·(40+120) + 1·(40+90))',
  w.estimatedDurationInSecs === 4 * 190 + 3 * 160 + 130, String(w.estimatedDurationInSecs));
ok('ohne Testmodus steht NIRGENDS ein Gewicht in der Payload',
  !/weightValue|weightUnit/.test(JSON.stringify(w)));

/* ══ X2 · stepOrder und Bindungen ══ */
sec('X2 · stepOrder und stepBindings');
const orders = r1.stepBindings.map(b => b.stepOrder);
ok('jede Bindung hat eine stepOrder', orders.every(Number.isInteger));
ok('die stepOrder sind lückenlos 1..n und eindeutig',
  orders.slice().sort((a, b) => a - b).join(',') === Array.from({ length: orders.length }, (_, i) => i + 1).join(','),
  orders.join(','));
ok('acht Bindungen: 2 Gruppen + 3 Sätze + 3 Pausen', r1.stepBindings.length === 8, String(r1.stepBindings.length));
ok('jede Bindung führt auf exerciseId, plannedIndex UND Mappingversion zurück',
  r1.stepBindings.every(b => typeof b.exerciseId === 'string' && Number.isInteger(b.plannedIndex) &&
    b.mappingVersion === MAP.VERSION), JSON.stringify(r1.stepBindings[0]));
ok('… und nennt die Art des Schrittes', r1.stepBindings.every(b => ['repeat', 'set', 'rest'].indexOf(b.kind) >= 0));
ok('jeder erzeugte Garmin-Schritt hat GENAU eine Bindung', (() => {
  const inPayload = [];
  const walk = s => { inPayload.push(s.stepOrder); (s.workoutSteps || []).forEach(walk); };
  steps.forEach(walk);
  return inPayload.slice().sort((a, b) => a - b).join(',') === orders.slice().sort((a, b) => a - b).join(',');
})());
ok('die Bindung der ersten Gruppe kennt die Satzanzahl',
  r1.stepBindings[0].kind === 'repeat' && r1.stepBindings[0].sets === 4 && r1.stepBindings[0].plannedIndex === 0);
ok('die Bindung nennt auch das Garmin-Ziel (für den späteren Rückweg)',
  r1.stepBindings[1].category === 'bench_press' && r1.stepBindings[1].exerciseName === 'barbell_bench_press');
ok('die Zuordnung ist über Läufe hinweg stabil',
  JSON.stringify(run().stepBindings) === JSON.stringify(r1.stepBindings));

/* ══ X3 · Gemischte Liste ══ */
sec('X3 · mapped / ambiguous / unmapped / unbekannt');
{
  const before = JSON.stringify(MAP.entries);
  MAP.entries.__amb = { de: 'Prüffall', status: 'ambiguous', note: 'zwei gleichwertige Fassungen' };
  MAP.entries.__unm = { de: 'Prüffall', status: 'unmapped', note: 'kein Katalogeintrag' };
  const r = build({
    occurrence: OCC, mapping: MAP,
    plannedExercises: [
      { exerciseId: 'a', slug: 'bench_press', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 },
      { exerciseId: 'b', slug: '__amb', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 },
      { exerciseId: 'c', slug: '__unm', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 },
      { exerciseId: 'd', slug: 'gibt_es_nicht', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 },
      { exerciseId: 'e', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 }   /* kein Slug auflösbar */
    ]
  });
  ok('der Export gelingt mit dem brauchbaren Rest', r.ok === true);
  ok('nur die zugeordnete Übung landet in der Payload',
    r.workout.workoutSegments[0].workoutSteps.length === 1 &&
    r.workout.workoutSegments[0].workoutSteps[0].workoutSteps[0].category === 'bench_press');
  ok('vier Übungen werden NAMENTLICH ausgewiesen', r.unmapped.length === 4, JSON.stringify(r.unmapped.map(u => u.slug)));
  ok('… der ambiguous-Fall mit Status und Zeilenindex',
    r.unmapped.some(u => u.slug === '__amb' && u.status === 'ambiguous' && u.plannedIndex === 1), JSON.stringify(r.unmapped[0]));
  ok('… der unmapped-Fall ebenso',
    r.unmapped.some(u => u.slug === '__unm' && u.status === 'unmapped' && u.plannedIndex === 2));
  ok('… der unbekannte Slug mit Grund',
    r.unmapped.some(u => u.slug === 'gibt_es_nicht' && u.reason === 'unknown_slug' && u.plannedIndex === 3));
  ok('… und die Zeile ohne auflösbaren Slug mit eigenem Grund',
    r.unmapped.some(u => u.slug === null && u.reason === 'no_slug' && u.plannedIndex === 4));
  ok('KEINE davon wird durch eine ähnliche Übung ersetzt',
    !/lat_pulldown|barbell_row|squat/.test(JSON.stringify(r.workout)));
  ok('jede Meldung sagt ausdrücklich, dass nichts ersetzt wurde',
    r.unmapped.every(u => /ersetzt|eingesetzt/i.test(u.detail || '')));
  /* Auflösung über eine Slug-Tabelle statt über die Planzeile. */
  const r2 = build({ occurrence: OCC, mapping: MAP, slugs: { 'ex-9': 'squat' },
    plannedExercises: [{ exerciseId: 'ex-9', sets: 2, minReps: 5, maxReps: 5, restSeconds: 180 }] });
  ok('ein Slug lässt sich auch über eine mitgegebene Tabelle auflösen',
    r2.ok === true && r2.workout.workoutSegments[0].workoutSteps[0].workoutSteps[0].category === 'squat');
  delete MAP.entries.__amb; delete MAP.entries.__unm;
  ok('die Prüfeinträge sind restlos entfernt', JSON.stringify(MAP.entries) === before);
}

/* ══ X4 · Fehlende Wiederholungen ══ */
sec('X4 · Fehlende Wiederholungen werden nicht geschätzt');
{
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'bench_press', sets: 3, restSeconds: 120 },
    { exerciseId: 'b', slug: 'squat', sets: 3, minReps: 5, maxReps: 5, restSeconds: 180 }
  ] });
  ok('die Übung ohne Wiederholungsvorgabe wird NICHT exportiert',
    r.workout.workoutSegments[0].workoutSteps.length === 1);
  ok('… und namentlich mit Grund gemeldet',
    r.unmapped.length === 1 && r.unmapped[0].slug === 'bench_press' && r.unmapped[0].reason === 'missing_reps');
  ok('… es steht KEINE erfundene Wiederholungszahl in der Payload',
    !/"endConditionValue":\s*(8|10|12)\b/.test(JSON.stringify(r.workout.workoutSegments[0].workoutSteps)) ||
    JSON.stringify(r.workout).indexOf('bench_press') < 0);
  ok('die andere Übung bleibt unberührt',
    r.workout.workoutSegments[0].workoutSteps[0].workoutSteps[0].endConditionValue === 5);
  const rr = run();
  ok('ein echter Bereich 6–8 wird auf die untere Grenze gelegt UND gemeldet',
    rr.warnings.some(x => x.code === 'rep_range_collapsed' && x.to === 6 && x.from.join('-') === '6-8'),
    JSON.stringify(rr.warnings.filter(x => x.code === 'rep_range_collapsed')));
  ok('ein fester Wert erzeugt KEINE solche Warnung',
    rr.warnings.filter(x => x.code === 'rep_range_collapsed').length === 1);
}

/* ══ X5 · Gewicht und Gate G3 ══ */
sec('X5 · Zielgewicht 0 / null / positiv bei gesperrtem und offenem G3');
{
  const list = [
    { exerciseId: 'a', slug: 'pullup', sets: 2, minReps: 6, maxReps: 6, targetWeightKg: 0, restSeconds: 120 },
    { exerciseId: 'b', slug: 'squat', sets: 2, minReps: 5, maxReps: 5, targetWeightKg: null, restSeconds: 180 },
    { exerciseId: 'c', slug: 'leg_press', sets: 2, minReps: 10, maxReps: 10, targetWeightKg: 120, restSeconds: 120 }
  ];
  const locked = build({ occurrence: OCC, mapping: MAP, plannedExercises: list });
  ok('G3 gesperrt (Standard): KEIN weightValue in der gesamten Payload',
    !/weightValue/.test(JSON.stringify(locked.workout)));
  ok('… und keine Gewichtswarnung, weil nichts exportiert wurde',
    !locked.warnings.some(x => x.code === 'weight_export_enabled'));
  ok('… die Übungen selbst werden trotzdem exportiert',
    locked.workout.workoutSegments[0].workoutSteps.length === 3);

  const open = build({ occurrence: OCC, mapping: MAP, plannedExercises: list, options: { includeWeight: true } });
  const s = open.workout.workoutSegments[0].workoutSteps.map(g => (g.workoutSteps || [])[0] || {});
  ok('G3 offen: 0 kg wird als 0 exportiert (Körpergewichtsübung, nicht weggelassen)',
    s[0].weightValue === 0, JSON.stringify(s[0].weightValue));
  ok('… keine Vorgabe erzeugt GAR KEIN Gewichtsfeld (nicht 0)',
    !('weightValue' in s[1]), JSON.stringify(s[1].weightValue));
  ok('… ein positiver Wert wird mit der beschrifteten Annahme skaliert (120 kg → 120000)',
    s[2].weightValue === 120000 && s[2].weightUnit.unitKey === 'gram');
  ok('der Testmodus ist im Ergebnis AUSDRÜCKLICH gekennzeichnet',
    open.warnings.some(x => x.code === 'weight_export_enabled' && x.gate === 'G3'), JSON.stringify(open.warnings.map(x => x.code)));
  ok('… und die Skalierung ist dort als unbestätigte Annahme markiert',
    open.warnings.find(x => x.code === 'weight_export_enabled').assumption.verified === false);
  ok('die Annahme kg × 1000 ist im Modul NICHT als Wahrheit festgeschrieben',
    EXP.WEIGHT_SCALE_ASSUMPTION.verified === false && EXP.WEIGHT_SCALE_ASSUMPTION.gate === 'G3');
}

/* ══ X6 · Fehlende Pause ══ */
sec('X6 · Fehlende Pause');
{
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'bench_press', sets: 2, minReps: 8, maxReps: 8 }
  ] });
  ok('es entsteht trotzdem ein Pausenschritt (ohne wäre das Workout auf der Uhr unbrauchbar)',
    r.workout.workoutSegments[0].workoutSteps[0].workoutSteps.length === 2);
  const def = globalThis.ORVIA.strengthPlan.TIME.defaultRestSeconds;
  /* Defensiv lesen — ein fehlender Pausenschritt soll eine lesbare rote Zeile
     erzeugen, keinen Absturz (Mutationsprobe Y2). */
  const restOf = (r.workout.workoutSegments[0].workoutSteps[0].workoutSteps || [])[1] || {};
  ok('… mit dem DOKUMENTIERTEN Vertragsdefault aus strength-plan.js, nicht mit einer neuen Zahl',
    restOf.endConditionValue === def, 'erwartet ' + def + ', gefunden ' + restOf.endConditionValue);
  ok('… und die Ersetzung wird gemeldet',
    r.warnings.some(x => x.code === 'rest_default_applied' && x.seconds === def && x.plannedIndex === 0),
    JSON.stringify(r.warnings.map(x => x.code)));
  ok('eine geplante Pause erzeugt KEINE solche Warnung',
    !run().warnings.some(x => x.code === 'rest_default_applied'));
}

/* ══ X7 · Nur ungültige Übungen ══ */
sec('X7 · Nichts Exportierbares');
{
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'gibt_es_nicht', sets: 3, minReps: 8, maxReps: 8 },
    { exerciseId: 'b', slug: 'bench_press', sets: 3 }
  ] });
  ok('ok ist false', r.ok === false);
  ok('der Grund lautet genau no_mappable_exercise', r.reason === 'no_mappable_exercise', r.reason);
  ok('es gibt kein halbfertiges Workout', r.workout === null && r.stepBindings.length === 0);
  ok('die beiden Ursachen bleiben NAMENTLICH erhalten',
    r.unmapped.length === 2 && r.unmapped.map(u => u.reason).sort().join(',') === 'missing_reps,unknown_slug',
    JSON.stringify(r.unmapped.map(u => u.reason)));
  ok('eine leere Liste ergibt denselben Grund',
    build({ occurrence: OCC, mapping: MAP, plannedExercises: [] }).reason === 'no_mappable_exercise');
  ok('ein fehlendes Zuordnungsmodul wird benannt statt umgangen',
    build({ occurrence: OCC, plannedExercises: THREE() }).reason === 'no_mapping_module');
  ok('unsinnige Eingabe wird benannt', build(null).reason === 'invalid_input');
}

/* ══ X8 · Eingabe unverändert ══ */
sec('X8 · Die Eingabe wird nicht mutiert');
{
  const occ = { occurrenceId: 'po:x:ps:g1', l: 'Oberkörper' };
  const list = THREE();
  const snapOcc = JSON.stringify(occ), snapList = JSON.stringify(list), snapMap = JSON.stringify(MAP.entries);
  const r = build({ occurrence: occ, plannedExercises: list, mapping: MAP, options: { includeWeight: true, fillUnverifiedIds: true } });
  ok('der Export lief', r.ok === true);
  ok('das Occurrence-Objekt ist unverändert', JSON.stringify(occ) === snapOcc);
  ok('die Übungsliste ist unverändert', JSON.stringify(list) === snapList);
  ok('die Zuordnungstabelle ist unverändert', JSON.stringify(MAP.entries) === snapMap);
  r.workout.workoutName = 'verändert';
  ok('… und ein verändertes Ergebnis wirkt nicht zurück', run().workout.workoutName === 'Oberkörper');
}

/* ══ X9 · Determinismus ══ */
sec('X9 · Determinismus');
{
  const a = JSON.stringify(run()), b = JSON.stringify(run()), c = JSON.stringify(run());
  ok('drei Läufe liefern byte-identische Ausgabe', a === b && b === c);
  ok('das Modul benutzt keine Uhr und keinen Zufall',
    !/Date\.now|new Date|Math\.random/.test(expRaw));
  ok('… und keinen Netzzugriff', !/fetch\(|XMLHttpRequest|WebSocket/.test(expRaw));
}

/* ══ X10 · Gates ══ */
sec('X10 · G1 — unbelegte IDs bleiben leer');
{
  const r = run();
  const sp = r.workout.sportType;
  ok('die Sport-ID ist standardmässig NICHT gesetzt (nicht belegt)', sp.sportTypeId === null, JSON.stringify(sp));
  ok('… der Schlüssel steht aber, weil er belegtes Garmin-Vokabular ist', sp.sportTypeKey === 'strength_training');
  const setStep = (r.workout.workoutSegments[0].workoutSteps[0].workoutSteps || [])[0] || {};
  ok('die reps-Bedingung hat standardmässig KEINE erfundene Zahl',
    (setStep.endCondition || {}).conditionTypeId === null && (setStep.endCondition || {}).conditionTypeKey === 'reps',
    JSON.stringify(setStep.endCondition));
  const restStep0 = (r.workout.workoutSegments[0].workoutSteps[0].workoutSteps || [])[1] || {};
  ok('BELEGTE IDs stehen dagegen sehr wohl (time #2, iterations #7, no.target #1)',
    (restStep0.endCondition || {}).conditionTypeId === 2 &&
    r.workout.workoutSegments[0].workoutSteps[0].endCondition.conditionTypeId === 7 &&
    setStep.targetType.workoutTargetTypeId === 1,
    JSON.stringify({ rest: (restStep0.endCondition || {}).conditionTypeId }));
  const f = run({ options: { fillUnverifiedIds: true } });
  const fSet = (f.workout.workoutSegments[0].workoutSteps[0].workoutSteps || [])[0] || {};
  ok('im ausdrücklichen Testmodus werden die Kandidatenwerte eingesetzt',
    f.workout.sportType.sportTypeId === EXP.CONST.sportStrength.candidateId &&
    (fSet.endCondition || {}).conditionTypeId === EXP.CONST.condReps.candidateId,
    JSON.stringify({ sp: f.workout.sportType.sportTypeId, reps: (fSet.endCondition || {}).conditionTypeId }));
  ok('… und das steht als Warnung mit Gate-Bezug im Ergebnis',
    f.warnings.some(x => x.code === 'unverified_ids_filled' && x.gate === 'G1' && x.fields.length === 2),
    JSON.stringify(f.warnings.map(x => x.code)));
  ok('ohne Testmodus gibt es diese Warnung nicht',
    !r.warnings.some(x => x.code === 'unverified_ids_filled'));
  ok('jede unbelegte Konstante ist im Modul als solche markiert und trägt ein Gate',
    Object.keys(EXP.CONST).filter(k => !EXP.CONST[k].verified).every(k => !!EXP.CONST[k].gate && !!EXP.CONST[k].src),
    Object.keys(EXP.CONST).filter(k => !EXP.CONST[k].verified).join(', '));
  ok('jede BELEGTE Konstante nennt ihre Quelle',
    Object.keys(EXP.CONST).filter(k => EXP.CONST[k].verified).every(k => /garminconnect@0\.3\.2/.test(EXP.CONST[k].src)));
}

/* ══ X11 · Provenienz ══ */
sec('X11 · Provenienzlücke bleibt sichtbar');
{
  const r = run();
  ok('das Ergebnis nennt seine Katalogquellen', Array.isArray(r.catalogSources), JSON.stringify(r.catalogSources));
  ok('… es ist GENAU EINE — keine doppelte Verifikation behauptet',
    r.catalogSources.length === 1 && r.catalogSources[0] === 'fit-sdk@21.213.0');
  ok('… und die Lücke steht ausdrücklich als Warnung im Ergebnis',
    r.warnings.some(x => x.code === 'single_catalog_source'), JSON.stringify(r.warnings.map(x => x.code)));
  ok('die Warnung nennt die fehlende Quelle beim Namen',
    /Connect/i.test(((r.warnings.find(x => x.code === 'single_catalog_source')) || {}).detail || ''),
    JSON.stringify(r.warnings.map(x => x.code)));
}

/* ══ X12 · Rückweg-Risiko ══ */
sec('X12 · row und squat melden das Rückweg-Risiko');
{
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'row', sets: 3, minReps: 10, maxReps: 10, restSeconds: 120 },
    { exerciseId: 'b', slug: 'squat', sets: 3, minReps: 5, maxReps: 5, restSeconds: 180 },
    { exerciseId: 'c', slug: 'leg_curl', sets: 3, minReps: 12, maxReps: 12, restSeconds: 90 }
  ] });
  const hi = r.warnings.filter(x => x.code === 'return_variant_risk_high');
  ok('beide werden gemeldet', hi.length === 2 && hi.map(x => x.slug).sort().join(',') === 'row,squat',
    JSON.stringify(hi.map(x => x.slug)));
  ok('… mit Gate-Bezug G2', hi.every(x => x.gate === 'G2'));
  ok('… und mit dem Grund aus der Zuordnungstabelle', hi.every(x => /barbell/.test(x.detail || '')));
  ok('eine risikoarme Übung erzeugt keine solche Warnung',
    !hi.some(x => x.slug === 'leg_curl'));
  ok('alle drei werden trotzdem exportiert (die Warnung sperrt nichts)',
    r.workout.workoutSegments[0].workoutSteps.length === 3);
  ok('K4 leitet daraus KEINE Rückkanalzuordnung ab — es gibt keinen Rückweg-Code im Modul',
    !/fromGarmin/.test(expRaw));
  ok('… und die Warnung sagt das ausdrücklich',
    hi.every(x => /keine Rueckkanalzuordnung|keine Rückkanalzuordnung/.test(x.detail || '')));
}

/* ══ X13 · hip_thrust ══ */
sec('X13 · hip_thrust nutzt die dokumentierte Bankvariante');
{
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'hip_thrust', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 }
  ] });
  const s = r.workout.workoutSegments[0].workoutSteps[0].workoutSteps[0];
  ok('Kategorie hip_raise', s.category === 'hip_raise' && s.exerciseCategoryId === 10);
  ok('Bankvariante #1, NICHT die Bodenvariante #0',
    s.exerciseName === 'barbell_hip_thrust_with_bench' && s.exerciseNameId === 1,
    s.exerciseName + '#' + s.exerciseNameId);
  ok('die Entscheidung stammt aus der Zuordnungstabelle, nicht aus dem Exporter',
    !/hip_thrust|hip_raise/.test(expRaw));
}

/* ══ X14 · Reinheit, Vertrag, geladen ══ */
sec('X14 · Reinheit, Vertragsform, im Produkt geladen');
ok('der Exporter kennt die Sortierung nicht selbst — sie kommt aus dem Datenvertrag',
  !/\.sort\(/.test(expRaw));
ok('die Reihenfolge folgt dem normalisierten Vertrag', (() => {
  /* Absichtlich verdrehte order-Angaben: der Vertrag sortiert, nicht K4. */
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'leg_curl', order: 3, sets: 1, minReps: 12, maxReps: 12, restSeconds: 90 },
    { exerciseId: 'b', slug: 'bench_press', order: 1, sets: 1, minReps: 6, maxReps: 6, restSeconds: 150 },
    { exerciseId: 'c', slug: 'squat', order: 2, sets: 1, minReps: 5, maxReps: 5, restSeconds: 180 }
  ] });
  return r.workout.workoutSegments[0].workoutSteps.filter(s => s.category)
    .map(s => s.category).join(',') === 'bench_press,squat,leg_curl';
})());
ok('vom Datenvertrag abgewiesene Zeilen werden gemeldet, nicht verschluckt', (() => {
  const r = build({ occurrence: OCC, mapping: MAP, plannedExercises: [
    { exerciseId: 'a', slug: 'bench_press', sets: 3, minReps: 8, maxReps: 8, restSeconds: 120 },
    { exerciseId: 'b', slug: 'squat' }   /* keine Satzanzahl ⇒ Vertrag weist ab */
  ] });
  return r.warnings.some(x => x.code === 'contract_rejected_entries' && x.count === 1);
})());
ok('ohne Datenvertrag wird nichts gebaut', (() => {
  const keep = globalThis.ORVIA.strengthPlan;
  globalThis.ORVIA.strengthPlan = undefined;
  const r = build({ occurrence: OCC, plannedExercises: THREE(), mapping: MAP });
  globalThis.ORVIA.strengthPlan = keep;
  return r.ok === false && r.reason === 'no_strength_contract';
})());
ok('das Modul ist in index.html geladen',
  /<script src="js\/engine\/garmin-workout-export\.js"><\/script>/.test(htmlRaw));
ok('… NACH der Zuordnungstabelle und dem Datenvertrag',
  htmlRaw.indexOf('garmin-workout-export.js') > htmlRaw.indexOf('garmin-exercise-map.js') &&
  htmlRaw.indexOf('garmin-exercise-map.js') > htmlRaw.indexOf('strength-plan.js'));
ok('… und im Offline-Vorrat des Service Workers', swRaw.includes("'./js/engine/garmin-workout-export.js'"));
ok('K4 enthält KEINEN Push, keine Persistenz, keine Auth (das ist K5)',
  !/supabase|repos\.|localStorage|token|Authorization/i.test(expRaw));

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
