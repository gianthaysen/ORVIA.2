/* ============================================================
   ORVIA · repoBase — gemeinsame Basis aller Repositories
   Erzwingt: aktueller Auth-Nutzer, user_id-Scoping, strukturierte Fehler,
   keine Fremddaten, Offline-Bewusstsein, sichere Upserts.
   Kein direkter Supabase-Zugriff außerhalb der Repositories.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.repos = O.repos || {};

  function sb() { return O.sb || null; }
  function currentUserId() { return (O.user && O.user.id) || null; }
  function online() { try { return navigator.onLine; } catch (e) { return true; } }

  // Einheitliches Ergebnis-Objekt. Nie eine fremde user_id durchlassen.
  function ok(data) { return { ok: true, data: data, error: null, offline: !online() }; }
  function fail(code, message, extra) {
    return Object.assign({ ok: false, data: null, error: { code: code, message: message } }, extra || {});
  }

  // Stellt sicher, dass ein Record-Objekt die EIGENE user_id trägt (überschreibt fremde).
  function stampUser(rec) {
    const uid = currentUserId();
    const out = Object.assign({}, rec);
    out.user_id = uid; // immer auf den aktuellen Nutzer zwingen
    return out;
  }

  function requireAuth() {
    if (!sb()) return fail('no_client', 'Supabase-Client nicht initialisiert.');
    if (!currentUserId()) return fail('no_session', 'Keine aktive Sitzung.');
    return null;
  }

  // Generische, immer auf den Nutzer eingeschränkte Operationen.
  async function selectAll(table, opts) {
    const guard = requireAuth(); if (guard) return guard;
    if (!online()) return fail('offline', 'Offline — Lesen aus der Cloud nicht möglich.', { offline: true });
    try {
      let q = sb().from(table).select((opts && opts.columns) || '*').eq('user_id', currentUserId());
      if (opts && opts.order) q = q.order(opts.order.column, { ascending: !!opts.order.ascending });
      if (opts && opts.limit) q = q.limit(opts.limit);
      if (opts && opts.filters) opts.filters.forEach(f => { q = q.eq(f[0], f[1]); });
      const { data, error } = await q;
      if (error) return fail('query_failed', error.message);
      return ok(data || []);
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  // Upsert mit erzwungener user_id + onConflict (sichere Idempotenz).
  async function upsert(table, record, onConflict) {
    const guard = requireAuth(); if (guard) return guard;
    const row = stampUser(record);
    if (!online()) return fail('offline', 'Offline — in Queue stellen.', { offline: true, pending: row });
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
    if (!online()) return fail('offline', 'Offline — in Queue stellen.', { offline: true, pending: rows });
    try {
      const { data, error } = await sb().from(table).upsert(rows, onConflict ? { onConflict: onConflict } : undefined).select();
      if (error) return fail('upsert_failed', error.message);
      return ok(data || rows);
    } catch (e) { return fail('exception', String(e && e.message || e)); }
  }

  async function remove(table, id) {
    const guard = requireAuth(); if (guard) return guard;
    if (!online()) return fail('offline', 'Offline — Löschen nicht möglich.', { offline: true });
    try {
      // user_id-Filter zusätzlich zur RLS (Defense in depth).
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
