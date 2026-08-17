/* ============================================================
   ORVIA · garmin-workout-export — reiner Kraft-Workout-Exporter (Kraftplan v2, K4)

   ZWECK
   Übersetzt eine geplante ORVIA-Krafteinheit in ein Garmin-Workout-Payload.
   REIN: kein Netz, keine Uhr, kein Zufall, keine Zeitquelle. Gleiche Eingabe ⇒
   byte-identische Ausgabe. Die Eingabe wird nie verändert.

   K4 ENDET BEI DER PAYLOAD. Persistenz, Auth und Netzwerk sind K5.

   ────────────────────────────────────────────────────────────
   PROVENIENZ DER GARMIN-KONSTANTEN — das Wichtigste an dieser Datei
   ────────────────────────────────────────────────────────────
   Die Struktur (ExecutableStepDTO, RepeatGroupDTO, workoutSegments, die
   displayOrder-Werte, ConditionType.ITERATIONS=7, TIME=2, StepType.INTERVAL=3,
   REST=5, TargetType.NO_TARGET=1) stammt aus dem echten Modul
   `garminconnect/workout.py` der Fassung 0.3.2 — das ist die Bibliothek, die
   der ORVIA-Worker einsetzt. Diese Werte sind BELEGT.

   NICHT belegt sind zwei Dinge, und beide sind der Grund für die Gates:
     · Die numerische Sport-ID, die Garmin Connect für ein KRAFT-Workout
       erwartet. `SportType` in workout.py kennt nur running…other (1–8) und
       nennt sich selbst ausdrücklich „common values" — Krafttraining fehlt.
       Das FIT-Profil kennt `sport #10 = training` und
       `sub_sport #20 = strength_training`; die Zeichenkette ist damit echtes
       Garmin-Vokabular, die Zahl ist eine ÜBERTRAGUNG aus dem FIT-Namensraum
       in den REST-Namensraum — geraten, nicht gemessen.
     · Die numerische ID der Abbruchbedingung „reps". `ConditionType` kennt
       distance/time/heart_rate/calories/cadence/power/iterations — REPS
       existiert dort NICHT.

   DESHALB, und das ist die Kernentscheidung dieser Datei:
   Nicht belegte Zahlen werden STANDARDMÄSSIG WEGGELASSEN (null), nicht
   erfunden. Eine erfundene Zahl sähe richtig aus, ginge durch jeden Test und
   würde beim ersten Push still etwas Falsches anlegen. Ein sichtbares null
   dagegen bricht früh und laut. Für den Gerätetest lassen sich die Kandidaten
   mit `options.fillUnverifiedIds = true` einsetzen — ausdrücklich benannt, nie
   im Regelbetrieb. Jede so eingesetzte Zahl erscheint zusätzlich in
   `warnings`.

   GATES
     G1  Sport-ID und reps-Bedingung (siehe oben) — `fillUnverifiedIds`
     G3  Gewichtsskalierung beim SCHREIBEN. Gelesen wird in Gramm
         (`weight: 39000.0` = 39 kg, aus einer echten Aktivitätsantwort). Ob
         die Schreibrichtung dieselbe Skalierung erwartet, ist NICHT geprüft.
         Deshalb wird `weightValue` standardmässig GAR NICHT erzeugt.
         `options.includeWeight = true` schaltet es für den Gerätetest frei;
         `kg × 1000` ist dabei eine BESCHRIFTETE ANNAHME, keine Wahrheit.

   PROVENIENZLÜCKE (bleibt sichtbar)
   Der Übungskatalog ist gegen genau EINE Quelle nachgewiesen — das offizielle
   FIT SDK. Der Übungspicker von Garmin Connect war nicht erreichbar. Der
   Exporter behauptet deshalb NIRGENDS eine doppelte Verifikation; das
   Ergebnis trägt `catalogSources: ['fit-sdk@21.213.0']` und eine Warnung.

   ────────────────────────────────────────────────────────────
   FESTGELEGTE REGELN (Entscheidungen, keine Annahmen)
     · Nur `status:'mapped'` wird exportiert. `ambiguous`, `unmapped` und
       unbekannte Slugs werden NAMENTLICH ausgewiesen und niemals ersetzt.
     · Fehlende Wiederholungen ⇒ die Übung wird NICHT exportiert. Garmin
       braucht eine Zahl, und eine Zahl zu erfinden ist genau das, was hier
       nicht passieren darf.
     · Bei einem Wiederholungsbereich (6–8) geht `minReps` in die Payload —
       die untere Grenze ist die zugesagte Vorgabe, mehr darf man immer machen.
       Dass der Bereich dabei zusammenfällt, steht als Warnung im Ergebnis.
     · Fehlende Pause ⇒ der dokumentierte Vertragsdefault aus strength-plan.js
       ([A3] 120 s) wird eingesetzt UND als Warnung gemeldet. Ein Kraftworkout
       ohne Pausenschritt zwischen den Sätzen wäre auf der Uhr unbrauchbar;
       fail-closed wäre hier die schlechtere Wahl, weil die Zahl bereits im
       Datenvertrag steht und nicht hier neu erfunden wird.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  var O = window.ORVIA;

  var VERSION = 'garmin-workout-export@1';

  /* Jede Garmin-Konstante mit Herkunft. `verified:false` heisst: wird ohne
     ausdrücklichen Testmodus NICHT in die Payload geschrieben. */
  var CONST = {
    stepTypeInterval: { id: 3, key: 'interval', displayOrder: 3, verified: true, src: 'garminconnect@0.3.2 StepType.INTERVAL' },
    stepTypeRest: { id: 5, key: 'rest', displayOrder: 5, verified: true, src: 'garminconnect@0.3.2 StepType.REST' },
    stepTypeRepeat: { id: 6, key: 'repeat', displayOrder: 6, verified: true, src: 'garminconnect@0.3.2 StepType.REPEAT' },
    condTime: { id: 2, key: 'time', displayOrder: 2, verified: true, src: 'garminconnect@0.3.2 ConditionType.TIME' },
    condIterations: { id: 7, key: 'iterations', displayOrder: 7, verified: true, src: 'garminconnect@0.3.2 ConditionType.ITERATIONS' },
    /* NICHT belegt — ConditionType kennt kein REPS. */
    condReps: { id: null, key: 'reps', displayOrder: 10, verified: false, gate: 'G1', candidateId: 10,
      src: 'nicht belegt; ConditionType in garminconnect@0.3.2 enthaelt kein REPS' },
    targetNone: { id: 1, key: 'no.target', displayOrder: 1, verified: true, src: 'garminconnect@0.3.2 TargetType.NO_TARGET' },
    /* Schluessel belegt (FIT sub_sport #20), Zahl uebertragen aus FIT sport #10. */
    sportStrength: { id: null, key: 'strength_training', displayOrder: 5, verified: false, gate: 'G1', candidateId: 10,
      src: 'Schluessel: FIT sub_sport #20 strength_training (belegt). Zahl: Uebertragung aus FIT sport #10 training in den REST-Namensraum (NICHT belegt)' }
  };

  var CATALOG_SOURCES = ['fit-sdk@21.213.0'];
  /* [A] Nur mit options.includeWeight. Gelesen wird in Gramm; die
     Schreibrichtung ist unbestaetigt (Gate G3). */
  var WEIGHT_SCALE_ASSUMPTION = { unit: 'gram', factorFromKg: 1000, verified: false, gate: 'G3' };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }

  function stepType(c) { return { stepTypeId: c.id, stepTypeKey: c.key, displayOrder: c.displayOrder }; }
  function endCond(c, fill) {
    return {
      conditionTypeId: (c.verified || fill) ? (c.verified ? c.id : c.candidateId) : null,
      conditionTypeKey: c.key, displayOrder: c.displayOrder, displayable: true
    };
  }
  function sportType(fill) {
    var c = CONST.sportStrength;
    return { sportTypeId: (c.verified || fill) ? (c.verified ? c.id : c.candidateId) : null,
      sportTypeKey: c.key, displayOrder: c.displayOrder };
  }
  function targetNone() {
    return { workoutTargetTypeId: CONST.targetNone.id, workoutTargetTypeKey: CONST.targetNone.key,
      displayOrder: CONST.targetNone.displayOrder };
  }

  /* Slugauflösung: die Zuordnungstabelle ist über den stabilen `slug`
     geschlüsselt, die Planübung trägt die technische exercise_id.

     WICHTIG: der Datenvertrag normalisiert die Liste und reicht dabei
     BEWUSST keine unbekannten Felder durch (v8-321) — ein an der Rohzeile
     mitgegebener `slug` überlebt die Normalisierung also NICHT. Deshalb wird
     die Zuordnung exerciseId → slug VOR der Normalisierung aus der Rohliste
     gesammelt, nicht über den Listenindex (der sich verschiebt, sobald der
     Vertrag eine Zeile abweist).

     Ohne Auflösung wird NICHTS geraten — die Übung landet in `unmapped`. */
  function slugIndex(input) {
    var idx = {};
    var raw = input && input.plannedExercises;
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var e = raw[i];
        if (isObj(e) && typeof e.slug === 'string' && e.slug && typeof e.exerciseId === 'string') {
          idx[e.exerciseId] = e.slug;
        }
      }
    }
    var m = input && input.slugs;
    if (isObj(m)) for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k) && typeof m[k] === 'string' && m[k]) idx[k] = m[k];
    return idx;
  }
  function slugOf(ex, idx, input) {
    if (ex && typeof idx[ex.exerciseId] === 'string') return idx[ex.exerciseId];
    if (input && typeof input.slugFor === 'function') {
      var s = input.slugFor(ex && ex.exerciseId);
      if (typeof s === 'string' && s) return s;
    }
    return null;
  }

  function buildGarminStrengthWorkout(input) {
    var warnings = [], unmapped = [], stepBindings = [];
    var opts = (input && isObj(input.options)) ? input.options : {};
    var fill = opts.fillUnverifiedIds === true;
    var withWeight = opts.includeWeight === true;

    if (!isObj(input)) return fail('invalid_input', warnings, unmapped);
    var occ = isObj(input.occurrence) ? input.occurrence : null;
    var mapping = input.mapping || null;
    if (!mapping || typeof mapping.toGarmin !== 'function') {
      return fail('no_mapping_module', warnings, unmapped);
    }
    var SP = O.strengthPlan;
    if (!SP || typeof SP.normalizePlanned !== 'function') {
      return fail('no_strength_contract', warnings, unmapped);
    }

    /* Reihenfolge und Sollwerte kommen AUSSCHLIESSLICH aus dem kanonischen
       Vertrag — der Exporter sortiert nicht selbst. */
    var norm = SP.normalizePlanned(input.plannedExercises);
    var planned = norm.exercises;
    if (norm.dropped) {
      warnings.push({ code: 'contract_rejected_entries', count: norm.dropped,
        detail: 'vom Datenvertrag abgewiesene Planzeilen — nicht exportiert', errors: norm.errors });
    }

    /* Provenienz: nie als doppelt verifiziert ausgeben. */
    if (CATALOG_SOURCES.length < 2) {
      warnings.push({ code: 'single_catalog_source', sources: CATALOG_SOURCES.slice(),
        detail: 'Der Uebungskatalog ist gegen genau EINE Quelle nachgewiesen (offizielles FIT SDK). Die zweite Quelle (Connect-Uebungspicker) war nicht erreichbar.' });
    }
    if (fill) {
      warnings.push({ code: 'unverified_ids_filled', gate: 'G1',
        fields: ['sportType.sportTypeId', 'endCondition.conditionTypeId(reps)'],
        detail: 'AUSDRUECKLICHER TESTMODUS: nicht belegte numerische IDs wurden mit Kandidatenwerten gefuellt. Nicht fuer den Regelbetrieb.' });
    }
    if (withWeight) {
      warnings.push({ code: 'weight_export_enabled', gate: 'G3', assumption: WEIGHT_SCALE_ASSUMPTION,
        detail: 'AUSDRUECKLICHER TESTMODUS: Zielgewichte werden exportiert. Die Skalierung kg × 1000 ist eine ANNAHME und erst nach G3 produktiv zulaessig.' });
    }

    var slugIdx = slugIndex(input);
    var steps = [], order = 1;

    for (var i = 0; i < planned.length; i++) {
      var ex = planned[i];
      var slug = slugOf(ex, slugIdx, input);
      if (!slug) {
        unmapped.push({ plannedIndex: i, exerciseId: ex.exerciseId, slug: null,
          status: 'unmapped', reason: 'no_slug',
          detail: 'Zur exercise_id liess sich kein stabiler Slug aufloesen — es wurde keine aehnliche Uebung eingesetzt.' });
        continue;
      }
      var g = mapping.toGarmin(slug);
      if (!g || !g.ok) {
        unmapped.push({ plannedIndex: i, exerciseId: ex.exerciseId, slug: slug,
          status: (g && g.status) || 'unmapped', reason: (g && g.reason) || 'not_mapped',
          detail: 'Nicht exportiert. Es wurde keine aehnliche Uebung eingesetzt.' });
        continue;
      }
      /* Wiederholungen sind Pflicht — Garmin braucht eine Zahl, und geraten
         wird sie hier nicht. */
      if (!isInt(ex.minReps)) {
        unmapped.push({ plannedIndex: i, exerciseId: ex.exerciseId, slug: slug,
          status: 'mapped', reason: 'missing_reps',
          detail: 'Ohne Wiederholungsvorgabe kein Schritt — eine Zahl zu schaetzen ist ausgeschlossen.' });
        continue;
      }
      if (ex.maxReps !== ex.minReps) {
        warnings.push({ code: 'rep_range_collapsed', plannedIndex: i, slug: slug,
          from: [ex.minReps, ex.maxReps], to: ex.minReps,
          detail: 'Garmin kennt nur EINE Wiederholungszahl je Schritt. Exportiert wird die untere Grenze.' });
      }
      var rest = ex.restSeconds;
      if (rest === null || rest === undefined) {
        rest = (SP.TIME && SP.TIME.defaultRestSeconds) || 120;
        warnings.push({ code: 'rest_default_applied', plannedIndex: i, slug: slug, seconds: rest,
          detail: 'Keine Pause geplant. Eingesetzt wurde der dokumentierte Vertragsdefault [A3] aus strength-plan.js — nicht ein hier neu erfundener Wert.' });
      }
      /* Rückweg-Risiko aus der Zuordnungstabelle durchreichen. K4 leitet
         daraus KEINE Rückkanalzuordnung ab — es ist reine Meldung. */
      var entry = (typeof mapping.forSlug === 'function') ? mapping.forSlug(slug) : null;
      if (entry && entry.returnVariantRisk === 'high') {
        warnings.push({ code: 'return_variant_risk_high', plannedIndex: i, slug: slug,
          garmin: g.category + '/' + g.name, gate: 'G2',
          detail: (entry.riskNote || '') + ' K4 leitet daraus keine Rueckkanalzuordnung ab.' });
      }

      var setStep = {
        type: 'ExecutableStepDTO', stepOrder: 0,
        stepType: stepType(CONST.stepTypeInterval),
        endCondition: endCond(CONST.condReps, fill),
        endConditionValue: ex.minReps,
        targetType: targetNone(),
        category: g.category, exerciseName: g.name,
        exerciseCategoryId: g.categoryCode, exerciseNameId: g.nameCode
      };
      if (withWeight && typeof ex.targetWeightKg === 'number') {
        setStep.weightValue = ex.targetWeightKg * WEIGHT_SCALE_ASSUMPTION.factorFromKg;
        setStep.weightUnit = { unitKey: WEIGHT_SCALE_ASSUMPTION.unit };
      }
      var restStep = {
        type: 'ExecutableStepDTO', stepOrder: 0,
        stepType: stepType(CONST.stepTypeRest),
        endCondition: endCond(CONST.condTime, fill),
        endConditionValue: rest,
        targetType: targetNone()
      };

      var bindBase = { exerciseId: ex.exerciseId, slug: slug, plannedIndex: i,
        mappingVersion: g.mappingVersion || null, category: g.category, exerciseName: g.name };

      if (ex.sets > 1) {
        var group = {
          type: 'RepeatGroupDTO', stepOrder: order++,
          stepType: stepType(CONST.stepTypeRepeat),
          numberOfIterations: ex.sets,
          endCondition: endCond(CONST.condIterations, fill),
          endConditionValue: ex.sets,
          smartRepeat: false,
          workoutSteps: []
        };
        stepBindings.push(Object.assign({ stepOrder: group.stepOrder, kind: 'repeat', sets: ex.sets }, bindBase));
        setStep.stepOrder = order++;
        restStep.stepOrder = order++;
        group.workoutSteps.push(setStep, restStep);
        steps.push(group);
        stepBindings.push(Object.assign({ stepOrder: setStep.stepOrder, kind: 'set', reps: ex.minReps }, bindBase));
        stepBindings.push(Object.assign({ stepOrder: restStep.stepOrder, kind: 'rest', seconds: rest }, bindBase));
      } else {
        setStep.stepOrder = order++;
        restStep.stepOrder = order++;
        steps.push(setStep, restStep);
        stepBindings.push(Object.assign({ stepOrder: setStep.stepOrder, kind: 'set', reps: ex.minReps }, bindBase));
        stepBindings.push(Object.assign({ stepOrder: restStep.stepOrder, kind: 'rest', seconds: rest }, bindBase));
      }
    }

    if (!steps.length) {
      return { ok: false, reason: 'no_mappable_exercise', workout: null, stepBindings: [],
        unmapped: unmapped, warnings: warnings, version: VERSION, catalogSources: CATALOG_SOURCES.slice() };
    }

    var name = (occ && (occ.title || occ.l)) ? String(occ.title || occ.l) : 'Krafttraining';
    var workout = {
      workoutName: name,
      sportType: sportType(fill),
      estimatedDurationInSecs: estimateSecs(stepBindings),
      workoutSegments: [{ segmentOrder: 1, sportType: sportType(fill), workoutSteps: steps }]
    };
    if (occ && occ.occurrenceId) workout.description = 'ORVIA ' + occ.occurrenceId;

    return { ok: true, workout: workout, stepBindings: stepBindings, unmapped: unmapped,
      warnings: warnings, version: VERSION, catalogSources: CATALOG_SOURCES.slice() };
  }

  /* Dauer aus den TATSAECHLICH erzeugten Schritten, nicht aus dem Plan —
     nicht exportierte Uebungen duerfen nicht mitzaehlen. [A] Arbeitszeit je
     Satz aus dem Datenvertrag (strength-plan TIME.setWorkSeconds). */
  function estimateSecs(bindings) {
    var work = (O.strengthPlan && O.strengthPlan.TIME && O.strengthPlan.TIME.setWorkSeconds) || 40;
    /* Eine Wiederholungsgruppe fuehrt ihre beiden Kindschritte n-mal aus. */
    var iters = {};
    for (var i = 0; i < bindings.length; i++) {
      if (bindings[i].kind === 'repeat') iters[bindings[i].plannedIndex] = bindings[i].sets;
    }
    var total = 0;
    for (var j = 0; j < bindings.length; j++) {
      var b = bindings[j], n = iters[b.plannedIndex] || 1;
      if (b.kind === 'set') total += n * work;
      else if (b.kind === 'rest') total += n * b.seconds;
    }
    return Math.round(total);
  }

  function fail(reason, warnings, unmapped) {
    return { ok: false, reason: reason, workout: null, stepBindings: [],
      unmapped: unmapped || [], warnings: warnings || [], version: VERSION,
      catalogSources: CATALOG_SOURCES.slice() };
  }

  O.garminWorkoutExport = {
    VERSION: VERSION,
    CONST: CONST,
    CATALOG_SOURCES: CATALOG_SOURCES,
    WEIGHT_SCALE_ASSUMPTION: WEIGHT_SCALE_ASSUMPTION,
    buildGarminStrengthWorkout: buildGarminStrengthWorkout
  };
})();
