/* ============================================================
   ORVIA · swim_intervals_v453_ui_e2e — Schwimmintervalle und Bahnen im echten Browser (echter Garmin-Mitschnitt 11.10.2026)
   A  heutige Produktion (keine Runden): kein Intervall-Block, keine leere Karte, kein Fehler
   B  Intervalle: Schwimmtempo 2:41 / 2:29 / 1:40, Pausenbloecke, Zusammenfassung; Bahnen erst beim Aufklappen
   C  Laden: Intervalle sofort aus den lokalen Runden, Bahnen nach dem Rohblock (ein Abruf); Abruf scheitert → ohne Bahnen
   D  Messdetails: Zeitdefinition, Pausen, Summenpruefung, Plausibilitaet, Validierung
   E  Layout 320 / 375 / 390 / 430 / 1200 px mit aufgeklapptem Intervall: kein Ueberlauf, nichts abgeschnitten
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
const { swimRow } = await import('./_swim-realdata.mjs');
const F = JSON.parse(readFileSync(join(HERE, 'fixtures', 'swim_capture_v453.json'), 'utf8'));
const withLaps = swimRow(5, true);
withLaps.metrics.splits = F.lap_swimming.metrics.splits; withLaps.metrics.splits_source = 'garmin_splits';
const EXT = Object.assign({}, withLaps.metrics.ext, { fields: F.lap_swimming.metrics.ext.fields, splits: F.lap_swimming.metrics.ext.splits, extras: { splits: 'ok' } });
delete withLaps.metrics.ext;
const noLaps = swimRow(5, true); const EXT0 = noLaps.metrics.ext; delete noLaps.metrics.ext;

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

/* mode: 'ok' (Rohblock nach 300 ms) | 'fail' (Abruf scheitert) */
const setup = (acts, ext, mode) => page.evaluate(({ acts, ext, mode }) => {
  window.__local = JSON.parse(JSON.stringify(acts)); window.__calls = 0;
  const st = ORVIA.activityStore; st.listActivities = () => window.__local; st.getActivityById = id => window.__local.find(a => a.id === id || a.clientRecordId === id) || null;
  ORVIA.repos = ORVIA.repos || {}; ORVIA.repos.activity = Object.assign({}, ORVIA.repos.activity || {}, { fetchExt: id => { window.__calls++;
    return new Promise(r => setTimeout(() => r(mode === 'fail' ? { success: false, error: { code: 'offline' } } : { success: true, data: { id, ext } }), 300)); } });
  try { _gmActExt = {}; _gmSwOpen = {}; } catch (e) {}
  try { showTab('akt'); } catch (e) {}
}, { acts, ext, mode });
const READ = () => page.evaluate(() => { const p = document.getElementById('gmActPage'), c = p.querySelector('.aa-sw-card, .iv-card');
  return { card: !!c, hero: (p.querySelector('.aa-hero-main b') || {}).textContent || null,
    iv: c ? [...c.querySelectorAll('.aa-sw-iv')].map(x => ({ d: x.querySelector('.aa-sw-main b').textContent, p: x.querySelector('.aa-sw-main em').textContent, btn: !!x.querySelector('button.aa-sw-ivh'),
      exp: (x.querySelector('button.aa-sw-ivh') || {}).getAttribute ? x.querySelector('button.aa-sw-ivh').getAttribute('aria-expanded') : null, meta: (x.querySelector('.iv-sub') || {}).textContent || '', body: (x.querySelector('.iv-body') || {}).textContent || '',
      rows: x.querySelectorAll('.aa-sw-l[role="listitem"]').length, restRows: x.querySelectorAll('.aa-sw-l.is-rest').length, sus: x.querySelectorAll('.aa-sw-l.is-suspect').length,
      hidden: x.querySelector('.aa-sw-lengths') ? x.querySelector('.aa-sw-lengths').hidden : null })) : [],
    rest: c ? [...c.querySelectorAll('.iv-rest')].map(x => x.textContent) : [], sum: c ? [...c.querySelectorAll('.iv-stats .iv-stat')].map(x => x.textContent) : [],   /* v8-454: Pausenbloecke .iv-rest, Zusammenfassung .iv-stat */
    chips: [...p.querySelectorAll('.aa-chips button')].map(b => b.textContent), md: (p.querySelector('details.aa-md') || {}).textContent || '', calls: window.__calls,
    note: c ? [...c.querySelectorAll('.aa-note')].map(x => x.textContent).join(' | ') : '' }; });

sec('A · heutige Produktion (keine Runden)');
await setup([noLaps], EXT0, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), noLaps.id); await page.waitForTimeout(700);
const a = await READ();
ok('A1 kein Intervall-Block, keine leere Karte; bisherige Schwimmansicht (1.350 m)', !a.card && a.hero === '1.350 m', JSON.stringify(a).slice(0, 200));

sec('B · Intervalle und Bahnen');
await setup([withLaps], EXT, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), withLaps.id);
const c0 = await READ();
ok('C1 sofort (Rohblock laedt): Intervalle aus den lokalen Runden — Schwimmtempo 2:41 / 2:29 / 1:40, noch ohne Aufklappen', c0.card && c0.iv.map(x => x.p).join() === '2:41 /100 m,2:29 /100 m,1:40 /100 m' && c0.iv.every(x => x.rows === 0), JSON.stringify(c0.iv.map(x => [x.p, x.btn])));
await page.waitForTimeout(700);
let b = await READ();
ok('B1 3 Intervalle (75 m · 125 m · 1.150 m), 3 Pausenbloecke (7:02 aus 4 Pausenrunden · 7:27 · 9:27)', b.iv.map(x => x.d).join() === '75 m,125 m,1.150 m' && b.rest.length === 3 && /7:02/.test(b.rest[0]) && /4 Pausenrunden/.test(b.rest[0]) && /7:27/.test(b.rest[1]) && /9:27/.test(b.rest[2]), JSON.stringify(b.rest));
ok('B2 Zusammenfassung: Schwimmzeit 24:17, Pausen gesamt 45:14, Tempo 1:48 /100 m', b.sum.length === 3 && /24:17/.test(b.sum[0]) && /45:14/.test(b.sum[1]) && /1:48/.test(b.sum[2]), JSON.stringify(b.sum));
/* v8-454: kompakte Karte = Distanz · Schwimmtempo · Schwimmzeit; alles Weitere erst beim Aufklappen */
ok('B3a kompakte Karte: zweite Zeile nur „19:10 Schwimmzeit" (keine sechs Textzeilen)', /^19:10 Schwimmzeit/.test(b.iv[2].meta.trim()) && !/Züge|SWOLF|Pause/.test(b.iv[2].meta), b.iv[2].meta);
await page.evaluate(() => { document.querySelectorAll('.aa-sw-ivh[aria-expanded]')[2].click(); }); await page.waitForTimeout(120);
const b3 = (await READ()).iv[2].body.replace(/\s+/g, ' ');
ok('B3 Intervall 3 aufgeklappt: Schwimmzeit 19:10, Pause im Intervall 17:32, 46 Bahnen, Gemischt, 511 Zuege, SWOLF 36 — keine Zuege/Bahn bei gemischten Lagen', /Schwimmzeit ?19:10/.test(b3) && /Pause im Intervall ?17:32/.test(b3) && /Bahnen ?46/.test(b3) && /Gemischt/.test(b3) && /Züge gesamt ?511/.test(b3) && /SWOLF ?36/.test(b3) && !/Züge je Bahn/.test(b3), b3.slice(0, 300));
await page.evaluate(() => { document.querySelectorAll('.aa-sw-ivh[aria-expanded]')[2].click(); }); await page.waitForTimeout(80);
b = await READ();
ok('B4 nach dem Laden aufklappbar; nie geoeffnete Intervalle ohne Bahnen im DOM (mobile Leistung), zugeklapptes verborgen; genau EIN Abruf', b.iv.every(x => x.btn && x.exp === 'false') && b.iv[0].rows === 0 && b.iv[1].rows === 0 && b.iv[2].hidden === true && b.calls === 1);
ok('B5 Diagramme: Tempo je Bahn, Puls, SWOLF je Bahn', b.chips.join() === 'Tempo je Bahn,Puls,SWOLF je Bahn', b.chips.join());
await page.evaluate(() => { const bs = document.querySelectorAll('.aa-sw-ivh[aria-expanded]'); bs[2].click(); }); await page.waitForTimeout(150);
const b6 = await READ();
ok('B6 Intervall 3 antippen: 46 geschwommene Bahnen + 14 Pausenbahnen, nur dieses Intervall offen', b6.iv[2].exp === 'true' && b6.iv[2].hidden === false && b6.iv[2].rows === 46 && b6.iv[2].restRows === 14 && b6.iv[0].rows === 0 && b6.iv[1].exp === 'false', JSON.stringify(b6.iv.map(x => [x.exp, x.rows, x.restRows])));
ok('B7 11 Bahnen dezent markiert; Vorlesetext „Messwert möglicherweise ungenau" bzw. „ausgeschlossen"', b6.iv[2].sus === 11 && await page.evaluate(() => [...document.querySelectorAll('.aa-sw-l.is-suspect')].every(x => /möglicherweise ungenau|ausgeschlossen/.test(x.getAttribute('aria-label')))));
const row1 = await page.evaluate(() => [...document.querySelectorAll('#gmSwL3 .aa-sw-l[role="listitem"]')][0].textContent);
ok('B8 erste Bahn von Intervall 3 mit echten Werten: 0:40 · 2:40 /100 m · Kraul · 23 Zuege · SWOLF 63', row1 === '10:402:40Kraul2363', row1);
ok('B9 SWOLF-Verlauf (Kraul, 25 m, 28 Bahnen) und Bahnlaenge 25 m genannt', await page.evaluate(() => /SWOLF Kraul \(25 m, 28 Bahnen\)/.test(document.querySelector('#gmSwL3 .aa-sw-trend').textContent) && /Bahnlänge 25 m/.test(document.querySelector('#gmSwL3').textContent)));
await page.evaluate(() => { document.querySelector('.aa-chips button:nth-child(2)').click(); }); await page.waitForTimeout(200);
ok('B10 Neuzeichnen (Diagramm wechseln) behaelt das aufgeklappte Intervall', (await READ()).iv[2].exp === 'true');
await page.evaluate(() => { document.querySelectorAll('.aa-sw-ivh[aria-expanded]')[2].click(); }); await page.waitForTimeout(100);
ok('B11 erneut antippen klappt zu', (await READ()).iv[2].hidden === true);
await page.focus('.aa-sw-ivh[aria-expanded]'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
ok('B12 Tastatur: Enter auf dem Intervall klappt auf (echter Knopf)', (await READ()).iv[0].exp === 'true');

sec('C · Laden scheitert');
await setup([withLaps], EXT, 'fail');
await page.evaluate(id => gmOpenActivityPage(id), withLaps.id); await page.waitForTimeout(700);
const cf = await READ();
await page.evaluate(() => { document.querySelectorAll('.aa-sw-ivh[aria-expanded]')[2].click(); }); await page.waitForTimeout(80);
const cf2 = await READ();
ok('C2 Rohblock nicht ladbar: Intervalle und Schwimmtempo bleiben (lokale Runden); aufgeklappt ohne Bahnen, kein Fehler', cf.card && cf.iv.length === 3 && cf2.iv[2].rows === 0 && /Schwimmzeit/.test(cf2.iv[2].body) && /2:41/.test(cf.iv[0].p));

sec('D · Messdetails');
await setup([withLaps], EXT, 'ok');
await page.evaluate(id => gmOpenActivityPage(id), withLaps.id); await page.waitForTimeout(700);
const d = await READ();
ok('D1 Messdetails nennen Zeitdefinition, Pausenerkennung, Summenpruefung (stimmt), Plausibilitaet und fehlende Validierung', /Intervalle und Bahnen/.test(d.md) && /Schwimmzeit = Summe der geschwommenen Bahnen/.test(d.md) && /Pausenrunden werden keinem Intervall zugeschlagen/.test(d.md) && /Distanz: stimmt/.test(d.md) && /Zeitbilanz .*: stimmt/.test(d.md) && /möglicherweise ungenau: 10/.test(d.md) && /ausgeschlossen: 1/.test(d.md) && /nicht gegen Garmin Connect validiert/.test(d.md));
ok('D2 keine technischen Feldnamen in der Hauptansicht', !(await page.evaluate(() => { const p = document.getElementById('gmActPage').cloneNode(true); p.querySelectorAll('details').forEach(x => x.remove()); return /lapDTOs|lengthDTOs|movingDuration|averageSWOLF|FREESTYLE/.test(p.textContent); })));

sec('E · Layout');
for (const w of [320, 375, 390, 430, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.evaluate(() => { try { _gmSwOpen = {}; } catch (e) {} gmActRedrawKeep(); const bs = document.querySelectorAll('.aa-sw-ivh[aria-expanded]'); if (bs[2]) bs[2].click(); });
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), clip = e => e.scrollWidth > e.clientWidth + 1;
    return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pov: p.scrollWidth - p.clientWidth,
      cut: [...p.querySelectorAll('.iv-card b, .iv-card em, .iv-stat span, .iv-sub, .iv-grid dd, .aa-sw-l > span, .tl-axis span, .aa-chips button')].filter(clip).map(e => e.textContent).slice(0, 4) }; });
  ok('E ' + w + ' px: kein Ueberlauf, kein abgeschnittener Wert (Intervalle, Bahnen, Zusammenfassung)', m.ov <= 0 && m.pov <= 0 && !m.cut.length, JSON.stringify(m));
}
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' swim_intervals_v453_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
