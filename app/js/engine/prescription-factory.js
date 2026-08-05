/* ============================================================
   ORVIA · prescription-factory — S5 (Phase 7, 2026-08-05, SHADOW-ONLY).

   Erzeugt Session Prescriptions im NEUTRALEN Workout-Schema aus Vertrag 4
   (ENGINE-VERTRAEGE-2026-08.md): { sport_id, session_type, goal, priority,
   blocks[{type, completion, target, iterations, blocks, …}] }.
   ORVIA plant NIE im Geräteformat — Garmin/FIT sind spätere Adapter.

   Template-Modell: strukturierte, versionierte DATEN (kein Codepfad je Session-
   Typ). Ersetzt perspektivisch die hartcodierte PLAN_PRESETS-Frontend-Liste
   (ui.js) — diese bleibt bis zur Scheduler-v2-Umstellung unangetastet (kein
   Live-Eingriff). DB-Persistenz der Templates folgt mit eigener Migration,
   wenn der Scheduler live geht; shadow braucht keine DB.

   Fail-closed (RUN-INT-001 / Vertrag 6):
   - HARTE Pace-Zielbereiche NUR bei übergebener Pace-Evidenz
     (evidence.thresholdPaceSecPerKm + confidence != 'low'); sonst RPE-Ziel +
     Flag no_pace_evidence_rpe_fallback — es wird NIE eine Pace erfunden.
   - intensity 'intense' ohne jede Evidenz ⇒ Prescription wird NICHT quantitativ
     verschärft, sondern RPE-geführt ausgegeben (weniger Automatisierung,
     nicht mehr Heuristik).
   - Unbekannter Template-/Sporttyp ⇒ blocked mit Grund, nie ein Zufallsplan.

   Reinheit: pure + deterministisch (kein Date/Random/DOM/Storage/PROFILE).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'prescription-v1.0.0';

  /* ---------- Vertrag-4-Validator (normativ, von Tests mitbenutzt) ---------- */
  var COMPLETION = ['duration', 'distance', 'reps', 'open'];
  var TARGET = ['pace', 'speed', 'power', 'hr', 'hr_zone', 'rpe', 'rir', 'weight', 'cadence', 'open'];
  var BLOCK = ['warmup', 'work', 'recovery', 'repeat', 'exercise', 'cooldown', 'skill', 'open'];
  function _vBlock(b, path, errs) {
    if (!b || typeof b !== 'object') { errs.push(path + ':no_object'); return; }
    if (BLOCK.indexOf(b.type) < 0) errs.push(path + ':unknown_block_type');
    if (b.type === 'repeat') {
      if (!(b.iterations >= 1) || b.iterations !== Math.floor(b.iterations)) errs.push(path + ':repeat_iterations');
      if (!Array.isArray(b.blocks) || !b.blocks.length) errs.push(path + ':repeat_empty');
      else b.blocks.forEach(function (x, i) { _vBlock(x, path + '.' + i, errs); });
      return;
    }
    if (b.type === 'exercise') {
      if (typeof b.exercise_id !== 'string' || !b.exercise_id) errs.push(path + ':exercise_id');
      if (!(b.sets >= 1)) errs.push(path + ':sets');
    } else {
      var c = b.completion;
      if (!c || COMPLETION.indexOf(c.type) < 0) errs.push(path + ':completion');
      else if (c.type !== 'open' && !(typeof c.value === 'number' && isFinite(c.value) && c.value > 0)) errs.push(path + ':completion_value');
    }
    var t = b.target;
    if (t != null) {
      if (TARGET.indexOf(t.type) < 0) errs.push(path + ':unknown_target');
      var hasVal = t.value != null, hasRange = t.min != null || t.max != null;
      if (hasVal && hasRange) errs.push(path + ':target_value_and_range');
      if (t.type !== 'open' && !hasVal && !hasRange) errs.push(path + ':target_empty');
    }
  }
  function validateWorkout(w) {
    var errs = [];
    if (!w || typeof w !== 'object') return ['no_object'];
    if (typeof w.sport_id !== 'string' || !w.sport_id) errs.push('sport_id');
    if (!Array.isArray(w.blocks) || !w.blocks.length) errs.push('blocks_empty');
    else w.blocks.forEach(function (b, i) { _vBlock(b, 'blocks[' + i + ']', errs); });
    return errs;
  }

  /* ---------- Zielhilfen: NUR echte Evidenz erzeugt harte Bereiche ---------- */
  function _paceEvidence(ev) {
    return !!(ev && typeof ev.thresholdPaceSecPerKm === 'number' && isFinite(ev.thresholdPaceSecPerKm)
      && ev.thresholdPaceSecPerKm > 120 && ev.thresholdPaceSecPerKm < 900 && ev.confidence && ev.confidence !== 'low');
  }
  function _rpeTarget(v) { return { type: 'rpe', value: v }; }
  function _paceRange(sec, lowPct, highPct) {
    return { type: 'pace', min: Math.round(sec * lowPct), max: Math.round(sec * highPct), unit: 's_per_km' };
  }

  /* ---------- Endurance-Templates (Daten, versioniert) ----------
     buildFn(durMin, ev, flags) → blocks[]. Faktoren relativ zur Schwellenpace:
     easy 1.25–1.40 · long 1.20–1.35 · tempo 1.02–1.08 · vo2-Intervall 0.92–0.98. */
  var TEMPLATES = {
    endurance_easy: { v: 1, goal: 'aerobic_base', build: function (durMin, ev, flags) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.25, 1.40) : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(3));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_long: { v: 1, goal: 'long_endurance', build: function (durMin, ev, flags) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.20, 1.35) : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(4));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_tempo: { v: 1, goal: 'threshold', build: function (durMin, ev, flags) {
      var wu = Math.max(10, Math.round(durMin * 0.25)), cd = Math.max(5, Math.round(durMin * 0.15));
      var core = durMin - wu - cd;
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.02, 1.08) : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(7));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(3) },
        { type: 'work', completion: { type: 'duration', value: core * 60, unit: 's' }, target: t },
        { type: 'cooldown', completion: { type: 'duration', value: cd * 60, unit: 's' }, target: { type: 'open' } }
      ];
    } },
    endurance_intervals: { v: 1, goal: 'vo2max', build: function (durMin, ev, flags) {
      var wu = Math.max(10, Math.round(durMin * 0.25)), cd = Math.max(5, Math.round(durMin * 0.15));
      var core = durMin - wu - cd;
      var repMin = 4, recMin = 3;
      var iters = Math.max(3, Math.min(6, Math.floor(core / (repMin + recMin))));
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 0.92, 0.98) : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(8));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(3) },
        { type: 'repeat', iterations: iters, blocks: [
          { type: 'work', completion: { type: 'duration', value: repMin * 60, unit: 's' }, target: t },
          { type: 'recovery', completion: { type: 'duration', value: recMin * 60, unit: 's' }, target: { type: 'open' } }
        ] },
        { type: 'cooldown', completion: { type: 'duration', value: cd * 60, unit: 's' }, target: { type: 'open' } }
      ];
    } },
    strength_general: { v: 1, goal: 'strength', build: function (durMin, ev, flags, req) {
      var exs = (req && Array.isArray(req.exercises) && req.exercises.length) ? req.exercises : null;
      if (!exs) { flags.push('no_exercise_list_generic_session'); return [
        { type: 'exercise', exercise_id: 'generic_strength_session', sets: 1, repetitions: null, rest_seconds: null,
          target: _rpeTarget(7), notes: 'Übungsliste folgt aus dem Kraft-Pack — keine erfundene Übungsauswahl.' }]; }
      return exs.map(function (e) {
        return { type: 'exercise', exercise_id: String(e.exerciseId || e.id), sets: e.sets >= 1 ? e.sets : 3,
          repetitions: e.reps != null ? e.reps : null, rest_seconds: e.restSeconds != null ? e.restSeconds : 120,
          target: (e.rir != null) ? { type: 'rir', value: e.rir } : _rpeTarget(7) };
      });
    } }
  };

  /* ---------- Hauptfunktion ----------
     req: { sportId, sessionType (Template-Key), durationMin, priority, exercises? }
     evidence: { thresholdPaceSecPerKm?, confidence? } — NUR echte Werte übergeben. */
  function buildPrescription(req, evidence) {
    req = req || {};
    var tpl = TEMPLATES[req.sessionType];
    if (!tpl) return { ok: false, blocked: 'unknown_session_type', sessionType: req.sessionType || null, workout: null };
    if (typeof req.sportId !== 'string' || !req.sportId) return { ok: false, blocked: 'sport_id_missing', workout: null };
    var durMin = (typeof req.durationMin === 'number' && isFinite(req.durationMin) && req.durationMin >= 15) ? Math.round(req.durationMin) : null;
    if (durMin == null && req.sessionType !== 'strength_general') return { ok: false, blocked: 'duration_missing_or_too_short', workout: null };
    var flags = [];
    var blocks = tpl.build(durMin || 0, evidence || null, flags, req);
    var workout = { sport_id: req.sportId, session_type: req.sessionType, goal: tpl.goal,
      priority: req.priority || 'build', blocks: blocks };
    var errs = validateWorkout(workout);
    if (errs.length) return { ok: false, blocked: 'schema_invalid', errors: errs, workout: null };   // Selbstprüfung
    return { ok: true, workout: workout, flags: flags,
      provenance: { factory: VERSION, templateId: req.sessionType, templateVersion: tpl.v,
        paceEvidenceUsed: _paceEvidence(evidence || null) } };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.prescriptionFactory = _freeze({ VERSION: VERSION, TEMPLATE_IDS: Object.keys(TEMPLATES).sort(),
    validateWorkout: validateWorkout, buildPrescription: buildPrescription });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.prescriptionFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
