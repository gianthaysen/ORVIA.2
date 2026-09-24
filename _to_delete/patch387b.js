const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
rep('app/js/ui.js',
`_uiT('ui.keine_aktivitaet_in_diesem_filter') + '</div></div>')+'</div>';
  /* 9. Abschluss */`,
`_uiT('ui.keine_aktivitaet_in_diesem_filter') + '</div></div>')+'</div>';
  if(restN>0)h+='<button class="btn sec act-more" onclick="gmActLoadMore()">'+_uiT('ui.act_mehr_laden',{count:restN})+'</button>';
  else if(listAll.length>GM_ACT_PAGE)h+='<p class="note act-more-end">'+_uiT('ui.act_alle_geladen',{count:listAll.length})+'</p>';
  /* 9. Abschluss */`);
rep('app/js/ui.js',
`function gmSetActivityFilter(f){gmActFilter=f;renderGMActivity();}`,
`function gmSetActivityFilter(f){gmActFilter=f;gmActLimit=GM_ACT_PAGE;renderGMActivity();}`);
rep('app/locales/de.js',
`    'ui.keine_aktivitaet_in_diesem_filter': 'Keine Aktivität in diesem Filter',`,
`    'ui.keine_aktivitaet_in_diesem_filter': 'Keine Aktivität in diesem Filter',
    'ui.act_mehr_laden.one': 'Eine weitere Aktivität laden',
    'ui.act_mehr_laden.other': '{count} weitere Aktivitäten laden',
    'ui.act_alle_geladen.one': 'Alle Aktivitäten geladen',
    'ui.act_alle_geladen.other': 'Alle {count} Aktivitäten geladen',`);
console.log('ok');
