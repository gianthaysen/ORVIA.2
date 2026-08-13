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

  /* ---------- v8-337 · ALLE Produktzahlen an EINEM Ort ----------
     Bis hierher lagen die Zahlen verstreut im Code: `_rpeTarget(7)` mitten in
     einem ternaeren Ausdruck, `0.25` und `0.15` als nackte Faktoren, `repMin
     = 4`. Sie sahen aus wie Fachwissen, waren aber Produktentscheidungen —
     und niemand konnte sie finden, pruefen oder ersetzen.

     Sie sind NICHT falsch. Sie sind ORVIA-Entscheidungen ohne Quelle, und
     genau so muessen sie dastehen: benannt, an einer Stelle, mit [A]
     gekennzeichnet und aus eingespeistem Wissen ueberschreibbar. Der
     Unterschied zu vorher ist nicht der Wert, sondern die Sichtbarkeit.

     Die PACE-FAKTOREN stehen bewusst NICHT hier: sie sind der fachliche Kern
     der Templates, in phase7_s5 einzeln geprueft und in Probe F1 abgesichert.
     Sie hierher zu ziehen wuerde sie zu beliebig aussehen lassen. */
  var DEFAULTS = {
    /* [A] Anteile der Einheit fuer Auf- und Auswaermen. Faustwerte, keine
       Messung. Untergrenzen, damit eine kurze Einheit nicht ohne Aufwaermen
       dasteht. */
    warmupAnteil: 0.25, warmupMinMin: 10,
    cooldownAnteil: 0.15, cooldownMinMin: 5,
    /* [A] Zuschnitt eines VO2-Intervalls. */
    intervallMin: 4, trabpauseMin: 3, intervalleMin: 3, intervalleMax: 6,
    /* [A] RPE-Rueckfallwerte, wenn keine belastbare Pace-Evidenz vorliegt.
       Sie ersetzen kein Tempo — sie sagen "nach Gefuehl, so ungefaehr". Der
       Rueckfall wird ohnehin geflaggt (no_pace_evidence_rpe_fallback). */
    rpeEasy: 3, rpeLong: 4, rpeTempo: 7, rpeIntervall: 8,
    /* [A] Aufwaermen laeuft locker. */
    rpeWarmup: 3,
    /* [A] Zielwert einer Kraftuebung ohne eigene RIR-Angabe. */
    rpeKraft: 7
  };
  /* Eine Zahl aus eingespeistem Wissen schlaegt den Produktwert — und sagt
     im Flag, woher sie kommt. Ohne Wissen bleibt der Produktwert, ebenfalls
     benannt: `produktwert:rpeTempo`. Damit ist an jeder Verordnung ablesbar,
     welche Zahl eine Quelle hat und welche nicht. */
  function _zahl(schluessel, ziel, req, flags) {
    var w = (req && req.knowledge && Array.isArray(req.knowledge.vorgaben)) ? req.knowledge.vorgaben : null;
    if (w && ziel) {
      for (var i = 0; i < w.length; i++) {
        var v = w[i];
        if (v && v.ziel === ziel && v.art === 'zahl' && v.wert) {
          flags.push(schluessel + '_aus_wissen:' + v.regelId);
          return v.wert.min;
        }
      }
    }
    flags.push('produktwert:' + schluessel);
    return DEFAULTS[schluessel];
  }

  /* ---------- Endurance-Templates (Daten, versioniert) ----------
     buildFn(durMin, ev, flags) → blocks[]. Faktoren relativ zur Schwellenpace:
     easy 1.25–1.40 · long 1.20–1.35 · tempo 1.02–1.08 · vo2-Intervall 0.92–0.98. */
  var TEMPLATES = {
    endurance_easy: { v: 1, goal: 'aerobic_base', build: function (durMin, ev, flags, req) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.25, 1.40)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeEasy', 'session.rpe_easy', req, flags)));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_long: { v: 1, goal: 'long_endurance', build: function (durMin, ev, flags, req) {
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.20, 1.35)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeLong', 'session.rpe_long', req, flags)));
      return [{ type: 'work', completion: { type: 'duration', value: durMin * 60, unit: 's' }, target: t }];
    } },
    endurance_tempo: { v: 1, goal: 'threshold', build: function (durMin, ev, flags, req) {
      var wu = Math.max(_zahl('warmupMinMin', null, req, flags), Math.round(durMin * _zahl('warmupAnteil', 'session.warmup_anteil', req, flags)));
      var cd = Math.max(_zahl('cooldownMinMin', null, req, flags), Math.round(durMin * _zahl('cooldownAnteil', 'session.cooldown_anteil', req, flags)));
      var core = durMin - wu - cd;
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 1.02, 1.08)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeTempo', 'session.rpe_tempo', req, flags)));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(_zahl('rpeWarmup', 'session.rpe_warmup', req, flags)) },
        { type: 'work', completion: { type: 'duration', value: core * 60, unit: 's' }, target: t },
        { type: 'cooldown', completion: { type: 'duration', value: cd * 60, unit: 's' }, target: { type: 'open' } }
      ];
    } },
    endurance_intervals: { v: 1, goal: 'vo2max', build: function (durMin, ev, flags, req) {
      var wu = Math.max(_zahl('warmupMinMin', null, req, flags), Math.round(durMin * _zahl('warmupAnteil', 'session.warmup_anteil', req, flags)));
      var cd = Math.max(_zahl('cooldownMinMin', null, req, flags), Math.round(durMin * _zahl('cooldownAnteil', 'session.cooldown_anteil', req, flags)));
      var core = durMin - wu - cd;
      var repMin = _zahl('intervallMin', 'session.intervall_min', req, flags);
      var recMin = _zahl('trabpauseMin', 'session.trabpause_min', req, flags);
      var iters = Math.max(_zahl('intervalleMin', null, req, flags),
        Math.min(_zahl('intervalleMax', null, req, flags), Math.floor(core / (repMin + recMin))));
      var t = _paceEvidence(ev) ? _paceRange(ev.thresholdPaceSecPerKm, 0.92, 0.98)
        : (flags.push('no_pace_evidence_rpe_fallback'), _rpeTarget(_zahl('rpeIntervall', 'session.rpe_intervall', req, flags)));
      return [
        { type: 'warmup', completion: { type: 'duration', value: wu * 60, unit: 's' }, target: _rpeTarget(_zahl('rpeWarmup', 'session.rpe_warmup', req, flags)) },
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
          target: _rpeTarget(_zahl('rpeKraft', 'session.rpe_kraft', req, flags)),
          notes: 'Übungsliste folgt aus dem Kraft-Pack — keine erfundene Übungsauswahl.' }]; }
      /* v8-336 — WIDERSPRUCH IM EIGENEN PROJEKT, hier behoben.
         Hier stand `sets: e.sets >= 1 ? e.sets : 3` und `rest_seconds: … : 120`.
         Beides waren geratene Zahlen — und `strength-plan@1` verbietet genau
         das woertlich: "Satzanzahl ist Pflicht. Kein Default — 3 waere
         geraten." Zwei Module desselben Projekts widersprachen sich, und die
         Factory gewann still.

         Neu gilt die Reihenfolge: (1) was die Uebung selbst mitbringt,
         (2) was aus eingespeistem WISSEN kommt — mit Herkunft, (3) gar
         nichts, sichtbar als Flag. Geraten wird an keiner Stelle mehr. */
      var wissen = (req && req.knowledge) || null;
      var ausWissen = function (ziel) {
        if (!wissen || !Array.isArray(wissen.vorgaben)) return null;
        for (var i = 0; i < wissen.vorgaben.length; i++) {
          var v = wissen.vorgaben[i];
          if (v && v.ziel === ziel && v.art === 'zahl' && v.wert) return v;
        }
        return null;
      };
      var setsV = ausWissen('session.sets'), restV = ausWissen('session.rest_seconds');
      if (setsV) flags.push('sets_aus_wissen:' + setsV.regelId);
      if (restV) flags.push('rest_aus_wissen:' + restV.regelId);
      return exs.map(function (e) {
        var sets = (e.sets >= 1) ? e.sets : (setsV ? setsV.wert.min : null);
        var rest = (e.restSeconds != null) ? e.restSeconds : (restV ? restV.wert.min : null);
        /* v8-338 — GEFUNDEN BEIM ERSTEN ECHTEN DURCHLAUF MIT EINGESPEISTEM
           WISSEN. Hier stand `String(e.exerciseId || e.id)`. Fehlen beide,
           ergibt das die Zeichenkette "undefined" — und auf der Wochenkarte
           stand woertlich:

               undefined — 4 × 5 · RPE 7 · 3 min Pause

           Kein Fehler, kein Flag, keine Sperre: eine Uebung ohne Kennung
           wurde zu einer Uebung NAMENS "undefined". Genau die Sorte
           Fail-Open, die der Rest der Factory seit v8-336 vermeidet.
           Jetzt: keine Kennung ⇒ null ⇒ der Validator sperrt die Verordnung,
           so wie er es bei fehlender Satzzahl auch tut. */
        var eid = (typeof e.exerciseId === 'string' && e.exerciseId) ? e.exerciseId
          : (typeof e.id === 'string' && e.id) ? e.id : null;
        var eidText = eid === null ? '(ohne Kennung)' : eid;
        if (eid === null) flags.push('uebung_ohne_kennung');
        if (sets === null) flags.push('sets_unbekannt:' + eidText);
        if (rest === null) flags.push('pause_unbekannt:' + eidText);
        return { type: 'exercise', exercise_id: eid, sets: sets,
          repetitions: e.reps != null ? e.reps : null, rest_seconds: rest,
          target: (e.rir != null) ? { type: 'rir', value: e.rir } : _rpeTarget(_zahl('rpeKraft', 'session.rpe_kraft', req, flags)) };
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

  /* ============================================================
     DAS ZIELREGISTER (v8-344)

     WOZU. Eine Wissensregel nennt in `outputs`, worauf sie wirken will.
     Bis hierher hat das NIEMAND geprueft: jede Zeichenkette wurde
     angenommen. Eine Regel mit dem Ziel `plan.kraftvergleich_normierung`
     (QUELLE-11) lief durch Einspeisung, Vertrag und Anwendung, erzeugte
     eine Vorgabe — und wirkte auf nichts, weil diese Verordnung das Ziel
     gar nicht kennt. Ein Tippfehler (`session.rest_secons`) verhaelt sich
     exakt genauso: still, gruen, wirkungslos.

     GEMESSEN am 2026-08-13, bevor es dieses Register gab:
       Gym-Paket     1 von 5 Zielen hatte einen Leser
       Laufpaket     0 von 25

     Die Liste steht hier als LITERAL und wird nicht zur Laufzeit aus dem
     Code zusammengesucht. `knowledge_targets_test.mjs` prueft sie
     BEIDSEITIG gegen die tatsaechlich im Quelltext gelesenen Ziele: keines
     darf fehlen, keines zu viel drinstehen. Wer ein Ziel neu liest, traegt
     es hier ein — wer eines entfernt, ebenso.

     WAS DAS REGISTER NICHT TUT: es verbietet nichts. Ein Ziel ohne Leser
     ist kein Vertragsbruch, sondern Wissen, das noch keine Verwendung hat.
     Der Unterschied gehoert sichtbar gemacht, nicht bestraft.
     ============================================================ */
  var GELESENE_ZIELE = ['session.cooldown_anteil', 'session.intervall_min', 'session.rest_seconds',
    'session.rpe_easy', 'session.rpe_intervall', 'session.rpe_kraft', 'session.rpe_long',
    'session.rpe_tempo', 'session.rpe_warmup', 'session.sets', 'session.trabpause_min',
    'session.warmup_anteil'];

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.prescriptionFactory = _freeze({ VERSION: VERSION, TEMPLATE_IDS: Object.keys(TEMPLATES).sort(),
    GELESENE_ZIELE: GELESENE_ZIELE,
    validateWorkout: validateWorkout, buildPrescription: buildPrescription });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.prescriptionFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
