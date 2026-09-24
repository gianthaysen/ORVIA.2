const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const S='app/js/screens/strength-profile.js';
/* PR-Titel traegt die Zusatzlast — „14 Wdh." und „9 Wdh." sind ohne sie derselbe Titel. */
rep(S,
`      var t = T('kp.pr_' + p.kind), sub = p.kind === 'volume_week'`,
`      var t = T('kp.pr_' + p.kind);
      /* v8-389 (S2-B4): Zwei Wdh.-Rekorde unterscheiden sich nur durch ihre Last. */
      if (p.kind === 'max_reps' && p.addedKg != null) t += p.addedKg > 0 ? ' (+' + kg(p.addedKg) + ' kg)' : ' (' + T('kp.ohne_zusatz') + ')';
      var sub = p.kind === 'volume_week'`);
console.log('ok');
