/* ============================================================
   ORVIA · checkin-store — Brücke UI ⇆ daily_checkins (Phase-2, Teilblock 1: Morgen)
   daily_checkins ist die PRIMÄRE Quelle des MORGEN-Check-ins (readiness-relevant).
   Der app_state-Blob (DB[date].morning) bleibt Mirror/Legacy-Fallback. Beim Login
   wird der jüngste Zeitraum aus der Tabelle hydriert (Tabelle gewinnt je Tag mit Daten).
   Verbindliches Ergebnisformat: { success, data, error, source, sync_status, offline? }.
   Hinweis: Abend-/Live-Check-in (Protein/Hydration etc.) NICHT Teil dieses Teilblocks.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.checkinMorningMigrated = false;

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null,
             source: source, sync_status: sync_status };
  }
  function isDay(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }

  // daily_checkins-Zeile → morning-Objekt (Umkehrung von checkinRepository.toRow).
  // Vollständig: illness + komplettes complaints-Array (kopiert, mehrere Beschwerden,
  // Typ/Score/Region/Notiz). Knie-Kompatibilität zusätzlich, ohne das Array zu ersetzen.
  function rowToMorning(row) {
    row = row || {};
    const complaints = Array.isArray(row.complaints)
      ? row.complaints.map(function (item) {
          return item && typeof item === 'object' ? Object.assign({}, item) : item;
        })
      : [];
    let knee = null;
    for (let i = 0; i < complaints.length; i++) {
      const c = complaints[i];
      if (c && c.type === 'knee' && c.score != null) { knee = c.score; break; }
    }
    const m = {
      sleepMin: row.sleep_minutes ?? null, sleepQ: row.sleep_quality ?? null,
      rhr: row.resting_hr ?? null, hrvMs: row.hrv_ms ?? null, hrv: row.hrv_status ?? null,
      bb: row.body_battery ?? null, stress: row.stress ?? null, feel: row.feel ?? null,
      legs: row.leg_strength ?? null, doms: row.doms ?? null,
      illness: row.illness ?? null, complaints: complaints
    };
    if (knee != null) m.knee = knee; // Array bleibt erhalten, knee ergänzt nur
    if (row.recorded_at) { const t = Date.parse(row.recorded_at); if (!isNaN(t)) m.ts = t; }
    return m;
  }

  // Jüngsten Zeitraum aus der Tabelle laden → DB[date].morning (Tabelle gewinnt je Tag mit Daten).
  // Tage OHNE Tabellenwert bleiben unverändert (Blob-Fallback). Schreibt KEINEN Blob zurück.
  async function hydrateRecent(days) {
    if (!O.repos || !O.repos.checkin) return res(false, null, { message: 'Checkin-Repository fehlt' }, 'empty', 'failed');
    if (typeof DB === 'undefined' || !DB) return res(false, null, { message: 'DB nicht verfügbar' }, 'empty', 'failed');
    const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10);
    const from = new Date(); from.setDate(from.getDate() - (days || 35));
    const fromStr = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    const r = await O.repos.checkin.listRange(fromStr, today);
    if (!r.success) return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');

    let applied = 0;
    (r.data || []).forEach(row => {
      if (row.checkin_type !== 'morning' || !isDay(row.local_date)) return;
      if (!DB[row.local_date]) DB[row.local_date] = { date: row.local_date };
      DB[row.local_date].morning = rowToMorning(row);   // Tabelle gewinnt
      applied++;
    });
    O.checkinMorningMigrated = true;
    try { if (typeof renderDay === 'function') renderDay(); } catch (e) {}
    return res(true, { applied: applied }, null, applied ? 'supabase' : 'empty', 'synced');
  }

  // Einen Morgen-Check-in eines Tages persistieren. Online → Repo, offline → user-scoped Queue.
  async function persistMorning(date) {
    if (!date) return res(false, null, { message: 'kein Datum' }, 'empty', 'failed');
    if (typeof DB === 'undefined' || !DB || !DB[date] || !DB[date].morning) {
      return res(true, { skipped: true }, null, 'empty', 'synced'); // nichts zu speichern
    }
    if (!O.repos || !O.repos.checkin) return res(false, null, { message: 'Checkin-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    const morning = DB[date].morning;

    if (O.repoBase && O.repoBase.online()) {
      if (!O.sb) return res(false, null, { message: 'Supabase-Client fehlt' }, 'empty', 'failed');
      const r = await O.repos.checkin.save(date, 'morning', morning); // Upsert user_id+local_date+checkin_type
      return res(r.success, r.data, r.error, r.source, r.sync_status);
    }

    // Offline → IndexedDB-Queue (user-scoped, Konflikt-Key = Unique-Constraint der Tabelle).
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    const row = Object.assign({ user_id: O.user.id }, O.repos.checkin.toRow(date, 'morning', morning));
    try {
      const q = await O.offlineQueue.enqueue('daily_checkins', row, 'user_id,local_date,checkin_type');
      if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed');
      return res(true, row, null, 'indexeddb', 'pending');
    } catch (error) {
      return res(false, null, { message: (error && error.message) || String(error) }, 'indexeddb', 'failed');
    }
  }

  O.checkinStore = { hydrateRecent, persistMorning, rowToMorning };
})();
