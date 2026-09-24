# ui.js: Wettkampf-Block im Plan-Kopf (Lauf-Zweig)
p='js/ui.js'; s=open(p,encoding='utf-8').read()
a="      '<div class=\"rh-phase\">' + _uiT('ui.phase_') + '<b>'+escH(phase)+'</b></div>'+_feasibilityLineHTML()+'</div>';\n    return;\n  }"; assert a in s
s=s.replace(a,"      '<div class=\"rh-phase\">' + _uiT('ui.phase_') + '<b>'+escH(phase)+'</b></div>'+_feasibilityLineHTML()+_raceResultBlockHTML(mg)+'</div>';\n    return;\n  }")
a="function renderRaceHeader(){"; assert a in s
s=s.replace(a,"""/* S1/E2 (12.09.2026): Wettkampfergebnis im Plan-Kopf. Drei Zustaende, alle aus echten Daten:
   (1) bestaetigtes Ergebnis am Ziel, (2) erkannte Aktivitaet am Renntag → Bestaetigen / Nicht mein Rennen,
   (3) Datum vorbei, nichts erkannt → Ergebnis eintragen. Sonst leer. */
function _raceMatchFor(g){try{var O=window.ORVIA;if(!O||!O.raceResult||!O.activityStore||!O.activityStore.listActivities)return null;return O.raceResult.match(g,O.activityStore.listActivities()||[],{isTombstoned:O.activityStore.isTombstoned||null});}catch(_){return null;}}
function _fmtSecHMS(sec){if(sec==null)return '—';var neg=sec<0;sec=Math.abs(Math.round(sec));var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),x=sec%60;return (neg?'−':'')+(h?h+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'):m+':'+String(x).padStart(2,'0'));}
function _raceResultBlockHTML(g){
  try{
    if(!g)return '';
    var r=g.result&&g.result.verdict?g.result:null;
    if(r){var v=r.verdict==='achieved'?_uiT('ui.rr_erreicht'):r.verdict==='missed'?_uiT('ui.rr_verfehlt'):_uiT('ui.rr_gefinisht');
      var dl=r.deltaSec!=null?(' · '+(r.deltaSec<=0?'−':'+')+_fmtSecHMS(Math.abs(r.deltaSec))):'';
      return '<div class="rh-race rh-race-'+escH(r.verdict)+'"><b>'+escH(v)+'</b> · '+escH(_fmtSecHMS(r.timeSec))+dl+' · '+escH(fmtDe(r.distanceKm))+' km</div>';}
    var m=_raceMatchFor(g);
    if(m){var vt=m.verdict==='achieved'?_uiT('ui.rr_ziel_erreicht_um'):m.verdict==='missed'?_uiT('ui.rr_ziel_verfehlt_um'):'';
      var delta=m.deltaSec!=null?(' '+_fmtSecHMS(Math.abs(m.deltaSec))):'';
      return '<div class="rh-race rh-race-match"><div class="rh-race-h">'+_uiT('ui.rr_wettkampf_erkannt')+'</div><div class="rh-race-t">'+escH(fmtDe(m.distanceKm))+' km · '+escH(_fmtSecHMS(m.timeSec))+(vt?' · '+escH(vt)+escH(delta):'')+'</div>'+
        '<div class="rh-race-acts"><button class="btn" onclick="goalConfirmResult(\\''+esc(g.id)+'\\',\\''+esc(m.activityId)+'\\')">'+_uiT('ui.rr_bestaetigen')+'</button><button class="btn sec" onclick="goalDismissRace(\\''+esc(g.id)+'\\',\\''+esc(m.activityId)+'\\')">'+_uiT('ui.rr_nicht_mein_rennen')+'</button></div></div>';}
    var O=window.ORVIA,pend=(O&&O.raceResult)?O.raceResult.pending(g,todayStr()):null;
    if(pend)return '<div class="rh-race rh-race-pending"><div class="rh-race-t">'+escH(_uiT('ui.rr_rennen_war_vor_n_tagen',{n:pend.daysSince}))+'</div><div class="rh-race-acts"><button class="btn sec" onclick="goalSetStatus(\\''+esc(g.id)+'\\',\\'achieved\\')">'+_uiT('ui.rr_erreicht')+'</button><button class="btn sec" onclick="goalSetStatus(\\''+esc(g.id)+'\\',\\'missed\\')">'+_uiT('ui.rr_verfehlt')+'</button><button class="btn sec" onclick="openGoalEditor(\\''+esc(g.id)+'\\')">'+_uiT('ui.rr_neu_terminieren')+'</button></div></div>';
    return '';
  }catch(_){return '';}
}
"""+a)
open(p,'w',encoding='utf-8').write(s)
# profile.js: Bestaetigen / Nicht mein Rennen
p='js/profile.js'; s=open(p,encoding='utf-8').read()
a="function goalSetStatus(id,st){"; assert a in s
s=s.replace(a,"""/* S1/E2 (12.09.2026): Wettkampfergebnis bestaetigen — setzt result + Status (achieved/missed) in EINEM Update;
   danach ist das Ziel nicht mehr aktiv, mainGoalOf() rueckt das naechste nach. */
function goalConfirmResult(goalId,activityId){
  try{
    var O=window.ORVIA,g=listGoals().filter(function(x){return x&&x.id===goalId;})[0];
    if(!g||!O||!O.raceResult||!O.activityStore)return;
    var m=O.raceResult.match(g,O.activityStore.listActivities()||[],{isTombstoned:O.activityStore.isTombstoned||null});
    if(!m||(activityId&&m.activityId!==String(activityId))){if(typeof toast==='function')toast(T('pf.rr_keine_passende_aktivitaet'));return;}
    var res=O.raceResult.toResult(m,new Date().toISOString());
    goalUpdate(goalId,{result:res,status:O.raceResult.statusFor(m)},'race_result');
    if(typeof toast==='function')toast(res.verdict==='achieved'?T('pf.rr_ziel_erreicht_gespeichert'):res.verdict==='missed'?T('pf.rr_ziel_verfehlt_gespeichert'):T('pf.rr_ergebnis_gespeichert'));
    try{_pbSyncFromActivities();}catch(e){}
    try{if(typeof renderRaceHeader==='function')renderRaceHeader();}catch(e){}
    try{if(document.getElementById('goalsMgrBody'))renderGoalsList();}catch(e){}
  }catch(e){}
}
function goalDismissRace(goalId,activityId){
  try{
    var g=listGoals().filter(function(x){return x&&x.id===goalId;})[0];if(!g)return;
    var prev=(g.result&&Array.isArray(g.result.dismissed))?g.result.dismissed.slice():[];
    if(prev.indexOf(String(activityId))<0)prev.push(String(activityId));
    goalUpdate(goalId,{result:{dismissed:prev}},'race_dismiss');
    try{if(typeof renderRaceHeader==='function')renderRaceHeader();}catch(e){}
    try{if(document.getElementById('goalsMgrBody'))renderGoalsList();}catch(e){}
  }catch(e){}
}
"""+a)
open(p,'w',encoding='utf-8').write(s)
# Katalog + CSS
d=open('locales/de.js',encoding='utf-8').read()
a="    'ui.countdown_heute': 'heute',\n"; assert a in d
d=d.replace(a,a+"""    'ui.rr_wettkampf_erkannt': 'Wettkampf erkannt',
    'ui.rr_erreicht': 'Erreicht',
    'ui.rr_verfehlt': 'Verfehlt',
    'ui.rr_gefinisht': 'Gefinisht',
    'ui.rr_ziel_erreicht_um': 'Ziel erreicht, schneller um',
    'ui.rr_ziel_verfehlt_um': 'Ziel verfehlt um',
    'ui.rr_bestaetigen': 'Als Ergebnis übernehmen',
    'ui.rr_nicht_mein_rennen': 'Nicht mein Rennen',
    'ui.rr_rennen_war_vor_n_tagen': 'Das Rennen war vor {n} Tagen — keine passende Aktivität gefunden. Wie ist es gelaufen?',
    'ui.rr_neu_terminieren': 'Neu terminieren',
""")
a="    'pf.abbrechen': 'Abbrechen',\n"; assert a in d
d=d.replace(a,a+"""    'pf.rr_keine_passende_aktivitaet': 'Keine passende Aktivität mehr gefunden.',
    'pf.rr_ziel_erreicht_gespeichert': 'Ziel erreicht — Ergebnis gespeichert.',
    'pf.rr_ziel_verfehlt_gespeichert': 'Ergebnis gespeichert — Ziel verfehlt.',
    'pf.rr_ergebnis_gespeichert': 'Ergebnis gespeichert.',
""")
open('locales/de.js','w',encoding='utf-8').write(d)
c=open('styles.css',encoding='utf-8').read()
a=".rh-feas-warn{color:#fbbf24}\n"; assert a in c
c=c.replace(a,a+"""/* S1/E2: Wettkampfergebnis im Plan-Kopf */
.rh-race{margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.04);font-size:13px;line-height:1.4}
.rh-race-h{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:800;margin-bottom:4px}
.rh-race-t{color:var(--text)}
.rh-race-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.rh-race-acts .btn{padding:8px 12px;font-size:13px;margin:0}
.rh-race-achieved{border-color:rgba(67,214,147,.45);background:rgba(67,214,147,.10)}
.rh-race-missed{border-color:rgba(237,180,78,.45);background:rgba(237,180,78,.10)}
.rh-race-match{border-color:rgba(90,160,240,.45);background:rgba(90,160,240,.10)}
""")
open('styles.css','w',encoding='utf-8').write(c)
# index.html + sw.js
h=open('index.html',encoding='utf-8').read()
a='<script src="js/engine/pb-sync.js"></script>'; assert a in h
h=h.replace(a,'<script src="js/engine/race-result.js"></script>\n'+a)
open('index.html','w',encoding='utf-8').write(h)
w=open('sw.js',encoding='utf-8').read()
a="'./js/engine/pb-sync.js',"; assert a in w
w=w.replace(a,"'./js/engine/race-result.js',"+a)
open('sw.js','w',encoding='utf-8').write(w)
print('ok')
