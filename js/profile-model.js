/* ============================================================
   ORVIA · profile-model — REINES, migrationssicheres Profil-/Mehrziel-Modell (Phase: Profil & Ziele).
   Kein DOM/Store/Supabase. Liefert: Migration v1→v2, freie Mehrziel-Logik (CRUD/Priorität/Status/
   Konflikte), sportartspezifische Folgefrage-Schemata (modular), Validierung, Zusammenfassung.
   KEINE Trainingsplan-Engine. Über window.ORVIA.profileModel + module.exports.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var SCHEMA_VERSION = 2;

  var GOAL_STATUSES = ['active', 'paused', 'achieved', 'abandoned', 'archived'];
  var MILESTONE_STATUSES = ['planned', 'in_progress', 'achieved', 'skipped'];
  // Priorität: 1 = höchste. Begrenzte Anzahl gleichrangiger „höchster" (für eindeutige Planung).
  var MAX_TOP_PRIORITY_GOALS = 2;

  // Vordefinierte Zielkategorien (gruppiert). 'custom' = eigenes Freitextziel.
  var GOAL_CATEGORIES = {
    body_composition: ['fat_loss', 'shredded', 'weight_loss', 'weight_gain', 'muscle_gain', 'muscle_maintain', 'recomposition', 'target_bodyfat'],
    endurance: ['run_5k', 'run_10k', 'half_marathon', 'marathon', 'triathlon', 'ironman', 'cycling_race', 'swim_goal', 'base_endurance', 'vo2max'],
    strength: ['get_stronger', 'hypertrophy', 'lift_pr', 'strength_endurance', 'functional_strength', 'explosive_strength'],
    team_sport: ['football', 'handball', 'basketball', 'volleyball', 'tennis', 'padel', 'hockey', 'rugby', 'other_team'],
    sport_performance: ['sprint_speed', 'change_of_direction', 'jump', 'game_endurance', 'repeated_sprints', 'duel_strength', 'mobility_perf', 'technique', 'robustness', 'injury_prevention'],
    health: ['reduce_complaints', 'stabilize_knee', 'strengthen_back', 'improve_mobility', 'pain_free', 'increase_robustness', 'return_after_break', 'improve_recovery', 'improve_sleep', 'reduce_stress'],
    general: ['train_regularly', 'keep_fit', 'active_daily', 'long_term_health', 'wellbeing', 'custom']
  };
  function categoryOf(goalType) { for (var c in GOAL_CATEGORIES) if (GOAL_CATEGORIES[c].indexOf(goalType) >= 0) return c; return 'general'; }

  function uid(prefix) { return (prefix || 'goal') + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function isDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s); }

  // Einzelziel normalisieren (defensiv, stabile id, gültiger Status/Priorität).
  function normalizeGoal(raw, now) {
    raw = raw || {}; now = now || nowISO();
    var status = GOAL_STATUSES.indexOf(raw.status) >= 0 ? raw.status : 'active';
    var pr = parseInt(raw.priority, 10); if (!(pr >= 1)) pr = 3;
    var type = raw.category || raw.type || 'custom';
    return {
      id: raw.id || uid('goal'),
      title: (raw.title != null ? String(raw.title) : '').trim(),
      category: type,
      group: raw.group || categoryOf(type),
      customCategory: raw.customCategory || null,
      description: raw.description || '',
      priority: pr,
      timeHorizon: raw.timeHorizon || null,          // short|mid|long|open
      targetDate: isDateStr(raw.targetDate) ? raw.targetDate : null,
      status: status,
      sports: Array.isArray(raw.sports) ? raw.sports.slice() : [],
      metrics: raw.metrics || null,
      currentValue: raw.currentValue != null ? raw.currentValue : null,
      targetValue: raw.targetValue != null ? raw.targetValue : null,
      unit: raw.unit || null,
      motivation: raw.motivation || '',
      constraints: Array.isArray(raw.constraints) ? raw.constraints.slice() : [],
      categoryData: (raw.categoryData && typeof raw.categoryData === 'object') ? raw.categoryData : {},
      milestones: normalizeMilestones(raw.milestones),
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now
    };
  }

  // ---- Meilensteine (eigener Statuskreis, stabile id, definierte Reihenfolge) ----
  function normalizeMilestone(m, idx) {
    m = m || {};
    return {
      id: m.id || uid('ms'),
      title: (m.title != null ? String(m.title) : '').trim(),
      targetDate: isDateStr(m.targetDate) ? m.targetDate : null,
      metric: m.metric || null,
      currentValue: m.currentValue != null ? m.currentValue : null,
      targetValue: m.targetValue != null ? m.targetValue : null,
      unit: m.unit || null,
      status: MILESTONE_STATUSES.indexOf(m.status) >= 0 ? m.status : 'planned',
      order: (typeof m.order === 'number') ? m.order : idx
    };
  }
  function normalizeMilestones(list) {
    var arr = Array.isArray(list) ? list : [];
    return arr.map(normalizeMilestone).sort(function (a, b) { return a.order - b.order; }).map(function (m, i) { m.order = i; return m; });
  }
  function addMilestone(goal, ms) { var g = Object.assign({}, goal); var arr = normalizeMilestones(goal.milestones); arr.push(normalizeMilestone(ms, arr.length)); g.milestones = normalizeMilestones(arr); return g; }
  function updateMilestone(goal, msId, patch) { var g = Object.assign({}, goal); g.milestones = normalizeMilestones((goal.milestones || []).map(function (m) { return m.id === msId ? Object.assign({}, m, patch, { id: m.id }) : m; })); return g; }
  function removeMilestone(goal, msId) { var g = Object.assign({}, goal); g.milestones = normalizeMilestones((goal.milestones || []).filter(function (m) { return m.id !== msId; })); return g; }
  // Meilenstein um delta (−1 hoch / +1 runter) verschieben; Reihenfolge bleibt stabil/lückenlos.
  function moveMilestone(goal, msId, delta) {
    var arr = normalizeMilestones(goal.milestones);
    var i = arr.findIndex(function (m) { return m.id === msId; }); if (i < 0) return goal;
    var j = i + delta; if (j < 0 || j >= arr.length) return goal;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    var g = Object.assign({}, goal); g.milestones = arr.map(function (m, k) { m.order = k; return m; }); return g;
  }
  // Zielmenge normalisieren: dedupe über id, Priorität auf höchstens MAX_TOP_PRIORITY_GOALS „1".
  function normalizeGoals(list, now) {
    var arr = Array.isArray(list) ? list : [];
    var seen = {}, out = [];
    arr.forEach(function (g) { var n = normalizeGoal(g, now); if (seen[n.id]) return; seen[n.id] = true; out.push(n); });
    // Wenn mehr als MAX_TOP_PRIORITY_GOALS aktive Ziele Priorität 1 haben → überzählige auf 2 stufen.
    var tops = out.filter(function (g) { return g.priority === 1 && g.status === 'active'; });
    if (tops.length > MAX_TOP_PRIORITY_GOALS) { tops.slice(MAX_TOP_PRIORITY_GOALS).forEach(function (g) { g.priority = 2; }); }
    return out;
  }

  // ---- Ziel-CRUD (NICHT mutierend: liefern neue goals-Liste) ----
  function addGoal(goals, goalInput, now) { var g = normalizeGoal(goalInput, now); return normalizeGoals((goals || []).concat([g]), now); }
  function updateGoal(goals, id, patch, now) { return normalizeGoals((goals || []).map(function (g) { return g.id === id ? normalizeGoal(Object.assign({}, g, patch, { id: g.id, createdAt: g.createdAt, updatedAt: now || nowISO() }), now) : g; }), now); }
  function removeGoal(goals, id) { return (goals || []).filter(function (g) { return g.id !== id; }); }
  function setGoalStatus(goals, id, status, now) { return updateGoal(goals, id, { status: status }, now); }
  function setGoalPriority(goals, id, priority, now) { return updateGoal(goals, id, { priority: priority }, now); }

  // ---- Zielkonflikte (transparent, NICHT blockierend) ----
  // Liefert [{goalIds, conflictType, severity, explanation, recommendedStrategy}].
  var CONFLICT_RULES = [
    { a: ['hypertrophy', 'muscle_gain', 'weight_gain'], b: ['ironman', 'marathon', 'triathlon', 'base_endurance', 'vo2max'], type: 'hypertrophy_vs_endurance', severity: 'high', text: 'Maximaler Muskelaufbau und großer Ausdauerumfang konkurrieren um Energie und Regeneration.' },
    { a: ['fat_loss', 'shredded', 'weight_loss', 'target_bodyfat'], b: ['sprint_speed', 'jump', 'explosive_strength', 'game_endurance', 'lift_pr', 'get_stronger'], type: 'deficit_vs_performance', severity: 'medium', text: 'Ein Kaloriendefizit kann Spitzenleistung und Kraftentwicklung vorübergehend begrenzen.' },
    { a: ['marathon', 'half_marathon', 'run_10k'], b: ['weight_gain', 'muscle_gain', 'hypertrophy'], type: 'endurance_pr_vs_mass', severity: 'medium', text: 'Eine Bestzeit im Laufen und deutlicher Masseaufbau ziehen in unterschiedliche Richtungen.' },
    { a: ['get_stronger', 'hypertrophy', 'lift_pr'], b: ['fat_loss', 'shredded', 'weight_loss'], type: 'strength_vs_deficit', severity: 'low', text: 'Kraftzuwachs im Defizit ist möglich, aber langsamer — realistisch einplanen.' }
  ];
  function detectGoalConflicts(goals) {
    var active = (goals || []).filter(function (g) { return g.status === 'active'; });
    var out = [];
    CONFLICT_RULES.forEach(function (rule) {
      var ga = active.filter(function (g) { return rule.a.indexOf(g.category) >= 0; });
      var gb = active.filter(function (g) { return rule.b.indexOf(g.category) >= 0; });
      if (ga.length && gb.length) {
        out.push({ goalIds: ga.concat(gb).map(function (g) { return g.id; }), conflictType: rule.type, severity: rule.severity,
          explanation: rule.text, recommendedStrategy: 'Ein Ziel als Hauptfokus aktiv entwickeln, das andere erhalten/zeitlich staffeln.', userDecision: null });
      }
    });
    return out;
  }

  // ---- Sportartspezifische Folgefragen (modular, erweiterbar; keine if/else-Kette in der UI) ----
  var SPORT_FOLLOWUP = {
    football: { fields: ['position', 'sessionsPerWeek', 'matchDay', 'league', 'seasonPhase', 'gameMinutes', 'strengthVolume', 'extraTeamSessions'], focusOptions: ['sprint_speed', 'explosive', 'repeated_sprints', 'game_endurance', 'strength', 'change_of_direction', 'injury_prevention'] },
    handball: { fields: ['position', 'sessionsPerWeek', 'matchDay', 'league', 'seasonPhase'], focusOptions: ['explosive', 'throw_power', 'repeated_sprints', 'injury_prevention'] },
    basketball: { fields: ['position', 'sessionsPerWeek', 'matchDay', 'league', 'seasonPhase'], focusOptions: ['jump', 'sprint_speed', 'game_endurance', 'change_of_direction'] },
    running: { fields: ['currentDistances', 'currentTimes', 'weeklyKm', 'longestRunKm', 'raceGoal', 'targetTime', 'runDays', 'surface', 'injuryHistory'] },
    triathlon: { fields: ['swimLevel', 'bikeLevel', 'runLevel', 'pastRaces', 'weeklyHours', 'poolAccess', 'bikeTrainer', 'raceDistance', 'targetDate', 'weakestDiscipline'] },
    ironman: { alias: 'triathlon' },
    gym: { fields: ['trainingYears', 'trainingDays', 'split', 'mainGoal', 'equipment', 'knownLifts', 'preferredExercises', 'limitations', 'musclePriorities'] },
    shredded: { fields: ['bodyData', 'nutritionSituation', 'strengthDays', 'enduranceVolume', 'targetTimeframe', 'maintainMuscle', 'energyLevel', 'recovery', 'currentDeficit', 'changeTempo'] }
  };
  function sportFollowupSchema(sportId) { var s = SPORT_FOLLOWUP[sportId]; if (s && s.alias) return SPORT_FOLLOWUP[s.alias]; return s || null; }

  // ---- Validierung (nur wirklich Nötiges verpflichtend; verständlich) ----
  function validateGoal(goal) {
    var errors = {};
    if (!goal || !goal.title || !goal.title.trim()) errors.title = 'Bitte gib deinem Ziel einen Namen.';
    if (goal && goal.targetDate && isDateStr(goal.targetDate)) {
      var d = new Date(goal.targetDate + 'T00:00:00'); if (!isNaN(d.getTime()) && d.getTime() < Date.now() - 864e5) errors.targetDate = 'Das Zieldatum liegt in der Vergangenheit. Du kannst das Ziel auch ohne festes Datum speichern.';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }
  /* M7 (A5): Essential-Verfügbarkeit — mindestens ein verfügbarer Tag (oder Slot).
     Deckungsgleich mit ESSENTIAL_REQUIREMENTS.availability.training_days. Pure Funktion. */
  function validateEssentialAvailability(av) {
    var errors = {};
    var d = av && av.days;
    var hasDay = !!(d && typeof d === 'object' && Object.keys(d).some(function (k) {
      var day = d[k]; return day === true || !!(day && (day.available === true || (Array.isArray(day.slots) && day.slots.length > 0)));
    }));
    if (!hasDay) errors._days = 'Wähle mindestens einen Tag aus, an dem du meistens trainieren kannst.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* M7 (A6): Sicherheitscheck — die Frage MUSS beantwortet sein (Ja/Nein).
     Bei Ja sind Körperregion (kanonische BODY_REGIONS-Codes) und Intensität 1–10 Pflicht.
     Kein Acknowledge ohne Antwort (nichts erfinden). Pure Funktion. */
  function validateSafetyCheck(safety) {
    var errors = {};
    if (!safety || typeof safety.hasComplaints !== 'boolean') {
      errors._answer = 'Bitte beantworte die Frage — sie schützt dich vor ungeeigneten Empfehlungen.';
      return { valid: false, errors: errors };
    }
    if (safety.hasComplaints === true) {
      var c = safety.constraint || {};
      var regionOk = BODY_REGIONS.some(function (r) { return r[0] === c.bodyRegion; });
      if (!regionOk) errors._region = 'Wähle die betroffene Körperregion aus.';
      var it = parseInt(c.intensity, 10);
      if (!(it >= 1 && it <= 10)) errors._intensity = 'Gib an, wie stark die Beschwerden aktuell sind (1–10).';
    }
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* M6 (A4): Essential-Zielprüfung — mindestens EIN aktives Ziel mit Kategorie UND Titel.
     Titel ist Pflicht, weil der Completion-Pfad untitulierte Ziele verwirft (dokumentierter
     Vertrag in buildCompletionPatch); der Essential-Schritt setzt den Titel automatisch
     aus dem Kategorien-Label (editierbar). Pure Funktion, kein _sectionMeta-Zugriff. */
  function validateEssentialGoals(goals) {
    var n = normalizeGoals(goals);
    var hasEssential = n.some(function (g) {
      return g.status === 'active' && !!(g.category || g.type) && !!(g.title && g.title.trim());
    });
    var errors = {};
    if (!hasEssential) errors._goal = 'Wähle ein Ziel aus. Du kannst es später jederzeit ändern oder ergänzen.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  // ---- Migration v1 → v2 (kein Datenverlust; unbekannte Altfelder unter _legacy erhalten) ----
  function migrateProfile(old, now) {
    now = now || nowISO();
    old = old || {};
    if (old.version === SCHEMA_VERSION && old.goals) return normalizeProfile(old, now);   // bereits v2
    var goals = [];
    if (old.primaryGoal || old.primaryGoalLabel) {
      goals.push(normalizeGoal({ title: old.primaryGoalLabel || old.raceName || String(old.primaryGoal), category: mapLegacyGoal(old.primaryGoal), priority: 1, status: 'active',
        targetDate: old.raceDate || null, targetValue: old.hmTargetMin || null, unit: old.hmTargetMin ? 'min' : null, timeHorizon: old.raceDate ? 'mid' : 'open' }, now));
    }
    (old.secondaryGoals || []).forEach(function (s, i) { if (s == null || s === '') return; goals.push(normalizeGoal({ title: String(s), category: 'custom', priority: i === 0 ? 2 : 3, status: 'active', timeHorizon: 'long' }, now)); });
    var prof = {
      version: SCHEMA_VERSION,
      personal: { name: old.name || '', location: old.location || '', birthDate: old.birthDate || '', sex: old.sex || '', weightKg: old.weightKg != null ? old.weightKg : null, heightCm: old.heightCm != null ? old.heightCm : null, hfMax: old.hfMax != null ? old.hfMax : null, rhrBaseline: old.rhrBaseline != null ? old.rhrBaseline : null, sleepGoalH: old.sleepGoalH != null ? old.sleepGoalH : null, avatar: old.avatar || '' },
      sports: Array.isArray(old.sports) ? old.sports.map(function (s) { return (typeof s === 'string') ? { sportId: s, role: 'supplemental' } : s; }) : [],
      goals: normalizeGoals(goals, now),
      availability: old.availability || { weekly: {} },
      recovery: { focus: old.recoveryFocus || '', sleepGoalH: old.sleepGoalH != null ? old.sleepGoalH : null },
      constraints: Array.isArray(old.issues) ? old.issues.filter(function (x) { return x && x !== 'none' && x !== 'Keine'; }).map(function (r) { return (typeof r === 'string') ? { region: r, status: 'active' } : r; }) : [],
      preferences: { level: old.level || 'fortgeschritten', adaptationMode: old.adaptationMode || 'assisted', riskTolerance: old.riskTolerance || 'balanced', checkinMode: old.checkinMode || 'full' },
      devices: Array.isArray(old.dataSources) ? old.dataSources.slice() : ['Manuell'],
      onboarding: { completed: !!old.onboarded, completedAt: old.onboardedAt || null },
      updatedAt: now,
      _legacy: old   // verlustfreier Altbestand (für spätere Felder)
    };
    return prof;
  }
  function mapLegacyGoal(g) {
    var m = { health: 'long_term_health', halfmarathon: 'half_marathon', marathon: 'marathon', ironman: 'ironman', triathlon: 'triathlon',
      strength: 'get_stronger', hypertrophy: 'hypertrophy', fatloss: 'fat_loss', muscle: 'muscle_gain', performance: 'sport_performance', football: 'football' };
    return m[g] || 'custom';
  }
  function newProfile(now) { return migrateProfile({ version: 1 }, now); }
  function normalizeProfile(p, now) {
    now = now || nowISO(); p = p || {};
    return Object.assign({}, p, { version: SCHEMA_VERSION, goals: normalizeGoals(p.goals, now), updatedAt: p.updatedAt || now });
  }

  // ---- Zusammenfassung (für Review-Screen) ----
  function buildSummary(profile) {
    profile = profile || {}; var goals = (profile.goals || []).filter(function (g) { return g.status === 'active'; });
    goals = goals.slice().sort(function (a, b) { return a.priority - b.priority; });
    var primary = goals[0] || null;
    return {
      primaryGoal: primary ? primary.title : null,
      otherGoals: goals.slice(1).map(function (g) { return g.title; }),
      sports: (profile.sports || []).map(function (s) { return s.sportId || s.customName || s; }),
      constraints: (profile.constraints || []).filter(function (c) { return c.status !== 'resolved'; }).map(function (c) { return c.region || c; }),
      conflicts: detectGoalConflicts(profile.goals)
    };
  }
  // Felder, deren Änderung spätere Pläne beeinflusst (für den Auswirkungsdialog).
  var PLAN_IMPACT_FIELDS = ['primaryGoal', 'targetDate', 'sports', 'availability', 'constraints', 'level'];

  // ---- Legacy-Projektion: aus goals[] die alten PROFILE-Zielfelder ableiten (ZENTRAL, lesend). ----
  // Höchste aktive Priorität → primaryGoal; weitere aktive → secondaryGoals. Pausiert/erreicht/archiviert
  // werden NICHT als aktiv projiziert. KEINE Rückschreibung aus der Projektion ins Modell.
  function legacyGoalKey(category) {
    var inv = { long_term_health: 'health', wellbeing: 'health', keep_fit: 'health', half_marathon: 'halfmarathon', marathon: 'marathon',
      ironman: 'ironman', triathlon: 'triathlon', get_stronger: 'strength', hypertrophy: 'hypertrophy', lift_pr: 'strength',
      fat_loss: 'fatloss', shredded: 'fatloss', weight_loss: 'fatloss', target_bodyfat: 'fatloss', muscle_gain: 'muscle', muscle_maintain: 'muscle',
      football: 'football' };
    return inv[category] || 'health';
  }
  function buildLegacyProjection(profile) {
    var active = (profile && profile.goals || []).filter(function (g) { return g.status === 'active'; }).slice().sort(function (a, b) { return a.priority - b.priority; });
    var primary = active[0] || null;
    return {
      primaryGoal: primary ? legacyGoalKey(primary.category) : 'health',
      primaryGoalLabel: primary ? primary.title : 'Allgemeine Gesundheit',
      secondaryGoals: active.slice(1).map(function (g) { return g.title; }),
      raceDate: (primary && primary.targetDate) ? primary.targetDate : '',
      hmTargetMin: (primary && primary.category === 'half_marathon' && primary.unit === 'min') ? primary.targetValue : null
    };
  }
  // Rollen ↔ numerische Priorität (verständliche Rollen in der UI; intern Zahl).
  var ROLE_TO_PRIORITY = { main: 1, secondary: 2, maintain: 3, longterm: 4 };
  var PRIORITY_TO_ROLE = { 1: 'main', 2: 'secondary', 3: 'maintain', 4: 'longterm' };
  function roleOfGoal(g) { return PRIORITY_TO_ROLE[g.priority] || 'longterm'; }
  function priorityOfRole(role) { return ROLE_TO_PRIORITY[role] || 4; }

  // ---- Spezialfeld-Schemas je Zielkategorie (deklarativ → UI rendert generisch, KEINE if/else-Kette) ----
  // Feld: {key,label,type,options?,unit?}. type: text|longtext|number|date|select|multi|bool.
  var GOAL_CATEGORY_FIELDS = {
    shredded: [
      { key: 'currentWeight', label: 'Aktuelles Gewicht', type: 'number', unit: 'kg' },
      { key: 'targetWeight', label: 'Zielgewicht (optional)', type: 'number', unit: 'kg' },
      { key: 'currentBodyFat', label: 'Aktueller Körperfettanteil (optional)', type: 'number', unit: '%' },
      { key: 'targetBodyFat', label: 'Ziel-Körperfettanteil (optional)', type: 'number', unit: '%' },
      { key: 'definitionLevel', label: 'Gewünschter Definitionsgrad', type: 'select', options: ['sichtbar definiert', 'athletisch definiert', 'sehr definiert'] },
      { key: 'maintainMuscle', label: 'Muskulatur erhalten', type: 'bool' },
      { key: 'buildMuscle', label: 'Zusätzlich Muskulatur aufbauen', type: 'bool' },
      { key: 'strengthVolume', label: 'Aktueller Krafttrainingsumfang', type: 'select', options: ['kein', '1–2×/Woche', '3–4×/Woche', '5+×/Woche'] },
      { key: 'enduranceVolume', label: 'Aktueller Ausdauerumfang', type: 'select', options: ['kein', 'gering', 'mittel', 'hoch'] },
      { key: 'timeframe', label: 'Gewünschter Zeitraum', type: 'select', options: ['8 Wochen', '12 Wochen', '16 Wochen', '6 Monate', 'offen'] },
      { key: 'deficitKnown', label: 'Kaloriendefizit bekannt', type: 'bool' },
      { key: 'energyLevel', label: 'Durchschnittliches Energieniveau', type: 'select', options: ['niedrig', 'mittel', 'hoch'] },
      { key: 'sleepQuality', label: 'Schlafqualität', type: 'select', options: ['schlecht', 'okay', 'gut'] },
      { key: 'recovery', label: 'Regeneration', type: 'select', options: ['schlecht', 'okay', 'gut'] },
      { key: 'keepPerformance', label: 'Leistungsfähigkeit soll erhalten bleiben', type: 'bool' },
      { key: 'complaints', label: 'Relevante Beschwerden', type: 'text' }
    ],
    triathlon: [
      { key: 'distance', label: 'Distanz', type: 'select', options: ['Sprint', 'olympisch', 'Mitteldistanz', 'Langdistanz/Ironman'] },
      { key: 'mode', label: 'Ziel', type: 'select', options: ['absolvieren', 'Zielzeit'] },
      { key: 'pastRaces', label: 'Bisherige Wettkämpfe', type: 'text' },
      { key: 'swimLevel', label: 'Schwimmniveau', type: 'select', options: ['Anfänger', 'fortgeschritten', 'erfahren'] },
      { key: 'bikeLevel', label: 'Radniveau', type: 'select', options: ['Anfänger', 'fortgeschritten', 'erfahren'] },
      { key: 'runLevel', label: 'Laufniveau', type: 'select', options: ['Anfänger', 'fortgeschritten', 'erfahren'] },
      { key: 'weakestDiscipline', label: 'Schwächste Disziplin', type: 'select', options: ['Schwimmen', 'Rad', 'Laufen'] },
      { key: 'weeklyHours', label: 'Trainingsstunden pro Woche', type: 'number', unit: 'h' },
      { key: 'poolAccess', label: 'Schwimmbadzugang', type: 'bool' },
      { key: 'openWater', label: 'Freiwasserzugang', type: 'bool' },
      { key: 'hasBike', label: 'Fahrrad vorhanden', type: 'bool' },
      { key: 'hasTrainer', label: 'Indoor-Trainer vorhanden', type: 'bool' },
      { key: 'longestSwim', label: 'Längste Schwimmeinheit', type: 'number', unit: 'm' },
      { key: 'longestBike', label: 'Längste Radeinheit', type: 'number', unit: 'km' },
      { key: 'longestRun', label: 'Längste Laufeinheit', type: 'number', unit: 'km' },
      { key: 'injuries', label: 'Verletzungen/Einschränkungen', type: 'text' }
    ],
    football: [
      { key: 'position', label: 'Position', type: 'text' },
      { key: 'league', label: 'Liga/Leistungsniveau', type: 'text' },
      { key: 'teamDays', label: 'Mannschaftstrainingstage', type: 'number' },
      { key: 'matchDay', label: 'Spieltag', type: 'select', options: ['Samstag', 'Sonntag', 'unter der Woche', 'wechselnd'] },
      { key: 'gameMinutes', label: 'Typische Spielminuten', type: 'number', unit: 'min' },
      { key: 'seasonPhase', label: 'Saisonphase', type: 'select', options: ['Vorbereitung', 'Saison', 'Winterpause', 'Sommerpause', 'Wiedereinstieg'] },
      { key: 'extraDays', label: 'Zusätzliche eigene Trainingstage', type: 'number' },
      { key: 'weaknesses', label: 'Aktuelle Schwächen', type: 'text' },
      { key: 'complaints', label: 'Aktuelle Beschwerden', type: 'text' },
      { key: 'strengthSupport', label: 'Krafttraining als Ergänzung', type: 'bool' },
      { key: 'load', label: 'Belastung durch Spiele/Teamtraining', type: 'select', options: ['gering', 'mittel', 'hoch'] }
      // Mehrfachauswahl 'focus' (Leistungsbereiche) kommt aus sportFollowupSchema('football').focusOptions
    ],
    running: [
      { key: 'distance', label: 'Distanz', type: 'select', options: ['5 km', '10 km', 'Halbmarathon', 'Marathon', 'Ultra'] },
      { key: 'level', label: 'Aktueller Leistungsstand', type: 'select', options: ['Einsteiger', 'fortgeschritten', 'ambitioniert'] },
      { key: 'currentBest', label: 'Aktuelle Bestzeit', type: 'text' },
      { key: 'targetTime', label: 'Zielzeit', type: 'text' },
      { key: 'raceDate', label: 'Wettkampfdatum', type: 'date' },
      { key: 'weeklyKm', label: 'Wochenkilometer', type: 'number', unit: 'km' },
      { key: 'longestRun', label: 'Längster Lauf', type: 'number', unit: 'km' },
      { key: 'runDays', label: 'Lauftage', type: 'number' },
      { key: 'surface', label: 'Untergrund', type: 'select', options: ['Straße', 'Trail', 'gemischt', 'Bahn'] },
      { key: 'injuryHistory', label: 'Verletzungshistorie', type: 'text' }
    ],
    strength: [
      { key: 'focus', label: 'Schwerpunkt', type: 'select', options: ['Muskelaufbau', 'Kraft', 'Erhalt', 'Recomposition'] },
      { key: 'trainingDays', label: 'Trainingstage', type: 'number' },
      { key: 'split', label: 'Trainingssplit', type: 'select', options: ['Ganzkörper', 'Ober-/Unterkörper', 'Push/Pull/Legs', 'Splits'] },
      { key: 'trainingYears', label: 'Trainingsjahre', type: 'number' },
      { key: 'equipment', label: 'Verfügbare Geräte', type: 'text' },
      { key: 'musclePriorities', label: 'Priorisierte Muskeln', type: 'text' },
      { key: 'preferredExercises', label: 'Priorisierte Übungen', type: 'text' },
      { key: 'knownLifts', label: 'Bekannte Kraftwerte', type: 'text' },
      { key: 'limitations', label: 'Einschränkungen', type: 'text' }
    ],
    cycling: [
      { key: 'type', label: 'Disziplin', type: 'select', options: ['Straße', 'Gravel', 'MTB', 'Indoor'] },
      { key: 'weeklyKm', label: 'Aktuelle Wochenkilometer', type: 'number', unit: 'km' },
      { key: 'longestRide', label: 'Längste Ausfahrt', type: 'number', unit: 'km' },
      { key: 'perfGoal', label: 'Leistungsziel', type: 'text' },
      { key: 'mode', label: 'Wettkampf oder Freizeit', type: 'select', options: ['Wettkampf', 'Freizeit'] },
      { key: 'hasPower', label: 'Leistungsdaten vorhanden', type: 'bool' },
      { key: 'hasTrainer', label: 'Indoor-Trainer', type: 'bool' }
    ],
    swimming: [
      { key: 'env', label: 'Pool oder Freiwasser', type: 'select', options: ['Pool', 'Freiwasser', 'beides'] },
      { key: 'level', label: 'Schwimmniveau', type: 'select', options: ['Anfänger', 'fortgeschritten', 'erfahren'] },
      { key: 'currentDistance', label: 'Aktuelle Distanz', type: 'number', unit: 'm' },
      { key: 'targetDistance', label: 'Zielstrecke', type: 'number', unit: 'm' },
      { key: 'techniqueGoal', label: 'Technikziel', type: 'text' },
      { key: 'raceGoal', label: 'Wettkampfziel', type: 'text' },
      { key: 'poolLength', label: 'Beckenlänge', type: 'select', options: ['25 m', '50 m', 'anderes'] },
      { key: 'frequency', label: 'Trainingshäufigkeit', type: 'number' }
    ]
  };
  var CATEGORY_FIELD_KEY = {
    shredded: 'shredded', fat_loss: 'shredded', target_bodyfat: 'shredded', weight_loss: 'shredded',
    triathlon: 'triathlon', ironman: 'triathlon',
    football: 'football', handball: 'football', basketball: 'football',
    run_5k: 'running', run_10k: 'running', half_marathon: 'running', marathon: 'running',
    get_stronger: 'strength', hypertrophy: 'strength', lift_pr: 'strength', strength_endurance: 'strength',
    functional_strength: 'strength', explosive_strength: 'strength', muscle_gain: 'strength', muscle_maintain: 'strength', recomposition: 'strength',
    cycling_race: 'cycling', swim_goal: 'swimming'
  };
  function categoryFieldsFor(category) { var k = CATEGORY_FIELD_KEY[category]; return k ? GOAL_CATEGORY_FIELDS[k].slice() : []; }

  // ---- Ungespeicherte Änderungen erkennen: struktureller Vergleich (nicht nur Boolean-Flag) ----
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stableStringify(v[k]); }).join(',') + '}';
  }
  function diffState(a, b) { return stableStringify(a) !== stableStringify(b); }

  // ---- Plan-Impact-Bündelung: mehrere Änderungen einer Sitzung → ein Eintrag ----
  function bundlePlanImpact(existing, reason, fields) {
    var now = nowISO();
    var f = (existing && existing.fields) ? existing.fields.slice() : [];
    (fields || []).forEach(function (x) { if (f.indexOf(x) < 0) f.push(x); });
    if (reason && f.indexOf(reason) < 0) f.push(reason);
    return { pending: true, reason: (existing && existing.reason) || reason || 'profile_change', fields: f,
      userDecision: (existing && existing.userDecision) || null, createdAt: (existing && existing.createdAt) || now, updatedAt: now };
  }

  // ---- Editierbare Profilbereiche (Schema → eigenständige Karten/Editoren) ----
  var WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var PROFILE_SECTIONS = [
    { id: 'personal', label: 'Persönliche Grunddaten', planImpact: false },
    { id: 'sports', label: 'Sportarten', planImpact: true },
    { id: 'goals', label: 'Ziele', planImpact: true },
    { id: 'availability', label: 'Trainingsverfügbarkeit', planImpact: true },
    { id: 'body', label: 'Körper und Leistungsstand', planImpact: false },
    { id: 'recovery', label: 'Regeneration und Alltag', planImpact: false },
    { id: 'constraints', label: 'Beschwerden und Einschränkungen', planImpact: true },
    { id: 'preferences', label: 'Trainingspräferenzen', planImpact: false },
    { id: 'devices', label: 'Geräte und Datenquellen', planImpact: false }
  ];
  var CONSTRAINT_STATUSES = ['active', 'improved', 'resolved', 'observed'];
  var BODY_REGIONS = [['head_neck', 'Kopf/Nacken'], ['shoulder', 'Schulter'], ['elbow', 'Ellenbogen'], ['wrist_hand', 'Handgelenk/Hand'], ['chest', 'Brust'], ['back', 'Rücken'], ['hip', 'Hüfte'], ['thigh', 'Oberschenkel'], ['knee', 'Knie'], ['lower_leg', 'Unterschenkel'], ['ankle', 'Sprunggelenk'], ['foot', 'Fuß'], ['other', 'Andere']];
  var BODY_SIDES = [['left', 'Links'], ['right', 'Rechts'], ['both', 'Beidseitig'], ['central', 'Mittig'], ['na', 'Nicht zutreffend']];
  function normalizeConstraint(c, now) {
    c = c || {}; now = now || nowISO();
    return { id: c.id || uid('cstr'), bodyRegion: c.bodyRegion || c.region || '', side: c.side || 'na', title: c.title || '', intensity: c.intensity != null ? c.intensity : null,
      triggers: c.triggers || '', affectedActivities: Array.isArray(c.affectedActivities) ? c.affectedActivities.slice() : [], avoidMovements: c.avoidMovements || '',
      startedAt: c.startedAt || c.since || '', since: c.startedAt || c.since || '', medicallyChecked: !!c.medicallyChecked, currentlyTrainable: c.currentlyTrainable != null ? !!c.currentlyTrainable : true,
      adaptations: c.adaptations || '', notes: c.notes || c.adaptations || '', status: CONSTRAINT_STATUSES.indexOf(c.status) >= 0 ? c.status : 'active', updatedAt: now };
  }
  // ---- Regeneration & Alltag (strukturiert; alte Freitexte unter _legacyText) ----
  function normalizeRecovery(r, legacy) {
    r = r || {}; var sl = r.sleep || {}, st = r.stress || {}, wp = r.workPattern || {}, ns = r.nutritionState || {}, rp = r.recoveryPreferences || {};
    var out = {
      sleep: { averageHours: r.sleepHours != null ? r.sleepHours : (sl.averageHours != null ? sl.averageHours : null), quality: sl.quality || r.sleepQuality || '', consistency: sl.consistency || '', bedtime: sl.bedtime || '', wakeTime: sl.wakeTime || '' },
      stress: { generalLevel: st.generalLevel || r.stress || '', workSchoolLevel: st.workSchoolLevel || r.workload || '' },
      workPattern: { type: wp.type || '', shiftType: wp.shiftType || '', physicallyDemanding: wp.physicallyDemanding || (r.shiftWork ? 'partly' : '') },
      nutritionState: { mode: ns.mode || '', energyAvailabilityLimited: !!ns.energyAvailabilityLimited },
      recoveryPreferences: { preferredRestDays: Array.isArray(rp.preferredRestDays) ? rp.preferredRestDays.slice() : [], activeRecoveryAllowed: rp.activeRecoveryAllowed != null ? !!rp.activeRecoveryAllowed : true },
      _legacyText: r._legacyText || null, updatedAt: r.updatedAt || nowISO()
    };
    if (legacy && (legacy.nutrition || legacy.restDayPref || legacy.recoveryPrefs) && !out._legacyText) out._legacyText = { nutrition: legacy.nutrition || '', restDayPref: legacy.restDayPref || '', recoveryPrefs: legacy.recoveryPrefs || '' };
    return out;
  }
  // ---- Trainingspräferenzen (strukturiert) ----
  function normalizePreferences(p, legacy) {
    p = p || {};
    var out = {
      preferredSports: Array.isArray(p.preferredSports) ? p.preferredSports.slice() : [],
      dislikedTrainingForms: Array.isArray(p.dislikedTrainingForms) ? p.dislikedTrainingForms.slice() : [],
      dislikedCustom: p.dislikedCustom || '',
      preferredSessionDurations: (Array.isArray(p.preferredSessionDurations) ? p.preferredSessionDurations : []).map(function (x) { return parseInt(x, 10); }).filter(function (x) { return !isNaN(x); }),
      preferredEnvironment: p.preferredEnvironment || '',
      preferredTimes: Array.isArray(p.preferredTimes) ? p.preferredTimes.slice() : [],
      intensityPreference: p.intensityPreference || '',
      socialPreference: p.socialPreference || '',
      avoidedExercises: (Array.isArray(p.avoidedExercises) ? p.avoidedExercises : []).map(function (e) { return { exerciseId: e.exerciseId || null, exerciseName: e.exerciseName || '', reason: e.reason || '', constraintId: e.constraintId || null }; }),
      varietyPreference: p.varietyPreference || '',
      coachingStyle: p.coachingStyle || '',
      _legacyText: p._legacyText || null, updatedAt: p.updatedAt || nowISO()
    };
    if (legacy && (legacy.dislikedForms || legacy.indoorOutdoor || legacy.trainingTimes || legacy.avoidExercises) && !out._legacyText) out._legacyText = { dislikedForms: legacy.dislikedForms || '', environment: legacy.indoorOutdoor || '', times: legacy.trainingTimes || '', avoid: legacy.avoidExercises || '' };
    return out;
  }
  // Verfügbarkeit pro Wochentag normalisieren (vorhandene Werte erhalten).
  var INTENSITY_VALUES = ['easy', 'moderate', 'intense'];
  function clampDuration(v) { var n = (v == null || v === '') ? null : parseInt(v, 10); if (n == null || isNaN(n) || n <= 0) return null; return Math.min(n, 600); }
  function normalizeSlot(s) {
    s = s || {};
    return { preferredTime: s.preferredTime || '', maxMinutes: clampDuration(s.maxMinutes), preferredSports: Array.isArray(s.preferredSports) ? s.preferredSports.slice() : [],
      intensityAllowed: INTENSITY_VALUES.indexOf(s.intensityAllowed) >= 0 ? s.intensityAllowed : 'moderate' };
  }
  // Doppeleinheit: IMMER zwei unabhängige Slots (Werte bleiben beim Deaktivieren erhalten); enabled separat.
  function normalizeDoubleSession(ds) {
    ds = ds || {}; var sess = Array.isArray(ds.sessions) ? ds.sessions : [];
    return { enabled: !!ds.enabled, sessions: [normalizeSlot(sess[0]), normalizeSlot(sess[1])] };
  }
  var FIXED_TYPES = ['team_training', 'match', 'fixed_session', 'work_school', 'appointment', 'other_load'];
  function normalizeFixedCommitment(c) {
    c = c || {};
    return { id: c.id || uid('fix'), type: FIXED_TYPES.indexOf(c.type) >= 0 ? c.type : 'other_load', sportId: c.sportId || null,
      startTime: c.startTime || '', durationMinutes: clampDuration(c.durationMinutes), intensity: INTENSITY_VALUES.indexOf(c.intensity) >= 0 ? c.intensity : 'moderate', fixed: c.fixed != null ? !!c.fixed : true };
  }
  function normalizeDay(w) {
    w = w || {};
    var restDay = !!w.restDay;
    // Legacy-Flachwerte (timeOfDay/maxMinutes/intense) in singleSession migrieren, falls kein neuer Slot vorhanden.
    var single = w.singleSession ? normalizeSlot(w.singleSession)
      : normalizeSlot({ preferredTime: w.timeOfDay || '', maxMinutes: w.maxMinutes, intensityAllowed: w.intense === false ? 'moderate' : (w.intense ? 'intense' : 'moderate') });
    var dbl = normalizeDoubleSession(w.doubleSession != null && typeof w.doubleSession === 'object' ? w.doubleSession : { enabled: !!w.doubleSession });
    if (restDay) dbl.enabled = false;  // Ruhetag und Doppeleinheit schließen sich aus
    return {
      available: restDay ? false : (w.available != null ? !!w.available : true),   // Ruhetag ↔ verfügbare Einheit exklusiv
      restDay: restDay,
      singleSession: single,
      doubleSession: dbl,
      fixedCommitments: (Array.isArray(w.fixedCommitments) ? w.fixedCommitments : []).map(normalizeFixedCommitment)
    };
  }
  function availabilitySummary(av) {
    av = normalizeAvailability(av); var avail = 0, dbl = 0;
    WEEKDAYS.forEach(function (d) { var w = av.days[d]; if (w.available && !w.restDay) avail++; if (w.doubleSession.enabled) dbl++; });
    return { availableDays: avail, maxSessionsPerWeek: av.maxSessionsPerWeek, doubleDays: dbl, preferredRestDays: av.preferredRestDays.slice() };
  }
  function normalizeAvailability(av) {
    av = av || {}; var src = av.days || av.weekly || {}; var days = {};
    WEEKDAYS.forEach(function (d) { days[d] = normalizeDay(src[d]); });
    return { days: days,
      maxSessionsPerWeek: av.maxSessionsPerWeek != null ? av.maxSessionsPerWeek : (av.maxSessions != null ? av.maxSessions : null),
      maxIntenseSessions: av.maxIntenseSessions != null ? av.maxIntenseSessions : (av.maxIntense != null ? av.maxIntense : null),
      preferredRestDays: Array.isArray(av.preferredRestDays) ? av.preferredRestDays.slice() : [],
      minimumFullRestDays: av.minimumFullRestDays != null ? av.minimumFullRestDays : (av.desiredRestDays != null ? av.desiredRestDays : null),
      updatedAt: av.updatedAt || nowISO() };
  }

  /* ============================================================
     INKREMENT 4b — Gemeinsames Profilfundament: konsolidierte Normalisierer für alle
     Profilbereiche (Sport, Verfügbarkeit, Performance, Geräte/Integrationen, Beschwerden),
     Daten-Nutzungsmatrix, zentrale Konsolidierung. Alles rein/idempotent/nicht-mutierend.
     ============================================================ */

  // ---- Sportmodell ----
  function normalizeSport(raw, now) {
    raw = raw || {}; now = now || nowISO();
    if (typeof raw === 'string') raw = { sportId: raw };
    var id = raw.sportId || raw.id || null;
    var custom = raw.customName || (id ? null : (raw.name || null));
    return {
      sportId: id || (custom ? ('custom:' + String(custom).toLowerCase().replace(/\s+/g, '_')) : 'sport:' + Math.random().toString(36).slice(2, 7)),
      customName: custom || null,
      role: raw.role || 'supplemental',                 // primary | secondary | supplemental | occasional
      activeInApp: raw.activeInApp != null ? !!raw.activeInApp : true,
      includeInPlan: raw.includeInPlan != null ? !!raw.includeInPlan : false,
      level: raw.level != null ? raw.level : null,
      sessionsPerWeek: raw.sessionsPerWeek != null ? raw.sessionsPerWeek : null,
      preferredDays: Array.isArray(raw.preferredDays) ? raw.preferredDays.slice() : [],
      typicalDuration: raw.typicalDuration != null ? raw.typicalDuration : null,
      seasonPhase: raw.seasonPhase || null,
      sportProfile: raw.sportProfile ? normalizeSportProfile(id || (custom ? 'custom' : null), raw.sportProfile) : null,
      updatedAt: raw.updatedAt || now
    };
  }
  function normalizeSports(list, now) {
    var arr = Array.isArray(list) ? list : [];
    var seen = {}, out = [];
    arr.forEach(function (s) { var n = normalizeSport(s, now); var key = String(n.sportId).toLowerCase(); if (seen[key]) return; seen[key] = true; out.push(n); });
    return out;
  }


  // ---- Performance (strukturiert; alte Freitexte unter _legacyText erhalten) ----
  var PERF_SOURCES = ['manual', 'garmin', 'strava', 'apple_health', 'import', 'calculated'];
  var SET_TYPES = ['working', 'top_set', 'test', 'estimated_1rm'];
  function _src(s) { return PERF_SOURCES.indexOf(s) >= 0 ? s : 'manual'; }
  function _num(v) { return (v == null || v === '' || isNaN(parseFloat(v))) ? null : parseFloat(v); }
  function _posOrNull(v) { var n = _num(v); return (n != null && n > 0) ? n : null; }
  // Zeit/Pace zentral: intern Sekunden. parseDuration("7:20"/"1:15:00") → s; formatDuration(s) → mm:ss / h:mm:ss.
  function parseDuration(str) { if (str == null || str === '') return null; if (typeof str === 'number') return str > 0 ? str : null; var parts = String(str).trim().split(':').map(Number); if (parts.some(isNaN)) return null; var s = 0; parts.forEach(function (p) { s = s * 60 + p; }); return s > 0 ? s : null; }
  function formatDuration(sec) { if (sec == null || sec <= 0) return ''; sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; var pad = function (x) { return String(x).padStart(2, '0'); }; return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (m + ':' + pad(s)); }
  function parsePace(str) { return parseDuration(str); }
  function formatPace(sec) { return formatDuration(sec); }
  function estimate1RM(weightKg, reps) { var w = _posOrNull(weightKg), r = parseInt(reps, 10); if (w == null || !(r >= 1) || r > 30) return null; return Math.round(w * (1 + r / 30) * 10) / 10; }  // Epley, gerundet (Schätzung)
  function normalizePerfMetric(m) { m = m || {}; return { value: m.value != null ? m.value : null, unit: m.unit || null, sportId: m.sportId || null, source: _src(m.source), measuredAt: m.measuredAt || null }; }
  function normalizeWeightEntry(e) { e = e || {}; return { id: e.id || uid('w'), valueKg: _posOrNull(e.valueKg), measuredAt: e.measuredAt || null, source: _src(e.source) }; }
  function normalizePersonalBest(b) { b = b || {}; return { id: b.id || uid('pb'), sportId: b.sportId || null, discipline: b.discipline || '', distance: b.distance || '', timeSeconds: _posOrNull(b.timeSeconds), context: b.context || '', measuredAt: b.measuredAt || null, source: _src(b.source), notes: b.notes || '', extra: (b.extra && typeof b.extra === 'object') ? b.extra : {} }; }
  function normalizeStrengthRecord(r) {
    r = r || {}; var w = _posOrNull(r.weightKg), reps = (r.repetitions != null && r.repetitions !== '') ? parseInt(r.repetitions, 10) : null;
    var setType = SET_TYPES.indexOf(r.setType) >= 0 ? r.setType : 'working';
    var est = r.estimatedOneRepMax != null ? _posOrNull(r.estimatedOneRepMax) : (setType !== 'estimated_1rm' ? estimate1RM(w, reps) : w);
    return { id: r.id || uid('sr'), exerciseId: r.exerciseId || null, exerciseName: r.exerciseName || '', weightKg: w, repetitions: (reps != null && !isNaN(reps)) ? reps : null, setType: setType, estimatedOneRepMax: est, oneRmEstimated: !!est && setType !== 'estimated_1rm', measuredAt: r.measuredAt || null, source: _src(r.source), notes: r.notes || '' };
  }
  function normalizePerformance(p, legacyBody) {
    p = p || {};
    var body = p.body || {};
    function bm(k, unit) { var m = normalizePerfMetric(body[k]); if (m.value != null && !m.unit) m.unit = unit; return m; }
    var out = {
      body: { height: bm('height', 'cm'), weight: bm('weight', 'kg'), bodyFat: bm('bodyFat', '%'), leanMass: bm('leanMass', 'kg'), waist: bm('waist', 'cm'), restingHr: bm('restingHr', 'bpm'), maxHr: bm('maxHr', 'bpm') },
      weightHistory: (Array.isArray(p.weightHistory) ? p.weightHistory : []).map(normalizeWeightEntry).filter(function (e) { return e.valueKg != null; }).sort(function (a, b) { return String(b.measuredAt || '').localeCompare(String(a.measuredAt || '')); }),
      vo2max: normalizePerfMetric(p.vo2max),
      restingHr: normalizePerfMetric(p.restingHr),
      maxHr: normalizePerfMetric(p.maxHr),
      ftp: Object.assign(normalizePerfMetric(p.ftp), { valueWatts: _posOrNull(p.ftp && p.ftp.valueWatts), wattsPerKg: _posOrNull(p.ftp && p.ftp.wattsPerKg) }),
      thresholdPace: Object.assign(normalizePerfMetric(p.thresholdPace), { secondsPerKm: _posOrNull(p.thresholdPace && p.thresholdPace.secondsPerKm) }),
      cssPace: Object.assign(normalizePerfMetric(p.cssPace), { secondsPer100m: _posOrNull(p.cssPace && p.cssPace.secondsPer100m) }),
      rowing2k: Object.assign(normalizePerfMetric(p.rowing2k), { timeSeconds: _posOrNull(p.rowing2k && p.rowing2k.timeSeconds) }),
      hyroxBest: Object.assign(normalizePerfMetric(p.hyroxBest), { category: (p.hyroxBest && p.hyroxBest.category) || null, timeSeconds: _posOrNull(p.hyroxBest && p.hyroxBest.timeSeconds) }),
      bodyFat: normalizePerfMetric(p.bodyFat),
      personalBests: (Array.isArray(p.personalBests) ? p.personalBests : []).map(normalizePersonalBest),
      strengthRecords: (Array.isArray(p.strengthRecords) ? p.strengthRecords : []).map(normalizeStrengthRecord),
      otherMetrics: Array.isArray(p.otherMetrics) ? p.otherMetrics.slice() : [],
      _legacyText: p._legacyText || null
    };
    if (legacyBody && (legacyBody.bestTimes || legacyBody.lifts) && !out._legacyText) {
      out._legacyText = { bestTimes: legacyBody.bestTimes || '', lifts: legacyBody.lifts || '' };
    }
    return out;
  }
  // Aktuelles Gewicht: jüngster Verlaufseintrag, sonst body.weight.
  function currentWeightKg(perf) { perf = perf || {}; var wh = perf.weightHistory || []; if (wh.length) return wh[0].valueKg; return (perf.body && perf.body.weight && perf.body.weight.value) || null; }

  // ---- Geräte vs. Datenintegrationen (getrennt; KEINE Integration ohne echte Verbindung) ----
  var INTEGRATION_IDS = ['strava', 'garmin', 'appleHealth'];
  var INTEGRATION_STATUSES = ['not_available', 'not_connected', 'connecting', 'connected', 'permission_required', 'error', 'sync_paused'];
  // Echte Implementierung: kein OAuth-Autosync vorhanden, nur manueller Datei-/JSON-Import.
  // Daher Default-Status ehrlich: strava/garmin not_connected, appleHealth not_available (PWA ohne HealthKit).
  var INTEGRATION_DEFAULTS = { strava: 'not_connected', garmin: 'not_connected', appleHealth: 'not_available' };
  function normalizeIntegration(id, i) {
    i = i || {}; var st = INTEGRATION_STATUSES.indexOf(i.status) >= 0 ? i.status : (INTEGRATION_DEFAULTS[id] || 'not_connected');
    var connected = st === 'connected';
    var out = { status: st, connected: connected, lastSyncAt: connected ? (i.lastSyncAt || null) : (i.lastSyncAt || null), capabilities: connected && Array.isArray(i.capabilities) ? i.capabilities.slice() : [], accountLabel: connected ? (i.accountLabel || null) : null, errorCode: st === 'error' ? (i.errorCode || null) : null };
    if (id === 'appleHealth') out.permissionState = i.permissionState || null;
    return out;
  }
  function normalizeEquipment(e) { e = e || {}; return { id: e.id || uid('eq'), type: e.type || 'other', label: e.label || '', available: e.available != null ? !!e.available : true, locationId: e.locationId || null, notes: e.notes || '' }; }
  function normalizeTrainingLocation(l) { l = l || {}; return { id: l.id || uid('loc'), type: l.type || 'other', name: l.name || '', capabilities: Array.isArray(l.capabilities) ? l.capabilities.slice() : [], availableDays: Array.isArray(l.availableDays) ? l.availableDays.slice() : [], notes: l.notes || '' }; }
  function normalizeManualSource(m) { m = m || {}; return { id: m.id || uid('ms'), type: m.type || 'manual', label: m.label || '' }; }
  function normalizeDevices(d, legacyDataSources) {
    d = d || {};
    var integrations = {};
    INTEGRATION_IDS.forEach(function (k) { integrations[k] = normalizeIntegration(k, d.integrations && d.integrations[k]); });
    var legacyText = d._legacyText || null;
    if (legacyDataSources && !legacyText) {
      var arr = Array.isArray(legacyDataSources) ? legacyDataSources : String(legacyDataSources).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      legacyText = arr.filter(function (x) { return x && x.toLowerCase() !== 'manuell'; });
    }
    return {
      equipment: (Array.isArray(d.equipment) ? d.equipment : []).map(normalizeEquipment),
      trainingLocations: (Array.isArray(d.trainingLocations) ? d.trainingLocations : []).map(normalizeTrainingLocation),
      integrations: integrations,
      manualSources: (Array.isArray(d.manualSources) ? d.manualSources : []).map(normalizeManualSource),
      _legacyText: legacyText, updatedAt: d.updatedAt || nowISO()
    };
  }

  // ---- Beschwerden: einheitliche aktive Sicht aus constraintsList (reich) + issues[] (legacy keys) ----
  function activeConstraints(profile) {
    profile = profile || {};
    var rich = (Array.isArray(profile.constraintsList) ? profile.constraintsList : []).map(function (c) { return normalizeConstraint(c); });
    var byRegion = {}; rich.forEach(function (c) { if (c.bodyRegion) byRegion[c.bodyRegion] = true; });
    var out = rich.filter(function (c) { return c.status === 'active'; });
    // Legacy-Modulschlüssel (issues[]), die noch keine reiche Beschwerde haben → als leichte aktive Beschwerde ergänzen.
    (Array.isArray(profile.issues) ? profile.issues : []).forEach(function (k) {
      if (k && k !== 'none' && !byRegion[k]) out.push(normalizeConstraint({ bodyRegion: k, title: k, status: 'active' }));
    });
    return out;
  }
  // Legacy-Projektion issues[] aus constraintsList (aktive bodyRegions). Vereint beide Quellen.
  function constraintIssueKeys(profile) {
    var rich = (Array.isArray(profile && profile.constraintsList) ? profile.constraintsList : []);
    var richRegions = {}; rich.forEach(function (c) { if (c.bodyRegion) richRegions[c.bodyRegion] = c.status; });
    var keys = {};
    // In constraintsList geführte Regionen folgen DEREN Status (behoben/pausiert → raus).
    rich.forEach(function (c) { if (c.status === 'active' && c.bodyRegion) keys[c.bodyRegion] = true; });
    // Reine Startseiten-issues (nicht in constraintsList) bleiben unabhängig erhalten.
    (Array.isArray(profile && profile.issues) ? profile.issues : []).forEach(function (k) { if (k && k !== 'none' && !(k in richRegions)) keys[k] = true; });
    return Object.keys(keys);
  }

  /* ============================================================
     INKREMENT 4c — Sportartspezifische Profile: deklarative Schemas, Positionen/Rollen mit
     stabilen Codes, Leistungsanforderungen, Saison-/Belastungskontext, Positions-Demand-Matrix +
     Resolver. NUR Datenmodell/Resolver — KEINE Planerstellung, keine medizinischen Aussagen.
     ============================================================ */
  // Leistungs-Dimensionen (stabile Codes, deutsche Labels). Auch Schlüssel der Demand-Profile.
  var PERF_AREAS = {
    acceleration: 'Antritt', maxSpeed: 'Maximalsprint', repeatedSprint: 'Wiederholte Sprints', aerobicCapacity: 'Spielausdauer',
    changeOfDirection: 'Richtungswechsel', power: 'Explosivität', jumpAbility: 'Sprungkraft', maxStrength: 'Maximalkraft',
    strengthEndurance: 'Kraftausdauer', duelStrength: 'Zweikampfstärke', ballControlFatigued: 'Ballkontrolle unter Ermüdung',
    injuryPrevention: 'Verletzungsprävention', mobility: 'Beweglichkeit', recovery: 'Regeneration', agility: 'Agilität',
    contactStability: 'Kontaktstabilität', shootingFatigued: 'Wurfleistung unter Ermüdung', reaction: 'Reaktion', shoulderRobustness: 'Schulterbelastbarkeit',
    firstStep: 'Erster Schritt', footwork: 'Beinarbeit', repeatedIntense: 'Wiederholte intensive Aktionen', shoulderForearm: 'Schulter-/Unterarmbelastbarkeit',
    rotation: 'Rotationskraft', coreStability: 'Rumpfstabilität', coordination: 'Koordination',
    driver: 'Driver', irons: 'Eisen', shortGame: 'Kurzes Spiel', bunker: 'Bunker', putting: 'Putting', tournamentConsistency: 'Turnierkonstanz',
    throwPower: 'Wurfkraft',
    threshold: 'Schwelle', tempoHardness: 'Tempohärte', runningEconomy: 'Laufökonomie', loadTolerance: 'Belastungsverträglichkeit', vo2max: 'VO₂max',
    sprintPower: 'Sprintleistung', pedalingEconomy: 'Trittökonomie', climbing: 'Bergfähigkeit', technique: 'Technik', waterPosition: 'Wasserlage',
    pull: 'Zugkraft', breathing: 'Atemrhythmus', transition: 'Wechsel', nutritionStrategy: 'Verpflegungsstrategie',
    swimDiscipline: 'Schwimmen', bikeDiscipline: 'Radfahren', runDiscipline: 'Laufen',
    reactiveStrength: 'Reaktivkraft', lateralMovement: 'Laterale Bewegung', landingControl: 'Landekontrolle',
    lowBodyPosition: 'Tiefe Körperposition', stickPower: 'Schlagkraft', neckCoreStability: 'Nacken- und Rumpfstabilität',
    forearmRobustness: 'Unterarmbelastbarkeit', balance: 'Gleichgewicht',
    aerobicEndurance: 'Aerobe Ausdauer', anaerobicCapacity: 'Anaerobe Kapazität', muscularEndurance: 'Kraftausdauer', technicalSkill: 'Technische Fertigkeit',
    recoveryDemand: 'Regenerationsbedarf', hypertrophy: 'Hypertrophie', jointStability: 'Gelenkstabilität', movementQuality: 'Bewegungsqualität',
    legStrength: 'Beinkraft', rhythm: 'Rhythmus', surefootedness: 'Trittsicherheit', baseEndurance: 'Grundlagenausdauer', dailyActivity: 'Alltagsaktivität', activeRecovery: 'Aktive Regeneration',
    fingerStrength: 'Fingerkraft', pullStrength: 'Zugkraft', bodyTension: 'Körperspannung', gripEndurance: 'Griffausdauer', routeReading: 'Routenlesen', gripStrength: 'Griffkraft',
    bodyControl: 'Körperkontrolle', relaxation: 'Entspannung', jointMobility: 'Gelenkbeweglichkeit', activeMobility: 'Aktive Beweglichkeit', transitionFatigued: 'Übergänge unter Ermüdung', paceManagement: 'Pacing'
  };
  function perfLabel(k) { return PERF_AREAS[k] || k; }
  var SEASON_PHASES = [['preparation', 'Vorbereitung'], ['inseason', 'Saison'], ['winter_break', 'Winterpause'], ['summer_break', 'Sommerpause'], ['return', 'Wiedereinstieg'], ['rehab', 'Rehabilitation']];
  var LEVELS = [['recreational', 'Freizeit'], ['amateur', 'Amateur/Liga'], ['competitive', 'Wettkampf'], ['elite', 'Leistungssport']];

  // Fußball-Positionen + positionsabhängige Spielrollen (stabile Codes).
  var FOOTBALL_POSITIONS = [['goalkeeper', 'Torwart'], ['centre_back', 'Innenverteidiger'], ['full_back', 'Außenverteidiger'], ['wing_back', 'Schienenspieler'], ['defensive_midfield', 'Defensives Mittelfeld / Sechser'], ['central_midfield', 'Zentrales Mittelfeld / Achter'], ['attacking_midfield', 'Offensives Mittelfeld / Zehner'], ['winger', 'Flügelspieler'], ['striker', 'Mittelstürmer'], ['multi_position', 'Mehrere Positionen'], ['custom', 'Eigene Rolle']];
  var FOOTBALL_ROLES = {
    goalkeeper: [['classic_gk', 'Klassischer Torwart'], ['playmaking_gk', 'Mitspielender Torwart'], ['sweeper_keeper', 'Sweeper Keeper']],
    centre_back: [['classic_cb', 'Klassischer Innenverteidiger'], ['ball_playing_cb', 'Ballspielender Innenverteidiger'], ['aggressive_cb', 'Aggressiv vorrückender Verteidiger'], ['covering_cb', 'Absicherer']],
    full_back: [['defensive_fb', 'Defensiv'], ['balanced_fb', 'Ausgewogen'], ['overlapping_fb', 'Offensiv überlappend'], ['inverted_fb', 'Invers ins Mittelfeld']],
    wing_back: [['defensive_fb', 'Defensiv'], ['balanced_fb', 'Ausgewogen'], ['overlapping_fb', 'Offensiv überlappend']],
    defensive_midfield: [['six', 'Sechser'], ['ball_winner', 'Pressing-/Ballgewinnspieler'], ['deep_playmaker', 'Spielmacher']],
    central_midfield: [['six', 'Sechser'], ['box_to_box', 'Box-to-Box-Achter'], ['playmaker', 'Spielmacher'], ['attacking_eight', 'Offensiver Achter'], ['ball_winner', 'Pressing-/Ballgewinnspieler']],
    attacking_midfield: [['playmaker', 'Spielmacher'], ['attacking_eight', 'Offensiver Achter'], ['shadow_striker', 'Schattenstürmer']],
    winger: [['classic_winger', 'Klassischer Flügel'], ['inverted_winger', 'Inverser Flügel'], ['runner_winger', 'Tiefenläufer'], ['creative_winger', 'Kreativer Flügelspieler']],
    striker: [['target_man', 'Zielspieler'], ['runner_striker', 'Tiefenläufer'], ['link_striker', 'Mitspielender Stürmer'], ['pressing_striker', 'Pressingstürmer'], ['false_nine', 'Falsche Neun']],
    multi_position: [['custom', 'Eigene Rolle']],
    custom: [['custom', 'Eigene Rolle']]
  };

  // Zentrale, deklarative Sport-Schemas (label, Gruppen/Felder, Positionen, Rollen, Leistungsbereiche).
  function teamSchema(label, positions, rolesByPosition, perfKeys) {
    return { label: label, type: 'team', positions: positions, rolesByPosition: rolesByPosition || {}, roles: [],
      performancePriorities: perfKeys, seasonPhases: SEASON_PHASES,
      loadFields: ['teamSessionsPerWeek', 'matchDay', 'typicalMatchMinutes', 'lineupStatus', 'seasonPhase', 'extraSessions'] };
  }
  function fieldSchema(label, type, fields, perfKeys) { return { label: label, type: type, positions: [], rolesByPosition: {}, roles: [], fields: fields, performancePriorities: perfKeys || [] }; }
  var SPORT_PROFILE_SCHEMAS = {
    football: teamSchema('Fußball', FOOTBALL_POSITIONS, FOOTBALL_ROLES, ['acceleration', 'maxSpeed', 'repeatedSprint', 'aerobicCapacity', 'changeOfDirection', 'power', 'jumpAbility', 'maxStrength', 'strengthEndurance', 'duelStrength', 'ballControlFatigued', 'injuryPrevention', 'mobility', 'recovery']),
    basketball: (function () { var s = teamSchema('Basketball', [['point_guard', 'Point Guard'], ['shooting_guard', 'Shooting Guard'], ['small_forward', 'Small Forward'], ['power_forward', 'Power Forward'], ['center', 'Center'], ['multi_position', 'Mehrere Positionen']], {}, ['acceleration', 'changeOfDirection', 'agility', 'jumpAbility', 'repeatedSprint', 'contactStability', 'maxStrength', 'shootingFatigued', 'recovery']);
      var R = [['ball_handler', 'Ballhandler'], ['playmaker', 'Playmaker'], ['shooter', 'Shooter'], ['slasher', 'Slasher'], ['two_way', 'Two-Way-Spieler'], ['rebounder', 'Rebounder'], ['rim_protector', 'Rim Protector'], ['stretch_big', 'Stretch Big']];
      ['point_guard', 'shooting_guard', 'small_forward', 'power_forward', 'center', 'multi_position'].forEach(function (p) { s.rolesByPosition[p] = R; }); return s; })(),
    handball: (function () { var s = teamSchema('Handball', [['goalkeeper', 'Torwart'], ['left_wing', 'Linksaußen'], ['right_wing', 'Rechtsaußen'], ['left_back', 'Rückraum links'], ['centre_back_hb', 'Rückraum Mitte'], ['right_back', 'Rückraum rechts'], ['pivot', 'Kreis'], ['multi_position', 'Mehrere Positionen']], {}, ['throwPower', 'jumpAbility', 'acceleration', 'changeOfDirection', 'shoulderRobustness', 'contactStability', 'repeatedIntense', 'aerobicCapacity', 'recovery']);
      var field = [['playmaker', 'Spielmacher'], ['shooter', 'Distanzschütze'], ['breakthrough', 'Durchbruchspieler'], ['defender', 'Abwehrspezialist'], ['tempo', 'Tempospieler'], ['pivot_role', 'Kreisläufer']];
      var gk = [['classic_gk', 'Klassischer Torwart'], ['offensive_gk', 'Offensiver Torwart']];
      ['left_wing', 'right_wing', 'left_back', 'centre_back_hb', 'right_back', 'pivot', 'multi_position'].forEach(function (p) { s.rolesByPosition[p] = field; }); s.rolesByPosition.goalkeeper = gk; return s; })(),
    volleyball: (function () { var s = teamSchema('Volleyball', [['setter', 'Zuspiel'], ['outside_hitter', 'Außenangriff'], ['opposite', 'Diagonal'], ['middle_blocker', 'Mittelblock'], ['libero', 'Libero'], ['multi_position', 'Mehrere Positionen']], {}, ['jumpAbility', 'reactiveStrength', 'shoulderRobustness', 'lateralMovement', 'reaction', 'coreStability', 'landingControl', 'mobility', 'recovery']);
      var R = [['attacker', 'Angreifer'], ['blocker', 'Blockspieler'], ['defender', 'Abwehrspieler'], ['allround', 'Flexibel']];
      s.positions.forEach(function (p) { s.rolesByPosition[p[0]] = R; }); s.variants = ['Hallenvolleyball', 'Beachvolleyball'];
      s.variantPositions = { Hallenvolleyball: s.positions, Beachvolleyball: [['blocker', 'Blockspieler'], ['defender', 'Abwehrspieler'], ['flexible', 'Flexibel']] };
      s.variantPositions.Beachvolleyball.forEach(function (p) { s.rolesByPosition[p[0]] = R; }); return s; })(),
    hockey: (function () { var s = teamSchema('Hockey', [['goalkeeper', 'Torwart'], ['defence', 'Verteidigung'], ['midfield', 'Mittelfeld'], ['attack', 'Angriff'], ['multi_position', 'Mehrere Positionen']], {}, ['acceleration', 'repeatedSprint', 'changeOfDirection', 'aerobicCapacity', 'coreStability', 'lowBodyPosition', 'stickPower', 'recovery']);
      s.rolesByPosition.defence = [['defensive_def', 'Defensiver Verteidiger'], ['building_def', 'Aufbauender Verteidiger']];
      s.rolesByPosition.midfield = [['defensive_mid', 'Defensives Mittelfeld'], ['box_to_box', 'Box-to-Box-Mittelfeld'], ['playmaker', 'Kreativer Spielmacher']];
      s.rolesByPosition.attack = [['winger', 'Flügel'], ['striker', 'Mittelstürmer']]; s.rolesByPosition.goalkeeper = [['classic_gk', 'Klassischer Torwart']]; s.rolesByPosition.multi_position = [['custom', 'Eigene Rolle']]; s.variants = ['Feldhockey', 'Hallenhockey']; return s; })(),
    rugby: (function () { var s = teamSchema('Rugby', [['front_row', 'Front Row'], ['locks', 'Locks'], ['back_row', 'Back Row'], ['half_backs', 'Half Backs'], ['centres', 'Centres'], ['back_three', 'Back Three'], ['multi_position', 'Mehrere Positionen']], {}, ['maxStrength', 'power', 'maxSpeed', 'repeatedIntense', 'contactStability', 'aerobicCapacity', 'agility', 'neckCoreStability', 'recovery']);
      var R = [['ball_carrier', 'Ballträger'], ['tackler', 'Tackler'], ['breakdown', 'Breakdown-Spezialist'], ['playmaker', 'Spielmacher'], ['kicker', 'Kicker'], ['finisher', 'Finisher'], ['lineout', 'Lineout-Spezialist'], ['scrum', 'Scrum-Spezialist']];
      s.positions.forEach(function (p) { s.rolesByPosition[p[0]] = R; }); return s; })(),
    running: fieldSchema('Laufen', 'endurance', [['distance', 'Hauptziel', 'select', ['Allgemeine Fitness', '5 km', '10 km', 'Halbmarathon', 'Marathon', 'Trail', 'Ultra']], ['level', 'Leistungsniveau', 'select', ['Einsteiger', 'fortgeschritten', 'ambitioniert', 'Wettkampf']], ['weeklyKm', 'Aktuelle Wochenkilometer', 'number', 'km'], ['desiredWeeklyKm', 'Gewünschte Wochenkilometer', 'number', 'km'], ['longestRun', 'Längster aktueller Lauf', 'number', 'km'], ['runDays', 'Lauftage/Woche', 'number'], ['surface', 'Bevorzugter Untergrund', 'select', ['Straße', 'Bahn', 'Trail', 'Laufband', 'gemischt']], ['targetTime', 'Zielzeit (optional)', 'text'], ['raceDate', 'Wettkampfdatum (optional)', 'date'], ['preferredForms', 'Bevorzugte Trainingsformen', 'text'], ['injuryHistory', 'Beschwerden/Einschränkungen', 'text']], ['aerobicCapacity', 'threshold', 'tempoHardness', 'runningEconomy', 'maxSpeed', 'strengthEndurance', 'loadTolerance', 'recovery']),
    cycling: fieldSchema('Radfahren', 'endurance', [['type', 'Hauptvariante', 'select', ['Straße', 'Gravel', 'Mountainbike', 'Indoor', 'Zeitfahren', 'Freizeit']], ['level', 'Leistungsniveau', 'select', ['Einsteiger', 'fortgeschritten', 'ambitioniert', 'Wettkampf']], ['weeklyVolume', 'Wochenkilometer/-stunden', 'text'], ['longestRide', 'Längste aktuelle Ausfahrt', 'number', 'km'], ['ftp', 'FTP (optional)', 'number', 'W'], ['terrain', 'Bevorzugtes Gelände', 'select', ['flach', 'hügelig', 'bergig', 'gemischt']], ['hasTrainer', 'Indoor-Trainer vorhanden', 'bool'], ['hasPower', 'Powermeter vorhanden', 'bool'], ['mode', 'Wettkampf/Freizeit', 'select', ['Wettkampf', 'Freizeit']], ['preferredForms', 'Bevorzugte Einheiten', 'text']], ['aerobicCapacity', 'threshold', 'vo2max', 'sprintPower', 'strengthEndurance', 'pedalingEconomy', 'climbing', 'recovery']),
    swimming: fieldSchema('Schwimmen', 'endurance', [['env', 'Umfeld', 'select', ['Pool', 'Freiwasser', 'beides']], ['poolLength', 'Beckenlänge', 'select', ['25 m', '50 m', 'andere']], ['stroke', 'Hauptlage', 'select', ['Freistil', 'Brust', 'Rücken', 'Schmetterling', 'Lagen']], ['otherStrokes', 'Weitere Lagen', 'text'], ['level', 'Leistungsniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['typicalDistance', 'Typische Trainingsdistanz', 'number', 'm'], ['longestDistance', 'Längste aktuelle Distanz', 'number', 'm'], ['pace100', 'Pace pro 100 m (optional)', 'text'], ['techniqueFocus', 'Technikschwerpunkte', 'text'], ['raceGoal', 'Wettkampfziel', 'text'], ['swimDays', 'Trainingstage/Woche', 'number']], ['technique', 'waterPosition', 'aerobicCapacity', 'threshold', 'sprintPower', 'pull', 'breathing', 'recovery']),
    triathlon: fieldSchema('Triathlon', 'endurance', [['distance', 'Zieldistanz', 'select', ['Sprint', 'olympisch', 'Mitteldistanz', 'Langdistanz', 'Allgemeines Triathlontraining']], ['swimLevel', 'Schwimmniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['bikeLevel', 'Radniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['runLevel', 'Laufniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['strongestDiscipline', 'Stärkste Disziplin', 'select', ['Schwimmen', 'Rad', 'Laufen']], ['weakestDiscipline', 'Schwächste Disziplin', 'select', ['Schwimmen', 'Rad', 'Laufen']], ['weeklyHours', 'Verfügbare Wochenstunden', 'number', 'h'], ['poolAccess', 'Poolzugang', 'bool'], ['openWater', 'Freiwasserzugang', 'bool'], ['bikeType', 'Fahrradtyp', 'select', ['Rennrad', 'Triathlonrad', 'Gravel', 'anderes']], ['hasTrainer', 'Indoor-Trainer', 'bool'], ['pastRaces', 'Bisherige Wettkämpfe', 'text'], ['nextGoal', 'Nächstes Wettkampfziel', 'text'], ['raceDate', 'Wettkampfdatum (optional)', 'date']], ['swimDiscipline', 'bikeDiscipline', 'runDiscipline', 'transition', 'aerobicCapacity', 'threshold', 'loadTolerance', 'recovery', 'nutritionStrategy']),
    gym: fieldSchema('Krafttraining', 'strength', [['goal', 'Hauptziel', 'select', ['Muskelaufbau', 'Maximalkraft', 'Kraft erhalten', 'Recomposition', 'Explosivkraft', 'Sportartspezifische Kraft']], ['trainingYears', 'Trainingserfahrung (Jahre)', 'number'], ['trainingDays', 'Trainingstage/Woche', 'number'], ['split', 'Bevorzugter Split', 'select', ['Ganzkörper', 'Oberkörper/Unterkörper', 'Push/Pull/Beine', 'Muskelgruppen-Split', 'Individuell']], ['equipment', 'Verfügbare Ausstattung', 'text'], ['musclePriorities', 'Priorisierte Muskelgruppen', 'text'], ['preferredExercises', 'Priorisierte Übungen', 'text'], ['avoidExercises', 'Zu vermeidende Übungen', 'text'], ['limitations', 'Aktuelle Beschwerden', 'text'], ['linkedSports', 'Kraft für Sportarten', 'text']], ['maxStrength', 'hypertrophy', 'power', 'strengthEndurance', 'coreStability', 'jointStability', 'movementQuality', 'recovery']),
    tennis: fieldSchema('Tennis', 'racket', [['mode', 'Spielart', 'select', ['Einzel', 'Doppel', 'beides']], ['hand', 'Dominante Hand', 'select', ['Rechts', 'Links']], ['backhand', 'Rückhand', 'select', ['Einhändig', 'Beidhändig', 'Keine Angabe']], ['level', 'Niveau', 'select', ['Anfänger', 'Freizeit', 'Verein', 'Liga', 'Turnier']], ['surface', 'Bevorzugter Belag', 'select', ['Sand', 'Hartplatz', 'Rasen', 'Teppich', 'Indoor', 'gemischt']], ['playStyle', 'Spielstil', 'select', ['Offensiv', 'Defensiv', 'Allround', 'Serve-and-Volley', 'Grundlinienspiel']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['matchFrequency', 'Matchhäufigkeit', 'text'], ['complaints', 'Aktuelle Beschwerden', 'text']], ['reaction', 'firstStep', 'changeOfDirection', 'acceleration', 'stickPower', 'shoulderRobustness', 'forearmRobustness', 'rotation', 'aerobicCapacity', 'mobility']),
    padel: fieldSchema('Padel', 'racket', [['side', 'Bevorzugte Seite', 'select', ['Links', 'Rechts', 'Flexibel']], ['hand', 'Dominante Hand', 'select', ['Rechts', 'Links']], ['level', 'Niveau', 'select', ['Anfänger', 'Freizeit', 'Verein', 'Liga', 'Turnier']], ['context', 'Spielkontext', 'select', ['Freizeit', 'Training', 'Liga', 'Turnier']], ['playStyle', 'Spielrolle', 'select', ['Offensiv', 'Kontrolliert', 'Defensiv', 'Allround']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['matchFrequency', 'Matchhäufigkeit', 'text'], ['complaints', 'Aktuelle Beschwerden', 'text']], ['reaction', 'changeOfDirection', 'firstStep', 'power', 'shoulderRobustness', 'forearmRobustness', 'aerobicCapacity', 'mobility', 'rotation']),
    athletics: fieldSchema('Leichtathletik', 'endurance', [['disciplineGroup', 'Disziplingruppe', 'select', ['Sprint', 'Mittelstrecke', 'Langstrecke', 'Hürden', 'Sprung', 'Wurf', 'Mehrkampf']], ['mainDiscipline', 'Hauptdisziplin', 'select', ['60 m', '100 m', '200 m', '400 m', '800 m', '1.500 m', '3.000 m', '5.000 m', '10.000 m', 'Hürdensprint', '400 m Hürden', 'Hochsprung', 'Weitsprung', 'Dreisprung', 'Stabhochsprung', 'Kugelstoßen', 'Diskus', 'Speerwurf', 'Hammerwurf', 'Mehrkampf']], ['secondaryDisciplines', 'Sekundäre Disziplinen', 'text'], ['level', 'Niveau', 'select', ['Freizeit', 'Verein', 'Wettkampf', 'Leistungssport']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['currentBest', 'Aktuelle Bestleistung', 'text'], ['competitionPhase', 'Wettkampfphase', 'select', ['Vorbereitung', 'Wettkampfsaison', 'Übergang', 'Aufbau']], ['techFocus', 'Technische Schwerpunkte', 'text']], ['acceleration', 'maxSpeed', 'power', 'jumpAbility', 'throwPower', 'aerobicCapacity', 'mobility']),
    badminton: fieldSchema('Badminton', 'racket', [['format', 'Format', 'select', ['Einzel', 'Doppel', 'Mixed', 'Mehrere Formate']], ['hand', 'Dominante Hand', 'select', ['Rechts', 'Links']], ['level', 'Niveau', 'select', ['Anfänger', 'Freizeit', 'Verein', 'Liga', 'Turnier']], ['playStyle', 'Spielstil', 'select', ['Offensiv', 'Kontrolliert', 'Defensiv', 'Ausgeglichen']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['matchFrequency', 'Matchhäufigkeit', 'text'], ['complaints', 'Aktuelle Beschwerden', 'text']], ['reaction', 'firstStep', 'changeOfDirection', 'jumpAbility', 'footwork', 'repeatedIntense', 'shoulderRobustness', 'forearmRobustness', 'aerobicCapacity', 'recovery']),
    rowing: fieldSchema('Rudern', 'endurance', [['env', 'Umgebung', 'select', ['Ergometer', 'Wasser', 'beides']], ['style', 'Ruderstil', 'select', ['Skull', 'Riemen', 'Indoor']], ['boatClass', 'Bootsklasse', 'select', ['Einer', 'Zweier', 'Vierer', 'Achter']], ['level', 'Leistungsniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['typicalDistance', 'Typische Trainingsdistanz', 'number', 'm'], ['best2k', '2.000-m-Bestzeit', 'text'], ['strokeRate', 'Schlagfrequenzbereich', 'text']], ['aerobicEndurance', 'threshold', 'muscularEndurance', 'pullStrength', 'legStrength', 'coreStability', 'technicalSkill', 'rhythm', 'recovery']),
    hiking: fieldSchema('Wandern', 'outdoor', [['orientation', 'Ausrichtung', 'select', ['Freizeit', 'Sportlich', 'Bergwandern', 'Trekking', 'Mehrtagestouren']], ['typicalDistance', 'Typische Distanz', 'number', 'km'], ['typicalElevation', 'Typische Höhenmeter', 'number', 'm'], ['terrain', 'Typisches Gelände', 'text'], ['packWeight', 'Rucksackgewicht', 'number', 'kg'], ['toursPerMonth', 'Touren/Monat', 'number'], ['level', 'Leistungsniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']]], ['aerobicEndurance', 'muscularEndurance', 'climbing', 'surefootedness', 'balance', 'coreStability', 'loadTolerance', 'recovery']),
    walking: fieldSchema('Gehen', 'outdoor', [['goal', 'Ziel', 'select', ['Alltagsbewegung', 'Aktive Regeneration', 'Fitness', 'Gewichtsmanagement', 'Wiedereinstieg']], ['stepsPerDay', 'Schritte/Tag', 'number'], ['typicalDuration', 'Typische Dauer', 'number', 'min'], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['pace', 'Bevorzugtes Tempo', 'select', ['Langsam', 'Moderat', 'Zügig']], ['complaints', 'Beschwerden/Einschränkungen', 'text']], ['baseEndurance', 'dailyActivity', 'activeRecovery', 'loadTolerance', 'mobility']),
    climbing: fieldSchema('Klettern', 'outdoor', [['discipline', 'Disziplin', 'select', ['Bouldern', 'Sportklettern', 'Traditionelles Klettern', 'Toprope', 'Mehrseillängen']], ['env', 'Umgebung', 'select', ['Indoor', 'Outdoor', 'beides']], ['level', 'Leistungsniveau', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['maxGrade', 'Aktueller Maximalgrad', 'text'], ['gradeSystem', 'Bewertungssystem', 'select', ['Französisch', 'UIAA', 'Fontainebleau', 'YDS', 'V-Scale']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['complaints', 'Finger-/Ellenbogen-/Schulterbeschwerden', 'text']], ['fingerStrength', 'pullStrength', 'bodyTension', 'technique', 'mobility', 'gripEndurance', 'routeReading', 'injuryPrevention', 'recovery']),
    yoga: fieldSchema('Yoga', 'mindbody', [['style', 'Stil', 'select', ['Hatha', 'Vinyasa', 'Yin', 'Ashtanga', 'Power Yoga', 'Restorative', 'gemischt']], ['experience', 'Erfahrung', 'select', ['Anfänger', 'fortgeschritten', 'erfahren']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['typicalDuration', 'Typische Dauer', 'number', 'min'], ['focus', 'Hauptfokus', 'select', ['Beweglichkeit', 'Regeneration', 'Kraft', 'Entspannung', 'Gleichgewicht', 'Atmung']], ['constraints', 'Aktuelle Einschränkungen', 'text']], ['mobility', 'balance', 'coreStability', 'bodyControl', 'breathing', 'relaxation', 'recovery']),
    mobility: fieldSchema('Mobility', 'mindbody', [['focusAreas', 'Schwerpunktbereiche', 'select', ['Sprunggelenke', 'Hüfte', 'Brustwirbelsäule', 'Schultern', 'Handgelenke', 'Gesamter Körper']], ['purpose', 'Zweck', 'select', ['Warm-up', 'Cool-down', 'Eigenständige Einheit', 'Regeneration', 'Beweglichkeitsverbesserung']], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['typicalDuration', 'Typische Dauer', 'number', 'min'], ['constraints', 'Aktuelle Einschränkungen', 'text']], ['jointMobility', 'activeMobility', 'bodyControl', 'recovery', 'movementQuality']),
    hyrox: { label: 'HYROX', type: 'hybrid', positions: [], rolesByPosition: {}, roles: [], fields: [['category', 'Kategorie', 'select', ['Open', 'Pro', 'Doubles', 'Mixed Doubles', 'Relay']], ['level', 'Leistungsniveau', 'select', ['Anfänger', 'Fortgeschritten', 'Wettkampferfahren']], ['primaryGoal', 'Hauptziel', 'select', ['Finish', 'Zeit verbessern', 'Qualifikation', 'Allgemeine HYROX-Fitness']], ['targetTime', 'Zielzeit', 'text'], ['competitionDate', 'Wettkampfdatum', 'date'], ['sessionsPerWeek', 'Einheiten/Woche', 'number'], ['currentRunningLevel', 'Aktuelle Laufleistung', 'text'], ['currentStrengthLevel', 'Aktuelle Kraftleistung', 'text'], ['strongestStation', 'Stärkste Station', 'select', ['1 km Lauf', 'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Row', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']], ['weakestStation', 'Schwächste Station', 'select', ['1 km Lauf', 'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Row', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls']], ['availableEquipment', 'Verfügbare HYROX-Ausstattung', 'text'], ['complaints', 'Aktuelle Beschwerden', 'text']], performancePriorities: ['aerobicEndurance', 'threshold', 'runningEconomy', 'muscularEndurance', 'maxStrength', 'power', 'gripStrength', 'coreStability', 'transitionFatigued', 'loadTolerance', 'paceManagement', 'recovery'] },
    golf: fieldSchema('Golf', 'other', [['handicap', 'Aktuelles Handicap', 'text'], ['side', 'Dominante Spielseite', 'select', ['Rechts', 'Links']], ['context', 'Spielkontext', 'select', ['Freizeit', 'Club', 'Liga', 'Turnier']], ['roundsPerMonth', 'Runden/Monat', 'number'], ['sessionsPerWeek', 'Trainingseinheiten/Woche', 'number'], ['preferredFormat', 'Bevorzugtes Format', 'select', ['9 Loch', '18 Loch', 'Driving Range', 'Kurzspieltraining', 'Putting']], ['mobilityMode', 'Bevorzugte Fortbewegung', 'select', ['Zu Fuß', 'Trolley', 'Cart']], ['avgStrokes', 'Durchschnittliche Schlagzahl', 'number'], ['complaints', 'Aktuelle Beschwerden', 'text']], ['rotation', 'coreStability', 'mobility', 'balance', 'coordination', 'shoulderRobustness', 'driver', 'irons', 'shortGame', 'bunker', 'putting', 'tournamentConsistency'])
  };
  function sportProfileSchema(sportId) { return SPORT_PROFILE_SCHEMAS[sportId] || null; }
  function rolesForPosition(sportId, positionCode) { var s = SPORT_PROFILE_SCHEMAS[sportId]; if (!s) return []; if (s.rolesByPosition && s.rolesByPosition[positionCode]) return s.rolesByPosition[positionCode].slice(); return (s.roles || []).slice(); }
  // Positionen je Variante (z. B. Volleyball Halle/Beach); ohne Variante die Standardpositionen.
  function positionsForVariant(sportId, variant) { var s = SPORT_PROFILE_SCHEMAS[sportId]; if (!s) return []; if (variant && s.variantPositions && s.variantPositions[variant]) return s.variantPositions[variant].slice(); return (s.positions || []).slice(); }
  function performanceAreasFor(sportId) { var s = SPORT_PROFILE_SCHEMAS[sportId]; return s ? (s.performancePriorities || []).map(function (k) { return [k, perfLabel(k)]; }) : []; }

  function normalizePerfPriority(p) {
    p = p || {};
    var pr = parseInt(p.priority, 10); if (!(pr >= 1 && pr <= 3)) pr = 2;
    return { key: p.key || '', priority: pr, currentLevel: p.currentLevel != null ? p.currentLevel : null, targetLevel: p.targetLevel != null ? p.targetLevel : null };
  }
  function normalizeSportProfile(sportId, raw) {
    raw = raw || {};
    function arr(a) { return Array.isArray(a) ? a.slice() : []; }
    function num(v) { return v != null && v !== '' ? v : null; }
    return {
      primaryPosition: raw.primaryPosition || null,
      secondaryPositions: arr(raw.secondaryPositions),
      playingRole: raw.playingRole || null,
      customRole: raw.customRole || null,
      competitionLevel: raw.competitionLevel || raw.level || null,
      teamSessionsPerWeek: num(raw.teamSessionsPerWeek),
      matchDay: raw.matchDay || null,
      typicalMatchMinutes: num(raw.typicalMatchMinutes),
      lineupStatus: raw.lineupStatus || null,
      seasonPhase: raw.seasonPhase || null,
      extraSessions: num(raw.extraSessions),
      matchFrequency: raw.matchFrequency || null,
      tournaments: raw.tournaments || null,
      currentWeeklyLoad: raw.currentWeeklyLoad || null,
      tacticalRole: raw.tacticalRole || null,
      performancePriorities: (Array.isArray(raw.performancePriorities) ? raw.performancePriorities : []).map(normalizePerfPriority),
      weaknesses: arr(raw.weaknesses),
      strengths: arr(raw.strengths),
      equipment: arr(raw.equipment),
      constraints: arr(raw.constraints),
      linkedSport: raw.linkedSport || null,
      fields: (raw.fields && typeof raw.fields === 'object') ? Object.assign({}, raw.fields) : {}
    };
  }

  // ---- Positions-Anforderungsmatrix (relative Planungsgewichte 0..1; KEINE medizinischen Wahrheiten) ----
  var POSITION_DEMAND_PROFILES = {
    football: {
      goalkeeper: { acceleration: 0.4, maxSpeed: 0.3, repeatedSprint: 0.3, aerobicCapacity: 0.4, maxStrength: 0.7, power: 0.8, changeOfDirection: 0.6, jumpAbility: 0.8 },
      centre_back: { acceleration: 0.8, maxSpeed: 0.6, repeatedSprint: 0.6, aerobicCapacity: 0.7, maxStrength: 0.9, power: 0.8, changeOfDirection: 0.7, jumpAbility: 0.8 },
      full_back: { acceleration: 0.9, maxSpeed: 0.9, repeatedSprint: 0.9, aerobicCapacity: 0.9, maxStrength: 0.6, power: 0.8, changeOfDirection: 0.9, jumpAbility: 0.6 },
      wing_back: { acceleration: 0.9, maxSpeed: 0.9, repeatedSprint: 1.0, aerobicCapacity: 1.0, maxStrength: 0.6, power: 0.8, changeOfDirection: 0.9, jumpAbility: 0.6 },
      defensive_midfield: { acceleration: 0.7, maxSpeed: 0.6, repeatedSprint: 0.8, aerobicCapacity: 1.0, maxStrength: 0.8, power: 0.7, changeOfDirection: 0.8, jumpAbility: 0.6 },
      central_midfield: { acceleration: 0.8, maxSpeed: 0.7, repeatedSprint: 0.9, aerobicCapacity: 1.0, maxStrength: 0.7, power: 0.7, changeOfDirection: 0.8, jumpAbility: 0.5 },
      attacking_midfield: { acceleration: 0.9, maxSpeed: 0.8, repeatedSprint: 0.8, aerobicCapacity: 0.8, maxStrength: 0.6, power: 0.8, changeOfDirection: 0.9, jumpAbility: 0.5 },
      winger: { acceleration: 1.0, maxSpeed: 1.0, repeatedSprint: 0.9, aerobicCapacity: 0.8, maxStrength: 0.6, power: 0.9, changeOfDirection: 1.0, jumpAbility: 0.5 },
      striker: { acceleration: 0.9, maxSpeed: 0.9, repeatedSprint: 0.8, aerobicCapacity: 0.7, maxStrength: 0.8, power: 0.9, changeOfDirection: 0.8, jumpAbility: 0.8 }
    },
    basketball: {
      point_guard: { acceleration: 0.9, changeOfDirection: 1.0, agility: 0.9, jumpAbility: 0.6, repeatedSprint: 0.8, contactStability: 0.5, maxStrength: 0.5, shootingFatigued: 0.8 },
      shooting_guard: { acceleration: 0.8, changeOfDirection: 0.9, agility: 0.8, jumpAbility: 0.7, repeatedSprint: 0.8, contactStability: 0.6, maxStrength: 0.5, shootingFatigued: 0.9 },
      small_forward: { acceleration: 0.8, changeOfDirection: 0.8, agility: 0.8, jumpAbility: 0.8, repeatedSprint: 0.8, contactStability: 0.7, maxStrength: 0.7, shootingFatigued: 0.7 },
      power_forward: { acceleration: 0.7, changeOfDirection: 0.7, agility: 0.6, jumpAbility: 0.9, repeatedSprint: 0.6, contactStability: 0.9, maxStrength: 0.9, shootingFatigued: 0.6 },
      center: { acceleration: 0.6, changeOfDirection: 0.6, agility: 0.5, jumpAbility: 0.9, repeatedSprint: 0.5, contactStability: 1.0, maxStrength: 1.0, shootingFatigued: 0.5 }
    },
    handball: {
      goalkeeper: { throwPower: 0.5, jumpAbility: 0.6, acceleration: 0.5, changeOfDirection: 0.7, shoulderRobustness: 0.7, contactStability: 0.6, repeatedIntense: 0.5, aerobicCapacity: 0.5 },
      left_wing: { throwPower: 0.7, jumpAbility: 0.9, acceleration: 0.9, changeOfDirection: 0.9, shoulderRobustness: 0.8, contactStability: 0.6, repeatedIntense: 0.9, aerobicCapacity: 0.8 },
      right_wing: { throwPower: 0.7, jumpAbility: 0.9, acceleration: 0.9, changeOfDirection: 0.9, shoulderRobustness: 0.8, contactStability: 0.6, repeatedIntense: 0.9, aerobicCapacity: 0.8 },
      left_back: { throwPower: 0.9, jumpAbility: 0.8, acceleration: 0.7, changeOfDirection: 0.7, shoulderRobustness: 0.9, contactStability: 0.8, repeatedIntense: 0.7, aerobicCapacity: 0.7 },
      centre_back_hb: { throwPower: 0.8, jumpAbility: 0.7, acceleration: 0.7, changeOfDirection: 0.8, shoulderRobustness: 0.8, contactStability: 0.7, repeatedIntense: 0.8, aerobicCapacity: 0.8 },
      right_back: { throwPower: 0.9, jumpAbility: 0.8, acceleration: 0.7, changeOfDirection: 0.7, shoulderRobustness: 0.9, contactStability: 0.8, repeatedIntense: 0.7, aerobicCapacity: 0.7 },
      pivot: { throwPower: 0.7, jumpAbility: 0.7, acceleration: 0.6, changeOfDirection: 0.6, shoulderRobustness: 0.8, contactStability: 1.0, repeatedIntense: 0.7, aerobicCapacity: 0.7 }
    },
    volleyball: {
      setter: { jumpAbility: 0.8, reactiveStrength: 0.8, shoulderRobustness: 0.7, lateralMovement: 0.8, reaction: 0.9, coreStability: 0.8, landingControl: 0.8, mobility: 0.7 },
      outside_hitter: { jumpAbility: 1.0, reactiveStrength: 0.9, shoulderRobustness: 0.9, lateralMovement: 0.7, reaction: 0.8, coreStability: 0.8, landingControl: 0.9, mobility: 0.7 },
      opposite: { jumpAbility: 1.0, reactiveStrength: 0.9, shoulderRobustness: 0.9, lateralMovement: 0.6, reaction: 0.8, coreStability: 0.8, landingControl: 0.9, mobility: 0.7 },
      middle_blocker: { jumpAbility: 1.0, reactiveStrength: 1.0, shoulderRobustness: 0.8, lateralMovement: 0.9, reaction: 0.9, coreStability: 0.8, landingControl: 1.0, mobility: 0.6 },
      libero: { jumpAbility: 0.4, reactiveStrength: 0.6, shoulderRobustness: 0.5, lateralMovement: 1.0, reaction: 1.0, coreStability: 0.7, landingControl: 0.6, mobility: 0.8 }
    },
    hockey: {
      goalkeeper: { acceleration: 0.5, repeatedSprint: 0.4, changeOfDirection: 0.7, aerobicCapacity: 0.5, coreStability: 0.8, lowBodyPosition: 0.9, stickPower: 0.5, recovery: 0.6 },
      defence: { acceleration: 0.8, repeatedSprint: 0.7, changeOfDirection: 0.8, aerobicCapacity: 0.8, coreStability: 0.8, lowBodyPosition: 0.9, stickPower: 0.8 },
      midfield: { acceleration: 0.8, repeatedSprint: 0.9, changeOfDirection: 0.9, aerobicCapacity: 1.0, coreStability: 0.8, lowBodyPosition: 0.8, stickPower: 0.7 },
      attack: { acceleration: 0.9, repeatedSprint: 0.9, changeOfDirection: 0.9, aerobicCapacity: 0.8, coreStability: 0.7, lowBodyPosition: 0.8, stickPower: 0.8 }
    },
    rugby: {
      front_row: { maxStrength: 1.0, power: 0.8, maxSpeed: 0.5, repeatedIntense: 0.7, contactStability: 1.0, aerobicCapacity: 0.7, agility: 0.5, neckCoreStability: 1.0 },
      locks: { maxStrength: 0.9, power: 0.8, maxSpeed: 0.6, repeatedIntense: 0.7, contactStability: 0.9, aerobicCapacity: 0.7, agility: 0.6, neckCoreStability: 0.9 },
      back_row: { maxStrength: 0.8, power: 0.9, maxSpeed: 0.7, repeatedIntense: 0.9, contactStability: 0.9, aerobicCapacity: 0.9, agility: 0.8, neckCoreStability: 0.8 },
      half_backs: { maxStrength: 0.6, power: 0.8, maxSpeed: 0.9, repeatedIntense: 0.8, contactStability: 0.6, aerobicCapacity: 0.9, agility: 0.9, neckCoreStability: 0.6 },
      centres: { maxStrength: 0.7, power: 0.9, maxSpeed: 0.9, repeatedIntense: 0.8, contactStability: 0.8, aerobicCapacity: 0.8, agility: 0.9, neckCoreStability: 0.7 },
      back_three: { maxStrength: 0.6, power: 0.9, maxSpeed: 1.0, repeatedIntense: 0.8, contactStability: 0.6, aerobicCapacity: 0.8, agility: 0.9, neckCoreStability: 0.6 }
    }
  };
  // Rollen-Modifikatoren (additiv auf die Positionsbasis).
  var ROLE_DEMAND_MODIFIERS = {
    ball_playing_cb: { maxStrength: -0.1, aerobicCapacity: 0.1 }, aggressive_cb: { acceleration: 0.1, duelStrength: 0.1 },
    overlapping_fb: { repeatedSprint: 0.1, aerobicCapacity: 0.1 }, inverted_fb: { changeOfDirection: 0.1 },
    box_to_box: { aerobicCapacity: 0.1, repeatedSprint: 0.1 }, ball_winner: { duelStrength: 0.1, repeatedSprint: 0.1 },
    inverted_winger: { changeOfDirection: 0.1, power: 0.1 }, pressing_striker: { repeatedSprint: 0.1, aerobicCapacity: 0.1 },
    target_man: { maxStrength: 0.1, jumpAbility: 0.1 }, false_nine: { aerobicCapacity: 0.1 }
  };
  // Flache Demand-Baselines für Nicht-Mannschaftssportarten (relative Gewichte 0..1).
  var SPORT_DEMAND_PROFILES = {
    running: { aerobicCapacity: 0.9, threshold: 0.8, tempoHardness: 0.6, runningEconomy: 0.7, maxSpeed: 0.4, strengthEndurance: 0.5, loadTolerance: 0.7, recovery: 0.6 },
    cycling: { aerobicCapacity: 0.9, threshold: 0.8, vo2max: 0.7, sprintPower: 0.4, strengthEndurance: 0.6, pedalingEconomy: 0.7, climbing: 0.5, recovery: 0.6 },
    swimming: { technique: 0.9, waterPosition: 0.8, aerobicCapacity: 0.8, threshold: 0.7, sprintPower: 0.4, pull: 0.6, breathing: 0.7, recovery: 0.6 },
    triathlon: { swimDiscipline: 0.7, bikeDiscipline: 0.8, runDiscipline: 0.8, transition: 0.5, aerobicCapacity: 0.9, threshold: 0.7, loadTolerance: 0.8, recovery: 0.7, nutritionStrategy: 0.5 },
    tennis: { reaction: 0.9, firstStep: 0.8, changeOfDirection: 0.9, acceleration: 0.8, stickPower: 0.7, shoulderRobustness: 0.8, forearmRobustness: 0.7, rotation: 0.8, aerobicCapacity: 0.7, mobility: 0.6 },
    padel: { reaction: 0.9, changeOfDirection: 0.8, firstStep: 0.8, power: 0.6, shoulderRobustness: 0.7, forearmRobustness: 0.7, aerobicCapacity: 0.6, mobility: 0.7, rotation: 0.6 },
    badminton: { reaction: 1.0, firstStep: 0.9, changeOfDirection: 0.9, jumpAbility: 0.7, footwork: 0.9, repeatedIntense: 0.9, shoulderRobustness: 0.7, forearmRobustness: 0.7, aerobicCapacity: 0.7, recovery: 0.6 },
    golf: { rotation: 0.9, coreStability: 0.9, mobility: 0.8, balance: 0.8, coordination: 0.8, shoulderRobustness: 0.6 },
    gym: { maxStrength: 0.9, hypertrophy: 0.8, power: 0.7, strengthEndurance: 0.6, coreStability: 0.7, jointStability: 0.7, movementQuality: 0.6, recovery: 0.6 },
    rowing: { aerobicEndurance: 0.9, threshold: 0.8, muscularEndurance: 0.8, pullStrength: 0.8, legStrength: 0.8, coreStability: 0.7, technicalSkill: 0.7, rhythm: 0.6, recovery: 0.6 },
    hiking: { aerobicEndurance: 0.8, muscularEndurance: 0.7, climbing: 0.7, surefootedness: 0.7, balance: 0.6, coreStability: 0.6, loadTolerance: 0.7, recovery: 0.6 },
    walking: { baseEndurance: 0.7, dailyActivity: 0.8, activeRecovery: 0.7, loadTolerance: 0.5, mobility: 0.5 },
    climbing: { fingerStrength: 1.0, pullStrength: 0.9, bodyTension: 0.9, technique: 0.9, mobility: 0.7, gripEndurance: 0.9, routeReading: 0.7, injuryPrevention: 0.7, recovery: 0.6 },
    yoga: { mobility: 0.9, balance: 0.8, coreStability: 0.7, bodyControl: 0.8, breathing: 0.7, relaxation: 0.8, recovery: 0.7 },
    mobility: { jointMobility: 0.9, activeMobility: 0.9, bodyControl: 0.7, recovery: 0.7, movementQuality: 0.8 },
    hyrox: { aerobicEndurance: 0.9, anaerobicCapacity: 0.8, acceleration: 0.5, maxSpeed: 0.4, repeatedSprint: 0.6, agility: 0.5, maxStrength: 0.7, power: 0.7, muscularEndurance: 1.0, mobility: 0.6, coordination: 0.7, balance: 0.5, reaction: 0.3, technicalSkill: 0.7, recoveryDemand: 0.9 }
  };
  // Spielstil-/Format-Modifikatoren (additiv) für Racketsportarten.
  var STYLE_DEMAND_MOD = { Offensiv: { power: 0.1, acceleration: 0.1 }, Defensiv: { aerobicCapacity: 0.1, reaction: 0.1 }, 'Serve-and-Volley': { firstStep: 0.1, reaction: 0.1 }, Grundlinienspiel: { aerobicCapacity: 0.1, rotation: 0.1 } };
  // Distanz-/Disziplinabhängige Modifikatoren (additiv).
  var DISCIPLINE_DEMAND_MOD = {
    '5 km': { threshold: 0.1, vo2max: 0.1, tempoHardness: 0.1 }, '10 km': { threshold: 0.1, vo2max: 0.05 },
    'Marathon': { aerobicCapacity: 0.1, loadTolerance: 0.1 }, 'Halbmarathon': { aerobicCapacity: 0.05, threshold: 0.05 },
    'Trail': { strengthEndurance: 0.1, coordination: 0.1 }, 'Ultra': { aerobicCapacity: 0.15, loadTolerance: 0.15 },
    'Sprint': { threshold: 0.1, transition: 0.1 }, 'Langdistanz': { aerobicCapacity: 0.1, loadTolerance: 0.1, nutritionStrategy: 0.1 }, 'Mitteldistanz': { aerobicCapacity: 0.05, loadTolerance: 0.05 }
  };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // Resolver: positionBaseline + roleModifiers + userPriorities + weaknesses − constraints (geclamped 0..1.2).
  function resolveDemandProfile(opts) {
    opts = opts || {};
    var sp = POSITION_DEMAND_PROFILES[opts.sportId] || {};
    // Mannschaftssport: Positionsbasis; sonst flache Sport-Baseline (running/cycling/swimming/triathlon …).
    var base = Object.assign({}, sp[opts.position] || (opts.position ? {} : (SPORT_DEMAND_PROFILES[opts.sportId] || {})));
    if (!Object.keys(base).length && SPORT_DEMAND_PROFILES[opts.sportId]) base = Object.assign({}, SPORT_DEMAND_PROFILES[opts.sportId]);
    var dm = DISCIPLINE_DEMAND_MOD[opts.discipline] || {};
    Object.keys(dm).forEach(function (k) { base[k] = (base[k] || 0) + dm[k]; });
    var stm = STYLE_DEMAND_MOD[opts.style] || {};
    Object.keys(stm).forEach(function (k) { base[k] = (base[k] || 0) + stm[k]; });
    var rm = ROLE_DEMAND_MODIFIERS[opts.role] || {};
    Object.keys(rm).forEach(function (k) { base[k] = (base[k] || 0) + rm[k]; });
    (opts.userPriorities || []).forEach(function (p) { if (p && p.key) base[p.key] = (base[p.key] || 0) + 0.1 * (p.priority || 1); });
    (opts.weaknesses || []).forEach(function (w) { if (w) base[w] = (base[w] || 0) + 0.15; });
    // Beschwerden dämpfen hochintensive Dimensionen (vorsichtig, kein medizinischer Anspruch).
    if ((opts.constraints || []).length) { ['maxSpeed', 'repeatedSprint', 'repeatedIntense', 'power', 'acceleration', 'jumpAbility'].forEach(function (k) { if (base[k] != null) base[k] = base[k] - 0.1 * opts.constraints.length; }); }
    var out = {}; Object.keys(base).forEach(function (k) { out[k] = Math.round(clamp(base[k], 0, 1.2) * 100) / 100; });
    return out;
  }

  // ---- Daten-Nutzungsmatrix: kein sichtbares Feld ohne dokumentierten Consumer ----
  var PROFILE_FIELD_USAGE = {
    'personal.name': { consumers: ['profileDisplay'], status: 'informational' },
    'personal.birthDate': { consumers: ['ageCalculation', 'loadContext'], status: 'active' },
    'personal.sex': { consumers: ['bodyMetrics'], status: 'informational' },
    'personal.heightCm': { consumers: ['bodyMetrics', 'energyContext'], status: 'active' },
    'personal.weightKg': { consumers: ['bodyMetrics', 'loadContext', 'wkgEstimate'], status: 'active' },
    'goals': { consumers: ['focusContext', 'legacyGoalProjection'], status: 'active' },
    'sports[].activeInApp': { consumers: ['trainingStartOptions', 'manualActivityOptions', 'quickActions', 'activityFilters'], status: 'active' },
    'sports[].includeInPlan': { consumers: ['futurePlanGeneration'], status: 'prepared' },
    'sports[].role': { consumers: ['focusContext'], status: 'prepared' },
    'sports[].sessionsPerWeek': { consumers: ['futureWeeklyScheduling'], status: 'prepared' },
    'sports[].preferredDays': { consumers: ['futureWeeklyScheduling'], status: 'prepared' },
    'sports[].typicalDuration': { consumers: ['futureWeeklyScheduling', 'trainingStartOptions'], status: 'prepared' },
    'availability.days': { consumers: ['futureWeeklyScheduling'], status: 'prepared' },
    'availability.days[].singleSession': { consumers: ['futureSessionPlacement'], status: 'prepared' },
    'availability.days[].doubleSession': { consumers: ['futureSessionPlacement', 'recoverySpacing'], status: 'prepared' },
    'availability.days[].fixedCommitments': { consumers: ['futureConflictDetection', 'weeklyLoadContext'], status: 'prepared' },
    'availability.maxSessionsPerWeek': { consumers: ['futureWeeklyLoadBudget'], status: 'prepared' },
    'availability.maxIntenseSessions': { consumers: ['futureHardSessionBudget'], status: 'prepared' },
    'availability.preferredRestDays': { consumers: ['futureWeeklyScheduling'], status: 'prepared' },
    'performance.vo2max': { consumers: ['performanceContext', 'futureTrainingIntensity'], status: 'prepared' },
    'performance.personalBests': { consumers: ['performanceContext', 'futureGoalCalibration'], status: 'prepared' },
    'performance.strengthRecords': { consumers: ['strengthProgress', 'futureLoadSelection'], status: 'prepared' },
    'performance.ftp': { consumers: ['cyclingIntensityZones'], status: 'prepared' },
    'performance.weightHistory': { consumers: ['bodyMetrics', 'wkgEstimate'], status: 'active' },
    'recovery.sleep.averageHours': { consumers: ['recoveryAssessment', 'futureIntensityAdjustment'], status: 'prepared' },
    'recovery.sleep.quality': { consumers: ['recoveryAssessment'], status: 'prepared' },
    'recovery.stress.generalLevel': { consumers: ['dailyLoadContext', 'futureHardSessionPlacement'], status: 'prepared' },
    'recovery.workPattern.shiftType': { consumers: ['futureScheduling'], status: 'prepared' },
    'recovery.nutritionState.mode': { consumers: ['recoveryRisk', 'futureVolumeAdjustment'], status: 'prepared' },
    'preferences.preferredSessionDurations': { consumers: ['futureSessionSelection'], status: 'prepared' },
    'preferences.avoidedExercises': { consumers: ['exerciseAdaptation'], status: 'prepared' },
    'constraints': { consumers: ['todayAdjustment', 'exerciseAdaptation', 'homeModules'], status: 'active' },
    'preferences.preferredSports': { consumers: ['futurePlanPreferences'], status: 'prepared' },
    'preferences.intensity': { consumers: ['futurePlanPreferences'], status: 'prepared' },
    'preferences.indoorOutdoor': { consumers: ['futurePlanPreferences'], status: 'prepared' },
    'preferences.avoidExercises': { consumers: ['exerciseAdaptation'], status: 'prepared' },
    'devices.equipment': { consumers: ['futureExerciseSelection', 'futureWorkoutFeasibility'], status: 'prepared' },
    'devices.trainingLocations': { consumers: ['futureSessionPlacement', 'futureWorkoutFeasibility'], status: 'prepared' },
    'devices.integrations.strava': { consumers: ['activityImport'], status: 'prepared' },
    'devices.integrations.garmin': { consumers: ['futureGarminSync'], status: 'prepared' },
    'devices.integrations.appleHealth': { consumers: ['futureHealthDataSync'], status: 'prepared' },
    'devices.manualSources': { consumers: ['activityImport'], status: 'active' },
    'sports[].sportProfile.primaryPosition': { consumers: ['positionDemandProfile', 'futurePlanGeneration', 'strengthFocus', 'speedFocus'], status: 'prepared' },
    'sports[].sportProfile.secondaryPositions': { consumers: ['positionDemandProfile'], status: 'prepared' },
    'sports[].sportProfile.playingRole': { consumers: ['roleDemandModifiers', 'futurePlanGeneration'], status: 'prepared' },
    'sports[].sportProfile.competitionLevel': { consumers: ['loadContext'], status: 'prepared' },
    'sports[].sportProfile.teamSessionsPerWeek': { consumers: ['weeklyLoadBudget', 'futurePlanGeneration'], status: 'prepared' },
    'sports[].sportProfile.matchDay': { consumers: ['hardSessionPlacement', 'recoverySpacing'], status: 'prepared' },
    'sports[].sportProfile.typicalMatchMinutes': { consumers: ['weeklyLoadBudget'], status: 'prepared' },
    'sports[].sportProfile.seasonPhase': { consumers: ['periodizationContext'], status: 'prepared' },
    'sports[].sportProfile.performancePriorities': { consumers: ['demandResolver', 'strengthFocus', 'speedFocus'], status: 'prepared' },
    'sports[].sportProfile.weaknesses': { consumers: ['demandResolver'], status: 'prepared' },
    'sports[].sportProfile.constraints': { consumers: ['demandResolver', 'exerciseAdaptation'], status: 'prepared' },
    'sports[].sportProfile.linkedSport': { consumers: ['strengthFocus'], status: 'prepared' },
    'sports[].sportProfile.fields': { consumers: ['sportContext'], status: 'prepared' },
    'sports[].sportProfile.primaryGoal': { consumers: ['focusContext', 'futurePlanGeneration'], status: 'prepared' },
    'sports[].sportProfile.sessionsPerWeek': { consumers: ['weeklyLoadBudget'], status: 'prepared' },
    'sports[].sportProfile.linkedSports': { consumers: ['strengthFocus'], status: 'prepared' },
    'sports[].sportProfile.strongestStation': { consumers: ['demandResolver'], status: 'prepared' },
    'sports[].sportProfile.weakestStation': { consumers: ['demandResolver', 'futurePlanGeneration'], status: 'prepared' }
  };
  // Krafttraining: verknüpfte Sportarten dürfen nur aktive Profilsportarten sein (validierte Mehrfachauswahl).
  function filterLinkedSports(linked, activeSportIds) {
    var act = Array.isArray(activeSportIds) ? activeSportIds : [];
    return (Array.isArray(linked) ? linked : []).filter(function (id) { return act.indexOf(id) >= 0; });
  }
  // ---- Onboarding-Status (zentral; KEIN zweiter dauerhafter Profilstand) ----
  var ONBOARDING_STATUSES = ['not_started', 'in_progress', 'completed', 'skipped'];
  var ONBOARDING_STEPS = ['welcome', 'profile', 'sports', 'goals', 'schedule', 'summary'];
  function normalizeOnboarding(o, profile) {
    o = o || {};
    var status = ONBOARDING_STATUSES.indexOf(o.status) >= 0 ? o.status : (o.completed ? 'completed' : 'not_started');
    return {
      status: status,
      currentStep: ONBOARDING_STEPS.indexOf(o.currentStep) >= 0 ? o.currentStep : 'welcome',
      completedSteps: Array.isArray(o.completedSteps) ? o.completedSteps.filter(function (s) { return ONBOARDING_STEPS.indexOf(s) >= 0; }) : [],
      startedAt: o.startedAt || null,
      completedAt: o.completedAt || (o.completed ? (o.completedAt || nowISO()) : null),
      version: o.version != null ? o.version : SCHEMA_VERSION
    };
  }
  // Bestandsnutzer mit echten Daten gelten als abgeschlossen → KEIN Pflicht-Onboarding.
  function isOnboardingComplete(profile) {
    profile = profile || {};
    if (profile.onboarding && profile.onboarding.status === 'completed') return true;
    if (profile.onboarding && profile.onboarding.completed) return true;
    if (profile.onboarded) return true;
    var hasGoals = Array.isArray(profile.goals) && profile.goals.length > 0;
    var hasSports = Array.isArray(profile.sports) && profile.sports.length > 0;
    return hasGoals || hasSports;
  }
  function getFieldUsage(path) { return path ? (PROFILE_FIELD_USAGE[path] || null) : PROFILE_FIELD_USAGE; }
  function usageStatusOf(path) { var u = PROFILE_FIELD_USAGE[path]; return u ? u.status : null; }

  // ---- Zentrale Konsolidierung: alle Bereiche idempotent normalisieren, Unbekanntes erhalten ----
  function consolidateProfile(p, now) {
    now = now || nowISO();
    p = p || {};
    // Migrieren falls nötig, aber unbekannte Top-Level-Altfelder verlustfrei beibehalten (Original über Migration mergen).
    var migrated = (!Array.isArray(p.goals) && (p.primaryGoal || p.secondaryGoals)) ? migrateProfile(p, now) : null;
    // p gewinnt (reiche Sektionen/unbekannte Felder bleiben); goals/personal aus Migration übernehmen, falls in p nicht vorhanden.
    var out = migrated ? Object.assign({}, migrated, p) : Object.assign({}, p);
    if (migrated && !Array.isArray(p.goals)) out.goals = migrated.goals;
    out.version = SCHEMA_VERSION;
    out.goals = normalizeGoals(out.goals, now);
    out.sports = normalizeSports(out.sports, now);
    out.performance = normalizePerformance(out.performance, out.body);
    out.devices = normalizeDevices(out.devices, out.dataSources);
    out.constraintsList = (Array.isArray(out.constraintsList) ? out.constraintsList : []).map(function (c) { return normalizeConstraint(c); });
    out.recovery = normalizeRecovery(out.recovery, out.recovery);
    out.preferences = normalizePreferences(out.preferences || out.trainingPrefs, out.trainingPrefs);
    out.onboarding = normalizeOnboarding(out.onboarding, out);
    // Bestandsnutzer (Daten vorhanden) automatisch als abgeschlossen markieren — kein erzwungener Wizard.
    if (out.onboarding.status !== 'completed' && isOnboardingComplete(out)) { out.onboarding.status = 'completed'; out.onboarding.completedAt = out.onboarding.completedAt || now; }
    if (out.availability && (out.availability.weekly || out.availability.days)) out.availability = normalizeAvailability(out.availability);
    out.updatedAt = now;
    return out;
  }

  // ---- Zentrale Profil-Zusammenfassung (read-only, nur abgeleitet) ----
  function buildProfileSummary(profile) {
    profile = profile || {};
    var base = buildSummary(profile);
    var sports = normalizeSports(profile.sports);
    var av = (profile.availability && (profile.availability.weekly || profile.availability.days)) ? normalizeAvailability(profile.availability) : null;
    var perf = normalizePerformance(profile.performance, profile.body);
    var devices = normalizeDevices(profile.devices, profile.dataSources);
    return {
      name: profile.name || (profile.personal && profile.personal.name) || '',
      primaryGoal: base.primaryGoal,
      otherGoals: base.otherGoals,
      activeSports: sports.filter(function (s) { return s.activeInApp; }).map(function (s) { return s.customName || s.sportId; }),
      planSports: sports.filter(function (s) { return s.includeInPlan; }).map(function (s) { return s.customName || s.sportId; }),
      availabilitySessions: av ? av.maxSessionsPerWeek : null,
      vo2max: perf.vo2max && perf.vo2max.value != null ? perf.vo2max.value : null,
      personalBestCount: perf.personalBests.length,
      activeConstraints: activeConstraints(profile).map(function (c) { return c.title || c.bodyRegion; }),
      connectedIntegrations: INTEGRATION_IDS.filter(function (k) { return devices.integrations[k].status === 'connected'; })
    };
  }

  // ---- Coverage-Validator: prüft je kanonischer Sportart Profil/Aktivität/Darstellung ----
  // catalog: [{id,label,icon}]; opts.hasActivitySchema(id)->bool. Sportarten ohne Spezialprofil
  // (generische Ausdauer/Outdoor, 'other') sind via opts.exempt erlaubt. Liefert nur Lücken.
  function validateSportCoverage(catalog, opts) {
    opts = opts || {}; var exempt = opts.exempt || ['other'];
    var hasAct = typeof opts.hasActivitySchema === 'function' ? opts.hasActivitySchema : function () { return true; };
    var out = [];
    (catalog || []).forEach(function (s) {
      if (exempt.indexOf(s.id) >= 0) return;
      var missing = [];
      if (!s.label) missing.push('label');
      if (!s.icon) missing.push('icon');
      if (!hasAct(s.id)) missing.push('activitySchema');
      if (opts.requireProfile !== false) {
        var sc = SPORT_PROFILE_SCHEMAS[s.id];
        if (!sc) missing.push('profileSchema');
        else {
          if (!(sc.positions && sc.positions.length) && !(sc.fields && sc.fields.length)) missing.push('fieldsOrPositions');
          if (!(sc.performancePriorities && sc.performancePriorities.length)) missing.push('performanceAreas');
        }
      }
      if (missing.length) out.push({ sportId: s.id, missing: missing });
    });
    return out;
  }

  // ---- Zentrale deutsche Label-Maps (keine englischen Enum-Werte in der UI) ----
  var PROFILE_LABELS = {
    gender: { m: 'Männlich', male: 'Männlich', w: 'Weiblich', female: 'Weiblich', d: 'Divers', diverse: 'Divers', '': 'Keine Angabe', prefer_not_to_say: 'Keine Angabe', undisclosed: 'Keine Angabe' },
    timeOfDay: { morning: 'Morgens', morgens: 'Morgens', noon: 'Mittags', mittags: 'Mittags', afternoon: 'Nachmittags', nachmittags: 'Nachmittags', evening: 'Abends', abends: 'Abends', flexible: 'Flexibel', flexibel: 'Flexibel', '': '' },
    constraintStatus: { active: 'aktiv', improved: 'verbessert', resolved: 'behoben', observed: 'pausiert beobachtet' },
    goalRole: { main: 'Hauptziel', secondary: 'Sekundäres Entwicklungsziel', maintain: 'Erhaltungsziel', longterm: 'Langfristiges Hintergrundziel' },
    timeHorizon: { short: 'kurzfristig', mid: 'mittelfristig', long: 'langfristig', open: 'ohne festes Datum' }
  };
  function labelOf(domain, code) { var m = PROFILE_LABELS[domain]; return (m && m[code] != null) ? m[code] : code; }

  /* ============================================================
     M1b (ADR D1–D8, 2026-07-02) — Section-Metadaten, Completeness, Freshness.
     Rein additiv: flache Felder bleiben unangetastet (D1); Metadaten leben
     AUSSCHLIESSLICH in profile._sectionMeta (D2); Completeness liest NIE
     _sectionMeta, Freshness liest NUR _sectionMeta (D3). Richtwerte zentral
     in FRESHNESS_CONFIG (D4), keine UI-Texte in Domainfunktionen.
     Required-Sets verbindlich aus docs/PROFILE-FIELD-MATRIX.md §11.
     ============================================================ */
  var SECTION_META_SOURCES = ['unknown', 'onboarding', 'editor', 'import', 'migration', 'system'];
  var SECTION_META_SCHEMA_VERSION = 1;

  function _validIso(v) { return (typeof v === 'string' && !isNaN(Date.parse(v))) ? v : null; }
  function _normalizeMetaEntry(e) {
    e = (e && typeof e === 'object' && !Array.isArray(e)) ? e : {};
    return {
      updatedAt: _validIso(e.updatedAt),
      source: SECTION_META_SOURCES.indexOf(e.source) >= 0 ? e.source : 'unknown',
      schemaVersion: SECTION_META_SCHEMA_VERSION
    };
  }
  function _isSectionId(id) { return PROFILE_SECTIONS.some(function (s) { return s.id === id; }); }

  /* Additiv + idempotent: legt _sectionMeta für alle kanonischen Sections an bzw.
     normalisiert vorhandene Einträge. Bestands-Backfill (D8): updatedAt null,
     source 'unknown'. Verändert KEINE fachlichen Felder; fremde Meta-Keys bleiben. */
  function ensureSectionMeta(profile) {
    if (!profile || typeof profile !== 'object') return profile;
    var meta = (profile._sectionMeta && typeof profile._sectionMeta === 'object' && !Array.isArray(profile._sectionMeta)) ? profile._sectionMeta : {};
    PROFILE_SECTIONS.forEach(function (s) { meta[s.id] = _normalizeMetaEntry(meta[s.id]); });
    profile._sectionMeta = meta;
    return profile;
  }

  /* VERTRAG: sections = String ODER Array kanonischer Section-IDs; unbekannte IDs
     werden IGNORIERT (Rückgabe = tatsächlich berührte IDs). source außerhalb
     SECTION_META_SOURCES → 'unknown'. now optional (ISO), sonst Systemzeit.
     Setzt NUR Metadaten — markiert nichts als vollständig, ändert keine Felder. */
  function touchSectionMeta(profile, sections, source, now) {
    if (!profile || typeof profile !== 'object') return [];
    ensureSectionMeta(profile);
    var list = Array.isArray(sections) ? sections : (sections != null ? [sections] : []);
    var src = SECTION_META_SOURCES.indexOf(source) >= 0 ? source : 'unknown';
    var iso = _validIso(now) || nowISO();
    var touched = [];
    list.forEach(function (id) {
      if (!_isSectionId(id)) return;
      profile._sectionMeta[id] = { updatedAt: iso, source: src, schemaVersion: SECTION_META_SCHEMA_VERSION };
      touched.push(id);
    });
    return touched;
  }

  /* Essential-Required-Sets (verbindlich: PROFILE-FIELD-MATRIX §11). Jeder Key =
     benannte Kerneingabe mit purem Prädikat; optionale/Advanced-Felder fehlen
     hier bewusst (können Essential nie reduzieren). */
  function _primarySport(p) {
    if (!Array.isArray(p.sports)) return null;
    for (var i = 0; i < p.sports.length; i++) { var s = p.sports[i]; if (s && s.role === 'primary') return s; }
    return null;
  }
  var ESSENTIAL_REQUIREMENTS = {
    personal: {
      name: function (p) { return typeof p.name === 'string' && p.name.trim() !== ''; },
      birth_or_age: function (p) { return _validIso(p.birthDate) !== null || (p.ageEstimate != null && !isNaN(parseInt(p.ageEstimate, 10))); }
    },
    sports: {
      sport_selected: function (p) { return Array.isArray(p.sports) && p.sports.length > 0; },
      primary_sport: function (p) { return _primarySport(p) != null; },
      primary_level: function (p) { var s = _primarySport(p); return !!(s && s.level != null && s.level !== ''); },
      primary_sessions_per_week: function (p) { var s = _primarySport(p); return !!(s && s.sessionsPerWeek != null); },
      primary_typical_duration: function (p) { var s = _primarySport(p); return !!(s && s.typicalDuration != null); }
    },
    goals: {
      goal_category: function (p) { return Array.isArray(p.goals) && p.goals.some(function (g) { return !!(g && (g.type || g.category)); }); }
    },
    availability: {
      training_days: function (p) {
        var d = p.availability && p.availability.days;
        if (!d || typeof d !== 'object') return false;
        return Object.keys(d).some(function (k) { var day = d[k]; return day === true || !!(day && (day.available === true || (Array.isArray(day.slots) && day.slots.length > 0))); });
      }
    },
    constraints: {
      /* Sicherheitsfrage gilt als beantwortet bei explizitem Acknowledge
         (constraintsAcknowledgedAt — wird vom neuen Setup gesetzt, M7) ODER
         wenn bereits Beschwerden erfasst sind. Leere Liste allein ≠ beantwortet. */
      safety_check_answered: function (p) {
        return _validIso(p.constraintsAcknowledgedAt) !== null || (Array.isArray(p.constraintsList) && p.constraintsList.length > 0);
      }
    }
  };
  var ESSENTIAL_SECTION_IDS = ['personal', 'sports', 'goals', 'availability', 'constraints'];

  /* Deutsche Benennung der Essential-Keys — EINZIGE Quelle für „fehlt: …"-Anzeigen
     (Profil-Center-Karten, Editor-Hinweise). Muss jeden ESSENTIAL_REQUIREMENTS-Key abdecken. */
  var ESSENTIAL_FIELD_LABELS = {
    name: 'Name',
    birth_or_age: 'Geburtsdatum oder Alter',
    sport_selected: 'Sportart',
    primary_sport: 'Hauptsportart',
    primary_level: 'Trainingsniveau',
    primary_sessions_per_week: 'Einheiten pro Woche',
    primary_typical_duration: 'Typische Dauer',
    goal_category: 'Zielkategorie',
    training_days: 'Trainingstage',
    safety_check_answered: 'Sicherheits-Check'
  };

  /* Pure; liest NIE _sectionMeta (D3). Sections ohne Essential-Pflichten sind
     definitionsgemäß complete (required leer) — B-/C-Tiefe zählt nie negativ. */
  function computeSectionCompleteness(profile, sectionId) {
    profile = profile || {};
    var reqs = ESSENTIAL_REQUIREMENTS[sectionId] || {};
    var required = Object.keys(reqs), present = [], missing = [];
    required.forEach(function (key) { (reqs[key](profile) ? present : missing).push(key); });
    var score = required.length ? Math.round((present.length / required.length) * 100) / 100 : 1;
    return { complete: missing.length === 0, score: score, required: required, present: present, missing: missing };
  }

  /* Aggregat: Essential-Score = Mittel über die 5 Essential-Sections (gleichgewichtet),
     NICHT über alle 9 — kein naiver Durchschnitt, B-/C-Sections verwässern nichts. */
  function computeProfileCompleteness(profile) {
    var sections = {}, missing = [], sum = 0, allComplete = true;
    PROFILE_SECTIONS.forEach(function (s) { sections[s.id] = computeSectionCompleteness(profile, s.id); });
    ESSENTIAL_SECTION_IDS.forEach(function (id) {
      var r = sections[id];
      sum += r.score;
      if (!r.complete) { allComplete = false; r.missing.forEach(function (k) { missing.push({ section: id, key: k }); }); }
    });
    return {
      essential: { complete: allComplete, score: Math.round((sum / ESSENTIAL_SECTION_IDS.length) * 100) / 100, missing: missing },
      essentialSections: ESSENTIAL_SECTION_IDS.slice(),
      sections: sections
    };
  }

  /* Zentrale Freshness-Richtwerte (D4) — Konfiguration, kein UI-Code.
     stable:true → nie automatisch review/stale. null-Schwelle → Zustand entfällt. */
  var FRESHNESS_CONFIG = {
    sections: {
      constraints:  { stable: false, reviewAfterDays: 14,  staleAfterDays: 28 },   // zeitkritisch
      availability: { stable: false, reviewAfterDays: 56,  staleAfterDays: 112 },  // regelmäßig prüfenswert
      body:         { stable: false, reviewAfterDays: 56,  staleAfterDays: 180 },
      recovery:     { stable: false, reviewAfterDays: 112, staleAfterDays: null },
      goals:        { stable: false, reviewAfterDays: 56,  staleAfterDays: null }, // + Event-Regel goalDateNeedsReview
      personal:     { stable: true },
      sports:       { stable: true },   // Sport-AUSWAHL ist stabil; fachliche Alterung läuft über goals/availability
      preferences:  { stable: true },
      devices:      { stable: true }
    }
  };

  /* Pure; liest NUR _sectionMeta (D3/D4). Zustände: unknown|current|review_recommended|stale. */
  function getSectionFreshness(profile, sectionId, now) {
    if (!_isSectionId(sectionId)) return 'unknown';
    var meta = profile && profile._sectionMeta && profile._sectionMeta[sectionId];
    var iso = meta && _validIso(meta.updatedAt);
    if (!iso) return 'unknown';
    var cfg = FRESHNESS_CONFIG.sections[sectionId] || { stable: true };
    if (cfg.stable) return 'current';
    var ref = _validIso(now) ? Date.parse(now) : Date.parse(nowISO());
    var days = (ref - Date.parse(iso)) / 86400000;
    if (cfg.staleAfterDays != null && days >= cfg.staleAfterDays) return 'stale';
    if (cfg.reviewAfterDays != null && days >= cfg.reviewAfterDays) return 'review_recommended';
    return 'current';
  }

  /* Eventbezogene Ziel-Regel — bewusst GETRENNT von getSectionFreshness (das nur
     _sectionMeta liest): aktives Ziel mit überschrittenem targetDate → Review nötig. */
  function goalDateNeedsReview(profile, now) {
    var goals = (profile && Array.isArray(profile.goals)) ? profile.goals : [];
    var ref = _validIso(now) ? Date.parse(now) : Date.parse(nowISO());
    return goals.some(function (g) {
      if (!g || (g.status && g.status !== 'active')) return false;
      var t = _validIso(g.targetDate); return t !== null && Date.parse(t) < ref;
    });
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION, GOAL_STATUSES: GOAL_STATUSES, MILESTONE_STATUSES: MILESTONE_STATUSES, GOAL_CATEGORIES: GOAL_CATEGORIES, MAX_TOP_PRIORITY_GOALS: MAX_TOP_PRIORITY_GOALS,
    SECTION_META_SOURCES: SECTION_META_SOURCES, ensureSectionMeta: ensureSectionMeta, touchSectionMeta: touchSectionMeta,
    computeSectionCompleteness: computeSectionCompleteness, computeProfileCompleteness: computeProfileCompleteness,
    ESSENTIAL_FIELD_LABELS: ESSENTIAL_FIELD_LABELS,
    FRESHNESS_CONFIG: FRESHNESS_CONFIG, getSectionFreshness: getSectionFreshness, goalDateNeedsReview: goalDateNeedsReview,
    ESSENTIAL_SECTION_IDS: ESSENTIAL_SECTION_IDS,
    PROFILE_LABELS: PROFILE_LABELS, labelOf: labelOf,
    GOAL_CATEGORY_FIELDS: GOAL_CATEGORY_FIELDS, categoryFieldsFor: categoryFieldsFor,
    normalizeMilestones: normalizeMilestones, addMilestone: addMilestone, updateMilestone: updateMilestone, removeMilestone: removeMilestone, moveMilestone: moveMilestone,
    diffState: diffState, bundlePlanImpact: bundlePlanImpact,
    PROFILE_SECTIONS: PROFILE_SECTIONS, CONSTRAINT_STATUSES: CONSTRAINT_STATUSES, BODY_REGIONS: BODY_REGIONS, BODY_SIDES: BODY_SIDES, normalizeConstraint: normalizeConstraint, normalizeRecovery: normalizeRecovery, normalizePreferences: normalizePreferences, normalizeAvailability: normalizeAvailability, availabilitySummary: availabilitySummary, WEEKDAYS: WEEKDAYS,
    normalizeSport: normalizeSport, normalizeSports: normalizeSports, normalizeDoubleSession: normalizeDoubleSession, normalizeSlot: normalizeSlot, normalizeFixedCommitment: normalizeFixedCommitment, FIXED_TYPES: FIXED_TYPES, INTENSITY_VALUES: INTENSITY_VALUES,
    normalizePerformance: normalizePerformance, normalizePersonalBest: normalizePersonalBest, normalizeStrengthRecord: normalizeStrengthRecord, normalizeWeightEntry: normalizeWeightEntry, normalizePerfMetric: normalizePerfMetric,
    currentWeightKg: currentWeightKg, estimate1RM: estimate1RM, parseDuration: parseDuration, formatDuration: formatDuration, parsePace: parsePace, formatPace: formatPace, PERF_SOURCES: PERF_SOURCES, SET_TYPES: SET_TYPES,
    normalizeDevices: normalizeDevices, INTEGRATION_IDS: INTEGRATION_IDS, INTEGRATION_STATUSES: INTEGRATION_STATUSES, INTEGRATION_DEFAULTS: INTEGRATION_DEFAULTS, normalizeIntegration: normalizeIntegration, normalizeEquipment: normalizeEquipment, normalizeTrainingLocation: normalizeTrainingLocation, normalizeManualSource: normalizeManualSource,
    SPORT_PROFILE_SCHEMAS: SPORT_PROFILE_SCHEMAS, sportProfileSchema: sportProfileSchema, rolesForPosition: rolesForPosition,
    performanceAreasFor: performanceAreasFor, PERF_AREAS: PERF_AREAS, perfLabel: perfLabel, SEASON_PHASES: SEASON_PHASES, LEVELS: LEVELS, positionsForVariant: positionsForVariant,
    normalizeSportProfile: normalizeSportProfile, normalizePerfPriority: normalizePerfPriority,
    POSITION_DEMAND_PROFILES: POSITION_DEMAND_PROFILES, ROLE_DEMAND_MODIFIERS: ROLE_DEMAND_MODIFIERS, resolveDemandProfile: resolveDemandProfile, validateSportCoverage: validateSportCoverage, filterLinkedSports: filterLinkedSports,
    activeConstraints: activeConstraints, constraintIssueKeys: constraintIssueKeys,
    PROFILE_FIELD_USAGE: PROFILE_FIELD_USAGE, getFieldUsage: getFieldUsage, usageStatusOf: usageStatusOf,
    consolidateProfile: consolidateProfile, buildProfileSummary: buildProfileSummary,
    ONBOARDING_STATUSES: ONBOARDING_STATUSES, ONBOARDING_STEPS: ONBOARDING_STEPS, normalizeOnboarding: normalizeOnboarding, isOnboardingComplete: isOnboardingComplete,
    PLAN_IMPACT_FIELDS: PLAN_IMPACT_FIELDS, categoryOf: categoryOf,
    normalizeGoal: normalizeGoal, normalizeGoals: normalizeGoals,
    addGoal: addGoal, updateGoal: updateGoal, removeGoal: removeGoal, setGoalStatus: setGoalStatus, setGoalPriority: setGoalPriority,
    detectGoalConflicts: detectGoalConflicts, sportFollowupSchema: sportFollowupSchema, validateGoal: validateGoal, validateEssentialGoals: validateEssentialGoals,
    validateEssentialAvailability: validateEssentialAvailability, validateSafetyCheck: validateSafetyCheck,
    migrateProfile: migrateProfile, normalizeProfile: normalizeProfile, newProfile: newProfile, buildSummary: buildSummary,
    buildLegacyProjection: buildLegacyProjection, legacyGoalKey: legacyGoalKey,
    roleOfGoal: roleOfGoal, priorityOfRole: priorityOfRole, ROLE_TO_PRIORITY: ROLE_TO_PRIORITY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.profileModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
