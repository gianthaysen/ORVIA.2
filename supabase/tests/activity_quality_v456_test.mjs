/* ============================================================
   ORVIA · activity_quality_v456 — Unified Activity Experience Quality Pass (Engine + Diagramm-Geometrie, ohne Browser)
   Z  Zeitachsen/Pausen: Belegstaerke der Pause (Timer belegt / unklar / nur rechnerisch), Zwift 07.10. = unklar
   G  Diagramm-Geometrie (activity-chart@2): Luecken, verkuerzte Achse, Stillstand ohne Wert, robuste Tempoachse, keine Interpolation
   A  Analyse-Modell: Kennwerte der ganzen Aktivitaet (REF), Stillstandsmarken, Distanz je Punkt, Bahnen mit Markierung statt Loch
   B  Rad: Diagrammpunkte erzeugen keine eigene Wahrheit (Zwift 112 W / 326 W)
   K  Kraft/Sonstiges: Uebersicht aus der Quelle, Intervall-Analyse liefert Werte fuer die Highlights
   Vorlage der Hilfsfunktionen: intervals_v454_test (echte, anonymisierte Garmin-Mitschnitte vom 19.10.2026). */
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


const AC = require(new URL(_APPREL + 'js/activity-chart.js', import.meta.url).pathname);
sec('Z · Zeitachsen und Pausen');
{
  const z = AA.analyze(real('cycling__virtual_ride__indoor'), { extState: 'loaded' });
  const pz = z.metrics.pause;
  ok('Z1 Zwift 07.10.: Differenz Gesamtzeit − Dauer 11:07 bleibt sichtbar, aber Ursache „unklar" (Messreihe = Gesamtzeit, Timer widerspricht)', pz && pz.value === 667 && pz.evidence === 'unclear', JSON.stringify(pz && { v: pz.value, e: pz.evidence }));
  const r = real('running__running__intervals'), rm = AA.analyze(r, { extState: 'loaded' }), rp = rm.metrics.pause;
  ok('Z2 Lauf mit Garmin-Timer (Uhr angehalten): Pause als „vom Timer belegt"', rp && rp.value > 60 && rp.evidence === 'timer_counter', JSON.stringify(rp && { v: rp.value, e: rp.evidence, b: rp.basis }));
  const nb = AA.analyze(real('cycling__cycling__steady'), { extState: 'loaded' }).metrics.pause;
  ok('Z3 kaum Unterschied (≤ 2 s): keine Pausenbehauptung', !nb || nb.evidence === 'none' || nb.value > 2, JSON.stringify(nb && { v: nb.value, e: nb.evidence }));
  const before = J(r); AA.analyze(r, { extState: 'loaded' });
  ok('Z4 Analyse veraendert die Aktivitaet nicht (Rohdaten, Zeiten, Korrekturen unberuehrt)', J(r) === before);
}
sec('G · Diagramm-Geometrie (activity-chart@2)');
{
  const x = [], v = [], mk = [];
  for (let i = 0; i < 60; i++) { x.push(i * 10); v.push(300 + (i % 5)); mk.push(null); }
  for (let i = 0; i < 60; i++) { x.push(1200 + i * 10); v.push(310 + (i % 3)); mk.push(null); }      /* 610 s ohne Messwerte */
  v[20] = null; mk[20] = 'stop'; v[30] = 2400; mk[30] = null;                                        /* Stillstand ohne Tempo, Gehpunkt */
  const full = AC.model({ values: v, x, marks: mk, pace: true }, 600, 220), comp = AC.model({ values: v, x, marks: mk, pace: true, compress: true }, 600, 220);
  ok('G1 Abschnitt ohne Messwerte erkannt (610 s), Linie bricht dort ab — keine Verbindung ueber die Luecke', full.gaps.length === 1 && full.gapTotal === 610 && !full.segs.some(sg => sg.some(p => p.x === 590) && sg.some(p => p.x === 1200)), JSON.stringify(full.gaps));
  ok('G2 „Aktive Zeit": Luecke auf einen Messabstand verkuerzt (Achse endet bei 1190 − 600 = 590 s statt 1790 s); „Gesamtzeit": volle Achse', comp.compressed && Math.round(comp.x1) === 1190 && Math.round(full.x1) === 1790 && comp.gaps[0].dur === 610, [comp.x1, full.x1].join());
  ok('G3 Stillstand ohne Tempowert bleibt als Punkt (am Grund), gehoert nicht zur Linie', full.have.some(p => p.i === 20 && p.mark === 'stop') && !full.segs.some(sg => sg.some(p => p.i === 20)));
  ok('G4 robuste Tempoachse: Gehpunkt 40:00/km bleibt Messwert, liegt „ausserhalb" (Dreieck) statt die Achse zu sprengen', full.have.find(p => p.i === 30).mark === 'out' && full.y1 < 1000 && v[30] === 2400, String(full.y1));
  ok('G5 keine Glaettung: jeder Linienpunkt ist ein uebergebener Wert', full.segs.every(sg => sg.every(p => v[p.i] === p.v)));
  const idx = AC.model({ values: [1, 2, null, 4, 5, 6], x: null, marks: [null, null, null, 'flag', null, null] }, 300, 100);
  ok('G6 Index-Achse (Bahnen): fehlender Wert = Luecke, markierte Bahn = Einzelpunkt ohne Linie', idx.segs.length === 2 && idx.segs[0].length === 2 && idx.segs[1].length === 2 && idx.have.find(p => p.i === 3).mark === 'flag', JSON.stringify(idx.segs.map(s => s.map(p => p.i))));
}
sec('A · Analyse-Modell');
{
  const run = AA.analyze(real('running__running__intervals'), { extState: 'loaded' });
  const pace = run.charts.find(c => c.id === 'paceKm'), hr = run.charts.find(c => c.id === 'hr'), cad = run.charts.find(c => c.id === 'cadence');
  ok('A1 Kennwerte der ganzen Aktivitaet je Diagramm (Ø/Max aus der Zusammenfassung, nicht aus den Diagrammpunkten)', pace.ref.avg === 'paceKm' && hr.ref.avg === 'avgHr' && hr.ref.max === 'maxHr' && cad.ref.avg === 'runningCadence');
  ok('A2 Distanz je Messpunkt (fuer „Kilometer 12,4" in der Ablesezeile), gleiche Laenge wie die Reihe', Array.isArray(pace.dist) && pace.dist.length === pace.values.length && pace.dist.filter(x => x !== null).every((d, i, a) => !i || d >= a[i - 1] - 1));
  const spd = run.metrics.speedSeries && run.metrics.speedSeries.value;
  const stops = pace.marks ? pace.marks.map((m, i) => m === 'stop' ? i : -1).filter(i => i >= 0) : [];
  ok('A3 Stillstand je Punkt markiert genau dort, wo die Geschwindigkeit ≤ 0,3 m/s ist (Tempo und Laufkadenz); nichts geloescht', Array.isArray(spd) && stops.every(i => spd[i] <= 0.3) &&
    spd.every((x, i) => !(typeof x === 'number' && x <= 0.3) || (pace.marks && pace.marks[i] === 'stop')) && pace.values.length === spd.length, 'Stillstand ' + stops.length + ' von ' + (spd || []).length);
  const FS = JSON.parse(readFileSync(new URL('./fixtures/swim_capture_v453.json', import.meta.url), 'utf8'));
  const sa = swimRow(5, true); sa.metrics.splits = FS.lap_swimming.metrics.splits; sa.metrics.splits_source = 'garmin_splits';
  sa.metrics.ext = Object.assign({}, sa.metrics.ext, { fields: FS.lap_swimming.metrics.ext.fields, splits: FS.lap_swimming.metrics.ext.splits, extras: { splits: 'ok' } });
  const sw = AA.analyze(sa, { extState: 'loaded' });
  const lp = sw.charts.find(c => c.id === 'lengthPace');
  ok('A4 Schwimmen je Bahn (echter Mitschnitt): auffaellige Bahnen bleiben Werte (markiert flag/excl, mit Grund), Ø/Bereich nur aus plausiblen Bahnen', !!lp && lp.marks && lp.marks.some(Boolean) && (lp.values.filter(x => x !== null).length >= lp.points && (!lp.marks || lp.marks.every((m, i) => !m || (lp.reasons && Array.isArray(lp.reasons[i]))))), lp ? JSON.stringify({ n: lp.values.length, p: lp.points, m: (lp.marks || []).filter(Boolean).length }) : 'keine Bahnen');
}
sec('B · Rad: eine Wahrheit');
{
  const z = AA.analyze(real('cycling__virtual_ride__indoor'), { extState: 'loaded' }), pw = z.charts.find(c => c.id === 'power');
  ok('B1 Ueberschrift Ø 112 W und Max 326 W aus der Aktivitaet; Diagrammpunkte (Auswahl) hoechstens 214 W — Hinweis statt neuer Wahrheit', Math.round(z.metrics.avgPower.value) === 112 && Math.round(z.metrics.maxPower.value) === 326 && pw.max < 326 && pw.ref.max === 'maxPower', JSON.stringify([z.metrics.avgPower.value, z.metrics.maxPower.value, pw.max]));
  ok('B2 Zwift: Hauptzahl gemessene Leistung, keine modellierte Geschwindigkeits-/Hoehenkurve', z.hero[0].id === 'avgPower' && !z.charts.some(c => c.id === 'speedKmh' || c.id === 'elevation'));
}
sec('K · Kraft, Sonstiges, Highlights');
{
  const g = { id: 'g1', sportId: 'gym', source: 'orvia_workout', status: 'completed', durationSeconds: 4020, summary: { exerciseCount: 2, workingSetCount: 5, totalVolumeKg: 3360, avgHr: 112 }, metrics: {} };
  const gm = AA.analyze(g, {});
  ok('K1 Kraft (synthetisch): Hauptzahl Volumen, dann Dauer · Saetze · Uebungen (nur Vorhandenes)', gm.hero.map(d => d.id).join() === 'volume,duration,workingSets,exercises', gm.hero.map(d => d.id).join());
  const f = { id: 'f1', sportId: 'football', source: 'garmin', status: 'completed', durationSeconds: 5400, summary: { avgHr: 141, maxHr: 178 }, metrics: {} };
  const fm = AA.analyze(f, {});
  ok('K2 Fussball: Dauer zuerst, dann Puls; keine erfundene Distanz', fm.hero[0].id === 'duration' && !fm.hero.some(d => d.id === 'distance'), fm.hero.map(d => d.id).join());
  const iv = IV.build(act('running', [lap(1, 1000, 300), lap(2, 0, 90), lap(3, 1000, 296), lap(4, 0, 90), lap(5, 1000, 292), lap(6, 0, 90), lap(7, 1000, 290)]), {});
  const an = iv && iv.analytics;
  ok('K3 Intervall-Analyse liefert Werte je vergleichbarer Belastung (fuer Highlights) — Pausenrunden (0 m) nie dabei', an && an.comparable && an.values.length === an.members.length && an.dists.every(d => d >= 1000) && an.values.every(v => v > 200), JSON.stringify(an && { m: an.members, v: an.values.map(Math.round) }));
}
console.log('\n' + (fail ? '❌' : '✅') + ' activity_quality_v456: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
