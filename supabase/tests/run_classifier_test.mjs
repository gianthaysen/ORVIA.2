/* ORVIA · engine/run-classifier — Trainingsart ohne Label (S1.5, 13.09.2026)
   node supabase/tests/run_classifier_test.mjs */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/engine/run-classifier.js', u)));
const C = require(new URL('js/engine/run-classifier.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const ctx = { thresholdPaceSec: 329, hrMax: 194 };
ok('Long Run ab 14 km (Einzelsession), unabhaengig von Pace', C.classifyRun({ distKm: 21.3, durMin: 142 }, ctx).sub === 'Long Run' && C.classifyRun({ distKm: 13.9, durMin: 90 }, {}).sub === '');
ok('Tempo: ≥ 4 km und Pace ≤ Schwelle × 1,05 (5:29 → 5:45)', C.classifyRun({ distKm: 8, durMin: 45 }, ctx).sub === 'Tempo' && C.classifyRun({ distKm: 8, durMin: 47 }, ctx).sub !== 'Tempo');
ok('Tempo-Rueckfall ohne Schwelle: 10-km-Bestpace × 1,06', C.classifyRun({ distKm: 5, durMin: 28 }, { best10kPaceSec: 327 }).sub === 'Tempo' && C.classifyRun({ distKm: 5, durMin: 28 }, {}).sub === '');
ok('Easy Z2: HF 65–78 % HFmax (126–151 bei 194)', C.classifyRun({ distKm: 10, durMin: 62, hr: 140 }, ctx).sub === 'Easy Z2' && C.classifyRun({ distKm: 10, durMin: 62, hr: 160 }, ctx).sub === '');
ok('Intervalle nur ueber den Namen', C.classifyRun({ distKm: 6, durMin: 30, name: 'Intervalltraining 6×800' }, {}).sub === 'Intervalle');
ok('Ohne HFmax keine HF-Klasse; Tagesaggregat mit longestKm zaehlt die Einzelsession', C.classifyRun({ distKm: 10, durMin: 62, hr: 140 }, { thresholdPaceSec: 329 }).sub === '' && C.classifyRun({ distKm: 20, durMin: 120, longestKm: 10 }, {}).sub === '');
ok('Leer/ungueltig ⇒ „" mit Grund, kein Wurf', C.classifyRun(null, ctx).sub === '' && C.classifyRun({ distKm: 0, durMin: 30 }, ctx).reason === 'no_distance_or_duration');
const ui = readFileSync(new URL('js/ui.js', APP), 'utf8'), idx = readFileSync(new URL('index.html', APP), 'utf8'), sw = readFileSync(new URL('sw.js', APP), 'utf8');
ok('Verdrahtung: _storeRunsByDay klassifiziert (subDerived), Skript in index.html + sw.js', /ORVIA\.runClassifier/.test(ui) && /subDerived=!!/.test(ui) && idx.includes('js/engine/run-classifier.js') && sw.includes("'./js/engine/run-classifier.js'"));
console.log('\nrun_classifier: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
