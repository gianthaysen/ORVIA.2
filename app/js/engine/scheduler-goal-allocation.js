/* ============================================================
   ORVIA · Engine 3c — Scheduler S2: Goal-Allocation-Adapter (reine Funktion).
   Vertrag: app/docs/SCHEDULER-S0-CONTRACT.md (S0b) §5 (goalAllocation aus
   goal-portfolio) + §12 S2 ("Reuse, kein Zweit-SSOT").

   S2-SKOPE: bereitet die bereits normalisierten Ziele aus dem SchedulerInput
   auf und macht nachvollziehbar, WIE Planungskapazität grundsätzlich zwischen
   mehreren Zielen priorisiert werden kann. S2 wählt/erzeugt/terminiert/verändert
   KEINE Trainingseinheiten und verteilt nichts auf Wochentage.

   Kern-Prinzip (S0b §12): Die fachliche Allokation stammt AUSSCHLIESSLICH aus
   ORVIA.goalPortfolio.buildPortfolio (Batch 3a). Dieser Adapter erfindet KEINE
   eigenen Budget-/Prioritäts-/Konfliktregeln — er übersetzt buildPortfolio in
   die Scheduler-Allokationsform, transportiert Priorität/Provenienz aus dem
   SchedulerInput und ergänzt harte/weiche Grenzen sowie Missingness/Confidence.

   Reinheit (hart): kein DOM, kein localStorage, kein PROFILE/DB/ActivityStore/
   Repository, kein Date.now()/new Date()/Math.random(), keine Schreiboperation.
   Fehlt goal-portfolio ⇒ fail-closed (kein stiller Zweit-SSOT, CLAUDE.md §8.3).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  var CONTRACT_VERSION = 'sched-goalalloc-v1.0.0';
  var ACTIVATION_MODE = 'shadow_only';
  var SUPPORTED_INPUT_VERSIONS = ['sched-input-v1.0.0'];
  var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* Rekursive Suche nach dem verbotenen Feldnamen 'sessionId' (S0b §5a). */
  function findKeyNamed(v, name, seen) {
    seen = seen || [];
    if (v && typeof v === 'object' && seen.indexOf(v) >= 0) return null;
    if (Array.isArray(v)) { seen = seen.concat([v]); for (var i = 0; i < v.length; i++) { var r = findKeyNamed(v[i], name, seen); if (r) return r; } return null; }
    if (isPlainObject(v)) {
      seen = seen.concat([v]);
      var ks = Object.keys(v);
      for (var k = 0; k < ks.length; k++) { if (ks[k] === name) return ks[k]; var r2 = findKeyNamed(v[ks[k]], name, seen); if (r2) return r2; }
    }
    return null;
  }

  function fail(code, detail) { return { ok: false, result: null, error: { code: code, detail: detail != null ? detail : null } }; }

  function stableSortGoalsForOutput(goals) {
    // Deterministisch, deckungsgleich mit buildPortfolio: Priorität, dann Zieldatum, dann id.
    return goals.slice().sort(function (a, b) {
      var pa = (typeof a.priority === 'number' && isFinite(a.priority)) ? a.priority : 99;
      var pb = (typeof b.priority === 'number' && isFinite(b.priority)) ? b.priority : 99;
      if (pa !== pb) return pa - pb;
      var da = a.targetDate || '9999-12-31', db = b.targetDate || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
  }

  /* Deterministische Uhr NUR aus dem injizierten planningDayLocal — kein Date.now().
     buildPortfolio erwartet now (ms) für asOf und today (YYYY-MM-DD) strikt. */
  function clockFromPlanningDay(dayLocal) {
    var m = dayLocal.split('-').map(Number);
    return { now: Date.UTC(m[0], m[1] - 1, m[2]), today: dayLocal };
  }

  function reason(code, detail) { return { code: code, detail: detail != null ? detail : null }; }

  /* ---------- Haupt-Adapter ---------- */
  function build(input, opts) {
    opts = opts || {};

    // ---- Fail-closed-Vortore (S2-Auftrag §6) ----
    if (!input || typeof input !== 'object') return fail('SCHEDULER_GA_INVALID_INPUT', 'kein SchedulerInput');
    if (input.activationMode !== ACTIVATION_MODE) return fail('SCHEDULER_GA_ACTIVATION_MODE_REJECTED', input.activationMode);
    if (SUPPORTED_INPUT_VERSIONS.indexOf(input.contractVersion) < 0) return fail('SCHEDULER_GA_UNSUPPORTED_INPUT_VERSION', input.contractVersion);
    if (typeof input.planningDayLocal !== 'string' || !ISO_DATE_RE.test(input.planningDayLocal)) return fail('SCHEDULER_GA_MISSING_PLANNING_DAY', input.planningDayLocal);
    if (typeof input.timezone !== 'string' || !input.timezone.trim()) return fail('SCHEDULER_GA_MISSING_TIMEZONE', input.timezone);

    var ambiguous = findKeyNamed(input, 'sessionId', []);
    if (ambiguous) return fail('SCHEDULER_GA_AMBIGUOUS_SESSION_ID', ambiguous);

    // Reuse-Pflicht: ohne goal-portfolio KEIN eigener Ersatz (kein Zweit-SSOT).
    var gp = O.goalPortfolio;
    if (!gp || typeof gp.buildPortfolio !== 'function') return fail('SCHEDULER_GA_PORTFOLIO_MODULE_MISSING', 'ORVIA.goalPortfolio.buildPortfolio fehlt');

    var rawGoals = Array.isArray(input.goals) ? input.goals : (input.goals && Array.isArray(input.goals.list) ? input.goals.list : []);

    // Widersprüchliche Zielreferenzen: doppelte goalId ⇒ fail-closed (keine stille Zusammenführung).
    var seenId = {};
    for (var gi = 0; gi < rawGoals.length; gi++) {
      var gid = rawGoals[gi] && rawGoals[gi].id;
      if (gid != null) { if (seenId[gid]) return fail('SCHEDULER_GA_CONTRADICTORY_GOAL_REF', 'doppelte goalId: ' + gid); seenId[gid] = true; }
    }

    // Nicht-endliche Zahlen an fachlichen Zielfeldern ⇒ fail-closed (keine stille Korrektur).
    for (var gj = 0; gj < rawGoals.length; gj++) {
      var g = rawGoals[gj] || {};
      var numFields = ['priority', 'targetValue'];
      for (var nf = 0; nf < numFields.length; nf++) {
        var val = g[numFields[nf]];
        if (val != null && (typeof val !== 'number' || !isFinite(val))) {
          if (typeof val === 'number') return fail('SCHEDULER_GA_NON_FINITE_NUMBER', 'goals.' + (g.id || gj) + '.' + numFields[nf]);
        }
      }
    }

    // Optionale, EXPLIZIT injizierte bekannte Gesamtkapazität (nicht Teil des eingefrorenen
    // SchedulerInput-Vertrags — S0b verschiebt echte Kapazität auf Batch 3b/S3). Fehlt sie ⇒
    // unbekannt (keine Minuten). Vorhanden ⇒ muss endlich und ≥ 0 sein.
    var totalCap = null, totalCapKnown = false;
    if (opts.capacity && opts.capacity.totalWeeklyMinutes != null) {
      var tc = opts.capacity.totalWeeklyMinutes;
      if (typeof tc !== 'number' || !isFinite(tc)) return fail('SCHEDULER_GA_NON_FINITE_NUMBER', 'opts.capacity.totalWeeklyMinutes');
      if (tc < 0) return fail('SCHEDULER_GA_NEGATIVE_CAPACITY', tc);
      totalCap = tc; totalCapKnown = true;
    }
    // Zusätzliche Kapazitätsplausibilität: negative perSport-Minuten ⇒ fail-closed.
    if (input.capacity && input.capacity.perSport && isPlainObject(input.capacity.perSport)) {
      var sk = Object.keys(input.capacity.perSport);
      for (var s = 0; s < sk.length; s++) {
        var c = input.capacity.perSport[sk[s]];
        if (c && c.known && typeof c.weeklyMinutes === 'number' && c.weeklyMinutes < 0) return fail('SCHEDULER_GA_NEGATIVE_CAPACITY', 'capacity.perSport.' + sk[s] + '.weeklyMinutes');
      }
    }

    // ---- Reuse: buildPortfolio auf einen Snapshot aus dem SchedulerInput ----
    var clock = clockFromPlanningDay(input.planningDayLocal);
    var snapshot = {
      now: clock.now,
      today: clock.today,
      sports: (input.athlete && Array.isArray(input.athlete.sports)) ? input.athlete.sports.map(function (sp) {
        return { sportId: sp.sportId || sp.sport || null, activeInApp: sp.activeInApp != null ? !!sp.activeInApp : true };
      }) : [],
      goals: rawGoals.map(function (g) {
        return { id: g.id, status: g.status, priority: g.priority, targetDate: g.targetDate, role: g.role, category: g.category, group: g.group || null, metricType: g.metricType, targetValue: g.targetValue, unit: g.unit };
      }),
      dataQuality: input.dataQuality || null
    };
    var pOpts = {};
    if (typeof opts.isKnownCategory === 'function') pOpts.isKnownCategory = opts.isKnownCategory;
    if (opts.evidence != null) pOpts.evidence = opts.evidence;
    if (typeof opts.conflictDetector === 'function') pOpts.conflictDetector = opts.conflictDetector;

    var portfolio;
    try { portfolio = gp.buildPortfolio(snapshot, pOpts); }
    catch (e) { return fail('SCHEDULER_GA_PORTFOLIO_ERROR', e && e.message ? e.message : String(e)); }
    if (!portfolio || typeof portfolio !== 'object') return fail('SCHEDULER_GA_PORTFOLIO_EMPTY', 'buildPortfolio lieferte kein Ergebnis');

    // buildPortfolio-Allokationen nach goalId indizieren.
    var allocByGoal = {};
    (portfolio.allocations || []).forEach(function (a) { allocByGoal[a.goalId] = a; });
    // Per-Ziel-Missingness aus portfolio.missingData ableiten (Pfad beginnt mit 'goals.<id>').
    function goalMissing(id) {
      return (portfolio.missingData || []).filter(function (m) { return m && typeof m.path === 'string' && m.path.indexOf('goals.' + id) === 0; })
        .map(function (m) { return { path: m.path, kind: m.kind }; });
    }

    // Provenienz-Index aus dem SchedulerInput (Priorität + Provenienz transportieren).
    var provByGoal = {};
    rawGoals.forEach(function (g) { if (g && g.id != null) provByGoal[g.id] = { priority: g.priority != null ? g.priority : null, provenance: g.provenance != null ? g.provenance : null }; });

    var warnings = [];
    var eligibleWithBudget = [];

    var outGoals = stableSortGoalsForOutput(rawGoals).map(function (g) {
      var id = g.id;
      var alloc = id != null ? allocByGoal[id] : null;
      var prov = provByGoal[id] || { priority: null, provenance: null };
      var missing = id != null ? goalMissing(id) : [];
      if (prov.provenance == null) missing.push({ path: 'goals.' + (id != null ? id : '?') + '.provenance', kind: 'not_captured' });

      var eligibility, mode = null, role = null, relativeAllocation = null, minimumDose = null, daysToTarget = null, confidence = 'not_assessable', reasons = [];

      if (!alloc) {
        // Nicht in buildPortfolio ⇒ Status weder active noch paused (ausgeschlossen); sichtbar, aber nicht allokierbar.
        eligibility = 'ineligible';
        reasons.push(reason('status_excluded_not_active_or_paused', 'Ziel ist weder active noch paused — keine Allokation, bleibt sichtbar.'));
      } else {
        role = alloc.role; mode = alloc.mode; confidence = alloc.confidence || 'high';
        daysToTarget = alloc.daysToTarget != null ? alloc.daysToTarget : null;
        minimumDose = alloc.minimumDose || null;
        reasons = (alloc.rationaleCodes || []).map(function (rc) { return typeof rc === 'string' ? reason(rc) : reason(rc && rc.code ? rc.code : 'unknown'); });
        if (mode === 'needs_review') eligibility = 'needs_review';
        else if (mode === 'paused') eligibility = 'ineligible';
        else eligibility = 'eligible';
        if (alloc.weeklyBudgetRange && alloc.weeklyBudgetRange.max > 0) {
          relativeAllocation = { min: alloc.weeklyBudgetRange.min, max: alloc.weeklyBudgetRange.max, unit: 'share_of_available_training_budget', basis: alloc.weeklyBudgetRange.basis };
        }
      }

      // Zuordenbare absolute Kapazität NUR bei bekannter Gesamtkapazität (sonst not_assessable — keine Minuten erfinden).
      var capacityBasis, assignableCapacity = null;
      if (totalCapKnown && relativeAllocation) {
        // Konservativ Math.floor ⇒ Summe der Maxima ≤ Gesamtkapazität (shares in Summe ≤ 1 nach buildPortfolio-Normierung).
        var minM = Math.floor(relativeAllocation.min * totalCap);
        var maxM = Math.floor(relativeAllocation.max * totalCap);
        assignableCapacity = { minMinutes: minM, maxMinutes: maxM, unit: 'minutes_per_week', basis: 'share_x_known_total' };
        capacityBasis = { known: true, kind: 'absolute_from_known_total', totalWeeklyMinutes: totalCap };
        eligibleWithBudget.push(maxM);
      } else if (totalCapKnown && !relativeAllocation) {
        assignableCapacity = { minMinutes: 0, maxMinutes: 0, unit: 'minutes_per_week', basis: 'no_budget_share' };
        capacityBasis = { known: true, kind: 'absolute_from_known_total', totalWeeklyMinutes: totalCap };
      } else {
        capacityBasis = { known: false, kind: relativeAllocation ? 'share_only' : 'unknown' };
      }

      return {
        goalId: id != null ? id : null,
        priority: prov.priority,
        prioritySource: 'user_goal_priority',
        provenance: prov.provenance,
        eligibility: eligibility,
        role: role,
        mode: mode,
        capacityBasis: capacityBasis,
        relativeAllocation: relativeAllocation,
        assignableCapacity: assignableCapacity,
        minimumDose: minimumDose,
        daysToTarget: daysToTarget,
        reasons: reasons,
        missingFields: missing,
        confidence: confidence
      };
    });

    // Defensive Invariante: Summe zuordenbarer Maxima ≤ bekannte Gesamtkapazität.
    if (totalCapKnown) {
      var sumMax = eligibleWithBudget.reduce(function (s, x) { return s + x; }, 0);
      if (sumMax > totalCap) return fail('SCHEDULER_GA_OVERBOOKED_ALLOCATION', 'sum(maxMinutes)=' + sumMax + ' > total=' + totalCap);
    }

    // ---- Globale harte Grenzen / weiche Präferenzen (transportiert, NICHT auf Sessions angewandt) ----
    var hardLimits = [];
    var softPreferences = [];
    var av = input.availability;
    if (av && av.days) {
      ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].forEach(function (wd) {
        var d = av.days[wd];
        if (d && d.restDay) hardLimits.push({ code: 'explicit_rest_day', detail: wd, sourceRef: 'availability.days.' + wd + '.restDay' });
        if (d && Array.isArray(d.fixedCommitments) && d.fixedCommitments.length) hardLimits.push({ code: 'fixed_commitment', detail: wd, sourceRef: 'availability.days.' + wd + '.fixedCommitments' });
      });
      if (av.minimumFullRestDays != null) hardLimits.push({ code: 'minimum_full_rest_days', detail: av.minimumFullRestDays, sourceRef: 'availability.minimumFullRestDays' });
      if (av.dailyCapacityCeiling && av.dailyCapacityCeiling.known) hardLimits.push({ code: 'daily_capacity_ceiling', detail: { maxMinutesAllSports: av.dailyCapacityCeiling.maxMinutesAllSports, maxLoadAU: av.dailyCapacityCeiling.maxLoadAU }, sourceRef: 'availability.dailyCapacityCeiling' });
      if (Array.isArray(av.preferredRestDays) && av.preferredRestDays.length) softPreferences.push({ code: 'preferred_rest_days', detail: av.preferredRestDays.slice(), sourceRef: 'availability.preferredRestDays' });
    }
    (Array.isArray(input.fixedEvents) ? input.fixedEvents : []).forEach(function (e, i) {
      hardLimits.push({ code: 'fixed_event', detail: { type: e && e.type, date: e && (e.date || e.day) }, sourceRef: 'fixedEvents[' + i + ']' });
    });

    // ---- Knowledge-Regeln: nur transportiert, NIE auf die Allokation angewandt ----
    var knowledgeRulesUsed = (Array.isArray(input.knowledgeRules) ? input.knowledgeRules : []).map(function (r) {
      var complete = r && r.complete === true;
      if (!complete) warnings.push({ code: 'knowledge_rule_incomplete', ruleId: r && r.ruleId, detail: 'Regel ohne vollständige Metadaten — beeinflusst keine Allokation (S0b §10a).' });
      else if (r.approvalStatus !== 'approved') warnings.push({ code: 'knowledge_rule_not_approved', ruleId: r.ruleId, detail: 'Regel nicht freigegeben — bleibt ignored.' });
      if (r && r.safety && r.safety.blockedReason) warnings.push({ code: 'knowledge_rule_blocked', ruleId: r.ruleId, detail: r.safety.blockedReason });
      return {
        ruleId: r && r.ruleId != null ? r.ruleId : null,
        usedAs: (r && r.usedAs) ? r.usedAs : 'ignored',
        appliedToAllocation: false  // S2 wendet NIE eine Wissensregel auf die Allokation an.
      };
    });

    // ---- Globale Missingness / Confidence (aus buildPortfolio übernommen) ----
    var missingFields = (portfolio.missingData || []).map(function (m) { return { path: m.path, kind: m.kind }; });
    if (!rawGoals.length) missingFields.push({ path: 'goals', kind: 'not_captured' });
    if (!totalCapKnown) missingFields.push({ path: 'capacity.totalWeeklyMinutes', kind: 'not_captured' });

    var result = {
      contractVersion: CONTRACT_VERSION,
      activationMode: ACTIVATION_MODE,
      inputContractVersion: input.contractVersion,
      planningDayLocal: input.planningDayLocal,
      timezone: input.timezone,
      portfolioSource: { module: 'goal-portfolio', version: portfolio.version, ruleVersion: portfolio.ruleVersion },
      focusGoalId: portfolio.focusGoalId != null ? portfolio.focusGoalId : null,
      goals: outGoals,
      conflicts: portfolio.conflicts || [],
      hardLimits: hardLimits,
      softPreferences: softPreferences,
      knowledgeRulesUsed: knowledgeRulesUsed,
      capacityKnown: totalCapKnown,
      warnings: warnings,
      missingFields: missingFields,
      confidence: portfolio.confidence || 'low',
      provenance: {
        contractVersion: CONTRACT_VERSION,
        portfolioVersion: portfolio.version,
        portfolioRuleVersion: portfolio.ruleVersion,
        inputContractVersion: input.contractVersion,
        capacitySource: totalCapKnown ? 'injected_known_total' : 'unknown'
      }
    };

    // Ausgabeschutz: kein konkreter Session-/Termin-Inhalt, kein verbotenes ID-Feld.
    if (findKeyNamed(result, 'sessionId', [])) return fail('SCHEDULER_GA_AMBIGUOUS_SESSION_ID_PRODUCED', 'internes Ergebnis enthält sessionId');
    if ('plannedSessions' in result) return fail('SCHEDULER_GA_SESSION_LEAK', 'Ergebnis enthält plannedSessions (S2-Scope verletzt)');

    return { ok: true, result: result, error: null };
  }

  O.schedulerGoalAllocation = {
    CONTRACT_VERSION: CONTRACT_VERSION,
    ACTIVATION_MODE: ACTIVATION_MODE,
    SUPPORTED_INPUT_VERSIONS: SUPPORTED_INPUT_VERSIONS.slice(),
    build: build,
    findKeyNamed: findKeyNamed
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.schedulerGoalAllocation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
