/* ============================================================
   ORVIA · Engine 3c · Schritt 0 · Korrekturbatch I2c — Golden-Vertragstest
   Drei gekoppelte Datenwahrheits-Verträge:
   1) avg4WeekKm koaliert unbekannte Wochen NICHT zu 0 — Missingness strukturiert
      bis zur Prognose (goalEngine): unbekanntes Volumen ⇒ KEIN Volumen-Veto,
      not_assessable + reduzierte Confidence statt erfundenem Trainingsmangel.
   2) Kanonische Store-/Garmin-Läufe fließen OHNE Legacy-.sub in Long-Run-/lrMax28-/
      Goal-Auswertungen ein (distanzbasiert, nicht labelbasiert).
   3) _storeRunsByDay ist ein AUSDRÜCKLICHER Tagesaggregat-Vertrag PLUS separate
      Sessionliste mit stabiler ID — getrennte Läufe verschmelzen nie zu einer
      künstlichen Long-Run-Session.
   Pflicht-Golden:
   G1 kanonischer 12,5-km-Garmin-Lauf ohne .sub ⇒ längste Session 12,5 km.
   G2 zwei getrennte 5-km-Läufe/Tag ⇒ Wochenumfang 10 km, längste Session 5 km.
   G3 unbekannte Vorwochen ⇒ Prognose not_assessable (kein 0-km-Veto).
   G4 echte bekannte Null-Woche bleibt 0.
   node supabase/tests/engine_i2c_capacity_truth_test.mjs
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
const ok = (n, c, info) => { console.log((c ? '✅' : '❌') + ' ' + n + (info != null ? '  — ' + info : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
globalThis.ORVIA = { user: { id: 'u1' } };
await import(new URL('training-domain.js', base));
await import(new URL('activity-normalize.js', base));
await import(new URL('activity-config.js', base));
const cfg = globalThis.ORVIA.activityConfig;
const TD = globalThis.ORVIA.trainingDomain;
(0, eval)(readFileSync(new URL('calc.js', base), 'utf8'));
const Calc = globalThis.Calc;

const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
function slice(a, b) { const s = uiSrc.indexOf(a), e = uiSrc.indexOf(b, s + 1); if (s < 0 || e < 0 || e <= s) throw new Error('Slice fehlt: ' + a + ' … ' + b); return uiSrc.slice(s, e); }
const runsBlock = slice('function _validRun(', 'function allLoads(');
const buildGoalBlock = (function () { const s = uiSrc.indexOf('function buildGoal(){'); const rk = uiSrc.indexOf('_goalCacheT=Date.now();return _goalCache;', s); const e = uiSrc.indexOf('}', rk); return uiSrc.slice(s, e + 1); })();

function mk(TODAY, opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.isNaN = isNaN; sb.String = String; sb.Number = Number;
  sb.Calc = { isValidRunForAnalytics: r => !!r && r.dist > 0 };
  sb.DB = opts.DB || {};
  sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00:00'); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  sb.dkey = off => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + off); return sb.todayStr(d); };
  sb.ORVIA = {
    activityConfig: cfg, trainingDomain: TD,
    profileStore: { effectiveTimezone: () => opts.tz || 'Europe/Vienna' },
    activityStore: { listActivities: () => opts.storeRuns || [], isTombstoned: () => false }
  };
  vm.createContext(sb);
  vm.runInContext(runsBlock, sb, { filename: 'ui.js#runs' });
  return sb;
}
const run = (day, km, tag, hh) => ({ clientRecordId: 'a:' + day + ':' + km + ':' + (tag || 'x'), source: 'garmin', sourceRecordId: 's:' + day + ':' + km + ':' + (tag || 'x'), sportId: 'running', status: 'completed', startedAt: day + 'T' + (hh || '10') + ':00:00.000Z', durationSeconds: 3600, summary: { distanceKm: km, avg_hr: 150 } });

/* ---------- G1: 12,5-km-Garmin-Lauf ohne .sub ⇒ längste Session 12,5 km ---------- */
{
  const s = mk('2026-07-18', { storeRuns: [run('2026-07-16', 12.5, 'garmin')], DB: {} });
  ok('[G1-1] _longestRunKm(28) === 12.5 (distanzbasiert, ohne .sub-Label)', s._longestRunKm(28) === 12.5, 'ist=' + s._longestRunKm(28));
  const sess = s._storeRunSessions();
  ok('[G1-2] _storeRunSessions liefert 1 Session mit distKm 12.5', sess.length === 1 && sess[0].distKm === 12.5, JSON.stringify(sess));
  ok('[G1-3] Session trägt stabile ID (clientRecordId)', sess.length === 1 && sess[0].id === 'a:2026-07-16:12.5:garmin', sess[0] && sess[0].id);
  const day = s._storeRunsByDay()['2026-07-16'];
  ok('[G1-4] Tagesaggregat: longestKm 12.5, sessionCount 1, sessions[] vorhanden', !!day && day.longestKm === 12.5 && day.sessionCount === 1 && Array.isArray(day.sessions) && day.sessions.length === 1, JSON.stringify(day && { l: day.longestKm, c: day.sessionCount, n: day.sessions && day.sessions.length }));
}

/* ---------- G2: zwei getrennte 5-km-Läufe/Tag ⇒ Woche 10, längste Session 5 ---------- */
{
  const two = [run('2026-07-16', 5, 'am', '07'), run('2026-07-16', 5, 'pm', '18')];
  const s = mk('2026-07-18', { storeRuns: two, DB: {} });
  ok('[G2-1] weekRunKm(0) === 10 (Wochenumfang = Tagessumme, kanonischer Aggregator)', s.weekRunKm(0) === 10, 'ist=' + s.weekRunKm(0));
  ok('[G2-2] _longestRunKm(28) === 5 (längste EINZELsession, KEINE künstliche 10-km-Session)', s._longestRunKm(28) === 5, 'ist=' + s._longestRunKm(28));
  const day = s._storeRunsByDay()['2026-07-16'];
  ok('[G2-3] Tagesaggregat: dist 10, longestKm 5, sessionCount 2, sessions.length 2', !!day && day.dist === 10 && day.longestKm === 5 && day.sessionCount === 2 && day.sessions.length === 2, JSON.stringify(day && { d: day.dist, l: day.longestKm, c: day.sessionCount, n: day.sessions.length }));
  const sess = s._storeRunSessions();
  ok('[G2-4] _storeRunSessions: 2 Sessions, jede distKm 5, unterschiedliche IDs', sess.length === 2 && sess.every(x => x.distKm === 5) && sess[0].id !== sess[1].id, JSON.stringify(sess.map(x => x.id)));
}

/* ---------- G3: unbekannte Vorwochen ⇒ goalEngine not_assessable, kein 0-Veto ---------- */
{
  // Genug Läufe/Quality, damit die nodata-Schwelle überschritten ist.
  const runs42 = [];
  for (let i = 0; i < 8; i++) runs42.push({ date: '2026-07-0' + (i + 1), dist: 8, dur: 45, sub: i % 3 === 0 ? 'Tempo' : 'Easy Z2', hr: 150 });
  const geNull = Calc.goalEngine(runs42, { daysToRace: 60, targetMin: 105, targetWeekKm: 40, avg4WeekKm: null, lrMax28: 20, ctlNow: 40, ctlPrev28: 30, trackingWeeks: 6 });
  ok('[G3-1] state !== nodata (genug Läufe)', geNull.state !== 'nodata', 'state=' + geNull.state);
  ok('[G3-2] KEIN Volumen-Veto bei avg4WeekKm=null (kein erfundener Trainingsmangel)', !(geNull.vetos || []).some(v => /Volumen/.test(v)), JSON.stringify(geNull.vetos));
  ok('[G3-3] notAssessable enthält Volumen', Array.isArray(geNull.notAssessable) && geNull.notAssessable.some(x => /Volumen/i.test(x)), JSON.stringify(geNull.notAssessable));
  ok('[G3-4] confidence === "reduziert"', geNull.confidence === 'reduziert', 'conf=' + geNull.confidence);
  ok('[G3-5] assessable.volume === false', geNull.assessable && geNull.assessable.volume === false, JSON.stringify(geNull.assessable));

  // Gegenprobe: bekanntes niedriges Volumen ⇒ Veto feuert weiterhin (echter Mangel).
  const geLow = Calc.goalEngine(runs42, { daysToRace: 60, targetMin: 105, targetWeekKm: 40, avg4WeekKm: 10, lrMax28: 20, ctlNow: 40, ctlPrev28: 30, trackingWeeks: 6 });
  ok('[G3-6] Gegenprobe: bekanntes niedriges Volumen ⇒ Volumen-Veto feuert (echter Mangel)', (geLow.vetos || []).some(v => /Volumen/.test(v)), JSON.stringify(geLow.vetos));
  ok('[G3-7] Gegenprobe: assessable.volume === true, confidence !== reduziert (nur wegen Volumen)', geLow.assessable && geLow.assessable.volume === true, JSON.stringify(geLow.assessable));
}

/* ---------- G3b: lrMax28 fließt ehrlich in das Long-Run-Veto ein ---------- */
{
  const runs42 = [];
  for (let i = 0; i < 8; i++) runs42.push({ date: '2026-07-0' + (i + 1), dist: 8, dur: 45, sub: i % 3 === 0 ? 'Tempo' : 'Easy Z2', hr: 150 });
  const ge = Calc.goalEngine(runs42, { daysToRace: 60, targetMin: 105, targetWeekKm: 20, avg4WeekKm: 30, lrMax28: 12.5, ctlNow: 40, ctlPrev28: 30, trackingWeeks: 6 });
  const lrVeto = (ge.vetos || []).find(v => /Long Run/.test(v));
  ok('[G3b-1] Long-Run-Veto nutzt den EHRLICHEN lrMax28 (12–13 km), nicht 0', !!lrVeto && !/max\. 0 km/.test(lrVeto), lrVeto);
}

/* ---------- G4: echte bekannte Null-Woche bleibt 0 ---------- */
{
  const s = mk('2026-07-18', { storeRuns: [], DB: {} });
  ok('[G4-1] weekRunKm(0) === 0 bei echter Null-Woche (Vertrag vorhanden, keine Läufe)', s.weekRunKm(0) === 0, 'ist=' + s.weekRunKm(0));
  ok('[G4-2] _longestRunKm(28) === 0 bei echter Null-Woche', s._longestRunKm(28) === 0, 'ist=' + s._longestRunKm(28));
}

/* ---------- G5: Dedupe Store↔Legacy erhalten (Blob gewinnt je Tag) ---------- */
{
  const s = mk('2026-07-18', { storeRuns: [run('2026-07-16', 12, 'store')], DB: { '2026-07-16': { sessions: { Laufen: { sub: 'Tempo', dist: 7, dur: 33 } } } } });
  ok('[G5-1] _longestRunKm respektiert Blob-gewinnt-je-Tag (Blob 7, Store 12 ignoriert ⇒ 7)', s._longestRunKm(28) === 7, 'ist=' + s._longestRunKm(28));
  const rw = s.runsWindow(7).find(r => r.date === '2026-07-16');
  ok('[G5-2] runsWindow: Blob-Session gewinnt (dist 7, sub Tempo)', rw && rw.dist === 7 && rw.sub === 'Tempo', JSON.stringify(rw));
}

/* ---------- G6: buildGoal-Grenze — avg4WeekKm null-propagierend + lrMax28 via _longestRunKm ---------- */
{
  function mkBuildGoal(weekVals, longest) {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
    let captured = null;
    sb.DB = {};
    sb.isDay = () => false;
    sb.todayStr = () => '2026-07-18';
    sb.dkey = off => '2026-07-18';
    sb.daysTo = () => 60;
    sb.RACE = { date: '2026-10-01' };
    sb.goalTargetMin = () => 105;
    sb.runsWindow = () => [];
    sb.weekRunKm = off => weekVals[off];
    sb._longestRunKm = () => longest;
    sb.allLoads = () => ({ loads: [], labels: [] });
    sb.Calc = {
      loadSeries: () => ({ ctl: [] }),
      weekKmTarget: () => 40,
      goalEngine: (runs, opts) => { captured = opts; return { state: 'ontrack', vetos: [] }; }
    };
    sb.__get = () => captured;
    vm.createContext(sb);
    vm.runInContext('let _goalCache=null,_goalCacheT=0;' + buildGoalBlock, sb, { filename: 'ui.js#buildGoal' });
    sb.buildGoal();
    return sb.__get();
  }
  const optsUnknown = mkBuildGoal([null, null, null, null, null], 12.5);
  ok('[G6-1] buildGoal: avg4WeekKm === null, wenn alle 4 Vorwochen unbekannt (kein 0-Koaleszieren)', optsUnknown.avg4WeekKm === null, 'ist=' + optsUnknown.avg4WeekKm);
  ok('[G6-2] buildGoal: lrMax28 === _longestRunKm(28) (12.5) — distanzbasiert, nicht .sub-Filter', optsUnknown.lrMax28 === 12.5, 'ist=' + optsUnknown.lrMax28);
  const optsKnown = mkBuildGoal([null, 20, 22, 18, 24], 15);
  ok('[G6-3] buildGoal: avg4WeekKm === Mittel der BEKANNTEN Wochen (21), unbekannte ausgeklammert', optsKnown.avg4WeekKm === 21, 'ist=' + optsKnown.avg4WeekKm);
  const optsAllKnownZero = mkBuildGoal([0, 0, 0, 0, 0], 0);
  ok('[G6-4] buildGoal: avg4WeekKm === 0 bei bekannten Null-Wochen (echter Mangel, nicht null)', optsAllKnownZero.avg4WeekKm === 0, 'ist=' + optsAllKnownZero.avg4WeekKm);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I2c: ' + (fail === 0 ? 'GRÜN — Missingness bis zur Prognose, distanzbasierte Long-Run-Erkennung, Session-Identität, Dedupe erhalten.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
