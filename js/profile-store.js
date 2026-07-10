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

  /* ============================================================
     2B-① · sports-Vollzyklus — user_sports ist SSoT (Persistenz-ADR, E1–E7).
     Konfliktregel K1: Sektions-LWW über _sectionMeta.sports.updatedAt
     (section_updated_at je Zeile); Tie → Cloud gewinnt (konservativ);
     24h-Clock-Clamp beim Lesen. K2: lokale Daten OHNE Meta überschreiben
     nie vorhandene Cloud-Daten; bei leerer Cloud additive Erstmigration.
     Ebene-B-Details (sportProfile, preferredDays) bleiben bewusst Blob und
     werden beim Apply je Sport lokal ERHALTEN (kein Verlust).
     ============================================================ */
  const ROLE_TO_DB = { primary: 'main', secondary: 'supplemental', supplemental: 'supplemental', occasional: 'occasional' };
  const DB_TO_ROLE = { main: 'primary', supplemental: 'secondary', occasional: 'occasional', club: 'secondary' };
  const CLIENT_ROLES = ['primary', 'secondary', 'supplemental', 'occasional'];
  let _applyingSports = false;   // verhindert Event-Hook-Schleife beim Cloud-Apply

  function _nowMs() { return (O.clock && typeof O.clock.now === 'function') ? O.clock.now() : Date.now(); }
  // K1: Zeitstempel > jetzt+24 h gelten als Uhrfehler und werden auf „jetzt" geklemmt.
  function _clampTs(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!isFinite(t)) return null;
    const max = _nowMs() + 24 * 3600e3;
    return t > max ? new Date(_nowMs()).toISOString() : iso;
  }
  function _sportsSectionTs() {
    try { return (PROFILE._sectionMeta && PROFILE._sectionMeta.sports && PROFILE._sectionMeta.sports.updatedAt) || null; } catch (e) { return null; }
  }
  function _touchSportsMeta(source, iso) {
    try {
      const M = O.profileModel;
      if (M && typeof M.ensureSectionMeta === 'function') M.ensureSectionMeta(PROFILE);
      PROFILE._sectionMeta = PROFILE._sectionMeta || {};
      PROFILE._sectionMeta.sports = Object.assign({}, PROFILE._sectionMeta.sports, { updatedAt: iso, source: source || 'system' });
    } catch (e) {}
  }
  function sportsToRows(sectionTs) {
    const M = O.profileModel;
    const list = M ? M.normalizeSports(PROFILE.sports) : (Array.isArray(PROFILE.sports) ? PROFILE.sports : []);
    return list.map((s, i) => ({
      user_id: O.user && O.user.id,
      sport: s.sportId,
      sport_key: (O.trainingDomain && typeof O.trainingDomain.normSport === 'function') ? (O.trainingDomain.normSport(s.sportId) || null) : s.sportId,
      role: ROLE_TO_DB[s.role] || 'supplemental',
      client_role: s.role || null,
      custom_name: s.customName || null,
      level: s.level || null,
      sessions_per_week: s.sessionsPerWeek != null ? s.sessionsPerWeek : null,
      typical_duration_min: s.typicalDuration != null ? s.typicalDuration : null,
      season_phase: s.seasonPhase || null,
      orvia_plans: s.includeInPlan !== false,
      active: s.activeInApp !== false,
      priority: i + 1,
      section_updated_at: sectionTs || null
    }));
  }
  function rowsToSports(rows) {
    const sorted = (rows || []).slice().sort((a, b) => (a.priority || 99) - (b.priority || 99));
    const list = sorted.map(r => ({
      sportId: r.sport,
      customName: r.custom_name || null,
      role: (r.client_role && CLIENT_ROLES.indexOf(r.client_role) >= 0) ? r.client_role : (DB_TO_ROLE[r.role] || 'secondary'),
      activeInApp: r.active !== false,
      includeInPlan: r.orvia_plans !== false,
      level: r.level || null,
      sessionsPerWeek: r.sessions_per_week != null ? r.sessions_per_week : null,
      typicalDuration: r.typical_duration_min != null ? r.typical_duration_min : null,
      seasonPhase: r.season_phase || null
    }));
    const M = O.profileModel;
    return M ? M.normalizeSports(list) : list;
  }
  // Cloud-Zeilen anwenden: B-Level-Details je Sport lokal erhalten; Meta = CLOUD-Zeitstempel
  // (NICHT _profileSave — das würde updatedAt=jetzt setzen und den LWW verfälschen).
  function _applySportsRows(rows, cloudTs) {
    const incoming = rowsToSports(rows);
    const prev = {};
    (Array.isArray(PROFILE.sports) ? PROFILE.sports : []).forEach(s => { if (s && s.sportId) prev[s.sportId] = s; });
    incoming.forEach(s => {
      const p = prev[s.sportId];
      if (p && typeof p === 'object') {
        if (p.sportProfile && !s.sportProfile) s.sportProfile = p.sportProfile;
        if (Array.isArray(p.preferredDays) && p.preferredDays.length) s.preferredDays = p.preferredDays.slice();
      }
    });
    _applyingSports = true;
    try {
      PROFILE.sports = incoming;
      _touchSportsMeta('system', cloudTs || null);
      if (typeof saveProfile === 'function') saveProfile();   // Blob-Cache aktualisieren (A0-Pfad)
      try { if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:profile-updated', { detail: { changedSections: ['sports'], updatedAt: cloudTs || null } })); } catch (e) {}
    } finally { _applyingSports = false; }
    rerender();
  }
  // Write-Pfad: online Set-Sync (Upserts + Deletes), offline Queue-Upserts
  // (Offline-DELETE = dokumentierte Grenze; Voll-Push beim nächsten Login-LWW bereinigt).
  async function persistSports(opts) {
    opts = opts || {};
    if (typeof PROFILE === 'undefined' || !PROFILE) return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
    if (!O.repos || !O.repos.sport || typeof O.repos.sport.replaceUserSports !== 'function') return res(false, null, { message: 'Sport-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    let sectionTs = opts.sectionTs || _sportsSectionTs();
    if (!sectionTs) {
      // Erstmigration meta-loser Altdaten: der Push selbst ist das Ereignis (Quelle 'migration').
      sectionTs = new Date(_nowMs()).toISOString();
      _touchSportsMeta('migration', sectionTs);
      if (typeof saveProfile === 'function') saveProfile();
    }
    const rows = sportsToRows(sectionTs);
    if (O.repoBase && O.repoBase.online()) {
      const r = await O.repos.sport.replaceUserSports(rows);
      return res(r.success, r.data, r.error, r.source, r.sync_status);
    }
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    try {
      for (const row of rows) {
        const q = await O.offlineQueue.enqueue('user_sports', row, 'user_id,sport');
        if (q && q.success === false) return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed');
      }
      return res(true, rows, null, 'indexeddb', 'pending');
    } catch (error) {
      return res(false, null, { message: (error && error.message) || String(error) }, 'indexeddb', 'failed');
    }
  }
  // Hydration beim Login: K1/K2-Entscheid zwischen Cloud-Zeilen und lokalem Blob-Stand.
  async function hydrateSports() {
    if (typeof PROFILE === 'undefined') return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
    if (!PROFILE && typeof ensureProfile === 'function') ensureProfile();
    if (!PROFILE) return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
    if (!O.repos || !O.repos.sport) return res(false, null, { message: 'Sport-Repository fehlt' }, 'empty', 'failed');
    if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
    const r = await O.repos.sport.listUserSports();
    if (!r.success) return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');
    const cloudRows = r.data || [];
    const localList = Array.isArray(PROFILE.sports) ? PROFILE.sports : [];
    const localTs = _clampTs(_sportsSectionTs());
    let cloudTs = null;
    cloudRows.forEach(row => { const t = _clampTs(row.section_updated_at); if (t && (!cloudTs || Date.parse(t) > Date.parse(cloudTs))) cloudTs = t; });
    // Fall A: beidseitig leer → nichts zu tun.
    if (!cloudRows.length && !localList.length) return res(true, null, null, 'empty', 'synced');
    // Fall B: Cloud leer, lokal vorhanden → additive Erstmigration (K2 erlaubt Upload in leere Cloud).
    if (!cloudRows.length && localList.length) return persistSports({ sectionTs: localTs || null });
    // Fall C: Cloud vorhanden, lokal leer ODER meta-los → Cloud gewinnt (K2: unbekannt überschreibt nie).
    if (cloudRows.length && (!localList.length || !localTs)) { _applySportsRows(cloudRows, cloudTs); return res(true, cloudRows, null, 'supabase', 'synced'); }
    // Fall D: beidseitig vorhanden → Sektions-LWW (K1); Tie → Cloud (konservativ).
    if (cloudTs && Date.parse(localTs) > Date.parse(cloudTs)) return persistSports({ sectionTs: localTs });
    _applySportsRows(cloudRows, cloudTs || localTs);
    return res(true, cloudRows, null, 'supabase', 'synced');
  }
  // Editor-Saves (offizieller Schreibpfad updateSection→_profileSave) automatisch cloud-persistieren.
  try {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('orvia:profile-updated', function (ev) {
        try {
          if (_applyingSports) return;
          const cs = (ev && ev.detail && ev.detail.changedSections) || [];
          if (cs.indexOf('sports') < 0) return;
          if (!O.user || !O.user.id) return;   // vor Login bleibt der Blob alleinige Quelle
          persistSports();                      // fire-and-forget; Fehlerformat wird intern gekapselt
        } catch (e) {}
      });
    }
  } catch (e) {}

  // Logout/Kontowechsel: gemappte Felder leeren + Flag zurücksetzen. Legacy unangetastet.
  function clear() {
    neutralizeMapped();
    // 2B-①: sports gehören jetzt zum cloud-gemappten Bestand → beim Kontowechsel leeren (kein Leak).
    try {
      PROFILE.sports = [];
      if (PROFILE._sectionMeta && PROFILE._sectionMeta.sports) PROFILE._sectionMeta.sports.updatedAt = null;
    } catch (e) {}
    O.profileMigrated = false;
  }

  function rerender() {
    try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch (e) {}
    try { if (typeof renderZones === 'function') renderZones(); } catch (e) {}
  }

  O.profileStore = {
    hydrate, persist, clear, computeAge, applyRow, neutralizeMapped,
    effectiveTimezone, detectedTimezone, effectiveSleepGoal, MAPPED,
    // 2B-①: sports-Vollzyklus (user_sports als SSoT)
    persistSports, hydrateSports, sportsToRows, rowsToSports
  };
})();
