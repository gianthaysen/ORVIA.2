import fs from 'node:fs';
let s = fs.readFileSync('app/js/ui.js', 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 70)); s = s.replace(a, b); n++; }
rep(`    '<button class="iconbtn" aria-label="Plan-Einstellungen" onclick="gmOpenPlanSettingsSheet()">'+icon('gear','sm')+'</button></div></div>';
  /* 2–4. Planvariante A/B/C`,
`    '<button class="iconbtn" aria-label="Plan-Einstellungen" onclick="gmOpenPlanSettingsSheet()">'+icon('gear','sm')+'</button></div></div>';
  /* Stufe D (14.09.2026): Beschwerde-Banner + Rueckkehr-Leiter — direkt unter dem Kopf, damit der Nutzer
     zuerst sieht, WARUM der Plan anders aussieht. Rein aus dem Lesepfad (absence-replanner + return-ladder). */
  try{h+=gmPlanConstraintHTML();}catch(_c){ }
  /* 2–4. Planvariante A/B/C`);
rep(`function renderGMPlan(){`,
`/* ---------- Stufe D · Beschwerde-Banner + Rueckkehr-Leiter im Plan-Tab ---------- */
function gmPlanLadderPainDays(region){
  /* Tages-Schmerzwerte der letzten 14 Tage: Morgen-Check-in fuehrt Knie als Zahl (morning.knee); fuer andere
     Regionen gibt es kein Tagesfeld — dann leer (kein erfundener Verlauf). */
  var out=[];if(region!=='knee')return out;
  try{for(var i=0;i<14;i++){var k=dkey(-i);var e=DB[k];if(e&&e.morning&&e.morning.knee!=null)out.push({date:k,pain:+e.morning.knee});}}catch(_){ }
  return out;
}
function gmPlanConstraintModel(){
  var AR=window.ORVIA&&ORVIA.absenceReplanner,RL=window.ORVIA&&ORVIA.returnLadder;
  if(!AR||!RL||typeof PROFILE==='undefined'||!PROFILE)return null;
  var inj=AR.injuryFromConstraints(PROFILE.constraintsList);if(!inj||!inj.active)return null;
  var c=(PROFILE.constraintsList||[]).filter(function(x){return x&&x.id===inj.id;})[0]||null;if(!c)return null;
  var ev=RL.evaluate(c,{today:todayStr(),painDays:gmPlanLadderPainDays(c.bodyRegion)});
  var last=null;try{last=ORVIA._lastAbsencePlan||null;}catch(_){ }
  var replaced=(last&&last.injury&&last.injury.replaced!=null)?last.injury.replaced:0;
  var flagOn=(typeof _absenceReplannerOn==='function')?_absenceReplannerOn():false;
  return {constraint:c,label:inj.label||AR.constraintLabel(c)||'',ladder:ev,replaced:replaced,flagOn:flagOn,intensity:c.intensity!=null?+c.intensity:null};
}
function gmPlanConstraintHTML(){
  var m=gmPlanConstraintModel();if(!m)return '';
  try{activeWeekPlan();var last=ORVIA._lastAbsencePlan||null;m.replaced=(last&&last.injury&&last.injury.replaced!=null)?last.injury.replaced:m.replaced;}catch(_){ }
  var ev=m.ladder,st=ev.stage,STAGE_T=function(k){return _uiT('ui.rl_stage_'+k);},STAGE_D=function(k){return _uiT('ui.rl_stage_'+k+'_d');};
  var head=m.flagOn
    ?(st>=5?_uiT('ui.rl_banner_free',{label:m.label}):_uiT('ui.rl_banner',{label:m.label,n:m.replaced}))
    :_uiT('ui.rl_banner_flag_off',{label:m.label});
  var h='<div class="card tight rl-card" data-gm-slot="plan-constraint"><div class="ctitle"><div class="l">'+icon('alert','sm')+' '+gmEsc(head)+'</div><span class="more" onclick="openProfileSection(\\'constraints\\')">' + _uiT('ui.rl_beschwerde') + ' '+icon('chev','xs')+'</span></div>';
  /* Leiter */
  var keys=['rest','walk','walkrun','easyshort','easy','free'];
  h+='<div class="rl-steps">'+keys.map(function(k,i){return '<div class="rl-step'+(i<st?' done':'')+(i===st?' on':'')+'"><b>'+(i+1)+'</b><span>'+gmEsc(STAGE_T(k))+'</span></div>';}).join('')+'</div>';
  h+='<div class="rl-now"><div class="rl-now-t">'+gmEsc(_uiT('ui.rl_stufe_x',{n:st+1,name:STAGE_T(keys[st])}))+'</div><div class="rl-now-d">'+gmEsc(STAGE_D(keys[st]))+'</div>';
  if(st<5){
    var crit=ev.minDays>0?_uiT('ui.rl_kriterium_tage',{n:ev.minDays,have:ev.daysInStage}):_uiT('ui.rl_kriterium_frei');
    h+='<div class="rl-crit">'+icon('info','xs')+' '+gmEsc(_uiT('ui.rl_naechste',{name:STAGE_T(keys[st+1])}))+' · '+gmEsc(crit)+(ev.setbackSuggested?' · <b style="color:var(--attention)">'+gmEsc(_uiT('ui.rl_schmerz_in_stufe',{p:ev.maxPainInStage}))+'</b>':'')+'</div>';
    h+='<div class="rl-acts"><button type="button" class="btn'+(ev.canAdvance?'':' sec')+'" onclick="constraintLadderAdvance(\\''+gmEsc(m.constraint.id)+'\\')">'+gmEsc(_uiT('ui.rl_geschafft'))+'</button>'+(st>0?'<button type="button" class="btn sec" onclick="constraintLadderSetback(\\''+gmEsc(m.constraint.id)+'\\')">'+gmEsc(_uiT('ui.rl_rueckschlag'))+'</button>':'')+'</div>';
    h+='<div class="source">'+icon('info','xs')+' '+gmEsc(_uiT('ui.rl_quelle',{d:ev.estimatedDaysToFree}))+'</div>';
  }else{
    h+='<div class="rl-acts"><button type="button" class="btn sec" onclick="constraintLadderSetback(\\''+gmEsc(m.constraint.id)+'\\')">'+gmEsc(_uiT('ui.rl_rueckschlag'))+'</button><button type="button" class="btn sec" onclick="constraintStatus(\\''+gmEsc(m.constraint.id)+'\\',\\'resolved\\');renderGMPlan()">'+gmEsc(_uiT('ui.rl_abschliessen'))+'</button></div>';
  }
  h+='</div></div>';
  return h;
}
function renderGMPlan(){`);
fs.writeFileSync('app/js/ui.js', s);
let p = fs.readFileSync('app/js/profile.js', 'utf8');
const a = `function constraintRemove(id){`;
if (!p.includes(a)) throw new Error('profile anchor');
p = p.replace(a, `/* Stufe D (14.09.2026): Rueckkehr-Leiter — Zustand an der Beschwerde, Schreiben nur hier, Logik im Engine-Modul. */
function _constraintLadderApply(id,fn){var RL=window.ORVIA&&ORVIA.returnLadder;if(!RL)return;var today=(typeof todayStr==='function')?todayStr():new Date().toISOString().slice(0,10);
  var hit=false;PROFILE.constraintsList=_constraintList().map(function(c){if(!c||c.id!==id)return c;hit=true;return fn(RL,c,today);});
  if(!hit)return;_persistConstraints();try{if(typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }try{if(typeof renderProfileScreen==='function')renderProfileScreen();}catch(_){ }}
function constraintLadderAdvance(id){var RL=window.ORVIA&&ORVIA.returnLadder;if(!RL)return;
  var c=_constraintList().filter(function(x){return x&&x.id===id;})[0];if(!c)return;
  var ev=RL.evaluate(c,{today:todayStr(),painDays:(typeof gmPlanLadderPainDays==='function')?gmPlanLadderPainDays(c.bodyRegion):[]});
  if(!ev.canAdvance){if(typeof toast==='function')toast(ev.blockers.indexOf('pain_in_stage')>=0?T('pf.rl_block_schmerz'):T('pf.rl_block_tage',{n:ev.minDays-ev.daysInStage}));return;}
  _constraintLadderApply(id,function(L,cc,today){return L.advance(cc,today,'user');});
  if(typeof toast==='function')toast(T('pf.rl_stufe_hoch'));}
function constraintLadderSetback(id){_constraintLadderApply(id,function(L,cc,today){return L.setback(cc,today,'user');});if(typeof toast==='function')toast(T('pf.rl_stufe_runter'));}
function constraintRemove(id){`);
fs.writeFileSync('app/js/profile.js', p);
console.log('ok', n);
