/* ORVIA · Phase 1a (Rest) + 1c — die fuenf kleinen Kernpfade.

   Sichert ab:
     KF-006  Muskelkarten-Retry setzt den Modell-Cache zurueck
     KF-009  Pace-Rechner-Widerspruch (Analyse meldete „folgt bald", obwohl der
             Rechner produktiv ist)
     P0-6    Profilkopf nutzt avatarStore.currentSrc() statt nur PROFILE.avatar
     P0-7    Modulverwaltung ist keine Einbahnstrasse mehr
     P0-8    Drag-Griff ohne Funktion entfernt
     1c      toter Code und Textwiderspruueche

   node supabase/tests/phase1a_rest_test.mjs [appRoot-absolut] */
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
const _hx = join(HERE, '..', '..');
import { existsSync as _exApp2 } from 'node:fs';
const APP = process.argv[2] ? normalize(process.argv[2]) : ([_hx, join(_hx, 'app'), join(_hx, '..', 'app')].find(p => _exApp2(join(p, 'index.html'))) || _hx);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium); /* v8-307b: Binary-Existenz ist Teil der Skip-Bedingung */

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

const ui = R('js/ui.js');
const css = R('styles.css');

/* ---------- KF-006 ---------- */
const retry = ui.slice(ui.indexOf('function gmAnaRetry()'), ui.indexOf('function gmAnaRetry()') + 700);
ok('KF-006 · gmAnaRetry setzt _gmMvModel zurueck', /_gmMvModel\s*=\s*null/.test(retry));
ok('KF-006 · der Cache-Zweig, der den Fehler konservierte, existiert weiterhin',
   /_gmMvModel&&_gmMvModel\.days===gmBodyRange/.test(ui),
   'sonst pruefte der Test einen Pfad, den es nicht gibt');

/* ---------- KF-009 ---------- */
ok('KF-009 · Analyse bewirbt den Pace-Rechner nicht mehr als „folgt bald"',
   !/Pace-Rechner<\/b><span>Folgt bald/.test(ui));
const paceSheet = ui.slice(ui.indexOf('function gmOpenPaceCalcSheet()'), ui.indexOf('/* --- Hauptrenderer --- */'));
ok('KF-009 · Einstieg oeffnet die Rechner-Unterseite ueber die kanonische Kette',
   /gmOpenProfPage\('paceCalc'\)/.test(paceSheet) && /openProfile\(\)/.test(paceSheet));
ok('KF-009 · gmProfPaceCalc wird NICHT direkt aufgerufen (es ist ein Renderer, kein Oeffner)',
   !/gmCloseSheets\(\);gmProfPaceCalc\(\)/.test(paceSheet));
ok('KF-009 · ehrlicher Fallback bleibt erhalten', /GM_NA/.test(paceSheet));
ok('KF-009 · der produktive Rechner existiert', /function gmProfPaceCalc\(\)/.test(ui));

/* ---------- P0-6 ---------- */
const gmProf = ui.slice(ui.indexOf('function renderGMProfile()'), ui.indexOf('function renderGMProfile()') + 1400);
ok('P0-6 · Profilkopf liest avatarStore.currentSrc()', /avatarStore&&ORVIA\.avatarStore\.currentSrc/.test(gmProf));
ok('P0-6 · PROFILE.avatar bleibt Rueckfall', /PROFILE\.avatar/.test(gmProf));
ok('P0-6 · renderGMProfile ist im avatarStore-Hydrate registriert',
   /renderGMProfile/.test(R('js/avatar-store.js')));
ok('P0-6 · renderGMProfile ist im zentralen Refresh registriert',
   /gmProfile:\s*'renderGMProfile'/.test(R('js/ui-refresh.js')));

/* ---------- P0-8 ---------- */
ok('P0-8 · kein .mm-drag-Element mehr im Markup', !/class="mm-drag"/.test(ui));
ok('P0-8 · kein .mm-drag-Stil mehr', !/^\.mm-drag\{/m.test(css));
/* Auf CODE pruefen, nicht auf Text — der erklaerende Kommentar nennt die Begriffe selbst. */
const uiCode = ui.replace(/\/\*[\s\S]*?\*\//g, '');
ok('P0-8 · es gab wirklich nie eine Drag-Funktion',
   !/addEventListener\(\s*['"]dragstart|draggable\s*=/.test(uiCode),
   'sonst haetten wir Funktion entfernt statt Deko');

/* ---------- P0-7 statisch ---------- */
const mm = ui.slice(ui.indexOf('function gmRenderMM()'), ui.indexOf('function gmMoveMod('));
ok('P0-7 · Modulverwaltung rendert auch ausgeblendete Module', /inactive/.test(mm));
ok('P0-7 · Toggle arbeitet mit der Modul-ID, nicht mit einem Listenindex',
   /function gmToggleMod\(id\)/.test(ui) && /indexOf\(id\)/.test(ui));
ok('P0-7 · leere Auswahl faellt nicht mehr still auf die Standardmodule zurueck',
   !/Array\.isArray\(arr\)&&arr\.length&&arr\.every/.test(ui));

/* ---------- 1c ---------- */
ok('1c · gmProfDash entfernt', !/function gmProfDash\(\)/.test(ui));
ok('1c · batteryWord entfernt', !/batteryWord:/.test(ui));
ok('1c · kein hardcodiertes Testnutzer-Alter im Supplement-Lexikon (KF-014)',
   !/bei dir \(22, gesund\)/.test(R('js/supplements.js')));
ok('1c · veralteter Garmin-Hinweis korrigiert',
   !/Garmin-Synchronisierung ist vorbereitet, aber aktuell noch nicht verf/.test(R('js/profile.js')));

/* ---------- Browser: Verhalten, nicht nur Quelltext ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.evaluate(() => {
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  document.documentElement.classList.remove('orvia-gated');
});
await page.waitForTimeout(300);

/* P0-7: Ausblenden und WIEDER einblenden — das war vorher unmoeglich. */
const roundTrip = await page.evaluate(() => {
  try { localStorage.removeItem('orvia_gm_mods_' + gmLevel()); } catch (e) {}
  gmOpenMM();
  const before = gmModules().slice();
  const target = before[before.length - 1];
  gmToggleMod(target);
  const afterOff = gmModules().slice();
  const offRows = document.querySelectorAll('#mmList .mm-item.mm-off').length;
  const stillListed = !!document.querySelector('#mmList .sw[onclick*="' + target + '"]');
  gmToggleMod(target);
  const afterOn = gmModules().slice();
  try { localStorage.removeItem('orvia_gm_mods_' + gmLevel()); } catch (e) {}
  return { target, removed: afterOff.indexOf(target) < 0, offRows, stillListed,
           restored: afterOn.indexOf(target) >= 0, count: afterOn.length === before.length };
});
ok('P0-7 · Modul laesst sich ausblenden', roundTrip.removed, roundTrip.target);
ok('P0-7 · ausgeblendetes Modul bleibt im Sheet sichtbar', roundTrip.offRows >= 1 && roundTrip.stillListed,
   roundTrip.offRows + ' als ausgeblendet markiert');
ok('P0-7 · und laesst sich WIEDER einschalten (war die Einbahnstrasse)', roundTrip.restored);
ok('P0-7 · Modulanzahl danach unveraendert', roundTrip.count);

/* KF-009: Tap oeffnet den echten Rechner, nicht den NA-Hinweis. */
const pace = await page.evaluate(() => {
  try { gmCloseSheets(); } catch (e) {}
  gmOpenPaceCalcSheet();
  const pg = document.getElementById('gmProfPage');
  const sh = document.getElementById('detailSheet');
  return {
    pageOpen: !!(pg && pg.classList.contains('on')),
    hasInputs: !!(pg && pg.querySelector('#pcDist') && pg.querySelector('#pcTime')),
    naSheet: !!(sh && sh.classList.contains('on') && /nicht erreichbar/.test(sh.innerText || ''))
  };
});
ok('KF-009 · Tap oeffnet die Rechner-Unterseite', pace.pageOpen === true, JSON.stringify(pace));
ok('KF-009 · der Rechner ist wirklich bedienbar (Eingabefelder vorhanden)', pace.hasInputs === true);
ok('KF-009 · kein Nicht-verfuegbar-Hinweis mehr', pace.naSheet === false);

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close(); server.close();
console.log('\nphase1a_rest: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
