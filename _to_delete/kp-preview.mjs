import fs from 'fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GV=require('../app/js/gym-volume.js'),SPG=require('../app/js/engine/strength-progression.js'),S=require('../app/js/engine/strength-profile.js');
require('../app/js/i18n.js');require('../app/locales/de.js');
/* icon() aus gm-icons.js im Sandbox-Kontext holen */
const vm=require('vm');const ctx={window:{},document:{}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('../app/js/gm-icons.js','utf8').replace(/window\.addEventListener[^;]*;/g,''),ctx);
globalThis.icon=ctx.window.GMICONS.icon;
require('../app/js/screens/strength-profile.js');const SCR=globalThis.ORVIA.strengthProfileScreen;
function d(i){return new Date(Date.UTC(2026,5,1)+i*7*864e5).toISOString().slice(0,10);}
const rnd=(i,k)=>((i*7+k*13)%5)*0.5;
function sess(i){const w=60+i*2.5-rnd(i,1);const ex=[
 {exerciseNameSnapshot:'Kniebeuge',sets:[{completed:true,setType:'warmup',weight:40,reps:8}].concat([1,2,3,4].map(n=>({completed:true,setType:'working',weight:w,reps:6,rir:2,setNumber:n})))},
 {exerciseNameSnapshot:'Rumänisches Kreuzheben',sets:[1,2,3].map(n=>({completed:true,weight:70+i*1.25,reps:8,rir:2}))},
 {exerciseNameSnapshot:'Bankdrücken',sets:[{completed:true,weight:60,reps:5,rir:1},{completed:true,weight:60,reps:5,rir:1},{completed:true,weight:60,reps:5,rir:0}]},
 {exerciseNameSnapshot:'Schulterdrücken',sets:[1,2,3].map(n=>({completed:true,weight:35+Math.floor(i/3)*2.5,reps:8-(i%2),rir:2}))},
 {exerciseNameSnapshot:'Rudern LH',sets:[{completed:true,weight:50+i,reps:8},{completed:true,weight:50+i,reps:8},{completed:true,weight:50+i,reps:7}]},
 {exerciseNameSnapshot:'Klimmzüge',sets:[{completed:true,reps:8+(i>5?1:0)},{completed:true,reps:7}]},
 {exerciseNameSnapshot:'Plank',sets:[{completed:true,durationS:60+i*5}]}];
 if(i<3)ex.push({exerciseNameSnapshot:'Beinpresse',sets:[{completed:true,weight:150,reps:10}]});
 return {workoutId:'w'+i,startedAt:d(i)+'T18:00:00Z',exercises:ex};}
const SN=[];for(let i=0;i<10;i++)SN.push(sess(i));SN[3].exercises[0].sets.push({completed:true,setType:'test',weight:90,reps:1});
const goals=[{id:'g1',title:'Kniebeuge 120 kg',category:'lift_pr',targetValue:120,status:'active',targetDate:'2026-12-01'}];
const css=fs.readFileSync('../app/styles.css','utf8');
function page(m,name){const body=SCR.body(m);return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="orvia-sheet-backdrop" style="position:static"><section class="orvia-sheet orvia-sheet--full" style="position:static;max-height:none;height:auto"><header class="orvia-sheet-header"><h2 class="orvia-sheet-title">Kraftprofil<div class="gd-psub">Aus deinen geloggten Sätzen · 10 Einheiten · 9 Wochen</div></h2></header><div class="orvia-sheet-scroll" style="overflow:visible"><div id="kpBody" class="kp-body">${body}</div></div></section></div></body></html>`;}
const m=S.build(SN,{today:'2026-08-04',gymVolume:GV,strengthProgression:SPG,bodyweightKg:75,experience:'intermediate',goals});
SCR._state.grp='legs';SCR._state.ex='kniebeuge';SCR._state.pt=null;fs.writeFileSync('kp-prev-1.html',page(m));
SCR._state.grp='push';SCR._state.ex='bankdrücken';fs.writeFileSync('kp-prev-2.html',page(m));
const mi=S.build(SN,{today:'2026-08-04',gymVolume:GV,strengthProgression:SPG,bodyweightKg:75,experience:'intermediate',goals,injury:{active:true,label:'Knie links',stage:0,policy:{legStrength:false}}});
SCR._state.grp='legs';SCR._state.ex='beinpresse';fs.writeFileSync('kp-prev-3.html',page(mi));
console.log('ok');
