/* ORVIA · gym-volume — Shadow-Muskelvolumen-Engine (Inkrement 2C). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const G = (await import(new URL('../../js/gym-volume.js', import.meta.url))).default;

function set(o) { return Object.assign({ setType: 'working', completed: true, weight: 70, reps: 10 }, o); }
// Bankdrücken 3 Arbeitssätze (+1 Aufwärm), Kniebeuge 3 Arbeitssätze
const snap = [{
  workoutId: 'w1', startedAt: '2026-06-27T10:00:00Z', exercises: [
    { exerciseId: 'bench_press', exerciseNameSnapshot: 'Brustpresse', sets: [set({ setType: 'warmup', weight: 40 }), set(), set({ reps: 9 }), set({ weight: 65 })] },
    { exerciseId: 'squat', exerciseNameSnapshot: 'Kniebeuge', sets: [set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5 })] }
  ]
}];

// --- Zählregeln ---
ok('Aufwärmsatz zählt NICHT (3 reale statt 4)', G.realSetsOf(snap[0].exercises[0]) === 3);
ok('unvollständiger Satz zählt nicht', G.isCountable({ setType: 'working', completed: false, weight: 70, reps: 10 }) === false);
ok('leere Satzzeile zählt nicht', G.isCountable({ setType: 'working', completed: true }) === false);
ok('Arbeitssatz zählt', G.isCountable(set()) === true);

const vol = G.computeMuscleVolume(snap);
// --- Strikte Trennung ---
ok('Brust direct = 3 reale Sätze', vol.chest.directSets === 3);
ok('Brust effektive = 3 (direkt)', vol.chest.effectiveSets === 3);
ok('Trizeps indirekt aus Bankdrücken = 3×0.5 = 1.5', vol.triceps.indirectSetEquivalents === 1.5);
ok('Trizeps directSets = 0', vol.triceps.directSets === 0);
ok('Trizeps effektive = 1.5 (nur indirekt)', vol.triceps.effectiveSets === 1.5);
ok('front_delts indirekt aus Bankdrücken = 1.5', vol.front_delts.effectiveSets === 1.5);
ok('Quadrizeps direct aus Kniebeuge = 3', vol.quads.directSets === 3 && vol.quads.effectiveSets === 3);
ok('Glutes indirekt aus Kniebeuge = 1.5', vol.glutes.effectiveSets === 1.5);
ok('realWorkingSets ≠ effectiveSets (Trizeps: 3 vs 1.5)', vol.triceps.realWorkingSets === 3 && vol.triceps.effectiveSets === 1.5);

// --- Rückführbarkeit: jeder Dezimalwert über explainMuscleVolume ---
const ex = G.explainMuscleVolume('triceps', snap, { days: 7 });
ok('explain: effectiveSets 1.5', ex.effectiveSets === 1.5);
ok('explain: Beitrag rückführbar auf Brustpresse', ex.contributions.length === 1 && ex.contributions[0].exercise === 'Brustpresse' && ex.contributions[0].realSets === 3 && ex.contributions[0].coefficient === 0.5);
ok('explain: Summe der Beiträge = effectiveSets', ex.contributions.reduce((a, c) => a + c.contribution, 0) === ex.effectiveSets);
ok('explain: workoutId rückführbar', ex.contributions[0].workoutId === 'w1');
const exQ = G.explainMuscleVolume('quads', snap, { days: 7 });
ok('explain quads: 3 effektiv, contribution 3', exQ.effectiveSets === 3 && exQ.contributions[0].contribution === 3);

// --- Wochen-Äquivalent ---
ok('weeklyEquivalent: 1.5 über 7 Tage = 1.5', G.weeklyEquivalent(1.5, 7) === 1.5);
ok('weeklyEquivalent: 6 über 3 Tage = 14', G.weeklyEquivalent(6, 3) === 14);
ok('explain liefert effectiveSetsPerWeek', G.explainMuscleVolume('quads', snap, { days: 3 }).effectiveSetsPerWeek === 7);

// --- Pattern-Fallback + unbekannte Übung ---
const snapPat = [{ workoutId: 'w2', exercises: [{ movementPattern: 'horizontal_pull', sets: [set(), set()] }] }];
ok('Movement-Pattern-Fallback (horizontal_pull → upper_back direct)', G.computeMuscleVolume(snapPat).upper_back.directSets === 2);
const snapUnknown = [{ workoutId: 'w3', exercises: [{ exerciseId: 'quidditch_throw', sets: [set(), set()] }] }];
ok('unbekannte Übung ohne Pattern → KEINE erfundene Zuordnung', Object.keys(G.computeMuscleVolume(snapUnknown)).length === 0);

// --- compareToLegacy (Shadow-Verifikation) ---
const cmp = G.compareToLegacy(snap, { chest: 3, triceps: 2.0 });
ok('compare chest: shadow 3 vs legacy 3, delta 0', cmp.chest.shadow === 3 && cmp.chest.legacy === 3 && cmp.chest.delta === 0);
ok('compare triceps: delta zeigt Abweichung', cmp.triceps.shadow === 1.5 && cmp.triceps.legacy === 2.0 && cmp.triceps.delta === -0.5);

// --- keine universelle Satzregel: Koeffizient hängt an Übung/Muster, nicht an fixem Limit ---
ok('Bankdrücken: Brust direct, Trizeps indirekt (übungsspezifisch)', G.musclesFor({ exerciseId: 'bench_press' }).chest === 'direct' && G.musclesFor({ exerciseId: 'bench_press' }).triceps === 'indirect');

// --- nicht mutierend ---
ok('computeMuscleVolume mutiert Eingabe nicht', (function () { var cp = JSON.stringify(snap); G.computeMuscleVolume(snap); return JSON.stringify(snap) === cp; })());

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
