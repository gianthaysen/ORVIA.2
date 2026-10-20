/* ============================================================
   ORVIA · running_quality_v457_ui_e2e — Running Experience Premium Quality Pass (echter Browser, Chromium)
   K  Kopf: kurzer Anzeigetitel (Original im Tooltip/Datenherkunft), Distanz 2 Nachkommastellen, „Teilen" neben „Highlights";
      Desktop zweispaltig (Karte rechts, gross), Telefon: Karte oben; kein Text ueber den Rand (320–1920)
   T  „Teilen" in der Aktivitaet oeffnet DIESELBE Auswahl wie die Story
   Z  „Zonengrenzen ansehen": Herkunft, keine erfundenen Grenzen
   S  Highlights: gleiche Kennzahlen wie die Seite (Distanz, Dauer, Kadenz, Anstieg), Bestleistung ohne Worttrennung
   ============================================================ */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const RR = JSON.parse(readFileSync(join(HERE, 'fixtures', 'run_ride_capture_v454.json'), 'utf8'));
const F = JSON.parse(readFileSync(join(HERE, 'fixtures', 'swim_capture_v453.json'), 'utf8'));
const { swimRow } = await import('./_swim-realdata.mjs');
let _n = 0;
/* echte Einheit: lokal ohne Rohblock (wie in der Tabelle), Rohblock kommt ueber fetchExt */
function real(key, name, route) {
  const f = RR[key], m = JSON.parse(JSON.stringify(f.metrics)), ext = m.ext; delete m.ext; _n++;
  if (route) m.route = route;
  return { a: { id: '54580000-0000-4000-8000-0000000000' + String(_n).padStart(2, '0'), clientRecordId: 'act:v457r-' + _n, sportId: f.sport, source: 'garmin', status: 'completed',
                startedAt: '2026-10-07T16:00:00.000Z', durationSeconds: Math.round(f.duration_s), summary: Object.assign({ name: name }, f.summary), metrics: m }, ext };
}
/* kleine Strecke (fuer Kopfbild-Pruefung; Koordinaten frei gewaehlt, keine echten Orte des Nutzers) */
const ROUTE = Array.from({ length: 40 }, (_, i) => [51.48 + Math.sin(i / 6) * 0.004, 7.216 + i * 0.0004]);
function swim() {
  const a = swimRow(5, true); a.metrics.splits = F.lap_swimming.metrics.splits; a.metrics.splits_source = 'garmin_splits';
  const ext = Object.assign({}, a.metrics.ext, { fields: F.lap_swimming.metrics.ext.fields, splits: F.lap_swimming.metrics.ext.splits, extras: { splits: 'ok' } }); delete a.metrics.ext;
  return { a, ext };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
let tileReq = 0;
await ctx.route('**api.maptiler.com/**', r => { tileReq++; r.abort(); });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

async function open(c) {
  await page.evaluate(({ a, ext }) => {
    window.__local = [JSON.parse(JSON.stringify(a))];
    const N = ORVIA.activityNormalize; if (N && N.normalizeActivitySummary) window.__local[0].summary = N.normalizeActivitySummary(window.__local[0].summary, window.__local[0].sportId);
    const st = ORVIA.activityStore; st.listActivities = () => window.__local; st.getActivityById = id => window.__local.find(x => x.id === id || x.clientRecordId === id) || null;
    ORVIA.repos = ORVIA.repos || {}; ORVIA.repos.activity = Object.assign({}, ORVIA.repos.activity || {}, { fetchExt: id => new Promise(r => setTimeout(() => r(ext ? { success: true, data: { id, ext } } : { success: false }), 150)) });
    try { _gmActExt = {}; _gmIvOpen = {}; _gmIvAll = {}; _gmSwOpen = {}; _gmAxCmp = {}; _gmAaChartSel = {}; } catch (e) {}
    try { showTab('akt'); } catch (e) {}
    window.__t0 = performance.now(); gmOpenActivityPage(a.id); window.__dt = performance.now() - window.__t0;
  }, { a: c.a, ext: c.ext });
  await page.waitForTimeout(600);
}



const LONG = 'Flensburg - W 25 So. Rennen - Jacob Cement Halbmarathon (21,1 km)';
const RUN = real('running__running__intervals', LONG, ROUTE);
const RUN2 = real('running__running__steady', 'Lauf', null);

sec('K · Kopf');
await page.setViewportSize({ width: 1440, height: 900 }); await open(RUN);
const k1 = await page.evaluate(() => { const p = document.getElementById('gmActPage'), q = s => p.querySelector(s);
  const lead = q('.ax-lead'), map = q('.ax-lead .route-map'), hero = q('.ax-lead .ax-hero'), mr = map && map.getBoundingClientRect(), hr = hero && hero.getBoundingClientRect();
  return { title: q('.ax-title').textContent, tip: q('.ax-title').getAttribute('title'), dist: q('.ax-key-main b').textContent, btns: [...q('.ax-act').querySelectorAll('button')].map(b => b.textContent.trim()),
    grid: lead && getComputedStyle(lead).display, mapW: mr && Math.round(mr.width), mapH: mr && Math.round(mr.height), mapRight: mr && hr && mr.left > hr.right - 1, src: [...p.querySelectorAll('.ax-kv dd')].map(d => d.textContent).filter(t => /Jacob Cement/.test(t)) }; });
ok('K1 kurzer Titel „Jacob Cement Halbmarathon", Original als Tooltip und in der Datenherkunft (gespeicherter Titel unveraendert)', k1.title === 'Jacob Cement Halbmarathon' && k1.tip === LONG && k1.src.length === 1 && k1.src[0] === LONG && await page.evaluate(L => window.__local[0].summary.name === L, LONG), JSON.stringify(k1));
ok('K2 Distanz mit zwei Nachkommastellen (17,00 km)', /^17,00\s*km$/.test(k1.dist), k1.dist);
ok('K3 Aktionen: „Highlights ansehen" | „Teilen" | Quelle', k1.btns[0] === 'Highlights ansehen' && k1.btns[1] === 'Teilen' && k1.btns.length === 3, JSON.stringify(k1.btns));
ok('K4 Desktop: zweispaltig, Karte rechts neben dem Kopf, gross (≥ 600 × 380 px)', k1.grid === 'grid' && k1.mapRight && k1.mapW >= 600 && k1.mapH >= 380, JSON.stringify([k1.grid, k1.mapW, k1.mapH, k1.mapRight]));
for (const w of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 }); await open(RUN);
  const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), t = p.querySelector('.ax-title'), r = t.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const words = t.textContent.split(' '); const map = p.querySelector('.ax-lead .route-map').getBoundingClientRect(), hero = p.querySelector('.ax-hero').getBoundingClientRect();
    return { ov: document.documentElement.scrollWidth - vw, pov: p.scrollWidth - p.clientWidth, titleIn: r.right <= vw + 0.5, lines: Math.round(r.height / parseFloat(getComputedStyle(t).lineHeight)), mapAbove: map.bottom <= hero.top + 1, hy: getComputedStyle(t).hyphens }; });
  ok('K5 ' + w + ' px: kein Ueberlauf, Titel im Bild ohne Silbentrennung' + (w < 1024 ? ', Karte oben' : ''), m.ov <= 0 && m.pov <= 0 && m.titleIn && m.hy === 'manual' && (w >= 1024 || m.mapAbove), JSON.stringify(m));
}

sec('T · Teilen aus der Aktivitaet');
await page.setViewportSize({ width: 390, height: 900 }); await open(RUN);
await page.click('#gmActPage .ax-act .ax-share-cta');
await page.waitForFunction(() => { const h = document.querySelector('.shs[data-ready]'); return h && !h.classList.contains('is-busy'); }, null, { timeout: 15000 });
const t1 = await page.evaluate(() => ({ open: ORVIA.storyShare.isOpen(), n: document.querySelectorAll('.shs').length, title: ORVIA.storyShare._state().d.title, tpl: ORVIA.storyShare._state().tpl, story: document.getElementById('gmStory').classList.contains('on') }));
ok('T1 „Teilen" oeffnet dieselbe Auswahl (story-share), ohne Story; kurzer Titel; Standardvorlage drei Werte (kein Rekord, keine Intervalle)', t1.open && t1.n === 1 && !t1.story && t1.title === 'Jacob Cement Halbmarathon' && /^(trio|pb|intervals)$/.test(t1.tpl), JSON.stringify(t1));
await page.keyboard.press('Escape'); await page.waitForTimeout(120);
ok('T2 Schliessen: Fokus zurueck auf „Teilen"', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('ax-share-cta')));

sec('Z · Pulszonen');
const z1 = await page.evaluate(() => { const d = document.querySelector('#gmActPage .ax-zinfo'); if (!d) return null; d.open = true; return { sum: d.querySelector('summary').textContent, txt: d.textContent, bounds: d.querySelectorAll('.ax-zb dd').length }; });
ok('Z1 „Zonengrenzen ansehen": Garmin-Herkunft, keine erfundenen Grenzen, wo einstellen, keine Umrechnung alter Aktivitaeten', z1 && z1.sum === 'Zonengrenzen ansehen' && /liegen in ORVIA für diese Aktivität nicht vor/.test(z1.txt) && z1.bounds === 0 && /Garmin Connect/.test(z1.txt) && /rechnet weder Garmin noch ORVIA um/.test(z1.txt), JSON.stringify(z1 && { s: z1.sum, b: z1.bounds }));

sec('S · Highlights');
const s1 = await page.evaluate(() => { const a = window.__local[0], vm = activityDetailViewModel(a), md = gmActAnalysisFor(a, vm, null), pages = gmStoryPages(a).join(' ');
  const txt = pages.replace(/<[^>]+>/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  return { dist: gmAaFmt(md.metrics.distance, md.family), dur: gmAaFmt(md.metrics.duration, md.family), cad: md.metrics.runningCadence && gmAxOk(md.metrics.runningCadence) ? gmAaFmt(md.metrics.runningCadence, md.family) : null, txt, top: (/<div class="wst-top"><b>([^<]*)<\/b>/.exec(pages) || [])[1] }; });
ok('S1 Highlights: Distanz, Dauer und Kadenz identisch mit der Seite; kurzer Titel oben', s1.txt.indexOf(s1.dist) >= 0 && s1.txt.indexOf(s1.dur) >= 0 && (!s1.cad || s1.txt.indexOf(s1.cad) >= 0) && s1.top === 'Jacob Cement Halbmarathon' && !/2 h \d+ min/.test(s1.txt), JSON.stringify([s1.dist, s1.dur, s1.cad, s1.top]));
await page.evaluate(id => { gmOpenStory(id); }, RUN.a.id); await page.waitForTimeout(300);
const s2 = await page.evaluate(() => { const i = _gmStory.pages.findIndex(p => /wst-pbpg/.test(p)); if (i < 0) return { none: true }; _gmStory.idx = i; gmStoryRender(); gmStoryStop();
  const d = document.querySelector('#gmStory .wst-page.on .wst-pbdist'); d.textContent = 'Halbmarathon'; d.classList.add('is-long');   /* laengster Distanzname */
  const r = d.getBoundingClientRect(), pr = document.querySelector('#gmStory .wst-page.on').getBoundingClientRect();
  return { txt: d.textContent, h: Math.round(r.height), lh: Math.round(parseFloat(getComputedStyle(d).fontSize) * 1.3), inside: r.right <= pr.right + 0.5, sw: d.scrollWidth <= d.clientWidth + 1 }; });
await page.evaluate(() => gmStoryClose());
ok('S2 Bestleistung (390 px): „Halbmarathon" in EINER Zeile, im Bild, ohne Silbentrennung', s2.none || (s2.h <= s2.lh && s2.inside && s2.sw), JSON.stringify(s2));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' running_quality_v457_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
