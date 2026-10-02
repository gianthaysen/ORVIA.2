/* ORVIA · sw_auto_reload_e2e (v8-426) — neuer Service Worker ⇒ Seite laedt EINMAL selbst neu.

   Gians Befund 2.10.: nach dem Deploy stand „v8-425" in der App, die Seite lief aber mit
   altem Code (ORVIA.planAutoLink.debug „is not a function") — bis zum zweiten Neuladen
   von Hand. Dieser Test faehrt den echten Ablauf: echter Service Worker, echter Precache,
   ein „Deploy" (neue sw.js + neues Skript) und prueft, dass die Seite danach OHNE Zutun
   den neuen Code ausfuehrt — und dass sie mitten in einer Eingabe NICHT neu laedt.

   node supabase/tests/sw_auto_reload_e2e_test.mjs [appRoot-absolut] */
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


const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
let PHASE = 1;
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  let body = readFileSync(f);
  /* „Deploy": je Phase eine andere Cache-Version und ein anderes Skript */
  if (p === '/sw.js') body = Buffer.from(String(body).replace(/const C = '[^']+'/, "const C = 'orvia-test-" + PHASE + "'"));
  if (p === '/js/tab-swipe.js') body = Buffer.from(String(body) + '\n;window.__PHASE=' + PHASE + ';');
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
});
await new Promise(r => server.listen(0, r));   /* localhost (nicht 127.0.0.1): nur dort registriert die App den Service Worker */
const PORT = server.address().port;
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
let loads = 0; page.on('load', () => { loads++; });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
const phase = () => page.evaluate(() => window.__PHASE).catch(() => null);
const waitPhase = async (n, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await phase()) === n) return true; await page.waitForTimeout(200); } return false; };
const swUpdate = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); return !!r; });

/* ---- 1 · Erstinstallation: kein Neuladen ---- */
await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
const ctrl = await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 }).then(() => true).catch(() => false);
await page.waitForTimeout(800);
ok('A1 Service Worker installiert und uebernimmt die Seite', ctrl === true);
ok('A2 Erstinstallation loest KEIN Neuladen aus', loads === 1 && (await phase()) === 1, 'loads=' + loads);

/* ---- 2 · Deploy: neuer Service Worker ⇒ Seite laedt von selbst neu und fuehrt den NEUEN Code aus ---- */
PHASE = 2;
await page.evaluate(() => { try { sessionStorage.removeItem('orvia_sw_reload_at'); } catch (_) {} window.__mark = 1; });
await swUpdate();
const got2 = await waitPhase(2, 30000);
ok('B1 nach dem Deploy laeuft OHNE Zutun der neue Code', got2 === true, 'phase=' + (await phase()));
ok('B2 genau EIN automatisches Neuladen (keine Schleife)', loads === 2 && (await page.evaluate(() => window.__mark)) === undefined, 'loads=' + loads);
await page.waitForTimeout(1500);
ok('B3 danach bleibt die Seite stehen', loads === 2);

/* ---- 3 · mitten in einer Eingabe: NICHT neu laden, Hinweis zeigen, spaeter nachholen ---- */
PHASE = 3;
await page.evaluate(() => {
  try { sessionStorage.removeItem('orvia_sw_reload_at'); } catch (_) {}
  const i = document.createElement('input'); i.id = 'e2eInput'; i.style.cssText = 'position:fixed;top:0;left:0;z-index:99999'; document.body.appendChild(i); i.focus(); i.value = 'halb getippt';
});
await swUpdate();
await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active && /sw\.js/.test(r.active.scriptURL) && !r.installing && !r.waiting); }, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);
const busy = await page.evaluate(() => ({ phase: window.__PHASE, val: (document.getElementById('e2eInput') || {}).value, toast: (document.getElementById('toast') || {}).textContent || '', pending: typeof _gmSwPending !== 'undefined' ? _gmSwPending : null }));
ok('C1 waehrend der Eingabe wird NICHT neu geladen — das Getippte bleibt', loads === 2 && busy.phase === 2 && busy.val === 'halb getippt', JSON.stringify(busy));
ok('C2 stattdessen ein Hinweis mit Knopf „Neu laden"', /Neue Version bereit/.test(busy.toast) && /Neu laden/.test(busy.toast) && busy.pending === true, busy.toast);
await page.evaluate(() => { document.getElementById('e2eInput').blur(); try { sessionStorage.removeItem('orvia_sw_reload_at'); } catch (_) {} window.dispatchEvent(new CustomEvent('orvia:tab-changed', { detail: { tab: 'plan' } })); });
const got3 = await waitPhase(3, 20000);
/* v8-429: phase() liest schon die NEUE Seite, waehrend deren load-Ereignis (Zaehler `loads`)
   unter Last noch aussteht — in der Gesamtsuite einmal „phase=3 loads=2". Kurz auf den
   Zaehler warten statt ihn im selben Moment zu lesen. */
for (let _w = 0; _w < 50 && loads < 3; _w++) await page.waitForTimeout(100);
ok('C3 im naechsten ruhigen Moment (Tabwechsel) wird nachgeholt', got3 === true && loads === 3, 'phase=' + (await phase()) + ' loads=' + loads);

/* ---- 4 · Schleifenschutz ---- */
const guard = await page.evaluate(() => { sessionStorage.setItem('orvia_sw_reload_at', String(Date.now())); return gmSwReloadNow(); });
await page.waitForTimeout(600);
ok('D1 Schleifenschutz: innerhalb von 15 s kein zweites Neuladen', guard === false && loads === 3);
ok('D2 keine Laufzeitfehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' sw_auto_reload_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
