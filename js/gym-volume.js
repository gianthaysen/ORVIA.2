/* ============================================================
   ORVIA · gym-volume — Muskelvolumen-Engine (Inkrement 2C).
   Aus REALEN Workout-Sätzen (lokale Snapshots). STRIKTE Trennung:
   realWorkingSets ≠ directSets ≠ indirectSetEquivalents ≠ effectiveSetEquivalents.
   Jeder (Dezimal-)Wert ist über explainMuscleVolume() auf Übungen + reale Sätze + Ausschlüsse
   rückführbar. KEINE universelle 10–20-Regel; konservative, individuell anpassbare Startkorridore.
   Koeffizienten zentral konfigurierbar; sekundär NICHT pauschal 0,5. Unbekannte Übung = unclassified.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var MAPPING_VERSION = '2c.1';
  // Zählbare Satztypen = real geleistete Arbeitssätze. Aufwärm-/Technik-/Probe-Sätze zählen NICHT.
  var COUNTABLE_SET_TYPES = { working: 1, top_set: 1, backoff: 1, dropset: 1, amrap: 1, myo_reps: 1 };
  var NONCOUNT_TYPES = { warmup: 'warmup', technique: 'technique', test: 'test' };
  var DIRECT = 1.0, INDIRECT = 0.5;   // Default-Koeffizienten; pro Mapping überschreibbar.

  // Muskel-IDs (getrennte Schulterköpfe; Lats vs. oberer Rücken; Quads/Hamstrings/Glutes getrennt).
  var MUSCLES = ['chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'biceps',
    'lats', 'upper_back', 'lower_back', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms'];
  var MUSCLE_LABEL = {
    chest: 'Brust', front_delts: 'Vordere Schulter', side_delts: 'Seitliche Schulter', rear_delts: 'Hintere Schulter',
    triceps: 'Trizeps', biceps: 'Bizeps', lats: 'Lats', upper_back: 'Oberer Rücken', lower_back: 'Unterer Rücken',
    quads: 'Quadrizeps', hamstrings: 'Beinbeuger', glutes: 'Gesäß', calves: 'Waden', abs: 'Core', forearms: 'Unterarme'
  };

  // Koeffizient eines Mapping-Werts: 'direct'→1.0, 'indirect'→0.5, Zahl→exakt. (sekundär nicht pauschal 0,5)
  function coeffOf(v) { if (v === 'direct') return DIRECT; if (v === 'indirect') return INDIRECT; var n = +v; return isFinite(n) ? n : INDIRECT; }
  function roleOf(v) { var c = coeffOf(v); return c >= 1 ? 'direct' : 'indirect'; }

  // Name-basiertes Mapping (normalisierte deutsche/engl. Übungsnamen). Sekundär mit spezifischem Koeffizient.
  var NAME_MUSCLES = {
    'brustpresse': { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    'bankdrücken': { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    'bankdruecken': { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    'schrägbankdrücken': { chest: 'direct', front_delts: 0.5, triceps: 0.5 },
    'schraegbankdruecken': { chest: 'direct', front_delts: 0.5, triceps: 0.5 },
    'flys': { chest: 'direct', front_delts: 0.25 },
    'fliegende': { chest: 'direct', front_delts: 0.25 },
    'cable fly': { chest: 'direct', front_delts: 0.25 },
    'schulterdrücken': { front_delts: 'direct', side_delts: 0.5, triceps: 0.5 },
    'schulterdruecken': { front_delts: 'direct', side_delts: 0.5, triceps: 0.5 },
    'overhead press': { front_delts: 'direct', side_delts: 0.5, triceps: 0.5 },
    'seitheben': { side_delts: 'direct' },
    'lateral raise': { side_delts: 'direct' },
    'reverse pec deck': { rear_delts: 'direct' },
    'reverse fly': { rear_delts: 'direct' },
    'reverse flys': { rear_delts: 'direct' },
    'rudern': { upper_back: 'direct', lats: 0.5, biceps: 0.5, rear_delts: 0.5 },
    'row': { upper_back: 'direct', lats: 0.5, biceps: 0.5, rear_delts: 0.5 },
    'latzug': { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    'lat pulldown': { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    'klimmzüge': { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    'klimmzuege': { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    'pull up': { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    'bizepscurls': { biceps: 'direct' },
    'bizeps curls': { biceps: 'direct' },
    'curl': { biceps: 'direct' },
    'trizepsdrücken': { triceps: 'direct' },
    'trizepsdruecken': { triceps: 'direct' },
    'triceps pushdown': { triceps: 'direct' },
    'kniebeuge': { quads: 'direct', glutes: 0.5, lower_back: 0.25 },
    'squat': { quads: 'direct', glutes: 0.5, lower_back: 0.25 },
    'beinpresse': { quads: 'direct', glutes: 0.5 },
    'leg press': { quads: 'direct', glutes: 0.5 },
    'beinstrecker': { quads: 'direct' },
    'leg extension': { quads: 'direct' },
    'beinbeuger': { hamstrings: 'direct' },
    'leg curl': { hamstrings: 'direct' },
    'romanian deadlift': { hamstrings: 'direct', glutes: 'direct', lower_back: 0.5 },
    'rdl': { hamstrings: 'direct', glutes: 'direct', lower_back: 0.5 },
    'hip thrust': { glutes: 'direct', hamstrings: 0.5 },
    'wadenheben': { calves: 'direct' },
    'calf raise': { calves: 'direct' },
    'plank': { abs: 'direct' }, 'crunch': { abs: 'direct' }, 'core': { abs: 'direct' }
  };
  // ID-basiert (kanonische Slugs) + Movement-Pattern-Fallback (additiv, abwärtskompatibel).
  var EXERCISE_MUSCLES = {
    bench_press: { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    bench_press_machine: { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    incline_bench_press: { chest: 'direct', front_delts: 0.5, triceps: 0.5 },
    overhead_press: { front_delts: 'direct', side_delts: 0.5, triceps: 0.5 },
    lateral_raise: { side_delts: 'direct' }, reverse_pec_deck: { rear_delts: 'direct' },
    pull_up: { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    lat_pulldown: { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    barbell_row: { upper_back: 'direct', lats: 0.5, biceps: 0.5, rear_delts: 0.5 },
    biceps_curl: { biceps: 'direct' }, triceps_pushdown: { triceps: 'direct' },
    squat: { quads: 'direct', glutes: 0.5, lower_back: 0.25 }, leg_press: { quads: 'direct', glutes: 0.5 },
    romanian_deadlift: { hamstrings: 'direct', glutes: 'direct', lower_back: 0.5 },
    deadlift: { glutes: 'direct', hamstrings: 'direct', lower_back: 'direct', upper_back: 0.5 },
    leg_curl: { hamstrings: 'direct' }, leg_extension: { quads: 'direct' },
    hip_thrust: { glutes: 'direct', hamstrings: 0.5 }, calf_raise: { calves: 'direct' }, plank: { abs: 'direct' }
  };
  var PATTERN_MUSCLES = {
    horizontal_push: { chest: 'direct', triceps: 0.5, front_delts: 0.5 },
    vertical_push: { front_delts: 'direct', side_delts: 0.5, triceps: 0.5 },
    horizontal_pull: { upper_back: 'direct', lats: 0.5, biceps: 0.5 },
    vertical_pull: { lats: 'direct', biceps: 0.5, upper_back: 0.5 },
    squat: { quads: 'direct', glutes: 0.5 }, hinge: { hamstrings: 'direct', glutes: 'direct', lower_back: 0.5 },
    lunge: { quads: 'direct', glutes: 0.5 }, knee_extension: { quads: 'direct' }, knee_flexion: { hamstrings: 'direct' },
    hip_extension: { glutes: 'direct' }, calf: { calves: 'direct' }, elbow_flexion: { biceps: 'direct' },
    elbow_extension: { triceps: 'direct' }, shoulder_abduction: { side_delts: 'direct' }, trunk_flexion: { abs: 'direct' }
  };

  function normName(n) { return String(n == null ? '' : n).trim().toLowerCase(); }
  // Muskelzuordnung einer Übung: Name (bevorzugt) → ID-Slug → Movement-Pattern. Sonst null (unclassified).
  function musclesFor(ex, mapOverride) {
    var nameMap = (mapOverride && mapOverride.names) || NAME_MUSCLES;
    var idMap = (mapOverride && mapOverride.ids) || EXERCISE_MUSCLES;
    var patMap = (mapOverride && mapOverride.patterns) || PATTERN_MUSCLES;
    var nm = normName(ex && (ex.exerciseNameSnapshot || ex.exerciseName || ex.name));
    if (nm && nameMap[nm]) return nameMap[nm];
    var id = ex && (ex.exerciseId || ex.exercise_id);
    if (id && idMap[id]) return idMap[id];
    var pat = ex && (ex.movementPattern || ex.movement_pattern);
    if (pat && patMap[pat]) return patMap[pat];
    return null;   // unbekannt → KEINE erfundene Zuordnung
  }
  function isClassified(ex, mapOverride) { return !!musclesFor(ex, mapOverride); }

  // Gültiger Arbeitssatz: completed, zählbarer Typ, reps>0 (oder Zeit/Dauer für Isometrie). RIR ist NUR Kontext.
  function setExclusionReason(set) {
    if (!set) return 'empty';
    if (set.completed !== true) return 'not_completed';
    var t = set.setType || set.set_type || 'working';
    if (NONCOUNT_TYPES[t]) return NONCOUNT_TYPES[t];           // warmup/technique/test
    if (!COUNTABLE_SET_TYPES[t]) return 'noncountable_type';
    var reps = (set.reps != null) ? +set.reps : null;
    var dur = (set.durationS != null ? +set.durationS : (set.timeS != null ? +set.timeS : (set.time_s != null ? +set.time_s : null)));
    if ((reps == null || !(reps > 0)) && !(dur > 0)) return 'no_reps';
    return null;                                               // null = zählt
  }
  function isCountable(set) { return setExclusionReason(set) == null; }
  function realSetsOf(ex) { return ((ex && ex.sets) || []).filter(isCountable).length; }

  // Kern: je Muskel getrennte Kennzahlen + Beitragsliste + Ausschlüsse aus Snapshots.
  // snapshots: [{ workoutId, startedAt, exercises:[{exerciseId, exerciseNameSnapshot, sets:[...]}] }]
  function computeMuscleVolume(snapshots, opts) {
    opts = opts || {}; var map = opts.mapping;
    var byMuscle = {}, exclusions = [], unclassified = {};
    (snapshots || []).forEach(function (w) {
      (w && w.exercises || []).forEach(function (ex) {
        var name = (ex && (ex.exerciseNameSnapshot || ex.exerciseName)) || (ex && (ex.exerciseId || ex.exercise_id)) || 'Übung';
        var sets = (ex && ex.sets) || [];
        // Ausschlüsse erfassen (Aufwärm/unvollständig/leer …) — begründet, rückführbar.
        sets.forEach(function (st) { var rsn = setExclusionReason(st); if (rsn) exclusions.push({ setId: st && (st.id || st.client_set_id || st.setNumber || null), exerciseId: ex && (ex.exerciseId || ex.exercise_id) || null, exerciseName: name, reason: rsn, workoutId: w.workoutId || null }); });
        var real = sets.filter(isCountable).length; if (real <= 0) return;
        var muscles = musclesFor(ex, map);
        if (!muscles) { unclassified[name] = (unclassified[name] || 0) + real; return; }  // sichtbar als unklassifiziert
        Object.keys(muscles).forEach(function (mk) {
          var c = coeffOf(muscles[mk]), role = roleOf(muscles[mk]);
          var m = byMuscle[mk] || (byMuscle[mk] = { muscle: mk, realWorkingSets: 0, directSets: 0, indirectSetEquivalents: 0, effectiveSets: 0, contributions: [] });
          m.realWorkingSets += real;
          if (role === 'direct') m.directSets += real; else m.indirectSetEquivalents += real * c;
          m.effectiveSets += real * c;
          m.contributions.push({ workoutId: w.workoutId || null, date: (w.startedAt || '').slice(0, 10) || null, exerciseId: ex && (ex.exerciseId || ex.exercise_id) || null, exerciseName: name, completedWorkingSets: real, relationship: role, coefficient: c, contribution: Math.round(real * c * 100) / 100 });
        });
      });
    });
    Object.keys(byMuscle).forEach(function (k) { var m = byMuscle[k]; m.directSets = Math.round(m.directSets * 10) / 10; m.indirectSetEquivalents = Math.round(m.indirectSetEquivalents * 10) / 10; m.effectiveSets = Math.round(m.effectiveSets * 10) / 10; });
    return { byMuscle: byMuscle, exclusions: exclusions, unclassified: unclassified };
  }

  function weeklyEquivalent(effectiveSets, days) { days = (days == null || isNaN(days)) ? 7 : +days; if (days <= 0) return 0; return Math.round((+effectiveSets || 0) / days * 7 * 10) / 10; }

  // Zielkorridore (konservativ, individuell anpassbar) — KEINE universelle 10–20-Regel.
  // experience: beginner|intermediate|advanced; goal: hypertrophy|maintenance|strength.
  var CORRIDORS = {
    hypertrophy: { beginner: [4, 8], intermediate: [6, 12], advanced: [8, 16] },
    maintenance: { beginner: [3, 6], intermediate: [4, 8], advanced: [5, 9] }
  };
  function targetCorridor(opts) {
    opts = opts || {};
    if (opts.dataWeeks != null && opts.dataWeeks < 2) return { min: null, max: null, source: 'insufficient_data' };
    var goal = opts.goal || 'hypertrophy';
    if (goal === 'strength') return { min: null, max: null, source: 'strength_movement_based' };  // bewegungs-/übungsspezifisch, nicht satzbasiert
    var exp = opts.experience || 'beginner';
    var table = CORRIDORS[goal] || CORRIDORS.hypertrophy;
    var r = table[exp] || table.beginner;
    return { min: r[0], max: r[1], source: 'conservative_start:' + goal + ':' + exp };
  }

  // Konfidenz aus Datenlage: Wochen, Gesamtsätze, Anteil unklassifiziert.
  function confidenceOf(opts) {
    opts = opts || {}; var weeks = opts.weeks || 0, sets = opts.totalSets || 0, unclassRatio = opts.unclassifiedRatio || 0;
    if (weeks < 2 || sets < 4) return 'low';
    if (unclassRatio > 0.25) return 'low';
    if (weeks >= 4 && sets >= 12 && unclassRatio <= 0.1) return 'high';
    return 'medium';
  }

  // Rückführbarer Volumenbericht eines Muskels (vollständige Explainability).
  function explainMuscleVolume(muscle, snapshots, opts) {
    opts = opts || {}; var days = opts.days != null ? opts.days : 7;
    var res = computeMuscleVolume(snapshots, opts);
    var vol = res.byMuscle[muscle] || { realWorkingSets: 0, directSets: 0, indirectSetEquivalents: 0, effectiveSets: 0, contributions: [] };
    var totalSets = 0; Object.keys(res.byMuscle).forEach(function (k) { totalSets += res.byMuscle[k].directSets; });
    var unclassCount = Object.keys(res.unclassified).reduce(function (a, k) { return a + res.unclassified[k]; }, 0);
    var target = targetCorridor({ goal: opts.goal, experience: opts.experience, dataWeeks: opts.weeks });
    return {
      muscleId: muscle,
      period: { days: days, from: opts.from || null, to: opts.to || null },
      realWorkingSets: vol.realWorkingSets,
      directSets: vol.directSets,
      indirectSetEquivalents: vol.indirectSetEquivalents,
      effectiveSetEquivalents: vol.effectiveSets,
      effectiveSetsPerWeek: weeklyEquivalent(vol.effectiveSets, days),
      targetRange: target,
      confidence: confidenceOf({ weeks: opts.weeks, totalSets: vol.realWorkingSets, unclassifiedRatio: (vol.realWorkingSets + unclassCount) ? unclassCount / (vol.realWorkingSets + unclassCount) : 0 }),
      contributions: vol.contributions,
      exclusions: res.exclusions.filter(function (e) { return true; })
    };
  }

  // Status eines Muskels gegen seinen Korridor (Farbe NIE als einzige Info; nicht aggressiv bei Einzelwert).
  function statusFor(effectiveWeekly, target) {
    if (!target || target.min == null) return { key: 'insufficient_data', label: 'Noch zu wenig Daten' };
    if (effectiveWeekly == null || effectiveWeekly <= 0) return { key: 'insufficient_data', label: 'Noch zu wenig Daten' };
    if (effectiveWeekly < target.min) return { key: 'below', label: 'Unter aktuellem Zielkorridor' };
    if (effectiveWeekly <= target.max) return { key: 'in', label: 'Im Zielkorridor' };
    return { key: 'above', label: 'Oberhalb des Zielkorridors' };
  }

  // Adaptive Empfehlung (konservativ): erhöht NIE bei schlechter Erholung/hoher Ausdauerlast.
  // ctx: { performanceTrend:'up|flat|down', painUp, poorRecovery, highDoms, rirMissed, poorSleep, highEndurance, weeks }
  // Liefert: 'insufficient' | 'hold' | 'observe' | 'reduce' | 'room_to_progress' (nie „übertraining").
  function volumeAdvice(ctx) {
    ctx = ctx || {};
    if ((ctx.weeks || 0) < 2) return { advice: 'insufficient', text: 'Noch nicht genug Daten für eine Empfehlung.' };
    var caution = ctx.painUp || ctx.poorRecovery || ctx.highDoms || ctx.poorSleep || ctx.rirMissed || (ctx.performanceTrend === 'down');
    if (caution) return { advice: 'reduce', text: 'Das Volumen könnte aktuell oberhalb deiner gut tolerierten Belastung liegen.' };
    if (ctx.highEndurance) return { advice: 'hold', text: 'Hohe parallele Ausdauerbelastung — Kraftvolumen vorerst halten.' };
    if (ctx.performanceTrend === 'up') return { advice: 'room_to_progress', text: 'Stabil und gut erholt — vorsichtige Steigerung möglich.' };
    return { advice: 'hold', text: 'Volumen stabil halten und beobachten.' };
  }

  // Shadow-Vergleich gegen alte Server-Effektivwerte (Verifikation vor UI-Umschaltung).
  function compareToLegacy(snapshots, legacyEffectiveByMuscle, opts) {
    var res = computeMuscleVolume(snapshots, opts); var shadow = res.byMuscle; var out = {};
    var keys = {}; Object.keys(shadow).forEach(function (k) { keys[k] = 1; }); Object.keys(legacyEffectiveByMuscle || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var s = shadow[k] ? shadow[k].effectiveSets : 0; var l = (legacyEffectiveByMuscle && legacyEffectiveByMuscle[k]) || 0;
      out[k] = { muscleId: k, shadow: s, legacy: l, difference: Math.round((s - l) * 10) / 10, contributions: shadow[k] ? shadow[k].contributions : [] };
    });
    return out;
  }

  // ---- Robuste Sport-/Status-/Feld-Auflösung (mehrere historische Schemata) ----
  var GYM_ALIASES = { gym: 1, strength: 1, strength_training: 1, weight_training: 1, weights: 1, krafttraining: 1, kraft: 1, workout: 1 };
  function isGymSport(a) {
    var raw = a && (a.sportId != null ? a.sportId : (a.sport_id != null ? a.sport_id : (a.type != null ? a.type : (a.summary && a.summary.sportId) || (a.metrics && a.metrics.sportId))));
    if (raw == null) return a && a.source === 'orvia_workout';   // Workout ohne Sportfeld → als Gym werten
    var n = (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(raw) : String(raw).toLowerCase();
    return n === 'gym' || GYM_ALIASES[String(raw).trim().toLowerCase()] === 1;
  }
  function isCompleted(a) {
    var st = a && (a.status || a.state);
    if (st && /^(completed|finished|done|complete)$/i.test(st)) return true;
    if (a && (a.endedAt || a.ended_at || a.finished_at)) return true;
    if (a && a.source === 'orvia_workout' && (a.durationSeconds != null || a.endedAt)) return true;
    return !st;   // kein expliziter Status → nicht allein deswegen verwerfen
  }
  function dateOf(a) {
    var d = a && (a.startedAt || a.started_at || a.date || (a.snapshot && a.snapshot.startedAt) || (a.summary && a.summary.startedAt));
    return d || null;
  }
  function exercisesOf(a) {
    return (a && (a.workoutSnapshot || a.snapshot && a.snapshot.exercises || a.exercises || (a.metrics && a.metrics.exercises))) || null;
  }
  function dedupKey(a) { return a.workoutSessionId || a.clientRecordId || ((a.source || '') + '|' + (a.sourceRecordId || '')) || a.id || null; }

  // Zugriff auf den Legacy-Tagesspeicher DB (data.js: globales `let DB`).
  function getDB() { try { if (typeof DB !== 'undefined') return DB; } catch (e) {} return (typeof window !== 'undefined' && window.DB) ? window.DB : null; }
  // Legacy DB[date].sessions.Gym.exLog → kandidaten im internen Activity-Schema (mit synthetischen Sätzen).
  // Projektionen kanonischer Activities (derivedFromActivity) werden NICHT erneut gezählt.
  function legacyGymCandidates() {
    var db = getDB(); if (!db) return [];
    var out = [];
    try {
      Object.keys(db).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        var s = db[k] && db[k].sessions; var g = s && s.Gym; if (!g) return;
        if (g.derivedFromActivity) return;                  // Projektion → kanonisch existiert
        var log = (g.exLog && g.exLog.length) ? g.exLog : null; if (!log) return;
        var exercises = log.map(function (x) {
          var n = (x.sets != null && x.sets > 0) ? x.sets : ((x.reps != null || x.kg != null) ? 1 : 0);
          var sets = []; for (var i = 0; i < n; i++) sets.push({ set_type: 'working', completed: true, reps: (x.reps != null ? x.reps : 1), weight: (x.kg != null ? x.kg : null) });
          return { exerciseNameSnapshot: x.n, sets: sets };
        });
        out.push({ source: 'legacy_db', sportId: 'gym', status: 'completed', startedAt: k + 'T12:00:00.000Z',
          workoutSessionId: g.workoutSessionId || g.clientSessionId || null, clientRecordId: g.canonicalActivityId || null, exercises: exercises });
      });
    } catch (e) {}
    return out;
  }

  // Vollständige Pipeline: liefert {snapshots, diagnostics}. Quellen werden in opts übergeben (Server/refresh
  // via gymPipelineAsync). Reine, synchrone Filterung + Diagnose; kein Netzwerk hier.
  function gymPipeline(opts) {
    opts = opts || {}; var store = O.activityStore;
    var days = opts.days || 28; var toMs = Date.now(), fromMs = toMs - (days - 1) * 864e5;
    var local = (store && store.listActivities) ? store.listActivities() : [];
    var server = opts.serverActivities || (O.activityServerCache ? O.activityServerCache() : []) || [];
    var legacy = opts.legacyActivities || legacyGymCandidates();
    var diag = {
      rawLocalActivityCount: local.length, rawServerActivityCount: server.length,
      rawWorkoutSessionCount: (opts.workoutSessions || []).length, rawLegacySessionCount: legacy.length,
      gymCandidatesBeforeDateFilter: 0, gymCandidatesAfterDateFilter: 0, completedCandidates: 0, snapshotCandidates: 0,
      rejectedByReason: { wrongSport: 0, wrongStatus: 0, outsidePeriod: 0, tombstoned: 0, missingSnapshot: 0, missingExercises: 0, malformed: 0 },
      detectedSchemas: []
    };
    function schema(src, arr) { if (!arr || !arr.length) return; var f = {}; arr.slice(0, 8).forEach(function (a) { Object.keys(a || {}).forEach(function (k) { f[k] = 1; }); }); diag.detectedSchemas.push({ source: src, count: arr.length, fields: Object.keys(f) }); }
    schema('activityStore', local); schema('serverActivities', server); schema('legacy_db', legacy); schema('workoutSessions', opts.workoutSessions || []);
    var all = local.concat(server).concat(opts.workoutSessions || []).concat(legacy);
    var seen = {}, out = [];
    all.forEach(function (a) {
      if (!a || typeof a !== 'object') { diag.rejectedByReason.malformed++; return; }
      if (!isGymSport(a)) { diag.rejectedByReason.wrongSport++; return; }
      diag.gymCandidatesBeforeDateFilter++;
      var d = dateOf(a); var t = d ? new Date(d).getTime() : null;
      if (t != null && (t < fromMs || t > toMs)) { diag.rejectedByReason.outsidePeriod++; return; }
      diag.gymCandidatesAfterDateFilter++;
      if (!isCompleted(a)) { diag.rejectedByReason.wrongStatus++; return; }
      diag.completedCandidates++;
      if (store && store.isTombstoned && store.isTombstoned(a)) { diag.rejectedByReason.tombstoned++; return; }
      var exs = exercisesOf(a);
      if (!exs) { diag.rejectedByReason.missingSnapshot++; return; }
      if (!exs.length) { diag.rejectedByReason.missingExercises++; return; }
      var key = dedupKey(a);
      if (key && seen[key]) return;            // Dedup: lokal/Server/Legacy desselben Workouts nur einmal
      if (key) seen[key] = true;
      diag.snapshotCandidates++;
      out.push({ workoutId: a.workoutSessionId || a.clientRecordId || null, startedAt: d, exercises: exs });
    });
    return { snapshots: out, diagnostics: diag };
  }
  function snapshotsFromStore(opts) { return gymPipeline(opts).snapshots; }

  // Auf App-Daten warten (Auth/Stores/Repos), max. ~12 s. Kein Endlos-Warten.
  function gymDataReadiness() {
    return {
      authReady: !!(O.user && O.user.id),
      localStoreReady: !!(O.activityStore && O.activityStore.listActivities),
      activityRepositoryReady: !!(O.repos && O.repos.activity && O.repos.activity.list),
      workoutRepositoryReady: !!(O.repos && O.repos.workout && O.repos.workout.loadWorkoutTree)
    };
  }
  function waitForGymDataDependencies(maxMs) {
    maxMs = maxMs || 12000; var step = 300;
    return new Promise(function (resolve) {
      var waited = 0;
      (function poll() {
        var r = gymDataReadiness();
        if (r.localStoreReady && (r.authReady || waited >= 3000) || waited >= maxMs) { r.timedOut = waited >= maxMs; resolve(r); return; }
        waited += step; setTimeout(poll, step);
      })();
    });
  }

  // Asynchrone Quellensammlung: Server-Repo (bei refresh) + Workout-Detail-Nachladen für Server-Gym ohne Snapshot.
  async function gymPipelineAsync(opts) {
    opts = opts || {}; var days = opts.days || 28; var calls = [];
    function call(source, attempted, success, returnedCount, errorCode) { calls.push({ source: source, attempted: attempted, success: success, returnedCount: returnedCount, errorCode: errorCode || null }); }
    var store = O.activityStore;
    var local = (store && store.listActivities) ? store.listActivities() : [];
    call('activityStore', true, !!store, local.length, store ? null : 'STORE_NOT_READY');
    var legacy = legacyGymCandidates();
    call('legacy_db', true, !!getDB(), legacy.length, getDB() ? null : 'NO_DATA_SOURCE');
    // Server: bei refresh authoritative Repository-Abfrage, sonst Cache.
    var server = [];
    if (opts.refresh && O.repos && O.repos.activity && O.repos.activity.list) {
      try { var rs = await O.repos.activity.list({ limit: 300 }); if (rs && rs.success) { server = (rs.data || []).map(function (r) { return O.activityConfig ? O.activityConfig.normalizeServerActivity(r) : r; }); call('activityRepository.list', true, true, server.length, null); } else { call('activityRepository.list', true, false, 0, (rs && rs.error && rs.error.code) || 'SERVER_LIST_FAILED'); } }
      catch (e) { call('activityRepository.list', true, false, 0, 'SERVER_LIST_FAILED'); }
    } else { server = (O.activityServerCache ? O.activityServerCache() : []) || []; call('activityServerCache', true, true, server.length, null); }
    // Workout-Detail-Nachladen für Server-Gym-Activities mit workoutSessionId aber ohne lokalen Snapshot.
    var workoutSessions = [];
    if (opts.refresh && O.repos && O.repos.workout && O.repos.workout.loadWorkoutTree) {
      var need = server.filter(function (a) { return isGymSport(a) && a.workoutSessionId && !exercisesOf(a); });
      var loadedIds = {}; var detailFails = 0;
      for (var i = 0; i < need.length; i++) {
        var sid = need[i].workoutSessionId; if (loadedIds[sid]) continue; loadedIds[sid] = true;
        try {
          var tr = await O.repos.workout.loadWorkoutTree(sid);
          if (tr && tr.success && tr.data && tr.data.session) {
            var exs = (tr.data.exercises || []).map(function (ex) { return { exerciseNameSnapshot: (ex.exercise && ex.exercise.name) || null, sets: (ex.sets || []) }; });
            workoutSessions.push({ source: 'workout_session', sportId: 'gym', status: 'completed', startedAt: tr.data.session.started_at || tr.data.session.local_date, workoutSessionId: sid, exercises: exs });
          } else detailFails++;
        } catch (e) { detailFails++; }
      }
      call('workoutRepository.loadWorkoutTree', need.length > 0, detailFails === 0, workoutSessions.length, detailFails ? 'WORKOUT_DETAILS_FAILED' : null);
    }
    var pipe = gymPipeline({ days: days, serverActivities: server, legacyActivities: legacy, workoutSessions: workoutSessions });
    pipe.diagnostics.sourceCalls = calls;
    return pipe;
  }

  // ---- On-Device-Shadow-Report (rein, serialisierbar, KEIN Netzwerk, KEINE Mutation) ----
  function storageInspection() {
    var out = { availableKeys: [], matchingKeyCounts: {} };
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return out;
      var keys = []; try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) { keys = Object.keys(localStorage); }
      keys.forEach(function (k) {
        if (!k || k.indexOf('orvia') < 0) return;
        out.availableKeys.push(k);                       // nur Key-NAMEN, keine Werte
        if (/orvia_activities_/.test(k) || /orvia_active_workout/.test(k)) { try { var v = JSON.parse(localStorage.getItem(k)); out.matchingKeyCounts[k] = Array.isArray(v) ? v.length : (v ? 1 : 0); } catch (e) {} }
      });
    } catch (e) {}
    return out;
  }
  function visibleActivityPipeline() {
    var info = { functionName: null, resultCount: null, gymResultCount: null };
    try {
      if (typeof window !== 'undefined' && typeof window.listActivitiesUnified === 'function') {
        info.functionName = 'listActivitiesUnified';
        var list = window.listActivitiesUnified(500) || [];
        info.resultCount = list.length;
        info.gymResultCount = list.filter(function (a) { return isGymSport(a); }).length;
      }
    } catch (e) {}
    return info;
  }
  async function buildShadowReport(opts) {
    opts = opts || {}; var days = opts.days || 28;
    var readiness = await waitForGymDataDependencies(opts.maxWaitMs);
    var pipe = await gymPipelineAsync({ days: days, refresh: opts.refresh });
    pipe.diagnostics.readiness = readiness;
    pipe.diagnostics.storageInspection = storageInspection();
    pipe.diagnostics.visibleActivityPipeline = visibleActivityPipeline();
    var snaps = pipe.snapshots;
    var res = computeMuscleVolume(snaps);
    var toMs = Date.now(), fromMs = toMs - (days - 1) * 864e5;
    var weeks = Math.round((days / 7) * 10) / 10;
    var exerciseCount = 0, validSets = 0;
    snaps.forEach(function (w) { (w.exercises || []).forEach(function (e) { exerciseCount++; validSets += realSetsOf(e); }); });
    var legacy = opts.legacyByMuscle || null;   // Server-Legacy offline nicht verfügbar → optional übergeben
    var muscles = MUSCLES.map(function (mk) {
      var m = res.byMuscle[mk]; var eff = m ? m.effectiveSets : 0;
      var lv = (legacy && legacy[mk] != null) ? legacy[mk] : null;
      return {
        muscleId: mk, label: MUSCLE_LABEL[mk],
        realWorkingSets: m ? m.realWorkingSets : 0, directSets: m ? m.directSets : 0,
        indirectSetEquivalents: m ? m.indirectSetEquivalents : 0, effectiveSetEquivalents: eff,
        weeklyEquivalent: weeklyEquivalent(eff, days),
        legacyValue: lv, differenceToLegacy: lv != null ? Math.round((eff - lv) * 10) / 10 : null,
        targetRange: targetCorridor({ goal: opts.goal, experience: opts.experience, dataWeeks: weeks }),
        confidence: confidenceOf({ weeks: weeks, totalSets: m ? m.realWorkingSets : 0, unclassifiedRatio: 0 })
      };
    }).filter(function (x) { return x.realWorkingSets > 0 || x.legacyValue != null; });
    var unclassifiedExercises = Object.keys(res.unclassified).map(function (n) { return { exerciseId: null, exerciseName: n, occurrenceCount: null, workingSetCount: res.unclassified[n] }; });
    var exclusionsByReason = {}; res.exclusions.forEach(function (e) { exclusionsByReason[e.reason] = (exclusionsByReason[e.reason] || 0) + 1; });
    var dg = pipe.diagnostics;
    var anyRaw = (dg.rawLocalActivityCount + dg.rawServerActivityCount + dg.rawWorkoutSessionCount + dg.rawLegacySessionCount) > 0;
    var anyFail = (dg.sourceCalls || []).some(function (c) { return c.attempted && !c.success; });
    var visGym = dg.visibleActivityPipeline && dg.visibleActivityPipeline.gymResultCount;
    var reportStatus;
    if (!readiness.localStoreReady || readiness.timedOut) reportStatus = 'data_unavailable';
    else if (snaps.length > 0) reportStatus = anyFail ? 'partial_data' : 'ok';
    else if (!anyRaw) reportStatus = 'data_unavailable';
    else reportStatus = anyFail ? 'load_error' : 'no_gym_workouts';
    var warnings = [];
    if (reportStatus === 'data_unavailable') warnings.push('NO_DATA_SOURCE');
    if (reportStatus === 'no_gym_workouts') warnings.push('Keine abgeschlossenen Gym-Workouts im Zeitraum.');
    if (visGym && snaps.length === 0) warnings.push('ACTIVITY_PIPELINE_MISMATCH');
    if (anyFail) warnings.push('Teilweise Quelle nicht geladen.');
    if (unclassifiedExercises.length) warnings.push(unclassifiedExercises.length + ' unklassifizierte Übung(en) — bitte melden.');
    if (weeks < 2) warnings.push('Weniger als 2 Wochen Daten — Korridor/Empfehlung unsicher.');
    return {
      generatedAt: new Date().toISOString(), mappingVersion: MAPPING_VERSION, reportStatus: reportStatus,
      period: { days: days, from: new Date(fromMs).toISOString().slice(0, 10), to: new Date(toMs).toISOString().slice(0, 10) },
      source: { workoutCount: snaps.length, exerciseCount: exerciseCount, validWorkingSetCount: validSets, excludedSetCount: res.exclusions.length },
      muscles: muscles, unclassifiedExercises: unclassifiedExercises, exclusionsByReason: exclusionsByReason, warnings: warnings,
      diagnostics: dg   // nur Feldnamen + Zählwerte, KEINE IDs/E-Mail/Auth
    };
  }
  // Konsolen-Diagnose (verändert nichts).
  function printShadowReport(opts) {
    var r = buildShadowReport(opts);
    try {
      console.log('[ORVIA Shadow] Zeitraum ' + r.period.from + '–' + r.period.to + ' · Workouts: ' + r.source.workoutCount + ' · gültige Sätze: ' + r.source.validWorkingSetCount + ' · ausgeschlossen: ' + r.source.excludedSetCount);
      if (console.table) console.table(r.muscles.map(function (m) { return { Muskel: m.label, real: m.realWorkingSets, direkt: m.directSets, indirekt: m.indirectSetEquivalents, effektiv: m.effectiveSetEquivalents, woche: m.weeklyEquivalent, legacy: m.legacyValue, diff: m.differenceToLegacy }; }));
      if (r.unclassifiedExercises.length) console.warn('[ORVIA Shadow] unklassifiziert:', r.unclassifiedExercises);
      console.log('[ORVIA Shadow] Ausschlüsse:', r.exclusionsByReason, '· Warnungen:', r.warnings);
    } catch (e) {}
    return r;
  }
  // iPhone-tauglicher Diagnosezugang: eigenständiges Modal mit kopierbarem JSON (nicht in der normalen UI).
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
  function summaryHTML(r) {
    var lines = [];
    lines.push('Zeitraum: ' + r.period.from + ' – ' + r.period.to + ' (' + r.period.days + ' Tage)');
    lines.push('Gym-Workouts: ' + r.source.workoutCount + ' · gültige Arbeitssätze: ' + r.source.validWorkingSetCount + ' · ausgeschlossen: ' + r.source.excludedSetCount);
    var ms = r.muscles.map(function (m) { return esc(m.label) + ': ' + m.realWorkingSets + ' real / ' + m.directSets + ' direkt + ' + m.indirectSetEquivalents + ' indirekt = ' + m.effectiveSetEquivalents + ' eff (' + m.weeklyEquivalent + '/Wo)' + (m.differenceToLegacy != null ? ' · Δalt ' + m.differenceToLegacy : ''); });
    var unk = r.unclassifiedExercises.map(function (u) { return esc(u.exerciseName) + ' (' + u.workingSetCount + ')'; });
    var html = '<div style="font:13px/1.6 system-ui;color:#cbd5e1">' +
      lines.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') +
      (ms.length ? '<div style="margin-top:8px;font-weight:700;color:#dcc79a">Muskeln</div>' + ms.map(function (l) { return '<div>' + l + '</div>'; }).join('') : '<div style="margin-top:8px;color:#94a3b8">Keine Muskelwerte im Zeitraum.</div>') +
      (unk.length ? '<div style="margin-top:8px;font-weight:700;color:#fb923c">Unklassifiziert</div><div>' + unk.join(', ') + '</div>' : '') +
      (r.warnings.length ? '<div style="margin-top:8px;font-weight:700;color:#fb7185">Warnungen</div>' + r.warnings.map(function (w) { return '<div>' + esc(w) + '</div>'; }).join('') : '') +
      (r.diagnostics ? '<div style="margin-top:8px;font-weight:700;color:#94a3b8">Diagnose</div>' +
        '<div>lokal: ' + r.diagnostics.rawLocalActivityCount + ' · server: ' + r.diagnostics.rawServerActivityCount + ' · Gym-Kandidaten: ' + r.diagnostics.gymCandidatesBeforeDateFilter + ' → im Zeitraum: ' + r.diagnostics.gymCandidatesAfterDateFilter + ' → mit Snapshot: ' + r.diagnostics.snapshotCandidates + '</div>' +
        '<div>abgelehnt: ' + esc(JSON.stringify(r.diagnostics.rejectedByReason)) + '</div>' : '') +
      '</div>';
    return html;
  }
  async function showShadowReport(opts) {
    if (typeof document === 'undefined') return buildShadowReport(opts);
    // Ladezustand sofort anzeigen.
    var load = document.createElement('div');
    load.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(4,6,10,.9);display:flex;align-items:center;justify-content:center;color:#cbd5e1;font:14px system-ui');
    load.innerHTML = '<div>Gym-Daten werden geladen …</div>';
    document.body.appendChild(load);
    var r;
    try { r = await buildShadowReport(Object.assign({ refresh: true }, opts)); }
    catch (e) { load.innerHTML = '<div style="text-align:center"><div>Gym-Daten konnten nicht geladen werden.</div><button id="sr-x" style="margin-top:12px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e2e8f0">Schließen</button></div>'; load.querySelector('#sr-x').onclick = function () { try { load.remove(); } catch (e2) {} }; return null; }
    try { load.remove(); } catch (e) {}
    var json = JSON.stringify(r, null, 2);
    try {
      var bg = document.createElement('div');
      bg.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(4,6,10,.9);display:flex;align-items:center;justify-content:center;padding:16px;-webkit-overflow-scrolling:touch');
      bg.innerHTML = '<div style="width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;background:#0d131d;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;overflow:auto">' +
        '<div style="font-weight:700;color:#dcc79a;margin-bottom:8px">Gym-Shadow-Report</div>' +
        '<div id="sr-sum" style="margin-bottom:10px"></div>' +
        '<textarea id="sr-ta" readonly style="min-height:220px;width:100%;font:12px/1.4 monospace;color:#cbd5e1;background:#0b1118;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px"></textarea>' +
        '<div id="sr-msg" style="font:12px system-ui;color:#34d399;min-height:16px;margin-top:6px"></div>' +
        '<div style="display:flex;gap:8px;margin-top:6px">' +
        '<button id="sr-copy" style="flex:1;min-height:44px;border-radius:10px;border:1px solid rgba(201,174,124,.4);background:rgba(201,174,124,.16);color:#dcc79a">Report kopieren</button>' +
        '<button id="sr-close" style="flex:1;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#e2e8f0">Schließen</button></div></div>';
      document.body.appendChild(bg);
      bg.querySelector('#sr-sum').innerHTML = summaryHTML(r);
      var ta = bg.querySelector('#sr-ta'); ta.value = json;
      var msg = bg.querySelector('#sr-msg');
      bg.querySelector('#sr-close').onclick = function () { try { bg.remove(); } catch (e) {} };
      bg.querySelector('#sr-copy').onclick = function () {
        var done = function () { msg.style.color = '#34d399'; msg.textContent = 'Report kopiert'; };
        var manual = function () { try { ta.focus(); ta.select(); ta.setSelectionRange(0, json.length); } catch (e) {} msg.style.color = '#fb923c'; msg.textContent = 'Text markieren und kopieren'; };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(json).then(done).catch(function () { try { ta.select(); if (document.execCommand('copy')) done(); else manual(); } catch (e) { manual(); } }); }
          else { ta.select(); if (document.execCommand && document.execCommand('copy')) done(); else manual(); }
        } catch (e) { manual(); }
      };
      bg.addEventListener('click', function (ev) { if (ev.target === bg) { try { bg.remove(); } catch (e) {} } });
    } catch (e) {}
    return r;
  }

  var api = {
    MAPPING_VERSION: MAPPING_VERSION, MUSCLES: MUSCLES, MUSCLE_LABEL: MUSCLE_LABEL,
    buildShadowReport: buildShadowReport, printShadowReport: printShadowReport, showShadowReport: showShadowReport,
    COUNTABLE_SET_TYPES: COUNTABLE_SET_TYPES, DIRECT: DIRECT, INDIRECT: INDIRECT,
    EXERCISE_MUSCLES: EXERCISE_MUSCLES, NAME_MUSCLES: NAME_MUSCLES, PATTERN_MUSCLES: PATTERN_MUSCLES,
    coeffOf: coeffOf, roleOf: roleOf, isCountable: isCountable, setExclusionReason: setExclusionReason,
    realSetsOf: realSetsOf, musclesFor: musclesFor, isClassified: isClassified,
    computeMuscleVolume: computeMuscleVolume, weeklyEquivalent: weeklyEquivalent,
    targetCorridor: targetCorridor, confidenceOf: confidenceOf, statusFor: statusFor,
    explainMuscleVolume: explainMuscleVolume, compareToLegacy: compareToLegacy, snapshotsFromStore: snapshotsFromStore,
    gymPipeline: gymPipeline, volumeAdvice: volumeAdvice, CORRIDORS: CORRIDORS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.gymVolume = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
