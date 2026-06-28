/* ============================================================
   ORVIA · activity-sync — Outbox-Flush lokaler Aktivitäten → Supabase (Inkrement 2B, VORBEREITET).
   ⚠️ Erfordert 0009 (Tabelle/RPC), NICHT live verifiziert. Offline = No-Op. Idempotent:
   pusht NUR Workout-Aktivitäten mit echter Server-Session-uuid (workoutSessionId); reine
   offline-Sessions (nur client_session_id) werden erst nach Session-Sync berücksichtigt.
   Erfolgreich gepushte werden lokal via activityStore.markSynced auf Server-Identität gehoben.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  function online() { try { return navigator.onLine; } catch (e) { return true; } }

  async function flushPendingActivities() {
    var store = O.activityStore, repo = O.repos && O.repos.activity;
    if (!store || !repo) return { ok: false, error: 'unavailable', pushed: 0 };
    if (!online()) return { ok: false, error: 'offline', pushed: 0, remaining: store.pendingActivities().length };
    var pending = store.pendingActivities().filter(function (a) { return a.source === 'orvia_workout'; });
    var pushed = 0, failed = 0, skipped = 0;
    for (var i = 0; i < pending.length; i++) {
      var a = pending[i];
      var sid = a.workoutSessionId;                 // NUR echte Server-uuid; kein client_session_id pushen
      if (!sid) { skipped++; continue; }
      var r = await repo.upsertFromSession(sid, a.summary || {});
      if (r && r.success) { store.markSynced(a.clientRecordId, r.data && r.data.id); pushed++; }
      else failed++;
    }
    return { ok: failed === 0, pushed: pushed, failed: failed, skipped: skipped, remaining: store.pendingActivities().length };
  }

  O.activitySync = { flushPendingActivities: flushPendingActivities };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.activitySync;
})(typeof globalThis !== 'undefined' ? globalThis : this);
