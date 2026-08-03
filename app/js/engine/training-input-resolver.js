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
    { key: 'sleepMin', kind: 'sleep', min: 180, max: 720, metricId: 'sleep_duration_min', autoMaxAgeDays: 0, autoUnit: 'sleep' },
    { key: 'rhr', kind: 'number', metricId: 'resting_hr', autoMaxAgeDays: 0, autoUnit: 'bpm' },
    { key: 'hrvMs', kind: 'number', metricId: 'hrv_ms', autoMaxAgeDays: 0, autoUnit: 'ms' },
    { key: 'hrv', kind: 'chipsText', metricId: 'hrv_status', autoMaxAgeDays: 0, autoUnit: 'text' },
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

  /* Kanonische Red-Flag-Codes (identisch mit calc.js safetyCheck und
     decision-engine-v2 Safety-Gate — EINE Namenswelt, Batch 0). */
  var RED_FLAG_KEYS = ['fever', 'chestPain', 'shortnessOfBreath', 'dizziness', 'neurologicalSymptoms', 'accidentPain', 'swelling', 'instability'];

  /* PURE · Batch 0: safetyFlags aus dem Morgen-Check-in. Quelle ist das
     kanonische morning.redFlags-Objekt (Check-in-Chips, checkin-fields.js);
     direkte Felder (m.fever …) bleiben als Legacy-/Import-Fallback lesbar.
     Sparse: nur tatsächlich gemeldete Flags (true) — nichts wird erfunden. */
  function safetyFlagsFrom(morning) {
    var m = morning || {};
    var rf = (m.redFlags && typeof m.redFlags === 'object') ? m.redFlags : {};
    var out = {};
    RED_FLAG_KEYS.forEach(function (k) {
      if (rf[k] === true || m[k] === true) out[k] = true;
    });
    return out;
  }

  /* PURE · v2-Decision-Input (safetyFlags als Objekt, illness aus dem
     kanonischen Feld mit ill-Alias — Phase-6-Vorbedingung (a)).
     Batch 0: safetyFlags wird jetzt real aus dem Check-in befüllt —
     vorher hart {} (toter Safety-Pfad, ENGINE-CONTRACT-AUDIT Befund 4). */
  function buildDecisionInput(opts) {
    opts = opts || {};
    var m = opts.morning || null;
    return {
      readiness: opts.readiness || { score: null, confidence: 'low', warnings: [], missingData: [] },
      safetyFlags: safetyFlagsFrom(m),
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

  /* ============================================================
     Batch 1 (2026-07-18) · EngineInputSnapshot — EINE versionierte,
     pure Input-Pipeline (Prompt §5). Aufbau:
       collectRaw()      — EINZIGER Globals-Leser (DB, PROFILE, recoveryCtx, …)
       buildSnapshot()   — PURE: rohe Teile → kanonischer Snapshot
       readinessInputFromSnapshot / decisionInputFromSnapshot — PURE Adapter
       collect()         — unveränderter Alt-Vertrag (v2-Decision-Input),
                           intern jetzt Snapshot-basiert.
     Regeln: nichts erfinden (fehlend ⇒ null + dataQuality.missing mit
     fachlicher Missingness-Art), Provenienz je automatisch verwendetem Wert,
     deterministisch bei gleichem raw (now/timezone werden INJIZIERT),
     nicht-mutierend (Eingaben werden kopiert).
     Bekannte, dokumentierte Grenzen v1 des Snapshots:
     - loadHistory stammt weiter aus lokalen Legacy-Sessions (source-Feld
       benennt das ehrlich); kanonische Activities sind Batch 2.
     - capacity/planHistory/outcomeHistory sind noch nicht aufgebaut
       (Batch 3/7) und stehen als not_supported in dataQuality.
     - Einheiten: Bestandsfelder behalten ihre dokumentierten Einheiten
       (sleepMin = Minuten, Distanzen km in Legacy-Sessions); der Snapshot
       macht die Einheit je Feld in UNITS explizit, statt still zu mischen.
     ============================================================ */
  var SNAPSHOT_SCHEMA_VERSION = 1;
  var MISSING_KINDS = ['not_captured', 'stale', 'not_supported', 'conflict', 'insufficient_history', 'module_missing', 'error'];
  /* Batch 2d: acute7/chronic28 sind eine MISCHUNG aus gemessener sRPE-Last und
     Dauer×Default-Schätzung ⇒ ehrliche Einheit orvia_load_au (Methodenanteil
     steht in recentLoad.quality); reine srpe_au gibt es nur je Beitrag. */
  var UNITS = { sleepMin: 'min', rhr: 'bpm', hrvMs: 'ms', hrv: 'text', bb: '%', sleepQ: 'score1_10', feel: 'score1_10', soreness: 'score0_10', stress: 'category', acute7: 'orvia_load_au', chronic28PerWeek: 'orvia_load_au_per_week' };

  function _copyArr(a) { return Array.isArray(a) ? a.map(function (x) { return x && typeof x === 'object' ? Object.assign({}, x) : x; }) : null; }

  /* PURE · rohe, bereits gelesene Teile → kanonischer Snapshot. raw:
     { now, timezone, today, morning, autoMap, ctx, sleepGoalHours,
       sports, goals, constraints, preferences, equipment,
       availability { availableToday, availableDayIdx, targetDays, source },
       fixedCommitments, plannedSession, recentLoad{ …, source },
       goalDaysToEvent, collectErrors[] } */
  function buildSnapshot(raw) {
    raw = raw || {};
    var missing = [];
    function miss(path, kind) { missing.push({ path: path, kind: kind }); }
    var m = raw.morning || null;
    if (!m) miss('checkin.morning', 'not_captured');
    if (!raw.autoMap) miss('metrics.store_stash', raw.autoMapStale ? 'stale' : 'not_captured');
    var obj = mergeObjective(m, raw.autoMap);
    // Provenienz: je Wert Quelle + (falls Metric Store) Mess-/Metrikzeitpunkt.
    var provenance = {};
    OBJECTIVE_FIELDS.forEach(function (f) {
      var src = obj.provenance[f.key];
      if (src == null) { provenance[f.key] = null; miss('metrics.' + f.key, 'not_captured'); return; }
      var p = { source: src, unit: UNITS[f.key] || null };
      if (src === 'metric_store' && raw.autoMap && raw.autoMap[f.key]) {
        p.metricDate = raw.autoMap[f.key].metricDate || null;
        p.measuredAt = raw.autoMap[f.key].measuredAt || null;
      }
      provenance[f.key] = p;
    });
    ['sleepQ', 'feel', 'stress'].forEach(function (k) {
      provenance[k] = (m && m[k] != null && m[k] !== '') ? { source: 'checkin', unit: UNITS[k] } : null;
    });
    provenance.soreness = (m && m.doms != null) ? { source: 'checkin', unit: UNITS.soreness } : null;
    var ctx = raw.ctx || null;
    var recovery = null;
    if (ctx) {
      recovery = {
        rhrBaseline: ctx.rhrBase != null ? ctx.rhrBase : null,
        rhrBaselineDays: ctx.rhrN != null ? ctx.rhrN : 0,
        hrvBaselineLn: ctx.hrvBase7 != null ? ctx.hrvBase7 : null,
        hrvSd28: ctx.hrvSd28 != null ? ctx.hrvSd28 : null,
        hrvBaselineDays: ctx.hrvN != null ? ctx.hrvN : 0,
        sleepDebtH: ctx.sleepDebtH != null ? ctx.sleepDebtH : null
      };
      if (recovery.rhrBaseline == null) miss('recovery.rhrBaseline', 'insufficient_history');
      if (recovery.hrvBaselineLn == null) miss('recovery.hrvBaseline', 'insufficient_history');
    } else miss('recovery.baselines', 'module_missing');
    var load = raw.recentLoad || null;
    if (!load) miss('loadHistory.recent', 'error');
    else if (load.dataDays != null && load.dataDays < 7) miss('loadHistory.recent', 'insufficient_history');
    /* Batch 2c/2d: geringe Last-Qualität fachlich ausweisen — maßgeblich ist
       die kombinierte ratioConfidence (beide Quotienten-Fenster). */
    var _rc = load && (load.ratioConfidence != null ? load.ratioConfidence : load.loadConfidence);
    if (load && _rc === 'low') {
      var _amb = (load.quality && ((load.quality.acute7 && load.quality.acute7.ambiguousUnits) || (load.quality.chronic28 && load.quality.chronic28.ambiguousUnits))) || load.ambiguousUnits;
      miss('loadHistory.quality', _amb > 0 ? 'conflict' : 'insufficient_history');
    }
    (raw.collectErrors || []).forEach(function (p) { miss(p, 'error'); });
    // Zukunftssektionen ehrlich als nicht aufgebaut markieren (kein Raten):
    miss('activities', 'not_supported'); miss('capacity', 'not_supported');
    miss('planHistory', 'not_supported'); miss('outcomeHistory', 'not_supported');
    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      now: raw.now != null ? raw.now : null,
      timezone: raw.timezone || null,
      today: raw.today || null,
      athlete: { sleepGoalHours: raw.sleepGoalHours != null ? raw.sleepGoalHours : null },
      goals: _copyArr(raw.goals),
      sports: _copyArr(raw.sports),
      availability: raw.availability ? Object.assign({}, raw.availability) : null,
      fixedCommitments: _copyArr(raw.fixedCommitments),
      constraints: _copyArr(raw.constraints) || [],
      preferences: raw.preferences ? Object.assign({}, raw.preferences) : null,
      equipment: raw.equipment ? Object.assign({}, raw.equipment) : null,
      recovery: recovery,
      currentMetrics: {
        values: {
          sleepMin: obj.values.sleepMin, rhr: obj.values.rhr, hrvMs: obj.values.hrvMs,
          hrv: obj.values.hrv, bb: obj.values.bb,
          sleepQ: m && m.sleepQ != null ? m.sleepQ : null,
          feel: m && m.feel != null ? m.feel : null,
          soreness: m && m.doms != null ? m.doms : null,
          stress: (m && m.stress) || null
        },
        units: UNITS
      },
      safety: { flags: safetyFlagsFrom(m), illness: !!(m && (m.illness != null ? m.illness : m.ill)) },
      plannedSession: raw.plannedSession ? Object.assign({}, raw.plannedSession) : null,
      activities: null,
      loadHistory: load ? Object.assign({ source: 'legacy_sessions' }, load) : null,
      capacity: null,
      planHistory: null,
      outcomeHistory: null,
      goalContext: { daysToEvent: raw.goalDaysToEvent != null ? raw.goalDaysToEvent : null },
      dataQuality: { missing: missing },
      provenance: provenance
    };
  }

  /* PURE · Snapshot → exakter v2-Readiness-Input (Feldnamen readiness-engine-v2). */
  function readinessInputFromSnapshot(snap) {
    snap = snap || {};
    var v = (snap.currentMetrics && snap.currentMetrics.values) || {};
    var rec = snap.recovery || {};
    var prov = {};
    OBJECTIVE_FIELDS.forEach(function (f) { var p = snap.provenance && snap.provenance[f.key]; prov[f.key] = p ? p.source : null; });
    return {
      sleepMinutes: v.sleepMin != null ? v.sleepMin : null,
      sleepGoalHours: snap.athlete && snap.athlete.sleepGoalHours != null ? snap.athlete.sleepGoalHours : null,
      sleepQuality: v.sleepQ != null ? v.sleepQ : null,
      feel: v.feel != null ? v.feel : null,
      soreness: v.soreness != null ? v.soreness : null,
      stress: v.stress || null,
      restingHr: v.rhr != null ? v.rhr : null,
      rhrBaseline: rec.rhrBaseline != null ? rec.rhrBaseline : null,
      rhrBaselineDays: rec.rhrBaselineDays != null ? rec.rhrBaselineDays : 0,
      hrvMs: v.hrvMs != null ? v.hrvMs : null,
      hrvStatus: v.hrv || null,
      hrvBaselineLn: rec.hrvBaselineLn != null ? rec.hrvBaselineLn : null,
      hrvSd28: rec.hrvSd28 != null ? rec.hrvSd28 : null,
      hrvBaselineDays: rec.hrvBaselineDays != null ? rec.hrvBaselineDays : 0,
      bodyBattery: v.bb != null ? v.bb : null,
      _provenance: prov
    };
  }

  /* PURE · Snapshot (+ bewertete Readiness) → exakter v2-Decision-Input. */
  function decisionInputFromSnapshot(snap, readiness) {
    snap = snap || {};
    var avail = snap.availability || null;
    return {
      readiness: readiness || { score: null, confidence: 'low', warnings: [], missingData: [] },
      safetyFlags: (snap.safety && snap.safety.flags) || {},
      illness: !!(snap.safety && snap.safety.illness),
      constraints: Array.isArray(snap.constraints) ? snap.constraints : [],
      plannedSession: snap.plannedSession || null,
      recentLoad: snap.loadHistory || { acute7: null, chronic28PerWeek: null, dataDays: 0, hardYesterday: false, hardStreak: 0 },
      goalContext: snap.goalContext || { daysToEvent: null },
      availabilityToday: (avail && avail.availableToday != null) ? avail.availableToday : null
    };
  }

  /* I/O · EINZIGER Globals-Leser: liest DB/PROFILE/recoveryCtx/Plan/Stash und
     liefert das rohe raw-Objekt für buildSnapshot (Logik aus dem alten collect). */
  function collectRaw() {
    var errors = [];
    var today = (typeof root.todayStr === 'function') ? root.todayStr() : null;
    var e = (today && typeof root.DB !== 'undefined' && root.DB) ? (root.DB[today] || {}) : {};
    var m = e.morning || null;
    var autoMap = today ? autoMapFromStash(today) : null;
    var ctx = null;
    try { if (typeof root.recoveryCtx === 'function' && today) ctx = root.recoveryCtx(today); } catch (e5) { errors.push('recovery.ctx'); }
    var sleepGoalH = null;
    try { if (O.profileStore && O.profileStore.effectiveSleepGoal) sleepGoalH = O.profileStore.effectiveSleepGoal() || null; } catch (e4) {}
    var P = (typeof root.PROFILE !== 'undefined' && root.PROFILE) ? root.PROFILE : null;

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
    } catch (err) { errors.push('plannedSession'); }

    /* Belastung 7/28 Tage — Batch 2a: KANONISCH aus Activity Store +
       deduplizierten Legacy-Sessions (activityConfig.dailyLoadUnits, eine
       Lastwahrheit, kein Doppelzählen; server-gepullte Garmin-Aktivitäten
       fließen damit erstmals in die Engine-Last ein). Ist der kanonische
       Pfad nicht verfügbar, rechnet der bisherige Legacy-Pfad weiter —
       NICHT still: recentLoad.source benennt die tatsächliche Quelle. */
    var recentLoad = null;
    var tz = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e6) {}
    try {
      var AC = O.activityConfig, AS = O.activityStore;
      var canonical = !!(AC && typeof AC.dailyLoadUnits === 'function' && AS && typeof AS.listActivities === 'function');
      var actsByDay = {};
      if (canonical) {
        AS.listActivities().forEach(function (a) {
          if (AS.isTombstoned && AS.isTombstoned(a)) return;
          /* Batch 2c: Tageszuordnung über die LOKALE Zeitzone (injiziert),
             nicht über das UTC-Präfix — 22:30Z ist in Wien der Folgetag. */
          var d = AC.dayOfActLocal ? AC.dayOfActLocal(a, tz) : ((a && a.startedAt) ? a.startedAt.slice(0, 10) : null);
          if (d) (actsByDay[d] = actsByDay[d] || []).push(a);
        });
      }
      var hasDB = typeof root.DB !== 'undefined' && root.DB;
      var legacyOk = hasDB && root.Calc && root.Calc.sessionLoad;
      if ((canonical || legacyOk) && typeof root.todayStr === 'function') {
        var acute = 0, chronic = 0, dataDays = 0;
        var hardByOffset = [];                                                       // Batch 2c: echte Tagesreihe
        // Batch 2d: Qualität GETRENNT je Fenster — der Quotient rechnet acute7
        // gegen die VOLLE chronic28-Basis; beide Seiten müssen belastbar sein.
        /* Batch 2e: DREI Fenster — acute7 (Tage 0–6), prior21 (Tage 7–27,
           die eigentliche Vorperiode) und chronic28 (volle Quotienten-Basis).
           activeLoadDays zählt Tage mit Last L>0 ODER mit mindestens einer
           unbekannten Load-Unit (siehe `active` unten); dataDays hingegen zählt
           NUR Tage mit L>0. Daher gilt stets dataDays ≤ activeLoadDays, und bei
           unbekannten Einheiten kann dataDays < activeLoadDays sein.
           historySpanDays = Spanne bis zum ältesten aktiven Tag. */
        var win = {
          acute7: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 },
          prior21: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 },
          chronic28: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 }
        };
        var oldestActiveOffset = -1;
        for (var i = 0; i < 28; i++) {
          var dte = new Date(); dte.setDate(dte.getDate() - i);
          var k = root.todayStr(dte);
          var L, hardDay = false;
          if (canonical) {
            var du = AC.dailyLoadUnits(actsByDay[k] || [], (hasDB && root.DB[k] && root.DB[k].sessions) || {});
            L = du.load;
            hardDay = du.units.some(function (u) { return u.hardDay; });
            var active = L > 0 || du.unknownUnits > 0;
            if (active) oldestActiveOffset = i;
            win.chronic28.measuredLoad += du.measuredLoad; win.chronic28.estimatedLoad += du.estimatedLoad;
            win.chronic28.unknownUnits += du.unknownUnits; win.chronic28.ambiguousUnits += du.ambiguousUnits;
            if (active) win.chronic28.activeLoadDays++;
            var w = i < 7 ? win.acute7 : win.prior21;
            w.measuredLoad += du.measuredLoad; w.estimatedLoad += du.estimatedLoad;
            w.unknownUnits += du.unknownUnits; w.ambiguousUnits += du.ambiguousUnits;
            if (active) w.activeLoadDays++;
          } else {
            L = root.Calc.sessionLoad(root.DB[k]);
            var sy = root.DB[k] && root.DB[k].sessions;
            // Legacy-Fallback (Batch 2c): Härte = notiertes RPE ≥ 7 oder langer LAUF
            // (dist ≥ 14 km nur für Laufen) — keine globale Distanzregel mehr.
            if (sy) Object.keys(sy).forEach(function (t) { if (t === '_ts') return; var x = sy[t]; if ((x.rpe || 0) >= 7 || (t === 'Laufen' && (x.dist || 0) >= 14)) hardDay = true; });
          }
          if (L > 0) dataDays++;
          if (i < 7) acute += L;
          chronic += L;
          hardByOffset[i] = hardDay;
        }
        // Batch 2c: hardStreak = tatsächlich AUFEINANDERFOLGENDE harte Tage bis gestern.
        var streak = 0;
        for (var s = 1; s < 28 && hardByOffset[s]; s++) streak++;
        /* Batch 2d: Fenster-Confidence (je Fenster identische Regel) und daraus
           die kombinierte ratioConfidence = MIN beider Fenster. NUR sie steuert
           die Ratio-Gates der Decision-Engine. Eine stark geschätzte chronische
           Basis kann damit nie mehr als „high" gelten, nur weil die letzte
           Woche gemessen war (und umgekehrt).
           legacy_sessions-Fallback: 'medium' (dokumentierte Übergangsstufe). */
        function winConf(w) {
          var tot = w.measuredLoad + w.estimatedLoad;
          var es = tot > 0 ? w.estimatedLoad / tot : 0;
          w.estimatedShare = Math.round(es * 100) / 100;
          if (w.ambiguousUnits > 0 || w.unknownUnits > 0 || es > 0.5) return 'low';
          if (es > 0.25) return 'medium';
          return 'high';
        }
        var quality = null, ratioConfidence;
        if (!canonical) ratioConfidence = 'medium';
        else {
          var ORDER = { high: 0, medium: 1, low: 2 };
          var ca = winConf(win.acute7), cp = winConf(win.prior21), cc = winConf(win.chronic28);
          ratioConfidence = [ca, cp, cc].reduce(function (worst, c) { return ORDER[c] > ORDER[worst] ? c : worst; }, 'high');
          /* Batch 2e: HISTORIENREIFE. Eine reine letzte Woche ohne ältere
             Historie ist KEINE chronische Basis — der Quotient wäre reine
             Selbstreferenz. Heuristik (versioniert): mindestens 4 aktive
             Lasttage in der Vorperiode (Tage 8–28) UND Historienspanne
             ≥ 14 Tage, sonst ratioConfidence 'low' + Reason-Code
             insufficient_chronic_history. */
          var historySpanDays = oldestActiveOffset >= 0 ? oldestActiveOffset + 1 : 0;
          var insufficientChronic = win.prior21.activeLoadDays < 4 || historySpanDays < 14;
          if (insufficientChronic) ratioConfidence = 'low';
          quality = {
            acute7: win.acute7, prior21: win.prior21, chronic28: win.chronic28,
            acuteConfidence: ca, priorConfidence: cp, chronicConfidence: cc,
            historySpanDays: historySpanDays,
            insufficientChronicHistory: insufficientChronic,
            ratioConfidence: ratioConfidence
          };
        }
        recentLoad = {
          acute7: Math.round(acute), chronic28PerWeek: Math.round(chronic / 4), dataDays: dataDays,
          loadUnit: canonical ? 'orvia_load_au' : 'srpe_au',                         // Batch 2d: ehrliche Mischeinheit
          hardYesterday: !!hardByOffset[1], hardStreak: streak,
          estimatedShare: canonical ? win.acute7.estimatedShare : null,
          unknownUnits: canonical ? win.acute7.unknownUnits : null,
          ambiguousUnits: canonical ? win.acute7.ambiguousUnits : null,
          quality: quality,
          ratioConfidence: ratioConfidence,
          loadConfidence: ratioConfidence,                                           // Alias (Abwärtskompatibilität Snapshot/Tests)
          source: canonical ? 'canonical_activities' : 'legacy_sessions'
        };
      } else errors.push('loadHistory.recent');
    } catch (err) { errors.push('loadHistory.recent'); }

    var availability = null;
    try {
      var cfg = O.profileModel && O.profileModel.effectiveTrainingConfig ? O.profileModel.effectiveTrainingConfig(P) : null;
      if (cfg && cfg.availableDayIdx && cfg.availableDayIdx.length) {
        var wd2 = (new Date().getDay() + 6) % 7;
        availability = {
          availableToday: cfg.availableDayIdx.indexOf(wd2) >= 0,
          availableDayIdx: cfg.availableDayIdx.slice(),
          targetDays: cfg.targetDays != null ? cfg.targetDays : null,
          source: cfg.daysSource || 'availability'
        };
      }
    } catch (e3) { errors.push('availability'); }

    return {
      now: Date.now(),
      timezone: tz,
      today: today,
      morning: m,
      autoMap: autoMap,
      autoMapStale: !!(root._metricsResolved && today && root._metricsResolved.date !== today),
      ctx: ctx,
      sleepGoalHours: sleepGoalH,
      sports: (P && Array.isArray(P.sports)) ? P.sports : null,
      goals: (P && Array.isArray(P.goals)) ? P.goals : null,
      constraints: (P && Array.isArray(P.constraintsList)) ? P.constraintsList : [],
      preferences: (P && P.trainingPreferences) || null,
      equipment: (P && P.equipment) || null,
      availability: availability,
      fixedCommitments: null,
      plannedSession: planned,
      recentLoad: recentLoad,
      goalDaysToEvent: (typeof root.daysTo === 'function' && typeof root.RACE !== 'undefined' && root.RACE && root.RACE.date) ? root.daysTo(root.RACE.date) : null,
      collectErrors: errors
    };
  }

  /* I/O · kanonischer Snapshot aus den App-Globals. */
  function collectSnapshot() { return buildSnapshot(collectRaw()); }

  /* I/O · kompletter v2-Decision-Input (UNVERÄNDERTER Alt-Vertrag inkl.
     _shadowMissing-Strings) — intern jetzt Snapshot + Adapter. */
  function collect() {
    var snap = collectSnapshot();
    var missing = [];
    var mp = {};
    (snap.dataQuality.missing || []).forEach(function (x) { mp[x.path] = x.kind; });
    if (mp['checkin.morning']) missing.push('morning_checkin');
    if (mp['metrics.store_stash']) missing.push('metric_store_stash');
    if (mp['loadHistory.recent'] === 'error') missing.push('load_error');
    else if (snap.loadHistory == null) missing.push('load_data');
    if (mp['plannedSession']) missing.push('planned_error');
    var readiness = { score: null, confidence: 'low', warnings: [], missingData: [] };
    try {
      // Alt-Vertrag: bewerten, sobald Check-in ODER frische Store-Werte existieren.
      var hasAnyInput = !mp['checkin.morning'] || !mp['metrics.store_stash'];
      if (O.readinessEngineV2 && typeof O.readinessEngineV2.evaluate === 'function' && hasAnyInput) {
        readiness = O.readinessEngineV2.evaluate(readinessInputFromSnapshot(snap)) || readiness;
      } else if (typeof root.readinessOf === 'function' && snap.today) {
        var sc = root.readinessOf(snap.today);
        readiness = { score: sc != null ? sc : null, confidence: 'low', warnings: [], missingData: ['v2_readiness_unavailable'] };
      }
    } catch (err) { missing.push('readiness_error'); }
    var input = decisionInputFromSnapshot(snap, readiness);
    input._shadowMissing = missing;
    input._snapshotVersion = snap.schemaVersion;
    return input;
  }

  var API = {
    OBJECTIVE_FIELDS: OBJECTIVE_FIELDS,
    RED_FLAG_KEYS: RED_FLAG_KEYS,
    SNAPSHOT_SCHEMA_VERSION: SNAPSHOT_SCHEMA_VERSION,
    MISSING_KINDS: MISSING_KINDS,
    UNITS: UNITS,
    safetyFlagsFrom: safetyFlagsFrom,
    mergeObjective: mergeObjective,
    buildReadinessInput: buildReadinessInput,
    buildDecisionInput: buildDecisionInput,
    buildSnapshot: buildSnapshot,
    readinessInputFromSnapshot: readinessInputFromSnapshot,
    decisionInputFromSnapshot: decisionInputFromSnapshot,
    autoMapFromStash: autoMapFromStash,
    collectRaw: collectRaw,
    collectSnapshot: collectSnapshot,
    collect: collect
  };

  O.trainingInputResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
