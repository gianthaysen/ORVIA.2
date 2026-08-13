/* ORVIA · v8-322 — Die Kraftvorgabe kommt wirklich an (Kraftplan v2, K1-Rest + K9)

   BEFUND (externer Audit gegen den Mac-Checkout, Stand v8-321 — und er hat
   recht): Migration 0035 legte `target_weight_kg` an, und KEIN EINZIGER
   Schreibpfad füllte die Spalte. `trainingPlanRepository.addPlanExercise`,
   `workoutRepository.addExercise` und der Offline-Builder `buildExerciseRow`
   kannten das Feld nicht. Der Datenvertrag `strength-plan.js` konnte ein
   Zielgewicht ausdrücken — es wäre nur nirgends gelandet. Das ist genau die
   Klasse „gebaut, aber nicht angeschlossen", und der Plan verlangt in K1
   ausdrücklich: „vorhandene Sollwerte vollständig durch Online- UND
   Offline-Schreibpfad führen".

   Zweiter Befund derselben Runde: der Offline-Builder verlor gegenüber dem
   Online-Mapper still `target_rpe`, `completed` und `replaced_by_exercise_id`
   (workout_exercises) sowie `plan_id`, `plan_day_id` und `perceived_effort`
   (workout_sessions). Wer offline arbeitete, verlor diese Angaben dauerhaft,
   weil die Queue die Payload unverändert durchschreibt.

   Dritter Befund: der Plan-Snapshot trug nur t/l/d. Die geplanten Übungen
   gingen beim Sessionstart verloren — und der einzige Pfad, der überhaupt
   Planübungen anlegte (`startPlannedWorkout`), hat bis heute NULL Aufrufer.

   Geprüft wird VERHALTEN gegen die ECHTEN Module (repoBase, workoutRepository,
   trainingPlanRepository, offline-queue, workout-store, strength-plan) mit
   einem Supabase-Fake und einem IndexedDB-Shim — nicht die Rechnung des
   Prüflings nachgebaut (Bauplan §17.8):
     P1 Paritäts-EIGENSCHAFT: Online-Mapper und Offline-Builder schreiben
        dieselbe Spaltenmenge (fängt die ganze Klasse künftig ab)
     P2 Zielgewicht erreicht online die Datenbank
     P3 Zielgewicht erreicht offline die Queue
     P4 Session-Paritätslücke geschlossen — und keine stillen NULLs
     P5 Planübung wird mit Zielgewicht gespeichert
     P6 startPlannedWorkout übernimmt das Zielgewicht
     P7 Der ECHTE Startpfad übernimmt die geplanten Übungen
     P8 Keine Regression: ohne Vorgaben passiert nichts
     P9 Eine misslungene Übernahme wird gemeldet, nicht verschluckt
     P10 startPlannedUnit hängt die Vorgaben an den Snapshot (Verhalten)

   node supabase/tests/strength_target_wiring_test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const base = new URL(_APPREL + 'js/', import.meta.url);
const src = f => readFileSync(new URL(f, base), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* ── Minimaler IndexedDB-Shim (nur die von offline-queue.js benutzten Pfade).
      Ehrlich: Shim ≠ echte Browser-IndexedDB. ── */
function makeIDB() {
  const stores = {};
  function mkStore(name, opts) {
    const s = { name, keyPath: opts.keyPath, seq: 0, rows: new Map(), indexes: {} };
    stores[name] = s; return s;
  }
  function req(fn) { const r = {}; setTimeout(() => { try { const v = fn(); r.result = v; r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; }
  const dbApi = {
    objectStoreNames: { contains: n => !!stores[n] },
    createObjectStore: (n, o) => { const s = mkStore(n, o); return { createIndex: (i, kp) => { s.indexes[i] = kp; } }; },
    transaction: (name) => {
      const s = stores[name], tx = {};
      const osApi = {
        add: v => { const c = JSON.parse(JSON.stringify(v)); c.id = ++s.seq; s.rows.set(c.id, c); return {}; },
        put: v => { s.rows.set(v.id, JSON.parse(JSON.stringify(v))); return {}; },
        delete: id => { s.rows.delete(id); return {}; },
        get: id => req(() => (s.rows.has(id) ? JSON.parse(JSON.stringify(s.rows.get(id))) : undefined)),
        index: iname => ({
          openCursor: range => {
            const r = {};
            const m = [...s.rows.values()].filter(v => v[s.indexes[iname]] === range.only).map(v => JSON.parse(JSON.stringify(v)));
            let i = 0;
            function step() {
              r.result = i < m.length ? { value: m[i], continue: () => { i++; setTimeout(step, 0); }, delete: () => { s.rows.delete(m[i].id); } } : null;
              r.onsuccess && r.onsuccess();
            }
            setTimeout(step, 0);
            return r;
          }
        })
      };
      tx.objectStore = () => osApi;
      setTimeout(() => setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 2), 1);
      return tx;
    }
  };
  /* onupgradeneeded MUSS feuern — sonst legt offline-queue.js seine Indizes nie
     an, und pendingForCurrentUser() findet nichts, obwohl Zeilen da sind. */
  return {
    open: () => {
      const r = {};
      setTimeout(() => {
        r.result = dbApi;
        if (!stores.queue) { r.onupgradeneeded && r.onupgradeneeded(); }
        if (!stores.queue) dbApi.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        r.onsuccess && r.onsuccess();
      }, 0);
      return r;
    },
    _stores: stores
  };
}

/* ── Sandbox mit den ECHTEN Modulen und einem Supabase-Fake ── */
function makeSb(opts) {
  opts = opts || {};
  const ls = {};
  const sb = {}; sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.Math = Math; sb.JSON = JSON; sb.Array = Array; sb.Object = Object;
  sb.String = String; sb.Number = Number; sb.Set = Set; sb.Map = Map; sb.Promise = Promise;
  sb.isNaN = isNaN; sb.isFinite = isFinite; sb.Intl = Intl; sb.Error = Error;
  sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
  sb.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  sb.todayStr = d => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  sb.navigator = { onLine: opts.online !== false };
  sb.addEventListener = () => {};
  sb.indexedDB = makeIDB();
  sb.IDBKeyRange = { only: v => ({ only: v }) };

  const upserts = [];      // { table, payload, onConflict }
  sb._upserts = upserts;
  sb._rows = opts.rows || {};   // table -> array (Lesepfade)
  const mkQuery = table => {
    const q = {
      _f: [],
      select: () => q, eq: () => q, order: () => q, limit: () => q,
      then: (res) => res({ data: sb._rows[table] || [], error: null })
    };
    return q;
  };
  sb.ORVIA = { user: { id: 'u1' } };
  sb.ORVIA.sb = {
    from: table => ({
      upsert: (payload, o) => ({
        select: async () => {
          upserts.push({ table, payload: JSON.parse(JSON.stringify(payload)), onConflict: o && o.onConflict });
          if (opts.upsertFails && opts.upsertFails(table, payload)) return { data: null, error: { message: 'kaputt' } };
          return { data: [Object.assign({ id: 'srv-' + upserts.length }, payload)], error: null };
        }
      }),
      select: () => mkQuery(table),
      update: (patch) => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [patch], error: null }) }) }) })
    })
  };
  vm.createContext(sb);
  ['training-domain.js', 'engine/strength-plan.js', 'repos/repoBase.js',
    'repos/workoutRepository.js', 'repos/trainingPlanRepository.js', 'repos/exerciseRepository.js',
    'activity-normalize.js', 'activity-store.js', 'offline-queue.js', 'workout-store.js']
    .forEach(f => vm.runInContext(src(f), sb, { filename: f }));
  return sb;
}

const EX_A = { exerciseId: 'ex-bench', sets: 4, minReps: 6, maxReps: 8, targetWeightKg: 82.5, restSeconds: 150 };
const EX_B = { exerciseId: 'ex-row', sets: 3, minReps: 8, maxReps: 10, targetWeightKg: 65, restSeconds: 120 };

/* ══ P1 · Paritäts-EIGENSCHAFT ══
   Der eigentlich wertvolle Test: nicht „schreibt Feld X?", sondern „schreiben
   beide Wege DIESELBE Spaltenmenge?". Genau diese Eigenschaft war verletzt und
   hätte den Fund von 2026-08-12 vorweggenommen. */
sec('P1 · Feldparität als Eigenschaft (Online ⇄ Offline)');
const DTO = {
  clientExerciseId: 'we-1', exerciseId: 'ex-bench', order: 0, plannedSets: 4,
  minReps: 6, maxReps: 8, targetRir: 2, targetRpe: 8, targetWeightKg: 82.5,
  restSeconds: 150, notes: 'schwer', completed: false, replacedBy: null
};
{
  const on = makeSb({ online: true });
  await on.ORVIA.repos.workout.addExercise('sess-1', DTO);
  const onlineRow = on._upserts.find(u => u.table === 'workout_exercises').payload;

  const off = makeSb({ online: false });
  const offlineRow = off.ORVIA.workoutStore._buildExerciseRowForTest
    ? off.ORVIA.workoutStore._buildExerciseRowForTest({ id: 'sess-1' }, DTO) : null;

  /* Kein Testhaken im Produktcode: der Offline-Builder wird über den ECHTEN
     Weg erreicht — Session offline starten, Übung anlegen, Queue lesen. */
  const off2 = makeSb({ online: false });
  const WS2 = off2.ORVIA.workoutStore;
  await WS2.startFreeWorkout({ sport: 'Gym' });
  await WS2.addExercise('ex-bench', {
    plannedSets: 4, minReps: 6, maxReps: 8, targetRir: 2, targetRpe: 8,
    targetWeightKg: 82.5, restSeconds: 150, notes: 'schwer'
  });
  const pending = await off2.ORVIA.offlineQueue.pendingForCurrentUser();
  const offRow = (pending.find(p => p.table === 'workout_exercises') || {}).payload || {};

  const onKeys = Object.keys(onlineRow).filter(k => k !== 'user_id').sort();
  const offKeys = Object.keys(offRow).filter(k => k !== 'user_id').sort();
  const onlyOnline = onKeys.filter(k => offKeys.indexOf(k) < 0);
  const onlyOffline = offKeys.filter(k => onKeys.indexOf(k) < 0);
  ok('der Online-Mapper wurde überhaupt erreicht', onKeys.length > 5, onKeys.join(','));
  ok('der Offline-Builder wurde über den ECHTEN Queue-Weg erreicht', offKeys.length > 5, offKeys.join(','));
  ok('workout_exercises: KEINE Spalte nur online (offline ginge sie dauerhaft verloren)',
    onlyOnline.length === 0, onlyOnline.join(', '));
  ok('workout_exercises: keine Spalte nur offline', onlyOffline.length === 0, onlyOffline.join(', '));
  ok('  … und die vier vorher fehlenden Felder sind wirklich dabei',
    ['target_rpe', 'completed', 'replaced_by_exercise_id', 'target_weight_kg'].every(k => offKeys.indexOf(k) >= 0),
    offKeys.join(','));
  void offlineRow;
}

/* ══ P2 · Zielgewicht online ══ */
sec('P2 · Zielgewicht erreicht online die Datenbank');
{
  const on = makeSb({ online: true });
  await on.ORVIA.repos.workout.addExercise('sess-1', DTO);
  const row = on._upserts.find(u => u.table === 'workout_exercises').payload;
  ok('target_weight_kg steht in der Payload', row.target_weight_kg === 82.5, JSON.stringify(row.target_weight_kg));
  const on2 = makeSb({ online: true });
  await on2.ORVIA.repos.workout.addExercise('sess-1', Object.assign({}, DTO, { targetWeightKg: undefined }));
  const row2 = on2._upserts.find(u => u.table === 'workout_exercises').payload;
  ok('ohne Vorgabe wird NULL geschrieben, keine erfundene Zahl', row2.target_weight_kg === null, JSON.stringify(row2.target_weight_kg));
  const on3 = makeSb({ online: true });
  await on3.ORVIA.repos.workout.addExercise('sess-1', Object.assign({}, DTO, { targetWeightKg: 0 }));
  ok('0 kg überlebt (Körpergewichtsübung wird nicht zu NULL)',
    on3._upserts.find(u => u.table === 'workout_exercises').payload.target_weight_kg === 0);
}

/* ══ P3 · Zielgewicht offline ══ */
sec('P3 · Zielgewicht erreicht offline die Queue');
{
  const off = makeSb({ online: false });
  const WS = off.ORVIA.workoutStore;
  await WS.startFreeWorkout({ sport: 'Gym' });
  await WS.addExercise('ex-bench', { plannedSets: 4, targetWeightKg: 82.5 });
  const pending = await off.ORVIA.offlineQueue.pendingForCurrentUser();
  const row = (pending.find(p => p.table === 'workout_exercises') || {}).payload || {};
  ok('target_weight_kg steht in der Queue-Payload', row.target_weight_kg === 82.5, JSON.stringify(row.target_weight_kg));
  off.navigator.onLine = true;                 // wieder online: erst jetzt darf geflusht werden
  const fl = await off.ORVIA.offlineQueue.flush();
  ok('  … und überlebt den ECHTEN Flush', fl.failed === 0 &&
    (off._upserts.find(u => u.table === 'workout_exercises') || { payload: {} }).payload.target_weight_kg === 82.5,
    JSON.stringify(fl));
}

/* ══ P4 · Session-Paritätslücke ══ */
sec('P4 · Session: plan_id / plan_day_id / perceived_effort');
{
  const off = makeSb({ online: false });
  const WS = off.ORVIA.workoutStore;
  await WS.startFreeWorkout({ sport: 'Gym' });
  const pending = await off.ORVIA.offlineQueue.pendingForCurrentUser();
  const row = (pending.find(p => p.table === 'workout_sessions') || {}).payload || {};
  /* Ohne Planbezug dürfen die Felder NICHT als NULL mitfahren: ein späterer
     Upsert derselben client_session_id würde sonst einen bereits gesetzten
     Wert überschreiben. */
  ok('ohne Planbezug fahren die Felder NICHT als stille NULL mit',
    !('plan_id' in row) && !('plan_day_id' in row) && !('perceived_effort' in row),
    Object.keys(row).filter(k => /plan_id|plan_day_id|perceived/.test(k)).join(','));
  ok('der Offline-Builder kennt die drei Felder überhaupt (Quelltextvertrag)',
    /plan_id:/.test(src('workout-store.js')) && /plan_day_id:/.test(src('workout-store.js')) &&
    /perceived_effort:/.test(src('workout-store.js')));
}

/* ══ P5 · Planübung mit Zielgewicht ══ */
sec('P5 · training_plan_exercises trägt das Zielgewicht');
{
  const on = makeSb({ online: true });
  await on.ORVIA.repos.trainingPlan.addPlanExercise('day-1', {
    exerciseId: 'ex-bench', order: 1, plannedSets: 4, minReps: 6, maxReps: 8,
    targetRir: 2, targetWeightKg: 82.5, restSeconds: 150
  });
  const row = on._upserts.find(u => u.table === 'training_plan_exercises').payload;
  ok('target_weight_kg steht in der Payload', row.target_weight_kg === 82.5, JSON.stringify(row));
}
{
  const s2 = makeSb({ online: true });
  await s2.ORVIA.repos.trainingPlan.addPlanExercise('day-1', { exerciseId: 'x', plannedSets: 3 });
  ok('ohne Vorgabe NULL statt Ersatzwert', s2._upserts.find(u => u.table === 'training_plan_exercises').payload.target_weight_kg === null);
}

/* ══ P6 · startPlannedWorkout ══ */
sec('P6 · startPlannedWorkout übernimmt das Zielgewicht');
{
  const on = makeSb({
    online: true,
    rows: {
      training_plan_exercises: [{ exercise_id: 'ex-bench', order_index: 0, planned_sets: 4, min_reps: 6, max_reps: 8, target_rir: 2, target_weight_kg: 82.5, rest_seconds: 150, notes: null }],
      workout_sessions: []
    }
  });
  const r = await on.ORVIA.workoutStore.startPlannedWorkout('day-1');
  ok('der Start läuft durch', r.success === true, JSON.stringify(r.error || ''));
  const exRow = on._upserts.filter(u => u.table === 'workout_exercises').map(u => u.payload).pop();
  ok('die Planübung landet in der Session', !!exRow, JSON.stringify(on._upserts.map(u => u.table)));
  ok('  … MIT dem Zielgewicht (vorher ging es hier verloren)', exRow && exRow.target_weight_kg === 82.5,
    exRow ? JSON.stringify(exRow.target_weight_kg) : '—');
}

/* ══ P7 · Der ECHTE Startpfad ══
   startPlannedUnit → workoutUI.startSport → startFreeWorkout({planSnapshot}).
   Genau hier gingen die geplanten Übungen bisher verloren, weil dieser Weg
   grundsätzlich eine leere Session anlegte. */
sec('P7 · Übernahme beim echten Startpfad');
{
  const on = makeSb({
    online: true,
    rows: { exercises: [{ id: 'ex-bench', name: 'Bankdrücken' }, { id: 'ex-row', name: 'Rudern' }], workout_sessions: [] }
  });
  const snap = {
    occurrenceId: 'po:2026-08-12:ps:g1', templateSessionId: 'ps:g1', plannedDate: '2026-08-12',
    t: 'Gym', l: 'Oberkörper', d: '45 min', capturedAt: 1,
    plannedExercises: on.ORVIA.strengthPlan.normalizePlanned([EX_A, EX_B]).exercises
  };
  const r = await on.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', plannedSessionId: snap.occurrenceId, planSnapshot: snap });
  ok('der Start läuft durch', r.success === true, JSON.stringify(r.error || ''));
  ok('das Ergebnis meldet die Übernahme (nicht still)', !!(r.data && r.data.plannedApplied), JSON.stringify(r.data && r.data.plannedApplied));
  ok('  … zwei geplante, zwei angelegt, keine misslungen',
    r.data.plannedApplied.planned === 2 && r.data.plannedApplied.applied === 2 && r.data.plannedApplied.failed === 0,
    JSON.stringify(r.data.plannedApplied));
  const exRows = on._upserts.filter(u => u.table === 'workout_exercises').map(u => u.payload);
  ok('beide Übungen sind wirklich in der Datenbank gelandet', exRows.length === 2, String(exRows.length));
  /* Defensiv lesen: eine abgeschaltete Uebernahme soll eine LESBARE rote Zeile
     erzeugen, keinen Absturz (Mutationsproben N4/N7 stuerzten sonst ab). */
  const e0 = exRows[0] || {}, e1 = exRows[1] || {};
  ok('  … in der geplanten Reihenfolge', e0.exercise_id === 'ex-bench' && e1.exercise_id === 'ex-row',
    JSON.stringify([e0.exercise_id, e1.exercise_id]));
  ok('  … mit den Zielgewichten 82,5 und 65 kg',
    e0.target_weight_kg === 82.5 && e1.target_weight_kg === 65,
    JSON.stringify(exRows.map(x => x.target_weight_kg)));
  ok('  … mit Sätzen und Wiederholungsbereich',
    e0.planned_sets === 4 && e0.min_reps === 6 && e0.max_reps === 8);
  ok('der Anzeigename wird aufgelöst, wenn die Bibliothek erreichbar ist',
    ((on.ORVIA.workout.exercises[0] || {}).exercise || {}).name === 'Bankdrücken',
    JSON.stringify((on.ORVIA.workout.exercises[0] || {}).exercise));
}
{
  /* Offline gibt es die Bibliothek nicht — die Übung muss trotzdem entstehen.
     Der Name ist fail-open, die Übung selbst nicht. */
  const off = makeSb({ online: false });
  const snap = {
    occurrenceId: 'po:2026-08-12:ps:g1', t: 'Gym', l: 'Oberkörper', capturedAt: 1,
    plannedExercises: off.ORVIA.strengthPlan.normalizePlanned([EX_A]).exercises
  };
  const r = await off.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  ok('offline entsteht die Übung trotzdem (die exercise_id ist die Wahrheit)',
    r.success === true && r.data.plannedApplied.applied === 1, JSON.stringify(r.data && r.data.plannedApplied));
  const pending = await off.ORVIA.offlineQueue.pendingForCurrentUser();
  const row = (pending.find(p => p.table === 'workout_exercises') || {}).payload || {};
  ok('  … mit Zielgewicht in der Queue', row.target_weight_kg === 82.5, JSON.stringify(row.target_weight_kg));
}

/* ══ P8 · Keine Regression ══ */
sec('P8 · Ohne Vorgaben passiert nichts');
{
  const on = makeSb({ online: true, rows: { workout_sessions: [] } });
  const snap = { occurrenceId: 'po:2026-08-12:ps:r1', t: 'Laufen', l: 'Intervalle', d: 'iv', capturedAt: 1 };
  const r = await on.ORVIA.workoutStore.startFreeWorkout({ sport: 'Laufen', planSnapshot: snap });
  ok('eine Laufeinheit startet unverändert', r.success === true);
  ok('  … ohne Übernahmeversuch', r.data.plannedApplied === null, JSON.stringify(r.data.plannedApplied));
  ok('  … und ohne angelegte Übungen', on._upserts.filter(u => u.table === 'workout_exercises').length === 0);
  ok('der Snapshot bleibt unverändert (kein leeres Feld im unveränderlichen Anker)',
    !('plannedExercises' in (on._upserts.find(u => u.table === 'workout_sessions').payload.planned_session_snapshot || {})));
}
{
  const on = makeSb({ online: true, rows: { workout_sessions: [] } });
  const r = await on.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym' });
  ok('ein freies Workout ohne Snapshot startet unverändert', r.success === true && r.data.plannedApplied === null);
}

/* ══ P9 · Misslungene Übernahme wird gemeldet ══ */
sec('P9 · Fehler werden gezählt, nicht verschluckt');
{
  const on = makeSb({
    online: true,
    rows: { exercises: [], workout_sessions: [] },
    upsertFails: (table) => table === 'workout_exercises'
  });
  const snap = {
    occurrenceId: 'po:2026-08-12:ps:g1', t: 'Gym', capturedAt: 1,
    plannedExercises: on.ORVIA.strengthPlan.normalizePlanned([EX_A, EX_B]).exercises
  };
  const r = await on.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  ok('die Session entsteht trotzdem (ein Übungsfehler killt nicht das Training)', r.success === true);
  ok('beide Fehlschläge werden GEZÄHLT und gemeldet',
    r.data.plannedApplied.failed === 2 && r.data.plannedApplied.applied === 0,
    JSON.stringify(r.data.plannedApplied));
}

/* ══ P11 · Lücken aus dem Probenlauf v8-331 ══
   Drei Zusicherungen dieses Moduls waren beschrieben, aber von keinem Test
   gedeckt — die Mutationen blieben grün. */
sec('P11 · Bedeutung, Fail-open und Grund');
{
  /* T2 — der schwerste der drei. `strength-plan@1` hält ausdrücklich fest:
     0 kg heisst „ohne Zusatzlast" [A1], NICHT „keine Angabe". Eine truthy-
     Prüfung statt != null macht aus der Aussage ein Schweigen: Klimmzüge ohne
     Zusatzgewicht wären künftig nicht von „Gewicht unbekannt" zu unterscheiden. */
  const on = makeSb({ online: true });
  await on.ORVIA.repos.workout.addExercise('sess-1', Object.assign({}, DTO, { targetWeightKg: 0 }));
  const onlineNull = on._upserts.find(u => u.table === 'workout_exercises').payload;
  ok('0 kg erreicht ONLINE als echte 0 die Datenbank (0 = ohne Zusatzlast, nicht „keine Angabe")',
    onlineNull.target_weight_kg === 0, JSON.stringify(onlineNull.target_weight_kg));

  const off = makeSb({ online: false });
  const WS = off.ORVIA.workoutStore;
  await WS.startFreeWorkout({ sport: 'Gym' });
  await WS.addExercise('ex-pullup', { plannedSets: 3, minReps: 8, maxReps: 8, targetWeightKg: 0 });
  const q = await off.ORVIA.offlineQueue.pendingForCurrentUser();
  const offRow = (q.find(p => p.table === 'workout_exercises') || {}).payload || {};
  ok('  … und OFFLINE ebenso (0 überlebt die Queue, wird nicht zu null)',
    offRow.target_weight_kg === 0, JSON.stringify(offRow.target_weight_kg));
  /* Gegenprobe — sonst wäre „0 kommt an" auch erfüllt, wenn ALLES als 0
     ankäme. Bewusst awaited: eine nicht abgewartete Zusage ergäbe einen
     grünen Test ohne Aussagewert (Bauplan §17.8). */
  const o2 = makeSb({ online: true });
  await o2.ORVIA.repos.workout.addExercise('sess-1', Object.assign({}, DTO, { targetWeightKg: null }));
  const fehlend = o2._upserts.find(u => u.table === 'workout_exercises').payload.target_weight_kg;
  ok('  … während ein wirklich fehlendes Zielgewicht null bleibt (0 und „keine Angabe" sind unterscheidbar)',
    fehlend === null, JSON.stringify(fehlend));
}
{
  /* T4 — der Anzeigename ist bewusst fail-OPEN: offline gibt es die
     Übungsbibliothek nicht, und ein fehlender Name darf die Übung nicht
     verhindern. Geprüft wurde bisher nur der Erfolgsfall MIT Bibliothek. */
  /* WICHTIG für die Aussagekraft: der fail-open-Zweig sitzt im catch der
     Namensabfrage, und die läuft NUR online. Ein Offline-Fall würde ihn gar
     nicht erreichen und der Test wäre wertlos — genau daran scheiterte der
     erste Anlauf. Geprüft wird deshalb: online, aber die Bibliothek wirft. */
  const on2 = makeSb({ online: true });
  const echteListe = on2.ORVIA.repos.exercise.list;
  on2.ORVIA.repos.exercise.list = async () => { throw new Error('Bibliothek nicht erreichbar'); };
  const snap = {
    occurrenceId: 'po:2026-08-12:ps:g2', t: 'Gym', capturedAt: 1,
    plannedExercises: on2.ORVIA.strengthPlan.normalizePlanned([EX_A, EX_B]).exercises
  };
  const r = await on2.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: snap });
  on2.ORVIA.repos.exercise.list = echteListe;
  ok('scheiternde Namensabfrage verhindert die Planübungen NICHT — fail-open beim Namen',
    r.success === true && r.data.plannedApplied.applied === 2 && r.data.plannedApplied.failed === 0,
    JSON.stringify(r.data.plannedApplied));
  ok('  … die exercise_id ist dabei die Wahrheit, nicht der Name',
    on2._upserts.filter(u => u.table === 'workout_exercises')
      .every(u => typeof u.payload.exercise_id === 'string' && u.payload.exercise_id.length > 0));

  /* Gegenprobe: die Übung selbst bleibt fail-CLOSED. Nur der Name ist offen. */
  const on3 = makeSb({ online: true, rows: { exercises: [], workout_sessions: [] },
    upsertFails: (table) => table === 'workout_exercises' });
  const r3 = await on3.ORVIA.workoutStore.startFreeWorkout({ sport: 'Gym', planSnapshot: {
    occurrenceId: 'po:2026-08-12:ps:g3', t: 'Gym', capturedAt: 1,
    plannedExercises: on3.ORVIA.strengthPlan.normalizePlanned([EX_A]).exercises } });
  ok('  … eine Übung, die sich nicht anlegen lässt, bleibt dagegen fail-CLOSED (gezählt, nicht verschluckt)',
    r3.data.plannedApplied.failed === 1 && r3.data.plannedApplied.applied === 0,
    JSON.stringify(r3.data.plannedApplied));
}
{
  /* T6 — fehlt der Datenvertrag, darf das Ergebnis nicht wie „nichts zu tun"
     aussehen. Ohne den Grund liesse sich ein kaputter Aufbau nicht von einem
     leeren Plan unterscheiden. */
  const on = makeSb({ online: true });
  const echt = on.ORVIA.strengthPlan;
  delete on.ORVIA.strengthPlan;
  const r = await on.ORVIA.workoutStore.applyPlannedExercises([EX_A]);
  on.ORVIA.strengthPlan = echt;
  ok('ohne Datenvertrag wird der GRUND gemeldet (no_contract), nicht stillschweigend nichts getan',
    r.applied === 0 && r.planned === 0 && r.reason === 'no_contract', JSON.stringify(r));
  const leer = await on.ORVIA.workoutStore.applyPlannedExercises([]);
  ok('  … ein wirklich leerer Plan trägt diesen Grund NICHT (die Fälle sind unterscheidbar)',
    leer.applied === 0 && leer.reason === undefined, JSON.stringify(leer));
}

/* ══ P10 · startPlannedUnit hängt die Vorgaben an den Snapshot ══
   Verhalten, nicht Quelltextmuster: die echte Funktion wird aus ui.js
   herausgeschnitten und mit Stubs ausgeführt; geprüft wird, was bei
   workoutUI.startSport ankommt. */
sec('P10 · startPlannedUnit reicht die Vorgaben durch');
{
  const uiSrc = src('ui.js');
  const start = uiSrc.indexOf('function startPlannedUnit(');
  ok('startPlannedUnit ist in ui.js auffindbar', start > 0);
  /* Bis zur nächsten Top-Level-Funktion schneiden. */
  const rest = uiSrc.slice(start + 10);
  const end = start + 10 + rest.indexOf('\nfunction ');
  const block = uiSrc.slice(start, end);

  const sb = {}; sb.window = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.Date = Date; sb.JSON = JSON; sb.Object = Object; sb.Array = Array; sb.String = String; sb.Number = Number;
  const gym = { id: 'ps:g1', t: 'Gym', l: 'Oberkörper', d: '45 min' };
  const run = { id: 'ps:r1', t: 'Laufen', l: 'Intervalle', d: 'iv' };
  sb.activeWeekPlan = () => [[gym, run], [], [], [], [], [], []];
  sb.closeSupp = () => {};
  sb.planNoteFor = () => 'Notiz';
  sb.plannedOccurrenceIdForDate = (it, iso) => 'po:' + iso + ':' + it.id;
  sb.toast = () => {};
  const TODAY = '2026-08-12';
  sb.todayStr = () => TODAY;
  const seen = [];
  sb.ORVIA = { workoutUI: { startSport: (sport, o) => { seen.push({ sport, opts: o }); } } };
  vm.createContext(sb);
  vm.runInContext(src('training-domain.js'), sb, { filename: 'training-domain.js' });
  vm.runInContext(src('engine/strength-plan.js'), sb, { filename: 'strength-plan.js' });
  /* Die Vorgaben an das ECHTE Plan-Item hängen — über den echten Datenvertrag. */
  const withEx = sb.ORVIA.strengthPlan.attachPlanned(gym, [EX_A, EX_B]);
  gym.plannedExercises = withEx.plannedExercises;
  vm.runInContext(block, sb, { filename: 'ui.js#startPlannedUnit' });

  const r = sb.startPlannedUnit(0, 0, TODAY);
  ok('der Start wird gemeldet', r && r.ok === true, JSON.stringify(r));
  const snap = seen.length ? seen[0].opts.planSnapshot : null;
  ok('ein Snapshot wird übergeben', !!snap);
  ok('der Snapshot trägt die geplanten Übungen', snap && Array.isArray(snap.plannedExercises) && snap.plannedExercises.length === 2,
    JSON.stringify(snap && snap.plannedExercises && snap.plannedExercises.length));
  ok('  … mit Zielgewicht', !!(snap && snap.plannedExercises && snap.plannedExercises[0] &&
    snap.plannedExercises[0].targetWeightKg === 82.5),
    JSON.stringify(snap && snap.plannedExercises && snap.plannedExercises[0]));
  ok('die bisherigen Ankerfelder bleiben unverändert',
    snap && snap.occurrenceId === 'po:' + TODAY + ':ps:g1' && snap.t === 'Gym' && snap.l === 'Oberkörper');

  seen.length = 0;
  const r2 = sb.startPlannedUnit(0, 1, TODAY);
  ok('eine Laufeinheit startet weiterhin', r2 && r2.ok === true);
  ok('  … und ihr Snapshot bekommt KEIN leeres plannedExercises-Feld',
    seen.length === 1 && !!seen[0].opts.planSnapshot && !('plannedExercises' in seen[0].opts.planSnapshot),
    JSON.stringify(seen[0] && seen[0].opts.planSnapshot));
}

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
