/* ORVIA · 2026-07-16 — Profil-Interpretation (Nutzer-Feedback).
   Verträge:
   - alignPlanToAvailability: gespeicherter Wochenplan respektiert die Profil-Verfügbarkeit
     (Einheit am Ruhetag wandert auf nächstgelegenen verfügbaren freien Tag); pur/idempotent.
   - goalOf: Zielzeit wird auch OHNE metricType gezogen (unit 's' aus dem Cloud-Roundtrip)
     → nie mehr „Zielzeit offen" trotz eingegebener Zeit.
   - issuePromptDue: ≥7 Tage kein Signal ≥3 → proaktive Nachfrage; Antwort sperrt 14 Tage;
     frische Module ohne Historie werden nicht befragt.
   node supabase/tests/profile_interpretation_2026_07_16_test.mjs */
import fs from 'fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const appBase = new URL(_APPREL + '', import.meta.url);

/* ---- Permissiver DOM-/Env-Stub (Muster: decision_reentrancy_incident_test) ---- */
function makeEl(id) {
  return { id: id || '', innerHTML: '', textContent: '', value: '', disabled: false, dataset: {}, children: [],
    style: { setProperty() {} }, classList: { _s: new Set(), add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild(c) { return c; }, insertBefore(c) { return c; }, remove() {},
    closest() { return null; }, focus() {}, click() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, scrollIntoView() {}, getBoundingClientRect() { return { top: 0 }; } };
}
function sandbox() {
  const store = {}; const els = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {}, info() {}, table() {} };
  sb.performance = performance;
  [ 'Date','Math','JSON','Object','Array','String','Number','Boolean','RegExp','Map','Set','Promise','Error','RangeError','TypeError','Intl' ]
    .forEach(k => { sb[k] = globalThis[k]; });
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.encodeURIComponent = encodeURIComponent; sb.decodeURIComponent = decodeURIComponent;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.setInterval = () => 0; sb.clearInterval = () => {};
  sb.requestAnimationFrame = fn => setTimeout(fn, 16);
  sb.navigator = { onLine: true, language: 'de-DE', clipboard: { writeText: () => Promise.resolve() } };
  sb.location = { protocol: 'https:', hostname: 'localhost', href: 'https://localhost/', search: '', hash: '' };
  sb.history = { state: null, pushState() {}, back() {}, replaceState() {} };
  sb.crypto = { randomUUID: () => 't' + Math.random().toString(36).slice(2) };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.Blob = function () {}; sb.URL = { createObjectURL: () => 'x', revokeObjectURL() {} }; sb.FileReader = function () {};
  sb.addEventListener = () => {}; sb.removeEventListener = () => {}; sb.dispatchEvent = () => true;
  sb.scrollTo = () => {}; sb.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  sb.fetch = () => Promise.reject(new Error('no network'));
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: () => null, length: 0 };
  sb.document = { readyState: 'complete', getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    querySelector: () => null, querySelectorAll: () => [], createElement: () => makeEl(''), createTextNode: t => ({ textContent: t }),
    addEventListener() {}, removeEventListener() {}, body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'), visibilityState: 'visible' };
  sb.ORVIA_ENV = {};
  vm.createContext(sb);
  return { sb, store, els };
}
function seedDB(days, kneeByOffset) {
  const db = { _v: 4 };
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    db[k] = { date: k, morning: { sleepMin: 420, sleepQ: 7, feel: 7, legs: 7, doms: 1, knee: kneeByOffset(i), ill: false, ts: d.getTime() } };
  }
  return db;
}

const FILES = ['env.js', 'js/clock.js', 'js/config.js', 'js/supplements.js', 'js/calc.js', 'js/data.js',
  'js/profile.js', 'js/issues.js', 'js/intelligence.js', 'js/charts.js', 'js/ui.js', 'js/profile-model.js'];
function boot(dbSeed) {
  const h = sandbox();
  if (dbSeed) h.store['gian_checkins_v2'] = JSON.stringify(dbSeed);
  for (const f of FILES) vm.runInContext(fs.readFileSync(new URL(f, appBase), 'utf8'), h.sb, { filename: f, timeout: 8000 });
  return h;
}

/* ---------- 1) alignPlanToAvailability ---------- */
{
  const h = boot(seedDB(10, () => 0));
  const A = h.sb.alignPlanToAvailability;
  const plan = [[], [], [], [{ t: 'Laufen', l: 'Z2' }], [], [{ t: 'Gym', l: 'GK' }], []];   // Einheit am Do (3) + Sa (5)
  const cfg = { availableDayIdx: [0, 1, 2, 4, 5, 6], targetDays: 6 };                        // Donnerstag NICHT verfügbar
  const out = A(plan, cfg);
  ok('W1 Einheit am Ruhetag (Do) wird verschoben', out[3].length === 0);
  ok('W2 Ziel: nächstgelegener verfügbarer FREIER Tag (Mi oder Fr)', (out[2].length === 1) !== (out[4].length === 1) && (out[2][0] || out[4][0]).t === 'Laufen');
  ok('W3 belegte Tage bleiben unangetastet', out[5].length === 1 && out[5][0].t === 'Gym');
  ok('W4 Original-Plan nicht mutiert', plan[3].length === 1);
  ok('W5 idempotent', JSON.stringify(A(out, cfg)) === JSON.stringify(out));
  ok('W6 ohne Verfügbarkeit: unverändert', A(plan, null) === plan);
  // activeWeekPlan wendet die Ausrichtung auf den GESPEICHERTEN Plan an:
  vm.runInContext('PROFILE = PROFILE || {};', h.sb);
  h.sb.PROFILE.weekPlan = plan;
  h.sb.ORVIA = h.sb.ORVIA || {};
  h.sb.ORVIA.profileModel = { effectiveTrainingConfig: () => cfg };
  const act = vm.runInContext('activeWeekPlan()', h.sb);
  ok('W7 activeWeekPlan respektiert Verfügbarkeit (Do leer)', act[3].length === 0);
  ok('W8 gespeicherter Plan wird NICHT persistiert/mutiert', h.sb.PROFILE.weekPlan[3].length === 1);
}

/* ---------- 2) goalOf: Zielzeit ohne metricType (Cloud-Roundtrip) ---------- */
{
  const h = boot(seedDB(5, () => 0));
  vm.runInContext('PROFILE = PROFILE || {};', h.sb);
  h.sb.PROFILE.goals = [{ id: 'g1', category: 'half_marathon', title: 'HM unter 1:50', targetValue: 6600, unit: 's', status: 'active', priority: 1, targetDate: '2026-09-06' }];
  const g = vm.runInContext('goalOf()', h.sb);
  ok('Z1 Zielzeit aus unit=s gezogen (6600s → 110min)', g.targetMin === 110, 'targetMin=' + g.targetMin);
  ok('Z2 Distanz/Datum kanonisch', g.distanceKm > 21 && g.raceDate === '2026-09-06');
  h.sb.PROFILE.goals = [{ id: 'g2', category: 'half_marathon', title: 'HM', targetValue: 110, unit: 'min', status: 'active', priority: 1 }];
  ok('Z3 min-Einheit weiter korrekt', vm.runInContext('goalOf()', h.sb).targetMin === 110);
}

/* ---------- 3) issuePromptDue: proaktive Nachfrage ---------- */
{
  // Knie: vor 8 Tagen zuletzt 5/10, seitdem 0 → Nachfrage fällig
  const h = boot(seedDB(15, (i) => (i === 8 ? 5 : 0)));
  vm.runInContext('PROFILE = PROFILE || {}; PROFILE.issues=["knee"];', h.sb);
  ok('B1 ≥7 Tage ruhig → Nachfrage fällig', vm.runInContext('issuePromptDue("knee")', h.sb) === true);
  vm.runInContext('issuePromptKeep("knee")', h.sb);
  ok('B2 nach „Weiter unterstützen" 14 Tage keine erneute Frage', vm.runInContext('issuePromptDue("knee")', h.sb) === false);
  ok('B3 Antwort gemerkt (issuePromptAsked)', !!h.sb.PROFILE.issuePromptAsked.knee);
}
{
  // Signal vor 3 Tagen → keine Nachfrage
  const h = boot(seedDB(15, (i) => (i === 3 ? 5 : 0)));
  vm.runInContext('PROFILE = PROFILE || {}; PROFILE.issues=["knee"];', h.sb);
  ok('B4 Signal vor 3 Tagen → keine Nachfrage', vm.runInContext('issuePromptDue("knee")', h.sb) === false);
}
{
  // Modul ohne Historie (nie geloggt) → keine Nachfrage
  const h = boot({ _v: 4 });
  vm.runInContext('PROFILE = PROFILE || {}; PROFILE.issues=["back"];', h.sb);
  ok('B5 ohne Historie keine Nachfrage', vm.runInContext('issuePromptDue("back")', h.sb) === false);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
