/* ============================================================
   ORVIA · training-domain — Fachliche Konstanten + DTO-Mapper (Phase 4.1, NUR Modell)
   Single Source of Truth für Enums/Schlüssel der Trainingsdomäne (deckt sich mit 0003-Seeds).
   KEINE Plan-Engine, KEINE Volumen-Ampel, KEINE Berechnungen — nur Modell + Mapping + Validierung.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  const O = window.ORVIA;

  const D = {
    // --- Sportarten & Positionen ---
    SPORTS: ['gym', 'running', 'cycling', 'swimming', 'triathlon', 'football', 'handball', 'padel', 'tennis', 'athletics'],
    SPORT_ROLES: ['main', 'supplemental', 'occasional', 'club'],
    POSITIONS: {
      football: ['gk', 'cb', 'fb', 'dm', 'cm', 'am', 'wing', 'st'],
      handball: ['gk', 'wing', 'back', 'center', 'pivot']
    },
    SEASON_PHASES: ['offseason', 'preseason', 'inseason', 'transition'],
    EXPERIENCE_LEVELS: ['beginner', 'intermediate', 'experienced', 'performance', 'pro'],

    // --- Ziele ---
    GOAL_TYPES: ['hypertrophy', 'aesthetic_hypertrophy', 'max_strength', 'powerbuilding', 'fat_loss_muscle',
      'general_fitness', 'athletic', 'explosiveness', 'speed', 'injury_prevention', 'endurance',
      'competition_prep', 'sport_performance', 'maintenance'],
    GYM_GOAL_TYPES: ['hypertrophy', 'aesthetic_hypertrophy', 'max_strength', 'powerbuilding', 'athletic',
      'sport_specific_strength', 'explosiveness', 'robustness', 'injury_prevention', 'maintenance', 'comeback'],
    GOAL_PRIORITIES: ['primary', 'secondary', 'optional'],
    GOAL_STATUS: ['active', 'paused', 'completed'],

    // --- Bewegungsmuster (deckt sich mit movement_patterns-Seeds) ---
    MOVEMENT_PATTERNS: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge',
      'lunge', 'knee_flexion', 'hip_extension', 'calf', 'elbow_flexion', 'elbow_extension', 'shoulder_abduction',
      'shoulder_extension', 'trunk_flexion', 'trunk_extension', 'rotation', 'anti_rotation', 'carry', 'jump',
      'sprint', 'change_of_direction', 'throw', 'stability', 'mobility'],

    // --- Muskelgruppen (Schlüssel + Körperregion/Seite/Ansicht für spätere Körperkarte) ---
    MUSCLE_GROUPS: [
      { key: 'chest', region: 'torso', view: 'front' }, { key: 'front_delts', region: 'torso', view: 'front' },
      { key: 'side_delts', region: 'torso', view: 'front' }, { key: 'rear_delts', region: 'torso', view: 'back' },
      { key: 'biceps', region: 'arms', view: 'front' }, { key: 'triceps', region: 'arms', view: 'back' },
      { key: 'forearms', region: 'arms', view: 'front' }, { key: 'abs', region: 'core', view: 'front' },
      { key: 'lats', region: 'torso', view: 'back' }, { key: 'upper_back', region: 'torso', view: 'back' },
      { key: 'traps', region: 'torso', view: 'back' }, { key: 'lower_back', region: 'core', view: 'back' },
      { key: 'quads', region: 'legs', view: 'front' }, { key: 'hamstrings', region: 'legs', view: 'back' },
      { key: 'glutes', region: 'legs', view: 'back' }, { key: 'adductors', region: 'legs', view: 'front' },
      { key: 'abductors', region: 'legs', view: 'front' }, { key: 'calves', region: 'legs', view: 'back' },
      { key: 'hip_flexors', region: 'legs', view: 'front' }
    ],
    MUSCLE_INVOLVEMENT: ['direct', 'indirect'],
    // Spätere Körperkarten-Zustände (noch KEINE Grenzwerte berechnet) — nur Vokabular.
    BODY_MAP_STATES: ['no_data', 'insufficient', 'under_target', 'optimal', 'over_target', 'overloaded', 'not_prioritized'],
    MUSCLE_PRIORITIES: ['weak_point', 'normal', 'maintain', 'not_prioritized', 'sport_specific'],

    // --- Equipment & Umgebung ---
    EQUIPMENT: ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'pullup_bar', 'dip_bars', 'band', 'kettlebell',
      'bodyweight', 'rack', 'bench', 'leg_press', 'treadmill', 'ergometer', 'open_floor'],
    ENVIRONMENTS: ['full_gym', 'home_gym', 'minimal', 'none'],

    // --- Trainingsqualitäten (sportartspezifisch nutzbar) ---
    TRAINING_QUALITIES: ['hypertrophy', 'max_strength', 'power', 'speed', 'acceleration', 'cod', 'jump', 'robustness',
      'aerobic', 'threshold', 'vo2max', 'running_economy', 'core_stability', 'single_leg', 'injury_prevention'],

    // --- Pläne / Splits ---
    SPLIT_TYPES: ['full_body', 'upper_lower', 'push_pull', 'push_pull_legs', 'torso_limbs', 'upper_lower_full',
      'push_full_pull_full', 'arnold', 'bro_split', 'powerbuilding', 'sport_specific_strength', 'custom'],
    PLAN_STATUS: ['draft', 'active', 'archived'],

    // --- Workout / Sätze ---
    SESSION_STATUS: ['planned', 'active', 'completed', 'skipped', 'legacy'],
    SET_TYPES: ['warmup', 'working', 'top_set', 'backoff', 'dropset', 'rest_pause', 'myo_reps', 'amrap', 'technique', 'test'],

    // --- Beschwerden / Einschränkungen (Anschluss an daily_checkins complaints) ---
    COMPLAINT_REGIONS: ['knee', 'back', 'hip', 'shoulder', 'ankle', 'shin', 'foot', 'neck', 'elbow', 'wrist'],
    RESTRICTION_RULES: ['avoid', 'reduce', 'alternative']
  };

  // Sportart-Normalisierung → konsistenter lowercase-Key (verhindert getrennte Kategorien
  // für dieselbe Sportart, z.B. 'Gym'/'gym'/'Krafttraining' oder 'Laufen'/'run').
  // ENTSCHEIDUNG Mobilität: KEINE eigenständige Hauptsportart. Sie ist eine Modalität
  // (session_type='mobility') und wird sportartlich der Kraftkategorie zugeordnet → sport_key='gym'.
  // Dadurch liefert normSport() nur Keys, die valid.sport() akzeptiert (kein 'mobility' als Sport).
  const SPORT_ALIASES = {
    gym: 'gym', krafttraining: 'gym', kraft: 'gym', strength: 'gym',
    'mobilität': 'gym', mobilitaet: 'gym', mobility: 'gym', 'mobility training': 'gym',
    laufen: 'running', lauf: 'running', run: 'running', running: 'running',
    rad: 'cycling', radsport: 'cycling', bike: 'cycling', cycling: 'cycling',
    schwimmen: 'swimming', swim: 'swimming', swimming: 'swimming',
    'fußball': 'football', fussball: 'football', football: 'football', soccer: 'football',
    handball: 'handball', padel: 'padel', tennis: 'tennis', triathlon: 'triathlon', athletics: 'athletics'
  };
  // Unbekannte Eingaben fallen NICHT auf einen ungültigen Sport-Key zurück, sondern auf
  // 'athletics' (allgemeine Athletik) — damit valid.sport(normSport(x)) garantiert true ist.
  function normSport(v) { if (v == null) return null; const s = String(v).trim().toLowerCase(); return SPORT_ALIASES[s] || (D.SPORTS.indexOf(s) >= 0 ? s : 'athletics'); }

  function inList(list, v) { return list.indexOf(v) >= 0; }
  const valid = {
    sport: v => inList(D.SPORTS, v),
    splitType: v => inList(D.SPLIT_TYPES, v),
    setType: v => inList(D.SET_TYPES, v),
    movementPattern: v => inList(D.MOVEMENT_PATTERNS, v),
    goalType: v => inList(D.GOAL_TYPES, v),
    sessionStatus: v => inList(D.SESSION_STATUS, v),
    position: (sport, p) => !!(D.POSITIONS[sport] && D.POSITIONS[sport].indexOf(p) >= 0)
  };

  // --- DTO-Mapper (DB-Zeile ⇆ App-Objekt), tolerant gegenüber fehlenden Feldern ---
  const map = {
    exerciseFromRow(r) {
      r = r || {};
      return {
        id: r.id, slug: r.slug || null, name: r.name, aliases: r.aliases || [], description: r.description || null,
        category: r.category || null, movementPattern: r.movement_pattern || null, difficulty: r.difficulty || null,
        stability: r.stability || null, complexity: r.complexity || null, fatigueCost: r.fatigue_cost != null ? r.fatigue_cost : null,
        jointStress: r.joint_stress || {}, unilateral: !!r.unilateral, bodyweight: !!r.bodyweight,
        isSystem: r.is_system !== false, userId: r.user_id || null, active: r.active !== false
      };
    },
    exerciseToRow(e) {
      e = e || {};
      return {
        name: e.name, aliases: e.aliases || [], description: e.description || null, category: e.category || null,
        movement_pattern: e.movementPattern || null, difficulty: e.difficulty || null, stability: e.stability || null,
        complexity: e.complexity || null, fatigue_cost: e.fatigueCost != null ? e.fatigueCost : null,
        joint_stress: e.jointStress || {}, unilateral: !!e.unilateral, bodyweight: !!e.bodyweight,
        is_system: false   // nutzerdefinierte Übungen sind NIE system
      };
    },
    setToRow(s) {
      s = s || {};
      return {
        set_number: s.setNumber, set_type: s.setType || 'working',
        weight: s.weight != null ? s.weight : null, reps: s.reps != null ? s.reps : null,
        rir: s.rir != null ? s.rir : null, rpe: s.rpe != null ? s.rpe : null,
        duration_s: s.durationS != null ? s.durationS : null, distance_m: s.distanceM != null ? s.distanceM : null,
        time_s: s.timeS != null ? s.timeS : null, tempo: s.tempo || null, rest_s: s.restS != null ? s.restS : null,
        completed: !!s.completed, pain: s.pain != null ? s.pain : null, technique: s.technique != null ? s.technique : null,
        recorded_at: s.recordedAt || new Date().toISOString()
      };
    }
  };

  O.trainingDomain = Object.assign({}, D, { valid: valid, map: map, inList: inList, normSport: normSport });
})();
