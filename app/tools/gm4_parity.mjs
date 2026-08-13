/* VERALTET (KF-013, 2026-08-02) — NICHT MEHR LAUFFAEHIG.

   Dieses Werkzeug vergleicht gegen Golden-Master-Fixtures in /tmp
   (z. B. /tmp/orvia_dashboard_5.html, /tmp/gm4h.html, /tmp/gm6h.html).
   Diese Dateien liegen NICHT im Repo und sind fluechtig. Nach ihrem Verlust
   war die verbindliche Regel „Struktur schrumpft NIE"
   (docs/GOLDEN-MASTER-MAPPING.md:47) nur noch dokumentiert, aber nicht
   geschuetzt — genau das ist KF-013.

   ABGELOEST DURCH:
     supabase/tests/gm_structure_contract_test.mjs   (semantischer Vertrag)
     tools/build_structure_contract.mjs              (Generator)
     docs/gm-ref/structure-contract.json             (eingecheckter Vertrag)

   Aufbewahrt als Referenz fuer die pixelnahe Pruefung. Wieder aktivierbar,
   sobald die Fixtures eingecheckt sind — dann diesen Hinweis entfernen.
*/
/* ORVIA · GM4 — visuelle Parität der Analyse (4 Segmente) gegen die FINALE aktive
   analysisHubView des Golden Masters (anaOverview/anaEndurance/anaRecovery/anaBody).
   Identisches UI-Fixture nur im Harness. Masken: dynamische Texte (Zeilenmasken) +
   echte WERT-Füllungen (.oc2-Chartinneres, .kc-spark, .mile-track, .mbar-Füllspur) —
   Karten, Chartflächen-Container, Körperkarte, Muskelregionen, Kacheln, Statusfarben,
   Legenden, Tabbar und Abstände bleiben unmaskiert.
   node tools/gm4_parity.mjs (erwartet /tmp/gm4h.html) */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const OUT='/tmp/gm4_parity';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const gm=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
await gm.goto('file:///tmp/orvia_dashboard_5.html');
await gm.addStyleTag({content:'.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important;width:430px!important;height:auto!important;min-height:900px}.screen{position:relative!important;height:auto!important;min-height:900px}.demobar,.legend,.save-toast{display:none!important}body{padding:0!important}'});
const prod=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
const perrs=[];prod.on('pageerror',e=>perrs.push(String(e)));
await prod.goto('file:///tmp/gm4h.html');

async function gmAna(level,seg){
  await gm.evaluate(([l,s])=>{document.querySelectorAll('#lvl button').forEach(x=>{if(x.dataset.l===l)x.click();});setAnaSeg(s||'overview');go('ana');},[level,seg]);
  await gm.waitForTimeout(380);
}
const seqOf=(pg,root)=>pg.evaluate(sel=>{
  const scr=document.querySelector(sel);if(!scr)return [];
  const kids=[];const push=el=>{if(el.id==='tab-dash'||el.id==='gmAna'||el.id==='gmAnaPanel'){[...el.children].forEach(push);return;}
    if(el.id==='weekInsights')return;
    const r=el.getBoundingClientRect();if(r.height<=1||getComputedStyle(el).display==='none')return;kids.push(el);};
  [...scr.children].forEach(push);
  return kids.map(el=>{const r=el.getBoundingClientRect();
    return {cls:[...el.classList].join(' ').trim()||el.tagName.toLowerCase(),y:Math.round(r.y+scrollY),h:Math.round(r.height),w:Math.round(r.width),
      cards:(el.classList.contains('card')?1:0)+el.querySelectorAll('.card,.kpi,.insight-card,.mile,.kcard,.mtile,.hub-act,.seg-btn,.range-chip,.calc-field').length};
  });
},root);
async function mask(pg,rootSel){
  await pg.evaluate(rootSel=>{
    document.querySelectorAll('.gm-mask').forEach(m=>m.remove());
    const add=(x,y,w,h)=>{const d=document.createElement('div');d.className='gm-mask';
      d.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:#ff00ff;z-index:99999;pointer-events:none`;document.body.appendChild(d);};
    const walk=el=>{for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){
      const r=el.getBoundingClientRect();const p=(el.closest('.seg-btn,.range-chip,.body-toggle button,.kpi,.mleg,.mstat,.confchip,.hub-act,.calc-field,.decision-actions button,.impact,.mile-b,.kc-h,.kc-v,.ctitle,.statgrid3 div,.msheet-ex span,.card,.kcard,.insight-card,.decision-hero,.body-head,.hdr,.sectlabel,.mini-note,.coach-card,.page-head,.sheet,.mtile-b,.source,.sh-block')||el.parentElement||el).getBoundingClientRect();
      if(r.height>0&&r.height<120)add(p.x+scrollX+4,r.y+scrollY-3,Math.max(p.width-8,10),r.height+6);return;}}
      for(const c of el.children){if(!/^(svg|path|circle|rect|line|g|text|title)$/i.test(c.tagName))walk(c);}};
    const ROOT=rootSel?document.querySelector(rootSel):(document.querySelector('.screen')||document.body);
    walk(ROOT||document.body);
    /* WERT-Füllungen: Chartflächen-INNERES + Sparkline-Slots + Fortschritts-/Volumenspuren */
    (ROOT||document).querySelectorAll('.oc2').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>2)add(r.x+scrollX-1,r.y+scrollY-1,r.width+2,r.height+2);});
    (ROOT||document).querySelectorAll('.kc-spark,.mile-track,.mbar').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>2)add(r.x+scrollX+2,r.y+scrollY+2,Math.max(r.width-4,4),Math.max(r.height-4,3));});
  },rootSel||null);
}
async function unmask(pg){await pg.evaluate(()=>document.querySelectorAll('.gm-mask').forEach(m=>m.remove()));}
async function capMode(pg,mode){
  await pg.evaluate(m=>{
    let st=document.getElementById('gmCapStyle');
    if(!st){st=document.createElement('style');st.id='gmCapStyle';document.head.appendChild(st);}
    st.textContent=m==='full'
      ?'body{position:relative!important}.sheet:not(.on){display:none!important}.tabbar,.fab{position:absolute!important}.tabbar{bottom:0!important}.fab{bottom:94px!important}'
      :m==='view'
      ?'.sheet:not(.on){display:none!important}.tabbar,.fab{position:fixed!important}.sheet.on{position:fixed!important;top:auto!important;bottom:0!important;left:0!important;right:0!important;margin:0 auto!important}.scrim.on,#scrim.on{position:fixed!important;inset:0!important}'
      :'';
  },mode);
}
async function fullShot(pg,root,path){
  await capMode(pg,'full');await mask(pg);
  const el=await pg.$(root);await el.screenshot({path});
  await unmask(pg);await capMode(pg,'');
}
function diffPNG(a,bp,out){
  const A=PNG.sync.read(fs.readFileSync(a)),B=PNG.sync.read(fs.readFileSync(bp));
  const w=Math.min(A.width,B.width),h=Math.min(A.height,B.height);
  const crop=P=>{const c=new PNG({width:w,height:h});PNG.bitblt(P,c,0,0,w,h,0,0);return c;};
  const D=new PNG({width:w,height:h});
  const n=pixelmatch(crop(A).data,crop(B).data,D.data,w,h,{threshold:0.14});
  fs.writeFileSync(out,PNG.sync.write(D));
  return {pct:Math.round(n/(w*h)*10000)/100,px:n};
}
const results={};
const SEGS=[['overview','ov'],['endurance','end'],['recovery','rec'],['body','body']];

/* ---------- Segment-Pixelzustände A/F/P bei 430 ---------- */
for(const [seg,tag] of SEGS){
  for(const [lv,gl,pm] of [['a','a','anfaenger'],['f','f','fortgeschritten'],['p','p','profi']]){
    const name=tag+'_'+lv;
    await gmAna(gl,seg);
    await prod.evaluate(([s,m])=>{setAnaState('good',m);gmSetAnaSeg(s);},[seg,pm]);
    await prod.waitForTimeout(120);
    /* Struktur */
    const gseq=await seqOf(gm,'#screen'),pseq=await seqOf(prod,'#prodScreen');
    const norm=a=>a.filter(x=>x.cls!=='statusbar').map(x=>x.cls.split(' ')[0]);
    const gn=norm(gseq),pn=norm(pseq);
    ok(name+': Sektionsfolge/Klassen identisch (Diff 0)', gn.join('|')===pn.join('|'), gn.join('|')+'  VS  '+pn.join('|'));
    const cards=a=>a.filter(x=>x.cls!=='statusbar').reduce((s,x)=>s+x.cards,0);
    ok(name+': identische Slot-Anzahl', cards(gseq)===cards(pseq), cards(gseq)+' vs '+cards(pseq));
    /* Pixel voll */
    await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
    await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
    const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
    results[name]=d;
    ok(name+': voller Scrollinhalt (inkl. Tabbar) ≤ 2 %', d.pct<=2, d.pct+'%');
    const over=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok(name+': kein horizontaler Überlauf', over<=0);
  }
  /* Ausschnitte top/mid/bot für F */
  await gmAna('f',seg);
  await prod.evaluate(s=>{setAnaState('good','fortgeschritten');gmSetAnaSeg(s);},seg);
  await prod.waitForTimeout(120);
  for(const [cut,scr] of [['top',0],['mid',700],['bot',99999]]){
    for(const [pg,rt] of [[gm,'#screen'],[prod,'#prodScreen']]){
      await capMode(pg,'view');
      await pg.evaluate(y=>scrollTo(0,y),scr);await pg.waitForTimeout(60);await mask(pg);
      await pg.screenshot({path:`${OUT}/${pg===gm?'gm':'prod'}_${tag}_f_${cut}.png`});
      await unmask(pg);await capMode(pg,'');
    }
    const dc=diffPNG(`${OUT}/gm_${tag}_f_${cut}.png`,`${OUT}/prod_${tag}_f_${cut}.png`,`${OUT}/diff_${tag}_f_${cut}.png`);
    results[tag+'_f_'+cut]=dc;
    ok(tag+'_f '+cut+': Viewport-Diff ≤ 2 %', dc.pct<=2, dc.pct+'%');
  }
  await gm.evaluate(()=>scrollTo(0,0));await prod.evaluate(()=>scrollTo(0,0));
  ok(tag+': keine sichtbare Legacy-Analyse', await prod.evaluate(()=>{const e=document.getElementById('weekInsights');return !e||e.offsetParent===null;}));
  ok(tag+': nichts Sichtbares nach .tabspacer', await prod.evaluate(()=>{const t=document.querySelector('#gmAna .tabspacer');let n=t?t.nextElementSibling:null;while(n){const r=n.getBoundingClientRect();if(r.height>1&&getComputedStyle(n).display!=='none')return false;n=n.nextElementSibling;}return true;}));
}
/* ---------- Körper: Rückseite + Zeiträume ---------- */
await gmAna('f','body');
await prod.evaluate(()=>{setAnaState('good','fortgeschritten');gmSetAnaSeg('body');});
await gm.evaluate(()=>setBodySide('back'));await prod.evaluate(()=>gmSetBodySide('back'));
await gm.waitForTimeout(300);await prod.waitForTimeout(120);
await fullShot(gm,'#screen',`${OUT}/gm_body_back.png`);
await fullShot(prod,'#prodScreen',`${OUT}/prod_body_back.png`);
results['body_back']=diffPNG(`${OUT}/gm_body_back.png`,`${OUT}/prod_body_back.png`,`${OUT}/diff_body_back.png`);
ok('body_back: Rückseite ≤ 2 % (inkl. dokumentierter Warn-Slot-Abweichung)', results['body_back'].pct<=2, results['body_back'].pct+'%');
await gm.evaluate(()=>setBodySide('front'));await prod.evaluate(()=>gmSetBodySide('front'));
for(const d of [7,14,90]){
  await gm.evaluate(x=>setBodyRange(x),d);await prod.evaluate(x=>gmSetBodyRange(x),d);
  await gm.waitForTimeout(280);await prod.waitForTimeout(160);
  await fullShot(gm,'#screen',`${OUT}/gm_body_r${d}.png`);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_body_r${d}.png`);
  results['body_r'+d]=diffPNG(`${OUT}/gm_body_r${d}.png`,`${OUT}/prod_body_r${d}.png`,`${OUT}/diff_body_r${d}.png`);
  ok('body Zeitraum '+d+' T.: ≤ 2 %', results['body_r'+d].pct<=2, results['body_r'+d].pct+'%');
}
await gm.evaluate(()=>setBodyRange(28));await prod.evaluate(()=>gmSetBodyRange(28));
await gm.waitForTimeout(250);await prod.waitForTimeout(150);
/* Muskel-Detail-Sheet (Element-Diff wie GM3-Sheets) */
await gm.evaluate(()=>openMuscle('quads'));await prod.evaluate(()=>gmOpenMuscleSheet('quads'));
await gm.addStyleTag({content:'.sheet.on{width:430px!important;left:0!important;right:auto!important;margin:0!important;transform:translateY(0)!important}'});
await prod.addStyleTag({content:'.sheet.on{width:430px!important;left:0!important;right:auto!important;margin:0!important;transform:translateY(0)!important}'});
await gm.waitForTimeout(450);await prod.waitForTimeout(450);
await mask(gm,'.sheet.on');
await (await gm.$('.sheet.on')).screenshot({path:`${OUT}/gm_sheet_muscle.png`});
await unmask(gm);
await mask(prod,'.sheet.on');
await (await prod.$('.sheet.on')).screenshot({path:`${OUT}/prod_sheet_muscle.png`});
await unmask(prod);
results['sheet_muscle']=diffPNG(`${OUT}/gm_sheet_muscle.png`,`${OUT}/prod_sheet_muscle.png`,`${OUT}/diff_sheet_muscle.png`);
ok('Muskel-Detail-Sheet: Pixel-Diff ≤ 2 %', results['sheet_muscle'].pct<=2, results['sheet_muscle'].pct+'%');
ok('Muskel-Sheet aus kanonischer Engine (statgrid3/Übungen/Empfehlung, keine Demo-Splits)', await prod.evaluate(()=>{const s=document.querySelector('.sheet.on');return !!s&&/statgrid3/.test(s.innerHTML)&&/Kniebeuge/.test(s.innerHTML)&&!/Prototyp-Demodaten/.test(s.innerHTML);}));
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
/* Pace-Rechner: prod-only NA-Sheet (GM hat eine Prototyp-Seite — kein produktiver Vertrag) */
await prod.evaluate(()=>gmOpenPaceCalcSheet());
await prod.waitForTimeout(400);
ok('Pace-Rechner: ehrlicher NA-Einstieg (Sheet, keine Demo-Rechnung)', await prod.evaluate(()=>{const s=document.querySelector('.sheet.on');return !!s&&/Pace-Rechner/.test(s.innerHTML)&&/Noch nicht verfügbar/.test(s.innerHTML);}));
await mask(prod,'.sheet.on');
await (await prod.$('.sheet.on')).screenshot({path:`${OUT}/prod_sheet_pacecalc.png`});
await unmask(prod);await prod.evaluate(()=>gmCloseSheets());

/* ---------- Fixture-Strukturzustände (prod-only, Struktur-Diff 0 zur good-Basis) ---------- */
const BASE={};
for(const [seg,tag] of SEGS){
  BASE[seg]=await prod.evaluate(s=>{setAnaState('good','fortgeschritten');gmSetAnaSeg(s);
    return [...document.querySelectorAll('#gmAnaPanel > *')].map(e=>e.className.split(' ')[0]).join('|');},seg);
}
const STATES=[['missing','overview'],['warn','overview'],['noload','endurance'],['recpartial','recovery'],['recmissing','recovery']];
for(const [st,seg] of STATES){
  const r=await prod.evaluate(([s,g])=>{setAnaState(s,'fortgeschritten');gmSetAnaSeg(g);
    return {seq:[...document.querySelectorAll('#gmAnaPanel > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      kpi:document.querySelectorAll('#gmAnaPanel .kpi').length,
      insight:document.querySelectorAll('#gmAnaPanel .insight-card').length,
      kcard:document.querySelectorAll('#gmAnaPanel .kcard').length,
      zeros:/>0 ms<|>0 bpm<|>0 h</.test(document.getElementById('gmAnaPanel').innerHTML)};},[st,seg]);
  const wantK={overview:4,endurance:4,recovery:0}[seg];
  const okK=(seg==='recovery')?r.kcard===6:r.kpi===4;
  ok('Zustand '+st+' ('+seg+'): Struktur unverändert, Slots vollständig, keine 0-statt-Missing',
     r.seq===BASE[seg]&&r.over<=0&&okK&&(seg!=='overview'||r.insight===3)&&!r.zeros,
     st+': kpi'+r.kpi+' ins'+r.insight+' kcard'+r.kcard+(r.seq!==BASE[seg]?' SEQ!':''));
  await fullShot(prod,'#prodScreen',`${OUT}/prod_state_${st}.png`);
}
await prod.evaluate(()=>{setAnaState('good','fortgeschritten');gmSetAnaSeg('overview');});

/* ---------- Interaktionen / Nebenwirkungen ---------- */
ok('Segmentwechsel: genau EIN sichtbares Segment, Auswahl bleibt erhalten', await prod.evaluate(()=>{
  gmSetAnaSeg('recovery');
  const one=document.querySelectorAll('#gmAna [role="tabpanel"]').length===1;
  const on=document.querySelectorAll('#gmAna .seg-btn.on').length===1&&document.getElementById('gmSegBtn-recovery').classList.contains('on');
  renderGMAnalysis();
  const still=document.getElementById('gmSegBtn-recovery').classList.contains('on');
  gmSetAnaSeg('overview');
  return one&&on&&still;}));
ok('role=tab/tabpanel + aria-selected korrekt', await prod.evaluate(()=>{
  const tabs=[...document.querySelectorAll('#gmAna [role="tab"]')];
  return tabs.length===4&&tabs.filter(t=>t.getAttribute('aria-selected')==='true').length===1&&!!document.querySelector('#gmAna [role="tabpanel"]');}));
ok('Tastatur: Segment per Fokus + Enter/Click, Fokuszustand erhalten', await prod.evaluate(()=>{
  const btn=document.getElementById('gmSegBtn-endurance');btn.focus();btn.click();
  const focused=document.activeElement&&document.activeElement.id==='gmSegBtn-endurance';
  const on=document.getElementById('gmSegBtn-endurance').classList.contains('on');
  gmSetAnaSeg('overview');return focused&&on;}));
ok('Decision-Actions: Plan-Wechsel + Ausdauer-Wechsel', await prod.evaluate(()=>{
  gmSetAnaSeg('overview');
  const h=document.getElementById('gmAnaPanel').innerHTML;
  return /gmAnaGoPlan\(\)/.test(h)&&/gmSetAnaSeg\('endurance'\)/.test(h);}));
ok('Recovery-Kachel-Tap: Sheet aus demselben Snapshot', await prod.evaluate(()=>{
  gmSetAnaSeg('recovery');
  const c=document.querySelector('#gmAnaPanel .kcard[onclick*="hrv_ms"]');if(!c)return false;
  c.click();
  const s=document.querySelector('.sheet.on');const okv=!!s&&/62\s*ms/.test(s.textContent);
  gmCloseSheets();gmSetAnaSeg('overview');return okv;}));
ok('5 Re-Renders: keine DOM-/Listener-Akkumulation, keine doppelten IDs', await prod.evaluate(()=>{
  renderGMAnalysis();const l0=document.getElementById('gmAna').innerHTML.length;
  for(let i=0;i<5;i++)renderGMAnalysis();
  const ids=[...document.getElementById('gmAna').innerHTML.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  return document.getElementById('gmAna').innerHTML.length===l0&&new Set(ids).size===ids.length;}));
ok('genau EINE Muskelengine-Abfrage je Zeitraum (kein Doppel-Collect)', await prod.evaluate(()=>{
  window.__mvCalls=0;window._gmMvModel=null;_gmMvModel=null;
  gmSetAnaSeg('body');
  return new Promise(res=>setTimeout(()=>{const n1=window.__mvCalls;renderGMAnalysis();renderGMAnalysis();
    setTimeout(()=>{gmSetAnaSeg('overview');res(n1===1&&window.__mvCalls===1);},80);},120));}));
ok('A/F/P: Fachwerte identisch (Muskel-Status, Metriken, KPI)', await prod.evaluate(()=>{
  const grab=()=>{gmSetAnaSeg('body');const t=[...document.querySelectorAll('#gmAnaPanel .mgrp')].map(g=>g.dataset.m+':'+g.getAttribute('aria-label')).join('|');
    gmSetAnaSeg('recovery');const rv=[...document.querySelectorAll('#gmAnaPanel .kc-v')].map(e=>e.textContent.trim()).join('|');return t+'##'+rv;};
  setAnaState('good','anfaenger');const A=grab();
  setAnaState('good','profi');const P=grab();
  setAnaState('good','fortgeschritten');gmSetAnaSeg('overview');
  return A===P&&A.length>20;}));
ok('Fixture-/Engine-Ausgaben unverändert', await prod.evaluate(()=>{
  const j=JSON.stringify(GM4_MODEL.muscles.map(m=>[m.muscleId,m.effectiveSetEquivalents,m.status.key]));
  gmSetAnaSeg('body');gmOpenMuscleSheet('chest');gmCloseSheets();gmSetAnaSeg('overview');
  return JSON.stringify(GM4_MODEL.muscles.map(m=>[m.muscleId,m.effectiveSetEquivalents,m.status.key]))===j;}));
ok('Escape schließt Analyse-Sheets', await prod.evaluate(()=>{gmOpenPaceCalcSheet();return document.querySelector('.sheet.on')!==null;})&&await (async()=>{await prod.keyboard.press('Escape');await prod.waitForTimeout(80);return prod.evaluate(()=>document.querySelector('.sheet.on')===null);})());

/* ---------- 390px-Durchlauf ---------- */
await gm.setViewportSize({width:390,height:844});await prod.setViewportSize({width:390,height:844});
await gm.addStyleTag({content:'.phone{width:390px!important}'});
for(const [seg,tag] of SEGS){
  for(const [lv,gl,pm] of [['a','a','anfaenger'],['f','f','fortgeschritten'],['p','p','profi']]){
    const name=tag+'_'+lv+'390';
    await gmAna(gl,seg);
    await prod.evaluate(([s,m])=>{setAnaState('good',m);gmSetAnaSeg(s);},[seg,pm]);
    await prod.waitForTimeout(120);
    await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
    await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
    const d390=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
    results[name]=d390;
    ok(name+': 390px voller Scrollinhalt ≤ 2 %', d390.pct<=2, d390.pct+'%');
    const ov=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    ok(name+': 390px kein Überlauf', ov<=0);
  }
}
/* 390: Rückseite + Muskel-Sheet + Strukturzustände */
await gmAna('f','body');
await prod.evaluate(()=>{setAnaState('good','fortgeschritten');gmSetAnaSeg('body');});
await gm.evaluate(()=>setBodySide('back'));await prod.evaluate(()=>gmSetBodySide('back'));
await gm.waitForTimeout(280);await prod.waitForTimeout(120);
await fullShot(gm,'#screen',`${OUT}/gm_body_back390.png`);
await fullShot(prod,'#prodScreen',`${OUT}/prod_body_back390.png`);
results['body_back390']=diffPNG(`${OUT}/gm_body_back390.png`,`${OUT}/prod_body_back390.png`,`${OUT}/diff_body_back390.png`);
ok('390px body_back: ≤ 2 %', results['body_back390'].pct<=2, results['body_back390'].pct+'%');
await gm.evaluate(()=>setBodySide('front'));await prod.evaluate(()=>gmSetBodySide('front'));
await gm.evaluate(()=>openMuscle('quads'));await prod.evaluate(()=>gmOpenMuscleSheet('quads'));
await gm.addStyleTag({content:'.sheet.on{width:390px!important;left:0!important;right:auto!important;margin:0!important;transform:translateY(0)!important}'});
await prod.addStyleTag({content:'.sheet.on{width:390px!important;left:0!important;right:auto!important;margin:0!important;transform:translateY(0)!important}'});
await gm.waitForTimeout(420);await prod.waitForTimeout(420);
await mask(gm,'.sheet.on');await (await gm.$('.sheet.on')).screenshot({path:`${OUT}/gm_sheet_muscle390.png`});await unmask(gm);
await mask(prod,'.sheet.on');await (await prod.$('.sheet.on')).screenshot({path:`${OUT}/prod_sheet_muscle390.png`});await unmask(prod);
results['sheet_muscle390']=diffPNG(`${OUT}/gm_sheet_muscle390.png`,`${OUT}/prod_sheet_muscle390.png`,`${OUT}/diff_sheet_muscle390.png`);
ok('390px Muskel-Sheet: ≤ 2 %', results['sheet_muscle390'].pct<=2, results['sheet_muscle390'].pct+'%');
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
for(const [st,seg] of STATES){
  const r=await prod.evaluate(([s,g])=>{setAnaState(s,'fortgeschritten');gmSetAnaSeg(g);
    return {seq:[...document.querySelectorAll('#gmAnaPanel > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth};},[st,seg]);
  ok('390px Zustand '+st+': Struktur Diff 0, kein Überlauf', r.seq===BASE[seg]&&r.over<=0, r.seq!==BASE[seg]?'SEQ!':'');
}
await prod.evaluate(()=>{setAnaState('good','fortgeschritten');gmSetAnaSeg('overview');});
await gm.addStyleTag({content:'.phone{width:430px!important}'});
await gm.setViewportSize({width:430,height:900});await prod.setViewportSize({width:430,height:900});

ok('keine Seitenfehler', perrs.length===0, perrs.slice(0,3).join('|'));
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
await b.close();
console.log('\nDiff je Zustand:',JSON.stringify(results));
console.log((fail?fail+' FAILED':'gm4_parity: ALL PASSED')+' ('+pass+' ok)');
