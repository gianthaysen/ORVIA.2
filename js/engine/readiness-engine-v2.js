/* ============================================================
   ORVIA · readiness-engine-v2 — Track C (C2): „Wie belastbar bin ich heute?"
   PARALLEL zur Alt-Engine, NICHT AKTIV (Aktivierungsgate C8).

   Kernkorrekturen gegenüber calc.js (Engine-Audit E1–E5):
   1. KEINE erfundenen Werte: fehlende Inputs werden entfernt und renormalisiert
     (wie bisher), aber zusätzlich in missingData[] ausgewiesen; es gibt keine
     stillen Formular-/Engine-Defaults (sleep 7 h, feel 7, doms 2 entfallen).
   2. Ein Input — eine Wirkung: Schmerz wirkt NICHT mehr vierfach; die Readiness
     bewertet nur physiologische Erholung, Schmerz/Beschwerden sind Sache der
     Decision-Engine (Gates), nicht des Erholungs-Scores.
   3. Konsistente Baseline-Statistik: ln-HRV gegen 7-Tage-Basislinie mit
     SWC = 0,5 × SD(28 T); ohne ausreichende Historie → missing_baseline
     statt Bestrafung. Ruhepuls nur gegen PERSÖNLICHE Basislinie.
   4. Score ohne Entscheidungs-Caps: die Zahl ist ein Erholungsmaß; Kappungen
     nach Tageszustand gehören zur Decision-Engine (klare Trennung).
   Output (C2/C4): { score, confidence, factors[], warnings[], missingData[] }.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function C() { return O.engineContracts; }

  /* Faktor-Definitionen: id · Gewicht · Bewertung 0–100 aus ehrlichen Inputs.
     Gewichte bewusst als HEURISTIK dokumentiert (keine Scheinvalidierung). */
  function scoreSleep(input) {
    // Schlafdauer gegen individuelles Ziel (Profil), NIE gegen fixe 480 min.
    if (input.sleepMinutes == null) return null;
    var goal = (input.sleepGoalHours != null ? input.sleepGoalHours : null);
    if (goal == null) {
      // Ohne Ziel: grobe, transparente Skala 4h→0 … 8h→100 (dokumentierte Heuristik).
      return clamp(Math.round(((input.sleepMinutes / 60) - 4) / 4 * 100), 0, 100);
    }
    var ratio = (input.sleepMinutes / 60) / goal;
    return clamp(Math.round((ratio - 0.6) / 0.4 * 100), 0, 100);   // 60 % des Ziels → 0 · 100 % → 100
  }
  function scoreSleepQuality(input) { return input.sleepQuality == null ? null : clamp(input.sleepQuality * 10, 0, 100); }
  function scoreFeel(input) { return input.feel == null ? null : clamp(input.feel * 10, 0, 100); }
  function scoreSoreness(input) { return input.soreness == null ? null : clamp((10 - input.soreness) * 10, 0, 100); }
  function scoreStress(input) {
    if (!input.stress) return null;
    return input.stress === 'Low' ? 100 : input.stress === 'Med' ? 60 : input.stress === 'High' ? 25 : null;
  }
  function scoreHrv(input, out) {
    // ln(HRV) gegen 7-Tage-Basislinie; SWC = 0,5 × SD28. Ohne Baseline: ehrlich fehlend.
    if (input.hrvMs == null) {
      if (input.hrvStatus === 'Good') return 100;
      if (input.hrvStatus === 'Balanced') return 85;
      if (input.hrvStatus === 'Low' || input.hrvStatus === 'Unbalanced') return 45;
      return null;
    }
    if (input.hrvBaselineLn == null || input.hrvSd28 == null || (input.hrvBaselineDays || 0) < 14) {
      out.warnings.push(C().reason('missing_baseline', { marker: 'hrv', days: input.hrvBaselineDays || 0 }));
      return null;   // kein Vergleich ohne Basislinie — nicht raten
    }
    var ln = Math.log(input.hrvMs);
    if (ln >= input.hrvBaselineLn - 0.5 * input.hrvSd28) return 100;
    if (ln >= input.hrvBaselineLn - 1.0 * input.hrvSd28) return 60;
    return 25;
  }
  function scoreRestingHr(input, out) {
    if (input.restingHr == null) return null;
    if (input.rhrBaseline == null || (input.rhrBaselineDays || 0) < 7) {
      out.warnings.push(C().reason('missing_baseline', { marker: 'restingHr', days: input.rhrBaselineDays || 0 }));
      return null;
    }
    var dev = input.restingHr - input.rhrBaseline;
    if (dev <= 0) return 100;                       // unter Basislinie: neutral gut, kein Bonusrausch
    return clamp(Math.round(100 - dev * 11), 0, 100);
  }
  function scoreBodyBattery(input) { return input.bodyBattery == null ? null : clamp(input.bodyBattery, 0, 100); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var FACTORS = [
    { id: 'sleep_duration', weight: 16, fn: scoreSleep, missingLabel: 'Schlafdauer' },
    { id: 'sleep_quality', weight: 14, fn: scoreSleepQuality, missingLabel: 'Schlafqualität' },
    { id: 'hrv', weight: 20, fn: scoreHrv, missingLabel: 'HRV' },
    { id: 'resting_hr', weight: 15, fn: scoreRestingHr, missingLabel: 'Ruhepuls' },
    { id: 'feel', weight: 15, fn: scoreFeel, missingLabel: 'Befinden' },
    { id: 'soreness', weight: 12, fn: scoreSoreness, missingLabel: 'Muskelkater' },
    { id: 'stress', weight: 8, fn: scoreStress, missingLabel: 'Stress' }
    // bodyBattery bewusst NICHT im Score (Doppelzählung von HRV/Schlaf/Stress —
    // Audit E-Befund); wird als Zusatzinfo in factors geführt, Gewicht 0.
  ];

  /* evaluate(input): input = ehrliche Rohwerte (null = nicht erfasst).
     { sleepMinutes, sleepGoalHours, sleepQuality(1–10), feel(1–10), soreness(0–10),
       stress('Low'|'Med'|'High'), hrvMs, hrvStatus, hrvBaselineLn, hrvSd28,
       hrvBaselineDays, restingHr, rhrBaseline, rhrBaselineDays, bodyBattery } */
  function evaluate(input) {
    input = input || {};
    var out = { score: null, confidence: 'low', factors: [], warnings: [], missingData: [] };
    var sum = 0, wsum = 0, present = 0;
    FACTORS.forEach(function (f) {
      var v = f.fn(input, out);
      out.factors.push({ id: f.id, value: v, weight: f.weight });
      if (v == null) { out.missingData.push(f.id); return; }
      present++;
      sum += v * f.weight; wsum += f.weight;
    });
    var bb = scoreBodyBattery(input);
    out.factors.push({ id: 'body_battery', value: bb, weight: 0 });
    if (wsum > 0 && present >= 2) {
      out.score = Math.round(sum / wsum);
    } else {
      out.score = null;   // <2 echte Marker: keine Zahl vortäuschen
      out.warnings.push(C().reason('missing_checkin', { presentFactors: present }));
    }
    // Warnhinweise aus einzelnen Markern (nur wenn Daten vorhanden):
    var byId = {}; out.factors.forEach(function (f) { byId[f.id] = f.value; });
    if (byId.sleep_duration != null && byId.sleep_duration <= 35) out.warnings.push(C().reason('poor_sleep', { score: byId.sleep_duration }));
    else if (byId.sleep_quality != null && byId.sleep_quality <= 30) out.warnings.push(C().reason('poor_sleep', { qualityScore: byId.sleep_quality }));
    if (byId.resting_hr != null && byId.resting_hr <= 55) out.warnings.push(C().reason('elevated_resting_hr', { score: byId.resting_hr }));
    if (byId.hrv != null && byId.hrv <= 30) out.warnings.push(C().reason('low_hrv', { score: byId.hrv }));
    if (byId.stress != null && byId.stress <= 25) out.warnings.push(C().reason('high_stress', {}));
    if (byId.soreness != null && byId.soreness <= 30) out.warnings.push(C().reason('high_soreness', { score: byId.soreness }));
    out.confidence = C().confidenceFrom(out.missingData, { coreCount: FACTORS.length });
    return out;
  }

  O.readinessEngineV2 = { evaluate: evaluate, FACTORS: FACTORS, _clamp: clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.readinessEngineV2;
})(typeof globalThis !== 'undefined' ? globalThis : this);
