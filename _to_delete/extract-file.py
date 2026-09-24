import json,re,subprocess,sys
f,ns,wr,label=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
out='_to_delete/%s.json'%ns
r=subprocess.run(['node','app/tools/i18n-extract.mjs',f,ns,out],capture_output=True,text=True); print(r.stdout.strip(), r.stderr.strip())
j=json.load(open(out,encoding='utf-8'))
s=open(f,encoding='utf-8').read()
s="/* B-13: nutzersichtbare Texte ueber t() (locales/de.js); eigener Wrapper-Name je Datei (profile.js fuehrt das globale T). */\nvar %s = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };\n"%wr + s
s=s.replace("T('%s."%ns, "%s('%s."%(wr,ns))
open(f,'w',encoding='utf-8').write(s)
def esc(v): return v.replace('\\','\\\\').replace("'","\\'")
block="\n    /* ---- %s.* — %s (B-13, 12.09.) ---- */\n"%(ns,label)+"".join("    '%s': '%s',\n"%(k,esc(v)) for k,v in sorted(j.items()))
d=open('app/locales/de.js',encoding='utf-8').read()
end='\n  };\n})(typeof globalThis'
assert end in d
i=d.index(end)
head=d[:i].rstrip()
if not head.endswith(','): head+=','
d=head+'\n'+block.rstrip(',\n')+d[i:]
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('keys',len(j))
for k,v in j.items():
    if re.search(r'[<>=]|^\s|\s$|\(\s*$|^[\)\.,]',v): print('  ?',k,json.dumps(v)[:90])
