/* ============================================================
   ORVIA · performanceLedgerRepository (v8-448A, VORBEREITET) — Persistenz des Leistungsregisters.

   Erfordert Migration 0051 (Tabellen performance_ledger_entries, performance_record_events,
   performance_milestones, performance_ledger_log, performance_ledger_dirty; RPC orvia_ledger_apply).
   Nicht geladen, solange das Flag `performance_ledger` aus ist (siehe performance-ledger-store.js).

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

  O.performanceLedgerRepository = { apply, dirtyKeys, persistable };
})();
