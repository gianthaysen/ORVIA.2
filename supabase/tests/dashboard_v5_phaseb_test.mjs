/* ORVIA · Phase B — Analyse-Identität + v5-Feinschliff. Vertragstest (statisch).
   node supabase/tests/dashboard_v5_phaseb_test.mjs */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;
const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const R=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const html=R(_APPREL + 'index.html'), css=R(_APPREL + 'styles.css');
let intel='';try{intel=R(_APPREL + 'js/intelligence.js');}catch(e){}

// Seiten-Identität: Tab heißt in der Bar "Analyse" → Seite muss mitziehen (v5)
ok('tab-dash h1 = "Analyse"', /<div id="tab-dash"[\s\S]{0,400}<h1>Analyse<\/h1>/.test(html));
ok('kein sichtbares <h1>Insights</h1> mehr', !html.includes('<h1>Insights</h1>'));
ok('obrand = ORVIA Intelligence (v5-Kopf)', /tab-dash[\s\S]{0,300}ORVIA Intelligence/.test(html));
ok('Sub-Zeile = v5-Entscheidungsraum-Wording', /Daten → Bedeutung → nächste Handlung/.test(html));

// v5-Farbsprache: dunkler Text auf Gold (Kontrast + Prototyp-Treue)
ok('.segs aktive Pille: dunkler Text auf Gold', /\.segs button\.on\{[^}]*color:#20180a/.test(css));
ok('.btn (gold) dunkler Text, sec/gline ausgenommen', /\.btn:not\(\.sec\):not\(\.gline\)\{[^}]*color:#20180a/.test(css));

// Insight-Karte im v5-Wording
ok('Intelligence-Karte: "Was ORVIA daraus macht"', intel.includes('Was ORVIA daraus macht'));
ok('kein "ORVIA Insights"-Kartentitel mehr', !intel.includes('>ORVIA Insights<'));

console.log('\n'+(fail?fail+' FAILED':'dashboard_v5_phaseb: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
