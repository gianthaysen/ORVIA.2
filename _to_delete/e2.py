# profile-model: status missed + result
p='js/profile-model.js'; s=open(p,encoding='utf-8').read()
a="  var GOAL_STATUSES = ['active', 'paused', 'achieved', 'abandoned', 'archived'];"; assert a in s
s=s.replace(a,"  var GOAL_STATUSES = ['active', 'paused', 'achieved', 'missed', 'abandoned', 'archived'];   /* 'missed' (S1/E2, Migration 0044): Wettkampf gelaufen, Zielzeit verfehlt */")
a="      milestones: normalizeMilestones(raw.milestones),\n      createdAt: raw.createdAt || now,"; assert a in s
s=s.replace(a,"      milestones: normalizeMilestones(raw.milestones),\n      /* S1/E2: bestaetigtes Wettkampfergebnis (race-result.toResult) oder {dismissed:[activityIds]}; null = keins. */\n      result: (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) ? raw.result : null,\n      createdAt: raw.createdAt || now,")
open(p,'w',encoding='utf-8').write(s)
# goalRepository: result nur wenn belegt
p='js/repos/goalRepository.js'; s=open(p,encoding='utf-8').read()
a="    row.milestones = Array.isArray(goal.milestones) ? goal.milestones : [];\n    return row;"; assert a in s
s=s.replace(a,"    row.milestones = Array.isArray(goal.milestones) ? goal.milestones : [];\n    /* S1/E2 (Migration 0044): result NUR senden, wenn belegt — auf einer Instanz ohne 0044 bleibt der\n       Upsert fuer Ziele ohne Ergebnis intakt; ein bestaetigtes Ergebnis braucht die Migration. */\n    if (goal.result && typeof goal.result === 'object') row.result = goal.result;\n    return row;")
open(p,'w',encoding='utf-8').write(s)
# profile-store hydration
p='js/profile-store.js'; s=open(p,encoding='utf-8').read()
a="          milestones: Array.isArray(r.milestones) ? r.milestones : (Array.isArray(prev.milestones) ? prev.milestones : [])\n        });"; assert a in s
s=s.replace(a,"          milestones: Array.isArray(r.milestones) ? r.milestones : (Array.isArray(prev.milestones) ? prev.milestones : []),\n          result: (r.result && typeof r.result === 'object') ? r.result : (prev.result || null)\n        });")
open(p,'w',encoding='utf-8').write(s)
print('ok')
