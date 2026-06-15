/* ============================================================
   CALC LAYER — reine, testbare Berechnungen (kein DOM, kein DB-Zugriff)
   Alle Formeln kommentiert. Über window.Calc UND module.exports (Tests).
   ============================================================ */
(function(root){
const HM_KM=21.0975, HR_MAX=201, RHR_FALLBACK=58, RACE_DATE='2026-09-06', TARGET_MIN_DEFAULT=110;
function _hrMax(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)||HR_MAX;}
function _rhrBase(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.rhrBaseline)||RHR_FALLBACK;}

/* ---- Basis ---- */
function avg(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
function median(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v)).sort((p,q)=>p-q);if(!x.length)return null;const m=x.length>>1;return x.length%2?x[m]:(x[m-1]+x[m])/2;}
function sd(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));if(x.length<2)return null;const m=avg(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)*(v-m),0)/(x.length-1));}
function clampC(x,a,b){return Math.max(a,Math.min(b,x));}
function fmtPace(sec){return Math.floor(sec/60)+':'+String(Math.round(sec%60)).padStart(2,'0');}
function fmtTime(min){const h=Math.floor(min/60),m=Math.round(min%60);return h+':'+String(m).padStart(2,'0')+'h';}

/* ---- EWMA, geseedet (Fix: kein Kaltstart bei 0 mehr) ----
   Seed = Ø der ersten min(7,n) Werte, damit CTL nicht systematisch zu niedrig startet. */
function ewma(arr,tau){
  if(!arr.length)return[];
  const seedN=Math.min(7,arr.length);
  let prev=avg(arr.slice(0,seedN))||0;
  const out=[];for(const x of arr){prev=prev+((x||0)-prev)/tau;out.push(prev);}return out;
}

/* ---- sRPE-Last einer Tages-Entry (Dauer × RPE; Mobilität fix RPE 2) ---- */
function sessionLoad(e){
  if(!e||!e.sessions)return 0;let L=0;
  for(const t of Object.keys(e.sessions)){
    if(t==='_ts')continue;const s=e.sessions[t];
    const dur=s.dur||0;const rpe=t==='Mobilität'?2:(s.rpe||5); // Fix: perf ist kein Anstrengungsmaß
    L+=dur*rpe;
  }return L;
}

/* ---- ACWR, EWMA-basiert & entkoppelt interpretierbar (Williams 2017) ----
   loads: chronologisch. Erst ab 21 Tagen Historie aussagekräftig. */
function acwr(loads){
  const nz=loads.filter(x=>x>0).length;
  if(loads.length<21||nz<6)return{ratio:null,acute:null,chronic:null,enough:false};
  const a=ewma(loads,7),c=ewma(loads,28);
  const A=a[a.length-1],C=c[c.length-1];
  return{ratio:C>10?+(A/C).toFixed(2):null,acute:Math.round(A*7),chronic:Math.round(C*7),enough:C>10};
}

/* ---- Wochen-km-Rampe (Fix: Vorzeichen; neu: Entlastungswochen) ----
   weeksAhead: 0=diese Woche, 1=nächste, ... Deload alle 4 Planwochen (-28%). */
function weekKmTarget(daysToRace,weeksAhead){
  const d=daysToRace-(weeksAhead||0)*7;
  if(d<0)return 0;
  const w=Math.ceil(Math.max(d,1)/7); // Wochen bis Race
  let base;
  if(w>=12)base=22;else if(w>=10)base=26;else if(w>=8)base=30;else if(w>=6)base=34;
  else if(w>=4)base=37;else if(w===3)base=40;else if(w===2)base=32;else base=22;
  const planWeek=25-w;                       // Runna-Woche
  if(w>3&&planWeek>0&&planWeek%4===0)base=Math.round(base*0.72); // Entlastungswoche
  return base;
}
/* Ist-Kopplung: Kalenderziel nie >10% über dem Maximum der letzten 3 Ist-Wochen */
function effectiveKmTarget(calTarget,last3WeeksKm){
  const mx=Math.max(...last3WeeksKm,0);
  if(mx<=0)return Math.min(calTarget,12); // Wiedereinstieg
  return Math.min(calTarget,Math.round(1.10*mx));
}
function runnaWeek(daysToRace){ // Fix Off-by-one: Rennwoche = 25
  const w=25-Math.ceil(Math.max(daysToRace,0)/7);
  return clampC(daysToRace<=6?25:w,1,25);
}
function racePhase(d){
  if(d<0)return'Nach dem Rennen';if(d===0)return'RACE DAY!';
  if(d<=13)return'Taper — Frische aufbauen';if(d<=34)return'Peak-Phase — höchste Last';return'Aufbau-Phase';
}

/* ---- Trend ohne Überlappung (Fix) ---- */
function trendDir(a){
  if(a.length<4)return'';
  const half=Math.floor(a.length/2);
  const h=avg(a.slice(0,half)),t=avg(a.slice(-half));
  if(t==null||h==null)return'';
  if(t<h-0.3)return'besser';if(t>h+0.3)return'schlechter';return'stabil';
}

/* ============ RECOVERY ENGINE V2 ============
   readiness(m, ctx) — ctx liefert Baselines:
   { hrvBase7, hrvSd28, hrvN, rhrBase, sleepDebtH, hrvLowStreak }
   Fehlende Komponenten werden NICHT mit Defaults gefüllt, sondern aus der
   Gewichtung entfernt und renormalisiert (ehrlicher Score). */
function hrvScoreOf(m,ctx){
  if(m.hrvMs&&ctx&&ctx.hrvN>=14&&ctx.hrvBase7!=null&&ctx.hrvSd28!=null&&ctx.hrvSd28>0){
    const ln=Math.log(m.hrvMs),swc=0.5*ctx.hrvSd28; // smallest worthwhile change
    if(ln>=ctx.hrvBase7-swc)return 100;
    if(ln>=ctx.hrvBase7-2*swc)return 60;
    return 25;
  }
  if(m.hrv)return m.hrv==='Good'?100:m.hrv==='Balanced'?60:m.hrv==='Low'?25:null;
  return null;
}
function readiness(m,ctx){
  ctx=ctx||{};
  const comps=[];
  const add=(name,score,w)=>{if(score!=null&&!isNaN(score))comps.push([name,clampC(score,0,100),w]);};
  add('Knie',m.knee!=null?(10-m.knee)/10*100:null,25);
  const hrvS=hrvScoreOf(m,ctx);add('HRV',hrvS,20);
  if(ctx.sleepDebtH!=null)add('Schlaf-Konto',100-ctx.sleepDebtH*12,12);
  else if(m.sleepMin!=null)add('Schlafdauer',clampC((m.sleepMin-300)/180,0,1)*100,12);
  if(m.sleepQ!=null)add('Schlafqualität',m.sleepQ*10,8);
  let rhrDev=null;
  if(m.rhr!=null){rhrDev=m.rhr-(ctx.rhrBase??_rhrBase());add('Ruhepuls',100-rhrDev*12,15);}
  if(m.doms!=null)add('DOMS',(10-m.doms)*10,10);
  if(m.bb!=null)add('Body Battery',m.bb,10); // herabgestuft: Garmin-Komposit, sonst Doppelzählung
  const W=comps.reduce((s,c)=>s+c[2],0)||1;
  let score=Math.round(comps.reduce((s,c)=>s+c[1]*c[2],0)/W);
  // Harter Schmerz-Cap: akuter Knie-Schmerz darf nie im grünen Band landen,
  // egal wie gut der Rest aussieht (verletzungsdominante Logik).
  if((m.knee??0)>=6)score=Math.min(score,40);
  else if((m.knee??0)>=4)score=Math.min(score,65);
  const band=score>=75?'g':score>=45?'y':'r';
  const color=band==='g'?'#34d399':band==='y'?'#fbbf24':'#fb4d6d';
  const lim=comps.slice().sort((a,b)=>a[1]-b[1]).slice(0,2).filter(p=>p[1]<70).map(p=>p[0]);
  return{score,band,color,lim,hrvScore:hrvS,rhrDev,parts:comps};
}

/* ---- Ampel v2: nach limitierendem Faktor differenziert ---- */
function ampel(m,r,ctx){
  ctx=ctx||{};
  const autonomBad=(r.hrvScore!=null&&r.hrvScore<=25)||(r.rhrDev!=null&&r.rhrDev>=5);
  const hrvDouble=(r.hrvScore!=null&&r.hrvScore<=25)&&((r.rhrDev!=null&&r.rhrDev>=4)||(ctx.hrvLowStreak||0)>=2);
  if((m.knee??0)>=6||r.score<45||(m.feel!=null&&m.feel<=4)||hrvDouble){
    const w=[];
    if((m.knee??0)>=6)w.push('Knie ≥6/10 — akute Reizung');
    if(m.feel!=null&&m.feel<=4)w.push('Befinden ≤4/10');
    if(r.score<45)w.push('Readiness '+r.score+'% — Erholung fehlt');
    if(hrvDouble)w.push('HRV gedrückt + zweiter Marker (RHR/2. Tag)');
    return{c:'r',t:'ROT — Regenerieren',why:w,
      rec:'Kein strukturiertes Training. Max. 20 min lockere Mobilität. Fokus: Schlaf, Protein, Hydration.'};
  }
  if(r.score>=75&&(m.knee??0)<=2&&!autonomBad){
    return{c:'g',t:'GRÜN — Trainieren',why:['Readiness '+r.score+'%','Knie ≤2/10','Autonomes System im Korridor'],
      rec:'Plan durchziehen — auch Quality. Nach dem Lauf Knie POST checken; bei Reaktion nächste Einheit lockerer.'};
  }
  // GELB: Empfehlung hängt am Limitfaktor
  const why=[];let rec;
  if((m.knee??0)>=3){why.push('Knie '+m.knee+'/10 — Vorsicht');
    rec='Kein Laufen, kein Beintraining mit Last. Oberkörper, Schwimmen Technik oder Rad Z1–Z2 sind frei.';}
  else if(autonomBad||r.hrvScore===60||(r.rhrDev!=null&&r.rhrDev>=3)){why.push('Autonomes System gedrückt (HRV/RHR)');
    rec='Easy-Lauf bis 40 min Z2 erlaubt — KEINE Intensität. Quality auf morgen schieben, nicht streichen.';}
  else{why.push('Readiness '+r.score+'% — Werte gemischt');
    rec='Volumen reduzieren: geplante Einheit eine Stufe leichter (kürzer oder langsamer), keine neuen Reize.';}
  return{c:'y',t:'GELB — Reduzieren',why,rec};
}

/* ============ GOAL ENGINE — HM <Ziel, ehrlich ============
   runs42: chronologisch, letzte 42 Tage [{date,sub,dist,dur,hr}]
   opts: {daysToRace, targetMin, avg4WeekKm, targetWeekKm, lrMax28, ctlNow, ctlPrev28, trackingWeeks} */
function riegelHM(distKm,durMin){return durMin*Math.pow(HM_KM/distKm,1.06);}
function goalEngine(runs42,opts){
  const o=opts||{};const target=o.targetMin||TARGET_MIN_DEFAULT;
  const valid=runs42.filter(r=>r.dist>0&&r.dur>0);
  const quality=valid.filter(r=>['Tempo','Long Run','Intervalle'].includes(r.sub)&&r.dist>=4);
  const tempo=quality.filter(r=>r.sub==='Tempo');
  const bestTempoPace=tempo.length?Math.min(...tempo.map(r=>r.dur/r.dist)):null;
  const usable=quality.filter(r=>r.sub!=='Intervalle'||(r.dist>=6&&bestTempoPace&&(r.dur/r.dist)<1.05*bestTempoPace));
  // Mindestdaten-Gate
  if(valid.length<6||usable.length<2||(o.trackingWeeks||0)<3){
    return{state:'nodata',need:'≥6 Läufe in 42 Tagen, davon ≥2 Quality (Tempo/Long ≥4 km), ≥3 Wochen Tracking',
      nRuns:valid.length,nQuality:usable.length};
  }
  // Schätzer A: Riegel aus bester Quality-Einheit
  const tRiegel=Math.min(...usable.map(r=>riegelHM(r.dist,r.dur)));
  // Schätzer B: EF-Korridor aus Easy-Z2 (HF 65–78% HFmax), +5% Sicherheitsaufschlag
  const easy=valid.filter(r=>r.sub==='Easy Z2'&&r.hr>=Math.round(0.65*_hrMax())&&r.hr<=Math.round(0.78*_hrMax())&&r.dist>=4);
  let tEF=null;
  if(easy.length>=3){
    const efs=easy.slice(-7).map(r=>(r.dist*1000/r.dur)/r.hr);
    const efm=median(efs);
    if(efm){const vRace=efm*Math.round(0.88*_hrMax());tEF=(HM_KM*1000/vRace)*1.05;}
  }
  const tPred=tEF?0.7*tRiegel+0.3*Math.max(tRiegel,tEF):tRiegel;
  // Vetos (Volumen-Gates)
  const vetos=[];
  const d=o.daysToRace??99;
  const lrNeed=d>28?14:d>14?17:0;
  if(lrNeed&&(o.lrMax28||0)<lrNeed)vetos.push('Long Run: max. '+(o.lrMax28||0).toFixed(0)+' km in 28T, nötig ≥'+lrNeed+' km');
  if(o.targetWeekKm&&(o.avg4WeekKm||0)<0.75*o.targetWeekKm)vetos.push('Volumen: Ø '+(o.avg4WeekKm||0).toFixed(0)+' km/Wo unter 75% des Solls');
  if(o.ctlNow!=null&&o.ctlPrev28!=null&&o.ctlNow<=o.ctlPrev28)vetos.push('Fitness (CTL) seit 4 Wochen nicht steigend');
  // Bänder
  const delta=(target-tPred)/target;
  let state='ontrack';
  if(delta<-0.03||vetos.length>=2)state='risk';
  else if(delta<0.02||vetos.length===1)state='border';
  return{state,tPred:+tPred.toFixed(1),tRiegel:+tRiegel.toFixed(1),tEF:tEF?+tEF.toFixed(1):null,
    delta:+(delta*100).toFixed(1),vetos,nRuns:valid.length,nQuality:usable.length,target};
}

/* ============ RUNNING ANALYTICS ============ */
/* 80/20: Easy-Anteil an der Laufzeit, 28T */
function easyShare(runs28){
  const t=runs28.filter(r=>r.dur>0);
  const tot=t.reduce((s,r)=>s+r.dur,0);if(!tot||t.length<6)return null;
  const easy=t.filter(r=>['Walk-Run','Easy Z2','Long Run'].includes(r.sub)).reduce((s,r)=>s+r.dur,0);
  return easy/tot;
}
/* Wochensprung: diese Woche vs. letzte */
function weeklyJump(kmThis,kmLast){
  const ratio=kmThis/Math.max(kmLast,5);
  if(ratio>1.25)return{lvl:'r',ratio,msg:'Umfangssprung +'+Math.round((ratio-1)*100)+'% — bekanntes Patella-Rezidiv-Muster. Sofort deckeln.'};
  if(ratio>1.10)return{lvl:'y',ratio,msg:'Umfang +'+Math.round((ratio-1)*100)+'% vs. Vorwoche — über der 10%-Regel.'};
  return{lvl:'g',ratio,msg:null};
}
/* Long-Run-Soll nach Wochen bis Race */
function lrTarget(weeksToRace){
  if(weeksToRace>=10)return[12,14];if(weeksToRace>=6)return[14,16];
  if(weeksToRace>=3)return[16,19];return[8,12];
}
/* HF-Spread-Proxy (echte Drift bräuchte Splits) */
function hrSpread(run){
  if(!run||!run.hr||!run.hrmax)return null;
  return (run.hrmax-run.hr)/run.hr;
}
/* Easy-zu-hart-Check pro Einheit */
function easyTooHard(run){
  return run&&run.sub==='Easy Z2'&&run.hr&&run.hr>Math.round(0.78*_hrMax());
}
/* EF nur aus Easy-Z2 (Fix: vorher alle Lauftypen gemischt → Rauschen) */
function efSeries(runsAll){
  return runsAll
    .filter(r=>r.sub==='Easy Z2'&&r.dist>=3&&r.dur>0&&r.hr>=Math.round(0.65*_hrMax())&&r.hr<=Math.round(0.78*_hrMax()))
    .map(r=>({date:r.date,ef:+(((r.dist*1000/r.dur))/r.hr).toFixed(2)}));
}
/* "Nächster Lauf" — Regelkette, erste zutreffende gewinnt */
function nextRunRec(p){
  // p={ampelC, lastRun:{sub,knee,daysAgo,morningKnee}, planToday:'Intervalle'|'Z2'|'Long'|null, readiness, heavyLegsYesterday, heavyLegs2d, doms, legs}
  if(p.ampelC==='r')return{run:false,txt:'Heute kein Lauf — Ampel rot. Recovery oder Alternativtraining.'};
  if(p.lastRun&&p.lastRun.knee!=null&&p.lastRun.morningKnee!=null&&p.lastRun.knee-p.lastRun.morningKnee>=2)
    return{run:true,txt:'Knie hat auf den letzten Lauf reagiert (+'+(p.lastRun.knee-p.lastRun.morningKnee)+'): nur Easy, −20% Distanz, kein Quality.'};
  const quality=p.planToday&&/Intervalle|Tempo|Long/.test(p.planToday);
  if(quality&&p.lastRun&&/Intervalle|Tempo|Long/.test(p.lastRun.sub||'')&&p.lastRun.daysAgo<2)
    return{run:true,txt:'Letzter Quality-Lauf <48h her — heute nur Easy, Quality morgen.'};
  if(quality&&p.heavyLegsYesterday)
    return{run:true,txt:'Gestern schweres Beintraining — Quality auf Easy gleicher Dauer downgraden.'};
  if(quality&&p.heavyLegs2d&&((p.doms??0)>3||(p.legs??10)<6))
    return{run:true,txt:'Beine noch nicht erholt (DOMS/Kraft) — Quality nur, wenn es sich im Warm-up gut anfühlt, sonst Easy.'};
  if(quality&&p.readiness>=75)return{run:true,txt:p.planToday+' nach Plan — Readiness gibt grünes Licht.'};
  if(quality&&p.readiness>=50)return{run:true,txt:'Readiness '+p.readiness+'%: '+p.planToday+' auf Easy gleicher Dauer downgraden. Verschieben, nicht streichen.'};
  if(p.planToday)return{run:true,txt:p.planToday+' nach Plan.'};
  return{run:true,txt:'Kein Lauf geplant — optional Easy Z2, wenn Knie ≤2 und Lust da.'};
}

/* ---- Gym-Bein-Interferenz ---- */
function heavyLegs(gymSession){
  if(!gymSession||!Array.isArray(gymSession.sub))return false;
  if(!gymSession.sub.includes('Beine'))return false; // Glute/VMO-Reha zählt bewusst nicht
  return (gymSession.rpe??5)>=7||(gymSession.sets??0)>=15;
}

/* ---- Schlafschuld 7T (h) ---- */
function sleepDebt(sleepMins7){
  return sleepMins7.filter(x=>x!=null).reduce((s,x)=>s+Math.max(0,480-x),0)/60;
}

/* ---- Gewicht vs. Ziel (einfach, ehrlich — keine Kalorienbilanz) ---- */
function weightHint(w7Now,w7Prev){
  if(w7Now==null||w7Prev==null)return null;
  const d=w7Now-w7Prev;
  if(Math.abs(d)<0.4)return{lvl:'g',txt:'Gewicht stabil ('+(d>=0?'+':'')+d.toFixed(1)+' kg/4Wo) — passt zum Leistungsaufbau.'};
  if(d<=-0.4&&d>=-1.5)return{lvl:'g',txt:'Leicht fallend ('+d.toFixed(1)+' kg/4Wo) — ok, Protein-Ziel weiter halten.'};
  if(d<-1.5)return{lvl:'y',txt:d.toFixed(1)+' kg in 4 Wochen — zu schnell. Energieverfügbarkeit prüfen, Leistungsverlust droht.'};
  return{lvl:'y',txt:'+'+d.toFixed(1)+' kg/4Wo — beobachten; bei HM zählt Watt pro Kilo nicht, aber Pace pro Kilo schon.'};
}

/* ---- Pace-Zonen aus Zielzeit + Distanz (Riegel-Modell, sec/km) ---- */
function paceZones(distanceKm,targetMin){
  if(!distanceKm||!targetMin)return null;
  const rt=function(d){return targetMin*Math.pow(d/distanceKm,1.06);};   // Renn-Zeit (min) für Distanz d
  const pp=function(d){return rt(d)*60/d;};                              // Renn-Pace sec/km
  const p3=pp(3),p5=pp(5),p10=pp(10),pHM=pp(21.0975),pM=pp(42.195),pMile=pp(1.609);
  const tgt=targetMin*60/distanceKm;
  const Z=[
    ['Zielpace',tgt,tgt],
    ['Recovery',pM+70,pM+108],
    ['Easy',pM+46,pM+78],
    ['Long Run',pM+36,pM+68],
    ['Marathon',pM-6,pM+10],
    ['Halbmarathon',pHM-6,pHM+8],
    ['Tempo / Schwelle',p10,pHM],
    ['10 km',p10-5,p10+7],
    ['5 km',p5-5,p5+6],
    ['Intervall (VO2)',p3,p5],
    ['Strides',pMile-14,pMile+4]
  ];
  return Z.map(function(z){return {k:z[0],lo:Math.round(Math.min(z[1],z[2])),hi:Math.round(Math.max(z[1],z[2]))};});
}
/* ---- Energie/Ernährung (Mifflin-St Jeor + trainingsabhängige Makros) ---- */
function bmr(sex,age,heightCm,weightKg){
  if(!weightKg||!heightCm)return null;
  var s=(sex==='f'||sex==='w')?-161:((sex==='m')?5:-78);
  return Math.round(10*weightKg+6.25*heightCm-5*(age||30)+s);
}
function nutritionTargets(p){
  // p: {sex,age,heightCm,weightKg, goal, activity, deficitKcal, surplusKcal, proteinPerKg, dayType, trainingBurn}
  var b=bmr(p.sex,p.age,p.heightCm,p.weightKg);if(!b||!p.weightKg)return null;
  var actF={sedentary:1.25,light:1.35,moderate:1.45,high:1.55}[p.activity||'light']||1.35;
  var base=Math.round(b*actF);                          // Grundbedarf ohne Training
  var burn=Math.max(0,Math.round(p.trainingBurn||0));
  var maint=base+burn;                                  // Erhaltung für den Tag
  var goal=p.goal||'maintain';
  var hard=(p.dayType==='long'||p.dayType==='quality');
  var adj=0;
  if(goal==='fatloss'){adj=-(p.deficitKcal||400);if(hard)adj=Math.max(adj,-200);}   // kein extremes Defizit an harten Tagen
  else if(goal==='muscle')adj=+(p.surplusKcal||250);
  var kcal=Math.max(Math.round(b*1.05),maint+adj);      // nie unter ~BMR*1.05
  var protein=Math.round(p.weightKg*(p.proteinPerKg||1.9));
  var fat=Math.round(p.weightKg*(hard?0.8:0.95));
  var carbs=Math.max(Math.round((kcal-protein*4-fat*9)/4),Math.round(p.weightKg*(hard?5:3)));
  var ea=Math.round((kcal-burn)/p.weightKg);            // grobe Energieverfügbarkeit kcal/kg
  return {kcal:kcal,protein:protein,carbs:carbs,fat:fat,base:base,burn:burn,maint:maint,ea:ea,bmr:b,hard:hard,goal:goal,dayType:p.dayType};
}
const Calc={HM_KM,HR_MAX,RHR_FALLBACK,RACE_DATE,avg,median,sd,clampC,fmtPace,fmtTime,paceZones,bmr,nutritionTargets,ewma,sessionLoad,acwr,
  weekKmTarget,effectiveKmTarget,runnaWeek,racePhase,trendDir,readiness,ampel,hrvScoreOf,riegelHM,goalEngine,
  easyShare,weeklyJump,lrTarget,hrSpread,easyTooHard,efSeries,nextRunRec,heavyLegs,sleepDebt,weightHint};
root.Calc=Calc;
if(typeof module!=='undefined'&&module.exports)module.exports=Calc;
})(typeof window!=='undefined'?window:globalThis);
