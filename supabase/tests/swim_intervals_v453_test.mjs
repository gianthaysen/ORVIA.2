/* ============================================================
   ORVIA · swim_intervals_v453 — Schwimmintervalle, Pausen und einzelne Bahnen (ohne Browser)
   Grundlage: der echte, anonymisierte Garmin-Mitschnitt vom 18.10.2026 (Einheit 11.10.2026, 1.350 m, 25-m-Becken),
   so wie der Worker v8-452.1 ihn in die Zeile schreibt (fixtures/swim_capture_v453.json, erzeugt von
   garmin-worker/scripts/gen_app_swim_fixture.py, Gleichheit geprueft in garmin-worker/tests/test_v453_app_fixture.py).
   R  echter Mitschnitt: Summen, Intervall-Tempo auf Schwimmzeit, Pausen, Lagen, SWOLF, Plausibilitaet, Unveraenderlichkeit
   P  nur schlanke Runden (Bahnen nicht geladen) und Runden ohne Bewegungszeit
   B  50-m-Becken, Schmetterling / unbekannte Lage, schnelle aber plausible Bahnen
   E  Fehlerfaelle: keine Runden, leere / kaputte Antworten, nur Pausen, ein einziges Intervall, Freiwasser
   A  Einbindung in activity-analysis und metric-eligibility (Diagramme je Bahn, Pruefstand Runden/Bahnen)
   L  Leistungsregister, Bestzeiten und andere Sportarten unveraendert; nichts geht in Rekorde
   U  Quelltext-Vertrag der Seite
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
const r1 = v => v == null ? v : Math.round(v * 10) / 10;

globalThis.window = globalThis;
for (const f of ['js/i18n.js', 'locales/de.js', 'js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js',
  'js/activity-time.js', 'js/activity-effective.js', 'js/activity-streams.js', 'js/activity-capabilities.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/swim-intervals.js', 'js/engine/activity-analysis.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, SI = O.swimIntervals, AA = O.activityAnalysis, ME = O.metricEligibility, L = O.performanceLedger, RB = O.runBests;
const F = JSON.parse(readFileSync(new URL('./fixtures/swim_capture_v453.json', import.meta.url), 'utf8'));

/* Einheit 11.10. wie in Produktion (Datensatz aus dem Audit) + Runden/Bahnen so, wie der Worker v8-452.1 sie schreibt */
function real(withLengths = true) {
  const a = swimRow(5, true);
  a.metrics.splits = clone(F.lap_swimming.metrics.splits); a.metrics.splits_source = 'garmin_splits';
  a.metrics.ext = Object.assign({}, a.metrics.ext, { fields: clone(F.lap_swimming.metrics.ext.fields), extras: { splits: 'ok' } });
  if (withLengths) a.metrics.ext.splits = clone(F.lap_swimming.metrics.ext.splits);
  return a;
}

sec('R · echter Mitschnitt (11.10.2026)');
{
  const a = real(), before = J(a), m = SI.build(a), t = m.totals;
  ok('R1 Summen aus den Rohdaten reproduziert: 1.350 m · 54 aktive Bahnen · 673 Zuege · 1.456,9 s Schwimmzeit', t.distance === 1350 && t.activeLengths === 54 && t.strokes === 673 && r1(t.activeTime) === 1456.9, J(t));
  ok('R2 3 Intervalle, 7 Pausenrunden; Pausenbloecke 4 / 1 / 2 Runden (aufeinanderfolgende zusammen), keiner einem Intervall zugeschlagen', t.intervals === 3 && t.restLaps === 7 && J(m.blocks.map(b => b.kind === 'rest' ? b.laps.length : 'I' + b.n)) === J(['I1', 4, 'I2', 1, 'I3', 2]));
  const iv = m.intervals;
  ok('R3 aktive Intervall-Pace = Schwimmzeit / Distanz × 100: 2:41 · 2:29 · 1:40 /100 m (nicht 5:43 · 3:41 · 3:11)', iv.map(s => Math.round(s.pace100Active)).join() === '161,149,100' && iv.map(s => Math.round(s.pace100Elapsed)).join() === '343,221,191', J(iv.map(s => [s.pace100Active, s.pace100Elapsed])));
  ok('R4 Schwimmzeit = movingDuration der Runde = Summe der aktiven Bahnen (Gegenprobe „match")', iv.every(s => s.activeBasis === 'lap_moving' && s.checks.active === 'match'));
  ok('R5 Pause im Intervall = Summe der Bahnen ohne Distanz: 2:17 · 1:29 · 17:32 — und = Intervallzeit − Schwimmzeit', iv.map(s => Math.round(s.restInside)).join() === '137,89,1052' && iv.every(s => s.restBasis === 'rest_lengths' && s.checks.restInside === 'match'));
  ok('R6 Zeitbilanz: Schwimmzeit + Pausen im Intervall + Pausenrunden = Timer der Einheit (keine Pause doppelt, keine verloren)', m.sumChecks.timer === 'match' && Math.abs(t.activeTime + t.restInside + t.restBetween - 4170.6) < 2);
  ok('R7 Summenpruefung gegen die Zusammenfassung: Distanz, aktive Bahnen, Zuege, Schwimmzeit stimmen', ['distance', 'activeLengths', 'strokes', 'activeTime'].every(k => m.sumChecks[k] === 'match'), J(m.sumChecks));
  ok('R8 Lagen wie geliefert: Intervall 1+2 Kraul, Intervall 3 gemischt (37 Kraul, 8 Brust, 1 Ruecken)', iv[0].stroke === 'freestyle' && iv[1].stroke === 'freestyle' && iv[2].stroke === 'mixed' && iv[2].mixed && J(iv[2].styles) === J({ freestyle: 37, backstroke: 1, breaststroke: 8 }));
  ok('R9 Zuege je Bahn nur bei EINER Lage (24,0 / 18,0), bei gemischtem Intervall keine (Garmins 13,9 ist nicht nachrechenbar)', iv[0].strokesPerLength === 24 && iv[1].strokesPerLength === 18 && iv[2].strokesPerLength === null);
  ok('R10 SWOLF je Bahn = Zuege + Sekunden in 54/54 Bahnen (kein swolf_mismatch); Intervall-SWOLF = Mittel der Bahnen', iv.every(s => s.lengths.every(b => !b.quality || !b.quality.reasons.includes('swolf_mismatch'))) && iv.every(s => s.checks.swolf === 'match'));
  ok('R11 Bahnen: Pausenbahnen (Distanz 0) getrennt von geschwommenen; nur aktive Bahnen nummeriert (1…46 in Intervall 3)', iv[2].lengths.filter(b => b.kind === 'rest').length === 14 && iv[2].lengths.filter(b => b.kind === 'active').map(b => b.n).join() === Array.from({ length: 46 }, (_, i) => i + 1).join() && iv[2].lengths.filter(b => b.kind === 'rest').every(b => b.n === undefined && b.pace100 === null));
  const q = m.quality, flagged = iv.flatMap(s => s.lengths.filter(b => b.quality && ['suspect', 'implausible'].includes(b.quality.plausibility)));
  ok('R12 Plausibilitaet: 11 Bahnen auffaellig (10 verdaechtig, 1 ausgeschlossen: 25 m Brust in 12,3 s > Weltrekord-Tempo), alle in Intervall 3', q.suspect === 10 && q.implausible === 1 && flagged.every(b => b.interval === 3) && flagged.filter(b => b.quality.plausibility === 'implausible').map(b => b.stroke + ':' + b.duration).join() === 'breaststroke:12.25', J(q));
  ok('R13 alle 7 Kraul-Bahnen unter 15 s sind markiert; die 9 Bahnen mit ≤ 5 Zuegen sind markiert oder ohne Vergleich (Ruecken: 1 Bahn)', iv.flatMap(s => s.lengths).filter(b => b.kind === 'active' && b.stroke === 'freestyle' && b.duration < 15).every(b => b.quality.plausibility !== 'plausible')
    && iv.flatMap(s => s.lengths).filter(b => b.kind === 'active' && b.strokes <= 5).every(b => b.quality.plausibility !== 'plausible'));
  ok('R14 keine Bahn validiert (validated:false); Originalwerte unveraendert; der Datensatz wird nicht veraendert', iv.flatMap(s => s.lengths).every(b => !b.quality || b.quality.validated === false) && flagged.every(b => b.duration > 0) && J(a) === before);
  ok('R15 Gleichmaessigkeit entfaellt (nur 2 Intervalle derselben Lage, das dritte ist gemischt)', m.efficiency === null);
  ok('R16 SWOLF-Verlauf in Intervall 3 nur aus plausiblen Kraul-Bahnen (28): erste Haelfte 42,2 → zweite 43,9', iv[2].swolfTrend && iv[2].swolfTrend.stroke === 'freestyle' && iv[2].swolfTrend.n === 28 && iv[2].swolfTrend.first === 42.21 && iv[2].swolfTrend.second === 43.93 && iv[0].swolfTrend === null);
  const ls = SI.lengthSeries(m);
  ok('R17 Reihen je Bahn: 54 Punkte, auffaellige/ungepruefte-unsichere Bahnen als Luecke (nie geglaettet)', ls.pace100.length === 54 && ls.pace100.filter(v => v === null).length === 11 && ls.labels[53] === 54);
  ok('R18 Pruefstand je Intervall: alle Gegenproben stimmen → „consistent"', iv.every(s => s.validation === 'consistent'));
}

sec('P · Bahnen nicht geladen / Runden ohne Bewegungszeit');
{
  const m = SI.build(real(false)), iv = m.intervals;
  ok('P1 nur schlanke Runden (Rohblock ohne Bahnen): gleiche Intervalle und Schwimmzeit, Pause im Intervall abgeleitet (Intervallzeit − Schwimmzeit)', m.lengthsLoaded === false && m.quality === null && iv.map(s => Math.round(s.pace100Active)).join() === '161,149,100' && iv.every(s => s.restBasis === 'elapsed_minus_active' && s.lengths === null) && Math.round(iv[0].restInside) === 137);
  ok('P2 ohne Bahnen: Pruefstand „unverified", keine Bahnen-Reihen', iv.every(s => s.validation === 'unverified') && SI.lengthSeries(m) === null);
  const b = real(false); b.metrics.splits = b.metrics.splits.map(l => { const x = clone(l); delete x.movingDuration; return x; });
  const mb = SI.build(b);
  ok('P3 Runde ohne movingDuration und ohne Bahnen: KEINE Schwimmzeit, kein Schwimmtempo — nur Intervallzeit (als solche benannt)', mb.intervals.every(s => s.activeTime === null && s.pace100Active === null && s.pace100Elapsed > 0 && s.restInside === null) && mb.totals.activeTime === null && mb.sumChecks.timer === 'n/a');
  const c = real(true); c.metrics.splits = c.metrics.splits.map(l => { const x = clone(l); delete x.movingDuration; return x; });
  const mc = SI.build(c);
  ok('P4 Runde ohne movingDuration, Bahnen geladen: Schwimmzeit = Summe der aktiven Bahnen (benannt)', mc.intervals.every(s => s.activeBasis === 'sum_active_lengths') && r1(mc.totals.activeTime) === 1456.9);
}

sec('B · andere Becken und Lagen');
{
  /* 50-m-Becken: dieselbe Struktur, jede Bahn 50 m (synthetisch aus dem Mitschnitt: Distanzen × 2, Zeiten × 2,1) */
  const a = real(); const ext = a.metrics.ext;
  ext.splits.lapDTOs.forEach(l => { (l.lengthDTOs || []).forEach(b => { if (b.distance > 0) { b.distance = 50; b.duration = Math.round(b.duration * 2.1 * 1000) / 1000; b.averageSWOLF = (b.totalNumberOfStrokes || 0) * 2 + Math.round(b.duration); b.totalNumberOfStrokes = (b.totalNumberOfStrokes || 0) * 2; } }); if (l.distance > 0) { l.distance *= 2; } });
  a.metrics.splits.forEach((l, i) => { const rl = ext.splits.lapDTOs[i]; if (l.distance > 0) { l.distance = rl.distance; l.movingDuration = rl.lengthDTOs.filter(b => b.distance > 0).reduce((s, b) => s + b.duration, 0); l.totalNumberOfStrokes = rl.lengthDTOs.reduce((s, b) => s + (b.totalNumberOfStrokes || 0), 0); } });
  ext.fields.distance = 2700; ext.fields.poolLength = 5000; ext.fields.strokes = 1346;
  const m = SI.build(a);
  ok('B1 50-m-Becken: keine feste 25-m-Annahme — Distanz 2.700 m, 54 Bahnen, Tempo auf Schwimmzeit, Vergleichsgruppen je Bahnlaenge', m.totals.distance === 2700 && m.totals.activeLengths === 54 && m.intervals.every(s => s.lengths.filter(b => b.kind === 'active').every(b => b.distance === 50)) && Object.keys(m.lengthStats).every(k => k.endsWith('|50')) && m.sumChecks.distance === 'match', J(m.sumChecks));
  ok('B2 50-m-Becken: Plausibilitaet relativ zur eigenen Lage/Bahnlaenge — gleiche Bahnen auffaellig wie im 25-m-Fall (Verhaeltnisse bleiben)', m.quality.suspect + m.quality.implausible >= 10, J(m.quality));
  const u = SI.build({ sportId: 'swimming', source: 'garmin', metrics: { splits: [{ distance: 100, duration: 120, movingDuration: 100, swimStroke: 'BUTTERFLY' }, { distance: 0, duration: 30 }, { distance: 100, duration: 110, movingDuration: 95, swimStroke: 'DRILL' }] } });
  ok('B3 Schmetterling erkannt; unbekannter Garmin-Wert (DRILL) = „unknown", Rohwert bleibt erhalten — keine Schaetzung aus Tempo/Zugfrequenz', u.intervals[0].stroke === 'butterfly' && u.intervals[1].stroke === 'unknown' && u.intervals[1].strokeRaw === 'DRILL' && SI.strokeOf('freestyle') === 'freestyle');
  /* sehr schnelle, aber plausible Bahnen: 25 m in 13 s bei einem Median von 14 s (guter Schwimmer) — nicht markiert */
  const L = Array.from({ length: 10 }, (_, i) => ({ distance: 25, duration: i === 3 ? 13 : 14 + (i % 3) * 0.4, totalNumberOfStrokes: 9, averageSWOLF: 9 + Math.round(i === 3 ? 13 : 14 + (i % 3) * 0.4), swimStroke: 'FREESTYLE', lengthIndex: i + 1 }));
  const fast = { sportId: 'swimming', source: 'garmin', metrics: { splits: [{ lapIndex: 1, distance: 250, duration: 150, movingDuration: L.reduce((s, b) => s + b.duration, 0), numberOfActiveLengths: 10, swimStroke: 'FREESTYLE' }, { lapIndex: 2, distance: 0, duration: 60 }], ext: { splits: { lapDTOs: [{ lapIndex: 1, distance: 250, lengthDTOs: L }, { lapIndex: 2, distance: 0, lengthDTOs: [{ duration: 60, lengthIndex: 11 }] }] } } } };
  const mf = SI.build(fast);
  ok('B4 schnelle, aber plausible Bahn (13 s bei Median 14,4 s) bleibt plausibel — schnell ist nicht automatisch verdaechtig', mf.quality.suspect === 0 && mf.quality.implausible === 0 && mf.quality.plausible === 10, J(mf.quality));
  const few = clone(fast); few.metrics.ext.splits.lapDTOs[0].lengthDTOs = few.metrics.ext.splits.lapDTOs[0].lengthDTOs.slice(0, 3);
  ok('B5 zu wenige Vergleichsbahnen (< 5): relative Pruefung entfaellt → „ohne Vergleich", nie „verdaechtig" aus Mangel an Daten', SI.build(few).quality.unchecked === 3);
}

sec('E · Fehlerfaelle');
{
  const base = swimRow(5, true);
  ok('E1 keine Runden (heutige Produktion): kein Modell, kein Fehler', SI.build(base) === null && SI.build({}) === null && SI.build(null) === null);
  ok('E2 leere Rundenliste / nur Pausen: kein Modell', SI.build({ metrics: { splits: [] } }) === null && SI.build({ metrics: { splits: [{ distance: 0, duration: 60 }] } }) === null);
  const bad = { sportId: 'swimming', source: 'garmin', metrics: { splits: ['x', null, { distance: 'a', duration: 10 }, { distance: -5, duration: 10 }, { distance: 100, duration: 120, movingDuration: 100 }, { distance: 0 }, { distance: 50, duration: NaN, movingDuration: 45 }] } };
  const mb = SI.build(bad);
  ok('E3 kaputte Eintraege (Text, null, negative Distanz, fehlende Zeit) werden weggelassen, nicht geraten', mb && mb.intervals.length === 2 && mb.totals.restLaps === 0 && mb.intervals[1].elapsedTime === null && mb.intervals[1].pace100Elapsed === null && mb.intervals[1].activeTime === 45);
  ok('E4 ein einziges Intervall ohne Pause (Freiwasser 26.06.): kein Intervall-Block', SI.build({ sportId: 'swimming', source: 'garmin', metrics: clone(F.open_water_swimming.metrics) }).show === false);
  const lengthsBroken = real(); lengthsBroken.metrics.ext.splits.lapDTOs[0].lengthDTOs = 'kaputt';
  const ml = SI.build(lengthsBroken);
  ok('E5 kaputte Bahnenliste in einer Runde: dieses Intervall ohne Bahnen (Pause abgeleitet), die anderen mit Bahnen', ml.intervals[0].lengths === null && ml.intervals[0].restBasis === 'elapsed_minus_active' && ml.intervals[2].lengths.length === 60);
  const mm = real(); mm.metrics.ext.fields.activeLengths = 50;
  ok('E6 Abweichung zur Zusammenfassung wird gemeldet (aktive Bahnen „weicht ab"), nichts angeglichen', SI.build(mm).sumChecks.activeLengths === 'mismatch' && SI.build(mm).totals.activeLengths === 54);
}

sec('A · Einbindung');
{
  const a = real(), md = AA.analyze(a);
  ok('A1 Schwimmansicht: Modell md.swim, alte Runden-Intervalle (md.intervals) entfallen', md.swim && md.swim.intervals.length === 3 && md.intervals === null);
  ok('A2 Diagramme in fester Reihenfolge Tempo → Puls → SWOLF: „Tempo je Bahn", Puls, „SWOLF je Bahn"', md.charts.map(c => c.id).join() === 'lengthPace,hr,lengthSwolf', md.charts.map(c => c.id).join());
  const lp = md.charts.find(c => c.id === 'lengthPace');
  ok('A3 Tempo je Bahn: Werte aus den Bahnen, Luecken bei auffaelligen Bahnen, Beschriftung = Bahn-Nummer', lp.values.length === 54 && lp.labels.length === 54 && lp.points === 43 && lp.validation === 'unverified');
  ok('A4 metric-eligibility: Runden „bestaetigt" (Summe = Distanz und Bahnen), Bahnen „bestaetigt" (54 = activeLengths)', md.metrics.laps.validation === 'consistent' && md.metrics.laps.reason === 'lap_sums_match' && md.metrics.lengths.status === 'available' && md.metrics.lengths.validation === 'consistent' && md.metrics.lengths.reason === 'active_lengths_match');
  ok('A5 angezeigt: Runden und Bahnen in md.shown; Hauptkennzahlen unveraendert (1.350 m, 1:09:31, 1:48 /100 m)', md.shown.includes('laps') && md.shown.includes('lengths') && md.hero[0].value === 1350 && Math.round(md.hero[2].value) === 108);
  const slim = AA.analyze(real(false));
  ok('A6 Rohblock ohne Bahnen: Intervalle ja, keine Bahnen-Diagramme, Bahnen nicht verfuegbar (Grund in den Messdetails)', slim.swim && !slim.charts.some(c => /^length/.test(c.id)) && slim.metrics.lengths.status !== 'available' && !slim.shown.includes('lengths'));
  const loc = real(); delete loc.metrics.ext;
  const mloc = AA.analyze(loc, { extState: 'pending' });
  ok('A7 Rohblock wird noch geladen: Intervalle aus den lokalen Runden sofort da, Bahnen folgen (nicht geladen)', mloc.swim && mloc.swim.lengthsLoaded === false && mloc.metrics.lengths.status === 'not_loaded');
  const none = AA.analyze(swimRow(5, true));
  ok('A8 ohne Runden (Produktion heute): kein Intervall-Block, bisherige Kennzahlen und Diagramme wie in v8-452', none.swim === null && none.intervals === null && none.hero.length === 4 && none.charts.map(c => c.id).join() === 'hr');
  const ow = swimRow(1, true); ow.metrics.splits = clone(F.open_water_swimming.metrics.splits); ow.metrics.splits_source = 'garmin_splits';
  ok('A9 Freiwasser mit einer Runde: kein Intervall-Block, Ansicht wie bisher', AA.analyze(ow).swim === null);
  const comp = AA.completeness(a);
  ok('A10 interne Diagnose: Bahnen in der Ansicht und angezeigt', comp.rows.find(r => r.metric === 'lengths').displayed === true && comp.rows.find(r => r.metric === 'laps').displayed === true);
}

sec('L · Register, Bestzeiten, andere Sportarten');
{
  const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
  const st = L.update(null, RUNS, { timeZone: 'Europe/Berlin' }).state, best = k => L.currentBest(st.events[k]);
  ok('L1 Leistungsregister auf den 15 echten Laeufen unveraendert (4:21 / 23:38 aktiv / 29:11 / 1:01:49 / 2:20:47)', best('running.fastest_1000m@standard').value === 261 && best('running.fastest_5000m_active@standard').value === 1418 && best('running.fastest_5000m@standard').value === 1751 && best('running.fastest_10000m@standard').value === 3709 && best('running.fastest_21098m@standard').value === 8447);
  const rb = RB.measuredRunBests(RUNS);
  ok('L2 Laufbestzeiten der App unveraendert', rb.k1.sec === 261 && rb.k5.sec === 1751 && rb.active.k5.sec === 1418 && rb.k21.sec === 8447);
  const a = real(), b = swimRow(5, true);
  ok('L3 evaluate() (Register-Pruefung) der Schwimmeinheit gleich mit und ohne Runden/Bahnen — Schwimmanalyse erzeugt keine Rekorde', J(ME.overview(a)) === J(ME.overview(b)));
  const s2 = L.update(null, RUNS.concat([a]), { timeZone: 'Europe/Berlin' }).state;
  ok('L4 Register mit der Schwimmeinheit: keine Schwimm-Ereignisse aus Bahnen oder Intervallen', !Object.keys(s2.events || {}).some(k => /^swim|length|interval/.test(k)));
  ok('L5 Bahnen/Runden fuer Langzeitauswertungen gesperrt (ledger=false)', ['laps', 'lengths', 'swolf'].every(k => ME.describeActivity(a).metrics[k].ledger === false));
  const run = GEN.referenceActivity('running', 'best'); run.metrics.splits = [{ distance: 1000, duration: 300, averageHR: 150 }, { distance: 1000, duration: 295 }, { distance: 1000, duration: 290 }];
  const mr = AA.analyze(run);
  /* v8-454: Laufen nutzt die gemeinsame Intervall-Engine — drei gleich lange Runden = automatische Runden (Regel), zu wenige fuer eine Analyse */
  ok('L6 Laufen: Runden ueber engine/intervals.js (automatische Runden), kein Schwimm-Modell, keine Analyse aus drei Runden', mr.swim === null && mr.intervals && mr.intervals.v === 'intervals@1' && mr.intervals.segments.length === 3 && mr.intervals.segments.every(s => s.kind === 'auto_lap' && s.kindSource === 'rule') && mr.efficiency === null);
}

sec('U · Quelltext-Vertrag');
{
  const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8'), idx = readFileSync(new URL(_APPREL + 'index.html', import.meta.url), 'utf8'), sw = readFileSync(new URL(_APPREL + 'sw.js', import.meta.url), 'utf8');
  const blk = ui.slice(ui.indexOf('v8-453 · Schwimmintervalle'), ui.indexOf('function gmAaStatusTxt'));
  ok('U1 Modul geladen vor activity-analysis (index.html) und im Precache (sw.js)', idx.indexOf('js/engine/swim-intervals.js') > 0 && idx.indexOf('js/engine/swim-intervals.js') < idx.indexOf('js/engine/activity-analysis.js') && sw.includes("'./js/engine/swim-intervals.js'"));
  ok('U2 Oberflaeche rechnet nicht: keine Tempo-/Pausen-Rechnung, kein direkter Zugriff auf den Rohblock', !/\.reduce\(|metrics\.ext|lengthDTOs|movingDuration/.test(blk));
  ok('U3 Bahnen erst beim Aufklappen (aria-expanded, hidden), nie alle Intervalle zugleich', /aria-expanded/.test(blk) && /hidden/.test(blk) && /gmSwToggle/.test(blk));
  ok('U4 Texte ueber i18n (aa.sw.*), Hinweis „Messwert möglicherweise ungenau" vorhanden', /_uiT\('aa\.sw\./.test(blk) && O.i18n.t('aa.sw.q_suspect') === 'Messwert möglicherweise ungenau');
}

console.log('\n' + (fail ? '❌' : '✅') + ' swim_intervals_v453: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
