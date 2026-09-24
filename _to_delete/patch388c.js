const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
rep('app/js/engine/load-history.js',
`    var min = a.durationMin != null ? a.durationMin
      : (a.durationSec > 0 ? a.durationSec / 60
        : (a.movingTimeSec > 0 ? a.movingTimeSec / 60
          : (a.elapsedMs > 0 ? a.elapsedMs / 60000 : null)));`,
`    var min = a.durationMin != null ? a.durationMin
      : (a.durationSec > 0 ? a.durationSec / 60
        : (a.durationSeconds > 0 ? a.durationSeconds / 60          /* kanonische Form (activity-normalize) */
          : (a.movingTimeSec > 0 ? a.movingTimeSec / 60
            : (a.elapsedMs > 0 ? a.elapsedMs / 60000 : null))));
    /* S2c (v8-388): Haengt eine gekoppelte Geraeteaufzeichnung an (a.recording),
       ist deren Dauer die verlaesslichere (Uhr statt App-Start/Stopp) — AUSSER der
       Nutzer hat die Dauer manuell korrigiert (metrics.durationCorrection): die
       Korrektur gewinnt vor der Uhr, die Uhr vor dem Workout. */
    var corrected = !!(a.metrics && a.metrics.durationCorrection);
    if (!corrected && a.recording && a.recording.durationSeconds > 0) min = a.recording.durationSeconds / 60;`);
rep('app/js/engine/load-history.js',
`      dayKey: _dayKey(a.localDate || a.date || a.startDateLocal || a.startDate)`,
`      dayKey: _dayKey(a.localDate || a.date || a.startDateLocal || a.startDate || a.startedAt)`);
console.log('ok');
