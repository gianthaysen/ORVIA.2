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
    isPlanResult: isPlanResult
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.engineContracts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
