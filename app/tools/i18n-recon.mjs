/* ORVIA · i18n-recon (B-13) — Rueckprobe einer t()-Extraktion.
   Setzt in <datei.js> alle T('ns.key') / t('ns.key') durch den DE-Katalogtext zurueck und
   vergleicht mit dem Stand aus <git-ref> (Default HEAD). Erwartung: nur beabsichtigte
   Abweichungen (T-Kopf, {name}-Platzhalter, bewusste Textkorrekturen).
     node app/tools/i18n-recon.mjs app/js/profile.js [HEAD]
   Exit 0 = textgleich (bis auf T-Kopf), 1 = Abweichungen (werden gelistet), 2 = Aufruffehler. */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import vm from 'node:vm';
const [,, p, REF = 'HEAD'] = process.argv;
if (!p) { console.error('Aufruf: node app/tools/i18n-recon.mjs <datei.js> [git-ref]'); process.exit(2); }
const root = p.indexOf('app/') === 0 ? 'app/' : '';
const sb = { window: null }; sb.window = sb; sb.self = sb; vm.createContext(sb);
vm.runInContext(readFileSync(root + 'js/i18n.js', 'utf8'), sb); vm.runInContext(readFileSync(root + 'locales/de.js', 'utf8'), sb);
const de = sb.ORVIA.locales.de;
const esc = v => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const missing = new Set();
let s = readFileSync(p, 'utf8');
s = s.replace(/' \+ [tT]\('([a-z][a-zA-Z0-9]*\.[^']+)'(?:, ?\{[^}]*\})?\) \+ '/g, (m, k) => { if (!(k in de)) { if (!((k + '.other') in de)) missing.add(k); return m; } return esc(de[k]); });
s = s.replace(/\b[tT]\(\s*'([a-z][a-zA-Z0-9]*\.[^']+)'\s*\)/g, (m, k) => { if (!(k in de)) { if (!((k + '.other') in de)) missing.add(k); return m; } return "'" + esc(de[k]) + "'"; });
s = s.replace(/^function T\(k,p\)\{[^\n]*\n/m, '').replace(/^\/\* B-13: nutzersichtbare Texte[\s\S]*?\*\/\n/m, '');
s = s.replace(/^\s*function T\(k, ?p\) ?\{[^\n]*\n/m, '').replace(/^\s*\/\* B-13: nutzersichtbare Texte[^\n]*\n/mg, '');
const head = execSync('git show ' + REF + ':' + p, { encoding: 'utf8' });
const a = head.split('\n'), b = s.split('\n');
let diffs = 0; const max = Math.max(a.length, b.length);
// zeilenweise, tolerant gegen reine Einfuegungen des T-Kopfes: gleiche Zeilen ueberspringen, Abweichungen listen
let i = 0, j = 0;
while (i < a.length || j < b.length) {
  if (a[i] === b[j]) { i++; j++; continue; }
  // versuche Resynchronisation: naechste identische Zeile innerhalb 3 Zeilen
  let found = false;
  for (let di = 0; di <= 3 && !found; di++) for (let dj = 0; dj <= 3 && !found; dj++) { if ((di || dj) && a[i + di] === b[j + dj] && a[i + di] !== undefined) { for (let x = 0; x < di; x++) console.log('- ' + (a[i + x] || '').slice(0, 200)); for (let y = 0; y < dj; y++) console.log('+ ' + (b[j + y] || '').slice(0, 200)); diffs += di + dj; i += di; j += dj; found = true; } }
  if (!found) { console.log('- ' + (a[i] || '').slice(0, 200)); console.log('+ ' + (b[j] || '').slice(0, 200)); diffs++; i++; j++; }
}
if (missing.size) console.log('FEHLENDE KEYS im Katalog:', [...missing].join(', '));
console.log((diffs === 0 && !missing.size ? '✅' : '⚠️') + ' ' + p + ' vs ' + REF + ': ' + diffs + ' abweichende Zeile(n), ' + missing.size + ' fehlende Key(s)');
process.exit(diffs === 0 && !missing.size ? 0 : 1);
