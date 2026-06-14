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
  name:'', location:'', age:null, sex:'',
  weightKg:70, heightCm:175, hfMax:190, rhrBaseline:60, sleepGoalH:8,
  primaryGoal:'health', primaryGoalLabel:'Allgemeine Gesundheit',
  raceName:'', raceDate:'', hmTargetMin:null,
  secondaryGoals:[], avatar:'', goal:null, nutrition:null, gear:[],
  sports:[], level:'fortgeschritten',
  weeklyKm:null, longestRunKm:null,
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
var LEVEL_LABELS={anfaenger:'Anfänger',wiedereinstieg:'Wiedereinstieg',fortgeschritten:'Fortgeschritten',leistung:'Leistungsorientiert'};

/* ============ PROFILSEITE RENDERN ============ */
/* ===== Equipment-Verschleiß (Schuhe/Rad km bis Wechsel) ===== */
function gearKm(g){var key=g.type==='bike'?'Rad':'Laufen';var sum=0;
  try{Object.keys(DB).filter(isDay).forEach(function(k){if(g.since&&k<g.since)return;var s=DB[k].sessions;if(s&&s[key]&&s[key].dist)sum+=s[key].dist;});}catch(e){}
  return Math.round(sum);}
function renderEquipment(){
  var el=document.getElementById('equipmentBox');if(!el)return;
  var gear=(PROFILE&&PROFILE.gear)||[];
  var rows=gear.map(function(g,i){var km=gearKm(g),lim=g.limitKm||(g.type==='bike'?15000:800);var pct=Math.min(100,Math.round(km/lim*100));
    var c=pct>=90?'r':pct>=75?'y':'g';var icn=g.type==='bike'?'bike':'run';
    return '<div class="eq"><div class="eq-top"><span class="eq-n"><svg class="ic"><use href="#i-'+icn+'"/></svg>'+escH(g.name)+'</span><span class="eq-km">'+km+' / '+lim+' km</span><button class="eq-x" onclick="delGear('+i+')" aria-label="Entfernen">✕</button></div>'+
      '<div class="goalbar"><i class="eqbar eqbar-'+c+'" style="width:'+pct+'%"></i></div></div>';}).join('');
  el.innerHTML=(rows||'<p class="muted" style="margin:0 0 8px">Noch kein Equipment. Füge Schuhe oder Rad hinzu, um die km bis zum Wechsel zu verfolgen.</p>')+
    '<button class="btn sec" style="margin-top:10px" onclick="addGearPrompt()">+ Equipment hinzufügen</button>';
}
function addGearPrompt(){
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Equipment hinzufügen</h3>'+
    '<div class="gm-field"><label>Name</label><input id="gear_n" type="text" placeholder="z. B. Nike Vomero 18"></div>'+
    '<div class="gm-field"><label>Typ</label><div class="gm-chips" id="gear_t"><button type="button" class="gm-chip on" data-v="shoe" onclick="gmPick(this,\'gear_t\')">Schuhe</button><button type="button" class="gm-chip" data-v="bike" onclick="gmPick(this,\'gear_t\')">Rad</button></div></div>'+
    '<div class="gm-field"><label>Wechsel-Limit (km)</label><input id="gear_l" type="number" inputmode="numeric" value="800"></div>'+
    '<button class="btn" onclick="saveGear()">Hinzufügen</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeGear()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._gearModal=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closeGear();});
}
function closeGear(){if(window._gearModal){try{window._gearModal.remove();}catch(e){}window._gearModal=null;}}
function saveGear(){
  if(!PROFILE&&typeof ensureProfile==='function')ensureProfile();
  var nEl=document.getElementById('gear_n');var n=(nEl?nEl.value:'').trim();if(!n){if(typeof toast==='function')toast('Name fehlt');return;}
  var td=(document.querySelector('#gear_t .on')||{}).dataset;var t=td?td.v:'shoe';
  var l=parseInt((document.getElementById('gear_l')||{}).value,10);if(isNaN(l)||l<=0)l=(t==='bike'?15000:800);
  PROFILE.gear=PROFILE.gear||[];PROFILE.gear.push({name:n,type:t,limitKm:l,since:(typeof todayStr==='function'?todayStr():'')});
  if(typeof saveProfile==='function')saveProfile();closeGear();renderEquipment();if(typeof toast==='function')toast('Equipment hinzugefügt ✓');
}
function delGear(i){if(PROFILE&&PROFILE.gear){PROFILE.gear.splice(i,1);if(typeof saveProfile==='function')saveProfile();renderEquipment();}}
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
  var goals=[goalChip(p)].concat(p.secondaryGoals||[]);
  var ava=p.avatar?'<img src="'+escH(p.avatar)+'" alt="">':escH(initial);
  el.innerHTML='<div class="profhead"><div class="avatar" onclick="changeProfilePhoto()" title="Foto ändern">'+ava+'</div>'+
    '<div class="profmeta"><div class="profname">'+escH(p.name||'Athlet')+'</div><div class="profsub">'+escH(sub)+'</div></div>'+
    '<button class="editbtn" onclick="openOnboarding(false)" aria-label="Profil bearbeiten"><svg class="ic"><use href="#i-gear"/></svg></button></div>'+
    '<div class="goalchips">'+goals.map(function(g){return '<span class="goalchip">'+escH(g)+'</span>';}).join('')+'</div>';
  var pi=document.getElementById('perfIdentity');if(pi)pi.innerHTML=identityRows(p);
  renderZones();
}
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
  var el=document.getElementById('zoneList');if(!el)return;var max=(PROFILE&&PROFILE.hfMax)||201;
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
   opts:[['anfaenger','Anfänger'],['wiedereinstieg','Wiedereinstieg'],['fortgeschritten','Fortgeschritten'],['leistung','Leistungsorientiert']]},
  {t:'fields',title:'Körper- & Trainingsdaten',sub:'Basis für Zonen, Baselines und Empfehlungen.',
   fields:[['name','Name','text'],['location','Ort','text'],['age','Alter','number'],['weightKg','Gewicht (kg)','number'],
    ['heightCm','Größe (cm)','number'],['hfMax','HFmax','number'],['rhrBaseline','Ruhepuls Ø','number'],
    ['sleepGoalH','Schlafziel (h)','number'],['weeklyKm','Wochen-km','number'],['longestRunKm','Längster Lauf (km)','number']]},
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
function obNext(){if(OB_I<OB_STEPS.length-1){OB_I++;renderOB();}}
function obBack(){if(OB_I>0){OB_I--;renderOB();}}
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
  OB.onboarded=true;OB.v=1;
  var _base=OB_FRESH?Object.assign({},PROFILE_DEFAULTS):Object.assign({},PROFILE_DEFAULTS,PROFILE||{});
  PROFILE=Object.assign({},_base,OB);
  if(PROFILE.goal&&PROFILE.goal.type&&PROFILE.goal.type!==PROFILE.primaryGoal)PROFILE.goal=null;
  try{if(PROFILE.hmTargetMin&&typeof DB!=='undefined'&&DB){DB._hmTargetMin=PROFILE.hmTargetMin;if(typeof _goalCache!=='undefined')_goalCache=null;}}catch(e){}
  saveProfile();closeOnboarding();
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
        return '<label class="ob-f"><span>'+escH(f[1])+'</span><input id="ob_'+f[0]+'" type="'+(f[2]==='number'?'number':'text')+'" inputmode="'+(f[2]==='number'?'decimal':'text')+'" value="'+escH(v)+'"></label>';}).join('')+'</div>';
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
