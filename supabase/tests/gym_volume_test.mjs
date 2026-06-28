/* ORVIA · gym-volume — Muskelvolumen-Engine (Inkrement 2C). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const G = (await import(new URL('../../js/gym-volume.js', import.meta.url))).default;

function set(o) { return Object.assign({ setType: 'working', completed: true, weight: 70, reps: 10 }, o); }
function ex(name, sets, extra) { return Object.assign({ exerciseNameSnapshot: name, sets: sets }, extra || {}); }
const vol = s => G.computeMuscleVolume(s).byMuscle;

// 1–3 Zählregeln
ok('1 Warmup zählt nicht', G.realSetsOf(ex('Bankdrücken', [set({ setType: 'warmup' }), set(), set()])) === 2);
ok('2 unvollständiger Satz zählt nicht', G.isCountable(set({ completed: false })) === false);
ok('3 gelöschter/leerer Satz (keine reps) zählt nicht', G.isCountable({ setType: 'working', completed: true }) === false);
ok('reps<=0 zählt nicht', G.isCountable(set({ reps: 0 })) === false);
ok('Isometrie (Zeit) zählt', G.isCountable({ setType: 'working', completed: true, durationS: 40 }) === true);

// 4–7 Koeffizienten + Trennung
let bp = vol([{ workoutId: 'w1', startedAt: '2026-06-27T10:00:00Z', exercises: [ex('Bankdrücken', [set(), set(), set()])] }]);
ok('4 direkter Satz zählt 1,0 (Brust=3)', bp.chest.directSets === 3 && bp.chest.effectiveSets === 3);
ok('5 sekundär nutzt definierten Koeffizienten (Trizeps 3×0.5=1.5)', bp.triceps.indirectSetEquivalents === 1.5);
ok('6 reale Satzanzahl ganzzahlig', Number.isInteger(bp.chest.realWorkingSets) && bp.chest.realWorkingSets === 3);
ok('7 effektive Äquivalente dürfen dezimal sein', bp.triceps.effectiveSets === 1.5);

// 8 Brustpresse-Verteilung
let bpresse = vol([{ exercises: [ex('Brustpresse', [set(), set(), set()])] }]);
ok('8 Brustpresse → Brust/Trizeps/vordere Schulter', bpresse.chest.directSets === 3 && bpresse.triceps.effectiveSets === 1.5 && bpresse.front_delts.effectiveSets === 1.5);
// 9 Seitheben → seitliche Schulter
ok('9 Seitheben primär seitliche Schulter', (function () { let v = vol([{ exercises: [ex('Seitheben', [set(), set()])] }]); return v.side_delts.directSets === 2 && !v.front_delts; })());
// 10 Reverse Pec Deck → hintere Schulter
ok('10 Reverse Pec Deck → hintere Schulter', (function () { let v = vol([{ exercises: [ex('Reverse Pec Deck', [set()])] }]); return v.rear_delts.directSets === 1; })());
// 11 Schulterdrücken unterscheidet vordere/seitliche
ok('11 Schulterdrücken: vordere direkt, seitliche indirekt', (function () { let v = vol([{ exercises: [ex('Schulterdrücken', [set(), set()])] }]); return v.front_delts.directSets === 2 && v.side_delts.effectiveSets === 1; })());
// 12 Rudern unterscheidet oberer Rücken/Lats/Bizeps
ok('12 Rudern: oberer Rücken direkt, Lats+Bizeps indirekt', (function () { let v = vol([{ exercises: [ex('Rudern', [set(), set()])] }]); return v.upper_back.directSets === 2 && v.lats.effectiveSets === 1 && v.biceps.effectiveSets === 1; })());
// 13 Latzug unterscheidet Lats/Bizeps
ok('13 Latzug: Lats direkt, Bizeps indirekt', (function () { let v = vol([{ exercises: [ex('Latzug', [set(), set()])] }]); return v.lats.directSets === 2 && v.biceps.effectiveSets === 1; })());
// 14 Kniebeuge Quads/Glutes
ok('14 Kniebeuge: Quads direkt, Glutes indirekt', (function () { let v = vol([{ exercises: [ex('Kniebeuge', [set(), set(), set()])] }]); return v.quads.directSets === 3 && v.glutes.effectiveSets === 1.5 && v.hamstrings === undefined; })());
// 15 zwei Workouts aggregiert
ok('15 zwei Workouts aggregiert', (function () { let v = vol([{ exercises: [ex('Bankdrücken', [set(), set()])] }, { exercises: [ex('Bankdrücken', [set()])] }]); return v.chest.directSets === 3; })());
// 16 Wochen-/Periodengrenzen (weeklyEquivalent)
ok('16 weeklyEquivalent: 6 eff / 3 Tage = 14', G.weeklyEquivalent(6, 3) === 14);
ok('16b weeklyEquivalent: 8.5 / 7 = 8.5', G.weeklyEquivalent(8.5, 7) === 8.5);

// 17 keine Daten → keine Unter-Ziel-Wertung
ok('17 keine Daten → insufficient (nicht „below")', G.statusFor(0, G.targetCorridor({ goal: 'hypertrophy', experience: 'beginner', dataWeeks: 4 })).key === 'insufficient_data');
// 18 wenig Daten → niedrige Konfidenz
ok('18 wenig Daten → confidence low', G.confidenceOf({ weeks: 1, totalSets: 2, unclassifiedRatio: 0 }) === 'low');
ok('18b viel saubere Daten → high', G.confidenceOf({ weeks: 4, totalSets: 20, unclassifiedRatio: 0 }) === 'high');
// 19 Erhalt < Hypertrophie
ok('19 Erhalt-Korridor < Hypertrophie', (function () { let h = G.targetCorridor({ goal: 'hypertrophy', experience: 'intermediate', dataWeeks: 4 }); let m = G.targetCorridor({ goal: 'maintenance', experience: 'intermediate', dataWeeks: 4 }); return m.max < h.max; })());
// 20 Kraft nicht satzbasiert
ok('20 Kraft-Ziel: bewegungsspezifisch (kein Satzkorridor)', G.targetCorridor({ goal: 'strength', experience: 'advanced', dataWeeks: 8 }).source === 'strength_movement_based');
// 22 zu wenig Daten → kein Korridor (keine sprunghafte Zieländerung-Basis)
ok('22 dataWeeks<2 → insufficient_data', G.targetCorridor({ goal: 'hypertrophy', experience: 'beginner', dataWeeks: 1 }).source === 'insufficient_data');

// 23 Explainability-Summe = Gesamtwert
let exp = G.explainMuscleVolume('triceps', [{ workoutId: 'w1', startedAt: '2026-06-27T10:00:00Z', exercises: [ex('Bankdrücken', [set(), set(), set()])] }], { days: 7, weeks: 4, goal: 'hypertrophy', experience: 'beginner' });
ok('23 Summe der Beiträge = effektive Äquivalente', exp.contributions.reduce((a, c) => a + c.contribution, 0) === exp.effectiveSetEquivalents);
ok('23b explain: targetRange + confidence + contributions', exp.targetRange.min === 4 && exp.confidence && exp.contributions[0].coefficient === 0.5 && exp.contributions[0].relationship === 'indirect');
ok('23c explain: Beitrag rückführbar (Übung/Datum/reale Sätze)', exp.contributions[0].exerciseName === 'Bankdrücken' && exp.contributions[0].date === '2026-06-27' && exp.contributions[0].completedWorkingSets === 3);
// 24 nicht mutierend
let srcSnap = [{ exercises: [ex('Bankdrücken', [set(), set()])] }]; let cp = JSON.stringify(srcSnap); G.computeMuscleVolume(srcSnap); G.explainMuscleVolume('chest', srcSnap, {});
ok('24 Eingabe nicht mutiert', JSON.stringify(srcSnap) === cp);
// 25 idempotent
ok('25 idempotent', JSON.stringify(G.computeMuscleVolume(srcSnap).byMuscle) === JSON.stringify(G.computeMuscleVolume(srcSnap).byMuscle));
// 26 ohne RIR auswertbar
ok('26 Satz ohne RIR zählt voll', vol([{ exercises: [ex('Bankdrücken', [set({ rir: undefined }), set()])] }]).chest.directSets === 2);
// 27 unbekannte Übung → unclassified, KEINE erfundene Zuordnung
let un = G.computeMuscleVolume([{ exercises: [ex('Hyrox Sled Push', [set(), set()])] }]);
ok('27 unbekannte Übung unclassified, keine Muskelzuordnung', Object.keys(un.byMuscle).length === 0 && un.unclassified['Hyrox Sled Push'] === 2);
// Ausschlüsse begründet
let exc = G.computeMuscleVolume([{ exercises: [ex('Bankdrücken', [set({ setType: 'warmup' }), set({ completed: false }), set()])] }]).exclusions;
ok('Ausschlüsse: warmup + not_completed begründet', exc.some(e => e.reason === 'warmup') && exc.some(e => e.reason === 'not_completed'));

// 28 keine universelle 10–20-Regel im Engine-Code
ok('28 kein 10–20-Universalkorridor in der Engine', !/\b10\b[^]{0,6}\b20\b/.test(JSON.stringify(G.CORRIDORS || {})) && JSON.stringify(G.targetCorridor({ goal: 'hypertrophy', experience: 'advanced', dataWeeks: 4 })).indexOf('20') < 0);
// 31 Mobility fließt nicht ein (kein Mapping → unclassified, kein Muskel)
ok('31 Mobility-Übung erzeugt kein Muskelvolumen', Object.keys(G.computeMuscleVolume([{ exercises: [ex('Mobility Hüfte', [set({ weight: null, reps: 10 })])] }]).byMuscle).length === 0);

// 20/21 adaptive Sicherheit: hohe Ausdauerlast/schlechte Erholung erhöhen NIE automatisch
ok('20 hohe Ausdauerlast → kein Auto-Increase (hold)', G.volumeAdvice({ weeks: 4, highEndurance: true, performanceTrend: 'flat' }).advice === 'hold');
ok('21 schlechte Erholung → höchstens reduce/observe (kein Übertraining-Wording)', (function () { let a = G.volumeAdvice({ weeks: 4, poorRecovery: true }); return a.advice === 'reduce' && a.text.indexOf('übertrain') < 0 && a.text.indexOf('Übertrain') < 0; })());
ok('21b zu wenig Daten → insufficient', G.volumeAdvice({ weeks: 1 }).advice === 'insufficient');

// compareToLegacy
let cmp = G.compareToLegacy([{ exercises: [ex('Bankdrücken', [set(), set(), set()])] }], { chest: 3, triceps: 2.0 });
ok('compareToLegacy: difference rückführbar', cmp.chest.difference === 0 && cmp.triceps.difference === -0.5 && cmp.triceps.contributions.length === 1);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
