/* ============================================================
   ORVIA · goal_plan_input — B-01, Schritt 1 (reiner Kern)
   ------------------------------------------------------------
   Band 1 B-01 DoD: „Zwei Nutzer mit gleicher Kategorie, aber unterschied-
   lichem Zielwert erhalten nachweislich unterschiedliche Wochenplaene."
   Bevor die Planung umgestellt wird, muss die EINGABE das hergeben.

     A. Zielzeit: Einheit gewinnt ueber metricType; keine Erfindung (kein 110)
     B. Kategorie/Familie/Distanz/Pace
     C. Datum + Phase (A-09 injiziert): build/taper/race_week/past
     D. Luecken werden benannt, nie gefuellt
     E. planKey: gleiche Kategorie, anderer Zielwert ⇒ anderer Schluessel (DoD)
     F. compareLegacy: Schattenvergleich mit goalOf()-Form
     G. Paritaet RUN_DIST_KM ↔ ui.js RACE_DIST

   node supabase/tests/goal_plan_input_test.mjs
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'engine', 'goal-plan-input.js'))) || _flat);
const G = require(join(APP, 'js/engine/goal-plan-input.js'));
const T = require(join(APP, 'js/engine/goal-taper-resolver.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);
const TODAY = '2026-09-03';
const hm = (extra) => Object.assign({ id: 'g1', status: 'active', priority: 1, category: 'half_marathon', metricType: 'time', unit: 's', targetValue: 6600, targetDate: '2026-10-11' }, extra || {});
const R = (goal, extra) => G.resolve(Object.assign({ goal, today: TODAY, taper: T }, extra || {}));

sec('A · Zielzeit');
{
  ok('A1 s → 110 min', R(hm()).target.targetMin === 110);
  ok('A2 unit min gewinnt (110 min bleibt 110)', R(hm({ unit: 'min', targetValue: 110 })).target.targetMin === 110);
  ok('A3 metricType time ohne unit → Sekunden', R(hm({ unit: null, targetValue: 6000 })).target.targetMin === 100);
  const noUnit = R(hm({ unit: null, metricType: null, targetValue: 110 }));
  ok('A4 weder unit noch time → KEINE Zielzeit, Luecke benannt (goalOf raet hier Minuten)', noUnit.target.targetMin === null && noUnit.gaps.indexOf('target_unit_unknown') >= 0, J(noUnit.gaps));
  const none = R(hm({ targetValue: null }));
  ok('A5 ohne Zielwert: null, KEIN 110-Default', none.target.targetMin === null && none.target.value === null && none.gaps.indexOf('target_value') >= 0);
  ok('A6 Zielwert 0/negativ → ungueltig, nicht 0 min', R(hm({ targetValue: 0 })).target.targetMin === null && R(hm({ targetValue: -5 })).gaps.indexOf('target_value_invalid') >= 0);
  ok('A7 Rundung: 5999 s → 99,98 min', R(hm({ targetValue: 5999 })).target.targetMin === 99.98);
}

sec('B · Kategorie, Familie, Distanz, Pace');
{
  const r = R(hm());
  ok('B1 half_marathon → run, 21,0975 km', r.category === 'half_marathon' && r.family === 'run' && r.target.distanceKm === 21.0975);
  ok('B2 Zielpace 110 min / 21,0975 km = 313 s/km', r.target.pacePerKmSec === 313);
  ok('B3 Kraftziel → strength, keine Distanz, keine Pace', (() => { const x = R(hm({ category: 'muscle_gain', metricType: 'weight', unit: 'kg', targetValue: 82 })); return x.family === 'strength' && x.target.distanceKm === null && x.target.pacePerKmSec === null && x.target.targetMin === null; })());
  ok('B4 unbekannte Kategorie → other', R(hm({ category: 'custom_xyz' })).family === 'other');
  ok('B5 canon wird angewandt (Legacy "hm" → half_marathon)', R(hm({ category: 'hm' }), { canon: c => c === 'hm' ? 'half_marathon' : c }).category === 'half_marathon');
  ok('B6 canon wirft → Rohkategorie bleibt, kein Absturz', R(hm(), { canon: () => { throw new Error('x'); } }).category === 'half_marathon');
  ok('B7 type statt category wird gelesen', R({ type: 'marathon', targetValue: 12600, unit: 's' }).family === 'run');
}

sec('C · Datum und Phase (A-09)');
{
  ok('C1 38 Tage → build, daysTo 38, nicht aktiv', (() => { const r = R(hm()); return r.phase === 'build' && r.daysTo === 38 && r.taperActive === false; })());
  ok('C2 10 Tage → taper, aktiv', (() => { const r = R(hm({ targetDate: '2026-09-13' })); return r.phase === 'taper' && r.taperActive === true; })());
  ok('C3 3 Tage → race_week', R(hm({ targetDate: '2026-09-06' })).phase === 'race_week');
  ok('C4 vergangen → past, daysTo negativ, nicht aktiv', (() => { const r = R(hm({ targetDate: '2026-08-01' })); return r.phase === 'past' && r.daysTo < 0 && r.taperActive === false; })());
  ok('C5 kein Datum → phase null + Luecke target_date', (() => { const r = R(hm({ targetDate: null })); return r.phase === null && r.gaps.indexOf('target_date') >= 0; })());
  ok('C6 kaputtes Datum wie kein Datum', R(hm({ targetDate: '11.10.2026' })).targetDate === null);
  ok('C7 ohne Taper-Resolver: Datum bleibt, Phase null, keine Luecke erfunden', (() => { const r = G.resolve({ goal: hm(), today: TODAY }); return r.targetDate === '2026-10-11' && r.phase === null && r.gaps.length === 0; })());
}

sec('D · Luecken');
{
  const r = G.resolve({ goal: null });
  ok('D1 kein Hauptziel → source none, Luecke no_main_goal, target null', r.source === 'none' && r.gaps.join() === 'no_main_goal' && r.target === null);
  ok('D2 leeres Ziel → category-Luecke, kein Absturz', G.resolve({ goal: {} }).gaps.indexOf('category') >= 0);
  ok('D3 vollstaendiges Ziel → keine Luecken', R(hm()).gaps.length === 0);
  ok('D4 Unsinn statt Objekt → wie kein Ziel', G.resolve({ goal: 'x' }).source === 'none' && G.resolve().source === 'none');
}

sec('E · DoD-Nachweis ueber planKey');
{
  const a = G.planKey(R(hm({ targetValue: 6600 })));
  const b = G.planKey(R(hm({ targetValue: 6000 })));
  ok('E1 gleiche Kategorie, andere Zielzeit ⇒ anderer Schluessel', a !== b, a + ' vs ' + b);
  ok('E2 gleiches Ziel ⇒ gleicher Schluessel (deterministisch)', G.planKey(R(hm())) === G.planKey(R(hm())));
  ok('E3 anderes Datum → andere Phase ⇒ anderer Schluessel', G.planKey(R(hm({ targetDate: '2026-09-13' }))) !== a);
  ok('E4 Kraftziel: Zielwert+Einheit im Schluessel', G.planKey(R(hm({ category: 'muscle_gain', metricType: 'weight', unit: 'kg', targetValue: 82 }))) !== G.planKey(R(hm({ category: 'muscle_gain', metricType: 'weight', unit: 'kg', targetValue: 85 }))));
  ok('E5 ohne Ziel: Schluessel nur aus Strichen, kein Absturz', /^-\|-\|-\|-\|-\|-$/.test(G.planKey(G.resolve({ goal: null }))));
}

sec('F · Schattenvergleich mit goalOf()-Form');
{
  const legacy = { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-10-11', targetMin: 110 };
  ok('F1 deckungsgleich', G.compareLegacy(R(hm()), legacy).same === true);
  ok('F2 Kraftziel vs. Lauf-Legacy → category + target_min', J(G.compareLegacy(R(hm({ category: 'muscle_gain', metricType: 'weight', unit: 'kg', targetValue: 82 })), legacy).diff) === J(['category', 'target_min']));
  ok('F3 beide ohne Zielzeit → kein Unterschied', G.compareLegacy(R(hm({ targetValue: null })), { type: 'half_marathon', raceDate: '2026-10-11', targetMin: null }).same === true);
  ok('F4 Legacy erfindet 110, Kanon hat nichts → Unterschied sichtbar', G.compareLegacy(R(hm({ targetValue: null })), legacy).diff.indexOf('target_min') >= 0);
}

sec('G · Paritaet mit ui.js RACE_DIST');
{
  const ui = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const m = ui.match(/const RACE_DIST=\{([^}]*)\}/);
  const pairs = m ? m[1].split(',').map(x => x.split(':')).map(([k, v]) => [k.trim(), +v]) : [];
  ok('G1 RACE_DIST in ui.js gefunden (4 Distanzen)', pairs.length === 4, String(pairs.length));
  ok('G2 jede Distanz identisch', pairs.every(([k, v]) => G.RUN_DIST_KM[k] === v) && Object.keys(G.RUN_DIST_KM).length === pairs.length, J(pairs));
}

sec('H · legacyForm (Form fuer die goalOf()-Aufrufer)');
{
  ok('H1 legacyForm ohne Hauptziel → null (Rueckfall gehoert dem Aufrufer)', G.legacyForm(G.resolve({ goal: null })) === null && G.legacyForm(null) === null);
  const lf = G.legacyForm(R(hm()));
  ok('H2 Felder wie goalOf(): type/distanceKm/raceDate/targetMin/priority/_canonicalId', lf.type === 'half_marathon' && lf.distanceKm === 21.0975 && lf.raceDate === '2026-10-11' && lf.targetMin === 110 && lf.priority === 'solide' && lf._canonicalId === 'g1');
  ok('H3 Leerwerte wie goalOf(): raceDate "" und targetMin null', (() => { const x = G.legacyForm(R(hm({ targetDate: null, targetValue: null }))); return x.raceDate === '' && x.targetMin === null; })());
  ok('H4 _planInput haengt an', lf._planInput && lf._planInput.version === G.VERSION);
  ok('H5 Ziel ohne Kategorie → null', G.legacyForm(G.resolve({ goal: { targetValue: 1 } })) === null);
}

console.log('\n' + (fail ? '❌' : '✅') + ' goal_plan_input: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
