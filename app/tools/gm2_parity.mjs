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
/* ORVIA · GM2.1 — visuelle Parität der Planseite gegen die FINALE aktive planView des
   Golden Masters (und sessionView für die Session-Vollseite). Identisches UI-Fixture nur im
   Harness. Masken: dynamische Texte (Zeilenmasken) + echte WERT-Füllungen in Balken
   (.pq-track i/.mini-track i/.vol-bars/.fc-band/.fc-mid) — Container/Karten/Icons/Tabbar/
   Header/Sektionslabels/Sheet-Geometrie bleiben unmaskiert.
   node tools/gm2_parity.mjs (erwartet /tmp/gm2h.html) */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const OUT='/tmp/gm2_parity';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const gm=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
await gm.goto('file:///tmp/orvia_dashboard_5.html');
await gm.addStyleTag({content:'.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important;width:430px!important;height:auto!important;min-height:900px}.screen{position:relative!important;height:auto!important;min-height:900px}.demobar,.legend,.save-toast{display:none!important}body{padding:0!important}'});
const prod=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
const perrs=[];prod.on('pageerror',e=>perrs.push(String(e)));
await prod.goto('file:///tmp/gm2h.html');

async function gmPlan(level){
  await gm.evaluate(l=>{document.querySelectorAll('#lvl button').forEach(x=>{if(x.dataset.l===l)x.click();});go('tage');},level);
  await gm.waitForTimeout(140);
}
const seqOf=(pg,root)=>pg.evaluate(sel=>{
  const scr=document.querySelector(sel);if(!scr)return [];
  const kids=[];const push=el=>{if(el.id==='tab-plan'||el.id==='gmPlan'){[...el.children].forEach(push);return;}
    if(el.id==='gmPage'||/weekPlanBox|planQualityBox|phaseBox|rampBox/.test(el.id||''))return;
    const r=el.getBoundingClientRect();if(r.height<=1||getComputedStyle(el).display==='none')return;kids.push(el);};
  [...scr.children].forEach(push);
  return kids.map(el=>{const r=el.getBoundingClientRect();
    return {cls:[...el.classList].join(' ').trim()||el.tagName.toLowerCase(),y:Math.round(r.y+scrollY),h:Math.round(r.height),w:Math.round(r.width),
      cards:(el.classList.contains('card')?1:0)+el.querySelectorAll('.card,.session-card,.daily-goal,.pq,.phase,.vol-col,.pvar,.wp').length};
  });
},root);
async function mask(pg,rootSel){
  await pg.evaluate(rootSel=>{
    document.querySelectorAll('.gm-mask').forEach(m=>m.remove());
    const add=(x,y,w,h)=>{const d=document.createElement('div');d.className='gm-mask';
      d.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:#ff00ff;z-index:99999;pointer-events:none`;document.body.appendChild(d);};
    const walk=el=>{for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){
      const r=el.getBoundingClientRect();const p=(el.closest('.card,.session-card,.daily-goal,.pvar,.wp,.pq,.phase,.hdr,.sectlabel,.mini-note,.plan-hero,.coach-card,.page-head,.sheet,.dist-leg,.fc-labels')||el.parentElement||el).getBoundingClientRect();
      if(r.height>0&&r.height<120)add(p.x+scrollX+6,r.y+scrollY-3,Math.max(p.width-12,10),r.height+6);return;}}
      for(const c of el.children){if(!/^(svg|path|circle|rect|line|g|text)$/i.test(c.tagName))walk(c);}};
    const ROOT=rootSel?document.querySelector(rootSel):(document.querySelector('#gmPage.on')||document.querySelector('.screen')||document.body);
    walk(ROOT||document.body);
    /* Wert-Füllungen (echte Werte) maskieren — Balken-CONTAINER bleiben sichtbar */
    (ROOT||document).querySelectorAll('.pq-track,.mini-track,.vol-bars,.goalbar,.fc-corridor').forEach(t=>{
      const r=t.getBoundingClientRect();add(r.x+scrollX+1,r.y+scrollY+1,Math.max(r.width-2,4),Math.max(r.height-2,3));});
  },rootSel||null);
}
async function unmask(pg){await pg.evaluate(()=>document.querySelectorAll('.gm-mask').forEach(m=>m.remove()));}
async function capMode(pg,mode){
  await pg.evaluate(m=>{
    let st=document.getElementById('gmCapStyle');
    if(!st){st=document.createElement('style');st.id='gmCapStyle';document.head.appendChild(st);}
    st.textContent=m==='full'
      ?'.sheet:not(.on){display:none!important}.tabbar,.fab{position:absolute!important}.tabbar{bottom:0!important}.fab{bottom:94px!important}'
      :m==='view'
      ?'.sheet:not(.on){display:none!important}.tabbar,.fab{position:fixed!important}'
      :'';
  },mode);
}
async function fullShot(pg,root,path){
  await capMode(pg,'full');
  await mask(pg);
  const el=await pg.$(root);
  await el.screenshot({path});
  await unmask(pg);
  await capMode(pg,'');
}
function diffPNG(a,b,out){
  const A=PNG.sync.read(fs.readFileSync(a)),B=PNG.sync.read(fs.readFileSync(b));
  const w=Math.min(A.width,B.width),h=Math.min(A.height,B.height);
  const crop=P=>{const c=new PNG({width:w,height:h});PNG.bitblt(P,c,0,0,w,h,0,0);return c;};
  const D=new PNG({width:w,height:h});
  const n=pixelmatch(crop(A).data,crop(B).data,D.data,w,h,{threshold:0.14});
  fs.writeFileSync(out,PNG.sync.write(D));
  return {pct:Math.round(n/(w*h)*10000)/100,px:n};
}
const results={};
/* --- GM-vergleichbare Zustände (GM-Demo hat festen Inhalt): a/f/p --- */
for(const [name,gl,pm] of [['a_plan','a','anfaenger'],['f_plan','f','fortgeschritten'],['p_plan','p','profi']]){
  await gmPlan(gl);
  await prod.evaluate(m=>setPlanState('good',m),pm);
  await prod.waitForTimeout(80);
  const gseq=await seqOf(gm,'#screen'),pseq=await seqOf(prod,'#prodScreen');
  const norm=a=>a.filter(x=>!/statusbar|plan-list/.test(x.cls.split(' ')[0])?true:x.cls!=='statusbar').filter(x=>x.cls!=='statusbar').map(x=>x.cls.split(' ')[0]);
  const gn=norm(gseq),pn=norm(pseq);
  ok(name+': Sektionsfolge/Klassen identisch (Diff 0)', gn.join('|')===pn.join('|'), gn.join('|')+'  VS  '+pn.join('|'));
  const cards=a=>a.reduce((s,x)=>s+x.cards,0);
  ok(name+': identische Karten-/Slot-Anzahl', cards(gseq.filter(x=>x.cls!=='statusbar'))===cards(pseq), cards(gseq.filter(x=>x.cls!=='statusbar'))+' vs '+cards(pseq));
  let boxOK=gn.length===pn.length,info='';
  const gsF=gseq.filter(x=>x.cls!=='statusbar');
  if(boxOK)for(let i=0;i<gsF.length;i++){const G=gsF[i],P=pseq[i];
    if(((G.w>=300)&&Math.abs(G.w-P.w)>2)||Math.abs(G.h-P.h)>56){boxOK=false;info=gn[i]+' w'+G.w+'/'+P.w+' h'+G.h+'/'+P.h;break;}}
  ok(name+': Bounding-Boxen', boxOK, info);
  /* Vollständiger Scrollinhalt inkl. Tabbar (fixe Elemente bleiben sichtbar im Viewport-Teil) */
  await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  ok(name+': Pixel-Diff (voller Scrollinhalt) ≤ 2 %', d.pct<=2, d.pct+'% ('+d.px+'px)');
  /* Viewport-Abschnitte MIT Tabbar (oben/mitte/unten) */
  for(const [seg,scr] of [['top',0],['mid',700],['bot',99999]]){
    for(const [pg,label] of [[gm,'gm'],[prod,'prod']]){
      await capMode(pg,'view');
      await pg.evaluate(y=>scrollTo(0,y),scr);await pg.waitForTimeout(60);await mask(pg);
      await pg.screenshot({path:`${OUT}/${label}_${name}_${seg}.png`});await unmask(pg);
      await capMode(pg,'');
    }
    const dv=diffPNG(`${OUT}/gm_${name}_${seg}.png`,`${OUT}/prod_${name}_${seg}.png`,`${OUT}/diff_${name}_${seg}.png`);
    results[name+'_'+seg]=dv;
    ok(name+' '+seg+': Viewport-Diff (inkl. Tabbar) ≤ 2 %', dv.pct<=2, dv.pct+'%');
  }
  await gm.evaluate(()=>scrollTo(0,0));await prod.evaluate(()=>scrollTo(0,0));
  const over=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok(name+': kein horizontaler Überlauf', over<=0);
  ok(name+': kein sichtbares E1–E4-Legacy', await prod.evaluate(()=>!document.querySelector('#prodScreen .pqv5-head,#prodScreen .phv5-track,#prodScreen .wkv5-bar,#prodScreen .sess5,#prodScreen .pweek-nav')||['weekPlanBox','planQualityBox','phaseBox','rampBox'].every(id=>{const e=document.getElementById(id);return !e||getComputedStyle(e).display==='none';})));
  ok(name+': nichts Sichtbares nach .tabspacer', await prod.evaluate(()=>{const t=document.querySelector('#gmPlan .tabspacer');let n=t?t.nextElementSibling:null;while(n){const r=n.getBoundingClientRect();if(r.height>1&&getComputedStyle(n).display!=='none')return false;n=n.nextElementSibling;}return true;}));
}
/* --- Prod-Fixture-Zustände (kein GM-Pendant): Struktur schrumpft nie --- */
const BASE=await prod.evaluate(()=>{setPlanState('good','fortgeschritten');return [...document.querySelectorAll('#gmPlan > *')].map(e=>e.className.split(' ')[0]).join('|');});
for(const st of ['empty','nogoal','pastgoal','warn3','partial','allmissing','longtitle']){
  const r=await prod.evaluate(s=>{setPlanState(s,'fortgeschritten');
    return {seq:[...document.querySelectorAll('#gmPlan > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      pq:document.querySelectorAll('#gmPlan .pq').length,vol:document.querySelectorAll('#gmPlan .vol-col').length,
      dg:document.querySelectorAll('#gmPlan .daily-goal').length,ph:document.querySelectorAll('#gmPlan .phase').length};},st);
  ok('Zustand '+st+': Struktur unverändert (Diff 0), Slots vollständig, kein Überlauf',
     r.seq===BASE&&r.over<=0&&r.pq===6&&r.vol===6&&r.dg===4&&r.ph===5,
     st+': pq'+r.pq+' vol'+r.vol+' dg'+r.dg+' ph'+r.ph+(r.seq!==BASE?' SEQ!':''));
  await prod.evaluate(()=>{const s=document.querySelector('#gmPlan');});
}
/* --- Session-Vollseite: GM sessionView vs. gmOpenSessionPage --- */
await gmPlan('f');
await gm.evaluate(()=>openPage('session',4));await gm.waitForTimeout(150);
await prod.evaluate(()=>{setPlanState('good','fortgeschritten');const ti=(new Date().getDay()+6)%7;WEEK[ti]=[{t:'Laufen',l:'Tempolauf 3×8',d:'tempo',id:'sT'}];renderGMPlan();gmOpenSessionPage(ti,0);});
await prod.waitForTimeout(80);
const gs=await gm.evaluate(()=>({ph:!!document.querySelector('.page-head'),hero:!!document.querySelector('.plan-hero'),wp:document.querySelectorAll('.plan-hero .wp').length,cc:!!document.querySelector('.coach-card'),cta:!!document.querySelector('.cta')}));
const ps=await prod.evaluate(()=>({ph:!!document.querySelector('#gmPage .page-head'),hero:!!document.querySelector('#gmPage .plan-hero'),wp:document.querySelectorAll('#gmPage .plan-hero .wp').length,cc:!!document.querySelector('#gmPage .coach-card'),cta:!!document.querySelector('#gmPage .cta')}));
ok('Session-Vollseite: identische GM-Struktur (pageHead/plan-hero/4 wp/coach-card/CTA)', JSON.stringify(gs)===JSON.stringify(ps), JSON.stringify(gs)+' vs '+JSON.stringify(ps));
await capMode(gm,'view');await mask(gm);await gm.screenshot({path:`${OUT}/gm_session.png`});await unmask(gm);await capMode(gm,'');
await capMode(prod,'view');await mask(prod);await prod.screenshot({path:`${OUT}/prod_session.png`});await unmask(prod);await capMode(prod,'');
const dses=diffPNG(`${OUT}/gm_session.png`,`${OUT}/prod_session.png`,`${OUT}/diff_session.png`);
results['session_planned']=dses;
ok('Session-Vollseite (geplant): Pixel-Diff ≤ 2 %', dses.pct<=2, dses.pct+'%');
/* Session-Vollseite: abgeschlossene Einheit (So, Long Run — DONE-Fixture) */
await prod.evaluate(()=>{gmCloseSessionPage();gmOpenSessionPage(6,0);});
ok('Session-Vollseite (abgeschlossen): Struktur identisch, kein Fehler', await prod.evaluate(()=>document.querySelectorAll('#gmPage .plan-hero .wp').length===4&&!!document.querySelector('#gmPage .coach-card')));
/* Abgeschlossene Session: GM sessionView(0) = abgeschlossene Einheit (Ghost-CTA) */
await gm.evaluate(()=>{closePage();openPage('session',0);});
await prod.evaluate(()=>{gmCloseSessionPage();gmOpenSessionPage(6,0);});
await gm.waitForTimeout(120);
await capMode(gm,'view');await mask(gm);await gm.screenshot({path:`${OUT}/gm_session_done.png`});await unmask(gm);await capMode(gm,'');
await capMode(prod,'view');await mask(prod);await prod.screenshot({path:`${OUT}/prod_session_done.png`});await unmask(prod);await capMode(prod,'');
const dsd=diffPNG(`${OUT}/gm_session_done.png`,`${OUT}/prod_session_done.png`,`${OUT}/diff_session_done.png`);
results['session_done']=dsd;
ok('Session-Vollseite (abgeschlossen): Pixel-Diff ≤ 2 %', dsd.pct<=2, dsd.pct+'%');
await gm.evaluate(()=>closePage());
await prod.evaluate(()=>gmCloseSessionPage());
ok('Zurück: Planseite intakt + Scroll erhalten', await prod.evaluate(()=>{scrollTo(0,400);gmOpenSessionPage(1,0);gmCloseSessionPage();return Math.abs(scrollY-400)<4&&document.querySelectorAll('#gmPlan .session-card').length===7;}));
/* --- Interaktionen --- */
const wk0=await prod.evaluate(()=>JSON.stringify(activeWeekPlan()));
await prod.evaluate(()=>{document.querySelector('#gmPlan .pvar').click();});
ok('A-Tap: nur NA-Sheet, keine Planänderung', await prod.evaluate(w0=>{const on=document.getElementById('detailSheet').classList.contains('on')&&/externen Trainingsengine/.test(document.getElementById('detailSheet').textContent);return on&&JSON.stringify(activeWeekPlan())===w0;},wk0));
await prod.keyboard.press('Escape');
ok('Escape schließt Varianten-Sheet', await prod.evaluate(()=>!document.getElementById('detailSheet').classList.contains('on')));
await prod.evaluate(()=>{const c=document.querySelector('#gmPlan .session-card[data-sid="s2"]');c.focus();});
await prod.keyboard.press('Enter');
ok('Enter auf Session öffnet korrekte Vollseite', await prod.evaluate(()=>document.getElementById('gmPage').classList.contains('on')&&/Lockerer Lauf 8 km/.test(document.getElementById('gmPage').textContent)));
await prod.evaluate(()=>gmCloseSessionPage());
ok('Planqualität: Karte + Sheet aus derselben kanonischen Quelle', await prod.evaluate(()=>{const before=window.__pqCalls();document.querySelector('#gmPlan .pq-grid').closest('.card').click();return window.__pqSheet===1&&/moderat/.test(document.getElementById('detailSheet').textContent)&&window.__pqCalls()===before+1;}));
await prod.keyboard.press('Escape');
ok('Tagesziele-Bearbeiten: ehrlicher NA-Zustand', await prod.evaluate(()=>{document.querySelector('#gmPlan .daily-goals').previousElementSibling.querySelector('.edit').click();const t=document.getElementById('detailSheet').textContent;const on=/Tagesziele/.test(t)&&/keine produktive/.test(t);gmCloseSheets();return on;}));
ok('Gear: bestehende Planwerkzeuge', await prod.evaluate(()=>{document.querySelector('#gmPlan .hdr .iconbtn').click();const sh=document.getElementById('detailSheet');const btns=sh.querySelectorAll('.sheet-cta button').length===2;sh.querySelectorAll('.sheet-cta button')[0].click();return btns&&window.__editorOpened===1;}));
/* Verdeckte Legacy: kein Doppel-Aufruf, keine Duplikat-IDs, kein Layout-Einfluss, keine Listener */
ok('kein doppelter Engine-Aufruf (planQualityChecks 1× pro Render)', await prod.evaluate(()=>{const b=window.__pqCalls();setPlanState('good','fortgeschritten');return window.__pqCalls()===b+1;}));
ok('versteckte Hosts leer + ohne Layoutwirkung', await prod.evaluate(()=>['weekPlanBox','planQualityBox','phaseBox','rampBox'].every(id=>{const e=document.getElementById(id);return e&&e.innerHTML===''&&e.getBoundingClientRect().height===0;})));
ok('keine doppelten IDs im aktiven DOM', await prod.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length;}));
const kd=await prod.evaluate(()=>{let c=0;const o=document.addEventListener;document.addEventListener=function(t,f,x){if(t==='keydown')c++;return o.call(document,t,f,x);};for(let i=0;i<5;i++)setPlanState('good','fortgeschritten');document.addEventListener=o;return c;});
ok('keine Listener-Akkumulation (5 Re-Renders)', kd===0, 'neu='+kd);
ok('keine DOM-Duplikate nach wiederholter Navigation', await prod.evaluate(()=>{for(let i=0;i<4;i++){gmOpenSessionPage(1,0);gmCloseSessionPage();}return document.querySelectorAll('#gmPage .page-head').length===1&&document.querySelectorAll('#gmPlan .session-card').length===7;}));
/* Sheets: NA-Varianten + Planwerkzeuge — Geometrie gegen GM-Sheet-System, Aufnahme dokumentiert
   (kein GM-Inhaltspendant; Gate = Geometrievertrag + Artefakt) */
await prod.evaluate(()=>{setPlanState('good','fortgeschritten');document.querySelector('#gmPlan .pvar').click();});
await prod.waitForTimeout(420);
const shGeo=await prod.evaluate(()=>{const s=document.getElementById('detailSheet');const c=getComputedStyle(s);const r=s.getBoundingClientRect();return {br:c.borderRadius,pos:c.position,w:Math.round(r.width),bottom:Math.round(innerHeight-r.bottom),grab:!!s.querySelector('.grab')};});
const gmShGeo=await gm.evaluate(()=>{openMetric&&openMetric('hrv');const s=document.getElementById('detailSheet');const c=getComputedStyle(s);return {br:c.borderRadius,grab:!!s.querySelector('.grab')};});
await gm.evaluate(()=>closeSheets());
ok('NA-Sheet: GM-Sheet-Geometrie (Radius/Grab/Position unten)', shGeo.br===gmShGeo.br&&shGeo.grab&&gmShGeo.grab&&shGeo.pos==='fixed'&&shGeo.bottom===0&&shGeo.w===430, JSON.stringify(shGeo));
await mask(prod);await prod.screenshot({path:`${OUT}/prod_sheet_na.png`});await unmask(prod);
await prod.keyboard.press('Escape');
await prod.evaluate(()=>{document.querySelector('#gmPlan .hdr .iconbtn').click();});
await prod.waitForTimeout(420);
ok('Werkzeuge-Sheet: 2 bestehende Aktionen, GM-Geometrie', await prod.evaluate(()=>{const s=document.getElementById('detailSheet');return s.classList.contains('on')&&s.querySelectorAll('.sheet-cta button').length===2&&!!s.querySelector('.grab');}));
await mask(prod);await prod.screenshot({path:`${OUT}/prod_sheet_tools.png`});await unmask(prod);
await prod.keyboard.press('Escape');
/* 390px-Durchlauf (Hauptzustände) */
await gm.setViewportSize({width:390,height:844});await prod.setViewportSize({width:390,height:844});
await gm.addStyleTag({content:'.phone{width:390px!important}'});
for(const [name,gl,pm] of [['a390','a','anfaenger'],['f390','f','fortgeschritten'],['p390','p','profi']]){
  await gmPlan(gl);
  await prod.evaluate(m=>setPlanState('good',m),pm);
  await prod.waitForTimeout(80);
  await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
  const d390=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d390;
  ok(name+': 390px voller Scrollinhalt ≤ 2 %', d390.pct<=2, d390.pct+'%');
  const ov=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok(name+': 390px kein Überlauf', ov<=0);
}
/* 390px: Fixture-Zustände (Struktur Diff 0 + Slots + Überlauf) */
for(const st of ['empty','nogoal','pastgoal','warn3','partial','allmissing','longtitle']){
  const r=await prod.evaluate(s=>{setPlanState(s,'fortgeschritten');
    return {seq:[...document.querySelectorAll('#gmPlan > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      pq:document.querySelectorAll('#gmPlan .pq').length,vol:document.querySelectorAll('#gmPlan .vol-col').length,
      dg:document.querySelectorAll('#gmPlan .daily-goal').length,ph:document.querySelectorAll('#gmPlan .phase').length};},st);
  ok('390px Zustand '+st+': Struktur Diff 0, Slots vollständig, kein Überlauf',
     r.seq===BASE&&r.over<=0&&r.pq===6&&r.vol===6&&r.dg===4&&r.ph===5,
     st+': pq'+r.pq+' vol'+r.vol+' dg'+r.dg+' ph'+r.ph+(r.seq!==BASE?' SEQ!':''));
}
/* 390px: Session-Vollseite geplant + abgeschlossen */
await gmPlan('f');
await gm.evaluate(()=>openPage('session',4));await gm.waitForTimeout(150);
await prod.evaluate(()=>{setPlanState('good','fortgeschritten');const ti=(new Date().getDay()+6)%7;WEEK[ti]=[{t:'Laufen',l:'Tempolauf 3×8',d:'tempo',id:'sT'}];renderGMPlan();gmOpenSessionPage(ti,0);});
await prod.waitForTimeout(80);
await capMode(gm,'view');await mask(gm);await gm.screenshot({path:`${OUT}/gm_session390.png`});await unmask(gm);await capMode(gm,'');
await capMode(prod,'view');await mask(prod);await prod.screenshot({path:`${OUT}/prod_session390.png`});await unmask(prod);await capMode(prod,'');
const ds390=diffPNG(`${OUT}/gm_session390.png`,`${OUT}/prod_session390.png`,`${OUT}/diff_session390.png`);
results['session_planned_390']=ds390;
ok('390px Session-Vollseite (geplant): Pixel-Diff ≤ 2 %', ds390.pct<=2, ds390.pct+'%');
await gm.evaluate(()=>{closePage();openPage('session',0);});
await prod.evaluate(()=>{gmCloseSessionPage();gmOpenSessionPage(6,0);});
await gm.waitForTimeout(120);
await capMode(gm,'view');await mask(gm);await gm.screenshot({path:`${OUT}/gm_session_done390.png`});await unmask(gm);await capMode(gm,'');
await capMode(prod,'view');await mask(prod);await prod.screenshot({path:`${OUT}/prod_session_done390.png`});await unmask(prod);await capMode(prod,'');
const dsd390=diffPNG(`${OUT}/gm_session_done390.png`,`${OUT}/prod_session_done390.png`,`${OUT}/diff_session_done390.png`);
results['session_done_390']=dsd390;
ok('390px Session-Vollseite (abgeschlossen): Pixel-Diff ≤ 2 %', dsd390.pct<=2, dsd390.pct+'%');
await gm.evaluate(()=>closePage());
await prod.evaluate(()=>gmCloseSessionPage());
await gm.addStyleTag({content:'.phone{width:430px!important}'});
await gm.setViewportSize({width:430,height:900});await prod.setViewportSize({width:430,height:900});
ok('keine Seitenfehler', perrs.length===0, perrs.slice(0,3).join('|'));
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
await b.close();
console.log('\nDiff je Zustand:',JSON.stringify(results));
console.log((fail?fail+' FAILED':'gm2_parity: ALL PASSED')+' ('+pass+' ok)');
process.exit(fail?1:0);
