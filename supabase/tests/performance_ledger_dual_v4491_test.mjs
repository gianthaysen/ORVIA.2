/* ============================================================
   ORVIA · performance_ledger_dual (v8-449.1) — zwei Rekordkategorien: AKTIVE Trainingsbestzeit (Timer) und
   Bestzeit EINSCHLIESSLICH Pausen (verstrichen), dazu die vorbereitete Wettkampfbestzeit.

   Grundlage: die 15 echten Garmin-Laeufe des Produktions-Probelaufs (_ledger-realdata.mjs).
   E  Echtdaten: welche Werte in welcher Kategorie — und mit welcher Messgrundlage
   K  Kandidaten der aktiven Zeit: Timer-Fenster (Worker) · ganze Aktivitaet (Timer) · verstrichenes Fenster
   V  Validierung: Strecke bei stehendem Timer, Timer > verstrichen, unvollstaendige Reihe, fehlende Zeiten
   Q  eigene Daten, Korrektur, Laufband, gekoppelte Aufzeichnung, Teilbestand, Loeschung, Nachimport, Reimport, Zeit
   W  Wettkampf (vorbereitet): nur bestaetigt, nie geraten
   P  Persistenz: Zeilen, Zwischenspeicher, Rechenversion
   B  bestehende Anzeigen: run-bests (Flag aus), Bruecke (Flag an), pb-sync und Prognosegrundlage
   U  Ansicht: Paarkarte, Umschalter, Hinweis, Texte ueber t()
   ============================================================ */
import { createRequire } from 'node:module';
import { existsSync as _ex, readFileSync } from 'node:fs';
import { DIAG, diagRun, uuid } from './_ledger-realdata.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
const clone = o => JSON.parse(JSON.stringify(o));

globalThis.window = globalThis;
for (const f of ['js/i18n.js', 'locales/de.js', 'js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js',
  'js/activity-time.js', 'js/activity-effective.js', 'js/run-bests.js', 'js/engine/pb-sync.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
for (const f of ['js/engine/performance-ledger.js', 'js/engine/feature-flags.js', 'js/engine/records-bridge.js', 'js/performance-ledger-store.js', 'js/screens/performance-ledger-view.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger, ME = O.metricEligibility, RB = O.runBests, BR = O.recordsBridge, AE = O.activityEffective, PB = O.pbSync, S = O.performanceLedgerStore, V = O.performanceLedgerView;
const TZ = 'Europe/Berlin';
const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
const byDate = d => RUNS.find(a => a.metrics.garmin.start_gmt.startsWith(d));
const R0715 = byDate('2026-07-15'), R0729 = byDate('2026-07-29'), R0813 = byDate('2026-08-13'), R0906 = byDate('2026-09-06'), R0721 = byDate('2026-07-21');
const KA = t => 'running.fastest_' + t + 'm_active@standard', KE = t => 'running.fastest_' + t + 'm@standard';
const best = (st, k) => L.currentBest(st.events[k]);
const prov = (st, a, t, act) => (L.entryOf(st, a.id, 'running.fastest_' + t + 'm' + (act ? '_active' : '')) || {}).provenance || {};

sec('E · Echtdaten: 15 Laeufe, beide Kategorien');
const ST = L.update(null, RUNS, { timeZone: TZ }).state;
{
  const a5 = best(ST, KA(5000)), e5 = best(ST, KE(5000));
  ok('E1 aktive 5 km: 23:38 am 13.08. (Garmin-Timer der ganzen Aktivitaet, 5,006 km)', a5.value === 1418 && a5.activityId === R0813.id && a5.localDate === '2026-08-13'
     && prov(ST, R0813, 5000, true).measure === 'activity_timer' && prov(ST, R0813, 5000, true).distanceM === 5005.73, J([a5.value, a5.localDate]));
  ok('E2 5 km einschliesslich Pausen: 29:11 am 06.09. (Teilstueck im Halbmarathon) — eigener Halter', e5.value === 1751 && e5.activityId === R0906.id);
  const a10 = best(ST, KA(10000)), e10 = best(ST, KE(10000));
  ok('E3 aktive 10 km: 57:55 am 15.07. (Timer, 10,041 km)', a10.value === 3475 && a10.activityId === R0715.id && prov(ST, R0715, 10000, true).measure === 'activity_timer');
  ok('E4 10 km einschliesslich Pausen: 1:01:49 am 06.09.', e10.value === 3709 && e10.activityId === R0906.id);
  const a1 = best(ST, KA(1000)), e1 = best(ST, KE(1000));
  ok('E5 1 km: aktiv = einschliesslich Pausen = 4:21 (29.07.); aktiv belegt durch das verstrichene Teilstueck (Obergrenze)', a1.value === 261 && e1.value === 261 && prov(ST, R0729, 1000, true).measure === 'elapsed_window');
  const ah = best(ST, KA(21098)), eh = best(ST, KE(21098));
  ok('E6 Halbmarathon: aktiv = einschliesslich Pausen = 2:20:47 — Teilstueck schlaegt Gesamtzeit 2:22:12', ah.value === 8447 && eh.value === 8447 && prov(ST, R0906, 21098, true).candidates.some(c => c.kind === 'activity_timer' && c.value === 8532));
  const e13 = L.entryOf(ST, R0813.id, 'running.fastest_5000m');
  ok('E7 13.08. bleibt in der Kategorie „einschliesslich Pausen" mit 33:15 (1995 s) — nicht gesperrt, nur langsamer', e13.eligibility === 'eligible' && e13.value === 1995);
  ok('E8 Pausen des 13.08. benannt: 579 s angehalten (verstrichen − Timer), nicht als Timer-Ereignisse erfunden', prov(ST, R0813, 5000, true).pauses.pausedS === 579 && prov(ST, R0813, 5000, true).pauses.count === null);
  const h = ST.events[KA(5000)].map(e => [e.localDate, e.value, e.type]);
  ok('E9 aktive 5-km-Historie aus echten Laeufen (chronologisch, UTC)', J(h.map(x => x[0])) === J(h.map(x => x[0]).slice().sort()) && h[h.length - 1][1] === 1418 && ST.events[KA(5000)].every(e => e.timeCategory === 'active'), J(h));
  ok('E10 Historien getrennt: 1418 s steht nie in der Kategorie einschliesslich Pausen', !ST.events[KE(5000)].some(e => e.value === 1418) && ST.events[KE(5000)].every(e => e.timeCategory === 'elapsed'));
  ok('E11 keine Bewegungszeit als Wert (13.08. moving 1416 s)', !Object.values(ST.events).flat().some(e => e.value === 1416));
}

sec('K · Kandidaten der aktiven Zeit');
{
  const w = clone(R0813);
  w.metrics.best_efforts.distance_active = { v: 1, basis: 'timer', status: 'ok', rows: 1423, total_m: 5005.2, timer_s: 1418, pauses: 3, paused_s: 579, pause_kind: 'unknown',
    targets: { 1000: { s: 271.4, over_m: 0.4, at: 300, q: 'measured' }, 5000: { s: 1416.2, over_m: 0.3, at: 1, q: 'measured' } } };
  const r = ME.evaluate(w, 'distanceBestActive', { targetM: 5000 });
  ok('K1 Timer-Fenster aus allen Messzeilen (Worker v8-449.1) ist exakt und schlaegt die Gesamtzeit: 1416,2 s', r.eligible && r.value === 1416.2 && r.provenance.measure === 'timer_window' && r.provenance.quality === 'exact', J(r.provenance.candidates));
  ok('K2 Pausen aus dem Worker: Anzahl und Dauer', r.provenance.pauses.count === 3 && r.provenance.pauses.pausedS === 579);
  const r1 = ME.evaluate(w, 'distanceBestActive', { targetM: 1000 });
  ok('K3 aktives Teilstueck eines laengeren Laufs (1 km im 5-km-Lauf): Timer-Fenster 271,4 s < verstrichen 279 s', r1.value === 271.4 && r1.provenance.measure === 'timer_window');
  const coarse = ME.evaluate(R0721, 'distanceBestActive', { targetM: 5000 });
  ok('K4 5,139 km sind KEINE 5-km-Gesamtzeit (Ueberhang > 1 %): nur das verstrichene Teilstueck 1835 s zaehlt', coarse.value === 1835 && coarse.provenance.measure === 'elapsed_window' && !coarse.provenance.candidates.some(c => c.kind === 'activity_timer'));
  ok('K5 Ueberhang-Regel wie im Worker: 10 m oder 1 %', ME.evaluate((x => { x.summary = { distanceM: 5051 }; x.metrics.streams.distance = [0.57, 5051]; return x; })(clone(R0813)), 'distanceBestActive', { targetM: 5000 }).provenance.candidates.every(c => c.kind !== 'activity_timer'));
}

sec('V · Validierung');
{
  const cf = clone(R0813);
  cf.metrics.best_efforts.distance_active = { v: 1, basis: 'timer', status: 'ok', pauses: 1, paused_s: 300, conflicts: 1, conflict_m: 503.5, targets: { 5000: { q: 'split_by_conflict' } } };
  const r = ME.evaluate(cf, 'distanceBestActive', { targetM: 5000 });
  ok('V1 Strecke bei stehendem Timer: Gesamtzeit verworfen, nur das verstrichene Teilstueck (Obergrenze)', r.eligible && r.value === 1995 && r.provenance.measure === 'elapsed_window');
  const cf2 = clone(cf); delete cf2.metrics.best_efforts.distance.targets['5000'];
  const r2 = ME.evaluate(cf2, 'distanceBestActive', { targetM: 5000 });
  ok('V2 … und ohne verstrichenes Teilstueck: gesperrt mit Grund pause_conflict', !r2.eligible && r2.reason === 'pause_conflict');
  const tb = clone(R0813); tb.metrics.garmin.timer_duration_s = 2100; tb.durationSeconds = 2100;
  ok('V3 Timer > verstrichen (widersinnig): keine Gesamtzeit', ME.evaluate(tb, 'distanceBestActive', { targetM: 5000 }).provenance.candidates.every(c => c.kind !== 'activity_timer'));
  const ns = clone(R0813); ns.metrics.streams.distance = [0, 4700];
  ok('V4 Messreihe passt nicht zur Distanz (unvollstaendig): Distanz nicht freigegeben → keine Gesamtzeit', ME.evaluate(ns, 'distanceBestActive', { targetM: 5000 }).provenance.candidates.every(c => c.kind !== 'activity_timer'));
  const nt = clone(R0813); delete nt.metrics.garmin.timer_duration_s;
  ok('V5 fehlende Timer-Summe: Dauer nicht belegt → nur verstrichenes Teilstueck', ME.evaluate(nt, 'distanceBestActive', { targetM: 5000 }).value === 1995);
  const ne = clone(R0813); delete ne.metrics.garmin.elapsed_duration_s;
  const rne = ME.evaluate(ne, 'distanceBestActive', { targetM: 5000 });
  ok('V6 fehlende verstrichene Zeit: Timer-Gesamtzeit bleibt, Pausen „nicht bekannt"', rne.value === 1418 && !rne.provenance.pauses);
  const legacy = clone(R0813); legacy.metrics.detailsVersion = 2;
  ok('V7 alter Details-Vertrag: beide Kategorien gesperrt (legacy_schema)', ME.evaluate(legacy, 'distanceBestActive', { targetM: 5000 }).reason === 'legacy_schema' && ME.evaluate(legacy, 'distanceBest', { targetM: 5000 }).reason === 'legacy_schema');
}

sec('Q · Quellen, Korrekturen, Bestand');
{
  const man = { id: uuid(90), sportId: 'running', source: 'manual', status: 'completed', startedAt: '2026-09-20T18:00', durationSeconds: 1500, summary: { distanceKm: 5 }, metrics: {} };
  const rm = ME.evaluate(man, 'distanceBestActive', { targetM: 5000 });
  ok('Q1 manuelle 5 km in 25:00: aktive Bestzeit „deine Angabe", nie „einschliesslich Pausen"', rm.eligible && rm.value === 1500 && rm.provenance.measure === 'own_total' && ME.evaluate(man, 'distanceBest', { targetM: 5000 }).reason === 'unsupported_source');
  const stM = L.update(null, [man], { timeZone: TZ }).state;
  ok('Q2 Validierungsstatus eigene Daten', L.entryOf(stM, man.id, 'running.fastest_5000m_active').validation === 'own_data');
  ok('Q3 manuelle 7 km: keine 5-km-Zeit aus einer Gesamtangabe', !ME.evaluate(Object.assign(clone(man), { summary: { distanceKm: 7 } }), 'distanceBestActive', { targetM: 5000 }).eligible);
  const corr = AE.setManual(clone(R0813), 'duration', 1460).activity;
  const rc = ME.evaluate(corr, 'distanceBestActive', { targetM: 5000 });
  ok('Q4 korrigierte Dauer: wirksamer Wert als Gesamtzeit, manuell gekennzeichnet', rc.value === 1460 && rc.provenance.manual === true && rc.provenance.measure === 'activity_timer');
  const tm = clone(R0813); tm.metrics.garmin.type_key = 'treadmill_running';
  ok('Q5 Laufband: beide Kategorien unsupported_source', ME.evaluate(tm, 'distanceBestActive', { targetM: 5000 }).reason === 'unsupported_source' && ME.evaluate(tm, 'distanceBest', { targetM: 5000 }).reason === 'unsupported_source');
  const linked = Object.assign(clone(R0813), { id: uuid(91), linkedActivityId: uuid(92) }), prim = { id: uuid(92), sportId: 'running', source: 'orvia_workout', status: 'completed', startedAt: '2026-08-13T16:17:00.000Z', durationSeconds: 1418, summary: { distanceKm: 4.9 }, metrics: {} };
  const stL = L.update(null, [linked, prim], { timeZone: TZ }).state;
  ok('Q6 gekoppelte Uhr-Aufzeichnung zaehlt nicht doppelt', !stL.activities[uuid(91)] && !!stL.activities[uuid(92)]);
  const part = L.update(ST, RUNS.slice(-2), { timeZone: TZ, partial: true }).state;
  ok('Q7 Teilbestand (nur 2 Laeufe geladen): keine Rekorde verschwinden', best(part, KA(5000)).value === 1418 && best(part, KA(10000)).value === 3475);
  const del = L.update(ST, RUNS.filter(a => a !== R0813), { timeZone: TZ });
  ok('Q8 Loeschung 13.08.: aktive 5 km fallen auf 29:11 (Halbmarathon), Pausen-Kategorie unveraendert', best(del.state, KA(5000)).value === 1751 && best(del.state, KE(5000)).value === 1751 && del.changes.log.some(l => l.metricKey === KA(5000) && l.reason === 'activity_removed'));
  const reimp = clone(R0813); reimp.metrics.garmin.timer_duration_s = 1430; reimp.durationSeconds = 1430;
  const ri = L.update(ST, RUNS.map(a => a === R0813 ? reimp : a), { timeZone: TZ });
  ok('Q9 Garmin-Reimport mit anderer Timer-Summe: Historie neu, 23:50', best(ri.state, KA(5000)).value === 1430 && ri.changes.updated.includes(R0813.id));
  const old = diagRun(GEN, 40, ['2026-05-30T08:00:00Z', 1405, 1500, 1400, 5004, 0, 5003.9, 1406, { 1000: [270, 0.2], 5000: [1500, 0.5] }]);
  const ni = L.update(ST, RUNS.concat([old]), { timeZone: TZ });
  ok('Q10 Nachimport eines aelteren, schnelleren Laufs: Historie umgeschrieben, aktueller Bestwert 23:25 vom 30.05.', best(ni.state, KA(5000)).value === 1405 && ni.changes.log.some(l => l.metricKey === KA(5000) && l.reason === 'history_rewritten'));
  const dst1 = diagRun(GEN, 41, ['2026-10-25T00:30:00Z', 1400, 1400, 1400, 5005, 0, 5004, 1401, { 5000: [1399, 0.2] }]);
  const dst2 = diagRun(GEN, 42, ['2026-10-25T01:30:00Z', 1390, 1390, 1390, 5005, 0, 5004, 1391, { 5000: [1389, 0.2] }]);
  dst1.metrics.garmin.start_local = dst2.metrics.garmin.start_local = '2026-10-25T02:30:00';
  const hd = L.update(null, [dst2, dst1], { timeZone: TZ }).state.events[KA(5000)];
  ok('Q11 Zeitumstellung: gleiche Ortszeit 02:30, Reihenfolge nach UTC (00:30Z vor 01:30Z) auch in der aktiven Kategorie', hd[0].activityId === dst1.id && hd[1].activityId === dst2.id && hd[1].type === 'improved');
}

sec('W · Wettkampf (vorbereitet)');
{
  const noRace = L.update(null, RUNS, { timeZone: TZ }).state;
  ok('W1 ohne Bestaetigung keine Wettkampfbestzeit — auch nicht fuer den Halbmarathon', !Object.keys(noRace.events).some(k => /race_/.test(k)));
  const st = L.update(null, RUNS, { timeZone: TZ, raceIds: [R0906.clientRecordId] }).state;
  const r = best(st, 'running.race_21098m@standard');
  ok('W2 bestaetigter Halbmarathon (clientRecordId): Wettkampfbestzeit = ganze Aktivitaet, verstrichen 2:22:12', r && r.value === 8532 && r.timeCategory === 'race' && prov(st, R0906, 21098, false).measure !== 'race_total');
  const e = L.entryOf(st, R0906.id, 'running.race_21098m');
  ok('W3 als vom Nutzer bestaetigt gekennzeichnet', e.provenance.raceConfirmedBy === 'user' && e.timeCategory === 'race');
  ok('W4 aktive Trainingsbestzeit wird nie zur Wettkampfzeit (13.08. nicht bestaetigt → keine race-Eintraege)', !L.entryOf(st, R0813.id, 'running.race_5000m'));
  ok('W5 Wettkampf veraendert die anderen Kategorien nicht', best(st, KA(21098)).value === 8447 && best(st, KE(5000)).value === 1751);
  const st2 = L.update(st, RUNS, { timeZone: TZ, raceIds: [] }).state;
  ok('W6 Bestaetigung zurueckgenommen → Wettkampfbestzeit verschwindet', !st2.events['running.race_21098m@standard']);
}

sec('P · Persistenz');
{
  const rows = L.rows(ST);
  ok('P1 Zeilen tragen time_category (Eintraege und Ereignisse)', rows.entries.some(e => e.metric_key === KA(5000) && e.time_category === 'active') && rows.events.some(e => e.metric_key === KE(5000) && e.time_category === 'elapsed')
     && rows.entries.filter(e => /longest/.test(e.metric_key)).every(e => e.time_category === null));
  const back = L.deserialize(L.serialize(ST));
  ok('P2 Zwischenspeicher: Kategorien, Messgrundlage und Pausen bleiben erhalten', J(back.events) === J(ST.events) && prov(back, R0813, 5000, true).measure === 'activity_timer' && prov(back, R0813, 5000, true).pauses.pausedS === 579);
  ok('P3 Rechenversion ledger@2: Zwischenspeicher von ledger@1 wird verworfen', L.CALC_VERSION === 'ledger@2' && L.deserialize(L.serialize(ST).replace('"ledger@2"', '"ledger@1"')) === null);
  ok('P4 jeder Eintrag eindeutig nach Aktivitaet × Kennzahl (Kategorie steckt im Schluessel)', new Set(rows.entries.map(e => e.activity_id + '|' + e.metric_key)).size === rows.entries.length);
}

sec('B · bestehende Anzeigen');
{
  const lg = RB.measuredBestsLegacy(RUNS, { sport: 'running' });
  ok('B1 Flag aus · run-bests aktiv: 5 km 23:38 (Timer, 13.08.), Pausen 579 s benannt', lg.active.k5.sec === 1418 && lg.active.k5.method === 'activity_timer' && lg.active.k5.pausedS === 579 && lg.active.k5.date === '2026-08-13');
  ok('B2 Flag aus · run-bests aktiv: 10 km 57:55 (15.07.)', lg.active.k10.sec === 3475 && lg.active.k10.activityId === R0715.clientRecordId);
  ok('B3 Flag aus · Zeiten einschliesslich Pausen unveraendert (Prognosegrundlage): 5 km nicht 23:38', lg.k5.sec !== 1418 && lg.k5.timing === 'elapsed' && lg.k10.sec !== 3475);
  const pbs = PB.entries({ running: lg });
  ok('B4 pb-sync (Profil, Zonen, Prognose) liest nur die Zeit einschliesslich Pausen', pbs.every(e => e.timeSeconds !== 1418 && e.timeSeconds !== 3475));
  const on = { describe: () => ({ known: true, enabled: true, stale: false, source: 'server' }) };
  S._reset();
  await S.refresh(RUNS, { timeZone: TZ }, { flags: on, cache: null, repo: { apply: async () => ({ success: true }), dirtyKeys: async () => ({ success: true, data: [] }) }, uid: () => 'u', emit: () => {}, declared: () => ({}), raceIds: () => [] });
  const realStore = O.performanceLedgerStore;
  O.performanceLedgerStore = Object.assign({}, realStore, { enabled: () => true, ready: () => true, bestOf: k => realStore.bestOf(k, { flags: on, uid: () => 'u' }), entryOf: (a, d) => realStore.entryOf(a, d, { flags: on, uid: () => 'u' }) });
  try {
    const ov = RB.measuredRunBests(RUNS);
    ok('B5 Flag an · Bruecke: aktiv 23:38 / einschliesslich Pausen 29:11 — beide aus dem Register', ov.active.k5.sec === 1418 && ov.k5.sec === 1751 && ov.k5.method === 'ledger' && ov.active.k5.timing === 'active' && ov.k5.timing === 'elapsed', J([ov.active.k5, ov.k5]));
    ok('B6 Bruecke: Messgrundlage und Pausen der aktiven Bestzeit (fuer die Anzeige)', ov.active.k5.measure === 'activity_timer' && ov.active.k5.pausedS === 579 && ov.active.k5.km === 5.01);
    const pbOn = PB.entries({ running: ov });
    ok('B7 Flag an · pb-sync bekommt weiter die Zeit einschliesslich Pausen (29:11), nie die aktive', pbOn.find(e => e.extra.targetKey === 'k5').timeSeconds === 1751);
    const cmp = BR.compareWithLegacy(ST, RUNS);
    const c5 = cmp.runningActive.find(x => x.key === 'k5');
    ok('B8 Probelauf-Vergleich je Kategorie: aktive 5 km gleich (23:38) — keine widerspruechlichen Rekorde', c5.verdict === 'gleich' && c5.register.measure === 'activity_timer', J(c5));
  } finally { O.performanceLedgerStore = realStore; S._reset(); }
}

sec('U · Ansicht');
{
  const m = L.readModel(ST);
  const html = V.render(m, { onOpenActivity: 'f' });
  const run = m.sports.find(s => s.sport === 'running');
  ok('U1 Ueberblick zaehlt jede Strecke einmal (Paar), nicht doppelt', run.overview.records === V.groupsOf(run.records).length);
  ok('U2 Paarkarte: aktive Variante zuerst, Umschalter „Aktiv | Gesamtzeit", Standard aktiv', /data-mode="active"/.test(html) && /class="plv-mode"/.test(html) && html.indexOf('data-timing="active"') < html.indexOf('data-timing="elapsed"') && /aria-pressed="true"[^>]*>Aktiv</.test(html));
  const card5 = html.slice(html.indexOf('data-pair="running.fastest_5000m@standard"'), html.indexOf('data-pair="running.fastest_10000m@standard"'));
  ok('U3 5 km: „23:38 · Aktive Trainingsbestzeit", daneben „Einschließlich Pausen: 29:11 · 06.09.2026"', /23:38/.test(card5) && /Aktive Trainingsbestzeit/.test(card5) && /Einschließlich Pausen: 29:11 · 06\.09\.2026/.test(card5));
  ok('U4 dezenter Hinweis bei angehaltenen Pausen', /Angehaltene Trainingspausen sind in der aktiven Bestzeit nicht enthalten\./.test(card5));
  ok('U5 Herkunft nennt Zeitdefinition, Pausen und Messgrundlage in Klartext (keine Garmin-Feldnamen)', /Zeitdefinition/.test(card5) && /rund 10 min — nicht enthalten/.test(card5) && /Garmin-Timer der ganzen Aktivität \(5,01 km\)/.test(card5) && !/timer_duration_s|sumDuration|elapsed_duration_s/.test(card5));
  const de = readFileSync(new URL(_APPREL + 'locales/de.js', import.meta.url), 'utf8'), ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8');
  const used = [...new Set([...ui.matchAll(/_uiT\('(bt\.[\w.]+)'/g)].map(x => x[1]))];
  ok('U6 Bestzeiten-Seite: alle bt.*-Texte in locales/de.js', used.length >= 10 && used.every(k => de.includes("'" + k + "'")), used.filter(k => !de.includes("'" + k + "'")).join(','));
  ok('U7 Umschalter in der Ansicht schaltet die Sportart um (data-mode)', (() => { const sec2 = { a: { 'data-mode': 'active' }, setAttribute(k, v) { this.a[k] = v; }, getAttribute(k) { return this.a[k]; }, querySelectorAll: () => [] };
    V.setMode({ closest: () => sec2 }, 'elapsed'); return sec2.a['data-mode'] === 'elapsed'; })());
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_dual_v4491: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
