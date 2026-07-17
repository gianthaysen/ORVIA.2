/* ============================================================
   ORVIA · training-migration — Legacy-Trainingssessions → workout_sessions (Phase 4.1)
   Bestehende Blob-Sessions (DB[date].sessions) werden als LEGACY-Workout-Sessions erhalten:
   nur Sportart, Dauer, RPE, Distanz, Quelle. KEINE erfundenen Übungen/Sätze, KEINE
   workout_exercises/_sets. Idempotent über client_session_id 'blob:<date>:<sport>'
   (deckt sich mit migrate-blob/training_load_daily → keine Dubletten). Nicht-destruktiv:
   der Blob bleibt erhalten; Tabellenwerte gewinnen erst nach erfolgreicher Migration.
   Wird NICHT automatisch ausgeführt — bewusst manuell anstoßbar (Risikovermeidung).
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  function isDay(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }

  // Baut die Legacy-Session-Rows aus dem Blob (reine Funktion, testbar).
  function buildLegacyRows(db) {
    const rows = [];
    Object.keys(db || {}).filter(isDay).forEach(function (d) {
      const e = db[d]; if (!e || !e.sessions) return;
      Object.keys(e.sessions).forEach(function (sp) {
        if (sp === '_ts') return;
        const s = e.sessions[sp]; if (!s || typeof s !== 'object') return;
        rows.push({
          local_date: d, sport: sp, status: 'legacy', source: 'legacy_blob',
          session_type: s.sub || null,
          duration_min: s.dur != null ? s.dur : null,
          // KEINE Übungen/Sätze erfunden — nur Kennzahlen als Snapshot.
          decision_snapshot: null,
          readiness_snapshot: null,
          notes: s.note || null,
          client_session_id: 'blob:' + d + ':' + sp
        });
      });
    });
    return rows;
  }

  // Persistiert die Legacy-Sessions über workoutRepository (Upsert client_session_id → idempotent).
  async function run() {
    if (!O.repos || !O.repos.workout) return { success: false, error: { message: 'workoutRepository fehlt' } };
    if (!O.user || !O.user.id) return { success: false, error: { message: 'keine Sitzung' } };
    if (typeof DB === 'undefined' || !DB) return { success: false, error: { message: 'DB nicht verfügbar' } };
    const rows = buildLegacyRows(DB);
    let ok = 0; const warnings = [];
    for (const r of rows) {
      try {
        const res = await O.repos.workout.createSession({
          localDate: r.local_date, sport: r.sport, status: 'legacy', sessionType: r.session_type,
          durationMin: r.duration_min, notes: r.notes, source: 'legacy_blob', clientSessionId: r.client_session_id
        });
        if (res && res.success) ok++; else warnings.push(r.client_session_id + ': ' + (res && res.error && res.error.message));
      } catch (e) { warnings.push(r.client_session_id + ': ' + e); }
    }
    return { success: warnings.length === 0, data: { found: rows.length, migrated: ok, warnings: warnings } };
  }

  O.trainingMigration = { buildLegacyRows, run };
})();
