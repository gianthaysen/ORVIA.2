/* ORVIA · goalRepository — user_goals + user_sports */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  /* P5 · Adapter kanonisches Ziel ↔ user_goals-Zeile. Akzeptiert BEIDE Welten:
     - Legacy-Migration liefert {type, targetUnit, clientGoalId, priority:'primary'}
     - Modell (normalizeGoal) liefert {category, unit, id, priority:1..4, metricType}
     Rollen-Mapping 1..4 → primary/secondary/maintain/longterm; Status durchgereicht
     (DB-CHECK ug_enums seit Migration 0012 erweitert — VOR einem Live-Goals-Sync
     ausführen). Goal-G1c: category_data/milestones/sports/motivation/time_horizon/
     custom_category sind ab Migration 0027 KEIN reines Blob-Detail mehr — die Cloud
     ist dafür SSOT (goalToRowFull sendet immer einen klaren Wert, s. u.); ein lokaler
     Fallback greift dort NUR noch bei fehlender Spalte (un-migrierte/Legacy-Zeile). */
  const ROLE_TO_DB = { 1: 'primary', 2: 'secondary', 3: 'maintain', 4: 'longterm' };
  function goalToRow(goal) {
    const numPr = typeof goal.priority === 'number';
    return {
      client_goal_id: goal.clientGoalId || goal.id || null,
      goal_type: goal.type || goal.category || null,
      title: goal.title || null,
      target_value: (goal.targetValue != null && typeof goal.targetValue === 'number') ? goal.targetValue : null,
      target_unit: goal.targetUnit || goal.unit || null,
      target_date: goal.targetDate || null,
      priority: numPr ? (ROLE_TO_DB[goal.priority] || 'secondary') : (goal.priority || 'primary'),
      status: goal.status || 'active'
    };
  }
  /* Die 0012-Spalten NUR aufnehmen, wenn belegt — sonst bräche die Blob-Migration
     auf Instanzen, auf denen 0012 noch nicht ausgeführt wurde (unbekannte Spalte). */
  function goalToRowFull(goal) {
    const row = goalToRow(goal);
    if (goal.metricType) row.metric_type = goal.metricType;
    if (goal.currentValue != null && typeof goal.currentValue === 'number') row.current_value = goal.currentValue;
    // Goal-G1c (Migration 0027 ist ab hier VORAUSSETZUNG für den Client-Deploy, keine
    // optionale "falls belegt"-Erweiterung mehr — s. Migrationsreihenfolge in 0027 und
    // im Batch-Bericht): die 6 Detailfelder werden IMMER mit einem klaren Wert gesendet,
    // auch wenn leer/gelöscht. Ein weggelassenes Feld könnte ein bewusstes Leeren
    // (Motivation entfernt, Meilenstein gelöscht, categoryData zurückgesetzt) NICHT von
    // "nichts geändert" unterscheiden und würde den alten Cloud-Wert stehen lassen.
    // WICHTIG: läuft dieser Code gegen eine Instanz OHNE Migration 0027, schlägt der
    // Upsert mit "unknown column" fehl — Migration MUSS vor diesem Client-Deploy live sein.
    row.time_horizon = goal.timeHorizon || null;
    row.custom_category = goal.customCategory || null;
    row.motivation = goal.motivation || '';
    row.sports = Array.isArray(goal.sports) ? goal.sports.slice() : [];
    row.category_data = (goal.categoryData && typeof goal.categoryData === 'object' && !Array.isArray(goal.categoryData)) ? goal.categoryData : {};
    row.milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
    return row;
  }

  O.repos.goal = {
    goalToRow: goalToRow, goalToRowFull: goalToRowFull,
    async list() { return B.selectAll('user_goals', { order: { column: 'created_at', ascending: true } }); },
    async save(goal) {
      const row = goalToRowFull(goal);
      // Idempotent über deterministische client_goal_id (verhindert Ziel-Dubletten bei Re-Migration).
      return row.client_goal_id ? B.upsert('user_goals', row, 'user_id,client_goal_id')
                                : B.upsert('user_goals', row, 'id');
    },
    async remove(id) { return B.remove('user_goals', id); },
    /* P9 · Set-Sync: Upsert aller Zeilen (user_id,client_goal_id) + Löschen entfernter
       Ziele (auch stempellose Legacy-Seed-Zeilen mit fremder client_goal_id). */
    async replaceUserGoals(rows) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Set-Sync nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length) {
          const up = await B.upsertMany('user_goals', list, 'user_id,client_goal_id');
          if (!up.success) return up;
        }
        const existing = await B.selectAll('user_goals', { columns: 'id,client_goal_id' });
        if (!existing.success) return existing;
        const keep = new Set(list.map(r => r.client_goal_id));
        const toDelete = (existing.data || []).filter(r => !keep.has(r.client_goal_id)).map(r => r.id);
        for (const id of toDelete) {
          const d = await B.remove('user_goals', id);
          if (!d.success) return d;
        }
        return B.ok({ upserted: list.length, deleted: toDelete.length });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };

  O.repos.sports = {
    async list() { return B.selectAll('user_sports'); },
    async save(s) {
      return B.upsert('user_sports', {
        sport: s.sport, role: s.role || 'main',
        orvia_plans: s.orviaPlans != null ? !!s.orviaPlans : true,
        external_plan: !!s.externalPlan, priority: s.priority || 0,
        active: s.active != null ? !!s.active : true
      }, 'user_id,sport');
    },
    async saveMany(list) {
      return B.upsertMany('user_sports', list.map(s => ({
        sport: s.sport, role: s.role || 'main',
        orvia_plans: s.orviaPlans != null ? !!s.orviaPlans : true,
        external_plan: !!s.externalPlan, priority: s.priority || 0,
        active: s.active != null ? !!s.active : true
      })), 'user_id,sport');
    },
    async remove(id) { return B.remove('user_sports', id); }
  };
})();
