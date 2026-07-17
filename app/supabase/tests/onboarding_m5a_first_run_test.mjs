/* ORVIA · M5a — First-Run-Rahmen: Welcome (A0) + „Über dich" (A1).
   Vertragstests gegen die M5a-Spezifikation:
   - A0: reines Begrüßungs-/Orientierungs-Screen, KEINE Eingaben, zählt NICHT zum Fortschritt.
   - A1: Name Pflicht, Geburtsdatum ODER Alter (13–100), Geschlecht optional (ChoiceCards,
     „Keine Angabe" neutral vorbelegt OHNE Draft-Write), KEINE Größe/Gewicht/Niveau (→ A7/A3).
   - Fortschrittszahlen ausschließlich aus getProgress() (keine harten Zahlen im UI).
   - Draft-only-Persistenz: vor Abschluss kein Profil-Write, nur der Onboarding-Draft-Key.
   - Fail-closed ohne UI-Kit. Keine Sackgasse: „Später" + Reopen setzt am Profil fort.
   Harness: Element-Registry wie onboarding_dom_test.mjs (kein jsdom). */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const wait = () => new Promise(r => setTimeout(r, 5));

globalThis.ORVIA = {};
const gWinEv = {};
globalThis.addEventListener = (t, fn) => { gWinEv[t] = fn; };
await import(new URL('../../js/onboarding/onboarding-profile-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-sports-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-logic.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-steps.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-store.js', import.meta.url));
await import(new URL('../../js/profile-ui-kit.js', import.meta.url));
await import(new URL('../../js/onboarding/onboarding-ui.js', import.meta.url));

async function fresh(seedMem) {
  const reg = new Map();
  function registerHtmlIds(html) { var m, re = /id="([^"]+)"/g; while ((m = re.exec(String(html || '')))) { if (!reg.has('#' + m[1])) reg.set('#' + m[1], makeEl()); } }
  function appendEl(el) { if (el && el._id) reg.set('#' + el._id, el); if (el) registerHtmlIds(el._html); }
  function makeEl() {
    const el = {
      style: {}, _html: '', value: '', textContent: '', disabled: false, checked: false, onclick: null, _id: null, _ev: {}, _focused: false,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; } },
      set innerHTML(v) { this._html = v; registerHtmlIds(v); }, get innerHTML() { return this._html; },
      set id(v) { this._id = v; if (v) reg.set('#' + v, this); }, get id() { return this._id; },
      _attr: {}, setAttribute(k, v) { this._attr[k] = v; if (k === 'id' && v) { this._id = v; reg.set('#' + v, this); } }, removeAttribute(k) { delete this._attr[k]; }, getAttribute(k) { return this._attr[k]; }, addEventListener(ev, cb) { this._ev[ev] = cb; }, appendChild(c) { appendEl(c); },
      remove() { if (this._id) reg.delete('#' + this._id); }, focus() { this._focused = true; },
      querySelector(sel) { return regGet(sel); }, querySelectorAll(sel) { return [regGet(sel)]; }
    };
    return el;
  }
  function regGet(k) { if (!reg.has(k)) reg.set(k, makeEl()); return reg.get(k); }
  function byId(id) { return reg.has('#' + id) ? reg.get('#' + id) : null; }
  const docEv = {};
  const docEl = { activeElement: null, visibilityState: 'visible', documentElement: { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } } }, body: { appendChild(c) { appendEl(c); } }, createElement: makeEl, getElementById: byId, querySelector: regGet, addEventListener(t, fn) { docEv[t] = fn; } };
  globalThis.document = docEl;
  const mem = Object.assign({}, seedMem || {});
  let saves = 0;
  globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { saves++; mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  globalThis.ORVIA.user = null;
  globalThis.ORVIA.profile = null;
  globalThis.ORVIA.onboardingV2._reset();
  globalThis.ORVIA.onboardingV2._state.bound = false;
  return { reg, byId, docEl, docEv, gWinEv, mem, saves: () => saves };
}
const L = globalThis.ORVIA.onboardingV2Logic;
const PL = globalThis.ORVIA.onboardingProfileLogic;
const Store = globalThis.ORVIA.onboardingV2Store;
const KIT = globalThis.ORVIA.profileUiKit;
const card = h => h.reg.get('.ob2-card');
const ST = () => globalThis.ORVIA.onboardingV2._state;
function profileSeed(profile) { const s = {}; s[Store.key(null)] = JSON.stringify(L.normalizeDraft({ version: 3, status: 'in_progress', currentStep: 'profile', completedSteps: ['welcome'], draftData: { profile: profile || {} } })); return s; }

/* ===== A0 — Welcome ===== */
// 1) Inhalte: Branding, Claim, Nutzenpunkte, Vertrauenszeile, Dauer, primär/sekundär
let h = await fresh();
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
let html = card(h).innerHTML || '';
ok('A0: Branding ORVIA', html.indexOf('ORVIA') >= 0);
ok('A0: Claim „Know your state."', html.indexOf('Know your state.') >= 0);
ok('A0: drei Nutzenpunkte', html.indexOf('Training passend zu deinem Alltag') >= 0 && html.indexOf('Tagesform verständlich einordnen') >= 0 && html.indexOf('Ziele strukturiert verfolgen') >= 0);
ok('A0: Vertrauenszeile + Datenschutz-Verweis', html.indexOf('bleiben in deinem Konto') >= 0 && html.indexOf('Datenschutz') >= 0);
ok('A0: Dauer-Hinweis ~4 Minuten', html.indexOf('4 Minuten') >= 0);
ok('A0: Primärbutton „Profil einrichten"', !!h.byId('ob3-start') && html.indexOf('Profil einrichten') >= 0);
ok('A0: Sekundär „Später fortsetzen"', !!h.byId('ob2-later') && html.indexOf('Später fortsetzen') >= 0);
// 2) KEINE Eingaben auf Welcome
ok('A0: keine Eingabefelder', html.indexOf('<input') < 0 && html.indexOf('<select') < 0 && html.indexOf('<textarea') < 0);
// 3) Welcome zählt NICHT zum Fortschritt
ok('A0: kein Schrittzähler', html.indexOf('Schritt') < 0);
const gpW = L.getProgress(ST().draft);
const dW = L.normalizeDraft({ version: 3, status: 'in_progress', currentStep: 'profile', completedSteps: ['welcome'] });
ok('getProgress: welcome verändert completed nicht', L.getProgress(dW).completed === gpW.completed && L.getProgress(dW).total === gpW.total);
// 4) Start → Profil-Schritt; Später → speichert + schließt (keine Sackgasse)
h.reg.get('#ob3-start').onclick();
ok('A0: Start → profile', ST().draft.currentStep === 'profile');
h.reg.get('#ob2-later').onclick();
ok('A0/A1: Später schließt + speichert Draft', h.docEl.documentElement.classList.contains('ob2-open') === false && JSON.parse(h.mem[Store.key(null)]).currentStep === 'profile');
// 5) Reopen setzt am Profil fort (kein Legacy-Flow, kein Welcome-Neustart)
const savedMem = h.mem[Store.key(null)];
h = await fresh({ [Store.key(null)]: savedMem });
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Reopen: Fortsetzung im Profil-Schritt (A1)', (card(h).innerHTML || '').indexOf('id="pf-displayName"') >= 0);

/* ===== A1 — „Über dich" ===== */
// 6) ProgressHeader-Zahlen kommen aus getProgress() (Interception, keine harten Zahlen)
let captured = null; const realPH = KIT.createProgressHeader;
KIT.createProgressHeader = function (opts) { captured = opts; return realPH(opts); };
let helpOpts = null; const realIH = KIT.createInlineHelp;
KIT.createInlineHelp = function (opts) { helpOpts = opts; return realIH(opts); };
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
const gpP = L.getProgress(ST().draft);
ok('A1: ProgressHeader current/total === getProgress()', !!captured && captured.current === gpP.current && captured.total === gpP.total);
ok('A1: ProgressHeader-Titel „Über dich"', !!captured && captured.title === 'Über dich');
ok('A1: InlineHelp „Warum fragen wir das?" (Kit-Aufruf)', !!helpOpts && helpOpts.label === 'Warum fragen wir das?');
KIT.createProgressHeader = realPH; KIT.createInlineHelp = realIH;
// Quelltext-Vertrag: keine hart codierte Schrittzahl im UI-Modul
const src = readFileSync(new URL('../../js/onboarding/onboarding-ui.js', import.meta.url), 'utf8');
ok('Quelle: kein hart codiertes „Schritt X von Y"', !/Schritt \d+ von \d+/.test(src));
// 7) Pflichtfelder-Vertrag (reine Logik): Name + (Geburtsdatum ODER Alter 13–100)
const T = new Date(2026, 6, 2);
ok('Validator: Name+Geburtsdatum gültig', PL.validateProfile({ displayName: 'Alex', birthDate: '2000-05-10' }, T).valid === true);
ok('Validator: Name+Alter 13 gültig', PL.validateProfile({ displayName: 'Alex', ageEstimate: 13 }, T).valid === true);
ok('Validator: Name+Alter 100 gültig', PL.validateProfile({ displayName: 'Alex', ageEstimate: 100 }, T).valid === true);
ok('Validator: Alter 12 ungültig', PL.validateProfile({ displayName: 'Alex', ageEstimate: 12 }, T).errors.ageEstimate != null);
ok('Validator: Alter 101 ungültig', PL.validateProfile({ displayName: 'Alex', ageEstimate: 101 }, T).errors.ageEstimate != null);
ok('Validator: weder Datum noch Alter → Fehler', PL.validateProfile({ displayName: 'Alex' }, T).errors.birthDate != null);
ok('Validator: Geburtsdatum hat Vorrang (Alter wird ignoriert)', PL.validateProfile({ displayName: 'Alex', birthDate: '2000-05-10', ageEstimate: 500 }, T).valid === true);
// 8) Optionalität: Geschlecht/Größe/Gewicht/Niveau nur bei Angabe geprüft
ok('Validator: ohne Geschlecht gültig', PL.validateProfile({ displayName: 'Alex', birthDate: '2000-05-10' }, T).errors.sex == null);
ok('Validator: ungültiges Geschlecht abgelehnt', PL.validateProfile({ displayName: 'Alex', birthDate: '2000-05-10', sex: 'x' }, T).errors.sex != null);
ok('Validator: ohne Größe/Gewicht/Niveau gültig', PL.validateProfile({ displayName: 'Alex', birthDate: '2000-05-10' }, T).valid === true);
// 9) Normalisierung ageEstimate: strikt, idempotent
ok('normalize: "30" → 30', PL.normalizeProfile({ ageEstimate: '30' }).ageEstimate === 30);
ok('normalize: 30.5 → null', PL.normalizeProfile({ ageEstimate: 30.5 }).ageEstimate === null);
ok('normalize: -5 → null', PL.normalizeProfile({ ageEstimate: -5 }).ageEstimate === null);
ok('normalize: "30abc" → null', PL.normalizeProfile({ ageEstimate: '30abc' }).ageEstimate === null);
const n1 = PL.normalizeProfile({ displayName: ' Bo ', ageEstimate: '30' });
ok('normalize: idempotent (inkl. ageEstimate)', JSON.stringify(PL.normalizeProfile(n1)) === JSON.stringify(n1));
// 10) A1-DOM: Label, keine A3/A7-Felder, Geschlecht neutral vorbelegt ohne Draft-Write
html = card(h).innerHTML || '';
ok('A1: Label „Wie dürfen wir dich nennen?"', html.indexOf('Wie dürfen wir dich nennen?') >= 0);
ok('A1: keine Größe/Gewicht/Niveau/Einheiten-Felder', html.indexOf('pf-height') < 0 && html.indexOf('pf-weight') < 0 && html.indexOf('pf-level') < 0 && html.indexOf('pf-unit') < 0);
ok('A1: „Keine Angabe" vorbelegt, Draft bleibt leer', h.byId('pf-sex-prefer_not_to_say').getAttribute('aria-pressed') === 'true' && (ST().draft.draftData.profile.sex || '') === '');
// 11) Geschlecht-Auswahl: Single-Select, Wechsel deselektiert vorherige Karte
h.byId('pf-sex-male')._ev.click();
ok('A1: Auswahl männlich → Draft', ST().draft.draftData.profile.sex === 'male');
h.byId('pf-sex-female')._ev.click();
ok('A1: Wechsel → weiblich, männlich deselektiert', ST().draft.draftData.profile.sex === 'female' && h.byId('pf-sex-male').getAttribute('aria-pressed') === 'false');
// 12) Draft-only-Persistenz: kein Profil-Write, nur der Draft-Key im Storage
ok('A1: kein vorzeitiger Profil-Write (ORVIA.profile bleibt null)', globalThis.ORVIA.profile === null);
ok('A1: nur Onboarding-Draft-Key im Storage', Object.keys(h.mem).every(k => k === Store.key(null)), 'keys=' + Object.keys(h.mem).join(','));
// 13) Fail-closed ohne UI-Kit: Fehleransicht, kein Weiter, App gesperrt
const realKit = globalThis.ORVIA.profileUiKit;
globalThis.ORVIA.profileUiKit = undefined;
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
ok('Kit fehlt → Fehleransicht (fail-closed)', (card(h).innerHTML || '').indexOf('Basisprofil nicht verfügbar') >= 0 && !h.byId('ob2-next'));
ok('Kit fehlt → App bleibt gesperrt', h.docEl.documentElement.classList.contains('ob2-open') === true);
globalThis.ORVIA.profileUiKit = realKit;
// 14) Vollständiger A1-Durchlauf im Alter-Modus: Weiter markiert profile als completed
h = await fresh(profileSeed({}));
globalThis.ORVIA.onboardingV2.open({ fresh: false });
await wait();
h.byId('pf-birthmode-age')._ev.click();
h.byId('pf-displayName').value = 'Alex'; h.byId('pf-age').value = '42';
ST().lastNav = 0; h.reg.get('#ob2-next').onclick();
ok('A1 (Alter-Modus): Weiter → sports, profile completed', ST().draft.currentStep === 'sports' && ST().draft.completedSteps.indexOf('profile') >= 0);
ok('A1: ageEstimate im Draft persistiert', String(JSON.parse(h.mem[Store.key(null)]).draftData.profile.ageEstimate) === '42');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
