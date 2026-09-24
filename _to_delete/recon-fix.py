p='app/tools/i18n-recon.mjs'; s=open(p,encoding='utf-8').read()
i=s.index("const head = execSync('git show '")
new='''const head = execSync('git show ' + REF + ':' + p, { encoding: 'utf8' });
/* Zeilenvergleich ueber `diff` (LCS) — robust gegen Einfuegungen beliebiger Laenge. */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = mkdtempSync(join(tmpdir(), 'i18n-recon-'));
writeFileSync(join(dir, 'a'), head); writeFileSync(join(dir, 'b'), s);
let out = '';
try { out = execSync('diff ' + join(dir, 'a') + ' ' + join(dir, 'b'), { encoding: 'utf8' }); } catch (e) { out = e.stdout || ''; }
const diffLines = out.split('\\n').filter(l => /^[<>]/.test(l));
diffLines.forEach(l => console.log((l[0] === '<' ? '- ' : '+ ') + l.slice(2, 202)));
const diffs = diffLines.length;
if (missing.size) console.log('FEHLENDE KEYS im Katalog:', [...missing].join(', '));
console.log((diffs === 0 && !missing.size ? '✅' : '⚠️') + ' ' + p + ' vs ' + REF + ': ' + diffs + ' abweichende Zeile(n), ' + missing.size + ' fehlende Key(s)');
process.exit(diffs === 0 && !missing.size ? 0 : 1);
'''
s=s[:i]+new
# imports must be at top in ESM: move the three import lines to the top
for line in ["import { writeFileSync, mkdtempSync } from 'node:fs';\n","import { join } from 'node:path';\n","import { tmpdir } from 'node:os';\n"]:
    s=s.replace(line,'',1)
s=s.replace("import { readFileSync } from 'node:fs';\n","import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';\nimport { join } from 'node:path';\nimport { tmpdir } from 'node:os';\n",1)
open(p,'w',encoding='utf-8').write(s)
