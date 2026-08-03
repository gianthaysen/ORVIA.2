/* ============================================================
   ORVIA · engine-contracts — Track C (C2/C3/C4): gemeinsame Verträge der
   Engine v2. NICHT AKTIV (kein index.html-/sw.js-Eintrag): die alte Engine
   (calc.js buildTrainingDecision) bleibt produktiv, bis das Aktivierungsgate
   (C8, ENGINE-V2-DESIGN.md) erfüllt ist.

   Grundsätze:
   - Drei getrennte Schichten: Readiness („Wie belastbar bin ich heute?"),
     Decision („Was sollte ich heute tun?"), Plan („Wie ist meine Woche gebaut?").
   - Explainability: maschinenlesbare Reason-Codes statt fest verdrahteter Texte.
   - Ehrliche Unsicherheit: fehlende Daten senken confidence und landen in
     missingData[] — es werden NIE Werte erfunden oder Defaults persistiert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var RULE_VERSION = 'v2.0.0-parallel';

  /* ---------- C3 · Reason-Katalog (Code → Titel/Erklärung, deutsch) ---------- */
  var REASONS = {
    // Safety
    red_flag_symptom: { severity: 'critical', title: 'Warnsymptom gemeldet', explanation: 'Ein gemeldetes Warnsymptom (z. B. Fieber, Brustschmerz, Schwindel) hat Vorrang vor allen Trainingszielen.' },
    severe_pain: { severity: 'critical', title: 'Starke Schmerzen', explanation: 'Schmerzintensität im hohen Bereich — heute kein belastendes Training.' },
    illness: { severity: 'high', title: 'Krankheitsgefühl', explanation: 'Bei Krankheitszeichen wird die Belastung deutlich reduziert.' },
    active_constraint: { severity: 'high', title: 'Aktive Beschwerde', explanation: 'Eine gemeldete Beschwerde schränkt bestimmte Belastungsformen ein.' },
    // Recovery
    poor_sleep: { severity: 'medium', title: 'Wenig oder schlechter Schlaf', explanation: 'Die letzte Nacht lag deutlich unter deinem Bedarf.' },
    elevated_resting_hr: { severity: 'medium', title: 'Erhöhter Ruhepuls', explanation: 'Dein Ruhepuls liegt über deiner persönlichen Basislinie.' },
    low_hrv: { severity: 'medium', title: 'HRV unter Basislinie', explanation: 'Deine Herzratenvariabilität liegt unter dem üblichen Bereich.' },
    high_stress: { severity: 'low', title: 'Hoher Alltagsstress', explanation: 'Stress reduziert die Kapazität für intensive Reize.' },
    high_soreness: { severity: 'medium', title: 'Deutlicher Muskelkater', explanation: 'Starke Muskelermüdung spricht gegen erneute harte Belastung derselben Strukturen.' },
    insufficient_recovery: { severity: 'high', title: 'Unzureichende Erholung', explanation: 'Mehrere Erholungsmarker sind gleichzeitig auffällig.' },
    // Load
    high_recent_load: { severity: 'medium', title: 'Hohe aktuelle Belastung', explanation: 'Deine letzte Trainingswoche liegt deutlich über deinem gewohnten Niveau.' },
    load_spike: { severity: 'high', title: 'Belastungssprung', explanation: 'Die akute Last steigt schneller, als sich dein Körper anpassen kann.' },
    high_monotony: { severity: 'low', title: 'Eintönige Belastung', explanation: 'Sehr gleichförmige Tage erhöhen das Ermüdungsrisiko — Variation hilft.' },
    consecutive_hard_days: { severity: 'medium', title: 'Harte Tage in Folge', explanation: 'Nach intensiven Tagen braucht der Körper einen leichteren Reiz.' },
    // Kontext
    target_event_near: { severity: 'medium', title: 'Wettkampf steht bevor', explanation: 'Kurz vor dem Ziel-Event wird Frische wichtiger als zusätzlicher Reiz (Taper).' },
    schedule_conflict: { severity: 'low', title: 'Terminkonflikt', explanation: 'Ein fester Termin kollidiert mit der geplanten Einheit.' },
    availability_limited: { severity: 'low', title: 'Begrenzte Verfügbarkeit', explanation: 'Der Plan respektiert deine verfügbaren Tage.' },
    beginner_progression: { severity: 'medium', title: 'Behutsame Progression', explanation: 'Als Einsteiger wächst die Belastung bewusst langsam — das schützt Sehnen und Gelenke.' },
    return_after_break: { severity: 'medium', title: 'Wiedereinstieg', explanation: 'Nach einer Pause wird unterhalb des früheren Niveaus wieder aufgebaut.' },
    // Struktur (jede Plan-Ausgabe ist erklärbar — C7)
    plan_structure: { severity: 'info', title: 'Wochenaufbau', explanation: 'Die Woche ist aus deiner Verfügbarkeit, deinem Trainingsstand und deinem Ziel abgeleitet.' },
    // Datenqualität
    insufficient_chronic_history: { severity: 'info', title: 'Zu wenig Trainingshistorie', explanation: 'Für einen Belastungsvergleich fehlt eine ausreichende ältere Historie — die letzte Woche allein ist keine chronische Basis.' },
    missing_baseline: { severity: 'info', title: 'Basislinie fehlt noch', explanation: 'Für diesen Marker gibt es noch zu wenig Daten für einen persönlichen Vergleich.' },
    missing_checkin: { severity: 'info', title: 'Kein Check-in', explanation: 'Ohne Morgen-Check-in ist die Tagesbewertung nur eingeschränkt möglich.' },
    low_data_confidence: { severity: 'info', title: 'Begrenzte Datenlage', explanation: 'Die Empfehlung beruht auf wenigen Datenpunkten und ist entsprechend vorsichtig.' }
  };
  /* Reason-Objekt bauen (C3): code + severity + title + explanation + inputValues + ruleVersion. */
  function reason(code, inputValues) {
    var def = REASONS[code] || { severity: 'info', title: code, explanation: '' };
    return { code: code, severity: def.severity, title: def.title, explanation: def.explanation, inputValues: inputValues || {}, ruleVersion: RULE_VERSION };
  }

  /* ---------- C4 · Confidence-Aggregation (ehrlich, deterministisch) ---------- */
  // confidence: 'high' | 'medium' | 'low' aus Anzahl/Gewicht fehlender Kern-Inputs.
  function confidenceFrom(missingData, opts) {
    opts = opts || {};
    var core = opts.coreCount != null ? opts.coreCount : 5;
    var missing = (missingData || []).length;
    if (missing === 0) return 'high';
    if (missing <= Math.max(1, Math.round(core * 0.4))) return 'medium';
    return 'low';
  }

  /* ---------- Gemeinsame Enums ---------- */
  var DAY_STATES = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
  var ACTIONS = ['KEEP', 'REDUCE_INTENSITY', 'REDUCE_VOLUME', 'SWAP_MODALITY', 'MOVE_SESSION', 'REST', 'REPLACE_WITH_RECOVERY'];
  var CONFIDENCE = ['high', 'medium', 'low'];

  /* ---------- Ergebnis-Validatoren (Vertragstests + Aktivierungsgate) ---------- */
  function isReadinessResult(r) {
    return !!r && typeof r === 'object'
      && (r.score === null || (typeof r.score === 'number' && r.score >= 0 && r.score <= 100))
      && CONFIDENCE.indexOf(r.confidence) >= 0
      && Array.isArray(r.factors) && Array.isArray(r.warnings) && Array.isArray(r.missingData)
      && r.factors.every(function (f) { return f && typeof f.id === 'string' && (f.value === null || typeof f.value === 'number') && typeof f.weight === 'number'; })
      && r.warnings.every(function (w) { return w && typeof w.code === 'string' && typeof w.ruleVersion === 'string'; });
  }
  function isDecisionResult(r) {
    return !!r && typeof r === 'object'
      && DAY_STATES.indexOf(r.dayState) >= 0
      && ACTIONS.indexOf(r.action) >= 0
      && (r.recommendedSession === null || (r.recommendedSession && typeof r.recommendedSession.label === 'string'))
      && Array.isArray(r.reasons) && r.reasons.every(function (x) { return x && typeof x.code === 'string'; })
      && Array.isArray(r.safeguards)
      && CONFIDENCE.indexOf(r.confidence) >= 0;
  }
  function isPlanResult(r) {
    return !!r && typeof r === 'object'
      && Array.isArray(r.week) && r.week.length === 7
      && r.week.every(function (d) {
        return d && typeof d.day === 'string' && Array.isArray(d.sessions)
          && d.sessions.every(function (s) { return s && typeof s.sport === 'string' && typeof s.intensity === 'string' && (s.minutes === null || (typeof s.minutes === 'number' && s.minutes >= 0)); });
      })
      && Array.isArray(r.reasons)
      && CONFIDENCE.indexOf(r.confidence) >= 0;
  }


  /* ===== GM7: fehlende Datenvertraege — jetzt EXPLIZIT als Schema-Validatoren =====
     Diese Vertraege sind der Grund, warum Planvarianten, Planqualitaets-Subscores,
     Zielprognose, Tagesziele und Max. Tagesbelastung im UI ehrlich leer sind.
     Das UI darf diese Bereiche erst fuellen, wenn ein Produzent (Engine/Provider)
     Objekte liefert, die diese Validatoren bestehen. KEIN UI-Ersatzmodell. */

  // planQuality: {total:0-100, subscores:{goalCoverage,recoveryDistribution,loadBalance,
  //   timeFeasibility,sportBalance,dataQuality: {value:0-100, rating:string}}, limitingFactors:[], ruleVersion}
  var PQ_KEYS = ['goalCoverage','recoveryDistribution','loadBalance','timeFeasibility','sportBalance','dataQuality'];
  function isPlanQuality(r) {
    if (!r || typeof r !== 'object') return false;
    if (!(typeof r.total === 'number' && r.total >= 0 && r.total <= 100)) return false;
    if (!r.subscores || typeof r.subscores !== 'object') return false;
    for (var i = 0; i < PQ_KEYS.length; i++) { var sc = r.subscores[PQ_KEYS[i]];
      if (!sc || typeof sc.value !== 'number' || sc.value < 0 || sc.value > 100 || typeof sc.rating !== 'string') return false; }
    return Array.isArray(r.limitingFactors) && typeof r.ruleVersion === 'string';
  }

  // forecast: Zielprognose-Korridor — konservativ/realistisch/optimistisch in Sekunden.
  function isForecast(r) {
    return !!(r && typeof r === 'object'
      && typeof r.goalId === 'string' && typeof r.metric === 'string'
      && [r.conservative, r.realistic, r.optimistic].every(function (v) { return typeof v === 'number' && v > 0; })
      && r.conservative >= r.realistic && r.realistic >= r.optimistic
      && r.uncertainty && typeof r.uncertainty.plusMinusSec === 'number'
      && CONFIDENCE.indexOf(r.confidence) >= 0 && typeof r.asOf === 'string');
  }

  // planVariants: A/B/C mit echter Wochenstruktur + Auswirkung.
  function isPlanVariants(r) {
    if (!r || !Array.isArray(r.variants) || r.variants.length < 2) return false;
    if (typeof r.recommendedVariantId !== 'string') return false;
    return r.variants.every(function (v) {
      return v && typeof v.id === 'string' && typeof v.name === 'string'
        && typeof v.timeBudgetHours === 'number' && typeof v.loadLevel === 'string'
        && typeof v.coreSessions === 'number' && typeof v.restDays === 'number'
        && Array.isArray(v.week) && v.week.length === 7;
    });
  }

  // dailyTargets: Tagesziele (Schritte/kcal/Wasser/Schlaf) mit Quelle.
  function isDailyTargets(r) {
    return !!(r && typeof r === 'object'
      && ['steps','activeKcal','waterMl','sleepMin'].every(function (k) { return r[k] === null || (typeof r[k] === 'number' && r[k] >= 0); })
      && typeof r.source === 'string' && typeof r.updatedAt === 'string');
  }

  // loadCap: maximale Tagesbelastung.
  function isLoadCap(r) {
    return !!(r && typeof r === 'object' && typeof r.mode === 'string'
      && (r.value === null || typeof r.value === 'number') && typeof r.unit === 'string');
  }

  O.engineContracts = {

    RULE_VERSION: RULE_VERSION,
    REASONS: REASONS,
    reason: reason,
    confidenceFrom: confidenceFrom,
    DAY_STATES: DAY_STATES,
    ACTIONS: ACTIONS,
    CONFIDENCE: CONFIDENCE,
    isReadinessResult: isReadinessResult,
    isDecisionResult: isDecisionResult,
    isPlanResult: isPlanResult,
    isPlanQuality: isPlanQuality,
    isForecast: isForecast,
    isPlanVariants: isPlanVariants,
    isDailyTargets: isDailyTargets,
    isLoadCap: isLoadCap
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.engineContracts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
