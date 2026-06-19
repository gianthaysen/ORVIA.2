/* ORVIA · trainingLoadRepository — training_load_daily (Dedupe via external_id / Natur-Key) */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  // sRPE-Last = Dauer * RPE (Mobilität fix RPE 2), konsistent mit calc.sessionLoad.
  function computeLoad(sport, durationMin, rpe) {
    const r = sport === 'Mobilität' ? 2 : (rpe || 5);
    return (durationMin || 0) * r;
  }

  function toRow(date, sport, s) {
    const dur = s.dur != null ? s.dur : null;
    const rpe = s.rpe != null ? s.rpe : null;
    return {
      local_date: date,
      sport: sport,
      source: s.source || (s.note && /strava|garmin/i.test(s.note) ? 'strava' : 'manual'),
      // Stabile Client-ID: erlaubt mehrere Einheiten/Tag/Sportart, dedupliziert aber Re-Syncs.
      client_session_id: s.client_session_id || s.clientSessionId || null,
      duration_min: dur,
      distance_km: s.dist != null ? s.dist : null,
      intensity: s.hr != null ? s.hr : null,
      session_rpe: rpe,
      computed_load: computeLoad(sport, dur, rpe),
      external_id: s.external_id || s.externalId || null
    };
  }
  // Konflikt-Key je Zeile bestimmen (external_id > client_session_id > kein Dedupe).
  function conflictKey(row) {
    if (row.external_id) return 'user_id,source,external_id';
    if (row.client_session_id) return 'user_id,client_session_id';
    return null;
  }

  O.repos.trainingLoad = {
    toRow, computeLoad,
    async listRange(fromDate, toDate) {
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline.', { offline: true });
      try {
        let q = B.sb().from('training_load_daily').select('*')
          .eq('user_id', B.currentUserId()).order('local_date', { ascending: true });
        if (fromDate) q = q.gte('local_date', fromDate);
        if (toDate) q = q.lte('local_date', toDate);
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || []);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },
    conflictKey,
    // Externe Aktivität: dedupe über external_id. Sonst über client_session_id.
    // Ohne beides: reiner Insert (mehrere Einheiten/Tag/Sportart möglich).
    async save(date, sport, session) {
      const row = toRow(date, sport, session);
      const conflict = conflictKey(row);
      return conflict ? B.upsert('training_load_daily', row, conflict)
                      : B.upsert('training_load_daily', row);
    },
    async saveMany(rows) {
      // getrennt nach Konflikt-Key upserten (Postgres erlaubt nur einen onConflict je Aufruf)
      const ext = rows.filter(r => r.external_id);
      const cli = rows.filter(r => !r.external_id && r.client_session_id);
      const none = rows.filter(r => !r.external_id && !r.client_session_id);
      const r1 = ext.length  ? await B.upsertMany('training_load_daily', ext, 'user_id,source,external_id') : B.ok([]);
      const r2 = cli.length  ? await B.upsertMany('training_load_daily', cli, 'user_id,client_session_id')  : B.ok([]);
      const r3 = none.length ? await B.upsertMany('training_load_daily', none)                               : B.ok([]);
      for (const r of [r1, r2, r3]) if (!r.ok) return r;
      return B.ok([].concat(r1.data || [], r2.data || [], r3.data || []));
    }
  };
})();
