/* ORVIA · route_map_gl_e2e (v8-440) — die auf dem Geraet gezeichnete Karte im ECHTEN Browser.

   Gians Auftrag 5.10.: eigene ORVIA-Karte, scharf, Strecke als Held; die bisherige Technik
   bleibt Rueckfall. Geprueft wird die echte App (echter Store, echte Aktivitaetsseite, echte
   Story, echte Bibliothek) gegen KUNST-KARTENDATEN im Datenschema des Stils (_mvt.mjs:
   „Hauptstrassen" exakt auf dem 0,001°-Gradnetz, eine Waldflaeche, ein Gebaeude):
     · Kartenfeld: gezeichnete Karte statt Bildkacheln, volle Pixeldichte (dreifach),
       Anfragen nur an die Kartendaten, Lage der Karte gegen UNABHAENGIG gerechnete Stellen
       am Bildschirm (Strasse / Land / Wald in den Farben des ORVIA-Stils)
     · Story: dieselbe Karte wird beim Zurueckblaettern wieder eingesetzt (keine Anfrage)
     · Kartenansicht: Strecke als Ebene der Karte in der Farbe der Sportart, Start gruen,
       Ziel rot, Knoepfe, Tastatur, Ziehen, Rad; Schliessen gibt die Zeichenflaeche frei
     · Rueckfall: Kartendaten kommen nicht / Bibliothek nicht ladbar ⇒ Strecke ohne Karte,
       Pause; kein WebGL ⇒ automatisch Bildkacheln
   NICHT geprueft sind damit: der echte Anbieter (am 5.10. von der Live-Seite aus von Hand
   geprueft) und Safari auf dem iPhone.

   node supabase/tests/route_map_gl_e2e_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gridTile } from './_mvt.mjs';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil — fehlt es,
     ist das ein UEBERSPRUNGEN (exit 2), nie ein Crash und nie ein stilles Gruen. */
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
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
let LIBFAIL = false;
/* ausgeliefert wird die ECHTE map-config.js — ersetzt wird nur der Schluessel */
const cfgFile = () => { const s0 = readFileSync(join(APP, 'js', 'map-config.js'), 'utf8'); if (!/key: '[A-Za-z0-9]*'/.test(s0) || !/engine: 'vector',/.test(s0)) throw new Error('map-config.js hat eine unerwartete Form'); return s0.replace(/key: '[A-Za-z0-9]*'/, "key: 'TESTKEY'"); };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  if (p === '/js/map-config.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' }); res.end(cfgFile()); return; }
  if (LIBFAIL && /maplibre-gl\.js$/.test(p)) { res.writeHead(404); res.end('nf'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port, ORIGIN = `http://127.0.0.1:${PORT}`;
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME });

/* Sollfarben des ORVIA-Stils (rgb) */
const LAND = [14, 23, 33], ROAD = [65, 84, 102], ROAD_SEC = [52, 69, 85], ROAD_MINOR = [43, 57, 71], NATURE = [17, 26, 36], BUILDING = [26, 39, 52], WARM = [58, 50, 43];
/* zwei Strassen anderer Raenge, oestlich der Strecke zwischen den Gitterlinien (Karte V2: drei Strassenraenge) */
const LINES = [{ cls: 'secondary', pts: [[51.4700, 7.2265], [51.4900, 7.2265]] }, { cls: 'minor', pts: [[51.4700, 7.2275], [51.4900, 7.2275]] }];
const RUN = [255, 154, 92], START = [67, 214, 158], FINISH = [255, 100, 100], BASE = [5, 9, 16];
const near = (a, b, t) => !!a && Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t && Math.abs(a[2] - b[2]) <= t;
const lonX = lon => (lon + 180) / 360, latY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const WOOD = [[51.4835, 7.2205], [51.4835, 7.2235], [51.4812, 7.2235], [51.4812, 7.2205]];
const HOUSE = [[51.4806, 7.2172], [51.4806, 7.2188], [51.4802, 7.2188], [51.4802, 7.2172]];
const DPR = 3;

async function boot(mode) {
  LIBFAIL = mode === 'nolib';
  const st = { fail: false };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, hasTouch: true, reducedMotion: 'reduce' });
  if (mode === 'nowebgl') await ctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t) { return /webgl/i.test(String(t)) ? null : g.apply(this, arguments); }; });
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const reqs = [];
  await ctx.route('**api.maptiler.com/**', r => { const u = new URL(r.request().url()); reqs.push({ path: u.pathname, key: u.searchParams.get('key'), ref: r.request().headers()['referer'] || '' });
    if (/logo\.svg/.test(u.pathname)) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12"/>' });
    const v = /^\/tiles\/v3\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(u.pathname);
    if (v) return st.fail ? r.fulfill({ status: 403, body: 'no' }) : r.fulfill({ contentType: 'application/x-protobuf', body: gridTile(+v[1], +v[2], +v[3], { step: 0.001, wood: WOOD, building: HOUSE, lines: LINES }) });
    if (/^\/fonts\//.test(u.pathname)) return r.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
    if (/^\/maps\//.test(u.pathname)) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" preserveAspectRatio="none"><rect width="512" height="512" fill="rgb(44,44,44)"/></svg>' });
    return r.fulfill({ status: 404, body: 'nf' }); });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    document.documentElement.classList.remove('orvia-gated');
    var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
    const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
    const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);
    window.__route = route;
    const hr = []; for (let k = 0; k < 600; k++) hr.push(Math.round(134 + 10 * Math.sin(k / 40)));
    ORVIA.activityStore.mergeServerActivities([{ id: 'gl-r1', sport_id: 'running', source: 'garmin', source_record_id: 'gl-r1', started_at: todayStr() + 'T15:12:00.000Z', duration_seconds: 2160, status: 'completed',
      summary: { distance_m: 3330, avgHr: 140, maxHr: 161 }, metrics: { route: route, hasRoute: true, streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' } } }]);
  });
  const tiles = () => reqs.filter(q => /^\/tiles\/v3\//.test(q.path));
  const raster = () => reqs.filter(q => /^\/maps\//.test(q.path));
  const openPage = async (ms) => { await page.evaluate(async (ms) => { showTab('akt'); await new Promise(r => setTimeout(r, 200)); gmOpenActivityPage('gl-r1'); await new Promise(r => setTimeout(r, ms || 1900)); }, ms); };
  /* Farben am Bildschirm: ein Bildschirmfoto, im Browser dekodiert; pts = [[x,y] in CSS-px] */
  const pixels = async (pts) => { const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
    return page.evaluate(async ([b64, pts, dpr]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); return pts.map(p => Array.from(x.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data).slice(0, 3)); }, [b64, pts, DPR]); };
  const field = () => page.evaluate(() => { const el = document.querySelector('#gmActPage .route-map'); if (!el) return null; const b = el.getBoundingClientRect(), cv = el.querySelector('canvas'), box = el.querySelector('.rmx-glbox');
    const v = ORVIA.routeMap.fit(window.__route, el.clientWidth, el.clientHeight, GM_ACT_MAP_PAD, 512);
    return { cls: el.className, box: [b.left, b.top, b.width, b.height], gl: !!el.querySelector('.rmx-tiles.rmx-gl'), imgs: el.querySelectorAll('img.rmx-t').length, canvas: cv ? [cv.width, cv.height, cv.clientWidth, cv.clientHeight] : null, ok: !!(box && box.classList.contains('ok')),
      opacity: box ? getComputedStyle(box).opacity : null, engine: ORVIA.routeMap.cfg().engine, oldSvg: !!el.querySelector('svg.rmap'), rmx: !!el.querySelector('.rmx'), view: v ? { ox: v.ox, oy: v.oy, world: v.world } : null,
      attr: (el.querySelector('.rmx-attr span') || {}).textContent || '', paused: ORVIA.routeMap.paused(), stats: ORVIA.routeMapGL.stats(), dim: el.querySelector('.rmx-tiles') ? getComputedStyle(el.querySelector('.rmx-tiles'), '::before').backgroundColor : null }; });
  return { ctx, page, reqs, tiles, raster, errs, st, openPage, pixels, field };
}

/* ══════════ 1 · Kartenfeld der Aktivitaetsseite ══════════ */
{
  const B = await boot('ok'); const { page } = B;
  await B.openPage();
  const f = await B.field();
  sec('Kartenfeld: gezeichnete Karte');
  ok('A1 im Kartenfeld steht die auf dem Geraet gezeichnete Karte (keine Bildkachel), eingeblendet; das Feld oeffnet weiter die Kartenansicht', !!f && f.engine === 'vector' && f.gl === true && f.imgs === 0 && !!f.canvas && f.ok === true && f.opacity === '1' && /has-rmx/.test(f.cls) && /can-open/.test(f.cls), JSON.stringify(f && [f.engine, f.gl, f.imgs, f.canvas, f.ok, f.cls]));
  ok('A2 Schaerfe: Zeichenflaeche in der vollen Pixeldichte des Geraets (hier dreifach: 390 × 255 → 1170 × 765 Bildpunkte)', !!f && !!f.canvas && f.canvas[0] === 390 * DPR && f.canvas[1] === 255 * DPR && f.canvas[2] === 390 && f.canvas[3] === 255, JSON.stringify(f && f.canvas));
  const t = B.tiles();
  ok('A3 Anfragen: nur Kartendaten (hoechstens 4), KEINE Bildkachel; jede mit Schluessel; mitgeschickt wird nur die Herkunft der Seite', t.length >= 1 && t.length <= 4 && B.raster().length === 0 && t.every(q => q.key === 'TESTKEY' && q.ref === ORIGIN + '/'), JSON.stringify([t.length, B.raster().length, t[0] && t[0].ref]));
  ok('A4 Quellenhinweis des Anbieters bleibt sichtbar; kein Schleier ueber der eigenen Karte', /MapTiler/.test(f.attr) && /OpenStreetMap/.test(f.attr) && /rgba\(5, 8, 13, 0\)|rgba\(0, 0, 0, 0\)/.test(String(f.dim)), JSON.stringify([f.attr, f.dim]));
  /* Lage: unabhaengig gerechnete Bildschirmstellen (Ausschnitt der Strecke aus route-map.fit) */
  const at = (lat, lon) => [f.box[0] + lonX(lon) * f.view.world - f.view.ox, f.box[1] + latY(lat) * f.view.world - f.view.oy];
  const P = { road: at(51.4835, 7.2120), land: at(51.4835, 7.2125), wood: at(51.48275, 7.22225), road2: at(51.4840, 7.21275), sec: at(51.4825, 7.2265), minor: at(51.4825, 7.2275) };
  const px = await B.pixels([P.road, P.land, P.wood, P.road2, P.sec, P.minor]);
  ok('A5 Lage der Karte: an der unabhaengig gerechneten Stelle einer Gitterstrasse (Laenge 7,2120°) liegt Strassenfarbe, 0,0005° daneben Landfarbe', near(px[0], ROAD, 7) && near(px[1], LAND, 5), JSON.stringify([P.road.map(v => +v.toFixed(1)), px[0], px[1]]));
  ok('A5a … ebenso auf einer waagerechten Gitterstrasse (Breite 51,4840°) — beide Achsen stimmen', near(px[3], ROAD, 7), JSON.stringify([P.road2.map(v => +v.toFixed(1)), px[3]]));
  ok('A5b drei Strassenraenge am Bildschirm: Verbindungsstrasse und Nebenstrasse je in ihrem Ton — Haupt > Verbindung > Neben > Land (Helligkeit)', near(px[4], ROAD_SEC, 7) && near(px[5], ROAD_MINOR, 7) && px[0][1] > px[4][1] + 5 && px[4][1] > px[5][1] + 5 && px[5][1] > px[1][1] + 20, JSON.stringify([px[0], px[4], px[5], px[1]]));
  /* Rest-Gruen: Natur hat den Farbton des Landes — das Verhaeltnis Blau : Gruen ist gleich (± 4 %), in der ersten Fassung lag Natur 12 % daneben */
  const bg = c => c[2] / c[1];
  ok('A6 Wald traegt den Natur-Ton des ORVIA-Stils — kein Gruen (Blau > Gruen) und kein Olivstich: Blau : Gruen wie beim Land (± 4 %)', near(px[2], NATURE, 4) && px[2][2] > px[2][1] && Math.abs(bg(px[2]) / bg(px[1]) - 1) <= 0.04 && Math.abs(bg([16, 25, 29]) / bg(LAND) - 1) > 0.1, JSON.stringify([px[2], +bg(px[2]).toFixed(3), +bg(px[1]).toFixed(3)]));
  /* Karte V2.1: warme Unterlage der Hauptstrassen ist am Bildschirm vorhanden — und nirgends im Kartenfeld entsteht Oliv.
     Auswertung der oberen 60 % des Felds (dort deckt die Karte voll). Oliv/Khaki = Gruen > Rot > Blau (gelbgruen);
     Start-Ring (Gruen > Blau > Rot) und Strecke (Rot > Gruen > Blau, hell) fallen nicht darunter. */
  { const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
    const st2 = await page.evaluate(async ([b64, box, dpr, warm]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const x0 = Math.round(box[0] * dpr), y0 = Math.round(box[1] * dpr), w = Math.round(box[2] * dpr), h = Math.round(box[3] * 0.6 * dpr); const d = x.getImageData(x0, y0, w, h).data; let n = 0, nWarm = 0, olive = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], bl = d[i + 2]; n++; if (Math.abs(r - warm[0]) <= 7 && Math.abs(g - warm[1]) <= 7 && Math.abs(bl - warm[2]) <= 7 && r > g && g > bl) nWarm++; if (g > r + 2 && r > bl + 2) olive++; }
      return { n, nWarm, olive }; }, [b64, f.box, DPR, WARM]);
    ok('A5c warme Unterlage: entlang der Hauptstrassen liegt der Bronze-Ton (58,50,43) am Bildschirm — als feiner Rand (zwischen 0,2 % und 6 % der Kartenflaeche), nicht als Flaeche', st2.nWarm / st2.n > 0.002 && st2.nWarm / st2.n < 0.06, JSON.stringify(st2));
    ok('A5d kein Oliv/Khaki im Kartenfeld: kein einziger Bildpunkt mit Gruen > Rot > Blau', st2.olive === 0, JSON.stringify(st2)); }
  /* Uebergang Karte → Inhalt: am unteren Rand des Felds darf kein Sprung stehen (bis v8-440: abgeschnittener Schein, 25 Stufen) */
  { const yb = f.box[1] + f.box[3]; const xs = [f.box[0] + f.box[2] * 0.25, f.box[0] + f.box[2] * 0.5, f.box[0] + f.box[2] * 0.75];
    const e = await B.pixels(xs.map(x => [x, yb - 1.5]).concat(xs.map(x => [x, yb + 2])));
    const step = Math.max(...[0, 1, 2].map(i => Math.max(...[0, 1, 2].map(c => Math.abs(e[i][c] - e[i + 3][c])))));
    ok('A6a Uebergang Karte → Inhalt ohne Kante: unterste Zeile des Kartenfelds und die Seite darunter unterscheiden sich um hoechstens 3 Helligkeitsstufen (drei Stellen)', step <= 3, JSON.stringify([e.slice(0, 3), e.slice(3), step]));
    /* der Schein allein (Karte und Strecke fuer die Messung ausgeblendet) */
    await page.evaluate(() => { document.querySelector('#gmActPage .route-map .rmx').style.visibility = 'hidden'; });
    const mid = await B.pixels([[f.box[0] + f.box[2] * 0.5, f.box[1] + f.box[3] * 0.80], [f.box[0] + 4, f.box[1] + f.box[3] * 0.80]]);
    await page.evaluate(() => { document.querySelector('#gmActPage .route-map .rmx').style.visibility = ''; });
    ok('A6b im auslaufenden Teil liegt ein leiser, warmer Schein (Gold + Farbe der Sportart): Mitte 25…55 Stufen waermer als der Rand (v8-441: 22), Zuwachs Rot > Gruen ≥ Blau — kein Gruen', mid[0][0] - mid[1][0] >= 25 && mid[0][0] - mid[1][0] <= 55 && (mid[0][0] - mid[1][0]) > (mid[0][1] - mid[1][1]) && (mid[0][1] - mid[1][1]) >= (mid[0][2] - mid[1][2]), JSON.stringify(mid)); }
  /* Strecke (SVG) liegt auf derselben Karte: der Start-Ring sitzt auf der Kreuzung 51,4800 / 7,2160 */
  const sr = await page.evaluate(() => { const b = document.querySelector('#gmActPage .route-map .rmx-start').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  const cross = at(51.4800, 7.2160);
  ok('A7 die Strecke liegt auf der Karte: Start-Ring sitzt auf der Kreuzung 51,4800° / 7,2160° (± 0,6 px)', Math.abs(sr[0] - cross[0]) <= 0.6 && Math.abs(sr[1] - cross[1]) <= 0.6, JSON.stringify([sr.map(v => +v.toFixed(1)), cross.map(v => +v.toFixed(1))]));

  sec('Story: Wiederverwendung');
  const n0 = B.tiles().length;
  const s1 = await page.evaluate(async () => { gmOpenStory('gl-r1'); await new Promise(r => setTimeout(r, 1900)); try { gmStoryStop(); } catch (_) { }
    const cv = document.querySelector('.gm-story .wst-page.on .wst-mapbg canvas'); if (cv) cv.__mark = 'A';
    return { gl: !!document.querySelector('.gm-story .wst-page.on .wst-mapbg .rmx-tiles.rmx-gl'), canvas: cv ? [cv.width, cv.clientWidth] : null, ok: !!document.querySelector('.gm-story .wst-page.on .rmx-glbox.ok'), imgs: document.querySelectorAll('.gm-story img.rmx-t').length, stats: ORVIA.routeMapGL.stats(), dim: getComputedStyle(document.querySelector('.gm-story .wst-page.on .wst-mapbg .rmx-tiles'), '::before').backgroundColor }; });
  const n1 = B.tiles().length;
  ok('B1a dieselbe Karte, in der Story minimal zurueckgenommen: Schleier 6 % (Kartenfeld: 0)', /rgba\(5, 8, 13, 0\.06\)/.test(String(s1.dim)), String(s1.dim));
  ok('B1 Story-Abschluss zeigt die gezeichnete Karte in voller Pixeldichte, ohne Bildkacheln', s1.gl === true && !!s1.canvas && s1.canvas[0] === s1.canvas[1] * DPR && s1.ok === true && s1.imgs === 0, JSON.stringify(s1));
  const s2 = await page.evaluate(async () => { gmStoryNext(); await new Promise(r => setTimeout(r, 400)); try { gmStoryStop(); } catch (_) { } const gone = !document.querySelector('.gm-story .wst-page.on canvas');
    gmStoryPrev(); await new Promise(r => setTimeout(r, 500)); try { gmStoryStop(); } catch (_) { }
    const cv = document.querySelector('.gm-story .wst-page.on .wst-mapbg canvas');
    const r = { gone, same: !!cv && cv.__mark === 'A', ok: !!document.querySelector('.gm-story .wst-page.on .rmx-glbox.ok'), stats: ORVIA.routeMapGL.stats() };
    try { gmStoryClose(); } catch (_) { } await new Promise(r => setTimeout(r, 200)); return r; });
  ok('B2 Weiter- und Zurueckblaettern: DIESELBE Zeichenflaeche wird wieder eingesetzt — keine einzige neue Anfrage, kein Neuaufbau', s2.gone === true && s2.same === true && s2.ok === true && B.tiles().length === n1 && s2.stats.reused > s1.stats.reused && s2.stats.created === s1.stats.created, JSON.stringify([s2, B.tiles().length - n1]));
  ok('B3 nie mehr als 3 stehende Karten gleichzeitig im Speicher', s2.stats.held <= 3, JSON.stringify(s2.stats));

  /* ══════════ 2 · Kartenansicht ══════════ */
  sec('Kartenansicht');
  const fb = (await B.field()).box;
  await page.mouse.click(fb[0] + fb[2] / 2, fb[1] + fb[3] / 2); await page.waitForTimeout(2000);
  const V = `(() => { const el = document.querySelector('.rmv'); if (!el) return null; const st = ORVIA.routeMapView.stats(), cv = el.querySelector('.rmv-gl canvas');
    return { cls: el.className, act: el.getAttribute('data-activity'), engine: st.engine, gl: st.gl, fitZ: st.fitZ, canvas: cv ? [cv.width, cv.height] : null, routeSvg: getComputedStyle(el.querySelector('.rmv-route')).display, layer: getComputedStyle(el.querySelector('.rmv-layer')).display,
      note: getComputedStyle(el.querySelector('.rmv-note')).display, attr: !!el.querySelector('.rmx-attr'), focus: document.activeElement && document.activeElement.className, imgs: el.querySelectorAll('img.rmx-t').length, failed: st.failed,
      fit: (b => ({ on: b.classList.contains('on'), col: getComputedStyle(b).color, border: getComputedStyle(b).borderTopColor }))(el.querySelector('.rmv-fit')), plus: (b => ({ col: getComputedStyle(b).color, border: getComputedStyle(b).borderTopColor }))(el.querySelector('.rmv-in')) }; })()`;
  const o = await page.evaluate(V);
  ok('C1 die Kartenansicht oeffnet mit der gezeichneten Karte im Vollbild, volle Pixeldichte, Thema der Sportart', !!o && /rmv-glmode/.test(o.cls) && /rmv-glready/.test(o.cls) && o.engine === 'vector' && o.act === 'running' && !!o.canvas && o.canvas[0] === 390 * DPR && o.canvas[1] === 844 * DPR && o.imgs === 0, JSON.stringify(o));
  ok('C2 sobald die Karte steht, zeichnet SIE die Strecke: das Standbild der Strecke und die Bildkachel-Ebene sind aus', !!o && o.routeSvg === 'none' && o.layer === 'none' && o.gl && o.gl.ready === true);
  ok('C3 Ausschnitt beim Oeffnen = „ganze Strecke" (dieselbe Zoomstufe wie die Rechnung, Kamera der Karte eine Stufe darunter)', !!o && Math.abs(o.gl.zoom - (o.fitZ - 1)) < 1e-6, JSON.stringify(o && [o.gl.zoom, o.fitZ]));
  ok('C3a Gold als Zustand: beim Oeffnen zeigt der Ausschnitt die ganze Strecke ⇒ dieser Knopf traegt Gold (Zeichen #D8BB7A, Rand 32 %); die uebrigen Knoepfe haben nur den leisen Goldrand der Ruhe (12 %) und ein neutrales Zeichen', !!o && o.fit.on === true && o.fit.col === 'rgb(216, 187, 122)' && o.fit.border === 'rgba(216, 187, 122, 0.32)' && o.plus.col === 'rgb(243, 241, 234)' && o.plus.border === 'rgba(216, 187, 122, 0.12)', JSON.stringify(o && [o.fit, o.plus]));
  /* Farben am Bildschirm: Stellen ueber die Karte selbst gerechnet (project) UND unabhaengig ueber die Kamera */
  const cam = o.gl, ws = 512 * Math.pow(2, cam.zoom);
  const scr = (lat, lon) => [(lonX(lon) - lonX(cam.lon)) * ws + 195, (latY(lat) - latY(cam.lat)) * ws + 422];
  const own = await page.evaluate(() => { const g = ORVIA.routeMapView._gl(); return { line: g.project(51.4850, 7.2210), start: g.project(51.4800, 7.2160), end: g.project(51.4797, 7.2160) }; });
  const me = { line: scr(51.4850, 7.2210), start: scr(51.4800, 7.2160) };
  ok('C4 Lage: Karte und unabhaengige Rechnung liefern dieselbe Bildschirmstelle (± 0,05 px)', Math.abs(own.line[0] - me.line[0]) < 0.05 && Math.abs(own.line[1] - me.line[1]) < 0.05 && Math.abs(own.start[0] - me.start[0]) < 0.05, JSON.stringify([own.line.map(v => +v.toFixed(2)), me.line.map(v => +v.toFixed(2))]));
  const vp = await B.pixels([me.line, [me.line[0], me.line[1] - 3.0], me.start, [me.start[0] - 6.5, me.start[1]], own.end, scr(51.4842, 7.2220), scr(51.4842, 7.2225), scr(51.4804, 7.2175), scr(51.48275, 7.22225)]);
  ok('C5 Strecke in der Farbe der Sportart (Laufen #FF9A5C), daneben der dunkle Rand — kein Leuchten', near(vp[0], RUN, 4) && vp[1][0] < 60 && vp[1][1] < 50, JSON.stringify([vp[0], vp[1]]));
  ok('C6 Start = gruener Ring um dunkle Mitte, Ziel = roter Punkt (Zustandsfarben)', near(vp[2], BASE, 6) && near(vp[3], START, 12) && near(vp[4], FINISH, 6), JSON.stringify([vp[2], vp[3], vp[4]]));
  ok('C7 Karte unter der Strecke: Strasse, Land, Gebaeude und Wald in den Farben des ORVIA-Stils an den gerechneten Stellen', near(vp[5], ROAD, 7) && near(vp[6], LAND, 5) && near(vp[7], BUILDING, 5) && near(vp[8], NATURE, 5), JSON.stringify(vp.slice(5)));

  sec('Bedienung');
  const z0 = cam.zoom;
  await page.click('.rmv-in'); await page.waitForTimeout(600);
  const a1 = await page.evaluate(V);
  await page.click('.rmv-out'); await page.waitForTimeout(600);
  const a2 = await page.evaluate(V);
  ok('D1a sobald man sich umsieht, ist „ganze Strecke" nicht mehr gewaehlt: Zeichen neutral, Rand zurueck auf die Ruhe (12 %)', a1.fit.on === false && a1.fit.col === 'rgb(243, 241, 234)' && a1.fit.border === 'rgba(216, 187, 122, 0.12)', JSON.stringify(a1.fit));
  ok('D1b … und wieder gewaehlt, wenn der Ausschnitt zur ganzen Strecke zurueckkehrt (hier ueber „−")', a2.fit.on === true, JSON.stringify(a2.fit));
  ok('D1 Knoepfe: „+" eine Stufe hinein, „−" wieder heraus', Math.abs(a1.gl.zoom - (z0 + 1)) < 0.01 && Math.abs(a2.gl.zoom - z0) < 0.01, JSON.stringify([z0, a1.gl.zoom, a2.gl.zoom]));
  await page.mouse.move(195, 500); await page.mouse.down(); await page.mouse.move(255, 560, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
  const a3 = await page.evaluate(V);
  ok('D2 Ziehen verschiebt die Karte (60 px nach rechts unten ⇒ Mittelpunkt wandert nach Westen und Norden), Zoomstufe bleibt', a3.gl.lon < a2.gl.lon - 1e-5 && a3.gl.lat > a2.gl.lat + 1e-5 && Math.abs(a3.gl.zoom - z0) < 0.01, JSON.stringify([a2.gl.lon, a3.gl.lon, a2.gl.lat, a3.gl.lat]));
  await page.mouse.move(195, 422); await page.mouse.wheel(0, -300); await page.waitForTimeout(900);
  const a4 = await page.evaluate(V);
  ok('D3 Mausrad zoomt hinein', a4.gl.zoom > z0 + 0.05, String(a4.gl.zoom));
  await page.click('.rmv-fit'); await page.waitForTimeout(700);
  const a5 = await page.evaluate(V);
  ok('D4a nach dem Verschieben neutral, nach „Ganze Strecke" wieder Gold', a3.fit.on === false && a4.fit.on === false && a5.fit.on === true && a5.fit.col === 'rgb(216, 187, 122)', JSON.stringify([a3.fit.on, a4.fit.on, a5.fit]));
  ok('D4 „Ganze Strecke" stellt den Ausgangsausschnitt wieder her', Math.abs(a5.gl.zoom - z0) < 1e-3 && Math.abs(a5.gl.lon - cam.lon) < 1e-6 && Math.abs(a5.gl.lat - cam.lat) < 1e-6, JSON.stringify([a5.gl.zoom, a5.gl.lon]));
  await page.keyboard.press('+'); await page.waitForTimeout(500); const k1 = await page.evaluate(V);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(450); const k2 = await page.evaluate(V);
  await page.keyboard.press('0'); await page.waitForTimeout(600); const k3 = await page.evaluate(V);
  ok('D5 Tastatur: „+" zoomt, Pfeil links schiebt den Ausschnitt nach Westen, „0" zeigt die ganze Strecke', Math.abs(k1.gl.zoom - (z0 + 1)) < 0.01 && k2.gl.lon < k1.gl.lon - 1e-6 && Math.abs(k3.gl.zoom - z0) < 1e-3, JSON.stringify([k1.gl.zoom, k1.gl.lon, k2.gl.lon, k3.gl.zoom]));
  ok('D6 Grenzen: nicht weiter heraus als 3 Stufen ueber „ganze Strecke"', await page.evaluate(async () => { const g = ORVIA.routeMapView._gl(), z = g.state().zoom; for (let i = 0; i < 6; i++) g.zoomBy(-1); await new Promise(r => setTimeout(r, 900)); const z2 = g.state().zoom; g.fit(); await new Promise(r => setTimeout(r, 500)); return Math.abs(z2 - (z - 3)) < 0.01; }));
  ok('D7 waehrend des ganzen Umsehens: nur Kartendaten angefragt, keine Bildkachel', B.raster().length === 0 && B.tiles().every(q => q.key === 'TESTKEY'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const c1 = await page.evaluate(() => ({ open: !!document.querySelector('.rmv'), canv: document.querySelectorAll('body > .rmv canvas').length, isOpen: ORVIA.routeMapView.isOpen(), page: document.getElementById('gmActPage').classList.contains('on'), focus: document.activeElement && document.activeElement.className, field: !!document.querySelector('#gmActPage .route-map canvas') }));
  ok('D8 Escape schliesst nur die Ansicht und gibt ihre Zeichenflaeche frei; Fokus zurueck auf dem Kartenfeld, dessen Karte steht noch', c1.open === false && c1.canv === 0 && c1.isOpen === false && c1.page === true && /route-map/.test(c1.focus || '') && c1.field === true, JSON.stringify(c1));

  /* ══════════ 3 · Stil gueltig ══════════ */
  sec('Stil');
  const val = await page.evaluate(async () => { const errs = []; const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:60px;opacity:0;pointer-events:none'; document.body.appendChild(d);
    const c = ORVIA.routeMapGL.cfg(); const st = ORVIA.mapStyle.build({ tiles: c.tiles, glyphs: c.glyphs, maxzoom: c.maxzoom, fonts: c.fonts });
    const m = new maplibregl.Map({ container: d, style: st, center: [7.219, 51.4815], zoom: 14.6, attributionControl: false, interactive: false, validateStyle: true });
    m.on('error', e => errs.push(String(e && e.error && e.error.message || e)));
    await new Promise(r => setTimeout(r, 1500)); const n = m.getStyle().layers.length, ver = maplibregl.getVersion(); m.remove(); d.remove(); return { errs, n, ver }; });
  ok('E1 die Bibliothek nimmt den ORVIA-Stil mit eingeschalteter Pruefung ohne jede Beanstandung an (19 Ebenen)', val.errs.length === 0 && val.n === 19, JSON.stringify(val));
  ok('E2 ausgelieferte Bibliothek ist die erwartete Fassung (5.24.0)', val.ver === '5.24.0', val.ver);
  ok('E3 keine Laufzeitfehler im ganzen Durchlauf', B.errs.length === 0, B.errs.slice(0, 3).join(' | '));
  await B.ctx.close();
}

/* ══════════ 4 · Kartendaten kommen nicht ══════════ */
{
  const B = await boot('ok'); const { page } = B;
  B.st.fail = true;
  await B.openPage(2200);
  const f = await B.field(); const n = B.tiles().length;
  sec('Rueckfall: Kartendaten kommen nicht');
  ok('F1 Kartendaten abgelehnt ⇒ das Feld zeigt die Strecke als bisherige Zeichnung (keine leere Karte), ist kein Knopf mehr; 5 Minuten Pause', !!f && f.oldSvg === true && f.rmx === false && !/can-open/.test(f.cls) && !/has-rmx/.test(f.cls) && f.paused === true, JSON.stringify(f && [f.oldSvg, f.rmx, f.cls, f.paused]));
  await page.evaluate(() => gmCloseActivityPage()); await B.openPage(900);
  ok('F2 in der Pause geht keine einzige weitere Anfrage hinaus — auch keine Bildkachel', B.tiles().length === n && B.raster().length === 0, JSON.stringify([n, B.tiles().length, B.raster().length]));
  ok('F3 das Geraet bleibt fuer die gezeichnete Karte vorgesehen (kein Wechsel der Technik wegen eines Netzfehlers)', (await page.evaluate(() => [ORVIA.routeMapGL.down(), ORVIA.routeMap.cfg().engine])).join() === ',vector');
  /* nach der Pause wieder Karte */
  B.st.fail = false;
  await page.evaluate(() => { ORVIA.routeMap._resume(); gmCloseActivityPage(); }); await B.openPage();
  const f2 = await B.field();
  ok('F4 nach der Pause steht wieder die gezeichnete Karte im Feld', !!f2 && f2.gl === true && f2.ok === true && !!f2.canvas && /can-open/.test(f2.cls), JSON.stringify(f2 && [f2.gl, f2.ok, f2.cls]));
  /* Fehler erst in der Kartenansicht */
  const fb = f2.box; await page.mouse.click(fb[0] + fb[2] / 2, fb[1] + fb[3] / 2); await page.waitForTimeout(1600);
  B.st.fail = true;
  await page.evaluate(async () => { const g = ORVIA.routeMapView._gl(); g.zoomBy(2); await new Promise(r => setTimeout(r, 1800)); });
  const v = await page.evaluate(() => { const el = document.querySelector('.rmv'); return el ? { notiles: el.classList.contains('rmv-notiles'), note: el.querySelector('.rmv-note').textContent, shown: getComputedStyle(el.querySelector('.rmv-note')).display !== 'none', attr: getComputedStyle(el.querySelector('.rmx-attr')).display, ready: ORVIA.routeMapView.stats().gl.ready, paused: ORVIA.routeMap.paused(), open: ORVIA.routeMapView.isOpen() } : null; });
  ok('F5 Kartendaten fallen in der Kartenansicht aus ⇒ Hinweis erscheint, Ansicht bleibt offen und bedienbar, Strecke bleibt; Pause', !!v && v.notiles === true && /nicht verfügbar|nicht verfuegbar/i.test(v.note) && v.shown === true && v.attr === 'none' && v.ready === true && v.paused === true && v.open === true, JSON.stringify(v));
  ok('F6 keine Laufzeitfehler', B.errs.length === 0, B.errs.slice(0, 3).join(' | '));
  await B.ctx.close();
}

/* ══════════ 5 · Bibliothek nicht ladbar ══════════ */
{
  const B = await boot('nolib'); const { page } = B;
  await B.openPage(1500);
  const f = await B.field();
  sec('Rueckfall: Bibliothek nicht ladbar');
  ok('G1 Bibliothek kommt nicht ⇒ Strecke als bisherige Zeichnung, keine Anfrage an den Anbieter, Pause — kein Absturz', !!f && f.oldSvg === true && f.paused === true && B.tiles().length === 0 && B.raster().length === 0 && B.errs.length === 0, JSON.stringify(f && [f.oldSvg, f.paused, B.tiles().length, B.errs.slice(0, 2)]));
  LIBFAIL = false;
  await page.evaluate(() => { ORVIA.routeMap._resume(); gmCloseActivityPage(); }); await B.openPage(2000);
  const f2 = await B.field();
  ok('G2 beim naechsten Versuch (Bibliothek wieder erreichbar) steht die gezeichnete Karte — die Sitzung war nicht auf Bildkacheln festgelegt', !!f2 && f2.gl === true && f2.ok === true && f2.engine === 'vector', JSON.stringify(f2 && [f2.gl, f2.ok, f2.engine]));
  await B.ctx.close();
}

/* ══════════ 6 · Geraet ohne WebGL ══════════ */
{
  const B = await boot('nowebgl'); const { page } = B;
  await B.openPage(1500);
  const f = await B.field();
  sec('Rueckfall: kein WebGL');
  ok('H1 ohne WebGL nimmt die App von selbst Bildkacheln: Karte steht, Feld oeffnet die Ansicht, keine Kartendaten-Anfrage', !!f && f.engine === 'raster' && f.gl === false && f.imgs >= 1 && /has-rmx/.test(f.cls) && /can-open/.test(f.cls) && B.raster().length >= 1 && B.tiles().length === 0, JSON.stringify(f && [f.engine, f.gl, f.imgs, f.cls, B.raster().length, B.tiles().length]));
  const fb = f.box; await page.mouse.click(fb[0] + fb[2] / 2, fb[1] + fb[3] / 2); await page.waitForTimeout(1100);
  const v = await page.evaluate(() => { const el = document.querySelector('.rmv'); const st = ORVIA.routeMapView.stats(); return el ? { cls: el.className, engine: st.engine, tiles: st.current, route: getComputedStyle(el.querySelector('.rmv-route')).display, layer: getComputedStyle(el.querySelector('.rmv-layer')).display } : null; });
  ok('H2 … und die Kartenansicht laeuft dort wie bis v8-439 (Bildkacheln, eigene Gesten, Strecke als SVG)', !!v && v.engine === 'raster' && !/rmv-glmode/.test(v.cls) && v.tiles >= 1 && v.route !== 'none' && v.layer !== 'none', JSON.stringify(v));
  ok('H3 keine Laufzeitfehler', B.errs.length === 0, B.errs.slice(0, 3).join(' | '));
  await B.ctx.close();
}

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' route_map_gl_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
