const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';

/* Fenster am letzten Datenpunkt verankern, nicht an heute. */
rep(F,
`  function exerciseModel(E, opts) {
    var o = opts || {}, today = _d(o.today), from = today != null ? today - WINDOW_WEEKS * 7 * DAY : null;`,
`  function exerciseModel(E, opts) {
    var o = opts || {}, today = _d(o.today);
    /* v8-389 (S2-B2): Das Auswertungsfenster haengt am LETZTEN Datenpunkt, nicht am
       Kalendertag. Sonst schneidet eine Trainingspause die aeltere Haelfte der Reihe
       weg und die Steigung kippt: an den echten Daten meldete das kalendergebundene
       Fenster fuer die Brustpresse +6 kg je 4 Wochen (6 Punkte ab 20.07.), waehrend
       ueber die vollen 9 Wochen +0,75 kg je 4 Wochen stehen — Rauschen. Die Pause
       selbst ist eine eigene Aussage (staleDays), keine Trendaenderung. */
    var lastDate = null;
    E.sessions.forEach(function (s) { if (s.workSets > 0 && (lastDate == null || _d(s.date) > lastDate)) lastDate = _d(s.date); });
    var anchor = (lastDate != null && today != null) ? Math.min(today, lastDate) : today;
    var from = anchor != null ? anchor - WINDOW_WEEKS * 7 * DAY : null;`);

/* staleDays + Vertrauensgrad der Steigung. */
rep(F,
`      m.trend = trendOf(inWin);
      m.effortKnown = m.series.filter(function (p) { return p.effort; }).length;
      m.effortUnknown = m.series.length - m.effortKnown;`,
`      m.trend = trendOf(inWin);
      m.effortKnown = m.series.filter(function (p) { return p.effort; }).length;
      m.effortUnknown = m.series.length - m.effortKnown;
      /* v8-389 (S2-B1): Vertrauensgrad der Steigung. Epley setzt Ausbelastung voraus.
         Tragen weniger als die Haelfte der Punkte eine RIR/RPE-Angabe, misst die Kurve
         ueberwiegend die Anstrengungswahl — die Zahl bleibt sichtbar, aber sie wird
         als das ausgewiesen, was sie ist. Unterdruecken waere ebenso unehrlich wie
         sie als Kraftzuwachs zu verkaufen. */
      if (m.trend && m.trend.ok) m.trend.confidence = (m.trend.effortKnown * 2 >= m.trend.points && m.trend.effortKnown >= 2) ? 'ok' : 'low';
      if (lastDate != null && today != null) m.staleDays = Math.max(0, Math.round((today - lastDate) / DAY));`);
console.log('ok');
