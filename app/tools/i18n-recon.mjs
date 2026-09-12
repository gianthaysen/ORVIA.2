/* ORVIA · i18n-recon (B-13) — Rueckprobe einer t()-Extraktion.
   Setzt in <datei.js> alle T('ns.key') / t('ns.key') durch den DE-Katalogtext zurueck und
   vergleicht mit dem Stand aus <git-ref> (Default HEAD). Erwartung: nur beabsichtigte
   Abweichungen (T-Kopf, {name}-Platzhalter, bewusste Textkorrekturen).
     node app/tools/i18n-recon.mjs app/js/profile.js [HEAD]
   Exit 0 = textgleich (bis auf T-Kopf), 1 = Abweichungen (werden gelistet), 2 = Aufruffehler. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
function inline(src) {
let s = src;
s = s.replace(/' \+ [tT]\('([a-z][a-zA-Z0-9]*\.[^']+)'(?:, ?\{[^}]*\})?\) \+ '/g, (m, k) => { if (!(k in de)) { if (!((k + '.other') in de)) missing.add(k); return m; } return esc(de[k]); });
s = s.replace(/\b[tT]\(\s*'([a-z][a-zA-Z0-9]*\.[^']+)'\s*\)/g, (m, k) => { if (!(k in de)) { if (!((k + '.other') in de)) missing.add(k); return m; } return "'" + esc(de[k]) + "'"; });
s = s.replace(/^function T\(k,p\)\{[^\n]*\n/m, '').replace(/^\/\* B-13: nutzersichtbare Texte[\s\S]*?\*\/\n/m, '');
s = s.replace(/^\s*function T\(k, ?p\) ?\{[^\n]*\n/m, '').replace(/^\s*\/\* B-13: nutzersichtbare Texte[^\n]*\n/mg, '');
return s;
}
const s = inline(readFileSync(p, 'utf8'));
const head = inline(execSync('git show ' + REF + ':' + p, { encoding: 'utf8' }));
/* Zeilenvergleich ueber `diff` (LCS) — robust gegen Einfuegungen beliebiger Laenge. */
const dir = mkdtempSync(join(tmpdir(), 'i18n-recon-'));
writeFileSync(join(dir, 'a'), head); writeFileSync(join(dir, 'b'), s);
let out = '';
try { out = execSync('diff ' + join(dir, 'a') + ' ' + join(dir, 'b'), { encoding: 'utf8' }); } catch (e) { out = e.stdout || ''; }
const diffLines = out.split('\n').filter(l => /^[<>]/.test(l));
diffLines.forEach(l => console.log((l[0] === '<' ? '- ' : '+ ') + l.slice(2, 202)));
const diffs = diffLines.length;
if (missing.size) console.log('FEHLENDE KEYS im Katalog:', [...missing].join(', '));
console.log((diffs === 0 && !missing.size ? '✅' : '⚠️') + ' ' + p + ' vs ' + REF + ': ' + diffs + ' abweichende Zeile(n), ' + missing.size + ' fehlende Key(s)');
process.exit(diffs === 0 && !missing.size ? 0 : 1);
