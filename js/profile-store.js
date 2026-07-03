/* ============================================================
   ORVIA · profile-store — Brücke UI ⇆ user_profiles (Phase-1-Umstellung)
   user_profiles ist die PRIMÄRE Quelle der Identitäts-/Körperfelder.
   Der app_state-Blob bleibt nur Mirror/Legacy-Fallback. Beim Login wird aus der
   Tabelle hydriert (Tabelle gewinnt). Verbindliches Ergebnisformat:
     { success, data, error, source, sync_status, offline? }
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;
  O.profileMigrated = false;

  // Von user_profiles bediente Felder. ALLES andere bleibt Legacy-Blob und wird nie angefasst.
  const MAPPED = ['name', 'birthDate', 'ageEstimate', 'age', 'sex', 'heightCm', 'weightKg',
    'hfMaxMeasured', 'restingHrMeasured', 'hfMax', 'rhrBaseline', 'sleepGoalH', 'timezone'];

  function res(success, data, error, source, sync_status) {
    return { success: success, data: data == null ? null : data, error: error || null,
             source: source, sync_status: sync_status };
  }

  // Zeitzonen: gespeicherte Nutzer-TZ ≠ erkannte Browser-TZ ≠ technischer Fallback.
  function detectedTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; }
    catch (e) { return 'Europe/Berlin'; }
  }
  function effectiveTimezone() {
    return (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.timezone) || detectedTimezone();
  }
  function effectiveSleepGoal() {
    const v = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE.sleepGoalH : null;
    return v != null ? v : 8; // neutraler Rechen-Fallback, wird NICHT persistiert
  }

  // Alter KANONISCH über onboardingProfileLogic.calculateAge (EIN Altersvertrag, Issue #6).
  // Hier verbleiben nur Adapter-Regeln für die Anzeige: ungültiges Datum → Schätzung,
  // Plausibilitäts-Klemme 0–119 (Anzeige-Schutz, KEINE Validierung).
  function computeAge(birthDate, ageEstimate) {
    const est = ageEstimate != null ? ageEstimate : null;
    if (!birthDate) return est;
    const PL = O.onboardingProfileLogic;
    if (!PL || typeof PL.calculateAge !== 'function') return est; // fail-safe: KEINE Duplikat-Mathematik
    // Zeitquelle: ORVIA.clock (P0, testbar); ohne Clock exakt Date.now().
    const now = new Date((O.clock && typeof O.clock.now === 'function') ? O.clock.now() : Date.now());
    const a = PL.calculateAge(String(birthDate).trim(), now);
    if (a == null) return est;              // ungültiges Datum → Schätzung (wie bisher)
    return (a >= 0 && a < 120) ? a : null;  // negativ / unrealistisch → ablehnen (wie bisher)
  }

  // DB-Zeile → PROFILE. null bleibt null (kein || ''). Tabelle gewinnt.
  function applyRow(row) {
    if (typeof PROFILE === 'undefined' || !PROFILE) { if (typeof ensureProfile === 'function') ensureProfile(); }
    if (!PROFILE) return;
    PROFILE.name = row.name ?? null;
    PROFILE.birthDate = row.birth_date ?? null;
    PROFILE.ageEstimate = row.age_estimate ?? null;
    PROFILE.sex = row.sex ?? null;
    PROFILE.heightCm = row.height_cm ?? null;
    PROFILE.weightKg = row.weight_kg ?? null;
    PROFILE.hfMaxMeasured = row.hf_max ?? null;
    PROFILE.restingHrMeasured = row.resting_hr ?? null;
    // Gemessene Werte NICHT durch berechnete ersetzen: hfMax/rhrBaseline spiegeln nur die Messung.
    PROFILE.hfMax = PROFILE.hfMaxMeasured;          // null → calc nutzt Tanaka, keine globale 190/201
    PROFILE.rhrBaseline = PROFILE.restingHrMeasured; // null → Ruhepuls fließt nicht in Score
    PROFILE.sleepGoalH = row.sleep_goal_h ?? null;   // null erlaubt; Fallback nur lokal
    PROFILE.timezone = row.timezone ?? null;         // DB-Wert gewinnt; null → Browser-TZ für Anzeige
    PROFILE.age = computeAge(PROFILE.birthDate, PROFILE.ageEstimate); // immer dynamisch
  }

  // Nur die gemappten Profilfelder neutralisieren; Legacy-Felder bleiben unangetastet.
  function neutralizeMapped() {
    if (typeof PROFILE === 'undefined' || !PROFILE) return;
    MAPPED.forEach(k => { PROFILE[k] = null; });
  }

  // Nach Login (nach Migration): Tabelle laden → PROFILE überschreiben.
  async function hydrate() {
    if (!O.repos || !O.repos.profile) return res(false, null, { message: 'Profil-Repository fehlt' }, 'empty', 'failed');
    const r = await O.repos.profile.get();
    if (r.success && r.data) {
      applyRow(r.data); O.profileMigrated = true; rerender();
      return res(true, r.data, null, 'supabase', 'synced');
    }
    if (r.success && !r.data) {
      // Kein Tabellen-Datensatz → NUR gemappte Felder leeren (Legacy bleibt), kontrolliert leer.
      neutralizeMapped(); O.profileMigrated = true; rerender();
      return res(true, null, null, 'empty', 'synced');
    }
    // Fehler/offline: NICHT still verschlucken; Blob bleibt Fallback, Felder nicht zerstören.
    return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');
  }

  // Mapped Felder persistieren. Online → Repo. Offline → user-scoped Queue. Harte Guards.
  async function persist() {
    if (typeof PROFILE === 'undefined' || !PROFILE) return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
    if (!O.repos || !O.repos.profile) return res(false, null, { message: 'Profil-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');

    const profilePayload = {
      name: PROFILE.name ?? null, birthDate: PROFILE.birthDate ?? null,
      ageEstimate: PROFILE.ageEstimate ?? null, sex: PROFILE.sex ?? null,
      heightCm: PROFILE.heightCm ?? null, weightKg: PROFILE.weightKg ?? null,
      hfMaxMeasured: PROFILE.hfMaxMeasured ?? null, restingHrMeasured: PROFILE.restingHrMeasured ?? null,
      sleepGoalH: PROFILE.sleepGoalH ?? null,            // kein Auto-8
      timezone: PROFILE.timezone ?? null                 // kein Auto-Berlin
    };

    if (O.repoBase && O.repoBase.online()) {
      if (!O.sb) return res(false, null, { message: 'Supabase-Client fehlt' }, 'empty', 'failed');
      const r = await O.repos.profile.save(profilePayload);     // Standardformat unverändert weiterreichen
      return res(r.success, r.data, r.error, r.source, r.sync_status);
    }

    // Offline → IndexedDB-Queue (bleibt dem aktuellen Nutzer zugeordnet).
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    const row = {
      user_id: O.user.id, name: profilePayload.name, birth_date: profilePayload.birthDate,
      age_estimate: profilePayload.birthDate ? null : profilePayload.ageEstimate, sex: profilePayload.sex,
      height_cm: profilePayload.heightCm, weight_kg: profilePayload.weightKg,
      hf_max: profilePayload.hfMaxMeasured, resting_hr: profilePayload.restingHrMeasured,
      sleep_goal_h: profilePayload.sleepGoalH, timezone: profilePayload.timezone
    };
    try {
      const q = await O.offlineQueue.enqueue('user_profiles', row, 'user_id');
      if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed');
      return res(true, row, null, 'indexeddb', 'pending');
    } catch (error) {
      return res(false, null, { message: (error && error.message) || String(error) }, 'indexeddb', 'failed');
    }
  }

  // Logout/Kontowechsel: gemappte Felder leeren + Flag zurücksetzen. Legacy unangetastet.
  function clear() {
    neutralizeMapped();
    O.profileMigrated = false;
  }

  function rerender() {
    try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch (e) {}
    try { if (typeof renderZones === 'function') renderZones(); } catch (e) {}
  }

  O.profileStore = {
    hydrate, persist, clear, computeAge, applyRow, neutralizeMapped,
    effectiveTimezone, detectedTimezone, effectiveSleepGoal, MAPPED
  };
})();
