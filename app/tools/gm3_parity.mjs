/* ORVIA · GM3 — visuelle Parität von Aktivitäten-Hub, Aktivitätsdetail und Start-Einstieg
   gegen die FINALE aktive activityView (und die im Router aktive activityDetailView bzw.
   openStart/startSport) des Golden Masters. Identisches UI-Fixture nur im Harness.
   Masken: dynamische Texte (Zeilenmasken, an der jeweils engsten Komponente verankert)
   + echte WERT-Füllungen (.oc2-Chartinneres, .route-map-Inneres, Split-Balkenspur,
   .pq-track/.mini-track) — Container, Karten, Icons, Filter-Pills, dist-bar (per Fixture
   deckungsgleich), Tabbar, Sheets und Abstände bleiben unmaskiert.
   node tools/gm3_parity.mjs (erwartet /tmp/gm3h.html) */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const OUT='/tmp/gm3_parity';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const gm=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
await gm.goto('file:///tmp/orvia_dashboard_5.html');
await gm.addStyleTag({content:'.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important;width:430px!important;height:auto!important;min-height:900px}.screen{position:relative!important;height:auto!important;min-height:900px}.demobar,.legend,.save-toast{display:none!important}body{padding:0!important}'});
const prod=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
const perrs=[];prod.on('pageerror',e=>perrs.push(String(e)));
await prod.goto('file:///tmp/gm3h.html');

async function gmAct(level){
  await gm.evaluate(l=>{document.querySelectorAll('#lvl button').forEach(x=>{if(x.dataset.l===l)x.click();});setActivityFilter('Alle');setActScope('week');go('act');},level);
  await gm.waitForTimeout(160);
}
const seqOf=(pg,root)=>pg.evaluate(sel=>{
  const scr=document.querySelector(sel);if(!scr)return [];
  const kids=[];const push=el=>{if(el.id==='tab-akt'||el.id==='gmAkt'){[...el.children].forEach(push);return;}
    if(el.id==='gmActPage'||el.id==='aktBox')return;
    const r=el.getBoundingClientRect();if(r.height<=1||getComputedStyle(el).display==='none')return;kids.push(el);};
  [...scr.children].forEach(push);
  return kids.map(el=>{const r=el.getBoundingClientRect();
    return {cls:[...el.classList].join(' ').trim()||el.tagName.toLowerCase(),y:Math.round(r.y+scrollY),h:Math.round(r.height),w:Math.round(r.width),
      cards:(el.classList.contains('card')?1:0)+el.querySelectorAll('.card,.hub-act,.kpi,.filter-pill,.activity-card').length};
  });
},root);
async function mask(pg,rootSel){
  await pg.evaluate(rootSel=>{
    document.querySelectorAll('.gm-mask').forEach(m=>m.remove());
    const add=(x,y,w,h)=>{const d=document.createElement('div');d.className='gm-mask';
      d.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:#ff00ff;z-index:99999;pointer-events:none`;document.body.appendChild(d);};
    const walk=el=>{for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){
      const r=el.getBoundingClientRect();const p=(el.closest('.filter-pill,.kpi,.session-state,.hub-act,.subtabs button,.sport-tile,.ps-row,.mode-hint,.coach-tags span,.split-row,.dist-leg span,.ctitle,.card,.activity-body,.daily-goal,.hdr,.sectlabel,.mini-note,.plan-hero,.coach-card,.page-head,.detail-title,.detail-kpis div,.sheet,.empty,.route-empty,.gm-chart-empty')||el.parentElement||el).getBoundingClientRect();
      if(r.height>0&&r.height<120)add(p.x+scrollX+4,r.y+scrollY-3,Math.max(p.width-8,10),r.height+6);return;}}
      for(const c of el.children){if(!/^(svg|path|circle|rect|line|g|text)$/i.test(c.tagName))walk(c);}};
    const ROOT=rootSel?document.querySelector(rootSel):(document.querySelector('#gmActPage.on')||document.querySelector('.screen')||document.body);
    walk(ROOT||document.body);
    /* WERT-Füllungen: Chart-/Routen-Inneres + Split-Balkenspur (Container/Slots sichtbar) */
    (ROOT||document).querySelectorAll('.oc2,.route-map,.pq-track,.mini-track').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>2)add(r.x+scrollX+2,r.y+scrollY+2,Math.max(r.width-4,4),Math.max(r.height-4,3));});
    (ROOT||document).querySelectorAll('.split-row').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>2)add(r.x+scrollX+30,r.y+scrollY+2,Math.max(r.width-92,4),Math.max(r.height-4,3));});
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
      :m==='page'
      ?'.sheet:not(.on){display:none!important}.gm-page.on{position:static!important;height:auto!important;min-height:900px}.tabbar,.fab{display:none!important}'
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

/* ---------- Haupt-Pixelzustände: a/f/p Woche + f Monat + Filter-leer ---------- */
for(const [name,gl,pm,pre] of [
  ['a_week','a','anfaenger',null],
  ['f_week','f','fortgeschritten',null],
  ['p_week','p','profi',null],
  ['f_month','f','fortgeschritten','month'],
  ['f_filter_none','f','fortgeschritten','filter']
]){
  await gmAct(gl);
  await prod.evaluate(m=>setActState('good',m),pm);
  if(pre==='month'){await gm.evaluate(()=>setActScope('month'));await prod.evaluate(()=>gmSetActScope('month'));}
  if(pre==='filter'){await gm.evaluate(()=>setActivityFilter('Schwimmen'));await prod.evaluate(()=>gmSetActivityFilter('Schwimmen'));}
  await gm.waitForTimeout(120);await prod.waitForTimeout(80);
  /* Struktur */
  const gseq=await seqOf(gm,'#screen'),pseq=await seqOf(prod,'#prodScreen');
  const norm=a=>a.filter(x=>x.cls!=='statusbar').map(x=>x.cls.split(' ')[0]);
  const gn=norm(gseq),pn=norm(pseq);
  ok(name+': Sektionsfolge/Klassen identisch (Diff 0)', gn.join('|')===pn.join('|'), gn.join('|')+'  VS  '+pn.join('|'));
  const cards=a=>a.filter(x=>x.cls!=='statusbar').reduce((s,x)=>s+x.cards,0);
  ok(name+': identische Slot-/Kartenanzahl', cards(gseq)===cards(pseq), cards(gseq)+' vs '+cards(pseq));
  let boxOK=gn.length===pn.length,info='';
  const gsF=gseq.filter(x=>x.cls!=='statusbar');
  if(boxOK)for(let i=0;i<gsF.length;i++){const G=gsF[i],P=pseq[i];
    if(((G.w>=300)&&Math.abs(G.w-P.w)>2)||Math.abs(G.h-P.h)>56){boxOK=false;info=gn[i]+' w'+G.w+'/'+P.w+' h'+G.h+'/'+P.h;break;}}
  ok(name+': Bounding-Boxen', boxOK, info);
  /* Pixel: voll + Ausschnitte */
  await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  ok(name+': voller Scrollinhalt (inkl. Tabbar) ≤ 2 %', d.pct<=2, d.pct+'%');
  for(const [cut,scr] of [['top',0],['mid',700],['bot',99999]]){
    for(const [pg,rt] of [[gm,'#screen'],[prod,'#prodScreen']]){
      await capMode(pg,'view');
      await pg.evaluate(y=>scrollTo(0,y),scr);await pg.waitForTimeout(60);await mask(pg);
      await pg.screenshot({path:`${OUT}/${pg===gm?'gm':'prod'}_${name}_${cut}.png`});
      await unmask(pg);await capMode(pg,'');
    }
    const dc=diffPNG(`${OUT}/gm_${name}_${cut}.png`,`${OUT}/prod_${name}_${cut}.png`,`${OUT}/diff_${name}_${cut}.png`);
    results[name+'_'+cut]=dc;
    ok(name+' '+cut+': Viewport-Diff ≤ 2 %', dc.pct<=2, dc.pct+'%');
  }
  await gm.evaluate(()=>scrollTo(0,0));await prod.evaluate(()=>scrollTo(0,0));
  const over=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok(name+': kein horizontaler Überlauf', over<=0);
  ok(name+': keine sichtbare Legacy-Aktivitätsansicht', await prod.evaluate(()=>{const e=document.getElementById('aktBox');return !e||e.offsetParent===null||getComputedStyle(e).display==='none';}));
  ok(name+': nichts Sichtbares nach .tabspacer', await prod.evaluate(()=>{const t=document.querySelector('#gmAkt .tabspacer');let n=t?t.nextElementSibling:null;while(n){const r=n.getBoundingClientRect();if(r.height>1&&getComputedStyle(n).display!=='none')return false;n=n.nextElementSibling;}return true;}));
  if(pre==='filter'){await gm.evaluate(()=>setActivityFilter('Alle'));await prod.evaluate(()=>gmSetActivityFilter('Alle'));}
  if(pre==='month'){await gm.evaluate(()=>setActScope('week'));await prod.evaluate(()=>gmSetActScope('week'));}
}
/* ---------- Fixture-Strukturzustände (prod-only; Struktur-Diff 0 zur good-Basis) ---------- */
const BASE=await prod.evaluate(()=>{setActState('good','fortgeschritten');return [...document.querySelectorAll('#gmAkt > *')].map(e=>e.className.split(' ')[0]).join('|');});
for(const st of ['empty','partial','longtitle','unknown']){
  const r=await prod.evaluate(s=>{setActState(s,'fortgeschritten');
    return {seq:[...document.querySelectorAll('#gmAkt > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      hub:document.querySelectorAll('#gmAkt .hub-act').length,kpi:document.querySelectorAll('#gmAkt .kpi').length,
      fil:document.querySelectorAll('#gmAkt .filter-pill').length,
      cards:document.querySelectorAll('#gmAkt .activity-card').length,
      empty:!!document.querySelector('#gmAkt .empty'),
      zeros:/>0 km<|>0 min<|>0 bpm</.test(document.getElementById('gmAkt').innerHTML)};},st);
  const wantCards={empty:0,partial:4,longtitle:4,unknown:4}[st];
  ok('Zustand '+st+': Struktur unverändert, Slots vollständig, keine 0-statt-Missing, kein Überlauf',
     r.seq===BASE&&r.over<=0&&r.hub===7&&r.kpi===6&&r.fil===5&&r.cards===wantCards&&(st!=='empty'||r.empty)&&!r.zeros,
     st+': hub'+r.hub+' kpi'+r.kpi+' fil'+r.fil+' cards'+r.cards+(r.seq!==BASE?' SEQ!':''));
  await prod.evaluate(y=>scrollTo(0,0),0);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_state_${st}.png`);
}
await prod.evaluate(()=>setActState('good','fortgeschritten'));
ok('unbekannte Sportart bleibt unter „Alle" sichtbar', await prod.evaluate(()=>{setActState('unknown','fortgeschritten');const n=document.querySelectorAll('#gmAkt .activity-card[data-aid="u1"]').length;setActState('good','fortgeschritten');return n===1;}));

/* ---------- Aktivitätsdetail: Lauf mit GPS/Splits, Lauf ohne GPS, Kraft ---------- */
async function detailShot(name,gmOpen,prodOpen){
  await gm.evaluate(gmOpen);await gm.waitForTimeout(260);
  await prod.evaluate(prodOpen);await prod.waitForTimeout(120);
  await capMode(gm,'full');await mask(gm);
  const ge=await gm.$('#screen');await ge.screenshot({path:`${OUT}/gm_${name}.png`});
  await unmask(gm);await capMode(gm,'');
  await capMode(prod,'page');await mask(prod,'#gmActPage');
  const pe=await prod.$('#gmActPage');await pe.screenshot({path:`${OUT}/prod_${name}.png`});
  await unmask(prod);await capMode(prod,'');
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  return d;
}
await gmAct('f');
let d1=await detailShot('detail_run_gps',()=>openPage('activityDetail','run1'),()=>{setActState('good','fortgeschritten');gmOpenActivityPage('r1');});
ok('Laufdetail mit GPS/Chart/Splits: Pixel-Diff ≤ 2 %', d1.pct<=2, d1.pct+'%');
ok('Detail: Route ausschließlich aus echten GPS-Daten (rmap-SVG, keine Demo-Segmente)', await prod.evaluate(()=>!!document.querySelector('#gmActPage .route-map svg.rmap')&&!document.querySelector('#gmActPage .route-seg,#gmActPage .map-pin')));
ok('Detail: Splits nur aus echten Splits (12 aus Fixture-Session)', await prod.evaluate(()=>document.querySelectorAll('#gmActPage .split-row').length===12));
ok('Detail: 6 KPI-Slots, korrekte ID-Auflösung', await prod.evaluate(()=>document.querySelectorAll('#gmActPage .detail-kpis > div').length===6&&/12,5\s*km/.test(document.querySelector('#gmActPage .detail-kpis').textContent)));
await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseActivityPage());
/* Lauf ohne GPS/Serien: prod-only (GM-Demo hat immer Route) — Struktur + ehrlicher Empty-State */
await prod.evaluate(()=>gmOpenActivityPage('r2'));
ok('Laufdetail ohne GPS: Route-Slot bleibt, ehrlicher Empty-State, keine Demo-Route/-Splits', await prod.evaluate(()=>{
  const p=document.getElementById('gmActPage');
  return !!p.querySelector('.route-map')&&!p.querySelector('svg.rmap')&&!!p.querySelector('.route-empty')&&p.querySelectorAll('.split-row').length===0&&!!p.querySelector('.gm-split-empty')&&!!p.querySelector('.gm-chart-empty');}));
await capMode(prod,'page');await mask(prod,'#gmActPage');
await (await prod.$('#gmActPage')).screenshot({path:`${OUT}/prod_detail_run_nogps.png`});
await unmask(prod);await capMode(prod,'');
await prod.evaluate(()=>gmCloseActivityPage());
let d2=await detailShot('detail_gym',()=>openPage('activityDetail','gym1'),()=>gmOpenActivityPage('g1'));
ok('Kraftdetail: Pixel-Diff ≤ 2 %', d2.pct<=2, d2.pct+'%');
ok('Kraftdetail: keine Route/Chart/Splits, ÜBUNGEN/BELASTUNG belegt', await prod.evaluate(()=>{const p=document.getElementById('gmActPage');return !p.querySelector('.route-map')&&!p.querySelector('.oc2')&&!p.querySelector('.split-row')&&/BUNGEN/.test(p.textContent)&&/BELASTUNG/.test(p.textContent);}));
await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseActivityPage());

/* ---------- Start-Sheet + Pre-Start ---------- */
/* Sheet-Vergleich als Element-Shot: identische Sheet-Geometrie wird separat geprüft;
   der Pixel-Diff läuft über das Sheet-Element selbst (GM-Sheet liegt im entkoppelten
   Harness-Layout am Dokumentende — Element-Shot statt Viewport-Shot). */
async function sheetShot(name,gmOpen,prodOpen){
  await gmAct('f');
  await gm.evaluate(gmOpen);await gm.waitForTimeout(420);
  await prod.evaluate(()=>{setActState('good','fortgeschritten');});
  await prod.evaluate(prodOpen);await prod.waitForTimeout(420);
  await mask(gm,'.sheet.on');
  const ge=await gm.$('.sheet.on');await ge.screenshot({path:`${OUT}/gm_${name}.png`});
  await unmask(gm);
  await mask(prod,'.sheet.on');
  const pe=await prod.$('.sheet.on');await pe.screenshot({path:`${OUT}/prod_${name}.png`});
  await unmask(prod);
  const geo=await Promise.all([gm,prod].map(pg=>pg.evaluate(()=>{const s=document.querySelector('.sheet.on');const r=s.getBoundingClientRect();const cs=getComputedStyle(s);return {w:Math.round(r.width),h:Math.round(r.height),br:cs.borderRadius,pad:cs.padding};})));
  ok(name+': identische Sheet-Geometrie (Breite/Radius/Padding, Höhe ±8px)',
     geo[0].w===geo[1].w&&Math.abs(geo[0].h-geo[1].h)<=8&&geo[0].br===geo[1].br&&geo[0].pad===geo[1].pad,
     JSON.stringify(geo[0])+' vs '+JSON.stringify(geo[1]));
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  return d;
}
let ds=await sheetShot('sheet_start',()=>openStart(),()=>gmOpenStartSheet());
ok('Training-Start-Sheet: Pixel-Diff ≤ 2 %', ds.pct<=2, ds.pct+'%');
ok('Start-Sheet: 7 Sportkacheln, GM-Geometrie', await prod.evaluate(()=>{const s=document.querySelector('.sheet.on');return !!s&&s.querySelectorAll('.sport-tile').length===7&&!!s.querySelector('.grab');}));
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
let dp=await sheetShot('sheet_prestart',()=>{openStart('planned');startSport('Laufen');},()=>{gmOpenStartSheet('planned');gmStartSport('Laufen');});
ok('Pre-Start (mit vorhandenen Plandaten): Pixel-Diff ≤ 2 %', dp.pct<=2, dp.pct+'%');
ok('Pre-Start: 6 ps-rows + Hinweis + Start-CTA + Wearable-CTA, ehrliche Missingness', await prod.evaluate(()=>{
  const s=document.querySelector('.sheet.on');if(!s)return false;
  const t=s.innerHTML;
  return s.querySelectorAll('.ps-row').length===6&&!!s.querySelector('.mode-hint')&&/starten/.test(t)&&/Uhr/.test(t)&&!/Garmin verbunden|Uhr \+ Brustgurt|Readiness 82/.test(t);}));
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
let dm=await sheetShot('sheet_prestart_missing',()=>{openStart();startSport('Laufen');},()=>{gmOpenStartSheet('free');gmStartSport('Laufen');});
ok('Pre-Start (Missingness, freier Modus): Pixel-Diff ≤ 2 %', dm.pct<=2, dm.pct+'%');
ok('Pre-Start Missingness: alle nicht belegbaren Felder —', await prod.evaluate(()=>{const s=document.querySelector('.sheet.on');return !!s&&(s.innerHTML.match(/>—</g)||[]).length>=6;}));
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());

/* ---------- Interaktionen / Nebenwirkungen ---------- */
await prod.evaluate(()=>setActState('good','fortgeschritten'));
ok('Karte per Enter öffnet korrektes Detail', await prod.evaluate(()=>{
  const c=document.querySelector('#gmAkt .activity-card[data-aid="g1"]');
  c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  const on=document.getElementById('gmActPage').classList.contains('on');
  const okId=/Stabilit/.test(document.getElementById('gmActPage').textContent);
  gmCloseActivityPage();return on&&okId;}));
ok('Zurück: Hub intakt, Scroll erhalten', await prod.evaluate(()=>{
  scrollTo(0,300);gmOpenActivityPage('r1');gmCloseActivityPage();
  return Math.abs(scrollY-300)<4&&document.querySelectorAll('#gmAkt .activity-card').length===3;}));
await prod.evaluate(()=>scrollTo(0,0));
ok('Filter-Wechsel: keine Fixture-Mutation, keine Kartenduplikate', await prod.evaluate(()=>{
  const j0=JSON.stringify(listActivitiesUnified());
  gmSetActivityFilter('Laufen');gmSetActivityFilter('Kraft');gmSetActivityFilter('Alle');
  return JSON.stringify(listActivitiesUnified())===j0&&document.querySelectorAll('#gmAkt .activity-card').length===3;}));
ok('Start über Pre-Start: bestehender produktiver Handler, keine Planmutation', await prod.evaluate(()=>{
  const w0=JSON.stringify(activeWeekPlan());window.__wuStart=[];
  gmOpenStartSheet('free');gmStartSport('Radfahren');gmStartFromPreStart();
  return JSON.stringify(activeWeekPlan())===w0&&window.__wuStart.length===1&&window.__wuStart[0]==='Radfahren';}));
ok('Geplante Einheit: startPlannedUnit über bestehenden Pfad', await prod.evaluate(()=>{
  window.__started=0;gmOpenStartSheet('planned');gmStartSport('Laufen');gmStartFromPreStart();
  return window.__started===1;}));
ok('Escape schließt Start-Sheet', await prod.evaluate(()=>{gmOpenStartSheet();return document.querySelector('.sheet.on')!==null;})&&await (async()=>{await prod.keyboard.press('Escape');await prod.waitForTimeout(80);return prod.evaluate(()=>document.querySelector('.sheet.on')===null);})());
ok('Teaser öffnen ehrliches NA-Sheet', await prod.evaluate(()=>{gmOpenActTeaserSheet('best');const s=document.querySelector('.sheet.on');const okk=!!s&&/Noch nicht verfügbar/.test(s.textContent)&&!/26:14|sub-55/.test(s.textContent);gmCloseSheets();return okk;}));
ok('Verbindungs-Button nutzt bestehenden Einstieg', await prod.evaluate(()=>{window.__importOpened=0;document.querySelector('#gmAkt .hdr .iconbtn').click();return window.__importOpened===1;}));
ok('„Letzte wiederholen" deaktiviert ohne Demo-Aktion', await prod.evaluate(()=>{const btns=[...document.querySelectorAll('#gmAkt .hub-act')];const rep=btns.find(x=>/Letzte wiederholen/.test(x.textContent));return !!rep&&rep.disabled===true&&!rep.onclick;}));
ok('genau EIN Server-Refresh-Pfad (kein doppelter Store-Zugriff)', await prod.evaluate(()=>{window.__fetchCalls=0;renderAkt();return window.__fetchCalls===1&&document.querySelectorAll('#gmAkt .activity-card').length===3;}));
ok('5 Re-Renders: keine DOM-/Listener-Akkumulation, keine doppelten IDs', await prod.evaluate(()=>{
  renderGMActivity();const l0=document.getElementById('gmAkt').innerHTML.length;
  for(let i=0;i<5;i++)renderGMActivity();
  const ids=[...document.getElementById('gmAkt').innerHTML.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  return document.getElementById('gmAkt').innerHTML.length===l0&&new Set(ids).size===ids.length;}));

/* ---------- 390px-Durchlauf ---------- */
await gm.setViewportSize({width:390,height:844});await prod.setViewportSize({width:390,height:844});
await gm.addStyleTag({content:'.phone{width:390px!important}'});
for(const [name,gl,pm] of [['a390','a','anfaenger'],['f390','f','fortgeschritten'],['p390','p','profi']]){
  await gmAct(gl);
  await prod.evaluate(m=>setActState('good',m),pm);
  await prod.waitForTimeout(80);
  await fullShot(gm,'#screen',`${OUT}/gm_${name}.png`);
  await fullShot(prod,'#prodScreen',`${OUT}/prod_${name}.png`);
  const d390=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d390;
  ok(name+': 390px voller Scrollinhalt ≤ 2 %', d390.pct<=2, d390.pct+'%');
  const ov=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok(name+': 390px kein Überlauf', ov<=0);
}
/* 390px: Fixture-Zustände strukturell */
for(const st of ['empty','partial','longtitle','unknown']){
  const r=await prod.evaluate(s=>{setActState(s,'fortgeschritten');
    return {seq:[...document.querySelectorAll('#gmAkt > *')].map(e=>e.className.split(' ')[0]).join('|'),
      over:document.documentElement.scrollWidth-document.documentElement.clientWidth};},st);
  ok('390px Zustand '+st+': Struktur Diff 0, kein Überlauf', r.seq===BASE&&r.over<=0, r.seq!==BASE?'SEQ!':'');
}
/* 390px: Detail + Sheets */
await gmAct('f');
let d1b=await detailShot('detail_run_gps390',()=>openPage('activityDetail','run1'),()=>{setActState('good','fortgeschritten');gmOpenActivityPage('r1');});
ok('390px Laufdetail mit GPS: Pixel-Diff ≤ 2 %', d1b.pct<=2, d1b.pct+'%');
await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseActivityPage());
let d2b=await detailShot('detail_gym390',()=>openPage('activityDetail','gym1'),()=>gmOpenActivityPage('g1'));
ok('390px Kraftdetail: Pixel-Diff ≤ 2 %', d2b.pct<=2, d2b.pct+'%');
await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseActivityPage());
let ds9=await sheetShot('sheet_start390',()=>openStart(),()=>gmOpenStartSheet());
ok('390px Start-Sheet: Pixel-Diff ≤ 2 %', ds9.pct<=2, ds9.pct+'%');
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
let dp9=await sheetShot('sheet_prestart390',()=>{openStart('planned');startSport('Laufen');},()=>{gmOpenStartSheet('planned');gmStartSport('Laufen');});
ok('390px Pre-Start: Pixel-Diff ≤ 2 %', dp9.pct<=2, dp9.pct+'%');
await gm.evaluate(()=>closeSheets());await prod.evaluate(()=>gmCloseSheets());
await gm.addStyleTag({content:'.phone{width:430px!important}'});
await gm.setViewportSize({width:430,height:900});await prod.setViewportSize({width:430,height:900});

ok('keine Seitenfehler', perrs.length===0, perrs.slice(0,3).join('|'));
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
await b.close();
console.log('\nDiff je Zustand:',JSON.stringify(results));
console.log((fail?fail+' FAILED':'gm3_parity: ALL PASSED')+' ('+pass+' ok)');
