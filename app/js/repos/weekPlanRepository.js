/* ============================================================
   ORVIA · weekPlanRepository — user_week_plans (Migration 0030, Phase 5)
   ------------------------------------------------------------
   Duenne I/O-Schicht fuer das kanonische Wochenplan-Modell (js/plan-domain.js).
   KEINE Domain-Logik hier: effectiveSessions/rebase/Validierung leben im
   planDomain-Modul; dieses Repository (de)serialisiert nur Zeilen.
   Dedupe: unique (user_id, week_key) — upsert ueber diesen Key.
   Offline: Lesen faellt auf den lokalen Spiegel zurueck (localStorage je Nutzer);
   Schreiben landet zusaetzlich im Spiegel, damit ein Reload offline nichts verliert.
   MIGRATION 0030 MUSS vor dem ersten produktiven Schreiben ausgefuehrt sein.
   Tests: supabase/tests/week_plan_repo_5_test.mjs
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { try { console.error('weekPlanRepository: repoBase fehlt'); } catch (e) {} return; }
  const B = O.repoBase;

  function _lsKey() {
    const uid = (O.user && O.user.id) || 'anon';
    return 'orvia_week_plans_' + uid;
  }
  function _mirrorRead() {
    try { return JSON.parse(localStorage.getItem(_lsKey()) || '{}') || {}; } catch (e) { return {}; }
  }
  function _mirrorWrite(weekKey, plan) {
    try {
      const m = _mirrorRead(); m[weekKey] = plan;
      // Spiegel begrenzen: nur die juengsten 8 Wochen lokal halten.
      const keys = Object.keys(m).sort();
      while (keys.length > 8) { delete m[keys.shift()]; }
      localStorage.setItem(_lsKey(), JSON.stringify(m));
    } catch (e) {}
  }

  function toRow(plan) {
    return {
      week_key: plan.weekKey,
      plan_id: plan.planId,
      revision: plan.revision,
      baseline: plan.baseline,
      overrides: plan.overrides || [],
      pending_conflicts: plan.pendingConflicts || [],
      history: plan.history || [],
      updated_at: new Date().toISOString()
    };
  }
  function fromRow(row) {
    if (!row) return null;
    return {
      planId: row.plan_id, weekKey: row.week_key, revision: row.revision,
      baseline: row.baseline, overrides: row.overrides || [],
      pendingConflicts: row.pending_conflicts || [], history: row.history || []
    };
  }

  O.repos.weekPlan = {
    toRow, fromRow,
    async get(weekKey) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) {
        const m = _mirrorRead();
        return m[weekKey] ? B.ok(m[weekKey], { source: 'indexeddb' })
                          : B.fail('offline', 'Offline und kein lokaler Spiegel.', { offline: true });
      }
      try {
        const { data, error } = await B.sb().from('user_week_plans').select('*')
          .eq('user_id', B.currentUserId()).eq('week_key', weekKey).maybeSingle();
        if (error) return B.fail('query_failed', error.message);
        const plan = fromRow(data);
        if (plan) _mirrorWrite(weekKey, plan);
        return B.ok(plan);   // null = (noch) kein kanonischer Plan fuer diese Woche
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async save(plan) {
      // Domain-Validierung VOR jedem Schreiben — eine kaputte Zeile ist schlimmer als keine.
      try {
        const errs = (O.planDomain && O.planDomain.validatePlan) ? O.planDomain.validatePlan(plan) : [];
        if (errs.length) return B.fail('invalid_plan', 'Planmodell ungueltig: ' + errs.slice(0, 5).join(', '));
      } catch (e) {}
      _mirrorWrite(plan.weekKey, plan);   // lokaler Spiegel zuerst (Offline-Reload verliert nichts)
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — lokal gespiegelt, Sync ausstehend.', { offline: true, sync_status: 'pending' });
      return B.upsert('user_week_plans', toRow(plan), 'user_id,week_key');
    },
    async listRecent(limit) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.ok(Object.values(_mirrorRead()), { source: 'indexeddb' });
      try {
        const { data, error } = await B.sb().from('user_week_plans').select('*')
          .eq('user_id', B.currentUserId()).order('week_key', { ascending: false }).limit(limit || 8);
        if (error) return B.fail('query_failed', error.message);
        return B.ok((data || []).map(fromRow));
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
