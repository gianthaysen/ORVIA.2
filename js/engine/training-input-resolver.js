/* ============================================================
   ORVIA · engine/training-input-resolver — Engine-Input (Phase 8)
   ------------------------------------------------------------
   GARMIN-INTEGRATION-DESIGN.md §9 Phase 8: bedient EXAKT den v2-Vertrag
   (readiness-engine-v2 / decision-engine-v2) aus Check-ins + user_metrics
   (+ Belastungshistorie). Vorher baute der Shadow-Runner diesen Input
   ad-hoc und NUR aus dem Check-in — ohne Check-in war die Engine blind,
   obwohl Garmin-Werte (Schlaf, HRV, Ruhepuls, Body Battery) vorlagen.

   Regeln:
   - OBJEKTIVE Felder (sleepMin, rhr, hrvMs, hrv-Status, bb): Check-in-Wert
     gewinnt (er kann bereits Garmin-autogefüllt sein, Phase 6); fehlt er,
     greift der frische Garmin-Wert aus dem Metric Store. Die Frische-/
     Quellen-Regeln kommen aus checkin-field-resolver (EINE Logik, kein
     Duplikat): nur automatic/override, nicht stale, Alter ≤ autoMaxAgeDays.
   - SUBJEKTIVE Felder (sleepQ, feel, doms→soreness, stress): NUR Check-in.
     Fehlt der Check-in, bleiben sie ehrlich null (missingData) — es wird
     nie etwas erfunden.
   - safetyFlags ist ein OBJEKT (v2-Vertrag); ein Phantom-Feld m.pain gibt
     es nicht. Schmerz kommt über constraints[] (intensity) in die Gates.
   - Garmin Training Readiness / Body Battery: Gewicht 0 im v2-Score
     (Komposit-Doppelzählung, Audit) — bb wird durchgereicht (Engine führt
     ihn als Kontextfaktor mit Gewicht 0), Training Readiness bleibt reiner
     Anzeige-Wert (Profilkarte, Phase 5) und geht NICHT in den Input.
   - Belastung (recentLoad): aktuell aus den lokalen Tages-Sessions
     (Calc.sessionLoad, Blob). Bekannte Grenze: serverseitig synchronisierte
     Aktivitäten ohne RPE fließen nicht in sRPE-Last ein; die
     training_load_daily-Anbindung ist ein separater Schritt.

   Pure-Kern (mergeObjective / buildReadinessInput / buildDecisionInput)
   + collect() als einziger Globals-Leser (DB, recoveryCtx, Plan, PROFILE,
   window._metricsResolved-Stash aus _ciAutoLoad).
   Vertragstest: supabase/tests/training_input_p8_test.mjs
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  /* Objektive Engine-Felder mit Metric-Store-Fallback. Registry-kompatible
     Minimal-Definitionen (gleiche Keys/metricIds/Grenzen wie checkin-fields;
     bewusst eigenständig, damit der Resolver auch ohne geladene Check-in-
     Registry deterministisch bleibt — Vertragstest erzwingt Gleichstand). */
  var OBJECTIVE_FIELDS = [
    { key: 'sleepMin', kind: 'sleep', min: 180, max: 720, metricId: 'sleep_duration_min', autoMaxAgeDays: 1, autoUnit: 'sleep' },
    { key: 'rhr', kind: 'number', metricId: 'resting_hr', autoMaxAgeDays: 1, autoUnit: 'bpm' },
    { key: 'hrvMs', kind: 'number', metricId: 'hrv_ms', autoMaxAgeDays: 1, autoUnit: 'ms' },
    { key: 'hrv', kind: 'chipsText', metricId: 'hrv_status', autoMaxAgeDays: 1, autoUnit: 'text' },
    { key: 'bb', kind: 'number', metricId: 'body_battery', autoMaxAgeDays: 0, autoUnit: '%' }
  ];

  /* PURE · Check-in-Wert gewinnt; sonst frischer Garmin-Wert (autoMap =
     Ergebnis von checkinFieldResolver.resolveCheckinFields über
     OBJECTIVE_FIELDS). Rückgabe mit Provenienz je Feld. */
  function mergeObjective(morning, autoMap) {
    var m = morning || {}, a = autoMap || {};
    var out = { values: {}, provenance: {} };
    OBJECTIVE_FIELDS.forEach(function (f) {
      if (m[f.key] != null) { out.values[f.key] = m[f.key]; out.provenance[f.key] = 'checkin'; }
      else if (a[f.key] && a[f.key].value != null) { out.values[f.key] = a[f.key].value; out.provenance[f.key] = 'metric_store'; }
      else { out.values[f.key] = null; out.provenance[f.key] = null; }
    });
    return out;
  }

  /* PURE · v2-Readiness-Input (exakte Feldnamen aus readiness-engine-v2):
     opts = { morning, autoMap, ctx (recoveryCtx-Form), sleepGoalHours } */
  function buildReadinessInput(opts) {
    opts = opts || {};
    var m = opts.morning || {};
    var ctx = opts.ctx || {};
    var obj = mergeObjective(opts.morning, opts.autoMap);
    return {
      sleepMinutes: obj.values.sleepMin,
      sleepGoalHours: opts.sleepGoalHours != null ? opts.sleepGoalHours : null,
      sleepQuality: m.sleepQ != null ? m.sleepQ : null,
      feel: m.feel != null ? m.feel : null,
      soreness: m.doms != null ? m.doms : null,
      stress: m.stress || null,
      restingHr: obj.values.rhr,
      rhrBaseline: ctx.rhrBase != null ? ctx.rhrBase : null,
      rhrBaselineDays: ctx.rhrN != null ? ctx.rhrN : 0,
      hrvMs: obj.values.hrvMs,
      hrvStatus: obj.values.hrv || null,
      hrvBaselineLn: ctx.hrvBase7 != null ? ctx.hrvBase7 : null,
      hrvSd28: ctx.hrvSd28 != null ? ctx.hrvSd28 : null,
      hrvBaselineDays: ctx.hrvN != null ? ctx.hrvN : 0,
      bodyBattery: obj.values.bb,
      _provenance: obj.provenance
    };
  }

  /* PURE · v2-Decision-Input (safetyFlags als Objekt, illness aus dem
     kanonischen Feld mit ill-Alias — Phase-6-Vorbedingung (a)). */
  function buildDecisionInput(opts) {
    opts = opts || {};
    var m = opts.morning || null;
    return {
      readiness: opts.readiness || { score: null, confidence: 'low', warnings: [], missingData: [] },
      safetyFlags: {},
      illness: !!(m && (m.illness != null ? m.illness : m.ill)),
      constraints: Array.isArray(opts.constraints) ? opts.constraints : [],
      plannedSession: opts.plannedSession || null,
      recentLoad: opts.recentLoad || { acute7: null, chronic28PerWeek: null, dataDays: 0, hardYesterday: false, hardStreak: 0 },
      goalContext: opts.goalContext || { daysToEvent: null },
      availabilityToday: opts.availabilityToday != null ? opts.availabilityToday : null
    };
  }

  /* I/O · frische Garmin-Werte aus dem _metricsResolved-Stash (_ciAutoLoad,
     Phase 6/7). Nur wenn der Stash von HEUTE ist — alter Stash zählt nicht. */
  function autoMapFromStash(today) {
    try {
      var st = root._metricsResolved;
      if (!st || st.date !== today || !st.resolved) return null;
      if (!O.checkinFieldResolver || !O.checkinFieldResolver.resolveCheckinFields) return null;
      return O.checkinFieldResolver.resolveCheckinFields(OBJECTIVE_FIELDS, st.resolved, { today: today });
    } catch (e) { return null; }
  }

  /* I/O · kompletter v2-Input aus den App-Globals (einziger Globals-Leser;
     Logik unverändert aus dem Shadow-Runner hierher gezogen). */
  function collect() {
    var missing = [];
    var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
    var e = (today && typeof root.DB !== 'undefined' && root.DB) ? (root.DB[today] || {}) : {};
    var m = e.morning || null;
    if (!m) missing.push('morning_checkin');

    var autoMap = today ? autoMapFromStash(today) : null;
    if (!autoMap) missing.push('metric_store_stash');

    var readiness = { score: null, confidence: 'low', warnings: [], missingData: [] };
    try {
      if (O.readinessEngineV2 && typeof O.readinessEngineV2.evaluate === 'function' && (m || autoMap)) {
        var ctx = (typeof root.recoveryCtx === 'function' && today) ? root.recoveryCtx(today) : {};
        var sleepGoalH = null;
        try { if (O.profileStore && O.profileStore.effectiveSleepGoal) sleepGoalH = O.profileStore.effectiveSleepGoal() || null; } catch (e4) {}
        readiness = O.readinessEngineV2.evaluate(buildReadinessInput({
          morning: m, autoMap: autoMap, ctx: ctx, sleepGoalHours: sleepGoalH
        })) || readiness;
      } else if (typeof root.readinessOf === 'function' && today) {
        var sc = root.readinessOf(today);
        readiness = { score: sc != null ? sc : null, confidence: 'low', warnings: [], missingData: ['v2_readiness_unavailable'] };
      }
    } catch (err) { missing.push('readiness_error'); }

    // Geplante Einheit heute (aktiver Wochenplan; deutsche Typen → kanonisch).
    var planned = null;
    try {
      var wd = today ? (new Date(today + 'T12:00').getDay() + 6) % 7 : null;
      var plan = (typeof root.activeWeekPlan === 'function') ? root.activeWeekPlan() : null;
      var item = (plan && wd != null && plan[wd] && plan[wd][0]) || null;
      if (item) {
        var sport = 'other';
        try { if (O.trainingDomain && O.trainingDomain.normSport) sport = O.trainingDomain.normSport(item.t) || 'other'; } catch (e2) {}
        var d = String(item.d || '') + ' ' + String(item.l || '');
        var intensity = /iv|Intervalle|tempo|Tempo|race/i.test(d) ? 'hard' : (/lr|Long/i.test(d) ? 'long' : 'easy');
        planned = { sport: sport, intensity: intensity, label: item.l || '' };
      }
    } catch (err) { missing.push('planned_error'); }

    // Belastung 7/28 Tage aus sRPE-Lasten (lokale Sessions — Grenze s. Header).
    var recentLoad = { acute7: null, chronic28PerWeek: null, dataDays: 0, hardYesterday: false, hardStreak: 0 };
    try {
      if (typeof root.DB !== 'undefined' && root.DB && root.Calc && root.Calc.sessionLoad && typeof root.todayStr === 'function') {
        var acute = 0, chronic = 0, dataDays = 0;
        for (var i = 0; i < 28; i++) {
          var dte = new Date(); dte.setDate(dte.getDate() - i);
          var k = root.todayStr(dte);
          var L = root.Calc.sessionLoad(root.DB[k]);
          if (L > 0) dataDays++;
          if (i < 7) acute += L;
          chronic += L;
        }
        var y = new Date(); y.setDate(y.getDate() - 1);
        var ky = root.todayStr(y);
        var sy = root.DB[ky] && root.DB[ky].sessions;
        var hardY = false;
        if (sy) Object.keys(sy).forEach(function (t) { if (t === '_ts') return; var x = sy[t]; if ((x.rpe || 0) >= 7 || (x.dist || 0) >= 14) hardY = true; });
        recentLoad = { acute7: Math.round(acute), chronic28PerWeek: Math.round(chronic / 4), dataDays: dataDays, hardYesterday: hardY, hardStreak: hardY ? 1 : 0 };
      } else missing.push('load_data');
    } catch (err) { missing.push('load_error'); }

    var availability = (function () {
      try {
        var cfg = O.profileModel && O.profileModel.effectiveTrainingConfig ? O.profileModel.effectiveTrainingConfig(root.PROFILE) : null;
        if (!cfg || !cfg.availableDayIdx || !cfg.availableDayIdx.length) return null;
        var wd2 = (new Date().getDay() + 6) % 7;
        return cfg.availableDayIdx.indexOf(wd2) >= 0;
      } catch (e3) { return null; }
    })();

    var input = buildDecisionInput({
      readiness: readiness,
      morning: m,
      constraints: (typeof root.PROFILE !== 'undefined' && root.PROFILE && Array.isArray(root.PROFILE.constraintsList)) ? root.PROFILE.constraintsList : [],
      plannedSession: planned,
      recentLoad: recentLoad,
      goalContext: { daysToEvent: (typeof root.daysTo === 'function' && typeof root.RACE !== 'undefined' && root.RACE && root.RACE.date) ? root.daysTo(root.RACE.date) : null },
      availabilityToday: availability
    });
    input._shadowMissing = missing;
    return input;
  }

  var API = {
    OBJECTIVE_FIELDS: OBJECTIVE_FIELDS,
    mergeObjective: mergeObjective,
    buildReadinessInput: buildReadinessInput,
    buildDecisionInput: buildDecisionInput,
    autoMapFromStash: autoMapFromStash,
    collect: collect
  };

  O.trainingInputResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
