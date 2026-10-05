/* ORVIA · route_map_e2e (v8-432) — die Karte hinter der Strecke im ECHTEN Browser.

   Geprueft wird die echte App (echter Store, echte Story, echte Aktivitaetsseite) gegen
   KUNSTKACHELN: Der Kartenanbieter wird im Test abgefangen und liefert Bilder, deren
   „Strassen" exakt auf dem Gradnetz liegen. So laesst sich ohne Netz und ohne Schluessel
   beweisen, dass (1) Strecke und Kacheln dieselbe Projektion teilen, (2) die Kacheln den
   Ausschnitt fugenlos decken, (3) ohne Schluessel KEINE Anfrage hinausgeht und (4) bei
   einem Kachelfehler die Strecke bleibt bzw. die alte Zeichnung zurueckkommt.
   Der echte Kartenstil (Helligkeit, Beschriftung) ist damit NICHT geprueft.

   node supabase/tests/route_map_e2e_test.mjs [appRoot-absolut] */
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
let KEY = 'TESTKEY', DETAIL = true, TS = 512;
/* v8-434: ausgeliefert wird die ECHTE map-config.js (Adressvorlagen!) — ersetzt werden nur Schluessel,
   Kachelgroesse und der Schalter fuer die Aktivitaetsseite. Der echte Schluessel verlaesst den Test nie. */
const cfgFile = () => { const s0 = readFileSync(join(APP, 'js', 'map-config.js'), 'utf8'); const s = s0.replace(/key: '[A-Za-z0-9]*'/, "key: '" + KEY + "'").replace(/tileSize: 512,/, 'tileSize: ' + TS + ',').replace(/detail: true,(\s*tiles:)/, 'detail: ' + DETAIL + ',$1');
  if (!/key: '[A-Za-z0-9]*'/.test(s0) || !/tileSize: 512,/.test(s0) || !/detail: true,\s*tiles:/.test(s0)) throw new Error('map-config.js hat eine unerwartete Form'); return s; };
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

/* Kunstkachel: Linien auf dem 0,001°-Gradnetz */
const lonX = lon => (lon + 180) / 360, latY = lat => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const xLon = x => x * 360 - 180, yLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
const tileSvg = (z, x, y) => { const n = 2 ** z, S = 512, step = 0.001; const lon0 = xLon(x / n), lon1 = xLon((x + 1) / n), lat0 = yLat(y / n), lat1 = yLat((y + 1) / n);
  let g = `<rect width="${S}" height="${S}" fill="#20242c"/>`; const k = v => Math.round(v / step);
  for (let i = k(lon0) - 1; i <= k(lon1) + 1; i++) { const X = (lonX(i * step) * n - x) * S; g += `<line x1="${X.toFixed(2)}" x2="${X.toFixed(2)}" y1="0" y2="${S}" stroke="#4a5262" stroke-width="3"/>`; }
  for (let j = k(lat1) - 1; j <= k(lat0) + 1; j++) { const Y = (latY(j * step) * n - y) * S; g += `<line y1="${Y.toFixed(2)}" y2="${Y.toFixed(2)}" x1="0" x2="${S}" stroke="#4a5262" stroke-width="3"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${g}</svg>`; };

async function run(mode) {
  KEY = mode === 'nokey' ? '' : 'TESTKEY'; DETAIL = mode !== 'nodetail'; TS = mode === 'ts256' ? 256 : 512;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
  const reqs = [];
  await ctx.route('**api.maptiler.com/**', r => { const u = new URL(r.request().url()); reqs.push({ path: u.pathname, key: u.searchParams.get('key'), ref: r.request().headers()['referer'] || '' });
    if (/logo\.svg/.test(u.pathname)) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12"/>' });
    /* Der ECHTE Vertrag des Anbieters (5.10.2026 live geprueft): 512er OHNE Groessenangabe, 256er mit „/256/";
       „/512/…" gibt es nicht und scheitert — der fruehere Platzhalter nahm es an und verdeckte den Fehler. */
    const m = /^\/maps\/([^/]+)\/(256\/)?(\d+)\/(\d+)\/(\d+)@2x\.webp$/.exec(u.pathname);
    if (!m || mode === 'fail') return r.fulfill({ status: 403, body: 'no' });
    return r.fulfill({ contentType: 'image/svg+xml', body: tileSvg(+m[3], +m[4], +m[5]) }); });
  const tileReqs = () => reqs.filter(q => /@2x\.webp$/.test(q.path)).length;
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const R = await page.evaluate(async () => {
    document.documentElement.classList.remove('orvia-gated');
    var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
    const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
    const S = ORVIA.activityStore, today = todayStr();
    const way = [[51.4800, 7.2160], [51.4800, 7.2200], [51.4820, 7.2200], [51.4820, 7.2240], [51.4850, 7.2240], [51.4850, 7.2180], [51.4830, 7.2180], [51.4830, 7.2140], [51.4780, 7.2140], [51.4780, 7.2160], [51.4797, 7.2160]];
    const route = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < 12; k++) route.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / 12, way[i][1] + (way[i + 1][1] - way[i][1]) * k / 12]); route.push(way[way.length - 1]);
    const hr = []; for (let k = 0; k < 2160; k++) hr.push(Math.round(104 + 10 * Math.sin(k / 120)));
    S.mergeServerActivities([{ id: 'map-r1', sport_id: 'running', source: 'garmin', source_record_id: 'map-r1', started_at: today + 'T15:12:00.000Z', duration_seconds: 2160, status: 'completed',
      summary: { distance_m: 3330, avgHr: 110, maxHr: 131 }, metrics: { route: route, hasRoute: true, streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' } } },
      { id: 'map-g1', sport_id: 'gym', source: 'garmin', source_record_id: 'map-g1', started_at: today + 'T06:00:00.000Z', duration_seconds: 3000, status: 'completed', summary: { avgHr: 101 }, metrics: {} }]);
    out.enabled = ORVIA.routeMap.enabled();
    out.opened = gmOpenStory('map-r1'); await W(900);
    const pg = document.querySelector('.gm-story .wst-page.on');
    const rm = pg && pg.querySelector('.rmx'); out.cls = rm ? rm.className : null;
    const imgs = rm ? [].slice.call(rm.querySelectorAll('.rmx-t')) : [];
    out.tiles = imgs.length; out.loaded = imgs.filter(i => i.classList.contains('ok')).length;
    out.tilesShown = rm ? !!(rm.querySelector('.rmx-tiles') && getComputedStyle(rm.querySelector('.rmx-tiles')).display !== 'none') : false;
    if (rm) {
      const rb = rm.getBoundingClientRect(); out.rmx = [Math.round(rb.width), Math.round(rb.height)];
      const rects = imgs.map(i => i.getBoundingClientRect());
      out.covers = rects.length ? (Math.min(...rects.map(r => r.left)) <= rb.left && Math.min(...rects.map(r => r.top)) <= rb.top && Math.max(...rects.map(r => r.right)) >= rb.right && Math.max(...rects.map(r => r.bottom)) >= rb.bottom) : null;
      /* Fugen: jede Kachelkante liegt auf einer ganzen Pixelzahl und stoesst an den Nachbarn */
      const ls = [...new Set(rects.map(r => r.left))].sort((a, b) => a - b);
      out.noGap = rects.length ? ls.slice(1).every((x, i) => Math.abs(rects.find(r => r.left === ls[i]).right - x) < 0.01) && rects.every(r => Number.isInteger(r.left) && Number.isInteger(r.width)) : null;
      /* Lage: Start-Ring der Strecke gegen die UNABHAENGIG gerechnete Stelle des ersten Punktes */
      const st = rm.querySelector('.rmx-start').getBoundingClientRect(); const v = ORVIA.routeMap.fit(route, rb.width, rb.height, null);
      const line = rm.querySelector('.rmx-line'); out.d0 = line.getAttribute('d').slice(0, 24);
      out.start = [st.left + st.width / 2 - rb.left, st.top + st.height / 2 - rb.top];
      /* Punkt auf dem Gradnetz 51,4800/7,2160: die Kunstkachel zeichnet dort eine Kreuzung. Liegt der
         Start-Ring auf dieser Kreuzung? → Kreuzungsstelle aus Kachellage + Kachelgeometrie bestimmen. */
      const z = +rm.getAttribute('data-z'), n = 2 ** z;
      const lx = (7.2160 + 180) / 360 * n, s0 = Math.sin(51.4800 * Math.PI / 180), ly = (0.5 - Math.log((1 + s0) / (1 - s0)) / (4 * Math.PI)) * n;
      const im = imgs.find(i => new RegExp('/' + z + '/' + Math.floor(lx) + '/' + Math.floor(ly) + '@2x').test(i.getAttribute('src')));
      if (im) { const ib = im.getBoundingClientRect(); out.cross = [ib.left - rb.left + (lx - Math.floor(lx)) * ib.width, ib.top - rb.top + (ly - Math.floor(ly)) * ib.height]; }
      out.attr = (rm.querySelector('.rmx-attr') || {}).textContent || null;
      out.attrShown = !!(rm.querySelector('.rmx-attr') && getComputedStyle(rm.querySelector('.rmx-attr')).display !== 'none');
      out.pathLen = line.getTotalLength();
    }
    out.hero = pg && pg.querySelector('.wst-heronum') ? pg.querySelector('.wst-heronum').innerText.replace(/\s+/g, ' ').trim() : null;
    out.stats = pg ? [].map.call(pg.querySelectorAll('.wst-herostats div'), d => d.innerText.replace(/\s+/g, ' ').trim()) : [];
    out.sentence = pg ? /gelaufen/.test(pg.textContent) : null;
    /* Texte der Diagramm-Seite */
    const all = [].slice.call(document.querySelectorAll('.gm-story .wst-page')); const ci = all.findIndex(p => p.querySelector('.wst-dotwrap'));
    out.chartFoot = ci >= 0 ? all[ci].querySelector('.wst-foot').innerText.replace(/\s+/g, ' ').trim() : null;
    return out;
  });
  /* Anfragen zaehlen: erster Aufbau · alle Seiten durchblaettern und zurueck · schliessen + neu oeffnen */
  const n1 = tileReqs();
  const nav = await page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const n = document.querySelectorAll('.gm-story .wst-page').length;
    for (let i = 0; i < n - 1; i++) { gmStoryNext(); await W(120); } for (let i = 0; i < n - 1; i++) { gmStoryPrev(); await W(120); } await W(300);
    const pg = document.querySelector('.gm-story .wst-page.on'); const imgs = [].slice.call(pg.querySelectorAll('.rmx-t'));
    return { pages: n, backOnCover: !!pg.querySelector('.rmx'), tiles: imgs.length, shown: imgs.filter(i => i.classList.contains('ok') && i.complete && i.naturalWidth > 0).length, stats: ORVIA.routeMap.stats() }; });
  const n2 = tileReqs();
  const re = await page.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); gmStoryClose(); await W(200); gmOpenStory('map-r1'); await W(500);
    const pg = document.querySelector('.gm-story .wst-page.on'); const imgs = [].slice.call(pg.querySelectorAll('.rmx-t')); return { tiles: imgs.length, shown: imgs.filter(i => i.classList.contains('ok') && i.naturalWidth > 0).length, stats: ORVIA.routeMap.stats() }; });
  const n3 = tileReqs();
  const R2 = await page.evaluate(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
    gmStoryClose(); await W(200);
    /* Kraft ohne Strecke: Seite wie bisher (keine Karte, keine Hauptzahl-Zeile) */
    out.gymOpened = gmOpenStory('map-g1'); await W(300);
    const gp = document.querySelector('.gm-story .wst-page.on');
    out.gym = gp ? { rmx: !!gp.querySelector('.rmx'), hero: !!gp.querySelector('.wst-heronum') } : null;
    try { gmStoryClose(); } catch (_) {} await W(200);
    /* Aktivitaetsseite */
    showTab('akt'); await W(200); gmOpenActivityPage('map-r1'); await W(1100);
    const el = document.querySelector('#gmActPage .route-map'); const eb = el.getBoundingClientRect();
    out.detail = { cls: el.className, h: Math.round(eb.height), tiles: el.querySelectorAll('.rmx-t').length, oldSvg: !!el.querySelector('svg.rmap'), rmx: !!el.querySelector('.rmx') };
    return out;
  });
  const n4 = tileReqs();
  Object.assign(R, R2, { n1, n2, n3, n4, nav, re });
  await ctx.close();
  return { R, reqs, errs };
}

const T = await run('tiles');
ok('A1 App laedt ohne Laufzeitfehler, Story oeffnet', T.errs.length === 0 && T.R.opened === true, T.errs.slice(0, 2).join(' | '));
ok('A2 Karte an: alle Kacheln geladen und sichtbar', T.R.enabled === true && T.R.tiles >= 1 && T.R.loaded === T.R.tiles && T.R.tilesShown === true && /has-tiles/.test(T.R.cls), T.R.loaded + '/' + T.R.tiles);
ok('A3 Kacheln decken den Ausschnitt lueckenlos (390 × 557), ohne Fugen', T.R.covers === true && T.R.noGap === true && T.R.rmx[0] === 390 && T.R.rmx[1] === 557, JSON.stringify(T.R.rmx));
ok('A4 Strecke und Karte liegen deckungsgleich: Start-Ring sitzt auf der Kreuzung 51,4800 / 7,2160 der Kachel (± 1 px)', !!T.R.cross && Math.abs(T.R.start[0] - T.R.cross[0]) <= 1 && Math.abs(T.R.start[1] - T.R.cross[1]) <= 1, JSON.stringify([T.R.start.map(x => +x.toFixed(1)), (T.R.cross || []).map(x => +x.toFixed(1))]));
ok('A5 Anfragen: richtiger Stil, Schluessel, nur die Herkunft als Referer (kein Pfad, keine Kennung)', T.reqs.filter(q => /@2x\.webp$/.test(q.path)).length >= T.R.tiles && T.reqs.filter(q => /@2x\.webp$/.test(q.path)).every(q => /^\/maps\/basic-v2-dark\/1[3-5]\/\d+\/\d+@2x\.webp$/.test(q.path) && q.key === 'TESTKEY') && T.reqs.every(q => /^http:\/\/127\.0\.0\.1:\d+\/$/.test(q.ref)), JSON.stringify([...new Set(T.reqs.map(q => q.ref))]));
ok('A6 Quellenhinweis sichtbar', T.R.attrShown === true && /© MapTiler © OpenStreetMap contributors/.test(T.R.attr || ''));
ok('A7 Cover: Distanz als Hauptzahl, drei Kennzahlen, kein Satz mehr', /^3,33 km$/i.test(T.R.hero || '') && T.R.stats.length === 3 && /36 min/.test(T.R.stats[0]) && /10:49/.test(T.R.stats[1]) && /110 bpm/.test(T.R.stats[2]) && T.R.sentence === false, JSON.stringify([T.R.hero, T.R.stats]));
ok('A8 Diagramm-Seite: „Ø 110 bpm · Max. 131 bpm · Garmin" — ohne Erklaersatz', /Ø 110 bpm/.test(T.R.chartFoot || '') && /Max\. 131 bpm/.test(T.R.chartFoot || '') && /garmin/i.test(T.R.chartFoot || '') && !/nachgerechnet|über die Einheit/.test(T.R.chartFoot || ''), T.R.chartFoot);
ok('A9 Aktivitaetsseite (seit v8-435): Karte im bestehenden Feld (255 px), alte Zeichnung ersetzt, hoechstens 4 Kacheln', T.R.detail.rmx === true && T.R.detail.oldSvg === false && T.R.detail.h === 255 && T.R.detail.tiles >= 1 && /has-rmx/.test(T.R.detail.cls) && T.R.n4 - T.R.n3 <= 4, JSON.stringify(Object.assign({ neu: T.R.n4 - T.R.n3 }, T.R.detail)));
ok('A11 Anfragen je Story: hoechstens 6 Kacheln beim ersten Oeffnen', T.R.n1 === T.R.tiles && T.R.n1 <= 6, 'Kacheln: ' + T.R.n1);
ok('A12 alle Seiten durchblaettern und zurueck: KEINE weitere Kachel-Anfrage, Karte steht sofort wieder', T.R.n2 === T.R.n1 && T.R.nav.backOnCover === true && T.R.nav.shown === T.R.nav.tiles && T.R.nav.stats.reused >= T.R.tiles, JSON.stringify({ n1: T.R.n1, n2: T.R.n2, seiten: T.R.nav.pages, st: T.R.nav.stats }));
ok('A13 Story schliessen und neu oeffnen: weiterhin keine neue Anfrage (Sitzungsspeicher)', T.R.n3 === T.R.n1 && T.R.re.shown === T.R.re.tiles && T.R.re.tiles === T.R.tiles, JSON.stringify({ n3: T.R.n3, st: T.R.re.stats }));
ok('A14 insgesamt gingen nur Kacheln der Story und des Kartenfelds + EINMAL das Logo hinaus', T.reqs.length === T.R.n4 + 1 && T.reqs.filter(q => /logo\.svg/.test(q.path)).length === 1, 'Anfragen gesamt: ' + T.reqs.length);
ok('A10 Einheit ohne Strecke (Kraft): Seite wie bisher, keine Karte', T.R.gymOpened === true ? (T.R.gym && T.R.gym.rmx === false && T.R.gym.hero === false) : true, JSON.stringify(T.R.gym));

/* 256er-Rueckfall: eine Zeile in map-config.js (tileSize: 256) — Karte, Lage und Wiederverwendung bleiben richtig */
const S = await run('ts256');
ok('A16 Rueckfall tileSize 256: alle Kacheln ueber „/256/" geladen, lueckenlos, Strecke deckungsgleich (± 1 px)', S.errs.length === 0 && S.R.tiles >= 1 && S.R.loaded === S.R.tiles && S.R.covers === true && S.R.noGap === true && S.reqs.filter(q => /@2x\.webp$/.test(q.path)).every(q => /^\/maps\/basic-v2-dark\/256\/1[4-6]\/\d+\/\d+@2x\.webp$/.test(q.path)) && !!S.R.cross && Math.abs(S.R.start[0] - S.R.cross[0]) <= 1 && Math.abs(S.R.start[1] - S.R.cross[1]) <= 1, JSON.stringify({ kacheln: S.R.tiles, start: S.R.start.map(x => +x.toFixed(1)), kreuzung: (S.R.cross || []).map(x => +x.toFixed(1)) }));
ok('A17 … und auch dort keine erneute Anfrage beim Blaettern und Wiederoeffnen', S.R.n2 === S.R.n1 && S.R.n3 === S.R.n1 && S.R.n1 === S.R.tiles && S.R.n1 <= 24, JSON.stringify({ n1: S.R.n1, n2: S.R.n2, n3: S.R.n3 }));

const D = await run('nodetail');
ok('A15 Schalter detail:false: Aktivitaetsseite zeigt die bisherige Zeichnung, keine Kachel-Anfrage von dort', D.R.detail.rmx === false && D.R.detail.oldSvg === true && D.R.detail.h === 255 && !/has-rmx/.test(D.R.detail.cls) && D.R.n4 === D.R.n3 && D.errs.length === 0, JSON.stringify(D.R.detail));

const N = await run('nokey');
ok('B1 ohne Schluessel: KEINE einzige Anfrage an den Kartenanbieter', N.reqs.length === 0 && N.R.enabled === false, 'Anfragen: ' + N.reqs.length);
ok('B2 … Cover steht trotzdem (Strecke + Hauptzahl), ohne Kartenebene und ohne Quellenhinweis', N.R.tiles === 0 && /^3,33 km$/i.test(N.R.hero || '') && N.R.attr === null && N.R.pathLen > 100 && N.errs.length === 0, JSON.stringify([N.R.cls, N.R.hero]));
ok('B3 … Aktivitaetsseite zeigt exakt die bisherige Zeichnung', N.R.detail.oldSvg === true && N.R.detail.rmx === false && !/has-rmx/.test(N.R.detail.cls), JSON.stringify(N.R.detail));

const F = await run('fail');
ok('C1 Kacheln nicht ladbar: Kartenebene und Quellenhinweis gehen aus, Strecke + Hauptzahl bleiben', /tiles-failed/.test(F.R.cls || '') && F.R.tilesShown === false && F.R.attrShown === false && /^3,33 km$/i.test(F.R.hero || '') && F.R.pathLen > 100 && F.errs.length === 0, F.R.cls);
ok('C2 … Aktivitaetsseite zeigt die bisherige Zeichnung', F.R.detail.oldSvg === true && F.R.detail.rmx === false && !/has-rmx/.test(F.R.detail.cls), JSON.stringify(F.R.detail));
ok('C3 … und es wird nicht endlos nachgefragt: nach dem Fehlschlag keine weiteren Versuche (Blaettern, neu oeffnen)', F.R.n1 === F.R.tiles && F.R.n2 === F.R.n1 && F.R.n3 === F.R.n1 && F.R.re.stats.pausedMs > 0, JSON.stringify({ n1: F.R.n1, n2: F.R.n2, n3: F.R.n3, tiles: F.R.tiles }));

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' route_map_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
