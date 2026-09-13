/* B-13: nutzersichtbare Texte ueber t() (locales/de.js); eigener Wrapper-Name je Datei (profile.js fuehrt das globale T). */
var _issT = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };
/* ============================================================
   ORVIA — Issue Modules + Routine Engine  (Phase 3)
   Generisches Beschwerde-System (alle Körperregionen), additive
   Schicht über der bestehenden Knie-gestützten Readiness-Engine.
   Status, Verlauf, Routinen, Auto-Aktivierung, Warnsignale.
   Speicher: pro Tag in DB[date].issues[key] (0–10); Knie zusätzlich
   in morning.knee (für die Readiness-Engine).
   Keine medizinische Diagnose. Keine Heilversprechen.
   ============================================================ */
var ORVIA_DISCLAIMER='' + _issT('iss.orvia_ersetzt_keine_medizinische_diagnose') + '';

var ORVIA_MODULES={
  knee:{label:'Knie',icon:'pulse',
    routine:['' + _issT('iss.8_12_min_knie_stabilitaet') + '','Glute-Med-Aktivierung','Step-down-Kontrolle','Waden-/Fußroutine'],
    alternatives:['' + _issT('iss.bike_z2_statt_lauf_bei') + '','Schwimmen','Oberkörper-Kraft'],
    stop:'' + _issT('iss.schmerz_steigt_im_warm_up') + '',
    warn:['' + _issT('iss.starke_zunehmende_schmerzen') + '','Schwellung','' + _issT('iss.instabilitaet_wegknicken') + '','' + _issT('iss.schmerz_in_ruhe') + '']},
  back:{label:'Rücken',icon:'pulse',
    routine:['' + _issT('iss.8_min_ruecken_mobility') + '','' + _issT('iss.core_aktivierung_dead_bug_bird') + '','Hüftmobilität'],
    alternatives:['' + _issT('iss.kein_schweres_heben_bei_verschlechterung') + '','' + _issT('iss.spaziergang_lockeres_rad') + '','' + _issT('iss.schwimmen_kein_delfin') + ''],
    stop:'' + _issT('iss.schmerz_steigt_beim_hinge_deadlift') + '',
    warn:['' + _issT('iss.ausstrahlung_ins_bein') + '','' + _issT('iss.taubheit_kribbeln') + '','' + _issT('iss.schmerz_in_ruhe') + '','' + _issT('iss.schmerz_nach_sturz') + '']},
  shoulder:{label:'Schulter',icon:'pulse',
    routine:['' + _issT('iss.band_external_rotations') + '','Scapula-Control','' + _issT('iss.leichte_mobility') + ''],
    alternatives:['' + _issT('iss.kein_schweres_ueberkopfdruecken_bei_schmerz') + '','Unterkörper-Fokus','' + _issT('iss.zuguebungen_wenn_schmerzfrei') + ''],
    stop:'' + _issT('iss.schmerz_beim_druecken_oder_ueber') + '',
    warn:['Kraftverlust','' + _issT('iss.naechtlicher_schmerz') + '','' + _issT('iss.instabilitaet_nach_sturz') + '']},
  hip:{label:'Hüfte',icon:'pulse',
    routine:['' + _issT('iss.hueftmobilitaet_90_90') + '','Glute-Aktivierung','Adduktoren-/Abduktoren-Arbeit'],
    alternatives:['' + _issT('iss.bike_statt_lauf_bei_schmerz') + '','Schwimmen','Mobility-Fokus'],
    stop:'' + _issT('iss.stechender_schmerz_in_der_leiste') + '',
    warn:['Blockadegefühl','Ausstrahlung','' + _issT('iss.schmerz_in_ruhe') + '']},
  ankle:{label:'Sprunggelenk',icon:'pulse',
    routine:['Dorsiflexion-Mobility','Single-Leg-Balance','Wadenkräftigung'],
    alternatives:['' + _issT('iss.bike_schwimmen_statt_lauf') + '','Stabilitätsarbeit'],
    stop:'' + _issT('iss.schwellung_oder_instabilitaet_nicht_laufen') + '',
    warn:['Schwellung','Instabilität','' + _issT('iss.schmerz_nach_umknicken') + '']},
  shin:{label:'Schienbein',icon:'pulse',
    routine:['' + _issT('iss.wadendehnung_kraeftigung') + '','Fußmuskulatur','Lauftechnik-Cues'],
    alternatives:['' + _issT('iss.volumen_reduzieren') + '','Bike/Schwimmen','' + _issT('iss.weiche_untergruende') + ''],
    stop:'' + _issT('iss.punktueller_knochenschmerz_laufpause_abklaeren_lassen') + '',
    warn:['' + _issT('iss.punktueller_knochenschmerz') + '','' + _issT('iss.schmerz_in_ruhe') + '','' + _issT('iss.naechtlicher_schmerz') + '']},
  foot:{label:'Fuß',icon:'pulse',
    routine:['' + _issT('iss.fussmobilitaet_igelball') + '','' + _issT('iss.fusskraeftigung_towel_curls') + '','Wadenarbeit'],
    alternatives:['Bike/Schwimmen','' + _issT('iss.volumen_reduzieren') + ''],
    stop:'' + _issT('iss.morgendlicher_anlaufschmerz_steigt_laufvolumen_runter') + '',
    warn:['Schwellung','Taubheit','' + _issT('iss.schmerz_in_ruhe') + '']},
  neck:{label:'Nacken',icon:'pulse',
    routine:['Nacken-Mobility','Brustwirbelsäulen-Extension','Schulterblatt-Kontrolle'],
    alternatives:['' + _issT('iss.kein_schweres_ueberkopf_trap_loading') + '','' + _issT('iss.lockeres_cardio') + ''],
    stop:'' + _issT('iss.schmerz_mit_bewegungseinschraenkung_belastung_anpassen') + '',
    warn:['' + _issT('iss.ausstrahlung_in_arm') + '','Taubheit/Kribbeln','Schwindel']},
  elbow:{label:'Ellenbogen',icon:'pulse',
    routine:['Unterarm-Exzentrik','Mobility','' + _issT('iss.griffkraft_dosiert') + ''],
    alternatives:['' + _issT('iss.zug_druck_last_reduzieren') + '','Unterkörper-Fokus'],
    stop:'' + _issT('iss.schmerz_bei_griff_last_last') + '',
    warn:['Kraftverlust','Schwellung','Taubheit']},
  wrist:{label:'Handgelenk',icon:'pulse',
    routine:['Handgelenk-Mobility','Unterarm-Kräftigung','' + _issT('iss.neutrale_belastung') + ''],
    alternatives:['' + _issT('iss.stuetzuebungen_meiden') + '','Strap/Neutralgriff'],
    stop:'' + _issT('iss.schmerz_bei_stuetz_last_anpassen') + '',
    warn:['Schwellung','' + _issT('iss.instabilitaet_nach_sturz') + '','Taubheit']},
  fatigue:{label:'Müdigkeit',icon:'battery',
    routine:['' + _issT('iss.schlaf_priorisieren') + '','' + _issT('iss.z1_z2_statt_intensitaet') + '','' + _issT('iss.kurzer_spaziergang_licht') + ''],
    alternatives:['10-Minuten-Startregel','' + _issT('iss.volumen_halten_intensitaet_raus') + ''],
    stop:'' + _issT('iss.anhaltende_muedigkeit_trotz_schlaf_belastung') + '',
    warn:['Krankheitsgefühl','' + _issT('iss.ungewoehnlich_hoher_ruhepuls') + '','' + _issT('iss.anhaltende_erschoepfung') + '']},
  stress:{label:'Stress',icon:'heart',
    routine:['' + _issT('iss.5_min_atemroutine') + '','' + _issT('iss.niedrige_intensitaet') + '','Spaziergang','' + _issT('iss.schlaf_priorisieren') + ''],
    alternatives:['' + _issT('iss.easy_statt_qualitaet') + '','Mobility/Yoga'],
    stop:'' + _issT('iss.sehr_hoher_stress_schlechte_werte') + '',
    warn:['' + _issT('iss.anhaltende_ueberforderung') + '','' + _issT('iss.schlaf_stark_gestoert') + '','' + _issT('iss.koerperliche_symptome') + '']},
  sleep:{label:'Schlafprobleme',icon:'moon',
    routine:['Abendroutine','Koffein-Cutoff','' + _issT('iss.licht_screens_reduzieren') + '','' + _issT('iss.schlafziel_anzeigen') + ''],
    alternatives:['' + _issT('iss.kein_spaetes_training') + '',_issT('iss.intensitaet_unter_6h_vermeiden')],
    stop:_issT('iss.mehrere_naechte_unter_6h'),
    warn:['' + _issT('iss.anhaltende_schlaflosigkeit') + '','' + _issT('iss.tagesschlaefrigkeit_mit_risiko') + '']}
};

/* ---- Score-Quelle: Knie aus morning.knee, sonst entry.issues[key] ---- */
function issueScore(key,dayKey){
  var e=DB[dayKey];if(!e)return null;
  if(key==='knee')return (e.morning&&e.morning.knee!=null)?e.morning.knee:(e.issues&&e.issues.knee!=null?e.issues.knee:null);
  return (e.issues&&e.issues[key]!=null)?e.issues[key]:null;
}
function issueSeries(key,days){var a=[];for(var i=days-1;i>=0;i--){var v=issueScore(key,dkey(-i));if(v!=null)a.push({d:dkey(-i),v:v});}return a;}

/* ---- Statusmaschine ---- */
function moduleStatus(key){
  var s=issueSeries(key,21);
  if(!s.length)return{key:key,label:(ORVIA_MODULES[key]||{}).label||key,status:'kein',score:null,today:0,lastSignal:0,lastSignalDate:null,fromPast:false,streak:0};
  // HEUTIGEN Wert sauber von historischem trennen (kein „Warnsignal" trotz heute 0/10).
  var todayK=(typeof todayStr==='function')?todayStr():null;
  var lastEntry=s[s.length-1];
  var todayEntry=null;for(var j=0;j<s.length;j++){if(s[j].d===todayK){todayEntry=s[j];break;}}
  var hasTodayEntry=!!todayEntry;
  var todayVal=hasTodayEntry?todayEntry.v:0;
  var latestVal=lastEntry?lastEntry.v:0;
  var latestDate=lastEntry?lastEntry.d:null;
  var fromPastSignal=!hasTodayEntry&&latestVal>0;
  var zero=0;for(var i=s.length-1;i>=0;i--){if(s[i].v===0)zero++;else break;}
  // Status NUR aus dem heutigen Wert. Früheres Signal markiert (fromPast), aber nicht als aktive Warnung.
  var st;
  if(todayVal>=5)st='warn';
  else if(todayVal>=3)st='aktiv';
  else if(todayVal>=1)st='beobachten';
  else st=(zero>=14)?'praevention':(zero>=7)?'stabil':'ruhig';
  return{key:key,label:(ORVIA_MODULES[key]||{}).label||key,status:st,score:todayVal,today:todayVal,
         lastSignal:latestVal,lastSignalDate:latestDate,fromPast:fromPastSignal,streak:zero,series:s};
}
var STATUS_META={
  kein:{l:'' + _issT('iss.kein_thema') + '',c:'grey',adv:''},
  ruhig:{l:'Ruhig',c:'green',adv:'' + _issT('iss.beschwerdefrei_routine_optional') + ''},
  beobachten:{l:'Beobachten',c:'gold',adv:'' + _issT('iss.leichtes_signal_im_auge_behalten') + ''},
  aktiv:{l:'Aktiv',c:'gold',adv:'' + _issT('iss.belastung_anpassen_alternative_oder_reduzierte') + ''},
  warn:{l:'Warnsignal',c:'red',adv:'' + _issT('iss.training_stoppen_und_abklaeren_lassen') + ''},
  stabil:{l:'Stabil',c:'green',adv:'' + _issT('iss.seit_7_tagen_beschwerdefrei_weiter') + ''},
  praevention:{l:'Prävention',c:'green',adv:'' + _issT('iss.14_tage_stabil_modul_in') + ''}
};
function statusColorVar(c){return c==='green'?'var(--success)':c==='gold'?'var(--accent)':c==='red'?'var(--danger)':'var(--text-faint)';}

/* ---- aktive Module (aus Profil + allem, was geloggt wurde) ---- */
function moduleDismissed(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.dismissed)?PROFILE.dismissed:{};}
function lastPainDate(key){var s=issueSeries(key,21);for(var i=s.length-1;i>=0;i--){if(s[i].v>0)return s[i].d;}return null;}
function activeModuleKeys(){
  var dis=moduleDismissed();var set={};
  (((typeof PROFILE!=='undefined'&&PROFILE)?PROFILE.issues:[])||[]).forEach(function(k){if(ORVIA_MODULES[k])set[k]=1;});
  // Zuletzt geloggte Schmerzen einblenden — aber NICHT, wenn das Modul danach pausiert wurde
  Object.keys(ORVIA_MODULES).forEach(function(k){
    if(set[k])return;var lp=lastPainDate(k);if(lp&&(!dis[k]||lp>dis[k]))set[k]=1;
  });
  return Object.keys(set);
}
/* Module, die im täglichen Check-in abgefragt werden — langfristig stabile (Prävention) fallen raus */
function checkinIssueKeys(){return activeModuleKeys().filter(function(k){return moduleStatus(k).status!=='praevention';});}
function checkinIssuesHTML(m){
  var keys=checkinIssueKeys();if(!keys.length)return '';
  return keys.map(function(k){
    if(k==='knee')return slider('m_knee','' + _issT('iss.knie_schmerz_jetzt') + '',0,10,(m&&m.knee!=null?m.knee:0),'kein','max');
    var v=(DB[cur]&&DB[cur].issues&&DB[cur].issues[k]!=null)?DB[cur].issues[k]:0;
    return slider('m_iss_'+k,_issT('iss.label_jetzt', { label: (ORVIA_MODULES[k]||{}).label||k }),0,10,v,'kein','max');
  }).join('');
}
function gatherCheckinIssues(){
  var e=entry(cur);checkinIssueKeys().forEach(function(k){
    if(k==='knee')return;var el=document.getElementById('m_iss_'+k);if(!el)return;
    e.issues=e.issues||{};var val=+el.value;e.issues[k]=val;
    if(typeof PROFILE!=='undefined'&&PROFILE&&val>0){
      var wasNew=(PROFILE.issues||[]).indexOf(k)<0;
      if(PROFILE.dismissed)delete PROFILE.dismissed[k];
      if(wasNew)_issueConstraintSync(k,'ensure');   // H3: kanonischer Pfad (issues wird projiziert)
    }
  });
}

/* H3 (2026-07-11): PROFILE.issues ist eine PROJEKTION aus constraintsList (profile.js
   rekomputiert sie bei jedem _profileSave). Die frueheren Direkt-Writes hier umgingen
   den kanonischen Pfad (kein Cloud-Sync, Drift, Ueberschreib-Risiko). Jetzt: Modul-
   Aktivierung legt/reaktiviert ein Constraint, Pausieren setzt es auf 'observed' —
   alles ueber _profileSave(['constraints']) (Projektion + Event + Cloud inklusive). */
function _issueConstraintSync(key,action){
  try{
    if(typeof PROFILE==='undefined'||!PROFILE||typeof pmModel!=='function'||typeof _profileSave!=='function')return false;
    var M=pmModel();if(!M)return false;
    var list=Array.isArray(PROFILE.constraintsList)?PROFILE.constraintsList.slice():[];
    var idx=-1;for(var i=0;i<list.length;i++){if(list[i]&&list[i].bodyRegion===key){idx=i;break;}}
    if(action==='ensure'){
      if(idx>=0){
        if(list[idx].status==='active')return false;   // schon aktiv — kein Save-Sturm
        list[idx]=M.normalizeConstraint(Object.assign({},list[idx],{status:'active'}));
      }else{
        list.push(M.normalizeConstraint({bodyRegion:key,title:(typeof ORVIA_MODULES!=='undefined'&&ORVIA_MODULES[key]&&ORVIA_MODULES[key].label)||key,status:'active'}));
      }
    }else{ // 'pause'
      if(idx<0)return false;
      if(list[idx].status==='observed')return false;
      list[idx]=M.normalizeConstraint(Object.assign({},list[idx],{status:'observed'}));
    }
    PROFILE.constraintsList=list;
    _profileSave(['constraints']);
    return true;
  }catch(e){return false;}
}
/* ---- Logging + Auto-Aktivierung/-Deaktivierung ---- */
function logIssue(key,val){
  var e=entry(cur);if(!e.issues)e.issues={};
  e.issues[key]=val;
  if(key==='knee'){if(!e.morning)e.morning={};e.morning.knee=val;}
  if(typeof PROFILE!=='undefined'&&PROFILE&&val>0){
    var wasNew=(PROFILE.issues||[]).indexOf(key)<0;
    if(PROFILE.dismissed)delete PROFILE.dismissed[key];
    if(wasNew)_issueConstraintSync(key,'ensure');   // H3: kanonischer Pfad
  }
  save();
  renderModules();
  if(typeof renderReadiness==='function'&&key==='knee'){renderReadiness();renderAmpel();renderCommand();}
}
function removeModule(key){
  if(typeof PROFILE!=='undefined'&&PROFILE){
    PROFILE.dismissed=PROFILE.dismissed||{};PROFILE.dismissed[key]=todayStr();
    if(!_issueConstraintSync(key,'pause')){
      // Kein Constraint-Gegenstueck (reines Alt-Modul) → Projektion direkt bereinigen.
      PROFILE.issues=(PROFILE.issues||[]).filter(function(k){return k!==key;});
      if(typeof _profileSave==='function')_profileSave(['constraints']);else if(typeof saveProfile==='function')saveProfile();
    }
  }
  closeSupp();renderModules();
  if(typeof renderDay==='function')renderDay();   // Check-in neu aufbauen (Beschwerde ggf. raus)
  if(typeof toast==='function')toast('' + _issT('iss.modul_pausiert_aus_den_check') + '');
}

/* ---- Proaktive Nachfrage (Nutzerwunsch 2026-07-16): ≥7 Tage kein Signal ≥3/10 →
   ORVIA fragt VON SICH AUS, ob das Modul pausiert oder weiter unterstützt werden soll.
   Antwort wird gemerkt (PROFILE.issuePromptAsked[key]) — erneute Frage frühestens nach 14 Tagen.
   Nur für Module MIT Historie (mindestens ein Eintrag) — frisch aktivierte werden nicht sofort befragt. */
function daysSinceIssueSignal(key){
  var s=issueSeries(key,21);
  if(!s.length)return null;                        // keine Historie → keine Nachfrage
  var last=null;
  for(var i=s.length-1;i>=0;i--){if(s[i].v>=3){last=s[i].d;break;}}
  if(!last)return 21;                              // im 21-Tage-Fenster nie ≥3 → lange ruhig
  return Math.round((new Date(todayStr()+'T12:00')-new Date(last+'T12:00'))/864e5);
}
function issuePromptDue(key){
  var d=daysSinceIssueSignal(key);
  if(d==null||d<7)return false;
  try{
    var asked=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.issuePromptAsked&&PROFILE.issuePromptAsked[key])||null;
    if(asked&&Math.round((new Date(todayStr()+'T12:00')-new Date(asked+'T12:00'))/864e5)<14)return false;
  }catch(e){}
  return true;
}
function _issuePromptMark(key){
  try{if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.issuePromptAsked=PROFILE.issuePromptAsked||{};PROFILE.issuePromptAsked[key]=todayStr();if(typeof saveProfile==='function')saveProfile();}}catch(e){}
}
function issuePromptKeep(key){
  _issuePromptMark(key);renderModules();
  if(typeof toast==='function')toast('' + _issT('iss.alles_klar_orvia_behaelt_das') + '');
}
function issuePromptPause(key){
  _issuePromptMark(key);
  removeModule(key);   // bestehender Pfad: Constraint auf 'observed', aus Check-ins raus
}

/* ============ HOME: Aktive Module Card ============ */
function renderModules(){
  var el=document.getElementById('modules');if(!el)return;
  var keys=activeModuleKeys();
  if(!keys.length){el.innerHTML='';return;}
  var asks=keys.filter(issuePromptDue).map(function(k){
    var d=daysSinceIssueSignal(k),label=(ORVIA_MODULES[k]||{}).label||k;
    return '<div class="modadv" style="margin:10px 0 4px">' + _issT('iss.pause_frage', { seit: (d>=21 ? _issT('iss.ueber_3_wochen') : _issT('iss.n_tagen', { n: d })), label: '<b>'+escH(label)+'</b>' }) +
      '<div class="row2" style="margin-top:10px">'+
      '<button class="btn sec" onclick="issuePromptPause(\''+k+'\')">Pausieren</button>'+
      '<button class="btn sec" onclick="issuePromptKeep(\''+k+'\')">' + _issT('iss.weiter_unterstuetzen') + '</button></div></div>';
  }).join('');
  var rows=keys.map(function(k){
    var st=moduleStatus(k),meta=STATUS_META[st.status]||STATUS_META.kein;
    var sc=st.score!=null?st.score+'/10':'–';
    return '<button class="modrow" onclick="openModule(\''+k+'\')">'+
      '<span class="moddot" style="background:'+statusColorVar(meta.c)+'"></span>'+
      '<span class="modname">'+escH(st.label)+'</span>'+
      '<span class="modstatus">'+escH(meta.l)+'</span>'+
      '<span class="modscore">'+sc+'</span>'+
      '<span class="modchev">›</span></button>';
  }).join('');
  el.innerHTML='<div class="card"><h2><svg class="ic"><use href="#i-pulse"/></svg>' + _issT('iss.aktive_module') + '</h2>'+
    asks+rows+
    '<button class="btn sec modadd" onclick="openModulePicker()" style="margin-top:14px">'+ic('plus')+' ' + _issT('iss.beschwerde_erfassen') + '</button></div>';
}

/* ============ Modal: Beschwerde wählen ============ */
function openModulePicker(){
  var opts=Object.keys(ORVIA_MODULES).map(function(k){
    return '<button class="ob-chip" onclick="openModule(\''+k+'\')">'+escH(ORVIA_MODULES[k].label)+'</button>';}).join('');
  document.getElementById('suppSheet').innerHTML=
    '<div class="sheethead"><h2>' + _issT('iss.beschwerde_erfassen') + '</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>'+
    '<p class="muted" style="margin:2px 0 14px">' + _issT('iss.waehle_einen_bereich_orvia_aktiviert') + '</p>'+
    '<div class="ob-chips">'+opts+'</div>'+
    '<p class="ob-disc" style="margin-top:18px">'+ORVIA_DISCLAIMER+'</p>';
  document.getElementById('suppModal').classList.add('show');
}

/* ============ Modal: Modul-Detail ============ */
function openModule(key){
  var def=ORVIA_MODULES[key];if(!def)return;
  var st=moduleStatus(key),meta=STATUS_META[st.status]||STATUS_META.kein;
  var cur0=issueScore(key,cur);if(cur0==null)cur0=st.score!=null?st.score:0;
  var quick='';for(var i=0;i<=10;i++)quick+='<button class="qchip'+(i===cur0?' on':'')+'" onclick="logIssue(\''+key+'\','+i+');openModule(\''+key+'\')">'+i+'</button>';
  var spark=(st.series||[]).slice(-14).map(function(x){
    var c=x.v>=5?'var(--danger)':x.v>=3?'var(--accent)':x.v>=1?'var(--accent-soft)':'var(--success)';
    var h=Math.max(3,x.v*3.2);return '<span class="spk" style="height:'+h+'px;background:'+c+'" title="'+x.d+': '+x.v+'"></span>';}).join('');
  document.getElementById('suppSheet').innerHTML=
    '<div class="sheethead"><h2>'+escH(def.label)+'</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>'+
    '<div class="modstat"><span class="moddot" style="background:'+statusColorVar(meta.c)+'"></span><b>'+escH(meta.l)+'</b>'+
      (st.score!=null?'<span class="muted"> · aktuell '+st.score+'/10</span>':'')+'</div>'+
    (meta.adv?'<p class="modadv">'+escH(meta.adv)+'</p>':'')+
    '<div class="modlbl">' + _issT('iss.heute_eintragen_0_10') + '</div><div class="qrow">'+quick+'</div>'+
    (spark?'<div class="modlbl">' + _issT('iss.verlauf_14_tage') + '</div><div class="sparkrow">'+spark+'</div>':'')+
    '<div class="modlbl">' + _issT('iss.routine') + '</div><ul class="modlist">'+def.routine.map(function(r){return '<li>'+escH(r)+'</li>';}).join('')+'</ul>'+
    '<div class="modlbl">' + _issT('iss.alternativen') + '</div><ul class="modlist">'+def.alternatives.map(function(r){return '<li>'+escH(r)+'</li>';}).join('')+'</ul>'+
    '<div class="modlbl">' + _issT('iss.abbruchregel') + '</div><p class="modtext">'+escH(def.stop)+'</p>'+
    '<div class="modlbl">' + _issT('iss.warnsignale_aerztlich_abklaeren') + '</div><p class="modtext">'+def.warn.map(escH).join(' · ')+'</p>'+
    '<div class="modwarn">'+ORVIA_DISCLAIMER+'</div>'+
    '<div class="row2" style="margin-top:14px"><button class="btn sec" onclick="removeModule(\''+key+'\')">Modul pausieren</button>'+
      '<button class="btn sec" onclick="closeSupp()">' + _issT('iss.schliessen') + '</button></div>';
  document.getElementById('suppModal').classList.add('show');
}
