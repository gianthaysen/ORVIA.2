/* ORVIA · trainingPlanRepository — Plan-Vorlagen (System/User) + persönliche Pläne */
(function () {
  window.ORVIA = window.ORVIA || {}; const O = window.ORVIA; O.repos = O.repos || {};
  if (!O.repoBase) { console.error('trainingPlanRepository: repoBase fehlt'); return; }
  const B = O.repoBase;

  O.repos.trainingPlan = {
    // Vorlagen: RLS liefert is_system OR eigene. (Katalog-Lesung, nicht user_id-gescoped.)
    async listTemplates() {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try { const { data, error } = await B.sb().from('workout_templates').select('*').eq('active', true);
        if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async getTemplateDays(templateId) {
      const g = B.requireAuth(); if (g) return g;
      try { const { data, error } = await B.sb().from('workout_template_days').select('*,workout_template_exercises(*)').eq('template_id', templateId).order('day_index', { ascending: true });
        if (error) return B.fail('query_failed', error.message); return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // Persönliche Pläne (user_id-gescoped).
    async listPlans() { return B.selectAll('user_training_plans', { order: { column: 'created_at', ascending: false } }); },
    async createPlan(p) {
      return B.upsert('user_training_plans', {
        name: p.name, split_type: p.splitType || null, sport_key: p.sportKey || null,
        source_template_id: p.sourceTemplateId || null, active: !!p.active,
        start_date: p.startDate || null, end_date: p.endDate || null,
        version: p.version || 1, status: p.status || 'draft'
      });
    },
    async addPlanDay(planId, d) {
      return B.upsert('training_plan_days', { plan_id: planId, day_index: d.dayIndex, weekday: d.weekday != null ? d.weekday : null, name: d.name || null, focus: d.focus || null }, 'plan_id,day_index');
    },
    async addPlanExercise(planDayId, ex) {
      return B.upsert('training_plan_exercises', {
        plan_day_id: planDayId, exercise_id: ex.exerciseId || null, order_index: ex.order || 0,
        planned_sets: ex.plannedSets != null ? ex.plannedSets : null, min_reps: ex.minReps != null ? ex.minReps : null,
        max_reps: ex.maxReps != null ? ex.maxReps : null, target_rir: ex.targetRir != null ? ex.targetRir : null,
        rest_seconds: ex.restSeconds != null ? ex.restSeconds : null, notes: ex.notes || null
      });
    },
    // Vorlage → persönlicher Plan kopieren (Tage + Übungen). Vorlage bleibt unverändert/lesbar.
    async copyFromTemplate(templateId, planName) {
      const tmpl = await this.getTemplateDays(templateId);
      if (!tmpl.success) return tmpl;
      const planRes = await this.createPlan({ name: planName || 'Mein Plan', sourceTemplateId: templateId, status: 'draft' });
      if (!planRes.success) return planRes;
      const planId = planRes.data && planRes.data.id;
      for (const day of (tmpl.data || [])) {
        const dRes = await this.addPlanDay(planId, { dayIndex: day.day_index, name: day.name, focus: day.focus });
        const planDayId = dRes.data && dRes.data.id;
        if (planDayId) for (const te of (day.workout_template_exercises || [])) {
          await this.addPlanExercise(planDayId, { exerciseId: te.exercise_id, order: te.order_index, plannedSets: te.planned_sets, minReps: te.min_reps, maxReps: te.max_reps, targetRir: te.target_rir, restSeconds: te.rest_seconds, notes: te.notes });
        }
      }
      return B.ok({ planId: planId });
    }
  };
})();
