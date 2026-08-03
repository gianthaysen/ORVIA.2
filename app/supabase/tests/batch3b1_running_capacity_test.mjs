/* ============================================================
   ORVIA · Batch 3b.1 / Härtung 3b.1a — Running-Capacity-Factory (SHADOW-only).
   Golden/Property/Negativ/Fuzz. node supabase/tests/batch3b1_running_capacity_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');

const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.console = { log() {}, warn() {}, error() {} };
sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object; sb.Array = Array;
sb.String = String; sb.Number = Number; sb.Intl = Intl; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.RegExp = RegExp; sb.Error = Error;
sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.Infinity = Infinity; sb.NaN = NaN;
vm.createContext(sb);
['training-domain.js', 'activity-normalize.js', 'activity-config.js', 'engine/engine-contracts.js', 'engine/readiness-engine-v2.js',
  'engine/decision-engine-v2.js', 'checkin-field-resolver.js', 'engine/training-input-resolver.js',
  'engine/knowledge/knowledge-contracts.js', 'engine/knowledge/knowledge-sources.js',
  'engine/knowledge/running-knowledge-pack.js', 'engine/running-capacity-factory.js'].forEach(f =>
  vm.runInContext(src(f), sb, { filename: f }));
const RC = sb.ORVIA.runningCapacityFactory;
const R = sb.ORVIA.trainingInputResolver;
const AC = sb.ORVIA.activityConfig;
const KC = sb.ORVIA.knowledgeContracts;
const KS = sb.ORVIA.knowledgeSources;
const RP = sb.ORVIA.runningKnowledgePack;
const clone = o => JSON.parse(JSON.stringify(o));
const ALLOWED_STATUS = ['ready', 'partial', 'unknown', 'blocked'];

const NOW = Date.parse('2026-07-15T08:00:00Z');
const TODAY = '2026-07-15';
/* Producer-getreue Fixture-Builder (spiegeln training-input-resolver.recentLoad/winConf).
   Ein Fenster: activeLoadDays, measuredLoad, estimatedLoad, unknownUnits, ambiguousUnits,
   estimatedShare (= round(estimatedLoad/(measured+estimated),2)). */
function win(activeLoadDays, measuredLoad, o) {
  o = o || {};
  var el = o.estimatedLoad || 0, uu = o.unknownUnits || 0, au = o.ambiguousUnits || 0;
  var tot = measuredLoad + el; var es = tot > 0 ? Math.round((el / tot) * 100) / 100 : 0;
  return { activeLoadDays: activeLoadDays, measuredLoad: measuredLoad, estimatedLoad: el, unknownUnits: uu, ambiguousUnits: au, estimatedShare: es };
}
function winConf(w) {
  var tot = w.measuredLoad + w.estimatedLoad; var es = tot > 0 ? w.estimatedLoad / tot : 0;
  if (w.ambiguousUnits > 0 || w.unknownUnits > 0 || es > 0.5) return 'low';
  if (es > 0.25) return 'medium';
  return 'high';
}
// Kohärentes quality-Objekt aus acute7- und prior21-Fenstern (chronic28 = Summe).
function qualityOf(a7, p21, span) {
  var c28 = win(a7.activeLoadDays + p21.activeLoadDays, a7.measuredLoad + p21.measuredLoad,
    { estimatedLoad: a7.estimatedLoad + p21.estimatedLoad, unknownUnits: a7.unknownUnits + p21.unknownUnits, ambiguousUnits: a7.ambiguousUnits + p21.ambiguousUnits });
  var ich = (p21.activeLoadDays < 4 || span < 14);
  var ca = winConf(a7), cp = winConf(p21), cc = winConf(c28);
  var ORDER = { high: 0, medium: 1, low: 2 };
  var worst = [ca, cp, cc].reduce(function (w, x) { return ORDER[x] > ORDER[w] ? x : w; }, 'high');
  return {
    acute7: a7, prior21: p21, chronic28: c28,
    acuteConfidence: ca, priorConfidence: cp, chronicConfidence: cc,
    historySpanDays: span, insufficientChronicHistory: ich, ratioConfidence: ich ? 'low' : worst
  };
}
// recentLoad aus einem quality-Objekt (top-level Felder producer-getreu abgeleitet).
function loadFrom(q, over) {
  // Top-Level-Last PRODUCER-GETREU aus den Quality-Fenstern; keine Unknowns ⇒ dataDays === chronic28.activeLoadDays.
  return Object.assign({
    acute7: Math.round(q.acute7.measuredLoad + q.acute7.estimatedLoad),
    chronic28PerWeek: Math.round((q.chronic28.measuredLoad + q.chronic28.estimatedLoad) / 4),
    dataDays: q.chronic28.activeLoadDays,
    loadUnit: 'orvia_load_au', hardYesterday: false, hardStreak: 1,
    estimatedShare: q.acute7.estimatedShare, unknownUnits: q.acute7.unknownUnits, ambiguousUnits: q.acute7.ambiguousUnits,
    quality: q, ratioConfidence: q.ratioConfidence, loadConfidence: q.ratioConfidence, source: 'canonical_activities'
  }, over || {});
}
// Real möglicher „Good"-Zustand: dataDays 13 = activeLoadDays 13, unknownUnits 0, span 28.
// acute7 350 (7-Tage-Summe), chronic28PerWeek 300 (Wochenmittel) ⇒ Band 300–350.
function goodLoad(over) {
  var q = qualityOf(win(4, 350), win(9, 850), 28);   // alle gemessen ⇒ high; ich false ⇒ ratioConfidence high
  return Object.assign(loadFrom(q), over || {});
}
function snap(over) {
  over = over || {};
  return R.buildSnapshot(Object.assign({
    now: NOW, timezone: 'Europe/Vienna', today: TODAY,
    morning: { sleepMin: 432, sleepQ: 7, feel: 8, doms: 2, stress: 'Low', ill: false, redFlags: {} },
    ctx: { rhrBase: 48, rhrN: 14, hrvBase7: Math.log(60), hrvSd28: 0.06, hrvN: 20 },
    sleepGoalHours: 8,
    recentLoad: goodLoad(over.load)
  }, over.raw || {}));
}
// 12,41-km-Long-Run aus 3 Segmenten (Batch-2-Gruppierung).
const gianActs = [
  { clientRecordId: 'a1', sportId: 'run', startedAt: '2026-07-12T07:30:00Z', durationSeconds: 1860, summary: { distanceKm: 5.2 } },
  { clientRecordId: 'a2', sportId: 'run', startedAt: '2026-07-12T08:03:00Z', durationSeconds: 1500, summary: { distanceKm: 4.0 } },
  { clientRecordId: 'a3', sportId: 'run', startedAt: '2026-07-12T08:30:00Z', durationSeconds: 1260, summary: { distanceKm: 3.21 } }
];
const evidence = RC.evidenceFromActivities(gianActs, { groupSessions: AC.groupActivitySessions, sportId: 'running' });
// Direkt-injizierbare, schema-getaggte Evidenz für Zeit-/Vertragstests.
function mkEv(over) {
  return { longestGroupedSession: Object.assign({
    schema: RC.EVIDENCE_SCHEMA, sportId: 'running', groupId: 'grp:a1',
    startedAt: '2026-07-12T07:30:00Z', distanceKm: 12.41, segments: 3, activityRefs: ['a1', 'a2', 'a3']
  }, over || {}) };
}

/* ---------- A: Reinheit / Determinismus ---------- */
{
  const raw = src('engine/running-capacity-factory.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('A1 Quelle ohne DOM/Storage/Netz/UI/eigene Zeitquelle',
    !/\bdocument\./.test(raw) && !/\blocalStorage\b/.test(raw) && !/\bfetch\s*\(/.test(raw) &&
    !/Date\.now\s*\(/.test(raw) && !/Math\.random\s*\(/.test(raw) && !/new Date\(\s*\)/.test(raw) &&
    !/innerHTML|querySelector|addEventListener/.test(raw));
  const s = snap({});
  const before = JSON.stringify(s);
  const r1 = RC.buildRunningCapacity(s, { evidence: evidence });
  const r2 = RC.buildRunningCapacity(s, { evidence: evidence });
  ok('A2 deterministisch/idempotent: identischer Snapshot ⇒ byte-stabiles Ergebnis', JSON.stringify(r1) === JSON.stringify(r2));
  ok('A3 nicht mutierend: Snapshot unverändert', JSON.stringify(s) === before);
  r1.status = 'HACK'; if (r1.capacity) r1.capacity.historyReliability = 'HACK';
  const r3 = RC.buildRunningCapacity(s, { evidence: evidence });
  ok('A4 Rückgabe entkoppelt: Mutation des Ergebnisses beeinflusst Folgeaufruf nicht (frisch pro Aufruf)',
    r3.status !== 'HACK' && r3.capacity.historyReliability !== 'HACK' && JSON.stringify(r3) === JSON.stringify(r2));
}

/* ---------- B: Wissenskonsum / Shadow / Pins ---------- */
{
  const r = RC.buildRunningCapacity(snap({}), { evidence: evidence });
  ok('B1 nur 12 SHADOW-Regeln konsumiert; RUN-SAFE-001 + RUN-RTR-001 ausgeschlossen',
    r.usedRuleIds.length === 12 && r.usedRuleIds.indexOf('RUN-SAFE-001') < 0 && r.usedRuleIds.indexOf('RUN-RTR-001') < 0 &&
    r.excludedRuleIds.indexOf('RUN-SAFE-001') >= 0 && r.excludedRuleIds.indexOf('RUN-RTR-001') >= 0);
  ok('B2 Ergebnis trägt exakt die festen Consumer-Pins (mode shadow, Contract 5, kb-run-v3.0.0)',
    r.mode === 'shadow' && r.pins.expectedKnowledgeContractVersion === 5 && r.pins.expectedKnowledgeVersion === 'kb-run-v3.0.0' &&
    r.pins.expectedSourceRegistryVersion === 2 && /^fnv1a-/.test(r.pins.expectedPackContentHash) && /^fnv1a-/.test(r.pins.expectedSourceRegistryHash));
  ok('B2b hinterlegte Pins passen zum aktuellen Pack/Register (Consumer-Stand aktuell)',
    r.pins.expectedPackContentHash === KC.packContentHash(RP) && r.pins.expectedSourceRegistryHash === KC.registryContentHash(KS));
  ok('B3 deterministischer Rule-Trace vorhanden', Array.isArray(r.ruleTrace) && r.ruleTrace.length >= 2 && r.ruleTrace.some(t => t.step === 'knowledge_select'));
}

/* ---------- C: fail-closed Wissens-Gates ---------- */
{
  const tampered = clone(RP); tampered.rules[0].statement = 'MANIPULIERT';
  const rt = RC.buildRunningCapacity(snap({}), { evidence: evidence, pack: tampered });
  ok('C1 manipuliertes Pack blockiert die gesamte Factory (status blocked, capacity null)',
    rt.status === 'blocked' && rt.capacity === null && rt.blockingReasons.some(b => b.code === 'knowledge_selection_blocked'));
  const drift = clone(RP); drift.knowledgeVersion = 'kb-run-v9.9.9'; drift.contentHash = KC.packContentHash(drift);
  const rd = RC.buildRunningCapacity(snap({}), { evidence: evidence, pack: drift });
  ok('C2 Pack-Versions-Drift ⇒ Pin blockiert (knowledge_version_mismatch)',
    rd.status === 'blocked' && rd.blockingReasons[0].errors.indexOf('knowledge_version_mismatch') >= 0);
  const regT = clone(KS); regT.sources[0].summary = 'HACK'; regT.contentHash = KC.registryContentHash(regT);
  const rr = RC.buildRunningCapacity(snap({}), { evidence: evidence, registry: regT });
  ok('C2c manipuliertes Register blockiert (source_registry_hash_mismatch_pinned)',
    rr.status === 'blocked' && rr.blockingReasons[0].errors.indexOf('source_registry_hash_mismatch_pinned') >= 0);
  const rc = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: {} });
  ok('C3 fehlende knowledgeContracts ⇒ blocked', rc.status === 'blocked' && rc.blockingReasons.some(b => b.code === 'knowledge_contracts_unavailable'));
}

/* ---------- C2: fail-closed Snapshot-Gate (Req 1) ---------- */
{
  const rNull = RC.buildRunningCapacity(null, { evidence: evidence });
  ok('CS1 null-Snapshot ⇒ blocked, capacity null', rNull.status === 'blocked' && rNull.capacity === null && rNull.blockingReasons.some(b => b.code === 'snapshot_invalid'));
  const rEmpty = RC.buildRunningCapacity({}, { evidence: evidence });
  ok('CS2 leeres Objekt {} ⇒ blocked (kein akzeptables Schema), capacity null',
    rEmpty.status === 'blocked' && rEmpty.capacity === null && rEmpty.blockingReasons.some(b => b.code === 'snapshot_schema_unsupported'));
  const rArr = RC.buildRunningCapacity([1, 2, 3], { evidence: evidence });
  ok('CS3 Array-Snapshot ⇒ blocked (snapshot_invalid)', rArr.status === 'blocked' && rArr.blockingReasons.some(b => b.code === 'snapshot_invalid'));
  const sForeign = Object.assign({}, snap({}), { schemaVersion: 99 });
  const rForeign = RC.buildRunningCapacity(sForeign, { evidence: evidence });
  ok('CS4 fremde Snapshot-Schema-Version ⇒ blocked (nur exakt gepinnte Version akzeptiert)',
    rForeign.status === 'blocked' && rForeign.capacity === null && rForeign.blockingReasons.some(b => b.code === 'snapshot_schema_unsupported'));
  // Out-of-range now würde bei naivem new Date().toISOString() werfen — muss blocked liefern, nie throwen.
  let threwNow = false, rNow = null;
  try { rNow = RC.buildRunningCapacity(Object.assign({}, snap({}), { now: 1e300 }), { evidence: evidence }); } catch (e) { threwNow = true; }
  ok('CS5 ungültiges/out-of-range now ⇒ blocked, KEIN Throw',
    !threwNow && rNow && rNow.status === 'blocked' && rNow.blockingReasons.some(b => b.code === 'snapshot_time_invalid'));
  let threwNaN = false, rNaN = null;
  try { rNaN = RC.buildRunningCapacity(Object.assign({}, snap({}), { now: NaN }), { evidence: evidence }); } catch (e) { threwNaN = true; }
  ok('CS5b now=NaN ⇒ blocked, KEIN Throw', !threwNaN && rNaN && rNaN.status === 'blocked' && rNaN.blockingReasons.some(b => b.code === 'snapshot_time_invalid'));
  const rToday = RC.buildRunningCapacity(Object.assign({}, snap({}), { today: '2026-13-40' }), { evidence: evidence });
  ok('CS6 ungültiges today ⇒ blocked (snapshot_date_invalid)', rToday.status === 'blocked' && rToday.blockingReasons.some(b => b.code === 'snapshot_date_invalid'));
  const rTz = RC.buildRunningCapacity(Object.assign({}, snap({}), { timezone: 'Not/AZone' }), { evidence: evidence });
  ok('CS7 ungültige timezone ⇒ blocked (snapshot_timezone_invalid)', rTz.status === 'blocked' && rTz.blockingReasons.some(b => b.code === 'snapshot_timezone_invalid'));
  const rTz2 = RC.buildRunningCapacity(Object.assign({}, snap({}), { timezone: 123 }), { evidence: evidence });
  ok('CS7b timezone falscher Typ ⇒ blocked', rTz2.status === 'blocked' && rTz2.blockingReasons.some(b => b.code === 'snapshot_timezone_invalid'));
  // Strukturell unbrauchbare Unterstrukturen ⇒ blocked, kein Throw.
  let threwLH = false, rLH = null;
  try { rLH = RC.buildRunningCapacity(Object.assign({}, snap({}), { loadHistory: [1, 2] }), { evidence: evidence }); } catch (e) { threwLH = true; }
  ok('CS8 loadHistory falscher Typ (Array) ⇒ blocked, KEIN Throw', !threwLH && rLH && rLH.status === 'blocked' && rLH.blockingReasons.some(b => b.code === 'snapshot_loadhistory_invalid'));
  let threwDQ = false, rDQ = null;
  try { rDQ = RC.buildRunningCapacity(Object.assign({}, snap({}), { dataQuality: 'x' }), { evidence: evidence }); } catch (e) { threwDQ = true; }
  ok('CS9 dataQuality falscher Typ ⇒ blocked, KEIN Throw', !threwDQ && rDQ && rDQ.status === 'blocked' && rDQ.blockingReasons.some(b => b.code === 'snapshot_dataquality_invalid'));
  let threwCM = false, rCM = null;
  try { rCM = RC.buildRunningCapacity(Object.assign({}, snap({}), { currentMetrics: 'x' }), { evidence: evidence }); } catch (e) { threwCM = true; }
  ok('CS10 currentMetrics falscher Typ ⇒ blocked, KEIN Throw', !threwCM && rCM && rCM.status === 'blocked' && rCM.blockingReasons.some(b => b.code === 'snapshot_currentmetrics_invalid'));
}

/* ---------- D: deskriptive Ist-Zustands-Dimensionen ---------- */
{
  const r = RC.buildRunningCapacity(snap({}), { evidence: evidence });
  const c = r.capacity;
  ok('D1 alle acht Dimensionen vorhanden mit Provenienz/Missingness/Confidence/ruleIds/reasonCodes',
    ['historyReliability', 'consistency', 'weeklyVolumeObserved', 'longestGroupedSession', 'loadResponse', 'intensityControl', 'dataComparability', 'progressionLimits']
      .every(k => c[k] && 'provenance' in c[k] && 'missingness' in c[k] && 'confidence' in c[k] && Array.isArray(c[k].ruleIds) && Array.isArray(c[k].reasonCodes)));
  ok('D2 Wochen-Trainingslast als BANDBREITE (min/max), Einheit orvia_load_au_per_week, deskriptiv, KEINE Vorgabe',
    c.weeklyVolumeObserved.value && typeof c.weeklyVolumeObserved.value.min === 'number' &&
    typeof c.weeklyVolumeObserved.value.max === 'number' && c.weeklyVolumeObserved.value.min <= c.weeklyVolumeObserved.value.max &&
    c.weeklyVolumeObserved.value.unit === 'orvia_load_au_per_week' && c.weeklyVolumeObserved.value.quantityKind === 'weekly_training_load' &&
    /descriptive/.test(JSON.stringify(c.weeklyVolumeObserved.value)));
  ok('D2b Einheit suggeriert KEINEN Kilometerumfang', !/\bkm\b/i.test(JSON.stringify(c.weeklyVolumeObserved.value)) && !/kilometer/i.test(JSON.stringify(c.weeklyVolumeObserved.value)));
  ok('D3 Intensitätssteuerung: RPE-Methode verfügbar, RPE-Historie=false, Provenienz policy, KEINE Pace-/HF-Steuerung ohne Beleg',
    c.intensityControl.value.availableModes.indexOf('rpe') >= 0 && c.intensityControl.value.rpeHistoryPresent === false &&
    c.intensityControl.provenance === 'policy' && c.intensityControl.value.paceControl === false &&
    c.intensityControl.value.calibrationRequiredForPace === true && c.intensityControl.value.hrControlAuthorized === false);
  ok('D4 Progressionsgrenzen rein qualitativ: warningFlags-Array, KEIN Prozentsatz/Schwellenwert',
    Array.isArray(c.progressionLimits.value.warningFlags) && c.progressionLimits.value.quantitativeProgression === null &&
    c.progressionLimits.value.envelope === 'qualitative_only');
  ok('D5 longestGroupedSession trägt versioniertes Recent-Window (Produktregel, kein Knowledge-Rule-Id)',
    c.longestGroupedSession.value.analysisWindow && c.longestGroupedSession.value.analysisWindow.policyRuleId === 'RCAP-RECENT-POLICY-001' &&
    !/^RUN-/.test(c.longestGroupedSession.value.analysisWindow.policyRuleId) &&
    c.longestGroupedSession.value.analysisWindow.version === 'rwin-v1.0.0' && c.longestGroupedSession.value.analysisWindow.days === 42);
  ok('D6 loadResponse ehrlich: response24h48h=unobserved, missingness not_supported, low conf, KEIN observed_response',
    c.loadResponse.value.response24h48h === 'unobserved' && c.loadResponse.missingness === 'not_supported' &&
    c.loadResponse.confidence === 'low' && c.loadResponse.reasonCodes.indexOf('observed_response') < 0 &&
    c.loadResponse.reasonCodes.indexOf('post_response_unobserved') >= 0);
  ok('D6b loadResponse-Provenienz nicht fälschlich legacy_sessions (kanonische Lastfelder ⇒ mixed)',
    c.loadResponse.provenance === 'mixed' && c.loadResponse.value.inputs.hardYesterday.provenance === 'canonical_activities');
}

/* ---------- E: Golden Case Gian ---------- */
{
  const r = RC.buildRunningCapacity(snap({}), { evidence: evidence });
  ok('E1 12,41-km-Lauf aus 3 Segmenten zählt als EINE gruppierte Einheit — EXAKT 12,41 km',
    r.capacity.longestGroupedSession.value.distanceKm === 12.41 && r.capacity.longestGroupedSession.value.segments === 3 &&
    r.capacity.longestGroupedSession.value.countedAs === 'single_grouped_session' && r.capacity.longestGroupedSession.value.activityRefs.length === 3);
  const j = JSON.stringify(r);
  ok('E2 KEINE Erfindung: kein 4:42 / min/km / „9 km Intervalle" / Wochenkilometer / Pace-Zonen im Ergebnis',
    !/4:42/.test(j) && !/min\/km/.test(j) && !/9\s?km/.test(j) && !/Wochenkilometer/.test(j) && !/pace_?zone/i.test(j) && !/intervall/i.test(j));
  ok('E3 Status ist deskriptiv aus {ready,partial,unknown,blocked}; NIE „trainingsbereit"', ALLOWED_STATUS.indexOf(r.status) >= 0);
}

/* ---------- F: Aspiration-Trennung / Zielwerte nie Capacity ---------- */
{
  const s1 = snap({ raw: { goals: [{ id: 'g:hm', category: 'half_marathon', priority: 1, metricType: 'time', targetValue: 6600, targetDate: '2026-09-16' }], goalDaysToEvent: 63 } });
  const s2 = snap({ raw: { goals: [{ id: 'g:hm', category: 'half_marathon', priority: 1, metricType: 'time', targetValue: 6000, targetDate: '2026-08-01' }], goalDaysToEvent: 17 } });
  const r1 = RC.buildRunningCapacity(s1, { evidence: evidence });
  const r2 = RC.buildRunningCapacity(s2, { evidence: evidence });
  ok('F1 veränderte Zielzeit/-pace/-datum ändern die Capacity NICHT (byte-identisch)', JSON.stringify(r1.capacity) === JSON.stringify(r2.capacity));
  ok('F1b gesamtes Ergebnis byte-identisch (Zielwerte werden gar nicht konsumiert)', JSON.stringify(r1) === JSON.stringify(r2));
  ok('F2 Aspiration explizit getrennt: targetsAreCapacityInputs=false, RUN-GOAL-001',
    r1.aspiration.targetsAreCapacityInputs === false && r1.aspiration.ruleId === 'RUN-GOAL-001');
}

/* ---------- G: Datenqualität / Confidence / Einheiten ---------- */
{
  // G1 fehlende Historie ⇒ unknown/konservativ, keine nullbasierte Fitness.
  const rNoLoad = RC.buildRunningCapacity(snap({ load: { acute7: null, chronic28PerWeek: null, dataDays: 0, quality: null, ratioConfidence: 'medium', loadConfidence: 'medium', source: 'legacy_sessions', hardYesterday: false, hardStreak: 0, loadUnit: 'srpe_au', estimatedShare: null, unknownUnits: null, ambiguousUnits: null } }), { evidence: null });
  ok('G1 fehlende/leere Historie ⇒ status unknown/partial + Umfang unknown, KEINE 0-Fitness',
    ['unknown', 'partial'].indexOf(rNoLoad.status) >= 0 && rNoLoad.capacity.weeklyVolumeObserved.value === 'unknown' &&
    rNoLoad.capacity.historyReliability.confidence === 'low');
  // G2 schlechte Lastqualität (ratioConfidence low durch unbekannte Einheit, kohärent) verhindert Umfangsaussage.
  const rLowQ = RC.buildRunningCapacity(snap({ load: loadFrom(qualityOf(win(4, 300, { unknownUnits: 1 }), win(9, 900), 28)) }), { evidence: evidence });
  ok('G2 schlechte Lastqualität (low ratioConfidence) ⇒ weeklyVolumeObserved unknown + Progressions-Flag',
    rLowQ.capacity.weeklyVolumeObserved.value === 'unknown' &&
    rLowQ.capacity.progressionLimits.value.warningFlags.indexOf('load_quality_insufficient_for_progression_claim') >= 0);
  // G3 Legacy-Quelle + srpe_au + übrig gebliebenes kanonisches Quality-Objekt ⇒ producer-inkohärent.
  const rLegacy = RC.buildRunningCapacity(snap({ load: { source: 'legacy_sessions', loadUnit: 'srpe_au' } }), { evidence: evidence });
  ok('G3 Legacy-Mix (Quelle legacy + kanonisches Quality) ⇒ Umfang unknown, Historie NICHT reliable, Konsistenz NICHT sufficient, Provenienz nicht fälschlich legacy',
    rLegacy.capacity.weeklyVolumeObserved.value === 'unknown' &&
    (rLegacy.capacity.historyReliability.value === 'unknown' || rLegacy.capacity.historyReliability.value.tier !== 'reliable') &&
    (rLegacy.capacity.consistency.value === 'unknown' || rLegacy.capacity.consistency.value.level !== 'sufficient') &&
    rLegacy.capacity.historyReliability.provenance !== 'legacy_sessions' &&
    rLegacy.status !== 'ready');
  // G4 fehlende Top-Level-Confidence (≠ quality.ratioConfidence) ⇒ inkohärent ⇒ unknown, Confidence low.
  const rNoConf = RC.buildRunningCapacity(snap({ load: { ratioConfidence: null, loadConfidence: null } }), { evidence: evidence });
  ok('G4 fehlende Top-Confidence ⇒ Umfang unknown + historyReliability.confidence low, nicht reliable',
    rNoConf.capacity.weeklyVolumeObserved.value === 'unknown' &&
    rNoConf.capacity.historyReliability.confidence === 'low' &&
    (rNoConf.capacity.historyReliability.value === 'unknown' || rNoConf.capacity.historyReliability.value.tier !== 'reliable'));
  const rBadConf = RC.buildRunningCapacity(snap({ load: { ratioConfidence: 'bogus', loadConfidence: 'bogus' } }), { evidence: evidence });
  ok('G4b ungültige Confidence ("bogus") ⇒ Umfang unknown, Confidence low', rBadConf.capacity.weeklyVolumeObserved.value === 'unknown' && rBadConf.capacity.historyReliability.confidence === 'low');
  // G5 falsche Einheit trotz kanonischer Quelle ⇒ inkohärent (canonical_source_wrong_unit).
  const rUnit = RC.buildRunningCapacity(snap({ load: { loadUnit: 'srpe_au' } }), { evidence: evidence });
  ok('G5 kanonische Quelle + srpe_au + gültiges Quality ⇒ Umfang unknown, Historie NICHT reliable (canonical_source_wrong_unit)',
    rUnit.capacity.weeklyVolumeObserved.value === 'unknown' &&
    (rUnit.capacity.historyReliability.value === 'unknown' || rUnit.capacity.historyReliability.value.tier !== 'reliable') &&
    rUnit.capacity.weeklyVolumeObserved.reasonCodes.join(',').indexOf('canonical_source_wrong_unit') >= 0);
  const rNeg = RC.buildRunningCapacity(snap({ load: { acute7: -5 } }), { evidence: evidence });
  ok('G5b negative Top-Last ⇒ inkohärent ⇒ Umfang unknown, Historie nicht reliable',
    rNeg.capacity.weeklyVolumeObserved.value === 'unknown' &&
    (rNeg.capacity.historyReliability.value === 'unknown' || rNeg.capacity.historyReliability.value.tier !== 'reliable'));
  const rNaNL = RC.buildRunningCapacity(snap({ load: { acute7: NaN } }), { evidence: evidence });
  ok('G5c NaN-Last ⇒ Umfang unknown', rNaNL.capacity.weeklyVolumeObserved.value === 'unknown');
  const rInf = RC.buildRunningCapacity(snap({ load: { chronic28PerWeek: Infinity } }), { evidence: evidence });
  ok('G5d Infinity-Last ⇒ Umfang unknown', rInf.capacity.weeklyVolumeObserved.value === 'unknown');
  // G6 niedrige Konsistenz (prior21<4) ⇒ per Resolverformel insufficientChronicHistory:true; kohärent ⇒ Umfang unknown.
  const rCons = RC.buildRunningCapacity(snap({ load: loadFrom(qualityOf(win(4, 300), win(2, 200), 28)) }), { evidence: evidence });
  ok('G6 niedrige Konsistenz (prior21<4, ich:true, kohärent) ⇒ Umfang unknown, tier nicht reliable, nicht ready',
    rCons.capacity.weeklyVolumeObserved.value === 'unknown' && rCons.capacity.historyReliability.value.tier !== 'reliable' &&
    rCons.status !== 'ready');
}

/* ---------- H: Evidenz-Vertrag / Recent-Window / Dedupe ---------- */
{
  // H1 tatsächlich UNTERSCHIEDLICHE Rohdaten (Zusatz-Radeinheit), gleiche Capacity.
  const actsB = gianActs.concat([{ clientRecordId: 'c1', sportId: 'cycling', startedAt: '2026-07-13T06:00:00Z', durationSeconds: 3600, summary: { distanceKm: 30 } }]);
  const evB = RC.evidenceFromActivities(actsB, { groupSessions: AC.groupActivitySessions, sportId: 'running' });
  const r1 = RC.buildRunningCapacity(snap({}), { evidence: evidence });
  const r2 = RC.buildRunningCapacity(snap({}), { evidence: evB });
  ok('H1 unterschiedliche Rohaktivitäten (mit Radeinheit) ⇒ IDENTISCHE Long-Run-Capacity (dedupe-/rausch-robust)',
    actsB.length !== gianActs.length && JSON.stringify(r1.capacity.longestGroupedSession) === JSON.stringify(r2.capacity.longestGroupedSession));
  // H2 Adaptervertrag validiert Ref-Eindeutigkeit: doppelte activityRef (gleiche kanonische ID)
  //    ⇒ konservativ unknown (Gruppierung ist ausdrücklich KEINE Deduplizierung).
  const rDupRef = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ activityRefs: ['a1', 'a2', 'a2'], segments: 3 }) });
  ok('H2 doppelte activityRef (gleiche ID) ⇒ Long-Run unknown (evidence_refs_duplicated, nicht doppelt gezählt)',
    rDupRef.capacity.longestGroupedSession.value === 'unknown' && rDupRef.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_refs_duplicated') >= 0);
  // H2b Doppelte Roh-Aufzeichnung bildet eine eigene Gruppe und inflationiert den Long-Run NICHT:
  //     die akzeptierte längste Einheit bleibt EXAKT 12,41 km (kein 15,62), einmal gezählt.
  const dupActs = gianActs.concat([{ clientRecordId: 'a3', sportId: 'run', startedAt: '2026-07-12T08:30:00Z', durationSeconds: 1260, summary: { distanceKm: 3.21 } }]);
  const evDup = RC.evidenceFromActivities(dupActs, { groupSessions: AC.groupActivitySessions, sportId: 'running' });
  const rDup = RC.buildRunningCapacity(snap({}), { evidence: evDup });
  ok('H2b doppelte Roh-Aufzeichnung ⇒ Long-Run bleibt EXAKT 12,41 km (nicht 15,62), einmal gezählt',
    rDup.capacity.longestGroupedSession.value.distanceKm === 12.41 && rDup.capacity.longestGroupedSession.value.countedAs === 'single_grouped_session' &&
    rDup.capacity.longestGroupedSession.value.activityRefs.length === 3);
  // H3 Fake-Evidenz ohne Schema (999 km) ⇒ nicht akzeptiert.
  const rFake = RC.buildRunningCapacity(snap({}), { evidence: { longestGroupedSession: { distanceKm: 999, segments: 1, activityRefs: ['x'], startedAt: '2026-07-14T07:00:00Z' } } });
  ok('H3 Fake-Evidenz ohne gültiges Schema (999 km) ⇒ unknown (evidence_schema_unrecognized)',
    rFake.capacity.longestGroupedSession.value === 'unknown' && rFake.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_schema_unrecognized') >= 0);
  // H4 Evidenz ohne Datum ⇒ unknown.
  const rNoDate = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ startedAt: null }) });
  ok('H4 Evidenz ohne Datum ⇒ unknown (evidence_date_missing_or_invalid)',
    rNoDate.capacity.longestGroupedSession.value === 'unknown' && rNoDate.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_date_missing_or_invalid') >= 0);
  // H5 Evidenz aus der Zukunft ⇒ unknown.
  const rFuture = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ startedAt: '2026-08-01T07:00:00Z' }) });
  ok('H5 Evidenz aus der Zukunft ⇒ unknown (evidence_in_future)',
    rFuture.capacity.longestGroupedSession.value === 'unknown' && rFuture.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_in_future') >= 0);
  // H6 Evidenz außerhalb des Recent-Fensters ⇒ unknown.
  const rOld = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ startedAt: '2026-04-01T07:00:00Z' }) });
  ok('H6 Evidenz außerhalb des 42-Tage-Fensters ⇒ unknown (evidence_outside_recent_window)',
    rOld.capacity.longestGroupedSession.value === 'unknown' && rOld.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_outside_recent_window') >= 0);
  // H7 Fünf Jahre alter Marathon (echte Gruppierung) ⇒ KEINE aktuelle Long-Run-Capacity.
  const oldActs = [
    { clientRecordId: 'm1', sportId: 'run', startedAt: '2021-05-01T06:00:00Z', durationSeconds: 12600, summary: { distanceKm: 42.2 } }
  ];
  const evOld = RC.evidenceFromActivities(oldActs, { groupSessions: AC.groupActivitySessions, sportId: 'running' });
  const rMarathon = RC.buildRunningCapacity(snap({}), { evidence: evOld });
  ok('H7 5 Jahre alter Marathon ⇒ Long-Run unknown (nicht als aktuelle Capacity gewertet)',
    rMarathon.capacity.longestGroupedSession.value === 'unknown' && rMarathon.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_outside_recent_window') >= 0);
  // H8 Segment-/Ref-Inkonsistenz ⇒ unknown.
  const rMis = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ segments: 5, activityRefs: ['a1', 'a2', 'a3'] }) });
  ok('H8 inkonsistente Segment-/Referenzzahl ⇒ unknown (evidence_segment_ref_mismatch)',
    rMis.capacity.longestGroupedSession.value === 'unknown' && rMis.capacity.longestGroupedSession.reasonCodes.indexOf('evidence_segment_ref_mismatch') >= 0);
  // H9 malformed activityRefs ⇒ KEIN Throw, unknown.
  let threwRefs = false, rRefs = null;
  try { rRefs = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ activityRefs: [{}, null], segments: 2 }) }); } catch (e) { threwRefs = true; }
  ok('H9 malformed activityRefs ⇒ KEIN Throw, Long-Run unknown', !threwRefs && rRefs && rRefs.capacity.longestGroupedSession.value === 'unknown');
}

/* ---------- I: keine Safety-/GREEN-Ableitung, keine Verordnung ---------- */
{
  const r = RC.buildRunningCapacity(snap({}), { evidence: evidence });
  const j = JSON.stringify(r);
  ok('I1 keine Trainingsfreigabe/GREEN/„safe to train"/Return-to-Run im Ergebnis',
    !/GREEN|safe.?to.?train|trainingsbereit|return.?to.?run.?(freigegeben|ok|ready)/i.test(j) &&
    r.safetyDisclaimer.derivesTrainingReadiness === false && r.safetyDisclaimer.derivesReturnToRun === false &&
    r.safetyDisclaimer.batch0SafetyPipeline === 'independent_not_overridden');
  ok('I2 keine quantitative Verordnung (Pack hat keine autorisierten quantitativen Claims)',
    r.quantitativePrescription === null &&
    RP.rules.every(rule => rule.claims.every(c => c.use !== 'quantitative')));
  ok('I3 medizinische Regeln bleiben ausgeschlossen (Doppelsicherung MEDICAL_EXCLUDED)',
    r.safetyDisclaimer.medicalRulesExcluded.indexOf('RUN-SAFE-001') >= 0 && r.safetyDisclaimer.medicalRulesExcluded.indexOf('RUN-RTR-001') >= 0);
  ok('I4 keine Pace-/Progressions-Verordnung: paceControl false, quantitativeProgression null, kein min/km',
    r.capacity.intensityControl.value.paceControl === false && r.capacity.progressionLimits.value.quantitativeProgression === null && !/min\/km/.test(j));
}

/* ---------- J: keine Seiteneffekte + outcomeHistory ---------- */
{
  let threw = false;
  try { RC.buildRunningCapacity(snap({}), { evidence: evidence }); } catch (e) { threw = true; }
  ok('J1 Aufruf ohne DOM/Storage/Netz-Globals wirft nicht (keine Seiteneffekt-Zugriffe)', !threw);
  // J2 outcomeHistory:{} (bloße Präsenz) darf NIE observed_response erzeugen.
  const sOh = Object.assign({}, snap({}), { outcomeHistory: {} });
  const rOh = RC.buildRunningCapacity(sOh, { evidence: evidence });
  ok('J2 outcomeHistory:{} ⇒ weiterhin unobserved, KEIN observed_response',
    rOh.capacity.loadResponse.value.response24h48h === 'unobserved' && rOh.capacity.loadResponse.reasonCodes.indexOf('observed_response') < 0);
}

/* ---------- K: Fuzz / Property — Factory wirft NIE, Status stets zulässig ---------- */
{
  const s = snap({});
  const fuzzInputs = [
    null, undefined, 0, 1, '', 'x', true, false, [], [1, 2, 3], {}, { schemaVersion: 1 }, { schemaVersion: '1' },
    { schemaVersion: 1, now: 'x', today: 5, timezone: {}, dataQuality: 7, loadHistory: 'z', currentMetrics: [] },
    { schemaVersion: 1, now: NOW, today: TODAY, timezone: 'Europe/Vienna', dataQuality: { missing: 'no' } },
    { schemaVersion: 1, now: NOW, today: TODAY, timezone: 'Europe/Vienna', dataQuality: { missing: [] }, loadHistory: { source: 'canonical_activities', acute7: 'NaN', chronic28PerWeek: {}, quality: [], loadUnit: 42 } },
    Object.assign({}, s, { loadHistory: Object.assign({}, s.loadHistory, { quality: 'broken', ratioConfidence: 999 }) }),
    Object.assign({}, s, { currentMetrics: { values: null } }),
    Object.assign({}, s, { athlete: [] }),
    Object.assign({}, s, { dataQuality: { missing: [1, null, { path: 5 }, {}] } })
  ];
  const fuzzEvidence = [undefined, null, {}, { longestGroupedSession: null }, { longestGroupedSession: 5 },
    { longestGroupedSession: { schema: 'x' } }, mkEv({ distanceKm: 'x' }), mkEv({ segments: 2.5 }),
    mkEv({ activityRefs: 'nope' }), mkEv({ startedAt: 999999999999999999999 })];
  let anyThrow = false, allStatusOk = true, count = 0;
  for (let i = 0; i < fuzzInputs.length; i++) {
    for (let e = 0; e < fuzzEvidence.length; e++) {
      count++;
      let res = null;
      try { res = RC.buildRunningCapacity(fuzzInputs[i], { evidence: fuzzEvidence[e] }); }
      catch (err) { anyThrow = true; }
      if (!res || ALLOWED_STATUS.indexOf(res.status) < 0) allStatusOk = false;
    }
  }
  ok('K1 Fuzz: Factory wirft bei KEINER JSON-Form (' + count + ' Kombinationen) und liefert stets deterministisches Objekt', !anyThrow);
  ok('K2 Fuzz: Status stets aus {ready,partial,unknown,blocked}', allStatusOk);
  // K3 Determinismus auch für malformed Input.
  const bad = { schemaVersion: 1, now: NaN, today: 'x' };
  ok('K3 malformed Input deterministisch (zwei Aufrufe byte-identisch)',
    JSON.stringify(RC.buildRunningCapacity(bad, {})) === JSON.stringify(RC.buildRunningCapacity(bad, {})));
}

/* ---------- L: verschachtelter Load-Vertrag fail-closed (producer-getreu) ---------- */
{
  function corrupt(mut) { var q = qualityOf(win(4, 300), win(9, 900), 28); var l = loadFrom(q); mut(q, l); return l; }
  // L1 fehlendes insufficientChronicHistory (kein boolean) ⇒ keine Wochenlast.
  const rMissBool = RC.buildRunningCapacity(snap({ load: corrupt(function (q) { q.insufficientChronicHistory = undefined; }) }), { evidence: evidence });
  ok('L1 insufficientChronicHistory kein boolean ⇒ Wochenlast unknown', rMissBool.capacity.weeklyVolumeObserved.value === 'unknown');
  // L2 insufficientChronicHistory als String ⇒ unknown, nicht reliable.
  const rStrBool = RC.buildRunningCapacity(snap({ load: corrupt(function (q) { q.insufficientChronicHistory = 'false'; }) }), { evidence: evidence });
  ok('L2 insufficientChronicHistory="false" (String) ⇒ unknown, tier nicht reliable',
    rStrBool.capacity.weeklyVolumeObserved.value === 'unknown' && rStrBool.capacity.historyReliability.value.tier !== 'reliable');
  // L3 dataDays > activeLoadDays ⇒ unmöglich ⇒ nicht ready, keine Wochenlast.
  const rIncoh = RC.buildRunningCapacity(snap({ load: corrupt(function (q, l) { l.dataDays = 20; }) }), { evidence: evidence });
  ok('L3 dataDays(20) > chronic28.activeLoadDays(13) ⇒ Wochenlast unknown, nicht ready, tier nicht reliable',
    rIncoh.capacity.weeklyVolumeObserved.value === 'unknown' && rIncoh.status !== 'ready' && rIncoh.capacity.historyReliability.value.tier !== 'reliable' &&
    rIncoh.capacity.weeklyVolumeObserved.reasonCodes.join(',').indexOf('data_days_exceed_active_days') >= 0);
  // L4 Quality-Unterobjekt falscher Typ ⇒ keine Wochenlast.
  const rBadSub = RC.buildRunningCapacity(snap({ load: corrupt(function (q) { q.acute7 = 'x'; }) }), { evidence: evidence });
  ok('L4 Quality-Unterobjekt falscher Typ ⇒ Wochenlast unknown', rBadSub.capacity.weeklyVolumeObserved.value === 'unknown');
  // L5 activeLoadDays außerhalb Fenster (prior21:99) ⇒ keine Wochenlast.
  const rBadDays = RC.buildRunningCapacity(snap({ load: corrupt(function (q) { q.prior21.activeLoadDays = 99; }) }), { evidence: evidence });
  ok('L5 activeLoadDays außerhalb Fenster (prior21:99) ⇒ Wochenlast unknown', rBadDays.capacity.weeklyVolumeObserved.value === 'unknown');
}

/* ---------- M: boolesche/int Lastfelder nicht casten (Req 3) ---------- */
{
  const rHyStr = RC.buildRunningCapacity(snap({ load: { hardYesterday: 'false' } }), { evidence: evidence });
  ok('M1 hardYesterday="false" ⇒ niemals true (ungültig, missingness invalid_type)',
    rHyStr.capacity.loadResponse.value.inputs.hardYesterday.value !== true &&
    rHyStr.capacity.loadResponse.value.inputs.hardYesterday.value === null &&
    rHyStr.capacity.loadResponse.value.inputs.hardYesterday.missingness === 'invalid_type');
  const rHy1 = RC.buildRunningCapacity(snap({ load: { hardYesterday: 1 } }), { evidence: evidence });
  ok('M1b hardYesterday=1 ⇒ nicht true', rHy1.capacity.loadResponse.value.inputs.hardYesterday.value !== true);
  const rHyObj = RC.buildRunningCapacity(snap({ load: { hardYesterday: {} } }), { evidence: evidence });
  ok('M1c hardYesterday={} ⇒ nicht true', rHyObj.capacity.loadResponse.value.inputs.hardYesterday.value !== true);
  const rHyFalse = RC.buildRunningCapacity(snap({ load: { hardYesterday: false } }), { evidence: evidence });
  ok('M2 hardYesterday===false bleibt false', rHyFalse.capacity.loadResponse.value.inputs.hardYesterday.value === false);
  const rHyTrue = RC.buildRunningCapacity(snap({ load: { hardYesterday: true } }), { evidence: evidence });
  ok('M2b hardYesterday===true bleibt true', rHyTrue.capacity.loadResponse.value.inputs.hardYesterday.value === true);
  const rHsBad = RC.buildRunningCapacity(snap({ load: { hardStreak: 'x' } }), { evidence: evidence });
  ok('M3 hardStreak="x" ⇒ ungültig (null), kein consecutive_hard_days-Flag',
    rHsBad.capacity.loadResponse.value.inputs.hardStreak.value === null &&
    rHsBad.capacity.progressionLimits.value.warningFlags.indexOf('consecutive_hard_days') < 0);
}

/* ---------- N: HF-Steuerung in Snapshot v1 gesperrt (Req 4) ---------- */
{
  function withHf(over) { const s = snap({}); s.athlete = Object.assign({}, s.athlete, over); return s; }
  const r1 = RC.buildRunningCapacity(withHf({ hfMaxMeasured: 1 }), { evidence: evidence });
  const r2 = RC.buildRunningCapacity(withHf({ hfMaxMeasured: 200, hfMaxProvenance: 'measured' }), { evidence: evidence });
  const r3 = RC.buildRunningCapacity(withHf({ hfMaxMeasured: 200, hfMaxProvenance: 'faked' }), { evidence: evidence });
  ok('N1 arbiträres hfMaxMeasured:1 ⇒ keine HF-Autorisierung, kein hr-Mode',
    r1.capacity.intensityControl.value.hrControlAuthorized === false && r1.capacity.intensityControl.value.availableModes.indexOf('hr') < 0);
  ok('N2 hfMaxMeasured:200 + provenance "measured" ⇒ in v1 dennoch KEINE HF-Autorisierung',
    r2.capacity.intensityControl.value.hrControlAuthorized === false && r2.capacity.intensityControl.value.availableModes.indexOf('hr') < 0);
  ok('N3 gefälschte Provenienz ⇒ keine HF-Autorisierung', r3.capacity.intensityControl.value.hrControlAuthorized === false);
}

/* ---------- O: Wissensauswahl-Antwort strukturell validieren (Req 5) ---------- */
{
  const rEmpty = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({}) } });
  ok('O1 selectRules ⇒ {} (kein boolean blocked) ⇒ blocked (knowledge_selection_invalid)',
    rEmpty.status === 'blocked' && rEmpty.capacity === null && rEmpty.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  const rNull = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => null } });
  ok('O2 selectRules ⇒ null ⇒ blocked', rNull.status === 'blocked' && rNull.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  const rBadRules = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: 'nope' }) } });
  ok('O3 selectRules.rules falscher Typ ⇒ blocked', rBadRules.status === 'blocked' && rBadRules.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  const rEmptyRules = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: [], excluded: [] }) } });
  ok('O4 leere Shadow-Auswahl (rules:[]) ⇒ blocked, NICHT still unknown',
    rEmptyRules.status === 'blocked' && rEmptyRules.capacity === null && rEmptyRules.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  const rBadRuleShape = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: [{ noRuleId: true }] }) } });
  ok('O5 Rule ohne ruleId ⇒ blocked', rBadRuleShape.status === 'blocked' && rBadRuleShape.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  let threwSel = false, rThrow = null;
  try { rThrow = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => { throw new Error('boom'); } } }); } catch (e) { threwSel = true; }
  ok('O6 werfender Selector ⇒ blocked, KEIN Throw', !threwSel && rThrow && rThrow.status === 'blocked' && rThrow.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
}

/* ---------- P: Evidenzadapter gegen erfundene Gruppen (Req 6) ---------- */
{
  // Fake-Gruppierung, die bei LEERER Activity-Liste eine 999-km-Gruppe erfindet.
  const fakeGroupEmpty = () => ({ groups: [{ groupId: 'grp:fake', sportId: 'running', activityRefs: ['ghost'], segments: 1, totalDistanceKm: 999 }] });
  const evEmpty = RC.evidenceFromActivities([], { groupSessions: fakeGroupEmpty, sportId: 'running' });
  ok('P1 Fake-Gruppe (999 km) auf leerer Activity-Liste ⇒ evidenceFromActivities = null', evEmpty === null);
  // Fake-Gruppe behauptet 999 km, referenziert aber eine ECHTE 10-km-Activity ⇒ rekonstruiert exakt 10 km.
  const realActs = [{ clientRecordId: 'r1', sportId: 'run', startedAt: '2026-07-13T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 10 } }];
  const fakeGroup10 = () => ({ groups: [{ groupId: 'grp:fake', sportId: 'running', activityRefs: ['r1'], segments: 1, totalDistanceKm: 999 }] });
  const ev10 = RC.evidenceFromActivities(realActs, { groupSessions: fakeGroup10, sportId: 'running' });
  ok('P2 Fake-Gruppe (999 km) auf echter 10-km-Activity ⇒ rekonstruierte Distanz EXAKT 10 km (nie 999)',
    ev10 && ev10.longestGroupedSession.distanceKm === 10);
  const r10 = RC.buildRunningCapacity(snap({}), { evidence: ev10 });
  ok('P2b Ergebnis nutzt rekonstruierte 10 km, nicht die 999-km-Behauptung der Gruppierung',
    r10.capacity.longestGroupedSession.value.distanceKm === 10);
  // Fake-Gruppe referenziert unbekannte + doppelte Refs ⇒ verworfen (null/unknown).
  const fakeGhostDup = () => ({ groups: [{ groupId: 'grp:x', sportId: 'running', activityRefs: ['r1', 'r1'], segments: 2, totalDistanceKm: 20 }] });
  const evDupRef = RC.evidenceFromActivities(realActs, { groupSessions: fakeGhostDup, sportId: 'running' });
  ok('P3 doppelte Referenzen in Gruppe ⇒ verworfen (null)', evDupRef === null);
  const fakeUnknownRef = () => ({ groups: [{ groupId: 'grp:x', sportId: 'running', activityRefs: ['does_not_exist'], segments: 1, totalDistanceKm: 20 }] });
  const evUnknownRef = RC.evidenceFromActivities(realActs, { groupSessions: fakeUnknownRef, sportId: 'running' });
  ok('P4 unbekannte Referenz (zeigt auf keine übergebene Activity) ⇒ verworfen (null)', evUnknownRef === null);
  // Recent-Policy-Id darf nicht wie eine Knowledge-Pack-Regel aussehen.
  ok('P5 Recent-Policy heißt RCAP-RECENT-POLICY-001 (kein RUN-… Knowledge-Rule-Id)',
    RC.RECENT_WINDOW.policyRuleId === 'RCAP-RECENT-POLICY-001' && !/^RUN-/.test(RC.RECENT_WINDOW.policyRuleId));
}

/* ---------- Q: Garmin-10-km über REALE Gruppierung ⇒ exakt 10 km ---------- */
{
  // Garmin-Summary snake_case → zentrale Normalisierung → reale Gruppierung → 10 km.
  const AN = sb.ORVIA.activityNormalize;
  const garminRaw = { source: 'garmin', source_record_id: 'g10', sport_id: 'running', started_at: '2026-07-13T06:30:00Z', duration_seconds: 3000, summary: { distance_m: 10000, avg_hr: 150, max_hr: 172, calories_kcal: 700, elevation_gain_m: 80, avg_speed_mps: 3.33 } };
  const norm = AN.normalizeActivityRecord(garminRaw);
  const evG = RC.evidenceFromActivities([norm], { groupSessions: AC.groupActivitySessions, sportId: 'running' });
  const rG = RC.buildRunningCapacity(snap({}), { evidence: evG });
  ok('Q1 Garmin-10-km-Lauf (distance_m:10000) ⇒ reale Long-Run-Evidenz EXAKT 10 km',
    evG && evG.longestGroupedSession.distanceKm === 10 && rG.capacity.longestGroupedSession.value.distanceKm === 10);
}

/* ---------- R: producer-getreuer Load-Quality-Vertrag (3b.1d) ---------- */
{
  function mk(mut) { var q = qualityOf(win(4, 300), win(9, 900), 28); var l = loadFrom(q); if (mut) mut(q, l); return l; }
  function noWeekly(r) { return r.capacity.weeklyVolumeObserved.value === 'unknown' && r.capacity.historyReliability.value.tier !== 'reliable' && r.status !== 'ready'; }
  function reasons(r) { return r.capacity.weeklyVolumeObserved.reasonCodes.join(','); }
  const B = (load) => RC.buildRunningCapacity(snap({ load: load }), { evidence: evidence });

  // R1 dataDays:28 / activeLoadDays:13 / unknownUnits:0 ⇒ unmöglich ⇒ fail-closed.
  const r1 = B(mk(function (q, l) { l.dataDays = 28; }));
  ok('R1 dataDays:28 / active:13 / unknown:0 ⇒ fail-closed (keine Wochenlast, nicht ready/reliable)',
    noWeekly(r1) && reasons(r1).indexOf('data_days_exceed_active_days') >= 0);
  // R2 dataDays:1 / activeLoadDays:13 / unknownUnits:0 ⇒ Equality-Verletzung ohne Unknowns.
  const r2 = B(mk(function (q, l) { l.dataDays = 1; }));
  ok('R2 dataDays:1 / active:13 / unknown:0 ⇒ fail-closed (data_active_mismatch_without_unknowns)',
    noWeekly(r2) && reasons(r2).indexOf('data_active_mismatch_without_unknowns') >= 0);
  // R3 dataDays:12 / activeLoadDays:13 / unknownUnits:1 (kohärent) ⇒ Tagesrelation GÜLTIG.
  const r3load = loadFrom(qualityOf(win(4, 300, { unknownUnits: 1 }), win(9, 900), 28), { dataDays: 12 });
  const r3 = B(r3load);
  ok('R3 dataDays:12 / active:13 / unknown:1 ⇒ Tagesrelation gültig (kein active/data-Verstoß)',
    reasons(r3).indexOf('active_days_exceed_data_days') < 0 && reasons(r3).indexOf('data_days_exceed_active_days') < 0 &&
    reasons(r3).indexOf('data_active_mismatch_without_unknowns') < 0 && r3.status !== 'blocked');
  // R4 dataDays > activeLoadDays ⇒ fail-closed.
  const r4 = B(mk(function (q, l) { l.dataDays = 20; }));
  ok('R4 dataDays(20) > active(13) ⇒ fail-closed (data_days_exceed_active_days)',
    noWeekly(r4) && reasons(r4).indexOf('data_days_exceed_active_days') >= 0);
  // R5 fehlende Fenster-Confidence ⇒ fail-closed.
  const r5a = B(mk(function (q) { delete q.acuteConfidence; }));
  const r5b = B(mk(function (q) { delete q.priorConfidence; }));
  const r5c = B(mk(function (q) { delete q.chronicConfidence; }));
  ok('R5 fehlende acute/prior/chronicConfidence ⇒ jeweils fail-closed', noWeekly(r5a) && noWeekly(r5b) && noWeekly(r5c));
  // R6 negative/falsch typisierte nested Werte ⇒ keine Wochenlast, nie reliable/ready.
  const r6a = B(mk(function (q) { q.acute7.unknownUnits = -1; }));
  const r6b = B(mk(function (q) { q.acute7.ambiguousUnits = 1.5; }));
  const r6c = B(mk(function (q) { q.acute7.measuredLoad = -5; }));
  const r6d = B(mk(function (q) { q.acute7.estimatedLoad = 'x'; }));
  const r6e = B(mk(function (q) { q.acute7.estimatedShare = 2; }));
  ok('R6 negative/falsch typisierte nested unknownUnits/ambiguousUnits/measuredLoad/estimatedLoad/estimatedShare ⇒ fail-closed',
    noWeekly(r6a) && noWeekly(r6b) && noWeekly(r6c) && noWeekly(r6d) && noWeekly(r6e));
  // R7 Chronic-Summenfehler je aggregiertem Feld ⇒ fail-closed.
  const r7a = B(mk(function (q) { q.chronic28.activeLoadDays = 10; }));
  const r7b = B(mk(function (q) { q.chronic28.measuredLoad = 999; }));
  const r7c = B(mk(function (q) { q.chronic28.unknownUnits = 3; }));
  const r7d = B(mk(function (q) { q.chronic28.ambiguousUnits = 2; }));
  const r7e = B(mk(function (q) { q.chronic28.estimatedLoad = 50; q.chronic28.estimatedShare = Math.round((50 / (q.chronic28.measuredLoad + 50)) * 100) / 100; }));
  ok('R7 Chronic-Summenfehler (activeLoadDays/measuredLoad/unknownUnits/ambiguousUnits/estimatedLoad) ⇒ fail-closed',
    noWeekly(r7a) && noWeekly(r7b) && noWeekly(r7c) && noWeekly(r7d) && noWeekly(r7e));
  // R8 ratioConfidence !== loadConfidence ⇒ fail-closed.
  const r8 = B(mk(function (q, l) { l.loadConfidence = 'medium'; }));
  ok('R8 ratioConfidence !== loadConfidence ⇒ fail-closed (ratio_load_confidence_mismatch)',
    noWeekly(r8) && reasons(r8).indexOf('ratio_load_confidence_mismatch') >= 0);
  // R9 Top-Level-Confidence != quality.ratioConfidence ⇒ fail-closed.
  const r9 = B(mk(function (q, l) { l.ratioConfidence = 'medium'; l.loadConfidence = 'medium'; }));
  ok('R9 Top-Confidence != quality.ratioConfidence ⇒ fail-closed (top_quality_confidence_mismatch)',
    noWeekly(r9) && reasons(r9).indexOf('top_quality_confidence_mismatch') >= 0);
  // R10 top-level estimatedShare/unknownUnits/ambiguousUnits stimmen nicht mit Acute-Fenster ⇒ fail-closed.
  const r10 = B(mk(function (q, l) { l.unknownUnits = 5; }));
  ok('R10 top-level unknownUnits != acute7.unknownUnits ⇒ fail-closed (top_unknownunits_mismatch)',
    noWeekly(r10) && reasons(r10).indexOf('top_unknownunits_mismatch') >= 0);
  // R11 Golden „Good"-Fixture (real möglich) ⇒ Wochenlast-Band + reliable + ready.
  const rGood = B(goodLoad());
  ok('R11 real möglicher Good-Zustand (dataDays 13 = active 13, unknown 0) ⇒ Wochenlast-Band, reliable, ready',
    rGood.capacity.weeklyVolumeObserved.value && typeof rGood.capacity.weeklyVolumeObserved.value.min === 'number' &&
    rGood.capacity.historyReliability.value.tier === 'reliable' && rGood.status === 'ready');
}

/* ---------- S: semantische Selector-Validierung (3b.1c-2) ---------- */
{
  const rFake = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: [{ ruleId: 'FAKE-UNREVIEWED-001' }], excluded: [] }) } });
  ok('S1 unbekannte Rule-ID (FAKE-UNREVIEWED-001) ⇒ vollständig blocked, capacity null, nicht in usedRuleIds',
    rFake.status === 'blocked' && rFake.capacity === null && rFake.blockingReasons.some(b => b.code === 'knowledge_selection_invalid') &&
    rFake.usedRuleIds.indexOf('FAKE-UNREVIEWED-001') < 0);
  const realId = RP.rules[0].ruleId;
  const rDupId = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: [{ ruleId: realId }, { ruleId: realId }], excluded: [] }) } });
  ok('S2 doppelte Rule-ID ⇒ blocked', rDupId.status === 'blocked' && rDupId.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
  const rMed = RC.buildRunningCapacity(snap({}), { evidence: evidence, contracts: { selectRules: () => ({ blocked: false, rules: [{ ruleId: 'RUN-SAFE-001' }], excluded: [] }) } });
  ok('S3 medizinisch ausgeschlossene Rule-ID im aktiven Satz ⇒ blocked', rMed.status === 'blocked' && rMed.blockingReasons.some(b => b.code === 'knowledge_selection_invalid'));
}

/* ---------- T: unabhängige Session-Mitgliedschaft (3b.1c-3) ---------- */
{
  // T1 zwei echte 10-km-Läufe am 1. und 10. Juli, gemeinsam von einem Fake-Grouper referenziert ⇒ NIE 20 km.
  const twoRuns = [
    { clientRecordId: 'j1', sportId: 'run', startedAt: '2026-07-01T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 10 } },
    { clientRecordId: 'j10', sportId: 'run', startedAt: '2026-07-10T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 10 } }
  ];
  const fakeJoin = () => ({ groups: [{ groupId: 'grp:join', sportId: 'running', activityRefs: ['j1', 'j10'], segments: 2, totalDistanceKm: 20 }] });
  const evJoin = RC.evidenceFromActivities(twoRuns, { groupSessions: fakeJoin, sportId: 'running' });
  ok('T1 zwei zeitlich getrennte 10-km-Läufe (9 Tage Gap) ⇒ NICHT zu 20 km summiert (null)', evJoin === null);
  const rJoin = RC.buildRunningCapacity(snap({}), { evidence: evJoin });
  ok('T1b Ergebnis: Long-Run unknown (keine erfundene 20-km-Session)', rJoin.capacity.longestGroupedSession.value === 'unknown');
  // T2 kollidierende Identitäten (gleiche Ref, unterschiedlicher Inhalt) ⇒ Gruppe verworfen, kein „erste gewinnt".
  const collide = [
    { clientRecordId: 'dup', sportId: 'run', startedAt: '2026-07-13T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 10 } },
    { clientRecordId: 'dup', sportId: 'run', startedAt: '2026-07-13T09:00:00Z', durationSeconds: 1500, summary: { distanceKm: 5 } }
  ];
  const fakeCollide = () => ({ groups: [{ groupId: 'grp:c', sportId: 'running', activityRefs: ['dup'], segments: 1, totalDistanceKm: 10 }] });
  const evCollide = RC.evidenceFromActivities(collide, { groupSessions: fakeCollide, sportId: 'running' });
  ok('T2 kollidierende Activity-Identität (gleiche ID, anderer Inhalt) ⇒ verworfen (null), nicht still „erste gewinnt"', evCollide === null);
  // T3 harmlose Doppelaufzeichnung (gleiche ID, gleicher Inhalt) bleibt gültig — Golden 12,41 unverändert.
  ok('T3 Golden 12,41 km unverändert (echte Gruppierung)', RC.buildRunningCapacity(snap({}), { evidence: evidence }).capacity.longestGroupedSession.value.distanceKm === 12.41);
  // T4 Engine bildet aus nuller Distanz keinen Long Run.
  const zeroRun = [{ clientRecordId: 'z', sportId: 'run', startedAt: '2026-07-13T07:00:00Z', durationSeconds: 3000, summary: { distanceKm: 0 } }];
  const fakeZero = () => ({ groups: [{ groupId: 'grp:z', sportId: 'running', activityRefs: ['z'], segments: 1, totalDistanceKm: 999 }] });
  const evZero = RC.evidenceFromActivities(zeroRun, { groupSessions: fakeZero, sportId: 'running' });
  ok('T4 nuller Distanz ⇒ kein Long Run (evidence null)', evZero === null);
  const rZeroInj = RC.buildRunningCapacity(snap({}), { evidence: mkEv({ distanceKm: 0 }) });
  ok('T4b direkt injizierte 0-km-Evidenz ⇒ Long-Run unknown', rZeroInj.capacity.longestGroupedSession.value === 'unknown');
}

/* ---------- RI: Integration über den ECHTEN Resolver (3b.1d-10) ----------
   Ein Tag mit unbekannter Load-Unit (Aktivität ohne Dauer/RPE) erzeugt im realen
   Producer einen aktiven Tag OHNE Last ⇒ dataDays < activeLoadDays, vertragskonform.
   Fixe Uhr (deterministisch, keine reale Uhrzeit in Assertions). */
{
  const FIXED = Date.parse('2026-07-15T12:00:00Z');
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) { super(FIXED); } else { super(...a); } } }
  FakeDate.now = () => FIXED; FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC;
  const realDate = sb.Date;
  // Producer-Abhängigkeiten deterministisch bereitstellen.
  sb.todayStr = function (d) {
    d = d || new sb.Date();
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  };
  sb.DB = {};
  sb.Calc = { sessionLoad: function () { return 0; } };
  sb.ORVIA.activityStore = {
    listActivities: function () { return [{ clientRecordId: 'u1', sportId: 'run', source: 'garmin', sourceRecordId: 'u1', startedAt: '2026-07-15T12:00:00Z', durationSeconds: null, summary: {} }]; },
    isTombstoned: function () { return false; }
  };
  let snapReal = null, threwReal = false;
  try { sb.Date = FakeDate; snapReal = R.collectSnapshot(); }
  catch (e) { threwReal = true; }
  finally { sb.Date = realDate; }
  const lh = snapReal && snapReal.loadHistory;
  ok('RI1 realer Resolver: unbekannte Load-Unit ⇒ aktiver Tag OHNE Last (dataDays < chronic28.activeLoadDays), unknownUnits > 0',
    !threwReal && lh && lh.source === 'canonical_activities' && lh.quality &&
    lh.quality.chronic28.unknownUnits > 0 && lh.dataDays < lh.quality.chronic28.activeLoadDays && lh.dataDays >= 0);
  // Factory akzeptiert diesen realen Zustand als kohärent (kein Tagesrelations-Verstoß, nicht blocked).
  let rReal = null, threwF = false;
  try { sb.Date = FakeDate; rReal = RC.buildRunningCapacity(snapReal, { evidence: evidence }); }
  catch (e) { threwF = true; }
  finally { sb.Date = realDate; }
  ok('RI2 Factory wertet dataDays < activeLoadDays (mit Unknowns) als vertragskonform (kein Tagesrelations-Fail, nicht blocked)',
    !threwF && rReal && rReal.status !== 'blocked' &&
    rReal.capacity.weeklyVolumeObserved.reasonCodes.join(',').indexOf('data_days_exceed_active_days') < 0 &&
    rReal.capacity.weeklyVolumeObserved.reasonCodes.join(',').indexOf('data_active_mismatch_without_unknowns') < 0);
}

/* ---------- W: restliche Producer-Invarianten (3b.1e) ---------- */
{
  function mk(mut) { var q = qualityOf(win(4, 350), win(9, 850), 28); var l = loadFrom(q); if (mut) mut(q, l); return l; }
  function noWeekly(r) { return r.capacity.weeklyVolumeObserved.value === 'unknown' && r.capacity.historyReliability.value.tier !== 'reliable' && r.status !== 'ready'; }
  // Der präzise Quality-Reason erscheint je nach Confidence im Volumen- ODER im
  // historyReliability-Reasonpfad ⇒ beide durchsuchen.
  function reasons(r) { return r.capacity.weeklyVolumeObserved.reasonCodes.concat(r.capacity.historyReliability.reasonCodes || []).join(','); }
  const B = (load) => RC.buildRunningCapacity(snap({ load: load }), { evidence: evidence });

  // W1 span:14 mit prior21.activeLoadDays:10 (max 7 möglich) ⇒ fail-closed.
  const w1 = B(loadFrom(qualityOf(win(4, 300), win(10, 1000), 14)));
  ok('W1 span:14 / prior.active:10 (unmöglich) ⇒ fail-closed (prior_active_exceeds_span)',
    noWeekly(w1) && reasons(w1).indexOf('prior_active_exceeds_span') >= 0);
  // W2 span:14, prior.active:0, Acute-Aktivität vorhanden ⇒ älteste Aktivität kann nicht 14 Tage zurückliegen.
  const w2 = B(loadFrom(qualityOf(win(4, 300), win(0, 0), 14)));
  ok('W2 span:14 / prior.active:0 / acute vorhanden ⇒ fail-closed (span_exceeds_acute_without_prior)',
    noWeekly(w2) && reasons(w2).indexOf('span_exceeds_acute_without_prior') >= 0);
  // W3 span:28 aber chronic28.activeLoadDays:0 ⇒ fail-closed.
  const w3 = B(loadFrom(qualityOf(win(0, 0), win(0, 0), 28)));
  ok('W3 span:28 / chronic.active:0 ⇒ fail-closed (chronic_active_span_zero_mismatch)',
    noWeekly(w3) && reasons(w3).indexOf('chronic_active_span_zero_mismatch') >= 0);
  // W4 Acute measuredLoad:300 aber activeLoadDays:0 ⇒ fail-closed.
  const w4 = B(mk(function (q) { q.acute7.activeLoadDays = 0; }));
  ok('W4 acute measuredLoad:350 / activeLoadDays:0 ⇒ fail-closed (Fenster ungültig)',
    noWeekly(w4) && reasons(w4).indexOf('acute7_window_invalid') >= 0);
  // W5 activeLoadDays>0 aber Last 0 und unknownUnits:0 ⇒ fail-closed.
  const w5 = B(mk(function (q) { q.acute7.measuredLoad = 0; q.acute7.estimatedLoad = 0; }));
  ok('W5 acute active>0 / Last 0 / unknown 0 ⇒ fail-closed (Fenster ungültig)',
    noWeekly(w5) && reasons(w5).indexOf('acute7_window_invalid') >= 0);
  // W6 aktive Tage OHNE berechenbare Last übersteigen die Unknown-Units ⇒ fail-closed
  //    (kohärente Fenster; eine Unknown-Unit erklärt nicht mehrere Unknown-only-Tage).
  const w6 = B(loadFrom(qualityOf(win(5, 0, { unknownUnits: 1 }), win(0, 0), 5), { dataDays: 0 }));
  ok('W6 5 aktive Unknown-only-Tage bei nur 1 Unknown-Unit ⇒ fail-closed (inactive_days_exceed_unknown_units)',
    noWeekly(w6) && reasons(w6).indexOf('inactive_days_exceed_unknown_units') >= 0);
  // W6b Literalfall der Vorgabe (active:13 / dataDays:0 / unknown:1) ⇒ ebenfalls fail-closed.
  const w6b = B(loadFrom(qualityOf(win(4, 0, { unknownUnits: 1 }), win(9, 0), 28), { dataDays: 0 }));
  ok('W6b active:13 / dataDays:0 / unknown:1 ⇒ fail-closed', noWeekly(w6b));
  // W7 Quality-Acute-Last 350, aber Top-Level acute7:9999 ⇒ fail-closed.
  const w7 = B(mk(function (q, l) { l.acute7 = 9999; }));
  ok('W7 Top-Level acute7:9999 ≠ Fensterlast ⇒ fail-closed (top_acute_load_mismatch)',
    noWeekly(w7) && reasons(w7).indexOf('top_acute_load_mismatch') >= 0);
  // W8 Quality-Chronic-Last 1200, aber Top-Level chronic28PerWeek:1 ⇒ fail-closed.
  const w8 = B(mk(function (q, l) { l.chronic28PerWeek = 1; }));
  ok('W8 Top-Level chronic28PerWeek:1 ≠ Fensterlast ⇒ fail-closed (top_chronic_weekly_load_mismatch)',
    noWeekly(w8) && reasons(w8).indexOf('top_chronic_weekly_load_mismatch') >= 0);
  // W9 reale Good-Fixture bleibt ready/reliable mit Wochenlast-Band.
  const w9 = B(goodLoad());
  ok('W9 reale Good-Fixture ⇒ ready/reliable + Wochenlast-Band (300–350)',
    w9.status === 'ready' && w9.capacity.historyReliability.value.tier === 'reliable' &&
    w9.capacity.weeklyVolumeObserved.value && w9.capacity.weeklyVolumeObserved.value.min === 300 && w9.capacity.weeklyVolumeObserved.value.max === 350);
}

/* ---------- X: strikter Source/Unit/Quality-Discriminator + ehrliche Provenienz (3b.1f) ---------- */
{
  const B = (load, ev) => RC.buildRunningCapacity(snap({ load: load }), { evidence: ev === undefined ? evidence : ev });
  function notReliable(r) { var v = r.capacity.historyReliability.value; return v === 'unknown' || v.tier !== 'reliable'; }
  function notSufficient(r) { var v = r.capacity.consistency.value; return v === 'unknown' || v.level !== 'sufficient'; }

  // X1 unbekannte Quelle + kanonische Einheit + gültiges Quality ⇒ nicht reliable, KEINE erfundene Legacy-Provenienz.
  let threwX1 = false, x1 = null;
  try { x1 = B({ source: 'garmin_raw' }); } catch (e) { threwX1 = true; }   // source unbekannt, sonst kanonisch (Unit/Quality aus goodLoad)
  ok('X1 unbekannte Quelle ⇒ Umfang unknown, Historie nicht reliable, Provenienz ehrlich (unknown, NICHT legacy_sessions), kein Throw',
    !threwX1 && x1 && x1.capacity.weeklyVolumeObserved.value === 'unknown' && notReliable(x1) &&
    x1.capacity.historyReliability.provenance === 'unknown' && x1.capacity.historyReliability.provenance !== 'legacy_sessions' &&
    notSufficient(x1) && x1.status !== 'blocked' && x1.status !== 'ready');

  // X2 ehrliche Legacy-Form (quality:null, abgeleitete Felder null) ⇒ kein Block/Throw, konservativ, Provenienz legacy_sessions.
  const legacyLoad = { source: 'legacy_sessions', loadUnit: 'srpe_au', quality: null, estimatedShare: null, unknownUnits: null, ambiguousUnits: null, ratioConfidence: 'medium', loadConfidence: 'medium', acute7: 200, chronic28PerWeek: 180, dataDays: 5, hardYesterday: false, hardStreak: 1 };
  let threwX2 = false, x2 = null;
  try { x2 = B(legacyLoad); } catch (e) { threwX2 = true; }
  ok('X2 ehrliche Legacy-Form ⇒ kein Block/Throw, Historie insufficient, Konsistenz nicht sufficient, Umfang unknown, Provenienz legacy_sessions',
    !threwX2 && x2 && x2.status !== 'blocked' &&
    x2.capacity.historyReliability.value.tier === 'insufficient' && x2.capacity.historyReliability.provenance === 'legacy_sessions' &&
    notSufficient(x2) && x2.capacity.weeklyVolumeObserved.value === 'unknown' && x2.status !== 'ready');

  // X3 kanonische Quelle + kanonische Einheit aber quality:null ⇒ inkohärent ⇒ nicht reliable, Umfang unknown.
  const x3 = B({ quality: null, estimatedShare: null, unknownUnits: null, ambiguousUnits: null });
  ok('X3 canonical_activities + orvia_load_au aber quality:null ⇒ inkohärent (nicht reliable, Umfang unknown)',
    x3.capacity.weeklyVolumeObserved.value === 'unknown' && notReliable(x3));

  // X4 vollständig gültiger kanonischer Zustand bleibt reliable/ready mit kanonischer Provenienz (Positivkontrolle).
  const x4 = B(goodLoad());
  ok('X4 vollständig gültig kanonisch ⇒ reliable, ready, Provenienz canonical_activities, Konsistenz sufficient',
    x4.status === 'ready' && x4.capacity.historyReliability.value.tier === 'reliable' &&
    x4.capacity.historyReliability.provenance === 'canonical_activities' &&
    x4.capacity.consistency.value.level === 'sufficient' && x4.capacity.consistency.provenance === 'canonical_activities');

  // X5 legacy-Quelle mit falscher Einheit (orvia_load_au) ⇒ inkohärent, nicht reliable, Provenienz unknown.
  const x5 = B({ source: 'legacy_sessions' });   // Unit bleibt orvia_load_au aus goodLoad ⇒ legacy+falsche Einheit
  ok('X5 legacy-Quelle + orvia_load_au (falsches Paar) ⇒ inkohärent, nicht reliable, Provenienz unknown',
    x5.capacity.weeklyVolumeObserved.value === 'unknown' && notReliable(x5) && x5.capacity.historyReliability.provenance === 'unknown');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
