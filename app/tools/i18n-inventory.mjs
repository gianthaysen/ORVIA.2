/* ORVIA · i18n-Inventur (Band 6 e.2, Schritt 1) — zaehlt nutzersichtbare String-Literale.
   Heuristik (bewusst konservativ): Literal in '…', "…" oder `…` mit mindestens einem
   Leerzeichen UND (Umlaut/ß ODER einem haeufigen deutschen Wort) — Selektoren, Keys,
   Logs, Regex fallen damit heraus; console.*-Zeilen werden ganz uebersprungen.
   Ausgabe: Tabelle je Datei + Gesamtsumme (stdout, markdown).   node app/tools/i18n-inventory.mjs [--samples N] */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const argv = process.argv.slice(2); const samples = +(argv[argv.indexOf('--samples') + 1] || 0);
const DE_WORDS = /\b(und|oder|nicht|kein|keine|dein|deine|noch|wird|werden|bitte|heute|morgen|woche|ziel|training|einheit|satz|sätze|plan|später|jetzt|für|mit|bei|nach|vor|zum|zur|auf|aus)\b/i;
const UMLAUT = /[äöüÄÖÜß]/;
export function scanFile(p) {
  const src = readFileSync(p, 'utf8'); const out = [];
  const lines = src.split('\n');
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\.(log|warn|error|debug)/.test(line)) return;
    let m; re.lastIndex = 0;
    while ((m = re.exec(line))) {
      const s = m[1] ?? m[2] ?? m[3]; if (!s || s.length < 4 || !/\s/.test(s)) continue;
      if (/^[\s\-|·•]+$/.test(s) || /^[<{\[]/.test(s.trim()) && !/[äöüÄÖÜß]/.test(s)) continue;
      if (!UMLAUT.test(s) && !DE_WORDS.test(s)) continue;
      out.push({ line: i + 1, text: s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) });
    }
  });
  return out;
}
function walk(dir, acc) { readdirSync(dir).forEach(n => { const p = join(dir, n); const st = statSync(p); if (st.isDirectory()) { if (!/engine|knowledge|repos|metrics|node_modules/.test(n)) walk(p, acc); } else if (/\.js$/.test(n)) acc.push(p); }); return acc; }
export function inventory() { const files = walk(join(APP, 'js'), []).concat([join(APP, 'index.html')]); return files.map(f => ({ file: f.slice(APP.length + 1), hits: scanFile(f) })); }
if (process.argv[1] && /i18n-inventory\.mjs$/.test(process.argv[1])) {
const files = walk(join(APP, 'js'), []).concat([join(APP, 'index.html')]);
const rows = files.map(f => ({ file: f.slice(APP.length + 1), hits: scanFile(f) })).filter(r => r.hits.length).sort((a, b) => b.hits.length - a.hits.length);
const total = rows.reduce((n, r) => n + r.hits.length, 0);
console.log('| Datei | Literale |\n|---|---|');
rows.forEach(r => console.log('| `' + r.file + '` | ' + r.hits.length + ' |'));
console.log('| **Summe** | **' + total + '** |');
if (samples) rows.slice(0, 3).forEach(r => { console.log('\n' + r.file + ':'); r.hits.slice(0, samples).forEach(h => console.log('  ' + h.line + ': ' + h.text)); });
}
