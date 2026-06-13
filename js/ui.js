/* ============================================================
   UI LAYER — Rendering, Events, Tabs. Nutzt Calc (rein) + DB (data.js).
   ============================================================ */
const RACE={get date(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.raceDate)||Calc.RACE_DATE;},
            get name(){return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.raceName)||'Halbmarathon';}};
let cur=todayStr();
let activeTypes=new Set();

function ic(n){return '<svg class="ic"><use href="#i-'+n+'"/></svg>';}
const TYPES={Laufen:{ic:ic('run'),sub:'Run'},Gym:{ic:ic('dumbbell'),sub:'Kraft'},Rad:{ic:ic('bike'),sub:'Cycling'},Schwimmen:{ic:ic('swim'),sub:'Pool'},Mobilität:{ic:ic('stretch'),sub:'Stretch'}};
const ROUTINES=[['mob','Sprunggelenk-Mobilität (links extra)'],['ss','Spanish Squats'],['ice','Eisbeutel Knie']];
const SLOTS=['Morgens','Pre-Workout','Post-Workout','Mit Mahlzeit','Abends'];
const DAYNAMES=['Mo','Di','Mi','Do','Fr','Sa','So'];
const WEEKPLAN=[
  [{t:'Gym',l:'Ganzkörper',d:'45 min'}],
  [{t:'Schwimmen',l:'Technik',d:'6:00 Uhr · ~900 m'},{t:'Gym',l:'Oberkörper',d:'45 min'}],
  [{t:'Laufen',l:'Intervalle',d:'iv'},{t:'Gym',l:'Ganzkörper',d:'45 min'}],
  [{t:'Gym',l:'Oberkörper',d:'45 min'}],
  [{t:'Laufen',l:'Z2 Dauerlauf',d:'ez'}],
  [{t:'Schwimmen',l:'Ausdauer',d:'~900 m'},{t:'Rad',l:'Z2 Dauerfahrt',d:'60 min · 123–144 bpm'}],
  [{t:'Laufen',l:'Long Run',d:'lr'}]];
const PHASES=[
  {n:'Aufbau',from:'2026-06-01',to:'2026-08-02',d:'Volumen & Grundlage steigern, Schwimm-Technik'},
  {n:'Peak',from:'2026-08-03',to:'2026-08-23',d:'Höchste Wochen-km, Race-Pace-Blöcke im Long Run'},
  {n:'Taper',from:'2026-08-24',to:'2026-09-05',d:'Volumen −50%, kurze Intensität halten, Frische'},
  {n:'Race',from:'2026-09-06',to:'2026-09-06',d:'Halbmarathon · Ziel <1:50h'}];
const WEEK_TARGETS=[['Laufen',3,'run'],['Schwimmen',2,'swim'],['Gym',4,'dumbbell'],['Rad',2,'bike']];

/* ---- Mini-Helfer ---- */
function v(id){const e=document.getElementById(id);return e?e.value:'';}
function fmtDate(s){return new Date(s+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});}
function daysTo(date){return Math.round((new Date(date+'T00:00')-new Date(todayStr()+'T00:00'))/864e5);}
function avg(a){return Calc.avg(a);}
function fmtPace(s){return Calc.fmtPace(s);}

/* ---- Toast (mit optionaler Aktion, z. B. Rückgängig) ---- */
let _toastFn=null;
function toast(m){const t=document.getElementById('toast');t.classList.remove('act');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1600);}
function toastAction(msg,label,fn){const t=document.getElementById('toast');_toastFn=fn;
  t.innerHTML=esc(msg)+' <button class="tbtn" onclick="_toastFn&&_toastFn();document.getElementById(\'toast\').classList.remove(\'show\')">'+esc(label)+'</button>';
  t.classList.add('show','act');clearTimeout(t._t);t._t=setTimeout(()=>{t.classList.remove('show','act');},5000);}

/* ---- Autosave: ein Timer PRO Formular + synchroner Flush vor Kontextwechsel ---- */
const _debT={};
function debounce(key,fn){if(_debT[key])clearTimeout(_debT[key].t);_debT[key]={t:setTimeout(()=>{delete _debT[key];fn();},150),fn};}
function flushAuto(){Object.keys(_debT).forEach(k=>{const d=_debT[k];clearTimeout(d.t);delete _debT[k];d.fn();});}

/* ---- Slider/Chips ---- */
function slider(id,label,min,max,def,lo,hi){
  return `<div class="field"><label>${label}<span class="val" id="${id}_v">${def}</span></label>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${def}" oninput="sv('${id}',${min},${max})">
    <div class="scale"><span>${lo||min}</span><span>${hi||max}</span></div></div>`;}
function sv(id,min,max){const el=document.getElementById(id);const val=+el.value;const lab=document.getElementById(id+'_v');if(lab)lab.textContent=val;el.style.setProperty('--p',((val-min)/(max-min)*100)+'%');}
function initRanges(){document.querySelectorAll('input[type=range]').forEach(el=>{if(el.id==='m_sleep')return;sv(el.id,+el.min,+el.max);});}
function chips(label,id,opts,sel,multi,green){sel=sel||[];
  const b=opts.map(o=>`<button type="button" class="chip${green?' gn':''}${sel.includes(o)?' on':''}" data-v="${esc(o)}" onclick="chipTap('${id}','${jsArg(o)}',${!!multi})">${esc(o)}</button>`).join('');
  return `<div class="field"><label>${label}</label><div class="chips" id="${id}">${b}</div></div>`;}
function chipTap(id,val,multi){const box=document.getElementById(id);const btn=[...box.children].find(c=>c.dataset.v===val);if(!btn)return;
  if(multi)btn.classList.toggle('on');else{[...box.children].forEach(c=>c.classList.remove('on'));btn.classList.add('on');}}
function chipGet(id){const box=document.getElementById(id);if(!box)return[];return[...box.children].filter(c=>c.classList.contains('on')).map(c=>c.dataset.v);}

/* ============ KONTEXT-BUILDER (Baselines, Fenster) ============ */
function recoveryCtx(dateStr){
  const ln7=[],ln28=[],rhr28=[],sleep7=[];let lowStreak=0,streakDone=false;
  for(let i=1;i<=28;i++){
    const d=new Date(dateStr+'T12:00');d.setDate(d.getDate()-i);
    const e=DB[todayStr(d)];const m=e&&e.morning;if(!m)continue;
    if(m.hrvMs){const ln=Math.log(m.hrvMs);ln28.push(ln);if(i<=7)ln7.push(ln);}
    if(m.rhr!=null)rhr28.push(m.rhr);
    if(i<=7&&m.sleepMin!=null)sleep7.push(m.sleepMin);
    if(!streakDone){const s=Calc.hrvScoreOf(m,null);if(s===25)lowStreak++;else streakDone=true;}
  }
  return{hrvBase7:ln7.length>=4?Calc.avg(ln7):null,hrvSd28:Calc.sd(ln28),hrvN:ln28.length,
    rhrBase:rhr28.length>=7?Calc.median(rhr28):null,
    sleepDebtH:sleep7.length>=4?Calc.sleepDebt(sleep7):null,hrvLowStreak:lowStreak};
}
function readinessFor(k){const e=DB[k];if(!e||!e.morning||e.morning.knee==null)return{score:''};return Calc.readiness(e.morning,recoveryCtx(k));}
function readinessOf(k){const e=DB[k];return(e&&e.morning&&e.morning.knee!=null)?Calc.readiness(e.morning,recoveryCtx(k)).score:null;}
function runsWindow(days){const out=[];for(let i=days-1;i>=0;i--){const k=dkey(-i);const e=DB[k];const r=e&&e.sessions&&e.sessions.Laufen;if(r)out.push(Object.assign({date:k},r));}return out;}
function weekRunKm(off){const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day-7*(off||0));
  let km=0;for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const e=DB[todayStr(d)];if(e&&e.sessions&&e.sessions.Laufen)km+=e.sessions.Laufen.dist||0;}return km;}
function allLoads(){
  const keys=Object.keys(DB).filter(isDay).sort();
  const n=Math.min(365,Math.max(90,keys.length?Math.round((new Date(todayStr())-new Date(keys[0]))/864e5)+1:90));
  const loads=[],labels=[];
  for(let i=n-1;i>=0;i--){const k=dkey(-i);loads.push(Calc.sessionLoad(DB[k]));labels.push(new Date(k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));}
  return{loads,labels};
}
let _goalCache=null,_goalCacheT=0;
function buildGoal(){
  if(_goalCache&&Date.now()-_goalCacheT<5000)return _goalCache;
  const ld=allLoads();const ctlArr=Calc.ewma(ld.loads,42);
  const keys=Object.keys(DB).filter(isDay).sort();
  const trackingWeeks=keys.length?Math.floor((new Date(todayStr())-new Date(keys[0]))/(7*864e5)):0;
  _goalCache=Calc.goalEngine(runsWindow(42),{
    daysToRace:daysTo(RACE.date),targetMin:DB._hmTargetMin||110,
    avg4WeekKm:(weekRunKm(1)+weekRunKm(2)+weekRunKm(3)+weekRunKm(4))/4,
    targetWeekKm:Calc.weekKmTarget(daysTo(RACE.date),0),
    lrMax28:Math.max(0,...runsWindow(28).filter(r=>r.sub==='Long Run').map(r=>r.dist||0)),
    ctlNow:ctlArr[ctlArr.length-1]??null,ctlPrev28:ctlArr.length>28?ctlArr[ctlArr.length-29]:null,trackingWeeks});
  _goalCacheT=Date.now();return _goalCache;
}
function nextRunInfo(ampelC,readyScore){
  const wd=(new Date(todayStr()+'T12:00').getDay()+6)%7;
  const planRun=(WEEKPLAN[wd]||[]).find(p=>p.t==='Laufen');
  let lastRun=null;
  for(let i=1;i<=14;i++){const k=dkey(-i);const e=DB[k];const r=e&&e.sessions&&e.sessions.Laufen;
    if(r){lastRun={sub:r.sub,knee:r.knee,daysAgo:i,morningKnee:e.morning?e.morning.knee:null};break;}}
  const y=DB[dkey(-1)],y2=DB[dkey(-2)];const m=(DB[todayStr()]||{}).morning||{};
  return Calc.nextRunRec({ampelC,readiness:readyScore,lastRun,planToday:planRun?planRun.l:null,
    heavyLegsYesterday:Calc.heavyLegs(y&&y.sessions&&y.sessions.Gym),
    heavyLegs2d:Calc.heavyLegs(y2&&y2.sessions&&y2.sessions.Gym),doms:m.doms,legs:m.legs});
}

/* ============ COMMAND CENTER (Today-Hero) ============ */
function renderCommand(){
  const el=document.getElementById('command');if(!el)return;
  if(cur!==todayStr()){el.innerHTML='';return;}
  const d=daysTo(RACE.date);const goal=buildGoal();
  const gc=goal.state==='nodata'?{txt:'Prognose: Daten sammeln',cls:'b'}:
    goal.state==='ontrack'?{txt:'≈'+Calc.fmtTime(goal.tPred)+' · ON TRACK',cls:'g'}:
    goal.state==='border'?{txt:'≈'+Calc.fmtTime(goal.tPred)+' · GRENZWERTIG',cls:'y'}:
    {txt:'≈'+Calc.fmtTime(goal.tPred)+' · GEFÄHRDET',cls:'r'};
  const e=DB[todayStr()];const m=e&&e.morning;
  if(!m){
    el.innerHTML=`<div class="cmd"><div class="cmdtop"><span class="cmdlab">Heute</span><span class="cmdrace">${ic('flag')}D−${d}</span></div>
      <div class="verdict pend">Check-in ausstehend</div>
      <div class="cmdsub">2 Minuten Morgen-Check-in, dann steht deine Entscheidung: trainieren, reduzieren oder regenerieren.</div>
      <button class="btn" style="margin-top:14px" onclick="document.getElementById('morningForm').scrollIntoView({behavior:'smooth'})">Check-in starten</button>
      <div class="cmdfoot"><span class="goalpill ${gc.cls}">${ic('target')}${gc.txt}</span></div></div>`;
    return;
  }
  const ctx=recoveryCtx(todayStr());const r=Calc.readiness(m,ctx);const a=Calc.ampel(m,r,ctx);
  const nrr=nextRunInfo(a.c,r.score);
  const verdict=a.c==='g'?'Trainieren':a.c==='y'?'Reduzieren':'Regenerieren';
  const hrvTxt=m.hrvMs?m.hrvMs+' ms':(m.hrv||'–');
  el.innerHTML=`<div class="cmd ${a.c}">
    <div class="cmdtop"><span class="cmdlab">Heute · ${r.score}% bereit</span><span class="cmdrace">${ic('flag')}D−${d}</span></div>
    <div class="verdict">${verdict}</div>
    <div class="cmdsub">${esc(a.why[0]||'')}</div>
    <div class="cmdkpis">
      <span>${ic('pulse')}Knie ${m.knee}/10</span>
      <span>${ic('zzz')}${m.sleepMin?(m.sleepMin/60).toFixed(1)+'h':'–'}</span>
      <span>${ic('heart')}HRV ${hrvTxt}</span>
    </div>
    <div class="cmdnext">${ic('run')}<span>${esc(nrr.txt)}</span></div>
    <div class="cmdfoot"><span class="goalpill ${gc.cls}">${ic('target')}${gc.txt}</span></div></div>`;
}

/* ============ MORGEN ============ */
function renderMorning(){
  const m=(entry(cur).morning)||{};const sm=m.sleepMin??420;
  document.getElementById('morningForm').innerHTML=
    `<div class="field"><label>Schlaf-Dauer<span class="val" id="m_sleep_v"></span></label>
       <div class="sleepbig" id="sleepBig"></div>
       <input type="range" id="m_sleep" min="180" max="720" step="5" value="${sm}" oninput="sleepUpd()">
       <div class="scale"><span>3h</span><span>12h</span></div>
       <div class="stepbtns"><button type="button" onclick="sleepStep(-15)">– 15 min</button><button type="button" onclick="sleepStep(15)">+ 15 min</button></div></div>
     ${slider('m_sleepQ','Schlaf-Qualität',1,10,m.sleepQ??6)}
     <div class="row2">
       <div class="field"><label>Ruhepuls (bpm)</label><input type="number" inputmode="numeric" id="m_rhr" value="${m.rhr??''}" placeholder="58"></div>
       <div class="field"><label>Body Battery (%)</label><input type="number" inputmode="numeric" id="m_bb" value="${m.bb??''}" placeholder="70"></div></div>
     <div class="row2"><div class="field"><label>Gewicht (kg) nüchtern</label><input type="number" inputmode="decimal" id="m_weight" value="${m.weight??''}" placeholder="75"></div>
     <div class="field"><label>HRV (ms)</label><input type="number" inputmode="numeric" id="m_hrvMs" value="${m.hrvMs??''}" placeholder="z.B. 62"></div></div>
     ${chips('HRV-Status (Garmin)','m_hrv',['Good','Balanced','Low'],m.hrv?[m.hrv]:[])}
     ${chips('Stress-Level','m_stress',['Low','Med','High'],m.stress?[m.stress]:[])}
     ${slider('m_knee','Knie-Schmerz JETZT',0,10,m.knee??0,'kein','max')}
     ${slider('m_feel','Allg. Befinden',1,10,m.feel??7)}
     ${slider('m_legs','Kraft Beine',1,10,m.legs??7)}
     ${slider('m_ankle','Sprunggelenk Links',1,10,m.ankle??5,'tight','frei')}
     ${slider('m_doms','Muskelschmerz / DOMS',0,10,m.doms??2,'keine','stark')}`;
  initRanges();sleepUpd();
}
function sleepUpd(){const el=document.getElementById('m_sleep');const t=+el.value;const h=Math.floor(t/60),mm=t%60;
  document.getElementById('sleepBig').innerHTML=h+'<small>h</small> '+String(mm).padStart(2,'0')+'<small>min</small>';
  document.getElementById('m_sleep_v').textContent=h+'h '+String(mm).padStart(2,'0');
  el.style.setProperty('--p',((t-180)/(720-180)*100)+'%');}
function sleepStep(d){const el=document.getElementById('m_sleep');el.value=clamp(+el.value+d,180,720);sleepUpd();autoMorning();}
function gatherMorning(){return{sleepMin:+v('m_sleep'),sleepQ:+v('m_sleepQ'),
  rhr:numIn('m_rhr',...LIM.rhr),bb:numIn('m_bb',...LIM.bb),weight:numIn('m_weight',...LIM.weight),
  hrv:chipGet('m_hrv')[0]||'',hrvMs:numIn('m_hrvMs',...LIM.hrvMs),stress:chipGet('m_stress')[0]||'',
  knee:+v('m_knee'),feel:+v('m_feel'),legs:+v('m_legs'),ankle:+v('m_ankle'),doms:+v('m_doms'),ts:Date.now()};}
function autoMorning(){if(!document.getElementById('m_sleep'))return;entry(cur).morning=gatherMorning();save();renderReadiness();renderAmpel();renderCommand();}
function saveMorning(){entry(cur).morning=gatherMorning();save();renderReadiness();renderAmpel();renderCommand();toast('Gespeichert ✓');window.scrollTo({top:0,behavior:'smooth'});}

/* ============ READINESS + AMPEL ============ */
function renderReadiness(){const e=entry(cur);const out=document.getElementById('readyOut');
  if(!e.morning){out.innerHTML='';return;}
  const r=Calc.readiness(e.morning,recoveryCtx(cur));const C=2*Math.PI*52;const off=C*(1-r.score/100);
  const txt=r.band==='g'?'Bereit':r.band==='y'?'Moderat':'Erholung nötig';
  out.innerHTML=`<div class="card readycard">
    <svg class="ring" viewBox="0 0 120 120">
      <circle class="ringbg" cx="60" cy="60" r="52"></circle>
      <circle class="ringfg" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" style="stroke:${r.color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"></circle>
      <text x="60" y="56" text-anchor="middle" font-size="30" font-weight="800" fill="${r.color}">${r.score}</text>
      <text x="60" y="76" text-anchor="middle" font-size="11" font-weight="700" fill="#b8b4aa">READY</text>
    </svg>
    <div class="readyinfo"><div class="rscore">${r.score}%</div><div class="rband" style="color:${r.color}">${txt}</div>
      ${r.lim.length?`<div class="rlim">Limitiert durch: <b>${r.lim.join(', ')}</b></div>`:''}</div></div>`;
}
function warningsFor(m,ctx){
  const w=[];
  if(ctx.rhrBase!=null&&m.rhr!=null&&m.rhr-ctx.rhrBase>=5)w.push(`Ruhepuls +${(m.rhr-ctx.rhrBase).toFixed(0)} über 28T-Baseline (${ctx.rhrBase.toFixed(0)}) — Infekt/Overreaching prüfen.`);
  const p=prevMorning(cur);if(p&&m.knee>p.knee+0.5)w.push(`Knie-Schmerz <b>steigt</b> (${p.knee}→${m.knee}) — Belastung runter.`);
  if(m.sleepMin<360)w.push(`Schlaf ${(m.sleepMin/60).toFixed(1)}h — Regenerations-Defizit.`);
  if(ctx.sleepDebtH!=null&&ctx.sleepDebtH>=4)w.push(`Schlaf-Konto: −${ctx.sleepDebtH.toFixed(1)}h in 7 Tagen.`);
  if(m.ankle<=3)w.push('Sprunggelenk links sehr tight — Mobility heute Pflicht (Root-Cause Patella).');
  return w;
}
function prevMorning(date){let d=new Date(date+'T12:00');for(let i=1;i<=14;i++){d.setDate(d.getDate()-1);const k=todayStr(d);if(DB[k]&&DB[k].morning)return DB[k].morning;}return null;}
function renderAmpel(){const e=entry(cur);const out=document.getElementById('ampelOut');
  if(!e.morning){out.innerHTML='';return;}
  const ctx=recoveryCtx(cur);const r=Calc.readiness(e.morning,ctx);const a=Calc.ampel(e.morning,r,ctx);
  const w=warningsFor(e.morning,ctx);
  out.innerHTML=(w.length?`<div class="warn"><b>Trigger-Warnungen</b><ul>${w.map(x=>'<li>'+x+'</li>').join('')}</ul></div>`:'')+
    `<div class="amp ${a.c}"><div class="big">${a.t}</div><ul>${a.why.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><div class="rec"><b>Empfehlung heute:</b><br>${esc(a.rec)}</div></div>`;
}

/* ============ TRAINING (Post) ============ */
let _trash=null;
function renderTypeGrid(){document.getElementById('typeGrid').innerHTML=Object.keys(TYPES).map(t=>
  `<div class="typebtn${activeTypes.has(t)?' on':''}" onclick="toggleType('${t}')"><div class="ti">${TYPES[t].ic}</div><div class="tn">${t}</div><div class="tc">${activeTypes.has(t)?'✓ aktiv':TYPES[t].sub}</div></div>`).join('');}
function hasContent(o){return o&&Object.keys(o).some(k=>{const x=o[k];return x!=null&&x!==''&&!(Array.isArray(x)&&!x.length)&&k!=='rpe'&&k!=='perf'&&k!=='knee';});}
function toggleType(t){
  if(activeTypes.has(t)){
    const data=(entry(cur).sessions||{})[t];
    activeTypes.delete(t);
    if(hasContent(data)){_trash={date:cur,type:t,data};
      renderTypeGrid();renderPostBlocks();savePost(true);
      toastAction(t+' entfernt','Rückgängig',undoTrash);return;}
  } else activeTypes.add(t);
  renderTypeGrid();renderPostBlocks();savePost(true);
  if(t==='Gym')gymInterferenceCheck();
}
function undoTrash(){if(!_trash)return;const e=entry(_trash.date);e.sessions=e.sessions||{};e.sessions[_trash.type]=_trash.data;
  if(_trash.date===cur){activeTypes.add(_trash.type);renderTypeGrid();renderPostBlocks();}
  save();_trash=null;}
function gymInterferenceCheck(){
  const g=(entry(cur).sessions||{}).Gym;
  if(!Calc.heavyLegs(g))return;
  const wd=(new Date(cur+'T12:00').getDay()+6)%7;
  const tm=(WEEKPLAN[(wd+1)%7]||[]).find(p=>p.t==='Laufen'&&/Intervalle|Tempo|Long/.test(p.l));
  if(tm)toastAction('Schwere Beine <24h vor '+tm.l,'OK',()=>{});
}
function renderPostBlocks(){const ses=(entry(cur).sessions)||{};let html='';
  if(activeTypes.has('Laufen'))html+=blockRun(ses.Laufen||{});
  if(activeTypes.has('Gym'))html+=blockGym(ses.Gym||{});
  if(activeTypes.has('Rad'))html+=blockRad(ses.Rad||{});
  if(activeTypes.has('Schwimmen'))html+=blockSwim(ses.Schwimmen||{});
  if(activeTypes.has('Mobilität'))html+=blockMob(ses['Mobilität']||{});
  document.getElementById('postBlocks').innerHTML=html;initRanges();updRun();updRad();updSwim();}
function blockRun(d){return `<div class="sescard"><div class="seshead">${ic('run')}Laufen</div>
  ${chips('Typ','l_sub',['Walk-Run','Easy Z2','Tempo','Intervalle','Long Run'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (km)</label><input type="number" inputmode="decimal" id="l_dist" value="${d.dist??''}" placeholder="5" oninput="updRun()"></div>
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="l_dur" value="${d.dur??''}" placeholder="30" oninput="updRun()"></div></div>
  <div class="calc" id="l_calc"></div>
  <div class="row2" style="margin-top:14px"><div class="field"><label>Ø Herzfrequenz</label><input type="number" inputmode="numeric" id="l_hr" value="${d.hr??''}" placeholder="150"></div>
  <div class="field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="l_elev" value="${d.elev??''}" placeholder="opt."></div></div>
  <div class="row2"><div class="field"><label>HF min</label><input type="number" inputmode="numeric" id="l_hrmin" value="${d.hrmin??''}" placeholder="120"></div>
  <div class="field"><label>HF max</label><input type="number" inputmode="numeric" id="l_hrmax" value="${d.hrmax??''}" placeholder="185"></div></div>
  ${slider('l_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('l_perf','Leistung',1,10,d.perf??6)}
  ${slider('l_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="l_note" value="${esc(d.note)}" placeholder="Strecke / Gefühl..."></div></div>`;}
function blockGym(d){return `<div class="sescard"><div class="seshead">${ic('dumbbell')}Gym</div>
  ${chips('Fokus (mehrfach)','g_sub',['Ganzkörper','Oberkörper','Push','Pull','Core','Beine','Glute-Aktivierung','VMO/Rehab'],d.sub,true)}
  <div class="row2"><div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="g_dur" value="${d.dur??''}" placeholder="45"></div>
  <div class="field"><label>Sätze gesamt</label><input type="number" inputmode="numeric" id="g_sets" value="${d.sets??''}" placeholder="20"></div></div>
  ${slider('g_rpe','RPE (Anstrengung)',1,10,d.rpe??6,'leicht','max')}
  ${slider('g_perf','Leistung',1,10,d.perf??6)}
  ${slider('g_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="g_note" value="${esc(d.note)}" placeholder="z.B. Bench 4×8..."></div></div>`;}
function blockRad(d){return `<div class="sescard"><div class="seshead">${ic('bike')}Rad</div>
  ${chips('Typ','r_sub',['Commute','Easy Z2','Tempo Z3','Intervalle','Long Ride'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (km)</label><input type="number" inputmode="decimal" id="r_dist" value="${d.dist??''}" placeholder="30" oninput="updRad()"></div>
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="r_dur" value="${d.dur??''}" placeholder="60" oninput="updRad()"></div></div>
  <div class="calc" id="r_calc"></div>
  <div class="row2" style="margin-top:14px"><div class="field"><label>Ø Herzfrequenz</label><input type="number" inputmode="numeric" id="r_hr" value="${d.hr??''}" placeholder="135"></div>
  <div class="field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="r_elev" value="${d.elev??''}" placeholder="opt."></div></div>
  ${slider('r_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('r_perf','Leistung',1,10,d.perf??6)}
  ${slider('r_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="r_note" value="${esc(d.note)}" placeholder="flach / Wind..."></div></div>`;}
function blockSwim(d){return `<div class="sescard"><div class="seshead">${ic('swim')}Schwimmen</div>
  ${chips('Fokus','s_sub',['Brust-Technik','Kraul-Integration','Kraul','Mixed','Kick-Drills'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (m)</label><input type="number" inputmode="numeric" id="s_dist" value="${d.dist??''}" placeholder="800" oninput="updSwim()"></div>
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="s_dur" value="${d.dur??''}" placeholder="40" oninput="updSwim()"></div></div>
  <div class="calc" id="s_calc"></div>
  <div class="field" style="margin-top:14px"><label>Längste am Stück (m)</label><input type="number" inputmode="numeric" id="s_long" value="${d.long??''}" placeholder="200"></div>
  ${slider('s_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('s_perf','Gefühl/Technik',1,10,d.perf??5)}
  <div class="field" style="margin-bottom:0"><label>Technik-Notiz</label><input type="text" id="s_note" value="${esc(d.note)}" placeholder="Atmung / Gleitphase..."></div></div>`;}
function blockMob(d){return `<div class="sescard"><div class="seshead">${ic('stretch')}Mobilität</div>
  ${chips('Bereich (mehrfach)','mo_sub',['Sprunggelenk','Spanish Squats','Glute-Aktivierung','Stretching','Full Routine'],d.sub,true)}
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="mo_dur" value="${d.dur??''}" placeholder="15"></div>
  ${slider('mo_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="mo_note" value="${esc(d.note)}" placeholder="links extra..."></div></div>`;}
function updRun(){const el=document.getElementById('l_calc');if(!el)return;const di=numIn('l_dist',...LIM.runKm),du=numIn('l_dur',...LIM.runMin);
  el.textContent=(di&&du)?`Ø ${fmtPace(du*60/di)} /km`:'';}
function updRad(){const el=document.getElementById('r_calc');if(!el)return;const di=numIn('r_dist',...LIM.radKm),du=numIn('r_dur',...LIM.radMin);el.textContent=(di&&du)?`Ø ${(di/(du/60)).toFixed(1)} km/h`:'';}
function updSwim(){const el=document.getElementById('s_calc');if(!el)return;const di=numIn('s_dist',...LIM.swimM),du=numIn('s_dur',...LIM.swimMin);
  if(di&&du){const sp=du*60/(di/100);el.textContent=`Ø ${Math.floor(sp/60)}:${String(Math.round(sp%60)).padStart(2,'0')} /100m`;}else el.textContent='';}
function savePost(silent){const e=entry(cur);e.sessions=e.sessions||{};
  Object.keys(e.sessions).forEach(t=>{if(t!=='_ts'&&!activeTypes.has(t))delete e.sessions[t];});
  if(activeTypes.has('Laufen'))e.sessions.Laufen={sub:chipGet('l_sub')[0]||'',dist:numIn('l_dist',...LIM.runKm),dur:numIn('l_dur',...LIM.runMin),hr:numIn('l_hr',...LIM.hr),elev:numIn('l_elev',...LIM.elev),hrmin:numIn('l_hrmin',...LIM.hr),hrmax:numIn('l_hrmax',...LIM.hr),rpe:+v('l_rpe'),perf:+v('l_perf'),knee:+v('l_knee'),note:v('l_note')};
  if(activeTypes.has('Gym'))e.sessions.Gym={sub:chipGet('g_sub'),dur:numIn('g_dur',...LIM.gymMin),sets:numIn('g_sets',...LIM.sets),rpe:+v('g_rpe'),perf:+v('g_perf'),knee:+v('g_knee'),note:v('g_note')};
  if(activeTypes.has('Rad'))e.sessions.Rad={sub:chipGet('r_sub')[0]||'',dist:numIn('r_dist',...LIM.radKm),dur:numIn('r_dur',...LIM.radMin),hr:numIn('r_hr',...LIM.hr),elev:numIn('r_elev',...LIM.elev),rpe:+v('r_rpe'),perf:+v('r_perf'),knee:+v('r_knee'),note:v('r_note')};
  if(activeTypes.has('Schwimmen'))e.sessions.Schwimmen={sub:chipGet('s_sub')[0]||'',dist:numIn('s_dist',...LIM.swimM),dur:numIn('s_dur',...LIM.swimMin),long:numIn('s_long',...LIM.swimM),rpe:+v('s_rpe'),perf:+v('s_perf'),note:v('s_note')};
  if(activeTypes.has('Mobilität'))e.sessions['Mobilität']={sub:chipGet('mo_sub'),dur:numIn('mo_dur',...LIM.mobMin),knee:+v('mo_knee'),note:v('mo_note')};
  e.sessions._ts=Date.now();save();renderCommand();
  if(!silent)toast(activeTypes.size?activeTypes.size+' Einheit(en) gespeichert ✓':'Keine Einheit gewählt');}
function autoPost(){savePost(true);}

/* ============ ROUTINEN & SUPPLEMENTS ============ */
function renderRoutines(){const r=(entry(cur).routines)||{};
  document.getElementById('routineChips').innerHTML=ROUTINES.map(([k,lab])=>`<button type="button" class="chip gn${r[k]?' on':''}" onclick="toggleRoutine('${k}',this)">${lab}</button>`).join('');
  document.getElementById('ssRepsIn').value=r.ssReps??'';
  renderSupps();}
function toggleRoutine(k,btn){const e=entry(cur);e.routines=e.routines||{};e.routines[k]=e.routines[k]?0:1;btn.classList.toggle('on');save();}
function toggleSub(s,btn){const e=entry(cur);e.subs=e.subs||[];const i=e.subs.indexOf(s);if(i>=0)e.subs.splice(i,1);else e.subs.push(s);if(btn)btn.classList.toggle('on');save();}
let stackEdit=false,browseOpen=false;
function getStack(){return DB._stack||(DB._stack=[]);}
function allSupps(){return [].concat(...Object.values(SUB_CATS));}
function suppRecs(){
  const e=entry(cur);const m=e.morning||{};const ev=e.eve||{};
  const wd=(new Date(cur+'T12:00').getDay()+6)%7;const plan=WEEKPLAN[wd]||[];const out=[];
  out.push({n:'Vitamin D3',why:'Basis im Norden — 1000–4000 IE zum Essen'});
  out.push({n:'Omega-3 (EPA/DHA)',why:'Entzündungsmodulation & Herz — 1–2g täglich'});
  out.push({n:'Kreatin',why:'3–5g täglich, Timing egal'});
  const run=plan.find(p=>p.t==='Laufen');
  if(run&&/Intervalle|Tempo/.test(run.l))out.push({n:'Koffein',why:run.l+' heute — 3–6mg/kg, 45–60min vorher'});
  if(run&&/Long/.test(run.l))out.push({n:'Elektrolyte/Natrium',why:'Long Run heute — Natrium ersetzen'});
  if(run||plan.find(p=>p.t==='Rad'))out.push({n:'Kollagen + Vit C',why:'15g + Vit C ~1h vor der Einheit — Sehnen-Support'});
  if(m.sleepQ!=null&&m.sleepQ<=5)out.push({n:'Magnesium-Glycinat',why:'Schlafqualität '+m.sleepQ+'/10 — heute Abend 300–400mg'});
  else out.push({n:'Magnesium-Glycinat',why:'Abends — Schlaf & Muskelfunktion'});
  if((WEEKPLAN[(wd+1)%7]||[]).find(p=>p.t==='Schwimmen'))out.push({n:'Melatonin',why:'Morgen früher Schwimmtag — 0,5–1mg vor dem Schlaf'});
  if(ev.prot!=null&&ev.prot<150)out.push({n:'Whey/Protein',why:'Erst '+ev.prot+'g — Lücke zum 150g-Ziel schließen'});
  else out.push({n:'Whey/Protein',why:'Baustein fürs 150–165g-Ziel'});
  if(m.hrv==='Low'||Calc.hrvScoreOf(m,recoveryCtx(cur))===25)out.push({n:'L-Theanin',why:'HRV gedrückt — beruhigend; Koffein heute meiden'});
  const seen=new Set();return out.filter(r=>!seen.has(r.n)&&seen.add(r.n));
}
function renderSupps(){
  const subs=(entry(cur).subs)||[];const stack=getStack();
  document.getElementById('recBox').innerHTML=`<div class="slot">Für heute empfohlen</div>`+suppRecs().map(r=>{const on=subs.includes(r.n);
    return `<div class="stackitem rec${on?' on':''}" onclick="toggleSub('${jsArg(r.n)}');renderSupps()">
      <div class="check">${on?'✓':''}</div><div><div class="sname">${esc(r.n)}</div><div class="sdose">${esc(r.why)}</div></div></div>`;}).join('');
  let html='';
  if(stack.length){
    SLOTS.forEach(slot=>{const items=stack.filter(x=>x.timing===slot);if(!items.length)return;
      html+=`<div class="slot">${slot}</div>`;
      items.forEach(it=>{const on=subs.includes(it.name);
        html+=`<div class="stackitem${on?' on':''}" onclick="toggleSub('${jsArg(it.name)}');renderSupps()">
          <div class="check">${on?'✓':''}</div>
          <div><div class="sname">${esc(it.name)}</div>${it.dose?`<div class="sdose">${esc(it.dose)}</div>`:''}</div>
          ${stackEdit?`<span class="del" onclick="event.stopPropagation();delStack('${jsArg(it.name)}','${jsArg(it.timing)}')">✕</span>`:''}</div>`;});});
  }else html+=`<p class="muted" style="margin:10px 0">Noch kein Stack angelegt. Tippe „Stack bearbeiten“ und füge feste Supplements hinzu — auch eigene, frei benannte.</p>`;
  html+=`<div style="margin-top:10px;display:flex;gap:10px">
    <button class="chip" onclick="stackEdit=!stackEdit;renderSupps()">${stackEdit?'Fertig ✓':'Stack bearbeiten'}</button>
    <button class="chip" onclick="browseOpen=!browseOpen;renderBrowse()" id="browseBtn">${browseOpen?'Schließen':'+ Einmalig genommen'}</button></div>`;
  if(stackEdit){
    html+=`<div class="addrow">
      <input id="addName" list="suppDatalist" placeholder="Eigenes Supplement…">
      <datalist id="suppDatalist">${allSupps().map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
      <input id="addDose" placeholder="Dosis">
      <select id="addTiming">${SLOTS.map(s=>`<option>${s}</option>`).join('')}</select>
      <button onclick="addStack()">+</button></div>`;}
  document.getElementById('stackBox').innerHTML=html;
  renderBrowse();
}
function addStack(){const name=v('addName').trim(),dose=v('addDose'),timing=v('addTiming');if(!name)return;
  const st=getStack();if(!st.find(x=>x.name===name&&x.timing===timing))st.push({name,dose,timing});save();renderSupps();}
function delStack(name,timing){DB._stack=getStack().filter(x=>!(x.name===name&&x.timing===timing));save();renderSupps();}
function renderBrowse(){const subs=(entry(cur).subs)||[];const el=document.getElementById('subBrowse');
  const bb=document.getElementById('browseBtn');if(bb)bb.textContent=browseOpen?'Schließen':'+ Einmalig genommen';
  el.innerHTML=browseOpen?
    Object.entries(SUB_CATS).map(([cat,items])=>`<div class="subcat">${cat}</div><div class="chips">`+
      items.map(s=>`<button type="button" class="chip gn${subs.includes(s)?' on':''}" onclick="toggleSub('${jsArg(s)}',this)">${esc(s)}</button>`).join('')+`</div>`).join(''):'';
}
function bindReps(){document.getElementById('ssRepsIn').onchange=()=>{const e=entry(cur);e.routines=e.routines||{};e.routines.ssReps=numIn('ssRepsIn',...LIM.reps);save();};}
/* Lexikon (Bottom-Sheet) */
function openSuppList(){document.getElementById('suppSheet').innerHTML=
  `<div class="sheethead"><h2>${ic('pill')}Supplement-Lexikon</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>
   <p class="muted" style="margin:0 0 12px">Tippe ein Mittel für Erklärung + individuelle Einschätzung.</p>
   <input class="searchbox" placeholder="Suchen…" oninput="renderSuppBody(this.value)">
   <div id="suppListBody"></div>`;
  renderSuppBody('');document.getElementById('suppModal').classList.add('show');}
function renderSuppBody(q){q=(q||'').toLowerCase();let html='';
  Object.entries(SUB_CATS).forEach(([cat,items])=>{const fil=items.filter(s=>s.toLowerCase().includes(q));if(!fil.length)return;
    html+=`<div class="scat">${cat}</div>`;
    fil.forEach(s=>{const m=vmeta((SUPP_INFO[s]||{}).v||2);html+=`<div class="suppli" onclick="openSuppDetail('${jsArg(s)}')"><span style="font-weight:600">${esc(s)}</span><span class="vb ${m.c}">${m.t}</span></div>`;});});
  document.getElementById('suppListBody').innerHTML=html||'<p class="muted">Nichts gefunden.</p>';}
function openSuppDetail(name){const i=SUPP_INFO[name]||{};const m=vmeta(i.v||2);
  document.getElementById('suppSheet').innerHTML=
   `<div class="sheethead"><button class="xbtn" onclick="openSuppList()">‹</button><button class="xbtn" onclick="closeSupp()">✕</button></div>
    <div class="suppdetail"><h3>${esc(name)}</h3><span class="vb ${m.c}">${m.t}</span>
      <div class="lbl">Wirkung</div><p>${i.w||'–'}</p>
      <div class="lbl">Evidenz</div><p>${i.e||'–'}</p>
      <div class="lbl">Dosis &amp; Timing</div><p>${i.d||'–'}</p>
      <div class="lbl">Für dich, Gian</div><div class="foryou">${i.f||'–'}</div></div>`;}
function closeSupp(){document.getElementById('suppModal').classList.remove('show');}

/* ============ ABEND ============ */
function renderEve(){const e=(entry(cur).eve)||{};
  document.getElementById('eveForm').innerHTML=
    `${slider('e_knee','Knie JETZT (Abend)',0,10,e.knee??0,'kein','max')}
     ${slider('e_energy','Tagesenergie',1,10,e.energy??6)}
     <div class="row2"><div class="field"><label>Protein (g) · Ziel 150–165</label><input type="number" inputmode="numeric" id="e_prot" value="${e.prot??''}" placeholder="160"></div>
     <div class="field"><label>Hydration (Liter)</label><input type="number" inputmode="decimal" id="e_hydL" value="${e.hydL??''}" placeholder="3.0"></div></div>
     ${chips('Kohlenhydrate adäquat?','e_carbs',['ja','ok','nein'],e.carbs?[e.carbs]:[])}
     ${slider('e_sleepExp','Schlaf-Erwartung',1,10,e.sleepExp??7)}
     ${slider('e_mood','Stimmung morgen',1,10,e.mood??7)}
     <div class="field" style="margin-bottom:0"><label>Tagesnotiz</label><input type="text" id="e_note" value="${esc(e.note)}" placeholder="Was war heute wichtig?"></div>`;
  initRanges();}
function gatherEve(){return{knee:+v('e_knee'),energy:+v('e_energy'),prot:numIn('e_prot',...LIM.prot),carbs:chipGet('e_carbs')[0]||'',hydL:numIn('e_hydL',...LIM.hydL),sleepExp:+v('e_sleepExp'),mood:+v('e_mood'),note:v('e_note'),ts:Date.now()};}
function autoEve(){if(!document.getElementById('e_knee'))return;entry(cur).eve=gatherEve();save();}
function saveEve(){entry(cur).eve=gatherEve();save();toast('Abend gespeichert ✓');}

/* ============ BANNERS ============ */
function renderBanners(){const out=document.getElementById('banners');let html='';
  if(DB._corrupt){
    html+=`<div class="banner err">${ic('info')}<span><b>Gespeicherte Daten waren beschädigt.</b> Eine Rettungskopie liegt im Browser-Speicher. Backup importieren oder leer weiterstarten.</span>
      <button onclick="document.getElementById('importFile').click()">Import</button>
      <button onclick="resolveCorrupt();renderDay()">Leer starten</button></div>`;
    out.innerHTML=html;return;
  }
  if(saveFailed)html+=`<div class="banner err">${ic('save')}<span><b>Speichern fehlgeschlagen</b> (Speicher voll oder privater Modus). Jetzt Backup ziehen!</span><button onclick="exportData()">Backup</button></div>`;
  const e=DB[todayStr()];const hr=new Date().getHours();
  if(cur===todayStr()&&hr>=9&&hr<21&&(!e||!e.morning))
    html+=`<div class="banner info">${ic('sun')}<span>Morgen-Check-in fehlt noch — 2 Minuten, dann gibt's deine Ampel.</span></div>`;
  const lb=DB._lastBackup;const nDays=Object.keys(DB).filter(isDay).length;
  if(nDays>=5&&(!lb||Date.now()-lb>7*864e5))
    html+=`<div class="banner warn2">${ic('save')}<span>${lb?'Backup älter als 7 Tage':'Noch kein Backup'} — Daten liegen nur im Browser.</span><button onclick="exportData();renderBanners()">Sichern</button></div>`;
  out.innerHTML=html;}

/* ============ ZENTRALE TAG-LOGIK ============ */
/* relativer Tagestitel: Heute / Gestern / Morgen / Wochentag */
function relDayTitle(d){
  const diff=Math.round((new Date(d+'T00:00')-new Date(todayStr()+'T00:00'))/864e5);
  if(diff===0)return 'Heute';
  if(diff===-1)return 'Gestern';
  if(diff===1)return 'Morgen';
  return new Date(d+'T12:00').toLocaleDateString('de-DE',{weekday:'long'});
}
/* Daily Motivation — pro Datum stabil (deterministisch, springt bei Reload nicht) */
const MOTIV=[
  'Know your state. Move with precision.',
  'Small decisions. Compounded performance.',
  'Today is not about intensity. It is about precision.',
  'Move smart. Recover harder. Build long-term.',
  "Execute the day. Don't negotiate with noise.",
  'Consistency beats intensity over a season.',
  'Recovery is training you cannot skip.',
  'Precision today. Progress tomorrow.'
];
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
function renderMotivation(){const el=document.getElementById('motivation');if(!el)return;
  const q=MOTIV[hashStr(cur)%MOTIV.length];
  el.innerHTML=`<div class="motiv">${ic('zap')}<span>${q}</span></div>`;}

/* ============ TAG RENDERN / NAVIGATION ============ */
function renderDay(){const hr=new Date().getHours();const today=cur===todayStr();
  document.getElementById('dayTitle').textContent=relDayTitle(cur);
  document.getElementById('greet').textContent=today?(hr<11?'Guten Morgen':hr<18?'Hi':'Guten Abend'):'Ausgewählter Tag';
  document.getElementById('dateLabel').textContent=fmtDate(cur);
  document.getElementById('nextDay').style.visibility=(cur>=todayStr())?'hidden':'visible';
  const tb=document.getElementById('todayBtn');if(tb)tb.style.display=today?'none':'inline-flex';
  activeTypes=new Set(Object.keys((entry(cur).sessions)||{}).filter(k=>k!=='_ts'));
  renderMotivation();renderBanners();renderCommand();renderMorning();renderReadiness();renderAmpel();
  if(typeof renderInsights==='function')renderInsights();
  if(typeof renderModules==='function')renderModules();
  if(typeof renderQuickActions==='function')renderQuickActions();
  renderTypeGrid();renderPostBlocks();renderRoutines();renderEve();bindReps();}
function shiftDay(n){flushAuto();const d=new Date(cur+'T12:00');d.setDate(d.getDate()+n);const k=todayStr(d);if(k>todayStr())return;cur=k;renderDay();window.scrollTo(0,0);}
function goToday(){flushAuto();cur=todayStr();renderDay();window.scrollTo(0,0);}

/* ============ PLAN ============ */
function cdHTML(){const d=daysTo(RACE.date);return `<div class="cd"><div><div class="num">${d}</div><div class="lab">Tage</div></div>
  <div><div style="font-weight:800;font-size:15px">${ic('flag')}${RACE.name}</div><div class="ph">06.09.2026 · ${Calc.racePhase(d)}</div></div></div>`;}
function renderPhases(){const t=todayStr();const fmt=s=>new Date(s+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
  document.getElementById('phaseBox').innerHTML=PHASES.map(p=>{const on=t>=p.from&&t<=p.to;
    return `<div class="phase${on?' on':''}"><div><b>${p.n}${on?' · jetzt':''}</b><div style="font-size:12px;color:var(--mut)">${p.d}</div></div><span class="pr">${fmt(p.from)}–${fmt(p.to)}</span></div>`;}).join('');}
function renderRamp(){
  const d=daysTo(RACE.date);
  const cal=Calc.weekKmTarget(d,0);
  const eff=Calc.effectiveKmTarget(cal,[weekRunKm(1),weekRunKm(2),weekRunKm(3)]);
  const act=weekRunKm(0);const pct=eff?Math.min(100,act/eff*100):0;
  const deload=eff<cal;
  let next='';for(let i=1;i<=3;i++){const t2=Calc.weekKmTarget(d,i);if(t2<=0)break;
    next+=`<div class="weekrow"><span>In ${i} Woche${i>1?'n':''}</span><b>~${t2} km${Calc.weekKmTarget(d,i)<Calc.weekKmTarget(d,i-1)&&i<3?' · Entlastung':''}</b></div>`;}
  document.getElementById('rampBox').innerHTML=
    `<div class="goal"><div class="goalhead"><span>Diese Woche${deload?' · gedeckelt (Ist-Kopplung)':''}</span><span>${act.toFixed(1)} / ${eff} km</span></div>
     <div class="goalbar"><i class="${act>=eff?'done':''}" style="width:${pct}%"></i></div></div>
     ${deload?`<p class="note" style="text-align:left">Kalenderziel wäre ${cal} km — gedeckelt auf +10% über deinem 3-Wochen-Maximum. Erst Basis, dann Rampe.</p>`:''}
     <div style="margin-top:12px">${next}</div>
     <p class="note" style="text-align:left;margin-top:8px">Richtwerte mit Entlastungswochen. Bei Knie-Reaktion oder roter Ampel hat Erholung Vorrang.</p>`;}
function renderWeekPlan(){
  const goal=buildGoal();
  document.getElementById('runnaSub').textContent='Runna-Plan · Woche '+Calc.runnaWeek(daysTo(RACE.date))+'/25 — wird automatisch abgehakt, sobald du loggst.';
  const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);
  const ref=(goal.state!=='nodata'?goal.tPred:DB._hmTargetMin||110);const rp=ref*60/Calc.HM_KM;
  const pd={iv:fmtPace(rp*0.90)+'–'+fmtPace(rp*0.94)+' /km',ez:fmtPace(rp*1.18)+'–'+fmtPace(rp*1.30)+' /km',lr:fmtPace(rp*1.10)+'–'+fmtPace(rp*1.18)+' /km'};
  let html='';for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const k=todayStr(d);const e=DB[k];const isToday=k===todayStr();
    const items=WEEKPLAN[i].map(it=>{const done=e&&e.sessions&&e.sessions[it.t];const det=pd[it.d]||it.d;
      return `<div class="pitem"><span class="pic">${TYPES[it.t].ic}</span><span><span class="pl">${it.l}</span> <span class="pdt">· ${det}</span></span>${done?'<span class="pchk">✓</span>':''}</div>`;}).join('');
    html+=`<div class="pday${isToday?' today':''}"><div class="pd">${DAYNAMES[i]} ${d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}${isToday?' · HEUTE':''}</div>${items}</div>`;}
  document.getElementById('weekPlanBox').innerHTML=html;}
function renderGoals(){const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);
  const counts={};for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const e=DB[todayStr(d)];if(!e||!e.sessions)continue;
    Object.keys(e.sessions).forEach(t=>{if(t!=='_ts')counts[t]=(counts[t]||0)+1;});}
  document.getElementById('goalBox').innerHTML=WEEK_TARGETS.map(([key,tgt,icon])=>{
    const c=counts[key]||0;const pct=Math.min(100,c/tgt*100);
    return `<div class="goal"><div class="goalhead"><span>${ic(icon)}${key}</span><span>${c} / ${tgt}</span></div>
      <div class="goalbar"><i class="${c>=tgt?'done':''}" style="width:${pct}%"></i></div></div>`;}).join('');}
function setHmTarget(){const t=numIn('hmTarget',60,240);if(t){DB._hmTargetMin=t;save();_goalCache=null;}renderPace();}
function renderPace(){
  const t=DB._hmTargetMin||110;
  const inp=document.getElementById('hmTarget');if(inp&&document.activeElement!==inp)inp.value=t;
  const goal=buildGoal();
  const ref=goal.state!=='nodata'?goal.tPred:t;
  const rpT=t*60/Calc.HM_KM, rp=ref*60/Calc.HM_KM;
  const zone=(lab,lo,hi)=>`<div class="pace"><span>${lab}</span><b>${fmtPace(lo)}${hi?'–'+fmtPace(hi):''} /km</b></div>`;
  let html=`<div class="pace hero"><span><b>Ziel-Pace</b> · ${Calc.fmtTime(t)}</span><b>${fmtPace(rpT)} /km</b></div>`;
  if(goal.state!=='nodata')html+=`<div class="pace"><span>Aktuelle Fitness (Prognose ${Calc.fmtTime(goal.tPred)})</span><b>${fmtPace(rp)} /km</b></div>`;
  html+=zone('Easy / Z2',rp*1.18,rp*1.30)+zone('Long Run',rp*1.10,rp*1.18)
    +zone('Tempo',rp*0.97,rp*1.02)+zone('Intervalle (1km)',rp*0.90,rp*0.94);
  html+=`<p class="note" style="text-align:left">${goal.state!=='nodata'
    ?'Trainings-Zonen sind an deiner <b>aktuellen Fitness</b> verankert (nicht am Wunschziel) — das schützt vor systematischem Zu-schnell-Laufen.'
    :'Noch keine Fitness-Prognose — Zonen basieren vorerst auf der Zielzeit. '+ (goal.need||'')}</p>`;
  document.getElementById('paceBox').innerHTML=html;}
function renderPlan(){flushAuto();document.getElementById('cdPlan').innerHTML=cdHTML();renderPhases();renderRamp();renderWeekPlan();renderGoals();renderPace();}

/* ============ ANALYTICS (Segmente) ============ */
let dashRange=14,seg='ueber';
function setRange(n){dashRange=n;renderDash();}
function setSeg(s){seg=s;renderDash();window.scrollTo(0,0);}
function series(days){const out=[];for(let i=days-1;i>=0;i--){const k=dkey(-i);out.push({k,e:DB[k]||null});}return out;}
function renderDash(){
  flushAuto();
  if(typeof renderIntel==='function')renderIntel();
  if(typeof renderProExtras==='function')renderProExtras();
  document.getElementById('dashSegs').innerHTML=[['ueber','Überblick'],['ausdauer','Ausdauer'],['erholung','Erholung'],['koerper','Körper']]
    .map(([k,l])=>`<button class="${seg===k?'on':''}" onclick="setSeg('${k}')">${l}</button>`).join('');
  ['ueber','ausdauer','erholung','koerper'].forEach(s=>document.getElementById('seg-'+s).classList.toggle('hide',s!==seg));
  const showRange=seg==='erholung'||seg==='koerper';
  document.getElementById('rangeTabs').style.display=showRange?'flex':'none';
  if(showRange)document.getElementById('rangeTabs').innerHTML=[7,14,30,90].map(n=>`<button class="${n===dashRange?'on':''}" onclick="setRange(${n})">${n}T</button>`).join('');
  document.getElementById('chartWarn').innerHTML=chartOK()?'':'<div class="banner warn2">Charts brauchen einmalig Internet — die Bibliothek wird danach offline gecacht.</div>';
  if(seg==='ueber')renderSegUeber();else if(seg==='ausdauer')renderSegAusdauer();else if(seg==='erholung')renderSegErholung();else renderSegKoerper();
}
function kpi(n,l,col){return `<div class="k"><div class="n" style="color:${col||'var(--txt)'}">${n}</div><div class="l">${l}</div></div>`}
/* --- Überblick --- */
function renderSegUeber(){
  const S=series(14);const ready=S.map(s=>readinessOf(s.k));
  const last=[...S].reverse().find(s=>s.e&&s.e.morning);
  const r7=avg(ready.slice(-7));
  const goal=buildGoal();
  const lastR=last?readinessFor(last.k):null;
  document.getElementById('kpiBox').innerHTML=
    kpi(lastR&&lastR.score!==''?lastR.score+'%':'–','Readiness',lastR&&lastR.color)+
    kpi(r7!=null?Math.round(r7)+'%':'–','Ø Ready 7T')+
    kpi(last?last.e.morning.knee:'–','Knie heute',last?(last.e.morning.knee<=2?'var(--green)':last.e.morning.knee>=6?'var(--red)':'var(--yellow)'):'')+
    kpi(weekRunKm(0).toFixed(0),'km diese Wo.')+
    kpi(goal.state!=='nodata'?Calc.fmtTime(goal.tPred):'–','HM-Prognose',goal.state==='ontrack'?'var(--green)':goal.state==='border'?'var(--yellow)':goal.state==='risk'?'var(--red)':'')+
    kpi((()=>{const p=[];for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.eve&&e.eve.prot!=null)p.push(e.eve.prot);}const a=avg(p);return a!=null?Math.round(a)+'g':'–';})(),'Ø Protein 7T');
  renderGoalCard('goalDetail');
  renderInsights();renderACWRCard();renderStreaks();renderHeat();renderBadges();renderWeek();
  const ld=allLoads();
  drawForm('cForm',ld.loads,ld.labels);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  drawBarLine('cLoad',labels,{label:'Last (AU)',data:S.map(s=>Calc.sessionLoad(s.e)||null),color:'#c9ae7c'},{label:'Readiness %',data:ready,color:'#16a34a'},{maxY2:100});
}
function renderGoalCard(elId){
  const g=buildGoal();const el=document.getElementById(elId);if(!el)return;
  if(g.state==='nodata'){el.innerHTML=`<div class="rtr" style="background:linear-gradient(135deg,#2a3342,#1a2330)">
    <h2 style="color:#fff;margin-bottom:8px">${ic('target')}HM-Ziel &lt;${Calc.fmtTime(DB._hmTargetMin||110)}</h2>
    <div style="font-size:14px;line-height:1.5">Noch keine belastbare Prognose. Nötig: ${g.need}. Aktuell: ${g.nRuns} Läufe, ${g.nQuality} Quality.</div></div>`;return;}
  const bg=g.state==='ontrack'?'linear-gradient(135deg,#0e9f6e,#056649)':g.state==='border'?'linear-gradient(135deg,#d97706,#92500a)':'linear-gradient(135deg,#e8345c,#9f1239)';
  const lab=g.state==='ontrack'?'ON TRACK':g.state==='border'?'GRENZWERTIG':'GEFÄHRDET';
  el.innerHTML=`<div class="rtr" style="background:${bg}">
    <h2 style="color:#fff;margin-bottom:8px">${ic('target')}Goal Engine · ${lab}</h2>
    <div style="font-size:14px;line-height:1.6">Prognose: <b>${Calc.fmtTime(g.tPred)}</b> (Riegel ${Calc.fmtTime(g.tRiegel)}${g.tEF?' · EF-Check '+Calc.fmtTime(g.tEF):''}) · Ziel ${Calc.fmtTime(g.target)} · Puffer ${g.delta>0?'+':''}${g.delta}%<br>
    ${g.vetos.length?'<b>Engpässe:</b> '+g.vetos.map(esc).join(' · '):'Alle Volumen-Gates erfüllt.'}<br>
    <span style="opacity:.85;font-size:12px">Basis: ${g.nRuns} Läufe / ${g.nQuality} Quality in 42T. Riegel-Exponent 1,06; EF nur aus Easy-Z2.</span></div></div>`;
}
function renderACWRCard(){
  const ld=allLoads();const a=Calc.acwr(ld.loads.slice(-42));
  let bg,txt,desc;
  if(!a.enough){bg='linear-gradient(135deg,#2a3342,#1a2330)';txt='–';desc='Lastsprung-Indikator erscheint nach ≥21 Tagen Trainingshistorie.';}
  else if(a.ratio<0.8){bg='linear-gradient(135deg,#0ea5e9,#0369a1)';txt=a.ratio;desc='Akute Last unter Kapazität — Spielraum zum kontrollierten Aufbauen.';}
  else if(a.ratio<=1.3){bg='linear-gradient(135deg,#0e9f6e,#056649)';txt=a.ratio;desc='Optimaler Korridor (0,8–1,3) — Belastung und Kapazität im Gleichgewicht.';}
  else if(a.ratio<=1.5){bg='linear-gradient(135deg,#d97706,#92500a)';txt=a.ratio;desc='Erhöht — du steigerst schneller als die Basis mitwächst. Plateau halten.';}
  else{bg='linear-gradient(135deg,#e8345c,#9f1239)';txt=a.ratio;desc='Deutlicher Lastsprung (>1,5) — genau dieses Muster ging deiner Patella-Reizung voraus. Last senken.';}
  document.getElementById('acwrBox').innerHTML=`<div class="acwr" style="background:${bg}"><div class="al">Lastsprung-Indikator · ACWR (EWMA)</div><div class="ar">${txt}</div><div class="ad">${desc}${a.enough?`<br><span style="opacity:.8;font-size:12px">Akut: ${a.acute} AU · Chronisch: ${a.chronic} AU/Wo</span>`:''}</div></div>`;}
function renderInsights(){const days=Object.keys(DB).filter(isDay).sort();let out=[];
  let mq=[],nq=[];days.forEach(k=>{const e=DB[k];if(e.morning&&e.morning.sleepQ!=null){((e.subs||[]).includes('Melatonin')?mq:nq).push(e.morning.sleepQ);}});
  if(mq.length>=3&&nq.length>=3){const d=avg(mq)-avg(nq);if(Math.abs(d)>=0.5)out.push(`Mit <b>Melatonin</b> ist deine Schlafqualität ${d>0?'+':''}${d.toFixed(1)} Punkte ${d>0?'höher':'niedriger'} (${avg(mq).toFixed(1)} vs ${avg(nq).toFixed(1)}).`);}
  let lo=[],hi=[];for(let i=1;i<days.length;i++){const p=DB[days[i-1]],c=DB[days[i]];if(p&&p.morning&&p.morning.sleepMin!=null&&c&&c.morning&&c.morning.knee!=null)(p.morning.sleepMin<420?lo:hi).push(c.morning.knee);}
  if(lo.length>=3&&hi.length>=3){const d=avg(lo)-avg(hi);if(Math.abs(d)>=0.4)out.push(`Nach Nächten <b>&lt;7h</b> ist dein Knie am Folgetag ${d>0?'+':''}${d.toFixed(1)} ${d>0?'höher':'niedriger'}.`);}
  let lh=[],ll=[];for(let i=1;i<days.length;i++){const p=DB[days[i-1]],c=DB[days[i]];if(p&&c&&c.morning&&c.morning.knee!=null)(Calc.sessionLoad(p)>=300?lh:ll).push(c.morning.knee);}
  if(lh.length>=3&&ll.length>=3){const d=avg(lh)-avg(ll);if(Math.abs(d)>=0.4)out.push(`Nach <b>hoher Last</b> (≥300 AU) ist dein Knie am Folgetag ${d>0?'+':''}${d.toFixed(1)} ${d>0?'höher':'niedriger'}.`);}
  const pd=days.map(k=>DB[k]).filter(e=>e.eve&&e.eve.prot!=null);if(pd.length>=3){const hit=pd.filter(e=>e.eve.prot>=150).length;out.push(`Protein-Ziel (≥150g) an <b>${hit}/${pd.length}</b> erfassten Tagen erreicht.`);}
  document.getElementById('insightBox').innerHTML=out.length?out.map(x=>`<div class="insight">${x}</div>`).join(''):'<p class="muted">Mehr Daten nötig — Insights erscheinen nach ~1 Woche Tracking.</p>';}
function streak(pred){let n=0;for(let i=0;i<400;i++){const e=DB[dkey(-i)];if(i===0&&!pred(e))continue;if(pred(e))n++;else break;}return n;}
function renderStreaks(){
  const ci=streak(e=>e&&e.morning);const ss=streak(e=>e&&e.routines&&e.routines.ss);const mo=streak(e=>e&&e.routines&&e.routines.mob);
  document.getElementById('streakBox').innerHTML=
    `<div class="streak"><div class="sn">${ci}</div><div class="sl">Check-in</div></div>
     <div class="streak"><div class="sn">${ss}</div><div class="sl">Spanish Squats</div></div>
     <div class="streak"><div class="sn">${mo}</div><div class="sl">Mobilität</div></div>`;}
function heatColor(k,e){const s=readinessOf(k);if(s==null)return (e&&e.sessions&&Object.keys(e.sessions).filter(x=>x!=='_ts').length)?'#1a2330':'#121a26';
  return s>=75?'#34d399':s>=60?'#1f8a66':s>=45?'#8a6d1f':'#7a2b3d';}
function renderHeat(){const today=new Date(todayStr()+'T12:00');let start=new Date(today);start.setDate(start.getDate()-83);
  const wd=(start.getDay()+6)%7;start.setDate(start.getDate()-wd);
  let html='';for(let d=new Date(start);d<=today;d.setDate(d.getDate()+1)){const k=todayStr(d);const e=DB[k];
    html+=`<div class="heatcell" style="background:${heatColor(k,e)}" title="${k}"></div>`;}
  document.getElementById('heatBox').innerHTML=html;}
function renderBadges(){const days=Object.keys(DB).filter(isDay);
  const last7=[];for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.knee!=null)last7.push(e.morning.knee);}
  const B=[
    {ic:ic('swim'),t:'Erste 200m am Stück',d:'Schwimmen',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Schwimmen&&(DB[k].sessions.Schwimmen.long||0)>=200)},
    {ic:ic('stretch'),t:'14-Tage Mobility',d:'Streak ≥14',on:streak(e=>e&&e.routines&&e.routines.mob)>=14},
    {ic:ic('pulse'),t:'Knie 7T <2',d:'7 Tage stabil',on:last7.length>=7&&Math.max(...last7)<2},
    {ic:ic('calendar'),t:'30 Check-ins',d:'Konsistenz',on:days.filter(k=>DB[k].morning).length>=30},
    {ic:ic('bike'),t:'30 km Ride',d:'Distanz',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Rad&&(DB[k].sessions.Rad.dist||0)>=30)},
    {ic:ic('dumbbell'),t:'14-Tage Squats',d:'Reha-Disziplin',on:streak(e=>e&&e.routines&&e.routines.ss)>=14},
    {ic:ic('run'),t:'Comeback-Lauf',d:'Erster Lauf geloggt',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Laufen)},
    {ic:ic('flag'),t:'10 km am Stück',d:'Lauf-Distanz',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Laufen&&(DB[k].sessions.Laufen.dist||0)>=10)}];
  document.getElementById('badgeBox').innerHTML=B.map(b=>`<div class="badge${b.on?' on':''}"><div class="bi">${b.ic}</div><div><div class="bt">${b.t}</div><div class="bd">${b.d}</div></div></div>`).join('');}
function renderWeek(){const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);
  let gym=0,rad=0,radKm=0,swim=0,swimM=0,mob=0,run=0,runKm=0,knee=[],sleeps=[],bbs=[],protOk=0,prots=0,ss=0,mobR=0,mela=0;
  for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const e=DB[todayStr(d)];if(!e)continue;const s=e.sessions||{};
    if(s.Laufen){run++;runKm+=s.Laufen.dist||0;}if(s.Gym)gym++;if(s.Rad){rad++;radKm+=s.Rad.dist||0;}if(s.Schwimmen){swim++;swimM+=s.Schwimmen.dist||0;}if(s['Mobilität'])mob++;
    if(e.morning){if(e.morning.knee!=null)knee.push(e.morning.knee);if(e.morning.sleepMin)sleeps.push(e.morning.sleepMin/60);if(e.morning.bb!=null)bbs.push(e.morning.bb);}
    if(e.eve&&e.eve.prot!=null){prots++;if(e.eve.prot>=150)protOk++;}
    if(e.routines){if(e.routines.ss)ss++;if(e.routines.mob)mobR++;}
    if(e.subs&&e.subs.includes('Melatonin'))mela++;}
  const kAvg=avg(knee);const tr=Calc.trendDir(knee);
  document.getElementById('weekSummary').innerHTML=
    `<div class="weekrow"><span>${ic('run')}Laufen</span><b>${run}× · ${runKm.toFixed(1)} km</b></div>
     <div class="weekrow"><span>${ic('dumbbell')}Gym</span><b>${gym}×</b></div>
     <div class="weekrow"><span>${ic('bike')}Rad</span><b>${rad}× · ${radKm.toFixed(0)} km</b></div>
     <div class="weekrow"><span>${ic('swim')}Schwimmen</span><b>${swim}/2 · ${swimM} m</b></div>
     <div class="weekrow"><span>${ic('stretch')}Mobilität</span><b>${mob}×</b></div>
     <div class="weekrow"><span>${ic('pulse')}Ø Knie</span><b>${kAvg!=null?kAvg.toFixed(1)+'/10'+(tr?' · '+tr:''):'–'}</b></div>
     <div class="weekrow"><span>${ic('zzz')}Ø Schlaf</span><b>${avg(sleeps)!=null?avg(sleeps).toFixed(1)+'h':'–'}</b></div>
     <div class="weekrow"><span>${ic('battery')}Ø Body Battery</span><b>${avg(bbs)!=null?Math.round(avg(bbs))+'%':'–'}</b></div>
     <div class="weekrow"><span>${ic('nutrition')}Protein-Ziel-Tage</span><b>${protOk}/${prots}</b></div>
     <div class="weekrow"><span>${ic('dumbbell')}Spanish Squats</span><b>${ss}/7</b></div>
     <div class="weekrow"><span>${ic('stretch')}Sprunggelenk-Mob.</span><b>${mobR}/7</b></div>
     <div class="weekrow"><span>${ic('pill')}Melatonin</span><b>${mela}/7</b></div>`;}
/* --- Ausdauer --- */
function renderSegAusdauer(){
  renderGoalCard('goalDetail2');
  // Nächster Lauf
  const e=DB[todayStr()];const m=e&&e.morning;
  let nrTxt='Morgen-Check-in nötig für eine Empfehlung.';
  if(m){const ctx=recoveryCtx(todayStr());const r=Calc.readiness(m,ctx);const a=Calc.ampel(m,r,ctx);nrTxt=nextRunInfo(a.c,r.score).txt;}
  document.getElementById('nextRunBox').innerHTML=`<div class="insight" style="border-left-color:var(--cyan)"><b>Nächster Lauf:</b> ${esc(nrTxt)}</div>`;
  // 80/20
  const runs28=runsWindow(28);const es=Calc.easyShare(runs28);
  const tooHard=runs28.filter(r=>Calc.easyTooHard(r)).length;
  let ezHtml;
  if(es==null)ezHtml='<p class="muted">Erscheint ab 6 Läufen in 28 Tagen.</p>';
  else{const pct=Math.round(es*100);const ok=pct>=75;
    ezHtml=`<div class="goal"><div class="goalhead"><span>Easy-Anteil (Ziel ≥80%)</span><span>${pct}%</span></div>
      <div class="goalbar"><i class="${ok?'done':''}" style="width:${pct}%${ok?'':';background:linear-gradient(90deg,#fbbf24,#d97706)'}"></i></div></div>
      <p class="note" style="text-align:left">${ok?'Polarisierung stimmt — harte Einheiten bleiben hart, leichte leicht.':'Zu viel Intensität: Easy-Läufe wirklich easy laufen (HF ≤157).'}${tooHard?' · '+tooHard+'× Easy zu hart (HF >78% max).':''}</p>`;}
  document.getElementById('split8020').innerHTML=ezHtml;
  // Wochensprung + LR
  const jump=Calc.weeklyJump(weekRunKm(0),weekRunKm(1));
  const lrMax=Math.max(0,...runs28.filter(r=>r.sub==='Long Run').map(r=>r.dist||0));
  const w=Math.ceil(Math.max(daysTo(RACE.date),1)/7);const[lo,hi]=Calc.lrTarget(w);
  document.getElementById('lrBox').innerHTML=
    (jump.msg?`<div class="insight" style="border-left-color:${jump.lvl==='r'?'var(--red)':'var(--yellow)'}">${esc(jump.msg)}</div>`:'')+
    `<div class="goal"><div class="goalhead"><span>Long Run max. (28T) · Soll ${lo}–${hi} km</span><span>${lrMax.toFixed(1)} km</span></div>
     <div class="goalbar"><i class="${lrMax>=lo?'done':''}" style="width:${Math.min(100,lrMax/hi*100)}%"></i></div></div>
     <p class="note" style="text-align:left">Steigerung max. +2 km pro Long Run — Sehnen mögen keine Sprünge.</p>`;
  // EF Chart (nur Easy-Z2)
  const efs=Calc.efSeries(runsWindow(90));
  const wrap=document.getElementById('efWrap');
  if(!efs.length){killChart('cEF');wrap.innerHTML='<p class="muted" style="padding-top:50px;text-align:center">Braucht Easy-Z2-Läufe mit Distanz, Dauer + HF (131–157 bpm).</p>';}
  else if(!chartOK())chartGuard('efWrap');
  else{wrap.innerHTML='<canvas id="cEF"></canvas>';
    drawLine('cEF',efs.map(p=>new Date(p.date+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),
      [{label:'EF Easy-Z2 (m/min ÷ bpm)',data:efs.map(p=>p.ef),color:'#fb7185'}],{minAuto:true});}
  // Schwimmen
  renderSwimChart();
  // Interferenz heute
  const y=DB[dkey(-1)];const hl=Calc.heavyLegs(y&&y.sessions&&y.sessions.Gym);
  document.getElementById('interfBox').innerHTML=hl
    ?`<div class="insight" style="border-left-color:var(--yellow)">Gestern schweres Beintraining — Quality-Läufe heute eine Stufe runter.</div>`
    :`<p class="muted">Keine Bein-Lauf-Interferenz in den letzten 24h.</p>`;
}
function renderSwimChart(){
  const wrap=document.getElementById('swimWrap');
  const days=Object.keys(DB).filter(k=>isDay(k)&&DB[k].sessions&&DB[k].sessions.Schwimmen).sort();
  const pts=days.map(k=>{const s=DB[k].sessions.Schwimmen;
    return{k,long:s.long||null,pace:(s.dist&&s.dur)?+(s.dur*60/(s.dist/100)).toFixed(0):null};}).filter(p=>p.long||p.pace);
  if(!pts.length){killChart('cSwim');wrap.innerHTML='<p class="muted" style="padding-top:50px;text-align:center">Noch keine Schwimm-Einheiten geloggt.</p>';return;}
  if(!chartOK()){chartGuard('swimWrap');return;}
  wrap.innerHTML='<canvas id="cSwim"></canvas>';
  drawBarLine('cSwim',pts.map(p=>new Date(p.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),
    {label:'Längste am Stück (m)',data:pts.map(p=>p.long),color:'#c9ae7c'},
    {label:'Pace s/100m',data:pts.map(p=>p.pace),color:'#16a34a'},{goalY:400,goalLabel:'Ziel 400m'});
}
/* --- Erholung --- */
function renderSegErholung(){
  const S=series(dashRange);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  const g=f=>S.map(s=>s.e&&s.e.morning?s.e.morning[f]:null);
  const ready=S.map(s=>readinessOf(s.k));
  drawLine('cReady',labels,[{label:'Readiness %',data:ready,color:'#b89a60'},{label:'Knie',data:g('knee'),color:'#e11d48',y2:true}],{max:100});
  const hrvMs=g('hrvMs');
  const hrvAvg=hrvMs.map((_,i)=>{const win=[];for(let j=Math.max(0,i-6);j<=i;j++)if(hrvMs[j]!=null)win.push(hrvMs[j]);return win.length>=3?+avg(win).toFixed(0):null;});
  drawLine('cHRV',labels,[{label:'HRV (ms)',data:hrvMs,color:'#dcc79a'},{label:'Ø 7T',data:hrvAvg,color:'#b89a60'}],{minAuto:true});
  drawLine('cSleep',labels,[{label:'Std',data:S.map(s=>s.e&&s.e.morning&&s.e.morning.sleepMin!=null?+(s.e.morning.sleepMin/60).toFixed(2):null),color:'#c9ae7c'},{label:'Qualität',data:g('sleepQ'),color:'#8e7647',y2:true}],{max:12});
  drawLine('cBB',labels,[{label:'Body Batt %',data:g('bb'),color:'#16a34a'},{label:'Ruhepuls',data:g('rhr'),color:'#f59e0b',y2:true}],{max:100});
  const ctx=recoveryCtx(todayStr());
  document.getElementById('recovNote').innerHTML=
    `<div class="insight">Baselines (28T): Ruhepuls ${ctx.rhrBase!=null?Math.round(ctx.rhrBase)+' bpm':'– (braucht ≥7 Werte)'} · HRV-Datenpunkte ${ctx.hrvN}/14 nötig für Baseline-Score · Schlaf-Konto 7T: ${ctx.sleepDebtH!=null?'−'+ctx.sleepDebtH.toFixed(1)+'h':'–'}</div>`;
}
/* --- Körper --- */
function renderSegKoerper(){
  const S=series(dashRange);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  const w=S.map(s=>s.e&&s.e.morning?s.e.morning.weight:null);
  const wAvg=w.map((_,i)=>{const win=[];for(let j=Math.max(0,i-6);j<=i;j++)if(w[j]!=null)win.push(w[j]);return win.length>=2?+avg(win).toFixed(1):null;});
  drawLine('cWeight',labels,[{label:'kg',data:w,color:'#b89a60'},{label:'Ø 7T',data:wAvg,color:'#16a34a'}],{minAuto:true});
  drawLine('cProt',labels,[{label:'Protein g',data:S.map(s=>s.e&&s.e.eve?s.e.eve.prot:null),color:'#16a34a'}],{max:200,goal:150});
  // Gewichts-Hinweis: 7T-Schnitt jetzt vs. vor 4 Wochen
  const now7=[],prev7=[];
  for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.weight!=null)now7.push(e.morning.weight);}
  for(let i=28;i<35;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.weight!=null)prev7.push(e.morning.weight);}
  const hint=Calc.weightHint(avg(now7),avg(prev7));
  document.getElementById('weightHint').innerHTML=hint
    ?`<div class="insight" style="border-left-color:${hint.lvl==='g'?'var(--green)':'var(--yellow)'}">${esc(hint.txt)}</div>`
    :'<p class="muted">Gewichts-Trend erscheint nach ~5 Wochen Tracking.</p>';
}

/* ============ VERLAUF ============ */
let histFilter='alle',histLimit=60;
function renderHist(){
  flushAuto();
  document.getElementById('histChips').innerHTML=[['alle','Alle'],['lauf','Läufe'],['train','Training'],['notiz','Notizen']]
    .map(([k,l])=>`<button type="button" class="chip${histFilter===k?' on':''}" onclick="histFilter='${k}';histLimit=60;renderHist()">${l}</button>`).join('');
  let keys=Object.keys(DB).filter(isDay).sort().reverse();
  if(histFilter==='lauf')keys=keys.filter(k=>DB[k].sessions&&DB[k].sessions.Laufen);
  if(histFilter==='train')keys=keys.filter(k=>DB[k].sessions&&Object.keys(DB[k].sessions).filter(x=>x!=='_ts').length);
  if(histFilter==='notiz')keys=keys.filter(k=>DB[k].eve&&DB[k].eve.note);
  if(!keys.length){document.getElementById('histList').innerHTML='<p class="muted">Keine passenden Einträge.</p>';return;}
  const shown=keys.slice(0,histLimit);
  document.getElementById('histList').innerHTML=shown.map(k=>{const e=DB[k];const m=e.morning;
    const s=m?readinessFor(k):null;const dot=s&&s.color?s.color:'#2a3342';
    const dd=new Date(k+'T12:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
    let bits=[];if(s&&s.score!=='')bits.push(s.score+'%');if(m)bits.push('Knie '+m.knee);
    const st=Object.keys(e.sessions||{}).filter(x=>x!=='_ts');if(st.length)bits.push(st.map(x=>(TYPES[x]||{ic:''}).ic).join(''));
    if(e.eve&&e.eve.note)bits.push(ic('list'));
    return `<div class="hist" onclick="goEdit('${k}')"><span><span class="pill" style="background:${dot}"></span>${dd}</span><span class="muted">${bits.join(' · ')||'—'}</span></div>`;}).join('')
    +(keys.length>histLimit?`<button class="btn sec" style="margin-top:12px" onclick="histLimit+=60;renderHist()">Mehr laden (${keys.length-histLimit})</button>`:'');}
function goEdit(k){flushAuto();cur=k;renderDay();document.querySelector('.tabbar button[data-tab="heute"]').click();}

/* ============ PROFIL + AI REVIEW ============ */
function renderMehr(){
  const lb=DB._lastBackup;
  document.getElementById('backupStatus').innerHTML=lb
    ?`Letztes Backup: <b>${new Date(lb).toLocaleDateString('de-DE')}</b> (vor ${Math.floor((Date.now()-lb)/864e5)} Tagen)`
    :'Noch kein Backup gemacht.';
  document.getElementById('aiPreview').textContent=weekSummaryText();
  if(typeof renderProfileScreen==='function')renderProfileScreen();
  if(typeof renderDataHub==='function')renderDataHub();
  if(typeof renderLegalCard==='function')renderLegalCard();
}
function buildAIReview(){
  const tage=[];
  for(let i=6;i>=0;i--){const k=dkey(-i);const e=DB[k];if(!e)continue;
    const m=e.morning||{},ev2=e.eve||{},s=e.sessions||{};
    tage.push({datum:k,readiness:e.morning?readinessFor(k).score:null,knieMorgen:m.knee??null,knieAbend:ev2.knee??null,
      schlafH:m.sleepMin?+(m.sleepMin/60).toFixed(1):null,schlafQ:m.sleepQ??null,hrvMs:m.hrvMs??null,hrvStatus:m.hrv||null,
      rhr:m.rhr??null,bodyBattery:m.bb??null,gewicht:m.weight??null,doms:m.doms??null,protein:ev2.prot??null,energie:ev2.energy??null,notiz:ev2.note||null,
      einheiten:Object.keys(s).filter(t=>t!=='_ts').map(t=>{const x=s[t];return{typ:t,art:x.sub||null,km:x.dist??null,min:x.dur??null,hf:x.hr??null,rpe:x.rpe??null,kniePost:x.knee??null};})});}
  const goal=buildGoal();const runs28=runsWindow(28);
  const es=Calc.easyShare(runs28);const jump=Calc.weeklyJump(weekRunKm(0),weekRunKm(1));
  const ld=allLoads();const ac=Calc.acwr(ld.loads.slice(-42));
  const warnungen=[];
  if(jump.msg)warnungen.push(jump.msg);
  if(es!=null&&es<0.75)warnungen.push('Easy-Anteil nur '+Math.round(es*100)+'% (Ziel ≥75–80%)');
  (goal.vetos||[]).forEach(x=>warnungen.push('Ziel-Veto: '+x));
  return{erstellt:todayStr(),athlet:{name:'Gian',alter:22,gewichtKg:75,hfMax:201,ziel:'Halbmarathon <'+Calc.fmtTime(DB._hmTargetMin||110)+' am 06.09.2026'},
    hmPrognose:goal,acwr:ac.ratio,easyAnteilProzent28T:es!=null?Math.round(es*100):null,
    wochenKm:{aktuell:+weekRunKm(0).toFixed(1),vorwoche:+weekRunKm(1).toFixed(1),soll:Calc.weekKmTarget(daysTo(RACE.date),0)},
    warnungen,letzte7Tage:tage};
}
function weekSummaryText(){
  const r=buildAIReview();const g=r.hmPrognose;
  const ready=r.letzte7Tage.map(t=>t.readiness).filter(x=>x!=null);
  const runs=r.letzte7Tage.reduce((s,t)=>s+t.einheiten.filter(e=>e.typ==='Laufen').length,0);
  const lines=[
    'Woche bis '+r.erstellt+': '+r.wochenKm.aktuell+' km gelaufen ('+runs+' Läufe, Soll '+r.wochenKm.soll+' km), Ø Readiness '+(ready.length?Math.round(Calc.avg(ready))+'%':'–')+'.',
    g.state==='nodata'?'HM-Prognose: noch nicht belastbar ('+g.nQuality+' Quality-Läufe).':'HM-Prognose: '+Calc.fmtTime(g.tPred)+' ('+(g.state==='ontrack'?'on track':g.state==='border'?'grenzwertig':'gefährdet')+') bei Ziel '+Calc.fmtTime(g.target)+'.',
    r.warnungen.length?'Warnungen: '+r.warnungen.join(' | '):'Keine aktiven Warnungen.'];
  return lines.join('\n');
}
function copyAIReview(){
  const j=JSON.stringify(buildAIReview(),null,1);
  const prompt='Du bist mein Trainings-Coach (HM <1:50 am 06.09.2026, Patella-Vorgeschichte). Analysiere die Woche: größter Engpass, konkrete Anpassung für nächste Woche, Risiken. Daten:\n'+j;
  navigator.clipboard.writeText(prompt).then(()=>toast('Review kopiert — bei Claude einfügen ✓')).catch(()=>toast('Kopieren fehlgeschlagen'));
}
function copySummary(){navigator.clipboard.writeText(weekSummaryText()).then(()=>toast('Zusammenfassung kopiert ✓')).catch(()=>toast('Kopieren fehlgeschlagen'));}

/* ============ TABS + INIT ============ */
document.querySelectorAll('.tabbar button').forEach(b=>b.onclick=()=>{
  flushAuto();
  document.querySelectorAll('.tabbar button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on','pop');setTimeout(()=>b.classList.remove('pop'),420);
  ['heute','plan','dash','hist','mehr'].forEach(t=>document.getElementById('tab-'+t).classList.add('hide'));
  document.getElementById('tab-'+b.dataset.tab).classList.remove('hide');
  if(b.dataset.tab==='plan')renderPlan();if(b.dataset.tab==='dash')renderDash();
  if(b.dataset.tab==='hist')renderHist();if(b.dataset.tab==='mehr'){renderMehr();if(window.renderAccountCard)renderAccountCard();}
  window.scrollTo(0,0);});
document.getElementById('suppModal').addEventListener('click',e=>{if(e.target.id==='suppModal')closeSupp();});
/* Tastatur: Tabbar ausblenden, wenn iOS-Keyboard offen */
if(window.visualViewport){visualViewport.addEventListener('resize',()=>{
  const kb=window.innerHeight-visualViewport.height>120;
  document.querySelector('.tabbar').classList.toggle('kb',kb);});}
/* Profil laden + Race/Ziel synchronisieren; Onboarding bei frischer Installation */
const _profileExisted=(typeof ensureProfile==='function')?ensureProfile():true;
if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hmTargetMin&&DB._hmTargetMin==null)DB._hmTargetMin=PROFILE.hmTargetMin;
renderDay();
if(!_profileExisted&&Object.keys(DB).filter(isDay).length===0&&typeof openOnboarding==='function')setTimeout(()=>openOnboarding(true),350);
document.getElementById('morningForm').addEventListener('input',()=>debounce('m',autoMorning));
document.getElementById('morningForm').addEventListener('click',e=>{if(e.target.closest('.chip'))autoMorning();});
document.getElementById('postBlocks').addEventListener('input',()=>debounce('p',autoPost));
document.getElementById('postBlocks').addEventListener('click',e=>{if(e.target.closest('.chip'))autoPost();});
document.getElementById('eveForm').addEventListener('input',()=>debounce('e',autoEve));
document.getElementById('eveForm').addEventListener('click',e=>{if(e.target.closest('.chip'))autoEve();});
window.addEventListener('pagehide',flushAuto);
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js');
