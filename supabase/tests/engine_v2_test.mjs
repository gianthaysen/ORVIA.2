/* ============================================================
   ORVIA · Track C — Engine v2 (parallel, NICHT aktiv): Verträge, 15 Fixtures,
   Invarianten (C7), Alt/Neu-Vergleich (C5).
   node supabase/tests/engine_v2_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.ORVIA = {};
const load = f => (0, eval)(readFileSync(new URL(_APPREL + '' + f, import.meta.url), 'utf8'));
load('js/engine/engine-contracts.js');
load('js/engine/readiness-engine-v2.js');
load('js/engine/decision-engine-v2.js');
load('js/engine/plan-engine-v2.js');
const CT = globalThis.ORVIA.engineContracts;
const RE = globalThis.ORVIA.readinessEngineV2;
const DE = globalThis.ORVIA.decisionEngineV2;
const PE = globalThis.ORVIA.planEngineV2;

/* ---------- Kontrakte ---------- */
ok('C1 Reason-Katalog enthält geforderte Codes', ['poor_sleep', 'elevated_resting_hr', 'high_recent_load', 'insufficient_recovery', 'target_event_near', 'schedule_conflict', 'missing_baseline'].every(c => !!CT.REASONS[c]));
ok('C2 reason() liefert vollständiges Objekt', (() => { const r = CT.reason('poor_sleep', { h: 5 }); return r.code === 'poor_sleep' && r.severity && r.title && r.ruleVersion && r.inputValues.h === 5; })());

/* ---------- Readiness: Ehrlichkeit ---------- */
{
  const empty = RE.evaluate({});
  ok('R1 ohne Daten: KEIN Score (keine erfundene Zahl)', empty.score === null && empty.confidence === 'low');
  ok('R2 missingData vollständig', empty.missingData.length === RE.FACTORS.length);
  ok('R3 Vertrag eingehalten', CT.isReadinessResult(empty));
  const full = RE.evaluate({ sleepMinutes: 450, sleepGoalHours: 7.5, sleepQuality: 8, feel: 8, soreness: 2, stress: 'Low', hrvMs: 65, hrvBaselineLn: Math.log(62), hrvSd28: 0.1, hrvBaselineDays: 28, restingHr: 48, rhrBaseline: 49, rhrBaselineDays: 28, bodyBattery: 80 });
  ok('R4 volle Daten: hoher Score + high confidence', full.score >= 80 && full.confidence === 'high' && CT.isReadinessResult(full));
  const noBase = RE.evaluate({ hrvMs: 65, restingHr: 60, feel: 7, sleepMinutes: 400, sleepQuality: 6 });
  ok('R5 ohne Baseline: HRV/RHR fehlen ehrlich (missing_baseline, keine Strafe)', noBase.warnings.some(w => w.code === 'missing_baseline') && noBase.missingData.includes('hrv') && noBase.missingData.includes('resting_hr'));
  const bad = RE.evaluate({ sleepMinutes: 240, sleepGoalHours: 8, sleepQuality: 2, feel: 3, soreness: 8, stress: 'High', restingHr: 58, rhrBaseline: 48, rhrBaselineDays: 28 });
  ok('R6 schlechte Nacht: niedriger Score + Warncodes', bad.score !== null && bad.score < 45 && bad.warnings.some(w => w.code === 'poor_sleep') && bad.warnings.some(w => w.code === 'elevated_resting_hr'));
  ok('R7 BodyBattery zählt NICHT in den Score (Gewicht 0, Doppelzählung vermieden)', RE.FACTORS.every(f => f.id !== 'body_battery') && full.factors.some(f => f.id === 'body_battery' && f.weight === 0));
}

/* ---------- Decision: Invarianten (C7) ---------- */
const HARD_RUN = { sport: 'running', intensity: 'hard', label: 'Intervalle', minutes: 60 };
const UPPER_GYM = { sport: 'gym_upper', intensity: 'moderate', label: 'Oberkörper', minutes: 45 };
const GOOD_R = RE.evaluate({ sleepMinutes: 460, sleepGoalHours: 7.5, sleepQuality: 8, feel: 8, soreness: 1, stress: 'Low' });
{
  const d1 = DE.evaluate({ readiness: GOOD_R, safetyFlags: { chestPain: true }, plannedSession: HARD_RUN });
  ok('D1 Warnsymptom → RED + REST trotz Top-Readiness (Safety schlägt Wearable)', d1.dayState === 'RED' && d1.action === 'REST' && d1.reasons.some(r => r.code === 'red_flag_symptom') && CT.isDecisionResult(d1));
  const d2 = DE.evaluate({ readiness: GOOD_R, constraints: [{ bodyRegion: 'knee', intensity: 8, status: 'active' }], plannedSession: HARD_RUN });
  ok('D2 Schmerz 8 → RED, keine harte Einheit', d2.dayState === 'RED' && d2.action !== 'KEEP' && d2.reasons.some(r => r.code === 'severe_pain'));
  const d3 = DE.evaluate({ readiness: GOOD_R, constraints: [{ bodyRegion: 'knee', intensity: 4, status: 'active' }], plannedSession: HARD_RUN });
  ok('D3 Knie 4 + Intervalllauf → Einschränkung/Swap', d3.dayState !== 'GREEN' && ['SWAP_MODALITY', 'REDUCE_INTENSITY', 'REDUCE_VOLUME'].includes(d3.action));
  const d4 = DE.evaluate({ readiness: GOOD_R, constraints: [{ bodyRegion: 'knee', intensity: 4, status: 'active' }], plannedSession: UPPER_GYM });
  ok('D4 Knie 4 + Oberkörper → kontextueller Hinweis, KEIN Stopp', d4.action === 'KEEP' && d4.dayState === 'YELLOW' && d4.reasons.some(r => r.code === 'active_constraint'));
  const badR = RE.evaluate({ sleepMinutes: 240, sleepGoalHours: 8, sleepQuality: 2, feel: 3, soreness: 8, stress: 'High' });
  const d5 = DE.evaluate({ readiness: badR, plannedSession: HARD_RUN });
  ok('D5 sehr schlechte Erholung → keine Steigerung (RECOVERY/REST)', ['REPLACE_WITH_RECOVERY', 'REST'].includes(d5.action) && d5.dayState !== 'GREEN');
  const d6 = DE.evaluate({ readiness: GOOD_R, plannedSession: HARD_RUN, recentLoad: { acute7: 3200, chronic28PerWeek: 2000, dataDays: 21 } });
  ok('D6 Belastungssprung (Ratio 1,6) → ORANGE + Grund', d6.dayState === 'ORANGE' && d6.reasons.some(r => r.code === 'load_spike'));
  const d7 = DE.evaluate({ readiness: GOOD_R, plannedSession: HARD_RUN, recentLoad: { hardStreak: 2, dataDays: 21, acute7: 2000, chronic28PerWeek: 2000 } });
  ok('D7 zwei harte Tage in Folge → Intensität raus', d7.action !== 'KEEP' && d7.reasons.some(r => r.code === 'consecutive_hard_days'));
  const d8 = DE.evaluate({ readiness: GOOD_R, plannedSession: HARD_RUN, goalContext: { daysToEvent: 2 } });
  ok('D8 Wettkampf in 2 Tagen → entlasten (Taper)', d8.action === 'MOVE_SESSION' && d8.reasons.some(r => r.code === 'target_event_near'));
  const d9 = DE.evaluate({ readiness: { score: null, confidence: 'low', warnings: [], missingData: ['alles'] }, plannedSession: HARD_RUN });
  ok('D9 ohne Check-in → vorsichtiger + low confidence, nie optimistischer', d9.action !== 'KEEP' && d9.confidence === 'low' && d9.reasons.some(r => r.code === 'missing_checkin'));
  const d10 = DE.evaluate({ readiness: GOOD_R, illness: true, plannedSession: HARD_RUN });
  ok('D10 Krankheit → mind. ORANGE + Erholung', ['ORANGE', 'RED'].includes(d10.dayState) && d10.action === 'REPLACE_WITH_RECOVERY');
  ok('D11 jede Entscheidung erklärbar (Reasons vorhanden, sofern nicht KEEP/GREEN)', [d1, d2, d3, d5, d6, d7, d8, d9, d10].every(d => d.reasons.length > 0));
}

/* ---------- Plan: 15 Fixtures + Invarianten ---------- */
function sportsFix(level, spw, dur, extra) {
  const arr = [{ sportId: 'running', role: 'primary', includeInPlan: true, level: level, sessionsPerWeek: spw, typicalDuration: dur }];
  return arr.concat(extra || []);
}
function avFix(days, minutes) {
  const d = {}; days.forEach(k => { d[k] = { available: true, singleSession: { maxMinutes: minutes } }; });
  return { days: d };
}
function flat(week) { return week.reduce((a, d) => a.concat(d.sessions.map(s => Object.assign({ day: d.day }, s))), []); }
function invariants(name, res, input) {
  const sessions = flat(res.week);
  ok(name + ' · Vertrag', CT.isPlanResult(res));
  ok(name + ' · nur verfügbare Tage', res.week.every(d => d.sessions.length === 0 || d.available));
  ok(name + ' · keine Doppeleinheiten', res.week.every(d => d.sessions.length <= 1));
  ok(name + ' · keine negativen Minuten', sessions.every(s => s.minutes === null || s.minutes >= 0));
  const allowed = (input.sports || []).filter(s => s.includeInPlan !== false).map(s => s.sportId);
  ok(name + ' · nur aktive Sportarten', sessions.every(s => allowed.includes(s.sport)));
  ok(name + ' · mindestens 1 Ruhetag', res.week.filter(d => d.sessions.length === 0).length >= 1);
  const WD = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  const hardIdx = sessions.filter(s => s.intensity === 'hard').map(s => WD.indexOf(s.day)).sort((a, b) => a - b);
  ok(name + ' · keine harten Tage in Folge', hardIdx.every((v, i) => i === 0 || v - hardIdx[i - 1] >= 2));
  ok(name + ' · Gründe vorhanden oder Plan trivial', res.reasons.length > 0 || sessions.length <= 3);
}
const F = {};
F['1 Anfänger ohne Historie'] = { sports: sportsFix('beginner', 2, 45), availability: avFix(['di', 'do', 'sa'], 45), goal: { category: 'train_regularly' }, today: '2026-07-03' };
F['2 fortgeschrittener Läufer'] = { sports: sportsFix('advanced', 5, 60), availability: avFix(['mo', 'di', 'mi', 'do', 'fr', 'sa'], 60), goal: { category: 'half_marathon', targetDate: '2026-10-01' }, today: '2026-07-03' };
F['3 Fußballer mit Spieltag'] = { sports: [{ sportId: 'football', role: 'primary', includeInPlan: true, level: 'intermediate', sessionsPerWeek: 3, typicalDuration: 90 }], availability: avFix(['di', 'do', 'sa'], 90), goal: { category: 'game_endurance', targetDate: '2026-07-05' }, today: '2026-07-03' };
F['4 Multisport'] = { sports: sportsFix('intermediate', 4, 60, [{ sportId: 'cycling', role: 'secondary', includeInPlan: true }, { sportId: 'gym', role: 'secondary', includeInPlan: true }]), availability: avFix(['mo', 'mi', 'fr', 'so'], 60), goal: { category: 'triathlon' }, today: '2026-07-03' };
F['10 unvollständiges Profil'] = { sports: [{ sportId: 'running', role: 'primary', includeInPlan: true }], availability: avFix(['mi', 'sa'], null), goal: null, today: '2026-07-03' };
F['11 Schichtarbeiter (3 Tage)'] = { sports: sportsFix('intermediate', 3, 45), availability: avFix(['mo', 'do', 'so'], 45), goal: { category: 'keep_fit' }, today: '2026-07-03' };
F['12 zwei Trainingstage'] = { sports: sportsFix('intermediate', 4, 60), availability: avFix(['sa', 'so'], 60), goal: { category: 'base_endurance' }, today: '2026-07-03' };
F['13 sieben Tage verfügbar'] = { sports: sportsFix('competitive', 7, 75), availability: avFix(['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'], 75), goal: { category: 'marathon', targetDate: '2026-11-01' }, today: '2026-07-03' };
F['14 Wiedereinstieg'] = { sports: sportsFix('beginner', 3, 40), availability: avFix(['di', 'do', 'sa'], 40), goal: { category: 'return_after_break' }, today: '2026-07-03' };
F['7 akute Kniebeschwerde'] = { sports: sportsFix('intermediate', 4, 60), availability: avFix(['mo', 'mi', 'fr', 'so'], 60), goal: { category: 'run_10k' }, constraints: [{ bodyRegion: 'knee', intensity: 6, status: 'active' }], today: '2026-07-03' };
F['8 Ziel in 16 Wochen'] = { sports: sportsFix('intermediate', 4, 60), availability: avFix(['mo', 'mi', 'fr', 'so'], 60), goal: { category: 'half_marathon', targetDate: '2026-10-23' }, today: '2026-07-03' };
F['9 Ziel in 7 Tagen (Taper)'] = { sports: sportsFix('advanced', 5, 60), availability: avFix(['mo', 'di', 'mi', 'do', 'fr', 'sa'], 60), goal: { category: 'half_marathon', targetDate: '2026-07-10' }, today: '2026-07-03' };
Object.keys(F).forEach(name => { invariants(name, PE.build(F[name]), F[name]); });
{
  const p1 = PE.build(F['1 Anfänger ohne Historie']);
  ok('P-1 Anfänger: max 1 harte Einheit + Begründung', flat(p1.week).filter(s => s.intensity === 'hard').length <= 1 && p1.reasons.some(r => r.code === 'beginner_progression'));
  const p14 = PE.build(F['14 Wiedereinstieg']);
  ok('P-14 Wiedereinstieg: KEINE harte Einheit', flat(p14.week).every(s => s.intensity !== 'hard') && p14.reasons.some(r => r.code === 'return_after_break'));
  const p9 = PE.build(F['9 Ziel in 7 Tagen (Taper)']);
  ok('P-9 Taper: reduzierte Minuten + Grund', flat(p9.week).every(s => s.minutes === null || s.minutes <= 45) && p9.reasons.some(r => r.code === 'target_event_near'));
  const p12 = PE.build(F['12 zwei Trainingstage']);
  ok('P-12 Verfügbarkeit gewinnt: nur 2 Einheiten trotz Wunsch 4', flat(p12.week).length === 2 && p12.reasons.some(r => r.code === 'availability_limited'));
  const p13 = PE.build(F['13 sieben Tage verfügbar']);
  ok('P-13 nie 7/7: erzwungener Ruhetag', p13.volumeSummary.restDays >= 1);
  const p7 = PE.build(F['7 akute Kniebeschwerde']);
  ok('P-7 Kniebeschwerde 6: keine harten Impact-Einheiten', flat(p7.week).every(s => s.intensity !== 'hard'));
  const p10 = PE.build(F['10 unvollständiges Profil']);
  ok('P-10 unvollständig: Plan entsteht, aber confidence low + Gründe', p10.confidence === 'low' && p10.reasons.some(r => r.code === 'low_data_confidence'));
  const p4 = PE.build(F['4 Multisport']);
  ok('P-4 Multisport: Sekundärsport taucht auf, Hauptsport dominiert', flat(p4.week).some(s => s.sport !== 'running') && flat(p4.week).filter(s => s.sport === 'running').length >= flat(p4.week).length / 2);
}
/* Fixtures 5/6/15 (schlechte Nacht / hohe Last / Überlastungsrisiko) → Decision-Ebene */
{
  const nightR = RE.evaluate({ sleepMinutes: 250, sleepGoalHours: 8, sleepQuality: 3, feel: 4, soreness: 5, stress: 'Med' });
  const d5f = DE.evaluate({ readiness: nightR, plannedSession: HARD_RUN });
  ok('F-5 schlechte Nacht → keine harte Einheit', d5f.action !== 'KEEP');
  const d6f = DE.evaluate({ readiness: GOOD_R, plannedSession: HARD_RUN, recentLoad: { acute7: 2600, chronic28PerWeek: 2000, dataDays: 28 } });
  ok('F-6 hohe Trainingslast → Warnung/YELLOW', d6f.dayState !== 'GREEN' && d6f.reasons.some(r => ['high_recent_load', 'load_spike'].includes(r.code)));
  const d15 = DE.evaluate({ readiness: RE.evaluate({ sleepMinutes: 330, sleepGoalHours: 8, sleepQuality: 4, feel: 5, soreness: 7, stress: 'High' }), plannedSession: HARD_RUN, recentLoad: { acute7: 3300, chronic28PerWeek: 2000, dataDays: 28, hardStreak: 2 } });
  ok('F-15 Überlastungsrisiko → ORANGE/RED + mehrere Gründe', ['ORANGE', 'RED'].includes(d15.dayState) && d15.reasons.length >= 2);
}

/* ---------- C5 · Alt/Neu-Vergleich (calc.js) ---------- */
{
  globalThis.window = globalThis;   // calc.js erwartet Browser-Globals tolerant
  const Calc = (await import(new URL(_APPREL + 'js/calc.js', import.meta.url))).default;
  // Vergleich 1: gute Nacht — beide Engines im grünen Bereich.
  const mGood = { sleepMin: 460, sleepQ: 8, feel: 8, doms: 1, stress: 'Low', knee: 0 };
  const oldR = Calc.readiness(mGood, {});
  const newR = RE.evaluate({ sleepMinutes: 460, sleepQuality: 8, feel: 8, soreness: 1, stress: 'Low' });
  ok('V1 gute Nacht: Alt und Neu beide ≥75', oldR.score >= 75 && newR.score >= 75, 'alt=' + oldR.score + ' neu=' + newR.score);
  // Vergleich 2: leere Eingabe — Alt liefert (renormalisiert) irgendetwas, Neu ehrlich null.
  const oldEmpty = Calc.readiness({}, {});
  const newEmpty = RE.evaluate({});
  ok('V2 DOKUMENTIERTE DIFFERENZ: leerer Check-in — neu ehrlich ohne Score', newEmpty.score === null, 'alt=' + (oldEmpty && oldEmpty.score) + ' neu=null (beabsichtigt: keine erfundene Zahl)');
  // Vergleich 3: Safety — beide RED bei Schmerz 8 (alte Engine via buildTrainingDecision).
  const oldDec = Calc.buildTrainingDecision({ checkin: Object.assign({}, mGood, { pain: 8 }), components: { recovery: oldR.score }, loads: { load3: 100, load7: 100 }, plannedToday: { t: 'Laufen', hard: true }, profile: {}, dataQuality: { days: 30 } });
  const newDec = DE.evaluate({ readiness: newR, constraints: [{ bodyRegion: 'knee', intensity: 8, status: 'active' }], plannedSession: HARD_RUN });
  ok('V3 Schmerz 8: Alt RED == Neu RED (Safety-Parität)', oldDec.dayState === 'RED' && newDec.dayState === 'RED');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
