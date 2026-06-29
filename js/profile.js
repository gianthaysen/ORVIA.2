/* ============================================================
   ORVIA — User Profile + Onboarding  (Phase 2)
   Individualisierbares Datenmodell, entkoppelt von einer Person.
   Speicher: localStorage 'orvia_profile_v1'. Liefert window.PROFILE.
   ============================================================ */
var PROFILE_KEY='orvia_profile_v1';
/* Defaults = lauffähiger Startzustand (für Bestandsnutzer), voll editierbar */
/* Neutrale Vorgaben für NEUE Accounts. Bestandsnutzer laden ihr echtes Profil aus der Cloud. */
var PROFILE_DEFAULTS={
  v:1, onboarded:false,
  name:'', location:'', age:null, birthDate:'', ageEstimate:null, sex:'', timezone:null,
  weightKg:70, heightCm:175, hfMax:null, rhrBaseline:null, hfMaxMeasured:null, restingHrMeasured:null, sleepGoalH:null,
  primaryGoal:'health', primaryGoalLabel:'Allgemeine Gesundheit',
  raceName:'', raceDate:'', hmTargetMin:null,
  secondaryGoals:[], avatar:'', goal:null, nutrition:null, gear:[], customExercises:[], weekPlan:null, pauses:[], hideAnkle:false, trainingDays:null, adaptationMode:'assisted', riskTolerance:'balanced', checkinMode:'full', cycle:null, gymDays:null,
  sports:[], level:'fortgeschritten',
  weeklyKm:null, longestRunKm:null,
  typicalRunKm:null, recentRunsPerWeek:null, sessionMinutes:null, fixedEvents:[], planAdjustments:[],
  recoveryFocus:'', nutritionFocus:'',
  issues:[], equipment:[],
  dataSources:['Manuell'], coachingIntensity:'ausgewogen'
};
var PROFILE=null;
function loadProfile(){try{var p=JSON.parse(localStorage.getItem(PROFILE_KEY));if(p&&p.v)return Object.assign({},PROFILE_DEFAULTS,p);}catch(e){}return null;}
function saveProfile(){try{localStorage.setItem(PROFILE_KEY,JSON.stringify(PROFILE));}catch(e){}try{if(window.ORVIA_onSave)window.ORVIA_onSave();}catch(_){/* Cloud-Sync optional */}}
function ensureProfile(){
  var existed=!!localStorage.getItem(PROFILE_KEY);
  PROFILE=loadProfile()||Object.assign({},PROFILE_DEFAULTS);
  if(!existed)saveProfile();
  return existed;
}
function escH(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function countDays(){try{return Object.keys(DB).filter(isDay).length;}catch(e){return 0;}}
function dataQualityLabel(n){return n>=21?{l:'stabil',c:'g'}:n>=8?{l:'brauchbare Trends',c:'g'}:n>=4?{l:'erste Muster',c:'y'}:{l:'unsicher',c:'r'};}

/* ---- Labels ---- */
var GOAL_LABELS={halfmarathon:'Halbmarathon',marathon:'Marathon',fast5k:'5 km schneller',fast10k:'10 km schneller',
  triathlon:'Triathlon',ironman:'Ironman',muscle:'Muskelaufbau',fatloss:'Körperfett reduzieren',health:'Allgemeine Gesundheit',
  recovery:'Bessere Regeneration',back:'Rücken stabilisieren',painfree:'Schmerzfrei trainieren',comeback:'Wiedereinstieg',
  stress:'Stressmanagement',sleep:'Schlaf verbessern'};
var ISSUE_LABELS={knee:'Knie',back:'Rücken',shoulder:'Schulter',hip:'Hüfte',ankle:'Sprunggelenk',shin:'Schienbein',
  foot:'Fuß',neck:'Nacken',elbow:'Ellenbogen',wrist:'Handgelenk',fatigue:'Müdigkeit',stress:'Stress',sleep:'Schlafprobleme'};
var COACH_LABELS={sanft:'Sanft',ausgewogen:'Ausgewogen',praezise:'Präzise & direkt',daten:'Maximal datengetrieben'};
var LEVEL_LABELS={anfaenger:'Anfänger',wiedereinstieg:'Wiedereinstieg',fortgeschritten:'Fortgeschritten',leistung:'Leistungsorientiert',profi:'Profi'};

/* ============ PROFILSEITE RENDERN ============ */
/* ===== Equipment: km-Tracking, Aktivitäts-Zuordnung, Inspektions-Warnung ===== */
function gearEnsureIds(){
  var ch=false,gear=(PROFILE&&PROFILE.gear)||[];
  gear.forEach(function(g){if(!g.id){g.id='g'+(g.since||'')+'_'+Math.random().toString(36).slice(2,7);ch=true;}});
  if(ch&&typeof saveProfile==='function')saveProfile();
}
function gearKm(g){
  var key=g.type==='bike'?'Rad':'Laufen';
  var sameType=((PROFILE&&PROFILE.gear)||[]).filter(function(x){return x.type===g.type;});
  var sole=sameType.length<=1;
  var sum=g.startKm||0;
  try{Object.keys(DB).filter(isDay).forEach(function(k){var s=DB[k].sessions;if(!s||!s[key]||!s[key].dist)return;
    var gid=s[key].gearId;
    if(gid&&gid===g.id)sum+=s[key].dist;
    else if(!gid&&sole){if(!g.since||k>=g.since)sum+=s[key].dist;}
  });}catch(e){}
  return Math.round(sum);
}
function renderEquipment(){
  var el=document.getElementById('equipmentBox');if(!el)return;
  gearEnsureIds();
  var gear=(PROFILE&&PROFILE.gear)||[];
  var rows=gear.map(function(g,i){
    var km=gearKm(g),icn=g.type==='bike'?'bike':'run';
    var head='<div class="eq-top"><span class="eq-n"><svg class="ic"><use href="#i-'+icn+'"/></svg>'+escH(g.name)+'</span><button class="eq-x" onclick="delGear('+i+')" aria-label="Entfernen">✕</button></div>';
    if(g.limitKm){
      var pct=Math.min(100,Math.round(km/g.limitKm*100));var c=pct>=90?'r':pct>=75?'y':'g';
      var warn=pct>=100?'<div class="eq-warn eq-warn-r">Wechsel überfällig — '+km+' / '+g.limitKm+' km</div>':(pct>=90?'<div class="eq-warn eq-warn-y">Bald Wechsel / Inspektion fällig</div>':'');
      return '<div class="eq">'+head+'<div class="eq-meta"><span class="eq-km">'+km+' / '+g.limitKm+' km</span><span class="eq-pct">'+pct+'%</span></div>'+
        '<div class="goalbar"><i class="eqbar eqbar-'+c+'" style="width:'+pct+'%"></i></div>'+warn+'</div>';
    }
    return '<div class="eq">'+head+'<div class="eq-meta"><span class="eq-km eq-counter">'+km+' km</span><span class="eq-pct">Zähler</span></div></div>';
  }).join('');
  el.innerHTML=(rows||'<p class="muted" style="margin:0 0 8px">Noch kein Equipment. Lege Schuhe oder Rad an — beim Lauf/Rad wählst du sie aus, ORVIA zählt die km automatisch.</p>')+
    '<button class="btn sec" style="margin-top:10px" onclick="addGearPrompt()">+ Equipment hinzufügen</button>';
}
function addGearPrompt(){
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Equipment hinzufügen</h3>'+
    '<div class="gm-field"><label>Name</label><input id="gear_n" type="text" placeholder="z. B. Nike Vomero 18"></div>'+
    '<div class="gm-field"><label>Typ</label><div class="gm-chips" id="gear_t"><button type="button" class="gm-chip on" data-v="shoe" onclick="gearTypePick(this)">Schuhe</button><button type="button" class="gm-chip" data-v="bike" onclick="gearTypePick(this)">Rad</button></div></div>'+
    '<div class="gm-field"><label>Bereits gelaufen / gefahren (km, optional)</label><input id="gear_s" type="number" inputmode="numeric" placeholder="0"></div>'+
    '<div class="gm-field"><label>Wechsel-Limit (km) — leer = nur Zähler</label><input id="gear_l" type="number" inputmode="numeric" placeholder="800"></div>'+
    '<button class="btn" onclick="saveGear()">Hinzufügen</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeGear()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._gearModal=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closeGear();});
}
function gearTypePick(btn){gmPick(btn,'gear_t');var l=document.getElementById('gear_l');if(l&&!l.value)l.placeholder=(btn.dataset.v==='bike'?'leer = Zähler':'800');}
function closeGear(){if(window._gearModal){try{window._gearModal.remove();}catch(e){}window._gearModal=null;}}
function saveGear(){
  if(!PROFILE&&typeof ensureProfile==='function')ensureProfile();
  var nEl=document.getElementById('gear_n');var n=(nEl?nEl.value:'').trim();if(!n){if(typeof toast==='function')toast('Name fehlt');return;}
  var td=(document.querySelector('#gear_t .on')||{}).dataset;var t=td?td.v:'shoe';
  var sk=parseFloat(((document.getElementById('gear_s')||{}).value||'').replace(',','.'));if(isNaN(sk)||sk<0)sk=0;
  var l=parseInt(((document.getElementById('gear_l')||{}).value),10);if(isNaN(l)||l<=0)l=null;
  PROFILE.gear=PROFILE.gear||[];PROFILE.gear.push({id:'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:n,type:t,limitKm:l,startKm:sk,since:(typeof todayStr==='function'?todayStr():'')});
  if(typeof saveProfile==='function')saveProfile();closeGear();renderEquipment();if(typeof toast==='function')toast('Equipment hinzugefügt ✓');
}
function delGear(i){if(PROFILE&&PROFILE.gear){PROFILE.gear.splice(i,1);if(typeof saveProfile==='function')saveProfile();renderEquipment();}}
function gearName(id){if(!id||!PROFILE||!PROFILE.gear)return null;var g=PROFILE.gear.filter(function(x){return x.id===id;})[0];return g?g.name:null;}
function changeProfilePhoto(){
  if(!PROFILE&&typeof ensureProfile==='function')ensureProfile();
  var inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=function(){var f=inp.files&&inp.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(e){var img=new Image();img.onload=function(){
      var src=Math.min(img.width,img.height),side=Math.min(src,240),sx=(img.width-src)/2,sy=(img.height-src)/2;
      var cv=document.createElement('canvas');cv.width=side;cv.height=side;cv.getContext('2d').drawImage(img,sx,sy,src,src,0,0,side,side);
      try{PROFILE.avatar=cv.toDataURL('image/jpeg',0.82);}catch(_){if(typeof toast==='function')toast('Foto konnte nicht verarbeitet werden');return;}
      if(typeof saveProfile==='function')saveProfile();
      if(typeof renderProfileScreen==='function')renderProfileScreen();
      if(typeof renderTopAvatar==='function')renderTopAvatar();
      if(typeof toast==='function')toast('Foto aktualisiert ✓');
    };img.src=e.target.result;};r.readAsDataURL(f);};
  inp.click();
}
function renderProfileScreen(){
  if(!PROFILE)ensureProfile();
  var p=PROFILE,el=document.getElementById('profileCard');if(!el)return;
  var initial=((p.name||'O').trim()[0]||'O').toUpperCase();
  var sub=[p.location,p.age?p.age+' Jahre':'',p.weightKg?p.weightKg+' kg':'',p.hfMax?'HFmax '+p.hfMax:''].filter(Boolean).join(' · ');
  ensureProfileGoals();
  var ava=p.avatar?'<img src="'+escH(p.avatar)+'" alt="">':escH(initial);
  el.innerHTML='<div class="profhead"><div class="avatar" onclick="changeProfilePhoto()" title="Foto ändern">'+ava+'</div>'+
    '<div class="profmeta"><div class="profname">'+escH(p.name||'Athlet')+'</div><div class="profsub">'+escH(sub)+'</div></div>'+
    '<button class="editbtn" onclick="ORVIA.openProfileEditor()" aria-label="Profil bearbeiten"><svg class="ic"><use href="#i-gear"/></svg></button></div>'+
    goalsSummaryHTML()+
    '<button class="btn sec" style="margin-top:10px" onclick="openGoalsManager()">Ziele verwalten</button>'+
    '<button class="btn sec" style="margin-top:8px" onclick="openProfileManager()">Profil verwalten</button>'+
    '<button class="btn sec" style="margin-top:8px" onclick="openProfileSummary()">Profil-Übersicht</button>';
  var pi=document.getElementById('perfIdentity');if(pi)pi.innerHTML=identityRows(p);
  renderZones();
}
/* ============================================================
   Mehrziel-Adapter: PROFILE ↔ profile-model (goals[] authoritative, Legacy-Projektion kompatibel).
   ============================================================ */
function gmToggle(btn){btn.classList.toggle('on');}   // Multi-Select-Chip (Sportarten/Fokus)
function pmModel(){return window.ORVIA&&ORVIA.profileModel;}
function ensureProfileGoals(){var M=pmModel();if(!M||!PROFILE)return;
  if(!Array.isArray(PROFILE.goals)){var mig=M.migrateProfile(PROFILE);PROFILE.goals=mig.goals;PROFILE.profileVersion=2;}
  else PROFILE.goals=M.normalizeGoals(PROFILE.goals);
  applyLegacyProjection();}
function applyLegacyProjection(){var M=pmModel();if(!M||!PROFILE)return;var pr=M.buildLegacyProjection(PROFILE);
  PROFILE.primaryGoal=pr.primaryGoal;PROFILE.primaryGoalLabel=pr.primaryGoalLabel;PROFILE.secondaryGoals=pr.secondaryGoals;
  if(pr.raceDate)PROFILE.raceDate=pr.raceDate;if(pr.hmTargetMin!=null)PROFILE.hmTargetMin=pr.hmTargetMin;}
function listGoals(){ensureProfileGoals();return PROFILE.goals||[];}
// Persistiert goals[] atomar + Legacy-Projektion. Plan-Impact läuft separat über maybePlanImpact (gebündelt).
function commitGoals(ng){PROFILE.goals=ng;applyLegacyProjection();PROFILE.updatedAt=new Date().toISOString();
  if(typeof save==='function')save();else saveProfile();
  try{renderProfileScreen();}catch(e){} try{if(window._goalsMgr)renderGoalsList();}catch(e){}}
function goalAdd(input,reason){commitGoals(pmModel().addGoal(listGoals(),input));}
function goalUpdate(id,patch,reason){commitGoals(pmModel().updateGoal(listGoals(),id,patch));}
function goalRemove(id){commitGoals(pmModel().removeGoal(listGoals(),id));}
function goalSetStatus(id,st){commitGoals(pmModel().setGoalStatus(listGoals(),id,st));}
/* ---- Profil-Zusammenfassung (Rollen, keine IDs/Kategorien) ---- */
var GOAL_ROLE_DE={main:'Hauptziel',secondary:'Sekundäres Ziel',maintain:'Erhaltungsziel',longterm:'Langfristig'};
function goalsSummaryHTML(){var M=pmModel();if(!M)return '';var act=listGoals().filter(function(g){return g.status==='active';}).slice().sort(function(a,b){return a.priority-b.priority;});
  if(!act.length)return '<p class="note" style="text-align:left;margin-top:8px">Noch keine Ziele. Lege dein erstes Ziel an.</p>';
  return '<div class="goalchips">'+act.slice(0,4).map(function(g){return '<span class="goalchip">'+escH((GOAL_ROLE_DE[M.roleOfGoal(g)]||'Ziel')+': '+g.title)+'</span>';}).join('')+'</div>';}
function goalChip(p){
  var lbl=p.primaryGoalLabel||GOAL_LABELS[p.primaryGoal]||'Ziel';
  if(p.primaryGoal==='halfmarathon'&&p.hmTargetMin)lbl='HM <'+fmtH(p.hmTargetMin)+(p.raceDate?' · '+shortDate(p.raceDate):'');
  return lbl;
}
function fmtH(min){var h=Math.floor(min/60),m=min%60;return h+':'+String(m).padStart(2,'0');}
function shortDate(s){try{return new Date(s+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});}catch(e){return s;}}
function identityRows(p){
  var n=countDays(),dq=dataQualityLabel(n);
  var modules=(p.issues||[]).filter(function(k){return k!=='none';}).map(function(k){return ISSUE_LABELS[k]||k;});
  var rows=[
    ['Current Focus',p.primaryGoalLabel||GOAL_LABELS[p.primaryGoal]||'—'],
    ['Long-term Direction',(p.secondaryGoals&&p.secondaryGoals.length)?p.secondaryGoals[p.secondaryGoals.length-1]:'—'],
    ['Training Style',COACH_LABELS[p.coachingIntensity]||'—'],
    ['Level',LEVEL_LABELS[p.level]||'—'],
    ['Active Modules',modules.length?modules.join(', '):'keine'],
    ['Data Quality','<span class="dq dq-'+dq.c+'">'+n+' Tage · '+dq.l+'</span>'],
    ['Connected Sources',(p.dataSources||[]).join(', ')||'—']
  ];
  return rows.map(function(r){return '<div class="idrow"><span class="idk">'+escH(r[0])+'</span><span class="idv">'+r[1]+'</span></div>';}).join('');
}
function renderZones(){
  var el=document.getElementById('zoneList');if(!el)return;
  var _age=(PROFILE&&PROFILE.age)||null;
  // Gemessene HFmax gewinnt. Sonst altersbasierte Tanaka-Formel (nur lokaler Rechenwert,
  // wird NICHT persistiert). Fehlen beide → keine Zonen, neutraler Hinweis. KEIN 190/201.
  var measured=(PROFILE&&PROFILE.hfMaxMeasured!=null)?PROFILE.hfMaxMeasured:null;
  var calculated=_age?Math.round(208-0.7*_age):null;
  var max=measured||calculated;
  if(!max){
    el.innerHTML='<div class="zone-empty">Für Herzfrequenzzonen fehlen Alter oder gemessene HFmax.</div>';
    var he=document.getElementById('zoneTitle');if(he)he.textContent='HR-Zonen · noch nicht verfügbar';
    return;
  }
  var z=[['Z1 Recovery',.51,.61,'#e7cf9a','rgba(216,183,119,.35)'],['Z2 Easy',.61,.72,'#4ade80','rgba(52,211,153,.35)'],
    ['Z3 Tempo',.72,.82,'#fbbf24','rgba(251,191,36,.35)'],['Z4 Threshold',.82,.92,'#fb923c','rgba(251,146,60,.4)'],
    ['Z5 Max',.92,1,'#fb7185','rgba(251,77,109,.4)']];
  el.innerHTML=z.map(function(x){return '<div class="zone" style="border-color:'+x[4]+';color:'+x[3]+'">'+x[0]+'<span>'+Math.round(x[1]*max)+'–'+Math.round(x[2]*max)+'</span></div>';}).join('');
  var h=document.getElementById('zoneTitle');if(h)h.textContent='HR-Zonen · Max '+max;
}

/* ============ ONBOARDING ============ */
var OB_STEPS=[
  {t:'welcome'},
  {t:'choice',key:'primaryGoal',title:'Was ist dein Hauptziel?',sub:'Steuert Empfehlungen, Forecast und Plan.',
   opts:[['halfmarathon','Halbmarathon'],['marathon','Marathon'],['fast5k','5 km schneller'],['fast10k','10 km schneller'],
    ['triathlon','Triathlon'],['ironman','Ironman'],['muscle','Muskelaufbau'],['fatloss','Körperfett reduzieren'],
    ['health','Allgemeine Gesundheit'],['recovery','Bessere Regeneration'],['back','Rücken stabilisieren'],
    ['painfree','Schmerzfrei trainieren'],['comeback','Wiedereinstieg'],['stress','Stressmanagement'],['sleep','Schlaf verbessern']]},
  {t:'goals',title:'Weitere Ziele',sub:'Optional. Beliebig viele — z. B. „Marathon Herbst 26" oder „10 kg abnehmen".'},
  {t:'multi',key:'sports',title:'Welche Sportarten machst du?',
   opts:[['Laufen'],['Rad'],['Schwimmen'],['Gym'],['Mobilität'],['Yoga'],['Wandern']]},
  {t:'choice',key:'level',title:'Dein aktuelles Niveau?',
   opts:[['anfaenger','Anfänger'],['fortgeschritten','Fortgeschritten'],['profi','Profi']]},
  {t:'choice',key:'trainingDays',title:'Wie viele Tage pro Woche willst du trainieren?',sub:'Das ist die Gesamtzahl der Trainingstage — ORVIA plant nie mehr.',
   opts:[['2','2 Tage'],['3','3 Tage'],['4','4 Tage'],['5','5 Tage'],['6','6 Tage']]},
  {t:'choice',key:'gymDays',title:'Wie viele davon im Gym / Kraft?',sub:'Teilmenge deiner Trainingstage, keine zusätzlichen Einheiten.',
   opts:[['0','0'],['1','1'],['2','2'],['3','3'],['4','4']]},
  {t:'choice',key:'sessionMinutes',title:'Wie viel Zeit hast du pro Einheit?',
   opts:[['30','~30 min'],['45','~45 min'],['60','~60 min'],['90','90 min+']]},
  {t:'choice',key:'riskTolerance',title:'Wie willst du starten?',sub:'Steuert, wie schnell ORVIA Umfang & Intensität steigert.',
   opts:[['konservativ','Konservativ'],['ausgewogen','Ausgewogen'],['ambitioniert','Ambitioniert']]},
  {t:'fields',title:'Lauf-Erfahrung (optional)',sub:'Hilft ORVIA, einen realistischen Startumfang zu berechnen. Leer lassen ist ok — wir justieren nach echten Daten.',
   fields:[['typicalRunKm','Wie weit läufst du aktuell locker am Stück? (km)','number'],
    ['recentRunsPerWeek','Läufe pro Woche in den letzten 4 Wochen','number'],
    ['longestRunKm','Längster Lauf bisher (km)','number']]},
  {t:'fields',title:'Körper- & Basisdaten',sub:'Basis für Zonen, Baselines und Energiebedarf.',
   fields:[['name','Name','text'],['location','Ort','text'],['birthDate','Geburtsdatum','date'],
    ['age','Alter (falls kein Geburtsdatum)','number'],['weightKg','Gewicht (kg)','number'],
    ['heightCm','Größe (cm)','number'],['hfMax','HFmax (gemessen, optional)','number'],['rhrBaseline','Ruhepuls Ø (gemessen, optional)','number'],
    ['sleepGoalH','Schlafziel (h)','number']]},
  {t:'choice',key:'sex',title:'Biologische Berechnungsgrundlage',sub:'Nur für Grundumsatz & Energiebedarf. Trainingsentscheidungen basieren auf deinen Daten, deinem Ziel und deiner Tagesform.',
   opts:[['m','Männlich'],['f','Weiblich'],['d','Divers / keine Angabe']]},
  {t:'photo',title:'Profilfoto',sub:'Optional. Tippe auf den Kreis, um ein Bild hinzuzufügen.'},
  {t:'multi',key:'issues',title:'Aktuelle Beschwerden / Risikobereiche?',sub:'Aktiviert passende Module & Routinen. Keine medizinische Diagnose.',
   opts:[['knee','Knie'],['back','Rücken'],['shoulder','Schulter'],['hip','Hüfte'],['ankle','Sprunggelenk'],['shin','Schienbein'],
    ['foot','Fuß'],['neck','Nacken'],['fatigue','Müdigkeit'],['stress','Stress'],['sleep','Schlafprobleme'],['none','Keine']]},
  {t:'multi',key:'equipment',title:'Verfügbare Geräte & Hilfsmittel?',
   opts:[['Garmin/Wearable'],['Indoor Bike'],['Laufband'],['Pulsgurt'],['Mini-Band'],['Foam Roller'],['Massageball'],['Keine']]},
  {t:'multi',key:'dataSources',title:'Welche Datenquellen nutzt du?',
   opts:[['Apple Health'],['Garmin'],['Strava'],['CSV'],['Manuell']]},
  {t:'choice',key:'coachingIntensity',title:'Gewünschter Coaching-Stil?',
   opts:[['sanft','Sanft'],['ausgewogen','Ausgewogen'],['praezise','Präzise & direkt'],['daten','Maximal datengetrieben']]},
  {t:'done'}
];
var OB={},OB_I=0,OB_FRESH=false;
function norm(o){return o.length===1?[o[0],o[0]]:o;}
function openOnboarding(fresh){
  OB_FRESH=!!fresh;
  OB=fresh?{issues:[],sports:[],equipment:[],dataSources:[],secondaryGoals:[],avatar:''}:JSON.parse(JSON.stringify(PROFILE||PROFILE_DEFAULTS));
  OB_I=0;renderOB();
}
function closeOnboarding(){var el=document.getElementById('onboarding');if(el)el.classList.remove('show');}
function obNext(){if(OB_I<OB_STEPS.length-1){obSyncFields();OB_I++;renderOB();}}
function obBack(){if(OB_I>0){obSyncFields();OB_I--;renderOB();}}
function obPickChoice(key,val){OB[key]=val;renderOB();}
function obToggleMulti(key,val){
  var a=OB[key]||[];
  if(val==='none'||val==='Keine'){OB[key]=(a.indexOf(val)>=0)?[]:[val];renderOB();return;}
  a=a.filter(function(x){return x!=='none'&&x!=='Keine';});
  var i=a.indexOf(val);if(i>=0)a.splice(i,1);else a.push(val);OB[key]=a;renderOB();
}
function obSyncFields(){var s=OB_STEPS[OB_I];if(s.t!=='fields')return;
  s.fields.forEach(function(f){var inp=document.getElementById('ob_'+f[0]);if(!inp)return;
    OB[f[0]]=f[2]==='number'?(inp.value===''?null:+inp.value):inp.value;});}
function obPickPhoto(input){
  var f=input&&input.files&&input.files[0];if(!f)return;
  if(!/^image\//.test(f.type)){if(typeof toast==='function')toast('Bitte ein Bild wählen');return;}
  var r=new FileReader();
  r.onload=function(e){var img=new Image();img.onload=function(){
    var src=Math.min(img.width,img.height),side=Math.min(src,240),sx=(img.width-src)/2,sy=(img.height-src)/2;
    var cv=document.createElement('canvas');cv.width=side;cv.height=side;
    cv.getContext('2d').drawImage(img,sx,sy,src,src,0,0,side,side);
    try{OB.avatar=cv.toDataURL('image/jpeg',0.82);}catch(_){if(typeof toast==='function')toast('Foto konnte nicht verarbeitet werden');return;}
    renderOB();
  };img.src=e.target.result;};
  r.readAsDataURL(f);
}
function obRemovePhoto(){OB.avatar='';renderOB();}
function obAddGoal(){var inp=document.getElementById('ob_goalinput');if(!inp)return;var v=(inp.value||'').trim();if(!v)return;OB.secondaryGoals=OB.secondaryGoals||[];OB.secondaryGoals.push(v);renderOB();}
function obRemoveGoal(i){if(OB.secondaryGoals)OB.secondaryGoals.splice(i,1);renderOB();}
function obFinish(){
  obSyncFields();
  if((OB.issues||[]).length===0)OB.issues=['none'];
  OB.issues=OB.issues.filter(function(x){return x!=='none'&&x!=='Keine';});
  OB.primaryGoalLabel=GOAL_LABELS[OB.primaryGoal]||OB.primaryGoalLabel||'Ziel';
  OB.raceName=OB.raceName||OB.primaryGoalLabel;
  // Numerische Choice-Werte von String → Zahl; gymDays als Teilmenge von trainingDays clampen.
  ['trainingDays','gymDays','sessionMinutes'].forEach(function(k){if(OB[k]!=null&&OB[k]!=='')OB[k]=+OB[k];});
  if(OB.trainingDays!=null&&OB.gymDays!=null)OB.gymDays=Math.min(OB.gymDays,OB.trainingDays);
  OB.onboarded=true;OB.v=1;
  var _base=OB_FRESH?Object.assign({},PROFILE_DEFAULTS):Object.assign({},PROFILE_DEFAULTS,PROFILE||{});
  PROFILE=Object.assign({},_base,OB);
  // Phase-1: HFmax/Ruhepuls aus dem Formular sind GEMESSENE Werte (sonst null — keine globale Annahme).
  PROFILE.hfMaxMeasured=(OB.hfMax!=null&&OB.hfMax!=='')?+OB.hfMax:null;
  PROFILE.restingHrMeasured=(OB.rhrBaseline!=null&&OB.rhrBaseline!=='')?+OB.rhrBaseline:null;
  PROFILE.hfMax=PROFILE.hfMaxMeasured;PROFILE.rhrBaseline=PROFILE.restingHrMeasured;
  // birth_date primär, manuelles Alter nur als Schätzung; Alter immer dynamisch.
  PROFILE.birthDate=OB.birthDate||'';
  PROFILE.ageEstimate=(OB.age!=null&&OB.age!=='')?+OB.age:null;
  PROFILE.age=(window.ORVIA&&window.ORVIA.profileStore)?window.ORVIA.profileStore.computeAge(PROFILE.birthDate,PROFILE.ageEstimate):PROFILE.ageEstimate;
  if(PROFILE.goal&&PROFILE.goal.type&&PROFILE.goal.type!==PROFILE.primaryGoal)PROFILE.goal=null;
  try{if(PROFILE.hmTargetMin&&typeof DB!=='undefined'&&DB){DB._hmTargetMin=PROFILE.hmTargetMin;if(typeof _goalCache!=='undefined')_goalCache=null;}}catch(e){}
  saveProfile();closeOnboarding();
  // Phase-1: Mapped-Felder zusätzlich in user_profiles persistieren (online → Repo, offline → Queue).
  try{
    if(window.ORVIA&&window.ORVIA.profileStore){
      window.ORVIA.profileStore.persist().then(function(r){
        if(typeof toast!=='function')return;
        if(r&&r.success)toast(r.sync_status==='pending'?'Profil offline gespeichert – wird synchronisiert ⏳':'Profil gespeichert ✓');
        else toast('Profil lokal gespeichert (Cloud-Sync fehlgeschlagen)');
      });
    }
  }catch(e){}
  if(typeof renderProfileScreen==='function')renderProfileScreen();
  if(typeof renderDay==='function')renderDay();
  if(typeof toast==='function')toast('ORVIA-System eingerichtet ✓');
}
function renderOB(){
  var el=document.getElementById('onboarding');if(!el)return;
  obSyncFields();
  var s=OB_STEPS[OB_I],total=OB_STEPS.length;
  var dots='';for(var i=0;i<total;i++)dots+='<span class="ob-dot'+(i<=OB_I?' on':'')+'"></span>';
  var body='';
  if(s.t==='welcome'){
    body='<div class="ob-hero"><svg class="ob-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>'+
      '<div class="ob-wm">ORVIA</div><div class="ob-claim">Know your state. Move with precision.</div>'+
      '<p class="ob-lead">Richte dein persönliches Performance-System ein. Wenige Schritte — du kannst alles später im Profil ändern.</p></div>';
  }else if(s.t==='done'){
    var modules=(OB.issues||[]).map(function(k){return ISSUE_LABELS[k]||k;});
    body='<div class="ob-hero"><svg class="ob-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#orvia-mark"/></svg>'+
      '<div class="ob-title">Dein ORVIA-System ist eingerichtet</div>'+
      '<p class="ob-lead">Ziel: <b>'+escH(GOAL_LABELS[OB.primaryGoal]||'—')+'</b><br>'+
      'Module: '+escH(modules.length?modules.join(', '):'keine')+'<br>'+
      'Coaching: '+escH(COACH_LABELS[OB.coachingIntensity]||'—')+'</p>'+
      '<p class="ob-disc">ORVIA ersetzt keine medizinische Diagnose oder Therapie. Bei starken, zunehmenden oder unklaren Beschwerden eine Fachperson konsultieren.</p></div>';
  }else if(s.t==='choice'){
    body='<div class="ob-title">'+escH(s.title)+'</div>'+(s.sub?'<div class="ob-sub">'+escH(s.sub)+'</div>':'')+
      '<div class="ob-chips">'+s.opts.map(norm).map(function(o){var on=OB[s.key]===o[0];
        return '<button class="ob-chip'+(on?' on':'')+'" onclick="obPickChoice(\''+s.key+'\',\''+o[0]+'\')">'+escH(o[1])+'</button>';}).join('')+'</div>';
  }else if(s.t==='multi'){
    body='<div class="ob-title">'+escH(s.title)+'</div>'+(s.sub?'<div class="ob-sub">'+escH(s.sub)+'</div>':'')+
      '<div class="ob-chips">'+s.opts.map(norm).map(function(o){var on=(OB[s.key]||[]).indexOf(o[0])>=0;
        return '<button class="ob-chip'+(on?' on':'')+'" onclick="obToggleMulti(\''+s.key+'\',\''+o[0]+'\')">'+escH(o[1])+'</button>';}).join('')+'</div>';
  }else if(s.t==='fields'){
    body='<div class="ob-title">'+escH(s.title)+'</div>'+(s.sub?'<div class="ob-sub">'+escH(s.sub)+'</div>':'')+
      '<div class="ob-fields">'+s.fields.map(function(f){var v=OB[f[0]]==null?'':OB[f[0]];
        var _ty=f[2]==='number'?'number':f[2]==='date'?'date':'text';
        return '<label class="ob-f"><span>'+escH(f[1])+'</span><input id="ob_'+f[0]+'" type="'+_ty+'" inputmode="'+(f[2]==='number'?'decimal':'text')+'" value="'+escH(v)+'"></label>';}).join('')+'</div>';
  }else if(s.t==='photo'){
    var _av=OB.avatar,_ini=((OB.name||'O').trim()[0]||'O').toUpperCase();
    body='<div class="ob-title">'+escH(s.title)+'</div>'+(s.sub?'<div class="ob-sub">'+escH(s.sub)+'</div>':'')+
      '<div class="ob-photo"><label class="ob-avatar" for="ob_photo">'+(_av?'<img src="'+escH(_av)+'" alt="">':'<span>'+escH(_ini)+'</span>')+'<span class="ob-cam">+</span></label>'+
      '<input id="ob_photo" type="file" accept="image/*" style="display:none" onchange="obPickPhoto(this)">'+
      (_av?'<button class="ob-skip" type="button" onclick="obRemovePhoto()">Foto entfernen</button>':'')+'</div>';
  }else if(s.t==='goals'){
    var _gl=(OB.secondaryGoals||[]).map(function(g,i){return '<div class="ob-goal"><span>'+escH(g)+'</span><button type="button" onclick="obRemoveGoal('+i+')" aria-label="Entfernen">✕</button></div>';}).join('');
    body='<div class="ob-title">'+escH(s.title)+'</div>'+(s.sub?'<div class="ob-sub">'+escH(s.sub)+'</div>':'')+
      '<div class="ob-goallist">'+(_gl||'<div class="ob-empty">Noch keine weiteren Ziele.</div>')+'</div>'+
      '<div class="ob-goaladd"><input id="ob_goalinput" type="text" placeholder="z. B. Marathon Herbst 26" onkeydown="if(event.key===&quot;Enter&quot;){event.preventDefault();obAddGoal();}"><button class="ob-add" type="button" onclick="obAddGoal()">+</button></div>';
  }
  var primaryLabel=s.t==='done'?'Fertig':s.t==='welcome'?'Start':'Weiter';
  var primaryAct=s.t==='done'?'obFinish()':'obNext()';
  var canSkip=OB_FRESH&&s.t==='welcome';
  el.innerHTML='<div class="ob-card">'+
    '<div class="ob-top"><span class="ob-step">Schritt '+(OB_I+1)+' / '+total+'</span>'+
      (s.t!=='welcome'&&s.t!=='done'?'<button class="ob-x" onclick="closeOnboarding()" aria-label="Schließen">✕</button>':'')+'</div>'+
    '<div class="ob-dots">'+dots+'</div>'+
    '<div class="ob-body">'+body+'</div>'+
    '<div class="ob-nav">'+
      (OB_I>0&&s.t!=='done'?'<button class="ob-btn sec" onclick="obBack()">Zurück</button>':'<span></span>')+
      '<button class="ob-btn pri" onclick="'+primaryAct+'">'+primaryLabel+'</button>'+
    '</div>'+
    (canSkip?'<button class="ob-skip" onclick="closeOnboarding()">Später einrichten</button>':'')+
    '</div>';
  el.classList.add('show');
}

/* ============================================================
   ZIELE-VERWALTUNG (Inkrement 2): Übersicht, Anlegen, Bearbeiten, Priorität/Rolle,
   Pausieren/Fortsetzen/Erreicht/Archivieren/Löschen, Zielkonflikte, Plan-Auswirkung.
   Nutzt ORVIA.profileModel. Keine technischen IDs/Kategorien in der UI.
   ============================================================ */
var GOAL_CAT_DE={
  fat_loss:'Körperfett reduzieren',shredded:'Sehr definiert werden',weight_loss:'Gewicht reduzieren',weight_gain:'Gewicht zunehmen',
  muscle_gain:'Muskeln aufbauen',muscle_maintain:'Muskulatur erhalten',recomposition:'Recomposition',target_bodyfat:'Körperfettanteil erreichen',
  run_5k:'5 km',run_10k:'10 km',half_marathon:'Halbmarathon',marathon:'Marathon',triathlon:'Triathlon',ironman:'Ironman',cycling_race:'Radrennen',swim_goal:'Schwimmziel',base_endurance:'Grundlagenausdauer',vo2max:'VO₂max verbessern',
  get_stronger:'Stärker werden',hypertrophy:'Hypertrophie',lift_pr:'Übung verbessern',strength_endurance:'Kraftausdauer',functional_strength:'Funktionelle Kraft',explosive_strength:'Explosivkraft',
  football:'Fußball',handball:'Handball',basketball:'Basketball',volleyball:'Volleyball',tennis:'Tennis',padel:'Padel',hockey:'Hockey',rugby:'Rugby',other_team:'Mannschaftssport',
  sprint_speed:'Sprintgeschwindigkeit',change_of_direction:'Richtungswechsel',jump:'Sprungkraft',game_endurance:'Spielausdauer',repeated_sprints:'Wiederholte Sprints',duel_strength:'Zweikampfstärke',mobility_perf:'Beweglichkeit',technique:'Technik',robustness:'Belastbarkeit',injury_prevention:'Verletzungsprävention',
  reduce_complaints:'Beschwerden reduzieren',stabilize_knee:'Knie stabilisieren',strengthen_back:'Rücken stärken',improve_mobility:'Beweglichkeit verbessern',pain_free:'Schmerzfrei trainieren',increase_robustness:'Belastbarkeit erhöhen',return_after_break:'Wiedereinstieg',improve_recovery:'Regeneration verbessern',improve_sleep:'Schlaf verbessern',reduce_stress:'Stress reduzieren',
  train_regularly:'Regelmäßiger trainieren',keep_fit:'Fitness erhalten',active_daily:'Alltag aktiver',long_term_health:'Langfristig gesund',wellbeing:'Wohlbefinden',custom:'Eigenes Ziel'};
var GOAL_GROUP_DE={body_composition:'Körper',endurance:'Ausdauer',strength:'Kraft',team_sport:'Mannschaftssport',sport_performance:'Sportleistung',health:'Gesundheit',general:'Allgemein'};
function goalCatLabel(c){return GOAL_CAT_DE[c]||c;}
function _closeM(id){var w=window[id];if(w){try{w.remove();}catch(e){}window[id]=null;}}
function _modal(id,inner){_closeM(id);var w=document.createElement('div');w.className='orvia-modal-bg';w.innerHTML='<div class="orvia-modal goal-modal">'+inner+'</div>';document.body.appendChild(w);window[id]=w;w.addEventListener('click',function(ev){if(ev.target===w)_closeM(id);});return w;}

function openGoalsManager(){window._goalsMgr=_modal('_goalsMgr','<h3>Ziele verwalten</h3><div id="goalsMgrBody"></div>');renderGoalsList();}
function closeGoalsManager(){_closeM('_goalsMgr');window._goalsMgr=null;}
function renderGoalsList(){var box=document.getElementById('goalsMgrBody');if(!box)return;var M=pmModel();var gs=listGoals();
  var byStatus={active:[],paused:[],achieved:[],archived:[],abandoned:[]};gs.forEach(function(g){(byStatus[g.status]||byStatus.active).push(g);});
  byStatus.active.sort(function(a,b){return a.priority-b.priority;});
  function card(g){var role=GOAL_ROLE_DE[M.roleOfGoal(g)]||'Ziel';var when=g.targetDate?(' · '+(typeof shortDate==='function'?shortDate(g.targetDate):g.targetDate)):(g.timeHorizon==='long'?' · langfristig':'');
    var prog=(g.currentValue!=null||g.targetValue!=null)?('<div class="gmc-prog">'+(g.currentValue!=null?'Aktuell: '+escH(''+g.currentValue)+(g.unit?' '+escH(g.unit):''):'')+(g.targetValue!=null?' · Ziel: '+escH(''+g.targetValue)+(g.unit?' '+escH(g.unit):''):'')+'</div>'):'';
    var acts='<div class="gmc-acts">'+
      '<button class="gmc-b" onclick="openGoalDetail(\''+g.id+'\')">Details</button>'+
      '<button class="gmc-b" onclick="openGoalEditor(\''+g.id+'\')">Bearbeiten</button>'+
      (g.status==='active'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'paused\')">Pausieren</button>':'')+
      (g.status==='paused'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'active\')">Fortsetzen</button>':'')+
      (g.status!=='achieved'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'achieved\')">Erreicht</button>':'')+
      (g.status!=='archived'?'<button class="gmc-b" onclick="goalSetStatus(\''+g.id+'\',\'archived\')">Archivieren</button>':'')+
      '<button class="gmc-b danger-btn" onclick="confirmDeleteGoal(\''+g.id+'\')">Löschen</button></div>';
    return '<div class="gmcard"><div class="gmc-h">'+escH(g.title||'Ziel')+'</div><div class="gmc-meta">'+escH(role+' · '+goalCatLabel(g.category)+when)+'</div>'+prog+acts+'</div>';}
  function section(title,arr){return arr.length?('<div class="gm-sec">'+escH(title)+'</div>'+arr.map(card).join('')):'';}
  var conflicts=M.detectGoalConflicts(gs).filter(function(c){return !_conflictDecided(c);});
  var conflictHTML=conflicts.map(function(c){return '<div class="gm-conflict"><b>Zielkonflikt erkannt</b><p>'+escH(c.explanation)+'</p>'+
    '<div class="gm-cacts">'+['Ausdauer priorisieren, Kraft erhalten','Muskelaufbau priorisieren, Ausdauer erhalten','Ziele zeitlich staffeln','Eigene Entscheidung'].map(function(opt,i){return '<button class="gmc-b" onclick="decideConflict(\''+escH(c.conflictType)+'\',\''+escH(c.goalIds.join(','))+'\','+i+')">'+escH(opt)+'</button>';}).join('')+'</div></div>';}).join('');
  box.innerHTML='<button class="btn" onclick="openGoalEditor()">Ziel hinzufügen</button>'+conflictHTML+
    section('Aktive Ziele',byStatus.active)+section('Pausiert',byStatus.paused)+section('Erreicht',byStatus.achieved)+section('Archiviert',byStatus.archived)+
    '<button class="btn sec" style="margin-top:12px" onclick="closeGoalsManager()">Schließen</button>';}

function _conflictDecided(c){try{var dec=(PROFILE.goalConflictDecisions||[]);return dec.some(function(d){return d.conflictType===c.conflictType&&d.goalIds.slice().sort().join(',')===c.goalIds.slice().sort().join(',');});}catch(e){return false;}}
function decideConflict(type,ids,optionIdx){var strat=['endurance_first','strength_first','stagger','custom'][optionIdx]||'custom';
  PROFILE.goalConflictDecisions=PROFILE.goalConflictDecisions||[];PROFILE.goalConflictDecisions.push({conflictType:type,goalIds:ids.split(','),userDecision:strat,createdAt:new Date().toISOString()});
  if(typeof save==='function')save();else saveProfile();renderGoalsList();if(typeof toast==='function')toast('Entscheidung gespeichert');}

/* ============================================================
   ZIEL-WIZARD (Inkrement 3): 7 Schritte, Fortschritt, Zurück ohne Datenverlust,
   Entwurf bleibt erhalten, Vorausfüllen, kein Zwischenspeichern, Unsaved-Schutz via diffState.
   ============================================================ */
var GW_STEPS=[
  {key:'type',label:'Zielart'},
  {key:'details',label:'Konkretisieren'},
  {key:'sports',label:'Sportarten'},
  {key:'metrics',label:'Zeitraum & Messwerte'},
  {key:'role',label:'Rolle & Priorität'},
  {key:'milestones',label:'Meilensteine'},
  {key:'summary',label:'Zusammenfassung'}];
function _gwDraftFromGoal(g){var M=pmModel();
  if(!g)return {title:'',category:'custom',description:'',role:'secondary',timeHorizon:'open',targetDate:null,sports:[],currentValue:null,targetValue:null,unit:null,categoryData:{},milestones:[]};
  return {title:g.title||'',category:g.category||'custom',description:g.description||'',role:M.roleOfGoal(g),timeHorizon:g.timeHorizon||'open',targetDate:g.targetDate||null,
    sports:(g.sports||[]).slice(),currentValue:g.currentValue,targetValue:g.targetValue,unit:g.unit||null,
    categoryData:JSON.parse(JSON.stringify(g.categoryData||{})),milestones:JSON.parse(JSON.stringify(g.milestones||[]))};}
function openGoalEditor(id){var g=id?listGoals().filter(function(x){return x.id===id;})[0]:null;
  var draft=_gwDraftFromGoal(g);
  window._gw={id:id||null,step:0,draft:draft,orig:pmModel().diffState?JSON.stringify(draft):JSON.stringify(draft)};
  _modal('_goalEd','<div id="gwBody"></div>');gwRender();}
function gwRender(){var box=document.getElementById('gwBody');if(!box)return;var W=window._gw;var st=GW_STEPS[W.step];
  var prog='<div class="gw-prog">'+GW_STEPS.map(function(s,i){return '<span class="gw-dot'+(i===W.step?' on':'')+(i<W.step?' done':'')+'"></span>';}).join('')+'</div>'+
    '<div class="gw-steplabel">Schritt '+(W.step+1)+' von '+GW_STEPS.length+' · '+escH(st.label)+'</div>';
  box.innerHTML='<h3>'+(W.id?'Ziel bearbeiten':'Ziel hinzufügen')+'</h3>'+prog+'<div id="gwStep">'+_gwStepHTML(st.key)+'</div>'+
    '<div class="gw-nav">'+
    (W.step>0?'<button class="btn sec" onclick="gwBack()">Zurück</button>':'<button class="btn sec" onclick="gwCancel()">Abbrechen</button>')+
    (W.step<GW_STEPS.length-1?'<button class="btn" onclick="gwNext()">Weiter</button>':'<button class="btn" onclick="gwSave()">'+(W.id?'Speichern':'Ziel anlegen')+'</button>')+
    '</div>';}
function _gwField(f,cd){var id='gwf_'+f.key;var v=cd[f.key];var lab='<label>'+escH(f.label)+(f.unit?' ('+escH(f.unit)+')':'')+'</label>';
  if(f.type==='bool')return '<div class="gm-field gm-inline"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+'>'+lab+'</div>';
  if(f.type==='select')return '<div class="gm-field">'+lab+'<select id="'+id+'"><option value=""></option>'+f.options.map(function(o){return '<option'+(v===o?' selected':'')+'>'+escH(o)+'</option>';}).join('')+'</select></div>';
  if(f.type==='longtext')return '<div class="gm-field">'+lab+'<textarea id="'+id+'" rows="2">'+escH(v!=null?v:'')+'</textarea></div>';
  var t=f.type==='number'?'number':(f.type==='date'?'date':'text');
  return '<div class="gm-field">'+lab+'<input type="'+t+'" id="'+id+'" value="'+escH(v!=null?v:'')+'"></div>';}
function _gwStepHTML(key){var M=pmModel();var d=window._gw.draft;
  if(key==='type'){var cats='';for(var grp in M.GOAL_CATEGORIES){cats+='<optgroup label="'+escH(GOAL_GROUP_DE[grp]||grp)+'">'+M.GOAL_CATEGORIES[grp].map(function(c){return '<option value="'+c+'"'+(d.category===c?' selected':'')+'>'+escH(goalCatLabel(c))+'</option>';}).join('')+'</optgroup>';}
    return '<div class="gm-field"><label>Worum geht es?</label><select id="gw_cat">'+cats+'</select></div>'+
      '<div class="gm-field"><label>Titel</label><input id="gw_title" value="'+escH(d.title)+'" placeholder="z. B. Halbmarathon unter 1:50"><span class="ob2-err" id="gw_err" role="alert"></span></div>'+
      '<div class="gm-field"><label>Beschreibung (optional)</label><input id="gw_desc" value="'+escH(d.description)+'"></div>';}
  if(key==='details'){var fields=M.categoryFieldsFor(d.category);var html='';
    if(d.category==='shredded')html+='<p class="note" style="text-align:left">Sehr definiert werden — Körperfett reduzieren und Muskulatur möglichst erhalten. Es werden keine extremen Zielwerte empfohlen.</p>';
    if(d.category==='ironman'||d.category==='triathlon')html+='<p class="note" style="text-align:left">Langfristiges Ziel ohne festes Datum ist erlaubt.</p>';
    if(d.category==='football'){var fo=M.sportFollowupSchema('football').focusOptions;var sel=d.categoryData.focus||[];
      html+='<div class="gm-field"><label>Leistungsbereiche (mehrere möglich)</label><div class="gm-chips" id="gw_focus">'+fo.map(function(x){return '<button type="button" class="gm-chip'+(sel.indexOf(x)>=0?' on':'')+'" data-v="'+x+'" onclick="gmToggle(this)">'+escH(goalCatLabel(x))+'</button>';}).join('')+'</div></div>';}
    html+=fields.length?fields.map(function(f){return _gwField(f,d.categoryData);}).join(''):(d.category==='football'?'':'<p class="note" style="text-align:left">Für diese Zielart sind keine Spezialfelder nötig. Weiter zu Sportarten und Messwerten.</p>');
    return html;}
  if(key==='sports'){var sportsAll=(PROFILE.sports||[]).map(function(s){return typeof s==='string'?s:(s.sportId||s.customName);}).filter(Boolean);
    if(!sportsAll.length)return '<p class="note" style="text-align:left">Noch keine Sportarten im Profil. Du kannst das Ziel trotzdem speichern und Sportarten später im Profil ergänzen.</p>';
    return '<div class="gm-field"><label>Welche Sportarten betrifft das Ziel?</label><div class="gm-chips" id="gw_sports">'+sportsAll.map(function(s){return '<button type="button" class="gm-chip'+(d.sports.indexOf(s)>=0?' on':'')+'" data-v="'+escH(s)+'" onclick="gmToggle(this)">'+escH(s)+'</button>';}).join('')+'</div></div>';}
  if(key==='metrics'){var horizons=[['short','kurzfristig'],['mid','mittelfristig'],['long','langfristig'],['open','ohne festes Datum']];
    return '<div class="gm-field"><label>Zeitraum</label><select id="gw_hz">'+horizons.map(function(h){return '<option value="'+h[0]+'"'+(d.timeHorizon===h[0]?' selected':'')+'>'+h[1]+'</option>';}).join('')+'</select></div>'+
      '<div class="gm-field"><label>Zieldatum (optional)</label><input type="date" id="gw_date" value="'+escH(d.targetDate||'')+'"><span class="ob2-err" id="gw_err" role="alert"></span></div>'+
      '<div class="row2"><div class="gm-field"><label>Aktuell (optional)</label><input id="gw_cur" value="'+escH(d.currentValue!=null?d.currentValue:'')+'"></div>'+
      '<div class="gm-field"><label>Ziel (optional)</label><input id="gw_tgt" value="'+escH(d.targetValue!=null?d.targetValue:'')+'"></div></div>'+
      '<div class="gm-field"><label>Einheit (optional)</label><input id="gw_unit" value="'+escH(d.unit||'')+'" placeholder="z. B. min, kg, m"></div>';}
  if(key==='role'){var roles=[['main','Hauptziel'],['secondary','Sekundäres Entwicklungsziel'],['maintain','Erhaltungsziel'],['longterm','Langfristiges Hintergrundziel']];
    return '<div class="gm-field"><label>Welche Rolle hat dieses Ziel?</label><select id="gw_role">'+roles.map(function(r){return '<option value="'+r[0]+'"'+(d.role===r[0]?' selected':'')+'>'+r[1]+'</option>';}).join('')+'</select></div>'+
      '<p class="note" style="text-align:left">Pro Planungsphase gibt es standardmäßig ein Hauptziel. Weitere Ziele werden erhalten oder zeitlich gestaffelt.</p>';}
  if(key==='milestones'){return '<div id="gwMs">'+_gwMsHTML()+'</div>'+
      '<div class="gm-field"><label>Neuer Meilenstein</label><input id="gw_ms_title" placeholder="z. B. 1.500 m am Stück schwimmen"></div>'+
      '<button class="gmc-b" onclick="gwAddMs()">Meilenstein hinzufügen</button>';}
  if(key==='summary'){var role=GOAL_ROLE_DE[d.role]||'Ziel';var cdKeys=Object.keys(d.categoryData||{}).filter(function(k){return d.categoryData[k]!==''&&d.categoryData[k]!=null&&!(Array.isArray(d.categoryData[k])&&!d.categoryData[k].length);});
    return '<div class="gm-sum">'+
      '<div><b>'+escH(d.title||'(ohne Titel)')+'</b></div>'+
      '<div class="gmc-meta">'+escH(role+' · '+goalCatLabel(d.category))+'</div>'+
      (d.description?'<p>'+escH(d.description)+'</p>':'')+
      '<div class="gmc-meta">Zeitraum: '+escH(d.timeHorizon||'offen')+(d.targetDate?' · '+escH(d.targetDate):' · ohne Datum')+'</div>'+
      (d.sports.length?'<div class="gmc-meta">Sportarten: '+escH(d.sports.join(', '))+'</div>':'')+
      ((d.currentValue!=null||d.targetValue!=null)?'<div class="gmc-meta">'+(d.currentValue!=null?'Aktuell '+escH(''+d.currentValue):'')+(d.targetValue!=null?' → Ziel '+escH(''+d.targetValue):'')+(d.unit?' '+escH(d.unit):'')+'</div>':'')+
      (cdKeys.length?'<div class="gmc-meta">Spezialdaten: '+escH(cdKeys.length+' Felder ausgefüllt')+'</div>':'')+
      (d.milestones.length?'<div class="gmc-meta">Meilensteine: '+d.milestones.length+'</div>':'')+
      '</div>';}
  return '';}
function _gwMsHTML(){var d=window._gw.draft;if(!d.milestones.length)return '<p class="note" style="text-align:left">Noch keine Meilensteine. Optional.</p>';
  return d.milestones.map(function(m,i){return '<div class="gw-ms"><span>'+escH(m.title||'Meilenstein')+'</span>'+
    '<button class="gmc-b" onclick="gwMoveMs('+i+',-1)">↑</button><button class="gmc-b" onclick="gwMoveMs('+i+',1)">↓</button>'+
    '<button class="gmc-b danger-btn" onclick="gwDelMs('+i+')">✕</button></div>';}).join('');}
function gwAddMs(){var el=document.getElementById('gw_ms_title');var t=(el&&el.value||'').trim();if(!t)return;window._gw.draft.milestones.push({id:'ms:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:t,status:'planned',order:window._gw.draft.milestones.length});if(el)el.value='';document.getElementById('gwMs').innerHTML=_gwMsHTML();}
function gwMoveMs(i,delta){var ms=window._gw.draft.milestones;var j=i+delta;if(j<0||j>=ms.length)return;var t=ms[i];ms[i]=ms[j];ms[j]=t;document.getElementById('gwMs').innerHTML=_gwMsHTML();}
function gwDelMs(i){window._gw.draft.milestones.splice(i,1);document.getElementById('gwMs').innerHTML=_gwMsHTML();}
// Aktuelle Schritt-Eingaben in den Entwurf übernehmen (Zurück/Weiter verlieren nichts).
function _gwCollect(){var d=window._gw.draft;var st=GW_STEPS[window._gw.step].key;
  function val(id){var e=document.getElementById(id);return e?e.value:undefined;}
  if(st==='type'){var c=val('gw_cat');if(c!=null)d.category=c;var t=val('gw_title');if(t!=null)d.title=t.trim();var ds=val('gw_desc');if(ds!=null)d.description=ds;}
  else if(st==='details'){var M=pmModel();M.categoryFieldsFor(d.category).forEach(function(f){var e=document.getElementById('gwf_'+f.key);if(!e)return;if(f.type==='bool')d.categoryData[f.key]=e.checked;else if(f.type==='number'){d.categoryData[f.key]=e.value===''?null:(isNaN(parseFloat(e.value.replace(',','.')))?e.value:parseFloat(e.value.replace(',','.')));}else d.categoryData[f.key]=e.value;});
    var fc=document.getElementById('gw_focus');if(fc)d.categoryData.focus=Array.prototype.slice.call(fc.querySelectorAll('.on')).map(function(b){return b.dataset.v;});}
  else if(st==='sports'){var sc=document.getElementById('gw_sports');if(sc)d.sports=Array.prototype.slice.call(sc.querySelectorAll('.on')).map(function(b){return b.dataset.v;});}
  else if(st==='metrics'){var hz=val('gw_hz');if(hz!=null)d.timeHorizon=hz;var dt=val('gw_date');d.targetDate=dt||null;d.currentValue=_gwNum('gw_cur');d.targetValue=_gwNum('gw_tgt');var u=val('gw_unit');d.unit=(u||'').trim()||null;}
  else if(st==='role'){var r=val('gw_role');if(r!=null)d.role=r;}}
function _gwNum(id){var el=document.getElementById(id);if(!el||el.value==='')return null;var n=parseFloat(String(el.value).replace(',','.'));return isNaN(n)?el.value.trim()||null:n;}
function gwNext(){_gwCollect();var d=window._gw.draft;var st=GW_STEPS[window._gw.step].key;
  if(st==='type'&&!d.title.trim()){var e=document.getElementById('gw_err');if(e)e.textContent='Bitte gib deinem Ziel einen Namen.';return;}
  if(st==='metrics'&&d.targetDate){var vr=pmModel().validateGoal({title:d.title,targetDate:d.targetDate});var er=document.getElementById('gw_err');if(er)er.textContent=vr.errors.targetDate||'';}
  window._gw.step++;gwRender();}
function gwBack(){_gwCollect();window._gw.step--;gwRender();}
function gwCancel(){_gwCollect();var W=window._gw;
  if(!pmModel().diffState(JSON.parse(W.orig),W.draft)){_closeM('_goalEd');return;}
  _modal('_gwDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
    '<button class="btn sec" onclick="_closeM(\'_gwDiscard\')">Weiter bearbeiten</button>'+
    '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_gwDiscard\');_closeM(\'_goalEd\')">Änderungen verwerfen</button>');}
function gwSave(){_gwCollect();var M=pmModel();var d=window._gw.draft;var id=window._gw.id;
  if(!d.title.trim()){window._gw.step=0;gwRender();var e=document.getElementById('gw_err');if(e)e.textContent='Bitte gib deinem Ziel einen Namen.';return;}
  var patch={category:d.category,title:d.title.trim(),description:d.description||'',priority:M.priorityOfRole(d.role),
    timeHorizon:d.timeHorizon,targetDate:d.targetDate||null,sports:d.sports,currentValue:d.currentValue,targetValue:d.targetValue,
    unit:d.unit,categoryData:d.categoryData,milestones:d.milestones};
  var wasMain=id&&(listGoals().filter(function(x){return x.id===id;})[0]||{}).priority===1;
  var becomesMain=patch.priority===1;
  var reason=(becomesMain||wasMain)?'Hauptziel geändert':(d.targetDate?'Zieldatum geändert':null);
  if(id)goalUpdate(id,patch,reason);else goalAdd(patch,reason);
  window._gw=null;_closeM('_goalEd');renderGoalsList();
  if(reason)maybePlanImpact(reason);
  if(typeof toast==='function')toast('Ziel gespeichert');}

/* Ziel-Detailansicht: alle Felder inkl. Spezialdaten, Meilensteine, Konflikte, Plan-Auswirkung. */
function openGoalDetail(id){var M=pmModel();var g=listGoals().filter(function(x){return x.id===id;})[0];if(!g)return;
  var role=GOAL_ROLE_DE[M.roleOfGoal(g)]||'Ziel';
  var fields=M.categoryFieldsFor(g.category);var cd=g.categoryData||{};
  var special=fields.filter(function(f){return cd[f.key]!=null&&cd[f.key]!=='';}).map(function(f){var v=cd[f.key];return '<div class="gmc-meta">'+escH(f.label)+': '+escH(v===true?'ja':(v===false?'nein':''+v))+(f.unit&&v!==true&&v!==false?' '+escH(f.unit):'')+'</div>';}).join('');
  if(cd.focus&&cd.focus.length)special+='<div class="gmc-meta">Leistungsbereiche: '+escH(cd.focus.map(goalCatLabel).join(', '))+'</div>';
  var ms=(g.milestones||[]).map(function(m){var done=m.status==='achieved';return '<div class="gw-ms"><span'+(done?' style="text-decoration:line-through;opacity:.6"':'')+'>'+escH(m.title)+'</span>'+
    '<button class="gmc-b" onclick="gdMs(\''+g.id+'\',\''+m.id+'\',\''+(done?'planned':'achieved')+'\')">'+(done?'↺':'✓')+'</button>'+
    '<button class="gmc-b danger-btn" onclick="gdMsDel(\''+g.id+'\',\''+m.id+'\')">✕</button></div>';}).join('')||'<p class="note" style="text-align:left">Keine Meilensteine.</p>';
  var conflicts=M.detectGoalConflicts(listGoals()).filter(function(c){return c.goalIds.indexOf(g.id)>=0&&!_conflictDecided(c);});
  var conf=conflicts.length?'<div class="gm-conflict"><b>Zielkonflikt</b><p>'+escH(conflicts[0].explanation)+'</p></div>':'';
  var pi=(PROFILE.planImpact&&PROFILE.planImpact.pending)?'<div class="gmc-meta">Plan-Auswirkung offen: '+escH(PROFILE.planImpact.reason||'')+'</div>':'';
  _modal('_goalDet','<h3>'+escH(g.title)+'</h3>'+
    '<div class="gmc-meta">'+escH(role+' · '+goalCatLabel(g.category)+' · Status: '+g.status)+'</div>'+
    (g.description?'<p>'+escH(g.description)+'</p>':'')+
    (g.sports&&g.sports.length?'<div class="gmc-meta">Sportarten: '+escH(g.sports.join(', '))+'</div>':'')+
    '<div class="gmc-meta">Zeitraum: '+escH(g.timeHorizon||'offen')+(g.targetDate?' · '+escH(g.targetDate):' · ohne Datum')+'</div>'+
    ((g.currentValue!=null||g.targetValue!=null)?'<div class="gmc-meta">'+(g.currentValue!=null?'Aktuell '+escH(''+g.currentValue):'')+(g.targetValue!=null?' → Ziel '+escH(''+g.targetValue):'')+(g.unit?' '+escH(g.unit):'')+'</div>':'')+
    (special?'<div class="gm-sec">Spezialdaten</div>'+special:'')+
    '<div class="gm-sec">Meilensteine</div>'+ms+
    conf+pi+
    '<div class="gmc-acts" style="margin-top:12px"><button class="gmc-b" onclick="_closeM(\'_goalDet\');openGoalEditor(\''+g.id+'\')">Bearbeiten</button>'+
    '<button class="gmc-b danger-btn" onclick="_closeM(\'_goalDet\');confirmDeleteGoal(\''+g.id+'\')">Löschen</button></div>'+
    '<div class="gmc-meta" style="margin-top:6px">Zuletzt aktualisiert: '+escH((g.updatedAt||'').slice(0,10))+'</div>'+
    '<button class="btn sec" style="margin-top:10px" onclick="_closeM(\'_goalDet\')">Schließen</button>');}
function gdMs(gid,mid,st){var g=listGoals().filter(function(x){return x.id===gid;})[0];if(!g)return;var ng=pmModel().updateMilestone(g,mid,{status:st});goalUpdate(gid,{milestones:ng.milestones});openGoalDetail(gid);}
function gdMsDel(gid,mid){var g=listGoals().filter(function(x){return x.id===gid;})[0];if(!g)return;var ng=pmModel().removeMilestone(g,mid);goalUpdate(gid,{milestones:ng.milestones});openGoalDetail(gid);}
function confirmDeleteGoal(id){var g=listGoals().filter(function(x){return x.id===id;})[0];
  _modal('_goalDel','<h3>Ziel wirklich löschen?</h3><p class="modtext" style="margin:0 0 14px">Das Ziel'+(g?' „'+escH(g.title)+'"':'')+' und seine gespeicherten Meilensteine werden dauerhaft entfernt.</p>'+
    '<button class="btn sec" onclick="_closeM(\'_goalDel\')">Abbrechen</button>'+
    '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_goalDel\');goalRemove(\''+id+'\');renderGoalsList()">Endgültig löschen</button>');}
/* Plan-Auswirkung: mehrere Änderungen einer Sitzung werden zu EINEM planImpact-Eintrag gebündelt
   (model.bundlePlanImpact). Dialog nur bei bestehendem Plan; KEINE automatische Neuberechnung. */
function maybePlanImpact(reason,fields){
  PROFILE.planImpact=pmModel().bundlePlanImpact(PROFILE.planImpact,reason,fields||[]);
  if(typeof save==='function')save();else saveProfile();
  if(!(PROFILE.weekPlan))return; // kein bestehender Plan → nur Flag setzen, kein Dialog
  _modal('_planImp','<h3>Plan-Auswirkung</h3><p class="modtext" style="margin:0 0 14px">Diese Änderung kann deinen bestehenden Trainingsplan beeinflussen.</p>'+
    '<button class="btn sec" onclick="_planDecide(\'keep\')">Bestehenden Plan beibehalten</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="_planDecide(\'later\')">Später neu berechnen</button>'+
    '<button class="btn" style="margin-top:10px" onclick="_planDecide(\'now\')">Plan jetzt anpassen</button>');}
function _planDecide(dec){PROFILE.planImpact=Object.assign({},PROFILE.planImpact,{pending:dec!=='keep',userDecision:dec,updatedAt:new Date().toISOString()});
  if(typeof save==='function')save();else saveProfile();_closeM('_planImp');if(typeof toast==='function')toast(dec==='keep'?'Plan bleibt unverändert':'Vorgemerkt');}

/* ============================================================
   EDITIERBARE PROFILBEREICHE (Inkrement 3): eigenständige Karten je mit „Bearbeiten",
   schema-getriebene Editoren, Unsaved-Schutz (diffState), Plan-Impact-Bündelung pro Sitzung.
   Speichert offline-first ins produktive PROFILE; unbekannte Felder bleiben erhalten.
   ============================================================ */
function _secVal(o,k){return o&&o[k]!=null?o[k]:'';}
// Generische Feldschemas (für einfache Abschnitte). Typen wie im Ziel-Wizard.
var SECTION_DEFS={
  personal:{label:'Persönliche Grunddaten',planImpact:false,fields:[
    {key:'name',label:'Name',type:'text'},{key:'location',label:'Ort',type:'text'},
    {key:'birthDate',label:'Geburtsdatum',type:'date'},{key:'sex',label:'Geschlecht',type:'select',options:['m','w','d']}],
    read:function(p){return {name:p.name||'',location:p.location||'',birthDate:p.birthDate||'',sex:p.sex||''};},
    write:function(p,d){p.name=d.name;p.location=d.location;p.birthDate=d.birthDate||'';p.sex=d.sex||'';}},
  body:{label:'Körper und Leistungsstand',planImpact:false,fields:[
    {key:'heightCm',label:'Größe',type:'number',unit:'cm'},{key:'weightKg',label:'Gewicht',type:'number',unit:'kg'},
    {key:'bodyFat',label:'Körperfett (optional)',type:'number',unit:'%'},{key:'trainingAge',label:'Trainingsalter (optional)',type:'number',unit:'Jahre'},
    {key:'restingHR',label:'Ruhepuls (optional)',type:'number',unit:'bpm'},{key:'vo2max',label:'VO₂max (optional)',type:'number'},
    {key:'bestTimes',label:'Aktuelle Bestzeiten (optional)',type:'text'},{key:'lifts',label:'Kraftwerte (optional)',type:'text'}],
    read:function(p){var b=p.body||{};return {heightCm:p.heightCm,weightKg:p.weightKg,bodyFat:b.bodyFat,trainingAge:b.trainingAge,restingHR:b.restingHR,vo2max:b.vo2max,bestTimes:b.bestTimes,lifts:b.lifts};},
    write:function(p,d){if(d.heightCm!=null)p.heightCm=d.heightCm;if(d.weightKg!=null)p.weightKg=d.weightKg;p.body=Object.assign({},p.body,{bodyFat:d.bodyFat,trainingAge:d.trainingAge,restingHR:d.restingHR,vo2max:d.vo2max,bestTimes:d.bestTimes,lifts:d.lifts,updatedAt:new Date().toISOString()});}},
  recovery:{label:'Regeneration und Alltag',planImpact:false,fields:[
    {key:'sleepHours',label:'Durchschnittliche Schlafdauer',type:'number',unit:'h'},{key:'sleepQuality',label:'Schlafqualität',type:'select',options:['schlecht','okay','gut']},
    {key:'stress',label:'Stress',type:'select',options:['niedrig','mittel','hoch']},{key:'workload',label:'Arbeits-/Schulbelastung',type:'select',options:['gering','mittel','hoch']},
    {key:'shiftWork',label:'Schichtarbeit',type:'bool'},{key:'energy',label:'Durchschnittliches Energieniveau',type:'select',options:['niedrig','mittel','hoch']},
    {key:'recoveryPrefs',label:'Regenerationspräferenzen',type:'text'},{key:'restDayPref',label:'Ruhetagpräferenz',type:'text'},{key:'nutrition',label:'Ernährungssituation grob',type:'text'}],
    read:function(p){return Object.assign({},p.recovery);},write:function(p,d){p.recovery=Object.assign({},p.recovery,d,{updatedAt:new Date().toISOString()});}},
  preferences:{label:'Trainingspräferenzen',planImpact:false,fields:[
    {key:'preferredSports',label:'Bevorzugte Sportarten',type:'text'},{key:'dislikedForms',label:'Unbeliebte Trainingsformen',type:'text'},
    {key:'sessionDuration',label:'Bevorzugte Einheitsdauer',type:'select',options:['30 min','45 min','60 min','75+ min']},{key:'indoorOutdoor',label:'Indoor/Outdoor',type:'select',options:['Indoor','Outdoor','egal']},
    {key:'trainingTimes',label:'Trainingszeiten',type:'select',options:['morgens','mittags','abends','flexibel']},{key:'intensity',label:'Bevorzugte Intensität',type:'select',options:['locker','gemischt','intensiv']},
    {key:'soloGroup',label:'Solo/Gruppe',type:'select',options:['Solo','Gruppe','beides']},{key:'avoidExercises',label:'Zu vermeidende Übungen',type:'text'},{key:'equipmentPlaces',label:'Geräte und Trainingsorte',type:'text'}],
    read:function(p){return Object.assign({},p.trainingPrefs);},write:function(p,d){p.trainingPrefs=Object.assign({},p.trainingPrefs,d,{updatedAt:new Date().toISOString()});}},
  devices:{label:'Geräte und Datenquellen',planImpact:false,fields:[{key:'dataSources',label:'Datenquellen (Komma-getrennt)',type:'text'}],
    read:function(p){return {dataSources:(p.dataSources||[]).join(', ')};},write:function(p,d){p.dataSources=String(d.dataSources||'').split(',').map(function(s){return s.trim();}).filter(Boolean);}}
};
function openProfileManager(){var M=pmModel();
  var cards=M.PROFILE_SECTIONS.map(function(s){return '<div class="gmcard"><div class="gmc-h">'+escH(s.label)+'</div>'+
    '<div class="gmc-acts"><button class="gmc-b" onclick="openProfileSection(\''+s.id+'\')">Bearbeiten</button></div></div>';}).join('');
  _modal('_profMgr','<h3>Profil verwalten</h3>'+cards+'<button class="btn sec" style="margin-top:12px" onclick="_closeM(\'_profMgr\')">Schließen</button>');}
function openProfileSection(id){
  if(id==='goals'){_closeM('_profMgr');openGoalsManager();return;}
  if(id==='sports'){openSportsEditor();return;}
  if(id==='availability'){openAvailabilityEditor();return;}
  if(id==='constraints'){openConstraintsEditor();return;}
  var def=SECTION_DEFS[id];if(!def)return;
  var data=def.read(PROFILE)||{};
  window._secEd={id:id,orig:JSON.stringify(data),data:JSON.parse(JSON.stringify(data))};
  var fieldsHTML=def.fields.map(function(f){return _gwField(f,window._secEd.data);}).join('');
  _modal('_secEdM','<h3>'+escH(def.label)+'</h3>'+fieldsHTML+
    '<button class="btn" onclick="saveProfileSection()">Speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="cancelProfileSection()">Abbrechen</button>');}
function _secCollect(){var def=SECTION_DEFS[window._secEd.id];var d=window._secEd.data;
  def.fields.forEach(function(f){var e=document.getElementById('gwf_'+f.key);if(!e)return;
    if(f.type==='bool')d[f.key]=e.checked;else if(f.type==='number')d[f.key]=e.value===''?null:(isNaN(parseFloat(e.value.replace(',','.')))?e.value:parseFloat(e.value.replace(',','.')));else d[f.key]=e.value;});}
function cancelProfileSection(){_secCollect();var S=window._secEd;
  if(pmModel().diffState(JSON.parse(S.orig),S.data)){
    _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_secEd\')">Änderungen verwerfen</button>');
  }else _closeM('_secEdM');}
function saveProfileSection(){_secCollect();var def=SECTION_DEFS[window._secEd.id];def.write(PROFILE,window._secEd.data);
  PROFILE.updatedAt=new Date().toISOString();if(typeof save==='function')save();else saveProfile();
  if(def.planImpact)maybePlanImpact(window._secEd.id,[window._secEd.id]);
  _closeM('_secEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Gespeichert');}

/* Sportarten bearbeiten (Mehrfachauswahl aus Trainings-Katalog, vorhandene vorausgefüllt). */
function _sportCatalog(){try{if(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.listSports)return ORVIA.trainingDomain.listSports().map(function(s){return {id:s.id,label:s.label||s.id};});}catch(e){}
  return ['running','cycling','swimming','gym','football','triathlon','handball','tennis','padel','athletics'].map(function(s){return {id:s,label:s};});}
function openSportsEditor(){var cat=_sportCatalog();var cur=(PROFILE.sports||[]).map(function(s){return typeof s==='string'?s:(s.sportId||s.customName);});
  window._secEd={id:'sports',orig:JSON.stringify(cur.slice().sort()),data:cur.slice()};
  _modal('_secEdM','<h3>Sportarten</h3><div class="gm-chips" id="sp_chips">'+cat.map(function(s){return '<button type="button" class="gm-chip'+(cur.indexOf(s.id)>=0?' on':'')+'" data-v="'+escH(s.id)+'" onclick="gmToggle(this)">'+escH(s.label)+'</button>';}).join('')+'</div>'+
    '<button class="btn" onclick="saveSportsEditor()">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="cancelSportsEditor()">Abbrechen</button>');}
function _spCollect(){var c=document.getElementById('sp_chips');return c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[];}
function cancelSportsEditor(){var sel=_spCollect();if(pmModel().diffState(JSON.parse(window._secEd.orig),sel.slice().sort())){
    _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_secEd\')">Änderungen verwerfen</button>');
  }else _closeM('_secEdM');}
function saveSportsEditor(){var sel=_spCollect();PROFILE.sports=sel.map(function(s){return {sportId:s,role:'supplemental'};});
  PROFILE.updatedAt=new Date().toISOString();if(typeof save==='function')save();else saveProfile();maybePlanImpact('sports',['sports']);
  _closeM('_secEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Sportarten gespeichert');}

/* Trainingsverfügbarkeit bearbeiten (pro Wochentag + Wochenlimits). */
var WD_DE={mo:'Mo',di:'Di',mi:'Mi',do:'Do',fr:'Fr',sa:'Sa',so:'So'};
function openAvailabilityEditor(){var M=pmModel();var av=M.normalizeAvailability(PROFILE.availability);
  window._secEd={id:'availability',orig:JSON.stringify(av),data:JSON.parse(JSON.stringify(av))};
  var tod=['','morgens','mittags','abends'];
  var rows=M.WEEKDAYS.map(function(d){var w=av.weekly[d];return '<div class="av-row"><b>'+WD_DE[d]+'</b>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_av"'+(w.available?' checked':'')+'>verfügbar</label>'+
    '<input type="number" id="av_'+d+'_min" placeholder="min" value="'+(w.maxMinutes!=null?w.maxMinutes:'')+'" style="width:64px">'+
    '<select id="av_'+d+'_tod">'+tod.map(function(t){return '<option'+(w.timeOfDay===t?' selected':'')+'>'+t+'</option>';}).join('')+'</select>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_team"'+(w.teamTraining?' checked':'')+'>Team</label>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_match"'+(w.matchDay?' checked':'')+'>Spieltag</label>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_dbl"'+(w.doubleSession?' checked':'')+'>Doppel</label>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_int"'+(w.intense?' checked':'')+'>intensiv</label>'+
    '<label class="av-cb"><input type="checkbox" id="av_'+d+'_rest"'+(w.restDay?' checked':'')+'>Ruhetag</label></div>';}).join('');
  _modal('_secEdM','<h3>Trainingsverfügbarkeit</h3><div class="av-grid">'+rows+'</div>'+
    '<div class="row2"><div class="gm-field"><label>Max. Einheiten/Woche</label><input type="number" id="av_maxS" value="'+(av.maxSessions!=null?av.maxSessions:'')+'"></div>'+
    '<div class="gm-field"><label>Max. intensive Einheiten</label><input type="number" id="av_maxI" value="'+(av.maxIntense!=null?av.maxIntense:'')+'"></div></div>'+
    '<div class="row2"><div class="gm-field"><label>Gewünschte Ruhetage</label><input type="number" id="av_rest" value="'+(av.desiredRestDays!=null?av.desiredRestDays:'')+'"></div>'+
    '<div class="gm-field"><label>Reise-/Arbeitstage</label><input id="av_travel" value="'+escH(av.travelDays||'')+'"></div></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="av_alt"'+(av.alternatingWeeks?' checked':'')+'><label>Wechselnde Wochen</label></div>'+
    '<button class="btn" onclick="saveAvailabilityEditor()">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="cancelAvailabilityEditor()">Abbrechen</button>');}
function _avCollect(){var M=pmModel();var w={};M.WEEKDAYS.forEach(function(d){function g(s){return document.getElementById('av_'+d+'_'+s);}
  w[d]={available:g('av').checked,maxMinutes:g('min').value===''?null:parseInt(g('min').value,10),timeOfDay:g('tod').value,teamTraining:g('team').checked,matchDay:g('match').checked,doubleSession:g('dbl').checked,intense:g('int').checked,restDay:g('rest').checked};});
  function n(id){var e=document.getElementById(id);return e&&e.value!==''?parseInt(e.value,10):null;}
  return M.normalizeAvailability({weekly:w,maxSessions:n('av_maxS'),maxIntense:n('av_maxI'),desiredRestDays:n('av_rest'),travelDays:(document.getElementById('av_travel')||{}).value||'',alternatingWeeks:(document.getElementById('av_alt')||{}).checked});}
function cancelAvailabilityEditor(){var cur=_avCollect();if(pmModel().diffState(JSON.parse(window._secEd.orig),cur)){
    _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_secEd\')">Änderungen verwerfen</button>');
  }else _closeM('_secEdM');}
function saveAvailabilityEditor(){PROFILE.availability=_avCollect();PROFILE.updatedAt=new Date().toISOString();
  if(typeof save==='function')save();else saveProfile();maybePlanImpact('availability',['availability']);
  _closeM('_secEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Verfügbarkeit gespeichert');}

/* Beschwerden und Einschränkungen (Liste, CRUD, Statuskreis). Keine Diagnose/Behandlung. */
var CSTR_STATUS_DE={active:'aktiv',improved:'verbessert',resolved:'behoben',observed:'pausiert beobachtet'};
function _constraintList(){return Array.isArray(PROFILE.constraintsList)?PROFILE.constraintsList:[];}
function openConstraintsEditor(){window._cmgr=true;var list=_constraintList();
  var cards=list.length?list.map(function(c){return '<div class="gmcard"><div class="gmc-h">'+escH(c.title||c.bodyRegion||'Beschwerde')+'</div>'+
    '<div class="gmc-meta">'+escH((c.bodyRegion||'')+' · '+(CSTR_STATUS_DE[c.status]||c.status)+(c.intensity!=null?' · Intensität '+c.intensity+'/10':''))+'</div>'+
    '<div class="gmc-acts"><button class="gmc-b" onclick="openConstraintEditor(\''+c.id+'\')">Bearbeiten</button>'+
    (c.status!=='improved'?'<button class="gmc-b" onclick="constraintStatus(\''+c.id+'\',\'improved\')">Verbessert</button>':'')+
    (c.status!=='resolved'?'<button class="gmc-b" onclick="constraintStatus(\''+c.id+'\',\'resolved\')">Behoben</button>':'')+
    (c.status!=='active'?'<button class="gmc-b" onclick="constraintStatus(\''+c.id+'\',\'active\')">Reaktivieren</button>':'')+
    '<button class="gmc-b" onclick="constraintStatus(\''+c.id+'\',\'observed\')">Archivieren</button>'+
    '<button class="gmc-b danger-btn" onclick="constraintRemove(\''+c.id+'\')">Löschen</button></div></div>';}).join(''):'<p class="note" style="text-align:left">Keine Beschwerden erfasst.</p>';
  _modal('_cstrMgr','<h3>Beschwerden und Einschränkungen</h3><p class="note" style="text-align:left">Hinweis: ORVIA gibt keine Diagnose und keine medizinische Behandlungsempfehlung.</p>'+
    '<button class="btn" onclick="openConstraintEditor()">Beschwerde hinzufügen</button>'+cards+
    '<button class="btn sec" style="margin-top:12px" onclick="_closeM(\'_cstrMgr\')">Schließen</button>');}
function openConstraintEditor(id){var c=id?_constraintList().filter(function(x){return x.id===id;})[0]:null;
  var st=['active','improved','resolved','observed'];
  _modal('_cstrEd','<h3>'+(c?'Beschwerde bearbeiten':'Beschwerde hinzufügen')+'</h3>'+
    '<div class="gm-field"><label>Körperregion</label><input id="c_region" value="'+escH(c?c.bodyRegion:'')+'"></div>'+
    '<div class="gm-field"><label>Titel</label><input id="c_title" value="'+escH(c?c.title:'')+'"></div>'+
    '<div class="gm-field"><label>Intensität (0–10)</label><input type="number" id="c_int" value="'+(c&&c.intensity!=null?c.intensity:'')+'"></div>'+
    '<div class="gm-field"><label>Auslöser</label><input id="c_trig" value="'+escH(c?c.triggers:'')+'"></div>'+
    '<div class="gm-field"><label>Seit</label><input id="c_since" value="'+escH(c?c.since:'')+'"></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="c_med"'+(c&&c.medicallyChecked?' checked':'')+'><label>Ärztlich abgeklärt</label></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="c_train"'+(!c||c.currentlyTrainable?' checked':'')+'><label>Aktuell trainierbar</label></div>'+
    '<div class="gm-field"><label>Anpassungen</label><input id="c_adapt" value="'+escH(c?c.adaptations:'')+'"></div>'+
    '<div class="gm-field"><label>Status</label><select id="c_status">'+st.map(function(s){return '<option value="'+s+'"'+(c&&c.status===s?' selected':'')+'>'+CSTR_STATUS_DE[s]+'</option>';}).join('')+'</select></div>'+
    '<button class="btn" onclick="saveConstraint(\''+(id||'')+'\')">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="_closeM(\'_cstrEd\')">Abbrechen</button>');}
function saveConstraint(id){var M=pmModel();function v(i){var e=document.getElementById(i);return e?e.value:'';}
  var raw={id:id||null,bodyRegion:v('c_region'),title:v('c_title'),intensity:v('c_int')===''?null:parseInt(v('c_int'),10),triggers:v('c_trig'),since:v('c_since'),
    medicallyChecked:(document.getElementById('c_med')||{}).checked,currentlyTrainable:(document.getElementById('c_train')||{}).checked,adaptations:v('c_adapt'),status:v('c_status')};
  var c=M.normalizeConstraint(raw);var list=_constraintList().slice();
  if(id){list=list.map(function(x){return x.id===id?c:x;});}else list.push(c);
  PROFILE.constraintsList=list;_persistConstraints();_closeM('_cstrEd');openConstraintsEditor();if(typeof toast==='function')toast('Beschwerde gespeichert');}
function constraintStatus(id,st){var M=pmModel();PROFILE.constraintsList=_constraintList().map(function(c){return c.id===id?M.normalizeConstraint(Object.assign({},c,{status:st})):c;});_persistConstraints();openConstraintsEditor();}
function constraintRemove(id){PROFILE.constraintsList=_constraintList().filter(function(c){return c.id!==id;});_persistConstraints();openConstraintsEditor();}
function _persistConstraints(){ // aktive Beschwerden in p.issues spiegeln (Altleser), Plan-Impact bündeln
  var active=_constraintList().filter(function(c){return c.status==='active';});
  PROFILE.issues=active.map(function(c){return c.bodyRegion||c.title;}).filter(Boolean);
  PROFILE.updatedAt=new Date().toISOString();if(typeof save==='function')save();else saveProfile();
  maybePlanImpact('constraints',['constraints']);}

/* Profil-Übersicht: kompakte Zusammenfassung, jeder Abschnitt direkt bearbeitbar. */
function openProfileSummary(){var M=pmModel();var act=listGoals().filter(function(g){return g.status==='active';}).slice().sort(function(a,b){return a.priority-b.priority;});
  var primary=act[0];var others=act.slice(1);
  var sports=(PROFILE.sports||[]).map(function(s){return typeof s==='string'?s:(s.sportId||s.customName);}).filter(Boolean);
  var av=M.normalizeAvailability(PROFILE.availability);var sess=av.maxSessions;
  var constraints=_constraintList().filter(function(c){return c.status==='active';}).map(function(c){return c.title||c.bodyRegion;});
  function sec(title,body,editId){return '<div class="ps-block"><div class="ps-h">'+escH(title)+(editId?'<button class="gmc-b" onclick="_closeM(\'_profSum\');openProfileSection(\''+editId+'\')">Bearbeiten</button>':'')+'</div>'+body+'</div>';}
  _modal('_profSum','<h3>Dein ORVIA-Profil</h3>'+
    sec('Hauptziel',primary?'<p>'+escH(primary.title)+'</p>':'<p class="note">—</p>','goals')+
    sec('Weitere Ziele',others.length?'<ul class="ps-list">'+others.map(function(g){return '<li>'+escH(g.title)+'</li>';}).join('')+'</ul>':'<p class="note">—</p>','goals')+
    sec('Sportarten',sports.length?'<p>'+escH(sports.join(', '))+'</p>':'<p class="note">—</p>','sports')+
    sec('Verfügbarkeit',sess!=null?'<p>'+sess+' Einheiten pro Woche</p>':'<p class="note">—</p>','availability')+
    sec('Aktive Einschränkungen',constraints.length?'<p>'+escH(constraints.join(', '))+'</p>':'<p class="note">keine</p>','constraints')+
    '<button class="btn sec" style="margin-top:12px" onclick="_closeM(\'_profSum\')">Schließen</button>');}
