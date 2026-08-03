/* ============================================================
   ORVIA · Engine 3c · I3b.1 — Fail-closed Adapter (Teil A) + session-genaue Tageserfüllung (Teil B)
   Teil A: fehlt/wirft der Resolver oder fehlt die Activity-Quelle ⇒ NIE ✓, ehrlich 'nicht bestimmbar';
           KEIN Rückfall auf Tag+Sport/planStatus.
   Teil B: byDay zählt geplante Occurrences (session-genau), NICHT Sportarten-Mengen; mehrere
           Einheiten derselben Sportart werden korrekt unterschieden; Unsicherheit nie ⇒ completed.
   node supabase/tests/engine_i3b1_failclosed_aggregation_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../../app/js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const RealCalc = globalThis.Calc;
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const s0 = uiSrc.indexOf('function _planActualNorm(');
const s1 = uiSrc.indexOf('\nlet _goalCache=null,_goalCacheT=0;');
const adapterSrc = uiSrc.slice(s0, s1);

/* ======================= TEIL A: FAIL-CLOSED ADAPTER ======================= */
function makeCtx({ acts = [], DB = {}, plan = null, today = '2026-07-15', calc = RealCalc, noStore = false }) {
  const sb = {};
  sb.window = sb; sb.globalThis = sb; sb.Math = Math; sb.JSON = JSON; sb.Date = Date; sb.String = String; sb.Object = Object; sb.Array = Array; sb.Error = Error;
  sb.Calc = calc;
  sb.todayStr = () => today;
  sb.DB = DB;
  sb.activeWeekPlan = () => (plan || Array.from({ length: 7 }, () => []));
  sb.ORVIA = {
    trainingDomain: { normSport: v => ({ laufen: 'running', gym: 'gym', rad: 'cycling' }[String(v || '').toLowerCase()] || String(v || '').toLowerCase()) },
    activityConfig: { dayOfActLocal: a => a._ld || (a.startedAt || '').slice(0, 10) },
    activityStore: noStore ? {} : { listActivities: () => acts },
    profileStore: { effectiveTimezone: () => 'Europe/Vienna' }
  };
  vm.createContext(sb);
  vm.runInContext(adapterSrc + '\nthis.__today=planActualToday;this.__dates=planActualResolveForDates;', sb, { filename: 'ui.js#adapter' });
  return sb;
}
const T = '2026-07-15'; // Mittwoch → wd=2
const runPlan = () => { const p = Array.from({ length: 7 }, () => []); p[2] = [{ t: 'Laufen', id: 'ps:run1' }]; return p; };
const extRun = () => [{ id: 'x1', sportId: 'running', _ld: T, startedAt: T + 'T08:00:00Z', durationSeconds: 2400, summary: { distanceKm: 8 }, metrics: {} }];
const chipSafe = (ctx) => { try { return ctx.__today(); } catch (e) { return { key: 'THREW', label: String(e) }; } };
const occSafe = (ctx, occ) => { try { return (ctx.__dates([T]) || {}).byOcc || {}; } catch (e) { return { __threw: true }; } };

const CALC_MISSING = { planStatus: RealCalc.planStatus };                         // KEIN resolvePlanActual
const CALC_THROWS = { planStatus: RealCalc.planStatus, resolvePlanActual: () => { throw new Error('boom'); } };

/* A1: Resolver fehlt + geplanter Lauf + externer Lauf gleicher Tag ⇒ kein ✓, unbestimmt */
{
  const ctx = makeCtx({ acts: extRun(), plan: runPlan(), today: T, calc: CALC_MISSING });
  const byOcc = occSafe(ctx, 'po:' + T + ':ps:run1');
  const isDone = !!(byOcc['po:' + T + ':ps:run1'] && byOcc['po:' + T + ':ps:run1'].state === 'completed');
  ok('[A1a] Resolver fehlt: kein ✓ (kein completed für die Occurrence)', isDone === false, JSON.stringify(byOcc));
  ok('[A1b] Resolver fehlt: Chip "nicht bestimmbar"', chipSafe(ctx).key === 'unbestimmt', JSON.stringify(chipSafe(ctx)));
}
/* A2: Resolver wirft ⇒ kein ✓, unbestimmt */
{
  const ctx = makeCtx({ acts: extRun(), plan: runPlan(), today: T, calc: CALC_THROWS });
  const byOcc = occSafe(ctx, 'x');
  ok('[A2a] Resolver wirft: byOcc leer (kein ✓)', Object.keys(byOcc).filter(k => k !== '__threw').length === 0);
  ok('[A2b] Resolver wirft: Chip "nicht bestimmbar"', chipSafe(ctx).key === 'unbestimmt', JSON.stringify(chipSafe(ctx)));
}
/* A3: Activity-Quelle fehlt ⇒ kein ✓ und kein missed */
{
  const ctx = makeCtx({ plan: runPlan(), today: T, noStore: true });
  const res = ctx.__dates([T]);
  const occ = res.byOcc['po:' + T + ':ps:run1'];
  ok('[A3a] Store fehlt: Occurrence nicht completed', !occ || occ.state !== 'completed', occ && occ.state);
  ok('[A3b] Store fehlt: Occurrence NICHT missed', !occ || occ.state !== 'missed', occ && occ.state);
  ok('[A3c] Store fehlt: Chip "nicht bestimmbar"', chipSafe(ctx).key === 'unbestimmt', JSON.stringify(chipSafe(ctx)));
}
/* A4: Adapter/Resolver fehlt im Heute-Chip ⇒ KEINE alte Typmengenentscheidung */
{
  const ctx = makeCtx({ acts: extRun(), plan: runPlan(), today: T, calc: CALC_MISSING });
  ok('[A4] Chip niemals "erfüllt" ohne Resolver (keine alte planStatus-Typmenge)', chipSafe(ctx).key !== 'erfuellt');
}
/* A5: renderWeekPlan-Ausdruck _isDone bei fehlendem Resolver ⇒ false (kein Tag+Typ-✓) */
{
  const ctx = makeCtx({ acts: extRun(), plan: runPlan(), today: T, calc: CALC_MISSING });
  const byOcc = occSafe(ctx, 'x');
  const _paR = byOcc['po:' + T + ':ps:run1'] || null;
  const _isDone = (_paR && _paR.state === 'completed');
  ok('[A5] _isDone=false bei fehlendem Resolver (renderWeekPlan zeigt kein ✓)', !_isDone);
}

/* ======================= TEIL B: SESSION-GENAUE TAGESERFÜLLUNG ======================= */
const Calc = RealCalc;
const P = (o) => o; // Lesbarkeit
const occ = (d, id) => ({ occurrenceId: 'po:' + d + ':' + id, sportId: 'running', localDate: d });
const D = '2026-07-13'; // vergangen ggü. today=2026-07-15

/* B1: Zwei Läufe, nur A explizit verknüpft ⇒ A completed, B nicht, Tag partial (nie completed) */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'running', localDate: D }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':a', load: 300, loadKnown: true }];
  const r = Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' });
  const a = r.results.find(x => x.plannedSessionId === 'po:' + D + ':a'), b = r.results.find(x => x.plannedSessionId === 'po:' + D + ':b');
  ok('[B1a] Lauf A completed', a.state === 'completed');
  ok('[B1b] Lauf B nicht completed', b.state !== 'completed', b.state);
  ok('[B1c] Tag partial, NIEMALS completed (Kern-Bugfix Sportarten-Set)', r.byDay[D].status === 'partial', r.byDay[D].status);
}
/* B2: Beide mit eigener Occurrence-ID verknüpft ⇒ beide completed, Tag completed */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'running', localDate: D }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':a', load: 300, loadKnown: true }, { activityId: 'k2', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':b', load: 320, loadKnown: true }];
  const r = Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' });
  ok('[B2a] beide completed', r.results.every(x => x.state === 'completed'));
  ok('[B2b] Tag completed', r.byDay[D].status === 'completed');
}
/* B3: Lauf + Gym, nur Lauf ⇒ Tag partial */
{
  const planned = [{ occurrenceId: 'po:' + D + ':run', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':gym', sportId: 'gym', localDate: D }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':run', load: 300, loadKnown: true }];
  ok('[B3] Tag partial', Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' }).byDay[D].status === 'partial');
}
/* B4: Zwei gleiche Sportarten, eine externe Aktivität ohne Plan-ID ⇒ keine erfüllt, Tag ambiguous */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'running', localDate: D }];
  const acts = [{ activityId: 'x', sportId: 'running', localDate: D, load: 300, loadKnown: true }];
  const r = Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' });
  ok('[B4a] keine Einheit automatisch erfüllt', r.results.every(x => x.state !== 'completed'));
  ok('[B4b] Tag ambiguous (Konkurrenz)', r.byDay[D].status === 'ambiguous', r.byDay[D].status);
}
/* B5: Eine completed, zweite unknown (heute) ⇒ Tag partial + Unsicherheitssignal (assessable:false) */
{
  const td = '2026-07-15';
  const planned = [{ occurrenceId: 'po:' + td + ':a', sportId: 'running', localDate: td }, { occurrenceId: 'po:' + td + ':b', sportId: 'gym', localDate: td }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: td, plannedSessionId: 'po:' + td + ':a', load: 300, loadKnown: true }];
  const r = Calc.resolvePlanActual(planned, acts, { today: td });
  ok('[B5a] Tag partial', r.byDay[td].status === 'partial', r.byDay[td].status);
  ok('[B5b] Unsicherheitssignal erhalten (assessable:false / uncertain)', r.byDay[td].assessable === false && r.byDay[td].uncertain === true, JSON.stringify(r.byDay[td]));
}
/* B6: Vergangener vollständiger Tag, alle sicher nicht erfüllt ⇒ missed */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'gym', localDate: D }];
  ok('[B6] Tag missed', Calc.resolvePlanActual(planned, [], { today: '2026-07-15' }).byDay[D].status === 'missed');
}
/* B7: Heute/Zukunft ohne Aktivitäten ⇒ unknown, niemals missed */
{
  const td = '2026-07-15';
  const rToday = Calc.resolvePlanActual([{ occurrenceId: 'po:' + td + ':a', sportId: 'running', localDate: td }], [], { today: td });
  ok('[B7a] heute ohne Aktivität ⇒ unknown, nicht missed', rToday.byDay[td].status === 'unknown');
  const fut = '2026-07-20';
  const rFut = Calc.resolvePlanActual([{ occurrenceId: 'po:' + fut + ':a', sportId: 'running', localDate: fut }], [], { today: td });
  ok('[B7b] Zukunft ⇒ unknown, nicht missed', rFut.byDay[fut].status === 'unknown');
}
/* B8: Reiner Ruhetag ⇒ kein missed, keine erfundene Erfüllung */
{
  const r = Calc.resolvePlanActual([{ occurrenceId: 'po:' + D + ':rest', sportId: 'running', localDate: D, isRest: true }], [], { today: '2026-07-15' });
  ok('[B8a] Ruhetag: keine Ergebnis-Einheit', r.results.length === 0);
  ok('[B8b] Ruhetag: kein byDay-Eintrag (nicht missed)', r.byDay[D] === undefined, JSON.stringify(r.byDay));
}
/* B9: Vertauschte Reihenfolge ⇒ identisches Ergebnis */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'gym', localDate: D }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':a', load: 300, loadKnown: true }, { activityId: 'k2', sportId: 'gym', localDate: D, plannedSessionId: 'po:' + D + ':b', load: 200, loadKnown: true }];
  const norm = r => JSON.stringify({ b: r.byDay, r: r.results.slice().sort((x, y) => String(x.plannedSessionId).localeCompare(String(y.plannedSessionId))) });
  ok('[B9] byDay + results reihenfolgeunabhängig', norm(Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' })) === norm(Calc.resolvePlanActual(planned.slice().reverse(), acts.slice().reverse(), { today: '2026-07-15' })));
}
/* B10: One-to-one (keine Activity zwei Occurrences, keine Occurrence zwei Activities) */
{
  const planned = [{ occurrenceId: 'po:' + D + ':a', sportId: 'running', localDate: D }, { occurrenceId: 'po:' + D + ':b', sportId: 'running', localDate: D }];
  const acts = [{ activityId: 'k1', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':a', load: 300, loadKnown: true }, { activityId: 'k2', sportId: 'running', localDate: D, plannedSessionId: 'po:' + D + ':b', load: 320, loadKnown: true }];
  const r = Calc.resolvePlanActual(planned, acts, { today: '2026-07-15' });
  const assigned = r.results.filter(x => x.activityId).map(x => x.activityId);
  const uniq = new Set(assigned);
  ok('[B10] jede Activity höchstens einer Occurrence (keine Doppelzuordnung)', assigned.length === uniq.size && assigned.length === 2);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3b.1: ' + (fail === 0 ? 'GRÜN — Adapter fail-closed (kein Tag+Sport-Rückfall, ehrlich nicht bestimmbar); byDay session-genau je Occurrence.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
