/* ============================================================
   ORVIA · plan_auto_link — automatische Plan-Zuordnung (v8-420, Gians Entscheidung 28.09.)
   ------------------------------------------------------------
     A. decide(): rein — naechste offene Einheit gleicher Sportart in der Woche,
        gleicher Tag zuerst, bei Gleichstand die fruehere; one-to-one; 'other' nie
     B. run(): Store + Resolver, Korrektur method 'auto', respektiert user_unlinked, idempotent
     C. UI: eine Zeile auf der Aktivitaetsseite, Auswahl als Sheet, Verdrahtung
   node supabase/tests/plan_auto_link_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const g = globalThis; g.window = g;
const mem = {};
g.ORVIA = { user: { id: 'u1' } };
g.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
g.ORVIA.activityNormalize = (await import(new URL(_APPREL + 'js/activity-normalize.js', import.meta.url))).default;
const _SPORTS = ['gym', 'running', 'cycling', 'swimming', 'other'];
const _strict = v => { const s = String(v == null ? '' : v).trim().toLowerCase(); return _SPORTS.indexOf(s) >= 0 ? s : null; };
g.ORVIA.trainingDomain = { normSportStrict: _strict, normSport: v => _strict(v) || 'other' };
g.ORVIA.onboardingSportsLogic = (await import(new URL(_APPREL + 'js/onboarding/onboarding-sports-logic.js', import.meta.url))).default;
await import(new URL(_APPREL + 'js/activity-config.js', import.meta.url));
const S = (await import(new URL(_APPREL + 'js/activity-store.js', import.meta.url))).default;
g.todayStr = d => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000) : new Date('2026-09-28T12:00:00Z')).toISOString().slice(0, 10);
(0, eval)(rd('js/plan-auto-link.js'));
const AL = g.ORVIA.planAutoLink;

sec('A · decide');
{
  const units = [
    { occurrenceId: 'po:2026-09-21:b', sportId: 'gym', localDate: '2026-09-21' },
    { occurrenceId: 'po:2026-09-22:d', sportId: 'gym', localDate: '2026-09-22' },
    { occurrenceId: 'po:2026-09-23:f', sportId: 'gym', localDate: '2026-09-23' },
    { occurrenceId: 'po:2026-09-26:j', sportId: 'gym', localDate: '2026-09-26' },
    { occurrenceId: 'po:2026-09-23:e', sportId: 'running', localDate: '2026-09-23' }
  ];
  const d1 = AL.decide({ activities: [{ id: 'k1', sportId: 'gym', localDate: '2026-09-24' }], units });
  ok('A1 Do-Kraft ⇒ Mi-Oberkoerper (Abstand 1, frueher schlaegt Sa mit Abstand 2)', d1.length === 1 && d1[0].occurrenceId === 'po:2026-09-23:f' && d1[0].reason === 'auto_same_week');
  const d2 = AL.decide({ activities: [{ id: 'k1', sportId: 'gym', localDate: '2026-09-22' }], units });
  ok('A2 gleicher Tag zuerst (Di ⇒ Di), reason auto_same_day', d2[0].occurrenceId === 'po:2026-09-22:d' && d2[0].reason === 'auto_same_day');
  const d3 = AL.decide({ activities: [{ id: 'k2', sportId: 'gym', localDate: '2026-09-25' }, { id: 'k1', sportId: 'gym', localDate: '2026-09-24' }], units });
  ok('A3 chronologisch, one-to-one: Do ⇒ Mi, Fr ⇒ Sa (Mi ist vergeben)', d3.length === 2 && d3[0].activityId === 'k1' && d3[0].occurrenceId === 'po:2026-09-23:f' && d3[1].activityId === 'k2' && d3[1].occurrenceId === 'po:2026-09-26:j');
  ok('A4 andere Woche ⇒ nichts; Sportart other ⇒ nichts; Lauf nimmt keine Kraft', AL.decide({ activities: [{ id: 'x', sportId: 'gym', localDate: '2026-09-28' }], units }).length === 0 && AL.decide({ activities: [{ id: 'x', sportId: 'other', localDate: '2026-09-24' }], units }).length === 0 && AL.decide({ activities: [{ id: 'x', sportId: 'running', localDate: '2026-09-24' }], units })[0].occurrenceId === 'po:2026-09-23:e');
  ok('A5 Gleichstand im Abstand ⇒ fruehere Einheit (Do zwischen Mi und Fr ⇒ Mi)', AL.decide({ activities: [{ id: 'x', sportId: 'gym', localDate: '2026-09-24' }], units: [{ occurrenceId: 'A', sportId: 'gym', localDate: '2026-09-25' }, { occurrenceId: 'B', sportId: 'gym', localDate: '2026-09-23' }] })[0].occurrenceId === 'B');
  ok('A6 leer/kaputt ⇒ []', AL.decide(null).length === 0 && AL.decide({ activities: [null, {}], units: [null] }).length === 0);
}

sec('B · run');
{
  S.mergeServerActivities([
    { id: 'srv-g1', client_record_id: 'a:g1', sport_id: 'gym', source: 'garmin', source_record_id: 'garmin-1', started_at: '2026-09-24T05:42:00.000Z', duration_seconds: 3360, status: 'completed', summary: {}, metrics: {} },
    { id: 'srv-w1', client_record_id: 'a:w1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sess1', workout_session_id: 'sess1', started_at: '2026-09-24T05:32:00.000Z', duration_seconds: 720, status: 'completed', summary: {}, metrics: {} },
    { id: 'srv-old', client_record_id: 'a:old', sport_id: 'gym', source: 'garmin', source_record_id: 'garmin-0', started_at: '2026-06-01T05:42:00.000Z', duration_seconds: 3360, status: 'completed', summary: {}, metrics: {} }
  ]);
  g.ORVIA.activityConfig.dayOfActLocal = a => String(a.startedAt).slice(0, 10);
  g._planActualNorm = v => ({ Gym: 'gym', gym: 'gym', Laufen: 'running', running: 'running' })[v] || 'other';
  let asked = [];
  g.planActualResolveForDates = dates => { asked.push(dates); const r = []; dates.forEach(d => { if (['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-26'].indexOf(d) >= 0) r.push({ plannedSessionId: 'po:' + d + ':ok', state: 'missed', planned: { sportId: 'gym', localDate: d } }); }); return { results: r }; };
  const events = []; g.addEventListener = () => {}; g.dispatchEvent = e => events.push(e.detail); g.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  const r = AL.run();
  ok('B1 zwei Aktivitaeten des Do zugeordnet: 05:32 ⇒ Mi (Abstand 1), 05:42 ⇒ Di (Abstand 2, frueher als Sa); Juni ausserhalb des Fensters', r.ok && r.applied === 2 && S.planLinkOf(S.getActivityById('srv-w1')) === 'po:2026-09-23:ok' && S.planLinkOf(S.getActivityById('srv-g1')) === 'po:2026-09-22:ok' && S.planLinkOf(S.getActivityById('srv-old')) === null);
  const c = S.getActivityById('srv-w1').metrics.planLinkCorrection;
  ok('B2 Korrektur protokolliert als method auto / reason auto_same_week, sync pending', c.method === 'auto' && c.reason === 'auto_same_week' && S.getActivityById('srv-w1').syncStatus === 'pending');
  ok('B3 Ereignis mit autoLinked:2', events.length === 1 && events[0].autoLinked === 2);
  const r2 = AL.run();
  ok('B4 idempotent: zweiter Lauf ordnet nichts mehr zu', r2.ok && r2.applied === 0);
  S.unlinkActivityFromPlan('srv-w1', 'po:2026-09-23:ok');
  const r3 = AL.run();
  ok('B5 vom Nutzer geloest ⇒ wird NICHT automatisch neu zugeordnet', r3.applied === 0 && S.planLinkOf(S.getActivityById('srv-w1')) === null);
  /* v8-421: Einheit nur im Server-Cache (anderes Geraet, Pull noch nicht gelaufen) */
  g.ORVIA.activityServerCache = () => [{ id: 'srv-c1', clientRecordId: 'act:iphone:c1', sportId: 'gym', source: 'orvia_workout', sourceRecordId: 'sessC', workoutSessionId: 'sessC', startedAt: '2026-09-25T06:00:00.000Z', durationSeconds: 900, status: 'completed', summary: {}, metrics: {}, _server: true }];
  const r4 = AL.run();
  ok('B5b Server-Cache-Einheit (nicht im Store) wird lokal gesichert und zugeordnet (Fr ⇒ Sa, Abstand 1)', r4.ok && r4.applied === 1 && S.planLinkOf(S.getActivityById('act:iphone:c1')) === 'po:2026-09-26:ok' && S.getActivityById('srv-c1').metrics.planLinkCorrection.method === 'auto');
  /* v8-422: VERWAISTE Zuordnung (Occurrence nicht mehr im Plan) wird neu zugeordnet */
  S.mergeServerActivities([{ id: 'srv-d1', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'sessD', workout_session_id: 'sessD', started_at: '2026-09-24T07:00:00.000Z', duration_seconds: 720, status: 'completed', summary: {}, metrics: { plannedSessionId: 'po:2026-09-23:psg:2:1:alt' } }]);
  ok('B5c vorher: Zuordnung zeigt auf eine unbekannte Occurrence', S.planLinkOf(S.getActivityById('srv-d1')) === 'po:2026-09-23:psg:2:1:alt');
  const r5 = AL.run();
  const d1 = S.getActivityById('srv-d1');
  ok('B5d verwaist ⇒ neu zugeordnet (naechste offene Gym-Einheit), reason *_relinked, fromOccurrenceId erhalten, dangling gezaehlt', r5.ok && r5.dangling === 1 && r5.applied === 1 && /^po:2026-09-2[1-6]:ok$/.test(S.planLinkOf(d1)) && /_relinked$/.test(d1.metrics.planLinkCorrection.reason) && d1.metrics.planLinkCorrection.fromOccurrenceId === 'po:2026-09-23:psg:2:1:alt');
  const r6 = AL.run();
  ok('B5e gueltige Zuordnungen werden NICHT angefasst (zweiter Lauf: 0 verwaist, 0 zugeordnet)', r6.ok && r6.dangling === 0 && r6.applied === 0);
  /* v8-424: Wochenplan laedt noch ⇒ nichts anfassen (weder zuordnen noch als verwaist werten) */
  S.mergeServerActivities([{ id: 'srv-p1', sport_id: 'gym', source: 'garmin', source_record_id: 'gp1', started_at: '2026-09-21T06:00:00.000Z', duration_seconds: 1800, status: 'completed', summary: {}, metrics: {} }]);
  const _prev = g.planActualResolveForDates;
  g.planActualResolveForDates = dates => Object.assign(_prev(dates), { planPendingDates: { '2026-09-22': true } });
  const r7 = AL.run();
  ok('B5f ladende Woche ⇒ zurueckgestellt (deferred > 0), keine Zuordnung, bestehende Links unberuehrt', r7.ok && r7.applied === 0 && r7.deferred >= 1 && S.planLinkOf(S.getActivityById('srv-p1')) === null && S.planLinkOf(S.getActivityById('srv-g1')) === 'po:2026-09-22:ok', JSON.stringify({ a: r7.applied, d: r7.deferred }));
  g.planActualResolveForDates = _prev;
  S.deleteActivity('srv-p1', { kind: 'activity' });
  ok('B6 ohne Resolver ⇒ unavailable, kein Throw', (() => { const s = g.planActualResolveForDates; delete g.planActualResolveForDates; const x = AL.run(); g.planActualResolveForDates = s; return x.ok === false && x.code === 'unavailable'; })());
}

sec('C · UI');
{
  const ui = rd('js/ui.js'), act = rd('js/activity.js'), de = rd('locales/de.js'), css = rd('styles.css'), idx = rd('index.html'), sw = rd('sw.js');
  ok('C1 Aktivitaetsseite: eine Zeile (gmActPlanLinkCard) statt Knopfliste', /gmActPlanLinkCard\(a,vm,_aidCorr\)/.test(ui) && !/link-cands" style="margin:0 18px 14px"><div class="sectlabel" style="padding-left:0">' \+ _uiT\('ui\.link_act_title'\)/.test(ui));
  ok('C2 Zeile: verknuepft ⇒ Label + Tag + „automatisch zugeordnet" + Aendern; nicht verknuepft ⇒ Zuordnen nur mit Kandidaten', /corr\.method==='auto'/.test(ui) && /ui\.pl_aendern/.test(ui) && /if\(!n\)return '';/.test(ui) && /ui\.pl_zuordnen/.test(ui));
  ok('C3 Sheet: gleiche/andere Sportart, Aktuell-Badge, Zuordnung loesen, Pick verknuepft und rendert neu', /function gmOpenPlanLinkSheet\(aid\)/.test(ui) && /ui\.pl_gleiche_sportart/.test(ui) && /ui\.pl_aktuell/.test(ui) && /unlinkActivityPlanCanonical\(/.test(ui.slice(ui.indexOf('function gmOpenPlanLinkSheet'), ui.indexOf('function gmPlanLinkPick'))) && /function gmPlanLinkPick\(aid,occ\)[\s\S]{0,400}gmOpenActivityPage\(aid\)/.test(ui));
  ok('C4 planUnitLabelFor exportiert; Store nimmt reason/method entgegen', /planUnitLabelFor: planUnitLabelFor/.test(act) && /function linkActivityToPlan\(id, occurrenceId, opts\)/.test(rd('js/activity-store.js')));
  ok('C5 Modul eingebunden (index nach activity.js, sw precache), Trigger: pulled/updated/load', idx.indexOf('js/plan-auto-link.js') > idx.indexOf('js/activity.js') && /'\.\/js\/plan-auto-link\.js'/.test(sw) && /orvia:activities-pulled/.test(rd('js/plan-auto-link.js')) && /ev\.detail\.autoLinked\) return/.test(rd('js/plan-auto-link.js')));
  ok('C6 Katalog + CSS', ['ui.pl_auto', 'ui.pl_aendern', 'ui.pl_keine', 'ui.pl_zuordnen', 'ui.pl_sheet_title', 'ui.pl_loesen', 'ui.pl_sheet_source'].every(k => de.indexOf("'" + k + "'") >= 0) && /\.plan-link \.pl-row\{/.test(css) && /\.plan-link \.pl-btn\.pri\{/.test(css));
}

console.log('\n' + (fail ? '❌' : '✅') + ' plan_auto_link: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
