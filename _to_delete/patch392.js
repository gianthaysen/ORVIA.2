const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous'); fs.writeFileSync(file, s.replace(from,to)); }
const S='app/js/screens/strength-profile.js';
rep(S,
`    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p).toFixed(1) + ' ' + y(p.value).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts[pts.length - 1]).toFixed(1) + ' ' + (H - P.b) + ' L' + P.l + ' ' + (H - P.b) + ' Z';`,
`    /* v8-392 (S2-B4b): Die Linie wird an jedem LASTWECHSEL unterbrochen. Zahlen und
       Rekorde waren seit v8-389 nach Zusatzlast getrennt, die Kurve aber nicht: sie
       verband 13 Wiederholungen ohne Zusatz mit 7 Wiederholungen unter +10 kg zu einem
       steilen Absturz und behauptete damit genau die Vergleichbarkeit, die die Zahlen
       darunter bestreiten. Eine Lücke in der Linie sagt: hier ist kein Vergleich. */
    var segs = [], cur = [];
    pts.forEach(function (p, i) {
      if (i > 0 && p.addedKg != null && pts[i - 1].addedKg != null && p.addedKg !== pts[i - 1].addedKg) { if (cur.length) segs.push(cur); cur = []; }
      cur.push(p);
    });
    if (cur.length) segs.push(cur);
    var line = segs.map(function (seg) {
      return seg.map(function (p, i) { return (i ? 'L' : 'M') + x(p).toFixed(1) + ' ' + y(p.value).toFixed(1); }).join(' ');
    }).join(' ');
    /* Die Füllfläche folgt nur einer durchgehenden Reihe — bei Lastwechseln entfällt sie,
       weil eine Fläche über eine Lücke hinweg wieder Vergleichbarkeit suggerieren würde. */
    var area = segs.length === 1
      ? line + ' L' + x(pts[pts.length - 1]).toFixed(1) + ' ' + (H - P.b) + ' L' + P.l + ' ' + (H - P.b) + ' Z'
      : '';`);
rep(S,
`      '<path d="' + area + '" fill="url(#kpg)"/><path class="kp-line" d="' + line + '"/>' +`,
`      (area ? '<path d="' + area + '" fill="url(#kpg)"/>' : '') + '<path class="kp-line" d="' + line + '"/>' +`);
/* Punkte mit Zusatzlast sichtbar unterscheiden. */
rep(S,
`      pts.map(function (p, i) { return '<circle class="kp-pt' + (i === sel ? ' on' : '') + (p.test ? ' test' : '') + '"`,
`      pts.map(function (p, i) { return '<circle class="kp-pt' + (i === sel ? ' on' : '') + (p.test ? ' test' : '') + (p.addedKg > 0 ? ' loaded' : '') + '"`);
/* Ablesezeile nennt die Last des gewaehlten Punktes. */
rep(S,
`    var sp = pts[sel]; var unit = em.mode === 'load'`,
`    var sp = pts[sel];
    var spLoad = (em.mode === 'reps' && sp && sp.addedKg != null)
      ? (sp.addedKg > 0 ? ' · +' + kg(sp.addedKg) + ' kg' : ' · ' + T('kp.ohne_zusatz')) : '';
    var unit = em.mode === 'load'`);
rep(S,
`'</div><div class="rm">' + esc(deDateY(s`,
`'</div><div class="rm">' + esc(deDateY(s`);
console.log('ok');
