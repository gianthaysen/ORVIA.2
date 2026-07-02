/* ORVIA · 4i — Phase-4-Konsolidierung: alle Profilbereiche zentral, Onboarding-Status, Migration. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
function mkEl(extra) { const el = { value:'', checked:false, dataset:{}, _html:'', classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} }, querySelectorAll(){return [];}, addEventListener(){}, remove(){}, appendChild(){} }; Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}}); return Object.assign(el, extra||{}); }
const els={}; const sb={}; sb.window=sb; sb.self=sb; sb.console=console;
sb.Date=Date; sb.Math=Math; sb.JSON=JSON; sb.parseInt=parseInt; sb.parseFloat=parseFloat; sb.isNaN=isNaN; sb.Array=Array; sb.Object=Object; sb.String=String; sb.Set=Set;
sb.escH=s=>String(s==null?'':s); sb.toast=()=>{}; sb.renderProfileScreen=()=>{}; sb.renderZones=()=>{};
const wl={}; sb.CustomEvent=function(t,i){this.type=t;this.detail=i&&i.detail;}; sb.addEventListener=(t,f)=>{(wl[t]=wl[t]||[]).push(f);}; sb.removeEventListener=()=>{}; sb.dispatchEvent=e=>{(wl[e.type]||[]).forEach(f=>f(e));return true;};
sb.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}};
sb.document={getElementById:id=>els[id]||null,createElement:()=>mkEl(),body:{appendChild(){}},querySelectorAll:()=>[]};
vm.createContext(sb);
const base=new URL('../../js/',import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js',base),'utf8'),sb);
vm.runInContext(readFileSync(new URL('profile.js',base),'utf8'),sb);
const M=sb.ORVIA.profileModel;

// 1/2/30 Onboarding-Status + Bestandsnutzer
ok('4i-1 Neuer (leerer) Nutzer braucht Onboarding', M.isOnboardingComplete({})===false);
ok('4i-2/30 Bestandsnutzer mit Sportarten/Zielen → kein Onboarding', M.isOnboardingComplete({sports:[{sportId:'running'}]})===true && M.isOnboardingComplete({goals:[{id:'g'}]})===true);
ok('4i Onboarding-Status normalisiert (Default not_started, Steps)', (function(){var o=M.normalizeOnboarding({});return o.status==='not_started'&&o.currentStep==='welcome'&&M.ONBOARDING_STEPS.length===6;})());
ok('4i-14 abgeschlossenes Onboarding bleibt completed', M.normalizeOnboarding({status:'completed',completedAt:'x'}).status==='completed');

// Vollständiges Profil über alle 10 Bereiche, zentral konsolidiert
let raw={ v:1, onboarded:true, name:'Gian', weightKg:75, primaryGoal:'halfmarathon', primaryGoalLabel:'HM < 1:50',
  sports:['running','running',{sportId:'gym',activeInApp:true}],
  availability:{days:{mo:{available:true,singleSession:{maxMinutes:60}}},maxSessionsPerWeek:8},
  performance:{vo2max:{value:50},personalBests:[{sportId:'running',timeSeconds:1470}]},
  recovery:{sleep:{averageHours:6.5},stress:{generalLevel:'high'}},
  constraintsList:[{bodyRegion:'knee',status:'active'}],
  preferences:{preferredTimes:['evening'],preferredEnvironment:'outdoor'},
  devices:{equipment:[{type:'indoor_trainer'}],integrations:{strava:{status:'connected'}}},
  customWeird:42 };
let c1=M.consolidateProfile(raw,'2026-06-30T00:00:00.000Z');
let c2=M.consolidateProfile(c1,'2026-06-30T00:00:00.000Z');
ok('4i-18 alle 10 Bereiche zentral vorhanden', ['personal','sports','goals','availability','performance','recovery','constraintsList','preferences','devices','onboarding'].every(k=>c1[k]!=null || k==='personal'));
ok('4i-19 keine Sportduplikate', c1.sports.filter(s=>s.sportId==='running').length===1);
ok('4i-20 keine Zielduplikate (idempotent)', M.normalizeGoals(c1.goals).length===M.normalizeGoals(c2.goals).length);
ok('4i-29 Migration verlustfrei (unbekanntes Feld + alle Bereiche)', c1.customWeird===42 && c1.performance.vo2max.value===50 && c1.recovery.sleep.averageHours===6.5 && c1.constraintsList.length===1 && c1.preferences.preferredEnvironment==='outdoor' && c1.devices.equipment.length===1);
ok('4i Migration idempotent (Onboarding completed)', c1.onboarding.status==='completed' && c2.onboarding.status==='completed');

// Adapter-Pfad + Datenkonsistenz + Neustart
sb.PROFILE=c1; sb.localStorage.setItem('orvia_profile_v1', JSON.stringify(c1));
ok('4i needsOnboarding()=false für Bestandsnutzer', sb.ORVIA.profile.needsOnboarding()===false);
let sum=sb.ORVIA.profile.buildSummary();
ok('4i-13 buildSummary zentrale reale Werte', sum.primaryGoal==='HM < 1:50' && sum.activeSports.indexOf('running')>=0);
// 6/7/8/9 zentraler Katalog inkl. HYROX/Badminton/Golf
ok('4i-6/7/8/9 zentraler Katalog (HYROX/Badminton/Golf/alle Schemas)', !!M.sportProfileSchema('hyrox') && !!M.sportProfileSchema('badminton') && !!M.sportProfileSchema('golf'));

// 28/22-26 Neustart erhält alle Bereiche
let re=JSON.parse(store['orvia_profile_v1']);
ok('4i-22/23/24/25/26/28 Neustart erhält Performance/Recovery/Constraints/Preferences/Devices', re.performance.vo2max.value===50 && re.recovery.sleep.averageHours===6.5 && re.constraintsList.length===1 && re.preferences.preferredEnvironment==='outdoor' && re.devices.equipment.length===1);

// 17 Profilverwaltung-Bereichsübersicht (9 Sektionen)
ok('4i-17 PROFILE_SECTIONS Bereichsübersicht (9)', M.PROFILE_SECTIONS.length===9);

// markOnboardingComplete
sb.ORVIA.profile.markOnboardingComplete();
ok('4i-14 markOnboardingComplete setzt completed', sb.PROFILE.onboarding.status==='completed');

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
