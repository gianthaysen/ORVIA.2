/* ============================================================
   ORVIA · plan_week_source — EINE Planquelle je Woche (v8-424, Gians Befund 2.10.)
   Vorwoche: Aktivitaet war zugeordnet („Oberkoerper · Di 22.9."), die Plankarte der
   Vorwoche zeigte trotzdem „Geplant". Ursache: Planseite las die Vorwoche ueber
   gmPlanForOffset (eigene Einheiten-IDs), der Resolver immer activeWeekPlan().
   node supabase/tests/plan_week_source_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
(0, eval)(rd('js/calc.js'));
const Calc = globalThis.Calc;
const ui = rd('js/ui.js');
const s0 = ui.indexOf('function _planActualNorm('), s1 = ui.indexOf('\nlet _goalCache=null,_goalCacheT=0;');
const adapterSrc = ui.slice(s0, s1);

const TODAY = '2026-10-02';                       // Freitag, Woche 28.9.–4.10.
const mk = (id) => { const p = Array.from({ length: 7 }, () => []); p[1] = [{ t: 'Gym', l: 'Oberkörper', id }]; return p; };   // Di
function ctx({ acts = [], cur, prev, prevProv = 'planned_week', withOffset = true }) {
  const sb = {};
  sb.window = sb; sb.globalThis = sb; sb.Math = Math; sb.JSON = JSON; sb.Date = Date; sb.String = String; sb.Object = Object; sb.Array = Array; sb.Calc = Calc;
  sb.todayStr = () => TODAY; sb.DB = {};
  sb.activeWeekPlan = () => cur;
  if (withOffset) sb.gmPlanForOffset = (off) => off === 0 ? { days: cur, provenance: 'current' } : { days: prev, provenance: prevProv };
  sb.ORVIA = { trainingDomain: { normSport: v => ({ gym: 'gym' })[String(v || '').toLowerCase()] || 'other' }, activityConfig: { dayOfActLocal: a => (a.startedAt || '').slice(0, 10) }, activityStore: { listActivities: () => acts, planLinkOf: a => (a.metrics && a.metrics.plannedSessionId) || null }, profileStore: { effectiveTimezone: () => 'UTC' } };
  sb._uiT = tStub().t;
  vm.createContext(sb);
  vm.runInContext(adapterSrc + '\nthis.__dates=planActualResolveForDates;this.__wk=planWeekDaysFor;this.__off=_planActualWeekOffsetFor;', sb, { filename: 'ui.js#adapter' });
  return sb;
}
const CUR = mk('ps:cur-ok'), PREV = mk('ps:prev-ok');

{
  const c = ctx({ cur: CUR, prev: PREV });
  ok('A1 Wochenversatz: heute 0, Vorwoche -1, Montag der Folgewoche +1', c.__off('2026-10-02') === 0 && c.__off('2026-09-28') === 0 && c.__off('2026-09-22') === -1 && c.__off('2026-09-27') === -1 && c.__off('2026-10-05') === 1);
  ok('A2 planWeekDaysFor: laufende Woche = activeWeekPlan, Vorwoche = gmPlanForOffset(-1)', c.__wk('2026-09-30').days === CUR && c.__wk('2026-09-22').days === PREV && c.__wk('2026-09-22').offset === -1);
  const r = c.__dates(['2026-09-22', '2026-09-29']);
  ok('A3 Resolver bildet Occurrences mit den IDs DER JEWEILIGEN Woche', !!r.byOcc['po:2026-09-22:ps:prev-ok'] && !!r.byOcc['po:2026-09-29:ps:cur-ok'] && !r.byOcc['po:2026-09-22:ps:cur-ok'], Object.keys(r.byOcc).join(','));
}
{
  /* Gians Fall: Aktivitaet Do 24.9. zugeordnet auf die Vorwochen-Einheit Di 22.9. */
  const acts = [{ id: 'g1', sportId: 'gym', startedAt: '2026-09-24T05:42:00Z', durationSeconds: 3360, summary: {}, metrics: { plannedSessionId: 'po:2026-09-22:ps:prev-ok' } }];
  const c = ctx({ acts, cur: CUR, prev: PREV });
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  const occ = c.__dates(dates).byOcc['po:2026-09-22:ps:prev-ok'];
  ok('B1 Vorwochen-Karte (ID der Vorwoche) wird completed, Ist 56 min', occ && occ.state === 'completed' && occ.actual && Math.round(occ.actual.durationMin) === 56, occ && occ.state);
  /* Alt-Zuordnung auf die ID der LAUFENDEN Woche: zaehlt in der Vorwoche nicht mehr (⇒ verwaist, plan-auto-link haengt um) */
  const acts2 = [{ id: 'g1', sportId: 'gym', startedAt: '2026-09-24T05:42:00Z', durationSeconds: 3360, summary: {}, metrics: { plannedSessionId: 'po:2026-09-22:ps:cur-ok' } }];
  const r2 = ctx({ acts: acts2, cur: CUR, prev: PREV }).__dates(dates);
  ok('B2 Alt-Zuordnung mit der ID der laufenden Woche ist in der Vorwoche keine bekannte Occurrence', !r2.byOcc['po:2026-09-22:ps:cur-ok'] && r2.byOcc['po:2026-09-22:ps:prev-ok'].state !== 'completed');
}
{
  const c = ctx({ cur: CUR, prev: PREV, prevProv: 'loading' });
  const r = c.__dates(['2026-09-22', '2026-09-29']);
  ok('C1 Wochenplan laedt noch ⇒ planPendingDates nennt genau die Tage dieser Woche', r.planPendingDates['2026-09-22'] === true && !r.planPendingDates['2026-09-29']);
  const c2 = ctx({ cur: CUR, prev: PREV, withOffset: false });
  ok('C2 ohne gmPlanForOffset (Altpfad/Test) ⇒ activeWeekPlan fuer alle Wochen, nichts pending', c2.__wk('2026-09-22').days === CUR && Object.keys(c2.__dates(['2026-09-22']).planPendingDates).length === 0);
}
{
  const act = rd('js/activity.js'), al = rd('js/plan-auto-link.js'), css = rd('styles.css'), de = rd('locales/de.js');
  ok('D1 Label einer Zuordnung kommt aus dem Plan IHRER Woche (planUnitLabelFor + Kandidatenliste)', /planWeekDaysFor\(date\)\.days/.test(act) && /planWeekDaysFor\(day\)\.days/.test(act));
  ok('D2 plan-auto-link: ladende Wochen werden zurueckgestellt, Lauf nach orvia:week-plan-loaded', /res\.planPendingDates/.test(al) && /orvia:week-plan-loaded/.test(al) && /deferred: deferred/.test(al));
  ok('D3 ui.js meldet geladene Wochenplaene (orvia:week-plan-loaded)', /new CustomEvent\('orvia:week-plan-loaded'/.test(ui));
  ok('D4 vergangene offene Einheit heisst „Nicht erledigt" statt „Geplant"', /dayKeys\[di\]<todayStr\(\)/.test(ui) && /ui\.nicht_erledigt_badge/.test(ui) && /'ui\.nicht_erledigt_badge': 'Nicht erledigt'/.test(de) && /\.session-state\.missed\{/.test(css));
}
{
  /* v8-425 */
  const al = rd('js/plan-auto-link.js'), de = rd('locales/de.js');
  ok('E1 fremde Woche: IDs auf der Wegwerf-Kopie (generiert UND gespeichert), nichts wird persistiert', /if\(g\)\{try\{ensureGeneratedPlanIds\(g\);\}catch\(_j\)\{ \}\}/.test(ui) && /try\{ensureGeneratedPlanIds\(cp\);\}catch\(_i\)\{ \}/.test(ui));
  ok('E2 Diagnose ORVIA.planAutoLink.debug() vorhanden (Leseansicht)', /function debug\(\)/.test(al) && /debug: debug/.test(al) && /'OHNE id'/.test(al));
  ok('E3 „Jetzt synchronisieren": drei Versuche, Meldung nennt die Ursache (HTTP-Code / Sitzung / keine Verbindung)', /for\(var _try=0;_try<3&&!baseline;_try\+\+\)/.test(ui) && /ui\.sync_worker_http/.test(ui) && /ui\.sync_sitzung_abgelaufen/.test(ui) && /'ui\.sync_worker_http': 'Worker antwortet mit Fehler \{code\}/.test(de));
}
console.log('\n' + (fail ? '❌' : '✅') + ' plan_week_source: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
