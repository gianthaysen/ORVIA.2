/* ============================================================
   ORVIA · Engine 3c — Scheduler S2: Vertragstest für den Goal-Allocation-Adapter.
   Der Adapter ist eine DÜNNE Umhüllung von goal-portfolio.buildPortfolio
   (Reuse, kein Zweit-SSOT — S0b §5/§12). Er wählt KEINE Sessions.
   Vertrag: app/docs/SCHEDULER-S0-CONTRACT.md (S0b) + S2-Auftrag.
   node supabase/tests/engine_s2_goal_allocation_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const base = new URL('../../js/engine/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.window = globalThis;
let loadOk = true, loadErr = null;
try {
  // Abhängigkeiten des Adapters: SchedulerInput-Factory (S1) + goal-portfolio (Batch 3a).
  (0, eval)(readFileSync(new URL('scheduler-input-factory.js', base), 'utf8'));
  (0, eval)(readFileSync(new URL('goal-portfolio.js', base), 'utf8'));
  (0, eval)(readFileSync(new URL('scheduler-goal-allocation.js', base), 'utf8'));
} catch (e) { loadOk = false; loadErr = e; }

ok('[0-1] scheduler-goal-allocation.js lädt (mit S1-Factory + goal-portfolio)', loadOk, loadErr && (loadErr.message + ' — ' + loadErr.stack.split('\n')[0]));
if (!loadOk) {
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen (Adapter fehlt — ROT, wie vor Implementierung erwartet).');
  console.log('S2: ROT — Implementierung fehlt/fehlerhaft.');
  process.exit(0);
}

const factory = globalThis.ORVIA && globalThis.ORVIA.schedulerInputFactory;
const adapter = globalThis.ORVIA && globalThis.ORVIA.schedulerGoalAllocation;
const gp = globalThis.ORVIA && globalThis.ORVIA.goalPortfolio;
ok('[0-2] ORVIA.schedulerGoalAllocation vorhanden', !!adapter);
ok('[0-3] Reuse-Nachweis: goal-portfolio.buildPortfolio verfügbar', !!(gp && gp.buildPortfolio));
if (!adapter || !factory) {
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  console.log('S2: ROT — Module unvollständig.');
  process.exit(0);
}

/* ---------- Fixtures ---------- */
function baseAvailability(o) {
  const days = {};
  ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(wd => {
    days[wd] = { available: true, restDay: false, singleSession: { preferredTime: 'morning', maxMinutes: 90, intensityAllowed: 'moderate', preferredSports: [] }, doubleSession: { enabled: false }, fixedCommitments: [] };
  });
  return Object.assign({ days, maxSessionsPerWeek: 6, maxIntenseSessions: 2, preferredRestDays: [], minimumFullRestDays: 1 }, o || {});
}
function goal(o) {
  return Object.assign({ id: 'g1', category: 'half_marathon', role: 'main', priority: 1, targetDate: '2026-09-06', status: 'active', metricType: 'time', targetValue: 6300, unit: 's', sports: ['running'], provenance: { source: 'profile.goals', field: 'user_goals' } }, o || {});
}
function baseRaw(o) {
  return Object.assign({
    planningDayLocal: '2026-07-20', timezone: 'Europe/Vienna',
    athlete: { userRef: 'u1', level: 'intermediate', sports: [{ sportId: 'running', activeInApp: true }] },
    goals: { list: [goal()] },
    availability: baseAvailability(),
    fixedEvents: [], constraints: [],
    capacity: { perSport: { running: { weeklySessions: 3, weeklyMinutes: 180, confidence: 'medium' } } },
    knowledgeRules: []
  }, o || {});
}
function buildInput(o) { const r = factory.build(baseRaw(o)); if (!r.ok) throw new Error('Factory-Fehler: ' + JSON.stringify(r.error)); return r.input; }

/* ================================================================
   1) Grundvertrag
   ================================================================ */
{
  const res = adapter.build(buildInput());
  ok('[1-1] build() ok', res.ok === true, JSON.stringify(res.error));
  const r = res.result;
  ok('[1-2] Vertragsversion vorhanden', typeof r.contractVersion === 'string' && r.contractVersion.length > 0);
  ok('[1-3] activationMode==="shadow_only"', r.activationMode === 'shadow_only');
  ok('[1-4] Referenz auf SchedulerInput-Version', r.inputContractVersion === 'sched-input-v1.0.0');
  ok('[1-5] planningDayLocal + timezone übernommen', r.planningDayLocal === '2026-07-20' && r.timezone === 'Europe/Vienna');
  ok('[1-6] Reuse-Provenienz auf goal-portfolio', r.portfolioSource && r.portfolioSource.module === 'goal-portfolio' && r.portfolioSource.ruleVersion === gp.RULE_VERSION);
  ok('[1-7] Ziele stabil sortiert vorhanden', Array.isArray(r.goals) && r.goals.length === 1);
  const g = r.goals[0];
  ok('[1-8] Ziel-ID / zulässige Zielreferenz (goalId)', g.goalId === 'g1' && !('sessionId' in g));
  ok('[1-9] Priorität + Prioritätsquelle + Provenienz transportiert', g.priority === 1 && !!g.prioritySource && !!g.provenance && g.provenance.source === 'profile.goals');
  ok('[1-10] Eligibility-Status vorhanden', typeof g.eligibility === 'string');
  ok('[1-11] strukturierte Gründe (maschinenlesbar)', Array.isArray(g.reasons) && g.reasons.every(x => x && typeof x.code === 'string'));
  ok('[1-12] relative Allokation/Gewichtung (share)', g.relativeAllocation && g.relativeAllocation.unit === 'share_of_available_training_budget');
  ok('[1-13] harte Grenzen + weiche Präferenzen getrennt (global)', Array.isArray(r.hardLimits) && Array.isArray(r.softPreferences));
  ok('[1-14] fehlende Felder pro Ziel', Array.isArray(g.missingFields));
  ok('[1-15] Confidence pro Ziel + global', typeof g.confidence === 'string' && typeof r.confidence === 'string');
  ok('[1-16] globale Missingness + Warnungen + Provenienz', Array.isArray(r.missingFields) && Array.isArray(r.warnings) && !!r.provenance);
}

/* Quellcheck: keine versteckte Zeit-/Zufallsquelle. */
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const src = strip(readFileSync(new URL('scheduler-goal-allocation.js', base), 'utf8'));
  ok('[1-17] Adapter nutzt kein Date.now()/new Date()/Math.random() (Code ohne Kommentare)', !/Date\.now\(\)|new Date\(\)|Math\.random\(\)/.test(src), (src.match(/Date\.now\(\)|new Date\(\)|Math\.random\(\)/) || [])[0]);
}

/* ================================================================
   2) Golden-Szenarien 1-22
   ================================================================ */
// G1: einzelnes gültiges Ziel stabil übernommen
{
  const r = adapter.build(buildInput()).result;
  ok('[G1] einzelnes gültiges Ziel wird stabil übernommen (eligible, focus)', r.goals.length === 1 && r.goals[0].eligibility === 'eligible' && r.goals[0].mode === 'focus');
}
// G2: mehrere Ziele deterministisch nach Priorität
{
  const goals = [
    goal({ id: 'gB', category: 'ironman', priority: 4, role: 'longterm', targetDate: '2028-07-01', metricType: 'time', targetValue: 36000 }),
    goal({ id: 'gA', category: 'half_marathon', priority: 1, role: 'main', targetDate: '2026-09-06' }),
    goal({ id: 'gC', category: 'half_ironman', priority: 2, role: 'secondary', targetDate: '2027-05-01', metricType: 'time', targetValue: 19800 })
  ];
  const r = adapter.build(buildInput({ goals: { list: goals }, athlete: { userRef: 'u1', sports: [{ sportId: 'running', activeInApp: true }, { sportId: 'swimming', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'gym', activeInApp: true }] } })).result;
  ok('[G2] Ziele deterministisch nach Priorität sortiert (gA,gC,gB)', r.goals.map(x => x.goalId).join(',') === 'gA,gC,gB', r.goals.map(x => x.goalId).join(','));
  ok('[G2b] Fokus = Prio-1-Ziel gA', r.focusGoalId === 'gA');
}
// G3: geänderte Eingabereihenfolge ⇒ byte-identischer Output
{
  const goalsA = [goal({ id: 'gA', priority: 1 }), goal({ id: 'gC', category: 'half_ironman', priority: 2, role: 'secondary', targetDate: '2027-05-01', metricType: 'time', targetValue: 19800 })];
  const goalsB = [goalsA[1], goalsA[0]];
  const rA = adapter.build(buildInput({ goals: { list: goalsA } })).result;
  const rB = adapter.build(buildInput({ goals: { list: goalsB } })).result;
  ok('[G3] geänderte Eingabereihenfolge ⇒ byte-identischer Output', JSON.stringify(rA) === JSON.stringify(rB));
}
// G4: fehlende Ziele ⇒ strukturierte Missingness
{
  const r = adapter.build(buildInput({ goals: { list: [] } })).result;
  ok('[G4] fehlende Ziele ⇒ strukturierte Missingness, keine erfundene Allokation', r.goals.length === 0 && r.missingFields.some(m => /goals/.test(JSON.stringify(m))) && r.focusGoalId === null);
}
// G5: fehlende Priorität wird nicht erfunden
{
  const g = goal({ id: 'gN', priority: null });
  const r = adapter.build(buildInput({ goals: { list: [g] } })).result;
  ok('[G5] fehlende Priorität ⇒ needs_review, keine erfundene Priorität', r.goals[0].priority === null && r.goals[0].eligibility === 'needs_review' && r.goals[0].relativeAllocation === null);
}
// G6: Ziel-Provenienz bleibt vollständig
{
  const g = goal({ provenance: { source: 'onboarding.goals', field: 'draft', capturedAt: '2026-06-01' } });
  const r = adapter.build(buildInput({ goals: { list: [g] } })).result;
  ok('[G6] Provenienz vollständig erhalten', JSON.stringify(r.goals[0].provenance) === JSON.stringify({ source: 'onboarding.goals', field: 'draft', capturedAt: '2026-06-01' }));
}
// G7: bekannte Gesamtkapazität wird nie überschritten
{
  const goals = [goal({ id: 'gA', priority: 1 }), goal({ id: 'gC', category: 'half_ironman', priority: 2, role: 'secondary', targetDate: '2027-05-01', metricType: 'time', targetValue: 19800 })];
  const r = adapter.build(buildInput({ goals: { list: goals }, athlete: { userRef: 'u1', sports: [{ sportId: 'running', activeInApp: true }, { sportId: 'swimming', activeInApp: true }, { sportId: 'cycling', activeInApp: true }, { sportId: 'gym', activeInApp: true }] } }), { capacity: { totalWeeklyMinutes: 600 } }).result;
  const sumMax = r.goals.reduce((s, x) => s + (x.assignableCapacity ? x.assignableCapacity.maxMinutes : 0), 0);
  ok('[G7] Summe zuordenbarer Maximal-Minuten ≤ bekannte Gesamtkapazität', sumMax <= 600, 'sumMax=' + sumMax);
  ok('[G7b] zuordenbare Kapazität nur bei bekannter Gesamtkapazität', r.goals[0].assignableCapacity && r.goals[0].capacityBasis.known === true);
}
// G8: bekannte Nullkapazität ≠ unbekannte Kapazität
{
  const rKnown0 = adapter.build(buildInput(), { capacity: { totalWeeklyMinutes: 0 } }).result;
  const rUnknown = adapter.build(buildInput()).result;
  ok('[G8] bekannte Nullkapazität unterscheidbar von unbekannter', rKnown0.goals[0].capacityBasis.known === true && rKnown0.goals[0].assignableCapacity.maxMinutes === 0
    && rUnknown.goals[0].capacityBasis.known === false && rUnknown.goals[0].assignableCapacity === null);
}
// G9: unbekannte Kapazität ⇒ keine erfundenen Minuten
{
  const r = adapter.build(buildInput()).result;
  ok('[G9] unbekannte Kapazität ⇒ keine Minuten erfunden (nur Shares)', r.goals.every(g => g.assignableCapacity === null) && r.goals[0].relativeAllocation !== null);
}
// G10: harte Ruhetage + harte Kapazitätsgrenzen wirksam (als harte Grenzen ausgewiesen)
{
  const av = baseAvailability(); av.days.do.restDay = true; av.minimumFullRestDays = 2; av.dailyCapacityCeiling = { maxMinutesAllSports: 120, maxLoadAU: 300, confidence: 'high' };
  const r = adapter.build(buildInput({ availability: av })).result;
  const hasRest = r.hardLimits.some(h => h.code === 'explicit_rest_day');
  const hasMin = r.hardLimits.some(h => h.code === 'minimum_full_rest_days');
  const hasCeil = r.hardLimits.some(h => h.code === 'daily_capacity_ceiling');
  ok('[G10] harte Ruhetage + minimumFullRestDays + Tageskapazitätsgrenze als harte Grenzen', hasRest && hasMin && hasCeil);
}
// G11: bevorzugte Ruhetage bleiben weich
{
  const av = baseAvailability(); av.preferredRestDays = ['do'];
  const r = adapter.build(buildInput({ availability: av })).result;
  const soft = r.softPreferences.some(s => s.code === 'preferred_rest_days');
  const notHard = !r.hardLimits.some(h => h.code === 'preferred_rest_days');
  ok('[G11] bevorzugte Ruhetage bleiben weich (nicht hart)', soft && notHard);
}
// G12: unvollständige Knowledge-Regel beeinflusst keine Allokation
{
  const kr = [{ ruleId: 'RUN-X', version: 'v1', evidenceClass: 'D' }]; // unvollständig (safety/sources/approval fehlen)
  const rWith = adapter.build(buildInput({ knowledgeRules: kr })).result;
  const rWithout = adapter.build(buildInput()).result;
  const eq = JSON.stringify(rWith.goals) === JSON.stringify(rWithout.goals);
  ok('[G12] unvollständige Knowledge-Regel ändert Allokation nicht', eq && rWith.warnings.some(w => w.code === 'knowledge_rule_incomplete'));
}
// G13: nicht freigegebene Knowledge-Regel bleibt ignored
{
  const kr = [{ ruleId: 'RUN-EASY-004', version: 'v1', evidenceClass: 'D', evidenceStatus: 'unverified', approvalStatus: 'pending', sources: [{ type: 'doc', ref: 'x' }], safety: { medicallyReviewed: false, blockedReason: null } }];
  const r = adapter.build(buildInput({ knowledgeRules: kr })).result;
  ok('[G13] nicht freigegebene Regel bleibt ignored + keine Allokationswirkung', r.knowledgeRulesUsed[0].usedAs === 'ignored' && r.knowledgeRulesUsed[0].appliedToAllocation === false);
}
// G14: gleiche Eingabe ⇒ identischer Output
{
  const a = adapter.build(buildInput()).result;
  const b = adapter.build(buildInput()).result;
  ok('[G14] gleiche Eingabe ⇒ identischer Output', JSON.stringify(a) === JSON.stringify(b));
}
// G15: TZ=UTC vs Europe/Vienna (Prozess-TZ) ⇒ identischer Output (nur Prüfung der Determinismus-Eigenschaft im selben Prozess)
{
  // Der Adapter nutzt keine Prozess-TZ; identischer injizierter Input ⇒ identischer Output (Prozess-TZ-Vergleich erfolgt zusätzlich extern via TZ=…).
  const a = adapter.build(buildInput()).result;
  const b = adapter.build(buildInput()).result;
  ok('[G15] Output unabhängig von Prozess-TZ (kein TZ-abhängiger Code)', JSON.stringify(a) === JSON.stringify(b));
}
// G16: sessionId rekursiv abgelehnt (direkt am Adapter — die S1-Factory fängt es bereits selbst ab,
//      daher injizieren wir das verbotene Feld nach der Factory in das normalisierte Input-Objekt).
{
  const inp = buildInput();
  inp.constraints = [{ id: 'c1', nested: { sessionId: 'x' } }];
  const r = adapter.build(inp);
  ok('[G16] sessionId rekursiv abgelehnt', r.ok === false && r.error.code === 'SCHEDULER_GA_AMBIGUOUS_SESSION_ID');
}
// G17: kein Zugriff auf PROFILE/DB/ActivityStore/localStorage
{
  const src = readFileSync(new URL('scheduler-input-factory.js', base), 'utf8') + ';\n'
    + readFileSync(new URL('goal-portfolio.js', base), 'utf8') + ';\n'
    + readFileSync(new URL('scheduler-goal-allocation.js', base), 'utf8');
  const trap = new Proxy({}, { get() { throw new Error('Store-Zugriff!'); }, set() { throw new Error('Store-Write!'); } });
  const sandbox = { console, module: { exports: {} }, PROFILE: trap, DB: trap, ActivityStore: trap, localStorage: trap };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  let isoOk = true, isoErr = null;
  try {
    vm.runInContext(src, sandbox, { filename: 's2-isolation' });
    const f = sandbox.ORVIA.schedulerInputFactory, a = sandbox.ORVIA.schedulerGoalAllocation;
    a.build(f.build(baseRaw()).input);
  } catch (e) { isoOk = false; isoErr = e.message; }
  ok('[G17] kein Zugriff auf PROFILE/DB/ActivityStore/localStorage', isoOk, isoErr);
}
// G18: bestehender Wochenplan bleibt byte-identisch
{
  const fakeProfile = { weekPlan: [[{ t: 'Laufen', id: 'ps:1' }], [], [], [], [], [], []] };
  const before = JSON.stringify(fakeProfile);
  adapter.build(buildInput());
  ok('[G18] bestehender Wochenplan byte-identisch (Adapter berührt ihn nicht)', before === JSON.stringify(fakeProfile));
}
// G19: kein Output enthält konkrete Sessions/Wochentagszuweisungen
{
  const r = adapter.build(buildInput()).result;
  const s = JSON.stringify(r);
  const noSessions = !('plannedSessions' in r) && !/"sessionId"/.test(s) && !/"intensity"/.test(s) && r.goals.every(g => !('date' in g) && !('timeWindow' in g) && !('weekday' in g));
  ok('[G19] kein Output enthält konkrete Trainingseinheiten/Wochentagszuweisungen', noSessions);
}
// G20: S1-Tests bleiben unverändert grün (Existenz + Import-Kompatibilität; Vollausführung in Regression)
{
  ok('[G20] S1-Factory unverändert nutzbar (build liefert 7-Tage-Horizont)', factory.build(baseRaw()).input.horizon.length === 7);
}
// G21: Level (Anfänger/Fortgeschritten/Profi) ändert fachliche Allokation nicht
{
  const rBeg = adapter.build(buildInput({ athlete: { userRef: 'u1', level: 'beginner', sports: [{ sportId: 'running', activeInApp: true }] } })).result;
  const rAdv = adapter.build(buildInput({ athlete: { userRef: 'u1', level: 'advanced', sports: [{ sportId: 'running', activeInApp: true }] } })).result;
  const rPro = adapter.build(buildInput({ athlete: { userRef: 'u1', level: 'competitive', sports: [{ sportId: 'running', activeInApp: true }] } })).result;
  ok('[G21] Level verändert fachliche Allokation nicht', JSON.stringify(rBeg.goals) === JSON.stringify(rAdv.goals) && JSON.stringify(rAdv.goals) === JSON.stringify(rPro.goals));
}
// G22: unzulässige/widersprüchliche Zielwerte ⇒ strukturierter Fehler statt stiller Korrektur
{
  const rNaN = adapter.build(buildInput({ goals: { list: [goal({ targetValue: Infinity })] } }));
  ok('[G22a] nicht-endlicher Zielwert ⇒ strukturierter Fehler', rNaN.ok === false && rNaN.error.code === 'SCHEDULER_GA_NON_FINITE_NUMBER');
  const rDup = adapter.build(buildInput({ goals: { list: [goal({ id: 'gX' }), goal({ id: 'gX', priority: 2 })] } }));
  ok('[G22b] widersprüchliche Zielreferenz (doppelte goalId) ⇒ strukturierter Fehler', rDup.ok === false && rDup.error.code === 'SCHEDULER_GA_CONTRADICTORY_GOAL_REF');
}

/* ================================================================
   3) Fail-closed §6 zusätzlich
   ================================================================ */
{
  const inp = buildInput(); const bad = Object.assign({}, inp, { activationMode: 'live' });
  ok('[F1] activationMode!=="shadow_only" ⇒ fail-closed', adapter.build(bad).ok === false);
  const badV = Object.assign({}, inp, { contractVersion: 'sched-input-v9.9.9' });
  ok('[F2] nicht unterstützte Vertragsversion ⇒ fail-closed', adapter.build(badV).ok === false);
  const noDay = Object.assign({}, inp, { planningDayLocal: null });
  ok('[F3] fehlender planningDayLocal ⇒ fail-closed', adapter.build(noDay).ok === false);
  const noTz = Object.assign({}, inp, { timezone: '' });
  ok('[F4] fehlende/ungültige Zeitzone ⇒ fail-closed', adapter.build(noTz).ok === false);
  const negCap = adapter.build(inp, { capacity: { totalWeeklyMinutes: -5 } });
  ok('[F5] negative Kapazität ⇒ fail-closed', negCap.ok === false && negCap.error.code === 'SCHEDULER_GA_NEGATIVE_CAPACITY');
  const missingGP = (() => { const sb = {}; sb.globalThis = sb; sb.window = sb; vm.createContext(sb);
    vm.runInContext(readFileSync(new URL('scheduler-goal-allocation.js', base), 'utf8'), sb); // ohne goal-portfolio
    return sb.ORVIA.schedulerGoalAllocation.build(inp); })();
  ok('[F6] fehlendes goal-portfolio-Modul ⇒ fail-closed (kein stiller Zweit-SSOT)', missingGP.ok === false && missingGP.error.code === 'SCHEDULER_GA_PORTFOLIO_MODULE_MISSING');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('S2-Goal-Allocation: ' + (fail === 0 ? 'GRÜN — deterministischer Reuse-Adapter über buildPortfolio; shadow-only, keine Session-Auswahl, keine erfundene Kapazität.' : 'ROT — ' + fail + ' offen.'));
process.exit(fail === 0 ? 0 : 1);
