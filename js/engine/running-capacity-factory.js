/* ============================================================
   ORVIA · running-capacity-factory — Batch 3b.1 / Härtung 3b.1a (SHADOW-ONLY).

   Pure, deterministische Beschreibung des BEOBACHTBAREN Ist-Zustands der
   Lauf-Belastbarkeit. KEIN Trainingsplan, keine Wochen-/Pace-/Progressions-
   vorgabe, keine Zielmachbarkeit, keine Session-Erzeugung, keine UI, keine
   Produktionsentscheidung. Nicht in index.html/sw.js eingetragen.

   Reinheit (hart): kein DOM, kein localStorage, kein Netz, keine UI, KEINE
   eigene Zeitquelle innerhalb der Berechnung (nur snapshot.now/today werden
   ggf. übernommen). Nicht-mutierend; deterministisch/idempotent (gleicher
   Snapshot ⇒ byte-stabiles Ergebnis). Für JEDEN JSON-serialisierbaren Input
   gilt: deterministische Rückgabe, niemals Throw (Backstop + Vorabprüfungen).

   Wissenskonsum ausschließlich über knowledgeContracts.selectRules mit FEST
   im Consumer hinterlegten, UNABHÄNGIGEN Pins (nie zur Laufzeit aus Pack/
   Register zurückgelesen). Nur erfolgreich ausgewählte SHADOW-Regeln werden
   konsumiert; RUN-SAFE-001 und RUN-RTR-001 bleiben ausgeschlossen. Aus der
   Capacity darf niemals „safe"/„trainingsbereit"/„GREEN"/„Return-to-Run
   freigegeben" abgeleitet werden — die Batch-0-Safety-Pipeline bleibt
   unabhängig und darf nur verschärft, nie überschrieben werden.

   Fail-closed: Bei blockierter Wissensauswahl, unbekannter/ungültiger
   Snapshot-Schema-Version, ungültigen Zeit-/Strukturwerten oder fehlenden
   Eingaben ⇒ status 'blocked' bzw. 'unknown' — keine Schätzung, keine
   erfundene Basis, keine Empfehlung. Vertragsfehler ⇒ status 'blocked',
   capacity null und präziser Reason-Code.

   Zielwerte (Zielzeit/Zielpace/Zieldatum) sind KEINE Capacity-Eingänge und
   füllen/erhöhen die Capacity niemals — sie erscheinen ausschließlich als
   getrennt gekennzeichnete Aspiration-Policy (RUN-GOAL-001).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var CAPACITY_SCHEMA_VERSION = 2;               // Ergebnis-Shape unverändert (nur Validierungssemantik/Reason-Codes)
  var CALC_VERSION = 'rcap-v1.5.0';              // 3b.1f: strikter Source/Unit/Quality-Discriminator + ehrliche Provenienz ⇒ Version erhöht

  /* Nur exakt DIESE Snapshot-Schema-Version wird akzeptiert (unabhängig
     gepinnt; identisch zu trainingInputResolver.SNAPSHOT_SCHEMA_VERSION=1). */
  var EXPECTED_SNAPSHOT_SCHEMA_VERSION = 1;
  var CANONICAL_LOAD_UNIT = 'orvia_load_au';     // vertragskonforme Roh-Lasteinheit
  var WEEKLY_LOAD_UNIT = 'orvia_load_au_per_week'; // Ergebnis: wöchentliche Trainingslast (KEIN Kilometerumfang)
  /* Deterministisches Analysefenster für „jüngere" Long-Run-Evidenz —
     versionierte PRODUKTREGEL der Capacity-Factory. Eigener Namespace (RCAP-…-POLICY),
     damit sie NICHT wie eine freigegebene Knowledge-Pack-Regel wirkt. */
  var RECENT_WINDOW = { policyRuleId: 'RCAP-RECENT-POLICY-001', version: 'rwin-v1.0.0', days: 42 };
  var EVIDENCE_SCHEMA = 'orvia.longRunEvidence.v1';
  var MS_PER_DAY = 86400000;
  /* Realer Batch-2-Gap-Vertrag (groupActivitySessions default): Folgesegment nur,
     wenn (start - lastEnd) ∈ [-60s, 15min]. Wird bei der unabhängigen Session-
     Rekonstruktion NACHVOLLZOGEN, statt der Grouper-Behauptung zu vertrauen. */
  var EVIDENCE_GAP_MS = 15 * 60000;
  var EVIDENCE_BACK_TOLERANCE_MS = -60000;
  var MAX_EPOCH_MS = 8.64e15;                     // gültiger JS-Date-Bereich (± dieser Wert)

  /* FEST hinterlegte, unabhängige Consumer-Pins (Stand des freigegebenen
     Wissensvertrags/-packs; niemals zur Laufzeit aus Pack/Register gelesen). */
  var PINS = {
    mode: 'shadow',
    expectedKnowledgeContractVersion: 5,
    expectedKnowledgeVersion: 'kb-run-v3.0.0',
    expectedPackContentHash: 'fnv1a-544d89fa',
    expectedSourceRegistryVersion: 2,
    expectedSourceRegistryHash: 'fnv1a-6d70e555'
  };
  /* Medizinisch prüfpflichtige Regeln bleiben IMMER ausgeschlossen — auch
     falls eine spätere Auswahl sie je zuließe (defensive Doppelsicherung). */
  var MEDICAL_EXCLUDED = ['RUN-SAFE-001', 'RUN-RTR-001'];

  /* ---------- reine, exception-sichere Helfer ---------- */
  function _isObj(o) { return o != null && typeof o === 'object' && !Array.isArray(o); }
  function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function _int(v) { return (typeof v === 'number' && isFinite(v) && Math.floor(v) === v) ? v : null; }
  function _round(x, p) { var f = Math.pow(10, p || 0); return Math.round(x * f) / f; }
  function _conf(v) { return (v === 'low' || v === 'medium' || v === 'high') ? v : null; }
  function _confOr(v) { return _conf(v) || 'low'; }        // Fallback NIE 'medium'
  function _validEpochMs(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= MAX_EPOCH_MS; }
  function _toISO(v) { if (!_validEpochMs(v)) return null; try { return new Date(v).toISOString(); } catch (e) { return null; } }
  function _parseEpoch(v) {
    if (_validEpochMs(v)) return v;
    if (typeof v !== 'string' || !v) return null;
    var t = Date.parse(v);
    return _validEpochMs(t) ? t : null;
  }
  function _isIsoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === mo && dt.getUTCDate() === d;
  }
  function _tzUsable(tz) {
    if (typeof tz !== 'string' || !tz) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  function _strictBool(v) { return v === true ? true : (v === false ? false : null); }  // niemals casten
  function _intInRange(v, lo, hi) { var n = _int(v); return (n != null && n >= lo && n <= hi) ? n : null; }
  function _finNonNeg(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null; }  // endlich, ≥ 0
  var _LQ_EPS = 1e-6;
  function _approx(a, b) { return Math.abs(a - b) <= _LQ_EPS + 1e-9 * Math.max(Math.abs(a), Math.abs(b)); }
  /* Fenster-Confidence GENAU wie der reale Resolver (winConf): unbekannte/
     mehrdeutige Einheiten oder Schätzanteil > 0.5 ⇒ low; > 0.25 ⇒ medium; sonst high. */
  function _winConf(w) {
    var tot = w.measuredLoad + w.estimatedLoad;
    var es = tot > 0 ? w.estimatedLoad / tot : 0;
    if (w.ambiguousUnits > 0 || w.unknownUnits > 0 || es > 0.5) return 'low';
    if (es > 0.25) return 'medium';
    return 'high';
  }
  /* Ein Fenster-Objekt streng gegen die REAL erzeugten Felder validieren.
     cap = maximale activeLoadDays des Fensters. Rückgabe: normalisiertes
     Fenster oder null (ungültig). estimatedShare MUSS der Resolverformel
     round(estimatedLoad/(measured+estimated),2) bzw. 0 entsprechen. */
  function _validWindow(w, cap) {
    if (!_isObj(w)) return null;
    var ald = _intInRange(w.activeLoadDays, 0, cap);
    // measuredLoad/estimatedLoad sind im realen Producer Summen gerundeter Unit-Lasten
    // ⇒ nicht-negative GANZZAHLEN (keine stillen Dezimal-/Stringwerte).
    var ml = _intInRange(w.measuredLoad, 0, 1e12);
    var el = _intInRange(w.estimatedLoad, 0, 1e12);
    var uu = _intInRange(w.unknownUnits, 0, 100000);
    var au = _intInRange(w.ambiguousUnits, 0, 100000);
    if (ald == null || ml == null || el == null || uu == null || au == null) return null;
    if (!(typeof w.estimatedShare === 'number' && isFinite(w.estimatedShare) && w.estimatedShare >= 0 && w.estimatedShare <= 1)) return null;
    var tot = ml + el;
    var esExp = tot > 0 ? Math.round((el / tot) * 100) / 100 : 0;
    if (!_approx(w.estimatedShare, esExp)) return null;
    /* Last-/Aktivitätstage-Kohärenz INNERHALB des Fensters:
       - activeLoadDays === 0 ⇒ keine Last, keine unbekannten/mehrdeutigen Units
       - jede Last/Unknown/Ambiguity ⇒ mindestens ein aktiver Tag
       - aktiver Tag ⇒ Last > 0 ODER mindestens eine unbekannte Unit */
    if (ald === 0 && (tot !== 0 || uu !== 0 || au !== 0)) return null;
    if (ald > 0 && !(tot > 0 || uu > 0)) return null;
    return { activeLoadDays: ald, measuredLoad: ml, estimatedLoad: el, unknownUnits: uu, ambiguousUnits: au, estimatedShare: w.estimatedShare, totalLoad: tot };
  }

  /* Verschachtelten Last-Quality-Vertrag VOLLSTÄNDIG gegen den REALEN Producer
     (training-input-resolver.recentLoad/winConf) validieren (Req 3b.1d).
     Producer-Invarianten: activeLoadDays zählt Tage mit L>0 ODER unbekannter
     Load-Unit; dataDays zählt Tage NUR mit L>0. Daraus folgt zwingend
     0 ≤ dataDays ≤ chronic28.activeLoadDays ≤ historySpanDays ≤ 28. Bei
     chronic28.unknownUnits===0 muss dataDays === chronic28.activeLoadDays gelten;
     bei unbekannten Einheiten darf dataDays < activeLoadDays sein. dataDays >
     activeLoadDays ist immer unmöglich. Keine erfundenen Defaults, kein Clampen. */
  function _validLoadQuality(load) {
    function bad(reason) { return { valid: false, chronicSufficient: false, spanDays: null, reason: reason }; }
    var q = load ? load.quality : null;
    if (!_isObj(q)) return bad('quality_not_object');
    var a = _validWindow(q.acute7, 7); if (!a) return bad('acute7_window_invalid');
    var p = _validWindow(q.prior21, 21); if (!p) return bad('prior21_window_invalid');
    var c = _validWindow(q.chronic28, 28); if (!c) return bad('chronic28_window_invalid');
    var span = _intInRange(q.historySpanDays, 0, 28); if (span == null) return bad('historyspandays_out_of_range');
    var dd = _intInRange(load.dataDays, 0, 28); if (dd == null) return bad('datadays_out_of_range');
    // chronic28 = acute7 + prior21 für alle fünf akkumulierten Felder.
    if (c.activeLoadDays !== a.activeLoadDays + p.activeLoadDays) return bad('chronic_activedays_not_sum');
    if (!_approx(c.measuredLoad, a.measuredLoad + p.measuredLoad)) return bad('chronic_measuredload_not_sum');
    if (!_approx(c.estimatedLoad, a.estimatedLoad + p.estimatedLoad)) return bad('chronic_estimatedload_not_sum');
    if (c.unknownUnits !== a.unknownUnits + p.unknownUnits) return bad('chronic_unknownunits_not_sum');
    if (c.ambiguousUnits !== a.ambiguousUnits + p.ambiguousUnits) return bad('chronic_ambiguousunits_not_sum');
    // EXAKTE Fensterverteilung gegen historySpanDays (= oldestActiveOffset + 1).
    if (a.activeLoadDays > Math.min(7, span)) return bad('acute_active_exceeds_span');
    if (p.activeLoadDays > Math.min(21, Math.max(0, span - 7))) return bad('prior_active_exceeds_span');
    if (c.activeLoadDays > span) return bad('active_days_exceed_span');
    if ((c.activeLoadDays === 0) !== (span === 0)) return bad('chronic_active_span_zero_mismatch');   // active===0 ⇔ span===0
    if (p.activeLoadDays === 0 && c.activeLoadDays > 0 && span > 7) return bad('span_exceeds_acute_without_prior');
    if (p.activeLoadDays > 0 && span < 8) return bad('prior_active_requires_span_ge_8');
    // Tages-/Unknown-Kohärenz (Producer-Invarianten).
    if (dd > c.activeLoadDays) return bad('data_days_exceed_active_days');                 // dataDays ≤ activeLoadDays IMMER
    if (c.unknownUnits === 0 && dd !== c.activeLoadDays) return bad('data_active_mismatch_without_unknowns');
    if (c.totalLoad === 0 && dd !== 0) return bad('chronic_zero_load_requires_zero_datadays');
    if (c.totalLoad > 0 && dd < 1) return bad('chronic_load_requires_datadays');
    // Jeder aktive Tag OHNE berechenbare Last braucht ≥ 1 unbekannte Unit.
    if ((c.activeLoadDays - dd) > c.unknownUnits) return bad('inactive_days_exceed_unknown_units');
    // Fenster-Confidences müssen der realen winConf-Logik entsprechen.
    var ca = _conf(q.acuteConfidence), cp = _conf(q.priorConfidence), cc = _conf(q.chronicConfidence);
    if (ca == null || cp == null || cc == null) return bad('window_confidence_missing_or_invalid');
    if (ca !== _winConf(a)) return bad('acute_confidence_mismatch');
    if (cp !== _winConf(p)) return bad('prior_confidence_mismatch');
    if (cc !== _winConf(c)) return bad('chronic_confidence_mismatch');
    // insufficientChronicHistory boolean UND gleich der Resolverformel.
    var ich = q.insufficientChronicHistory;
    if (ich !== true && ich !== false) return bad('insufficient_flag_not_boolean');
    if (ich !== (p.activeLoadDays < 4 || span < 14)) return bad('insufficient_flag_mismatch');
    // quality.ratioConfidence = schlechteste Fenster-Confidence, bei ich ⇒ 'low'.
    var qrc = _conf(q.ratioConfidence); if (qrc == null) return bad('quality_ratioconfidence_invalid');
    var ORDER = { high: 0, medium: 1, low: 2 };
    var worst = [ca, cp, cc].reduce(function (w, x) { return ORDER[x] > ORDER[w] ? x : w; }, 'high');
    if (qrc !== (ich ? 'low' : worst)) return bad('quality_ratioconfidence_mismatch');
    // Top-Level ratioConfidence & loadConfidence: vorhanden, gültig, identisch zueinander und zu quality.
    var trc = _conf(load.ratioConfidence), tlc = _conf(load.loadConfidence);
    if (trc == null || tlc == null) return bad('top_confidence_missing_or_invalid');
    if (trc !== tlc) return bad('ratio_load_confidence_mismatch');
    if (trc !== qrc) return bad('top_quality_confidence_mismatch');
    // Top-Level estimatedShare/unknownUnits/ambiguousUnits stimmen mit dem Acute-Fenster überein.
    if (!(typeof load.estimatedShare === 'number' && isFinite(load.estimatedShare) && _approx(load.estimatedShare, a.estimatedShare))) return bad('top_estimatedshare_mismatch');
    if (_intInRange(load.unknownUnits, 0, 100000) == null || load.unknownUnits !== a.unknownUnits) return bad('top_unknownunits_mismatch');
    if (_intInRange(load.ambiguousUnits, 0, 100000) == null || load.ambiguousUnits !== a.ambiguousUnits) return bad('top_ambiguousunits_mismatch');
    /* Top-Level-Last MUSS aus den Quality-Fenstern stammen (Producer):
       recentLoad.acute7 = round(acute.measured+estimated);
       recentLoad.chronic28PerWeek = round((chronic.measured+estimated)/4).
       Keine frei eingespeisten Top-Werte dürfen die Wochenlast bestimmen. */
    if (_finNonNeg(load.acute7) == null || load.acute7 !== Math.round(a.measuredLoad + a.estimatedLoad)) return bad('top_acute_load_mismatch');
    if (_finNonNeg(load.chronic28PerWeek) == null || load.chronic28PerWeek !== Math.round((c.measuredLoad + c.estimatedLoad) / 4)) return bad('top_chronic_weekly_load_mismatch');
    return { valid: true, chronicSufficient: (ich === false), spanDays: span, reason: null };
  }

  /* Strikter Source/Unit/Quality-Discriminator (Req 3b.1f). Der reale Producer
     erzeugt GENAU zwei kohärente Formen; alles andere ist producer-inkohärent:
       - canonical_activities: loadUnit orvia_load_au, vollständiges gültiges quality-
         Objekt, kanonisch abgeleitete Top-Level-Felder (via _validLoadQuality).
       - legacy_sessions: loadUnit srpe_au, quality null, estimatedShare/unknownUnits/
         ambiguousUnits null.
     Unbekannte Quellen, falsche Source/Unit-Paare, Legacy-mit-Quality und kanonisch-
     mit-srpe sind inkohärent. Keine Defaults, kein Clamping, keine Umdeutung. */
  function _classifyLoad(load) {
    if (!load) return { kind: 'none', reason: 'no_load_history' };
    var src = load.source, unit = load.loadUnit;
    if (src === 'canonical_activities') {
      if (unit !== CANONICAL_LOAD_UNIT) return { kind: 'incoherent', reason: 'canonical_source_wrong_unit' };
      var qv = _validLoadQuality(load);
      if (!qv.valid) return { kind: 'incoherent', reason: 'canonical_quality_' + qv.reason, qv: qv };
      return { kind: 'canonical', reason: null, qv: qv };
    }
    if (src === 'legacy_sessions') {
      if (unit !== 'srpe_au') return { kind: 'incoherent', reason: 'legacy_source_wrong_unit' };
      if (load.quality != null) return { kind: 'incoherent', reason: 'legacy_source_with_quality_object' };
      if (load.estimatedShare != null || load.unknownUnits != null || load.ambiguousUnits != null) return { kind: 'incoherent', reason: 'legacy_source_derived_fields_not_null' };
      return { kind: 'legacy', reason: null };
    }
    return { kind: 'incoherent', reason: 'unknown_load_source' };
  }
  // Ehrliche Provenienz: nie stillschweigend 'legacy_sessions' bei unbekannter/inkohärenter Quelle.
  function _loadProv(cls) {
    return cls.kind === 'canonical' ? 'canonical_activities'
      : cls.kind === 'legacy' ? 'legacy_sessions'
        : cls.kind === 'none' ? 'none' : 'unknown';
  }

  /* Wissensauswahl-Antwort STRUKTURELL validieren (Req 3b.1b-5). Manipulierte/
     unvollständige Selector-Rückgaben ⇒ ungültig (fail-closed), nie Exception. */
  function _validSelection(sel) {
    if (!_isObj(sel)) return false;
    if (typeof sel.blocked !== 'boolean') return false;
    if (sel.errors != null && !Array.isArray(sel.errors)) return false;
    if (sel.excluded != null && !Array.isArray(sel.excluded)) return false;
    if (sel.blocked) return true;                // blockierte Auswahl braucht keine rules
    if (!Array.isArray(sel.rules)) return false;
    for (var i = 0; i < sel.rules.length; i++) {
      var r = sel.rules[i];
      if (!_isObj(r) || typeof r.ruleId !== 'string' || !r.ruleId) return false;
    }
    return true;
  }

  /* ---------- Evidenz-Adapter (pure): kanonische Aktivitäten + INJIZIERTE
     Batch-2-Gruppierung → längste gruppierte Laufeinheit. Emittiert einen
     EXPLIZITEN, versionierten Evidenz-Vertrag (Schema/Provenienz); die
     inhaltliche Validierung erfolgt zusätzlich in D4 (auch für DIREKT
     injizierte Evidenz, die den Adapter umgeht). ---------- */
  function _refOf(a) {
    if (!_isObj(a)) return null;
    if (a.clientRecordId != null) return a.clientRecordId;
    if (a.id != null) return a.id;
    if (a.source != null && a.sourceRecordId != null) return a.source + '|' + a.sourceRecordId;
    return null;
  }
  function _isRunning(sportId) { var s = String(sportId == null ? '' : sportId).trim().toLowerCase(); return s === 'run' || s === 'running' || s === 'laufen'; }
  /* Inhaltlicher Fingerabdruck einer Activity: gleiche Referenz + gleicher
     Fingerabdruck = harmlose Doppelaufzeichnung (eine Identität); gleiche Referenz
     + UNTERSCHIEDLICHER Fingerabdruck = echte Identitätskollision (mehrdeutig). */
  function _activityFingerprint(a) {
    var sm = _isObj(a.summary) ? a.summary : {};
    return [_isRunning(a.sportId) ? 'run' : String(a.sportId), String(a.startedAt), String(a.endedAt),
      String(a.durationSeconds), String(sm.distanceKm), String(sm.distanceM)].join('|');
  }

  function evidenceFromActivities(activities, opts) {
    opts = opts || {};
    var group = opts.groupSessions;
    if (typeof group !== 'function' || !Array.isArray(activities)) return null;
    var sport = opts.sportId || 'running';
    var res;
    try { res = group(activities, opts.groupOptions || {}) || {}; } catch (e) { return null; }
    var groups = Array.isArray(res) ? res : (Array.isArray(res.groups) ? res.groups : []);
    /* Index der TATSÄCHLICH übergebenen Activities — alleinige Autorität für die
       Rekonstruktion. IDENTITÄTSKOLLISIONEN (zwei verschiedene Activities mit
       gleicher stabiler Referenz) machen diese Referenz mehrdeutig ⇒ jede Gruppe,
       die sie nutzt, wird verworfen (kein stilles „erste gewinnt"). */
    var index = {}, collided = {}, fp = {};
    activities.forEach(function (a) {
      var ref = _refOf(a); if (ref == null) return; var k = String(ref);
      var f = _activityFingerprint(a);
      if (k in index) { if (fp[k] !== f) collided[k] = true; }   // gleiche Ref, anderer Inhalt ⇒ echte Kollision
      else { index[k] = a; fp[k] = f; }
    });
    var best = null;
    groups.forEach(function (g) {
      if (!_isObj(g) || g.sportId !== sport) return;
      var refs = Array.isArray(g.activityRefs) ? g.activityRefs : null;
      if (!refs || refs.length === 0) return;
      var seen = {}, resolved = [];
      for (var i = 0; i < refs.length; i++) {
        var r = refs[i];
        if (r == null || (typeof r !== 'string' && typeof r !== 'number')) return;   // malformed ref ⇒ Gruppe verwerfen
        var key = String(r);
        if (seen[key]) return;                                                        // Duplikat-Ref ⇒ verwerfen
        seen[key] = true;
        if (collided[key]) return;                                                    // kollidierende Identität ⇒ verwerfen
        var act = index[key];
        if (!act || !_isRunning(act.sportId)) return;                                 // unbekannte/nicht-Running-Ref ⇒ verwerfen
        resolved.push(act);
      }
      /* Jede Activity distanz-/zeitseitig gültig; Distanz > 0 (kein Long Run aus
         nuller/ungültiger Distanz). Startzeit valide. */
      var members = [];
      for (var j = 0; j < resolved.length; j++) {
        var a = resolved[j];
        var sm = _isObj(a.summary) ? a.summary : {};
        var dk = _num(sm.distanceKm);
        if (dk == null && _num(sm.distanceM) != null) dk = _num(sm.distanceM) / 1000;
        if (dk == null || dk <= 0) return;                                            // ungültige/nuller Distanz ⇒ Gruppe verwerfen
        var st = _parseEpoch(a.startedAt);
        if (st == null) return;                                                       // ungültige Startzeit ⇒ verwerfen
        var durS = _num(a.durationSeconds);
        var end = (_parseEpoch(a.endedAt) != null) ? _parseEpoch(a.endedAt) : (durS != null && durS >= 0 ? st + durS * 1000 : st);
        members.push({ start: st, end: end, dk: dk });
      }
      if (members.length === 0) return;
      /* Nach Startzeit sortieren und den REALEN Batch-2-Gap-Vertrag prüfen:
         Folgesegment nur, wenn (start - lastEnd) ∈ [-60s, 15min]. Nicht
         zusammenhängende Activities werden NIE zu einem Long Run addiert. */
      members.sort(function (x, y) { return x.start - y.start; });
      for (var k2 = 1; k2 < members.length; k2++) {
        var gapMs = members[k2].start - members[k2 - 1].end;
        if (!(gapMs <= EVIDENCE_GAP_MS && gapMs >= EVIDENCE_BACK_TOLERANCE_MS)) return;  // nicht kontiguierlich ⇒ verwerfen
      }
      var sum = 0;
      for (var k3 = 0; k3 < members.length; k3++) sum += members[k3].dk;
      var reconstructed = _round(sum, 2);
      if (reconstructed <= 0) return;
      var startIso = _toISO(members[0].start);
      if (!best || reconstructed > best.distanceKm) {
        best = {
          schema: EVIDENCE_SCHEMA, sportId: sport, groupId: (g.groupId != null ? g.groupId : null),
          startedAt: startIso, distanceKm: reconstructed, segments: members.length,
          activityRefs: refs.map(function (x) { return x; })
        };
      }
    });
    return best ? { longestGroupedSession: best } : null;
  }

  /* Vollständige, exception-sichere Validierung der Long-Run-Evidenz gegen den
     versionierten Adaptervertrag inkl. Recent-Window. Gibt {ok,...} zurück,
     wirft nie — auch bei malformed activityRefs/Datumswerten. */
  function _validateLongRun(g, nowMs) {
    if (!_isObj(g)) return { ok: false, reason: 'no_grouped_evidence', missingness: 'not_supported' };
    if (g.schema !== EVIDENCE_SCHEMA) return { ok: false, reason: 'evidence_schema_unrecognized', missingness: 'not_supported' };
    if (g.sportId !== 'running') return { ok: false, reason: 'evidence_sport_not_running', missingness: 'not_supported' };
    if (g.groupId == null || (typeof g.groupId !== 'string' && typeof g.groupId !== 'number'))
      return { ok: false, reason: 'evidence_groupid_invalid', missingness: 'not_supported' };
    var dist = _num(g.distanceKm);
    if (dist == null || dist <= 0) return { ok: false, reason: 'evidence_distance_invalid', missingness: 'not_supported' };
    var seg = _int(g.segments);
    if (seg == null || seg <= 0) return { ok: false, reason: 'evidence_segments_invalid', missingness: 'not_supported' };
    var refs = g.activityRefs;
    if (!Array.isArray(refs) || refs.length === 0) return { ok: false, reason: 'evidence_refs_invalid', missingness: 'not_supported' };
    var seen = {};
    for (var i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (r == null || (typeof r !== 'string' && typeof r !== 'number')) return { ok: false, reason: 'evidence_refs_malformed', missingness: 'not_supported' };
      var k = (typeof r) + ':' + r;
      if (seen[k]) return { ok: false, reason: 'evidence_refs_duplicated', missingness: 'not_supported' };
      seen[k] = true;
    }
    if (refs.length !== seg) return { ok: false, reason: 'evidence_segment_ref_mismatch', missingness: 'not_supported' };
    /* Zeitbezug: ohne gültige Referenzzeit KEIN Fenster ⇒ unknown. */
    if (!_validEpochMs(nowMs)) return { ok: false, reason: 'no_reference_time_for_recent_window', missingness: 'unknown' };
    var st = _parseEpoch(g.startedAt);
    if (st == null) return { ok: false, reason: 'evidence_date_missing_or_invalid', missingness: 'not_supported' };
    if (st > nowMs) return { ok: false, reason: 'evidence_in_future', missingness: 'not_supported' };
    var windowStart = nowMs - RECENT_WINDOW.days * MS_PER_DAY;
    if (st < windowStart) return { ok: false, reason: 'evidence_outside_recent_window', missingness: 'stale' };
    return {
      ok: true, distanceKm: _round(dist, 2), segments: seg,
      startedIso: _toISO(st), windowStartIso: _toISO(windowStart), windowEndIso: _toISO(nowMs)
    };
  }

  function _dim(value, provenance, missingness, confidence, ruleIds, reasonCodes) {
    return {
      value: value,
      provenance: provenance || 'none',
      missingness: missingness || null,
      confidence: _confOr(confidence),
      ruleIds: ruleIds || [],
      reasonCodes: reasonCodes || []
    };
  }

  /* ---------- Hauptfactory (Backstop-gekapselt; wirft nie) ---------- */
  function buildRunningCapacity(snapshot, opts) {
    try { return _build(snapshot, opts); }
    catch (e) {
      return _result('blocked', null, [], [], [{ code: 'internal_error', at: (e && e.name) || 'error' }],
        [{ step: 'internal_error', detail: (e && e.name) || 'error' }], null);
    }
  }

  function _build(snapshot, opts) {
    opts = opts || {};
    var trace = [];
    function tr(step, detail) { trace.push({ step: step, detail: detail == null ? null : detail }); }

    var contracts = opts.contracts || O.knowledgeContracts;
    var pack = opts.pack || O.runningKnowledgePack;
    var registry = opts.registry || O.knowledgeSources;

    /* --- Gate 1: Wissensauswahl NUR über selectRules mit festen Pins --- */
    if (!contracts || typeof contracts.selectRules !== 'function') {
      return _result('blocked', null, [], [], [{ code: 'knowledge_contracts_unavailable' }], [{ step: 'knowledge', detail: 'contracts_missing' }], null);
    }
    var sel;
    try {
      sel = contracts.selectRules(pack, registry, {
        mode: PINS.mode,
        expectedKnowledgeContractVersion: PINS.expectedKnowledgeContractVersion,
        expectedKnowledgeVersion: PINS.expectedKnowledgeVersion,
        expectedPackContentHash: PINS.expectedPackContentHash,
        expectedSourceRegistryVersion: PINS.expectedSourceRegistryVersion,
        expectedSourceRegistryHash: PINS.expectedSourceRegistryHash,
        sport: 'running'
      });
    } catch (e) {
      return _result('blocked', null, [], [], [{ code: 'knowledge_selection_invalid', detail: 'selector_threw' }],
        trace.concat([{ step: 'knowledge_select', detail: 'selector_threw' }]), null);
    }
    /* Selector-RÜCKGABE strukturell fail-closed prüfen (manipulierte/unvollständige
       Antworten dürfen nicht still zu unbekannter Capacity werden). */
    if (!_validSelection(sel)) {
      return _result('blocked', null, [], [], [{ code: 'knowledge_selection_invalid' }],
        trace.concat([{ step: 'knowledge_select', detail: 'selection_shape_invalid' }]), null);
    }
    tr('knowledge_select', { blocked: !!sel.blocked, ruleCount: (sel.rules || []).length });
    if (sel.blocked) {
      return _result('blocked', null, [], (sel.excluded || []).map(function (x) { return x && x.ruleId; }),
        [{ code: 'knowledge_selection_blocked', errors: (sel.errors || []).map(function (e) { return e && e.code; }) }],
        trace, null);
    }
    /* SEMANTISCHE Selector-Prüfung (Req 3b.1c-2): jede zurückgegebene Rule-ID muss
       eindeutig sein UND zum (hash-gepinnten) Pack gehören; keine unbekannte/fremde
       Rule-ID, keine medizinisch ausgeschlossene Regel im aktiven Satz. Der zulässige
       Universum kommt aus dem realen Pack (Pack-Hash ist im Selector gepinnt). */
    var allowedRuleIds = {};
    if (_isObj(pack) && Array.isArray(pack.rules)) {
      pack.rules.forEach(function (r) { if (_isObj(r) && typeof r.ruleId === 'string' && r.ruleId) allowedRuleIds[r.ruleId] = true; });
    }
    var rawRuleIds = sel.rules.map(function (r) { return r.ruleId; });
    var seenRuleIds = {}, semReason = null;
    for (var si = 0; si < rawRuleIds.length; si++) {
      var rid = rawRuleIds[si];
      if (seenRuleIds[rid]) { semReason = 'duplicate_rule_id:' + rid; break; }
      seenRuleIds[rid] = true;
      if (!allowedRuleIds[rid]) { semReason = 'unknown_rule_id:' + rid; break; }
      if (MEDICAL_EXCLUDED.indexOf(rid) >= 0) { semReason = 'medical_rule_in_used:' + rid; break; }
    }
    if (semReason) {
      return _result('blocked', null, [], [], [{ code: 'knowledge_selection_invalid', detail: semReason }],
        trace.concat([{ step: 'knowledge_select', detail: semReason }]), null);
    }
    /* Nur SHADOW-Regeln OHNE die medizinisch prüfpflichtigen (Doppelsicherung). */
    var usableRules = (sel.rules || []).filter(function (r) { return r && MEDICAL_EXCLUDED.indexOf(r.ruleId) < 0; });
    var usableIds = usableRules.map(function (r) { return r.ruleId; }).sort();
    var excludedIds = (sel.excluded || []).map(function (x) { return x && x.ruleId; })
      .concat(MEDICAL_EXCLUDED)
      .filter(function (v, i, a) { return v != null && a.indexOf(v) === i; }).sort();
    /* Im gepinnten Shadow-Modus MUSS eine Auswahl entstehen; leere Auswahl ⇒ Vertragsbruch. */
    if (usableIds.length === 0) {
      return _result('blocked', null, [], excludedIds, [{ code: 'knowledge_selection_invalid', detail: 'empty_shadow_selection' }], trace, null);
    }
    var has = {}; usableIds.forEach(function (id) { has[id] = true; });

    /* --- Gate 2: Snapshot fail-closed strikt validieren --- */
    if (!_isObj(snapshot)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_invalid' }], trace, null);
    }
    if (snapshot.schemaVersion !== EXPECTED_SNAPSHOT_SCHEMA_VERSION) {
      return _result('blocked', null, usableIds, excludedIds,
        [{ code: 'snapshot_schema_unsupported', expected: EXPECTED_SNAPSHOT_SCHEMA_VERSION, got: (typeof snapshot.schemaVersion === 'number' ? snapshot.schemaVersion : null) }], trace, null);
    }
    if (!_validEpochMs(snapshot.now)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_time_invalid' }], trace, null);
    }
    if (!_isIsoDate(snapshot.today)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_date_invalid' }], trace, null);
    }
    if (!_tzUsable(snapshot.timezone)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_timezone_invalid' }], trace, null);
    }
    if (!_isObj(snapshot.dataQuality) || !Array.isArray(snapshot.dataQuality.missing)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_dataquality_invalid' }], trace, null);
    }
    if (snapshot.loadHistory != null && !_isObj(snapshot.loadHistory)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_loadhistory_invalid' }], trace, null);
    }
    if (snapshot.currentMetrics != null && !_isObj(snapshot.currentMetrics)) {
      return _result('blocked', null, usableIds, excludedIds, [{ code: 'snapshot_currentmetrics_invalid' }], trace, null);
    }

    var nowMs = snapshot.now;
    var asOf = _toISO(nowMs);
    var snapMissing = snapshot.dataQuality.missing;
    var load = _isObj(snapshot.loadHistory) ? snapshot.loadHistory : null;
    /* STRIKTER Discriminator: Source/Unit/Quality MÜSSEN zu einer der beiden
       kohärenten Producer-Formen passen. qualityCoherent/histSufficient/reliable
       sind AUSSCHLIESSLICH bei vollständig gültiger kanonischer Kombination wahr. */
    var cls = _classifyLoad(load);
    var canonical = (cls.kind === 'canonical');
    var q = canonical ? load.quality : null;
    var qv = cls.qv || { valid: false, chronicSufficient: false, spanDays: null, reason: cls.reason };
    var ratioConfN = canonical ? _conf(load.ratioConfidence != null ? load.ratioConfidence : load.loadConfidence) : null;
    var qualityCoherent = canonical;                              // nur kanonisch+vollständig gültig
    var qualityReason = cls.reason;                               // null bei canonical, sonst präziser Grund
    var spanDays = canonical ? qv.spanDays : null;
    var chronicInsufficient = !(canonical && qv.chronicSufficient);
    var coherentWindows = canonical;
    var histSufficient = (canonical && qv.chronicSufficient);
    var p21Days = canonical ? _intInRange(q.prior21.activeLoadDays, 0, 21) : null;
    var a7Days = canonical ? _intInRange(q.acute7.activeLoadDays, 0, 7) : null;
    var consLow = (p21Days == null || p21Days < 4);
    var loadProv = _loadProv(cls);                                // ehrliche Provenienz (nie fälschlich legacy)
    tr('snapshot', { hasLoad: !!load, loadKind: cls.kind, ratioConfidence: ratioConfN, canonical: canonical, qualityReason: qualityReason, histSufficient: histSufficient, consistencyLow: consLow });

    var dims = {};

    /* D1 · Historienreife & Datenzuverlässigkeit (RUN-HIST-001 + RUN-DATA-001).
       'reliable' ist AUSSCHLIESSLICH bei vollständig gültiger kanonischer Kombination
       möglich. Legacy/unbekannte Quelle/falsche Einheit/inkohärente Mischung ⇒ nie
       reliable, konservativ insufficient/unknown, Confidence low, präziser Reason. */
    (function () {
      if (!has['RUN-HIST-001']) { dims.historyReliability = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var hids = ['RUN-HIST-001', 'RUN-DATA-001'];
      if (cls.kind === 'none') { dims.historyReliability = _dim('unknown', 'none', 'not_captured', 'low', hids, ['no_load_history']); return; }
      if (cls.kind === 'legacy') {
        dims.historyReliability = _dim(
          { tier: 'insufficient', source: 'legacy_sessions', loadUnit: load.loadUnit || null, historySpanDays: null },
          'legacy_sessions', 'legacy_no_canonical_basis', 'low', hids, ['legacy_source_no_reliable_basis']);
        return;
      }
      if (cls.kind === 'incoherent') {
        dims.historyReliability = _dim('unknown', loadProv, 'not_supported', 'low', hids, ['load_source_incoherent', cls.reason]);
        return;
      }
      // cls.kind === 'canonical'
      var tier = 'insufficient';
      if (histSufficient) tier = 'reliable';
      else if (spanDays != null && spanDays >= 14) tier = 'limited';
      var conf = histSufficient ? _confOr(ratioConfN) : 'low';
      var reasons = ['data_source_canonical_activities'];
      if (chronicInsufficient) reasons.push('insufficient_chronic_history');
      dims.historyReliability = _dim(
        { tier: tier, historySpanDays: spanDays, dataDays: _num(load.dataDays), source: 'canonical_activities', loadUnit: load.loadUnit || null },
        'canonical_activities', chronicInsufficient ? 'insufficient_history' : null, conf,
        hids, reasons);
    })();

    /* D2 · Konsistenz & Trainingshäufigkeit (RUN-CONS-001). „sufficient" NUR aus
       vertrauenswürdigen (kanonisch gültigen) Fenstern — niemals allein aus dem
       Vorhandensein von load.quality. Nicht-kanonisch ⇒ unknown/low. */
    (function () {
      if (!has['RUN-CONS-001']) { dims.consistency = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      if (cls.kind !== 'canonical') {
        var m = cls.kind === 'none' ? 'not_captured' : (cls.kind === 'legacy' ? 'legacy_no_canonical_basis' : 'not_supported');
        var rc = cls.kind === 'legacy' ? ['legacy_source_no_consistency_basis'] : (cls.kind === 'none' ? ['no_load_quality'] : ['load_source_incoherent']);
        dims.consistency = _dim('unknown', loadProv, m, 'low', ['RUN-CONS-001'], rc);
        return;
      }
      dims.consistency = _dim(
        { acute7ActiveDays: a7Days, prior21ActiveDays: p21Days, level: consLow ? 'low' : 'sufficient' },
        'canonical_activities',
        consLow ? 'insufficient_history' : null, consLow ? 'low' : _confOr(ratioConfN),
        ['RUN-CONS-001'], consLow ? ['low_consistency_blocks_volume_progression_claims'] : ['observed_consistency']);
    })();

    /* D3 · Beobachtete Wochen-Trainingslast als BANDBREITE (RUN-VOL-001) — RANGE,
       keine Vorgabe. Quantitatives Band NUR wenn alle Bedingungen erfüllt sind:
       kanonisch · Einheit orvia_load_au · beide Lastwerte endlich & ≥0 ·
       ratioConfidence medium|high · ausreichende Historie · Konsistenz nicht low. */
    (function () {
      if (!has['RUN-VOL-001']) { dims.weeklyVolumeObserved = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var a7 = load ? _num(load.acute7) : null;
      var chW = load ? _num(load.chronic28PerWeek) : null;
      var unitOk = !!(load && load.loadUnit === CANONICAL_LOAD_UNIT);
      var valuesOk = (a7 != null && chW != null && a7 >= 0 && chW >= 0);
      var ratioOk = (ratioConfN === 'medium' || ratioConfN === 'high');
      var allowed = !!(load && canonical && unitOk && valuesOk && ratioOk && histSufficient && !consLow);
      if (!allowed) {
        var reason = !load ? 'not_captured'
          : !canonical ? (cls.kind === 'legacy' ? 'legacy_units_no_volume_basis' : 'load_source_incoherent:' + (cls.reason || 'unknown'))
            : !unitOk ? 'non_canonical_load_unit'
              : !valuesOk ? 'load_values_invalid'
                : !ratioOk ? 'low_or_missing_ratio_confidence_blocks_volume'
                  : !qualityCoherent ? ('load_quality_incoherent:' + (qualityReason || 'unknown'))
                    : !histSufficient ? 'insufficient_history_for_volume'
                      : 'low_consistency_blocks_volume';
        var missing = !load ? 'not_captured' : (!canonical ? 'not_supported' : 'insufficient_history');
        dims.weeklyVolumeObserved = _dim('unknown', 'none', missing, 'low', ['RUN-VOL-001'], [reason]);
        return;
      }
      var lo = Math.min(a7, chW), hi = Math.max(a7, chW);
      dims.weeklyVolumeObserved = _dim(
        {
          min: _round(lo), max: _round(hi),
          unit: WEEKLY_LOAD_UNIT, quantityKind: 'weekly_training_load',
          basis: 'observed_windows_descriptive',
          note: 'beobachtete woechentliche Trainingslast in orvia_load_au; kein Streckenumfang; keine Vorgabe'
        },
        'canonical_activities',
        (load.estimatedShare != null && load.estimatedShare > 0) ? 'estimated_share_present' : null,
        _confOr(ratioConfN), ['RUN-VOL-001'],
        ['single_peak_week_must_not_define_baseline', 'descriptive_only', 'weekly_training_load_not_distance']);
    })();

    /* D4 · Längste korrekt gruppierte JÜNGERE Laufeinheit (RUN-LONG-001) —
       validierter Evidenz-Vertrag + versioniertes Recent-Window; genau EINE
       gruppierte Einheit, Duplikate/Zukunft/veraltet ⇒ unknown. */
    (function () {
      if (!has['RUN-LONG-001']) { dims.longestGroupedSession = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var g = (_isObj(opts.evidence)) ? opts.evidence.longestGroupedSession : null;
      var v = _validateLongRun(g, nowMs);
      if (!v.ok) {
        dims.longestGroupedSession = _dim('unknown', 'none', v.missingness, 'low', ['RUN-LONG-001'], [v.reason]);
        return;
      }
      dims.longestGroupedSession = _dim(
        {
          groupId: g.groupId, sportId: 'running', startedAt: v.startedIso,
          distanceKm: v.distanceKm, segments: v.segments, activityRefs: g.activityRefs.slice(),
          countedAs: 'single_grouped_session',
          analysisWindow: { policyRuleId: RECENT_WINDOW.policyRuleId, version: RECENT_WINDOW.version, days: RECENT_WINDOW.days, windowStart: v.windowStartIso, windowEnd: v.windowEndIso }
        },
        'grouped_activities', null, 'medium', ['RUN-LONG-001'],
        ['grouped_session_counts_once', 'split_recordings_not_double_counted', 'recent_window_' + RECENT_WINDOW.days + 'd_' + RECENT_WINDOW.version]);
    })();

    /* D5 · Belastungsreaktion (RUN-RESP-001) — EHRLICH: Snapshot v1 hat KEINEN
       typisierten 24/48-h-Outcome-Adapter ⇒ Reaktion IMMER 'unobserved',
       missingness 'not_supported', low. Provenienz feldbezogen/'mixed' — nie
       fälschlich 'legacy_sessions', wenn Felder aus kanonischer Last stammen. */
    (function () {
      if (!has['RUN-RESP-001']) { dims.loadResponse = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var cm = (_isObj(snapshot.currentMetrics) && _isObj(snapshot.currentMetrics.values)) ? snapshot.currentMetrics.values : {};
      var soreness = _num(cm.soreness), feel = _num(cm.feel);
      /* Boolesche/ganzzahlige Lastfelder NICHT casten: hardYesterday nur === true,
         "false"/1/{}/Typfehler ⇒ ungültig (null). hardStreak nur nicht-negative
         Ganzzahl im realistischen Fenster. */
      var hyRaw = load ? load.hardYesterday : undefined;
      var hardYesterday = load ? _strictBool(hyRaw) : null;                 // true | false | null(ungültig)
      var hyMissing = (load && hardYesterday == null) ? (hyRaw === undefined ? 'not_captured' : 'invalid_type') : null;
      var hsRaw = load ? load.hardStreak : undefined;
      var hardStreak = load ? _intInRange(hsRaw, 0, 60) : null;
      var hsMissing = (load && hardStreak == null) ? (hsRaw === undefined ? 'not_captured' : 'invalid_type') : null;
      var fieldProv = _loadProv(cls);                            // ehrliche Feldprovenienz (nie fälschlich legacy)
      var checkinPresent = (soreness != null || feel != null);
      var loadFieldsPresent = !!load;
      var prov = (checkinPresent && loadFieldsPresent) ? 'mixed'
        : checkinPresent ? 'checkin'
          : loadFieldsPresent ? fieldProv : 'none';
      var value = {
        inputs: {
          hardYesterday: { value: hardYesterday, provenance: hardYesterday == null ? 'none' : fieldProv, missingness: hyMissing },
          hardStreak: { value: hardStreak, provenance: hardStreak == null ? 'none' : fieldProv, missingness: hsMissing },
          soreness: { value: soreness, provenance: soreness != null ? 'checkin' : 'none' },
          feel: { value: feel, provenance: feel != null ? 'checkin' : 'none' }
        },
        response24h48h: 'unobserved',
        responseAdapter: 'not_supported_in_snapshot_v1'
      };
      dims.loadResponse = _dim(value, prov, 'not_supported', 'low', ['RUN-RESP-001'],
        ['post_response_unobserved', 'snapshot_v1_has_no_typed_outcome_adapter']);
    })();

    /* D6 · Verfügbare Intensitätssteuerung (RUN-INT-001 + RUN-DIM-001).
       RPE-METHODE ist Capability (policy) und unabhängig von RPE-HISTORIE.
       Snapshot v1 hat keinen typisierten RPE-Historien-Adapter ⇒ Provenienz
       'policy' (nicht 'checkin'). HF-STEUERUNG IST IN SNAPSHOT v1 GESPERRT:
       es gibt keinen typisierten HFmax-Provenienzvertrag, deshalb autorisiert
       ein arbiträr gesetztes athlete.hfMaxMeasured NIEMALS HF-Steuerung
       (hrControlAuthorized bleibt false). Ein echter HFmax-Adapter erfordert
       eine neue Snapshot-Schema-Version mit Provenienzvertrag. Pace nie ohne
       jüngere vergleichbare Leistungs-Evidenz. */
    (function () {
      if (!has['RUN-INT-001']) { dims.intensityControl = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var athlete = _isObj(snapshot.athlete) ? snapshot.athlete : {};
      var availableModes = ['rpe'];
      var reasons = ['rpe_is_available_control_method_policy', 'rpe_history_not_supported_in_snapshot_v1_capability_only'];
      /* HARTE Sperre in v1 — unabhängig von jedem gesetzten hfMaxMeasured/Provenienz. */
      var hrControlAuthorized = false;
      if (athlete.hfMaxMeasured != null) reasons.push('arbitrary_hfmax_ignored_no_v1_hfmax_provenance_contract');
      reasons.push('hr_control_requires_snapshot_schema_with_typed_hfmax_provenance');
      reasons.push('no_pace_prescription_without_recent_comparable_evidence');
      dims.intensityControl = _dim(
        {
          availableModes: availableModes, rpeHistoryPresent: false,
          paceControl: false, calibrationRequiredForPace: true, hrControlAuthorized: hrControlAuthorized,
          hrControlRequiresSchemaVersionGreaterThan: EXPECTED_SNAPSHOT_SCHEMA_VERSION,
          dimensionsSeparated: has['RUN-DIM-001'] ? ['easy', 'long', 'threshold', 'high_intensity'] : null
        },
        'policy', 'policy_only', 'low',
        has['RUN-DIM-001'] ? ['RUN-INT-001', 'RUN-DIM-001'] : ['RUN-INT-001'], reasons);
    })();

    /* D7 · Datenvergleichbarkeit (RUN-ENV-001 + RUN-DATA-001) */
    (function () {
      if (!has['RUN-DATA-001']) { dims.dataComparability = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var envMissing = snapMissing.some(function (m) { return m && String(m.path).indexOf('activities.environment') === 0; }) ||
        !(_isObj(snapshot.activities) && snapshot.activities.environment);
      var value = {
        loadUnit: load ? (load.loadUnit || null) : null,
        estimatedShare: load ? _num(load.estimatedShare) : null,
        unknownUnits: load ? _num(load.unknownUnits) : null,
        ambiguousUnits: load ? _num(load.ambiguousUnits) : null,
        environmentContext: envMissing ? 'not_supported' : 'partial',
        ratioConfidence: ratioConfN
      };
      var reasons = ['unknown_units_carry_no_load'];
      if (has['RUN-ENV-001']) reasons.push('environment_comparability_heat_only_evidenced');
      if (ratioConfN === 'low') reasons.push('low_ratio_confidence_blocks_ratio_gates');
      dims.dataComparability = _dim(value,
        loadProv,
        envMissing ? 'not_supported' : null, _confOr(ratioConfN),
        has['RUN-ENV-001'] ? ['RUN-DATA-001', 'RUN-ENV-001'] : ['RUN-DATA-001'], reasons);
    })();

    /* D8 · Qualitative Progressionsgrenzen & Warnflags (RUN-PROG-001 + RUN-MECH-001).
       NUR qualitative Flags/Kontexte — NIE Schwellenwerte, NIE Prozentsätze. */
    (function () {
      if (!has['RUN-PROG-001']) { dims.progressionLimits = _dim(null, 'none', 'rule_not_selected', 'low', [], ['rule_not_selected']); return; }
      var flags = [];
      var hardStreak = load ? _intInRange(load.hardStreak, 0, 60) : null;   // nicht casten; ungültig ⇒ kein Flag
      if (hardStreak != null && hardStreak >= 2) flags.push('consecutive_hard_days');
      if (ratioConfN === 'low') flags.push('load_quality_insufficient_for_progression_claim');
      if (chronicInsufficient && load) flags.push('insufficient_chronic_history');
      var reasons = ['no_universal_progression_rule', 'ratio_signals_are_context_not_thresholds', 'multiweek_rapid_spikes_are_flagged_never_prescribed'];
      dims.progressionLimits = _dim(
        { warningFlags: flags, envelope: 'qualitative_only', quantitativeProgression: null },
        loadProv,
        (ratioConfN === 'low' || (chronicInsufficient && load)) ? 'insufficient_history' : null,
        'low',
        has['RUN-MECH-001'] ? ['RUN-PROG-001', 'RUN-MECH-001'] : ['RUN-PROG-001'], reasons);
    })();

    /* Aspiration-Trennung (RUN-GOAL-001): Zielwerte sind KEINE Capacity-Eingänge.
       Statische Policy — es werden bewusst KEINE Zielwerte gelesen/echoed. */
    var aspiration = {
      targetsAreCapacityInputs: false,
      note: 'Zielzeit/Zielpace/Zieldatum sind Aspiration und werden von der Capacity-Factory nicht konsumiert.',
      ruleId: has['RUN-GOAL-001'] ? 'RUN-GOAL-001' : null
    };

    /* Status rein deskriptiv aus den DATENTRAGENDEN Kern-Dimensionen ableiten
       (inkl. longestGroupedSession). Policy-/Capability-Dimensionen
       (intensityControl, progressionLimits) und der in v1 strukturell nicht
       unterstützte loadResponse heben einen datenleeren Snapshot NICHT künstlich
       auf partial/ready. 'ready' = „Datenlage vollständig beschreibbar",
       NIEMALS „trainingsbereit"/Trainingsfreigabe. */
    var COMPLETENESS_KEYS = ['historyReliability', 'consistency', 'weeklyVolumeObserved', 'longestGroupedSession'];
    function _known(d) {
      if (!d) return false;
      var v = d.value;
      if (v == null || v === 'unknown') return false;
      var m = d.missingness;
      if (m === 'not_captured' || m === 'not_supported' || m === 'rule_not_selected' || m === 'stale') return false;
      return true;
    }
    var knownCount = 0, unknownCount = 0;
    COMPLETENESS_KEYS.forEach(function (k) { if (_known(dims[k])) knownCount++; else unknownCount++; });
    var status = (knownCount === 0) ? 'unknown' : (unknownCount === 0 ? 'ready' : 'partial');
    tr('status', { status: status, known: knownCount, unknown: unknownCount, basis: 'core_data_bearing_only' });

    return _result(status, dims, usableIds, excludedIds, [], trace, asOf, aspiration);
  }

  function _result(status, dims, usedRuleIds, excludedRuleIds, blockingReasons, trace, asOf, aspiration) {
    return {
      schemaVersion: CAPACITY_SCHEMA_VERSION,
      calcVersion: CALC_VERSION,
      snapshotSchemaExpected: EXPECTED_SNAPSHOT_SCHEMA_VERSION,
      status: status,                              // ready | partial | unknown | blocked (deskriptiv, NIE trainingsbereit)
      mode: 'shadow',
      asOf: asOf || null,
      pins: {                                      // exakt die konsumierten Consumer-Pins (Transparenz)
        mode: PINS.mode,
        expectedKnowledgeContractVersion: PINS.expectedKnowledgeContractVersion,
        expectedKnowledgeVersion: PINS.expectedKnowledgeVersion,
        expectedPackContentHash: PINS.expectedPackContentHash,
        expectedSourceRegistryVersion: PINS.expectedSourceRegistryVersion,
        expectedSourceRegistryHash: PINS.expectedSourceRegistryHash
      },
      capacity: dims,                              // einzelne Dimensionen (byte-stabil bei gleichem Snapshot)
      aspiration: aspiration || { targetsAreCapacityInputs: false },
      usedRuleIds: usedRuleIds || [],
      excludedRuleIds: excludedRuleIds || [],
      blockingReasons: blockingReasons || [],
      /* Deskriptiver Sicherheits-Disclaimer — die Capacity leitet niemals
         Trainingsfreigabe/GREEN/„safe to train"/Return-to-Run ab. */
      safetyDisclaimer: {
        derivesTrainingReadiness: false,
        derivesReturnToRun: false,
        batch0SafetyPipeline: 'independent_not_overridden',
        medicalRulesExcluded: MEDICAL_EXCLUDED.slice()
      },
      quantitativePrescription: null,              // aktuelles Pack hat keine autorisierten quantitativen Claims
      ruleTrace: trace || []
    };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }

  O.runningCapacityFactory = _freeze({
    CAPACITY_SCHEMA_VERSION: CAPACITY_SCHEMA_VERSION,
    CALC_VERSION: CALC_VERSION,
    EXPECTED_SNAPSHOT_SCHEMA_VERSION: EXPECTED_SNAPSHOT_SCHEMA_VERSION,
    RECENT_WINDOW: RECENT_WINDOW,
    EVIDENCE_SCHEMA: EVIDENCE_SCHEMA,
    PINS: PINS,
    MEDICAL_EXCLUDED: MEDICAL_EXCLUDED,
    evidenceFromActivities: evidenceFromActivities,
    buildRunningCapacity: buildRunningCapacity
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.runningCapacityFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
