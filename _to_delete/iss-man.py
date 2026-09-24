import re
p='app/js/issues.js'; s=open(p,encoding='utf-8').read()
reps=[
("'Intensität bei < 6 h vermeiden'","_issT('iss.intensitaet_unter_6h_vermeiden')"),
("'Mehrere Nächte < 6 h → keine Intensität, Erholung priorisieren.'","_issT('iss.mehrere_naechte_unter_6h')"),
("((ORVIA_MODULES[k]||{}).label||k)+'' + _issT('iss.jetzt') + ''","_issT('iss.label_jetzt', { label: (ORVIA_MODULES[k]||{}).label||k })"),
("'<div class=\"modadv\" style=\"margin:10px 0 4px\">Seit '+(d>=21?'' + _issT('iss.ueber_3_wochen') + '':d+'' + _issT('iss.tagen') + '')+' keine nennenswerten Beschwerden bei <b>'+escH(label)+'</b>. Modul pausieren?'+",
 "'<div class=\"modadv\" style=\"margin:10px 0 4px\">' + _issT('iss.pause_frage', { seit: (d>=21 ? _issT('iss.ueber_3_wochen') : _issT('iss.n_tagen', { n: d })), label: '<b>'+escH(label)+'</b>' }) +"),
("\\')\">Weiter unterstützen</button>","\\')\">' + _issT('iss.weiter_unterstuetzen') + '</button>"),
]
for a,b in reps:
    assert a in s, a[:60]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
add={"iss.intensitaet_unter_6h_vermeiden":"Intensität bei < 6 h vermeiden",
"iss.mehrere_naechte_unter_6h":"Mehrere Nächte < 6 h → keine Intensität, Erholung priorisieren.",
"iss.label_jetzt":"{label} JETZT","iss.n_tagen":"{n} Tagen",
"iss.pause_frage":"Seit {seit} keine nennenswerten Beschwerden bei {label}. Modul pausieren?",
"iss.weiter_unterstuetzen":"Weiter unterstützen"}
old="    /* ---- iss.* — Beschwerde-Module: Regionen, Routinen, Warnsignale, Status (B-13, 12.09.) ---- */\n"; assert old in d
d=d.replace(old, old+"".join("    '%s': '%s',\n"%(k,v) for k,v in add.items()))
for k in ['iss.jetzt','iss.tagen']:
    if ("'%s'"%k) not in s:
        d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); assert n==1,k
open('app/locales/de.js','w',encoding='utf-8').write(d)
