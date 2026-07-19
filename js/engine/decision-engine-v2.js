/* ============================================================
   ORVIA · decision-engine-v2 — Track C (C2): „Was sollte ich heute tun?"
   PARALLEL zur Alt-Engine, NICHT AKTIV (Aktivierungsgate C8).

   Input:  { readiness (Ergebnis der Readiness-Engine), safetyFlags, illness,
             constraints[] (kanonische constraintsList-Einträge), plannedSession,
             recentLoad { acute7, chronic28PerWeek, dataDays, hardYesterday,
             hardStreak }, goalContext { daysToEvent }, availabilityToday }
   Output: { dayState, action, recommendedSession, adjustment, reasons[],
             safeguards[], confidence, missingData[] }

   Regel-Hierarchie (Invarianten C7):
   1. Safety-Flags / Schmerz ≥ 8 → RED, Ruhe/aktive Erholung, IMMER.
   2. Krankheit → mind. ORANGE, keine harte Einheit.
   3. Akute Beschwerde (Intensität ≥ 5) + betroffene Belastung → Swap/Downgrade;
      kontextfrei blockiert sie NICHT alles (Knie ≠ Oberkörper).
   4. Sehr niedrige Readiness → Belastung nie erhöhen; hart → leicht.
   5. Belastungssprung / harte Tage in Folge → Intensität raus.
   6. Wettkampf ≤ 2 Tage → entlasten (Taper vor Extra-Reiz).
   7. Fehlende Daten → vorsichtigere Aktion + niedrigere confidence,
      NIE optimistischere.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function C() { return O.engineContracts; }

  var IMPACT_REGIONS = ['knee', 'ankle', 'foot', 'lower_leg', 'hip', 'thigh'];
  function sessionIsHard(s) { return !!s && (s.intensity === 'hard' || s.intensity === 'intervals' || s.intensity === 'race'); }
  function sessionIsImpact(s) { return !!s && ['running', 'football', 'handball', 'basketball', 'athletics', 'tennis', 'padel', 'volleyball', 'hyrox'].indexOf(s.sport) >= 0; }
  function sessionIsLegLoad(s) { return !!s && (sessionIsImpact(s) || ['cycling', 'gym_legs'].indexOf(s.sport) >= 0); }

  function evaluate(input) {
    input = input || {};
    var CT = C();
    var reasons = [], safeguards = [], missing = [];
    var readiness = input.readiness || { score: null, confidence: 'low', warnings: [], missingData: [] };
    var planned = input.plannedSession || null;
    var state = 'GREEN';
    var action = 'KEEP';

    function escalate(st) {
      var order = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
      if (order.indexOf(st) > order.indexOf(state)) state = st;
    }
    function limitAction(a) {
      // Aktionen nur verschärfen, nie lockern (deterministische Reihenfolge).
      var order = ['KEEP', 'REDUCE_INTENSITY', 'REDUCE_VOLUME', 'SWAP_MODALITY', 'MOVE_SESSION', 'REPLACE_WITH_RECOVERY', 'REST'];
      if (order.indexOf(a) > order.indexOf(action)) action = a;
    }

    /* 1 · Safety-Gate (Invariante: akute starke Beschwerden → keine harte Einheit). */
    var sf = input.safetyFlags || {};
    var redFlag = ['fever', 'chestPain', 'shortnessOfBreath', 'dizziness', 'neurologicalSymptoms', 'accidentPain', 'swelling', 'instability'].filter(function (k) { return sf[k] === true; });
    var maxPain = 0;
    (input.constraints || []).forEach(function (c) { if (c && (c.status === 'active' || c.status == null) && c.intensity != null) maxPain = Math.max(maxPain, c.intensity); });
    if (sf.pain != null) maxPain = Math.max(maxPain, sf.pain);
    if (redFlag.length) {
      escalate('RED'); limitAction('REST');
      reasons.push(CT.reason('red_flag_symptom', { flags: redFlag }));
      safeguards.push('Heute kein Training. Bei anhaltenden oder unklaren Symptomen ärztlich abklären.');
    }
    if (maxPain >= 8) {
      escalate('RED'); limitAction('REPLACE_WITH_RECOVERY');
      reasons.push(CT.reason('severe_pain', { intensity: maxPain }));
      safeguards.push('Starke Schmerzen sind ein Stoppsignal — keine Belastung der betroffenen Region.');
    }
    /* 2 · Krankheit. */
    if (input.illness === true && state !== 'RED') {
      escalate('ORANGE'); limitAction('REPLACE_WITH_RECOVERY');
      reasons.push(CT.reason('illness', {}));
      safeguards.push('Bei Fieber oder Symptomen unterhalb des Halses: vollständige Pause.');
    }
    /* 3 · Kontextsensitive Beschwerden (Invariante: Knie 4 + Oberkörper ≠ Stopp). */
    var activeC = (input.constraints || []).filter(function (c) { return c && (c.status === 'active' || c.status === 'observed'); });
    activeC.forEach(function (c) {
      if (c.intensity == null || c.intensity < 4 || c.intensity >= 8) return;   // <4: Hinweis unten · ≥8: bereits RED
      var affectsPlanned = planned && ((IMPACT_REGIONS.indexOf(c.bodyRegion) >= 0 && (sessionIsImpact(planned) || sessionIsLegLoad(planned))) || c.bodyRegion === 'back');
      if (affectsPlanned) {
        escalate('ORANGE');
        limitAction(sessionIsImpact(planned) ? 'SWAP_MODALITY' : 'REDUCE_INTENSITY');
        reasons.push(CT.reason('active_constraint', { bodyRegion: c.bodyRegion, intensity: c.intensity, planned: planned ? planned.sport : null }));
        safeguards.push('Belastung der betroffenen Region heute meiden oder deutlich reduzieren.');
      } else {
        escalate('YELLOW');
        reasons.push(CT.reason('active_constraint', { bodyRegion: c.bodyRegion, intensity: c.intensity, contextual: true }));
      }
    });
    /* 4 · Erholung (Invariante: sehr schlechte Regeneration → Belastung nie erhöhen). */
    if (readiness.score != null) {
      if (readiness.score < 40) {
        escalate('RED'); limitAction('REPLACE_WITH_RECOVERY');
        reasons.push(CT.reason('insufficient_recovery', { readiness: readiness.score }));
      } else if (readiness.score < 55) {
        escalate('ORANGE');
        if (sessionIsHard(planned)) limitAction('REDUCE_INTENSITY'); else limitAction('REDUCE_VOLUME');
        reasons.push(CT.reason('insufficient_recovery', { readiness: readiness.score }));
      } else if (readiness.score < 70) {
        escalate('YELLOW');
        if (sessionIsHard(planned)) { limitAction('REDUCE_INTENSITY'); reasons.push(CT.reason('insufficient_recovery', { readiness: readiness.score, mild: true })); }
      }
    } else {
      missing.push('readiness');
      // Ohne Check-in: vorsichtiger, nie optimistischer.
      if (sessionIsHard(planned)) { escalate('YELLOW'); limitAction('REDUCE_INTENSITY'); }
      reasons.push(CT.reason('missing_checkin', {}));
    }
    (readiness.warnings || []).forEach(function (w) {
      if (['poor_sleep', 'elevated_resting_hr', 'low_hrv'].indexOf(w.code) >= 0) reasons.push(w);
    });
    /* 5 · Last (Invarianten: Belastungssprung + harte Tage in Folge).
       Batch 2c/2d: Ratio-Gates NUR über die KOMBINIERTE ratioConfidence
       (Qualität BEIDER Quotienten-Fenster acute7 UND chronic28 — eine stark
       geschätzte chronische Basis disqualifiziert den Quotienten genauso wie
       eine geschätzte Akutwoche). Bei 'low' feuern load_spike/
       high_recent_load NICHT — stattdessen ehrlicher Datenqualitäts-Hinweis.
       KONSERVATIV (Batch 2d): ist die Belastungshistorie nicht zuverlässig
       beurteilbar, darf eine geplante HARTE Einheit nicht als GREEN/KEEP
       erscheinen (mind. YELLOW + Intensität raus); eine lockere Einheit
       bleibt bestehen — mit sichtbar gesenkter Confidence. Geschätzte Last
       kann Warnungen weiterhin nie UNTERDRÜCKEN, nur keine erzeugen.
       Fehlt das Feld (Alt-Input), bleibt das Bestandsverhalten unverändert. */
    var load = input.recentLoad || {};
    var _rc = load.ratioConfidence != null ? load.ratioConfidence : load.loadConfidence;
    if (_rc === 'low') {
      missing.push('load_quality');
      var _q = load.quality || {};
      // Batch 2e: fehlende Historienreife ist ein EIGENER, verständlicher Grund.
      var _code = _q.insufficientChronicHistory ? 'insufficient_chronic_history' : 'low_data_confidence';
      reasons.push(CT.reason(_code, {
        marker: 'load_quality',
        acuteConfidence: _q.acuteConfidence || null, priorConfidence: _q.priorConfidence || null, chronicConfidence: _q.chronicConfidence || null,
        historySpanDays: _q.historySpanDays != null ? _q.historySpanDays : null,
        estimatedShare: load.estimatedShare != null ? load.estimatedShare : null,
        unknownUnits: load.unknownUnits != null ? load.unknownUnits : null,
        ambiguousUnits: load.ambiguousUnits != null ? load.ambiguousUnits : null
      }));
      if (sessionIsHard(planned)) {
        escalate('YELLOW'); limitAction('REDUCE_INTENSITY');
        safeguards.push('Die Belastungshistorie ist aktuell nicht zuverlässig beurteilbar — heute keine volle Intensität auf unsicherer Basis.');
      }
    } else if (load.dataDays != null && load.dataDays >= 7 && load.acute7 != null && load.chronic28PerWeek != null && load.chronic28PerWeek > 0) {
      var ratio = load.acute7 / load.chronic28PerWeek;
      if (ratio > 1.5) {
        escalate('ORANGE'); if (sessionIsHard(planned)) limitAction('REDUCE_INTENSITY'); else limitAction('REDUCE_VOLUME');
        reasons.push(CT.reason('load_spike', { acute7: Math.round(load.acute7), chronicWeek: Math.round(load.chronic28PerWeek), ratio: Math.round(ratio * 100) / 100 }));
      } else if (ratio > 1.25) {
        escalate('YELLOW');
        reasons.push(CT.reason('high_recent_load', { ratio: Math.round(ratio * 100) / 100 }));
      }
    } else if (load.acute7 != null || load.chronic28PerWeek != null) {
      missing.push('load_history');
      reasons.push(CT.reason('low_data_confidence', { marker: 'load', days: load.dataDays || 0 }));
    }
    if (load.hardStreak != null && load.hardStreak >= 2 && sessionIsHard(planned)) {
      escalate('YELLOW'); limitAction('REDUCE_INTENSITY');
      reasons.push(CT.reason('consecutive_hard_days', { streak: load.hardStreak }));
    }
    /* 6 · Wettkampf-Nähe (Taper-Schutz). */
    var g = input.goalContext || {};
    if (g.daysToEvent != null && g.daysToEvent >= 0 && g.daysToEvent <= 2 && sessionIsHard(planned) && (state === 'GREEN' || state === 'YELLOW')) {
      limitAction('MOVE_SESSION');
      reasons.push(CT.reason('target_event_near', { daysToEvent: g.daysToEvent }));
      safeguards.push('Frische schlägt jetzt jeden zusätzlichen Trainingsreiz.');
    }
    /* Empfehlung ableiten (rein beschreibend; Texte via Codes erklärbar). */
    var rec = null;
    if (planned) {
      if (action === 'KEEP') rec = { label: planned.label || planned.sport, sport: planned.sport, intensity: planned.intensity || 'easy', minutes: planned.minutes != null ? planned.minutes : null };
      else if (action === 'REDUCE_INTENSITY') rec = { label: 'Lockere Variante', sport: planned.sport, intensity: 'easy', minutes: planned.minutes != null ? planned.minutes : null };
      else if (action === 'REDUCE_VOLUME') rec = { label: 'Verkürzte Einheit', sport: planned.sport, intensity: planned.intensity || 'easy', minutes: planned.minutes != null ? Math.max(15, Math.round(planned.minutes * 0.6)) : null };
      else if (action === 'SWAP_MODALITY') rec = { label: 'Alternative ohne betroffene Belastung', sport: sessionIsImpact(planned) ? 'cycling' : 'mobility', intensity: 'easy', minutes: planned.minutes != null ? Math.min(planned.minutes, 60) : null };
      else if (action === 'MOVE_SESSION') rec = { label: 'Einheit verschieben, heute locker', sport: planned.sport, intensity: 'easy', minutes: 30 };
      else if (action === 'REPLACE_WITH_RECOVERY') rec = { label: 'Aktive Erholung', sport: 'mobility', intensity: 'recovery', minutes: 20 };
      else rec = null;   // REST
    } else if (action === 'REST' || action === 'REPLACE_WITH_RECOVERY') {
      rec = action === 'REPLACE_WITH_RECOVERY' ? { label: 'Aktive Erholung', sport: 'mobility', intensity: 'recovery', minutes: 20 } : null;
    }
    (readiness.missingData || []).forEach(function (m) { if (missing.indexOf(m) < 0) missing.push(m); });
    var conf = C().confidenceFrom(missing, { coreCount: 6 });
    // Readiness-Confidence begrenzt die Decision-Confidence (nie sicherer als die Datenbasis).
    var order = { high: 0, medium: 1, low: 2 };
    if (readiness.confidence && order[readiness.confidence] > order[conf]) conf = readiness.confidence;
    return {
      dayState: state,
      action: action,
      recommendedSession: rec,
      adjustment: action === 'KEEP' ? null : { from: planned ? (planned.label || planned.sport) : null, to: rec ? rec.label : 'Ruhetag' },
      reasons: reasons,
      safeguards: safeguards,
      confidence: conf,
      missingData: missing
    };
  }

  O.decisionEngineV2 = { evaluate: evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.decisionEngineV2;
})(typeof globalThis !== 'undefined' ? globalThis : this);
