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
/* ORVIA-Segment-Control: ersetzt native <select> (kein weißes Browser-Element).
   pairs=[[value,label],...]; Wert liegt auf dem Container (data-val). Einzelauswahl. */
function segHTML(id,pairs,cur,cb){var extra=cb?(';'+cb+'()'):'';return '<div class="seg-ctl" id="'+id+'" data-val="'+escH(cur!=null?cur:'')+'">'+
  pairs.map(function(p){return '<button type="button" class="seg-b'+(String(cur)===String(p[0])?' on':'')+'" data-v="'+escH(p[0])+'" onclick="segPick(this)'+extra+'">'+escH(p[1])+'</button>';}).join('')+'</div>';}
function segGroupedHTML(id,groups,cur){return '<div class="seg-ctl seg-grouped" id="'+id+'" data-val="'+escH(cur!=null?cur:'')+'">'+
  groups.map(function(g){return '<div class="seg-group">'+escH(g[0])+'</div>'+g[1].map(function(p){return '<button type="button" class="seg-b'+(String(cur)===String(p[0])?' on':'')+'" data-v="'+escH(p[0])+'" onclick="segPick(this)">'+escH(p[1])+'</button>';}).join('');}).join('')+'</div>';}
function segPick(btn){var box=btn.parentNode;while(box&&!(box.classList&&box.classList.contains('seg-ctl')))box=box.parentNode;if(!box)return;box.dataset.val=btn.dataset.v;Array.prototype.forEach.call(box.querySelectorAll('.seg-b'),function(b){if(b===btn)b.classList.add('on');else b.classList.remove('on');});}
function _segVal(id){var e=document.getElementById(id);return e?(e.dataset?e.dataset.val:e.getAttribute('data-val')):null;}
function pmModel(){return window.ORVIA&&ORVIA.profileModel;}
function ensureProfileGoals(){var M=pmModel();if(!M||!PROFILE)return;
  if(!Array.isArray(PROFILE.goals)){var mig=M.migrateProfile(PROFILE);PROFILE.goals=mig.goals;PROFILE.profileVersion=2;}
  else PROFILE.goals=M.normalizeGoals(PROFILE.goals);
  applyLegacyProjection();}
function applyLegacyProjection(){var M=pmModel();if(!M||!PROFILE)return;var pr=M.buildLegacyProjection(PROFILE);
  PROFILE.primaryGoal=pr.primaryGoal;PROFILE.primaryGoalLabel=pr.primaryGoalLabel;PROFILE.secondaryGoals=pr.secondaryGoals;
  if(pr.raceDate)PROFILE.raceDate=pr.raceDate;if(pr.hmTargetMin!=null)PROFILE.hmTargetMin=pr.hmTargetMin;}
function listGoals(){ensureProfileGoals();return PROFILE.goals||[];}
/* ZENTRALER Profil-Speichervorgang (Inkrement 4b): aktualisiert Legacy-Projektionen (Ziele→primaryGoal…
   und Beschwerden→issues[]) IMMER zentral, speichert atomar offline-first (bestehender Cloud-Hook via
   saveProfile→ORVIA_onSave bleibt erhalten) und löst genau EIN orvia:profile-updated-Event aus. */
function _profileSave(changedSections){var M=pmModel();
  if(M&&PROFILE){applyLegacyProjection();
    if(Array.isArray(PROFILE.constraintsList))PROFILE.issues=M.constraintIssueKeys(PROFILE);
    /* M1b (ADR D2/D6): Section-Metadaten zentral pflegen. Quelle einheitlich 'editor'
       (Onboarding-Quelle wird erst mit dem neuen Setup gesetzt — nicht vortäuschen).
       Setzt NUR updatedAt/source, markiert nichts als vollständig. Fail-safe. */
    try{if(typeof M.touchSectionMeta==='function')M.touchSectionMeta(PROFILE,changedSections||[],'editor');}catch(e){}}
  PROFILE.updatedAt=new Date().toISOString();
  if(typeof save==='function')save();else saveProfile();
  try{if(typeof window!=='undefined'&&window.dispatchEvent)window.dispatchEvent(new CustomEvent('orvia:profile-updated',{detail:{changedSections:changedSections||[],updatedAt:PROFILE.updatedAt}}));}catch(e){}}
// Persistiert goals[] atomar + Legacy-Projektion + Event. Plan-Impact separat über maybePlanImpact.
function commitGoals(ng){PROFILE.goals=ng;_profileSave(['goals']);
  try{renderProfileScreen();}catch(e){} try{if(window._goalsMgr)renderGoalsList();}catch(e){}}
/* Öffentlicher Profil-Adapter: einzige produktive API für neue Oberflächen (lesen/schreiben/abonnieren). */
(function(){var O=(typeof window!=='undefined'?window:globalThis).ORVIA=(typeof window!=='undefined'?window:globalThis).ORVIA||{};
  O.profile={
    load:function(){if(!PROFILE&&typeof ensureProfile==='function')ensureProfile();return PROFILE;},
    get:function(){return PROFILE;},
    save:function(sections){_profileSave(sections||[]);},
    updateSection:function(id,patch,sections){if(!PROFILE)return;if(patch&&typeof patch==='object')Object.keys(patch).forEach(function(k){PROFILE[k]=patch[k];});_profileSave(sections||[id]);},
    subscribe:function(fn){try{window.addEventListener('orvia:profile-updated',fn);}catch(e){}return function(){try{window.removeEventListener('orvia:profile-updated',fn);}catch(e){}};},
    migrate:function(){var M=pmModel();if(M&&PROFILE){var c=M.consolidateProfile(PROFILE);Object.keys(c).forEach(function(k){PROFILE[k]=c[k];});}return PROFILE;},
    buildLegacyProjection:function(){return pmModel().buildLegacyProjection(PROFILE);},
    getFieldUsage:function(p){return pmModel().getFieldUsage(p);},
    buildSummary:function(){return pmModel().buildProfileSummary(PROFILE);},
    activeSports:function(){return pmModel().normalizeSports(PROFILE&&PROFILE.sports).filter(function(s){return s.activeInApp;});},
    planSports:function(){return pmModel().normalizeSports(PROFILE&&PROFILE.sports).filter(function(s){return s.includeInPlan;});},
    sportById:function(id){return pmModel().normalizeSports(PROFILE&&PROFILE.sports).filter(function(s){return s.sportId===id;})[0]||null;},
    // Sportarten für „Training starten"/Schnellaktionen: Hauptsportart zuerst, dann weitere aktive.
    trainingStartSports:function(){return O.profile.activeSports().slice().sort(function(a,b){return (a.role==='primary'?0:1)-(b.role==='primary'?0:1);});},
    manualActivitySports:function(){return O.profile.trainingStartSports();},
    activeConstraints:function(){return pmModel().activeConstraints(PROFILE||{});},
    // Bestandsnutzer (Daten/abgeschlossen) → kein Pflicht-Onboarding.
    needsOnboarding:function(){if(!PROFILE&&typeof ensureProfile==='function')ensureProfile();return !pmModel().isOnboardingComplete(PROFILE||{});},
    markOnboardingComplete:function(){if(!PROFILE)return;PROFILE.onboarding=pmModel().normalizeOnboarding(Object.assign({},PROFILE.onboarding,{status:'completed',completedAt:new Date().toISOString()}),PROFILE);_profileSave(['onboarding']);}
  };})();
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
/* ============================================================
   ORVIA · Sheet-/Modal-Infrastruktur (Phase 4j.1)
   - genau EIN Scrollcontainer pro Sheet (.orvia-sheet-scroll)
   - Header und Action-Bar liegen AUSSERHALB des Scrollbereichs
   - Sheet-Stack: nur ein sichtbares scrollbares Sheet
   - Scroll-Lock des Hintergrunds, Fokus-Verwaltung, Escape (Desktop)
   - jüngstes Overlay liegt oben (gemeinsamer z-index-Zähler für Modal + Sheet)
   Keine Fachlogik – reine Infrastruktur.
   ============================================================ */
var _sheetStack=[];          // [{id, trigger}] – aktueller Sheet-Stapel
var _modalStack=[];          // [{id, trigger}] – aktueller Modal-Stapel (kurze Dialoge über Sheets)
var _sheetLockCount=0;       // Referenzzähler für Hintergrund-Scroll-Lock
var _zTop=650;               // Basis über .orvia-modal-bg; jüngstes Overlay oben
function _nextZ(){_zTop+=1;return _zTop;}
function _sheetLock(on){
  try{
    if(on){_sheetLockCount++;if(_sheetLockCount===1&&typeof document!=='undefined'&&document.body&&document.body.classList)document.body.classList.add('sheet-open');}
    else{if(_sheetLockCount>0)_sheetLockCount--;if(_sheetLockCount===0&&typeof document!=='undefined'&&document.body&&document.body.classList)document.body.classList.remove('sheet-open');}
  }catch(e){}
}
function _sheetEntry(id){for(var i=0;i<_sheetStack.length;i++){if(_sheetStack[i].id===id)return _sheetStack[i];}return null;}
function _sheetTop(){return _sheetStack.length?_sheetStack[_sheetStack.length-1]:null;}
function _modalEntry(id){for(var i=0;i<_modalStack.length;i++){if(_modalStack[i].id===id)return _modalStack[i];}return null;}
function _modalTop(){return _modalStack.length?_modalStack[_modalStack.length-1]:null;}
function _showSheetEl(id,show){var w=window[id];if(!w)return;try{if(w.style)w.style.display=show?'':'none';if(show){if(w.removeAttribute)w.removeAttribute('aria-hidden');}else if(w.setAttribute)w.setAttribute('aria-hidden','true');}catch(e){}}
function _focusSheet(id){var w=window[id];if(!w||!w.querySelector)return;try{var x=w.querySelector('.orvia-sheet-x');if(x&&typeof x.focus==='function')x.focus();}catch(e){}}
function _closeM(id){
  var w=window[id];var entry=_sheetEntry(id);var mEntry=_modalEntry(id);
  if(w){try{w.remove();}catch(e){}window[id]=null;}
  if(mEntry){
    _modalStack=_modalStack.filter(function(s){return s.id!==id;});
    // Fokus zurück zum Auslöser (z. B. Button im darunterliegenden Sheet).
    if(mEntry.trigger&&typeof mEntry.trigger.focus==='function'){try{mEntry.trigger.focus();}catch(e){}}
  }
  if(entry){
    _sheetStack=_sheetStack.filter(function(s){return s.id!==id;});
    _sheetLock(false);
    var top=_sheetTop();
    if(top){_showSheetEl(top.id,true);_focusSheet(top.id);}
    else if(entry.trigger&&typeof entry.trigger.focus==='function'){try{entry.trigger.focus();}catch(e){}}
  }
}
/* Kurze Bestätigungs-/Info-Dialoge: zentriertes Modal (bewusst NICHT als Sheet).
   Härtung (Profil-Paket 2026-07): role=dialog + aria-modal, initialer Fokus auf den Dialog,
   Fokus-Restore zum Auslöser beim Schließen (_closeM), Escape schließt das oberste Modal
   (s. _sheetKeydown). Scroll-Owner ist AUSSCHLIESSLICH .orvia-modal (styles.css). */
function _modal(id,inner){
  _closeM(id);
  var trigger=null;try{trigger=(typeof document!=='undefined'&&document.activeElement)||null;}catch(e){}
  var w=document.createElement('div');w.className='orvia-modal-bg';
  try{if(w.style)w.style.zIndex=_nextZ();}catch(e){}
  w.innerHTML='<div class="orvia-modal goal-modal" role="dialog" aria-modal="true" tabindex="-1">'+inner+'</div>';
  document.body.appendChild(w);window[id]=w;
  w.addEventListener('click',function(ev){if(ev.target===w)_closeM(id);});
  _modalStack.push({id:id,trigger:trigger});
  try{var box=w.querySelector&&w.querySelector('.orvia-modal');if(box&&typeof box.focus==='function')box.focus();}catch(e){}
  return w;
}
/* Lange Editoren als produktreife mobile Sheets.
   opts: {id, title, body, actions, size('full'|'large'), onClose} */
function openSheet(opts){
  opts=opts||{};var id=opts.id;
  var trigger=null;try{trigger=(typeof document!=='undefined'&&document.activeElement)||null;}catch(e){}
  _closeM(id);
  var size=opts.size||'full';var titleId=id+'__t';
  var w=document.createElement('div');w.className='orvia-sheet-backdrop';
  try{if(w.style)w.style.zIndex=_nextZ();}catch(e){}
  w.innerHTML=
    '<section class="orvia-sheet orvia-sheet--'+size+'" role="dialog" aria-modal="true" aria-labelledby="'+titleId+'">'+
      '<header class="orvia-sheet-header">'+
        '<h2 class="orvia-sheet-title" id="'+titleId+'">'+(opts.title||'')+'</h2>'+
        '<button type="button" class="orvia-sheet-x" data-sheet-close="'+id+'" aria-label="Schließen">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'+
        '</button>'+
      '</header>'+
      '<div class="orvia-sheet-scroll">'+(opts.body||'')+'</div>'+
      (opts.actions!=null?'<footer class="orvia-sheet-actions">'+opts.actions+'</footer>':'')+
    '</section>';
  document.body.appendChild(w);window[id]=w;
  var onClose=opts.onClose||function(){_closeM(id);};w._orviaClose=onClose;
  w.addEventListener('click',function(ev){
    var t=ev.target;var btn=t&&t.closest?t.closest('[data-sheet-close]'):null;
    if(btn){onClose();return;}
  });
  var prev=_sheetTop();if(prev)_showSheetEl(prev.id,false);
  _sheetStack.push({id:id,trigger:trigger});
  _sheetLock(true);_focusSheet(id);
  return w;
}
/* Escape schließt das oberste Overlay: zuerst eigene Modals (_modalStack, oberstes zuerst),
   dann Sheets. FREMDE .orvia-modal-bg (z. B. System-/Migrations-Dialoge aus ui.js/activity.js,
   nicht über _modal() erzeugt) werden bewusst NICHT geschlossen. */
function _sheetKeydown(ev){
  if(!ev||(ev.key!=='Escape'&&ev.keyCode!==27))return;
  var m=_modalTop();
  if(m){_closeM(m.id);return;}
  try{if(document.querySelector&&document.querySelector('.orvia-modal-bg'))return;}catch(e){}
  var top=_sheetTop();if(!top)return;var w=window[top.id];if(!w)return;
  if(typeof w._orviaClose==='function')w._orviaClose();
}
try{if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('keydown',_sheetKeydown);}catch(e){}

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
  openSheet({id:'_goalEd',title:(id?'Ziel bearbeiten':'Ziel hinzufügen'),onClose:gwCancel,body:'<div id="gwBody"></div>',actions:'<div id="gwNav" class="gw-nav"></div>'});gwRender();}
function gwRender(){var box=document.getElementById('gwBody');if(!box)return;var W=window._gw;var st=GW_STEPS[W.step];
  var prog='<div class="gw-prog">'+GW_STEPS.map(function(s,i){return '<span class="gw-dot'+(i===W.step?' on':'')+(i<W.step?' done':'')+'"></span>';}).join('')+'</div>'+
    '<div class="gw-steplabel">Schritt '+(W.step+1)+' von '+GW_STEPS.length+' · '+escH(st.label)+'</div>';
  box.innerHTML=prog+'<div id="gwStep">'+_gwStepHTML(st.key)+'</div>';
  var nav=document.getElementById('gwNav');
  if(nav)nav.innerHTML=
    (W.step>0?'<button class="btn sec" onclick="gwBack()">Zurück</button>':'<button class="btn sec" onclick="gwCancel()">Abbrechen</button>')+
    (W.step<GW_STEPS.length-1?'<button class="btn" onclick="gwNext()">Weiter</button>':'<button class="btn" onclick="gwSave()">'+(W.id?'Speichern':'Ziel anlegen')+'</button>');}
function _gwField(f,cd){var id='gwf_'+f.key;var v=cd[f.key];var lab='<label>'+escH(f.label)+(f.unit?' ('+escH(f.unit)+')':'')+'</label>';
  if(f.type==='bool')return '<div class="gm-field gm-inline"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+'>'+lab+'</div>';
  if(f.type==='select'){var pairs=f.optionPairs?f.optionPairs:(f.options||[]).map(function(o){return [o,o];});return '<div class="gm-field">'+lab+segHTML(id,pairs,v)+'</div>';}
  if(f.type==='longtext')return '<div class="gm-field">'+lab+'<textarea id="'+id+'" rows="2">'+escH(v!=null?v:'')+'</textarea></div>';
  var t=f.type==='number'?'number':(f.type==='date'?'date':'text');
  return '<div class="gm-field">'+lab+'<input type="'+t+'" id="'+id+'" value="'+escH(v!=null?v:'')+'"></div>';}
function _gwStepHTML(key){var M=pmModel();var d=window._gw.draft;
  if(key==='type'){var groups=[];for(var grp in M.GOAL_CATEGORIES){groups.push([GOAL_GROUP_DE[grp]||grp,M.GOAL_CATEGORIES[grp].map(function(c){return [c,goalCatLabel(c)];})]);}
    return '<div class="gm-field"><label>Worum geht es?</label>'+segGroupedHTML('gw_cat',groups,d.category)+'</div>'+
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
    return '<div class="gm-field"><label>Zeitraum</label>'+segHTML('gw_hz',horizons,d.timeHorizon||'open')+'</div>'+
      '<div class="gm-field"><label>Zieldatum (optional)</label><input type="date" id="gw_date" value="'+escH(d.targetDate||'')+'"><span class="ob2-err" id="gw_err" role="alert"></span></div>'+
      '<div class="row2"><div class="gm-field"><label>Aktuell (optional)</label><input id="gw_cur" value="'+escH(d.currentValue!=null?d.currentValue:'')+'"></div>'+
      '<div class="gm-field"><label>Ziel (optional)</label><input id="gw_tgt" value="'+escH(d.targetValue!=null?d.targetValue:'')+'"></div></div>'+
      '<div class="gm-field"><label>Einheit (optional)</label><input id="gw_unit" value="'+escH(d.unit||'')+'" placeholder="z. B. min, kg, m"></div>';}
  if(key==='role'){var roles=[['main','Hauptziel'],['secondary','Sekundäres Entwicklungsziel'],['maintain','Erhaltungsziel'],['longterm','Langfristiges Hintergrundziel']];
    return '<div class="gm-field"><label>Welche Rolle hat dieses Ziel?</label>'+segHTML('gw_role',roles,d.role||'secondary')+'</div>'+
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
  if(st==='type'){var c=_segVal('gw_cat');if(c!=null&&c!=='')d.category=c;var t=val('gw_title');if(t!=null)d.title=t.trim();var ds=val('gw_desc');if(ds!=null)d.description=ds;}
  else if(st==='details'){var M=pmModel();M.categoryFieldsFor(d.category).forEach(function(f){if(f.type==='select'){var sv=_segVal('gwf_'+f.key);if(sv!=null)d.categoryData[f.key]=sv;return;}var e=document.getElementById('gwf_'+f.key);if(!e)return;if(f.type==='bool')d.categoryData[f.key]=e.checked;else if(f.type==='number'){d.categoryData[f.key]=e.value===''?null:(isNaN(parseFloat(e.value.replace(',','.')))?e.value:parseFloat(e.value.replace(',','.')));}else d.categoryData[f.key]=e.value;});
    var fc=document.getElementById('gw_focus');if(fc)d.categoryData.focus=Array.prototype.slice.call(fc.querySelectorAll('.on')).map(function(b){return b.dataset.v;});}
  else if(st==='sports'){var sc=document.getElementById('gw_sports');if(sc)d.sports=Array.prototype.slice.call(sc.querySelectorAll('.on')).map(function(b){return b.dataset.v;});}
  else if(st==='metrics'){var hz=_segVal('gw_hz');if(hz!=null&&hz!=='')d.timeHorizon=hz;var dt=val('gw_date');d.targetDate=dt||null;d.currentValue=_gwNum('gw_cur');d.targetValue=_gwNum('gw_tgt');var u=val('gw_unit');d.unit=(u||'').trim()||null;}
  else if(st==='role'){var r=_segVal('gw_role');if(r!=null&&r!=='')d.role=r;}}
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
    {key:'birthDate',label:'Geburtsdatum',type:'date'},{key:'sex',label:'Geschlecht',type:'select',optionPairs:[['m','Männlich'],['w','Weiblich'],['d','Divers'],['','Keine Angabe']]}],
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
  if(id==='sports'){openSportsManager();return;}
  if(id==='availability'){openAvailabilityEditor();return;}
  if(id==='constraints'){openConstraintsEditor();return;}
  if(id==='body'){openPerformanceManager();return;}
  if(id==='recovery'){openRecoveryEditor();return;}
  if(id==='preferences'){openPreferencesEditor();return;}
  if(id==='devices'){openDevicesManager();return;}
  var def=SECTION_DEFS[id];if(!def)return;
  var data=def.read(PROFILE)||{};
  window._secEd={id:id,orig:JSON.stringify(data),data:JSON.parse(JSON.stringify(data))};
  var fieldsHTML=def.fields.map(function(f){return _gwField(f,window._secEd.data);}).join('');
  _modal('_secEdM','<h3>'+escH(def.label)+'</h3>'+fieldsHTML+
    '<button class="btn" onclick="saveProfileSection()">Speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="cancelProfileSection()">Abbrechen</button>');}
function _secCollect(){var def=SECTION_DEFS[window._secEd.id];var d=window._secEd.data;
  def.fields.forEach(function(f){if(f.type==='select'){var sv=_segVal('gwf_'+f.key);if(sv!=null)d[f.key]=sv;return;}var e=document.getElementById('gwf_'+f.key);if(!e)return;
    if(f.type==='bool')d[f.key]=e.checked;else if(f.type==='number')d[f.key]=e.value===''?null:(isNaN(parseFloat(e.value.replace(',','.')))?e.value:parseFloat(e.value.replace(',','.')));else d[f.key]=e.value;});}
function cancelProfileSection(){_secCollect();var S=window._secEd;
  if(pmModel().diffState(JSON.parse(S.orig),S.data)){
    _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_secEd\')">Änderungen verwerfen</button>');
  }else _closeM('_secEdM');}
function saveProfileSection(){_secCollect();var def=SECTION_DEFS[window._secEd.id];def.write(PROFILE,window._secEd.data);
  _profileSave([window._secEd.id]);
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
function saveSportsEditor(){var M=pmModel();var sel=_spCollect();
  // Bestehende Sport-Flags (activeInApp/includeInPlan/role…) erhalten, fehlende neu anlegen, dann normalisieren.
  var existing={};(M.normalizeSports(PROFILE.sports)||[]).forEach(function(s){existing[String(s.sportId).toLowerCase()]=s;});
  PROFILE.sports=M.normalizeSports(sel.map(function(id){return existing[String(id).toLowerCase()]||{sportId:id};}));
  _profileSave(['sports']);maybePlanImpact('sports',['sports']);
  _closeM('_secEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Sportarten gespeichert');}

/* ============================================================
   SPORTARTEN-MANAGER + sportartspezifischer Profil-Editor (Inkrement 4c).
   Schema-getrieben aus ORVIA.profileModel.SPORT_PROFILE_SCHEMAS. ORVIA-Komponenten, keine Selects.
   ============================================================ */
var SPORT_ROLE_DE={primary:'Hauptsportart',secondary:'Nebensportart',supplemental:'Ergänzend',occasional:'Gelegentlich'};
function _sportLabel(s){var M=pmModel();var sc=M.sportProfileSchema(s.sportId);return s.customName||(sc&&sc.label)||s.sportId;}
function _sportCardSummary(s){var M=pmModel();var sp=s.sportProfile;if(!sp)return '';var bits=[];
  var sc=M.sportProfileSchema(s.sportId);
  if(sp.primaryPosition&&sc){var pos=(sc.positions||[]).filter(function(p){return p[0]===sp.primaryPosition;})[0];if(pos)bits.push(pos[1]);
    var role=M.rolesForPosition(s.sportId,sp.primaryPosition).filter(function(r){return r[0]===sp.playingRole;})[0];if(role)bits.push(role[1]);else if(sp.customRole)bits.push(sp.customRole);}
  if(sp.teamSessionsPerWeek)bits.push(sp.teamSessionsPerWeek+' Teamtrainings');
  if(sp.matchDay){var md={monday:'Mo',tuesday:'Di',wednesday:'Mi',thursday:'Do',friday:'Fr',saturday:'Sa',sunday:'So',varies:'wechselnd'}[sp.matchDay]||sp.matchDay;bits.push('Spiel '+md);}
  var fl=sp.fields||{};
  if(fl.variant)bits.unshift(fl.variant);
  if(s.sportId==='gym'){if(fl.goal)bits.push(fl.goal);if(fl.split)bits.push(fl.split);
    if(Array.isArray(fl.linkedSports)&&fl.linkedSports.length){var ls=fl.linkedSports.map(function(id){var sc2=pmModel().sportProfileSchema(id);return (sc2&&sc2.label)||id;});bits.push('Für '+ls.join(' und '));}}
  if(s.sportId==='hyrox'){if(fl.category)bits.push(fl.category);if(fl.level)bits.push(fl.level);if(fl.targetTime)bits.push('Zielzeit '+fl.targetTime);
    if(fl.weakestStation)bits.push('Schwächste Station: '+fl.weakestStation);}
  return bits.length?'<div class="gmc-meta">'+escH(bits.join(' · '))+'</div>':'';}
function openSportsManager(){var M=pmModel();var sports=M.normalizeSports(PROFILE.sports);
  var cards=sports.length?sports.map(function(s){return '<div class="gmcard"><div class="gmc-h">'+escH(_sportLabel(s))+'</div>'+
    '<div class="gmc-meta">'+escH(SPORT_ROLE_DE[s.role]||'Ergänzend')+(s.activeInApp?' · in App sichtbar':'')+(s.includeInPlan?' · in Planung':'')+'</div>'+
    _sportCardSummary(s)+
    '<div class="gmc-acts">'+(M.sportProfileSchema(s.sportId)?'<button class="gmc-b" onclick="openSportProfileEditor(\''+escH(s.sportId)+'\')">Profil bearbeiten</button>':'<span class="gmc-meta">Kein Spezialprofil für diese Sportart</span>')+'</div></div>';}).join(''):'<p class="note" style="text-align:left">Noch keine Sportarten gewählt.</p>';
  _modal('_sportMgr','<h3>Sportarten</h3>'+cards+
    '<button class="btn sec" style="margin-top:12px" onclick="openSportsEditor()">Sportarten auswählen</button>'+
    '<button class="btn sec" style="margin-top:8px" onclick="_closeM(\'_sportMgr\')">Schließen</button>');}

function _sppField(f,vals){var id='spp_'+f[0];var v=vals[f[0]];var type=f[2];var lab='<label>'+escH(f[1])+(f[3]&&typeof f[3]==='string'?' ('+escH(f[3])+')':'')+'</label>';
  if(f[0]==='linkedSports'){ // Mehrfachauswahl aus aktiven Profilsportarten (ohne gym selbst). Kein Freitext.
    var act=(window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports().filter(function(s){return s.sportId!=='gym';}):[];
    var sel=Array.isArray(v)?v:[];
    if(!act.length)return '<div class="gm-field">'+lab+'<p class="note" style="text-align:left">Keine weiteren aktiven Sportarten vorhanden.</p></div>';
    return '<div class="gm-field">'+lab+'<div class="gm-chips" id="'+id+'">'+act.map(function(s){var name=s.customName||_sportLabel(s);return '<button type="button" class="gm-chip'+(sel.indexOf(s.sportId)>=0?' on':'')+'" data-v="'+escH(s.sportId)+'" onclick="gmToggle(this)">'+escH(name)+'</button>';}).join('')+'</div></div>';}
  if(type==='bool')return '<div class="gm-field gm-inline"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+'>'+lab+'</div>';
  if(type==='select')return '<div class="gm-field">'+lab+segHTML(id,(f[3]||[]).map(function(o){return [o,o];}),v)+'</div>';
  var t=type==='number'?'number':'text';
  return '<div class="gm-field">'+lab+'<input type="'+t+'" id="'+id+'" value="'+escH(v!=null?v:'')+'"></div>';}
function openSportProfileEditor(sportId){var M=pmModel();var sc=M.sportProfileSchema(sportId);if(!sc)return;
  var sports=M.normalizeSports(PROFILE.sports);var s=sports.filter(function(x){return x.sportId===sportId;})[0];if(!s)return;
  var sp=s.sportProfile||M.normalizeSportProfile(sportId,{});
  window._sppEd={sportId:sportId,role:s.role,orig:JSON.stringify({role:s.role,sp:sp}),sp:JSON.parse(JSON.stringify(sp))};
  openSheet({id:'_sppEdM',title:escH(sc.label+' — Profil'),onClose:cancelSportProfileEditor,body:'<div id="sppBody"></div>',
    actions:'<button class="btn" onclick="saveSportProfileEditor()">Speichern</button><button class="btn sec" onclick="cancelSportProfileEditor()">Abbrechen</button>'});renderSportProfileEditor();}
function renderSportProfileEditor(){var M=pmModel();var E=window._sppEd;var sc=M.sportProfileSchema(E.sportId);var sp=E.sp;var box=document.getElementById('sppBody');if(!box)return;
  var html='';
  // Rolle & Niveau
  html+='<div class="gm-field"><label>Rolle dieser Sportart</label>'+segHTML('spp_sportrole',[['primary','Hauptsportart'],['secondary','Nebensportart'],['supplemental','Ergänzend'],['occasional','Gelegentlich']],E.role)+'</div>';
  html+='<div class="gm-field"><label>Niveau</label>'+segHTML('spp_level',M.LEVELS,sp.competitionLevel)+'</div>';
  if(sc.type==='team'){
    html+='<p class="note" style="text-align:left">Wie nutzt ORVIA das? Position und Rolle beeinflussen später die Gewichtung von Sprint, Ausdauer, Kraft, Richtungswechseln und Regeneration.</p>';
    if(sc.variants){html+='<div class="gm-field"><label>Variante</label>'+segHTML('spp_variant',sc.variants.map(function(v){return [v,v];}),sp.fields&&sp.fields.variant||sc.variants[0],'sppVariantChange')+'</div>';}
    var posList=sc.variants?M.positionsForVariant(E.sportId,(sp.fields&&sp.fields.variant)||sc.variants[0]):sc.positions;
    html+='<div id="spp_posWrap"><div class="gm-field"><label>Hauptposition</label>'+segHTML('spp_pos',posList,sp.primaryPosition,'sppPosChange')+'</div>'+
      (sp._variantHint?'<p class="ob2-err" role="alert">Bitte Position für die neue Variante neu wählen.</p>':'')+'<div id="spp_roleWrap">'+_sppRoleHTML()+'</div></div>';
    var others=posList.filter(function(p){return ['multi_position','custom'].indexOf(p[0])<0;});
    html+='<div class="gm-field"><label>Weitere Positionen (optional)</label><div class="gm-chips" id="spp_secpos">'+others.map(function(p){return '<button type="button" class="gm-chip'+(sp.secondaryPositions.indexOf(p[0])>=0?' on':'')+'" data-v="'+p[0]+'" onclick="gmToggle(this)">'+escH(p[1])+'</button>';}).join('')+'</div></div>';
    html+='<div class="row2"><div class="gm-field"><label>Teamtrainings/Woche</label><input type="number" id="spp_team" value="'+(sp.teamSessionsPerWeek!=null?sp.teamSessionsPerWeek:'')+'"></div>'+
      '<div class="gm-field"><label>Einsatzminuten</label><input type="number" id="spp_min" value="'+(sp.typicalMatchMinutes!=null?sp.typicalMatchMinutes:'')+'"></div></div>';
    html+='<div class="gm-field"><label>Spieltag</label>'+segHTML('spp_matchday',[['monday','Mo'],['tuesday','Di'],['wednesday','Mi'],['thursday','Do'],['friday','Fr'],['saturday','Sa'],['sunday','So'],['varies','wechselnd']],sp.matchDay)+'</div>';
    html+='<div class="gm-field"><label>Einsatz</label>'+segHTML('spp_lineup',[['starter','Startelf'],['sub','Einwechselspieler'],['varies','wechselnd']],sp.lineupStatus)+'</div>';
    html+='<div class="gm-field"><label>Saisonphase</label>'+segHTML('spp_season',M.SEASON_PHASES,sp.seasonPhase)+'</div>';
    html+='<div class="gm-field"><label>Zusätzliche eigene Einheiten/Woche</label><input type="number" id="spp_extra" value="'+(sp.extraSessions!=null?sp.extraSessions:'')+'"></div>';
  } else {
    html+=(sc.fields||[]).map(function(f){return _sppField(f,sp.fields);}).join('');
  }
  // Leistungsziele (Mehrfachauswahl)
  var areas=M.performanceAreasFor(E.sportId);
  if(areas.length){var selKeys=sp.performancePriorities.map(function(p){return p.key;});
    html+='<p class="note" style="text-align:left">Leistungsziele beeinflussen später die Trainingsgewichtung (noch keine automatische Planung).</p>';
    html+='<div class="gm-field"><label>Leistungsziele</label><div class="gm-chips" id="spp_perf">'+areas.map(function(a){return '<button type="button" class="gm-chip'+(selKeys.indexOf(a[0])>=0?' on':'')+'" data-v="'+a[0]+'" onclick="gmToggle(this)">'+escH(a[1])+'</button>';}).join('')+'</div></div>';}
  // Beschwerden-Verknüpfung (aus zentralen aktiven Beschwerden)
  var ac=(window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeConstraints)?ORVIA.profile.activeConstraints():[];
  if(ac.length){html+='<div class="gm-field"><label>Relevante Beschwerden</label><div class="gm-chips" id="spp_constr">'+ac.map(function(c){var k=c.bodyRegion||c.title;return '<button type="button" class="gm-chip'+(sp.constraints.indexOf(k)>=0?' on':'')+'" data-v="'+escH(k)+'" onclick="gmToggle(this)">'+escH(c.title||c.bodyRegion)+'</button>';}).join('')+'</div></div>';}
  box.innerHTML=html;}
function _sppRoleHTML(){var M=pmModel();var E=window._sppEd;var pos=E.sp.primaryPosition;var roles=pos?M.rolesForPosition(E.sportId,pos):[];
  if(!roles.length)return '';
  if(pos==='custom'||pos==='multi_position')return '<div class="gm-field"><label>Eigene Rolle</label><input id="spp_customrole" value="'+escH(E.sp.customRole||'')+'"></div>';
  return '<div class="gm-field"><label>Spielrolle</label>'+segHTML('spp_role',roles,E.sp.playingRole)+'</div>';}
function sppPosChange(){_sppCollectInto(window._sppEd.sp);window._sppEd.sp._variantHint=false;var w=document.getElementById('spp_roleWrap');if(w)w.innerHTML=_sppRoleHTML();}
// Variantenwechsel (Volleyball/Hockey): kompatible Werte erhalten, inkompatible Position neu wählen lassen.
function sppVariantChange(){var M=pmModel();var E=window._sppEd;_sppCollectInto(E.sp);
  var variant=_segVal('spp_variant');E.sp.fields=E.sp.fields||{};E.sp.fields.variant=variant;
  var valid=M.positionsForVariant(E.sportId,variant).map(function(p){return p[0];});
  if(E.sp.primaryPosition&&valid.indexOf(E.sp.primaryPosition)<0){E.sp.primaryPosition=null;E.sp.playingRole=null;E.sp._variantHint=true;}else E.sp._variantHint=false;
  renderSportProfileEditor();}
function _sppCollectInto(sp){var M=pmModel();var sc=M.sportProfileSchema(window._sppEd.sportId);
  function v(id){var e=document.getElementById(id);return e?e.value:undefined;}
  function n(id){var x=v(id);return x===undefined||x===''?null:(isNaN(parseFloat(x))?x:parseFloat(x));}
  function chips(id){var c=document.getElementById(id);return c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):null;}
  window._sppEd.role=_segVal('spp_sportrole')||window._sppEd.role;
  sp.competitionLevel=_segVal('spp_level')||sp.competitionLevel;
  if(sc.type==='team'){
    if(sc.variants){var vv=_segVal('spp_variant');if(vv!=null&&vv!==''){sp.fields=sp.fields||{};sp.fields.variant=vv;}}
    var ps=_segVal('spp_pos');if(ps!=null&&ps!=='')sp.primaryPosition=ps;
    var r=_segVal('spp_role');if(r!=null&&r!=='')sp.playingRole=r;
    var cr=v('spp_customrole');if(cr!=null)sp.customRole=cr;
    var sec=chips('spp_secpos');if(sec)sp.secondaryPositions=sec;
    sp.teamSessionsPerWeek=n('spp_team');sp.typicalMatchMinutes=n('spp_min');sp.extraSessions=n('spp_extra');
    var md=_segVal('spp_matchday');if(md!=null&&md!=='')sp.matchDay=md;
    var lu=_segVal('spp_lineup');if(lu!=null&&lu!=='')sp.lineupStatus=lu;
    var se=_segVal('spp_season');if(se!=null&&se!=='')sp.seasonPhase=se;
  } else {
    (sc.fields||[]).forEach(function(f){var id='spp_'+f[0];if(f[2]==='bool'){var e=document.getElementById(id);if(e)sp.fields[f[0]]=e.checked;}
      else if(f[2]==='select'){var sv=_segVal(id);if(sv!=null)sp.fields[f[0]]=sv;}
      else if(f[0]==='linkedSports'){var lc=chips(id);if(lc)sp.fields.linkedSports=lc;}
      else if(f[2]==='number'){sp.fields[f[0]]=n(id);}else{var tv=v(id);if(tv!=null)sp.fields[f[0]]=tv;}});
  }
  var perf=chips('spp_perf');if(perf){var existing={};sp.performancePriorities.forEach(function(p){existing[p.key]=p;});
    sp.performancePriorities=perf.map(function(k){return existing[k]||{key:k,priority:2,currentLevel:null,targetLevel:null};});}
  var con=chips('spp_constr');if(con)sp.constraints=con;
  return sp;}
function saveSportProfileEditor(){var M=pmModel();var E=window._sppEd;_sppCollectInto(E.sp);
  var sports=M.normalizeSports(PROFILE.sports);
  // linkedSports gegen aktive Sportarten validieren (deaktivierte/gelöschte entfernen).
  if(E.sp.fields&&E.sp.fields.linkedSports){var actIds=sports.filter(function(s){return s.activeInApp&&s.sportId!=='gym';}).map(function(s){return s.sportId;});E.sp.fields.linkedSports=M.filterLinkedSports(E.sp.fields.linkedSports,actIds);}
  PROFILE.sports=sports.map(function(s){if(s.sportId!==E.sportId)return s;var c=Object.assign({},s,{role:E.role,sportProfile:M.normalizeSportProfile(E.sportId,E.sp)});return c;});
  _profileSave(['sports']);maybePlanImpact('sports',['sports']);
  _closeM('_sppEdM');try{if(window._sportMgr)openSportsManager();}catch(e){}if(typeof toast==='function')toast('Sportprofil gespeichert');}
function cancelSportProfileEditor(){var E=window._sppEd;_sppCollectInto(E.sp);
  if(pmModel().diffState(JSON.parse(E.orig),{role:E.role,sp:E.sp})){
    _modal('_sppDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_sppDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_sppDiscard\');_closeM(\'_sppEdM\')">Änderungen verwerfen</button>');
  }else _closeM('_sppEdM');}

/* Trainingsverfügbarkeit bearbeiten (pro Wochentag + Wochenlimits). */
var WD_DE={mo:'Mo',di:'Di',mi:'Mi',do:'Do',fr:'Fr',sa:'Sa',so:'So'};
var AV_TIMES=[['','—'],['morning','Morgens'],['noon','Mittags'],['afternoon','Nachmittags'],['evening','Abends'],['flexible','Flexibel']];
var AV_INTENS=[['easy','Nur locker'],['moderate','Moderat möglich'],['intense','Intensiv möglich']];
var AV_FIX_DE={team_training:'Mannschaftstraining',match:'Spiel',fixed_session:'Feste Trainingseinheit',work_school:'Arbeit/Schule',appointment:'Termin',other_load:'Sonstige Belastung'};
function _avSports(){return (window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports():[];}
function _avTimeLabel(t){var p=AV_TIMES.filter(function(x){return x[0]===t;})[0];return p?p[1]:'';}
function openAvailabilityEditor(){var M=pmModel();var av=M.normalizeAvailability(PROFILE.availability);
  window._avEd={orig:JSON.stringify(av),av:JSON.parse(JSON.stringify(av)),open:{}};
  openSheet({id:'_secEdM',title:'Trainingsverfügbarkeit',onClose:cancelAvailabilityEditor,body:'<div id="avBody"></div>',
    actions:'<button class="btn" onclick="saveAvailabilityEditor()">Speichern</button><button class="btn sec" onclick="cancelAvailabilityEditor()">Abbrechen</button>'});renderAvailabilityEditor();}
function _avSlotHTML(d,idx,slot,sports){var p='av_'+d+'_'+idx+'_';
  return '<div class="gm-field"><label>Tageszeit</label>'+segHTML(p+'time',AV_TIMES,slot.preferredTime||'')+'</div>'+
    '<div class="gm-field"><label>Maximale Dauer (min)</label><input type="number" id="'+p+'min" value="'+(slot.maxMinutes!=null?slot.maxMinutes:'')+'"></div>'+
    (sports.length?'<div class="gm-field"><label>Bevorzugte Sportarten</label><div class="gm-chips" id="'+p+'sp">'+sports.map(function(s){return '<button type="button" class="gm-chip'+(slot.preferredSports.indexOf(s.sportId)>=0?' on':'')+'" data-v="'+escH(s.sportId)+'" onclick="gmToggle(this)">'+escH(s.customName||_sportLabel(s))+'</button>';}).join('')+'</div></div>':'')+
    '<div class="gm-field"><label>Intensität</label>'+segHTML(p+'int',AV_INTENS,slot.intensityAllowed||'moderate')+'</div>';}
function renderAvailabilityEditor(){var M=pmModel();var E=window._avEd;var av=E.av;var box=document.getElementById('avBody');if(!box)return;var sports=_avSports();
  var cards=M.WEEKDAYS.map(function(d){var w=av.days[d];var open=E.open[d];
    if(!open){var sum=[];if(w.restDay)sum.push('Ruhetag');else if(!w.available)sum.push('Nicht verfügbar');else{sum.push('Verfügbar');
      if(w.doubleSession.enabled)sum.push('2 Einheiten');var t1=_avTimeLabel(w.singleSession.preferredTime);if(!w.doubleSession.enabled&&t1)sum.push(t1);}
      if(w.fixedCommitments.length)sum.push(w.fixedCommitments.length+' feste');
      return '<div class="gmcard"><div class="gmc-h">'+WD_DE[d]+'</div><div class="gmc-meta">'+escH(sum.join(' · '))+'</div>'+
        '<div class="gmc-acts"><button class="gmc-b" onclick="avToggleOpen(\''+d+'\')">Weitere Einstellungen</button></div></div>';}
    var body='<div class="gmcard"><div class="gmc-h">'+WD_DE[d]+'</div>'+
      '<div class="gm-field gm-inline"><input type="checkbox" id="av_'+d+'_av"'+(w.available?' checked':'')+' onclick="avFlag(\''+d+'\')"><label>Verfügbar</label></div>'+
      '<div class="gm-field gm-inline"><input type="checkbox" id="av_'+d+'_rest"'+(w.restDay?' checked':'')+' onclick="avFlag(\''+d+'\')"><label>Als Ruhetag festlegen</label></div>';
    if(!w.restDay&&w.available){
      body+='<div class="gm-field gm-inline"><input type="checkbox" id="av_'+d+'_dbl"'+(w.doubleSession.enabled?' checked':'')+' onclick="avFlag(\''+d+'\')"><label>Doppeleinheit möglich</label></div>';
      if(w.doubleSession.enabled){
        body+='<div class="gm-sec">Einheit 1</div>'+_avSlotHTML(d,'0',w.doubleSession.sessions[0],sports)+'<div class="gm-sec">Einheit 2</div>'+_avSlotHTML(d,'1',w.doubleSession.sessions[1],sports);
        if(w.doubleSession.sessions[0].preferredTime&&w.doubleSession.sessions[0].preferredTime===w.doubleSession.sessions[1].preferredTime)body+='<p class="ob2-err" role="alert">Beide Einheiten haben dieselbe Tageszeit.</p>';
      } else body+='<div class="gm-sec">Einheit</div>'+_avSlotHTML(d,'s',w.singleSession,sports);
    }
    body+='<div class="gm-sec">Feste Verpflichtungen</div>'+w.fixedCommitments.map(function(c){return _avFixHTML(d,c,sports);}).join('')+
      '<button class="gmc-b" onclick="avAddFixed(\''+d+'\')">Feste Verpflichtung hinzufügen</button>';
    body+='<div class="gmc-acts" style="margin-top:8px"><button class="gmc-b" onclick="avToggleOpen(\''+d+'\')">Schließen</button></div></div>';
    return body;}).join('');
  box.innerHTML=cards+
    '<div class="gm-sec">Wochenlimits</div><p class="note" style="text-align:left">ORVIA nutzt diese Grenzen später, um deine Woche nicht zu überladen.</p>'+
    '<div class="row2"><div class="gm-field"><label>Max. Einheiten/Woche</label><input type="number" id="av_maxS" value="'+(av.maxSessionsPerWeek!=null?av.maxSessionsPerWeek:'')+'"></div>'+
    '<div class="gm-field"><label>Max. intensive Einheiten</label><input type="number" id="av_maxI" value="'+(av.maxIntenseSessions!=null?av.maxIntenseSessions:'')+'"></div></div>'+
    '<div class="gm-field"><label>Min. vollständige Ruhetage</label><input type="number" id="av_minRest" value="'+(av.minimumFullRestDays!=null?av.minimumFullRestDays:'')+'"></div>'+
    '<div class="gm-field"><label>Bevorzugte Ruhetage</label><div class="gm-chips" id="av_prefRest">'+M.WEEKDAYS.map(function(d){return '<button type="button" class="gm-chip'+(av.preferredRestDays.indexOf(d)>=0?' on':'')+'" data-v="'+d+'" onclick="gmToggle(this)">'+WD_DE[d]+'</button>';}).join('')+'</div></div>';}
function _avFixHTML(d,c,sports){var p='av_'+d+'_fix_'+c.id+'_';var types=Object.keys(AV_FIX_DE).map(function(k){return [k,AV_FIX_DE[k]];});
  return '<div class="gmcard" style="margin:6px 0"><div class="gm-field"><label>Typ</label>'+segHTML(p+'type',types,c.type)+'</div>'+
    (sports.length?'<div class="gm-field"><label>Sportart (optional)</label>'+segHTML(p+'sport',[['','—']].concat(sports.map(function(s){return [s.sportId,s.customName||_sportLabel(s)];})),c.sportId||'')+'</div>':'')+
    '<div class="row2"><div class="gm-field"><label>Startzeit</label><input type="time" id="'+p+'start" value="'+escH(c.startTime||'')+'"></div>'+
    '<div class="gm-field"><label>Dauer (min)</label><input type="number" id="'+p+'dur" value="'+(c.durationMinutes!=null?c.durationMinutes:'')+'"></div></div>'+
    '<div class="gm-field"><label>Intensität</label>'+segHTML(p+'int',AV_INTENS,c.intensity||'moderate')+'</div>'+
    '<button class="gmc-b danger-btn" onclick="avDelFixed(\''+d+'\',\''+c.id+'\')">Entfernen</button></div>';}
function _avSlotCollect(d,idx){var p='av_'+d+'_'+idx+'_';function n(id){var e=document.getElementById(id);return e&&e.value!==''?parseInt(e.value,10):null;}
  var c=document.getElementById(p+'sp');return {preferredTime:_segVal(p+'time')||'',maxMinutes:n(p+'min'),preferredSports:c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[],intensityAllowed:_segVal(p+'int')||'moderate'};}
function _avCollectDraft(){var M=pmModel();var E=window._avEd;var av=E.av;function n(id){var e=document.getElementById(id);return e&&e.value!==''?parseInt(e.value,10):null;}
  M.WEEKDAYS.forEach(function(d){if(!E.open[d])return;var w=av.days[d];var avEl=document.getElementById('av_'+d+'_av');if(avEl)w.available=avEl.checked;var rEl=document.getElementById('av_'+d+'_rest');if(rEl)w.restDay=rEl.checked;
    var dEl=document.getElementById('av_'+d+'_dbl');if(dEl)w.doubleSession.enabled=dEl.checked;
    if(!w.restDay&&w.available){if(w.doubleSession.enabled){w.doubleSession.sessions[0]=_avSlotCollect(d,'0');w.doubleSession.sessions[1]=_avSlotCollect(d,'1');}else w.singleSession=_avSlotCollect(d,'s');}
    w.fixedCommitments=w.fixedCommitments.map(function(c){var p='av_'+d+'_fix_'+c.id+'_';function nn(id){var e=document.getElementById(id);return e&&e.value!==''?parseInt(e.value,10):null;}var st=document.getElementById(p+'start');
      return {id:c.id,type:_segVal(p+'type')||c.type,sportId:_segVal(p+'sport')||null,startTime:st?st.value:c.startTime,durationMinutes:nn(p+'dur'),intensity:_segVal(p+'int')||'moderate',fixed:true};});});
  if(document.getElementById('av_maxS'))av.maxSessionsPerWeek=n('av_maxS');if(document.getElementById('av_maxI'))av.maxIntenseSessions=n('av_maxI');if(document.getElementById('av_minRest'))av.minimumFullRestDays=n('av_minRest');
  var pr=document.getElementById('av_prefRest');if(pr)av.preferredRestDays=Array.prototype.slice.call(pr.querySelectorAll('.on')).map(function(b){return b.dataset.v;});
  E.av=M.normalizeAvailability(av);return E.av;}
function avToggleOpen(d){_avCollectDraft();window._avEd.open[d]=!window._avEd.open[d];renderAvailabilityEditor();}
function avFlag(d){_avCollectDraft();renderAvailabilityEditor();}   // available/restDay/double exklusiv via normalizeAvailability
function avAddFixed(d){_avCollectDraft();window._avEd.av.days[d].fixedCommitments.push(pmModel().normalizeFixedCommitment({}));renderAvailabilityEditor();}
function avDelFixed(d,id){_avCollectDraft();var w=window._avEd.av.days[d];w.fixedCommitments=w.fixedCommitments.filter(function(c){return c.id!==id;});renderAvailabilityEditor();}
function saveAvailabilityEditor(){PROFILE.availability=_avCollectDraft();_profileSave(['availability']);maybePlanImpact('availability',['availability']);
  _closeM('_secEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Verfügbarkeit gespeichert');}
function cancelAvailabilityEditor(){_avCollectDraft();if(pmModel().diffState(JSON.parse(window._avEd.orig),window._avEd.av)){
    _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p>'+
      '<button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button>'+
      '<button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_secEdM\')">Änderungen verwerfen</button>');
  }else _closeM('_secEdM');}

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
function c_regionLabel(code){var M=pmModel();var p=(M.BODY_REGIONS||[]).filter(function(x){return x[0]===code;})[0];return p?p[1]:(code||'Beschwerde');}
function openConstraintEditor(id){var M=pmModel();var c=id?_constraintList().filter(function(x){return x.id===id;})[0]:null;
  var st=['active','improved','resolved','observed'];var sports=(window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports():[];
  _modal('_cstrEd','<h3>'+(c?'Beschwerde bearbeiten':'Beschwerde hinzufügen')+'</h3>'+
    '<div class="gm-field"><label>Körperregion</label>'+segHTML('c_region',M.BODY_REGIONS,(c&&c.bodyRegion)||'')+'</div>'+
    '<div class="gm-field"><label>Seite</label>'+segHTML('c_side',M.BODY_SIDES,(c&&c.side)||'na')+'</div>'+
    '<div class="gm-field"><label>Intensität (0–10)</label><input type="number" id="c_int" value="'+(c&&c.intensity!=null?c.intensity:'')+'"></div>'+
    '<div class="gm-field"><label>Auslöser</label><input id="c_trig" value="'+escH(c?c.triggers:'')+'"></div>'+
    (sports.length?'<div class="gm-field"><label>Betroffene Sportarten</label><div class="gm-chips" id="c_aff">'+sports.map(function(s){var on=c&&(c.affectedActivities||[]).indexOf(s.sportId)>=0;return '<button type="button" class="gm-chip'+(on?' on':'')+'" data-v="'+escH(s.sportId)+'" onclick="gmToggle(this)">'+escH(s.customName||_sportLabel(s))+'</button>';}).join('')+'</div></div>':'')+
    '<div class="gm-field"><label>Zu vermeidende Bewegungen</label><input id="c_avoid" value="'+escH(c?c.avoidMovements:'')+'"></div>'+
    '<div class="gm-field"><label>Beginn</label><input id="c_since" value="'+escH(c?c.startedAt:'')+'"></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="c_train"'+(!c||c.currentlyTrainable?' checked':'')+'><label>Aktuell trainierbar</label></div>'+
    '<div class="gm-field"><label>Notiz</label><input id="c_adapt" value="'+escH(c?c.notes:'')+'"></div>'+
    '<div class="gm-field"><label>Status</label>'+segHTML('c_status',st.map(function(s){return [s,CSTR_STATUS_DE[s]];}),(c&&c.status)||'active')+'</div>'+
    '<div class="gm-modal-actions"><button class="btn" onclick="saveConstraint(\''+(id||'')+'\')">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="_closeM(\'_cstrEd\')">Abbrechen</button></div>');}
function saveConstraint(id){var M=pmModel();function v(i){var e=document.getElementById(i);return e?e.value:'';}
  var aff=document.getElementById('c_aff');var affs=aff?Array.prototype.slice.call(aff.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[];
  var reg=_segVal('c_region')||'';
  var raw={id:id||null,bodyRegion:reg,side:_segVal('c_side')||'na',title:c_regionLabel(reg),intensity:v('c_int')===''?null:parseInt(v('c_int'),10),triggers:v('c_trig'),affectedActivities:affs,avoidMovements:v('c_avoid'),startedAt:v('c_since'),
    currentlyTrainable:(document.getElementById('c_train')||{}).checked,notes:v('c_adapt'),status:_segVal('c_status')||'active'};
  var c=M.normalizeConstraint(raw);var list=_constraintList().slice();
  if(id){list=list.map(function(x){return x.id===id?c:x;});}else list.push(c);
  PROFILE.constraintsList=list;_persistConstraints();_closeM('_cstrEd');openConstraintsEditor();if(typeof toast==='function')toast('Beschwerde gespeichert');}
function constraintStatus(id,st){var M=pmModel();PROFILE.constraintsList=_constraintList().map(function(c){return c.id===id?M.normalizeConstraint(Object.assign({},c,{status:st})):c;});_persistConstraints();openConstraintsEditor();}
function constraintRemove(id){PROFILE.constraintsList=_constraintList().filter(function(c){return c.id!==id;});_persistConstraints();openConstraintsEditor();}
function _persistConstraints(){ // Beschwerden zentral speichern; issues[]-Projektion + Event über _profileSave
  _profileSave(['constraints']);
  maybePlanImpact('constraints',['constraints']);}

/* Profil-Übersicht: kompakte Zusammenfassung, jeder Abschnitt direkt bearbeitbar. */
function openProfileSummary(){var M=pmModel();var act=listGoals().filter(function(g){return g.status==='active';}).slice().sort(function(a,b){return a.priority-b.priority;});
  var primary=act[0];var others=act.slice(1);
  var sports=(PROFILE.sports||[]).map(function(s){return typeof s==='string'?s:(s.sportId||s.customName);}).filter(Boolean);
  var avs=M.availabilitySummary(PROFILE.availability);
  var avBits=[avs.availableDays+' verfügbare Tage'];if(avs.maxSessionsPerWeek!=null)avBits.push('Bis zu '+avs.maxSessionsPerWeek+' Einheiten');if(avs.doubleDays)avBits.push(avs.doubleDays+' mögliche Doppeleinheiten');if(avs.preferredRestDays.length)avBits.push('Bevorzugter Ruhetag: '+avs.preferredRestDays.map(function(d){return WD_DE[d]||d;}).join(', '));
  var perf=M.normalizePerformance(PROFILE.performance,PROFILE.body);var perfBits=[];var cw=M.currentWeightKg(perf);if(cw!=null)perfBits.push(cw+' kg');
  if(perf.vo2max.value!=null)perfBits.push('VO₂max'+(perf.vo2max.sportId?' '+(M.sportProfileSchema(perf.vo2max.sportId)||{label:perf.vo2max.sportId}).label:'')+': '+perf.vo2max.value);
  if(perf.personalBests.length){var pb=perf.personalBests[0];perfBits.push((pb.distance||pb.discipline||'Bestzeit')+': '+M.formatDuration(pb.timeSeconds));}
  if(perf.strengthRecords.length){var sr=perf.strengthRecords[0];perfBits.push(sr.exerciseName+': '+(sr.weightKg||'?')+' kg × '+(sr.repetitions||'?'));}
  var constraints=_constraintList().filter(function(c){return c.status==='active';}).map(function(c){return (c.title||c.bodyRegion)+(c.intensity!=null?' · Intensität '+c.intensity:'');});
  var rec=M.normalizeRecovery(PROFILE.recovery,PROFILE.recovery);var recDE={very_bad:'sehr schlecht',bad:'schlecht',mid:'mittel',good:'gut',very_good:'sehr gut',low:'niedrig',high:'hoch',very_high:'sehr hoch'};
  var recBits=[];if(rec.sleep.averageHours!=null)recBits.push('Ø '+rec.sleep.averageHours+' h Schlaf');if(rec.stress.generalLevel)recBits.push('Stress '+(recDE[rec.stress.generalLevel]||rec.stress.generalLevel));var nutDE={deficit:'Kaloriendefizit',maintain:'Gewicht halten',surplus:'Kalorienüberschuss'};if(nutDE[rec.nutritionState.mode])recBits.push(nutDE[rec.nutritionState.mode]);
  var pr=M.normalizePreferences(PROFILE.preferences||PROFILE.trainingPrefs,PROFILE.trainingPrefs);var prBits=[];var envDE={indoor:'Indoor',outdoor:'Outdoor',both:'Indoor/Outdoor'};var tDE={morning:'Morgens',noon:'Mittags',afternoon:'Nachmittags',evening:'Abends',flexible:'Flexibel'};var iDE={easy:'eher locker',balanced:'ausgeglichen',intense:'eher intensiv'};
  if(pr.preferredTimes.length)prBits.push(pr.preferredTimes.map(function(t){return tDE[t]||t;}).join(', '));if(envDE[pr.preferredEnvironment])prBits.push(envDE[pr.preferredEnvironment]);if(pr.preferredSessionDurations.length)prBits.push(pr.preferredSessionDurations.filter(function(x){return x>0;}).join('–')+' Minuten');if(iDE[pr.intensityPreference])prBits.push(iDE[pr.intensityPreference]+' Intensität');
  function sec(title,body,editId){return '<div class="ps-block"><div class="ps-h">'+escH(title)+(editId?'<button class="gmc-b" onclick="_closeM(\'_profSum\');openProfileSection(\''+editId+'\')">Bearbeiten</button>':'')+'</div>'+body+'</div>';}
  _modal('_profSum','<h3>Dein ORVIA-Profil</h3>'+
    sec('Hauptziel',primary?'<p>'+escH(primary.title)+'</p>':'<p class="note">—</p>','goals')+
    sec('Weitere Ziele',others.length?'<ul class="ps-list">'+others.map(function(g){return '<li>'+escH(g.title)+'</li>';}).join('')+'</ul>':'<p class="note">—</p>','goals')+
    sec('Sportarten',sports.length?'<p>'+escH(sports.join(', '))+'</p>':'<p class="note">—</p>','sports')+
    sec('Trainingsverfügbarkeit','<p>'+escH(avBits.join(' · '))+'</p>','availability')+
    sec('Körper und Leistung',perfBits.length?'<p>'+escH(perfBits.join(' · '))+'</p>':'<p class="note">—</p>','body')+
    sec('Regeneration und Alltag',recBits.length?'<p>'+escH(recBits.join(' · '))+'</p>':'<p class="note">—</p>','recovery')+
    sec('Beschwerden',constraints.length?'<p>'+escH(constraints.join(', '))+'</p>':'<p class="note">keine</p>','constraints')+
    sec('Trainingspräferenzen',prBits.length?'<p>'+escH(prBits.join(' · '))+'</p>':'<p class="note">—</p>','preferences')+
    (function(){var dv=M.normalizeDevices(PROFILE.devices,PROFILE.dataSources);var b=[];M.INTEGRATION_IDS.forEach(function(k){var i=dv.integrations[k];b.push(({strava:'Strava',garmin:'Garmin',appleHealth:'Apple Health'}[k])+' '+(i.connected?'verbunden':(i.status==='not_available'?'nicht verfügbar':'nicht verbunden')));});b.push(dv.equipment.filter(function(e){return e.available;}).length+' Trainingsgeräte');if(dv.trainingLocations.length)b.push(dv.trainingLocations.length+' Trainingsorte');return sec('Geräte und Datenquellen','<p>'+escH(b.join(' · '))+'</p>','devices');})()+
    '<button class="btn sec" style="margin-top:12px" onclick="_closeM(\'_profSum\')">Schließen</button>');}

/* ============================================================
   KÖRPER- UND LEISTUNGSDATEN (Inkrement 4f): strukturiert, Einheit/Quelle/Datum, editier-/löschbar.
   ============================================================ */
var PERF_SOURCE_DE={manual:'Manuell',garmin:'Garmin',strava:'Strava',apple_health:'Apple Health',import:'Importiert',calculated:'Berechnet'};
var SET_TYPE_DE={working:'Normaler Arbeitssatz',top_set:'Schwerster Satz',test:'Test',estimated_1rm:'Geschätztes 1RM'};
function _today(){try{return new Date().toISOString().slice(0,10);}catch(e){return '';}}
function _perfM(){return pmModel();}
function openPerformanceManager(){var M=_perfM();window._perfEd={orig:JSON.stringify(M.normalizePerformance(PROFILE.performance,PROFILE.body)),perf:M.normalizePerformance(PROFILE.performance,PROFILE.body)};
  openSheet({id:'_perfMgr',title:'Körper und Leistung',body:'<div id="perfBody"></div>',
    actions:'<button class="btn sec" onclick="_closeM(\'_perfMgr\')">Schließen</button>'});renderPerformanceManager();}
function _perfSave(){var M=_perfM();PROFILE.performance=M.normalizePerformance(window._perfEd.perf,PROFILE.body);_profileSave(['body']);try{if(window._perfMgr)renderPerformanceManager();}catch(e){}if(typeof toast==='function')toast('Gespeichert');}
function renderPerformanceManager(){var M=_perfM();var perf=window._perfEd.perf;var box=document.getElementById('perfBody');if(!box)return;
  var cw=M.currentWeightKg(perf);
  function row(label,val){return val?'<div class="gmc-meta">'+escH(label+': '+val)+'</div>':'';}
  var legacy=perf._legacyText?('<div class="gm-sec">Alte Notizen</div>'+(perf._legacyText.bestTimes?'<div class="gmc-meta">'+escH('Bestzeiten: '+perf._legacyText.bestTimes)+'</div>':'')+(perf._legacyText.lifts?'<div class="gmc-meta">'+escH('Kraftwerte: '+perf._legacyText.lifts)+'</div>':'')):'';
  box.innerHTML=
    '<div class="gmcard"><div class="gmc-h">Körperdaten</div>'+row('Größe',perf.body.height.value&&perf.body.height.value+' cm')+row('Gewicht',cw!=null&&cw+' kg')+row('Körperfett',perf.body.bodyFat.value&&perf.body.bodyFat.value+' %')+row('Ruhepuls',perf.body.restingHr.value&&perf.body.restingHr.value+' bpm')+'<div class="gmc-acts"><button class="gmc-b" onclick="openBodyEditor()">Bearbeiten</button></div></div>'+
    '<div class="gmcard"><div class="gmc-h">Gewichtsverlauf</div>'+(perf.weightHistory.length?perf.weightHistory.slice(0,5).map(function(e){return '<div class="gw-ms"><span>'+escH((e.measuredAt||'—')+' · '+e.valueKg+' kg')+'</span><button class="gmc-b danger-btn" onclick="perfDelWeight(\''+e.id+'\')">✕</button></div>';}).join(''):'<p class="note" style="text-align:left">Keine Messungen.</p>')+'<div class="gmc-acts"><button class="gmc-b" onclick="openWeightAdd()">Messung hinzufügen</button></div></div>'+
    '<div class="gmcard"><div class="gmc-h">Ausdauerwerte</div>'+row('VO₂max',perf.vo2max.value&&(perf.vo2max.value+(perf.vo2max.sportId?' ('+(M.sportProfileSchema(perf.vo2max.sportId)||{label:perf.vo2max.sportId}).label+')':'')))+row('FTP',perf.ftp.valueWatts&&perf.ftp.valueWatts+' W')+row('Schwellenpace',perf.thresholdPace.secondsPerKm&&M.formatPace(perf.thresholdPace.secondsPerKm)+'/km')+row('CSS-Pace',perf.cssPace.secondsPer100m&&M.formatPace(perf.cssPace.secondsPer100m)+'/100 m')+'<div class="gmc-acts"><button class="gmc-b" onclick="openEnduranceEditor()">Bearbeiten</button></div></div>'+
    '<div class="gmcard"><div class="gmc-h">Persönliche Bestzeiten ('+perf.personalBests.length+')</div>'+perf.personalBests.map(function(b){return '<div class="gw-ms"><span>'+escH((b.distance||b.discipline||'Bestzeit')+' · '+M.formatDuration(b.timeSeconds)+(b.measuredAt?' · '+b.measuredAt:''))+'</span><button class="gmc-b" onclick="openPbEditor(\''+b.id+'\')">✎</button><button class="gmc-b danger-btn" onclick="perfDelPb(\''+b.id+'\')">✕</button></div>';}).join('')+'<div class="gmc-acts"><button class="gmc-b" onclick="openPbEditor()">Bestzeit hinzufügen</button></div></div>'+
    '<div class="gmcard"><div class="gmc-h">Kraftwerte ('+perf.strengthRecords.length+')</div>'+perf.strengthRecords.map(function(r){return '<div class="gw-ms"><span>'+escH(r.exerciseName+' · '+(r.weightKg||'?')+' kg × '+(r.repetitions||'?')+(r.estimatedOneRepMax?' · ~1RM '+r.estimatedOneRepMax+' kg'+(r.oneRmEstimated?' (Schätzung)':''):''))+'</span><button class="gmc-b" onclick="openSrEditor(\''+r.id+'\')">✎</button><button class="gmc-b danger-btn" onclick="perfDelSr(\''+r.id+'\')">✕</button></div>';}).join('')+'<div class="gmc-acts"><button class="gmc-b" onclick="openSrEditor()">Kraftwert hinzufügen</button></div></div>'+
    legacy;}
function _metricSet(m,val,unit){var changed=(m.value!=val);if(val===''||val==null){return {value:null,unit:unit,sportId:m.sportId||null,source:m.source||'manual',measuredAt:m.measuredAt||null};}
  return {value:val,unit:unit,sportId:m.sportId||null,source:changed?'manual':(m.source||'manual'),measuredAt:changed?_today():(m.measuredAt||_today())};}
/* Körperdaten-Editor */
function openBodyEditor(){var perf=window._perfEd.perf;var b=perf.body;
  function f(k,lab,unit){return '<div class="gm-field"><label>'+lab+' ('+unit+', optional)</label><input type="number" id="bd_'+k+'" value="'+(b[k].value!=null?b[k].value:'')+'"></div>';}
  openSheet({id:'_perfSub',title:'Körperdaten',size:'large',
    body:f('height','Größe','cm')+f('weight','Gewicht','kg')+f('bodyFat','Körperfett','%')+f('leanMass','Fettfreie Masse','kg')+f('waist','Taillenumfang','cm')+f('restingHr','Ruhepuls','bpm')+f('maxHr','Maximale Herzfrequenz','bpm')+'<span class="ob2-err" id="bd_err" role="alert"></span>',
    actions:'<button class="btn" onclick="saveBodyEditor()">Speichern</button><button class="btn sec" onclick="_closeM(\'_perfSub\')">Abbrechen</button>'});}
function saveBodyEditor(){var perf=window._perfEd.perf;var b=perf.body;function val(k){var e=document.getElementById('bd_'+k);return e&&e.value!==''?parseFloat(e.value.replace(',','.')):null;}
  var bf=val('bodyFat');if(bf!=null&&(bf<0||bf>100)){document.getElementById('bd_err').textContent='Körperfett muss zwischen 0 und 100 liegen.';return;}
  var h=val('height'),w=val('weight');if((h!=null&&h<=0)||(w!=null&&w<=0)){document.getElementById('bd_err').textContent='Werte müssen positiv sein.';return;}
  ['height','weight','bodyFat','leanMass','waist','restingHr','maxHr'].forEach(function(k){var u={height:'cm',weight:'kg',bodyFat:'%',leanMass:'kg',waist:'cm',restingHr:'bpm',maxHr:'bpm'}[k];b[k]=_metricSet(b[k],val(k),u);});
  // Gewichtsänderung zusätzlich in den Verlauf aufnehmen.
  if(b.weight.value!=null){var wh=perf.weightHistory;if(!wh.length||wh[0].valueKg!==b.weight.value)wh.unshift({id:'w:'+Date.now().toString(36),valueKg:b.weight.value,measuredAt:_today(),source:'manual'});}
  _closeM('_perfSub');_perfSave();}
/* Gewichtsmessung hinzufügen */
function openWeightAdd(){openSheet({id:'_perfSub',title:'Gewichtsmessung',size:'large',
  body:'<div class="gm-field"><label>Gewicht (kg)</label><input type="number" id="wa_val"></div><div class="gm-field"><label>Datum</label><input type="date" id="wa_date" value="'+_today()+'"></div><span class="ob2-err" id="wa_err" role="alert"></span>',
  actions:'<button class="btn" onclick="saveWeightAdd()">Speichern</button><button class="btn sec" onclick="_closeM(\'_perfSub\')">Abbrechen</button>'});}
function saveWeightAdd(){var v=document.getElementById('wa_val');var val=v&&v.value!==''?parseFloat(v.value.replace(',','.')):null;if(!(val>0)){document.getElementById('wa_err').textContent='Bitte ein gültiges Gewicht eingeben.';return;}
  window._perfEd.perf.weightHistory.unshift({id:'w:'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),valueKg:val,measuredAt:(document.getElementById('wa_date')||{}).value||_today(),source:'manual'});_closeM('_perfSub');_perfSave();}
function perfDelWeight(id){window._perfEd.perf.weightHistory=window._perfEd.perf.weightHistory.filter(function(e){return e.id!==id;});_perfSave();}
/* Ausdauerwerte */
function openEnduranceEditor(){var M=_perfM();var perf=window._perfEd.perf;var sports=(window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports():[];
  openSheet({id:'_perfSub',title:'Ausdauerwerte',size:'large',
    body:'<div class="gm-field"><label>VO₂max</label><input type="number" id="en_vo2" value="'+(perf.vo2max.value!=null?perf.vo2max.value:'')+'"></div>'+
    '<div class="gm-field"><label>VO₂max-Sportart (optional)</label>'+segHTML('en_vo2sport',[['','allgemein']].concat(sports.map(function(s){return [s.sportId,s.customName||_sportLabel(s)];})),perf.vo2max.sportId||'')+'</div>'+
    '<div class="gm-field"><label>FTP (Watt)</label><input type="number" id="en_ftp" value="'+(perf.ftp.valueWatts!=null?perf.ftp.valueWatts:'')+'"></div>'+
    '<div class="gm-field"><label>Schwellenpace (min/km, z. B. 4:10)</label><input id="en_tp" value="'+(perf.thresholdPace.secondsPerKm?M.formatPace(perf.thresholdPace.secondsPerKm):'')+'"></div>'+
    '<div class="gm-field"><label>CSS-Pace (min/100 m, z. B. 1:40)</label><input id="en_css" value="'+(perf.cssPace.secondsPer100m?M.formatPace(perf.cssPace.secondsPer100m):'')+'"></div>'+
    '<div class="gm-field"><label>2.000-m-Rudern (z. B. 7:20)</label><input id="en_row" value="'+(perf.rowing2k.timeSeconds?M.formatDuration(perf.rowing2k.timeSeconds):'')+'"></div>'+
    '<span class="ob2-err" id="en_err" role="alert"></span>',
    actions:'<button class="btn" onclick="saveEnduranceEditor()">Speichern</button><button class="btn sec" onclick="_closeM(\'_perfSub\')">Abbrechen</button>'});}
function saveEnduranceEditor(){var M=_perfM();var perf=window._perfEd.perf;function num(id){var e=document.getElementById(id);return e&&e.value!==''?parseFloat(e.value.replace(',','.')):null;}
  var vo2=num('en_vo2');perf.vo2max=Object.assign(_metricSet(perf.vo2max,vo2,null),{sportId:_segVal('en_vo2sport')||null});
  var ftp=num('en_ftp');perf.ftp=Object.assign(_metricSet(perf.ftp,ftp,'W'),{valueWatts:ftp,wattsPerKg:null});
  perf.thresholdPace=Object.assign(_metricSet(perf.thresholdPace,1,null),{secondsPerKm:M.parsePace((document.getElementById('en_tp')||{}).value)});
  perf.cssPace=Object.assign(_metricSet(perf.cssPace,1,null),{secondsPer100m:M.parsePace((document.getElementById('en_css')||{}).value)});
  perf.rowing2k=Object.assign(_metricSet(perf.rowing2k,1,null),{timeSeconds:M.parseDuration((document.getElementById('en_row')||{}).value)});
  _closeM('_perfSub');_perfSave();}
/* Bestzeiten */
function openPbEditor(id){var M=_perfM();var perf=window._perfEd.perf;var b=id?perf.personalBests.filter(function(x){return x.id===id;})[0]:null;
  var sports=(window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports():[];
  openSheet({id:'_perfSub',title:(b?'Bestzeit bearbeiten':'Bestzeit hinzufügen'),size:'large',
    body:'<div class="gm-field"><label>Sportart</label>'+segHTML('pb_sport',sports.map(function(s){return [s.sportId,s.customName||_sportLabel(s)];}),(b&&b.sportId)||(sports[0]&&sports[0].sportId)||'')+'</div>'+
    '<div class="gm-field"><label>Distanz/Disziplin</label><input id="pb_dist" value="'+escH(b?(b.distance||b.discipline):'')+'"></div>'+
    '<div class="gm-field"><label>Zeit (z. B. 24:30 oder 1:58:00)</label><input id="pb_time" value="'+(b?M.formatDuration(b.timeSeconds):'')+'"><span class="ob2-err" id="pb_err" role="alert"></span></div>'+
    '<div class="gm-field"><label>Kontext</label>'+segHTML('pb_ctx',[['race','Wettkampf'],['training','Training']],(b&&b.context)||'race')+'</div>'+
    '<div class="gm-field"><label>Datum</label><input type="date" id="pb_date" value="'+escH(b&&b.measuredAt?b.measuredAt:_today())+'"></div>'+
    '<div class="gm-field"><label>Notiz (optional)</label><input id="pb_notes" value="'+escH(b?b.notes:'')+'"></div>',
    actions:'<button class="btn" onclick="savePbEditor(\''+(id||'')+'\')">Speichern</button><button class="btn sec" onclick="_closeM(\'_perfSub\')">Abbrechen</button>'});}
function savePbEditor(id){var M=_perfM();var perf=window._perfEd.perf;var secs=M.parseDuration((document.getElementById('pb_time')||{}).value);
  if(secs==null){document.getElementById('pb_err').textContent='Bitte eine gültige Zeit eingeben (z. B. 24:30).';return;}
  var rec={id:id||null,sportId:_segVal('pb_sport')||null,distance:(document.getElementById('pb_dist')||{}).value||'',discipline:(document.getElementById('pb_dist')||{}).value||'',timeSeconds:secs,context:_segVal('pb_ctx')||'race',measuredAt:(document.getElementById('pb_date')||{}).value||_today(),source:'manual',notes:(document.getElementById('pb_notes')||{}).value||''};
  if(id)perf.personalBests=perf.personalBests.map(function(x){return x.id===id?M.normalizePersonalBest(Object.assign({},x,rec)):x;});else perf.personalBests.push(M.normalizePersonalBest(rec));
  _closeM('_perfSub');_perfSave();}
function perfDelPb(id){window._perfEd.perf.personalBests=window._perfEd.perf.personalBests.filter(function(x){return x.id!==id;});_perfSave();}
/* Kraftwerte */
function openSrEditor(id){var M=_perfM();var perf=window._perfEd.perf;var r=id?perf.strengthRecords.filter(function(x){return x.id===id;})[0]:null;
  openSheet({id:'_perfSub',title:(r?'Kraftwert bearbeiten':'Kraftwert hinzufügen'),size:'large',
    body:'<div class="gm-field"><label>Übung</label><input id="sr_ex" value="'+escH(r?r.exerciseName:'')+'"><span class="ob2-err" id="sr_err" role="alert"></span></div>'+
    '<div class="row2"><div class="gm-field"><label>Gewicht (kg)</label><input type="number" id="sr_w" value="'+(r&&r.weightKg!=null?r.weightKg:'')+'"></div>'+
    '<div class="gm-field"><label>Wiederholungen</label><input type="number" id="sr_r" value="'+(r&&r.repetitions!=null?r.repetitions:'')+'"></div></div>'+
    '<div class="gm-field"><label>Satzart</label>'+segHTML('sr_type',[['working','Arbeitssatz'],['top_set','Schwerster Satz'],['test','Test'],['estimated_1rm','Geschätztes 1RM']],(r&&r.setType)||'working')+'</div>'+
    '<div class="gm-field"><label>Datum</label><input type="date" id="sr_date" value="'+escH(r&&r.measuredAt?r.measuredAt:_today())+'"></div>'+
    '<div class="gm-field"><label>Notiz (optional)</label><input id="sr_notes" value="'+escH(r?r.notes:'')+'"></div>',
    actions:'<button class="btn" onclick="saveSrEditor(\''+(id||'')+'\')">Speichern</button><button class="btn sec" onclick="_closeM(\'_perfSub\')">Abbrechen</button>'});}
function saveSrEditor(id){var M=_perfM();var perf=window._perfEd.perf;var ex=(document.getElementById('sr_ex')||{}).value||'';
  if(!ex.trim()){document.getElementById('sr_err').textContent='Bitte eine Übung angeben.';return;}
  function num(i){var e=document.getElementById(i);return e&&e.value!==''?parseFloat(e.value.replace(',','.')):null;}
  var rec={id:id||null,exerciseName:ex.trim(),weightKg:num('sr_w'),repetitions:num('sr_r'),setType:_segVal('sr_type')||'working',measuredAt:(document.getElementById('sr_date')||{}).value||_today(),source:'manual',notes:(document.getElementById('sr_notes')||{}).value||''};
  if(id)perf.strengthRecords=perf.strengthRecords.map(function(x){return x.id===id?M.normalizeStrengthRecord(Object.assign({},x,rec,{estimatedOneRepMax:null})):x;});else perf.strengthRecords.push(M.normalizeStrengthRecord(rec));
  _closeM('_perfSub');_perfSave();}
function perfDelSr(id){window._perfEd.perf.strengthRecords=window._perfEd.perf.strengthRecords.filter(function(x){return x.id!==id;});_perfSave();}

/* ============================================================
   REGENERATION & ALLTAG + TRAININGSPRÄFERENZEN (Inkrement 4g), strukturiert.
   ============================================================ */
function _recSports(){return (window.ORVIA&&ORVIA.profile&&ORVIA.profile.activeSports)?ORVIA.profile.activeSports():[];}
function openRecoveryEditor(){var M=pmModel();var r=M.normalizeRecovery(PROFILE.recovery,PROFILE.recovery);
  window._recEd={orig:JSON.stringify(r),r:JSON.parse(JSON.stringify(r))};var s=r.sleep,st=r.stress,wp=r.workPattern,ns=r.nutritionState,rp=r.recoveryPreferences;
  openSheet({id:'_recEdM',title:'Regeneration und Alltag',onClose:cancelRecoveryEditor,
    actions:'<button class="btn" onclick="saveRecoveryEditor()">Speichern</button><button class="btn sec" onclick="cancelRecoveryEditor()">Abbrechen</button>',
    body:'<p class="note" style="text-align:left">ORVIA nutzt Schlaf- und Stressdaten später zur Einschätzung von Erholung und Belastbarkeit.</p>'+
    '<div class="gm-field"><label>Durchschnittliche Schlafdauer (h)</label><input type="number" id="rc_sleepH" value="'+(s.averageHours!=null?s.averageHours:'')+'"></div>'+
    '<div class="gm-field"><label>Schlafqualität</label>'+segHTML('rc_sleepQ',[['very_bad','Sehr schlecht'],['bad','Schlecht'],['mid','Mittel'],['good','Gut'],['very_good','Sehr gut']],s.quality)+'</div>'+
    '<div class="gm-field"><label>Schlafregelmäßigkeit</label>'+segHTML('rc_sleepC',[['very_irregular','Sehr unregelmäßig'],['irregular','Eher unregelmäßig'],['varying','Wechselnd'],['regular','Regelmäßig'],['very_regular','Sehr regelmäßig']],s.consistency)+'</div>'+
    '<div class="row2"><div class="gm-field"><label>Schlafenszeit</label><input type="time" id="rc_bed" value="'+escH(s.bedtime||'')+'"></div><div class="gm-field"><label>Aufstehzeit</label><input type="time" id="rc_wake" value="'+escH(s.wakeTime||'')+'"></div></div>'+
    '<div class="gm-field"><label>Stressniveau</label>'+segHTML('rc_stress',[['low','Niedrig'],['mid','Mittel'],['high','Hoch'],['very_high','Sehr hoch']],st.generalLevel)+'</div>'+
    '<div class="gm-field"><label>Arbeits-/Schulbelastung</label>'+segHTML('rc_work',[['light','Leicht'],['normal','Normal'],['high','Hoch'],['very_high','Sehr hoch']],st.workSchoolLevel)+'</div>'+
    '<div class="gm-field"><label>Alltag körperlich belastend?</label>'+segHTML('rc_phys',[['no','Nein'],['partly','Teilweise'],['often','Häufig']],wp.physicallyDemanding)+'</div>'+
    '<div class="gm-field"><label>Arbeitsmodell</label>'+segHTML('rc_shift',[['none','Keine Schichtarbeit'],['early','Frühschicht'],['late','Spätschicht'],['night','Nachtschicht'],['rotating','Wechselnde Schichten'],['irregular','Unregelmäßig']],wp.shiftType)+'</div>'+
    '<div class="gm-field"><label>Aktuelle Ernährungssituation</label>'+segHTML('rc_nut',[['deficit','Kaloriendefizit'],['maintain','Gewicht halten'],['surplus','Kalorienüberschuss'],['unknown','Unbekannt']],ns.mode)+'</div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="rc_eal"'+(ns.energyAvailabilityLimited?' checked':'')+'><label>Energieverfügbarkeit aktuell eingeschränkt</label></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="rc_arec"'+(rp.activeRecoveryAllowed?' checked':'')+'><label>Aktive Regeneration erlaubt</label></div>'});}
function _recCollect(){var r=window._recEd.r;function num(id){var e=document.getElementById(id);return e&&e.value!==''?parseFloat(e.value.replace(',','.')):null;}function val(id){var e=document.getElementById(id);return e?e.value:'';}
  r.sleep.averageHours=num('rc_sleepH');r.sleep.quality=_segVal('rc_sleepQ')||'';r.sleep.consistency=_segVal('rc_sleepC')||'';r.sleep.bedtime=val('rc_bed');r.sleep.wakeTime=val('rc_wake');
  r.stress.generalLevel=_segVal('rc_stress')||'';r.stress.workSchoolLevel=_segVal('rc_work')||'';
  r.workPattern.physicallyDemanding=_segVal('rc_phys')||'';r.workPattern.shiftType=_segVal('rc_shift')||'';
  r.nutritionState.mode=_segVal('rc_nut')||'';r.nutritionState.energyAvailabilityLimited=(document.getElementById('rc_eal')||{}).checked;
  r.recoveryPreferences.activeRecoveryAllowed=(document.getElementById('rc_arec')||{}).checked;return r;}
function saveRecoveryEditor(){PROFILE.recovery=pmModel().normalizeRecovery(_recCollect());_profileSave(['recovery']);_closeM('_recEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Gespeichert');}
function cancelRecoveryEditor(){_recCollect();if(pmModel().diffState(JSON.parse(window._recEd.orig),window._recEd.r)){
  _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p><button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button><button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_recEdM\')">Änderungen verwerfen</button>');
  }else _closeM('_recEdM');}

var PREF_DISLIKED=[['long_easy','Lange ruhige Einheiten'],['intervals','Intervalle'],['treadmill','Laufband'],['indoor_bike','Indoor-Rad'],['heavy_compounds','Schwere Grundübungen'],['circuit','Zirkeltraining'],['long_strength','Sehr lange Kraftsessions'],['group_classes','Gruppenkurse'],['competition_sim','Wettkampfsimulationen'],['technique','Techniktraining']];
function openPreferencesEditor(){var M=pmModel();var p=M.normalizePreferences(PROFILE.preferences||PROFILE.trainingPrefs,PROFILE.trainingPrefs);
  window._prefEd={orig:JSON.stringify(p),p:JSON.parse(JSON.stringify(p))};var sports=_recSports();
  function chipset(id,opts,sel){return '<div class="gm-chips" id="'+id+'">'+opts.map(function(o){return '<button type="button" class="gm-chip'+(sel.indexOf(o[0])>=0?' on':'')+'" data-v="'+escH(o[0])+'" onclick="gmToggle(this)">'+escH(o[1])+'</button>';}).join('')+'</div>';}
  openSheet({id:'_prefEdM',title:'Trainingspräferenzen',onClose:cancelPreferencesEditor,
    actions:'<button class="btn" onclick="savePreferencesEditor()">Speichern</button><button class="btn sec" onclick="cancelPreferencesEditor()">Abbrechen</button>',
    body:(sports.length?'<div class="gm-field"><label>Bevorzugte Sportarten</label>'+chipset('pf_sports',sports.map(function(s){return [s.sportId,s.customName||_sportLabel(s)];}),p.preferredSports)+'</div>':'')+
    '<div class="gm-field"><label>Unbeliebte Trainingsformen</label>'+chipset('pf_dislike',PREF_DISLIKED,p.dislikedTrainingForms)+'</div>'+
    '<div class="gm-field"><label>Eigene Angabe (optional)</label><input id="pf_dislikeCustom" value="'+escH(p.dislikedCustom||'')+'"></div>'+
    '<div class="gm-field"><label>Bevorzugte Einheitsdauer</label>'+chipset('pf_dur',[['30','30 min'],['45','45 min'],['60','60 min'],['75','75 min'],['90','90 min'],['120','90+ min'],['0','Flexibel']],p.preferredSessionDurations.map(String))+'</div>'+
    '<div class="gm-field"><label>Umgebung</label>'+segHTML('pf_env',[['indoor','Bevorzugt indoor'],['outdoor','Bevorzugt outdoor'],['both','Beides'],['none','Keine Präferenz']],p.preferredEnvironment)+'</div>'+
    '<div class="gm-field"><label>Trainingszeiten</label>'+chipset('pf_times',[['morning','Morgens'],['noon','Mittags'],['afternoon','Nachmittags'],['evening','Abends'],['flexible','Flexibel']],p.preferredTimes)+'</div>'+
    '<div class="gm-field"><label>Intensitätspräferenz</label>'+segHTML('pf_int',[['easy','Eher locker'],['balanced','Ausgeglichen'],['intense','Eher intensiv'],['none','Keine Präferenz']],p.intensityPreference)+'</div>'+
    '<div class="gm-field"><label>Allein oder Gruppe</label>'+segHTML('pf_social',[['solo','Allein'],['group','Gruppe'],['both','Beides'],['none','Keine Präferenz']],p.socialPreference)+'</div>'+
    '<div class="gm-field"><label>Abwechslung</label>'+segHTML('pf_variety',[['low','Wenig – klare Wiederholung'],['balanced','Ausgewogen'],['high','Viel – häufig wechselnd']],p.varietyPreference)+'</div>'+
    '<div class="gm-field"><label>Coaching-Stil (optional)</label>'+segHTML('pf_coach',[['direct','Direkt und leistungsorientiert'],['motivating','Motivierend'],['analytic','Analytisch'],['reserved','Zurückhaltend'],['none','Keine Präferenz']],p.coachingStyle)+'</div>'+
    '<div class="gm-field"><label>Zu vermeidende Übungen (optional, Komma-getrennt)</label><input id="pf_avoid" value="'+escH(p.avoidedExercises.map(function(e){return e.exerciseName;}).filter(Boolean).join(', '))+'"></div>'});}
function _prefChips(id){var c=document.getElementById(id);return c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[];}
function _prefCollect(){var p=window._prefEd.p;
  p.preferredSports=_prefChips('pf_sports');p.dislikedTrainingForms=_prefChips('pf_dislike');p.dislikedCustom=(document.getElementById('pf_dislikeCustom')||{}).value||'';
  p.preferredSessionDurations=_prefChips('pf_dur').map(function(x){return parseInt(x,10);});
  p.preferredEnvironment=_segVal('pf_env')||'';p.preferredTimes=_prefChips('pf_times');p.intensityPreference=_segVal('pf_int')||'';p.socialPreference=_segVal('pf_social')||'';
  p.varietyPreference=_segVal('pf_variety')||'';p.coachingStyle=_segVal('pf_coach')||'';
  var av=(document.getElementById('pf_avoid')||{}).value||'';var prev=p.avoidedExercises||[];
  p.avoidedExercises=av.split(',').map(function(s){return s.trim();}).filter(Boolean).map(function(name){var ex=prev.filter(function(e){return e.exerciseName===name;})[0];return ex||{exerciseId:null,exerciseName:name,reason:'',constraintId:null};});
  return p;}
function savePreferencesEditor(){PROFILE.preferences=pmModel().normalizePreferences(_prefCollect());_profileSave(['preferences']);_closeM('_prefEdM');try{renderProfileScreen();}catch(e){}if(typeof toast==='function')toast('Gespeichert');}
function cancelPreferencesEditor(){_prefCollect();if(pmModel().diffState(JSON.parse(window._prefEd.orig),window._prefEd.p)){
  _modal('_secDiscard','<h3>Änderungen verwerfen?</h3><p class="modtext" style="margin:0 0 14px">Deine letzten Anpassungen wurden noch nicht gespeichert.</p><button class="btn sec" onclick="_closeM(\'_secDiscard\')">Weiter bearbeiten</button><button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_secDiscard\');_closeM(\'_prefEdM\')">Änderungen verwerfen</button>');
  }else _closeM('_prefEdM');}

/* ============================================================
   GERÄTE, TRAININGSAUSSTATTUNG & DATENQUELLEN (Inkrement 4h). Keine Fake-Verbindungen.
   ============================================================ */
var INT_STATUS_DE={not_available:'Nicht verfügbar',not_connected:'Nicht verbunden',connecting:'Verbindung wird hergestellt',connected:'Verbunden',permission_required:'Berechtigung erforderlich',error:'Fehler',sync_paused:'Synchronisierung pausiert'};
var INT_NAME_DE={strava:'Strava',garmin:'Garmin',appleHealth:'Apple Health'};
var CAP_DE={activities:'Aktivitäten',heartRate:'Herzfrequenz',route:'Strecke',distance:'Distanz',pace:'Pace',power:'Leistung',sleep:'Schlaf',hrv:'HRV',bodyWeight:'Gewicht',workouts:'Workouts'};
var EQUIP_GROUPS=[['Ausdauer',[['road_bike','Rennrad'],['gravel_bike','Gravelbike'],['mtb','Mountainbike'],['indoor_trainer','Indoor-Trainer'],['treadmill','Laufband'],['row_erg','Ruderergometer'],['ski_erg','SkiErg'],['air_bike','AirBike'],['cross_trainer','Crosstrainer']]],['Krafttraining',[['gym_access','Fitnessstudio'],['barbell','Langhantel'],['dumbbells','Kurzhanteln'],['machines','Maschinen'],['cable','Kabelzug'],['kettlebells','Kettlebells'],['pullup_bar','Klimmzugstange'],['bands','Widerstandsbänder'],['home_gym','Home-Gym']]],['Schwimmen',[['pool25','25-m-Pool'],['pool50','50-m-Pool'],['open_water','Freiwasserzugang'],['pullbuoy','Pullbuoy'],['paddles','Paddles'],['fins','Flossen']]],['HYROX',[['hx_ski','SkiErg'],['hx_row','RowErg'],['hx_sled_push','Sled Push'],['hx_sled_pull','Sled Pull'],['hx_wallball','Wall Balls'],['hx_sandbag','Sandbag'],['hx_farmers','Farmers-Carry-Gewichte']]],['Sonstiges',[['other','Eigene Ausstattung']]]];
var EQUIP_LABEL={};EQUIP_GROUPS.forEach(function(g){g[1].forEach(function(p){EQUIP_LABEL[p[0]]=p[1];});});
var LOC_TYPES=[['gym','Fitnessstudio'],['home','Zuhause'],['club','Verein'],['pool','Schwimmbad'],['track','Laufbahn'],['outdoor','Outdoor'],['other','Sonstiger Ort']];
var MANUAL_TYPES=[['manual','Manuelle Eingabe'],['gpx','GPX-Datei'],['tcx','TCX-Datei'],['csv','CSV-Import'],['other','Sonstiger Import']];
function _devM(){return pmModel();}
function openDevicesManager(){var M=_devM();window._devEd={dev:M.normalizeDevices(PROFILE.devices,PROFILE.dataSources)};_modal('_devMgr','<div id="devBody"></div>');renderDevicesManager();}
function _devPersist(){var M=_devM();PROFILE.devices=M.normalizeDevices(window._devEd.dev,PROFILE.dataSources);_profileSave(['devices']);renderDevicesManager();if(typeof toast==='function')toast('Gespeichert');}
function renderDevicesManager(){var M=_devM();var dev=window._devEd.dev;var box=document.getElementById('devBody');if(!box)return;
  var eq=dev.equipment.filter(function(e){return e.available;});
  var intCards=M.INTEGRATION_IDS.map(function(k){var i=dev.integrations[k];var bits=[INT_STATUS_DE[i.status]||i.status];
    if(i.connected&&i.lastSyncAt)bits.push('Letzte Synchronisierung: '+i.lastSyncAt);
    if(i.connected&&i.capabilities.length)bits.push(i.capabilities.map(function(c){return CAP_DE[c]||c;}).join(', '));
    if(i.status==='error'&&i.errorCode)bits.push('Fehler: '+i.errorCode);
    var note=(k==='garmin'&&!i.connected)?'<div class="gmc-meta">Die automatische Garmin-Synchronisierung ist vorbereitet, aber aktuell noch nicht verfügbar.</div>':((k==='appleHealth'&&i.status==='not_available')?'<div class="gmc-meta">In dieser Version nicht verfügbar.</div>':(k==='strava'&&!i.connected?'<div class="gmc-meta">Import per GPX/TCX/JSON verfügbar; automatischer Sync noch nicht.</div>':''));
    return '<div class="gmcard"><div class="gmc-h">'+INT_NAME_DE[k]+'</div><div class="gmc-meta">'+escH(bits.join(' · '))+'</div>'+note+(i.connected?'<div class="gmc-acts"><button class="gmc-b danger-btn" onclick="devDisconnect(\''+k+'\')">Trennen</button></div>':'')+'</div>';}).join('');
  var legacy=(dev._legacyText&&dev._legacyText.length)?'<div class="gmc-meta">Alte Angaben: '+escH(dev._legacyText.join(', '))+'</div>':'';
  box.innerHTML='<h3>Geräte und Datenquellen</h3>'+
    '<div class="gmcard"><div class="gmc-h">Trainingsausstattung ('+eq.length+' verfügbar)</div>'+(dev.equipment.length?dev.equipment.map(function(e){return '<div class="gw-ms"><span>'+escH((EQUIP_LABEL[e.type]||e.label||e.type)+(e.available?'':' · nicht verfügbar'))+'</span><button class="gmc-b" onclick="openEquipmentEditor(\''+e.id+'\')">✎</button><button class="gmc-b danger-btn" onclick="devDelEquip(\''+e.id+'\')">✕</button></div>';}).join(''):'<p class="note" style="text-align:left">Keine Ausstattung.</p>')+'<div class="gmc-acts"><button class="gmc-b" onclick="openEquipmentEditor()">Ausstattung hinzufügen</button></div></div>'+
    '<div class="gmcard"><div class="gmc-h">Trainingsorte ('+dev.trainingLocations.length+')</div>'+(dev.trainingLocations.length?dev.trainingLocations.map(function(l){return '<div class="gw-ms"><span>'+escH((l.name||_locTypeLabel(l.type)))+'</span><button class="gmc-b" onclick="openLocationEditor(\''+l.id+'\')">✎</button><button class="gmc-b danger-btn" onclick="devDelLoc(\''+l.id+'\')">✕</button></div>';}).join(''):'<p class="note" style="text-align:left">Keine Orte.</p>')+'<div class="gmc-acts"><button class="gmc-b" onclick="openLocationEditor()">Trainingsort hinzufügen</button></div></div>'+
    '<div class="gm-sec">Datenintegrationen</div>'+intCards+
    '<div class="gmcard"><div class="gmc-h">Manuelle Datenquellen</div><div class="gm-chips" id="dev_manual">'+MANUAL_TYPES.map(function(t){var on=dev.manualSources.some(function(m){return m.type===t[0];});return '<button type="button" class="gm-chip'+(on?' on':'')+'" data-v="'+t[0]+'" onclick="gmToggle(this)">'+escH(t[1])+'</button>';}).join('')+'</div><div class="gmc-acts"><button class="gmc-b" onclick="devSaveManual()">Datenquellen speichern</button></div></div>'+
    legacy+'<div class="gm-modal-actions"><button class="btn sec" onclick="_closeM(\'_devMgr\')">Schließen</button></div>';}
function _locTypeLabel(t){var p=LOC_TYPES.filter(function(x){return x[0]===t;})[0];return p?p[1]:t;}
function devDisconnect(k){_modal('_devSubC','<h3>'+INT_NAME_DE[k]+' trennen?</h3><p class="modtext" style="margin:0 0 14px">Die Verbindung wird getrennt. Historische Werte bleiben erhalten.</p><button class="btn sec" onclick="_closeM(\'_devSubC\')">Abbrechen</button><button class="btn danger-btn" style="margin-top:10px" onclick="_closeM(\'_devSubC\');_devDoDisconnect(\''+k+'\')">Trennen</button>');}
function _devDoDisconnect(k){window._devEd.dev.integrations[k]={status:'not_connected',connected:false,lastSyncAt:null,capabilities:[],accountLabel:null,errorCode:null};_devPersist();}
function openEquipmentEditor(id){var dev=window._devEd.dev;var e=id?dev.equipment.filter(function(x){return x.id===id;})[0]:null;
  var groups=EQUIP_GROUPS.map(function(g){return [g[0],g[1]];});
  _modal('_devSub','<h3>'+(e?'Ausstattung bearbeiten':'Ausstattung hinzufügen')+'</h3>'+
    '<div class="gm-field"><label>Gerät</label>'+segGroupedHTML('eq_type',groups,(e&&e.type)||'')+'</div>'+
    '<div class="gm-field"><label>Bezeichnung (optional)</label><input id="eq_label" value="'+escH(e?e.label:'')+'"></div>'+
    '<div class="gm-field gm-inline"><input type="checkbox" id="eq_avail"'+(!e||e.available?' checked':'')+'><label>Verfügbar</label></div>'+
    '<div class="gm-field"><label>Notiz (optional)</label><input id="eq_notes" value="'+escH(e?e.notes:'')+'"></div>'+
    '<div class="gm-modal-actions"><button class="btn" onclick="saveEquipmentEditor(\''+(id||'')+'\')">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="_closeM(\'_devSub\')">Abbrechen</button></div>');}
function saveEquipmentEditor(id){var M=_devM();var dev=window._devEd.dev;var rec={id:id||null,type:_segVal('eq_type')||'other',label:(document.getElementById('eq_label')||{}).value||'',available:(document.getElementById('eq_avail')||{}).checked,notes:(document.getElementById('eq_notes')||{}).value||''};
  if(id)dev.equipment=dev.equipment.map(function(x){return x.id===id?M.normalizeEquipment(Object.assign({},x,rec)):x;});else dev.equipment.push(M.normalizeEquipment(rec));_closeM('_devSub');_devPersist();}
function devDelEquip(id){window._devEd.dev.equipment=window._devEd.dev.equipment.filter(function(x){return x.id!==id;});_devPersist();}
function openLocationEditor(id){var dev=window._devEd.dev;var l=id?dev.trainingLocations.filter(function(x){return x.id===id;})[0]:null;
  var caps=[['barbell','Langhantel'],['machines','Maschinen'],['cable','Kabelzug'],['pool','Pool'],['track','Bahn'],['cardio','Cardio']];
  _modal('_devSub','<h3>'+(l?'Trainingsort bearbeiten':'Trainingsort hinzufügen')+'</h3>'+
    '<div class="gm-field"><label>Typ</label>'+segHTML('loc_type',LOC_TYPES,(l&&l.type)||'gym')+'</div>'+
    '<div class="gm-field"><label>Name</label><input id="loc_name" value="'+escH(l?l.name:'')+'"></div>'+
    '<div class="gm-field"><label>Ausstattung vor Ort</label><div class="gm-chips" id="loc_caps">'+caps.map(function(c){var on=l&&(l.capabilities||[]).indexOf(c[0])>=0;return '<button type="button" class="gm-chip'+(on?' on':'')+'" data-v="'+c[0]+'" onclick="gmToggle(this)">'+escH(c[1])+'</button>';}).join('')+'</div></div>'+
    '<div class="gm-field"><label>Verfügbare Tage</label><div class="gm-chips" id="loc_days">'+pmModel().WEEKDAYS.map(function(d){var on=l&&(l.availableDays||[]).indexOf(d)>=0;return '<button type="button" class="gm-chip'+(on?' on':'')+'" data-v="'+d+'" onclick="gmToggle(this)">'+WD_DE[d]+'</button>';}).join('')+'</div></div>'+
    '<div class="gm-modal-actions"><button class="btn" onclick="saveLocationEditor(\''+(id||'')+'\')">Speichern</button><button class="btn sec" style="margin-top:10px" onclick="_closeM(\'_devSub\')">Abbrechen</button></div>');}
function saveLocationEditor(id){var M=_devM();var dev=window._devEd.dev;function chips(i){var c=document.getElementById(i);return c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[];}
  var rec={id:id||null,type:_segVal('loc_type')||'gym',name:(document.getElementById('loc_name')||{}).value||'',capabilities:chips('loc_caps'),availableDays:chips('loc_days')};
  if(id)dev.trainingLocations=dev.trainingLocations.map(function(x){return x.id===id?M.normalizeTrainingLocation(Object.assign({},x,rec)):x;});else dev.trainingLocations.push(M.normalizeTrainingLocation(rec));_closeM('_devSub');_devPersist();}
function devDelLoc(id){window._devEd.dev.trainingLocations=window._devEd.dev.trainingLocations.filter(function(x){return x.id!==id;});_devPersist();}
function devSaveManual(){var c=document.getElementById('dev_manual');var sel=c?Array.prototype.slice.call(c.querySelectorAll('.on')).map(function(b){return b.dataset.v;}):[];
  var lab={};MANUAL_TYPES.forEach(function(t){lab[t[0]]=t[1];});window._devEd.dev.manualSources=sel.map(function(t){return {id:'ms:'+t,type:t,label:lab[t]||t};});_devPersist();}
