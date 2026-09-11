/* ORVIA · goal_phase_plan — B-01 Schritt 5: Zielphase → Wochenplan (rein)
   node supabase/tests/goal_phase_plan_test.mjs */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'engine', 'goal-phase-plan.js'))) || _flat);
const P = require(join(APP, 'js/engine/goal-phase-plan.js'));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);
const R = (l, d) => ({ t: 'Laufen', l, d }), G = l => ({ t: 'Gym', l, d: '45 min' }), B = (l, d) => ({ t: 'Rad', l, d }), M = () => ({ t: 'Mobilität', l: 'Mobility', d: '15 min' });
const week = () => [[G('Oberkörper')], [R('Intervalle', 'iv')], [G('Ganzkörper')], [R('Z2 Dauerlauf', 'ez')], [G('Oberkörper')], [B('Long Ride', '2–3 h')], [R('Long Run', 'lr')]];
const labels = w => w.map(d => d.map(i => i.l).join('+')).join(' | ');
/* 2026-09-03 ist ein Donnerstag (Index 3); Woche Mo 31.08. – So 06.09. */
const TODAY = '2026-09-03';

sec('A · Bestandsschutz');
{
  const w = week();
  ok('A1 build → unveraendert, changed false, gleiche Referenz', P.applyPhase(w, { phase: 'build', family: 'run' }).days === w && P.applyPhase(w, { phase: 'build', family: 'run' }).changed === false);
  ok('A2 past / null / unbekannt → unveraendert', ['past', null, 'x'].every(ph => P.applyPhase(w, { phase: ph, family: 'run' }).days === w));
  ok('A3 Kraftziel in Rennwoche → unveraendert (kein Rennen)', P.applyPhase(w, { phase: 'race_week', family: 'strength', targetDate: '2026-09-06', today: TODAY }).days === w);
  ok('A4 Eingabe wird nie mutiert', (() => { const w2 = week(); const s = J(w2); P.applyPhase(w2, { phase: 'race_week', family: 'run', targetDate: '2026-09-06', today: TODAY }); return J(w2) === s; })());
  ok('A5 Unsinn (kein Array / 6 Tage) → unveraendert', P.applyPhase(null, { phase: 'taper', family: 'run' }).days === null && P.applyPhase([[], []], { phase: 'taper', family: 'run' }).changed === false);
}

sec('B · Taper');
{
  const r = P.applyPhase(week(), { phase: 'taper', family: 'run' });
  ok('B1 Struktur bleibt: 7 Tage, gleiche Einheitenzahl, keine Loecher', r.days.every((d, i) => d.length === week()[i].length && d.every(Boolean)));
  ok('B2 Long Run → „Long Run · Taper" (Schluesselwort bleibt)', (r.days[6][0] || {}).l === 'Long Run · Taper' && (r.days[6][0] || {}).d === 'lr');
  ok('B3 Intervalle → kurz, Pace-Schluessel bleibt iv', r.days[1][0].l === 'Intervalle · kurz' && r.days[1][0].d === 'iv');
  ok('B4 Z2 unveraendert', r.days[3][0] === week()[3][0] || J(r.days[3][0]) === J(week()[3][0]));
  ok('B5 Gym → leicht, bleibt Gym', r.days[0][0].l === 'Oberkörper · leicht' && r.days[0][0].t === 'Gym');
  ok('B6 Long Ride → Taper 60–90 min', r.days[5][0].l === 'Long Ride · Taper' && r.days[5][0].d === '60–90 min');
  ok('B7 changes protokolliert (6), phaseAdjusted markiert', r.changes.length === 6 && r.changed && r.days[6][0].phaseAdjusted === true);
}

sec('C · Rennwoche');
{
  const r = P.applyPhase(week(), { phase: 'race_week', family: 'run', targetDate: '2026-09-06', today: TODAY, pacePerKmSec: 313 });
  ok('C1 Renntag So: Wettkampf mit Zielpace', r.days[6].length === 1 && r.days[6][0].l === 'Wettkampf' && r.days[6][0].d === '5:13 /km · Zielpace' && r.days[6][0].race === true, labels(r.days));
  ok('C2 Vortag frei', r.days[5].length === 0);
  ok('C3 Long Run weg, eine Intervalleinheit → Anschwitzen', !labels(r.days).includes('Long Run') && r.days[1][0].l === 'Anschwitzen' && r.days[1][0].d === 'iv');
  ok('C4 Gym → Mobility', r.days[0][0].t === 'Mobilität' && r.days[2][0].t === 'Mobilität');
  ok('C5 Z2 bleibt', r.days[3][0].l === 'Z2 Dauerlauf');
  const mid = P.applyPhase(week(), { phase: 'race_week', family: 'run', targetDate: '2026-09-04', today: TODAY });
  ok('C6 Renntag Fr: Do frei, Sa/So frei, Mo–Mi bleiben', mid.days[4][0].l === 'Wettkampf' && mid.days[3].length === 0 && mid.days[5].length === 0 && mid.days[6].length === 0 && mid.days[1][0].l === 'Anschwitzen', labels(mid.days));
  ok('C7 ohne Pace: „Zielpace"', mid.days[4][0].d === 'Zielpace');
  const next = P.applyPhase(week(), { phase: 'race_week', family: 'run', targetDate: '2026-09-08', today: TODAY });
  ok('C8 Rennen naechste Woche (5 Tage, aber ausserhalb dieser Woche): Rennwoche-Struktur, kein Wettkampf-Tag', !labels(next.days).includes('Wettkampf') && !labels(next.days).includes('Long Run'));
  ok('C9 zwei Intervalle → nur die erste bleibt', (() => { const w = week(); w[3] = [R('Intervalle', 'iv')]; const x = P.applyPhase(w, { phase: 'race_week', family: 'run', targetDate: '2026-09-06', today: TODAY }); return x.days[1][0].l === 'Anschwitzen' && x.days[3].length === 0; })());
  ok('C10 Radziel: Wettkampf ist Rad, Long Ride weg', (() => { const x = P.applyPhase(week(), { phase: 'race_week', family: 'bike', targetDate: '2026-09-06', today: TODAY }); return x.days[6][0].t === 'Rad' && !labels(x.days).includes('Long Ride'); })());
}

sec('D · raceDayIndex');
{
  ok('D1 So 06.09. in Woche von Do 03.09. → 6', P.raceDayIndex('2026-09-06', TODAY) === 6);
  ok('D2 Mo 31.08. → 0; Di 08.09. → null; Sa 29.08. → null', P.raceDayIndex('2026-08-31', TODAY) === 0 && P.raceDayIndex('2026-09-08', TODAY) === null && P.raceDayIndex('2026-08-29', TODAY) === null);
  ok('D3 kaputt → null', P.raceDayIndex('x', TODAY) === null && P.raceDayIndex(null, TODAY) === null);
}
console.log('\n' + (fail ? '❌' : '✅') + ' goal_phase_plan: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
