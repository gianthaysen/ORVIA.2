/* ============================================================
   ORVIA · performance_ledger_reconcile (v8-448C) — Abgleich bisherige Laufbestzeiten ↔ Leistungsregister
   auf den ECHTEN Zahlen des Produktions-Probelaufs vom 16.10.2026 (Diagnose 448C-diag-1, Kennungen ersetzt).

   Befund je Abweichung:
     1 km   4:24 → 4:21  dieselbe Aktivitaet (29.07.); bisher Anzeige-Reihe (273 Punkte), Register alle 2175 Zeilen
     5 km  23:39 → 29:11  bisher 'activity_total' mit TIMER-Dauer 1418 s des Laufs vom 13.08. — verstrichen 1997 s
                          (9:39 angehaltene Pause). Am Stueck schnellste 5 km: 29:11 im Halbmarathon (06.09.)
     10 km 57:55 → 1:01:49 dasselbe am 15.07.: Timer 3475 s, verstrichen 4398 s (15:23 Pause)
     HM 2:21:08 → 2:20:47 dieselbe Aktivitaet (06.09.); bisher 296 Punkte, Register alle 8533 Zeilen

   R  run-bests (bisherige Anzeige, live solange das Flag aus ist): Gesamtzeit = verstrichene Zeit
   L  Register: Werte und Urteile auf den Echtdaten
   C  Probelauf-Vergleich: Ursache je Distanz, Server-Kennung statt clientRecordId
   K  Bestand: gekoppelte Aufzeichnungen (Kraft), Runden mit Timer- vs. verstrichener Zeit, manuelle Korrektur
   ============================================================ */
import fs from 'fs';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js',
  'js/activity-effective.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/feature-flags.js', 'js/engine/records-bridge.js', 'js/performance-ledger-store.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger, RB = O.runBests, BR = O.recordsBridge, AE = O.activityEffective, PB = O.pbSync;
const TZ = 'Europe/Berlin';
const uuid = i => '10000000-0000-4000-8000-' + String(i).padStart(12, '0');

/* Garmin-Lauf aus den Diagnosewerten. pts = Anzeige-Reihe [[t, d], …] (verstrichene Sekunden, kumulative Meter). */
function realRun(i, o) {
  const a = GEN.referenceActivity('running', 'best');
  a.id = uuid(i); a.clientRecordId = 'act:3169' + i;                      // run-bests nennt clientRecordId vor id
  a.startedAt = o.gmt.replace('Z', '.000Z');
  const g = a.metrics.garmin;
  g.start_gmt = o.gmt; g.start_local = o.local; g.timer_duration_s = o.timer; g.elapsed_duration_s = o.elapsed; g.moving_duration_s = o.moving;
  g.stream_rows = o.rows; g.stream_total = o.rows;
  a.durationSeconds = o.dur; a.summary = { distanceM: o.distM, distanceKm: o.distM / 1000 };
  a.metrics.streams = { time: o.pts.map(p => p[0]), distance: o.pts.map(p => p[1]) };
  const be = a.metrics.best_efforts; be.rows = o.rows; be.total = o.rows; be.native = true;
  be.distance = { v: 1, basis: 'elapsed', status: 'ok', total_m: o.total_m, targets: {} };
  for (const t of [400, 1000, 5000, 10000, 21098, 42195]) be.distance.targets[String(t)] = o.targets[t] || { q: 'too_short' };
  delete be.power; delete be.stats;
  return a;
}
const M = (s, over, at) => ({ s, over_m: over, at, q: 'measured' });
/* 13.08. 18:17 · 5006 m · Timer 1418 s · verstrichen 1997 s */
const R0813 = realRun(1, { gmt: '2026-08-13T16:17:26Z', local: '2026-08-13T18:17:26', dur: 1419, timer: 1418, elapsed: 1997, moving: 1416, distM: 5006, rows: 1423, total_m: 5005.2,
  pts: [[0, 0.57], [142, 600], [700, 2600], [1300, 2610], [1997, 5005.73]], targets: { 400: M(110, 0.5, 142), 1000: M(279, 0.9, 142), 5000: M(1995, 1, 0) } });
/* 15.07. 18:18 · 10041 m · Timer 3475 s · verstrichen 4398 s */
const R0715 = realRun(2, { gmt: '2026-07-15T16:18:08Z', local: '2026-07-15T18:18:08', dur: 3475, timer: 3475, elapsed: 4398, moving: 3471, distM: 10041, rows: 3493, total_m: 10039.9,
  pts: [[0, 0.63], [4398, 10040.54]], targets: { 400: M(130, 0.2, 4067), 1000: M(329, 0.1, 4067), 5000: M(2161, 2.1, 1), 10000: M(4385, 1.2, 1) } });
/* 06.09. 09:15 · Halbmarathon 21177 m · Timer = verstrichen 8532 s */
const R0906 = realRun(3, { gmt: '2026-09-06T07:15:11Z', local: '2026-09-06T09:15:11', dur: 8532, timer: 8532, elapsed: 8532, moving: 8369, distM: 21177, rows: 8533, total_m: 21175.6,
  pts: [[0, 1.46], [15, 8.0], [1784, 5058.0], [3727, 10020.0], [8483, 21160.0], [8532, 21177.06]],
  targets: { 400: M(120, 0, 183), 1000: M(328, 0, 183), 5000: M(1751, 0, 15), 10000: M(3709, 1.7, 0), 21098: M(8447, 0.6, 9) } });
/* 29.07. 20:16 · 5503 m · Timer 2171 s · verstrichen 2211 s */
const R0729 = realRun(4, { gmt: '2026-07-29T18:16:39Z', local: '2026-07-29T20:16:39', dur: 2171, timer: 2171, elapsed: 2211, moving: 2165, distM: 5503, rows: 2175, total_m: 5500.9,
  pts: [[0, 1.61], [1, 4.0], [265, 1004.0], [2211, 5502.53]], targets: { 400: M(100, 0.2, 744), 1000: M(261, 1.2, 744), 5000: M(1996, 0.6, 1) } });
const RUNS = [R0813, R0715, R0906, R0729];

sec('R · bisherige Anzeige (run-bests): Gesamtzeit = verstrichene Zeit');
{
  const one = a => RB.measuredBestsLegacy([a], { sport: 'running' });
  const r1 = one(R0813), r2 = one(R0715);
  ok('R1 13.08.: 5 km nicht mehr 23:39 (Timer ohne 9:39 Pause), sondern verstrichen 1997 s', r1.k5 && r1.k5.sec === 1997, J(r1.k5));
  const bare = JSON.parse(JSON.stringify(R0813)); bare.metrics.streams = {};
  const r1b = one(bare);
  ok('R1b Gesamtaktivitaet allein (ohne Messreihe): activity_total mit verstrichener Zeit', r1b.k5 && r1b.k5.method === 'activity_total' && r1b.k5.sec === 1997 && r1b.k5.timeBasis === 'elapsed', J(r1b.k5));
  ok('R2 15.07.: 10 km nicht mehr 57:55, sondern verstrichen 4398 s', r2.k10 && r2.k10.sec === 4398 && r2.k10.sec !== 3475, J(r2.k10));
  const all = RB.measuredBestsLegacy(RUNS, { sport: 'running' });
  ok('R3 bestes 5 km bisherige Rechnung jetzt am Stueck: 29:29 im Halbmarathon (Anzeige-Reihe)', all.k5.sec === 1769 && all.k5.activityId === R0906.clientRecordId, J(all.k5));
  ok('R4 bestes 10 km bisherige Rechnung: 1:01:52 im Halbmarathon', all.k10.sec === 3712 && all.k10.activityId === R0906.clientRecordId, J(all.k10));
  ok('R5 1 km und Halbmarathon unveraendert (Messreihen-Fenster waren schon verstrichene Zeit)', all.k1.sec === 264 && all.k21.sec === 8468, all.k1.sec + ' / ' + all.k21.sec);
  ok('R6 totalTimeOf: Garmin = elapsed_duration_s, eigene Eingabe = Dauer der Zeile',
    RB.totalTimeOf(R0813).basis === 'elapsed' && RB.totalTimeOf({ source: 'manual', durationSeconds: 1500 }).basis === 'duration' && RB.totalTimeOf({ source: 'manual', durationSeconds: 1500 }).sec === 1500);
  const noEl = JSON.parse(JSON.stringify(R0813)); delete noEl.metrics.garmin.elapsed_duration_s;
  ok('R7 Garmin ohne verstrichene Zeit (Altbestand): Timer bleibt, aber benannt', RB.totalTimeOf(noEl).basis === 'timer' && RB.totalTimeOf(noEl).sec === 1419);
  const weird = JSON.parse(JSON.stringify(R0813)); weird.metrics.garmin.elapsed_duration_s = 900;
  ok('R8 widersinnige verstrichene Zeit (< Timer) wird nicht genommen', RB.totalTimeOf(weird).basis === 'timer');
  const pbs = PB.entries({ running: all });
  ok('R9 Profil-Bestzeiten (pb-sync) bekommen die Zeit am Stueck: 5 km 1769 s statt 1419 s', pbs.find(e => e.extra.targetKey === 'k5').timeSeconds === 1769);
}

sec('L · Register auf den Echtdaten');
{
  const st = L.update(null, RUNS, { timeZone: TZ }).state;
  const best = t => L.currentBest(st.events['running.fastest_' + t + 'm@standard']);
  ok('L1 1 km 4:21 am 29.07. (alle 2175 Messzeilen)', best(1000).value === 261 && best(1000).activityId === R0729.id && best(1000).localDate === '2026-07-29');
  ok('L2 5 km 29:11 am 06.09. (am Stueck, Halbmarathon ab Sekunde 15)', best(5000).value === 1751 && best(5000).activityId === R0906.id);
  ok('L3 10 km 1:01:49 am 06.09.', best(10000).value === 3709 && best(10000).activityId === R0906.id);
  ok('L4 Halbmarathon 2:20:47 am 06.09.', best(21098).value === 8447 && best(21098).activityId === R0906.id);
  const e13 = L.entryOf(st, R0813.id, 'running.fastest_5000m'), e15 = L.entryOf(st, R0715.id, 'running.fastest_10000m');
  ok('L5 13.08. ist nicht gesperrt: 5 km freigegeben mit 1995 s (verstrichen) — nur langsamer als 06.09.', e13.eligibility === 'eligible' && e13.value === 1995 && e13.contextClass === 'standard', J([e13.eligibility, e13.value]));
  ok('L6 15.07. ist nicht gesperrt: 10 km freigegeben mit 4385 s', e15.eligibility === 'eligible' && e15.value === 4385);
  ok('L7 Dauer-Rekord bleibt Timer-Dauer (Dauer der Einheit, keine Bestzeit)', L.entryOf(st, R0715.id, 'running.longest_duration').value === 3475);
  ok('L8 alle vier Laeufe im Register, keine doppelt', Object.keys(st.activities).length === 4);
}

sec('C · Probelauf-Vergleich mit Ursache');
{
  const st = L.update(null, RUNS, { timeZone: TZ }).state;
  const cmp = BR.compareWithLegacy(st, RUNS).running, by = k => cmp.find(x => x.key === k);
  ok('C1 1 km: abweichend, Ursache genauer (dieselbe Aktivitaet, mehr Messzeilen)', by('k1').verdict === 'abweichend' && by('k1').cause === 'genauer', J(by('k1')));
  ok('C2 5 km: genauer (bisherige Rechnung findet jetzt dieselbe Aktivitaet)', by('k5').cause === 'genauer' && by('k5').bisher.sec === 1769, J(by('k5')));
  ok('C3 10 km und HM: genauer', by('k10').cause === 'genauer' && by('k21').cause === 'genauer');
  ok('C4 Kennung der bisherigen Bestzeit = Server-Kennung (nicht clientRecordId)', by('k1').bisher.activityId === R0729.id && by('k1').bisher.legacyId === R0729.clientRecordId);
  /* Altzustand nachgestellt: bisherige 5-km-Bestzeit 23:39 aus dem Timer — der Vergleich muss sie als „anderer Wert“
     derselben freigegebenen Aktivitaet ausweisen, nicht als gesperrt oder fehlend. */
  const oldRB = RB.measuredBestsLegacy;
  RB.measuredBestsLegacy = (l, o) => { const r = oldRB(l, o); r.k5 = { sec: 1419, km: 5.01, method: 'activity_total', activityId: R0813.clientRecordId, date: '2026-08-13' }; return r; };
  try {
    const c5 = BR.compareWithLegacy(st, RUNS).running.find(x => x.key === 'k5');
    ok('C5 Altzustand 23:39: Ursache anderer_wert, Aktivitaet im Register freigegeben mit 1995 s', c5.cause === 'anderer_wert' && c5.bisherImRegister.eligibility === 'eligible' && c5.bisherImRegister.value === 1995, J(c5));
  } finally { RB.measuredBestsLegacy = oldRB; }
  const blocked = JSON.parse(JSON.stringify(R0813)); blocked.metrics.garmin.type_key = 'treadmill_running';
  const st2 = L.update(null, [blocked, R0906], { timeZone: TZ }).state;
  RB.measuredBestsLegacy = (l, o) => { const r = oldRB(l, o); r.k5 = { sec: 1419, km: 5.01, method: 'activity_total', activityId: blocked.clientRecordId, date: '2026-08-13' }; return r; };
  try {
    const c6 = BR.compareWithLegacy(st2, [blocked, R0906]).running.find(x => x.key === 'k5');
    ok('C6 Laufband: Ursache gesperrt:unsupported_source', c6.cause === 'gesperrt:unsupported_source', J(c6.cause));
    const c7 = BR.compareWithLegacy(L.update(null, [R0906], { timeZone: TZ }).state, [blocked, R0906]).running.find(x => x.key === 'k5');
    ok('C7 bisherige Aktivitaet nicht im Register: nicht_im_register', c7.cause === 'nicht_im_register', J(c7.cause));
  } finally { RB.measuredBestsLegacy = oldRB; }
}

sec('K · Bestand, Kopplung, Runden, Korrektur');
{
  /* zwei gekoppelte Kraft-Aufzeichnungen wie im Bestand (Garmin → orvia_workout, Sportart gym) */
  const prim = { id: uuid(20), sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: '2026-06-23T14:02:00.000Z', durationSeconds: 3600, summary: { totalVolumeKg: 8000 }, metrics: {} };
  const rec = { id: uuid(21), sportId: 'gym', source: 'garmin', status: 'completed', startedAt: '2026-06-23T14:02:30.000Z', durationSeconds: 3700, linkedActivityId: uuid(20), summary: {}, metrics: {} };
  const st = L.update(null, RUNS.concat([prim, rec]), { timeZone: TZ }).state;
  ok('K1 gekoppelte Kraft-Aufzeichnung ist keine eigene Einheit (5 statt 6), Laeufe unberuehrt', Object.keys(st.activities).length === 5 && !st.activities[uuid(21)] && !!st.activities[uuid(20)]);
  const lapRun = JSON.parse(JSON.stringify(R0813));
  lapRun.metrics.streams = {};
  lapRun.metrics.splits = [{ distance: 2500, duration: 700, elapsedDuration: 700 }, { distance: 2506, duration: 718, elapsedDuration: 1297 }];
  const lr = RB.measuredBestsLegacy([lapRun], { sport: 'running' });
  ok('K2 Rundenfenster fuer Bestzeiten mit verstrichener Rundenzeit (Pause in Runde 2 zaehlt)', lr.k5 && lr.k5.sec === 1997 && !(lr.k5.method === 'lap_window' && lr.k5.sec < 1997), J(lr.k5));
  ok('K3 Rundenanzeige unveraendert: ohne Option Timer-Zeit wie Garmin Connect', RB.normalizeSplits(lapRun.metrics.splits)[1].sec === 718 && RB.normalizeSplits(lapRun.metrics.splits, { elapsed: true })[1].sec === 1297);
  const corr = AE.setManual(JSON.parse(JSON.stringify(R0813)), 'duration', 1500).activity;
  ok('K4 manuell korrigierte Dauer gilt als Gesamtzeit (Nutzerangabe vor Aufzeichnung)', RB.totalTimeOf(corr).basis === 'manual' && RB.totalTimeOf(corr).sec === 1500);
  const effRun = AE.setManual(JSON.parse(JSON.stringify(R0715)), 'duration', 3300).activity;
  const e = L.entryOf(L.update(null, [effRun], { timeZone: TZ }).state, effRun.id, 'running.fastest_10000m');
  ok('K5 Register: Korrektur unter der 10-km-Zeit widerspricht der Aufzeichnung → gesperrt (manual_override_conflict)', e.eligibility === 'blocked' && e.reason === 'manual_override_conflict', J([e.eligibility, e.reason]));
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_reconcile_v448c: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
