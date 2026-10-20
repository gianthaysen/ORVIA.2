/* ============================================================
   ORVIA · intervals_v454 — gemeinsame Intervall-Engine Laufen / Rad (ohne Browser)
   Grundlage: echte, anonymisierte Garmin-Mitschnitte vom 19.10.2026 (fixtures/run_ride_capture_v454.json, erzeugt aus
   garmin-worker/tests/fixtures/garmin/captures/ durch scripts/gen_app_swim_fixture.py — Gleichheit mit der Worker-Ausgabe
   prueft garmin-worker/tests/test_v453_app_fixture.py).
   R  echte Einheiten: Workout-Lauf (17 km, 4 Garmin-Abschnitte, 18 Runden), gewoehnlicher Lauf, Rad mit Runden, Rad, Zwift
   S  Strukturen: Garmin-Workout mit Belastung/Erholung, Belastungsarten je Runde, Regel-Erkennung, Rundenausloeser,
      400 m und 1.000 m nicht vermischt, Altbestand, fehlende Werte, kaputte Runden
   T  Zeitsemantik: Timer · Gesamtzeit · Bewegungszeit nie gleichgesetzt; langsame Abschnitte nie abgezogen
   P  Leistung nur gemessen; Rolle / Zwift ohne modellierte Geschwindigkeit
   L  Leistungsregister, Laufbestzeiten, Schwimmen unveraendert; Garmin-Runden erzeugen keine Bestzeit
   U  Quelltext-Vertrag
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex, readFileSync } from 'node:fs';
import { DIAG, diagRun } from './_ledger-realdata.mjs';
import { swimRow } from './_swim-realdata.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
const clone = o => JSON.parse(JSON.stringify(o));
const clk = s => s == null ? null : Math.floor(Math.round(s) / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0');

globalThis.window = globalThis;
for (const f of ['js/i18n.js', 'locales/de.js', 'js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js',
  'js/activity-time.js', 'js/activity-effective.js', 'js/activity-streams.js', 'js/activity-capabilities.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/swim-intervals.js', 'js/engine/intervals.js', 'js/engine/activity-analysis.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, IV = O.intervals, AA = O.activityAnalysis, ME = O.metricEligibility, L = O.performanceLedger, RB = O.runBests;
const RR = JSON.parse(readFileSync(new URL('./fixtures/run_ride_capture_v454.json', import.meta.url), 'utf8'));
function real(key) {
  const f = RR[key];
  return { id: 'r-' + key, sportId: f.sport, source: 'garmin', status: 'completed', durationSeconds: Math.round(f.duration_s), startedAt: '2026-10-15T07:00:00.000Z',
           summary: { distanceM: f.distance_m, avgHr: f.avg_hr, maxHr: f.max_hr, avgPowerW: f.avg_power }, metrics: clone(f.metrics) };
}
/* synthetische Runden (Feldnamen wie im Mitschnitt belegt) */
function act(sport, laps, extra) {
  const a = { id: 's-' + Math.random().toString(36).slice(2), sportId: sport, source: 'garmin', status: 'completed', durationSeconds: laps.reduce((s, l) => s + ((l && l.duration) || 0), 0),
              summary: { distanceM: laps.reduce((s, l) => s + ((l && l.distance) > 0 ? l.distance : 0), 0) }, metrics: { garmin: { type_key: sport === 'cycling' ? 'road_biking' : 'running', start_gmt: '2026-01-01T00:00:00Z' }, splits: laps, splits_source: 'garmin_splits' } };
  return Object.assign(a, extra || {});
}
const lap = (i, d, t, o) => Object.assign({ lapIndex: i, distance: d, duration: t, elapsedDuration: t, movingDuration: t, averageHR: 150 }, o || {});

sec('R · echte Einheiten (Mitschnitt 19.10.2026)');
{
  const a = real('running__running__intervals'), before = J(a), m = IV.build(a, { extState: 'loaded' });
  ok('R1 Workout-Lauf: 4 Abschnitte aus Garmins Intervall-Antwort (INTERVAL_ACTIVE, mit Runden-Zuordnung) — 4 / 4 / 8 / 1 km', m.structure === 'workout_steps' && m.classification === 'garmin_typed' && m.segments.length === 4 && m.segments.map(s => Math.round(s.distance / 1000)).join() === '4,4,8,1');
  ok('R2 alle Abschnitte „ACTIVE" → „Abschnitt" (kein Belastung/Erholung erfunden), Herkunft Garmin', m.segments.every(s => s.kind === 'step' && s.kindSource === 'garmin'));
  ok('R3 Tempo je Abschnitt auf der Timer-Zeit: 6:50 · 6:07 · 5:16 · 7:05 /km', m.segments.map(s => clk(s.pace)).join() === '6:50,6:07,5:16,7:05', m.segments.map(s => clk(s.pace)).join());
  ok('R4 Uhr angehalten bleibt getrennt (Abschnitt 2: Timer 24:29, Gesamtzeit 32:29 → 7:59 angehalten), nichts verrechnet', clk(m.segments[1].timer) === '24:29' && Math.abs(m.segments[1].elapsed - 1948.8) < 1 && Math.round(m.segments[1].stoppedInside) === 479 && Math.round(m.segments[1].pace) === Math.round(m.segments[1].timer / 4));
  ok('R5 Runden je Abschnitt aus lapIndexes (4 / 4 / 8 / 2 inkl. 2-m-Restrunde); 18 Runden insgesamt', m.segments.map(s => s.children.length).join() === '4,4,8,2' && m.laps === 18);
  ok('R6 Runden selbst: alle 1 km gleich lang → automatische Runden (Regel), nicht „Belastung" — einheitliches „ACTIVE" belegt nichts', m.lapClassification === 'rule_auto' && m.segments[2].children.every(c => c.kind === 'auto_lap' && c.kindSource === 'rule'));
  ok('R7 Laufkadenz je Runde: Rundenwert (Schritte/min, voller Wert) passt zur geprueften Messreihe (z. B. Runde 10: 169 spm)', m.segments[2].children[1].cadence.quality === 'measured' && Math.round(m.segments[2].children[1].cadence.v) === 169);
  const an = m.analytics;
  ok('R8 Analyse nur vergleichbarer Kilometer im Tempo-Abschnitt 3 (6 von 8; 2 wegen Gelaende/Stillstand ausgeschlossen); Streuung 3,8 %; schnellste Runde 12 (4:58), langsamste Runde 9 (5:36)', an.comparable && an.basis === 'auto_lap_in_step' && an.unit === 'lap' && an.step === 3 && an.count === 6 && an.excluded === 2 && an.cvPct === 3.8 && an.best === 12 && clk(an.bestValue) === '4:58' && an.worst === 9 && clk(an.worstValue) === '5:36', J(an));
  ok('R9 keine Verlaufsaussage („langsamer/schneller") ohne klare Richtung (R² 0,17)', an.trend === null);
  ok('R10 Lauf/Geh/Steh-Abschnitte (RWD_*) werden nie als Intervalle gezeigt', !m.segments.some(s => /RWD/.test(String(s.typed))));
  ok('R11 Zeitstrahl: 4 Bloecke, Breite = Gesamtzeit je Abschnitt (Summe der Garmin-Abschnittswerte 1:57:55 ±0,5 %, Abweichung zur Einheit 18 s wird nicht verbogen)', m.timeline.blocks.length === 4 && m.timeline.basis === 'elapsed' && Math.abs(m.timeline.total - 7057) / 7057 < 0.005 && Math.abs(m.timeline.blocks.reduce((s, b) => s + b.share, 0) - 1) < 1e-9);
  ok('R12 der Datensatz wird nicht veraendert', J(a) === before);
}
{
  const m = IV.build(real('running__running__steady'), { extState: 'loaded' });
  ok('R13 gewoehnlicher Lauf mit „INTERVAL" in ALLEN Runden: kein Intervalltraining (einheitlich = nicht belegt) → automatische 1-km-Runden', m.structure === 'rule_auto' && m.segments.every(s => s.kind === 'auto_lap'));
  ok('R14 Runden mit viel Stillstand (Bewegung < 90 % der Timer-Zeit) nicht vergleichbar → keine Analyse, keine Aussage', !m.analytics.comparable && !m.analytics.trend, J(m.analytics));
}
{
  const m = IV.build(real('cycling__road_biking__intervals'), { extState: 'loaded' });
  ok('R15 Rad mit 5-km-Runden: automatische Runden (Regel); Garmin liefert hier keine Belastungsart', m.structure === 'rule_auto' && m.segments.length === 6 && m.segments.slice(0, 5).every(s => s.kind === 'auto_lap' && s.distance === 5000));
  ok('R16 Rad ohne Leistungsmessung: keine Wattwerte, keine Leistungsbewertung (Geschwindigkeit draussen ist keine vergleichbare Leistung)', !m.powerMeasured && m.segments.every(s => s.power === null) && m.analytics && m.analytics.comparable === false && m.analytics.reason === 'no_power');
  ok('R17 Stopps bleiben sichtbar (Runde 5: 12:30 gefahren, 32:06 Gesamtzeit) — Geschwindigkeit auf der Timer-Zeit (24,0 km/h)', clk(m.segments[4].timer) === '12:30' && clk(m.segments[4].elapsed) === '32:06' && Math.round(m.segments[4].speed * 36) === 240);
  const s = IV.build(real('cycling__cycling__steady'), { extState: 'loaded' });
  ok('R18 gleichmaessige Fahrt mit EINER Runde: kein Intervall-Block', s.show === false);
  const z = IV.build(real('cycling__virtual_ride__indoor'), { extState: 'loaded' });
  ok('R19 Zwift: Leistung gemessen (112 W, Rundenwert = Messreihe), NP 116 W als Garmin-Wert (ungeprueft), eine Runde → kein Block', z.powerMeasured && z.segments[0].power.v === 112 && z.segments[0].power.quality === 'measured' && z.segments[0].np.v === 116 && z.segments[0].np.quality === 'unverified' && z.show === false, J(z.segments[0].power));
}

sec('S · Strukturen');
{
  /* Garmin-Workout mit Aufwaermen, 6 × 800 m mit Trabpausen, Auslaufen — Intervall-Antwort + Runden */
  const laps = [lap(1, 2000, 720)], typed = [{ type: 'INTERVAL_WARMUP', distance: 2000, duration: 720, elapsedDuration: 720, lapIndexes: [1], averageHR: 135 }];
  let li = 2;
  for (let r = 0; r < 6; r++) {
    const t = 204 + r * 3;                                                   // jede Wiederholung 3 s langsamer
    laps.push(lap(li, 800, t, { averageHR: 165 + r * 2 })); typed.push({ type: 'INTERVAL_ACTIVE', distance: 800, duration: t, elapsedDuration: t, lapIndexes: [li], averageHR: 165 + r * 2 }); li++;
    if (r < 5) { laps.push(lap(li, 300, 120, { averageHR: 140 })); typed.push({ type: 'INTERVAL_RECOVERY', distance: 300, duration: 120, elapsedDuration: 120, lapIndexes: [li], averageHR: 140 }); li++; }
  }
  laps.push(lap(li, 1500, 600)); typed.push({ type: 'INTERVAL_COOLDOWN', distance: 1500, duration: 600, elapsedDuration: 600, lapIndexes: [li] });
  const a = act('running', laps); a.metrics.ext = { v: 1, typed_splits: { splits: typed.concat([{ type: 'RWD_RUN', distance: 9000, duration: 3000 }]) } };
  const m = IV.build(a, {});
  ok('S1 Garmin-Workout: Aufwaermen · 6 Belastungen · 5 Erholungen · Auslaufen (alle „laut Garmin")', m.structure === 'workout_intervals' && J(m.counts) === J({ warmup: 1, work: 6, recovery: 5, cooldown: 1 }) && m.segments.every(s => s.kindSource === 'garmin'));
  ok('S2 Wiederholung 1: 800 m · 3:24 · 4:15 /km', m.segments[1].distance === 800 && clk(m.segments[1].timer) === '3:24' && clk(m.segments[1].pace) === '4:15');
  ok('S3 Analyse der 6 Belastungen: langsamer werdend (+7,1 %, klare Richtung) — als Beobachtung, nicht als Formurteil; Puls 165 → 175', m.analytics.comparable && m.analytics.count === 6 && m.analytics.trend === 'slower' && m.analytics.changePct === 7.1 && m.analytics.unit === 'work' && m.analytics.best === 1 && m.analytics.worst === 6 && m.analytics.hrFirst === 165 && m.analytics.hrLast === 175, J(m.analytics));
  /* 400er und 1000er im selben Training: nicht gemeinsam bewertet */
  const mix = act('running', [lap(1, 1000, 240), lap(2, 200, 90), lap(3, 400, 85), lap(4, 200, 90), lap(5, 1000, 245), lap(6, 200, 90), lap(7, 400, 84), lap(8, 200, 90), lap(9, 1000, 250)].map(l => Object.assign(l, { intensityType: l.distance === 200 ? 'REST' : 'ACTIVE' })));
  const mm = IV.build(mix, {});
  ok('S4 Belastungsarten je Runde (ACTIVE + REST gemischt) → Garmin-Einordnung; 400 m und 1.000 m nie gemeinsam verglichen (nur die drei 1.000er)', mm.classification === 'garmin' && mm.analytics.comparable && mm.analytics.count === 3 && mm.analytics.ref === 1000);
  /* Regel: Wechsel schnell / langsam ohne Garmin-Kennzeichen */
  const rl = act('running', [lap(1, 1500, 600), lap(2, 1000, 240), lap(3, 400, 180), lap(4, 1000, 242), lap(5, 400, 182), lap(6, 1000, 244), lap(7, 1200, 480)]);
  const mr = IV.build(rl, {});
  ok('S5 Regel: schnelle Runden ähnlicher Laenge zwischen langsamen → Belastung/Erholung, davor Aufwaermen, danach Auslaufen — als „erkannt (Regel)" gekennzeichnet', mr.classification === 'rule_work' && mr.segments.map(s => s.kind).join() === 'warmup,work,recovery,work,recovery,work,cooldown' && mr.segments.every(s => s.kindSource === 'rule'));
  const steady = act('running', [lap(1, 1300, 400), lap(2, 1100, 330), lap(3, 900, 300), lap(4, 1250, 410)]);
  ok('S6 ein lockerer Dauerlauf mit ungleich langen Runden: KEINE Intervalle erfunden („Runde", Typ nicht bestimmbar)', IV.build(steady, {}).segments.every(s => s.kind === 'unknown' && s.kindSource === 'none'));
  const bikeNoPower = act('cycling', [lap(1, 3000, 600), lap(2, 4000, 300), lap(3, 1500, 300), lap(4, 4000, 300), lap(5, 1500, 300)]);
  ok('S7 Rad ohne gemessene Leistung: keine Regel-Einordnung aus Geschwindigkeit (Gelaende, Wind)', IV.build(bikeNoPower, {}).segments.every(s => s.kind === 'unknown'));
  const trig = act('running', [lap(1, 1000, 300, { lapTrigger: 'DISTANCE' }), lap(2, 1000, 305, { lapTrigger: 'DISTANCE' }), lap(3, 640, 200, { lapTrigger: 'MANUAL' }), lap(4, 300, 100, { lapTrigger: 'SESSION_END' })]);
  const mt = IV.build(trig, {});
  ok('S8 Rundenausloeser von Garmin: Distanz → automatische Runde, MANUAL → manuelle Runde', mt.classification === 'garmin_trigger' && mt.segments[0].kind === 'auto_lap' && mt.segments[2].kind === 'manual_lap');
}

sec('T · Zeitsemantik und fehlende Daten');
{
  const a = act('running', [lap(1, 1000, 300, { elapsedDuration: 420, movingDuration: 290 }), lap(2, 1000, 310), lap(3, 1000, 305)]);
  const s = IV.build(a, {}).segments[0];
  ok('T1 Tempo auf der Timer-Zeit (5:00 /km) — weder Gesamtzeit (7:00) noch Bewegungszeit (4:50); Uhr angehalten 2:00 als eigener Wert', clk(s.pace) === '5:00' && s.timer === 300 && s.elapsed === 420 && s.moving === 290 && s.stoppedInside === 120);
  const noT = act('running', [lap(1, 1000, null, { duration: null, elapsedDuration: 330 }), lap(2, 1000, 300)]);
  ok('T2 ohne Timer-Zeit: Gesamtzeit als Grundlage, benannt (timeBasis elapsed)', IV.build(noT, {}).segments[0].timeBasis === 'elapsed');
  const bad = act('running', ['x', null, { distance: -3, duration: 10 }, { distance: 1000 }, lap(5, 1000, 300), lap(6, 1000, 310)]);
  const mb = IV.build(bad, {});
  ok('T3 kaputte Runden (Text, null, negative Distanz, ohne Zeit) werden weggelassen, nicht geraten', mb.segments.length === 2);
  const noHr = act('running', [lap(1, 1000, 300, { averageHR: undefined }), lap(2, 1000, 300, { averageHR: undefined })]);
  ok('T4 fehlender Puls und fehlende Kadenz: Felder leer, kein Fehler', IV.build(noHr, {}).segments.every(s => s.hr === null && s.cadence === null));
  const leg = { id: 'leg', sportId: 'running', source: 'legacy_local', status: 'completed', durationSeconds: 1800, summary: { distanceM: 6000 }, metrics: {} };
  const ml = IV.build(leg, { legacySplits: [{ km: 1, sec: 300, hr: 150 }, { km: 1, sec: 298, hr: 152 }, { km: 1, sec: 301 }, { km: 1, sec: 297 }] });
  ok('T5 Altbestand: Runden aus der verknuepften Trainingssession (km/sec/hr) — Herkunft „legacy_session"', ml.source === 'legacy_session' && ml.segments.length === 4 && ml.segments[0].hr === 150);
  ok('T6 ohne Runden: kein Modell (heutige Produktion fuer Laufen und Rad)', IV.build(act('running', []), {}) === null && AA.analyze(real('cycling__cycling__steady')).intervals === null);
  const many = act('running', Array.from({ length: 50 }, (_, i) => lap(i + 1, 400, 90 + (i % 2) * 60)));
  const t0 = Date.now(); const m50 = IV.build(many, {}); const dt = Date.now() - t0;
  ok('T7 50 Runden: Modell in < 50 ms, Zeitstrahl mit 50 Bloecken', m50.segments.length === 50 && m50.timeline.blocks.length === 50 && dt < 50, dt + ' ms');
}

sec('P · Leistung und Rolle');
{
  const z = AA.analyze(real('cycling__virtual_ride__indoor'), { extState: 'loaded' });
  ok('P1 Zwift: Hauptzahl Ø Leistung (gemessen); keine Geschwindigkeits- und Hoehenkurve (modelliert)', z.hero[0].id === 'avgPower' && z.charts.map(c => c.id).join() === 'power,hr,cadence', z.charts.map(c => c.id).join());
  const road = AA.analyze(real('cycling__road_biking__intervals'), { extState: 'loaded' });
  ok('P2 draussen ohne Leistungsmesser: Hauptzahl Distanz, darunter Dauer · Ø Geschwindigkeit · Ø Puls; keine Wattzahl irgendwo', road.hero.map(d => d.id).join() === 'distance,duration,avgSpeed,avgHr' && !road.hero.concat(road.more).some(d => /Power/.test(d.id) && d.value != null));
  const lp = act('cycling', [lap(1, 5000, 600, { averagePower: 250 }), lap(2, 5000, 600, { averagePower: 240 })]);
  ok('P3 Rundenfeld averagePower ohne Leistungsmessung der Einheit wird ignoriert (nie aus Tempo/Hoehe/Puls)', IV.build(lp, {}).segments.every(s => s.power === null));
  const run = AA.analyze(real('running__running__intervals'), { extState: 'loaded' });
  ok('P4 Laufen: Hauptzahl Distanz; Diagramme Tempo · Puls · Kadenz · Hoehe', run.hero[0].id === 'distance' && run.charts.map(c => c.id).join() === 'paceKm,hr,cadence,elevation' && run.intervals.v === 'intervals@1');
  const pace = run.charts.find(c => c.id === 'paceKm');
  /* v8-456 (neue Regel): langsame, bewegte Punkte (Gehen) bleiben Messwerte; das Diagramm (robuste Tempoachse) markiert sie als
     „ausserhalb" am Rand — nie als Spitze der Linie. Stillstand (≤ 0,3 m/s) hat kein Tempo und ist als eigener Punkt markiert. */
  const AC = require(new URL(_APPREL + 'js/activity-chart.js', import.meta.url).pathname);
  const pm = AC.model({ values: pace.values, x: pace.times, marks: pace.marks, pace: true }, 600, 220);
  const lineVals = pm.segs.reduce((a, sg) => a.concat(sg.map(p => p.v)), []);
  const slow = pace.values.filter(v => v !== null && v > 2 * 340).length;
  ok('P5 Tempo-Kurve: Gehen bleibt Messwert, liegt aber ausserhalb der Linie (markiert „out"); Linie nur im Achsenbereich; Werte 100–3600 s/km',
    pace.values.every(v => v === null || (v >= 100 && v <= 3600)) && lineVals.every(v => v >= pm.y0 && v <= pm.y1) && pm.have.filter(p => p.mark === 'out').length >= (slow ? 1 : 0), 'langsam ' + slow + ', out ' + pm.have.filter(p => p.mark === 'out').length);
  ok('P5b Stillstand (≤ 0,3 m/s) als eigener Punkt markiert, nicht Teil der Linie', !pace.marks || pace.marks.every((m, i) => m !== 'stop' || !pm.segs.some(sg => sg.some(p => p.i === i))));
}

sec('L · Register, Bestzeiten, Schwimmen');
{
  const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
  const st = L.update(null, RUNS, { timeZone: 'Europe/Berlin' }).state, best = k => L.currentBest(st.events[k]);
  ok('L1 Register unveraendert: 5 km aktiv 23:38, 10 km aktiv 57:55, 5 km gesamt 29:11, 10 km gesamt 1:01:49', best('running.fastest_5000m_active@standard').value === 1418 && best('running.fastest_10000m_active@standard').value === 3475 && best('running.fastest_5000m@standard').value === 1751 && best('running.fastest_10000m@standard').value === 3709);
  const rb = RB.measuredRunBests(RUNS);
  /* Garmin-Runden (schneller als jede echte Bestzeit) an ALLE Laeufe haengen: keine Bestzeit darf sich aendern */
  const withLaps = RUNS.map(r => { const x = clone(r); x.metrics = x.metrics || {}; x.metrics.splits = Array.from({ length: 12 }, (_, i) => ({ lapIndex: i + 1, distance: 1000, duration: 180, elapsedDuration: 180 })); x.metrics.splits_source = 'garmin_splits'; return x; });
  const rb2 = RB.measuredRunBests(withLaps), st2 = L.update(null, withLaps, { timeZone: 'Europe/Berlin' }).state;
  ok('L2 nachgeladene Garmin-Runden (12 × 1 km in 3:00) aendern keine Laufbestzeit der App', J([rb.k1, rb.k5, rb.k10, rb.k21, rb.active && rb.active.k5]) === J([rb2.k1, rb2.k5, rb2.k10, rb2.k21, rb2.active && rb2.active.k5]));
  ok('L3 … und kein Ereignis des Leistungsregisters', J(Object.keys(st.events).map(k => [k, L.currentBest(st.events[k]) && L.currentBest(st.events[k]).value])) === J(Object.keys(st2.events).map(k => [k, L.currentBest(st2.events[k]) && L.currentBest(st2.events[k]).value])));
  const leg = clone(RUNS[0]); leg.metrics.splits = [{ distance: 1000, duration: 200 }]; delete leg.metrics.splits_source;
  ok('L4 Runden ohne Garmin-Zusatzabruf (Altbestand) behalten ihre bisherige Rolle (Regel gilt nur fuer splits_source garmin_splits)', /lapsAllowed = !\(a\.metrics && a\.metrics\.splits_source === 'garmin_splits'\)/.test(readFileSync(new URL(_APPREL + 'js/run-bests.js', import.meta.url), 'utf8')));
  const sw = swimRow(5, true);
  ok('L5 Schwimmen ohne Runden unveraendert: kein Intervall-Block, Hauptzahl Distanz', AA.analyze(sw).swim === null && AA.analyze(sw).hero[0].id === 'distance');
  ok('L6 Intervall-Engine erzeugt nichts fuer Register/Rekorde (keine Schnittstelle dorthin)', !/performanceLedger|recordsBridge|runBests|pbSync/.test(readFileSync(new URL(_APPREL + 'js/engine/intervals.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
}

sec('U · Quelltext-Vertrag');
{
  const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8'), idx = readFileSync(new URL(_APPREL + 'index.html', import.meta.url), 'utf8'), swjs = readFileSync(new URL(_APPREL + 'sw.js', import.meta.url), 'utf8');
  const blk = ui.slice(ui.indexOf('v8-454 · Intervalle Laufen / Rad'), ui.indexOf('/* Analyse vergleichbarer Abschnitte'));
  ok('U1 Modul vor activity-analysis geladen und im Precache', idx.indexOf('js/engine/intervals.js') > 0 && idx.indexOf('js/engine/intervals.js') < idx.indexOf('js/engine/activity-analysis.js') && swjs.includes("'./js/engine/intervals.js'"));
  ok('U2 Oberflaeche rechnet nicht (keine Summen/Mittel), liest keinen Rohblock', !/\.reduce\(|metrics\.ext|lapDTOs|typed_splits/.test(blk));
  ok('U3 Zeitstrahl: Art nicht nur ueber Farbe (Muster + Legende + Beschriftung), Abschnitte antippbar', /tl-legend/.test(ui) && /k-recovery/.test(readFileSync(new URL(_APPREL + 'styles.css', import.meta.url), 'utf8')) && /repeating-linear-gradient/.test(readFileSync(new URL(_APPREL + 'styles.css', import.meta.url), 'utf8')) && /gmIvPick/.test(ui));
  ok('U4 Texte ueber i18n (aa.iv2.*)', /_uiT\('aa\.iv2\./.test(blk) && O.i18n.t('aa.iv2.k.work') === 'Belastung');
}

console.log('\n' + (fail ? '❌' : '✅') + ' intervals_v454: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
