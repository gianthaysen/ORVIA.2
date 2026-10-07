/* ============================================================
   ORVIA · effective_metric (v8-445) — Quelle / manuell / wirksam
   ------------------------------------------------------------
   Gians Befund 6.10.: Krafttraining mit 341 min, korrigiert auf 1 h 15 min. Die Seite der
   Einheit zeigt 1 h 15, die Liste und andere Bereiche weiter 5 h 41; nach dem erneuten
   Oeffnen steht ueberall wieder der alte Wert.

   Ursache (in diesem Test nachgestellt, Abschnitt B):
     1. Der Server rechnet die Dauer eines Workouts beim Speichern aus den Zeitstempeln
        neu (RPC orvia_upsert_activity_from_session) — die Spalte traegt wieder 341 min.
     2. Die Korrektur stand zwar in metrics, aber KEIN Leser hat sie angewendet.
     3. Serverzeilen haben Vorrang vor dem lokalen Stand (Liste), und der Abgleich
        ueberschrieb den lokalen Wert mit der Spalte (nach dem Neuoeffnen).

   A  Modell (rein): Aufloesung, Setzen, Zuruecknehmen, Altform, zweite Kennzahl, juengerer Satz
   B  Der Fehler von Anfang bis Ende, mit den echten Bausteinen
   C  Abgleich mit dem Server: Spalte = Quellwert, Korrektur wird nie stillschweigend geloescht
   D  Verdrahtung im Quelltext: ein Schreibweg, keine Sonderlogik in der Oberflaeche
   node supabase/tests/effective_metric_test.mjs
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
const AN = await imp('js/activity-normalize.js');
await imp('js/training-domain.js');
globalThis.ORVIA.onboardingSportsLogic = await imp('js/onboarding/onboarding-sports-logic.js');
const C = await imp('js/activity-config.js');
const S = await imp('js/activity-store.js');
const load = f => (0, eval)(rd(f));
load('js/repos/repoBase.js'); load('js/repos/activityRepository.js'); load('js/activity-sync.js');
const sync = globalThis.ORVIA.activitySync, repo = globalThis.ORVIA.repos.activity;
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; };

const SRC = 341 * 60, MAN = 75 * 60;
const T1 = '2026-10-06T10:00:00.000Z', T2 = '2026-10-06T11:00:00.000Z', T3 = '2026-10-06T12:00:00.000Z';
const act = o => Object.assign({ id: 'a1', clientRecordId: 'c1', sportId: 'gym', source: 'orvia_workout', sourceRecordId: 'sess1', workoutSessionId: 'sess1',
  startedAt: '2026-10-05T16:00:00.000Z', endedAt: '2026-10-05T21:41:00.000Z', durationSeconds: SRC, status: 'completed', summary: {}, metrics: {} }, o || {});

sec('A · Modell');
{
  const a = act();
  const r0 = E.resolveMetric(a, 'duration');
  ok('A1 ohne Korrektur: wirksam = Quelle, nicht korrigiert', r0.sourceValue === SRC && r0.effectiveValue === SRC && r0.manualValue === null && r0.corrected === false && r0.source === 'source');
  ok('A2 ohne Korrektur gibt applyEffective DASSELBE Objekt zurueck (kein Kopieren beim Lesen)', E.applyEffective(a) === a);

  const s1 = E.setManual(a, 'duration', MAN, { at: T1 });
  const r1 = s1.resolved;
  ok('A3 setManual: wirksam = manuell, Quelle bleibt', s1.ok && r1.effectiveValue === MAN && r1.manualValue === MAN && r1.sourceValue === SRC && r1.corrected && r1.source === 'manual' && r1.correctedAt === T1, J(r1));
  ok('A4 kanonisches Feld traegt den wirksamen Wert; das Eingangsobjekt bleibt unveraendert', s1.activity.durationSeconds === MAN && a.durationSeconds === SRC && J(a.metrics) === '{}' && s1.activity !== a);
  ok('A5 Speicherform: metrics.corrections.duration { manual, source, unit, at, method }', J(s1.activity.metrics.corrections.duration) === J({ manual: MAN, source: SRC, unit: 's', at: T1, method: 'manual' }));
  ok('A6 Altform wird mitgefuehrt (der Garmin-Worker schuetzt diesen Schluessel)', J(s1.activity.metrics.durationCorrection) === J({ fromMin: 341, toMin: 75, at: T1, method: 'manual_correction' }));
  ok('A7 getEffectiveMetric / isCorrected', E.getEffectiveMetric(s1.activity, 'duration') === MAN && E.isCorrected(s1.activity, 'duration') && !E.isCorrected(a, 'duration'));
  ok('A8 idempotent: applyEffective auf einem hergestellten Objekt aendert nichts', E.applyEffective(s1.activity) === s1.activity);

  const s2 = E.setManual(s1.activity, 'duration', 90 * 60, { at: T2 });
  ok('A9 zweite Korrektur: die Quelle bleibt der URSPRUENGLICHE Wert (nicht der vorige manuelle)', s2.resolved.sourceValue === SRC && s2.resolved.effectiveValue === 5400 && s2.activity.metrics.durationCorrection.fromMin === 341);

  const c1 = E.clearManual(s2.activity, 'duration', { at: T3 });
  ok('A10 zuruecknehmen: wirksam = Quelle, Feld zurueckgestellt', c1.ok && c1.activity.durationSeconds === SRC && !c1.resolved.corrected && c1.resolved.effectiveValue === SRC);
  ok('A11 Ruecknahme bleibt als Satz stehen (manual: null, was = zurueckgenommener Wert); Altform entfernt',
    c1.activity.metrics.corrections.duration.manual === null && c1.activity.metrics.corrections.duration.method === 'cleared' && c1.activity.metrics.corrections.duration.was === 5400 && !('durationCorrection' in c1.activity.metrics));
  ok('A12 zuruecknehmen ohne Korrektur: unveraendert', E.clearManual(a, 'duration').unchanged === true);

  ok('A13 Grenzen: 0, negativ, > 24 h, kein Wert, unbekannte Kennzahl werden abgelehnt',
    !E.setManual(a, 'duration', 0).ok && !E.setManual(a, 'duration', -5).ok && !E.setManual(a, 'duration', 24 * 3600 + 1).ok && !E.setManual(a, 'duration', 'x').ok && E.setManual(a, 'gibtsnicht', 5).error === 'unknown_metric');

  /* frische Serverzeile: Spalte = Quelle, Korrektur in metrics */
  const raw = act({ durationSeconds: SRC, metrics: { corrections: { duration: { manual: MAN, source: SRC, unit: 's', at: T1, method: 'manual' } } } });
  const ap = E.applyEffective(raw);
  ok('A14 Serverzeile mit Korrektur: applyEffective stellt den wirksamen Wert her, Zeile bleibt unveraendert', ap !== raw && ap.durationSeconds === MAN && raw.durationSeconds === SRC && E.resolveMetric(ap, 'duration').sourceValue === SRC);

  /* Altform, Feld vom Abgleich auf den Serverwert zurueckgesetzt — der Zustand auf Gians Geraet */
  const old = act({ durationSeconds: SRC, metrics: { durationCorrection: { fromMin: 341, toMin: 75, at: T1, method: 'manual_correction' }, plannedSessionId: 'po:x' } });
  const ro = E.resolveMetric(old, 'duration');
  const ao = E.applyEffective(old);
  ok('A15 Altform (durationCorrection) wird gelesen: wirksam 75 min, Quelle 341 min', ro.corrected && ro.effectiveValue === MAN && ro.sourceValue === SRC);
  ok('A16 Altform wird in die neue Form ueberfuehrt, andere metrics bleiben', ao.durationSeconds === MAN && ao.metrics.corrections.duration.manual === MAN && ao.metrics.corrections.duration.at === T1 && ao.metrics.plannedSessionId === 'po:x' && ao.metrics.durationCorrection.toMin === 75);
  ok('A17 danach idempotent', E.applyEffective(ao) === ao);

  /* zweite Kennzahl: das Modell ist nicht auf die Dauer zugeschnitten */
  const swim = { id: 's1', sportId: 'swimming', source: 'garmin', status: 'completed', durationSeconds: 1800, summary: { distanceM: 1000, avgHr: 130 }, metrics: {} };
  const sd = E.setManual(swim, 'distance', 700, { at: T1 });
  ok('A18 Distanz Schwimmen: Garmin 1.000 m, manuell 700 m ⇒ wirksam 700 m, Quelle 1.000 m', sd.ok && sd.activity.summary.distanceM === 700 && sd.resolved.sourceValue === 1000 && swim.summary.distanceM === 1000 && sd.activity.summary.avgHr === 130);
  ok('A19 Distanz ist vorbereitet, aber NICHT zur Eingabe freigegeben; Dauer nur fuer abgeschlossene ORVIA-Workouts',
    E.isEditable(swim, 'distance') === false && E.isEditable(act(), 'duration') === true && E.isEditable(act({ source: 'garmin' }), 'duration') === false && E.isEditable(act({ status: 'active' }), 'duration') === false);
  const run = { id: 'r1', sportId: 'running', source: 'garmin', status: 'completed', durationSeconds: 1800, summary: { distanceKm: 5 }, metrics: {} };
  const rdm = E.setManual(run, 'distance', 5200, { at: T1 });
  ok('A20 Distanz Laufen (km-Feld): 5 km → 5,2 km, Quelle 5.000 m', rdm.activity.summary.distanceKm === 5.2 && rdm.resolved.sourceValue === 5000 && rdm.resolved.effectiveValue === 5200 && E.applyEffective(rdm.activity) === rdm.activity);
  ok('A21 Kennzahlen-Liste und Einheiten', J(E.metricKeys()) === J(['duration', 'distance']) && E.metricDef('duration').unit === 's' && E.metricDef('distance').unit === 'm');

  /* zwei Staende: der juengere Satz gilt */
  const srv = act({ durationSeconds: SRC, metrics: {} });
  const ad = E.adoptNewer(srv, s1.activity);
  ok('A22 adoptNewer: Stand ohne Korrektur uebernimmt die des anderen', ad !== srv && E.applyEffective(ad).durationSeconds === MAN && srv.metrics.corrections === undefined);
  ok('A23 adoptNewer: gleich alt oder aelter ⇒ DASSELBE Objekt', E.adoptNewer(s2.activity, s1.activity) === s2.activity && E.adoptNewer(s1.activity, s1.activity) === s1.activity);
  const ad2 = E.applyEffective(E.adoptNewer(s1.activity, c1.activity));
  ok('A24 adoptNewer: eine juengere Ruecknahme setzt sich durch — Feld zurueck auf die Quelle', !E.isCorrected(ad2, 'duration') && ad2.durationSeconds === SRC, J(ad2.metrics) + ' ' + ad2.durationSeconds);
  ok('A25 leere / kaputte Eingaben werfen nicht', E.applyEffective(null) === null && E.resolveMetric(null, 'duration').effectiveValue === null && E.resolveMetric({ metrics: 'x', durationSeconds: 60 }, 'duration').effectiveValue === 60 && E.adoptNewer(null, {}) === null);
}

sec('B · Der Fehler von Anfang bis Ende');
{
  reset();
  /* 1. Workout abgeschlossen: 16:00–21:41 = 341 min (App lief weiter) */
  const sess = { id: 'sessB', sport_key: 'gym', status: 'completed', started_at: '2026-10-05T16:00:00.000Z', finished_at: '2026-10-05T21:41:00.000Z', total_paused_seconds: 0, duration_min: 341, session_rpe: 6 };
  S.upsertActivityFromWorkout(sess, [{ workoutExercise: { exercise_id: 'b' }, exercise: { name: 'Bankdruecken' }, sets: [{ set_number: 1, set_type: 'working', weight: 60, reps: 11, completed: true }] }], { syncStatus: 'synced' });
  const a0 = S.getActivityBySource('orvia_workout', 'sessB');
  ok('B1 Ausgang: 341 min', a0 && a0.durationSeconds === SRC);

  /* 2. Nutzer korrigiert auf 1 h 15 */
  const dc = S.correctActivityDuration(a0.clientRecordId, 75);
  const a1 = S.getActivityBySource('orvia_workout', 'sessB');
  ok('B2 Korrektur: Speicher traegt 75 min, wartet auf den Abgleich, Quelle 341 min gemerkt', dc.ok && dc.fromMin === 341 && dc.toMin === 75 && a1.durationSeconds === MAN && a1.syncStatus === 'pending' && E.resolveMetric(a1, 'duration').sourceValue === SRC);
  ok('B3 Uebungen und Saetze sind von der Korrektur unberuehrt', a1.workoutSnapshot && a1.workoutSnapshot.length === 1 && a1.workoutSnapshot[0].sets[0].reps === 11);

  /* 3. So antwortet der Server: Dauer AUS DEN ZEITSTEMPELN (341 min), metrics wie gesendet */
  const serverRow = { id: 'srv-B', client_record_id: a1.clientRecordId, user_id: 'u1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessB', workout_session_id: 'sessB',
    started_at: sess.started_at, ended_at: sess.finished_at, duration_seconds: SRC, status: 'completed', summary: a1.summary, metrics: JSON.parse(JSON.stringify(a1.metrics)) };
  ok('B4 Voraussetzung des Fehlers: die Serverzeile traegt 341 min UND die Korrektur', serverRow.duration_seconds === SRC && serverRow.metrics.corrections.duration.manual === MAN);

  /* 4. Liste: Serverzeilen haben Vorrang vor dem lokalen Stand */
  const cached = C.normalizeServerActivity(serverRow);
  ok('B5 Serverzeile → Client-Objekt: wirksam 75 min (bis v8-444: 341 min)', cached.durationSeconds === MAN, String(cached.durationSeconds));
  const list = C.mergeAllActivities([cached], S.listActivities(), []);
  ok('B6 vereinte Liste: eine Einheit, 75 min', list.length === 1 && list[0].durationSeconds === MAN);

  /* 5. Abgleich nach dem Senden — bis v8-444 ueberschrieb er die 75 min mit 341 */
  S.markSynced(a1.clientRecordId, 'srv-B');
  const mr = S.mergeServerActivities([serverRow]);
  const a2 = S.getActivityById('srv-B');
  ok('B7 nach dem Abgleich: Speicher weiter 75 min, synchron', mr.updated === 1 && a2.durationSeconds === MAN && a2.syncStatus === 'synced', a2.durationSeconds + ' ' + a2.syncStatus);
  ok('B8 Quelle weiter 341 min, Saetze weiter da', E.resolveMetric(a2, 'duration').sourceValue === SRC && a2.workoutSnapshot[0].sets[0].reps === 11);

  /* 6. Neustart: der Speicher wird frisch gelesen */
  const k = Object.keys(mem).find(x => /^orvia_activities_/.test(x));
  const persisted = JSON.parse(mem[k]);
  ok('B9 im Speicher abgelegt: 75 min + Korrektursatz (uebersteht das Neuladen)', persisted[0].durationSeconds === MAN && persisted[0].metrics.corrections.duration.source === SRC);
  mem[k] = JSON.stringify(persisted);          // anderer Rohtext-Zeiger, gleicher Inhalt
  ok('B10 nach dem Neuladen: 75 min', S.getActivityById('srv-B').durationSeconds === MAN);

  /* 7. Auswertungen lesen dasselbe Feld */
  const day = C.dayOfActLocal(a2, 'Europe/Berlin');
  const units = C.dailyLoadUnits(S.listActivities(), {});
  ok('B11 Trainingslast rechnet mit 75 min', units.units && units.units.length === 1 && units.units[0].minutes === 75, J(units.units && units.units.map(u => u.minutes)));
  const wk = C.weeklyActivityTotals(S.listActivities(), {}, { weekRef: day, timezone: 'Europe/Berlin' });
  ok('B12 Wochensumme rechnet mit 75 min', wk && wk.totals && wk.totals.durationMin === 75 && wk.totals.knownDurationMin === 75 && J(wk).indexOf('341') < 0, J(wk && wk.totals));
  ok('B13 Zusammenfassungszeile zeigt 1 h 15 min', /1 h 15 min/.test(C.summaryLine(a2)) && !/5 h 41/.test(C.summaryLine(a2)), C.summaryLine(a2));

  /* 8. Geraet im Zustand VOR der Reparatur: Dauer zurueckgesetzt, Altform in metrics, synchron */
  reset();
  mem['orvia_activities_u1'] = JSON.stringify([act({ id: 'srv-old', clientRecordId: 'c-old', sourceRecordId: 'sessOld', workoutSessionId: 'sessOld', durationSeconds: SRC, syncStatus: 'synced',
    metrics: { durationCorrection: { fromMin: 341, toMin: 75, at: T1, method: 'manual_correction' } } })]);
  const h1 = S.getActivityById('srv-old');
  ok('B14 Altbestand heilt beim LESEN: 75 min, ohne dass der Nutzer erneut korrigiert', h1.durationSeconds === MAN && E.resolveMetric(h1, 'duration').sourceValue === SRC);
  ok('B15 Lesen schreibt nicht (Rohtext unveraendert)', JSON.parse(mem['orvia_activities_u1'])[0].durationSeconds === SRC);
  const oldRow = { id: 'srv-old', client_record_id: 'c-old', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessOld', workout_session_id: 'sessOld', started_at: '2026-10-05T16:00:00.000Z',
    duration_seconds: SRC, status: 'completed', summary: {}, metrics: { durationCorrection: { fromMin: 341, toMin: 75, at: T1, method: 'manual_correction' } } };
  ok('B16 Altbestand in der Liste (Serverzeile mit Altform): 75 min', C.normalizeServerActivity(oldRow).durationSeconds === MAN && AN.normalizeActivityRecord(oldRow).durationSeconds === MAN);
  S.mergeServerActivities([oldRow]);
  ok('B17 Altbestand nach dem Abgleich: 75 min im Speicher abgelegt', JSON.parse(mem['orvia_activities_u1'])[0].durationSeconds === MAN && S.getActivityById('srv-old').syncStatus === 'synced');

  /* 9. Gerade korrigiert, der Listen-Zwischenspeicher kennt die Korrektur noch nicht */
  reset();
  S.upsertActivityFromWorkout(Object.assign({}, sess, { id: 'sessC' }), [], { syncStatus: 'synced' });
  const c0 = S.getActivityBySource('orvia_workout', 'sessC');
  const stale = C.normalizeServerActivity({ id: 'srv-C', client_record_id: c0.clientRecordId, sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessC', workout_session_id: 'sessC', started_at: sess.started_at, duration_seconds: SRC, status: 'completed', summary: {}, metrics: {} });
  S.correctActivityDuration(c0.clientRecordId, 75);
  const l2 = C.mergeAllActivities([stale], S.listActivities(), []);
  ok('B18 veralteter Serverstand + frische lokale Korrektur: Liste zeigt sofort 75 min', l2.length === 1 && l2[0].durationSeconds === MAN && stale.durationSeconds === SRC);

  /* 10. Korrektur auf einem anderen Geraet zurueckgenommen */
  const cleared = E.clearManual(S.getActivityBySource('orvia_workout', 'sessC'), 'duration', { at: '2099-01-01T00:00:00.000Z' }).activity;
  S.markSynced(c0.clientRecordId, 'srv-C');
  S.mergeServerActivities([{ id: 'srv-C', client_record_id: c0.clientRecordId, sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessC', workout_session_id: 'sessC', started_at: sess.started_at, duration_seconds: SRC, status: 'completed', summary: {}, metrics: cleared.metrics }]);
  const c2 = S.getActivityById('srv-C');
  ok('B19 Ruecknahme vom anderen Geraet kommt an: wieder 341 min, nicht korrigiert', c2.durationSeconds === SRC && !E.isCorrected(c2, 'duration') && c2.syncStatus === 'synced', c2.durationSeconds + ' ' + J(c2.metrics));

  /* 11. Server hat die Korrektur verloren, dieses Geraet traegt sie noch */
  reset();
  S.upsertActivityFromWorkout(Object.assign({}, sess, { id: 'sessD' }), [], { syncStatus: 'synced' });
  const d0 = S.getActivityBySource('orvia_workout', 'sessD');
  S.correctActivityDuration(d0.clientRecordId, 75); S.markSynced(d0.clientRecordId, 'srv-D');
  S.mergeServerActivities([{ id: 'srv-D', client_record_id: d0.clientRecordId, sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessD', workout_session_id: 'sessD', started_at: sess.started_at, duration_seconds: SRC, status: 'completed', summary: {}, metrics: { plannedSessionId: 'po:y' } }]);
  const d2 = S.getActivityById('srv-D');
  ok('B20 Serverzeile ohne Korrektur: lokale Korrektur bleibt (75 min) — Serverfelder werden trotzdem uebernommen', d2.durationSeconds === MAN && d2.metrics.plannedSessionId === 'po:y');

  /* 12. erneuter Upsert desselben Workouts (Wiederholung nach Fehler) */
  S.upsertActivityFromWorkout(Object.assign({}, sess, { id: 'sessD' }), null, { syncStatus: 'pending' });
  ok('B21 erneuter Upsert desselben Workouts behaelt die Korrektur', S.getActivityBySource('orvia_workout', 'sessD').durationSeconds === MAN);
}

sec('C · Abgleich mit dem Server');
{
  reset();
  const calls = { rpc: [], update: [], select: 0 };
  let serverMetrics = {};
  globalThis.ORVIA.sb = {
    rpc: (name, args) => { calls.rpc.push({ name, args }); if (args.p_session_id === 'conf') return Promise.resolve({ data: null, error: { message: 'activity_identity_conflict' } });
      return Promise.resolve({ data: [{ id: 'srv-' + args.p_session_id, source: 'orvia_workout', source_record_id: args.p_session_id, client_record_id: args.p_client_record_id }], error: null }); },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => { calls.select++; return Promise.resolve({ data: [{ metrics: serverMetrics }], error: null }); } }) }) }),
      update: (patch) => ({ eq: () => ({ eq: () => ({ select: () => { calls.update.push(patch); return Promise.resolve({ data: [Object.assign({ id: 'x' }, patch)], error: null }); } }) }) })
    })
  };
  const sess = { id: 'w1', sport_key: 'gym', status: 'completed', started_at: '2026-10-05T16:00:00.000Z', finished_at: '2026-10-05T21:41:00.000Z', duration_min: 341 };
  S.upsertActivityFromWorkout(sess, [], { syncStatus: 'synced' });
  const a = S.getActivityBySource('orvia_workout', 'w1');
  S.correctActivityDuration(a.clientRecordId, 75);
  const r = await sync.flushPendingActivities();
  const sent = calls.rpc[0] && calls.rpc[0].args;
  ok('C1 Workout-Weg: die Korrektur geht mit metrics an den Server', r.pushed === 1 && sent && sent.p_metrics && sent.p_metrics.corrections && sent.p_metrics.corrections.duration.manual === MAN && sent.p_metrics.durationCorrection.toMin === 75, J(sent && sent.p_metrics));

  /* fremdes Geraet (Identitaetskonflikt) bzw. Server-Quelle: activities.update(id) */
  const UUID = '9f8e0b4e-2a1c-4e6b-9c6a-5b2f1a7d3c29';
  S.mergeServerActivities([{ id: UUID, client_record_id: 'act:iphone:q1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'conf', workout_session_id: 'conf', started_at: '2026-10-05T16:00:00.000Z', duration_seconds: SRC, status: 'completed', summary: {}, metrics: { streams: { heart_rate: [1, 2] } } }]);
  S.correctActivityDuration(UUID, 75);
  serverMetrics = { streams: { heart_rate: [1, 2] }, detailsVersion: 2 };
  calls.update = [];
  await sync.flushPendingActivities();
  const up = calls.update[0];
  ok('C2 Konflikt-Weg: Spalte duration_seconds bekommt den QUELLWERT (341 min), nicht den manuellen', up && up.duration_seconds === SRC, J(up && up.duration_seconds));
  ok('C3 Konflikt-Weg: Korrektur in metrics, fremde Schluessel (Messreihen) unberuehrt', up && up.metrics.corrections.duration.manual === MAN && up.metrics.durationCorrection.toMin === 75 && up.metrics.detailsVersion === 2 && J(up.metrics.streams) === J({ heart_rate: [1, 2] }));

  /* additive Schluessel: ein Geraet OHNE die Korrektur loescht sie nicht */
  serverMetrics = { corrections: { duration: { manual: MAN, source: SRC, unit: 's', at: T2, method: 'manual' } }, durationCorrection: { fromMin: 341, toMin: 75, at: T2 } };
  const keys = { ownedKeys: ['plannedSessionId', 'planLinkCorrection', 'durationCorrection', 'corrections'], additiveKeys: ['corrections'], localWins: false };
  let u = await repo.updateFields(UUID, { metrics: { plannedSessionId: 'po:z' } }, { metricsMerge: keys });
  ok('C4 Geraet ohne Korrektur sendet nur die Plan-Zuordnung: corrections auf dem Server bleibt', u.success && u.data.metrics.corrections.duration.manual === MAN && u.data.metrics.plannedSessionId === 'po:z');
  ok('C5 … die Altform wird dabei wie bisher entfernt (gefuehrter Schluessel) — die neue Form traegt die Korrektur', !('durationCorrection' in u.data.metrics));
  u = await repo.updateFields(UUID, { metrics: { corrections: { duration: { manual: 3600, source: SRC, unit: 's', at: T1, method: 'manual' } } } }, { metricsMerge: keys });
  ok('C6 aelterer lokaler Satz verliert gegen den juengeren auf dem Server', u.data.metrics.corrections.duration.manual === MAN);
  u = await repo.updateFields(UUID, { metrics: { corrections: { duration: { manual: null, source: SRC, was: MAN, unit: 's', at: T3, method: 'cleared' } } } }, { metricsMerge: keys });
  ok('C7 juengere Ruecknahme setzt sich auf dem Server durch', u.data.metrics.corrections.duration.manual === null && u.data.metrics.corrections.duration.method === 'cleared');
  u = await repo.updateFields(UUID, { metrics: { corrections: { distance: { manual: 700, source: 1000, unit: 'm', at: T1, method: 'manual' } } } }, { metricsMerge: keys });
  ok('C8 je Kennzahl getrennt: eine Distanz-Korrektur laesst die Dauer-Korrektur stehen', u.data.metrics.corrections.distance.manual === 700 && u.data.metrics.corrections.duration.manual === MAN);
  ok('C9 ohne manuelle Korrektur wird die Spalte nicht angefasst', (function () {
    const src = rd('js/activity-sync.js'); return /function _sourceSeconds\(a\)/.test(src) && /if \(sv != null\) p\.duration_seconds = sv;/.test(src) && !/p\.duration_seconds = a\.durationSeconds/.test(src); })());
}

sec('D · Verdrahtung im Quelltext');
{
  const ui = rd('js/ui.js'), store = rd('js/activity-store.js'), ws = rd('js/workout-store.js'), idx = rd('index.html'), sw = rd('sw.js');
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('D1 Modul wird vor dem Normalisierer geladen und liegt im Vorrat des Service Workers',
    idx.indexOf('js/activity-effective.js') > 0 && idx.indexOf('js/activity-effective.js') < idx.indexOf('js/activity-normalize.js') && /'\.\/js\/activity-effective\.js'/.test(sw));
  ok('D2 Oberflaeche liest die Korrektur nur ueber den Resolver (kein metrics.durationCorrection in ui.js)', !/durationCorrection/.test(strip(ui)) && /_E\.resolveMetric\(a,'duration'\)/.test(ui) && /_E\.isEditable\(a,'duration'\)/.test(ui));
  ok('D3 EIN Schreibweg im Speicher: correctActivityDuration ruft setActivityCorrection', /function correctActivityDuration\(id, newMin\) \{[\s\S]{0,260}setActivityCorrection\(id, 'duration'/.test(store) && /setActivityCorrection: setActivityCorrection/.test(store));
  ok('D4 Speicher stellt den Vertrag beim Lesen, beim Mischen und beim erneuten Upsert her', (strip(store).match(/eff\(|applyEffective\(/g) || []).length >= 4);
  ok('D5 beide Serverwege wenden die Korrektur an', /E\.applyEffective\(rec\)/.test(rd('js/activity-normalize.js')) && /E\.applyEffective\(rec\)/.test(rd('js/activity-config.js')));
  ok('D6 Zuruecknehmen laeuft ueber denselben Einstieg (newMin == null)', /const clearing = newMin == null;/.test(ws) && /gmResetDurationCorrect/.test(ui) && /correctFinishedDuration\(aid,null\)/.test(ui));
  ok('D7 Trainings-Verlauf und Tagesblock folgen dem wirksamen Wert', /E\.isCorrected\(act, 'duration'\)/.test(rd('js/workout-ui.js')) && /syncDurationMirror/.test(rd('js/workout-ui.js')) && /syncDurationMirror\(a\)/.test(ui));
  /* Das Belastungsmodell (versioniert, Teil des Entscheidungs-Logs) bleibt unveraendert: es
     erkennt die Korrektur an der mitgefuehrten Altform. Deshalb MUSS jeder korrigierte Stand
     sie tragen und jede Ruecknahme sie entfernen — geprueft an echten Objekten des Modells. */
  const LH = await imp('js/engine/load-history.js');
  const rec = { durationSeconds: 3600 };
  const base = { id: 'x', sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: T1, durationSeconds: SRC, recording: rec, metrics: {} };
  const cor = E.setManual(base, 'duration', MAN, { at: T1 }).activity;
  const clr = E.clearManual(cor, 'duration', { at: T2 }).activity;
  const viaServer = E.applyEffective(E.adoptNewer(Object.assign({}, base), cor));          // Korrektur nur aus dem Satz uebernommen
  const uCor = LH.asUnit(cor), uClr = LH.asUnit(clr), uBase = LH.asUnit(base);
  ok('D8 Belastungsmodell: ohne Korrektur zaehlt die Uhr (60 min), mit Korrektur die Korrektur (75 min), nach Ruecknahme wieder die Uhr',
    Math.round(uBase.durationMin) === 60 && Math.round(uCor.durationMin) === 75 && Math.round(uClr.durationMin) === 60, J([uBase.durationMin, uCor.durationMin, uClr.durationMin]));
  ok('D9 Belastungsmodell unveraendert (load-history@4) — kein neuer Stand im Entscheidungs-Log noetig', LH.VERSION === 'load-history@4');
  ok('D10 auch ein nur ueber den Satz uebernommener Stand traegt den Spiegel — das Belastungsmodell erkennt ihn', viaServer.durationSeconds === MAN && viaServer.metrics.durationCorrection.toMin === 75 && Math.round(LH.asUnit(viaServer).durationMin) === 75);
  const noMirror = E.applyEffective({ id: 'z', source: 'orvia_workout', status: 'completed', durationSeconds: MAN, metrics: { corrections: { duration: { manual: MAN, source: SRC, unit: 's', at: T1, method: 'manual' } } } });
  ok('D11 fehlt der Spiegel an einem korrigierten Stand, stellt applyEffective ihn her; danach idempotent', noMirror.metrics.durationCorrection.fromMin === 341 && E.applyEffective(noMirror) === noMirror);
}

console.log('\n' + (fail ? '❌' : '✅') + ' effective_metric: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
