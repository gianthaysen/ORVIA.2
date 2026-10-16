/* ============================================================
   ORVIA · performance_ledger_view_e2e (v8-448A) — Ansicht „Leistungsentwicklung" im Browser

   V1  Leerzustand ohne Daten: ehrlich, keine Zahl, kein Diagramm
   V2  Rekordkarten aus dem ECHTEN Rechenkern (Testdaten nur hier im Test, nie in der App)
   V3  375 px: kein waagerechtes Scrollen, Karten einspaltig; 1200 px: mehrspaltig
   V4  Werte in Textfarbe, Linie in Sportfarbe (Gold = ORVIA, Sportfarbe = Daten)
   V5  Diagramm: eine Linie, Punkte fokussierbar mit Beschriftung, Tabellenform vorhanden
   V6  „Noch nicht freigegeben" zeigt gesperrte Kennzahlen mit Grund — ohne Wert
   ============================================================ */
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = (function () {
  const _p = require('node:path');
  const _h = _p.dirname(new URL(import.meta.url).pathname);
  for (const c of [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'), _p.join(_h, '..', '..', '..')]) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); } catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat;
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* Modell aus dem echten Rechenkern */
globalThis.window = globalThis;
for (const f of ['js/onboarding/onboarding-sports-logic.js', 'js/training-domain.js', 'js/activity-normalize.js', 'js/activity-config.js', 'js/activity-time.js']) require(join(APP, f));
const GEN = await import(join(APP, 'tools', 'gen-eligibility-doc.mjs'));
require(join(APP, 'js/engine/performance-ledger.js'));
const L = globalThis.ORVIA.performanceLedger;
const run = (id, date, s5k, dist) => { const a = GEN.referenceActivity('running', 'best'); a.id = id; a.startedAt = date + 'T06:00:00.000Z';
  a.metrics.garmin.start_local = date + 'T08:00:00'; a.summary.distanceM = dist; a.metrics.streams.distance = [0, dist * .2, dist * .4, dist * .6, dist * .8, dist];
  const t = a.metrics.best_efforts.distance.targets; for (const k of Object.keys(t)) if (+k > dist) delete t[k]; t['5000'] = { s: s5k, over_m: 2, at: 0, q: 'measured' }; return a; };
const ride = GEN.referenceActivity('cycling', 'best'); ride.id = 'ride'; ride.startedAt = '2026-09-20T06:00:00.000Z';
const wk = { id: 'wk', sportId: 'gym', source: 'orvia_workout', status: 'completed', startedAt: '2026-09-21T16:00:00.000Z', durationSeconds: 4500, summary: { totalVolumeKg: 8400 },
  metrics: { corrections: { duration: { manual: 4500, source: 20460, unit: 's', at: '2026-10-11T08:00:00Z', method: 'manual' } } } };
const acts = [run('r1', '2026-08-02', 1510, 6000), run('r2', '2026-08-16', 1482, 8000), run('r3', '2026-08-30', 1490, 10000), run('r4', '2026-09-13', 1445, 12000), run('r5', '2026-09-27', 1419, 21200), ride, wk];
const model = L.readModel(L.update(null, acts, { timeZone: 'Europe/Berlin' }).state);
const empty = L.readModel(L.emptyState());

const page = m => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"><style>body{background:#09111A;margin:0}</style></head><body>
<div id="root"></div>
<script src="/js/i18n.js"></script><script src="/locales/de.js"></script><script src="/js/training-domain.js"></script><script src="/js/activity-theme.js"></script><script src="/js/engine/performance-ledger.js"></script>
<script src="/js/screens/performance-ledger-view.js"></script>
<script>window.ORVIA.performanceLedgerView.mount(document.getElementById('root'), ${JSON.stringify(m)});</script></body></html>`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
let current = page(model);
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/' || p === '/view.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); res.end(current); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: CHROME });
const shots = process.env.ORVIA_SHOTS || null;
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  current = page(empty);
  await pg.goto(base + '/view.html');
  const e = await pg.evaluate(() => ({ empty: !!document.querySelector('.plv-empty'), cards: document.querySelectorAll('.plv-card').length, svg: document.querySelectorAll('svg').length,
    text: document.querySelector('.plv').innerText }));
  ok('V1 Leerzustand: ehrliche Meldung, keine Karte, kein Diagramm, keine Zahl', e.empty && e.cards === 0 && e.svg === 0 && !/\d:\d\d/.test(e.text), e.text.slice(0, 80));
  if (shots) await pg.screenshot({ path: join(shots, 'ledger-empty-375.png'), fullPage: true });

  current = page(model);
  await pg.goto(base + '/view.html');
  const v = await pg.evaluate(() => {
    const val = document.querySelector('[data-metric="running.fastest_5000m@standard"] .plv-val');
    const line = document.querySelector('[data-metric="running.fastest_5000m@standard"] .plv-line');
    return { cards: document.querySelectorAll('.plv-card').length, hero: val && val.textContent, imp: document.querySelector('[data-metric="running.fastest_5000m@standard"] .plv-imp').textContent,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cols: getComputedStyle(document.querySelector('.plv-grid')).gridTemplateColumns.split(' ').length,
      valColor: getComputedStyle(val).color, lineColor: line && getComputedStyle(line).stroke,
      text: getComputedStyle(document.body).getPropertyValue('--orvia-text-primary').trim(), run: getComputedStyle(document.querySelector('.plv-sport')).getPropertyValue('--activity-primary').trim(),
      pts: [...document.querySelectorAll('[data-metric="running.fastest_5000m@standard"] .plv-pt')].map(p => [p.getAttribute('tabindex'), p.getAttribute('aria-label')]),
      table: document.querySelectorAll('[data-metric="running.fastest_5000m@standard"] .plv-hist tbody tr').length,
      wait: document.querySelector('.plv-wait') ? document.querySelector('.plv-wait').textContent : '',
      manual: document.querySelector('[data-metric="gym.longest_duration@all"] .plv-badge-manual') ? true : false };
  });
  ok('V2 Rekordkarten aus dem Rechenkern; 5 km = 23:39', v.cards >= 5 && v.hero === '23:39', v.cards + ' Karten, ' + v.hero);
  ok('V2b Verbesserung mit Vorgaenger und Datum', /26 s schneller als 24:05 vom 13\.09\.2026/.test(v.imp), v.imp);
  ok('V3a 375 px: kein waagerechtes Scrollen, einspaltig', v.overflow <= 0 && v.cols === 1, 'Ueberlauf ' + v.overflow + ' px, Spalten ' + v.cols);
  ok('V4 Wert in Textfarbe, Linie in Sportfarbe', v.valColor === 'rgb(244, 242, 237)' && v.lineColor && v.lineColor !== v.valColor && v.run.length > 0, v.valColor + ' / ' + v.lineColor);
  ok('V5a Diagrammpunkte fokussierbar und beschriftet', v.pts.length === 4 && v.pts.every(p => p[0] === '0' && /\d{2}\.\d{2}\.\d{4}/.test(p[1])), v.pts.map(p => p[1]).join(' | '));
  ok('V5b Tabellenform „Verlauf" mit allen Ereignissen', v.table === 4);
  ok('V5c korrigierte Kraftdauer als „manuell korrigiert" gekennzeichnet', v.manual);
  ok('V6 Gesperrtes mit Grund, ohne Wert', /Radfahren: .*Beste Leistung 20 min/.test(v.wait) && /Bedeutung der Garmin-Quelle noch nicht belegt/.test(v.wait) && !/\d+ W/.test(v.wait), v.wait.slice(0, 160));
  if (shots) { await pg.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.classList.contains('plv-wait')) d.open = true; })); await pg.screenshot({ path: join(shots, 'ledger-375.png'), fullPage: true }); }
  await pg.setViewportSize({ width: 1200, height: 900 });
  const wide = await pg.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.plv-grid')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  ok('V3b 1200 px: mehrspaltig, kein Ueberlauf', wide.cols >= 3 && wide.overflow <= 0, wide.cols + ' Spalten');
  if (shots) await pg.screenshot({ path: join(shots, 'ledger-1200.png'), fullPage: true });
  const errs = [];
  pg.on('pageerror', e2 => errs.push(e2.message));
  await pg.reload();
  ok('V7 keine Fehler in der Seite', errs.length === 0, errs.join('; '));
} finally {
  await browser.close(); server.close();
}
console.log('\n' + (fail ? '❌' : '✅') + ' performance_ledger_view_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
