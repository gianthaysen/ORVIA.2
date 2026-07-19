/* ============================================================
   ORVIA · activity-normalize — REINE Normalisierung für Aktivitäten & Workout-Sessions.
   Phase 1 (offline-sicher) der Training/Activity-Stabilisierung.
   Kein DOM, kein Store, kein Supabase. Vorbereitung der kanonischen activities-Architektur:
     - durationSeconds als EINZIGE interne Dauereinheit,
     - defensive, idempotente, NICHT mutierende Normalisierung von Alt-/Neufeldern,
     - Plausibilität (0-min-/710-min-Fälle) klar markiert statt still 0 anzuzeigen.
   Verfügbar über window.ORVIA.activityNormalize + module.exports.
   ============================================================ */
(function (root) {
  // Realistische Obergrenze für eine einzelne Einheit: 8 h. Darüber gilt die Dauer als
  // unplausibel (z. B. „aktiv" über Nacht vergessen → 710 min). Nicht stillschweigend anzeigen.
  var MAX_PLAUSIBLE_SECONDS = 8 * 3600;

  function num(v) { if (v == null || v === '') return null; var n = (typeof v === 'number') ? v : parseFloat(v); return isFinite(n) ? n : null; }
  function intOrNull(v) { var n = num(v); return n == null ? null : Math.round(n); }
  function iso(v) { if (!v) return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }

  // Kanonische Dauer in SEKUNDEN aus einem beliebigen (Alt-)Datensatz ableiten.
  // Reihenfolge: explizite Sekunden → endedAt-startedAt → Minuten-Felder → unbekannt(null).
  // Schützt gegen Millisekunden-als-Sekunden und Sekunden-als-Minuten.
  function durationSecondsOf(raw) {
    if (!raw) return null;
    // 1) explizite Sekundenfelder
    var sec = num(raw.durationSeconds != null ? raw.durationSeconds : (raw.duration_seconds != null ? raw.duration_seconds : raw.elapsed_time));
    if (sec != null && sec >= 0) return Math.round(sec);
    // 2) Zeitstempel-Differenz (started/ended in beliebiger Schreibweise)
    var start = iso(raw.startedAt || raw.started_at);
    var end = iso(raw.endedAt || raw.ended_at || raw.finishedAt || raw.finished_at);
    if (start && end) {
      var diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
      var paused = num(raw.totalPausedSeconds != null ? raw.totalPausedSeconds : raw.total_paused_seconds) || 0;
      var net = diff - paused;
      if (net >= 0) return Math.round(net);
    }
    // 3) Minuten-Felder (Alt + RPC duration_min)
    var min = num(raw.durationMin != null ? raw.durationMin : (raw.duration_min != null ? raw.duration_min : (raw.durationMinutes != null ? raw.durationMinutes : raw.duration)));
    if (min != null && min >= 0) return Math.round(min * 60);
    return null;
  }

  // Dauer-Plausibilität: ok | unknown | implausible. Negative gelten als unknown (verworfen).
  function durationPlausibility(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return { state: 'unknown', seconds: null };
    if (seconds > MAX_PLAUSIBLE_SECONDS) return { state: 'implausible', seconds: Math.round(seconds) };
    return { state: 'ok', seconds: Math.round(seconds) };
  }

  // Anzeige: <60 min → „43 min", ab 60 min → „1 h 41 min". Unbekannt → „Dauer nicht erfasst".
  // Unplausibel → markierter Wert (Aufrufer kann „prüfen" anhängen).
  function fmtDurationSeconds(seconds, opts) {
    opts = opts || {};
    var p = durationPlausibility(seconds);
    if (p.state === 'unknown') return opts.unknownLabel || 'Dauer nicht erfasst';
    var total = p.seconds;
    var h = Math.floor(total / 3600), m = Math.round((total % 3600) / 60);
    if (m === 60) { m = 0; h += 1; }
    var str = h > 0 ? (h + ' h ' + m + ' min') : (m + ' min');
    if (p.state === 'implausible' && opts.markImplausible !== false) str += ' (prüfen)';
    return str;
  }

  // Kanonische Workout-Session-Normalisierung (defensiv, idempotent, NICHT mutierend).
  // Liefert ein stabiles Objekt; unbekannte Dauer bleibt null (nicht 0).
  function normalizeWorkoutSession(raw) {
    raw = raw || {};
    var seconds = durationSecondsOf(raw);
    var plaus = durationPlausibility(seconds);
    return {
      id: raw.id || null,
      clientSessionId: raw.clientSessionId || raw.client_session_id || null,
      sport: raw.sport || null,
      sportKey: raw.sportKey || raw.sport_key || null,
      status: raw.status || null,
      localDate: raw.localDate || raw.local_date || null,
      startedAt: iso(raw.startedAt || raw.started_at),
      endedAt: iso(raw.endedAt || raw.ended_at || raw.finishedAt || raw.finished_at),
      durationSeconds: plaus.state === 'unknown' ? null : plaus.seconds,
      durationState: plaus.state,
      sessionRpe: num(raw.sessionRpe != null ? raw.sessionRpe : raw.session_rpe)
    };
  }

  // Zusammenfassung aus Übungs-/Satzbaum (für activity.summary). Zählt nur echte Arbeitssätze.
  // exercises: [{ sets:[{set_type,weight,reps,completed}] }] (DB-Form) — tolerant.
  function summarizeWorkout(exercises) {
    exercises = Array.isArray(exercises) ? exercises : [];
    var exerciseCount = 0, workingSetCount = 0, totalVolumeKg = 0, rirSum = 0, rirN = 0;
    exercises.forEach(function (ex) {
      var sets = (ex && Array.isArray(ex.sets)) ? ex.sets : [];
      var hasReal = false;
      sets.forEach(function (st) {
        var type = (st && (st.set_type || st.setType)) || 'working';
        var done = st && (st.completed === true || st.completed == null); // null = nicht explizit offen
        if (type !== 'working' || !done) return;
        hasReal = true; workingSetCount += 1;
        var w = num(st.weight), r = num(st.reps);
        if (w != null && r != null) totalVolumeKg += w * r;
        var rir = num(st.rir != null ? st.rir : st.rir);
        if (rir != null) { rirSum += rir; rirN += 1; }
      });
      if (hasReal) exerciseCount += 1;
    });
    var out = { exerciseCount: exerciseCount, workingSetCount: workingSetCount };
    if (totalVolumeKg > 0) out.totalVolumeKg = Math.round(totalVolumeKg);
    if (rirN > 0) out.avgRir = Math.round((rirSum / rirN) * 10) / 10;
    return out;
  }

  /* ============================================================
     Batch 3b.1b · ZENTRALE kanonische Summary-Normalisierung (pure, idempotent,
     NICHT mutierend). EINE Quelle für beide Server-Pfade (normalizeActivityRecord
     hier + activityConfig.normalizeServerActivity, das hierher delegiert), damit
     Store-Merge, Serverliste, Anzeige und Engine-Gruppierung dieselben
     kanonischen Felder erhalten. Garmin liefert snake_case; wir mappen auf
     camelCase, ohne Meter ohne Sportkontext still zu Kilometern umzudeuten. ---- */
  var _METER_BASED_SPORTS = { swimming: true, rowing: true };   // Distanz kanonisch in METERN
  function _round(x, p) { var f = Math.pow(10, p || 0); return Math.round(x * f) / f; }
  function _canonSport(sportId) {
    if (root.ORVIA && root.ORVIA.trainingDomain && typeof root.ORVIA.trainingDomain.normSport === 'function') {
      try { var c = root.ORVIA.trainingDomain.normSport(sportId); if (c) return c; } catch (e) {}
    }
    var s = String(sportId == null ? '' : sportId).trim().toLowerCase();
    if (s === 'run' || s === 'laufen') return 'running';
    if (s === 'bike' || s === 'rad' || s === 'radfahren') return 'cycling';
    if (s === 'swim' || s === 'schwimmen') return 'swimming';
    return s;
  }
  // 'meter' (distanceM) | 'km' (distanceKm) | 'unknown' (kein Unit-Umschlag ohne Kontext)
  function _sportDistanceKind(sportId) {
    var sp = _canonSport(sportId);
    if (!sp) return 'unknown';
    if (_METER_BASED_SPORTS[sp]) return 'meter';
    return 'km';
  }
  /* STRIKTE Zahl (Batch 3b.1c): number nur endlich; String nur, wenn der GESAMTE
     getrimmte String eine endliche Zahl ist (kein parseFloat('100abc')→100). */
  function _strictNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string') { var t = v.trim(); if (t === '') return null; var n = Number(t); return isFinite(n) ? n : null; }
    return null;
  }
  // Physisch mögliche, nicht-negative Größe (Distanz/HF/Kalorien/Höhengewinn/Geschwindigkeit).
  function _nonNegNum(v) { var n = _strictNum(v); return (n != null && n >= 0) ? n : null; }
  // Gültiger camelCase-Wert gewinnt vor snake_case; ungültige/negative Werte ⇒ null (nicht clampen, nicht erfinden).
  function _preferNonNeg(camelV, snakeV) { var c = _nonNegNum(camelV); if (c != null) return c; return _nonNegNum(snakeV); }

  function normalizeActivitySummary(summary, sportId) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) summary = {};
    var out = {};
    // 1) unbekannte Felder NICHT verlieren — alles durchkopieren (Eingabe unberührt).
    Object.keys(summary).forEach(function (k) { out[k] = summary[k]; });
    // 2) snake_case-Rohschlüssel entfernen; kanonische camelCase-Felder setzen.
    ['distance_m', 'distance_km', 'avg_hr', 'max_hr', 'elevation_gain_m', 'elevation_m', 'calories_kcal', 'avg_speed_mps'].forEach(function (k) { delete out[k]; });

    var kind = _sportDistanceKind(sportId);
    // Ungültige/negative Distanzen werden ENTFERNT (nicht kanonisiert/angezeigt), nicht geclampt.
    var distM = _preferNonNeg(summary.distanceM, summary.distance_m);
    var distKm = _preferNonNeg(summary.distanceKm, summary.distance_km);
    if (kind === 'meter') {
      var m = (distM != null) ? distM : (distKm != null ? distKm * 1000 : null);
      if (m != null) out.distanceM = _round(m, 1); else delete out.distanceM;
      delete out.distanceKm;                                   // meterbasierte Sportart trägt keine km
    } else if (kind === 'km') {
      var km = (distKm != null) ? distKm : (distM != null ? distM / 1000 : null);
      if (km != null) out.distanceKm = _round(km, 3); else delete out.distanceKm;
      delete out.distanceM;                                    // km-Sportart trägt kein distanceM (kein /100-m-Schwimm-Pace-Fehlgriff)
    } else {
      // Unbekannter Sportkontext: keine Meter⇄km-Umdeutung; nur Umbenennung snake→camel.
      if (distM != null) out.distanceM = distM; else delete out.distanceM;
      if (distKm != null) out.distanceKm = distKm; else delete out.distanceKm;
    }

    var avgHr = _preferNonNeg(summary.avgHr, summary.avg_hr); if (avgHr != null) out.avgHr = Math.round(avgHr); else delete out.avgHr;
    var maxHr = _preferNonNeg(summary.maxHr, summary.max_hr); if (maxHr != null) out.maxHr = Math.round(maxHr); else delete out.maxHr;
    var elev = (_nonNegNum(summary.elevationM) != null) ? _nonNegNum(summary.elevationM) : _preferNonNeg(summary.elevation_gain_m, summary.elevation_m);
    if (elev != null) out.elevationM = Math.round(elev); else delete out.elevationM;   // Höhengewinn nie negativ
    var cal = _preferNonNeg(summary.caloriesKcal, summary.calories_kcal); if (cal != null) out.caloriesKcal = Math.round(cal); else delete out.caloriesKcal;
    var spd = _preferNonNeg(summary.avgSpeedMps, summary.avg_speed_mps);
    if (spd != null) { out.avgSpeedMps = spd; if (_nonNegNum(summary.avgSpeedKmh) == null) out.avgSpeedKmh = _round(spd * 3.6, 2); else out.avgSpeedKmh = _nonNegNum(summary.avgSpeedKmh); }
    else { delete out.avgSpeedMps; if (_nonNegNum(summary.avgSpeedKmh) != null) out.avgSpeedKmh = _nonNegNum(summary.avgSpeedKmh); else delete out.avgSpeedKmh; }
    if (typeof summary.name === 'string' && summary.name !== '') out.name = summary.name; else delete out.name;
    return out;
  }

  // Reine Pace-Helfer (testbar, DOM-frei). Rückgabe: Sekunden pro Einheit oder null.
  function runPacePerKm(durationSeconds, distanceKm) { var s = _strictNum(durationSeconds), km = _strictNum(distanceKm); if (s == null || km == null || km <= 0 || s <= 0) return null; return s / km; }
  function swimPacePer100m(durationSeconds, distanceM) { var s = _strictNum(durationSeconds), m = _strictNum(distanceM); if (s == null || m == null || m <= 0 || s <= 0) return null; return s / (m / 100); }
  function fmtPaceSeconds(secPerUnit) { if (secPerUnit == null || !isFinite(secPerUnit) || secPerUnit <= 0) return null; var mm = Math.floor(secPerUnit / 60), ss = Math.round(secPerUnit % 60); if (ss === 60) { ss = 0; mm += 1; } return mm + ':' + String(ss).padStart(2, '0'); }
  // Sekunden pro km aus gültiger Geschwindigkeit (Fallback). mps > kmh.
  function _paceSecPerKmFromSpeed(summary) {
    var mps = _nonNegNum(summary.avgSpeedMps); if (mps != null && mps > 0) return 1000 / mps;
    var kmh = _nonNegNum(summary.avgSpeedKmh); if (kmh != null && kmh > 0) return 3600 / kmh;
    return null;
  }
  function _paceSecPer100mFromSpeed(summary) { var perKm = _paceSecPerKmFromSpeed(summary); return perKm != null ? perKm / 10 : null; }

  /* Sport-bewusste Distanz-/Pace-Anzeige aus KANONISCHEN Feldern. Lauf ⇒ Pace/km,
     Schwimmen ⇒ Pace/100 m; ein Lauf mit distanceM wird NIE als /100-m-Pace gezeigt.
     Pace primär aus Dauer/Distanz; fehlt diese Kombination, aber gültige
     Geschwindigkeit liegt vor ⇒ Pace aus Geschwindigkeit ableiten. Nie negativ. */
  function activityDistancePace(sportId, summary, durationSeconds) {
    summary = (summary && typeof summary === 'object' && !Array.isArray(summary)) ? summary : {};
    var kind = _sportDistanceKind(sportId);
    var km = _nonNegNum(summary.distanceKm), m = _nonNegNum(summary.distanceM);
    var out = { distanceLabel: null, paceLabel: null, paceUnit: null };
    if (kind === 'meter' && m != null && m > 0) {
      out.distanceLabel = m + ' m';
      var p = swimPacePer100m(durationSeconds, m); if (p == null) p = _paceSecPer100mFromSpeed(summary);
      if (p != null) { var f = fmtPaceSeconds(p); if (f != null) { out.paceLabel = f + '/100 m'; out.paceUnit = '/100 m'; } }
    } else if (km != null && km > 0) {
      out.distanceLabel = km + ' km';
      var p2 = runPacePerKm(durationSeconds, km); if (p2 == null) p2 = _paceSecPerKmFromSpeed(summary);
      if (p2 != null) { var f2 = fmtPaceSeconds(p2); if (f2 != null) { out.paceLabel = f2 + '/km'; out.paceUnit = '/km'; } }
    } else if (m != null && m > 0 && kind === 'km') {
      var km2 = _round(m / 1000, 3);
      out.distanceLabel = km2 + ' km';
      var p3 = runPacePerKm(durationSeconds, km2); if (p3 == null) p3 = _paceSecPerKmFromSpeed(summary);
      if (p3 != null) { var f3 = fmtPaceSeconds(p3); if (f3 != null) { out.paceLabel = f3 + '/km'; out.paceUnit = '/km'; } }
    } else {
      // keine gültige Distanz: Pace ggf. nur aus Geschwindigkeit (sport-bewusst), keine Distanzzeile.
      if (kind === 'meter') { var ps = _paceSecPer100mFromSpeed(summary); if (ps != null) { var fs = fmtPaceSeconds(ps); if (fs != null) { out.paceLabel = fs + '/100 m'; out.paceUnit = '/100 m'; } } }
      else { var pk = _paceSecPerKmFromSpeed(summary); if (pk != null) { var fk = fmtPaceSeconds(pk); if (fk != null) { out.paceLabel = fk + '/km'; out.paceUnit = '/km'; } } }
    }
    return out;
  }

  /* PURE Detail-Datenaufbereitung, die der Renderer TATSÄCHLICH konsumiert
     (DOM-frei, testbar). Name aus summary.name, Fallback metrics.name; alle
     numerischen Felder sanitisiert (nie negativ/ungültig). */
  function activityDetailModel(sportId, summary, durationSeconds, metrics) {
    summary = (summary && typeof summary === 'object' && !Array.isArray(summary)) ? summary : {};
    metrics = (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) ? metrics : {};
    var dp = activityDistancePace(sportId, summary, durationSeconds);
    var name = (typeof summary.name === 'string' && summary.name !== '') ? summary.name
      : ((typeof metrics.name === 'string' && metrics.name !== '') ? metrics.name : null);
    return {
      name: name,
      distanceLabel: dp.distanceLabel,
      paceLabel: dp.paceLabel,
      paceUnit: dp.paceUnit,
      avgHr: _nonNegNum(summary.avgHr),
      maxHr: _nonNegNum(summary.maxHr),
      caloriesKcal: _nonNegNum(summary.caloriesKcal),
      elevationM: _nonNegNum(summary.elevationM),
      avgSpeedKmh: _nonNegNum(summary.avgSpeedKmh)
    };
  }

  // Kanonische Aktivität (defensiv). source/sourceRecordId tragen die Idempotenz
  // (Upsert-Schlüssel: user_id, source, source_record_id) — keine Doppel-Activities.
  function normalizeActivityRecord(raw) {
    raw = raw || {};
    var seconds = durationSecondsOf(raw);
    var plaus = durationPlausibility(seconds);
    var sportId = raw.sportId || raw.sport_id || null;
    var rawSummary = (raw.summary && typeof raw.summary === 'object' && !Array.isArray(raw.summary)) ? raw.summary : {};
    return {
      id: raw.id || null,
      userId: raw.userId || raw.user_id || null,
      sportId: sportId,
      source: raw.source || null,
      sourceRecordId: raw.sourceRecordId || raw.source_record_id || null,
      workoutSessionId: raw.workoutSessionId || raw.workout_session_id || null,
      startedAt: iso(raw.startedAt || raw.started_at),
      endedAt: iso(raw.endedAt || raw.ended_at),
      durationSeconds: plaus.state === 'unknown' ? null : plaus.seconds,
      durationState: plaus.state,
      status: raw.status || 'completed',
      /* Batch 3b.1b: Summary zentral kanonisieren (Garmin snake_case → camelCase). */
      summary: normalizeActivitySummary(rawSummary, sportId),
      /* Batch 2b (2026-07-18): metrics wurde bisher NICHT gemappt — Server-
         metrics (z. B. Garmin source_sport_raw, avgSpeedKmh, Rohdetails)
         gingen clientseitig verloren (Batch-2-Scout-Befund). Durchreichen,
         nichts erfinden: fehlend ⇒ {}. */
      metrics: (raw.metrics && typeof raw.metrics === 'object') ? raw.metrics : {}
    };
  }

  // Activity-Row aus einer normalisierten Session bauen (für RPC/Upsert). Reine Abbildung.
  function activityRowFromSession(session, summary) {
    var s = normalizeWorkoutSession(session);
    return {
      sport_id: s.sportKey || s.sport || null,
      source: 'orvia_workout',
      source_record_id: s.id || s.clientSessionId || null,
      workout_session_id: s.id || null,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      duration_seconds: s.durationSeconds,
      status: s.status === 'completed' ? 'completed' : (s.status || 'completed'),
      summary: summary || {}
    };
  }

  var api = {
    MAX_PLAUSIBLE_SECONDS: MAX_PLAUSIBLE_SECONDS,
    durationSecondsOf: durationSecondsOf,
    durationPlausibility: durationPlausibility,
    fmtDurationSeconds: fmtDurationSeconds,
    normalizeWorkoutSession: normalizeWorkoutSession,
    normalizeActivityRecord: normalizeActivityRecord,
    normalizeActivitySummary: normalizeActivitySummary,
    runPacePerKm: runPacePerKm,
    swimPacePer100m: swimPacePer100m,
    fmtPaceSeconds: fmtPaceSeconds,
    activityDistancePace: activityDistancePace,
    activityDetailModel: activityDetailModel,
    summarizeWorkout: summarizeWorkout,
    activityRowFromSession: activityRowFromSession
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA = root.ORVIA || {}; root.ORVIA.activityNormalize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
