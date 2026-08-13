#!/usr/bin/env node
/* ============================================================================
   ORVIA · Phase 0 — probe_actions_live.mjs

   Fuehrt probeActions() gegen die ECHTE App im Browser aus und protokolliert,
   welche Entry-Points aufloesbar sind. Zusaetzlich wird das DOM-Ziel geprueft,
   von dem die aufgeloesten Handler intern abhaengen — genau dort sitzt die
   Luecke, die eine reine Aufloesbarkeitspruefung NICHT sieht.

   Es wird NICHTS ausgefuehrt und NICHTS veraendert.

   Aufruf:  node tools/probe_actions_live.mjs [appRoot-absolut]
   ============================================================================ */
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = process.argv[2] ? normalize(process.argv[2]) : join(HERE, '..');
const OUT = join(APP, 'baseline');
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Probe: unkonfiguriert */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
  document.documentElement.classList.remove('orvia-gated');
});
await page.waitForTimeout(400);

const report = await page.evaluate(() => {
  const qa = window.ORVIA && window.ORVIA.quickActions;
  if (!qa || !qa.probeActions) return { error: 'quickActions.probeActions nicht verfuegbar' };
  const probe = qa.probeActions();

  /* Zweite Ebene: DOM-Ziele, von denen aufgeloeste Handler intern abhaengen.
     openTrainingTab() sucht .tabbar button[data-tab="training"] und liefert
     undefined, wenn dieser Button fehlt — die Aufloesung meldet trotzdem ok. */
  const domTargets = {
    'tabbar button[data-tab="training"]': !!document.querySelector('.tabbar button[data-tab="training"]'),
    '#tab-training': !!document.getElementById('tab-training'),
    '#todaySummary sichtbar': (() => {
      const el = document.getElementById('todaySummary');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    })()
  };

  const tabbarTabs = [...document.querySelectorAll('.tabbar button[data-tab]')].map(b => b.getAttribute('data-tab'));
  return { probe, domTargets, tabbarTabs };
});

await browser.close();
server.close();

if (report.error) { console.error(report.error); process.exit(1); }

/* Auswertung: aufloesbar, aber DOM-Ziel fehlt => stiller Totpfad. */
const DEAD_DOM = !report.domTargets['tabbar button[data-tab="training"]'];
const enriched = report.probe.map(p => {
  const dependsOnTrainingTab = p.entryPoint === 'orvia:workoutUI.openTrainingTab';
  return {
    ...p,
    silentlyDead: !!(p.resolvable && dependsOnTrainingTab && DEAD_DOM),
    note: (p.resolvable && dependsOnTrainingTab && DEAD_DOM)
      ? 'Entry-Point aufloesbar, aber openTrainingTab() sucht .tabbar button[data-tab="training"] '
        + '— dieser Button existiert nicht. Handler liefert undefined, runActionEx meldet handled. '
        + 'Siehe baseline/known-failures.json KF-001/KF-003.'
      : null
  };
});

const out = {
  baselineTag: 'v8-219-audit-baseline',
  capturedAt: process.env.BASELINE_STAMP || new Date().toISOString(),
  tool: 'tools/probe_actions_live.mjs',
  purpose: 'Dokumentiert den IST-Zustand der Aktions-Erreichbarkeit. Keine Bewertung als Soll.',
  totalActions: enriched.length,
  resolvable: enriched.filter(p => p.resolvable).length,
  unresolvable: enriched.filter(p => !p.resolvable).length,
  silentlyDead: enriched.filter(p => p.silentlyDead).length,
  tabbarTabs: report.tabbarTabs,
  domTargets: report.domTargets,
  limitation: 'probeActions() prueft NUR die Aufloesbarkeit des Entry-Points. Ein aufloesbarer '
            + 'Handler, der intern auf ein fehlendes DOM-Ziel trifft und undefined liefert, gilt '
            + 'weiterhin als handled. Genau diese Klasse ist unter silentlyDead ausgewiesen.',
  actions: enriched
};
writeFileSync(join(OUT, 'action-reachability.json'), JSON.stringify(out, null, 2) + '\n');

console.log('Aktionen gesamt      : ' + out.totalActions);
console.log('  aufloesbar         : ' + out.resolvable);
console.log('  nicht aufloesbar   : ' + out.unresolvable);
console.log('  still tot          : ' + out.silentlyDead);
console.log('Tabbar-Tabs          : ' + report.tabbarTabs.join(', '));
console.log('data-tab="training"  : ' + (report.domTargets['tabbar button[data-tab="training"]'] ? 'vorhanden' : 'FEHLT'));
enriched.filter(p => !p.resolvable || p.silentlyDead)
  .forEach(p => console.log('  · ' + p.action + ' -> ' + p.entryPoint + '  [' + (p.silentlyDead ? 'still tot' : p.reason) + ']'));
console.log('\nGeschrieben: ' + join(OUT, 'action-reachability.json'));
