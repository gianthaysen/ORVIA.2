const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';
rep(F,
`    E_BW_FLAG.on = false; E_BW_FLAG.anyLoaded = false;
    E.tests =`,
`    E_BW_FLAG.on = false; E_BW_FLAG.anyLoaded = false;
    /* v8-389 (S2-B5): Schwerster Arbeitssatz der Uebung — Massstab dafuer, ob ein als
       „test" markierter Satz wirklich ein Maximalversuch war (s. exerciseModel). */
    E.heaviestWork = null;
    E.sessions.forEach(function (s) { s.sets.forEach(function (x) { if (x.work && x.weight != null && (E.heaviestWork == null || x.weight > E.heaviestWork)) E.heaviestWork = x.weight; }); });
    E.sessions.forEach(function (s) { s.testIsReal = !!(s.test && s.test.weight != null && (E.heaviestWork == null || s.test.weight > E.heaviestWork)); });
    E.tests =`);
rep(F,
`      var heaviestWork = null;
      E.sessions.forEach(function (s) { s.sets.forEach(function (x) { if (x.work && x.weight != null && (heaviestWork == null || x.weight > heaviestWork)) heaviestWork = x.weight; }); });
      var testIsReal = !!(bestT && (heaviestWork == null || bestT.weight > heaviestWork));`,
`      var testIsReal = !!(bestT && (E.heaviestWork == null || bestT.weight > E.heaviestWork));`);
console.log('ok');
