/* ============================================================
   ORVIA · performance_ledger (v8-448A) — chronologisches Leistungsregister

   A  Definitionen: jede Sportart (ausser „other") hat fachlich passende Rekorde; nur Eligibility entscheidet
   B  Rekordhistorie: 25:10 → 24:42 → 24:05 → 23:39, Vorher/Nachher/Verbesserung/Datum
   C  Reihenfolge = Aktivitaetszeit, nie Importzeit; Nachimport aelterer Einheiten schreibt die Historie um
   D  Gleichstand, Korrektur (341 → 75 min), Loeschung, Reimport, manuelle Einheiten
   E  Herkunft unvollstaendig, nicht freigegebene Kennzahlen, Sportkontext (Laufband/Rolle/Becken)
   F  Zeitzonen, mehrere Nutzer, Idempotenz, Determinismus, Doppelte, gekoppelte Aufzeichnungen
   G  Meilensteine aus echten Werten; Untergrenze bei gesperrten Distanzen
   H  Zwischenspeicher, Zeilen fuer die Datenbank, Skalierung (5000 Aktivitaeten)
   I  Vorbereitet: nicht ausgeliefert, Flag fail-closed
   node supabase/tests/performance_ledger_v448_test.mjs
   ============================================================ */
import fs from 'fs';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js'])
  require(new URL(_APPREL + f, import.meta.url).pathname);
const GEN = await import(new URL(_APPREL + 'tools/gen-eligibility-doc.mjs', import.meta.url));
require(new URL(_APPREL + 'js/engine/performance-ledger.js', import.meta.url).pathname);
const O = globalThis.ORVIA, L = O.performanceLedger, ME = O.metricEligibility;
const TZ = { timeZone: 'Europe/Berlin' };
const clone = o => JSON.parse(JSON.stringify(o));

/* Garmin-Lauf auf dem bestmoeglichen Beleg (wie im Freigabe-Dokument), mit eigener Zeit/Distanz */
function run(id, date, o = {}) {
  const a = GEN.referenceActivity('running', 'best');
  a.id = id; a.startedAt = (o.gmt || date + 'T06:00:00') + '.000Z';
  a.metrics.garmin.start_gmt = (o.gmt || date + 'T06:00:00') + 'Z';
  a.metrics.garmin.start_local = o.local || date + 'T08:00:00';
  if (o.type !== undefined) { if (o.type) a.metrics.garmin.type_key = o.type; else delete a.metrics.garmin.type_key; }
  const dist = o.dist ?? 10000, dur = o.dur ?? 3600;
  a.summary.distanceM = dist; a.metrics.streams.distance = [0, dist * 0.2, dist * 0.4, dist * 0.6, dist * 0.8, dist];
  a.durationSeconds = dur; a.metrics.garmin.timer_duration_s = dur;
  const t = a.metrics.best_efforts.distance.targets;
  for (const k of Object.keys(t)) if (+k > dist) delete t[k];
  if (o.s5k != null) t['5000'] = { s: o.s5k, over_m: 2, at: 0, q: 'measured' };
  if (o.importedAt) a.createdAt = o.importedAt;
  return a;
}
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const K5 = 'running.fastest_5000m@standard';
const upd = (st, list, o) => L.update(st, list, Object.assign({}, TZ, o || {}));

sec('A · Definitionen');
{
  const sports = O.trainingDomain.ACTIVITY_SPORTS.filter(s => s !== 'other');
  ok('A1 jede Katalog-Sportart (ausser other) hat mindestens einen Rekord', sports.every(s => L.defsFor(s).length > 0), sports.filter(s => !L.defsFor(s).length).join(','));
  ok('A2 other hat keinen Rekord (unvergleichbar)', L.defsFor('other').length === 0);
  ok('A3 Laufbestzeiten 400 m … Marathon = fastest_time / lower', ['400', '1000', '5000', '10000', '21098', '42195'].every(t => { const d = L.defById('running.fastest_' + t + 'm'); return d && d.kind === 'fastest_time' && d.better === 'lower' && d.metric === 'distanceBest'; }));
  ok('A4 Laengster Lauf / Fahrt / Schwimmeinheit = longest_distance / higher', ['running', 'cycling', 'swimming'].every(s => L.defById(s + '.longest_distance').better === 'higher'));
  ok('A5 Kraft: Volumen (greatest_volume) und laengstes Training', L.defById('gym.greatest_volume').kind === 'greatest_volume' && L.defById('gym.longest_duration'));
  ok('A6 jede Definition zeigt auf eine Kennzahl der Eligibility', L.DEFS.every(d => ME.METRICS.includes(d.metric)));
  ok('A7 alle sechs Arten abgedeckt', ['fastest_time', 'longest_distance', 'longest_duration', 'greatest_volume', 'highest', 'lowest'].every(k => k in L.KIND_BETTER) && L.KIND_BETTER.lowest === 'lower');
  ok('A8 kein Gehen-/Wandern-„Bestzeit"-Rekord', !L.DEFS.some(d => /^(walking|hiking)\.fastest/.test(d.id)));
}

sec('B · Rekordhistorie');
const B_RUNS = [run('r1', '2026-08-02', { s5k: 25 * 60 + 10 }), run('r2', '2026-08-16', { s5k: 24 * 60 + 42 }), run('r3', '2026-08-30', { s5k: 24 * 60 + 50 }),
                run('r4', '2026-09-13', { s5k: 24 * 60 + 5 }), run('r5', '2026-09-27', { s5k: 23 * 60 + 39 })];
{
  const { state } = upd(null, B_RUNS);
  const h = state.events[K5];
  ok('B1 Ereignisse: erster Wert + 3 Verbesserungen (24:50 ist keine)', h.map(e => e.type).join(',') === 'first,improved,improved,improved', h.map(e => e.type + ' ' + mmss(e.value)).join(' · '));
  ok('B2 Werte 25:10 → 24:42 → 24:05 → 23:39', h.map(e => mmss(e.value)).join(' ') === '25:10 24:42 24:05 23:39');
  const last = h[3];
  ok('B3 Vorher 24:05, Nachher 23:39, Verbesserung 26 s, Datum = Aktivitaetsdatum', last.previousValue === 24 * 60 + 5 && last.value === 23 * 60 + 39 && last.improvement === 26 && last.localDate === '2026-09-27' && last.previousLocalDate === '2026-09-13', J(last));
  ok('B4 Abstand in Tagen und Prozent', last.daysSincePrevious === 14 && last.improvementPct === 1.8, last.improvementPct);
  const rm = L.readModel(state);
  const rec = rm.sports.find(s => s.sport === 'running').records.find(r => r.metricKey === K5);
  ok('B5 Lesemodell: Bestwert, Vorgaenger, Verbesserung, Historie', rec.best.value === 1419 && rec.previous.value === 1445 && rec.improvement === 26 && rec.history.length === 4);
  ok('B6 Geltungsbereich „ORVIA-Bestwert seit …" (kein Allzeitrekord)', rec.scope === 'orvia' && rec.coverageFrom === '2026-08-02');
  ok('B7 Eintrag traegt Athlet-unabhaengige Pflichtfelder', (() => { const e = state.activities.r5.entries.find(x => x.metricKey === K5);
    return ['activityId', 'sport', 'metricKey', 'value', 'unit', 'recordedAt', 'source', 'provenance', 'eligibility', 'validation', 'calcVersion'].every(k => e[k] !== undefined) && e.unit === 's' && e.validation === 'validated'; })());
}

sec('C · Reihenfolge und Nachimport');
{
  const late = B_RUNS.map(r => Object.assign(clone(r), { createdAt: '2026-10-15T00:00:00Z' }));
  late[0].createdAt = '2026-10-16T00:00:00Z';                 // die AELTESTE Einheit kommt als letzte ins System
  const a = upd(null, late.slice(1)).state, b = upd(a, late).changes;
  const full = upd(null, B_RUNS).state;
  const h2 = upd(a, late).state.events[K5];
  ok('C1 Nachimport der aeltesten Einheit: Historie = vollstaendige Neuberechnung', J(h2) === J(full.events[K5]));
  ok('C2 Importzeitpunkt spielt keine Rolle', h2[0].activityId === 'r1' && h2[0].localDate === '2026-08-02');
  ok('C3 Protokoll benennt das Umschreiben der Historie', b.log.some(l => l.metricKey === K5 && l.reason === 'history_rewritten'), J(b.log.map(l => l.reason)));
  const fast = run('r0', '2026-07-20', { s5k: 23 * 60 });
  const c = upd(full, B_RUNS.concat([fast]));
  const hc = c.state.events[K5];
  ok('C4 aelterer, schnellerer Lauf nachimportiert → spaetere sind keine Rekorde mehr', hc.length === 1 && hc[0].activityId === 'r0' && hc[0].value === 1380, hc.map(e => e.activityId).join(','));
  ok('C5 … und das Protokoll zeigt Vorher/Nachher', c.changes.log.some(l => l.metricKey === K5 && l.beforeBest === 1419 && l.afterBest === 1380 && l.reason === 'history_rewritten'));
  const sameDay = [run('m', '2026-08-02', { s5k: 1500, local: '2026-08-02T18:00:00', gmt: '2026-08-02T16:00:00' }), run('n', '2026-08-02', { s5k: 1500, local: '2026-08-02T07:00:00', gmt: '2026-08-02T05:00:00' })];
  const hs = upd(null, sameDay).state.events[K5];
  ok('C6 am selben Tag entscheidet die Uhrzeit, nicht die Liste', hs[0].activityId === 'n' && hs[1].type === 'equalled', J(hs.map(e => [e.activityId, e.type])));
}

sec('D · Gleichstand, Korrektur, Loeschung, Reimport, manuell');
{
  const eq = upd(null, [run('e1', '2026-08-01', { s5k: 1450 }), run('e2', '2026-08-08', { s5k: 1450 })]).state.events[K5];
  ok('D1 Gleichstand: frueherer bleibt Halter, spaeterer = equalled', eq.length === 2 && eq[1].type === 'equalled' && eq[1].improvement === 0 && L.currentBest(eq).activityId === 'e1');
  const eqTenth = upd(null, [run('e3', '2026-08-01', { s5k: 1450.04 }), run('e4', '2026-08-08', { s5k: 1450.01 })]).state.events[K5];
  ok('D2 Gleichstand auf Genauigkeitsstufe (0,1 s), kein Schein-Rekord durch Rundungsrauschen', eqTenth[1].type === 'equalled');

  const gymGarmin = { id: 'g-garmin', sportId: 'gym', source: 'garmin', status: 'completed', startedAt: '2026-09-20T16:00:00.000Z', durationSeconds: 20460,
    summary: {}, metrics: { detailsVersion: 3, garmin: { type_key: 'strength_training', timer_duration_s: 20460, start_local: '2026-09-20T18:00:00', start_gmt: '2026-09-20T16:00:00Z', utc_offset_s: 7200 } } };
  const workout = (id, date, min, corrMin) => ({ id, sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: date + 'T16:00:00.000Z',
    durationSeconds: (corrMin ?? min) * 60, summary: { totalVolumeKg: 8000 },
    metrics: corrMin != null ? { corrections: { duration: { manual: corrMin * 60, source: min * 60, unit: 's', at: '2026-10-11T08:00:00.000Z', method: 'manual' } } } : {} });
  const w341 = workout('w-341', '2026-09-21', 341, 75), w90 = workout('w-90', '2026-09-28', 90);
  const st = upd(null, [gymGarmin, w341, w90]).state;
  const hd = st.events['gym.longest_duration@all'];
  ok('D3 korrigierte Einheit zaehlt mit 75 min (wirksam), nie mit 341', hd[0].activityId === 'w-341' && hd[0].value === 4500 && hd[0].manual === true, J(hd));
  ok('D4 Rekord „laengstes Krafttraining" = 90 min, nicht 341', L.currentBest(hd).activityId === 'w-90' && L.currentBest(hd).value === 5400);
  ok('D5 Garmin-Kraft-Dauer ohne Beleg: gesperrt (kein 341-min-Rekord)', st.activities['g-garmin'].entries.find(e => e.defId === 'gym.longest_duration').eligibility === 'blocked');
  ok('D6 korrigierter Eintrag ist als manuell markiert', st.activities['w-341'].entries.find(e => e.defId === 'gym.longest_duration').validation === 'manual_override');
  const corrLater = workout('w-90', '2026-09-28', 90, 60);                              // Nutzer korrigiert 90 → 60 min
  const c2 = upd(st, [gymGarmin, w341, corrLater]);
  ok('D7 spaetere Korrektur: betroffener Rekord wird neu berechnet (75 min ist wieder Bestwert)', L.currentBest(c2.state.events['gym.longest_duration@all']).activityId === 'w-341' && c2.changes.updated.includes('w-90') && c2.changes.log.some(l => l.reason === 'activity_changed'));

  const s1 = upd(null, B_RUNS).state;
  const del = upd(s1, B_RUNS.filter(r => r.id !== 'r5'));
  ok('D8 Loeschung: Rekord faellt auf den vorherigen Bestwert (24:05) zurueck', L.currentBest(del.state.events[K5]).value === 1445 && del.changes.removed.join() === 'r5');
  ok('D9 … mit Protokoll activity_removed, keine Einträge der geloeschten Aktivitaet', del.changes.log.some(l => l.reason === 'activity_removed' && l.beforeBest === 1419 && l.afterBest === 1445) && !del.state.activities.r5);
  const part = upd(s1, B_RUNS.slice(3), { partial: true });
  ok('D8b unvollstaendige Eingabe (nur juengste Aktivitaeten geladen): nichts wird als geloescht behandelt', part.changes.removed.length === 0 && Object.keys(part.state.activities).length === 5 && J(part.state.events) === J(s1.events));
  const partDel = upd(s1, B_RUNS.slice(3, 4), { partial: true, deletedIds: ['r5'] });
  ok('D8c unvollstaendige Eingabe + ausdrueckliche Loeschung: nur die geloeschte faellt weg', partDel.changes.removed.join() === 'r5' && Object.keys(partDel.state.activities).length === 4);
  const tomb = upd(s1, B_RUNS, { isDeleted: a => a.id === 'r4' });
  ok('D10 Tombstone (lokal geloescht) zaehlt wie geloescht', !tomb.state.activities.r4 && tomb.changes.removed.includes('r4'));
  const reimp = B_RUNS.map(clone); reimp[4].metrics.best_efforts.distance.targets['5000'].s = 23 * 60 + 30;   // Garmin liefert neu (feinere Aufloesung)
  const ri = upd(s1, reimp);
  ok('D11 Garmin-Reimport (gleiche Aktivitaet, neue Werte): aktualisiert, keine Dublette', ri.changes.updated.join() === 'r5' && L.currentBest(ri.state.events[K5]).value === 1410 && Object.keys(ri.state.activities).length === 5);
  const reNew = B_RUNS.slice(0, 4).concat([Object.assign(clone(B_RUNS[4]), { id: 'r5-neu' })]);
  const rn = upd(s1, reNew);
  ok('D12 Reimport mit neuer Kennung nach Loeschung: alter Eintrag weg, neuer da, ein Halter', !rn.state.activities.r5 && rn.state.activities['r5-neu'] && L.currentBest(rn.state.events[K5]).activityId === 'r5-neu');
  const manual = { id: 'man-1', sportId: 'running', source: 'manual', status: 'completed', startedAt: '2026-09-01T07:30', durationSeconds: 5400, summary: { distanceKm: 18 }, metrics: {} };
  const ms = upd(null, [manual]).state;
  ok('D13 manueller Lauf: Distanz/Dauer frei (eigene Daten)', ms.events['running.longest_distance@standard'][0].value === 18000 && ms.activities['man-1'].entries.find(e => e.defId === 'running.longest_distance').validation === 'own_data');
  ok('D14 manueller Lauf: keine Bestzeit (keine Aufzeichnung)', ms.activities['man-1'].entries.find(e => e.defId === 'running.fastest_5000m').reason === 'unsupported_source');
}

sec('E · Herkunft, Freigabe, Kontext');
{
  const noType = run('nt', '2026-09-02', { s5k: 1500, type: null });
  const st = upd(null, [noType]).state;
  ok('E1 Lauf ohne Garmin-Typ: 5-km-Bestzeit zaehlt, Klasse standard', st.events[K5] && st.events[K5][0].value === 1500);
  const ride = GEN.referenceActivity('cycling', 'best'); ride.id = 'c1'; ride.startedAt = '2026-09-03T06:00:00.000Z';
  const rs = upd(null, [ride]).state;
  const pw = rs.activities.c1.entries.find(e => e.defId === 'cycling.best_power_1200s');
  ok('E2 Leistungs-Bestwert Rad: gesperrt (unverified_semantics), kein Ereignis', pw.eligibility === 'blocked' && pw.reason === 'unverified_semantics' && !rs.events['cycling.best_power_1200s@standard']);
  ok('E3 gesperrter Eintrag traegt keinen Wert', pw.value === null);
  const wt = L.readModel(rs).waiting;
  ok('E4 Lesemodell zeigt, was auf einen Beleg wartet', wt.some(w => w.defId === 'cycling.best_power_1200s' && w.reason === 'unverified_semantics'));
  const tm = run('tm', '2026-09-04', { s5k: 1200, type: 'treadmill_running', dist: 12000 });
  const ts = upd(null, [tm, run('out', '2026-09-05', { s5k: 1500, dist: 8000 })]).state;
  ok('E5 Laufband: keine 5-km-Bestzeit (Strecke geschaetzt)', ts.activities.tm.entries.find(e => e.defId === 'running.fastest_5000m').reason === 'unsupported_source' && ts.events[K5][0].activityId === 'out');
  ok('E6 Laufband-Distanz in eigener Klasse — nie gegen draussen verglichen', ts.events['running.longest_distance@indoor'][0].value === 12000 && ts.events['running.longest_distance@standard'][0].value === 8000);
  const v = clone(GEN.referenceActivity('cycling', 'best')); v.id = 'zw'; v.metrics.garmin.type_key = 'virtual_ride'; v.startedAt = '2026-09-06T06:00:00.000Z';
  const r2 = clone(GEN.referenceActivity('cycling', 'best')); r2.id = 'road'; r2.metrics.garmin.type_key = 'road_biking'; r2.startedAt = '2026-09-07T06:00:00.000Z';
  const vs = upd(null, [v, r2]).state;
  const keys = Object.keys(vs.activities.zw.entries.reduce((m, e) => (m[e.metricKey] = 1, m), {}));
  ok('E7 Rolle (virtual) und Strasse: getrennte Kennzahlen', vs.activities.zw.entries.every(e => e.contextClass === 'virtual') && vs.activities.road.entries.every(e => e.contextClass === 'standard'), keys.join(','));
  const pool = GEN.referenceActivity('swimming', 'best'); pool.id = 'pool'; pool.startedAt = '2026-09-08T06:00:00.000Z';
  const ow = clone(pool); ow.id = 'ow'; ow.metrics.garmin.type_key = 'open_water_swimming';
  const ps = upd(null, [pool, ow]).state;
  ok('E8 Becken und Freiwasser: getrennte Klassen', ps.activities.pool.entries[0].contextClass === 'pool' && ps.activities.ow.entries[0].contextClass === 'open_water');
  const mswim = { id: 'ms', sportId: 'swimming', source: 'manual', status: 'completed', startedAt: '2026-09-09T07:00', durationSeconds: 3000, summary: { distanceM: 2500, environment: 'open_water' }, metrics: {} };
  const mss = upd(null, [mswim]).state;
  ok('E9 manuelle Angabe Freiwasser ist Kontextbeleg (eigene Daten)', mss.activities.ms.entries[0].contextClass === 'open_water' && mss.events['swimming.longest_distance@open_water'][0].value === 2500);
  const missing = run('mi', '2026-09-10', { dist: 4000 });                         // keine 5-km-Messung vorhanden
  ok('E10 fehlender Wert wird nicht ersetzt (missing_data, kein Schaetzwert)', upd(null, [missing]).state.activities.mi.entries.find(e => e.defId === 'running.fastest_5000m').reason === 'missing_data');
  const ab = Object.assign(clone(B_RUNS[0]), { id: 'ab', status: 'aborted' });
  ok('E11 abgebrochene Einheit zaehlt nicht', upd(null, [ab]).state.activities.ab.entries.every(e => e.eligibility === 'blocked' && e.reasons.includes('not_completed')));
  const evDist = ME.evaluate(B_RUNS[4], 'distanceBest', { targetM: 5000 });
  ok('E12 Wert kommt aus der Eligibility (value/unit), dieselbe Grundlage wie das Urteil', evDist.value === 1419 && evDist.unit === 's' && /distance\.targets\.5000/.test(evDist.provenance.basis));
}

sec('F · Zeitzonen, Nutzer, Idempotenz, Determinismus, Doppelte');
{
  const late = { id: 'tz', sportId: 'running', source: 'orvia_workout', status: 'completed', startedAt: '2026-10-31T23:30:00.000Z', durationSeconds: 3600, summary: { distanceKm: 10 }, metrics: {} };
  const e = L.entriesFor(late, TZ)[0];
  ok('F1 UTC 31.10. 23:30 → Ortszeit Berlin 01.11. 00:30 (Winterzeit, keine feste Verschiebung)', e.localDate === '2026-11-01' && e.localTime === '00:30' && e.timeBasis === 'timezone', e.localDate + ' ' + e.localTime);
  const summer = L.entriesFor(Object.assign({}, late, { startedAt: '2026-07-31T22:30:00.000Z' }), TZ)[0];
  ok('F2 Sommerzeit: 31.07. 22:30 UTC → 01.08. 00:30', summer.localDate === '2026-08-01' && summer.localTime === '00:30');
  const garminLocal = run('gl', '2026-09-01', { local: '2026-09-01T23:50:00', gmt: '2026-09-01T21:50:00' });
  ok('F3 Garmin-Ortszeit der Einheit gilt (auch auf Reisen)', L.entriesFor(garminLocal, { timeZone: 'America/New_York' })[0].localDate === '2026-09-01');
  const A = upd(null, B_RUNS.slice(0, 2)).state, Bst = upd(null, [run('x1', '2026-08-03', { s5k: 1300 })]).state;
  ok('F4 zwei Nutzer: getrennte Zustaende beeinflussen sich nicht', L.currentBest(A.events[K5]).value === 24 * 60 + 42 && L.currentBest(Bst.events[K5]).value === 1300);
  const s1 = upd(null, B_RUNS).state;
  let calls = 0; const orig = ME.evaluate; ME.evaluate = function () { calls++; return orig.apply(this, arguments); };
  const again = upd(s1, B_RUNS.map(clone));
  ME.evaluate = orig;
  ok('F5 idempotent: zweiter Lauf mit gleicher Eingabe prueft nichts neu und aendert nichts', calls === 0 && again.changes.affectedKeys.length === 0 && again.changes.log.length === 0 && J(again.state.events) === J(s1.events), 'evaluate-Aufrufe: ' + calls);
  const shuffled = [B_RUNS[3], B_RUNS[0], B_RUNS[4], B_RUNS[2], B_RUNS[1]];
  ok('F6 deterministisch: Eingabereihenfolge egal', J(upd(null, shuffled).state.events) === J(s1.events));
  const dup = upd(null, B_RUNS.concat([clone(B_RUNS[2])])).state;
  ok('F7 gleiche Aktivitaet doppelt in der Eingabe: einmal gezaehlt', Object.keys(dup.activities).length === 5);
  const wk = { id: 'wk', sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: '2026-09-21T16:00:00.000Z', durationSeconds: 4500, summary: { totalVolumeKg: 9000 }, metrics: {} };
  const recG = { id: 'rec', sportId: 'gym', source: 'garmin', status: 'completed', startedAt: '2026-09-21T16:01:00.000Z', durationSeconds: 4600, linkedActivityId: 'wk', summary: {}, metrics: { detailsVersion: 3 } };
  const lk = upd(null, [wk, recG]).state;
  ok('F8 gekoppelte Uhr-Aufzeichnung ist keine eigene Einheit', !lk.activities.rec && lk.activities.wk);
  ok('F9 Eingabe wird nicht veraendert (rein)', !('recording' in wk) && !('recording' in recG));
  const before = J(B_RUNS);
  upd(null, B_RUNS);
  ok('F10 Aktivitaeten bleiben unveraendert', J(B_RUNS) === before);
}

sec('G · Meilensteine');
{
  const runs = [run('a', '2026-09-01', { dist: 4000 }), run('b', '2026-09-03', { dist: 5200 }), run('c', '2026-09-10', { dist: 10100 }),
                run('d', '2026-09-15', { dist: 30000 }), run('e', '2026-09-20', { dist: 30000 }), run('f', '2026-09-28', { dist: 30000 })];
  const st = upd(null, runs).state;
  const ms = st.milestones;
  const get = id => ms.find(m => m.milestoneId === id);
  ok('G1 erste 5 km = Lauf vom 03.09. (nicht der 4-km-Lauf)', get('running.first_5k').activityId === 'b' && get('running.first_5k').localDate === '2026-09-03');
  ok('G2 erste 10 km = 10.09.; erster Halbmarathon = 15.09.', get('running.first_10k').activityId === 'c' && get('running.first_half').activityId === 'd');
  const m100 = get('running.month_100km');
  ok('G3 100 km im September: erreicht mit dem Lauf, der die Schwelle ueberschreitet (28.09., 109,3 km)', m100 && m100.activityId === 'f' && m100.value === 109300 && m100.detail.month === '2026-09' && m100.detail.lowerBound === false, J(m100));
  ok('G4 Distanzrekorde als Meilensteine (jede Verbesserung)', ms.filter(m => m.milestoneId === 'distance_record').length === 3);
  const blocked = runs.map(clone); blocked[0].status = 'aborted';                   // 4 km gesperrt: Summe 105,3 km
  const m2 = upd(null, blocked).state.milestones.find(m => m.milestoneId === 'running.month_100km');
  ok('G5 gesperrte Distanz zaehlt nicht mit — Summe als Untergrenze markiert', m2 && m2.detail.lowerBound === true && m2.detail.blockedActivities === 1);
  const del = upd(st, runs.filter(r => r.id !== 'b' && r.id !== 'c')).state.milestones;
  ok('G6 Loeschung: Meilenstein wandert zur naechsten belegten Einheit', del.find(m => m.milestoneId === 'running.first_5k').activityId === 'd');
  ok('G7 kein Meilenstein ohne Aktivitaet und Datum', ms.every(m => m.activityId && m.localDate));
  ok('G8 keine Meilensteine aus leeren Daten', upd(null, []).state.milestones.length === 0 && L.readModel(upd(null, []).state).empty === true);
}

sec('H · Zwischenspeicher, Zeilen, Skalierung');
{
  const st = upd(null, B_RUNS).state;
  const back = L.deserialize(L.serialize(st));
  ok('H1 Zwischenspeicher: Ereignisse werden identisch wiederhergestellt', back && J(back.events) === J(st.events) && J(back.milestones) === J(st.milestones));
  ok('H2 fremde Rechenversion im Speicher → verworfen (Neuberechnung)', L.deserialize(L.serialize(st).replace('"' + L.CALC_VERSION + '"', '"ledger@0"')) === null);
  const rows = L.rows(st);
  ok('H3 Zeilen: Eintraege, Ereignisse, Meilensteine mit Spalten der Migration 0051', rows.entries.length === 5 * L.defsFor('running').length && rows.events.length >= 4
     && ['activity_id', 'metric_key', 'value', 'unit', 'eligibility_status', 'validation_status', 'calc_version', 'input_fingerprint', 'order_key'].every(k => k in rows.entries[0]));
  ok('H4 gesperrte Zeile ohne Wert, freigegebene mit Wert', rows.entries.every(r => (r.eligibility_status === 'eligible') === (r.value !== null)));
  const many = [];
  for (let i = 0; i < 5000; i++) {
    const d = new Date(Date.UTC(2015, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    many.push(run('p' + i, d, { s5k: 1300 + ((i * 7919) % 400), dist: 5000 + ((i * 104729) % 15000) }));
  }
  let t0 = Date.now(); const big = upd(null, many); const tFull = Date.now() - t0;
  t0 = Date.now(); const again = upd(big.state, many); const tNoop = Date.now() - t0;
  const one = many.slice(); one[2500] = Object.assign(clone(many[2500]), { durationSeconds: 3500 }); one[2500].metrics.garmin.timer_duration_s = 3500;
  t0 = Date.now(); const inc = upd(big.state, one); const tOne = Date.now() - t0;
  ok('H5 5000 Aktivitaeten: Erstberechnung < 20 s', tFull < 20000, tFull + ' ms');
  ok('H6 unveraendert: kein Eintrag neu geprueft, schnell', again.changes.affectedKeys.length === 0 && tNoop < tFull / 3, tNoop + ' ms');
  ok('H7 eine Aktivitaet geaendert: nur deren Kennzahlen neu', inc.changes.updated.join() === 'p2500' && inc.changes.affectedKeys.every(k => k.startsWith('running.')) && tOne < tFull, tOne + ' ms, Kennzahlen ' + inc.changes.affectedKeys.length);
  const ser = L.serialize(big.state).length;
  ok('H8 Zwischenspeicher fuer 5000 Aktivitaeten', ser > 0, Math.round(ser / 1024) + ' kB');
}

sec('I · Vorbereitet, nicht ausgeliefert');
{
  const html = rd('index.html'), sw = rd('sw.js');
  ok('I1 v8-448B: ausgeliefert (index.html + Offline-Speicher), wirksam nur mit Flag', /performance-ledger\.js/.test(html) && /performance-ledger\.js/.test(sw));
  ok('I2 Build >= v8-448 (Register ausgeliefert)', +((sw.match(/const C = 'orvia-v8-(\d+)'/) || [])[1]) >= 448);
  const src = rd('js/engine/performance-ledger.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('I3 rein: kein DOM, kein Speicher, kein Netz, keine Uhr', !/document\.|localStorage|fetch\(|XMLHttpRequest|Date\.now\(|new Date\(\)/.test(src));
  const DOC = await import(new URL(_APPREL + 'tools/gen-ledger-doc.mjs', import.meta.url));
  ok('I5 PERFORMANCE-LEDGER.md = Ausgabe des Generators (Definitionen und Freigaben aus dem Code)', rd('docs/PERFORMANCE-LEDGER.md') === DOC.render());
  ok('I4 keine eigene Eligibility-Logik: kein needEvidence/EVIDENCE-Zugriff ausser Signatur', !/needEvidence|TRUSTED\[/.test(src));
}

console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_v448: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
