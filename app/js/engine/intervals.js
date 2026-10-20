/* ============================================================
   ORVIA · intervals (v8-454) — gemeinsame Intervall-Engine fuer Laufen, Rad und Schwimmen, rein.

   Kette:  Aktivitaet
             → Quellen-Normalisierung   Runden aus metrics.splits (lokal) + metrics.ext.splits.lapDTOs (Rohblock, bei Bedarf),
                                        verknuepft ueber lapIndex; Herkunft je Feld (lap / raw / stream)
             → Intervall-Erkennung      Typ je Abschnitt + Herkunft der Einordnung (garmin / plan / rule / none)
             → Zeitsemantik             timer (Uhr lief) · elapsed (Wanduhr) · moving (Garmin-Schwelle) — nie gleichgesetzt
             → sportartspezifische Werte Laufen: Tempo, Puls, Kadenz …  Rad: Leistung (nur gemessen), Geschwindigkeit …
             → Datenqualitaet           gemessen / berechnet / ungeprueft / moeglicherweise fehlerhaft / nicht verfuegbar
             → Analyse                  nur vergleichbare Belastungen (gleiche Laenge bzw. Dauer, aehnliches Gelaende)
             → Darstellung              Zeitstrahl + Karten (ui.js zeichnet nur dieses Modell)
   Schwimmen: die Fachlogik bleibt in engine/swim-intervals.js (v8-453, unveraendert); hier nur der Zeitstrahl daraus.
   Keine zweite Aktivitaets- oder Rekord-Engine: nichts hiervon geht in das Leistungsregister, in Bestzeiten oder Prognosen.

   Einordnung (Herkunft immer mitgefuehrt):
     garmin  Runden tragen intensityType (WARMUP / COOLDOWN / REST / RECOVERY / INTERVAL / ACTIVE) und mindestens eine Runde
             ist NICHT „ACTIVE" (sonst traegt jede gewoehnliche Runde ACTIVE — dann ist nichts strukturiert belegt).
             lapTrigger (MANUAL / DISTANCE / TIME / POSITION…) → manuelle bzw. automatische Runde.
     rule    gleich lange Runden (alle bis auf die letzte innerhalb ± 1,5 %) → automatische Runde;
             Laufen: Wechsel schnell/langsam mit klarem Abstand (≥ 20 % Tempo) und ≥ 2 schnellen Runden aehnlicher Laenge
             → Belastung / Erholung, langsame Runde davor / danach → Aufwaermen / Auslaufen. Rad: nur mit GEMESSENER Leistung
             (≥ 30 % Abstand) — Geschwindigkeit draussen haengt am Gelaende.
     none    sonst: „Runde" (Typ nicht bestimmbar). Ein langsamer Abschnitt ist nie automatisch eine Pause.
   Zeiten:
     Tempo / Geschwindigkeit je Runde auf der Timer-Zeit der Runde (angehaltene Uhr verfaelscht nichts, langsame Abschnitte
     werden NICHT abgezogen). Wanduhr − Timer = Uhr angehalten (abgeleitet, nur Hinweis). Bewegungszeit nur als Detail.
     Der Zeitstrahl nutzt die Wanduhr-Dauer je Runde (sonst Timer, benannt); fehlt eine Dauer, gibt es keinen Zeitstrahl.

   Rein: kein DOM, kein Speicher, kein Netz. Veraendert den Datensatz nie.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'intervals@1';

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function pos(v) { var x = num(v); return x !== null && x > 0 ? x : null; }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; }
  function r1(v) { return v === null ? null : Math.round(v * 10) / 10; }
  function req(name, path) {
    if (O[name]) return O[name];
    if (typeof require === 'function') { try { return require(path); } catch (e) { return null; } }
    return null;
  }
  function family(sportId) {
    var s = String(sportId || '').toLowerCase();
    if (s === 'swimming') return 'swimming';
    if (s === 'cycling') return 'cycling';
    if (s === 'running' || s === 'walking' || s === 'hiking' || s === 'trail_running') return 'running';
    return null;
  }

  /* Feldnamen der Garmin-Rundenantwort (get_activity_splits.lapDTOs). Erste vorhandene gewinnt; der benutzte Name wird
     gemeldet. Laufen/Rad: Namen laut Bibliothek — Beleg je Name durch den Mitschnitt (ACTIVITY-ANALYSIS.md §10). */
  var F = {
    hr: ['averageHR'], maxHr: ['maxHR'], elevGain: ['elevationGain'], elevLoss: ['elevationLoss'], maxSpeed: ['maxSpeed'],
    runCadence: ['averageRunCadence', 'averageRunningCadenceInStepsPerMinute'], bikeCadence: ['averageBikeCadence', 'averageBikingCadenceInRevPerMinute'],
    power: ['averagePower', 'avgPower'], maxPower: ['maxPower'], np: ['normalizedPower', 'normPower'], calories: ['calories'],
    stride: ['strideLength'], gct: ['groundContactTime']
  };
  function pick(lap, names) { for (var i = 0; i < names.length; i++) { var v = num(lap[names[i]]); if (v !== null) return { v: v, field: names[i] }; } return null; }

  /* ---------- Quellen-Normalisierung ---------- */
  function lapsOf(owner, opts) {
    var m = obj(owner && owner.metrics) || {};
    var slim = Array.isArray(m.splits) ? m.splits.filter(obj) : [];
    /* Altbestand: Runden aus der verknuepften Trainingssession (Tagesblob, {km, sec, hr}) — nur wenn der Datensatz keine traegt */
    if (!slim.length && opts && Array.isArray(opts.legacySplits) && opts.legacySplits.length) {
      slim = opts.legacySplits.filter(obj).map(function (x) { return { distance: num(x.km) !== null ? x.km * 1000 : num(x.distance), duration: num(x.sec) !== null ? x.sec : num(x.duration), averageHR: num(x.hr) !== null ? x.hr : num(x.averageHR) }; });
      return { laps: slim.map(function (l) { return { lap: l, hasRaw: false }; }), source: 'legacy_session', rawLoaded: false, ext: obj(m.ext), m: m };
    }
    var ext = obj(m.ext), raw = ext && obj(ext.splits) && Array.isArray(ext.splits.lapDTOs) ? ext.splits.lapDTOs.filter(obj) : [];
    var source = m.splits_source === 'garmin_splits' ? 'garmin_laps' : (slim.length ? (owner && owner.source === 'garmin' ? 'garmin_details' : 'own') : (raw.length ? 'garmin_laps' : null));
    var base = slim.length ? slim : raw, same = slim.length && raw.length && slim.length === raw.length;
    var laps = base.map(function (l, i) {
      var li = num(l.lapIndex), r = null;
      if (slim.length && raw.length) {
        if (li !== null) { for (var k = 0; k < raw.length; k++) if (num(raw[k].lapIndex) === li) { r = raw[k]; break; } }
        else if (same) r = raw[i];
      }
      var merged = {}; Object.keys(r || {}).forEach(function (k) { merged[k] = r[k]; }); Object.keys(l).forEach(function (k) { if (l[k] !== undefined && l[k] !== null) merged[k] = l[k]; });
      return { lap: merged, hasRaw: !!r || !slim.length };
    });
    return { laps: laps, source: source, rawLoaded: raw.length > 0, ext: ext, m: m };
  }

  /* Zeitfenster der Runde auf der Zeitachse der Messreihen (Sekunden seit Start), nur wenn beide Zeitpunkte belegt sind */
  function windowOf(lap, startMs) {
    if (startMs === null || typeof lap.startTimeGMT !== 'string') return null;
    var t = Date.parse(lap.startTimeGMT.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(lap.startTimeGMT) ? '' : 'Z'));
    if (!isFinite(t)) return null;
    var d = pos(lap.elapsedDuration) !== null ? pos(lap.elapsedDuration) : pos(lap.duration);
    if (d === null) return null;
    var off = (t - startMs) / 1000;
    return off >= -2 ? { from: Math.max(0, off), to: off + d } : null;
  }
  /* noZeros: Kadenz — Garmins Rundenmittel zaehlt Stillstand (0) nicht mit (Mitschnitt: Runden mit Halt passen nur so) */
  function streamMean(streams, key, w, noZeros) {
    var t = streams && streams.time, v = streams && streams[key];
    if (!w || !Array.isArray(t) || !Array.isArray(v) || t.length !== v.length) return null;
    var s = [];
    for (var i = 0; i < t.length; i++) { var x = num(v[i]), ti = num(t[i]); if (x !== null && ti !== null && ti >= w.from && ti < w.to && !(noZeros && x === 0)) s.push(x); }
    return s.length >= 3 ? { v: mean(s), n: s.length } : null;
  }

  /* ---------- Intervall-Erkennung ---------- */
  var GARMIN_KIND = { WARMUP: 'warmup', COOLDOWN: 'cooldown', REST: 'recovery', RECOVERY: 'recovery', INTERVAL: 'work', ACTIVE: 'work' };
  var TRIGGER_KIND = { MANUAL: 'manual_lap', DISTANCE: 'auto_lap', TIME: 'auto_lap', POSITION_START: 'auto_lap', POSITION_LAP: 'auto_lap', POSITION_WAYPOINT: 'auto_lap', POSITION_MARKED: 'auto_lap' };

  function classify(segs, fam, powerMeasured) {
    var types = segs.map(function (s) { return typeof s.lap.intensityType === 'string' ? s.lap.intensityType.toUpperCase() : null; });
    /* Struktur nur, wenn die Runden mindestens ZWEI verschiedene Belastungsarten tragen. Mitschnitt 19.10.2026: ein
       gewoehnlicher Lauf trug in allen Runden „INTERVAL", ein Workout-Lauf in allen Runden „ACTIVE" — einheitlich = nichts belegt. */
    var kinds = {}; types.forEach(function (t) { if (t && GARMIN_KIND[t]) kinds[GARMIN_KIND[t]] = true; });
    var structured = Object.keys(kinds).length >= 2 && types.every(function (t) { return t && GARMIN_KIND[t]; });
    if (structured) {
      segs.forEach(function (s, i) { var k = GARMIN_KIND[types[i]]; s.kind = k || 'unknown'; s.kindSource = k ? 'garmin' : 'none'; s.kindReason = k ? 'intensity_' + types[i].toLowerCase() : 'intensity_unknown'; });
      return 'garmin';
    }
    var trig = segs.map(function (s) { return typeof s.lap.lapTrigger === 'string' ? s.lap.lapTrigger.toUpperCase() : null; });
    if (trig.every(function (t) { return t && (TRIGGER_KIND[t] || t === 'SESSION_END'); }) && trig.some(function (t) { return TRIGGER_KIND[t]; })) {
      segs.forEach(function (s, i) { var k = TRIGGER_KIND[trig[i]] || (i > 0 ? segs[i - 1].kind : 'unknown'); s.kind = k; s.kindSource = 'garmin'; s.kindReason = 'trigger_' + String(trig[i]).toLowerCase(); });
      return 'garmin_trigger';
    }
    /* automatische Runden: alle bis auf die letzte gleich lang (± 1,5 %), mindestens drei, letzte nicht laenger */
    var moving = segs.filter(function (s) { return s.distance > 0; });
    if (moving.length >= 3) {
      var body = moving.slice(0, -1).map(function (s) { return s.distance; }), med = median(body), last = moving[moving.length - 1].distance;
      if (med > 0 && body.every(function (d) { return Math.abs(d - med) <= med * 0.015; }) && last <= med * 1.015) {
        segs.forEach(function (s) { s.kind = s.distance > 0 ? 'auto_lap' : 'unknown'; s.kindSource = 'rule'; s.kindReason = 'equal_distance_' + Math.round(med); });
        return 'rule_auto';
      }
    }
    /* Belastung / Erholung nach Regel */
    var metric = fam === 'running' ? function (s) { return s.speed; } : (powerMeasured ? function (s) { return s.power ? s.power.v : null; } : null);
    var gap = fam === 'running' ? 1.2 : 1.3;
    if (metric && segs.length >= 4) {
      var vals = segs.map(metric), ok = vals.filter(function (v) { return v !== null && v > 0; });
      if (ok.length === segs.length) {
        var sorted = ok.slice().sort(function (a, b) { return a - b; }), bestSplit = null;
        for (var c = 1; c < sorted.length; c++) {
          var lo = sorted.slice(0, c), hi = sorted.slice(c), ratio = mean(hi) / mean(lo), within = Math.min.apply(null, hi) / Math.max.apply(null, lo);
          if (within >= 1.08 && ratio >= gap && (!bestSplit || within > bestSplit.within)) bestSplit = { thr: (Math.max.apply(null, lo) + Math.min.apply(null, hi)) / 2, within: within };
        }
        if (bestSplit) {
          var fast = segs.map(function (s, i) { return vals[i] > bestSplit.thr; });
          var nFast = fast.filter(Boolean).length, first = fast.indexOf(true), lastF = fast.lastIndexOf(true);
          var fastSegs = segs.filter(function (s, i) { return fast[i]; });
          var sizeVar = (function () { var d = fastSegs.map(function (s) { return fam === 'running' ? s.distance : s.timer; }).filter(function (x) { return x; }), mu = mean(d); return d.length && mu ? Math.sqrt(mean(d.map(function (x) { return (x - mu) * (x - mu); }))) / mu : 1; })();
          var alternating = true; for (var j = first; j < lastF; j++) if (fast[j] && fast[j + 1] && fastSegs.length > 2 && segs.length > 6) { /* zwei schnelle hintereinander sind erlaubt, aber nicht ueberwiegend */ }
          var pairs = 0; for (var q = first; q < lastF; q++) if (fast[q] && !fast[q + 1]) pairs++;
          if (nFast >= 2 && pairs >= 1 && sizeVar <= 0.25 && alternating) {
            segs.forEach(function (s, i) {
              if (fast[i]) { s.kind = 'work'; s.kindReason = 'faster_cluster'; }
              else if (i < first) { s.kind = 'warmup'; s.kindReason = 'slow_before_first_work'; }
              else if (i > lastF) { s.kind = 'cooldown'; s.kindReason = 'slow_after_last_work'; }
              else { s.kind = 'recovery'; s.kindReason = 'slow_between_work'; }
              s.kindSource = 'rule';
            });
            return 'rule_work';
          }
        }
      }
    }
    segs.forEach(function (s) { s.kind = s.distance === 0 && fam !== 'cycling' ? 'recovery' : 'unknown'; s.kindSource = s.distance === 0 && fam !== 'cycling' ? 'rule' : 'none'; s.kindReason = s.distance === 0 ? 'no_distance' : 'not_determinable'; });
    return 'none';
  }

  /* ---------- Garmin-Workout-Schritte ----------
     a) get_activity_typed_splits: Abschnitte INTERVAL_* mit lapIndexes (Mitschnitt 19.10.2026, Laufen). Daneben RWD_RUN /
        RWD_WALK / RWD_STAND (Lauf-/Geh-/Steherkennung) — keine Intervalle, hier nicht verwendet.
     b) ohne typed_splits: Runden mit wktStepIndex (Schritt des Garmin-Workouts), aufeinanderfolgende gleiche Schritte.
     Einordnung: tragen die Schritte ≥ 2 verschiedene Arten (ACTIVE/REST/RECOVERY/WARMUP/COOLDOWN) → Belastung/Erholung/…;
     tragen alle „ACTIVE" → „Abschnitt" (step): Garmin unterscheidet dann keine Belastungsart. */
  var TYPED_KIND = { INTERVAL_ACTIVE: 'work', INTERVAL_REST: 'recovery', INTERVAL_RECOVERY: 'recovery', INTERVAL_WARMUP: 'warmup', INTERVAL_COOLDOWN: 'cooldown' };
  function stepsOf(src, lapSegs) {
    var ext = src.ext, ts = ext && obj(ext.typed_splits) && Array.isArray(ext.typed_splits.splits) ? ext.typed_splits.splits.filter(obj) : [];
    var iv = ts.filter(function (t) { return typeof t.type === 'string' && t.type.indexOf('INTERVAL_') === 0; });
    var out = null, from = null;
    if (iv.length >= 2) {
      from = 'garmin_typed';
      out = iv.map(function (t) {
        var li = Array.isArray(t.lapIndexes) ? t.lapIndexes.map(num).filter(function (x) { return x !== null; }) : [];
        var kids = lapSegs.filter(function (s) { return s.lapIndex !== null && li.indexOf(s.lapIndex) >= 0; });
        var dist = num(t.distance), timer = pos(t.duration), elapsed = pos(t.elapsedDuration), tt = timer !== null ? timer : elapsed;
        return { typed: String(t.type), kindRaw: TYPED_KIND[t.type] || 'unknown', distance: dist !== null ? dist : 0, timer: timer, elapsed: elapsed, moving: pos(t.movingDuration),
                 timeBasis: timer !== null ? 'timer' : 'elapsed', stoppedInside: (timer !== null && elapsed !== null && elapsed - timer > 2) ? elapsed - timer : 0,
                 pace: dist > 0 && tt ? tt / dist * 1000 : null, speed: dist > 0 && tt ? dist / tt : null,
                 hr: num(t.averageHR), maxHr: num(t.maxHR), elevGain: num(t.elevationGain), elevLoss: num(t.elevationLoss),
                 cadence: num(t.averageRunCadence) !== null ? (function () {
                   /* Gegenprobe: zeitgewichtetes Mittel der gepruefte Rundenkadenzen desselben Schritts */
                   var c = kids.filter(function (s) { return s.cadence && s.cadence.quality === 'measured' && s.timer; }), v = num(t.averageRunCadence);
                   var w = c.length === kids.length && c.length ? c.reduce(function (a, s) { return a + s.cadence.v * s.timer; }, 0) / c.reduce(function (a, s) { return a + s.timer; }, 0) : null;
                   var ok = w !== null && Math.abs(w - v) <= Math.max(2, v * 0.03);
                   return { v: v, field: 'averageRunCadence', quality: ok ? 'measured' : 'unverified', check: w === null ? 'n/a' : (ok ? 'match' : 'mismatch') };
                 })() : null,
                 power: null, maxPower: null, np: null, bestPace: null, children: kids, valuesFrom: 'garmin_typed', quality: [] };
      });
    } else {
      var w = lapSegs.map(function (s) { return num(s.lap.wktStepIndex); });
      var distinct = {}; w.forEach(function (x) { if (x !== null) distinct[x] = true; });
      if (Object.keys(distinct).length >= 2) {
        from = 'garmin_wkt';
        out = [];
        lapSegs.forEach(function (s, i) {
          var cur = out[out.length - 1];
          if (w[i] === null && cur) { cur.children.push(s); return; }                // Restrunde am Ende (ohne Schritt) gehoert zum letzten
          if (!cur || cur.wkt !== w[i]) out.push(cur = { wkt: w[i], kindRaw: 'work', children: [] });
          cur.children.push(s);
        });
        out.forEach(function (st) {
          var k = st.children, sum = function (f) { var v = k.map(f); return v.every(function (x) { return x !== null; }) ? v.reduce(function (a, b) { return a + b; }, 0) : null; };
          st.distance = sum(function (s) { return s.distance; }) || 0; st.timer = sum(function (s) { return s.timer; }); st.elapsed = sum(function (s) { return s.elapsed; });
          st.moving = sum(function (s) { return s.moving; }); st.timeBasis = st.timer !== null ? 'timer' : 'elapsed';
          var tt = st.timer !== null ? st.timer : st.elapsed; st.stoppedInside = st.timer !== null && st.elapsed !== null && st.elapsed - st.timer > 2 ? st.elapsed - st.timer : 0;
          st.pace = st.distance > 0 && tt ? tt / st.distance * 1000 : null; st.speed = st.distance > 0 && tt ? st.distance / tt : null;
          /* Puls je Schritt: zeitgewichtetes Mittel der Runden-Mittel (berechnet) */
          var hw = k.filter(function (s) { return s.hr !== null && s.timer; });
          st.hr = hw.length === k.length && hw.length ? Math.round(hw.reduce(function (a, s) { return a + s.hr * s.timer; }, 0) / hw.reduce(function (a, s) { return a + s.timer; }, 0)) : null;
          st.maxHr = k.every(function (s) { return s.maxHr !== null; }) ? Math.max.apply(null, k.map(function (s) { return s.maxHr; })) : null;
          st.elevGain = sum(function (s) { return s.elevGain; }); st.elevLoss = sum(function (s) { return s.elevLoss; });
          var cw = k.filter(function (s) { return s.cadence && s.timer; });
          st.cadence = cw.length === k.length && cw.length ? { v: Math.round(cw.reduce(function (a, s) { return a + s.cadence.v * s.timer; }, 0) / cw.reduce(function (a, s) { return a + s.timer; }, 0)), field: 'laps', quality: 'derived', check: 'n/a' } : null;
          st.power = null; st.maxPower = null; st.np = null; st.bestPace = null; st.valuesFrom = 'laps_summed'; st.quality = [];
        });
      }
    }
    if (!out || out.length < 2) return null;
    var kinds = {}; out.forEach(function (st) { kinds[st.kindRaw] = true; });
    var uniform = Object.keys(kinds).length < 2;
    out.forEach(function (st, i) {
      st.idx = i; st.lapIndex = null; st.window = null; st.fields = {}; st.hrCheck = 'n/a';
      st.kind = uniform ? 'step' : st.kindRaw; st.kindSource = 'garmin'; st.kindReason = from === 'garmin_typed' ? 'workout_typed_' + String(st.typed || '').toLowerCase() : 'workout_step_index';
      st.stepN = i + 1;
    });
    return { from: from, uniform: uniform, steps: out };
  }

  /* ---------- Analyse vergleichbarer Belastungen ---------- */
  function analyticsOf(segs, fam, powerMeasured) {
    var work = segs.filter(function (s) { return s.kind === 'work'; });
    var basis = 'work';
    if (work.length < 3) { var al = segs.filter(function (s) { return s.kind === 'auto_lap'; }); if (al.length >= 4) { work = al.slice(0, -1); basis = 'auto_lap'; } }
    if (work.length < 3) return null;
    /* Rad ohne GEMESSENE Leistung: keine Leistungsbewertung (Geschwindigkeit draussen haengt an Gelaende und Wind, drinnen ist sie modelliert) */
    if (fam === 'cycling' && !powerMeasured) return { basis: basis, comparable: false, reason: 'no_power', groups: 0 };
    /* Gruppe: gleiche Laenge (Laufen, automatische Runden) bzw. Dauer (Rad-Intervalle) ± 7 %; groesste Gruppe */
    var key = (fam === 'cycling' && basis === 'work') ? 'timer' : 'distance';
    var groups = [];
    work.forEach(function (s) { var g = groups.filter(function (x) { return Math.abs(s[key] - x.ref) <= x.ref * 0.07; })[0]; if (g) g.m.push(s); else groups.push({ ref: s[key], m: [s] }); });
    groups.sort(function (a, b) { return b.m.length - a.m.length; });
    var g = groups[0]; if (!g || g.m.length < 3) return { basis: basis, comparable: false, reason: 'no_comparable_group', groups: groups.length };
    /* Gelaende: Hoehenmeter je km deutlich anders als der Median → nicht vergleichbar (wenn belegt) */
    var climb = g.m.map(function (s) { return (s.elevGain !== null && s.distance > 0) ? s.elevGain / s.distance * 1000 : null; });
    var cm = median(climb.filter(function (x) { return x !== null; }));
    /* Stillstand in der Runde (Bewegungszeit < 90 % der Timer-Zeit): Tempo nicht vergleichbar */
    var members = g.m.filter(function (s, i) { return (climb[i] === null || cm === null || Math.abs(climb[i] - cm) <= 15) && !(s.moving && s.timer && s.moving < s.timer * 0.9); });
    var excluded = g.m.length - members.length;
    if (members.length < 3) return { basis: basis, comparable: false, reason: 'terrain_differs', groups: groups.length };
    var metric = fam === 'cycling' ? (powerMeasured ? 'power' : 'speed') : 'pace';
    var val = function (s) { return metric === 'power' ? (s.power ? s.power.v : null) : (metric === 'speed' ? s.speed : s.pace); };
    var v = members.map(val);
    if (v.some(function (x) { return x === null; })) return { basis: basis, comparable: false, reason: 'missing_values', groups: groups.length };
    var mu = mean(v), sd = Math.sqrt(mean(v.map(function (x) { return (x - mu) * (x - mu); })));
    var higherBetter = metric !== 'pace';
    var bi = 0, wi = 0; v.forEach(function (x, i) { if (higherBetter ? x > v[bi] : x < v[bi]) bi = i; if (higherBetter ? x < v[wi] : x > v[wi]) wi = i; });
    /* Verlauf: lineare Regression ueber die Wiederholungen; Aussage nur bei klarer Richtung (R² ≥ 0,5) und ≥ 3 % */
    var n = v.length, xs = v.map(function (_, i) { return i; }), xm = mean(xs), sxy = 0, sxx = 0, syy = 0;
    v.forEach(function (y, i) { sxy += (xs[i] - xm) * (y - mu); sxx += (xs[i] - xm) * (xs[i] - xm); syy += (y - mu) * (y - mu); });
    var slope = sxx ? sxy / sxx : 0, r2 = (sxx && syy) ? (sxy * sxy) / (sxx * syy) : 0, changePct = mu ? slope * (n - 1) / mu * 100 : 0;
    var trend = null;
    /* Aussage nur mit genug Wiederholungen: ≥ 4 Belastungen bzw. ≥ 5 gleich lange Runden */
    if (n >= (basis === 'work' ? 4 : 5) && Math.abs(changePct) >= 3 && r2 >= 0.5) trend = (higherBetter ? changePct < 0 : changePct > 0) ? 'slower' : 'faster';
    var hr = members.map(function (s) { return s.hr; }), hrOk = hr.every(function (x) { return x !== null; });
    /* Nummer so, wie sie der Nutzer sieht: Belastung n (workN) bzw. Runde n (Garmin-Rundennummer) */
    var unit = basis === 'work' ? 'work' : 'lap';
    var label = function (s) { return unit === 'work' ? (s.workN != null ? s.workN : (s.lapIndex != null ? s.lapIndex : s.n)) : (s.lapIndex != null ? s.lapIndex : s.n); };
    return { unit: unit, basis: basis, comparable: true, metric: metric, ref: g.ref, refKey: key, count: n, excluded: excluded, mean: mu, cvPct: mu ? Math.round(sd / mu * 1000) / 10 : null,
             best: label(members[bi]), bestValue: v[bi], worst: label(members[wi]), worstValue: v[wi], changePct: r1(changePct), r2: Math.round(r2 * 100) / 100, trend: trend,
             hrFirst: hrOk ? hr[0] : null, hrLast: hrOk ? hr[n - 1] : null, hrChange: hrOk ? hr[n - 1] - hr[0] : null, members: members.map(label),
             /* v8-456: Werte je Mitglied (gleiche Reihenfolge wie members) — fuer Highlights, damit dort dieselbe Gruppe gilt */
             values: v.slice(), dists: members.map(function (s) { return s.distance; }), times: members.map(function (s) { return s.timer !== null ? s.timer : s.elapsed; }) };
  }

  /* ---------- Hauptfunktion Laufen / Rad ---------- */
  function buildLaps(owner, fam, opts) {
    var src = lapsOf(owner, opts); if (!src.laps.length) return null;
    var ME = req('metricEligibility', './metric-eligibility.js');
    var desc = (opts && opts.desc) || (ME && ME.describeActivity ? ME.describeActivity(owner, opts || {}) : null);
    var dm = desc ? desc.metrics : {};
    var powerMeasured = !!(dm.avgPower && dm.avgPower.status === 'available' && dm.avgPower.validation !== 'blocked');
    var cadOk = dm.cadenceSeries && dm.cadenceSeries.status === 'available' && dm.cadenceSeries.validation !== 'blocked' && dm.cadenceSeries.kind === (fam === 'cycling' ? 'cycling_cadence_rpm' : 'running_cadence_spm');
    var g = obj(src.m.garmin) || {}, streams = obj(src.m.streams) || {};
    var startMs = typeof g.start_gmt === 'string' ? Date.parse(g.start_gmt) : null; if (!isFinite(startMs)) startMs = null;
    var ctx = desc && desc.context ? desc.context.environment : null;
    var segs = [];
    src.laps.forEach(function (x, i) {
      var l = x.lap, dist = num(l.distance), timer = pos(l.duration), elapsed = pos(l.elapsedDuration), moving = pos(l.movingDuration);
      if (dist === null || dist < 0 || (timer === null && elapsed === null)) return;            // unlesbare Runde: weglassen, nicht raten
      var t = timer !== null ? timer : elapsed, tBasis = timer !== null ? 'timer' : 'elapsed';
      var w = windowOf(l, startMs);
      var s = { idx: segs.length, lapIndex: num(l.lapIndex), lap: l, distance: dist, timer: timer, elapsed: elapsed, moving: moving, timeBasis: tBasis,
                stoppedInside: (timer !== null && elapsed !== null && elapsed - timer > 2) ? elapsed - timer : 0,
                pace: dist > 0 ? t / dist * 1000 : null, speed: dist > 0 ? dist / t : null, window: w, fields: {}, quality: [] };
      var hr = pick(l, F.hr), mhr = pick(l, F.maxHr);
      s.hr = hr ? hr.v : null; s.maxHr = mhr ? mhr.v : null; if (hr) s.fields.hr = hr.field;
      var hs = streamMean(streams, 'heart_rate', w);
      s.hrCheck = hr && hs ? (Math.abs(hs.v - hr.v) <= Math.max(3, hr.v * 0.03) ? 'match' : 'mismatch') : 'n/a';
      if (s.hr === null && hs) { s.hr = Math.round(hs.v); s.fields.hr = 'stream'; }
      var eg = pick(l, F.elevGain), el = pick(l, F.elevLoss);
      s.elevGain = eg ? eg.v : null; s.elevLoss = el ? el.v : null;
      /* Kadenz: Rundenfeld nur, wenn es zur GEPRUEFTEN Messreihe passt; sonst der Mittelwert der Messreihe im Rundenfenster */
      var cad = pick(l, fam === 'cycling' ? F.bikeCadence : F.runCadence), cs = cadOk ? streamMean(streams, 'cadence', w, true) : null;
      s.cadence = null;
      if (cad && cs && Math.abs(cs.v - cad.v) <= Math.max(2, cs.v * 0.04)) s.cadence = { v: cad.v, field: cad.field, quality: 'measured', check: 'match' };
      else if (cs) s.cadence = { v: Math.round(cs.v), field: 'stream', quality: 'derived', check: cad ? 'mismatch' : 'n/a' };
      else if (cad && fam === 'cycling') s.cadence = { v: cad.v, field: cad.field, quality: 'unverified', check: 'n/a' };
      /* Laufkadenz ohne gepruefte Reihe: nicht gezeigt (Altbestand: halber Wert moeglich, v8-447) */
      /* Leistung: NUR mit gemessener Leistung der Einheit; nie aus Tempo, Hoehe oder Puls */
      s.power = null; s.maxPower = null; s.np = null;
      if (powerMeasured) {
        var pw = pick(l, F.power), ps = streamMean(streams, 'power', w);
        if (pw) s.power = { v: pw.v, field: pw.field, quality: ps ? (Math.abs(ps.v - pw.v) <= Math.max(5, pw.v * 0.05) ? 'measured' : 'unverified') : 'unverified', check: ps ? (Math.abs(ps.v - pw.v) <= Math.max(5, pw.v * 0.05) ? 'match' : 'mismatch') : 'n/a' };
        else if (ps) s.power = { v: Math.round(ps.v), field: 'stream', quality: 'derived', check: 'n/a' };
        var mp = pick(l, F.maxPower), np = pick(l, F.np);
        s.maxPower = mp ? { v: mp.v, field: mp.field, quality: 'unverified' } : null;
        s.np = np ? { v: np.v, field: np.field, quality: 'unverified' } : null;      // Garmin-Wert, nicht nachgerechnet
      }
      /* Bestes Tempo der Runde: Garmins maxSpeed, nur plausibel (≤ 1,6 × Mittel) und als ungeprueft */
      var mx = pick(l, F.maxSpeed);
      s.bestPace = (fam === 'running' && mx && s.speed && mx.v > 0 && mx.v <= s.speed * 1.6) ? { v: 1000 / mx.v, quality: 'unverified' } : null;
      /* Plausibilitaet der Runde selbst (nie korrigiert) */
      if (fam === 'running' && s.pace !== null && s.pace < 150) s.quality.push('pace_faster_than_world_record');
      if (fam === 'cycling' && s.speed !== null && s.speed > 25 && ctx !== 'virtual') s.quality.push('speed_implausible');
      if (s.hrCheck === 'mismatch') s.quality.push('hr_differs_from_series');
      segs.push(s);
    });
    if (!segs.length) return null;
    var how = classify(segs, fam, powerMeasured);
    var k = 0; segs.forEach(function (s) { if (s.kind === 'work' || s.kind === 'auto_lap' || s.kind === 'manual_lap' || s.kind === 'unknown') s.n = ++k; else s.n = null; });
    var wn = 0; segs.forEach(function (s) { s.workN = s.kind === 'work' ? ++wn : null; });
    var st = stepsOf(src, segs), primary = st ? st.steps : segs, an;
    if (st) {
      /* n = Position in der Liste; workN = Nummer der Belastung (so steht sie auf der Karte: „Belastung 1") */
      var sn = 0, swn = 0; primary.forEach(function (x) { x.n = ++sn; x.workN = x.kind === 'work' ? ++swn : null; });
      an = analyticsOf(primary, fam, powerMeasured);
      if (!an || !an.comparable) {
        /* gleich lange Runden innerhalb des laengsten Schritts (ohne Teilrunde am Ende) — z. B. Kilometer im Tempo-Block */
        var longest = primary.slice().sort(function (a, b) { return b.children.length - a.children.length; })[0];
        var kids = longest ? longest.children.filter(function (c) { return c.kind === 'auto_lap'; }) : [];
        var an2 = kids.length >= 4 ? analyticsOf(kids.map(function (c) { return Object.assign({}, c, { kind: 'work' }); }), fam, powerMeasured) : null;
        if (an2 && an2.comparable) { an2.basis = 'auto_lap_in_step'; an2.unit = 'lap'; an2.step = longest.n; an = an2; }
      }
    } else an = analyticsOf(segs, fam, powerMeasured);
    var stripped = primary.map(function (x) { var o = strip(x); if (x.children) o.children = x.children.map(strip); return o; });
    return { v: VERSION, family: fam, context: ctx, source: src.source, rawLoaded: src.rawLoaded, classification: st ? st.from : how, lapClassification: how,
             structure: st ? (st.uniform ? 'workout_steps' : 'workout_intervals') : how, powerMeasured: powerMeasured,
             segments: stripped, laps: segs.length, timeline: timelineOf(primary), analytics: an,
             counts: countKinds(primary), show: primary.length >= 2 };
  }
  function strip(s) { var o = {}; Object.keys(s).forEach(function (k) { if (k !== 'lap') o[k] = s[k]; }); return o; }
  function countKinds(segs) { var c = {}; segs.forEach(function (s) { c[s.kind] = (c[s.kind] || 0) + 1; }); return c; }

  /* Zeitstrahl: Breite = Dauer des Abschnitts (Wanduhr, sonst Timer — benannt). Fehlt eine Dauer → kein Zeitstrahl. */
  function timelineOf(segs) {
    var useElapsed = segs.every(function (s) { return s.elapsed !== null; }), d = segs.map(function (s) { return useElapsed ? s.elapsed : s.timer; });
    if (d.some(function (x) { return x === null || !(x > 0); })) return null;
    var total = d.reduce(function (a, b) { return a + b; }, 0), at = 0;
    return { basis: useElapsed ? 'elapsed' : 'timer', total: total, blocks: segs.map(function (s, i) { var b = { idx: s.idx, kind: s.kind, kindSource: s.kindSource, n: s.n, workN: s.workN, start: at, dur: d[i], share: d[i] / total }; at += d[i]; return b; }) };
  }

  /* Schwimmen: Zeitstrahl aus dem Modell von swim-intervals (Intervallzeit inkl. Pausen im Intervall + Pausenrunden) */
  function swimTimeline(swim) {
    if (!swim || !swim.blocks) return null;
    var items = swim.blocks.map(function (b, i) { return { idx: i, kind: b.kind === 'rest' ? 'recovery' : 'work', kindSource: 'garmin', n: b.kind === 'rest' ? null : b.n, workN: b.kind === 'rest' ? null : b.n, dur: b.kind === 'rest' ? b.duration : b.elapsedTime }; });
    if (items.some(function (x) { return !(x.dur > 0); })) return null;
    var total = items.reduce(function (a, b) { return a + b.dur; }, 0), at = 0;
    items.forEach(function (x) { x.start = at; x.share = x.dur / total; at += x.dur; });
    return { basis: 'elapsed', total: total, blocks: items };
  }

  /* Einheitliche Zustaende der Datenqualitaet (Anzeige): aus dem Urteil einer Kennzahl bzw. eines Rundenwerts */
  function qualityState(d) {
    if (!d) return 'missing';
    if (d.status && d.status !== 'available') return 'missing';
    if (d.quality === 'suspect' || d.plausibility === 'suspect' || d.plausibility === 'implausible') return 'suspect';
    if (d.reason === 'garmin_estimate' || d.method === 'estimated') return 'estimated';
    if (d.method === 'derived' || d.quality === 'derived') return 'derived';
    if (d.validation === 'unverified' || d.quality === 'unverified') return 'unverified';
    return 'measured';
  }

  function build(owner, opts) {
    var fam = family(owner && owner.sportId); if (!fam) return null;
    if (fam === 'swimming') {
      var SI = req('swimIntervals', './swim-intervals.js'); var sw = SI ? SI.build(owner, opts || {}) : null;
      return sw ? { v: VERSION, family: fam, swim: sw, timeline: swimTimeline(sw), show: sw.show } : null;
    }
    return buildLaps(owner, fam, opts || {});
  }

  var api = { VERSION: VERSION, build: build, family: family, classify: classify, timelineOf: timelineOf, swimTimeline: swimTimeline, qualityState: qualityState, FIELDS: F };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.intervals = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
