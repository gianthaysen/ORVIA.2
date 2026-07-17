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
    'hfMaxMeasured', 'restingHrMeasured', 'hfMax', 'rhrBaseline', 'sleepGoalH', 'timezone',
    'constraintsAcknowledgedAt',
    'location', 'avatarPath',    // 0016: Ort + Avatar-Pfad — vorher OHNE Sync-Kanal (Geräte-Divergenz)
    'recovery', 'preferences'];  // 0018: Regeneration & Alltag + Trainingspräferenzen (vorher Blob-only)

  /* 0016 · Nutzergebundener Athletenprofil-Cache (reiner OFFLINE-Fallback der Anzeige).
     Server hat online IMMER Vorrang; der Cache wird bei jedem erfolgreichen Hydrate/Persist
     mit dem Serverstand überschrieben und ist strikt an die user_id gebunden. */
  function athleteCacheKey() { return O.user && O.user.id ? 'orvia:' + O.user.id + ':athleteProfile' : null; }
  function writeAthleteCache(row) {
    try { const k = athleteCacheKey(); if (k && row) localStorage.setItem(k, JSON.stringify({ row: row, cachedAt: new Date(_nowMs()).toISOString() })); } catch (e) {}
  }
  function readAthleteCache() {
    try { const k = athleteCacheKey(); if (!k) return null; const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  /* 0016 · Ehrlicher Sync-Status: „Synchronisiert" nur, wenn die Mutation serverseitig
     bestätigt wurde UND keine Queue-Pendings des aktuellen Nutzers existieren.
     pending/failed übersteuern den Badge — ein grüner Auth-Status allein reicht nicht. */
  async function _reportSync(r) {
    try {
      if (!window.orviaSetSyncState) return;
      if (!r || r.success === false) { window.orviaSetSyncState('error'); return; }
      if (r.sync_status === 'pending') { window.orviaSetSyncState('pending', 'Ausstehende Änderungen'); return; }
      let pend = 0;
      try { if (O.offlineQueue && O.offlineQueue.pendingForCurrentUser) pend = (await O.offlineQueue.pendingForCurrentUser()).length; } catch (e) {}
      if (pend > 0) window.orviaSetSyncState('pending', 'Ausstehende Änderungen'); else window.orviaSetSyncState('synced');
    } catch (e) {}
  }

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
    PROFILE.constraintsAcknowledgedAt = row.constraints_acknowledged_at ?? null;   // P9 (Spalte ab 0013; vorher undefined→null)
    PROFILE.location = row.location ?? null;        // 0016: Server-SoT für Ort (vorher nur Geräte-Blob)
    PROFILE.avatarPath = row.avatar_path ?? null;   // 0016: Storage-Pfad; Anzeige via avatarStore
    /* 0018: strukturierte Sektionen — Server gewinnt; fehlende Zeile/Spalte → lokaler Stand
       bleibt (kein ?? null: sonst würde eine Instanz ohne 0018 lokale Eingaben löschen). */
    if (row.recovery !== undefined && row.recovery !== null) PROFILE.recovery = row.recovery;
    if (row.preferences !== undefined && row.preferences !== null) PROFILE.preferences = row.preferences;
    PROFILE.age = computeAge(PROFILE.birthDate, PROFILE.ageEstimate); // immer dynamisch
    writeAthleteCache(row);                          // 0016: Serverstand überschreibt Offline-Cache
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
    // 0016: Offline-Fallback — zuletzt bestätigter SERVER-Stand aus dem nutzergebundenen
    // Cache anzeigen (kein Push, reine Anzeige; Online-Hydrate überschreibt wieder).
    if (r.offline) {
      const c = readAthleteCache();
      if (c && c.row) { applyRow(c.row); rerender(); return res(true, c.row, null, 'indexeddb', 'pending'); }
    }
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
      timezone: PROFILE.timezone ?? null,                // kein Auto-Berlin
      constraintsAcknowledgedAt: PROFILE.constraintsAcknowledgedAt ?? null,   // P9
      location: PROFILE.location ?? null,                // 0016
      avatarPath: PROFILE.avatarPath ?? null,            // 0016
      recovery: PROFILE.recovery ?? null,                // 0018
      preferences: PROFILE.preferences ?? null           // 0018
    };

    if (O.repoBase && O.repoBase.online()) {
      if (!O.sb) return res(false, null, { message: 'Supabase-Client fehlt' }, 'empty', 'failed');
      const r = await O.repos.profile.save(profilePayload);     // Standardformat unverändert weiterreichen
      if (r.success && r.data) writeAthleteCache(r.data);       // 0016: bestätigter Serverstand → Cache
      _reportSync(r);                                           // 0016: ehrlicher Badge (kein Schein-Sync)
      return res(r.success, r.data, r.error, r.source, r.sync_status);
    }

    // Offline → IndexedDB-Queue (bleibt dem aktuellen Nutzer zugeordnet).
    if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
    const row = {
      user_id: O.user.id, name: profilePayload.name, birth_date: profilePayload.birthDate,
      age_estimate: profilePayload.birthDate ? null : profilePayload.ageEstimate, sex: profilePayload.sex,
      height_cm: profilePayload.heightCm, weight_kg: profilePayload.weightKg,
      hf_max: profilePayload.hfMaxMeasured, resting_hr: profilePayload.restingHrMeasured,
      sleep_goal_h: profilePayload.sleepGoalH, timezone: profilePayload.timezone,
      location: profilePayload.location, avatar_path: profilePayload.avatarPath   // 0016
    };
    if (profilePayload.constraintsAcknowledgedAt != null) row.constraints_acknowledged_at = profilePayload.constraintsAcknowledgedAt;   // P9 (0013)
    try {
      const q = await O.offlineQueue.enqueue('user_profiles', row, 'user_id');
      if (q && q.success === false) { _reportSync({ success: false }); return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed'); }
      _reportSync({ success: true, sync_status: 'pending' });   // 0016: ehrlich „ausstehend", nicht „synchronisiert"
      return res(true, row, null, 'indexeddb', 'pending');
    } catch (error) {
      _reportSync({ success: false });
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
          if (_applyingSports || _applyingCloud) return;
          const cs = (ev && ev.detail && ev.detail.changedSections) || [];
          if (!O.user || !O.user.id) return;   // vor Login bleibt der Blob alleinige Quelle
          // fire-and-forget; Fehlerformate werden intern gekapselt
          if (cs.indexOf('sports') >= 0) persistSports();
          if (cs.indexOf('availability') >= 0) persistAvailability();       // P9
          if (cs.indexOf('goals') >= 0) persistGoals();                     // P9
          if (cs.indexOf('constraints') >= 0) { persistConstraintsCloud(); persist(); }   // P9 (Liste + Acknowledge-Feld)
          if (cs.indexOf('personal') >= 0 || cs.indexOf('body') >= 0) persist();          // P9: MAPPED-Autopush
          if (cs.indexOf('recovery') >= 0 || cs.indexOf('preferences') >= 0) persist();   // 0018: strukturierte Sektionen
        } catch (e) {}
      });
    }
  } catch (e) {}

  /* ============================================================
     P9 · Generische Sektions-Zyklen (nach dem bewährten 2B-①-Muster; sports
     selbst bleibt unangetastet). Regeln:
     - K1: Sektions-LWW (_sectionMeta[section].updatedAt vs. max section_updated_at,
       24h-Clamp, Tie → Cloud).
     - K2: lokale META-LOSE Daten überschreiben vorhandene gestempelte Cloud nie.
     - K3 (NEU, P9): STEMPELLOSE Cloud-Zeilen sind Legacy-Seeds (z. B. alte
       Einmal-Migration in user_goals) — sie verlieren gegen nicht-leere lokale
       Daten; der Voll-Push ersetzt den Seed. Ohne diese Regel würden reiche
       lokale Ziele durch magere Alt-Projektionen ÜBERSCHRIEBEN (Datenverlust).
     - Offline: Queue-Upserts je Zeile; Offline-DELETE = dokumentierte Grenze
       (Voll-Push beim nächsten Login-LWW bereinigt).
     ============================================================ */
  function _metaTs(section) {
    try { return (PROFILE._sectionMeta && PROFILE._sectionMeta[section] && PROFILE._sectionMeta[section].updatedAt) || null; } catch (e) { return null; }
  }
  function _touchMeta(section, source, iso) {
    try {
      var M = O.profileModel;
      if (M && typeof M.ensureSectionMeta === 'function') M.ensureSectionMeta(PROFILE);
      PROFILE._sectionMeta = PROFILE._sectionMeta || {};
      PROFILE._sectionMeta[section] = Object.assign({}, PROFILE._sectionMeta[section], { updatedAt: iso, source: source || 'system' });
    } catch (e) {}
  }
  var _applyingCloud = false;
  function _applyCycle(cfg, rows, cloudTs) {
    _applyingCloud = true;
    try {
      cfg.applyRows(rows);
      _touchMeta(cfg.section, 'system', cloudTs || null);
      if (typeof saveProfile === 'function') saveProfile();
      try { if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('orvia:profile-updated', { detail: { changedSections: [cfg.section], updatedAt: cloudTs || null } })); } catch (e) {}
    } finally { _applyingCloud = false; }
    rerender();
  }
  function _makeSectionCycle(cfg) {
    async function persistX(opts) {
      opts = opts || {};
      if (typeof PROFILE === 'undefined' || !PROFILE) return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
      if (!cfg.repoReady()) return res(false, null, { message: cfg.section + '-Repository fehlt' }, 'empty', 'failed');
      if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
      var ts = opts.sectionTs || _metaTs(cfg.section);
      if (!ts) { ts = new Date(_nowMs()).toISOString(); _touchMeta(cfg.section, 'migration', ts); if (typeof saveProfile === 'function') saveProfile(); }
      var rows = cfg.toRows(ts);
      if (O.repoBase && O.repoBase.online()) {
        var r = await cfg.repoReplace(rows);
        _reportSync(r);   // 0016: Badge spiegelt bestätigte/fehlgeschlagene Sektions-Mutationen
        return res(r.success, r.data, r.error, r.source, r.sync_status);
      }
      if (!O.offlineQueue) return res(false, null, { message: 'Offline-Queue nicht verfügbar' }, 'indexeddb', 'failed');
      try {
        for (const row of rows) {
          const q = await O.offlineQueue.enqueue(cfg.table, row, cfg.onConflict);
          if (q && q.success === false) { _reportSync({ success: false }); return res(false, null, q.error || { message: 'Queue-Schreiben fehlgeschlagen' }, 'indexeddb', 'failed'); }
        }
        _reportSync({ success: true, sync_status: 'pending' });
        return res(true, rows, null, 'indexeddb', 'pending');
      } catch (e) { _reportSync({ success: false }); return res(false, null, { message: String(e && e.message || e) }, 'indexeddb', 'failed'); }
    }
    async function hydrateX() {
      if (typeof PROFILE === 'undefined') return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
      if (!PROFILE && typeof ensureProfile === 'function') ensureProfile();
      if (!PROFILE) return res(false, null, { message: 'kein PROFILE' }, 'empty', 'failed');
      if (!cfg.repoReady()) return res(false, null, { message: cfg.section + '-Repository fehlt' }, 'empty', 'failed');
      if (!O.user || !O.user.id) return res(false, null, { message: 'keine Sitzung' }, 'empty', 'failed');
      var r = await cfg.repoList();
      if (!r.success) return res(false, null, r.error, r.offline ? 'indexeddb' : 'supabase', r.offline ? 'pending' : 'failed');
      var rows = r.data || [];
      var localEmpty = cfg.localEmpty();
      var localTs = _clampTs(_metaTs(cfg.section));
      var cloudTs = null;
      rows.forEach(function (row) { var t = _clampTs(row.section_updated_at); if (t && (!cloudTs || Date.parse(t) > Date.parse(cloudTs))) cloudTs = t; });
      if (!rows.length && localEmpty) return res(true, null, null, 'empty', 'synced');
      if (!rows.length && !localEmpty) return persistX({ sectionTs: localTs || null });          // Erstmigration
      if (rows.length && !cloudTs && !localEmpty) return persistX({ sectionTs: localTs || null }); // K3: Legacy-Seed ersetzen
      if (rows.length && (localEmpty || !localTs)) { _applyCycle(cfg, rows, cloudTs); return res(true, rows, null, 'supabase', 'synced'); } // K2
      if (cloudTs && Date.parse(localTs) > Date.parse(cloudTs)) return persistX({ sectionTs: localTs });
      _applyCycle(cfg, rows, cloudTs || localTs);
      return res(true, rows, null, 'supabase', 'synced');
    }
    return { persist: persistX, hydrate: hydrateX };
  }

  /* ---------- P9 · availability ↔ weekly_availability (Kern je Wochentag;
     Slots-Details/fixedCommitments/preferredSports bleiben Ebene B und werden
     beim Apply je Tag lokal ERHALTEN; Wochenlimits redundant je Zeile). ---------- */
  var _WD = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var _availabilityCycle = _makeSectionCycle({
    section: 'availability', table: 'weekly_availability', onConflict: 'user_id,weekday',
    repoReady: function () { return !!(O.repos && O.repos.availability && O.repos.availability.replaceWeek); },
    repoList: function () { return O.repos.availability.list(); },
    repoReplace: function (rows) { return O.repos.availability.replaceWeek(rows); },
    localEmpty: function () { try { return !(PROFILE.availability && PROFILE.availability.days && Object.keys(PROFILE.availability.days).length); } catch (e) { return true; } },
    toRows: function (ts) {
      var M = O.profileModel; var av = M.normalizeAvailability(PROFILE.availability);
      return _WD.map(function (d, i) {
        var w = av.days[d];
        return {
          user_id: O.user && O.user.id, weekday: i,
          available: !!w.available, rest_day: !!w.restDay,
          max_minutes: w.singleSession.maxMinutes != null ? w.singleSession.maxMinutes : null,
          preferred_time: w.singleSession.preferredTime || null,
          double_allowed: !!w.doubleSession.enabled,
          max_sessions_week: av.maxSessionsPerWeek != null ? av.maxSessionsPerWeek : null,
          max_intense_week: av.maxIntenseSessions != null ? av.maxIntenseSessions : null,
          min_rest_days: av.minimumFullRestDays != null ? av.minimumFullRestDays : null,
          section_updated_at: ts || null
        };
      });
    },
    applyRows: function (rows) {
      var M = O.profileModel; var prev = M.normalizeAvailability(PROFILE.availability);
      var days = {}; _WD.forEach(function (d) { days[d] = prev.days[d]; });
      var first = null;
      rows.forEach(function (r) {
        var key = _WD[r.weekday]; if (!key) return;
        if (!first) first = r;
        var p = prev.days[key];
        var day = Object.assign({}, p, { available: r.available !== false && !r.rest_day, restDay: !!r.rest_day });
        day.singleSession = Object.assign({}, p.singleSession, { maxMinutes: r.max_minutes != null ? r.max_minutes : null, preferredTime: r.preferred_time || '' });
        day.doubleSession = Object.assign({}, p.doubleSession, { enabled: !!r.double_allowed });
        days[key] = day;
      });
      PROFILE.availability = M.normalizeAvailability({
        days: days,
        maxSessionsPerWeek: first && first.max_sessions_week != null ? first.max_sessions_week : prev.maxSessionsPerWeek,
        maxIntenseSessions: first && first.max_intense_week != null ? first.max_intense_week : prev.maxIntenseSessions,
        minimumFullRestDays: first && first.min_rest_days != null ? first.min_rest_days : prev.minimumFullRestDays,
        preferredRestDays: prev.preferredRestDays
      });
    }
  });

  /* ---------- P9 · goals ↔ user_goals (Kernfelder; categoryData/milestones/
     sports/motivation/timeHorizon bleiben Ebene B — beim Apply je Ziel-ID erhalten). ---------- */
  var _DB_PRIO = { primary: 1, secondary: 2, maintain: 3, longterm: 4, optional: 3 };
  var _goalsCycle = _makeSectionCycle({
    section: 'goals', table: 'user_goals', onConflict: 'user_id,client_goal_id',
    repoReady: function () { return !!(O.repos && O.repos.goal && O.repos.goal.replaceUserGoals); },
    repoList: function () { return O.repos.goal.list(); },
    repoReplace: function (rows) { return O.repos.goal.replaceUserGoals(rows); },
    localEmpty: function () { try { return !(Array.isArray(PROFILE.goals) && PROFILE.goals.length); } catch (e) { return true; } },
    toRows: function (ts) {
      var M = O.profileModel; var R = O.repos.goal;
      return M.normalizeGoals(PROFILE.goals).map(function (g) {
        var row = R.goalToRowFull(g);
        row.user_id = O.user && O.user.id;
        row.section_updated_at = ts || null;
        if (g.description) row.description = g.description;   // 0012-Spalte nur wenn belegt
        return row;
      });
    },
    applyRows: function (rows) {
      var M = O.profileModel;
      var prevById = {}; (Array.isArray(PROFILE.goals) ? PROFILE.goals : []).forEach(function (g) { if (g && g.id) prevById[g.id] = g; });
      var incoming = rows.map(function (r) {
        var prev = prevById[r.client_goal_id] || {};
        return Object.assign({}, prev, {
          id: r.client_goal_id || prev.id,
          category: r.goal_type || prev.category,
          title: r.title != null ? r.title : prev.title,
          targetValue: r.target_value != null ? Number(r.target_value) : null,
          currentValue: r.current_value != null ? Number(r.current_value) : (prev.currentValue != null ? prev.currentValue : null),
          unit: r.target_unit || prev.unit || null,
          metricType: r.metric_type || prev.metricType || null,
          targetDate: r.target_date || null,
          priority: _DB_PRIO[r.priority] || prev.priority || 2,
          status: r.status === 'completed' ? 'achieved' : (r.status || prev.status || 'active'),
          description: r.description != null ? r.description : (prev.description || '')
        });
      });
      PROFILE.goals = M.normalizeGoals(incoming);
      /* 0016 · Duplikat-Bereinigung: normalizeGoals dedupliziert jetzt auch SEMANTISCH
         (Kategorie+Titel+Zielwert+Datum) — Cross-Device-Seeds mit verschiedenen IDs
         kollabieren zu einem Ziel. Wurden Cloud-Zeilen wegkollabiert, den bereinigten
         Stand zurückschreiben (Set-Sync löscht die überzählige user_goals-Zeile). */
      _goalsDedupePush = PROFILE.goals.length < incoming.length;
    }
  });
  var _goalsDedupePush = false;
  async function hydrateGoalsWithCleanup() {
    _goalsDedupePush = false;
    var r = await _goalsCycle.hydrate();
    if (_goalsDedupePush) {
      _goalsDedupePush = false;
      try { console.warn('[ORVIA profile-store] Ziel-Duplikat(e) dedupliziert — Cloud wird bereinigt.'); } catch (e) {}
      try { await _goalsCycle.persist(); } catch (e) {}
    }
    return r;
  }

  /* ---------- P9 · constraints ↔ user_constraints (vollständige Zeilen; das
     Acknowledge-Datum läuft als MAPPED-Feld über user_profiles). ---------- */
  var _constraintsCycle = _makeSectionCycle({
    section: 'constraints', table: 'user_constraints', onConflict: 'user_id,client_id',
    repoReady: function () { return !!(O.repos && O.repos.constraint && O.repos.constraint.replaceAll); },
    repoList: function () { return O.repos.constraint.list(); },
    repoReplace: function (rows) { return O.repos.constraint.replaceAll(rows); },
    localEmpty: function () { try { return !(Array.isArray(PROFILE.constraintsList) && PROFILE.constraintsList.length); } catch (e) { return true; } },
    toRows: function (ts) {
      return (Array.isArray(PROFILE.constraintsList) ? PROFILE.constraintsList : []).map(function (c) {
        return {
          user_id: O.user && O.user.id, client_id: c.id,
          body_region: c.bodyRegion || null, side: c.side || null, title: c.title || null,
          intensity: c.intensity != null ? c.intensity : null, status: c.status || 'active',
          currently_trainable: c.currentlyTrainable !== false,
          started_at: c.startedAt || null, notes: c.notes || null, triggers: c.triggers || null,
          avoid_movements: c.avoidMovements || null,
          affected: Array.isArray(c.affectedActivities) ? c.affectedActivities : [],
          section_updated_at: ts || null
        };
      });
    },
    applyRows: function (rows) {
      var M = O.profileModel;
      PROFILE.constraintsList = rows.map(function (r) {
        return M.normalizeConstraint({
          id: r.client_id, bodyRegion: r.body_region, side: r.side, title: r.title,
          intensity: r.intensity, status: r.status, currentlyTrainable: r.currently_trainable !== false,
          startedAt: r.started_at || '', notes: r.notes || '', triggers: r.triggers || '',
          avoidMovements: r.avoid_movements || '', affectedActivities: Array.isArray(r.affected) ? r.affected : []
        });
      });
      try { PROFILE.issues = M.constraintIssueKeys(PROFILE); } catch (e) {}
    }
  });

  function persistAvailability(o) { return _availabilityCycle.persist(o); }
  function hydrateAvailability() { return _availabilityCycle.hydrate(); }
  function persistGoals(o) { return _goalsCycle.persist(o); }
  function hydrateGoals() { return hydrateGoalsWithCleanup(); }
  function persistConstraintsCloud(o) { return _constraintsCycle.persist(o); }
  function hydrateConstraints() { return _constraintsCycle.hydrate(); }

  // Logout/Kontowechsel: gemappte Felder leeren + Flag zurücksetzen. Legacy unangetastet.
  function clear() {
    neutralizeMapped();
    // 2B-①/P9: cloud-gemappte Sektionen beim Kontowechsel leeren (kein A→B-Leak).
    try {
      PROFILE.sports = [];
      PROFILE.availability = null;
      PROFILE.goals = [];
      PROFILE.constraintsList = [];
      PROFILE.issues = [];
      ['sports', 'availability', 'goals', 'constraints'].forEach(function (sec) {
        if (PROFILE._sectionMeta && PROFILE._sectionMeta[sec]) PROFILE._sectionMeta[sec].updatedAt = null;
      });
    } catch (e) {}
    O.profileMigrated = false;
  }

  function rerender() {
    try { if (typeof renderProfileScreen === 'function') renderProfileScreen(); } catch (e) {}
    try { if (typeof renderZones === 'function') renderZones(); } catch (e) {}
  }

  /* 0016 · ORVIA.athleteProfile — READ-ONLY-Sicht auf die servergestützten Athletendaten.
     Strikt getrennt von ORVIA.profile (API-Adapter) und ORVIA.accessProfile (Auth/Rolle). */
  O.athleteProfile = {
    get: function () {
      var p = (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : {};
      return { name: p.name ?? null, location: p.location ?? null, weightKg: p.weightKg ?? null,
        heightCm: p.heightCm ?? null, avatarPath: p.avatarPath ?? null, birthDate: p.birthDate ?? null,
        sex: p.sex ?? null, age: p.age ?? null };
    },
    cacheKey: athleteCacheKey
  };

  O.profileStore = {
    hydrate, persist, clear, computeAge, applyRow, neutralizeMapped,
    effectiveTimezone, detectedTimezone, effectiveSleepGoal, MAPPED,
    // 2B-①: sports-Vollzyklus (user_sports als SSoT)
    persistSports, hydrateSports, sportsToRows, rowsToSports,
    // P9: weitere Sektions-Zyklen
    persistAvailability, hydrateAvailability, persistGoals, hydrateGoals,
    persistConstraintsCloud, hydrateConstraints
  };
})();
