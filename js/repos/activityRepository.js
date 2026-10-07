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
  async function upsertFromSession(sessionId, summary, metrics, clientRecordId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!sessionId) return b.fail('invalid_session_id', 'Keine sessionId.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline — Activity-Sync später.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_upsert_activity_from_session', {
        p_session_id: sessionId, p_summary: summary || {}, p_metrics: metrics || {}, p_client_record_id: clientRecordId || null
      });
      // activity_identity_conflict u. a. kommen als error → strukturierter Fehler (NICHT synced).
      if (error) return b.fail(/identity_conflict/.test(error.message || '') ? 'activity_identity_conflict' : 'rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  /* v8-423/424: Felder einer BESTEHENDEN eigenen Aktivitaet nachtragen (Plan-Zuordnung,
     Dauerkorrektur) — direkter Update unter RLS (activities_upd_own) ueber die Server-id.
     Fuer Datensaetze, die NICHT von diesem Geraet stammen (Garmin-Worker, Workout eines
     anderen Geraets mit fremder client_record_id — dort wirft der RPC
     activity_identity_conflict).
     v8-424 · metricsMerge: metrics wird NIE als Ganzes ersetzt. Der Worker reichert
     dieselbe Zeile nachtraeglich an (Route, Messreihen, detailsFetchedAt); ein lokaler
     Stand von vor der Anreicherung haette diese Felder beim Zurueckschreiben geloescht.
     Deshalb: aktuelle Server-metrics lesen, NUR die clientseitig gefuehrten Schluessel
     (ownedKeys) uebertragen — vorhanden ⇒ setzen, lokal entfernt ⇒ entfernen —, Rest
     bleibt Serverstand. localWins=true legt zusaetzlich alle lokalen Schluessel darueber. */
  async function updateFields(id, patch, opts) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!id) return b.fail('invalid_id', 'Keine Aktivitaets-id.', { source: 'empty' });
    if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) return b.fail('empty_patch', 'Nichts zu aktualisieren.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline — Activity-Sync später.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      let send = patch;
      const mm = opts && opts.metricsMerge;
      if (mm && patch.metrics && typeof patch.metrics === 'object') {
        const cur = await b.sb().from('activities').select('metrics').eq('id', id).eq('user_id', b.currentUserId()).limit(1);
        if (cur && cur.error) return b.fail('read_failed', cur.error.message);
        if (!cur || !Array.isArray(cur.data) || !cur.data.length) return b.fail('not_found', 'Aktivitaet nicht gefunden (fremd oder geloescht).');
        const base = (cur.data[0].metrics && typeof cur.data[0].metrics === 'object') ? cur.data[0].metrics : {};
        const local = patch.metrics;
        const merged = mm.localWins ? Object.assign({}, base, local) : Object.assign({}, base);
        /* v8-445: additiveKeys werden nie stillschweigend geloescht. Fehlt der Schluessel lokal
           (Geraet hat die Korrektur des anderen noch nicht gesehen), bleibt der Serverstand.
           Haben beide einen Eintrag, gewinnt je Kennzahl der juengere (Feld `at`). Eine
           Ruecknahme ist selbst ein Eintrag (manual: null) und wird deshalb mit uebertragen. */
        var additive = Array.isArray(mm.additiveKeys) ? mm.additiveKeys : [];
        (Array.isArray(mm.ownedKeys) ? mm.ownedKeys : []).forEach(function (k) {
          var has = Object.prototype.hasOwnProperty.call(local, k);
          if (additive.indexOf(k) >= 0) {
            if (!has || !local[k] || typeof local[k] !== 'object') return;
            var sv = (base[k] && typeof base[k] === 'object') ? base[k] : {};
            var out = Object.assign({}, sv);
            Object.keys(local[k]).forEach(function (mk) {
              var l = local[k][mk], r = sv[mk];
              if (!r || !l || String(l.at || '') >= String(r.at || '')) out[mk] = l;
            });
            merged[k] = out;
            return;
          }
          if (has) merged[k] = local[k]; else delete merged[k];
        });
        send = Object.assign({}, patch, { metrics: merged });
      }
      const { data, error } = await b.sb().from('activities').update(send).eq('id', id).eq('user_id', b.currentUserId()).select();
      if (error) return b.fail('update_failed', error.message);
      if (!Array.isArray(data) || !data.length) return b.fail('not_found', 'Aktivitaet nicht gefunden (fremd oder geloescht).');
      return b.ok(data[0]);
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

  // Manuelle/importierte Activity serverseitig löschen (RLS owner-only).
  async function deleteActivity(id) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    if (!id) return b.fail('invalid_id', 'Keine Activity-ID.', { source: 'empty' });
    return b.remove('activities', id);
  }
  // Vollständiges Workout (Session + Übungen + Sätze + Activity) atomar serverseitig löschen.
  async function deleteWorkout(sessionId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!sessionId) return b.fail('invalid_session_id', 'Keine sessionId.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline — Löschen später.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_delete_workout', { p_session_id: sessionId });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  /* S2c (v8-388): Kopplung Geraeteaufzeichnung ↔ Workout ueber RPC (security invoker, RLS). */
  async function linkRecording(primaryId, recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!primaryId || !recordingId) return b.fail('invalid_id', 'IDs fehlen.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_link_activities', { p_primary: primaryId, p_recording: recordingId });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }
  async function unlinkRecording(recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!recordingId) return b.fail('invalid_id', 'ID fehlt.', { source: 'empty' });
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_unlink_activity', { p_recording: recordingId });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(Array.isArray(data) ? data[0] : data);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }
  async function linkCandidate(recordingId) {
    const b = B(); if (!b) return { success: false, data: null, error: { code: 'no_base', message: 'repoBase fehlt' }, source: 'empty', sync_status: 'failed' };
    const guard = b.requireAuth(); if (guard) return guard;
    if (!b.online()) return b.fail('offline', 'Offline.', { offline: true, source: 'indexeddb', sync_status: 'pending' });
    try {
      const { data, error } = await b.sb().rpc('orvia_link_candidate', { p_recording: recordingId, p_tolerance_min: 20 });
      if (error) return b.fail('rpc_failed', error.message);
      return b.ok(data || null);
    } catch (e) { return b.fail('exception', String(e && e.message || e)); }
  }

  O.repos = O.repos || {};
  O.repos.activity = { upsertFromSession, updateFields, upsertManual, list, getById, deleteActivity, deleteWorkout, linkRecording, unlinkRecording, linkCandidate };
})();
