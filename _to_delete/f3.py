p='supabase/tests/goal_shadow_test.mjs'; s=open(p,encoding='utf-8').read()
i=s.index("  const b = GS.build({ eventType: 'session'"); j=s.index("\n", s.index("activeGoalCount: 1, gcat });", i))+1
s=s[:i]+"  const b = GS.build({ ...BASIS, eventType: 'session', eventId: 'gs_f', mainGoal: ZIEL, legacyGoal: LEGACY });\n"+s[j:]
open(p,'w',encoding='utf-8').write(s)
