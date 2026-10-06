/* ORVIA · route_map_view_e2e (v8-435) — die Kartenansicht zum Umsehen im ECHTEN Browser.

   Gians Auftrag 5.10.: auf der Aktivitaetsseite oben auf die Karte tippen ⇒ die Karte
   oeffnet sich mit der Strecke; verschieben und zoomen. Geprueft wird die echte App
   (echter Store, echte Aktivitaetsseite) gegen KUNSTKACHELN im echten Vertrag des Anbieters
   (512er ohne Groessenangabe im Pfad), deren „Strassen" exakt auf dem Gradnetz liegen:
     · Feld oeffnet die Ansicht (Maus/Tastatur), Escape schliesst nur die Ansicht
     · Strecke liegt nach Oeffnen, Schieben, Zoomen (Rad, zwei Finger, Knoepfe) auf der Karte
     · Anfragen: waehrend des Zoomens mit zwei Fingern keine; Wiederoeffnen ohne neue Anfrage
     · Kachelfehler: Strecke bleibt, Hinweis erscheint, keine weiteren Versuche
     · Story: Strecke liegt auch mit sicherem Rand (iPhone) nicht auf der Datumszeile
   Der echte Kartenstil und Safari auf dem iPhone sind damit NICHT geprueft.

   node supabase/tests/route_map_view_e2e_test.mjs [appRoot-absolut] */
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

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let KEY = 'TESTKEY', FAIL = false;
/* ausgeliefert wird die ECHTE map-config.js — ersetzt wird nur der Schluessel */
/* v8-440: Dieser Test prueft die Kartenansicht ueber BILDKACHELN (engine:'raster' — Rueckfall und Schalter);
   die auf dem Geraet gezeichnete Karte laeuft in route_map_gl_e2e_test.mjs. */
const cfgFile = () => { const s0 = readFileSync(join(APP, 'js', 'map-config.js'), 'utf8'); if (!/key: '[A-Za-z0-9]*'/.test(s0) || !/engine: 'vector',/.test(s0)) throw new Error('map-config.js hat eine unerwartete Form'); return s0.replace(/key: '[A-Za-z0-9]*'/, "key: '" + KEY + "'").replace(/engine: 'vector',/, "engine: 'raster',"); };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  if (p === '/js/map-config.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' }); res.end(cfgFile()); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME });

/* Kunstkachel: Linien auf dem 0,001°-Gradnetz. preserveAspectRatio="none": ein echtes
   Kachelbild (PNG) fuellt sein Feld immer ganz — ein SVG liesse sonst einen Spalt. */
const lonX = lon => (lon + 180) / 360, latY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const xLon = x => x * 360 - 180, yLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
const tileSvg = (z, x, y) => { const n = 2 ** z, S = 512, step = 0.001; const lon0 = xLon(x / n), lon1 = xLon((x + 1) / n), lat0 = yLat(y / n), lat1 = yLat((y + 1) / n);
  let g = `<rect width="${S}" height="${S}" fill="rgb(41,41,41)"/>`; const k = v => Math.round(v / step);
  for (let i = k(lon0) - 1; i <= k(lon1) + 1; i++) { const X = (lonX(i * step) * n - x) * S; g += `<line x1="${X.toFixed(2)}" x2="${X.toFixed(2)}" y1="0" y2="${S}" stroke="rgb(50,50,50)" stroke-width="3"/>`; }
  for (let j = k(lat1) - 1; j <= k(lat0) + 1; j++) { const Y = (latY(j * step) * n - y) * S; g += `<line y1="${Y.toFixed(2)}" y2="${Y.toFixed(2)}" x1="0" x2="${S}" stroke="rgb(50,50,50)" stroke-width="3"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" preserveAspectRatio="none">${g}</svg>`; };

/* Lage der Ansicht auslesen: Start-Ring gegen die UNABHAENGIG gerechnete Kreuzung 51,4800/7,2160 der Kachel */
const INFO = `(() => { const el = document.querySelector('.rmv'); if (!el) return null;
  const st = ORVIA.routeMapView.stats(), sr = el.querySelector('.rmv-stage').getBoundingClientRect();
  const imgs = [].slice.call(el.querySelectorAll('.rmv-tiles img')), cur = imgs.filter(i => i.style.zIndex === '1');
  const rects = cur.map(i => i.getBoundingClientRect()), z = +el.getAttribute('data-z'), n = Math.pow(2, z);
  const covers = rects.length ? (Math.min.apply(null, rects.map(r => r.left)) <= sr.left + 0.5 && Math.min.apply(null, rects.map(r => r.top)) <= sr.top + 0.5 && Math.max.apply(null, rects.map(r => r.right)) >= sr.right - 0.5 && Math.max.apply(null, rects.map(r => r.bottom)) >= sr.bottom - 0.5) : false;
  const sb = el.querySelector('.rmx-start').getBoundingClientRect(), eb = el.querySelector('.rmx-end').getBoundingClientRect();
  const lx = (7.2160 + 180) / 360 * n, s0 = Math.sin(51.4800 * Math.PI / 180), ly = (0.5 - Math.log((1 + s0) / (1 - s0)) / (4 * Math.PI)) * n;
  const im = cur.find(i => new RegExp('/' + z + '/' + Math.floor(lx) + '/' + Math.floor(ly) + '@2x').test(i.getAttribute('src') || ''));
  let cross = null; if (im) { const ib = im.getBoundingClientRect(); cross = [ib.left - sr.left + (lx - Math.floor(lx)) * ib.width, ib.top - sr.top + (ly - Math.floor(ly)) * ib.height]; }
  /* Pfad: erster Punkt (nach der Transformation der Gruppe) muss auf dem Start-Ring liegen */
  const line = el.querySelector('.rmx-line'), p0 = line.getPointAtLength(0), m = line.getScreenCTM(), pp = [p0.x * m.a + p0.y * m.c + m.e - sr.left, p0.x * m.b + p0.y * m.d + m.f - sr.top];
  return { Z: st.Z, fitZ: st.fitZ, z: z, tiles: imgs.length, cur: cur.length, loaded: cur.filter(i => i.classList.contains('ok') && i.complete && i.naturalWidth > 0).length, covers: covers,
    start: [sb.left + sb.width / 2 - sr.left, sb.top + sb.height / 2 - sr.top], end: [eb.left + eb.width / 2 - sr.left, eb.top + eb.height / 2 - sr.top], cross: cross, path0: pp,
    pathLen: line.getTotalLength(), lineW: line.getBoundingClientRect().width, d: line.getAttribute('d'), gT: el.querySelector('.rmv-g').getAttribute('transform'), seeded: st.seeded, bakes: st.bakes, points: st.points, under: imgs.length - cur.length, strokeW: parseFloat(getComputedStyle(line).strokeWidth), stage: [Math.round(sr.width), Math.round(sr.height)], requested: st.requested, reused: st.reused, failed: st.failed,
    notiles: el.classList.contains('rmv-notiles'), note: (el.querySelector('.rmv-note') || {}).textContent || '', noteShown: getComputedStyle(el.querySelector('.rmv-note')).display !== 'none',
    attrShown: !!(el.querySelector('.rmx-attr') && getComputedStyle(el.querySelector('.rmx-attr')).display !== 'none'), attr: (el.querySelector('.rmx-attr') || {}).textContent || '',
    title: el.querySelector('.rmv-ttl b').textContent, sub: el.querySelector('.rmv-ttl span').textContent, focus: document.activeElement && document.activeElement.className, role: el.getAttribute('role'), modal: el.getAttribute('aria-modal') };
})()`;
const close1 = (a, b, e) => !!a && !!b && Math.abs(a[0] - b[0]) <= e && Math.abs(a[1] - b[1]) <= e;
const r1 = a => (a || []).map(x => +x.toFixed(1));

async function boot(mode) {
  KEY = mode === 'nokey' ? '' : 'TESTKEY'; FAIL = false;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  const reqs = [];
  await ctx.route('**api.maptiler.com/**', r => { const u = new URL(r.request().url()); reqs.push({ path: u.pathname, key: u.searchParams.get('key'), ref: r.request().headers()['referer'] || '' });
    if (/logo\.svg/.test(u.pathname)) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12"/>' });
    const m = /^\/maps\/([^/]+)\/(256\/)?(\d+)\/(\d+)\/(\d+)@2x\.webp$/.exec(u.pathname);
    if (!m || FAIL) return r.fulfill({ status: 403, body: 'no' });
    return r.fulfill({ contentType: 'image/svg+xml', body: tileSvg(+m[3], +m[4], +m[5]) }); });
  const tiles = () => reqs.filter(q => /@2x\.webp$/.test(q.path)).length;
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    document.documentElement.classList.remove('orvia-gated');
    var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
    const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
    const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);
    const hr = []; for (let k = 0; k < 2160; k++) hr.push(Math.round(104 + 10 * Math.sin(k / 120)));
    ORVIA.activityStore.mergeServerActivities([{ id: 'map-r1', sport_id: 'running', source: 'garmin', source_record_id: 'map-r1', started_at: todayStr() + 'T15:12:00.000Z', duration_seconds: 2160, status: 'completed',
      summary: { distance_m: 3330, avgHr: 110, maxHr: 131 }, metrics: { route: route, hasRoute: true, streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' } } }]);
  });
  const openPage = async () => { await page.evaluate(async () => { showTab('akt'); await new Promise(r => setTimeout(r, 200)); gmOpenActivityPage('map-r1'); await new Promise(r => setTimeout(r, 1300)); }); };
  const field = () => page.evaluate(() => { const el = document.querySelector('#gmActPage .route-map'); if (!el) return null; const b = el.getBoundingClientRect();
    const tl = el.querySelector('.rmx-tiles'), ln = el.querySelector('.rmx-line');
    return { cls: el.className, role: el.getAttribute('role'), tab: el.getAttribute('tabindex'), label: el.getAttribute('aria-label'), icon: !!el.querySelector('.rmx-open'), rmx: !!el.querySelector('.rmx'), oldSvg: !!el.querySelector('svg.rmap'), box: [b.left, b.top, b.width, b.height], cursor: getComputedStyle(el).cursor, stack: tl ? getComputedStyle(tl).zIndex : null, lineColor: ln ? getComputedStyle(ln).stroke : null }; });
  return { ctx, page, reqs, tiles, errs, openPage, field, info: () => page.evaluate(INFO) };
}

/* ══════════ 1 · Oeffnen, Lage, Bedienung ══════════ */
{
  const B = await boot('tiles'); const { page } = B;
  await B.openPage();
  const f = await B.field(); const nField = B.tiles();
  sec('Kartenfeld der Aktivitaetsseite');
  ok('A1 Feld zeigt die Karte und ist als Schaltflaeche ausgezeichnet („Karte öffnen"), mit Oeffnen-Zeichen', !!f && f.rmx === true && /has-rmx/.test(f.cls) && /can-open/.test(f.cls) && f.role === 'button' && f.tab === '0' && f.label === 'Karte öffnen' && f.icon === true && f.cursor === 'pointer', JSON.stringify(f));
  ok('A1a im Feld liegen Schleier und Verlauf UNTER der Strecke (eigener Stapel der Kachelebene) — die Linie traegt die Farbe der Sportart (Laufen = #FF9A5C aus dem Farbsystem)', f.stack === '0' && /255, 154, 92/.test(f.lineColor || ''), JSON.stringify([f.stack, f.lineColor]));
  const overflow0 = await page.evaluate(() => document.documentElement.style.overflow);
  await page.mouse.click(f.box[0] + f.box[2] / 2, f.box[1] + f.box[3] / 2); await page.waitForTimeout(1100);
  const o = await B.info(); const nOpen = B.tiles();
  sec('Ansicht oeffnet');
  ok('A2 Tippen oeffnet die Kartenansicht als Dialog im Vollbild (390 × 844), Fokus auf „Schliessen"', !!o && o.role === 'dialog' && o.modal === 'true' && o.stage[0] === 390 && o.stage[1] === 844 && /rmv-close/.test(o.focus || ''), JSON.stringify(o && [o.stage, o.focus]));
  ok('A3 Titel und Eckdaten der Aktivitaet stehen oben („Laufen" · 3,33 km · 36 min)', !!o && /Laufen/.test(o.title) && /3,33 km/.test(o.sub) && /36 min/.test(o.sub), JSON.stringify(o && [o.title, o.sub]));
  ok('A4 alle Kacheln des Ausschnitts geladen, Bildschirm lueckenlos gedeckt', !!o && o.cur >= 1 && o.loaded === o.cur && o.covers === true && o.notiles === false, JSON.stringify(o && { kacheln: o.cur, geladen: o.loaded, stufe: o.z }));
  ok('A5 Strecke liegt deckungsgleich: Start-Ring auf der Kreuzung 51,4800 / 7,2160 der Kachel (± 1 px), Pfadanfang auf dem Ring', !!o && close1(o.start, o.cross, 1) && close1(o.path0, o.start, 1), JSON.stringify(o && [r1(o.start), r1(o.cross), r1(o.path0)]));
  ok('A6 ganze Strecke sichtbar; Kopf und Knoepfe bleiben frei (Start/Ziel im Innenrand)', !!o && o.start[0] > 40 && o.start[0] < 350 && o.start[1] > 70 && o.start[1] < 720 && Math.abs(o.Z - o.fitZ) < 1e-6 && o.pathLen > 400, JSON.stringify(o && [r1(o.start), +o.pathLen.toFixed(0)]));
  ok('A7 Anfragen beim Oeffnen: hoechstens 6 Kacheln der Ansicht (die Unterlage aus dem Kartenfeld kommt im echten Betrieb aus dem Zwischenspeicher — der Test hat keinen)', o.requested <= 6 && o.seeded >= 1 && o.seeded <= 6 && nOpen - nField === o.requested + o.seeded, JSON.stringify({ ansicht: o.requested, unterlage: o.seeded, netz: nOpen - nField }));
  ok('A7a gezeichnet wird die Anzeige-Strecke (ausgeduennt): deutlich weniger Punkte als aufgezeichnet', o.points >= 8 && o.points < 60, o.points + ' von 121');
  ok('A8 Quellenhinweis sichtbar', !!o && o.attrShown === true && /© MapTiler © OpenStreetMap contributors/.test(o.attr));

  sec('Verschieben');
  { /* kleines Stueck (40 px): die fertig gezeichnete Streckenebene wird nur bewegt, nicht neu gezeichnet */
    await page.mouse.move(200, 520); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(200 + i * 5, 520 + i * 3); await page.waitForTimeout(16); }
    await page.waitForTimeout(180); const s1 = await B.info(); await page.mouse.up(); await page.waitForTimeout(400);
    const s2 = await B.info();
    ok('B0 kleines Verschieben (40 / 24 px): Strecke folgt genau (± 1 px), wird dafuer aber NICHT neu gezeichnet (nur die Ebene bewegt sich)', close1([s1.start[0] - o.start[0], s1.start[1] - o.start[1]], [40, 24], 1) && s1.bakes === o.bakes && s2.bakes === o.bakes && close1(s1.path0, s1.start, 1) && close1(s2.start, s2.cross, 1), JSON.stringify({ bewegt: r1([s1.start[0] - o.start[0], s1.start[1] - o.start[1]]), neuGezeichnet: s2.bakes - o.bakes }));
    await page.mouse.move(240, 544); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(240 - i * 5, 544 - i * 3); await page.waitForTimeout(16); } await page.waitForTimeout(180); await page.mouse.up(); await page.waitForTimeout(400);
  }
  await page.mouse.move(200, 520); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(200 - i * 14, 520 - i * 18); await page.waitForTimeout(16); }
  await page.waitForTimeout(180);   /* Finger ruht vor dem Loslassen ⇒ kein Schwung */
  const mid = await B.info();
  await page.mouse.up(); await page.waitForTimeout(900);
  const p = await B.info();
  ok('B1 Ziehen um (−140, −180) px: die Strecke folgt dem Finger genau (± 1 px), schon waehrend der Bewegung', !!p && close1([p.start[0] - o.start[0], p.start[1] - o.start[1]], [-140, -180], 1) && close1([mid.start[0] - o.start[0], mid.start[1] - o.start[1]], [-140, -180], 1) && close1(mid.path0, mid.start, 1), JSON.stringify([r1([p.start[0] - o.start[0], p.start[1] - o.start[1]])]));
  ok('B2 danach ist der neue Ausschnitt wieder lueckenlos gedeckt und die Strecke liegt auf der Karte (± 1 px)', p.covers === true && p.loaded === p.cur && close1(p.start, p.cross, 1) && close1(p.path0, p.start, 1) && Math.abs(p.Z - o.Z) < 1e-9, JSON.stringify([r1(p.start), r1(p.cross)]));

  sec('Zoomen mit zwei Fingern');
  await page.click('.rmv-fit'); await page.waitForTimeout(800);
  const f0 = await B.info(); const nBefore = B.tiles();
  const cdp = await B.ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i })) });
  const cx = f0.start[0], cy = f0.start[1];
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[cx - 40 - i * 5, cy], [cx + 40 + i * 5, cy]]); await page.waitForTimeout(20); }
  await page.waitForTimeout(500);
  const during = await B.info(); const nDuring = B.tiles();
  await touch('touchEnd', []); await page.waitForTimeout(900);
  const z2 = await B.info(); const nAfter = B.tiles();
  ok('C1 Finger doppelt so weit auseinander ⇒ eine Stufe hinein; der Ort zwischen den Fingern bleibt stehen (± 1,5 px)', !!z2 && Math.abs(z2.Z - (f0.Z + 1)) < 0.02 && close1(z2.start, f0.start, 1.5), JSON.stringify([+f0.Z.toFixed(2), +z2.Z.toFixed(2), r1(z2.start), r1(f0.start)]));
  ok('C2 WAEHREND des Zoomens geht keine Anfrage hinaus — erst danach die Kacheln der Endstufe', nDuring === nBefore && Math.abs(during.Z - (f0.Z + 1)) < 0.02 && nAfter > nBefore && nAfter - nBefore <= 6, JSON.stringify({ vorher: nBefore, waehrend: nDuring, danach: nAfter }));
  ok('C3 Strichstaerke bleibt gleich (4,5 px), Strecke liegt in der neuen Stufe auf der Karte (± 1,5 px)', Math.abs(z2.strokeW - 4.5) < 0.01 && Math.abs(during.strokeW - 4.5) < 0.01 && z2.covers === true && z2.loaded === z2.cur && close1(z2.start, z2.cross, 1.5) && z2.z === f0.z + 1, JSON.stringify([r1(z2.start), r1(z2.cross), z2.z]));
  ok('C4 Strecke ist auf dem Bildschirm doppelt so gross — der Pfad selbst wurde dafuer NICHT neu geschrieben (nur transformiert)', Math.abs(z2.lineW / f0.lineW - 2) < 0.04 && z2.d === o.d && during.d === o.d && z2.gT !== f0.gT, (z2.lineW / f0.lineW).toFixed(3));

  sec('Schwung');
  await page.click('.rmv-fit'); await page.waitForTimeout(800);
  const g0 = await B.info();
  await page.mouse.move(250, 560); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(250 - i * 16, 560 - i * 12); await page.waitForTimeout(12); }
  await page.mouse.up(); await page.waitForTimeout(120);
  const g1 = await B.info(); await page.waitForTimeout(1500);
  const g2 = await B.info(); await page.waitForTimeout(300);
  const g3 = await B.info();
  { const drag = [-96, -72], moved = [g2.start[0] - g0.start[0], g2.start[1] - g0.start[1]];
    ok('B3 Loslassen im Schwung: die Karte gleitet in dieselbe Richtung weiter und kommt zur Ruhe; danach lueckenlos gedeckt, Strecke auf der Karte', moved[0] < drag[0] - 25 && moved[1] < drag[1] - 18 && Math.abs(moved[0] / moved[1] - drag[0] / drag[1]) < 0.25 && close1(g3.start, g2.start, 0.01) && g2.covers === true && g2.loaded === g2.cur && close1(g2.start, g2.cross, 1) && Math.abs(g2.Z - g0.Z) < 1e-9, JSON.stringify({ gezogen: drag, bewegt: r1(moved), kurzDanach: r1([g1.start[0] - g0.start[0], g1.start[1] - g0.start[1]]) })); }

  sec('Mausrad, Knoepfe, Grenzen');
  await page.click('.rmv-fit'); await page.waitForTimeout(800);
  const wf = await B.info();
  await page.mouse.move(wf.start[0], wf.start[1]); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); } await page.waitForTimeout(800);
  const w = await B.info();
  ok('D1 Mausrad zoomt auf die Stelle unter dem Zeiger (± 1,5 px)', Math.abs(w.Z - (wf.Z + 2)) < 0.02 && close1(w.start, wf.start, 1.5) && w.covers === true && w.loaded === w.cur, JSON.stringify([+w.Z.toFixed(2), r1(w.start), r1(wf.start)]));
  await page.click('.rmv-out'); await page.waitForTimeout(700);
  const m1 = await B.info();
  await page.click('.rmv-in'); await page.waitForTimeout(700);
  const p1 = await B.info();
  ok('D2 Knoepfe − und + aendern genau eine Stufe (um die Bildmitte)', Math.abs(m1.Z - (w.Z - 1)) < 1e-6 && Math.abs(p1.Z - w.Z) < 1e-6 && p1.covers === true && p1.loaded === p1.cur, JSON.stringify([+w.Z.toFixed(2), +m1.Z.toFixed(2), +p1.Z.toFixed(2)]));
  for (let i = 0; i < 7; i++) { await page.click('.rmv-out'); await page.waitForTimeout(330); } await page.waitForTimeout(600);
  const lo = await B.info();
  for (let i = 0; i < 9; i++) { await page.click('.rmv-in'); await page.waitForTimeout(330); } await page.waitForTimeout(700);
  const hi = await B.info();
  ok('D3 Grenzen: hoechstens 3 Stufen weiter heraus als „ganze Strecke", hinein bis Stufe 18 (Kachelstufe ≤ 17)', Math.abs(lo.Z - (lo.fitZ - 3)) < 1e-6 && Math.abs(hi.Z - 18) < 1e-6 && hi.z <= 17 && lo.covers === true && hi.covers === true && hi.loaded === hi.cur, JSON.stringify([+lo.Z.toFixed(2), +hi.Z.toFixed(2), lo.z, hi.z]));
  await page.click('.rmv-fit'); await page.waitForTimeout(900);
  const back = await B.info();
  ok('D4 „Ganze Strecke zeigen" fuehrt genau zum Ausgangsbild zurueck', Math.abs(back.Z - back.fitZ) < 1e-6 && close1(back.start, o.start, 1) && back.covers === true && back.loaded === back.cur && close1(back.start, back.cross, 1), JSON.stringify([r1(back.start), r1(o.start)]));
  await page.keyboard.press('+'); await page.waitForTimeout(600); const k1 = await B.info();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500); const k2 = await B.info();
  ok('D5 Tastatur: + zoomt, Pfeiltasten verschieben', Math.abs(k1.Z - (back.Z + 1)) < 1e-6 && Math.abs((k2.start[0] - k1.start[0]) + 80) < 1 && Math.abs(k2.start[1] - k1.start[1]) < 1, JSON.stringify([+k1.Z.toFixed(2), r1(k1.start), r1(k2.start)]));

  sec('Schliessen und Wiederoeffnen');
  const nAll = B.tiles(); const st0 = await page.evaluate(() => ORVIA.routeMapView.stats());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const afterEsc = await page.evaluate((ov) => ({ rmv: !!document.querySelector('.rmv'), pageOn: document.getElementById('gmActPage').classList.contains('on'), focusField: document.activeElement === document.querySelector('#gmActPage .route-map'), overflowBack: document.documentElement.style.overflow === ov, open: ORVIA.routeMapView.isOpen() }), overflow0);
  ok('E1 Escape schliesst NUR die Ansicht: Aktivitaetsseite bleibt offen, Fokus zurueck auf dem Kartenfeld, Seite scrollt wieder', afterEsc.rmv === false && afterEsc.pageOn === true && afterEsc.focusField === true && afterEsc.overflowBack === true && afterEsc.open === false, JSON.stringify(afterEsc));
  await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  const re = await B.info(); const st1 = await page.evaluate(() => ORVIA.routeMapView.stats());
  ok('E2 Enter auf dem Feld oeffnet erneut — OHNE neue Kachel-Anfrage (Sitzungsspeicher), Karte steht sofort', !!re && B.tiles() === nAll && st1.requested === st0.requested && st1.reused > st0.reused && re.loaded === re.cur && re.covers === true && close1(re.start, o.start, 1), JSON.stringify({ anfragen: [nAll, B.tiles()], wiederverwendet: [st0.reused, st1.reused] }));
  await page.click('.rmv-close'); await page.waitForTimeout(300);
  ok('E3 Knopf „Karte schließen" schliesst; alle Anfragen trugen nur Stil, Schluessel und die Herkunft der Seite', await page.evaluate(() => !document.querySelector('.rmv')) && B.reqs.filter(q => /@2x\.webp$/.test(q.path)).every(q => /^\/maps\/basic-v2-dark\/1[0-7]\/\d+\/\d+@2x\.webp$/.test(q.path) && q.key === 'TESTKEY') && B.reqs.every(q => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(q.ref)), 'Anfragen gesamt: ' + B.reqs.length);
  ok('E4 keine Laufzeitfehler', B.errs.length === 0, B.errs.slice(0, 2).join(' | '));
  ok('E5 Anfragen der ganzen Sitzung (oeffnen, schieben, 2-Finger, Rad, alle Stufen bis zur Grenze und zurueck) bleiben ueberschaubar', nAll - nField <= 60, 'Kacheln: ' + (nAll - nField));
  await B.ctx.close();
}

/* ══════════ 2 · Kachelquelle faellt aus, WAEHREND die Ansicht offen ist ══════════ */
{
  const B = await boot('tiles'); const { page } = B;
  await B.openPage(); const f = await B.field();
  await page.mouse.click(f.box[0] + f.box[2] / 2, f.box[1] + f.box[3] / 2); await page.waitForTimeout(1000);
  const o = await B.info(); FAIL = true; const n0 = B.tiles();
  await page.mouse.move(200, 500); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(200 - i * 25, 500 - i * 30); await page.waitForTimeout(16); } await page.mouse.up(); await page.waitForTimeout(1000);
  const x = await B.info(); const n1 = B.tiles();
  sec('Kachelfehler in der offenen Ansicht');
  ok('F1 Kacheln nicht ladbar: Karte geht aus, die Strecke bleibt bedienbar stehen, Hinweis erscheint, Quellenhinweis verschwindet', !!x && x.notiles === true && x.tiles === 0 && x.failed === true && x.noteShown === true && /Karte gerade nicht verfügbar/.test(x.note) && x.attrShown === false && x.pathLen > 400 && close1(x.path0, x.start, 1), JSON.stringify(x && { note: x.note, kacheln: x.tiles }));
  await page.mouse.move(150, 400); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(150 + i * 20, 400 + i * 20); await page.waitForTimeout(16); } await page.mouse.up();
  await page.click('.rmv-in'); await page.waitForTimeout(900);
  const y = await B.info(); const n2 = B.tiles();
  ok('F2 danach KEINE weiteren Versuche (Schieben, Zoomen) — 5 Minuten Pause, gemeinsam mit dem Standbild', n2 === n1 && n1 > n0 && (await page.evaluate(() => ORVIA.routeMap.stats().pausedMs)) > 4 * 60 * 1000 && Math.abs(y.Z - (x.Z + 1)) < 1e-6, JSON.stringify({ vorher: n0, nachFehler: n1, spaeter: n2 }));
  await page.click('.rmv-close'); await page.waitForTimeout(200);
  FAIL = false;
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  const z = await B.info();
  ok('F3 erneutes Oeffnen in der Pause: Strecke + Hinweis, keine Anfrage', !!z && z.notiles === true && z.noteShown === true && B.tiles() === n2 && z.pathLen > 400, JSON.stringify(z && { note: z.noteShown, kacheln: z.tiles }));
  await page.click('.rmv-close'); await page.waitForTimeout(200);
  /* Aktivitaetsseite neu oeffnen, solange die Pause laeuft ⇒ alte Zeichnung, nicht antippbar */
  await page.evaluate(() => { gmCloseActivityPage(); }); await page.waitForTimeout(300); await B.openPage();
  const f2 = await B.field();
  await page.mouse.click(f2.box[0] + f2.box[2] / 2, f2.box[1] + f2.box[3] / 2); await page.waitForTimeout(400);
  ok('F4 Aktivitaetsseite in der Pause: bisherige Zeichnung, Feld ist wieder ein Bild (kein Knopf, oeffnet nichts), keine Anfrage', f2.oldSvg === true && f2.rmx === false && !/has-rmx|can-open/.test(f2.cls) && f2.role === null && f2.tab === null && f2.icon === false && (await page.evaluate(() => !document.querySelector('.rmv'))) && B.tiles() === n2 && B.errs.length === 0, JSON.stringify(f2));
  await B.ctx.close();
}

/* ══════════ 3 · ohne Schluessel ══════════ */
{
  const B = await boot('nokey'); const { page } = B;
  await B.openPage(); const f = await B.field();
  await page.mouse.click(f.box[0] + f.box[2] / 2, f.box[1] + f.box[3] / 2); await page.waitForTimeout(400);
  sec('ohne Schluessel');
  ok('G1 ohne Schluessel: Feld wie bisher (alte Zeichnung, kein Knopf), Tippen oeffnet nichts, KEINE Anfrage an den Anbieter', f.oldSvg === true && f.rmx === false && f.role === null && !/can-open/.test(f.cls) && (await page.evaluate(() => !document.querySelector('.rmv'))) && B.reqs.length === 0 && B.errs.length === 0, JSON.stringify(f));
  await B.ctx.close();
}

/* ══════════ 4 · Story: sicherer Rand (iPhone) + Tonwerte ══════════ */
{
  const B = await boot('tiles'); const { page } = B;
  const S = await page.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
    const go = async sat => { document.documentElement.style.setProperty('--sat', sat); gmOpenStory('map-r1'); await W(700);
      const pg = document.querySelector('.gm-story .wst-page.on'), top = pg.querySelector('.wst-top span').getBoundingClientRect(), ln = pg.querySelector('.rmx-line').getBBox(), rb = pg.querySelector('.rmx').getBoundingClientRect();
      const img = pg.querySelector('.rmx-t'), cs = img ? getComputedStyle(img).filter : '', dim = getComputedStyle(pg.querySelector('.rmx-tiles'), '::before').backgroundColor;
      const tl = pg.querySelector('.rmx-tiles'), band = getComputedStyle(tl, '::after').backgroundImage, after = getComputedStyle(tl, '::after').content, mask = getComputedStyle(tl).maskImage || getComputedStyle(tl).webkitMaskImage || '';
      const r = { headBottom: top.bottom, routeTop: rb.top + ln.y - 4.5, gap: rb.top + ln.y - 4.5 - top.bottom, routeH: ln.height, filter: cs, dim: dim, band: band, after: after, mask: mask }; gmStoryClose(); await W(250); return r; };
    out.s0 = await go('0px'); out.s59 = await go('59px'); document.documentElement.style.removeProperty('--sat'); return out; });
  sec('Story');
  ok('H1 Strecke haelt Abstand zur Datumszeile — ohne sicheren Rand UND mit 59 px (iPhone mit Dynamic Island)', S.s0.gap >= 16 && S.s59.gap >= 16 && Math.abs(S.s59.gap - S.s0.gap) <= 2 && S.s59.headBottom - S.s0.headBottom > 50, JSON.stringify({ ohne: +S.s0.gap.toFixed(1), mit59: +S.s59.gap.toFixed(1), kopfUnten: [+S.s0.headBottom.toFixed(0), +S.s59.headBottom.toFixed(0)] }));
  ok('H2 … und die Strecke bleibt gross genug (≥ 200 px hoch)', S.s59.routeH >= 200 && S.s0.routeH >= 200, JSON.stringify([+S.s0.routeH.toFixed(0), +S.s59.routeH.toFixed(0)]));
  ok('H3 kein Filter auf dem Kachelbild (der Kartenstil liefert das Bild), Schleier der Story 0,18', S.s0.filter === 'none' && /rgba\(5, 8, 13, 0\.18\)/.test(S.s0.dim), JSON.stringify([S.s0.filter, S.s0.dim]));
  { /* v8-441 (Karte V2): statt eines dunklen Bandes blendet die KARTE hinter dem Kopf aus (Maske). Bis wohin ist sie ganz weg,
       ab wo voll da? — aus den berechneten Stopps der Maske (px ab Oberkante) */
    const px = s => (s.match(/(\d+(?:\.\d+)?)px/g) || []).map(parseFloat);
    const a = px(S.s0.mask), b = px(S.s59.mask);
    ok('H3a Story: hinter Titel und Datumszeile ist die Karte ganz ausgeblendet (kein Ortsname, keine Linie scheint durch) — geht mit dem sicheren Rand mit; kein dunkles Band mehr', a.length >= 3 && b.length >= 3 && a[0] === 0 && a[1] >= S.s0.headBottom && b[1] >= S.s59.headBottom && Math.abs((b[1] - a[1]) - 59) < 0.5 && a[2] > a[1] && /^linear-gradient\(rgba\(0, 0, 0, 0\) 0px, rgba\(0, 0, 0, 0\) /.test(S.s0.mask) && (S.s0.after === 'none' || S.s0.band === 'none'), JSON.stringify({ karteWegBis: [a[1], b[1]], kopfUnten: [+S.s0.headBottom.toFixed(0), +S.s59.headBottom.toFixed(0)], vollDaAb: [a[2], b[2]], after: S.s0.after }));
    ok('H3b … und wo die Strecke beginnt, ist die Karte wieder voll da (Strecke liegt nicht im ausgeblendeten Bereich)', S.s0.routeTop >= a[2] - 2 && S.s59.routeTop >= b[2] - 2, JSON.stringify({ streckeOben: [+S.s0.routeTop.toFixed(0), +S.s59.routeTop.toFixed(0)], vollDaAb: [a[2], b[2]] })); }
  ok('H4 keine Laufzeitfehler', B.errs.length === 0, B.errs.slice(0, 2).join(' | '));
  await B.ctx.close();
}

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' route_map_view_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
