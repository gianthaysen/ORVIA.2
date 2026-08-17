/* ============================================================
   ORVIA · orvia-charts — interaktives Chart-Modul (Phase C).
   1:1-Port des v5-Prototyp-richChart: Catmull-Rom-Bézier-Splines,
   Scrubbing (Touch/Maus/Tastatur), Baseline-Ø, Min/Max-Marker,
   Einlauf-Animation mit prefers-reduced-motion-Guard.
   REINE Darstellung: keine Datenberechnung, keine Engine-Logik.
   Nutzung: ORVIA.charts.richChart(mountEl, {label, series, times,
   unit, color, baseline, higherBetter, dec, min, max, h, shadeTo}).
   ============================================================ */
(function(root){
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  /* Farb-Token → CSS-Variablen der App; fremde Werte (Hex/var) unverändert. */
  var TOKEN={ready:'var(--ready)',activity:'var(--activity)',attention:'var(--attention)',
    crit:'var(--crit)',sleep:'var(--sleep)',gold:'var(--accent)',accent:'var(--accent)'};
  function colorOf(c){return TOKEN[c]||c||'var(--accent)';}

  /* Deutsche Zahl mit fester Dezimalstellenzahl (Chart-Achsen/Readout). */
  function fmtNum(v,dec){dec=dec||0;return (dec?(+v).toFixed(dec):String(Math.round(+v))).replace('.',',');}

  var RM=false;try{RM=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}

function smoothLine(pts){if(pts.length<2)return pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');let d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;d+=`C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;}return d;}

function splineAt(pts,f){const n=pts.length;if(f<=0)return pts[0];if(f>=n-1)return pts[n-1];const i=Math.floor(f),t=f-i;const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6,u=1-t;return[u*u*u*p1[0]+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*p2[0],u*u*u*p1[1]+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*p2[1]];}

function clientIdx(svg,n,cx){const r=svg.getBoundingClientRect();return Math.max(0,Math.min(n-1,Math.round((cx-r.left)/r.width*(n-1))));}

function sparkline(vals,color){const w=100,h=30,mx=Math.max(...vals),mn=Math.min(...vals),rng=(mx-mn)||1;const pts=vals.map((v,i)=>[i/(vals.length-1)*w,h-4-((v-mn)/rng)*(h-8)]);const d=smoothLine(pts);const id='sg'+color.replace(/\W/g,'');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;}

function richChart(mount,cfg){
  const s=cfg.series,n=s.length,W=320,H=cfg.h||150,pT=16,pB=24,pL=3;
  /* GM7.7 (additiv): optionaler Anzeige-Formatter cfg.fmtValue(v) — noetig fuer Groessen,
     die konventionell NICHT dezimal gelesen werden (Tempo min/km als mm:ss). Reine
     Darstellung derselben Werte; ohne Hook unveraendertes Verhalten. */
  const dec=cfg.dec||0;
  const fmtNumDefault=v=>(dec?(+v).toFixed(dec):Math.round(v)).toString().replace('.',',');
  const fmt=(typeof cfg.fmtValue==='function')?(v=>{try{const r=cfg.fmtValue(+v);return (r==null?fmtNumDefault(v):String(r));}catch(e){return fmtNumDefault(v);}}):fmtNumDefault;
  /* GM7.6c-Fix: rechte Achsenbreite dynamisch aus der laengsten Y-Beschriftung —
     die feste GM-Konstante 34px schnitt 5-stellige Werte (z.B. Schritte 12400) ab. */
  let pR=34;
  try{const _mx0=cfg.max!=null?cfg.max:Math.max(...s),_mn0=cfg.min!=null?cfg.min:Math.min(...s);
    pR=Math.max(34,Math.max(fmt(_mx0).length,fmt(_mn0).length)*6+8);}catch(e){}
  /* Overlay-Vertrag (rueckwaertskompatibel): nicht-interaktive Zusatzreihen gleicher Laenge.
     Sie fliessen in die Skala ein und werden als eigene Pfade hinter der Hauptlinie gezeichnet. */
  const ovs=(cfg.overlays||[]).filter(o=>o&&Array.isArray(o.series)&&o.series.length===n);
  let vals=cfg.baseline!=null?s.concat([cfg.baseline]):s.slice();
  ovs.forEach(o=>{vals=vals.concat(o.series);});
  const dataMn=cfg.min!=null?cfg.min:Math.min(...vals),dataMx=cfg.max!=null?cfg.max:Math.max(...vals);
  const span=(dataMx-dataMn)||1,pad=(cfg.min==null&&cfg.max==null)?span*0.14:0;
  const mn=dataMn-pad,mx=dataMx+pad,rng=(mx-mn)||1;
  const X=i=>pL+i/(n-1)*(W-pL-pR), Y=v=>pT+(1-(v-mn)/rng)*(H-pT-pB);
  const pts=s.map((v,i)=>[X(i),Y(v)]);
  const dLine=smoothLine(pts);
  const col=colorOf(cfg.color),id='rc'+Math.floor(X(0))+n+col.replace(/\W/g,'')+Math.floor(H);
  const gridY=[dataMn,(dataMn+dataMx)/2,dataMx];let grid='';gridY.forEach(g=>{const y=Y(g);grid+=`<line class="g-grid" x1="${pL}" x2="${W-pR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="g-lbl" x="${W-pR+5}" y="${(y+3).toFixed(1)}">${fmt(g)}</text>`;});
  let xl='';[0,Math.floor((n-1)/2),n-1].forEach(i=>{xl+=`<text class="g-lbl" text-anchor="${i===0?'start':i===n-1?'end':'middle'}" x="${X(i).toFixed(1)}" y="${H-7}">${cfg.times[i]}</text>`;});
  let shade='';if(cfg.shadeTo!=null)shade=`<rect class="g-shade" x="${X(0).toFixed(1)}" y="${pT}" width="${(X(cfg.shadeTo)-X(0)).toFixed(1)}" height="${(H-pT-pB).toFixed(1)}"/>`;
  const iMax=s.indexOf(Math.max(...s)),iMin=s.indexOf(Math.min(...s));
  let mm='';[[iMax,cfg.higherBetter?'var(--ready)':'var(--crit)'],[iMin,cfg.higherBetter?'var(--crit)':'var(--ready)']].forEach(([i,c])=>{mm+=`<circle class="g-mm" cx="${X(i).toFixed(1)}" cy="${Y(s[i]).toFixed(1)}" r="3.4" stroke="${c}"/>`;});
  let baseEls='';if(cfg.baseline!=null){const by=Y(cfg.baseline);baseEls=`<line class="g-base" x1="${pL}" x2="${W-pR}" y1="${by.toFixed(1)}" y2="${by.toFixed(1)}"/><rect class="avgpill" x="${pL}" y="${(by-8).toFixed(1)}" width="17" height="15" rx="5"/><text class="avgtxt" x="${(pL+8.5).toFixed(1)}" y="${(by+3).toFixed(1)}" text-anchor="middle">Ø</text>`;}
  const areaD=dLine+` L${X(n-1).toFixed(1)} ${(H-pB).toFixed(1)} L${pL} ${(H-pB).toFixed(1)} Z`;
  mount.innerHTML=`<svg viewBox="0 0 ${W} ${H}" tabindex="0" role="img" aria-label="${cfg.label} Verlauf">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".24"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${shade}${baseEls}
    ${ovs.map(o=>'<path class="g-ov" d="'+smoothLine(o.series.map((v,i)=>[X(i),Y(v)]))+'" stroke="'+colorOf(o.color)+'"'+(o.dash?' stroke-dasharray="'+o.dash+'"':'')+'/>').join('')}
    <path class="g-area" style="opacity:0" d="${areaD}" fill="url(#${id})"/>
    <path class="g-glow" d="${dLine}" stroke="${col}"/>
    <path class="g-line" d="${dLine}" stroke="${col}"/>
    <path class="g-hi" d="" stroke="${col}"/>${mm}
    <g class="g-cursor" style="opacity:0"><line class="g-guide" y1="${pT}" y2="${(H-pB).toFixed(1)}"/><circle class="g-halo" r="8.5" fill="${col}"/><circle class="g-pt" r="4.6" fill="${col}"/></g>
    ${xl}</svg>
    <div class="oc-read2"><div class="rv"><span class="v">${fmt(s[n-1])}</span><small> ${cfg.unit}</small></div><div class="rm"><span class="t">${cfg.times[n-1]}</span> · Ø <b>${fmt(s.reduce((x,y)=>x+y,0)/n)}</b> · <span class="dev">–</span></div></div>`;
  const svg=mount.querySelector('svg'),line=mount.querySelector('.g-line'),glow=mount.querySelector('.g-glow'),area=mount.querySelector('.g-area'),hi=mount.querySelector('.g-hi'),cur=mount.querySelector('.g-cursor'),gd=mount.querySelector('.g-guide'),pt=mount.querySelector('.g-pt'),halo=mount.querySelector('.g-halo');
  const vEl=mount.querySelector('.v'),tEl=mount.querySelector('.t'),dEl=mount.querySelector('.dev');const a=s.reduce((x,y)=>x+y,0)/n;let idx=n-1;
  if(!RM){const L=line.getTotalLength();[line,glow].forEach(el=>{el.style.strokeDasharray=L;el.style.strokeDashoffset=L;});requestAnimationFrame(()=>{line.style.strokeDashoffset='0';glow.style.strokeDashoffset='0';area.style.opacity='1';});}else area.style.opacity='1';
  let curF=null,raf=null,moveRaf=0;
  function hiPath(f){const lo=Math.max(0,f-1.1),hi2=Math.min(n-1,f+1.1);let d='';for(let k=0;k<=10;k++){const p=splineAt(pts,lo+(hi2-lo)*k/10);d+=(k?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}return d;}
  function place(f){const p=splineAt(pts,f);gd.setAttribute('x1',p[0].toFixed(1));gd.setAttribute('x2',p[0].toFixed(1));pt.setAttribute('cx',p[0].toFixed(1));pt.setAttribute('cy',p[1].toFixed(1));halo.setAttribute('cx',p[0].toFixed(1));halo.setAttribute('cy',p[1].toFixed(1));hi.setAttribute('d',hiPath(f));}
  function readout(i){vEl.textContent=fmt(s[i]);tEl.textContent=cfg.times[i];const dv=s[i]-a;dEl.textContent=(dv>=0?'+':'')+fmt(dv)+' vs Ø';dEl.style.color=(cfg.higherBetter?(dv>=0?'var(--ready)':'var(--crit)'):(dv<=0?'var(--ready)':'var(--crit)'));}
  function set(i){idx=Math.max(0,Math.min(n-1,i));cur.style.opacity=1;hi.style.opacity='.95';halo.style.opacity='.3';readout(idx);
    if(RM||curF===null){curF=idx;place(idx);return;}
    const sf=curF,t0=performance.now();cancelAnimationFrame(raf);
    (function step(t){const p=Math.min((t-t0)/150,1),e=1-Math.pow(1-p,3),f=sf+(idx-sf)*e;place(f);curF=f;if(p<1)raf=requestAnimationFrame(step);})(performance.now());}
  svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);set(clientIdx(svg,n,e.clientX));});
  svg.addEventListener('pointermove',e=>{if(!(e.pointerType==='mouse'||e.buttons))return;const cx=e.clientX;if(moveRaf)return;moveRaf=requestAnimationFrame(()=>{moveRaf=0;set(clientIdx(svg,n,cx));});});
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){set(idx-1);e.preventDefault();}if(e.key==='ArrowRight'){set(idx+1);e.preventDefault();}});
}

  var api={smoothLine:smoothLine,splineAt:splineAt,clientIdx:clientIdx,
    sparkline:sparkline,richChart:richChart,fmtNum:fmtNum,colorOf:colorOf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  O.charts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
