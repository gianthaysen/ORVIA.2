/* ORVIA · gym-volume buildShadowReport — On-Device-Shadow (Inkrement 2C). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.ORVIA = { user: { id: 'u1' } };
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.ORVIA.activityNormalize = (await import(new URL('../../js/activity-normalize.js', import.meta.url))).default;
globalThis.ORVIA.trainingDomain = { normSport: v => String(v || '').toLowerCase() };
const S = (await import(new URL('../../js/activity-store.js', import.meta.url))).default;
const G = (await import(new URL('../../js/gym-volume.js', import.meta.url))).default;
function reset() { for (const k of Object.keys(mem)) delete mem[k]; }
function iso(daysAgo) { return new Date(Date.now() - daysAgo * 864e5).toISOString(); }
function set(o) { return Object.assign({ set_number: 1, set_type: 'working', completed: true, weight: 70, reps: 10 }, o); }
function exo(name, sets) { return { workoutExercise: { exercise_id: null }, exercise: { name: name }, sets: sets }; }
// Seed eines Gym-Workouts in den Store (mit Snapshot).
function seedGym(id, daysAgo, exs, sportKey) {
  S.upsertActivityFromWorkout({ id: id, sport_key: sportKey || 'gym', status: 'completed', started_at: iso(daysAgo), finished_at: iso(daysAgo) }, exs, { syncStatus: 'pending' });
}

// 1 keine Gym-Workouts → leerer Report, kein Fehler
reset();
let r0 = G.buildShadowReport({ days: 28 });
ok('1 keine Workouts → leerer Report', r0.source.workoutCount === 0 && r0.muscles.length === 0 && r0.warnings.length >= 1);
ok('10 Report JSON-serialisierbar', (function () { try { JSON.parse(JSON.stringify(r0)); return true; } catch (e) { return false; } })());

// 2 ein Workout → korrekte Satzanzahl
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set(), set()])]);
let r1 = G.buildShadowReport({ days: 28, goal: 'hypertrophy', experience: 'intermediate' });
ok('2 ein Workout: Brust real=3 direkt=3', (function () { let c = r1.muscles.find(m => m.muscleId === 'chest'); return c && c.realWorkingSets === 3 && c.directSets === 3; })());
ok('2b workoutCount/validSets stimmen', r1.source.workoutCount === 1 && r1.source.validWorkingSetCount === 3);
ok('Trizeps indirekt 1.5 im Report', (function () { let t = r1.muscles.find(m => m.muscleId === 'triceps'); return t && t.effectiveSetEquivalents === 1.5; })());
ok('targetRange gesetzt (kein 10–20)', (function () { let c = r1.muscles.find(m => m.muscleId === 'chest'); return c.targetRange.min === 6 && c.targetRange.max === 12; })());

// 3 mehrere Workouts → Aggregation
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set()])]);
seedGym('w2', 4, [exo('Bankdrücken', [set()])]);
ok('3 Aggregation: Brust direkt=3 über 2 Workouts', G.buildShadowReport({ days: 28 }).muscles.find(m => m.muscleId === 'chest').directSets === 3);

// 4/5 gelöschtes/tombstoned Workout ausgeschlossen
reset();
let w = S.upsertActivityFromWorkout({ id: 'wDel', sport_key: 'gym', status: 'completed', started_at: iso(1), finished_at: iso(1) }, [exo('Bankdrücken', [set(), set()])], { syncStatus: 'pending' });
S.deleteActivity(w.activity.clientRecordId);   // Tombstone
ok('4/5 gelöschtes (tombstoned) Workout ausgeschlossen', G.buildShadowReport({ days: 28 }).source.workoutCount === 0);

// 6 Mobility ausgeschlossen
reset();
seedGym('wm', 2, [exo('Mobility', [set({ weight: null, reps: 10 })])], 'mobility');
ok('6 Mobility ausgeschlossen', G.buildShadowReport({ days: 28 }).source.workoutCount === 0);

// 7/8 Warmups + unvollständige ausgeschlossen
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set({ set_type: 'warmup' }), set({ completed: false }), set(), set()])]);
let r7 = G.buildShadowReport({ days: 28 });
ok('7/8 nur 2 gültige Sätze (warmup + unvollständig raus)', r7.muscles.find(m => m.muscleId === 'chest').realWorkingSets === 2);
ok('7b Ausschlüsse begründet (warmup + not_completed)', r7.exclusionsByReason.warmup === 1 && r7.exclusionsByReason.not_completed === 1);

// 9 unbekannte Übung → unclassifiedExercises
reset();
seedGym('w1', 2, [exo('Sled Push', [set(), set()])]);
let r9 = G.buildShadowReport({ days: 28 });
ok('9 unbekannte Übung in unclassifiedExercises', r9.unclassifiedExercises.some(u => u.exerciseName === 'Sled Push' && u.workingSetCount === 2));
ok('9b unbekannte erzeugt kein Muskelvolumen', r9.muscles.length === 0);

// 11 nicht mutierend (localStorage unverändert) + 12 idempotent
reset();
seedGym('w1', 2, [exo('Kniebeuge', [set(), set(), set()])]);
let before = mem['orvia_activities_u1'];
let a = G.buildShadowReport({ days: 28 }); let b = G.buildShadowReport({ days: 28 });
ok('11 Report mutiert Store nicht', mem['orvia_activities_u1'] === before);
ok('12 idempotent (gleiche Muskelwerte)', JSON.stringify(a.muscles) === JSON.stringify(b.muscles));

// Zeitfenster: altes Workout außerhalb days fällt raus
reset();
seedGym('wOld', 40, [exo('Bankdrücken', [set(), set()])]);
ok('Zeitfenster: 40 Tage altes Workout nicht in 28-Tage-Report', G.buildShadowReport({ days: 28 }).source.workoutCount === 0);

// legacyByMuscle optional → differenceToLegacy
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set(), set()])]);
let rl = G.buildShadowReport({ days: 28, legacyByMuscle: { chest: 4 } });
ok('legacyByMuscle: differenceToLegacy = 3-4 = -1', rl.muscles.find(m => m.muscleId === 'chest').differenceToLegacy === -1);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
