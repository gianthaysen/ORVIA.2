#!/usr/bin/env node
/* ============================================================================
   ORVIA · KF-013 — build_structure_contract.mjs

   Erzeugt den REPO-INTERNEN Strukturvertrag docs/gm-ref/structure-contract.json
   aus der echten App. Ersetzt die sechs gm*_parity.mjs, die gegen fluechtige
   /tmp-Fixtures verglichen haben und deshalb nicht mehr lauffaehig sind.

   Bewusster Unterschied zur alten Paritaetspruefung:
     • KEIN pixelnaher Vergleich kompletter HTML-Fixtures.
     • Geprueft wird SEMANTIK: welche Bereiche und Anzeigeslots muessen
       existieren — nicht, wie sie aussehen.
     • Anker sind stabile IDs und die Produktvokabeln der Sektionslabels.
     • Funktionslose interaktive Elemente duerfen verschwinden und sind
       deshalb NICHT Teil des Vertrags.

   Aufruf:  node tools/build_structure_contract.mjs [appRoot-absolut]
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
/* v8-307b: dieselbe Aufloesung wie supabase/tests/_pw-chrome.mjs —
   ORVIA_CHROME -> playwrights eigener Pfad -> Container-Standardpfad.
   Der Aufrufer (gm_structure_contract_test) skippt vorher ehrlich, wenn
   keiner existiert; hier ist die Aufloesung der Vollstaendigkeit halber
   identisch, damit das Tool auch direkt aufrufbar bleibt. */
const CHROME = (() => {
  const cands = [process.env.ORVIA_CHROME];
  try { cands.push(chromium.executablePath()); } catch (_e) { }
  cands.push('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
  return cands.find(p => { try { return p && existsSync(p); } catch (_e) { return false; } })
    || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
})();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

export async function collectStructure(appRoot) {
  const ROOT = appRoot || APP;
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.html';
    if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Strukturvertrag: unkonfiguriert */'); return; }
    const f = join(ROOT, normalize(p).replace(/^([\\/])+/, ''));
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
  await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* gestubbt */' }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.querySelectorAll('.orvia-gate,#splash').forEach(e => e.remove());
    document.documentElement.classList.remove('orvia-gated');
  });
  await page.waitForTimeout(400);

  /* Auf den Tab-Container begrenzt — sonst sickern Sektionen aus zuvor
     geoeffneten Tabs durch (der Profilaufruf zeigte so faelschlich
     „Vorderseite" aus dem Analyse-Koerpersegment). */
  const SNIP = (scopeSel) => {
    const scope = scopeSel ? document.querySelector(scopeSel) : document;
    if (!scope) return { sections: [], gmIds: [], scopeMissing: true };
    const vis = el => { const c = getComputedStyle(el); return c.display !== 'none' && c.visibility !== 'hidden' && el.offsetHeight > 0; };
    return {
      /* E-13: STABILE Anker. Sektionslabel-Texte bleiben nur informativ —
         eine redaktionelle Umbenennung darf den Vertrag nicht brechen. */
      slots: [...new Set([...scope.querySelectorAll('[data-gm-slot]')].filter(vis)
        .map(e => e.getAttribute('data-gm-slot')))].sort(),
      sections: [...scope.querySelectorAll('.sectlabel')].filter(vis)
        .map(e => (e.childNodes[0].textContent || '').trim()).filter(Boolean),
      gmIds: [...scope.querySelectorAll('[id]')].filter(vis).map(e => e.id).filter(i => /^gm/i.test(i)).sort()
    };
  };

  const areas = {};

  /* Tabs ueber den echten Navigationsweg (showTab), wie real_app_smoke. */
  for (const tab of ['heute', 'plan', 'akt', 'dash']) {
    await page.evaluate(t => { try { showTab(t); } catch (e) {} try { if (t === 'heute' && typeof renderDay === 'function') renderDay(); } catch (e) {} }, tab);
    await page.waitForTimeout(700);
    areas[tab] = await page.evaluate(SNIP, '#tab-' + tab);
  }

  /* Analyse-Segmente einzeln — jedes ist ein eigener Slot-Traeger. */
  areas.dash.segments = {};
  for (const seg of ['overview', 'endurance', 'recovery', 'body']) {
    const has = await page.evaluate(s => !!document.getElementById('gmSegBtn-' + s), seg);
    if (!has) continue;
    await page.evaluate(s => { const b = document.getElementById('gmSegBtn-' + s); if (b) b.click(); }, seg);
    await page.waitForTimeout(600);
    areas.dash.segments[seg] = await page.evaluate(SNIP, '#tab-dash');
  }

  /* Profil ueber den echten Einstieg openProfile(). */
  await page.evaluate(() => { try { openProfile(); } catch (e) {} });
  await page.waitForTimeout(700);
  areas.mehr = await page.evaluate(SNIP, '#tab-mehr');

  /* Tabbar-Vertrag */
  const tabbar = await page.evaluate(() =>
    [...document.querySelectorAll('.tabbar button[data-tab]')].map(b => b.getAttribute('data-tab')));

  /* Ehrlichkeitsprobe: Zaehlt „—" und Begruendungstexte in den sichtbaren Bereichen.
     Der Vertrag verlangt NICHT, dass Slots gefuellt sind — nur, dass sie da sind
     und ehrlich leer bleiben duerfen. */
  const honesty = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return { emDashCount: (t.match(/—/g) || []).length,
             notAvailableCount: (t.match(/Noch nicht verfügbar/g) || []).length };
  });

  await browser.close();
  server.close();
  return { tabbar, areas, honesty };
}

if (process.argv[1] && process.argv[1].endsWith('build_structure_contract.mjs')) {
  const s = await collectStructure(APP);
  const outDir = join(APP, 'docs', 'gm-ref');
  mkdirSync(outDir, { recursive: true });
  const contract = {
    contractVersion: '2.0.0',
    generatedFrom: 'v8-219-audit-baseline',
    purpose: 'Semantischer Strukturvertrag. Ersetzt die /tmp-abhaengigen gm*_parity.mjs. '
           + 'Geprueft wird, WELCHE Bereiche und Anzeigeslots existieren muessen — nicht ihr Aussehen.',
    rules: [
      'Erforderliche GM-Bereiche muessen existieren (stabile IDs).',
      'Erforderliche Anzeigeslots muessen erhalten bleiben — verankert ueber data-gm-slot.',
      'Sektionslabel-TEXTE sind informativ, nicht vertraglich. Umbenennen ist erlaubt.',
      'Ein Slot darf leer sein und "—" oder einen ehrlichen Grund anzeigen.',
      'Ein Slot darf NICHT 0 oder einen Schaetzwert als Messung ausgeben.',
      'Funktionslose interaktive Elemente duerfen verschwinden — sie sind nicht Teil des Vertrags.',
      'Keine Abhaengigkeit von /tmp, Downloads oder extern erzeugten Harness-Dateien.'
    ],
    followUp: 'Erledigt (E-13): die Anker sind data-gm-slot-Attribute. Neue geschuetzte '
            + 'Bereiche bekommen ein data-gm-slot im Renderer und werden hier aufgenommen.',
    requiredTabs: s.tabbar,
    requiredGmHosts: ['gmPlan', 'gmPage', 'gmAkt', 'gmActPage', 'gmAna', 'gmAnaPage', 'gmProf', 'gmProfPage'],
    /* VERTRAGLICH: stabile Slot-Anker */
    requiredSlots: {
      plan: s.areas.plan.slots,
      dash: s.areas.dash.slots,
      dashSegments: Object.fromEntries(Object.entries(s.areas.dash.segments || {}).map(([k, v]) => [k, v.slots])),
      mehr: s.areas.mehr.slots,
      heute: s.areas.heute.slots,
      akt: s.areas.akt.slots
    },
    /* NUR INFORMATIV: aktuelle Beschriftungen zum Zeitpunkt der Erzeugung */
    observedSectionLabels: {
      plan: s.areas.plan.sections,
      dash: s.areas.dash.sections,
      dashSegments: Object.fromEntries(Object.entries(s.areas.dash.segments || {}).map(([k, v]) => [k, v.sections])),
      mehr: s.areas.mehr.sections,
      heute: s.areas.heute.sections,
      akt: s.areas.akt.sections
    },
    observedAtGeneration: { honesty: s.honesty }
  };
  writeFileSync(join(outDir, 'structure-contract.json'), JSON.stringify(contract, null, 2) + '\n');
  console.log('Strukturvertrag geschrieben: docs/gm-ref/structure-contract.json');
  console.log('  Tabs      : ' + contract.requiredTabs.join(', '));
  console.log('  GM-Hosts  : ' + contract.requiredGmHosts.length);
  const n = Object.values(contract.requiredSlots).reduce((a, v) =>
    a + (Array.isArray(v) ? v.length : Object.values(v).reduce((b, x) => b + x.length, 0)), 0);
  console.log('  Slots     : ' + n);
}
