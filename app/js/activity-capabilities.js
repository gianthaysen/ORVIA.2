/* ============================================================
   ORVIA · activity-capabilities (v8-447) — welche Daten EINE Aktivitaet wirklich traegt.

   Eine Stelle, an der Oberflaeche, Highlights und (ab v8-448) das Leistungsregister fragen:
   „Hat diese Einheit X?" — statt selbst in metrics zu greifen. Dieses Modul
     - liest nur, was gespeichert ist (metrics.streams, stream_meta, garmin, ext, splits);
     - rechnet nichts um und erfindet nichts: fehlt ein Feld, ist die Gruppe nicht verfuegbar;
     - nennt zu jedem Wert, WOHER er stammt (Quelle im Datensatz).

   Datenlage je Geraet:
     metrics.garmin   klein, auf jedem Geraet (Garmin-Typ, Ortszeit, Bewegungszeit, Abtastung)
     metrics.ext      Rohwerte unter Garmin-Namen — NUR in der Serverliste, nie im lokalen
                      Speicher (activity-store SERVER_ONLY_METRIC_KEYS). Ohne Netz fehlen
                      die Gruppen, die aus ext kommen; `extLoaded` sagt, ob der Block da ist.

   Feldnamen aus ext sind GARMIN-Namen. Welche davon belegt und welche nur angenommen sind,
   steht im Worker (garmin-worker/orvia_worker/garmin_fields.py, Belegstufe) und in
   docs/GARMIN-CAPABILITY-MATRIX.md. Ein Test haelt die hier benutzten Namen mit der
   Erlaubnisliste des Workers gleich.

   Rein: kein DOM, kein Speicher, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var DETAILS_VERSION_CURRENT = 3;      // Worker: detail_sync.DETAILS_CONTRACT_VERSION

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function hasNums(a) { if (!Array.isArray(a)) return false; for (var i = 0; i < a.length; i++) if (typeof a[i] === 'number' && isFinite(a[i])) return true; return false; }
  function AS() { return O.activityStreams || (typeof require === 'function' ? (function () { try { return require('./activity-streams.js'); } catch (e) { return null; } })() : null); }

  /* Garmin-Feldnamen je Gruppe (Rohblock ext.fields). Reihenfolge = Anzeige-Reihenfolge. */
  var FIELDS = {
    training_effect: ['aerobicTrainingEffect', 'anaerobicTrainingEffect', 'trainingEffectLabel', 'activityTrainingLoad'],
    hr_zones: ['hrTimeInZone_1', 'hrTimeInZone_2', 'hrTimeInZone_3', 'hrTimeInZone_4', 'hrTimeInZone_5'],
    power_zones: ['powerTimeInZone_1', 'powerTimeInZone_2', 'powerTimeInZone_3', 'powerTimeInZone_4', 'powerTimeInZone_5', 'powerTimeInZone_6', 'powerTimeInZone_7'],
    power_summary: ['avgPower', 'maxPower', 'normPower', 'max20MinPower', 'intensityFactor', 'trainingStressScore'],
    running_dynamics: ['averageRunningCadenceInStepsPerMinute', 'maxRunningCadenceInStepsPerMinute', 'avgStrideLength', 'avgGroundContactTime', 'avgVerticalOscillation', 'avgVerticalRatio', 'avgGroundContactBalance'],
    cycling_cadence: ['averageBikingCadenceInRevPerMinute', 'maxBikingCadenceInRevPerMinute'],
    swim: ['poolLength', 'unitOfPoolLength', 'activeLengths', 'strokes', 'avgStrokes', 'averageSwolf', 'averageSwimCadenceInStrokesPerMinute', 'maxSwimCadenceInStrokesPerMinute', 'avgStrokeDistance'],
    strength: ['totalSets', 'activeSets', 'totalReps', 'totalVolume'],
    environment: ['minTemperature', 'maxTemperature']
  };
  /* Zusatzreihen je Gruppe (ext.series, Garmin-Namen). */
  var SERIES = {
    running_dynamics: ['directGroundContactTime', 'directVerticalOscillation', 'directStrideLength', 'directVerticalRatio', 'directGroundContactBalanceLeft'],
    cycling_pedal: ['directLeftBalance', 'directLeftTorqueEffectiveness', 'directRightTorqueEffectiveness', 'directLeftPedalSmoothness', 'directRightPedalSmoothness'],
    swim: ['directSwimCadence', 'directStrokeCadence', 'directSwolf', 'directStrokes']
  };

  /* Was fuer eine Sportart sinnvoll ERWARTET werden kann — nur fuer die Luecken-Liste
     (`missing`). Kein Versprechen: ob Garmin es liefert, haengt von Uhr und Sensoren ab. */
  var BASE = ['heart_rate', 'time_axis', 'moving_time', 'training_effect', 'hr_zones'];
  var EXPECT = {
    running:   BASE.concat(['route', 'distance_series', 'speed', 'elevation', 'cadence', 'laps', 'running_dynamics']),
    hiking:    BASE.concat(['route', 'distance_series', 'speed', 'elevation']),
    walking:   BASE.concat(['route', 'distance_series', 'speed', 'elevation']),
    athletics: BASE.concat(['distance_series', 'speed', 'cadence', 'laps']),
    cycling:   BASE.concat(['route', 'distance_series', 'speed', 'elevation', 'cadence', 'power', 'power_summary', 'power_zones', 'laps']),
    swimming:  BASE.concat(['swim', 'laps']),
    rowing:    BASE.concat(['distance_series', 'speed', 'power', 'laps']),
    triathlon: BASE.concat(['route', 'distance_series', 'speed', 'laps']),
    gym:       BASE.concat(['strength']),
    hyrox:     BASE.concat(['laps'])
  };

  function group(available, source, extra) {
    var g = { available: !!available, source: available ? (source || null) : null };
    if (extra) Object.keys(extra).forEach(function (k) { g[k] = extra[k]; });
    return g;
  }
  function pick(fields, names) {
    var out = {}, n = 0;
    if (fields) names.forEach(function (k) { var v = fields[k]; if (v !== undefined && v !== null && v !== '') { out[k] = v; n++; } });
    return n ? out : null;
  }
  function pickSeries(series, names) {
    var out = [];
    if (series) names.forEach(function (k) { var s = obj(series[k]); if (s && hasNums(s.values)) out.push(k); });
    return out;
  }

  /* owner = der Datensatz, der die Messreihen TRAEGT (bei einem Workout mit gekoppelter
     Uhr-Aufzeichnung die Aufzeichnung). */
  function of(owner) {
    var a = obj(owner) || {};
    var m = obj(a.metrics) || {}, st = obj(m.streams) || {}, g = obj(m.garmin) || {}, ext = obj(m.ext);
    var fields = ext ? obj(ext.fields) : null, series = ext ? obj(ext.series) : null;
    var S = AS();
    var groups = {};

    var t = S ? S.timeAxis(a) : (Array.isArray(st.time) && st.time.length > 1 ? st.time : null);
    groups.time_axis = group(!!t, 'streams.time', t ? { points: t.length, lastSecond: num(t[t.length - 1]) } : null);
    groups.route = group(Array.isArray(m.route) && m.route.length > 1, 'route', (Array.isArray(m.route) && m.route.length > 1) ? { points: m.route.length } : null);
    groups.heart_rate = group(hasNums(st.heart_rate), 'streams.heart_rate');
    groups.speed = group(hasNums(st.speed), 'streams.speed');
    groups.distance_series = group(hasNums(st.distance), 'streams.distance');
    groups.elevation = group(hasNums(st.elevation), 'streams.elevation');
    groups.power = group(hasNums(st.power), 'streams.power');

    var cad = S ? S.cadence(a) : { status: 'none' };
    groups.cadence = group(cad.status === 'ok', 'streams.cadence', { status: cad.status, kind: cad.kind || null, unit: cad.unit || null, reason: cad.reason || null });

    /* Bewegungszeit: aus der Aufzeichnung (Details) — sonst aus dem Listeneintrag. */
    var mv = num(g.moving_duration_s), mvSrc = 'garmin.moving_duration_s';
    if (mv === null && fields && num(fields.movingDuration) !== null) { mv = num(fields.movingDuration); mvSrc = 'ext.fields.movingDuration'; }
    var el = num(g.elapsed_duration_s), elSrc = 'garmin.elapsed_duration_s';
    if (el === null && fields && num(fields.elapsedDuration) !== null) { el = num(fields.elapsedDuration); elSrc = 'ext.fields.elapsedDuration'; }
    groups.moving_time = group(mv !== null, mvSrc, mv !== null ? { seconds: mv } : null);
    groups.elapsed_time = group(el !== null, elSrc, el !== null ? { seconds: el } : null);

    /* Runden: die schlanke Form in metrics.splits (liest die App schon) oder der Rohblock. */
    var laps = Array.isArray(m.splits) ? m.splits : null;
    var extLaps = ext && obj(ext.splits) && Array.isArray(ext.splits.lapDTOs) ? ext.splits.lapDTOs : null;
    groups.laps = group(!!(laps && laps.length) || !!(extLaps && extLaps.length), (laps && laps.length) ? 'splits' : 'ext.splits',
      { count: (laps && laps.length) || (extLaps && extLaps.length) || 0, typed: !!(ext && ext.typed_splits) });

    var te = pick(fields, FIELDS.training_effect);
    groups.training_effect = group(!!te, 'ext.fields', te ? { values: te } : null);
    groups.training_load = group(num(m.training_load) !== null, 'training_load', num(m.training_load) !== null ? { value: m.training_load } : null);

    var hz = pick(fields, FIELDS.hr_zones), hzx = ext && ext.hr_zones;
    groups.hr_zones = group(!!hz || !!hzx, hzx ? 'ext.hr_zones' : 'ext.fields', hz ? { values: hz } : null);
    var pz = pick(fields, FIELDS.power_zones), pzx = ext && ext.power_zones;
    groups.power_zones = group(!!pz || !!pzx, pzx ? 'ext.power_zones' : 'ext.fields', pz ? { values: pz } : null);

    var ps = pick(fields, FIELDS.power_summary);
    groups.power_summary = group(!!ps, 'ext.fields', ps ? { values: ps } : null);

    var rd = pick(fields, FIELDS.running_dynamics), rds = pickSeries(series, SERIES.running_dynamics);
    groups.running_dynamics = group(!!rd || rds.length > 0, rd ? 'ext.fields' : 'ext.series', { values: rd, series: rds });

    var cc = pick(fields, FIELDS.cycling_cadence), cps = pickSeries(series, SERIES.cycling_pedal);
    groups.cycling_summary = group(!!cc || cps.length > 0, cc ? 'ext.fields' : 'ext.series', { values: cc, series: cps });

    var sw = pick(fields, FIELDS.swim), sws = pickSeries(series, SERIES.swim);
    groups.swim = group(!!sw || sws.length > 0, sw ? 'ext.fields' : 'ext.series', { values: sw, series: sws });

    var sg = pick(fields, FIELDS.strength), sets = ext && ext.exercise_sets, sumSets = ext && obj(ext.list) && ext.list.summarizedExerciseSets;
    groups.strength = group(!!sg || !!sets || !!sumSets, sets ? 'ext.exercise_sets' : (sg ? 'ext.fields' : 'ext.list.summarizedExerciseSets'),
      { values: sg, sets: !!sets, summarized: Array.isArray(sumSets) ? sumSets.length : 0 });

    var env = pick(fields, FIELDS.environment);
    groups.environment = group(!!env, 'ext.fields', env ? { values: env } : null);

    var expected = EXPECT[a.sportId] || BASE;
    var missing = expected.filter(function (k) { return !(groups[k] && groups[k].available); });

    return {
      sportId: a.sportId || null,
      source: a.source || null,
      garminType: (typeof g.type_key === 'string' && g.type_key) ? g.type_key : null,
      detailsVersion: num(m.detailsVersion),
      extLoaded: !!ext,
      /* aufgezeichnet (total) → von Garmin geliefert (rows) → gespeichert (kept) */
      sampling: (num(g.stream_rows) !== null) ? { rows: g.stream_rows, kept: num(g.stream_kept), total: num(g.stream_total) } : null,
      groups: groups,
      expected: expected.slice(),
      missing: missing,
      raw: ext ? {
        fields: fields ? Object.keys(fields).length : 0,
        series: series ? Object.keys(series).length : 0,
        unrecognized: Array.isArray(ext.unrecognized) ? ext.unrecognized.slice() : [],
        seriesUnparsed: Array.isArray(ext.series_unparsed) ? ext.series_unparsed.slice() : [],
        extras: obj(ext.extras) ? Object.assign({}, ext.extras) : null
      } : null
    };
  }

  function has(owner, groupId) { var c = of(owner); return !!(c.groups[groupId] && c.groups[groupId].available); }

  /* Darf eine Auswertung, die HISTORISCH festgeschrieben wird (Bestwerte, Rekorde, das
     Leistungsregister ab v8-448), auf diese Einheit zugreifen?
     Grundregel v8-447: nichts festschreiben, solange die Grundlage fehlerhaft oder
     unvollstaendig normalisiert sein kann. `need` = Gruppen, die die Auswertung braucht.
     { eligible, reasons: [code …] } — nie eine Ausnahme, nie eine Reparatur. */
  function ledgerEligible(owner, need) {
    var a = obj(owner) || {}, c = of(a), reasons = [];
    var req = Array.isArray(need) ? need : [];
    if (a.status && a.status !== 'completed') reasons.push('not_completed');
    if (a.source === 'garmin') {
      if (c.detailsVersion === null) reasons.push('details_not_loaded');
      else if (c.detailsVersion < DETAILS_VERSION_CURRENT) reasons.push('details_outdated');
    }
    if (req.indexOf('cadence') >= 0 && c.groups.cadence.status === 'unverified') reasons.push('cadence_unverified');
    req.forEach(function (k) { if (!(c.groups[k] && c.groups[k].available)) reasons.push('missing:' + k); });
    var S = AS();
    if (S && S.qualityWarnings) S.qualityWarnings(a).forEach(function (w) { if (w.code === 'time_axis_not_monotonic') reasons.push(w.code); });
    return { eligible: reasons.length === 0, reasons: reasons };
  }

  var api = {
    of: of, has: has, ledgerEligible: ledgerEligible,
    FIELDS: FIELDS, SERIES: SERIES, EXPECT: EXPECT, BASE: BASE.slice(),
    DETAILS_VERSION_CURRENT: DETAILS_VERSION_CURRENT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityCapabilities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
