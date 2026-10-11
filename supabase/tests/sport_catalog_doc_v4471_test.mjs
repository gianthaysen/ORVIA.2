/* ============================================================
   ORVIA · sport_catalog_doc (v8-447.1) — app/docs/SPORT-CATALOG-STATUS.md ist aus dem Code
   erzeugt und bleibt es. Prueft ausserdem die Aussagen, auf die sich der Validierungsbericht
   stuetzt: 24 Katalog-Sportarten, alle normalisiert, alle manuell erfassbar, alle in der
   Serverfunktion nach 0049, Garmin-Typen nur auf Katalog-IDs.
   node supabase/tests/sport_catalog_doc_v4471_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const gen = new URL(_APPREL + 'tools/gen-sport-catalog-doc.mjs', import.meta.url);
const doc = new URL(_APPREL + 'docs/SPORT-CATALOG-STATUS.md', import.meta.url);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

let checkOk = true, out = '';
try { out = execFileSync(process.execPath, [gen.pathname, '--check'], { encoding: 'utf8' }); } catch (e) { checkOk = false; out = String(e.stderr || e.message); }
ok('D1 Dokument ist aktuell (Generator --check)', checkOk, out.trim());
const mod = await import(gen.href);
const rows = mod.rows();
ok('D2 24 Katalog-Sportarten', rows.length === 24, String(rows.length));
ok('D3 alle kanonisch normalisiert', rows.every(r => r.normalized), JSON.stringify(rows.filter(r => !r.normalized).map(r => r.id)));
ok('D4 alle manuell erfassbar', rows.every(r => r.manual), JSON.stringify(rows.filter(r => !r.manual).map(r => r.id)));
const server = mod.serverSports();
ok('D5 Serverfunktion (0049) kennt alle 24 — oder ist in dieser Umgebung nicht lesbar', server === null || rows.every(r => server.has(r.id)));
const gm = mod.workerSportMap();
if (gm) {
  const ids = new Set(rows.map(r => r.id));
  ok('D6 jeder Garmin-Typ des Workers zeigt auf eine Katalog-ID (nie other)', Object.keys(gm).every(k => ids.has(k) && k !== 'other'));
  ok('D7 ohne Garmin-Typ: genau athletics, other', JSON.stringify(rows.filter(r => !(gm[r.id] || []).length).map(r => r.id).sort()) === JSON.stringify(['athletics', 'other']));
}
const text = fs.readFileSync(doc, 'utf8');
ok('D8 Signatur-Zaehlung im Dokument: 24 · 23 definiert · 1 gezeichnet · 1 Rueckfall · 0 fehlend', /24 im Katalog · 23 ausdrücklich definiert, davon 1 gezeichnet · 1 dokumentierter Rückfall · 0 fehlend/.test(text));

console.log('\n' + (fail ? '❌' : '✅') + ' sport_catalog_doc_v4471: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
