/* ============================================================
   ORVIA · sw_cache_integrity (v8-450) — Regeln der Cache-Kennung, ohne Browser (laeuft ueberall).
   Zwei Auslieferungen mit derselben Kennung und byte-gleicher sw.js liessen Chrome alte Module aus dem
   Service-Worker-Cache ausliefern (ledger@1 statt ledger@2). Diese Pruefungen halten die Ursache zu.
   K  Kennung: Build einheitlich (sw.js / index.html), Inhaltskennung REV passt zum Inhalt
   L  Lebenszyklus (Simulation des Handlers): nur eigener Cache, nur veraltete App-Caches loeschen,
      Navigation am HTTP-Cache vorbei
   ============================================================ */
import { readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const APP = new URL(_APPREL, import.meta.url).pathname;
const GEN = await import(new URL(_APPREL + 'tools/gen-sw-rev.mjs', import.meta.url));
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const sw = readFileSync(join(APP, 'sw.js'), 'utf8'), idx = readFileSync(join(APP, 'index.html'), 'utf8');
const C = (sw.match(/const C = '([^']+)'/) || [])[1], REV = (sw.match(/const REV = '([^']+)'/) || [])[1];

sec('K · Kennung');
{
  const meta = (idx.match(/name="orvia-build" content="([^"]+)"/) || [])[1];
  ok('K1 Build ab v8-450, in sw.js und index.html gleich', /^orvia-v8-(\d+)$/.test(C) && Number(C.slice(9)) >= 450 && meta === C, C + ' / ' + meta);
  ok('K2 Build-Nummer steht genau einmal in sw.js (keine zweite, vergessene Kennung)', (sw.match(/orvia-v8-\d+/g) || []).length === 1);
  const r = GEN.computeRev(APP);
  ok('K3 Inhaltskennung REV passt zum Inhalt aller vorab gespeicherten Dateien (sonst: node app/tools/gen-sw-rev.mjs)', REV === r.rev && !r.missing.length && r.files > 150, REV + ' / ' + r.rev + ' (' + r.files + ' Dateien)');
  ok('K4 Cache-Name = Build + Inhaltskennung', /const CACHE = C \+ '-' \+ REV;/.test(sw));
  /* REV reagiert auf JEDE ausgelieferte Datei — genau der Fall vom 16.10. (nur performance-ledger.js geaendert) */
  const tmp = mkdtempSync(join(os.tmpdir(), 'orvia-rev-'));
  try {
    for (const f of ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'js', 'assets', 'locales']) cpSync(join(APP, f), join(tmp, f), { recursive: true });
    const p = join(tmp, 'js/engine/performance-ledger.js');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/ledger@2/, 'ledger@1'));
    const r2 = GEN.computeRev(tmp);
    writeFileSync(join(tmp, 'locales/de.js'), readFileSync(join(tmp, 'locales/de.js'), 'utf8') + '\n');
    const r3 = GEN.computeRev(tmp);
    ok('K5 eine geaenderte Zeile in performance-ledger.js ⇒ andere Kennung ⇒ andere sw.js-Bytes ⇒ Browser-Update', r2.rev !== r.rev && r3.rev !== r2.rev);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  const dep = readFileSync(join(APP, 'tools/deploy.sh'), 'utf8');
  ok('K6 deploy.sh verweigert eine schon live stehende Build-Nummer mit anderem Inhalt und eine veraltete Kennung', /\[ "\$LIVE_BUILD" != "\$BUILD" \] \|\| ende/.test(dep) && /gen-sw-rev\.mjs --check/.test(dep));
}

sec('L · Lebenszyklus (Handler-Simulation)');
{
  const H = {}, deleted = [], opened = [], fetched = [];
  const store = {};
  const mkCache = name => ({ match: async (req) => { opened.push(['match', name]); return store[name] && store[name][typeof req === 'string' ? req : req.url] || null; },
                             put: async (k, v) => { (store[name] || (store[name] = {}))[typeof k === 'string' ? k : k.url] = v; }, add: async () => {} });
  const g = {
    self: { addEventListener: (t, fn) => { H[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => { g.claimed = true; } }, location: { origin: 'https://x' } },
    caches: { open: async n => { opened.push(['open', n]); return mkCache(n); }, keys: async () => ['orvia-v8-449', 'orvia-v8-448', 'maplibre-tiles', C + '-' + REV, 'workbox-precache', 'orvia-test-1-abc'],
              delete: async k => { deleted.push(k); return true; }, match: async () => { throw new Error('caches.match (alle Caches) darf nicht mehr benutzt werden'); } },
    Request: class { constructor(u, init) { this.url = typeof u === 'string' ? u : u.url; this.mode = (u && u.mode) || 'cors'; this.cache = (init && init.cache) || 'default'; this.method = 'GET'; } },
    Response: { error: () => 'ERR' },
    fetch: async (r, init) => { fetched.push({ url: typeof r === 'string' ? r : r.url, cache: (init && init.cache) || (r && r.cache) }); return { ok: true, type: 'basic', redirected: false, clone() { return this; } }; }
  };
  new Function('self', 'caches', 'Request', 'Response', 'fetch', sw)(g.self, g.caches, g.Request, g.Response, g.fetch);
  let p; H.activate({ waitUntil: x => { p = x; } }); await p;
  ok('L1 Aktivieren loescht NUR veraltete App-Caches (Praefix orvia-), nie den aktuellen, nie fremde', deleted.sort().join() === ['orvia-test-1-abc', 'orvia-v8-448', 'orvia-v8-449'].sort().join() && g.claimed, deleted.join());
  let resp;
  await H.fetch({ request: { method: 'GET', url: 'https://x/js/engine/performance-ledger.js', mode: 'no-cors' }, respondWith: x => { resp = x; } }); await resp;
  ok('L2 Module nur aus dem EIGENEN Cache (' + C + '-' + REV + '), nie aus irgendeinem', opened.some(([t, n]) => t === 'match' && n === C + '-' + REV) && opened.filter(([t]) => t === 'match').every(([, n]) => n === C + '-' + REV));
  ok('L3 Nachladen eines fehlenden Moduls am HTTP-Cache vorbei (no-cache)', fetched.some(f => /performance-ledger\.js/.test(f.url) && f.cache === 'no-cache'));
  fetched.length = 0;
  await H.fetch({ request: { method: 'GET', url: 'https://x/index.html', mode: 'navigate' }, respondWith: x => { resp = x; } }); await resp;
  ok('L4 Navigation (index.html) am HTTP-Cache vorbei — keine alte Skriptliste zu neuen Modulen', fetched.length === 1 && fetched[0].cache === 'no-cache');
  ok('L5 kein Eingriff in Nutzerdaten: sw.js kennt weder indexedDB noch localStorage noch Clear-Site-Data', !/indexedDB|localStorage|Clear-Site-Data|clearSiteData/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log('\n' + (fail ? '❌' : '✅') + ' sw_cache_integrity: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
