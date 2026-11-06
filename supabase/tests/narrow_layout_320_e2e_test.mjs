/* ORVIA · v8-462 — Schmale Bildschirme (320 px): kein Text läuft aus seinem Kasten.
   Befund Layout-Durchlauf 05.11. (alle Hauptseiten + Profil-Unterseiten, 320/390/768/1280 px):
   kein Seitenüberlauf, aber bei 320 px liefen lange deutsche Titel in die Wertspalte
   (Benachrichtigungen, Datenschutz, Profilstärke, Einstellungen) und „PLANERFÜLLUNG"
   aus der Kachel. Geprüft wird je Seite: kein Element mit eigenem Text, dessen Inhalt
   breiter ist als sein Kasten. Ohne Playwright: übersprungen (Exit 2).
   node supabase/tests/narrow_layout_320_e2e_test.mjs */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.APPROOT || [path.join(HERE, '..', '..', 'app'), path.join(HERE, '..', '..')].find(p => fs.existsSync(path.join(p, 'index.html')) && fs.existsSync(path.join(p, 'js', 'ui.js')));
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Playwright fehlt; 320-px-Layout NICHT geprueft'); process.exit(2); }
let pass = 0, fail = 0; const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
let browser; try { browser = await chromium.launch(); } catch (e) { console.log('⏭️  ÜBERSPRUNGEN — Chromium startet nicht'); server.close(); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 320, height: 760 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '' }));
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('orvia_profile_v1', JSON.stringify({ v: 3, name: 'Test', sports: [{ sportId: 'running', role: 'primary', level: 'intermediate', sessionsPerWeek: 4, includeInPlan: true, activeInApp: true }] })); localStorage.setItem('orvia_ui_mode', 'profi'); } catch (e) {} });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1300);
await page.evaluate(() => { document.documentElement.classList.remove('orvia-gated'); document.querySelectorAll('.orvia-gate').forEach(e => e.remove()); try { gmStoryClose(); } catch (e) {} });
for (const v of ['prof:notifications', 'prof:privacy', 'prof:strength', 'prof:settings', 'prof:about', 'tab:akt', 'tab:heute']) {
  await page.evaluate(v => { try { closeProfile(); } catch (e) {} if (v.startsWith('tab:')) showTab(v.slice(4)); else { showTab('heute'); openProfile(); gmOpenProfPage(v.slice(5)); } }, v);
  await page.waitForTimeout(600);
  const r = await page.evaluate(v => {
    const sc = v.startsWith('tab:') ? document.getElementById('tab-' + v.slice(4)) : document.getElementById('gmProfPage'); const ex = [];
    for (const el of sc.querySelectorAll('*')) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.display === 'inline' || cs.visibility === 'hidden') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis') continue;
      const own = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim().length > 2);
      if (own && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4) ex.push((el.innerText || '').trim().slice(0, 30) + ' ' + el.scrollWidth + '/' + el.clientWidth); }
    return { ex, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, v);
  ok(v + ': kein Text breiter als sein Kasten, kein Seitenüberlauf', r.ex.length === 0 && r.page <= 0, r.ex.slice(0, 4).join(' | ') || ('Überlauf ' + r.page));
}
ok('E1 keine Seitenfehler', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
