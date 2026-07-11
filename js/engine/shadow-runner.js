/* ============================================================
   ORVIA · engine/shadow-runner — E2: Engine-v2 SHADOW-MODE (Aktivierungsgate C8).
   Produktentscheidung 2026-07-11 (Master-Prompt §26 Prio 3 + Mandat „Engine
   produktreif"): v2 rechnet ab jetzt bei jeder Tagesentscheidung PARALLEL mit.
   Verbindlich:
   - v2 STEUERT NICHTS. Die sichtbare Entscheidung bleibt buildTrainingDecision (v1).
   - Protokoll NUR lokal, user-scoped (orvia_engine_shadow_<uid>), Ringpuffer 90
     Einträge, ein Eintrag je Tag (letzter Lauf gewinnt) — keine Server-Telemetrie.
   - Fehlende Inputs werden ehrlich als missingData geloggt, nie erfunden.
   - Gate-Kriterium (ENGINE-V2-DESIGN §5): ≥14 reale Tage protokolliert, Differenzen
     fachlich bewertet → erst dann Umschalt-Entscheidung.
   Debug: ORVIA.engineShadow.report() in der Konsole.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  function _uid() { return (O.user && O.user.id) || 'anon'; }
  function _key() { return 'orvia_engine_shadow_' + _uid(); }
  function _readLog() {
    try { var raw = root.localStorage && root.localStorage.getItem(_key()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function _writeLog(a) { try { if (root.localStorage) root.localStorage.setItem(_key(), JSON.stringify(a.slice(-90))); } catch (e) {} }

  /* v1-Welt → v2-Input. DEFENSIV: alles optional, fehlendes wird ausgewiesen. */
  function buildInput() {
    var missing = [];
    var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
    var e = (today && typeof root.DB !== 'undefined' && root.DB) ? (root.DB[today] || {}) : {};
    var m = e.morning || null;
    if (!m) missing.push('morning_checkin');

    // Readiness: v1-Score als Eingang (Shadow vergleicht die ENTSCHEIDUNGS-Logik;
    // der Readiness-Engine-v2-Vergleich läuft separat über readinessEngineV2, wenn Inputs da sind).
    var readiness = { score: null, confidence: 'low', warnings: [], missingData: [] };
    try {
      if (m && O.readinessEngineV2 && typeof O.readinessEngineV2.evaluate === 'function') {
        var ctx = (typeof root.recoveryCtx === 'function') ? root.recoveryCtx(today) : {};
        readiness = O.readinessEngineV2.evaluate({
          sleepMinutes: m.sleepMin != null ? m.sleepMin : null,
          sleepQuality: m.sleepQ != null ? m.sleepQ : null,
          feel: m.feel != null ? m.feel : null,
          doms: m.doms != null ? m.doms : null,
          stress: m.stress || null,
          restingHr: m.rhr != null ? m.rhr : null,
          restingHrBaseline: ctx && ctx.rhrBase != null ? ctx.rhrBase : null,
          hrvMs: m.hrvMs != null ? m.hrvMs : null,
          hrvBaselineLn7: ctx && ctx.hrvBase7 != null ? ctx.hrvBase7 : null,
          bodyBattery: m.bb != null ? m.bb : null
        }) || readiness;
      } else if (typeof root.readinessOf === 'function') {
        var sc = root.readinessOf(today);
        readiness = { score: sc != null ? sc : null, confidence: 'low', warnings: [], missingData: ['v2_readiness_unavailable'] };
      }
    } catch (err) { missing.push('readiness_error'); }

    // Geplante Einheit heute (aus dem aktiven Wochenplan; deutsche Typen → kanonisch).
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

    // Belastung der letzten 7/28 Tage aus sRPE-Lasten.
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

    var input = {
      readiness: readiness,
      safetyFlags: (m && m.pain >= 8) ? ['severe_pain'] : [],
      illness: !!(m && m.ill),
      constraints: (typeof PROFILE !== 'undefined' && PROFILE && Array.isArray(PROFILE.constraintsList)) ? PROFILE.constraintsList : [],
      plannedSession: planned,
      recentLoad: recentLoad,
      goalContext: { daysToEvent: (typeof root.daysTo === 'function' && typeof root.RACE !== 'undefined' && root.RACE && root.RACE.date) ? root.daysTo(root.RACE.date) : null },
      availabilityToday: (function () {
        try {
          var cfg = O.profileModel && O.profileModel.effectiveTrainingConfig ? O.profileModel.effectiveTrainingConfig(PROFILE) : null;
          if (!cfg || !cfg.availableDayIdx || !cfg.availableDayIdx.length) return null;
          var wd2 = (new Date().getDay() + 6) % 7;
          return cfg.availableDayIdx.indexOf(wd2) >= 0;
        } catch (e3) { return null; }
      })(),
      _shadowMissing: missing
    };
    return input;
  }

  /* Ein Shadow-Lauf: v1 lesen, v2 rechnen, Tages-Eintrag schreiben (ersetzt Vorlauf desselben Tages). */
  function run() {
    try {
      if (!O.decisionEngineV2 || typeof O.decisionEngineV2.evaluate !== 'function') return null;
      var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
      if (!today) return null;
      var v1 = null;
      try { if (typeof root.currentDecision === 'function') v1 = root.currentDecision(); } catch (e) {}
      var input = buildInput();
      var v2 = O.decisionEngineV2.evaluate(input);
      var entry = {
        date: today, ts: Date.now(),
        v1: v1 ? { state: v1.state || v1.dayState || null, action: v1.todayAction || null, score: v1.score != null ? v1.score : null } : null,
        v2: { state: v2.dayState || null, action: v2.action || null, confidence: v2.confidence || null, reasons: (v2.reasons || []).slice(0, 4) },
        agree: (v1 && v1.state && v2.dayState) ? (v1.state === v2.dayState) : null,
        missing: (input._shadowMissing || []).concat(v2.missingData || []).slice(0, 6)
      };
      var log = _readLog().filter(function (x) { return x && x.date !== today; });
      log.push(entry);
      _writeLog(log);
      return entry;
    } catch (e) {
      try { console.warn('[ORVIA shadow] Lauf fehlgeschlagen (steuert nichts):', e && e.message); } catch (_) {}
      return null;
    }
  }

  /* Gate-Report (ENGINE-V2-DESIGN §5): Tage, Übereinstimmung, Abweichungsliste. */
  function report() {
    var log = _readLog();
    var withBoth = log.filter(function (x) { return x && x.agree !== null; });
    var agrees = withBoth.filter(function (x) { return x.agree; }).length;
    return {
      days: log.length,
      comparableDays: withBoth.length,
      agreementRate: withBoth.length ? Math.round((agrees / withBoth.length) * 100) : null,
      gateReady: withBoth.length >= 14,
      diffs: withBoth.filter(function (x) { return !x.agree; }).map(function (x) {
        return { date: x.date, v1: x.v1 && x.v1.state, v2: x.v2 && x.v2.state, v2reasons: x.v2 && x.v2.reasons };
      })
    };
  }

  function clearLog() { try { if (root.localStorage) root.localStorage.removeItem(_key()); } catch (e) {} }

  O.engineShadow = { run: run, report: report, buildInput: buildInput, clearLog: clearLog, _key: _key };
})(typeof globalThis !== 'undefined' ? globalThis : this);
