const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';

/* Systemlast-Vereinheitlichung zuruecknehmen: der 12-Wdh.-Cap (Epley) wuerde die
   Koerpergewichts-Einheiten mit 13/14 Wdh. aus der Reihe werfen. */
rep(F,
`      /* v8-389 (S2-B4): Die Entscheidung faellt fuer die GANZE Uebung, nicht je Einheit.
         Vorher mischte eine Klimmzugreihe Wiederholungen ohne Zusatzlast (12, 14, 13) mit
         Wiederholungen unter +10 kg (7, 9) auf EINER Achse und meldete „−5 Wdh." als
         Rueckschritt, obwohl die Last um 10 kg gestiegen war. Traegt irgendeine Einheit
         Zusatzlast, rechnet die ganze Reihe mit Systemlast (Koerper + Zusatz) — damit sind
         alle Punkte vergleichbar und der Zuwachs sichtbar. */
      if (E_BW_FLAG.anyLoaded) bw = { bw: bw, weighted: true };
      else if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true `,
`      if (loaded * 2 < work.length) bw = null; else bw = { bw: bw, weighted: true `);

/* Zusatzlast je Einheit festhalten (Last des Satzes, der den Wdh.-Rekord erzeugt). */
rep(F,
`    return { best: best, e1rm: bestE, maxReps: maxReps, maxDur: maxDur, tonnage: Math.round(ton), work: work.length, test: test };`,
`    /* v8-389 (S2-B4): Zusatzlast der Einheit — die Last des Satzes mit den meisten
       Wiederholungen (0 = reines Koerpergewicht). Ohne sie ist eine Wdh.-Reihe nicht
       lesbar: 14 Wdh. ohne Zusatz und 9 Wdh. mit +10 kg sind kein Rueckschritt. */
    var addedKg = null;
    work.forEach(function (x) { if (x.reps != null && x.reps === maxReps && addedKg == null) addedKg = (x.weight != null && x.weight > 0) ? x.weight : 0; });
    return { best: best, e1rm: bestE, maxReps: maxReps, maxDur: maxDur, tonnage: Math.round(ton), work: work.length, test: test, addedKg: addedKg };`);
rep(F,
`s.maxReps = b.maxReps; s.maxDur = b.maxDur; s.ton`,
`s.maxReps = b.maxReps; s.addedKg = b.addedKg; s.maxDur = b.maxDur; s.ton`);

/* reps-Modus: Punkte tragen die Zusatzlast; Delta nur bei GLEICHER Last. */
rep(F,
`      m.series = E.sessions.filter(function (s) { return s.maxReps != null; }).map(function (s) { return { date: s.date, value: s.maxReps }; });
      var l2 = m.series[m.series.length - 1]; m.current = l2 ? l2.value : null; m.currentDate = l2 ? l2.date : null;
      var bestR = null; m.series.forEach(function (p) { if (!bestR || p.value > bestR.value) bestR = p; });
      if (bestR) m.prs.push({ kind: 'max_reps', date: bestR.date, value: bestR.value, unit: 'Wdh.' });
      var inW2 = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      if (inW2.length >= 2) m.delta = { reps: m.current - inW2[0].value, weeks: Math.max(1, Math.round((_d(l2.date) - _d(inW2[0].date)) / DAY / 7)) };`,
`      m.series = E.sessions.filter(function (s) { return s.maxReps != null; }).map(function (s) { return { date: s.date, value: s.maxReps, addedKg: s.addedKg != null ? s.addedKg : 0 }; });
      var l2 = m.series[m.series.length - 1]; m.current = l2 ? l2.value : null; m.currentDate = l2 ? l2.date : null;
      m.currentLoadKg = l2 ? l2.addedKg : null;
      m.loadLevels = m.series.reduce(function (a, p) { if (a.indexOf(p.addedKg) < 0) a.push(p.addedKg); return a; }, []).sort(function (a, b) { return a - b; });
      /* Bestwert je Lastniveau — ein Rekord ohne Last ist keine Aussage. */
      var bestByLoad = {};
      m.series.forEach(function (p) { var k = String(p.addedKg); if (!bestByLoad[k] || p.value > bestByLoad[k].value) bestByLoad[k] = p; });
      Object.keys(bestByLoad).sort(function (a, b) { return +b - +a; }).forEach(function (k) {
        var p = bestByLoad[k];
        m.prs.push({ kind: 'max_reps', date: p.date, value: p.value, unit: 'Wdh.', addedKg: +k });
      });
      /* v8-389 (S2-B4): Delta NUR zwischen Punkten gleicher Zusatzlast. Vorher verglich die
         Seite 9 Wdh. mit +10 kg gegen 14 Wdh. ohne Zusatz und meldete „−5 Wdh." als
         Rueckschritt — die Last war um 10 kg gestiegen. Gibt es keinen frueheren Punkt
         derselben Last, ist die ehrliche Antwort kein Delta, sondern der Grund dafuer. */
      var inW2 = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      var sameLoad = inW2.filter(function (p) { return p.addedKg === (l2 ? l2.addedKg : 0); });
      if (sameLoad.length >= 2) {
        m.delta = { reps: m.current - sameLoad[0].value, weeks: Math.max(1, Math.round((_d(l2.date) - _d(sameLoad[0].date)) / DAY / 7)), addedKg: l2.addedKg };
      } else if (inW2.length >= 2) {
        m.deltaBlocked = 'load_changed';
        m.deltaLoadFrom = inW2[0].addedKg; m.deltaLoadTo = l2 ? l2.addedKg : null;
      }`);
console.log('ok');
