/* ============================================================
   ORVIA · activity_analysis_v452_ui_e2e — Schwimmansicht und Messdetails im echten Browser
   A  Laden des Rohblocks: erst „wird geladen", dann Schwimmwerte — ohne den lokalen Speicher zu veraendern
   B  Schwimmansicht: Hauptkennzahl, Karten, Verlauf (Auswahl), Intervalle, Gleichmaessigkeit, Messdetails eingeklappt
   C  Fehlerfaelle: Abruf scheitert (offline), kein Rohblock, nur Herzfrequenz
   D  andere Sportarten: bisherige Seite bleibt, Messdetails kommen dazu
   E  Layout 320 / 375 / 390 / 430 / 1200 px: kein horizontaler Ueberlauf, kein abgeschnittener Wert
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
globalThis.window = globalThis;
const GEN = await import(join(APP, 'tools/gen-eligibility-doc.mjs'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Beckenschwimmen: lokaler Datensatz OHNE Rohblock (wie im Speicher), Rohblock kommt vom „Server" */
const sw = GEN.referenceActivity('swimming', 'best');
sw.id = '30000000-0000-4000-8000-000000000001'; sw.clientRecordId = 'act:swim1'; sw.startedAt = '2026-10-12T16:00:00.000Z';
sw.summary = { distanceM: 2000, avgHr: 138, maxHr: 161, caloriesKcal: 520, name: 'Schwimmen' }; sw.durationSeconds = 2700;
Object.assign(sw.metrics.garmin, { timer_duration_s: 2700, elapsed_duration_s: 2760, moving_duration_s: 2280 });
const n = 40, T = Array.from({ length: n }, (_, i) => i * 68);
sw.metrics.streams = { time: T, heart_rate: T.map((_, i) => 120 + Math.round(25 * Math.sin(i / 6))), speed: T.map((_, i) => i % 8 === 7 ? 0 : 0.85 + 0.08 * Math.sin(i / 4)) };
sw.metrics.stream_meta = { time: { kind: 'elapsed_s', unit: 's', source: 'directTimestamp' } };
sw.metrics.splits = [400, 0, 400, 0, 400, 0, 400].map((d, i) => d ? { distance: d, duration: 470 + (i % 3) * 8, averageHR: 135 + i } : { distance: 0, duration: 60 });
sw.metrics.splits_source = 'garmin_splits';
const EXT = { v: 1, fields: { distance: 2000, duration: 2700, averageHR: 138, activeLengths: 80, poolLength: 2500, unitOfPoolLength: 'meter', strokes: 1480, avgStrokes: 18.5, averageSwolf: 39,
  averageSwimCadenceInStrokesPerMinute: 28, avgStrokeDistance: 175 },
  series: { directSwimCadence: { values: T.map((_, i) => i % 8 === 7 ? 0 : 26 + (i % 5)) }, directSwolf: { values: T.map((_, i) => i % 8 === 7 ? null : 37 + (i % 4)) } }, extras: { splits: 'ok' } };
delete sw.metrics.ext;
const run = GEN.referenceActivity('running', 'best'); run.id = '30000000-0000-4000-8000-000000000002'; run.clientRecordId = 'act:run1'; run.startedAt = '2026-10-11T07:00:00.000Z'; delete run.metrics.ext;

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
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

/* mode: 'ok' (Rohblock nach 300 ms) | 'fail' (Abruf scheitert) | 'none' (Server hat keinen Rohblock) */
const setup = (acts, ext, mode) => page.evaluate(({ acts, ext, mode }) => {
  window.__local = JSON.parse(JSON.stringify(acts)); window.__calls = 0;
  const st = ORVIA.activityStore; st.listActivities = () => window.__local; st.getActivityById = id => window.__local.find(a => a.id === id || a.clientRecordId === id) || null;
  ORVIA.repos = ORVIA.repos || {}; ORVIA.repos.activity = Object.assign({}, ORVIA.repos.activity || {}, { fetchExt: id => { window.__calls++;
    return new Promise(r => setTimeout(() => r(mode === 'fail' ? { success: false, error: { code: 'offline' } } : { success: true, data: { id, ext: mode === 'none' ? null : ext } }), 300)); } });
  try { _gmActExt = {}; } catch (e) {}
  try { showTab('akt'); } catch (e) {}
}, { acts, ext, mode });
const READ = () => page.evaluate(() => { const p = document.getElementById('gmActPage');
  return { hero: (p.querySelector('.aa-hero-main b') || {}).textContent || null, heroSub: [...p.querySelectorAll('.aa-hero-sub b')].map(b => b.textContent),
    cards: [...p.querySelectorAll('#gmActPage > .aa-cards > .aa-card span, .aa-cards:not(.aa-cards-3) > .aa-card span')].map(s => s.textContent),
    chips: [...p.querySelectorAll('.aa-chips button')].map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')), chart: !!p.querySelector('#gmAaChart svg'),
    iv: p.querySelectorAll('.aa-iv:not(.aa-iv-head):not(.aa-rest)').length, rest: p.querySelectorAll('.aa-rest').length, eff: !!p.querySelector('.aa-eff'),
    md: p.querySelector('details.aa-md') ? { open: p.querySelector('details.aa-md').open, text: p.querySelector('details.aa-md').textContent } : null,
    kpis: p.querySelectorAll('.detail-kpis').length, note: [...p.querySelectorAll('.aa-note')].map(x => x.textContent).join(' | '), calls: window.__calls,
    localHasExt: !!(window.__local[0].metrics && window.__local[0].metrics.ext) }; });

sec('A · Rohblock laden');
await setup([sw], EXT, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), sw.id);
const a0 = await READ();
ok('A1 sofort: Hauptkennzahl aus dem lokalen Datensatz (2.000 m), Schwimmfelder noch nicht da, Hinweis „wird geladen"', a0.hero === '2.000 m' && !a0.cards.some(c => /SWOLF|Bahnen/i.test(c)) && /werden geladen/.test(a0.note), JSON.stringify(a0));
await page.waitForTimeout(700);
const a1 = await READ();
ok('A2 nach dem Laden: Bahnen, SWOLF, Zugfrequenz, Bahnlaenge erscheinen; genau EIN Abruf', a1.cards.some(c => /Bahnen/.test(c)) && a1.cards.some(c => /SWOLF/.test(c)) && a1.cards.some(c => /Zugfrequenz/.test(c)) && a1.calls === 1, JSON.stringify(a1.cards));
ok('A3 der lokale Speicher bleibt ohne Rohblock (nur Arbeitsspeicher)', a1.localHasExt === false);
await page.evaluate(id => gmOpenActivityPage(id), sw.id);
ok('A4 erneutes Oeffnen: kein zweiter Abruf (Zwischenspeicher der Sitzung)', (await READ()).calls === 1);

sec('B · Schwimmansicht');
const b = await READ();
ok('B1 keine alten sechs Kacheln; Hauptkennzahl Distanz, darunter Dauer und Tempo /100 m', b.kpis === 0 && b.hero === '2.000 m' && b.heroSub.length === 2 && /\/100 m/.test(b.heroSub[1]), JSON.stringify(b.heroSub));
ok('B2 Verlauf mit Auswahl: Tempo, Puls, Zugfrequenz, SWOLF — ein Diagramm sichtbar', b.chips.join() === 'Tempo*,Puls,Zugfrequenz,SWOLF' && b.chart, b.chips.join());
await page.evaluate(() => { const x = [...document.querySelectorAll('.aa-chips button')].find(b => b.textContent === 'SWOLF'); x.click(); });
await page.waitForTimeout(200);
const b2 = await READ();
ok('B3 Auswahl wechselt das Diagramm (SWOLF), Seite bleibt an ihrer Stelle', b2.chips.includes('SWOLF*') && b2.chart);
ok('B4 Intervalle: 4 aktive, 3 Pausen; Gleichmaessigkeit mit ≥ 3 Intervallen', b.iv === 4 && b.rest === 3 && b.eff, JSON.stringify([b.iv, b.rest, b.eff]));
ok('B5 Messdetails eingeklappt; nennen Quelle, Pruefstand und Fehlendes; „Strecke je Zug" als nicht angezeigt (Einheit ungeklaert)', b.md && b.md.open === false && /ungeprüft/.test(b.md.text) && /Strecke je Zug/.test(b.md.text) && /Einheit ungeklärt/.test(b.md.text) && /Bahnen × Bahnlänge = Distanz/.test(b.md.text), b.md && b.md.text.slice(0, 200));
ok('B6 Hinweis auf ungepruefte Quellwerte unter den Karten', /von Garmin übernommen/.test(b.note));
ok('B7 keine technischen Feldnamen in der Hauptansicht', !(await page.evaluate(() => { const p = document.getElementById('gmActPage').cloneNode(true); p.querySelectorAll('details').forEach(d => d.remove()); return /ext\.fields|averageSwolf|directSwim|best_efforts/.test(p.textContent); })));

sec('C · Fehlerfaelle');
await setup([sw], EXT, 'fail');
await page.evaluate(id => gmOpenActivityPage(id), sw.id); await page.waitForTimeout(700);
const c1 = await READ();
ok('C1 Abruf scheitert: Seite bleibt bedienbar, Distanz/Dauer/Tempo/Puls aus dem lokalen Datensatz; Schwimmfelder „nicht geladen"', c1.hero === '2.000 m' && c1.cards.some(c => /Puls/.test(c)) && /nicht geladen/.test(c1.md.text) && !/werden geladen/.test(c1.note), JSON.stringify([c1.cards, c1.note, c1.md.text.slice(-500)]));
await setup([sw], EXT, 'none');
await page.evaluate(id => gmOpenActivityPage(id), sw.id); await page.waitForTimeout(700);
const c2 = await READ();
ok('C2 Server ohne Rohblock (aelterer Import): „keine Rohdaten", keine erfundenen Schwimmwerte', /keine Rohdaten/.test(c2.md.text) && !c2.cards.some(c => /SWOLF|Bahnen/.test(c)));
const hrOnly = JSON.parse(JSON.stringify(sw)); hrOnly.summary = { distanceM: 1000, avgHr: 130, name: 'Schwimmen' }; hrOnly.metrics.streams = { time: T, heart_rate: sw.metrics.streams.heart_rate }; delete hrOnly.metrics.splits;
await setup([hrOnly], { v: 1, fields: { distance: 1000, averageHR: 130 } }, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), hrOnly.id); await page.waitForTimeout(700);
const c3 = await READ();
ok('C3 nur Herzfrequenz geliefert: ein Diagramm (Puls) ohne Auswahl, keine Intervalle, Messdetails nennen die fehlenden Schwimmwerte als „nicht geliefert"', c3.chips.length === 0 && c3.chart && c3.iv === 0 && /von Garmin nicht geliefert/.test(c3.md.text), JSON.stringify([c3.chips, c3.iv]));

sec('D · andere Sportarten');
await setup([run], GEN.referenceActivity('running', 'best').metrics.ext, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), run.id); await page.waitForTimeout(700);
const d1 = await READ();
ok('D1 Laufen: bisherige Kacheln bleiben, Messdetails kommen dazu (Timer- und Gesamtzeit, geprueft)', d1.kpis === 1 && d1.hero === null && d1.md && /Timer-Zeit/.test(d1.md.text) && /Gesamtzeit/.test(d1.md.text) && /geprüft/.test(d1.md.text));

sec('E · Layout');
await setup([sw], EXT, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), sw.id); await page.waitForTimeout(700);
for (const w of [320, 375, 390, 430, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.evaluate(() => { gmActRedrawKeep(); const d = document.querySelector('#gmActPage details.aa-md'); if (d) d.open = true; });
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), clip = e => e.scrollWidth > e.clientWidth + 1;
    return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pov: p.scrollWidth - p.clientWidth,
      cut: [...p.querySelectorAll('.aa-hero b, .aa-card b, .aa-chips button, .aa-iv span, .aa-md dd')].filter(clip).map(e => e.textContent).slice(0, 4) }; });
  ok('E ' + w + ' px: kein Ueberlauf, kein abgeschnittener Wert (Hauptkennzahl, Karten, Intervalle, Messdetails)', m.ov <= 0 && m.pov <= 0 && !m.cut.length, JSON.stringify(m));
}
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' activity_analysis_v452_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
