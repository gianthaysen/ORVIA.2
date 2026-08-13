/* ORVIA · Visuelle QA-Aufnahme (2026-08-05) — gezielte Screenshots der Phase-4/5-UI-Elemente.
   KEIN Test mit Pass/Fail — reine Bildaufnahme fuer manuelle Sichtpruefung, angefordert
   nach der Frage „Ist alles auch grafisch sauber geloest?". Nutzt denselben lokalen
   Server + Stub-Pattern wie phase5de_test.mjs (kein echtes Supabase noetig).
   node supabase/tests/visual_qa_screens.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
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
const OUT = join(HERE, '..', '..', 'visual_qa_out');
mkdirSync(OUT, { recursive: true });

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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

let shot = 0;
async function snap(name, selector) {
  shot++;
  const fname = String(shot).padStart(2, '0') + '_' + name + '.png';
  if (selector) {
    const el = await page.$(selector);
    if (el) { await el.screenshot({ path: join(OUT, fname) }); console.log('OK  ' + fname); return; }
    console.log('MISS ' + fname + ' (Selektor nicht gefunden: ' + selector + ')');
    return;
  }
  await page.screenshot({ path: join(OUT, fname) });
  console.log('OK  ' + fname);
}

/* ===== 1) Profilkopf: Handle + Bio (Phase 4) — realistischer Text, kein "—" ===== */
await page.evaluate(() => {
  PROFILE.name = 'Gian Thaysen';
  PROFILE.handle = 'gian.trains';
  PROFILE.bio = 'Halbmarathon-Fokus, langfristig Ironman. Ausdauer, Kraft, Daten.';
  PROFILE.age = 22; PROFILE.weightKg = 78; PROFILE.heightCm = 182;
  delete PROFILE.hfMaxMeasured;
  if (typeof openProfile === 'function') openProfile();
});
await page.waitForTimeout(250);
await snap('profil_kopf_handle_bio', '#gmProfPage, #tab-mehr');

/* ===== 2) HR-Zonen-Karte: BEFUND — der Container liegt in der legacy #tab-mehr-Ebene,
   die per CSS (#tab-mehr > :not(#gmProf):not(#gmProfPage){display:none}) ausgeblendet
   ist. renderZones()/#zoneList sind fuer den Nutzer unsichtbar. Screenshot mit
   erzwungener Sichtbarkeit NUR zur Dokumentation dieses Befunds (zeigt NICHT den
   echten, vom Nutzer gesehenen Zustand). */
const zoneVis = await page.evaluate(() => {
  PROFILE.age = 22; delete PROFILE.hfMaxMeasured;
  if (typeof renderZones === 'function') renderZones();
  const card = document.getElementById('zoneList') && document.getElementById('zoneList').closest('.card');
  const visible = card ? card.offsetParent !== null : null;
  if (card) card.style.cssText += ';display:block !important;position:relative;z-index:99999;background:#0c131d';
  return { visibleInRealUi: visible, htmlLen: document.getElementById('zoneList') ? document.getElementById('zoneList').innerHTML.length : 0 };
});
console.log('BEFUND HR-Zonen-Karte: im echten Profil sichtbar = ' + zoneVis.visibleInRealUi + ' (innerHTML-Länge ' + zoneVis.htmlLen + ')');
await snap('hr_zonen_geschaetzt_ERZWUNGEN_SICHTBAR', '#zoneList');
await page.evaluate(() => { PROFILE.hfMaxMeasured = 191; if (typeof renderZones === 'function') renderZones(); });
await page.waitForTimeout(100);
await snap('hr_zonen_gemessen_ERZWUNGEN_SICHTBAR', '#zoneList');

/* ===== 4) Analyse-Tab Übersicht: KPI-2×2-Grid + Impact-Insights + Milestones (.mile) ===== */
await page.evaluate(() => { if (typeof closeProfile === 'function') closeProfile(); if (typeof showTab === 'function') showTab('dash'); });
await page.waitForTimeout(400);
await snap('analyse_uebersicht_voll', '#gmAna');

/* ===== 5) Analyse-Tab Ausdauer: zweites 2×2-KPI-Grid ===== */
await page.evaluate(() => { if (typeof gmSetAnaSeg === 'function') gmSetAnaSeg('endurance'); });
await page.waitForTimeout(300);
await snap('analyse_ausdauer_voll', '#gmAna');

/* ===== 6) Hypnogramm mit Spurenbeschriftung + Legende (Phase 4, P2-3) ===== */
await page.evaluate(() => {
  const today = todayStr();
  window.__ORVIA_TEST_SERIES_FETCH = function (metricType, from, to) {
    if (metricType === 'sleep_stages') {
      return Promise.resolve([{ metric_type: 'sleep_stages', metric_date: today, unit: null, points: [
        [0, 1800, 'light'], [1800, 2700, 'deep'], [4500, 900, 'light'], [5400, 1200, 'rem'],
        [6600, 300, 'awake'], [6900, 1500, 'light'], [8400, 1800, 'deep'], [10200, 900, 'rem'],
        [11100, 600, 'light']
      ] }]);
    }
    return Promise.resolve([]);
  };
  if (typeof openMetric === 'function') openMetric('sleep_duration_min');
});
await page.waitForTimeout(500);
await snap('hypnogramm_sheet', '#detailSheet');
await page.evaluate(() => { if (typeof gmCloseSheets === 'function') gmCloseSheets(); });
await page.waitForTimeout(200);

/* ===== 7) Plan-Tab: Konflikt-Badge sichtbar (Phase 5E) ===== */
await page.evaluate(() => {
  gmSetFeatureFlag('canonPlan', true);
  window._gmCanonPlan = {
    plan: { planId: 'wp:demo', weekKey: (typeof gmCanonPlanDomain === 'function' ? gmCanonPlanDomain().weekKeyFor(todayStr()) : '2026-W32'),
      revision: 3, baseline: { source: 'engine', sessions: [] }, overrides: [],
      pendingConflicts: [{ conflictId: 'cf:1', sessionId: 'ps:x', reason: 'engine_removed_overridden_session', at: new Date().toISOString() }],
      history: [] },
    weekKey: (typeof gmCanonPlanDomain === 'function' ? gmCanonPlanDomain().weekKeyFor(todayStr()) : '2026-W32'), loading: false, error: null
  };
  if (typeof showTab === 'function') showTab('plan');
});
await page.waitForTimeout(400);
await snap('plan_konflikt_badge', '.hdr:has(#gmPlanConfBadge)');
await snap('plan_tab_voll', '#gmPlan');

/* ===== 8) Plan-Einstellungen-Sheet: Beta-Toggle "Kanonisches Planmodell" ===== */
await page.evaluate(() => { if (typeof gmOpenPlanSettingsSheet === 'function') gmOpenPlanSettingsSheet(); });
await page.waitForTimeout(300);
await snap('plan_beta_toggle_sheet', '#detailSheet');
await page.evaluate(() => { gmSetFeatureFlag('canonPlan', false); if (typeof gmCloseSheets === 'function') gmCloseSheets(); });

console.log('\nJS-Fehler waehrend der Aufnahme: ' + (errs.length ? errs.slice(0, 5).join(' | ') : 'keine'));
console.log('Screenshots in: ' + OUT);
await browser.close(); server.close();
