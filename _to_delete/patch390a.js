const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous'); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/performance-resolver.js';
rep(F,
`    /* Harte Läufe aus den Aktivitäten — abgeleitet, nie gemessen. */
    (Array.isArray(o.activities) ? o.activities : []).forEach(function (a) {
      if (!a) return;
      var sid = String(a.sportId || a.sport || '').toLowerCase();
      if (sid && sid.indexOf('run') < 0 && sid !== 'running' && sid !== 'laufen') return;
      var km = a.distanceKm != null ? a.distanceKm : (a.distanceM > 0 ? a.distanceM / 1000 : null);
      var min = a.durationMin != null ? a.durationMin : (a.durationSec > 0 ? a.durationSec / 60 : null);
      if (!(km > 0) || !(min > 0)) return;
      var lbl = String(a.subType || a.label || a.name || '').toLowerCase();`,
`    /* Harte Läufe aus den Aktivitäten — abgeleitet, nie gemessen.

       v8-390 (P0): Dieser Block las Distanz, Dauer und Datum AUSSCHLIESSLICH in der
       Legacy-/Testform (a.distanceKm, a.durationMin/durationSec, a.date/localDate). Die
       KANONISCHEN Aktivitäten aus activityStore.listActivities() — genau die, die ui.js
       hier hereinreicht - tragen Distanz unter summary.distanceKm, die Dauer als
       durationSeconds und das Datum als startedAt. Folge: km und min blieben null, der
       Guard verwarf JEDE echte Aktivität, und workouts war im Produktivpfad immer leer.
       Die Leistungszonen stützten sich damit nur auf Tests und die Zielzeit; die
       „harten Läufe" waren eine Rubrik ohne Inhalt.
       Dieselbe Fehlerklasse wie im capacity-adapter (sportId vs. sport, P0 2026-08-06)
       und in load-history (durationSeconds/startedAt, v8-389). Kanonisch zuerst,
       Legacy-/Testform als Rückfall — nichts erfunden, nur beide Namen gelesen. */
    (Array.isArray(o.activities) ? o.activities : []).forEach(function (a) {
      if (!a) return;
      var sid = String(a.sportId || a.sport || '').toLowerCase();
      if (sid && sid.indexOf('run') < 0 && sid !== 'running' && sid !== 'laufen') return;
      var sum = (a.summary && typeof a.summary === 'object') ? a.summary : {};
      var km = sum.distanceKm != null ? sum.distanceKm
        : (sum.distanceM > 0 ? sum.distanceM / 1000
          : (a.distanceKm != null ? a.distanceKm : (a.distanceM > 0 ? a.distanceM / 1000 : null)));
      var min = a.durationSeconds > 0 ? a.durationSeconds / 60
        : (a.durationMin != null ? a.durationMin : (a.durationSec > 0 ? a.durationSec / 60 : null));
      if (!(km > 0) || !(min > 0)) return;
      var lbl = String(a.subType || a.label || a.name || sum.name || (a.metrics && a.metrics.name) || '').toLowerCase();`);
rep(F,
`      workouts.push({ distanceKm: km, durationMin: min, date: a.date || a.localDate || null, type: type });`,
`      workouts.push({ distanceKm: km, durationMin: min,
        date: (a.startedAt ? String(a.startedAt).slice(0, 10) : (a.date || a.localDate || null)), type: type });`);
console.log('ok');
