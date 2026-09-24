const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found: '+from.slice(0,80)); fs.writeFileSync(file, s.replace(from,to)); }
/* Koerpergewichtsuebung: e1RM-Kurve nur, wenn ALLE Einheiten Zusatzlast tragen. */
rep('app/js/engine/strength-profile.js',
`    E.mode = (withE.length >= 2 && withE.length * 2 >= E.sessions.length) ? 'load' : (withDur.length && !withReps.length ? 'time' : (withReps.length ? 'reps' : (withE.length ? 'load' : 'none')));`,
`    /* v8-389 (S2-B4): Bei einer Koerpergewichtsuebung mit GEMISCHTER Zusatzlast bleibt die
       Wiederholungsachse die ehrliche Darstellung. Eine e1RM-Kurve wuerde dort nur die
       belasteten Einheiten zeigen und die uebrigen stillschweigend weglassen — bei
       Klimmzuegen mit 12/14 Wdh. ohne Zusatz und 7/9 Wdh. mit +10 kg waeren das die
       Haelfte der Einheiten. Erst wenn jede Einheit Zusatzlast traegt, ist die Last die
       gemeinsame Achse. */
    var loadedSess = E.sessions.filter(function (s) { return s.workSets > 0 && s.sets.some(function (x) { return x.work && x.weight != null && x.weight > 0; }); }).length;
    var workSess = E.sessions.filter(function (s) { return s.workSets > 0; }).length;
    var bwMixed = !!E.bodyweight && loadedSess > 0 && loadedSess < workSess;
    E.mode = (!bwMixed && withE.length >= 2 && withE.length * 2 >= E.sessions.length) ? 'load'
      : (withDur.length && !withReps.length ? 'time' : (withReps.length ? 'reps' : (withE.length && !bwMixed ? 'load' : 'none')));`);
/* Testfixture F20: Oberkoerperarbeit ergaenzen, damit „null Beinsaetze" ueberhaupt aussagbar ist. */
rep('supabase/tests/strength_profile_test.mjs',
`      sets: [{ completed: true, weight: 25, reps: 10 }] }] }];`,
`      sets: [{ completed: true, weight: 25, reps: 10 }] },
      { exerciseNameSnapshot: 'Bankdrücken', sets: [{ completed: true, weight: 60, reps: 8 }, { completed: true, weight: 60, reps: 8 }] }] }];`);
rep('supabase/tests/strength_profile_test.mjs',
`    mBe.exercises[0].group === 'core', 'group=' + mBe.exercises[0].group);`,
`    mBe.exercises.filter(function (E) { return /Rücken/.test(E.name); })[0].group === 'core',
    JSON.stringify(mBe.exercises.map(function (E) { return E.name + '=' + E.group; })));`);
console.log('ok');
