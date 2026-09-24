const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const S='app/js/screens/strength-profile.js';

/* Kopfzeile: Steigung statt Rohdifferenz; Rohdifferenz entfaellt als Hauptaussage. */
rep(S,
`      var dtx = em.delta ? ((em.delta.kg === 0 ? '±' : em.delta.kg > 0 ? '+' : '−') + kg(Math.abs(em.delta.kg)) + ' kg ' + T('kp.in_n_wochen', { n: em.delta.weeks })) : '';`,
`      /* v8-389 (S2-B2): Die Kopfzahl ist die STEIGUNG je 4 Wochen, nicht der Abstand zum
         ersten Punkt eines wandernden Fensters. Fehlt die Steigung, steht dort nichts —
         eine Rohdifferenz waere eine Aussage, die die Daten nicht tragen. */
      var tr = em.trend && em.trend.ok ? em.trend : null;
      var dtx = tr ? ((tr.per4Weeks === 0 ? '±' : tr.per4Weeks > 0 ? '+' : '−') + kg(Math.abs(tr.per4Weeks)) + ' ' + T('kp.kg_je_4w')) : '';`);
rep(S,
`(dtx ? '<span class="kp-delta' + (em.delta.kg < 0 ? ' dn' : '') + '">' + esc(dtx) + '</sp`,
`(dtx ? '<span class="kp-delta' + (tr.per4Weeks < 0 ? ' dn' : '') + (tr.confidence === 'low' || tr.implausible ? ' unsure' : '') + '">' + esc(dtx) + '</sp`);

/* Datenbasis, Ausbelastung, Pause, Unplausibilitaet — unter der Kurve. */
rep(S,
`      if (em.stagnant) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.stagnation_t')) + '</b> ' + esc(T(D.jargon ? 'kp.stagnation_d' : 'kp.stagnation_d_einfach')) + '</div></div>';`,
`      /* v8-389 (S2-B1/B2): Worauf die Zahl beruht — Punkte, Spanne, Ausbelastung. Ohne das
         liest sich eine Steigung wie eine Messung, obwohl sie eine Schaetzung aus wenigen
         Punkten ist. */
      if (tr && D.meta) h += '<div class="kp-meta">' + esc(T('kp.trend_basis', { n: tr.points, d: tr.spanDays })) + '</div>';
      if (em.trend && !em.trend.ok && em.series.length >= 2) h += '<div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T(em.trend.reason === 'short_span' ? 'kp.trend_kurz' : 'kp.trend_wenig')) + '</div></div>';
      if (tr && tr.implausible) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.trend_unplausibel_t')) + '</b> ' + esc(T('kp.trend_unplausibel_d')) + '</div></div>';
      else if (tr && tr.confidence === 'low') h += '<div class="kp-note">' + ic('info', 'sm') + '<div><b>' + esc(T('kp.effort_t')) + '</b> ' + esc(T('kp.effort_d', { k: em.effortKnown, n: em.effortKnown + em.effortUnknown })) + '</div></div>';
      if (em.staleDays != null && em.staleDays >= 14) h += '<div class="kp-note">' + ic('calendar', 'sm') + '<div>' + esc(T('kp.stale_d', { d: em.staleDays })) + '</div></div>';
      if (em.stagnant) h += '<div class="kp-note att">' + ic('alert', 'sm') + '<div><b>' + esc(T('kp.stagnation_t')) + '</b> ' + esc(T(em.stagnantBy === 'trend' ? 'kp.stagnation_trend_d' : (D.jargon ? 'kp.stagnation_d' : 'kp.stagnation_d_einfach'))) + '</div></div>';`);

/* reps-Modus: Zusatzlast sichtbar, Delta nur bei gleicher Last. */
rep(S,
`      if (em.lastScheme) h += '<div class="kp-meta">' + esc(T('kp.letzter_satz') + ': ' + em.lastScheme) + '</div>';
      h += chart(em, m);
      h += src(T('kp.src_reps'));`,
`      if (em.lastScheme) h += '<div class="kp-meta">' + esc(T('kp.letzter_satz') + ': ' + em.lastScheme) + '</div>';
      h += chart(em, m);
      /* v8-389 (S2-B4): Eine Wdh.-Zahl ohne ihre Zusatzlast ist nicht lesbar. */
      if (em.currentLoadKg != null) h += '<div class="kp-meta">' + esc(em.currentLoadKg > 0 ? T('kp.reps_mit_last', { v: kg(em.currentLoadKg) }) : T('kp.reps_ohne_last')) + '</div>';
      if (em.deltaBlocked === 'load_changed') h += '<div class="kp-note">' + ic('info', 'sm') + '<div>' + esc(T('kp.reps_last_gewechselt', { a: kg(em.deltaLoadFrom), b: kg(em.deltaLoadTo) })) + '</div></div>';
      h += src(T('kp.src_reps'));`);
console.log('ok');
