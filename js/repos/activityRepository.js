/* ============================================================
   ORVIA · activityRepository — kanonische Aktivitäten (Inkrement 2B, VORBEREITET).
   ⚠️ Erfordert Tabelle/RPC aus migrations_drafts/0009 (NICHT live verifiziert). Ohne deployte
   Tabelle liefern die Methoden strukturierte Fehler/offline-Ergebnisse; kein Crash.
   Verbindliches Ergebnisformat aus repoBase. Idempotenz serverseitig über
   (user_id, source, source_record_id) + RPC orvia_upsert_activity_from_session.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  const B = () => O.repoBase;

  // Idempotenter Upsert einer Aktivität aus einer (serverseitig vorhandenen) Workout-Session.
  async function upsertFromSession(sessionId, summary) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!sessionId) return b.fail('invalid_session_id', 'Keine sessionId.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline — Activity-Sync später.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_upsert_activity_from_session', { p_session_id: sessionId, p_summary: summary || {} });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  // Manuelle/importierte Aktivität (kein Workout): direkter idempotenter Upsert unter RLS.
  async function upsertManual(row) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    return b.upsert('activities', Object.assign({ source: 'manual' }, row), 'user_id,source,source_record_id');
  }

  async function list(opts) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    return b.selectAll('activities', { order: { column: 'started_at', ascending: false }, limit: (opts && opts.limit) || 100, filters: (opts && opts.filters) || null });
  }

  async function getById(id) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().from('activities').select('*').eq('user_id', b.currentUserId()).eq('id', id).limit(1);
      if (error) return b.fail('query_failed', error.message);
      return b.ok((data && data[0]) || null, { source: (data && data.length) ? 'supabase' : 'empty' });
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  O.repos = O.repos || {};
  O.repos.activity = { upsertFromSession, upsertManual, list, getById };
})();
