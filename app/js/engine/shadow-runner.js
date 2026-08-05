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
   PHASE 8 (2026-07-18): der v2-Input wird nicht mehr hier ad-hoc gebaut,
   sondern zentral vom TrainingInputResolver (training-input-resolver.js) —
   inkl. der Vertrags-Fixes (soreness statt doms, rhrBaseline+Days statt
   restingHrBaseline, hrvBaselineLn/hrvSd28/hrvBaselineDays statt
   hrvBaselineLn7, safetyFlags als Objekt statt Array, kein Phantom m.pain)
   und des Garmin-Metric-Store-Fallbacks für objektive Werte.
   Debug: ORVIA.engineShadow.report() in der Konsole.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};

  /* P0-Befund 2026-08-05: `let DB` (data.js) erzeugt KEINE window-Eigenschaft.
     Identisches Muster wie training-input-resolver._globalDB / quick-actions GM7.9j. */
  function _globalDB() {
    if (typeof root.DB !== 'undefined' && root.DB) return root.DB;
    try { if (typeof DB !== 'undefined' && DB) return DB; } catch (e) {}
    return null;
  }

  function _uid() { return (O.user && O.user.id) || 'anon'; }
  function _key() { return 'orvia_engine_shadow_' + _uid(); }
  function _readLog() {
    try { var raw = root.localStorage && root.localStorage.getItem(_key()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function _writeLog(a) { try { if (root.localStorage) root.localStorage.setItem(_key(), JSON.stringify(a.slice(-90))); } catch (e) {} }

  /* v1-Welt → v2-Input: delegiert an den TrainingInputResolver (Phase 8,
     EINE Input-Logik). Batch 0 — FAIL CLOSED: Ohne Resolver (Ladefehler)
     wird KEIN Ersatz-Input gebaut. Der frühere leere Fallback setzte
     illness:false/safetyFlags:{} und verwandelte damit Krankheit/Red Flags
     in ein scheinbar sicheres GREEN (Regression S6–S8). Ein fehlendes
     Sicherheits-Eingangsmodul darf nie eine optimistische Bewertung
     erzeugen ⇒ buildInput() liefert null, run() protokolliert BLOCKED. */
  function buildInput() {
    if (O.trainingInputResolver && typeof O.trainingInputResolver.collect === 'function') {
      return O.trainingInputResolver.collect();
    }
    return null;
  }

  /* Ein Shadow-Lauf: v1 lesen, v2 rechnen, Tages-Eintrag schreiben (ersetzt Vorlauf
     desselben Tages).

     PHASE 8 (2026-08-05) — zum Planpunkt „Vor der Aktivierung zu beheben:
     shadow-runner feuert bei jedem Öffnen des Heute-Tabs und rechnet die volle
     28-Tage-Schleife neu". BEWUSST NICHT gecacht. Begründung, nachmessbar:

     1) GEMESSEN (Chromium, 122 Tage Check-ins + Aktivitäten): buildInput() kostet
        0,52 ms, ein kompletter run() 2,8 ms. Der Planpunkt beschreibt eine
        vermutete, keine reale Last.
     2) Ein Cache braucht eine Invalidierung. Der Resolver liest DB, PROFILE, RACE,
        _metricsResolved, activeWeekPlan, Calc, readinessOf, recoveryCtx — jede
        selbst gebaute Eingangssignatur muss ALLE davon treffen. Ein erster Versuch
        (v1-State + Aktivitätenzahl) hat genau das verfehlt: eine Krankmeldung im
        Check-in ändert den v1-Stub nicht, der Cache lieferte weiter GREEN und
        verletzte die Invariante „Krankheit ⇒ nie GREEN" (engine_program_e S6).
     3) Das ist kein gewöhnlicher Cache-Fehler: dieser Log IST die Beweisgrundlage
        des Shadow-Gates. Ein veralteter Eintrag verfälscht die Gate-Messung in
        sicherheitsrelevanter Richtung.

     0,5 ms gegen die Frische der Gate-Belege zu tauschen ist der falsche Handel.
     Sollte die Last je real werden, gehört sie in den Resolver (eine gemeinsame
     Lastserie für alle Leser), nicht in eine Sonder-Invalidierung hier. */
  function run() {
    var P = O.perf || { now: function () { return Date.now(); }, mark: function () {} };
    var _t0 = P.now();
    try {
      if (!O.decisionEngineV2 || typeof O.decisionEngineV2.evaluate !== 'function') return null;
      var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
      if (!today) return null;
      var v1 = null;
      try { if (typeof root.currentDecision === 'function') v1 = root.currentDecision(); } catch (e) {}
      var _ti = P.now();
      var input = buildInput();
      P.mark('engineShadow.run: buildInput (incl. own 28d load loop)', _ti);
      var entry;
      if (input === null) {
        /* Batch 0 — FAIL CLOSED: Resolver fehlt ⇒ keine v2-Bewertung, ehrlicher
           BLOCKED-Eintrag (state null, nicht vergleichbar). Niemals GREEN raten. */
        entry = {
          date: today, ts: Date.now(),
          v1: v1 ? { state: v1.state || v1.dayState || null, action: v1.todayAction || null, score: v1.score != null ? v1.score : null } : null,
          v2: { state: null, action: null, confidence: null, blocked: 'training_input_resolver_missing', reasons: [] },
          agree: null,
          missing: ['training_input_resolver_missing']
        };
      } else {
      var v2 = O.decisionEngineV2.evaluate(input);
      entry = {
        date: today, ts: Date.now(),
        v1: v1 ? { state: v1.state || v1.dayState || null, action: v1.todayAction || null, score: v1.score != null ? v1.score : null } : null,
        v2: { state: v2.dayState || null, action: v2.action || null, confidence: v2.confidence || null, reasons: (v2.reasons || []).slice(0, 4) },
        agree: (v1 && v1.state && v2.dayState) ? (v1.state === v2.dayState) : null,
        missing: (input._shadowMissing || []).concat(v2.missingData || []).slice(0, 6)
      };
      }
      var _tlog = P.now();
      var log = _readLog().filter(function (x) { return x && x.date !== today; });
      log.push(entry);
      _writeLog(log);
      P.mark('engineShadow.run: read+write shadow log (JSON.parse/stringify, every call)', _tlog);
      /* Phase 7→8: Wochen-Shadow im selben Takt (intern max. 1×/Tag, gekapselt). */
      try { runWeekShadow(); } catch (eW) {}
      P.mark('engineShadow.run: TOTAL', _t0);
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
      blockedDays: log.filter(function (x) { return x && x.v2 && x.v2.blocked; }).length,
      agreementRate: withBoth.length ? Math.round((agrees / withBoth.length) * 100) : null,
      gateReady: withBoth.length >= 14,
      diffs: withBoth.filter(function (x) { return !x.agree; }).map(function (x) {
        return { date: x.date, v1: x.v1 && x.v1.state, v2: x.v2 && x.v2.state, v2reasons: x.v2 && x.v2.reasons };
      })
    };
  }

  function clearLog() { try { if (root.localStorage) root.localStorage.removeItem(_key()); } catch (e) {} }

  /* ============================================================
     Phase 7→8 (2026-08-05): scheduler-v2 WOCHEN-SHADOW.
     v2 plant bei jedem Shadow-Lauf (max. 1×/Tag) still die aktuelle Woche aus
     ECHTEN Daten: Verfügbarkeit (profileModel.normalizeAvailability), Kapazität
     (capacityAdapter über die kanonische Lastserie), Sportarten (Registry-Mapping).
     STEUERT NICHTS — Protokoll nur lokal (orvia_scheduler_shadow_<uid>, Ringpuffer
     12 Wochen, je Woche der letzte Tageslauf). Evidenz: bewusst KEINE Pace-Evidenz
     übergeben, solange kein kanonischer Schwellen-Vertrag existiert ⇒ v2 plant
     RPE-geführt (RUN-INT-001-konform), Flag no_pace_evidence_shadow.
     Primär-Sport-Heuristik (nur Shadow, dokumentiert): 'running' falls vorhanden,
     sonst erste Sportart — Flag shadow_primary_heuristic. ============================================================ */
  function _wkey() { return 'orvia_scheduler_shadow_' + _uid(); }
  function _readWLog() { try { var raw = root.localStorage && root.localStorage.getItem(_wkey()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function _writeWLog(a) { try { if (root.localStorage) root.localStorage.setItem(_wkey(), JSON.stringify(a.slice(-12))); } catch (e) {} }

  /* Erzeugt die Belege für Shadow-Gate S3/S4/S5 aus EINEM echten Snapshot.
     S3 Determinismus: derselbe Input ein zweites Mal durch buildWeek, Ergebnis
        byte-verglichen. Nur der ECHTE Snapshot ist hier aussagekräftig — ein
        Testfixture beweist nicht, dass die Produktionsdaten deterministisch sind.
     S4 Gültigkeit: JEDE erzeugte Prescription gegen den normativen Validator
        (prescription-factory.validateWorkout), nicht gegen eine zweite Meinung.
     S5 Provenienz: alle fünf Pflichtfelder je Session (Vision §17 / Vertrag 7).
     Kosten: ein zusätzlicher buildWeek-Lauf pro TAG (pure Rechnung, kein I/O). */
  var PROV_REQUIRED = ['scheduler', 'policy', 'solver', 'factory', 'templateId'];
  function _gateEvidence(SV2, input, res) {
    try {
      if (!res || !res.ok) return { deterministic: null, invalidSessions: null, provenanceComplete: null, note: 'week_blocked' };
      var again = SV2.buildWeek(input);
      var deterministic = JSON.stringify(again) === JSON.stringify(res);
      var PF = O.prescriptionFactory;
      var invalid = 0, codes = [], provMissing = {};
      res.sessions.forEach(function (s) {
        if (PF && typeof PF.validateWorkout === 'function') {
          var errs = PF.validateWorkout(s.prescription) || [];
          if (errs.length) { invalid++; errs.slice(0, 2).forEach(function (e) { var c = (e && e.code) || String(e); if (codes.indexOf(c) < 0) codes.push(c); }); }
        }
        var p = s.provenance || {};
        PROV_REQUIRED.forEach(function (k) { if (!p[k]) provMissing[k] = 1; });
      });
      /* Ohne Validator KEIN „0 ungültig" behaupten — das wäre eine erfundene Zusicherung. */
      var validatorRan = !!(PF && typeof PF.validateWorkout === 'function');
      var missingKeys = Object.keys(provMissing).sort();
      return { deterministic: deterministic,
        invalidSessions: validatorRan ? invalid : null,
        invalidCodes: validatorRan ? codes.slice(0, 5) : null,
        validator: validatorRan ? 'prescription-factory.validateWorkout' : null,
        provenanceComplete: res.sessions.length === 0 ? true : missingKeys.length === 0,
        provenanceMissing: missingKeys,
        sessionsChecked: res.sessions.length };
    } catch (e) {
      return { deterministic: null, invalidSessions: null, provenanceComplete: null, note: 'gate_evidence_failed' };
    }
  }

  function runWeekShadow() {
    try {
      var SV2 = O.schedulerV2, CA = O.capacityAdapter, PD = O.planDomain, PM = O.profileModel;
      var TL = O.repos && O.repos.trainingLoad;
      if (!SV2 || !CA || !PD || !PM || typeof root.todayStr !== 'function') return null;
      var today = root.todayStr();
      var weekKey = PD.weekKeyFor(today);
      var log = _readWLog();
      var existing = log.filter(function (x) { return x && x.weekKey === weekKey; })[0];
      if (existing && existing.day === today) return existing;                     // max. 1 Lauf/Tag
      var P = (typeof root.PROFILE !== 'undefined' && root.PROFILE) || {};
      var mapSport = TL ? function (s) { return TL.canonicalSportOf(s); } : function (s) { return String(s || 'unknown').toLowerCase(); };
      var flags = ['no_pace_evidence_shadow'];
      /* Sportarten aus dem Profil (Registry-Mapping), dedupliziert + sortiert (deterministisch). */
      var seen = {}, sports = [];
      (Array.isArray(P.sports) ? P.sports : []).forEach(function (s) { var c = mapSport(s); if (c && c !== 'unknown' && !seen[c]) { seen[c] = 1; sports.push(c); } });
      sports.sort();
      var primary = sports.indexOf('running') >= 0 ? 'running' : sports[0];
      if (primary && primary !== 'running') flags.push('shadow_primary_heuristic');
      var sportList = sports.map(function (c) { return { sportId: c, role: c === primary ? 'primary' : 'secondary' }; });
      /* Kapazität aus der kanonischen Lastserie (S3) — echte Aktivitäten + Legacy-Sessions. */
      var acts = [];
      try { if (O.activityStore && O.activityStore.listActivities) acts = O.activityStore.listActivities(); } catch (e2) {}
      var tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e3) {}
      var capR = CA.buildPerSport(acts, { today: today, timezone: tz || 'UTC',
        /* Gleiche let-Bindungs-Falle wie im Resolver (P0-Befund 2026-08-05):
           `let DB` liegt nicht auf window ⇒ root.DB war immer {} und die
           Legacy-Sessions fehlten in der Kapazität. */
        sessionsByDay: _globalDB() || {}, mapSport: mapSport,
        isTombstoned: (O.activityStore && O.activityStore.isTombstoned) ? O.activityStore.isTombstoned : undefined });
      var availability = null;
      try { availability = PM.normalizeAvailability(P.availability); } catch (e4) {}
      var svInput = { activationMode: 'shadow_only', weekKey: weekKey, sports: sportList,
        availability: availability, capacityPerSport: capR && capR.ok ? capR.perSport : null, evidence: null };
      var res = SV2.buildWeek(svInput);
      /* PHASE 8 (2026-08-05): GATE-BELEGE mitschreiben.
         Befund vor dieser Änderung: der Wochen-Eintrag enthielt nur Zählwerte
         (sessions/unplaced/conflicts). Damit sind DREI der fünf Shadow-Gate-
         Kriterien aus UMSETZUNGSPLAN §Phase 8 gar nicht messbar — S3
         (Determinismus), S4 (gültige Sessions) und S5 (Provenienz). Der Nutzer
         hätte 14 Tage gesammelt und das Gate trotzdem nicht schließen können.
         Die Belege werden deshalb HIER erzeugt, wo der echte Snapshot vorliegt —
         genau einmal pro Tag, nicht bei jedem Tab-Öffnen. */
      var gate = _gateEvidence(SV2, svInput, res);
      /* Vergleichsbasis: Sessionzahl des aktiven (Legacy-)Plans derselben Woche. */
      var liveCount = null;
      try { var wp = (typeof root.activeWeekPlan === 'function') ? root.activeWeekPlan() : null;
        if (Array.isArray(wp)) liveCount = wp.reduce(function (n, d) { return n + (Array.isArray(d) ? d.length : 0); }, 0); } catch (e5) {}
      var entry = { weekKey: weekKey, day: today, ts: Date.now(),
        ok: !!res.ok, error: res.ok ? null : (res.error && res.error.code),
        sessions: res.ok ? res.sessions.length : null,
        byDay: res.ok ? res.sessions.map(function (s) { return s.weekday + ':' + s.provenance.templateId; }).sort() : null,
        unplaced: res.ok ? res.unplaced.length : null,
        conflicts: res.ok ? res.conflicts.length : null,
        blockedPrescriptions: res.ok ? res.blockedPrescriptions.length : null,
        flags: flags.concat(res.ok ? res.flags : []).slice(0, 8),
        liveSessions: liveCount, scheduler: res.ok ? res.provenance.scheduler : null,
        gate: gate };
      log = log.filter(function (x) { return x && x.weekKey !== weekKey; });
      log.push(entry); _writeWLog(log);
      return entry;
    } catch (e) {
      try { console.warn('[ORVIA scheduler-shadow] Lauf fehlgeschlagen (steuert nichts):', e && e.message); } catch (_) {}
      return null;
    }
  }
  /* Wochen-Gate-Report (Phase 8): geplante Wochen, Fehler-/Konfliktlage, Vergleich. */
  function weekReport() {
    var log = _readWLog();
    var okW = log.filter(function (x) { return x && x.ok; });
    return { weeks: log.length, okWeeks: okW.length,
      blockedWeeks: log.filter(function (x) { return x && !x.ok; }).map(function (x) { return { weekKey: x.weekKey, error: x.error }; }),
      totalUnplaced: okW.reduce(function (n, x) { return n + (x.unplaced || 0); }, 0),
      totalConflicts: okW.reduce(function (n, x) { return n + (x.conflicts || 0); }, 0),
      gateReady: okW.length >= 2 && okW.every(function (x) { return (x.blockedPrescriptions || 0) === 0; }),
      entries: log };
  }
  function clearWeekLog() { try { if (root.localStorage) root.localStorage.removeItem(_wkey()); } catch (e) {} }

  /* PHASE 8: der eine Aufruf, der die Gate-Frage beantwortet.
     Führt beide lokalen Protokolle im reinen Auswerter zusammen (shadow-eval).
     Konsole: ORVIA.engineShadow.gateReport() */
  function gateReport(opts) {
    if (!O.shadowEval || typeof O.shadowEval.evaluate !== 'function') {
      return { gateReady: false, error: 'shadow_eval_missing' };     // fail-closed: nie „bereit" ohne Auswerter
    }
    var o = opts || {};
    return O.shadowEval.evaluate({ dailyLog: _readLog(), weeklyLog: _readWLog(),
      minComparableDays: o.minComparableDays, minOkWeeks: o.minOkWeeks });
  }

  O.engineShadow = { run: run, report: report, buildInput: buildInput, clearLog: clearLog, _key: _key,
    runWeekShadow: runWeekShadow, weekReport: weekReport, clearWeekLog: clearWeekLog, _wkey: _wkey,
    gateReport: gateReport };
})(typeof globalThis !== 'undefined' ? globalThis : this);
