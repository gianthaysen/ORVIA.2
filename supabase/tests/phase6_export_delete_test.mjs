/* ORVIA · Phase 6.5 ② (2026-08-05) — Loeschumfang + vollstaendiger Cloud-Export.
   1. QUELLTEXT: delete-account-Edge-Function loescht Storage (avatars/{uid}) VOR dem
      User-Delete, fail-closed; Cascade-Verifikation dokumentiert.
   2. CASCADE-BEWEIS: jede nutzerbezogene Tabelle der Export-Liste haengt in den
      SQL-Quellen direkt (references auth.users ... on delete cascade) oder transitiv
      (references public.<parent> ... on delete cascade) an auth.users.
   3. LIVE (Playwright + sb-Stub): exportCloudData() fragt ALLE Tabellen ab, pagt
      >1000 Zeilen vollstaendig, protokolliert Fehler PRO TABELLE ehrlich im Manifest,
      schliesst provider_credentials aus und loest einen JSON-Download aus.
   node supabase/tests/phase6_export_delete_test.mjs [appRoot-absolut] */
import http from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
const R = f => readFileSync(join(APP, f), 'utf8');
const RSB = f => readFileSync(join(HERE, '..', f.replace(/^supabase\//, '')), 'utf8');

/* ============ 1) Edge-Function-Vertraege ============ */
const fn = RSB('functions/delete-account/index.ts');
ok('delete-account: Storage-Loeschung (avatars/{uid}) VOR deleteUser',
   fn.indexOf('storage.from("avatars").list(uid') >= 0 && fn.indexOf('storage.from("avatars").remove(') >= 0
   && fn.indexOf('.list(uid') < fn.indexOf('admin.auth.admin.deleteUser(uid)'));
ok('delete-account: fail-closed — Storage-Fehler bricht ab, User bleibt (kein Teilloeschen)',
   fn.indexOf('storage_delete_failed') >= 0 && fn.indexOf('Es wurde nichts gelöscht') >= 0);
ok('delete-account: Identitaet NUR aus dem JWT (kein Fremdloeschen via Body)',
   fn.indexOf('niemals aus dem Body') >= 0 && fn.indexOf('getUser(token)') >= 0);

/* ============ 2) Cascade-Beweis fuer die Export-Tabellenliste ============ */
const dataJs = R('js/data.js');
const listM = dataJs.match(/ORVIA_CLOUD_EXPORT_TABLES=\[([\s\S]*?)\]/);
ok('Export-Tabellenliste im Quelltext gefunden', !!listM);
const TABLES = listM ? listM[1].match(/'([a-z_]+)'/g).map(s => s.replace(/'/g, '')) : [];
ok('Export-Liste umfasst >= 30 Tabellen', TABLES.length >= 30, String(TABLES.length));

const sqlAll = readdirSync(join(HERE, '..', 'migrations')).filter(f => f.endsWith('.sql'))
  .map(f => RSB('migrations/' + f)).join('\n') + '\n' + RSB('schema.sql');
function tableDef(t) {
  /* Anker DIREKT hinter "create table" — ein gieriger Prefix wuerde sonst an spaeteren
     "references public.<t>(id)"-Vorkommen anderer Tabellen andocken (realer Fund:
     user_metrics wurde faelschlich ueber die metric_anomalies-FK aufgeloest). */
  const re = new RegExp('create table (?:if not exists )?public\\.' + t + '\\s*\\(([\\s\\S]*?)\\);');
  const m = sqlAll.match(re); return m ? m[1] : null;
}
function cascadesToUsers(t, seen) {
  seen = seen || {}; if (seen[t]) return false; seen[t] = true;
  const def = tableDef(t); if (!def) return false;
  if (/references auth\.users\s*\(id\)\s*on delete cascade/.test(def)) return true;
  const parents = [...def.matchAll(/references public\.([a-z_]+)[^,\n]*on delete cascade/g)].map(m => m[1]);
  return parents.some(p => cascadesToUsers(p, seen));
}
const noCascade = TABLES.filter(t => !cascadesToUsers(t));
ok('CASCADE-BEWEIS: jede Export-Tabelle haengt direkt/transitiv mit on delete cascade an auth.users',
   noCascade.length === 0, noCascade.join(','));
/* Negativkontrolle: eine globale Referenztabelle darf NICHT kaskadieren (sonst misst der
   Beweis nichts). BEWUSST equipment, nicht exercises — exercises traegt eine nullable
   user_id-cascade-FK fuer nutzerdefinierte Uebungen (Fund bei Testerstellung). */
ok('Negativkontrolle: globale Referenztabelle equipment kaskadiert NICHT zu auth.users',
   cascadesToUsers('equipment') === false);
ok('provider_credentials bewusst NICHT in der Export-Liste (service_role-only)',
   TABLES.indexOf('provider_credentials') < 0 && dataJs.indexOf("excluded:[{table:'provider_credentials'") >= 0);

/* ============ 3) LIVE: exportCloudData mit sb-Stub ============ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/env.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); res.end('/* Test */'); return; }
  const f = join(APP, normalize(p).replace(/^([\\/])+/, ''));
  if (!f.startsWith(APP) || !existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route('**cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};' }));
await ctx.route('**cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/javascript', body: '/* stub */' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(1300);

const live = await page.evaluate(async () => {
  const queried = [];
  /* sb-Stub: user_metric_series liefert 2 volle Seiten + Rest (Paging-Beweis);
     user_goals liefert einen Fehler (Ehrlichkeits-Beweis); Rest 1 Zeile. */
  window.ORVIA = window.ORVIA || {};
  const filters = [];
  ORVIA.sb = { from: (t) => { const q = {
    select: () => q,
    eq: (col, val) => { filters.push(t + ':' + col + '=' + val); return q; },
    range: async (from, to) => {
      queried.push(t + ':' + from);
      if (t === 'user_goals') return { data: null, error: { message: 'permission denied (Stubfehler)' } };
      if (t === 'user_metric_series') {
        const page = to - from + 1;
        if (from >= 2 * page) return { data: [{ id: 'rest' }], error: null };
        return { data: Array.from({ length: page }, (_, i) => ({ id: from + i })), error: null };
      }
      return { data: [{ id: t + '-1' }], error: null };
    } }; return q; } };
  window.__exFilters = filters;
  /* Download abfangen */
  let dl = null; const orig = URL.createObjectURL;
  URL.createObjectURL = (b) => { dl = b; return 'blob:test'; };
  const origClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
  const out = await exportCloudData();
  URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = origClick;
  return {
    tables: Object.keys(out.tables).length,
    seriesRows: (out.tables.user_metric_series || []).length,
    seriesPages: queried.filter(q => q.indexOf('user_metric_series') === 0).length,
    goalsNull: out.tables.user_goals === null,
    errLogged: out._manifest.errors.some(e => e.table === 'user_goals' && /permission/.test(e.error)),
    excluded: out._manifest.excluded.some(e => e.table === 'provider_credentials'),
    dlType: dl && dl.type, dlSize: dl && dl.size,
    queriedAll: queried.length >= ORVIA_CLOUD_EXPORT_TABLES.length,
    exercisesFiltered: window.__exFilters.some(f => f === 'exercises:is_system=false')
      && !!out.tables.exercises && out._manifest.filtered.some(f => f.table === 'exercises')
  };
});
ok('LIVE · exercises nur nutzerdefiniert exportiert (is_system=false, im Manifest dokumentiert)', live.exercisesFiltered);
ok('LIVE · alle Tabellen der Liste abgefragt', live.queriedAll && live.tables >= 30, 'tables=' + live.tables);
ok('LIVE · Paging: >1000-Zeilen-Tabelle vollstaendig (2 volle Seiten + Rest, 3 Requests)',
   live.seriesRows === 2001 && live.seriesPages === 3, 'rows=' + live.seriesRows + ' pages=' + live.seriesPages);
ok('LIVE · Tabellenfehler ehrlich: user_goals=null + Manifest-Eintrag, Export laeuft weiter',
   live.goalsNull && live.errLogged);
ok('LIVE · provider_credentials im Manifest als ausgeschlossen dokumentiert', live.excluded);
ok('LIVE · JSON-Download ausgeloest (Blob mit Inhalt)', live.dlType === 'application/json' && live.dlSize > 500, String(live.dlSize));
ok('LIVE · UI-Zeile Cloud-Export in Daten verwalten', R('js/ui.js').indexOf('exportCloudData&&exportCloudData()') >= 0);
ok('LIVE · keine ungefangenen JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '));
const swv = (R('sw.js').match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version >= 234, genau einmal', swv != null && Number(swv) >= 234 && (R('sw.js').match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

await browser.close(); server.close();
console.log('\nphase6_export_delete: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
