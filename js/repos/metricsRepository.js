/* ============================================================
   ORVIA · metricsRepository — user_metrics & Provider-Stammdaten
   (Migration 0019: data_providers, connected_devices, user_metrics,
    profile_metric_settings, metric_anomalies)
   Ergebnisformat und user_id-Scoping über repoBase (B.ok/B.fail).
   Keine UI, kein DOM. Zeit-/Datumsquelle wie data.js/checkin-store.js:
   globales todayStr() falls geladen, sonst ORVIA.clock, sonst Date.now().
   Auflösung des aktiven Werts passiert NICHT hier, sondern in
   js/metrics/metric-resolver.js (pure).
   ============================================================ */
(function () {
  const O = window.ORVIA, B = O.repoBase;

  function _reg() { return O.metricRegistry || null; }

  /* Zeitquelle: ORVIA.clock (injizierbar für Tests, P0); ohne Clock exakt Date.now(). */
  function _now() {
    return new Date((O.clock && typeof O.clock.now === 'function') ? O.clock.now() : Date.now());
  }
  function _today() {
    if (typeof todayStr === 'function') return todayStr();
    const d = _now();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  // Lokales Datum vor N Tagen (Mittag-Anker gegen DST-Kanten, Muster ui.js).
  function _daysAgo(days) {
    const d = new Date(_today() + 'T12:00');
    d.setDate(d.getDate() - days);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  O.repos.metrics = {
    // Messwerte der letzten `days` Tage, optional auf metric_types gefiltert.
    async listRecent(days, metricTypes) {
      days = (typeof days === 'number' && days > 0) ? days : 120;
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Lesen nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        let q = B.sb().from('user_metrics').select('*')
          .eq('user_id', B.currentUserId())
          .gte('metric_date', _daysAgo(days))
          .order('metric_date', { ascending: false });
        if (Array.isArray(metricTypes) && metricTypes.length) q = q.in('metric_type', metricTypes);
        const { data, error } = await q;
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // Vollständigere Historie EINER Metrik (Trend/Verlauf).
    async listForMetric(metricType, limit) {
      if (!metricType || typeof metricType !== 'string') return B.fail('invalid_metric_type', 'metricType fehlt.');
      limit = (typeof limit === 'number' && limit > 0) ? limit : 200;
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Lesen nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const { data, error } = await B.sb().from('user_metrics').select('*')
          .eq('user_id', B.currentUserId())
          .eq('metric_type', metricType)
          .order('metric_date', { ascending: false })
          .limit(limit);
        if (error) return B.fail('query_failed', error.message);
        return B.ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // Nutzer-Abweichungen vom Registry-Default (Standardnutzer: 0 Zeilen).
    async getSettings() {
      return B.selectAll('profile_metric_settings');
    },

    // Upsert einer Metrik-Einstellung; nur bekannte Spalten werden übernommen.
    async saveSetting(metricType, patch) {
      if (!metricType || typeof metricType !== 'string') return B.fail('invalid_metric_type', 'metricType fehlt.');
      const R = _reg();
      if (R && !R.byId(metricType)) return B.fail('unknown_metric', 'Unbekannte Metrik: ' + metricType);
      patch = patch || {};
      const row = { metric_type: metricType };
      ['edit_mode', 'preferred_source', 'manual_override_enabled', 'display_enabled'].forEach(function (k) {
        if (patch[k] !== undefined) row[k] = patch[k];
      });
      return B.upsert('profile_metric_settings', row, 'user_id,metric_type');
    },

    /* Manueller Override: neue user_metrics-Zeile (append-only, Original
       bleibt erhalten und wird über original_metric_id referenziert). */
    async saveManualOverride(metricType, value, unit, reason, originalMetricId) {
      const R = _reg();
      if (!R) return B.fail('no_registry', 'metric-registry.js nicht geladen.');
      if (!metricType || !R.byId(metricType)) return B.fail('unknown_metric', 'Unbekannte Metrik: ' + metricType);
      if (typeof value !== 'number' || !isFinite(value)) return B.fail('invalid_value', 'value_numeric muss eine endliche Zahl sein.');
      if (R.OVERRIDE_REASONS.indexOf(reason) < 0) return B.fail('invalid_reason', 'override_reason muss einer von ' + R.OVERRIDE_REASONS.join(', ') + ' sein.');
      const g = B.requireAuth(); if (g) return g;
      const nowIso = _now().toISOString();
      const row = B.stampUser({
        metric_type: metricType,
        value_numeric: value,
        unit: unit || null,
        metric_date: _today(),
        measured_at: nowIso,
        source_type: 'manual_override',
        is_manual_override: true,
        override_reason: reason,
        original_metric_id: originalMetricId || null,
        validity: 'valid',
        source_record_id: 'manual_override:' + metricType + ':' + nowIso
      });
      if (!B.online()) return B.fail('offline', 'Offline — in Queue stellen.', { offline: true, pending: row, source: 'indexeddb', sync_status: 'pending' });
      try {
        const { data, error } = await B.sb().from('user_metrics').insert(row).select();
        if (error) return B.fail('insert_failed', error.message);
        return B.ok((data && data[0]) || row);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    },

    // Provider-Verbindungen des Nutzers (Verbindungsstatus, letzter Sync).
    async listProviders() {
      return B.selectAll('data_providers', { order: { column: 'provider_type', ascending: true } });
    },

    // Erkannte Geräte des Nutzers.
    async listDevices() {
      return B.selectAll('connected_devices', { order: { column: 'last_seen_at', ascending: false } });
    },

    // Offene Anomalien (out_of_range / implausible_jump …).
    async listOpenAnomalies() {
      return B.selectAll('metric_anomalies', {
        filters: [['resolution_status', 'open']],
        order: { column: 'created_at', ascending: false }
      });
    },

    // Nutzerentscheidung zu einer Anomalie; Re-Validierung macht der Worker.
    async resolveAnomaly(id, status) {
      if (status !== 'accepted' && status !== 'rejected') {
        return B.fail('invalid_status', "status muss 'accepted' oder 'rejected' sein.");
      }
      if (!id) return B.fail('invalid_id', 'Anomalie-ID fehlt.');
      const g = B.requireAuth(); if (g) return g;
      if (!B.online()) return B.fail('offline', 'Offline — Aktualisieren nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
      try {
        const { data, error } = await B.sb().from('metric_anomalies')
          .update({ resolution_status: status, resolved_at: _now().toISOString() })
          .eq('id', id).eq('user_id', B.currentUserId())
          .select();
        if (error) return B.fail('update_failed', error.message);
        if (!data || !data.length) return B.fail('not_found', 'Anomalie nicht gefunden.');
        return B.ok(data[0]);
      } catch (e) { return B.fail('exception', String(e && e.message || e)); }
    }
  };
})();
