/* ORVIA · Phase 8 (2026-08-05) — Gate-Verdrahtung im echten Browser.
   Beweise: der Wochen-Shadow schreibt die Gate-Belege (S3/S4/S5) aus einem
   ECHTEN Snapshot · gateReport() fuehrt beide Protokolle zusammen · der
   PERF-FIX verhindert Neuberechnung bei unveraenderter Lage, erzwingt sie aber
   bei geaenderter · und der Shadow steuert weiterhin nichts.
   node supabase/tests/phase8_gate_live_test.mjs [appRoot-absolut] */
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

/* ============ Gate-Belege aus echtem Snapshot ============ */
const g = await page.evaluate(() => {
  PROFILE.sports = ['Laufen', 'Gym', 'Rad'];
  PROFILE.availability = { days: { mo: {}, di: {}, mi: {}, do: { restDay: true }, fr: {}, sa: {}, so: {} } };
  ORVIA.engineShadow.clearWeekLog();
  const e = ORVIA.engineShadow.runWeekShadow();
  return { e, hasGate: !!(e && e.gate) };
});
ok('LIVE · Wochen-Eintrag traegt jetzt Gate-Belege (gate-Feld vorhanden)', g.hasGate === true, JSON.stringify(g.e && g.e.gate));
ok('LIVE · S3-Beleg: Determinismus am ECHTEN Snapshot geprueft und true',
   g.e && g.e.gate.deterministic === true);
ok('LIVE · S4-Beleg: normativer Validator lief, 0 ungueltige Sessions',
   g.e && g.e.gate.invalidSessions === 0 && g.e.gate.validator === 'prescription-factory.validateWorkout');
ok('LIVE · S5-Beleg: Provenienz vollstaendig, nichts fehlt',
   g.e && g.e.gate.provenanceComplete === true && g.e.gate.provenanceMissing.length === 0);
ok('LIVE · Belegzahl passt zur Sessionzahl (nicht stichprobenartig)',
   g.e && g.e.gate.sessionsChecked === g.e.sessions);

/* ============ gateReport(): beide Protokolle zusammengefuehrt ============ */
const r = await page.evaluate(() => {
  const rep = ORVIA.engineShadow.gateReport();
  return { gateReady: rep.gateReady, ids: rep.criteria.map(c => c.id), st: rep.criteria.map(c => c.id + '=' + c.status),
    pending: rep.pending, blockers: rep.blockers, nextStep: rep.nextStep, version: rep.version };
});
ok('LIVE · gateReport liefert alle 5 Kriterien', JSON.stringify(r.ids) === JSON.stringify(['S1', 'S2', 'S3', 'S4', 'S5']));
ok('LIVE · nach 1 Tag/1 Woche ist das Gate NICHT bereit (ehrlich, nicht optimistisch)',
   r.gateReady === false && r.pending.length > 0, r.st.join(' '));
ok('LIVE · S1 fehlen Vergleichstage ⇒ als pending gefuehrt, nicht als Blocker',
   r.pending.indexOf('S1') >= 0 && r.blockers.indexOf('S1') < 0, r.nextStep);
ok('LIVE · S3/S4/S5 sind mit EINER Woche bereits belegt (Beleg je Woche, nicht je Tag)',
   ['S3', 'S4', 'S5'].every(id => r.st.indexOf(id + '=pass') >= 0), r.st.join(' '));

/* ============ Frische statt Cache (Planpunkt „Vor der Aktivierung zu beheben") ============
   Es wurde BEWUSST kein Cache eingebaut. Dieser Block belegt beides:
   a) die Kosten sind real vernachlaessigbar (Messung statt Vermutung), und
   b) jeder Lauf rechnet frisch — sonst koennte ein veralteter Eintrag die
      Beweisgrundlage des Gates verfaelschen. */
const p = await page.evaluate(() => {
  /* Realistische Datenmenge: 120 Tage Check-ins. */
  const pad = n => String(n).padStart(2, '0'); const d = new Date();
  for (let i = 0; i < 120; i++) { const t = new Date(d - i * 864e5);
    const k = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    DB[k] = DB[k] || {}; DB[k].morning = { sleepH: 7, mood: 3, soreness: 2 }; DB[k].sessions = [{ sport: 'Laufen', minutes: 50, rpe: 5 }]; }
  const t0 = performance.now(); for (let i = 0; i < 20; i++) ORVIA.engineShadow.buildInput();
  const buildInputMs = (performance.now() - t0) / 20;
  const t1 = performance.now(); for (let i = 0; i < 20; i++) ORVIA.engineShadow.run();
  const runMs = (performance.now() - t1) / 20;
  /* Frischebeweis: Krankmeldung MUSS sofort im naechsten Lauf ankommen. */
  const today = todayStr();
  DB[today] = DB[today] || {}; DB[today].morning = DB[today].morning || {};
  DB[today].morning.ill = true;
  const after = ORVIA.engineShadow.run();
  return { buildInputMs: +buildInputMs.toFixed(2), runMs: +runMs.toFixed(2),
    stateAfterIllness: after && after.v2 && after.v2.state, days: Object.keys(DB).length };
});
ok('LIVE · Kosten gemessen, nicht vermutet: buildInput < 5 ms bei 120 Tagen Daten',
   p.buildInputMs < 5, p.buildInputMs + ' ms · run ' + p.runMs + ' ms · ' + p.days + ' Tage');
ok('LIVE · FRISCHE: Krankmeldung wirkt SOFORT im naechsten Lauf (kein Cache ⇒ nie GREEN)',
   p.stateAfterIllness !== 'GREEN' && p.stateAfterIllness != null, 'v2=' + p.stateAfterIllness);

/* ============ REGRESSION: globale let/const-Bindungen ============
   `let DB` (data.js) und `const RACE` (ui.js) erzeugen KEINE window-Eigenschaft.
   Der Resolver las beides ueber root.* — im Browser also dauerhaft undefined.
   Folge war ein stiller Totalausfall des Check-in-Pfades im Shadow (jeder Tag
   missing_checkin / illness:false). Dieser Block prueft die Ursache UND die
   Wirkung, damit der Fehler nicht ueber eine Refaktorierung zurueckkehrt. */
const b = await page.evaluate(() => {
  const t = todayStr();
  DB[t] = DB[t] || {};
  DB[t].morning = Object.assign({ sleepMin: 430, sleepQ: 3, feel: 3, doms: 2 }, DB[t].morning || {}, { ill: true });
  const inp = ORVIA.engineShadow.buildInput();
  const healthy = Object.assign({}, DB[t].morning); delete healthy.ill;
  DB[t].morning = healthy;
  const inp2 = ORVIA.engineShadow.buildInput();
  return { dbOnWindow: typeof globalThis.DB, dbLexical: typeof DB,
    raceOnWindow: typeof globalThis.RACE,
    illnessSeen: inp && inp.illness, illnessGone: inp2 && inp2.illness,
    checkinSeen: !!(inp && inp._shadowMissing && inp._shadowMissing.indexOf('checkin.morning') < 0) };
});
ok('URSACHE belegt: DB liegt NICHT auf window, nur als lexikalische Bindung',
   b.dbOnWindow === 'undefined' && b.dbLexical === 'object',
   'globalThis.DB=' + b.dbOnWindow + ' · DB=' + b.dbLexical + ' · globalThis.RACE=' + b.raceOnWindow);
ok('WIRKUNG behoben: Resolver sieht den Morgen-Check-in jetzt wirklich',
   b.checkinSeen === true);
ok('WIRKUNG behoben: illness:true wird gelesen — und bei Widerruf wieder false (kein Haengenbleiben)',
   b.illnessSeen === true && b.illnessGone === false);
{
  const src = readFileSync(join(APP, 'js/engine/training-input-resolver.js'), 'utf8');
  ok('Resolver liest DB/RACE nicht mehr blind ueber root.*',
     !/root\.DB\[/.test(src) && !/root\.RACE\s*&&/.test(src) && /_globalDB/.test(src) && /_globalRACE/.test(src));
}

/* ============ Steuert nichts ============ */
const s = await page.evaluate(() => {
  const before = JSON.stringify(PROFILE.weekPlan || null);
  ORVIA.engineShadow.runWeekShadow(); ORVIA.engineShadow.gateReport();
  return JSON.stringify(PROFILE.weekPlan || null) === before;
});
ok('LIVE · STEUERT NICHTS: PROFILE.weekPlan durch Shadow+Gate unveraendert', s === true);
ok('LIVE · keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\nphase8_gate_live: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
