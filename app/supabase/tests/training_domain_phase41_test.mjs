/* ORVIA · Phase 4.1 — Trainingsdomäne: Konstanten, DTO, Repositories (Unit-Tests).
   node supabase/tests/training_domain_phase41_test.mjs */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

global.window = {};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
const load = f => (0, eval)(fs.readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
load('js/repos/repoBase.js');
load('js/training-domain.js');
load('js/repos/exerciseRepository.js');
load('js/repos/sportRepository.js');
load('js/repos/trainingPlanRepository.js');
load('js/repos/workoutRepository.js');
const O = global.window.ORVIA, T = O.trainingDomain;

// Flexibler Supabase-Stub: select → RET[table], upsert/insert/update → CAP[table].
let RET = {}, CAP = {};
function sbStub() {
  const obj = {}; let _t = null;
  ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'delete', 'insert', 'update', 'not'].forEach(m => obj[m] = () => obj);
  obj.upsert = (row, opts) => { CAP[_t] = { row: row, opts: opts }; return obj; };
  obj.maybeSingle = () => Promise.resolve({ data: RET[_t] && RET[_t][0] || null, error: null });
  obj.then = (res, rej) => Promise.resolve({ data: RET[_t] || [{ id: _t + '_id' }], error: null }).then(res, rej);
  return { from: (t) => { _t = t; return obj; } };
}
const shape = r => r && typeof r.success === 'boolean';

const run = async () => {
  O.user = { id: 'A' }; O.sb = sbStub(); navigator.onLine = true;

  // ---- A. Konstanten / Validatoren ----
  ok('SPORTS enthält Kern-Sportarten', ['gym', 'running', 'football'].every(s => T.SPORTS.includes(s)));
  ok('SPLIT_TYPES enthält ppl/full_body/custom', ['push_pull_legs', 'full_body', 'custom'].every(s => T.SPLIT_TYPES.includes(s)));
  ok('SET_TYPES enthält warmup/working/dropset/amrap', ['warmup', 'working', 'dropset', 'amrap'].every(s => T.SET_TYPES.includes(s)));
  ok('MOVEMENT_PATTERNS 28 Muster (inkl. 4.2e-Erweiterung)', T.MOVEMENT_PATTERNS.length === 28 && ['knee_extension','hip_adduction','hip_abduction'].every(k => T.MOVEMENT_PATTERNS.indexOf(k) >= 0));
  ok('MUSCLE_GROUPS mit region/view (Körperkarte)', T.MUSCLE_GROUPS.find(m => m.key === 'chest').view === 'front' && T.MUSCLE_GROUPS.find(m => m.key === 'lats').view === 'back');
  ok('valid.position(football,st) true; (football,xx) false', T.valid.position('football', 'st') && !T.valid.position('football', 'xx'));
  ok('valid.splitType / setType', T.valid.splitType('push_pull_legs') && !T.valid.splitType('nonsense') && T.valid.setType('myo_reps'));

  // ---- B. DTO-Mapper ----
  const exRow = { id: 'e1', slug: 'bench_press', name: 'Bankdrücken', is_system: true, movement_pattern: 'horizontal_push', unilateral: false };
  const ex = T.map.exerciseFromRow(exRow);
  ok('exerciseFromRow: isSystem true, movementPattern', ex.isSystem === true && ex.movementPattern === 'horizontal_push' && ex.name === 'Bankdrücken');
  const toRow = T.map.exerciseToRow({ name: 'Mein Curl', movementPattern: 'elbow_flexion', is_system: true });
  ok('exerciseToRow: is_system IMMER false (nutzerdefiniert)', toRow.is_system === false && toRow.movement_pattern === 'elbow_flexion');
  const setRow = T.map.setToRow({ setNumber: 1, setType: 'working', weight: 80, reps: 8, rir: 2 });
  ok('setToRow: Felder + nullable (distance_m/time_s null)', setRow.set_number === 1 && setRow.weight === 80 && setRow.reps === 8 && setRow.distance_m === null && setRow.time_s === null);
  const swimSet = T.map.setToRow({ setNumber: 1, setType: 'working', distanceM: 100, timeS: 95 });
  ok('setToRow Schwimmen: distance/time gesetzt, weight null', swimSet.distance_m === 100 && swimSet.time_s === 95 && swimSet.weight === null);

  // ---- C. Repositories ----
  // Nutzerdefinierte Übung: is_system erzwungen false, user_id via stampUser
  CAP = {}; let r = await O.repos.exercise.createUserExercise({ name: 'Custom Press', movementPattern: 'horizontal_push' });
  ok('createUserExercise: is_system false + user_id=A', shape(r) && r.success && CAP['exercises'].row.is_system === false && CAP['exercises'].row.user_id === 'A');

  // Workout-Satz: gemappt + workout_exercise_id + stabiler Client-ID-Dedup (Phase 4.2)
  CAP = {}; r = await O.repos.workout.addSet('we1', { setNumber: 2, setType: 'top_set', weight: 100, reps: 5, rir: 1, clientSetId: 'set:abc' });
  ok('addSet: workout_exercise_id + Mapping + user_id', shape(r) && r.success && CAP['workout_sets'].row.workout_exercise_id === 'we1' && CAP['workout_sets'].row.weight === 100 && CAP['workout_sets'].row.user_id === 'A');
  ok('addSet: Dedup onConflict user_id,client_set_id (reorder-sicher)', CAP['workout_sets'].opts.onConflict === 'user_id,client_set_id' && CAP['workout_sets'].row.client_set_id === 'set:abc');

  // Workout-Übung: Dedup über (user_id, client_exercise_id)
  CAP = {}; r = await O.repos.workout.addExercise('s1', { exerciseId: 'e1', order: 0, clientExerciseId: 'we:abc' });
  ok('addExercise: Dedup onConflict user_id,client_exercise_id', shape(r) && r.success && CAP['workout_exercises'].opts.onConflict === 'user_id,client_exercise_id' && CAP['workout_exercises'].row.client_exercise_id === 'we:abc');

  // Sportart-Normalisierung (verhindert getrennte Kategorien)
  ok('normSport: Gym/Krafttraining/Strength → gym', T.normSport('Gym') === 'gym' && T.normSport('Krafttraining') === 'gym' && T.normSport('Strength') === 'gym');
  ok('normSport: Laufen/run → running; Rad/Radfahren → cycling', T.normSport('Laufen') === 'running' && T.normSport('run') === 'running' && T.normSport('Rad') === 'cycling' && T.normSport('Radfahren') === 'cycling');
  // TEIL A: kein 'athletics'-Raten mehr. Unbekannt → strict null / sicher 'other'.
  ok('normSportStrict: unbekannt → null (KEIN athletics)', T.normSportStrict('Yoga') === null && T.normSportStrict('quidditch') === null);
  ok('normSport: unbekannt → other (NICHT athletics), null → null', T.normSport('Yoga') === 'other' && T.normSport('Quidditch') === 'other' && T.normSport(null) === null);
  ok('neue kanonische IDs: Basketball/Rudern/Wandern/Gehen', T.normSport('Basketball') === 'basketball' && T.normSport('Rudern') === 'rowing' && T.normSport('Wandern') === 'hiking' && T.normSport('Gehen') === 'walking');
  ok('Padel/Paddel → padel; Leichtathletik → athletics', T.normSport('Padel') === 'padel' && T.normSport('Paddel') === 'padel' && T.normSport('Leichtathletik') === 'athletics');
  ok('KEINE Eingabe wird fälschlich zu athletics', ['Wandern', 'Rudern', 'Gehen', 'Basketball', 'Yoga', 'Quidditch'].every(v => T.normSport(v) !== 'athletics'));
  ok('Mobility ist EIGENE Sportart (NICHT gym)', T.normSport('Mobilität') === 'mobility' && T.normSport('mobility') === 'mobility' && T.normSportStrict('Mobility') === 'mobility');
  ok('normSport(x) ∈ ACTIVITY_SPORTS für jede nicht-leere Eingabe', ['Gym', 'Laufen', 'Mobilität', 'Yoga', 'Rad', 'tennis', 'Krafttraining', 'Wandern'].every(v => T.ACTIVITY_SPORTS.indexOf(T.normSport(v)) >= 0));
  ok('valid.sport bleibt für trainierbare Sportarten true', ['Gym', 'Laufen', 'tennis', 'Krafttraining'].every(v => T.valid.sport(T.normSport(v))));

  // createSession setzt normalisierten sport_key (Anzeige sport bleibt erhalten)
  CAP = {}; r = await O.repos.workout.createSession({ localDate: '2026-06-19', sport: 'Laufen', clientSessionId: 'cs1' });
  ok('createSession: sport_key normalisiert (running), sport=Anzeige', CAP['workout_sessions'].row.sport_key === 'running' && CAP['workout_sessions'].row.sport === 'Laufen');

  // user_sports: Konflikt-Key user_id,sport + getrennte Position
  CAP = {}; r = await O.repos.sport.saveUserSport({ sport: 'football', sportKey: 'football', positionKey: 'st', level: 'experienced', role: 'main' });
  ok('saveUserSport: onConflict user_id,sport + position_key getrennt', CAP['user_sports'].opts.onConflict === 'user_id,sport' && CAP['user_sports'].row.position_key === 'st' && CAP['user_sports'].row.sport === 'football');

  // user_goals mit Sport-/Positionsbezug + gym_goal_type
  CAP = {}; r = await O.repos.sport.saveUserGoal({ clientGoalId: 'g1', type: 'sport_performance', sportKey: 'football', positionKey: 'st', gymGoalType: 'explosiveness', title: 'Explosivität' });
  ok('saveUserGoal: sport_key/position_key/gym_goal_type', CAP['user_goals'].row.sport_key === 'football' && CAP['user_goals'].row.position_key === 'st' && CAP['user_goals'].row.gym_goal_type === 'explosiveness');

  // Session createSession: client_session_id → Konflikt-Key
  CAP = {}; r = await O.repos.workout.createSession({ localDate: '2026-06-19', sport: 'Gym', clientSessionId: 'sess:1', status: 'active' });
  ok('createSession: client_session_id → onConflict user_id,client_session_id', CAP['workout_sessions'].opts.onConflict === 'user_id,client_session_id' && CAP['workout_sessions'].row.status === 'active');

  // copyFromTemplate: Vorlage → Plan + Tage + Übungen (Vorlage unverändert)
  RET = { workout_template_days: [{ id: 'd1', day_index: 0, name: 'Ganzkörper A', workout_template_exercises: [{ exercise_id: 'e1', order_index: 0, planned_sets: 3, min_reps: 5, max_reps: 8 }] }], user_training_plans: [{ id: 'p1' }], training_plan_days: [{ id: 'pd1' }] };
  CAP = {}; r = await O.repos.trainingPlan.copyFromTemplate('t1', 'Mein Plan');
  ok('copyFromTemplate: Plan erstellt (planId)', shape(r) && r.success && r.data.planId === 'p1');
  ok('copyFromTemplate: Plan-Tag + Plan-Übung geschrieben', !!CAP['training_plan_days'] && !!CAP['training_plan_exercises']);

  // saveUserSport: sport_key normalisiert
  CAP = {}; await O.repos.sport.saveUserSport({ sport: 'Gym', role: 'main' });
  ok('saveUserSport: sport_key normalisiert (Gym→gym)', CAP['user_sports'].row.sport_key === 'gym' && CAP['user_sports'].row.sport === 'Gym');

  // listSets: Offline-Guard (analog listSessions)
  navigator.onLine = false; const ls = await O.repos.workout.listSets('we1');
  ok('listSets: Offline → success false, indexeddb', shape(ls) && !ls.success && ls.source === 'indexeddb');
  navigator.onLine = true;

  // ---- SQL-Statik (Migration 0003) ----
  const sql = fs.readFileSync(new URL('../../supabase/migrations/0003_training_domain.sql', import.meta.url), 'utf8');
  const dmlIdx = sql.indexOf('Volles DML');
  const dmlSection = dmlIdx >= 0 ? sql.slice(dmlIdx, dmlIdx + 800) : '';
  ok('SQL: Junctions/Template-Kinder im Full-DML-GRANT', ['exercise_muscles', 'exercise_equipment', 'exercise_training_qualities', 'exercise_alternatives', 'workout_template_days', 'workout_template_exercises'].every(t => dmlSection.includes("'" + t + "'")));
  ok('SQL: reiner Katalog nur SELECT (nicht im DML-Block)', /REINER Katalog/.test(sql) && !dmlSection.includes("'sports'") && !dmlSection.includes("'muscle_groups'"));
  ok('SQL: Unique-Indizes (sets + exercises) vorhanden', sql.includes('workout_sets_uniq') && sql.includes('workout_exercises_uniq'));
  ok('SQL: Cross-User-Helferfunktionen vorhanden', ['orvia_exercise_allowed', 'orvia_template_allowed', 'orvia_own_plan', 'orvia_own_session', 'orvia_own_workout_exercise'].every(f => sql.includes(f)));
  ok('SQL: template_exercises prüft orvia_exercise_allowed(exercise_id)', /workout_template_exercises[\s\S]*?orvia_exercise_allowed\(exercise_id\)/.test(sql));

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.error('Harness-Fehler:', e); process.exit(2); });
