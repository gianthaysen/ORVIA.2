/* ============================================================
   ORVIA · run_volume_seed — v8-400 (S3/P1)
   ------------------------------------------------------------
   Zwei Feldsaetze fuer dieselbe Groesse: Sport-Kit (sports[running].fields
   weeklyKm/longestRun/runDays — von niemandem gelesen) und Legacy-Wizard
   (typicalRunKm/recentRunsPerWeek/longestRunKm — stiller Seed in ui.js).
   Jetzt EIN Leser: Calc.runSeedHistory, Kit vor Legacy, und der Umfangs-
   rechner kennzeichnet ein Seed-Ergebnis als Selbstauskunft.

     A. runSeedHistory: Kit, Legacy, Vorrang, Leere, Robustheit
     B. calculateRecommendedWeeklyRunVolume: Seed ⇒ basis self_report,
        Konfidenz niedrig; Messung ⇒ measured; nichts ⇒ default
     C. Schema: desiredWeeklyKm weg, weeklyKm/longestRun/runDays bleiben
     D. ui.recommendedRunVolume ruft den einen Leser (Quelltext-Vertrag)

   node supabase/tests/run_volume_seed_test.mjs
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
const C = global.Calc, PM = global.ORVIA.profileModel;

sec('A · runSeedHistory');
{
  const kit = { sports: [{ sportId: 'running', role: 'primary', fields: { weeklyKm: 24, longestRun: 10, runDays: 3 } }] };
  const s = C.runSeedHistory(kit);
  ok('A1 Kit: typisch = 24/3 = 8 km, 3 Laeufe, laengster 10', s.source === 'kit' && s.typicalKm === 8 && s.runsPerWeek === 3 && s.longestKm === 10, JSON.stringify(s));
  ok('A2 Kit: 12 Seed-Laeufe (3×4 Wochen) + 1 Long Run, alle seed:true', s.hist.length === 13 && s.hist.every(h => h.seed === true) && s.hist.filter(h => h.sub === 'Long Run').length === 1);
  const leg = { typicalRunKm: 6, recentRunsPerWeek: 2, longestRunKm: 9 };
  const l = C.runSeedHistory(leg);
  ok('A3 Legacy: typisch 6, 2 Laeufe, laengster 9', l.source === 'legacy' && l.typicalKm === 6 && l.runsPerWeek === 2 && l.longestKm === 9 && l.hist.length === 9);
  const both = Object.assign({}, leg, kit);
  ok('A4 Kit gewinnt ueber Legacy', C.runSeedHistory(both).source === 'kit');
  ok('A5 Kit ohne runDays: Legacy-Laeufe/Woche, sonst 3', C.runSeedHistory({ sports: [{ sportId: 'running', fields: { weeklyKm: 30 } }], recentRunsPerWeek: 5 }).runsPerWeek === 5 && C.runSeedHistory({ sports: [{ sportId: 'running', fields: { weeklyKm: 30 } }] }).runsPerWeek === 3);
  ok('A6 laengster Lauf nur, wenn groesser als typisch', C.runSeedHistory({ sports: [{ sportId: 'running', fields: { weeklyKm: 30, runDays: 3, longestRun: 5 } }] }).longestKm === null);
  ok('A7 leer ⇒ keine Seeds, kein Throw', JSON.stringify(C.runSeedHistory({}).hist) === '[]' && C.runSeedHistory(null).source === null && C.runSeedHistory({ sports: 'x' }).source === null);
  ok('A8 Strings mit Komma ("24,5") werden gelesen; 0/negativ ignoriert', C.runSeedHistory({ sports: [{ sportId: 'running', fields: { weeklyKm: '24,5', runDays: 1 } }] }).typicalKm === 24.5 && C.runSeedHistory({ sports: [{ sportId: 'running', fields: { weeklyKm: 0 } }] }).source === null);
  ok('A9 desiredWeeklyKm wird NICHT gelesen (Aspiration ist keine Basis)', C.runSeedHistory({ sports: [{ sportId: 'running', fields: { desiredWeeklyKm: 80 } }] }).source === null);
}

sec('B · Kennzeichnung im Umfangsrechner');
{
  const prof = { sports: [{ sportId: 'running', role: 'primary', level: 'intermediate', fields: { weeklyKm: 24, longestRun: 10, runDays: 3 } }] };
  const seed = C.runSeedHistory(prof).hist;
  const r = C.calculateRecommendedWeeklyRunVolume(prof, seed, {});
  ok('B1 Seed ⇒ basis self_report, Konfidenz niedrig, Note nennt Selbstauskunft', r.basis === 'self_report' && r.confidence === 'niedrig' && /Selbstauskunft/.test(r.note), JSON.stringify([r.basis, r.confidence, r.note]));
  ok('B2 Seed-Umfang entspricht der Angabe (8 km × 3 = 24)', r.weeklyKm === 24 && r.runSessions === 3, JSON.stringify([r.weeklyKm, r.runSessions]));
  const meas = [5, 6, 5, 7, 6, 8].map(d => ({ dist: d }));
  const m = C.calculateRecommendedWeeklyRunVolume(prof, meas, {});
  ok('B3 Messung ⇒ basis measured, Konfidenz mittel', m.basis === 'measured' && m.confidence === 'mittel');
  const mixed = C.calculateRecommendedWeeklyRunVolume(prof, meas.concat(seed.slice(0, 2)), {});
  ok('B4 gemischt ⇒ zaehlt als Messung (nur reine Seeds sind Selbstauskunft)', mixed.basis === 'measured');
  const d = C.calculateRecommendedWeeklyRunVolume(prof, [], {});
  ok('B5 nichts ⇒ basis default, Konfidenz niedrig', d.basis === 'default' && d.confidence === 'niedrig');
}

sec('C · Schema');
{
  const sch = PM.sportSchema ? PM.sportSchema('running') : null;
  const src = rd('js/profile-model.js');
  const line = (src.match(/running: fieldSchema\('Laufen'[^\n]*/) || [''])[0];
  ok('C1 desiredWeeklyKm nicht mehr im Laufen-Kit', line.length > 0 && line.indexOf('desiredWeeklyKm') < 0);
  ok('C2 weeklyKm, longestRun, runDays bleiben (sie sind jetzt der Seed)', /'weeklyKm'/.test(line) && /'longestRun'/.test(line) && /'runDays'/.test(line));
}

sec('D · ui.recommendedRunVolume nutzt den einen Leser');
{
  const ui = rd('js/ui.js');
  const fn = (ui.match(/function recommendedRunVolume\(\)\{[\s\S]*?\n\}/) || [''])[0];
  ok('D1 ruft Calc.runSeedHistory', /Calc\.runSeedHistory\(prof\)/.test(fn));
  ok('D2 kein eigener Legacy-Seed mehr in ui.js', !/prof\.typicalRunKm/.test(fn));
  ok('D3 Seed nur unter 3 echten Laeufen', /length<3\)/.test(fn));
}

console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
