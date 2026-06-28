/* ORVIA · exerciseRepository — exercises (System lesbar + nutzerdefiniert) + Muskelzuordnung */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { console.error('exerciseRepository: repoBase fehlt'); return; }
  const B = O.repoBase, M = (O.trainingDomain && O.trainingDomain.map) || null;

  O.repos.exercise = {
    // System + eigene Übungen (RLS liefert is_system OR user_id=auth.uid()). Optionale Filter.
    async list(filters) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        let q = B.sb().from('exercises').select('*').eq('active', true);
        if (filters) Object.keys(filters).forEach(k => { q = q.eq(k, filters[k]); });
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        const rows = (data || []).map(r => M ? M.exerciseFromRow(r) : r);
        return B.ok(rows, { source: rows.length ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async getMuscles(exerciseId) {
      const g = B.requireAuth(); if (g) return g;
      try {
        const { data, error } = await B.sb().from('exercise_muscles').select('*').eq('exercise_id', exerciseId);
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    // Nutzerdefinierte Übung (is_system erzwungen false, user_id aus Auth via stampUser).
    async createUserExercise(ex) {
      const row = M ? M.exerciseToRow(ex) : ex; row.is_system = false;
      return B.upsert('exercises', row);
    },
    async updateUserExercise(id, patch) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const { data, error } = await B.sb().from('exercises').update(patch).eq('id', id).eq('user_id', B.currentUserId()).eq('is_system', false).select();
        if (error) return B.fail('update_failed', error.message);
        return B.ok((data && data[0]) || null);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async deleteUserExercise(id) {
      const g = B.requireAuth(); if (g) return g;
      try {
        const { error } = await B.sb().from('exercises').delete().eq('id', id).eq('user_id', B.currentUserId()).eq('is_system', false);
        if (error) return B.fail('delete_failed', error.message);
        return B.ok(true);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
