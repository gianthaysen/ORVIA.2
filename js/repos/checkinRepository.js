/* ORVIA · checkinRepository — daily_checkins (Unique: user_id+local_date+checkin_type) */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  // Complaints tief genug kopieren (Array + jedes Objekt), keine Fremdreferenzen.
  function copyComplaints(arr) {
    return Array.isArray(arr)
      ? arr.map(function (item) { return item && typeof item === 'object' ? Object.assign({}, item) : item; })
      : [];
  }

  var toRow = function (date, type, m) {
    m = m || {};
    // Vorhandenes complaints vollständig übernehmen (mehrere Beschwerden, Typ/Score/Region/Notiz …).
    const complaints = copyComplaints(m.complaints);
    // Knie-Kompatibilität: morning.knee in complaints spiegeln — ohne Dublette.
    if (m.knee != null) {
      const ki = complaints.findIndex(function (item) { return item && item.type === 'knee'; });
      if (ki >= 0) complaints[ki] = Object.assign({}, complaints[ki], { score: m.knee });
      else complaints.push({ type: 'knee', score: m.knee });
    }
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
      complaints: complaints,
      source: m.source || 'manual'
    };
  }
  /* H3: 0015-Spalten (energy/note, primär evening) NUR senden wenn belegt —
     kompatibel mit Instanzen, auf denen 0015 noch nicht ausgeführt wurde. */
  const _toRowBase = toRow;
  toRow = function (date, type, m) {
    const row = _toRowBase(date, type, m);
    m = m || {};
    if (m.energy != null) row.energy = m.energy;
    if (m.note) row.note = m.note;
    return row;
  };

  O.repos.checkin = {
    toRow, copyComplaints,
    async listRange(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        let q = B.sb().from('daily_checkins').select('*')
          .eq('user_id', B.currentUserId()).order('local_date', { ascending: true });
        if (fromDate) q = q.gte('local_date', fromDate);
        if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    async save(date, type, morning) {
      return B.upsert('daily_checkins', toRow(date, type, morning), 'user_id,local_date,checkin_type');
    },
    async saveMany(rows) { return B.upsertMany('daily_checkins', rows, 'user_id,local_date,checkin_type'); }
  };
})();
