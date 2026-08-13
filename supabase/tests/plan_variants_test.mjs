/* ORVIA · Planvarianten (2026-08-06)

   GEMELDETER FEHLER: „Bei A reduziert und B zaehlen dieselben Einheiten."
   Er war echt. Die alte Fassung filterte nach unitPriority (A=alles, B=A+B,
   C=nur A). Bei gleichrangigen Einheiten filterte B nichts weg — drei Varianten,
   ein Plan, drei Beschriftungen.

   Der erste Block hier ist genau dieser Fall und waere vorher rot gewesen.

   NEUE BEDEUTUNG (Nutzervorgabe): B ist keine andere Prioritaetsklasse, sondern
   derselbe Plan zeiteffizienter — Doppeleinheiten aufgeloest, Kernreize bleiben.

   node supabase/tests/plan_variants_test.mjs [appRoot-absolut] */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
require(join(APP, 'js/engine/load-profile.js'));
const V = require(join(APP, 'js/engine/plan-variants.js'));
const R = l => ({ t: 'Laufen', l: l }), G = l => ({ t: 'Gym', l: l });
const B = () => ({ t: 'Rad', l: 'Easy Z2' }), S = () => ({ t: 'Schwimmen', l: 'Technik' });
const cnt = w => w.reduce((n, d) => n + d.length, 0);

sec('1 · Der gemeldete Fall — A und B müssen sich unterscheiden');
const week = [[R('Z2 Dauerlauf')], [R('Intervalle'), G('Oberkörper')], [B()], [G('Ganzkörper')], [], [R('Long Run'), S()], []];
const v = V.build(week);
ok('A zählt alle Einheiten', v.A.count === 7, v.A.count + '');
ok('B ist ECHT kleiner als A (das war der Bug)', v.B.count < v.A.count, v.A.count + ' → ' + v.B.count);
ok('C ist echt kleiner als B', v.C.count < v.B.count, v.B.count + ' → ' + v.C.count);
ok('die Varianten sind unterscheidbar', v.distinct === true);
ok('A ⊇ B ⊇ C ist konsistent', v.consistent === true);

sec('2 · B ist „zeiteffizienter", nicht „anders"');
ok('B hat KEINE Doppeltage mehr', v.B.doubleDays === 0, v.A.doubleDays + ' → ' + v.B.doubleDays);
ok('B behält alle Trainingstage — die Struktur bleibt',
   v.B.trainingDays === v.A.trainingDays, v.A.trainingDays + ' → ' + v.B.trainingDays);
ok('B behält ALLE Kernreize', v.B.keySessions === v.A.keySessions, v.A.keySessions + ' → ' + v.B.keySessions);
ok('der Long Run überlebt B', v.B.days.some(d => d.some(u => u.l === 'Long Run')));
ok('die Intervalle überleben B', v.B.days.some(d => d.some(u => u.l === 'Intervalle')));
ok('was entfällt, wird benannt statt still weggelassen',
   v.B.dropped.length === v.A.count - v.B.count && v.B.dropped.every(d => typeof d.unit === 'string'),
   v.B.dropped.map(d => d.unit).join(', '));

sec('3 · C trägt das Ziel, auch wenn sonst nichts geht');
ok('C enthält nur noch Kernreize', v.C.count === v.C.keySessions, v.C.count + ' Einheiten, ' + v.C.keySessions + ' Kernreize');
ok('C verliert KEINEN Kernreiz', v.C.keySessions === v.A.keySessions);
ok('in jeder Variante bleiben die Kernreize vollständig', v.keySessionsIntact === true);

sec('4 · Wochen ohne Reduktionsspielraum — ehrlich statt vorgetäuscht');
{
  const nur = [[R('Long Run')], [], [R('Intervalle')], [], [], [], []];
  const x = V.build(nur);
  ok('reine Kernreiz-Woche ⇒ alle drei gleich groß', x.A.count === x.B.count && x.B.count === x.C.count);
  ok('… und das wird erklärt, nicht kaschiert',
     x.distinct === false && /nichts zu reduzieren/.test(x.note || ''), x.note);
}
{
  const leer = [[], [], [], [], [], [], []];
  const x = V.build(leer);
  ok('leere Woche stürzt nicht ab', x.A.count === 0 && x.C.count === 0);
}
{
  /* Ohne Kernreiz darf C nicht leer werden — eine leere Variante ist kein Plan. */
  const soft = [[R('Z2 Dauerlauf')], [B()], [G('Oberkörper')], [], [], [], []];
  const x = V.build(soft);
  ok('Woche ganz ohne Kernreiz: C bleibt trainierbar', x.C.count > 0, x.C.count + ' Einheiten');
  ok('… und deckt jede Sportart einmal ab',
     new Set(x.C.days.flat().map(u => u.t)).size === new Set(soft.flat().map(u => u.t)).size);
}

sec('5 · Reinheit und Einbindung');
{
  const snap = JSON.stringify(week);
  V.build(week);
  ok('die Eingabe wird nicht mutiert', JSON.stringify(week) === snap);
  ok('deterministisch', JSON.stringify(V.build(week)) === JSON.stringify(V.build(week)));
  const src = readFileSync(join(APP, 'js/engine/plan-variants.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
  ok('kein Zufall, keine Uhr, kein DOM, kein Storage',
     !/Math\.random|new Date\(|Date\.now\(|document\.|localStorage/.test(src));
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('gmPlanVariantModel nutzt das neue Modul', /ORVIA\.planVariants/.test(ui));
  ok('die alte unitPriority-Filterung ist raus',
     !/keepFor\s*=\s*function/.test(ui));
  ok('ohne Modul gibt es KEINE Variantenaussage statt drei gleicher Zahlen',
     /classified:false[\s\S]{0,200}count:null/.test(ui));
  const html = readFileSync(join(APP, 'index.html'), 'utf8');
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('index.html lädt das Modul', html.indexOf('js/engine/plan-variants.js') > 0);
  ok('sw.js cacht das Modul', sw.indexOf('./js/engine/plan-variants.js') > 0);
}

console.log('\nplan_variants: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
