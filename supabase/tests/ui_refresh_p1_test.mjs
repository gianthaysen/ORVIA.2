/* ============================================================
   ORVIA · P1 — zentraler Profil-State/Rerender-Consumer.
   Verträge:
   - targetsFor pur: sections+aktiver Tab → Renderziele (defensiv bei leer).
   - Event → gestubbte Renderer werden EINMAL aufgerufen (Coalescing).
   - Schleifenschutz drosselt Bursts (>5/s).
   - Genau eine Listener-Registrierung (Doppel-Load-Guard).
   - _profileSave(['personal']) berechnet PROFILE.age sofort neu.
   - showTab('heute') rendert; ui-refresh in index.html + sw-ASSETS.
   node supabase/tests/ui_refresh_p1_test.mjs
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

function sandbox() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.navigator = { onLine: true };
  const wl = {};
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  return { sb, wl, store };
}

/* ---------- 1) targetsFor (pur) ---------- */
{
  const h = sandbox();
  vm.runInContext(readFileSync(new URL('ui-refresh.js', base), 'utf8'), h.sb, { filename: 'ui-refresh.js' });
  const T = h.sb.ORVIA.uiRefresh.targetsFor;
  ok('T1 exportiert', typeof T === 'function');
  const a = T(['personal'], 'heute');
  ok('T2 personal@heute → topAvatar+profileCard+zones+day', ['topAvatar', 'profileCard', 'zones', 'day'].every(x => a.indexOf(x) >= 0));
  const b = T(['goals'], 'plan');
  ok('T3 goals@plan → goalSync+plan, kein day', b.indexOf('goalSync') >= 0 && b.indexOf('plan') >= 0 && b.indexOf('day') < 0);
  const c = T(['sports'], 'dash');
  ok('T4 sports@dash → kein dash-Rerender nötig', c.indexOf('dash') < 0);
  const d = T([], null);
  ok('T5 defensiv bei leer: Kernflächen + zones + goalSync', ['topAvatar', 'profileCard', 'zones', 'goalSync'].every(x => d.indexOf(x) >= 0));
  const e = T(['constraints'], 'dash');
  ok('T6 constraints@dash → dash', e.indexOf('dash') >= 0);
}

/* ---------- 2) Event → Renderer (Coalescing, goalSync, Drossel) ---------- */
{
  const h = sandbox();
  const calls = { day: 0, avatar: 0, card: 0 };
  h.sb.renderDay = () => { calls.day++; };
  h.sb.renderTopAvatar = () => { calls.avatar++; };
  h.sb.renderProfileScreen = () => { calls.card++; };
  h.sb.document.querySelector = sel => (sel === '.tabbar button.on[data-tab]' ? { dataset: { tab: 'heute' } } : null);
  h.sb.PROFILE = { hmTargetMin: 105 };
  h.sb.DB = { _hmTargetMin: 110 };
  let cacheInvalidated = 0; h.sb.orviaGoalCacheInvalidate = () => { cacheInvalidated++; };
  vm.runInContext(readFileSync(new URL('ui-refresh.js', base), 'utf8'), h.sb, { filename: 'ui-refresh.js' });
  // 3 Saves im selben Tick → EIN Refresh
  for (let i = 0; i < 3; i++) h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['goals'] } }));
  await new Promise(r => setTimeout(r, 250));
  ok('E1 Coalescing: 3 Events → 1 Refresh', calls.avatar === 1 && calls.card === 1, JSON.stringify(calls));
  ok('E2 sichtbares heute wird gerendert', calls.day === 1);
  ok('E3 goalSync: DB._hmTargetMin neu abgeleitet', h.sb.DB._hmTargetMin === 105);
  ok('E4 goalSync: Ziel-Cache invalidiert (Hook)', cacheInvalidated === 1);
  // Doppel-Load registriert NICHT erneut
  vm.runInContext(readFileSync(new URL('ui-refresh.js', base), 'utf8'), h.sb, { filename: 'ui-refresh.js#2' });
  h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['personal'] } }));
  await new Promise(r => setTimeout(r, 250));
  ok('E5 kein Doppel-Listener nach Doppel-Load', calls.avatar === 2, 'avatar=' + calls.avatar);
  // Burst-Drossel: 10 sequenzielle Ticks → max 5 Refreshes/s
  for (let i = 0; i < 10; i++) { h.sb.dispatchEvent(new h.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: ['personal'] } })); await new Promise(r => setTimeout(r, 2)); }
  await new Promise(r => setTimeout(r, 250));
  ok('E6 Burst gedrosselt (Schleifenschutz)', calls.avatar <= 7, 'avatar=' + calls.avatar);
  // Fehler in einem Renderer bricht die anderen nicht
  const h2 = sandbox();
  let after = 0;
  h2.sb.renderTopAvatar = () => { throw new Error('kaputt'); };
  h2.sb.renderProfileScreen = () => { after++; };
  vm.runInContext(readFileSync(new URL('ui-refresh.js', base), 'utf8'), h2.sb, { filename: 'ui-refresh.js' });
  h2.sb.dispatchEvent(new h2.sb.CustomEvent('orvia:profile-updated', { detail: { changedSections: [] } }));
  await new Promise(r => setTimeout(r, 250));
  ok('E7 Renderer-Fehler isoliert (fail-soft)', after === 1);
}

/* ---------- 3) PROFILE.age wird bei personal-Save neu berechnet ---------- */
{
  const h = sandbox();
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js', 'profile-store.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), h.sb, { filename: f }));
  h.sb.ensureProfile();
  h.sb.ORVIA.clock = { now: () => Date.parse('2026-07-09T12:00:00Z') };
  h.sb.PROFILE.birthDate = '2000-07-01';
  h.sb._profileSave(['personal']);
  ok('A1 age nach birthDate-Save sofort korrekt', h.sb.PROFILE.age === 26, 'age=' + h.sb.PROFILE.age);
  h.sb.PROFILE.birthDate = null; h.sb.PROFILE.ageEstimate = 31;
  h.sb._profileSave(['personal']);
  ok('A2 ageEstimate-Fallback greift', h.sb.PROFILE.age === 31, 'age=' + h.sb.PROFILE.age);
  h.sb._profileSave(['goals']);
  ok('A3 andere Sections rechnen age nicht um (kein Nebenwirkungs-Save)', h.sb.PROFILE.age === 31);
}

/* ---------- 4) Quelltext-/Bundle-Verträge ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('S1 showTab rendert heute (gekapselt seit Incident-Fix)', /name==='heute'\)_safe\(renderDay\)/.test(ui));
  ok('S2 goalCache-Hook exportiert', /orviaGoalCacheInvalidate\s*=\s*function\(\)\{_goalCache=null;\}/.test(ui));
  const html = readFileSync(new URL('../index.html', base), 'utf8');
  ok('S3 ui-refresh.js in index.html nach ui.js', html.indexOf('js/ui-refresh.js') > html.indexOf('js/ui.js'));
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  ok('S4 ui-refresh.js in sw-ASSETS', /ui-refresh\.js/.test(sw));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
