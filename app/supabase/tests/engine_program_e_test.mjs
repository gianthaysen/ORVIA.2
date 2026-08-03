/* ============================================================
   ORVIA · E-Programm — Engine produktreif (Master-Prompt Prio 1+3).
   E1: „Plan jetzt neu aufbauen" baut REAL neu (Live-Fail: war No-Op);
       Plan-Tab-Banner bei ausstehender Neuberechnung; resetPlan ehrlich.
   E2: Engine-v2 Shadow-Mode — läuft parallel, steuert nichts, protokolliert
       v1-vs-v2 pro Tag (Ringpuffer, user-scoped), Gate-Report ≥14 Tage.
   E3: Calc.loadModel (ATL/CTL/TSB, Foster-Monotonie/Strain, ACWR) — pur,
       null bei zu wenig Daten.
   node supabase/tests/engine_program_e_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

/* ---------- E1: _planDecide('now') baut real neu (funktional) ---------- */
{
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.navigator = { onLine: true };
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {}; sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  let planRendered = 0; sb.renderPlan = () => { planRendered++; };
  sb.ORVIA = {};
  vm.createContext(sb);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ensureProfile();
  sb.PROFILE.weekPlan = [[{ t: 'Gym', l: 'Alt' }], [], [], [], [], [], []];
  sb.PROFILE._planUndo = { x: 1 };
  sb.PROFILE.planImpact = { pending: true };
  sb._planDecide('now');
  ok('E1a now ⇒ weekPlan verworfen (Generator übernimmt)', sb.PROFILE.weekPlan === null && sb.PROFILE._planUndo === null);
  ok('E1b pending aufgelöst + rebuilt dokumentiert', sb.PROFILE.planImpact.pending === false && sb.PROFILE.planImpact.userDecision === 'rebuilt');
  ok('E1c Plan-Tab neu gerendert', planRendered === 1);
  ok('E1d Blob persistiert', !!store.orvia_profile_v1 && JSON.parse(store.orvia_profile_v1).weekPlan === null);
  sb.PROFILE.weekPlan = [[{ t: 'Gym', l: 'Alt' }], [], [], [], [], [], []];
  sb._planDecide('later');
  ok('E1e later ⇒ Plan bleibt, pending gesetzt (Banner-Grundlage)', sb.PROFILE.weekPlan !== null && sb.PROFILE.planImpact.pending === true);
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('E1f Plan-Tab-Banner bei pending (orviaRebuildPlan)', /planRebuildBanner/.test(ui) && /orviaRebuildPlan/.test(ui) && /Plan neu aufbauen<\/button>/.test(ui));
  ok('E1g resetPlan löst pending + ehrlicher Toast', /resetPlan/.test(ui) && /aus deiner aktuellen Konfiguration/.test(ui));
}

/* ---------- E2: Shadow-Runner mit ECHTEN Engine-Dateien ---------- */
{
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.ORVIA = { user: { id: 'user-A' } };
  sb.todayStr = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.DB = {};
  sb.DB[sb.todayStr()] = { morning: { sleepMin: 480, sleepQ: 8, feel: 8, doms: 1, rhr: 52, ill: false, pain: 0 } };
  sb.recoveryCtx = () => ({ rhrBase: 52, hrvBase7: null });
  sb.readinessOf = () => 84;
  sb.currentDecision = () => ({ state: 'GREEN', todayAction: 'KEEP', score: 84 });
  sb.activeWeekPlan = () => [[{ t: 'Laufen', l: 'Intervalle', d: 'iv' }], [], [], [], [], [], []];
  sb.daysTo = () => 60; sb.RACE = { date: '2026-09-10' };
  sb.Calc = { sessionLoad: e => (e && e.sessions && e.sessions.Laufen ? 300 : 0) };
  vm.createContext(sb);
  /* Batch 0: REALER Script-Order wie index.html (contracts → readiness →
     decision → training-input-resolver → shadow-runner). Vorher fehlte der
     Resolver im Test ⇒ der Runner fiel auf den (inzwischen entfernten)
     optimistischen Leer-Input zurück und verlor das Krankheitssignal. */
  ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js', 'engine/training-input-resolver.js', 'engine/shadow-runner.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const S = sb.ORVIA.engineShadow;
  ok('S1 Shadow-Runner exportiert', S && typeof S.run === 'function' && typeof S.report === 'function');
  const e1 = S.run();
  ok('S2 Lauf erzeugt Eintrag mit v1+v2', !!e1 && e1.v1.state === 'GREEN' && !!e1.v2.state, JSON.stringify(e1 && e1.v2));
  ok('S3 agree berechnet', typeof e1.agree === 'boolean');
  const log1 = JSON.parse(store['orvia_engine_shadow_user-A']);
  ok('S4 user-scoped Log geschrieben', log1.length === 1 && log1[0].date === sb.todayStr());
  S.run(); S.run();
  ok('S5 ein Eintrag je Tag (letzter Lauf gewinnt, kein Aufblähen)', JSON.parse(store['orvia_engine_shadow_user-A']).length === 1);
  // Krankheits-Fixture: v2 muss mindestens ORANGE liefern (Invariante 2) — Shadow protokolliert Differenz zu (fixem) v1-GREEN
  sb.DB[sb.todayStr()].morning.ill = true;
  const e2 = S.run();
  ok('S6 v2-Invariante: Krankheit ⇒ nie GREEN', e2.v2.state !== 'GREEN', e2.v2.state);
  ok('S7 Differenz ehrlich protokolliert (agree=false)', e2.agree === false);
  const rep = S.report();
  ok('S8 Gate-Report: Tage/Rate/gateReady(<14 Tage ⇒ false)', rep.comparableDays === 1 && rep.gateReady === false && rep.diffs.length === 1);
  // Steuerungs-Verbot: ui.js ruft run() nur try/fail-soft, keine v2-Zustände im Render
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  ok('S9 Shadow steuert nichts (nur run()-Hook in renderDecision)', /engineShadow\)window\.ORVIA\.engineShadow\.run\(\)/.test(ui.replace(/\s/g, '')) && !/engineShadow\.(report|buildInput)/.test(ui));
  const html = readFileSync(new URL('../index.html', base), 'utf8');
  ok('S10 Engine-Dateien + Runner eingebunden (Shadow-Kommentar)', /engine\/shadow-runner\.js/.test(html) && /SHADOW-MODE/.test(html));
  ok('S10b Resolver VOR Runner geladen (realer Script-Order)',
    html.indexOf('engine/training-input-resolver.js') >= 0 && html.indexOf('engine/training-input-resolver.js') < html.indexOf('engine/shadow-runner.js'));
  const sw = readFileSync(new URL('../sw.js', base), 'utf8');
  ok('S11 Engine-Dateien in sw-ASSETS', /engine\/decision-engine-v2\.js/.test(sw) && /engine\/shadow-runner\.js/.test(sw) && /engine\/training-input-resolver\.js/.test(sw));
}

/* ---------- Batch 0: FAIL CLOSED ohne TrainingInputResolver ---------- */
{
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.ORVIA = { user: { id: 'user-B' } };
  sb.todayStr = () => '2026-07-18';
  sb.currentDecision = () => ({ state: 'GREEN', todayAction: 'KEEP', score: 84 });
  vm.createContext(sb);
  // Bewusst OHNE training-input-resolver.js — Ladefehler-Szenario.
  ['engine/engine-contracts.js', 'engine/readiness-engine-v2.js', 'engine/decision-engine-v2.js', 'engine/shadow-runner.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const S = sb.ORVIA.engineShadow;
  ok('F1 buildInput ohne Resolver ⇒ null (kein optimistischer Ersatz-Input)', S.buildInput() === null);
  const e = S.run();
  ok('F2 BLOCKED-Eintrag statt v2-Bewertung (nie GREEN raten)',
    !!e && e.v2.state === null && e.v2.action === null && e.v2.blocked === 'training_input_resolver_missing', JSON.stringify(e && e.v2));
  ok('F3 nicht vergleichbar (agree=null) + missing dokumentiert', e.agree === null && e.missing.indexOf('training_input_resolver_missing') >= 0);
  const rep = S.report();
  ok('F4 Report: blocked zählt nicht als vergleichbarer Tag', rep.days === 1 && rep.comparableDays === 0 && rep.blockedDays === 1, JSON.stringify(rep));
}

/* ---------- E3: loadModel (pur) ---------- */
{
  const sb = { window: {}, console }; sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('calc.js', base), 'utf8'), sb, { filename: 'calc.js' });
  const LM = sb.Calc.loadModel;
  ok('L1 exportiert', typeof LM === 'function');
  ok('L2 zu wenig Daten ⇒ null (keine erfundenen Kennzahlen)', LM([100, 200]) === null && LM(null) === null);
  const loads = Array.from({ length: 28 }, (_, i) => 300 + (i % 7 === 6 ? -300 : 0)); // 6 Tage 300, 1 Ruhetag
  const m = LM(loads);
  ok('L3 ATL/CTL/TSB numerisch + TSB=CTL−ATL', m && Number.isInteger(m.atl) && Number.isInteger(m.ctl) && m.tsb === m.ctl - m.atl);
  ok('L4 Wochenlast korrekt', m.weekLoad === 300 * 6);
  ok('L5 Monotonie/Strain gesetzt (Foster)', m.monotony > 0 && m.strain === Math.round(m.weekLoad * m.monotony));
  const flat = Array.from({ length: 28 }, () => 300);
  const mf = LM(flat);
  ok('L6 konstante Last ⇒ Monotonie null bei SD=0 (ehrlich, kein Inf)', mf.monotony === null && mf.strain === null);
  ok('L7 ACWR-Zuverlässigkeit ausgewiesen', typeof m.acwrReliable === 'boolean' && m.dataDays > 0);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
