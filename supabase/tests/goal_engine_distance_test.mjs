/* ============================================================
   ORVIA · goal_engine_distance — B-01 Vorarbeit (Calc.goalEngine)
   ------------------------------------------------------------
   Befund 03.09.2026: goalEngine prognostizierte IMMER eine Halbmarathon-Zeit
   (riegelHM) und hielt sie gegen die Zielzeit jeder Laufdistanz. Jetzt nimmt
   es opts.distanceKm; ohne die Angabe bleibt alles wie bisher.

     A. Bestandsschutz: ohne distanceKm byteweise wie HM
     B. Zieldistanz steuert die Prognose (Riegel auf die Zieldistanz)
     C. Zustand plausibel je Distanz — gleiche Laeufe, andere Ziele
     D. Long-Run-Bedarf skaliert mit der Distanz (HM 14/17 km unveraendert)
     E. Unsinn-Distanz ⇒ HM (kein NaN, kein 0)

   node supabase/tests/goal_engine_distance_test.mjs
   ============================================================ */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js', 'calc.js'))) || _flat);
global.window = undefined;
const C = require(join(APP, 'js/calc.js'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = x => JSON.stringify(x);

const runs = []; for (let w = 0; w < 6; w++) runs.push({ dist: 8, dur: 38, sub: 'Tempo' }, { dist: 16, dur: 88, sub: 'Long Run' }, { dist: 6, dur: 36, sub: 'Easy Z2' });
const base = { daysToRace: 60, avg4WeekKm: 30, targetWeekKm: 30, lrMax28: 16, trackingWeeks: 8, loadConfidence: 'hoch' };
const GE = o => C.goalEngine(runs, Object.assign({}, base, o));

sec('A · Bestandsschutz');
{
  const a = GE({ targetMin: 110 }), b = GE({ targetMin: 110, distanceKm: 21.0975 });
  ok('A1 ohne distanceKm = HM (21,0975)', a.distanceKm === 21.0975);
  ok('A2 Prognose wie bisher (106,2)', a.tPred === 106.2 && a.tRiegel === 106.2, String(a.tPred));
  const { distanceKm: _d1, ...ra } = a; const { distanceKm: _d2, ...rb } = b;
  ok('A3 explizit HM = implizit HM (byteweise)', J(ra) === J(rb));
  ok('A4 riegelHM weiterhin exportiert und identisch zu riegel(…,HM)', C.riegelHM(8, 38) === C.riegel(8, 38, 21.0975));
}

sec('B · Zieldistanz steuert die Prognose');
{
  const k10 = GE({ targetMin: 50, distanceKm: 10 }), m = GE({ targetMin: 240, distanceKm: 42.195 });
  ok('B1 10 km: Prognose ≈ 48 min (Riegel 1,06)', Math.abs(k10.tPred - 48.1) < 0.2, String(k10.tPred));
  ok('B2 Marathon: Prognose ≈ 221,5 min', Math.abs(m.tPred - 221.5) < 0.2, String(m.tPred));
  ok('B3 Reihenfolge 10k < HM < M', k10.tPred < GE({ targetMin: 110 }).tPred && GE({ targetMin: 110 }).tPred < m.tPred);
  ok('B4 distanceKm wird zurueckgegeben', k10.distanceKm === 10 && m.distanceKm === 42.195);
}

sec('C · Zustand plausibel je Distanz');
{
  ok('C1 10 km 50 min bei ~48-min-Form ⇒ ontrack (vorher: risk)', GE({ targetMin: 50, distanceKm: 10 }).state === 'ontrack');
  ok('C2 10 km 45 min ⇒ risk', GE({ targetMin: 45, distanceKm: 10 }).state === 'risk');
  ok('C3 Marathon 3:30 bei ~3:41-Form ⇒ risk (vorher: ontrack)', GE({ targetMin: 210, distanceKm: 42.195 }).state === 'risk');
  ok('C4 gleiche Laeufe, gleiche Zielzeit 110, andere Distanz ⇒ anderer Zustand', GE({ targetMin: 110, distanceKm: 10 }).state !== GE({ targetMin: 110, distanceKm: 42.195 }).state);
}

sec('D · Long-Run-Bedarf');
{
  ok('D1 HM: 14 km bei >28 Tagen, 17 km bei 15–28 (unveraendert)', GE({ targetMin: 110, lrMax28: 13 }).vetos.some(v => /≥14 km/.test(v)) && GE({ targetMin: 110, lrMax28: 16, daysToRace: 20 }).vetos.some(v => /≥17 km/.test(v)));
  ok('D2 Marathon: 28 km noetig', GE({ targetMin: 240, distanceKm: 42.195, lrMax28: 16 }).vetos.some(v => /≥28 km/.test(v)));
  ok('D3 10 km: 7 km reichen — 16 km ⇒ kein Long-Run-Veto', !GE({ targetMin: 50, distanceKm: 10, lrMax28: 16 }).vetos.some(v => /Long Run/.test(v)));
  ok('D4 10 km mit 6 km Long ⇒ Veto ≥7 km', GE({ targetMin: 50, distanceKm: 10, lrMax28: 6 }).vetos.some(v => /≥7 km/.test(v)));
}

sec('E · Unsinn');
{
  ok('E1 distanceKm 0/negativ/NaN/String ⇒ HM', [0, -5, NaN, 'x', null].every(d => GE({ targetMin: 110, distanceKm: d }).distanceKm === 21.0975));
  ok('E2 kein NaN in der Prognose', [0, NaN, 'x'].every(d => isFinite(GE({ targetMin: 110, distanceKm: d }).tPred)));
}

console.log('\n' + (fail ? '❌' : '✅') + ' goal_engine_distance: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
