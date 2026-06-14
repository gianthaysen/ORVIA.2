/* ============================================================
   ORVIA — Pro Layer (Phase 5, final)
   Premium-Modal-System, What-if-Simulation, Coach Mode,
   Pattern Detection, Weekly Review, Data Hub, Consent/Legal/
   Medical, Quick Actions, Splash, Offline-State.
   Additiv. Keine medizinische Diagnose, keine Heilversprechen.
   ============================================================ */

/* ---- Generisches Premium-Modal (nutzt vorhandenes #suppModal) ---- */
function oModal(title,body,footer){
  document.getElementById('suppSheet').innerHTML=
    '<div class="sheethead"><h2>'+escH(title)+'</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>'+
    body+(footer||'');
  document.getElementById('suppModal').classList.add('show');
}
function kwColor(s){s=(''+s).toLowerCase();
  if(/hoch|erhöht|deutlich|negativ|kritisch|stoppen/.test(s))return 'var(--danger)';
  if(/moderat|leicht|neutral|stabil|easy/.test(s))return 'var(--accent)';
  if(/gering|keine|niedrig|positiv|sinkt|möglich/.test(s))return 'var(--success)';
  return 'var(--text-muted)';}

/* ============ QUICK ACTIONS (Home) ============ */
function renderQuickActions(){
  var el=document.getElementById('quickActions');if(!el)return;
  el.innerHTML='<div class="card"><h2><svg class="ic"><use href="#i-zap"/></svg>Quick Actions</h2>'+
    '<div class="qagrid">'+
    '<button class="qabtn" onclick="openWhatIf()">'+ic('target')+'<span>Was-wäre-wenn</span></button>'+
    '<button class="qabtn" onclick="openCoach()">'+ic('info')+'<span>Coach fragen</span></button>'+
    '<button class="qabtn" onclick="openWhy()">'+ic('zap')+'<span>Warum heute?</span></button>'+
    '</div></div>';
}

/* ============ WHAT-IF SIMULATION ============ */
function openWhatIf(){
  var risk=(typeof riskCard==='function')?riskCard():{score:0,rec:''};
  var b=risk.score;
  var opts=[
    {label:'Laufen wie geplant',load:'moderat–hoch',issue:b>=40?'erhöht':'gering',week:'positiv',tom:b>=40?'negativ':'neutral'},
    {label:'Bike Z2 statt Lauf',load:'moderat',issue:'stabil',week:'neutral',tom:'leicht positiv'},
    {label:'Einheit verkürzen',load:'niedrig–moderat',issue:'gering',week:'leicht positiv',tom:'neutral'},
    {label:'Pausieren / Regeneration',load:'keine',issue:'sinkt',week:'leicht negativ',tom:'positiv'},
    {label:'Trotzdem Intensität',load:'hoch',issue:b>=20?'deutlich erhöht':'erhöht',week:'positiv',tom:'negativ'}
  ];
  var best=b>=40?'Bike Z2 oder 5 km Easy':b>=20?'Easy Z2 — Intensität nur nach gutem Warm-up':'Plan möglich';
  var rows=opts.map(function(o){
    return '<div class="wif"><div class="wiflabel">'+escH(o.label)+'</div>'+
      '<div class="wifgrid">'+
        '<span>Belastung<b style="color:'+kwColor(o.load)+'">'+escH(o.load)+'</b></span>'+
        '<span>Beschwerderisiko<b style="color:'+kwColor(o.issue)+'">'+escH(o.issue)+'</b></span>'+
        '<span>Wochenziel<b style="color:'+kwColor(o.week)+'">'+escH(o.week)+'</b></span>'+
        '<span>Erholung morgen<b style="color:'+kwColor(o.tom)+'">'+escH(o.tom)+'</b></span>'+
      '</div></div>';}).join('');
  var conf=(typeof confidenceLevel==='function')?confidenceLevel():{l:'niedrig'};
  oModal('Was-wäre-wenn',
    '<p class="muted" style="margin:2px 0 14px">Simulierte Auswirkungen auf Basis deiner aktuellen Werte. Keine Garantie.</p>'+
    rows+
    '<div class="wifrec"><b>Empfehlung:</b> '+escH(best)+'. '+escH(risk.rec||'')+'</div>'+
    '<div style="margin-top:6px">'+confChip(conf)+'</div>',
    '<div class="row2" style="margin-top:14px"><button class="btn sec" onclick="closeSupp()">Schließen</button>'+
      '<button class="btn sec" onclick="closeSupp()">Alternative wählen</button></div>');
}

/* ============ COACH MODE (regelbasiert, datenbezogen) ============ */
var COACH_Q=[
  ['Warum heute (nicht) trainieren?','train'],
  ['Was ist die beste Alternative?','alt'],
  ['Was bedeutet meine HRV heute?','hrv'],
  ['Wie wirkt sich das auf mein Ziel aus?','goal'],
  ['Warum ist mein Risiko so?','risk']
];
function coachAnswer(key){
  var c=intelCtx(),risk=riskCard(),rd=recoveryDebt(),conf=confidenceLevel();
  var a='';
  if(key==='train'){a=risk.score>=40?'Erhöhtes Risiko ('+risk.state.l+'). '+risk.rec:risk.score>=20?'Training möglich, aber angepasst. '+risk.rec:'Werte tragen die geplante Einheit. '+risk.rec;}
  else if(key==='alt'){a=risk.score>=40?'Bike Z2, Schwimmen oder Mobility — gleiche Aktivierung, geringe Gelenk-/Erholungskosten.':'Easy Z2 oder verkürzte Einheit, falls du Reserve sparen willst.';}
  else if(key==='hrv'){a=c.hrvDevPct==null?'Noch keine stabile HRV-Baseline. Mehr Daten sammeln.':(c.hrvDevPct<=-8?'HRV '+c.hrvDevPct.toFixed(0)+'% unter Schnitt — Hinweis auf unvollständige Erholung/Belastung. Intensität zurückstellen.':c.hrvDevPct<0?'HRV leicht unter Schnitt ('+c.hrvDevPct.toFixed(0)+'%). Normale Steuerung, Intensität nach Warm-up.':'HRV im/über Normalbereich — gute Erholung.');}
  else if(key==='goal'){a='Wochen-km '+c.weekKm.toFixed(0)+(c.targetKm?' / '+c.targetKm+' Soll. ':'. ')+(rd.score>=45?'Recovery Debt hoch — zusätzliche Last bringt heute wenig Zielnutzen.':'Konsistenz zahlt aufs Ziel ein; Erholung mitnehmen.');}
  else if(key==='risk'){a='Risiko '+risk.state.l+(risk.why.length?' — Treiber: '+risk.why.join(', ')+'.':'.')+' '+risk.rec;}
  return a+'  ['+conf.l+']';
}
function openCoach(){
  var qs=COACH_Q.map(function(q,i){return '<button class="coachq" onclick="coachShow('+i+')">'+escH(q[0])+'</button>';}).join('');
  oModal('Coach',
    '<p class="muted" style="margin:2px 0 14px">Kurze, datenbezogene Antworten. Keine medizinische Diagnose.</p>'+
    '<div class="coachqs">'+qs+'</div><div id="coachA" class="coachA"></div>');
}
function coachShow(i){
  var ans=coachAnswer(COACH_Q[i][1]);
  document.getElementById('coachA').innerHTML='<div class="coachbubble"><div class="coachqlabel">'+escH(COACH_Q[i][0])+'</div>'+escH(ans)+'</div>';
}
function openWhy(){var ans=coachAnswer('train');oModal('Warum heute?', '<div class="coachbubble">'+escH(ans)+'</div>');}

/* ============ PATTERN DETECTION ============ */
function detectPatterns(){
  var pats=[];var days=[];for(var i=0;i<60;i++){var k=dkey(-i);if(DB[k])days.push(DB[k]);}
  if(dataDays()<10)return null;
  // 1) Beschwerde nach langen Läufen
  var afterLong=[],afterShort=[];
  for(var i=1;i<60;i++){var prev=DB[dkey(-i)],curd=DB[dkey(-i+1)];if(!prev||!curd)continue;
    var run=prev.sessions&&prev.sessions.Laufen;var nk=(curd.morning&&curd.morning.knee!=null)?curd.morning.knee:null;
    if(run&&run.dist!=null&&nk!=null){(run.dist>=7?afterLong:afterShort).push(nk);}}
  if(afterLong.length>=3&&afterShort.length>=3){var dl=Calc.avg(afterLong)-Calc.avg(afterShort);
    if(dl>=0.8)pats.push('Beschwerden steigen meist nach Läufen ab ~7 km (Ø +'+dl.toFixed(1)+'/10 am Folgetag).');}
  // 2) Schlaf < 6:20 senkt Readiness am Folgetag
  var lowR=[],hiR=[];
  for(var i=1;i<60;i++){var prev=DB[dkey(-i)],curd=DB[dkey(-i+1)];if(!prev||!curd)continue;
    var sm=prev.morning&&prev.morning.sleepMin;var r=(typeof readinessOf==='function')?readinessOf(dkey(-i+1)):null;
    if(sm!=null&&r!=null){(sm<380?lowR:hiR).push(r);}}
  if(lowR.length>=3&&hiR.length>=3){var dr=Calc.avg(hiR)-Calc.avg(lowR);
    if(dr>=6)pats.push('Schlaf unter ~6:20 h senkt deine Readiness am Folgetag deutlich (Ø −'+dr.toFixed(0)+'%).');}
  // 3) schwächster Wochentag
  var wd=[[],[],[],[],[],[],[]];
  for(var i=0;i<60;i++){var k=dkey(-i);var e=DB[k];if(!e)continue;var r=(typeof readinessOf==='function')?readinessOf(k):null;
    if(r!=null){var d=(new Date(k+'T12:00').getDay()+6)%7;wd[d].push(r);}}
  var names=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'],worst=null,worstV=999;
  for(var d=0;d<7;d++){if(wd[d].length>=3){var av=Calc.avg(wd[d]);if(av<worstV){worstV=av;worst=d;}}}
  if(worst!=null&&worstV<70)pats.push(names[worst]+'e sind im Schnitt deine schwächeren Erholungstage (Ø '+worstV.toFixed(0)+'% Readiness).');
  return pats;
}
function renderPatterns(){
  var el=document.getElementById('patternBox');if(!el)return;
  var p=detectPatterns();
  if(p==null){el.innerHTML='<p class="muted">Noch keine stabilen Muster. ORVIA benötigt mehr Verlauf (~10+ Tage).</p>';return;}
  if(!p.length){el.innerHTML='<p class="muted">Keine auffälligen Muster im aktuellen Zeitfenster.</p>';return;}
  el.innerHTML=p.map(function(x){return '<div class="insight">'+escH(x)+'</div>';}).join('');
}

/* ============ WEEKLY REVIEW ============ */
function renderWeekly(){
  var el=document.getElementById('weeklyBox');if(!el)return;
  if(dataDays()<3){el.innerHTML='<p class="muted">Wochen-Review erscheint nach einigen Check-ins.</p>';return;}
  var runs=0,kmW=0,gym=0,ready=[],sleeps=[],issues=[],best=null,worst=null,bV=-1,wV=999;
  for(var i=0;i<7;i++){var k=dkey(-i);var e=DB[k];if(!e)continue;var s=e.sessions||{};
    if(s.Laufen){runs++;kmW+=s.Laufen.dist||0;}if(s.Gym)gym++;
    var r=(typeof readinessOf==='function')?readinessOf(k):null;if(r!=null){ready.push(r);if(r>bV){bV=r;best=k;}if(r<wV){wV=r;worst=k;}}
    if(e.morning){if(e.morning.sleepMin)sleeps.push(e.morning.sleepMin/60);if(e.morning.knee!=null)issues.push(e.morning.knee);}}
  var target=(typeof Calc!=='undefined'&&typeof daysTo==='function')?Calc.weekKmTarget(daysTo(RACE.date),0):0;
  var rd=(typeof recoveryDebt==='function')?recoveryDebt():{state:{l:'–'}};
  function fmtD(k){return k?new Date(k+'T12:00').toLocaleDateString('de-DE',{weekday:'short'}):'–';}
  var rec=(wV<60?'Achte auf die schwächeren Tage. ':'')+(target&&kmW>target?'Volumen nächste Woche maximal +5–10 % steigern; keine zweite harte Einheit, wenn HRV fällt.':'Konstanz halten, eine Qualitätseinheit einplanen, wenn Readiness es zulässt.');
  var rows=[
    ['Läufe / Wochen-km',runs+' · '+kmW.toFixed(0)+(target?' / '+target+' km Soll':'')],
    ['Krafttraining',gym+''],
    ['Ø Readiness',ready.length?Math.round(Calc.avg(ready))+'%':'–'],
    ['Ø Schlaf',sleeps.length?Calc.avg(sleeps).toFixed(1)+' h':'–'],
    ['Ø Beschwerde',issues.length?Calc.avg(issues).toFixed(1)+'/10':'–'],
    ['Stärkster / schwächster Tag',fmtD(best)+' / '+fmtD(worst)],
    ['Recovery Debt',rd.state.l]
  ];
  el.innerHTML=rows.map(function(r){return '<div class="blrow"><span class="blk">'+escH(r[0])+'</span><span class="blv">'+escH(r[1])+'</span></div>';}).join('')+
    '<p class="modtext" style="margin-top:12px"><b>Empfehlung:</b> '+escH(rec)+'</p>';
}

/* ============ DATA HUB ============ */
function trainingDays(){var n=0;for(var i=0;i<400;i++){var e=DB[dkey(-i)];if(e&&e.sessions&&Object.keys(e.sessions).filter(function(x){return x!=='_ts';}).length)n++;}return n;}
function hasMetric(field){for(var i=0;i<60;i++){var e=DB[dkey(-i)];if(e&&e.morning&&e.morning[field]!=null)return true;}return false;}
function renderDataHub(){
  var el=document.getElementById('dataHub');if(!el)return;
  var n=dataDays(),dq=dataQualityLabel(n),src=(PROFILE&&PROFILE.dataSources)||[];
  var miss=[];if(!hasMetric('hrvMs'))miss.push('HRV');if(trainingDays()<3)miss.push('Trainingsdaten');if(!hasMetric('knee'))miss.push('Beschwerdedaten');
  var srcChips=['Apple Health','Garmin','Strava','CSV','Manuell'].map(function(s){
    var on=src.indexOf(s)>=0;return '<span class="srcchip'+(on?' on':'')+'">'+escH(s)+(on?'':' · vorbereitet')+'</span>';}).join('');
  el.innerHTML=
    '<div class="dhrow"><span class="blk">Datenqualität</span><span class="dq dq-'+dq.c+'">'+n+' Tage · '+dq.l+'</span></div>'+
    '<div class="dhrow"><span class="blk">Check-ins gespeichert</span><span class="blv">'+n+'</span></div>'+
    '<div class="dhrow"><span class="blk">Trainings gespeichert</span><span class="blv">'+trainingDays()+'</span></div>'+
    '<div class="dhrow"><span class="blk">Fehlende Daten</span><span class="blv">'+(miss.length?escH(miss.join(', ')):'–')+'</span></div>'+
    '<div class="modlbl">Quellen</div><div class="srcchips">'+srcChips+'</div>'+
    '<p class="note" style="text-align:left;margin-top:10px">API-Anbindung (Apple Health/Garmin/Strava) ist vorbereitet — aktuell manueller Import & Paste. 0–3 Tage: Prognose unsicher · 4–7: erste Muster · 8–21: Trends · 21+: stabile Empfehlungen.</p>';
}

/* ============ CONSENT / LEGAL / MEDICAL ============ */
var CONSENT_KEY='orvia_consent';
function loadConsent(){try{return JSON.parse(localStorage.getItem(CONSENT_KEY))||{};}catch(e){return {};}}
function saveConsent(c){try{localStorage.setItem(CONSENT_KEY,JSON.stringify(c));}catch(e){}}
var CONSENT_ITEMS=[
  ['health','Gesundheits- & Fitnessdaten verarbeiten'],
  ['import','Import aus Apple Health / Garmin / Strava'],
  ['local','Lokale Speicherung auf diesem Gerät'],
  ['analyse','Analyse & Insights aus meinen Daten'],
  ['notif','Optionale Erinnerungen / Notifications'],
  ['improve','Anonymisierte Produktverbesserung']
];
function openConsent(){
  var c=loadConsent();
  var rows=CONSENT_ITEMS.map(function(it){var on=!!c[it[0]];
    return '<label class="cslabel"><span>'+escH(it[1])+'</span>'+
      '<button class="cstoggle'+(on?' on':'')+'" onclick="toggleConsent(\''+it[0]+'\',this)" aria-pressed="'+on+'"></button></label>';}).join('');
  oModal('Einwilligungen',
    '<p class="muted" style="margin:2px 0 14px">Du entscheidest, was ORVIA verarbeiten darf. Sensible Einwilligungen sind nicht vorausgewählt und jederzeit widerrufbar.</p>'+
    rows+
    '<div class="modwarn" style="margin-top:16px">Sensible Gesundheitsdaten. Verarbeitung nur mit deiner Einwilligung. Datenexport & Löschung jederzeit möglich.</div>');
}
function toggleConsent(key,btn){var c=loadConsent();c[key]=!c[key];saveConsent(c);btn.classList.toggle('on',c[key]);btn.setAttribute('aria-pressed',c[key]);}
function openLegal(){
  oModal('Rechtliches & Daten',
    '<div class="legalgrid">'+
    ['Impressum','Datenschutzerklärung','Nutzungsbedingungen','Cookie-/Tracking-Einstellungen'].map(function(t){
      return '<button class="legalitem" onclick="openLegalDoc(\''+escH(t)+'\')">'+escH(t)+'</button>';}).join('')+
    '<button class="legalitem" onclick="openConsent()">Einwilligungen verwalten</button>'+
    '<button class="legalitem" onclick="openMedical()">Medizinischer Hinweis</button>'+
    '<button class="legalitem" onclick="exportData()">Datenexport</button>'+
    '<button class="legalitem danger" onclick="confirmDelete()">Alle Daten löschen</button>'+
    '</div>'+
    '<p class="note" style="text-align:left;margin-top:12px">Sprache: Deutsch · Region: EU. App-Version v6 · Datenmodell v4. Rechtstexte sind Platzhalter und müssen vor Veröffentlichung juristisch geprüft werden.</p>');
}
function openLegalDoc(t){oModal(t,'<p class="modtext">Platzhalter — '+escH(t)+'. Dieser Abschnitt ist strukturell vorbereitet; der finale, rechtlich geprüfte Text wird hier ergänzt. ORVIA arbeitet nach Privacy-by-Design: minimale Daten, lokale Speicherung bevorzugt, keine unnötigen Tracker.</p>');}
function openMedical(){oModal('Medizinischer Hinweis','<p class="modtext">'+escH(ORVIA_DISCLAIMER)+'</p><p class="modtext" style="margin-top:10px">Bei Warnsignalen (starke/zunehmende Schmerzen, Schmerz in Ruhe, Schwellung, Taubheit, Ausstrahlung, Fieber, Atemnot, Brustschmerz, Schwindel) gibt ORVIA keine Trainingsentscheidung, sondern empfiehlt ärztliche Abklärung.</p>');}
function confirmDelete(){
  oModal('Alle Daten löschen','<p class="modtext">Das löscht alle Check-ins, dein Profil und Einwilligungen unwiderruflich von diesem Gerät. Vorher Backup ziehen?</p>',
    '<div class="row2" style="margin-top:14px"><button class="btn sec" onclick="exportData()">Backup</button>'+
    '<button class="btn" style="background:var(--danger);color:#fff;border:none" onclick="doDeleteAll()">Endgültig löschen</button></div>');
}
function doDeleteAll(){try{var ks=Object.keys(DB).filter(isDay);ks.forEach(function(k){delete DB[k];});save&&save();
  localStorage.removeItem('orvia_profile_v1');localStorage.removeItem(CONSENT_KEY);}catch(e){}
  closeSupp();if(typeof toast==='function')toast('Daten gelöscht');setTimeout(function(){location.reload();},600);}
function renderLegalCard(){var el=document.getElementById('legalCard');if(!el)return;
  el.innerHTML='<button class="btn sec" onclick="openLegal()">'+ic('info')+' Rechtliches & Daten</button>'+
    '<button class="btn sec" onclick="openConsent()" style="margin-top:10px">'+ic('gear')+' Einwilligungen</button>'+
    '<p class="note" style="text-align:left;margin-top:10px">'+escH(ORVIA_DISCLAIMER)+'</p>';}

/* ============ SPLASH + OFFLINE ============ */
function hideSplash(){var s=document.getElementById('splash');if(!s)return;s.classList.add('hide');setTimeout(function(){s.style.display='none';},600);}
function initOffline(){
  function upd(){var b=document.getElementById('offline');if(!b)return;b.style.display=navigator.onLine?'none':'block';}
  window.addEventListener('online',upd);window.addEventListener('offline',upd);upd();
}
window.addEventListener('load',function(){setTimeout(hideSplash,850);initOffline();});

/* Sammelaufrufe */
function renderProExtras(){if(typeof renderPatterns==='function')renderPatterns();if(typeof renderWeekly==='function')renderWeekly();}
