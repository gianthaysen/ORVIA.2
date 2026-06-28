/* ORVIA · availabilityRepository — weekly_availability + fixed_schedule_items */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  O.repos.availability = {
    async list() { return B.selectAll('weekly_availability', { order: { column: 'weekday', ascending: true } }); },
    async save(day) {
      return B.upsert('weekly_availability', {
        weekday: day.weekday,
        available: day.available != null ? !!day.available : true,
        preferred: !!day.preferred,
        max_minutes: day.maxMinutes != null ? day.maxMinutes : null,
        preferred_time: day.preferredTime || null,
        double_allowed: !!day.doubleAllowed
      }, 'user_id,weekday');
    },
    async saveWeek(days) {
      return B.upsertMany('weekly_availability', days.map(day => ({
        weekday: day.weekday, available: day.available != null ? !!day.available : true,
        preferred: !!day.preferred, max_minutes: day.maxMinutes != null ? day.maxMinutes : null,
        preferred_time: day.preferredTime || null, double_allowed: !!day.doubleAllowed
      })), 'user_id,weekday');
    }
  };

  O.repos.fixedSchedule = {
    async list() { return B.selectAll('fixed_schedule_items'); },
    async save(item) {
      const row = {
        sport: item.sport || null, weekday: item.weekday != null ? item.weekday : null,
        start_time: item.startTime || null, duration_min: item.durationMin != null ? item.durationMin : null,
        type: item.type || 'training', intensity: item.intensity != null ? item.intensity : null,
        recurring: item.recurring != null ? !!item.recurring : true, blocked: !!item.blocked
      };
      if (item.id) row.id = item.id;
      return B.upsert('fixed_schedule_items', row, 'id');
    },
    async remove(id) { return B.remove('fixed_schedule_items', id); }
  };
})();
