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

  /* ==================================================================================================
     v8-452 · KENNZAHLEN DER AKTIVITAETSANSICHT — describeActivity(owner, opts)

     evaluate() oben beantwortet: darf eine Kennzahl HISTORISCH festgeschrieben werden (Register)?
     describeActivity() beantwortet fuer die Ansicht EINER Einheit, je Kennzahl getrennt:
       status      available       Wert liegt vor
                   not_delivered   Garmin hat das Feld / die Reihe fuer diese Einheit nicht geliefert
                   not_imported    nie abgefragt (Zusatzabruf aus, Details nicht geladen, Altzeile ohne Rohfelder)
                   not_stored      geliefert, vom Worker aber nicht erhalten (nur der Name ist bekannt)
                   not_loaded      gespeichert, in der App aber (noch) nicht geladen — Rohblock liegt nur auf dem Server
                   not_applicable  gibt es in diesem Kontext nicht (Bahnen im Freiwasser)
       validation  validated       Bedeutung belegt (EVIDENCE: fixture / validated / eigene Daten) — darf in Langzeitauswertungen
                   consistent      in DIESER Einheit durch eine zweite, unabhaengige Angabe bestaetigt (z. B. Laengen × Bahnlaenge = Distanz)
                   unverified      von der Quelle uebernommen, Bedeutung in ORVIA nicht belegt — Anzeige als Quellwert, nie als „gemessen"
                   blocked         unplausibel oder Einheit ungeklaert — wird nicht angezeigt
       method      measured | derived (aus anderen Werten nach fester Formel) | manual (Nutzerangabe) — nie geschaetzt
       source      garmin_list | garmin_details | garmin_extras | own | manual | derived
     Nichts wird geschaetzt oder aufgefuellt; fehlt ein Wert, bleibt er fehlend und traegt seinen Grund.
     Die Liste ist Grundlage der sportartspezifischen Ansicht (engine/activity-analysis.js) und der
     Vollstaendigkeits-Diagnose. Das Register liest weiter NUR evaluate() — hier aendert sich fuer Rekorde nichts.
     ================================================================================================== */
  var DESCRIBE_VERSION = 'activity-metrics@1';
  /* Plausibilitaet: ausserhalb ⇒ blocked (nie angezeigt). Grenzen bewusst weit — sie fangen Einheitenfehler, keine Leistungen. */
  var PLAUS = {
    pace100: [30, 900],        // s je 100 m Schwimmen
    paceKm: [100, 1800],       // s je km Laufen/Gehen
    speedKmh: [1, 100],        // km/h Rad
    swolf: [10, 250], strokeRate: [5, 150], strokesPerLength: [1, 120], heartRate: [25, 240],
    poolLengthM: [10, 100], power: [1, 3000], runningCadence: [60, 260], cyclingCadence: [10, 200]
  };
  function inList(l, k) { return Array.isArray(l) && l.indexOf(k) >= 0; }
  function nz(v) { return num(v) !== null && v > 0 ? v : null; }
  function extState(a, opts) {
    var m = obj(a.metrics) || {};
    if (obj(m.ext)) return 'loaded';
    if (opts && opts.extState) return opts.extState;     // 'loaded' (Server hat keinen Rohblock) | 'pending' | 'unavailable'
    return 'unknown';
  }
  /* Rohfeld des Garmin-Listeneintrags (metrics.ext.fields) */
  function readField(a, name, opts) {
    if (a.source !== 'garmin') return { status: 'not_delivered', reason: 'source_without_field' };
    var m = obj(a.metrics) || {}, ext = obj(m.ext), st = extState(a, opts);
    if (!ext) return st === 'loaded' ? { status: 'not_imported', reason: 'no_raw_block' } : { status: 'not_loaded', reason: st === 'unknown' ? 'raw_block_not_loaded' : 'raw_block_' + st };
    var f = obj(ext.fields), v = f ? f[name] : undefined;
    if (v !== undefined && v !== null && v !== '') return { status: 'available', value: v, source: 'garmin_list', basis: 'ext.fields.' + name };
    if (inList(ext.rejected, name) || inList(ext.unrecognized, name)) return { status: 'not_stored', reason: 'dropped_by_worker', basis: 'ext.fields.' + name };
    if (!f) return { status: 'not_imported', reason: 'no_list_fields' };
    return { status: 'not_delivered', reason: 'field_absent', basis: 'ext.fields.' + name };
  }
  /* Zusatzreihe der Detailantwort (metrics.ext.series), gleicher Index wie die kanonischen Reihen */
  function readSeries(a, names, opts) {
    if (a.source !== 'garmin') return { status: 'not_delivered', reason: 'source_without_series' };
    var m = obj(a.metrics) || {};
    if (!m.detailsFetchedAt && num(m.detailsVersion) === null) return { status: 'not_imported', reason: 'details_not_loaded' };
    if (num(m.detailsVersion) !== null && m.detailsVersion < CURRENT) return { status: 'not_imported', reason: 'details_outdated' };   // Zusatzreihen gibt es erst ab Vertrag 3
    var ext = obj(m.ext), st = extState(a, opts);
    if (!ext) return st === 'loaded' ? { status: 'not_delivered', reason: 'series_absent' } : { status: 'not_loaded', reason: st === 'unknown' ? 'raw_block_not_loaded' : 'raw_block_' + st };
    var se = obj(ext.series) || {};
    for (var i = 0; i < names.length; i++) {
      var s = obj(se[names[i]]);
      if (s && Array.isArray(s.values) && s.values.some(function (x) { return num(x) !== null; })) return { status: 'available', value: s.values, unit: s.garmin_unit || null, source: 'garmin_details', basis: 'ext.series.' + names[i] };
    }
    for (var j = 0; j < names.length; j++) if (inList(ext.series_unparsed, names[j])) return { status: 'not_stored', reason: 'dropped_by_worker', basis: 'ext.series.' + names[j] };
    return { status: 'not_delivered', reason: 'series_absent', basis: 'ext.series.' + names[0] };
  }
  /* Kanonische Messreihe (metrics.streams) */
  function readStream(a, key) {
    var m = obj(a.metrics) || {}, st = obj(m.streams) || {}, v = st[key];
    if (Array.isArray(v) && v.some(function (x) { return num(x) !== null; })) {
      var md = obj((obj(m.stream_meta) || {})[key]);
      return { status: 'available', value: v, source: a.source === 'garmin' ? 'garmin_details' : (OWN_SOURCES[a.source] ? 'own' : (a.source || null)), basis: 'streams.' + key + (md && md.source ? ' (' + md.source + ')' : ''), meta: md };
    }
    if (a.source === 'garmin' && !m.detailsFetchedAt && num(m.detailsVersion) === null) return { status: 'not_imported', reason: 'details_not_loaded' };
    return { status: 'not_delivered', reason: 'series_absent', basis: 'streams.' + key };
  }
  /* Runden/Intervalle (Zusatzabruf get_activity_splits → metrics.splits) */
  function readLaps(a, opts) {
    var m = obj(a.metrics) || {};
    if (Array.isArray(m.splits) && m.splits.length) return { status: 'available', value: m.splits, source: m.splits_source === 'garmin_splits' ? 'garmin_extras' : (a.source === 'garmin' ? 'garmin_details' : 'own'), basis: 'splits' + (m.splits_source ? ' (' + m.splits_source + ')' : '') };
    if (a.source !== 'garmin') return { status: 'not_delivered', reason: 'source_without_laps' };
    var ext = obj(m.ext), st = extState(a, opts);
    if (!ext) return st === 'loaded' ? { status: 'not_imported', reason: 'extras_disabled' } : { status: 'not_loaded', reason: st === 'unknown' ? 'raw_block_not_loaded' : 'raw_block_' + st };
    var x = (obj(ext.extras) || {}).splits;
    if (x === 'failed') return { status: 'not_delivered', reason: 'fetch_failed' };
    if (x === 'empty') return { status: 'not_delivered', reason: 'empty_response' };
    if (x === 'ok') return { status: 'not_delivered', reason: 'laps_unreadable' };      // Antwort da, aber ohne Runden in lesbarer Form
    return { status: 'not_imported', reason: 'extras_disabled' };
  }
  /* Bahnen einzeln. v8-453: belegt am Garmin-Mitschnitt (18.10.2026) — die Bahnen stecken in der RUNDEN-Antwort
     (metrics.ext.splits.lapDTOs[].lengthDTOs, Bahn ohne Distanz = Pause). get_activity_typed_splits lieferte leer; liegt dort
     doch etwas, bleibt es gesperrt (Form unbelegt). Gegenprobe: aktive Bahnen = activeLengths des Listeneintrags. */
  function readLengths(a, opts) {
    if (a.source !== 'garmin') return { status: 'not_delivered', reason: 'source_without_lengths' };
    var m = obj(a.metrics) || {}, ext = obj(m.ext), st = extState(a, opts);
    if (!ext) return st === 'loaded' ? { status: 'not_imported', reason: 'extras_disabled' } : { status: 'not_loaded', reason: st === 'unknown' ? 'raw_block_not_loaded' : 'raw_block_' + st };
    var sp = obj(ext.splits), lapsRaw = sp && Array.isArray(sp.lapDTOs) ? sp.lapDTOs : null;
    if (lapsRaw) {
      var L = [];
      lapsRaw.forEach(function (l) { if (obj(l) && Array.isArray(l.lengthDTOs)) l.lengthDTOs.forEach(function (x) { if (obj(x)) L.push(x); }); });
      if (L.length) {
        var act = L.filter(function (x) { return (num(x.distance) || 0) > 0; }).length, want = num((obj(ext.fields) || {}).activeLengths);
        return { status: 'available', value: L, source: 'garmin_extras', basis: 'ext.splits.lapDTOs[].lengthDTOs', activeCount: act, countMatch: want === null ? null : act === want };
      }
      return { status: 'not_delivered', reason: 'laps_without_lengths' };
    }
    if (ext.typed_splits && !(Array.isArray(ext.typed_splits.splits) && !ext.typed_splits.splits.length)) return { status: 'available', value: ext.typed_splits, source: 'garmin_extras', basis: 'ext.typed_splits', shapeUnverified: true };
    var x = (obj(ext.extras) || {}).typed_splits;
    if (x === 'failed') return { status: 'not_delivered', reason: 'fetch_failed' };
    if (x === 'empty') return { status: 'not_delivered', reason: 'empty_response' };
    return { status: 'not_imported', reason: 'extras_disabled' };
  }
  function durationRead(a) {
    var d = eff({ a: a, E: EFF() }, 'duration', num(a.durationSeconds));
    if (num(d) === null || d <= 0) return { status: 'not_delivered', reason: 'value_absent' };
    var manual = corrected({ a: a, E: EFF() }, 'duration');
    return { status: 'available', value: d, method: manual ? 'manual' : 'measured', source: manual ? 'manual' : (a.source === 'garmin' ? 'garmin_list' : (OWN_SOURCES[a.source] ? 'own' : a.source)), basis: manual ? 'corrections.duration (wirksam)' : 'duration_seconds' };
  }
  function distanceRead(a) {
    var c = { a: a, sum: obj(a.summary) || {}, E: EFF() };
    var d = eff(c, 'distance', distanceM(c));
    if (num(d) === null || d <= 0) return { status: 'not_delivered', reason: 'value_absent' };
    var manual = corrected(c, 'distance');
    return { status: 'available', value: d, method: manual ? 'manual' : 'measured', source: manual ? 'manual' : (a.source === 'garmin' ? 'garmin_list' : (OWN_SOURCES[a.source] ? 'own' : a.source)), basis: manual ? 'corrections.distance (wirksam)' : 'summary.distanceM' };
  }
  function sumRead(a, key, src) {
    var v = num((obj(a.summary) || {})[key]);
    if (v === null) return { status: 'not_delivered', reason: 'value_absent' };
    return { status: 'available', value: v, source: a.source === 'garmin' ? (src || 'garmin_list') : (OWN_SOURCES[a.source] ? 'own' : a.source), basis: 'summary.' + key };
  }
  function garminRead(a, key) {
    var g = obj((obj(a.metrics) || {}).garmin) || {}, v = num(g[key]);
    if (a.source !== 'garmin') return { status: 'not_delivered', reason: 'source_without_field' };
    if (v === null) return { status: (obj(a.metrics) || {}).detailsFetchedAt ? 'not_delivered' : 'not_imported', reason: (obj(a.metrics) || {}).detailsFetchedAt ? 'value_absent' : 'details_not_loaded' };
    return { status: 'available', value: v, source: 'garmin_details', basis: 'garmin.' + key };
  }
  /* Bahnlaenge in Metern: Einheit des Listenfelds ist unbelegt (Meter ODER Zentimeter, ggf. Yards) — gilt nur die
     EINE plausible Lesart, sonst gesperrt. Gleiche Lesarten wie die Bedeutungspruefung des Workers (semantic_checks). */
  function poolLengthM(raw, unit) {
    var pl = num(raw); if (pl === null || pl <= 0) return null;
    var yard = /^yard/i.test(String((obj(unit) || {}).unitKey || unit || '')) ? 0.9144 : 1;
    var c = [pl * yard, pl / 100 * yard].filter(function (x) { return x >= PLAUS.poolLengthM[0] && x <= PLAUS.poolLengthM[1]; });
    return c.length === 1 ? Math.round(c[0] * 100) / 100 : null;
  }
  function evLevel(key, sport) { var lv = level(key, sport); return TRUSTED[lv] ? 'validated' : 'unverified'; }
  function eligState(a, metric, o) {
    var r = evaluate(a, metric, o || {});
    if (r.eligible) return { validation: 'validated' };
    if (r.reasons.indexOf('not_completed') >= 0) return { validation: 'unverified', reason: 'not_completed' };
    var ev = (r.provenance && r.provenance.evidence) || {}, bad = Object.keys(ev).filter(function (k) { return !TRUSTED[ev[k]]; })[0];
    if (r.reasons.indexOf('unverified_semantics') >= 0) return { validation: 'unverified', reason: bad ? 'evidence_' + ev[bad] : 'sources_disagree' };
    return { validation: 'unverified', reason: r.reasons[0] };
  }
  function worst(vs) { var o = ['blocked', 'unverified', 'consistent', 'validated'], w = 3; vs.forEach(function (v) { var i = o.indexOf(v); if (i >= 0 && i < w) w = i; }); return o[w]; }
  function plaus(v, k) { var p = PLAUS[k]; return !p || (num(v) !== null && v >= p[0] && v <= p[1]); }

  /* Katalog: id → { sports (null = alle), unit, group, read(a, ctx) → Teilergebnis, check(a, r, ctx) → { validation, reason } } */
  var AM = [];
  function am(id, sports, unit, group, read, check) { AM.push({ id: id, sports: sports, unit: unit, group: group, read: read, check: check || null }); }
  var SWIM = ['swimming'], RUN = ['running', 'walking', 'hiking'], BIKE = ['cycling'], GYM = ['gym'];
  var ownOk = function (a) { return OWN_SOURCES[a.source] ? { validation: 'validated', reason: 'own_data' } : null; };

  am('duration', null, 's', 'base', function (a) { return durationRead(a); },
     function (a, r) { if (r.method === 'manual') return { validation: 'validated', reason: 'manual_correction' }; return ownOk(a) || eligState(a, 'duration'); });
  am('elapsed', null, 's', 'base', function (a, x) { var r = garminRead(a, 'elapsed_duration_s'); if (r.status !== 'available') { var f = readField(a, 'elapsedDuration', x.opts); if (f.status === 'available') return f; } return r; },
     function (a) { return { validation: evLevel('details.durations', a.sportId) }; });
  /* v8-454.1 · Timer-Zeit: Ende der Aufzeichnung (sumDuration). Zwei Garmin-Quellen koennen widersprechen — Befund Zwift 07.10.2026:
     Zusammenfassung/Runde 3734 s, Messreihe 4401 s = Gesamtzeit, obwohl 3 Datenluecken (674 s) ohne Messzeile in der Reihe liegen.
     Laeuft die Reihen-„Uhr" ohne Halt durch (Ende = Gesamtzeit) und nennt die Zusammenfassung weniger, ist die Reihe dort keine
     Timer-Zeit: dann gilt die Zusammenfassung — benannt (conflict), nie still angeglichen. Andere Widersprueche: Reihe bleibt, ungeprueft. */
  function timerSummary(a, x) {
    var f = readField(a, 'duration', x && x.opts);
    if (f.status === 'available' && num(f.value) !== null && f.value > 0) return { v: num(f.value), basis: 'ext.fields.duration' };
    var m = obj(a.metrics) || {};
    if (a.source === 'garmin' && num(a.durationSeconds) > 0 && !obj(m.corrections) && !obj(m.durationCorrection)) return { v: num(a.durationSeconds), basis: 'duration_seconds' };
    return null;
  }
  am('timer', null, 's', 'base', function (a, x) {
       var r = garminRead(a, 'timer_duration_s');
       if (r.status !== 'available') return r;
       var s = timerSummary(a, x); if (!s || Math.abs(r.value - s.v) <= Math.max(5, s.v * 0.01)) return r;
       var e = num((obj((obj(a.metrics) || {}).garmin) || {}).elapsed_duration_s);
       var noStops = e !== null && Math.abs(r.value - e) <= 2 && s.v < e - 5;
       var c = { series: r.value, summary: s.v, elapsed: e, use: noStops ? 'summary' : 'series', reason: noStops ? 'series_timer_without_stops' : 'sources_differ' };
       return noStops ? { status: 'available', value: s.v, source: 'garmin_list', basis: s.basis, conflict: c } : Object.assign({}, r, { conflict: c });
     }, function (a, r) {
       if (r.conflict && r.conflict.use === 'series') return { validation: 'unverified', reason: 'sources_differ' };
       return { validation: evLevel('details.durations', a.sportId), reason: r.conflict ? r.conflict.reason : undefined };
     });
  /* Bewegungszeit: Aufzeichnung (sumMovingDuration) — beim Beckenschwimmen liefert Garmin dort 0 (Befund 18.10.2026, alle vier
     Beckeneinheiten); dann der Listenwert movingDuration. 0 ist kein Messwert. */
  am('moving', null, 's', 'base', function (a, x) {
       var r = garminRead(a, 'moving_duration_s');
       if (r.status === 'available' && r.value > 0) return r;
       var f = readField(a, 'movingDuration', x.opts);
       if (f.status === 'available' && num(f.value) !== null && f.value > 0) return f;
       if (r.status === 'available' || (f.status === 'available' && num(f.value) === 0)) return { status: 'not_delivered', reason: 'zero_value', basis: r.basis || f.basis };
       return f.status === 'not_loaded' ? f : r;
     }, function (a, r, x) { return x.swimCheck && x.swimCheck.paceBasis === 'moving' ? { validation: 'consistent', reason: 'matches_garmin_avg_speed' } : { validation: 'unverified', reason: 'garmin_estimate' }; });      // Garmins eigene Schwelle (zwei Definitionen: Liste ≠ Aufzeichnung)
  am('pause', null, 's', 'base', function (a, x) {
       var t = x.get('timer'), e = x.get('elapsed');
       if (t.status !== 'available' || e.status !== 'available') return { status: t.status !== 'available' ? t.status : e.status, reason: 'needs_timer_and_elapsed' };
       if (e.value < t.value - 1) return { status: 'available', value: null, blocked: true, reason: 'elapsed_below_timer' };
       /* v8-456 · Beleg der Pause: Gesamtzeit − Timer allein beweist keinen Stopp.
            timer_counter  Garmins eigener Zeitzaehler der Aufzeichnung (sumDuration) stand still → Uhr angehalten, belegt
            unclear        Zeitzaehler lief durch (= Gesamtzeit), nur die Zusammenfassung nennt weniger → Ursache offen
                           (Zwift 07.10.2026: 3 Luecken ohne Messzeilen, Stopp nicht belegt)
            none           keine Differenz (≤ 2 s)
            derived_only   andere Quelle (eigene Daten, Korrektur) — nur die Rechnung */
       var v = Math.max(0, Math.round(e.value - t.value)), useSum = !!(t.conflict && t.conflict.use === 'summary');
       var ev = v <= 2 ? 'none' : (useSum ? 'unclear' : (t.basis === 'garmin.timer_duration_s' || /timer_duration_s/.test(String(t.basis || '')) ? 'timer_counter' : 'derived_only'));
       return { status: 'available', value: v, method: 'derived', source: 'derived', evidence: ev, basis: 'garmin.elapsed_duration_s − ' + (useSum ? 'ext.fields.duration' : 'garmin.timer_duration_s') };
     }, function (a, r, x) { if (r.blocked) return { validation: 'blocked', reason: r.reason }; return { validation: worst([x.get('timer').validation, x.get('elapsed').validation]) }; });
  am('distance', null, 'm', 'base', function (a) { return distanceRead(a); }, function (a, r, x) {
       if (r.method === 'manual') return { validation: 'validated', reason: 'manual_correction' };
       if (ownOk(a)) return ownOk(a);
       if (a.sportId === 'swimming' && x.poolCheck && x.poolCheck.ok) return { validation: 'consistent', reason: 'lengths_times_pool_length' };
       if (NO_REAL_DISTANCE[contextOf(a).environment]) return { validation: 'unverified', reason: 'modeled_distance' };
       return eligState(a, 'distance');
     });
  am('avgHr', null, 'bpm', 'heart', function (a) { return sumRead(a, 'avgHr'); }, function (a, r) { if (!plaus(r.value, 'heartRate')) return { validation: 'blocked', reason: 'implausible' }; return ownOk(a) || eligState(a, 'heartRate'); });
  am('maxHr', null, 'bpm', 'heart', function (a) { return sumRead(a, 'maxHr'); }, function (a, r) { if (!plaus(r.value, 'heartRate')) return { validation: 'blocked', reason: 'implausible' }; return ownOk(a) || eligState(a, 'maxHeartRate'); });
  am('calories', null, 'kcal', 'base', function (a) { return sumRead(a, 'caloriesKcal'); }, function (a) { return ownOk(a) || { validation: evLevel('list.calories', a.sportId), reason: 'evidence_library' }; });
  am('trainingEffect', null, 'te', 'load', function (a, x) { return readField(a, 'aerobicTrainingEffect', x.opts); }, function (a) { return { validation: evLevel('list.training_effect', a.sportId), reason: 'evidence_library' }; });
  am('trainingLoad', null, 'garmin_load', 'load', function (a) { var v = num((obj(a.metrics) || {}).training_load); return v === null ? { status: 'not_delivered', reason: 'value_absent' } : { status: 'available', value: v, source: 'garmin_list', basis: 'training_load' }; },
     function (a) { return { validation: evLevel('list.training_effect', a.sportId), reason: 'evidence_library' }; });
  am('hrSeries', null, 'bpm', 'series', function (a) { return readStream(a, 'heart_rate'); }, function (a) { return ownOk(a) || { validation: evLevel('details.heart_rate', a.sportId), reason: 'evidence_' + level('details.heart_rate', a.sportId) }; });
  am('timeAxis', null, 's', 'series', function (a) { return readStream(a, 'time'); }, function (a) { return { validation: evLevel('details.time', a.sportId) }; });
  am('laps', null, 'list', 'structure', function (a, x) { return readLaps(a, x.opts); }, function (a, r) {
    var own = ownOk(a); if (own) return own;
    /* v8-453 · Schwimmen: Summe der Rundendistanzen = Distanz UND Summe der aktiven Bahnen = activeLengths → in DIESER Einheit bestaetigt */
    if (String(a.sportId || '').toLowerCase() === 'swimming' && r && Array.isArray(r.value)) {
      var f = obj((obj((obj(a.metrics) || {}).ext) || {}).fields) || {}, dist = num(f.distance) !== null ? num(f.distance) : num((obj(a.summary) || {}).distanceM);
      var sd = 0, sl = 0, okL = true;
      r.value.forEach(function (l) { if (!obj(l)) return; sd += num(l.distance) || 0; if (num(l.numberOfActiveLengths) === null && (num(l.distance) || 0) > 0) okL = false; sl += num(l.numberOfActiveLengths) || 0; });
      var dOk = dist !== null && Math.abs(sd - dist) <= Math.max(1, dist * 0.01), lOk = okL && num(f.activeLengths) !== null && sl === num(f.activeLengths);
      if (dOk && lOk) return { validation: 'consistent', reason: 'lap_sums_match' };
    }
    return { validation: 'unverified', reason: 'evidence_assumed' };
  });
  am('route', null, 'points', 'structure', function (a) { var rt = (obj(a.metrics) || {}).route; return Array.isArray(rt) && rt.length > 1 ? { status: 'available', value: rt.length, source: a.source === 'garmin' ? 'garmin_details' : a.source, basis: 'route' } : { status: 'not_delivered', reason: 'no_gps' }; },
     function () { return { validation: 'unverified', reason: 'evidence_assumed' }; });

  /* ---- Schwimmen ---- */
  am('environment', SWIM.concat(RUN, BIKE), 'context', 'base', function (a) { var c = contextOf(a); return c.environment ? { status: 'available', value: c.environment, source: a.source === 'garmin' ? 'garmin_list' : 'own', basis: c.basis } : { status: 'not_delivered', reason: 'context_unknown', basis: c.basis }; },
     function (a) { return { validation: 'validated', reason: a.source === 'garmin' ? 'type_name' : 'own_data' }; });   // Kontext nur aus ausdruecklichem Typnamen bzw. eigener Angabe (CONTEXT)
  /* Ø Tempo /100 m mit GARMINS Zeitbegriff: die Zeitbasis (Bewegungszeit oder Timer), deren Distanz/Zeit Garmins
     Ø-Geschwindigkeit (averageSpeed) dieser Einheit trifft. Befund 18.10.2026: Becken = Bewegungszeit (alle vier), Freiwasser =
     Timer (beide). Trifft keine: Bewegungszeit, sonst Dauer — als ungeprueft. Die andere Basis steht als zweite Zahl daneben,
     wenn sie sich um mehr als 5 % unterscheidet (pace100Moving / pace100Total). */
  function paceRead(kind) { return function (a, x) {
       var d = x.get('distance'), mv = x.get('moving'), t = x.get('duration');
       if (d.status !== 'available') return { status: d.status, reason: 'needs_distance_and_duration' };
       var sc = x.swimCheck || {}, main = sc.paceBasis || (mv.status === 'available' ? 'moving' : 'timer');
       var basis = kind === 'main' ? main : kind;
       var tv = basis === 'moving' ? mv : t;
       if (tv.status !== 'available') return { status: tv.status, reason: basis === 'moving' ? 'needs_distance_and_moving_time' : 'needs_distance_and_duration' };
       var v = tv.value / (d.value / 100);
       if (kind !== 'main') {
         if (basis === main) return { status: 'not_applicable', reason: 'same_as_main' };
         var other = (main === 'moving' ? mv : t);
         if (other.status === 'available' && Math.abs(tv.value - other.value) <= 0.05 * Math.max(tv.value, other.value)) return { status: 'not_applicable', reason: 'no_rest_difference' };
       }
       return { status: 'available', value: v, method: 'derived', source: 'derived', paceBasis: basis, basis: (basis === 'moving' ? 'Bewegungszeit' : 'Dauer') + ' / (Distanz / 100 m)' };
     }; }
  function paceCheck(a, r, x) {
    if (!plaus(r.value, 'pace100')) return { validation: 'blocked', reason: 'implausible' };
    var sc = x.swimCheck || {};
    if (sc.paceBasis && sc.paceBasis === r.paceBasis) return { validation: worst([x.get('distance').validation === 'validated' ? 'validated' : 'consistent', 'consistent']), reason: 'matches_garmin_avg_speed' };
    return { validation: worst([x.get('distance').validation, 'unverified']), reason: r.paceBasis === 'moving' ? 'garmin_estimate' : null };
  }
  am('pace100', SWIM, 's/100m', 'pace', paceRead('main'), paceCheck);
  am('pace100Moving', SWIM, 's/100m', 'pace', paceRead('moving'), paceCheck);
  am('pace100Total', SWIM, 's/100m', 'pace', paceRead('timer'), paceCheck);
  /* Ruhezeit = Timer − Bewegungszeit (Garmin): Zeit, in der die Uhr lief, ohne dass geschwommen wurde (Pausen am Beckenrand). */
  am('restTime', SWIM, 's', 'swim', function (a, x) {
       var t = x.get('timer'), mv = x.get('moving');
       if (t.status !== 'available' || mv.status !== 'available') return { status: t.status !== 'available' ? t.status : mv.status, reason: 'needs_timer_and_moving_time' };
       if (mv.value > t.value + 5) return { status: 'available', value: null, blocked: true, reason: 'moving_above_timer' };
       var v = Math.round(t.value - mv.value);
       if (v < 0.05 * t.value) return { status: 'not_applicable', reason: 'no_rest_difference' };
       return { status: 'available', value: v, method: 'derived', source: 'derived', basis: 'Timer − Bewegungszeit' };
     }, function (a, r, x) { return { validation: worst([x.get('timer').validation, x.get('moving').validation]) }; });
  var POOL_ONLY = function (a) { var e = contextOf(a).environment; return e === 'open_water' ? { status: 'not_applicable', reason: 'open_water' } : null; };
  am('poolLength', SWIM, 'm', 'swim', function (a, x) {
       var na = POOL_ONLY(a); if (na) return na;
       var r = readField(a, 'poolLength', x.opts); if (r.status !== 'available') return r;
       var u = readField(a, 'unitOfPoolLength', x.opts), m = poolLengthM(r.value, u.status === 'available' ? u.value : null);
       return m === null ? { status: 'available', value: null, raw: r.value, blocked: true, reason: 'unit_unresolved', source: 'garmin_list', basis: r.basis } : { status: 'available', value: m, raw: r.value, source: 'garmin_list', basis: r.basis + (u.status === 'available' ? ' + unitOfPoolLength' : '') };
     }, function (a, r, x) { if (r.blocked) return { validation: 'blocked', reason: r.reason }; return x.poolCheck && x.poolCheck.ok ? { validation: 'consistent', reason: 'lengths_times_pool_length' } : { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; });
  am('activeLengths', SWIM, 'count', 'swim', function (a, x) { return POOL_ONLY(a) || readField(a, 'activeLengths', x.opts); },
     function (a, r, x) { if (!(r.value >= 1)) return { validation: 'blocked', reason: 'implausible' }; return x.poolCheck && x.poolCheck.ok ? { validation: 'consistent', reason: 'lengths_times_pool_length' } : { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; });
  var SWIM_EV = function (k) { return function (a, r) { if (k && !plaus(r.value, k)) return { validation: 'blocked', reason: 'implausible' }; return { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; }; };
  /* Gegenpruefungen innerhalb der Einheit (swimCheck, Befund 18.10.2026: in allen vier Beckeneinheiten erfuellt):
       Zuege = Zuege je Bahn × Bahnen · SWOLF = Zuege je Bahn + Sekunden je Bahn (Bewegungszeit ÷ Bahnen) · Zugfrequenz = Zuege ÷ Bewegungsminuten */
  var SWIM_CK = function (flag, why, k) { return function (a, r, x) {
    if (k && !plaus(r.value, k)) return { validation: 'blocked', reason: 'implausible' };
    if (x.swimCheck && x.swimCheck[flag]) return { validation: 'consistent', reason: why };
    return { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; }; };
  am('strokes', SWIM, 'count', 'swim', function (a, x) { return readField(a, 'strokes', x.opts); }, function (a, r, x) { if (!(r.value >= 1)) return { validation: 'blocked', reason: 'implausible' }; return SWIM_CK('strokesOk', 'strokes_per_length_times_lengths')(a, r, x); });
  am('strokesPerLength', SWIM, 'count/length', 'swim', function (a, x) { return POOL_ONLY(a) || readField(a, 'avgStrokes', x.opts); }, SWIM_CK('strokesOk', 'strokes_per_length_times_lengths', 'strokesPerLength'));
  am('swolf', SWIM, 'swolf', 'swim', function (a, x) { return POOL_ONLY(a) || readField(a, 'averageSwolf', x.opts); }, SWIM_CK('swolfOk', 'swolf_definition', 'swolf'));
  am('strokeRate', SWIM, 'spm', 'swim', function (a, x) { return readField(a, 'averageSwimCadenceInStrokesPerMinute', x.opts); }, SWIM_CK('strokeRateOk', 'strokes_per_moving_minute', 'strokeRate'));
  am('maxStrokeRate', SWIM, 'spm', 'swim', function (a, x) { return readField(a, 'maxSwimCadenceInStrokesPerMinute', x.opts); }, SWIM_EV('strokeRate'));
  /* Strecke je Zug: Listenfeld in Zentimetern (Befund 18.10.2026, Freiwasser: 103 ≈ 899,95 m ÷ 877 Zuege). Beim Beckenschwimmen
     liefert Garmin 0 — kein Messwert. Angezeigt nur, wenn Distanz ÷ Zuege die Einheit in DIESER Einheit bestaetigt. */
  am('strokeDistance', SWIM, 'm', 'swim', function (a, x) {
       var r = readField(a, 'avgStrokeDistance', x.opts);
       if (r.status !== 'available') return r;
       if (!(num(r.value) > 0)) return { status: 'not_delivered', reason: 'zero_value', basis: r.basis };
       return { status: 'available', value: r.value / 100, raw: r.value, source: 'garmin_list', basis: r.basis + ' (cm)' };
     }, function (a, r, x) { return x.swimCheck && x.swimCheck.strokeDistanceOk ? { validation: 'consistent', reason: 'distance_per_stroke' } : { validation: 'blocked', reason: 'unit_unresolved' }; });
  /* Zeit je Pulszone laut Garmin (Zonengrenzen aus Garmins Nutzereinstellungen) — Sekunden, Zonen 1–5 */
  am('hrZones', SWIM.concat(RUN, BIKE, GYM), 's', 'heart', function (a, x) {
       var z = [], st = null;
       for (var i = 1; i <= 5; i++) { var r = readField(a, 'hrTimeInZone_' + i, x.opts); if (r.status !== 'available') { st = st || r; z.push(null); } else z.push(num(r.value)); }
       if (z.every(function (v) { return v === null; })) return st || { status: 'not_delivered', reason: 'field_absent' };
       return { status: 'available', value: z.map(function (v) { return v === null ? 0 : Math.round(v); }), source: 'garmin_list', basis: 'ext.fields.hrTimeInZone_1…5' };
     }, function (a, r) { var sum = r.value.reduce(function (s, v) { return s + v; }, 0); return sum > 0 ? { validation: 'unverified', reason: 'garmin_zones' } : { validation: 'blocked', reason: 'implausible' }; });
  am('speedSeries', SWIM.concat(RUN, BIKE, ['rowing']), 'mps', 'series', function (a) { return readStream(a, 'speed'); }, function (a) { return { validation: 'unverified', reason: 'evidence_assumed' }; });
  am('strokeRateSeries', SWIM, 'spm', 'series', function (a, x) { return readSeries(a, ['directSwimCadence', 'directStrokeCadence'], x.opts); }, function (a) { return { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; });
  am('swolfSeries', SWIM, 'swolf', 'series', function (a, x) { return POOL_ONLY(a) || readSeries(a, ['directSwolf'], x.opts); }, function (a) { return { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; });
  am('strokesSeries', SWIM, 'count', 'series', function (a, x) { return readSeries(a, ['directStrokes'], x.opts); }, function (a) { return { validation: evLevel('list.swim', a.sportId), reason: 'evidence_' + level('list.swim', a.sportId) }; });
  am('lengths', SWIM, 'list', 'structure', function (a, x) { return POOL_ONLY(a) || readLengths(a, x.opts); }, function (a, r) {
    if (r.shapeUnverified) return { validation: 'blocked', reason: 'shape_unverified' };
    if (r.countMatch === true) return { validation: 'consistent', reason: 'active_lengths_match' };
    if (r.countMatch === false) return { validation: 'unverified', reason: 'active_lengths_mismatch' };
    return { validation: 'unverified', reason: 'evidence_assumed' };
  });

  /* ---- Laufen / Gehen ---- */
  am('paceKm', RUN, 's/km', 'pace', function (a, x) {
       var d = x.get('distance'), t = x.get('duration');
       if (d.status !== 'available' || t.status !== 'available') return { status: d.status !== 'available' ? d.status : t.status, reason: 'needs_distance_and_duration' };
       return { status: 'available', value: t.value / (d.value / 1000), method: 'derived', source: 'derived', basis: 'Dauer / Distanz' };
     }, function (a, r) { if (!plaus(r.value, 'paceKm')) return { validation: 'blocked', reason: 'implausible' }; return ownOk(a) || eligState(a, 'pace'); });
  am('runningCadence', ['running'], 'spm', 'run', function (a) {
       var S = STR(), cad = S ? S.cadence(a) : { status: 'none' };
       if (cad.status === 'unverified') return { status: 'available', value: null, blocked: true, reason: 'legacy_half_value_risk', source: 'garmin_details', basis: 'streams.cadence' };
       if (cad.status !== 'ok' || cad.kind !== 'running_cadence_spm') return readStream(a, 'cadence').status === 'available' ? { status: 'not_delivered', reason: 'other_cadence_kind' } : readStream(a, 'cadence');
       var e = evaluate(a, 'runningCadence', {});
       return { status: 'available', value: e.eligible ? e.value : cad.avg, source: 'garmin_details', basis: e.eligible ? e.provenance.basis : 'Mittel der Anzeige-Reihe (directDoubleCadence)', confirmed: e.eligible };
     }, function (a, r) { if (r.blocked) return { validation: 'blocked', reason: r.reason }; if (!plaus(r.value, 'runningCadence')) return { validation: 'blocked', reason: 'implausible' }; return r.confirmed ? { validation: 'validated' } : { validation: 'unverified', reason: 'not_confirmed' }; });
  am('elevationGain', RUN.concat(BIKE), 'm', 'base', function (a) { return sumRead(a, 'elevationM'); }, function (a) { return ownOk(a) || { validation: 'unverified', reason: 'evidence_assumed' }; });
  am('strideLength', ['running'], 'unknown', 'run', function (a, x) { return readField(a, 'avgStrideLength', x.opts); }, function () { return { validation: 'blocked', reason: 'unit_unresolved' }; });
  am('cadenceSeries', RUN.concat(BIKE), 'cadence', 'series', function (a) {
       var S = STR(), cad = S ? S.cadence(a) : { status: 'none' }, r = readStream(a, 'cadence');
       if (r.status === 'available') { r.kind = cad.kind || null; if (cad.status === 'unverified') { r.blocked = true; r.reason = 'legacy_half_value_risk'; } }
       return r;
     }, function (a, r) { if (r.blocked) return { validation: 'blocked', reason: r.reason }; return r.kind === 'running_cadence_spm' ? { validation: evLevel('details.running_cadence', a.sportId) } : { validation: evLevel('details.cycling_cadence', a.sportId), reason: 'evidence_' + level('details.cycling_cadence', a.sportId) }; });
  am('elevationSeries', RUN.concat(BIKE), 'm', 'series', function (a) { return readStream(a, 'elevation'); }, function () { return { validation: 'unverified', reason: 'evidence_assumed' }; });

  /* ---- Radfahren ---- */
  am('avgSpeed', BIKE, 'km/h', 'pace', function (a, x) {
       var s = num((obj(a.summary) || {}).avgSpeedKmh);
       if (s !== null && s > 0) return { status: 'available', value: s, source: a.source === 'garmin' ? 'garmin_list' : 'own', basis: 'summary.avgSpeedKmh' };
       var d = x.get('distance'), t = x.get('duration');
       if (d.status !== 'available' || t.status !== 'available') return { status: d.status !== 'available' ? d.status : t.status, reason: 'needs_distance_and_duration' };
       return { status: 'available', value: (d.value / 1000) / (t.value / 3600), method: 'derived', source: 'derived', basis: 'Distanz / Dauer' };
     }, function (a, r, x) { if (!plaus(r.value, 'speedKmh')) return { validation: 'blocked', reason: 'implausible' }; if (NO_REAL_DISTANCE[contextOf(a).environment]) return { validation: 'unverified', reason: 'modeled_distance' }; return ownOk(a) || { validation: worst([x.get('distance').validation, 'unverified']), reason: 'evidence_assumed' }; });
  am('maxSpeed', BIKE, 'mps', 'pace', function (a, x) { return readField(a, 'maxSpeed', x.opts); }, function (a, r) { if (!plaus(r.value * 3.6, 'speedKmh')) return { validation: 'blocked', reason: 'implausible' }; return { validation: 'unverified', reason: 'evidence_library' }; });
  am('cyclingCadence', BIKE, 'rpm', 'cycle', function (a) { var st = obj((obj((obj(a.metrics) || {}).best_efforts) || {}).stats) || {}, c = obj(st.cadence);
       if (c && c.kind === 'cycling_cadence_rpm' && num(c.avg) !== null) return { status: 'available', value: c.avg, source: 'garmin_details', basis: 'best_efforts.stats.cadence' };
       return readStream(a, 'cadence').status === 'available' ? { status: 'not_delivered', reason: 'stats_missing' } : readStream(a, 'cadence'); },
     function (a, r) { if (!plaus(r.value, 'cyclingCadence')) return { validation: 'blocked', reason: 'implausible' }; return eligState(a, 'cyclingCadence'); });
  /* Leistung: NUR mit gemessener Wattzahl (Leistungsmesser/Trainer). Nie aus Geschwindigkeit. */
  var POWER_FIELD = { avgPowerW: 'avgPower', maxPowerW: 'maxPower', normPowerW: 'normPower' };
  var powerRead = function (key) { return function (a, x) {
       var r = sumRead(a, key);
       if (r.status === 'available' && r.value > 0) return r;
       /* v8-454.1: Listeneintrag (Garmin-Zusammenfassung, alle Messpunkte) vor jeder Rechnung aus der gespeicherten Reihe */
       var lf = readField(a, POWER_FIELD[key], x && x.opts);
       if (lf.status === 'available' && num(lf.value) !== null && lf.value > 0) return { status: 'available', value: num(lf.value), source: 'garmin_list', basis: lf.basis };
       if (key === 'avgPowerW') { var st = obj((obj((obj(a.metrics) || {}).best_efforts) || {}).stats) || {}, p = obj(st.power); if (p && num(p.avg) !== null && p.avg > 0) return { status: 'available', value: p.avg, source: 'garmin_details', basis: 'best_efforts.stats.power (alle Zeilen)' }; }
       /* v8-454: gemessene Leistungsreihe ohne Summenwert → Mittel bzw. Maximum der Reihe (berechnet, wie bisher die Seite) */
       if (key === 'avgPowerW' || key === 'maxPowerW') {
         var ps = readStream(a, 'power'), gs = obj((obj(a.metrics) || {}).garmin) || {};
         /* v8-454.1: das Maximum einer ausgeduennten Reihe ist kein Maximum (Zwift 07.10.: Reihe 214 W, Garmin 326 W) — dann keins */
         var thinned = num(gs.stream_kept) !== null && num(gs.stream_rows) !== null && gs.stream_kept < gs.stream_rows;
         if (key === 'maxPowerW' && thinned && ps.status === 'available') return { status: 'not_delivered', reason: 'thinned_series' };
         if (ps.status === 'available') { var pv = ps.value.map(num).filter(function (x) { return x !== null && x >= 0; });
           if (pv.length >= 5 && pv.some(function (x) { return x > 0; })) return { status: 'available', value: key === 'avgPowerW' ? Math.round(pv.reduce(function (q, x) { return q + x; }, 0) / pv.length) : Math.max.apply(null, pv), method: 'derived', source: 'garmin_details', basis: key === 'avgPowerW' ? 'Mittel der Leistungsreihe' : 'Maximum der Leistungsreihe' }; }
       }
       return { status: 'not_delivered', reason: 'no_power_meter' }; }; };
  var powerCheck = function (a, r) { if (!plaus(r.value, 'power')) return { validation: 'blocked', reason: 'implausible' }; return { validation: evLevel('details.power', a.sportId), reason: 'evidence_' + level('details.power', a.sportId) }; };
  am('avgPower', BIKE, 'W', 'cycle', powerRead('avgPowerW'), powerCheck);
  am('maxPower', BIKE, 'W', 'cycle', powerRead('maxPowerW'), powerCheck);
  am('normPower', BIKE, 'W', 'cycle', powerRead('normPowerW'), powerCheck);
  am('powerSeries', BIKE, 'W', 'series', function (a) { return readStream(a, 'power'); }, function (a) { return { validation: evLevel('details.power', a.sportId), reason: 'evidence_' + level('details.power', a.sportId) }; });
  /* v8-454.1 · Leistungskurve: zuerst Garmins eigene Bestwerte je Fenster (Listeneintrag maxAvgPower_<s>, aus ALLEN Messpunkten —
     Befund Zwift 07.10.: 30 s Garmin 162 W, Naeherung aus 2-s-Abtastung 164 W), sonst die Worker-Naeherung (best_efforts.power). */
  function garminPowerCurve(a, x) {
    var m = obj(a.metrics) || {}, f = obj((obj(m.ext) || {}).fields); if (!f) return null;
    var out = {}, n = 0;
    Object.keys(f).forEach(function (k) { var mm = /^maxAvgPower_(\d+)$/.exec(k); var v = num(f[k]); if (mm && v !== null && v > 0) { out[mm[1]] = { w: v, q: 'garmin' }; n++; } });
    return n >= 3 ? out : null;
  }
  am('powerCurve', BIKE, 'W', 'structure', function (a, x) { var g = garminPowerCurve(a, x); if (g) return { status: 'available', value: g, source: 'garmin_list', basis: 'ext.fields.maxAvgPower_*' };
       var p = obj((obj((obj(a.metrics) || {}).best_efforts) || {}).power);
       return p && obj(p.windows) ? { status: 'available', value: p.windows, source: 'garmin_details', basis: 'best_efforts.power.windows' } : (readStream(a, 'power').status === 'available' ? { status: 'not_delivered', reason: 'not_computed' } : { status: 'not_delivered', reason: 'no_power_meter' }); },
     function (a) { var e = evaluate(a, 'powerBest', { windowS: 300 }); return e.eligible ? { validation: 'validated' } : { validation: 'unverified', reason: e.reasons[0] }; });

  /* ---- Krafttraining ---- */
  am('exercises', GYM, 'count', 'strength', function (a) { return sumRead(a, 'exerciseCount', 'own'); }, function (a) { return ownOk(a) || { validation: 'unverified', reason: 'evidence_assumed' }; });
  am('workingSets', GYM, 'count', 'strength', function (a, x) { var r = sumRead(a, 'workingSetCount', 'own'); if (r.status === 'available' || a.source !== 'garmin') return r; return readField(a, 'activeSets', x.opts); },
     function (a) { return ownOk(a) || { validation: evLevel('list.strength', a.sportId), reason: 'evidence_library' }; });
  am('reps', GYM, 'count', 'strength', function (a, x) { return a.source === 'garmin' ? readField(a, 'totalReps', x.opts) : { status: 'not_delivered', reason: 'value_absent' }; },
     function (a) { return { validation: evLevel('list.strength', a.sportId), reason: 'evidence_library' }; });
  am('volume', GYM, 'kg', 'strength', function (a, x) { var r = sumRead(a, 'totalVolumeKg', 'own'); if (r.status === 'available' && a.source !== 'garmin') return r; if (a.source === 'garmin') { var f = readField(a, 'totalVolume', x.opts); if (f.status === 'available') { f.blocked = true; f.reason = 'unit_unresolved'; } return f; } return r; },
     function (a, r) { if (r.blocked) return { validation: 'blocked', reason: r.reason }; return ownOk(a) || { validation: 'unverified', reason: 'evidence_assumed' }; });

  function amFor(sport) { return AM.filter(function (d) { return !d.sports || d.sports.indexOf(sport) >= 0; }); }
  /* owner = der Datensatz, der die Messreihen traegt (bei gekoppelter Uhr-Aufzeichnung die Aufzeichnung).
     opts.extState: 'loaded' | 'pending' | 'unavailable' — nur noetig, wenn metrics.ext (noch) fehlt. */
  function describeActivity(owner, opts) {
    var a = obj(owner) || {}, sport = a.sportId || 'other', out = {}, defs = amFor(sport), byId = {};
    defs.forEach(function (d) { byId[d.id] = d; });
    var x = { opts: opts || {}, poolCheck: null, swimCheck: null };
    x.get = function (id) {
      if (out[id]) return out[id];
      var d = byId[id] || AM.filter(function (y) { return y.id === id; })[0];
      if (!d) return { status: 'not_applicable', reason: 'unknown_metric' };
      out[id] = { id: id, unit: d.unit, group: d.group, sport: sport, status: 'pending' };   // Schutz gegen Zyklen
      var r = {}; try { r = d.read(a, x) || {}; } catch (e) { r = { status: 'not_delivered', reason: 'read_error' }; }
      var res = { id: id, unit: r.unit || d.unit, group: d.group, sport: sport, status: r.status || 'not_delivered', value: r.status === 'available' ? (r.value !== undefined ? r.value : null) : null,
                  source: r.source || null, method: r.status === 'available' ? (r.method || 'measured') : null, basis: r.basis || null, reason: r.reason || null, validation: null };
      if (r.raw !== undefined) res.raw = r.raw;
      if (r.kind) res.kind = r.kind;
      if (r.shapeUnverified) res.shapeUnverified = true;
      if (r.paceBasis) res.paceBasis = r.paceBasis;
      if (r.conflict) res.conflict = r.conflict;        // v8-454.1: zwei Garmin-Quellen widersprechen (benannt, nie still angeglichen)
      if (r.evidence) res.evidence = r.evidence;        // v8-456: Beleg einer Pause (timer_counter | unclear | none | derived_only)
      if (res.status === 'available') {
        var v = { validation: 'unverified' };
        try { v = (d.check ? d.check(a, r, x) : null) || v; } catch (e) { v = { validation: 'unverified', reason: 'check_error' }; }
        if (r.blocked) v = { validation: 'blocked', reason: r.reason };
        res.validation = v.validation; if (v.reason) res.reason = v.reason;
        if (res.validation === 'blocked') res.value = null;
      }
      res.ledger = res.status === 'available' && res.validation === 'validated';
      out[id] = res;
      return res;
    };
    /* Gegenpruefung Schwimmen: aktive Laengen × Bahnlaenge = Distanz (± eine Bahn bzw. 1 %) — macht Distanz, Laengen und
       Bahnlaenge fuer DIESE Einheit „consistent". Nur Becken, nur ohne manuelle Distanz-Korrektur. */
    if (sport === 'swimming' && contextOf(a).environment !== 'open_water') {
      try {
        var al = readField(a, 'activeLengths', x.opts), pl = readField(a, 'poolLength', x.opts), un = readField(a, 'unitOfPoolLength', x.opts), dr = distanceRead(a);
        var plm = pl.status === 'available' ? poolLengthM(pl.value, un.status === 'available' ? un.value : null) : null;
        if (al.status === 'available' && num(al.value) !== null && plm && dr.status === 'available' && dr.method !== 'manual') {
          var calc = al.value * plm, tol = Math.max(plm, 0.01 * dr.value);
          x.poolCheck = { ok: Math.abs(calc - dr.value) <= tol + 1e-9, calc: Math.round(calc), distance: Math.round(dr.value), poolLengthM: plm };
        }
      } catch (e) { x.poolCheck = null; }
    }
    /* Schwimmen: Zeitbasis von Garmins Ø-Geschwindigkeit und Gegenpruefungen der Zugwerte (alles aus DERSELBEN Einheit) */
    if (sport === 'swimming') {
      try {
        var fv = function (k) { var r = readField(a, k, x.opts); return r.status === 'available' ? num(r.value) : null; };
        var g0 = obj((obj(a.metrics) || {}).garmin) || {}, D = distanceRead(a), Tm = num(g0.timer_duration_s) || num(a.durationSeconds);
        var MV = (num(g0.moving_duration_s) > 0) ? g0.moving_duration_s : (fv('movingDuration') > 0 ? fv('movingDuration') : null);
        var AVG = fv('averageSpeed'); if (AVG === null) AVG = num((obj(a.summary) || {}).avgSpeedMps);
        var sc = { paceBasis: null, strokesOk: false, swolfOk: false, strokeRateOk: false, strokeDistanceOk: false };
        if (D.status === 'available' && D.method !== 'manual' && AVG !== null && AVG > 0) {
          var tol = Math.max(0.011, 0.02 * AVG), cand = [];
          if (MV) cand.push(['moving', Math.abs(D.value / MV - AVG)]);
          if (Tm) cand.push(['timer', Math.abs(D.value / Tm - AVG)]);
          cand = cand.filter(function (c) { return c[1] <= tol; }).sort(function (p, q) { return p[1] - q[1]; });
          if (cand.length) sc.paceBasis = cand[0][0];
        }
        var ST = fv('strokes'), SPL = fv('avgStrokes'), LEN = fv('activeLengths'), SW = fv('averageSwolf'), SR = fv('averageSwimCadenceInStrokesPerMinute'), SD = fv('avgStrokeDistance');
        if (ST && SPL && LEN) sc.strokesOk = Math.abs(ST / LEN - SPL) <= 0.15;
        if (SPL && LEN && MV && SW) sc.swolfOk = Math.abs(SPL + MV / LEN - SW) <= 1.5;
        if (ST && MV && SR) sc.strokeRateOk = Math.abs(ST / (MV / 60) - SR) <= 1.5;
        if (ST && SD > 0 && D.status === 'available') sc.strokeDistanceOk = Math.abs(D.value / ST - SD / 100) <= 0.03;
        x.swimCheck = sc;
      } catch (e) { x.swimCheck = null; }
    }
    defs.forEach(function (d) { x.get(d.id); });
    return { v: DESCRIBE_VERSION, sport: sport, context: contextOf(a), source: a.source || null, poolCheck: x.poolCheck, swimCheck: x.swimCheck, metrics: out };
  }
  var DESCRIBE_STATUSES = ['available', 'not_delivered', 'not_imported', 'not_stored', 'not_loaded', 'not_applicable'];
  var DESCRIBE_VALIDATIONS = ['validated', 'consistent', 'unverified', 'blocked'];

  var REASONS = ['missing_data', 'legacy_schema', 'unverified_semantics', 'insufficient_resolution', 'invalid_time_axis',
    'unsupported_source', 'unsupported_sport', 'manual_override_conflict', 'not_completed', 'unverified_context', 'pause_conflict', 'unknown_metric'];

  var api = {
    evaluate: evaluate, isMetricLedgerEligible: isMetricLedgerEligible, overview: overview, level: level,
    contextOf: contextOf, provenanceStatus: provenanceStatus, CONTEXT: CONTEXT, PROVENANCE_REQUIRED: PROV_REQUIRED.slice(),
    METRICS: Object.keys(METRICS), REASONS: REASONS, EVIDENCE: EVIDENCE, TRUSTED: Object.keys(TRUSTED), VALIDATIONS: VALIDATIONS, GATE_LOG: GATE_LOG,
    POWER_WINDOWS: POWER_WINDOWS.slice(), DISTANCE_TARGETS: DISTANCE_TARGETS.slice(), TOLERANCES: TOL, DETAILS_VERSION_CURRENT: CURRENT,
    describeActivity: describeActivity, DESCRIBE_VERSION: DESCRIBE_VERSION, DESCRIBE_STATUSES: DESCRIBE_STATUSES, DESCRIBE_VALIDATIONS: DESCRIBE_VALIDATIONS,
    ACTIVITY_METRICS: AM.map(function (d) { return { id: d.id, sports: d.sports ? d.sports.slice() : null, unit: d.unit, group: d.group }; }), PLAUSIBILITY: PLAUS,
    sportsOf: function (metric) { var d = METRICS[metric]; return d ? (d.sports ? Object.keys(d.sports) : null) : undefined; },
    paramOf: function (metric) { var d = METRICS[metric]; return d ? (d.param || null) : undefined; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.metricEligibility = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
