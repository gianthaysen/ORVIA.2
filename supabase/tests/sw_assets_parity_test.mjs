/* ============================================================
   ORVIA · sw_assets_parity — jede Datei, die index.html laedt, steht in sw.js ASSETS
   ------------------------------------------------------------
   Warum: Der Service Worker liefert cache-first. Ein Skript, das index.html
   laedt, aber sw.js nicht vorbefuellt, kommt erst beim ersten Zugriff aus dem
   Netz — offline fehlt es, und beim Teildeploy ist es das erste, was still
   veraltet. Zweimal in einer Woche wurde ein neues Engine-Modul von Hand in
   beide Listen eingetragen; das gehoert unter Vertrag.
     A. jedes <script src> und <link rel=stylesheet> aus index.html ⊆ ASSETS
     B. jeder ASSETS-Eintrag unter js/ existiert als Datei
     C. locales/de.js dabei (B-13)
   node supabase/tests/sw_assets_parity_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const html = rd('index.html'), sw = rd('sw.js');
const assetsSrc = (sw.match(/const ASSETS = \[[\s\S]*?\];/) || [''])[0];
const assets = new Set([...assetsSrc.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]));
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const missing = scripts.concat(styles).filter(s => !assets.has(s) && s !== 'env.js');
ok('A1 ASSETS-Liste gefunden (' + assets.size + ' Eintraege), ' + scripts.length + ' Skripte in index.html', assets.size > 100 && scripts.length > 100);
ok('A2 jedes lokale Skript/Stylesheet aus index.html ist vorbefuellt', missing.length === 0, missing.join(', '));
const dead = [...assets].filter(a => /^js\//.test(a) && !_ex(new URL(_APPREL + a, import.meta.url)));
ok('B1 kein ASSETS-Eintrag unter js/ ohne Datei', dead.length === 0, dead.join(', '));
ok('C1 locales/de.js vorbefuellt', assets.has('locales/de.js'));
console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
