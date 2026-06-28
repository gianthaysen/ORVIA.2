/* ============================================================
   ORVIA — Intelligence Layer  (Phase 4)
   Tip-Engine, persönliche Baselines, Recovery Debt, Risk,
   Confidence. Additive Schicht über calc.js / recoveryCtx.
   Interpretiert Daten -> erklärt -> empfiehlt konkrete Schritte.
   ============================================================ */
function dataDays(){try{return Object.keys(DB).filter(isDay).length;}catch(e){return 0;}}
function confidenceLevel(){
  var n=dataDays();var ctx=(typeof recoveryCtx==='function')?recoveryCtx(cur):{};
  if(n>=21&&ctx&&ctx.hrvN>=14)return{l:'hoch',c:'g'};
  if(n>=8)return{l:'mittel',c:'y'};
  return{l:'niedrig',c:'r'};
}
function confChip(level){return '<span class="conf conf-'+level.c+'">Confidence: '+level.l+'</span>';}

/* ---- Werte des gewählten Tages + Kontext ---- */
function intelCtx(){
  var e=DB[cur]||{},m=e.morning||{},ev=e.eve||{};
  var ctx=(typeof recoveryCtx==='function')?recoveryCtx(cur):{};
  var sleepH=m.sleepMin!=null?m.sleepMin/60:null;
  var rhrDev=(ctx.rhrBase!=null&&m.rhr!=null)?m.rhr-ctx.rhrBase:null;
  var hrv7=ctx.hrvBase7,hrvToday=m.hrvMs!=null?Math.log(m.hrvMs):null;
  var hrvDevPct=(hrv7&&hrvToday)?((Math.exp(hrvToday)-Math.exp(hrv7))/Math.exp(hrv7))*100:null;
  var wk=(typeof weekRunKm==='function')?weekRunKm(0):0;
  var target=(typeof Calc!=='undefined'&&typeof daysTo==='function')?Calc.weekKmTarget(daysTo(RACE.date),0):0;
  var issueMax=0,issueLabels=[];
  if(typeof activeModuleKeys==='function'){activeModuleKeys().forEach(function(k){var v=issueScore(k,cur);if(v!=null&&v>issueMax)issueMax=v;if(v!=null&&v>=3)issueLabels.push((ORVIA_MODULES[k]||{}).label||k);});}
  var ready=(typeof readinessOf==='function')?readinessOf(cur):null;
  return{m:m,ev:ev,ctx:ctx,sleepH:sleepH,rhrDev:rhrDev,hrvDevPct:hrvDevPct,
    weekKm:wk,targetKm:target,issueMax:issueMax,issueLabels:issueLabels,ready:ready,
    energy:ev.energy!=null?ev.energy:null,sleepDebt:ctx.sleepDebtH};
}

/* ============ BASELINES ============ */
function baselineRows(){
  var ctx=intelCtx(),c=ctx.ctx,rows=[];
  if(dataDays()<4)return null;
  if(c.rhrBase!=null&&ctx.m.rhr!=null){var d=ctx.m.rhr-c.rhrBase;
    rows.push(['Ruhepuls',(d>=0?'+':'')+d.toFixed(0)+' bpm vs. 28T ('+Math.round(c.rhrBase)+')',d>=5?'r':d>=3?'y':'g']);}
  else if(c.rhrBase!=null)rows.push(['Ruhepuls','Baseline '+Math.round(c.rhrBase)+' bpm','grey']);
  if(ctx.hrvDevPct!=null)rows.push(['HRV',(ctx.hrvDevPct>=0?'+':'')+ctx.hrvDevPct.toFixed(0)+'% vs. 7T-Schnitt',ctx.hrvDevPct<=-8?'r':ctx.hrvDevPct<0?'y':'g']);
  else rows.push(['HRV',c.hrvN+'/14 Werte für stabile Baseline','grey']);
  if(ctx.sleepDebt!=null)rows.push(['Schlaf-Konto (7T)',(ctx.sleepDebt>0?'−':'+')+Math.abs(ctx.sleepDebt).toFixed(1)+' h',ctx.sleepDebt>=4?'r':ctx.sleepDebt>=2?'y':'g']);
  rows.push(['Wochen-km',ctx.weekKm.toFixed(0)+(ctx.targetKm?' / '+ctx.targetKm+' Soll':''),ctx.targetKm&&ctx.weekKm>ctx.targetKm*1.1?'y':'g']);
  return rows;
}
function renderBaselines(){
  var el=document.getElementById('baselinesBox');if(!el)return;
  var rows=baselineRows();
  if(!rows){el.innerHTML='<p class="muted">Noch keine stabile Baseline. Sammle mindestens 7 Tage Daten.</p>';return;}
  el.innerHTML=rows.map(function(r){return '<div class="blrow"><span class="blk">'+escH(r[0])+'</span>'+
    '<span class="blv" style="color:'+statusColorVar(r[2])+'">'+escH(r[1])+'</span></div>';}).join('');
}

/* ============ RECOVERY DEBT ============ */
function recoveryDebt(){
  var ctx=intelCtx(),score=0,why=[];
  if(ctx.sleepDebt!=null&&ctx.sleepDebt>0){var s=Math.min(35,ctx.sleepDebt*7);score+=s;if(ctx.sleepDebt>=2)why.push('Schlaf-Konto −'+ctx.sleepDebt.toFixed(1)+' h');}
  if(ctx.hrvDevPct!=null&&ctx.hrvDevPct<0){var h=Math.min(30,-ctx.hrvDevPct*2);score+=h;if(ctx.hrvDevPct<=-5)why.push('HRV '+ctx.hrvDevPct.toFixed(0)+'% unter Schnitt');}
  if(ctx.rhrDev!=null&&ctx.rhrDev>0){var r=Math.min(20,ctx.rhrDev*4);score+=r;if(ctx.rhrDev>=3)why.push('Ruhepuls +'+ctx.rhrDev.toFixed(0)+' bpm');}
  if(ctx.targetKm&&ctx.weekKm>ctx.targetKm){score+=Math.min(15,(ctx.weekKm-ctx.targetKm));why.push('Wochenvolumen über Soll');}
  if(ctx.issueMax>=3){score+=10;why.push('aktive Beschwerde '+ctx.issueMax+'/10');}
  score=Math.round(Math.min(100,score));
  var st=score>=70?{l:'kritisch',c:'r'}:score>=45?{l:'erhöht',c:'r'}:score>=22?{l:'moderat',c:'y'}:{l:'niedrig',c:'g'};
  var rec=score>=45?'Keine zusätzliche Intensität — Erholung priorisieren.':score>=22?'Belastung halten, keine zweite harte Einheit.':'Normale Steuerung möglich.';
  return{score:score,state:st,why:why,rec:rec};
}
function renderRecoveryDebt(){
  var el=document.getElementById('recoveryDebtBox');if(!el)return;
  if(dataDays()<4){el.innerHTML='<p class="muted">Regenerationsdefizit ab ~7 Tagen Daten verfügbar.</p>';return;}
  var d=recoveryDebt();
  el.innerHTML='<div class="bigstat"><span class="bignum" style="color:'+statusColorVar(d.state.c)+'">'+d.state.l+'</span>'+
    '<span class="bigbar"><i style="width:'+d.score+'%;background:'+statusColorVar(d.state.c)+'"></i></span></div>'+
    (d.why.length?'<p class="modtext">Grund: '+escH(d.why.join(', '))+'.</p>':'')+
    '<p class="modtext"><b>Empfehlung:</b> '+escH(d.rec)+'</p>';
}

/* ============ RISK ============ */
function riskCard(){
  var ctx=intelCtx(),score=0,why=[];
  if(ctx.issueMax>=5){score+=40;why.push('Beschwerde '+ctx.issueMax+'/10');}else if(ctx.issueMax>=3){score+=22;why.push('Beschwerde erhöht');}else if(ctx.issueMax>=1){score+=8;}
  if(ctx.sleepDebt!=null&&ctx.sleepDebt>=4){score+=18;why.push('Schlafdefizit');}else if(ctx.sleepDebt>=2){score+=8;}
  if(ctx.hrvDevPct!=null&&ctx.hrvDevPct<=-8){score+=18;why.push('HRV deutlich unter Schnitt');}else if(ctx.hrvDevPct<=-3){score+=8;}
  if(ctx.rhrDev!=null&&ctx.rhrDev>=5){score+=14;why.push('Ruhepuls erhöht');}
  if(ctx.targetKm&&ctx.weekKm>ctx.targetKm*1.1){score+=10;why.push('Wochenvolumen steigt');}
  score=Math.round(Math.min(100,score));
  var st=score>=65?{l:'kritisch',c:'r'}:score>=40?{l:'hoch',c:'r'}:score>=20?{l:'moderat',c:'y'}:{l:'niedrig',c:'g'};
  var rec=score>=65?'Keine belastende Einheit. Bei Warnsignalen abklären lassen.':score>=40?'Keine Intensität — maximal Easy Z2 oder Alternative.':score>=20?'Easy möglich, Intensität nur nach gutem Warm-up.':'Training wie geplant vertretbar.';
  return{score:score,state:st,why:why,rec:rec};
}
function renderRisk(){
  var el=document.getElementById('riskBox');if(!el)return;
  if(dataDays()<4){el.innerHTML='<p class="muted">Risiko-Einschätzung ab ~7 Tagen Daten.</p>';return;}
  var d=riskCard();
  el.innerHTML='<div class="bigstat"><span class="bignum" style="color:'+statusColorVar(d.state.c)+'">'+d.state.l+'</span>'+
    '<span class="bigbar"><i style="width:'+d.score+'%;background:'+statusColorVar(d.state.c)+'"></i></span></div>'+
    (d.why.length?'<p class="modtext">Grund: '+escH(d.why.join(', '))+'.</p>':'')+
    '<p class="modtext"><b>Empfehlung:</b> '+escH(d.rec)+'</p>';
}

/* ============ TIP ENGINE ============ */
function tipEngine(){
  var c=intelCtx(),conf=confidenceLevel(),tips=[];
  function add(sev,title,reason,rec,confOverride){tips.push({sev:sev,title:title,reason:reason,rec:rec,conf:confOverride||conf.l});}
  var n=dataDays();
  if(n<7)add(2,'Datenbasis schwach','Zu wenige Check-ins für stabile Muster ('+n+' Tage).','Mindestens 7 Tage Daten sammeln.','niedrig');
  if(c.issueMax>=5)add(5,'Beschwerde über Grenzwert','Aktives Signal '+c.issueMax+'/10'+(c.issueLabels.length?' ('+c.issueLabels.join(', ')+')':'')+'.','Training stoppen, Alternative/Routine, bei Warnsignalen abklären.');
  else if(c.issueMax>=3)add(4,'Belastung anpassen','Beschwerdesignal '+c.issueMax+'/10 über Grenzwert.','Alternative Einheit oder Routine wählen, keine Intensität.');
  if(c.sleepH!=null&&c.sleepH<6&&c.hrvDevPct!=null&&c.hrvDevPct<0)add(4,'Heute keine Intensität','Schlaf '+c.sleepH.toFixed(1)+' h und HRV unter Normalbereich.','Zone 2, Mobility oder Pause.');
  if(c.rhrDev!=null&&c.rhrDev>=5)add(4,'Ruhepuls erhöht','+'+c.rhrDev.toFixed(0)+' bpm über 28T-Baseline.','Intensität raus; auf Infekt/Übertraining achten.');
  if(c.targetKm&&c.weekKm>c.targetKm&&c.hrvDevPct!=null&&c.hrvDevPct<0)add(3,'Belastung > Erholung','Wochenvolumen über Soll, HRV-Trend negativ.','Morgen Volumen reduzieren.');
  if(c.energy!=null&&c.energy<=4)add(3,'Niedrige Belastbarkeit','Energie '+c.energy+'/10.','Nur niedrigintensiv oder Regeneration; 10-Minuten-Startregel.');
  if(c.ready!=null&&c.ready>80&&c.issueMax<=1&&(c.m.sleepQ!=null&&c.m.sleepQ>=7))add(1,'Guter Tag für Qualität','Readiness '+c.ready+'%, Beschwerde niedrig, Schlafqualität gut.','Geplante Einheit möglich.');
  // Long-Run-Vorbereitung: heute Abend & morgen Sonntag (Plan-Long-Run)
  var hr=new Date().getHours();var tmr=new Date(cur+'T12:00');tmr.setDate(tmr.getDate()+1);
  if(hr>=18&&tmr.getDay()===0)add(2,'Long Run vorbereiten','Morgen ist eine längere Einheit geplant.','Kohlenhydrate, Flüssigkeit und Schlaf priorisieren.');
  tips.sort(function(a,b){return b.sev-a.sev;});
  return tips;
}
function renderTipEngine(){
  var el=document.getElementById('insights');if(!el)return;
  var tips=tipEngine();
  if(!tips.length){el.innerHTML='';return;}
  var top=tips.slice(0,3);
  var rows=top.map(function(t){return '<div class="tip">'+
    '<div class="tiphead"><span class="tiptitle">'+escH(t.title)+'</span><span class="conf conf-'+(t.conf==='hoch'?'g':t.conf==='mittel'?'y':'r')+'">'+escH(t.conf)+'</span></div>'+
    '<div class="tipreason">'+escH(t.reason)+'</div>'+
    '<div class="tiprec">'+escH(t.rec)+'</div></div>';}).join('');
  el.innerHTML='<div class="card"><h2><svg class="ic"><use href="#i-zap"/></svg>ORVIA Insights</h2>'+rows+'</div>';
}

/* ============ Sammelaufruf Analytics ============ */
function renderIntel(){renderBaselines();renderRecoveryDebt();renderRisk();}
