const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
rep('app/js/ui.js',
`var gmActFilter='Alle';
var GM_ACT_SPORT=`,
`var gmActFilter='Alle';
/* v8-387: Die Liste war hart auf 40 Karten begrenzt — mit Garmin-Import reichte das nur
   ~12 Wochen zurueck, aeltere Einheiten (z. B. die nachgetragenen Juni-Krafteinheiten)
   waren unerreichbar. Jetzt: Filter VOR dem Zuschnitt, Seitengroesse 40, „Mehr laden". */
var GM_ACT_PAGE=40;
var gmActLimit=GM_ACT_PAGE;
function gmActLoadMore(){gmActLimit+=GM_ACT_PAGE;renderGMActivity();
  try{var el=document.querySelector('.activity-list article:nth-child('+(gmActLimit-GM_ACT_PAGE+1)+')');if(el)el.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){ }}
var GM_ACT_SPORT=`);
rep('app/js/ui.js',
`  var acts=[];try{acts=listActivitiesUnified(40)||[];}catch(_){ }
  var list=(gmActFilter==='Alle')?acts:acts.filter(function(a){return a&&a.sportId===GM_ACT_FILTER[gmActFilter];});
  var cards=list.map(function(a){`,
`  var acts=[];try{acts=listActivitiesUnified(2000)||[];}catch(_){ }
  var listAll=(gmActFilter==='Alle')?acts:acts.filter(function(a){return a&&a.sportId===GM_ACT_FILTER[gmActFilter];});
  var list=listAll.slice(0,gmActLimit);
  var restN=listAll.length-list.length;
  var cards=list.map(function(a){`);
rep('app/js/ui.js',
`  h+='<div class="activity-list">'+(list.length?cards:'<div class="empty"><div class="e-ic">'+icon('activity')+'</div><div class="et">' + _uiT('ui.keine_aktivitaet_in_diesem_filter') + '</div></div>')
  /* 9. Abschluss */`,
`  h+='<div class="activity-list">'+(list.length?cards:'<div class="empty"><div class="e-ic">'+icon('activity')+'</div><div class="et">' + _uiT('ui.keine_aktivitaet_in_diesem_filter') + '</div></div>')+'</div>';
  if(restN>0)h+='<button class="btn sec act-more" onclick="gmActLoadMore()">'+_uiT('ui.act_mehr_laden',{count:restN})+'</button>';
  else if(listAll.length>GM_ACT_PAGE)h+='<p class="note act-more-end">'+_uiT('ui.act_alle_geladen',{count:listAll.length})+'</p>';
  /* 9. Abschluss */`);
rep('app/js/ui.js',
`function gmSetActivityFilter(f){gmActFilter=f;renderGMActivity();}`,
`function gmSetActivityFilter(f){gmActFilter=f;gmActLimit=GM_ACT_PAGE;renderGMActivity();}`);
console.log('ok');
