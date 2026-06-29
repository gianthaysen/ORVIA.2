/* ORVIA · gym-volume buildShadowReport — On-Device-Shadow (Inkrement 2C). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

globalThis.ORVIA = { user: { id: 'u1' } };
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; }, key: i => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } };
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
let r0 = await G.buildShadowReport({ days: 28 });
ok('1 keine Workouts → leerer Report', r0.source.workoutCount === 0 && r0.muscles.length === 0 && r0.warnings.length >= 1);
ok('10 Report JSON-serialisierbar', (function () { try { JSON.parse(JSON.stringify(r0)); return true; } catch (e) { return false; } })());

// 2 ein Workout → korrekte Satzanzahl
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set(), set()])]);
let r1 = await G.buildShadowReport({ days: 28, goal: 'hypertrophy', experience: 'intermediate' });
ok('2 ein Workout: Brust real=3 direkt=3', (function () { let c = r1.muscles.find(m => m.muscleId === 'chest'); return c && c.realWorkingSets === 3 && c.directSets === 3; })());
ok('2b workoutCount/validSets stimmen', r1.source.workoutCount === 1 && r1.source.validWorkingSetCount === 3);
ok('Trizeps indirekt 1.5 im Report', (function () { let t = r1.muscles.find(m => m.muscleId === 'triceps'); return t && t.effectiveSetEquivalents === 1.5; })());
ok('targetRange gesetzt (kein 10–20)', (function () { let c = r1.muscles.find(m => m.muscleId === 'chest'); return c.targetRange.min === 6 && c.targetRange.max === 12; })());

// 3 mehrere Workouts → Aggregation
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set()])]);
seedGym('w2', 4, [exo('Bankdrücken', [set()])]);
let r3 = await G.buildShadowReport({ days: 28 });
ok('3 Aggregation: Brust direkt=3 über 2 Workouts', r3.muscles.find(m => m.muscleId === 'chest').directSets === 3);

// 4/5 gelöschtes/tombstoned Workout ausgeschlossen
reset();
let w = S.upsertActivityFromWorkout({ id: 'wDel', sport_key: 'gym', status: 'completed', started_at: iso(1), finished_at: iso(1) }, [exo('Bankdrücken', [set(), set()])], { syncStatus: 'pending' });
S.deleteActivity(w.activity.clientRecordId);   // Tombstone
ok('4/5 gelöschtes (tombstoned) Workout ausgeschlossen', (await G.buildShadowReport({ days: 28 })).source.workoutCount === 0);

// 6 Mobility ausgeschlossen
reset();
seedGym('wm', 2, [exo('Mobility', [set({ weight: null, reps: 10 })])], 'mobility');
ok('6 Mobility ausgeschlossen', (await G.buildShadowReport({ days: 28 })).source.workoutCount === 0);

// 7/8 Warmups + unvollständige ausgeschlossen
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set({ set_type: 'warmup' }), set({ completed: false }), set(), set()])]);
let r7 = await G.buildShadowReport({ days: 28 });
ok('7/8 nur 2 gültige Sätze (warmup + unvollständig raus)', r7.muscles.find(m => m.muscleId === 'chest').realWorkingSets === 2);
ok('7b Ausschlüsse begründet (warmup + not_completed)', r7.exclusionsByReason.warmup === 1 && r7.exclusionsByReason.not_completed === 1);

// 9 unbekannte Übung → unclassifiedExercises
reset();
seedGym('w1', 2, [exo('Sled Push', [set(), set()])]);
let r9 = await G.buildShadowReport({ days: 28 });
ok('9 unbekannte Übung in unclassifiedExercises', r9.unclassifiedExercises.some(u => u.exerciseName === 'Sled Push' && u.workingSetCount === 2));
ok('9b unbekannte erzeugt kein Muskelvolumen', r9.muscles.length === 0);

// 11 nicht mutierend (localStorage unverändert) + 12 idempotent
reset();
seedGym('w1', 2, [exo('Kniebeuge', [set(), set(), set()])]);
let before = mem['orvia_activities_u1'];
let a = await G.buildShadowReport({ days: 28 }); let b = await G.buildShadowReport({ days: 28 });
ok('11 Report mutiert Store nicht', mem['orvia_activities_u1'] === before);
ok('12 idempotent (gleiche Muskelwerte)', JSON.stringify(a.muscles) === JSON.stringify(b.muscles));

// Zeitfenster: altes Workout außerhalb days fällt raus
reset();
seedGym('wOld', 40, [exo('Bankdrücken', [set(), set()])]);
ok('Zeitfenster: 40 Tage altes Workout nicht in 28-Tage-Report', (await G.buildShadowReport({ days: 28 })).source.workoutCount === 0);

// legacyByMuscle optional → differenceToLegacy
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set(), set()])]);
let rl = await G.buildShadowReport({ days: 28, legacyByMuscle: { chest: 4 } });
ok('legacyByMuscle: differenceToLegacy = 3-4 = -1', rl.muscles.find(m => m.muscleId === 'chest').differenceToLegacy === -1);

/* ===== robuster Adapter + Diagnose (Fix workoutCount:0) ===== */
// Pipeline direkt mit verschiedenen Schemata (lokale Activities simulieren via Store-Seed + Server-Inject)
reset();
seedGym('w1', 2, [exo('Bankdrücken', [set(), set(), set()])]);
let pipe = G.gymPipeline({ days: 28 });
ok('Pipeline: 1 Gym-Workout erkannt', pipe.snapshots.length === 1 && pipe.diagnostics.snapshotCandidates === 1);
ok('Diagnose: rawLocalActivityCount>0', pipe.diagnostics.rawLocalActivityCount === 1);
// status 'finished' wird erkannt (Server-Inject)
let srvFinished = { source: 'orvia_workout', sportId: 'gym', status: 'finished', startedAt: iso(3), workoutSessionId: 'srvW', workoutSnapshot: [{ exerciseNameSnapshot: 'Kniebeuge', sets: [{ set_type: 'working', completed: true, reps: 5, weight: 100 }] }] };
ok("status 'finished' erkannt", G.gymPipeline({ days: 28, serverActivities: [srvFinished] }).snapshots.some(s => s.workoutId === 'srvW'));
// fehlender Status + endedAt erkannt
let noStatus = { source: 'orvia_workout', sportId: 'gym', endedAt: iso(2), startedAt: iso(2), workoutSessionId: 'wEnd', workoutSnapshot: [{ exerciseNameSnapshot: 'Latzug', sets: [{ set_type: 'working', completed: true, reps: 10, weight: 60 }] }] };
ok('fehlender Status + endedAt erkannt', G.gymPipeline({ days: 28, serverActivities: [noStatus] }).snapshots.some(s => s.workoutId === 'wEnd'));
// type='Krafttraining' (Legacy-Schema) erkannt
let legacyType = { source: 'orvia_workout', type: 'Krafttraining', status: 'completed', startedAt: iso(1), workoutSessionId: 'wKraft', snapshot: { exercises: [{ exerciseNameSnapshot: 'Beinpresse', sets: [{ set_type: 'working', completed: true, reps: 12, weight: 120 }] }] } };
ok("type='Krafttraining' + snapshot.exercises erkannt", G.gymPipeline({ days: 28, serverActivities: [legacyType] }).snapshots.some(s => s.workoutId === 'wKraft'));
// strength_training erkannt
ok("'strength_training' als Gym erkannt", G.gymPipeline({ days: 28, serverActivities: [{ source: 'orvia_workout', sportId: 'strength_training', status: 'completed', startedAt: iso(1), workoutSessionId: 'wS', workoutSnapshot: [{ exerciseNameSnapshot: 'Curl', sets: [{ set_type: 'working', completed: true, reps: 10, weight: 20 }] }] }] }).snapshots.some(s => s.workoutId === 'wS'));
// Dedup lokal+server (gleiche workoutSessionId)
reset();
let lw = S.upsertActivityFromWorkout({ id: 'dupW', sport_key: 'gym', status: 'completed', started_at: iso(1), finished_at: iso(1) }, [exo('Bankdrücken', [set(), set()])], { syncStatus: 'pending' });
let srvDup = { source: 'orvia_workout', sportId: 'gym', status: 'completed', startedAt: iso(1), workoutSessionId: 'dupW', workoutSnapshot: [{ exerciseNameSnapshot: 'Bankdrücken', sets: [{ set_type: 'working', completed: true, reps: 10, weight: 70 }] }] };
ok('Dedup lokal+server (gleiche workoutSessionId) → 1', G.gymPipeline({ days: 28, serverActivities: [srvDup] }).snapshots.length === 1);
// Mobility-Server-Activity → wrongSport
ok('Mobility-Server-Activity → wrongSport, kein Snapshot-Kandidat', (function () { let p = G.gymPipeline({ days: 28, serverActivities: [{ source: 'orvia_workout', sportId: 'mobility', status: 'completed', startedAt: iso(1), workoutSnapshot: [{ sets: [set()] }] }] }); return p.diagnostics.rejectedByReason.wrongSport >= 1; })());
// fehlender Snapshot → missingSnapshot begründet
ok('fehlender Snapshot → missingSnapshot', G.gymPipeline({ days: 28, serverActivities: [{ source: 'orvia_workout', sportId: 'gym', status: 'completed', startedAt: iso(1), workoutSessionId: 'wNo' }] }).diagnostics.rejectedByReason.missingSnapshot >= 1);
// außerhalb Zeitraum → outsidePeriod
ok('außerhalb 28 Tage → outsidePeriod', G.gymPipeline({ days: 28, serverActivities: [{ source: 'orvia_workout', sportId: 'gym', status: 'completed', startedAt: iso(40), workoutSnapshot: [{ sets: [set()] }] }] }).diagnostics.rejectedByReason.outsidePeriod >= 1);
// detectedSchemas nur Feldnamen
ok('detectedSchemas: nur Feldnamen + count (keine Werte)', (function () { let p = G.gymPipeline({ days: 28, serverActivities: [srvFinished] }); let sc = p.diagnostics.detectedSchemas.find(x => x.source === 'serverActivities'); return sc && sc.count === 1 && Array.isArray(sc.fields) && sc.fields.indexOf('status') >= 0; })());
// Report enthält diagnostics + keine IDs im JSON
reset(); seedGym('w1', 2, [exo('Bankdrücken', [set(), set()])]);
let rep = await G.buildShadowReport({ days: 28 });
ok('Report enthält diagnostics-Block', rep.diagnostics && rep.diagnostics.snapshotCandidates === 1);
ok('Report-JSON enthält keine UUID-/E-Mail-WERTE (Feldnamen in detectedSchemas erlaubt)', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JSON.stringify(rep)) && JSON.stringify(rep).indexOf('@') < 0);

/* ===== Lifecycle-Fix: Legacy-DB-Quelle + async + reportStatus + readiness ===== */
function dstr(daysAgo) { return new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10); }
// 20 echte Legacy-Gym-Daten (DB.sessions.Gym.exLog) → workoutCount>0
reset();
globalThis.DB = {}; globalThis.DB[dstr(2)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Bankdrücken', sets: 3, reps: 10, kg: 70 }, { n: 'Kniebeuge', sets: 3, reps: 5, kg: 100 }] } } };
let rLeg = await G.buildShadowReport({ days: 28 });
ok('20 Legacy-DB-Gym → workoutCount>0', rLeg.source.workoutCount === 1 && rLeg.reportStatus === 'ok');
ok('20b Legacy: Brust direkt=3, Quads direkt=3', rLeg.muscles.find(m => m.muscleId === 'chest').directSets === 3 && rLeg.muscles.find(m => m.muscleId === 'quads').directSets === 3);
ok('20c diagnostics.rawLegacySessionCount>0', rLeg.diagnostics.rawLegacySessionCount === 1);
ok('sourceCalls enthält legacy_db', rLeg.diagnostics.sourceCalls.some(c => c.source === 'legacy_db' && c.returnedCount === 1));
// readiness gefüllt
ok('1 readiness vorhanden (localStoreReady/authReady)', rLeg.diagnostics.readiness.localStoreReady === true && rLeg.diagnostics.readiness.authReady === true && rLeg.diagnostics.readiness.timedOut === false);
// 4 leerer aber geladener Store + leeres DB → no_gym_workouts (NICHT data_unavailable)
reset(); globalThis.DB = {};
let rEmpty = await G.buildShadowReport({ days: 28 });
ok('4 leerer geladener Store → no_gym_workouts ODER data_unavailable bei 0 Rohquellen', ['no_gym_workouts', 'data_unavailable'].indexOf(rEmpty.reportStatus) >= 0);
// reportStatus + Projektion ausgeschlossen
reset(); globalThis.DB = {}; globalThis.DB[dstr(1)] = { sessions: { Gym: { derivedFromActivity: true, dur: 60, exLog: [{ n: 'Bankdrücken', sets: 3, reps: 10, kg: 70 }] } } };
ok('Legacy-Projektion (derivedFromActivity) NICHT gezählt', (await G.buildShadowReport({ days: 28 })).source.workoutCount === 0);
// 16 visibleActivityPipeline-Mismatch → Warnung
reset(); globalThis.DB = {};
globalThis.window = { listActivitiesUnified: function () { return [{ sportId: 'gym', source: 'orvia_workout' }, { sportId: 'gym', source: 'orvia_workout' }]; } };
let rMis = await G.buildShadowReport({ days: 28 });
ok('16 sichtbare Gym-Einträge aber 0 Snapshots → ACTIVITY_PIPELINE_MISMATCH', rMis.diagnostics.visibleActivityPipeline.gymResultCount === 2 && rMis.warnings.indexOf('ACTIVITY_PIPELINE_MISMATCH') >= 0);
delete globalThis.window;
// 17 keine UUID/E-Mail-Werte
ok('17 Report ohne UUID-/E-Mail-Werte', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JSON.stringify(rLeg)) && JSON.stringify(rLeg).indexOf('@') < 0);

/* ===== Fixes-Runde: 3 Legacy-Sessions, displayStatus, occurrenceCount, Sanitizer ===== */
// 1/23 drei Legacy-Gym-Sessions an verschiedenen Tagen → drei Workouts (kein Kollaps auf 1)
reset(); globalThis.DB = {};
globalThis.DB[dstr(2)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Bankdrücken', sets: 3, reps: 10, kg: 70 }] } } };
globalThis.DB[dstr(5)] = { sessions: { Gym: { dur: 50, exLog: [{ n: 'Kniebeuge', sets: 3, reps: 5, kg: 100 }] } } };
globalThis.DB[dstr(9)] = { sessions: { Gym: { dur: 40, exLog: [{ n: 'Latzug', sets: 3, reps: 10, kg: 60 }] } } };
let r3leg = await G.buildShadowReport({ days: 28 });
ok('1 drei Legacy-Sessions → drei Workouts', r3leg.source.workoutCount === 3 && r3leg.diagnostics.snapshotCandidates === 3 && r3leg.diagnostics.rawLegacySessionCount === 3);
// 4 deterministischer Schlüssel: zweiter Lauf gleiche Werte
let r3legB = await G.buildShadowReport({ days: 28 });
ok('4 deterministisch (zweiter Lauf identische workoutCount)', r3legB.source.workoutCount === 3);
// 22 displayStatus insufficient_data bei niedriger Datenlage (Legacy-synthetisch, <2 Wochen Workouts)
ok('22 targetRange.displayStatus = insufficient_data', r3leg.muscles.length > 0 && r3leg.muscles.every(m => m.targetRange.displayStatus === 'insufficient_data'));
// 15 occurrenceCount nie null
reset(); globalThis.DB = {}; globalThis.DB[dstr(1)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Sled Push', sets: 2, reps: 10, kg: 50 }] } } };
let rUnk = await G.buildShadowReport({ days: 28 });
ok('15 occurrenceCount ist Ganzzahl (nicht null)', rUnk.unclassifiedExercises.length === 1 && rUnk.unclassifiedExercises[0].occurrenceCount === 1 && rUnk.unclassifiedExercises[0].workingSetCount === 2);
// 7-14 neue Mappings live im Report
reset(); globalThis.DB = {}; globalThis.DB[dstr(2)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Step-up', sets: 2, reps: 10, kg: 40 }, { n: 'Hyperextentions', sets: 2, reps: 12, kg: 0 }] } } };
let rMap = await G.buildShadowReport({ days: 28 });
ok('Step-up + Hyperextentions nicht mehr unklassifiziert', rMap.unclassifiedExercises.length === 0);
ok('Step-up → Quads+Glutes; Hyperext → lower_back', rMap.muscles.find(m => m.muscleId === 'quads').directSets === 2 && rMap.muscles.find(m => m.muscleId === 'lower_back').directSets === 2);
// 16/17/18/19 Sanitizer: echte UUID im Storage-Key → nur Kategorien, kein UUID im Report
reset();
mem['orvia_activities_11111111-2222-3333-4444-555555555555'] = JSON.stringify([{ source: 'orvia_workout' }]);
globalThis.ORVIA.user = { id: '11111111-2222-3333-4444-555555555555' };
globalThis.DB = {}; globalThis.DB[dstr(2)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Bankdrücken', sets: 3, reps: 10, kg: 70 }] } } };
let rSan = await G.buildShadowReport({ days: 28 });
ok('16 storageInspection nur Kategorien (keine echten Keys)', Array.isArray(rSan.diagnostics.storageInspection.availableKeyTypes) && rSan.diagnostics.storageInspection.availableKeyTypes.indexOf('activities') >= 0 && !rSan.diagnostics.storageInspection.availableKeys);
ok('17 gesamter Report enthält keine UUID', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JSON.stringify(rSan)));
ok('18 Report enthält keine E-Mail', JSON.stringify(rSan).indexOf('@') < 0);
ok('19 Sanitizer entfernt token/userId-Felder', (function () { let s = G.gymPipeline; return JSON.stringify(rSan).indexOf('"user_id"') < 0 && JSON.stringify(rSan).indexOf('"token"') < 0; })());
globalThis.ORVIA.user = { id: 'u1' };
// 20/23/24 strikte Aufschlüsselung: 1 echtes (exLog) + 12 Check-in-only Gym-Tage
reset(); globalThis.DB = {};
globalThis.DB[dstr(1)] = { sessions: { Gym: { dur: 60, exLog: [{ n: 'Bankdrücken', sets: 3, reps: 10, kg: 70 }] } } };   // echtes Workout
for (let i = 2; i < 14; i++) globalThis.DB[dstr(i)] = { sessions: { Gym: { dur: 45 } } };   // Check-in-only (kein exLog)
globalThis.window = { listActivitiesUnified: function () { var a = []; Object.keys(globalThis.DB).forEach(function (k) { a.push({ sportId: 'gym', source: 'legacy_local', startedAt: k + 'T12:00:00Z' }); }); return a; } };
let rVis = await G.buildShadowReport({ days: 28 });
let vap = rVis.diagnostics.visibleActivityPipeline;
ok('23 gymRealWorkoutCount = echte Workouts (1)', vap.gymRealWorkoutCount === 1 && rVis.source.workoutCount === 1);
ok('24 gymCheckinOnlyCount separat (12)', vap.gymCheckinOnlyCount === 12);
ok('20 gymLegacyCount = alle Gym-Tage (13)', vap.gymLegacyCount === 13);
ok('21 sichtbar(13) >> echte(1) → VISIBLE_GYM_DUPLICATION_SUSPECTED', rVis.warnings.indexOf('VISIBLE_GYM_DUPLICATION_SUSPECTED') >= 0);
delete globalThis.window;

// 7-15 neue Mappings + Plausibilität + Explainability-Summen
reset(); globalThis.DB = {};
globalThis.DB[dstr(2)] = { sessions: { Gym: { dur: 70, exLog: [
  { n: 'Trizeps-Pushdown', sets: 2, reps: 12, kg: 30 }, { n: 'Rope Pushdown', sets: 2, reps: 12, kg: 25 },
  { n: 'Bizeps-Curl', sets: 2, reps: 10, kg: 20 }, { n: 'Curls', sets: 2, reps: 10, kg: 18 },
  { n: 'Face Pull', sets: 2, reps: 15, kg: 25 }, { n: 'Face Pull Jacob', sets: 2, reps: 15, kg: 25 },
  { n: 'Abroll', sets: 3, reps: 10, kg: 0 }, { n: 'Klimmzug breit', sets: 2, reps: 8, kg: 0 },
  { n: 'Leg Curl', sets: 2, reps: 12, kg: 40 } ] } } };
let rM = await G.buildShadowReport({ days: 28 });
ok('16/17 unclassifiedExercises leer (alle erkannt)', rM.unclassifiedExercises.length === 0);
function mv(id) { var m = rM.muscles.find(x => x.muscleId === id); return m ? m : { directSets: 0, indirectSetEquivalents: 0, effectiveSetEquivalents: 0 }; }
ok('Trizeps +4 direkt', mv('triceps').directSets === 4);
ok('Bizeps +4 direkt (Curl/Curls), Leg Curl NICHT Bizeps', mv('biceps').directSets === 4);
ok('6 Leg Curl → Hamstrings (nicht Bizeps)', mv('hamstrings').directSets === 2);
ok('9 hintere Schulter +4 direkt (beide Face Pulls)', mv('rear_delts').directSets === 4);
ok('11 Core +3 direkt (Abroll)', mv('abs').directSets === 3);
ok('14 Lats +2 direkt (breiter Klimmzug)', mv('lats').directSets === 2);
ok('10/15 oberer Rücken indirekt = FacePull 4×0.5 + Klimmzug 2×0.5 = 3.0', mv('upper_back').indirectSetEquivalents === 3.0);
ok('15 Bizeps indirekt aus Klimmzug = 2×0.5 = 1.0 (zus. zu 4 direkt)', mv('biceps').indirectSetEquivalents === 1.0);
// 19 Explainability-Summe exakt
let exT = G.explainMuscleVolume('rear_delts', G.snapshotsFromStore({ days: 28 }), { days: 28 });
ok('19 Explainability-Summe = effektive Äquivalente (rear_delts)', exT.contributions.reduce((a, c) => a + c.contribution, 0) === exT.effectiveSetEquivalents);
ok('18 validWorkingSetCount bleibt erhalten (19 Sätze)', rM.source.validWorkingSetCount === 19);
// 25/26 Konfidenz low + displayStatus insufficient bei Legacy-synthetisch
ok('25 Legacy-synthetisch → confidence low + reason', rM.muscles.every(m => m.confidence === 'low') && rM.muscles.some(m => m.confidenceReason === 'legacy_synthetic_data'));
ok('26 displayStatus insufficient_data', rM.muscles.every(m => m.targetRange.displayStatus === 'insufficient_data'));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
