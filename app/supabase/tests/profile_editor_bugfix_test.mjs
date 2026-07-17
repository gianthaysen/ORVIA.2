/* ============================================================
   ORVIA · Bugfix-Paket v8-179 (nach v8-178-Live-Test, 2026-07-09).
   Root Causes:
   - Profil-Center onClose schloss das Sheet NIE (nur Unsubscribe) →
     X wirkungslos + danach keine Live-Updates mehr (stale Counts).
   - bindHandlers band Karten doppelt (onclick + addEventListener).
   - .gm-field input{width:100%} traf auch Checkboxen in .gm-inline →
     horizontaler Overflow im Verfügbarkeits-Editor auf iPhone.
   Verträge:
   1. onClose ruft _closeM('_profileCenter') auf (X schließt wirklich).
   2. Genau EIN Klick-Handler je Karte (kein Doppel-Feuern).
   3. orvia:profile-updated → Center re-rendert; Verfügbarkeit-Save
      wechselt die Karte von „fehlt" auf vollständig ohne Neuöffnen.
   4. Beschwerde entfernen läuft sofort über _profileSave(['constraints'])
      (Event feuert, Liste aktuell) — Auto-Save wird im Manager benannt.
   5. CSS: Checkbox-Fix, overflow-x-Schutz, ≥44px-Touch-Fläche am X.
   6. sw.js auf v8-179 (v8-178 ist live).
   node supabase/tests/profile_editor_bugfix_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeApp() {
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = { log() {}, warn() {}, error() {}, debug() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat; sb.isNaN = isNaN;
  sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.Number = Number; sb.isFinite = isFinite;
  sb.Promise = Promise; sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout; sb.Intl = Intl;
  sb.navigator = { onLine: true };
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {}; sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = (t, f) => { wl[t] = (wl[t] || []).filter(x => x !== f); };
  sb.dispatchEvent = e => { (wl[e.type] || []).slice().forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  // Elemente-Registry: getElementById liefert konfigurierbare Stubs (z. B. pc-root).
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', onclick: null, style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {}, value: '', checked: false, _listeners: [], };
    return els[id];
  }
  sb.__els = els; sb.__mkEl = el;
  sb.document = {
    getElementById: id => (id in els ? els[id] : null),
    createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [] }),
    body: { appendChild() {} }, querySelector: () => null, querySelectorAll: () => [],
    documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } },
    addEventListener() {}, activeElement: null
  };
  sb.ORVIA = {};
  vm.createContext(sb);
  const base = new URL('../../js/', import.meta.url);
  ['profile-model.js', 'onboarding/onboarding-profile-logic.js', 'profile.js', 'profile-center.js'].forEach(f =>
    vm.runInContext(readFileSync(new URL(f, base), 'utf8'), sb, { filename: f }));
  sb.ensureProfile();
  return { sb, store, O: sb.ORVIA, wl, els, el };
}

/* ---------- 1) Close-X: onClose schließt das Sheet WIRKLICH ---------- */
{
  const h = makeApp();
  let closed = [], openedOpts = null;
  h.sb.openSheet = opts => { openedOpts = opts; return {}; };
  h.sb._closeM = id => { closed.push(id); };
  const r = h.O.profileCenter.open();
  ok('X1 open() nutzt openSheet', r === true && !!openedOpts && openedOpts.id === '_profileCenter');
  ok('X2 onClose vorhanden', !!openedOpts && typeof openedOpts.onClose === 'function');
  if (openedOpts && typeof openedOpts.onClose === 'function') {
    openedOpts.onClose();
    ok('X3 onClose ruft _closeM(\'_profileCenter\') — X schließt wirklich', closed.indexOf('_profileCenter') >= 0, 'closed=' + JSON.stringify(closed));
  } else ok('X3 (übersprungen)', false);
}

/* ---------- 2) Karten binden GENAU EINEN Handler (kein Doppel-Feuern) ---------- */
{
  const src = readFileSync(new URL('../../js/profile-center.js', import.meta.url), 'utf8');
  const bh = (src.split('function bindHandlers')[1] || '').split('var _unsub')[0];
  const hasOnclick = /\.onclick\s*=/.test(bh);
  const hasAddEv = /addEventListener\(\s*'click'/.test(bh);
  ok('D1 nicht onclick UND addEventListener gleichzeitig', !(hasOnclick && hasAddEv), 'onclick=' + hasOnclick + ' addEv=' + hasAddEv);
  ok('D2 mindestens eine Bindung vorhanden', hasOnclick || hasAddEv);
}

/* ---------- 3) Live-Rerender: Event → pc-root aktualisiert (Verfügbarkeit) ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  // Profil: alles vollständig AUSSER Verfügbarkeit.
  h.sb.PROFILE.name = 'Gian'; h.sb.PROFILE.birthDate = '2003-07-01';
  h.sb.PROFILE.sports = M.normalizeSports([{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, typicalDuration: 60 }]);
  h.sb.PROFILE.goals = [{ type: 'event', title: 'HM sub 1:50', status: 'active' }];
  h.sb.PROFILE.constraintsAcknowledgedAt = '2026-07-09T10:00:00.000Z';
  h.sb.openSheet = () => ({});
  h.sb._closeM = () => {};
  const root = h.el('pc-root');           // Sheet-Body existiert
  h.O.profileCenter.open();               // registriert Subscription
  h.O.profileCenter._rerenderIfOpen();
  ok('R1 Ausgang: Verfügbarkeit fehlt sichtbar', /Trainingstage/.test(root.innerHTML) && /Angabe fehlt/.test(root.innerHTML));
  // Verfügbarkeits-Save über den OFFIZIELLEN Pfad (wie saveAvailabilityEditor):
  h.sb.PROFILE.availability = M.normalizeAvailability({ days: { mo: { available: true } } });
  h.sb._profileSave(['availability']);
  ok('R2 Event → Karte sofort vollständig (ohne Neuöffnen)', !/Angabe fehlt|Angaben fehlen/.test(root.innerHTML), root.innerHTML.slice(0, 120));
  ok('R3 Header zeigt „Profil vollständig"', /Profil vollständig/.test(root.innerHTML));
}

/* ---------- 4) Beschwerden: Entfernen wirkt SOFORT (Auto-Save-Pfad) ---------- */
{
  const h = makeApp();
  const M = h.O.profileModel;
  h.sb._modal = () => {};   // Manager-Reopen im Test neutralisieren
  h.sb.PROFILE.constraintsList = [
    M.normalizeConstraint({ id: 'c1', bodyRegion: 'knee', status: 'active', intensity: 4 }),
    M.normalizeConstraint({ id: 'c2', bodyRegion: 'shoulder', status: 'active', intensity: 3 })
  ];
  let evt = null;
  h.sb.addEventListener('orvia:profile-updated', e => { evt = e; });
  h.sb.constraintRemove('c1');
  ok('K1 Liste sofort aktuell (1 statt 2)', h.sb.PROFILE.constraintsList.length === 1 && h.sb.PROFILE.constraintsList[0].id === 'c2');
  ok('K2 Event mit constraints gefeuert (Auto-Save)', !!evt && (evt.detail.changedSections || []).indexOf('constraints') >= 0);
  ok('K3 Blob persistiert (Reload-Erhalt)', JSON.parse(h.store.orvia_profile_v1).constraintsList.length === 1);
  // Center-Summary aus derselben Quelle:
  const sum = h.O.profileCenter.sectionSummary(h.sb.PROFILE, 'constraints');
  ok('K4 Summary zählt aus PROFILE.constraintsList (keine zweite Quelle)', /Schulter|shoulder|1|Intensität/.test(sum) && !/2 aktive/.test(sum), sum);
  // Auto-Save wird im Manager ehrlich benannt:
  const src = readFileSync(new URL('../../js/profile.js', import.meta.url), 'utf8');
  ok('K5 Manager benennt Auto-Save („sofort gespeichert")', /sofort gespeichert/.test(src.split('function openConstraintsEditor')[1] || ''));
}

/* ---------- 5) CSS-Verträge: Mobile-Layout + Touch-Fläche ---------- */
{
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  ok('M1 Checkbox in gm-inline mit fester Breite (kein 100%-Erben)', /\.gm-field\.gm-inline input\[type="?checkbox"?\]\s*\{[^}]*width:\s*22px/.test(css));
  ok('M2 gm-inline Label darf umbrechen/schrumpfen', /\.gm-field\.gm-inline label\s*\{[^}]*min-width:\s*0/.test(css));
  ok('M3 Sheet-Scroll ohne horizontalen Overflow', /\.orvia-sheet-scroll\s*\{[^}]*overflow-x:\s*hidden/.test(css));
  ok('M4 X-Button mit ≥44px-Touch-Fläche (::after-Inset)', /\.orvia-sheet-x\s*\{[^}]*position:\s*relative/.test(css) && /\.orvia-sheet-x::after\s*\{[^}]*inset:\s*-\d+px/.test(css));
}

/* ---------- 6) Cache-Bump ---------- */
{
  const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
  // P10-Anpassung: Vertrag ist „Bündel enthält mindestens den v8-179-Fix" — spätere
  // reguläre Bumps (ein Bump je ausgeliefertem Bündel) dürfen den Test nicht brechen.
  const v = parseInt((sw.match(/const C = 'orvia-v8-(\d+)'/) || [])[1] || '0', 10);
  ok('V1 sw.js-Version ≥ v8-179', v >= 179, 'v8-' + v);
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
