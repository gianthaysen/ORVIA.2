/* ============================================================
   ORVIA · Batch 3b.1b — zentrale Garmin-Summary-Normalisierung.
   Vertrag an der kanonischen Activity-Grenze (snake_case → camelCase).
   node supabase/tests/batch3b1b_activity_summary_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');
const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.console = { log() {}, warn() {}, error() {} };
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.parseInt = parseInt; sb.parseFloat = parseFloat;
vm.createContext(sb);
['training-domain.js', 'activity-normalize.js', 'activity-config.js'].forEach(f => vm.runInContext(src(f), sb, { filename: f }));
const AN = sb.ORVIA.activityNormalize;
const C = sb.ORVIA.activityConfig;
const J = o => JSON.stringify(o);

/* ---------- A: Garmin snake_case → kanonisch camelCase ---------- */
{
  const garminRun = { distance_m: 10000, avg_hr: 150, max_hr: 172, elevation_gain_m: 80, calories_kcal: 700, avg_speed_mps: 3.33, name: 'Morning Run' };
  const r = AN.normalizeActivitySummary(garminRun, 'running');
  ok('A1 Garmin-Running: distance_m:10000 ⇒ distanceKm 10, kein distanceM/keine snake_case-Reste',
    r.distanceKm === 10 && r.distanceM == null && r.distance_m == null && r.distance_km == null);
  ok('A2 HF/MaxHF/Höhenmeter/Kalorien korrekt gemappt',
    r.avgHr === 150 && r.maxHr === 172 && r.elevationM === 80 && r.caloriesKcal === 700 && r.avg_hr == null && r.max_hr == null && r.elevation_gain_m == null && r.calories_kcal == null);
  ok('A3 Geschwindigkeit: avgSpeedMps übernommen + avgSpeedKmh abgeleitet', r.avgSpeedMps === 3.33 && r.avgSpeedKmh === 11.99 && r.avg_speed_mps == null);
  ok('A4 name durchgereicht', r.name === 'Morning Run');
  // Swimming: distance_m bleibt Meter, KEINE km-Konvertierung.
  const swim = AN.normalizeActivitySummary({ distance_m: 1500, avg_hr: 140 }, 'swimming');
  ok('A5 Garmin-Swimming: distance_m:1500 ⇒ distanceM 1500, KEIN distanceKm (keine falsche km-Konvertierung)',
    swim.distanceM === 1500 && swim.distanceKm == null);
  // Rowing ist ebenfalls meterbasiert.
  const row = AN.normalizeActivitySummary({ distance_m: 2000 }, 'rowing');
  ok('A6 Rowing meterbasiert ⇒ distanceM 2000, kein distanceKm', row.distanceM === 2000 && row.distanceKm == null);
}

/* ---------- B: camelCase-Priorität / Idempotenz / Nicht-Mutation ---------- */
{
  const manual = { distanceKm: 12.41, avgHr: 150, note: 'egal' };
  const before = J(manual);
  const r = AN.normalizeActivitySummary(manual, 'running');
  ok('B1 manuelles camelCase unverändert (distanceKm 12.41, avgHr 150, note erhalten)', r.distanceKm === 12.41 && r.avgHr === 150 && r.note === 'egal');
  ok('B2 Eingabe NICHT mutiert', J(manual) === before);
  const r2 = AN.normalizeActivitySummary(r, 'running');
  ok('B3 idempotent: normalize(normalize(x)) === normalize(x)', J(r2) === J(r));
  // Gemischt: camelCase gewinnt vor snake_case.
  const mixed = AN.normalizeActivitySummary({ distanceKm: 5, distance_m: 9999, avgHr: 148, avg_hr: 99 }, 'running');
  ok('B4 gemischt camel/snake ⇒ camelCase gewinnt (distanceKm 5, avgHr 148), snake ignoriert',
    mixed.distanceKm === 5 && mixed.avgHr === 148 && mixed.distanceM == null && mixed.distance_m == null);
  // Unbekannte Felder nicht verlieren.
  const keep = AN.normalizeActivitySummary({ distance_m: 5000, weirdField: 'behalten' }, 'running');
  ok('B5 unbekannte Felder bleiben erhalten', keep.weirdField === 'behalten' && keep.distanceKm === 5);
}

/* ---------- C: kein Meter⇄km ohne Sportkontext ---------- */
{
  const noCtx = AN.normalizeActivitySummary({ distance_m: 7000 }, null);
  ok('C1 ohne Sportkontext (sportId null) ⇒ distance_m NICHT still in km umgedeutet (distanceM 7000, kein distanceKm)',
    noCtx.distanceM === 7000 && noCtx.distanceKm == null);
}

/* ---------- D: beide Server-Pfade byte-identisch ---------- */
{
  const summary = { distance_m: 10000, avg_hr: 150, max_hr: 172, calories_kcal: 700, elevation_gain_m: 80, avg_speed_mps: 3.33, name: 'Run' };
  const viaRecord = AN.normalizeActivityRecord({ sport_id: 'running', source: 'garmin', source_record_id: 'x', summary: summary }).summary;
  const viaServer = C.normalizeServerActivity({ sport_id: 'running', source: 'garmin', source_record_id: 'x', summary: summary }).summary;
  ok('D1 normalizeActivityRecord und normalizeServerActivity liefern BYTE-IDENTISCHE kanonische Summary', J(viaRecord) === J(viaServer));
  ok('D2 beide Pfade ⇒ distanceKm 10 (nicht als Meter)', viaRecord.distanceKm === 10 && viaServer.distanceKm === 10);
}

/* ---------- E: Detail-Pace sport-bewusst ---------- */
{
  const run = AN.activityDistancePace('running', { distanceKm: 10 }, 3000);   // 3000 s / 10 km = 5:00/km
  /* Kalibrierung: Distanz-Label ist seit der Vereinheitlichung auf deutsche Formatierung
     „10,0 km" (fmtDe, eine Nachkommastelle) — die Pace-Logik selbst ist unveraendert. */
  ok('E1 Laufpace pro Kilometer korrekt (10 km / 50 min ⇒ 5:00/km)', run.paceLabel === '5:00/km' && run.distanceLabel === '10,0 km');
  const swim = AN.activityDistancePace('swimming', { distanceM: 1500 }, 1800); // 1800 s / (1500/100) = 2:00/100 m
  ok('E2 Schwimmpace pro 100 m korrekt (1500 m / 30 min ⇒ 2:00/100 m)', swim.paceLabel === '2:00/100 m' && swim.distanceLabel === '1.500 m');
  // Ein Lauf mit distanceM darf NICHT als /100-m-Schwimm-Pace erscheinen.
  const runM = AN.activityDistancePace('running', { distanceM: 10000 }, 3000);
  ok('E3 Lauf mit distanceM ⇒ Pace pro KM, niemals /100 m', /\/km$/.test(runM.paceLabel || '') && !/100\s?m/.test(runM.paceLabel || ''));
}

/* ---------- F: physisch unmögliche Werte gehärtet (3b.1c-4) ---------- */
{
  const neg = AN.normalizeActivitySummary({ distance_m: -500, avg_hr: -10, max_hr: -5, calories_kcal: -100, elevation_gain_m: -20, avg_speed_mps: -3 }, 'running');
  ok('F1 negative Distanz/HF/Kalorien/Höhengewinn/Geschwindigkeit ⇒ ENTFERNT (nicht geclampt/erfunden)',
    neg.distanceKm == null && neg.avgHr == null && neg.maxHr == null && neg.caloriesKcal == null && neg.elevationM == null && neg.avgSpeedMps == null && neg.avgSpeedKmh == null);
  const naninf = AN.normalizeActivitySummary({ distanceKm: NaN, avgHr: Infinity, caloriesKcal: -Infinity }, 'running');
  ok('F2 NaN/Infinity ⇒ entfernt', naninf.distanceKm == null && naninf.avgHr == null && naninf.caloriesKcal == null);
  const partial = AN.normalizeActivitySummary({ distance_km: '100abc', avg_hr: '150', calories_kcal: '' }, 'running');
  ok('F3 teilweise numerischer String ("100abc") ⇒ verworfen; vollständiger ("150") ⇒ akzeptiert; leer ⇒ verworfen',
    partial.distanceKm == null && partial.avgHr === 150 && partial.caloriesKcal == null);
  const zeroPos = AN.normalizeActivitySummary({ distance_km: 0, avg_hr: 0, elevation_gain_m: 0, calories_kcal: 250 }, 'running');
  ok('F4 gültige Null-/Positivwerte bleiben erhalten', zeroPos.distanceKm === 0 && zeroPos.avgHr === 0 && zeroPos.elevationM === 0 && zeroPos.caloriesKcal === 250);
}

/* ---------- G: PURE Detail-Datenaufbereitung (der Renderer konsumiert genau dies) ---------- */
{
  // Name aus summary.name; metrics.name nur Fallback.
  const m1 = AN.activityDetailModel('running', { name: 'Summary-Name', distanceKm: 10 }, 3000, { name: 'Metrics-Name' });
  ok('G1 Name aus summary.name (metrics nur Fallback)', m1.name === 'Summary-Name');
  const m2 = AN.activityDetailModel('running', { distanceKm: 10 }, 3000, { name: 'Metrics-Name' });
  ok('G1b metrics.name als Fallback wenn summary.name fehlt', m2.name === 'Metrics-Name');
  // Laufpace primär aus Dauer/Distanz.
  ok('G2 Laufpace primär aus Dauer/Distanz (10 km / 50 min ⇒ 5:00/km)', m1.paceLabel === '5:00/km' && m1.distanceLabel === '10,0 km');
  // Pace-Fallback über Geschwindigkeit, wenn Dauer/Distanz-Kombination fehlt.
  const mSpd = AN.activityDetailModel('running', { distanceKm: 10, avgSpeedKmh: 12 }, null, {});
  ok('G3 Pace-Fallback über avgSpeedKmh (12 km/h ⇒ 5:00/km)', mSpd.paceLabel === '5:00/km');
  const mSpdMps = AN.activityDetailModel('running', { avgSpeedMps: 5 }, null, {});
  ok('G3b Pace-Fallback über avgSpeedMps ohne Distanz (5 m/s ⇒ 3:20/km)', mSpdMps.paceLabel === '3:20/km');
  // Schwimmen sport-bewusst pro 100 m.
  const mSwim = AN.activityDetailModel('swimming', { distanceM: 1500 }, 1800, {});
  ok('G4 Schwimmpace pro 100 m (1500 m / 30 min ⇒ 2:00/100 m)', mSwim.paceLabel === '2:00/100 m');
  // Niemals negative/ungültige Werte im Detailmodell.
  const mNeg = AN.activityDetailModel('running', { distanceKm: -10, avgHr: -5, maxHr: 180, caloriesKcal: -1, elevationM: 50 }, 3000, {});
  ok('G5 negative Werte erscheinen NICHT im Detailmodell (nur gültige)',
    mNeg.distanceLabel == null && mNeg.avgHr == null && mNeg.caloriesKcal == null && mNeg.maxHr === 180 && mNeg.elevationM === 50);
  // Determinismus / Nicht-Mutation / kein Throw.
  const inSum = { distanceKm: 10, name: 'x' }; const inBefore = J(inSum);
  const a = AN.activityDetailModel('running', inSum, 3000, {});
  const b = AN.activityDetailModel('running', inSum, 3000, {});
  ok('G6 deterministisch + nicht mutierend', J(a) === J(b) && J(inSum) === inBefore);
  let threw = false; try { AN.activityDetailModel(null, null, 'x', null); AN.normalizeActivitySummary(null, undefined); } catch (e) { threw = true; }
  ok('G7 wirft nie (null/ungültige Eingaben)', !threw);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
