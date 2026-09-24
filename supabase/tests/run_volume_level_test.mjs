/* ============================================================
   ORVIA · run_volume_level — v8-396
   ------------------------------------------------------------
   Calc.calculateRecommendedWeeklyRunVolume las den Leistungsstand nur aus
   p.level mit dem Legacy-Vokabular. Das Onboarding v2 schreibt ihn nach
   sports[role=primary].level (beginner|intermediate|advanced|competitive).
   Folge: ein v2-Einsteiger ohne Lauf-Historie bekam den Mittelwert-Seed
   (12 km / 5 km / 3 Laeufe) statt des Einsteiger-Seeds (6 / 3 / 2).

     A. Seeds je Stand — Legacy- und v2-Schreibweise liefern dasselbe
     B. Alias-Tabelle byte-gleich mit profile-model.LEVEL_ALIASES
     C. Unbekannt/leer ⇒ konservativer Mittelwert, nie 'competitive'
     D. Mit Historie bleibt der Stand-Einfluss (Long-Run-Cap Einsteiger)

   node supabase/tests/run_volume_level_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

global.window = global;
(0, eval)(rd('js/calc.js'));
(0, eval)(rd('js/profile-model.js'));
const C = global.Calc, PM = (global.ORVIA && global.ORVIA.profileModel) || global.profileModel;
const vol = (p, hist) => C.calculateRecommendedWeeklyRunVolume(p, hist || [], {});
const seed = r => [r.weeklyKm, r.longRunKm, r.runSessions].join('/');

sec('A · Seeds je Stand, beide Schreibweisen');
{
  ok('A1 Einsteiger legacy = 6/3/2', seed(vol({ level: 'anfaenger' })) === '6/3/2', seed(vol({ level: 'anfaenger' })));
  ok('A2 Einsteiger v2 (sports.primary.level) = 6/3/2 — der eigentliche Defekt', seed(vol({ sports: [{ role: 'primary', level: 'beginner' }] })) === '6/3/2', seed(vol({ sports: [{ role: 'primary', level: 'beginner' }] })));
  ok('A3 Wiedereinstieg = Einsteiger', seed(vol({ level: 'wiedereinstieg' })) === '6/3/2');
  ok('A4 Wettkampf legacy (profi) = 25/8/4', seed(vol({ level: 'profi' })) === '25/8/4');
  ok('A5 Wettkampf v2 (competitive) = 25/8/4', seed(vol({ sports: [{ role: 'primary', level: 'competitive' }] })) === '25/8/4');
  ok('A6 advanced/intermediate = Mittelwert 12/5/3', seed(vol({ sports: [{ role: 'primary', level: 'advanced' }] })) === '12/5/3' && seed(vol({ level: 'intermediate' })) === '12/5/3');
  ok('A7 Hauptsportart gewinnt ueber p.level', seed(vol({ level: 'profi', sports: [{ role: 'primary', level: 'beginner' }, { role: 'secondary', level: 'competitive' }] })) === '6/3/2');
  ok('A8 Gross-/Kleinschreibung und Rand-Leerzeichen egal', C.runLevelOf({ level: ' Anfaenger ' }) === 'beginner');
}

sec('B · Alias-Tabelle deckungsgleich mit dem kanonischen Modell');
{
  const src = rd('js/profile-model.js');
  const m = src.match(/var LEVEL_ALIASES = \{([\s\S]*?)\};/);
  const canon = {}; (m ? m[1] : '').replace(/([\w'\\ä]+)\s*:\s*'(\w+)'/g, (_, k, v) => { canon[k.replace(/'/g, '').replace(/\\u00e4/g, 'ä')] = v; });
  const mine = Object.assign({}, C.RUN_LEVEL_ALIASES);
  const a = Object.keys(canon).sort(), b = Object.keys(mine).sort();
  ok('B1 gleiche Schluesselmenge', JSON.stringify(a) === JSON.stringify(b), 'canon=' + a.join(',') + ' | calc=' + b.join(','));
  ok('B2 gleiche Zuordnung', a.every(k => canon[k] === mine[k]));
  if (PM && PM.normalizeLevelKey) ok('B3 Laufzeit: normalizeLevelKey und runLevelOf stimmen fuer jeden Alias ueberein', a.every(k => PM.normalizeLevelKey(k) === C.runLevelOf({ level: k })));
}

sec('C · Unbekannt ⇒ konservativ');
{
  ok('C1 leeres Profil ⇒ Mittelwert, nicht Wettkampf', seed(vol({})) === '12/5/3');
  ok('C2 unbekannter Wert ⇒ null ⇒ Mittelwert', C.runLevelOf({ level: 'weltklasse' }) === null && seed(vol({ level: 'weltklasse' })) === '12/5/3');
  ok('C3 sports ohne primary ⇒ p.level', C.runLevelOf({ sports: [{ role: 'secondary', level: 'competitive' }], level: 'anfaenger' }) === 'beginner');
  ok('C4 kein Throw bei kaputten Strukturen', (() => { try { C.runLevelOf({ sports: 'x' }); C.runLevelOf({ sports: [null, 3] }); return true; } catch (e) { return false; } })());
}

sec('D · Mit Historie wirkt der Stand weiterhin');
{
  const hist = [5, 5, 6, 5, 7, 5].map(d => ({ dist: d }));
  const b = vol({ sports: [{ role: 'primary', level: 'beginner' }] }, hist);
  const i = vol({ sports: [{ role: 'primary', level: 'intermediate' }] }, hist);
  ok('D1 Einsteiger: 2 Laeufe/Woche, Long Run gedeckelt (typ*1.3 bzw. typ+3)', b.runSessions === 2 && b.longRunKm <= 5.5 * 1.3 + 1e-9, JSON.stringify([b.runSessions, b.longRunKm]));
  ok('D2 Mittelwert: 3 Laeufe/Woche, mehr Umfang als Einsteiger', i.runSessions === 3 && i.weeklyKm > b.weeklyKm, JSON.stringify([i.weeklyKm, b.weeklyKm]));
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
