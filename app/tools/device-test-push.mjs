/* ============================================================
   ORVIA · device-test-push — Auslöser für den Gerätetest G1–G3

   WARUM ES DIESES WERKZEUG GIBT
   Dein Ablauf sieht in Schritt 4 vor, den Push „ausdrücklich mit
   deviceTest:true auszulösen". Diesen Auslöser gab es nicht: die Oberfläche
   kennt weder den Exporter noch den Endpunkt — das war in v8-326 ausdrücklich
   nicht gebaut, und es soll auch nicht gebaut werden, solange der produktive
   Pfad geschlossen bleibt. Ein Knopf in der App wäre genau die Produktfläche,
   die du erst nach den Gates willst.

   Deshalb ein Werkzeug statt einer Oberfläche. Es baut die Payload mit den
   ECHTEN Modulen (strength-plan, garmin-exercise-map, garmin-workout-export)
   — nicht mit einem Nachbau. Was hier entsteht, ist Zeichen für Zeichen das,
   was die App später erzeugen würde. Ein Gate, das etwas anderes prüft als
   das Produkt, wäre wertlos.

   ZWEI SCHRITTE, GETRENNT
     1. ANSEHEN (Standard):   node tools/device-test-push.mjs
        Baut die Payload, rechnet den Hash, zeigt alles an. Kein Netz.
     2. SENDEN (ausdrücklich): node tools/device-test-push.mjs --send \
          --worker https://<dein-worker> --jwt <supabase-access-token>
        Erst dieser Aufruf spricht mit dem Worker.

   Ohne --send passiert NICHTS ausser Rechnen und Anzeigen.

   WAS DAS WERKZEUG NICHT TUT
   Es kennt keine Passwörter und keine Garmin-Zugangsdaten. Das JWT reichst du
   selbst herein und es wird nirgends gespeichert, nur im Authorization-Kopf
   mitgeschickt. Es wird auch nichts protokolliert, was nicht ohnehin auf dem
   Bildschirm steht.
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = existsSync(join(HERE, '..', 'index.html')) ? join(HERE, '..') : HERE;

/* ---- Argumente -------------------------------------------------------- */
const argv = process.argv.slice(2);
const arg = (name, def = null) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const has = name => argv.indexOf('--' + name) >= 0;

const SEND = has('send');
const WORKER = (arg('worker') || '').replace(/\/+$/, '');
const JWT = arg('jwt');
const DATE = arg('date') || '2026-08-12';
const OCC = arg('occurrence') || ('po:' + DATE + ':ps:devicetest');
const REF = arg('client-ref') || ('swe:' + OCC + ':v1');

/* ---- Das Test-Workout aus Gians Ablauf --------------------------------
   Zwei eindeutig gemappte Übungen, absichtlich mit UNTERSCHIEDLICHEN
   Gewichten (20 kg / 30 kg): eine einzelne Zahl könnte man auf viele Arten
   erklären, zwei verschiedene belegen die Beziehung. Genau das verlangt G3. */
const PLANNED = [
  { exerciseId: 'devtest-1', slug: 'bench_press', sets: 2, minReps: 8, maxReps: 8, targetWeightKg: 20, restSeconds: 60 },
  { exerciseId: 'devtest-2', slug: 'romanian_deadlift', sets: 2, minReps: 6, maxReps: 6, targetWeightKg: 30, restSeconds: 90 }
];

/* ---- Die ECHTEN Module laden ------------------------------------------ */
globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
for (const f of ['js/training-domain.js', 'js/engine/strength-plan.js',
  'js/engine/garmin-exercise-map.js', 'js/engine/garmin-workout-export.js']) {
  await import(pathToFileURL(join(APP, f)).href);
}
const SP = globalThis.ORVIA.strengthPlan;
const MAP = globalThis.ORVIA.garminExerciseMap;
const EXP = globalThis.ORVIA.garminWorkoutExport;

/* ---- Bauen ------------------------------------------------------------- */
const built = EXP.buildGarminStrengthWorkout({
  occurrence: { occurrenceId: OCC, l: 'Gerätetest G1–G3', t: 'Gym' },
  plannedExercises: PLANNED,
  mapping: MAP,
  /* Beide Gates ausdrücklich geöffnet — das IST der Zweck dieses Laufs.
     Der Exporter meldet beides in `warnings`, und der Worker verlangt
     zusätzlich die serverseitige Freigabe. */
  options: { fillUnverifiedIds: true, includeWeight: true }
});

const line = s => console.log(s);
const hr = () => line('─'.repeat(72));

hr(); line('  ORVIA · Gerätetest G1–G3 — Payload aus den ECHTEN Modulen'); hr();

if (!built.ok) {
  line('❌ Der Exporter hat nichts erzeugt: ' + built.reason);
  for (const u of built.unmapped) line('   · ' + u.slug + ' [' + u.status + '] ' + u.reason);
  process.exit(1);
}

const payloadHash = SP.fingerprint(PLANNED);
line('  Occurrence     : ' + OCC);
line('  clientRef      : ' + REF);
line('  payloadHash    : ' + payloadHash);
line('  payloadVersion : ' + built.version);
line('  mappingVersion : ' + MAP.VERSION);
line('  Katalogquellen : ' + built.catalogSources.join(', ') + '   ← weiterhin nur EINE');
hr();
line('  Erwartete Führung auf der Uhr (das ist die G1-Prüfliste):');
for (const b of built.stepBindings) {
  if (b.kind === 'repeat') line('   ▸ ' + b.exerciseName + '  ·  ' + b.sets + ' Durchgänge  (Schritt ' + b.stepOrder + ')');
  if (b.kind === 'set') line('       Satz : ' + b.reps + ' Wdh.            (Schritt ' + b.stepOrder + ')');
  if (b.kind === 'rest') line('       Pause: ' + b.seconds + ' s               (Schritt ' + b.stepOrder + ')');
}
hr();
line('  Gesendete Gewichts-Rohwerte (G3 — beide müssen dieselbe Beziehung zeigen):');
const steps = [];
const walk = s => { steps.push(s); (s.workoutSteps || []).forEach(walk); };
built.workout.workoutSegments[0].workoutSteps.forEach(walk);
for (const s of steps) {
  if (s.weightValue !== undefined) {
    line('   · ' + s.exerciseName.padEnd(28) + ' geplant ' +
      String(PLANNED.find(p => MAP.toGarmin(p.slug).name === s.exerciseName).targetWeightKg).padStart(3) +
      ' kg  →  gesendet ' + s.weightValue + ' (' + s.weightUnit.unitKey + ')');
  }
}
hr();
line('  Warnungen des Exporters (alle erwartet — bitte gegenlesen):');
for (const w of built.warnings) line('   · ' + w.code + (w.gate ? '  [Gate ' + w.gate + ']' : ''));
hr();

const body = {
  clientRef: REF,
  occurrenceId: OCC,
  payloadVersion: built.version,
  mappingVersion: MAP.VERSION,
  payloadHash: payloadHash,
  workout: built.workout,
  stepBindings: built.stepBindings,
  deviceTest: true
};

if (!SEND) {
  line('  Vollständige Payload:');
  line(JSON.stringify(body, null, 2));
  hr();
  line('  Nichts gesendet. Zum Senden:');
  line('    node tools/device-test-push.mjs --send --worker https://<worker> --jwt <token>');
  line('  Voraussetzung im Worker: STRENGTH_PUSH_DEVICE_TEST=true');
  hr();
  process.exit(0);
}

if (!WORKER || !JWT) {
  line('❌ --send braucht --worker und --jwt.');
  process.exit(2);
}

line('  Sende an ' + WORKER + '/workout/push …');
const resp = await fetch(WORKER + '/workout/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + JWT },
  body: JSON.stringify(body)
});
const text = await resp.text();
let json = null; try { json = JSON.parse(text); } catch (_) { /* Rohtext anzeigen */ }
line('  HTTP ' + resp.status);
line('  ' + (json ? JSON.stringify(json) : text.slice(0, 400)));
hr();
if (resp.status === 200 && json && json.workoutId) {
  line('  ✅ Für das Protokoll notieren:');
  line('     clientRef        : ' + REF);
  line('     occurrenceId     : ' + OCC);
  line('     garmin workoutId : ' + json.workoutId);
  line('     payloadHash      : ' + payloadHash);
  line('     payloadVersion   : ' + built.version);
  line('     mappingVersion   : ' + MAP.VERSION);
} else if (resp.status === 422) {
  line('  ⚠️  422 invalid_workout — mit hoher Wahrscheinlichkeit steht');
  line('      STRENGTH_PUSH_DEVICE_TEST im Worker noch auf false.');
  line('      Der Worker sagt in `details`, was genau er beanstandet.');
} else if (resp.status === 409) {
  line('  ⚠️  409 — dieser clientRef wurde schon verwendet.');
  line('      already_pushed = identischer Wiederholungsversuch (harmlos).');
  line('      client_ref_conflict = der Plan hat sich geändert; dann mit');
  line('      --client-ref <neuer-wert> einen neuen Vorgang starten.');
}
hr();
