/* ORVIA · S1/E1 (12.09.2026) — Bestzeiten je Sport und Standarddistanz (run-bests.js).
   Befund Produktionskonto: HM 21,1 km, Rad 20 km, Schwimmen 400 m wurden nie erkannt. */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const MOD = ['../../app/js/run-bests.js', '../../js/run-bests.js'].map(p => new URL(p, import.meta.url)).find(u => existsSync(u));
const RB = require(MOD.pathname);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const act = (id, sport, km, sec, date, extra) => Object.assign({ clientRecordId: id, sportId: sport, status: 'completed', startedAt: date + 'T08:00:00Z', summary: { distance_m: km * 1000 }, durationSeconds: sec }, extra || {});

/* A · Laufen kennt jetzt 21,1 und 42,2 km */
{
  ok('A1 SPORT_TARGETS: running 1/5/10/21,1/42,2', RB.SPORT_TARGETS.running.map(t => t.key).join(',') === 'k1,k5,k10,k21,k42');
  const hm = act('hm', 'running', 21.18, 6730, '2026-09-06');            // Flensburg: 21,18 km in 1:52:10
  const r = RB.measuredRunBests([hm]);
  ok('A2 Halbmarathon als Gesamtaktivitaet erkannt (21,18 km liegt im 5-%-Fenster)', r.k21 && r.k21.sec === 6730 && r.k21.method === 'activity_total', JSON.stringify(r.k21));
  ok('A3 … mit Datum und Aktivitaets-ID', r.k21.date === '2026-09-06' && r.k21.activityId === 'hm');
  ok('A4 kein 10-km-Wert aus dem HM ohne Runden (keine Hochrechnung)', r.k10 === null);
  const withLaps = act('hm2', 'running', 21.18, 6730, '2026-09-06', { metrics: { splits: Array.from({ length: 21 }, (_, i) => ({ distance: 1000, duration: 318 })).concat([{ distance: 180, duration: 52 }]) } });
  const r2 = RB.measuredRunBests([withLaps]);
  ok('A5 mit Runden: 10 km aus Rundenfenster (3180 s), HM aus Runden 21,18 km', r2.k10 && r2.k10.sec === 3180 && r2.k10.method === 'lap_window' && r2.k21 && r2.k21.method === 'lap_window');
  ok('A6 Marathon bleibt null (nie gelaufen)', r2.k42 === null);
  ok('A7 alter Vertrag: k1/k5/k10 weiterhin im Ergebnis', 'k1' in r2 && 'k5' in r2 && 'k10' in r2);
}
/* B · Rad und Schwimmen */
{
  const bike = act('b1', 'cycling', 20.4, 2400, '2026-08-30');
  const bike2 = act('b2', 'cycling', 41.2, 4700, '2026-08-20');
  const swim = act('s1', 'swimming', 0.41, 540, '2026-09-01');
  const all = RB.measuredAllBests([bike, bike2, swim, act('r', 'running', 5.1, 1500, '2026-08-01')]);
  ok('B1 Rad 20 km aus 20,4-km-Fahrt (2400 s)', all.cycling.k20 && all.cycling.k20.sec === 2400 && all.cycling.k20.activityId === 'b1', JSON.stringify(all.cycling.k20));
  ok('B2 Rad 40 km aus 41,2-km-Fahrt; 90/180 leer', all.cycling.k40 && all.cycling.k40.sec === 4700 && all.cycling.k90 === null && all.cycling.k180 === null);
  ok('B3 die 41-km-Fahrt liefert KEINE 20-km-Zeit ohne Runden (kein Hochrechnen nach unten)', all.cycling.k20.activityId !== 'b2');
  ok('B4 Schwimmen 400 m aus 410 m (540 s)', all.swimming.m400 && all.swimming.m400.sec === 540, JSON.stringify(all.swimming.m400));
  ok('B5 Laufen im Gesamtergebnis, 5 km erkannt', all.running.k5 && all.running.k5.sec === 1500);
  ok('B6 Sportarten sauber getrennt: Rad-Fahrt zaehlt nicht als Lauf', all.running.k20 === undefined && all.running.k21 === null);
  ok('B7 Rueckgabe traegt den Sport', all.cycling.sport === 'cycling' && all.swimming.sport === 'swimming');
}
/* C · Sportfamilie */
{
  ok('C1 sportFamily: running/cycling/swimming; gym ⇒ null', RB.sportFamily({ sportId: 'running' }) === 'running' && RB.sportFamily({ sportId: 'cycling' }) === 'cycling' && RB.sportFamily({ sportId: 'swimming' }) === 'swimming' && RB.sportFamily({ sportId: 'gym' }) === null);
  ok('C2 unbekannter Sport ⇒ keine Bestzeit, kein Fehler', RB.measuredBests([act('x', 'padel', 20, 100, '2026-01-01')], { sport: 'cycling' }).scanned === 0);
}
console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
