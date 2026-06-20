/* ORVIA · workoutRepository — workout_sessions → workout_exercises → workout_sets */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { console.error('workoutRepository: repoBase fehlt'); return; }
  const B = O.repoBase, M = (O.trainingDomain && O.trainingDomain.map) || null;

  O.repos.workout = {
    // Session (Dedupe optional über client_session_id). Leistungsfelder gym/endurance-neutral.
    // sport bleibt Anzeigetext; sport_key wird normalisiert (konsistente Kategorie).
    async createSession(s) {
      const sportKey = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(s.sportKey || s.sport) : (s.sportKey || s.sport || null);
      return B.upsert('workout_sessions', {
        plan_id: s.planId || null, plan_day_id: s.planDayId || null, planned_session_id: s.plannedSessionId || null,
        local_date: s.localDate, started_at: s.startedAt || null, finished_at: s.finishedAt || null,
        status: s.status || 'planned', sport: s.sport || null, sport_key: sportKey || null, session_type: s.sessionType || null,
        duration_min: s.durationMin != null ? s.durationMin : null, notes: s.notes || null,
        readiness_snapshot: s.readinessSnapshot || null, decision_snapshot: s.decisionSnapshot || null,
        source: s.source || 'manual', client_session_id: s.clientSessionId || null
      }, s.clientSessionId ? 'user_id,client_session_id' : undefined);
    },
    async listSessions(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        let q = B.sb().from('workout_sessions').select('*').eq('user_id', B.currentUserId()).order('local_date', { ascending: false });
        if (fromDate) q = q.gte('local_date', fromDate); if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q; if (error) return B.fail('query_failed', error.message);
        return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async updateSession(id, patch) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try { const { data, error } = await B.sb().from('workout_sessions').update(patch).eq('id', id).eq('user_id', B.currentUserId()).select();
        if (error) return B.fail('update_failed', error.message); return B.ok((data && data[0]) || null);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Übung an EIGENE Session hängen. Dedupe über (workout_session_id, order_index) → kein Doppel.
    async addExercise(sessionId, ex) {
      return B.upsert('workout_exercises', {
        workout_session_id: sessionId, exercise_id: ex.exerciseId || null, order_index: ex.order || 0,
        planned_sets: ex.plannedSets != null ? ex.plannedSets : null, min_reps: ex.minReps != null ? ex.minReps : null,
        max_reps: ex.maxReps != null ? ex.maxReps : null, target_rir: ex.targetRir != null ? ex.targetRir : null,
        target_rpe: ex.targetRpe != null ? ex.targetRpe : null, rest_seconds: ex.restSeconds != null ? ex.restSeconds : null,
        notes: ex.notes || null, completed: !!ex.completed, replaced_by_exercise_id: ex.replacedBy || null
      }, 'workout_session_id,order_index');
    },
    // Einzelnen Satz speichern (nullable Leistungsfelder). Dedupe über (workout_exercise_id, set_number)
    // → idempotent bei Doppelklick/Retry/Offline-Sync. DTO-Mapper aus training-domain.
    async addSet(workoutExerciseId, set) {
      const row = M ? M.setToRow(set) : set; row.workout_exercise_id = workoutExerciseId;
      return B.upsert('workout_sets', row, 'workout_exercise_id,set_number');
    },
    async listSets(workoutExerciseId) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try { const { data, error } = await B.sb().from('workout_sets').select('*').eq('user_id', B.currentUserId()).eq('workout_exercise_id', workoutExerciseId).order('set_number', { ascending: true });
        if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
