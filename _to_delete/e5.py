import re
# 1) profile-model: formatGoalValue
p='js/profile-model.js'; s=open(p,encoding='utf-8').read()
a="  function formatPace(sec) { return formatDuration(sec); }\n"; assert a in s
s=s.replace(a, a+"""  /* Zielwert lesbar (S1/E5, 12.09.2026): metricType 'time' ⇒ Sekunden als h:mm:ss h, 'pace' ⇒ min/km,
     sonst Wert + Einheit. EINE Stelle fuer Plan-Kopf, Ziel-Detail, Editor und Liste — vorher stand
     „6600 s" an vier Stellen. Gibt '' fuer null/undefined; nie eine Schaetzung. */
  function formatGoalValue(goal, value) {
    var g = goal || {}; var v = (value === undefined) ? g.targetValue : value;
    if (v == null || v === '') return '';
    if (typeof v === 'string' && !isNaN(+v)) v = +v;
    if (g.metricType === 'time' || (g.unit === 's' && typeof v === 'number')) return formatDuration(v) + ' h';
    if (g.metricType === 'pace') return formatPace(v) + ' /km';
    return String(v) + (g.unit ? ' ' + g.unit : '');
  }
""")
s=s.replace("formatPace: formatPace,","formatPace: formatPace, formatGoalValue: formatGoalValue,",1)
assert 'formatGoalValue: formatGoalValue' in s
open(p,'w',encoding='utf-8').write(s)
# 2) profile.js: _goalValueLabel delegiert; Editor-Zusammenfassung + Zielliste im Wizard
p='js/profile.js'; s=open(p,encoding='utf-8').read()
old=s[s.index("function _goalValueLabel(g,v){"):s.index("\n",s.index("}catch(e){}return escH(''+v)+(g&&g.unit?' '+escH(g.unit):'');}"))+1]
s=s.replace(old,"function _goalValueLabel(g,v){try{var M=pmModel();if(M&&typeof M.formatGoalValue==='function')return escH(M.formatGoalValue(g,v));}catch(e){}return escH(''+v)+(g&&g.unit?' '+escH(g.unit):'');}\n")
n=0
for pat in ["(d.currentValue!=null?'' + T('pf.aktuell_') + ''+escH(''+d.currentValue):'')","(g.currentValue!=null?'' + T('pf.aktuell_') + ''+escH(''+g.currentValue):'')"]:
    if pat in s: n+=1
print('profile.js summary spots',n)
open(p,'w',encoding='utf-8').write(s)
