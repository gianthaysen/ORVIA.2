const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';
rep(F,
`          /* v8-389 (S2-B6): Bei Gleichstand entscheidet der DIREKT belastete Muskel.
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
          if (best) return best;`,
`          /* v8-389 (S2-B6): Die Gruppe folgt dem DIREKT belasteten Muskel. Vorher wurden
             nur Koeffizienten summiert — damit konnten mehrere indirekte Anteile einen
             direkten Muskel ueberstimmen: der Rueckenstrecker traegt lower_back direkt
             (1,0 → core) gegen glutes 0,6 + hamstrings 0,5 (1,1 → legs) und stand
             deshalb unter „Beine". Folge an echten Daten: die Balance-Zeile
             „Beine : Oberkoerper" stuetzte sich ausschliesslich auf Rueckenstrecker-Saetze,
             obwohl es in neun Wochen null Beinsaetze gab — die Warnung war richtig, ihre
             Zahl nicht. Nur wenn KEIN Muskel direkt belastet wird, entscheidet die Summe. */
          var score = {}, direct = {}, best = null, bestDirect = null;
          Object.keys(mus).forEach(function (mk) {
            var g = MUSCLE_GROUP[mk]; if (!g) return;
            var raw = mus[mk], c = gv.coeffOf ? gv.coeffOf(raw) : 1;
            score[g] = (score[g] || 0) + c;
            if (raw === 'direct') direct[g] = (direct[g] || 0) + c;
          });
          Object.keys(direct).forEach(function (g) { if (!bestDirect || direct[g] > direct[bestDirect]) bestDirect = g; });
          if (bestDirect) return bestDirect;
          Object.keys(score).forEach(function (g) { if (!best || score[g] > score[best]) best = g; });
          if (best) return best;`);
console.log('ok');
