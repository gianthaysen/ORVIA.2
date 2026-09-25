/* ============================================================
   ORVIA · goal-feasibility-adapter — A-08

   WOFÜR. goal-feasibility.js ist ein reiner Bewerter; es rechnet, aber niemand
   ruft es. Dieser Adapter baut aus dem, was die App ohnehin hat — dem Zielobjekt
   (mainGoalOf, seit A-06 die kanonische Quelle) und dem aufgelösten
   Leistungsbild (performanceResolver) — die Eingabe, ruft feasibility() und
   PROTOKOLLIERT das Ergebnis. Er ist ein BEOBACHTER: keine harten Blocker, kein
   Einfluss auf den Plan. Band 1, A-08.

   DIE ENTSCHEIDENDE REGEL — GLEICHES MIT GLEICHEM. Ein Halbmarathon-Ziel ist
   eine ZIELZEIT (6600 s), ein Leistungswert eine SCHWELLENPACE (300 s/km). Beide
   sind „kleiner ist besser", aber sie messen NICHT dasselbe. Wer 6600 gegen 300
   rechnet, bekommt eine Prozentzahl, die nichts bedeutet — genau die
   Scheingenauigkeit, die der Bewerter selbst vermeidet. Der Adapter bildet
   deshalb NUR dann eine Eingabe, wenn Ziel und Leistung dieselbe messbare Größe
   sind (FTP-Ziel ↔ gemessene FTP; VO2max-Ziel ↔ gemessene VO2max;
   Schwellenpace-Ziel ↔ Schwellenpace). Für Zielzeiten über eine Distanz fehlt
   die belastbare Umrechnung Zeit→Schwelle; dort meldet der Adapter ehrlich
   `metric_not_commensurable` statt eine Zahl zu erfinden.

   Kein DOM. Zeit und Quellen kommen herein — sonst wäre es nicht testbar.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'goal-feasibility-adapter@2';

  /* Welche messbare Groesse steckt hinter Ziel bzw. Leistung? Zwei Eingaben sind
     nur vergleichbar, wenn sie dieselbe DIMENSION treffen. Absichtlich klein:
     lieber ehrlich „nicht vergleichbar" als ein weiter Sammeltopf, der alles
     irgendwie zusammenzieht. */
  function _mkey(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  var DIMENSION = {
    /* Leistungs-Metriken (performanceResolver) UND Ziel-Vokabular
       (goalMetricTypeFor: time/pace/power/count/…) landen im selben Topf, damit
       Ziel- und Leistungsseite auf DIESELBE Dimension abgebildet werden. */
    ftp: 'power', ftpwatts: 'power', watts: 'power', powerwatts: 'power', power: 'power',
    vo2max: 'vo2max', vdot: 'vo2max',
    thresholdpacesecperkm: 'threshold_pace', pacesecperkm: 'threshold_pace', pace: 'threshold_pace',
    csssecper100: 'swim_threshold', swimpacesecper100: 'swim_threshold',
    /* Eine ZIELZEIT ist eine eigene, BEKANNTE Dimension — nur eben nicht
       dieselbe wie eine Schwellenpace. Sie hier zu fuehren erlaubt die ehrliche
       Aussage „bekannt, aber nicht vergleichbar" statt „unbekannt". Die
       Umrechnung Zeit→Schwelle bleibt bewusst aussen vor (ein Modell). */
    time: 'race_time', racetime: 'race_time', finishtime: 'race_time',
    halfmarathontime: 'race_time', marathontime: 'race_time', timesec: 'race_time'
  };
  /* Kategorie-Kuerzel des Ziels, die keine eigene metricType tragen. */
  var CATEGORY_DIM = { ftp: 'power', vo2max: 'vo2max' };
  function dimensionOf(key) { return DIMENSION[_mkey(key)] || null; }
  function goalDimensionOf(g) {
    if (!g) return null;
    return dimensionOf(g.metricType) || dimensionOf(g.metric)
      || CATEGORY_DIM[_mkey(g.category || g.type)] || dimensionOf(g.category || g.type) || null;
  }

  /* Sport aus der Zielkategorie ableiten — nur so viel, wie fuer die Zuordnung
     zum Leistungsbild noetig ist. */
  function sportOfGoal(g) {
    var c = _mkey(g && (g.category || g.type));
    if (c === 'ftp' || /cycl|rad|bike/.test(c)) return 'cycling';
    if (/swim|schwimm/.test(c)) return 'swimming';
    return 'running';
  }

  /* Aus dem aufgeloesten Leistungsbild (resolveAll) den passenden Messwert
     ziehen — und NUR wenn er entscheidungsfaehig ist. Der Bewerter lehnt
     schwache Evidenz ohnehin ab; hier wird sie erst gar nicht als Wert
     ausgegeben, damit die Dimensionpruefung nicht an Rauschen scheitert. */
  function perfFromResolved(resolved, sport) {
    var s = resolved && resolved.sports && resolved.sports[sport];
    if (!s || !s.ok) return null;
    // running/laufen: Schwellenpace; cycling: FTP-Watt; swimming: CSS.
    if (sport === 'running' && s.thresholdPaceSecPerKm > 0)
      return { metric: 'thresholdPaceSecPerKm', value: s.thresholdPaceSecPerKm,
        evidence: s.confidence || s.evidence || null, ageRatio: s.ageRatio == null ? null : s.ageRatio };
    if (sport === 'cycling' && s.ftpWatts > 0)
      return { metric: 'ftpWatts', value: s.ftpWatts,
        evidence: s.confidence || s.evidence || null, ageRatio: s.ageRatio == null ? null : s.ageRatio };
    if (sport === 'swimming' && s.cssSecPer100 > 0)
      return { metric: 'cssSecPer100', value: s.cssSecPer100,
        evidence: s.confidence || s.evidence || null, ageRatio: s.ageRatio == null ? null : s.ageRatio };
    return null;
  }

  /* ---- @2 (25.09.2026): ZIELZEIT-Ziele bewerten.
     Bis @1 war ein Laufziel mit Zielzeit (race_time) gegen die Schwellenpace
     (threshold_pace) „nicht vergleichbar" — und damit wurde das haeufigste
     Ziel der App (Halbmarathon 1:50) NIE bewertet: observe() kam mit
     metric_not_commensurable zurueck, die Karte zeigte nur den Korridor von
     heute, ohne das Datum. Gians Beispiel: 5 km in 40 min, Marathon unter
     2:30 in zwei Monaten — die App sagte nichts.
     Die Umrechnung Zeit→Schwelle bleibt bewusst aussen vor. Stattdessen wird
     die LEISTUNG in die Zieldimension gebracht — mit genau dem Riegel-Modell,
     das die Prognosekarte ohnehin zeigt (performanceZones.forecast): heutige
     realistische Zeit fuer die Zieldistanz als Wert, optimistisch/vorsichtig
     als Band, modelBasis 'riegel_extrapolation' (der Bewerter stuft die
     Evidenz dafuer bereits herab). Alles in Sekunden. */
  var RUN_DIST_KM = { run5k: 5, '5k': 5, run10k: 10, '10k': 10, halfmarathon: 21.0975, hm: 21.0975, marathon: 42.195 };
  function goalDistanceKm(g) {
    if (g && g.distanceKm > 0) return g.distanceKm;
    return RUN_DIST_KM[_mkey(g && (g.category || g.type))] || null;
  }
  function goalTargetSeconds(g) {
    var v = g && g.targetValue;
    if (!(v > 0)) return null;
    if (g.unit === 'min') return v * 60;
    return v;   /* 's' oder metricType 'time' ⇒ Sekunden (goal-plan-input, dieselbe Regel) */
  }
  function raceTimePerf(resolved, goal) {
    var s = resolved && resolved.sports && resolved.sports.running;
    if (!s || !s.ok) return null;
    var PZ = O.performanceZones;
    if (!PZ || typeof PZ.forecast !== 'function') return null;
    var dist = goalDistanceKm(goal);
    if (!(dist > 0)) return null;
    var fc = null; try { fc = PZ.forecast(s, dist); } catch (e) { return null; }
    if (!fc || fc.ok !== true || !(fc.realisticMin > 0)) return null;
    return { metric: 'race_time', value: Math.round(fc.realisticMin * 60),
      band: { min: Math.round(fc.optimisticMin * 60), max: Math.round(fc.cautiousMin * 60) },
      evidence: fc.confidence || s.confidence || null, ageRatio: s.ageRatio == null ? null : s.ageRatio,
      modelBasis: 'riegel_extrapolation', distanceKm: dist };
  }

  /* ---- Eingabe bauen (rein) ----
     opts: { goal, resolvedPerformance, allowableProgression, today }
     Rueckgabe: { input } ODER { skip:true, reason } — nie beides, nie ein Wurf. */
  function buildInput(opts) {
    opts = opts || {};
    var g = opts.goal || null;
    if (!g) return { skip: true, reason: 'no_goal' };
    if (!(g.targetValue > 0)) return { skip: true, reason: 'no_target_value' };

    var sport = sportOfGoal(g);
    var zielDim = goalDimensionOf(g);
    var perf = null, targetValue = g.targetValue;
    if (zielDim === 'race_time' && sport === 'running') {
      perf = raceTimePerf(opts.resolvedPerformance, g);
      if (!perf) return { skip: true, reason: 'no_usable_performance:running_race_time' };
      targetValue = goalTargetSeconds(g);
      if (!(targetValue > 0)) return { skip: true, reason: 'no_target_value' };
    } else {
      perf = perfFromResolved(opts.resolvedPerformance, sport);
    }
    if (!perf) return { skip: true, reason: 'no_usable_performance:' + sport };

    var perfDim = dimensionOf(perf.metric);
    if (!zielDim || !perfDim) return { skip: true, reason: 'dimension_unknown' };
    if (zielDim !== perfDim)
      return { skip: true, reason: 'metric_not_commensurable:' + zielDim + '_vs_' + perfDim };

    return { input: {
      goal: { targetValue: targetValue, metricType: g.metricType || perf.metric },
      currentPerformance: perf,
      allowableProgression: opts.allowableProgression || null,
      level: opts.level || (g.level || null),
      today: opts.today || null,
      targetDate: g.targetDate || null
    } };
  }

  /* ---- Beobachten: bauen -> bewerten -> zurueckgeben. Wirft nie. Blockiert
     nichts. Wer den Rueckgabewert ignoriert, veraendert am Plan gar nichts. */
  function observe(opts) {
    var built;
    try { built = buildInput(opts); }
    catch (e) { return { evaluated: false, reason: 'build_threw', version: VERSION }; }
    if (built.skip) return { evaluated: false, reason: built.reason, version: VERSION };
    if (!O.goalFeasibility || typeof O.goalFeasibility.feasibility !== 'function')
      return { evaluated: false, reason: 'feasibility_missing', version: VERSION };
    var res;
    try { res = O.goalFeasibility.feasibility(built.input); }
    catch (e) { return { evaluated: false, reason: 'feasibility_threw', version: VERSION }; }
    return { evaluated: true, version: VERSION, status: res.status, result: res, input: built.input };
  }

  var api = {
    VERSION: VERSION, DIMENSION: DIMENSION,
    dimensionOf: dimensionOf, goalDimensionOf: goalDimensionOf, sportOfGoal: sportOfGoal,
    perfFromResolved: perfFromResolved, raceTimePerf: raceTimePerf, goalDistanceKm: goalDistanceKm, goalTargetSeconds: goalTargetSeconds,
    buildInput: buildInput, observe: observe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalFeasibilityAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
