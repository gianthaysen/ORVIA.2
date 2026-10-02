/* ============================================================
   ORVIA · plan_link_manual — manuelle Plan-Verknuepfung (v8-418, Gians Befund 28.09.)
   ------------------------------------------------------------
     Der Resolver verknuepft NIE ueber Tag+Sport (I3b). Eine Garmin-Krafteinheit am
     geplanten Tag blieb deshalb „Geplant" — ohne Weg, sie zu bestaetigen.
     A. Store: linkActivityToPlan — protokolliert, one-to-one, reversibel
     B. UI-Verdrahtung: Einheiten-Seite (Kandidaten) + Aktivitaetsseite (Plan-Einheiten)
     C. Rueckblick: laengste Einheit ohne „0 km", unplausible Dauern benannt
   node supabase/tests/plan_link_manual_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const mem = {};
globalThis.ORVIA = { user: { id: 'u1' } };
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.ORVIA.activityNormalize = (await import(new URL(_APPREL + 'js/activity-normalize.js', import.meta.url))).default;
const _SPORTS = ['gym', 'running', 'cycling', 'swimming', 'other'];
const _strict = v => { const s = String(v == null ? '' : v).trim().toLowerCase(); return _SPORTS.indexOf(s) >= 0 ? s : null; };
globalThis.ORVIA.trainingDomain = { normSportStrict: _strict, normSport: v => _strict(v) || 'other' };
globalThis.ORVIA.onboardingSportsLogic = (await import(new URL(_APPREL + 'js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;
await import(new URL(_APPREL + 'js/activity-config.js', import.meta.url));
const S = (await import(new URL(_APPREL + 'js/activity-store.js', import.meta.url))).default;

sec('A · Store');
{
  S.mergeServerActivities([
    { id: 'srv-g1', client_record_id: 'a:g1', sport_id: 'gym', source: 'garmin', source_record_id: 'garmin-1', started_at: '2026-09-24T05:42:00.000Z', ended_at: '2026-09-24T06:38:00.000Z', duration_seconds: 3360, status: 'completed', summary: { avgHr: 110 }, metrics: {} },
    { id: 'srv-w1', client_record_id: 'a:w1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess1', workout_session_id: 'sess1', started_at: '2026-09-24T05:32:00.000Z', ended_at: '2026-09-24T05:44:00.000Z', duration_seconds: 720, status: 'completed', summary: { exerciseCount: 5 }, metrics: {} }
  ]);
  const occ = 'po:2026-09-24:psg:4:0:oberkoerper';
  ok('A1 vorher: keine Plan-Identitaet', S.planLinkOf(S.getActivityById('srv-g1')) === null);
  const r = S.linkActivityToPlan('srv-g1', occ);
  ok('A2 link: ok/linked, plannedSessionId + Korrektur protokolliert (user_linked, manual_correction), pending', r.ok && r.code === 'linked' && r.activity.plannedSessionId === occ && r.activity.metrics.planLinkCorrection.toOccurrenceId === occ && r.activity.metrics.planLinkCorrection.reason === 'user_linked' && r.activity.metrics.planLinkCorrection.method === 'manual_correction' && r.activity.syncStatus === 'pending');
  ok('A3 planLinkOf liest die Korrektur', S.planLinkOf(S.getActivityById('srv-g1')) === occ);
  ok('A4 erneut dieselbe Occurrence ⇒ already_linked, nichts geschrieben', S.linkActivityToPlan('srv-g1', occ).code === 'already_linked');
  const t = S.linkActivityToPlan('srv-w1', occ);
  ok('A5 One-to-one: zweite Aktivitaet auf dieselbe Occurrence ⇒ occurrence_taken', !t.ok && t.code === 'occurrence_taken' && t.byActivityId === 'srv-g1');
  ok('A6 Fehler: fehlende ID / fehlende Occurrence / unbekannte Aktivitaet', S.linkActivityToPlan(null, occ).code === 'missing_activity_id' && S.linkActivityToPlan('srv-g1', '').code === 'missing_occurrence_id' && S.linkActivityToPlan('nope', occ).code === 'activity_not_found');
  const u = S.unlinkActivityFromPlan('srv-g1', occ);
  ok('A7 reversibel: unlink nach link ⇒ unlinked, Occurrence frei', u.ok && u.code === 'unlinked' && S.planLinkOf(S.getActivityById('srv-g1')) === null && S.linkActivityToPlan('srv-w1', occ).ok);
  const rl = S.linkActivityToPlan('srv-g1', 'po:2026-09-24:psg:4:1:beine');
  ok('A8 Umhaengen einer bereits verknuepften Aktivitaet ⇒ user_relinked mit fromOccurrenceId', (() => { S.unlinkActivityFromPlan('srv-w1', occ); const x = S.linkActivityToPlan('srv-w1', occ); const y = S.linkActivityToPlan('srv-w1', 'po:2026-09-24:psg:4:2:x'); return x.ok && y.ok && y.activity.metrics.planLinkCorrection.reason === 'user_relinked' && y.activity.metrics.planLinkCorrection.fromOccurrenceId === occ; })());
  ok('A9 Export', typeof S.linkActivityToPlan === 'function' && rl.ok);
}

sec('B · UI-Verdrahtung');
{
  const ui = rd('js/ui.js'), act = rd('js/activity.js'), de = rd('locales/de.js'), css = rd('styles.css');
  const sp = ui.slice(ui.indexOf('function gmOpenSessionPage(di,ii,dateIso){'), ui.indexOf('function gmOpenSessionPage(di,ii,dateIso){') + 6000);
  ok('B1 Einheiten-Seite: Kandidaten aus dem Resolver (ambiguousCandidateIds, nie bei completed, nie in der Zukunft)', /planActualResolveForDates\(\[dIso\]\)/.test(sp) && /_ru\.state!=='completed'/.test(sp) && /ambiguousCandidateIds/.test(sp) && /dIso<=todayStr\(\)/.test(sp));
  ok('B2 Kandidaten-Knopf ruft linkActivityPlanCanonical(aid, occ)', /linkActivityPlanCanonical\(\\'/.test(sp) && /_linkBlock\+cta\+_undoPd/.test(sp));
  ok('B3 activity.js: linkActivityPlanCanonical + planLinkCandidatesFor exportiert, Fehlercode occurrence_taken lesbar', /function linkActivityPlanCanonical\(activityId, occurrenceId\)/.test(act) && /function planLinkCandidatesFor\(a\)/.test(act) && /linkActivityPlanCanonical: linkActivityPlanCanonical, planLinkCandidatesFor: planLinkCandidatesFor/.test(act) && /act\.occurrence_bereits_belegt/.test(act));
  ok('B4 planLinkCandidatesFor: offene Einheiten derselben WOCHE, gleicher Tag + Sportart zuerst; unlinkedActivitiesInWeekOf als Umkehrung', /dates\.indexOf\(r\.planned\.localDate\) >= 0/.test(act) && /sameSport \? 2 : 0\) \+ \(y\.sameDay \? 1 : 0/.test(act) && /function unlinkedActivitiesInWeekOf\(dateIso, sportId\)/.test(act) && /unlinkedActivitiesInWeekOf: unlinkedActivitiesInWeekOf/.test(act));
  ok('B4b Einheiten-Seite ergaenzt Wochen-Kandidaten (Tag-Kandidaten zuerst), Datum im Untertitel bei anderem Tag', /unlinkedActivitiesInWeekOf\(dIso,it\.t\)/.test(sp) && /vm\.date!==dIso/.test(sp));
  const ap = ui.slice(ui.indexOf('function gmOpenActivityPage(aid){'), ui.indexOf('function gmOpenActivityPage(aid){') + 40000);
  ok('B5 Aktivitaetsseite (seit v8-420): eine Zeile gmActPlanLinkCard, Auswahl im Sheet', /gmActPlanLinkCard\(a,vm,_aidCorr\)/.test(ap) && /function gmOpenPlanLinkSheet\(aid\)/.test(ui));
  ok('B6 Katalog + CSS', ['ui.link_cand_title', 'ui.link_cand_hint', 'ui.link_act_title', 'ui.link_andere_sportart', 'act.mit_planeinheit_verknuepft', 'act.occurrence_bereits_belegt'].every(k => de.indexOf("'" + k + "'") >= 0) && /\.link-cands \.cta\.link-cand\{/.test(css));
}

sec('C · Rueckblick');
{
  const { tStub } = await import('./_i18n-src.mjs');
  const g = globalThis; g.window = g; g.ORVIA.i18n = tStub(); g.icon = n => '<svg data-i="' + n + '"></svg>'; g.fmtDe = v => String(v).replace('.', ',');
  g.todayStr = d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date('2026-09-24T12:00:00Z')).toISOString().slice(0, 10);
  g.gmPlanForOffset = () => null; g.planActualResolveForDates = () => ({ byOcc: {} }); g.DB = {}; g.readinessOf = () => null;
  const acts = [
    { id: 'k1', sportId: 'gym', startedAt: '2026-09-22T05:30:00Z', durationSeconds: 3360, summary: { name: 'Krafttraining' } },
    { id: 'k2', sportId: 'gym', startedAt: '2026-09-23T05:30:00Z', durationSeconds: 33 * 3600, summary: { name: 'Krafttraining' } }
  ];
  g.ORVIA.activityStore = { listActivities: () => acts, isTombstoned: () => false };
  g.ORVIA.activityConfig = { dayOfActLocal: a => a.startedAt.slice(0, 10), sportLabel: id => ({ gym: 'Krafttraining' })[id] || id, weeklyActivityTotals: () => ({ totals: { sessionCount: 2, durationMin: 0, knownDurationMin: 0, completeness: { duration: true, distance: true } }, bySport: {} }) };
  (0, eval)(rd('js/review-v14.js'));
  const RV = g.ORVIA.reviewV14;
  const m = RV.model(0);
  ok('C1 ohne Distanzsport: longest null, longestByTime = laengste Dauer (33 h), 1 unplausible', m.longest === null && m.longestByTime && m.longestByTime.id === 'k2' && m.implausible.length === 1 && m.implausible[0].id === 'k2');
  const h = RV.html(m);
  ok('C2 Karte „Laengste Einheit (nach Dauer)" mit Kraft-Icon, kein „0 km"', /Längste Einheit \(nach Dauer\)/.test(h) && /data-i="dumbbell"/.test(h) && !/0 km/.test(h));
  ok('C3 Hinweis auf unplausible Dauer mit Name und Stunden', /1 Einheit mit unplausibler Dauer/.test(h) && /Krafttraining · 33:00 h/.test(h) && /Dauer in der Aktivität korrigieren/.test(h));
  acts.push({ id: 'r1', sportId: 'running', startedAt: '2026-09-21T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 9.8, name: 'Lauf' } });
  const m2 = RV.model(0);
  ok('C4 mit Lauf: longest = Lauf (Distanz), Zeit-Karte entfaellt', m2.longest && m2.longest.id === 'r1' && m2.longestByTime === null && /data-i="run"/.test(RV.html(m2)));
  acts.push({ id: 'k0', sportId: 'gym', startedAt: '2026-09-16T05:30:00Z', durationSeconds: 33 * 3600, summary: { name: 'Krafttraining' } });
  acts[1].durationSeconds = 3000;
  const m3 = RV.model(0);
  ok('C5 unplausible Dauer in der VERGLEICHSWOCHE wird unter dem Vergleich benannt und ist antippbar', m3.prevImplausible.length === 1 && /Vergleichswoche enthält eine unplausible Dauer/.test(RV.html(m3)) && /gmOpenActivityPage\('k0'\)/.test(RV.html(m3)));
}

sec('D · Identitaet ueber Geraete (v8-421, Gians Befund „activity_not_found")');
{
  /* Fall: Einheit auf dem iPhone aufgezeichnet (client_record_id des iPhones), auf dem Mac
     aus der Serverliste angezeigt. Der Store hatte sie beim Merge mit einer NEUEN Ersatz-crid
     eingefuegt ⇒ Suche ueber die Server-crid schlug fehl. */
  const m = S.mergeServerActivities([
    { id: 'srv-x1', client_record_id: 'act:iphone:abc', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessX', workout_session_id: 'sessX', started_at: '2026-09-24T05:32:00.000Z', duration_seconds: 720, status: 'completed', summary: {}, metrics: {} }
  ]);
  const x = S.getActivityById('act:iphone:abc');
  ok('D1 Merge uebernimmt die Server-client_record_id (Store findet die Einheit ueber die crid des anderen Geraets)', m.merged === 1 && !!x && x.id === 'srv-x1' && x.clientRecordId === 'act:iphone:abc');
  ok('D2 normalizeActivityRecord fuehrt clientRecordId mit', ORVIA.activityNormalize.normalizeActivityRecord({ id: 'q', client_record_id: 'c1' }).clientRecordId === 'c1');
  const occ = 'po:2026-09-23:psg:3:0:oberkoerper';
  ok('D3 link ueber die Server-crid ⇒ linked (vorher activity_not_found)', S.linkActivityToPlan('act:iphone:abc', occ).code === 'linked' && S.planLinkOf(S.getActivityById('srv-x1')) === occ);
  ok('D4 unlink ueber Objekt-Referenz (source+sourceRecordId reicht)', S.unlinkActivityFromPlan({ source: 'orvia_workout', sourceRecordId: 'sessX' }, occ).code === 'unlinked');
  ok('D5 link ueber Objekt-Referenz mit nur workoutSessionId', S.linkActivityToPlan({ workoutSessionId: 'sessX' }, occ).code === 'linked');
  /* Altbestand: Eintrag hatte bereits eine Ersatz-crid ⇒ Update-Zweig uebernimmt die Server-crid */
  S.mergeServerActivities([{ id: 'srv-y1', sport_id: 'gym', source: 'garmin', source_record_id: 'gy1', started_at: '2026-09-25T05:32:00.000Z', duration_seconds: 700, status: 'completed', summary: {}, metrics: {} }]);
  const y0 = S.getActivityById('srv-y1');
  S.mergeServerActivities([{ id: 'srv-y1', client_record_id: 'act:watch:y1', sport_id: 'gym', source: 'garmin', source_record_id: 'gy1', started_at: '2026-09-25T05:32:00.000Z', duration_seconds: 700, status: 'completed', summary: {}, metrics: {} }]);
  ok('D6 Altbestand mit Ersatz-crid uebernimmt die Server-crid beim naechsten Merge (kein Duplikat)', /^act:u1:/.test(y0.clientRecordId) && S.getActivityById('act:watch:y1') && S.getActivityById('act:watch:y1').id === 'srv-y1' && S.listActivities().filter(a => a.id === 'srv-y1').length === 1);
  /* ensureLocal: Server-Cache-Objekt (camelCase, _server) einfuegen — nie ueberschreiben */
  const e1 = S.ensureLocal({ id: 'srv-z1', clientRecordId: 'act:iphone:z1', sportId: 'gym', source: 'orvia_workout', sourceRecordId: 'sessZ', workoutSessionId: 'sessZ', startedAt: '2026-09-26T05:32:00.000Z', durationSeconds: 600, summary: { exerciseCount: 3 }, metrics: {}, _server: true });
  const z = S.getActivityById('act:iphone:z1');
  ok('D7 ensureLocal fuegt eine unbekannte Server-Einheit als synced ein (crid des Geraets, keine _server-Markierung persistiert)', e1.code === 'inserted' && !!z && z.id === 'srv-z1' && z.syncStatus === 'synced' && z._server === undefined);
  S.linkActivityToPlan('srv-z1', 'po:2026-09-26:psg:6:0:x');
  const e2 = S.ensureLocal({ id: 'srv-z1', clientRecordId: 'act:iphone:z1', sportId: 'gym', source: 'orvia_workout', sourceRecordId: 'sessZ', startedAt: '2026-09-26T05:32:00.000Z', metrics: {} });
  ok('D8 ensureLocal ueberschreibt nie: lokale (pending) Verknuepfung bleibt', e2.code === 'exists' && S.planLinkOf(S.getActivityById('srv-z1')) === 'po:2026-09-26:psg:6:0:x' && S.getActivityById('srv-z1').syncStatus === 'pending');
  ok('D9 ensureLocal: ungueltig/ohne id ⇒ invalid; getombstoned ⇒ tombstoned', S.ensureLocal(null).code === 'invalid' && S.ensureLocal({ sportId: 'gym' }).code === 'invalid' && (() => { S.deleteActivity('srv-z1', { kind: 'activity' }); return S.ensureLocal({ id: 'srv-z1', clientRecordId: 'act:iphone:z1', source: 'orvia_workout', sourceRecordId: 'sessZ' }).code === 'tombstoned'; })());
  const act = rd('js/activity.js'), al = rd('js/plan-auto-link.js');
  ok('D10 activity.js: Server-Cache-Einheit vor dem Verknuepfen lokal sichern, Link/Unlink ueber Objekt-Referenz', /if \(a\._server && store\.ensureLocal\)/.test(act) && /store\.linkActivityToPlan\(a, occurrenceId\)/.test(act) && /store\.unlinkActivityFromPlan\(a, expectedOccurrenceId \|\| null\)/.test(act));
  ok('D11 plan-auto-link: run() sichert Server-Cache-Einheiten lokal, bevor zugeordnet wird (v8-428: in EINEM Vorgang)', /store\.ensureLocalMany\(_srv\)/.test(al) && /store\.linkManyToPlan\(decisions, \{ method: 'auto' \}\)/.test(al));
  /* v8-428: Sammelvarianten + gemerktes Parse-Ergebnis */
  {
    const before = S.listActivities().length;
    const em = S.ensureLocalMany([
      { id: 'srv-m1', clientRecordId: 'act:m:1', sportId: 'gym', source: 'garmin', sourceRecordId: 'gm1', startedAt: '2026-09-27T06:00:00.000Z', durationSeconds: 600, summary: {}, metrics: {} },
      { id: 'srv-m1', clientRecordId: 'act:m:1', sportId: 'gym', source: 'garmin', sourceRecordId: 'gm1' },   /* doppelt in derselben Liste */
      { id: 'srv-x1', source: 'orvia_workout', sourceRecordId: 'sessX' },                                       /* existiert bereits */
      { sportId: 'gym' }, null
    ]);
    ok('D12 ensureLocalMany: ein neuer Eintrag, Duplikat in der Liste und Bestand erkannt, Ungueltiges uebersprungen', em.inserted === 1 && em.existing === 2 && em.skipped === 2 && S.listActivities().length === before + 1 && S.getActivityById('act:m:1').syncStatus === 'synced', JSON.stringify(em));
    const lm = S.linkManyToPlan([
      { activityId: 'srv-m1', occurrenceId: 'po:2026-09-27:psg:6:0:a', reason: 'auto_same_day' },
      { activityId: 'srv-y1', occurrenceId: 'po:2026-09-27:psg:6:0:a', reason: 'auto_same_week' },             /* dieselbe Occurrence ⇒ belegt */
      { activityId: 'gibtsnicht', occurrenceId: 'po:2026-09-27:psg:6:1:b' }
    ], { method: 'auto' });
    const m1 = S.getActivityById('srv-m1');
    ok('D13 linkManyToPlan: one-to-one auch innerhalb der Liste, protokolliert (auto), pending', lm.applied === 1 && lm.results.map(r => r.code).join(',') === 'linked,occurrence_taken,activity_not_found' && S.planLinkOf(m1) === 'po:2026-09-27:psg:6:0:a' && m1.metrics.planLinkCorrection.method === 'auto' && m1.metrics.planLinkCorrection.reason === 'auto_same_day' && m1.syncStatus === 'pending', JSON.stringify(lm.results));
    /* Merkstand: Aufrufer kann seinen Eintrag veraendern, ohne den Speicher zu beruehren */
    const a1 = S.getActivityById('srv-m1'); a1.syncStatus = 'KAPUTT'; a1.recording = { x: 1 };
    const a2 = S.getActivityById('srv-m1');
    ok('D14 gelesene Eintraege sind Kopien — fremde Feldaenderungen landen nicht im Speicher', a2.syncStatus === 'pending' && a2.recording === undefined);
    /* Aenderung von aussen (anderes Tab / Test) wird gesehen: Rohtext entscheidet */
    const k = Object.keys(mem).find(x => /^orvia_activities_/.test(x)); const arr = JSON.parse(mem[k]); arr.push({ id: 'ext-1', clientRecordId: 'ext:1', sportId: 'running', source: 'manual', sourceRecordId: 'e1', startedAt: '2026-09-28T06:00:00.000Z', status: 'completed', summary: {}, metrics: {}, syncStatus: 'synced' }); mem[k] = JSON.stringify(arr);
    ok('D15 von aussen geaenderter Speicher wird sofort gelesen (kein veralteter Merkstand)', !!S.getActivityById('ext-1'));
    const dc = S.correctActivityDuration('srv-m1', 25);
    ok('D16 Dauerkorrektur ersetzt metrics (Zuordnung bleibt erhalten, kein Aendern an Ort und Stelle)', dc.ok && S.getActivityById('srv-m1').metrics.durationCorrection.toMin === 25 && S.planLinkOf(S.getActivityById('srv-m1')) === 'po:2026-09-27:psg:6:0:a');
  }
}

console.log('\n' + (fail ? '❌' : '✅') + ' plan_link_manual: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
