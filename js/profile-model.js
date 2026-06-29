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
  function normalizeConstraint(c, now) {
    c = c || {}; now = now || nowISO();
    return { id: c.id || uid('cstr'), bodyRegion: c.bodyRegion || c.region || '', title: c.title || '', intensity: c.intensity != null ? c.intensity : null,
      triggers: c.triggers || '', since: c.since || '', medicallyChecked: !!c.medicallyChecked, currentlyTrainable: c.currentlyTrainable != null ? !!c.currentlyTrainable : true,
      adaptations: c.adaptations || '', status: CONSTRAINT_STATUSES.indexOf(c.status) >= 0 ? c.status : 'active', updatedAt: now };
  }
  // Verfügbarkeit pro Wochentag normalisieren (vorhandene Werte erhalten).
  function normalizeAvailability(av) {
    av = av || {}; var weekly = av.weekly || {}; var out = {};
    WEEKDAYS.forEach(function (d) { var w = weekly[d] || {}; out[d] = { available: w.available != null ? !!w.available : true, maxMinutes: w.maxMinutes != null ? w.maxMinutes : null,
      timeOfDay: w.timeOfDay || '', fixed: w.fixed || '', teamTraining: !!w.teamTraining, matchDay: !!w.matchDay, doubleSession: !!w.doubleSession, intense: w.intense != null ? !!w.intense : true, restDay: !!w.restDay }; });
    return { weekly: out, maxSessions: av.maxSessions != null ? av.maxSessions : null, maxIntense: av.maxIntense != null ? av.maxIntense : null,
      desiredRestDays: av.desiredRestDays != null ? av.desiredRestDays : null, travelDays: av.travelDays || '', alternatingWeeks: !!av.alternatingWeeks };
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION, GOAL_STATUSES: GOAL_STATUSES, MILESTONE_STATUSES: MILESTONE_STATUSES, GOAL_CATEGORIES: GOAL_CATEGORIES, MAX_TOP_PRIORITY_GOALS: MAX_TOP_PRIORITY_GOALS,
    GOAL_CATEGORY_FIELDS: GOAL_CATEGORY_FIELDS, categoryFieldsFor: categoryFieldsFor,
    normalizeMilestones: normalizeMilestones, addMilestone: addMilestone, updateMilestone: updateMilestone, removeMilestone: removeMilestone, moveMilestone: moveMilestone,
    diffState: diffState, bundlePlanImpact: bundlePlanImpact,
    PROFILE_SECTIONS: PROFILE_SECTIONS, CONSTRAINT_STATUSES: CONSTRAINT_STATUSES, normalizeConstraint: normalizeConstraint, normalizeAvailability: normalizeAvailability, WEEKDAYS: WEEKDAYS,
    PLAN_IMPACT_FIELDS: PLAN_IMPACT_FIELDS, categoryOf: categoryOf,
    normalizeGoal: normalizeGoal, normalizeGoals: normalizeGoals,
    addGoal: addGoal, updateGoal: updateGoal, removeGoal: removeGoal, setGoalStatus: setGoalStatus, setGoalPriority: setGoalPriority,
    detectGoalConflicts: detectGoalConflicts, sportFollowupSchema: sportFollowupSchema, validateGoal: validateGoal,
    migrateProfile: migrateProfile, normalizeProfile: normalizeProfile, newProfile: newProfile, buildSummary: buildSummary,
    buildLegacyProjection: buildLegacyProjection, legacyGoalKey: legacyGoalKey,
    roleOfGoal: roleOfGoal, priorityOfRole: priorityOfRole, ROLE_TO_PRIORITY: ROLE_TO_PRIORITY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.profileModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
