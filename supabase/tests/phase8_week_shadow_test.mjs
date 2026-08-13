/* ORVIA · Phase 7→8 (2026-08-05) — Wochen-Shadow-Verdrahtung: scheduler-v2 plant
   still die aktuelle Woche aus echten App-Zustaenden. Beweise: Lauf erzeugt
   ok-Eintrag + lokales Protokoll, max 1 Lauf/Tag, weekReport-Gate, RPE-gefuehrt
   (keine Pace-Evidenz im Shadow), steuert nichts (PROFILE.weekPlan unveraendert).
   node supabase/tests/phase8_week_shadow_test.mjs [appRoot-absolut] */
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

const r = await page.evaluate(() => {
  PROFILE.sports = ['Laufen', 'Gym', 'Rad'];
  PROFILE.availability = { days: { mo: {}, di: {}, mi: {}, do: { restDay: true }, fr: {}, sa: {}, so: {} } };
  const before = JSON.stringify(PROFILE.weekPlan || null);
  const e1 = ORVIA.engineShadow.runWeekShadow();
  const e2 = ORVIA.engineShadow.runWeekShadow();                       // 2. Lauf am selben Tag ⇒ Cache
  const rep = ORVIA.engineShadow.weekReport();
  const raw = localStorage.getItem(ORVIA.engineShadow._wkey());
  return { e1, sameDayCached: e1 && e2 && e1.ts === e2.ts,
    persisted: !!raw && raw.indexOf(e1 && e1.weekKey) >= 0,
    rep: { weeks: rep.weeks, okWeeks: rep.okWeeks, gateReady: rep.gateReady },
    planUntouched: JSON.stringify(PROFILE.weekPlan || null) === before };
});
ok('LIVE · Wochen-Shadow läuft und liefert ok-Eintrag mit Sessions', r.e1 && r.e1.ok === true && r.e1.sessions > 0, JSON.stringify(r.e1));
ok('LIVE · konservativ + RPE-geführt (keine Pace-Evidenz im Shadow, Flags dokumentiert)',
   r.e1 && r.e1.flags.indexOf('no_pace_evidence_shadow') >= 0);
ok('LIVE · Ruhetag respektiert (kein thu im byDay)', r.e1 && r.e1.byDay.every(x => x.indexOf('do:') !== 0), JSON.stringify(r.e1 && r.e1.byDay));
ok('LIVE · max 1 Lauf/Tag (2. Aufruf liefert identischen Eintrag)', r.sameDayCached === true);
ok('LIVE · Protokoll lokal persistiert (12-Wochen-Ringpuffer-Key)', r.persisted === true);
ok('LIVE · weekReport zählt (1 Woche, gate erst ab 2 ok-Wochen)', r.rep.weeks === 1 && r.rep.okWeeks === 1 && r.rep.gateReady === false);
ok('LIVE · STEUERT NICHTS: PROFILE.weekPlan unverändert', r.planUntouched === true);
ok('LIVE · keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 240, genau einmal', swv != null && Number(swv) >= 240 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

await browser.close(); server.close();
console.log('\nphase8_week_shadow: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
