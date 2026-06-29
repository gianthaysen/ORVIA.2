/* ORVIA · Onboarding-Routing/Cutover — Dispatcher öffnet ausschließlich v2, kein Legacy-Fallback.
   Lädt onboarding-ui.js (mit minimalen Logik-/Store-Stubs) und prüft die globalen Dispatcher. */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const UI_SRC = fs.readFileSync(new URL('../../js/onboarding/onboarding-ui.js', import.meta.url), 'utf8');

// Lädt onboarding-ui.js in eine frische globale Umgebung (Stub für document/ORVIA).
function loadUI(opts) {
  opts = opts || {};
  const g = {};
  g.ORVIA = { user: null };
  g.ORVIA_CFG = opts.cfg || {};
  if (opts.debug) g.ORVIA_DEBUG = true;
  let legacyCalls = 0;
  g.openOnboarding = function () { legacyCalls++; };   // Legacy (profile.js) — darf produktiv NICHT laufen
  g.console = { error: () => {}, warn: () => {} };
  // onboarding-ui erwartet ein document (D()): minimaler Stub genügt, da wir open() stubben.
  const documentStub = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => ({}), innerHTML: '' }), body: { appendChild() {} }, documentElement: { classList: { add() {}, remove() {}, contains() { return false; } } }, addEventListener() {} };
  // Module-Stubs, die onboarding-ui beim Laden referenziert (nur falls aufgerufen).
  g.ORVIA.onboardingV2Logic = g.ORVIA.onboardingV2Logic || {};
  g.ORVIA.onboardingV2Store = g.ORVIA.onboardingV2Store || {};
  // IIFE ausführen: (function(root){...})(globalThis-ish). Wir reichen g als globalThis & window.
  const fn = new Function('window', 'document', 'globalThis', 'console', UI_SRC.replace('typeof globalThis !== \'undefined\' ? globalThis : this', 'globalThis'));
  fn(g, documentStub, g, g.console);
  // NACH dem Laden den v2-Einstieg durch einen Spy ersetzen (sonst läuft die echte open()).
  if (opts.withV2 === false) { delete g.ORVIA.onboardingV2; }
  else { g.ORVIA.onboardingV2 = { _opened: [], open: function (o) { this._opened.push(o); return opts.openReturns === undefined ? true : opts.openReturns; } }; }
  return { g, legacy: () => legacyCalls };
}

// 1) Dispatcher öffnet v2 + übergibt fresh/source
let r = loadUI();
let res = r.g.openOrviaOnboarding({ fresh: true, source: 'profile' });
ok('Dispatcher öffnet v2 (true)', res === true);
ok('Dispatcher übergibt fresh', r.g.ORVIA.onboardingV2._opened[0].fresh === true);
ok('Dispatcher übergibt source', r.g.ORVIA.onboardingV2._opened[0].source === 'profile');
ok('fresh nicht-true → false', (function () { var r2 = loadUI(); r2.g.openOrviaOnboarding({ source: 'x' }); return r2.g.ORVIA.onboardingV2._opened[0].fresh === false; })());

// 2) fehlendes v2 → false, Legacy NICHT geöffnet
r = loadUI({ withV2: false });
ok('fehlendes v2: Dispatcher → false', r.g.openOrviaOnboarding({ fresh: true }) === false);
ok('fehlendes v2: Legacy NICHT aufgerufen', r.legacy() === 0);

// 3) Pending-Dispatcher nutzt v2 (source registration)
r = loadUI();
ok('openPendingOnboarding → true', r.g.openPendingOnboarding() === true);
ok('Pending nutzt source=registration', r.g.ORVIA.onboardingV2._opened[0].source === 'registration');
ok('Pending fresh=true', r.g.ORVIA.onboardingV2._opened[0].fresh === true);

// 4) Pending fail-closed: fehlendes v2 → false, kein Legacy
r = loadUI({ withV2: false });
ok('Pending ohne v2 → false', r.g.openPendingOnboarding() === false);
ok('Pending ohne v2: kein Legacy', r.legacy() === 0);

// 5) Dispatcher gibt false zurück, wenn open() false liefert (z. B. fehlgeschlagenes Öffnen)
r = loadUI({ openReturns: false });
ok('open()=false → Dispatcher false', r.g.openOrviaOnboarding({ fresh: true }) === false);
ok('open()=false → Pending false', loadUI({ openReturns: false }).g.openPendingOnboarding() === false);

// 6) Legacy-Debug nur im Debug-Modus
r = loadUI({ debug: false });
ok('legacyDebug ohne Debug → false', r.g.ORVIA.legacyOnboardingDebugOpen() === false);
ok('legacyDebug ohne Debug: Legacy nicht aufgerufen', r.legacy() === 0);
r = loadUI({ debug: true });
ok('legacyDebug mit Debug → true', r.g.ORVIA.legacyOnboardingDebugOpen() === true);
ok('legacyDebug mit Debug: Legacy aufgerufen', r.legacy() === 1);

// 7) Pending-Key-Verhalten (Simulation der auth.js-Logik)
function simPending(opened) { const mem = { orvia_onboard_pending: '1' }; if (opened === true) delete mem.orvia_onboard_pending; return mem; }
ok('Key entfernt nur bei opened===true', !('orvia_onboard_pending' in simPending(true)));
ok('Key bleibt bei opened===false', 'orvia_onboard_pending' in simPending(false));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
