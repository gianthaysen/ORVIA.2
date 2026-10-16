/* ============================================================
   ORVIA · performanceLedgerRepository (v8-448A/B) — Persistenz des Leistungsregisters.

   Erfordert Migration 0051 (Tabellen performance_ledger_entries, performance_record_events,
   performance_milestones, performance_ledger_log, performance_ledger_dirty; RPC orvia_ledger_apply).
   Geladen seit v8-448B; aufgerufen nur bei Flag `performance_ledger` an (siehe performance-ledger-store.js) bzw.
   lesend vom Echtdaten-Probelauf dryRun().

   Ein Aufruf = EINE Transaktion auf dem Server (orvia_ledger_apply): Eintraege der geaenderten
   Aktivitaeten ersetzen, Ereignisse der betroffenen Kennzahlen ersetzen, Meilensteine ersetzen,
   Protokoll anhaengen, „neu zu berechnen"-Vermerke der Kennzahlen loeschen. Ein Abbruch laesst
   den vorherigen Stand vollstaendig stehen. user_id setzt der Server (auth.uid()), nie der Client.
   Ergebnisformat wie alle Repositories (repoBase.ok / fail).
   ============================================================ */
(function () {
  const O = window.ORVIA = window.ORVIA || {};
  const B = () => O.repoBase;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* Nur Aktivitaeten mit Server-Kennung koennen ins Register (Fremdschluessel auf activities.id). */
  function persistable(id) { return UUID.test(String(id || '')); }

  async function apply(payload) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!b.online()) return b.fail('offline', 'Offline — Register wird spaeter gespeichert.', { offline: true, sync_status: 'pending' });
    const p = payload || {};
    const ids = (p.activityIds || []).filter(persistable);
    const keep = e => persistable(e.activity_id);
    try {
      const { data, error } = await b.sb().rpc('orvia_ledger_apply', {
        p_calc_version: p.calcVersion,
        p_activity_ids: ids,
        p_entries: (p.entries || []).filter(keep),
        p_metric_keys: p.metricKeys || [],
        p_events: (p.events || []).filter(keep),
        p_milestones: p.milestones == null ? null : p.milestones.filter(keep),
        p_log: p.log || []
      });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  /* Kennzahlen, die der Server als „neu zu berechnen" vermerkt hat (z. B. Aktivitaet auf einem anderen Geraet geloescht). */
  async function dirtyKeys(calcVersion) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base' } };
    const guard = b.requireAuth(); if (guard) return guard;
    try {
      const { data, error } = await b.sb().from('performance_ledger_dirty').select('metric_key').eq('calc_version', calcVersion).eq('user_id', b.currentUserId());
      if (error) return b.fail('query_failed', error.message);
      return b.ok((data || []).map(r => r.metric_key));
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  /* ---- v8-448B · Vollstaendiger Bestand fuer das Register ---------------------------------------
     Die App laedt sonst nur die juengsten 200 Aktivitaeten. Das Register braucht ALLE — aber nicht jedes Mal
     alles: zuerst ein schlanker INDEX (id, updated_at, Kopplung) ueber den ganzen Bestand, seitenweise; dann
     nur die geaenderten Aktivitaeten mit genau den Feldern, die die Pruefung braucht (keine vollen Messreihen,
     keine Strecke). complete=true NUR, wenn jede Seite gelesen wurde — erst dann darf Fehlen als Loeschung gelten. */
  const INDEX_PAGE = 1000;
  async function listActivityIndex(opts) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base' } };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!b.online()) return b.fail('offline', 'Offline — Bestand nicht vollstaendig lesbar.', { offline: true });
    const page = (opts && opts.pageSize) || INDEX_PAGE, maxPages = (opts && opts.maxPages) || 200;
    const rows = [];
    let last = null;
    try {
      /* Schluessel-Blaettern (id > letzte id) statt Seitenzahl: ein Einfuegen waehrend des Lesens verschiebt keine Seite. */
      for (let i = 0; i < maxPages; i++) {
        let q = b.sb().from('activities').select('id,updated_at,linked_activity_id,status,client_record_id').eq('user_id', b.currentUserId());
        if (last) q = q.gt('id', last);
        const { data, error } = await q.order('id', { ascending: true }).limit(page);
        if (error) return b.fail('query_failed', error.message, { data: { rows, complete: false } });
        const got = Array.isArray(data) ? data : [];
        rows.push(...got);
        if (got.length < page) return b.ok({ rows, complete: true });
        last = got[got.length - 1].id;
      }
      return b.ok({ rows, complete: false });                    // Obergrenze erreicht: nie als vollstaendig behandeln
    } catch (e) { return b.fail('exception', String(e && e.message || e), { data: { rows, complete: false } }); }
  }
  /* Gegenprobe vor jeder Loeschung: welche der Kandidaten gibt es WIRKLICH nicht mehr? */
  async function existingIds(ids) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base' } };
    const guard = b.requireAuth(); if (guard) return guard;
    const out = [];
    try {
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await b.sb().from('activities').select('id').eq('user_id', b.currentUserId()).in('id', ids.slice(i, i + 200));
        if (error) return b.fail('query_failed', error.message);
        (data || []).forEach(r => out.push(r.id));
      }
      return b.ok(out);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }
  /* Felder fuer die Pruefung (metric-eligibility) — Teilpfade aus metrics, nicht der ganze Block. */
  const SELECT = ['id', 'user_id', 'client_record_id', 'sport_id', 'source', 'source_record_id', 'workout_session_id', 'started_at', 'ended_at',
    'duration_seconds', 'status', 'summary', 'linked_activity_id', 'link_kind', 'updated_at',
    'm_dv:metrics->detailsVersion', 'm_df:metrics->detailsFetchedAt', 'm_g:metrics->garmin', 'm_be:metrics->best_efforts',
    'm_xf:metrics->ext->fields', 'm_sd:metrics->streams->distance', 'm_sm:metrics->stream_meta', 'm_c:metrics->corrections',
    'm_dc:metrics->durationCorrection', 'm_ssr:metrics->source_sport_raw'].join(',');
  function rebuild(r) {
    const m = {};
    if (r.m_dv != null) m.detailsVersion = r.m_dv;
    if (r.m_df != null) m.detailsFetchedAt = r.m_df;
    if (r.m_g != null) m.garmin = r.m_g;
    if (r.m_be != null) m.best_efforts = r.m_be;
    if (r.m_xf != null) m.ext = { v: 1, fields: r.m_xf };
    if (r.m_sd != null) m.streams = { distance: r.m_sd };
    if (r.m_sm != null) m.stream_meta = r.m_sm;
    if (r.m_c != null) m.corrections = r.m_c;
    if (r.m_dc != null) m.durationCorrection = r.m_dc;
    if (r.m_ssr != null) m.source_sport_raw = r.m_ssr;
    const out = {};
    Object.keys(r).forEach(k => { if (!/^m_/.test(k)) out[k] = r[k]; });
    out.metrics = m;
    return out;
  }
  async function fetchActivities(ids, opts) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base' } };
    const guard = b.requireAuth(); if (guard) return guard;
    const chunk = (opts && opts.chunk) || 100, out = [];
    try {
      for (let i = 0; i < ids.length; i += chunk) {
        const part = ids.slice(i, i + chunk);
        const { data, error } = await b.sb().from('activities').select(SELECT).eq('user_id', b.currentUserId()).in('id', part);
        if (error) return b.fail('query_failed', error.message, { data: out });
        (data || []).forEach(r => out.push(rebuild(r)));
      }
      return b.ok(out);
    } catch (e) { return b.fail('exception', String(e && e.message || e), { data: out }); }
  }

  O.performanceLedgerRepository = { apply, dirtyKeys, persistable, listActivityIndex, existingIds, fetchActivities, rebuild, SELECT };
})();
