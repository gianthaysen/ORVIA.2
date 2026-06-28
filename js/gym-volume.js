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

  // ---- Perioden-Quelle: reale Gym-Snapshots aus dem Activity-Store (ON DEVICE). ----
  // Liest abgeschlossene Workout-Activities (source orvia_workout) mit workoutSnapshot im Zeitfenster.
  // Gelöschte (Tombstone) und Mobility fließen NICHT ein.
  function snapshotsFromStore(opts) {
    opts = opts || {}; var store = O.activityStore; if (!store) return [];
    var days = opts.days || 7;
    var toMs = Date.now(), fromMs = toMs - (days - 1) * 864e5;
    var list = store.listActivities ? store.listActivities() : [];
    return list.filter(function (a) {
      if (a.source !== 'orvia_workout') return false;             // nur Gym-Workouts
      if (a.sportId && a.sportId !== 'gym') return false;         // Mobility/andere raus
      if (store.isTombstoned && store.isTombstoned(a)) return false;
      if (!a.workoutSnapshot || !a.workoutSnapshot.length) return false;
      var t = a.startedAt ? new Date(a.startedAt).getTime() : null;
      if (t != null && (t < fromMs || t > toMs)) return false;
      return true;
    }).map(function (a) {
      return { workoutId: a.workoutSessionId || a.clientRecordId, startedAt: a.startedAt, exercises: a.workoutSnapshot };
    });
  }

  // ---- On-Device-Shadow-Report (rein, serialisierbar, KEIN Netzwerk, KEINE Mutation) ----
  function buildShadowReport(opts) {
    opts = opts || {}; var days = opts.days || 28;
    var snaps = snapshotsFromStore({ days: days });
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
    var warnings = [];
    if (!snaps.length) warnings.push('Keine abgeschlossenen Gym-Workouts im Zeitraum.');
    if (unclassifiedExercises.length) warnings.push(unclassifiedExercises.length + ' unklassifizierte Übung(en) — bitte melden.');
    if (weeks < 2) warnings.push('Weniger als 2 Wochen Daten — Korridor/Empfehlung unsicher.');
    return {
      generatedAt: new Date().toISOString(), mappingVersion: MAPPING_VERSION,
      period: { days: days, from: new Date(fromMs).toISOString().slice(0, 10), to: new Date(toMs).toISOString().slice(0, 10) },
      source: { workoutCount: snaps.length, exerciseCount: exerciseCount, validWorkingSetCount: validSets, excludedSetCount: res.exclusions.length },
      muscles: muscles, unclassifiedExercises: unclassifiedExercises, exclusionsByReason: exclusionsByReason, warnings: warnings
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
      '</div>';
    return html;
  }
  function showShadowReport(opts) {
    var r = buildShadowReport(opts);
    var json = JSON.stringify(r, null, 2);
    try {
      if (typeof document === 'undefined') return r;
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
    volumeAdvice: volumeAdvice, CORRIDORS: CORRIDORS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.gymVolume = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
