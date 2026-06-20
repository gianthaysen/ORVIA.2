/* ORVIA · goalRepository — user_goals + user_sports */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  O.repos.goal = {
    async list() { return B.selectAll('user_goals', { order: { column: 'created_at', ascending: true } }); },
    async save(goal) {
      const row = {
        client_goal_id: goal.clientGoalId || null,
        goal_type: goal.type || null, title: goal.title || null,
        target_value: goal.targetValue != null ? goal.targetValue : null,
        target_unit: goal.targetUnit || null, target_date: goal.targetDate || null,
        priority: goal.priority || 'primary', status: goal.status || 'active'
      };
      if (goal.id) row.id = goal.id;
      // Idempotent über deterministische client_goal_id (verhindert Ziel-Dubletten bei Re-Migration).
      return goal.clientGoalId ? B.upsert('user_goals', row, 'user_id,client_goal_id')
                               : B.upsert('user_goals', row, 'id');
    },
    async remove(id) { return B.remove('user_goals', id); }
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
