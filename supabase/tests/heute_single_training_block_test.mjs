/* ORVIA · Phase 4.2 — „Heute" enthält genau EINEN Trainingsblock (statische DOM-Prüfung).
   Verhindert das Wiederauftauchen der separaten Live-Workout-Karte (#workoutEntry).
   node supabase/tests/heute_single_training_block_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
// Heute-Sektion isolieren (von <div id="tab-heute"> bis zur nächsten Tab-Sektion).
const start = html.indexOf('id="tab-heute"');
const nextTab = html.indexOf('id="tab-plan"', start);
const heute = html.slice(start, nextTab > 0 ? nextTab : html.length);

ok('Heute-Sektion gefunden', start >= 0 && heute.length > 0);
ok('Keine separate #workoutEntry-Karte mehr', heute.indexOf('id="workoutEntry"') < 0);
const h2count = (heute.match(/>Training heute</g) || []).length;
ok('Genau EINE „Training heute"-Überschrift', h2count === 1, 'gefunden: ' + h2count);
ok('Integrierte Statuszeile #workoutStatusLine vorhanden', heute.indexOf('id="workoutStatusLine"') >= 0);

// #workoutStatusLine muss INNERHALB der Training-heute-Karte liegen (zwischen deren h2 und dem typeGrid).
const h2pos = heute.indexOf('>Training heute<');
const slPos = heute.indexOf('id="workoutStatusLine"');
const gridPos = heute.indexOf('id="typeGrid"');
ok('Statuszeile liegt in der Training-heute-Karte (h2 < statusLine < typeGrid)', h2pos >= 0 && slPos > h2pos && gridPos > slPos);

// renderEntry zielt auf die integrierte Zeile, nicht mehr auf eine eigene Karte.
const ui = fs.readFileSync(new URL('../../js/workout-ui.js', import.meta.url), 'utf8');
ok('renderEntry rendert in #workoutStatusLine', /getElementById\('workoutStatusLine'\)/.test(ui));
ok('renderEntry erzeugt KEINE eigene .card mehr', ui.indexOf("'<div class=\"card wo-prev\"") < 0 && ui.indexOf('card wo-prev') < 0);

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
