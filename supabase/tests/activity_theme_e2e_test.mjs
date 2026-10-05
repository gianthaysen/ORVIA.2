/* ORVIA · activity_theme_e2e (v8-439) — das Farbsystem im ECHTEN Browser.

   Gians Auftrag 5.10.: jede Sportart hat EINE Farbe, ueberall dieselbe — Strecke, Diagramm,
   Schlagzeile, Hauptkennzahl, Kennzeichen. Start/Ziel und Zustaende bleiben Gruen/Rot.
   Geprueft wird die echte App (echter Store, echte Aktivitaetsseite, echte Story) mit
   BERECHNETEN Farben (getComputedStyle), nicht mit Zeichenketten aus dem Quelltext:
     · Laufen, Rad, Schwimmen, Kraft: Seite, Strecke, Messreihen, Story, Liste, Start-Auswahl
     · Sportart ohne Thema (Fussball) ⇒ ORVIA-Gold
     · Start gruen, Ziel rot — in jeder Sportart gleich
     · genau EINE farbige Hauptkennzahl; alle anderen neutral
   Die Karte laeuft hier gegen Kunstkacheln; der echte Kartenstil und Safari auf dem iPhone
   sind damit NICHT geprueft.

   node supabase/tests/activity_theme_e2e_test.mjs [appRoot-absolut] */
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
const cfgFile = () => { const s0 = readFileSync(join(APP, 'js', 'map-config.js'), 'utf8'); if (!/key: '[A-Za-z0-9]*'/.test(s0)) throw new Error('map-config.js hat eine unerwartete Form'); return s0.replace(/key: '[A-Za-z0-9]*'/, "key: 'TESTKEY'"); };
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

/* Auslesen der Aktivitaetsseite */
const PAGE = `(() => { const pg = document.getElementById('gmActPage'); const cs = e => e ? getComputedStyle(e) : null;
  const k = pg.querySelector('.plan-kicker'), line = pg.querySelector('.route-map .rmx-line'), st = pg.querySelector('.route-map .rmx-start'), en = pg.querySelector('.route-map .rmx-end');
  const kpi = [].slice.call(pg.querySelectorAll('.detail-kpis > div')).map(d => ({ key: d.classList.contains('key'), col: cs(d.querySelector('b')).color, lbl: d.querySelector('span').textContent }));
  const lines = [].slice.call(pg.querySelectorAll('.oc2 .g-line')).map(l => cs(l).stroke), marks = [].slice.call(pg.querySelectorAll('.oc2 .g-mm')).map(l => cs(l).stroke);
  const tiles = pg.querySelector('.route-map.has-rmx .rmx-tiles');
  return { act: pg.getAttribute('data-activity'), primary: cs(pg).getPropertyValue('--activity-primary').trim(), kicker: k ? cs(k).color : null, kpi: kpi,
    line: line ? cs(line).stroke : null, lineW: line ? parseFloat(cs(line).strokeWidth) : null, caseW: pg.querySelector('.route-map .rmx-case') ? parseFloat(cs(pg.querySelector('.route-map .rmx-case')).strokeWidth) : null,
    start: st ? cs(st).stroke : null, end: en ? cs(en).fill : null, lines: lines, marks: marks, bg: cs(pg).backgroundImage, mask: tiles ? (cs(tiles).maskImage || cs(tiles).webkitMaskImage) : null, state: (pg.querySelector('.session-state') || {}).textContent || '' }; })()`;
const openPage = async id => { await page.evaluate(async id => { showTab('akt'); await new Promise(r => setTimeout(r, 150)); gmOpenActivityPage(id); await new Promise(r => setTimeout(r, 1100)); }, id); return page.evaluate(PAGE); };
/* Story: alle Seiten durchgehen und Farben einsammeln */
const story = async id => page.evaluate(async id => {
  gmOpenStory(id); await new Promise(r => setTimeout(r, 500)); try { gmStoryStop(); } catch (_) { }
  const out = { n: _gmStory.pages.length, acts: [], em: [], line: [], glow: [], key: [], cells: [], pill: [], mapLine: null, mapStart: null, mapEnd: null, bg: [] };
  const cs = e => getComputedStyle(e);
  for (let i = 0; i < out.n; i++) {
    _gmStory.idx = i; gmStoryRender(); try { gmStoryStop(); } catch (_) { } await new Promise(r => setTimeout(r, 350));
    /* alle Seiten stehen im Dokument — ausgewertet wird nur die sichtbare */
    const st = document.querySelector('.gm-story .wst-page.on');
    [].forEach.call(st.querySelectorAll('[data-activity]'), e => out.acts.push(e.getAttribute('data-activity')));
    [].forEach.call(st.querySelectorAll('.wst-em'), e => out.em.push(cs(e).color));
    [].forEach.call(st.querySelectorAll('.wst-line'), e => out.line.push(cs(e).stroke));
    [].forEach.call(st.querySelectorAll('.wst-glow'), e => out.glow.push(cs(e).stroke));
    [].forEach.call(st.querySelectorAll('.wst-avgpill em'), e => out.pill.push(cs(e).color));
    [].forEach.call(st.querySelectorAll('.wst-cell'), e => { (e.classList.contains('key') ? out.key : out.cells).push(cs(e.querySelector('b')).color); });
    const bg = st.querySelector('.wst-bg'); if (bg) out.bg.push(cs(bg).backgroundImage);
    const ml = st.querySelector('.wst-mapbg .rmx-line'); if (ml) { out.mapLine = cs(ml).stroke; out.mapStart = cs(st.querySelector('.wst-mapbg .rmx-start')).stroke; out.mapEnd = cs(st.querySelector('.wst-mapbg .rmx-end')).fill; }
  }
  try { gmStoryClose(); } catch (_) { } await new Promise(r => setTimeout(r, 150));
  return out;
}, id);

const CASES = [['t-run', 'running', 'Laufen', 'DISTANZ', true], ['t-bike', 'cycling', 'Radfahren', 'DISTANZ', true], ['t-swim', 'swimming', 'Schwimmen', 'DISTANZ', false], ['t-gym', 'strength', 'Krafttraining', 'VOLUMEN', false]];
let n = 0;
for (const [id, theme, name, keyLbl, hasRoute] of CASES) {
  n++; const rgb = RGB[theme];
  sec(name + ' (' + theme + ')');
  const p = await openPage(id);
  ok(n + 'a Seite traegt das Thema „' + theme + '"; --activity-primary ist gesetzt', p.act === theme && /^#[0-9A-Fa-f]{6}$/.test(p.primary), JSON.stringify([p.act, p.primary]));
  ok(n + 'b Sport-Kennzeichen ueber dem Titel in der Farbe der Sportart', has(p.kicker, rgb), p.kicker);
  const keys = p.kpi.filter(k => k.key), rest = p.kpi.filter(k => !k.key);
  ok(n + 'c genau EINE farbige Hauptkennzahl (' + keyLbl + '); alle anderen Kennzahlen neutral und untereinander gleich', keys.length === 1 && keys[0].lbl === keyLbl && has(keys[0].col, rgb) && rest.length >= 3 && rest.every(k => k.col === rest[0].col && !has(k.col, rgb)), JSON.stringify(p.kpi.map(k => [k.lbl, k.key ? 1 : 0, k.col])));
  ok(n + 'd alle Messreihen der Seite in der Farbe der Sportart (' + p.lines.length + ' Reihen); Hoechst-/Tiefstwert neutral, nicht gruen/rot', p.lines.length >= 1 && p.lines.every(l => has(l, rgb)) && p.marks.length === p.lines.length * 2 && p.marks.every(m => has(m, '173, 181, 193')), JSON.stringify([p.lines, p.marks.slice(0, 2)]));
  ok(n + 'e Stimmung der Seite: ein Verlauf aus dem Ton der Sportart (kein fester Fremdton)', /radial-gradient/.test(p.bg) && has(p.bg, rgb), String(p.bg).slice(0, 110));
  if (hasRoute) {
    ok(n + 'f Strecke in der Farbe der Sportart, 5 px, dunkler Rand 8 px', has(p.line, rgb) && Math.abs(p.lineW - 5) < 0.01 && Math.abs(p.caseW - 8) < 0.01, JSON.stringify([p.line, p.lineW, p.caseW]));
    ok(n + 'g Start gruen, Ziel rot — Zustandsfarben, nicht die Farbe der Sportart', has(p.start, START) && has(p.end, FINISH), JSON.stringify([p.start, p.end]));
    ok(n + 'h Karte laeuft nach unten aus (Maske auf der Kartenebene)', /linear-gradient/.test(String(p.mask)), String(p.mask).slice(0, 60));
  } else {
    ok(n + 'f ohne Strecke: kein Kartenfeld, keine Linie', p.line === null && p.start === null);
  }
  const s = await story(id);
  ok(n + 'i Story: jede Seite traegt dasselbe Thema (' + s.n + ' Seiten)', s.n >= 2 && s.acts.length >= s.n * 2 && s.acts.every(a => a === theme), JSON.stringify([s.n, [...new Set(s.acts)]]));
  ok(n + 'j Story: Kurve, Ø-Zeichen und hervorgehobene Woerter in GENAU derselben Farbe wie Seite und Strecke', s.line.length >= 1 && s.line.every(l => has(l, rgb)) && s.pill.every(l => has(l, rgb)) && s.em.every(l => has(l, rgb)) && (!hasRoute || has(s.mapLine, rgb)), JSON.stringify([s.line[0], s.pill[0], s.em[0], s.mapLine]));
  ok(n + 'k Story: Schein der Kurve leise (hoechstens 32 % Deckkraft), Stimmung als leiser Verlauf im Ton der Sportart', s.glow.every(g => { const m = /rgba\(([^)]+)\)/.exec(g); return !!m && +m[1].split(',')[3] <= 0.32 + 1e-6; }) && s.bg.every(b => /radial-gradient/.test(b) && has(b, rgb)), JSON.stringify([s.glow[0], String(s.bg[0]).slice(0, 70)]));
  ok(n + 'l Story „Deine Zahlen": genau eine farbige Hauptkennzahl, der Rest in Textfarbe', s.key.length === 1 && has(s.key[0], rgb) && s.cells.length >= 2 && s.cells.every(c => has(c, TEXT)), JSON.stringify([s.key, s.cells.slice(0, 2)]));
  if (hasRoute) ok(n + 'm Story-Karte: Start gruen, Ziel rot', has(s.mapStart, START) && has(s.mapEnd, FINISH), JSON.stringify([s.mapStart, s.mapEnd]));
}

sec('Sportart ohne eigenes Thema');
{
  const p = await openPage('t-foot');
  ok('5a Fussball ⇒ Thema „brand": ORVIA-Gold, keine erfundene Farbe', p.act === 'brand' && has(p.kicker, RGB.brand) && p.lines.every(l => has(l, RGB.brand)), JSON.stringify([p.act, p.kicker, p.lines[0]]));
  ok('5b ohne Distanz/Volumen bleibt jede Kennzahl neutral (keine Farbe ohne Hauptkennzahl)', p.kpi.filter(k => k.key).length === 0, JSON.stringify(p.kpi.map(k => k.lbl)));
}

sec('Kartenansicht');
{
  await openPage('t-bike');
  const v = await page.evaluate(async () => { const el = document.querySelector('#gmActPage .route-map'); el.click(); await new Promise(r => setTimeout(r, 900));
    const rv = document.querySelector('.rmv'); if (!rv) return null; const cs = e => getComputedStyle(e);
    const o = { act: rv.getAttribute('data-activity'), line: cs(rv.querySelector('.rmx-line')).stroke, w: parseFloat(cs(rv.querySelector('.rmx-line')).strokeWidth), cw: parseFloat(cs(rv.querySelector('.rmx-case')).strokeWidth), start: cs(rv.querySelector('.rmx-start')).stroke, end: cs(rv.querySelector('.rmx-end')).fill };
    ORVIA.routeMapView.close(); await new Promise(r => setTimeout(r, 150)); return o; });
  ok('6a die Kartenansicht traegt das Thema der Aktivitaet (haengt am body) — Strecke blau wie im Feld', !!v && v.act === 'cycling' && has(v.line, RGB.cycling) && Math.abs(v.w - 5) < 0.01 && Math.abs(v.cw - 8) < 0.01, JSON.stringify(v));
  ok('6b auch dort: Start gruen, Ziel rot', !!v && has(v.start, START) && has(v.end, FINISH));
}

sec('Liste, Verteilung, Start-Auswahl');
{
  const L = await page.evaluate(async () => { try { gmCloseActivityPage(); } catch (_) { } showTab('akt'); await new Promise(r => setTimeout(r, 500));
    const cs = e => getComputedStyle(e); const cards = {};
    [].forEach.call(document.querySelectorAll('.activity-card'), c => { const v = c.querySelector('.activity-visual'), g = v.querySelector('.act-glyph path, .act-glyph rect');
      cards[{ Laufen: 't-run', Radfahren: 't-bike', Schwimmen: 't-swim', Krafttraining: 't-gym' }[c.querySelector('h3').textContent.trim()] || 't-foot'] = { act: v.getAttribute('data-activity'), col: g ? (cs(g).stroke !== 'none' ? cs(g).stroke : cs(g).fill) : null, state: cs(c.querySelector('.session-state.done')).color }; });
    const dist = [].slice.call(document.querySelectorAll('.dist-leg span')).map(s => [s.textContent.trim().split(' ')[0], cs(s.querySelector('i')).backgroundColor]);
    gmOpenStartSheet(); await new Promise(r => setTimeout(r, 400));
    const tiles = {}; [].forEach.call(document.querySelectorAll('.sport-tile'), t => { tiles[t.querySelector('b').textContent] = cs(t.querySelector('.st-ic')).backgroundColor; });
    try { gmCloseSheets(); } catch (_) { }
    return { cards, dist, tiles }; });
  const c = L.cards;
  ok('7a Aktivitaetsliste: jedes Zeichen in der Farbe seiner Sportart', c['t-run'] && c['t-run'].act === 'running' && has(c['t-run'].col, RGB.running) && has(c['t-bike'].col, RGB.cycling) && has(c['t-swim'].col, RGB.swimming) && has(c['t-gym'].col, RGB.strength) && c['t-foot'].act === 'brand', JSON.stringify(Object.keys(c).map(k => [k, c[k].act, c[k].col])));
  ok('7b „Abgeschlossen" bleibt eine Zustandsfarbe — in jeder Sportart dieselbe, nie die der Sportart', new Set(Object.keys(c).map(k => c[k].state)).size === 1 && !Object.keys(RGB).some(t => has(c['t-run'].state, RGB[t])), c['t-run'].state);
  const d = Object.fromEntries(L.dist);
  ok('7c Sportartenverteilung: Laufen, Kraft, Rad in ihrer Themenfarbe; „Sonstiges" neutral', has(d.Laufen, RGB.running) && has(d.Kraft, RGB.strength) && has(d.Rad, RGB.cycling) && has(d.Sonstiges, '137, 150, 165'), JSON.stringify(L.dist));
  const t = L.tiles;
  ok('7d Start-Auswahl: Laufen, Krafttraining, Radfahren, Schwimmen in ihrer Themenfarbe (Laufen nicht mehr gruen)', has(t.Laufen, RGB.running) && has(t.Krafttraining, RGB.strength) && has(t.Radfahren, RGB.cycling) && has(t.Schwimmen, RGB.swimming), JSON.stringify(t));
  ok('7e alle sieben Kacheln der Start-Auswahl haben verschiedene Farben', new Set(Object.values(t)).size === 7, JSON.stringify(Object.values(t)));
}

sec('Fehlerfreiheit');
ok('8 keine Laufzeitfehler im ganzen Durchlauf', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' activity_theme_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
