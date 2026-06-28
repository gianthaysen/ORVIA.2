/* ============================================================
   ORVIA · gym-volume — Muskelvolumen-Engine (Inkrement 2C, SHADOW MODE).
   Berechnet aus REALEN Workout-Sätzen (lokale Snapshots) parallel zur alten Server-RPC.
   STRIKTE Trennung: realWorkingSets ≠ directSets ≠ indirectSetEquivalents ≠ effectiveSets.
   Jeder (Dezimal-)Wert ist über explainMuscleVolume() auf Übungen + reale Sätze rückführbar.
   KEINE universelle Satzregel — Koeffizienten sind übungs-/musterspezifisch (evidenzinformiert,
   als erweiterbarer Seed dokumentiert). NICHT in die UI geschaltet (Shadow).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  // Zählbare Satztypen = real geleistete Arbeitssätze. Aufwärm-/Technik-Sätze zählen NICHT.
  var COUNTABLE_SET_TYPES = { working: 1, top_set: 1, backoff: 1, dropset: 1, amrap: 1, myo_reps: 1 };
  var DIRECT = 1.0, INDIRECT = 0.5;   // primärer Muskel = 1 Satz; sekundär = halber Satzanteil

  // Evidenzinformierter Seed: Übungs-ID → { muscleKey: 'direct'|'indirect' }. Erweiterbar.
  var EXERCISE_MUSCLES = {
    bench_press: { chest: 'direct', triceps: 'indirect', front_delts: 'indirect' },
    bench_press_machine: { chest: 'direct', triceps: 'indirect', front_delts: 'indirect' },
    incline_bench_press: { chest: 'direct', front_delts: 'indirect', triceps: 'indirect' },
    overhead_press: { front_delts: 'direct', side_delts: 'indirect', triceps: 'indirect' },
    lateral_raise: { side_delts: 'direct' },
    pull_up: { lats: 'direct', biceps: 'indirect', upper_back: 'indirect' },
    lat_pulldown: { lats: 'direct', biceps: 'indirect', upper_back: 'indirect' },
    barbell_row: { upper_back: 'direct', lats: 'direct', biceps: 'indirect', rear_delts: 'indirect' },
    biceps_curl: { biceps: 'direct' },
    triceps_pushdown: { triceps: 'direct' },
    squat: { quads: 'direct', glutes: 'indirect', lower_back: 'indirect' },
    leg_press: { quads: 'direct', glutes: 'indirect' },
    romanian_deadlift: { hamstrings: 'direct', glutes: 'direct', lower_back: 'indirect' },
    deadlift: { glutes: 'direct', hamstrings: 'direct', lower_back: 'direct', upper_back: 'indirect' },
    leg_curl: { hamstrings: 'direct' },
    leg_extension: { quads: 'direct' },
    calf_raise: { calves: 'direct' },
    plank: { abs: 'direct' }
  };
  // Grobe Muster→Muskel-Zuordnung als Fallback, wenn die Übungs-ID unbekannt ist (Movement Pattern).
  var PATTERN_MUSCLES = {
    horizontal_push: { chest: 'direct', triceps: 'indirect', front_delts: 'indirect' },
    vertical_push: { front_delts: 'direct', triceps: 'indirect' },
    horizontal_pull: { upper_back: 'direct', biceps: 'indirect' },
    vertical_pull: { lats: 'direct', biceps: 'indirect' },
    squat: { quads: 'direct', glutes: 'indirect' },
    hinge: { hamstrings: 'direct', glutes: 'direct', lower_back: 'indirect' },
    lunge: { quads: 'direct', glutes: 'indirect' },
    knee_extension: { quads: 'direct' }, knee_flexion: { hamstrings: 'direct' },
    hip_extension: { glutes: 'direct' }, calf: { calves: 'direct' },
    elbow_flexion: { biceps: 'direct' }, elbow_extension: { triceps: 'direct' },
    shoulder_abduction: { side_delts: 'direct' }, trunk_flexion: { abs: 'direct' }
  };

  function coeff(role) { return role === 'direct' ? DIRECT : INDIRECT; }
  function isCountable(set) {
    if (!set) return false;
    if (set.completed !== true) return false;                 // nur abgeschlossene Sätze
    var t = set.setType || set.set_type || 'working';
    if (!COUNTABLE_SET_TYPES[t]) return false;                // Aufwärm-/Technik-Sätze raus
    var w = set.weight, r = set.reps;
    if ((w == null || isNaN(w)) && (r == null || isNaN(r))) return false;  // leere/ungültige Zeile raus
    return true;
  }
  // Muskelzuordnung einer Übung (ID-Seed bevorzugt, sonst Movement-Pattern-Fallback).
  function musclesFor(ex, mapOverride) {
    var map = mapOverride || EXERCISE_MUSCLES;
    var id = ex && (ex.exerciseId || ex.exercise_id);
    if (id && map[id]) return map[id];
    var pat = ex && (ex.movementPattern || ex.movement_pattern);
    if (pat && PATTERN_MUSCLES[pat]) return PATTERN_MUSCLES[pat];
    return null;   // unbekannt → KEINE erfundene Zuordnung
  }

  // Zählt reale Arbeitssätze je Übung (countable).
  function realSetsOf(ex) { return ((ex && ex.sets) || []).filter(isCountable).length; }

  // Kern: aus Workout-Snapshots je Muskel die getrennten Kennzahlen + Beitragsliste bilden.
  // snapshots: [{ workoutId, startedAt, exercises:[{exerciseId, exerciseNameSnapshot, movementPattern, sets:[...]}] }]
  function computeMuscleVolume(snapshots, opts) {
    opts = opts || {}; var map = opts.exerciseMuscles;
    var byMuscle = {};
    (snapshots || []).forEach(function (w) {
      (w && w.exercises || []).forEach(function (ex) {
        var real = realSetsOf(ex); if (real <= 0) return;
        var muscles = musclesFor(ex, map); if (!muscles) return;
        Object.keys(muscles).forEach(function (mk) {
          var role = muscles[mk], c = coeff(role);
          var m = byMuscle[mk] || (byMuscle[mk] = { muscle: mk, realWorkingSets: 0, directSets: 0, indirectSetEquivalents: 0, effectiveSets: 0, contributions: [] });
          m.realWorkingSets += real;
          if (role === 'direct') m.directSets += real; else m.indirectSetEquivalents += real * INDIRECT;
          m.effectiveSets += real * c;
          m.contributions.push({ workoutId: w.workoutId || null, startedAt: w.startedAt || null, exercise: (ex.exerciseNameSnapshot || ex.exerciseId || ex.exercise_id || 'Übung'), realSets: real, role: role, coefficient: c, contribution: Math.round(real * c * 100) / 100 });
        });
      });
    });
    // Runden auf 1 Nachkommastelle für Anzeige; Rohbeiträge bleiben exakt.
    Object.keys(byMuscle).forEach(function (k) { var m = byMuscle[k]; m.directSets = Math.round(m.directSets * 10) / 10; m.indirectSetEquivalents = Math.round(m.indirectSetEquivalents * 10) / 10; m.effectiveSets = Math.round(m.effectiveSets * 10) / 10; });
    return byMuscle;
  }

  function weeklyEquivalent(effectiveSets, days) { days = (days == null || isNaN(days)) ? 7 : +days; if (days <= 0) return 0; return Math.round((+effectiveSets || 0) / days * 7 * 10) / 10; }

  // Rückführung eines (Dezimal-)Wertes auf konkrete Übungen + reale Sätze.
  function explainMuscleVolume(muscle, snapshots, opts) {
    opts = opts || {}; var days = opts.days != null ? opts.days : 7;
    var vol = computeMuscleVolume(snapshots, opts)[muscle];
    if (!vol) return { muscle: muscle, directSets: 0, indirectSetEquivalents: 0, effectiveSets: 0, effectiveSetsPerWeek: 0, contributions: [] };
    return {
      muscle: muscle, realWorkingSets: vol.realWorkingSets, directSets: vol.directSets,
      indirectSetEquivalents: vol.indirectSetEquivalents, effectiveSets: vol.effectiveSets,
      effectiveSetsPerWeek: weeklyEquivalent(vol.effectiveSets, days), contributions: vol.contributions
    };
  }

  // Shadow-Vergleich gegen die alten Server-Effektivwerte (Verifikation vor UI-Umschaltung).
  function compareToLegacy(snapshots, legacyEffectiveByMuscle, opts) {
    var shadow = computeMuscleVolume(snapshots, opts); var out = {};
    var keys = {}; Object.keys(shadow).forEach(function (k) { keys[k] = 1; }); Object.keys(legacyEffectiveByMuscle || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var s = shadow[k] ? shadow[k].effectiveSets : 0; var l = (legacyEffectiveByMuscle && legacyEffectiveByMuscle[k]) || 0;
      out[k] = { shadow: s, legacy: l, delta: Math.round((s - l) * 10) / 10 };
    });
    return out;
  }

  var api = {
    COUNTABLE_SET_TYPES: COUNTABLE_SET_TYPES, EXERCISE_MUSCLES: EXERCISE_MUSCLES, PATTERN_MUSCLES: PATTERN_MUSCLES,
    DIRECT: DIRECT, INDIRECT: INDIRECT, isCountable: isCountable, realSetsOf: realSetsOf, musclesFor: musclesFor,
    computeMuscleVolume: computeMuscleVolume, weeklyEquivalent: weeklyEquivalent,
    explainMuscleVolume: explainMuscleVolume, compareToLegacy: compareToLegacy
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.gymVolume = api;   // SHADOW: nur verfügbar, NICHT in die UI verdrahtet
})(typeof globalThis !== 'undefined' ? globalThis : this);
