/* ============================================================
   ORVIA · M8 — A8 Review (ReviewCards + ehrliche Vollständigkeit) + Erfolgsscreen.
   Test-first. Verträge:
   - Review rendert je Essential-Bereich eine ReviewCard mit echten Werten und
     „Bearbeiten"-Rücksprung in den jeweiligen Schritt (auch body/skipped).
   - Vollständigkeit wird EHRLICH über buildCompletionPatch + profile-model
     berechnet (keine falsche Vollständigkeit; übersprungener body ≠ unvollständig,
     da Körperdaten optional sind).
   - Abschluss nutzt weiter den M4-Pfad (finishOnboarding, transaktional).
   - Erfolgsscreen: primärer CTA „Ersten Check-in machen" (schließt Shell,
     wechselt zum Heute-Tab, merkt Spotlight-Flag für M9) + „Zur App".
   - Legacy-Pfad „Einrichtung vormerken" ist aus dem aktiven Flow nicht erreichbar.
   node supabase/tests/onboarding_m8_review_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const wait = () => new Promise(r => setTimeout(r, 10));

globalThis.ORVIA = {};
globalThis.addEventListener = () => {};
await import(new URL('../../../app/js/onboarding/onboarding-profile-logic.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-sports-logic.js', import.meta.url));
await import(new URL('../../../app/js/profile-model.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-logic.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-steps.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-store.js', import.meta.url));
await import(new URL('../../../app/js/profile-ui-kit.js', import.meta.url));
await import(new URL('../../../app/js/onboarding/onboarding-ui.js', import.meta.url));

const SL = globalThis.ORVIA.onboardingSportsLogic;
const L = globalThis.ORVIA.onboardingV2Logic;
const PM = globalThis.ORVIA.profileModel;
const Store = globalThis.ORVIA.onboardingV2Store;

function selFull() {
  let s = SL.normalizeSportsSelection({});
  s = SL.toggleSport(s, 'running'); s = SL.toggleSport(s, 'gym'); s = SL.setPrimarySport(s, 'running');
  s = SL.setTrainingLevel(s, 'running', 'intermediate'); s = SL.setSessionsPerWeek(s, 'running', 4);
  s = SL.setTypicalDuration(s, 'running', 60);
  return s;
}
function fullDraft(over) {
  const d = L.newDraft();
  d.status = 'in_progress'; d.currentStep = 'review';
  d.completedSteps = ['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability', 'safety'];
  d.skippedSteps = ['body'];
  d.draftData = Object.assign({
    profile: { displayName: 'Gian', birthDate: '2003-08-01' },
    sports: selFull(),
    goals: PM.normalizeGoals([{ title: 'HM unter 1:50', category: 'half_marathon', priority: 1, targetDate: '2026-09-06' }]),
    availability: { days: { di: { available: true, singleSession: { maxMinutes: 60 } }, do: { available: true, singleSession: { maxMinutes: 60 } }, sa: { available: true, singleSession: { maxMinutes: 60 } } } },
    safety: { hasComplaints: false }
  }, over || {});
  return d;
}
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
      querySelector(sel) { return regGet(sel); }, querySelectorAll() { return []; },
      scrollIntoView() { el._scrolled = true; }
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
  globalThis.ORVIA.profileStore = { persist: async () => ({ success: true, sync_status: 'synced' }) };
  globalThis.ORVIA.onboardingV2._reset();
  globalThis.ORVIA.onboardingV2._state.bound = false;
  return { reg, byId, docEl, mem };
}
const ST = () => globalThis.ORVIA.onboardingV2._state;
const card = h => h.reg.get('.ob2-card');
function seed(draft) { const s = {}; s[Store.key(null)] = JSON.stringify(draft); return s; }

{ // R1: ReviewCards — alle Essential-Bereiche mit echten Werten + Rücksprüngen
  let h = await fresh(seed(fullDraft()));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  const html = card(h).innerHTML || '';
  ok('R1a Karten: Persönlich/Sport/Trainingsstand/Ziel/Verfügbarkeit/Sicherheit/Körper', ['rv-personal', 'rv-sports', 'rv-training', 'rv-goal', 'rv-availability', 'rv-safety', 'rv-body'].every(id => html.indexOf('id="' + id + '"') >= 0));
  ok('R1b echte Werte (Name/Sport/Ziel/Tage)', html.indexOf('Gian') >= 0 && html.indexOf('Laufen') >= 0 && html.indexOf('HM unter 1:50') >= 0 && html.indexOf('3 Tage') >= 0);
  ok('R1c Trainingsstand sichtbar (Level + Frequenz)', html.indexOf('Fortgeschritten') >= 0 && html.indexOf('4×') >= 0);
  ok('R1d Sicherheitscheck: Nein ehrlich dargestellt', html.indexOf('Keine Beschwerden angegeben') >= 0);
  ok('R1e Körper übersprungen: ehrlich + nachtragbar', html.indexOf('Übersprungen') >= 0);
  ok('R1f ehrliche Vollständigkeit: Essential vollständig', html.indexOf('Profil vollständig') >= 0);
  // Rücksprung
  ST().lastNav = 0;
  h.byId('rv-edit-goals').onclick();
  await wait();
  ok('R1g Bearbeiten springt zu goals', ST().draft.currentStep === 'goals');
}
{ // R2: fehlende Angaben werden EHRLICH ausgewiesen (kein „vollständig")
  const d = fullDraft({ safety: null });
  d.completedSteps = ['welcome', 'profile', 'sports', 'training_level', 'goals', 'availability'];
  d.currentStep = 'review';
  let h = await fresh(seed(d));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  // Rückführung greift: Draft ohne Sicherheitscheck landet auf safety, nicht auf review
  ok('R2a unvollständiger Draft erreicht Review nicht (Rückführung)', ST().draft.currentStep === 'safety');
}
{ // R3: Erfolgsscreen — CTAs + Spotlight-Flag + Tabwechsel
  let shownTab = null;
  globalThis.showTab = t => { shownTab = t; };
  let h = await fresh(seed(fullDraft()));
  globalThis.ORVIA.onboardingV2.open({ fresh: false });
  await wait();
  ST().lastNav = 0;
  h.byId('ob2-finish').onclick();
  await wait(); await wait();
  const html = card(h).innerHTML || '';
  ok('R3a Erfolgsscreen: „Dein Profil steht."', html.indexOf('Dein Profil steht.') >= 0);
  ok('R3b primärer CTA „Ersten Check-in machen"', !!h.byId('ob2-first-checkin'));
  ok('R3c sekundärer CTA „Zur App"', !!h.byId('ob2-toapp'));
  ok('R3d ehrliche Erwartung (Empfehlung NACH Check-in)', html.indexOf('Nach deinem ersten Check-in') >= 0);
  h.byId('ob2-first-checkin').onclick();
  await wait();
  ok('R3e CTA schließt Shell + wechselt zum Heute-Tab', h.docEl.documentElement.classList.contains('ob2-open') === false && shownTab === 'heute');
  ok('R3f Spotlight-Flag für M9 gesetzt (user-scoped Key)', (h.mem['orvia_coachmarks_v1:anonymous'] || '').indexOf('checkin_spotlight') >= 0);
  delete globalThis.showTab;
}
{ // R4: Quelltext — Legacy-„vormerken" nicht im aktiven Review-Flow
  const src = readFileSync(new URL('../../../app/js/onboarding/onboarding-ui.js', import.meta.url), 'utf8');
  ok('R4a renderSummaryStep nutzt finishOnboarding (M4), nicht goReviewReady', /ob2-finish/.test(String(src.match(/function renderSummaryStep[\s\S]*?\n  \}/))) && !/goReviewReady/.test(String(src.match(/function renderSummaryStep[\s\S]*?\n  \}/))));
  ok('R4b Erfolgsscreen ohne Auto-Close (Nutzer wählt)', !/setTimeout\([^)]*closeShell/.test(src));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
