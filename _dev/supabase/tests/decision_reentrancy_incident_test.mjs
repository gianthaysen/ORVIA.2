/* ============================================================
   ORVIA · INCIDENT 2026-07-15 — getDecision-Reentranz-Regression.
   Bug: getDecision → riskCard/intelCtx → currentDecision → getDecision
   rekursierte bis zum Stack-Limit (gemessen Tiefe ~900–2800, ~5000 gefangene
   RangeErrors, >8 s CPU je Interaktion), weil der Entscheidungs-Cache erst am
   ENDE des Aufbaus gesetzt wird und ein In-Flight-Guard fehlte. renderDay/
   renderDecision invalidieren den Cache bei JEDER Interaktion → jede Interaktion
   (Tabwechsel, Wertänderung, Save, Overlay→Tab) blockierte 5–10 s.
   Verträge:
   - Ein invalidierter getDecision-Aufbau rekursiert NICHT (Tiefe ≤ 2).
   - Aufbau terminiert schnell (< 3 s Budget im vm, real ~10 ms).
   - Verschachtelte Aufrufe WÄHREND des Aufbaus liefern null (steuern nichts).
   - Ergebnis ist eine echte Entscheidung (dayState) und wird gecacht.
   node supabase/tests/decision_reentrancy_incident_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../../app/js/', import.meta.url);
const appBase = new URL('../../../app/', import.meta.url);

/* ---------- Permissiver DOM-Stub (jede ID existiert; Renderer laufen wirklich) ---------- */
function makeEl(id) {
  const el = {
    id: id || '', innerHTML: '', textContent: '', value: '', disabled: false, dataset: {}, children: [],
    style: { setProperty() {}, removeProperty() {}, display: '', visibility: '' },
    classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); }, contains(c) { return this._s.has(c); } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; }, remove() {},
    closest() { return null; }, focus() {}, click() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
  return el;
}
function sandbox() {
  const store = {};
  const els = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {}, info() {}, table() {} };
  sb.performance = performance;
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String;
  sb.Number = Number; sb.Boolean = Boolean; sb.RegExp = RegExp; sb.Map = Map; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.Error = Error; sb.RangeError = RangeError; sb.TypeError = TypeError;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.encodeURIComponent = encodeURIComponent; sb.decodeURIComponent = decodeURIComponent;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.setInterval = () => 0; sb.clearInterval = () => {};
  sb.requestAnimationFrame = fn => setTimeout(fn, 16);
  sb.navigator = { onLine: true, language: 'de-DE', clipboard: { writeText: () => Promise.resolve() } };
  sb.location = { protocol: 'https:', hostname: 'localhost', href: 'https://localhost/', search: '', hash: '' };
  sb.history = { state: null, pushState() {}, back() {}, replaceState() {} };
  sb.crypto = { randomUUID: () => 't' + Math.random().toString(36).slice(2) };
  sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.Event = function (t) { this.type = t; };
  sb.Blob = function () {}; sb.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }; sb.FileReader = function () {};
  sb.addEventListener = () => {}; sb.removeEventListener = () => {}; sb.dispatchEvent = () => true;
  sb.scrollTo = () => {}; sb.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
  sb.fetch = () => Promise.reject(new Error('no network'));
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: () => null, length: 0 };
  sb.document = {
    readyState: 'complete',
    getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => makeEl(''), createTextNode: t => ({ textContent: t }),
    addEventListener() {}, removeEventListener() {},
    body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
    visibilityState: 'visible', hidden: false
  };
  sb.ORVIA_ENV = {};
  vm.createContext(sb);
  return { sb, store };
}

/* ---------- Seed: 40 Tage Check-ins + Läufe + Gym ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function seed(days) {
  const db = { _v: 4, _hmTargetMin: 110 };
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const e = { date: k, morning: { sleepMin: 420, sleepQ: 7, rhr: 55, hrvMs: 65, hrv: 'Balanced', stress: 'Low', bb: 60, knee: i % 7 === 0 ? 2 : 0, feel: 7, legs: 7, doms: 1, weight: 74, ill: false, ts: d.getTime() }, eve: { prot: 140, energy: 7, mood: 7, knee: 0, note: '', ts: d.getTime() } };
    const s = {};
    if (i % 2 === 0) s.Laufen = { dist: 8, dur: 45, hr: 145, rpe: 5, perf: 6, sub: 'Easy' };
    if (i % 3 === 0) s.Gym = { dur: 60, sets: 16, rpe: 7, perf: 7, exLog: [{ n: 'Bankdrücken', sets: 4, reps: 8, kg: 60 }] };
    if (Object.keys(s).length) { s._ts = d.getTime(); e.sessions = s; }
    db[k] = e;
  }
  return db;
}

/* ---------- App-Skripte laden (index.html-Reihenfolge, netz-/UI-Infra ausgelassen) ---------- */
const FILES = ['env.js', 'js/clock.js', 'js/config.js', 'js/supplements.js', 'js/calc.js', 'js/data.js',
  'js/profile.js', 'js/issues.js', 'js/intelligence.js', 'js/charts.js', 'js/ui.js',
  'js/activity.js', 'js/nutrition.js', 'js/insights.js', 'js/race.js', 'js/extras.js',
  'js/training-domain.js', 'js/profile-model.js',
  'js/engine/engine-contracts.js', 'js/engine/readiness-engine-v2.js', 'js/engine/decision-engine-v2.js',
  'js/engine/shadow-runner.js'];

const h = sandbox();
h.store['gian_checkins_v2'] = JSON.stringify(seed(40));
let loadErr = null;
for (const f of FILES) {
  try { vm.runInContext(readFileSync(new URL(f, appBase), 'utf8'), h.sb, { filename: f, timeout: 5000 }); }
  catch (e) { loadErr = f + ': ' + (e && e.message); break; }
}
/* Vor dem Fix hing bereits die ui.js-Top-Level-Init (renderDay → getDecision-Rekursion). */
ok('R1 App-Skripte laden ohne Timeout (inkl. ui.js-Init mit 40 Tagen Daten)', loadErr == null, loadErr || '');

/* ---------- Rekursionstiefe instrumentieren ---------- */
vm.runInContext(`
var __d=0,__max=0,__range=0,__nestedNull=0,__nestedNonNull=0,__building=false;
(function(){var o=getDecision;getDecision=function(){
  __d++;if(__d>__max)__max=__d;
  if(__d>1){var r0;try{r0=o.apply(this,arguments);}finally{__d--;}
    if(r0==null)__nestedNull++;else __nestedNonNull++;return r0;}
  try{return o.apply(this,arguments);}catch(e){if(e instanceof RangeError)__range++;throw e;}finally{__d--;}
};})();`, h.sb, { timeout: 2000 });

/* ---------- Kernfall: invalidierter Aufbau ---------- */
let t0 = performance.now(), err = null, dec = null;
try { dec = vm.runInContext('invalidateDecision(); getDecision()', h.sb, { timeout: 3000 }); }
catch (e) { err = e && e.message; }
const dt = performance.now() - t0;
ok('R2 Aufbau terminiert < 3 s (real ~10 ms; vor Fix: >8 s Abbruch)', err == null, err || dt.toFixed(0) + ' ms');
ok('R3 keine Rekursion: max. Tiefe ≤ 2 (vor Fix: 871–2802)', vm.runInContext('__max', h.sb) <= 2, 'Tiefe=' + vm.runInContext('__max', h.sb));
ok('R4 keine gefangenen Stack-RangeErrors (vor Fix: ~5000)', vm.runInContext('__range', h.sb) === 0);
ok('R5 Ergebnis ist echte Entscheidung (dayState gesetzt)', dec && typeof dec.dayState === 'string' && dec.dayState.length > 0, dec && dec.dayState);
const nested = vm.runInContext('({n:__nestedNull,x:__nestedNonNull})', h.sb);
ok('R6 verschachtelte Aufrufe WÄHREND des Aufbaus lieferten null (steuern nichts)', nested.n >= 1 && nested.x === 0, 'null=' + nested.n + ' nonNull=' + nested.x);

/* ---------- Cache + Interaktionspfade ---------- */
const cached = vm.runInContext('getDecision()', h.sb, { timeout: 2000 });
ok('R7 zweiter Aufruf kommt aus dem Cache (Identität)', cached === dec);
let e2 = null; t0 = performance.now();
try {
  vm.runInContext('showTab("heute")', h.sb, { timeout: 3000 });
  vm.runInContext('autoMorning()', h.sb, { timeout: 3000 });
  vm.runInContext('saveMorning()', h.sb, { timeout: 3000 });
} catch (e) { e2 = e && e.message; }
ok('R8 showTab(heute)+autoMorning+saveMorning je < 3 s (vor Fix: je >8 s)', e2 == null, e2 || (performance.now() - t0).toFixed(0) + ' ms gesamt');
ok('R9 auch nach Interaktionen keine Rekursion (Tiefe ≤ 2)', vm.runInContext('__max', h.sb) <= 2, 'Tiefe=' + vm.runInContext('__max', h.sb));

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
