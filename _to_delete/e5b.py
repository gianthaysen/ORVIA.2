p='js/profile.js'; s=open(p,encoding='utf-8').read()
for v in ['d','g']:
    a="((%s.currentValue!=null||%s.targetValue!=null)?'<div class=\"gmc-meta\">'+(%s.currentValue!=null?'' + T('pf.aktuell_') + ''+escH(''+%s.currentValue):'')+(%s.targetValue!=null?'' + T('pf.ziel_') + ''+escH(''+%s.targetValue):'')+(%s.unit?' '+escH(%s.unit):'')+'</div>':'')+"%((v,)*8)
    assert a in s, v
    b="((%s.currentValue!=null||%s.targetValue!=null)?'<div class=\"gmc-meta\">'+(%s.currentValue!=null?T('pf.aktuell_')+_goalValueLabel(%s,%s.currentValue):'')+(%s.targetValue!=null?T('pf.ziel_')+_goalValueLabel(%s,%s.targetValue):'')+'</div>':'')+"%((v,)*8)
    s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
# ui.js: Plan-Kopf Nicht-Lauf-Ziel + Countdown past; gmProfGoalCard
p='js/ui.js'; s=open(p,encoding='utf-8').read()
a="var tgt=(typeof mg.targetValue==='number')?('<div class=\"rh-cell\"><span class=\"rh-num\">'+escH(''+mg.targetValue)+(mg.unit?' '+escH(mg.unit):'')+'</span>"
assert a in s
s=s.replace(a,"var tgt=(typeof mg.targetValue==='number')?('<div class=\"rh-cell\"><span class=\"rh-num\">'+escH(_goalValueFmt(mg,mg.targetValue))+'</span>")
# helper + past-state text near daysTo definition
a="function daysTo(date){return Math.round((new Date(date+'T00:00')-new Date(todayStr()+'T00:00'))/864e5);}\n"; assert a in s
s=s.replace(a,a+"""/* S1/E5 (12.09.2026): Zielwert ueber den zentralen Formatierer (profile-model.formatGoalValue) — nie mehr „6600 s". */
function _goalValueFmt(g,v){try{var M=window.ORVIA&&ORVIA.profileModel;if(M&&typeof M.formatGoalValue==='function')return M.formatGoalValue(g,v);}catch(_){ }return (v==null?'':String(v))+(g&&g.unit?' '+g.unit:'');}
/* Countdown-Text mit past-Zustand: vor dem Datum „noch n Tage/Wochen", danach „vor n Tagen" — nie „noch 0 Wochen". */
function _countdownText(dateIso){try{var d=daysTo(dateIso);if(d>0)return d>=14?_uiT('ui.noch_n_wochen',{n:Math.ceil(d/7)}):_uiT('ui.noch_n_tage',{n:d});if(d===0)return _uiT('ui.heute');return _uiT('ui.vor_n_tagen',{n:-d});}catch(_){return '';}}
""")
a="if(typeof daysTo==='function'){var w=Math.max(0,Math.ceil(daysTo(g.raceDate)/7));sub+=' · noch '+w+'' + _uiT('ui.wochen') + '';}"
assert a in s
s=s.replace(a,"var _cd=_countdownText(g.raceDate);if(_cd)sub+=' · '+_cd;")
# Plan-Kopf: rh-date bekommt den Countdown-Text (beide Zweige)
a="'<div class=\"rh-date\">'+escH(dateTxt)+'</div>'+"; assert s.count(a)==1
s=s.replace(a,"'<div class=\"rh-date\">'+escH(dateTxt)+(mg.targetDate&&d!=null&&d<0?' · '+escH(_countdownText(mg.targetDate)):'')+'</div>'+")
a="'<div class=\"rh-date\">'+escH(catTxt)+' · '+escH(dateTxt)+'</div>'+"; assert s.count(a)==1
s=s.replace(a,"'<div class=\"rh-date\">'+escH(catTxt)+' · '+escH(dateTxt)+(mg.targetDate&&d!=null&&d<0?' · '+escH(_countdownText(mg.targetDate)):'')+'</div>'+")
open(p,'w',encoding='utf-8').write(s)
# goal-detail.js
p='js/goal-detail.js'; s=open(p,encoding='utf-8').read()
a="    else if (typeof g.targetValue === 'number') m.targetText = g.targetValue + (g.unit ? ' ' + g.unit : '');"; assert a in s
s=s.replace(a,"    else if (typeof g.targetValue === 'number') m.targetText = fmtGoalValue(g, g.targetValue);")
a="m.progress.kind = 'value'; m.progress.currentText = g.currentValue + (g.unit ? ' ' + g.unit : ''); m.progress.targetText = g.targetValue + (g.unit ? ' ' + g.unit : '');"; assert a in s
s=s.replace(a,"m.progress.kind = 'value'; m.progress.currentText = fmtGoalValue(g, g.currentValue); m.progress.targetText = fmtGoalValue(g, g.targetValue);")
a="  function deDate(d) {"; assert a in s
s=s.replace(a,"""  /* S1/E5: Zielwert ueber profile-model.formatGoalValue (h:mm:ss statt Sekunden); Rueckfall Wert + Einheit. */
  function fmtGoalValue(g, v) { try { var M = root.ORVIA && root.ORVIA.profileModel; if (M && typeof M.formatGoalValue === 'function') return M.formatGoalValue(g, v); } catch (e) {} return (v == null ? '' : String(v)) + (g && g.unit ? ' ' + g.unit : ''); }
"""+a,1)
open(p,'w',encoding='utf-8').write(s)
# Katalog
d=open('locales/de.js',encoding='utf-8').read()
a="    'ui.wochen': ' Wochen',\n"; assert a in d
d=d.replace(a,a+"    'ui.noch_n_wochen': 'noch {n} Wochen',\n    'ui.noch_n_tage': 'noch {n} Tage',\n    'ui.vor_n_tagen': 'vor {n} Tagen',\n")
open('locales/de.js','w',encoding='utf-8').write(d)
print('ok')
