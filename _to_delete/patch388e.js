const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
// store: recordingFor + setActivityLink
rep('app/js/activity-store.js',
`  function listActivities(filters) {
    filters = filters || {};`,
`  /* S2c: Aufzeichnung zu einem Primaerdatensatz (fuer Einzelaufloesung, z. B. Detailseite). */
  function recordingFor(a) {
    if (!a || !a.id) return null;
    var all = readAll();
    for (var i = 0; i < all.length; i++) if (all[i].linkedActivityId === a.id && all[i].id !== a.id) return all[i];
    return null;
  }
  /* S2c: Lokale Kopplung nach erfolgreicher Server-RPC nachziehen (Server bleibt Quelle). */
  function setActivityLink(recordingId, primaryIdOrNull) {
    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.id === recordingId || a.clientRecordId === recordingId) {
        a.linkedActivityId = primaryIdOrNull || null; a.linkKind = primaryIdOrNull ? 'device_recording' : null; a.updatedAt = now();
        writeAll(all); return { ok: true, activity: a };
      }
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden' };
  }
  function listActivities(filters) {
    filters = filters || {};`);
rep('app/js/activity-store.js',
`    correctActivityDuration: correctActivityDuration, repairWorkoutSnapshot: repairWorkoutSnapshot,`,
`    correctActivityDuration: correctActivityDuration, repairWorkoutSnapshot: repairWorkoutSnapshot,
    recordingFor: recordingFor, setActivityLink: setActivityLink,`);
// activity.js resolve: attach recording
rep('app/js/activity.js',
`function _resolveActivity(aid) {
  var store = window.ORVIA && ORVIA.activityStore;
  var a = store ? store.getActivityById(aid) : null;             // lokal: id ODER clientRecordId
  if (a) return a;
  if (_serverActivities && _serverActivities.length) {
    a = _serverActivities.find(function (x) { return x.id === aid || x.clientRecordId === aid; });
    if (a) return a;
  }
  return null;
}`,
`function _resolveActivity(aid) {
  var store = window.ORVIA && ORVIA.activityStore;
  var a = store ? store.getActivityById(aid) : null;             // lokal: id ODER clientRecordId
  if (!a && _serverActivities && _serverActivities.length) {
    a = _serverActivities.find(function (x) { return x.id === aid || x.clientRecordId === aid; }) || null;
  }
  /* S2c (v8-388): Einzelaufloesung haengt die gekoppelte Aufzeichnung genauso an
     wie die Liste (activityConfig.attachRecordings) — sonst zeigte die Detailseite
     HF/Uhr-Dauer nicht, obwohl die Liste sie kennt. */
  if (a && !a.recording && a.id) {
    try {
      var rec = (store && store.recordingFor) ? store.recordingFor(a) : null;
      if (!rec && _serverActivities && _serverActivities.length) rec = _serverActivities.find(function (x) { return x.linkedActivityId === a.id && x.id !== a.id; }) || null;
      if (rec) a.recording = rec;
    } catch (e) {}
  }
  return a;
}`);
// ui.js: detail source label + recording card + unlink handler
rep('app/js/ui.js',
`<h1>'+gmEsc(vm.title||vm.sportLabel||'—')+'</h1><p>'+gmEsc(gmActSrcLabel(vm.source))+(vm.planLink?`,
`<h1>'+gmEsc(vm.title||vm.sportLabel||'—')+'</h1><p>'+gmEsc(gmActSrcLabel(vm.source))+(vm.recording?' + '+gmEsc(gmActSrcLabel(vm.recording.source)):'')+(vm.planLink?`);
rep('app/js/ui.js',
`  if((vm.source==='orvia_workout'||vm.source==='live')&&vm.status!=='active'&&a.durationSeconds!=null){
    var _dc=a.metrics&&a.metrics.durationCorrection;`,
`  /* S2c (v8-388): Gekoppelte Geraeteaufzeichnung — eigene Karte mit Uhr-Dauer, HF,
     Kalorien und dem Weg, die Kopplung zu loesen (Server-RPC, kein stilles Loeschen).
     Umgekehrt: ist DIESE Aktivitaet eine gekoppelte Aufzeichnung, wird das gesagt. */
  if(vm.recording){
    var _r=vm.recording;var _rid=String(_r.id||'');
    h+='<div class="card"><div class="ctitle"><div class="l">'+icon('watch')+_uiT('ui.rec_karte_titel',{src:gmActSrcLabel(_r.source)})+'</div></div>'+
      '<div class="rec-grid">'+
        '<div><b>'+gmEsc(_r.durationLabel||'—')+'</b><span>'+_uiT('ui.rec_uhr_dauer')+'</span></div>'+
        '<div><b>'+(_r.avgHr!=null?gmEsc(String(Math.round(_r.avgHr)))+' bpm':'—')+'</b><span>'+_uiT('ui.oe_hf')+'</span></div>'+
        '<div><b>'+(_r.maxHr!=null?gmEsc(String(Math.round(_r.maxHr)))+' bpm':'—')+'</b><span>'+_uiT('ui.rec_max_hf')+'</span></div>'+
        '<div><b>'+(_r.caloriesKcal!=null?gmEsc(String(Math.round(_r.caloriesKcal)))+' kcal':'—')+'</b><span>'+_uiT('ui.rec_kalorien')+'</span></div>'+
      '</div>'+
      '<div class="mini-note" style="margin-top:10px">'+icon('info','xs')+'<div>'+_uiT('ui.rec_erklaerung',{time:_r.time||'—'})+' <a href="#" onclick="event.preventDefault();gmUnlinkRecording(\''+gmEsc(_rid)+'\',\''+gmEsc(String(aid))+'\')" style="font-weight:700">'+_uiT('ui.rec_loesen')+'</a></div></div></div>';
  }else if(a&&a.linkedActivityId){
    h+='<div class="mini-note" style="margin:2px 18px 10px">'+icon('info','xs')+'<div>'+_uiT('ui.rec_ist_gekoppelt')+' <a href="#" onclick="event.preventDefault();gmOpenActivityPage(\''+gmEsc(String(a.linkedActivityId))+'\')" style="font-weight:700">'+_uiT('ui.rec_zum_workout')+'</a></div></div>';
  }
  if((vm.source==='orvia_workout'||vm.source==='live')&&vm.status!=='active'&&a.durationSeconds!=null){
    var _dc=a.metrics&&a.metrics.durationCorrection;`);
rep('app/js/ui.js',
`function gmCloseActivityPage(){var pg=document.getElementById('gmActPage');if(pg)pg.classList.remove('on');}`,
`function gmCloseActivityPage(){var pg=document.getElementById('gmActPage');if(pg)pg.classList.remove('on');}
/* S2c (v8-388): Kopplung loesen — Server zuerst (RPC), dann lokal nachziehen, dann neu
   rendern. Bei Fehler bleibt alles wie es war und der Grund wird gezeigt. */
function gmUnlinkRecording(recId,aid){
  var repos=window.ORVIA&&ORVIA.repos&&ORVIA.repos.activity;
  if(!repos||!repos.unlinkRecording){try{gmToast(_uiT('ui.cloud_modul_nicht_geladen'));}catch(_){ }return;}
  repos.unlinkRecording(recId).then(function(r){
    if(!(r&&r.success)){try{gmToast(_uiT('ui.rec_loesen_fehler')+(r&&r.error&&r.error.message?': '+r.error.message:''));}catch(_){ }return;}
    try{var st=ORVIA.activityStore;if(st&&st.setActivityLink)st.setActivityLink(recId,null);}catch(_){ }
    try{if(typeof _fetchServerActivities==='function')_fetchServerActivities(true);}catch(_){ }
    try{gmToast(_uiT('ui.rec_geloest'));}catch(_){ }
    try{gmOpenActivityPage(aid);}catch(_){ }
  }).catch(function(e){try{gmToast(_uiT('ui.rec_loesen_fehler')+': '+String(e&&e.message||e));}catch(_){ }});
}`);
// list card: source label combined
rep('app/js/ui.js',
`<p>'+gmEsc(dl)+' · '+gmEsc(gmActSrcLabel(vm.source))+'</p></div>'+`,
`<p>'+gmEsc(dl)+' · '+gmEsc(gmActSrcLabel(vm.source))+(vm.recording?' + '+gmEsc(gmActSrcLabel(vm.recording.source)):'')+'</p></div>'+`);
// locale
rep('app/locales/de.js',
`    'ui.dauer_korrigieren': 'Dauer korrigieren',`,
`    'ui.dauer_korrigieren': 'Dauer korrigieren',
    'ui.rec_karte_titel': 'Aufzeichnung ({src})',
    'ui.rec_uhr_dauer': 'DAUER (UHR)',
    'ui.rec_max_hf': 'MAX. HF',
    'ui.rec_kalorien': 'KALORIEN',
    'ui.rec_erklaerung': 'Diese Uhr-Aufzeichnung (Start {time}) ist an das Workout gekoppelt: Sätze aus ORVIA, Herzfrequenz und Dauer von der Uhr — in der Belastung zählt die Einheit einmal.',
    'ui.rec_loesen': 'Kopplung lösen',
    'ui.rec_geloest': 'Kopplung gelöst — die Aufzeichnung ist wieder eine eigene Aktivität.',
    'ui.rec_loesen_fehler': 'Kopplung konnte nicht gelöst werden',
    'ui.rec_ist_gekoppelt': 'Diese Aufzeichnung ist an ein ORVIA-Workout gekoppelt und zählt dort mit.',
    'ui.rec_zum_workout': 'Zum Workout',`);
console.log('ok');
