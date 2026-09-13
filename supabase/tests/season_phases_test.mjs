/* ORVIA · engine/season-phases — Saisonphasen mit Wochen (S1c, 13.09.2026)
   node supabase/tests/season_phases_test.mjs */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const APP = ['../../app/', '../../'].map(p => new URL(p, import.meta.url)).find(u => existsSync(new URL('js/engine/season-phases.js', u)));
const S = require(new URL('js/engine/season-phases.js', APP).pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const a = S.allocate(52);
ok('52 Wochen: Tapering 2, Spitze 4, Rest 46 → Basis 21 / Aufbau 25', JSON.stringify(a.map(p => [p.key, p.weeks])) === JSON.stringify([['base', 21], ['build', 25], ['peak', 4], ['taper', 2]]));
ok('12 Wochen: Tapering 2, Spitze 3, Basis 3 / Aufbau 4', JSON.stringify(S.allocate(12).map(p => p.weeks)) === JSON.stringify([3, 4, 3, 2]));
ok('7 Wochen: Tapering 1, Spitze 2, nur Aufbau 4 (kein Basis unter 5 Restwochen)', JSON.stringify(S.allocate(7).map(p => [p.key, p.weeks])) === JSON.stringify([['build', 4], ['peak', 2], ['taper', 1]]));
ok('3 Wochen: nur Aufbau', JSON.stringify(S.allocate(3).map(p => p.key)) === JSON.stringify(['build']));

const m = S.seasonPhases('2027-09-05', '2026-09-13', { startDate: '2026-09-12' });
ok('Marathon 05.09.2027 ab 12.09.2026: 52 Wochen, 357 Tage, aktuelle Phase Basis Woche 1 von 21', m.totalWeeks === 52 && m.daysToRace === 357 && m.current.key === 'base' && m.current.week === 1 && m.current.weeks === 21);
ok('Phasen luecken- und ueberlappungsfrei, letzte endet am Renntag', m.phases.every((p, i) => i === 0 || new Date(p.from) - new Date(m.phases[i - 1].to) === 864e5) && m.phases[m.phases.length - 1].to === '2027-09-05');
const h = S.seasonPhases('2026-10-18', '2026-09-13', { startDate: '2026-07-26' });
ok('HM 18.10. ab 26.07.: Aufbau Woche 4 von 4 aktiv, Basis fertig, Spitze/Tapering offen', h.current.key === 'build' && h.current.week === 4 && h.phases[0].done === true && h.phases[2].done === false);
ok('Planstart in der Zukunft wird auf heute gekappt; ohne Start = heute', S.seasonPhases('2026-12-01', '2026-09-13', { startDate: '2026-10-01' }).startDate === '2026-09-13' && S.seasonPhases('2026-12-01', '2026-09-13').startDate === '2026-09-13');
ok('Vergangenes oder fehlendes Zieldatum ⇒ null', S.seasonPhases('2026-09-01', '2026-09-13') === null && S.seasonPhases(null, '2026-09-13') === null);
ok('Renntag selbst: aktuelle Phase ist die letzte (Tapering), Woche = Dauer', (() => { const r = S.seasonPhases('2026-09-13', '2026-09-13', { startDate: '2026-06-01' }); return r.current.key === 'taper' && r.current.week === r.current.weeks; })());
console.log('\nseason_phases: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
