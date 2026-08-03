/* ============================================================
   ORVIA · Engine 3c · Schritt 0 · Korrekturbatch I2b — Vertragstest
   Zwei Restfehler aus I2:
   1) weekRunKm() darf bei fehlendem kanonischem Vertrag (Activity Store /
      weeklyActivityTotals) NICHT 0 liefern — Ergebnis muss null/unknown sein.
      Eine echte Null-Wochen (Vertrag vorhanden, keine Läufe) bleibt weiterhin 0.
   2) _storeRunsByDay() darf getrennte Aktivitäten desselben Tages nicht zu
      einer künstlichen Long-Run-Session verschmelzen. Pflicht-Gegenbeispiel:
      zwei getrennte 5-km-Läufe am selben Tag ⇒ 10 km Tages-/Wochensumme,
      aber längste Einzelsession bleibt 5 km (sessionCount=2).
   Zusätzlich: die direkten Konsumenten-Anzeigen (renderRamp, baselineRows,
   buildAIReview/weekSummaryText, forecastCauses) dürfen bei unbekanntem
   Wochen-km weder abstürzen noch eine falsche 0 anzeigen/verrechnen.
   node supabase/tests/engine_i2b_missingness_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../js/', import.meta.url);
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
const intelSrc = readFileSync(new URL('intelligence.js', base), 'utf8');
const extrasSrc = readFileSync(new URL('extras.js', base), 'utf8');

function slice(src, a, b) { const s = src.indexOf(a), e = src.indexOf(b); if (s < 0 || e < 0 || e <= s) throw new Error('Slice-Marker fehlt: ' + a + ' … ' + b); return src.slice(s, e); }
const runsBlock = slice(uiSrc, 'function _validRun(', 'function allLoads(');

function mk(TODAY, opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array; sb.isNaN = isNaN; sb.String = String; sb.Number = Number;
  sb.Calc = { isValidRunForAnalytics: r => !!r && r.dist > 0 };
  sb.DB = opts.DB || {};
  sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00:00'); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  sb.dkey = off => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() + off); return sb.todayStr(d); };
  sb.ORVIA = {
    activityConfig: opts.noCfg ? undefined : cfg,
    trainingDomain: TD,
    profileStore: { effectiveTimezone: () => opts.tz || 'Europe/Vienna' },
    activityStore: opts.noStore ? undefined : { listActivities: () => opts.storeRuns || [], isTombstoned: () => false }
  };
  vm.createContext(sb);
  vm.runInContext(runsBlock, sb, { filename: 'ui.js#runs' });
  return sb;
}
const run = (day, km, tag, hh) => ({ clientRecordId: 'a:' + day + ':' + km + ':' + (tag || 'x'), source: 'garmin', sourceRecordId: 's:' + day + ':' + km + ':' + (tag || 'x'), sportId: 'running', status: 'completed', startedAt: day + 'T' + (hh || '10') + ':00:00.000Z', durationSeconds: 2400, summary: { distanceKm: km, avg_hr: 150 } });

/* ---------- Gruppe A: weekRunKm-Missingness ---------- */
{
  const sA1 = mk('2026-07-18', { DB: {}, noStore: true });
  ok('[A1] weekRunKm(0) === null, wenn activityStore fehlt (kein falsches 0)', sA1.weekRunKm(0) === null, 'ist=' + sA1.weekRunKm(0));

  const sA2 = mk('2026-07-18', { DB: {}, noCfg: true });
  ok('[A2] weekRunKm(0) === null, wenn activityConfig/weeklyActivityTotals fehlt', sA2.weekRunKm(0) === null, 'ist=' + sA2.weekRunKm(0));

  const sA3 = mk('2026-07-18', { storeRuns: [], DB: {} });
  ok('[A3] weekRunKm(0) === 0 bei ECHTER Null-Woche (Vertrag da, keine Läufe) — kein Overcorrect zu null', sA3.weekRunKm(0) === 0, 'ist=' + sA3.weekRunKm(0));

  const sA4 = mk('2026-07-18', { storeRuns: [run('2026-07-16', 8, 'solo')], DB: {} });
  ok('[A4] weekRunKm(0) === 8 im Normalfall (Regression, Kernverhalten unverändert)', sA4.weekRunKm(0) === 8, 'ist=' + sA4.weekRunKm(0));
}

/* ---------- Gruppe B: _storeRunsByDay Session-Identität ---------- */
{
  const am = run('2026-07-16', 5, 'am', '07');
  const pm = run('2026-07-16', 5, 'pm', '18');
  const sB = mk('2026-07-18', { storeRuns: [am, pm], DB: {} });
  const dayEntry = sB._storeRunsByDay()['2026-07-16'];
  ok('[B1] Tagessumme = 10 km (2×5 km, für Wochenumfang)', dayEntry && dayEntry.dist === 10, 'dist=' + (dayEntry && dayEntry.dist));
  ok('[B2] PFLICHT-GEGENBEISPIEL: längste Einzelsession bleibt 5 km (keine künstliche 10-km-Long-Run-Session)', dayEntry && dayEntry.longestKm === 5, 'longestKm=' + (dayEntry && dayEntry.longestKm));
  ok('[B3] sessionCount = 2 (Sitzungsidentität sichtbar, nicht verschmolzen)', dayEntry && dayEntry.sessionCount === 2, 'sessionCount=' + (dayEntry && dayEntry.sessionCount));

  const sB4 = mk('2026-07-18', { storeRuns: [run('2026-07-16', 8, 'solo')], DB: {} });
  const d4 = sB4._storeRunsByDay()['2026-07-16'];
  ok('[B4] Einzellauf: dist=longestKm=8, sessionCount=1 (Regression)', d4 && d4.dist === 8 && d4.longestKm === 8 && d4.sessionCount === 1, JSON.stringify(d4));

  const rw = sB.runsWindow(7);
  const totalWeek = rw.reduce((s, r) => s + (r.dist || 0), 0);
  ok('[B5] Wochenvolumen über runsWindow(7) bleibt korrekt bei 10 km trotz getrennter Sessions', totalWeek === 10, 'total=' + totalWeek);

  const sB6 = mk('2026-07-18', { storeRuns: [run('2026-07-16', 8, 'solo')], DB: { '2026-07-16': { sessions: { Laufen: { sub: 'Tempo', dist: 7, dur: 33 } } } } });
  const rw6 = sB6.runsWindow(7).find(r => r.date === '2026-07-16');
  ok('[B6] Dedupe Store↔Legacy weiterhin erhalten: Blob-Session gewinnt am selben Tag (7 km statt Store 8 km)', rw6 && rw6.dist === 7 && rw6.sub === 'Tempo', JSON.stringify(rw6));
}

/* ---------- Gruppe C: renderRamp — kein falsches 0%/0km bei Unbekannt ---------- */
{
  const rampBlock = slice(uiSrc, 'function renderRamp(){', 'function recommendedRunVolume(){');
  function mkRamp(vals) {
    const sb = {}; sb.window = sb; sb.globalThis = sb; sb.Math = Math;
    const els = { rampBox: { innerHTML: '' } };
    sb.document = { getElementById: id => els[id] || null };
    sb.daysTo = () => 60;
    sb.RACE = { date: '2026-10-01' };
    sb.Calc = { weekKmTarget: (d, i) => Math.max(0, 40 - i * 2), effectiveKmTarget: (cal, last3) => Math.min(cal, Math.round(1.10 * Math.max(...last3, 0))) };
    sb.fmtDe = n => (n == null || isNaN(n)) ? '–' : String(n);
    sb.weekRunKm = off => vals[off];
    vm.createContext(sb);
    vm.runInContext(rampBlock, sb, { filename: 'ui.js#ramp' });
    sb.renderRamp();
    return els.rampBox.innerHTML;
  }
  const htmlUnknown = mkRamp([null, 10, 10, 10]);
  ok('[C1] Rampe zeigt "nicht bestimmbar" statt Absturz/falscher 0%-Zahl, wenn Wochen-km unbekannt', /nicht bestimmbar/.test(htmlUnknown) && !/goalbar/.test(htmlUnknown), htmlUnknown.slice(0, 90));
  const htmlKnown = mkRamp([12, 10, 11, 9]);
  /* E2 (v5): Normal-Render-Marker ist jetzt die wkv5-Karte; goalbar bleibt für Altstände gültig. Intent unverändert. */
  ok('[C2] Rampe rendert normal (Regression), wenn alle Wochen-km bekannt sind', /goalbar|wkv5-bar/.test(htmlKnown) && !/nicht bestimmbar/.test(htmlKnown), htmlKnown.slice(0, 60));
}

/* ---------- Gruppe D: baselineRows (intelligence.js) — kein Crash/falsche 0 ---------- */
{
  const intelBlock = slice(intelSrc, 'function intelCtx(', 'function renderBaselines(){');
  function mkBaseline(wk) {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.dataDays = () => 10;
    sb.recoveryCtx = () => ({});
    sb.activeModuleKeys = () => [];
    sb.issueScore = () => null;
    sb.readinessOf = () => null;
    sb.currentDecision = () => null;
    sb.todayStr = () => '2026-07-18';
    sb.cur = '2026-07-18';
    sb.DB = {};
    sb.RACE = { date: '2026-10-01' };
    sb.daysTo = () => 60;
    sb.Calc = { weekKmTarget: () => 40 };
    sb.weekRunKm = () => wk;
    sb.ORVIA_MODULES = {};
    vm.createContext(sb);
    vm.runInContext(intelBlock, sb, { filename: 'intelligence.js#baseline' });
    return sb.baselineRows();
  }
  const rowsUnknown = mkBaseline(null);
  const kmRowU = rowsUnknown.find(r => r[0] === 'Wochen-km');
  ok('[D1] Wochen-km-Zeile zeigt "–" statt Absturz/falsche 0, wenn weekRunKm unbekannt', kmRowU && kmRowU[1].indexOf('–') === 0, JSON.stringify(kmRowU));
  const rowsKnown = mkBaseline(15);
  const kmRowK = rowsKnown.find(r => r[0] === 'Wochen-km');
  ok('[D2] Wochen-km-Zeile zeigt reale Zahl, wenn bekannt (Regression)', kmRowK && kmRowK[1].indexOf('15') === 0, JSON.stringify(kmRowK));
}

/* ---------- Gruppe E: buildAIReview/weekSummaryText — kein "null km gelaufen" ---------- */
{
  const reviewBlock = slice(uiSrc, 'function buildAIReview(){', 'function copyAIReview(){');
  function mkReview(wkNow, wkPrev) {
    const sb = {}; sb.window = sb; sb.globalThis = sb; sb.Math = Math; sb.JSON = JSON;
    sb.DB = {};
    sb.todayStr = () => '2026-07-18';
    sb.dkey = off => '2026-07-' + (18 + off);
    sb.PROFILE = { name: 'Test' };
    sb.RACE = { date: '2026-10-01' };
    sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-10-01' });
    sb.RACE_LABELS_P = { half_marathon: 'Halbmarathon' };
    sb.daysTo = () => 60;
    sb.buildGoal = () => ({ state: 'ontrack', tPred: 6000, target: 6300, vetos: [], nQuality: 5 });
    sb.runsWindow = () => [];
    sb.weekRunKm = off => off === 0 ? wkNow : wkPrev;
    sb.Calc = {
      easyShare: () => null,
      weeklyJump: (a, b) => ({ lvl: 'g', ratio: a / Math.max(b, 5), msg: null }),
      loadModel: () => null,
      weekKmTarget: () => 40,
      fmtTime: s => s + 's',
      avg: arr => arr.reduce((s, x) => s + x, 0) / arr.length
    };
    sb.readinessFor = () => ({ score: 80 });
    sb.allLoads = () => ({ loads: [], labels: [] });
    sb.isNaN = isNaN;
    vm.createContext(sb);
    vm.runInContext(reviewBlock, sb, { filename: 'ui.js#review' });
    return sb;
  }
  const r1 = mkReview(null, null);
  const rev1 = r1.buildAIReview();
  ok('[E1] wochenKm.aktuell === null (nicht 0), wenn weekRunKm unbekannt', rev1.wochenKm.aktuell === null, 'ist=' + rev1.wochenKm.aktuell);
  const txt1 = r1.weekSummaryText();
  ok('[E2] Wochenzusammenfassung zeigt "nicht bestimmbar", NIE "null km gelaufen"', txt1.indexOf('nicht bestimmbar') >= 0 && txt1.indexOf('null km') < 0, txt1.split('\n')[0]);

  const r2 = mkReview(10, 8);
  const rev2 = r2.buildAIReview();
  ok('[E3] wochenKm.aktuell bleibt korrekte Zahl (Regression), wenn Daten vorhanden', rev2.wochenKm.aktuell === 10, 'ist=' + rev2.wochenKm.aktuell);
}

/* ---------- Gruppe F: forecastCauses (extras.js) — kein Fehlalarm aus fabrizierter 0 ---------- */
{
  const fcBlock = slice(extrasSrc, 'function forecastCauses(){', 'function renderForecast(){');
  function mkForecast(wk, wp) {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.DB = {};
    sb.isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
    sb.Calc = { avg: arr => arr.reduce((s, x) => s + x, 0) / arr.length };
    sb.weekRunKm = off => off === 0 ? wk : wp;
    vm.createContext(sb);
    vm.runInContext(fcBlock, sb, { filename: 'extras.js#forecast' });
    return sb.forecastCauses();
  }
  const c1 = mkForecast(null, null);
  ok('[F1] Kein "Umfang gesunken"-Fehlalarm, wenn Wochen-km unbekannt (keine fabrizierte 0)', !c1.some(x => /umfang.*gesunken/i.test(x)), JSON.stringify(c1));
  const c2 = mkForecast(3, 10);
  ok('[F2] "Umfang gesunken" feuert weiterhin bei echtem Rückgang (Regression)', c2.some(x => /umfang.*gesunken/i.test(x)), JSON.stringify(c2));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('I2b: ' + (fail === 0 ? 'GRÜN — weekRunKm/​_storeRunsByDay: kein falsches 0, Session-Identität erhalten, Anzeigen null-sicher.' : 'ROT — ' + fail + ' offen (erwartet vor dem Fix).'));
