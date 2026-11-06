/* ORVIA · v8-462 — HF-Zone der Planeinheit: keine erfundene HFmax mehr.
   Vorher: ohne HFmax und ohne Alter rechnete unitHF mit 190 bpm und zeigte z. B.
   „116–137 bpm" als Zone an — ein Wert, den es für die Person nicht gibt.
   node supabase/tests/hf_zone_unknown_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = [join(HERE, '..', '..', 'app'), join(HERE, '..', '..')].find(p => existsSync(join(p, 'js', 'ui.js')));
let pass = 0, fail = 0; const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const src = readFileSync(join(APP, 'js/ui.js'), 'utf8');
const i0 = src.indexOf('function unitHF('), i1 = src.indexOf('\nfunction unitStruct(', i0);
ok('U0 unitHF gefunden', i0 > 0 && i1 > i0);
const unitHF = (P, kind) => new Function('PROFILE', src.slice(i0, i1) + '\nreturn unitHF(' + JSON.stringify(kind) + ');')(P);
ok('U1 ohne HFmax und ohne Alter → keine Zone (null)', unitHF({}, 'easy') === null);
ok('U2 mit Alter 28 → Tanaka-Schätzung (188 bpm) als Basis', unitHF({ age: 28 }, 'easy') === Math.round(0.61 * 188) + '–' + Math.round(0.72 * 188) + ' bpm');
ok('U3 mit gemessener HFmax 195 → diese gilt', unitHF({ hfMax: 195, age: 28 }, 'tempo') === Math.round(0.82 * 195) + '–' + Math.round(0.88 * 195) + ' bpm');
ok('U4 Gegenprobe: alte Fassung hätte 190 erfunden', /:190\);/.test(src) === false);
console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
