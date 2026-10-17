/* ============================================================
   ORVIA · metric-eligibility (v8-447.3) — darf DIESE Kennzahl DIESER Aktivitaet in eine
   Auswertung, die historisch festgeschrieben wird (Bestwerte, Fortschritt, Ziele, Highlights)?

   STAND v8-448B: von der App geladen (index.html, Offline-Zwischenspeicher) und einzige Pruefinstanz des
   Leistungsregisters (performance-ledger.js). Wirkt nur, wenn das Flag `performance_ledger` an ist —
   sonst ruft niemand evaluate() auf (keine sichtbare Aenderung).

   Warum je KENNZAHL und nicht je Aktivitaet: activityCapabilities.ledgerEligible() sperrt eine
   ganze Einheit. Eine Einheit kann aber eine belastbare Distanz und eine unbelegte Kadenz
   tragen — dann darf der 10-km-Bestwert gespeichert werden, der Kadenz-Fortschritt nicht.

   Grundsatz: NICHT SCHAETZEN, NICHT RUECKSCHLIESSEN. Eine Kennzahl ist zulaessig, wenn
     vorhanden      der Wert steht in der Zeile
     normalisiert   auf dem aktuellen Details-Vertrag, Bedeutung der Messreihe vermerkt
     belegt         die BEDEUTUNG der Quelle ist fuer diese Sportart nachgewiesen (EVIDENCE)
     gestuetzt      wo es zwei unabhaengige Angaben gibt, stimmen sie ueberein
   Alles andere: nicht zulaessig, mit Grund. „Wahrscheinlich richtig" gibt es nicht.

   Antwort:  { eligible, reason, reasons[], provenance, value, unit }
     value/unit  v8-448A: der Wert der Kennzahl auf GENAU der Grundlage, die geprueft wurde (wirksam, also nach
                 manueller Korrektur) — nur wenn eligible. Ist er nicht lesbar, ist die Kennzahl nicht zulaessig
                 (missing_data); ein Ersatz- oder Schaetzwert wird nie geliefert. Das Leistungsregister liest den
                 Wert NUR hier, damit Urteil und Zahl nie auseinanderlaufen.
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
     pause_conflict          v8-449.1: die Zielstrecke ist nur ueber eine Stelle erreichbar, an der die Distanz bei
                             STEHENDEM Timer wuchs (Strecke im angehaltenen Zustand) — kein aktiver Wert
     unverified_context      eine kontextgebundene Auswertung (opts.environment, z. B. nur 'outdoor') ist
                             verlangt, aber der Kontext ist nicht belegt oder ein anderer
     unknown_metric

   v8-447.3 · Herkunft und Kontext. Eine unvollstaendige Garmin-Herkunft sperrt KEINE Kennzahl pauschal —
   jede Kennzahl prueft nur, was sie braucht. Kontext (Laufband, Rolle/virtuell, Becken, Freiwasser) kommt
   AUSSCHLIESSLICH aus Garmins Typ (metrics.garmin.type_key), und nur, wenn der Typname ihn ausdruecklich
   nennt (CONTEXT). Ein generischer Typ ('running', 'cycling') oder ein fehlender Typ heisst: Kontext
   unbelegt — nicht „draussen". Kein Raten aus GPS (auch virtuelle Fahrten haben eine Strecke), Titel oder Uhrzeit.
     provenance.context = { environment, typeKey, basis, origin }
       environment  'indoor' | 'virtual' | 'pool' | 'open_water' | 'outdoor' | null (unbelegt)
       origin       Herkunftsstatus der Zeile: complete | partial | unavailable | inconsistent | null (keine Garmin-Zeile)

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
    'details.running_cadence': { running: 'validated' },     // Mitschnitt + Vergleich in Produktion (VALIDATIONS)
    'details.cycling_cadence': {},
    'details.power':           {},
    'list.swim':               {},
    'list.training_effect':    { '*': 'library' },
    'list.strength':           { '*': 'library' },
    'list.calories':           { '*': 'library' },
    'own':                     { '*': 'own' }
  };
  var TRUSTED = { fixture: 1, validated: 1, own: 1 };
  /* Nachweise fuer 'validated' (Schluessel 'beleg|sportart' → { date, how }). Nur, was in Produktion
     tatsaechlich gegen Garmin Connect verglichen wurde — mit Datum und Art des Vergleichs. */
  var VALIDATIONS = {
    'details.running_cadence|running': {
      date: '2026-10-11',
      how: 'Gian, iPhone: Laufkadenz einer Garmin-Laufeinheit nach Details-Vertrag 3 in ORVIA gegen Garmin Connect verglichen — stimmt ueberein (kein Halbwert mehr). Bedeutung der Quelle directDoubleCadence zusaetzlich im Mitschnitt belegt.'
    }
  };

  /* Protokoll des Validierungs-Gates v8-447.1 — was in Produktion bestaetigt wurde und was daraus
     folgt. Reine Dokumentation (erscheint in PERFORMANCE-DATA-ELIGIBILITY.md); die Urteile oben
     aendert nur EVIDENCE / VALIDATIONS. */
  var GATE_LOG = [
    { date: '2026-10-11', what: 'Nachladen auf Details-Vertrag 3', result: '40 von 40 Garmin-Aktivitaeten aktuell, keine Fehler, keine Rueckstellungen', consequence: 'Grund legacy_schema entfaellt fuer den Bestand' },
    { date: '2026-10-11', what: 'Laufkadenz am iPhone gegen Garmin Connect', result: 'stimmt', consequence: 'Schrittfrequenz (Lauf): validated' },
    { date: '2026-10-11', what: 'Manuelle Dauer-Korrektur (Kraft, 341 → 75 min) nach Neustart und Sync', result: 'bleibt 75 min', consequence: 'Dauer: wirksamer Wert haelt; Korrektur bleibt gekennzeichnet (provenance.manual)' },
    { date: '2026-10-11', what: 'Aufloesungspruefung maxchart=20000 an 8 Aktivitaeten (Mitschnitt-Skript, Probelauf, nichts gespeichert)', result: 'alle liefern saemtliche gemeldeten Zeilen, Median-Abstand 1 s', consequence: 'Leistungs-Bestwerte KOENNEN exakt werden — erst nach DETAIL_MAXCHART=20000 und gezieltem Neuladen (DETAIL_REFETCH_RESOLUTION); bis dahin insufficient_resolution' },
    { date: '2026-10-11', what: 'Bedeutungspruefung (Probelauf, ausgeduennte Antwort)', result: 'Abweichungen bei Laufkadenz, Beckenschwimm-Distanz und Bewegungszeiten', consequence: 'nicht als Beleg gewertet; Pruefung laeuft jetzt auch auf der vollstaendigen Antwort und im Worker (metrics.ext.semantics) und benennt die Ursache' },
    { date: '2026-10-15', what: 'Neuladen mit maxchart=20000 (Worker v8-447.2, DETAIL_REFETCH_RESOLUTION danach aus)', result: '41 von 41 Garmin-Aktivitaeten: Vertrag 3, maxchart=20000, vollstaendige Abtastung', consequence: 'insufficient_resolution entfaellt fuer den Bestand; Max-HF frei; Leistungs-Bestwerte nur noch am fehlenden Bedeutungsbeleg gesperrt' },
    { date: '2026-10-15', what: 'Feldzensus Herkunft', result: '40 von 41 mit unvollstaendiger Herkunft (ohne Typ und Zeit): 15 Lauf, 12 Rad, 8 Kraft, 5 Schwimmen', consequence: 'Ursache: Herkunft kam nur aus dem Listeneintrag im Sync-Fenster (2 Tage), der Block stammte vom Nachladen der Details. Metadaten-Backfill v8-447.3 (nur Liste). Ohne Rohfelder lief keine Bedeutungspruefung → Oe-Laufkadenz erst nach Backfill + Neupruefung' }
  ];

  /* v8-447.3 · Kontext NUR aus Typnamen, die ihn ausdruecklich nennen. Alles andere: null (unbelegt). */
  var CONTEXT = {
    treadmill_running: 'indoor', indoor_running: 'indoor', indoor_cycling: 'indoor', indoor_rowing: 'indoor',
    indoor_cardio: 'indoor', indoor_climbing: 'indoor',
    virtual_ride: 'virtual', virtual_run: 'virtual',
    lap_swimming: 'pool', open_water_swimming: 'open_water',
    trail_running: 'outdoor', street_running: 'outdoor', road_biking: 'outdoor', gravel_cycling: 'outdoor',
    mountain_biking: 'outdoor', cyclocross: 'outdoor', downhill_biking: 'outdoor'
  };
  /* Distanz ohne echte Fortbewegung (Laufband: Beschleunigungssensor/Kalibrierung; virtuell: Modell) */
  var NO_REAL_DISTANCE = { indoor: 1, virtual: 1 };
  var PROV_REQUIRED = ['type_key', 'start_gmt', 'start_local', 'utc_offset_s'];

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

  /* ---- Herkunft und Kontext (v8-447.3) ------------------------------ */
  function present(v) { return v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()); }
  /* Gleiche Regel wie der Worker (orvia_worker/provenance.status) und der Zensus. */
  function provenanceStatus(a) {
    var x = obj(a) || {};
    if (x.source !== 'garmin') return null;
    var g = obj((obj(x.metrics) || {}).garmin) || {};
    var missing = PROV_REQUIRED.filter(function (k) { return !present(g[k]); });
    var conflicts = Array.isArray(g.prov_conflicts) ? g.prov_conflicts : [];
    var unavailable = Array.isArray(g.prov_unavailable) ? g.prov_unavailable : [];
    if (conflicts.length) return 'inconsistent';
    if (!missing.length) return 'complete';
    if (missing.every(function (k) { return unavailable.indexOf(k) >= 0; })) return 'unavailable';
    return 'partial';
  }
  /* v8-448A · Eigene Daten: der Nutzer hat den Kontext selbst EINGEGEBEN (Formular der Sportart) — das ist ein
     Beleg eigener Art (Belegstufe own), kein Raten. Nur ausdrueckliche Werte; alles andere bleibt unbelegt. */
  var OWN_CONTEXT = [
    ['environment', { indoor: 'indoor', outdoor: 'outdoor', pool: 'pool', open_water: 'open_water' }],
    ['runType', { treadmill: 'indoor', trail: 'outdoor' }],
    ['walkingType', { treadmill: 'indoor' }],
    ['rideType', { indoor: 'indoor', gravel: 'outdoor', mtb: 'outdoor' }],
    ['swimType', { open_water: 'open_water' }]
  ];
  function ownContext(x) {
    var s = obj(x.summary) || {};
    for (var i = 0; i < OWN_CONTEXT.length; i++) {
      var k = OWN_CONTEXT[i][0], v = s[k];
      if (typeof v === 'string' && OWN_CONTEXT[i][1][v]) return { environment: OWN_CONTEXT[i][1][v], basis: 'Nutzerangabe summary.' + k + ' = ' + v };
    }
    return null;
  }
  function contextOf(a) {
    var x = obj(a) || {};
    if (x.source !== 'garmin' && OWN_SOURCES[x.source]) {
      var oc = ownContext(x);
      return { environment: oc ? oc.environment : null, typeKey: null, basis: oc ? oc.basis : 'keine Kontextangabe', origin: null };
    }
    var g = obj((obj(x.metrics) || {}).garmin) || {};
    var tk = (typeof g.type_key === 'string' && g.type_key) ? g.type_key : null;
    var env = tk && CONTEXT[tk] ? CONTEXT[tk] : null;
    return { environment: env, typeKey: tk, basis: env ? 'garmin.type_key = ' + tk : (tk ? 'garmin.type_key = ' + tk + ' (nennt keinen Kontext)' : 'kein Garmin-Typ'),
             origin: provenanceStatus(x) };
  }

  /* ---- Bausteine ---------------------------------------------------- */
  function ctxOf(owner, opts) {
    var a = obj(owner) || {}, m = obj(a.metrics) || {};
    var C = CAP(), S = STR(), E = EFF();
    return {
      a: a, m: m, opts: opts || {}, sport: a.sportId || null, source: a.source || null,
      cap: C ? C.of(a) : null, S: S, E: E,
      g: obj(m.garmin) || {}, be: obj(m.best_efforts) || {}, sum: obj(a.summary) || {},
      reasons: [], prov: { source: a.source || null, manual: false, basis: null, quality: null, evidence: {}, context: contextOf(a) }
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
      /* v8-447.1 (Gate-Abschluss): fuer diese Kennzahl zeigte die Bedeutungspruefung im Probelauf eine
         Abweichung zwischen Garmins Summenwert und der Aufzeichnung. Zulaessig erst, wenn der Worker den
         Summenwert gegen die VOLLSTAENDIGE Aufzeichnung bestaetigt hat (metrics.garmin.semantics_ok).
         Dann ist der bestaetigte Garmin-Wert die Grundlage, nicht das Mittel der Anzeige-Reihe. */
      if (opt.confirm) {
        var ok = obj((obj(c.g.semantics_ok) || {})[opt.confirm]);
        if (!ok || num(ok.list) === null) {
          if (c.be.native !== true) { why(c, 'insufficient_resolution'); return; }
          why(c, 'unverified_semantics'); return;
        }
        c.prov.basis = 'Garmin-Summenwert, bestaetigt gegen die vollstaendige Aufzeichnung (' + (ok.reading || '?') + ')';
      }
      if (opt.corroborate && num(c.sum[opt.corroborate]) !== null && !close(st.avg, c.sum[opt.corroborate], TOL.hrBpm, 0)) why(c, 'unverified_semantics');
    };
  }
  METRICS.heartRate = { sports: null, check: statMetric('heart_rate', 'details.heart_rate', { ownSummary: 'avgHr', corroborate: 'avgHr' }) };
  METRICS.maxHeartRate = { sports: null, check: statMetric('heart_rate', 'details.heart_rate', { ownSummary: 'maxHr', max: true }) };
  METRICS.runningCadence = { sports: { running: 1 }, check: statMetric('cadence', 'details.running_cadence', { kind: 'running_cadence_spm', confirm: 'averageRunningCadence' }) };
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
    c.prov.timeCategory = 'elapsed'; c.prov.measure = 'elapsed_window';
    /* v8-447.3: Laufband / virtuell — die Distanz ist geschaetzt bzw. modelliert, keine Strecke. Nur wenn der
       Garmin-Typ es BELEGT. Fehlt der Typ oder ist er generisch, sperrt das die Bestzeit nicht (Kontext null). */
    if (NO_REAL_DISTANCE[c.prov.context.environment]) { why(c, 'unsupported_source'); return; }
    if (!item || item.q === 'too_short' || num(item.s) === null) { why(c, 'missing_data'); return; }
    if (item.q !== 'measured') { why(c, 'insufficient_resolution'); return; }
    c.prov.quality = 'exact';
    /* v8-451: tatsaechliche Strecke des Fensters (Ziel + Ueberhang des Workers) — fuer die Messdetails der Anzeige */
    if (num(item.over_m) !== null) c.prov.distanceM = t + item.over_m;
    if ((obj(c.be.distance) || {}).basis !== 'elapsed') why(c, 'invalid_time_axis');
    needEvidence(c, 'details.distance'); needEvidence(c, 'details.time');
    if (corrected(c, 'duration') && num(c.a.durationSeconds) !== null && c.a.durationSeconds < item.s) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
    if (corrected(c, 'distance') && distanceM(c) !== null && distanceM(c) < t) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
  } };

  /* ---- v8-449.1 · AKTIVE Trainingsbestzeit (Timer) und Wettkampf --------------------------------------
     Zwei Zeitbegriffe, nie gegeneinander verglichen:
       distanceBest        verstrichene Zeit (Pausen zaehlen mit) — „am Stueck", Grundlage fuer Prognosen
       distanceBestActive  aktive Zeit (Timer laeuft; manuelle UND Auto-Pause ausgeschlossen — Garmin
                           unterscheidet sie in der Detailantwort nicht)
     Kandidaten der aktiven Zeit, der kleinste zaehlt — jeder ist eine Obergrenze der wahren aktiven Zeit:
       A timer_window    Worker: Timer-Differenz zwischen zwei echten Messzeilen (best_efforts.distance_active,
                         alle Zeilen; Strecke bei stehendem Timer trennt die Reihe)
       B activity_timer  ganze Aktivitaet, nur wenn ihre (freigegebene) Distanz die Zielstrecke trifft
                         (Ueberhang ≤ 10 m / 1 %, wie im Worker): Garmin-Timer-Summe metrics.garmin.timer_duration_s.
                         Gekennzeichnet als Gesamtzeit — nie als exaktes 5,000-km-Fenster.
       C elapsed_window  das verstrichene Fenster (distanceBest): enthaelt die aktive Zeit, ist also auch fuer sie
                         eine gueltige Obergrenze
     Keine Bewegungszeit (movingDuration ist Garmins Schaetzung), keine Interpolation, keine Timer-Ereignisse. */
  var OVER_ABS_M = 10, OVER_REL = 0.01;
  function overOk(d, t) { return d >= t && d <= t + Math.max(OVER_ABS_M, OVER_REL * t) + 1e-9; }
  METRICS.distanceBestActive = { sports: FOOT, param: 'targetM', check: function (c) {
    var t = c.opts.targetM;
    if (DISTANCE_TARGETS.indexOf(t) < 0) { why(c, 'unknown_metric'); return; }
    if (NO_REAL_DISTANCE[c.prov.context.environment]) { why(c, 'unsupported_source'); return; }
    c.prov.timeCategory = 'active';
    if (c.source !== 'garmin') {
      /* eigene Daten: es gibt keine Aufzeichnung — die Angabe des Nutzers IST die aktive Zeit seiner Einheit.
         Nur als ganze Einheit (keine Teilstrecken aus einer Gesamtangabe). */
      if (!OWN_SOURCES[c.source]) { why(c, 'unsupported_source'); return; }
      var od = eff(c, 'distance', distanceM(c)), ot = eff(c, 'duration', num(c.a.durationSeconds));
      c.prov.basis = 'summary (Angabe: ganze Einheit)';
      if (od === null || ot === null || ot <= 0) { why(c, 'missing_data'); return; }
      if (!overOk(od, t)) { why(c, 'missing_data'); return; }
      needEvidence(c, 'own');
      c.active = { v: ot, kind: 'own_total', basis: 'summary (Angabe: ganze Einheit, ' + Math.round(od) + ' m)', quality: 'activity_total', distanceM: od };
      c.prov.quality = 'activity_total'; c.prov.measure = 'own_total'; c.prov.distanceM = od;
      return;
    }
    if (!garminCurrent(c)) return;
    if (!needEvidence(c, 'details.distance') | !needEvidence(c, 'details.durations')) return;
    var cands = [];
    var da = obj(c.be.distance_active), it = da ? obj((obj(da.targets) || {})[String(t)]) : null;
    if (da && da.status === 'ok' && it && it.q === 'measured' && num(it.s) !== null) {
      cands.push({ v: it.s, kind: 'timer_window', basis: 'best_efforts.distance_active.targets.' + t + ' (Timer, alle Messzeilen)', quality: 'exact', distanceM: num(it.over_m) !== null ? t + it.over_m : null });
    }
    var conflict = !!(da && num(da.conflicts) !== null && da.conflicts > 0);
    /* B: Zeit UND Strecke aus DERSELBEN Messzeile — der letzten der Detailantwort (Timer-Summe sumDuration →
       garmin.timer_duration_s, Distanz-Summe sumDistance → letzter Punkt von streams.distance; der Worker behaelt die
       letzte Zeile immer). Die Listenwerte (duration, distance) koennen um Sekundenbruchteile/Meter abweichen und werden
       nicht mit den Zeilenwerten gemischt. Die Distanz muss zudem als Ganzes freigegeben sein (Liste ↔ Messreihe). */
    var dE = evaluate(c.a, 'distance', {}), tE = evaluate(c.a, 'duration', {});
    var timer = num(c.g.timer_duration_s), el = num(c.g.elapsed_duration_s), rowEnd = lastNum((obj(c.m.streams) || {}).distance);
    var corrDur = corrected(c, 'duration'), corrDist = corrected(c, 'distance');
    if (!conflict && dE.eligible && tE.eligible) {
      if (corrDur || corrDist) {
        /* Nutzerangabe: wirksame Dauer und wirksame Distanz gehoeren zusammen (beide aus activity-effective) */
        if (overOk(dE.value, t)) cands.push({ v: tE.value, kind: 'activity_timer', basis: 'Korrektur (wirksam, ganze Aktivitaet ' + Math.round(dE.value) + ' m)', quality: 'activity_total', manual: true, distanceM: dE.value });
      } else if (timer !== null && rowEnd !== null && overOk(rowEnd, t) && (el === null || timer <= el + TOL.durationS)) {
        cands.push({ v: timer, kind: 'activity_timer', basis: 'letzte Messzeile: Timer-Summe und Distanz-Summe (ganze Aktivitaet, ' + Math.round(rowEnd) + ' m)', quality: 'activity_total', distanceM: rowEnd });
      }
    }
    var eE = evaluate(c.a, 'distanceBest', { targetM: t });
    if (eE.eligible) cands.push({ v: eE.value, kind: 'elapsed_window', basis: 'best_efforts.distance.targets.' + t + ' (verstrichene Zeit — Obergrenze der aktiven)', quality: 'exact', distanceM: eE.provenance.distanceM || null });
    if (!cands.length) {
      if (conflict && it && it.q === 'split_by_conflict') { why(c, 'pause_conflict'); return; }
      why(c, (it && it.q === 'coarse') ? 'insufficient_resolution' : 'missing_data');
      return;
    }
    cands.sort(function (x, y) { return x.v - y.v || (x.kind === 'timer_window' ? -1 : 1); });
    var b = cands[0];
    c.active = b;
    c.prov.basis = b.basis; c.prov.quality = b.quality; c.prov.measure = b.kind;
    if (b.distanceM) c.prov.distanceM = b.distanceM;
    if (b.manual) c.prov.manual = true;
    c.prov.candidates = cands.map(function (x) { return { kind: x.kind, value: x.v }; });
    if (da && da.status === 'ok') c.prov.pauses = { count: num(da.pauses), pausedS: num(da.paused_s), conflicts: num(da.conflicts) || 0 };
    else if (timer !== null && el !== null) c.prov.pauses = { count: null, pausedS: Math.max(0, Math.round((el - timer) * 10) / 10), conflicts: null };
    if (corrDur && b.kind !== 'activity_timer' && num(c.a.durationSeconds) !== null && c.a.durationSeconds < b.v) { c.prov.manual = true; why(c, 'manual_override_conflict'); }
  } };

  /* Wettkampfbestzeit (vorbereitet): NUR fuer eine Aktivitaet, die der Nutzer als Wettkampfergebnis BESTAETIGT hat
     (opts.raceConfirmed) — nie aus der Sportart oder dem Datum geraten. Wert = ganze Aktivitaet, verstrichene Zeit
     (Garmin elapsed_duration_s; eigene Daten: die Angabe), Distanz trifft die Wettkampfstrecke. */
  METRICS.raceResult = { sports: FOOT, param: 'targetM', check: function (c) {
    var t = c.opts.targetM;
    if (DISTANCE_TARGETS.indexOf(t) < 0) { why(c, 'unknown_metric'); return; }
    c.prov.timeCategory = 'race';
    if (c.opts.raceConfirmed !== true) { why(c, 'unsupported_source'); return; }
    c.prov.raceConfirmedBy = 'user';
    if (NO_REAL_DISTANCE[c.prov.context.environment]) { why(c, 'unsupported_source'); return; }
    var dE = evaluate(c.a, 'distance', {});
    if (!dE.eligible) { dE.reasons.forEach(function (x) { why(c, x); }); return; }
    if (!overOk(dE.value, t)) { why(c, 'missing_data'); return; }
    if (c.source === 'garmin') {
      if (!garminCurrent(c) || !needEvidence(c, 'details.durations')) return;
      var el = num(c.g.elapsed_duration_s);
      if (el === null) { why(c, 'missing_data'); return; }
      c.race = el; c.prov.basis = 'garmin.elapsed_duration_s (ganze Aktivitaet, von dir als Wettkampf bestaetigt)';
    } else {
      if (!OWN_SOURCES[c.source]) { why(c, 'unsupported_source'); return; }
      var ot = eff(c, 'duration', num(c.a.durationSeconds));
      if (ot === null) { why(c, 'missing_data'); return; }
      needEvidence(c, 'own'); c.race = ot; c.prov.basis = 'summary (Angabe, von dir als Wettkampf bestaetigt)';
    }
    c.prov.quality = 'activity_total'; c.prov.measure = 'race_total'; c.prov.distanceM = dE.value;
  } };

  function swimField(field) {
    return function (c) {
      if (c.source !== 'garmin') { why(c, 'unsupported_source'); return; }
      if (!garminCurrent(c)) return;
      /* nur Becken (Freiwasser: keine Bahnen). v8-447.3: fehlt der Typ, ist der Kontext unbelegt → missing_data */
      if (!c.prov.context.typeKey) { why(c, 'missing_data'); return; }
      if (c.prov.context.environment !== 'pool') { why(c, 'unsupported_source'); return; }
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

  /* v8-448A · Wert je Kennzahl — dieselbe Grundlage wie die Pruefung oben (provenance.basis). [wert, einheit] */
  function eff(c, key, fallback) {
    try { if (c.E && c.E.getEffectiveMetric) { var v = c.E.getEffectiveMetric(c.a, key); if (num(v) !== null) return v; } } catch (e) {}
    return fallback;
  }
  function stat(c, key, field) { var st = obj((obj(c.be.stats) || {})[key]); return st ? num(st[field]) : null; }
  function fieldOf(c, f) { var ext = obj(c.m.ext), fs = ext ? obj(ext.fields) : null; return fs ? num(fs[f]) : null; }
  function ownOr(c, sumKey, streamKey, field) { return c.source === 'garmin' ? stat(c, streamKey, field) : num(c.sum[sumKey]); }
  var VALUE = {
    duration: function (c) { return [eff(c, 'duration', num(c.a.durationSeconds)), 's']; },
    distance: function (c) { return [eff(c, 'distance', distanceM(c)), 'm']; },
    pace: function (c) { var d = eff(c, 'duration', num(c.a.durationSeconds)), m = eff(c, 'distance', distanceM(c)); return [(d && m) ? d / (m / 1000) : null, 's/km']; },
    heartRate: function (c) { return [ownOr(c, 'avgHr', 'heart_rate', 'avg'), 'bpm']; },
    maxHeartRate: function (c) { return [ownOr(c, 'maxHr', 'heart_rate', 'max'), 'bpm']; },
    runningCadence: function (c) { var ok = obj((obj(c.g.semantics_ok) || {}).averageRunningCadence); return [ok ? num(ok.list) : null, 'spm']; },
    cyclingCadence: function (c) { return [stat(c, 'cadence', 'avg'), 'rpm']; },
    power: function (c) { return [stat(c, 'power', 'avg'), 'W']; },
    powerBest: function (c) { var it = obj((obj((obj(c.be.power) || {}).windows) || {})[String(c.opts.windowS)]); return [it ? num(it.w) : null, 'W']; },
    distanceBest: function (c) { var it = obj((obj((obj(c.be.distance) || {}).targets) || {})[String(c.opts.targetM)]); return [it ? num(it.s) : null, 's']; },
    distanceBestActive: function (c) { return [c.active ? num(c.active.v) : null, 's']; },
    raceResult: function (c) { return [num(c.race), 's']; },
    swolf: function (c) { return [fieldOf(c, 'averageSwolf'), 'swolf']; },
    strokeRate: function (c) { return [fieldOf(c, 'averageSwimCadenceInStrokesPerMinute'), 'spm']; },
    trainingEffect: function (c) { return [fieldOf(c, 'aerobicTrainingEffect'), 'te']; },
    strengthVolume: function (c) { return [c.source === 'garmin' ? null : num(c.sum.totalVolumeKg), 'kg']; },   // Garmin-Einheit unbelegt: nie ein Wert
    calories: function (c) { return [num(c.sum.caloriesKcal), 'kcal']; },
    ftp: function () { return [null, 'W']; }
  };

  function evaluate(owner, metric, opts) {
    var c = ctxOf(owner, opts);
    var def = METRICS[metric];
    if (!def) { return { eligible: false, reason: 'unknown_metric', reasons: ['unknown_metric'], provenance: c.prov }; }
    if (c.a.status && c.a.status !== 'completed') why(c, 'not_completed');
    if (def.sports && !def.sports[c.sport]) why(c, 'unsupported_sport');
    else { try { def.check(c); } catch (e) { why(c, 'missing_data'); } }
    /* v8-447.3 · kontextgebundene Auswertung (z. B. „Bestwert draussen"): nur mit BELEGTEM Kontext */
    if (c.opts.environment && c.prov.context.environment !== c.opts.environment) why(c, 'unverified_context');
    var value = null, unit = null;
    if (!c.reasons.length) {
      var vu = null;
      try { vu = VALUE[metric] ? VALUE[metric](c) : null; } catch (e) { vu = null; }
      value = vu ? num(vu[0]) : null; unit = vu ? vu[1] : null;
      if (value === null || value < 0) { why(c, 'missing_data'); value = null; }          // kein lesbarer Wert = nicht zulaessig, nie geschaetzt
    }
    return { eligible: c.reasons.length === 0, reason: c.reasons.length ? c.reasons[0] : null, reasons: c.reasons, provenance: c.prov, value: value, unit: unit };
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
    'unsupported_source', 'unsupported_sport', 'manual_override_conflict', 'not_completed', 'unverified_context', 'pause_conflict', 'unknown_metric'];

  var api = {
    evaluate: evaluate, isMetricLedgerEligible: isMetricLedgerEligible, overview: overview, level: level,
    contextOf: contextOf, provenanceStatus: provenanceStatus, CONTEXT: CONTEXT, PROVENANCE_REQUIRED: PROV_REQUIRED.slice(),
    METRICS: Object.keys(METRICS), REASONS: REASONS, EVIDENCE: EVIDENCE, TRUSTED: Object.keys(TRUSTED), VALIDATIONS: VALIDATIONS, GATE_LOG: GATE_LOG,
    POWER_WINDOWS: POWER_WINDOWS.slice(), DISTANCE_TARGETS: DISTANCE_TARGETS.slice(), TOLERANCES: TOL, DETAILS_VERSION_CURRENT: CURRENT,
    sportsOf: function (metric) { var d = METRICS[metric]; return d ? (d.sports ? Object.keys(d.sports) : null) : undefined; },
    paramOf: function (metric) { var d = METRICS[metric]; return d ? (d.param || null) : undefined; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.metricEligibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
