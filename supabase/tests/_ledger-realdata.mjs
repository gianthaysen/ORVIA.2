/* ORVIA · Testdaten (kein Test) — Eckdaten der 15 Garmin-Laeufe aus dem Produktions-Probelauf vom 16.10.2026
   (Diagnose 448C-diag-1). Kennungen synthetisch; je Lauf nur, was Register und Pruefung lesen: Start (UTC/Ortszeit),
   Timer-, verstrichene und Bewegungszeit, Distanz, Ende der Messreihe, Bestwerte des Workers (verstrichene Zeit, alle
   Messzeilen). Keine GPS-Punkte, keine Herzfrequenz. Die Anzeige-Reihe ist auf Anfang/Ende reduziert. */
export const DIAG = [
  // [startGmt, timer, elapsed, moving, distM, streamFirst, streamLast, rows, {target: [s, over]}]
  ['2026-06-18T14:14:02Z', 2786, 2963, 2745, 7007, 6.91, 7007.3, 2788, { 1000: [376, 0.6], 5000: [2179, 0.4] }],
  ['2026-06-21T09:22:21Z', 594, 728, 592, 2009, 0.87, 2009.03, 596, { 1000: [287, 2.7] }],
  ['2026-06-21T09:36:18Z', 1021, 1264, 1021, 3008, 0.97, 3007.7, 1024, { 1000: [356, 0.6] }],
  ['2026-07-11T07:47:33Z', 1707, 1891, 1609, 4076, 2.21, 4075.57, 1711, { 1000: [383, 0.1] }],
  ['2026-07-15T16:18:08Z', 3475, 4398, 3471, 10041, 0.63, 10040.54, 3493, { 1000: [329, 0.1], 5000: [2161, 2.1], 10000: [4385, 1.2] }],
  ['2026-07-19T10:20:18Z', 3559, 4031, 3555, 9009, 0, 9009.36, 3569, { 1000: [383, 1.3], 5000: [2098, 0.6] }],
  ['2026-07-21T16:33:30Z', 1774, 1899, 1774, 5139, 1.48, 5138.63, 1776, { 1000: [290, 0.8], 5000: [1835, 1.8] }],
  ['2026-07-26T11:54:56Z', 5514, 6766, 5509, 15009, 2.23, 15008.5, 5527, { 1000: [321, 0.3], 5000: [1943, 0.1], 10000: [4661, 0.5] }],
  ['2026-07-29T18:16:39Z', 2171, 2211, 2165, 5503, 1.61, 5502.53, 2175, { 1000: [261, 1.2], 5000: [1996, 0.6] }],
  ['2026-08-04T05:38:38Z', 1959, 2014, 1957, 5187, 0, 5187.13, 1962, { 1000: [302, 0.3], 5000: [1938, 0.4] }],
  ['2026-08-07T05:45:22Z', 2521, 2521, 2501, 6008, 1.38, 6007.56, 2522, { 1000: [403, 0.3], 5000: [2098, 0.4] }],
  ['2026-08-09T07:23:01Z', 6064, 7057, 6053, 17002, 0, 17002.31, 6077, { 1000: [298, 0.6], 5000: [1774, 0.4], 10000: [3853, 0.3] }],
  ['2026-08-13T16:17:26Z', 1418, 1997, 1416, 5006, 0.57, 5005.73, 1423, { 1000: [279, 0.9], 5000: [1995, 1] }],
  ['2026-09-06T07:15:11Z', 8532, 8532, 8369, 21177, 1.46, 21177.06, 8533, { 1000: [328, 0], 5000: [1751, 0], 10000: [3709, 1.7], 21098: [8447, 0.6] }],
  ['2026-10-03T06:03:53Z', 2162, 2162, 1849, 3330, 0, 3330.43, 2163, { 1000: [505, 0.4] }]
];
export const uuid = i => '20000000-0000-4000-8000-' + String(i).padStart(12, '0');

/* Garmin-Lauf im Format der App (normalizeServerActivity), Belegstand wie in Produktion (Vertrag 3, volle Abtastung). */
export function diagRun(GEN, i, row, extra) {
  const [gmt, timer, elapsed, moving, distM, sf, sl, rows, targets] = row;
  const a = GEN.referenceActivity('running', 'best');
  a.id = uuid(i + 1); a.clientRecordId = 'act:diag' + (i + 1);
  a.startedAt = gmt.replace('Z', '.000Z');
  const local = new Date(Date.parse(gmt) + 7200000).toISOString().slice(0, 19);   // Sommerzeit Berlin (alle Laeufe Juni–Oktober)
  const g = a.metrics.garmin;
  Object.assign(g, { start_gmt: gmt, start_local: local, timer_duration_s: timer, elapsed_duration_s: elapsed, moving_duration_s: moving, stream_rows: rows, stream_total: rows });
  a.durationSeconds = Math.round(timer); a.summary = { distanceM: distM, distanceKm: distM / 1000 };
  a.metrics.streams = { time: [0, elapsed], distance: [sf, sl] };
  const be = a.metrics.best_efforts; be.rows = rows; be.total = rows; be.native = true; delete be.power; delete be.stats;
  be.distance = { v: 1, basis: 'elapsed', status: 'ok', total_m: Math.round((sl - sf) * 10) / 10, targets: {} };
  for (const t of [400, 1000, 5000, 10000, 21098, 42195]) be.distance.targets[String(t)] = targets[t] ? { s: targets[t][0], over_m: targets[t][1], at: 0, q: 'measured' } : { q: 'too_short' };
  return Object.assign(a, extra || {});
}
