/* ============================================================
   ORVIA · S2c — Geraeteaufzeichnung an ORVIA-Workout koppeln (Vertragstest).

   BEFUND, den dieser Test festhaelt: Eine Krafteinheit mit laufender Uhr lag
   zweimal in activities (orvia_workout mit Saetzen + garmin mit HF). Beide
   galten als eigenstaendige Einheiten -> Wochenlast/ACWR und Einheitenzaehler
   zaehlten sie doppelt (belegt am 23.06./25.06. 2026).

   Vertrag nach dem Fix:
   1) Die gekoppelte Aufzeichnung ist KEINE eigene Einheit mehr (Liste, Store).
   2) Sie verschwindet nie stillschweigend: fehlt der Primaerdatensatz, bleibt
      sie sichtbar.
   3) Die Last zaehlt die Einheit genau einmal, mit der Uhr-Dauer; eine manuelle
      Dauerkorrektur schlaegt die Uhr.
   4) Fehlt Migration 0048 (keine Spalten), verhaelt sich alles wie zuvor.

   node supabase/tests/activity_link_test.mjs
   ============================================================ */
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const mem = {};
globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.ORVIA.activityNormalize = (await import(new URL(_APPREL + 'js/activity-normalize.js', import.meta.url))).default;
const _SPORTS = ['gym', 'running', 'cycling', 'swimming', 'other'];
const _strict = v => { const s = String(v == null ? '' : v).trim().toLowerCase(); return _SPORTS.indexOf(s) >= 0 ? s : null; };
globalThis.ORVIA.trainingDomain = { normSportStrict: _strict, normSport: v => _strict(v) || 'other' };
globalThis.ORVIA.onboardingSportsLogic = (await import(new URL(_APPREL + 'js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;
const C = (await import(new URL(_APPREL + 'js/activity-config.js', import.meta.url))).default;
const S = (await import(new URL(_APPREL + 'js/activity-store.js', import.meta.url))).default;
const LH = (await import(new URL(_APPREL + 'js/engine/load-history.js', import.meta.url))).default;
const AN = globalThis.ORVIA.activityNormalize;
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; };

/* Realer Fall 23.06.2026: ORVIA-Workout 14:03 (103 min, 7 Uebungen) + Garmin 14:02 (104 min, 93 bpm). */
const W = () => ({ id: 'srv-w1', clientRecordId: 'a:w1', sportId: 'gym', source: 'orvia_workout', sourceRecordId: 'sess1', workoutSessionId: 'sess1',
  startedAt: '2026-06-23T14:03:00.000Z', endedAt: '2026-06-23T15:46:00.000Z', durationSeconds: 6180, status: 'completed',
  summary: { exerciseCount: 7, workingSetCount: 14, totalVolumeKg: 3716 }, metrics: {}, linkedActivityId: null, linkKind: null });
const G = () => ({ id: 'srv-g1', clientRecordId: 'a:g1', sportId: 'gym', source: 'garmin', sourceRecordId: 'garmin-1', workoutSessionId: null,
  startedAt: '2026-06-23T14:02:00.000Z', endedAt: '2026-06-23T15:46:00.000Z', durationSeconds: 6240, status: 'completed',
  summary: { avgHr: 93, maxHr: 131, caloriesKcal: 640 }, metrics: {}, linkedActivityId: 'srv-w1', linkKind: 'device_recording' });

/* ===== 1 · attachRecordings (pur) ===== */
let out = C.attachRecordings([W(), G()]);
ok('A1 gekoppelte Aufzeichnung ist keine eigene Zeile mehr', out.length === 1 && out[0].id === 'srv-w1');
ok('A2 Aufzeichnung haengt am Primaerdatensatz (recording)', !!(out[0].recording && out[0].recording.id === 'srv-g1'));
ok('A3 Aufzeichnung traegt die Uhr-Werte', out[0].recording.summary.avgHr === 93 && out[0].recording.durationSeconds === 6240);
ok('A4 Primaerdatensatz unveraendert (Saetze bleiben seine Wahrheit)', out[0].summary.workingSetCount === 14);

out = C.attachRecordings([G()]);
ok('A5 ohne Primaerdatensatz bleibt die Aufzeichnung SICHTBAR (nichts verschwindet still)', out.length === 1 && out[0].id === 'srv-g1');

out = C.attachRecordings([Object.assign(W(), { linkedActivityId: 'srv-w1' })]);
ok('A6 Selbstverweis koppelt nicht (keine leere Liste)', out.length === 1 && !out[0].recording);

out = C.attachRecordings([W(), G(), Object.assign(G(), { id: 'srv-g2', clientRecordId: 'a:g2' })]);
ok('A7 zweite Aufzeichnung auf denselben Primaer wird nicht verschluckt', out.length === 2 && out.some(a => a.id === 'srv-g2'));

const nolink = [Object.assign(W(), { linkedActivityId: null, linkKind: null }), Object.assign(G(), { linkedActivityId: null, linkKind: null })];
ok('A8 ohne Migration 0048 (keine Kopplung) bleiben beide Einheiten stehen', C.attachRecordings(nolink).length === 2);

/* ===== 2 · mergeAllActivities (Serverpfad) ===== */
const merged = C.mergeAllActivities([W(), G()], [], []);
ok('B1 Merge liefert eine Einheit', merged.length === 1 && merged[0].id === 'srv-w1');
ok('B2 Merge haengt die Aufzeichnung an', !!(merged[0].recording && merged[0].recording.source === 'garmin'));

/* ===== 3 · Normalisierung (beide Serverpfade tragen die Kopplung) ===== */
const srvRow = { id: 'srv-g1', user_id: 'u1', sport_id: 'gym', source: 'garmin', source_record_id: 'garmin-1',
  started_at: '2026-06-23T14:02:00.000Z', duration_seconds: 6240, status: 'completed', summary: { avgHr: 93 }, metrics: {},
  linked_activity_id: 'srv-w1', link_kind: 'device_recording' };
const nsa = C.normalizeServerActivity(srvRow);
ok('C1 normalizeServerActivity uebernimmt linked_activity_id/link_kind', nsa.linkedActivityId === 'srv-w1' && nsa.linkKind === 'device_recording');
const nar = AN.normalizeActivityRecord(srvRow);
ok('C2 normalizeActivityRecord uebernimmt die Kopplung', nar.linkedActivityId === 'srv-w1' && nar.linkKind === 'device_recording');
const bare = AN.normalizeActivityRecord({ id: 'x', sport_id: 'gym', source: 'garmin' });
ok('C3 fehlende Spalten (0048 nicht angewendet) ⇒ null, kein Fehler', bare.linkedActivityId === null && bare.linkKind === null);

/* ===== 4 · Store: eine Einheit fuer alle Konsumenten ===== */
reset();
S.mergeServerActivities([
  { id: 'srv-w1', client_record_id: 'a:w1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess1', workout_session_id: 'sess1',
    started_at: '2026-06-23T14:03:00.000Z', ended_at: '2026-06-23T15:46:00.000Z', duration_seconds: 6180, status: 'completed',
    summary: { exerciseCount: 7, workingSetCount: 14 }, metrics: {} },
  srvRow
]);
let list = S.listActivities();
ok('D1 listActivities zeigt EINE Einheit (Last/Zaehler sehen keine Dublette)', list.length === 1 && list[0].id === 'srv-w1');
ok('D2 die Uhr-Aufzeichnung haengt daran', !!(list[0].recording && list[0].recording.id === 'srv-g1'));
ok('D3 includeLinked liefert die Rohliste (Diagnose)', S.listActivities({ includeLinked: true }).length === 2);
const recOf = S.recordingFor({ id: 'srv-w1' });
ok('D4 recordingFor findet die Aufzeichnung (Detailseite)', !!(recOf && recOf.id === 'srv-g1'));
ok('D5 setActivityLink loest lokal', S.setActivityLink('srv-g1', null).ok && S.listActivities().length === 2);
ok('D6 setActivityLink koppelt wieder', S.setActivityLink('srv-g1', 'srv-w1').ok && S.listActivities().length === 1);

/* ===== 5 · Last: genau einmal, mit der verlaesslicheren Dauer ===== */
const today = '2026-06-25';
const one = C.attachRecordings([W(), G()]);
let h = LH.buildHistory({ today, activities: one, days: 28 });
const day = h.byDay['2026-06-23'];
ok('E1 Tag 23.06. hat genau EINE Einheit', !!day && day.sessions.length === 1, 'sessions=' + (day ? day.sessions.length : 'n/a'));
const uhr = LH.loadOf(one[0]);
const nurWorkout = LH.loadOf(Object.assign({}, W()));
ok('E2 Uhr-Dauer gewinnt vor der Workout-Dauer (104 statt 103 min)', uhr.systemic > nurWorkout.systemic,
  'uhr=' + uhr.systemic + ' workout=' + nurWorkout.systemic);
const korrigiert = C.attachRecordings([Object.assign(W(), { durationSeconds: 5400, metrics: { durationCorrection: { fromMin: 103, toMin: 90, method: 'manual_correction' } } }), G()]);
const lk = LH.loadOf(korrigiert[0]);
ok('E3 manuelle Dauerkorrektur schlaegt die Uhr', lk.systemic < uhr.systemic && lk.systemic < nurWorkout.systemic,
  'korrigiert=' + lk.systemic);
/* Gegenprobe: ohne Kopplung zaehlt die Uhr als eigene Einheit — der alte, falsche Zustand. */
h = LH.buildHistory({ today, activities: [W(), G()], days: 28 });
const day2 = h.byDay['2026-06-23'];
ok('E4 Gegenprobe: ungekoppelt waeren es zwei Einheiten (der behobene Fehler)', !!day2 && day2.sessions.length === 2);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
