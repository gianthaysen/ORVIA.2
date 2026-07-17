/* ORVIA · Phase 4.2 Batch A — Trainings-Architektur entwirrt.
   Heute hat KEINEN Trainings-Logger mehr (nur kompakte Tageszusammenfassung); der redundante
   typeGrid-Logger existiert nirgends mehr; Erfassen läuft über den Aktivität-Tab.
   node supabase/tests/heute_single_training_block_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
function section(id, nextId) { const s = html.indexOf('id="' + id + '"'); const n = nextId ? html.indexOf('id="' + nextId + '"', s) : html.length; return html.slice(s, n > 0 ? n : html.length); }
const heute = section('tab-heute', 'tab-plan');
const training = section('tab-training', 'tab-dash');

// Kein doppelter Trainings-Logger mehr — typeGrid komplett raus.
ok('Kein #typeGrid mehr im gesamten Dokument', (html.match(/id="typeGrid"/g) || []).length === 0);
ok('Keine „Training heute"-Überschrift mehr', html.indexOf('>Training heute<') < 0);
ok('Keine „Heute trainiert"-Überschrift mehr', html.indexOf('>Heute trainiert<') < 0);

// Heute: nur kompakte Tageszusammenfassung, kein Logger.
ok('Heute: #todaySummary vorhanden', heute.indexOf('id="todaySummary"') >= 0);
ok('Heute: kein #workoutEntry/#workoutStatusLine', heute.indexOf('id="workoutEntry"') < 0 && heute.indexOf('id="workoutStatusLine"') < 0);

// Training-Tab: nur der Hub (Start/Erfassen laufen darüber), kein Logger.
ok('Training-Tab: #trainingHub vorhanden', training.indexOf('id="trainingHub"') >= 0);
ok('Training-Tab: kein typeGrid/postBlocks', training.indexOf('id="typeGrid"') < 0 && training.indexOf('id="postBlocks"') < 0);

// Aktivität-Tab (Training erfassen) bleibt erhalten.
ok('Aktivität-Tab (#aktBox / tab-akt) bleibt', html.indexOf('id="tab-akt"') >= 0 && html.indexOf('id="aktBox"') >= 0);

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
