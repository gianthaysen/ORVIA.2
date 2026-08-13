import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass=0,fail=0;const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);c?pass++:fail++;};
(0,eval)(fs.readFileSync(new URL(_APPREL + 'js/calc.js',import.meta.url),'utf8'));
const P=globalThis.Calc.swimPace100;
ok('1000m in 1200s → 120s/100m',P(1000,1200)===120);
ok('distM<=0 → null',P(0,600)===null);
ok('durSec<=0 → null',P(500,0)===null);
ok('null-Eingaben → null',P(null,null)===null);
ok('endlich & positiv',isFinite(P(800,1000))&&P(800,1000)>0);
console.log('\nErgebnis: '+pass+' bestanden, '+fail+' fehlgeschlagen.');process.exit(fail?1:0);
