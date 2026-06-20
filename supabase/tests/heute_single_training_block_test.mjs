/* ORVIA · Phase 4.2 — „Heute" enthält KEINEN Trainingsblock mehr; Logging liegt im Training-Tab.
   node supabase/tests/heute_single_training_block_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
function section(id, nextId) { const s = html.indexOf('id="' + id + '"'); const n = nextId ? html.indexOf('id="' + nextId + '"', s) : html.length; return html.slice(s, n > 0 ? n : html.length); }
const heute = section('tab-heute', 'tab-plan');
const training = section('tab-training', 'tab-dash');

// Heute: kein Trainingsblock mehr (keine separate Karte, kein Logger, keine Statuszeile).
ok('Heute-Sektion gefunden', heute.length > 0);
ok('Heute: keine #workoutEntry-Karte', heute.indexOf('id="workoutEntry"') < 0);
ok('Heute: keine #workoutStatusLine', heute.indexOf('id="workoutStatusLine"') < 0);
ok('Heute: kein #typeGrid (Logger entfernt)', heute.indexOf('id="typeGrid"') < 0);
ok('Heute: keine „Training heute"-Überschrift', heute.indexOf('>Training heute<') < 0);

// Training-Tab: enthält den Hub UND die heutige Trainings-Karte (Logger + heute trainiert).
ok('Training-Tab gefunden', training.length > 0);
ok('Training-Tab: #trainingHub vorhanden', training.indexOf('id="trainingHub"') >= 0);
ok('Training-Tab: #typeGrid (Heute-Logger) vorhanden', training.indexOf('id="typeGrid"') >= 0);
ok('Training-Tab: #postBlocks vorhanden', training.indexOf('id="postBlocks"') >= 0);

// Genau EIN #typeGrid im gesamten Dokument (kein Duplikat).
const typeGridCount = (html.match(/id="typeGrid"/g) || []).length;
ok('Genau ein #typeGrid im Dokument', typeGridCount === 1, 'gefunden: ' + typeGridCount);

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
