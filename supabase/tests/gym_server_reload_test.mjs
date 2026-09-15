/* ORVIA · gym_server_reload — v8-383: Server-Workouts (mit und ohne activities-Zeile) landen in Muskelkarte und Kraftprofil
   node supabase/tests/gym_server_reload_test.mjs */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')].find(p => existsSync(join(p, 'js', 'gym-volume.js'))) || _flat);
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const GV = require(join(APP, 'js/gym-volume.js'));
const O = globalThis.ORVIA;
const D = i => new Date(Date.now() - i * 864e5).toISOString();
O.activityStore = { listActivities: () => [], isTombstoned: () => false };
O.activityServerCache = () => [];
const CAT = [{ id: 'ex1', slug: 'lat_pulldown_close', name: 'Latzug eng', baseSlug: 'lat_pulldown', movementPattern: 'vertical_pull', muscles: { lats: { weight: 1, involvement: 'direct' }, biceps: { weight: 0.5, involvement: 'indirect' } } },
  { id: 'ex2', slug: 'chest_press_machine', name: 'Brustpresse Maschine', baseSlug: 'chest_press', movementPattern: 'horizontal_push', muscles: { chest: { weight: 1, involvement: 'direct' }, triceps: { weight: 0.4, involvement: 'indirect' } } }];
const TREES = {
  s1: { session: { id: 's1', started_at: D(3), local_date: D(3).slice(0, 10), status: 'completed' }, exercises: [{ workoutExercise: { exercise_id: 'ex1' }, exercise: { id: 'ex1', slug: 'lat_pulldown_close', name: 'Latzug eng', movement_pattern: 'vertical_pull' }, sets: [{ set_number: 1, weight: 60, reps: 8, completed: true, set_type: 'working' }, { set_number: 2, weight: 60, reps: 8, completed: true, set_type: 'working' }] }] },
  s2: { session: { id: 's2', started_at: D(10), local_date: D(10).slice(0, 10), status: 'completed' }, exercises: [{ workoutExercise: { exercise_id: 'ex2' }, exercise: { id: 'ex2', slug: 'chest_press_machine', name: 'Brustpresse Maschine', movement_pattern: 'horizontal_push' }, sets: [{ set_number: 1, weight: 80, reps: 10, completed: true }] }] }
};
let listCalls = 0, sessCalls = 0;
O.repos = {
  exercise: { list: async () => { listCalls++; return { success: true, data: CAT }; } },
  activity: { list: async () => ({ success: true, data: [{ id: 'a1', sport_id: 'gym', source: 'orvia_workout', status: 'completed', workout_session_id: 's1', started_at: D(3) }] }) },
  workout: { loadWorkoutTree: async id => ({ success: true, data: TREES[id] }), listSessions: async () => { sessCalls++; return { success: true, data: [{ id: 's1', status: 'completed', sport: 'Gym', local_date: D(3).slice(0, 10) }, { id: 's2', status: 'completed', sport: 'Gym', local_date: D(10).slice(0, 10) }, { id: 's3', status: 'aborted', sport: 'Gym' }] }; } }
};
O.activityConfig = { normalizeServerActivity: r => ({ id: r.id, sportId: r.sport_id, source: r.source, status: r.status, workoutSessionId: r.workout_session_id, startedAt: r.started_at }) };
const before = GV.gymPipeline({ days: 365 });
ok('A1 vor dem Nachladen: synchroner Pfad sieht 0 Einheiten (nur lokale Snapshots)', before.snapshots.length === 0);
const r = await GV.gymPipelineAsync({ days: 365, refresh: true });
ok('A2 refresh: Session mit activities-Zeile (s1) UND verwaiste Session ohne Zeile (s2) nachgeladen, abgebrochene (s3) nicht', r.snapshots.length === 2 && r.snapshots.some(w => w.workoutId === 's1') && r.snapshots.some(w => w.workoutId === 's2'), JSON.stringify(r.snapshots.map(w => w.workoutId)));
ok('A3 Katalog wurde einmal geladen, listSessions einmal befragt', listCalls === 1 && sessCalls === 1);
const ex1 = r.snapshots.find(w => w.workoutId === 's1').exercises[0];
ok('A4 Baum-Uebung traegt exerciseId/slug/movementPattern/muscles aus dem Katalog', ex1.exerciseId === 'ex1' && ex1.slug === 'lat_pulldown_close' && ex1.movementPattern === 'vertical_pull' && ex1.muscles && ex1.muscles.lats);
ok('A5 Klassifikation ueber Katalog: „Latzug eng" (kein Namenstreffer in NAME_MUSCLES) → lats direkt, biceps 0,5', JSON.stringify(GV.musclesFor(ex1)) === JSON.stringify({ lats: 'direct', biceps: 0.5 }));
const mv = GV.computeMuscleVolume(r.snapshots, {});
ok('A6 Muskelvolumen aus beiden Server-Einheiten: lats 2 reale Saetze, chest 1', mv.byMuscle.lats && mv.byMuscle.lats.realWorkingSets === 2 && mv.byMuscle.chest && mv.byMuscle.chest.realWorkingSets === 1 && Object.keys(mv.unclassified).length === 0);
const after = GV.gymPipeline({ days: 365 });
ok('A7 nach dem Nachladen: synchroner Pfad (Kraftwerte/Kraftprofil-Teaser) sieht dieselben 2 Einheiten', after.snapshots.length === 2 && GV.lastTreeSessions().length === 2);
const SP = readFileSync(join(APP, 'js/screens/strength-profile.js'), 'utf8'), UI = readFileSync(join(APP, 'js/ui.js'), 'utf8');
ok('B1 Kraftprofil laedt beim Oeffnen und im Teaser per gymPipelineAsync(refresh) nach und rendert danach neu', /gymPipelineAsync\(\{ days: 365, refresh: true \}\)/.test(SP) && /refreshAsync\(function \(\) \{ render\(\); \}\)/.test(SP) && /root\.renderGMAnalysis\(\)/.test(SP));
ok('B2 Teaser ohne doppelte Zeile; Muskelkarte ohne „——" bei fehlendem Korridor', !/if\(!parts\.length\)parts\.push\(_uiT\('kp\.teaser_sessions'/.test(UI) && /kp\.src_korridor_leer/.test(SP));
const WR = readFileSync(join(APP, 'js/repos/workoutRepository.js'), 'utf8');
ok('C1 loadWorkoutTree: Embed mit FK-Hinweis (zwei FKs auf exercises) + Fallback ohne Embed', /exercises!workout_exercises_exercise_id_fkey\(\*\)/.test(WR) && /select\('\*, workout_sets\(\*\)'\)/.test(WR) && /from\('exercises'\)\.select\('\*'\)\.in\('id', ids\)/.test(WR));
ok('C2 gym-volume: Einzelausfall eines Baums ist partial, nur Totalausfall Fehler', /WORKOUT_DETAILS_PARTIAL/.test(readFileSync(join(APP, 'js/gym-volume.js'), 'utf8')));
console.log('\ngym_server_reload: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
if (fail) process.exit(1);
