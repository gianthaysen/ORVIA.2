const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
const F='app/js/engine/strength-profile.js';
rep(F,
`    var pp = ratio(push, pull), lu = ratio(legs, upper);`,
`    var pp = ratio(push, pull), lu = ratio(legs, upper);
    /* v8-389 (S2-B6b): „keine Beinsaetze" ist eine AUSSAGE, kein fehlender Wert. Solange
       die Zuordnung den Rueckenstrecker zu den Beinen zaehlte, kam nie eine Null zustande;
       seit die Gruppe dem direkt belasteten Muskel folgt, schon — und dann meldete die
       Zeile „zu wenig Daten", obwohl acht Einheiten mit 84 Oberkoerpersaetzen vorliegen.
       Bei belegter Oberkoerperarbeit und null Beinsaetzen ist das Verhaeltnis 0, nicht
       unbekannt. */
    var legsZero = (legs === 0 && upper > 0);
    if (legsZero) lu = 0;`);
rep(F,
`      legsUpper: { ratio: lu, a: legs, b: upper, lo: 0.8, hi: 1.5, status: lu == null ? 'none' : (legsBlocked ? 'blocked' : (lu >= 0.8 ? 'ok' : 'att')), blocked: legsBlocked, injuryLabel: legsBlocked `,
`      legsUpper: { ratio: lu, a: legs, b: upper, lo: 0.8, hi: 1.5, zero: legsZero, status: lu == null ? 'none' : (legsBlocked ? 'blocked' : (lu >= 0.8 ? 'ok' : 'att')), blocked: legsBlocked, injuryLabel: legsBlocked `);
console.log('ok');
