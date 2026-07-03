/* ORVIA · M3 — Onboarding-State-Machine v3 (STEP_CONFIG, Draft-v3, Skip, Progress, Completion).
   Test-first. Lädt die echte onboarding-logic.js (+ Profil-/Sport-Logik für Validatoren).
   node supabase/tests/onboarding_state_v3_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/onboarding/onboarding-profile-logic.js');
load('js/onboarding/onboarding-sports-logic.js');
const L = (await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url))).default;
const NOW = '2026-07-02T12:00:00.000Z';

const VALID_PROFILE = { displayName: 'Gian', birthDate: '1996-05-01', sex: 'male', experienceLevel: 'advanced', heightCm: 180, weightKg: 75 };
function validSports() {
  const SL = globalThis.ORVIA.onboardingSportsLogic;
  let s = SL.normalizeSportsSelection({});
  s = SL.toggleSport(s, 'running'); s = SL.setSportRole(s, 'running', 'primary');
  return s;
}
function draftAt(step, completed) {
  const d = L.newDraft();
  d.status = 'in_progress'; d.currentStep = step;
  d.completedSteps = completed || [];
  d.draftData = { profile: VALID_PROFILE, sports: validSports() };
  return d;
}

/* ---------- 0) Export-Vertrag (RED) ---------- */
['getStepConfig', 'getStepsForTier', 'isStepRequired', 'isStepSkippable', 'getProgress', 'skipStep', 'completeStep', 'getNextStep', 'getPreviousStep', 'isTierComplete'].forEach(fn =>
  ok('Export: ' + fn, typeof L[fn] === 'function'));
ok('Export: STEP_CONFIG', Array.isArray(L.STEP_CONFIG) && L.STEP_CONFIG.length > 6);
ok('Export: PLACEHOLDER_ALIASES_V4 (dokumentierte Zukunfts-Migration)', !!L.PLACEHOLDER_ALIASES_V4 && L.PLACEHOLDER_ALIASES_V4.goals_placeholder === 'goals');
ok('VERSION 3 + v2 wird weiter unterstützt', L.VERSION === 3 && Array.isArray(L.SUPPORTED_VERSIONS) && L.SUPPORTED_VERSIONS.includes(2) && L.SUPPORTED_VERSIONS.includes(3));
if (typeof L.getStepConfig !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }

/* ---------- 1) STEP_CONFIG ---------- */
{
  const ids = L.STEP_CONFIG.map(s => s.id);
  ok('SC1 IDs eindeutig', new Set(ids).size === ids.length);
  ok('SC2 nur gültige Tiers', L.STEP_CONFIG.every(s => ['essential', 'personalization', 'advanced'].includes(s.tier)));
  ok('SC3 required ⇒ nicht skippable (widerspruchsfrei)', L.STEP_CONFIG.every(s => !(s.required && s.skippable)));
  ok('SC4 welcome zählt nicht zum Fortschritt', L.getStepConfig('welcome').countsTowardProgress === false);
  ok('SC5 STEP_IDS (Legacy-API) bleibt exakt der aktive v2-Flow', JSON.stringify(L.STEP_IDS) === JSON.stringify(['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder', 'review_placeholder']));
  ok('SC6 Essential-Filter enthält aktive + künftige Essential-Steps', L.getStepsForTier('essential').map(s => s.id).includes('body') && L.getStepsForTier('essential').map(s => s.id).includes('profile'));
  ok('SC7 Personalisierung als künftige kanonische IDs definiert', L.getStepsForTier('personalization').length >= 5 && L.getStepsForTier('personalization').every(s => s.active === false));
  ok('SC8 keine UI-Texte in STEP_CONFIG', L.STEP_CONFIG.every(s => !s.title && !s.desc && !s.label));
  ok('SC9 isStepRequired/isStepSkippable', L.isStepRequired('profile') === true && L.isStepSkippable('profile') === false && L.isStepSkippable('body') === true && L.isStepRequired('unbekannt') === false);
}

/* ---------- 2) Migration v2 → v3 ---------- */
{
  const v2 = { version: 2, status: 'in_progress', currentStep: 'sports', completedSteps: ['welcome', 'profile'], draftData: { profile: VALID_PROFILE, sports: validSports(), fremdesFeld: { x: 1 } }, startedAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-02T00:00:00.000Z', completedAt: null, unbekanntTop: 'bleibt' };
  const m1 = L.normalizeDraft(JSON.parse(JSON.stringify(v2)));
  ok('M1 v2 wird akzeptiert (NICHT als korrupt verworfen) und auf v3 gehoben', !!m1 && m1.version === 3);
  ok('M2 completedSteps + currentStep erhalten', m1.currentStep === 'sports' && JSON.stringify(m1.completedSteps) === JSON.stringify(['welcome', 'profile']));
  ok('M3 skippedSteps ergänzt (leer)', Array.isArray(m1.skippedSteps) && m1.skippedSteps.length === 0);
  ok('M4 unbekannte Felder bleiben erhalten (top-level + draftData)', m1.unbekanntTop === 'bleibt' && m1.draftData.fremdesFeld && m1.draftData.fremdesFeld.x === 1);
  const m2 = L.normalizeDraft(JSON.parse(JSON.stringify(m1)));
  ok('M5 idempotent (Doppel-Migration strukturell identisch)', JSON.stringify(m1) === JSON.stringify(m2));
  const alias = L.normalizeDraft({ version: 2, status: 'in_progress', currentStep: 'profile_placeholder', completedSteps: ['welcome', 'profile_placeholder'], draftData: { profile: VALID_PROFILE } });
  ok('M6 v1/v2-Aliases wirken weiter (profile_placeholder→profile)', alias.currentStep === 'profile');
  const dirty = L.normalizeDraft({ version: 3, status: 'in_progress', currentStep: 'sports', completedSteps: ['welcome', 'profile', 'profile', 'kaputt'], skippedSteps: ['body', 'body', 'profile', 'unbekannt'], draftData: { profile: VALID_PROFILE, sports: validSports() } });
  ok('M7 ungültige/duplizierte completedSteps bereinigt', JSON.stringify(dirty.completedSteps) === JSON.stringify(['welcome', 'profile']));
  ok('M8 skippedSteps: nur bekannte skippable Steps, keine Duplikate', JSON.stringify(dirty.skippedSteps) === JSON.stringify(['body']));
  ok('M9 ungültiger currentStep → auf gültigen Step normalisiert', L.normalizeDraft({ version: 3, currentStep: 'gibtsnicht', status: 'in_progress', completedSteps: [], draftData: {} }).currentStep === 'welcome');
  ok('M10 Version 1 bleibt Sache des Stores (null → Corrupt-Backup unverändert)', L.normalizeDraft({ version: 1, currentStep: 'welcome' }) === null);
}

/* ---------- 3) Skip-Vertrag ---------- */
{
  let d = draftAt('goals_placeholder', ['welcome', 'profile', 'sports']);
  let r = L.skipStep(d, 'body', NOW);
  ok('S1 optionaler Step: ok + in skippedSteps', r.ok === true && d.skippedSteps.includes('body') && d.updatedAt === NOW);
  r = L.skipStep(d, 'body', NOW);
  ok('S2 doppelter Skip: ok, keine Duplikate', r.ok === true && d.skippedSteps.filter(s => s === 'body').length === 1);
  r = L.skipStep(d, 'profile', NOW);
  ok('S3 Pflichtstep wird abgelehnt (Result-Objekt, kein Throw)', r.ok === false && !!r.errors && !d.skippedSteps.includes('profile'));
  r = L.skipStep(d, 'gibtsnicht', NOW);
  ok('S4 unbekannter Step abgelehnt', r.ok === false && !!r.errors);
  d.completedSteps.push('body'); // widersprüchlich: completed UND skipped
  L.skipStep(d, 'body', NOW);
  ok('S5 Skip entfernt widersprüchliches completed', !d.completedSteps.includes('body') && d.skippedSteps.includes('body'));
  r = L.completeStep(d, 'body', NOW);
  ok('S6 späteres Complete entfernt Skip', r.ok === true && d.completedSteps.includes('body') && !d.skippedSteps.includes('body'));
  d = draftAt('body', ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder']);
  L.skipStep(d, 'body', NOW);
  ok('S7 Skip des aktuellen Steps bewegt currentStep deterministisch weiter (nächster aktiver)', d.currentStep === 'review_placeholder');
}

/* ---------- 4) completeStep-Vertrag ---------- */
{
  const d = draftAt('goals_placeholder', ['welcome', 'profile', 'sports']);
  let r = L.completeStep(d, 'goals_placeholder', NOW);
  ok('CP1 Step ohne Fachvalidierung abschließbar', r.ok === true && d.completedSteps.includes('goals_placeholder'));
  r = L.completeStep(d, 'profile', NOW);
  ok('CP2 validierte Steps (profile/sports) NICHT über completeStep (kein Validierungs-Bypass)', r.ok === false && !!r.errors);
  r = L.completeStep(d, 'nope', NOW);
  ok('CP3 unbekannter Step abgelehnt', r.ok === false);
}

/* ---------- 5) Navigation ---------- */
{
  const d = draftAt('sports', ['welcome', 'profile']);
  ok('N1 nächster Essential-Step', L.getNextStep(d) === 'goals_placeholder');
  ok('N2 vorheriger Step', L.getPreviousStep(d) === 'profile');
  ok('N3 vor welcome: null', L.getPreviousStep(draftAt('welcome', [])) === null);
  ok('N4 Ende Essential: null (KEIN Auto-Wechsel in Personalization)', L.getNextStep(draftAt('review_placeholder', [])) === null);
  ok('N5 Personalization nur explizit (aktuell keine aktiven Steps → null)', L.getNextStep(draftAt('review_placeholder', []), { tier: 'personalization' }) === null);
  ok('N6 Advanced niemals automatisch', L.getNextStep(draftAt('review_placeholder', []), { tier: 'personalization' }) !== 'devices');
  ok('N7 unbekannter currentStep → null (fail-safe)', L.getNextStep(draftAt('kaputt', [])) === null);
  const legacy = draftAt('profile_placeholder', []);
  ok('N8 Legacy-Alias in Navigation aufgelöst', L.getNextStep(legacy) === 'sports');
  ok('N9 inaktive Steps werden übersprungen (schedule → review, nicht body)', L.getNextStep(draftAt('schedule_placeholder', [])) === 'review_placeholder');
}

/* ---------- 6) Progress ---------- */
{
  let d = draftAt('welcome', []);
  let p = L.getProgress(d);
  ok('P1 0 %: total zählt nur countsTowardProgress+aktiv (5), welcome ausgeschlossen', p.total === 5 && p.completed === 0 && p.skipped === 0 && p.percentage === 0 && p.current === 1);
  d = draftAt('goals_placeholder', ['welcome', 'profile', 'sports']);
  p = L.getProgress(d);
  ok('P2 teilweise: completed zählt nur Arbeitsschritte (2/5 = 40 %)', p.completed === 2 && p.percentage === 40 && p.current === 3);
  d = draftAt('review_placeholder', ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder', 'review_placeholder']);
  p = L.getProgress(d);
  ok('P3 vollständig: 100 %, current geclamped auf total', p.percentage === 100 && p.current === 5);
  d = draftAt('goals_placeholder', ['welcome', 'profile', 'sports']);
  L.skipStep(d, 'body', NOW);
  p = L.getProgress(d, { includeInactive: true });
  ok('P4 übersprungener optionaler Step zählt als erledigt (includeInactive-Sicht: 3/6 = 50 %)', p.total === 6 && p.skipped === 1 && p.percentage === 50);
  p = L.getProgress(d);
  ok('P5 Standard-Sicht (nur aktive): Skip inaktiver Steps beeinflusst nichts', p.total === 5 && p.skipped === 0 && p.percentage === 40);
  ok('P6 Personalization beeinflusst Essential nicht', L.getProgress(d, { tier: 'personalization' }).total === 0);
  const broken = draftAt('kaputt', ['welcome', 'profile']);
  p = L.getProgress(broken);
  ok('P7 Clamp bei ungültigem currentStep', p.current >= 1 && p.current <= p.total && p.percentage >= 0 && p.percentage <= 100);
}

/* ---------- 7) Completion (Flow, strikt getrennt von Profil-Completeness) ---------- */
{
  const all = ['welcome', 'profile', 'sports', 'goals_placeholder', 'schedule_placeholder', 'review_placeholder'];
  ok('T1 alle Required erfüllt → essential complete', L.isTierComplete(draftAt('review_placeholder', all), 'essential') === true);
  ok('T2 Required fehlt → false', L.isTierComplete(draftAt('review_placeholder', all.filter(s => s !== 'sports')), 'essential') === false);
  const dOpt = draftAt('review_placeholder', all);
  ok('T3 optionaler (künftiger) Step offen → in includeInactive-Sicht false', L.isTierComplete(dOpt, 'essential', { includeInactive: true }) === false);
  L.skipStep(dOpt, 'body', NOW);
  ok('T4 optionaler Step übersprungen → complete (auch includeInactive)', L.isTierComplete(dOpt, 'essential', { includeInactive: true }) === true);
  ok('T5 Personalization unvollständig, Essential trotzdem abgeschlossen', L.isTierComplete(dOpt, 'essential') === true && L.isTierComplete(dOpt, 'personalization') === false);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
