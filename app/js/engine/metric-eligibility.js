/* ============================================================
   ORVIA · metric-eligibility (v8-447.1) — darf DIESE Kennzahl DIESER Aktivitaet in eine
   Auswertung, die historisch festgeschrieben wird (Bestwerte, Fortschritt, Ziele, Highlights)?

   STAND: VORBEREITET. Von der App nicht geladen (nicht in index.html, nicht im Offline-
   Zwischenspeicher), an kein Leistungsregister angeschlossen. Grundlage fuer v8-448.

   Warum je KENNZAHL und nicht je Aktivitaet: activityCapabilities.ledgerEligible() sperrt eine
   ganze Einheit. Eine Einheit kann aber eine belastbare Distanz und eine unbelegte Kadenz
   tragen — dann darf der 10-km-Bestwert gespeichert werden, der Kadenz-Fortschritt nicht.

   Grundsatz: NICHT SCHAETZEN, NICHT RUECKSCHLIESSEN. Eine Kennzahl ist zulaessig, wenn
     vorhanden      der Wert steht in der Zeile
     normalisiert   auf dem aktuellen Details-Vertrag, Bedeutung der Messreihe vermerkt
     belegt         die BEDEUTUNG der Quelle ist fuer diese Sportart nachgewiesen (EVIDENCE)
     gestuetzt      wo es zwei unabhaengige Angaben gibt, stimmen sie ueberein
   Alles andere: nicht zulaessig, mit Grund. „Wahrscheinlich richtig" gibt es nicht.

   Antwort:  { eligible, reason, reasons[], provenance }
     reason      erster (wichtigster) Grund oder null
     provenance  { source, manual, basis, quality, evidence }
                   manual   true, wenn ein manuell korrigierter Wert eingeht — der wirksame Wert
                            zaehlt, aber er bleibt als korrigiert gekennzeichnet
                   quality  'exact' | 'approx' (Garmin hat ausgeduennt: Mittelwert = Naeherung) | null

   Gruende:
     missing_data            der Wert (oder seine Grundlage) fehlt
     legacy_schema           Garmin-Zeile unter dem aktuellen Details-Vertrag (noch nicht nachgeladen)
     unverified_semantics    die Bedeutung der Quelle ist fuer diese Sportart nicht belegt — oder
                             zwei Angaben widersprechen sich
     insufficient_resolution die gelieferte Aufloesung traegt diese Kennzahl nicht
     invalid_time_axis       Zeitachse fehlt oder laeuft rueckwaerts
     unsupported_source      diese Quelle / dieser Aktivitaetstyp kann die Kennzahl nicht tragen
     unsupported_sport       die Kennzahl gibt es fuer diese Sportart nicht
     manual_override_conflict  ein manuell korrigierter Wert widerspricht der Aufzeichnung, aus der
                             die Kennzahl stammt
     not_completed           Einheit nicht abgeschlossen
     unknown_metric

   Rein: kein DOM, kein Speicher, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  function req(name, path) {
    if (O[name]) return O[name];
    if (typeof require === 'function') { try { return require(path); } catch (e) { return null; } }
    return null;
  }
  function CAP() { return req('activityCapabilities', '../activity-capabilities.js'); }
  function STR() { return req('activityStreams', '../activity-streams.js'); }
  function EFF() { return req('activityEffective', '../activity-effective.js'); }

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* ------------------------------------------------------------------
     BELEGE — wofuer die BEDEUTUNG einer Quelle nachgewiesen ist, je Sportart.
       fixture     in einem echten, anonymisierten Mitschnitt im Repo geprueft
       validated   in Produktion gegen Garmin Connect verglichen (Datum im Dokument)
       own         eigene Daten (ORVIA-Workout, manuelle Eingabe) — keine fremde Bedeutung
       observed    im Produktions-Zensus geliefert — Lieferung belegt, Bedeutung NICHT
       library     von der Bibliothek benannt
       (kein Eintrag) = assumed
     Zulaessig machen nur: fixture, validated, own.
     Der einzige Mitschnitt im Repo ist die Detailantwort EINES LAUFS — deshalb steht hier
     heute nur running. Jede weitere Zeile braucht einen Mitschnitt oder einen dokumentierten
     Vergleich; ein Test verhindert, dass hier „validated" ohne Nachweis eingetragen wird.
     ------------------------------------------------------------------ */
  var EVIDENCE = {
    'details.time':            { running: 'fixture' },
    'details.distance':        { running: 'fixture' },
    'details.heart_rate':      { running: 'fixture' },
    'details.durations':       { running: 'fixture' },
    'details.running_cadence': { running: 'fixture' },
    'details.cycling_cadence': {},
    'details.power':           {},
    'list.swim':               {},
    'list.training_effect':    { '*': 'library' },
    'list.strength':           { '*': 'library' },
    'list.calories':           { '*': 'library' },
    'own':                     { '*': 'own' }
  };
  var TRUSTED = { fixture: 1, validated: 1, own: 1 };
  /* Nachweise fuer 'validated' (Schluessel 'beleg|sportart' → { date, how }). Leer, bis Gian eine
     Sportart in Produktion gegen Garmin Connect verglichen hat. */
  var VALIDATIONS = {};

  var CURRENT = 3;                      // Details-Vertrag (Worker)
  var OWN_SOURCES = { orvia_workout: 1, live: 1, manual: 1 };
  var FOOT = { running: 1, walking: 1, hiking: 1 };
  var POWER_WINDOWS = [1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
  var DISTANCE_TARGETS = [400, 1000, 5000, 10000, 21098, 42195];
  /* Toleranzen fuer „zwei Angaben stimmen ueberein" */
  var TOL = { durationS: 5, durationRel: 0.01, distanceM: 20, distanceRel: 0.01, hrBpm: 2 };

  function level(key, sportId, ev) {
    var e = (ev && ev[key]) || EVIDENCE[key] || {};
    return e[sportId] || e['*'] || 'assumed';
  }

  /* ---- Bausteine ---------------------------------------------------- */
  function ctxOf(owner, opts) {
    var a = obj(owner) || {}, m = obj(a.metrics) || {};
    var C = CAP(), S = STR(), E = EFF();
    return {
      a: a, m: m, opts: opts || {}, sport: a.sportId || null, source: a.source || null,
      cap: C ? C.of(a) : null, S: S, E: E,
      g: obj(m.garmin) || {}, be: obj(m.best_efforts) || {}, sum: obj(a.summary) || {},
      reasons: [], prov: { source: a.source || null, manual: false, basis: null, quality: null, evidence: {} }
    };
  }
  function why(c, code) { if (c.reasons.indexOf(code) < 0) c.reasons.push(code); }
  function needEvidence(c, key) {
    var lv = level(key, c.sport, c.opts.evidence);
    c.prov.evidence[key] = lv;
    if (!TRUSTED[lv]) why(c, 'unverified_semantics');
    return !!TRUSTED[lv];
  }
  /* Garmin-Zeile: muss auf dem aktuellen Details-Vertrag stehen. true = in Ordnung. */
  function garminCurrent(c) {
    var v = num(c.m.detailsVersion);
    if (v === null) { why(c, 'missing_data'); return false; }
    if (v < CURRENT) { why(c, 'legacy_schema'); return false; }
    return true;
  }
  function timeAxisOk(c) {
    var t = c.S ? c.S.timeAxis(c.a) : null;
    if (!t) { why(c, 'invalid_time_axis'); return false; }
    for (var i = 1; i < t.length; i++) if (!(t[i] >= t[i - 1])) { why(c, 'invalid_time_axis'); return false; }
    return true;
  }
  function quality(c) {
    c.prov.quality = (c.be.native === true) ? 'exact' : 'approx';
  }
  function corrected(c, metricKey) {
    return !!(c.E && c.E.isCorrected && c.E.isCorrected(c.a, metricKey));
  }
  function close(x, y, abs, rel) { return Math.abs(x - y) <= Math.max(abs, rel * Math.max(Math.abs(x), Math.abs(y))); }
  function distanceM(c) {
    var s = c.sum;
    if (num(s.distanceM) !== null) return s.distanceM;
    if (num(s.distanceKm) !== null) return s.distanceKm * 1000;
    return null;
  }
  function lastNum(arr) { if (!Array.isArray(arr)) return null; for (var i = arr.length - 1; i >= 0; i--) if (num(arr[i]) !== null) return arr[i]; return null; }

  /* ---- Kennzahlen ----------------------------------------------------- */
  var METRICS = {};

  METRICS.duration = { sports: null, check: function (c) {
    var d = num(c.a.durationSeconds);
    if (d === null || d <= 0) { why(c, 'missing_data'); return; }
    if (corrected(c, 'duration')) { c.prov.manual = true; c.prov.basis = 'corrections.duration (wirksam)'; return; }   // Nutzerangabe
    if (c.source === 'garmin') {
      if (!garminCurrent(c)) return;
      var timer = num(c.g.timer_duration_s);
      c.prov.basis = 'duration_seconds, gestuetzt durch garmin.timer_duration_s';
      if (timer === null) { why(c, 'missing_data'); return; }
      if (!needEvidence(c, 'details.durations')) return;
      if (!close(d, timer, TOL.durationS, TOL.durationRel)) why(c, 'unverified_semantics');     // Liste und Aufzeichnung widersprechen sich
      return;
    }
    if (OWN_SOURCES[c.source] || c.source === 'import' || c.source === 'legacy_local') { c.prov.basis = 'duration_seconds'; needEvidence(c, 'own'); return; }
    why(c, 'unsupported_source');
  } };

  METRICS.distance = { sports: null, check: function (c) {
    var d = distanceM(c);
    if (d === null || d <= 0) { why(c, 'missing_data'); return; }
    if (corrected(c, 'distance')) { c.prov.manual = true; c.prov.basis = 'corrections.distance (wirksam)'; return; }
    if (c.source === 'garmin') {
      if (!garminCurrent(c)) return;
      if (c.sport === 'swimming') { c.prov.basis = 'summary.distanceM'; needEvidence(c, 'list.swim'); return; }
      var st = obj(c.m.streams) || {}, end = lastNum(st.distance), start = Array.isArray(st.distance) ? num(st.distance[0]) : null;
      c.prov.basis = 'summary.distanceM, gestuetzt durch streams.distance';
      if (end === null) { why(c, 'missing_data'); return; }
      if (!needEvidence(c, 'details.distance')) return;
      /* die Messreihe beginnt bei der ersten Zeile, nicht bei 0: verglichen wird das Ende */
      if (!close(d, end, TOL.distanceM, TOL.distanceRel) && !(start !== null && close(d, end - start, TOL.distanceM, TOL.distanceRel))) why(c, 'unverified_semantics');
      return;
    }
    if (OWN_SOURCES[c.source] || c.source === 'import' || c.source === 'legacy_local') { c.prov.basis = 'summary.distance'; needEvidence(c, 'own'); return; }
    why(c, 'unsupported_source');
  } };

  METRICS.pace = { sports: FOOT, check: function (c) {
    ['duration', 'distance'].forEach(function (k) {
      var r = evaluate(c.a, k, c.opts);
      r.reasons.forEach(function (x) { why(c, x); });
      if (r.provenance.manual) c.prov.manual = true;
      Object.keys(r.provenance.evidence).forEach(function (e) { c.prov.evidence[e] = r.provenance.evidence[e]; });
    });
    c.prov.basis = 'distance / duration (wirksam)';
  } };

  function statMetric(streamKey, evidenceKey, opt) {
    return function (c) {
      if (c.source !== 'garmin') {
        if (opt.ownSummary && OWN_SOURCES[c.source] && num(c.sum[opt.ownSummary]) !== null) { c.prov.basis = 'summary.' + opt.ownSummary; needEvidence(c, 'own'); return; }
        /* eigene Quelle: nur ein eingegebener Summenwert kann zaehlen — eine Aufzeichnung gibt es nicht */
        why(c, (opt.ownSummary && OWN_SOURCES[c.source]) ? 'missing_data' : 'unsupported_source'); return;
      }
      if (!garminCurrent(c)) return;
      var st = obj((obj(c.be.stats) || {})[streamKey]);
      c.prov.basis = 'best_efforts.stats.' + streamKey + ' (alle gelieferten Zeilen)';
      if (!st || num(st.avg) === null) { why(c, 'missing_data'); return; }
      if (opt.kind) {
        var cad = c.S ? c.S.cadence(c.a) : { status: 'none' };
        if (cad.status === 'unverified') { why(c, 'legacy_schema'); return; }
        if (cad.status !== 'ok' || cad.kind !== opt.kind || st.kind !== opt.kind) { why(c, 'missing_data'); return; }
      }
      if (!needEvidence(c, evidenceKey)) return;
      quality(c);
      if (opt.max && c.be.native !== true) { why(c, 'insufficient_resolution'); return; }     // ein Maximum aus ausgeduennten Zeilen ist eine Untergrenze
      if (opt.corroborate && num(c.sum[opt.corroborate]) !== null && !close(st.avg, c.sum[opt.corroborate], TOL.hrBpm, 0)) why(c, 'unverified_semantics');
    };
  }
  METRICS.heartRate = { sports: null, check: statMetric('heart_rate', 'details.heart_rate', { ownSummary: 'avgHr', corroborate: 'avgHr' }) };
  METRICS.maxHeartRate = { sports: null, check: statMetric('heart_rate', 'details.heart_rate', { ownSummary: 'maxHr', max: true }) };
  METRICS.runningCadence = { sports: { running: 1 }, check: statMetric('cadence', 'details.running_cadence', { kind: 'running_cadence_spm' }) };
  METRICS.cyclingCadence = { sports: { cycling: 1 }, check: statMetric('cadence', 'details.cycling_cadence', { kind: 'cycling_cadence_rpm' }) };
  METRICS.power = { sports: { cycling: 1, running: 1, rowing: 1 }, check: statMetric('power', 'details.power', {}) };

  METRICS.powerBest = { sports: { cycling: 1, running: 1, rowing: 1 }, param: 'windowS', check: function (c) {
    var w = c.opts.windowS;
    if (POWER_WINDOWS.indexOf(w) < 0) { why(c, 'unknown_metric'); return; }
    if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
    if (!garminCurrent(c)) return;
    var item = obj((obj((obj(c.be.power) || {}).windows) || {})[String(w)]);
    c.prov.basis = 'best_efforts.power.windows.' + w;
    if (!item || item.q === 'too_short') { why(c, 'missing_data'); return; }
    if (item.q !== 'exact' || num(item.w) === null) { why(c, 'insufficient_resolution'); return; }
    c.prov.quality = 'exact';
    if (num(item.miss_s) !== null && item.miss_s > 0) why(c, 'missing_data');                 // Sensor-Aussetzer im Fenster: Untergrenze, kein Rekord
    if ((obj(c.be.power) || {}).basis !== 'elapsed') why(c, 'invalid_time_axis');
    needEvidence(c, 'details.power'); needEvidence(c, 'details.time');
    if (corrected(c, 'duration') && num(c.a.durationSeconds) !== null && c.a.durationSeconds < w) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
  } };

  METRICS.distanceBest = { sports: FOOT, param: 'targetM', check: function (c) {
    var t = c.opts.targetM;
    if (DISTANCE_TARGETS.indexOf(t) < 0) { why(c, 'unknown_metric'); return; }
    if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
    if (!garminCurrent(c)) return;
    var item = obj((obj((obj(c.be.distance) || {}).targets) || {})[String(t)]);
    c.prov.basis = 'best_efforts.distance.targets.' + t + ' (gemessene Obergrenze)';
    if (!item || item.q === 'too_short' || num(item.s) === null) { why(c, 'missing_data'); return; }
    if (item.q !== 'measured') { why(c, 'insufficient_resolution'); return; }
    c.prov.quality = 'exact';
    if ((obj(c.be.distance) || {}).basis !== 'elapsed') why(c, 'invalid_time_axis');
    needEvidence(c, 'details.distance'); needEvidence(c, 'details.time');
    if (corrected(c, 'duration') && num(c.a.durationSeconds) !== null && c.a.durationSeconds < item.s) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
    if (corrected(c, 'distance') && distanceM(c) !== null && distanceM(c) < t) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
  } };

  function swimField(field) {
    return function (c) {
      if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
      if (!garminCurrent(c)) return;
      if (c.g.type_key !== 'lap_swimming') { why(c, 'unsupported_source'); return; }           // nur Becken (Freiwasser: keine Bahnen)
      var ext = obj(c.m.ext), f = ext ? obj(ext.fields) : null;
      c.prov.basis = 'ext.fields.' + field;
      if (!f || num(f.poolLength) === null || num(f[field]) === null) { why(c, 'missing_data'); return; }
      needEvidence(c, 'list.swim');
    };
  }
  METRICS.swolf = { sports: { swimming: 1 }, check: swimField('averageSwolf') };
  METRICS.strokeRate = { sports: { swimming: 1 }, check: swimField('averageSwimCadenceInStrokesPerMinute') };

  METRICS.trainingEffect = { sports: null, check: function (c) {
    if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
    var ext = obj(c.m.ext), f = ext ? obj(ext.fields) : null;
    c.prov.basis = 'ext.fields.aerobicTrainingEffect';
    if (!f || num(f.aerobicTrainingEffect) === null) { why(c, 'missing_data'); return; }
    needEvidence(c, 'list.training_effect');
  } };

  METRICS.strengthVolume = { sports: { gym: 1 }, check: function (c) {
    if (c.source === 'garmin') { c.prov.basis = 'ext.fields.totalVolume'; needEvidence(c, 'list.strength'); if (!(obj(c.m.ext) && obj(c.m.ext.fields) && num(c.m.ext.fields.totalVolume) !== null)) why(c, 'missing_data'); return; }
    if (c.source !== 'orvia_workout' && c.source !== 'live') { why(c, 'unsupported_source'); return; }
    c.prov.basis = 'summary.totalVolumeKg';
    if (num(c.sum.totalVolumeKg) === null || c.sum.totalVolumeKg <= 0) { why(c, 'missing_data'); return; }
    needEvidence(c, 'own');
  } };

  METRICS.calories = { sports: null, check: function (c) {
    if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
    c.prov.basis = 'summary.caloriesKcal';
    if (num(c.sum.caloriesKcal) === null) { why(c, 'missing_data'); return; }
    needEvidence(c, 'list.calories');
  } };

  /* FTP ist keine Kennzahl EINER Aktivitaet — sie gehoert dem Athleten und kommt aus der
     Tagesmessung (user_metrics.ftp_watts), nicht aus der Aufzeichnung. */
  METRICS.ftp = { sports: null, check: function (c) { c.prov.basis = null; why(c, 'unsupported_source'); } };

  function evaluate(owner, metric, opts) {
    var c = ctxOf(owner, opts);
    var def = METRICS[metric];
    if (!def) { return { eligible: false, reason: 'unknown_metric', reasons: ['unknown_metric'], provenance: c.prov }; }
    if (c.a.status && c.a.status !== 'completed') why(c, 'not_completed');
    if (def.sports && !def.sports[c.sport]) why(c, 'unsupported_sport');
    else { try { def.check(c); } catch (e) { why(c, 'missing_data'); } }
    return { eligible: c.reasons.length === 0, reason: c.reasons.length ? c.reasons[0] : null, reasons: c.reasons, provenance: c.prov };
  }
  function isMetricLedgerEligible(owner, metric, opts) { return evaluate(owner, metric, opts).eligible; }

  /* Uebersicht fuer EINE Aktivitaet: jede Kennzahl mit ihrem Urteil (Fenster-Kennzahlen je Fenster). */
  function overview(owner, opts) {
    var out = {};
    Object.keys(METRICS).forEach(function (k) {
      var def = METRICS[k];
      if (def.param === 'windowS') POWER_WINDOWS.forEach(function (w) { out[k + ':' + w] = evaluate(owner, k, Object.assign({}, opts || {}, { windowS: w })); });
      else if (def.param === 'targetM') DISTANCE_TARGETS.forEach(function (t) { out[k + ':' + t] = evaluate(owner, k, Object.assign({}, opts || {}, { targetM: t })); });
      else out[k] = evaluate(owner, k, opts);
    });
    return out;
  }

  var REASONS = ['missing_data', 'legacy_schema', 'unverified_semantics', 'insufficient_resolution', 'invalid_time_axis',
    'unsupported_source', 'unsupported_sport', 'manual_override_conflict', 'not_completed', 'unknown_metric'];

  var api = {
    evaluate: evaluate, isMetricLedgerEligible: isMetricLedgerEligible, overview: overview, level: level,
    METRICS: Object.keys(METRICS), REASONS: REASONS, EVIDENCE: EVIDENCE, TRUSTED: Object.keys(TRUSTED), VALIDATIONS: VALIDATIONS,
    POWER_WINDOWS: POWER_WINDOWS.slice(), DISTANCE_TARGETS: DISTANCE_TARGETS.slice(), TOLERANCES: TOL, DETAILS_VERSION_CURRENT: CURRENT,
    sportsOf: function (metric) { var d = METRICS[metric]; return d ? (d.sports ? Object.keys(d.sports) : null) : undefined; },
    paramOf: function (metric) { var d = METRICS[metric]; return d ? (d.param || null) : undefined; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.metricEligibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
