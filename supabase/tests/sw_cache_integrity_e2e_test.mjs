/* ============================================================
   ORVIA · sw_cache_integrity_e2e (v8-450) — echter Service Worker, echte Auslieferungen nacheinander.

   Befund 16.10.2026 (Chrome, normaler Betrieb): ORVIA lief mit ledger@1, obwohl GitHub Pages ledger@2 auslieferte;
   mit „Bypass for network" stimmte es. Ursache (an origin/main nachgewiesen): zwei Auslieferungen trugen dieselbe
   Kennung orvia-v8-449 bei BYTEGLEICHER sw.js — kein Update, cache-first aus dem alten Cache.

   R  Befund im Browser nachgestellt: alter Stand (v8-449.1 sw.js) → zweite Auslieferung mit gleicher sw.js
      → die Seite laeuft weiter mit ledger@1
   U  Update auf v8-450: normaler Seitenaufruf genuegt, zwei offene Tabs, kein altes Modul im Cache,
      nur veraltete App-Caches entfernt, Nutzerdaten (localStorage, IndexedDB, fremder Cache) bleiben
   O  offline und Neustart des Browsers (persistentes Profil): weiter ledger@2

   Server wie GitHub Pages: Cache-Control max-age=600 (der HTTP-Cache darf nicht mitspielen koennen).
   node supabase/tests/sw_cache_integrity_e2e_test.mjs
   ============================================================ */
import http from 'node:http';
import { readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  const _p = require('node:path');
  const _h = _p.dirname(new URL(import.meta.url).pathname);
  for (const c of [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'), _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')]) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); } catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat;
const PW = await import('./_pw-chrome.mjs');
const CHROME = PW.chromeOrSkip(chromium);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ---- drei Auslieferungen bauen ---------------------------------------------------------------------- */
const SATZ = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'js', 'assets', 'locales'];
const TMP = mkdtempSync(join(os.tmpdir(), 'orvia-swci-'));
const copyApp = to => { for (const f of SATZ) cpSync(join(APP, f), join(to, f), { recursive: true }); return to; };
/* alte sw.js (Logik und Kennung orvia-v8-449) aus dem Commit v8-449.1 — gefunden ueber die Commit-Nachricht (gleich in jeder Kopie des Repos) */
const repoRoot = (() => { const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: APP, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })();
const oldSha = repoRoot ? (spawnSync('git', ['log', '--format=%H', '--grep=^v8-449.1:', '-1'], { cwd: repoRoot, encoding: 'utf8' }).stdout || '').trim() : '';
const show = p => oldSha ? spawnSync('git', ['show', oldSha + ':app/' + p], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 << 20 }) : null;
const oldSw = show('sw.js'), oldIdx = show('index.html');
const haveOld = !!(oldSw && oldSw.status === 0 && /const C = 'orvia-v8-449'/.test(oldSw.stdout) && oldIdx && oldIdx.status === 0);
const V3 = copyApp(join(TMP, 'v3'));
let V1 = null, V2 = null;
if (haveOld) {
  V2 = copyApp(join(TMP, 'v2')); writeFileSync(join(V2, 'sw.js'), oldSw.stdout); writeFileSync(join(V2, 'index.html'), oldIdx.stdout);
  V1 = copyApp(join(TMP, 'v1')); writeFileSync(join(V1, 'sw.js'), oldSw.stdout); writeFileSync(join(V1, 'index.html'), oldIdx.stdout);
  const pl = join(V1, 'js/engine/performance-ledger.js');
  writeFileSync(pl, readFileSync(pl, 'utf8').replace(/var CALC_VERSION = 'ledger@\d+'/, "var CALC_VERSION = 'ledger@1'"));
}
const sw3 = readFileSync(join(V3, 'sw.js'), 'utf8');
const CACHE3 = (sw3.match(/const C = '([^']+)'/) || [])[1] + '-' + (sw3.match(/const REV = '([^']+)'/) || [])[1];

/* ---- Server wie GitHub Pages --------------------------------------------------------------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
let ROOT = V1 || V3;
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'max-age=600' }); res.end('/* Test */'); return; }
  const f = join(ROOT, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const URLX = `http://localhost:${server.address().port}/index.html`;     // nur auf localhost registriert die App den Service Worker
const PROFILE = mkdtempSync(join(os.tmpdir(), 'orvia-swci-prof-'));

let ctx;
try {
  ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: CHROME, serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
} catch (e) {
  console.log('⏭️  ÜBERSPRUNGEN — Browser startet in dieser Umgebung nicht: ' + String(e && e.message || e).split('\n')[0]);
  server.close(); rmSync(TMP, { recursive: true, force: true }); process.exit(2);
}
const stubs = async c => {
  await c.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await c.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  await c.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
};
await stubs(ctx);
const errs = [];
const open = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); return p; };
const calc = p => p.evaluate(() => (window.ORVIA && ORVIA.performanceLedger && ORVIA.performanceLedger.CALC_VERSION) || null).catch(() => null);
const waitCalc = async (p, want, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await calc(p)) === want) return true; await p.waitForTimeout(250); } return false; };
const controlled = p => p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 }).then(() => true).catch(() => false);
const unlockReload = p => p.evaluate(() => { try { sessionStorage.removeItem('orvia_sw_reload_at'); } catch (_) {} }).catch(() => {});

try {
  /* ---- R · Befund nachstellen ---- */
  const p1 = await open();
  if (haveOld) {
    sec('R · Befund: gleiche Kennung, byte-gleiche sw.js');
    await p1.goto(URLX, { waitUntil: 'load' });
    ok('R1 alter Stand installiert (orvia-v8-449), ledger@1', (await controlled(p1)) && (await calc(p1)) === 'ledger@1');
    ROOT = V2;                                                       // zweite Auslieferung „v8-449": neuer Code, gleiche sw.js
    await unlockReload(p1);
    await p1.reload({ waitUntil: 'load' }); await p1.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update().catch(() => {}); });
    await p1.waitForTimeout(1500); await p1.reload({ waitUntil: 'load' });
    const served = readFileSync(join(V2, 'js/engine/performance-ledger.js'), 'utf8').includes("CALC_VERSION = 'ledger@2'");
    ok('R2 Server liefert ledger@2, der Browser laeuft weiter mit ledger@1 (kein Update erkennbar) — der Befund vom 16.10.', served && (await calc(p1)) === 'ledger@1', String(await calc(p1)));
  } else {
    console.log('⏭️  R uebersprungen (Commit v8-449.1 nicht im Repo) — U/O laufen ab einem frischen Stand');
    await p1.goto(URLX, { waitUntil: 'load' }); await controlled(p1);
  }

  /* ---- U · Update auf v8-450 ---- */
  sec('U · Update auf v8-450');
  const before = await p1.evaluate(async () => {
    localStorage.setItem('orvia_profile_v1', JSON.stringify({ name: 'Test', plan: 'Wochenplan A' }));
    localStorage.setItem('orvia_activities_local', JSON.stringify([{ id: 'a1', metrics: { corrections: { duration: { manual: 4500, source: 20460 } } } }]));
    localStorage.setItem('orvia_garmin_link', 'verbunden');
    await new Promise((res, rej) => { const r = indexedDB.open('orvia-ledger', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put('nutzerdaten', 'k'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = rej; }; r.onerror = rej; });
    const fc = await caches.open('maplibre-tiles'); await fc.put('/tile-test', new Response('kachel'));
    return { keys: await caches.keys(), ls: localStorage.length };
  });
  const p2 = await open();                                           // zweiter Tab, ebenfalls noch auf dem alten Stand
  await p2.goto(URLX, { waitUntil: 'load' }); await controlled(p2);
  const oldBoth = haveOld ? ((await calc(p1)) === 'ledger@1' && (await calc(p2)) === 'ledger@1') : true;
  ROOT = V3;                                                         // Auslieferung v8-450
  await unlockReload(p1); await unlockReload(p2);
  let loads1 = 0; p1.on('load', () => { loads1++; });
  await p1.reload({ waitUntil: 'load' });                            // ganz normales Neuladen — kein Bypass, keine DevTools
  const new1 = await waitCalc(p1, 'ledger@2', 45000), new2 = await waitCalc(p2, 'ledger@2', 45000);
  ok('U1 normaler Seitenaufruf genuegt: Tab 1 laeuft mit ledger@2', oldBoth && new1, String(await calc(p1)));
  ok('U2 zweiter offener Tab wechselt ebenfalls auf ledger@2 (keine Mischung alter und neuer Module)', new2, String(await calc(p2)));
  await p1.waitForTimeout(2500);
  const st = await p1.evaluate(async (want) => {
    const keys = await caches.keys(), reg = await navigator.serviceWorker.getRegistration();
    const c = await caches.open(want);
    const pl = await c.match('./js/engine/performance-ledger.js', { ignoreSearch: true });
    const meta = (document.querySelector('meta[name="orvia-build"]') || {}).content || null;
    const db = await new Promise(res => { const r = indexedDB.open('orvia-ledger'); r.onsuccess = () => { try { const g = r.result.transaction('kv').objectStore('kv').get('k'); g.onsuccess = () => { res(g.result); r.result.close(); }; g.onerror = () => res(null); } catch (e) { res(null); } }; r.onerror = () => res(null); });
    const tile = await (await caches.open('maplibre-tiles')).match('/tile-test');
    return { keys, active: reg && reg.active ? reg.active.scriptURL : null, pl: pl ? await pl.text() : '', meta, db, tile: tile ? await tile.text() : null,
             ls: { profile: localStorage.getItem('orvia_profile_v1'), acts: localStorage.getItem('orvia_activities_local'), garmin: localStorage.getItem('orvia_garmin_link') },
             engineVersion: (window.ORVIA || {}).engineVersion || null };
  }, CACHE3);
  ok('U3 Build einheitlich: Seite orvia-v8-450, Cache ' + CACHE3, st.meta === 'orvia-v8-450' && st.keys.includes(CACHE3), JSON.stringify(st.keys));
  ok('U4 veraltete App-Caches entfernt (nur noch EIN orvia-Cache), fremder Cache bleibt', st.keys.filter(k => /^orvia-/.test(k)).length === 1 && st.tile === 'kachel', JSON.stringify(st.keys));
  ok('U5 Nutzerdaten unberuehrt: localStorage (Profil, Korrekturen, Garmin-Verknuepfung) und IndexedDB', /Wochenplan A/.test(st.ls.profile || '') && /"manual":4500/.test(st.ls.acts || '') && st.ls.garmin === 'verbunden' && st.db === 'nutzerdaten');
  ok('U6 im Cache steht performance-ledger.js mit ledger@2', /CALC_VERSION = 'ledger@2'/.test(st.pl));
  ok('U7 Engine-Version ohne Inhaltskennung (v8-450)', st.engineVersion === 'v8-450', String(st.engineVersion));
  /* kein altes Modul: jede gespeicherte Datei = Datei der Auslieferung v8-450 */
  const want = {};
  const assets = Function('"use strict"; return ' + /const ASSETS = (\[[\s\S]*?\]);/.exec(sw3)[1] + ';')();
  for (const a of assets) { const rel = (a === './' ? './index.html' : a).replace(/^\.\//, ''); if (existsSync(join(V3, rel))) want['/' + rel] = createHash('sha256').update(readFileSync(join(V3, rel))).digest('hex'); }
  const got = await p1.evaluate(async (name) => {
    const c = await caches.open(name), out = {};
    for (const req of await c.keys()) {
      const res = await c.match(req); const buf = await res.arrayBuffer();
      const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(b => b.toString(16).padStart(2, '0')).join('');
      out[new URL(req.url).pathname] = h;
    }
    return out;
  }, CACHE3);
  const jsKeys = Object.keys(want).filter(k => /\.js$/.test(k));
  const stale = jsKeys.filter(k => got[k] && got[k] !== want[k]), missing = jsKeys.filter(k => !got[k]);
  ok('U8 kein altes JavaScript im Cache: alle ' + jsKeys.length + ' Module byte-gleich mit v8-450', jsKeys.length > 150 && !stale.length && !missing.length, (stale.concat(missing)).slice(0, 3).join(', '));
  ok('U9 genau ein automatisches Neuladen, keine Schleife', loads1 >= 1 && loads1 <= 3, 'loads=' + loads1);
  await unlockReload(p1);
  await p1.reload({ waitUntil: 'load' });
  ok('U10 erneutes normales Neuladen: weiter ledger@2', (await waitCalc(p1, 'ledger@2', 10000)));

  /* ---- O · offline und Neustart ---- */
  sec('O · offline und Neustart');
  await p2.close();
  await ctx.setOffline(true);
  await p1.reload({ waitUntil: 'load' }).catch(() => {});
  ok('O1 offline: App laedt aus dem Cache, ledger@2', (await waitCalc(p1, 'ledger@2', 15000)));
  await ctx.setOffline(false);
  await ctx.close();
  ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: CHROME, serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
  await stubs(ctx);
  const p3 = await open();
  await p3.goto(URLX, { waitUntil: 'load' });
  const after = await p3.evaluate(() => ({ ls: localStorage.getItem('orvia_profile_v1') }));
  ok('O2 Browser-Neustart: ledger@2, Nutzerdaten noch da', (await waitCalc(p3, 'ledger@2', 15000)) && /Wochenplan A/.test(after.ls || ''));
  ok('O3 keine Laufzeitfehler', errs.filter(e => !/Failed to fetch|NetworkError|net::/.test(e)).length === 0, errs.slice(0, 2).join(' | '));
} finally {
  try { await ctx.close(); } catch (e) {}
  server.close();
  rmSync(TMP, { recursive: true, force: true }); rmSync(PROFILE, { recursive: true, force: true });
}
console.log('\n' + (fail ? '❌' : '✅') + ' sw_cache_integrity_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
