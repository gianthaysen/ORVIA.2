/* ============================================================
   ORVIA · intervals_v454_ui_e2e — Intervalle Laufen / Rad im echten Browser (echter Garmin-Mitschnitt 19.10.2026)
   R  Workout-Lauf: Hauptzahl + 3 Kennzahlen, Zeitstrahl (4 Abschnitte), kompakte Karten, Aufklappen (8 Runden),
      Zeitstrahl antippen markiert die Karte, Tastatur, Analyse nur vergleichbarer Kilometer
   B  Rad: Rennrad mit Auto-Runden ohne Leistung (kein Tempovergleich), Zwift mit Leistung als Hauptzahl,
      gleichmaessige Fahrt / eine Runde → keine Rundenkarte
   S  synthetisches Garmin-Intervalltraining (6 × 800 m): Muster im Zeitstrahl, Belastung/Erholung, Trend als Beobachtung
   P  50 Runden: 12 sichtbar + „Alle 50 anzeigen", schnell; Rohblock nicht ladbar → Runden aus dem lokalen Bestand
   E  Layout 320 / 375 / 390 / 430 / 1200 px mit aufgeklapptem Abschnitt: kein Ueberlauf, nichts abgeschnitten
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
let _n = 0;
function row(sport, metrics, sum, dur) {
  _n++;
  return { id: '54000000-0000-4000-8000-0000000000' + String(_n).padStart(2, '0'), clientRecordId: 'act:v454-' + _n, sportId: sport, source: 'garmin', status: 'completed',
           startedAt: '2026-10-15T07:00:00.000Z', durationSeconds: dur, summary: Object.assign({ name: sport === 'running' ? 'Lauf' : 'Radfahrt' }, sum), metrics };
}
/* echte Einheit: lokal ohne Rohblock (wie in der Tabelle), Rohblock kommt ueber fetchExt */
function real(key) {
  const f = RR[key], m = JSON.parse(JSON.stringify(f.metrics)), ext = m.ext; delete m.ext;
  return { a: row(f.sport, m, { distanceM: f.distance_m, distanceKm: f.distance_m / 1000, avgHr: f.avg_hr, maxHr: f.max_hr, avgPowerW: f.avg_power }, Math.round(f.duration_s)), ext };
}
const lap = (i, d, t, o) => Object.assign({ lapIndex: i, distance: d, duration: t, elapsedDuration: t, movingDuration: t, averageHR: 150 }, o || {});
function synthWorkout() {
  const laps = [lap(1, 2000, 720, { averageHR: 135 })], typed = [{ type: 'INTERVAL_WARMUP', distance: 2000, duration: 720, elapsedDuration: 720, lapIndexes: [1], averageHR: 135 }];
  let li = 2;
  for (let r = 0; r < 6; r++) {
    const t = 204 + r * 3;
    laps.push(lap(li, 800, t, { averageHR: 165 + r * 2 })); typed.push({ type: 'INTERVAL_ACTIVE', distance: 800, duration: t, elapsedDuration: t, lapIndexes: [li], averageHR: 165 + r * 2 }); li++;
    if (r < 5) { laps.push(lap(li, 300, 120, { averageHR: 140 })); typed.push({ type: 'INTERVAL_RECOVERY', distance: 300, duration: 120, elapsedDuration: 120, lapIndexes: [li], averageHR: 140 }); li++; }
  }
  laps.push(lap(li, 1500, 600, { averageHR: 138 })); typed.push({ type: 'INTERVAL_COOLDOWN', distance: 1500, duration: 600, elapsedDuration: 600, lapIndexes: [li], averageHR: 138 });
  const dur = laps.reduce((s, l) => s + l.duration, 0), dist = laps.reduce((s, l) => s + l.distance, 0);
  return { a: row('running', { garmin: { type_key: 'running', start_gmt: '2026-01-01T00:00:00Z' }, splits: laps, splits_source: 'garmin_splits' }, { distanceM: dist, distanceKm: dist / 1000, avgHr: 155 }, dur),
           ext: { v: 1, typed_splits: { splits: typed }, extras: { splits: 'ok', typed_splits: 'ok' } } };
}
function synth50() {
  const laps = []; for (let i = 1; i <= 50; i++) laps.push(lap(i, 1000, 300 + (i % 7), { averageHR: 140 + (i % 9) }));
  return { a: row('running', { garmin: { type_key: 'running', start_gmt: '2026-01-01T00:00:00Z' }, splits: laps, splits_source: 'garmin_splits' }, { distanceM: 50000, distanceKm: 50, avgHr: 145 }, laps.reduce((s, l) => s + l.duration, 0)), ext: null };
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
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
await ctx.route('**fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1100);
await page.evaluate(() => { document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove()); document.documentElement.classList.remove('orvia-gated'); });

/* mode: 'ok' (Rohblock nach 200 ms) | 'fail' (Abruf scheitert) */
async function open(c, mode) {
  await page.evaluate(({ a, ext, mode }) => {
    window.__local = [JSON.parse(JSON.stringify(a))]; window.__calls = 0;
    const st = ORVIA.activityStore; st.listActivities = () => window.__local; st.getActivityById = id => window.__local.find(x => x.id === id || x.clientRecordId === id) || null;
    ORVIA.repos = ORVIA.repos || {}; ORVIA.repos.activity = Object.assign({}, ORVIA.repos.activity || {}, { fetchExt: id => { window.__calls++;
      return new Promise(r => setTimeout(() => r(mode === 'fail' || !ext ? { success: false, error: { code: 'offline' } } : { success: true, data: { id, ext } }), 200)); } });
    try { _gmActExt = {}; _gmIvOpen = {}; _gmIvAll = {}; } catch (e) {}
    try { showTab('akt'); } catch (e) {}
    window.__t0 = performance.now(); gmOpenActivityPage(a.id); window.__dt = performance.now() - window.__t0;
  }, { a: c.a, ext: c.ext, mode: mode || 'ok' });
  await page.waitForTimeout(650);
}
const READ = () => page.evaluate(() => {
  const p = document.getElementById('gmActPage'), c = p.querySelector('.iv-card'), tx = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
  return { card: !!c, title: c ? tx(c.querySelector('.ctitle .l')) : null, cnt: c ? tx(c.querySelector('.ctitle .more')) : null,
    hero: tx(p.querySelector('.aa-hero-main')), heroSub: [...p.querySelectorAll('.aa-hero-sub > *')].map(tx),
    tl: c ? [...c.querySelectorAll('.tl-seg')].map(s => ({ k: s.className.replace(/.*k-(\w+).*/, '$1'), w: s.getBoundingClientRect().width, lab: s.getAttribute('aria-label') })) : [],
    tlAria: c && c.querySelector('.iv-tl') ? c.querySelector('.iv-tl').getAttribute('aria-label') : null, axis: c ? tx(c.querySelector('.tl-axis')) : null, legend: c ? tx(c.querySelector('.tl-legend')) : null,
    items: c ? [...c.querySelectorAll('.iv-item')].map(x => ({ main: tx(x.querySelector('.iv-main b')), acc: tx(x.querySelector('.iv-main em')), sub: tx(x.querySelector('.iv-sub')),
      exp: x.querySelector('.iv-head').getAttribute('aria-expanded'), hidden: x.querySelector('.iv-body').hidden, body: tx(x.querySelector('.iv-body')), kids: x.querySelectorAll('.iv-kid:not(.iv-kid-h)').length,
      picked: x.classList.contains('is-picked'), h: x.querySelector('.iv-head').getBoundingClientRect().height })) : [],
    an: c ? tx(c.querySelector('.iv-an')) : null, src: c ? tx(c.querySelector('.iv-src')) : null, all: c ? tx(c.querySelector('.iv-all')) : null,
    chips: [...p.querySelectorAll('.aa-chips button')].map(tx), calls: window.__calls, dt: window.__dt };
});

sec('R · Workout-Lauf (echter Mitschnitt)');
const RUN = real('running__running__intervals');
await open(RUN);
let r = await READ();
ok('R1 Hauptzahl Distanz 17 km + genau 3 Kennzahlen (Dauer, Ø Tempo, Ø Puls)', /^17 km ?Distanz$/.test(r.hero) && r.heroSub.length === 3 && /Dauer/.test(r.heroSub[0]) && /Tempo/.test(r.heroSub[1]) && /Puls/.test(r.heroSub[2]), JSON.stringify([r.hero, r.heroSub]));
ok('R2 Karte „Abschnitte" mit 4 kompakten Eintraegen: 4 km 6:50 · 4 km 6:07 · 8 km 5:16 · 1 km 7:05 /km', r.title === 'Abschnitte' && r.items.map(x => x.main + ' ' + x.acc).join() === '4 km 6:50 /km,4 km 6:07 /km,8 km 5:16 /km,1 km 7:05 /km', JSON.stringify(r.items.map(x => [x.main, x.acc])));
ok('R3 kompakt: je Eintrag zwei Zeilen, zweite Zeile nur Timer-Zeit + Art (z. B. „24:29 · Abschnitt 2"); alles zugeklappt', r.items[1].sub === '24:29 · Abschnitt 2' && r.items.every(x => x.exp === 'false' && x.hidden && x.h < 80), JSON.stringify(r.items.map(x => [x.sub, x.h])));
ok('R4 Zeitstrahl: 4 Bloecke, Breite proportional zur Gesamtzeit je Abschnitt (Abschnitt 3 ≈ 42 %), Achse „Gesamtzeit 1:57:55"', r.tl.length === 4 && Math.abs(r.tl[2].w / r.tl.reduce((s, x) => s + x.w, 0) - 2953.4 / 7075.4) < 0.02 && /Gesamtzeit/.test(r.axis) && /1:57:55/.test(r.axis), JSON.stringify([r.tl.map(x => Math.round(x.w)), r.axis]));
ok('R5 Zeitstrahl fuer Screenreader: role=img mit Klartext; Bloecke mit Beschriftung (Art, Nummer, Dauer)', /4/.test(r.tlAria || '') && r.tl.every(x => /Abschnitt \d, \d/.test(x.lab)), JSON.stringify([r.tlAria, r.tl.map(x => x.lab)]));
ok('R6 Herkunft ehrlich: „Abschnitte aus deinem Garmin-Workout … keine Belastung und Erholung"', /Garmin-Workout/.test(r.src) && /keine Belastung und Erholung/.test(r.src), r.src);
ok('R7 Analyse nur vergleichbarer Kilometer (Abschnitt 3, 6 vergleichbar): ± 3,8 %, schnellste Runde 12 (4:58), langsamste Runde 9 (5:36), 2 ausgeschlossen benannt', /Abschnitt 3/.test(r.an) && /6 vergleichbar/.test(r.an) && /3,8 %/.test(r.an) && /4:58/.test(r.an) && /schnellste · Runde 12/.test(r.an) && /5:36/.test(r.an) && /langsamste · Runde 9/.test(r.an) && /2 nicht vergleichbar/.test(r.an), r.an);
ok('R8 kein pauschales Formurteil („Form", „fitter", „Ermüdung") in der Karte', !/Form\b|fitter|Ermüdung|ermüdet/.test(await page.evaluate(() => document.querySelector('.iv-card').textContent)));
ok('R9 genau EIN Rohblock-Abruf', r.calls === 1, String(r.calls));
await page.evaluate(() => document.querySelectorAll('.tl-seg')[2].click()); await page.waitForTimeout(150);
r = await READ();
ok('R10 Zeitstrahl antippen: Abschnitt 3 wird markiert (Karte und Block), sonst keiner', r.items[2].picked && r.items.filter(x => x.picked).length === 1 && await page.evaluate(() => document.querySelectorAll('.tl-seg.is-picked').length === 1));
await page.evaluate(() => document.querySelectorAll('.iv-head')[2].click()); await page.waitForTimeout(120);
r = await READ();
ok('R11 Abschnitt 3 aufgeklappt: Timer 42:11, Gesamtzeit + „Uhr angehalten" getrennt, Tempo, Puls, Kadenz mit Qualitaetsangabe; 8 Runden', r.items[2].exp === 'true' && !r.items[2].hidden && /42:11/.test(r.items[2].body) && /angehalten/i.test(r.items[2].body) && /5:16 \/km/.test(r.items[2].body) && /spm/.test(r.items[2].body) && r.items[2].kids === 8, r.items[2].body.slice(0, 400));
ok('R12 Einordnung im Detail: „Abschnitt · laut Garmin"; Runden darunter mit Nr./Distanz/Zeit/Tempo/Puls', /laut Garmin/.test(r.items[2].body) && await page.evaluate(() => document.querySelectorAll('.iv-item')[2].querySelectorAll('.iv-kid:not(.iv-kid-h)')[0].children.length === 5), r.items[2].body.slice(-300));
ok('R13 nie geoeffnete Abschnitte ohne Details im DOM (Lazy Rendering)', r.items.filter((x, i) => i !== 2).every(x => x.body === ''));
await page.evaluate(() => document.querySelector('.aa-chips button:nth-child(2)').click()); await page.waitForTimeout(200);
ok('R14 Diagramm wechseln behaelt den aufgeklappten Abschnitt', (await READ()).items[2].exp === 'true');
await page.evaluate(() => document.querySelectorAll('.iv-head')[2].click()); await page.waitForTimeout(80);
ok('R15 erneut antippen klappt zu', (await READ()).items[2].hidden === true);
await page.focus('.iv-head'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
ok('R16 Tastatur: Enter auf dem Eintrag klappt auf (echter Knopf, aria-expanded)', (await READ()).items[0].exp === 'true');
ok('R17 Zeitstrahl-Bloecke nicht im Tab-Fokus (tabindex -1) — Karten sind die Bedienung', await page.evaluate(() => [...document.querySelectorAll('.tl-seg')].every(b => b.tabIndex === -1)));
ok('R18 keine technischen Feldnamen in der Hauptansicht', !(await page.evaluate(() => { const p = document.getElementById('gmActPage').cloneNode(true); p.querySelectorAll('details').forEach(x => x.remove());
  return /lapDTOs|typed_splits|INTERVAL_|wktStep|intensityType|movingDuration|averageRunCadence|garmin_typed|rule_auto/.test(p.textContent); })));

sec('B · Rad');
await open(real('cycling__road_biking__intervals'));
let b = await READ();
ok('B1 Rennrad: Hauptzahl Distanz 27,6 km; Ø Geschwindigkeit statt Leistung (keine Leistung gemessen)', /^27,6 km ?Distanz$/.test(b.hero) && b.heroSub.some(x => /Geschwindigkeit/.test(x)) && !b.heroSub.some(x => / W /.test(x + ' ')), JSON.stringify([b.hero, b.heroSub]));
ok('B2 6 Runden (5 × 5 km + 2,6 km), Zeit als Hauptwert, km/h daneben, Puls + Distanz darunter', b.title === 'Runden' && b.items.length === 6 && b.items[0].main === '12:32' && b.items[0].acc === '23,9 km/h' && /134 bpm · 5 km/.test(b.items[0].sub), JSON.stringify(b.items.map(x => [x.main, x.acc, x.sub])));
ok('B3 automatische Runden als Regel erkannt und so benannt; ohne Leistung KEIN Tempo-/Gleichmaessigkeitsvergleich (Wind/Gelaende)', /automatisch gesetzte Runden/.test(b.src) && !b.an, JSON.stringify([b.src, b.an]));
ok('B4 Rad-Diagramme ohne Leistung: Puls, Geschwindigkeit, Höhe', b.chips.join() === 'Puls,Geschwindigkeit,Höhe', b.chips.join());
await open(real('cycling__virtual_ride__indoor'));
b = await READ();
ok('B5 Zwift (virtuell): Hauptzahl Ø Leistung 112 W (gemessen), kein Distanz-Hero, keine Geschwindigkeit/Hoehe als Diagramm', /^112 W ?Ø Leistung$/.test(b.hero) && b.chips.join() === 'Leistung,Puls,Kadenz', JSON.stringify([b.hero, b.chips]));
ok('B6 Zwift mit nur einer Runde: keine Rundenkarte', !b.card);
await open(real('cycling__cycling__steady'));
b = await READ();
ok('B7 gleichmaessige Fahrt (eine Runde): keine Rundenkarte, kein leerer Block, Hero wie bisher', !b.card && /^4,8 km ?Distanz$/.test(b.hero));

sec('S · Garmin-Intervalltraining (synthetisch, Feldnamen wie im Mitschnitt)');
const W = synthWorkout();
await open(W);
let s = await READ();
ok('S1 Titel „Intervalle"; Zaehlung Aufwaermen · 6 Belastungen · 5 Erholungen · Auslaufen; alle 13 sichtbar (≤ 16 → kein „Alle anzeigen")', /Intervall/.test(s.title) && /6/.test(s.cnt) && /5/.test(s.cnt) && s.items.length === 13 && !s.all, JSON.stringify([s.title, s.cnt, s.items.length]));
ok('S2 Zeitstrahl 13 Bloecke; Erholung, Aufwaermen, Auslaufen per Muster unterscheidbar (nicht nur Farbe) und in der Legende', s.tl.length === 13 && await page.evaluate(() => {
  const st = k => getComputedStyle(document.querySelector('.tl-seg.k-' + k)).backgroundImage;
  return /gradient/.test(st('recovery')) && /gradient/.test(st('warmup')) && st('work') === 'none'; }) && /Erholung/.test(s.legend) && /Belastung/.test(s.legend), s.legend);
ok('S3 Belastung 1: 800 m · 4:15 /km; zweite Zeile „3:24 · Belastung 1"', s.items[1].main === '800 m' && s.items[1].acc === '4:15 /km' && s.items[1].sub === '3:24 · Belastung 1', JSON.stringify(s.items[1]));
ok('S4 Analyse der 6 Belastungen: langsamer werdend um 7,1 % als Beobachtung; Puls 165 → 175; schnellste = Belastung 1, langsamste = Belastung 6 (Nummern wie auf den Karten)', /6 Belastungen|Belastungen \(6|6 vergleichbar/.test(s.an) && /7,1 %/.test(s.an) && /165 → 175/.test(s.an) && /schnellste · Belastung 1/.test(s.an) && /langsamste · Belastung 6/.test(s.an) && !/Form/.test(s.an), s.an);

sec('P · Viele Runden und fehlender Rohblock');
await open(synth50());
let p = await READ();
ok('P1 50 Runden: 12 sichtbar + „Alle 50 anzeigen"', p.items.length === 12 && /50/.test(p.all || ''), JSON.stringify([p.items.length, p.all]));
ok('P2 Seite inkl. Modell baut in < 150 ms (50 Runden, ohne Aufklappen)', p.dt < 150, p.dt.toFixed(1) + ' ms');
await page.evaluate(() => document.querySelector('.iv-all').click()); await page.waitForTimeout(150);
p = await READ();
ok('P3 „Alle anzeigen" zeigt 50, Knopf verschwindet', p.items.length === 50 && !p.all);
await page.evaluate(() => { const s = document.querySelectorAll('.tl-seg'); s[s.length - 1].click(); }); await page.waitForTimeout(120);
ok('P4 letzter Zeitstrahl-Block markiert Runde 50', (await READ()).items[49].picked);
await open(RUN, 'fail');
p = await READ();
ok('P5 Rohblock nicht ladbar: Abschnitte trotzdem aus den lokalen Runden (Workout-Schritt je Runde) — 4 Abschnitte, gleiche Tempi, kein Fehler', p.card && p.title === 'Abschnitte' && p.items.map(x => x.acc).join() === '6:50 /km,6:07 /km,5:16 /km,7:05 /km', JSON.stringify([p.title, p.items.map(x => x.acc)]));

sec('E · Layout');
await open(RUN);
for (const w of [320, 375, 390, 430, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.evaluate(() => { try { _gmIvOpen = {}; } catch (e) {} gmActRedrawKeep(); const bs = document.querySelectorAll('.iv-head'); if (bs[2]) bs[2].click(); });
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => { const p = document.getElementById('gmActPage'), clip = e => e.scrollWidth > e.clientWidth + 1;
    return { ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, pov: p.scrollWidth - p.clientWidth,
      cut: [...p.querySelectorAll('.aa-hero b, .aa-hero span, .iv-card b, .iv-card em, .iv-sub, .iv-stat span, .iv-grid dd, .iv-grid dt, .iv-kid > span, .tl-axis span, .tl-leg, .aa-chips button, .iv-an .aa-md-h')].filter(clip).map(e => e.textContent).slice(0, 4),
      tap: Math.min(...[...p.querySelectorAll('.iv-head')].map(b => b.getBoundingClientRect().height)) }; });
  ok('E ' + w + ' px: kein Ueberlauf, nichts abgeschnitten, Tippflaeche ≥ 44 px', m.ov <= 0 && m.pov <= 0 && !m.cut.length && m.tap >= 44, JSON.stringify(m));
}
ok('keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close(); server.close();
console.log('\n' + (fail ? '❌' : '✅') + ' intervals_v454_ui_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
