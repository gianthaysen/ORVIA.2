/* ============================================================
   ORVIA — Issue Modules + Routine Engine  (Phase 3)
   Generisches Beschwerde-System (alle Körperregionen), additive
   Schicht über der bestehenden Knie-gestützten Readiness-Engine.
   Status, Verlauf, Routinen, Auto-Aktivierung, Warnsignale.
   Speicher: pro Tag in DB[date].issues[key] (0–10); Knie zusätzlich
   in morning.knee (für die Readiness-Engine).
   Keine medizinische Diagnose. Keine Heilversprechen.
   ============================================================ */
var ORVIA_DISCLAIMER='ORVIA ersetzt keine medizinische Diagnose oder Therapie. Bei starken, zunehmenden, anhaltenden oder unklaren Beschwerden eine medizinische Fachperson konsultieren.';

var ORVIA_MODULES={
  knee:{label:'Knie',icon:'pulse',
    routine:['8–12 min Knie-Stabilität','Glute-Med-Aktivierung','Step-down-Kontrolle','Waden-/Fußroutine'],
    alternatives:['Bike Z2 statt Lauf bei Schmerz > 2/10','Schwimmen','Oberkörper-Kraft'],
    stop:'Schmerz steigt im Warm-up → Lauf nicht empfohlen. Schmerz > 4/10 unter Belastung → abbrechen.',
    warn:['starke/zunehmende Schmerzen','Schwellung','Instabilität / Wegknicken','Schmerz in Ruhe']},
  back:{label:'Rücken',icon:'pulse',
    routine:['8 min Rücken-Mobility','Core-Aktivierung (Dead Bug, Bird Dog)','Hüftmobilität'],
    alternatives:['Kein schweres Heben bei Verschlechterung','Spaziergang / lockeres Rad','Schwimmen (kein Delfin)'],
    stop:'Schmerz steigt beim Hinge/Deadlift → Last reduzieren oder abbrechen.',
    warn:['Ausstrahlung ins Bein','Taubheit / Kribbeln','Schmerz in Ruhe','Schmerz nach Sturz']},
  shoulder:{label:'Schulter',icon:'pulse',
    routine:['Band External Rotations','Scapula-Control','leichte Mobility'],
    alternatives:['Kein schweres Überkopfdrücken bei Schmerz','Unterkörper-Fokus','Zugübungen wenn schmerzfrei'],
    stop:'Schmerz beim Drücken oder über Kopf → Last raus, Bewegung anpassen.',
    warn:['Kraftverlust','nächtlicher Schmerz','Instabilität nach Sturz']},
  hip:{label:'Hüfte',icon:'pulse',
    routine:['Hüftmobilität (90/90)','Glute-Aktivierung','Adduktoren-/Abduktoren-Arbeit'],
    alternatives:['Bike statt Lauf bei Schmerz','Schwimmen','Mobility-Fokus'],
    stop:'Stechender Schmerz in der Leiste/Hüfte → Belastung stoppen.',
    warn:['Blockadegefühl','Ausstrahlung','Schmerz in Ruhe']},
  ankle:{label:'Sprunggelenk',icon:'pulse',
    routine:['Dorsiflexion-Mobility','Single-Leg-Balance','Wadenkräftigung'],
    alternatives:['Bike/Schwimmen statt Lauf','Stabilitätsarbeit'],
    stop:'Schwellung oder Instabilität → nicht laufen.',
    warn:['Schwellung','Instabilität','Schmerz nach Umknicken']},
  shin:{label:'Schienbein',icon:'pulse',
    routine:['Wadendehnung & -kräftigung','Fußmuskulatur','Lauftechnik-Cues'],
    alternatives:['Volumen reduzieren','Bike/Schwimmen','weiche Untergründe'],
    stop:'Punktueller Knochenschmerz → Laufpause, abklären lassen.',
    warn:['punktueller Knochenschmerz','Schmerz in Ruhe','nächtlicher Schmerz']},
  foot:{label:'Fuß',icon:'pulse',
    routine:['Fußmobilität & Igelball','Fußkräftigung (Towel Curls)','Wadenarbeit'],
    alternatives:['Bike/Schwimmen','Volumen reduzieren'],
    stop:'Morgendlicher Anlaufschmerz steigt → Laufvolumen runter.',
    warn:['Schwellung','Taubheit','Schmerz in Ruhe']},
  neck:{label:'Nacken',icon:'pulse',
    routine:['Nacken-Mobility','Brustwirbelsäulen-Extension','Schulterblatt-Kontrolle'],
    alternatives:['Kein schweres Überkopf/Trap-Loading','lockeres Cardio'],
    stop:'Schmerz mit Bewegungseinschränkung → Belastung anpassen.',
    warn:['Ausstrahlung in Arm','Taubheit/Kribbeln','Schwindel']},
  elbow:{label:'Ellenbogen',icon:'pulse',
    routine:['Unterarm-Exzentrik','Mobility','Griffkraft dosiert'],
    alternatives:['Zug-/Druck-Last reduzieren','Unterkörper-Fokus'],
    stop:'Schmerz bei Griff/Last → Last reduzieren.',
    warn:['Kraftverlust','Schwellung','Taubheit']},
  wrist:{label:'Handgelenk',icon:'pulse',
    routine:['Handgelenk-Mobility','Unterarm-Kräftigung','neutrale Belastung'],
    alternatives:['Stützübungen meiden','Strap/Neutralgriff'],
    stop:'Schmerz bei Stütz/Last → anpassen.',
    warn:['Schwellung','Instabilität nach Sturz','Taubheit']},
  fatigue:{label:'Müdigkeit',icon:'battery',
    routine:['Schlaf priorisieren','Z1–Z2 statt Intensität','kurzer Spaziergang / Licht'],
    alternatives:['10-Minuten-Startregel','Volumen halten, Intensität raus'],
    stop:'Anhaltende Müdigkeit trotz Schlaf → Belastung reduzieren.',
    warn:['Krankheitsgefühl','ungewöhnlich hoher Ruhepuls','anhaltende Erschöpfung']},
  stress:{label:'Stress',icon:'heart',
    routine:['5-min Atemroutine','niedrige Intensität','Spaziergang','Schlaf priorisieren'],
    alternatives:['Easy statt Qualität','Mobility/Yoga'],
    stop:'Sehr hoher Stress + schlechte Werte → keine harte Einheit.',
    warn:['anhaltende Überforderung','Schlaf stark gestört','körperliche Symptome']},
  sleep:{label:'Schlafprobleme',icon:'moon',
    routine:['Abendroutine','Koffein-Cutoff','Licht/Screens reduzieren','Schlafziel anzeigen'],
    alternatives:['Kein spätes Training','Intensität bei < 6 h vermeiden'],
    stop:'Mehrere Nächte < 6 h → keine Intensität, Erholung priorisieren.',
    warn:['anhaltende Schlaflosigkeit','Tagesschläfrigkeit mit Risiko']}
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
  kein:{l:'Kein Thema',c:'grey',adv:''},
  ruhig:{l:'Ruhig',c:'green',adv:'Beschwerdefrei — Routine optional.'},
  beobachten:{l:'Beobachten',c:'gold',adv:'Leichtes Signal — im Auge behalten, Routine sinnvoll.'},
  aktiv:{l:'Aktiv',c:'gold',adv:'Belastung anpassen — Alternative oder reduzierte Einheit.'},
  warn:{l:'Warnsignal',c:'red',adv:'Training stoppen und abklären lassen.'},
  stabil:{l:'Stabil',c:'green',adv:'Seit 7+ Tagen beschwerdefrei — weiter beobachten.'},
  praevention:{l:'Prävention',c:'green',adv:'14+ Tage stabil — Modul in Prävention, Routine optional.'}
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
    if(k==='knee')return slider('m_knee','Knie-Schmerz JETZT',0,10,(m&&m.knee!=null?m.knee:0),'kein','max');
    var v=(DB[cur]&&DB[cur].issues&&DB[cur].issues[k]!=null)?DB[cur].issues[k]:0;
    return slider('m_iss_'+k,((ORVIA_MODULES[k]||{}).label||k)+' JETZT',0,10,v,'kein','max');
  }).join('');
}
function gatherCheckinIssues(){
  var e=entry(cur);checkinIssueKeys().forEach(function(k){
    if(k==='knee')return;var el=document.getElementById('m_iss_'+k);if(!el)return;
    e.issues=e.issues||{};var val=+el.value;e.issues[k]=val;
    if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.issues=PROFILE.issues||[];
      if(val>0){if(PROFILE.issues.indexOf(k)<0)PROFILE.issues.push(k);if(PROFILE.dismissed)delete PROFILE.dismissed[k];saveProfile();}}
  });
}

/* ---- Logging + Auto-Aktivierung/-Deaktivierung ---- */
function logIssue(key,val){
  var e=entry(cur);if(!e.issues)e.issues={};
  e.issues[key]=val;
  if(key==='knee'){if(!e.morning)e.morning={};e.morning.knee=val;}
  if(typeof PROFILE!=='undefined'&&PROFILE){
    PROFILE.issues=PROFILE.issues||[];
    if(val>0){if(PROFILE.issues.indexOf(key)<0)PROFILE.issues.push(key);if(PROFILE.dismissed)delete PROFILE.dismissed[key];saveProfile();}
  }
  save();
  renderModules();
  if(typeof renderReadiness==='function'&&key==='knee'){renderReadiness();renderAmpel();renderCommand();}
}
function removeModule(key){
  if(typeof PROFILE!=='undefined'&&PROFILE){
    PROFILE.issues=(PROFILE.issues||[]).filter(function(k){return k!==key;});
    PROFILE.dismissed=PROFILE.dismissed||{};PROFILE.dismissed[key]=todayStr();
    saveProfile();
  }
  closeSupp();renderModules();
  if(typeof renderDay==='function')renderDay();   // Check-in neu aufbauen (Beschwerde ggf. raus)
  if(typeof toast==='function')toast('Modul pausiert — aus den Check-ins entfernt');
}

/* ============ HOME: Aktive Module Card ============ */
function renderModules(){
  var el=document.getElementById('modules');if(!el)return;
  var keys=activeModuleKeys();
  if(!keys.length){el.innerHTML='';return;}
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
  el.innerHTML='<div class="card"><h2><svg class="ic"><use href="#i-pulse"/></svg>Aktive Module</h2>'+
    rows+
    '<button class="btn sec modadd" onclick="openModulePicker()" style="margin-top:14px">'+ic('plus')+' Beschwerde erfassen</button></div>';
}

/* ============ Modal: Beschwerde wählen ============ */
function openModulePicker(){
  var opts=Object.keys(ORVIA_MODULES).map(function(k){
    return '<button class="ob-chip" onclick="openModule(\''+k+'\')">'+escH(ORVIA_MODULES[k].label)+'</button>';}).join('');
  document.getElementById('suppSheet').innerHTML=
    '<div class="sheethead"><h2>Beschwerde erfassen</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>'+
    '<p class="muted" style="margin:2px 0 14px">Wähle einen Bereich. ORVIA aktiviert das passende Modul mit Routine & Regeln.</p>'+
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
    '<div class="modlbl">Heute eintragen (0–10)</div><div class="qrow">'+quick+'</div>'+
    (spark?'<div class="modlbl">Verlauf (14 Tage)</div><div class="sparkrow">'+spark+'</div>':'')+
    '<div class="modlbl">Routine</div><ul class="modlist">'+def.routine.map(function(r){return '<li>'+escH(r)+'</li>';}).join('')+'</ul>'+
    '<div class="modlbl">Alternativen</div><ul class="modlist">'+def.alternatives.map(function(r){return '<li>'+escH(r)+'</li>';}).join('')+'</ul>'+
    '<div class="modlbl">Abbruchregel</div><p class="modtext">'+escH(def.stop)+'</p>'+
    '<div class="modlbl">Warnsignale → ärztlich abklären</div><p class="modtext">'+def.warn.map(escH).join(' · ')+'</p>'+
    '<div class="modwarn">'+ORVIA_DISCLAIMER+'</div>'+
    '<div class="row2" style="margin-top:14px"><button class="btn sec" onclick="removeModule(\''+key+'\')">Modul pausieren</button>'+
      '<button class="btn sec" onclick="closeSupp()">Schließen</button></div>';
  document.getElementById('suppModal').classList.add('show');
}
