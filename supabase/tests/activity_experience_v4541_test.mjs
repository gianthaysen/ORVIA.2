/* ============================================================
   ORVIA · activity_experience_v4541 — Datenmodell der neuen Aktivitaetsansicht (ohne Browser)
   Grundlage: echte, anonymisierte Garmin-Mitschnitte (fixtures/run_ride_capture_v454.json, u. a. Zwift 07.10.2026).
   Z  Zeitquellen Zwift: Zusammenfassung 3734 s · Aufzeichnung 4401 s (= Gesamtzeit, 3 Luecken ohne Messzeile) · Bewegung 3698 s
      → Widerspruch benannt, Zusammenfassung verwendet, nichts still angeglichen; Laeufe ohne Widerspruch unveraendert
   W  Leistung: Garmins eigene Bestwerte je Fenster vor der Naeherung; Maximum einer ausgeduennten Reihe ist kein Maximum;
      ohne Leistungsmesser bleibt „kein Leistungsmesser"
   B  Kennzahlen-Bibliothek: Gruppen, nur skalare Werte, Timer nur bei echtem Unterschied, virtuelle Werte markiert
   C  Diagramm-Geometrie (activity-chart): Luecken brechen die Linie, keine Interpolation, Tempo invertiert, Teilstriche
   L  Leistungsregister und Laufbestzeiten unveraendert (23:38 · 57:55 · 29:11 · 1:01:49)
   U  Quelltext-Vertrag: keine Struktur als Text, Modul geladen, Build angehoben
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex, readFileSync } from 'node:fs';
import { DIAG, diagRun } from './_ledger-realdata.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
const clone = o => JSON.parse(JSON.stringify(o));

globalThis.window = globalThis;
for (const f of ['js/i18n.js', 'locales/de.js', 'js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js',
  'js/activity-time.js', 'js/activity-effective.js', 'js/activity-streams.js', 'js/activity-capabilities.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/swim-intervals.js', 'js/engine/intervals.js', 'js/engine/activity-analysis.js', 'js/activity-chart.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, AA = O.activityAnalysis, ME = O.metricEligibility, L = O.performanceLedger, RB = O.runBests, AC = O.activityChart;
const RR = JSON.parse(readFileSync(new URL('./fixtures/run_ride_capture_v454.json', import.meta.url), 'utf8'));
function real(key, noExt) {
  const f = RR[key], m = clone(f.metrics); if (noExt) delete m.ext;
  return { id: 'r-' + key, sportId: f.sport, source: 'garmin', status: 'completed', durationSeconds: Math.round(f.duration_s), startedAt: '2026-10-07T16:00:00.000Z',
           summary: O.activityNormalize.normalizeActivitySummary(Object.assign({}, f.summary), f.sport), metrics: m };
}
const desc = (a, st) => ME.describeActivity(a, { extState: st || 'loaded' }).metrics;

sec('Z · Zeitquellen (Zwift 07.10.2026)');
{
  const z = real('cycling__virtual_ride__indoor'), g = z.metrics.garmin, d = desc(z), md = AA.analyze(z, { extState: 'loaded' });
  ok('Z1 Rohwerte belegt: Zusammenfassung duration 3734 s, Aufzeichnung (Ende sumDuration) 4401 s = Gesamtzeit 4401 s, Bewegung 3698 s', z.metrics.ext.fields.duration === 3734 && g.timer_duration_s === 4401 && g.elapsed_duration_s === 4401 && g.moving_duration_s === 3698);
  ok('Z2 Timer-Zeit = 1:02:14 aus der Zusammenfassung — Widerspruch als „conflict" benannt (Aufzeichnung 4401, Zusammenfassung 3734), keine stille Angleichung', d.timer.value === 3734 && d.timer.source === 'garmin_list' && d.timer.conflict && d.timer.conflict.series === 4401 && d.timer.conflict.summary === 3734 && d.timer.conflict.use === 'summary' && d.timer.conflict.reason === 'series_timer_without_stops', J(d.timer));
  ok('Z3 Gesamtzeit 1:13:21 und Bewegungszeit 1:01:38 bleiben Garmins Werte', d.elapsed.value === 4401 && d.moving.value === 3698);
  ok('Z4 „Uhr angehalten" = Gesamtzeit − Timer = 667 s (11:07) mit benannter Grundlage (vorher 0 s, weil Timer = Gesamtzeit)', d.pause.value === 667 && /ext\.fields\.duration/.test(d.pause.basis), J(d.pause));
  ok('Z5 Seitenmodell traegt den Widerspruch (timerConflict) und markiert virtuell als modelliert', md.timerConflict && md.timerConflict.use === 'summary' && md.modeled === true && md.context === 'virtual');
  ok('Z6 ohne Rohblock (lokal) gilt die Spalte duration_seconds der Aktivitaet (3734) — dieselbe Garmin-Zusammenfassung', desc(real('cycling__virtual_ride__indoor', true), 'not_loaded').timer.value === 3734);
  const run = real('running__running__intervals'), dr = desc(run);
  ok('Z7 Lauf ohne Widerspruch (6064 vs. 6066 s, < 5 s): Timer aus der Aufzeichnung, kein conflict', dr.timer.value === 6064 && !dr.timer.conflict, J(dr.timer));
  const odd = real('running__running__steady'); odd.metrics.garmin.timer_duration_s = 2000; odd.metrics.ext.fields.duration = 2162;
  const dO = desc(odd);
  ok('Z8 anderer Widerspruch (Aufzeichnung ≠ Gesamtzeit): Aufzeichnung bleibt, als ungeprueft markiert', dO.timer.value === 2000 && dO.timer.conflict.use === 'series' && dO.timer.validation === 'unverified', J(dO.timer));
  const corr = real('cycling__virtual_ride__indoor', true); corr.metrics.corrections = { duration: { manual: 3600, source: 3734, unit: 's', at: '2026-10-08T10:00:00.000Z', method: 'manual' } }; corr.metrics.durationCorrection = { seconds: 3600 };
  ok('Z9 manuell korrigierte Dauer: kein Ersatz aus duration_seconds (die traegt die Korrektur) — Aufzeichnung bleibt, keine falsche Angleichung', desc(corr, 'not_loaded').timer.value === 4401);
}

sec('W · Leistung');
{
  const z = real('cycling__virtual_ride__indoor'), d = desc(z), pc = AA.analyze(z, { extState: 'loaded' }).powerCurve;
  ok('W1 Leistungskurve aus Garmins Bestwerten (maxAvgPower_*): 1 s 326 W · 30 s 162 W · 20 min 107 W · 1 h 95 W, 13 Fenster, keine Naeherung', pc && pc.rows.length === 13 && pc.rows[0].s === 1 && pc.rows[0].w === 326 && pc.rows.find(r => r.s === 30).w === 162 && pc.rows.find(r => r.s === 1200).w === 107 && pc.rows.find(r => r.s === 3600).w === 95 && pc.approx === false, J(pc && pc.rows.slice(0, 6)));
  ok('W2 Kurve bleibt ungeprueft (Validierungsregel unveraendert)', pc.validation === 'unverified');
  const pcLocal = AA.analyze(real('cycling__virtual_ride__indoor', true), { extState: 'not_loaded' }).powerCurve;
  ok('W3 ohne Rohblock: Naeherung des Workers (best_efforts) — als „≈ angenaehert" gekennzeichnet, Luecken (0 W) benannt', pcLocal && pcLocal.approx === true && pcLocal.rows.some(r => r.gap > 0), J(pcLocal && pcLocal.rows.slice(-3)));
  ok('W4 Ø/Max/NP-Leistung = Garmin-Zusammenfassung (112 / 326 / 116 W)', d.avgPower.value === 112 && d.maxPower.value === 326 && Math.round(d.normPower.value) === 116, J([d.avgPower.value, d.maxPower.value, d.normPower.value]));
  const thin = real('cycling__virtual_ride__indoor', true); ['avgPowerW', 'maxPowerW', 'normPowerW'].forEach(k => delete thin.summary[k]);
  const dt = desc(thin, 'not_loaded');
  ok('W5 Maximum einer ausgeduennten Reihe ist kein Maximum: ohne Garmin-Wert „nicht geliefert (ausgeduennt)" statt 214 W', dt.maxPower.status === 'not_delivered' && dt.maxPower.reason === 'thinned_series', J(dt.maxPower));
  const road = desc(real('cycling__road_biking__intervals'));
  ok('W6 Rennrad ohne Leistungsmesser: Ø und Max „kein Leistungsmesser" — nicht „ausgeduennt"', road.avgPower.reason === 'no_power_meter' && road.maxPower.reason === 'no_power_meter', J([road.avgPower.reason, road.maxPower.reason]));
}

sec('B · Kennzahlen-Bibliothek');
{
  const z = AA.analyze(real('cycling__virtual_ride__indoor'), { extState: 'loaded' }), ids = g => (z.library.find(x => x.id === g) || { items: [] }).items.map(d => d.id);
  ok('B1 Gruppen in fester Reihenfolge: Leistung · Herzfrequenz · Bewegung · Zeiten · Trainingsbelastung', z.library.map(g => g.id).join() === 'performance,heart,movement,time,load', J(z.library.map(g => g.id)));
  ok('B2 nur skalare Werte (keine Reihe, keine Struktur wie die Leistungskurve)', z.library.every(g => g.items.every(d => typeof d.value === 'number' || typeof d.value === 'string')) && !z.library.some(g => g.items.some(d => /Series$|^powerCurve$|^laps$|^lengths$|^route$|^hrZones$/.test(d.id))));
  ok('B3 Zeiten: Dauer, Gesamtzeit, Bewegungszeit, Uhr angehalten — Timer-Zeit nicht doppelt (= Dauer)', ids('time').join() === 'duration,elapsed,moving,pause', J(ids('time')));
  ok('B4 Leistung: Ø/Max-Geschwindigkeit, Ø/NP/Max-Leistung', ids('performance').join() === 'avgSpeed,maxSpeed,avgPower,normPower,maxPower', J(ids('performance')));
  const run = AA.analyze(real('running__running__intervals'), { extState: 'loaded' });
  ok('B5 Lauf: Kalorien unter Trainingsbelastung, Kadenz unter Bewegung', run.library.find(g => g.id === 'load').items.some(d => d.id === 'calories') && run.library.find(g => g.id === 'movement').items.some(d => d.id === 'runningCadence'));
}

sec('C · Diagramm-Geometrie (activity-chart)');
{
  const x = [0, 2, 4, 6, 200, 202, 204], v = [100, 110, null, 120, 130, 140, 150];
  const m = AC.model({ values: v, x: x }, 600, 220);
  ok('C1 Luecken brechen die Linie: Wert null und Zeitsprung > max(3 × Median, 60 s) → 3 Abschnitte, nichts verbunden', m.segs.length === 3 && m.segs.map(s => s.length).join() === '2,1,3', J(m.segs.map(s => s.map(p => p.x))));
  ok('C2 keine Interpolation: jeder Punkt ist ein gelieferter Messwert (6 von 7, null bleibt weg)', m.have.length === 6 && m.have.every(p => v[p.i] === p.v));
  const pm = AC.model({ values: [300, 330, 360], x: [0, 60, 120], pace: true }, 600, 220);
  ok('C3 Tempo invertiert: schnelleres Tempo (kleinere Zahl) liegt oben', pm.Y(300) < pm.Y(360));
  ok('C4 Teilstriche „schoen": Tempo in 5/10/15/30-s-Schritten, Zeitachse in vollen Minuten', pm.ticksY.every(t => t % 5 === 0) && m.ticksX.every(t => t % 30 === 0));
  const zero = AC.model({ values: [0, 50, 100], x: [0, 1, 2], zeroBased: true }, 600, 220);
  ok('C5 Leistung/Kadenz ab 0 (keine uebertriebene Ausschlaege)', zero.y0 === 0);
  ok('C6 zu wenig Punkte → kein Diagramm', AC.model({ values: [1], x: [0] }, 600, 220) === null);
  const big = { values: Array.from({ length: 2000 }, (_, i) => 100 + Math.sin(i / 20) * 30), x: Array.from({ length: 2000 }, (_, i) => i * 2) };
  const t0 = Date.now(); for (let k = 0; k < 20; k++) AC.model(big, 1200, 300); const dt = (Date.now() - t0) / 20;
  ok('C7 2.000 Punkte: Geometrie < 10 ms', dt < 10, dt.toFixed(2) + ' ms');
}

sec('L · Register und Laufbestzeiten unveraendert');
{
  const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
  const st = L.update(null, RUNS, { timeZone: 'Europe/Berlin' }).state, best = k => L.currentBest(st.events[k]);
  ok('L1 aktiv 5 km 23:38, aktiv 10 km 57:55, gesamt 5 km 29:11, gesamt 10 km 1:01:49', best('running.fastest_5000m_active@standard').value === 1418 && best('running.fastest_10000m_active@standard').value === 3475 && best('running.fastest_5000m@standard').value === 1751 && best('running.fastest_10000m@standard').value === 3709);
  const rb = RB.measuredRunBests(RUNS);
  ok('L2 run-bests (App, Flag aus): 5 km 29:11 · 10 km 1:01:49 gesamt, aktiv 23:38 · 57:55', rb.k5 && Math.round(rb.k5.sec) === 1751 && rb.k10 && Math.round(rb.k10.sec) === 3709 && rb.active && Math.round(rb.active.k5.sec) === 1418 && Math.round(rb.active.k10.sec) === 3475, J([rb.k5 && rb.k5.sec, rb.k10 && rb.k10.sec, rb.active && rb.active.k5 && rb.active.k5.sec, rb.active && rb.active.k10 && rb.active.k10.sec]));
}

sec('U · Quelltext-Vertrag');
{
  const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8'), idx = readFileSync(new URL(_APPREL + 'index.html', import.meta.url), 'utf8'), swjs = readFileSync(new URL(_APPREL + 'sw.js', import.meta.url), 'utf8');
  const fmt = ui.slice(ui.indexOf('function gmAaFmt(d,fam){'), ui.indexOf('/* Hauptkennzahlen + Karten.'));
  ok('U1 Formatter rendert nie eine Struktur als Text: Leistungskurve → „n Zeitfenster", jede andere Struktur → „n Eintraege" (vorher String(v) = „[object Object]")', /case 'powerCurve'/.test(fmt) && /ax\.fmt\.entries/.test(fmt) && /typeof v==='object'/.test(fmt));
  ok('U2 Diagramm-Modul geladen (genau einmal; ui.js nutzt es erst beim Oeffnen einer Aktivitaet) und im Precache', idx.split('js/activity-chart.js').length === 2 && swjs.includes("'./js/activity-chart.js'"));
  ok('U3 neue Build-Nummer (≥ 455), gleich in sw.js und index.html', /const C = 'orvia-v8-(\d+)'/.test(swjs) && +swjs.match(/orvia-v8-(\d+)/)[1] >= 455 && idx.includes('content="' + swjs.match(/orvia-v8-\d+/)[0] + '"'));
  ok('U4 Seite rechnet nichts: die neue Ansicht liest Modellwerte (keine Rechnung ueber Aktivitaeten, kein reduce)', !/\.reduce\(/.test(ui.slice(ui.indexOf('v8-454.1 · Premium Activity Experience'), ui.indexOf('function gmOpenActivityPage(aid){'))));
  ok('U5 Diagramm-Modul ohne Texte (Beschriftungen kommen ueber t())', !/[äöüÄÖÜß]/.test(readFileSync(new URL(_APPREL + 'js/activity-chart.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' activity_experience_v4541: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
