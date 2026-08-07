/* ============================================================
   ORVIA · goal-portfolio — Batch 3a: deterministisches, erklärbares
   Zielportfolio (GoalAllocation) als Grundlage für Capacity (3b) und
   Periodisierung/Feasibility (3c). KEIN Scheduler, KEIN Wochenplan,
   KEINE Prescription.

   NICHT AKTIV in der UI: kein index.html-/sw.js-Eintrag in diesem Batch.
   Integration ausschließlich über Tests (und später Shadow-Ausgabe).

   Reinheit (hart):
   - konsumiert AUSSCHLIESSLICH den EngineInputSnapshot (+ injizierte
     opts: evidence, conflictDetector) — kein DOM, kein localStorage,
     kein globales PROFILE, keine UI-Funktionen, kein Date.now().
   - nicht mutierend: der Snapshot wird nie verändert.
   - deterministisch/idempotent: gleiche Inputs + gleiche Engineversion
     ⇒ byte-stabiles fachliches Ergebnis; Zeit kommt nur aus dem
     injizierten Snapshot (now/today).

   Fachliche Leitplanken (Prompt §8 + Batch-3a-Auftrag):
   - Nutzerpriorität (goal.priority 1..4, deckungsgleich mit
     goalRepository ROLE_TO_DB) ist maßgeblich; Dringlichkeit ersetzt
     ein Hauptziel NIE still.
   - Zielwerte sind ASPIRATION, niemals aktuelle Capacity (capacity
     bleibt in 3a null und kommt erst aus Batch 3b).
   - Budgets sind ANTEILE des verfügbaren Trainingsbudgets (Ranges),
     keine erfundenen absoluten Stunden/Kilometer; Summe der
     Obergrenzen wird auf ≤ 1 normalisiert (keine Doppelverbuchung).
   - Mindestdosen sind strategische Untergrenzen der Mehrjahres-
     entwicklung (z. B. 1× Schwimmtechnik/Woche für 70.3/IM), keine
     Volumenvorgaben.
   - Missingness/Confidence werden ehrlich ausgewiesen; fehlende
     Priorität erzeugt KEINE erfundene Ordnung (focus null + low).
   - Gesundheitsziele können Safety nur VERSCHÄRFEN (tighten_only).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  /* Versionierung (Batch 3a.2, Blocker 2): 3a.1 hat Verhalten UND Ausgabe-
     vertrag geändert (budgetPolicy, portfolioweite minimumDoses, strikte
     Rollen-/Prioritäts-/Datums-/Confidence-/Konfliktregeln) — deshalb neue
     Versionen. Unter v1/gp-v1.0.0 wurde anderes Verhalten erzeugt; diese
     Versionen werden NIE wiederverwendet. */
  var PORTFOLIO_VERSION = 2;
  var RULE_VERSION = 'gp-v2.0.0';
  var DAY_MS = 86400000;

  /* ---------- Versionierte Heuristik-Begründungen (§7: jede Heuristik
     braucht eine versionierte Begründung) ---------- */
  var HEURISTICS = {
    H_ROLE_FROM_PRIORITY: { v: 1, text: 'Rolle folgt der Nutzerpriorität 1..4 → main/secondary/maintain/longterm (deckungsgleich mit user_goals.priority, Migration 0012). Nutzerpriorität ist maßgeblich (§8).' },
    H_FOCUS_USER_PRIORITY: { v: 1, text: 'Fokus = aktives Prioritäts-1-Ziel. Dringlichkeit (nahes Datum eines nachrangigen Ziels) verschiebt den Fokus nie still; sie erzeugt höchstens einen expliziten Konflikt mit Staffelungs-Strategie.' },
    H_FOCUS_TIEBREAK: { v: 1, text: 'Bei zwei gleichrangigen Prioritäts-1-Zielen (MAX_TOP_PRIORITY_GOALS=2) entscheidet deterministisch das frühere Zieldatum, dann die lexikografisch kleinere id — IMMER mit explizitem dual_top_priority-Konflikt, nie still.' },
    H_BUDGET_SHARES: { v: 1, text: 'Wochenbudgets als Anteils-RANGES des verfügbaren Trainingsbudgets: main 0.60–0.75, secondary 0.10–0.20, maintain 0.05–0.10, longterm 0.00–0.05. Absolute Stunden/Kilometer erst mit Capacity-Modell (3b) — vorher wären sie erfunden.' },
    H_BUDGET_NORMALIZE: { v: 1, text: 'Übersteigt die Summe der Obergrenzen 1.0, werden die Nicht-Fokus-Anteile proportional skaliert (deterministisch, 4 Nachkommastellen) — Trainingszeit wird nie doppelt verbucht.' },
    H_MIN_DOSE_TRIATHLON: { v: 1, text: 'Sekundäre/langfristige 70.3-/Ironman-Ziele erhalten Mindestdosen als Erhalt/Aufbau-Untergrenze (Schwimmtechnik ≥1×/Woche, Radbasis ≥1×/Woche, Kraft/Stabilität ≥1×/Woche), sofern die Sportart eingerichtet ist — kein verfrühtes Spitzenvolumen.' },
    H_MIN_DOSE_HEALTH: { v: 1, text: 'Stabilitäts-/Gesundheitsziele erhalten eine kleine, häufige Mindestdosis (2×/Woche kurze Stabilitätsarbeit) — Evidenzbasis Sehnen-/Kraftadaptation braucht Frequenz, nicht Volumen.' },
    H_COMPETING_RACES: { v: 1, text: 'Zwei Wettkampfziele mit Zieldatum < 42 Tage auseinander konkurrieren um denselben Formaufbau ⇒ expliziter Konflikt mit Strategie Staffelung (das nachrangige/spätere wird gestaffelt).' },
    H_TRANSITION_RECOVERY: { v: 1, text: 'Übergänge zwischen Wettkampfschwerpunkten deklarieren ein Erholungs-/Umbaufenster (qualitativ, 1–3 Wochen) vor dem nächsten Aufbau — Terminierung erst im Scheduler (Batch 4).' },
    H_CONFIDENCE_LADDER: { v: 1, text: 'Confidence startet high und sinkt deterministisch je Defizit (fehlende Uhr/Prioritätsordnung/Evidenz, stale/conflict-Inputs, ungültige Zieldaten). Fehlende Daten erzeugen nie höhere Präzision.' }
  };

  /* ---------- Reason-Codes (maschinenlesbar, deutsch erklärt) ---------- */
  var GP_REASONS = {
    user_priority_main: 'Vom Nutzer als höchste Priorität gesetzt — aktueller Entwicklungsfokus.',
    user_priority_secondary: 'Bewusstes Nebenentwicklungsbudget laut Nutzerpriorität.',
    user_priority_maintain: 'Erhaltungsziel laut Nutzerpriorität — Mindestdosis statt Aufbau.',
    user_priority_longterm: 'Strategische Richtung — erzeugt Abhängigkeiten und Mindestdosen, kein aktuelles Volumen.',
    race_proximity: 'Wettkampfdatum liegt nah — relevant für Staffelung, ändert die Nutzerpriorität nicht.',
    urgency_does_not_override_priority: 'Nahes Datum eines nachrangigen Ziels verschiebt den Fokus nicht still.',
    dual_top_priority_staggered: 'Zwei gleichrangige Top-Ziele — deterministisch gestaffelt, Konflikt explizit ausgewiesen.',
    longterm_dependency_floor: 'Mindestdosis sichert die Mehrjahresentwicklung (Technik/Basis verfallen ohne Frequenz).',
    no_capacity_basis: 'Keine belastbare Kapazitätsbasis — Budget bleibt relativ, keine absoluten Vorgaben.',
    target_is_aspiration_not_capacity: 'Zielwert ist Wunsch-/Zielgröße, NICHT aktuelle Leistungsfähigkeit.',
    target_date_past: 'Zieldatum liegt vor dem Stichtag — Ziel braucht eine Nutzerentscheidung (fail-closed).',
    target_date_invalid: 'Zieldatum ist nicht interpretierbar — Ziel braucht eine Nutzerentscheidung (fail-closed).',
    invalid_priority: 'Priorität ist ungültig (gültig: ganzzahlig 1–4) — keine Rolle und kein Budget ableitbar, Nutzerentscheidung nötig.',
    unknown_goal_type_conservative: 'Unbekannte Zielart — konservative Behandlung ohne erfundenes Budget.',
    user_paused: 'Vom Nutzer pausiert — kein Budget, bleibt sichtbar.',
    budget_normalized_no_double_booking: 'Anteil proportional reduziert, damit die Budget-Obergrenzen in Summe ≤ 100 % bleiben.',
    health_safety_tighten_only: 'Gesundheitsziel verschärft Sicherheits-/Belastungsgrenzen, hebt sie nie auf.',
    sport_setup_required: 'Benötigte Sportart ist noch nicht eingerichtet — Mindestdosis erst nach Setup erfüllbar.',
    evidence_longest_grouped_session: 'Referenz auf die längste zusammenhängend gruppierte Einheit (Batch-2-Gruppierung, genau einmal gezählt).',
    no_finality: 'Keine endgültigen Erfolgs- oder Machbarkeitsaussagen — Feasibility folgt als Szenarien in Batch 3c.'
  };

  /* ---------- Mehrjahres-Abhängigkeiten HM → 70.3 → IM (reiner Datenvertrag,
     KEINE Einheiten/Prescriptions) ---------- */
  var DEPENDENCY_MODEL = {
    version: 1,
    chain: ['half_marathon', 'half_ironman', 'ironman'],
    capabilities: {
      run_durability: { label: 'Laufrobustheit', sports: ['running'] },
      swim_technique: { label: 'Schwimmtechnik & Wasserkompetenz', sports: ['swimming'] },
      bike_base: { label: 'Radbasis', sports: ['cycling'] },
      strength_stability: { label: 'Kraft & Stabilität', sports: ['gym'] },
      fueling_gut_training: { label: 'Fueling / Gut-Training', sports: [] },
      brick_experience: { label: 'Brick-Erfahrung (Koppeltraining)', sports: ['cycling', 'running'] },
      race_experience: { label: 'Rennerfahrung', sports: [] }
    },
    requires: {
      half_marathon: ['run_durability', 'strength_stability'],
      half_ironman: ['run_durability', 'swim_technique', 'bike_base', 'strength_stability', 'fueling_gut_training', 'brick_experience', 'race_experience'],
      ironman: ['run_durability', 'swim_technique', 'bike_base', 'strength_stability', 'fueling_gut_training', 'brick_experience', 'race_experience']
    },
    /* Mindestdosen als strategische UNTERGRENZEN (Frequenz, kein Volumen). */
    minimumDoses: {
      swim_technique: { type: 'sessions_per_week', min: 1, purpose: 'technique_water_competence' },
      bike_base: { type: 'sessions_per_week', min: 1, purpose: 'aerobic_base' },
      strength_stability: { type: 'sessions_per_week', min: 1, purpose: 'durability_support' },
      fueling_gut_training: { type: 'practice_with_long_sessions', min: null, purpose: 'race_nutrition' },
      brick_experience: { type: 'periodic_in_build_phases', min: null, purpose: 'coupled_load_tolerance' },
      race_experience: { type: 'periodic_races', min: null, purpose: 'pacing_logistics' }
    },
    transitions: { recoveryThenBuildWeeksRange: [1, 3] }
  };

  var ROLE_BY_PRIORITY = { 1: 'main', 2: 'secondary', 3: 'maintain', 4: 'longterm' };
  var BUDGET_BY_ROLE = {
    main: { min: 0.60, max: 0.75 },
    secondary: { min: 0.10, max: 0.20 },
    maintain: { min: 0.05, max: 0.10 },
    longterm: { min: 0.00, max: 0.05 }
  };
  var TRIATHLON_CATEGORIES = ['half_ironman', 'ironman', 'triathlon', 'sprint_triathlon', 'olympic_triathlon'];
  var ENDURANCE_RACE_CATEGORIES = TRIATHLON_CATEGORIES.concat(['half_marathon', 'marathon', 'run_5k', 'run_10k', 'cycling_race', 'rowing2k']);
  var RACE_KINDS = ['time', 'finish'];

  function _round4(x) { return Math.round(x * 10000) / 10000; }
  /* Batch 3a.1 · STRIKTE Kalenderdaten: exakt YYYY-MM-DD, und der
     Parse-/ISO-Roundtrip muss denselben Tag ergeben — damit sind
     2027-02-29, 2027-02-30, 2026-04-31, Monat 13 und angehängter Text
     ungültig (vorher akzeptierte slice(0,10) angehängten Text und
     Engine-Overflow-Daten). */
  function _isDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function _parseDay(s) {
    if (!_isDateStr(s)) return null;
    var t = Date.parse(s + 'T00:00:00Z');
    if (!isFinite(t)) return null;
    return (new Date(t)).toISOString().slice(0, 10) === s ? t : null;
  }
  function _daysBetween(fromDay, toDay) {
    var a = _parseDay(fromDay), b = _parseDay(toDay);
    if (a == null || b == null) return null;
    return Math.round((b - a) / DAY_MS);
  }
  /* Batch 3a.1 · Regelobjekte tief einfrieren: Mutation exportierter Regeln
     darf zukünftige Ergebnisse nie verändern (Purity-Härtung Punkt 7). */
  function _deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { _deepFreeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }
  function _deepCopy(o) { return o == null ? null : JSON.parse(JSON.stringify(o)); }

  /* Zielart fachlich unterscheiden (Finish/Zeit/Leistung/Gewicht/Technik/
     Gesundheit/Allgemein) — auf Basis von group (profile-model categoryOf,
     eine Quelle) + metricType. Unbekanntes bleibt 'unknown' (kontrolliert). */
  function goalKindOf(goal) {
    if (!goal) return 'unknown';
    var group = goal.group || null, cat = goal.category || null;
    if (cat === 'technique') return 'technique';
    if (cat === 'vo2max' || cat === 'ftp') return 'performance';
    /* Wettkampf-Ausdauerkategorien auch dann korrekt einordnen, wenn die
       group-Zuordnung sie (noch) nicht kennt — z. B. 'half_ironman' ist in
       profile-model TIME_GOAL_CATEGORIES enthalten, aber nicht in
       GOAL_CATEGORIES.endurance (dokumentierte Lücke, Ist-Abgleich 3a). */
    if (ENDURANCE_RACE_CATEGORIES.indexOf(cat) >= 0) return (goal.metricType === 'time' && goal.targetValue != null) ? 'time' : 'finish';
    if (group === 'endurance') return (goal.metricType === 'time' && goal.targetValue != null) ? 'time' : 'finish';
    if (group === 'strength' || group === 'sport_performance') return 'performance';
    if (group === 'body_composition') return 'weight';
    if (group === 'health') return 'health';
    if (group === 'team_sport' || group === 'general') return 'general';
    return 'unknown';
  }

  /* Batch 3a.1 · STRIKTE Prioritätsvalidierung: NUR ganzzahlig 1..4 ist
     gültig. Fehlend, String, NaN, 0, negativ oder >4 ⇒ null (Aufrufer:
     needs_review). Vorher wurde 5 still auf longterm abgebildet. */
  function roleOf(goal) {
    var p = goal && goal.priority;
    if (typeof p !== 'number' || !isFinite(p) || p % 1 !== 0 || p < 1 || p > 4) return null;
    return ROLE_BY_PRIORITY[p];
  }

  /* ---------- Evidenz-Adapter (pure): kanonische Aktivitäten + INJIZIERTE
     Batch-2-Gruppierung → längste gruppierte Einheit je Sport. Split-
     Aufzeichnungen zählen als EINE Session (genau einmal als Evidenz). ---------- */
  function evidenceFromActivities(activities, opts) {
    opts = opts || {};
    var group = opts.groupSessions;
    if (typeof group !== 'function' || !Array.isArray(activities)) return null;
    var sport = opts.sportId || 'running';   // kanonische Sport-ID (training-domain)
    var res = group(activities, opts.groupOptions || {}) || {};
    var groups = Array.isArray(res) ? res : (Array.isArray(res.groups) ? res.groups : []);
    var best = null;
    groups.forEach(function (g) {
      if (!g || g.sportId !== sport) return;
      var km = (typeof g.totalDistanceKm === 'number') ? g.totalDistanceKm : (typeof g.distKm === 'number' ? g.distKm : null);
      if (km == null) return;
      if (!best || km > best.distKm) best = { sportId: g.sportId, groupId: g.groupId, distKm: km, segments: g.segments || 1, activityRefs: (g.activityRefs || []).slice() };
    });
    return best ? { longestGroupedSession: best } : null;
  }

  /* ---------- Hauptfactory ---------- */
  function buildPortfolio(snapshot, opts) {
    snapshot = snapshot || {};
    opts = opts || {};
    var missing = [];
    function miss(path, kind) { missing.push({ path: path, kind: kind }); }
    var assumptions = [
      { code: 'target_is_aspiration_not_capacity', note: GP_REASONS.target_is_aspiration_not_capacity },
      { code: 'no_capacity_basis', note: 'Capacity-Modell folgt in Batch 3b; bis dahin sind alle Budgets relative Anteile.' },
      { code: 'no_finality', note: GP_REASONS.no_finality }
    ];
    var confidencePenalty = 0;

    // Injizierte Uhr: NUR snapshot.now/today. Keine eigene Zeitquelle.
    var asOf = (snapshot.now != null && isFinite(snapshot.now)) ? new Date(snapshot.now).toISOString() : null;
    var today = _parseDay(snapshot.today) != null ? snapshot.today : null;   // strikt (3a.1 Punkt 4)
    if (asOf == null) { miss('clock.now', 'not_captured'); confidencePenalty += 1; }
    if (today == null) { miss('clock.today', 'not_captured'); confidencePenalty += 1; }

    /* Batch 3a.1 Punkt 7: opts.evidence beim EINGANG tief kopieren — das
       zurückgegebene evidence teilt keine Referenz mit dem Input; Mutation
       der Ausgabe kann den Input nie verändern (und umgekehrt). */
    var evidence = null;
    if (opts.evidence != null) {
      try { evidence = _deepCopy(opts.evidence); } catch (e) { evidence = null; miss('evidence', 'error'); }
    }

    /* Batch 3a.1 Punkt 3: Zielkategorien FAIL-CLOSED über die KANONISCHE
       Katalogquelle (injizierbar; Default: profileModel.isKnownGoalCategory —
       eine Wahrheit, kein zweiter Katalog). group allein ist KEIN
       Bekanntheitsnachweis, weil der Normalizer Unbekanntes auf group
       'general' setzt. Ohne Katalogquelle: fail-closed auf die wenigen
       Kategorien mit eigener Fachbehandlung in diesem Modul. */
    var catalogFn = (typeof opts.isKnownCategory === 'function') ? opts.isKnownCategory
      : ((O.profileModel && typeof O.profileModel.isKnownGoalCategory === 'function') ? O.profileModel.isKnownGoalCategory : null);
    if (!catalogFn) miss('goalCategoryCatalog', 'module_missing');
    function isKnownCat(cat) {
      if (cat == null) return false;
      if (catalogFn) return !!catalogFn(cat);
      return ENDURANCE_RACE_CATEGORIES.indexOf(cat) >= 0;
    }

    // Eingangsqualität aus dem Snapshot übernehmen (stale/conflict senken Confidence).
    var snapMissing = (snapshot.dataQuality && Array.isArray(snapshot.dataQuality.missing)) ? snapshot.dataQuality.missing : [];
    var degraded = snapMissing.filter(function (m) { return m && (m.kind === 'stale' || m.kind === 'conflict'); });
    if (degraded.length) {
      confidencePenalty += 1;
      assumptions.push({ code: 'input_quality_reduced', note: 'Snapshot meldet stale/conflict-Inputs (' + degraded.map(function (m) { return m.path; }).sort().join(', ') + ').' });
    }

    // Aktive Sportarten (für Mindestdosen-Erfüllbarkeit).
    var activeSports = {};
    (Array.isArray(snapshot.sports) ? snapshot.sports : []).forEach(function (s) {
      if (!s) return;
      var id = s.sportId || s.sport || null;
      var active = (s.activeInApp != null) ? !!s.activeInApp : (s.active != null ? !!s.active : true);
      if (id && active) activeSports[id] = true;
    });
    if (!Array.isArray(snapshot.sports)) miss('sports', 'not_captured');

    // Ziele: nur active/paused betrachten; deterministisch sortieren.
    var rawGoals = Array.isArray(snapshot.goals) ? snapshot.goals : null;
    if (!rawGoals || !rawGoals.length) {
      miss('goals', 'not_captured');
      return _finish({
        focusGoalId: null, allocations: [], conflicts: [], dependencies: [],
        minimumDoses: [], transitionPlan: [], horizons: null, evidence: evidence
      }, missing, assumptions.concat([{ code: 'no_goals_no_allocation', note: 'Ohne Ziele wird nichts allokiert und nichts erfunden.' }]), 99, asOf);
    }
    var goals = rawGoals
      .filter(function (g) { return g && (g.status === 'active' || g.status === 'paused'); })
      .slice()
      .sort(function (a, b) {
        var pa = (typeof a.priority === 'number') ? a.priority : 99;
        var pb = (typeof b.priority === 'number') ? b.priority : 99;
        if (pa !== pb) return pa - pb;
        var da = a.targetDate || '9999-12-31', db = b.targetDate || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return String(a.id) < String(b.id) ? -1 : 1;
      });
    var activeGoals = goals.filter(function (g) { return g.status === 'active'; });
    if (!activeGoals.length) miss('goals.active', 'not_captured');

    // Zieldaten prüfen (fail-closed): vergangen/ungültig ⇒ needs_review.
    var dateIssue = {};
    activeGoals.forEach(function (g) {
      if (g.targetDate == null) return;
      if (!_isDateStr(g.targetDate) || _parseDay(g.targetDate) == null) {
        dateIssue[g.id] = 'target_date_invalid';
        miss('goals.' + g.id + '.targetDate', 'error');
      } else if (today != null) {
        var d = _daysBetween(today, g.targetDate);
        if (d != null && d < 0) { dateIssue[g.id] = 'target_date_past'; miss('goals.' + g.id + '.targetDate', 'error'); }
      }
    });

    // Fokus: Nutzerpriorität maßgeblich (H_FOCUS_USER_PRIORITY / H_FOCUS_TIEBREAK).
    // Fokusfähig ist nur ein gültiges Prio-1-Ziel (strikte Priorität, gültiges
    // Datum, bekannte Kategorie) — aus ungültigen Angaben wird KEIN Fokus abgeleitet.
    var conflicts = [];
    var top = activeGoals.filter(function (g) { return roleOf(g) === 'main' && !dateIssue[g.id] && isKnownCat(g.category); });
    var focusGoalId = null;
    if (top.length >= 1) {
      focusGoalId = top[0].id;   // Sortierung: frühestes Datum, dann id (deterministisch)
      if (top.length > 1) {
        conflicts.push({
          conflictType: 'dual_top_priority', goalIds: top.map(function (g) { return g.id; }),
          severity: 'medium', strategy: 'staggering',
          explanation: 'Zwei gleichrangige Top-Ziele — deterministische Staffelung (früheres Zieldatum zuerst), explizit statt still.'
        });
      }
    } else {
      miss('goals.priority', 'not_captured');
      confidencePenalty += 2;
      assumptions.push({ code: 'no_user_priority_no_focus_invented', note: 'Kein Prioritäts-1-Ziel — es wird KEINE Fokusordnung erfunden; Nutzerentscheidung erforderlich.' });
    }

    // Dringlichkeit ersetzt Priorität nicht: nachrangiges Ziel mit näherem Datum ⇒ expliziter Konflikt.
    if (focusGoalId && today != null) {
      var focusGoal = activeGoals.filter(function (g) { return g.id === focusGoalId; })[0];
      var dFocus = focusGoal && focusGoal.targetDate ? _daysBetween(today, focusGoal.targetDate) : null;
      activeGoals.forEach(function (g) {
        if (g.id === focusGoalId || dateIssue[g.id] || !g.targetDate) return;
        var d = _daysBetween(today, g.targetDate);
        if (d != null && d >= 0 && (dFocus == null || d < dFocus)) {
          conflicts.push({
            conflictType: 'urgency_vs_priority', goalIds: [focusGoalId, g.id],
            severity: 'low', strategy: 'staggering',
            explanation: 'Nachrangiges Ziel hat das nähere Datum — Fokus bleibt beim Prioritätsziel (urgency_does_not_override_priority).'
          });
        }
      });
    }

    /* Konkurrierende Wettkämpfe (< 42 Tage Abstand) — H_COMPETING_RACES.
       Batch 3a.1 Punkt 6: hängt NUR von den beiden gültigen Zielkalenderdaten
       ab — wird auch OHNE Fokusziel und OHNE injizierte Uhr erkannt (vorher
       fälschlich im Fokus-/Uhr-Block versteckt). Nur Fokus-/Dringlichkeits-
       konflikte verlangen weiterhin eine Uhr. */
    var raceGoals = activeGoals.filter(function (g) {
      return !dateIssue[g.id] && _parseDay(g.targetDate) != null && isKnownCat(g.category) && RACE_KINDS.indexOf(goalKindOf(g)) >= 0;
    }).sort(function (a, b) { return a.targetDate < b.targetDate ? -1 : (a.targetDate > b.targetDate ? 1 : (String(a.id) < String(b.id) ? -1 : 1)); });
    for (var i = 0; i < raceGoals.length; i++) {
      for (var j = i + 1; j < raceGoals.length; j++) {
        var gap = _daysBetween(raceGoals[i].targetDate, raceGoals[j].targetDate);
        if (gap != null && Math.abs(gap) < 42) {
          conflicts.push({
            conflictType: 'competing_races', goalIds: [raceGoals[i].id, raceGoals[j].id],   // [früher, später]
            severity: 'medium', strategy: 'staggering',
            explanation: 'Zwei Wettkampfziele innerhalb von 42 Tagen konkurrieren um denselben Formaufbau — Staffelung erforderlich.'
          });
        }
      }
    }

    // Physiologische Zielkonflikte: EINE Quelle (profile-model.detectGoalConflicts), injiziert.
    if (typeof opts.conflictDetector === 'function') {
      var phys = opts.conflictDetector(activeGoals) || [];
      phys.forEach(function (c) {
        conflicts.push({ conflictType: c.conflictType, goalIds: (c.goalIds || []).slice(), severity: c.severity || 'medium', strategy: 'focus_or_stagger', explanation: c.explanation || '' });
      });
    }

    if (!evidence) miss('evidence.activities', 'not_supported');

    /* ---------- Allokationen ---------- */
    var staggeredIds = {};
    conflicts.forEach(function (c) {
      if (c.conflictType === 'dual_top_priority' || c.conflictType === 'competing_races') {
        c.goalIds.slice(1).forEach(function (id) { if (id !== focusGoalId) staggeredIds[id] = true; });
      }
    });
    var evidenceUsed = false;
    var allocations = goals.map(function (g) {
      /* Batch 3a.1 Punkt 1: role ist IMMER die unveränderte Ableitung aus der
         Nutzerpriorität 1..4 (roleOf) — sie wird nie durch den Fokus umgeschrieben.
         focusGoalId bestimmt nur den aktuellen Fokus; ein zweites Prio-1-Ziel
         bleibt role:'main' und wird über mode:'staggered' + budgetPolicy
         erklärt, nicht über eine gefälschte Rolle. */
      var role = roleOf(g);
      var isFocus = g.id === focusGoalId;
      var known = isKnownCat(g.category);
      var kind = known ? goalKindOf(g) : 'unknown';
      var rationale = [];
      var allocConfidence = 'high';
      var mode, budget = null, budgetPolicy = null;
      var deps = [];
      var minimumDose = null;

      if (g.status === 'paused') {
        mode = 'paused'; budget = { min: 0, max: 0 }; budgetPolicy = 'paused'; rationale.push('user_paused');
      } else if (role == null) {
        /* Punkt 2: ungültige Priorität (fehlend/String/NaN/0/negativ/>4) ⇒
           fail-closed, keine stille Abbildung (z. B. 5→longterm entfernt). */
        mode = 'needs_review'; rationale.push('invalid_priority'); allocConfidence = 'low';
        miss('goals.' + g.id + '.priority', 'error');
      } else if (dateIssue[g.id]) {
        mode = 'needs_review'; rationale.push(dateIssue[g.id]); allocConfidence = 'low';
      } else if (!known || kind === 'unknown') {
        /* Punkt 3: unbekannte Kategorie bleibt unknown/needs_review — auch wenn
           der vorgeschaltete Normalizer group:'general' gesetzt hat. */
        mode = 'needs_review'; rationale.push('unknown_goal_type_conservative'); allocConfidence = 'low';
        miss('goals.' + g.id + '.category', 'error');
      } else {
        mode = isFocus ? 'focus' : ((role === 'main' || staggeredIds[g.id]) ? 'staggered' : { secondary: 'develop', maintain: 'maintain', longterm: 'foundation' }[role]);
        if (role === 'main' && !isFocus) {
          // Zweites Hauptziel: vorübergehend reduziertes Budget — über
          // budgetPolicy/mode erklärt, Rolle bleibt unverfälscht 'main'.
          budget = Object.assign({}, BUDGET_BY_ROLE.secondary);
          budgetPolicy = 'reduced_while_staggered';
          rationale.push('user_priority_main', 'dual_top_priority_staggered');
        } else {
          budget = Object.assign({}, BUDGET_BY_ROLE[role]);
          budgetPolicy = 'role_default';
          rationale.push({ main: 'user_priority_main', secondary: 'user_priority_secondary', maintain: 'user_priority_maintain', longterm: 'user_priority_longterm' }[role]);
          if (staggeredIds[g.id]) rationale.push('dual_top_priority_staggered');
        }
      }

      // Mehrjahres-Abhängigkeiten + Mindestdosen (Triathlon-Kette).
      var cat = g.category || null;
      if (cat && (DEPENDENCY_MODEL.requires[cat] || TRIATHLON_CATEGORIES.indexOf(cat) >= 0) && mode !== 'paused' && mode !== 'needs_review') {
        var reqs = DEPENDENCY_MODEL.requires[cat] || DEPENDENCY_MODEL.requires.half_ironman;
        deps = reqs.map(function (capId) {
          var cap = DEPENDENCY_MODEL.capabilities[capId];
          var needsSports = cap.sports || [];
          var ready = needsSports.every(function (sp) { return !!activeSports[sp]; });
          return { capability: capId, label: cap.label, sports: needsSports.slice(), status: ready ? 'required' : 'setup_required' };
        });
        if (role === 'secondary' || role === 'longterm') {
          minimumDose = [];
          reqs.forEach(function (capId) {
            var d = DEPENDENCY_MODEL.minimumDoses[capId];
            if (!d || d.min == null) return;
            var cap = DEPENDENCY_MODEL.capabilities[capId];
            var ready = (cap.sports || []).every(function (sp) { return !!activeSports[sp]; });
            var entry = { capability: capId, type: d.type, min: d.min, purpose: d.purpose, status: ready ? 'active_floor' : 'setup_required' };
            if (!ready) rationale.push('sport_setup_required');
            minimumDose.push(entry);
          });
          if (minimumDose.length) rationale.push('longterm_dependency_floor');
          else minimumDose = null;
        }
      }
      // Gesundheitsziele: Safety NUR verschärfen; kleine Frequenz-Mindestdosis.
      if (kind === 'health' && mode !== 'paused' && mode !== 'needs_review') {
        rationale.push('health_safety_tighten_only');
        deps.push({ capability: 'safety_gate', label: 'Sicherheits-Gate', direction: 'tighten', status: 'required' });
        minimumDose = (minimumDose || []).concat([{ capability: 'stability_work', type: 'sessions_per_week', min: 2, purpose: 'frequency_over_volume', status: 'active_floor' }]);
      }

      // Zielwert = Aspiration, NIE Capacity.
      var target = null;
      if (g.targetValue != null || g.targetDate != null) {
        target = { metricType: g.metricType || null, value: g.targetValue != null ? g.targetValue : null, unit: g.unit || null, date: g.targetDate || null, interpretation: 'aspiration' };
        if (g.targetValue != null) rationale.push('target_is_aspiration_not_capacity');
      }
      // Evidenzreferenz: genau EINMAL, am Fokus-Laufziel.
      var evidenceRefs = null;
      if (evidence && evidence.longestGroupedSession && isFocus && !evidenceUsed && (kind === 'time' || kind === 'finish')) {
        evidenceRefs = [{ ref: evidence.longestGroupedSession.groupId, kind: 'longest_grouped_session' }];
        rationale.push('evidence_longest_grouped_session');
        evidenceUsed = true;
      }
      if (today != null && g.targetDate && !dateIssue[g.id]) {
        var dd = _daysBetween(today, g.targetDate);
        if (dd != null && dd >= 0 && dd <= 84 && !isFocus) rationale.push('race_proximity');
        if (dd != null && dd >= 0 && dd <= 84 && !isFocus && focusGoalId) rationale.push('urgency_does_not_override_priority');
      }
      return {
        goalId: g.id, kind: kind, role: role, mode: mode,
        weeklyBudgetRange: budget ? { min: budget.min, max: budget.max, unit: 'share_of_available_training_budget', basis: 'role_heuristic_pending_capacity_model' } : null,
        budgetPolicy: budget ? budgetPolicy : null,   // erklärt Abweichungen (z. B. reduced_while_staggered) statt Rollen zu fälschen
        minimumDose: minimumDose,
        target: target,
        evidenceRefs: evidenceRefs,
        daysToTarget: (today != null && g.targetDate && !dateIssue[g.id]) ? _daysBetween(today, g.targetDate) : null,
        rationaleCodes: rationale,
        dependencies: deps,
        confidence: allocConfidence
      };
    });

    /* Budget-Normalisierung: Summe der Obergrenzen ≤ 1 (H_BUDGET_NORMALIZE).
       Geschützt wird nur die FOKUS-Allokation; alle anderen (auch ein
       gestaffeltes zweites Hauptziel) skalieren proportional. */
    var budgeted = allocations.filter(function (a) { return a.weeklyBudgetRange && a.weeklyBudgetRange.max > 0; });
    var sumMax = budgeted.reduce(function (s, a) { return s + a.weeklyBudgetRange.max; }, 0);
    if (sumMax > 1) {
      var focusSet = budgeted.filter(function (a) { return a.mode === 'focus'; });
      var focusMax = focusSet.reduce(function (s, a) { return s + a.weeklyBudgetRange.max; }, 0);
      var others = budgeted.filter(function (a) { return a.mode !== 'focus'; });
      var othersMax = others.reduce(function (s, a) { return s + a.weeklyBudgetRange.max; }, 0);
      var scaleSet = (focusMax < 1 && othersMax > 0) ? others : budgeted;
      var room = (scaleSet === others) ? (1 - focusMax) : 1;
      var setMax = scaleSet.reduce(function (s, a) { return s + a.weeklyBudgetRange.max; }, 0);
      var f = setMax > 0 ? room / setMax : 0;
      scaleSet.forEach(function (a) {
        a.weeklyBudgetRange.min = _round4(a.weeklyBudgetRange.min * f);
        a.weeklyBudgetRange.max = _round4(a.weeklyBudgetRange.max * f);
        a.rationaleCodes.push('budget_normalized_no_double_booking');
      });
    }

    /* Transitionen + Horizonte (deklarativ; Terminierung erst Batch 4).
       Gleiche Basis wie die Konflikterkennung: raceGoals (gültige Daten,
       bekannte Kategorie, deterministisch sortiert). */
    var transitionPlan = [];
    var datedRaces = raceGoals;
    for (var t = 0; t + 1 < datedRaces.length; t++) {
      transitionPlan.push({
        fromGoalId: datedRaces[t].id, toGoalId: datedRaces[t + 1].id,
        trigger: 'goal_completed_or_target_date_passed',
        recoveryThenBuildWeeksRange: DEPENDENCY_MODEL.transitions.recoveryThenBuildWeeksRange.slice(),
        plannedRole: 'main', scheduling: 'deferred_to_batch_4'
      });
    }
    var horizons = (today != null) ? {
      next7Days: { drivenByGoalId: focusGoalId, prescriptionLevel: 'deferred_to_batch_4', constraintsCarried: true },
      weeks4to8: { emphasisGoalIds: allocations.filter(function (a) { return a.mode === 'focus' || a.mode === 'develop'; }).map(function (a) { return a.goalId; }), prescriptionLevel: 'deferred_to_batch_3c' },
      multiYear: { roadmap: datedRaces.map(function (g) { return { goalId: g.id, targetDate: g.targetDate, role: g.id === focusGoalId ? 'main' : (roleOf(g) || 'secondary') }; }), prescriptionLevel: 'declarative_only' }
    } : null;
    if (horizons == null && today == null) assumptions.push({ code: 'no_clock_no_horizons', note: 'Ohne injizierte Uhr werden keine Horizonte berechnet.' });

    // Mehrjahres-Abhängigkeiten auf Portfolioebene (dedupliziert, deterministisch).
    var depMap = {};
    allocations.forEach(function (a) {
      (a.dependencies || []).forEach(function (d) {
        if (d.capability === 'safety_gate') return;
        var k = d.capability;
        if (!depMap[k]) depMap[k] = { capability: k, label: d.label, sports: d.sports || [], status: d.status, neededForGoalIds: [] };
        if (depMap[k].status === 'required' && d.status === 'setup_required') depMap[k].status = 'setup_required';
        depMap[k].neededForGoalIds.push(a.goalId);
      });
    });
    var dependencies = Object.keys(depMap).sort().map(function (k) { return depMap[k]; });
    dependencies.forEach(function (d) {
      if (d.status === 'setup_required') miss('sports.' + (d.sports[0] || d.capability), 'not_captured');
    });

    /* Batch 3a.1 Punkt 8: Mindestdosen ZIELÜBERGREIFEND aggregieren — 70.3 und
       Ironman erzeugen dieselbe Schwimm-/Rad-/Kraftdosis nur EINMAL. Gemeinsame
       Dosis = notwendiger MAXIMALWERT (nicht Summe); shareableAcrossGoals:true
       ist der Scheduler-Vertrag: EINE passende Einheit bedient mehrere Ziele. */
    var doseMap = {};
    allocations.forEach(function (a) {
      (a.minimumDose || []).forEach(function (d) {
        var k = d.capability;
        if (!doseMap[k]) {
          doseMap[k] = { capability: k, type: d.type, min: d.min, purpose: d.purpose, status: d.status, neededForGoalIds: [], shareableAcrossGoals: true };
        } else {
          if (d.min != null && (doseMap[k].min == null || d.min > doseMap[k].min)) doseMap[k].min = d.min;
          if (d.status === 'setup_required') doseMap[k].status = 'setup_required';
        }
        if (doseMap[k].neededForGoalIds.indexOf(a.goalId) < 0) doseMap[k].neededForGoalIds.push(a.goalId);
      });
    });
    var minimumDoses = Object.keys(doseMap).sort().map(function (k) { doseMap[k].neededForGoalIds.sort(); return doseMap[k]; });

    if (!evidenceUsed && evidence) assumptions.push({ code: 'evidence_available_unreferenced', note: 'Evidenz vorhanden, aber kein passendes Fokus-Ausdauerziel zum Referenzieren.' });

    /* Batch 3a.1 Punkt 5: Confidence deterministisch an ZIELRELEVANTE
       Missingness gekoppelt (fehlende Prioritätsordnung: oben +2; stale/
       conflict-Inputs: oben +1; needs_review-Allokationen: +1; fehlende, für
       aktive Ziele benötigte Sportarten: 1–2 Capabilities +1, ≥3 +2).
       Irrelevante fehlende Readiness-Felder (kind not_captured im Snapshot)
       zählen bewusst NICHT. Mehr Missingness kann Confidence nie erhöhen
       (rein additiv). */
    if (allocations.some(function (a) { return a.confidence === 'low'; })) confidencePenalty += 1;
    var setupCaps = dependencies.filter(function (d) { return d.status === 'setup_required'; }).length;
    if (setupCaps >= 3) confidencePenalty += 2;
    else if (setupCaps >= 1) confidencePenalty += 1;

    return _finish({
      focusGoalId: focusGoalId, allocations: allocations, conflicts: conflicts,
      dependencies: dependencies, minimumDoses: minimumDoses,
      transitionPlan: transitionPlan, horizons: horizons,
      evidence: evidence
    }, missing, assumptions, confidencePenalty, asOf);
  }

  function _finish(core, missing, assumptions, penalty, asOf) {
    var confidence = penalty <= 0 ? 'high' : (penalty === 1 ? 'medium' : 'low');
    /* missingData deduplizieren (Pfad+Art), Reihenfolge des Erstauftretens. */
    var seen = {};
    var missDedup = (missing || []).filter(function (m) {
      var k = (m && m.path) + '|' + (m && m.kind);
      if (seen[k]) return false; seen[k] = true; return true;
    });
    return {
      version: PORTFOLIO_VERSION,
      ruleVersion: RULE_VERSION,
      asOf: asOf,
      focusGoalId: core.focusGoalId,
      allocations: core.allocations,
      conflicts: core.conflicts,
      dependencies: core.dependencies,
      minimumDoses: core.minimumDoses || [],       // aggregiert, shareable (3a.1 Punkt 8)
      transitionPlan: core.transitionPlan,
      horizons: core.horizons,
      evidence: core.evidence,
      capacity: null,                              // Batch 3b — hier bewusst null
      safetyPolicy: 'tighten_only',
      missingData: missDedup,
      assumptions: assumptions,
      confidence: confidence
    };
  }

  /* Batch 3a.1 Punkt 7: berechnungsrelevante Regelobjekte + Export tief
     einfrieren — Mutation exportierter Regeln kann Ergebnisse nie verändern. */
  _deepFreeze(HEURISTICS); _deepFreeze(GP_REASONS); _deepFreeze(DEPENDENCY_MODEL);
  _deepFreeze(ROLE_BY_PRIORITY); _deepFreeze(BUDGET_BY_ROLE);
  _deepFreeze(TRIATHLON_CATEGORIES); _deepFreeze(ENDURANCE_RACE_CATEGORIES); _deepFreeze(RACE_KINDS);

  O.goalPortfolio = _deepFreeze({
    PORTFOLIO_VERSION: PORTFOLIO_VERSION,
    RULE_VERSION: RULE_VERSION,
    HEURISTICS: HEURISTICS,
    GP_REASONS: GP_REASONS,
    DEPENDENCY_MODEL: DEPENDENCY_MODEL,
    BUDGET_BY_ROLE: BUDGET_BY_ROLE,
    goalKindOf: goalKindOf,
    roleOf: roleOf,
    evidenceFromActivities: evidenceFromActivities,
    buildPortfolio: buildPortfolio
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.goalPortfolio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
