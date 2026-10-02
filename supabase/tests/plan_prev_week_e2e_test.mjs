/* ORVIA · plan_prev_week_e2e (v8-425) — die Vorwoche im ECHTEN Browser.

   Gians Befund 2.10. („das mit dem Plan funktioniert immer noch nicht"): Aktivitaet
   zugeordnet, Vorwochen-Karte bleibt „Nicht erledigt". v8-424 hatte die Ursache nur
   aus dem Code hergeleitet und gegen Stubs getestet — der Fehler ueberlebte. Im
   Browser nachgestellt: bei einem GENERIERTEN Plan liefert gmPlanForOffset(-1)
   Einheiten OHNE id ⇒ keine Occurrence ⇒ die Karte kann nie „Erledigt" werden.
   Dieser Test laeuft deshalb durch die echte App: echter Generator, echter Store,
   echter Resolver, echte Planseite, echte automatische Zuordnung.

   node supabase/tests/plan_prev_week_e2e_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = (function () {
  /* Playwright ist eine ENTWICKLUNGSVORAUSSETZUNG, kein App-Bestandteil.
     Aufgeloest wird wie bei supabase-js in den Live-Tests: erst normal, dann
     ueber die bekannten node_modules-Nachbarn (Repo-Stamm, app, _dev). Fehlt
     es wirklich (z. B. in einer Umgebung ohne Browser), ist das ein
     UEBERSPRUNGEN (exit 2) — nie ein Crash, der wie ein Produktfehler
     aussieht, und nie ein stilles Gruen. Bewusst OHNE HERE/join: dieser Block
     laeuft vor deren Definition. */
  const _p = require('node:path');
  const _h = _p.dirname(new (globalThis.URL || require('node:url').URL)(import.meta.url).pathname);
  const _cands = [null, _p.join(_h, '..', '..'), _p.join(_h, '..', '..', 'app'),
    _p.join(_h, '..', '..', '_dev'), _p.join(_h, '..', '..', '..')];
  for (const c of _cands) {
    try { return require(c ? _p.join(c, 'node_modules', 'playwright') : 'playwright'); }
    catch (_e) { }
  }
  console.log('⏭️  ÜBERSPRUNGEN — playwright ist in dieser Umgebung nicht installiert (npm install im Repo-Stamm holt es nach)');
  process.exit(2);
})();
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);
const CHROME = (await import('./_pw-chrome.mjs')).chromeOrSkip(chromium); /* v8-307b: Binary-Existenz ist Teil der Skip-Bedingung */

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const browser = await (await import('./_pw-chrome.mjs')).launchOrSkip(chromium, { executablePath: CHROME }); /* v8-365: Start ist Teil der Skip-Bedingung */


const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  document.documentElement.classList.remove('orvia-gated');
  const W = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  const iso = d => todayStr(d);
  const t = new Date(todayStr() + 'T12:00'); const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7) - 7);
  const day = i => { const d = new Date(mon); d.setDate(mon.getDate() + i); return iso(d); };
  const S = ORVIA.activityStore;
  try { localStorage.removeItem('orvia_activities_local'); } catch (_) {}
  const cur = activeWeekPlan(), prev = gmPlanForOffset(-1);
  out.prov = prev.provenance;
  out.units = prev.days.reduce((n, d) => n + d.length, 0);
  out.noId = prev.days.reduce((n, d) => n + d.filter(it => !it.id).length, 0);
  out.sameIds = JSON.stringify(prev.days.map(d => d.map(it => it.id))) === JSON.stringify(cur.map(d => d.map(it => it.id)));
  /* erste Gym-Einheit der Vorwoche suchen (Generator-Standard: Kraftplan) */
  let di = -1, unit = null;
  for (let i = 0; i < 7 && !unit; i++) for (const it of prev.days[i]) if (it.t === 'Gym') { di = i; unit = it; break; }
  out.unit = unit ? { di, id: unit.id, l: unit.l } : null;
  if (!unit) return out;
  const occ = 'po:' + day(di) + ':' + unit.id;
  const actDay = day(Math.min(6, di + 2));                 /* zwei Tage spaeter absolviert — wie in Gians Fall */
  S.mergeServerActivities([{ id: 'e2e-g1', sport_id: 'gym', source: 'garmin', source_record_id: 'e2e-g1', started_at: actDay + 'T05:42:00.000Z', duration_seconds: 3360, status: 'completed', summary: { avgHr: 110, distance_m: 0 }, metrics: { plannedSessionId: occ } }]);   /* Garmin liefert fuer Kraft die Distanz 0 */
  showTab('plan'); gmShiftPlanWeek(-1); await W(150);
  const card = () => document.querySelector('#tab-plan .session-card[data-sid="' + CSS.escape(unit.id) + '"]');
  const cards = () => [].slice.call(document.querySelectorAll('#tab-plan .session-card[data-sid]'));
  out.linkedDone = !!(card() && card().classList.contains('done'));
  out.linkedBadge = card() ? card().querySelector('.session-state').textContent.trim() : null;
  out.others = cards().filter(c => c !== card()).map(c => c.querySelector('.session-state').textContent.trim());
  out.ist = (document.querySelector('#tab-plan').textContent.match(/56 min/) || [])[0] || null;
  out.zeroKm = /Absolviert:[^A-Za-z]*0 km/.test(document.querySelector('#tab-plan').textContent);
  /* automatische Zuordnung: unverknuepfte Gym-Aktivitaet in der Vorwoche */
  S.mergeServerActivities([{ id: 'e2e-g2', sport_id: 'gym', source: 'garmin', source_record_id: 'e2e-g2', started_at: day(6) + 'T07:00:00.000Z', duration_seconds: 1800, status: 'completed', summary: {}, metrics: {} }]);
  const r = ORVIA.planAutoLink.run();
  out.auto = { ok: r.ok, applied: r.applied, deferred: r.deferred, link: S.planLinkOf(S.getActivityById('e2e-g2')) };
  await W(150);
  out.doneAfter = cards().filter(c => c.classList.contains('done')).length;
  /* Label der Zuordnung kommt aus dem Plan DIESER Woche */
  const L = planUnitLabelFor(occ);
  out.label = L ? { label: L.label, hasUnit: !!L.unit } : null;
  /* laufende Woche bleibt unveraendert korrekt */
  gmPlanWeekToday(); await W(100);
  out.curCards = cards().length;
  return out;
});
await browser.close(); server.close();

ok('A1 App laedt ohne Laufzeitfehler', errs.length === 0, errs.slice(0, 2).join(' | '));
ok('A2 Vorwoche kommt aus der wiederkehrenden Struktur und hat Einheiten', R.prov === 'recurring_preview' && R.units > 0, R.prov + ' / ' + R.units);
ok('A3 JEDE Einheit der Vorwoche traegt eine id (vorher: keine ⇒ nie „Erledigt")', R.noId === 0, 'ohne id: ' + R.noId);
ok('A4 die IDs sind dieselben wie in der laufenden Woche (gegen sie wurde verknuepft)', R.sameIds === true);
ok('B1 zugeordnete Aktivitaet ⇒ Vorwochen-Karte „Erledigt"', R.unit && R.linkedDone === true && /Erledigt/.test(R.linkedBadge || ''), JSON.stringify({ u: R.unit, b: R.linkedBadge }));
ok('B2 Ist-Wert (56 min) steht an der Karte, ohne 0 km an der Krafteinheit', R.ist === '56 min' && R.zeroKm === false);
ok('B3 uebrige vergangene Einheiten: „Nicht erledigt", keine heisst mehr „Geplant"', R.others.length > 0 && R.others.every(x => x !== 'Geplant') && R.others.some(x => x === 'Nicht erledigt'), JSON.stringify(R.others));
ok('C1 automatische Zuordnung ordnet eine unverknuepfte Vorwochen-Aktivitaet zu', R.auto && R.auto.ok && R.auto.applied === 1 && /^po:\d{4}-\d{2}-\d{2}:/.test(R.auto.link || ''), JSON.stringify(R.auto));
ok('C2 danach zwei Karten „Erledigt" — die Planseite zeichnet von selbst neu', R.doneAfter === 2, 'done=' + R.doneAfter);
ok('C3 Zuordnungs-Label wird im Plan der Vorwoche gefunden (keine rohe ID)', R.label && R.label.hasUnit === true && /Gym/.test(R.label.label), JSON.stringify(R.label));
ok('D1 Rueckweg in die laufende Woche funktioniert', R.curCards > 0);

console.log('\n' + (fail ? '❌' : '✅') + ' plan_prev_week_e2e: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
