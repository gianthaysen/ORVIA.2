/* ORVIA · Phase 4.2 E2 — Dynamische Trainingsphasen aus dem Wettkampfdatum (sportübergreifend).
   node supabase/tests/race_phases_phase42_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
(0, eval)(fs.readFileSync(new URL('../../js/calc.js', import.meta.url), 'utf8'));
const RP = globalThis.Calc.racePhases;
const RACE = '2026-09-06';

ok('kein Datum → leer', Array.isArray(RP('')) && RP('').length === 0 && RP(null).length === 0);
ok('ungültiges Datum → leer', RP('2026-13-40').length === 0 || RP('quatsch').length === 0);

const p = RP(RACE, '2026-07-01');
ok('vier Phasen', p.length === 4 && p.map(x => x.n).join(',') === 'Aufbau,Peak,Taper,Wettkampf');
ok('Renntag from===to===Renndatum', p[3].from === RACE && p[3].to === RACE);
ok('Aufbau ohne Startdatum (offen)', p[0].from === null && p[0].to < p[1].from);
ok('Reihenfolge konsistent', p[1].from <= p[1].to && p[1].to < p[2].from && p[2].to < p[3].from);

// 'on' je nach heutigem Datum
const taperDay = RP(RACE, '2026-08-30');   // ~7 Tage vor Rennen → Taper
ok('heute in Taper → Taper aktiv', taperDay.find(x => x.n === 'Taper').on === true && !taperDay.find(x => x.n === 'Aufbau').on);
const early = RP(RACE, '2026-06-01');       // weit vorher → Aufbau
ok('weit vor Rennen → Aufbau aktiv', early.find(x => x.n === 'Aufbau').on === true);
const raceDay = RP(RACE, RACE);
ok('Renntag → Wettkampf aktiv', raceDay.find(x => x.n === 'Wettkampf').on === true);
const after = RP(RACE, '2026-09-20');
ok('nach Rennen → keine Phase aktiv', after.every(x => !x.on));

// funktioniert für beliebiges Ziel/Datum (z.B. Ironman 2028)
const im = RP('2028-07-15', '2028-06-01');
ok('beliebiges Wettkampfdatum (IM 2028) → 4 Phasen', im.length === 4 && im[3].from === '2028-07-15');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
process.exit(fail ? 1 : 0);
