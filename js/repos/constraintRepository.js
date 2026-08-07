/* ORVIA · constraintRepository — user_constraints (P9; Tabelle aus Migration 0014).
   Vollständige Beschwerde-Zeilen; Set-Sync analog user_sports/user_goals. */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.repos = O.repos || {};
  if (!O.repoBase) { console.error('constraintRepository: repoBase fehlt'); return; }
  const B = O.repoBase;

  O.repos.constraint = {
    async list() { return B.selectAll('user_constraints'); },
    async replaceAll(rows) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Set-Sync nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length) {
          const up = await B.upsertMany('user_constraints', list, 'user_id,client_id');
          if (!up.success) return up;
        }
        const existing = await B.selectAll('user_constraints', { columns: 'id,client_id' });
        if (!existing.success) return existing;
        const keep = new Set(list.map(r => r.client_id));
        const toDelete = (existing.data || []).filter(r => !keep.has(r.client_id)).map(r => r.id);
        for (const id of toDelete) {
          const d = await B.remove('user_constraints', id);
          if (!d.success) return d;
        }
        return B.ok({ upserted: list.length, deleted: toDelete.length });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
