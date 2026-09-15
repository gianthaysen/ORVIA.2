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
        /* S2b-1 (v8-380): Muskel- und Geraetezuordnung kommen aus dem Katalog mit (Embed ueber die
           FK exercise_muscles/exercise_equipment). Faellt der Embed aus (aeltere DB ohne 0047 ist
           kein Grund — die Tabellen gibt es seit 0003; aber ein Schema-Cache-Fehler waere einer),
           wird ohne Embed gelesen — dann greifen die Client-Fallbacks in gym-volume. */
        const SEL = '*, exercise_muscles(muscle_key,weight,involvement), exercise_equipment(equipment_key)';
        let q = B.sb().from('exercises').select(SEL).eq('active', true);
        if (filters) Object.keys(filters).forEach(k => { q = q.eq(k, filters[k]); });
        let { data, error } = await q;
        if (error) {
          let q2 = B.sb().from('exercises').select('*').eq('active', true);
          if (filters) Object.keys(filters).forEach(k => { q2 = q2.eq(k, filters[k]); });
          const r2 = await q2; data = r2.data; error = r2.error;
        }
        if (error) return B.fail('query_failed', error.message);
        const rows = (data || []).map(r => M ? M.exerciseFromRow(r) : r);
        try { if (O.gymVolume && O.gymVolume.setCatalog) O.gymVolume.setCatalog(rows); } catch (e) {}
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
      const r = await B.upsert('exercises', row);
      /* S2b: Muskeln/Geraet der eigenen Uebung persistieren (RLS: nur fuer eigene Uebungen erlaubt). */
      try {
        const id = r && r.success && r.data && (r.data.id || (r.data[0] && r.data[0].id));
        if (id && B.online()) {
          const mus = ex && ex.muscles ? Object.keys(ex.muscles).map(k => ({ exercise_id: id, muscle_key: k, weight: +(ex.muscles[k].weight != null ? ex.muscles[k].weight : (ex.muscles[k].involvement === 'direct' ? 1 : 0.5)), involvement: ex.muscles[k].involvement || 'direct' })) : [];
          if (mus.length) await B.sb().from('exercise_muscles').upsert(mus, { onConflict: 'exercise_id,muscle_key' });
          const eq = (ex && ex.equipment || []).map(k => ({ exercise_id: id, equipment_key: k }));
          if (eq.length) await B.sb().from('exercise_equipment').upsert(eq, { onConflict: 'exercise_id,equipment_key' });
        }
      } catch (e) {}
      return r;
    },
    async updateUserExercise(id, patch) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        /* S2b-2: Domain-Objekt (camelCase) wird gemappt; Muskeln/Geraet werden ersetzt (nur eigene Uebungen, RLS). */
        const isDomain = patch && (patch.movementPattern !== undefined || patch.baseSlug !== undefined || patch.muscles !== undefined);
        const row = isDomain && M ? M.exerciseToRow(patch) : Object.assign({}, patch);
        delete row.is_system; delete row.user_id;
        const { data, error } = await B.sb().from('exercises').update(row).eq('id', id).eq('user_id', B.currentUserId()).eq('is_system', false).select();
        if (error) return B.fail('update_failed', error.message);
        try {
          if (patch && patch.muscles) {
            await B.sb().from('exercise_muscles').delete().eq('exercise_id', id);
            const mus = Object.keys(patch.muscles).map(k => ({ exercise_id: id, muscle_key: k, weight: +(patch.muscles[k].weight != null ? patch.muscles[k].weight : (patch.muscles[k].involvement === 'direct' ? 1 : 0.5)), involvement: patch.muscles[k].involvement || 'direct' }));
            if (mus.length) await B.sb().from('exercise_muscles').upsert(mus, { onConflict: 'exercise_id,muscle_key' });
          }
          if (patch && Array.isArray(patch.equipment)) {
            await B.sb().from('exercise_equipment').delete().eq('exercise_id', id);
            const eq = patch.equipment.map(k => ({ exercise_id: id, equipment_key: k }));
            if (eq.length) await B.sb().from('exercise_equipment').upsert(eq, { onConflict: 'exercise_id,equipment_key' });
          }
        } catch (e) {}
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
