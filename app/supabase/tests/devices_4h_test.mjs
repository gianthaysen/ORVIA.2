/* ORVIA · 4h — Geräte, Trainingsausstattung & Datenquellen (keine Fake-Verbindungen). */
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
const wl={}; sb.CustomEvent=function(t,i){this.type=t;this.detail=i&&i.detail;}; sb.addEventListener=(t,f)=>{(wl[t]=wl[t]||[]).push(f);}; sb.removeEventListener=()=>{}; sb.dispatchEvent=e=>{(wl[e.type]||[]).forEach(f=>f(e));return true;};
sb.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}};
sb.document={getElementById:id=>els[id]||null,createElement:()=>mkEl(),body:{appendChild(){}},querySelectorAll:()=>[]};
vm.createContext(sb);
const base=new URL('../../js/',import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js',base),'utf8'),sb);
vm.runInContext(readFileSync(new URL('profile.js',base),'utf8'),sb);
const M=sb.ORVIA.profileModel;

// ---- Modell: ehrliche Defaults + keine Fake-Capabilities (9,10,11,12,16,17) ----
let dv=M.normalizeDevices({},['Garmin','Strava']);
ok('4h-10 Garmin nicht fälschlich verbunden', dv.integrations.garmin.status==='not_connected' && dv.integrations.garmin.connected===false);
ok('4h-11 Apple Health Verfügbarkeitsstatus', dv.integrations.appleHealth.status==='not_available');
ok('4h-9/12 not_connected → keine Capabilities (auch wenn übergeben)', M.normalizeIntegration('strava',{status:'not_connected',capabilities:['heartRate']}).capabilities.length===0);
ok('4h-7 connected spiegelt echten Status + Capabilities', (function(){var i=M.normalizeIntegration('strava',{status:'connected',lastSyncAt:'2026-06-29 08:45',capabilities:['activities','route']});return i.connected===true && i.lastSyncAt==='2026-06-29 08:45' && i.capabilities.indexOf('activities')>=0;})());
ok('4h-12 historische Quelle (Legacy) erzeugt keine Verbindung', dv._legacyText.indexOf('Garmin')>=0 && dv.integrations.garmin.connected===false);
ok('4h-16/17 Migration idempotent', JSON.stringify(M.normalizeDevices(dv))===JSON.stringify(M.normalizeDevices(M.normalizeDevices(dv))));

// ---- Editor-Pipeline ----
sb.PROFILE=M.consolidateProfile({ v:1, onboarded:true, name:'Gian', sports:[{sportId:'running',activeInApp:true}], dataSources:['Garmin'] });

// 1/2/3 Ausstattung CRUD
clearEls(); els.devBody=mkEl(); sb.openDevicesManager();
sb.openEquipmentEditor(); els.eq_type=mkSeg('indoor_trainer'); els.eq_label=mkEl({value:''}); els.eq_avail=mkEl({checked:true}); els.eq_notes=mkEl({value:''}); sb.saveEquipmentEditor('');
ok('4h-1 Ausstattung hinzugefügt', sb.PROFILE.devices.equipment.length===1 && sb.PROFILE.devices.equipment[0].type==='indoor_trainer');
let eid=sb.PROFILE.devices.equipment[0].id;
clearEls(); els.devBody=mkEl(); sb.openEquipmentEditor(eid); els.eq_type=mkSeg('indoor_trainer'); els.eq_label=mkEl({value:'Wahoo'}); els.eq_avail=mkEl({checked:false}); els.eq_notes=mkEl({value:''}); sb.saveEquipmentEditor(eid);
ok('4h-2 Ausstattung bearbeitet', sb.PROFILE.devices.equipment[0].label==='Wahoo' && sb.PROFILE.devices.equipment[0].available===false);
sb.devDelEquip(eid);
ok('4h-3 Ausstattung gelöscht', sb.PROFILE.devices.equipment.length===0);

// 4/5/6 Trainingsort CRUD
clearEls(); els.devBody=mkEl(); sb.openDevicesManager(); sb.openLocationEditor();
els.loc_type=mkSeg('gym'); els.loc_name=mkEl({value:'McFit'}); els.loc_caps=mkChips(['barbell','machines']); els.loc_days=mkChips(['mo','di']); sb.saveLocationEditor('');
ok('4h-4 Trainingsort hinzugefügt', sb.PROFILE.devices.trainingLocations.length===1 && sb.PROFILE.devices.trainingLocations[0].name==='McFit' && sb.PROFILE.devices.trainingLocations[0].capabilities.indexOf('barbell')>=0);
let lid=sb.PROFILE.devices.trainingLocations[0].id;
clearEls(); els.devBody=mkEl(); sb.openLocationEditor(lid); els.loc_type=mkSeg('gym'); els.loc_name=mkEl({value:'McFit Nord'}); els.loc_caps=mkChips(['barbell']); els.loc_days=mkChips(['mo']); sb.saveLocationEditor(lid);
ok('4h-5 Trainingsort bearbeitet', sb.PROFILE.devices.trainingLocations[0].name==='McFit Nord');
sb.devDelLoc(lid);
ok('4h-6 Trainingsort gelöscht', sb.PROFILE.devices.trainingLocations.length===0);

// 13 manuelle Quellen
clearEls(); els.devBody=mkEl(); sb.openDevicesManager(); els.dev_manual=mkChips(['manual','gpx']); sb.devSaveManual();
ok('4h-13 manuelle Quellen speicherbar', sb.PROFILE.devices.manualSources.length===2 && sb.PROFILE.devices.manualSources.some(m=>m.type==='gpx'));

// 14 Geräteübersicht (Integrationskarten ehrlich, kein Fake)
clearEls(); els.devBody=mkEl(); sb.openDevicesManager(); let dh=els.devBody._html;
ok('4h-14/21 Übersicht ehrlich (Garmin „Nicht verbunden", Apple Health „Nicht verfügbar", kein „Verbunden")', dh.indexOf('Nicht verbunden')>=0 && dh.indexOf('Nicht verfügbar')>=0 && dh.indexOf('Verbunden')<0 && dh.indexOf('<select')<0);

// 15 Profilzusammenfassung
clearEls(); sb.openProfileSummary(); let ps=sb._profSum&&sb._profSum._html;
ok('4h-15 Profilzusammenfassung Geräte/Datenquellen', ps && ps.indexOf('Geräte und Datenquellen')>=0 && ps.indexOf('Strava nicht verbunden')>=0 && ps.indexOf('Garmin nicht verbunden')>=0);

// 18 Neustart
ok('4h-18 Werte nach Neustart erhalten', JSON.parse(store['orvia_profile_v1']).devices.manualSources.length===2);
// 20 keine englischen Statuscodes sichtbar
ok('4h-20 keine englischen Statuscodes sichtbar', dh.indexOf('not_connected')<0 && dh.indexOf('not_available')<0);

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
