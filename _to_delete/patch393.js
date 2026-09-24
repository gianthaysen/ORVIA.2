const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,90)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous'); fs.writeFileSync(file, s.replace(from,to)); }
const S='app/js/screens/strength-profile.js';
const line = fs.readFileSync(S,'utf8').split('\n').find(l=>l.indexOf('var best = null; m.exercises.forEach')>=0);
if(!line) throw new Error('teaser-Zeile nicht gefunden');
rep(S, line,
`      /* v8-393: Der Teaser waehlt die Uebung nach der STEIGUNG, nicht nach der
         Rohdifferenz, und gibt sie auch so weiter. Sonst stuende in der Analyse
         weiterhin „+5,4 kg in 5 Wochen", waehrend die Detailseite derselben Uebung
         „+0,8 kg je 4 Wochen" zeigt — zwei Aussagen zu denselben Daten. */
      var best = null, bestEm = null;
      m.exercises.forEach(function (E) {
        if (!E.ready || E.mode !== 'load') return;
        var em = m.exerciseModel(E.key); if (!em || em.current == null) return;
        var tr = em.trend && em.trend.ok && !em.trend.implausible ? em.trend : null;
        var score = tr ? tr.per4Weeks : -Infinity;
        var bScore = (bestEm && bestEm.trend && bestEm.trend.ok && !bestEm.trend.implausible) ? bestEm.trend.per4Weeks : -Infinity;
        if (!best || score > bScore) { best = E; bestEm = em; }
      });
      if (bestEm) { best = { name: bestEm.name, current: bestEm.current, trend: bestEm.trend && bestEm.trend.ok ? bestEm.trend : null }; }`);
rep(S,
`      return { empty: false, loading: _loading, sessions: m.sessions, exercise: best ? best.name : null, current: best ? best.current : null, delta: best && best.delta ? best.delta : null, under: unde`,
`      return { empty: false, loading: _loading, sessions: m.sessions, exercise: best ? best.name : null, current: best ? best.current : null, trend: best ? best.trend : null, under: unde`);
/* ui.js: Trendtext statt Rohdifferenz */
rep('app/js/ui.js',
`    var parts=[];if(t.delta)parts.push(_uiT('kp.teaser_delta',{d:(t.delta.kg>=0?'+':'−')+String(Math.abs(t.delta.kg)).replace('.',','),w:t.delta.weeks}));`,
`    var parts=[];
    if(t.trend&&t.trend.ok)parts.push(_uiT('kp.teaser_trend',{
      d:(t.trend.confidence==='low'?'≈':'')+(t.trend.per4Weeks>=0?'+':'−')+String(Math.abs(t.trend.per4Weeks)).replace('.',',')}));`);
console.log('ok');
