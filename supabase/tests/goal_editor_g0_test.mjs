/* ============================================================
   ORVIA · Goal-SSOT G0 — Editor-Kollision beseitigt, kanonischer Plan-Kopf,
   ehrliches Speichern. Der vollständige Wizard (profile.js) ist der EINZIGE
   produktive Zieleditor; ui.js überschreibt openGoalEditor nicht mehr.
   node supabase/tests/goal_editor_g0_test.mjs
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
const profileSrc = readFileSync(new URL('profile.js', base), 'utf8');
const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');

/* ---------- A: Kollision beseitigt / genau EIN produktiver Editor ---------- */
{
  const countProfile = (profileSrc.match(/function\s+openGoalEditor\s*\(/g) || []).length;
  const uiOpen = (uiSrc.match(/function\s+openGoalEditor\s*\(/g) || []).length;
  ok('A1 ui.js definiert KEIN globales openGoalEditor mehr (Kollision beseitigt)', uiOpen === 0);
  ok('A2 profile.js definiert genau EIN openGoalEditor (der Wizard)', countProfile === 1);
  ok('A3 Alt-Race-Editor als Legacy/debug-only umbenannt', /function\s+_legacyRaceGoalEditor\s*\(/.test(uiSrc));
  ok('A4 saveGoal/closeGoalEditor bleiben je genau einmal (keine doppelte produktive Definition)',
    (uiSrc.match(/function\s+saveGoal\s*\(/g) || []).length === 1 &&
    (uiSrc.match(/function\s+closeGoalEditor\s*\(/g) || []).length === 1 &&
    !/function\s+saveGoal\s*\(/.test(profileSrc) && !/function\s+closeGoalEditor\s*\(/.test(profileSrc));
  // browserreale Ladefolge: profile.js zuerst, ui.js danach — kein Override des Wizards.
  ok('A5 Ladefolge profile.js→ui.js überschreibt openGoalEditor NICHT (kein Race-Editor als openGoalEditor)',
    uiSrc.indexOf('function openGoalEditor') < 0);
}

/* ---------- B: Plan-Kopf-Verdrahtung (kanonisches Hauptziel + Edit-by-ID) ---------- */
{
  const rh = uiSrc.split('function renderRaceHeader()')[1].split('function mainGoalOf')[0];
  ok('B1 renderRaceHeader nutzt kanonischen mainGoalOf', /mainGoalOf\(/.test(rh));
  ok('B2 „Ziel bearbeiten" öffnet den Wizard per Ziel-ID', /openGoalEditor\([^)]*esc\(mg\.id\)/.test(rh));
  ok('B3 ohne Ziel: „Ziel hinzufügen" → openGoalEditor() ohne ID', /openGoalEditor\(\)[\s\S]*Ziel hinzufügen/.test(rh));
  ok('B4 ehrliches „kein Datum" bei fehlendem Zieldatum', /kein Datum/.test(rh));
  ok('B5 Nicht-Lauf-Ziel bekommt KEINE Zielpace/Zielzeit-Zwangsfelder (nur bei isRun)', /if\(isRun\)/.test(rh));
}

/* ---------- C: ehrlicher Speicherstatus (Wizard) ---------- */
{
  const gw = profileSrc.split('function gwSave()')[1].split('function _goalSaveToast')[0];
  ok('C1 Erfolg nur bei erfolgreichem lokalem Save (try/catch + _saved-Guard)', /_saved\s*=\s*true/.test(gw) && /if\(!_saved\)/.test(gw));
  ok('C2 fehlgeschlagener Save zeigt KEINEN Erfolg', /Speichern fehlgeschlagen/.test(gw) && /return;/.test(gw));
  ok('C3 kein unbedingtes „Ziel gespeichert" mehr (ehrliche Toast-Ableitung)', /_goalSaveToast\(\)/.test(gw));
  ok('C4 kanonischer Schreibpfad bleibt goalAdd/goalUpdate', /goalUpdate\(id,patch,reason\)/.test(gw) && /goalAdd\(patch,reason\)/.test(gw));
}

/* ---------- D: Verhalten — kanonischer Hauptziel-Selektor, getrennt von goalOf ---------- */
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
  sb.removeEventListener = () => {}; sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } } };
  sb.escH = s => String(s == null ? '' : s); sb.esc = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  sb.ORVIA = {};
  vm.createContext(sb);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  const g1 = uiSrc.slice(uiSrc.indexOf('function gcat'), uiSrc.indexOf('function isRaceGoal'));
  const g2 = uiSrc.slice(uiSrc.indexOf('const RACE_DIST'), uiSrc.indexOf('function isRunDistanceGoal'));
  const g3 = uiSrc.slice(uiSrc.indexOf('function mainGoalOf'), uiSrc.indexOf('function renderPaceZones'));
  vm.runInContext('var Calc={fmtTime:function(m){return m+" min";}};var DB={};\n' + g1 + '\n' + g2 + '\n' + g3, sb, { filename: 'goal-slice.js' });
  sb.ensureProfile();
  return { sb, store, wl };
}
{
  const h = makeApp(); const P = h.sb.ORVIA.profileModel;
  // Nicht-Lauf-Hauptziel (Fußball prio 1) + Laufziel (Marathon prio 2).
  h.sb.PROFILE.goals = P.normalizeGoals([
    { id: 'g:fb', category: 'football', title: 'Aufstieg', priority: 1, status: 'active' },
    { id: 'g:m', category: 'marathon', title: 'Marathon', priority: 2, status: 'active', metricType: 'time', targetValue: 12600, targetDate: '2027-04-11' }
  ]);
  const mg = h.sb.mainGoalOf();
  ok('D1 mainGoalOf liefert das kanonische Hauptziel über ALLE Kategorien (Fußball, nicht Lauf)', mg && mg.id === 'g:fb' && mg.category === 'football');
  ok('D2 goalOf bleibt die getrennte Lauf-Wettkampfprojektion (Marathon)', h.sb.goalOf().type === 'marathon' && h.sb.goalOf()._canonicalId === 'g:m');
  // Laufziel als Hauptziel ⇒ mainGoalOf = dieses Laufziel.
  h.sb.PROFILE.goals = P.normalizeGoals([{ id: 'g:hm', category: 'halfmarathon', title: 'HM', priority: 1, status: 'active', metricType: 'time', targetValue: 6600 }]);
  ok('D3 Lauf-Hauptziel ⇒ mainGoalOf = dieses Ziel', h.sb.mainGoalOf().id === 'g:hm');
  // Kein aktives Ziel ⇒ null (Plan-Kopf zeigt „Ziel hinzufügen").
  h.sb.PROFILE.goals = P.normalizeGoals([{ id: 'g:x', category: 'marathon', priority: 1, status: 'archived' }]);
  ok('D4 nur archivierte Ziele ⇒ mainGoalOf null', h.sb.mainGoalOf() === null);
}

/* ---------- E: kanonischer Schreibpfad für alle Kategorien + Edit-by-ID + keine Dublette ---------- */
{
  const h = makeApp();
  // Freie/Custom, Körperfett, Fußball/Saison, Gym, Ironman: kanonisch über goalAdd.
  h.sb.goalAdd({ category: 'custom', customCategory: 'Freeride', title: 'Freies Ziel', priority: 2, status: 'active' });
  h.sb.goalAdd({ category: 'shredded', title: 'KFA 10%', metricType: 'percent', unit: '%', targetValue: 10, priority: 2, status: 'active' });
  h.sb.goalAdd({ category: 'football', title: 'Saisonaufstieg', priority: 2, status: 'active' });
  h.sb.goalAdd({ category: 'gym', title: 'Kraftaufbau', priority: 2, status: 'active' });
  h.sb.goalAdd({ category: 'ironman', title: 'IM Finish', metricType: 'time', unit: 's', targetValue: 43200, priority: 2, status: 'active' });
  const cats = h.sb.listGoals().map(g => g.category);
  ok('E1 alle Kategorien landen kanonisch in PROFILE.goals (custom/shredded/football/gym/ironman)',
    ['custom', 'shredded', 'football', 'gym', 'ironman'].every(c => cats.indexOf(c) >= 0));
  // Edit-by-ID: openGoalEditor(id) lädt exakt dieses Ziel in den Wizard-State (window._gw.id),
  // auch wenn gwRender im DOM-Stub bricht — der Zustand wird VOR dem Render gesetzt.
  const fb = h.sb.listGoals().filter(g => g.category === 'football')[0];
  try { h.sb.openGoalEditor(fb.id); } catch (e) {}
  ok('E2 openGoalEditor(id) lädt exakt die gewählte Ziel-ID (Edit-by-ID)', h.sb.window._gw && h.sb.window._gw.id === fb.id);
  try { h.sb.openGoalEditor(); } catch (e) {}
  ok('E3 openGoalEditor() ohne ID ⇒ Neuanlage (window._gw.id null)', h.sb.window._gw && h.sb.window._gw.id == null);
  // Keine Dublette bei wiederholtem kanonischem Update desselben Ziels.
  const before = h.sb.listGoals().filter(g => g.category === 'gym').length;
  const gym = h.sb.listGoals().filter(g => g.category === 'gym')[0];
  h.sb.goalUpdate(gym.id, { title: 'Kraftaufbau 2' });
  h.sb.goalUpdate(gym.id, { title: 'Kraftaufbau 3' });
  ok('E4 wiederholtes Speichern desselben Ziels erzeugt keine Dublette', h.sb.listGoals().filter(g => g.category === 'gym').length === before);
}

/* ---------- F: ehrliche Toast-Ableitung (offline ⇒ Sync läuft) ---------- */
{
  const h = makeApp();
  ok('F1 online ⇒ „Ziel gespeichert"', h.sb._goalSaveToast() === 'Ziel gespeichert');
  h.sb.navigator.onLine = false;
  ok('F2 offline ⇒ „Gespeichert · Synchronisierung läuft" (ehrlich, kein „vollständig gespeichert")', h.sb._goalSaveToast() === 'Gespeichert · Synchronisierung läuft');
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
