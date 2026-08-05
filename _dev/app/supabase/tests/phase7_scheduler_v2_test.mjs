/* ORVIA · Phase 7 (2026-08-05) — scheduler-v2: vollstaendige Pipeline S3→S4→S5.
   Kernbeweise: nur shadow_only, End-to-End-Woche mit Vertrag-4-Prescriptions +
   deterministischen ps:v2-IDs, konservativer Fallback ohne Kapazitaet, Qualitaet
   nur bei Konfidenz, Konflikte/Unplatzierbares durchgereicht, Determinismus,
   scheduler-v1 unangetastet.
   node supabase/tests/phase7_scheduler_v2_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));
require(join(APP, 'js/engine/constraint-solver.js'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));
const SV2 = require(join(APP, 'js/engine/scheduler-v2.js'));
const R = f => readFileSync(join(APP, f), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function fullAvail(over) {
  const days = {};
  ['mo','di','mi','do','fr','sa','so'].forEach(wd => { days[wd] = { available: true, restDay: false,
    singleSession: { maxMinutes: wd === 'sa' || wd === 'so' ? 180 : 90, intensityAllowed: 'intense' },
    doubleSession: { enabled: false }, fixedCommitments: [] }; });
  days.do = { available: false, restDay: true, singleSession: null, doubleSession: { enabled: false }, fixedCommitments: [] };
  return Object.assign({ days, maxSessionsPerWeek: null, maxIntenseSessions: 2, preferredRestDays: ['fr'], minimumFullRestDays: 1 }, over || {});
}
const INPUT = {
  activationMode: 'shadow_only', weekKey: '2026-W33',
  sports: [{ sportId: 'running', role: 'primary' }, { sportId: 'strength', role: 'secondary' }],
  availability: fullAvail(),
  capacityPerSport: {
    running: { weeklySessions: 4, weeklyMinutes: 240, weeklyDistanceKm: 35, weeklyLoadAU: 900, longSessionCeiling: 110, confidence: 'medium', missingFields: [] },
    strength: { weeklySessions: 2, weeklyMinutes: 120, weeklyDistanceKm: null, weeklyLoadAU: 400, longSessionCeiling: 60, confidence: 'medium', missingFields: [] }
  },
  evidence: { running: { thresholdPaceSecPerKm: 310, confidence: 'medium' } }
};

/* ============ Aktivierungsgate ============ */
ok('nur shadow_only: production abgelehnt', SV2.buildWeek(Object.assign({}, INPUT, { activationMode: 'production' })).error.code === 'SCHEDULER_V2_ACTIVATION_MODE_REJECTED');
ok('ohne availability ⇒ blocked', SV2.buildWeek(Object.assign({}, INPUT, { availability: null })).error.code === 'SCHEDULER_V2_AVAILABILITY_MISSING');
ok('ungueltiger weekKey ⇒ blocked', SV2.buildWeek(Object.assign({}, INPUT, { weekKey: 'x' })).error.code === 'SCHEDULER_V2_WEEKKEY_INVALID');

/* ============ End-to-End-Woche ============ */
{
  const r = SV2.buildWeek(INPUT);
  ok('E2E · ok, 6 Sessions (4 Lauf: long+quality+2 easy · 2 Kraft), nichts unplatziert',
     r.ok === true && r.sessions.length === 6 && r.unplaced.length === 0,
     r.ok ? r.sessions.map(s => s.provenance.requirementId + '@' + s.weekday).join(',') : JSON.stringify(r.error));
  const long = r.sessions.find(s => s.provenance.requirementId === 'running:long');
  ok('E2E · Long aus beobachteter Kapazitaet (110 min) auf Kapazitaetstag (sat/sun), key zuerst platziert',
     !!long && long.prescription.blocks[0].completion.value === 110 * 60 && (long.weekday === 'sa' || long.weekday === 'so'));
  const qual = r.sessions.find(s => s.provenance.requirementId === 'running:quality');
  ok('E2E · Qualitaetseinheit mit Pace-Zielen aus echter Evidenz (Vertrag-4-repeat)',
     !!qual && qual.provenance.paceEvidenceUsed === true
     && qual.prescription.blocks.some(b => b.type === 'repeat' && b.blocks[0].target.type === 'pace'));
  ok('E2E · Ruhetag (thu) bleibt frei; jede Prescription validiert gegen den normativen Validator',
     r.sessions.every(s => s.weekday !== 'do') && r.sessions.every(s => PF.validateWorkout(s.prescription).length === 0));
  ok('E2E · deterministische ps:v2-IDs (weekKey+Index, kein Zufall)',
     r.sessions.every((s, i) => s.sessionId === 'ps:v2:2026-W33:' + i));
  ok('E2E · vollstaendige Provenienz je Session (scheduler/policy/solver/factory/template)',
     r.sessions.every(s => s.provenance.scheduler && s.provenance.policy && s.provenance.solver && s.provenance.factory && s.provenance.templateId));
  ok('DETERMINISMUS · zweiter Lauf byte-identisch', JSON.stringify(r) === JSON.stringify(SV2.buildWeek(INPUT)));
}

/* ============ Fail-closed-Verhalten der Policy ============ */
{
  const noCap = SV2.buildWeek(Object.assign({}, INPUT, { capacityPerSport: null, evidence: null }));
  ok('ohne Kapazitaet · konservative generische Einheiten (max 2 primary, easy, 30 min) + Flags',
     noCap.ok === true && noCap.sessions.filter(s => s.sportId === 'running').length === 2
     && noCap.flags.some(f => f.indexOf('conservative_generic_no_capacity:running') === 0)
     && noCap.sessions.filter(s => s.sportId === 'running').every(s => s.prescription.session_type === 'endurance_easy'));
  const lowConf = JSON.parse(JSON.stringify(INPUT));
  lowConf.capacityPerSport.running.confidence = 'low';
  const rLow = SV2.buildWeek(lowConf);
  ok('low-Konfidenz · KEINE Qualitaetseinheit (quality_withheld-Flag), Umfang bleibt',
     rLow.ok === true && !rLow.sessions.some(s => s.provenance.requirementId === 'running:quality')
     && rLow.flags.some(f => f.indexOf('quality_withheld_low_confidence') === 0));
  /* Widerspruchstag: Konflikt wird durchgereicht, nicht verschluckt. */
  const conflicted = JSON.parse(JSON.stringify(INPUT));
  conflicted.availability.days.mo = { available: true, restDay: true, singleSession: null, doubleSession: { enabled: false }, fixedCommitments: [] };
  const rc = SV2.buildWeek(conflicted);
  ok('Widerspruchstag · Konflikt aus dem Solver unveraendert durchgereicht',
     rc.ok === true && rc.conflicts.some(c => c.code === 'contradictory_rest_and_available' && c.weekday === 'mo'));
}

/* ============ scheduler-v1 unangetastet + Einbindung ============ */
ok('scheduler-v1 bleibt Skeleton (shadow_only-Konstante unveraendert im Quelltext)',
   /ACTIVATION_MODE = 'shadow_only'/.test(R('js/engine/scheduler-v1.js')));
const src = R('js/engine/scheduler-v2.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('v2 pure (Code): kein Date.now/Math.random/DOM/Storage/PROFILE', !/Date\.now|Math\.random|document\.|localStorage|\bPROFILE\b/.test(src));
const idx = R('index.html'), sw = R('sw.js');
ok('index.html laedt scheduler-v2 NACH solver+factory',
   idx.indexOf('js/engine/scheduler-v2.js') > idx.indexOf('js/engine/prescription-factory.js'));
ok('sw.js precacht scheduler-v2', sw.indexOf("'./js/engine/scheduler-v2.js'") >= 0);
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 239, genau einmal', swv != null && Number(swv) >= 239 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

console.log('\nphase7_scheduler_v2: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
