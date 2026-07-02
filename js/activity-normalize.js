/* ============================================================
   ORVIA · activity-normalize — REINE Normalisierung für Aktivitäten & Workout-Sessions.
   Phase 1 (offline-sicher) der Training/Activity-Stabilisierung.
   Kein DOM, kein Store, kein Supabase. Vorbereitung der kanonischen activities-Architektur:
     - durationSeconds als EINZIGE interne Dauereinheit,
     - defensive, idempotente, NICHT mutierende Normalisierung von Alt-/Neufeldern,
     - Plausibilität (0-min-/710-min-Fälle) klar markiert statt still 0 anzuzeigen.
   Verfügbar über window.ORVIA.activityNormalize + module.exports.
   ============================================================ */
(function (root) {
  // Realistische Obergrenze für eine einzelne Einheit: 8 h. Darüber gilt die Dauer als
  // unplausibel (z. B. „aktiv" über Nacht vergessen → 710 min). Nicht stillschweigend anzeigen.
  var MAX_PLAUSIBLE_SECONDS = 8 * 3600;

  function num(v) { if (v == null || v === '') return null; var n = (typeof v === 'number') ? v : parseFloat(v); return isFinite(n) ? n : null; }
  function intOrNull(v) { var n = num(v); return n == null ? null : Math.round(n); }
  function iso(v) { if (!v) return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }

  // Kanonische Dauer in SEKUNDEN aus einem beliebigen (Alt-)Datensatz ableiten.
  // Reihenfolge: explizite Sekunden → endedAt-startedAt → Minuten-Felder → unbekannt(null).
  // Schützt gegen Millisekunden-als-Sekunden und Sekunden-als-Minuten.
  function durationSecondsOf(raw) {
    if (!raw) return null;
    // 1) explizite Sekundenfelder
    var sec = num(raw.durationSeconds != null ? raw.durationSeconds : (raw.duration_seconds != null ? raw.duration_seconds : raw.elapsed_time));
    if (sec != null && sec >= 0) return Math.round(sec);
    // 2) Zeitstempel-Differenz (started/ended in beliebiger Schreibweise)
    var start = iso(raw.startedAt || raw.started_at);
    var end = iso(raw.endedAt || raw.ended_at || raw.finishedAt || raw.finished_at);
    if (start && end) {
      var diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
      var paused = num(raw.totalPausedSeconds != null ? raw.totalPausedSeconds : raw.total_paused_seconds) || 0;
      var net = diff - paused;
      if (net >= 0) return Math.round(net);
    }
    // 3) Minuten-Felder (Alt + RPC duration_min)
    var min = num(raw.durationMin != null ? raw.durationMin : (raw.duration_min != null ? raw.duration_min : (raw.durationMinutes != null ? raw.durationMinutes : raw.duration)));
    if (min != null && min >= 0) return Math.round(min * 60);
    return null;
  }

  // Dauer-Plausibilität: ok | unknown | implausible. Negative gelten als unknown (verworfen).
  function durationPlausibility(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return { state: 'unknown', seconds: null };
    if (seconds > MAX_PLAUSIBLE_SECONDS) return { state: 'implausible', seconds: Math.round(seconds) };
    return { state: 'ok', seconds: Math.round(seconds) };
  }

  // Anzeige: <60 min → „43 min", ab 60 min → „1 h 41 min". Unbekannt → „Dauer nicht erfasst".
  // Unplausibel → markierter Wert (Aufrufer kann „prüfen" anhängen).
  function fmtDurationSeconds(seconds, opts) {
    opts = opts || {};
    var p = durationPlausibility(seconds);
    if (p.state === 'unknown') return opts.unknownLabel || 'Dauer nicht erfasst';
    var total = p.seconds;
    var h = Math.floor(total / 3600), m = Math.round((total % 3600) / 60);
    if (m === 60) { m = 0; h += 1; }
    var str = h > 0 ? (h + ' h ' + m + ' min') : (m + ' min');
    if (p.state === 'implausible' && opts.markImplausible !== false) str += ' (prüfen)';
    return str;
  }

  // Kanonische Workout-Session-Normalisierung (defensiv, idempotent, NICHT mutierend).
  // Liefert ein stabiles Objekt; unbekannte Dauer bleibt null (nicht 0).
  function normalizeWorkoutSession(raw) {
    raw = raw || {};
    var seconds = durationSecondsOf(raw);
    var plaus = durationPlausibility(seconds);
    return {
      id: raw.id || null,
      clientSessionId: raw.clientSessionId || raw.client_session_id || null,
      sport: raw.sport || null,
      sportKey: raw.sportKey || raw.sport_key || null,
      status: raw.status || null,
      localDate: raw.localDate || raw.local_date || null,
      startedAt: iso(raw.startedAt || raw.started_at),
      endedAt: iso(raw.endedAt || raw.ended_at || raw.finishedAt || raw.finished_at),
      durationSeconds: plaus.state === 'unknown' ? null : plaus.seconds,
      durationState: plaus.state,
      sessionRpe: num(raw.sessionRpe != null ? raw.sessionRpe : raw.session_rpe)
    };
  }

  // Zusammenfassung aus Übungs-/Satzbaum (für activity.summary). Zählt nur echte Arbeitssätze.
  // exercises: [{ sets:[{set_type,weight,reps,completed}] }] (DB-Form) — tolerant.
  function summarizeWorkout(exercises) {
    exercises = Array.isArray(exercises) ? exercises : [];
    var exerciseCount = 0, workingSetCount = 0, totalVolumeKg = 0, rirSum = 0, rirN = 0;
    exercises.forEach(function (ex) {
      var sets = (ex && Array.isArray(ex.sets)) ? ex.sets : [];
      var hasReal = false;
      sets.forEach(function (st) {
        var type = (st && (st.set_type || st.setType)) || 'working';
        var done = st && (st.completed === true || st.completed == null); // null = nicht explizit offen
        if (type !== 'working' || !done) return;
        hasReal = true; workingSetCount += 1;
        var w = num(st.weight), r = num(st.reps);
        if (w != null && r != null) totalVolumeKg += w * r;
        var rir = num(st.rir != null ? st.rir : st.rir);
        if (rir != null) { rirSum += rir; rirN += 1; }
      });
      if (hasReal) exerciseCount += 1;
    });
    var out = { exerciseCount: exerciseCount, workingSetCount: workingSetCount };
    if (totalVolumeKg > 0) out.totalVolumeKg = Math.round(totalVolumeKg);
    if (rirN > 0) out.avgRir = Math.round((rirSum / rirN) * 10) / 10;
    return out;
  }

  // Kanonische Aktivität (defensiv). source/sourceRecordId tragen die Idempotenz
  // (Upsert-Schlüssel: user_id, source, source_record_id) — keine Doppel-Activities.
  function normalizeActivityRecord(raw) {
    raw = raw || {};
    var seconds = durationSecondsOf(raw);
    var plaus = durationPlausibility(seconds);
    return {
      id: raw.id || null,
      userId: raw.userId || raw.user_id || null,
      sportId: raw.sportId || raw.sport_id || null,
      source: raw.source || null,
      sourceRecordId: raw.sourceRecordId || raw.source_record_id || null,
      workoutSessionId: raw.workoutSessionId || raw.workout_session_id || null,
      startedAt: iso(raw.startedAt || raw.started_at),
      endedAt: iso(raw.endedAt || raw.ended_at),
      durationSeconds: plaus.state === 'unknown' ? null : plaus.seconds,
      durationState: plaus.state,
      status: raw.status || 'completed',
      summary: (raw.summary && typeof raw.summary === 'object') ? raw.summary : {}
    };
  }

  // Activity-Row aus einer normalisierten Session bauen (für RPC/Upsert). Reine Abbildung.
  function activityRowFromSession(session, summary) {
    var s = normalizeWorkoutSession(session);
    return {
      sport_id: s.sportKey || s.sport || null,
      source: 'orvia_workout',
      source_record_id: s.id || s.clientSessionId || null,
      workout_session_id: s.id || null,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      duration_seconds: s.durationSeconds,
      status: s.status === 'completed' ? 'completed' : (s.status || 'completed'),
      summary: summary || {}
    };
  }

  var api = {
    MAX_PLAUSIBLE_SECONDS: MAX_PLAUSIBLE_SECONDS,
    durationSecondsOf: durationSecondsOf,
    durationPlausibility: durationPlausibility,
    fmtDurationSeconds: fmtDurationSeconds,
    normalizeWorkoutSession: normalizeWorkoutSession,
    normalizeActivityRecord: normalizeActivityRecord,
    summarizeWorkout: summarizeWorkout,
    activityRowFromSession: activityRowFromSession
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.activityNormalize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
