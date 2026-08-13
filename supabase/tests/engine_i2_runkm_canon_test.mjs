/* ============================================================
   ORVIA · Engine 3c · Schritt 0 / Inkrement I2 — Vertragstest
   Running-km-Kanonisierung: weekRunKm liest EXAKT den kanonischen Wochenvertrag
   (weeklyActivityTotals über activityStore.listActivities() + DB — identischer
   Eingang wie Wochenreview/Plan). _storeRunsByDay wird tz-korrekt und zählt
   Mehrfachläufe/Tag, statt 1-Lauf/Tag zu verlieren.
   ROT vorher: weekRunKm zählt 1-Lauf/Tag und weicht vom Aggregator ab.
   node supabase/tests/engine_i2_runkm_canon_test.mjs
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
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const block = uiSrc.slice(uiSrc.indexOf('function _validRun('), uiSrc.indexOf('function allLoads('));

function mk(TODAY, opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.isNaN = isNaN; sb.String = String; sb.Number = Number;
  sb.Calc = { isValidRunForAnalytics: r => !!r && r.dist > 0 };
  sb.DB = opts.DB || {};
  sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00:00'); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  sb.dkey = off => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + off); return sb.todayStr(d); };
  sb.listActivitiesUnified = () => opts.storeRuns || [];
  sb.ORVIA = {
    activityConfig: cfg, trainingDomain: TD,
    profileStore: { effectiveTimezone: () => opts.tz || 'Europe/Vienna' },
    activityStore: { listActivities: () => opts.storeRuns || [], isTombstoned: () => false }
  };
  vm.createContext(sb);
  vm.runInContext(block, sb, { filename: 'ui.js#runs' });
  return sb;
}
const run = (day, km) => ({ clientRecordId: 'a:' + day + ':' + km, source: 'garmin', sourceRecordId: 's:' + day + ':' + km, sportId: 'running', status: 'completed', startedAt: day + 'T10:00:00.000Z', durationSeconds: 2400, summary: { distanceKm: km, avg_hr: 150 } });

// Szenario: ZWEI kanonische Läufe am selben Tag (8 + 6 km) in der injizierten Woche (Mo 13.–So 19.07.).
const two = [run('2026-07-16', 8), run('2026-07-16', 6)];
const expectedAgg = cfg.weeklyActivityTotals(two, {}, { weekRef: '2026-07-13', timezone: 'Europe/Vienna' }).bySport.running.knownDistanceKm;
ok('[I2-0] Aggregator-Erwartung: 2 Läufe/Tag summieren zu 14 km', expectedAgg === 14, 'agg=' + expectedAgg);

const s = mk('2026-07-18', { storeRuns: two, DB: {} });
ok('[I2-1] weekRunKm(0) === kanonischer Aggregator-Wochenwert (14 km)', s.weekRunKm(0) === expectedAgg, 'weekRunKm=' + s.weekRunKm(0) + ' agg=' + expectedAgg);
ok('[I2-2] weekRunKm zählt Mehrfachläufe/Tag mit (keine 1-Lauf/Tag-Unterzählung)', s.weekRunKm(0) === 14, 'ist=' + s.weekRunKm(0));
const d16 = s.runsWindow(7).find(r => r.date === '2026-07-16');
ok('[I2-3] runsWindow/_storeRunsByDay summiert Mehrfachläufe/Tag (14 km statt 8)', !!d16 && d16.dist === 14, 'dist=' + (d16 && d16.dist));

// Einzellauf: beide Pfade zählen genau einmal.
const s4 = mk('2026-07-18', { storeRuns: [run('2026-07-16', 10)], DB: {} });
ok('[I2-4] weekRunKm zählt eine Aktivität genau einmal (10 km)', s4.weekRunKm(0) === 10, 'ist=' + s4.weekRunKm(0));

// Vorwoche (off=1) liefert 0, wenn dort kein Lauf liegt — Referenzwoche korrekt versetzt.
ok('[I2-5] weekRunKm(1) (Vorwoche ohne Lauf) === 0', s.weekRunKm(1) === 0, 'ist=' + s.weekRunKm(1));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I2: ' + (fail === 0 ? 'GRÜN — Running-km liest den kanonischen Wochenvertrag (dedupliziert, Mehrfachläufe/Tag, tz-korrekt).' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
