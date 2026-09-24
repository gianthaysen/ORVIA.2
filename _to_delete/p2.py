p='app/locales/de.js'; s=open(p,encoding='utf-8').read()
old="ORVIA folgt dem zuerst angelegten („{title}\"). Lege fest"
assert old in s
s=s.replace(old,"ORVIA folgt dem zuerst angelegten („{title}“). Lege fest")
open(p,'w',encoding='utf-8').write(s)
t='supabase/tests/goals_manager_list_test.mjs'; s=open(t,encoding='utf-8').read()
old="  ok('2a genau EIN Ziel heißt „Hauptziel\"', (h.match(/Hauptziel · /g) || []).length === 1, String((h.match(/Hauptziel · /g) || []).length));"
assert old in s
s=s.replace(old,"  const act = h.slice(h.indexOf('Aktive Ziele'), h.indexOf('Archiviert') > 0 ? h.indexOf('Archiviert') : undefined);\n  ok('2a genau EIN aktives Ziel heißt „Hauptziel\"', (act.match(/Hauptziel · /g) || []).length === 1, String((act.match(/Hauptziel · /g) || []).length));")
s=s.replace("/„HM\"/.test(h)","/„HM“/.test(h)")
open(t,'w',encoding='utf-8').write(s)
