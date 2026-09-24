import json,re
p='app/js/auth.js'; s=open(p,encoding='utf-8').read()
j=json.load(open('_to_delete/auth.json',encoding='utf-8'))
tech=[k for k in j if k.startswith('auth.onauthed_') or k.startswith('auth.avatarstore_')]
for k in tech:
    v=j[k]
    n=s.count("' + T('%s') + '"%k)
    s=s.replace("' + T('%s') + '"%k, v)
    assert n>=1,(k,n)
old="alert('' + T('auth.serverseitige_loeschung_fehlgeschlagen') + '' + resp.status + '' + T('auth.es_wurde_nichts_geloescht') + '');"
assert old in s
s=s.replace(old,"alert(T('auth.serverseitige_loeschung_fehlgeschlagen_status', { status: resp.status }));")
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
for k in tech+['auth.serverseitige_loeschung_fehlgeschlagen','auth.es_wurde_nichts_geloescht']:
    d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); assert n==1,k
d=d.replace("    'auth.abmelden': 'Abmelden',\n","    'auth.abmelden': 'Abmelden',\n    'auth.serverseitige_loeschung_fehlgeschlagen_status': 'Serverseitige Löschung fehlgeschlagen ({status}). Es wurde nichts gelöscht.',\n")
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('reverted',len(tech))
