/* ORVIA · 4f — Körper- & Leistungsdaten (Modell + Editor-Pipeline). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
function mkEl(extra) { const el = { value: '', checked: false, dataset: {}, _html: '', classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} }, querySelectorAll(){return [];}, addEventListener(){}, remove(){}, appendChild(){} }; Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}}); return Object.assign(el, extra||{}); }
const els = {}; function clearEls(){ for(const k in els) delete els[k]; }
function mkSeg(v){ return mkEl({ dataset:{ val:v } }); }
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

// ---- Modell ----
ok('4f-8 parseDuration/formatDuration (Sekunden intern)', M.parseDuration('7:20')===440 && M.formatDuration(440)==='7:20' && M.parseDuration('1:15:00')===4500);
ok('4f-18/19 1RM Epley + als Schätzung markiert', (function(){var r=M.normalizeStrengthRecord({exerciseName:'Bankdrücken',weightKg:80,repetitions:5,setType:'working'});return r.estimatedOneRepMax>92&&r.estimatedOneRepMax<94&&r.oneRmEstimated===true;})());
ok('4f 1RM nur bei sinnvollen Werten', M.normalizeStrengthRecord({exerciseName:'X',weightKg:80}).estimatedOneRepMax===null);
ok('4f-26 ungültige Werte → null (negatives Gewicht)', M.normalizeWeightEntry({valueKg:-5}).valueKg===null && M.normalizePersonalBest({timeSeconds:-3}).timeSeconds===null);
ok('4f-4 currentWeightKg = jüngste Messung', M.currentWeightKg({weightHistory:[{valueKg:75.1,measuredAt:'2026-06-29'},{valueKg:74.8,measuredAt:'2026-06-22'}]})===75.1);
ok('4f-27/28 Legacy-Freitext erhalten + Migration idempotent', (function(){var p=M.normalizePerformance({}, {bestTimes:'HM 1:58',lifts:'BD 80x5'});var p2=M.normalizePerformance(p);return p._legacyText.bestTimes==='HM 1:58' && p2._legacyText.bestTimes==='HM 1:58';})());

// ---- Editor-Pipeline ----
sb.PROFILE=M.consolidateProfile({ v:1, onboarded:true, name:'Gian', sports:[{sportId:'running',activeInApp:true,role:'primary'},{sportId:'cycling',activeInApp:true},{sportId:'gym',activeInApp:true}] });

// 1 Gewichtsmessung hinzufügen
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager();
sb.openWeightAdd(); els.wa_val=mkEl({value:'75.1'}); els.wa_date=mkEl({value:'2026-06-29'}); sb.saveWeightAdd();
ok('4f-1 Gewichtsmessung hinzugefügt', sb.PROFILE.performance.weightHistory.length===1 && sb.PROFILE.performance.weightHistory[0].valueKg===75.1);
sb.openWeightAdd(); els.wa_val=mkEl({value:'74.8'}); els.wa_date=mkEl({value:'2026-06-22'}); sb.saveWeightAdd();
ok('4f-4 aktuelles Gewicht = jüngste (75,1)', M.currentWeightKg(sb.PROFILE.performance)===75.1);
let wid=sb.PROFILE.performance.weightHistory.find(e=>e.valueKg===74.8).id; sb.perfDelWeight(wid);
ok('4f-3 Gewichtsmessung gelöscht', sb.PROFILE.performance.weightHistory.length===1);

// 5/6 VO2max + Sportart, FTP, Schwellenpace, CSS
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager(); sb.openEnduranceEditor();
els.en_vo2=mkEl({value:'50'}); els.en_vo2sport=mkSeg('running'); els.en_ftp=mkEl({value:'245'}); els.en_tp=mkEl({value:'4:10'}); els.en_css=mkEl({value:'1:40'}); els.en_row=mkEl({value:'7:20'});
sb.saveEnduranceEditor();
let perf=sb.PROFILE.performance;
ok('4f-5/6 VO₂max + Sportart gespeichert', perf.vo2max.value===50 && perf.vo2max.sportId==='running' && perf.vo2max.source==='manual' && !!perf.vo2max.measuredAt);
ok('4f-22/23/24 FTP/Schwellenpace/CSS gespeichert', perf.ftp.valueWatts===245 && perf.thresholdPace.secondsPerKm===250 && perf.cssPace.secondsPer100m===100 && perf.rowing2k.timeSeconds===440);

// 7-16 Bestzeit hinzufügen (Lauf) + bearbeiten + löschen
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager(); sb.openPbEditor();
els.pb_sport=mkSeg('running'); els.pb_dist=mkEl({value:'5 km'}); els.pb_time=mkEl({value:'24:30'}); els.pb_ctx=mkSeg('race'); els.pb_date=mkEl({value:'2026-06-14'}); els.pb_notes=mkEl({value:''});
sb.savePbEditor('');
let pb=sb.PROFILE.performance.personalBests[0];
ok('4f-7/8/11 Bestzeit gespeichert (Sekunden intern)', pb.sportId==='running' && pb.timeSeconds===1470 && pb.distance==='5 km' && pb.measuredAt==='2026-06-14');
clearEls(); els.perfBody=mkEl(); sb.openPbEditor(pb.id); els.pb_sport=mkSeg('running'); els.pb_dist=mkEl({value:'5 km'}); els.pb_time=mkEl({value:'24:00'}); els.pb_ctx=mkSeg('race'); els.pb_date=mkEl({value:'2026-06-14'}); els.pb_notes=mkEl({value:''}); sb.savePbEditor(pb.id);
ok('4f-9 Bestzeit bearbeitet', sb.PROFILE.performance.personalBests[0].timeSeconds===1440);
sb.perfDelPb(pb.id);
ok('4f-10 Bestzeit gelöscht', sb.PROFILE.performance.personalBests.length===0);

// 17-21 Kraftwert hinzufügen + 1RM + bearbeiten + löschen
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager(); sb.openSrEditor();
els.sr_ex=mkEl({value:'Bankdrücken'}); els.sr_w=mkEl({value:'80'}); els.sr_r=mkEl({value:'5'}); els.sr_type=mkSeg('working'); els.sr_date=mkEl({value:'2026-06-29'}); els.sr_notes=mkEl({value:''});
sb.saveSrEditor('');
let sr=sb.PROFILE.performance.strengthRecords[0];
ok('4f-17/18/19 Kraftwert + geschätztes 1RM (Schätzung)', sr.exerciseName==='Bankdrücken' && sr.weightKg===80 && sr.estimatedOneRepMax>92 && sr.oneRmEstimated===true);
clearEls(); els.perfBody=mkEl(); sb.openSrEditor(sr.id); els.sr_ex=mkEl({value:'Bankdrücken'}); els.sr_w=mkEl({value:'85'}); els.sr_r=mkEl({value:'3'}); els.sr_type=mkSeg('top_set'); els.sr_date=mkEl({value:'2026-06-29'}); els.sr_notes=mkEl({value:''}); sb.saveSrEditor(sr.id);
ok('4f-20 Kraftwert bearbeitet', sb.PROFILE.performance.strengthRecords[0].weightKg===85);
sb.perfDelSr(sr.id);
ok('4f-21 Kraftwert gelöscht', sb.PROFILE.performance.strengthRecords.length===0);

// 26 Validierung Körperfett
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager(); sb.openBodyEditor();
els.bd_height=mkEl({value:'180'}); els.bd_weight=mkEl({value:'75'}); els.bd_bodyFat=mkEl({value:'150'}); els.bd_leanMass=mkEl({value:''}); els.bd_waist=mkEl({value:''}); els.bd_restingHr=mkEl({value:''}); els.bd_maxHr=mkEl({value:''}); els.bd_err=mkEl();
sb.saveBodyEditor();
ok('4f-26 ungültiges Körperfett abgelehnt', els.bd_err.textContent.length>0 && sb.PROFILE.performance.body.bodyFat.value!==150);
els.bd_bodyFat=mkEl({value:'12'}); sb.saveBodyEditor();
ok('4f Körperdaten + Quelle/Datum gespeichert', sb.PROFILE.performance.body.height.value===180 && sb.PROFILE.performance.body.bodyFat.value===12 && sb.PROFILE.performance.body.height.source==='manual' && !!sb.PROFILE.performance.body.height.measuredAt);

// 31 Neustart
ok('4f-31 Werte nach Neustart erhalten', JSON.parse(store['orvia_profile_v1']).performance.vo2max.value===50);
// 30 Verfügbarkeitszusammenfassung verdrahtet + 29 Profilzusammenfassung
clearEls(); els.perfBody=mkEl(); sb.PROFILE.availability=M.normalizeAvailability({days:{mo:{available:true},di:{available:true}},maxSessionsPerWeek:8,preferredRestDays:['fr']});
sb.openProfileSummary(); let psHTML=sb._profSum&&sb._profSum._html;
ok('4f-30 Verfügbarkeitszusammenfassung verdrahtet', psHTML && psHTML.indexOf('verfügbare Tage')>=0 && psHTML.indexOf('Bis zu 8 Einheiten')>=0);
ok('4f-29 Profilzusammenfassung Körper/Leistung', psHTML && psHTML.indexOf('Körper und Leistung')>=0);
// 32 keine nativen Selects im Editor
clearEls(); els.perfBody=mkEl(); sb.openPerformanceManager();
ok('4f-32 kein <select> im Performance-Manager', sb._perfMgr._html.indexOf('<select')<0);

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
