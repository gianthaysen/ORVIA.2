/* ============================================================
   ORVIA · onboarding-sports-logic — REINE Sportarten-Logik (kein DOM/Store/Supabase).
   Kanonische IDs aus training-domain (gym/running/cycling/swimming/football/handball/tennis/padel)
   + ergänzte (basketball/rowing/hiking/walking/other). Über window.ORVIA.onboardingSportsLogic + module.exports.
   ============================================================ */
(function (root) {
  var SPORT_ROLES = ['primary', 'secondary', 'occasional'];
  /* M5b (A3): kanonische Trainingsstand-Stufen — identisch mit onboarding-profile-logic.LEVELS
     (Cross-Contract-Test in onboarding_m5b_training_test). KEIN weiterer Level-Namespace. */
  var TRAINING_LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'];
  /* M5b (A3): UI-Frequenzbänder ↔ kanonischer Int (sports[].sessionsPerWeek).
     Dokumentierte, deterministische Abbildung: Band → oberer Bandwert; '7plus' → 7
     (konservativ: mehr wissen wir nicht — kein erfundener Messwert). */
  var SESSION_BANDS = [
    { id: '1-2', label: '1–2×', value: 2 },
    { id: '3-4', label: '3–4×', value: 4 },
    { id: '5-6', label: '5–6×', value: 6 },
    { id: '7plus', label: '7×+', value: 7 }
  ];
  function sessionsForBand(bandId) {
    for (var i = 0; i < SESSION_BANDS.length; i++) if (SESSION_BANDS[i].id === bandId) return SESSION_BANDS[i].value;
    return null;
  }
  function bandForSessions(n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 1) return null;
    if (n <= 2) return '1-2';
    if (n <= 4) return '3-4';
    if (n <= 6) return '5-6';
    return '7plus';
  }
  /* M7 (A5): typische Einheitsdauer ↔ kanonische Minuten (sports[].typicalDuration).
     '90plus' → 90 (konservativ, mehr wissen wir nicht — kein erfundener Messwert). */
  var DURATION_BANDS = [
    { id: '30', label: '~30 min', value: 30 },
    { id: '45', label: '~45 min', value: 45 },
    { id: '60', label: '~60 min', value: 60 },
    { id: '90plus', label: '90+ min', value: 90 }
  ];
  function durationForBand(bandId) {
    for (var i = 0; i < DURATION_BANDS.length; i++) if (DURATION_BANDS[i].id === bandId) return DURATION_BANDS[i].value;
    return null;
  }
  function bandForDuration(min) {
    if (typeof min !== 'number' || !isFinite(min) || min < 10) return null;
    if (min <= 37) return '30';
    if (min <= 52) return '45';
    if (min <= 75) return '60';
    return '90plus';
  }
  // Kategorien: endurance | strength | team | racket | outdoor | other
  var SPORT_CATALOG = [
    { id: 'running', label: 'Laufen', category: 'endurance', icon: 'run', planningSupported: true, metricsProfile: 'running' },
    { id: 'gym', label: 'Krafttraining', category: 'strength', icon: 'dumbbell', planningSupported: true, metricsProfile: 'strength' },
    { id: 'cycling', label: 'Radfahren', category: 'endurance', icon: 'bike', planningSupported: true, metricsProfile: 'cycling' },
    { id: 'swimming', label: 'Schwimmen', category: 'endurance', icon: 'swim', planningSupported: true, metricsProfile: 'swimming' },
    { id: 'football', label: 'Fußball', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'handball', label: 'Handball', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'tennis', label: 'Tennis', category: 'racket', icon: 'racket', planningSupported: true, metricsProfile: 'racket' },
    { id: 'padel', label: 'Padel', category: 'racket', icon: 'racket', planningSupported: true, metricsProfile: 'racket' },
    { id: 'basketball', label: 'Basketball', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'rowing', label: 'Rudern', category: 'endurance', icon: 'row', planningSupported: true, metricsProfile: 'rowing' },
    { id: 'triathlon', label: 'Triathlon', category: 'endurance', icon: 'triathlon', planningSupported: true, metricsProfile: 'triathlon' },
    { id: 'athletics', label: 'Leichtathletik', category: 'endurance', icon: 'athletics', planningSupported: true, metricsProfile: 'athletics' },
    { id: 'volleyball', label: 'Volleyball', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'hockey', label: 'Hockey', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'rugby', label: 'Rugby', category: 'team', icon: 'ball', planningSupported: true, metricsProfile: 'team' },
    { id: 'badminton', label: 'Badminton', category: 'racket', icon: 'racket', planningSupported: true, metricsProfile: 'racket' },
    { id: 'golf', label: 'Golf', category: 'other', icon: 'pulse', planningSupported: true, metricsProfile: 'other' },
    { id: 'hiking', label: 'Wandern', category: 'outdoor', icon: 'hike', planningSupported: true, metricsProfile: 'outdoor' },
    { id: 'walking', label: 'Gehen', category: 'outdoor', icon: 'walk', planningSupported: true, metricsProfile: 'outdoor' },
    { id: 'climbing', label: 'Klettern', category: 'outdoor', icon: 'pulse', planningSupported: true, metricsProfile: 'climbing' },
    { id: 'yoga', label: 'Yoga', category: 'mindbody', icon: 'stretch', planningSupported: true, metricsProfile: 'mindbody' },
    { id: 'mobility', label: 'Mobility', category: 'mindbody', icon: 'stretch', planningSupported: true, metricsProfile: 'mindbody' },
    { id: 'hyrox', label: 'HYROX', category: 'hybrid', icon: 'dumbbell', planningSupported: true, metricsProfile: 'hybrid' },
    { id: 'other', label: 'Andere', category: 'other', icon: 'pulse', planningSupported: false, metricsProfile: 'other' }
  ];
  var CATALOG_BY_ID = {}; SPORT_CATALOG.forEach(function (s) { CATALOG_BY_ID[s.id] = s; });
  // Legacy-/Label-Aliasse → kanonische ID (für Seed aus Bestandsprofil).
  var SEED_ALIASES = {
    laufen: 'running', lauf: 'running', run: 'running', running: 'running',
    rad: 'cycling', radsport: 'cycling', bike: 'cycling', cycling: 'cycling',
    schwimmen: 'swimming', swim: 'swimming', swimming: 'swimming',
    gym: 'gym', kraft: 'gym', krafttraining: 'gym', strength: 'gym', 'mobilität': 'mobility', mobilitaet: 'mobility', mobility: 'mobility', yoga: 'yoga', klettern: 'climbing', climbing: 'climbing', bouldern: 'climbing', rudern: 'rowing', hyrox: 'hyrox',
    'fußball': 'football', fussball: 'football', football: 'football', soccer: 'football',
    handball: 'handball', tennis: 'tennis', padel: 'padel', basketball: 'basketball',
    rudern: 'rowing', rowing: 'rowing', wandern: 'hiking', hiking: 'hiking', gehen: 'walking', walking: 'walking',
    triathlon: 'triathlon', leichtathletik: 'athletics', athletics: 'athletics', athletik: 'athletics'
  };
  function canonId(v) { if (v == null) return null; var s = String(v).trim().toLowerCase(); if (CATALOG_BY_ID[s]) return s; return SEED_ALIASES[s] || null; }
  function isKnownSport(id) { return !!CATALOG_BY_ID[id]; }
  function plannable(id) { var c = CATALOG_BY_ID[id]; return !!(c && c.planningSupported === true); }
  function bool(v, dflt) { return typeof v === 'boolean' ? v : !!dflt; }
  function intOrNull(v) { var n = (typeof v === 'number') ? v : parseInt(v, 10); return (isFinite(n) && Math.floor(n) === n) ? n : null; }

  function emptySportsSelection() { return { sports: [] }; }

  // M5b: nur valide Trainingsstand-Werte übernehmen — sonst null (kein stilles Erfinden).
  function levelOrNull(v) { return TRAINING_LEVELS.indexOf(v) >= 0 ? v : null; }
  function sessionsOrNull(v) { var n = intOrNull(v); return (n != null && n >= 0 && n <= 14) ? n : null; }
  function durationOrNull(v) { var n = intOrNull(v); return (n != null && n >= 10 && n <= 600) ? n : null; }   // M7 (A5)

  // Einzelne Sportart normalisieren. Unbekannte ID → null (verworfen).
  function normalizeSportEntry(raw) {
    if (!raw) return null;
    var id = isKnownSport(raw.sportId) ? raw.sportId : null;
    if (!id) return null;
    var role = SPORT_ROLES.indexOf(raw.role) >= 0 ? raw.role : 'secondary';
    var e = { sportId: id, role: role, enabled: bool(raw.enabled, true), visible: bool(raw.visible, true), planningEnabled: bool(raw.planningEnabled, true), priority: intOrNull(raw.priority),
      level: levelOrNull(raw.level), sessionsPerWeek: sessionsOrNull(raw.sessionsPerWeek),   // M5b (A3), pro Sport — nie global
      typicalDuration: durationOrNull(raw.typicalDuration) };                                 // M7 (A5)
    return applyRoleInvariants(e);
  }
  // Rollen-/Fähigkeits-Invarianten je Eintrag. SEMANTIK: jeder gewählte Eintrag ist enabled=true.
  // planningSupported===false → planningEnabled=false, priority=null, niemals primary.
  function applyRoleInvariants(e) {
    e.enabled = true;                                  // jede gewählte Sportart ist aktiviert
    if (!plannable(e.sportId)) {                       // nicht planbar → nie geplant/primary
      if (e.role === 'primary') e.role = 'secondary';
      e.planningEnabled = false; e.priority = null;
    }
    if (e.role === 'primary') { e.visible = true; e.planningEnabled = true; }
    else if (e.role === 'occasional') { e.planningEnabled = false; }   // gelegentlich → nie aktiv geplant
    if (!e.planningEnabled) e.priority = null;
    return e;
  }

  // Gesamte Auswahl normalisieren: dedupe, unbekannte raus, höchstens EINE primary, Prioritäten lückenlos/eindeutig.
  function normalizeSportsSelection(sel) {
    var arr = (sel && Array.isArray(sel.sports)) ? sel.sports : [];
    var seen = {}, out = [];
    arr.forEach(function (raw) {
      var e = normalizeSportEntry(raw);
      if (!e || seen[e.sportId]) return;
      seen[e.sportId] = true; out.push(e);
    });
    // höchstens EINE primary (erste bleibt, weitere → secondary, deterministisch)
    var primarySeen = false;
    out.forEach(function (e) { if (e.role === 'primary') { if (primarySeen) { e.role = 'secondary'; } else { primarySeen = true; } applyRoleInvariants(e); } });
    // Prioritäten neu vergeben: nur geplante; primary zuerst, dann nach bestehender Priorität (nulls zuletzt), dann Reihenfolge.
    var planned = out.filter(function (e) { return e.planningEnabled; });
    planned.sort(function (a, b) {
      if (a.role === 'primary' && b.role !== 'primary') return -1;
      if (b.role === 'primary' && a.role !== 'primary') return 1;
      var pa = a.priority == null ? Infinity : a.priority, pb = b.priority == null ? Infinity : b.priority;
      if (pa !== pb) return pa - pb;
      return out.indexOf(a) - out.indexOf(b);
    });
    planned.forEach(function (e, i) { e.priority = i + 1; });
    out.forEach(function (e) { if (!e.planningEnabled) e.priority = null; });
    return { sports: out };
  }

  function validateSportsSelection(sel) {
    var n = normalizeSportsSelection(sel), errors = {};
    if (!n.sports.length) errors._selection = 'Wähle mindestens eine Sportart aus.';
    var primaries = n.sports.filter(function (e) { return e.role === 'primary'; });
    if (n.sports.length && primaries.length !== 1) errors._primary = 'Lege genau eine Hauptsportart fest.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
  function sportsComplete(sel) { try { return validateSportsSelection(sel).valid; } catch (e) { return false; } }

  function getPrimarySport(sel) { var n = normalizeSportsSelection(sel); for (var i = 0; i < n.sports.length; i++) if (n.sports[i].role === 'primary') return n.sports[i].sportId; return null; }
  function getPlannedSports(sel) { return normalizeSportsSelection(sel).sports.filter(function (e) { return e.planningEnabled; }).sort(function (a, b) { return a.priority - b.priority; }).map(function (e) { return e.sportId; }); }
  function getVisibleSports(sel) { return normalizeSportsSelection(sel).sports.filter(function (e) { return e.visible; }).map(function (e) { return e.sportId; }); }
  function getOccasionalSports(sel) { return normalizeSportsSelection(sel).sports.filter(function (e) { return e.role === 'occasional'; }).map(function (e) { return e.sportId; }); }

  function find(sel, id) { for (var i = 0; i < sel.sports.length; i++) if (sel.sports[i].sportId === id) return sel.sports[i]; return null; }
  function cloneSel(sel) { return normalizeSportsSelection(sel); }   // normalisierte Kopie (keine Mutation der Quelle)

  function toggleSport(sel, sportId) {
    var n = cloneSel(sel); if (!isKnownSport(sportId)) return n;
    var ex = find(n, sportId);
    if (ex) { n.sports = n.sports.filter(function (e) { return e.sportId !== sportId; }); }
    else { n.sports.push({ sportId: sportId, role: 'secondary', enabled: true, visible: true, planningEnabled: true, priority: null }); }
    // Komfort: existiert KEINE Hauptsportart, wird die erste PLANBARE zur Hauptsportart
    // (nicht planbare wie 'other' werden NIE automatisch primary).
    n = normalizeSportsSelection(n);
    if (n.sports.length && !n.sports.some(function (e) { return e.role === 'primary'; })) {
      for (var i = 0; i < n.sports.length; i++) { if (plannable(n.sports[i].sportId)) { n.sports[i].role = 'primary'; break; } }
      n = normalizeSportsSelection(n);
    }
    return n;
  }
  function setPrimarySport(sel, sportId) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t || !plannable(sportId)) return n;   // nicht planbar → keine Hauptsportart
    n.sports.forEach(function (e) { if (e.role === 'primary') e.role = 'secondary'; });
    t.role = 'primary';
    return normalizeSportsSelection(n);
  }
  function setSportRole(sel, sportId, role) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t || SPORT_ROLES.indexOf(role) < 0) return n;
    if (role === 'primary') return setPrimarySport(n, sportId);
    t.role = role;
    return normalizeSportsSelection(n);
  }
  function setPlanningEnabled(sel, sportId, on) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    if (t.role === 'primary') return n;        // primary ist immer geplant
    if (!plannable(sportId)) { t.planningEnabled = false; return normalizeSportsSelection(n); }   // nicht planbar bleibt false
    if (t.role === 'occasional') { t.planningEnabled = false; return normalizeSportsSelection(n); }
    t.planningEnabled = !!on;
    return normalizeSportsSelection(n);
  }
  // Segment-Control: ein Aufruf setzt Rolle + Planung konsistent (UI setzt nie mehrere Felder selbst).
  // mode: 'planned' (secondary, aktiv geplant) | 'occasional' (gelegentlich, nie geplant).
  function setSportMode(sel, sportId, mode) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    if (t.role === 'primary') return n;                      // Hauptsportart ist fix aktiv geplant
    if (!plannable(sportId)) { t.role = 'occasional'; t.planningEnabled = false; t.priority = null; return normalizeSportsSelection(n); }
    if (mode === 'planned') { t.role = 'secondary'; t.planningEnabled = true; }
    else if (mode === 'occasional') { t.role = 'occasional'; t.planningEnabled = false; t.priority = null; }
    else return n;
    return normalizeSportsSelection(n);
  }
  /* M5b (A3): Trainingsstand-Setter — zielgenau je Sport, nicht-mutierend, invalide Werte wirken nicht. */
  function setTrainingLevel(sel, sportId, level) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    var lv = levelOrNull(level); if (lv === null && level != null) return n;   // invalides Level ändert nichts
    t.level = lv;
    return normalizeSportsSelection(n);
  }
  function setSessionsPerWeek(sel, sportId, count) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    var c = sessionsOrNull(count); if (c === null && count != null) return n;  // out-of-range ändert nichts
    t.sessionsPerWeek = c;
    return normalizeSportsSelection(n);
  }
  /* A3-Validierung: bezieht sich IMMER auf die Hauptsportart (Frage „Wie trainierst du aktuell?"
     wird im Kontext der Hauptsportart beantwortet; Primary-Wechsel erfordert neue Angaben). */
  function validateTrainingLevel(sel) {
    var n = normalizeSportsSelection(sel), errors = {};
    var p = null;
    n.sports.forEach(function (e) { if (e.role === 'primary') p = e; });
    if (!p) { errors._primary = 'Lege zuerst deine Hauptsportart fest.'; return { valid: false, errors: errors }; }
    if (!p.level) errors._level = 'Wähle aus, wie du aktuell trainierst.';
    if (p.sessionsPerWeek == null) errors._sessions = 'Wähle aus, wie oft du pro Woche trainierst.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
  function trainingLevelComplete(sel) { try { return validateTrainingLevel(sel).valid; } catch (e) { return false; } }
  // M7 (A5): typische Dauer — zielgenau je Sport, nicht-mutierend; null = bewusst leeren.
  function setTypicalDuration(sel, sportId, minutes) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    var m = durationOrNull(minutes); if (m === null && minutes != null) return n;   // out-of-range ändert nichts
    t.typicalDuration = m;
    return normalizeSportsSelection(n);
  }

  function setVisible(sel, sportId, on) {
    var n = cloneSel(sel); var t = find(n, sportId); if (!t) return n;
    if (t.role === 'primary') return n;        // primary ist immer sichtbar
    t.visible = !!on;
    return normalizeSportsSelection(n);
  }
  function reorderPlannedSports(sel, orderedIds) {
    var n = cloneSel(sel); if (!Array.isArray(orderedIds)) return n;
    var rank = {}; orderedIds.forEach(function (id, i) { rank[id] = i; });
    n.sports.filter(function (e) { return e.planningEnabled; }).forEach(function (e) { if (rank[e.sportId] != null) e.priority = rank[e.sportId] + 1; });
    return normalizeSportsSelection(n);
  }

  // Seed aus Bestandsprofil (profile.sports = Labels/IDs). Mutiert die Quelle NICHT.
  function seedFromExistingProfile(profile) {
    var sel = emptySportsSelection();
    var list = (profile && Array.isArray(profile.sports)) ? profile.sports : [];
    var seen = {};
    list.forEach(function (v, i) {
      var id = canonId(typeof v === 'string' ? v : (v && v.sportId));
      if (!id || seen[id]) return; seen[id] = true;
      sel.sports.push({ sportId: id, role: i === 0 ? 'primary' : 'secondary', enabled: true, visible: true, planningEnabled: true, priority: null });
    });
    return normalizeSportsSelection(sel);
  }

  // Abgeleitete App-Konfiguration (für spätere Navigation/Startseite/Plan/Insights). Nur lesend.
  function buildUserSportConfiguration(sel) {
    var n = normalizeSportsSelection(sel);
    return {
      primarySportId: getPrimarySport(n),
      plannedSportIds: getPlannedSports(n),
      visibleSportIds: getVisibleSports(n),
      availableSportIds: n.sports.filter(function (e) { return e.enabled; }).map(function (e) { return e.sportId; })
    };
  }
  // Spontane Aktivität: jede bekannte Sportart ist ausführbar — unabhängig von Sichtbarkeit/Planung.
  function isActivityAvailable(sportId) { return isKnownSport(sportId); }

  // Defensive Katalogprüfung (interne Integrität). Produktive API darf nicht still mit kaputtem Katalog laufen.
  var VALID_CATEGORIES = ['endurance', 'strength', 'team', 'racket', 'outdoor', 'mindbody', 'hybrid', 'other'];
  function validateSportCatalog() {
    var errors = [], ids = {};
    if (!Array.isArray(SPORT_CATALOG)) return { valid: false, errors: ['Katalog ist kein Array.'] };
    SPORT_CATALOG.forEach(function (s) {
      if (!s || !s.id) { errors.push('leere id'); return; }
      if (ids[s.id]) errors.push('doppelte id: ' + s.id); ids[s.id] = true;
      if (!CATALOG_BY_ID[s.id] || CATALOG_BY_ID[s.id] !== s) errors.push('CATALOG_BY_ID inkonsistent: ' + s.id);
      if (!s.label) errors.push('fehlendes label: ' + s.id);
      if (VALID_CATEGORIES.indexOf(s.category) < 0) errors.push('ungültige Kategorie: ' + s.id);
      if (typeof s.planningSupported !== 'boolean') errors.push('ungültiges planningSupported: ' + s.id);
      if (!s.metricsProfile) errors.push('fehlendes metricsProfile: ' + s.id);
    });
    Object.keys(CATALOG_BY_ID).forEach(function (k) { if (!ids[k]) errors.push('Fremd-Key in CATALOG_BY_ID: ' + k); });
    return { valid: errors.length === 0, errors: errors };
  }

  var api = {
    SPORT_CATALOG: SPORT_CATALOG, SPORT_ROLES: SPORT_ROLES, CATALOG_BY_ID: CATALOG_BY_ID, isKnownSport: isKnownSport,
    TRAINING_LEVELS: TRAINING_LEVELS, SESSION_BANDS: SESSION_BANDS, sessionsForBand: sessionsForBand, bandForSessions: bandForSessions,
    DURATION_BANDS: DURATION_BANDS, durationForBand: durationForBand, bandForDuration: bandForDuration, setTypicalDuration: setTypicalDuration,
    setTrainingLevel: setTrainingLevel, setSessionsPerWeek: setSessionsPerWeek, validateTrainingLevel: validateTrainingLevel, trainingLevelComplete: trainingLevelComplete,
    emptySportsSelection: emptySportsSelection, normalizeSportEntry: normalizeSportEntry, normalizeSportsSelection: normalizeSportsSelection,
    validateSportsSelection: validateSportsSelection, sportsComplete: sportsComplete,
    getPrimarySport: getPrimarySport, getPlannedSports: getPlannedSports, getVisibleSports: getVisibleSports, getOccasionalSports: getOccasionalSports,
    setPrimarySport: setPrimarySport, toggleSport: toggleSport, setSportRole: setSportRole, setPlanningEnabled: setPlanningEnabled, setVisible: setVisible, setSportMode: setSportMode,
    reorderPlannedSports: reorderPlannedSports, seedFromExistingProfile: seedFromExistingProfile,
    buildUserSportConfiguration: buildUserSportConfiguration, isActivityAvailable: isActivityAvailable,
    validateSportCatalog: validateSportCatalog, plannable: plannable
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingSportsLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
