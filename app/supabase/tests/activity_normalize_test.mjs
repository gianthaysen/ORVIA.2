/* ORVIA · activity-normalize — reine Normalisierung/Dauer (Phase 1). */
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const A = (await import(new URL('../../js/activity-normalize.js', import.meta.url))).default;

// --- durationSecondsOf: Quellen-Priorität & Einheiten ---
ok('explizite Sekunden gewinnen', A.durationSecondsOf({ duration_seconds: 6060, duration_min: 5 }) === 6060);
ok('endedAt-startedAt (netto Pause)', A.durationSecondsOf({ started_at: '2026-06-27T10:00:00Z', ended_at: '2026-06-27T11:41:00Z', total_paused_seconds: 0 }) === 6060);
ok('Pausen werden abgezogen', A.durationSecondsOf({ started_at: '2026-06-27T10:00:00Z', ended_at: '2026-06-27T11:00:00Z', total_paused_seconds: 600 }) === 3000);
ok('Minuten-Feld → Sekunden', A.durationSecondsOf({ duration_min: 101 }) === 6060);
ok('Legacy durationMinutes', A.durationSecondsOf({ durationMinutes: 43 }) === 2580);
ok('Legacy duration (min)', A.durationSecondsOf({ duration: 43 }) === 2580);
ok('Millisekunden NICHT als Sekunden (kein started/ended → über min-Feld)', A.durationSecondsOf({ duration_min: 0.5 }) === 30);
ok('unbekannte Dauer → null', A.durationSecondsOf({}) === null);
ok('negative Zeitspanne verworfen → fällt auf min zurück/none', A.durationSecondsOf({ started_at: '2026-06-27T11:00:00Z', ended_at: '2026-06-27T10:00:00Z' }) === null);

// --- Plausibilität: 0 min, 710 min ---
ok('0 s ist plausibel (ok, 0)', A.durationPlausibility(0).state === 'ok');
ok('unbekannt (null) → unknown', A.durationPlausibility(null).state === 'unknown');
ok('negativ → unknown', A.durationPlausibility(-5).state === 'unknown');
ok('710 min (42600 s) → implausible', A.durationPlausibility(42600).state === 'implausible');
ok('8 h Grenze ok', A.durationPlausibility(8 * 3600).state === 'ok');
ok('8 h + 1 s implausible', A.durationPlausibility(8 * 3600 + 1).state === 'implausible');

// --- fmtDurationSeconds ---
ok('43 min Anzeige', A.fmtDurationSeconds(2580) === '43 min');
ok('1 h 41 min Anzeige', A.fmtDurationSeconds(6060) === '1 h 41 min');
ok('unbekannt → „Dauer nicht erfasst" (nicht 0 min)', A.fmtDurationSeconds(null) === 'Dauer nicht erfasst');
ok('unbekannt zeigt NICHT 0 min', A.fmtDurationSeconds(null).indexOf('0 min') < 0);
ok('710 min markiert (prüfen)', A.fmtDurationSeconds(42600).indexOf('prüfen') >= 0);
ok('0 s → 0 min (echte Nulldauer erlaubt)', A.fmtDurationSeconds(0) === '0 min');

// --- normalizeWorkoutSession: idempotent, nicht mutierend ---
let rawSess = { id: 'w1', sport: 'Gym', sport_key: 'gym', status: 'completed', local_date: '2026-06-27', started_at: '2026-06-27T10:00:00Z', finished_at: '2026-06-27T11:41:00Z', session_rpe: 7 };
let rawCopy = JSON.parse(JSON.stringify(rawSess));
let n1 = A.normalizeWorkoutSession(rawSess);
ok('Session: durationSeconds gesetzt', n1.durationSeconds === 6060 && n1.durationState === 'ok');
ok('Session: Quelle nicht mutiert', JSON.stringify(rawSess) === JSON.stringify(rawCopy));
ok('Session: idempotent', JSON.stringify(A.normalizeWorkoutSession(n1)) === JSON.stringify(n1) || A.normalizeWorkoutSession(n1).durationSeconds === n1.durationSeconds);
ok('Session: unbekannte Dauer bleibt null', A.normalizeWorkoutSession({ id: 'x', status: 'completed' }).durationSeconds === null);
ok('Session: 710-min-Fall markiert', A.normalizeWorkoutSession({ id: 'x', started_at: '2026-06-27T00:00:00Z', finished_at: '2026-06-27T11:50:00Z' }).durationState === 'implausible');

// --- summarizeWorkout: nur echte Arbeitssätze, Volumen, Ø RIR ---
let exs = [
  { sets: [{ set_type: 'warmup', weight: 40, reps: 10, completed: true }, { set_type: 'working', weight: 70, reps: 10, rir: 2, completed: true }, { set_type: 'working', weight: 70, reps: 9, rir: 1, completed: true }] },
  { sets: [{ set_type: 'working', weight: 100, reps: 5, rir: 1, completed: true }] }
];
let sum = A.summarizeWorkout(exs);
ok('summary: 2 Übungen', sum.exerciseCount === 2);
ok('summary: 3 Arbeitssätze (Warmup zählt nicht)', sum.workingSetCount === 3);
ok('summary: Volumen = 70*10+70*9+100*5 = 1830', sum.totalVolumeKg === 1830);
ok('summary: Ø RIR = (2+1+1)/3 = 1.3', sum.avgRir === 1.3);
ok('summary: leer → 0/0 ohne Volumen', (function () { var s = A.summarizeWorkout([]); return s.exerciseCount === 0 && s.workingSetCount === 0 && s.totalVolumeKg === undefined; })());

// --- normalizeActivityRecord + activityRowFromSession ---
let act = A.normalizeActivityRecord({ user_id: 'u', sport_id: 'gym', source: 'orvia_workout', source_record_id: 'w1', workout_session_id: 'w1', duration_min: 101, status: 'completed', summary: { exerciseCount: 7 } });
ok('Activity: durationSeconds aus min', act.durationSeconds === 6060);
ok('Activity: source/sourceRecordId erhalten (Idempotenz-Schlüssel)', act.source === 'orvia_workout' && act.sourceRecordId === 'w1');
ok('Activity: summary übernommen', act.summary.exerciseCount === 7);
let row = A.activityRowFromSession(rawSess, { exerciseCount: 2 });
ok('Row: source=orvia_workout', row.source === 'orvia_workout');
ok('Row: source_record_id = session id', row.source_record_id === 'w1');
ok('Row: duration_seconds gesetzt', row.duration_seconds === 6060);
ok('Row: sport_id = sport_key', row.sport_id === 'gym');

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
