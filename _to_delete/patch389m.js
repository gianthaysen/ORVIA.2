const fs=require('fs');const F='app/js/screens/strength-profile.js';let s=fs.readFileSync(F,'utf8');
const a = "    try { var P = root.PROFILE || null; if (P) { var w = null; try { w = O.profileModel && O.profileModel.currentWeightKg ? O.profileModel.currentWeightKg(P.performance) : null; } catch (e) {} if (w == null && P.personal) w = P.personal.weightKg; ctx.bodyweight = (typeof w === 'number' && w > 0) ? w : null; } } catch (e) {}";
const b = [
"    /* v8-389 (S2-B1b): Koerpergewicht kommt aus dem MORGENBERICHT (nuechtern, taeglich",
"       gepflegt) und wird als Reihe uebergeben — jede Einheit rechnet mit dem Gewicht",
"       IHRES Tages. Vorher stand hier nur der Profilwert: eine Klimmzugreihe ueber drei",
"       Monate nahm das heutige Gewicht auch fuer Einheiten im Juni, und relative Kraft",
"       rechnete gegen einen Wert, der Wochen alt sein konnte. Der Profilverlauf bleibt",
"       Rueckfall, wenn kein Morgenwert vorliegt. */",
"    try {",
"      var P = root.PROFILE || null, PM = O.profileModel;",
"      var morning = null;",
"      try { morning = (O.checkinStore && O.checkinStore.morningWeightSeries) ? O.checkinStore.morningWeightSeries(365) : null; } catch (e) {}",
"      if (PM && PM.weightSeries) ctx.bodyweightSeries = PM.weightSeries(P ? P.performance : null, morning);",
"      var w = null;",
"      try { w = (PM && PM.currentWeightKg) ? PM.currentWeightKg(P ? P.performance : null, ctx.bodyweightSeries) : null; } catch (e) {}",
"      if (w == null && P && P.personal) w = P.personal.weightKg;",
"      ctx.bodyweight = (typeof w === 'number' && w > 0) ? w : null;",
"    } catch (e) {}"
].join('\n');
if(s.indexOf(a)<0) throw new Error('nf'); s=s.replace(a,b);
const c = "var ctx = { today: null, snapshots: [], bodyweight: null, experience: 'beginner', goals: [], injury: null, ready: false, error: null };";
const d = "var ctx = { today: null, snapshots: [], bodyweight: null, bodyweightSeries: null, experience: 'beginner', goals: [], injury: null, ready: false, error: null };";
if(s.indexOf(c)<0) throw new Error('nf2'); s=s.replace(c,d);
const e = "bodyweightKg: ctx.bodyweight, experience: ctx.experience, goals: ctx.goals, i";
const f = "bodyweightKg: ctx.bodyweight, bodyweightSeries: ctx.bodyweightSeries, experience: ctx.experience, goals: ctx.goals, i";
if(s.indexOf(e)<0) throw new Error('nf3'); s=s.replace(e,f);
fs.writeFileSync(F,s); console.log('ok');
