/* ============================================================
   ORVIA · activity-analysis (v8-452, Schwimmintervalle v8-453) — sportartspezifische Aktivitaetsanalyse, rein.

   Kette:  Aktivitaet
             → Sportart + Kontext          (Sport-ID, metric-eligibility.contextOf: Becken / Freiwasser / Rolle …)
             → Kennzahlen mit Urteil        (metric-eligibility.describeActivity: Status, Pruefstand, Methode, Quelle)
             → Darstellung je Sportart      (PROFILES hier: Hauptkennzahlen, Karten, Diagramme, Intervalle, Effizienz)
             → Oberflaeche                  (ui.js zeichnet nur, was dieses Modell enthaelt)
   Keine zweite Aktivitaets-Engine: dieses Modul liest ausschliesslich das Urteil von metric-eligibility und die
   gespeicherten Reihen. Es rechnet nur Darstellung (Einheitenumrechnung, Intervall-Tempo aus Distanz/Zeit derselben
   Runde, Streuung) — jede Rechnung ist unten benannt. Nichts wird geschaetzt, aufgefuellt oder erfunden.

   Anzeige-Regel (show): Status available UND Pruefstand nicht blocked UND Wert vorhanden.
     validated / consistent  → Anzeige als Messung
     unverified              → Anzeige als Quellwert (Garmin) — die Messdetails nennen es so; nie „gemessen" genannt
     blocked                 → nie angezeigt (unplausibel, Einheit ungeklaert, Form unbelegt)

   Rein: kein DOM, kein Speicher, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'activity-analysis@1';

  function req(name, path) {
    if (O[name]) return O[name];
    if (typeof require === 'function') { try { return require(path); } catch (e) { return null; } }
    return null;
  }
  function ME() { return req('metricEligibility', './metric-eligibility.js'); }
  function SI() { return req('swimIntervals', './swim-intervals.js'); }
  function IVE() { return req('intervals', './intervals.js'); }
  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* Sportfamilie fuer die Darstellung (dieselbe Einteilung wie die Aktivitaetsseite) */
  function family(sportId) {
    var s = String(sportId || '').toLowerCase();
    if (s === 'gym' || s === 'strength' || s === 'strength_training') return 'gym';
    if (s === 'swimming') return 'swimming';
    if (s === 'cycling') return 'cycling';
    if (s === 'running' || s === 'walking' || s === 'hiking' || s === 'trail_running') return 'running';
    return 'other';
  }

  /* Diagramm-Quellen: Kennzahl (Reihe) → Darstellung. conv: Umrechnung DERSELBEN Messung (keine neue Groesse). */
  var CHART = {
    pace100:    { metric: 'speedSeries', kind: 'pace', unit: '/100 m', conv: function (v) { return v > 0.2 ? 100 / v : null; }, higherBetter: false },
    paceKm:     { metric: 'speedSeries', kind: 'pace', unit: '/km', conv: function (v) { return v > 0.3 ? 1000 / v : null; }, higherBetter: false },
    speedKmh:   { metric: 'speedSeries', kind: 'num', unit: ' km/h', dec: 1, conv: function (v) { return v * 3.6; }, higherBetter: true },
    hr:         { metric: 'hrSeries', kind: 'num', unit: ' bpm', dec: 0, higherBetter: false },
    strokeRate: { metric: 'strokeRateSeries', kind: 'num', unit: ' Züge/min', dec: 0, higherBetter: true },
    swolf:      { metric: 'swolfSeries', kind: 'num', unit: '', dec: 0, higherBetter: false },
    cadence:    { metric: 'cadenceSeries', kind: 'num', unit: '', dec: 0, higherBetter: true },
    power:      { metric: 'powerSeries', kind: 'num', unit: ' W', dec: 0, higherBetter: true },
    elevation:  { metric: 'elevationSeries', kind: 'num', unit: ' m', dec: 0, higherBetter: true }
  };

  /* Darstellung je Sportfamilie. hero: Hauptkennzahlen (erste = die eine klare Hauptzahl), cards: kompakte Karten
     (nur, was vorliegt), charts: Diagramme (nur mit Reihe), details: Reihenfolge der Messdetails. */
  var PROFILES = {
    swimming: {
      hero: ['distance', 'duration', 'pace100'],
      cards: ['avgHr', 'activeLengths', 'swolf', 'strokeRate', 'restTime', 'poolLength', 'pace100Moving', 'pace100Total', 'strokesPerLength', 'strokes', 'strokeDistance', 'maxHr', 'pause', 'calories', 'trainingEffect'],
      charts: ['pace100', 'hr', 'strokeRate', 'swolf'],
      intervals: { pace: 'pace100', minDist: 25 },
      zones: true,
      details: ['environment', 'distance', 'duration', 'timer', 'elapsed', 'moving', 'restTime', 'pause', 'pace100', 'pace100Moving', 'pace100Total', 'poolLength', 'activeLengths', 'strokes', 'strokesPerLength',
                'swolf', 'strokeRate', 'maxStrokeRate', 'strokeDistance', 'avgHr', 'maxHr', 'hrZones', 'hrSeries', 'speedSeries', 'strokeRateSeries', 'swolfSeries', 'strokesSeries',
                'laps', 'lengths', 'route', 'calories', 'trainingEffect', 'trainingLoad']
    },
    running: {
      hero: ['distance', 'duration', 'paceKm'],
      cards: ['avgHr', 'runningCadence', 'elevationGain', 'maxHr', 'pause', 'calories', 'trainingEffect'],
      charts: ['paceKm', 'hr', 'cadence', 'elevation'],          // v8-454: Tempo · Puls · Kadenz · Hoehe
      intervals: { pace: 'paceKm', minDist: 200 },
      details: ['environment', 'distance', 'duration', 'timer', 'elapsed', 'moving', 'pause', 'paceKm', 'avgHr', 'maxHr', 'runningCadence', 'strideLength', 'elevationGain',
                'hrSeries', 'speedSeries', 'cadenceSeries', 'elevationSeries', 'laps', 'route', 'calories', 'trainingEffect', 'trainingLoad']
    },
    cycling: {
      hero: ['distance', 'duration', 'avgSpeed'],
      cards: ['avgPower', 'normPower', 'avgHr', 'cyclingCadence', 'elevationGain', 'maxPower', 'maxSpeed', 'maxHr', 'pause', 'calories', 'trainingEffect'],
      charts: ['power', 'hr', 'cadence', 'speedKmh', 'elevation'],   // v8-454: Leistung · Puls · Kadenz · Geschwindigkeit
      intervals: { pace: 'speedKmh', minDist: 500 },
      details: ['environment', 'distance', 'duration', 'timer', 'elapsed', 'moving', 'pause', 'avgSpeed', 'maxSpeed', 'avgPower', 'normPower', 'maxPower', 'powerCurve', 'cyclingCadence',
                'avgHr', 'maxHr', 'elevationGain', 'hrSeries', 'speedSeries', 'powerSeries', 'cadenceSeries', 'elevationSeries', 'laps', 'route', 'calories', 'trainingEffect', 'trainingLoad']
    },
    gym: {
      hero: ['duration'],
      cards: ['workingSets', 'exercises', 'volume', 'reps', 'avgHr', 'maxHr', 'calories'],
      charts: ['hr'],
      intervals: null,
      details: ['duration', 'exercises', 'workingSets', 'reps', 'volume', 'avgHr', 'maxHr', 'hrSeries', 'calories', 'trainingEffect', 'trainingLoad']
    },
    other: {
      hero: ['duration', 'distance'],
      cards: ['avgHr', 'maxHr', 'calories', 'trainingEffect'],
      charts: ['hr'],
      intervals: null,
      details: ['duration', 'distance', 'avgHr', 'maxHr', 'hrSeries', 'calories', 'trainingEffect', 'trainingLoad']
    }
  };

  /* v8-454 · Uebersicht: EINE grosse Hauptkennzahl + hoechstens drei Kennzahlen. Alles Weitere steht im Analysebereich
     (md.more). Rad: drinnen/virtuell mit GEMESSENER Leistung ist die Leistung die Hauptzahl (die Strecke ist dort modelliert). */
  function heroIdsFor(fam, desc) {
    var m = desc.metrics, ctx = desc.context && desc.context.environment;
    if (fam === 'swimming') return ['distance', 'duration', 'pace100', 'avgHr'];
    if (fam === 'running') return ['distance', 'duration', 'paceKm', 'avgHr'];
    if (fam === 'cycling') {
      var pw = show(m.avgPower);
      if (pw && (ctx === 'indoor' || ctx === 'virtual')) return ['avgPower', 'duration', 'avgHr', 'cyclingCadence'];
      return pw ? ['distance', 'duration', 'avgPower', 'avgHr'] : ['distance', 'duration', 'avgSpeed', 'avgHr'];
    }
    return null;
  }

  var MIN_SERIES_POINTS = 20;
  function show(d) { return !!(d && d.status === 'available' && d.validation !== 'blocked' && d.value !== null && d.value !== undefined); }

  /* Zeitachse (Sekunden je Punkt), nur wenn sie zur Reihe passt — sonst null (keine erfundene Achse). */
  function timesFor(owner, n) {
    var st = obj((obj(owner && owner.metrics) || {}).streams) || {}, t = st.time;
    return (Array.isArray(t) && t.length === n && t.every(function (x) { return num(x) !== null; })) ? t.slice() : null;
  }

  function chartsOf(owner, desc, ids, fam) {
    var out = [], ctx = desc.context && desc.context.environment;
    (ids || []).forEach(function (cid) {
      var c = CHART[cid]; if (!c) return;
      var d = desc.metrics[c.metric];
      if (!show(d) || !Array.isArray(d.value)) return;
      var vals = d.value.map(function (v) { var x = num(v); return x === null ? null : (c.conv ? c.conv(x) : x); });
      if (cid === 'pace100') vals = vals.map(function (v) { return (v !== null && v >= 30 && v <= 900) ? v : null; });   // Pausen/Wenden (≈ 0 m/s) sind kein Tempo
      if (cid === 'paceKm') {
        vals = vals.map(function (v) { return (v !== null && v >= 100 && v <= 1800) ? v : null; });
        /* v8-454: Gehen/Stehen (langsamer als das Doppelte des Median-Tempos) ist kein Lauftempo — Luecke statt Spitze */
        var pv = vals.filter(function (v) { return v !== null; }).sort(function (x, y) { return x - y; }), pm = pv.length ? pv[Math.floor(pv.length / 2)] : null;
        if (pm) vals = vals.map(function (v) { return v !== null && v > pm * 2 ? null : v; });
      }
      if (cid === 'cadence' && d.kind && d.kind !== (fam === 'cycling' ? 'cycling_cadence_rpm' : 'running_cadence_spm')) return;
      /* v8-454: Rolle / virtuell — Geschwindigkeit und Hoehe sind dort modelliert (keine Messung im Gelaende): kein Diagramm */
      if (fam === 'cycling' && (cid === 'speedKmh' || cid === 'elevation') && (ctx === 'indoor' || ctx === 'virtual')) return;
      var n = vals.filter(function (v) { return v !== null; }).length;
      if (n < MIN_SERIES_POINTS) return;                  // v8-454: keine scheinbar genaue Kurve aus wenigen Punkten
      var sum = 0; vals.forEach(function (v) { if (v !== null) sum += v; });
      out.push({ id: cid, metric: c.metric, kind: c.kind, mean: sum / n, unit: cid === 'cadence' ? (fam === 'cycling' ? ' rpm' : ' spm') : c.unit, dec: c.dec != null ? c.dec : 0,
                 higherBetter: c.higherBetter, values: vals, times: timesFor(owner, vals.length), points: n, validation: d.validation, source: d.source, basis: d.basis });
    });
    return out;
  }

  /* Intervalle aus den Runden der Quelle (metrics.splits). Je Runde nur, was die Runde selbst traegt:
       Zeit = duration (Timer der Runde), sonst elapsedDuration / movingDuration — benannt in timeBasis
       Tempo = Zeit / Distanz DERSELBEN Runde; Erholung = Runde ohne Strecke (< 1 m) mit Zeit
     Zugzahl, SWOLF und Schwimmstil je Intervall gibt es nur, wenn die Runde sie traegt — die schlanke Form traegt sie nicht. */
  function intervalsOf(desc, prof) {
    var d = desc.metrics.laps;
    if (!prof || !prof.intervals || !d || d.status !== 'available' || !Array.isArray(d.value)) return null;
    var rows = [], basis = null, nAct = 0;
    d.value.forEach(function (lap, i) {
      if (!lap || typeof lap !== 'object') return;
      var dist = num(lap.distance), tb = num(lap.duration) !== null ? 'duration' : (num(lap.elapsedDuration) !== null ? 'elapsedDuration' : (num(lap.movingDuration) !== null ? 'movingDuration' : null));
      var t = tb ? num(lap[tb]) : null;
      if (t === null || t <= 0) return;
      basis = basis || tb;
      var rest = dist === null || dist < 1;
      var pace = null;
      if (!rest) {
        if (prof.intervals.pace === 'pace100') pace = t / (dist / 100);
        else if (prof.intervals.pace === 'paceKm') pace = t / (dist / 1000);
        else if (prof.intervals.pace === 'speedKmh') pace = (dist / 1000) / (t / 3600);
      }
      if (!rest) nAct++;
      rows.push({ n: rest ? null : nAct, index: num(lap.lapIndex) !== null ? lap.lapIndex : i, distance: rest ? 0 : dist, time: t, rest: rest, pace: pace,
                  hr: num(lap.averageHR), maxHr: num(lap.maxHR) });
    });
    if (!rows.length) return null;
    var act = rows.filter(function (r) { return !r.rest; });
    return { rows: rows, active: act.length, rest: rows.length - act.length, restTime: rows.filter(function (r) { return r.rest; }).reduce(function (s, r) { return s + r.time; }, 0),
             paceKind: prof.intervals.pace, timeBasis: basis, source: d.source, validation: d.validation,
             perIntervalStrokes: false };
  }

  /* Effizienz/Gleichmaessigkeit — nur mit mindestens drei aktiven Intervallen ab Mindeststrecke.
     Streuung = Standardabweichung / Mittel des Intervall-Tempos (Variationskoeffizient, in %). */
  function efficiencyOf(iv, prof) {
    if (!iv || !prof || !prof.intervals) return null;
    var a = iv.rows.filter(function (r) { return !r.rest && r.pace !== null && r.distance >= prof.intervals.minDist; });
    if (a.length < 3) return null;
    var p = a.map(function (r) { return r.pace; }), mean = p.reduce(function (s, x) { return s + x; }, 0) / p.length;
    var sd = Math.sqrt(p.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / p.length);
    var hi = prof.intervals.pace === 'speedKmh';
    var best = a.reduce(function (b, r) { return (hi ? r.pace > b.pace : r.pace < b.pace) ? r : b; }, a[0]);
    var worstR = a.reduce(function (b, r) { return (hi ? r.pace < b.pace : r.pace > b.pace) ? r : b; }, a[0]);
    return { intervals: a.length, meanPace: mean, cvPct: mean ? Math.round(sd / mean * 1000) / 10 : null, best: best.n, bestPace: best.pace, worst: worstR.n, worstPace: worstR.pace,
             paceKind: prof.intervals.pace, definition: 'Variationskoeffizient des Intervall-Tempos (Intervalle ab ' + prof.intervals.minDist + ' m)' };
  }

  /* v8-453 · Diagramme je aktiver Bahn (Becken, Bahnen geladen): Tempo /100 m und SWOLF. x = Bahn-Nummer. Auffaellige Bahnen
     bleiben Luecken (nie geglaettet, nie ersetzt). Nur mit ≥ 3 Werten. */
  function lengthCharts(swim) {
    var ls = SI() && SI().lengthSeries(swim); if (!ls) return [];
    var out = [];
    [['lengthPace', ls.pace100, 'pace', '/100 m', false], ['lengthSwolf', ls.swolf, 'num', '', false]].forEach(function (d) {
      var vals = d[1], n = vals.filter(function (v) { return v !== null; }).length; if (n < 8) return;
      var sum = 0; vals.forEach(function (v) { if (v !== null) sum += v; });
      out.push({ id: d[0], metric: 'lengths', kind: d[2], mean: sum / n, unit: d[3], dec: 0, higherBetter: d[4], values: vals, times: null, labels: ls.labels,
                 points: n, validation: 'unverified', source: 'garmin_extras', basis: 'ext.splits.lapDTOs[].lengthDTOs' });
    });
    return out;
  }

  /* Modell der Aktivitaetsansicht. owner = Datensatz mit den Messreihen (bei gekoppelter Aufzeichnung diese);
     opts.extState wie metric-eligibility.describeActivity. */
  function analyze(owner, opts) {
    var M = ME(); if (!M || typeof M.describeActivity !== 'function') return null;
    var a = obj(owner) || {}, fam = family(a.sportId), prof = PROFILES[fam] || PROFILES.other;
    var desc = M.describeActivity(a, opts || {});
    var pick = function (ids) { return ids.map(function (id) { return desc.metrics[id]; }).filter(show); };
    var hero = pick(heroIdsFor(fam, desc) || prof.hero).slice(0, 4), cards = pick(prof.cards);
    var heroIds = hero.map(function (d) { return d.id; });
    cards = cards.filter(function (d) { return heroIds.indexOf(d.id) < 0; });
    var charts = chartsOf(a, desc, prof.charts, fam);
    var iv = null, eff = null, swim = null, timeline = null;
    /* v8-453 · Schwimmen: Intervalle, Pausen und Bahnen aus engine/swim-intervals.js (Schwimmzeit = aktive Bahnen, nie die
       Rundenzeit mit Pausen). Ohne Runden: kein Intervall-Block — die bisherigen Kennzahlen bleiben. */
    if (fam === 'swimming') {
      var S = SI();
      try { swim = S && desc.metrics.laps && desc.metrics.laps.status === 'available' ? S.build(a, opts || {}) : null; } catch (e) { swim = null; }
      if (swim && !swim.show) swim = null;
      if (swim && swim.efficiency) { var se = swim.efficiency; eff = { intervals: se.intervals, meanPace: se.meanPace, cvPct: se.cvPct, best: se.best, bestPace: se.bestPace, worst: se.worst, worstPace: se.worstPace, paceKind: 'pace100', stroke: se.stroke, definition: 'swim' }; }
      if (swim) { var IE = IVE(); timeline = IE ? IE.swimTimeline(swim) : null; }
      if (swim && swim.lengthsLoaded) {
        var ORD = ['pace100', 'lengthPace', 'hr', 'strokeRate', 'swolf', 'lengthSwolf'];
        charts = charts.concat(lengthCharts(swim)).sort(function (x, y) { return ORD.indexOf(x.id) - ORD.indexOf(y.id); });
      }
    } else if (fam === 'running' || fam === 'cycling') {
      /* v8-454: gemeinsame Intervall-Engine (engine/intervals.js) — Runden, Garmin-Workout-Schritte, Zeitsemantik, Analyse */
      var E = IVE();
      try { iv = E ? E.build(a, { desc: desc, extState: (opts || {}).extState, legacySplits: (opts || {}).legacySplits }) : null; } catch (e) { iv = null; }
      if (iv && !iv.show) iv = null;
      timeline = iv ? iv.timeline : null;
      var an = iv && iv.analytics;
      if (an && an.comparable) eff = { intervals: an.count, meanPace: an.mean, cvPct: an.cvPct, best: an.best, bestPace: an.bestValue, worst: an.worst, worstPace: an.worstValue,
                                       paceKind: an.metric === 'pace' ? 'paceKm' : (an.metric === 'power' ? 'power' : 'speedKmh'), definition: 'intervals', analytics: an };
    } else { iv = intervalsOf(desc, prof); eff = efficiencyOf(iv, prof); }
    /* Zeit je Pulszone laut Garmin — Anteil je Zone (Summe der gelieferten Zonen = 100 %) */
    var zd = desc.metrics.hrZones, zones = null;
    if (prof.zones && show(zd) && Array.isArray(zd.value)) {
      var zt = zd.value.reduce(function (s, v) { return s + (num(v) || 0); }, 0);
      if (zt > 0) zones = { seconds: zd.value.slice(), total: zt, share: zd.value.map(function (v) { return Math.round((num(v) || 0) / zt * 1000) / 10; }), validation: zd.validation, source: zd.source };
    }
    var details = prof.details.map(function (id) { return desc.metrics[id]; }).filter(Boolean);
    var shownIds = heroIds.concat(cards.map(function (d) { return d.id; }), charts.map(function (c) { return c.metric; }), (iv || swim) ? ['laps'] : [], (swim && swim.lengthsLoaded) ? ['lengths'] : [], zones ? ['hrZones'] : []);
    var unverifiedShown = hero.concat(cards).some(function (d) { return d.validation === 'unverified'; });
    var loading = details.some(function (d) { return d.status === 'not_loaded' && (d.reason === 'raw_block_pending' || d.reason === 'raw_block_not_loaded'); });
    return { v: VERSION, family: fam, sport: desc.sport, context: desc.context.environment, source: desc.source, poolCheck: desc.poolCheck,
             hero: hero, cards: cards.slice(0, 6), more: cards, charts: charts, intervals: iv, swim: swim, timeline: timeline, efficiency: eff, zones: zones, details: details, shown: shownIds,
             unverifiedShown: unverifiedShown, rawPending: loading, metrics: desc.metrics };
  }

  /* Vollstaendigkeit je Kennzahl (interne Diagnose): geliefert → gespeichert → geprueft → in der App verfuegbar → angezeigt,
     mit dem Grund an der ersten Stelle, an der die Kette reisst. Nur Namen, Zustaende und Gruende — keine Messreihen. */
  var CHAIN = {
    available: { delivered: 'ja', stored: 'ja', loaded: 'ja' },
    not_delivered: { delivered: 'nein', stored: '—', loaded: '—' },
    not_imported: { delivered: 'nicht abgefragt', stored: '—', loaded: '—' },
    not_stored: { delivered: 'ja', stored: 'nein', loaded: '—' },
    not_loaded: { delivered: 'unbekannt (Rohblock nicht geladen)', stored: 'unbekannt', loaded: 'nein' },
    not_applicable: { delivered: '—', stored: '—', loaded: '—' }
  };
  function completeness(owner, opts) {
    var m = analyze(owner, opts); if (!m) return null;
    var prof = PROFILES[m.family] || PROFILES.other, rows = [];
    prof.details.forEach(function (id) {
      var d = m.metrics[id]; if (!d) return;
      var ch = CHAIN[d.status] || {};
      var inProfile = prof.hero.indexOf(id) >= 0 || prof.cards.indexOf(id) >= 0 || (id === 'hrZones' && !!prof.zones) || (prof.charts || []).some(function (c) { return CHART[c] && CHART[c].metric === id; }) || (id === 'laps' && !!prof.intervals) || (id === 'lengths' && m.family === 'swimming');
      var displayed = m.shown.indexOf(id) >= 0;
      var why = d.status !== 'available' ? d.status + (d.reason ? ':' + d.reason : '') : (d.validation === 'blocked' ? 'blocked:' + (d.reason || '') : (!inProfile ? 'not_in_view' : (!displayed ? 'not_shown' : null)));
      rows.push({ metric: id, delivered: ch.delivered || '?', stored: ch.stored || '?', loaded: ch.loaded || '?', validation: d.validation || '—', method: d.method || '—',
                  source: d.source || '—', inView: inProfile, displayed: displayed, reason: why });
    });
    return { v: VERSION, family: m.family, context: m.context, rows: rows };
  }

  var api = { VERSION: VERSION, PROFILES: PROFILES, CHART: CHART, family: family, analyze: analyze, completeness: completeness, show: show };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
