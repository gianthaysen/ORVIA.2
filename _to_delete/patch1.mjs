import fs from 'fs';
const f='app/js/ui.js'; let s=fs.readFileSync(f,'utf8'); const n0=s.length;
function rep(a,b){ if(!s.includes(a)){console.error('MISSING:',a.slice(0,90));process.exit(1);} s=s.replace(a,b); }

/* 1) gmSeasonNow + gmPlanWeekMeta aus dem Saisonmodell (gleiche Quelle wie Profil) */
rep(`function gmPlanWeekMeta(){
  var wk=null,phase=null,range='';
  try{if(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&goalOf().raceDate)wk=Math.max(1,Math.min(25,Calc.runnaWeek(daysTo(RACE.date))));}catch(_){ }
  try{var ph=Calc.racePhases(RACE.date,todayStr());(ph||[]).forEach(function(p){if(p.on)phase=p.n;});}catch(_){ }`,
`/* Saisonmodell (engine/season-phases) fuer die Plan-Seite — dieselbe Quelle wie das Profil
   (profile-v14 „Basisphase · Woche 1 von 6"). Vorher zeigte der Plan-Kopf Calc.racePhases
   („Aufbau") und das Profil das Saisonmodell („Basis") — zwei Phasenmodelle nebeneinander.
   Fallback bleibt Calc.racePhases, wenn kein Hauptziel mit Datum existiert. */
function gmSeasonNow(){
  try{
    var SP=window.ORVIA&&ORVIA.seasonPhases;if(!SP||!SP.seasonPhases)return null;
    var g=(typeof mainGoalOf==='function')?mainGoalOf():null;var rd=(g&&(g.targetDate||g.raceDate))||(RACE&&RACE.date)||null;if(!rd)return null;
    var sp=SP.seasonPhases(String(rd).slice(0,10),todayStr(),{startDate:(g&&g.createdAt)?String(g.createdAt).slice(0,10):null});
    if(!sp||!sp.current)return null;
    var D={base:'ui.sp_d_base',build:'ui.sp_d_build',peak:'ui.sp_d_peak',taper:'ui.sp_d_taper'};
    sp.phases.forEach(function(p){p.d=_uiT(D[p.key]||'ui.sp_d_build');});
    return sp;
  }catch(_){return null;}
}
function gmPlanWeekMeta(){
  var wk=null,phase=null,range='',phaseWeek=null,phaseWeeks=null,season=false;
  var sp=gmSeasonNow();
  if(sp){wk=sp.weekIndex||null;phase=sp.current.n;phaseWeek=sp.current.week;phaseWeeks=sp.current.weeks;season=true;}
  else{
    try{if(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&goalOf().raceDate)wk=Math.max(1,Math.min(25,Calc.runnaWeek(daysTo(RACE.date))));}catch(_){ }
    try{var ph=Calc.racePhases(RACE.date,todayStr());(ph||[]).forEach(function(p){if(p.on)phase=p.n;});}catch(_){ }
  }`);
rep(`  return {wk:wk,phase:phase,range:range};
}
/* ---------- Planvarianten A/B/C`,
`  return {wk:wk,phase:phase,range:range,phaseWeek:phaseWeek,phaseWeeks:phaseWeeks,season:season};
}
/* ---------- Planvarianten A/B/C`);
/* Kopf: Datumszeile „· Basis · Woche 1 von 6" */
rep(`<div class="date">'+gmEsc(meta.range)+(meta.phase?' · '+gmEsc(meta.phase):'')+(lvl==='p'?`,
`<div class="date">'+gmEsc(meta.range)+(meta.phase?' · '+gmEsc(meta.phase)+(meta.phaseWeek?' · '+gmEsc(_uiT('ui.woche_x_von_y',{x:meta.phaseWeek,y:meta.phaseWeeks})):''):'')+(lvl==='p'?`);

/* 2) Phasen-Track (9b) aus demselben Modell */
rep(`    /* 9b. Phasen (Calc.racePhases read-only) */
    var phases=[];try{phases=Calc.racePhases(RACE.date,todayStr())||[];}catch(_){ }`,
`    /* 9b. Phasen — Saisonmodell (wie Kopf + Profil), Fallback Calc.racePhases read-only */
    var phases=[];try{var _spn=gmSeasonNow();phases=_spn?_spn.phases.slice():(Calc.racePhases(RACE.date,todayStr())||[]);}catch(_){ }`);
rep(`var _curTxt=_cur?(_wkLbl(_cur)+(_cur.d?' · '+_cur.d:'')):`,
`var _curTxt=_cur?((_cur.week?_uiT('ui.woche_x_von_y',{x:_cur.week,y:_cur.weeks}):_wkLbl(_cur))+(_cur.d?' · '+_cur.d:'')):`);

/* 3) Variantenkarte: Ersetzungen wegen Beschwerde benennen */
rep(`+((pvm&&pvm.note)?' '+gmEsc(pvm.note):'')+'</div></div></div>';`,
`+((pvm&&pvm.note)?' '+gmEsc(pvm.note):'')+(function(){try{var la=ORVIA._lastAbsencePlan;if(la&&la.injury&&la.injury.replaced>0)return ' <b>'+gmEsc(_uiT('ui.davon_ersetzt_beschwerde',{n:la.injury.replaced,label:la.injury.label,stage:(la.injury.stage||0)+1}))+'</b>';}catch(_){ }return '';})()+'</div></div></div>';`);

/* 4) Leiter: Stufe 1 ohne „Rueckschlag pruefen", Button sperren + Grund inline */
rep(`(ev.setbackSuggested?' · <b style="color:var(--attention)">'+gmEsc(_uiT('ui.rl_schmerz_in_stufe',{p:ev.maxPainInStage}))+'</b>':'')+'</div></div>';
    h+='<div class="rl-acts"><button type="button" class="btn'+(ev.canAdvance?'':' sec')+'" onclick="constraintLadderAdvance(\\''+gmEsc(m.constraint.id)+'\\')">'+gmEsc(_uiT('ui.rl_geschafft'))+'</button>'`,
`(ev.setbackSuggested?' · <b style="color:var(--attention)">'+gmEsc(_uiT(st>0?'ui.rl_schmerz_in_stufe':'ui.rl_schmerz_in_stufe_rest',{p:ev.maxPainInStage}))+'</b>':'')+'</div></div>';
    var _blk=[];if(!ev.canAdvance){if(ev.blockers.indexOf('pain_in_stage')>=0)_blk.push(_uiT('ui.rl_block_schmerz'));if(ev.blockers.indexOf('min_days')>=0)_blk.push(_uiT('ui.rl_block_tage',{n:Math.max(0,ev.minDays-ev.daysInStage)}));}
    h+='<div class="rl-acts"><button type="button" class="btn'+(ev.canAdvance?'':' sec')+'"'+(ev.canAdvance?'':' disabled aria-disabled="true"')+' onclick="constraintLadderAdvance(\\''+gmEsc(m.constraint.id)+'\\')">'+gmEsc(_uiT('ui.rl_geschafft'))+'</button>'`);
rep(`    h+='<div class="source">'+icon('info','xs')+' '+gmEsc(_uiT('ui.rl_quelle',{d:ev.estimatedDaysToFree}))+'</div>';`,
`    if(_blk.length)h+='<div class="rl-block">'+gmEsc(_blk.join(' · '))+'</div>';
    h+='<div class="source">'+icon('info','xs')+' '+gmEsc(_uiT('ui.rl_quelle',{d:ev.estimatedDaysToFree}))+'</div>';`);
fs.writeFileSync(f,s); console.log('ui.js ok', n0,'→',s.length);

/* season-phases: weekIndex (1-basiert, gesamte Saison) */
const sf='app/js/engine/season-phases.js'; let e=fs.readFileSync(sf,'utf8');
if(!e.includes('totalWeeks: totalWeeks,\n      weeksToRace')) {console.error('season missing');process.exit(1);}
e=e.replace('totalWeeks: totalWeeks,\n      weeksToRace','totalWeeks: totalWeeks, weekIndex: Math.min(totalWeeks, weekIdx + 1),\n      weeksToRace');
fs.writeFileSync(sf,e); console.log('season ok');

/* locales */
const lf='app/locales/de.js'; let l=fs.readFileSync(lf,'utf8');
const anchor="    'ui.rl_geschafft': 'Stufe geschafft',";
if(!l.includes(anchor)){console.error('locale anchor');process.exit(1);}
l=l.replace(anchor, anchor+`
    'ui.rl_schmerz_in_stufe_rest': 'Schmerz {p}/10 – unterste Stufe halten, erst schmerzfrei weiter',
    'ui.rl_block_schmerz': 'Noch nicht: In dieser Stufe wurde Schmerz ≥ 5 gemeldet. Erst wieder schmerzfrei, dann weiter.',
    'ui.rl_block_tage': 'Noch nicht: {n} Tage ohne Rückschlag fehlen.',
    'ui.davon_ersetzt_beschwerde': '{n} davon wegen {label} ersetzt (Rückkehr-Leiter Stufe {stage}).',
    'ui.woche_x_von_y': 'Woche {x} von {y}',
    'ui.sp_d_base': 'Grundlage & Umfang aufbauen',
    'ui.sp_d_build': 'Umfang halten, Qualität steigern',
    'ui.sp_d_peak': 'Höchste Last, wettkampfspezifische Reize',
    'ui.sp_d_taper': 'Volumen senken, Frische aufbauen',`);
fs.writeFileSync(lf,l); console.log('locale ok');
