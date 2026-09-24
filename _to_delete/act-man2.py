import re
p='app/js/activity.js'; s=open(p,encoding='utf-8').read()
reps=[
("'<p class=\"modtext\" style=\"margin:0 0 12px\">' + _actT('act.fuer') + '<b>' + escH(typ) + '</b> am ' + escH(date) + '' + _actT('act.gibt_es_schon_eine_einheit') + '' + escH(src) + '' + _actT('act.uebereinstimmung') + '' + escH(conf) + '). Was möchtest du tun?</p>'",
 "'<p class=\"modtext\" style=\"margin:0 0 12px\">' + _actT('act.dup_einheit_frage', { typ: '<b>' + escH(typ) + '</b>', date: escH(date), src: escH(src), conf: escH(conf) }) + '</p>'"),
("'<p class=\"modtext\" style=\"margin:0 0 12px\">' + _actT('act.fuer') + '<b>' + escH(typ) + '</b> am ' + escH(date) + '' + _actT('act.liegt_bereits_eine_aktivitaet_aus') + '' + escH(src) + ' vor. Doppelte Erfassung kann Wochenumfang und Belastung verfälschen.</p>'",
 "'<p class=\"modtext\" style=\"margin:0 0 12px\">' + _actT('act.dup_aktivitaet_hinweis', { typ: '<b>' + escH(typ) + '</b>', date: escH(date), src: escH(src) }) + '</p>'"),
("\\')\">Vom Wochenplan lösen</button>'", "\\')\">' + _actT('act.vom_wochenplan_loesen_btn') + '</button>'"),
("\\')\">Vorhandene öffnen</button>'", "\\')\">' + _actT('act.vorhandene_oeffnen') + '</button>'"),
("text-align:center\">GPX/TCX-Datei wählen' +", "text-align:center\">' + _actT('act.gpx_tcx_datei_waehlen') + '' +"),
]
for a,b in reps:
    assert a in s, a[:60]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
add={"act.dup_einheit_frage":"Für {typ} am {date} gibt es schon eine Einheit ({src}, Übereinstimmung: {conf}). Was möchtest du tun?",
"act.dup_aktivitaet_hinweis":"Für {typ} am {date} liegt bereits eine Aktivität aus {src} vor. Doppelte Erfassung kann Wochenumfang und Belastung verfälschen.",
"act.vom_wochenplan_loesen_btn":"Vom Wochenplan lösen","act.vorhandene_oeffnen":"Vorhandene öffnen","act.gpx_tcx_datei_waehlen":"GPX/TCX-Datei wählen"}
old="    'act.abbrechen': 'Abbrechen',\n"
d=d.replace(old, old+"".join("    '%s': '%s',\n"%(k,v) for k,v in add.items()))
# unbenutzte Fragment-Keys entfernen
for k in ['act.fuer','act.gibt_es_schon_eine_einheit','act.uebereinstimmung','act.liegt_bereits_eine_aktivitaet_aus']:
    if ("'%s'"%k) not in s:
        d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); print('removed',k,n)
open('app/locales/de.js','w',encoding='utf-8').write(d)
