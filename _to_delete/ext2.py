p='app/tools/i18n-extract.mjs'; s=open(p,encoding='utf-8').read()
old="      if (/^<[^>]*>$/.test(s)) continue;                              // reines Markup"
assert old in s
s=s.replace(old, old+"\n      if (/[\\w:-]+=\"/.test(s) && !/^[^\"]*„/.test(s)) continue;             // Attribut-Fragmente (onclick=\"…\", aria-label, SVG-Attribute) — Befund profile.js/activity.js")
open(p,'w',encoding='utf-8').write(s)
import json,re
j=json.load(open('_to_delete/act.json',encoding='utf-8'))
bad=[k for k,v in j.items() if re.search(r'[\w:-]+="',v)]
print(bad)
a='app/js/activity.js'; t=open(a,encoding='utf-8').read()
for k in bad:
    n=t.count("' + T('%s') + '"%k); assert n>=1,(k,n)
    t=t.replace("' + T('%s') + '"%k, j[k].replace("\\","\\\\").replace("'","\\'"))
    del j[k]
# T-Wrapper global
t="/* B-13: nutzersichtbare Texte ueber t() (locales/de.js). Lokaler Name, damit das globale T aus profile.js nicht doppelt deklariert wird. */\nvar _actT = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };\n"+t
t=t.replace("T('act.","_actT('act.")
open(a,'w',encoding='utf-8').write(t)
def esc(v): return v.replace('\\','\\\\').replace("'","\\'")
block="\n    /* ---- act.* — Aktivitaeten: Liste, Detail, Import, manuelle Erfassung (B-13 Schritt 6, 12.09.) ---- */\n"+"".join("    '%s': '%s',\n"%(k,esc(v)) for k,v in sorted(j.items()))
d=open('app/locales/de.js',encoding='utf-8').read()
old_end="    'auth.zugang_wird_gerade_vorbereitet_bitte': 'Zugang wird gerade vorbereitet. Bitte später erneut versuchen.'\n  };"
assert old_end in d
d=d.replace(old_end,"    'auth.zugang_wird_gerade_vorbereitet_bitte': 'Zugang wird gerade vorbereitet. Bitte später erneut versuchen.',\n"+block.rstrip(',\n')+"\n  };")
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('keys',len(j))
