/* ============================================================
   ORVIA · story_share_v456_ui_e2e — Teilen aus den Highlights im echten Browser (Chromium, echte Garmin-Mitschnitte)
   S  Story: Teilen-Symbol (oben, kein Ueberdecken), Auswahl pausiert die Story, Escape → weiter an derselben Seite
   E  Abschlussseite: „Teilen" + „Fertig", bleibt stehen
   X  Export: Karte PNG 1080 × 1920 deckend; Aufkleber PNG mit echtem Alpha-Kanal (Ecken transparent), Inhalt sichtbar
   N  natives Teilen (navigator.share gestubbt): Datei image/png, Aufruf noch im Tipp (Nutzeraktivierung aktiv),
      Abbruch ohne Fehlermeldung, Fehler mit Hinweis; ohne canShare: kein Teilen-Knopf, Speichern als Hauptweg
   C  Aufkleber kopieren (Clipboard gestubbt): Erfolg erst nach write(), Fehler mit Fallback-Hinweis
   D  Datenschutz: Ausblenden aendert nur die Exportdatei — gespeicherte Strecke unveraendert
   W  Daten: Schwimmen ohne GPS / Kraft ohne Strecke / Zwift (Spielwelt), lange Titel, Bestzeit-Kategorie (HM-Fall)
   H  Highlights: vergleichbare Runden ohne Pausenrunden, Streckenzeichnung 2 s/km
   L  Layout 320 / 390 / 768 / 1440 px, hell, Tippflaechen
   Hinweis: Mocks belegen die Verdrahtung, NICHT das Verhalten echter iPhones/Instagram (offen, Geraetetest).
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
  return { a: { id: '54560000-0000-4000-8000-0000000000' + String(_n).padStart(2, '0'), clientRecordId: 'act:v456s-' + _n, sportId: f.sport, source: 'garmin', status: 'completed',
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

let SHARED = null;
const RUN = real('running__running__intervals', 'Intervalllauf', ROUTE), ZW = real('cycling__virtual_ride__indoor', 'Zwift – Watopia', ROUTE), SW = swim();
/* synthetische Krafteinheit (gekennzeichnet: kein Mitschnitt) */
const GYM = { a: { id: '54560000-0000-4000-8000-000000000099', clientRecordId: 'act:v456s-gym', sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: '2026-10-08T16:00:00.000Z', durationSeconds: 4020, workoutSessionId: 'w-v456s',
  summary: { name: 'Oberkörper', exerciseCount: 2, workingSetCount: 5, avgHr: 112 }, metrics: { exercises: [{ name: 'Bankdrücken', sets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }, { reps: 7, weight: 70 }] }, { name: 'Rudern', sets: [{ reps: 12, weight: 50 }, { reps: 11, weight: 50 }] }] } }, ext: null };
async function story(c) { await open(c); await page.evaluate(id => gmOpenStory(id), c.a.id); await page.waitForTimeout(300); }
async function shareOpen() { await page.evaluate(() => document.querySelector('#gmStory .wst-share').click()); await page.waitForFunction(() => !!document.querySelector('.shs[data-ready]'), null, { timeout: 8000 }); }
const ready = id => page.waitForFunction(i => { const h = document.querySelector('.shs'); return h && h.getAttribute('data-ready') === i && !h.classList.contains('is-busy'); }, id, { timeout: 8000 });
const decode = () => page.evaluate(async () => { const st = ORVIA.storyShare._state(); const bm = await createImageBitmap(st.blob); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
  const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data); let opaque = 0; const d = x.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 200) opaque++;
  return { w: bm.width, h: bm.height, type: st.blob.type, corners: [px(0, 0), px(c.width - 1, 0), px(0, c.height - 1), px(c.width - 1, c.height - 1)].map(p => p[3]), opaque, file: st.file && { name: st.file.name, type: st.file.type, size: st.file.size } }; });

sec('S · Story: Teilen-Symbol');
await story(RUN);
const s1 = await page.evaluate(() => { const sh = document.querySelector('#gmStory .wst-share'), x = document.querySelector('#gmStory .wst-x'); if (!sh) return null; const a = sh.getBoundingClientRect(), b = x.getBoundingClientRect();
  return { label: sh.getAttribute('aria-label'), overlap: !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom), w: a.width, svg: !!sh.querySelector('svg') }; });
ok('S1 Teilen-Symbol (Quadrat mit Pfeil) oben in der Story, benannt „Teilen", ueberdeckt das Schliessen nicht', s1 && s1.label === 'Teilen' && !s1.overlap && s1.svg && s1.w >= 34, JSON.stringify(s1));
await shareOpen();
const s2 = await page.evaluate(() => ({ dlg: document.querySelector('.shs').getAttribute('role') + '/' + document.querySelector('.shs').getAttribute('aria-modal'), timer: _gmStory.timer, tabs: [...document.querySelectorAll('.shs-seg [role=tab]')].map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')),
  tpls: [...document.querySelectorAll('.shs-th')].map(b => b.getAttribute('data-tpl')), img: (i => [i.naturalWidth, i.naturalHeight])(document.querySelector('.shs-img')), focus: document.activeElement && document.activeElement.closest('.shs') ? 1 : 0 }));
ok('S2 Auswahl als Dialog; Story angehalten; Karten | Aufkleber; Vorlagen mit Strecke; Vorschau 1080 × 1920; Fokus im Dialog', s2.dlg === 'dialog/true' && s2.timer === null && s2.tabs.join() === 'Karten*,Aufkleber' && /route,route_plus/.test(s2.tpls.join()) && s2.img.join() === '1080,1920' && s2.focus === 1, JSON.stringify(s2));

sec('X · Export');
const x1 = await decode();
ok('X1 Karte: PNG 1080 × 1920, deckend (Ecken Alpha 255), Datei image/png .png', x1.w === 1080 && x1.h === 1920 && x1.type === 'image/png' && x1.corners.every(a => a === 255) && x1.file && x1.file.type === 'image/png' && /\.png$/.test(x1.file.name) && x1.file.size > 10000, JSON.stringify(x1));
await page.evaluate(() => document.querySelector('.shs [data-kind="sticker"]').click()); await ready('s_main');
const x2 = await decode();
ok('X2 Aufkleber: PNG mit echtem Alpha-Kanal — Ecken transparent (Alpha 0), Inhalt deckend vorhanden', x2.type === 'image/png' && x2.corners.every(a => a === 0) && x2.opaque > 50 && x2.w === 1080, JSON.stringify(x2));
ok('X3 Aufkleber-Vorschau auf Schachbrett (nur Darstellung) — die Datei selbst bleibt transparent', await page.evaluate(() => /linear-gradient/.test(getComputedStyle(document.querySelector('.shs-prev')).backgroundImage) && document.querySelector('.shs-prev').classList.contains('is-sticker')));
await page.evaluate(() => document.querySelector('.shs [data-tpl="s_route"]').click()); await ready('s_route');
const x4 = await decode();
ok('X4 GPS-Strecke ohne Kartengrund als Aufkleber: transparent, Strecke sichtbar', x4.corners.every(a => a === 0) && x4.opaque > 20 && x4.h === 1080, JSON.stringify(x4));

sec('D · Datenschutz');
const before = await page.evaluate(() => JSON.stringify(window.__local[0].metrics.route));
const d1 = await page.evaluate(() => { const st = ORVIA.storyShare._state(); const box = document.querySelector('.shs-priv'); return { shown: !box.hidden, sel: [...box.querySelectorAll('[data-priv]')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.getAttribute('data-priv')).join(), note: box.textContent }; });
await page.evaluate(() => document.querySelector('.shs [data-priv="500"]').click()); await ready('s_route');
const after = await page.evaluate(() => JSON.stringify(window.__local[0].metrics.route));
ok('D1 Streckenvorlage: Start/Ziel ausblenden sichtbar, Standard 200 m, Hinweis „nur dieses Bild"', d1.shown && d1.sel === '200' && /nur für dieses Bild/.test(d1.note), JSON.stringify(d1));
ok('D2 Umschalten auf 500 m erzeugt eine neue Exportdatei — gespeicherte Strecke unveraendert', before === after && before.length > 50 && await page.evaluate(() => ORVIA.storyShare._state().privacyM === 500));

sec('N · natives Teilen');
const n0 = await page.evaluate(() => ({ share: document.querySelector('.shs [data-act="share"]').hidden, savePrimary: document.querySelector('.shs [data-act="save"]').classList.contains('shs-primary'), hint: document.querySelector('.shs-hint').textContent }));
ok('N1 ohne Datei-Teilen (canShare fehlt): kein Teilen-Knopf, „Bild speichern" ist der Hauptweg, ehrlicher Hinweis', n0.share === true && n0.savePrimary && /nicht möglich/.test(n0.hint), JSON.stringify(n0));
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
const e1 = await page.evaluate(() => ({ open: !!document.querySelector('.shs'), story: document.getElementById('gmStory').classList.contains('on'), timer: _gmStory.timer !== null, focus: document.activeElement && document.activeElement.classList.contains('wst-share') }));
ok('N2 Escape schliesst die Auswahl; Story laeuft an derselben Seite weiter; Fokus wieder auf dem Teilen-Symbol', !e1.open && e1.story && e1.timer && e1.focus, JSON.stringify(e1));
await page.evaluate(() => { window.__sh = []; window.__mode = 'ok'; navigator.canShare = d => !!(d && d.files && d.files.length);
  navigator.share = d => { window.__sh.push({ n: d.files.length, type: d.files[0].type, name: d.files[0].name, size: d.files[0].size, act: navigator.userActivation ? navigator.userActivation.isActive : null });
    return window.__mode === 'ok' ? Promise.resolve() : Promise.reject(window.__mode === 'abort' ? new DOMException('x', 'AbortError') : new Error('boom')); }; });
await shareOpen();
await page.click('.shs [data-act="share"]'); await page.waitForTimeout(150);
const n3 = await page.evaluate(() => ({ calls: window.__sh, status: document.querySelector('.shs-status').textContent }));
ok('N3 Tipp auf „Teilen": navigator.share mit genau einer PNG-Datei, Aufruf noch innerhalb der Nutzeraktivierung; danach „Geteilt."', n3.calls.length === 1 && n3.calls[0].type === 'image/png' && /\.png$/.test(n3.calls[0].name) && n3.calls[0].size > 10000 && n3.calls[0].act === true && n3.status === 'Geteilt.', JSON.stringify(n3));
await page.evaluate(() => { window.__mode = 'abort'; }); await page.click('.shs [data-act="share"]'); await page.waitForTimeout(120);
ok('N4 Abbrechen im System-Menue: keine Fehlermeldung', await page.evaluate(() => document.querySelector('.shs-status').textContent === ''));
await page.evaluate(() => { window.__mode = 'err'; }); await page.click('.shs [data-act="share"]'); await page.waitForTimeout(120);
ok('N5 fehlgeschlagenes Teilen: Hinweis mit Ausweg „speichern"', await page.evaluate(() => /Speichere das Bild/.test(document.querySelector('.shs-status').textContent)));

sec('C · Aufkleber kopieren');
await page.evaluate(() => { window.__clip = null; window.ClipboardItem = function (o) { this.types = Object.keys(o); this.o = o; };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: items => new Promise((res, rej) => { window.__clip = { items: items.map(i => i.types.join()), res, rej }; }) } }); });
await page.evaluate(() => document.querySelector('.shs [data-kind="sticker"]').click()); await ready('s_main');
const c0 = await page.evaluate(() => !document.querySelector('.shs [data-act="copy"]').hidden);
await page.click('.shs [data-act="copy"]'); await page.waitForTimeout(80);
const c1 = await page.evaluate(() => ({ items: window.__clip && window.__clip.items, status: document.querySelector('.shs-status').textContent }));
await page.evaluate(() => window.__clip.res()); await page.waitForTimeout(80);
const c2 = await page.evaluate(() => document.querySelector('.shs-status').textContent);
ok('C1 „Aufkleber kopieren" (nur bei Aufklebern, nur mit ClipboardItem): image/png in die Zwischenablage; Erfolg ERST nach write()', c0 && c1.items && c1.items[0] === 'image/png' && !/kopiert/.test(c1.status) && /kopiert/.test(c2), JSON.stringify([c1, c2]));
await page.click('.shs [data-act="copy"]'); await page.waitForTimeout(60); await page.evaluate(() => window.__clip.rej(new Error('denied'))); await page.waitForTimeout(80);
ok('C2 Kopieren abgelehnt: kein Erfolg, Fallback-Hinweis (speichern, in Instagram über „Foto")', await page.evaluate(() => /nicht möglich/.test(document.querySelector('.shs-status').textContent)));
await page.evaluate(() => document.querySelector('.shs [data-kind="card"]').click()); await ready('hero');
ok('C3 Karten: kein „Kopieren"-Knopf', await page.evaluate(() => document.querySelector('.shs [data-act="copy"]').hidden));

sec('L · Layout');
for (const w of [320, 390, 768, 1440]) {
  await page.setViewportSize({ width: w, height: w > 700 ? 900 : 760 }); await page.waitForTimeout(200);
  const m = await page.evaluate(() => { const p = document.querySelector('.shs-panel').getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const btn = [...document.querySelectorAll('.shs-btn:not([hidden]), .shs-seg button, .shs-x')].map(b => b.getBoundingClientRect().height);
    const pr = document.querySelector('.shs-prev').getBoundingClientRect();
    return { inside: p.left >= -0.5 && p.right <= vw + 0.5 && p.top >= -0.5 && p.bottom <= vh + 0.5, ov: document.documentElement.scrollWidth - vw, tap: Math.min(...btn), ratio: Math.round(pr.height / pr.width * 100) / 100 }; });
  ok('L ' + w + ' px: Auswahl vollstaendig im Bild, kein Ueberlauf, Tippflaechen ≥ 40 px, Vorschau im Story-Format 9:16', m.inside && m.ov <= 0 && m.tap >= 40 && Math.abs(m.ratio - 1.78) < 0.03, JSON.stringify(m));
}
await page.setViewportSize({ width: 390, height: 900 });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); await page.waitForTimeout(60);
const lt = await page.evaluate(() => getComputedStyle(document.querySelector('.shs-panel')).backgroundColor); await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
ok('L hell: eigene helle Flaeche (keine automatische Umkehr)', /rgb\(251, 250, 247\)/.test(lt), lt);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);

sec('E · Abschlussseite');
const e2 = await page.evaluate(() => { _gmStory.idx = _gmStory.pages.length - 1; gmStoryRender(); const pg = document.querySelector('#gmStory .wst-page.on');
  return { btns: [...pg.querySelectorAll('.wst-endbtn')].map(b => b.textContent.trim()), timer: _gmStory.timer, end: document.getElementById('gmStory').classList.contains('st-end'), bars: [...document.querySelectorAll('#gmStory .wst-bars i')].filter(i => getComputedStyle(i).display !== 'none').length, pages: _gmStory.pages.length }; });
ok('E1 nach der letzten Szene: „Teilen" + „Fertig", bleibt stehen (kein Weiterschalten), ohne eigenen Fortschrittsbalken', e2.btns.join() === 'Teilen,Fertig' && e2.timer === null && e2.end && e2.bars === e2.pages - 1, JSON.stringify(e2));
await page.evaluate(() => document.querySelector('#gmStory .wst-page.on .wst-endbtn.is-primary').click()); await page.waitForFunction(() => !!document.querySelector('.shs[data-ready]'));
ok('E2 „Teilen" auf der Abschlussseite oeffnet DIESELBE Auswahl', await page.evaluate(() => ORVIA.storyShare.isOpen() && document.querySelectorAll('.shs').length === 1));
await page.keyboard.press('Escape'); await page.waitForTimeout(80);
await page.evaluate(() => [...document.querySelectorAll('#gmStory .wst-page.on .wst-endbtn')].find(b => b.textContent.trim() === 'Fertig').click()); await page.waitForTimeout(80);
ok('E3 „Fertig" schliesst die Highlights', await page.evaluate(() => !document.getElementById('gmStory').classList.contains('on')));

sec('W · Daten je Sportart');
const dataOf = c => page.evaluate(id => { const d = gmShareData(id); return { fam: d.fam, ids: d.metrics.map(m => m.id), labels: d.metrics.map(m => m.label), route: !!d.route, virt: d.routeVirtual, tag: d.routeTag, pb: d.pb, cards: ORVIA.storyShare.templates(d, 'card').map(t => t.id), st: ORVIA.storyShare.templates(d, 'sticker').map(t => t.id) }; }, c.a.id);
await open(SW); const w1 = await dataOf(SW);
ok('W1 Schwimmen ohne GPS: Distanz, Tempo /100 m, Dauer, Bahnen…; keine Streckenvorlage', w1.fam === 'swimming' && w1.ids[0] === 'distance' && w1.ids.includes('pace100') && !w1.route && !w1.cards.some(t => /route/.test(t)), JSON.stringify(w1));
await open(GYM); const w2 = await dataOf(GYM);
ok('W2 Kraft ohne Strecke (synthetisch): Volumen (aus den echten Saetzen, 3.360 kg) zuerst, dann Dauer und Saetze; keine Strecke', w2.fam === 'gym' && w2.ids[0] === 'volume' && w2.ids.includes('duration') && w2.ids.includes('workingSets') && !w2.route, JSON.stringify(w2));
await open(ZW); const w3 = await dataOf(ZW);
ok('W3 Zwift: Leistung zuerst, Strecke als Spielwelt gekennzeichnet (kein Ausblenden noetig), virtuelle Distanz benannt', w3.ids[0] === 'avgPower' && w3.virt && /Spielwelt/.test(w3.tag) && w3.labels.some(l => /virtuell/.test(l)), JSON.stringify(w3));
const lt2 = await page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = '800 70px ' + ORVIA.storyShare.FONT; const t = 'Sehr langer Aktivitätstitel – Intervall-Training mit Steigerungen über die Halbmarathon-Distanz am Phönix-See 🏃 Ölmühle'; const l = ORVIA.storyShare.wrapLines(c, t, 888, 2); return { n: l.length, w: l.map(x => Math.round(c.measureText(x).width)), last: l[l.length - 1].slice(-1) }; });
ok('W4 sehr langer Titel (Unicode, Umlaute, Emoji): hoechstens zwei Zeilen, jede ≤ 888 px, Auslassungszeichen', lt2.n === 2 && lt2.w.every(x => x <= 888) && lt2.last === '…', JSON.stringify(lt2));
const pbt = await page.evaluate(id => { const a = window.__local[0]; const keep = window.bestTimes;
  window.bestTimes = () => ({ meas: { k10: { sec: 3709, activityId: a.clientRecordId, targetKm: 10, method: 'stream_window', km: 10 } }, active: { k10: { sec: 3475, activityId: 'anderer-lauf', targetKm: 10, method: 'activity_timer' } } });
  const sp = a.sportId; a.sportId = 'running'; const r = gmStoryPbOf(a); a.sportId = sp; window.bestTimes = keep; return r && { cat: r.catLabel, time: r.time, dist: r.dist }; }, ZW.a.id);
ok('W5 HM-Fall: 10-km-Bestwert dieser Einheit nur einschliesslich Pausen → „Bestzeit einschließlich Pausen · 10 km · 1:01:49" (nicht 61:49, nicht als aktive Bestzeit)', pbt && pbt.cat === 'Bestzeit einschließlich Pausen' && pbt.time === '1:01:49' && pbt.dist === '10 km', JSON.stringify(pbt));

sec('H · Highlights');
await open(RUN);
const h1 = await page.evaluate(id => { const a = window.__local[0]; const vm = activityDetailViewModel(a); const lm = gmStoryLapModel(a, vm, null, 'pace'); const pages = gmStoryPages(a).join('');
  const m = /<div class="wst-laps">([\s\S]*?)<\/div><\/div>/.exec(pages); return { lm: lm && { n: lm.rows.length, txt: lm.rows.map(r => r.txt), best: lm.rows.filter(r => r.best).length, kick: lm.kick }, zero: /<strong>0:0\d<\/strong>/.test(pages), draw: (/--st-draw:([\d.]+)s/.exec(pages) || [])[1], km: a.summary.distanceKm }; }, RUN.a.id);
ok('H1 Runden-Seite aus der Intervall-Engine: nur vergleichbare Belastungen (Tempo /km), genau eine schnellste, keine Pausenrunde („0:0x")', h1.lm && h1.lm.n >= 3 && h1.lm.txt.every(t => /^\d+:\d\d \/km$/.test(t)) && h1.lm.best === 1 && !h1.zero, JSON.stringify(h1));
const h2 = await page.evaluate(() => { const ps = gmStoryPages(window.__local[0]); return { ms0: gmStoryPageMs(ps[0]), def: GM_STORY_MS, st: (/data-st-ms="(\d+)"/.exec(ps[0]) || [])[1], f: gmStoryRouteDraw(21.0975), f2: gmStoryRouteDraw(0.4), f3: gmStoryRouteDraw(60) }; });
ok('H2 Strecke zeichnet sich mit 2 s je km (' + h1.km + ' km → ' + h1.draw + ' s; HM 42,2 s; min 2 s, max 90 s); bei „Bewegung reduzieren" ohne Verlaengerung der Seite',
  Math.abs(+h1.draw - Math.round(Math.min(90, Math.max(2, h1.km * 2)) * 10) / 10) < 0.01 && h2.f === 42.2 && h2.f2 === 2 && h2.f3 === 90 && h2.st === '0' && h2.ms0 === h2.def, JSON.stringify([h1.draw, h2]));

ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' story_share_v456_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
