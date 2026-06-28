/* ORVIA · Phase 4.2 Batch 3 — Deutsche Anzeige-Labels & Muskelgruppen-Mapping (Unit-Test).
   Keine technischen Keys in der UI. node supabase/tests/training_labels_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
global.window = {};
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/training-domain.js');
const TD = global.window.ORVIA.trainingDomain;

ok('labelMovement: horizontal_push → Horizontal drücken', TD.labelMovement('horizontal_push') === 'Horizontal drücken');
ok('labelMovement: hinge → Hüftbeuge', TD.labelMovement('hinge') === 'Hüftbeuge');
ok('labelMuscle: glutes → Gesäß', TD.labelMuscle('glutes') === 'Gesäß');
ok('labelEquipment: barbell → Langhantel', TD.labelEquipment('barbell') === 'Langhantel');
ok('groupOfMovement: squat → legs', TD.groupOfMovement('squat') === 'legs');
ok('groupOfMovement: horizontal_pull → back', TD.groupOfMovement('horizontal_pull') === 'back');
ok('groupOfMovement: vertical_push → shoulders', TD.groupOfMovement('vertical_push') === 'shoulders');
ok('MUSCLE_GROUPS_DE: 6 Gruppen, deutsche Labels', Array.isArray(TD.MUSCLE_GROUPS_DE) && TD.MUSCLE_GROUPS_DE.length === 6 && TD.MUSCLE_GROUPS_DE[0].label === 'Brust');
// Kein roher Key bei unbekanntem Wert → Fallback ohne Unterstriche, kein Crash
ok('Fallback: unbekannter Key crasht nicht', typeof TD.labelMovement('foo_bar') === 'string' && TD.labelMovement('foo_bar').indexOf('_') < 0);
ok('Fallback: null → leerer String', TD.labelMovement(null) === '');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
