/* ============================================================
   ORVIA · activity_experience_v4541_ui_e2e — neue Aktivitaetsansicht im echten Browser (echte Garmin-Mitschnitte)
   H  Hierarchie: Kopfbild → Hauptleistung → Verlauf → Intervalle → Analyse → Bewertung → Kennzahlen → Herkunft/Einstellungen;
      Titel genau einmal; Loeschen ganz am Ende
   R  Renderfehler: nirgends „[object Object]", „undefined", „NaN", „null" — alle Bereiche aufgeklappt, alle Sportarten
   Z  Zwift 07.10.: Zeiten mit Definition, Widerspruch der Garmin-Quellen benannt, virtuelle Werte gekennzeichnet,
      virtuelle Strecke ohne Landkarte, Leistungskurve aus Garmins Bestwerten
   C  Diagramme: Wechsel, Fadenkreuz + Tooltip (Zeiger, Tastatur), Vergleich zweier Reihen derselben Zeitachse, Luecken
   K  Kennzahlen-Bibliothek gruppiert, Qualitaet als dezentes Zeichen + Detail beim Antippen
   T  hell / dunkel / reduzierte Bewegung
   E  Layout 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px: kein Ueberlauf, nichts abgeschnitten, Tippflaechen, Desktop mehrspaltig
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
  return { a: { id: '54500000-0000-4000-8000-0000000000' + String(_n).padStart(2, '0'), clientRecordId: 'act:v4541-' + _n, sportId: f.sport, source: 'garmin', status: 'completed',
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
const TXT = () => page.evaluate(() => { const p = document.getElementById('gmActPage'); p.querySelectorAll('details').forEach(d => { d.open = true; }); return p.innerText; });
const BAD = /\[object Object\]|\bundefined\b|\bNaN\b|\bnull\b|\b(ax|aa|ui)\.[a-z_]+\.[a-z_]/;

const RUN = real('running__running__intervals', 'Intervalllauf', ROUTE), RIDE = real('cycling__road_biking__intervals', 'Ausfahrt'), ZW = real('cycling__virtual_ride__indoor', 'Zwift – Watopia', ROUTE);
const STEADY = real('running__running__steady', 'Lauf'), RIDE1 = real('cycling__cycling__steady', 'Radfahrt'), SW = swim();

sec('H · Hierarchie');
await open(RUN); await open(RUN);   /* zweites Oeffnen = gemessen (warm, wie im Betrieb) */
const h = await page.evaluate(() => {
  const p = document.getElementById('gmActPage'), q = s => p.querySelector(s), y = e => e ? e.getBoundingClientRect().top + p.scrollTop : null;
  const order = ['.ax-top', '.ax-hero', '.ax-charts', '.iv-card', '.ax-analysis', '.ax-assess', '.ax-libsec', '.ax-srcsec'].map(s => y(q(s)));
  const title = q('.ax-title').textContent, same = [...p.querySelectorAll('h1, h2, .ax-kicker span, .page-head h2')].filter(e => e.textContent.trim() === title).length;
  const del = q('.gm-corr .danger-btn'), last = [...p.querySelectorAll('button')].filter(b => b.offsetParent).pop();
  return { order, title, same, delLast: del === last, story: !!q('.ax-hero .gm-story-cta'), src: !!q('.ax-hero .ax-chip'), map: !!q('.ax-top .route-map'), bar: q('.ax-top') && q('.ax-top').previousElementSibling && q('.ax-top').previousElementSibling.className, dt: window.__dt };
});
ok('H1 Reihenfolge: Kopfbild · Hauptleistung · Verlauf · Abschnitte · Analyse · Trainingsbewertung · Alle Kennzahlen · Datenherkunft', h.order.every((v, i) => v !== null && (i === 0 || v > h.order[i - 1])), JSON.stringify(h.order));
ok('H2 Aktivitaetsname genau einmal (kein zweiter Titel in Kopfleiste oder Kennzeichen)', h.same === 1, JSON.stringify([h.title, h.same]));
ok('H3 Strecke als Kartenfeld ganz oben (direkt unter der Zurueck-Leiste)', h.map && /ax-bar/.test(h.bar), JSON.stringify(h.bar));
ok('H4 Highlights und Garmin-Herkunft dezent im Hero; Verwaltung („Aktivitaet loeschen") ganz am Ende', h.story && h.src && h.delLast);
ok('H5 Seite (17 km, 18 Runden, Diagramm) baut in < 150 ms', h.dt < 150, h.dt.toFixed(1) + ' ms');
await page.evaluate(() => document.querySelector('#gmActPage .ax-chip').click()); await page.waitForTimeout(200);
ok('H6 „Garmin ⓘ" oeffnet die Datenherkunft und setzt den Fokus dorthin', await page.evaluate(() => document.getElementById('gmAxSrc').open && document.activeElement && document.activeElement.closest('#gmAxSrc') !== null));

sec('R · Renderfehler');
for (const [nm, c] of [['Lauf', RUN], ['Lauf gleichmaessig', STEADY], ['Rennrad', RIDE], ['Rad eine Runde', RIDE1], ['Zwift', ZW], ['Schwimmen', SW]]) {
  await open(c); const t = await TXT(); const m = BAD.exec(t);
  ok('R ' + nm + ': kein „[object Object]“, „undefined“, „NaN“, „null“ und kein roher Textschluessel (alle Bereiche aufgeklappt)', !m, m ? t.slice(Math.max(0, m.index - 80), m.index + 40).replace(/\n/g, ' | ') : '');
}
const f1 = await page.evaluate(() => [gmAaFmt({ id: 'powerCurve', value: { 5: { w: 300, q: 'exact' }, 60: { w: 200, q: 'approx' }, 600: { w: null } } }, 'cycling'), gmAaFmt({ id: 'xyz', value: { a: 1, b: 2 } }, 'cycling'), gmAaFmt({ id: 'xyz', value: [1, 2, 'x'] }, 'cycling')]);
ok('R7 Formatter: Leistungskurve → „2 Zeitfenster“, jede andere Struktur → „2 Einträge“, Reihe → „2 Punkte“ (vorher „[object Object]“)', f1[0] === '2 Zeitfenster' && f1[1] === '2 Einträge' && /^2 /.test(f1[2]), JSON.stringify(f1));

sec('Z · Zwift (virtuell)');
tileReq = 0; await open(ZW);
const z = await page.evaluate(() => {
  const p = document.getElementById('gmActPage'); p.querySelectorAll('details').forEach(d => { d.open = true; });
  const rows = {}; p.querySelectorAll('.ax-row').forEach(r => { const k = r.querySelector('.ax-rl').firstChild.textContent.trim(); rows[k] = { v: r.querySelector('.ax-rv').textContent.replace(/\s+/g, ' ').trim(), def: (r.querySelector('.ax-rl small') || {}).textContent || '', meta: r.querySelector('.ax-rd').textContent }; });
  return { rows, hero: p.querySelector('.ax-key-main b').textContent, ctx: (p.querySelector('.ax-ctx') || {}).textContent, vroute: !!p.querySelector('.ax-top .ax-vroute svg'), vlabel: (p.querySelector('.ax-vlabel') || {}).textContent, map: !!p.querySelector('.route-map'),
    src: p.querySelector('#gmAxSrc').textContent, pc: [...p.querySelectorAll('.ax-pc')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), lines: p.querySelectorAll('#gmAaChart .aac-line').length, note: [...p.querySelectorAll('.ax-charts .ax-note')].map(x => x.textContent).join(' ') };
});
ok('Z1 Hauptzahl Ø Leistung 112 W; Kennzeichen „Virtuell“', /^112/.test(z.hero) && z.ctx === 'Virtuell', JSON.stringify([z.hero, z.ctx]));
ok('Z2 Zeiten mit Definition: Dauer (Timer) 1:02:14 „Uhr lief“ · Gesamtzeit 1:13:21 „Start bis Ende“ · Bewegungszeit 1:01:38 · Uhr angehalten 11 min 7 s', /^1:02:14/.test(z.rows['Dauer (Timer)'].v) && /Uhr lief/.test(z.rows['Dauer (Timer)'].def) && /^1:13:21/.test(z.rows['Gesamtzeit'].v) && /Start bis Ende/.test(z.rows['Gesamtzeit'].def) && /^1:01:38/.test(z.rows['Bewegungszeit'].v) && /^11 min 7 s/.test(z.rows['Uhr angehalten'].v), JSON.stringify(Object.keys(z.rows)));
ok('Z3 keine Zeile „Timer 1:13:21“ mehr (vorher: Timer = Gesamtzeit, Uhr angehalten 0 s)', !Object.values(z.rows).some(r => /^0 s/.test(r.v)) && !Object.keys(z.rows).some(k => /^Timer/.test(k)));
ok('Z4 Widerspruch der Garmin-Quellen in Klartext (Dauer-Zeile und Datenherkunft): 1:02:14 laut Zusammenfassung, Aufzeichnung 1:13:21, nichts veraendert', /1:02:14/.test(z.rows['Dauer (Timer)'].meta) && /1:13:21/.test(z.rows['Dauer (Timer)'].meta) && /Kein Garmin-Wert wird verändert/.test(z.src));
ok('Z5 virtuelle Distanz, Geschwindigkeit, Hoehenmeter als „(virtuell)“ gekennzeichnet; Datenherkunft erklaert die Spielwelt', ['Distanz (virtuell)', 'Ø Geschwindigkeit (virtuell)', 'Max. Geschwindigkeit (virtuell)', 'Höhenmeter (virtuell)'].every(k => z.rows[k]) && /Spielwelt/.test(z.src), JSON.stringify(Object.keys(z.rows)));
ok('Z6 virtuelle Strecke als Linie ohne Landkarte, benannt („Spielwelt, kein GPS“) — keine Kachel-Anfrage', z.vroute && !z.map && /kein GPS/.test(z.vlabel) && tileReq === 0, JSON.stringify([z.vroute, z.map, z.vlabel, tileReq]));
ok('Z7 Leistung je Dauer aus Garmins Werten: 1 s 326 W, 30 s 162 W, 1 h 95 W — ohne „≈“', z.pc.some(r => r.replace(/\s/g, '') === '1s326W') && z.pc.some(r => r.replace(/\s/g, '') === '30s162W') && z.pc.some(r => r.replace(/\s/g, '') === '1h95W') && !z.pc.some(r => /≈/.test(r)), JSON.stringify(z.pc.slice(0, 6)));
ok('Z8 Leistungsdiagramm bricht an den 3 Datenluecken ab (4 Linienstuecke), Hinweis auf Luecken und Garmin-Hoechstwert 326 W', z.lines >= 4 && /Lücken/.test(z.note) && /326 W/.test(z.note), JSON.stringify([z.lines, z.note]));

sec('C · Diagramme');
await open(RUN);
const c0 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('#gmActPage .ax-tabs button')].map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')), w: document.getElementById('gmAaChart').getBoundingClientRect().width, svg: !!document.querySelector('#gmAaChart svg') }));
ok('C1 Laufen: Tempo* · Puls · Kadenz · Höhe; Diagramm als SVG ueber die volle Breite', c0.tabs.join() === 'Tempo*,Puls,Kadenz,Höhe' && c0.svg && c0.w > 320, JSON.stringify(c0));
const box = await page.evaluate(() => { const e = document.getElementById('gmAaChart'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.move(box.x + box.w * 0.6, box.y + box.h * 0.5); await page.waitForTimeout(150);
const tip = await page.evaluate(() => { const t = document.querySelector('#gmAaChart .aac-tip'); return { hidden: t.hidden, txt: t.textContent, cross: document.querySelector('#gmAaChart .aac-cross').getAttribute('visibility') }; });
ok('C2 Zeiger: Fadenkreuz + Tooltip mit Wert, Einheit und Zeitpunkt („5:12 /km · 1:02:13“)', !tip.hidden && tip.cross === 'visible' && /^\d+:\d\d \/km\d+:\d\d(:\d\d)?$/.test(tip.txt), JSON.stringify(tip));
await page.focus('#gmAaChart'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
const kb = await page.evaluate(() => ({ tip: document.querySelector('#gmAaChart .aac-tip').textContent, live: document.getElementById('gmAxLive').textContent, role: document.getElementById('gmAaChart').getAttribute('role'), lab: document.getElementById('gmAaChart').getAttribute('aria-label') }));
ok('C3 Tastatur: Pos1/→ wandern durch die Messpunkte (zweiter Messpunkt, Wert + Zeit); Wert wird angesagt (aria-live); Diagramm traegt Klartext-Beschriftung', /^\d+:\d\d \/km\d+:\d\d$/.test(kb.tip) && kb.live.indexOf(' · ') > 0 && /Messpunkte/.test(kb.lab || ''), JSON.stringify(kb));
await page.evaluate(() => { const s = document.querySelector('#gmActPage .ax-cmp select'); s.value = 'hr'; s.dispatchEvent(new Event('change')); }); await page.waitForTimeout(250);
const cmp = await page.evaluate(() => ({ two: !!document.querySelector('#gmAxPlot2 svg'), lbl: (document.querySelector('.ax-cmpwrap .aac-sum b') || {}).textContent }));
await page.evaluate(() => { const e = document.getElementById('gmAaChart'), r = e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent('pointermove', { clientX: r.x + r.width * 0.3, clientY: r.y + r.height / 2, bubbles: true })); }); await page.waitForTimeout(100);
const sync = await page.evaluate(() => [document.querySelector('#gmAaChart .aac-cross').getAttribute('x1'), document.querySelector('#gmAxPlot2 .aac-cross').getAttribute('x1'), document.querySelector('#gmAxPlot2 .aac-cross').getAttribute('visibility')]);
ok('C4 Vergleich mit „Puls“: zweites Diagramm darunter (eigene y-Achse, gleiche Zeitachse), Fadenkreuz laeuft synchron', cmp.two && cmp.lbl === 'Puls' && sync[2] === 'visible' && Math.abs(+sync[0] - +sync[1]) < 3, JSON.stringify([cmp, sync]));
await page.evaluate(() => { [...document.querySelectorAll('#gmActPage .ax-tabs button')].find(b => b.textContent === 'Kadenz').click(); }); await page.waitForTimeout(250);
ok('C5 Wechsel auf „Kadenz“: anderes Diagramm, Achse ab 0, Auswahl bleibt erhalten', await page.evaluate(() => document.getElementById('gmAaChart').getAttribute('data-chart') === 'cadence' && [...document.querySelectorAll('#gmAaChart .aac-ty')].some(t => t.textContent === '0')));
await open(SW);
const sc = await page.evaluate(() => ({ dots: document.querySelectorAll('#gmAaChart .aac-pt').length, area: document.querySelectorAll('#gmAaChart .aac-area').length, waves: !!document.querySelector('.ax-top .act-waves'), lab: (document.querySelector('#gmAaChart .aac-tx') || {}).textContent }));
ok('C6 Schwimmen: „Tempo je Bahn“ als Einzelpunkte je Bahn (keine Flaeche, kein Verlauf dazwischen behauptet); Wellenfeld als Kopfbild', sc.dots >= 20 && sc.area === 0 && sc.waves && /^Bahn \d+$/.test(sc.lab || ''), JSON.stringify(sc));

sec('K · Kennzahlen-Bibliothek');
await open(RUN);
const k = await page.evaluate(() => { const p = document.getElementById('gmActPage'), lib = p.querySelector('details.ax-lib');
  return { open: lib.open, groups: [...lib.querySelectorAll('.ax-lg h3')].map(h => h.textContent), rings: lib.querySelectorAll('.ax-qm').length, rows: lib.querySelectorAll('.ax-row').length, pills: lib.querySelectorAll('.aa-q').length, legend: !!lib.querySelector('.ax-legend') }; });
ok('K1 eingeklappt auf dem Telefon; Gruppen Leistung · Herzfrequenz · Bewegung · Zeiten · Trainingsbelastung', k.open === false && k.groups.join() === 'Leistung,Herzfrequenz,Bewegung,Zeiten,Trainingsbelastung', JSON.stringify(k.groups));
ok('K2 Qualitaet nicht als Etikett an jeder Zahl: dezenter Ring (+ Vorlesetext) und eine Legende; keine Pillen', k.rings >= 3 && k.pills === 0 && k.legend, JSON.stringify(k));
await page.evaluate(() => { const l = document.querySelector('details.ax-lib'); l.open = true; l.querySelector('.ax-row summary').click(); }); await page.waitForTimeout(100);
ok('K3 Antippen einer Zeile zeigt Quelle und Pruefstand', await page.evaluate(() => { const r = document.querySelector('.ax-row[open] .ax-rd'); return !!r && /Quelle:/.test(r.textContent) && /Prüfstand:/.test(r.textContent); }));

sec('T · hell, reduzierte Bewegung');
const lum = c => { const v = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const th = await page.evaluate(() => { const r = {}; const read = () => { const p = document.getElementById('gmActPage'), cs = getComputedStyle(p); return { bg: cs.backgroundColor, title: getComputedStyle(p.querySelector('.ax-title')).color, sub: getComputedStyle(p.querySelector('.ax-when')).color, n: getComputedStyle(p.querySelector('.ax-stats dd')).color, axis: getComputedStyle(p.querySelector('#gmAaChart .aac-ty')).fill }; };
  r.dark = read(); document.documentElement.setAttribute('data-theme', 'light'); r.light = read(); document.documentElement.removeAttribute('data-theme'); return r; });
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
ok('T1 dunkel: Titel ≥ 12:1, Nebentext ≥ 7:1, Achsenbeschriftung ≥ 4,5:1 zum Seitengrund', cr(th.dark.title, th.dark.bg) >= 12 && cr(th.dark.sub, th.dark.bg) >= 7 && cr(th.dark.axis, th.dark.bg) >= 4.5, JSON.stringify([cr(th.dark.title, th.dark.bg), cr(th.dark.sub, th.dark.bg), cr(th.dark.axis, th.dark.bg)].map(v => v.toFixed(1))));
ok('T2 hell (eigene Tokens, keine automatische Umkehr): heller Grund, dunkle Schrift — Titel ≥ 12:1, Nebentext ≥ 7:1, Achse ≥ 4,5:1', lum(th.light.bg) > 0.8 && cr(th.light.title, th.light.bg) >= 12 && cr(th.light.sub, th.light.bg) >= 7 && cr(th.light.axis, th.light.bg) >= 4.5, JSON.stringify([th.light.bg, cr(th.light.title, th.light.bg), cr(th.light.sub, th.light.bg), cr(th.light.axis, th.light.bg)].map(v => typeof v === 'number' ? v.toFixed(1) : v)));
ok('T3 reduzierte Bewegung: Tooltip ohne Uebergang', await page.evaluate(() => /^(all )?0s/.test(getComputedStyle(document.querySelector('#gmAaChart .aac-tip')).transitionDuration)));

sec('E · Layout');
for (const w of [320, 375, 390, 430, 768, 1024, 1440]) {
  await page.setViewportSize({ width: w, height: 900 });
  await open(RUN);
  await page.evaluate(() => { document.querySelectorAll('#gmActPage details').forEach(d => { d.open = true; }); const bs = document.querySelectorAll('.iv-head'); if (bs[2]) bs[2].click(); });
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), clip = e => e.scrollWidth > e.clientWidth + 1;
    const vis = e => e.offsetParent !== null && !e.closest('.sr-only') && !e.classList.contains('sr-only');
    const iv = p.querySelector('.iv-card').getBoundingClientRect(), an = p.querySelector('.ax-analysis').getBoundingClientRect();
    return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pov: p.scrollWidth - p.clientWidth,
      cut: [...p.querySelectorAll('.ax-title, .ax-key-main b, .ax-stats dd, .ax-stats dt, .ax-btn, .ax-chip, .ax-tabs button, .aac-sum b, .aac-sum span, .iv-main b, .iv-v2, .iv-main em, .iv-cols span, .iv-grid dd, .iv-kid > span, .tl-axis span, .ax-rl, .ax-rv, .ax-kv dd, .ax-pc-w, .aa-z-v, .ax-sec-h h2')].filter(vis).filter(clip).map(e => e.textContent).slice(0, 4),
      tap: Math.min(...[...p.querySelectorAll('.ax-btn, .ax-chip, .ax-tabs button, .iv-head, .ax-row > summary, .ax-lib > summary, .ax-src > summary')].filter(vis).map(b => b.getBoundingClientRect().height)),
      chartW: p.querySelector('#gmAaChart').getBoundingClientRect().width, cols: Math.abs(iv.top - an.top) < 4 && an.left > iv.right, maxW: p.querySelector('.ax').getBoundingClientRect().width };
  });
  ok('E ' + w + ' px: kein Ueberlauf, nichts abgeschnitten, Tippflaechen ≥ 44 px' + (w >= 1024 ? ', Abschnitte und Analyse nebeneinander, Diagramm breit' : ''), m.ov <= 0 && m.pov <= 0 && !m.cut.length && m.tap >= 44 && (w < 1024 || (m.cols && m.chartW > w * 0.6)), JSON.stringify(m));
}
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' activity_experience_v4541_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
