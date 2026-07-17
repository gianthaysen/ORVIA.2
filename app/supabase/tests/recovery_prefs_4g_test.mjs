/* ORVIA · 4g — Regeneration/Alltag, Beschwerden, Trainingspräferenzen. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
function mkEl(extra) { const el = { value: '', checked: false, dataset: {}, _html: '', classList: { _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} }, querySelectorAll(){return [];}, addEventListener(){}, remove(){}, appendChild(){} }; Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}}); return Object.assign(el, extra||{}); }
const els = {}; function clearEls(){ for(const k in els) delete els[k]; }
function mkSeg(v){ return mkEl({ dataset:{ val:v } }); }
function mkChips(on){ return mkEl({ querySelectorAll:()=>on.map(v=>({dataset:{v}})) }); }
const sb = {}; sb.window=sb; sb.self=sb; sb.console=console;
sb.Date=Date; sb.Math=Math; sb.JSON=JSON; sb.parseInt=parseInt; sb.parseFloat=parseFloat; sb.isNaN=isNaN; sb.Array=Array; sb.Object=Object; sb.String=String; sb.Set=Set;
sb.escH=s=>String(s==null?'':s); sb.toast=()=>{}; sb.renderProfileScreen=()=>{}; sb.renderZones=()=>{}; sb.maybePlanImpact=()=>{};
const wl={}; sb.CustomEvent=function(t,i){this.type=t;this.detail=i&&i.detail;}; let evCount=0; sb.addEventListener=(t,f)=>{(wl[t]=wl[t]||[]).push(f);}; sb.removeEventListener=()=>{}; sb.dispatchEvent=e=>{(wl[e.type]||[]).forEach(f=>f(e));return true;};
sb.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}};
sb.document={getElementById:id=>els[id]||null,createElement:()=>mkEl(),body:{appendChild(){}},querySelectorAll:()=>[]};
vm.createContext(sb);
const base=new URL('../../js/',import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js',base),'utf8'),sb);
vm.runInContext(readFileSync(new URL('profile.js',base),'utf8'),sb);
const M=sb.ORVIA.profileModel;
sb.PROFILE=M.consolidateProfile({ v:1, onboarded:true, name:'Gian', sports:[{sportId:'running',activeInApp:true,role:'primary'},{sportId:'gym',activeInApp:true}] });

// ---- Modell: Migration Legacy + idempotent (29/30) ----
let rcMig=M.normalizeRecovery({nutrition:'Defizit grob'},{nutrition:'Defizit grob'});
ok('4g-29 Recovery Legacy-Text erhalten', rcMig._legacyText && rcMig._legacyText.nutrition==='Defizit grob');
ok('4g-30 Migration idempotent', JSON.stringify(M.normalizeRecovery(rcMig))===JSON.stringify(M.normalizeRecovery(M.normalizeRecovery(rcMig))));

// ---- Recovery-Editor (1-9) ----
clearEls(); sb.openRecoveryEditor();
els.rc_sleepH=mkEl({value:'6.5'}); els.rc_sleepQ=mkSeg('mid'); els.rc_sleepC=mkSeg('regular'); els.rc_bed=mkEl({value:'23:00'}); els.rc_wake=mkEl({value:'06:30'});
els.rc_stress=mkSeg('high'); els.rc_work=mkSeg('normal'); els.rc_phys=mkSeg('partly'); els.rc_shift=mkSeg('rotating'); els.rc_nut=mkSeg('deficit'); els.rc_eal=mkEl({checked:true}); els.rc_arec=mkEl({checked:true});
sb.saveRecoveryEditor();
let rc=sb.PROFILE.recovery;
ok('4g-1/2/3 Schlaf (Dauer/Qualität/Regelmäßigkeit)', rc.sleep.averageHours===6.5 && rc.sleep.quality==='mid' && rc.sleep.consistency==='regular');
ok('4g-4/5 Stress + Arbeitsbelastung', rc.stress.generalLevel==='high' && rc.stress.workSchoolLevel==='normal');
ok('4g-6 Schichttyp', rc.workPattern.shiftType==='rotating');
ok('4g-7/8 Ernährungssituation + Energieverfügbarkeit', rc.nutritionState.mode==='deficit' && rc.nutritionState.energyAvailabilityLimited===true);

// ---- Beschwerden: gemeinsame Quelle, CRUD, Status (10-17) ----
clearEls(); sb.openConstraintEditor();
els.c_region=mkSeg('knee'); els.c_side=mkSeg('left'); els.c_int=mkEl({value:'3'}); els.c_trig=mkEl({value:'tiefe Kniebeugung, Laufen'}); els.c_aff=mkChips(['running']); els.c_avoid=mkEl({value:'tiefe Kniebeuge'}); els.c_since=mkEl({value:'Juni 2026'}); els.c_train=mkEl({checked:true}); els.c_adapt=mkEl({value:''}); els.c_status=mkSeg('active');
sb.saveConstraint('');
let cstr=sb.PROFILE.constraintsList[0];
ok('4g-10/17 Beschwerde hinzugefügt (Region/Seite/betroffene Sportart)', cstr.bodyRegion==='knee' && cstr.side==='left' && cstr.intensity===3 && cstr.affectedActivities.indexOf('running')>=0);
ok('4g-15 gemeinsame Quelle: in issues[] gespiegelt', sb.PROFILE.issues.indexOf('knee')>=0 && sb.ORVIA.profile.activeConstraints().some(c=>c.bodyRegion==='knee'));
sb.constraintStatus(cstr.id,'improved');
ok('4g-13 Status verbessert', sb.PROFILE.constraintsList[0].status==='improved');
sb.constraintStatus(cstr.id,'resolved');
ok('4g-14 Status behoben → aus aktiven issues entfernt', sb.PROFILE.issues.indexOf('knee')<0);
// 16 Event bei Profiländerung
let ev=0; sb.ORVIA.profile.subscribe(e=>{if(e.detail.changedSections.indexOf('constraints')>=0)ev++;});
sb.constraintStatus(cstr.id,'active');
ok('4g-16 Profiländerung löst Event aus', ev===1);

// ---- Preferences-Editor (18-28) ----
clearEls(); sb.openPreferencesEditor();
els.pf_sports=mkChips(['running']); els.pf_dislike=mkChips(['treadmill','intervals']); els.pf_dislikeCustom=mkEl({value:'Burpees'});
els.pf_dur=mkChips(['45','60']); els.pf_env=mkSeg('outdoor'); els.pf_times=mkChips(['evening']); els.pf_int=mkSeg('balanced'); els.pf_social=mkSeg('solo'); els.pf_variety=mkSeg('balanced'); els.pf_coach=mkSeg('analytic'); els.pf_avoid=mkEl({value:'Beinpresse, Crunches'});
sb.savePreferencesEditor();
let pr=sb.PROFILE.preferences;
ok('4g-18/19 bevorzugte Sportarten + unbeliebte Formen', pr.preferredSports.indexOf('running')>=0 && pr.dislikedTrainingForms.indexOf('treadmill')>=0);
ok('4g-20 bevorzugte Dauer als Minuten', pr.preferredSessionDurations.indexOf(45)>=0 && pr.preferredSessionDurations.indexOf(60)>=0 && pr.preferredSessionDurations.every(x=>typeof x==='number'));
ok('4g-21/22/23/24 Umgebung/Zeiten/Intensität/Sozial', pr.preferredEnvironment==='outdoor' && pr.preferredTimes.indexOf('evening')>=0 && pr.intensityPreference==='balanced' && pr.socialPreference==='solo');
ok('4g-25 vermiedene Übungen strukturiert', pr.avoidedExercises.length===2 && pr.avoidedExercises[0].exerciseName==='Beinpresse');
ok('4g-27/28 Abwechslung + Coaching-Stil', pr.varietyPreference==='balanced' && pr.coachingStyle==='analytic');

// 9/31 Zusammenfassung
clearEls(); sb.openProfileSummary(); let ps=sb._profSum&&sb._profSum._html;
ok('4g-9/31 Profilzusammenfassungen (Regeneration/Beschwerden/Präferenzen)', ps && ps.indexOf('Regeneration und Alltag')>=0 && ps.indexOf('6.5 h Schlaf')>=0 && ps.indexOf('Trainingspräferenzen')>=0 && ps.indexOf('Outdoor')>=0);
// 32 Neustart
ok('4g-32 Werte nach Neustart erhalten', JSON.parse(store['orvia_profile_v1']).recovery.sleep.averageHours===6.5 && JSON.parse(store['orvia_profile_v1']).preferences.preferredEnvironment==='outdoor');
// 33 kein <select>
clearEls(); sb.openRecoveryEditor(); ok('4g-33 kein <select> im Recovery-Editor', sb._recEdM && sb._recEdM._html.indexOf('<select')<0 && sb._recEdM._html.indexOf('Sehr gut')>=0);
ok('4g-33b kein <select> im Constraint-/Preferences-Editor', (function(){clearEls();sb.openConstraintEditor();var a=sb._cstrEd._html;clearEls();sb.openPreferencesEditor();var b=sb._prefEdM._html;return a.indexOf('<select')<0&&b.indexOf('<select')<0;})());

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
