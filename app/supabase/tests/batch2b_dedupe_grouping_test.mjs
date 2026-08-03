/* ============================================================
   ORVIA · Batch 2b — Dedupe-Vertrag, metrics-Roundtrip, Gruppierung,
   Tombstones/Idempotenz, Plan-Actual-Link
   (docs/ACTIVITY-DEDUPE-GROUPING-CONTRACT.md; Freigabe-Bedingungen 1–4)
   node supabase/tests/batch2b_dedupe_grouping_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const wsSrc = readFileSync(new URL('workout-store.js', base), 'utf8');
const wuiSrc = readFileSync(new URL('workout-ui.js', base), 'utf8');
const repoSrc = readFileSync(new URL('repos/workoutRepository.js', base), 'utf8');

function slice(src, a, b) {
  const s = src.indexOf(a), e = src.indexOf(b);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + a + ' … ' + b);
  return src.slice(s, e);
}
function makeSb(opts) {
  opts = opts || {};
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Intl = Intl;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb._store = store;
  sb.ORVIA = { user: { id: 'u1' } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'activity-config.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
const serverRow = (o) => Object.assign({
  id: 'srv-1', client_record_id: null, user_id: 'u1', sport_id: 'running', source: 'import',
  source_record_id: 'garmin:100', workout_session_id: null, started_at: '2026-06-03T17:00:00.000Z',
  ended_at: null, duration_seconds: 2400, status: 'completed',
  summary: { distanceKm: 7.0 }, metrics: { source_sport_raw: 'running', avgSpeedKmh: 10.5 }
}, o);

/* ---------- M: metrics-Roundtrip Server → kanonisches Modell (Bedingung 1) ---------- */
{
  const sb = makeSb();
  const AN = sb.ORVIA.activityNormalize || sb.module && sb.module.exports;
  const n = (sb.ORVIA.activityNormalize ? sb.ORVIA.activityNormalize : vm.runInContext('ORVIA.activityNormalize', sb));
  const norm = n && n.normalizeActivityRecord ? n.normalizeActivityRecord(serverRow({})) : null;
  ok('M1 normalizeActivityRecord reicht metrics durch', !!norm && norm.metrics && norm.metrics.source_sport_raw === 'running' && norm.metrics.avgSpeedKmh === 10.5);
  ok('M2 ohne metrics ⇒ leeres Objekt, nichts erfunden', Object.keys(n.normalizeActivityRecord(serverRow({ metrics: null })).metrics).length === 0);
  const AS = sb.ORVIA.activityStore;
  const r1 = AS.mergeServerActivities([serverRow({})]);
  const a1 = AS.getActivityBySource('import', 'garmin:100');
  ok('M3 Merge (neu): metrics im kanonischen Store erhalten', r1.merged === 1 && a1 && a1.metrics.avgSpeedKmh === 10.5, JSON.stringify(a1 && a1.metrics));
  // Update-Pfad: neue metrics übernehmen; leere metrics überschreiben NICHT.
  AS.mergeServerActivities([serverRow({ metrics: { source_sport_raw: 'running', avgSpeedKmh: 11.0 } })]);
  ok('M4 Merge (Update): belegte metrics werden übernommen', AS.getActivityBySource('import', 'garmin:100').metrics.avgSpeedKmh === 11.0);
  AS.mergeServerActivities([serverRow({ metrics: {} })]);
  ok('M5 Merge (Update): leere metrics überschreiben lokale NICHT', AS.getActivityBySource('import', 'garmin:100').metrics.avgSpeedKmh === 11.0);
}

/* ---------- S: Store-Szenarien — zweimal echt, Tombstone, Idempotenz ---------- */
{
  const sb = makeSb();
  const AS = sb.ORVIA.activityStore, AC = sb.ORVIA.activityConfig;
  // Zwei ECHTE Läufe am selben Tag (verschiedene source_record_id) — beide zählen (P4).
  AS.mergeServerActivities([
    serverRow({ id: 'srv-a', source_record_id: 'garmin:a', started_at: '2026-06-03T07:00:00.000Z', duration_seconds: 1800, summary: { distanceKm: 5 } }),
    serverRow({ id: 'srv-b', source_record_id: 'garmin:b', started_at: '2026-06-03T18:00:00.000Z', duration_seconds: 1800, summary: { distanceKm: 5 } })
  ]);
  const acts = AS.listActivities();
  ok('S1 zwei echte Einheiten selber Tag+Sport bleiben getrennt', acts.length === 2);
  const du = AC.dailyLoadUnits(acts, {});
  ok('S2 beide zählen in der Last (2×30·5=300)', du.load === 300 && du.units.length === 2, JSON.stringify(du.units.map(u => u.load)));
  // Idempotenz: identischer Re-Import ändert nichts an der Anzahl.
  const again = AS.mergeServerActivities([serverRow({ id: 'srv-a', source_record_id: 'garmin:a', started_at: '2026-06-03T07:00:00.000Z', duration_seconds: 1800, summary: { distanceKm: 5 } })]);
  ok('S3 Re-Import idempotent (updated, nicht dupliziert)', again.merged === 0 && AS.listActivities().length === 2, JSON.stringify(again));
  // Tombstone: Löschung verhindert Wiedererscheinen beim nächsten Sync.
  const victim = AS.getActivityBySource('import', 'garmin:b');
  AS.deleteActivity(victim.clientRecordId, victim);
  ok('S4 Löschung wirkt lokal', AS.listActivities().length === 1);
  const re = AS.mergeServerActivities([serverRow({ id: 'srv-b', source_record_id: 'garmin:b', started_at: '2026-06-03T18:00:00.000Z', duration_seconds: 1800 })]);
  ok('S5 Tombstone: gelöschte Aktivität erscheint beim Re-Sync NICHT wieder', re.skipped === 1 && AS.listActivities().length === 1, JSON.stringify(re));
}

/* ---------- G: Gruppierung (getrennt von Dedupe, P6) ---------- */
{
  const sb = makeSb();
  const AC = sb.ORVIA.activityConfig;
  const seg = (id, startIso, durS, km) => ({ id: null, clientRecordId: id, sportId: 'running', source: 'import', sourceRecordId: id, startedAt: startIso, endedAt: null, durationSeconds: durS, status: 'completed', summary: { distanceKm: km } });
  // Golden Case: 12,41-km-Long-Run als 3 direkt aufeinanderfolgende Segmente (03.06.2026).
  const segs = [
    seg('g1', '2026-06-03T17:00:00.000Z', 2520, 7.00),   // endet 17:42
    seg('g2', '2026-06-03T17:44:00.000Z', 960, 2.65),    // +2 min Lücke, endet 18:00
    seg('g3', '2026-06-03T18:03:00.000Z', 1020, 2.76)    // +3 min Lücke
  ];
  const g = AC.groupActivitySessions(segs);
  ok('G1 Golden 12,41 km: EINE Gruppe mit 3 Segmenten', g.groups.length === 1 && g.groups[0].segments === 3, JSON.stringify(g.groups));
  ok('G2 Summen korrekt (12,41 km, 75 min), Rohaktivitäten unangetastet',
    g.groups[0].totalDistanceKm === 12.41 && g.groups[0].totalDurationSeconds === 4500 && segs[0].summary.distanceKm === 7.00);
  const du = AC.dailyLoadUnits(segs, {});
  ok('G3 Gruppierung verdreifacht die Last NICHT (jedes Segment einmal: 75·5=375)',
    du.load === 375 && du.units.length === 3, JSON.stringify({ load: du.load }));
  // Lücke > 15 min trennt.
  const far = AC.groupActivitySessions([segs[0], seg('g4', '2026-06-03T19:00:00.000Z', 900, 2.5)]);
  ok('G4 Lücke > 15 min ⇒ getrennte Gruppen', far.groups.length === 2);
  // Brick: Rad direkt gefolgt von Lauf ⇒ getrennte Aktivitäten/Gruppen, gemeinsame brickId.
  const brick = AC.groupActivitySessions([
    Object.assign(seg('b1', '2026-06-03T17:00:00.000Z', 3600, 30), { sportId: 'cycling' }),
    seg('b2', '2026-06-03T18:05:00.000Z', 1200, 4.0)
  ]);
  ok('G5 Brick: 2 Gruppen (cycling/running) mit gemeinsamer brickId',
    brick.groups.length === 2 && brick.groups[0].brickId != null && brick.groups[0].brickId === brick.groups[1].brickId &&
    brick.groups[0].sportId === 'cycling' && brick.groups[1].sportId === 'running', JSON.stringify(brick.groups.map(x => x.brickId)));
  ok('G6 deterministisch', JSON.stringify(AC.groupActivitySessions(segs)) === JSON.stringify(AC.groupActivitySessions(segs)));
}

/* ---------- P: Plan-Actual-Link (stabile IDs, Sync-Stabilität) ---------- */
{
  // ensurePlannedSessionIds + alignPlanToAvailability aus dem echten ui.js-Code.
  const alignBlock = slice(uiSrc, 'function alignPlanToAvailability', '/* Batch 2b (2026-07-18): stabile Planned-Session-IDs');
  const psBlock = slice(uiSrc, 'var _psSeq', 'function activeWeekPlan');
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number;
  vm.createContext(sb);
  vm.runInContext(alignBlock + '\n' + psBlock, sb, { filename: 'ui.js#plan-ids' });
  const plan = [[{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [], [{ t: 'Gym', l: 'Beine', d: '45 min' }], [], [], []];
  ok('P1 IDs werden einmalig vergeben', sb.ensurePlannedSessionIds(plan) === true && /^ps:/.test(plan[0][0].id) && /^ps:/.test(plan[3][0].id));
  const id0 = plan[0][0].id;
  ok('P2 zweiter Lauf vergibt NICHTS neu (stabil)', sb.ensurePlannedSessionIds(plan) === false && plan[0][0].id === id0);
  const aligned = sb.alignPlanToAvailability(plan, { availableDayIdx: [1, 4] });
  const moved = aligned.flat().find(u => u.l === 'Intervalle');
  ok('P3 Verschieben durch Availability erhält die ID', moved && moved.id === id0);
  // Verdrahtung (statisch, echter Produktivcode):
  // Batch 2d: startPlannedUnit reicht die OCCURRENCE-ID durch (Template getrennt).
  ok('P4 startPlannedUnit reicht Occurrence-ID + templateSessionId durch',
    /plannedSessionId:occ/.test(uiSrc.replace(/\s/g, '')) && /templateSessionId:item\.id\|\|null/.test(uiSrc.replace(/\s/g, '')));
  ok('P5 workout-ui übergibt plannedSessionId an den Store', /plannedSessionId:\(opts&&opts\.plannedSessionId\)\|\|null/.test(wuiSrc.replace(/\s/g, '')));
  ok('P6 Session-Zeile trägt planned_session_id (online-Repo + Offline-Queue)',
    /planned_session_id:\s*s\.plannedSessionId\s*\|\|\s*null/.test(repoSrc) && /planned_session_id:\s*s\.plannedSessionId\s*\|\|\s*s\.planned_session_id\s*\|\|\s*null/.test(wsSrc));
  ok('P7 Store setzt plannedSessionId aus den Start-Optionen', /plannedSessionId:\s*opts\.plannedSessionId\s*\|\|\s*null/.test(wsSrc));
  // Sync-Stabilität der Activity-Seite: Update-Merge erhält workoutSessionId (Link-Kette).
  const sb2 = makeSb();
  const AS2 = sb2.ORVIA.activityStore;
  AS2.mergeServerActivities([serverRow({ id: 'srv-w', source: 'orvia_workout', source_record_id: 'W9', workout_session_id: 'W9' })]);
  AS2.mergeServerActivities([serverRow({ id: 'srv-w', source: 'orvia_workout', source_record_id: 'W9', workout_session_id: 'W9', duration_seconds: 2500 })]);
  const aw = AS2.getActivityBySource('orvia_workout', 'W9');
  ok('P8 Re-Sync erhält workoutSessionId + aktualisiert Daten (Link stabil)', aw && aw.workoutSessionId === 'W9' && aw.durationSeconds === 2500 && AS2.listActivities().length === 1);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
