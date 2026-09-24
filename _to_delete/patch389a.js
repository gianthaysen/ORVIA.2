const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }

/* ---- 1. profile-model: kanonische Gewichtsreihe + tagesgenaue Aufloesung ---- */
rep('app/js/profile-model.js',
`  function currentWeightKg(perf) { perf = perf || {}; var wh = perf.weightHistory || []; if (wh.length) return wh[0].valueKg; return (perf.body && perf.body.weight && perf.body.weight.value) || nu`,
`  /* ============================================================
     S2-B1b (v8-389) · EINE Gewichtsquelle, tagesgenau.
     Bisher las currentWeightKg nur das Profilfeld (weightHistory[0] bzw.
     body.weight) — der NUECHTERNWERT aus dem Morgenbericht, den der Nutzer
     taeglich pflegt, wurde nie gelesen. Folge: relative Kraft und die
     Systemlast bei Koerpergewichtsuebungen rechneten mit einem Wert, der
     Wochen alt sein konnte, und eine Klimmzugserie ueber drei Monate nahm
     das HEUTIGE Gewicht auch fuer Einheiten im Juni.
     weightSeries() fuehrt Morgenwerte und Profilverlauf zu EINER nach Datum
     sortierten Reihe zusammen (Morgenwert gewinnt am selben Tag: nuechtern,
     standardisiert). bodyweightAt() loest den am Stichtag GUELTIGEN Wert auf
     — naechster Eintrag davor; nur wenn es davor keinen gibt, der naechste
     danach. Nie interpoliert, nie erfunden; ohne Datenlage null.
     Beide Funktionen sind pur (kein DOM, kein Store).
     ============================================================ */
  function weightSeries(perf, morningWeights) {
    perf = perf || {};
    var byDate = {};
    (perf.weightHistory || []).forEach(function (e) {
      var d = e && e.measuredAt ? String(e.measuredAt).slice(0, 10) : null;
      if (!d || e.valueKg == null) return;
      if (!byDate[d]) byDate[d] = { date: d, kg: e.valueKg, source: 'profile' };
    });
    (Array.isArray(morningWeights) ? morningWeights : []).forEach(function (e) {
      var d = e && (e.date || e.day); var kg = e && (e.kg != null ? e.kg : e.weight);
      if (!d || kg == null || !(kg > 0)) return;
      byDate[d] = { date: String(d).slice(0, 10), kg: +kg, source: 'morning' };   // Morgenwert gewinnt
    });
    var out = Object.keys(byDate).map(function (k) { return byDate[k]; });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }
  function bodyweightAt(dateIso, series, opts) {
    var o = opts || {}, maxAhead = o.maxAheadDays != null ? o.maxAheadDays : 14;
    series = Array.isArray(series) ? series : [];
    if (!series.length) return null;
    var d = String(dateIso || '').slice(0, 10); if (!d) return null;
    var before = null, after = null;
    for (var i = 0; i < series.length; i++) {
      if (series[i].date <= d) before = series[i];
      else { after = series[i]; break; }
    }
    var hit = before || null;
    if (!hit && after) {
      var gap = Math.round((Date.parse(after.date + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 864e5);
      if (gap <= maxAhead) hit = after; else return null;
    }
    if (!hit) return null;
    var age = Math.round(Math.abs(Date.parse(d + 'T12:00:00Z') - Date.parse(hit.date + 'T12:00:00Z')) / 864e5);
    return { kg: hit.kg, date: hit.date, source: hit.source, ageDays: age };
  }
  /* perf-Signatur unveraendert; zweiter Parameter (Reihe) ist optional und
     gewinnt, wenn er einen Wert hat — Aufrufer ohne Reihe verhalten sich wie bisher. */
  function currentWeightKg(perf, series) {
    if (Array.isArray(series) && series.length) { var last = series[series.length - 1]; if (last && last.kg != null) return last.kg; }
    perf = perf || {}; var wh = perf.weightHistory || []; if (wh.length) return wh[0].valueKg; return (perf.body && perf.body.weight && perf.body.weight.value) || nu`);
rep('app/js/profile-model.js',
`    currentWeightKg: currentWeightKg, estimate1RM: estimate1RM,`,
`    currentWeightKg: currentWeightKg, weightSeries: weightSeries, bodyweightAt: bodyweightAt, estimate1RM: estimate1RM,`);

/* ---- 2. checkin-store: Morgengewichte als kanonische Reihe ---- */
rep('app/js/checkin-store.js',
`  O.checkinStore = {
    persistCheckin, hydrateRecentTypes, rowToCheckin,`,
`  /* S2-B1b (v8-389): Morgengewichte als Reihe. EINE Leseregel fuer alle
     Verbraucher (Ernaehrung, Kraftprofil, relative Kraft) — vorher las jeder
     Verbraucher DB selbst, mit eigener Fensterlaenge. Reines Lesen. */
  function morningWeightSeries(days) {
    var n = (days != null && days > 0) ? Math.floor(days) : 365;
    var out = [];
    try {
      var DBx = (typeof DB !== 'undefined') ? DB : null; if (!DBx) return out;
      var dk = (typeof dkey === 'function') ? dkey : null; if (!dk) return out;
      for (var i = n - 1; i >= 0; i--) {
        var k = dk(-i), e = DBx[k];
        var w = e && e.morning && e.morning.weight;
        if (typeof w === 'number' && isFinite(w) && w > 0) out.push({ date: k, kg: w });
      }
    } catch (e) {}
    return out;
  }

  O.checkinStore = {
    persistCheckin, hydrateRecentTypes, rowToCheckin, morningWeightSeries,`);
console.log('ok');
