/* ORVIA · sportRepository — Sport-/Positions-Katalog + user_sports/user_goals (0002-Erweiterung) */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { console.error('sportRepository: repoBase fehlt'); return; }
  const B = O.repoBase;

  async function catalog(table, filterCol, filterVal) {
    const g = B.requireAuth(); if (g) return g;
    if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      let q = B.sb().from(table).select('*'); if (filterCol) q = q.eq(filterCol, filterVal);
      const { data, error } = await q; if (error) return B.fail('query_failed', error.message);
      return B.ok(data || []);
    } catch (e) { return B.fail('exception', String(e && e.message || e)); }
  }

  O.repos.sport = {
    async listSports() { return catalog('sports'); },
    async listPositions(sportId) { return catalog('sport_positions', 'sport_id', sportId); },
    async listTrainingQualities() { return catalog('training_qualities'); },

    // user_sports (0002 + 0003-Spalten). Konflikt-Key (user_id,sport) bleibt erhalten.
    async listUserSports() { return B.selectAll('user_sports'); },

    /* 2B-① · Set-Sync: bringt user_sports EXAKT auf den übergebenen Satz (SSoT-Push).
       Upsert aller Zeilen (user_id,sport) + Löschen entfernter Sportarten. NUR online —
       den Offline-Fallback (Queue-Upserts) verantwortet profile-store. Zeilen kommen
       bereits gemappt aus profileStore.sportsToRows (inkl. section_updated_at, K1). */
    async replaceUserSports(rows) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Set-Sync nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length) {
          const up = await B.upsertMany('user_sports', list, 'user_id,sport');
          if (!up.success) return up;
        }
        // Entfernte Sportarten löschen (nur eigene Zeilen; RLS greift zusätzlich).
        const existing = await B.selectAll('user_sports', { columns: 'sport' });
        if (!existing.success) return existing;
        const keep = new Set(list.map(r => r.sport));
        const toDelete = (existing.data || []).map(r => r.sport).filter(s => !keep.has(s));
        if (toDelete.length) {
          const { error } = await B.sb().from('user_sports').delete().eq('user_id', B.currentUserId()).in('sport', toDelete);
          if (error) return B.fail('delete_failed', error.message);
        }
        return B.ok({ upserted: list.length, deleted: toDelete.length });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async saveUserSport(s) {
      const nrm = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(s.sportKey || s.sport) : (s.sportKey || s.sport || null);
      return B.upsert('user_sports', {
        sport: s.sport, sport_key: nrm || null, role: s.role || 'main',
        position_key: s.positionKey || null, custom_position: s.customPosition || null,
        level: s.level || null, season_phase: s.seasonPhase || null,
        orvia_plans: s.orviaPlans != null ? !!s.orviaPlans : true, external_plan: !!s.externalPlan,
        priority: s.priority || 0, active: s.active != null ? !!s.active : true
      }, 'user_id,sport');
    },

    // user_goals (0002 + 0003-Spalten). client_goal_id-Dedupe falls gesetzt.
    async listUserGoals() { return B.selectAll('user_goals'); },
    async saveUserGoal(goal) {
      const row = {
        client_goal_id: goal.clientGoalId || null, goal_type: goal.type || null, title: goal.title || null,
        target_value: goal.targetValue != null ? goal.targetValue : null, target_unit: goal.targetUnit || null,
        target_date: goal.targetDate || null, start_date: goal.startDate || null,
        current_value: goal.currentValue != null ? goal.currentValue : null,
        sport_key: goal.sportKey || null, position_key: goal.positionKey || null,
        gym_goal_type: goal.gymGoalType || null,
        priority: goal.priority || 'primary', status: goal.status || 'active'
      };
      if (goal.id) row.id = goal.id;
      return goal.clientGoalId ? B.upsert('user_goals', row, 'user_id,client_goal_id') : B.upsert('user_goals', row, 'id');
    }
  };
})();
