const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';

/* B6: Gleichstand zugunsten des DIREKT belasteten Muskels aufloesen. */
rep(F,
`        var mus = gv.musclesFor(ex);
        if (mus) {
          var score = {}, best = null;
          Object.keys(mus).forEach(function (mk) { var g = MUSCLE_GROUP[mk]; if (!g) return; var c = gv.coeffOf ? gv.coeffOf(mus[mk]) : 1; score[g] = (score[g] || 0) + c; });
          Object.keys(score).forEach(function (g) { if (!best || score[g] > score[best]) best = g; });
          if (best) return best;`,
`        var mus = gv.musclesFor(ex);
        if (mus) {
          /* v8-389 (S2-B6): Bei Gleichstand entscheidet der DIREKT belastete Muskel.
             Vorher summierte die Zuordnung nur Koeffizienten: der Rueckenstrecker traegt
             lower_back direkt (1,0 = core) gegen glutes + hamstrings indirekt (je 0,5 =
             legs) — legs gewann den Gleichstand und die Uebung stand unter „Beine".
             Folge an echten Daten: die Balance-Zeile „Beine : Oberkoerper" stuetzte sich
             ausschliesslich auf Rueckenstrecker-Saetze, obwohl es null Beinsaetze gab. */
          var score = {}, direct = {}, best = null;
          Object.keys(mus).forEach(function (mk) {
            var g = MUSCLE_GROUP[mk]; if (!g) return;
            var raw = mus[mk], c = gv.coeffOf ? gv.coeffOf(raw) : 1;
            score[g] = (score[g] || 0) + c;
            if (raw === 'direct' || c >= 1) direct[g] = (direct[g] || 0) + c;
          });
          Object.keys(score).forEach(function (g) {
            if (!best) { best = g; return; }
            if (score[g] > score[best]) { best = g; return; }
            if (score[g] === score[best] && (direct[g] || 0) > (direct[best] || 0)) best = g;
          });
          if (best) return best;`);

/* B5: Test-Satz zaehlt nur als 1RM-Test, wenn er den besten Arbeitssatz uebertrifft. */
rep(F,
`      var lastT = E.tests[E.tests.length - 1]; m.lastTest = lastT || null;
      var bestT = null; E.tests.forEach(function (t) { if (!bestT || t.weight > bestT.weight) bestT = t; });
      if (bestT) m.prs.push({ kind: 'test', date: bestT.date, value: bestT.weight, unit: 'kg' });`,
`      var lastT = E.tests[E.tests.length - 1];
      var bestT = null; E.tests.forEach(function (t) { if (!bestT || t.weight > bestT.weight) bestT = t; });
      /* v8-389 (S2-B5): Ein als „test" markierter Satz ist nur dann ein 1RM-Test, wenn er
         schwerer war als der beste Arbeitssatz. An den echten Daten stand sonst
         „1RM-Test 7,5 kg" unter den Bestwerten des Seithebens — die LEICHTESTE je
         geloggte Last dieser Uebung (Arbeitssaetze 12,5 kg). Ein Aufwaerm- oder
         Technikversuch ist kein Rekord. */
      var heaviestWork = null;
      E.sessions.forEach(function (s) { s.sets.forEach(function (x) { if (x.work && x.weight != null && (heaviestWork == null || x.weight > heaviestWork)) heaviestWork = x.weight; }); });
      var testIsReal = !!(bestT && (heaviestWork == null || bestT.weight > heaviestWork));
      m.lastTest = (lastT && testIsReal) ? lastT : null;
      if (testIsReal) m.prs.push({ kind: 'test', date: bestT.date, value: bestT.weight, unit: 'kg' });`);

/* Kurvenmarkierung „Test" folgt derselben Regel. */
rep(F,
`, test: !!s.test, testWeight: s.test ? s.test.weight : null, effort:`,
`, test: !!(s.test && s.testIsReal), testWeight: s.test ? s.test.weight : null, effort:`);
console.log('ok');
