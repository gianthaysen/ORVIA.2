p='app/tools/i18n-extract.mjs'; s=open(p,encoding='utf-8').read()
# 1) Klassifikations-Set aus allen JS-Dateien
old="let src = readFileSync(p, 'utf8');\n"
assert old in s
new = r'''let src = readFileSync(p, 'utf8');
/* KLASSIFIKATIONS-SCHUTZ (Befund ui.js 12.09.: {'Wettkampf':'race_week'}[act.n] wurde zu
   {'' + T('…') + '':…} — Syntaxfehler; schlimmer waere ein Label, das an einer Stelle Text
   und an einer anderen Vergleichswert ist). Ein Literal, das IRGENDWO in app/js als
   Objektschluessel, Vergleichsoperand (===, !==, ==, !=), case-Label oder Index (obj['x'])
   steht, ist ein Bezeichner und wird nirgends extrahiert. Zusaetzlich wird jede einzelne
   Fundstelle in solchem Kontext uebersprungen (auch fuer Teiltexte). */
import { readdirSync, statSync } from 'node:fs';
import { join as _join, dirname as _dirname } from 'node:path';
function _walk(dir, out) { for (const n of readdirSync(dir)) { const f = _join(dir, n); const st = statSync(f); if (st.isDirectory()) _walk(f, out); else if (/\.js$/.test(n)) out.push(f); } return out; }
const _jsRoot = (() => { let d = _dirname(p); while (d && !/(^|\/)js$/.test(d) && d !== '.' && d !== '/') d = _dirname(d); return /(^|\/)js$/.test(d) ? d : _dirname(p); })();
const IDENT = new Set();
function _identContext(text, before, after) {
  const b = before.replace(/\s+$/, ''), a = after.replace(/^\s+/, '');
  if (/(===|!==|==|!=)$/.test(b) || /^(===|!==|==|!=)/.test(a)) return true;     // Vergleich
  if (/\bcase$/.test(b)) return true;                                               // switch
  if (/\[$/.test(b) && /^\]/.test(a)) return true;                                  // obj['x']
  if (/[{,]$/.test(b) && /^:/.test(a) && !/\?[^:]*$/.test(b.slice(-80))) return true; // Objektschluessel (kein Ternary)
  return false;
}
for (const f of _walk(_jsRoot, [])) {
  const t = readFileSync(f, 'utf8'); const r = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g; let m;
  while ((m = r.exec(t))) { const body = m[1] != null ? m[1] : m[2]; if (!body) continue;
    if (_identContext(body, t.slice(Math.max(0, m.index - 80), m.index), t.slice(m.index + m[0].length, m.index + m[0].length + 8))) IDENT.add(body); }
}
'''
s=s.replace(old,new,1)
# 2) Textfilter: IDENT ausschliessen
old2="uniq.sort((a, b) => b.length - a.length);"
assert old2 in s
s=s.replace(old2,"const uniq2 = uniq.filter(t => !IDENT.has(t));\nconst skippedIdent = uniq.length - uniq2.length;\nuniq2.sort((a, b) => b.length - a.length);",1)
s=s.replace("for (const t of uniq) {","for (const t of uniq2) {",1)
# 3) Fundstellen-Guard im Ersetzungslauf
old3="    if (body.indexOf(t) >= 0 && !/T\\('ob\\./.test(body.slice(0, 0))) {"
assert old3 in s
s=s.replace(old3,"    if (body.indexOf(t) >= 0 && !_identContext(body, src.slice(Math.max(0, mm.index - 80), mm.index), src.slice(mm.index + mm[0].length, mm.index + mm[0].length + 8))) {",1)
s=s.replace("console.log('candidates', cand.size, 'texts', uniq.length, 'replaced', n);","console.log('candidates', cand.size, 'texts', uniq.length, 'als Bezeichner ausgeschlossen', skippedIdent, 'replaced', n);")
open(p,'w',encoding='utf-8').write(s); print('ok')
