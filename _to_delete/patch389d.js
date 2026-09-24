const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';

/* Steigung als gemeinsame Mechanik (dieselbe wie goalForecast). */
rep(F,
`  function exerciseModel(E, opts) {`,
`  /* ============================================================
     S2-B2/B3 (v8-389) · Trend statt Fensterrand.
     Bisher war Δ = aktueller Wert − ERSTER Punkt im 12-Wochen-Fenster. Das ist
     keine Entwicklung, sondern ein Abstand zu einem zufaelligen Randpunkt: liegt
     dort ein Ausreisser nach unten, meldet die Seite Fortschritt, den es nicht
     gibt (belegt an der Brustpresse: Rohdifferenz +5,4 kg, Regression +0,75 kg je
     4 Wochen ueber 9 Wochen — also Rauschen). Und weil das Fenster mitwandert,
     springt die Aussage ohne neues Training.
     trendOf() legt eine Ausgleichsgerade durch die Punkte im Fenster und gibt die
     Steigung je 4 Wochen zurueck — mit Anzahl Punkte und Spanne, damit die Seite
     sagen kann, worauf die Zahl beruht. Unter 3 Punkten oder 21 Tagen: kein Trend,
     sondern der Grund dafuer.
     ============================================================ */
  var TREND_MIN_POINTS = 3, TREND_MIN_DAYS = 21, STAG_MIN_POINTS = 4, STAG_MIN_DAYS = 28;
  function trendOf(points) {
    var pts = (points || []).filter(function (p) { return p && p.value != null && _d(p.date) != null; });
    if (pts.length < TREND_MIN_POINTS) return { ok: false, reason: 'few_points', points: pts.length };
    var t0 = _d(pts[0].date), spanDays = Math.round((_d(pts[pts.length - 1].date) - t0) / DAY);
    if (spanDays < TREND_MIN_DAYS) return { ok: false, reason: 'short_span', points: pts.length, spanDays: spanDays };
    var xs = pts.map(function (p) { return (_d(p.date) - t0) / DAY; }), ys = pts.map(function (p) { return p.value; });
    var n = xs.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    if (!(sxx > 0)) return { ok: false, reason: 'no_span', points: n, spanDays: spanDays };
    var perDay = sxy / sxx;
    var known = pts.filter(function (p) { return p.effort === true; }).length;
    return { ok: true, perDay: perDay, per4Weeks: r1(perDay * 28), points: n, spanDays: spanDays,
      effortKnown: known, effortUnknown: n - known };
  }

  function exerciseModel(E, opts) {`);

/* Serie traegt Ausbelastung; Trend + Stagnation aus der Steigung. */
rep(F,
`      m.series = E.sessions.filter(function (s) { return s.e1rm != null; }).map(function (s) { return { date: s.date, value: s.e1rm, test: !!s.test, testWeight: s.test ? s.test.weight : null }; });`,
`      /* v8-389 (S2-B1): effort = der Satz, aus dem der Wert stammt, trug eine
         RIR/RPE-Angabe. Epley setzt Ausbelastung voraus; ohne die Angabe misst der
         Punkt die Anstrengungswahl, nicht die Kraft. Das gehoert an den Punkt, nicht
         in eine Fussnote. */
      m.series = E.sessions.filter(function (s) { return s.e1rm != null; }).map(function (s) { return { date: s.date, value: s.e1rm, test: !!s.test, testWeight: s.test ? s.test.weight : null, effort: !!(s.best && (s.best.rir != null || s.best.rpe != null)) }; });`);
rep(F,
`      var inWin = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      if (inWin.length >= 2) { var first = inWin[0]; m.delta = { kg: r1(m.current - first.value), weeks: Math.max(1, Math.round((_d(last.date) - _d(first.date)) / DAY / 7)), from: first.date }; }`,
`      var inWin = from != null ? m.series.filter(function (p) { return _d(p.date) >= from; }) : m.series;
      if (inWin.length >= 2) { var first = inWin[0]; m.delta = { kg: r1(m.current - first.value), weeks: Math.max(1, Math.round((_d(last.date) - _d(first.date)) / DAY / 7)), from: first.date }; }
      m.trend = trendOf(inWin);
      m.effortKnown = m.series.filter(function (p) { return p.effort; }).length;
      m.effortUnknown = m.series.length - m.effortKnown;`);

/* Stagnation: flache Steigung statt Gleichheit. */
rep(F,
`      /* Stagnation: Satz 1 (Top-Satz) über STAG_SESSIONS Einheiten unverändert */
      try { var SP = o.strengthProgression; if (SP && SP.isStagnant) { var hist = hs.map(function (s) { return { sets: s.sets.filter(function (x) { return x.work; }).map(function (x, i) { return { setNumber: i `,
`      /* v8-389 (S2-B3): Stagnation an der STEIGUNG, nicht an Gleichheit. Die alte
         Regel verlangte Gewicht UND Wiederholungen des ersten Satzes ueber drei
         Einheiten unveraendert — reale Saetze streuen, also feuerte sie nie (an den
         echten Daten: 0 von 6 Uebungen, obwohl die Brustpresse seit 9 Wochen auf
         80 kg steht). Jetzt: flache Ausgleichsgerade ueber mindestens 4 Punkte und
         4 Wochen gilt als Plateau. Schwelle relativ zum Niveau (1 %, mind. 0,5 kg),
         damit sie bei 40 kg und bei 140 kg dasselbe bedeutet. */
      if (m.trend && m.trend.ok && m.trend.points >= STAG_MIN_POINTS && m.trend.spanDays >= STAG_MIN_DAYS && m.current != null) {
        var flat = Math.max(0.5, Math.abs(m.current) * 0.01);
        if (Math.abs(m.trend.per4Weeks) < flat) { m.stagnant = true; m.stagnantBy = 'trend'; }
      }
      try { var SP = o.strengthProgression; if (SP && SP.isStagnant) { var hist = hs.map(function (s) { return { sets: s.sets.filter(function (x) { return x.work; }).map(function (x, i) { return { setNumber: i `);
console.log('ok');
