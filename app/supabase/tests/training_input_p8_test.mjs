/* ============================================================
   ORVIA · Phase 8 — TrainingInputResolver + Vorbedingungs-Fixes
   Verträge:
   - Vorbedingung (a): der v2-Input verwendet die ECHTEN Vertragsfelder
     (soreness, rhrBaseline+rhrBaselineDays, hrvBaselineLn+hrvSd28+
     hrvBaselineDays, hrvStatus, sleepGoalHours); safetyFlags ist ein
     OBJEKT; das Phantom-Feld m.pain ist entfernt; illness liest das
     kanonische Feld (mit ill-Alias).
   - Vorbedingung (b): readiness-store persistiert den Calc.readiness-Score
     ehrlich als engine_version 'v1' (online UND offline); Migration 0023
     etikettiert Altzeilen um.
   - Phase 8: trainingInputResolver.mergeObjective (Check-in > Metric Store,
     Frische-Regeln aus checkin-field-resolver), buildReadinessInput/
     buildDecisionInput (pure, exakter v2-Vertrag), collect() (Globals),
     Shadow-Runner delegiert vollständig.
   Methodik: echte Module in vm (readiness-engine-v2, decision-engine-v2,
   engine-contracts, checkin-field-resolver, training-input-resolver,
   shadow-runner, readiness-store); ui.js-recoveryCtx als Funktions-Slice.
   node supabase/tests/training_input_p8_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const read = f => readFileSync(new URL(f, base), 'utf8');
const TODAY = '2026-07-17';

function slice(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker), e = src.indexOf(endMarker);
  if (s < 0 || e < 0 || e <= s) throw new Error('Funktionsgrenzen nicht gefunden: ' + startMarker + ' … ' + endMarker);
  return src.slice(s, e);
}

/* ---------- Sandbox: Engine-Stack + Resolver (echte Module) ---------- */
function makeSb(opts) {
  opts = opts || {};
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
  sb.String = String; sb.Number = Number; sb.Promise = Promise; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.localStorage = (function () { const st = {}; return { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } }; })();
  sb.todayStr = d => {
    const x = d || new Date(TODAY + 'T12:00');
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };
  sb.DB = opts.DB || {};
  sb.PROFILE = opts.PROFILE || {};
  sb.Calc = opts.Calc || { sessionLoad: () => 0 };
  sb.ORVIA = {};
  vm.createContext(sb);
  ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js',
    'checkin-field-resolver.js', 'engine/training-input-resolver.js'].forEach(f =>
    vm.runInContext(read(f), sb, { filename: f }));
  if (opts.stash) sb._metricsResolved = opts.stash;
  if (opts.profileStore) sb.ORVIA.profileStore = opts.profileStore;
  if (opts.loadShadow) vm.runInContext(read('engine/shadow-runner.js'), sb, { filename: 'shadow-runner.js' });
  return sb;
}
const freshMetric = (v, extra) => Object.assign({ value: v, source: 'automatic', stale: false, metricDate: TODAY, measuredAt: TODAY + 'T06:30:00Z' }, extra || {});
function sb2CF() {
  const sb = {}; sb.window = sb; sb.globalThis = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(read('checkin-fields.js'), sb, { filename: 'checkin-fields.js' });
  return sb.ORVIA.checkinFields;
}

/* ---------- A) Pure-Kern: mergeObjective / buildReadinessInput / buildDecisionInput ---------- */
{
  const sb = makeSb();
  const R = sb.ORVIA.trainingInputResolver;
  const autoMap = { rhr: { value: 48 }, hrvMs: { value: 62 }, bb: { value: 71 } };
  const m1 = R.mergeObjective({ rhr: 52, sleepMin: 430 }, autoMap);
  ok('A1 Check-in-Wert gewinnt über Metric Store', m1.values.rhr === 52 && m1.provenance.rhr === 'checkin');
  ok('A2 Metric-Store-Fallback ohne Check-in-Wert', m1.values.hrvMs === 62 && m1.provenance.hrvMs === 'metric_store' && m1.values.bb === 71);
  ok('A3 weder Check-in noch Store ⇒ ehrlich null', m1.values.hrv === null && m1.provenance.hrv === null);

  const ctx = { rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 };
  const ri = R.buildReadinessInput({ morning: { sleepMin: 420, sleepQ: 7, feel: 8, doms: 3, stress: 'Low', rhr: 50, hrvMs: 58, bb: 66 }, ctx: ctx, sleepGoalHours: 8 });
  ok('A4 v2-Vertragsfelder exakt belegt (soreness statt doms, rhrBaseline+Days, hrvBaselineLn/Sd28/Days)',
    ri.soreness === 3 && ri.rhrBaseline === 48 && ri.rhrBaselineDays === 14 &&
    ri.hrvBaselineLn === ctx.hrvBase7 && ri.hrvSd28 === 0.06 && ri.hrvBaselineDays === 20 &&
    ri.sleepGoalHours === 8 && ri.sleepMinutes === 420 && ri.restingHr === 50, JSON.stringify(ri));
  ok('A5 alte Phantom-Feldnamen kommen im Input NICHT vor',
    !('doms' in ri) && !('restingHrBaseline' in ri) && !('hrvBaselineLn7' in ri));

  const di = R.buildDecisionInput({ morning: { illness: true }, readiness: { score: 80, confidence: 'high', warnings: [], missingData: [] } });
  ok('A6 safetyFlags ist ein Objekt (v2-Vertrag), kein Array', typeof di.safetyFlags === 'object' && !Array.isArray(di.safetyFlags));
  ok('A7 illness aus kanonischem Feld', di.illness === true);
  const di2 = R.buildDecisionInput({ morning: { ill: true } });
  ok('A8 ill-Alias (Altdaten) funktioniert weiter', di2.illness === true);
  const di3 = R.buildDecisionInput({});
  ok('A9 Defaults vollständig (kein Feld undefined)', di3.plannedSession === null && di3.availabilityToday === null &&
    di3.recentLoad.dataDays === 0 && Array.isArray(di3.constraints) && di3.goalContext.daysToEvent === null);
}

/* ---------- B) Behavioral: die vorher toten v2-Faktoren rechnen jetzt ---------- */
{
  const sb = makeSb();
  const R = sb.ORVIA.trainingInputResolver;
  const E = sb.ORVIA.readinessEngineV2;
  const CT = sb.ORVIA.engineContracts;
  const ctx = { rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 };
  const morning = { sleepMin: 420, sleepQ: 7, feel: 8, doms: 3, stress: 'Low', rhr: 50, hrvMs: 58, bb: 66 };
  const r = E.evaluate(R.buildReadinessInput({ morning, ctx, sleepGoalHours: 8 }));
  const byId = {}; r.factors.forEach(f => { byId[f.id] = f.value; });
  ok('B1 soreness-Faktor rechnet (vorher via doms IMMER null)', byId.soreness === 70 && r.missingData.indexOf('soreness') < 0, 'soreness=' + byId.soreness);
  ok('B2 resting_hr-Faktor rechnet gegen Baseline (vorher restingHrBaseline ⇒ null)', byId.resting_hr != null && r.missingData.indexOf('resting_hr') < 0, 'resting_hr=' + byId.resting_hr);
  ok('B3 hrv-Faktor rechnet gegen ln-Baseline (vorher hrvBaselineLn7 ⇒ null)', byId.hrv != null && r.missingData.indexOf('hrv') < 0, 'hrv=' + byId.hrv);
  ok('B4 keine missing_baseline-Warnung bei vorhandener Baseline', !r.warnings.some(w => w.code === 'missing_baseline'));
  ok('B5 Ergebnis erfüllt isReadinessResult', CT.isReadinessResult(r));
  ok('B6 voller Input ⇒ score vorhanden, missingData leer', r.score != null && r.missingData.length === 0, 'score=' + r.score);

  // Schlafziel wirkt: 7 h Schlaf sind bei Ziel 9 h schlechter als bei Ziel 7 h.
  const s7 = E.evaluate(R.buildReadinessInput({ morning: { sleepMin: 420, sleepQ: 7 }, ctx: {}, sleepGoalHours: 7 }));
  const s9 = E.evaluate(R.buildReadinessInput({ morning: { sleepMin: 420, sleepQ: 7 }, ctx: {}, sleepGoalHours: 9 }));
  const f7 = s7.factors.find(f => f.id === 'sleep_duration').value, f9 = s9.factors.find(f => f.id === 'sleep_duration').value;
  ok('B7 sleepGoalHours wird durchgereicht (Score reagiert aufs Ziel)', f7 === 100 && f9 < f7, f7 + ' vs ' + f9);

  // Ohne Baseline: ehrlich missing_baseline statt raten (Bestandsverhalten der Engine).
  const nb = E.evaluate(R.buildReadinessInput({ morning: { rhr: 50, hrvMs: 58, sleepQ: 7 }, ctx: {}, sleepGoalHours: 8 }));
  ok('B8 ohne Baseline ⇒ missing_baseline-Warnungen, Faktoren null', nb.warnings.filter(w => w.code === 'missing_baseline').length === 2 &&
    nb.factors.find(f => f.id === 'resting_hr').value === null);
}

/* ---------- C) Metric-Store-Fallback (autoMapFromStash, Frische-Regeln) ---------- */
{
  const stash = { date: TODAY, resolved: {
    resting_hr: freshMetric(49),
    sleep_duration_min: freshMetric(432),
    hrv_status: freshMetric(null, { valueText: 'balanced' }),
    body_battery: freshMetric(77, { metricDate: TODAY }),
    hrv_ms: freshMetric(61, { metricDate: '2026-07-10' })   // 7 Tage alt > autoMaxAgeDays ⇒ raus
  } };
  const sb = makeSb({ stash });
  const R = sb.ORVIA.trainingInputResolver;
  // Registry-Gleichstand: Resolver-Felddefinitionen == checkin-fields (SSOT-Schutz).
  {
    const CF = sb2CF();
    const same = R.OBJECTIVE_FIELDS.every(f => {
      const g = CF.byKey(CF.MORNING, f.key);
      return g && g.metricId === f.metricId && (g.autoMaxAgeDays || 0) === (f.autoMaxAgeDays || 0);
    });
    ok('C0 OBJECTIVE_FIELDS deckungsgleich mit checkin-fields (metricId + autoMaxAgeDays)', same);
  }
  const a = R.autoMapFromStash(TODAY);
  ok('C1 frische automatische Werte kommen aus dem Stash', a && a.rhr.value === 49 && a.sleepMin.value === 432 && a.bb.value === 77);
  ok('C2 hrv_status-Text wird auf Chip-Wert gemappt', a.hrv && a.hrv.value === 'Balanced');
  ok('C3 zu alter Wert (hrv_ms, 7 Tage) ersetzt nichts', !a.hrvMs);
  ok('C4 alter Stash (anderes Datum) wird ignoriert', R.autoMapFromStash('2026-07-18') === null);

  // Ohne Morgen-Check-in speist der Store die Engine trotzdem (Kernziel Phase 8).
  const ri = R.buildReadinessInput({ morning: null, autoMap: a, ctx: { rhrBase: 48, rhrN: 14 }, sleepGoalHours: 8 });
  ok('C5 ohne Check-in: objektive Werte aus dem Store, Provenienz metric_store',
    ri.restingHr === 49 && ri.sleepMinutes === 432 && ri._provenance.rhr === 'metric_store');
  ok('C6 subjektive Felder bleiben ohne Check-in ehrlich null', ri.feel === null && ri.soreness === null && ri.sleepQuality === null);
  const r = sb.ORVIA.readinessEngineV2.evaluate(ri);
  ok('C7 Engine liefert Score aus reinen Garmin-Werten (>=2 Faktoren)', r.score != null && r.missingData.indexOf('feel') >= 0, 'score=' + r.score);

  // Stale-Regel: suspecte/stale Resolver-Ergebnisse ersetzen nie.
  const sb2 = makeSb({ stash: { date: TODAY, resolved: { resting_hr: freshMetric(49, { stale: true }) } } });
  const a2 = sb2.ORVIA.trainingInputResolver.autoMapFromStash(TODAY);
  ok('C8 stale-Wert ersetzt nichts (Fallback bleibt Frage/null)', !a2.rhr);
  const sb3 = makeSb({ stash: { date: TODAY, resolved: { resting_hr: freshMetric(49, { source: 'manual' }) } } });
  ok('C9 manuelle Quelle ersetzt nichts (nur automatic/override)', !sb3.ORVIA.trainingInputResolver.autoMapFromStash(TODAY).rhr);
}

/* ---------- D) Shadow-Runner: vollständige Delegation + Decision-Integration ---------- */
{
  const DB = {}; DB[TODAY] = { morning: { sleepMin: 420, sleepQ: 7, feel: 8, doms: 3, stress: 'Low', rhr: 50, hrvMs: 58, bb: 66, illness: true } };
  const sb = makeSb({ DB, loadShadow: true, profileStore: { effectiveSleepGoal: () => 8 } });
  sb.recoveryCtx = () => ({ rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 });
  const input = sb.ORVIA.engineShadow.buildInput();
  ok('D1 buildInput delegiert an den Resolver (safetyFlags-Objekt, readiness gerechnet)',
    typeof input.safetyFlags === 'object' && !Array.isArray(input.safetyFlags) && input.readiness.score != null);
  ok('D2 illness erreicht die Decision-Engine', input.illness === true);
  const v2 = sb.ORVIA.decisionEngineV2.evaluate(input);
  ok('D3 Decision-Ergebnis erfüllt den v2-Vertrag (isDecisionResult)', sb.ORVIA.engineContracts.isDecisionResult(v2));
  ok('D4 Krankheit eskaliert korrekt (mind. ORANGE, keine harte Einheit)',
    (v2.dayState === 'ORANGE' || v2.dayState === 'RED') && v2.reasons.some(r => r.code === 'illness'));

  /* Batch 0 — FAIL CLOSED: Ohne Resolver gibt es KEINEN Ersatz-Input mehr.
     Der frühere Leer-Fallback (illness:false, safetyFlags:{}) verwandelte
     Krankheit/Red Flags in scheinbar sicheres GREEN (Regression S6–S8).
     Neuer Vertrag: buildInput() ⇒ null, run() ⇒ BLOCKED-Eintrag ohne
     v2-Bewertung (engine_program_e_test F1–F4 deckt run()/report() ab). */
  const sb2 = makeSb({ DB });
  vm.runInContext(read('engine/shadow-runner.js'), sb2, { filename: 'shadow-runner.js' });
  sb2.ORVIA.trainingInputResolver = null;
  const fb = sb2.ORVIA.engineShadow.buildInput();
  ok('D5 ohne Resolver: buildInput ⇒ null (fail closed, kein optimistischer Ersatz-Input)', fb === null);
  const be = sb2.ORVIA.engineShadow.run();
  ok('D6 ohne Resolver: run() ⇒ BLOCKED-Eintrag, keine v2-Bewertung (nie GREEN raten)',
    !!be && be.v2.state === null && be.v2.blocked === 'training_input_resolver_missing' && be.agree === null);

  // run(): kompletter Shadow-Lauf schreibt einen Tageseintrag.
  const entry = sb.ORVIA.engineShadow.run();
  ok('D7 Shadow-Lauf protokolliert (Datum, v2-State, agree-Feld)', entry && entry.date === sb.todayStr() && entry.v2.state != null && 'agree' in entry);
}

/* ---------- E) readiness-store: ehrliches Engine-Label v1 ---------- */
{
  const mk = (online) => {
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.console = { log() {}, warn() {}, error() {} };
    sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.Promise = Promise;
    sb.ORVIA = { user: { id: 'u1' }, repoBase: { online: () => online },
      repos: { readiness: { saved: null, async saveScore(date, score, comps) { this.saved = { date, score, comps }; return { success: true, data: { id: 'x' }, source: 'supabase', sync_status: 'synced' }; } } },
      offlineQueue: { row: null, async enqueue(t, row, k) { this.row = row; this.key = k; return { success: true }; } } };
    vm.createContext(sb);
    vm.runInContext(read('readiness-store.js'), sb, { filename: 'readiness-store.js' });
    return sb;
  };
  const on = mk(true);
  await on.ORVIA.readinessStore.persistForDay(TODAY, { score: 71, parts: [] }, {}, {});
  ok('E1 online: saveScore erhält engine \'v1\' (Calc.readiness ist v1)', on.ORVIA.repos.readiness.saved.score.engine === 'v1', JSON.stringify(on.ORVIA.repos.readiness.saved.score));
  const off = mk(false);
  await off.ORVIA.readinessStore.persistForDay(TODAY, { score: 71, parts: [] }, {}, {});
  ok('E2 offline: gequeute Zeile trägt engine_version \'v1\'', off.ORVIA.offlineQueue.row.engine_version === 'v1');
  ok('E3 offline: Konfliktschlüssel unverändert (user_id,local_date,engine_version)', off.ORVIA.offlineQueue.key === 'user_id,local_date,engine_version');
}

/* ---------- F) recoveryCtx liefert rhrN (echter ui.js-Slice) ---------- */
{
  const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
  const ctxBlock = slice(uiSrc, 'function recoveryCtx', 'function readinessFor');
  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.Date = Date; sb.Math = Math;
  sb.todayStr = d => { const x = d || new Date(TODAY + 'T12:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.Calc = { avg: a => a.reduce((s, v) => s + v, 0) / a.length, sd: () => 0.05, median: a => a.slice().sort((p, q) => p - q)[a.length >> 1], sleepDebt: () => 0, hrvScoreOf: () => 60 };
  sb.DB = {};
  for (let i = 1; i <= 10; i++) {
    const d = new Date(TODAY + 'T12:00'); d.setDate(d.getDate() - i);
    sb.DB[sb.todayStr(d)] = { morning: { rhr: 47 + (i % 3), hrvMs: 60, sleepMin: 430 } };
  }
  vm.createContext(sb);
  vm.runInContext(ctxBlock, sb, { filename: 'ui.js#recoveryCtx' });
  const c = sb.recoveryCtx(TODAY);
  ok('F1 recoveryCtx liefert rhrN (Datenpunkt-Zähler für rhrBaselineDays)', c.rhrN === 10 && c.rhrBase != null, JSON.stringify({ rhrN: c.rhrN, rhrBase: c.rhrBase }));
}

/* ---------- W) Verdrahtung ---------- */
{
  const html = readFileSync(new URL('../index.html', base), 'utf8');
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  const shadowSrc = read('engine/shadow-runner.js');
  const iRes = html.indexOf('js/engine/training-input-resolver.js');
  const iShadow = html.indexOf('js/engine/shadow-runner.js');
  ok('W1 index.html lädt den Resolver VOR dem Shadow-Runner', iRes > 0 && iShadow > iRes);
  ok('W2 sw.js-ASSETS enthalten training-input-resolver.js', sw.indexOf('./js/engine/training-input-resolver.js') > 0);
  const vMatch = /orvia-v8-(\d+)/.exec(sw);
  ok('W3 SW-Version >= v8-193 (Cache-Bust für Phase 8)', vMatch && parseInt(vMatch[1], 10) >= 193, vMatch && vMatch[0]);
  const mig = readFileSync(new URL('../supabase/migrations/0023_readiness_engine_version_fix.sql', base), 'utf8');
  ok('W4 Migration 0023 etikettiert v2-Altzeilen auf v1 um', /engine_version\s*=\s*'v1'/.test(mig) && /engine_version\s*=\s*'v2'/.test(mig));
  // Nur CODE prüfen — der Header-Kommentar DOKUMENTIERT die alten Namen bewusst.
  const shadowCode = shadowSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('W5 Phantom-Felder aus dem Shadow-Runner-CODE entfernt (m.pain, restingHrBaseline, hrvBaselineLn7)',
    shadowCode.indexOf('m.pain') < 0 && shadowCode.indexOf('restingHrBaseline') < 0 && shadowCode.indexOf('hrvBaselineLn7') < 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
if (fail) process.exit(1);
