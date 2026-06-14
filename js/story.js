/* ============================================================
   ORVIA — Story-Recap (Vollbild) + echter Strava-Import
   Liest Aktivität aus DB[date].sessions[typ] (route/splits/paceCurve/cadCurve/best).
   ============================================================ */

function _fmtSec(sec){ if(sec==null)return '–'; sec=Math.round(sec); var m=Math.floor(sec/60),s=sec%60; return m+':'+String(s).padStart(2,'0'); }

/* ---- Echter Strava-Lauf importieren (handewitter Sommerlauf) ---- */
function importRealRun(){
  if(window._importing)return;
  var R=window.ORVIA_REAL_RUN; if(!R){ if(typeof toast==='function')toast('Strava-Daten nicht geladen'); return; }
  var k=R.date, e=entry(k); e.sessions=e.sessions||{};
  if(e.sessions.Laufen && !e.sessions.Laufen.demo && !e.sessions.Laufen._real){
    if(!window.confirm('Am '+k+' ist bereits ein Lauf erfasst. Mit dem echten Strava-Lauf überschreiben?'))return;
  }
  window._importing=true;
  importAnimation(['Mit Strava verbunden','Aktivität geladen','GPS-Strecke (240 Punkte)','Splits & Pace berechnet','Bestzeiten erkannt','Tagesentscheidung aktualisiert'],function(){
    window._importing=false;
    e.sessions.Laufen={
      sub:R.sub, dist:R.dist, dur:Math.round(R.durSec/60*100)/100, cad:R.cad, elev:R.elev,
      hr:null, rpe:8, perf:9, note:R.name, source:'strava', _real:true,
      route:R.route, splits:R.splits, paceCurve:R.paceCurve, cadCurve:R.cadCurve,
      best:R.best, place:R.place, name:R.name
    };
    e.sessions._ts=Date.now();
    if(typeof save==='function')save();
    if(typeof renderDay==='function')renderDay();
    if(typeof renderAkt==='function')renderAkt();
    openStory(k,'Laufen');
    if(typeof toast==='function')toast('Echter Strava-Lauf importiert ✓');
  });
}

/* ---- Große animierte Streckenkarte ---- */
function storyRoute(pts){
  if(!pts||pts.length<2)return '';
  var lats=pts.map(function(p){return p[0];});
  var minLat=Math.min.apply(null,lats),maxLat=Math.max.apply(null,lats);
  var midLat=(minLat+maxLat)/2,cos=Math.cos(midLat*Math.PI/180);
  var xs=pts.map(function(p){return p[1]*cos;}),ys=pts.map(function(p){return -p[0];});
  var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);
  var W=340,H=300,pad=34;
  var spanX=(maxX-minX)||1e-6,spanY=(maxY-minY)||1e-6;
  var scale=Math.min((W-2*pad)/spanX,(H-2*pad)/spanY);
  var offX=(W-spanX*scale)/2,offY=(H-spanY*scale)/2;
  var px=function(i){return (offX+(xs[i]-minX)*scale).toFixed(1);};
  var py=function(i){return (offY+(ys[i]-minY)*scale).toFixed(1);};
  var d=pts.map(function(p,i){return (i?'L':'M')+px(i)+' '+py(i);}).join(' ');
  var last=pts.length-1;
  return '<svg class="st-map" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+
    '<path d="'+d+'" fill="none" stroke="rgba(201,174,124,.16)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'+
    '<path class="st-route" d="'+d+'" fill="none" stroke="url(#orviaMarkGrad)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="1000"/>'+
    '<circle cx="'+px(0)+'" cy="'+py(0)+'" r="6" fill="#34c77b"/>'+
    '<circle cx="'+px(last)+'" cy="'+py(last)+'" r="6" fill="#e5556a"/></svg>';
}

/* ---- Splits (große Balken, schnellster hervorgehoben) ---- */
function storySplits(sp){
  if(!sp||!sp.length)return '<p class="st-note">Keine Splits vorhanden.</p>';
  var paces=sp.map(function(s){return s.sec;});
  var fast=Math.min.apply(null,paces),slow=Math.max.apply(null,paces),rng=(slow-fast)||1;
  return '<div class="st-splits">'+sp.map(function(s){
    var w=46+(1-(s.sec-fast)/rng)*54, isFast=s.sec===fast;
    return '<div class="st-split"><span class="st-km">'+s.km+'</span>'+
      '<div class="st-bar-wrap"><div class="st-bar'+(isFast?' best':'')+'" style="width:'+w.toFixed(0)+'%"></div></div>'+
      '<span class="st-pace">'+_fmtSec(s.sec)+'</span></div>';
  }).join('')+'</div>';
}

/* ---- Liniendiagramm (Pace invertiert = schneller oben) ---- */
function storyLineChart(curve,opts){
  opts=opts||{};
  if(!curve||curve.length<2)return '';
  var xs=curve.map(function(p){return p[0];}),ys=curve.map(function(p){return p[1];});
  var maxX=Math.max.apply(null,xs)||1,minV=Math.min.apply(null,ys),maxV=Math.max.apply(null,ys);
  var W=320,H=150,pad=8,rng=(maxV-minV)||1;
  var X=function(x){return (pad+(x/maxX)*(W-2*pad));};
  var Y=function(v){ var t=(v-minV)/rng; if(opts.invert)t=1-t; return (pad+t*(H-2*pad)); };
  var d=curve.map(function(p,i){return (i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1);}).join(' ');
  var area=d+' L'+X(maxX).toFixed(1)+' '+(H-pad).toFixed(1)+' L'+X(0).toFixed(1)+' '+(H-pad).toFixed(1)+' Z';
  return '<svg class="st-chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
    '<path d="'+area+'" fill="#c9ae7c" opacity="0.14"/>'+
    '<path class="st-line" d="'+d+'" fill="none" stroke="url(#orviaMarkGrad)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

/* ---- Kompakte Splits in der Workout-Card ---- */
function splitsMiniHTML(sp){
  if(!sp||!sp.length)return '';
  var paces=sp.map(function(s){return s.sec;});
  var fast=Math.min.apply(null,paces),slow=Math.max.apply(null,paces),rng=(slow-fast)||1;
  return '<div class="wc-splits"><div class="wc-splits-h">Splits / km</div>'+sp.map(function(s){
    var w=40+(1-(s.sec-fast)/rng)*60, isFast=s.sec===fast;
    return '<div class="wcsp"><span class="wcsp-k">'+s.km+'</span><div class="wcsp-bar-wrap"><div class="wcsp-bar'+(isFast?' best':'')+'" style="width:'+w.toFixed(0)+'%"></div></div><span class="wcsp-p">'+_fmtSec(s.sec)+'</span></div>';
  }).join('')+'</div>';
}

/* ---- Story-Karten zusammenbauen ---- */
function buildStoryCards(date,typ,s){
  var cards=[];
  var dl=(typeof fmtDate==='function')?fmtDate(date):date;
  var name=s.name||typ;
  var timeStr=(typeof fmtDurInput==='function'&&s.dur!=null)?fmtDurInput(s.dur):(s.dur+' min');
  var avgPace=(s.dist&&s.dur&&typeof fmtPace==='function')?fmtPace(s.dur*60/s.dist):'–';
  // 0 — Cover
  cards.push('<div class="st-card st-cover">'+
    '<div class="st-kicker"><svg class="omark" viewBox="0 0 512 512"><use href="#orvia-mark"/></svg>ORVIA · Recap</div>'+
    '<div class="st-h1">'+escH(name)+'</div>'+
    '<div class="st-sub">'+escH(dl)+(s.place?' · '+escH(s.place):'')+'</div>'+
    (s.route?storyRoute(s.route):'')+
    '<div class="st-stats3"><div><b>'+(s.dist!=null?s.dist.toFixed(2):'–')+'</b><span>km</span></div>'+
      '<div><b>'+timeStr+'</b><span>Zeit</span></div>'+
      '<div><b>'+avgPace+'</b><span>/km</span></div></div></div>');
  // 1 — Splits
  if(s.splits&&s.splits.length){
    var fastKm=s.splits.reduce(function(a,b){return b.sec<a.sec?b:a;});
    cards.push('<div class="st-card"><div class="st-ctitle">Kilometer-Splits</div>'+
      storySplits(s.splits)+
      '<div class="st-cap">Schnellster Kilometer: km '+fastKm.km+' in '+_fmtSec(fastKm.sec)+'. Du bist nach verhaltenem Mittelteil stark ins Ziel gelaufen.</div></div>');
  }
  // 2 — Pace-Kurve
  if(s.paceCurve&&s.paceCurve.length>1){
    cards.push('<div class="st-card"><div class="st-ctitle">Pace-Verlauf</div>'+
      storyLineChart(s.paceCurve,{invert:true})+
      '<div class="st-axis"><span>Start</span><span>Ø '+avgPace+'/km</span><span>Ziel</span></div>'+
      '<div class="st-cap">Oben = schneller. Schneller Start, kontrollierte Mitte, kräftiger Endspurt — genau das Wettkampfmuster, das du willst.</div></div>');
  }
  // 3 — Cadence + Puls-Hinweis
  var cadBlock='';
  if(s.cadCurve&&s.cadCurve.length>1){
    cadBlock='<div class="st-ctitle">Schrittfrequenz</div>'+storyLineChart(s.cadCurve,{invert:false})+
      '<div class="st-axis"><span>Start</span><span>Ø '+(s.cad||'–')+' spm</span><span>Ziel</span></div>';
  }
  cards.push('<div class="st-card">'+cadBlock+
    '<div class="st-hrnote"><div class="st-hrnote-h">Puls-Kurve</div>'+
    '<p>Für diesen Lauf liegt <b>kein Puls in Strava</b> ('+(s.cad?'Cadence ja, ':'')+'HR nein) — deine Garmin-Herzfrequenz wird nicht zu Strava übertragen. Mit einer direkten Garmin-Anbindung erscheint hier die echte Puls-Kurve.</p></div></div>');
  // 4 — Bestzeiten / Verdict
  var be='';
  if(s.best){
    be='<div class="st-best">'+
      (s.best.k1?'<div class="st-bchip"><b>'+_fmtSec(s.best.k1)+'</b><span>schnellster km</span></div>':'')+
      (s.best.mile?'<div class="st-bchip"><b>'+_fmtSec(s.best.mile)+'</b><span>1 Meile</span></div>':'')+
      (s.best.k5?'<div class="st-bchip"><b>'+_fmtSec(s.best.k5)+'</b><span>5 km</span></div>':'')+
      '</div>';
  }
  cards.push('<div class="st-card st-final">'+
    '<div class="st-verdict">Ein perfektes Training.</div>'+
    '<p class="st-vp">Generalprobe bestanden: Tempo, Ablauf und Wettkampfgefühl getestet, neue Bestzeiten gesichert. Starkes Signal für den Halbmarathon.</p>'+
    be+
    '<button class="btn" style="margin-top:18px" onclick="closeStory()">Fertig</button></div>');
  return cards;
}

/* ---- Story-Overlay ---- */
var _story={i:0,n:0};
function openStory(date,typ){
  if(date&&typeof date==='object'&&date.dataset){ typ=date.dataset.t; date=date.dataset.d; }
  var e=DB[date]; if(!e||!e.sessions||!e.sessions[typ])return;
  var s=e.sessions[typ];
  _story={i:0,date:date,typ:typ,cards:buildStoryCards(date,typ,s)};
  _story.n=_story.cards.length;
  var wrap=document.createElement('div'); wrap.className='story-bg'; wrap.id='storyBg';
  wrap.innerHTML='<div class="story-shell">'+
    '<div class="st-prog">'+_story.cards.map(function(_,i){return '<span class="st-pseg" data-i="'+i+'"><i></i></span>';}).join('')+'</div>'+
    '<button class="st-close" onclick="closeStory()" aria-label="Schließen">✕</button>'+
    '<div class="st-body" id="stBody" onclick="storyTap(event)"></div>'+
    '<div class="st-hint">Tippen zum Weiter · links zurück</div>'+
    '</div>';
  document.body.appendChild(wrap); window._storyEl=wrap;
  document.body.classList.add('story-open');
  renderStoryCard();
}
function closeStory(){ if(window._storyEl){try{window._storyEl.remove();}catch(e){}window._storyEl=null;} document.body.classList.remove('story-open'); }
function storyNav(dir){ var ni=_story.i+dir; if(ni<0){return;} if(ni>=_story.n){closeStory();return;} _story.i=ni; renderStoryCard(); }
function storyTap(ev){
  if(ev&&ev.target&&ev.target.closest&&ev.target.closest('button'))return; // Buttons normal lassen
  var shell=document.querySelector('#storyBg .story-shell'); if(!shell){storyNav(1);return;}
  var r=shell.getBoundingClientRect(); var x=(ev.clientX||0)-r.left;
  storyNav(x < r.width*0.32 ? -1 : 1);
}
function renderStoryCard(){
  var b=document.getElementById('stBody'); if(!b)return;
  b.innerHTML=_story.cards[_story.i];
  var segs=document.querySelectorAll('#storyBg .st-pseg');
  for(var i=0;i<segs.length;i++){ segs[i].classList.toggle('done',i<_story.i); segs[i].classList.toggle('active',i===_story.i); }
}
