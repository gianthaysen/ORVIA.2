/* ============================================================
   ORVIA · swim-intervals (v8-453) — Schwimmintervalle, Pausen und einzelne Bahnen aus den Garmin-Runden, rein.

   Datenform (belegt am Garmin-Mitschnitt vom 18.10.2026, garmin-worker/tests/fixtures/garmin/captures/):
     metrics.splits          schlanke Runden (Worker _slim_laps, auch im lokalen Speicher)
     metrics.ext.splits      Rohantwort get_activity_splits (nur Server, bei Bedarf geladen): lapDTOs[].lengthDTOs[]
   Bedeutung:
     Runde mit Distanz > 0   = Schwimm-Intervall
     Runde mit Distanz 0     = eigene Pausenrunde (Garmin legt dafuer eine „Bahn" ohne Distanz an)
     Bahn mit Distanz > 0    = geschwommene Bahn          · Bahn ohne Distanz IN einem Intervall = Pause im Intervall
     Runde.movingDuration    = Summe der aktiven Bahnen   · Runde.duration = Intervallzeit inkl. Pausen im Intervall
     Bahn.averageSWOLF       = Zuege + gerundete Sekunden

   Zeiten (nie gleichgesetzt, jede mit Herkunft):
     activeTime   Schwimmzeit des Intervalls: movingDuration der Runde (Garmin), sonst Summe der aktiven Bahnen; sonst KEINE
     elapsedTime  Intervallzeit: duration der Runde (Timer der Runde), sonst elapsedDuration
     restInside   Pause im Intervall: Summe der Bahnen ohne Distanz (gemessen); ohne Bahnen elapsedTime − activeTime (abgeleitet)
     Pausenrunden werden NIE einem Intervall zugeschlagen; aufeinanderfolgende Pausenrunden bilden einen Pausenblock.
   Tempo:  aktiv = activeTime / Distanz × 100 · gesamt = elapsedTime / Distanz × 100 — beide getrennt.

   Plausibilitaet je Bahn (nie korrigiert, Originalwert bleibt):
     implausible  schneller als der Weltrekord-Schnitt der Lage (50 m Kurzbahn) → physikalisch ausgeschlossen
     suspect      ≥ 1,6 × so schnell wie der eigene Median derselben Lage und Bahnlaenge in dieser Einheit,
                  ≤ 40 % der eigenen Median-Zugzahl, 0 Zuege, oder SWOLF ≠ Zuege + Sekunden (± 1)
     plausible    geprueft (≥ 5 Vergleichsbahnen derselben Lage und Laenge), nichts auffaellig
     unchecked    zu wenige Vergleichsbahnen fuer die relative Pruefung
   Keine Bahn ist gegen Garmin Connect validiert (validated: false) — nichts hieraus geht in Rekorde oder Prognosen.

   Rein: kein DOM, kein Speicher, kein Netz. Schreibt nie in den Datensatz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'swim-intervals@1';

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function pos(v) { var x = num(v); return x !== null && x > 0 ? x : null; }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function r2(v) { return v === null ? null : Math.round(v * 100) / 100; }

  /* Garmin-Lagen (Werte wie geliefert). Belegt im Mitschnitt: FREESTYLE, BREASTSTROKE, BACKSTROKE, MIXED.
     BUTTERFLY ist Garmins Name fuer Schmetterling; alles andere (z. B. DRILL, IM) = unknown, Rohwert bleibt erhalten. */
  var STROKES = { FREESTYLE: 'freestyle', BREASTSTROKE: 'breaststroke', BACKSTROKE: 'backstroke', BUTTERFLY: 'butterfly', MIXED: 'mixed' };
  function strokeOf(v) { if (typeof v !== 'string' || !v) return null; return STROKES[v.toUpperCase()] || 'unknown'; }

  /* Weltrekord-Schnitt je Lage (m/s), 50 m Kurzbahn inkl. Start (≈ 20,2 / 22,1 / 25,0 / 21,3 s). Schneller ist niemand. */
  var WR_SPEED = { freestyle: 2.47, backstroke: 2.26, breaststroke: 2.0, butterfly: 2.35, unknown: 2.47, mixed: 2.47 };
  var REL = { minRefs: 5, fastFactor: 1.6, fewStrokesFactor: 0.4, swolfTol: 1 };

  function lapsOf(owner) {
    var m = obj(owner && owner.metrics) || {};
    var slim = Array.isArray(m.splits) ? m.splits.filter(obj) : null;
    var ext = obj(m.ext), raw = ext && obj(ext.splits) && Array.isArray(ext.splits.lapDTOs) ? ext.splits.lapDTOs.filter(obj) : null;
    return { slim: slim && slim.length ? slim : null, raw: raw && raw.length ? raw : null, ext: ext, source: m.splits_source || null };
  }

  /* Rohrunde zur schlanken Runde: ueber lapIndex, sonst ueber die Position (nur bei gleicher Anzahl) */
  function rawFor(lap, i, raw, sameCount) {
    if (!raw) return null;
    var li = num(lap.lapIndex);
    if (li !== null) { for (var k = 0; k < raw.length; k++) if (num(raw[k].lapIndex) === li) return raw[k]; return null; }
    return sameCount ? raw[i] : null;
  }

  function lengthRows(rawLap) {
    var L = rawLap && Array.isArray(rawLap.lengthDTOs) ? rawLap.lengthDTOs.filter(obj) : null;
    if (!L) return null;
    return L.map(function (x) {
      var d = num(x.distance), t = num(x.duration);
      var active = d !== null && d > 0;
      var st = num(x.totalNumberOfStrokes), sw = num(x.averageSWOLF);
      return { lengthIndex: num(x.lengthIndex), kind: active ? 'active' : 'rest', distance: active ? d : 0, duration: t !== null && t >= 0 ? t : null,
               pace100: active && t !== null && t > 0 ? t / d * 100 : null, speed: active && t !== null && t > 0 ? d / t : null,
               strokeRaw: typeof x.swimStroke === 'string' ? x.swimStroke : null, stroke: active ? strokeOf(x.swimStroke) : null,
               strokes: active ? st : null, swolf: active ? sw : null, hr: num(x.averageHR), maxHr: num(x.maxHR) };
    });
  }

  /* Plausibilitaet ueber ALLE aktiven Bahnen der Einheit (Vergleichsgruppe = gleiche Lage + gleiche Bahnlaenge) */
  function assessLengths(all) {
    var groups = {};
    all.forEach(function (b) { if (b.kind !== 'active') return; var k = (b.stroke || 'unknown') + '|' + b.distance; (groups[k] = groups[k] || []).push(b); });
    var stats = {};
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], sp = g.map(function (b) { return b.speed; }).filter(function (v) { return v !== null; }), sk = g.map(function (b) { return b.strokes; }).filter(function (v) { return v !== null; });
      stats[k] = { n: g.length, medSpeed: median(sp), medStrokes: median(sk) };
    });
    all.forEach(function (b) {
      if (b.kind !== 'active') { b.quality = null; return; }
      var reasons = [], s = stats[(b.stroke || 'unknown') + '|' + b.distance], lvl = 'plausible';
      if (b.speed !== null && b.speed > WR_SPEED[b.stroke || 'unknown']) { reasons.push('faster_than_world_record'); lvl = 'implausible'; }
      if (b.swolf !== null && b.strokes !== null && b.duration !== null && Math.abs(b.swolf - (b.strokes + Math.round(b.duration))) > REL.swolfTol) reasons.push('swolf_mismatch');
      if (b.strokes === 0) reasons.push('no_strokes');
      var refOk = s && s.n >= REL.minRefs;
      if (refOk && b.speed !== null && s.medSpeed && b.speed >= REL.fastFactor * s.medSpeed) reasons.push('much_faster_than_own_median');
      if (refOk && b.strokes !== null && b.strokes > 0 && s.medStrokes && s.medStrokes >= 5 && b.strokes <= REL.fewStrokesFactor * s.medStrokes) reasons.push('very_few_strokes');
      if (lvl !== 'implausible') lvl = reasons.length ? 'suspect' : (refOk ? 'plausible' : 'unchecked');
      b.quality = { present: true, plausibility: lvl, reasons: reasons, validated: false };
    });
    return stats;
  }

  function build(owner, opts) {
    var src = lapsOf(owner), laps = src.slim || src.raw;
    if (!laps) return null;
    var sameCount = !!(src.slim && src.raw && src.slim.length === src.raw.length);
    var fields = obj(src.ext && src.ext.fields) || {};
    var segs = [], allLengths = [], lengthsLoaded = !!src.raw, nAct = 0;

    laps.forEach(function (lap, i) {
      var rl = src.slim ? rawFor(lap, i, src.raw, sameCount) : lap;
      var dist = num(lap.distance), elapsed = pos(lap.duration) !== null ? pos(lap.duration) : pos(lap.elapsedDuration);
      if (dist === null || dist < 0) return;                                                    // unlesbare Runde: weglassen, nicht raten
      var lens = lengthRows(rl);
      if (dist < 1) {                                                                           // Pausenrunde
        if (elapsed === null) return;
        segs.push({ kind: 'rest', lapIndex: num(lap.lapIndex), duration: elapsed, hr: num(lap.averageHR), maxHr: num(lap.maxHR) });
        return;
      }
      nAct++;
      var act = lens ? lens.filter(function (b) { return b.kind === 'active'; }) : null;
      var idle = lens ? lens.filter(function (b) { return b.kind === 'rest'; }) : null;
      var mv = pos(lap.movingDuration), sumAct = act && act.length && act.every(function (b) { return b.duration !== null; }) ? act.reduce(function (s, b) { return s + b.duration; }, 0) : null;
      var activeTime = mv !== null ? mv : sumAct, activeBasis = mv !== null ? 'lap_moving' : (sumAct !== null ? 'sum_active_lengths' : null);
      var activeCheck = mv !== null && sumAct !== null ? (Math.abs(mv - sumAct) <= 0.5 ? 'match' : 'mismatch') : 'n/a';
      var restInside = null, restBasis = null;
      if (idle) { restInside = idle.reduce(function (s, b) { return s + (b.duration || 0); }, 0); restBasis = 'rest_lengths'; }
      else if (activeTime !== null && elapsed !== null && elapsed >= activeTime - 0.5) { restInside = Math.max(0, elapsed - activeTime); restBasis = 'elapsed_minus_active'; }
      var restCheck = idle && activeTime !== null && elapsed !== null ? (Math.abs(elapsed - activeTime - restInside) <= 1 ? 'match' : 'mismatch') : 'n/a';
      var nLen = num(lap.numberOfActiveLengths), strokes = num(lap.totalNumberOfStrokes), swolf = pos(lap.averageSWOLF);
      var styles = act ? act.reduce(function (o, b) { var k = b.stroke || 'unknown'; o[k] = (o[k] || 0) + 1; return o; }, {}) : null;
      var lapStroke = strokeOf(lap.swimStroke), styleKeys = styles ? Object.keys(styles) : [];
      var stroke = lapStroke || (styleKeys.length === 1 ? styleKeys[0] : (styleKeys.length > 1 ? 'mixed' : null));
      var mixed = stroke === 'mixed' || styleKeys.length > 1;
      var checks = {
        lengths: act && nLen !== null ? (act.length === nLen ? 'match' : 'mismatch') : 'n/a',
        strokes: act && strokes !== null ? (act.reduce(function (s, b) { return s + (b.strokes || 0); }, 0) === strokes ? 'match' : 'mismatch') : 'n/a',
        swolf: act && swolf !== null ? (function () { var v = act.map(function (b) { return b.swolf; }).filter(function (x) { return x !== null; }); return v.length && Math.abs(mean(v) - swolf) <= 1 ? 'match' : 'mismatch'; })() : 'n/a',
        active: activeCheck, restInside: restCheck
      };
      /* Zuege je Bahn nur bei EINER Lage (bei gemischten Lagen nicht vergleichbar; Garmins averageStrokes ist dort nicht nachrechenbar) */
      var spl = !mixed && strokes !== null && nLen ? strokes / nLen : null;
      var seg = { kind: 'interval', n: nAct, lapIndex: num(lap.lapIndex), distance: dist,
                  activeTime: activeTime, activeBasis: activeBasis, elapsedTime: elapsed, restInside: restInside, restBasis: restBasis,
                  pace100Active: activeTime !== null ? activeTime / dist * 100 : null, pace100Elapsed: elapsed !== null ? elapsed / dist * 100 : null,
                  activeLengths: nLen !== null ? nLen : (act ? act.length : null), strokes: strokes, strokesPerLength: spl !== null ? r2(spl) : null,
                  swolf: swolf, stroke: stroke, strokeRaw: typeof lap.swimStroke === 'string' ? lap.swimStroke : null, mixed: mixed, styles: styles,
                  hr: num(lap.averageHR), maxHr: num(lap.maxHR), checks: checks, lengths: lens };
      seg.validation = (checks.lengths !== 'mismatch' && checks.strokes !== 'mismatch' && checks.swolf !== 'mismatch' && checks.active !== 'mismatch' && lens) ? 'consistent' : 'unverified';
      if (lens) lens.forEach(function (b) { b.interval = nAct; allLengths.push(b); });
      segs.push(seg);
    });
    var intervals = segs.filter(function (s) { return s.kind === 'interval'; });
    if (!intervals.length) return null;
    var lengthStats = lengthsLoaded ? assessLengths(allLengths) : null;

    /* Bahnen je Intervall nummerieren (nur aktive), Auffaelligkeiten zaehlen, SWOLF-Verlauf (eine Lage, plausible Bahnen) */
    intervals.forEach(function (s) {
      if (!s.lengths) { s.suspect = 0; s.swolfTrend = null; return; }
      var k = 0; s.lengths.forEach(function (b) { if (b.kind === 'active') b.n = ++k; });
      s.suspect = s.lengths.filter(function (b) { return b.quality && (b.quality.plausibility === 'suspect' || b.quality.plausibility === 'implausible'); }).length;
      var dom = s.styles ? Object.keys(s.styles).sort(function (x, y) { return s.styles[y] - s.styles[x]; })[0] : null;
      var ok = s.lengths.filter(function (b) { return b.kind === 'active' && b.stroke === dom && b.swolf !== null && b.quality && (b.quality.plausibility === 'plausible' || b.quality.plausibility === 'unchecked'); });
      if (ok.length >= 6) {
        var h = Math.floor(ok.length / 2), f = mean(ok.slice(0, h).map(function (b) { return b.swolf; })), l = mean(ok.slice(ok.length - h).map(function (b) { return b.swolf; }));
        s.swolfTrend = { stroke: dom, n: ok.length, first: r2(f), second: r2(l), delta: r2(l - f), poolLength: ok[0].distance };
      } else s.swolfTrend = null;
    });

    /* Pausenbloecke: aufeinanderfolgende Pausenrunden zusammen (Anzeige), die einzelnen Runden bleiben im Block */
    var blocks = [];
    segs.forEach(function (s) {
      var last = blocks[blocks.length - 1];
      if (s.kind === 'rest' && last && last.kind === 'rest') { last.duration += s.duration; last.laps.push(s); last.hr = null; }
      else if (s.kind === 'rest') blocks.push({ kind: 'rest', duration: s.duration, laps: [s], hr: s.hr });
      else blocks.push(s);
    });

    var sum = function (arr, k) { var v = arr.map(function (x) { return x[k]; }); return v.every(function (x) { return x !== null; }) ? v.reduce(function (a, b) { return a + b; }, 0) : null; };
    var tot = { distance: sum(intervals, 'distance'), activeTime: sum(intervals, 'activeTime'), elapsedTime: sum(intervals, 'elapsedTime'), restInside: sum(intervals, 'restInside'),
                restBetween: segs.filter(function (s) { return s.kind === 'rest'; }).reduce(function (a, s) { return a + s.duration; }, 0),
                activeLengths: sum(intervals, 'activeLengths'), strokes: sum(intervals, 'strokes'), intervals: intervals.length,
                restLaps: segs.filter(function (s) { return s.kind === 'rest'; }).length };
    if (tot.activeTime !== null && tot.distance) tot.pace100Active = tot.activeTime / tot.distance * 100;
    var cmp = function (a, b, tol) { if (a === null || b === null) return 'n/a'; return Math.abs(a - b) <= tol ? 'match' : 'mismatch'; };
    var sumDist = num(fields.distance) !== null ? num(fields.distance) : num(((owner || {}).summary || {}).distanceM);
    var sumChecks = { distance: cmp(tot.distance, sumDist, Math.max(1, (sumDist || 0) * 0.01)), activeLengths: cmp(tot.activeLengths, num(fields.activeLengths), 0),
                      strokes: cmp(tot.strokes, num(fields.strokes), 0), activeTime: cmp(tot.activeTime, num(fields.movingDuration), 1) };
    /* Zeitbilanz: Schwimmzeit + Pausen im Intervall + Pausenrunden = Timer der Einheit (keine Pause doppelt, keine verloren) */
    var g = obj((obj(owner && owner.metrics) || {}).garmin) || {}, timer = num(fields.duration) !== null ? num(fields.duration) : pos(g.timer_duration_s);
    sumChecks.timer = tot.activeTime !== null && tot.restInside !== null ? cmp(tot.activeTime + tot.restInside + tot.restBetween, timer, 2) : 'n/a';

    /* Gleichmaessigkeit: nur Intervalle mit Schwimmzeit, EINER bekannten Lage (alle dieselbe) und ≥ 50 m; mindestens drei */
    var effIv = intervals.filter(function (s) { return s.pace100Active !== null && !s.mixed && s.stroke && s.stroke !== 'unknown' && s.distance >= 50; });
    var eff = null;
    if (effIv.length >= 3 && effIv.every(function (s) { return s.stroke === effIv[0].stroke; })) {
      var p = effIv.map(function (s) { return s.pace100Active; }), mu = mean(p), sd = Math.sqrt(mean(p.map(function (x) { return (x - mu) * (x - mu); })));
      var best = effIv.reduce(function (b, s) { return s.pace100Active < b.pace100Active ? s : b; }), worst = effIv.reduce(function (b, s) { return s.pace100Active > b.pace100Active ? s : b; });
      eff = { intervals: effIv.length, stroke: effIv[0].stroke, meanPace: mu, cvPct: mu ? Math.round(sd / mu * 1000) / 10 : null, best: best.n, bestPace: best.pace100Active, worst: worst.n, worstPace: worst.pace100Active };
    }

    var q = { lengths: allLengths.filter(function (b) { return b.kind === 'active'; }).length, plausible: 0, suspect: 0, implausible: 0, unchecked: 0 };
    allLengths.forEach(function (b) { if (b.quality) q[b.quality.plausibility]++; });
    return { v: VERSION, source: src.source === 'garmin_splits' ? 'garmin_extras' : (src.slim ? 'laps' : 'garmin_extras'),
             lengthsLoaded: lengthsLoaded && allLengths.length > 0, segments: segs, blocks: blocks, intervals: intervals, totals: tot, sumChecks: sumChecks,
             efficiency: eff, quality: lengthsLoaded ? q : null, lengthStats: lengthStats, rules: { wrSpeed: WR_SPEED, rel: REL },
             show: intervals.length >= 2 || segs.length > intervals.length };
  }

  /* Reihen je aktiver Bahn fuer Diagramme (Tempo / SWOLF). Auffaellige Bahnen bleiben als Luecke (nie geglaettet). */
  function lengthSeries(model) {
    if (!model || !model.lengthsLoaded) return null;
    var pace = [], swolf = [], labels = [], k = 0;
    model.intervals.forEach(function (s) {
      (s.lengths || []).forEach(function (b) {
        if (b.kind !== 'active') return;
        k++;
        var good = b.quality && (b.quality.plausibility === 'plausible' || b.quality.plausibility === 'unchecked');
        pace.push(good ? b.pace100 : null); swolf.push(good ? b.swolf : null); labels.push(k);
      });
    });
    return { pace100: pace, swolf: swolf, labels: labels };
  }

  var api = { VERSION: VERSION, build: build, lengthSeries: lengthSeries, strokeOf: strokeOf, WR_SPEED: WR_SPEED, REL: REL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.swimIntervals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
