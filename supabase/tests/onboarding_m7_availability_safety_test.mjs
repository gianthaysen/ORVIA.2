/* ============================================================
   ORVIA · M7 — A5 Verfügbarkeit kompakt + A6 Sicherheitscheck + A7 Körper (M5c).
   Test-first (RED → GREEN). Verträge:
   - sports-logic: typicalDuration am Entry (10–600|null), setTypicalDuration,
     DURATION_BANDS (30/45/60/90plus → 30/45/60/90, dokumentiert).
   - profile-model: validateEssentialAvailability (≥1 Tag),
     validateSafetyCheck (Frage beantwortet; bei Ja Region+Intensität).
   - onboarding-logic: Steps 'safety' (required) + 'body' (skippbar) aktiv,
     Reihenfolge …goals→availability→safety→body→review, Progress-Total 8,
     advanceAvailability/advanceSafety fail-closed, Review-Voraussetzungen.
   - onboarding-ui: neue Renderer (Tages-Kreise+Dauer / Ja-Nein+Region+Stärke /
     Körper optional mit „Später ergänzen"), Completion-Mapping:
     typicalDuration→sports[primary], maxMinutes→verfügbare Tage,
     Sicherheitscheck→constraintsAcknowledgedAt (+constraintsList bei Ja).
   - D7: PROFILE_DEFAULTS ohne 70 kg/175 cm (fehlend = null; nur Neuanlage).
   node supabase/tests/onboarding_m7_availability_safety_test.mjs
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
const wait = () => new Promise(r => setTimeout(r, 5));

globalThis.ORVIA = {};
globalThis.addEventListener = () => {};
await import(new URL(_APPREL + 'js/onboarding/onboarding-profile-logic.js', import.meta.url));
await import(new URL(_APPREL + 'js/onboarding/onboarding-sports-logic.js', import.meta.url));
await import(new URL(_APPREL + 'js/profile-model.js', import.meta.url));
await import(new URL(_APPREL + 'js/onboarding/onboarding-logic.js', import.meta.url));
await import(new URL(_APPREL + 'js/onboarding/onboarding-steps.js', import.meta.url));
await import(new URL(_APPREL + 'js/onboarding/onboarding-store.js', import.meta.url));
await import(new URL(_APPREL + 'js/profile-ui-kit.js', import.meta.url));
await import(new URL(_APPREL + 'js/onboarding/onboarding-ui.js', import.meta.url));

const SL = globalThis.ORVIA.onboardingSportsLogic;
const L = globalThis.ORVIA.onboardingV2Logic;
const PM = globalThis.ORVIA.profileModel;
const Store = globalThis.ORVIA.onboardingV2Store;
const KIT = globalThis.ORVIA.profileUiKit;
const NOW = '2026-07-03T12:00:00.000Z';

const VALID_PROFILE = { displayName: 'Gian', birthDate: '2003-08-01' };
function selFull() {
  let s = SL.normalizeSportsSelection({});
  s = SL.toggleSport(s, 'running'); s = SL.setPrimarySport(s, 'running');
  s = SL.setTrainingLevel(s, 'running', 'intermediate'); s = SL.setSessionsPerWeek(s, 'running', 4);
  s = SL.setTypicalDuration(s, 'running', 60);
  return s;
}
function validGoals() { return PM.normalizeGoals([{ title: 'Halbmarathon', category: 'half_marathon', priority: 1 }]); }
function validAv() { return PM.normalizeAvailability({ days: { di: { available: true, singleSession: { maxMinutes: 60 } }, do: { available: true, singleSession: { maxMinutes: 60 } }, sa: { available: true, singleSession: { maxMinutes: 60 } } } }); }
function validSafety() { return { hasComplaints: false }; }
function draftAt(step, completed, dd) {
  const d = L.newDraft();
  d.status = 'in_progress'; d.currentStep = step;
  d.completedSteps = (completed || []).slice();
  d.draftData = Object.assign({ profile: Object.assign({}, VALID_PROFILE), sports: selFull(), goals: validGoals(), availability: validAv(), safety: validSafety() }, dd || {});
  return d;
}
const PRE_AV = ['welcome', 'profile', 'sports', 'training_level', 'goals'];
const PRE_SAFETY = PRE_AV.concat(['availability']);
const PRE_BODY = PRE_SAFETY.concat(['safety']);

/* ================= S — sports-logic: typicalDuration ================= */
['setTypicalDuration', 'durationForBand', 'bandForDuration'].forEach(fn => ok('S1 Export: ' + fn, typeof SL[fn] === 'function'));
if (typeof SL.setTypicalDuration !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }
{
  const n = SL.normalizeSportEntry({ sportId: 'running', typicalDuration: 60 });
  ok('S2 Entry erhält typicalDuration', n.typicalDuration === 60);
  ok('S3 out-of-range → null', SL.normalizeSportEntry({ sportId: 'running', typicalDuration: 5 }).typicalDuration === null && SL.normalizeSportEntry({ sportId: 'running', typicalDuration: 999 }).typicalDuration === null);
  const base = SL.normalizeSportsSelection({ sports: [{ sportId: 'running', role: 'primary' }] });
  const withD = SL.setTypicalDuration(base, 'running', 45);
  ok('S4 setTypicalDuration zielgenau + nicht-mutierend', withD.sports[0].typicalDuration === 45 && base.sports[0].typicalDuration === null);
  ok('S5 Band-Mapping 30/45/60/90plus', SL.durationForBand('30') === 30 && SL.durationForBand('45') === 45 && SL.durationForBand('60') === 60 && SL.durationForBand('90plus') === 90 && SL.durationForBand('x') === null);
  ok('S6 bandForDuration Rückweg + null ohne Wert', SL.bandForDuration(30) === '30' && SL.bandForDuration(50) === '45' && SL.bandForDuration(75) === '60' && SL.bandForDuration(120) === '90plus' && SL.bandForDuration(null) === null);
}

/* ================= V — profile-model Validatoren ================= */
ok('V1 Export validateEssentialAvailability', typeof PM.validateEssentialAvailability === 'function');
ok('V2 Export validateSafetyCheck', typeof PM.validateSafetyCheck === 'function');
{
  const bad = PM.validateEssentialAvailability({ days: {} });
  ok('V3 keine Tage → _days', !bad.valid && !!bad.errors._days);
  ok('V4 ≥1 Tag → valid', PM.validateEssentialAvailability(validAv()).valid === true);
  const s0 = PM.validateSafetyCheck(null);
  ok('V5 unbeantwortet → _answer', !s0.valid && !!s0.errors._answer);
  ok('V6 Nein → valid', PM.validateSafetyCheck({ hasComplaints: false }).valid === true);
  const s1 = PM.validateSafetyCheck({ hasComplaints: true, constraint: {} });
  ok('V7 Ja ohne Region/Intensität → Fehler', !s1.valid && !!s1.errors._region && !!s1.errors._intensity);
  ok('V8 Ja mit Region+Intensität → valid', PM.validateSafetyCheck({ hasComplaints: true, constraint: { bodyRegion: 'knee', intensity: 4 } }).valid === true);
  ok('V9 unbekannte Region → _region', PM.validateSafetyCheck({ hasComplaints: true, constraint: { bodyRegion: 'kniescheibe', intensity: 4 } }).valid === false);
  ok('V10 Intensität außerhalb 1–10 → _intensity', PM.validateSafetyCheck({ hasComplaints: true, constraint: { bodyRegion: 'knee', intensity: 0 } }).valid === false && PM.validateSafetyCheck({ hasComplaints: true, constraint: { bodyRegion: 'knee', intensity: 11 } }).valid === false);
}

/* ================= L — Statemachine ================= */
{
  ok('L1 STEP_IDS mit safety+body: 9 Schritte, korrekte Reihenfolge',
    JSON.stringify(L.STEP_IDS) === JSON.stringify(['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability', 'safety', 'body', 'review']));
  const cfgS = L.getStepConfig('safety'), cfgB = L.getStepConfig('body');
  ok('L2 safety required/nicht skippbar · body optional/skippbar', cfgS.required === true && cfgS.skippable === false && cfgB.required === false && cfgB.skippable === true && cfgB.active === true);
  ok('L3 Progress-Total = 8 (Arbeitsschritte A1–A8)', L.getProgress(L.newDraft()).total === 8);
}
{ // advanceAvailability
  ok('L4 Export advanceAvailability', typeof L.advanceAvailability === 'function');
  const inv = L.advanceAvailability(draftAt('availability', PRE_AV, { availability: { days: {} } }), NOW);
  ok('L5 ohne Tage → _days, Position bleibt', inv.ok === false && !!inv.errors._days && inv.draft.currentStep === 'availability');
  const noDur = L.advanceAvailability(draftAt('availability', PRE_AV, { sports: SL.setTypicalDuration(selFull(), 'running', null) }), NOW);
  ok('L6 ohne typische Dauer → _duration', noDur.ok === false && !!noDur.errors._duration);
  const good = L.advanceAvailability(draftAt('availability', PRE_AV), NOW);
  ok('L7 valide → weiter zu safety', good.ok === true && good.draft.currentStep === 'safety' && good.draft.completedSteps.indexOf('availability') >= 0);
}
{ // advanceSafety
  ok('L8 Export advanceSafety', typeof L.advanceSafety === 'function');
  const inv = L.advanceSafety(draftAt('safety', PRE_SAFETY, { safety: null }), NOW);
  ok('L9 unbeantwortet → _answer', inv.ok === false && !!inv.errors._answer);
  const good = L.advanceSafety(draftAt('safety', PRE_SAFETY), NOW);
  ok('L10 valide (Nein) → weiter zu body', good.ok === true && good.draft.currentStep === 'body');
  const goodYes = L.advanceSafety(draftAt('safety', PRE_SAFETY, { safety: { hasComplaints: true, constraint: { bodyRegion: 'knee', intensity: 4, side: 'left' } } }), NOW);
  ok('L11 valide (Ja+Details) → weiter', goodYes.ok === true);
}
{ // body: skippbar; review erreichbar über Skip ODER Complete
  const d = draftAt('body', PRE_BODY);
  const r = L.skipStep(d, 'body', NOW);
  ok('L12 body skippbar → currentStep review', r.ok === true && d.currentStep === 'review' && d.skippedSteps.indexOf('body') >= 0);
  ok('L13 Review-Voraussetzungen mit geskipptem body erfüllt', L.reviewPrerequisitesComplete(d) === true);
  const d2 = draftAt('body', PRE_BODY);
  L.completeStep(d2, 'body', NOW); L.advance(d2, NOW);
  ok('L14 body via completeStep+advance → review, Voraussetzungen ok', d2.currentStep === 'review' && L.reviewPrerequisitesComplete(d2) === true);
  const noSafety = draftAt('review', PRE_BODY.concat(['body']), { safety: null });
  ok('L15 ohne beantworteten Sicherheitscheck nicht review-fähig', L.reviewPrerequisitesComplete(noSafety) === false);
  // Alt-Draft-Rückführung: v4-Draft ohne safety-Daten, der auf review steht → zurück auf safety
  const relocated = L.normalizeDraft({ version: 4, status: 'in_progress', currentStep: 'review', completedSteps: PRE_BODY.concat(['body']), skippedSteps: [], draftData: { profile: Object.assign({}, VALID_PROFILE), sports: selFull(), goals: validGoals(), availability: validAv() } });
  ok('L16 Alt-Draft ohne Sicherheitscheck → Rückführung auf safety', relocated.currentStep === 'safety');
}

/* ================= D — DOM-Renderer ================= */
async function fresh(seedMem) {
  const reg = new Map();
  function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl()); } }
  function appendEl(el) { if (el && el._id) reg.set('#' + el._id, el); if (el) registerHtmlIds(el._html); }
  function makeEl() {
    const el = {
      style: {}, _html: '', value: '', textContent: '', disabled: false, checked: false, onclick: null, _id: null, _ev: {}, _focused: false, _children: [],
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; } },
      set innerHTML(v) { this._html = v; registerHtmlIds(v); }, get innerHTML() { return this._html; },
      set id(v) { this._id = v; if (v) reg.set('#' + v, this); }, get id() { return this._id; },
      _attr: {}, setAttribute(k, v) { this._attr[k] = String(v); if (k === 'id' && v) { this._id = v; reg.set('#' + v, this); } }, removeAttribute(k) { delete this._attr[k]; }, getAttribute(k) { return this._attr[k] != null ? this._attr[k] : null; },
      addEventListener(ev, cb) { this._ev[ev] = cb; }, appendChild(c) { this._children.push(c); appendEl(c); return c; },
      remove() { if (this._id) reg.delete('#' + this._id); }, focus() { this._focused = true; },
      querySelector(sel) { return regGet(sel); }, querySelectorAll() { return []; }
    };
    return el;
  }
  function regGet(k) { if (!reg.has(k)) reg.set(k, makeEl()); return reg.get(k); }
  function byId(id) { return reg.has('#' + id) ? reg.get('#' + id) : null; }
  const docEl = { activeElement: null, visibilityState: 'visible', documentElement: { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } }, body: { appendChild(c) { appendEl(c); } }, createElement: makeEl, getElementById: byId, querySelector: regGet, addEventListener() {} };
  globalThis.document = docEl;
  const mem = Object.assign({}, seedMem || {});
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  globalThis.ORVIA.user = null;
  globalThis.ORVIA.profile = null;
  globalThis.ORVIA.onboardingV2._reset();
  globalThis.ORVIA.onboardingV2._state.bound = false;
  return { reg, byId, docEl, mem };
}
const ST = () => globalThis.ORVIA.onboardingV2._state;
const card = h => h.reg.get('.ob2-card');
function seedDraft(draft) { const s = {}; s[Store.key(null)] = JSON.stringify(draft); return s; }

{ // D1: Verfügbarkeit — 7 Tages-Buttons + Dauer-Band; Auswahl schreibt kanonisch
  let h = await fresh(seedDraft(draftAt('availability', PRE_AV, { availability: { days: {} }, sports: SL.setTypicalDuration(selFull(), 'running', null) })));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  const html = card(h).innerHTML || '';
  ok('D1a 7 Tages-Buttons (av-day-*)', ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].every(d => html.indexOf('av-day-' + d) >= 0));
  // Tag wählen
  h.byId('av-day-di').onclick();
  await wait();
  ok('D1b Tag di → availability.days.di.available', ST().draft.draftData.availability.days.di.available === true);
  // Submit ohne Dauer → Fehler
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D1c ohne Dauer blockiert (err-duration)', ST().draft.currentStep === 'availability' && (card(h).innerHTML || '').indexOf('err-duration') >= 0);
  // Dauer wählen → typicalDuration + maxMinutes
  h.byId('avdur-60')._ev.click({ preventDefault() {} });
  await wait();
  const prim = ST().draft.draftData.sports.sports.filter(e => e.role === 'primary')[0];
  ok('D1d Dauer 60 → sports[primary].typicalDuration', prim.typicalDuration === 60);
  ok('D1e Dauer 60 → maxMinutes am verfügbaren Tag', ST().draft.draftData.availability.days.di.singleSession.maxMinutes === 60);
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D1f Submit valide → safety', ST().draft.currentStep === 'safety');
}
{ // D2: Sicherheitscheck — Nein-Pfad + Ja-Pfad
  let h = await fresh(seedDraft(draftAt('safety', PRE_SAFETY, { safety: null })));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  ok('D2a Ja/Nein-Karten vorhanden', !!h.byId('safety-no') && !!h.byId('safety-yes'));
  ok('D2b medizinische Abgrenzung sichtbar', (card(h).innerHTML || '').indexOf('ärztliche') >= 0);
  // Submit unbeantwortet → Fehler
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D2c unbeantwortet blockiert (err-safety)', ST().draft.currentStep === 'safety' && (card(h).innerHTML || '').indexOf('err-safety') >= 0);
  // Nein → weiter
  h.byId('safety-no')._ev.click({ preventDefault() {} });
  await wait();
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D2d Nein → body', ST().draft.currentStep === 'body' && ST().draft.draftData.safety.hasComplaints === false);
  // Ja-Pfad (Stepper über Kit-Interception: Kit-Interna deckt profile_ui_kit_test ab)
  let stepperOpts = null; const realStep = KIT.createStepper;
  KIT.createStepper = function (o) { stepperOpts = o; return realStep(o); };
  h = await fresh(seedDraft(draftAt('safety', PRE_SAFETY, { safety: null })));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  h.byId('safety-yes')._ev.click({ preventDefault() {} });
  await wait();
  ok('D2e Ja → Regionen sichtbar (Kit-Karten)', !!h.byId('region-knee'));
  h.byId('region-knee')._ev.click({ preventDefault() {} });
  await wait();
  ok('D2e2 Stepper korrekt konfiguriert (1–10, nullable, KEIN Default)', !!stepperOpts && stepperOpts.min === 1 && stepperOpts.max === 10 && stepperOpts.nullable === true && stepperOpts.value === null);
  stepperOpts.onChange(4);
  await wait();
  KIT.createStepper = realStep;
  ok('D2f Region+Intensität im Draft', ST().draft.draftData.safety.constraint.bodyRegion === 'knee' && ST().draft.draftData.safety.constraint.intensity === 4);
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D2g Ja-Pfad valide → body', ST().draft.currentStep === 'body');
}
{ // D3: Körper (A7) — optional, Skip ohne Datenzwang, valide Eingaben übernommen
  let h = await fresh(seedDraft(draftAt('body', PRE_BODY)));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  ok('D3a Eingaben + „Später ergänzen" vorhanden', !!h.byId('pf-heightCm') && !!h.byId('pf-weightKg') && !!h.byId('ob3-body-skip'));
  h.byId('ob3-body-skip').onclick();
  await wait();
  ok('D3b Skip → review, keine Körperdaten erzwungen', ST().draft.currentStep === 'review' && ST().draft.skippedSteps.indexOf('body') >= 0 && ST().draft.draftData.profile.heightCm == null);
  h = await fresh(seedDraft(draftAt('body', PRE_BODY)));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  h.byId('pf-heightCm').value = '183'; h.byId('pf-weightKg').value = '78,5';
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D3c valide Eingaben übernommen (Komma-Parsing)', ST().draft.draftData.profile.heightCm === 183 && ST().draft.draftData.profile.weightKg === 78.5 && ST().draft.currentStep === 'review');
  h = await fresh(seedDraft(draftAt('body', PRE_BODY)));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  h.byId('pf-heightCm').value = '999';
  ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D3d invalide Größe blockiert', ST().draft.currentStep === 'body' && (card(h).innerHTML || '').indexOf('err-heightCm') >= 0);
}

/* ================= P — Completion-Mapping + D7 ================= */
{
  const B = globalThis.ORVIA.onboardingV2._m4.buildCompletionPatch;
  const ddNo = { profile: Object.assign({}, VALID_PROFILE), sports: selFull(), goals: validGoals(), availability: validAv(), safety: { hasComplaints: false } };
  const p1 = B(ddNo, PM, NOW);
  ok('P1 Nein → constraintsAcknowledgedAt gesetzt, keine constraintsList', p1.constraintsAcknowledgedAt === NOW && (!p1.constraintsList || p1.constraintsList.length === 0));
  const ddYes = Object.assign({}, ddNo, { safety: { hasComplaints: true, constraint: { bodyRegion: 'knee', intensity: 4, side: 'left' } } });
  const p2 = B(ddYes, PM, NOW);
  ok('P2 Ja → Constraint kanonisch in constraintsList + Acknowledge', p2.constraintsAcknowledgedAt === NOW && Array.isArray(p2.constraintsList) && p2.constraintsList.length === 1 && p2.constraintsList[0].bodyRegion === 'knee' && p2.constraintsList[0].intensity === 4 && p2.constraintsList[0].status === 'active');
  const prim = (p2.sports || []).filter(s => s.role === 'primary')[0];
  ok('P3 typicalDuration erreicht PROFILE.sports[primary]', !!prim && prim.typicalDuration === 60);
  // Essential-Vollständigkeit über alle 5 Sections mit diesem Patch
  const prof = Object.assign({ name: 'Gian', birthDate: '2003-08-01' }, p2);
  const comp = PM.computeProfileCompleteness(prof);
  ok('P4 Essential-Vollständigkeit komplett erfüllbar', comp.essential.complete === true, JSON.stringify(comp.essential.missing));
  // unbeantwortet → KEIN Acknowledge (nichts erfinden)
  const p3 = B(Object.assign({}, ddNo, { safety: null }), PM, NOW);
  ok('P5 unbeantwortet → kein constraintsAcknowledgedAt', p3.constraintsAcknowledgedAt == null);
}
{ // D7: keine plausiblen Körper-Defaults mehr in PROFILE_DEFAULTS
  const src = readFileSync(new URL(_APPREL + 'js/profile.js', import.meta.url), 'utf8');
  ok('P6 D7: PROFILE_DEFAULTS ohne weightKg:70 / heightCm:175', !/weightKg:\s*70\b/.test(src) && !/heightCm:\s*175\b/.test(src));
  const m = src.match(/var PROFILE_DEFAULTS=\{[\s\S]*?\n\};/);
  ok('P7 D7: Defaults führen weightKg/heightCm als null', !!m && /weightKg:\s*null/.test(m[0]) && /heightCm:\s*null/.test(m[0]));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
