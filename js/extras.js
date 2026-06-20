/* ============================================================
   ORVIA — Extras: Zielprognose/Fehlerdiagnose, Zielkonflikt,
   Compliance/Streaks, Belastungsbudget, Zyklus-Modul
   Additiv — eigene Render-Funktionen, von ui.js aufgerufen.
   ============================================================ */

/* ---- Zielkonflikt ---- */
function goalConflict(){
  var ng=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.nutrition&&PROFILE.nutrition.goal)||null;
  var g=(typeof goalOf==='function')?goalOf():{};
  var race=(typeof isRaceGoal==='function')&&isRaceGoal(g);
  if(ng==='fatloss'&&race)return 'Zielkonflikt: Kaloriendefizit (Fettverlust) + Wettkampf-Bestzeit bremsen sich gegenseitig. Priorisiere — moderates Defizit ODER volle Leistung in der Wettkampfphase.';
  if(ng==='muscle'&&race)return 'Zielkonflikt: Muskelaufbau (Überschuss) + Ausdauer-Wettkampf konkurrieren. In der Race-Phase Ausdauer priorisieren, Aufbau in die Off-Season.';
  if(ng==='fatloss'&&g.type==='muscle')return 'Zielkonflikt: Fettverlust + Muskelaufbau gleichzeitig klappt v. a. bei Anfängern — sonst eines priorisieren.';
  return null;
}
/* ---- Zielprognose + Fehlerdiagnose ---- */
function forecastCauses(){
  var c=[];
  try{var wk=(typeof weekRunKm==='function')?weekRunKm(0):0,wp=(typeof weekRunKm==='function')?weekRunKm(1):0;
    if(wp>0&&wk<wp*0.6)c.push('Trainingsumfang zuletzt deutlich gesunken — Konsistenz erhöhen.');}catch(e){}
  try{var days=Object.keys(DB).filter(isDay).sort().reverse().slice(0,7);
    var sl=days.map(function(k){return DB[k].morning&&DB[k].morning.sleepMin;}).filter(function(x){return x;});
    if(sl.length>=3&&Calc.avg(sl)<360)c.push('Schlaf im Schnitt unter 6 h — limitiert Anpassung.');}catch(e){}
  try{var w=(typeof nutWeekly==='function')?nutWeekly():null;if(w&&w.proteinDays<=2)c.push('Protein-Ziel selten getroffen — Erholung & Aufbau leiden.');}catch(e){}
  if(!c.length)c.push('Mehr Konsistenz bei den Schlüssel-Einheiten (Long Run, Intervalle/Tempo) zahlt am meisten aufs Ziel ein.');
  return c;
}
function renderForecast(){
  var el=document.getElementById('forecastBox');if(!el)return;
  var html='';
  try{
    var g=(typeof goalOf==='function')?goalOf():{};
    var bg=(typeof buildGoal==='function')?buildGoal():null;
    if(bg&&bg.state&&bg.state!=='nodata'&&g.targetMin&&g.distanceKm){
      var st={ontrack:{l:'realistisch',c:'g'},border:{l:'ambitioniert',c:'y'},risk:{l:'aktuell unrealistisch',c:'r'}}[bg.state]||{l:'offen',c:'y'};
      var pred=bg.tPred?Calc.fmtTime(bg.tPred):'—';
      var gap=(bg.tPred&&g.targetMin)?Math.round(bg.tPred-g.targetMin):null;
      html+='<div class="fc-rate fc-'+st.c+'">Zielzeit '+st.l+'</div>'+
        '<div class="fc-row"><span>Aktuelles Potenzial</span><b>'+pred+'</b></div>'+
        '<div class="fc-row"><span>Zielzeit</span><b>'+Calc.fmtTime(g.targetMin)+'</b></div>'+
        (gap!=null?'<div class="fc-row"><span>Gap</span><b>'+(gap>0?'+'+gap:gap)+' min</b></div>':'');
      if(bg.state!=='ontrack'){var ca=forecastCauses();if(ca.length)html+='<div class="fc-diag"><b>Mögliche Ursachen:</b><ul>'+ca.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';}
    }else{
      html+='<p class="muted" style="margin:0">Für dein Ziel zeigt ORVIA den Fortschritt über Gewichtstrend, Volumen und Konsistenz — eine Zeit-Prognose gibt es nur bei Zeit-Zielen (Lauf/Triathlon mit Zielzeit).</p>';
    }
    var cf=goalConflict();if(cf)html+='<div class="fc-conflict">'+esc(cf)+'</div>';
  }catch(e){html='<p class="muted" style="margin:0">Prognose ab mehr Daten verfügbar.</p>';}
  el.innerHTML=html;
}
/* ---- Compliance / sinnvolle Streaks ---- */
function complianceStats(){
  var streak=0;var d=new Date();
  for(var i=0;i<90;i++){var k=todayStr(d);if(DB[k]&&DB[k].morning){streak++;}else if(i>0){break;}d.setDate(d.getDate()-1);}
  var days=Object.keys(DB).filter(isDay).sort().slice(-7);
  var proteinDays=0,checkins=0,trained=0,rest=0;
  days.forEach(function(k){var e=DB[k];if(!e)return;if(e.morning)checkins++;var ev=e.eve||e.evening||{};if(ev.prot&&ev.prot>=130)proteinDays++;
    var s=e.sessions;var has=s&&Object.keys(s).some(function(t){return t!=='_ts';});if(has)trained++;else rest++;});
  return {streak:streak,checkins:checkins,proteinDays:proteinDays,trained:trained,rest:rest};
}
function renderCompliance(){
  var el=document.getElementById('complianceBox');if(!el)return;
  var c=complianceStats();
  var msg=c.rest===0&&c.trained>=6?'Viel Training, wenig Erholung — Recovery limitiert aktuell.':(c.checkins>=5?'Gute Routine — Check-ins & Erholung im Griff.':'Mehr regelmäßige Check-ins schärfen die Empfehlungen.');
  el.innerHTML='<div class="cmp-grid">'+
    '<div class="cmp"><b>'+c.streak+'</b><span>Check-in-Streak</span></div>'+
    '<div class="cmp"><b>'+c.proteinDays+'/7</b><span>Protein-Ziel</span></div>'+
    '<div class="cmp"><b>'+c.trained+'/7</b><span>Trainingstage</span></div>'+
    '<div class="cmp"><b>'+c.rest+'/7</b><span>Ruhetage</span></div></div>'+
    '<p class="note" style="text-align:left;margin-top:8px">'+esc(msg)+'</p>';
}
/* ---- Belastungsbudget (sportübergreifend, sRPE) ---- */
function loadBudget(){
  var days=Object.keys(DB).filter(isDay).sort().slice(-7);var load=0;
  days.forEach(function(k){var s=DB[k].sessions;if(!s)return;Object.keys(s).forEach(function(t){if(t==='_ts')return;var ss=s[t];load+=(ss.dur||0)*(ss.rpe||5);});});
  var lvl=(typeof userLevel==='function')?userLevel():'fortgeschritten';
  var budget=lvl==='anfaenger'?1800:lvl==='profi'?4500:3000;
  return {load:Math.round(load),budget:budget,pct:Math.round(load/budget*100)};
}
function renderLoadBudget(){
  var el=document.getElementById('loadBudgetBox');if(!el)return;
  var b=loadBudget();var c=b.pct>110?'r':b.pct>90?'y':'g';
  el.innerHTML='<div class="lb-top"><span>Wochenlast (sRPE)</span><b>'+b.load+' / '+b.budget+'</b></div>'+
    '<div class="goalbar"><i class="eqbar eqbar-'+c+'" style="width:'+Math.min(100,b.pct)+'%"></i></div>'+
    '<p class="note" style="text-align:left;margin-top:8px">'+(b.pct>110?'Über Budget — zusätzliche harte Einheiten erhöhen das Risiko.':b.pct>90?'Budget gut ausgenutzt — weitere harte Einheit nur bei guter Tagesform.':'Spielraum für eine Qualitätseinheit vorhanden.')+'</p>';
}
/* ---- Zyklus-Modul (weibliche Nutzer, optional, unterstützend) ---- */
function cyclePhase(){
  if(!(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.sex==='f'&&PROFILE.cycle&&PROFILE.cycle.lastStart))return null;
  var len=PROFILE.cycle.length||28;var start=new Date(PROFILE.cycle.lastStart+'T12:00');
  var dn=Math.floor((Date.now()-start)/864e5)%len;if(dn<0)dn+=len;
  var phase=dn<5?'Menstruation':dn<13?'Follikelphase':dn<16?'Ovulation':'Lutealphase';
  var hint=dn<5?'Energie evtl. niedriger — auf das Gefühl hören, Intensität optional reduzieren.':dn<13?'Oft gute Phase für Intensität & Kraft.':dn<16?'Leistungsfähig — gute Tage für harte Einheiten.':'Vor der Periode evtl. mehr Müdigkeit — Schlaf & Erholung priorisieren.';
  return {day:dn+1,phase:phase,hint:hint};
}
function renderCycle(){
  var el=document.getElementById('cycleBox');if(!el)return;var card=el.parentElement;
  if(!(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.sex==='f')){if(card)card.style.display='none';return;}
  if(card)card.style.display='';
  var p=cyclePhase();
  if(!p){el.innerHTML='<p class="muted" style="margin:0 0 10px">Optional: Zyklus in den Empfehlungen berücksichtigen — keine medizinische Diagnose, nur unterstützende Hinweise aus deinen Check-in-Daten.</p><button class="btn sec" onclick="openCycleEditor()">Zyklus einrichten</button>';return;}
  el.innerHTML='<div class="cyc"><b>Tag '+p.day+' · '+esc(p.phase)+'</b><p>'+esc(p.hint)+'</p></div><button class="btn sec" style="margin-top:10px" onclick="openCycleEditor()">Anpassen</button>';
}
function openCycleEditor(){
  var cy=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.cycle)||{};
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Zyklus einrichten</h3>'+
    '<div class="gm-field"><label>Erster Tag der letzten Periode</label><input type="date" id="cyc_start" value="'+(cy.lastStart||'')+'"></div>'+
    '<div class="gm-field"><label>Durchschnittliche Zykluslänge (Tage)</label><input type="number" inputmode="numeric" id="cyc_len" value="'+(cy.length||28)+'"></div>'+
    '<p class="note" style="text-align:left">Nur unterstützende Hinweise — keine medizinische Beratung. Bei Beschwerden ärztlich abklären lassen.</p>'+
    '<button class="btn" onclick="saveCycle()">Speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeCycle()">Abbrechen</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="clearCycle()">Deaktivieren</button></div>';
  document.body.appendChild(wrap);window._cycEd=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closeCycle();});
}
function closeCycle(){if(window._cycEd){try{window._cycEd.remove();}catch(e){}window._cycEd=null;}}
function saveCycle(){
  if(typeof PROFILE!=='undefined'&&PROFILE){
    var s=(document.getElementById('cyc_start')||{}).value;var l=parseInt((document.getElementById('cyc_len')||{}).value,10);
    if(!s){if(typeof toast==='function')toast('Datum fehlt');return;}
    PROFILE.cycle={lastStart:s,length:(isNaN(l)||l<20||l>40)?28:l};
    if(typeof saveProfile==='function')saveProfile();
  }
  closeCycle();renderCycle();if(typeof toast==='function')toast('Zyklus gespeichert ✓');
}
function clearCycle(){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.cycle=null;if(typeof saveProfile==='function')saveProfile();}closeCycle();renderCycle();if(typeof toast==='function')toast('Zyklus-Modul deaktiviert');}
