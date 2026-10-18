/* ORVIA · Testdaten (kein Test) — Eckdaten der 6 Garmin-Schwimmeinheiten aus dem Produktions-Audit vom 18.10.2026
   (452-swim-audit-1). Keine Kennungen, keine Titel, keine GPS-Punkte; Messreihen nur als Laenge mit festem Muster.
   Je Einheit: Garmin-Typ, Ortszeit, Timer / verstrichene / Bewegungszeit der Aufzeichnung, Zusammenfassung (summary,
   so wie in der Zeile gespeichert) und die Listenfelder (ext.fields), auf die die Auswertung schaut. */
export const SWIMS = [
  // [typ, start, timer, elapsed, movingDetails, summary, fields, seriesSwimCadence (Laenge|0), routePoints]
  ['open_water_swimming', '2026-06-19T12:14:00Z', 2791, 2804, 1772, { avg_hr: 119, avg_speed_mps: 0.32, calories_kcal: 342, distance_m: 899.95, max_hr: 162 },
    { averageHR: 119, averageSpeed: 0.32, averageSwimCadenceInStrokesPerMinute: 20, averageSwolf: 102, avgStrokeDistance: 103, calories: 342, distance: 899.95, duration: 2790.38,
      elapsedDuration: 2804.33, hrTimeInZone_1: 1132.52, hrTimeInZone_2: 1022, hrTimeInZone_3: 19, hrTimeInZone_4: 0, hrTimeInZone_5: 0, lapCount: 2, maxHR: 162, maxSpeed: 1.56,
      maxSwimCadenceInStrokesPerMinute: 48, movingDuration: 1772, strokes: 877 }, 281, 483],
  ['open_water_swimming', '2026-06-26T15:57:00Z', 3026, 5793, 2166, { avg_hr: 125, avg_speed_mps: 0.3, calories_kcal: 406, distance_m: 900.14, max_hr: 181 },
    { averageHR: 125, averageSpeed: 0.3, averageSwimCadenceInStrokesPerMinute: 22, averageSwolf: 114, avgStrokeDistance: 82, calories: 406, distance: 900.14, duration: 3025.54,
      elapsedDuration: 5793.23, hrTimeInZone_1: 934.12, hrTimeInZone_2: 1392.75, hrTimeInZone_3: 96, hrTimeInZone_4: 41, hrTimeInZone_5: 0, lapCount: 1, maxHR: 181, maxSpeed: 1.5,
      maxSwimCadenceInStrokesPerMinute: 48, movingDuration: 2166, strokes: 1094 }, 277, 482],
  ['lap_swimming', '2026-09-20T10:57:00Z', 3577, 3613, 0, { avg_hr: 103, avg_speed_mps: 1.31, calories_kcal: 355, distance_m: 1800, max_hr: 157 },
    { activeLengths: 36, averageHR: 103, averageSpeed: 1.31, averageSwimCadenceInStrokesPerMinute: 31, averageSwolf: 58, avgStrokeDistance: 0, avgStrokes: 19.8, calories: 355,
      distance: 1800, duration: 3577, elapsedDuration: 3615.37, hrTimeInZone_1: 646.99, hrTimeInZone_2: 1052.31, hrTimeInZone_3: 235, hrTimeInZone_4: 0, hrTimeInZone_5: 0, lapCount: 6,
      maxHR: 157, maxSpeed: 3.64, movingDuration: 1374.37, poolLength: 5000, strokes: 712, unitOfPoolLength: 'meter' }, 0, 0],
  ['lap_swimming', '2026-10-01T13:14:00Z', 2579, 2613, 0, { avg_hr: 120, avg_speed_mps: 0.91, calories_kcal: 442, distance_m: 700, max_hr: 179 },
    { activeLengths: 14, averageHR: 120, averageSpeed: 0.91, averageSwimCadenceInStrokesPerMinute: 32, averageSwolf: 84, avgStrokeDistance: 0, avgStrokes: 29.5, calories: 442,
      distance: 700, duration: 2578.69, elapsedDuration: 2614.41, hrTimeInZone_1: 797.94, hrTimeInZone_2: 1045.34, hrTimeInZone_3: 316.87, hrTimeInZone_4: 177, hrTimeInZone_5: 4, lapCount: 14,
      maxHR: 179, maxSpeed: 2.85, movingDuration: 768.03, poolLength: 5000, strokes: 413, unitOfPoolLength: 'meter' }, 0, 0],
  ['lap_swimming', '2026-10-08T15:57:00Z', 4087, 4088, 0, { avg_hr: 123, avg_speed_mps: 0.68, calories_kcal: 704, distance_m: 700, max_hr: 178 },
    { activeLengths: 28, averageHR: 123, averageSpeed: 0.68, averageSwimCadenceInStrokesPerMinute: 27, averageSwolf: 53, avgStrokeDistance: 0, avgStrokes: 16.3, calories: 704,
      distance: 700, duration: 4086.71, elapsedDuration: 4089.4, hrTimeInZone_1: 1238.72, hrTimeInZone_2: 1810.37, hrTimeInZone_3: 689.12, hrTimeInZone_4: 198.46, hrTimeInZone_5: 4, lapCount: 13,
      maxHR: 178, maxSpeed: 1.61, movingDuration: 1024.31, poolLength: 2500, strokes: 456, unitOfPoolLength: 'meter' }, 0, 0],
  ['lap_swimming', '2026-10-11T11:13:00Z', 4171, 4174, 0, { avg_hr: 142, avg_speed_mps: 0.93, calories_kcal: 613, distance_m: 1350, max_hr: 183 },
    { activeLengths: 54, averageHR: 142, averageSpeed: 0.93, averageSwimCadenceInStrokesPerMinute: 28, averageSwolf: 39, avgStrokeDistance: 0, avgStrokes: 12.5, calories: 613,
      distance: 1350, duration: 4170.63, elapsedDuration: 4175.78, hrTimeInZone_1: 270.47, hrTimeInZone_2: 1619.01, hrTimeInZone_3: 1168.44, hrTimeInZone_4: 1046.15, hrTimeInZone_5: 57.34, lapCount: 10,
      maxHR: 183, maxSpeed: 2.12, movingDuration: 1456.94, poolLength: 2500, strokes: 673, unitOfPoolLength: 'meter' }, 0, 0]
];

/* Garmin-Schwimmeinheit im Format der App (normalizeServerActivity), Belegstand wie in Produktion (Vertrag 3, volle Abtastung).
   withExt=false: so, wie sie im lokalen Speicher liegt (ohne Rohblock). */
export function swimRow(i, withExt = true) {
  const [type, gmt, timer, elapsed, moving, summary, fields, cad, route] = SWIMS[i];
  const n = 280, T = Array.from({ length: n }, (_, k) => Math.round(k * elapsed / (n - 1)));
  const metrics = {
    detailsVersion: 3, detailsFetchedAt: '2026-10-15T00:00:00Z', detailsMaxchart: 20000, detailsSemantics: 1,
    garmin: { v: 1, type_key: type, start_gmt: gmt, timer_duration_s: timer, elapsed_duration_s: elapsed, moving_duration_s: moving, stream_rows: n * 10, stream_kept: n, stream_total: n * 10 },
    streams: { time: T, heart_rate: T.map((_, k) => 100 + (k % 40)), distance: T.map((_, k) => (type === 'lap_swimming' ? (k === 0 ? 0 : null) : Math.round(k * summary.distance_m / (n - 1)))) },
    stream_meta: { time: { kind: 'elapsed_s', unit: 's', source: 'directTimestamp' }, heart_rate: { kind: 'heart_rate_bpm', unit: 'bpm', source: 'directHeartRate' } }
  };
  if (type === 'open_water_swimming') { metrics.streams.speed = T.map((_, k) => k % 9 === 0 ? 0 : 0.3 + (k % 5) * 0.05); metrics.route = Array.from({ length: route }, (_, k) => [47 + k * 1e-5, 8 + k * 1e-5]); }
  if (withExt) {
    metrics.ext = { v: 1, fields: Object.assign({}, fields), unrecognized: ['splitSummaries', 'summarizedDiveInfo'] };
    if (cad) metrics.ext.series = { directSwimCadence: { values: T.map((_, k) => k % 3 === 0 ? 0 : 18 + (k % 8)), garmin_unit: 'strokesPerMinute' } };
  }
  return { id: '40000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'), clientRecordId: 'act:swim' + (i + 1), sportId: 'swimming', source: 'garmin', status: 'completed',
    startedAt: gmt.replace('Z', '.000Z'), durationSeconds: timer,
    summary: { distanceM: summary.distance_m, avgHr: summary.avg_hr, maxHr: summary.max_hr, caloriesKcal: summary.calories_kcal, avgSpeedMps: summary.avg_speed_mps, name: 'Schwimmen' }, metrics };
}
