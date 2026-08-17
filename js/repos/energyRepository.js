/* ============================================================
   ORVIA · energyRepository — daily_energy_expenditure (Migration 0022)
   Ergebnisformat und user_id-Scoping über repoBase. Keine UI, kein DOM.
   Der Client upsertet idempotent über (user_id, local_date); Aufrufer
   (nutrition.js) drosselt selbst (nur bei geändertem Ergebnis).
   ============================================================ */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  O.repos.energy = {
    async saveDay(localDate, payload) {
      if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return B.fail('invalid_date', 'local_date fehlt.');
      payload = payload || {};
      const row = { local_date: localDate };
      ['mode', 'bmr_kcal', 'bmr_method', 'step_kcal', 'training_kcal', 'tef_kcal',
        'adaptive_adj_kcal', 'trend_kg_28d', 'tdee_orvia', 'tdee_provider', 'tdee_chosen'
      ].forEach(function (k) { if (payload[k] !== undefined) row[k] = payload[k]; });
      if (row.tdee_chosen == null) return B.fail('invalid_payload', 'tdee_chosen fehlt.');
      return B.upsert('daily_energy_expenditure', row, 'user_id,local_date');
    },
    async listRange(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Lesen nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        let q = B.sb().from('daily_energy_expenditure').select('*')
          .eq('user_id', B.currentUserId()).order('local_date', { ascending: true });
        if (fromDate) q = q.gte('local_date', fromDate);
        if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
