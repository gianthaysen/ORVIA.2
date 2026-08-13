/* ORVIA · Phase 8.4 — Aktivierungspfad im ECHTEN Browser.

   Der reine Modultest (phase8_plan_activation_test) beweist das Verhalten der
   Funktion. Er beweist NICHT, dass die Funktion in der ausgelieferten App
   erreichbar ist und dass die Sperre dort greift. Genau diese Lücke hat in diesem
   Projekt schon zweimal wehgetan: einmal beim `let DB`-Binding (im Sandbox-Test
   grün, im Browser dauerhaft undefined), einmal beim Legacy-Plan-Pfad.

   Bewiesen wird hier:
     • Die Schaltung ist im echten Start fail-closed: nach dem Laden ist
       `engine_v2_plan` AUS — ohne dass irgendjemand etwas abschalten musste.
     • Bei ausgeschaltetem Flag rührt der Aktivierungspfad nichts an: kein
       Protokolleintrag, kein veränderter Plan.
     • Der Weg existiert wirklich: mit gesetztem Flag läuft er bis zum ersten
       echten Hindernis und protokolliert es benennbar.
     • `buildWeekNow()` liefert Eingabe UND Ergebnis (der Aktivierungspfad braucht
       `sessions[]`, nicht die Zählwerte des Protokolls).
     • Der Rückweg ist verdrahtet.

   node supabase/tests/phase8_activation_live_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil.
     Aufgeloest wird wie bei supabase-js in den Live-Tests: erst normal, dann
     ueber die bekannten node_modules-Nachbarn (Repo-Stamm, app, _dev). Fehlt
     es wirklich (z. B. in einer Umgebung ohne Browser), ist das ein
     UEBERSPRUNGEN (exit 2) — nie ein Crash, der wie ein Produktfehler
     aussieht, und nie ein stilles Gruen. Bewusst OHNE HERE/join: dieser Block
     laeuft vor deren Definition. */
  const _p = require('node:path');
  const _h = _p.dirname(new (globalThis.URL || require('node:url').URL)(import.meta.url).pathname);
  const _cands = [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'),
    _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')];
  for (const c of _cands) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); }
    catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium); /* v8-307b: Binary-Existenz ist Teil der Skip-Bedingung */

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1300);

/* ============ 1) Module sind erreichbar ============ */
sec('1 · Die Kette ist in der ausgelieferten App vorhanden');
const present = await page.evaluate(() => ({
  flags: !!(window.ORVIA && ORVIA.featureFlags),
  activation: !!(window.ORVIA && ORVIA.planActivation),
  canary: !!(window.ORVIA && ORVIA.canaryEval),
  projection: !!(window.ORVIA && ORVIA.weekProjection),
  domain: !!(window.ORVIA && ORVIA.planDomain),
  hook: typeof window.gmEngineActivateWeek === 'function',
  revert: typeof window.ORVIA.enginePlanRevert === 'function',
  buildWeekNow: !!(window.ORVIA && ORVIA.engineShadow && typeof ORVIA.engineShadow.buildWeekNow === 'function')
}));
Object.keys(present).forEach(k => ok('vorhanden: ' + k, present[k] === true));

/* ============ 2) Fail-closed im echten Start ============ */
sec('2 · Fail-closed — ohne Zutun ist alles aus');
const initial = await page.evaluate(() => ({
  enabled: ORVIA.featureFlags.isEnabled('engine_v2_plan'),
  source: ORVIA.featureFlags.describe('engine_v2_plan').source,
  logLen: ORVIA.planActivation.log().length,
  hookResult: window.gmEngineActivateWeek()
}));
ok('das Flag ist nach dem Laden AUS — ohne dass jemand abschalten musste', initial.enabled === false);
ok('die Herkunft ist ehrlich benannt (kein Serverbeleg ohne Server)',
   ['never_loaded', 'no_client_or_user', 'offline', 'error', 'server_no_row'].indexOf(initial.source) >= 0, initial.source);
ok('der Aktivierungspfad tut bei ausgeschaltetem Flag nichts', initial.hookResult === null);
ok('… und schreibt dabei keinen Protokolleintrag (kein Rauschen im Canary-Log)', initial.logLen === 0);

const untouched = await page.evaluate(() => {
  const before = JSON.stringify(PROFILE.weekPlan || null);
  for (let i = 0; i < 3; i++) window.gmEngineActivateWeek();
  return { same: JSON.stringify(PROFILE.weekPlan || null) === before, log: ORVIA.planActivation.log().length };
});
ok('mehrfacher Aufruf lässt den Plan des Nutzers unverändert', untouched.same === true);
ok('… und erzeugt weiterhin keine Ereignisse', untouched.log === 0);

/* ============ 3) Mit Flag: der Weg existiert und meldet sein Hindernis ============ */
sec('3 · Mit Freigabe läuft der Weg — und benennt, woran er hält');
const withFlag = await page.evaluate(() => {
  ORVIA.featureFlags._setForTest('engine_v2_plan', true, 'test');
  const before = JSON.stringify(PROFILE.weekPlan || null);
  const r = window.gmEngineActivateWeek();
  const log = ORVIA.planActivation.log();
  return { enabled: ORVIA.featureFlags.isEnabled('engine_v2_plan'),
    r: r, logLen: log.length, lastReason: log.length ? log[log.length - 1].reason : null,
    planUnchanged: JSON.stringify(PROFILE.weekPlan || null) === before };
});
ok('das Flag lässt sich für den Test setzen', withFlag.enabled === true);
ok('der Versuch wird jetzt protokolliert (Grundlage der Canary-Messung)', withFlag.logLen >= 1);
ok('der Ausgang ist ein benannter Grund, keine stille Nichtaktion',
   typeof withFlag.lastReason === 'string' && withFlag.lastReason.length > 0, String(withFlag.lastReason));
ok('ohne kanonisches Planmodell ist der Grund genau das — und nichts wird geschrieben',
   withFlag.lastReason === 'no_canonical_plan' && withFlag.planUnchanged === true, String(withFlag.lastReason));
ok('der Grund ist dem Canary-Auswerter bekannt', await page.evaluate(() => {
  const log = ORVIA.planActivation.log(); const r = log[log.length - 1].reason;
  return [].concat(ORVIA.canaryEval.ERROR_REASONS, ORVIA.canaryEval.BENIGN_REASONS,
    ORVIA.canaryEval.OVERRIDE_GUARD_REASONS).indexOf(r) >= 0;
}) === true);

/* ============ 4) buildWeekNow liefert das Ergebnis, nicht nur Zählwerte ============ */
sec('4 · Der Scheduler-Ausgang ist für die Projektion greifbar');
const wk = await page.evaluate(() => {
  const w = ORVIA.engineShadow.buildWeekNow();
  return w ? { weekKey: w.weekKey, hasInput: !!w.input, hasResult: !!w.result,
    ok: !!(w.result && w.result.ok), sessions: (w.result && w.result.sessions || []).length,
    keys: Object.keys(w).sort() } : null;
});
ok('buildWeekNow() liefert einen Wochenlauf', wk !== null);
if (wk) {
  ok('… mit Eingabe UND Ergebnis', wk.hasInput === true && wk.hasResult === true);
  ok('… und einem Wochenschlüssel', /^\d{4}-W\d{2}$/.test(String(wk.weekKey)), String(wk.weekKey));
  ok('… die Felder sind stabil benannt',
     JSON.stringify(wk.keys) === JSON.stringify(['day', 'input', 'result', 'weekKey']), wk.keys.join(','));
}
ok('der Wochen-Shadow schreibt weiterhin nur EINEN Eintrag je Woche', await page.evaluate(() => {
  ORVIA.engineShadow.buildWeekNow(); ORVIA.engineShadow.buildWeekNow();
  const raw = localStorage.getItem(ORVIA.engineShadow._wkey());
  const log = raw ? JSON.parse(raw) : [];
  const keys = log.map(x => x.weekKey);
  return keys.length === new Set(keys).size;
}) === true);

/* ============ 5) Rückweg und Auswerter live ============ */
sec('5 · Rückweg und Canary-Auswerter im Browser');
const rev = await page.evaluate(() => ORVIA.enginePlanRevert());
ok('ohne Schnappschuss verweigert der Rückweg ehrlich', rev.ok === false && rev.reason === 'no_snapshot');
const canary = await page.evaluate(() => {
  const r = ORVIA.canaryEval.evaluate({ activationLog: ORVIA.planActivation.log() });
  return { gateReady: r.gateReady, pending: r.pending.length, blockers: r.blockers.length, crits: r.criteria.length };
});
ok('der Canary-Auswerter läuft im Browser', canary.crits === 7);
ok('… und meldet mit dünner Datenlage NICHT bereit', canary.gateReady === false && canary.pending > 0);

/* ============ 6) Keine Nebenwirkung auf die Anzeige ============ */
sec('6 · Keine Nebenwirkung');
ok('renderDecision läuft mit gesetztem Flag ohne Fehler durch', await page.evaluate(() => {
  try { renderDecision(); return true; } catch (e) { return String(e); }
}) === true);
ok('der Legacy-Plan ist weiterhin lesbar', await page.evaluate(() => {
  const w = activeWeekPlan(); return Array.isArray(w) && w.length === 7;
}) === true);
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));


/* ============ 7) Belegsammler ============ */
sec('7 · canaryReport — ein Befehl statt handgebautem JSON');
const rep = await page.evaluate(() => ORVIA.canaryReport({ skipWriteProbe: true }));
ok('ORVIA.canaryReport() ist erreichbar und liefert eine Auswertung',
   !!(rep && rep.result && rep.result.criteria && rep.result.criteria.length === 7), rep && rep.error);
ok('… und meldet mit dieser Datenlage NICHT bereit', rep.result.gateReady === false);
ok('… benennt ausdrücklich, was nur ein Mensch beisteuern kann',
   Array.isArray(rep.needsHuman) && rep.needsHuman.length > 0, (rep.needsHuman || []).join(' | '));
ok('ungeprüfter RLS-Test gilt als unbekannt, NICHT als sicher',
   rep.input.channel.clientWritable === null && rep.result.criteria.find(c => c.id === 'C2').status === 'insufficient_data');
ok('der Legacy-Pfad wird live als intakt belegt (C3)',
   rep.input.legacy.generatorPresent === true && rep.input.legacy.legacyPathIntact === true);
ok('ohne durchgeführten Rücklauf bleibt C4 offen',
   rep.result.criteria.find(c => c.id === 'C4').status === 'insufficient_data');

await browser.close(); server.close();
console.log('\nphase8_activation_live: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
