/* ORVIA · goal_detail — B-02 Ziel-Detailseite (rein) + Verdrahtung
   node supabase/tests/goal_detail_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'goal-detail.js'))) || _flat);
require(join(APP, 'js/i18n.js')); require(join(APP, 'locales/de.js'));   /* B-13: Texte kommen aus dem Katalog */
const G = require(join(APP, 'js/goal-detail.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const HM = { id: 'g1', category: 'half_marathon', targetValue: 6600, unit: 's', targetDate: '2026-10-11', milestones: [{ title: '15 km lang', targetDate: '2026-09-20' }] };
const PI = { family: 'run', daysTo: 30, phase: 'build', target: { targetMin: 110, pacePerKmSec: 313 } };
const M = o => G.buildModel(Object.assign({ goal: HM, planInput: PI, catLabel: c => ({ half_marathon: 'Halbmarathon', muscle_gain: 'Muskeln aufbauen' })[c] || c }, o || {}));

sec('A · Modell');
{
  const m = M({ engine: { tPred: 106.2, state: 'ontrack' }, feasibility: { evaluated: true, status: 'within_modeled_corridor' } });
  ok('A1 Titel/Kategorie/Datum/Phase', m.title === 'Halbmarathon' && m.dateText === '11.10.2026' && m.phaseLabel === 'Aufbau' && m.daysTo === 30);
  ok('A2 Zielwert mit Pace', m.targetText === '1:50 h · 5:13 /km');
  ok('A3 Fortschritt Zeit: Prognose 1:46 gegen 1:50 → 100 %, on track', m.progress.kind === 'time' && m.progress.percent === 100 && m.progress.state === 'ontrack' && m.progress.currentText === '1:46 h');
  ok('A4 Machbarkeit als Text, keine Warnung', /Korridor/.test(m.feasibilityText) && m.feasibilityWarn === false);
  ok('A5 Meilensteine uebernommen', m.milestones.length === 1);
  const slow = M({ engine: { tPred: 120, state: 'risk' } });
  ok('A6 Prognose 2:00 gegen 1:50 → 92 %, gefährdet', slow.progress.percent === 92 && slow.progress.state === 'risk');
  const nod = M({ engine: { state: 'nodata', need: '≥6 Läufe' } });
  ok('A7 nodata → kein Prozent, Hinweis mit Bedarf', nod.progress.percent === null && /≥6 Läufe/.test(nod.progress.note));
  const noT = M({ planInput: { family: 'run', daysTo: 30, phase: 'build', target: { targetMin: null } }, goal: Object.assign({}, HM, { targetValue: null }), engine: { tPred: 106.2, state: 'no_target' } });
  ok('A8 ohne Zielwert: „offen", kein Prozent, keine Erfindung', noT.targetText === null && noT.progress.percent === null && /Kein Zielwert/.test(noT.progress.note));
  const w = M({ goal: { id: 'g2', category: 'weight_loss', targetValue: 78, currentValue: 84, unit: 'kg' }, planInput: null });
  ok('A9 Wertziel (niedriger besser): 84 → 78 = 93 %', w.progress.kind === 'value' && w.progress.percent === 93 && /niedriger/.test(w.progress.note));
  const w2 = M({ goal: { id: 'g3', category: 'muscle_gain', targetValue: 85, currentValue: 80, unit: 'kg' }, planInput: null });
  ok('A10 Wertziel (höher): 80/85 = 94 %', w2.progress.percent === 94);
  ok('A11 nur Ziel-relevante Luecken', M({ strength: { gaps: [{ id: 'performance_reference' }, { id: 'section_constraints' }, { id: 'goal_date', action: 'goal_editor' }] } }).gaps.map(g => g.id).join() === 'performance_reference,goal_date');
  ok('A12 kein Ziel → null; kaputt → null', G.buildModel({ goal: null }) === null && G.buildModel() === null);
}

sec('B · HTML');
{
  const h = G.html(M({ engine: { tPred: 106.2, state: 'ontrack' }, feasibility: { evaluated: true, status: 'outside_modeled_corridor' }, strength: { gaps: [{ id: 'performance_reference', label: 'Leistungsreferenz', sectionId: 'body' }] } }));
  ok('B1 Balken mit Zustand, Prozent-Label', /gd-bar-fill gd-ontrack" style="width:100%/.test(h) && /100 % · on track/.test(h));
  ok('B2 Warn-Machbarkeit, Luecke als Button', /gd-note gd-warn/.test(h) && /id="gd-gap-performance_reference"/.test(h));
  ok('B3 Meilenstein gerendert', /15 km lang/.test(h) && /20\.09\.2026/.test(h));
  ok('B4 html(null) ist ein Hinweis, kein Wurf', /Kein Ziel/.test(G.html(null)));
  ok('B5 Escaping', /&lt;b&gt;/.test(G.html(M({ goal: Object.assign({}, HM, { title: '<b>x</b>' }) }))));
}

sec('C · Verdrahtung');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8'), sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  ok('C1 Plan-Kopf: Zieltitel oeffnet die Detailseite (Lauf- und Nicht-Lauf-Zweig)', (ui.match(/openGoalDetail\(\\''\+esc\(mg\.id\)/g) || []).length === 2);
  ok('C2 Skript + sw.js', idx.includes('js/goal-detail.js') && sw.includes("'./js/goal-detail.js'"));
  const src = readFileSync(join(APP, 'js/goal-detail.js'), 'utf8');
  ok('C3 Bearbeiten nur ueber openGoalEditor, kein eigener Schreibpfad', /openGoalEditor\(goal\.id\)/.test(src) && !/goalUpdate\(|commitGoals\(|saveProfile\(/.test(src));
  ok('C4 kein Ziel → Wizard statt leerer Seite', /if \(!goal\) \{ try \{ if \(typeof root\.openGoalEditor === 'function'\) root\.openGoalEditor\(\);/.test(src));
}
console.log('\n' + (fail ? '❌' : '✅') + ' goal_detail: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
