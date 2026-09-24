const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';

/* Aufloeser: Gewicht am Tag der Einheit (Reihe > Einzelwert). */
rep(F,
`  function collectExercises(snapshots, deps) {`,
`  /* v8-389: Koerpergewicht ist tagesabhaengig. deps.bodyweightSeries kommt aus
     profileModel.weightSeries (Morgenbericht + Profilverlauf); fehlt sie, bleibt
     der Einzelwert deps.bodyweightKg die Quelle. Nie interpoliert. */
  function bwAt(deps, date) {
    var d = deps || {};
    try {
      var PM = O.profileModel;
      if (PM && PM.bodyweightAt && d.bodyweightSeries && d.bodyweightSeries.length) {
        var hit = PM.bodyweightAt(date, d.bodyweightSeries);
        if (hit && hit.kg > 0) return hit.kg;
      }
    } catch (e) {}
    var w = num(d.bodyweightKg);
    return (w != null && w > 0) ? w : null;
  }

  function collectExercises(snapshots, deps) {`);

/* sessionBest bekommt das Gewicht des Tages statt eines globalen. */
rep(F,
`    E.sessions.forEach(function (s) { var b = sessionBest(s, E.bodyweight ? (bw != null && bw > 0 ? bw : 0) : null);`,
`    E.sessions.forEach(function (s) { var bwDay = E.bodyweight ? (bwAt(deps, s.date) || 0) : null; var b = sessionBest(s, bwDay);`);

/* B4: Systemlast konsistent ueber die ganze Reihe, sobald IRGENDEINE Einheit Zusatzlast traegt. */
rep(F,
`    if (bw != null && bw > 0) { var loaded = work.filter(function (x) { return x.weight != null && x.weight > 0; }).length; if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true `,
`    if (bw != null && bw > 0) { var loaded = work.filter(function (x) { return x.weight != null && x.weight > 0; }).length;
      /* v8-389 (S2-B4): Die Entscheidung faellt fuer die GANZE Uebung, nicht je Einheit.
         Vorher mischte eine Klimmzugreihe Wiederholungen ohne Zusatzlast (12, 14, 13) mit
         Wiederholungen unter +10 kg (7, 9) auf EINER Achse und meldete „−5 Wdh." als
         Rueckschritt, obwohl die Last um 10 kg gestiegen war. Traegt irgendeine Einheit
         Zusatzlast, rechnet die ganze Reihe mit Systemlast (Koerper + Zusatz) — damit sind
         alle Punkte vergleichbar und der Zuwachs sichtbar. */
      if (E_BW_FLAG.anyLoaded) bw = { bw: bw, weighted: true };
      else if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true `);

/* anyLoaded vor der Auswertung bestimmen. */
rep(F,
`  var E_BW_FLAG = { on: false };`,
`  var E_BW_FLAG = { on: false, anyLoaded: false };`);
rep(F,
`    E_BW_FLAG.on = !!E.bodyweight;`,
`    E_BW_FLAG.on = !!E.bodyweight;
    /* Traegt IRGENDEIN Arbeitssatz der Uebung Zusatzlast? Entscheidet ueber Systemlast (s. sessionBest). */
    E_BW_FLAG.anyLoaded = !!E.bodyweight && E.sessions.some(function (s) {
      return s.sets.some(function (x) { return x.work && x.weight != null && x.weight > 0; });
    });`);
rep(F,
`    E_BW_FLAG.on = false;
    E.tests =`,
`    E_BW_FLAG.on = false; E_BW_FLAG.anyLoaded = false;
    E.tests =`);

/* build(): Reihe durchreichen. */
rep(F,
`    var deps = { gymVolume: o.gymVolume, bodyweightKg: num(o.bodyweightKg) };`,
`    var deps = { gymVolume: o.gymVolume, bodyweightKg: num(o.bodyweightKg), bodyweightSeries: o.bodyweightSeries || null };`);
rep(F,
`    m.exerciseModel = function (key) { var E = exercises.filter(function (x) { return x.key === key; })[0]; return E ? exerciseModel(E, { today: today, strengthProgression: o.strengthProgression, body`,
`    m.bodyweight = deps.bodyweightSeries && deps.bodyweightSeries.length
      ? (function () { try { var h = O.profileModel && O.profileModel.bodyweightAt ? O.profileModel.bodyweightAt(today, deps.bodyweightSeries) : null; return h || null; } catch (e) { return null; } })()
      : (deps.bodyweightKg != null ? { kg: deps.bodyweightKg, date: null, source: 'profile', ageDays: null } : null);
    m.exerciseModel = function (key) { var E = exercises.filter(function (x) { return x.key === key; })[0]; return E ? exerciseModel(E, { today: today, strengthProgression: o.strengthProgression, body`);
console.log('ok');
