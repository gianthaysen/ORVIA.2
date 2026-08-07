/* ============================================================
   ORVIA · repoBase — gemeinsame Basis aller Repositories
   VERBINDLICHES Ergebnisformat (genau diese Felder, kein `ok` mehr):
     { success: boolean,
       data: any | null,
       error: null | { code?, message },
       source: 'supabase' | 'indexeddb' | 'legacy_blob' | 'empty',
       sync_status: 'synced' | 'pending' | 'conflict' | 'failed',
       offline?: boolean }
   Erzwingt: aktueller Auth-Nutzer, user_id-Scoping, keine Fremddaten, sichere Upserts.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.repos = O.repos || {};

  function sb() { return O.sb || null; }
  function currentUserId() { return (O.user && O.user.id) || null; }
  function online() { try { return navigator.onLine; } catch (e) { return true; } }

  // Erfolgsergebnis. opts: { source, sync_status }.
  function ok(data, opts) {
    opts = opts || {};
    return {
      success: true, data: data === undefined ? null : data, error: null,
      source: opts.source || 'supabase', sync_status: opts.sync_status || 'synced',
      offline: !online()
    };
  }
  // Fehlerergebnis. extra kann source/sync_status/offline/pending überschreiben.
  function fail(code, message, extra) {
    extra = extra || {};
    return Object.assign({
      success: false, data: null, error: { code: code, message: message },
      source: extra.source || 'supabase', sync_status: extra.sync_status || 'failed',
      offline: extra.offline != null ? extra.offline : !online()
    }, extra);
  }

  // Erzwingt EIGENE user_id (überschreibt jede aus der UI gelieferte).
  function stampUser(rec) {
    const out = Object.assign({}, rec);
    out.user_id = currentUserId();
    return out;
  }

  function requireAuth() {
    if (!sb()) return fail('no_client', 'Supabase-Client nicht initialisiert.', { source: 'empty' });
    if (!currentUserId()) return fail('no_session', 'Keine aktive Sitzung.', { source: 'empty' });
    return null;
  }

  async function selectAll(table, opts) {
    const guard = requireAuth(); if (guard) return guard;
    if (!online()) return fail('offline', 'Offline — Lesen nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      let q = sb().from(table).select((opts && opts.columns) || '*').eq('user_id', currentUserId());
      if (opts && opts.order) q = q.order(opts.order.column, { ascending: !!opts.order.ascending });
      if (opts && opts.limit) q = q.limit(opts.limit);
      if (opts && opts.filters) opts.filters.forEach(f => { q = q.eq(f[0], f[1]); });
      const { data, error } = await q;
      if (error) return fail('query_failed', error.message);
      return ok(data || [], { source: (data && data.length) ? 'supabase' : 'empty' });
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  async function upsert(table, record, onConflict) {
    const guard = requireAuth(); if (guard) return guard;
    const row = stampUser(record);
    if (!online()) return fail('offline', 'Offline — in Queue stellen.', { offline: true, pending: row, source: 'indexeddb', sync_status: 'pending' });
    try {
      const q = sb().from(table).upsert(row, onConflict ? { onConflict: onConflict } : undefined).select();
      const { data, error } = await q;
      if (error) return fail('upsert_failed', error.message);
      return ok((data && data[0]) || row);
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  async function upsertMany(table, records, onConflict) {
    const guard = requireAuth(); if (guard) return guard;
    const rows = (records || []).map(stampUser);
    if (!rows.length) return ok([]);
    if (!online()) return fail('offline', 'Offline — in Queue stellen.', { offline: true, pending: rows, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await sb().from(table).upsert(rows, onConflict ? { onConflict: onConflict } : undefined).select();
      if (error) return fail('upsert_failed', error.message);
      return ok(data || rows);
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  async function remove(table, id) {
    const guard = requireAuth(); if (guard) return guard;
    if (!online()) return fail('offline', 'Offline — Löschen nicht möglich.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { error } = await sb().from(table).delete().eq('id', id).eq('user_id', currentUserId());
      if (error) return fail('delete_failed', error.message);
      return ok(true);
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  O.repoBase = {
    sb, currentUserId, online, ok, fail, stampUser, requireAuth,
    selectAll, upsert, upsertMany, remove
  };
})();
