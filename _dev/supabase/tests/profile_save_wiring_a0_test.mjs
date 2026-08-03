/* ============================================================
   ORVIA · A0 — _profileSave-Persistenzvertrag (Regression, 2026-07-03).
   ROOT CAUSE (vor Fix): profile.js `_profileSave` rief
     `if(typeof save==='function')save();else saveProfile();`
   auf. `save` ist die GLOBALE DB-Save-Funktion aus data.js
   (Key gian_checkins_v2) und schreibt PROFILE NICHT. In der App ist
   `save` immer definiert → `saveProfile()` (Key orvia_profile_v1)
   wurde NIE aus dem zentralen Schreibpfad aufgerufen. Folgen:
   - Editor-/Onboarding-Saves erreichten localStorage nicht zuverlässig
     (erst wenn irgendein Legacy-Pfad später saveProfile() aufrief),
   - Cloud-Snapshot (app_state) las den STALE Blob.
   Bestehende Suiten fingen das nicht, weil ihre Sandboxen KEIN
   globales `save` definieren → dort lief der else-Zweig (CLAUDE.md
   §16.5: Stub verdeckte fehlende Verdrahtung).
   VERTRAG (nach Fix): _profileSave persistiert PROFILE IMMER über
   saveProfile() → orvia_profile_v1, unabhängig davon, ob die globale
   DB-Save-Funktion existiert. Genau EIN Event, Cloud-Hook läuft.
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

function makeSandbox(opts) {
  opts = opts || {};
  const store = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.parseInt = parseInt; sb.parseFloat = parseFloat;
  sb.isNaN = isNaN; sb.Array = Array; sb.Object = Object; sb.String = String; sb.Set = Set; sb.Number = Number;
  sb.escH = s => String(s == null ? '' : s); sb.toast = () => {};
  sb.renderProfileScreen = () => {}; sb.renderZones = () => {}; sb.maybePlanImpact = () => {};
  const wl = {}; sb.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
  sb.addEventListener = (t, f) => { (wl[t] = wl[t] || []).push(f); };
  sb.removeEventListener = () => {};
  sb.dispatchEvent = e => { (wl[e.type] || []).forEach(f => f(e)); return true; };
  sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  sb.document = { getElementById: () => null, createElement: () => ({ classList: { add() {}, remove() {} } }), body: { appendChild() {} }, querySelectorAll: () => [] };
  const calls = { dbSave: 0, onSave: 0 };
  if (opts.withGlobalDbSave) {
    // Simuliert data.js: globale save() speichert NUR die Checkin-DB, nie PROFILE.
    sb.save = function () { calls.dbSave++; try { if (sb.ORVIA_onSave) sb.ORVIA_onSave(); } catch (e) {} return true; };
  }
  sb.ORVIA_onSave = function () { calls.onSave++; };
  vm.createContext(sb);
  const base = new URL('../../../app/js/', import.meta.url);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb);
  vm.runInContext(readFileSync(new URL('profile.js', base), 'utf8'), sb);
  return { sb, store, calls };
}

function blob(store) { try { return JSON.parse(store.orvia_profile_v1); } catch (e) { return null; } }

/* ---------- Szenario 1: produktionsnah (globales DB-save existiert) ---------- */
{
  const { sb, store, calls } = makeSandbox({ withGlobalDbSave: true });
  sb.ensureProfile();
  const before = blob(store);
  ok('A0-1 Setup: Profil-Blob existiert nach ensureProfile', !!before);

  // Kernfall: Editor-Schreibpfad updateSection → _profileSave → Blob MUSS den neuen Wert enthalten.
  sb.ORVIA.profile.updateSection('personal', { name: 'A0-Testname' }, ['personal']);
  const after = blob(store);
  ok('A0-2 KERN: updateSection persistiert nach orvia_profile_v1 (auch mit globalem DB-save)', !!after && after.name === 'A0-Testname', 'blob.name=' + (after && after.name));
  ok('A0-3 updatedAt im persistierten Blob gesetzt', !!(after && after.updatedAt));

  // Cloud-Hook: mindestens ein ORVIA_onSave (saveProfile triggert den Hook).
  ok('A0-4 Cloud-Hook ORVIA_onSave wurde ausgelöst', calls.onSave >= 1, 'onSave=' + calls.onSave);

  // Event-Vertrag: genau EIN Event pro Save, changedSections korrekt.
  let evs = [];
  sb.ORVIA.profile.subscribe(e => { evs.push(e.detail.changedSections); });
  sb.ORVIA.profile.updateSection('personal', { name: 'A0-Zweiter' }, ['personal']);
  ok('A0-5 genau EIN orvia:profile-updated pro Save', evs.length === 1);
  ok('A0-6 Event trägt changedSections', evs[0] && evs[0].indexOf('personal') >= 0);
  ok('A0-7 zweiter Save ebenfalls im Blob', (blob(store) || {}).name === 'A0-Zweiter');

  // Goals-Pfad (commitGoals → _profileSave): kanonische goals[] erreichen den Blob.
  sb.goalAdd({ title: 'HM unter 1:50', priority: 1 });
  const g = blob(store);
  ok('A0-8 commitGoals persistiert goals[] in den Blob', !!(g && Array.isArray(g.goals) && g.goals.some(x => x.title === 'HM unter 1:50')));

  // Reload-Äquivalenz: loadProfile() aus dem Blob liefert die gespeicherten Werte.
  const re = sb.loadProfile();
  ok('A0-9 Reload: loadProfile() liefert persistierte Werte', !!(re && re.name === 'A0-Zweiter' && Array.isArray(re.goals) && re.goals.length >= 1));
}

/* ---------- Szenario 2: Test-Sandbox-Parität (KEIN globales save) ---------- */
{
  const { sb, store } = makeSandbox({ withGlobalDbSave: false });
  sb.ensureProfile();
  sb.ORVIA.profile.updateSection('personal', { name: 'OhneDbSave' }, ['personal']);
  ok('A0-10 ohne globales save: Blob ebenfalls aktuell (Paritätsfall der Alt-Suiten)', (blob(store) || {}).name === 'OhneDbSave');
}

/* ---------- Szenario 3: Quelltext-Vertrag (Race-/Regressionsbeweis) ---------- */
{
  const src = readFileSync(new URL('../../../app/js/profile.js', import.meta.url), 'utf8');
  const buggy = /typeof\s+save\s*===?\s*'function'\s*\)\s*save\s*\(\s*\)\s*;?\s*else\s+saveProfile/;
  ok('A0-11 Quelltext: _profileSave delegiert nicht mehr an die DB-Save-Funktion', !buggy.test(src));
  // _profileSave muss saveProfile aufrufen (direkter, unbedingter Persist-Pfad).
  const fnMatch = src.match(/function _profileSave\([\s\S]*?\n\}/);
  ok('A0-12 Quelltext: _profileSave ruft saveProfile() auf', !!(fnMatch && /saveProfile\s*\(\s*\)/.test(fnMatch[0])));
}

console.log('\n' + pass + '/' + (pass + fail) + ' bestanden');
process.exit(fail ? 1 : 0);
