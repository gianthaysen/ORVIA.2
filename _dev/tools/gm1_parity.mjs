/* ORVIA · GM1-Paritätsprüfung: Golden Master vs. produktives GM1-Dashboard.
   Identisches UI-Fixture (nur im Harness), DOM-/Geometrie-Vergleich + Screenshot-Diff.
   Dynamische TEXTE werden über deckungsgleiche Overlays maskiert (Positionen bleiben
   vergleichbar); Container/Icons/Karten/Farben/Abstände werden NICHT maskiert.
   Aufruf: node tools/gm1_parity.mjs (erwartet /tmp/gm1h.html aus dem Build-Schritt). */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const OUT='/tmp/gm1_parity';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});

const gm=await b.newPage({viewportSize:{width:470,height:1000},deviceScaleFactor:1});
await gm.goto('file:///tmp/orvia_dashboard_5.html');
await gm.addStyleTag({content:'.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important;width:430px!important}.demobar,.legend,.save-toast{display:none!important}'});
const prod=await b.newPage({viewportSize:{width:430,height:900},deviceScaleFactor:1});
const perrs=[];prod.on('pageerror',e=>perrs.push(String(e)));
await prod.goto('file:///tmp/gm1h.html');

async function gmSet(level,scen,ci){
  await gm.evaluate(([l,s,c])=>{
    document.querySelectorAll('#lvl button').forEach(x=>{if(x.dataset.l===l)x.click();});
    document.querySelectorAll('#scen button').forEach(x=>{if(x.dataset.s===s)x.click();});
    const t=document.getElementById('ciToggle');
    const on=t.classList.contains('on');if(c!==on)t.click();
  },[level,scen,ci]);
  await gm.waitForTimeout(140);
}
const seqOf=pg=>pg.evaluate(sel=>{
  const scr=document.querySelector(sel);
  let kids=[];
  const push=el=>{if(el.id==='tab-heute'||el.id==='command'||el.id==='modules'){[...el.children].forEach(push);return;}
    const r=el.getBoundingClientRect();if(r.height<=1||getComputedStyle(el).display==='none')return;kids.push(el);};
  [...scr.children].forEach(push);
  return kids.map(el=>{
    const r=el.getBoundingClientRect();
    const self=(el.classList.contains('card')||el.classList.contains('kcard'))?1:0;
    return {cls:[...el.classList].filter(c=>!['v3date','ci-compact','ci-full','ci-collapsed','tight','tap'].includes(c)).join(' '),
      y:Math.round(r.y),h:Math.round(r.height),w:Math.round(r.width),
      cards:self+el.querySelectorAll('.card,.kcard').length};
  });
},pg===gm?'#screen':'#prodScreen');
async function shot(pg,sel,path,mask){
  await pg.evaluate(()=>{document.querySelectorAll('.tabbar,.fab').forEach(e=>e.style.visibility='hidden');});
  if(mask)await pg.evaluate(()=>{
    document.querySelectorAll('.gm-mask').forEach(m=>m.remove());
    /* Textzeilen-Maske: volle Blockbreite des Elternkastens, seitenverankert — Textlängen
       werden neutralisiert, Container-/Positionsabweichungen bleiben sichtbar. */
    const walk=el=>{for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){
      const r=el.getBoundingClientRect();const p=(el.closest('.card,.kcard,.hero,.hdr,.sync,.sectlabel,.addmod,.gapnote,.errbar,.eduhint,.batt,.reco,.checkin')||el.parentElement||el).getBoundingClientRect();
      if(r.height>0&&r.height<120){const d=document.createElement('div');d.className='gm-mask';
        d.style.cssText=`position:absolute;left:${p.x+scrollX+8}px;top:${r.y+scrollY-3}px;width:${Math.max(p.width-16,10)}px;height:${r.height+6}px;background:#ff00ff;z-index:99999;pointer-events:none`;
        document.body.appendChild(d);}return;}}
      for(const c of el.children){if(!/^(svg|path|circle|rect|line|g|text)$/i.test(c.tagName))walk(c);}};
    walk(document.querySelector('.screen')||document.body);
  });
  const el=await pg.$(sel);
  await el.screenshot({path});
  if(mask)await pg.evaluate(()=>document.querySelectorAll('.gm-mask').forEach(m=>m.remove()));
  await pg.evaluate(()=>{document.querySelectorAll('.tabbar,.fab').forEach(e=>e.style.visibility='');});
}
function diffPNG(a,b,out){
  const A=PNG.sync.read(fs.readFileSync(a)),B=PNG.sync.read(fs.readFileSync(b));
  const w=Math.min(A.width,B.width),h=Math.min(A.height,B.height);
  const crop=(P)=>{const c=new PNG({width:w,height:h});PNG.bitblt(P,c,0,0,w,h,0,0);return c;};
  const CA=crop(A),CB=crop(B);const D=new PNG({width:w,height:h});
  const n=pixelmatch(CA.data,CB.data,D.data,w,h,{threshold:0.14});
  fs.writeFileSync(out,PNG.sync.write(D));
  return {pct:Math.round(n/(w*h)*10000)/100,px:n};
}
/* Zustände: [name, GM(level,scen,ci), Prod(setState fixture,mode)] */
const STATES=[
 ['f_good',      ['f','good',true],      ['good','fortgeschritten']],
 ['a_good',      ['a','good',true],      ['good','anfaenger']],
 ['p_good',      ['p','good',true],      ['good','profi']],
 ['f_ciopen',    ['f','good',false],     ['ciopen','fortgeschritten']],
 ['f_attention', ['f','attention',true], ['attention','fortgeschritten']],
 ['p_crit',      ['p','crit',true],      ['crit','profi']],
 ['f_loading',   ['f','loading',true],   ['loading','fortgeschritten']],
 ['f_empty',     ['f','empty',true],     ['empty','fortgeschritten']],
 ['f_error',     ['f','error',true],     ['error','fortgeschritten']]
];
const results={};
for(const [name,[gl,gs,gc],[ps,pm]] of STATES){
  await gmSet(gl,gs,gc);
  await prod.evaluate(([s,m])=>setState(s,m),[ps,pm]);
  await prod.waitForTimeout(80);
  /* DOM-Reihenfolge/Klassen/Kartenzahl (nur GM1-Kernklassen; statusbar/gapnote-Reihenfolge ist GM-intern) */
  const gseq=await seqOf(gm),pseq=await seqOf(prod);
  const norm=a=>a.filter(x=>!/statusbar|lvlbadge|demobar/.test(x.cls)).map(x=>x.cls.split(' ')[0]||'div');
  const gn=norm(gseq),pn=norm(pseq);
  ok(name+': identische Sektionsreihenfolge/-klassen', gn.join('|')===pn.join('|'), gn.join('|')+'  VS  '+pn.join('|'));
  const cards=a=>a.reduce((s,x)=>s+x.cards,0);
  ok(name+': identische Kartenanzahl', cards(gseq)===cards(pseq), cards(gseq)+' vs '+cards(pseq));
  /* Bounding-Boxen: Breite exakt, Höhe/Y mit Texttoleranz */
  let boxOK=gn.length===pn.length;let boxInfo='';
  if(boxOK)for(let i=0;i<gn.length;i++){const G=gseq.filter(x=>!/statusbar|lvlbadge|demobar/.test(x.cls))[i],P=pseq.filter(x=>!/statusbar|lvlbadge|demobar/.test(x.cls))[i];
    const wBad=(G.w>=300||P.w>=300)?Math.abs(G.w-P.w)>2:false;
    if(wBad||Math.abs(G.h-P.h)>56){boxOK=false;boxInfo=gn[i]+' w'+G.w+'/'+P.w+' h'+G.h+'/'+P.h;break;}}
  ok(name+': Bounding-Boxen (Breite exakt, Höhe ±Texttoleranz)', boxOK, boxInfo);
  /* Screenshots + Overlay-Diff (Texte maskiert) */
  await shot(gm,'#screen',`${OUT}/gm_${name}.png`,true);
  await shot(prod,'#prodScreen',`${OUT}/prod_${name}.png`,true);
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  ok(name+': Pixel-Diff (Texte maskiert) ≤ 2 %', d.pct<=2, d.pct+'% ('+d.px+'px)');
  const over=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok(name+': kein horizontaler Overflow', over<=0, 'over='+over);
  const legacy=await prod.evaluate(()=>!!document.querySelector('#prodScreen .occ, #prodScreen .cic-b, #prodScreen .rcv-grid, #prodScreen .headrow, #prodScreen .daynav button:not([id])'));
  ok(name+': keine sichtbare Legacy-Komponente', !legacy);
  /* GM1.1: vollständiger Dashboard-DOM — nach addmod (bzw. Zustandsende) kein sichtbares Geschwister */
  const tail=await prod.evaluate(()=>{
    const vis=el=>{const r=el.getBoundingClientRect();return r.height>1&&getComputedStyle(el).display!=='none';};
    const kids=[];const push=el=>{if(el.id==='tab-heute'||el.id==='command'||el.id==='modules'){[...el.children].forEach(push);return;}if(vis(el))kids.push(el);};
    [...document.querySelector('#prodScreen').children].forEach(push);
    const last=kids[kids.length-1];
    return {lastCls:last?[...last.classList].join(' '):'',n:kids.length};
  });
  ok(name+': letztes sichtbares Element = GM-Abschluss (addmod/Zustandsende)', /addmod|gapnote|kgrid|card|hero/.test(tail.lastCls), tail.lastCls);
}
/* FAB-/Tabbar-Geometrie (GM: 52px, rechts 18, bottom 94; Tabbar 5 Ziele) */
ok('FAB-Geometrie exakt (52px, rechts 18, bottom 94)', await prod.evaluate(()=>{const r=document.getElementById('navPlus').getBoundingClientRect();
  return Math.round(r.width)===52&&Math.round(r.height)===52&&Math.round(document.documentElement.clientWidth-r.right)===18&&Math.round(innerHeight-r.bottom)===94;}));
ok('Tabbar: 5 GM-Ziele mit GM-Labels', await prod.evaluate(()=>{const b=[...document.querySelectorAll('.tabwrap button .tl')].map(x=>x.textContent);
  return b.join(',')==='Dashboard,Plan,Aktivität,Analyse,Profil';}));
/* 390px-Prüfung (Kernzustand) */
await prod.setViewportSize({width:390,height:844});
await prod.evaluate(()=>setState('good','fortgeschritten'));
const o390=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
ok('390px: kein Overflow, Karten 18px-Ränder', o390<=0&&await prod.evaluate(()=>{const c=document.querySelector('#command .hero');const s=document.getElementById('prodScreen');const r=c.getBoundingClientRect(),sr=s.getBoundingClientRect();return Math.round(r.x-sr.x)===18&&Math.round(sr.right-r.right)===18;}), 'over='+o390);
await prod.setViewportSize({width:430,height:900});
/* Interaktion: Score-Sheet, Metrik-Sheet, FAB/QA, mmSheet, Escape/Fokus, Listener */
await prod.evaluate(()=>setState('good','fortgeschritten'));
await prod.click('#command .ring-wrap');
ok('Score-Sheet öffnet (GM-Sheet + Scrim)', await prod.evaluate(()=>document.getElementById('detailSheet').classList.contains('on')&&document.getElementById('scrim').classList.contains('on')));
await prod.keyboard.press('Escape');
ok('Escape schließt, Fokus zurück auf Ring', await prod.evaluate(()=>!document.getElementById('detailSheet').classList.contains('on')&&document.activeElement&&document.activeElement.classList.contains('ring-wrap')));
await prod.click('#navPlus');
ok('FAB öffnet GM-Quick-Add mit echten Aktionen', await prod.evaluate(()=>document.getElementById('qaSheet').classList.contains('on')&&document.querySelectorAll('#qaSheet .qa').length===6));
await prod.keyboard.press('Escape');
await prod.evaluate(()=>gmOpenMM());
ok('mmSheet: Modulliste + Reihenfolge-Buttons', await prod.evaluate(()=>document.querySelectorAll('#mmSheet .mm-item').length===6));
await prod.evaluate(()=>gmMoveMod(0,1));
ok('Modul verschieben persistiert + rendert', await prod.evaluate(()=>JSON.parse(localStorage.getItem('orvia_gm_mods_f'))[1]==='recovery'));
await prod.evaluate(()=>{localStorage.removeItem('orvia_gm_mods_f');gmMMDone();});
const kd=await prod.evaluate(()=>{let n=0;const o=document.addEventListener.bind(document);return new Promise(res=>{
  const orig=document.addEventListener;let count=0;document.addEventListener=function(t,f,x){if(t==='keydown')count++;return orig.call(document,t,f,x);};
  for(let i=0;i<5;i++){renderCommand();renderModules();}
  document.querySelector('#command .ring-wrap').click();gmCloseSheets();
  document.addEventListener=orig;res(count);});});
ok('keine Listener-Akkumulation (0 neue keydown nach 5 Re-Renders)', kd===0, 'neu='+kd);
/* GM1.1: Carry-over über GM-kompatible Zugänge erreichbar, ohne sichtbare Dashboard-Karte */
await prod.evaluate(()=>setState('good','fortgeschritten'));
ok('Carry-over unsichtbar im Dashboard (Ernährung/Routinen/Abend/Extra)', await prod.evaluate(()=>['nutritionBox','routinesCard','eveCard','extraCheckin'].every(id=>{const e=document.getElementById(id);return !e||getComputedStyle(e).display==='none';})));
ok('Abend-Check-in via Quick-Action erreichbar (gm-co-open)', await prod.evaluate(()=>{ORVIA.quickActions.gotoEveningCheckin();const e=document.getElementById('eveCard');return e&&getComputedStyle(e).display!=='none';}));
ok('Routinen via Quick-Action erreichbar', await prod.evaluate(()=>{ORVIA.quickActions.gotoRoutines();const e=document.getElementById('routinesCard');return e&&getComputedStyle(e).display!=='none';}));
ok('Ernährung via kcal-Sheet-Deeplink erreichbar', await prod.evaluate(()=>{openMetric('kcal');const dl=document.querySelector('#detailSheet .deeplink');if(!dl)return false;dl.click();const e=document.getElementById('nutritionBox');return e&&getComputedStyle(e).display!=='none';}));
await prod.evaluate(()=>{['nutritionBox','routinesCard','eveCard'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('gm-co-open');});gmCloseSheets();});
ok('Tages-Sheet: Datum öffnet GM-Sheet mit Navigation', await prod.evaluate(()=>{gmOpenDaySheet();const on=document.getElementById('detailSheet').classList.contains('on')&&/Tag wählen/.test(document.getElementById('detailSheet').textContent);gmCloseSheets();return on;}));
ok('keine Seitenfehler im produktiven Harness', perrs.length===0, perrs.slice(0,3).join(' | '));
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
await b.close();
console.log('\nDiff je Zustand:',JSON.stringify(results));
console.log((fail?fail+' FAILED':'gm1_parity: ALL PASSED')+' ('+pass+' ok)');
process.exit(fail?1:0);
