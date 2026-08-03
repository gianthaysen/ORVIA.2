/* ============================================================
   ORVIA · Engine 3c — Scheduler S1: SchedulerInput-Factory (reine Funktion)
   Vertrag: app/docs/SCHEDULER-S0-CONTRACT.md (S0b, Hash
   902582a1e08f03f225a882d24fcbd7f42b4015c6a9835a42c1e4d77bc47bfe1c), §4.

   S1-SKOPE: ausschließlich Vertrags-/Determinismus-Skelett. KEINE
   Trainingsplanung, KEINE Übungsauswahl, KEINE Periodisierung, KEIN
   produktiver Planwechsel.

   Reinheit (hart, S0b §4 / S1-Auftrag Punkt 3):
   - kein DOM, kein localStorage, kein Store-/Repository-Zugriff,
     kein Netzwerk, kein Date.now()/new Date() ohne injizierten Wert,
     kein Lesen von PROFILE/DB/ActivityStore, keine Zufalls-IDs,
     keine Schreiboperationen, keine stillen Defaults für fachliche Daten.
   - fail-closed: ungültige Pflichtfelder ⇒ strukturierter Fehler,
     NIE ein geratener Input (CLAUDE.md §8.5).
   - Einheiten/Provenienz bleiben erhalten; Missingness bleibt
     strukturiert und maschinenlesbar (nie stiller Default).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  var INPUT_CONTRACT_VERSION = 'sched-input-v1.0.0';
  var ACTIVATION_MODE = 'shadow_only'; // S0b §14 Gate 0-3: S1 kennt ausschließlich shadow_only.
  var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var HORIZON_DAYS = 7; // S0b §4/§12 S1: erster Planungshorizont ist fest auf 7 lokale Kalendertage.
  var WEEKDAY_ORDER = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']; // identisch zu profile-model.js WEEKDAYS.

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* Tiefensuche nach dem verbotenen mehrdeutigen Feldnamen 'sessionId' (S0b §5a / S1-ID-Vertrag:
     nur templateSessionId | plannedOccurrenceId | workoutSessionId | activityId sind zulässig). */
  function findAmbiguousSessionIdKey(v, path, seen) {
    seen = seen || [];
    if (v && typeof v === 'object' && seen.indexOf(v) >= 0) return null; // Zyklenschutz
    if (Array.isArray(v)) {
      seen = seen.concat([v]);
      for (var i = 0; i < v.length; i++) { var r = findAmbiguousSessionIdKey(v[i], (path || '') + '[' + i + ']', seen); if (r) return r; }
      return null;
    }
    if (isPlainObject(v)) {
      seen = seen.concat([v]);
      var keys = Object.keys(v);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (key === 'sessionId') return (path || '') + '.' + key;
        var r2 = findAmbiguousSessionIdKey(v[key], (path || '') + '.' + key, seen);
        if (r2) return r2;
      }
      return null;
    }
    return null;
  }

  /* Deterministische 7-Tage-Kalenderfolge ab einem bereits lokal aufgelösten Startdatum.
     Reine Kalenderarithmetik in UTC-Millisekunden (Date.UTC) — bewusst OHNE Bezug zur
     Prozess-/Host-Zeitzone, damit dasselbe Ergebnis in UTC- und Europe/Vienna-Umgebungen
     entsteht. DST-Übergänge betreffen nur die Wanduhrzeit innerhalb eines Tages, nicht die
     Kalendertagesfolge — reine Kalenderarithmetik ist daher DST-sicher per Konstruktion. */
  function buildLocalHorizonDays(planningDayLocal, days) {
    if (typeof planningDayLocal !== 'string' || !ISO_DATE_RE.test(planningDayLocal)) return null;
    var m = planningDayLocal.split('-').map(Number);
    var y = m[0], mo = m[1] - 1, d = m[2];
    var base = Date.UTC(y, mo, d);
    var out = [];
    for (var i = 0; i < days; i++) {
      var t = new Date(base + i * 86400000);
      var yy = t.getUTCFullYear(), mm = String(t.getUTCMonth() + 1).padStart(2, '0'), dd = String(t.getUTCDate()).padStart(2, '0');
      out.push(yy + '-' + mm + '-' + dd);
    }
    return out;
  }

  /* Deterministische Ableitung einer plannedOccurrenceId aus Vertragsversion, Nutzerbezug,
     lokalem Datum und Slot (S0b §5a / S1-ID-Vertrag Nr. 5) — FNV-1a-32 nur für Stabilität,
     KEINE Kryptografie nötig; kein Zeitstempel, kein Zufall. */
  function _fnv1a32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function deriveEmptySlotToken(contractVersion, userRef, slotIndex) {
    var raw = String(contractVersion) + '|' + String(userRef == null ? 'anon' : userRef) + '|slot' + String(slotIndex);
    return 'empty-' + _fnv1a32(raw).toString(36);
  }
  function derivePlannedOccurrenceId(contractVersion, userRef, localDate, slotIndex) {
    return 'po:' + localDate + ':' + deriveEmptySlotToken(contractVersion, userRef, slotIndex);
  }

  function failClosed(code, missingFields, detail) {
    return { ok: false, input: null, error: { code: code, missingFields: missingFields || [], detail: detail || null }, warnings: [] };
  }

  /* Sortiert Arrays deterministisch nach einem Stabilitätsschlüssel — Reihenfolgeunabhängigkeit
     der Eingabe (S1-Determinismus-Vorgabe). Array-Eingabereihenfolge ist NIE SSOT. */
  function stableSortBy(arr, keyFn) {
    return (Array.isArray(arr) ? arr.slice() : []).map(function (v, i) { return [v, i]; })
      .sort(function (a, b) {
        var ka = String(keyFn(a[0]) == null ? '' : keyFn(a[0])), kb = String(keyFn(b[0]) == null ? '' : keyFn(b[0]));
        if (ka < kb) return -1; if (ka > kb) return 1; return a[1] - b[1];
      })
      .map(function (p) { return p[0]; });
  }

  /* ---------- Haupt-Factory ---------- */
  function build(raw, opts) {
    opts = opts || {};
    raw = raw || {};
    var missingFields = [];
    var warnings = [];

    // Fail-closed: mehrdeutiger Feldname 'sessionId' irgendwo im Rohinput (S0b §5a, S1-ID-Vertrag).
    var ambiguous = findAmbiguousSessionIdKey(raw, '', []);
    if (ambiguous) return failClosed('SCHEDULER_INPUT_AMBIGUOUS_SESSION_ID', [ambiguous]);

    // Fail-closed: Pflicht-Zeitanker (NIE Date.now()/new Date() ohne injizierten Wert).
    if (typeof raw.planningDayLocal !== 'string' || !ISO_DATE_RE.test(raw.planningDayLocal)) {
      return failClosed('SCHEDULER_INPUT_MISSING_PLANNING_DAY', ['planningDayLocal']);
    }
    if (typeof raw.timezone !== 'string' || !raw.timezone.trim()) {
      return failClosed('SCHEDULER_INPUT_MISSING_TIMEZONE', ['timezone']);
    }
    // Fail-closed: activationMode darf im S1-Skelett NIE auf live gestellt werden — auch nicht
    // durch einen fremden/veralteten Aufrufer (S0b §14 Gate 0-3, S1-Pflichtverhalten).
    if (raw.activationMode != null && raw.activationMode !== ACTIVATION_MODE) {
      return failClosed('SCHEDULER_INPUT_ACTIVATION_MODE_REJECTED', ['activationMode'], { requested: raw.activationMode });
    }

    var horizonDays = buildLocalHorizonDays(raw.planningDayLocal, HORIZON_DAYS);
    if (!horizonDays || horizonDays.length !== HORIZON_DAYS) {
      return failClosed('SCHEDULER_INPUT_INVALID_PLANNING_DAY', ['planningDayLocal']);
    }

    var userRef = (raw.athlete && (raw.athlete.userRef || raw.athlete.id)) || opts.userRef || null;
    if (userRef == null) missingFields.push('athlete.userRef');

    // Ziele: Priorität + Provenienz je Ziel; fehlende Einzelfelder ⇒ missingFields, kein Erfinden.
    var goalsRaw = Array.isArray(raw.goals && raw.goals.list) ? raw.goals.list : (Array.isArray(raw.goals) ? raw.goals : null);
    var goals = null;
    if (goalsRaw) {
      goals = stableSortBy(goalsRaw, function (g) { return g && g.id; }).map(function (g, i) {
        g = g || {};
        if (g.priority == null) missingFields.push('goals[' + i + '].priority');
        if (g.provenance == null) missingFields.push('goals[' + i + '].provenance');
        return {
          id: g.id != null ? g.id : null, category: g.category != null ? g.category : null, role: g.role != null ? g.role : null,
          priority: g.priority != null ? g.priority : null, timeHorizon: g.timeHorizon != null ? g.timeHorizon : null,
          targetDate: g.targetDate != null ? g.targetDate : null, status: g.status != null ? g.status : null,
          metricType: g.metricType != null ? g.metricType : null, targetValue: g.targetValue != null ? g.targetValue : null,
          unit: g.unit != null ? g.unit : null, sports: Array.isArray(g.sports) ? g.sports.slice() : [],
          provenance: g.provenance != null ? g.provenance : null
        };
      });
    } else { missingFields.push('goals'); }

    // Verfügbarkeit: 3 Ruhetag-Ebenen strikt trennen (S0b §4/§6 Hard #1/#13/#14).
    var availRaw = raw.availability || null;
    var availability = null;
    if (availRaw && isPlainObject(availRaw.days)) {
      var days = {};
      WEEKDAY_ORDER.forEach(function (wd) {
        var w = availRaw.days[wd] || null;
        if (!w) { missingFields.push('availability.days.' + wd); days[wd] = null; return; }
        days[wd] = {
          available: w.available != null ? !!w.available : null,
          restDay: !!w.restDay,                 // HART (Hard #1) — nie mit preferredRestDays vermischen.
          singleSession: w.singleSession || null,
          doubleSession: { enabled: !!(w.doubleSession && w.doubleSession.enabled) }, // Default AUS (Hard #16).
          fixedCommitments: Array.isArray(w.fixedCommitments)
            ? stableSortBy(w.fixedCommitments, function (c) { return (c && c.start) || (c && c.id) || ''; })
            : []
        };
      });
      availability = {
        days: days,
        maxSessionsPerWeek: availRaw.maxSessionsPerWeek != null ? availRaw.maxSessionsPerWeek : null,
        maxIntenseSessions: availRaw.maxIntenseSessions != null ? availRaw.maxIntenseSessions : null,
        preferredRestDays: Array.isArray(availRaw.preferredRestDays) ? availRaw.preferredRestDays.slice().sort() : [], // WEICH (Hard #14).
        minimumFullRestDays: availRaw.minimumFullRestDays != null ? availRaw.minimumFullRestDays : null,               // HART (Hard #13).
        dailyCapacityCeiling: (availRaw.dailyCapacityCeiling && isPlainObject(availRaw.dailyCapacityCeiling))
          ? {
              maxMinutesAllSports: availRaw.dailyCapacityCeiling.maxMinutesAllSports != null ? availRaw.dailyCapacityCeiling.maxMinutesAllSports : null,
              maxLoadAU: availRaw.dailyCapacityCeiling.maxLoadAU != null ? availRaw.dailyCapacityCeiling.maxLoadAU : null,
              confidence: availRaw.dailyCapacityCeiling.confidence != null ? availRaw.dailyCapacityCeiling.confidence : null,
              known: true
            }
          : { maxMinutesAllSports: null, maxLoadAU: null, confidence: null, known: false }  // unbekannt ≠ Nullwert (Hard #18).
      };
    } else { missingFields.push('availability'); }

    var fixedEvents = Array.isArray(raw.fixedEvents)
      ? stableSortBy(raw.fixedEvents, function (e) { return (e && (e.date || e.day)) + '|' + (e && e.type); })
      : [];
    var constraints = Array.isArray(raw.constraints) ? stableSortBy(raw.constraints, function (c) { return c && c.id; }) : [];

    // Kapazität je Sportart: fehlend/not_assessable bleibt explizit unbekannt (Hard #15/#17) — nie Nullwert erfinden.
    var capacityPerSportRaw = (raw.capacity && raw.capacity.perSport) || null;
    var capacityPerSport = null;
    if (capacityPerSportRaw && isPlainObject(capacityPerSportRaw)) {
      capacityPerSport = {};
      Object.keys(capacityPerSportRaw).sort().forEach(function (sportId) {
        var c = capacityPerSportRaw[sportId];
        if (c == null || c === 'not_assessable') { capacityPerSport[sportId] = { known: false, confidence: 'not_assessable' }; return; }
        capacityPerSport[sportId] = {
          known: true,
          weeklySessions: c.weeklySessions != null ? c.weeklySessions : null,
          weeklyMinutes: c.weeklyMinutes != null ? c.weeklyMinutes : null,
          weeklyDistanceKm: c.weeklyDistanceKm != null ? c.weeklyDistanceKm : null,
          weeklyLoadAU: c.weeklyLoadAU != null ? c.weeklyLoadAU : null,
          longSessionCeiling: c.longSessionCeiling != null ? c.longSessionCeiling : null,
          confidence: c.confidence != null ? c.confidence : 'not_assessable',
          missingFields: Array.isArray(c.missingFields) ? c.missingFields.slice() : []
        };
      });
    } else { missingFields.push('capacity.perSport'); }

    // Knowledge-Regeln: Version/Evidenz/Freigabe/Quellen/Safety müssen vollständig sein, sonst
    // wird die Regel fail-closed ignoriert (S0b §10a) — sie fließt NIE mit Default „erlaubt" ein.
    var knowledgeRulesRaw = Array.isArray(raw.knowledgeRules) ? raw.knowledgeRules : [];
    var knowledgeRules = stableSortBy(knowledgeRulesRaw, function (r) { return r && r.ruleId; }).map(function (r) {
      r = r || {};
      var complete = r.ruleId != null && r.version != null && r.evidenceClass != null && r.evidenceStatus != null
        && r.approvalStatus != null && Array.isArray(r.sources) && r.safety != null;
      return {
        ruleId: r.ruleId != null ? r.ruleId : null,
        version: r.version != null ? r.version : null,
        evidenceClass: r.evidenceClass != null ? r.evidenceClass : null,
        evidenceStatus: r.evidenceStatus != null ? r.evidenceStatus : null,
        approvalStatus: r.approvalStatus != null ? r.approvalStatus : null,
        sources: Array.isArray(r.sources) ? r.sources.slice() : [],
        safety: r.safety != null
          ? { medicallyReviewed: !!r.safety.medicallyReviewed, blockedReason: r.safety.blockedReason != null ? r.safety.blockedReason : null }
          : { medicallyReviewed: false, blockedReason: null },
        // S1 wendet KEINE Regel an — approvalStatus!=='approved' oder unvollständig ⇒ 'ignored' (fail-closed).
        usedAs: (complete && r.approvalStatus === 'approved') ? 'shadow_only' : 'ignored',
        complete: complete
      };
    });

    var planActual = raw.planActual != null ? raw.planActual : null;
    var userGymPlans = Array.isArray(raw.userGymPlans) ? stableSortBy(raw.userGymPlans, function (p) { return p && p.id; }) : [];
    var equipment = Array.isArray(raw.equipment) ? raw.equipment.slice() : [];
    var preferences = raw.preferences != null ? raw.preferences : null;
    var athlete = raw.athlete != null ? raw.athlete : null;
    if (!athlete) missingFields.push('athlete');

    var input = {
      contractVersion: INPUT_CONTRACT_VERSION,
      activationMode: ACTIVATION_MODE,          // S1: IMMER shadow_only — s. o. fail-closed-Gate.
      timezone: raw.timezone,
      planningDayLocal: raw.planningDayLocal,   // injizierter lokaler Planungstag (NIE Date.now()).
      planningHorizonDays: HORIZON_DAYS,
      horizon: horizonDays,                     // exakt 7 aufeinanderfolgende lokale Kalendertage.
      inputSnapshotId: opts.inputSnapshotId != null ? opts.inputSnapshotId : null,
      athlete: athlete,
      goals: goals,
      availability: availability,
      fixedEvents: fixedEvents,
      constraints: constraints,
      readinessToday: raw.readinessToday != null ? raw.readinessToday : null,
      capacity: { perSport: capacityPerSport },
      loadHistory: raw.loadHistory != null ? raw.loadHistory : null,
      planActual: planActual,
      knowledgeRules: knowledgeRules,
      userGymPlans: userGymPlans,
      equipment: equipment,
      preferences: preferences,
      dataQuality: raw.dataQuality != null ? raw.dataQuality : null
    };

    return { ok: true, input: input, error: null, warnings: warnings, missingFields: missingFields };
  }

  O.schedulerInputFactory = {
    CONTRACT_VERSION: INPUT_CONTRACT_VERSION,
    ACTIVATION_MODE: ACTIVATION_MODE,
    HORIZON_DAYS: HORIZON_DAYS,
    WEEKDAY_ORDER: WEEKDAY_ORDER,
    build: build,
    buildLocalHorizonDays: buildLocalHorizonDays,
    derivePlannedOccurrenceId: derivePlannedOccurrenceId,
    findAmbiguousSessionIdKey: findAmbiguousSessionIdKey,
    stableSortBy: stableSortBy
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.schedulerInputFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
