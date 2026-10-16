/* ============================================================
   ORVIA · performance_ledger_app_e2e (v8-448B) — Leistungsregister in der ECHTEN App (index.html)

   A  Flag aus (Standard): Bausteine geladen, Bruecke off, keine IndexedDB-Datenbank, kein Einstieg in
      „Bestzeiten", Direktaufruf der Seite zeigt nichts, keine Fehler
   B  Flag an (nur im Test gesetzt) + Repository-Stub mit vollstaendigem Bestand: Rechnen, IndexedDB,
      Einstieg sichtbar, Seite mit Bestwerten, Herkunft, „Aktivitaet oeffnen"
   C  Neu laden: Zwischenspeicher aus IndexedDB — nichts neu geladen (kein vollstaendiges Neuberechnen beim Start)
   D  iPhone-Breite (390 px, 3-fache Pixeldichte): kein waagerechtes Scrollen; Bildschirmfoto
   Nicht WebKit: Safari selbst ist hier nicht verfuegbar — geprueft wird IndexedDB/Layout in Chromium.
   ============================================================ */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (function () {
  const _p = require('node:path'); const _h = _p.dirname(new URL(import.meta.url).pathname);
  for (const c of [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'), _p.join(_h, '..', '..', '..')]) { try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); } catch (_e) { } }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)'); process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat;
const PW = await import('./_pw-chrome.mjs');
const CHROME = PW.chromeOrSkip(chromium);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Testbestand: echte Zeilenform der Serverliste (snake_case), erzeugt mit den Bezugs-Aktivitaeten */
globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js']) require(join(APP, f));
const GEN = await import(join(APP, 'tools', 'gen-eligibility-doc.mjs'));
const uuid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const rows = [[1, '2026-08-02', 1510, 6000], [2, '2026-08-16', 1482, 8000], [3, '2026-09-13', 1445, 12000], [4, '2026-09-27', 1419, 21200]].map(([i, d, s5, dist]) => {
  const a = GEN.referenceActivity('running', 'best');
  a.metrics.garmin.start_gmt = d + 'T06:00:00Z'; a.metrics.garmin.start_local = d + 'T08:00:00';
  a.metrics.streams.distance = [0, dist * .2, dist * .4, dist * .6, dist * .8, dist];
  const t = a.metrics.best_efforts.distance.targets; for (const k of Object.keys(t)) if (+k > dist) delete t[k]; t['5000'] = { s: s5, over_m: 2, at: 0, q: 'measured' };
  return { id: uuid(i), user_id: 'e2e', sport_id: 'running', source: 'garmin', started_at: d + 'T06:00:00.000Z', duration_seconds: 3600, status: 'completed',
           summary: Object.assign({}, a.summary, { distanceM: dist }), linked_activity_id: null, updated_at: '2026-10-01T00:00:00Z', metrics: a.metrics };
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  if (p === '/sw.js') { res.writeHead(404); res.end('kein Service Worker im Test'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URLX = 'http://127.0.0.1:' + server.address().port + '/index.html';
const browser = await PW.launchOrSkip(chromium, { executablePath: CHROME });
const shots = process.env.ORVIA_SHOTS || null;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('**api.maptiler.com/**', r => r.fulfill({ status: 403, body: 'no' }));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URLX, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const A = await page.evaluate(async () => {
    const O = window.ORVIA;
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [];
    let entry = null, direct = null;
    try { entry = gmProfBestTimes(); } catch (e) { entry = 'ERR ' + e.message; }
    try { direct = gmProfPerformanceLedger(); } catch (e) { direct = 'ERR ' + e.message; }
    return { loaded: !!(O.performanceLedger && O.performanceLedgerStore && O.recordsBridge && O.performanceLedgerView && O.performanceLedgerRepository && O.metricEligibility),
             mode: O.recordsBridge.mode(), dbs, entry: /plv-entry/.test(entry), direct: /Nicht verfügbar/.test(direct) && !/plv-card/.test(direct),
             model: O.performanceLedgerStore.model(), sync: await O.performanceLedgerStore.sync() };
  });
  ok('A1 Bausteine geladen, Bruecke off', A.loaded && A.mode === 'off', A.mode);
  ok('A2 keine IndexedDB-Datenbank des Registers angelegt', !A.dbs.includes('orvia-ledger'), A.dbs.join(','));
  ok('A3 kein Einstieg in „Bestzeiten"; Direktaufruf zeigt nichts', A.entry === false && A.direct === true);
  ok('A4 sync() ohne Flag: sofort disabled, kein Modell', A.sync && A.sync.code === 'disabled' && A.model === null);

  const B = await page.evaluate(async rows => {
    const O = window.ORVIA, R = O.performanceLedgerRepository, calls = { index: 0, fetch: [] };
    window.__calls = calls;
    R.listActivityIndex = async () => { calls.index++; return { success: true, data: { rows: rows.map(r => ({ id: r.id, updated_at: r.updated_at, linked_activity_id: null, status: 'completed' })), complete: true } }; };
    R.fetchActivities = async ids => { calls.fetch.push(ids.length); return { success: true, data: rows.filter(r => ids.includes(r.id)) }; };
    R.existingIds = async ids => ({ success: true, data: ids });
    R.apply = async () => ({ success: false, error: { code: 'table_missing' } });          // Migration 0051 noch nicht eingespielt
    R.dirtyKeys = async () => ({ success: true, data: [] });
    O.user = { id: 'e2e-user' };
    O.featureFlags._setForTest('performance_ledger', true);
    const r = await O.performanceLedgerStore.sync({ force: true });
    const dbs = (await indexedDB.databases()).map(d => d.name);
    const bt = gmProfBestTimes(), pl = gmProfPerformanceLedger();
    return { ok: r.ok, pending: r.pending, cached: r.cached, mode: O.recordsBridge.mode(), dbs, calls, entry: /plv-entry/.test(bt), page: pl.length,
             cards: (pl.match(/class="plv-card[ "]/g) || []).length, variants: (pl.match(/data-timing="/g) || []).length, herkunft: /Herkunft/.test(pl), open: /gmOpenActivityFromLedger\('00000000-0000-4000-8000-000000000004'\)/.test(pl),
             best: (O.runBests.measuredRunBests(O.activityStore.listActivities ? O.activityStore.listActivities() : []).k5 || null),
             btMode: /class="bt-mode"/.test(bt) && /aria-pressed="true"[^>]*>Aktiv</.test(bt), btAct: /Aktive Trainingsbestzeit/.test(bt), btRows: (bt.match(/bt-row/g) || []).length };
  }, rows);
  ok('B1 Flag an: gerechnet, Bruecke on', B.ok && B.mode === 'on', B.mode);
  ok('B2 Zwischenspeicher in IndexedDB (nicht localStorage)', B.cached === true && B.dbs.includes('orvia-ledger'), B.dbs.join(','));
  ok('B3 Speichern auf dem Server scheitert (0051 fehlt) → bleibt offen, App laeuft weiter', B.pending === true);
  ok('B4 Einstieg sichtbar, Seite mit Rekordkarten, Herkunft und „Aktivität öffnen"', B.entry && B.cards >= 5 && B.variants >= 6 && B.herkunft && B.open, B.cards + ' Karten, ' + B.variants + ' Zeitvarianten');
  ok('B6 Bestzeiten: Umschalter „Aktiv | Gesamtzeit" (Standard Aktiv), aktive Trainingsbestzeit benannt, Zeilenvertrag unveraendert', B.btMode && B.btAct && B.btRows === 7, B.btRows + ' bt-row');
  ok('B5 Laufbestzeiten der App kommen aus dem Register', B.best === null || B.best.method === 'ledger', JSON.stringify(B.best));

  await page.evaluate(() => {
    document.documentElement.classList.remove('orvia-gated');                       // Anmeldeschranke nur fuer das Bildschirmfoto ausblenden
    var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
    const pg = document.getElementById('gmProfPage'); if (pg) { try { showTab('mehr'); } catch (e) {} gmOpenProfPage('performanceLedger'); } });
  await page.waitForTimeout(400);
  const D = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pg: (() => { const pg = document.getElementById('gmProfPage'); return pg ? { on: pg.classList.contains('on'), vis: pg.getBoundingClientRect().width > 0 && getComputedStyle(pg).visibility !== 'hidden', w: pg.scrollWidth - pg.clientWidth, cards: pg.querySelectorAll('.plv-card').length } : null; })() }));
  ok('D1 iPhone-Breite 390 px: Seite sichtbar, kein waagerechtes Scrollen', D.overflow <= 0 && D.pg && D.pg.on && D.pg.vis && D.pg.w <= 0 && D.pg.cards >= 5, JSON.stringify(D));
  if (shots) { await page.screenshot({ path: join(shots, 'ledger-app-390.png'), fullPage: false });
    await page.evaluate(() => { const pg = document.getElementById('gmProfPage'); const d = pg && pg.querySelector('.plv-prov'); if (d) { d.open = true; d.scrollIntoView(); } });
    await page.screenshot({ path: join(shots, 'ledger-app-390-herkunft.png'), fullPage: false });
    await page.evaluate(() => { const pg = document.getElementById('gmProfPage'); try { gmCloseProfPage(); } catch (e) {} gmOpenProfPage('bestTimes'); window.scrollTo(0, 0); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shots, 'bestzeiten-390.png'), fullPage: false }); }

  /* C · neu laden: aus IndexedDB, nichts neu geladen */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const C = await page.evaluate(async rows => {
    const O = window.ORVIA, R = O.performanceLedgerRepository, calls = { index: 0, fetch: [] };
    R.listActivityIndex = async () => { calls.index++; return { success: true, data: { rows: rows.map(r => ({ id: r.id, updated_at: r.updated_at, linked_activity_id: null, status: 'completed' })), complete: true } }; };
    R.fetchActivities = async ids => { calls.fetch.push(ids.length); return { success: true, data: rows.filter(r => ids.includes(r.id)) }; };
    R.existingIds = async ids => ({ success: true, data: ids }); R.apply = async () => ({ success: true, data: {} }); R.dirtyKeys = async () => ({ success: true, data: [] });
    O.user = { id: 'e2e-user' };
    O.featureFlags._setForTest('performance_ledger', true);
    const t0 = performance.now(); const r = await O.performanceLedgerStore.sync({ force: true }); const ms = performance.now() - t0;
    return { ok: r.ok, fetched: r.meta && r.meta.fetched, added: r.changes && r.changes.added.length, calls, ms, mode: O.recordsBridge.mode() };
  }, rows);
  ok('C1 Neustart: Register aus IndexedDB, nichts neu geladen oder neu geprueft', C.ok && C.fetched === 0 && C.added === 0 && C.calls.fetch.length === 0 && C.mode === 'on', JSON.stringify(C));
  ok('C2 keine Seitenfehler', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.close(); }
console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_app_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
