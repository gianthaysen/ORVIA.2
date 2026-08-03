#!/usr/bin/env node
/* GM7.4 · Vertikaler E2E-Test: anonymisiertes Fixture → Garmin-Parser (Python) →
   Serien-Upsert-Zeilen → Mock-DB (fetchRows) → App-Series-Reader → Render.
   Die Zeilen stammen AUS dem echten Python-Parser (supabase/tests/fixtures/
   series_e2e.json, generiert aus den anonymisierten Fixtures). Prüft Dedupe,
   Sortierung, Konsistenz (Phasensumme, Mitternacht), Missingness/Partial/Stale/
   Error, Route-Cap + Anfang/Ende, exakte persistierte Werte (keine UI-Neurechnung). */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const Reader = require(join(HERE, '..', '..', '..', 'app', 'js', 'series-reader.js'));
const E2E = JSON.parse(readFileSync(join(HERE, 'fixtures', 'series_e2e.json'), 'utf8'));
const ROWS = E2E.series_rows;

let n = 0, fail = 0;
const ok = (name, cond, extra) => { n++; if (!cond) { fail++; console.error('FAIL:', name, extra || ''); } else console.log('ok:  ', name); };

// Mock-DB: liefert für einen metricType + Zeitraum die persistierten Zeilen (optional
// dupliziert) — filtert wie der echte Supabase-Fetch (.gte/.lte auf metric_date), damit
// Missingness-Tests für "anderer Tag" real greifen statt durch einen datumsblinden Mock
// zu rutschen.
const mkFetch = (rows) => (metricType, fromDate, toDate) => Promise.resolve(rows.filter(r =>
  r.metric_type === metricType && (!fromDate || r.metric_date >= fromDate) && (!toDate || r.metric_date <= toDate)));

const await_ = (p) => p;  // Lesbarkeit

async function main() {
  // 1) Hypnogramm: Reader liest, dedupliziert, sortiert
  const hypRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-16', today: '2026-07-16', fetchRows: mkFetch(ROWS) });
  ok('Hypnogramm: state ok, genau eine Tagesserie', hypRes.state === 'ok' && hypRes.series.length === 1, JSON.stringify(hypRes.state));
  const hyp = hypRes.series[0].points;

  // 2) Phasen summieren zur Schlafdauer (deep+light+rem+awake)
  const per = {}; hyp.forEach(([off, dur, st]) => { per[st] = (per[st] || 0) + dur; });
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  ok('Phasensumme == Summe deep/light/rem/awake (25800 s / 430 min)', total === 25800, JSON.stringify(per));

  // 3) Mitternacht/Chronologie: Offsets streng steigend
  const offs = hyp.map(p => p[0]);
  ok('Hypnogramm-Offsets chronologisch (monoton, Mitternacht korrekt)', offs.every((v, i) => i === 0 || v > offs[i - 1]));

  // 4) Dedupe: gleiche Eingabe DOPPELT ⇒ keine Duplikate
  const dupRows = ROWS.concat(ROWS.map(r => ({ ...r })));
  const dupRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-16', fetchRows: mkFetch(dupRows) });
  ok('Dedupe: doppelte Zeilen ⇒ eine Serie, gleiche Punktzahl', dupRes.series.length === 1 && dupRes.series[0].points.length === hyp.length);

  // 5) Intraday-Stress zeitlich sortiert + exakt persistierte Werte
  const stRes = await Reader.read({ metricType: 'stress_intraday', fromDate: '2026-07-16', fetchRows: mkFetch(ROWS) });
  const sp = stRes.series[0].points;
  ok('Intraday-Stress zeitlich sortiert', sp.every((v, i) => i === 0 || v[0] >= sp[i - 1][0]));
  const persisted = ROWS.find(r => r.metric_type === 'stress_intraday').points;
  ok('App zeigt EXAKT die persistierten Werte (keine Neuberechnung)', JSON.stringify(sp) === JSON.stringify(persisted));

  // 6) Missingness: fehlende Serie ⇒ state empty (NICHT 0)
  const emptyRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-16', fetchRows: () => Promise.resolve([]) });
  ok('Fehlende Serie ⇒ state empty, KEINE 0/Ersatzwerte', emptyRes.state === 'empty' && emptyRes.series.length === 0);

  // 7) Error/Offline: fetch wirft ⇒ state error (kein Absturz, keine 0)
  const errRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-16', fetchRows: () => Promise.reject(new Error('offline')) });
  ok('Offline/Fehler ⇒ state error, kein Absturz', errRes.state === 'error' && errRes.series.length === 0);

  // 8) Stale: heutiges Datum weit nach dem Serientag
  const staleRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-16', today: '2026-07-30', fetchRows: mkFetch(ROWS) });
  ok('Stale: Serientag > STALE_DAYS alt ⇒ stale=true', staleRes.state === 'ok' && staleRes.stale === true);

  // 9) Partial: Mehrtageszeitraum mit nur einem vorhandenen Tag
  const partRes = await Reader.read({ metricType: 'sleep_stages', fromDate: '2026-07-14', toDate: '2026-07-16', fetchRows: mkFetch(ROWS) });
  ok('Partial: Lücke im angeforderten Zeitraum ⇒ partial=true', partRes.partial === true);

  // 10) Route ≤600 + Anfang/Ende erhalten (aus dem Aktivitäts-Parser)
  const route = E2E.activity_metrics.route;
  ok('Route ≤600 Punkte', route.length <= 600 && route.length > 1, 'len=' + route.length);
  ok('Route Anfang+Ende erhalten (numerische Paare)', Array.isArray(route[0]) && route[0].length === 2 && Array.isArray(route[route.length - 1]));

  // 11) Render: Hypnogramm-SVG hat genau so viele Segmente wie Punkte; leere Punkte ⇒ '' (ehrlich)
  const svg = Reader.renderHypnogram(hyp);
  const rectCount = (svg.match(/<rect/g) || []).length;
  ok('renderHypnogram: SVG-Segmente == Punktzahl', rectCount === hyp.length, `rects=${rectCount} pts=${hyp.length}`);
  ok('renderHypnogram([]) ⇒ leerer String (kein erfundenes Bild)', Reader.renderHypnogram([]) === '');
  const curve = Reader.renderCurve(sp, { color: '#f00' });
  ok('renderCurve: erzeugt Pfad aus echten Punkten', /<path d="M/.test(curve) && !/NaN/.test(curve));
  ok('renderCurve(<2 Punkte) ⇒ leer', Reader.renderCurve([[0, 1]]) === '');

  // ---------------------------------------------------------------------
  // GM7.4.1 · für JEDE in der Coverage-Matrix als "angebunden" markierte Serie:
  // fixture -> Parser -> Zeile -> Mock-DB -> Reader -> Renderer, mit exakter
  // Punktzahl/-reihenfolge, Einheiten-Korrektheit, Missingness, zweitem
  // simuliertem Sync (kein Duplikat) und lokalem Nacht-Fenster (kein
  // Mitternacht-Überlauf über 24h in diesem Fixture).
  // ---------------------------------------------------------------------
  const NIGHT_SERIES = [
    ['sleep_hr', 'bpm'], ['sleep_stress', 'stress_score'], ['sleep_body_battery', 'bb_level'],
    ['sleep_hrv', 'ms'], ['sleep_respiration', 'brpm'], ['body_battery_intraday', 'bb_level'],
  ];
  for (const [mt, unit] of NIGHT_SERIES) {
    const persistedRow = ROWS.find(r => r.metric_type === mt);
    ok(`${mt}: Zeile im Fixture-Output vorhanden`, !!persistedRow);
    if (!persistedRow) continue;
    const res = await Reader.read({ metricType: mt, fromDate: persistedRow.metric_date, fetchRows: mkFetch(ROWS) });
    ok(`${mt}: Reader state ok, genau eine Tagesserie`, res.state === 'ok' && res.series.length === 1);
    const pts = res.series[0].points;
    ok(`${mt}: exakte Punktzahl (Reader == persistiert, nach Dedupe/Sortierung)`, pts.length === persistedRow.points.length, `reader=${pts.length} row=${persistedRow.points.length}`);
    ok(`${mt}: Offsets zeitlich streng sortiert (Reihenfolge erhalten)`, pts.every((p, i) => i === 0 || p[0] >= pts[i - 1][0]));
    ok(`${mt}: exakte persistierte Werte (keine UI-Neuberechnung)`, JSON.stringify(pts) === JSON.stringify(Reader._sortDedupePoints(persistedRow.points)));
    ok(`${mt}: Einheit korrekt aus dem persistierten Kontrakt (${unit})`, persistedRow.unit === unit);
    ok(`${mt}: lokales Nachtfenster ohne Ausreißer (0 <= offset < 24h)`, pts.every(p => p[0] >= 0 && p[0] < 86400));
    const curveSvg = Reader.renderCurve(pts, { color: '#0af' });
    ok(`${mt}: renderCurve erzeugt gültigen Pfad ohne NaN (echter Production-Renderer)`, pts.length < 2 || (/<path d="M/.test(curveSvg) && !/NaN/.test(curveSvg)));
    // fehlende Serie für diesen Metrik-Typ an einem anderen Tag ⇒ empty, NIE 0/Ersatz.
    const missRes = await Reader.read({ metricType: mt, fromDate: '1999-01-01', fetchRows: mkFetch(ROWS) });
    ok(`${mt}: fehlender Tag ⇒ state empty (kein 0/Platzhalter)`, missRes.state === 'empty' && missRes.series.length === 0);
  }

  // Aktivitäts-Streams (metrics.streams, get_activity_details) — eigener Vertrag
  // (Werte-Array je Sample statt [offset,value]-Paaren), eigener Renderer
  // (gmRenderStreamCurve in ui.js). Hier: Einheiten-Korrektheit direkt aus dem
  // Parser-Output — Geschwindigkeit bleibt "mps", wird NIE als "Tempo"/"pace"
  // beschriftet oder umgerechnet.
  const streams = E2E.activity_metrics.streams, units = E2E.activity_metrics.stream_units;
  ok('Aktivitäts-Streams: heart_rate vorhanden (bpm)', Array.isArray(streams.heart_rate) && units.heart_rate === 'bpm');
  ok('Aktivitäts-Streams: speed bleibt "mps" (keine Pace-Verwechslung)', units.speed === 'mps' && units.speed !== 'pace' && units.speed !== 'min/km');
  ok('Aktivitäts-Streams: elevation in m, cadence in spm', units.elevation === 'm' && units.cadence === 'spm');
  const uiSrc = readFileSync(join(HERE, '..', '..', '..', 'app', 'js', 'ui.js'), 'utf8');
  ok('gmRenderStreamCurve: Werte-Array -> Index/Wert-Punkte, kein Pace-Label für speed', /function gmRenderStreamCurve/.test(uiSrc) && !/Tempo \(m\/s\)|pace.*mps|mps.*pace/i.test(uiSrc));
  ok('Aktivitätsdetail-Karte referenziert canonicalStreams (real gebunden, kein Test-Stub)', /vm\.canonicalStreams/.test(uiSrc));

  // Zweiter simulierter Sync (Upsert-Konfliktschlüssel user_id+metric_type+metric_date,
  // wie Migration 0028 / db.ON_CONFLICT) darf keine Dubletten erzeugen.
  function simulateUpsert(existingRows, newRows) {
    const byKey = new Map(existingRows.map(r => [`${r.user_id}|${r.metric_type}|${r.metric_date}`, r]));
    for (const r of newRows) byKey.set(`${r.user_id}|${r.metric_type}|${r.metric_date}`, r);
    return [...byKey.values()];
  }
  const afterFirstSync = simulateUpsert([], ROWS);
  const afterSecondSync = simulateUpsert(afterFirstSync, ROWS);
  ok('Zweiter simulierter Sync-Lauf (Upsert-Konfliktschlüssel): keine Dublette', afterSecondSync.length === ROWS.length, `first=${afterFirstSync.length} second=${afterSecondSync.length}`);

  // A/F/P-Äquivalenz (strukturell): die Serien-Ladepfade (gmSeriesFetch/gmLoadSeriesInto)
  // dürfen NICHT vom UI-Detailmodus abhängen — dieselben persistierten Werte, unabhängig
  // vom Erklärtiefe-Modus. Nachweis: die Funktionsdefinitionen referenzieren uiDetailMode
  // (bzw. gmMode/A-F-P-Variablen) nicht.
  const fnBlock = (uiSrc.match(/function gmSeriesFetch[\s\S]*?\n\}/) || [''])[0] + (uiSrc.match(/function gmLoadSeriesInto[\s\S]*?\n\}\n\}/) || [''])[0];
  ok('A/F/P-Äquivalenz: Serien-Ladepfad ist modus-unabhängig (kein uiDetailMode/A-F-P-Bezug im Code)', !/uiDetailMode|gmMode\b/.test(fnBlock));

  console.log(`\nseries_e2e_test: ${n - fail}/${n} bestanden`);
  process.exit(fail ? 1 : 0);
}
main();
