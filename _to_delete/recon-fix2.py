p='app/tools/i18n-recon.mjs'; s=open(p,encoding='utf-8').read()
old_a="let s = readFileSync(p, 'utf8');\ns = s.replace("
assert old_a in s
# wrap substitution in a function and apply to both sides
s=s.replace("""let s = readFileSync(p, 'utf8');
s = s.replace(""","""function inline(src) {
let s = src;
s = s.replace(""",1)
# find end of the three replace statements: after the line with function T removal
marker="s = s.replace(/^\\s*function T\\(k, ?p\\) ?\\{[^\\n]*\\n/m, '').replace(/^\\s*\\/\\* B-13: nutzersichtbare Texte[^\\n]*\\n/mg, '');\n"
assert marker in s
s=s.replace(marker, marker+"return s;\n}\nconst s = inline(readFileSync(p, 'utf8'));\n",1)
s=s.replace("const head = execSync('git show ' + REF + ':' + p, { encoding: 'utf8' });","const head = inline(execSync('git show ' + REF + ':' + p, { encoding: 'utf8' }));")
open(p,'w',encoding='utf-8').write(s)
