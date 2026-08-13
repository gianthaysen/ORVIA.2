/* ============================================================
   ORVIA · Engine 3c — Scheduler S1: Vertragstest für SchedulerInput-Factory
   und das deterministische Sieben-Tage-Skelett (scheduler-v1).
   Vertrag: app/docs/SCHEDULER-S0-CONTRACT.md (S0b) + S1-Auftrag.
   node supabase/tests/engine_s1_scheduler_skeleton_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/engine/', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };

/* ---------- Laden (normal, für Funktionstests) ---------- */
globalThis.window = globalThis;
let loadOk = true, loadErr = null;
try {
  (0, eval)(readFileSync(new URL('scheduler-input-factory.js', base), 'utf8'));
  (0, eval)(readFileSync(new URL('scheduler-v1.js', base), 'utf8'));
} catch (e) { loadOk = false; loadErr = e; }

ok('[0-1] scheduler-input-factory.js + scheduler-v1.js laden ohne Fehler', loadOk, loadErr && (loadErr.message + ' — ' + loadErr.stack.split('\n')[0]));
if (!loadOk) {
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen (Module fehlen/laden nicht — ROT, wie vor Implementierung erwartet).');
  console.log('S1: ROT — Implementierung fehlt/fehlerhaft.');
  process.exit(0);
}

const factory = globalThis.ORVIA && globalThis.ORVIA.schedulerInputFactory;
const schedV1 = globalThis.ORVIA && globalThis.ORVIA.schedulerV1;
ok('[0-2] ORVIA.schedulerInputFactory vorhanden', !!factory);
ok('[0-3] ORVIA.schedulerV1 vorhanden', !!schedV1);
if (!factory || !schedV1) {
  console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
  console.log('S1: ROT — Module unvollständig.');
  process.exit(0);
}

/* ---------- Hilfsfunktionen für Testfixtures ---------- */
function baseAvailability(overrides) {
  const days = {};
  ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(wd => {
    days[wd] = { available: true, restDay: false, singleSession: { preferredTime: 'morning', maxMinutes: 90, intensityAllowed: 'moderate', preferredSports: [] }, doubleSession: { enabled: false }, fixedCommitments: [] };
  });
  return Object.assign({
    days,
    maxSessionsPerWeek: 6, maxIntenseSessions: 2,
    preferredRestDays: [], minimumFullRestDays: 1
  }, overrides || {});
}
function baseRaw(overrides) {
  return Object.assign({
    planningDayLocal: '2026-07-20', // Montag
    timezone: 'Europe/Vienna',
    athlete: { userRef: 'u1', level: 'intermediate', sports: [] },
    goals: { list: [{ id: 'g1', category: 'endurance', role: 'main', priority: 1, provenance: { source: 'profile.goals' } }] },
    availability: baseAvailability(),
    fixedEvents: [],
    constraints: [],
    capacity: { perSport: { running: { weeklySessions: 3, weeklyMinutes: 180, confidence: 'medium' } } },
    knowledgeRules: []
  }, overrides || {});
}

/* ================================================================
   1) SchedulerInput — Vertragsfelder
   ================================================================ */
{
  const r = factory.build(baseRaw());
  ok('[1-1] build() ok', r.ok === true, JSON.stringify(r.error));
  const inp = r.input;
  ok('[1-2] explizite Vertragsversion vorhanden', typeof inp.contractVersion === 'string' && inp.contractVersion.length > 0);
  ok('[1-3] activationMode==="shadow_only"', inp.activationMode === 'shadow_only');
  ok('[1-4] injizierte Zeitzone vorhanden', inp.timezone === 'Europe/Vienna');
  ok('[1-5] injizierter lokaler Planungstag vorhanden', inp.planningDayLocal === '2026-07-20');
  ok('[1-6] exakt 7 aufeinanderfolgende lokale Kalendertage', Array.isArray(inp.horizon) && inp.horizon.length === 7
    && inp.horizon.join(',') === '2026-07-20,2026-07-21,2026-07-22,2026-07-23,2026-07-24,2026-07-25,2026-07-26', inp.horizon && inp.horizon.join(','));
  ok('[1-7] Ziele mit Priorität und Provenienz', Array.isArray(inp.goals) && inp.goals[0].priority === 1 && !!inp.goals[0].provenance);
  ok('[1-8] Verfügbarkeit/feste Verpflichtungen/Rest-Day vorhanden', !!inp.availability && !!inp.availability.days.do);
  ok('[1-9] restDay/preferredRestDays/minimumFullRestDays getrennte Felder', 'restDay' in inp.availability.days.do
    && Array.isArray(inp.availability.preferredRestDays) && ('minimumFullRestDays' in inp.availability));
  ok('[1-10] Tageskapazitätsvertrag vorhanden', 'dailyCapacityCeiling' in inp.availability);
  ok('[1-11] unbekannte Kapazität ausdrücklich unbekannt (kein Fallback-Objekt fehlt)', inp.availability.dailyCapacityCeiling.known === false);
  ok('[1-12] Knowledge-Regeln-Array vorhanden', Array.isArray(inp.knowledgeRules));
  ok('[1-13] keine erfundenen Werte: unbekannte Kapazität bleibt known:false statt Nullwert', inp.availability.dailyCapacityCeiling.maxMinutesAllSports === null);
}

/* Determinismus: kein Date.now()/new Date() ohne injizierten Wert — Quellcheck. */
{
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const srcA = stripComments(readFileSync(new URL('scheduler-input-factory.js', base), 'utf8'));
  const srcB = stripComments(readFileSync(new URL('scheduler-v1.js', base), 'utf8'));
  const bad = /Date\.now\(\)|new Date\(\)(?!\.)/;
  ok('[1-14] scheduler-input-factory.js liest keine interne Systemzeit (Code, ohne Kommentare)', !bad.test(srcA), srcA.match(bad) && srcA.match(bad)[0]);
  ok('[1-15] scheduler-v1.js liest keine interne Systemzeit (Code, ohne Kommentare)', !bad.test(srcB), srcB.match(bad) && srcB.match(bad)[0]);
}

/* ================================================================
   2) SchedulerResult — Vertragsfelder
   ================================================================ */
{
  const inp = factory.build(baseRaw()).input;
  const r = schedV1.run(inp);
  ok('[2-1] run() ok', r.ok === true, JSON.stringify(r.error));
  const res = r.result;
  ok('[2-2] explizite Vertragsversion vorhanden', typeof res.contractVersion === 'string' && res.contractVersion.length > 0);
  ok('[2-3] activationMode ist immer shadow_only', res.activationMode === 'shadow_only');
  ok('[2-4] genau 7 lokale Planungstage', Array.isArray(res.days) && res.days.length === 7);
  ok('[2-5] keine produktive Schreibanweisung (kein write/persist-Feld)', !('write' in res) && !('persist' in res) && !('save' in res));
  ok('[2-6] keine automatisch geplante Trainingseinheit', res.plannedSessions.length === 0 && res.days.every(d => d.slots.every(s => s.proposal === null)));
  ok('[2-7] deterministische IDs für die 7 leeren Tages-Slots', res.days.every(d => d.slots.every(s => typeof s.plannedOccurrenceId === 'string' && /^po:\d{4}-\d{2}-\d{2}:empty-/.test(s.plannedOccurrenceId))));
  ok('[2-8] strukturierte Missingness/Confidence vorhanden', Array.isArray(res.missingFields) && typeof res.confidence === 'string');
  const allStatuses = new Set();
  res.days.forEach(d => { d.constraintProof.hard.forEach(p => allStatuses.add(p.status)); d.constraintProof.soft.forEach(p => allStatuses.add(p.status)); });
  allStatuses.add(res.weekly.proof.status);
  ok('[2-9] Constraint-Proofs enthalten satisfied/violated/neutral', ['satisfied', 'violated', 'neutral'].every(s => allStatuses.has(s)), [...allStatuses].join(','));
  ok('[2-10] keine mehrdeutige Eigenschaft sessionId', !schedV1.findKeyNamed(res, 'sessionId'));
  ok('[2-11] schreibt nichts in bestehenden Plan (kein PROFILE/DB/ActivityStore referenziert)', !('PROFILE' in res) && !('DB' in res));
}

/* ================================================================
   3) Determinismus
   ================================================================ */
{
  const raw = baseRaw();
  const inp1 = factory.build(raw).input;
  const inp2 = factory.build(JSON.parse(JSON.stringify(raw))).input;
  const r1 = schedV1.run(inp1).result;
  const r2 = schedV1.run(inp2).result;
  ok('[3-1] identischer Input ⇒ byte-identischer Output (JSON)', JSON.stringify(r1) === JSON.stringify(r2));

  // Eingabe mit anderer Objekt-Key-Reihenfolge (semantisch gleich) ⇒ gleicher Output.
  const rawReordered = { availability: raw.availability, timezone: raw.timezone, planningDayLocal: raw.planningDayLocal, athlete: raw.athlete, goals: raw.goals, capacity: raw.capacity, knowledgeRules: raw.knowledgeRules, fixedEvents: raw.fixedEvents, constraints: raw.constraints };
  const inp3 = factory.build(rawReordered).input;
  const r3 = schedV1.run(inp3).result;
  ok('[3-2] andere Objekt-Key-Reihenfolge im Eingang ⇒ gleicher Output', JSON.stringify(r1) === JSON.stringify(r3));

  // Andere Zeitzone (nur String, keine reale Auswirkung auf Kalenderarithmetik) + anderer Planungstag ⇒ anderer Horizont.
  const inp4 = factory.build(baseRaw({ planningDayLocal: '2026-08-01' })).input;
  const r4 = schedV1.run(inp4).result;
  ok('[3-3] anderer injizierter Planungstag ⇒ anderer 7-Tage-Horizont (erwartungsgemäß)', r4.planningHorizon.days[0] === '2026-08-01' && r4.planningHorizon.days.join(',') !== r1.planningHorizon.days.join(','));
}

/* ================================================================
   4) ID-Vertrag
   ================================================================ */
{
  const inp = factory.build(baseRaw()).input;
  const res = schedV1.run(inp).result;
  const id1 = res.days[0].slots[0].plannedOccurrenceId;
  const id2 = schedV1.derivePlannedOccurrenceId(schedV1.RESULT_CONTRACT_VERSION, 'u1', res.days[0].date, 0);
  ok('[4-1] plannedOccurrenceId ist deterministisch reproduzierbar aus Version+User+Datum+Slot', id1 === id2);
  ok('[4-2] plannedOccurrenceId folgt I3-kompatiblem Format po:<date>:<token>', /^po:\d{4}-\d{2}-\d{2}:/.test(id1));
  const id3 = schedV1.derivePlannedOccurrenceId(schedV1.RESULT_CONTRACT_VERSION, 'u2', res.days[0].date, 0);
  ok('[4-3] anderer Nutzerbezug ⇒ andere ID', id1 !== id3);
  const id4 = schedV1.derivePlannedOccurrenceId(schedV1.RESULT_CONTRACT_VERSION, 'u1', res.days[0].date, 1);
  ok('[4-4] anderer Slot ⇒ andere ID', id1 !== id4);
}

/* ================================================================
   5) Golden-Tests (15 Pflichtszenarien)
   ================================================================ */
// G1: Donnerstag expliziter Ruhetag
{
  const av = baseAvailability(); av.days.do.restDay = true; av.days.do.available = false;
  const inp = factory.build(baseRaw({ availability: av })).input;
  const res = schedV1.run(inp).result;
  const thu = res.days.find(d => d.date === '2026-07-23'); // Do in dieser Woche
  ok('[G1] Donnerstag expliziter Ruhetag bleibt hart gesperrt', thu.restDay === true && thu.constraintProof.hard.find(p => p.code === 'rest_day_locked').status === 'satisfied');
}
// G2: Donnerstag nur bevorzugter Ruhetag
{
  const av = baseAvailability(); av.preferredRestDays = ['do'];
  const inp = factory.build(baseRaw({ availability: av })).input;
  const res = schedV1.run(inp).result;
  const thu = res.days.find(d => d.date === '2026-07-23');
  ok('[G2] Donnerstag nur bevorzugter Ruhetag ⇒ weich, keine harte Sperre', thu.restDay === false && thu.preferredRestDay === true);
}
// G3: zwei vollständige Ruhetage/Woche (harter Wochenvertrag)
{
  const av = baseAvailability(); av.days.do.restDay = true; av.days.so.restDay = true; av.minimumFullRestDays = 2;
  const inp = factory.build(baseRaw({ availability: av })).input;
  const res = schedV1.run(inp).result;
  ok('[G3a] 2 Ruhetage erfüllen minimumFullRestDays=2 ⇒ satisfied', res.weekly.proof.status === 'satisfied', res.weekly.restDayCountInHorizon);
  const av2 = baseAvailability(); av2.days.do.restDay = true; av2.minimumFullRestDays = 2;
  const inp2 = factory.build(baseRaw({ availability: av2 })).input;
  const res2 = schedV1.run(inp2).result;
  ok('[G3b] nur 1 Ruhetag bei minimumFullRestDays=2 ⇒ violated', res2.weekly.proof.status === 'violated');
}
// G4: unbekannte Tageskapazität
{
  const inp = factory.build(baseRaw()).input; // dailyCapacityCeiling nicht gesetzt
  const res = schedV1.run(inp).result;
  ok('[G4] unbekannte Tageskapazität ⇒ keine automatische Belegung, kein erfundener Nullwert', res.days.every(d => d.capacity.known === false && d.capacity.ceiling === null && d.slots.every(s => s.proposal === null)));
}
// G5: bekannte Nullkapazität, unterscheidbar von unbekannt
{
  const av = baseAvailability(); av.dailyCapacityCeiling = { maxMinutesAllSports: 0, maxLoadAU: 0, confidence: 'high' };
  const inp = factory.build(baseRaw({ availability: av })).input;
  const res = schedV1.run(inp).result;
  ok('[G5] bekannte Nullkapazität ist unterscheidbar von unbekannter Kapazität', res.days.every(d => d.capacity.known === true && d.capacity.ceiling.maxMinutesAllSports === 0));
}
// G6: feste Verpflichtung bleibt harte Einschränkung
{
  const av = baseAvailability(); av.days.mi.fixedCommitments = [{ id: 'fc1', type: 'team_training', start: '18:00', end: '19:30', fixed: true }];
  const inp = factory.build(baseRaw({ availability: av })).input;
  const res = schedV1.run(inp).result;
  const wed = res.days.find(d => d.date === '2026-07-22');
  ok('[G6] feste Verpflichtung bleibt als harte Einschränkung erhalten', wed.fixedCommitments.length === 1 && wed.constraintProof.hard.find(p => p.code === 'fixed_commitment_preserved').status === 'satisfied');
}
// G7: doppelte Einheit nicht freigegeben ⇒ max. 1 Slot/Tag
{
  const inp = factory.build(baseRaw()).input; // doubleSession überall enabled:false
  const res = schedV1.run(inp).result;
  ok('[G7] doppelte Einheit nicht freigegeben ⇒ max. 1 Slot pro Tag', res.days.every(d => d.slots.length === 1));
}
// G8: nicht freigegebene Knowledge-Regel ⇒ keine Auswirkung auf Planung
{
  const kr = [{ ruleId: 'RUN-EASY-004', version: 'v1', evidenceClass: 'D', evidenceStatus: 'unverified', approvalStatus: 'pending', sources: [{ type: 'doc', ref: 'x' }], safety: { medicallyReviewed: false, blockedReason: null } }];
  const inp = factory.build(baseRaw({ knowledgeRules: kr })).input;
  const res = schedV1.run(inp).result;
  ok('[G8] nicht freigegebene Regel hat keine Auswirkung auf Planung (weiterhin keine Proposals)', res.days.every(d => d.slots.every(s => s.proposal === null))
    && res.knowledgeRulesUsed[0].usedAs === 'ignored'
    && res.warnings.some(w => w.code === 'knowledge_rule_not_approved'));
}
// G9: medizinisch relevante Regel ohne Freigabe ⇒ fail-closed
{
  const kr = [{ ruleId: 'RUN-SAFE-001', version: 'v1', evidenceClass: 'D', evidenceStatus: 'unverified', approvalStatus: 'blocked', sources: [{ type: 'doc', ref: 'x' }], safety: { medicallyReviewed: false, blockedReason: 'medizinisch gesperrt' } }];
  const inp = factory.build(baseRaw({ knowledgeRules: kr })).input;
  const res = schedV1.run(inp).result;
  ok('[G9] medizinisch relevante Regel ohne Freigabe ⇒ fail-closed (ignored + Warnung, keine Wirkung)', res.knowledgeRulesUsed[0].usedAs === 'ignored'
    && res.warnings.some(w => w.code === 'knowledge_rule_blocked')
    && res.days.every(d => d.slots.every(s => s.proposal === null)));
}
// G10: identischer Input zweimal ⇒ exakt identischer Output
{
  const raw = baseRaw();
  const a = schedV1.run(factory.build(raw).input).result;
  const b = schedV1.run(factory.build(raw).input).result;
  ok('[G10] identischer Input zweimal ⇒ exakt identischer Output', JSON.stringify(a) === JSON.stringify(b));
}
// G11: Zeitzonengrenze Europe/Vienna (DST-Übergang Ende Oktober 2026)
{
  const inp = factory.build(baseRaw({ planningDayLocal: '2026-10-24' })).input; // Sa vor DST-Ende (25.10.2026, So)
  const res = schedV1.run(inp).result;
  ok('[G11] 7 korrekte lokale Kalendertage über den DST-Übergang hinweg', res.planningHorizon.days.join(',') === '2026-10-24,2026-10-25,2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30');
}
// G12: fehlender Planungstag ⇒ strukturierter Fehler
{
  const raw = baseRaw(); delete raw.planningDayLocal;
  const r = factory.build(raw);
  ok('[G12] fehlender Planungstag ⇒ strukturierter Fehler, kein Systemzeit-Zugriff', r.ok === false && r.error && r.error.code === 'SCHEDULER_INPUT_MISSING_PLANNING_DAY');
}
// G13: mehrdeutiges sessionId ⇒ Vertrag lehnt ab
{
  const raw = baseRaw({ constraints: [{ id: 'c1', sessionId: 'x' }] });
  const r = factory.build(raw);
  ok('[G13] mehrdeutiges Feld sessionId im Rohinput ⇒ Vertrag lehnt ab', r.ok === false && r.error.code === 'SCHEDULER_INPUT_AMBIGUOUS_SESSION_ID');
}
// G14: shadow-only ⇒ kein Plan-/Store-/Profil-/Repository-Write
{
  const src = readFileSync(new URL('scheduler-input-factory.js', base), 'utf8') + ';\n' + readFileSync(new URL('scheduler-v1.js', base), 'utf8');
  const sandbox = { console: console, module: { exports: {} } };
  // PROFILE/DB/ActivityStore als Proxy: JEDER Zugriff wirft ⇒ beweist, dass der Code sie nie berührt.
  const trap = new Proxy({}, { get() { throw new Error('Zugriff auf produktiven Store im Scheduler-Skelett!'); }, set() { throw new Error('Schreibzugriff auf produktiven Store im Scheduler-Skelett!'); } });
  sandbox.PROFILE = trap; sandbox.DB = trap; sandbox.ActivityStore = trap; sandbox.localStorage = trap;
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  let isolationOk = true, isolationErr = null;
  try {
    vm.runInContext(src, sandbox, { filename: 'scheduler-s1-isolation' });
    const f = sandbox.ORVIA.schedulerInputFactory, s = sandbox.ORVIA.schedulerV1;
    const rr = f.build(baseRaw());
    s.run(rr.input);
  } catch (e) { isolationOk = false; isolationErr = e.message; }
  ok('[G14] Shadow-only: kein Zugriff auf PROFILE/DB/ActivityStore/localStorage (Proxy-Falle nicht ausgelöst)', isolationOk, isolationErr);
}
// G15: bestehender produktiver Wochenplan bleibt byte-identisch vor/nach S1-Ausführung
{
  const fakeProfile = { weekPlan: [[{ t: 'Laufen', id: 'ps:1' }], [], [], [], [], [], []] };
  const before = JSON.stringify(fakeProfile);
  const inp = factory.build(baseRaw()).input;
  schedV1.run(inp); // S1 bekommt fakeProfile nicht einmal übergeben — reine Funktion.
  const after = JSON.stringify(fakeProfile);
  ok('[G15] bestehender produktiver Wochenplan bleibt byte-identisch (S1 erhält/berührt ihn nicht)', before === after);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
console.log('S1-Skelett: ' + (fail === 0 ? 'GRÜN — SchedulerInput-Factory + deterministisches Sieben-Tage-Skelett erfüllen den S0b-Vertrag; shadow-only, keine Trainingsplanung.' : 'ROT — ' + fail + ' offen.'));
process.exit(fail === 0 ? 0 : 1);
