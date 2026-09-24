p='js/profile.js'; s=open(p,encoding='utf-8').read()
a="  var byStatus={active:[],paused:[],achieved:[],archived:[],abandoned:[]};gs.forEach(function(g){(byStatus[g.status]||byStatus.active).push(g);});"; assert a in s
s=s.replace(a,"  var byStatus={active:[],paused:[],achieved:[],missed:[],archived:[],abandoned:[]};gs.forEach(function(g){(byStatus[g.status]||byStatus.active).push(g);});")
a="    var hint=past?'<div class=\"gmc-meta gmc-warn\">'+T('pf.zieldatum_ueberschritten')+'</div>':'';"; assert a in s
s=s.replace(a,"""    /* S1/E2: Wettkampfergebnis auf der Karte — bestaetigt, erkannt (mit Uebernehmen) oder Datum vorbei. */
    var hint='';
    try{var O=window.ORVIA,rr=g.result&&g.result.verdict?g.result:null;
      if(rr){hint='<div class="gmc-meta gmc-rr gmc-rr-'+escH(rr.verdict)+'">'+escH((rr.verdict==='achieved'?T('pf.rr_erreicht'):rr.verdict==='missed'?T('pf.rr_verfehlt'):T('pf.rr_gefinisht'))+' · '+_fmtSecShort(rr.timeSec)+(rr.deltaSec!=null?' ('+(rr.deltaSec<=0?'−':'+')+_fmtSecShort(Math.abs(rr.deltaSec))+')':''))+'</div>';}
      else if(g.status==='active'&&O&&O.raceResult&&O.activityStore&&O.activityStore.listActivities){
        var mm=O.raceResult.match(g,O.activityStore.listActivities()||[],{isTombstoned:O.activityStore.isTombstoned||null});
        if(mm)hint='<div class="gmc-meta gmc-rr gmc-rr-match">'+escH(T('pf.rr_wettkampf_erkannt')+' · '+_fmtSecShort(mm.timeSec)+(mm.verdict==='achieved'?' · '+T('pf.rr_erreicht'):mm.verdict==='missed'?' · '+T('pf.rr_verfehlt'):''))+' <button class="gmc-b" onclick="goalConfirmResult(\\''+g.id+'\\',\\''+escH(mm.activityId)+'\\')">'+T('pf.rr_uebernehmen')+'</button></div>';
        else if(past)hint='<div class="gmc-meta gmc-warn">'+T('pf.zieldatum_ueberschritten')+'</div>';}
      else if(past)hint='<div class="gmc-meta gmc-warn">'+T('pf.zieldatum_ueberschritten')+'</div>';
    }catch(e){hint=past?'<div class="gmc-meta gmc-warn">'+T('pf.zieldatum_ueberschritten')+'</div>':'';}""")
a="    section(T('pf.aktive_ziele'),byStatus.active)+section('Pausiert',byStatus.paused)+section('Erreicht',byStatus.achieved)+section('Archiviert',byStatus.archived)+"; assert a in s
s=s.replace(a,"    section(T('pf.aktive_ziele'),byStatus.active)+section('Pausiert',byStatus.paused)+section('Erreicht',byStatus.achieved)+section(T('pf.rr_verfehlt'),byStatus.missed)+section('Archiviert',byStatus.archived)+")
a="function _goalValueLabel(g,v){"; assert a in s
s=s.replace(a,"function _fmtSecShort(sec){if(sec==null)return '—';sec=Math.round(sec);var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),x=sec%60;return h?h+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'):m+':'+String(x).padStart(2,'0');}\n"+a)
# Status-Buttons: fuer missed „Fortsetzen"? nein — Archivieren/Loeschen reichen; Erreicht-Button ausblenden bei missed
open(p,'w',encoding='utf-8').write(s)
d=open('locales/de.js',encoding='utf-8').read()
a="    'pf.rr_keine_passende_aktivitaet': 'Keine passende Aktivität mehr gefunden.',\n"; assert a in d
d=d.replace(a,a+"    'pf.rr_erreicht': 'Erreicht',\n    'pf.rr_verfehlt': 'Verfehlt',\n    'pf.rr_gefinisht': 'Gefinisht',\n    'pf.rr_wettkampf_erkannt': 'Wettkampf erkannt',\n    'pf.rr_uebernehmen': 'Übernehmen',\n")
open('locales/de.js','w',encoding='utf-8').write(d)
c=open('styles.css',encoding='utf-8').read()
a=".gmcard-notmain{border-style:dashed}\n"; assert a in c
c=c.replace(a,a+".gmc-rr{margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.gmc-rr-achieved{color:#43D693}.gmc-rr-missed{color:#EDB44E}.gmc-rr-match{color:#5AA0F0}\n")
open('styles.css','w',encoding='utf-8').write(c)
print('ok')
