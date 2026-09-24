p='js/profile.js'; s=open(p,encoding='utf-8').read()
old=s[s.index("      (g.status==='active'?'<button class=\"gmc-b\" onclick=\"goalSetStatus(\\''+g.id+'\\',\\'paused\\')\">Pausieren</button>':'')+"):s.index("      '<button class=\"gmc-b danger-btn\" onclick=\"confirmDeleteGoal(")]
new="""      /* 13.09.: Lebenszyklus vollstaendig — aktiv: Pausieren, Erreicht, Verfehlt (nach dem Datum); pausiert: Fortsetzen;
         erreicht/verfehlt/archiviert: Wieder aktivieren (Befund: ein versehentliches „Erreicht" war nicht rueckholbar). */
      (g.status==='active'?'<button class="gmc-b" onclick="goalSetStatus(\\''+g.id+'\\',\\'paused\\')">Pausieren</button>':'')+
      (g.status==='paused'?'<button class="gmc-b" onclick="goalSetStatus(\\''+g.id+'\\',\\'active\\')">Fortsetzen</button>':'')+
      (g.status==='active'||g.status==='paused'?'<button class="gmc-b" onclick="goalSetStatus(\\''+g.id+'\\',\\'achieved\\')">Erreicht</button>':'')+
      ((g.status==='active'||g.status==='paused')&&past?'<button class="gmc-b" onclick="goalSetStatus(\\''+g.id+'\\',\\'missed\\')">'+T('pf.rr_verfehlt')+'</button>':'')+
      (g.status==='achieved'||g.status==='missed'||g.status==='archived'||g.status==='abandoned'?'<button class="gmc-b" onclick="goalReactivate(\\''+g.id+'\\')">'+T('pf.wieder_aktivieren')+'</button>':'')+
      (g.status!=='archived'?'<button class="gmc-b" onclick="goalSetStatus(\\''+g.id+'\\',\\'archived\\')">Archivieren</button>':'')+
"""
s=s.replace(old,new)
# Wettkampf-Erkennung auch fuer erreichte/verfehlte Ziele ohne gespeichertes Ergebnis
a="      else if(g.status==='active'&&O&&O.raceResult&&O.activityStore&&O.activityStore.listActivities){"; assert a in s
s=s.replace(a,"      else if((g.status==='active'||g.status==='achieved'||g.status==='missed')&&O&&O.raceResult&&O.activityStore&&O.activityStore.listActivities){")
# goalReactivate
a="function goalDismissRace(goalId,activityId){"; assert a in s
s=s.replace(a,"""/* 13.09.: Ziel wieder aktivieren — Status active, gespeichertes Ergebnis bleibt zur Nachvollziehbarkeit erhalten,
   wird aber nicht mehr als Abschluss gewertet (verdict entfernt, activityId als dismissed-Hinweis behalten). */
function goalReactivate(goalId){
  try{var g=listGoals().filter(function(x){return x&&x.id===goalId;})[0];if(!g)return;
    var patch={status:'active'};
    if(g.result&&g.result.verdict)patch.result={dismissed:[],previous:g.result};
    goalUpdate(goalId,patch,'reactivate');
    if(typeof toast==='function')toast(T('pf.ziel_wieder_aktiv'));
    try{if(typeof renderRaceHeader==='function')renderRaceHeader();}catch(e){}
    try{if(document.getElementById('goalsMgrBody'))renderGoalsList();}catch(e){}
  }catch(e){}
}
"""+a)
open(p,'w',encoding='utf-8').write(s)
d=open('locales/de.js',encoding='utf-8').read()
a="    'pf.rr_uebernehmen': 'Übernehmen',\n"; assert a in d
d=d.replace(a,a+"    'pf.wieder_aktivieren': 'Wieder aktivieren',\n    'pf.ziel_wieder_aktiv': 'Ziel ist wieder aktiv.',\n")
open('locales/de.js','w',encoding='utf-8').write(d)
print('ok')
