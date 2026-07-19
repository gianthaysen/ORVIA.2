/* ============================================================
   ORVIA · checkin-store — Brücke UI ⇆ daily_checkins
   Phase-2 Teilblock 1: Morgen-Check-in (wired an saveMorning/autoMorning).
   Phase-2 Teilblock 2: generische Persistenz/Hydrierung für live/pre/post
   (Datenschicht bereit; eine Live-/Pre-/Post-UI existiert derzeit NICHT und wird
   in diesem Block bewusst nicht erfunden → kein UI-Wiring für live/pre/post).
   daily_checkins ist die PRIMÄRE Quelle; der app_state-Blob bleibt Mirror/Fallback.
   Verbindliches Ergebnisformat: { success, data, error, source, sync_status, offline? }.
   KEINE Ernährungsfelder (Protein/Hydration) — die gehören nicht in daily_checkins.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.checkinMorningMigrated = false;

  // Erlaubte Check-in-Typen (Whitelist). evening wird über den bestehenden Blob-Key 'eve'
  // gemappt, aber in diesem Block NICHT in daily_checkins persistiert (Ernährungsfelder).
  const VALID_TYPES = ['morning', 'live', 'pre', 'post', 'evening'];
  /* H3 (2026-07-11, E3 geschlossen): evening ist jetzt voll persistier-/hydrierbar.
     Ernährungsfelder (prot/carbs/hydL) bleiben BEWUSST Blob (künftiges Nutrition-Modul);
     Kernfelder (Stimmung→feel, Energie, Knie→complaints, Notiz) gehen in daily_checkins
     (energy/note-Spalten ab Migration 0015 — der Repo sendet sie nur, wenn belegt). */
  const BLOCK_TYPES = ['morning', 'live', 'pre', 'post', 'evening'];
  // Mapping checkin_type → DB[date]-Key.
  const TYPE_KEY = { morning: 'morning', live: 'live', pre: 'pre', post: 'post', evening: 'eve' };

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null,
             source: source, sync_status: sync_status };
  }
  function isDay(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }
  function isValidType(t) { return VALID_TYPES.indexOf(t) >= 0; }

  // daily_checkins-Zeile → Check-in-Objekt (Umkehrung von checkinRepository.toRow).
  // Vollständig: illness + komplettes complaints-Array (kopiert), Knie-Kompatibilität
  // zusätzlich (ersetzt das Array nicht). Keine Referenzteilung.
  function rowToCheckin(row) {
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
      /* P6-Vorbedingung (a): UI/Blob-Welt liest `m.ill` (Chips, _mvHasComplaintToday,
         Engine-Mapping) — beide Namen liefern, sonst ist Krankheit nach Hydration
         lokal "weg", obwohl sie in der Tabelle steht. */
      illness: row.illness ?? null, ill: row.illness ?? null, complaints: complaints
    };
    if (knee != null) m.knee = knee;
    /* Phase 6: Feld-Herkunft (auto_sources, Migration 0021) zurück in die Blob-Welt. */
    if (row.auto_sources && typeof row.auto_sources === 'object') m.autoSources = Object.assign({}, row.auto_sources);
    /* Batch 0: Red Flags (Migration 0024) zurück in die Blob-Welt — sonst wäre
       ein gemeldetes Warnzeichen nach Cross-Device-Hydration lokal „weg". */
    if (row.red_flags && typeof row.red_flags === 'object') m.redFlags = Object.assign({}, row.red_flags);
    if (row.recorded_at) { const t = Date.parse(row.recorded_at); if (!isNaN(t)) m.ts = t; }
    return m;
  }
  // Rückwärtskompatibler Alias (Teilblock 1 / bestehende Tests).
  function rowToMorning(row) { return rowToCheckin(row); }

  // Jüngsten Zeitraum aus der Tabelle laden → DB[date][typeKey] (Tabelle gewinnt je Typ/Tag).
  // Tage/Typen OHNE Tabellenwert bleiben unverändert (Blob-Fallback). Kein Rückschreiben in den Blob.
  async function hydrateRecentTypes(days, types) {
    if (!O.repos || !O.repos.checkin) return res(false, null, { message: 'Checkin-Repository fehlt' }, 'empty', 'failed');
    if (typeof DB === 'undefined' || !DB) return res(false, null, { message: 'DB nicht verfügbar' }, 'empty', 'failed');
    let want = Array.isArray(types) && types.length ? types : BLOCK_TYPES.slice();
    want = want.filter(isValidType);
    if (!want.length) return res(false, null, { message: 'keine gültigen Typen' }, 'empty', 'failed');

    const today = (typeof todayStr === 'function') ? todayStr() : new Date().toISOString().slice(0, 10);
    const from = new Date(); from.setDate(from.getDate() - (days || 35));
    const fromStr = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    const r = await O.repos.checkin.listRange(fromStr, today);
    if (!r.success) return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');

    let applied = 0;
    (r.data || []).forEach(row => {
      if (!isDay(row.local_date) || want.indexOf(row.checkin_type) < 0) return;
      const key = TYPE_KEY[row.checkin_type]; if (!key) return;
      if (!DB[row.local_date]) DB[row.local_date] = { date: row.local_date };
      // H3: evening hat ein EIGENES Blob-Format ({knee,mood,energy,note,ts}) — gezielt
      // rekonstruieren statt das Morgen-Format zu erzwingen. Ernährungsfelder des
      // bestehenden Blob-eve-Eintrags bleiben erhalten (Merge, Tabelle gewinnt je Feld).
      if (row.checkin_type === 'evening') {
        const prev = DB[row.local_date][key] || {};
        const c = rowToCheckin(row);
        DB[row.local_date][key] = Object.assign({}, prev, {
          knee: c.knee != null ? c.knee : (prev.knee || 0),
          mood: c.feel != null ? c.feel : prev.mood,
          energy: row.energy != null ? row.energy : prev.energy,
          note: row.note != null ? row.note : (prev.note || ''),
          ts: row.recorded_at ? Date.parse(row.recorded_at) : prev.ts
        });
      } else {
        /* P6-Vorbedingung (b) (2026-07-17, Audit-Befund 2): Merge statt Vollersatz.
           Die Tabelle gewinnt weiterhin für JEDES von ihr abgebildete Feld (auch mit
           null), aber Blob-only-Morgenfelder ohne Tabellenspalte (weight, ankle,
           domsRegion) überleben die Hydration — vorher gingen Gewichtstrend-/
           Nutrition-Daten bei jedem Login verloren. */
        DB[row.local_date][key] = Object.assign({}, DB[row.local_date][key] || {}, rowToCheckin(row));
      }
      applied++;
    });
    O.checkinMorningMigrated = true;
    try { if (typeof renderDay === 'function') renderDay(); } catch (e) {}
    return res(true, { applied: applied }, null, applied ? 'supabase' : 'empty', 'synced');
  }
  // Rückwärtskompatibel: nur Morgen (Teilblock 1 / bestehende Tests).
  async function hydrateRecent(days) { return hydrateRecentTypes(days, ['morning']); }

  // Einen Check-in eines Typs persistieren. Online → Repo-Upsert, offline → user-scoped Queue.
  // Konflikt-Key user_id+local_date+checkin_type → genau EIN Eintrag je Typ/Tag (letzter gewinnt).
  async function persistCheckin(date, type, payload) {
    if (!isValidType(type)) return res(false, null, { code: 'invalid_type', message: 'Ungültiger checkin_type: ' + type }, 'empty', 'failed');
    if (!date) return res(false, null, { message: 'kein Datum' }, 'empty', 'failed');
    if (!payload || typeof payload !== 'object' || !Object.keys(payload).length) {
      return res(true, { skipped: true }, null, 'empty', 'synced'); // nichts zu speichern
    }
    if (!O.repos || !O.repos.checkin) return res(false, null, { message: 'Checkin-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');

    let out;
    if (O.repoBase && O.repoBase.online()) {
      if (!O.sb) return res(false, null, { message: 'Supabase-Client fehlt' }, 'empty', 'failed');
      const r = await O.repos.checkin.save(date, type, payload); // Upsert user_id+local_date+checkin_type
      out = res(r.success, r.data, r.error, r.source, r.sync_status);
    } else {
      if (!O.offlineQueue) out = res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
      else {
        // user_id wird hier UND in enqueue aus der Auth-Session erzwungen (keine UI-user_id).
        const row = Object.assign({ user_id: O.user.id }, O.repos.checkin.toRow(date, type, payload));
        try {
          const q = await O.offlineQueue.enqueue('daily_checkins', row, 'user_id,local_date,checkin_type');
          out = (q && q.success === false)
            ? res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed')
            : res(true, row, null, 'indexeddb', 'pending');
        } catch (error) {
          out = res(false, null, { message: (error && error.message) || String(error) }, 'indexeddb', 'failed');
        }
      }
    }
    // Tagesentscheidung nach einer Änderung von HEUTE neu berechnen lassen (Cache leeren).
    try {
      const today = (typeof todayStr === 'function') ? todayStr() : null;
      if (out.success && date === today && typeof invalidateDecision === 'function') invalidateDecision();
    } catch (e) {}
    return out;
  }

  // Rückwärtskompatibler Morgen-Wrapper (Teilblock 1: saveMorning/autoMorning).
  async function persistMorning(date) {
    if (typeof DB === 'undefined' || !DB || !DB[date] || !DB[date].morning) {
      return res(true, { skipped: true }, null, 'empty', 'synced');
    }
    return persistCheckin(date, 'morning', DB[date].morning);
  }

  O.checkinStore = {
    persistCheckin, hydrateRecentTypes, rowToCheckin,
    persistMorning, hydrateRecent, rowToMorning,
    VALID_TYPES, BLOCK_TYPES, TYPE_KEY
  };
})();
