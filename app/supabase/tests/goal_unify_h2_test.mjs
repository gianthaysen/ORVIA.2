/* ============================================================
   ORVIA · H2 — EINE Ziel-Welt: goalOf() liest kanonische goals[],
   Race-Editor (saveGoal) schreibt über goalAdd/goalUpdate (Cloud+Event).
   node supabase/tests/goal_unify_h2_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

function makeApp() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Number = Number;
  sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Set = Set; sb.Intl = Intl;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.navigator = { onLine: true };
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  // goalOf/RACE_DIST-Slice aus ui.js + Calc-Stub
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  // R1.2: gcat-Helfer gehört jetzt zum Ziel-Lesevertrag (kanonische IDs).
  const gslice = ui.slice(ui.indexOf('function gcat'), ui.indexOf('function isRaceGoal'));
  const slice = ui.slice(ui.indexOf('const RACE_DIST'), ui.indexOf('function isRunDistanceGoal'));
  vm.runInContext('var Calc={fmtTime:function(m){return m+" min";}};var DB={};\n' + gslice + '\n' + slice, sb, { filename: 'goal-slice.js' });
  sb.ensureProfile();
  return { sb, store, wl };
}

/* ---------- 1) goalOf liest kanonische goals[] ---------- */
{
  const h = makeApp();
  // Wizard-Ziel (kanonisch): HM sub 1:50 als Zeit in Sekunden
  h.sb.PROFILE.goals = h.sb.ORVIA.profileModel.normalizeGoals([
    { id: 'goal:hm', category: 'halfmarathon', title: 'HM sub 1:50', metricType: 'time', targetValue: 6600, targetDate: '2026-10-04', priority: 1, status: 'active' }
  ]);
  const g = h.sb.goalOf();
  ok('G1 Wizard-Ziel erscheint in goalOf (Race-Header-Quelle) — R1.2 kanonisch', g.type === 'half_marathon' && g._canonicalId === 'goal:hm');
  ok('G2 Zeit-Sekunden → targetMin 110', g.targetMin === 110, 'targetMin=' + g.targetMin);
  ok('G3 Datum + Distanz korrekt', g.raceDate === '2026-10-04' && Math.abs(g.distanceKm - 21.0975) < 0.001);
  // Priorität: das prio-1-Ziel gewinnt vor prio-2
  h.sb.PROFILE.goals = h.sb.ORVIA.profileModel.normalizeGoals([
    { id: 'goal:m', category: 'marathon', priority: 2, status: 'active', title: 'M' },
    { id: 'goal:hm', category: 'halfmarathon', priority: 1, status: 'active', title: 'HM' }
  ]);
  ok('G4 niedrigste priority gewinnt', h.sb.goalOf().type === 'half_marathon');
  // Nur aktive Ziele zählen
  h.sb.PROFILE.goals = h.sb.ORVIA.profileModel.normalizeGoals([{ id: 'g1', category: 'marathon', priority: 1, status: 'achieved', title: 'M' }]);
  h.sb.PROFILE.goal = { type: 'fast10k', distanceKm: 10, raceDate: '', targetMin: 45, priority: 'solide' };
  ok('G5 erreichtes Ziel ignoriert → Legacy-Spiegel-Fallback (kanonisiert gelesen)', h.sb.goalOf().type === 'run_10k');
  // Ohne alles → health
  h.sb.PROFILE.goals = []; h.sb.PROFILE.goal = null; h.sb.PROFILE.primaryGoal = null;
  ok('G6 leer → health ohne Distanz', h.sb.goalOf().type === 'health' && h.sb.goalOf().distanceKm === null);
}

/* ---------- 2) Quelltext-Verträge Race-Editor ---------- */
{
  const ui = readFileSync(new URL('ui.js', base), 'utf8');
  const sg = ui.split('function saveGoal()')[1].split('function renderPlan')[0];
  ok('E1 saveGoal schreibt kanonisch (goalAdd/goalUpdate)', /goalAdd\(/.test(sg) && /goalUpdate\(/.test(sg));
  ok('E2 Zeit strukturiert (metricType time, Sekunden)', /metricType:'time'/.test(sg) && /Math\.round\(targetMin\*60\)/.test(sg));
  ok('E3 bestehendes kanonisches Ziel wird aktualisiert (kein Dublettenwachstum)', /_canonicalId\)goalUpdate/.test(sg.replace(/\s/g, '')));
  ok('E4 kein doppelter save()-Aufruf mehr neben saveProfile', !/if\(typeof save==='function'\)save\(\);/.test(sg));
}

/* ---------- 3) Roundtrip: goalAdd → goalOf ---------- */
{
  const h = makeApp();
  h.sb.goalAdd({ category: 'marathon', title: 'Marathon unter 3:30', metricType: 'time', unit: 's', targetValue: 12600, targetDate: '2027-04-11', priority: 1, status: 'active' });
  const g = h.sb.goalOf();
  ok('R1 goalAdd-Ziel sofort in goalOf sichtbar', g.type === 'marathon' && g.targetMin === 210 && g.raceDate === '2027-04-11');
  // Frisches Profil: migrateProfile legt EIN Legacy-health-Ziel an (Bestandsverhalten) —
  // entscheidend ist: genau EIN Marathon-Ziel, und goalOf wählt es (kein Dublettenwachstum).
  const marathons = h.sb.listGoals().filter(x => x.category === 'marathon');
  ok('R2 genau ein kanonisches Marathon-Ziel (keine Dubletten)', marathons.length === 1);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
