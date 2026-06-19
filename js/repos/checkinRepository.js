/* ORVIA · checkinRepository — daily_checkins (Unique: user_id+local_date+checkin_type) */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  function toRow(date, type, m) {
    return {
      local_date: date,
      checkin_type: type || 'morning',
      recorded_at: m.ts ? new Date(m.ts).toISOString() : new Date().toISOString(),
      sleep_minutes: m.sleepMin != null ? m.sleepMin : null,
      sleep_quality: m.sleepQ != null ? m.sleepQ : null,
      resting_hr: m.rhr != null ? m.rhr : null,
      hrv_ms: m.hrvMs != null ? m.hrvMs : null,
      hrv_status: m.hrv || null,
      body_battery: m.bb != null ? m.bb : null,
      stress: m.stress || null,
      feel: m.feel != null ? m.feel : null,
      leg_strength: m.legs != null ? m.legs : null,
      doms: m.doms != null ? m.doms : null,
      illness: m.illness != null ? !!m.illness : null,
      complaints: Array.isArray(m.complaints) ? m.complaints
                 : (m.knee != null ? [{ type: 'knee', score: m.knee }] : []),
      source: m.source || 'manual'
    };
  }

  O.repos.checkin = {
    toRow,
    async listRange(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true });
      try {
        let q = B.sb().from('daily_checkins').select('*')
          .eq('user_id', B.currentUserId()).order('local_date', { ascending: true });
        if (fromDate) q = q.gte('local_date', fromDate);
        if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async save(date, type, morning) {
      return B.upsert('daily_checkins', toRow(date, type, morning), 'user_id,local_date,checkin_type');
    },
    async saveMany(rows) { return B.upsertMany('daily_checkins', rows, 'user_id,local_date,checkin_type'); }
  };
})();
