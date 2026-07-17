/* ORVIA · activity-store — lokales kanonisches Activity-Repository (Inkrement 2A). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

// localStorage-Stub + Normalize zuerst bereitstellen, dann Store importieren.
globalThis.ORVIA = { user: { id: 'u1' } };
const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
globalThis.ORVIA.activityNormalize = (await import(new URL('../../js/activity-normalize.js', import.meta.url))).default;
globalThis.ORVIA.trainingDomain = { normSport: v => String(v || '').toLowerCase() };
const S = (await import(new URL('../../js/activity-store.js', import.meta.url))).default;

function reset() { for (const k of Object.keys(mem)) delete mem[k]; }

// Session + Snapshot (Store-Form: workoutExercise/sets)
const session = { id: 'w1', sport: 'Gym', sport_key: 'gym', status: 'completed', local_date: '2026-06-27', started_at: '2026-06-27T10:00:00Z', finished_at: '2026-06-27T11:41:00Z', duration_min: 101, session_rpe: 7 };
const snapshot = [
  { workoutExercise: { exercise_id: 'bench', order_index: 0 }, exercise: { name: 'Brustpresse' }, sets: [
    { set_number: 1, set_type: 'working', weight: 70, reps: 10, rir: 2, completed: true },
    { set_number: 2, set_type: 'working', weight: 70, reps: 9, rir: 1, completed: true },
    { set_number: 3, set_type: 'working', weight: 65, reps: 10, rir: 1, completed: true }
  ] }
];

// 1 Workout-Abschluss erzeugt genau eine Activity
reset();
let r1 = S.upsertActivityFromWorkout(session, snapshot, { syncStatus: 'pending' });
ok('Upsert ok + created', r1.ok && r1.created === true);
ok('genau eine Activity', S.listActivities().length === 1);
// 2 Doppelter Abschluss (idempotent) erzeugt keine zweite
let r2 = S.upsertActivityFromWorkout(session, snapshot, { syncStatus: 'pending' });
ok('zweiter Upsert: nicht created', r2.created === false);
ok('weiterhin genau eine Activity (idempotent)', S.listActivities().length === 1);
ok('clientRecordId stabil', r1.activity.clientRecordId === r2.activity.clientRecordId);
// 3 Workout↔Activity verknüpft
ok('workoutSessionId verknüpft', r1.activity.workoutSessionId === 'w1');
ok('sourceRecordId = session id', r1.activity.sourceRecordId === 'w1' && r1.activity.source === 'orvia_workout');
// 5/6 Detailansicht lädt lokalen Snapshot
let det = S.getWorkoutDetailsForActivity(r1.activity.clientRecordId);
ok('Details hasDetails true', det.ok && det.hasDetails === true);
ok('Details: 1 Übung, 3 Sätze', det.exercises.length === 1 && det.exercises[0].sets.length === 3);
// 7/8 Gewicht/Reps/RIR + Reihenfolge erhalten
ok('Satz 1: 70kg×10 RIR2', det.exercises[0].sets[0].weight === 70 && det.exercises[0].sets[0].reps === 10 && det.exercises[0].sets[0].rir === 2);
ok('Satzreihenfolge erhalten', det.exercises[0].sets.map(s => s.setNumber).join(',') === '1,2,3');
ok('exerciseNameSnapshot erhalten', det.exercises[0].exerciseNameSnapshot === 'Brustpresse');
// summary
ok('summary: 1 Übung / 3 Arbeitssätze', r1.activity.summary.exerciseCount === 1 && r1.activity.summary.workingSetCount === 3);
ok('summary: Volumen vorhanden', r1.activity.summary.totalVolumeKg === 70 * 10 + 70 * 9 + 65 * 10);
// Dauer kanonisch
ok('durationSeconds = 6060', r1.activity.durationSeconds === 6060);
// 14/15 Dauerfälle
reset();
let unk = S.upsertActivityFromWorkout({ id: 'w2', sport: 'Gym', status: 'completed' }, [], { syncStatus: 'pending' });
ok('unbekannte Dauer → null (nicht 0)', unk.activity.durationSeconds === null);
let impl = S.upsertActivityFromWorkout({ id: 'w3', sport: 'Gym', status: 'completed', started_at: '2026-06-27T00:00:00Z', finished_at: '2026-06-27T11:50:00Z' }, [], { syncStatus: 'pending' });
ok('710-min-Fall: durationSeconds gesetzt aber implausibel via normalize', globalThis.ORVIA.activityNormalize.durationPlausibility(impl.activity.durationSeconds).state === 'implausible');
// 16/17 normalisiert + nicht mutierend
reset();
let srcCopy = JSON.parse(JSON.stringify(session)); let snapCopy = JSON.parse(JSON.stringify(snapshot));
S.upsertActivityFromWorkout(session, snapshot, {});
ok('Eingabe-Session nicht mutiert', JSON.stringify(session) === JSON.stringify(srcCopy));
ok('Eingabe-Snapshot nicht mutiert', JSON.stringify(snapshot) === JSON.stringify(snapCopy));
// 18 alter Datensatz lesbar (getActivityBySource)
ok('getActivityBySource findet', !!S.getActivityBySource('orvia_workout', 'w1'));
// 19 Detailauflösung nur über ID
ok('getActivityById über clientRecordId', !!S.getActivityById(S.listActivities()[0].clientRecordId));
ok('unbekannte ID → ACTIVITY_NOT_FOUND', S.getWorkoutDetailsForActivity('nope').code === 'ACTIVITY_NOT_FOUND');
// 20 „Neustart" = neuer Store-Read aus localStorage erhält alles
ok('Persistenz über localStorage', JSON.parse(mem['orvia_activities_u1']).length >= 1);
// Outbox/Retry
ok('syncStatus pending', S.listActivities()[0].syncStatus === 'pending');
ok('pendingActivities enthält Datensatz', S.pendingActivities().length === 1);
ok('markSynced setzt synced + serverId', (function () { var c = S.listActivities()[0].clientRecordId; S.markSynced(c, 'srv1'); var a = S.getActivityById('srv1'); return a && a.syncStatus === 'synced' && a.id === 'srv1'; })());
// Filter
reset();
S.upsertActivityFromWorkout({ id: 'g1', sport_key: 'gym', status: 'completed', duration_min: 60 }, [], {});
S.upsertActivityFromWorkout({ id: 'r1', sport_key: 'running', status: 'completed', duration_min: 30 }, [], {});
ok('listActivities filter sportId=gym', S.listActivities({ sportId: 'gym' }).length === 1);
ok('listActivities limit', S.listActivities({ limit: 1 }).length === 1);

/* ===== Löschen + Tombstones ===== */
reset();
let w = S.upsertActivityFromWorkout({ id: 'wd1', sport_key: 'gym', status: 'completed', duration_min: 60 }, snapshot, { syncStatus: 'pending' });
S.markSynced(w.activity.clientRecordId, 'srv-wd1');   // synchronisiert → Server-id
let del = S.deleteActivity('srv-wd1');
ok('deleteActivity ok + Tombstone (kind workout)', del.ok && del.tombstone.kind === 'workout');
ok('gelöschte Activity nicht mehr in Liste', S.listActivities().length === 0);
ok('Tombstone pending (war synchronisiert/Workout)', S.pendingDeletes().length === 1);
ok('isTombstoned per serverId', S.isTombstoned({ id: 'srv-wd1' }) === true);
ok('isTombstoned per workoutSessionId', S.isTombstoned({ workoutSessionId: 'wd1' }) === true);
ok('isTombstoned per source+sourceRecordId', S.isTombstoned({ source: 'orvia_workout', sourceRecordId: 'wd1' }) === true);
ok('fremde Activity nicht getombstoned', S.isTombstoned({ id: 'other', workoutSessionId: 'zzz' }) === false);
S.markDeleteSynced(del.tombstone.clientRecordId);
ok('markDeleteSynced → keine pendingDeletes', S.pendingDeletes().length === 0);
S.removeTombstone(del.tombstone.clientRecordId);
ok('removeTombstone entfernt → nicht mehr getombstoned', S.isTombstoned({ id: 'srv-wd1' }) === false);
// nur lokale (nie synchronisierte) manuelle Activity: Tombstone gilt sofort als synced (nichts am Server)
reset();
let man = S.upsertManualActivity({ sportId: 'padel', source: 'manual', sourceRecordId: 'manual:2026-06-27:padel', durationSeconds: 4800, summary: { rpe: 7 } });
let delMan = S.deleteActivity(man.activity.clientRecordId);
ok('lokale manuelle Löschung: kein Server-Delete nötig (synced)', delMan.ok && S.pendingDeletes().length === 0);
ok('manuelle Activity weg aus Liste', S.listActivities().length === 0);

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
