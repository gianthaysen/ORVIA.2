/* Kontrakt: Anzeigemodus (uiDetailMode) ist entkoppelt von der Faehigkeitsstufe (userLevel/PROFILE.level).
   Umschalten des Modus darf NIE Plan/Engine-Eingaben veraendern. Laeuft mit: node supabase/tests/ui_detail_mode_test.mjs */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const uiPath=path.resolve(__dirname,_APPREL + 'js/ui.js');
const s=fs.readFileSync(uiPath,'utf8');
function extract(name){const m=s.search(new RegExp('\\nfunction '+name+'\\('));if(m<0)throw new Error('missing '+name);
  let j=s.indexOf('{',m),depth=0,k=j;for(;k<s.length;k++){if(s[k]==='{')depth++;else if(s[k]==='}'){depth--;if(depth===0)break;}}return s.slice(m+1,k+1);}
const src=['uiDetailMode','setUiDetailMode','applyLevelClass','setUserLevel'].map(extract).join('\n');
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
globalThis.document={documentElement:{classList:{remove(){},add(){}}}};
let saveProfileCalls=0;
globalThis.saveProfile=()=>{saveProfileCalls++;};
globalThis.toast=()=>{};globalThis.renderLevelBox=()=>{};globalThis.renderCommand=()=>{};
globalThis.PROFILE={level:'fortgeschritten'};
globalThis.userLevel=()=>(globalThis.PROFILE&&globalThis.PROFILE.level)||'fortgeschritten';
(0,eval)(src.replace(/function (uiDetailMode|setUiDetailMode|applyLevelClass|setUserLevel)/g,'globalThis.$1=function $1'));
let fails=0;const A=(c,m)=>{if(!c){console.error('FAIL:',m);fails++;}else console.log('ok -',m);};
A(uiDetailMode()==='fortgeschritten','Default spiegelt Faehigkeitsstufe (keine Aenderung fuer Bestandsnutzer)');
setUserLevel('profi');
A(uiDetailMode()==='profi','Anzeigemodus wechselt auf profi');
A(PROFILE.level==='fortgeschritten','PROFILE.level (Faehigkeit) unveraendert');
A(userLevel()==='fortgeschritten','userLevel() (Plan/Engine) unveraendert');
/* Kalibrierung GM7.5j (expliziter Auftrag: Darstellungseinstellungen geraeteuebergreifend
   ueber bestehende Cloud-Vertraege speichern): der Anzeigewechsel spiegelt uiDetailMode
   jetzt bewusst ueber saveProfile in das cloud-synchronisierte Profil. Der Kernvertrag
   bleibt unveraendert: NUR das Anzeigefeld wird geschrieben, nie die Faehigkeitsstufe. */
A(saveProfileCalls>=1&&PROFILE.uiDetailMode==='profi'&&PROFILE.level==='fortgeschritten','Anzeigewechsel spiegelt NUR uiDetailMode ins Profil (Cloud-Vertrag), Faehigkeit unveraendert');
setUserLevel('anfaenger');
A(localStorage.getItem('orvia_ui_mode')==='anfaenger','Anzeigemodus persistiert');
A(PROFILE.level==='fortgeschritten','Faehigkeit weiterhin unveraendert');
setUiDetailMode('bogus');
A(uiDetailMode()==='anfaenger','ungueltiger Wert ignoriert');
if(fails){console.error('\n'+fails+' FAILED');process.exit(1);}console.log('\nui_detail_mode_test: ALL PASSED');
