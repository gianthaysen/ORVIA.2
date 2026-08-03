/* ============================================================
   ORVIA · Batch 2d — Fenster-Qualität/ratioConfidence, ehrliche
   Last-Einheiten, Template-vs-Occurrence, konservatives Low-Verhalten
   node supabase/tests/batch2d_ratio_occurrence_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');
const wsSrc = readFileSync(new URL('workout-store.js', base), 'utf8');
const wuiSrc = readFileSync(new URL('workout-ui.js', base), 'utf8');
const repoSrc = readFileSync(new URL('repos/workoutRepository.js', base), 'utf8');

function makeSb(opts) {
  opts = opts || {};
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Intl = Intl;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb._store = store;
  sb.ORVIA = { user: { id: 'u1' } };
  sb.todayStr = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.DB = {};
  vm.createContext(sb);
  ['training-domain.js', 'activity-normalize.js', 'activity-store.js', 'activity-config.js',
   'engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js',
   'checkin-field-resolver.js', 'engine/training-input-resolver.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  return sb;
}
const dayIso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() - offsetDays); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T09:00:00.000Z'; };
const act = (o) => Object.assign({ id: null, clientRecordId: 'c', sportId: 'running', source: 'import', sourceRecordId: 's', workoutSessionId: null, startedAt: dayIso(1), durationSeconds: 3600, status: 'completed', summary: {}, syncStatus: 'synced' }, o);
function seed(sb, acts) { sb.localStorage.setItem('orvia_activities_u1', JSON.stringify(acts)); }
function measuredAt(off, i) { return act({ clientRecordId: 'm' + off + '_' + (i || 0), sourceRecordId: 'm' + off + '_' + (i || 0), startedAt: dayIso(off), summary: { rpe: 6 } }); }
function estimatedAt(off) { return act({ clientRecordId: 'e' + off, sourceRecordId: 'e' + off, startedAt: dayIso(off), summary: { distanceKm: 8 } }); }

/* ---------- R: Fenster-Qualität + ratioConfidence (Punkt 1) ---------- */
{
  // R1: letzte 7 Tage GEMESSEN, Tage 8–27 überwiegend GESCHÄTZT ⇒ chronic low ⇒ ratio low.
  const sb1 = makeSb({});
  const acts1 = [1, 2, 3, 4, 5, 6].map(o => measuredAt(o)).concat([8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map(o => estimatedAt(o)));
  seed(sb1, acts1);
  const r1 = sb1.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('R1 acute gemessen + chronic geschätzt ⇒ acute high, chronic low, ratio LOW',
    r1.quality.acuteConfidence === 'high' && r1.quality.chronicConfidence === 'low' && r1.ratioConfidence === 'low',
    JSON.stringify({ a: r1.quality.acuteConfidence, c: r1.quality.chronicConfidence, r: r1.ratioConfidence }));
  // R2: letzte 7 Tage GESCHÄTZT, Rest gemessen ⇒ acute low ⇒ ratio low.
  const sb2 = makeSb({});
  seed(sb2, [1, 2, 3].map(o => estimatedAt(o)).concat([8, 10, 12, 14, 16, 18].map(o => measuredAt(o))));
  const r2 = sb2.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('R2 acute geschätzt + chronic gemessen ⇒ ratio LOW', r2.quality.acuteConfidence === 'low' && r2.ratioConfidence === 'low');
  // R3: unbekannte Beiträge NUR außerhalb des 7-Tage-Fensters ⇒ acute sauber, chronic low.
  const sb3 = makeSb({});
  const unknownAct = act({ clientRecordId: 'u10', sourceRecordId: 'u10', startedAt: dayIso(10), durationSeconds: null, summary: { distanceKm: 9 } });
  seed(sb3, [1, 2, 3].map(o => measuredAt(o)).concat([unknownAct]).concat([9, 12, 15].map(o => measuredAt(o, 1))));
  const r3 = sb3.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('R3 unknown nur außerhalb 7d ⇒ acute7.unknown=0, chronic28.unknown=1, ratio LOW',
    r3.quality.acute7.unknownUnits === 0 && r3.quality.chronic28.unknownUnits === 1 &&
    r3.quality.acuteConfidence === 'high' && r3.ratioConfidence === 'low', JSON.stringify(r3.quality));
  // R4: vollständig gemessene 28-Tage-Basis ⇒ ratio HIGH, Gates dürfen feuern.
  const sb4 = makeSb({});
  seed(sb4, [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((o, i) => measuredAt(o, i)));
  const r4 = sb4.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('R4 vollständig gemessen ⇒ ratio HIGH + aktive Lasttage ehrlich ausgewiesen',
    r4.ratioConfidence === 'high' && r4.quality.acute7.activeLoadDays === 6 && r4.quality.chronic28.activeLoadDays === 16, JSON.stringify({ r: r4.ratioConfidence, c7: r4.quality.acute7.activeLoadDays, c28: r4.quality.chronic28.activeLoadDays }));
  // R5: Engine nutzt AUSSCHLIESSLICH ratioConfidence (nicht das Alias-Feld).
  const E = sb4.ORVIA.decisionEngineV2;
  const spiky = { readiness: { score: 80, confidence: 'high', warnings: [], missingData: [] }, safetyFlags: {}, illness: false, constraints: [], plannedSession: { sport: 'running', intensity: 'easy', label: 'DL' }, recentLoad: { acute7: 3000, chronic28PerWeek: 500, dataDays: 14, hardYesterday: false, hardStreak: 0, ratioConfidence: 'low', loadConfidence: 'high' }, goalContext: {}, availabilityToday: true };
  const d5 = E.evaluate(spiky);
  ok('R5 ratioConfidence low schlägt loadConfidence high ⇒ kein load_spike',
    !d5.reasons.some(r => r.code === 'load_spike') && d5.missingData.indexOf('load_quality') >= 0);
}

/* ---------- U: ehrliche Last-Einheiten (Punkt 2) ---------- */
{
  const sb = makeSb({});
  const D = sb.ORVIA.activityConfig.dailyLoadUnits;
  const r = D([act({ summary: { rpe: 6 } }), act({ clientRecordId: 'c2', sourceRecordId: 's2', summary: { distanceKm: 8 } })], {});
  const measured = r.units.find(u => u.loadBasis === 'srpe_measured');
  const estimated = r.units.find(u => u.loadBasis === 'duration_default_intensity');
  ok('U1 gemessene Einheit srpe_au, Schätz-Proxy est_load_au (nie srpe_au)',
    measured.loadUnit === 'srpe_au' && estimated.loadUnit === 'est_load_au');
  ok('U2 Aggregat = orvia_load_au mit vollem Methodenanteil',
    r.loadUnit === 'orvia_load_au' && r.measuredLoad === 360 && r.estimatedLoad === 300 &&
    r.methodShare.measured === Math.round(360 / 660 * 100) / 100 && r.methodShare.estimated === Math.round(300 / 660 * 100) / 100, JSON.stringify(r.methodShare));
  const sbR = makeSb({});
  seed(sbR, [measuredAt(1)]);
  const rl = sbR.ORVIA.trainingInputResolver.collectRaw().recentLoad;
  ok('U3 recentLoad trägt die Mischeinheit orvia_load_au', rl.loadUnit === 'orvia_load_au');
}

/* ---------- O: Template ≠ Occurrence (Punkt 3) ---------- */
{
  function mkPlanSb(todayIso) {
    const planBlock = uiSrc.slice(0, uiSrc.indexOf('var PLAN_PRESETS'));
    const sb = {}; sb.window = sb; sb.globalThis = sb;
    sb.console = console; sb.Date = Date; sb.Math = Math; sb.Object = Object; sb.Array = Array;
    sb.String = String; sb.Number = Number; sb.Set = Set; sb.JSON = JSON;
    sb.todayStr = (d) => { const x = d || new Date(todayIso + 'T12:00'); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    sb.goalOf = () => ({ type: 'half_marathon', raceDate: '2026-09-06' });
    sb.userLevel = () => 'fortgeschritten';
    sb.PROFILE = { sports: [{ sportId: 'running', activeInApp: true }], weekPlan: null, trainingDays: null, issues: [] };
    sb.ORVIA = { profileModel: { canonGoalCategory: t => t, effectiveTrainingConfig: () => ({ availableDayIdx: [0, 1, 3, 5, 6], targetDays: 3, daysSource: 'availability' }) } };
    sb.saveProfile = () => {};
    vm.createContext(sb);
    vm.runInContext(planBlock, sb, { filename: 'ui.js#plan' });
    return sb;
  }
  // 2026-07-15 ist ein Mittwoch (wd=2). Woche: Mo 13.–So 19.
  const sbW1 = mkPlanSb('2026-07-15');
  const p1 = sbW1.activeWeekPlan();
  const di = p1.findIndex(d => d.length);
  const item = p1[di][0];
  const occ1 = sbW1.plannedOccurrenceIdFor(item, di);
  ok('O1 Occurrence = po:<lokales Datum>:<templateSessionId>', new RegExp('^po:2026-07-1[3-9]:' + item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(occ1), occ1);
  ok('O2 gleiche Woche/Reload ⇒ identische Occurrence', sbW1.plannedOccurrenceIdFor(sbW1.activeWeekPlan()[di][0], di) === occ1 && mkPlanSb('2026-07-15').plannedOccurrenceIdFor(mkPlanSb('2026-07-15').activeWeekPlan()[di][0], di) === occ1);
  // Folgewoche: gleiche Template-ID, ANDERE Occurrence.
  const sbW2 = mkPlanSb('2026-07-22');
  const p2 = sbW2.activeWeekPlan();
  const occ2 = sbW2.plannedOccurrenceIdFor(p2[di][0], di);
  ok('O3 Folgewoche: templateSessionId gleich, Occurrence verschieden', p2[di][0].id === item.id && occ2 !== occ1, JSON.stringify({ occ1, occ2 }));
  // Verschiebung: Einheit auf nicht verfügbarem Tag wandert — Occurrence nutzt das ECHTE Datum.
  const sbShift = mkPlanSb('2026-07-15');
  const saved = [[], [], [{ id: 'ps:tmpl1', t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [], [], []];   // Mi belegt
  sbShift.PROFILE.weekPlan = saved;
  sbShift.ORVIA.profileModel.effectiveTrainingConfig = () => ({ availableDayIdx: [3], targetDays: 1, daysSource: 'availability' }); // nur Do verfügbar
  const aligned = sbShift.activeWeekPlan();
  const newDi = aligned.findIndex(d => d.length);
  const occShift = sbShift.plannedOccurrenceIdFor(aligned[newDi][0], newDi);
  ok('O4 verschobene Einheit: Do statt Mi ⇒ Occurrence trägt 2026-07-16 (echtes Datum)',
    newDi === 3 && occShift === 'po:2026-07-16:ps:tmpl1', occShift);
  // Start der konkreten Einheit: Occurrence + unveränderlicher Snapshot durchgereicht.
  const startBlock = (function (src) { const s = src.indexOf('function planNoteFor'), e = src.indexOf('/* F1: geplante Einheit ohne Live-Tracking'); return src.slice(s, e); })(uiSrc);
  let captured = null;
  sbShift.closeSupp = () => {};
  sbShift.ORVIA.workoutUI = { startSport: (sport, opts) => { captured = opts; } };
  vm.runInContext(startBlock, sbShift, { filename: 'ui.js#start' });
  sbShift.startPlannedUnit(newDi, 0);
  ok('O5 Start ⇒ plannedSessionId=Occurrence + templateSessionId getrennt',
    !!captured && captured.plannedSessionId === occShift && captured.templateSessionId === 'ps:tmpl1');
  ok('O6 Plan-Snapshot vollständig (Datum/Vorgabe/capturedAt)',
    captured.planSnapshot && captured.planSnapshot.occurrenceId === occShift && captured.planSnapshot.plannedDate === '2026-07-16' &&
    captured.planSnapshot.t === 'Laufen' && captured.planSnapshot.d === 'iv' && typeof captured.planSnapshot.capturedAt === 'number', JSON.stringify(captured.planSnapshot));
  // Verdrahtung Snapshot-Persistenz (tiefe Kopie + H3-Muster, online + offline).
  ok('O7 workout-store: tiefe Kopie + Queue sendet Spalte nur wenn belegt',
    /plannedSessionSnapshot:\s*opts\.planSnapshot\s*\?\s*JSON\.parse\(JSON\.stringify\(opts\.planSnapshot\)\)\s*:\s*null/.test(wsSrc) &&
    /\.\.\.\(s\.plannedSessionSnapshot\s*\?\s*\{\s*planned_session_snapshot:\s*s\.plannedSessionSnapshot\s*\}\s*:\s*\{\}\)/.test(wsSrc));
  ok('O8 Repository: planned_session_snapshot nur wenn belegt (H3)',
    /if\s*\(s\.plannedSessionSnapshot\)\s*row\.planned_session_snapshot\s*=\s*s\.plannedSessionSnapshot;/.test(repoSrc));
  ok('O9 workout-ui reicht planSnapshot durch', /planSnapshot:\s*\(opts\s*&&\s*opts\.planSnapshot\)\s*\|\|\s*null/.test(wuiSrc));
}

/* ---------- K: konservatives Verhalten bei ratioConfidence low (Punkt 4) ---------- */
{
  const sb = makeSb({});
  const E = sb.ORVIA.decisionEngineV2;
  const mk = (planned) => ({ readiness: { score: 85, confidence: 'high', warnings: [], missingData: [] }, safetyFlags: {}, illness: false, constraints: [], plannedSession: planned, recentLoad: { acute7: 900, chronic28PerWeek: 800, dataDays: 14, hardYesterday: false, hardStreak: 0, ratioConfidence: 'low', estimatedShare: 0.8 }, goalContext: {}, availabilityToday: true });
  const dHard = E.evaluate(mk({ sport: 'running', intensity: 'hard', label: 'Intervalle' }));
  ok('K1 harte Einheit + ratio low ⇒ NIE GREEN/KEEP (YELLOW + Intensität raus)',
    dHard.dayState !== 'GREEN' && dHard.action === 'REDUCE_INTENSITY' && dHard.safeguards.length > 0, JSON.stringify({ s: dHard.dayState, a: dHard.action }));
  const dEasy = E.evaluate(mk({ sport: 'running', intensity: 'easy', label: 'DL' }));
  ok('K2 lockere Einheit + ratio low ⇒ bleibt bestehen, Confidence sichtbar gesenkt',
    dEasy.dayState === 'GREEN' && dEasy.action === 'KEEP' && dEasy.missingData.indexOf('load_quality') >= 0 && dEasy.confidence !== 'high', JSON.stringify({ s: dEasy.dayState, a: dEasy.action, c: dEasy.confidence }));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
