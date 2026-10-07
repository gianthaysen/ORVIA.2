/* ============================================================
   ORVIA · garmin_retention (v8-447, Commit B) — was die App mit den neu erhaltenen
   Garmin-Daten macht, und was sie NICHT damit machen darf.

   A  metrics.ext (grosser Rohblock) bleibt auf dem Server: nie im lokalen Speicher,
      nie beim Zurueckschreiben vom Server geloescht
   B  metrics.garmin (kleiner Herkunftsblock) und die Zeitachse kommen auf dem Geraet an
   C  Quelle / manuell / wirksam: 341 min → 75 min uebersteht jeden erneuten Abgleich,
      auch wenn der Worker die Zeile inzwischen neu angereichert hat
   D  Zeitachse: Bestzeiten rechnen mit der ECHTEN Zeit, sobald sie vorliegt — und nur dann
   E  Verdrahtung im Quelltext
   node supabase/tests/garmin_retention_v447_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

const mem = {};
globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
const E = await imp('js/activity-effective.js');
await imp('js/activity-normalize.js');
await imp('js/training-domain.js');
globalThis.ORVIA.onboardingSportsLogic = await imp('js/onboarding/onboarding-sports-logic.js');
const C = await imp('js/activity-config.js');
const S = await imp('js/activity-store.js');
const AS = await imp('js/activity-streams.js');
const AT = await imp('js/activity-time.js');
const load = f => (0, eval)(rd(f));
load('js/repos/repoBase.js'); load('js/repos/activityRepository.js'); load('js/activity-sync.js');
const sync = globalThis.ORVIA.activitySync, repo = globalThis.ORVIA.repos.activity;
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; };
const stored = () => Object.keys(mem).map(k => mem[k]).join('');

const UUID = '9f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c29';
const EXT = { v: 1, fields: { movingDuration: 3301.0, elapsedDuration: 3620.5, averageSwolf: 38, aerobicTrainingEffect: 3.4 },
  splits: { lapDTOs: [{ distance: 1000, duration: 301.2 }] }, extras: { splits: 'ok' } };
const GARMIN = { v: 1, type_key: 'trail_running', parent_type_id: 1, start_local: '2026-07-12T08:30:00', start_gmt: '2026-07-12T06:30:00Z',
  utc_offset_s: 7200, moving_duration_s: 3301, elapsed_duration_s: 3620.5, timer_duration_s: 3475.1, stream_rows: 1855, stream_kept: 6 };
const STREAMS = { time: [0, 60, 125, 190, 250, 320], distance: [0, 200, 420, 640, 850, 1100], heart_rate: [120, 140, 150, 152, 155, 158], cadence: [160, 162, 163, 161, 164, 165] };
const META = { time: { kind: 'elapsed_s', unit: 's', source: 'directTimestamp' }, cadence: { kind: 'running_cadence_spm', unit: 'spm', source: 'directDoubleCadence' } };
const row = o => Object.assign({ id: UUID, client_record_id: null, sport_id: 'running', source: 'garmin', source_record_id: '4711',
  started_at: '2026-07-12T06:30:00+00:00', ended_at: '2026-07-12T07:28:00+00:00', duration_seconds: 3475, status: 'completed',
  summary: { distance_m: 10012.3 }, metrics: { garmin: GARMIN, ext: EXT, streams: STREAMS, stream_meta: META, detailsVersion: 3, training_load: 148 } }, o || {});

sec('A · metrics.ext bleibt auf dem Server');
{
  reset();
  const r = S.mergeServerActivities([row()]);
  const a = S.getActivityBySource('garmin', '4711');
  ok('A1 neue Serverzeile: lokal ohne ext', r.merged === 1 && a && !('ext' in a.metrics), J(Object.keys(a.metrics)));
  ok('A2 … nichts aus dem Rohblock steht im lokalen Speicher', stored().indexOf('averageSwolf') < 0 && stored().indexOf('lapDTOs') < 0);
  ok('A3 … alles Uebrige ist angekommen (Herkunft, Messreihen, Bedeutung, Belastung)', J(a.metrics.garmin) === J(GARMIN) && J(a.metrics.streams) === J(STREAMS) && J(a.metrics.stream_meta) === J(META) && a.metrics.training_load === 148);
  ok('A4 SERVER_ONLY_METRIC_KEYS ist die eine Stelle dafuer', J(S.SERVER_ONLY_METRIC_KEYS) === J(['ext']));

  /* Zeile, die vor v8-447 schon mit ext im Speicher gelandet ist (Worker frueher ausgerollt als die App) */
  const all = JSON.parse(mem[Object.keys(mem)[0]]);
  all[0].metrics.ext = EXT;
  mem[Object.keys(mem)[0]] = JSON.stringify(all);
  S.mergeServerActivities([row()]);
  ok('A5 ein bereits gespeicherter ext-Block wird beim naechsten Abgleich entfernt', stored().indexOf('averageSwolf') < 0 && !('ext' in S.getActivityBySource('garmin', '4711').metrics));

  /* Groesse: 160 Aktivitaeten mit je ~3 kB Rohblock duerfen den Speicher nicht vergroessern */
  reset();
  const big = { v: 1, fields: {} }; for (let i = 0; i < 110; i++) big.fields['someGarminMeasure' + i] = 1234.5678 + i;
  const rows = []; for (let i = 0; i < 160; i++) rows.push(row({ id: UUID.slice(0, -3) + String(100 + i), source_record_id: 'g' + i, metrics: { garmin: GARMIN, ext: big, training_load: i } }));
  S.mergeServerActivities(rows);
  const withExt = stored().length;
  reset();
  S.mergeServerActivities(rows.map(x => Object.assign({}, x, { metrics: { garmin: GARMIN, training_load: x.metrics.training_load } })));
  ok('A6 lokaler Speicher ist mit und ohne Rohblock gleich gross', withExt === stored().length && J(big).length * 160 > 400000, withExt + ' Zeichen; Rohblock haette ' + J(big).length * 160 + ' gekostet');

  /* Zurueckschreiben einer Garmin-Zeile: nur clientgefuehrte Schluessel — ext auf dem Server bleibt */
  reset();
  const calls = { update: [] };
  let serverMetrics = row().metrics;
  globalThis.ORVIA.sb = {
    rpc: () => Promise.resolve({ data: null, error: { message: 'unexpected' } }),
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [{ metrics: serverMetrics }], error: null }) }) }) }),
      update: (patch) => ({ eq: () => ({ eq: () => ({ select: () => { calls.update.push(patch); return Promise.resolve({ data: [Object.assign({ id: UUID }, patch)], error: null }); } }) }) })
    })
  };
  S.mergeServerActivities([row()]);
  const lk = S.linkActivityToPlan ? S.linkActivityToPlan(UUID, 'po:2026-07-12:ps:x', { method: 'manual' }) : null;
  const pend = S.getActivityBySource('garmin', '4711');
  if (pend.syncStatus !== 'pending') { const all2 = JSON.parse(mem[Object.keys(mem)[0]]); all2[0].syncStatus = 'pending'; all2[0].metrics.plannedSessionId = 'po:2026-07-12:ps:x'; mem[Object.keys(mem)[0]] = JSON.stringify(all2); }
  await sync.flushPendingActivities();
  const up = calls.update[0];
  ok('A7 Garmin-Zeile wird ueber updateFields zurueckgeschrieben', !!up && !!up.metrics, J(lk && lk.ok));
  ok('A8 … der Rohblock des Servers ist im gesendeten metrics unveraendert enthalten', up && J(up.metrics.ext) === J(EXT) && J(up.metrics.garmin) === J(GARMIN) && J(up.metrics.streams) === J(STREAMS));
  ok('A9 … und die Spalte duration_seconds traegt weiter den Quellwert', up && (up.duration_seconds === undefined || up.duration_seconds === 3475), J(up && up.duration_seconds));
}

sec('B · Herkunft und Zeitachse auf dem Geraet');
{
  reset();
  S.mergeServerActivities([row()]);
  const a = S.getActivityBySource('garmin', '4711');
  const p = AT.localParts(a, 'America/New_York');
  ok('B1 Uhrzeit = Ortszeit der Aktivitaet (Garmin), unabhaengig von der Zone des Geraets', p.date === '2026-07-12' && p.time === '08:30' && p.basis === 'activity_local', J(p));
  ok('B2 Zeitachse lesbar, gleiche Laenge wie jede Messreihe', J(AS.timeAxis(a)) === J(STREAMS.time) && Object.keys(a.metrics.streams).every(k => a.metrics.streams[k].length === STREAMS.time.length));
  const pts = AS.points(a, 'heart_rate');
  ok('B3 Messpunkte tragen ihren Zeitbezug', pts.length === 6 && pts[2].t === 125 && pts[2].v === 150);
  const c = AS.cadence(a);
  ok('B4 Kadenz: Schrittfrequenz, belegt durch die Bedeutung der Messreihe — keine Umrechnung', c.status === 'ok' && c.kind === 'running_cadence_spm' && c.avg > 155 && c.values[0] === 160, J({ s: c.status, k: c.kind, avg: c.avg }));
  const sv = C.normalizeServerActivity(row());
  ok('B5 Serverliste (Detailseite) traegt den Rohblock weiter — nur der lokale Speicher nicht', sv.metrics && J(sv.metrics.ext) === J(EXT));
  const noTime = row({ metrics: { streams: { heart_rate: [1, 2, 3] }, detailsVersion: 2 } });
  ok('B6 Altzeile ohne Zeitachse: keine Punkte mit erfundenem Zeitbezug', AS.timeAxis(C.normalizeServerActivity(noTime)) === null && AS.points(C.normalizeServerActivity(noTime), 'heart_rate') === null);
}

sec('C · Quelle / manuell / wirksam uebersteht den erneuten Abgleich');
{
  reset();
  const SRC = 341 * 60, MAN = 75 * 60;
  const sess = { id: 'w1', sport_key: 'gym', status: 'completed', started_at: '2026-10-05T16:00:00.000Z', finished_at: '2026-10-05T21:41:00.000Z', duration_min: 341 };
  S.upsertActivityFromWorkout(sess, [], { syncStatus: 'synced' });
  const w = S.getActivityBySource('orvia_workout', 'w1');
  S.correctActivityDuration(w.clientRecordId, 75);
  const corr = S.getActivityBySource('orvia_workout', 'w1').metrics.corrections;
  ok('C1 Ausgangslage: Korrektur gesetzt, wirksam 75 min, Quelle 341 min', S.getActivityBySource('orvia_workout', 'w1').durationSeconds === MAN && corr.duration.source === SRC);

  /* Server liefert die Zeile wieder: Spalte = Quelle (341), metrics traegt die Korrektur */
  const srv = { id: UUID, client_record_id: w.clientRecordId, sport_id: 'gym', source: 'orvia_workout', source_record_id: 'w1', workout_session_id: 'w1',
    started_at: sess.started_at, ended_at: sess.finished_at, duration_seconds: SRC, status: 'completed', summary: {}, metrics: { corrections: corr } };
  const allSync = JSON.parse(mem[Object.keys(mem)[0]]); allSync[0].syncStatus = 'synced'; mem[Object.keys(mem)[0]] = JSON.stringify(allSync);
  S.mergeServerActivities([srv]);
  ok('C2 erneuter Abgleich: bleibt 75 min', S.getActivityBySource('orvia_workout', 'w1').durationSeconds === MAN);
  S.mergeServerActivities([srv]); S.mergeServerActivities([srv]);
  ok('C3 … auch nach mehreren Abgleichen', S.getActivityBySource('orvia_workout', 'w1').durationSeconds === MAN && S.getActivityBySource('orvia_workout', 'w1').metrics.corrections.duration.source === SRC);
  const list = C.mergeAllActivities([C.normalizeServerActivity(srv)], S.listActivities(), [], {});
  ok('C4 Liste (Server hat Vorrang): 75 min, einmal', list.length === 1 && list[0].durationSeconds === MAN, J(list.map(x => x.durationSeconds)));

  /* Garmin-Zeile mit Korrektur (allgemeines Modell): der Worker hat sie auf Version 3 neu
     angereichert — neue Schluessel (garmin, ext, streams.time), Spalte weiter = Quelle. */
  reset();
  const gc = { duration: { manual: MAN, source: SRC, unit: 's', at: '2026-10-01T18:00:00.000Z', method: 'manual' } };
  const before = row({ sport_id: 'gym', duration_seconds: SRC, metrics: { corrections: gc, streams: { heart_rate: [1, 2] }, detailsVersion: 2 } });
  S.mergeServerActivities([before]);
  ok('C5 Garmin-Zeile vor dem Nachladen: wirksam 75 min', S.getActivityBySource('garmin', '4711').durationSeconds === MAN);
  const after = row({ sport_id: 'gym', duration_seconds: SRC, metrics: Object.assign({}, row().metrics, { corrections: gc }) });
  S.mergeServerActivities([after]);
  const g = S.getActivityBySource('garmin', '4711');
  ok('C6 nach dem Nachladen durch den Worker: weiter 75 min, Quelle 341 min', g.durationSeconds === MAN && E.resolveMetric(g, 'duration').sourceValue === SRC && E.isCorrected(g, 'duration'));
  ok('C7 … und die neuen Daten sind da (Zeitachse, Herkunft)', J(g.metrics.streams.time) === J(STREAMS.time) && g.metrics.garmin.type_key === 'trail_running' && g.metrics.detailsVersion === 3);
  /* Worker-Zeile OHNE corrections (anderes Geraet hat noch nicht gesendet): lokale Korrektur bleibt und wird erneut gesendet */
  S.mergeServerActivities([row({ sport_id: 'gym', duration_seconds: SRC })]);
  const g2 = S.getActivityBySource('garmin', '4711');
  ok('C8 Serverzeile ohne Korrektur loescht die lokale nicht — sie wird erneut gesendet', g2.durationSeconds === MAN && g2.syncStatus === 'pending', J({ d: g2.durationSeconds, s: g2.syncStatus }));
  ok('C9 Bewegungszeit aus Garmin ist KEINE Korrektur und ersetzt die Dauer nicht', g2.metrics.garmin.moving_duration_s === 3301 && E.resolveMetric(g2, 'duration').sourceValue === SRC);
}

sec('D · Bestzeiten rechnen mit der echten Zeit');
{
  const RB = await imp('js/run-bests.js');
  const t = RB.streamTimeAxis ? RB.streamTimeAxis(STREAMS) : null;
  ok('D1 run-bests findet die Zeitachse des Workers (streams.time)', J(t) === J(STREAMS.time));
  ok('D2 ohne Zeitachse: keine (nichts aus der Geschwindigkeit abgeleitet)', RB.streamTimeAxis({ distance: [0, 1], speed: [3, 3] }) === null);
  /* 1 km in ungleichen Abstaenden: 0→1100 m in 320 s; das schnellste 1-km-Fenster ist NICHT
     das, was eine gleichmaessige Verteilung ergaebe. */
  const dist = [0, 250, 500, 750, 1000, 1250, 1500], real = [0, 50, 100, 150, 200, 330, 460], even = [0, 77, 153, 230, 307, 383, 460];
  const br = RB.bestWindowFromStreams(dist, real, 1, 0.05), be = RB.bestWindowFromStreams(dist, even, 1, 0.05);
  ok('D3 echte Zeitachse: schnellster Kilometer 200 s (gleichmaessig verteilt waeren es ' + (be && be.sec) + ' s)', br && br.sec === 200 && be && be.sec !== 200, J(br));
}

sec('E · Verdrahtung');
{
  const store = rd('js/activity-store.js');
  ok('E1 beide Schreibwege des Abgleichs laufen ueber dropServerOnly', (store.match(/dropServerOnly\(/g) || []).length >= 3);
  ok('E2 activity-sync fuehrt weiter nur die clientgefuehrten Schluessel (kein ext, kein garmin)', /OWNED_METRIC_KEYS = \['plannedSessionId', 'planLinkCorrection', 'durationCorrection', 'corrections'\]/.test(rd('js/activity-sync.js')));
  ok('E3 der Rohblock wird nirgends in der Oberflaeche direkt gelesen (nur ueber activity-capabilities)', !/metrics\.ext\b/.test(rd('js/ui.js')) && !/metrics\.ext\b/.test(rd('js/activity.js')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' garmin_retention_v447: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
