/* ============================================================
   ORVIA · activity-sync — Outbox-Flush lokaler Aktivitäten → Supabase (Inkrement 2B, AKTIV).
   Idempotent: Workout-Activities via RPC orvia_upsert_activity_from_session (nur mit echter
   Server-Session-uuid); manuelle Activities via activityRepository.upsertManual. Erfolgreiche
   werden lokal via activityStore.markSynced auf Server-Identität gehoben. Offline = No-Op.
   activity_identity_conflict bleibt FEHLER (kein synced). Single-Flight gegen parallele Flushes.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  function online() { try { return navigator.onLine; } catch (e) { return true; } }

  var _flushing = false;     // Single-Flight-Mutex
  var _rerun = false;        // falls während eines Flushes ein weiterer angefordert wird

  async function flushPendingActivities() {
    var store = O.activityStore, repo = O.repos && O.repos.activity;
    if (!store || !repo) return { ok: false, error: 'unavailable', pushed: 0 };
    if (!online()) return { ok: false, error: 'offline', pushed: 0, remaining: store.pendingActivities().length };
    if (_flushing) { _rerun = true; return { ok: true, busy: true, pushed: 0 }; }   // kein paralleler Flush
    _flushing = true;
    var pushed = 0, failed = 0, skipped = 0, conflicts = 0, deleted = 0;
    try {
      // 0) Zuerst Löschungen (Tombstones) synchronisieren, damit nichts erneut hochgepusht wird.
      var dels = store.pendingDeletes();
      for (var d = 0; d < dels.length; d++) {
        var t = dels[d];
        try {
          var dr;
          if (t.kind === 'workout' && t.workoutSessionId) dr = await repo.deleteWorkout(t.workoutSessionId);
          else if (t.serverId) dr = await repo.deleteActivity(t.serverId);
          else { store.removeTombstone(t.clientRecordId); continue; }   // nur lokal → nichts am Server
          if (dr && dr.success) { store.removeTombstone(t.clientRecordId); deleted++; }
          else failed++;
        } catch (e) { failed++; }
      }
      var pending = store.pendingActivities();
      for (var i = 0; i < pending.length; i++) {
        var a = pending[i];
        try {
          var r;
          if (a.source === 'orvia_workout') {
            if (!a.workoutSessionId) { skipped++; continue; }       // nur echte Server-Session-uuid pushen
            r = await repo.upsertFromSession(a.workoutSessionId, a.summary || {}, a.metrics || {}, a.clientRecordId || null);
          } else if (a.source === 'manual' || a.source === 'import') {
            r = await repo.upsertManual(serverRowFromLocal(a));
          } else { skipped++; continue; }                            // legacy_local wird NICHT gepusht
          if (r && r.success) { store.markSynced(a.clientRecordId, r.data && r.data.id); pushed++; }
          else { failed++; if (r && r.error && /identity_conflict/.test(String(r.error.code) + String(r.error.message))) conflicts++; }
        } catch (e) { failed++; }
      }
    } finally { _flushing = false; }
    var res = { ok: failed === 0, pushed: pushed, deleted: deleted, failed: failed, skipped: skipped, conflicts: conflicts, remaining: store.pendingActivities().length, remainingDeletes: store.pendingDeletes().length };
    if (_rerun && online()) { _rerun = false; return flushPendingActivities().then ? flushPendingActivities() : res; }
    _rerun = false;
    return res;
  }

  // Lokale manuelle Activity → Server-Row (RLS-geschützter Upsert; user_id setzt repoBase via stampUser).
  function serverRowFromLocal(a) {
    return {
      client_record_id: a.clientRecordId, sport_id: a.sportId, source: a.source || 'manual',
      source_record_id: a.sourceRecordId, started_at: a.startedAt, ended_at: a.endedAt,
      duration_seconds: a.durationSeconds, status: a.status || 'completed',
      summary: a.summary || {}, metrics: a.metrics || {}
    };
  }

  // Auto-Trigger: online-Event + verzögerter Start-Flush (nach Auth), wenn ein Nutzer vorhanden ist.
  function _autoFlush() { try { if (O.user && O.user.id) flushPendingActivities(); } catch (e) {} }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', _autoFlush);
    window.addEventListener('orvia:auth-ready', _autoFlush);   // falls Auth ein solches Event feuert
    try { setTimeout(_autoFlush, 1500); } catch (e) {}          // App-Start nach Auth-Init (defensiv)
  }

  O.activitySync = { flushPendingActivities: flushPendingActivities, _autoFlush: _autoFlush };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.activitySync;
})(typeof globalThis !== 'undefined' ? globalThis : this);
