/* ============================================================
   ORVIA · activity-store — LOKALES kanonisches Activity-Repository (Inkrement 2A).
   Offline-Cache/Outbox. Nutzt DIESELBEN IDs/Felder wie das spätere Supabase-Modell
   (source, source_record_id, workout_session_id, summary, duration_seconds), damit 2B
   ohne Datenbruch synchronisieren kann. KEINE Supabase-Abhängigkeit hier.
   Eindeutiger lokaler Schlüssel: source + sourceRecordId → idempotenter Upsert.
   Persistenz: localStorage (user-scoped). Workout-Detailsnapshot wird mitgespeichert,
   damit die Detailansicht offline funktioniert.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  function AN() { return O.activityNormalize; }
  function uid() { return (O.user && O.user.id) || 'local'; }
  function key() { return 'orvia_activities_' + uid(); }
  function now() { return new Date().toISOString(); }
  function cid() { return 'act:' + uid() + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function readAll() {
    try { var raw = localStorage.getItem(key()); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch (e) { return []; }
  }
  function writeAll(arr) { try { localStorage.setItem(key(), JSON.stringify(arr)); return true; } catch (e) { return false; } }

  // Snapshot der Übungen/Sätze (DB-nahe Form) — defensiv, nicht mutierend.
  function snapshotExercises(exercises) {
    exercises = Array.isArray(exercises) ? exercises : [];
    return exercises.map(function (e, i) {
      var we = (e && e.workoutExercise) || {};
      var sets = (e && Array.isArray(e.sets)) ? e.sets : [];
      return {
        order: we.order_index != null ? we.order_index : i,
        exerciseId: we.exercise_id || null,
        exerciseNameSnapshot: (e && e.exercise && e.exercise.name) || we.exercise_name || null,
        sets: sets.map(function (s, j) {
          return {
            setNumber: s.set_number != null ? s.set_number : j + 1,
            setType: s.set_type || 'working',
            weight: s.weight != null ? s.weight : null,
            reps: s.reps != null ? s.reps : null,
            rir: s.rir != null ? s.rir : null,
            rpe: s.rpe != null ? s.rpe : null,
            completed: s.completed === true,
            note: s.note || null
          };
        })
      };
    });
  }

  // Idempotenter Upsert aus einem abgeschlossenen Workout. session = DB-/Store-Sessionzeile.
  // snapshot = O.workout.exercises (optional) für offline-lesbare Details. opts.syncStatus.
  function upsertActivityFromWorkout(session, snapshot, opts) {
    opts = opts || {};
    var an = AN(); if (!an) return { ok: false, error: 'activityNormalize fehlt' };
    var row = an.activityRowFromSession(session, an.summarizeWorkout(snapshotToSets(snapshot)));
    var source = row.source, srcId = row.source_record_id;
    if (!srcId) return { ok: false, error: 'source_record_id fehlt' };
    var all = readAll();
    var existing = null, idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].source === source && all[i].sourceRecordId === srcId) { existing = all[i]; idx = i; break; } }
    var snap = snapshot != null ? snapshotExercises(snapshot) : (existing && existing.workoutSnapshot) || null;
    var rec = {
      id: (existing && existing.id) || null,
      clientRecordId: (existing && existing.clientRecordId) || cid(),
      userId: uid(),
      sportId: row.sport_id,
      source: source,
      sourceRecordId: srcId,
      workoutSessionId: row.workout_session_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationSeconds: row.duration_seconds,
      status: row.status,
      summary: row.summary || {},
      metrics: (existing && existing.metrics) || {},
      workoutSnapshot: snap,
      syncStatus: opts.syncStatus || 'pending',
      createdAt: (existing && existing.createdAt) || now(),
      updatedAt: now()
    };
    if (idx >= 0) all[idx] = rec; else all.push(rec);   // genau EINE Activity je source+sourceRecordId
    writeAll(all);
    return { ok: true, activity: rec, created: idx < 0 };
  }

  // Manuelle/kanonische Activity (kein Workout): idempotent über source+sourceRecordId.
  // rec: { sportId, sourceRecordId, startedAt, endedAt, durationSeconds, summary, metrics, source? }
  function upsertManualActivity(rec) {
    rec = rec || {}; var source = rec.source || 'manual'; var srcId = rec.sourceRecordId;
    if (!srcId) return { ok: false, error: 'sourceRecordId fehlt' };
    var all = readAll(); var existing = null, idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].source === source && all[i].sourceRecordId === srcId) { existing = all[i]; idx = i; break; } }
    var out = {
      id: (existing && existing.id) || null,
      clientRecordId: (existing && existing.clientRecordId) || cid(),
      userId: uid(), sportId: rec.sportId || 'other', source: source, sourceRecordId: srcId,
      workoutSessionId: null, startedAt: rec.startedAt || null, endedAt: rec.endedAt || null,
      durationSeconds: rec.durationSeconds != null ? rec.durationSeconds : null,
      status: rec.status || 'completed', summary: rec.summary || {}, metrics: rec.metrics || {},
      workoutSnapshot: (existing && existing.workoutSnapshot) || null,
      syncStatus: 'pending', createdAt: (existing && existing.createdAt) || now(), updatedAt: now()
    };
    if (idx >= 0) all[idx] = out; else all.push(out);
    writeAll(all);
    return { ok: true, activity: out, created: idx < 0 };
  }

  function snapshotToSets(snapshot) {
    // summarizeWorkout erwartet [{sets:[...]}] — aus Store-Form (workoutExercise/sets) ableiten.
    if (!Array.isArray(snapshot)) return [];
    return snapshot.map(function (e) { return { sets: (e && Array.isArray(e.sets)) ? e.sets : [] }; });
  }

  function getActivityById(id) { var all = readAll(); for (var i = 0; i < all.length; i++) if (all[i].id === id || all[i].clientRecordId === id) return all[i]; return null; }
  function getActivityBySource(source, sourceRecordId) { var all = readAll(); for (var i = 0; i < all.length; i++) if (all[i].source === source && all[i].sourceRecordId === sourceRecordId) return all[i]; return null; }

  // Detailauflösung NUR über stabile IDs (nie Datum/Index). Liefert Snapshot + Activity.
  function getWorkoutDetailsForActivity(activityId) {
    var a = getActivityById(activityId);
    if (!a) return { ok: false, code: 'ACTIVITY_NOT_FOUND' };
    if (a.workoutSnapshot && a.workoutSnapshot.length) return { ok: true, activity: a, exercises: a.workoutSnapshot, hasDetails: true };
    return { ok: true, activity: a, exercises: [], hasDetails: false };  // allgemeine Aktivität ohne Satzdetails
  }

  // Liste, neueste zuerst. filters: { sportId, source, status, limit }.
  function listActivities(filters) {
    filters = filters || {};
    var all = readAll().slice();
    all.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    var out = all.filter(function (a) {
      if (filters.sportId && a.sportId !== filters.sportId) return false;
      if (filters.source && a.source !== filters.source) return false;
      if (filters.status && a.status !== filters.status) return false;
      return true;
    });
    return filters.limit ? out.slice(0, filters.limit) : out;
  }

  // ID/Server-Sync nachtragen (2B): markiert pending → synced und ergänzt Server-id.
  function markSynced(clientRecordId, serverId) {
    var all = readAll();
    for (var i = 0; i < all.length; i++) { if (all[i].clientRecordId === clientRecordId) { if (serverId) all[i].id = serverId; all[i].syncStatus = 'synced'; all[i].updatedAt = now(); writeAll(all); return true; } }
    return false;
  }
  function pendingActivities() { return readAll().filter(function (a) { return a.syncStatus !== 'synced'; }); }

  // Logout/Kontowechsel: nur den eigenen Key leeren (kein Fremddaten-Übertrag).
  function clearForUserSwitch() { try { localStorage.removeItem(key()); } catch (e) {} }

  var api = {
    upsertActivityFromWorkout: upsertActivityFromWorkout, upsertManualActivity: upsertManualActivity,
    getActivityById: getActivityById, getActivityBySource: getActivityBySource,
    getWorkoutDetailsForActivity: getWorkoutDetailsForActivity,
    listActivities: listActivities, markSynced: markSynced, pendingActivities: pendingActivities,
    snapshotExercises: snapshotExercises, clearForUserSwitch: clearForUserSwitch
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
