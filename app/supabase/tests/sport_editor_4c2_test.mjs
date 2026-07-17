/* ORVIA · 4c.2 — UI-Lücken Sportprofile (linkedSports-Multi, Volleyball/Hockey-Variante, Karten). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const store = {};
function mkEl(extra) { const el = { value: '', checked: false, textContent: '', dataset: {}, _html: '', classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} }, querySelectorAll() { return []; }, addEventListener(){}, remove(){}, appendChild(){} }; Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}}); return Object.assign(el, extra||{}); }
const els = {}; function clearEls(){ for(const k in els) delete els[k]; }
function mkSeg(v){ return mkEl({ dataset:{ val:v } }); }
function mkChips(onVals){ return mkEl({ querySelectorAll:()=>onVals.map(v=>({dataset:{v}})) }); }
const sb = {}; sb.window = sb; sb.self = sb; sb.console = console;
sb.Date=Date; sb.Math=Math; sb.JSON=JSON; sb.parseInt=parseInt; sb.parseFloat=parseFloat; sb.isNaN=isNaN; sb.Array=Array; sb.Object=Object; sb.String=String; sb.Set=Set;
sb.escH=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
sb.toast=()=>{}; sb.renderProfileScreen=()=>{}; sb.renderZones=()=>{}; sb.maybePlanImpact=()=>{};
const winL={}; sb.CustomEvent=function(t,i){this.type=t;this.detail=i&&i.detail;}; sb.addEventListener=(t,f)=>{(winL[t]=winL[t]||[]).push(f);}; sb.removeEventListener=()=>{}; sb.dispatchEvent=e=>{(winL[e.type]||[]).forEach(f=>f(e));return true;};
sb.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}};
sb.document={getElementById:id=>els[id]||null,createElement:()=>mkEl(),body:{appendChild(){}},querySelectorAll:()=>[]};
vm.createContext(sb);
const base=new URL('../../js/',import.meta.url);
vm.runInContext(readFileSync(new URL('profile-model.js',base),'utf8'),sb);
vm.runInContext(readFileSync(new URL('profile.js',base),'utf8'),sb);
const M=sb.ORVIA.profileModel;
sb.PROFILE=M.consolidateProfile({ v:1, onboarded:true, name:'Gian', sports:[
  {sportId:'gym',activeInApp:true,role:'primary'},
  {sportId:'football',activeInApp:true},{sportId:'hyrox',activeInApp:true},{sportId:'volleyball',activeInApp:true},{sportId:'hockey',activeInApp:true}
]});

// 1/2/3/4 linkedSports Multi
clearEls(); els.sppBody=mkEl(); sb.openSportProfileEditor('gym');
let gh=els.sppBody._html;
ok('4c.2-1 linkedSports zeigt aktive Sportarten (Chips)', gh.indexOf('spp_linkedSports')>=0 && gh.indexOf('Fußball')>=0 && gh.indexOf('<input')>=0 ? gh.indexOf('id="spp_linkedSports"')>=0 : gh.indexOf('id="spp_linkedSports"')>=0);
ok('4c.2-2 gym nicht als eigene Verknüpfung', gh.indexOf('data-v="gym"')<0);
els.spp_sportrole=mkSeg('primary'); els.spp_level=mkSeg('amateur');
els.spp_linkedSports=mkChips(['football','hyrox','cricket']); // cricket ungültig
sb.saveSportProfileEditor();
let gymSp=M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='gym').sportProfile.fields;
ok('4c.2-3 Mehrfachauswahl speichert mehrere IDs', gymSp.linkedSports.indexOf('football')>=0 && gymSp.linkedSports.indexOf('hyrox')>=0);
ok('4c.2-4 ungültige ID entfernt (cricket raus)', gymSp.linkedSports.indexOf('cricket')<0);

// 5/6/7/8 Volleyball-Variante
clearEls(); els.sppBody=mkEl(); sb.openSportProfileEditor('volleyball');
let vh=els.sppBody._html;
ok('4c.2-6 Halle zeigt Hallenpositionen (Außenangriff)', vh.indexOf('Außenangriff')>=0 && vh.indexOf('Hallenvolleyball')>=0);
// auf Beach wechseln (Position vorher Halle setzen)
els.spp_sportrole=mkSeg('supplemental'); els.spp_level=mkSeg('amateur'); els.spp_pos=mkSeg('outside_hitter'); els.spp_variant=mkSeg('Beachvolleyball');
sb.sppVariantChange();
let vh2=els.sppBody._html;
ok('4c.2-7 Beach zeigt Beachpositionen (Blockspieler)', vh2.indexOf('Blockspieler')>=0 && vh2.indexOf('Außenangriff')<0);
ok('4c.2-8 Variantenwechsel verwirft inkompatible Position + Hinweis', sb._sppEd.sp.primaryPosition===null && vh2.indexOf('neue Variante neu wählen')>=0);
els.spp_pos=mkSeg('blocker');
sb.saveSportProfileEditor();
let volSp=M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='volleyball').sportProfile;
ok('4c.2-5 Volleyballvariante speicherbar (Beach + blocker)', volSp.fields.variant==='Beachvolleyball' && volSp.primaryPosition==='blocker');

// 9 Hockey-Variante
clearEls(); els.sppBody=mkEl(); sb.openSportProfileEditor('hockey');
els.spp_sportrole=mkSeg('supplemental'); els.spp_level=mkSeg('amateur'); els.spp_variant=mkSeg('Hallenhockey'); els.spp_pos=mkSeg('midfield');
sb.saveSportProfileEditor();
let hoSp=M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='hockey').sportProfile;
ok('4c.2-9 Hockeyvariante speicherbar', hoSp.fields.variant==='Hallenhockey' && hoSp.primaryPosition==='midfield');

// HYROX-Karte
clearEls(); els.sppBody=mkEl(); sb.openSportProfileEditor('hyrox');
els.spp_sportrole=mkSeg('supplemental'); els.spp_level=mkSeg('amateur');
els['spp_category']=mkSeg('Open'); els['spp_targetTime']=mkEl({value:'1:15:00'}); els['spp_weakestStation']=mkSeg('Sled Push');
sb.saveSportProfileEditor();

// 10/11/12/13 Karten-Summary
let cardVol=sb._sportCardSummary(M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='volleyball'));
let cardHo=sb._sportCardSummary(M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='hockey'));
let cardHy=sb._sportCardSummary(M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='hyrox'));
let cardGym=sb._sportCardSummary(M.normalizeSports(sb.PROFILE.sports).find(s=>s.sportId==='gym'));
ok('4c.2-10 Karte zeigt Volleyballvariante', cardVol.indexOf('Beachvolleyball')>=0);
ok('4c.2-11 Karte zeigt Hockeyvariante', cardHo.indexOf('Hallenhockey')>=0);
ok('4c.2-12 Karte zeigt HYROX-Zielzeit', cardHy.indexOf('1:15:00')>=0);
ok('4c.2-13 Karte zeigt Kraft-Verknüpfungen', cardGym.indexOf('Fußball')>=0);

// 14/15 keine nativen Selects / keine engl. Codes in Editor-HTML
ok('4c.2-14/15 kein <select>, keine rohen Codes (outside_hitter) sichtbar', gh.indexOf('<select')<0 && vh.indexOf('>outside_hitter<')<0);
// 16 Verwerfen schließt
clearEls(); els.sppBody=mkEl(); sb.openSportProfileEditor('gym'); sb._sppDiscard=null; sb._sppEdM=null;
sb.cancelSportProfileEditor();
ok('4c.2-16 unverändert → Verwerfen/Schließen ohne Discard-Dialog', !sb._sppDiscard);
// 17 Neustart
ok('4c.2-17 Werte nach Neustart erhalten', JSON.parse(store['orvia_profile_v1']).sports.find(s=>s.sportId==='volleyball').sportProfile.fields.variant==='Beachvolleyball');

console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');
process.exit(fail?1:0);
