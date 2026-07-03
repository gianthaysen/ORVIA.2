/* ORVIA · 4e.1 — Trainingsverfügbarkeit + echte Doppeleinheiten (Modell + Editor-Pipeline). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
function mkEl(extra) { const el = { value: '', checked: false, dataset: {}, _html: '', classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} }, querySelectorAll(){return [];}, addEventListener(){}, remove(){}, appendChild(){} }; Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}}); return Object.assign(el, extra||{}); }
const els = {}; function clearEls(){ for(const k in els) delete els[k]; }
function mkSeg(v){ return mkEl({ dataset:{ val:v } }); }
function mkChips(on){ return mkEl({ querySelectorAll:()=>on.map(v=>({dataset:{v}})) }); }
const sb = {}; sb.window=sb; sb.self=sb; sb.console=console;
sb.Date=Date; sb.Math=Math; sb.JSON=JSON; sb.parseInt=parseInt; sb.parseFloat=parseFloat; sb.isNaN=isNaN; sb.Array=Array; sb.Object=Object; sb.String=String; sb.Set=Set;
sb.escH=s=>String(s==null?'':s); sb.toast=()=>{}; sb.renderProfileScreen=()=>{}; sb.renderZones=()=>{}; sb.maybePlanImpact=()=>{};
const wl={}; sb.CustomEvent=function(t,i){this.type=t;this.detail=i&&i.detail;}; sb.addEventListener=(t,f)=>{(wl[t]=wl[t]||[]).push(f);}; sb.removeEventListener=()=>{}; sb.dispatchEvent=e=>{(wl[e.type]||[]).forEach(f=>f(e));return true;};
sb.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}};
sb.document={getElementById:id=>els[id]||null,createElement:()=>mkEl(),body:{appendChild(){}},querySelectorAll:()=>[]};
vm.createContext(sb);
const base=new URL('../../js/',import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js',base),'utf8'),sb);
vm.runInContext(readFileSync(new URL('profile.js',base),'utf8'),sb);
const M=sb.ORVIA.profileModel;
sb.PROFILE=M.consolidateProfile({ v:1, onboarded:true, name:'Gian', sports:[{sportId:'swimming',activeInApp:true},{sportId:'running',activeInApp:true,role:'primary'}] });

// 18/19 Migration alt→neu + idempotent
let mig=M.normalizeAvailability({ weekly:{ mo:{available:true,maxMinutes:60,timeOfDay:'evening',intense:true} } });
ok('4e.1-18 Migration weekly→days (singleSession)', mig.days.mo.singleSession.maxMinutes===60 && mig.days.mo.singleSession.preferredTime==='evening');
ok('4e.1-19 Migration idempotent', JSON.stringify(M.normalizeAvailability(mig).days.mo)===JSON.stringify(M.normalizeAvailability(M.normalizeAvailability(mig)).days.mo));
// 7 exakt zwei Slots
ok('4e.1-7 Doppeleinheit immer genau 2 Slots', M.normalizeDoubleSession({enabled:true,sessions:[{}]}).sessions.length===2);
// 13 Ruhetag deaktiviert Training
let rd=M.normalizeAvailability({days:{di:{restDay:true,available:true,doubleSession:{enabled:true}}}}).days.di;
ok('4e.1-13 Ruhetag deaktiviert Training + Doppel', rd.available===false && rd.doubleSession.enabled===false);

// ---- Editor-Pipeline: Einzeltraining (1-5) ----
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb.avToggleOpen('mo');
els.av_mo_av=mkEl({checked:true}); els.av_mo_rest=mkEl({checked:false}); els.av_mo_dbl=mkEl({checked:false});
els.av_mo_s_time=mkSeg('evening'); els.av_mo_s_min=mkEl({value:'60'}); els.av_mo_s_sp=mkChips(['running','swimming']); els.av_mo_s_int=mkSeg('intense');
sb.saveAvailabilityEditor();
let mo=sb.PROFILE.availability.days.mo;
ok('4e.1-1/2/3/4/5 Einzeltraining gespeichert (Zeit/Dauer/Sportarten/Intensität)', mo.singleSession.preferredTime==='evening' && mo.singleSession.maxMinutes===60 && mo.singleSession.preferredSports.length===2 && mo.singleSession.intensityAllowed==='intense');

// ---- Doppeleinheit (6,8-12) ----
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb.avToggleOpen('di');
els.av_di_av=mkEl({checked:true}); els.av_di_rest=mkEl({checked:false}); els.av_di_dbl=mkEl({checked:true});
sb.avFlag('di'); // re-render mit Doppel-Slots
els.av_di_av=mkEl({checked:true}); els.av_di_rest=mkEl({checked:false}); els.av_di_dbl=mkEl({checked:true});
els.av_di_0_time=mkSeg('morning'); els.av_di_0_min=mkEl({value:'45'}); els.av_di_0_sp=mkChips(['swimming']); els.av_di_0_int=mkSeg('easy');
els.av_di_1_time=mkSeg('evening'); els.av_di_1_min=mkEl({value:'60'}); els.av_di_1_sp=mkChips(['running']); els.av_di_1_int=mkSeg('intense');
sb.saveAvailabilityEditor();
let di=sb.PROFILE.availability.days.di;
ok('4e.1-6/8 Doppeleinheit aktiv + unterschiedliche Zeiten', di.doubleSession.enabled===true && di.doubleSession.sessions[0].preferredTime==='morning' && di.doubleSession.sessions[1].preferredTime==='evening');
ok('4e.1-9/10/11 unterschiedliche Dauer/Sportart/Intensität', di.doubleSession.sessions[0].maxMinutes===45 && di.doubleSession.sessions[1].maxMinutes===60 && di.doubleSession.sessions[0].preferredSports[0]==='swimming' && di.doubleSession.sessions[1].preferredSports[0]==='running' && di.doubleSession.sessions[0].intensityAllowed==='easy' && di.doubleSession.sessions[1].intensityAllowed==='intense');
ok('4e.1 nicht automatisch beide intensiv', !(di.doubleSession.sessions[0].intensityAllowed==='intense' && di.doubleSession.sessions[1].intensityAllowed==='intense'));
// 12 Deaktivieren erhält Slotwerte
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb.avToggleOpen('di');
els.av_di_av=mkEl({checked:true}); els.av_di_rest=mkEl({checked:false}); els.av_di_dbl=mkEl({checked:false}); sb.avFlag('di');
sb.saveAvailabilityEditor();
ok('4e.1-12 Deaktivieren erhält Slotwerte', sb.PROFILE.availability.days.di.doubleSession.enabled===false && sb.PROFILE.availability.days.di.doubleSession.sessions[0].maxMinutes===45);

// ---- Feste Verpflichtungen (14,15) ----
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb.avToggleOpen('mi');
sb.avAddFixed('mi'); sb.avAddFixed('mi');
let fids=sb._avEd.av.days.mi.fixedCommitments.map(c=>c.id);
els['av_mi_fix_'+fids[0]+'_type']=mkSeg('team_training'); els['av_mi_fix_'+fids[0]+'_start']=mkEl({value:'18:00'}); els['av_mi_fix_'+fids[0]+'_dur']=mkEl({value:'90'}); els['av_mi_fix_'+fids[0]+'_int']=mkSeg('moderate'); els['av_mi_fix_'+fids[0]+'_sport']=mkSeg('');
els['av_mi_fix_'+fids[1]+'_type']=mkSeg('work_school'); els['av_mi_fix_'+fids[1]+'_start']=mkEl({value:'08:00'}); els['av_mi_fix_'+fids[1]+'_dur']=mkEl({value:'480'}); els['av_mi_fix_'+fids[1]+'_int']=mkSeg('moderate'); els['av_mi_fix_'+fids[1]+'_sport']=mkSeg('');
sb.saveAvailabilityEditor();
let mi=sb.PROFILE.availability.days.mi;
ok('4e.1-14/15 mehrere feste Verpflichtungen speicherbar', mi.fixedCommitments.length===2 && mi.fixedCommitments[0].type==='team_training' && mi.fixedCommitments[0].durationMinutes===90 && mi.fixedCommitments[1].type==='work_school');

// ---- Wochenlimits + bevorzugte Ruhetage (16,17) ----
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor();
els.av_maxS=mkEl({value:'8'}); els.av_maxI=mkEl({value:'3'}); els.av_minRest=mkEl({value:'1'}); els.av_prefRest=mkChips(['fr']);
sb.saveAvailabilityEditor();
ok('4e.1-16/17 Wochenlimits + bevorzugte Ruhetage', sb.PROFILE.availability.maxSessionsPerWeek===8 && sb.PROFILE.availability.maxIntenseSessions===3 && sb.PROFILE.availability.minimumFullRestDays===1 && sb.PROFILE.availability.preferredRestDays.indexOf('fr')>=0);

// 20 Übersicht
let sum=M.availabilitySummary(sb.PROFILE.availability);
ok('4e.1-20 Profilübersicht (verfügbare Tage/Einheiten/Doppel/Ruhetage)', sum.maxSessionsPerWeek===8 && typeof sum.availableDays==='number' && sum.preferredRestDays.indexOf('fr')>=0);
// 24 Neustart
ok('4e.1-24 Werte nach Neustart erhalten', JSON.parse(store['orvia_profile_v1']).availability.days.di.doubleSession.sessions[0].maxMinutes===45);
// 21 Verwerfen schließt (unverändert)
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb._secDiscard=null; sb.cancelAvailabilityEditor();
ok('4e.1-21 unverändert → Abbrechen schließt ohne Discard', !sb._secDiscard);
// 22/23 kein <select>, keine engl. Codes sichtbar
clearEls(); els.avBody=mkEl(); sb.openAvailabilityEditor(); sb.avToggleOpen('mo');
ok('4e.1-22/23 kein <select>, deutsche Labels', els.avBody._html.indexOf('<select')<0 && els.avBody._html.indexOf('Morgens')>=0 && els.avBody._html.indexOf('>evening<')<0);

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
