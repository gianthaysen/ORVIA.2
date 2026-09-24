const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
rep('app/js/activity.js',
`  ['title', 'distanceLabel', 'paceLabel', 'elevationM', 'avgHr', 'maxHr', 'caloriesKcal'].forEach(function (k) { vm.missing[k] = (vm[k] == null || vm[k] === ''); });
  try {
    var store = window.ORVIA && ORVIA.activityStore;`,
`  /* S2c (v8-388): Gekoppelte Geraeteaufzeichnung (a.recording, vgl. activityConfig.
     attachRecordings). Sie ergaenzt NUR, was das Workout nicht hat — HF, Kalorien,
     Streams — und liefert die Uhr-Dauer als eigenen Wert. Nichts wird ueberschrieben,
     nichts erfunden: fehlt ein Feld in beiden Quellen, bleibt es „—". */
  vm.recording = null;
  try {
    var rec = a.recording || null;
    if (rec) {
      var rs = rec.summary || {};
      var rdm = (an && typeof an.activityDetailModel === 'function') ? an.activityDetailModel(rec.sportId || sportId, rs, rec.durationSeconds, rec.metrics || {}) : null;
      var rAvg = rdm ? rdm.avgHr : (rs.avgHr != null ? rs.avgHr : null);
      var rMax = rdm ? rdm.maxHr : (rs.maxHr != null ? rs.maxHr : null);
      var rKcal = rdm ? rdm.caloriesKcal : (rs.caloriesKcal != null ? rs.caloriesKcal : null);
      if (vm.avgHr == null && rAvg != null) vm.avgHr = rAvg;
      if (vm.maxHr == null && rMax != null) vm.maxHr = rMax;
      if (vm.caloriesKcal == null && rKcal != null) vm.caloriesKcal = rKcal;
      if (!vm.canonicalStreams && rec.metrics && rec.metrics.streams && typeof rec.metrics.streams === 'object') {
        vm.canonicalStreams = rec.metrics.streams;
        vm.canonicalStreamUnits = (rec.metrics.stream_units && typeof rec.metrics.stream_units === 'object') ? rec.metrics.stream_units : null;
      }
      vm.recording = {
        id: rec.id || null, source: rec.source || null,
        startedAt: rec.startedAt || null,
        time: (rec.startedAt && rec.startedAt.length >= 16) ? rec.startedAt.slice(11, 16) : null,
        durationSeconds: rec.durationSeconds != null ? rec.durationSeconds : null,
        durationLabel: (an && rec.durationSeconds != null) ? an.fmtDurationSeconds(rec.durationSeconds) : null,
        avgHr: rAvg, maxHr: rMax, caloriesKcal: rKcal
      };
    }
  } catch (e) {}
  ['title', 'distanceLabel', 'paceLabel', 'elevationM', 'avgHr', 'maxHr', 'caloriesKcal'].forEach(function (k) { vm.missing[k] = (vm[k] == null || vm[k] === ''); });
  try {
    var store = window.ORVIA && ORVIA.activityStore;`);
console.log('ok');
