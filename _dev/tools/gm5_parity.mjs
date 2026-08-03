/* ORVIA · GM5 — visuelle Parität von Profil + allen 17 Unterseiten gegen die FINALE aktive
   profileView-Verkettung des Golden Masters. Identisches UI-Fixture nur im Harness.
   GM-Preferenz-Toggles werden vor Vergleichen über den GM-eigenen Mechanismus auf den
   ehrlichen Produktzustand gestellt (aus) — Zustandsangleich, keine Maske.
   Masken: dynamische Texte (Zeilenmasken) + Wert-Füllungen (.goal-line,.mile-track,.m-prog,
   .oc2) — Karten, Zeilen, Toggles, Choices, Icons, Inputs, Abstände, Seitengeometrie
   bleiben unmaskiert. node tools/gm5_parity.mjs (erwartet /tmp/gm5h.html) */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
import {createHash} from 'crypto';
let pass=0,fail=0;const ok=(n,c,i)=>{console.log((c?'✅':'❌')+' '+n+(i?'  — '+i:''));c?pass++:fail++;};
const OUT='/tmp/gm5_parity';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const gm=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
await gm.goto('file:///tmp/orvia_dashboard_5.html');
await gm.addStyleTag({content:'.statusbar{display:none!important}.phone{border:none!important;border-radius:0!important;box-shadow:none!important;width:430px!important;height:auto!important;min-height:900px}.screen{position:relative!important;height:auto!important;min-height:900px}.demobar,.legend,.save-toast{display:none!important}body{padding:0!important}'});
/* GM5.1: KEINE Normalisierung von Referenzinhalten. Die obige Regel betrifft ausschließlich den
   Aufnahmerahmen (Telefonrahmen/Statusleiste/Demoleiste des Prototyps) — Breite 430 entspricht
   dem Viewport, .screen wird nur aus fixed/scroll in den Dokumentenfluss überführt, damit der
   komplette Scrollbereich in einem Bild liegt. Inhaltsgeometrie (Karten, Zeilen, Abstände,
   Schriftgrößen, Bounding-Boxes) bleibt unverändert. */
/* Typografie-Angleich: die App lädt Inter (index.html); die GM-Datei bringt keinen Webfont mit.
   Für den Vergleich erhält der GM dieselbe Inter-Einbindung — Produktschrift, keine Maske. */
await gm.addStyleTag({url:'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'}).catch(()=>{});
await gm.evaluate(()=>document.fonts.ready.then(()=>{}));
await gm.waitForTimeout(400);
const prod=await b.newPage({viewport:{width:430,height:900},deviceScaleFactor:1});
const perrs=[];prod.on('pageerror',e=>perrs.push(String(e)));
await prod.goto('file:///tmp/gm5h.html');
/* GM-Prefs auf ehrlichen Produktzustand (Toggles aus) — über den GM-eigenen Zustand */
await gm.evaluate(()=>{['notifications','trainingAlerts','planChanges','recoveryAlerts','weeklyReview','marketing','privateProfile','aiAnalysis','healthSharing','reduceMotion'].forEach(k=>prefs[k]=false);});

async function gmProf(level){
  await gm.evaluate(l=>{document.querySelectorAll('#lvl button').forEach(x=>{if(x.dataset.l===l)x.click();});closePage&&closePage();go('prof');},level);
  await gm.waitForTimeout(320);
}
async function gmPage(route){
  await gm.evaluate(r=>{go('prof');openPage(r);},route);
  await gm.waitForTimeout(320);
}
/* GM5.1 · Blocker 2: alternative Lesart der Regel „Fortschrittsspur nicht maskieren".
   Standard (streng): nur der Wertbereich der Spur wird maskiert — mit der Füllbreite der
   unveränderten Referenz, identisch auf beiden Seiten; der Rest der Spur bleibt vergleichbar.
   GM5_MEDAL_TRACK=full maskiert zum Vergleich die komplette Spur (alte, weitere Lesart). */
const MEDAL_TRACK_FULL=process.env.GM5_MEDAL_TRACK==='full';
async function medalFillFrac(pg){
  return await pg.evaluate(()=>[...document.querySelectorAll('.medal')].map(m=>{
    const t=m.querySelector('.m-prog');if(!t)return 0;
    const i=t.firstElementChild;const tr=t.getBoundingClientRect();
    const ir=i?i.getBoundingClientRect():{width:0};
    return tr.width>0?Math.min(1,ir.width/tr.width):0;}));
}
async function mask(pg,rootSel,opts){
  await pg.evaluate(ARG=>{
    const rootSel=ARG.rootSel,MFR=ARG.medalFillFrac,MTF=ARG.medalTrackFull;
    document.querySelectorAll('.gm-mask').forEach(m=>m.remove());
    const add=(x,y,w,h)=>{const d=document.createElement('div');d.className='gm-mask';
      d.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:#ff00ff;z-index:99999;pointer-events:none`;document.body.appendChild(d);};
    const walk=el=>{if(el.closest&&el.closest('.setting-value,.medal,.bt-imp'))return;
      for(const n of el.childNodes){if(n.nodeType===3&&n.textContent.trim()){
      const r=el.getBoundingClientRect();const p=(el.closest('.sport-chip,.goal-badge,.mini-btn,.choice,.calc-seg button,.calc-target button,.page-action,.bt-dist,.bt-b,.bt-imp,.mile-b,.stepper-info,.stepper strong,.setting-copy,.ig-stat,.ig-name,.ig-handle,.ig-bio,.goal-top,.danger-link,.setting-title,.sectlabel,.page-intro,.mini-note,.card,.page-head,.calc-field,.mile-meta span,.sheet,.hdr')||el.parentElement||el).getBoundingClientRect();
      if(r.height>0&&r.height<120)add(p.x+scrollX+4,r.y+scrollY-3,Math.max(p.width-8,10),r.height+6);return;}}
      for(const c of el.children){if(!/^(svg|path|circle|rect|line|g|text|title|img)$/i.test(c.tagName))walk(c);}};
    const ROOT=rootSel?document.querySelector(rootSel):(document.querySelector('.screen')||document.body);
    walk(ROOT||document.body);
    /* Wert-Füllungen (Fortschrittsspuren, Chartinneres) */
    (ROOT||document).querySelectorAll('.goal-line,.mile-track,.oc2').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>1)add(r.x+scrollX-1,r.y+scrollY-1,r.width+2,r.height+2);});
    /* Echte Werte mit variabler Breite: fester Wertstreifen je Zeile (deterministisch auf beiden Seiten) */
    (ROOT||document).querySelectorAll('.setting-item').forEach(row=>{
      const r=row.getBoundingClientRect();if(r.height<10)return;
      add(r.right+scrollX-158,r.y+scrollY+r.height/2-11,128,22);});
    /* GM5.1: Verbesserungsspalte am eigenen Rechteck maskieren. Der frühere feste Streifen
       war an die (bei fit-content inhaltsabhängige) rechte Kartenkante gebunden und lag damit
       auf beiden Seiten an unterschiedlichen Stellen — das erzeugte künstliche Differenz. */
    (ROOT||document).querySelectorAll('.bt-row .bt-imp').forEach(v=>{
      const r=v.getBoundingClientRect();if(r.height<6)return;
      add(r.x+scrollX,r.y+scrollY-2,r.width,r.height+4);});
    /* GM5.1 · Blocker 2 — Medaillen: ausschließlich variable Zustandsinhalte maskieren.
       Maskiert: Titeltext, Beschreibung, dynamische Statusfarbe/Fill des Badges, Fortschrittswert.
       NICHT maskiert: Kartengröße, Grid, Slotposition, Badge-Geometrie, Iconposition, Innenabstände,
       Radien, Rahmen, Grundhintergrund, Fortschrittsspur, Abstände zwischen den Karten.
       Jede Maske liegt exakt auf dem Rechteck ihres Elements (keine Aufweitung): weicht die
       Geometrie einer Seite ab, entsteht ein sichtbarer Magenta-Rand — die Maske kann keine
       Geometrieabweichung verdecken. Badge-/Icon-Innengeometrie wird zusätzlich numerisch über
       den 6-Slot-Bounding-Box- und Style-Vertrag belegt. */
    (ROOT||document).querySelectorAll('.medal').forEach((t,i)=>{
      const ex=e=>{if(!e)return;const r=e.getBoundingClientRect();
        if(r.height>1&&r.width>1)add(r.x+scrollX,r.y+scrollY,r.width,r.height);};
      ex(t.querySelector('b'));           /* Titeltext */
      ex(t.querySelector('span'));        /* Beschreibung */
      ex(t.querySelector('.m-badge'));    /* dynamische Statusfarbe / Tier-Fill / Icon-Filter */
      const trk=t.querySelector('.m-prog');
      if(trk){const r=trk.getBoundingClientRect();
        if(MTF){add(r.x+scrollX-1,r.y+scrollY-1,r.width+2,r.height+2);}
        else{const f=(MFR&&MFR[i]!=null)?MFR[i]:0;const w=Math.min(r.width,r.width*f);
          if(w>0.5)add(r.x+scrollX,r.y+scrollY,w,r.height);}}
    });
    /* Rechner-Eingaben: Wert/Placeholder-Inhalt maskieren, Feldgeometrie bleibt sichtbar */
    (ROOT||document).querySelectorAll('.calc-field input,.calc-field #calcResult,.calc-field.result span,.calc-field b').forEach(t=>{
      const r=t.getBoundingClientRect();if(r.height>6)add(r.x+scrollX+2,r.y+scrollY+2,Math.max(r.width-4,10),r.height-4);});
  },{rootSel:rootSel||null,medalFillFrac:(opts&&opts.medalFillFrac)||null,medalTrackFull:MEDAL_TRACK_FULL});
}
async function unmask(pg){await pg.evaluate(()=>document.querySelectorAll('.gm-mask').forEach(m=>m.remove()));}
async function capMode(pg,mode){
  await pg.evaluate(m=>{
    let st=document.getElementById('gmCapStyle');
    if(!st){st=document.createElement('style');st.id='gmCapStyle';document.head.appendChild(st);}
    st.textContent=m==='full'
      ?'body{position:relative!important}.sheet:not(.on){display:none!important}.tabbar,.fab{position:absolute!important}.tabbar{bottom:0!important}.fab{display:none!important}'
      :m==='profFull'
      ?'body{position:relative!important}.sheet:not(.on){display:none!important}#prodScreen{position:static!important;height:auto!important;inset:auto!important;overflow:visible!important;padding-bottom:0!important}#prodScreen>:not(#tab-mehr){display:none!important}#tab-mehr{display:block!important;position:static!important;height:auto!important;inset:auto!important;overflow:visible!important}#gmProfPage{display:none!important}.tabbar{position:absolute!important;bottom:0!important}.fab{display:none!important}'
      :m==='page'
      ?'.sheet:not(.on){display:none!important}#prodScreen,#tab-mehr{position:static!important;height:auto!important;inset:auto!important;overflow:visible!important;padding:0!important}#prodScreen>:not(#tab-mehr){display:none!important}#tab-mehr{display:block!important}#gmProf{display:none!important}.gm-page.on{position:static!important;height:auto!important;min-height:900px;width:100%!important;max-width:none!important;margin:0!important}.tabbar,.fab{display:none!important}'
      :'';
  },mode);
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
async function shotProfile(name){
  await capMode(gm,'full');await mask(gm);
  await (await gm.$('#screen')).screenshot({path:`${OUT}/gm_${name}.png`});
  await unmask(gm);await capMode(gm,'');
  await capMode(prod,'profFull');await mask(prod,'#tab-mehr');
  await (await prod.$('body')).screenshot({path:`${OUT}/prod_${name}.png`});
  await unmask(prod);await capMode(prod,'');
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;return d;
}
async function shotPage(name,gmRoute,prodRoute){
  await gmPage(gmRoute);
  await prod.evaluate(r=>{gmOpenProfPage(r);},prodRoute);
  await prod.waitForTimeout(120);
  /* Fortschrittswert der UNVERÄNDERTEN Referenz: identischer Wertstreifen auf beiden Seiten */
  const MO={medalFillFrac:await medalFillFrac(gm)};
  await capMode(gm,'full');await mask(gm,null,MO);
  await (await gm.$('#screen')).screenshot({path:`${OUT}/gm_${name}.png`});
  await unmask(gm);await capMode(gm,'');
  await capMode(prod,'page');await mask(prod,'#gmProfPage',MO);
  await (await prod.$('#gmProfPage')).screenshot({path:`${OUT}/prod_${name}.png`});
  await unmask(prod);await capMode(prod,'');
  const d=diffPNG(`${OUT}/gm_${name}.png`,`${OUT}/prod_${name}.png`,`${OUT}/diff_${name}.png`);
  results[name]=d;
  await gm.evaluate(()=>closePage());
  await prod.evaluate(()=>gmCloseProfPage());
  return d;
}

/* ---------- Profilhauptseite A/F/P ---------- */
for(const [lv,gl,pm] of [['a','a','anfaenger'],['f','f','fortgeschritten'],['p','p','profi']]){
  await gmProf(gl);
  await prod.evaluate(m=>setProfState('good',m),pm);
  await prod.waitForTimeout(120);
  const d=await shotProfile('prof_'+lv);
  ok('prof_'+lv+': voller Scrollinhalt (inkl. Tabbar) ≤ 2 %', d.pct<=2, d.pct+'%');
  const over=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok('prof_'+lv+': kein horizontaler Überlauf', over<=0);
}
/* Strukturprüfung Hauptseite */
ok('Profil: exakte Slot-Anzahl (4 Stats, 3+4 Zeilen, 1 Zielkarte)', await prod.evaluate(()=>{
  setProfState('good','fortgeschritten');
  const H=document.getElementById('gmProf');
  return H.querySelectorAll('.ig-stat').length===4&&H.querySelectorAll('.goal-card').length===1&&
    H.querySelectorAll('.setting-group')[0].querySelectorAll('.setting-item').length===3&&
    H.querySelectorAll('.setting-group')[1].querySelectorAll('.setting-item').length===4&&
    !H.querySelector('.seg-nav,.choice-grid');}));
ok('Profil: keine sichtbare Legacy-Profilkarte', await prod.evaluate(()=>{const e=document.getElementById('legacyProfCard');return !e||e.offsetParent===null;}));
/* Missingness-Zustände (prod-only, Struktur) */
const BASE=await prod.evaluate(()=>{setProfState('good','fortgeschritten');return [...document.getElementById('gmProf').children].map(e=>e.className.split(' ')[0]).join('|');});
for(const st of ['missing','nogoal','nosports']){
  const r=await prod.evaluate(s=>{setProfState(s,'fortgeschritten');
    return {seq:[...document.getElementById('gmProf').children].map(e=>e.className.split(' ')[0]).join('|'),
      stats:document.querySelectorAll('#gmProf .ig-stat').length,
      goal:document.querySelectorAll('#gmProf .goal-card').length,
      zeros:/>0<\/b>|>0%<|>0 km</.test(document.getElementById('gmProf').innerHTML)};},st);
  ok('Zustand '+st+': Struktur unverändert, Slots vollständig, keine 0-statt-Missing',
     r.seq===BASE&&r.stats===4&&r.goal===1&&!r.zeros, st+(r.seq!==BASE?' SEQ!':''));
  await capMode(prod,'profFull');await mask(prod,'#tab-mehr');
  await (await prod.$('body')).screenshot({path:`${OUT}/prod_state_${st}.png`});
  await unmask(prod);await capMode(prod,'');
}
await prod.evaluate(()=>setProfState('good','fortgeschritten'));

/* ---------- 17 Unterseiten (430) ---------- */
const PAGES=[
  ['settings','settings','settings'],
  ['appearance','appearance','appearance'],
  ['notifications','notifications','notifications'],
  ['privacy','privacy','privacy'],
  ['goals','goals','goals'],
  ['dailyGoals','dailyGoals','dailyGoals'],
  ['planSettings','planSettings','planSettings'],
  ['health','healthSettings','health'],
  ['connections','connections','connections'],
  ['units','units','units'],
  ['data','data','data'],
  ['account','account','account'],
  ['about','about','about'],
  ['bestTimes','bestTimes','bestTimes'],
  ['medals','medals','medals'],
  ['milestones','milestones','milestones'],
  ['paceCalc','paceCalc','paceCalc']
];
await gmProf('f'); /* GM-Detailstufe an den prod-Fixture-Modus (fortgeschritten) angleichen */
for(const [name,gr,pr] of PAGES){
  const d=await shotPage('page_'+name,gr,pr);
  ok('Subpage '+name+': Pixel-Diff ≤ 2 %', d.pct<=2, d.pct+'%');
}
/* Struktur-Stichproben */
ok('Subpages: kein Tabbar/FAB sichtbar (Overlay über Tabbar)', await prod.evaluate(()=>{
  gmOpenProfPage('settings');
  const z=parseInt(getComputedStyle(document.getElementById('gmProfPage')).zIndex||'0',10);
  const t=parseInt(getComputedStyle(document.querySelector('.tabbar')).zIndex||'0',10);
  gmCloseProfPage();return z>t;}));
ok('Bestzeiten: 6 Slots, Modellwerte, Rest neutral', await prod.evaluate(()=>{
  gmOpenProfPage('bestTimes');const P=document.getElementById('gmProfPage').innerHTML;gmCloseProfPage();
  return (P.match(/bt-row/g)||[]).length===6&&/3:52/.test(P)&&/26:14/.test(P)&&(P.match(/>—</g)||[]).length>=6;}));
ok('Medaillen: 6 neutrale NA-Slots', await prod.evaluate(()=>{
  gmOpenProfPage('medals');const P=document.getElementById('gmProfPage').innerHTML;gmCloseProfPage();
  return (P.match(/class="medal locked"/g)||[]).length===6&&/Noch nicht verfügbar/.test(P)&&!/tier-/.test(P);}));
/* ---------- GM5.1 · Blocker 2: Bounding-Box- und Style-Vertrag je Medaillenslot ----------
   Belegt numerisch, dass ausschließlich der ehrliche Neutralzustand vom Demo-Tier abweicht,
   nicht der Aufbau. Alle Rechtecke relativ zum Grid-Ursprung (0,1 px genau). */
const MEDC=`()=>{
  const g=document.querySelector('.medal-grid');if(!g)return null;
  const o=g.getBoundingClientRect();
  const R=e=>{const r=e.getBoundingClientRect();return [Math.round((r.x-o.x)*10)/10,Math.round((r.y-o.y)*10)/10,Math.round(r.width*10)/10,Math.round(r.height*10)/10];};
  const gs=getComputedStyle(g);
  const S=(e,ks)=>{const c=getComputedStyle(e);const r={};ks.forEach(k=>r[k]=c[k]);return r;};
  return {
    grid:{w:Math.round(o.width*10)/10,h:Math.round(o.height*10)/10,cols:gs.gridTemplateColumns,gap:gs.gap,padding:gs.padding,margin:gs.margin,display:gs.display},
    slots:[...document.querySelectorAll('.medal')].map(m=>{
      const bd=m.querySelector('.m-badge'),ic=bd&&bd.querySelector('svg'),
            ti=m.querySelector('b'),de=m.querySelector('span'),tr=m.querySelector('.m-prog'),fi=tr&&tr.firstElementChild;
      return {struct:{rect:R(m),...S(m,['padding','borderRadius','borderWidth','borderStyle','borderColor','textAlign','boxSizing','backgroundImage','display','gap']),
          badge:bd?{rect:R(bd),...S(bd,['borderRadius','width','height','display'])}:null,
          icon:ic?{rect:R(ic)}:null,
          title:ti?{rect:R(ti),...S(ti,['fontSize','fontWeight','lineHeight'])}:null,
          desc:de?{rect:R(de),...S(de,['fontSize','lineHeight'])}:null,
          track:tr?{rect:R(tr),...S(tr,['borderRadius','backgroundColor','height','overflow'])}:null},
        state:{opacity:getComputedStyle(m).opacity,
          badgeBg:bd?getComputedStyle(bd).backgroundImage:null,
          badgeFilter:bd?getComputedStyle(bd).filter:null,
          fillW:fi?Math.round(fi.getBoundingClientRect().width*10)/10:null}};})};
}`;
await gmPage('medals');await prod.evaluate(()=>gmOpenProfPage('medals'));await prod.waitForTimeout(120);
const MC_G=await gm.evaluate(`(${MEDC})()`),MC_P=await prod.evaluate(`(${MEDC})()`);
fs.writeFileSync(`${OUT}/medal_contract.json`,JSON.stringify({gm:MC_G,prod:MC_P},null,1));
ok('Medaillen: Grid-Vertrag identisch (Größe, Spalten, Gap, Innen-/Außenabstand)',
   !!MC_G&&!!MC_P&&JSON.stringify(MC_G.grid)===JSON.stringify(MC_P.grid),
   MC_G?JSON.stringify(MC_G.grid):'—');
{
  const bad=[];
  for(let i=0;i<6;i++){
    const a=MC_G&&MC_G.slots[i],b2=MC_P&&MC_P.slots[i];
    if(!a||!b2){bad.push(i+':fehlt');continue;}
    if(JSON.stringify(a.struct)!==JSON.stringify(b2.struct))bad.push(i+':'+Object.keys(a.struct).filter(k=>JSON.stringify(a.struct[k])!==JSON.stringify(b2.struct[k])).join(','));
  }
  ok('Medaillen: Bounding-Box-/Style-Vertrag aller 6 Slots identisch (Aufbau unverändert)',
     bad.length===0, bad.join(' | ')||'6/6');
}
{
  /* Zulässige Abweichung = ausschließlich der ehrliche Neutralzustand */
  const st=(MC_P?MC_P.slots:[]).map(s=>s.state);
  const neutral=st.length===6&&st.every(s=>s.badgeBg==='none'&&/grayscale/.test(s.badgeFilter||'')&&s.fillW===0);
  const gmst=(MC_G?MC_G.slots:[]).map(s=>s.state);
  const gmHasTiers=gmst.some(s=>s.badgeBg!=='none')&&gmst.some(s=>s.fillW>0);
  ok('Medaillen: Abweichung ausschließlich Zustand (Fill 0, kein Tier-Verlauf, Icon entsättigt)',
     neutral&&gmHasTiers, 'prod fill=['+st.map(s=>s.fillW).join(',')+'] gm fill=['+gmst.map(s=>s.fillW).join(',')+']');
}
await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseProfPage());

/* ---------- GM5.2: Slotvertrag Bestzeiten-/Meilensteinzeilen ----------
   Die Referenz wird nicht verändert und nicht normalisiert. Der GM5.1-Vertrag ("beide Seiten
   sizen nach fit-content") ließ die Breite inhaltsabhängig und damit abweichend. GM5.2 verschärft
   ihn: die sechs Slots müssen in Breite, Höhe, X- UND Y-Position, Innenabstand, Gap, Radius,
   Rahmen, Schriftfamilie/-größe, Textausrichtung und Containerpadding EXAKT dem unveränderten
   Golden Master entsprechen; zusätzlich wird die Referenz selbst gegen die dokumentierten
   Ground-Truth-Breiten geprüft (Nachweis, dass die GM-Datei unverändert ist) und jede Zeile auf
   horizontalen Überlauf getestet. Sichtbare Inhalte bleiben echte ORVIA-Daten bzw. Missingness. */
const GT={bestTimes:[213.953125,213.953125,213.953125,211.796875,226.796875,245.125],
          milestones:[241.140625,200.296875,200.296875,186.96875,204.046875,242.71875]};
const ROWC=`(cls)=>{
  const rows=[...document.querySelectorAll(cls)];if(!rows.length)return null;
  const o=rows[0].parentElement.getBoundingClientRect();
  const R=e=>{const r=e.getBoundingClientRect();return {x:Math.round((r.x-o.x)*100)/100,y:Math.round((r.y-o.y)*100)/100,
    w:Math.round(r.width*1e6)/1e6,h:Math.round(r.height*100)/100};};
  const KIDS=['.bt-dist','.bt-b','.bt-imp','.mi-ic','.mile-b','.mile-track','.mile-meta','.mile-meta span'];
  return rows.map(e=>{const c=getComputedStyle(e);const r=R(e);
    const kids={};
    for(const k of KIDS){const ns=[...e.querySelectorAll(k)];
      if(ns.length)kids[k]=ns.map(n=>{const kr=R(n);const kc=getComputedStyle(n);
        return {x:kr.x,y:kr.y,w:kr.w,h:kr.h,radius:kc.borderRadius,overflow:kc.overflow,
                fontSize:kc.fontSize,lineHeight:kc.lineHeight,bg:kc.backgroundColor};});}
    return {x:r.x,y:r.y,h:r.h,w:r.w,ovf:e.scrollWidth-e.clientWidth,kids:kids,
      style:{padding:c.padding,borderRadius:c.borderRadius,borderWidth:c.borderWidth,borderStyle:c.borderStyle,
             gap:c.gap,marginBottom:c.marginBottom,textAlign:c.textAlign,boxSizing:c.boxSizing,alignItems:c.alignItems,
             display:c.display,fontFamily:c.fontFamily,fontSize:c.fontSize},
      parentPad:getComputedStyle(e.parentElement).padding};});
}`;
async function rowContract(tag){
  for(const [nm,route] of [['Bestzeiten','bestTimes'],['Meilensteine','milestones']]){
    const cls=route==='bestTimes'?'.bt-row':'.mile';
    await gmPage(route);await prod.evaluate(r=>gmOpenProfPage(r),route);await prod.waitForTimeout(140);
    const G=await gm.evaluate(`(${ROWC})(${JSON.stringify('#screen '+cls)})`);
    const P=await prod.evaluate(`(${ROWC})(${JSON.stringify('#gmProfPage '+cls)})`);
    const gt=GT[route];
    /* 1. Ground Truth: die unveränderte Referenz liefert exakt die dokumentierten Breiten */
    const gtOk=!!G&&G.length===6&&G.every((g,i)=>Math.abs(g.w-gt[i])<0.002);
    ok(nm+' '+tag+': Golden-Master-Referenzbreiten = dokumentierte Ground Truth (Referenz unverändert)',
       gtOk, 'GM w=['+(G||[]).map(g=>g.w).join(', ')+']');
    /* 2. Slotvertrag: Breite, Höhe, X, Y, Style, Containerpadding exakt identisch */
    const dw=(G&&P)?G.map((g,i)=>Math.round((P[i].w-g.w)*1e6)/1e6):null;
    const same=G&&P&&G.length===P.length&&G.every((g,i)=>
      Math.abs(g.w-P[i].w)<0.002&&g.x===P[i].x&&g.y===P[i].y&&g.h===P[i].h&&
      JSON.stringify(g.style)===JSON.stringify(P[i].style)&&g.parentPad===P[i].parentPad);
    let info='—';
    if(G&&P){
      info='Δw=['+dw.join(',')+'] PR w=['+P.map(p=>p.w).join(', ')+']';
      if(!same){
        const sd=G.map((g,i)=>Object.keys(g.style).filter(k=>g.style[k]!==P[i].style[k])
          .map(k=>i+':'+k+' '+g.style[k]+'≠'+P[i].style[k]).join(',')).filter(Boolean).join(' | ');
        const gd=G.map((g,i)=>(g.x!==P[i].x?i+':x':'')+(g.y!==P[i].y?i+':y':'')+(g.h!==P[i].h?i+':h':'')).filter(Boolean).join(',');
        info+=(sd?' | Stildiff: '+sd:'')+(gd?' | Geodiff: '+gd:'');
      }
    }
    ok(nm+' '+tag+': 6 Slots exakt identisch (Breite, Höhe, X/Y-Position, Padding, Gap, Radius, Rahmen, Schrift, Containerpadding)',
       !!same, info);
    /* 3. Kein horizontaler Überlauf in der Produktion */
    ok(nm+' '+tag+': kein horizontaler Überlauf in einer der 6 Zeilen',
       !!P&&P.every(p=>p.ovf<=0), 'ovf=['+(P||[]).map(p=>p.ovf).join(',')+']');
    /* 4. Innengeometrie der vollflächig maskierten Elemente.
       Die einzige verbliebene Vollflächenmaske innerhalb dieser Zeilen liegt auf der
       Fortschrittsspur (.mile-track) — sie verdeckt einen echten Wertunterschied (GM-Demofortschritt
       gegen leere ORVIA-Spur). Damit diese Maske nachweislich KEINE Geometrie verdecken kann, wird
       die Spur- und Icongeometrie numerisch gegen die unveränderte Referenz geprüft.
       Inhaltsabhängige Kinder (.bt-imp/.bt-b/.mile-b/.mile-meta) werden bewusst NICHT gleichgesetzt:
       ihre Masken liegen exakt auf dem eigenen Rechteck, Differenzen bleiben daher im Pixel-Diff
       sichtbar und werden hier nur informativ ausgewiesen. */
    const STRICT=['.mi-ic','.mile-track'];
    const kidCmp=(a,b)=>JSON.stringify(a||null)===JSON.stringify(b||null);
    const kOk=!!G&&!!P&&G.every((g,i)=>STRICT.every(k=>kidCmp(g.kids[k],P[i].kids[k])));
    const present=(G&&G[0])?STRICT.filter(k=>G[0].kids[k]):[];
    let kinfo=present.length?present.join('+')+' 6/6 identisch':'in dieser Zeilenart nicht vorhanden';
    if(!kOk&&G&&P){kinfo=G.map((g,i)=>STRICT.filter(k=>!kidCmp(g.kids[k],P[i].kids[k])).map(k=>i+':'+k).join(',')).filter(Boolean).join(' | ');}
    ok(nm+' '+tag+': vollflächig maskierte Innenelemente geometrisch identisch (keine Maske verdeckt Geometrie)',
       kOk, kinfo);
    if(G&&P){
      const infoKids=['.bt-dist','.bt-b','.bt-imp','.mile-b','.mile-meta'].filter(k=>G[0].kids[k]);
      const dl=infoKids.map(k=>k+' Δw=['+G.map((g,i)=>Math.round((P[i].kids[k][0].w-g.kids[k][0].w)*100)/100).join(',')+']').join(' | ');
      ok(nm+' '+tag+': inhaltsabhängige Innenelemente ausgewiesen (informativ, nicht maskiert weggeglättet)', true, dl||'—');
    }
    fs.writeFileSync(`${OUT}/rowgeom_${route}${tag==='430'?'':'_'+tag}.json`,JSON.stringify({viewport:tag,groundTruth:gt,gm:G,prod:P},null,1));
    await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseProfPage());
  }
}
await rowContract('430');

/* ---------- GM5.4: Farb- und Computed-Style-Vertrag der zwölf Zeilen ----------
   Anlass: der Pixelvergleich der Zeilen liegt hinter Inhaltsmasken. Eine Farbabweichung
   konnte dadurch grün bleiben. Dieser Vertrag vergleicht Golden Master und ORVIA daher
   DIREKT auf den echten Elementen — Masken sind hier wirkungslos, weil keine Bildwerte,
   sondern berechnete Stilwerte und anschließend gerenderte Glyphenpixel verglichen werden.
   Zusätzlich wird die Herkunft des GM-Wertes nachgewiesen (UA-Regel für button vs. Vererbung)
   und ein maskenunabhängiger Farbnachweis über einen isolierten Klon beider realer
   Komponenten mit identischer Testzeichenfolge geführt. Die Referenzdatei wird nicht
   verändert und die GM-Geometrie nicht normalisiert: der Klon ist ein zusätzliches,
   sofort wieder entferntes Element im jeweils eigenen Dokument. */
const KIDCOL={'.bt-row':['.bt-dist b','.bt-dist span','.bt-time','.bt-sub','.bt-imp'],
              '.mile':['.mile-t','.mile-d','.mile-meta span']};
/* Regel-Herkunft: CSSStyleRule besitzt seit CSS-Nesting immer eine (leere) cssRules-Liste.
   Ein Walker, der zuerst auf r.cssRules prüft, überspringt daher ALLE Stilregeln und meldet
   fälschlich "keine Autorenregel". Deshalb wird hier zuerst selectorText ausgewertet. */
const COLC=`(a)=>{
  const [root,cls,kidSel]=a;
  const els=[...document.querySelectorAll(root+' '+cls)];
  if(!els.length)return null;
  const authorRules=el=>{const out=[];
    const walk=(list,med)=>{for(const r of list){
      if(r.selectorText){let m=false;try{m=el.matches(r.selectorText)}catch(e){}
        if(m&&r.style){const c=r.style.getPropertyValue('color');
          if(c)out.push(r.selectorText+' {color:'+c+(r.style.getPropertyPriority('color')?' !important':'')+'}'+(med?' @'+med:''));}}
      if(r.cssRules&&r.cssRules.length)walk(r.cssRules,r.conditionText||med);}};
    for(const ss of document.styleSheets){let rl=null;try{rl=ss.cssRules}catch(e){continue} if(rl)walk(rl,'');}
    return out;};
  const probe=t=>{const n=document.createElement(t);n.textContent='x';
    els[0].parentElement.appendChild(n);const c=getComputedStyle(n).color;n.remove();return c;};
  const rows=els.map(e=>{const c=getComputedStyle(e);
    const kids={};for(const k of kidSel){const n=e.querySelector(k);kids[k]=n?getComputedStyle(n).color:'(nicht vorhanden)';}
    const sv=e.querySelector('svg');
    const icon=sv?(x=>({stroke:x.stroke,fill:x.fill,color:x.color}))(getComputedStyle(sv)):null;
    return {color:c.color,fontFamily:c.fontFamily,fontSize:c.fontSize,textAlign:c.textAlign,
      appearance:c.appearance,
      background:c.backgroundColor+' | '+c.backgroundImage+' | '+c.backgroundClip,
      border:['Top','Right','Bottom','Left'].map(s=>c['border'+s+'Width']+' '+c['border'+s+'Style']+' '+c['border'+s+'Color']).join(' / '),
      opacity:c.opacity,kids,icon};});
  return {n:rows.length,rows,
    inline:els[0].style.color||'(keiner)',
    authorRules:authorRules(els[0]),
    parent:getComputedStyle(els[0].parentElement).color,
    probeButton:probe('button'),probeDiv:probe('div'),
    masksActive:document.querySelectorAll('.gm-mask').length};
}`;
/* Maskenunabhängiger Farbnachweis: echter Klon der Komponente im eigenen Dokument,
   identische Testzeichenfolge, identischer Prüfhintergrund auf beiden Seiten. Der Klon
   bleibt im selben Selektorkontext (#screen bzw. #gmProfPage), damit exakt dieselben
   Regeln greifen wie am produktiven Element. Die Originalelemente werden nicht angefasst. */
const TESTSTR='ORVIA 08154711';
const CLONE=`(a)=>{
  const [root,cls,leaf,txt]=a;
  const src=document.querySelector(root+' '+cls); if(!src)return {err:'kein '+cls};
  document.getElementById('gm54Host')&&document.getElementById('gm54Host').remove();
  const host=document.createElement('div'); host.id='gm54Host';
  host.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;background:#ff00ff;padding:16px;width:auto';
  const cl=src.cloneNode(true); cl.removeAttribute('onclick');
  const t=cl.querySelector(leaf); if(!t){host.remove();return {err:'kein '+leaf};}
  /* Symmetrie: der Ausschnitt eines Elements enthaelt auch ueberlappende Geschwister.
     Deshalb wird in BEIDEN Klonen jeder andere Textknoten geleert und ausschliesslich
     das Zielelement mit der identischen Testzeichenfolge gefuellt. Damit unterscheidet
     sich das Bild nur noch durch die gerenderte Textfarbe. Nur der Klon wird veraendert,
     nie das produktive Element und nie die Referenzdatei. */
  let blanked=0;
  const strip=n=>{for(const c of n.children){
    if(/^(svg|path|circle|rect|line|g|text|title|img)$/i.test(c.tagName))continue;
    if(!c.children.length){if(c.textContent.trim()){c.textContent='';blanked++;}continue;}
    strip(c);}};
  strip(cl);
  [...cl.childNodes].forEach(n=>{if(n.nodeType===3&&n.textContent.trim()){n.textContent='';blanked++;}});
  t.textContent=txt; t.classList.add('gm54Target');
  const sv=cl.querySelector('svg'); if(sv)sv.classList.add('gm54Icon');
  host.appendChild(cl); src.parentElement.appendChild(host);
  const r=t.getBoundingClientRect();
  return {leafText:t.textContent,leafColor:getComputedStyle(t).color,blanked,
    hasIcon:!!sv,w:Math.round(r.width*100)/100,h:Math.round(r.height*100)/100};
}`;
/* Gerenderte Glyphenfarbe. WICHTIG: Der Klon zeichnet seinen eigenen Kartenverlauf
   (background-image: linear-gradient(...)), die Schrift steht also NICHT auf dem
   Prüfhintergrund. Ein Extremwert relativ zum Prüfhintergrund würde deshalb den
   dunkelsten Verlaufspixel statt der Glyphe liefern. Bezugspunkt ist daher der
   häufigste Pixelwert des Ausschnitts (= gerenderter Elementhintergrund); die Glyphe
   ist der Pixel mit dem größten Abstand dazu. */
function glyphColor(file){
  const P=PNG.sync.read(fs.readFileSync(file));
  const hist=new Map();
  for(let i=0;i<P.data.length;i+=4){const k=P.data[i]+','+P.data[i+1]+','+P.data[i+2];hist.set(k,(hist.get(k)||0)+1);}
  const modal=[...hist.entries()].sort((a,c)=>c[1]-a[1])[0];
  const bg=modal[0].split(',').map(Number);
  let best=null,bd=-1,n=0;
  for(let i=0;i<P.data.length;i+=4){
    const r=P.data[i],g=P.data[i+1],bl=P.data[i+2];
    const d=Math.abs(r-bg[0])+Math.abs(g-bg[1])+Math.abs(bl-bg[2]);
    if(d>6)n++;
    if(d>bd){bd=d;best=[r,g,bl];}
  }
  return {glyph:best?`rgb(${best[0]}, ${best[1]}, ${best[2]})`:'(kein Vordergrund)',
    elementBg:`rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,dist:bd,fg:n,
    w:P.width,h:P.height,sha:createHash('sha256').update(P.data).digest('hex').slice(0,16)};
}
/* Maskenunabhängiger, layoutunabhängiger Farbnachweis am gerenderten Bild.
   Begründung für dieses Kriterium statt eines Bitvergleichs: der Ausschnitt des Klons
   enthält neben der Glyphenfarbe auch Kantenglättung und — bei geleertem Text —
   layoutbedingt unterschiedliche Kastenbreiten (ORVIA hält die Slotbreite über den
   GM5.2-Ellipsisschutz white-space:nowrap, der Golden Master schrumpft auf den Inhalt).
   Ein Bitvergleich würde dadurch aus reinen Layout-/Rasterungsgründen rot, obwohl die
   Farbe identisch ist; unter echtem Inhalt sind die Breiten beidseitig gleich.
   Geprüft wird deshalb genau die Farbaussage: JEDER Vordergrundpixel muss auf der
   Mischgeraden zwischen dem gerenderten Elementhintergrund und der Referenzfarbe liegen
   (p = bg + t·(ref−bg)), mit t in [0,1] und kleinem Restabstand zur Geraden. Kantenglättung
   erzeugt genau solche Zwischenwerte, eine andere Textfarbe nicht.
   Messwerte: korrekte Farbe maxResid ≤ 7.88 · Negativkontrolle (color:var(--text)) 72.49
   bzw. 107.47 bei tmax 0.193. Die Schranke 16.0 liegt damit über dem Doppelten des
   gemessenen Gutwerts und unter einem Viertel des Schlechtwerts. */
const BLEND_MAX_RESID=16.0;
function blendCheck(file,refStr){
  const ref=(String(refStr).match(/-?\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
  if(ref.length!==3)return {err:'Referenzfarbe nicht lesbar: '+refStr};
  const P=PNG.sync.read(fs.readFileSync(file));
  const hist=new Map();
  for(let i=0;i<P.data.length;i+=4){const k=P.data[i]+','+P.data[i+1]+','+P.data[i+2];hist.set(k,(hist.get(k)||0)+1);}
  const bg=[...hist.entries()].sort((a,c)=>c[1]-a[1])[0][0].split(',').map(Number);
  const d=[ref[0]-bg[0],ref[1]-bg[1],ref[2]-bg[2]];
  const dd=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];
  if(dd<1)return {err:'Referenzfarbe entspricht dem Hintergrund — Nachweis nicht aussagekräftig'};
  let fg=0,tmax=-1e9,tmin=1e9,maxResid=0;
  for(let i=0;i<P.data.length;i+=4){
    const p=[P.data[i],P.data[i+1],P.data[i+2]];
    const v=[p[0]-bg[0],p[1]-bg[1],p[2]-bg[2]];
    if(Math.abs(v[0])+Math.abs(v[1])+Math.abs(v[2])<=6)continue;
    fg++;
    const t=(v[0]*d[0]+v[1]*d[1]+v[2]*d[2])/dd;
    if(t>tmax)tmax=t; if(t<tmin)tmin=t;
    const r=Math.max(Math.abs(v[0]-t*d[0]),Math.abs(v[1]-t*d[1]),Math.abs(v[2]-t*d[2]));
    if(r>maxResid)maxResid=r;
  }
  const rd=x=>Math.round(x*100)/100;
  return {bg:`rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,ref:`rgb(${ref[0]}, ${ref[1]}, ${ref[2]})`,
    fg,tmin:rd(tmin),tmax:rd(tmax),maxResid:rd(maxResid),
    pass:fg>0&&maxResid<=BLEND_MAX_RESID&&tmax>=0.9&&tmax<=1.02&&tmin>=-0.02};
}
async function cloneShot(pg,root,cls,leaf,file,iconFile){
  const info=await pg.evaluate(`(${CLONE})(${JSON.stringify([root,cls,leaf,TESTSTR])})`);
  if(info.err){await pg.evaluate(()=>{const h=document.getElementById('gm54Host');h&&h.remove();});return {err:info.err};}
  await pg.waitForTimeout(90);
  const h=await pg.$('#gm54Host .gm54Target'); await h.screenshot({path:file});
  const res={info,text:glyphColor(file)};
  if(info.hasIcon&&iconFile){const ih=await pg.$('#gm54Host .gm54Icon'); await ih.screenshot({path:iconFile});
    res.icon=glyphColor(iconFile);}
  await pg.evaluate(()=>{const x=document.getElementById('gm54Host');x&&x.remove();});
  return res;
}
async function colorContract(tag){
  for(const [nm,route] of [['Bestzeiten','bestTimes'],['Meilensteine','milestones']]){
    const cls=route==='bestTimes'?'.bt-row':'.mile';
    const leaf=route==='bestTimes'?'.bt-dist b':'.mile-t';
    const kidSel=KIDCOL[cls];
    await gmPage(route);await prod.evaluate(r=>gmOpenProfPage(r),route);await prod.waitForTimeout(150);
    const G=await gm.evaluate(`(${COLC})(${JSON.stringify(['#screen',cls,kidSel])})`);
    const P=await prod.evaluate(`(${COLC})(${JSON.stringify(['#gmProfPage',cls,kidSel])})`);
    const both=!!G&&!!P&&G.n===6&&P.n===6;
    /* 0. Der Vertrag misst nachweislich ungemaskt — sonst wäre er wertlos. */
    ok(nm+' '+tag+': Farbvertrag wird ungemaskt am echten Element gemessen (keine .gm-mask aktiv)',
       both&&G.masksActive===0&&P.masksActive===0,
       both?('GM-Masken='+G.masksActive+' PROD-Masken='+P.masksActive):'Messung fehlgeschlagen');
    /* 1. Herkunft des Golden-Master-Wertes: UA-Regel für button, nicht Vererbung. */
    ok(nm+' '+tag+': GM-Herkunft nachgewiesen — keine Autorenregel/kein Inline-Wert, UA-Regel button (buttontext), keine Vererbung',
       both&&G.authorRules.length===0&&G.inline==='(keiner)'&&G.probeButton===G.rows[0].color&&G.probeDiv===G.parent&&G.probeButton!==G.probeDiv,
       both?('deklariert='+(G.authorRules.length?G.authorRules.join(' ; '):'(keine Autorenregel mit color)')+
             ' inline='+G.inline+' berechnet='+G.rows[0].color+' Elternebene='+G.parent+
             ' Sonde button='+G.probeButton+' Sonde div='+G.probeDiv):'—');
    /* 2. Farbvertrag: berechnete Textfarbe aller sechs Zeilen exakt wie in der Referenz. */
    const colOk=both&&G.rows.every((g,i)=>g.color===P.rows[i].color);
    ok(nm+' '+tag+': color aller 6 Zeilen exakt wie Golden Master',
       !!colOk, both?('GM='+G.rows[0].color+' PROD='+P.rows[0].color+
         (colOk?'':' | Abweichungen: '+G.rows.map((g,i)=>g.color!==P.rows[i].color?i+':'+g.color+'≠'+P.rows[i].color:'').filter(Boolean).join(','))):'—');
    /* 3. Übrige Computed-Style-Felder des Vertrags. */
    for(const f of ['fontFamily','fontSize','textAlign','appearance','background','border','opacity']){
      const fo=both&&G.rows.every((g,i)=>g[f]===P.rows[i][f]);
      ok(nm+' '+tag+': '+f+' aller 6 Zeilen exakt wie Golden Master',
         !!fo, both?('GM='+G.rows[0][f]+(fo?'':' ≠ PROD='+P.rows[0][f])):'—');
    }
    /* 4. Vererbte bzw. eigene Textfarben der Kindelemente. */
    const kOk=both&&G.rows.every((g,i)=>kidSel.every(k=>g.kids[k]===P.rows[i].kids[k]));
    ok(nm+' '+tag+': Textfarben der Kindelemente exakt wie Golden Master ('+kidSel.join(', ')+')',
       !!kOk, both?kidSel.map(k=>k+'='+G.rows[0].kids[k]+(G.rows[0].kids[k]===P.rows[0].kids[k]?'':' ≠ '+P.rows[0].kids[k])).join(' | '):'—');
    /* 5. Iconfarbe, sofern vererbt (currentColor). */
    const iOk=both&&G.rows.every((g,i)=>JSON.stringify(g.icon)===JSON.stringify(P.rows[i].icon));
    ok(nm+' '+tag+': Iconfarbe (SVG stroke/fill/color, currentColor-vererbt) exakt wie Golden Master',
       !!iOk, both?(G.rows[0].icon?JSON.stringify(G.rows[0].icon)+(iOk?'':' ≠ '+JSON.stringify(P.rows[0].icon)):'in dieser Zeilenart kein SVG'):'—');
    /* 6. Maskenunabhängiger, gerenderter Farbnachweis im isolierten Klon. */
    const sfx=tag==='430'?'':'_'+tag;
    const CG=await cloneShot(gm,'#screen',cls,leaf,`${OUT}/clone_gm_${route}${sfx}.png`,`${OUT}/cloneicon_gm_${route}${sfx}.png`);
    const CP=await cloneShot(prod,'#gmProfPage',cls,leaf,`${OUT}/clone_pr_${route}${sfx}.png`,`${OUT}/cloneicon_pr_${route}${sfx}.png`);
    const cok=!CG.err&&!CP.err&&CG.info.leafText===TESTSTR&&CP.info.leafText===TESTSTR
      &&CG.text.glyph===CP.text.glyph&&CG.text.glyph===G.rows[0].kids[leaf]&&CG.text.fg>0&&CP.text.fg>0;
    ok(nm+' '+tag+': maskenunabhängiger Farbnachweis — identische Testzeichenfolge im isolierten Klon rendert dieselbe Glyphenfarbe',
       !!cok, (CG.err||CP.err)?String(CG.err||CP.err):
         ('Testtext="'+TESTSTR+'" GM gerendert='+CG.text.glyph+' auf '+CG.text.elementBg+' ('+CG.text.fg+' Vordergrundpixel) · PROD gerendert='+
          CP.text.glyph+' auf '+CP.text.elementBg+' ('+CP.text.fg+' Vordergrundpixel) · berechnet='+G.rows[0].kids[leaf]));
    /* Strengster Farbnachweis am Pixel: jeder Vordergrundpixel BEIDER Seiten liegt auf der
       Mischgeraden Elementhintergrund→Referenzfarbe. Unabhängig von Maske, Kastenbreite und
       Sub-Pixel-Versatz, aber empfindlich gegen jede andere Textfarbe (Negativkontrolle). */
    const refCol=(G.rows[0]||{}).kids?G.rows[0].kids[leaf]:null;
    const BG=(!CG.err&&refCol)?blendCheck(`${OUT}/clone_gm_${route}${sfx}.png`,refCol):{err:'—'};
    const BP=(!CP.err&&refCol)?blendCheck(`${OUT}/clone_pr_${route}${sfx}.png`,refCol):{err:'—'};
    const pok=!BG.err&&!BP.err&&BG.pass&&BP.pass;
    ok(nm+' '+tag+': gerenderte Pixel liegen beidseitig auf der Mischgeraden zur Golden-Master-Farbe (Pixelnachweis ohne jede Maske)',
       !!pok,(BG.err||BP.err)?String(BG.err||BP.err):
         ('Referenz='+BG.ref+' · GM auf '+BG.bg+': '+BG.fg+' px, t=['+BG.tmin+','+BG.tmax+'], Restabstand '+BG.maxResid+
          ' · PROD auf '+BP.bg+': '+BP.fg+' px, t=['+BP.tmin+','+BP.tmax+'], Restabstand '+BP.maxResid+
          ' · Schranke '+BLEND_MAX_RESID+' (Negativkontrolle 72.49/107.47)'+
          ' · Klonkästen GM '+CG.text.w+'×'+CG.text.h+' / PROD '+CP.text.w+'×'+CP.text.h+
          ' (Breitenunterschied nur bei geleertem Klontext, unter echtem Inhalt identisch)'));
    if(CG.icon||CP.icon){
      /* Die Strichfarbe wird geprüft, NICHT die Strichform: welches Statussymbol eine Zeile
         zeigt, ist echter Inhalt und darf sich unterscheiden. Bezugswert ist der berechnete
         currentColor-Wert des Golden Master. */
      const iok=!!CG.icon&&!!CP.icon&&CG.icon.glyph===CP.icon.glyph&&CG.icon.fg>0&&CP.icon.fg>0
        &&CG.icon.glyph===(G.rows[0].icon||{}).stroke;
      ok(nm+' '+tag+': maskenunabhängiger Iconnachweis — geerbte currentColor rendert in derselben Farbe',
         iok, 'GM='+(CG.icon||{}).glyph+' auf '+(CG.icon||{}).elementBg+' ('+(CG.icon||{}).fg+' px)'+
              ' · PROD='+(CP.icon||{}).glyph+' auf '+(CP.icon||{}).elementBg+' ('+(CP.icon||{}).fg+' px)'+
              ' · berechneter stroke='+((G.rows[0].icon||{}).stroke));
    }
    fs.writeFileSync(`${OUT}/color_${route}${sfx}.json`,JSON.stringify({viewport:tag,testString:TESTSTR,gm:G,prod:P,
      renderedGM:{text:CG.text,icon:CG.icon||null},renderedPROD:{text:CP.text,icon:CP.icon||null},
      mischgerade:{schranke:BLEND_MAX_RESID,gm:BG,prod:BP}},null,1));
    await gm.evaluate(()=>closePage());await prod.evaluate(()=>gmCloseProfPage());
  }
}
await colorContract('430');

/* ---------- GM5.3: Semantik-, Tastatur- und Sheet-Vertrag der zwölf Zeilen ----------
   "Struktur-Diff 0" bedeutet ab GM5.3 ausdrücklich nicht mehr nur gleiche sichtbare Geometrie:
   Elementtyp, type-Attribut, Klassen, Anzahl und Reihenfolge müssen dem unveränderten Golden
   Master entsprechen, und es darf keine div.bt-row/div.mile mehr geben. Zusätzlich wird der
   Bedienvertrag geprüft (Tap/Klick, Enter, Space, Fokus ins Sheet, Escape, Rückfokus,
   ungekürzte Texte, Missing-State, Re-Render-Stabilität, keine Navigation/Mutation).
   Die Prüfung mutiert nichts: Zustands-Snapshot vor und nach jeder Interaktionsserie. */
const SEMC=`(cls)=>{
  const els=[...document.querySelectorAll(cls)];
  return {n:els.length,tags:els.map(e=>e.tagName),
    types:els.map(e=>e.getAttribute('type')),
    cls:els.map(e=>e.className),
    order:els.map(e=>[...e.parentNode.children].indexOf(e))};
}`;
const SHEETC=`(a)=>{
  const [sel,idx,route]=a;
  const row=document.querySelectorAll('#gmProfPage '+sel)[idx];
  const sh=document.getElementById('detailSheet');
  const open=[...document.querySelectorAll('.sheet.on')];
  const shTxt=sh?sh.textContent:'';
  const q=s=>{const n=row.querySelector(s);return n?n.textContent.trim():'';};
  const need=route==='bestTimes'
    ? [(q('.bt-dist b')+' '+q('.bt-dist span')).trim(),q('.bt-time'),q('.bt-sub')]
    : [q('.mile-t'),q('.mile-d')];
  const longTxt=route==='bestTimes'?q('.bt-sub'):q('.mile-d');
  let clipped=0;
  if(sh)[...sh.querySelectorAll('*')].forEach(n=>{if(!n.children.length&&n.scrollWidth-n.clientWidth>1)clipped++;});
  return {nOpen:open.length,id:open[0]?open[0].id:null,
    focusSheet:document.activeElement===sh,
    scrim:!!document.getElementById('scrim').classList.contains('on'),
    missing:need.filter(t=>t&&t!=='—'&&shTxt.indexOf(t)<0),
    longOk:!!longTxt&&shTxt.indexOf(longTxt)>=0,longTxt,clipped,
    naFocusable:!row.disabled&&row.tabIndex>=0};
}`;
const SNAPC=`()=>({prof:JSON.stringify(typeof PROFILE!=='undefined'?PROFILE:null),href:location.href,
  ls:JSON.stringify(Object.keys(localStorage).sort().map(k=>k+'='+localStorage.getItem(k)))})`;
async function semInteractContract(tag){
  for(const [nm,route] of [['Bestzeiten','bestTimes'],['Meilensteine','milestones']]){
    const sel=route==='bestTimes'?'.bt-row':'.mile';
    /* 1. Tag-/Semantik-Parität gegen den unveränderten Golden Master */
    await gmPage(route);await prod.evaluate(r=>gmOpenProfPage(r),route);await prod.waitForTimeout(140);
    const G=await gm.evaluate(`(${SEMC})(${JSON.stringify('#screen '+sel)})`);
    const P=await prod.evaluate(`(${SEMC})(${JSON.stringify('#gmProfPage '+sel)})`);
    const divs=await prod.evaluate(s=>document.querySelectorAll('#gmProfPage div'+s).length,sel);
    const semOk=G.n===6&&P.n===6&&divs===0&&
      G.tags.join()===P.tags.join()&&P.tags.every(t=>t==='BUTTON')&&
      P.types.every(t=>t==='button')&&
      G.cls.join()===P.cls.join()&&
      P.order.join()==='0,1,2,3,4,5';
    ok(nm+' '+tag+': Semantikvertrag — Elementtyp BUTTON, type="button", identische Klassen, Anzahl und Reihenfolge, keine div'+sel,
       semOk,`GM tags=[${G.tags}] PROD tags=[${P.tags}] type=[${P.types}] cls GM=[${G.cls}] PROD=[${P.cls}] div${sel}=${divs} order=[${P.order}]`);

    /* 2.–6. Bedienvertrag über beide Zustände und alle sechs Zeilen */
    const acc={one:[],focus:[],esc:[],back:[],long:[],clip:[],same:[],na:[]};
    const keys=[];let navOk=true,mutOk=true,reOk=true,reInfo='';
    for(const state of ['good','missing']){
      await prod.evaluate(s=>setProfState(s,'fortgeschritten'),state);await prod.waitForTimeout(200);
      await prod.evaluate(r=>gmOpenProfPage(r),route);await prod.waitForTimeout(170);
      const s0=await prod.evaluate(`(${SNAPC})()`);
      for(let i=0;i<6;i++){
        await prod.click(`#gmProfPage ${sel} >> nth=${i}`);await prod.waitForTimeout(130);
        const r=await prod.evaluate(`(${SHEETC})(${JSON.stringify([sel,i,route])})`);
        acc.one.push(r.nOpen===1&&r.id==='detailSheet');
        acc.focus.push(r.focusSheet);
        acc.long.push(r.longOk);
        acc.clip.push(r.clipped===0);
        acc.same.push(r.missing.length===0?true:r.missing);
        acc.na.push(r.naFocusable);
        await prod.keyboard.press('Escape');await prod.waitForTimeout(130);
        const c=await prod.evaluate((a)=>{const [s,idx]=a;
          const row=document.querySelectorAll('#gmProfPage '+s)[idx];
          return {n:document.querySelectorAll('.sheet.on').length,
            scrim:!!document.getElementById('scrim').classList.contains('on'),
            back:document.activeElement===row};},[sel,i]);
        acc.esc.push(c.n===0&&!c.scrim);acc.back.push(c.back);
      }
      for(const key of ['Enter','Space']){
        await prod.evaluate(s=>document.querySelector('#gmProfPage '+s).focus(),sel);
        await prod.keyboard.press(key);await prod.waitForTimeout(160);
        const k=await prod.evaluate(()=>({n:document.querySelectorAll('.sheet.on').length,
          f:document.activeElement===document.getElementById('detailSheet')}));
        keys.push({state,key,ok:k.n===1&&k.f,n:k.n});
        await prod.keyboard.press('Escape');await prod.waitForTimeout(120);
      }
      const re=await prod.evaluate(r=>{const before=document.querySelectorAll('.sheet').length;
        for(let k=0;k<6;k++)gmOpenProfPage(r);
        return {before,after:document.querySelectorAll('.sheet').length,
          rows:document.querySelectorAll('#gmProfPage .bt-row,#gmProfPage .mile').length};},route);
      await prod.click(`#gmProfPage ${sel} >> nth=0`);await prod.waitForTimeout(130);
      const re2=await prod.evaluate(()=>document.querySelectorAll('.sheet.on').length);
      await prod.keyboard.press('Escape');await prod.waitForTimeout(120);
      reOk=reOk&&re.before===re.after&&re.rows===6&&re2===1;
      reInfo+=`${state}: Sheets ${re.before}→${re.after}, Zeilen ${re.rows}, Klick danach ${re2} Sheet(s); `;
      const s1=await prod.evaluate(`(${SNAPC})()`);
      navOk=navOk&&s1.href===s0.href;
      mutOk=mutOk&&s1.prof===s0.prof&&s1.ls===s0.ls;
      await prod.evaluate(()=>gmCloseProfPage());await prod.waitForTimeout(110);
    }
    const all=a=>a.every(v=>v===true);
    ok(nm+' '+tag+': Tap/Klick öffnet genau ein bestehendes GM-Sheet (12 Zeilen, 2 Zustände)',
       all(acc.one),`${acc.one.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': Fokus wechselt in das Sheet',all(acc.focus),`${acc.focus.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': Escape schließt Sheet und Scrim',all(acc.esc),`${acc.esc.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': Fokus kehrt zur auslösenden Zeile zurück',all(acc.back),`${acc.back.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': Sheet-Inhaltsgleichheit — jeder Zeilenwert erscheint unverändert im Sheet',
       all(acc.same),JSON.stringify(acc.same.filter(v=>v!==true)).slice(0,300));
    ok(nm+' '+tag+': vollständige '+(route==='bestTimes'?'.bt-sub':'.mile-d')+'-Texte im Sheet ungekürzt lesbar',
       all(acc.long)&&all(acc.clip),`Text vollständig ${acc.long.filter(v=>v===true).length}/12 · unbeschnitten ${acc.clip.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': Tastaturbedienung — Enter und Space öffnen das Sheet mit Fokuswechsel',
       keys.every(k=>k.ok),keys.map(k=>`${k.state}/${k.key}=${k.ok?'ok':'nOpen '+k.n}`).join(' · '));
    ok(nm+' '+tag+': Missing-State-Zeilen sind fokussierbar und öffnen ein verständliches Sheet',
       all(acc.na)&&all(acc.one),`fokussierbar ${acc.na.filter(v=>v===true).length}/12`);
    ok(nm+' '+tag+': 6 Re-Renders ohne Sheet-, Zeilen- oder Listener-Duplikate',reOk,reInfo);
    ok(nm+' '+tag+': keine Navigation und keine Datenmutation durch die Bedienung',navOk&&mutOk,
       `Navigation ${navOk?'unverändert':'GEÄNDERT'} · PROFILE/localStorage ${mutOk?'unverändert':'GEÄNDERT'}`);
    await gm.evaluate(()=>closePage());
    await prod.evaluate(()=>setProfState('good','fortgeschritten'));await prod.waitForTimeout(160);
  }
}
await semInteractContract('430');

/* ---------- GM5.2: Geometrievertrag der zweiten vollflächig maskierten Wertfläche ----------
   Neben .mile-track wird auf der Profilhauptseite .goal-line vollflächig maskiert (Zielfortschritt:
   echter Wertunterschied zwischen GM-Demofortschritt und ehrlich leerer ORVIA-Spur). Auch hier gilt:
   die Maske darf keine Geometrie verdecken. Nachweis numerisch gegen die unveränderte Referenz. */
const TRKC=`(sel)=>{
  const ns=[...document.querySelectorAll(sel)];if(!ns.length)return null;
  return ns.map(n=>{const p=n.parentElement.getBoundingClientRect();const r=n.getBoundingClientRect();const c=getComputedStyle(n);
    return {x:Math.round((r.x-p.x)*100)/100,y:Math.round((r.y-p.y)*100)/100,
      w:Math.round(r.width*100)/100,h:Math.round(r.height*100)/100,
      radius:c.borderRadius,overflow:c.overflow,bg:c.backgroundColor,pw:Math.round(p.width*100)/100};});
}`;
async function goalLineContract(tag){
  await gmProf('f');await prod.evaluate(()=>{gmProfSetMode('fortgeschritten');});await prod.waitForTimeout(140);
  const G=await gm.evaluate(`(${TRKC})(${JSON.stringify('#screen .goal-line')})`);
  const P=await prod.evaluate(`(${TRKC})(${JSON.stringify('#gmProf .goal-line')})`);
  const same=!!G&&!!P&&G.length===P.length&&JSON.stringify(G)===JSON.stringify(P);
  ok('Zielreise '+tag+': .goal-line geometrisch identisch (maskierte Wertfläche verdeckt keine Geometrie)',
     same, 'GM='+JSON.stringify(G)+' PROD='+JSON.stringify(P));
  fs.writeFileSync(`${OUT}/goalline_${tag}.json`,JSON.stringify({viewport:tag,gm:G,prod:P},null,1));
}
await goalLineContract('430');

/* ---------- GM5.1: Zustandsmatrix Bestzeiten / Meilensteine ---------- */
for(const [lbl,st,route,cls,minN] of [
  ['Bestzeiten vollständig','good','bestTimes','.bt-row',6],
  ['Bestzeiten fehlend','nobt','bestTimes','.bt-row',6],
  ['Meilensteine vollständig','mile6','milestones','.mile',6],
  ['Meilensteine fehlend','nomile','milestones','.mile',6]]){
  const r=await prod.evaluate(a=>{setProfState(a.st,'fortgeschritten');gmOpenProfPage(a.route);
    const H=document.getElementById('gmProfPage');const html=H.innerHTML;
    const over=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const res={n:H.querySelectorAll(a.cls).length,
      zeros:/>0<\/b>|>0 %<|>0%<|>0 km</.test(html),
      na:(html.match(/Noch nicht verfügbar/g)||[]).length,
      demo:/tier-|3:52\/km|Aktuell 56:20|Prognose/.test(html),over};
    gmCloseProfPage();return res;},{st,route,cls});
  ok('Zustand '+lbl+': '+minN+' Slots, keine 0-statt-Missing, keine Demo-Werte, kein Überlauf',
     r.n===minN&&!r.zeros&&!r.demo&&r.over<=0,
     'n='+r.n+' NA='+r.na+(r.zeros?' ZEROS!':'')+(r.demo?' DEMO!':''));
}
await prod.evaluate(()=>setProfState('good','fortgeschritten'));
/* GM5.2: Pixel-Diff aller vier Zustände (vollständig/fehlend) gegen den unveränderten GM */
for(const [lbl,st,name,route] of [
  ['Meilensteine (vollständiges Zielportfolio)','mile6','page_milestones_full','milestones'],
  ['Meilensteine (fehlend)','nomile','page_milestones_none','milestones'],
  ['Bestzeiten (fehlend)','nobt','page_bestTimes_none','bestTimes']]){
  await prod.evaluate(s=>setProfState(s,'fortgeschritten'),st);
  const d=await shotPage(name,route,route);
  ok(lbl+': Pixel-Diff ≤ 2 %', d.pct<=2, d.pct+'%');
}
await prod.evaluate(()=>setProfState('good','fortgeschritten'));

ok('Meilensteine: 6 Slots (2 vorhanden read-only)', await prod.evaluate(()=>{
  gmOpenProfPage('milestones');const P=document.getElementById('gmProfPage').innerHTML;gmCloseProfPage();
  return (P.match(/class="mile"/g)||[]).length===6&&/Longrun 18 km/.test(P);}));
/* ---------- Interaktionen ---------- */
ok('Back erhält Seite, Modus und Scroll; Fokus kehrt zurück', await prod.evaluate(()=>{
  setProfState('good','profi');
  const tm=document.getElementById('tab-mehr');
  const scroller=(tm&&tm.scrollHeight>tm.clientHeight)?tm:null;
  if(scroller)scroller.scrollTop=240;else scrollTo(0,240);
  gmOpenProfPage('settings');gmCloseProfPage();
  const m=uiDetailMode()==='profi';
  const got=scroller?scroller.scrollTop:scrollY;
  const sc=Math.abs(got-240)<6;
  const focusOk=document.activeElement&&document.activeElement.className.indexOf('mini-btn')>=0;
  setProfState('good','fortgeschritten');if(scroller)scroller.scrollTop=0;else scrollTo(0,0);
  return m&&sc&&focusOk;}));
ok('A/F/P über Ansicht-Seite: persistent, Seite bleibt offen, Fachwerte invariant', await prod.evaluate(()=>{
  gmOpenProfPage('appearance');
  gmProfSetMode('anfaenger');
  const stillOpen=document.getElementById('gmProfPage').classList.contains('on')&&/Informationsdichte/.test(document.getElementById('gmProfPage').innerHTML);
  const persisted=localStorage.getItem('orvia_ui_mode')==='anfaenger';
  gmProfSetMode('fortgeschritten');gmCloseProfPage();
  /* Fachwert-Invarianz: Bestzeiten-Modellwerte identisch in a/f/p */
  const grab=m=>{setUiDetailMode(m);gmOpenProfPage('bestTimes');const t=[...document.querySelectorAll('#gmProfPage .bt-time')].map(e=>e.textContent).join('|');gmCloseProfPage();return t;};
  const A=grab('anfaenger'),P2=grab('profi');setUiDetailMode('fortgeschritten');
  return stillOpen&&persisted&&A===P2;}));
ok('deaktivierte Controls mutieren nichts (Tagesziele/Toggles/Choices)', await prod.evaluate(()=>{
  gmOpenProfPage('dailyGoals');
  const before=document.getElementById('gmProfPage').innerHTML;
  document.querySelectorAll('#gmProfPage .stepper button').forEach(b=>b.click());
  const same=document.getElementById('gmProfPage').innerHTML===before;
  gmCloseProfPage();return same;}));
ok('aktive Controls verwenden bestehende Handler (Editor/GoalFlow/Export/Passwort)', await prod.evaluate(()=>{
  window.__pcOpen=0;window.__goalEd=0;window.__exp=0;window.__pw=0;
  gmProfEdit();gmProfAddGoal();
  gmOpenProfPage('data');exportData();gmCloseProfPage();
  gmOpenProfPage('account');orviaChangePassword();gmCloseProfPage();
  return window.__pcOpen===1&&window.__goalEd===1&&window.__exp===1&&window.__pw===1;}));
ok('Abmelden nutzt ausschließlich Auth (orviaLogout)', await prod.evaluate(()=>{
  window.__logout=0;gmOpenProfPage('settings');
  const dl=[...document.querySelectorAll('#gmProfPage .danger-link')][0];dl.click();
  gmCloseProfPage();return window.__logout===1;}));
ok('Datenlöschung nur über bestehenden Bestätigungsflow (orviaDeleteAccount)', await prod.evaluate(()=>{
  window.__delAcc=0;gmOpenProfPage('data');
  const rows=[...document.querySelectorAll('#gmProfPage .setting-item')];
  const del=rows.find(r=>/löschen/i.test(r.textContent));del.click();
  gmCloseProfPage();return window.__delAcc===1;}));
ok('5 Re-Renders: keine DOM-/Listener-Akkumulation, keine doppelten IDs', await prod.evaluate(()=>{
  renderGMProfile();const l0=document.getElementById('gmProf').innerHTML.length;
  for(let i=0;i<5;i++)renderGMProfile();
  const ids=[...document.getElementById('gmProf').innerHTML.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  return document.getElementById('gmProf').innerHTML.length===l0&&new Set(ids).size===ids.length;}));

/* ---------- 390px-Durchlauf ---------- */
await gm.setViewportSize({width:390,height:844});await prod.setViewportSize({width:390,height:844});
await gm.addStyleTag({content:'.phone{width:390px!important}'});
for(const [lv,gl,pm] of [['a','a','anfaenger'],['f','f','fortgeschritten'],['p','p','profi']]){
  await gmProf(gl);
  await prod.evaluate(m=>setProfState('good',m),pm);
  await prod.waitForTimeout(120);
  const d=await shotProfile('prof_'+lv+'390');
  ok('prof_'+lv+'390: ≤ 2 %', d.pct<=2, d.pct+'%');
  const ov=await prod.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  ok('prof_'+lv+'390: kein Überlauf', ov<=0);
}
await gmProf('f');
/* GM5.1: Werkzeugfehler behoben — die Detailstufen-Schleife oben endete mit prod='profi',
   während der GM auf 'f' zurückgesetzt wurde. Der 390er-Subpage-Durchlauf verglich damit
   zwei verschiedene Detailstufen (Inhaltsunterschied, kein Geometriefehler). Beide Seiten
   werden jetzt — wie im 430er-Durchlauf — auf 'fortgeschritten' angeglichen. */
await prod.evaluate(()=>setProfState('good','fortgeschritten'));
await prod.waitForTimeout(150);
for(const [name,gr,pr] of PAGES){
  const d=await shotPage('page_'+name+'390',gr,pr);
  ok('390px Subpage '+name+': ≤ 2 %', d.pct<=2, d.pct+'%');
}
/* GM5.2: Slotvertrag auch bei 390 px — die sechs Referenzbreiten werden hier erneut direkt
   am unveränderten Golden Master geprüft, nicht aus dem 430er-Durchlauf vorausgesetzt. */
await rowContract('390');
await goalLineContract('390');
/* GM5.4: Farb- und Computed-Style-Vertrag ebenfalls bei 390 px. */
await colorContract('390');
/* GM5.3: Semantik-, Tastatur-, Sheet- und Fokusvertrag ebenfalls bei 390 px. */
await semInteractContract('390');
await prod.evaluate(()=>setProfState('good','fortgeschritten'));
await gm.addStyleTag({content:'.phone{width:430px!important}'});
await gm.setViewportSize({width:430,height:900});await prod.setViewportSize({width:430,height:900});

ok('keine Seitenfehler', perrs.length===0, perrs.slice(0,3).join('|'));
fs.writeFileSync(`${OUT}/results.json`,JSON.stringify(results,null,1));
await b.close();
console.log('\nDiff je Zustand:',JSON.stringify(results));
console.log((fail?fail+' FAILED':'gm5_parity: ALL PASSED')+' ('+pass+' ok)');
