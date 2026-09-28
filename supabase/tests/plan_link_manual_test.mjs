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

console.log('\n' + (fail ? '❌' : '✅') + ' plan_link_manual: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
