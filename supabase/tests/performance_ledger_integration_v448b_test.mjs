/* ============================================================
   ORVIA · performance_ledger_integration (v8-448B) — Einbindung des Leistungsregisters

   T  Chronologie: Reihenfolge nach UTC, Darstellung nach Ortszeit; Reise, Sommer-/Winterzeit,
      doppelte und uebersprungene Stunde, manuelle Wandzeit
   B  Umstellung (records-bridge): Flag aus = run-bests/achievements/pb-sync byte-gleich wie bisher;
      pending = bisherige Anzeige, pb-sync pausiert; an = Register ist die einzige Quelle je Rekord
   F  Vollstaendiger Bestand: Index ueber alle Seiten, nur Geaendertes laden, Loeschung nur bei
      vollstaendigem Index UND Gegenprobe, Tombstones, gekoppelte Aufzeichnungen, Doppelte
   C  Kraftkorrektur 341 → 75 min ueber den Serverweg, Garmin- und manuelle Zeilen
   S  Schalter haelt fuer die Sitzung, Server-„aus" und Notschalter schalten sofort ab; Kontowechsel
   D  Echtdaten-Probelauf schreibt nichts
   M  Zwischenspeicher: localStorage nur bis zur Grenze, Uebernahme aus v8-448A
   I  Auslieferung: Bausteine in index.html und Offline-Speicher, Build v8-448, Ansicht nur mit Flag
   node supabase/tests/performance_ledger_integration_v448b_test.mjs
   ============================================================ */
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
const clone = o => JSON.parse(JSON.stringify(o));

globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js', 'js/run-bests.js', 'js/achievements.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/feature-flags.js', 'js/engine/records-bridge.js', 'js/repos/performanceLedgerRepository.js', 'js/performance-ledger-store.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger, S = O.performanceLedgerStore, BR = O.recordsBridge, RB = O.runBests, AC = O.achievements, FF = O.featureFlags;
const TZ = 'Europe/Berlin';
const uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
function run(id, gmt, local, o = {}) {
  const a = GEN.referenceActivity('running', 'best');
  a.id = id; a.startedAt = gmt + '.000Z'; a.metrics.garmin.start_gmt = gmt + 'Z'; a.metrics.garmin.start_local = local;
  if (o.type !== undefined) a.metrics.garmin.type_key = o.type;
  const dist = o.dist ?? 10000; a.summary.distanceM = dist; a.metrics.streams.distance = [0, dist * .2, dist * .4, dist * .6, dist * .8, dist];
  const t = a.metrics.best_efforts.distance.targets; for (const k of Object.keys(t)) if (+k > dist) delete t[k];
  if (o.s5k != null) t['5000'] = { s: o.s5k, over_m: 2, at: 0, q: 'measured' };
  if (o.updatedAt) a.updatedAt = o.updatedAt;
  return a;
}

sec('T · Chronologie');
{
  /* Reise: New York 08:00 Ortszeit (12:00 UTC) ist SPAETER als Berlin 10:00 Ortszeit (08:00 UTC) am selben Tag */
  const ber = run('ber', '2026-09-10T08:00:00', '2026-09-10T10:00:00', { s5k: 1500 }), ny = run('ny', '2026-09-10T12:00:00', '2026-09-10T08:00:00', { s5k: 1500 });
  const h = L.update(null, [ny, ber], { timeZone: TZ }).state.events['running.fastest_5000m@standard'];
  ok('T1 Reise: Reihenfolge nach UTC (Berlin 08:00Z vor New York 12:00Z), nicht nach Ortszeit', h[0].activityId === 'ber' && h[1].activityId === 'ny' && h[1].type === 'equalled', J(h.map(e => e.activityId)));
  ok('T2 Darstellung bleibt Ortszeit der Einheit', L.entriesFor(ny, { timeZone: TZ })[0].localTime === '08:00' && L.entriesFor(ny, { timeZone: TZ })[0].utc === '2026-09-10T12:00:00.000Z');
  /* Rueckstellung 25.10.2026: 02:30 Ortszeit gibt es zweimal (00:30Z und 01:30Z) */
  const a1 = run('a1', '2026-10-25T01:30:00', '2026-10-25T02:30:00', { s5k: 1490 }), a2 = run('a2', '2026-10-25T00:30:00', '2026-10-25T02:30:00', { s5k: 1500 });
  const h2 = L.update(null, [a1, a2], { timeZone: TZ }).state.events['running.fastest_5000m@standard'];
  ok('T3 doppelte Stunde: gleiche Ortszeit 02:30, Reihenfolge eindeutig nach UTC', h2[0].activityId === 'a2' && h2[1].activityId === 'a1' && h2[1].type === 'improved', J(h2.map(e => [e.activityId, e.type])));
  const W = L.wallToInstant;
  ok('T4 manuelle Wandzeit Sommer: 18.07. 18:00 Berlin = 16:00 UTC', new Date(W('2026-07-18T18:00', TZ)).toISOString() === '2026-07-18T16:00:00.000Z');
  ok('T5 manuelle Wandzeit Winter: 18.12. 18:00 Berlin = 17:00 UTC', new Date(W('2026-12-18T18:00', TZ)).toISOString() === '2026-12-18T17:00:00.000Z');
  ok('T6 doppelte Stunde manuell: 25.10. 02:30 → erste Stunde (00:30 UTC)', new Date(W('2026-10-25T02:30', TZ)).toISOString() === '2026-10-25T00:30:00.000Z');
  ok('T7 uebersprungene Stunde: 29.03. 02:30 gibt es nicht → nach vorn (01:30 UTC = 03:30 Sommerzeit)', new Date(W('2026-03-29T02:30', TZ)).toISOString() === '2026-03-29T01:30:00.000Z');
  const m1 = { id: 'm1', sportId: 'running', source: 'manual', status: 'completed', startedAt: '2026-07-18T18:00', durationSeconds: 3600, summary: { distanceKm: 12 }, metrics: {} };
  const m2 = { id: 'm2', sportId: 'running', source: 'garmin', status: 'completed', startedAt: '2026-07-18T16:30:00.000Z', durationSeconds: 3600, summary: {}, metrics: {} };
  const e1 = L.entriesFor(m1, { timeZone: TZ })[0], e2 = L.entriesFor(m2, { timeZone: TZ })[0];
  ok('T8 manuell 18:00 (Berlin) liegt VOR Garmin 18:30 Ortszeit — gleiche Zeitachse', e1.orderKey < e2.orderKey && e1.utcBasis === 'wall_clock@Europe/Berlin', e1.orderKey + ' / ' + e2.orderKey);
}

sec('B · Umstellung der bestehenden Rekordanzeigen');
const runs = [run(uuid(1), '2026-08-02T06:00:00', '2026-08-02T08:00:00', { s5k: 1510 }), run(uuid(2), '2026-09-13T06:00:00', '2026-09-13T08:00:00', { s5k: 1445, dist: 12000 }),
              run(uuid(3), '2026-09-27T06:00:00', '2026-09-27T08:00:00', { s5k: 1300, type: 'treadmill_running', dist: 5000 }),
              run(uuid(5), '2026-09-29T06:00:00', '2026-09-29T08:00:00', { type: 'treadmill_running', dist: 15000 })];
runs[2].durationSeconds = 1300; runs[2].metrics.garmin.timer_duration_s = 1300;      // Laufband-5-km in 21:40 (bisher: Gesamtaktivitaet als Messung)
const ride = GEN.referenceActivity('cycling', 'best'); ride.id = uuid(4); ride.startedAt = '2026-09-20T06:00:00.000Z'; ride.summary.distanceM = 80000;
const ALL = runs.concat([ride]);
function stubFlags(state) { return { describe: f => ({ known: f === 'performance_ledger', enabled: state.on, stale: !!state.stale, source: state.src || 'server' }), isEnabled: f => f === 'performance_ledger' && state.on, refresh: () => Promise.resolve() }; }
{
  S._reset();
  const legacyRB = J(RB.measuredBestsLegacy(ALL, { sport: 'running' })), legacyAC = J(AC.computeAchievements(ALL, { distanceOf: null }));
  ok('B1 Flag aus: Bruecke = off', BR.mode() === 'off');
  ok('B2 Flag aus: run-bests byte-gleich wie bisher', J(RB.measuredRunBests(ALL)) === legacyRB && J(RB.measuredAllBests(ALL).running) === legacyRB);
  ok('B3 Flag aus: Meilensteine/Medaillen byte-gleich wie bisher', J(AC.computeAchievements(ALL)) === legacyAC);
  /* an, aber noch nicht geladen */
  const flags = stubFlags({ on: true });
  O.featureFlags = flags;
  ok('B4 Flag an, Register nicht geladen: pending → bisherige Werte, kein Umspringen', BR.mode() === 'pending' && J(RB.measuredRunBests(ALL)) === legacyRB);
  await S.refresh(ALL, { timeZone: TZ }, { flags, cache: null, repo: null, uid: () => 'u1', declared: () => ({}), emit: () => {} });
  O.user = { id: 'u1' };
  ok('B5 Register geladen: on', BR.mode() === 'on', BR.mode());
  const ov = RB.measuredRunBests(ALL);
  ok('B6 Laufbestzeiten kommen NUR aus dem Register (method ledger)', ov.k5 && ov.k5.method === 'ledger' && ov.k5.sec === 1445 && ov.k5.activityId === uuid(2), J(ov.k5));
  ok('B7 Laufband-5-km (21:40) zaehlt nicht — wie im Register', ov.k5.sec !== 1300 && JSON.parse(legacyRB).k5.sec <= 1300);
  ok('B8 Rad/Schwimmen (vom Register nicht gefuehrt) unveraendert', J(RB.measuredAllBests(ALL).cycling) === J(RB.measuredBestsLegacy(ALL, { sport: 'cycling' })));
  const acOn = AC.computeAchievements(ALL), acOff = JSON.parse(legacyAC);
  const lo = acOn.milestones.find(m => m.id === 'run_longest'), loOff = acOff.milestones.find(m => m.id === 'run_longest');
  ok('B9 „Laengster Lauf" ohne Laufband (12 km statt 15 km) — gleich dem Register', lo.current === 12 && loOff.current === 15 && L.currentBest(S.model ? O.performanceLedger.update(null, ALL, { timeZone: TZ }).state.events['running.longest_distance@standard'] : []).value === 12000, lo.current + ' / ' + loOff.current);
  const tot = acOn.milestones.find(m => m.id === 'run_total_km');
  ok('B10 Laufkilometer gesamt: Laufband zaehlt (Summe, jede Klasse)', tot.current === 42, tot.current);
  const rideM = acOn.milestones.find(m => m.id === 'ride_longest');
  ok('B11 Garmin-Raddistanz (Bedeutung unbelegt) zaehlt nicht als laengste Radeinheit', rideM.current === 0 && acOff.milestones.find(m => m.id === 'ride_longest').current === 80);
  ok('B12 Quelle ausgewiesen', acOn.source === 'ledger' && /Leistungsregister/.test(acOn.provenance));
  const pbIn = O.pbSync ? true : null;
  ok('B13 pb-sync pausiert bei pending (profile.js prueft die Bruecke)', /recordsBridge\.mode\(\)==='pending'\)return null/.test(rd('js/profile.js')) && /orvia:ledger-updated/.test(rd('js/profile.js')));
  O.featureFlags = FF; S._reset(); delete O.user;
}

sec('F · Vollstaendiger Bestand');
function serverRow(a) {
  return { id: a.id, user_id: 'u', sport_id: a.sportId, source: a.source, started_at: a.startedAt, duration_seconds: a.durationSeconds, status: a.status || 'completed',
           summary: clone(a.summary || {}), linked_activity_id: a.linkedActivityId || null, updated_at: a.updatedAt || '2026-10-01T00:00:00Z', metrics: clone(a.metrics || {}) };
}
function fakeRepo(rows, o = {}) {
  const calls = { index: 0, fetch: [], exist: [], apply: 0 };
  const repo = {
    calls,
    listActivityIndex: async () => { calls.index++; if (o.indexFail) return { success: false, error: { code: 'query_failed' } };
      return { success: true, data: { rows: rows.filter(r => !(o.hidden || []).includes(r.id)).map(r => ({ id: r.id, updated_at: r.updated_at, linked_activity_id: r.linked_activity_id, status: r.status })), complete: !o.incomplete } }; },
    fetchActivities: async ids => { calls.fetch.push(ids.slice()); return { success: true, data: rows.filter(r => ids.includes(r.id)).map(clone) }; },
    existingIds: async ids => { calls.exist.push(ids.slice()); return { success: true, data: ids.filter(id => rows.some(r => r.id === id)) }; },
    apply: async () => { calls.apply++; return { success: true, data: {} }; },
    dirtyKeys: async () => ({ success: true, data: [] })
  };
  return repo;
}
const on = { describe: () => ({ known: true, enabled: true, stale: false, source: 'server' }) };
function memCache() { const m = {}; return { kind: 'memory', m, get: async k => m[k] ?? null, set: async (k, v) => (m[k] = v, true), del: async k => (delete m[k], true) }; }
{
  S._reset();
  const rows = runs.map(serverRow);
  const repo = fakeRepo(rows), cache = memCache();
  const d = { flags: on, repo, cache, uid: () => 'u', tombstones: () => [], declared: () => ({}), emit: () => {}, timeZone: TZ, now: () => 1e12 };
  const r1 = await S.sync({}, d);
  ok('F1 erster Lauf: Index + alle laden', r1.ok && repo.calls.index === 1 && repo.calls.fetch[0].length === runs.length && r1.meta.complete === true, J(r1.meta));
  const r2 = await S.sync({ force: true }, d);
  ok('F2 zweiter Lauf: nur Index, nichts geladen (unveraendert)', r2.ok && repo.calls.fetch.length === 1 && r2.changes.affectedKeys.length === 0);
  rows[1].updated_at = '2026-10-02T00:00:00Z'; rows[1].metrics.best_efforts.distance.targets['5000'].s = 1400;
  const r3 = await S.sync({ force: true }, d);
  ok('F3 geaenderte Aktivitaet: genau sie wird geladen', repo.calls.fetch[1].join() === uuid(2) && r3.model.sports[0].records.find(x => x.metricKey === 'running.fastest_5000m@standard').best.value === 1400);
  /* unvollstaendiger Index: fehlende Aktivitaet ist NICHT geloescht */
  const repoI = fakeRepo(rows, { incomplete: true, hidden: [uuid(1)] });
  const r4 = await S.sync({ force: true }, Object.assign({}, d, { repo: repoI }));
  ok('F4 Index unvollstaendig: nicht gelistete Aktivitaet bleibt (keine Loeschung, keine Gegenprobe)', r4.changes.removed.length === 0 && repoI.calls.exist.length === 0 && r4.meta.complete === false);
  /* vollstaendig, aber Gegenprobe findet die Aktivitaet doch (Rennen beim Lesen) */
  const repoR = fakeRepo(rows, { hidden: [uuid(1)] });
  const r5 = await S.sync({ force: true }, Object.assign({}, d, { repo: repoR }));
  ok('F5 Gegenprobe: existiert noch → nicht geloescht', r5.changes.removed.length === 0 && repoR.calls.exist[0].join() === uuid(1));
  /* wirklich geloescht */
  const rowsDel = rows.filter(r => r.id !== uuid(3));
  const repoD = fakeRepo(rowsDel);
  const r6 = await S.sync({ force: true }, Object.assign({}, d, { repo: repoD }));
  ok('F6 vollstaendig + Gegenprobe bestaetigt → geloescht', r6.changes.removed.join() === uuid(3));
  /* Tombstone (lokal geloescht, Server noch nicht) */
  const r7 = await S.sync({ force: true }, Object.assign({}, d, { repo: fakeRepo(rowsDel), tombstones: () => [{ clientRecordId: 'x', serverId: uuid(2) }] }));
  ok('F7 lokaler Tombstone = ausdrueckliche Loeschung', r7.changes.removed.join() === uuid(2));
  /* gekoppelte Aufzeichnung */
  S._reset();
  const wk = serverRow({ id: uuid(10), sportId: 'gym', source: 'orvia_workout', startedAt: '2026-09-21T16:00:00.000Z', durationSeconds: 4500, summary: { totalVolumeKg: 9000 }, metrics: {} });
  const rec = serverRow({ id: uuid(11), sportId: 'gym', source: 'garmin', startedAt: '2026-09-21T16:01:00.000Z', durationSeconds: 4600, linkedActivityId: uuid(10), summary: {}, metrics: { detailsVersion: 3 } });
  const repoL = fakeRepo([wk, rec]);
  const r8 = await S.sync({ force: true }, Object.assign({}, d, { repo: repoL, uid: () => 'u-link' }));
  ok('F8 gekoppelte Uhr-Aufzeichnung: nicht geladen, nicht gezaehlt', !repoL.calls.fetch[0].includes(uuid(11)) && r8.meta.linked === 1);
  const dupRepo = fakeRepo([wk]); dupRepo.fetchActivities = async ids => ({ success: true, data: [clone(wk), clone(wk)] });
  S._reset();
  const r9 = await S.sync({ force: true }, Object.assign({}, d, { repo: dupRepo, uid: () => 'u-dup' }));
  ok('F9 dieselbe Zeile doppelt geliefert: einmal gezaehlt', r9.changes.added.length === 1);
  const fail1 = await S.sync({ force: true }, Object.assign({}, d, { repo: fakeRepo(rows, { indexFail: true }), uid: () => 'u-x' }));
  ok('F10 Index nicht lesbar: kein Rechnen, kein Loeschen, Fehlercode', fail1.ok === false && /query_failed|index_failed/.test(fail1.code));
}

sec('C · Korrektur, Garmin, manuell ueber den Serverweg');
{
  S._reset();
  const w341 = serverRow({ id: uuid(20), sportId: 'gym', source: 'orvia_workout', startedAt: '2026-09-21T16:00:00.000Z', durationSeconds: 20460, summary: { totalVolumeKg: 8000 },
    metrics: { corrections: { duration: { manual: 4500, source: 20460, unit: 's', at: '2026-10-11T08:00:00.000Z', method: 'manual' } } } });
  const man = serverRow({ id: uuid(21), sportId: 'running', source: 'manual', startedAt: '2026-09-01T07:30:00Z', durationSeconds: 5400, summary: { distance_km: 18 }, metrics: {} });
  const g = serverRow(runs[0]);
  const r = await S.sync({ force: true }, { flags: on, repo: fakeRepo([w341, man, g]), cache: memCache(), uid: () => 'u-c', tombstones: () => [], declared: () => ({}), emit: () => {}, timeZone: TZ });
  const gym = r.model.sports.find(s => s.sport === 'gym').records.find(x => x.metricKey === 'gym.longest_duration@all');
  ok('C1 Kraftkorrektur 341 → 75 min: Register zaehlt 75 min, als korrigiert markiert', gym.best.value === 4500 && gym.best.manual === true && gym.provenance.validation === 'manual_override', J(gym.best));
  const runRec = r.model.sports.find(s => s.sport === 'running').records.find(x => x.metricKey === 'running.longest_distance@standard');
  ok('C2 manuelle Einheit ueber den Serverweg (snake_case → normalisiert): 18 km, eigene Daten', runRec.best.value === 18000 && runRec.provenance.validation === 'own_data' && runRec.provenance.source === 'manual');
  const r5 = r.model.sports.find(s => s.sport === 'running').records.find(x => x.metricKey === 'running.fastest_5000m@standard');
  ok('C3 Garmin-Lauf: 5 km aus den Worker-Bestwerten, geprueft, Herkunft vollstaendig ausgewiesen', r5.best.value === 1510 && r5.provenance.source === 'garmin' && r5.provenance.validation === 'validated' && /targets\.5000/.test(r5.provenance.basis) && r5.provenance.utc === '2026-08-02T06:00:00.000Z');
  ok('C4 Repository waehlt nur Teilpfade aus metrics (keine vollen Messreihen, keine Strecke)', /m_be:metrics->best_efforts/.test(O.performanceLedgerRepository.SELECT) && !/metrics->route|metrics,|metrics->streams,/.test(O.performanceLedgerRepository.SELECT));
}

sec('S · Schalter und Konten');
{
  S._reset();
  const st = { on: true, stale: false };
  const f = stubFlags(st);
  ok('S1 an (frisch gelesen)', S.enabled({ flags: f }) === true);
  st.stale = true;
  ok('S2 Flag-Wert abgelaufen: Entscheidung haelt fuer die Sitzung (kein Umspringen)', S.enabled({ flags: f }) === true);
  st.stale = false; st.on = false;
  ok('S3 Server liefert ausdruecklich aus: sofort aus', S.enabled({ flags: f }) === false);
  st.on = true; S.enabled({ flags: f }); st.src = 'kill_switch'; st.stale = true;
  ok('S4 Notschalter: sofort aus', S.enabled({ flags: f }) === false);
  S._reset();
  ok('S5 Standard ohne Lesen: aus', S.enabled({ flags: { describe: () => ({ known: true, enabled: false, stale: true, source: 'never_loaded' }) } }) === false);
  S._reset();
  const repoA = fakeRepo(runs.map(serverRow)), cache = memCache();
  const base = { flags: on, cache, tombstones: () => [], declared: () => ({}), emit: () => {}, timeZone: TZ };
  await S.sync({ force: true }, Object.assign({ repo: repoA, uid: () => 'A' }, base));
  const repoB = fakeRepo([serverRow(ride)]);
  const rB = await S.sync({ force: true }, Object.assign({ repo: repoB, uid: () => 'B' }, base));
  ok('S6 Kontowechsel: B startet leer, nichts von A wird entfernt oder gesendet', rB.changes.removed.length === 0 && rB.changes.added.join() === uuid(4) && Object.keys(cache.m).filter(k => /_A$|_B$/.test(k)).length === 2);
  S._reset();
  const rA = await S.sync({ force: true }, Object.assign({ repo: fakeRepo(runs.map(serverRow)), uid: () => 'A' }, base));
  ok('S7 zurueck zu A: aus dem Zwischenspeicher, nichts neu geladen', rA.changes.added.length === 0 && rA.meta.fetched === 0);
  S._reset();
  const d0 = Object.assign({ repo: fakeRepo(runs.map(serverRow)), uid: () => 'T', now: () => 1000 }, base);
  await S.sync({}, d0); const t2 = await S.sync({}, Object.assign({}, d0, { now: () => 2000 }));
  ok('S8 gebuendelt: zweiter Lauf innerhalb einer Minute wird nicht ausgefuehrt', t2.code === 'throttled');
}

sec('D · Echtdaten-Probelauf');
{
  S._reset();
  const cache = memCache(), repo = fakeRepo(runs.map(serverRow));
  const off = { describe: () => ({ known: true, enabled: false, stale: false, source: 'server_no_row' }) };
  const r = await S.dryRun({ activities: ALL }, { flags: off, repo, cache, uid: () => 'u', tombstones: () => [], declared: () => ({}), emit: () => { throw new Error('kein Ereignis im Probelauf'); }, timeZone: TZ });
  ok('D1 Probelauf auch bei Flag aus — liest, rechnet', r.ok && r.report.records.length > 0 && r.report.meta.complete === true);
  ok('D2 schreibt nichts: kein Zwischenspeicher, kein Server, kein Zustand', Object.keys(cache.m).length === 0 && repo.calls.apply === 0 && S.model({ flags: off }) === null);
  const cmp = r.report.legacyComparison.running.find(x => x.key === 'k5');
  const noMig = Object.assign({}, repo, { apply: () => { throw new Error('Tabelle fehlt'); }, dirtyKeys: () => { throw new Error('Tabelle fehlt'); } });
  S._reset();
  const r4 = await S.dryRun({ activities: ALL }, { flags: off, repo: noMig, cache, uid: () => 'u', tombstones: () => [], declared: () => ({}), emit: () => {}, timeZone: TZ });
  ok('D4 Probelauf braucht Migration 0051 nicht (keine Register-Tabelle, kein Vermerk-Abruf)', r4.ok && r4.report.records.length === r.report.records.length);
  ok('D3 Vergleich bisher ↔ Register je Distanz (bisherige Bestzeit stammt vom Laufband, Register nicht)', cmp.verdict === 'abweichend' && cmp.bisher.activityId === uuid(3) && cmp.register.sec === 1445 && cmp.register.activityId === uuid(2), J(cmp));
}

sec('M · Zwischenspeicher');
{
  const big = 'x'.repeat(S.LS_LIMIT + 1), mem = {}; const ls = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const c = S.lsCache(ls);
  ok('M1 localStorage-Rueckfall nimmt nichts ueber der Grenze (Safari ~5 MB fuer die ganze App)', (await c.set('k', big)) === false && !('k' in mem));
  S._reset();
  const st = L.update(null, runs, { timeZone: TZ }).state, key = 'orvia_perf_ledger_' + L.CALC_VERSION + '_U';
  const legacy = { m: { [key]: L.serialize(st) }, getItem(k) { return this.m[k] ?? null; }, removeItem(k) { delete this.m[k]; } };
  const idb = memCache(); idb.kind = 'indexeddb';
  const r = await S.sync({ force: true }, { flags: on, repo: fakeRepo(runs.map(r2 => Object.assign(serverRow(r2), { updated_at: null }))), cache: idb, storage: legacy, uid: () => 'U', tombstones: () => [], declared: () => ({}), emit: () => {}, timeZone: TZ });
  ok('M2 Uebernahme aus v8-448A: localStorage → IndexedDB, alter Eintrag geloescht', !(key in legacy.m) && typeof idb.m[key] === 'string' && r.ok);
}

sec('I · Auslieferung');
{
  const html = rd('index.html'), sw = rd('sw.js');
  const order = ['js/engine/feature-flags.js', 'js/engine/metric-eligibility.js', 'js/engine/performance-ledger.js', 'js/engine/records-bridge.js', 'js/repos/performanceLedgerRepository.js', 'js/performance-ledger-store.js', 'js/screens/performance-ledger-view.js'];
  const pos = order.map(f => html.indexOf('<script src="' + f + '"></script>'));
  ok('I1 Bausteine in index.html, in Abhaengigkeitsreihenfolge, je einmal', pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])) && order.every(f => html.split(f).length === 2), J(pos));
  ok('I2 alle im Offline-Speicher, Build >= v8-448, index = sw', order.every(f => sw.includes("'./" + f + "'")) && (() => { const v = (sw.match(/const C = 'orvia-v8-(\d+)'/) || [])[1]; return +v >= 448 && html.includes('content="orvia-v8-' + v + '"'); })());
  const ui = rd('js/ui.js');
  ok('I3 Einstieg in die Ansicht nur bei Bruecke ≠ off', /recordsBridge\.mode\(\)!=='off'\)h\+='<button type="button" class="bt-row plv-entry"/.test(ui));
  ok('I4 Route prueft das Flag selbst (Direktaufruf zeigt nichts)', /if\(!V\|\|!S\|\|!S\.enabled\(\)\)return h\+/.test(ui));
  const INV = await import(new URL(_APPREL + 'tools/i18n-inventory.mjs', import.meta.url).href);
  const viewSrc = rd('js/screens/performance-ledger-view.js'), de = rd('locales/de.js');
  const used = [...new Set([...(viewSrc + ui).matchAll(/T\('(ledger\.[\w.]+)'|_uiT\('(ledger\.[\w.]+)'/g)].map(m => m[1] || m[2]))];
  const dyn = ['sport', 'class', 'reason', 'source', 'valid', 'quality'].filter(g => !new RegExp("'ledger\\." + g + "\\.\\w+'").test(de));
  const missing = dyn.map(g => 'ledger.' + g + '.*').concat(used.filter(k => !/\.$/.test(k)).filter(k => !de.includes("'" + k + "'") && !de.includes("'" + k + ".one'")));
  ok('I5 Ansicht nur ueber t(): keine deutschen Literale, jeder ledger.*-Schluessel in locales/de.js', INV.scanFile(fileURLToPath(new URL(_APPREL + 'js/screens/performance-ledger-view.js', import.meta.url))).length === 0 && used.length > 40 && !missing.length, missing.join(',') || used.length + ' Schluessel');
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_integration_v448b: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
