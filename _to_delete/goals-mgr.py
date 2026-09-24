import re
p='app/js/profile.js'; s=open(p,encoding='utf-8').read()
lines=s.split('\n')
# lines 670..690 (1-based) = renderGoalsList
start=669; end=690
assert lines[start].startswith('function renderGoalsList()'), lines[start][:60]
assert lines[end-1].lstrip().startswith("'<button class=\"btn sec\" style=\"margin-top:12px\" onclick=\"closeGoalsManager()\">"), lines[end-1][:80]
new = r'''/* Zielwert lesbar: metricType 'time' ⇒ Sekunden als h:mm:ss, 'pace' ⇒ min/km; sonst Wert + Einheit.
   Befund 12.09.: „Ziel: 6600 s" in der Zielliste. */
function _goalValueLabel(g,v){try{var M=pmModel();
  if(g&&g.metricType==='time')return M.formatDuration(v)+' h';
  if(g&&g.metricType==='pace')return M.formatPace(v)+' /km';
}catch(e){}return escH(''+v)+(g&&g.unit?' '+escH(g.unit):'');}
/* Mehrere aktive Ziele mit Prioritaet 1: der kanonische Selektor mainGoalOf() nimmt das
   zuerst angelegte — fuer den Nutzer unsichtbar. Die Liste benennt deshalb nur das
   tatsaechliche Hauptziel so und bietet fuer die anderen „Zum Hauptziel machen" an
   (explizite Entscheidung statt stiller Umsortierung). */
function _mainGoalId(){try{var m=(typeof mainGoalOf==='function')?mainGoalOf():null;return m?m.id:null;}catch(e){return null;}}
function goalMakeMain(id){var gs=listGoals();var patched=false;
  gs.forEach(function(g){if(!g||g.status!=='active')return;
    if(g.id===id){if(g.priority!==1){goalUpdate(g.id,{priority:1});patched=true;}}
    else if(g.priority===1){goalUpdate(g.id,{priority:2});patched=true;}});
  if(patched&&typeof toast==='function')toast(T('pf.hauptziel_festgelegt'));renderGoalsList();
  try{if(typeof renderRaceHeader==='function')renderRaceHeader();}catch(e){}}
function renderGoalsList(){var box=document.getElementById('goalsMgrBody');if(!box)return;var M=pmModel();var gs=listGoals();
  var byStatus={active:[],paused:[],achieved:[],archived:[],abandoned:[]};gs.forEach(function(g){(byStatus[g.status]||byStatus.active).push(g);});
  byStatus.active.sort(function(a,b){return a.priority-b.priority;});
  var mainId=_mainGoalId();var prio1=byStatus.active.filter(function(g){return g.priority===1;});
  var todayKey=(function(){try{return new Date().toISOString().slice(0,10);}catch(e){return '';}})();
  var titleOf=function(id){var g=gs.filter(function(x){return x&&x.id===id;})[0];return g?(g.title||goalCatLabel(g.category)):id;};
  function card(g){var roleKey=M.roleOfGoal(g);var role=GOAL_ROLE_DE[roleKey]||'Ziel';
    var notMain=(roleKey==='main'&&g.status==='active'&&mainId&&g.id!==mainId);
    if(notMain)role=T('pf.prioritaet_1_nicht_hauptziel');
    var when=g.targetDate?(' · '+(typeof shortDate==='function'?shortDate(g.targetDate):g.targetDate)):(g.timeHorizon==='long'?' · langfristig':'');
    var past=(g.status==='active'&&g.targetDate&&todayKey&&String(g.targetDate).slice(0,10)<todayKey);
    var prog=(g.currentValue!=null||g.targetValue!=null)?('<div class="gmc-prog">'+(g.currentValue!=null?T('pf.aktuell')+_goalValueLabel(g,g.currentValue):'')+(g.targetValue!=null?T('pf.ziel')+_goalValueLabel(g,g.targetValue):'')+'</div>'):'';
    var hint=past?'<div class="gmc-meta gmc-warn">'+T('pf.zieldatum_ueberschritten')+'</div>':'';
    var acts='<div class="gmc-acts">'+
      '<button class="gmc-b" onclick="openGoalDetail(\''+g.id+'\')">Details</button>'+
      '<button class="gmc-b" onclick="openGoalEditor(\''+g.id+'\')">' + T('pf.bearbeiten') + '</button>'+
      (notMain?'<button class="gmc-b" onclick="goalMakeMain(\''+g.id+'\')">'+T('pf.zum_hauptziel_machen')+'</button>':'')+
      (g.status==='active'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'paused\')">Pausieren</button>':'')+
      (g.status==='paused'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'active\')">Fortsetzen</button>':'')+
      (g.status!=='achieved'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'achieved\')">Erreicht</button>':'')+
      (g.status!=='archived'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'archived\')">Archivieren</button>':'')+
      '<button class="gmc-b danger-btn" onclick="confirmDeleteGoal(\''+g.id+'\')">Löschen</button></div>';
    return '<div class="gmcard'+(notMain?' gmcard-notmain':'')+'"><div class="gmc-h">'+escH(g.title||'Ziel')+'</div><div class="gmc-meta">'+escH(role+' · '+goalCatLabel(g.category)+when)+'</div>'+hint+prog+acts+'</div>';}
  function section(title,arr){return arr.length?('<div class="gm-sec">'+escH(title)+'</div>'+arr.map(card).join('')):'';}
  var prioHint=prio1.length>1?'<div class="gm-conflict gm-prio"><b>'+T('pf.mehrere_hauptziele')+'</b><p>'+escH(T('pf.mehrere_hauptziele_text',{n:prio1.length,title:titleOf(mainId)}))+'</p></div>':'';
  var conflicts=M.detectGoalConflicts(gs).filter(function(c){return !_conflictDecided(c);});
  var conflictHTML=conflicts.map(function(c){return '<div class="gm-conflict"><b>' + T('pf.zielkonflikt_erkannt') + '</b><p>'+escH(c.explanation)+'</p>'+
    '<div class="gmc-meta">'+escH(T('pf.betroffen')+' '+c.goalIds.map(titleOf).join(' ↔ '))+'</div>'+
    '<div class="gm-cacts">'+[T('pf.ausdauer_priorisieren_kraft_erhalten'),T('pf.muskelaufbau_priorisieren_ausdauer_erhalten'),T('pf.ziele_zeitlich_staffeln'),T('pf.eigene_entscheidung')].map(function(opt,i){return '<button class="gmc-b" onclick="decideConflict(\''+escH(c.conflictType)+'\',\''+escH(c.goalIds.join(','))+'\','+i+')">'+escH(opt)+'</button>';}).join('')+'</div></div>';}).join('');
  box.innerHTML='<button class="btn" onclick="openGoalEditor()">' + T('pf.ziel_hinzufuegen') + '</button>'+prioHint+conflictHTML+
    section(T('pf.aktive_ziele'),byStatus.active)+section('Pausiert',byStatus.paused)+section('Erreicht',byStatus.achieved)+section('Archiviert',byStatus.archived)+
    '<button class="btn sec" style="margin-top:12px" onclick="closeGoalsManager()">' + T('pf.schliessen') + '</button>';}'''
lines[start:end]=new.split('\n')
open(p,'w',encoding='utf-8').write('\n'.join(lines))
# Katalog
d=open('app/locales/de.js',encoding='utf-8').read()
add = """    'pf.hauptziel_festgelegt': 'Hauptziel festgelegt — der Plan folgt jetzt diesem Ziel.',
    'pf.prioritaet_1_nicht_hauptziel': 'Priorität 1 · nicht das Hauptziel',
    'pf.zum_hauptziel_machen': 'Zum Hauptziel machen',
    'pf.zieldatum_ueberschritten': 'Zieldatum überschritten — als erreicht markieren, neu terminieren oder archivieren.',
    'pf.mehrere_hauptziele': 'Mehrere Ziele mit Priorität 1',
    'pf.mehrere_hauptziele_text': '{n} aktive Ziele haben Priorität 1. ORVIA folgt dem zuerst angelegten („{title}"). Lege fest, welches das Hauptziel sein soll.',
    'pf.betroffen': 'Betroffen:',
"""
anchor="    'pf.aktive_ziele': 'Aktive Ziele',\n"
assert anchor in d
d=d.replace(anchor, anchor+add)
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('ok')
