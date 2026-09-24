import re
p='app/js/activity.js'; s=open(p,encoding='utf-8').read()
n1=len(re.findall(r"Übungen \(' \+ (\w+)\.length \+ '\)", s))
s=re.sub(r"Übungen \(' \+ (\w+)\.length \+ '\)", lambda m: "' + _actT('act.uebungen_n', { n: %s.length }) + '"%m.group(1), s)
old="\\')\">Aktivität löschen</button>'"
assert old in s
s=s.replace(old,"\\')\">' + _actT('act.aktivitaet_loeschen') + '</button>'")
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
old="    'act.abbrechen': 'Abbrechen',\n"
assert old in d
d=d.replace(old, old+"    'act.aktivitaet_loeschen': 'Aktivität löschen',\n    'act.uebungen_n': 'Übungen ({n})',\n")
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('uebungen',n1)
