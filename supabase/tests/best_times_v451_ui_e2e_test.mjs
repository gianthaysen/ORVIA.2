/* ============================================================
   ORVIA · best_times_v451_ui_e2e — Bestzeiten-Seite im echten Browser (15 echte Laeufe, Register aus)
   K  Karten: nur Distanz, Zeit, Datum (+ Pausenzeichen / „geschätzt"), Umschalter Aktiv | Gesamtzeit
   B  Detailsheet: Hauptleistung, Vergleichskacheln mit eigenem Datum, Hinweis nur bei Bedarf, Messdetails eingeklappt
   F  Faelle: ohne Pausen, Schaetzung, keine Messung, Schwimmen
   L  Layout: 320 / 375 / 390 / 430 / 1200 px — kein horizontaler Ueberlauf, kein abgeschnittener Text, kein Sprung
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
const { DIAG, diagRun } = await import('./_ledger-realdata.mjs');
const RUNS = DIAG.map((r, i) => diagRun(GEN, i, r));
const SWIM = { id: 'swim1', clientRecordId: 'swim1', sportId: 'swimming', source: 'manual', status: 'completed', startedAt: '2026-09-01T17:00:00.000Z', durationSeconds: 420, summary: { distanceM: 400 }, metrics: {} };

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

const open = acts => page.evaluate(a => {
  window._gmBtMode = 'active';
  ORVIA.activityStore.listActivities = () => a; ORVIA.activityStore.isTombstoned = null;
  Object.keys(DB).filter(k => typeof isDay === 'function' && isDay(k)).forEach(k => { delete DB[k]; });
  try { showTab('mehr'); } catch (e) {} gmOpenProfPage('bestTimes'); window.scrollTo(0, 0);
}, acts);
const cards = () => page.evaluate(() => [...document.querySelectorAll('#gmProfPage .bt-list .bt-row')].map(r => ({
  text: r.innerText.replace(/\s+/g, ' ').trim(), aria: r.getAttribute('aria-label'), pz: !!r.querySelector('.bt-pz'), est: r.hasAttribute('data-est'), empty: r.classList.contains('bt-empty') })));
const sheet = i => page.evaluate(i => { gmOpenBtRowSheet(i); const s = document.getElementById('detailSheet'), d = s.querySelector('details');
  return { hero: (s.querySelector('.bts-time') || {}).textContent, cap: (s.querySelector('.bts-cap') || {}).textContent, head: (s.querySelector('.bts-head h3') || {}).textContent,
           tiles: [...s.querySelectorAll('.bts-tile')].map(t => t.innerText.replace(/\s+/g, ' ').trim()), on: [...s.querySelectorAll('.bts-tile')].map(t => t.classList.contains('is-on')),
           hint: !!s.querySelector('.bts-hint'), detailsOpen: d ? d.open : null, details: d ? d.querySelector('dl').textContent.replace(/\s+/g, ' ') : '' }; }, i);

sec('K · Karten (Standard: Aktiv)');
await open(RUNS.concat([SWIM]));
let C = await cards();
ok('K1 sechs Karten: 1 · 5 · 10 · 21,1 km Laufen, 400 m Schwimmen, 20 km Rad', C.length === 6, C.map(c => c.text).join(' | '));
ok('K2 Aktiv: 4:21 · 23:38 · 57:55 · 2:20:47 (Werte des Registers)', /4:21/.test(C[0].text) && /23:38/.test(C[1].text) && /57:55/.test(C[2].text) && /2:20:47/.test(C[3].text));
ok('K3 Karte nennt Datum, aber keine Methode, Kategorie, Vergleichszeit oder Pausenerklaerung',
   /13\. Aug\. 2026/.test(C[1].text) && C.every(c => !/gemessen|Trainingsbestzeit|einschließlich|Pausen|Runden|Garmin|Timer|Gesamtzeit:/.test(c.text)), C[1].text);
ok('K4 Pausenzeichen nur bei aktiven Bestzeiten aus Laeufen mit angehaltenen Pausen (5 und 10 km)', C[1].pz && C[2].pz && !C[0].pz && !C[3].pz);
ok('K5 Bildschirmleser: vollstaendiger Satz je Karte', /5 Kilometer, Aktive Trainingsbestzeit 23:38, gemessen am 13\. August 2026/.test(C[1].aria) && /Trainingspausen nicht enthalten/.test(C[1].aria), C[1].aria);
const tg = await page.evaluate(() => ({ group: !!document.querySelector('#gmProfPage .bt-mode[role="group"]'), pressed: [...document.querySelectorAll('#gmProfPage .bt-mode button')].map(b => b.getAttribute('aria-pressed') + ':' + b.textContent) }));
ok('K6 Umschalter „Aktiv | Gesamtzeit", Standard Aktiv, aria-pressed', tg.group && tg.pressed.join() === 'true:Aktiv,false:Gesamtzeit', tg.pressed.join());
const top0 = await page.evaluate(() => [...document.querySelectorAll('#gmProfPage .bt-list .bt-row')].map(r => Math.round(r.getBoundingClientRect().top)));
await page.evaluate(() => gmSetBtMode('elapsed'));
C = await cards();
ok('K7 Gesamtzeit: 4:21 · 29:11 (06.09.) · 1:01:49 · 2:20:47 — kein „73:18" mehr', /4:21/.test(C[0].text) && /29:11/.test(C[1].text) && /6\. Sept\. 2026/.test(C[1].text) && /1:01:49/.test(C[2].text) && /2:20:47/.test(C[3].text) && !C.some(c => /\b\d{2,}:\d{2}\b/.test(c.text) && /7\d:\d\d/.test(c.text)), C.map(c => c.text).join(' | '));
ok('K8 Gesamtzeit: kein Pausenzeichen (Pausen sind enthalten)', C.every(c => !c.pz));
const top1 = await page.evaluate(() => [...document.querySelectorAll('#gmProfPage .bt-list .bt-row')].map(r => Math.round(r.getBoundingClientRect().top)));
ok('K9 Umschalten verschiebt keine Karte (kein Layoutsprung)', top0.join() === top1.join(), top0.join() + ' / ' + top1.join());
await page.evaluate(() => gmSetBtMode('active'));

sec('B · Detailsheet 5 km');
let S = await sheet(1);
ok('B1 Kopf „5 Kilometer", Hauptleistung 23:38 „Persönliche Trainingsbestzeit"', S.head === '5 Kilometer' && S.hero === '23:38' && S.cap === 'Persönliche Trainingsbestzeit', S.head + ' ' + S.hero + ' ' + S.cap);
ok('B2 Vergleich: „Aktive Zeit 23:38 13. Aug. 2026" und „Gesamtzeit 29:11 6. Sept. 2026" — verschiedene Laeufe, je eigenes Datum', S.tiles[0] === 'Aktive Zeit 23:38 13. Aug. 2026' && S.tiles[1] === 'Gesamtzeit 29:11 6. Sept. 2026' && S.on.join() === 'true,false', S.tiles.join(' | '));
ok('B3 Hinweis „Trainingspausen …" erscheint (Unterschied durch Pausen)', S.hint);
ok('B4 Messdetails eingeklappt', S.detailsOpen === false);
ok('B5 Messdetails: Garmin Connect · ganze Aktivitaet, gestoppte Zeit · 5,006 km (nicht 5,1) · 9 min 39 s angehalten · beide Laeufe benannt · Genauigkeit',
   /Garmin Connect/.test(S.details) && /Ganze Aktivität, gestoppte Zeit/.test(S.details) && /5,006 km/.test(S.details) && !/5,1 km/.test(S.details) && /9 min 39 s angehalten/.test(S.details) && /13\. Aug\. 2026/.test(S.details) && /6\. Sept\. 2026/.test(S.details) && /Hoch/.test(S.details), S.details);
const dOpen = await page.evaluate(() => { const s = document.querySelector('#detailSheet summary'); s.click(); return document.querySelector('#detailSheet details').open; });
ok('B6 „Messdetails anzeigen" oeffnet per Klick (natives <details>, tastaturbedienbar)', dOpen === true);
await page.evaluate(() => gmSetBtMode('elapsed'));
S = await sheet(1);
ok('B7 Gesamtzeit-Modus: Hauptleistung 29:11 „einschließlich Pausen", Strecke 5,000 km, Pausen enthalten', S.hero === '29:11' && /einschließlich Pausen/.test(S.cap) && /5,000 km/.test(S.details) && /In der Gesamtzeit enthalten/.test(S.details) && S.on.join() === 'false,true', S.details);
await page.evaluate(() => gmSetBtMode('active'));

sec('F · Faelle');
S = await sheet(0);
ok('F1 1 km ohne Unterschied: kein Pausenhinweis, Strecke 1,001 km, Obergrenze ehrlich benannt', !S.hint && /1,001 km/.test(S.details) && /Obergrenze/.test(S.details), S.details);
S = await sheet(4);
ok('F2 Schwimmen: eine Zeit, keine Lauf-Kacheln, eigene Eingabe', S.hero === '7:00' && S.tiles.length === 0 && /Eigene Eingabe/.test(S.details) && /400 m/.test(S.details), S.details);
S = await sheet(5);
ok('F3 keine Messung: „—", „Noch keine Messung", keine Details', S.hero === '—' && S.cap === 'Noch keine Messung' && S.detailsOpen === null);
/* Nur ein kurzer Lauf (2 km): 5 km ist eine Schaetzung und muss so aussehen */
await open([RUNS[1]]);
C = await cards();
S = await sheet(1);
ok('F4 Schaetzung: Karte „geschätzt", Sheet „Geschätzt – noch keine Messung", keine Vergleichskacheln', C[1].est && /geschätzt/.test(C[1].text) && /Geschätzt/.test(S.cap) && S.tiles.length === 0 && /Riegel/.test(S.details), C[1].text + ' / ' + S.details);
ok('F5 ohne Aktivitaeten: keine erfundenen Werte', await (async () => { await open([]); const c = await cards(); return c.length === 0 || c.every(x => x.empty); })());

sec('L · Layout');
await open(RUNS.concat([SWIM]));
for (const w of [320, 375, 390, 430, 1200]) {
  await page.setViewportSize({ width: w, height: 844 });
  await page.evaluate(() => { gmOpenProfPage('bestTimes'); });
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => {
    const clip = el => el.scrollWidth > el.clientWidth + 1;
    const pageOv = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const cut = [...document.querySelectorAll('#gmProfPage .bt-time, #gmProfPage .bt-date, #gmProfPage .bt-dist b, #gmProfPage .bt-mode button')].filter(clip).map(e => e.textContent);
    const inside = [...document.querySelectorAll('#gmProfPage .bt-list .bt-row')].every(r => { const a = r.getBoundingClientRect(); return [...r.querySelectorAll('.bt-time,.bt-date,.bt-imp')].every(e => { const b = e.getBoundingClientRect(); return b.right <= a.right + 0.5 && b.left >= a.left - 0.5; }); });
    gmOpenBtRowSheet(1); const d = document.querySelector('#detailSheet details'); d.open = true;
    const sh = document.getElementById('detailSheet');
    const sOv = sh.scrollWidth - sh.clientWidth;
    const sCut = [...sh.querySelectorAll('.bts-time, .bts-tile b, .bts-head h3, .bts-mr dd')].filter(clip).map(e => e.textContent);
    return { pageOv, cut, inside, sOv, sCut };
  });
  ok('L ' + w + ' px: kein Ueberlauf, kein abgeschnittener Text (Karten und Sheet)', m.pageOv <= 0 && !m.cut.length && m.inside && m.sOv <= 0 && !m.sCut.length, JSON.stringify(m));
}
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' best_times_v451_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
