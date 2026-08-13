/* ORVIA · Phase 6.3 (2026-08-05) — Ladbarkeitstest der 9 Engine-/Knowledge-Module.
   Kernvertraege:
   1. Alle 9 Namespaces existieren nach dem App-Load (vorher: scheduler-goal-allocation
      failte garantiert mit SCHEDULER_GA_PORTFOLIO_MODULE_MISSING).
   2. REIHENFOLGE-BEWEIS: running-knowledge-pack.contentHash und knowledge-sources.contentHash
      sind gesetzt — das geht NUR, wenn knowledge-contracts VOR ihnen geladen wurde
      (Load-Time-Aufruf von packContentHash/registryContentHash).
   3. Negativkontrolle: laedt man pack VOR contracts (isolierter Kontext), fehlt der Hash —
      beweist, dass Pruefung 2 die Reihenfolge wirklich misst und nicht trivial gruen ist.
   4. Kein Modul veraendert die UI zur Ladezeit (keine JS-Fehler, App rendert weiter).
   node supabase/tests/phase6_module_load_test.mjs [appRoot-absolut] */
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
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
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
const R = f => readFileSync(join(APP, f), 'utf8');

const MODULES = [
  ['js/engine/knowledge/knowledge-contracts.js', 'knowledgeContracts'],
  ['js/engine/knowledge/knowledge-sources.js', 'knowledgeSources'],
  ['js/engine/knowledge/running-knowledge-pack.js', 'runningKnowledgePack'],
  ['js/engine/knowledge/sport-coverage-matrix.js', 'sportCoverageMatrix'],
  ['js/engine/goal-portfolio.js', 'goalPortfolio'],
  ['js/engine/running-capacity-factory.js', 'runningCapacityFactory'],
  ['js/engine/scheduler-input-factory.js', 'schedulerInputFactory'],
  ['js/engine/scheduler-goal-allocation.js', 'schedulerGoalAllocation'],
  ['js/engine/scheduler-v1.js', 'schedulerV1']
];

/* ============ Quelltext-Vertraege ============ */
const idx = R('index.html');
const sw = R('sw.js');
MODULES.forEach(([p]) => {
  ok('index.html laedt ' + p, idx.indexOf('src="' + p + '"') >= 0);
  ok('sw.js precacht ' + p, sw.indexOf("'./" + p + "'") >= 0);
});
/* Reihenfolge im Quelltext: contracts vor sources vor pack; portfolio vor goal-allocation. */
const pos = s => idx.indexOf('src="' + s + '"');
ok('Reihenfolge: knowledge-contracts VOR knowledge-sources VOR running-knowledge-pack',
   pos('js/engine/knowledge/knowledge-contracts.js') < pos('js/engine/knowledge/knowledge-sources.js')
   && pos('js/engine/knowledge/knowledge-sources.js') < pos('js/engine/knowledge/running-knowledge-pack.js'));
ok('Reihenfolge: goal-portfolio VOR scheduler-goal-allocation',
   pos('js/engine/goal-portfolio.js') < pos('js/engine/scheduler-goal-allocation.js'));
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 233, genau einmal', swv != null && Number(swv) >= 233 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

/* ============ LIVE: App-Load mit allen Modulen ============ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
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

const live = await page.evaluate((mods) => {
  const r = { ns: {}, hashes: {}, gaProbe: null, rules: null };
  mods.forEach(([, name]) => { r.ns[name] = !!(window.ORVIA && window.ORVIA[name]); });
  try { r.hashes.pack = (window.ORVIA.runningKnowledgePack && typeof window.ORVIA.runningKnowledgePack.contentHash === 'string' && window.ORVIA.runningKnowledgePack.contentHash.length > 0); } catch (_) { r.hashes.pack = false; }
  try { r.hashes.registry = (window.ORVIA.knowledgeSources && typeof window.ORVIA.knowledgeSources.contentHash === 'string' && window.ORVIA.knowledgeSources.contentHash.length > 0); } catch (_) { r.hashes.registry = false; }
  try { r.rules = (window.ORVIA.runningKnowledgePack.rules || []).length; } catch (_) { }
  /* SCHEDULER_GA_PORTFOLIO_MODULE_MISSING darf NICHT mehr die Ausfallursache sein:
     wir rufen allocate mit bewusst minimal-invalidem Input — der Fehler muss jetzt
     ein Eingabe-Fehler sein, nie mehr das fehlende Portfolio-Modul. */
  try {
    const ga = window.ORVIA.schedulerGoalAllocation;
    const res = (ga.allocate || ga.build || ga.run || function () { return null; }).call(ga, {});
    r.gaProbe = res && res.errors && res.errors.length ? String(res.errors[0].code || res.errors[0]) : JSON.stringify(res && (res.error || res.status || Object.keys(res || {})));
  } catch (e) { r.gaProbe = 'threw:' + String(e && e.message).slice(0, 80); }
  return r;
}, MODULES);

MODULES.forEach(([, name]) => ok('LIVE · ORVIA.' + name + ' existiert', live.ns[name] === true));
ok('LIVE · Reihenfolge-Beweis: runningKnowledgePack.contentHash gesetzt', live.hashes.pack === true);
ok('LIVE · Reihenfolge-Beweis: knowledgeSources.contentHash gesetzt', live.hashes.registry === true);
/* KORREKTUR zur Planangabe „19 Regeln ueber 14 Topics": das Pack enthaelt 14 Regeln
   ueber 14 Topics. Die 19 im Umsetzungsplan stammen aus der ruleId-Vorkommenszaehlung
   INKLUSIVE der 5 goldenCase-Referenzen — kein Regelverlust, Zaehlfehler im Plan. */
ok('LIVE · 14 Knowledge-Regeln geladen (Plan-Zahl 19 war ruleId-Zaehlung inkl. goldenCase)', live.rules === 14, String(live.rules));
ok('LIVE · Scheduler-GA failt NICHT mehr mit PORTFOLIO_MODULE_MISSING',
   live.gaProbe != null && String(live.gaProbe).indexOf('PORTFOLIO_MODULE_MISSING') < 0, String(live.gaProbe));
ok('LIVE · keine ungefangenen JS-Fehler beim App-Load', errs.length === 0, errs.slice(0, 3).join(' | '));
/* App rendert weiter: Tabbar existiert und Dashboard-Host ist da. */
const uiOk = await page.evaluate(() => !!document.querySelector('.tabbar') && !!document.getElementById('tab-heute'));
ok('LIVE · UI unveraendert funktionsfaehig (Tabbar + Dashboard-Host)', uiOk);

/* ============ Negativkontrolle: pack OHNE contracts ⇒ Hash fehlt ============ */
const page2 = await ctx.newPage();
await page2.goto(`http://127.0.0.1:${server.address().port}/env.js`, { waitUntil: 'load' });
const neg = await page2.evaluate(async (port) => {
  const load = (src) => new Promise((res) => { const s = document.createElement('script'); s.src = 'http://127.0.0.1:' + port + '/' + src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
  await load('js/engine/knowledge/running-knowledge-pack.js');   // OHNE contracts davor
  try { return { hash: typeof window.ORVIA.runningKnowledgePack.contentHash }; } catch (e) { return { hash: 'err' }; }
}, server.address().port);
ok('NEGATIVKONTROLLE · pack ohne contracts ⇒ contentHash fehlt (Reihenfolge-Pruefung misst wirklich)',
   neg.hash !== 'string', String(neg.hash));

await browser.close(); server.close();
console.log('\nphase6_module_load: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
