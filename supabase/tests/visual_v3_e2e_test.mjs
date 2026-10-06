/* ORVIA · visual_v3_e2e (v8-444) — der V3-Feinschliff im ECHTEN Browser.

   Gians Auftrag 6.10. abends: aus „dunkle Sport-App mit farbiger Strecke" soll erkennbar EIN System werden.
   Geprueft wird die echte App mit BERECHNETEN Stilen (getComputedStyle) und Farben am Bildschirm:
     · Bedienelemente (Zurueck, Story schliessen, Oeffnen-Zeichen der Karte) tragen EINE Flaeche und EINEN Rand
     · Aktivitaetsseite: Kennzahl-Kacheln aus einem Material; Story ist die Hauptaktion und steht vor dem Loeschen
     · Gold nur an Rahmen/Bedienung und ORVIAs eigener Stimme — nie an einer Datenzahl
     · Schwimmen ohne Strecke: Wellenfeld als Hero (Seite + Story-Abschluss); andere Sportarten nicht
     · Story: Fortschritt mit goldener Spitze, Abschnittsnamen mit Gold-Strich, Hauptzahl benannt
     · Diagramm-Tafel: Material, Raster, Ø-Schild
     · Darstellungsfehler aus der Entwicklung: sechs gleiche Kennzahl-Kacheln sehen gleich aus
   NICHT geprueft: Safari auf dem iPhone, das echte Kartenbild (hier Kunstkacheln, Weg ueber Bildkacheln).

   node supabase/tests/visual_v3_e2e_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

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

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
/* ausgeliefert wird die ECHTE map-config.js — ersetzt wird nur der Schluessel */
/* Die Farben werden ueber den Weg mit Bildkacheln geprueft (Strecke und Marken sind dort SVG und haben
   berechnete Farben). Die gezeichnete Karte prueft ihre Farben am Bildschirm: route_map_gl_e2e_test.mjs. */
const cfgFile = () => { const s0 = readFileSync(join(APP, 'js', 'map-config.js'), 'utf8'); if (!/key: '[A-Za-z0-9]*'/.test(s0) || !/engine: 'vector',/.test(s0)) throw new Error('map-config.js hat eine unerwartete Form'); return s0.replace(/key: '[A-Za-z0-9]*'/, "key: 'TESTKEY'").replace(/engine: 'vector',/, "engine: 'raster',"); };
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

/* Sollfarben = die Vorgabe (rgb, wie der Browser sie meldet) */
const RGB = { running: '255, 154, 92', cycling: '93, 170, 255', swimming: '72, 216, 207', strength: '216, 187, 122', brand: '216, 187, 122' };
const START = '67, 214, 158', FINISH = '255, 100, 100', TEXT = '244, 242, 237';
const has = (v, rgb) => new RegExp('rgba?\\(' + rgb.replace(/, /g, ',\\s*') + '(,|\\))').test(String(v || ''));

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
await ctx.route('**api.maptiler.com/**', r => { const u = new URL(r.request().url());
  if (/logo\.svg/.test(u.pathname)) return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12"/>' });
  if (!/^\/maps\/[^/]+\/(256\/)?\d+\/\d+\/\d+@2x\.webp$/.test(u.pathname)) return r.fulfill({ status: 403, body: 'no' });
  return r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" preserveAspectRatio="none"><rect width="512" height="512" fill="rgb(44,44,44)"/></svg>' }); });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  document.documentElement.classList.remove('orvia-gated');
  var g = document.getElementById('ogErr'); while (g && g.parentElement && g.parentElement !== document.body) g = g.parentElement; if (g) g.style.display = 'none';
  const mk = (way, n) => { const r = []; for (let i = 0; i < way.length - 1; i++) for (let k = 0; k < n; k++) r.push([way[i][0] + (way[i + 1][0] - way[i][0]) * k / n, way[i][1] + (way[i + 1][1] - way[i][1]) * k / n]); r.push(way[way.length - 1]); return r; };
  const ser = (n, f) => { const a = []; for (let k = 0; k < n; k++) a.push(f(k)); return a; };
  const d = todayStr(), hr = ser(120, k => Math.round(130 + 12 * Math.sin(k / 9)));
  ORVIA.activityStore.mergeServerActivities([
    { id: 't-run', sport_id: 'running', source: 'garmin', source_record_id: 't-run', started_at: d + 'T15:12:00.000Z', duration_seconds: 2160, status: 'completed', summary: { distance_m: 6330, avgHr: 148, maxHr: 171 },
      metrics: { route: mk([[51.48, 7.216], [51.48, 7.22], [51.482, 7.22], [51.482, 7.224], [51.485, 7.224], [51.485, 7.218], [51.4797, 7.216]], 10), hasRoute: true, streams: { heart_rate: hr, speed: ser(120, k => 2.9 + 0.3 * Math.sin(k / 7)), cadence: ser(120, k => 168 + (k % 5)), elevation: ser(120, k => 90 + 8 * Math.sin(k / 20)) }, stream_units: { heart_rate: 'bpm' } } },
    { id: 't-bike', sport_id: 'cycling', source: 'garmin', source_record_id: 't-bike', started_at: d + 'T09:05:00.000Z', duration_seconds: 5400, status: 'completed', summary: { distance_m: 41200, avgHr: 136, maxHr: 162, avgPower: 182 },
      metrics: { route: mk([[51.48, 7.21], [51.50, 7.26], [51.53, 7.27], [51.55, 7.22], [51.51, 7.12], [51.481, 7.208]], 12), hasRoute: true, streams: { heart_rate: hr, speed: ser(120, k => 7.6 + Math.sin(k / 6)), power: ser(120, k => 180 + 50 * Math.sin(k / 5)) }, stream_units: { heart_rate: 'bpm' } } },
    { id: 't-swim', sport_id: 'swimming', source: 'garmin', source_record_id: 't-swim', started_at: d + 'T06:30:00.000Z', duration_seconds: 2400, status: 'completed', summary: { distance_m: 1500, avgHr: 128, maxHr: 149 }, metrics: { streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' } } },
    { id: 't-gym', sport_id: 'gym', source: 'orvia_workout', source_record_id: 't-gym', workout_session_id: 't-gym', started_at: d + 'T18:00:00.000Z', duration_seconds: 4020, status: 'completed', summary: { exerciseCount: 2, workingSetCount: 5, avgHr: 112 },
      metrics: { streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' }, exercises: [{ name: 'Bankdrücken', sets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }, { reps: 7, weight: 70 }] }, { name: 'Rudern', sets: [{ reps: 12, weight: 50 }, { reps: 11, weight: 50 }] }] } },
    { id: 't-foot', sport_id: 'football', source: 'garmin', source_record_id: 't-foot', started_at: d + 'T20:00:00.000Z', duration_seconds: 5400, status: 'completed', summary: { avgHr: 141, maxHr: 178 }, metrics: { streams: { heart_rate: hr }, stream_units: { heart_rate: 'bpm' } } }
  ]);
});


const GOLD = '216, 187, 122';
const cs = `e => e ? getComputedStyle(e) : null`;
const openPage = async id => { await page.evaluate(async id => { try { gmStoryClose(); } catch (_) { } showTab('akt'); await new Promise(r => setTimeout(r, 150)); gmOpenActivityPage(id); await new Promise(r => setTimeout(r, 1200)); }, id); };
const READ = `(() => { const pg = document.getElementById('gmActPage'), cs = (e, p) => e ? getComputedStyle(e, p) : null;
  const back = pg.querySelector('.backbtn'), open = pg.querySelector('.route-map .rmx-open'), kp = [].slice.call(pg.querySelectorAll('.detail-kpis > div'));
  const story = pg.querySelector('.gm-story-cta'), del = pg.querySelector('.gm-corr .danger-btn'), k = pg.querySelector('.plan-kicker'), hero = pg.querySelector('.act-hero');
  const ctl = e => e ? { bg: cs(e).backgroundImage, border: cs(e).borderTopColor, shadow: cs(e).boxShadow, col: cs(e).color } : null;
  const order = story && del ? !!(story.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  return { act: pg.getAttribute('data-activity'), back: ctl(back), open: ctl(open),
    kpi: kp.map(d => ({ bg: cs(d).backgroundImage, border: cs(d).borderTopColor, shadow: cs(d).boxShadow, key: d.classList.contains('key'), col: cs(d.querySelector('b')).color, box: (b => [b.left, b.top, b.right, b.bottom])(d.getBoundingClientRect()) })),
    story: story ? { border: cs(story).borderTopColor, icon: cs(story.querySelector('.ic')).color, col: cs(story).color, h: story.getBoundingClientRect().height } : null,
    del: del ? { border: cs(del).borderTopColor, col: cs(del).color, bg: cs(del).backgroundColor, h: del.getBoundingClientRect().height, size: cs(del).fontSize } : null, order: order,
    kickTick: k ? { w: cs(k, '::before').width, bg: cs(k, '::before').backgroundColor, col: cs(k).color } : null,
    hair: cs(pg.querySelector('.page-head'), '::after').backgroundImage, hairH: cs(pg.querySelector('.page-head'), '::after').height,
    hero: hero ? { h: hero.getBoundingClientRect().height, paths: hero.querySelectorAll('svg path').length, stroke: cs(hero.querySelector('svg path')).stroke, stop: cs(hero.querySelector('.act-wvg stop')).stopColor, tf: cs(hero).transform, mask: cs(hero).maskImage || cs(hero).webkitMaskImage, next: hero.nextElementSibling && hero.nextElementSibling.className, prev: hero.previousElementSibling && hero.previousElementSibling.className, aria: hero.getAttribute('aria-hidden') } : null,
    map: !!pg.querySelector('.route-map'), debrief: (e => e ? cs(e).color : null)(pg.querySelector('.db-card .ctitle .l .ic') || pg.querySelector('.coach-card h3 .ic')),
    link: (e => e ? { col: cs(e).color, deco: cs(e).textDecorationColor } : null)(pg.querySelector('.gm-inline-link')) }; })()`;
const rgbOf = v => (String(v || '').match(/\d+(\.\d+)?/g) || []).map(Number);
const isGold = (v, a) => { const c = rgbOf(v); return c[0] === 216 && c[1] === 187 && c[2] === 122 && (a == null || Math.abs((c[3] == null ? 1 : c[3]) - a) < 0.005); };
/* Farben am Bildschirm */
const pixels = async pts => { const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async ([b64, pts]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const k = img.width / innerWidth; return pts.map(p => Array.from(x.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data).slice(0, 3)); }, [b64, pts]); };

/* ══════════ 1 · Aktivitaetsseite: Laufen ══════════ */
await openPage('t-run'); const run = await page.evaluate(READ);
sec('Bedienelemente: eine Flaeche, ein Rand');
ok('A1 Zurueck-Knopf und Oeffnen-Zeichen der Karte tragen dieselbe Flaeche (dunkler Verlauf), denselben Goldrand (16 %) und denselben Schatten', !!run.back && !!run.open && /linear-gradient/.test(run.back.bg) && run.back.bg === run.open.bg && isGold(run.back.border, 0.16) && run.back.border === run.open.border && run.back.shadow === run.open.shadow && /inset/.test(run.back.shadow), JSON.stringify([run.back, run.open && run.open.border]));
ok('A2 das Zeichen im Knopf bleibt neutral (kein goldener Knopf)', has(run.back.col, TEXT) && has(run.open.col, TEXT), JSON.stringify([run.back.col, run.open.col]));
sec('Aktivitaetsseite als ein Guss');
ok('B1 sechs Kennzahl-Kacheln aus EINEM Material: derselbe Verlauf, derselbe Rand, dieselbe helle Oberkante', run.kpi.length === 6 && run.kpi.every(k => k.bg === run.kpi[0].bg && k.border === run.kpi[0].border && k.shadow === run.kpi[0].shadow) && /linear-gradient/.test(run.kpi[0].bg) && /inset/.test(run.kpi[0].shadow), JSON.stringify(run.kpi[0]));
ok('B2 weiter genau EINE farbige Hauptkennzahl (Farbe der Sportart), alle anderen neutral — Gold an keiner Zahl', run.kpi.filter(k => has(k.col, RGB.running)).length === 1 && run.kpi.filter(k => !has(k.col, RGB.running)).every(k => rgbOf(k.col).slice(0, 3).every(v => v >= 230)) && run.kpi.every(k => !isGold(k.col)), JSON.stringify(run.kpi.map(k => k.col)));
ok('B3 Story ist die Hauptaktion: steht VOR dem Loeschen, Goldrand (24 %), Stern in Gold, Schrift neutral', !!run.story && run.order === true && isGold(run.story.border, 0.24) && isGold(run.story.icon) && has(run.story.col, TEXT), JSON.stringify([run.order, run.story]));
ok('B4 Loeschen bleibt erreichbar, tritt aber zurueck: kleiner, ohne Flaeche, leiser Rand und Sekundaerschrift', !!run.del && run.del.h < run.story.h - 4 && run.del.h >= 40 && /rgba\(0, 0, 0, 0\)/.test(run.del.bg) && has(run.del.col, '173, 181, 193') && !isGold(run.del.border), JSON.stringify(run.del));
ok('B5 Kennzeichen der Sportart mit kurzem Strich davor — in der Farbe der Sportart, nicht in Gold', !!run.kickTick && run.kickTick.w === '14px' && has(run.kickTick.bg, RGB.running) && has(run.kickTick.col, RGB.running), JSON.stringify(run.kickTick));
ok('B6 Gold-Haarlinie unter dem Kopf (1 px, laeuft zu beiden Seiten aus)', run.hairH === '1px' && /linear-gradient\(90deg, rgba\(0, 0, 0, 0\) 0(px|%), rgba\(216, 187, 122, 0\.24\) 22%, rgba\(216, 187, 122, 0\.24\) 78%, rgba\(0, 0, 0, 0\) 100%\)/.test(run.hair), run.hair);
ok('B7 ORVIAs eigene Stimme traegt Gold: der Stern am Debrief', isGold(run.debrief), String(run.debrief));
ok('B8 Laufen hat die Karte als Hero — kein Wellenfeld', run.map === true && run.hero === null);

/* ══════════ 2 · Schwimmen ══════════ */
await openPage('t-swim'); const swim = await page.evaluate(READ);
sec('Schwimmen: eigener Hero ohne Karte');
ok('C1 Schwimmen ohne Strecke: Wellenfeld im Platz der Karte (zwischen Kopf und Titel), 150 px hoch, rein dekorativ (aria-hidden)', !!swim.hero && swim.map === false && Math.abs(swim.hero.h - 150) < 0.5 && /page-head/.test(String(swim.hero.prev)) && /detail-title/.test(String(swim.hero.next)) && swim.hero.aria === 'true', JSON.stringify(swim.hero && [swim.hero.h, swim.hero.prev, swim.hero.next]));
ok('C2 sieben Wellenlinien in der Farbe der Sportart (Aqua) — die Farbe kommt aus dem Thema, nicht aus dem Markup', swim.hero.paths === 7 && has(swim.hero.stop, RGB.swimming) && /url\(/.test(swim.hero.stroke), JSON.stringify([swim.hero.paths, swim.hero.stop, swim.hero.stroke]));
ok('C3 eigene Ebene, keine Maske (Schutz vor Darstellungsfehlern unter der bewegten Zeichnung)', /matrix/.test(String(swim.hero.tf)) && (!swim.hero.mask || swim.hero.mask === 'none'), JSON.stringify([swim.hero.tf, swim.hero.mask]));
{ /* Darstellungsfehler aus der Entwicklung: gleiche Kacheln muessen gleich aussehen (vier Ecken je Kachel) */
  const pts = []; swim.kpi.forEach(k => { pts.push([k.box[0] + 12, k.box[1] + 6], [k.box[2] - 12, k.box[1] + 6], [k.box[0] + 12, k.box[3] - 6], [k.box[2] - 12, k.box[3] - 6]); });
  const px = await pixels(pts); let spread = 0;
  for (let c = 0; c < 4; c++) { const v = swim.kpi.map((_, i) => px[i * 4 + c][0]); spread = Math.max(spread, Math.max(...v) - Math.min(...v)); }
  ok('C4 die sechs Kennzahl-Kacheln unter dem Wellenfeld sehen gleich aus (Streuung je Ecke ≤ 3 Helligkeitsstufen; ohne eigene Ebene waren es 42)', swim.kpi.length === 6 && spread <= 3, 'Streuung ' + spread); }
ok('C5 dieselbe Sprache wie Lauf und Rad: Kennzeichen-Strich, eine Hauptkennzahl, Story vor Loeschen — alles in Aqua bzw. Gold wie dort', has(swim.kickTick.bg, RGB.swimming) && swim.kpi.filter(k => has(k.col, RGB.swimming)).length === 1 && swim.order === true && isGold(swim.story.border, 0.24) && swim.kpi[0].bg === run.kpi[0].bg, JSON.stringify([swim.kickTick, swim.order]));
await openPage('t-gym'); const gym = await page.evaluate(READ);
ok('C6 andere Sportarten ohne Strecke bekommen KEIN Wellenfeld (Kraft)', gym.hero === null && gym.map === false);
ok('C7 Textlink der Seite („Dauer korrigieren") ohne Browser-Blau: helle Schrift, goldene Unterstreichung', !gym.link || (has(gym.link.col, TEXT) && isGold(gym.link.deco, 0.24)), JSON.stringify(gym.link));

/* ══════════ 3 · Story ══════════ */
const story = async (id, idx) => page.evaluate(async ([id, idx]) => {
  try { gmStoryClose(); } catch (_) { } gmOpenStory(id); await new Promise(r => setTimeout(r, 500)); try { gmStoryStop(); } catch (_) { }
  if (idx) { _gmStory.idx = idx; gmStoryRender(); try { gmStoryStop(); } catch (_) { } await new Promise(r => setTimeout(r, 500)); }
  const cs = (e, p) => e ? getComputedStyle(e, p) : null, st = document.querySelector('.gm-story'), pg = st.querySelector('.wst-page.on');
  const bars = [].slice.call(st.querySelectorAll('.wst-bars i')), x = st.querySelector('.wst-x'), kick = pg.querySelector('.wst-kick'), hs = pg.querySelector('.wst-herostats'), wv = pg.querySelector('.wst-waves');
  const dw = pg.querySelector('.wst-dotwrap'), grid = pg.querySelectorAll('.wst-grid line'), pill = pg.querySelector('.wst-avgpill b'), cell = pg.querySelector('.wst-cell');
  return { n: _gmStory.pages.length, bars: bars.length, barH: bars.length ? cs(bars[0]).height : null, track: bars.length ? cs(bars[bars.length - 1]).backgroundColor : null, act: (b => b ? cs(b).backgroundImage : null)(st.querySelector('.wst-bars i.act b')), done: (b => b ? cs(b).backgroundColor : null)(st.querySelector('.wst-bars i.done b')),
    x: x ? { bg: cs(x).backgroundImage, border: cs(x).borderTopColor, w: cs(x).width, col: cs(x).color, shadow: cs(x).boxShadow } : null,
    kick: kick ? { txt: kick.textContent, tick: cs(kick, '::before').backgroundColor, tickW: cs(kick, '::before').width, col: cs(kick).color, inHero: !!kick.closest('.wst-hero') } : null,
    heroNum: (e => e ? e.textContent : null)(pg.querySelector('.wst-heronum b')), hs: hs ? { bt: cs(hs).borderTopWidth, bg: cs(hs).backgroundImage } : null,
    bg: cs(pg.querySelector('.wst-bg')).backgroundImage,
    waves: wv ? { paths: wv.querySelectorAll('path').length, stop: cs(wv.querySelector('.act-wvg stop')).stopColor, z: cs(wv).zIndex, tf: cs(wv).transform, cls: pg.querySelector('.wst-in').className, big: (e => e ? e.textContent : null)(pg.querySelector('.wst-bignum b')) } : null,
    chart: dw ? { bg: cs(dw).backgroundImage, border: cs(dw).borderTopColor, hair: cs(dw, '::before').backgroundImage, hairH: cs(dw, '::before').height, dash: grid.length ? cs(grid[0]).strokeDasharray : null, vOp: (l => l ? cs(l).opacity : null)(pg.querySelector('.wst-grid line[y1="0"]')), hOp: grid.length ? cs(grid[0]).opacity : null,
      line: cs(pg.querySelector('.wst-line')).stroke, lineW: cs(pg.querySelector('.wst-line')).strokeWidth, pillBorder: pill ? cs(pill).borderTopColor : null, pillEm: (e => e ? cs(e).color : null)(pg.querySelector('.wst-avgpill em')), ref: (e => e ? cs(e).color : null)(pg.querySelector('.wst-ref')) } : null,
    cell: cell ? { bg: cs(cell).backgroundImage, border: cs(cell).borderTopColor } : null }; }, [id, idx || 0]);
sec('Story: Fortschritt, Kopf, Hero');
const sRun = await story('t-run', 0);
ok('D1 Fortschritt feiner (2,5 px) mit goldener Spitze am laufenden Abschnitt; Spur neutral', sRun.bars === sRun.n && sRun.barH === '2.5px' && /rgba\(255, 255, 255, 0\.14\)/.test(sRun.track) && /linear-gradient\(90deg, rgba\(244, 242, 237, 0\.92\) 0(px|%), rgba\(244, 242, 237, 0\.92\) 58%, rgb\(227, 203, 149\) 100%\)/.test(String(sRun.act)), JSON.stringify([sRun.barH, sRun.track, sRun.act]));
ok('D2 Schliessen-Knopf der Story = dasselbe Bedienelement wie der Zurueck-Knopf der Seite (Flaeche, Rand, Schatten)', !!sRun.x && sRun.x.bg === run.back.bg && sRun.x.border === run.back.border && sRun.x.shadow === run.back.shadow && sRun.x.w === '36px', JSON.stringify(sRun.x));
ok('D3 Abschluss mit Strecke: die Hauptzahl ist benannt („Distanz") — Abschnittsname mit Gold-Strich, Schrift neutral', !!sRun.kick && sRun.kick.inHero === true && /Distanz/i.test(sRun.kick.txt) && isGold(sRun.kick.tick) && sRun.kick.tickW === '16px' && !isGold(sRun.kick.col) && /6,33/.test(String(sRun.heroNum)), JSON.stringify(sRun.kick));
ok('D4 Gold-Haarlinie ueber den Kennzahlen des Abschlusses statt grauer Linie', !!sRun.hs && sRun.hs.bt === '0px' && /rgba\(216, 187, 122, 0\.24\)/.test(sRun.hs.bg), JSON.stringify(sRun.hs));
ok('D5 Grund der Story: Stimmung der Sportart von oben, leiser Goldton (10 %) von unten, fester Grund', /radial-gradient\(120% 30% at 50% 108%, rgba\(216, 187, 122, 0\.1\) 0%/.test(sRun.bg) && /rgba\(255, 154, 92, 0\.14\)/.test(sRun.bg), sRun.bg.slice(0, 200));
sec('Story: Diagramm-Tafel');
const sChart = await story('t-run', 1);
ok('E1 Tafel: tiefes Material mit Gold-Haarlinie an der Oberkante (1 px) — das einzige Schmuckelement', !!sChart.chart && /linear-gradient\(rgb\(13, 28, 45\) 0(px|%), rgb\(8, 20, 33\) 100%\)/.test(sChart.chart.bg) && sChart.chart.hairH === '1px' && /rgba\(216, 187, 122, 0\.24\)/.test(sChart.chart.hair), JSON.stringify(sChart.chart && [sChart.chart.bg, sChart.chart.hairH]));
ok('E2 Raster aus feinen Punkten; senkrechte Linien treten zurueck (45 %)', !!sChart.chart && /^1(px)?,? 5(px)?$/.test(String(sChart.chart.dash).replace(/\s+/g, ' ')) && sChart.chart.vOp === '0.45' && sChart.chart.hOp === '1', JSON.stringify([sChart.chart.dash, sChart.chart.vOp, sChart.chart.hOp]));
ok('E3 Kurve weiter in der Farbe der Sportart, 2,2 px; Gold an keiner Kurve', has(sChart.chart.line, RGB.running) && sChart.chart.lineW === '2.2px' && !isGold(sChart.chart.line), JSON.stringify([sChart.chart.line, sChart.chart.lineW]));
ok('E4 Ø-Schild als kleines Instrument: feiner heller Rand (24 %), „Ø" in der Farbe der Sportart; Max/Min in Sekundaerschrift', /rgba\(255, 255, 255, 0\.24\)/.test(String(sChart.chart.pillBorder)) && has(sChart.chart.pillEm, RGB.running) && has(sChart.chart.ref, '173, 181, 193'), JSON.stringify([sChart.chart.pillBorder, sChart.chart.pillEm, sChart.chart.ref]));
ok('E5 Abschnittsname der Diagramm-Seite mit Gold-Strich', !!sChart.kick && isGold(sChart.kick.tick) && sChart.kick.inHero === false, JSON.stringify(sChart.kick));
const sNum = await story('t-run', sRun.n - 1);
ok('E6 Kennzahl-Kacheln der Story aus demselben Material wie auf der Seite', !!sNum.cell && sNum.cell.bg === run.kpi[0].bg && sNum.cell.border === run.kpi[0].border, JSON.stringify(sNum.cell));
sec('Story: Schwimmen');
const sSwim = await story('t-swim', 0);
ok('F1 Abschluss ohne Strecke: Wellenfeld hinter der grossen Zahl (neun Linien, Aqua), Zahl bleibt die Distanz', !!sSwim.waves && sSwim.waves.paths === 9 && has(sSwim.waves.stop, RGB.swimming) && /wst-wavepg/.test(sSwim.waves.cls) && /1\.500/.test(String(sSwim.waves.big)), JSON.stringify(sSwim.waves));
ok('F2 das Wellenfeld liegt UNTER Text und Zahl, auf eigener Ebene', sSwim.waves.z === '0' && /matrix3d|matrix/.test(String(sSwim.waves.tf)), JSON.stringify([sSwim.waves.z, sSwim.waves.tf]));
const sGym = await story('t-gym', 0);
ok('F3 Kraft-Story ohne Wellenfeld (nur Schwimmen)', sGym.waves === null);
await page.evaluate(() => { try { gmStoryClose(); } catch (_) { } });

sec('Fehlerfreiheit');
ok('G1 keine Laufzeitfehler im ganzen Durchlauf', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' visual_v3_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
