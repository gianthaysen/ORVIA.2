p='supabase/tests/goals_manager_list_test.mjs'; s=open(p,encoding='utf-8').read()
old="  sb.ensureProfile();\n  els.goalsMgrBody = mkEl();"
new="  sb.ensureProfile();\n  // Legacy-Migration seedet „Allgemeine Gesundheit“ mit Priorität 1 — hier archivieren, damit nur die Testziele aktiv sind.\n  sb.listGoals().slice().forEach(g => sb.goalSetStatus(g.id, 'archived'));\n  els.goalsMgrBody = mkEl();"
assert old in s
open(p,'w',encoding='utf-8').write(s.replace(old,new))
