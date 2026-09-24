p='app/js/nutrition.js'; s=open(p,encoding='utf-8').read()
reps=[("'<60–75 min: meist kein Fuel nötig, ausreichend trinken.'","_nutT('nut.unter_60_75_min_kein_fuel')"),
("'<60 min: meist kein zusätzliches Fuel nötig.'","_nutT('nut.unter_60_min_kein_fuel')"),
("'<div class=\"nut-warn\">Energieverfügbarkeit niedrig (~' + t.ea + ' kcal/kg) für die heutige Trainingsbelastung. Defizit reduzieren — vor allem Kohlenhydrate anheben.</div>'","'<div class=\"nut-warn\">' + _nutT('nut.energieverfuegbarkeit_niedrig', { ea: t.ea }) + '</div>'")]
for a,b in reps:
    assert a in s,a[:40]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
old="    'nut.abbrechen': 'Abbrechen',\n"; assert old in d
d=d.replace(old, old+"    'nut.energieverfuegbarkeit_niedrig': 'Energieverfügbarkeit niedrig (~{ea} kcal/kg) für die heutige Trainingsbelastung. Defizit reduzieren — vor allem Kohlenhydrate anheben.',\n    'nut.unter_60_75_min_kein_fuel': '<60–75 min: meist kein Fuel nötig, ausreichend trinken.',\n    'nut.unter_60_min_kein_fuel': '<60 min: meist kein zusätzliches Fuel nötig.',\n")
open('app/locales/de.js','w',encoding='utf-8').write(d)
