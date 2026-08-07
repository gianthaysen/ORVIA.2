/* ORVIA · workoutRepository — workout_sessions → workout_exercises → workout_sets (Phase 4.2a)
   Stabile Client-IDs (client_exercise_id / client_set_id) als Dedupe-Schlüssel (reorder-sicher).
   Auth-scoped, standardisiertes Ergebnisformat, RLS nie umgangen, user_id nie aus UI. */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { console.error('workoutRepository: repoBase fehlt'); return; }
  const B = O.repoBase, M = (O.trainingDomain && O.trainingDomain.map) || null;

  function offline() { return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' }); }

  O.repos.workout = {
    // ---- Session ----
    async createSession(s) {
      const sportKey = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(s.sportKey || s.sport) : (s.sportKey || s.sport || null);
      const row = {
        plan_id: s.planId || null, plan_day_id: s.planDayId || null, planned_session_id: s.plannedSessionId || null,
        local_date: s.localDate, started_at: s.startedAt || null, finished_at: s.finishedAt || null,
        status: s.status || 'planned', sport: s.sport || null, sport_key: sportKey || null, session_type: s.sessionType || null,
        duration_min: s.durationMin != null ? s.durationMin : null, session_rpe: s.sessionRpe != null ? s.sessionRpe : null,
        perceived_effort: s.perceivedEffort != null ? s.perceivedEffort : null, cancel_reason: s.cancelReason || null,
        paused_at: s.pausedAt || null, total_paused_seconds: s.totalPausedSeconds != null ? s.totalPausedSeconds : 0,
        notes: s.notes || null, readiness_snapshot: s.readinessSnapshot || null, decision_snapshot: s.decisionSnapshot || null,
        source: s.source || 'manual', client_session_id: s.clientSessionId || null
      };
      /* Batch 2d (H3-Muster): unveränderlicher Plan-Snapshot (Occurrence) NUR
         senden wenn belegt — kompatibel mit Instanzen ohne Migration 0025. */
      if (s.plannedSessionSnapshot) row.planned_session_snapshot = s.plannedSessionSnapshot;
      return B.upsert('workout_sessions', row, s.clientSessionId ? 'user_id,client_session_id' : undefined);
    },
    async getSession(id) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sessions').select('*').eq('user_id', B.currentUserId()).eq('id', id).maybeSingle();
        if (error) return B.fail('query_failed', error.message); return B.ok(data || null, { source: data ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Max. eine aktive Session pro Nutzer (DB-erzwungen). Liefert sie oder null.
    async getActiveSession() {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sessions').select('*').eq('user_id', B.currentUserId()).eq('status', 'active').order('started_at', { ascending: false }).limit(1);
        if (error) return B.fail('query_failed', error.message);
        return B.ok((data && data[0]) || null, { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async listSessions(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { let q = B.sb().from('workout_sessions').select('*').eq('user_id', B.currentUserId()).order('local_date', { ascending: false });
        if (fromDate) q = q.gte('local_date', fromDate); if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q; if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // KEIN Scheinerfolg: wurde keine EIGENE Zeile aktualisiert → Fehler (z.B. RLS/falsche id).
    async updateSession(id, patch) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sessions').update(patch).eq('id', id).eq('user_id', B.currentUserId()).select();
        if (error) return B.fail('update_failed', error.message);
        const row = data && data[0];
        if (!row) return B.fail('no_row_updated', 'Die Workout-Session wurde nicht aktualisiert.');
        return B.ok(row);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Verifiziert, dass tatsächlich eine eigene Zeile gelöscht wurde (sonst Fehler).
    async deleteSession(id) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sessions').delete().eq('id', id).eq('user_id', B.currentUserId()).select();
        if (error) return B.fail('delete_failed', error.message);
        if (!data || !data.length) return B.fail('no_row_deleted', 'Es wurde keine Session gelöscht.');
        return B.ok({ deleted: data.length });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Atomarer Terminalzustand via RPC (completed|aborted|cancelled) ----
    // Ein einziger DB-Aufruf; Supabase kann Zeile ODER Array zurückgeben → normalisieren.
    async closeActiveSession(id, targetStatus, options) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      options = options || {};
      try {
        const { data, error } = await B.sb().rpc('orvia_close_active_workout', {
          p_session_id: id,
          p_target_status: targetStatus,
          p_session_rpe: options.sessionRpe != null ? options.sessionRpe : null,
          p_cancel_reason: options.cancelReason || null
        });
        if (error) return B.fail('workout_close_failed', error.message);
        const row = Array.isArray(data) ? (data[0] || null) : (data || null);
        if (!row || row.id !== id || row.status !== targetStatus) {
          return B.fail('workout_close_unconfirmed', 'Workout-Status wurde nicht bestätigt.');
        }
        return B.ok(row);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Exercises ----
    async listExercises(sessionId) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_exercises').select('*').eq('user_id', B.currentUserId()).eq('workout_session_id', sessionId).order('order_index', { ascending: true });
        if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Dedupe über (user_id, client_exercise_id) → reorder-sicher.
    async addExercise(sessionId, ex) {
      return B.upsert('workout_exercises', {
        workout_session_id: sessionId, client_exercise_id: ex.clientExerciseId || null, exercise_id: ex.exerciseId || null,
        order_index: ex.order != null ? ex.order : 0, planned_sets: ex.plannedSets != null ? ex.plannedSets : null,
        min_reps: ex.minReps != null ? ex.minReps : null, max_reps: ex.maxReps != null ? ex.maxReps : null,
        target_rir: ex.targetRir != null ? ex.targetRir : null, target_rpe: ex.targetRpe != null ? ex.targetRpe : null,
        rest_seconds: ex.restSeconds != null ? ex.restSeconds : null, notes: ex.notes || null,
        completed: !!ex.completed, replaced_by_exercise_id: ex.replacedBy || null
      }, ex.clientExerciseId ? 'user_id,client_exercise_id' : undefined);
    },
    async updateExercise(id, patch) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_exercises').update(patch).eq('id', id).eq('user_id', B.currentUserId()).select();
        if (error) return B.fail('update_failed', error.message); return B.ok((data && data[0]) || null);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async removeExercise(id) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { error } = await B.sb().from('workout_exercises').delete().eq('id', id).eq('user_id', B.currentUserId());
        if (error) return B.fail('delete_failed', error.message); return B.ok(true);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Reihenfolge per Client-ID → order_index aktualisieren (kein Dedupe-Konflikt, da Client-ID stabil).
    async reorderExercises(orderedClientIds) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { let i = 0; for (const cid of (orderedClientIds || [])) {
          const { error } = await B.sb().from('workout_exercises').update({ order_index: i }).eq('user_id', B.currentUserId()).eq('client_exercise_id', cid);
          if (error) return B.fail('update_failed', error.message); i++;
        } return B.ok({ reordered: i });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Sets ----
    async listSets(workoutExerciseId) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sets').select('*').eq('user_id', B.currentUserId()).eq('workout_exercise_id', workoutExerciseId).order('set_number', { ascending: true });
        if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Dedupe über (user_id, client_set_id) → idempotent bei Doppelklick/Retry/Offline/Reload.
    async addSet(workoutExerciseId, set) {
      const row = M ? M.setToRow(set) : Object.assign({}, set);
      row.workout_exercise_id = workoutExerciseId;
      row.client_set_id = set.clientSetId || null;
      return B.upsert('workout_sets', row, set.clientSetId ? 'user_id,client_set_id' : undefined);
    },
    async updateSet(id, patch) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { data, error } = await B.sb().from('workout_sets').update(patch).eq('id', id).eq('user_id', B.currentUserId()).select();
        if (error) return B.fail('update_failed', error.message); return B.ok((data && data[0]) || null);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async deleteSet(id) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try { const { error } = await B.sb().from('workout_sets').delete().eq('id', id).eq('user_id', B.currentUserId());
        if (error) return B.fail('delete_failed', error.message); return B.ok(true);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Muskelvolumen (Phase 4.3): EINE RPC statt N+1 ----
    // Liefert je Muskel: {muscle_key, direct_sets, indirect_sets, effective_sets, workout_count, last_trained_at}.
    // Nur abgeschlossene Sessions + abgeschlossene Arbeitssätze (ohne Warm-up), RLS/auth.uid() erzwungen.
    async getMuscleVolume(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try {
        const { data, error } = await B.sb().rpc('orvia_muscle_volume', { p_from: fromDate, p_to: toDate });
        if (error) return B.fail('muscle_volume_failed', error.message);
        return B.ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Aggregat: kompletter Workout-Baum (geordnet) ----
    async loadWorkoutTree(sessionId) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      try {
        const sres = await this.getSession(sessionId); if (!sres.success) return sres;
        if (!sres.data) return B.ok({ session: null, exercises: [] }, { source: 'empty' });
        const { data, error } = await B.sb().from('workout_exercises')
          .select('*, exercise:exercises(*), workout_sets(*)')
          .eq('user_id', B.currentUserId()).eq('workout_session_id', sessionId)
          .order('order_index', { ascending: true });
        if (error) return B.fail('query_failed', error.message);
        const exercises = (data || []).map(we => ({
          workoutExercise: (function () { const c = Object.assign({}, we); delete c.exercise; delete c.workout_sets; return c; })(),
          exercise: we.exercise || null,
          sets: (we.workout_sets || []).slice().sort((a, b) => (a.set_number || 0) - (b.set_number || 0))
        }));
        return B.ok({ session: sres.data, exercises: exercises });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // ---- Letzte Leistung einer Übung (letzte ABGESCHLOSSENE Session vor beforeDate) ----
    async getPreviousExercisePerformance(exerciseId, beforeDate) {
      const g = B.requireAuth(); if (g) return g; if (!B.online()) return offline();
      if (!exerciseId) return B.ok(null, { source: 'empty' });
      try {
        const { data, error } = await B.sb().from('workout_exercises')
          .select('id, workout_session_id, session:workout_sessions(local_date,status,finished_at), workout_sets(*)')
          .eq('user_id', B.currentUserId()).eq('exercise_id', exerciseId);
        if (error) return B.fail('query_failed', error.message);
        const done = (data || []).filter(we => we.session && we.session.status === 'completed' && (!beforeDate || we.session.local_date < beforeDate));
        if (!done.length) return B.ok(null, { source: 'empty' });
        done.sort((a, b) => (b.session.local_date < a.session.local_date ? -1 : 1));
        const last = done[0];
        const sets = (last.workout_sets || []).slice().sort((x, y) => (x.set_number || 0) - (y.set_number || 0));
        let best = null; sets.forEach(s => { if (s.weight != null && (!best || s.weight > best.weight)) best = s; });
        return B.ok({ date: last.session.local_date, sets: sets, bestSet: best }, { source: 'supabase' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
