/* ============================================================
   ORVIA · Batch 3a — Goal-Portfolio-Factory (Zielportfolio + Verträge)
   A  Reinheit/Determinismus/Idempotenz/Nicht-Mutation (+ Quelltext ohne
      UI-/Storage-/Zeitquellen-Zugriffe)
   B  Rollen & Fokus: Nutzerpriorität schlägt Dringlichkeit; fehlende
      Priorität ⇒ low confidence statt erfundener Ordnung; dual-top
   C  Budgets: Ranges, keine Doppelverbuchung (Summe der Obergrenzen ≤ 1)
   D  Zielwert wird NIE Capacity (aspiration; capacity bleibt null)
   E  Fail-closed: vergangenes/ungültiges Zieldatum, unbekannte Zielart,
      keine Ziele
   F  Mehrjahres-Abhängigkeiten HM→70.3→IM + Mindestdosen + Sport-Setup
   G  Gesundheitsziel verschärft Safety, umgeht sie nie
   H  stale/conflict-Inputs senken Confidence; konkurrierende Wettkämpfe;
      injizierter Konfliktdetektor (profile-model, EINE Quelle)
   K  Gian-Golden-Szenario (Referenz §3, Fixture — keine App-Defaults)
   node supabase/tests/batch3a_goal_portfolio_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL(_APPREL + 'js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');

function mkSb() {
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = console; sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Object = Object;
  sb.Array = Array; sb.String = String; sb.Number = Number; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.RegExp = RegExp; sb.Error = Error; sb.Intl = Intl;
  vm.createContext(sb);
  ['training-domain.js', 'activity-config.js', 'profile-model.js', 'engine/goal-portfolio.js'].forEach(f =>
    vm.runInContext(src(f), sb, { filename: f }));
  return sb;
}
const sb = mkSb();
const GP = sb.ORVIA.goalPortfolio;
const PM = sb.ORVIA.profileModel;
const AC = sb.ORVIA.activityConfig;

const NOW = Date.parse('2026-07-15T08:00:00Z');
const TODAY = '2026-07-15';
function mkSnap(over) {
  return Object.assign({
    schemaVersion: 1, now: NOW, timezone: 'Europe/Berlin', today: TODAY,
    goals: [], sports: [{ sportId: 'running', activeInApp: true }, { sportId: 'gym', activeInApp: true }],
    availability: { availableDayIdx: [0, 1, 2, 4, 5, 6], targetDays: 5, source: 'availability' },
    dataQuality: { missing: [] }
  }, over || {});
}
function goalsOf(list) { return PM.normalizeGoals(list, '2026-07-01T00:00:00.000Z'); }
function deepFreeze(o) { if (o && typeof o === 'object') { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }
const alloc = (p, id) => p.allocations.filter(a => a.goalId === id)[0];

/* ---------- A: Reinheit / Determinismus ---------- */
{
  const raw = src('engine/goal-portfolio.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('A1 Quelle ohne DOM/Storage/Globals/eigene Zeitquelle',
    !/\bdocument\./.test(raw) && !/\blocalStorage\b/.test(raw) && !/\bPROFILE\b/.test(raw) &&
    !/Date\.now\s*\(/.test(raw) && !/Math\.random\s*\(/.test(raw) && !/new Date\(\s*\)/.test(raw));
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16', metricType: 'time', targetValue: 6600, unit: 's' },
    { id: 'g:knee', title: 'Knie', category: 'stabilize_knee', priority: 3 }
  ]);
  const snap = deepFreeze(mkSnap({ goals }));
  const before = JSON.stringify(snap);
  const p1 = GP.buildPortfolio(snap, {});
  const p2 = GP.buildPortfolio(snap, {});
  ok('A2 deterministisch/idempotent: zweifacher Aufruf byte-stabil', JSON.stringify(p1) === JSON.stringify(p2));
  ok('A3 nicht mutierend: Snapshot byte-identisch (auch unter Object.freeze)', JSON.stringify(snap) === before);
  p1.allocations.length && (p1.allocations[0].role = 'KAPUTT'); p1.focusGoalId = 'KAPUTT';
  const p3 = GP.buildPortfolio(snap, {});
  ok('A4 Rückgabe entkoppelt: Mutation des Ergebnisses beeinflusst Folgeaufruf nicht', p3.focusGoalId === 'g:hm' && p3.allocations[0].role !== 'KAPUTT');
  ok('A5 asOf nur aus injizierter Uhr (snapshot.now)', p3.asOf === new Date(NOW).toISOString());
}

/* ---------- B: Nutzerpriorität, Fokus, fehlende Ordnung ---------- */
{
  // B1 Priorität schlägt Dringlichkeit: p2-Ziel hat das NÄHERE Datum.
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-12-06', metricType: 'time', targetValue: 6600 },
    { id: 'g:10k', title: '10k', category: 'run_10k', priority: 2, targetDate: '2026-08-01' }
  ]);
  const p = GP.buildPortfolio(mkSnap({ goals }), {});
  ok('B1 Fokus bleibt beim Prioritäts-1-Ziel trotz näherem Fremddatum',
    p.focusGoalId === 'g:hm' && alloc(p, 'g:hm').role === 'main' && alloc(p, 'g:10k').role === 'secondary');
  ok('B1b Dringlichkeit wird EXPLIZIT als Konflikt ausgewiesen, nicht still',
    p.conflicts.some(c => c.conflictType === 'urgency_vs_priority') &&
    alloc(p, 'g:10k').rationaleCodes.indexOf('urgency_does_not_override_priority') >= 0);
  // B2 fehlende Priorität (keine 1) ⇒ kein erfundener Fokus, low confidence.
  const g2 = goalsOf([
    { id: 'g:a', title: 'A', category: 'run_10k', priority: 3, targetDate: '2026-09-01' },
    { id: 'g:b', title: 'B', category: 'half_marathon', priority: 3, targetDate: '2026-10-01' }
  ]);
  const p2 = GP.buildPortfolio(mkSnap({ goals: g2 }), {});
  ok('B2 keine Prio-1 ⇒ focus null, KEIN main, confidence low, ehrliche Annahme',
    p2.focusGoalId === null && !p2.allocations.some(a => a.role === 'main') && p2.confidence === 'low' &&
    p2.assumptions.some(a => a.code === 'no_user_priority_no_focus_invented') &&
    p2.missingData.some(m => m.path === 'goals.priority'));
  // B3 zwei Top-Ziele ⇒ deterministischer Tiebreak (früheres Datum) + expliziter Konflikt.
  const g3 = goalsOf([
    { id: 'g:x', title: 'X', category: 'run_10k', priority: 1, targetDate: '2026-10-01' },
    { id: 'g:y', title: 'Y', category: 'half_marathon', priority: 1, targetDate: '2026-09-01' }
  ]);
  const p3 = GP.buildPortfolio(mkSnap({ goals: g3 }), {});
  ok('B3 dual-top: Fokus = früheres Datum, zweites Ziel gestaffelt, Konflikt explizit',
    p3.focusGoalId === 'g:y' && p3.conflicts.some(c => c.conflictType === 'dual_top_priority') &&
    alloc(p3, 'g:x').mode === 'staggered');
}

/* ---------- C: Budgets ohne Doppelverbuchung ---------- */
{
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16', metricType: 'time', targetValue: 6600 },
    { id: 'g:703', title: '70.3', category: 'half_ironman', priority: 2, targetDate: '2027-08-01' },
    { id: 'g:im', title: 'IM', category: 'ironman', priority: 4, targetDate: '2028-08-06', metricType: 'time', targetValue: 36000 },
    { id: 'g:knee', title: 'Knie', category: 'stabilize_knee', priority: 3 }
  ]);
  const p = GP.buildPortfolio(mkSnap({ goals }), {});
  const b = p.allocations.filter(a => a.weeklyBudgetRange);
  const sumMax = b.reduce((s, a) => s + a.weeklyBudgetRange.max, 0);
  ok('C1 alle Budgets sind Ranges (min ≤ max) in Anteilen, Summe max ≤ 1',
    b.length === 4 && b.every(a => a.weeklyBudgetRange.min <= a.weeklyBudgetRange.max &&
      a.weeklyBudgetRange.unit === 'share_of_available_training_budget') && sumMax <= 1.0001, 'sumMax=' + sumMax);
  // C2 viele Ziele erzwingen Normalisierung.
  const many = goalsOf([
    { id: 'g:1', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' },
    { id: 'g:2', title: 'A', category: 'get_stronger', priority: 2 },
    { id: 'g:3', title: 'B', category: 'run_5k', priority: 2, targetDate: '2026-12-01' },
    { id: 'g:4', title: 'C', category: 'improve_mobility', priority: 3 },
    { id: 'g:5', title: 'D', category: 'keep_fit', priority: 3 },
    { id: 'g:6', title: 'E', category: 'improve_sleep', priority: 3 }
  ]);
  const pm = GP.buildPortfolio(mkSnap({ goals: many }), {});
  const bm = pm.allocations.filter(a => a.weeklyBudgetRange);
  const sm = bm.reduce((s, a) => s + a.weeklyBudgetRange.max, 0);
  ok('C2 Überzeichnung ⇒ proportionale Normalisierung mit Reason-Code, Summe ≤ 1',
    sm <= 1.0001 && bm.some(a => a.rationaleCodes.indexOf('budget_normalized_no_double_booking') >= 0), 'sum=' + sm);
}

/* ---------- D: Zielwert wird NIE Capacity ---------- */
{
  const goals = goalsOf([{ id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16', metricType: 'time', targetValue: 6600, unit: 's' }]);
  const p = GP.buildPortfolio(mkSnap({ goals }), {});
  const a = alloc(p, 'g:hm');
  ok('D1 target.interpretation=aspiration + Reason-Code + capacity bleibt null',
    a.target && a.target.interpretation === 'aspiration' && a.target.value === 6600 &&
    a.rationaleCodes.indexOf('target_is_aspiration_not_capacity') >= 0 && p.capacity === null);
  ok('D2 keine absoluten Volumen-/Pace-Vorgaben im Portfolio (nur Anteils-Budgets)',
    p.allocations.every(x => !x.weeklyBudgetRange || x.weeklyBudgetRange.unit === 'share_of_available_training_budget') &&
    !/min\/km|paceTarget|weeklyKm/.test(JSON.stringify(p)));
}

/* ---------- E: Fail-closed ---------- */
{
  const past = goalsOf([{ id: 'g:old', title: 'Alt', category: 'run_10k', priority: 1, targetDate: '2026-05-01' }]);
  const p1 = GP.buildPortfolio(mkSnap({ goals: past }), {});
  const a1 = alloc(p1, 'g:old');
  ok('E1 vergangenes Zieldatum ⇒ needs_review + target_date_past, kein Budget, kein Fokus',
    p1.focusGoalId === null && a1.mode === 'needs_review' && a1.weeklyBudgetRange === null &&
    a1.rationaleCodes.indexOf('target_date_past') >= 0 && a1.confidence === 'low' &&
    p1.missingData.some(m => m.path === 'goals.g:old.targetDate' && m.kind === 'error'));
  // E2 ungültiges Datum (Factory-Vertrag direkt, an normalizeGoal vorbei).
  const p2 = GP.buildPortfolio(mkSnap({ goals: [{ id: 'g:bad', status: 'active', priority: 1, category: 'run_10k', group: 'endurance', targetDate: '2026-13-99' }] }), {});
  const a2 = alloc(p2, 'g:bad');
  ok('E2 ungültiges Zieldatum ⇒ fail-closed needs_review + target_date_invalid',
    a2.mode === 'needs_review' && a2.rationaleCodes.indexOf('target_date_invalid') >= 0 && p2.focusGoalId === null);
  // E3 unbekannte Zielart.
  const p3 = GP.buildPortfolio(mkSnap({ goals: [{ id: 'g:zz', status: 'active', priority: 2, category: 'zzz_neu', group: 'zzz_gruppe' }] }), {});
  const a3 = alloc(p3, 'g:zz');
  ok('E3 unbekannte Zielart ⇒ kontrolliert: needs_review, KEIN erfundenes Budget, low',
    a3.kind === 'unknown' && a3.mode === 'needs_review' && a3.weeklyBudgetRange === null &&
    a3.rationaleCodes.indexOf('unknown_goal_type_conservative') >= 0 && a3.confidence === 'low');
  // E4 keine Ziele.
  const p4 = GP.buildPortfolio(mkSnap({ goals: [] }), {});
  ok('E4 keine Ziele ⇒ leere Allokation, missing goals, low confidence, nichts erfunden',
    p4.allocations.length === 0 && p4.focusGoalId === null && p4.confidence === 'low' &&
    p4.missingData.some(m => m.path === 'goals'));
  // E5 pausiertes Ziel bleibt sichtbar, Budget 0.
  const p5 = GP.buildPortfolio(mkSnap({ goals: goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' },
    { id: 'g:p', title: 'Pause', category: 'run_5k', priority: 2, status: 'paused' }]) }), {});
  const a5 = alloc(p5, 'g:p');
  ok('E5 paused ⇒ mode paused, Budget 0–0, Reason user_paused',
    a5 && a5.mode === 'paused' && a5.weeklyBudgetRange.min === 0 && a5.weeklyBudgetRange.max === 0 &&
    a5.rationaleCodes.indexOf('user_paused') >= 0);
}

/* ---------- F: Mehrjahres-Abhängigkeiten + Mindestdosen ---------- */
{
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16', metricType: 'time', targetValue: 6600 },
    { id: 'g:703', title: '70.3', category: 'half_ironman', priority: 2, targetDate: '2027-08-01' },
    { id: 'g:im', title: 'IM Sub-10', category: 'ironman', priority: 4, targetDate: '2028-08-06', metricType: 'time', targetValue: 36000 }
  ]);
  const sportsAll = [{ sportId: 'running', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'swimming', activeInApp: true }, { sportId: 'gym', activeInApp: true }];
  const p = GP.buildPortfolio(mkSnap({ goals, sports: sportsAll }), {});
  const caps = p.dependencies.map(d => d.capability).sort().join(',');
  ok('F1 Portfolio-Abhängigkeiten decken die volle Kette ab',
    ['bike_base', 'brick_experience', 'fueling_gut_training', 'race_experience', 'run_durability', 'strength_stability', 'swim_technique'].every(c => caps.indexOf(c) >= 0), caps);
  const a703 = alloc(p, 'g:703'), aim = alloc(p, 'g:im');
  ok('F2 70.3 secondary: develop + Mindestdosis Schwimmtechnik ≥1×/Woche',
    a703.role === 'secondary' && a703.mode === 'develop' &&
    (a703.minimumDose || []).some(d => d.capability === 'swim_technique' && d.min === 1 && d.status === 'active_floor'));
  ok('F3 IM longterm: foundation, Budget-Obergrenze ≤ 0.05 (kein verfrühtes Spitzenvolumen), Mindestdosen statt Volumen',
    aim.role === 'longterm' && aim.mode === 'foundation' && aim.weeklyBudgetRange.max <= 0.05 &&
    (aim.minimumDose || []).length > 0 && aim.rationaleCodes.indexOf('longterm_dependency_floor') >= 0);
  ok('F4 Transitionen HM→70.3→IM deklariert (Terminierung an Batch 4 delegiert)',
    p.transitionPlan.length === 2 && p.transitionPlan[0].fromGoalId === 'g:hm' && p.transitionPlan[0].toGoalId === 'g:703' &&
    p.transitionPlan[1].toGoalId === 'g:im' && p.transitionPlan.every(t => t.scheduling === 'deferred_to_batch_4'));
  // F5 Schwimmen NICHT eingerichtet ⇒ setup_required + missing, nichts erfunden.
  const p2 = GP.buildPortfolio(mkSnap({ goals, sports: [{ sportId: 'running', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'gym', activeInApp: true }] }), {});
  const d2 = p2.dependencies.filter(d => d.capability === 'swim_technique')[0];
  ok('F5 fehlende Sportart ⇒ Abhängigkeit setup_required + missingData + Reason-Code',
    d2 && d2.status === 'setup_required' && p2.missingData.some(m => m.path === 'sports.swimming') &&
    alloc(p2, 'g:703').rationaleCodes.indexOf('sport_setup_required') >= 0);
}

/* ---------- G: Gesundheitsziel verschärft Safety, umgeht sie nie ---------- */
{
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' },
    { id: 'g:knee', title: 'Knie stabilisieren', category: 'stabilize_knee', priority: 3 }
  ]);
  const p = GP.buildPortfolio(mkSnap({ goals }), {});
  const a = alloc(p, 'g:knee');
  ok('G1 safetyPolicy tighten_only + safety_gate-Abhängigkeit Richtung tighten',
    p.safetyPolicy === 'tighten_only' && a.dependencies.some(d => d.capability === 'safety_gate' && d.direction === 'tighten') &&
    a.rationaleCodes.indexOf('health_safety_tighten_only') >= 0);
  ok('G2 keine Lockerungsrichtung im gesamten Portfolio; Mindestdosis = Frequenz statt Volumen',
    !/"direction":"relax"/.test(JSON.stringify(p)) &&
    (a.minimumDose || []).some(d => d.capability === 'stability_work' && d.min === 2));
}

/* ---------- H: Datenqualität, konkurrierende Wettkämpfe, Konfliktquelle ---------- */
{
  const goals = goalsOf([{ id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' }]);
  const p = GP.buildPortfolio(mkSnap({ goals, dataQuality: { missing: [{ path: 'metrics.rhr', kind: 'stale' }] } }), {});
  ok('H1 stale Input senkt Portfolio-Confidence + explizite Annahme',
    p.confidence !== 'high' && p.assumptions.some(a => a.code === 'input_quality_reduced'));
  const races = goalsOf([
    { id: 'g:r1', title: 'R1', category: 'run_10k', priority: 1, targetDate: '2026-09-06' },
    { id: 'g:r2', title: 'R2', category: 'half_marathon', priority: 2, targetDate: '2026-09-20' }
  ]);
  const p2 = GP.buildPortfolio(mkSnap({ goals: races }), {});
  ok('H2 Wettkämpfe < 42 Tage auseinander ⇒ expliziter competing_races-Konflikt mit Staffelung',
    p2.conflicts.some(c => c.conflictType === 'competing_races' && c.strategy === 'staggering'));
  // H3 physiologische Konflikte kommen aus profile-model (EINE Quelle, injiziert).
  const mix = goalsOf([
    { id: 'g:im', title: 'IM', category: 'ironman', priority: 1, targetDate: '2028-08-06' },
    { id: 'g:hyp', title: 'Masse', category: 'hypertrophy', priority: 2 }
  ]);
  const p3 = GP.buildPortfolio(mkSnap({ goals: mix }), { conflictDetector: PM.detectGoalConflicts });
  ok('H3 injizierter profile-model-Detektor liefert hypertrophy_vs_endurance ins Portfolio',
    p3.conflicts.some(c => c.conflictType === 'hypertrophy_vs_endurance'));
}

/* ---------- K: Gian-Golden-Szenario (Fixture, keine App-Defaults) ---------- */
{
  const goals = goalsOf([
    { id: 'g:hm', title: 'Halbmarathon unter 1:50', category: 'half_marathon', priority: 1, targetDate: '2026-09-16', metricType: 'time', targetValue: 6600, unit: 's' },
    { id: 'g:703', title: '70.3 2027', category: 'half_ironman', priority: 2, targetDate: '2027-08-01' },
    { id: 'g:im', title: 'Ironman Sub-10 2028', category: 'ironman', priority: 4, targetDate: '2028-08-06', metricType: 'time', targetValue: 36000, unit: 's' },
    { id: 'g:knee', title: 'Knie links stabilisieren', category: 'stabilize_knee', priority: 3 }
  ]);
  const sports = [
    { sportId: 'running', activeInApp: true }, { sportId: 'cycling', activeInApp: true },
    { sportId: 'swimming', activeInApp: true }, { sportId: 'gym', activeInApp: true },
    { sportId: 'football', activeInApp: true, role: 'occasional' }
  ];
  // Long Run 12,41 km in DREI direkt aufeinanderfolgenden Aufzeichnungen (Batch-2-Golden-Fall).
  const acts = [
    { clientRecordId: 'a1', sportId: 'run', startedAt: '2026-07-12T07:30:00Z', durationSeconds: 1860, summary: { distanceKm: 5.2 } },
    { clientRecordId: 'a2', sportId: 'run', startedAt: '2026-07-12T08:03:00Z', durationSeconds: 1500, summary: { distanceKm: 4.0 } },
    { clientRecordId: 'a3', sportId: 'run', startedAt: '2026-07-12T08:30:00Z', durationSeconds: 1260, summary: { distanceKm: 3.21 } },
    { clientRecordId: 'b1', sportId: 'ride', startedAt: '2026-07-11T09:00:00Z', durationSeconds: 5400, summary: { distanceKm: 40 } }
  ];
  const evidence = GP.evidenceFromActivities(acts, { groupSessions: AC.groupActivitySessions, sportId: 'running' });
  ok('K1 Evidenz: 3 Teilaufzeichnungen ⇒ EINE gruppierte 12,41-km-Einheit (Batch-2-Gruppierung)',
    evidence && evidence.longestGroupedSession.distKm === 12.41 && evidence.longestGroupedSession.segments === 3 &&
    evidence.longestGroupedSession.activityRefs.length === 3, JSON.stringify(evidence));
  const snap = deepFreeze(mkSnap({ goals, sports, availability: { availableDayIdx: [0, 1, 2, 4, 5, 6], targetDays: 5, source: 'availability' } }));
  const p = GP.buildPortfolio(snap, { evidence, conflictDetector: PM.detectGoalConflicts });
  const hm = alloc(p, 'g:hm'), tri = alloc(p, 'g:703'), im = alloc(p, 'g:im');
  ok('K2 HM ist Fokus (main/focus) mit Fokusbudget ≥ 0.60 und ~9 Wochen Restzeit',
    p.focusGoalId === 'g:hm' && hm.role === 'main' && hm.mode === 'focus' &&
    hm.weeklyBudgetRange.max >= 0.6 && hm.daysToTarget === 63, 'daysToTarget=' + hm.daysToTarget);
  ok('K3 70.3 nur Nebenentwicklungs-/Mindestdosisbudget (≤ 0.20) mit Schwimm-/Rad-Floors',
    tri.role === 'secondary' && tri.weeklyBudgetRange.max <= 0.2 &&
    (tri.minimumDose || []).some(d => d.capability === 'swim_technique') &&
    (tri.minimumDose || []).some(d => d.capability === 'bike_base'));
  ok('K4 IM Sub-10 = langfristige Richtung mit Abhängigkeiten, KEINE aktuelle Volumenvorgabe',
    im.role === 'longterm' && im.mode === 'foundation' && im.weeklyBudgetRange.max <= 0.05 &&
    im.dependencies.length >= 7 && im.target.interpretation === 'aspiration');
  ok('K5 Zielzeiten sind Aspiration, capacity null — Zielpace wird nirgends Capacity',
    hm.target.interpretation === 'aspiration' && p.capacity === null &&
    !/4:42|min\/km/.test(JSON.stringify(p)));
  const refCount = (JSON.stringify(p.allocations).match(new RegExp(evidence.longestGroupedSession.groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  ok('K6 12,41-km-Evidenz wird GENAU EINMAL referenziert (am Fokusziel)',
    refCount === 1 && (hm.evidenceRefs || []).length === 1 && hm.evidenceRefs[0].kind === 'longest_grouped_session');
  ok('K7 keine endgültigen Erfolgsversprechen; Feasibility explizit auf 3c verschoben',
    p.assumptions.some(a => a.code === 'no_finality') &&
    !/garantiert|sicher erreichbar|machbar/.test(JSON.stringify(p)));
  ok('K8 Constraints (z. B. Donnerstag-Ruhetag) werden getragen, aber NICHT terminiert (Batch 4)',
    p.horizons && p.horizons.next7Days.constraintsCarried === true &&
    p.horizons.next7Days.prescriptionLevel === 'deferred_to_batch_4' &&
    JSON.stringify(snap.availability) === JSON.stringify({ availableDayIdx: [0, 1, 2, 4, 5, 6], targetDays: 5, source: 'availability' }));
  ok('K9 Mehrjahres-Roadmap deklarativ: HM (2026) → 70.3 (2027) → IM (2028)',
    p.horizons.multiYear.roadmap.map(r => r.goalId).join(',') === 'g:hm,g:703,g:im' &&
    p.horizons.multiYear.prescriptionLevel === 'declarative_only');
  ok('K10 Knieziel: Safety wird verschärft (tighten), Fußball-/Gym-Kontext ohne Doppelverbuchung',
    alloc(p, 'g:knee').dependencies.some(d => d.capability === 'safety_gate' && d.direction === 'tighten') &&
    p.allocations.filter(a => a.weeklyBudgetRange).reduce((s, a) => s + a.weeklyBudgetRange.max, 0) <= 1.0001);
}

/* ============================================================
   Batch 3a.1 — Korrekturfälle (Vorher-Zustand jeweils reproduziert rot)
   ============================================================ */

/* ---------- N1 (Punkt 1): Rolle ≠ aktuelle Allokation ---------- */
{
  const g = goalsOf([
    { id: 'g:x', title: 'X', category: 'run_10k', priority: 1, targetDate: '2026-10-01' },
    { id: 'g:y', title: 'Y', category: 'half_marathon', priority: 1, targetDate: '2026-09-01' }
  ]);
  const p = GP.buildPortfolio(mkSnap({ goals: g }), {});
  const ax = alloc(p, 'g:x'), ay = alloc(p, 'g:y');
  const sum = p.allocations.filter(a => a.weeklyBudgetRange).reduce((s, a) => s + a.weeklyBudgetRange.max, 0);
  ok('N1 zwei Prio-1-Ziele ⇒ BEIDE role main, genau ein focus, zweites staggered (keine gefälschte Rolle)',
    ax.role === 'main' && ay.role === 'main' && ay.mode === 'focus' && ax.mode === 'staggered' &&
    p.allocations.filter(a => a.mode === 'focus').length === 1,
    JSON.stringify({ x: [ax.role, ax.mode], y: [ay.role, ay.mode] }));
  ok('N1b reduziertes Budget des zweiten Hauptziels über budgetPolicy erklärt, Konflikt explizit, Summe ≤ 1',
    ax.budgetPolicy === 'reduced_while_staggered' && ay.budgetPolicy === 'role_default' &&
    p.conflicts.some(c => c.conflictType === 'dual_top_priority') && sum <= 1.0001, 'sum=' + sum);
}

/* ---------- N2 (Punkt 2): strikte Prioritätsvalidierung ---------- */
{
  const mk = (pr) => ({ id: 'g:p', status: 'active', title: 'P', category: 'run_10k', group: 'endurance', priority: pr, targetDate: '2026-10-01' });
  const cases = [5, 0, -1, NaN, '2', null, undefined, 2.5];
  const bad = cases.map(pr => {
    const p = GP.buildPortfolio(mkSnap({ goals: [mk(pr)] }), {});
    const a = alloc(p, 'g:p');
    return p.focusGoalId === null && a.mode === 'needs_review' && a.role === null && a.weeklyBudgetRange === null &&
      a.rationaleCodes.indexOf('invalid_priority') >= 0 && a.confidence === 'low' &&
      p.missingData.some(m => m.path === 'goals.g:p.priority' && m.kind === 'error');
  });
  ok('N2 ungültige Prioritäten (5/0/-1/NaN/String/fehlend/2.5) ⇒ needs_review, kein Fokus, kein Budget, Missingness je Ziel-ID',
    bad.every(Boolean), JSON.stringify(cases.map((c, i) => [String(c), bad[i]])));
  ok('N2b KEINE stille Abbildung 5→longterm (roleOf strikt, 1–4 bleiben gültig)',
    GP.roleOf({ priority: 5 }) === null && GP.roleOf({ priority: '2' }) === null &&
    GP.roleOf({ priority: 1 }) === 'main' && GP.roleOf({ priority: 4 }) === 'longterm');
}

/* ---------- N3 (Punkt 3): Kategorien fail-closed, kanonische Katalogquelle ---------- */
{
  ok('N3 kanonische Quelle profileModel.isKnownGoalCategory (inkl. Aliase + TIME-Lücke, unbekannt=false)',
    PM.isKnownGoalCategory('half_ironman') === true && PM.isKnownGoalCategory('halfmarathon') === true &&
    PM.isKnownGoalCategory('custom') === true && PM.isKnownGoalCategory('zzz_neu') === false && PM.isKnownGoalCategory(null) === false);
  // Nach kanonischer Normalisierung: zzz_neu bekommt group 'general' — bleibt trotzdem unknown.
  const norm = goalsOf([{ id: 'g:zz', title: 'Z', category: 'zzz_neu', priority: 2 }]);
  ok('N3b Vorbedingung: Normalizer setzt unbekannte Kategorie auf group general (der 3a-Bugpfad)',
    norm[0].group === 'general' && norm[0].category === 'zzz_neu');
  const p = GP.buildPortfolio(mkSnap({ goals: norm }), {});
  const a = alloc(p, 'g:zz');
  ok('N3c unbekannte Kategorie NACH normalizeGoals ⇒ unknown/needs_review, KEIN Budget (vorher: general mit Budget)',
    a.kind === 'unknown' && a.mode === 'needs_review' && a.weeklyBudgetRange === null &&
    a.rationaleCodes.indexOf('unknown_goal_type_conservative') >= 0 &&
    p.missingData.some(m => m.path === 'goals.g:zz.category'));
  // custom bleibt eine gültige bekannte Kategorie.
  const pc = GP.buildPortfolio(mkSnap({ goals: goalsOf([{ id: 'g:c', title: 'Eigenes', category: 'custom', priority: 2 }]) }), {});
  ok('N3d custom bleibt bekannt und erhält reguläre Allokation', alloc(pc, 'g:c').mode === 'develop' && alloc(pc, 'g:c').weeklyBudgetRange !== null);
}

/* ---------- N4 (Punkt 4): strikte Kalenderdaten ---------- */
{
  const badDates = ['2027-02-29', '2027-02-30', '2026-04-31', '2027-13-01', '2026-09-16xyz'];
  const results = badDates.map(d => {
    const p = GP.buildPortfolio(mkSnap({ goals: [{ id: 'g:d', status: 'active', title: 'D', category: 'run_10k', group: 'endurance', priority: 1, targetDate: d }] }), {});
    const a = alloc(p, 'g:d');
    return a.mode === 'needs_review' && a.rationaleCodes.indexOf('target_date_invalid') >= 0 && a.weeklyBudgetRange === null && p.focusGoalId === null;
  });
  ok('N4 2027-02-29 / 2027-02-30 / 2026-04-31 / Monat 13 / angehängter Text ⇒ ungültig, needs_review, kein Fokus/Budget',
    results.every(Boolean), JSON.stringify(badDates.map((d, i) => [d, results[i]])));
  const pOk = GP.buildPortfolio(mkSnap({ goals: [{ id: 'g:s', status: 'active', title: 'S', category: 'run_10k', group: 'endurance', priority: 1, targetDate: '2028-02-29' }] }), {});
  ok('N4b Gegenprobe: gültiges Schaltjahrdatum 2028-02-29 wird regulär allokiert (Roundtrip-genau)',
    pOk.focusGoalId === 'g:s' && alloc(pOk, 'g:s').mode === 'focus' && alloc(pOk, 'g:s').daysToTarget > 0);
}

/* ---------- N5 (Punkt 5): Confidence an zielrelevante Missingness ---------- */
{
  const triGoals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' },
    { id: 'g:703', title: '70.3', category: 'half_ironman', priority: 2, targetDate: '2027-08-01' },
    { id: 'g:im', title: 'IM', category: 'ironman', priority: 4, targetDate: '2028-08-06' }
  ]);
  const sportsFull = [{ sportId: 'running', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'swimming', activeInApp: true }, { sportId: 'gym', activeInApp: true }];
  const sportsNoSwim = sportsFull.filter(s => s.sportId !== 'swimming');
  const pFull = GP.buildPortfolio(mkSnap({ goals: triGoals, sports: sportsFull }), {});
  const pOne = GP.buildPortfolio(mkSnap({ goals: triGoals, sports: sportsNoSwim }), {});
  const pNone = GP.buildPortfolio(mkSnap({ goals: goalsOf([{ id: 'g:im', title: 'IM', category: 'ironman', priority: 1, targetDate: '2028-08-06' }]), sports: null }), {});
  ok('N5 Ironman ohne Sportdaten (alle sportgebundenen Abhängigkeiten setup_required) ⇒ low (vorher: high)',
    pNone.confidence === 'low' && pNone.dependencies.filter(d => d.sports.length > 0).length >= 4 &&
    pNone.dependencies.filter(d => d.sports.length > 0).every(d => d.status === 'setup_required'));
  ok('N5b genau eine fehlende Nebenabhängigkeit (Schwimmen) ⇒ höchstens medium',
    pOne.confidence !== 'high' && pOne.confidence !== 'low', pOne.confidence);
  ok('N5c vollständige Ziel-/Sportbasis ⇒ high möglich', pFull.confidence === 'high');
  const rank = { high: 2, medium: 1, low: 0 };
  ok('N5d Monotonie: mehr zielrelevante Missingness erhöht Confidence nie',
    rank[pFull.confidence] >= rank[pOne.confidence] && rank[pOne.confidence] >= rank[pNone.confidence]);
  const keys = pOne.missingData.map(m => m.path + '|' + m.kind);
  ok('N5e missingData dedupliziert (kein Pfad+Art doppelt)', new Set(keys).size === keys.length, JSON.stringify(keys));
}

/* ---------- N6 (Punkt 6): Konflikte unabhängig von Fokus und Uhr ---------- */
{
  const races = goalsOf([
    { id: 'g:r1', title: 'R1', category: 'run_10k', priority: 2, targetDate: '2026-09-06' },
    { id: 'g:r2', title: 'R2', category: 'half_marathon', priority: 2, targetDate: '2026-09-27' }
  ]);
  const pNoFocus = GP.buildPortfolio(mkSnap({ goals: races }), {});
  ok('N6 zwei Prio-2-Wettkämpfe < 42 Tage OHNE Prio-1-Ziel ⇒ competing_races trotzdem erkannt (vorher: gar nicht)',
    pNoFocus.focusGoalId === null && pNoFocus.conflicts.some(c => c.conflictType === 'competing_races'));
  const pNoClock = GP.buildPortfolio(mkSnap({ goals: races, now: null, today: null }), {});
  ok('N6b auch OHNE Uhr erkannt (nur die beiden Zielkalenderdaten nötig); Dringlichkeitskonflikte verlangen weiter eine Uhr',
    pNoClock.conflicts.some(c => c.conflictType === 'competing_races') &&
    !pNoClock.conflicts.some(c => c.conflictType === 'urgency_vs_priority'));
}

/* ---------- N7 (Punkt 7): Referenz- und Regelmutation ---------- */
{
  const goals = goalsOf([{ id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' }]);
  const acts = [
    { clientRecordId: 'a1', sportId: 'run', startedAt: '2026-07-12T07:30:00Z', durationSeconds: 1860, summary: { distanceKm: 5.2 } },
    { clientRecordId: 'a2', sportId: 'run', startedAt: '2026-07-12T08:03:00Z', durationSeconds: 1500, summary: { distanceKm: 4.0 } }
  ];
  const ev = GP.evidenceFromActivities(acts, { groupSessions: AC.groupActivitySessions });
  const evBefore = JSON.stringify(ev);
  const snap = mkSnap({ goals });
  const p1 = GP.buildPortfolio(snap, { evidence: ev });
  ok('N7 result.evidence teilt KEINE Referenz mit opts.evidence', p1.evidence !== ev && p1.evidence.longestGroupedSession !== ev.longestGroupedSession);
  p1.evidence.longestGroupedSession.distKm = 999; p1.evidence.longestGroupedSession.activityRefs.push('KAPUTT');
  ok('N7b Mutation der AUSGABE verändert den Input nicht (vorher: geteilte Referenz)', JSON.stringify(ev) === evBefore);
  const r1 = JSON.stringify(GP.buildPortfolio(snap, { evidence: ev }));
  ev.longestGroupedSession.distKm = 777;   // Eingangsmutation NACH Übergabe
  const r2 = JSON.stringify(GP.buildPortfolio(snap, { evidence: JSON.parse(evBefore) }));
  ok('N7c Eingangsmutation wirkt nicht nach: gleicher Snapshot + Rule-Version ⇒ byte-identisch', r1 === r2);
  // Regelobjekte: Mutationsversuch prallt ab (tief eingefroren), Ergebnis bleibt byte-stabil.
  const base1 = JSON.stringify(GP.buildPortfolio(snap, {}));
  try { GP.BUDGET_BY_ROLE.main.max = 0.99; } catch (e) {}
  try { GP.DEPENDENCY_MODEL.minimumDoses.swim_technique.min = 7; } catch (e) {}
  try { GP.DEPENDENCY_MODEL.requires.ironman.push('KAPUTT'); } catch (e) {}
  const base2 = JSON.stringify(GP.buildPortfolio(snap, {}));
  ok('N7d exportierte Regelobjekte tief eingefroren: Mutation ändert weder Regeln noch Ergebnisse',
    base1 === base2 && GP.BUDGET_BY_ROLE.main.max === 0.75 && GP.DEPENDENCY_MODEL.minimumDoses.swim_technique.min === 1 &&
    GP.DEPENDENCY_MODEL.requires.ironman.indexOf('KAPUTT') < 0);
}

/* ---------- N0 (3a.2 Blocker 2): Versionierung ---------- */
{
  ok('N0 neue Versionen nach Vertragsänderung: PORTFOLIO_VERSION=2, RULE_VERSION=gp-v2.0.0',
    GP.PORTFOLIO_VERSION === 2 && GP.RULE_VERSION === 'gp-v2.0.0');
  const p = GP.buildPortfolio(mkSnap({ goals: goalsOf([{ id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' }]) }), {});
  ok('N0b Portfolio trägt exakt version 2 + ruleVersion gp-v2.0.0 (v1/gp-v1.0.0 nie wiederverwendet)',
    p.version === 2 && p.ruleVersion === 'gp-v2.0.0');
}

/* ---------- N9 (3a.2 Blocker 3): Katalogkohärenz ftp / target_bodyfat / body_fat ---------- */
{
  ok('N9 ftp ist bekannte Sport-Performance-Kategorie mit Power-Metrik (Katalog = Metrik-Quelle kohärent)',
    PM.isKnownGoalCategory('ftp') === true && PM.goalMetricTypeFor('ftp') === 'power');
  const pf = GP.buildPortfolio(mkSnap({ goals: goalsOf([{ id: 'g:ftp', title: 'FTP 280', category: 'ftp', priority: 2, targetValue: 280 }]) }), {});
  const af = alloc(pf, 'g:ftp');
  ok('N9b FTP-Ziel wird als performance regulär allokiert (vorher: unknown/needs_review)',
    af.kind === 'performance' && af.mode === 'develop' && af.weeklyBudgetRange !== null);
  ok('N9c target_bodyfat ist kanonisch UND Weight-Ziel; Legacy body_fat NUR via dokumentiertem Alias',
    PM.isKnownGoalCategory('target_bodyfat') === true && PM.goalMetricTypeFor('target_bodyfat') === 'weight' &&
    PM.canonGoalCategory('body_fat') === 'target_bodyfat' && PM.isKnownGoalCategory('body_fat') === true);
  const gb = goalsOf([{ id: 'g:bf', title: 'KFA 11%', category: 'body_fat', priority: 3, targetValue: 11 }]);
  const pb = GP.buildPortfolio(mkSnap({ goals: gb }), {});
  const ab = alloc(pb, 'g:bf');
  ok('N9d Legacy body_fat ⇒ normalisiert target_bodyfat, kind weight, reguläre maintain-Allokation',
    gb[0].category === 'target_bodyfat' && gb[0].metricType === 'weight' && ab.kind === 'weight' && ab.mode === 'maintain' && ab.weeklyBudgetRange !== null);
}

/* ---------- N8 (Punkt 8): Mindestdosen zielübergreifend aggregiert ---------- */
{
  const goals = goalsOf([
    { id: 'g:hm', title: 'HM', category: 'half_marathon', priority: 1, targetDate: '2026-09-16' },
    { id: 'g:703', title: '70.3', category: 'half_ironman', priority: 2, targetDate: '2027-08-01' },
    { id: 'g:im', title: 'IM', category: 'ironman', priority: 4, targetDate: '2028-08-06' }
  ]);
  const sportsFull = [{ sportId: 'running', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'swimming', activeInApp: true }, { sportId: 'gym', activeInApp: true }];
  const p = GP.buildPortfolio(mkSnap({ goals, sports: sportsFull }), {});
  const swim = p.minimumDoses.filter(d => d.capability === 'swim_technique');
  ok('N8 gemeinsame Schwimm-Mindestdosis erscheint portfolioweit GENAU EINMAL (Maximalwert, keine Summe)',
    swim.length === 1 && swim[0].min === 1 && swim[0].type === 'sessions_per_week', JSON.stringify(p.minimumDoses));
  ok('N8b neededForGoalIds beide Ziele + shareableAcrossGoals=true (Scheduler-Vertrag: EINE Einheit bedient mehrere Ziele)',
    swim[0].neededForGoalIds.join(',') === 'g:703,g:im' && swim[0].shareableAcrossGoals === true);
  ok('N8c Zielallokationen referenzieren weiterhin ihre eigenen Floors',
    (alloc(p, 'g:703').minimumDose || []).some(d => d.capability === 'swim_technique') &&
    (alloc(p, 'g:im').minimumDose || []).some(d => d.capability === 'swim_technique'));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
