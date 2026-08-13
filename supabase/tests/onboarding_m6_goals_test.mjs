/* ============================================================
   ORVIA · M6 — A4 Essential-Zielschritt + Draft-v4 (Placeholder-Ablösung).
   Test-first (RED → GREEN). Verträge:
   - Draft v4: goals_placeholder→goals, schedule_placeholder→availability,
     review_placeholder→review — Umbenennung über STEP_ALIASES (currentStep,
     completedSteps, skippedSteps); v2/v3-Drafts werden verlustfrei migriert.
   - profile-model: validateEssentialGoals (≥1 aktives Ziel mit Kategorie+Titel).
   - onboarding-logic: advanceGoals fail-closed (VALIDATED_STEPS), goalsValid
     in Kette/Walk/Review-Voraussetzungen.
   - onboarding-ui: Essential-Zielwahl als gruppierte ChoiceCards (EIN Ziel),
     optionale Details (Titel/Datum), goals[] kanonisch über profile-model,
     KEINE direkte primaryGoal-Schreibung (Projektion erst im Completion-Pfad).
   node supabase/tests/onboarding_m6_goals_test.mjs
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
function selComplete() {
  let s = SL.normalizeSportsSelection({});
  s = SL.toggleSport(s, 'running'); s = SL.setPrimarySport(s, 'running');
  s = SL.setTrainingLevel(s, 'running', 'intermediate'); s = SL.setSessionsPerWeek(s, 'running', 4);
  s = SL.setTypicalDuration(s, 'running', 60);   // M7 (A5)
  return s;
}
function validGoals() { return PM.normalizeGoals([{ title: 'Halbmarathon', category: 'half_marathon', priority: 1 }]); }
function draftAt(step, completed, dd) {
  const d = L.newDraft();
  d.status = 'in_progress'; d.currentStep = step;
  d.completedSteps = (completed || []).slice();
  d.draftData = Object.assign({ profile: Object.assign({}, VALID_PROFILE), sports: selComplete(), goals: validGoals(), availability: { days: { di: { available: true } } }, safety: { hasComplaints: false } }, dd || {});
  return d;
}

/* ================= V — Draft v4 + Aliasse ================= */
ok('V1 VERSION 4, v2+v3 unterstützt', L.VERSION === 4 && [2, 3, 4].every(v => L.SUPPORTED_VERSIONS.includes(v)));
ok('V2 STEP_IDS: Placeholder abgelöst (M7: + safety/body)', JSON.stringify(L.STEP_IDS) === JSON.stringify(['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability', 'safety', 'body', 'review']));
{
  const raw = { version: 3, status: 'in_progress', currentStep: 'goals_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'training_level'], skippedSteps: [], draftData: { profile: Object.assign({}, VALID_PROFILE), sports: selComplete() } };
  const d = L.normalizeDraft(raw);
  ok('V3 v3-Draft: currentStep goals_placeholder → goals', d.currentStep === 'goals');
  ok('V3b Version nach Migration = 4', d.version === 4);
  const raw2 = { version: 3, status: 'in_progress', currentStep: 'review_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'training_level', 'goals_placeholder', 'schedule_placeholder'], skippedSteps: [], draftData: { profile: Object.assign({}, VALID_PROFILE), sports: selComplete(), goals: validGoals(), availability: { days: { mo: { available: true } } } } };
  const d2 = L.normalizeDraft(raw2);
  ok('V4 completedSteps umbenannt (goals/availability)', d2.completedSteps.indexOf('goals') >= 0 && d2.completedSteps.indexOf('availability') >= 0 && d2.completedSteps.indexOf('goals_placeholder') < 0);
  // M7: Alt-Drafts am Review OHNE Sicherheitscheck werden fail-closed auf den neuen Pflichtschritt geführt.
  ok('V5 Alt-Draft am Review → Rückführung auf neuen Pflichtschritt safety', d2.currentStep === 'safety');
  const rawV2 = { version: 2, status: 'in_progress', currentStep: 'schedule_placeholder', completedSteps: ['welcome', 'profile', 'sports', 'training_level', 'goals_placeholder'], draftData: { profile: Object.assign({}, VALID_PROFILE), sports: selComplete(), goals: validGoals() } };
  const dv2 = L.normalizeDraft(rawV2);
  ok('V6 v2-Draft ebenso migriert (schedule → availability)', dv2.currentStep === 'availability' && dv2.completedSteps.indexOf('goals') >= 0);
}

/* ================= G — profile-model: validateEssentialGoals ================= */
ok('G1 Export validateEssentialGoals', typeof PM.validateEssentialGoals === 'function');
if (typeof PM.validateEssentialGoals !== 'function') { console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen. (RED)'); process.exit(1); }
{
  const v0 = PM.validateEssentialGoals([]);
  ok('G2 leer → invalid + _goal', !v0.valid && !!v0.errors._goal);
  const v1 = PM.validateEssentialGoals(validGoals());
  ok('G3 Kategorie+Titel → valid', v1.valid === true);
  const v2 = PM.validateEssentialGoals(PM.normalizeGoals([{ title: '', category: 'half_marathon' }]));
  ok('G4 ohne Titel → invalid (Completion-Filter würde Ziel verwerfen)', v2.valid === false);
  const v3 = PM.validateEssentialGoals(PM.normalizeGoals([{ title: 'X', category: 'half_marathon', status: 'archived' }]));
  ok('G5 nur archivierte Ziele → invalid', v3.valid === false);
}

/* ================= L — onboarding-logic ================= */
{
  ok('L1 Export advanceGoals', typeof L.advanceGoals === 'function');
  const wrong = L.advanceGoals(draftAt('sports', ['welcome', 'profile']), NOW);
  ok('L2 falscher Schritt → _step', wrong.ok === false && !!wrong.errors._step);
  const inv = L.advanceGoals(draftAt('goals', ['welcome', 'profile', 'sports', 'training_level'], { goals: [] }), NOW);
  ok('L3 leere Ziele → ok:false + _goal', inv.ok === false && !!inv.errors._goal && inv.draft.currentStep === 'goals');
  const good = L.advanceGoals(draftAt('goals', ['welcome', 'profile', 'sports', 'training_level']), NOW);
  ok('L4 valide → weiter zu availability', good.ok === true && good.draft.currentStep === 'availability' && good.draft.completedSteps.indexOf('goals') >= 0);
  const c = L.completeStep(draftAt('goals', []), 'goals', NOW);
  ok('L5 completeStep(goals) abgelehnt (Fachvalidierung)', c.ok === false);
  const adv = draftAt('goals', ['welcome', 'profile', 'sports', 'training_level'], { goals: [] });
  L.advance(adv, NOW);
  ok('L6 advance fail-closed ohne valide Ziele', adv.currentStep === 'goals');
  // Kette: goals in completedSteps ohne Daten → entfernt + Rückführung
  const lie = L.normalizeDraft({ version: 4, status: 'in_progress', currentStep: 'availability', completedSteps: ['welcome', 'profile', 'sports', 'training_level', 'goals'], skippedSteps: [], draftData: { profile: Object.assign({}, VALID_PROFILE), sports: selComplete(), goals: [] } });
  ok('L7 goals-Behauptung ohne Daten → Rückführung auf goals', lie.currentStep === 'goals' && lie.completedSteps.indexOf('goals') < 0);
  // Review-Voraussetzungen: jetzt am Step 'review'
  const rv = draftAt('review', ['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability', 'safety', 'body']);
  ok('L8 reviewPrerequisitesComplete am neuen review-Step', L.reviewPrerequisitesComplete(rv) === true);
  const rvNoG = draftAt('review', ['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability', 'safety', 'body'], { goals: [] });
  ok('L9 ohne valide Ziele nicht review-fähig', L.reviewPrerequisitesComplete(rvNoG) === false);
}

/* ================= D — DOM: A4-Renderer ================= */
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
function goalsDraft(goals) { return draftAt('goals', ['welcome', 'profile', 'sports', 'training_level'], { goals: goals || [] }); }

{ // D1: Renderer — gruppierte ChoiceCards aus dem kuratierten Katalog, alle IDs kanonisch
  let ccOpts = []; const realCC = KIT.createChoiceCard;
  KIT.createChoiceCard = function (o) { ccOpts.push(o); return realCC(o); };
  let phOpts = null; const realPH = KIT.createProgressHeader;
  KIT.createProgressHeader = function (o) { phOpts = o; return realPH(o); };
  let h = await fresh(seedDraft(goalsDraft()));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  const goalCards = ccOpts.filter(o => String(o.id || '').indexOf('goal-') === 0);
  ok('D1a Zielkarten gerendert (12–18, gruppiert, keine Chip-Wüste)', goalCards.length >= 12 && goalCards.length <= 18);
  const flat = [].concat.apply([], Object.keys(PM.GOAL_CATEGORIES).map(k => PM.GOAL_CATEGORIES[k]));
  ok('D1b JEDE Karten-ID ist eine kanonische GOAL_CATEGORIES-ID', goalCards.every(o => flat.indexOf(String(o.id).slice(5)) >= 0));
  {
    // Gruppentitel werden als Elemente (textContent) erzeugt → über die Kind-Elemente prüfen.
    const wrap = h.reg.get('#ob3-goalgroups');
    const labels = (wrap._children || []).filter(el => String(el.className || '') === 'ob3-goalgroup-label').map(el => el.textContent);
    ok('D1c Gruppentitel vorhanden', labels.indexOf('Ausdauer') >= 0 && labels.some(l => String(l).indexOf('Gesundheit') >= 0) && labels.length === 4);
  }
  const gp = L.getProgress(ST().draft);
  ok('D1d ProgressHeader aus getProgress()', !!phOpts && phOpts.current === gp.current && phOpts.total === gp.total);
  // D2: Auswahl erzeugt genau EIN kanonisches Ziel mit Auto-Titel (Label), priority 1
  const hm = goalCards.filter(o => o.id === 'goal-half_marathon')[0];
  hm.onChange('half_marathon', true);
  await wait();
  let gs = PM.normalizeGoals(ST().draft.draftData.goals);
  ok('D2a Auswahl → genau ein Essential-Ziel', gs.length === 1 && gs[0].category === 'half_marathon' && gs[0].priority === 1);
  ok('D2b Auto-Titel aus Label (editierbar, kein leerer Titel)', !!gs[0].title && gs[0].title.trim().length > 0);
  // D3: Umwahl ERSETZT das Essential-Ziel (kein Duplikat-Stapel)
  ccOpts = [];
  globalThis.ORVIA.onboardingV2._reset(); globalThis.ORVIA.onboardingV2._state.bound = false;
  h = await fresh(seedDraft(JSON.parse(JSON.stringify(ST().draft || goalsDraft()))));
  // frisch öffnen mit vorhandener Auswahl
  const seeded = goalsDraft(); seeded.draftData.goals = gs; seeded.draftData._essentialGoalId = gs[0].id;
  h = await fresh(seedDraft(seeded));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  const mg = ccOpts.filter(o => o.id === 'goal-muscle_gain')[0];
  mg.onChange('muscle_gain', true);
  await wait();
  gs = PM.normalizeGoals(ST().draft.draftData.goals);
  ok('D3 Umwahl ersetzt statt stapelt', gs.length === 1 && gs[0].category === 'muscle_gain');
  KIT.createChoiceCard = realCC; KIT.createProgressHeader = realPH;
}
{ // D4: Details (optionaler Titel + Datum) aktualisieren das Essential-Ziel
  let h = await fresh(seedDraft(goalsDraft()));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  // Ziel wählen über echten Kit-Karten-Klick (Element-Ebene)
  h.byId('goal-half_marathon')._ev.click({ preventDefault() {} });
  await wait();
  const t = h.byId('obg-title'); t.value = 'HM unter 1:50';
  t._ev.change && t._ev.change({});
  const dte = h.byId('obg-date'); dte.value = '2026-09-06';
  dte._ev.change && dte._ev.change({});
  const gs = PM.normalizeGoals(ST().draft.draftData.goals);
  ok('D4a Titel-Detail übernommen', gs[0].title === 'HM unter 1:50');
  ok('D4b Datum übernommen (targetDate)', gs[0].targetDate === '2026-09-06');
  ok('D4c weiterhin genau EIN Ziel', gs.length === 1);
  // D5: Submit → availability; Draft persistiert
  ST().lastNav = 0;
  h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D5a Submit valide → availability', ST().draft.currentStep === 'availability');
  ok('D5b persistiert inkl. Ziel', JSON.parse(h.mem[Store.key(null)]).draftData.goals.length === 1);
}
{ // D6: Fehlerpfad — ohne Auswahl blockiert mit role=alert
  let h = await fresh(seedDraft(goalsDraft()));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  ST().lastNav = 0;
  h.reg.get('#ob2-next').onclick();
  await wait();
  ok('D6a bleibt auf goals', ST().draft.currentStep === 'goals');
  ok('D6b Fehler sichtbar (err-goal, role=alert)', (card(h).innerHTML || '').indexOf('err-goal') >= 0 && (card(h).innerHTML || '').indexOf('role="alert"') >= 0);
}
{ // D7: Bestehende weitere Ziele (Seed aus Profil) bleiben unangetastet
  const seeded = goalsDraft(PM.normalizeGoals([{ title: 'Bestandsziel', category: 'get_stronger', priority: 2 }]));
  let h = await fresh(seedDraft(seeded));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  h.byId('goal-half_marathon')._ev.click({ preventDefault() {} });
  await wait();
  const gs = PM.normalizeGoals(ST().draft.draftData.goals);
  ok('D7 Bestandsziel bleibt + Essential-Ziel ergänzt', gs.length === 2 && gs.some(g => g.title === 'Bestandsziel') && gs.some(g => g.category === 'half_marathon'));
}
{ // Q: Quelltext-Verträge
  const src = readFileSync(new URL(_APPREL + 'js/onboarding/onboarding-ui.js', import.meta.url), 'utf8');
  ok('Q1 keine direkte primaryGoal-Schreibung im Onboarding-UI', !/PROFILE\s*\.\s*primaryGoal\s*=|patch\.primaryGoal\s*=/.test(src));
  ok('Q2 kein goals_placeholder mehr im UI-Router', src.indexOf("=== 'goals_placeholder'") < 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
