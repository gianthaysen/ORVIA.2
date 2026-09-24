p='js/ui.js'; s=open(p,encoding='utf-8').read()
# bestTimes(): k21/k42
a="  var rb={k1:null,k5:null,k10:null},src={k1:null,k5:null,k10:null};\n  runs.forEach(function(r){if(!r.best)return;\n    ['k1','k5','k10'].forEach(function(kk){var v=r.best[kk];"; assert a in s
s=s.replace(a,"  var BT_KEYS=['k1','k5','k10','k21','k42'];\n  var rb={k1:null,k5:null,k10:null,k21:null,k42:null},src={k1:null,k5:null,k10:null,k21:null,k42:null};\n  runs.forEach(function(r){if(!r.best)return;\n    BT_KEYS.forEach(function(kk){var v=r.best[kk];")
a="  ['k1','k5','k10'].forEach(function(kk){var m=meas&&meas[kk];\n    if(m&&m.sec!=null&&(rb[kk]==null||m.sec<rb[kk])){rb[kk]=m.sec;src[kk]=m.method;}});\n  if(!runs.length&&rb.k1==null&&rb.k5==null&&rb.k10==null)return null;"; assert a in s
s=s.replace(a,"  BT_KEYS.forEach(function(kk){var m=meas&&meas[kk];\n    if(m&&m.sec!=null&&(rb[kk]==null||m.sec<rb[kk])){rb[kk]=m.sec;src[kk]=m.method;}});\n  if(!runs.length&&BT_KEYS.every(function(kk){return rb[kk]==null;}))return null;")
a="t1:proj(1),t5:proj(5),t10:proj(10)};}"; assert s.count(a)==1
s=s.replace(a,"t1:proj(1),t5:proj(5),t10:proj(10),t21:proj(21.0975),t42:proj(42.195)};}")
a="  var t1=pick('k1','t1'),t5=pick('k5','t5'),t10=pick('k10','t10');\n  if(t1==null&&t5==null&&t10==null)return null;\n  return {t1:t1,t5:t5,t10:t10,real:{k1:rb.k1!=null,k5:rb.k5!=null,k10:rb.k10!=null},"; assert a in s
s=s.replace(a,"  var t1=pick('k1','t1'),t5=pick('k5','t5'),t10=pick('k10','t10'),t21=pick('k21','t21'),t42=pick('k42','t42');\n  if(t1==null&&t5==null&&t10==null&&t21==null&&t42==null)return null;\n  return {t1:t1,t5:t5,t10:t10,t21:t21,t42:t42,real:{k1:rb.k1!=null,k5:rb.k5!=null,k10:rb.k10!=null,k21:rb.k21!=null,k42:rb.k42!=null},")
# Wettkampfprognose-Karte: gemessener HM vor Riegel
a="    var rows=[['5 km',bt?bt.t5:null,bt&&bt.real.k5],['10 km',bt?bt.t10:null,bt&&bt.real.k10],['Halbmarathon',hmSec,false]];"; assert a in s
s=s.replace(a,"    /* S1/E1: ein GEMESSENER Halbmarathon (k21) schlaegt die Riegel-Prognose aus 10 km. */\n    var rows=[['5 km',bt?bt.t5:null,bt&&bt.real.k5],['10 km',bt?bt.t10:null,bt&&bt.real.k10],(bt&&bt.real&&bt.real.k21)?['Halbmarathon',bt.t21,true]:['Halbmarathon',hmSec,false]];")
# Profil-Bestzeiten: 21,1 km / 400 m Schwimmen / 20 km Rad aus Messungen
a="    {d:'21,1',u:'km',t:null},{d:'400',u:'' + _uiT('ui.m_schwimm') + '',t:null},{d:'20',u:'' + _uiT('ui.km_rad') + '',t:null}\n  ];"; assert a in s
s=s.replace(a,"""    {d:'21,1',u:'km',k:'k21',t:b&&b.t21!=null?fp(b.t21):null,real:b&&b.real&&b.real.k21},
    {d:'400',u:'' + _uiT('ui.m_schwimm') + '',k:'m400',ms:'swimming',t:_ms.swimming&&_ms.swimming.m400?_fsec(_ms.swimming.m400.sec):null,real:!!(_ms.swimming&&_ms.swimming.m400)},
    {d:'20',u:'' + _uiT('ui.km_rad') + '',k:'k20',ms:'cycling',t:_ms.cycling&&_ms.cycling.k20?_fsec(_ms.cycling.k20.sec):null,real:!!(_ms.cycling&&_ms.cycling.k20)}
  ];""")
a="  var b=null;try{b=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }\n  var fp=function(sec){"; assert a in s
s=s.replace(a,"""  var b=null;try{b=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
  /* S1/E1 (12.09.2026): Rad- und Schwimm-Bestzeiten aus denselben gemessenen Fenstern (run-bests.measuredAllBests). */
  var _ms={};try{var _rb2=window.ORVIA&&ORVIA.runBests,_st2=window.ORVIA&&ORVIA.activityStore;if(_rb2&&_rb2.measuredAllBests&&_st2&&_st2.listActivities)_ms=_rb2.measuredAllBests(_st2.listActivities(),{isTombstoned:_st2.isTombstoned||null})||{};}catch(_){ }
  var _fsec=function(sec){if(sec==null)return null;var h2=Math.floor(sec/3600),m2=Math.floor((sec%3600)/60),ss=Math.round(sec%60);return h2?(h2+':'+String(m2).padStart(2,'0')+':'+String(ss).padStart(2,'0')):(m2+':'+String(ss).padStart(2,'0'));};
  var fp=function(sec){""")
# Zeilen-Rendering: Messung fuer ms-Zeilen aus _ms statt b.meas
a="    var m=(r.k&&b&&b.meas)?b.meas[r.k]:null;\n    var sub=r.t==null?GM_NA:(r.k?gmBtSrcLabel(b,r.k):"; assert a in s
s=s.replace(a,"    var m=r.ms?((_ms[r.ms]&&_ms[r.ms][r.k])||null):((r.k&&b&&b.meas)?b.meas[r.k]:null);\n    var sub=r.t==null?GM_NA:(r.ms?((GM_BT_SRC[m&&m.method]||GM_NA)+(m&&m.km!=null?' ('+(typeof fmtDe==='function'?fmtDe(m.km):m.km)+' km)':'')):r.k?gmBtSrcLabel(b,r.k):")
open(p,'w',encoding='utf-8').write(s); print('ok')
