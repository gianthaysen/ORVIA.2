p='app/js/auth.js'; s=open(p,encoding='utf-8').read()
old="'Authorization': '' + T('auth.bearer') + '' + token,"
assert old in s; s=s.replace(old,"'Authorization': 'Bearer ' + token,")
old2="alert('' + T('auth.loeschung_fehlgeschlagen') + '' + ((e && e.message) || 'unbekannt') + '' + T('auth.es_wurde_nichts_geloescht_') + '');"
assert old2 in s; s=s.replace(old2,"alert(T('auth.loeschung_fehlgeschlagen_nichts_geloescht', { msg: (e && e.message) || 'unbekannt' }));")
# T-Wrapper im IIFE (nach `const O = window.ORVIA;`)
old3="  const O = window.ORVIA;\n"
assert old3 in s
s=s.replace(old3, old3+"  /* B-13: nutzersichtbare Texte ueber t() (locales/de.js); ohne i18n-Modul bleibt der Key sichtbar. */\n  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }\n",1)
open(p,'w',encoding='utf-8').write(s)
import json
j=json.load(open('_to_delete/auth.json',encoding='utf-8'))
del j['auth.bearer']; del j['auth.loeschung_fehlgeschlagen']; del j['auth.es_wurde_nichts_geloescht_']
j['auth.loeschung_fehlgeschlagen_nichts_geloescht']='Löschung fehlgeschlagen: {msg} — es wurde nichts gelöscht.'
# Katalogblock
def esc(v): return v.replace('\\','\\\\').replace("'","\\'")
block="\n    /* ---- auth.* — Login, Registrierung, Passwort/E-Mail, Konto loeschen (B-13 Schritt 5, 12.09.) ---- */\n"+"".join("    '%s': '%s',\n"%(k,esc(v)) for k,v in sorted(j.items()))
d=open('app/locales/de.js',encoding='utf-8').read()
# insert before the closing of the catalog object: find last "  };" or "};"
idx=d.rstrip().rfind('};')
# find the last key line end before idx
d=d[:idx].rstrip('\n')+'\n'+block+d[idx:]
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('keys',len(j))
