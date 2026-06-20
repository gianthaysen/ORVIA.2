/* ============================================================
   CALC LAYER — reine, testbare Berechnungen (kein DOM, kein DB-Zugriff)
   Alle Formeln kommentiert. Über window.Calc UND module.exports (Tests).
   ============================================================ */
(function(root){
const HM_KM=21.0975, RACE_DATE='2026-09-06', TARGET_MIN_DEFAULT=110;
// HFmax-Fallback populationsneutral (Tanaka 208−0,7·Alter), NICHT auf ein bestimmtes Profil hardcodiert.
function _hrMax(){
  if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)return PROFILE.hfMax;
  const age=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.age)||null;
  return age?Math.round(208-0.7*age):null; // KEIN globaler 190-Fallback — null = HFmax unbekannt
}
// Ruhepuls-Baseline NUR aus dem Profil des aktuellen Nutzers. Kein globaler Fremdwert:
// fehlt eine echte persönliche Baseline, wird Ruhepuls im Score NICHT bewertet (s. readiness()).
function _rhrBase(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.rhrBaseline)||null;}

/* ---- Basis ---- */
function avg(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}
function median(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v)).sort((p,q)=>p-q);if(!x.length)return null;const m=x.length>>1;return x.length%2?x[m]:(x[m-1]+x[m])/2;}
function sd(a){const x=(a||[]).filter(v=>v!=null&&!isNaN(v));if(x.length<2)return null;const m=avg(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)*(v-m),0)/(x.length-1));}
function clampC(x,a,b){return Math.max(a,Math.min(b,x));}
function fmtPace(sec){return Math.floor(sec/60)+':'+String(Math.round(sec%60)).padStart(2,'0');}
function fmtTime(min){const h=Math.floor(min/60),m=Math.round(min%60);return h+':'+String(m).padStart(2,'0')+'h';}
/* ---- Zentrale Dauer-Formatierung (eine Quelle der Wahrheit) ----
   value in Minuten (default) ODER Sekunden (unit='sec'). Float-sicher.
   <60 min → "36:07 min" · ≥60 min → "1:12:34 h". Keine Dezimalzahlen. */
function fmtDuration(value,unit){
  if(value==null||value===''||isNaN(value))return '–';
  var totalSec=(unit==='sec')?Math.round(+value):Math.round(+value*60);
  if(totalSec<0)totalSec=0;
  var h=Math.floor(totalSec/3600),m=Math.floor((totalSec%3600)/60),s=totalSec%60;
  return h>0
    ? h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+' h'
    : m+':'+String(s).padStart(2,'0')+' min';
}

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
  // Garmin-HRV-Status ist bereits persönlich-relativ (gegen die eigene 3-Wochen-Baseline).
  // 'Balanced' = innerhalb der individuellen Norm → hoch bewerten, nicht pauschal abstrafen.
  if(m.hrv)return m.hrv==='Good'?100:m.hrv==='Balanced'?88:(m.hrv==='Low'||m.hrv==='Unbalanced')?45:null;
  return null;
}
function readiness(m,ctx){
  ctx=ctx||{};
  const comps=[];
  const add=(name,score,w)=>{if(score!=null&&!isNaN(score))comps.push([name,clampC(score,0,100),w]);};
  add('Knie',m.knee!=null?(10-m.knee)/10*100:null,25);
  const hrvS=hrvScoreOf(m,ctx);add('HRV',hrvS,20);
  // Allgemeinbefinden — subjektiv stark gewichtet (war zuvor gar nicht enthalten).
  if(m.feel!=null)add('Befinden',m.feel*10,18);
  if(ctx.sleepDebtH!=null)add('Schlaf-Konto',100-ctx.sleepDebtH*12,12);
  else if(m.sleepMin!=null)add('Schlafdauer',clampC((m.sleepMin-300)/180,0,1)*100,12);
  if(m.sleepQ!=null)add('Schlafqualität',m.sleepQ*10,14); // stärker gewichtet
  if(m.stress)add('Stress',m.stress==='Low'?100:m.stress==='Med'?60:25,8);
  let rhrDev=null;
  // Ruhepuls NUR gegen die ECHTE persönliche Baseline des Nutzers bewerten (≥7 eigene Tage).
  // Ohne persönliche Baseline: kein Score-Beitrag (Cold-Start senkt Konfidenz, nicht den Score).
  // Nur erhöhter Ruhepuls zählt negativ; unter der Baseline ist neutral/gut.
  const rhrB=(ctx.rhrBase!=null)?ctx.rhrBase:null;
  if(m.rhr!=null&&rhrB!=null){rhrDev=m.rhr-rhrB;add('Ruhepuls',100-Math.max(rhrDev,0)*11,15);}
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
  // Schätzer B: EF-Korridor aus Easy-Z2 (HF 65–78% HFmax), +5% Sicherheitsaufschlag.
  // Nur wenn HFmax bekannt (gemessen oder altersbasiert) — sonst KEINE HF-basierte Schätzung.
  const hm=_hrMax();
  const easy=hm!=null?valid.filter(r=>r.sub==='Easy Z2'&&r.hr>=Math.round(0.65*hm)&&r.hr<=Math.round(0.78*hm)&&r.dist>=4):[];
  let tEF=null;
  if(hm!=null&&easy.length>=3){
    const efs=easy.slice(-7).map(r=>(r.dist*1000/r.dur)/r.hr);
    const efm=median(efs);
    if(efm){const vRace=efm*Math.round(0.88*hm);tEF=(HM_KM*1000/vRace)*1.05;}
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
  const hm=_hrMax(); if(hm==null)return false; // ohne HFmax keine HF-Bewertung (kein 190-Fallback)
  return run&&run.sub==='Easy Z2'&&run.hr&&run.hr>Math.round(0.78*hm);
}
/* EF nur aus Easy-Z2 (Fix: vorher alle Lauftypen gemischt → Rauschen) */
function efSeries(runsAll){
  const hm=_hrMax(); if(hm==null)return []; // ohne HFmax keine EF-Serie (kein 190-Fallback)
  return runsAll
    .filter(r=>r.sub==='Easy Z2'&&r.dist>=3&&r.dur>0&&r.hr>=Math.round(0.65*hm)&&r.hr<=Math.round(0.78*hm))
    .map(r=>({date:r.date,ef:+(((r.dist*1000/r.dur))/r.hr).toFixed(2)}));
}
/* "Nächster Lauf" — Regelkette, erste zutreffende gewinnt */
function nextRunRec(p){
  // p={ampelC, lastRun:{sub,knee,daysAgo,morningKnee}, planToday:'Intervalle'|'Z2'|'Long'|null, readiness, heavyLegsYesterday, heavyLegs2d, doms, legs}
  if(p.ampelC==='r')return{run:false,txt:'Heute kein Lauf — Ampel rot. Recovery oder Alternativtraining.'};
  // ORANGE: reduzieren/ersetzen — KEIN „kein Lauf", konsistent mit Badge „Anpassen/Ersetzen".
  if(p.ampelC==='o')return{run:true,txt:'Heute Belastung reduzieren — geplante Einheit kürzer oder leichter. Bei Knie-/Gelenkreizung stattdessen gelenkschonendes Alternativtraining.'};
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

/* ============ EMPFOHLENES WOCHEN-LAUFVOLUMEN (regelbasiert, ehrlich) ============
   calculateRecommendedWeeklyRunVolume(userProfile, trainingHistory, readinessData)
   - userProfile: {level, primaryGoal, trainingDays, gymDays, riskTolerance|riskPreference}
   - trainingHistory: [{dist, sub, date}] Läufe der letzten ~4 Wochen (dist in km)
   - readinessData: {knee|painScore, avgReady}
   Prinzipien (Spec §3/§5):
   - Median der typischen Distanz als stabile Basis, NICHT der einmalige Bestwert.
   - Anfänger konservativ: 1–2 Läufe, niedriger Startumfang, Long Run knapp über typisch.
   - Ohne Historie keine aggressiven Werte → konservativer Start, später nachjustieren.
   - Schmerz/Low-Readiness: Umfang reduzieren oder halten, Progression pausieren.
   - Anfänger-Long-Run ≈ 25–35 % des Wochenumfangs. */
function recentRunStats(history){
  var runs=(history||[]).filter(function(r){return r&&r.dist>0;});
  var dists=runs.map(function(r){return r.dist;});
  return {n:runs.length, typical:median(dists)||0, longest:dists.length?Math.max.apply(null,dists):0};
}
function calculateRecommendedWeeklyRunVolume(userProfile, trainingHistory, readinessData){
  var p=userProfile||{}, rd=readinessData||{};
  var level=p.level||'fortgeschritten';
  var beginner=(level==='anfaenger'||level==='wiedereinstieg');
  var elite=(level==='profi'||level==='leistung');
  var risk=p.riskTolerance||p.riskPreference||'balanced';
  var st=recentRunStats(trainingHistory);
  var knee=rd.painScore!=null?rd.painScore:(rd.knee!=null?rd.knee:0);
  var pain=knee>=3;
  var lowReady=(rd.avgReady!=null&&rd.avgReady<55);

  // geplante Laufeinheiten je Level (konservativ; extern weiter begrenzbar durch trainingDays)
  var runSessions=beginner?(st.n>=4?2:1):(elite?4:3);

  var typical=st.typical, hasHistory=(st.n>=3&&typical>0);
  var weeklyKm, longRunKm, conf, note;

  if(!hasHistory){
    if(beginner){weeklyKm=6;longRunKm=3;runSessions=2;}
    else if(elite){weeklyKm=25;longRunKm=8;}
    else {weeklyKm=12;longRunKm=5;}
    conf='niedrig';
    note='Keine belastbare Lauf-Historie — konservativer Start, Nachjustierung nach 2–4 Wochen.';
  }else{
    var base=typical*runSessions;
    if(beginner){weeklyKm=Math.min(base, typical*2+4); longRunKm=Math.min(typical*1.3, typical+3);}
    else if(elite){weeklyKm=base; longRunKm=Math.max(st.longest, typical*1.5);}
    else {weeklyKm=base; longRunKm=Math.min(st.longest*1.1, typical*1.6);}
    conf='mittel';
    note='Basis aus typischer Distanz (Median '+typical.toFixed(1)+' km) × '+runSessions+' Läufen.';
  }

  // Risiko-Präferenz moduliert leicht (nur außerhalb des Schmerz-Falls)
  var riskF=(risk==='konservativ'||risk==='conservative')?0.9:(risk==='ambitioniert'||risk==='ambitious'?1.1:1.0);
  weeklyKm*=riskF;

  var warnings=[];
  if(pain){weeklyKm*=0.7;longRunKm*=0.7;conf='reduziert';warnings.push('Knie '+knee+'/10 — Laufumfang reduziert, Progression pausiert.');}
  else if(lowReady){weeklyKm*=0.85;warnings.push('Readiness niedrig — Umfang gehalten statt gesteigert.');}

  // Long-Run-Anteil-Cap für Anfänger (25–35 % des Wochenumfangs) — nur sinnvoll ab 3 Läufen,
  // sonst wäre der Long Run kürzer als ein normaler Lauf.
  if(beginner&&runSessions>=3&&weeklyKm>0)longRunKm=Math.min(longRunKm, weeklyKm*0.35);

  // Recent-History-Guard: max ~10 % über grober Vorwochen-Basis (Anfänger)
  if(beginner&&typical>0){
    var prevWeek=typical*(st.n>=4?2:1);
    if(prevWeek>0&&weeklyKm>prevWeek*1.1)weeklyKm=prevWeek*1.1;
  }

  weeklyKm=Math.max(0,Math.round(weeklyKm*10)/10);
  longRunKm=Math.max(0,Math.round(longRunKm*10)/10);
  if(longRunKm>weeklyKm)longRunKm=weeklyKm; // Long Run nie größer als Wochenumfang

  return {weeklyKm:weeklyKm, runSessions:runSessions, longRunKm:longRunKm,
          typicalKm:+typical.toFixed(1), longestKm:st.longest, historyRuns:st.n,
          confidence:conf, note:note, warnings:warnings};
}

/* ============================================================
   ADAPTIVE ENGINE (rein, testbar) — Tageszustand + Session-/Wochen-Anpassung
   Trainings- und Belastungssteuerung, KEINE medizinische Diagnose.
   ============================================================ */
/* Tageszustand → GREEN / YELLOW / ORANGE / RED + Gründe + erlaubte Aktionen.
   in: {pain, region, illness, doms, sleepH, sleepQ, feel, motivation, stress,
        hrv, readiness, load3, load7, load14} (alles optional) */
function dayStateEngine(inp){
  var i=inp||{};
  var pain=(i.pain!=null?i.pain:0), doms=(i.doms!=null?i.doms:0);
  var sleepH=(i.sleepH!=null?i.sleepH:7), sleepQ=(i.sleepQ!=null?i.sleepQ:6);
  var feel=(i.feel!=null?i.feel:7), readiness=(i.readiness!=null?i.readiness:null);
  var lowHrv=(i.hrv==='Low'), highStress=(i.stress==='High'), illness=!!i.illness;
  var poorSleep=(sleepH<6||sleepQ<=4), lowEnergy=(feel<=4);
  var lowMot=(i.motivation!=null&&i.motivation<=3);
  // Belastungssprung 3T vs. 7T-Schnitt (falls geliefert)
  var loadSpike=(i.load3!=null&&i.load7!=null&&i.load7>0&&(i.load3/i.load7)>1.4);
  var flags={illness:illness,painSevere:pain>=6,pain:pain>=4&&pain<6,painMild:pain>=2&&pain<4,
    domsHigh:doms>=7,domsMod:doms>=4&&doms<7,poorSleep:poorSleep,lowEnergy:lowEnergy,
    lowHrv:lowHrv,highStress:highStress,loadSpike:loadSpike,lowMotivation:lowMot};
  var state;
  if(illness||flags.painSevere||(readiness!=null&&readiness<40)||(lowHrv&&poorSleep&&lowEnergy))state='RED';
  else if(flags.pain||flags.domsHigh||(readiness!=null&&readiness<55)||(lowHrv&&poorSleep)||loadSpike)state='ORANGE';
  else if((readiness!=null&&readiness<70)||flags.domsMod||poorSleep||flags.painMild||lowHrv||highStress||lowEnergy)state='YELLOW';
  else state='GREEN';
  var reasons=[];
  if(illness)reasons.push('Krankheitssymptome');
  if(pain>0)reasons.push('Schmerzen '+pain+'/10'+(i.region?' ('+i.region+')':''));
  if(doms>=4)reasons.push('Muskelkater '+doms+'/10');
  if(poorSleep)reasons.push('Schlaf '+(sleepH<6?sleepH.toFixed(1)+' h':'Qualität '+sleepQ+'/10'));
  if(lowEnergy)reasons.push('Energie '+feel+'/10');
  if(lowHrv)reasons.push('HRV niedrig');
  if(highStress)reasons.push('Stress hoch');
  if(loadSpike)reasons.push('Belastungssprung letzte 3 Tage');
  if(readiness!=null)reasons.push('Readiness '+readiness+'%');
  var allow={GREEN:{hard:true,strength:true,impact:true},
    YELLOW:{hard:false,strength:true,impact:true},
    ORANGE:{hard:false,strength:false,impact:false},
    RED:{hard:false,strength:false,impact:false}}[state];
  return {state:state,reasons:reasons,flags:flags,allow:allow};
}
/* Eine geplante Einheit an den Tageszustand anpassen → Aktionstyp + Ersatz.
   item: {t:'Laufen'|'Rad'|'Gym'|'Schwimmen'|'Mobilität', l, d, kind?}
   ds: dayStateEngine-Ergebnis. region: betroffener Schmerzbereich. */
function adaptSessionPlan(item,ds,opts){
  opts=opts||{};var st=ds.state,f=ds.flags;var t=item.t,kind=item.kind||'';
  var hard=(kind==='interval'||kind==='tempo')||/interval|tempo|sprint/i.test(item.l||'');
  var isLong=(kind==='long'||/long/i.test(item.l||''));
  var isLeg=(t==='Gym'&&/bein|ganzk|squat|leg/i.test(item.l||''));
  var region=(opts.region||'').toLowerCase();
  var impactPain=/knie|knee|schienbein|shin|achill|fuß|fuss|foot|sprung|ankle/.test(region);
  var R=function(action,label,detail,reason){return {action:action,label:label,detail:detail,reason:reason};};
  // RED: alles weich
  if(st==='RED'){
    if(f.illness)return R('REPLACE_WITH_RECOVERY','Ruhe / sehr leichte Bewegung','Kein strukturiertes Training. Bei mildem Zustand kurzer Spaziergang. Keine Intensität, kein Kraft, keine Intervalle.','Krankheitssymptome — Belastung aussetzen.');
    return R('REST','Ruhetag','Regeneration: Schlaf, Protein, Mobilität. Optional 10–20 min sehr locker.','Deutliche Überlastung/Beschwerden.');
  }
  // ORANGE: ersetzen/Modalität wechseln
  if(st==='ORANGE'){
    if((t==='Laufen')&&(impactPain||f.pain))return R('SWAP_MODALITY','Rad Zone 2 statt Lauf','45–60 min Z2 gelenkschonend statt Laufbelastung.','Schmerz im Stützapparat — Aufprall vermeiden.');
    if(isLeg)return R('SWAP_MODALITY','Oberkörper + Core statt Beine','Push/Pull/Core + Mobility, keine schwere knie-/rückendominante Last.','Beine/Rücken schonen.');
    if(hard)return R('REDUCE_INTENSITY','Easy Z2 statt '+(item.l||'hart'),'40 min locker Zone 2, keine Intensität.','Tagesform lässt keine harte Einheit zu.');
    if(isLong)return R('REDUCE_VOLUME','Long Run kürzen','Umfang ~60 %, locker nach Gefühl.','Reduzierte Belastbarkeit.');
    return R('REDUCE_VOLUME','Umfang reduzieren','Eine Stufe leichter, kürzer.','Eingeschränkte Tagesform.');
  }
  // YELLOW: reduzieren
  if(st==='YELLOW'){
    if(hard&&(f.domsHigh||f.domsMod)&&(t==='Laufen'||isLeg))return R('SWAP_MODALITY','Easy statt hart','Muskelkater — heute locker Z2 / kein neuer harter Reiz auf dieselbe Muskelgruppe.','Muskelkater '+(opts.doms||'')+' — keine harte Belastung gleicher Muskeln.');
    if(hard)return R('REDUCE_INTENSITY',(item.l||'Einheit')+' reduzieren','Weniger Wiederholungen oder in Easy umwandeln, wenn es zäh wird.','Werte gemischt — Reize dosieren.');
    if(isLong)return R('REDUCE_VOLUME','Long Run ~80 %','Etwas kürzer, locker.','Leichte Einschränkung.');
    if(impactPain&&t==='Laufen')return R('REDUCE_VOLUME','Lauf ~80 %, kein Tempo','Keine Sprints/Sprünge/Downhills.','Leichter Schmerz — Belastung vorsichtig.');
    return R('KEEP',item.l||'Wie geplant','Normal, aber auf Signale achten.','Nur leichte Einschränkung.');
  }
  return R('KEEP',item.l||'Wie geplant','Plan durchziehen.','Gute Tagesform.');
}
/* Nachhaltige Wochen-Anpassung (rein). plan: 7×[item]. opts:{todayIndex, state,
   fixedEvents:[{day,type}], illness}. Verschiebt verdrängte harte Einheit NICHT
   blind auf morgen, entzerrt harte Tage (≥48 h) und meidet hart direkt vor Event. */
function adaptWeekPlan(plan,opts){
  opts=opts||{};var today=(opts.todayIndex!=null?opts.todayIndex:0);
  var fixed={};(opts.fixedEvents||[]).forEach(function(e){fixed[e.day]=e.type||'Termin';});
  var w=plan.map(function(day){return (day||[]).slice();});
  var changes=[];
  var isHard=function(it){var k=it&&(it.kind||'');return (it.t==='Laufen'&&(k==='interval'||k==='tempo'||/interval|tempo|long/i.test(it.l||'')))||(it.t==='Gym'&&/bein|ganzk/i.test(it.l||''));};
  var dayHasHard=function(d){return (w[d]||[]).some(isHard);};
  var dayEmptyish=function(d){return !(w[d]||[]).some(function(it){return it.t!=='Mobilität';});};
  var eventSoon=function(d){return fixed[d]||fixed[(d+1)%7];}; // Event heute oder morgen
  // 1) Heute harte Einheit + schlechter Zustand → verdrängen und klug umplanen
  if((opts.state==='ORANGE'||opts.state==='RED')&&dayHasHard(today)){
    var moved=(w[today]||[]).filter(isHard);
    w[today]=(w[today]||[]).filter(function(it){return !isHard(it);});
    if(opts.state==='RED'){changes.push({day:today,action:'REPLACE_WITH_RECOVERY',reason:'Zustand RED — harte Einheit heute gestrichen.'});}
    else changes.push({day:today,action:'REDUCE_INTENSITY',reason:'Zustand ORANGE — harte Einheit heute ersetzt.'});
    // Zieltag suchen: ≥2 Tage Abstand, kein Event heute/morgen, Tag aktuell locker, kein Hard-Nachbar
    moved.forEach(function(it){
      var placed=false;
      for(var off=2;off<=5;off++){var d=(today+off)%7;
        if(d<today)break; // nur später in der Woche
        if(eventSoon(d))continue;
        if(dayHasHard(d)||dayHasHard((d+6)%7)||dayHasHard((d+1)%7))continue;
        if(!dayEmptyish(d))continue;
        w[d]=(w[d]||[]).concat([it]);changes.push({day:d,action:'MOVE_SESSION',reason:'Harte Einheit auf regenerierten Tag verschoben (≥48 h Abstand, kein Konflikt mit festem Termin).'});
        placed=true;break;
      }
      if(!placed)changes.push({day:today,action:'KEEP',reason:'Kein passender Tag mit genug Regeneration — Einheit wird nicht nachgeholt (Woche bleibt realistisch).'});
    });
  }
  // 2) Harte Tage entzerren (keine zwei direkt hintereinander)
  for(var d2=0;d2<7;d2++){
    if(dayHasHard(d2)&&dayHasHard((d2+1)%7)&&(d2+1)<7){
      changes.push({day:(d2+1),action:'MOVE_SESSION',reason:'Zwei harte Tage in Folge — zweiten Tag entzerren.'});
    }
  }
  // 3) Krankheit → 2–4 Tage konservativ
  if(opts.illness){changes.push({day:today,action:'REBUILD_WEEK',reason:'Krankheitssymptome — die nächsten 2–4 Tage konservativ (kein hartes Training), danach langsam steigern.'});}
  return {plan:w,changes:changes};
}

/* ============ TRAININGSART-KLASSIFIKATION (Phase 4) ============
   Wandelt eine Plan-Einheit in ein präzises Profil: Sport, Typ, Intensität,
   Beinlast, Aufprall. Basis für differenzierte Anpassung. */
function classifyTrainingType(item){
  if(!item)return {sport:null,type:'rest',intensity:'none',legLoad:false,impact:false,hard:false};
  var t=item.t,l=(item.l||'').toLowerCase(),kind=item.kind||'';
  var sport={Laufen:'run',Rad:'bike',Schwimmen:'swim',Gym:'gym','Mobilität':'mobility'}[t]||'other';
  var type='easy',intensity='low',legLoad=false,impact=false;
  if(t==='Laufen'){impact=true;legLoad=true;
    if(kind==='interval'||/interval/.test(l)){type='interval';intensity='high';}
    else if(kind==='tempo'||/tempo|schwelle/.test(l)){type='tempo';intensity='high';}
    else if(/sprint|stride|strides/.test(l)){type='sprint';intensity='high';}
    else if(kind==='long'||/long/.test(l)){type='long';intensity='moderate';}
    else if(/recovery/.test(l)){type='recovery';intensity='low';}
    else {type='easy';intensity='low';}
  }else if(t==='Rad'){
    if(/vo2|interval/.test(l)){type='vo2';intensity='high';}
    else if(/sweet|schwelle/.test(l)){type='sweetspot';intensity='high';}
    else if(/brick|koppel/.test(l)){type='brick';intensity='moderate';legLoad=true;}
    else if(/long/.test(l)){type='long';intensity='moderate';}
    else if(/recovery/.test(l)){type='recovery';intensity='low';}
    else {type='zone2';intensity='low';}
  }else if(t==='Schwimmen'){
    if(/interval/.test(l)){type='interval';intensity='high';}
    else if(/open/.test(l)){type='openwater';intensity='moderate';}
    else if(/ausdauer|endur/.test(l)){type='endurance';intensity='moderate';}
    else if(/technik/.test(l)){type='technique';intensity='low';}
    else {type='easy';intensity='low';}
  }else if(t==='Gym'){
    legLoad=/bein|leg|squat|unterk|ganzk/.test(l);
    if(/max|power/.test(l)){type='maxstrength';intensity='high';}
    else if(/hypertroph/.test(l)){type='hypertrophy';intensity='moderate';}
    else if(/core/.test(l)){type='core';intensity='low';}
    else if(/mobil|prehab/.test(l)){type='mobility';intensity='low';legLoad=false;}
    else if(/ober/.test(l)){type='upper';intensity='moderate';legLoad=false;}
    else {type='strength';intensity='moderate';}
  }else if(t==='Mobilität'){type='mobility';intensity='low';}
  return {sport:sport,type:type,intensity:intensity,legLoad:legLoad,impact:impact,hard:intensity==='high'};
}

/* ============ SPORT-CLUSTER & BELASTUNGSPROFILE (Phase 5) ============ */
const SPORT_PROFILES={
  endurance_run:{sport:'Laufen',cluster:'endurance_cyclic',primaryLoadAreas:['Waden','Achillessehne','Knie','Hüftbeuger'],injurySensitiveAreas:['Knie','Schienbein','Achillessehne'],intensityPattern:'zyklische Ausdauer',fixedEventImportance:'mittel',recoveryNeeds:'mittel'},
  endurance_bike:{sport:'Rad',cluster:'endurance_cyclic',primaryLoadAreas:['Quadrizeps','Glutes','unterer Rücken'],injurySensitiveAreas:['Knie','unterer Rücken'],intensityPattern:'zyklische Ausdauer',fixedEventImportance:'mittel',recoveryNeeds:'niedrig'},
  triathlon:{sport:'Triathlon',cluster:'multisport_triathlon',primaryLoadAreas:['Beine','Schulter','Gesamtvolumen'],injurySensitiveAreas:['Knie','Achillessehne','Schulter'],intensityPattern:'zyklisch + kumulierte Ermüdung, Brick',fixedEventImportance:'hoch',recoveryNeeds:'hoch'},
  football:{sport:'Fußball',cluster:'team_intermittent',primaryLoadAreas:['Beine','Hamstrings','Adduktoren','Knie','Sprunggelenk'],injurySensitiveAreas:['Knie','Sprunggelenk','Hamstrings','Adduktoren'],intensityPattern:'Sprints, Richtungswechsel, Kontakt, Spieltag',fixedEventImportance:'sehr hoch',recoveryNeeds:'hoch nach Spiel'},
  padel:{sport:'Padel',cluster:'court_racket',primaryLoadAreas:['Schulter','Unterarm','Wade','Achillessehne','Adduktoren'],injurySensitiveAreas:['Schulter','Achillessehne','Wade'],intensityPattern:'kurze Antritte, Richtungswechsel, Rotation',fixedEventImportance:'hoch',recoveryNeeds:'mittel'},
  strength:{sport:'Kraft',cluster:'strength_gym',primaryLoadAreas:['Zielmuskel je Split'],injurySensitiveAreas:['unterer Rücken','Schulter','Knie'],intensityPattern:'Sätze/Wiederholungen, Maximalkraft/Hypertrophie',fixedEventImportance:'niedrig',recoveryNeeds:'mittel'}
};
function sportProfileFor(goal){
  var g=String(goal||'').toLowerCase();
  if(/triathl|ironman/.test(g))return SPORT_PROFILES.triathlon;
  if(/fußball|fussball|football|soccer/.test(g))return SPORT_PROFILES.football;
  if(/padel|tennis|squash/.test(g))return SPORT_PROFILES.padel;
  if(/muscle|strength|kraft|hypertroph/.test(g))return SPORT_PROFILES.strength;
  if(/cycl|rad|bike/.test(g))return SPORT_PROFILES.endurance_bike;
  return SPORT_PROFILES.endurance_run;
}

/* ============ SAFETY (Phase 8) — Belastungssteuerung, KEINE Diagnose ============ */
function safetyCheck(c){
  c=c||{};var flags=[],red=[];
  // Feld-Aliasse: akzeptiert Kurz- UND ausführliche Namen (UI-kompatibel).
  var breath=c.breathlessness||c.shortnessOfBreath;
  var neuro=c.neuro||c.neurologicalSymptoms;
  var trauma=c.traumaPain||c.accidentPain;
  function addRed(f){flags.push(f);red.push(f);}
  // Echte Warnzeichen → level 'red' (harter Eingriff). Krankheit allein NICHT 'red'.
  if(c.fever)addRed('Fieber');
  if(c.chestPain)addRed('Brustschmerz');
  if(breath)addRed('Atemnot');
  if(c.dizziness)addRed('Schwindel/Ohnmacht');
  if(neuro)addRed('neurologische Symptome');
  if(trauma)addRed('Schmerz nach Unfall');
  if(c.swelling)addRed('akute Schwellung');
  if(c.instability)addRed('Instabilitätsgefühl');
  if(c.severePain||(c.pain!=null&&c.pain>7))addRed('starke Schmerzen');
  if(c.illness)flags.push('Krankheitssymptome');
  var critical=!!(c.chestPain||breath||c.dizziness||neuro||trauma);
  var level=red.length?'red':(c.illness?'caution':'none');
  var advice=red.length
    ?'ORVIA kann keine Diagnose stellen. Aufgrund deiner Angaben wird heute keine intensive Einheit empfohlen. Bei starken, plötzlichen oder anhaltenden Beschwerden bitte fachlich abklären lassen.'
    :(c.illness?'ORVIA kann keine Diagnose stellen. Mit Krankheitssymptomen heute keine intensive Einheit — leichte Bewegung nur bei mildem Zustand.':'');
  // triggered bleibt rückwärtskompatibel (true bei irgendeinem Flag), level differenziert.
  return {triggered:flags.length>0,critical:critical,level:level,flags:flags,redFlags:red,advice:advice};
}
/* ---- Schmerz/DOMS GETRENNT bewerten (painRegion vs. domsRegion) ---- */
function evaluatePainImpact(n,tt){
  var region=(n.painRegion||'').toLowerCase();
  var impactRegion=/knie|knee|schienbein|shin|achill|fuß|fuss|sprung|ankle|hüft|hip/.test(region);
  var hits=!tt?((n.pain||0)>=5):(impactRegion&&(tt.impact||tt.legLoad));
  var blocksHard=((n.pain||0)>=5&&impactRegion&&hits);
  return {pain:n.pain||0,region:region,impactRegion:impactRegion,hits:hits,blocksHard:blocksHard};
}
function evaluateDomsImpact(n,tt){
  var region=(n.domsRegion||'').toLowerCase();var hits;
  if(region){
    var leg=/bein|leg|hamstring|adduktor|quad|wade|gesä|glut/.test(region);
    var upper=/ober|arm|brust|schulter|rücken|lat/.test(region);
    hits=(leg&&tt&&tt.legLoad)||(upper&&tt&&tt.sport==='gym'&&!tt.legLoad);
  }else{
    // keine DOMS-Region → konservativ anhand geplanter Einheit (beinlastig), aber nicht dramatisch
    hits=tt?!!tt.legLoad:false;
  }
  var blocksHard=((n.doms||0)>=7&&hits);
  return {doms:n.doms||0,region:region,hasRegion:!!region,hits:hits,blocksHard:blocksHard};
}
function evaluatePainAndDOMS(n,tt){
  var p=evaluatePainImpact(n,tt),d=evaluateDomsImpact(n,tt);
  return {pain:p,doms:d,blocksHardForToday:(p.blocksHard||d.blocksHard),hitsStruct:(p.hits||d.hits)};
}
/* ---- Recovery nach SCHWERE (nicht nur Anzahl) ---- */
function evaluateRecoveryState(n){
  var lim=[],sc=100,hard=!!n.hardPlanned,sleepH=n.sleepH,sleepQ=n.sleepQ;
  if(sleepH!=null){ if(sleepH<5){sc-=28;lim.push('Schlaf <5 h');} else if(sleepH<6){sc-=16;lim.push('Schlaf <6 h');} else if(sleepH<7){sc-=7;} }
  if(sleepQ!=null){ if(sleepQ<=2){sc-=24;lim.push('Schlafqualität sehr niedrig');} else if(sleepQ<=4){sc-=12;lim.push('Schlafqualität niedrig');} else if(sleepQ<=6){sc-=5;} }
  if(n.hrv==='Low'){sc-=16;lim.push('HRV niedrig');}
  if(n.rhrDev!=null&&n.rhrDev>=5){sc-=12;lim.push('Ruhepuls erhöht');}
  if(n.stress==='High'){sc-=10;lim.push('Stress hoch');} else if(n.stress==='Med'){sc-=4;}
  if(n.sleepDebtH!=null&&n.sleepDebtH>=4){sc-=8;lim.push('Schlafkonto negativ');}
  sc=Math.max(0,Math.min(100,sc));
  var extreme=(sleepH!=null&&sleepH<5)||(sleepQ!=null&&sleepQ<=2);
  var hrvBad=(n.hrv==='Low'&&((sleepH!=null&&sleepH<6)||(sleepQ!=null&&sleepQ<=4)));
  var sev='ok';
  if(lim.length>=3)sev='high';
  else if(extreme)sev=hard?'high':'moderate';
  else if(hrvBad)sev='moderate';
  else if(lim.length===2)sev='moderate';
  else if(lim.length===1)sev='mild';
  return {score0_100:sc,limiters:lim,severity:sev,extreme:extreme};
}
function evaluateLoadAndInterference(n,tt){
  var L=n.loads||{};
  var has=(L.load3!=null&&L.load7!=null&&L.load7>0);
  var ratio=has?L.load3/L.load7:null;
  var spike=has&&ratio>1.4;
  var interference=!!(tt&&tt.legLoad&&(n.doms||0)>=4);
  var notes=[];if(spike)notes.push('Belastungssprung');if(interference)notes.push('Bein-Interferenz');
  return {loadSpike:spike,interference:interference,notes:notes,
    load3:has?Math.round(L.load3):null,load7:has?Math.round(L.load7):null,
    spikePct:spike?Math.round((ratio-1)*100):null};
}
/* ---- Score-Caps zentral (UI rechnet KEINE Caps) ---- */
function applyDecisionCaps(score,n,ev,state,tt){
  var cap=100,hard=!!(n&&n.hardPlanned),S=ev.safety,P=ev.pdm,Ld=ev.load||{};
  if(S.level==='red')cap=Math.min(cap,35);
  if(n.illness&&S.level!=='red')cap=Math.min(cap,55);
  if((n.pain||0)>=8)cap=Math.min(cap,40);
  if(n.sleepQ!=null&&n.sleepQ<=2&&hard)cap=Math.min(cap,65);
  if(n.sleepH!=null&&n.sleepH<5&&hard)cap=Math.min(cap,65);
  if(n.hrv==='Low'&&((n.sleepH!=null&&n.sleepH<6)||(n.sleepQ!=null&&n.sleepQ<=4)))cap=Math.min(cap,68);
  if((n.doms||0)>=8&&P.doms.hits)cap=Math.min(cap,65);
  if((n.pain||0)>=5&&P.pain.impactRegion&&P.pain.hits)cap=Math.min(cap,60);
  // Belastung ≠ Tagesform: Ein NUR durch Lastsprung ausgelöstes ORANGE darf den physiologischen
  // Readiness-Score NICHT deckeln. Der Lastsprung steuert die Trainingsentscheidung (Umfang
  // reduzieren), nicht die Zahl. Physiologische ORANGE-Ursachen deckeln weiterhin korrekt.
  var physOrangeCause=(n.illness||(n.pain||0)>=4||(n.doms||0)>=7||(n.readiness!=null&&n.readiness<55)||
    (n.hrv==='Low'&&((n.sleepH!=null&&n.sleepH<6)||(n.sleepQ!=null&&n.sleepQ<=4))));
  var loadOnlyOrange=(state==='ORANGE'&&Ld.loadSpike&&!physOrangeCause);
  var stateCap=loadOnlyOrange?100:{GREEN:100,YELLOW:79,ORANGE:64,RED:44}[state];
  cap=Math.min(cap,stateCap);
  return Math.max(0,Math.min(Math.round(score),cap));
}
/* ---- Max. 2 Trigger, PRIORISIERT: Safety > Plan-Konflikt > lokal > Recovery > Last ---- */
function buildTriggerHighlights(ev){
  var out=[],S=ev.safety,P=ev.pdm,R=ev.recovery,C=ev.ctx||{},L=ev.load||{};
  if(S.level==='red')out.push({title:'Starkes Warnsignal',detail:'Heute keine intensive Einheit.'});
  if(C.matchConflict)out.push({title:'Plan-Konflikt',detail:'Harte Einheit wird verschoben.'});
  if(P.blocksHardForToday)out.push({title:'Beinbelastung erhöht',detail:'Kein Intervall oder Leg Day.'});
  if((R.severity==='high'||R.severity==='moderate'))out.push({title:'Schlaf limitiert Intensität',detail:'Heute keine maximale Einheit.'});
  if(L.loadSpike)out.push({title:'Lastsprung',detail:(L.spikePct!=null)
    ?'Deine Belastung der letzten 3 Tage liegt '+L.spikePct+'% über deinem 7-Tage-Durchschnitt (Grenze +40%). Deshalb wird die heutige Einheit reduziert.'
    :'Umfang kontrollieren — akute Last über dem 7-Tage-Schnitt.'});
  return out.slice(0,2);
}
function combineScore(c){
  c=c||{};var parts=[];
  if(c.recovery!=null)parts.push([c.recovery,0.42]);
  if(c.riskRaw!=null)parts.push([100-c.riskRaw,0.26]);
  if(c.loadFit!=null)parts.push([c.loadFit,0.14]);
  if(c.execution!=null)parts.push([c.execution,0.10]);
  if(c.progress!=null)parts.push([c.progress,0.08]);
  if(!parts.length)return c.recovery!=null?c.recovery:70;
  var W=parts.reduce(function(s,p){return s+p[1];},0)||1;
  return Math.round(parts.reduce(function(s,p){return s+p[0]*p[1];},0)/W);
}

/* ============ DEFIZIT-/MUSTER-ERKENNUNG (Phase 6) — Performance, keine Diagnose ============ */
function detectDeficits(o){
  o=o||{};var out=[];
  var L=o.loads||{};
  if(L.load3!=null&&L.load7!=null&&L.load7>0&&L.load3/L.load7>1.4)out.push({key:'load_spike_problem',label:'Belastungssprung',note:'Akute Last deutlich über dem Schnitt — Verletzungsrisiko.'});
  if(o.hardDaysInRow>=2)out.push({key:'planning_conflict',label:'Planungskonflikt',note:'Mehrere harte Tage direkt hintereinander.'});
  if(o.lowHrv&&o.poorSleep&&(L.load7||0)>0)out.push({key:'recovery_deficit',label:'Regenerationsdefizit',note:'Hohe Last + niedrige HRV + schlechter Schlaf.'});
  if(o.easyShare!=null&&o.easyShare<0.7)out.push({key:'intensity_distribution_problem',label:'Intensitätsverteilung',note:'Zu wenig wirklich lockeres Volumen (80/20 verfehlt).'});
  if(o.kneeAfterLegRun)out.push({key:'interference_problem',label:'Interferenz',note:'Kniebeschwerden nach Leg Day + Lauf — Belastungen entkoppeln.'});
  return out;
}

/* ============ ZENTRALE TRAININGSENTSCHEIDUNG (Phase 1) — Quelle der Wahrheit ============ */
function buildTrainingDecision(input){
  var i=input||{},c=i.checkin||{},L=i.loads||{};
  var planned=i.plannedToday||null,tt=classifyTrainingType(planned);
  // normalisierter Input (eine Quelle): painRegion ≠ domsRegion, hardPlanned aus tt
  var n={pain:c.pain||0,painRegion:c.painRegion||c.region||'',doms:c.doms||0,domsRegion:c.domsRegion||'',
    illness:!!c.illness,sleepH:c.sleepH,sleepQ:c.sleepQ,feel:c.feel,motivation:c.motivation,
    stress:c.stress,hrv:c.hrv,rhrDev:c.rhrDev,sleepDebtH:c.sleepDebtH,readiness:c.readiness,
    loads:L,hardPlanned:!!(tt.hard||(tt.legLoad&&tt.intensity!=='low'))};
  var safety=safetyCheck(c);
  var ti=(i.todayIndex!=null?i.todayIndex:0);
  // Fester Termin (Spiel/Wettkampf) in 0–2 Tagen?
  var matchConflict=null;
  (i.fixedEvents||[]).forEach(function(ev){if(ev.type==='match'||ev.type==='race'){var dd=ev.day-ti;if(dd>=0&&dd<=2&&(matchConflict==null||dd<matchConflict.days))matchConflict={ev:ev,days:dd};}});
  // Evaluatoren
  var rec=evaluateRecoveryState(n);
  var pdm=evaluatePainAndDOMS(n,tt);
  var load=evaluateLoadAndInterference(n,tt);
  var stateInput={pain:n.pain,region:n.painRegion,illness:n.illness,doms:n.doms,sleepH:n.sleepH,sleepQ:n.sleepQ,feel:n.feel,motivation:n.motivation,stress:n.stress,hrv:n.hrv,readiness:n.readiness,load3:L.load3,load7:L.load7,load14:L.load14};
  var ds=dayStateEngine(stateInput);
  // State-Hierarchie: Safety-RED > Schmerz≥8 RED > Krankheit (mind. ORANGE, nicht zwingend RED) > dayState
  var state;
  if(safety.level==='red')state='RED';
  else if(n.pain>=8)state='RED';
  else{
    state=ds.state;
    if(n.illness&&state==='RED'){var ds2=dayStateEngine(Object.assign({},stateInput,{illness:false}));state=(ds2.state==='RED')?'RED':'ORANGE';}
  }
  // Session-Anpassung
  var sess=adaptSessionPlan(Object.assign({},planned||{},{kind:tt.type}),{state:state,flags:ds.flags},{region:n.painRegion,doms:n.doms});
  if(matchConflict&&planned&&(tt.hard||tt.legLoad)&&(state==='GREEN'||state==='YELLOW')){
    sess={action:'MOVE_SESSION',label:'Vor '+(matchConflict.ev.title||'Spiel/Wettkampf')+' entlasten',
      detail:'Keine harte Bein-/Intensitätsbelastung '+(matchConflict.days<=1?'24 h':'48 h')+' vor dem Termin — heute locker oder verschieben.',
      reason:'Fester Termin in '+matchConflict.days+' Tag(en) — Frische schützen.'};
  }
  if(safety.level==='red'){sess={action:safety.critical?'REST':'REPLACE_WITH_RECOVERY',
    label:safety.critical?'Trainingspause':'Sehr leichte Bewegung / Pause',detail:safety.advice,reason:safety.redFlags.join(', ')};}
  else if(n.illness&&state==='ORANGE'&&tt.hard){sess={action:'REPLACE_WITH_RECOVERY',label:'Leichte Bewegung statt harter Einheit',detail:safety.advice||'Mit Krankheitssymptomen keine Intensität — nur lockere Bewegung bei mildem Zustand.',reason:'Krankheitssymptome'};}
  var ev={safety:safety,recovery:rec,pdm:pdm,load:load,ctx:{matchConflict:matchConflict}};
  // Score: Tagesform-Headline = physiologische READINESS (Morgenwerte). Belastung (riskRaw/
  // loadFit) und Umsetzung bleiben SEPARATE Subscores + Entscheidungsinput und drücken die
  // Headline NICHT (Abschnitt 14.8: Readiness und Belastungsentscheidung trennen).
  var _compIn=i.components||{recovery:(c.readiness!=null?c.readiness:null)};
  var rawScore=(_compIn.recovery!=null?_compIn.recovery:combineScore(_compIn));
  var score=applyDecisionCaps(rawScore,n,ev,state,tt);
  // Subscores (anzeige-fertig, einheitlich „höher = besser")
  var comp=i.components||{};
  var subscores={
    recovery:{value:(comp.recovery!=null?Math.round(comp.recovery):rec.score0_100),label:'Erholung'},
    control:{value:(comp.riskRaw!=null?Math.round(100-comp.riskRaw):null),label:'Belastungskontrolle'},
    execution:{value:(comp.execution!=null?Math.round(comp.execution):null),label:'Umsetzung'}
  };
  // Status streng an State gekoppelt; Peak nur bei sehr sauberem Zustand
  var goodSleep=(n.sleepH==null||n.sleepH>=6)&&(n.sleepQ==null||n.sleepQ>=6);
  var peakOK=(state==='GREEN'&&sess.action==='KEEP'&&score>=85&&!n.illness&&n.pain<3&&n.doms<5&&safety.level==='none'&&goodSleep&&n.stress!=='High');
  var statusText=peakOK?'Peak':{GREEN:'Bereit',YELLOW:'Reduzieren empfohlen',ORANGE:'Anpassen',RED:'Regeneration'}[state];
  var triggers=buildTriggerHighlights(ev);
  // Wochen-Anpassung + sichtbarer Ersatz-Slot
  var weekAdjustments=[],weekPlanAdjusted=null;
  if(i.weekPlan&&i.todayIndex!=null){
    var wk=adaptWeekPlan(i.weekPlan.map(function(day){return (day||[]).map(function(it){return Object.assign({},it,{kind:classifyTrainingType(it).type});});}),
      {todayIndex:ti,state:state,illness:n.illness,fixedEvents:i.fixedEvents});
    weekAdjustments=wk.changes;weekPlanAdjusted=wk.plan;
    if(weekPlanAdjusted&&sess.action!=='KEEP'&&planned){
      var origItem=Object.assign({},planned);delete origItem.kind;
      var repType=(sess.action==='SWAP_MODALITY')?(/rad|bike/i.test(sess.label||'')?'Rad':'Mobilität')
        :((sess.action==='REST'||sess.action==='REPLACE_WITH_RECOVERY')?'Mobilität':planned.t);
      weekPlanAdjusted[ti]=[{t:repType,l:'Ersatz für '+(planned.l||'Einheit')+': '+sess.label,d:sess.detail||'',
        adaptiveReplacement:true,actionType:sess.action,reason:sess.reason,originalSession:origItem,source:'adaptive_engine'}];
    }
  }
  var riskFlags={
    kneeRisk:pdm.pain.impactRegion&&pdm.pain.pain>=4,illnessRisk:n.illness,
    overloadRisk:load.loadSpike,domsRisk:pdm.doms.doms>=7&&pdm.doms.hits,
    matchConflictRisk:!!matchConflict,safetyRisk:safety.level==='red'
  };
  var reasons=ds.reasons.slice();
  if(matchConflict)reasons.unshift('Fester Termin in '+matchConflict.days+' Tag(en)');
  if(safety.redFlags.length)reasons=safety.redFlags.concat(reasons);
  var DECISION={GREEN:'Trainieren',YELLOW:'Reduzieren',ORANGE:'Ersetzen',RED:'Pausieren'};
  var avoidedSession=(sess.action!=='KEEP'&&planned)?{label:(planned.l||'geplante Einheit'),type:tt.type,sport:tt.sport}:null;
  var userMessage='Heute: '+state+' — '+DECISION[state]+'. '+(avoidedSession?('Kein '+avoidedSession.label+'. '):'')+(sess.detail?sess.detail+' ':'')+(reasons.length?('Grund: '+reasons.slice(0,3).join(', ')+'.'):'');
  var coachSummary='state='+state+'|action='+sess.action+'|score='+score+'|risks='+(Object.keys(riskFlags).filter(function(k){return riskFlags[k];}).join(',')||'-')+'|reasons='+reasons.slice(0,4).join(',');
  var dq=i.dataQuality||{};
  return {
    dayState:state,score:score,subscores:subscores,statusText:statusText,triggers:triggers,
    readinessReasons:reasons,riskFlags:riskFlags,todayAction:sess.action,
    recommendedSession:{action:sess.action,label:sess.label,detail:sess.detail},
    avoidedSession:avoidedSession,
    weekAdjustments:weekAdjustments,weekPlanAdjusted:weekPlanAdjusted,
    recovery:rec,painDoms:pdm,load:load,
    userMessage:userMessage,coachSummary:coachSummary,
    confidence:dq.confidence||'mittel',dataQuality:dq,
    safety:safety,sportProfile:sportProfileFor(i.goal||(i.profile&&i.profile.primaryGoal)),
    deficits:detectDeficits(i.deficitContext||{})
  };
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
const Calc={HM_KM,RACE_DATE,avg,median,sd,clampC,fmtPace,fmtTime,fmtDuration,paceZones,bmr,nutritionTargets,ewma,sessionLoad,acwr,
  weekKmTarget,effectiveKmTarget,runnaWeek,racePhase,trendDir,readiness,ampel,hrvScoreOf,riegelHM,goalEngine,
  easyShare,weeklyJump,lrTarget,hrSpread,easyTooHard,efSeries,nextRunRec,heavyLegs,sleepDebt,weightHint,
  recentRunStats,calculateRecommendedWeeklyRunVolume,
  dayStateEngine,adaptSessionPlan,adaptWeekPlan,
  classifyTrainingType,SPORT_PROFILES,sportProfileFor,safetyCheck,detectDeficits,buildTrainingDecision,
  evaluatePainImpact,evaluateDomsImpact,evaluatePainAndDOMS,evaluateRecoveryState,evaluateLoadAndInterference,
  applyDecisionCaps,buildTriggerHighlights,combineScore};
root.Calc=Calc;
if(typeof module!=='undefined'&&module.exports)module.exports=Calc;
})(typeof window!=='undefined'?window:globalThis);
