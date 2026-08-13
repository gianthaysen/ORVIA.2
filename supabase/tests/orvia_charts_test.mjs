/* ORVIA · Phase C — Chart-Modul (richChart-Port aus dem v5-Prototyp).
   Kontrakt: eigenständiges Modul, reine Helfer testbar, deutsche Formatierung,
   Interaktion (Pointer/Tastatur) + Reduced-Motion im Code, korrekt registriert
   (Script-Tag vor ui.js, SW-Asset, .oc2-Styles). node supabase/tests/orvia_charts_test.mjs */
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

let M=null;
try{ M=(await import(new URL(_APPREL + 'js/orvia-charts.js',import.meta.url))).default; }catch(e){}
ok('Modul js/orvia-charts.js ladbar (module.exports)', !!M);
if(M){
  ok('API vollständig (richChart/sparkline/smoothLine/splineAt/fmtNum/colorOf)',
    ['richChart','sparkline','smoothLine','splineAt','fmtNum','colorOf'].every(k=>typeof M[k]==='function'));
  const pts=[[0,10],[10,0],[20,10],[30,4]];
  const d=M.smoothLine(pts);
  ok('smoothLine: Bézier-Pfad (M…C…, Prototyp-Format)', /^M0\.0 10\.0C/.test(d) && (d.match(/C/g)||[]).length===3);
  const p0=M.splineAt(pts,0), p3=M.splineAt(pts,3), pm=M.splineAt(pts,1.5);
  ok('splineAt: Endpunkte exakt auf Datenpunkten', Math.abs(p0[0]-0)<1e-9&&Math.abs(p0[1]-10)<1e-9&&Math.abs(p3[0]-30)<1e-9&&Math.abs(p3[1]-4)<1e-9);
  ok('splineAt: Zwischenwert liegt zwischen den Stützstellen (x)', pm[0]>10&&pm[0]<20);
  ok('fmtNum: deutsches Komma + Dezimalstellen', M.fmtNum(74.25,1)==='74,3'&&M.fmtNum(5,0)==='5'&&M.fmtNum(6.5,2)==='6,50');
  ok('colorOf: Token → CSS-Var, Fremdwert unverändert', M.colorOf('ready').indexOf('var(--')===0 && M.colorOf('#123456')==='#123456');
}
const src=(()=>{try{return R(_APPREL + 'js/orvia-charts.js');}catch(e){return '';}})();
ok('Scrubbing: pointerdown/pointermove + Tastatur (ArrowLeft/Right)', /pointerdown/.test(src)&&/pointermove/.test(src)&&/ArrowLeft/.test(src)&&/ArrowRight/.test(src));
ok('Reduced-Motion-Guard im Modul', /prefers-reduced-motion/.test(src));
ok('keine Demo-Daten im Modul', !/Bankdrücken|Gian|82,?\s*ORVIA-SCORE/.test(src));

const html=R(_APPREL + 'index.html');
ok('Script-Tag registriert und VOR js/ui.js', html.includes('src="js/orvia-charts.js"') && html.indexOf('js/orvia-charts.js')<html.indexOf('src="js/ui.js"'));
const sw=R(_APPREL + 'sw.js');
ok('SW-Asset ./js/orvia-charts.js registriert', sw.includes("'./js/orvia-charts.js'"));
const css=R(_APPREL + 'styles.css');
ok('.oc2-Chartstyles vorhanden (Linie/Grid/Baseline/Readout)', /\.oc2 \.g-line\{/.test(css)&&/\.oc2 \.g-grid\{/.test(css)&&/\.oc2 \.g-base\{/.test(css)&&/\.oc-read2\{/.test(css));
ok('.oc2 Reduced-Motion-Regel', /prefers-reduced-motion[^}]*\{[^}]*\.oc2|\.oc2[^{]*\{[^}]*transition:none/.test(css)||/@media \(prefers-reduced-motion:reduce\)\{[^}]*g-line/.test(css));

console.log('\n'+(fail?fail+' FAILED':'orvia_charts: ALL PASSED')+' ('+pass+' ok)');
if(fail)process.exit(1);
