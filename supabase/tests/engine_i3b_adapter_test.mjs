/* ============================================================
   ORVIA · Engine 3c · I3 Part B — Adapter-Test (ui.js Plan-Ist-Adapter ⇄ realer Calc.resolvePlanActual)
   Prüft die dünne Daten-Adaptierung (Store/DB → Resolver-Eingaben) und das Chip-Mapping.
   Kernnachweis: gleicher Tag + gleiche Sportart OHNE plan-eigene Identität ergibt NIE "erfüllt".
   node supabase/tests/engine_i3b_adapter_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;

// Adapter aus ui.js herausschneiden (from _planActualNorm bis vor _goalCache).
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const s0 = uiSrc.indexOf('function _planActualNorm(');
const s1 = uiSrc.indexOf('\nlet _goalCache=null,_goalCacheT=0;');
if (s0 < 0 || s1 < 0 || s1 <= s0) { console.error('Adapter-Slice nicht gefunden'); process.exit(1); }
const adapterSrc = uiSrc.slice(s0, s1);

function makeCtx({ acts = [], DB = {}, plan = null, today = '2026-07-15' }) {
  const sb = {};
  sb.window = sb; sb.globalThis = sb; sb.Math = Math; sb.JSON = JSON; sb.Date = Date; sb.String = String; sb.Object = Object; sb.Array = Array; sb.Calc = Calc;
  sb.todayStr = () => today;
  sb.DB = DB;
  sb.activeWeekPlan = () => (plan || Array.from({ length: 7 }, () => []));
  sb.ORVIA = {
    trainingDomain: { normSport: v => ({ laufen: 'running', gym: 'gym', rad: 'cycling' }[String(v || '').toLowerCase()] || String(v || '').toLowerCase()) },
    activityConfig: { dayOfActLocal: a => a._ld || (a.startedAt || '').slice(0, 10) },
    activityStore: { listActivities: () => acts },
    profileStore: { effectiveTimezone: () => 'Europe/Vienna' }
  };
  vm.createContext(sb);
  vm.runInContext(adapterSrc + '\nthis.__today=planActualToday;this.__dates=planActualResolveForDates;', sb, { filename: 'ui.js#adapter' });
  return sb;
}
const T = '2026-07-15'; // Mittwoch → wd=2

/* 0) Slice/Export */
ok('[0-1] Adapter aus ui.js geschnitten (planActualResolveForDates/planActualToday)', /function planActualResolveForDates\(/.test(adapterSrc) && /function planActualToday\(/.test(adapterSrc));

/* 1) Aus dem Plan gestartet (plan-eigene Identität) ⇒ completed / Chip erfüllt */
{
  const plan = Array.from({ length: 7 }, () => []); plan[2] = [{ t: 'Laufen', id: 'ps:run1' }];
  const acts = [{ id: 'a1', sportId: 'running', _ld: T, startedAt: T + 'T08:00:00Z', durationSeconds: 2400, summary: { distanceKm: 8 }, metrics: { plannedSessionId: 'po:' + T + ':ps:run1' } }];
  const ctx = makeCtx({ acts, plan, today: T });
  const occ = ctx.__dates([T]).byOcc['po:' + T + ':ps:run1'];
  ok('[1a] geplanter Lauf mit plan-eigener Identität ⇒ completed', occ && occ.state === 'completed', occ && occ.state);
  ok('[1b] Heute-Chip erfüllt', ctx.__today().key === 'erfuellt', JSON.stringify(ctx.__today()));
}
/* 2) NICHT aus dem Plan (kein plannedSessionId), gleicher Tag/Sport ⇒ KEIN completed (Bug behoben) */
{
  const plan = Array.from({ length: 7 }, () => []); plan[2] = [{ t: 'Laufen', id: 'ps:run1' }];
  const acts = [{ id: 'a2', sportId: 'running', _ld: T, startedAt: T + 'T08:00:00Z', durationSeconds: 2400, summary: { distanceKm: 8 }, metrics: {} }];
  const ctx = makeCtx({ acts, plan, today: T });
  const occ = ctx.__dates([T]).byOcc['po:' + T + ':ps:run1'];
  ok('[2a] gleicher Tag+Sport ohne plan-eigene Identität ⇒ NICHT completed', occ && occ.state !== 'completed', occ && occ.state);
  ok('[2b] unknown (kein automatischer Link)', occ && occ.state === 'unknown', occ && occ.state);
  ok('[2c] Heute-Chip NICHT "erfüllt" (kein falsches Häkchen)', ctx.__today().key !== 'erfuellt', JSON.stringify(ctx.__today()));
}
/* 3) plan_done-Marker (DB-Blob) ⇒ completed */
{
  const plan = Array.from({ length: 7 }, () => []); plan[2] = [{ t: 'Laufen', id: 'ps:run1' }];
  const DB = {}; DB[T] = { sessions: { Laufen: { source: 'plan_done', plannedSessionId: 'po:' + T + ':ps:run1' } } };
  const ctx = makeCtx({ acts: [], DB, plan, today: T });
  ok('[3a] plan_done-Marker ⇒ completed', ctx.__dates([T]).byOcc['po:' + T + ':ps:run1'].state === 'completed');
  ok('[3b] Chip erfüllt', ctx.__today().key === 'erfuellt');
}
/* 4) Zwei geplante Einheiten, eine verknüpft ⇒ Tag partial / Chip teilweise */
{
  const plan = Array.from({ length: 7 }, () => []); plan[2] = [{ t: 'Laufen', id: 'ps:run1' }, { t: 'Gym', id: 'ps:gym1' }];
  const acts = [{ id: 'a3', sportId: 'running', _ld: T, startedAt: T + 'T08:00:00Z', durationSeconds: 2400, summary: {}, metrics: { plannedSessionId: 'po:' + T + ':ps:run1' } }];
  const ctx = makeCtx({ acts, plan, today: T });
  ok('[4a] Tag partial', ctx.__dates([T]).byDay[T].status === 'partial', ctx.__dates([T]).byDay[T].planStatusKey);
  ok('[4b] Chip teilweise', ctx.__today().key === 'teilweise');
}
/* 5) Ungeplante Aktivität ⇒ unmatched / Chip ungeplant */
{
  const plan = Array.from({ length: 7 }, () => []);
  const acts = [{ id: 'a4', sportId: 'cycling', _ld: T, startedAt: T + 'T08:00:00Z', durationSeconds: 3600, summary: {}, metrics: {} }];
  const ctx = makeCtx({ acts, plan, today: T });
  const r = ctx.__dates([T]);
  ok('[5a] ungeplante Aktivität ⇒ unmatched', r.unmatched.length === 1 && r.unmatched[0].state === 'unmatched');
  ok('[5b] Chip ungeplant', ctx.__today().key === 'ungeplant', JSON.stringify(ctx.__today()));
}
/* 6) Fehlender Store ⇒ Adapter liefert unknown-Einheiten, Chip nicht "erfüllt" (fail-closed) */
{
  const plan = Array.from({ length: 7 }, () => []); plan[2] = [{ t: 'Laufen', id: 'ps:run1' }];
  const ctx = makeCtx({ acts: [], plan, today: T });
  // Store leer (keine Aktivitäten) ⇒ Einheit unknown (heute noch möglich), Chip 'offen'.
  ok('[6a] leerer Store: Einheit nicht completed', ctx.__dates([T]).byOcc['po:' + T + ':ps:run1'].state !== 'completed');
  ok('[6b] Chip nicht erfüllt', ctx.__today().key !== 'erfuellt', JSON.stringify(ctx.__today()));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I3 Part B Adapter: ' + (fail === 0 ? 'GRÜN — Adapter baut korrekte Resolver-Eingaben; Chip/Planseite spiegeln denselben SSOT; Tag+Sport allein ergibt nie erfüllt.' : 'ROT — ' + fail + ' offen.'));
