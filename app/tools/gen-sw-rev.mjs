/* ORVIA · gen-sw-rev (v8-450) — Inhaltskennung REV in app/sw.js.

   WOZU. Ein Browser erkennt ein App-Update nur an geaenderten Bytes von sw.js. Am 16.10.2026 trugen zwei
   Auslieferungen dieselbe Build-Nummer (orvia-v8-449) bei byte-gleicher sw.js: der neue Code lag auf GitHub
   Pages, der Service Worker lieferte weiter den alten aus seinem Cache (ledger@1 statt ledger@2).
   REV = SHA-256 (gekuerzt) ueber ALLE Dateien der Vorab-Liste ASSETS. Aendert sich eine davon, aendern sich
   sw.js und der Cache-Name (CACHE = C + '-' + REV) — unabhaengig davon, ob jemand an die Build-Nummer denkt.

     node app/tools/gen-sw-rev.mjs           schreibt REV in app/sw.js
     node app/tools/gen-sw-rev.mjs --check   nur pruefen (Exit 1 bei Abweichung)

   Gehasht: Pfad + Inhalt jeder Datei aus ASSETS (sw.js selbst nicht — sie traegt REV). './' ist index.html. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = join(APP, 'sw.js');
const REV_RX = /const REV = '([^']*)';/;

export function assetsOf(swText) {
  const m = /const ASSETS = (\[[\s\S]*?\]);/.exec(swText);
  if (!m) throw new Error('ASSETS-Liste in sw.js nicht gefunden');
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return ' + m[1] + ';')();
}
export function computeRev(app = APP) {
  const sw = readFileSync(join(app, 'sw.js'), 'utf8');
  const list = [...new Set(assetsOf(sw).map(a => (a === './' ? './index.html' : a)))].sort();
  const h = createHash('sha256');
  const missing = [];
  for (const a of list) {
    const f = join(app, a.replace(/^\.\//, '').split('?')[0]);
    if (!existsSync(f)) { missing.push(a); continue; }
    h.update(a + '\0'); h.update(readFileSync(f)); h.update('\0');
  }
  return { rev: h.digest('hex').slice(0, 12), files: list.length - missing.length, missing };
}
export function currentRev(app = APP) { const m = REV_RX.exec(readFileSync(join(app, 'sw.js'), 'utf8')); return m ? m[1] : null; }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { rev, files, missing } = computeRev();
  if (missing.length) { console.error('fehlende Dateien in ASSETS: ' + missing.join(', ')); process.exit(1); }
  const cur = currentRev();
  if (process.argv.includes('--check')) {
    if (cur !== rev) { console.error('sw.js REV veraltet (' + cur + ' ≠ ' + rev + ') — node app/tools/gen-sw-rev.mjs'); process.exit(1); }
    console.log('REV aktuell: ' + rev + ' (' + files + ' Dateien)'); process.exit(0);
  }
  const sw = readFileSync(SW, 'utf8');
  if (!REV_RX.test(sw)) { console.error('Zeile „const REV = …" fehlt in sw.js'); process.exit(1); }
  writeFileSync(SW, sw.replace(REV_RX, "const REV = '" + rev + "';"));
  console.log('REV ' + (cur === rev ? 'unveraendert' : cur + ' → ' + rev) + ' (' + files + ' Dateien)');
}
