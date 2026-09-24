const fs=require('fs');const F='app/js/engine/strength-profile.js';let s=fs.readFileSync(F,'utf8');
const a='m.stagnant = E.ready && SP.isStagnant(hist, 1, STAG_SESSIONS);';
const b="var legacy = E.ready && SP.isStagnant(hist, 1, STAG_SESSIONS); if (legacy && !m.stagnant) { m.stagnant = true; m.stagnantBy = m.stagnantBy || 'top_set'; }";
if(s.indexOf(a)<0) throw new Error('nf1'); s=s.replace(a,b);
const c = "    return { ok: true, perDay: perDay, per4Weeks: r1(perDay * 28), points: n, spanDays: spanDays,\n      effortKnown: known, effortUnknown: n - known };";
const d = [
"    var per4 = r1(perDay * 28), levelRef = Math.abs(ys[ys.length - 1]) || 1;",
"    /* v8-389: Eine Kurve, die sich je 4 Wochen um mehr als 15 % des Niveaus bewegt, bildet",
"       keine Kraftanpassung ab — so schnell veraendert sich Maximalkraft nicht. Real steckt",
"       dahinter fast immer ein Geraetewechsel (andere Steckgewichte, anderer Hebel) oder",
"       stark unterschiedliche Ausbelastung. Die Zahl wird nicht unterdrueckt, aber als",
"       unplausibel ausgewiesen, damit die Seite sie nicht als Fortschritt verkauft. */",
"    var implausible = Math.abs(per4) > 0.15 * levelRef;",
"    return { ok: true, perDay: perDay, per4Weeks: per4, points: n, spanDays: spanDays,",
"      effortKnown: known, effortUnknown: n - known, implausible: implausible };"
].join('\n');
if(s.indexOf(c)<0) throw new Error('nf2'); s=s.replace(c,d);
fs.writeFileSync(F,s); console.log('ok');
