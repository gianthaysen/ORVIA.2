const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,60)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,60)); fs.writeFileSync(file, s.replace(from,to)); }
// --- activity-store.js
rep('app/js/activity-store.js',
`  function repairWorkoutSnapshot(activityId, exercises) {
    var snap = snapshotExercises(exercises);
    if (!snap.length) return { ok: false, error: 'leer' };
    var all = readAll();
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      if (a.id === activityId || a.clientRecordId === activityId) {
        a.workoutSnapshot = snap; a.updatedAt = now();
        writeAll(all);
        return { ok: true, activity: a };
      }
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden' };`,
`  /* v8-386: ref (optional) = das geoeffnete Activity-Objekt. Server-Aktivitaeten, die nur
     in der Server-Liste (nicht im lokalen Store) liegen, tragen eine andere id als der
     lokale Datensatz — deshalb wird zusaetzlich ueber workoutSessionId und
     source+sourceRecordId gematcht. Findet sich kein lokaler Datensatz, ist das KEIN
     Ladefehler: der Snapshot wird trotzdem zurueckgegeben, damit die Detailseite die
     geladenen Saetze anzeigen kann. */
  function repairWorkoutSnapshot(activityId, exercises, ref) {
    var snap = snapshotExercises(exercises);
    if (!snap.length) return { ok: false, error: 'leer', snapshot: [] };
    var all = readAll();
    var hit = -1;
    for (var i = 0; i < all.length && hit < 0; i++) {
      var a = all[i];
      if (a.id === activityId || a.clientRecordId === activityId) hit = i;
    }
    if (hit < 0 && ref) {
      for (var j = 0; j < all.length && hit < 0; j++) {
        var b = all[j];
        if (ref.workoutSessionId && b.workoutSessionId === ref.workoutSessionId) hit = j;
        else if (ref.source && ref.sourceRecordId && b.source === ref.source && b.sourceRecordId === ref.sourceRecordId) hit = j;
        else if (ref.id && b.id === ref.id) hit = j;
      }
    }
    if (hit >= 0) {
      all[hit].workoutSnapshot = snap; all[hit].updatedAt = now();
      writeAll(all);
      return { ok: true, activity: all[hit], snapshot: snap };
    }
    return { ok: false, error: 'Aktivitaet nicht gefunden', snapshot: snap };`);
// --- ui.js: fallback keeps tree, renders it even without local record
rep('app/js/ui.js',
`    var store=window.ORVIA&&ORVIA.activityStore;
    if(!(store&&store.repairWorkoutSnapshot)){_gmActFallbackState[key]='error';redraw();return;}
    var rr=store.repairWorkoutSnapshot(a.clientRecordId||a.id,r.data.exercises);
    if(!rr||!rr.ok){_gmActFallbackState[key]='error';redraw();return;}
    _gmActFallbackState[key]='loaded';`,
`    /* v8-386: Das Laden ist hier bereits GELUNGEN. Ob der Snapshot in einen lokalen
       Datensatz zurueckgeschrieben werden kann, ist eine zweite Frage — bisher wurde ein
       fehlendes lokales Gegenstueck (Server-Aktivitaet ohne lokale Zeile) faelschlich als
       „Verbindungsfehler" gemeldet. Jetzt: Snapshot im Seiten-Cache halten und anzeigen;
       die Reparatur ist Bonus, ihr Scheitern kein Fehlerzustand. */
    var store=window.ORVIA&&ORVIA.activityStore;
    var rr=null;try{rr=store&&store.repairWorkoutSnapshot?store.repairWorkoutSnapshot(a.clientRecordId||a.id,r.data.exercises,a):null;}catch(_){ }
    var snap=(rr&&rr.snapshot&&rr.snapshot.length)?rr.snapshot:null;
    if(!snap){try{var _sn=store&&store.snapshotExercises?store.snapshotExercises(r.data.exercises):null;if(_sn&&_sn.length)snap=_sn;}catch(_){ }}
    if(!snap){_gmActFallbackState[key]='error';redraw();return;}
    gmActFallbackRemember(a,aid,snap);
    if(!(rr&&rr.ok)){try{console.warn('[ORVIA] Satz-Snapshot geladen, lokaler Datensatz nicht zuordenbar:',rr&&rr.error);}catch(_){ }}
    _gmActFallbackState[key]='loaded';`);
rep('app/js/ui.js',
`var _gmActFallbackTried={};
var _gmActFallbackState={};   /* aid -> loading | loaded | server_empty | error | no_session */`,
`var _gmActFallbackTried={};
var _gmActFallbackState={};   /* aid -> loading | loaded | server_empty | error | no_session */
var _gmActFallbackTree={};    /* v8-386: id/clientRecordId/aid -> Snapshot (Uebungen+Saetze) aus der Cloud */
function gmActFallbackRemember(a,aid,snap){
  [aid,a&&a.id,a&&a.clientRecordId].forEach(function(k){if(k)_gmActFallbackTree[String(k)]=snap;});
}
function gmActFallbackSnapshot(a,vm){
  var ks=[vm&&vm.id,a&&a.clientRecordId,a&&a.id];
  for(var i=0;i<ks.length;i++){var s=ks[i]&&_gmActFallbackTree[String(ks[i])];if(s&&s.length)return s;}
  return null;
}`);
rep('app/js/ui.js',
`    else if(a&&a.metrics&&Array.isArray(a.metrics.exercises)&&a.metrics.exercises.length)ex=a.metrics.exercises;
  }catch(_){ }`,
`    else if(a&&a.metrics&&Array.isArray(a.metrics.exercises)&&a.metrics.exercises.length)ex=a.metrics.exercises;
    else if(typeof gmActFallbackSnapshot==='function')ex=gmActFallbackSnapshot(a,vm);
  }catch(_){ }`);
// retry also clears tree cache
rep('app/js/ui.js',
`  var k=String(aid);delete _gmActFallbackTried[k];delete _gmActFallbackState[k];`,
`  var k=String(aid);delete _gmActFallbackTried[k];delete _gmActFallbackState[k];delete _gmActFallbackTree[k];`);
// diag probe: pass ref
rep('app/js/ui.js',
`        if(st&&st.repairWorkoutSnapshot&&a)st.repairWorkoutSnapshot(a.clientRecordId||a.id,exs);}catch(_){ }`,
`        if(st&&st.repairWorkoutSnapshot&&a){var rr=st.repairWorkoutSnapshot(a.clientRecordId||a.id,exs,a);
          if(rr&&rr.snapshot&&rr.snapshot.length)gmActFallbackRemember(a,aid,rr.snapshot);}}catch(_){ }`);
console.log('ok');
