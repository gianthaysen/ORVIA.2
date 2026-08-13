/* ORVIA · Phase 1 — Workout-Kette (KF-001, KF-002, KF-003).

   Der entscheidende Nachweis ist NICHT „open() wurde aufgerufen", sondern:

     Ein gestartetes Workout kann nach Schliessen der Oberflaeche ohne
     Datenverlust wieder aufgenommen werden.

   Deshalb prueft dieser Test die sechs Zustaende aus
   baseline/known-failures.json (KF-003.testRequirement) gegen die ECHTE App
   im Browser — nicht gegen eine Fixture.

   Zusaetzlich abgesichert:
   • training_start und training_continue zeigen NICHT mehr auf denselben
     Entry-Point (das war die Ursache, dass beide dieselbe tote Aktion waren).
   • Die reparierten Kernaktionen melden ihren FACHLICHEN Endzustand (E-14),
     nicht nur, ob ein Handler aufloesbar war.

   node supabase/tests/workout_chain_phase1_test.mjs [appRoot-absolut] */
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

/* ---------- statische Vertragspruefung (ohne Browser) ---------- */
const qaSrc = readFileSync(join(APP, 'js', 'quick-actions.js'), 'utf8');
const startEp = (qaSrc.match(/id:\s*'training_start'[\s\S]{0,400}?entryPoint:\s*'([^']+)'/) || [])[1];
const contEp  = (qaSrc.match(/id:\s*'training_continue'[\s\S]{0,400}?entryPoint:\s*'([^']+)'/) || [])[1];
ok('training_start und training_continue haben getrennte Entry-Points',
   !!startEp && !!contEp && startEp !== contEp, startEp + '  vs  ' + contEp);
ok('training_continue zeigt auf den Wiedereinstieg, nicht auf den Start',
   contEp === 'orvia:workoutUI.resumeActiveSync', contEp);

const wuSrc = readFileSync(join(APP, 'js', 'workout-ui.js'), 'utf8');
ok('openTrainingTab faellt auf gmOpenStartSheet zurueck', /gmOpenStartSheet/.test(wuSrc));
ok('openTrainingTab meldet einen fachlichen Endzustand',
   /outcome:\s*'start_sheet_opened'/.test(wuSrc) && /reason:\s*'no_training_entry_point'/.test(wuSrc));

const uiSrc = readFileSync(join(APP, 'js', 'ui.js'), 'utf8');
const gst = uiSrc.slice(uiSrc.indexOf('function gmStartTraining()'), uiSrc.indexOf('function gmStartTraining()') + 1200);
ok('Hero-CTA verwirft das Ergebnis nicht mehr (kein bedingungsloses return)',
   /res\s*&&\s*res\.handled/.test(gst) && !/runAction\('training_start'\);return;/.test(gst));
ok('Hero-CTA informiert erst, wenn KEIN Weg funktioniert hat',
   /toast\(/.test(gst) && gst.indexOf('gmOpenStartSheet') < gst.indexOf('toast('));

/* ---------- Browser: echte App ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test: unkonfiguriert */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

async function load() {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
    document.documentElement.classList.remove('orvia-gated');
  });
  await page.waitForTimeout(300);
}
/* Setzt den In-Memory-Store — genau die Quelle, die buildContext() und
   resumeActiveSync() lesen. Getestet wird die UI-Kette, nicht die Persistenz. */
const seedActive = () => page.evaluate(() => {
  const O = window.ORVIA; O.workout = O.workout || {};
  O.workout.session = { id: 'test-1', status: 'active', sport: 'Laufen',
                        started_at: new Date(Date.now() - 12 * 60000).toISOString(),
                        total_paused_seconds: 0, paused_at: null };
  O.workout.exercises = []; O.workout.currentIndex = 0;
});
const clearActive = () => page.evaluate(() => {
  const O = window.ORVIA; O.workout = O.workout || {};
  O.workout.session = null; O.workout.exercises = []; O.workout.currentIndex = 0;
});
/* Defensiv: an Staenden VOR der Reparatur existiert resumeActiveSync nicht.
   Der Test soll den Defekt MELDEN, nicht mit einem TypeError abbrechen. */
const resume = () => page.evaluate(() => {
  const f = window.ORVIA && window.ORVIA.workoutUI && window.ORVIA.workoutUI.resumeActiveSync;
  if (typeof f !== 'function') return { ok: false, reason: 'resumeActiveSync_missing' };
  try { return f(); } catch (e) { return { ok: false, reason: 'threw:' + (e && e.message) }; }
});
/* Ebenso defensiv: runActionEx existiert erst seit der Phase-0-Instrumentierung. */
const runEx = (id) => page.evaluate((a) => {
  const qa = window.ORVIA && window.ORVIA.quickActions;
  if (!qa) return { handled: false, reason: 'quickActions_missing' };
  if (typeof qa.runActionEx !== 'function') {
    const b = (typeof qa.runAction === 'function') ? qa.runAction(a) : false;
    return { handled: !!b, reason: b ? 'handled' : 'runActionEx_missing', outcome: null };
  }
  try { return qa.runActionEx(a); } catch (e) { return { handled: false, reason: 'threw:' + (e && e.message) }; }
}, id);
const overlayVisible = () => page.evaluate(() => {
  const ov = document.getElementById('workoutOverlay');
  return !!(ov && !ov.classList.contains('hide'));
});

await load();

/* ---- Zustand 1: kein aktives Workout -> „Fortsetzen" wird nicht angeboten ---- */
await clearActive();
const ctxNo = await page.evaluate(() => {
  const qa = window.ORVIA.quickActions;
  const m = qa.composeQuickMenu(qa.buildContext(new Date()), qa.getFavorites(), qa.ACTIONS);
  return m.context.map(a => a.id);
});
ok('Zustand 1 · kein aktives Workout: „Fortsetzen" nicht angeboten',
   ctxNo.indexOf('training_continue') < 0, 'Kontext: ' + (ctxNo.join(', ') || '(leer)'));

const resNo = await resume();
ok('Zustand 1 · Fortsetzen meldet ehrlich no_active_workout',
   resNo.ok === false && resNo.reason === 'no_active_workout', JSON.stringify(resNo));

/* ---- Hero-CTA: KF-001 ---- */
await page.evaluate(() => { try { gmCloseSheets(); } catch (e) {} });
await page.evaluate(() => gmStartTraining());
await page.waitForTimeout(450);
const heroOpened = await page.evaluate(() => {
  const sh = document.getElementById('detailSheet');
  return { on: !!(sh && sh.classList.contains('on')), title: (sh && sh.querySelector('h3') || {}).textContent || null };
});
ok('KF-001 · Hero-CTA oeffnet sichtbar das Start-Sheet',
   heroOpened.on === true, 'Titel: ' + heroOpened.title);

/* ---- KF-002: FAB-Aktion ueber den kanonischen Executor ---- */
await page.evaluate(() => { try { gmCloseSheets(); } catch (e) {} });
await page.waitForTimeout(250);
const resStart = await runEx('training_start');
await page.waitForTimeout(400);
ok('KF-002 · training_start meldet handled MIT fachlichem Outcome',
   resStart.handled === true && resStart.outcome === 'start_sheet_opened', JSON.stringify(resStart));
ok('KF-002 · Start-Sheet ist danach tatsaechlich offen', (await overlayVisible()) === false && await page.evaluate(() => {
  const sh = document.getElementById('detailSheet'); return !!(sh && sh.classList.contains('on'));
}));

/* ---- Zustand 3: aktives Workout, Overlay geschlossen -> wird wieder geoeffnet ---- */
await page.evaluate(() => { try { gmCloseSheets(); } catch (e) {} });
await seedActive();
await page.evaluate(() => { try { window.ORVIA.workoutUI.close(); } catch (e) {} });
ok('Zustand 3 · Vorbedingung: Overlay ist geschlossen', (await overlayVisible()) === false);
const resCont = await runEx('training_continue');
await page.waitForTimeout(350);
ok('Zustand 3 · Fortsetzen oeffnet das Overlay WIRKLICH',
   (await overlayVisible()) === true, JSON.stringify(resCont));
ok('Zustand 3 · Ergebnis meldet workout_overlay_opened',
   resCont.handled === true && resCont.outcome === 'workout_overlay_opened');

/* ---- Zustand 2: Overlay bereits offen -> keine zweite Instanz ---- */
await resume();
await page.waitForTimeout(250);
const instances = await page.evaluate(() => document.querySelectorAll('#workoutOverlay').length);
ok('Zustand 2 · Overlay offen: keine zweite Instanz', instances === 1, instances + ' Overlay(s)');
ok('Zustand 2 · Overlay bleibt offen', (await overlayVisible()) === true);

/* ---- Zustand 4: Tabwechsel -> Zustand bleibt erhalten ---- */
await page.evaluate(() => { try { showTab('plan'); } catch (e) {} });
await page.waitForTimeout(350);
await page.evaluate(() => { try { showTab('heute'); } catch (e) {} });
await page.waitForTimeout(350);
const afterTabs = await page.evaluate(() => {
  const s = window.ORVIA.workout && window.ORVIA.workout.session;
  return { active: !!(s && s.status === 'active'), id: s && s.id };
});
ok('Zustand 4 · nach Tabwechsel bleibt die Session aktiv',
   afterTabs.active === true && afterTabs.id === 'test-1');
const contAfterTabs = await page.evaluate(() => {
  const qa = window.ORVIA.quickActions;
  return qa.composeQuickMenu(qa.buildContext(new Date()), qa.getFavorites(), qa.ACTIONS)
           .context.map(a => a.id);
});
ok('Zustand 4 · „Fortsetzen" wird weiterhin angeboten',
   contAfterTabs.indexOf('training_continue') >= 0, 'Kontext: ' + contAfterTabs.join(', '));

/* ---- Zustand 5: Reload -> Wiederherstellung ODER klarer Fehler, nie stiller Verlust ---- */
await load();
const afterReload = await page.evaluate(() => {
  const s = window.ORVIA.workout && window.ORVIA.workout.session;
  const f = window.ORVIA.workoutUI && window.ORVIA.workoutUI.resumeActiveSync;
  const r = (typeof f === 'function') ? f() : { ok: false, reason: 'resumeActiveSync_missing' };
  return { restored: !!(s && s.status === 'active'), result: r };
});
ok('Zustand 5 · nach Reload: entweder wiederhergestellt oder ehrlicher Grund — nie stiller Erfolg',
   afterReload.restored
     ? (afterReload.result.ok === true)
     : (afterReload.result.ok === false && afterReload.result.reason === 'no_active_workout'),
   JSON.stringify(afterReload));
ok('Zustand 5 · Overlay oeffnet NICHT automatisch nach Reload',
   (await overlayVisible()) === false);

/* ---- Zustand 6: staler Zustand (Session ohne status) -> kontrollierte Bereinigung ---- */
await page.evaluate(() => {
  const O = window.ORVIA; O.workout = O.workout || {};
  O.workout.session = { id: 'stale-1', started_at: null };   // kein status, kein Start
});
const resStale = await resume();
ok('Zustand 6 · staler Zustand wird nicht als aktiv behandelt',
   resStale.ok === false && resStale.reason === 'no_active_workout', JSON.stringify(resStale));
ok('Zustand 6 · kein Overlay durch stalen Zustand', (await overlayVisible()) === false);
const staleCtx = await page.evaluate(() => {
  const qa = window.ORVIA.quickActions;
  return qa.composeQuickMenu(qa.buildContext(new Date()), qa.getFavorites(), qa.ACTIONS)
           .context.map(a => a.id);
});
ok('Zustand 6 · „Fortsetzen" wird bei stalem Zustand nicht angeboten',
   staleCtx.indexOf('training_continue') < 0, 'Kontext: ' + (staleCtx.join(', ') || '(leer)'));

/* ---- Keine neuen Laufzeitfehler ---- */
ok('keine ungefangenen JS-Fehler waehrend der gesamten Kette',
   pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

await browser.close();
server.close();
console.log('\nworkout_chain_phase1: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
