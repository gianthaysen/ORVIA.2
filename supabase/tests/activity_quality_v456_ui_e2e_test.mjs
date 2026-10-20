/* ============================================================
   ORVIA · activity_quality_v456_ui_e2e — gemeinsame Aktivitaetsansicht fuer ALLE Sportarten (echter Browser)
   M  Anzeigemodi: aendern nur, was anfangs aufgeklappt ist (Anfaenger zu, Profi offen) — Inhalt identisch
   A  Zeitachse: „Aktive Zeit" (Standard, Luecken verkuerzt) ↔ „Gesamtzeit"; Ablesezeile bleibt; Tastatur in den Reitern
   K  Kraft (synthetisch) und Fussball (synthetisch) in derselben Ansicht: Hauptzahl, Uebungen & Saetze, Puls-Verlauf,
      Dauer korrigieren, Debrief, Loeschen — nichts fehlt gegenueber der bisherigen Seite
   V  Zwift: Strecke im Kartenfeld eingepasst (ohne Landkarte), „Spielwelt" sichtbar
   W  Wellenfeld in gemessener Breite (Desktop nicht gestreckt), reduzierte Bewegung = still
   L  Breiten 320 · 375 · 390 · 430 · 768 · 1024 · 1440 · 1920 fuer Kraft und Fussball; Bibliothek am Desktop ohne Loecher
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
  return { a: { id: '54570000-0000-4000-8000-0000000000' + String(_n).padStart(2, '0'), clientRecordId: 'act:v456q-' + _n, sportId: f.sport, source: 'garmin', status: 'completed',
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


const RUN = real('running__running__intervals', 'Intervalllauf', ROUTE), ZW = real('cycling__virtual_ride__indoor', 'Zwift – Watopia', ROUTE), SW = swim();
const GYM = { a: { id: '54570000-0000-4000-8000-000000000099', clientRecordId: 'act:v456q-gym', sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: '2026-10-08T16:00:00.000Z', durationSeconds: 4020, workoutSessionId: 'w-v456q',
  summary: { name: 'Oberkörper', exerciseCount: 2, workingSetCount: 5, avgHr: 112, rpe: 7 }, metrics: { streams: { heart_rate: Array.from({ length: 120 }, (_, k) => Math.round(120 + 15 * Math.sin(k / 9))) },
  exercises: [{ name: 'Bankdrücken', sets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }, { reps: 7, weight: 70 }] }, { name: 'Rudern', sets: [{ reps: 12, weight: 50 }, { reps: 11, weight: 50 }] }] } }, ext: null };
const FOOT = { a: { id: '54570000-0000-4000-8000-000000000098', clientRecordId: 'act:v456q-foot', sportId: 'football', source: 'garmin', status: 'completed', startedAt: '2026-10-09T18:00:00.000Z', durationSeconds: 5400,
  summary: { name: 'Fußball', avgHr: 141, maxHr: 178 }, metrics: { streams: { heart_rate: Array.from({ length: 120 }, (_, k) => Math.round(135 + 12 * Math.sin(k / 7))) } } }, ext: null };
const setMode = m => page.evaluate(m => { localStorage.setItem('orvia_ui_mode', m); if (typeof PROFILE !== 'undefined' && PROFILE) PROFILE.uiDetailMode = m; try { applyLevelClass(); } catch (e) {} }, m);

sec('M · Anzeigemodi');
const modeState = () => page.evaluate(() => { const p = document.getElementById('gmActPage'); return { lib: p.querySelector('details.ax-lib').open, src: p.querySelector('#gmAxSrc').open, rows: p.querySelectorAll('.ax-row').length, charts: p.querySelectorAll('.ax-tabs button').length, txt: p.querySelector('.ax-lib').textContent.length }; });
await setMode('anfaenger'); await open(RUN); const ma = await modeState();
await setMode('profi'); await open(RUN); const mp = await modeState();
await setMode('fortgeschritten'); await open(RUN); const mf = await modeState();
ok('M1 Anfaenger: Kennzahlen und Datenherkunft eingeklappt; Profi: beide offen; Fortgeschritten (Telefon): eingeklappt', !ma.lib && !ma.src && mp.lib && mp.src && !mf.lib && !mf.src, JSON.stringify([ma, mp, mf]));
ok('M2 Modi sperren nichts: gleiche Kennzahlen, gleiche Diagramme, gleicher Inhalt in allen Modi', ma.rows === mp.rows && mp.rows === mf.rows && ma.charts === mp.charts && ma.txt === mp.txt, JSON.stringify([ma.rows, mp.rows, ma.txt, mp.txt]));

sec('A · Zeitachse');
await open(ZW);
const a1 = await page.evaluate(() => ({ seg: [...document.querySelectorAll('#gmActPage [data-ax-axis]')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')), axis: document.getElementById('gmAaChart').getAttribute('data-axis'), lines: document.querySelectorAll('#gmAaChart .aac-gapline').length, rects: document.querySelectorAll('#gmAaChart .aac-gaprect').length }));
ok('A1 Zwift: Standard „Aktive Zeit" — 3 Abschnitte ohne Messwerte als gestrichelte Linie verkuerzt', a1.seg.join() === 'Aktive Zeit*,Gesamtzeit' && a1.axis === 'active' && a1.lines === 3 && a1.rects === 0, JSON.stringify(a1));
const y0 = await page.evaluate(() => document.getElementById('gmActPage').scrollTop = 600);
await page.evaluate(() => document.querySelector('#gmActPage [data-ax-axis="total"]').click()); await page.waitForTimeout(150);
const a2 = await page.evaluate(() => ({ axis: document.getElementById('gmAaChart').getAttribute('data-axis'), rects: document.querySelectorAll('#gmAaChart .aac-gaprect').length, focus: document.activeElement && document.activeElement.getAttribute('data-ax-axis'), y: document.getElementById('gmActPage').scrollTop, read: !!document.getElementById('gmAxRead') }));
ok('A2 „Gesamtzeit": volle Achse, Abschnitte als Flaeche; nur der Verlauf wird neu aufgebaut (Scrollposition und Fokus bleiben)', a2.axis === 'total' && a2.rects === 3 && a2.focus === 'total' && Math.abs(a2.y - y0) < 2 && a2.read, JSON.stringify(a2));
await page.focus('#gmActPage .ax-tabs [aria-selected="true"]'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
const a3 = await page.evaluate(() => ({ sel: document.querySelector('#gmActPage .ax-tabs [aria-selected="true"]').textContent, focus: document.activeElement.getAttribute('data-chart-id'), tabindex: [...document.querySelectorAll('#gmActPage .ax-tabs button')].map(b => b.tabIndex).join() }));
ok('A3 Reiter mit Pfeiltasten (roving tabindex): → waehlt „Puls", Fokus folgt', a3.sel === 'Puls' && a3.focus === 'hr' && a3.tabindex === '-1,0,-1', JSON.stringify(a3));

sec('K · Kraft und Fussball in derselben Ansicht');
await open(GYM);
const k1 = await page.evaluate(() => { const p = document.getElementById('gmActPage'); return { ax: p.classList.contains('ax-page'), main: p.querySelector('.ax-key-main').innerText.replace(/\s+/g, ' '), stats: [...p.querySelectorAll('.ax-stats dt')].map(d => d.textContent.trim()), gym: p.querySelector('.ax-gym') && p.querySelector('.ax-gym').innerText.replace(/\s+/g, ' '),
  chart: !!p.querySelector('#gmAaChart svg'), dur: !!p.querySelector('.gm-dur-note'), del: !!p.querySelector('.danger-btn'), db: !!p.querySelector('.ax-assess'), story: !!p.querySelector('.gm-story-cta') }; });
ok('K1 Kraft: neue Ansicht; Hauptzahl Volumen 2.760 kg (Summe der echten Saetze: 1.610 + 1.150); Dauer, Saetze, Belastung (RPE) daneben', k1.ax && /2\.760\s?kg Volumen/.test(k1.main) && k1.stats.includes('Dauer') && k1.stats.some(s => /Sätze/.test(s)) && k1.stats.some(s => /RPE/.test(s)), JSON.stringify(k1));
ok('K2 Kraft: „Übungen & Sätze" mit jedem Satz, Puls-Verlauf, Dauer korrigieren, Debrief, Highlights, Loeschen — nichts verloren', /Bankdrücken/.test(k1.gym) && /Satz 3 70 kg × 7/.test(k1.gym) && /Rudern/.test(k1.gym) && k1.chart && k1.dur && k1.del && k1.db && k1.story, JSON.stringify(k1.gym));
await open(FOOT);
const k3 = await page.evaluate(() => { const p = document.getElementById('gmActPage'); return { ax: p.classList.contains('ax-page'), main: p.querySelector('.ax-key-main').innerText.replace(/\s+/g, ' '), chart: !!p.querySelector('#gmAaChart svg'), lib: !!p.querySelector('.ax-lib'), theme: p.getAttribute('data-activity') }; });
ok('K3 Fussball: neue Ansicht, Hauptzahl Dauer 1:30:00, Puls-Verlauf, Kennzahlen, Thema ORVIA-Gold', k3.ax && /^1:30:00/.test(k3.main) && k3.chart && k3.lib && k3.theme === 'brand', JSON.stringify(k3));

sec('V · Zwift-Strecke');
await page.setViewportSize({ width: 1440, height: 900 }); await open(ZW);
const v1 = await page.evaluate(() => { const f = document.querySelector('#gmActPage .ax-vroute'), r = f.getBoundingClientRect(), line = f.querySelector('.rmx-line, path'); const b = line.getBoundingClientRect();
  return { fieldW: Math.round(r.width), lineH: Math.round(b.height), fieldH: Math.round(r.height), label: f.querySelector('.ax-vlabel').textContent, tiles: !!f.querySelector('.has-tiles, .rmx-tiles img, .rmx-gl'), darkRect: !!f.querySelector('svg.rmap rect') }; });
ok('V1 virtuelle Strecke im Kartenfeld eingepasst (Desktop v8-457: grosse rechte Spalte, Linie nutzt ≥ 55 % der Hoehe), ohne Landkarte und ohne dunkles Zusatzrechteck; „Spielwelt" benannt', v1.fieldW > 600 && v1.fieldH >= 360 && v1.lineH >= v1.fieldH * 0.55 && !v1.tiles && !v1.darkRect && /Spielwelt/.test(v1.label), JSON.stringify(v1));

sec('W · Wellenfeld');
await open(SW);
const w1 = await page.evaluate(() => { const el = document.querySelector('#gmActPage .ax-top .act-waves'), sv = el.querySelector('svg'); return { w: Math.round(el.clientWidth), vb: sv.getAttribute('viewBox'), n: sv.querySelectorAll('path').length, anim: getComputedStyle(sv.querySelector('path')).animationName }; });
ok('W1 Desktop: Wellenfeld in der gemessenen Breite gezeichnet (viewBox = Pixelbreite, nichts gestreckt), 7 Linien; reduzierte Bewegung = keine Animation', w1.vb === '0 0 ' + w1.w + ' 150' && w1.n === 7 && w1.anim === 'none', JSON.stringify(w1));

sec('L · Breiten');
for (const c of [['Kraft', GYM], ['Fussball', FOOT]]) {
  for (const w of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: 900 }); await open(c[1]);
    const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), vis = e => e.offsetParent !== null; const clip = e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible';
      return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pov: p.scrollWidth - p.clientWidth,
        cut: [...p.querySelectorAll('.ax-title, .ax-key-main b, .ax-stats dd, .ax-stats dt, .ax-btn, .ax-chip, .gymex-head b, .gymset-row strong, .aac-kv dd, .ax-rl, .ax-rv')].filter(e => vis(e) && clip(e)).map(e => e.textContent.trim()).slice(0, 4),
        tap: Math.min(...[...p.querySelectorAll('.ax-btn, .ax-chip, .ax-lib > summary, .ax-src > summary')].filter(vis).map(b => b.getBoundingClientRect().height)) }; });
    ok('L ' + c[0] + ' ' + w + ' px: kein Ueberlauf, nichts abgeschnitten, Tippflaechen ≥ 44 px', m.ov <= 0 && m.pov <= 0 && !m.cut.length && m.tap >= 44, JSON.stringify(m));
  }
}
await page.setViewportSize({ width: 1440, height: 900 }); await open(RUN);
const l2 = await page.evaluate(() => { const g = document.querySelector('#gmActPage .ax-lib-grid'); g.closest('details').open = true; const cs = getComputedStyle(g); const sec = [...g.querySelectorAll('.ax-lg')].map(e => e.getBoundingClientRect());
  const cols = [...new Set(sec.map(r => Math.round(r.left)))].length, bottoms = [...new Set(sec.map(r => Math.round(r.left)))].map(l => Math.max(...sec.filter(r => Math.round(r.left) === l).map(r => r.bottom)));
  return { cols, colCount: cs.columnCount, spread: Math.round(Math.max(...bottoms) - Math.min(...bottoms)), h: Math.round(g.getBoundingClientRect().height) }; });
ok('L Desktop: Kennzahlen-Bibliothek als ausgeglichene Spalten (keine Rasterloecher) — Hoehenunterschied der Spalten < 45 % der Hoehe', l2.cols >= 2 && l2.spread < l2.h * 0.45, JSON.stringify(l2));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' activity_quality_v456_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
