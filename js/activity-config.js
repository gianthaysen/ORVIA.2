/* ============================================================
   ORVIA · activity-config — ZENTRALE reine UI-Konfiguration für Aktivitäten (Inkrement 2A-UI).
   Eine Quelle für: Form-Schemas, Legacy-Adapter, Activity-Merge/Dedup, dynamische
   Sport-Kacheln (aus Nutzerauswahl), sportartspezifische Zusammenfassungszeilen, Feld-Strip
   beim Sportwechsel. Kein DOM/Store/Supabase. Labels/Plannbarkeit aus onboardingSportsLogic.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  function SL() { return O.onboardingSportsLogic; }
  function AN() { return O.activityNormalize; }
  function normSport(v) { return (O.trainingDomain && O.trainingDomain.normSport) ? O.trainingDomain.normSport(v) : String(v || '').toLowerCase(); }

  // Gemeinsame Felder ALLER Sportarten.
  var COMMON = [{ key: 'date', label: 'Datum', type: 'date', required: true }, { key: 'time', label: 'Uhrzeit', type: 'time' },
    { key: 'durationMin', label: 'Dauer (min)', type: 'number', unit: 'min' }];
  var RPE = { key: 'rpe', label: 'RPE (1–10)', type: 'number' };
  var NOTE = { key: 'note', label: 'Notiz', type: 'text' };
  function f(key, label, type, extra) { return Object.assign({ key: key, label: label, type: type || 'number' }, extra || {}); }

  // Zentrale Form-Registry. detailProfile steuert die Zusammenfassungszeile.
  var ACTIVITY_FORM_SCHEMAS = {
    running: { sportId: 'running', detailProfile: 'distance_pace', fields: COMMON.concat([f('runType', 'Art', 'enum', { options: ['easy', 'long', 'tempo', 'intervals', 'recovery', 'race', 'trail', 'treadmill'] }), f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('avgHr', 'HF Ø', 'number', { optional: true }), f('elevationM', 'Höhenmeter', 'number', { optional: true }), RPE, NOTE]) },
    cycling: { sportId: 'cycling', detailProfile: 'distance_speed', fields: COMMON.concat([f('rideType', 'Art', 'enum', { options: ['easy', 'long', 'intervals', 'indoor', 'climbing', 'gravel', 'mtb', 'tt', 'race'] }), f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('environment', 'Indoor/Outdoor', 'enum', { options: ['outdoor', 'indoor'] }), f('avgHr', 'HF Ø', 'number', { optional: true }), f('elevationM', 'Höhenmeter (nur Outdoor)', 'number', { optional: true, onlyWhen: { environment: 'outdoor' } }), f('avgSpeedKmh', 'Ø Geschwindigkeit (km/h)', 'number', { optional: true }), f('avgPowerW', 'Ø Leistung (W)', 'number', { optional: true }), RPE, NOTE]) },
    swimming: { sportId: 'swimming', detailProfile: 'distance_pace_swim', fields: COMMON.concat([f('swimType', 'Art', 'enum', { options: ['technique', 'easy', 'endurance', 'intervals', 'sprint', 'open_water', 'race'] }), f('distanceM', 'Distanz (m)', 'number', { unit: 'm' }), f('environment', 'Pool/Freiwasser', 'enum', { options: ['pool', 'open_water'] }), f('poolLengthM', 'Beckenlänge (m, nur Pool)', 'number', { optional: true, onlyWhen: { environment: 'pool' } }), f('stroke', 'Schwimmstil', 'text', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    gym: { sportId: 'gym', detailProfile: 'gym', fields: COMMON.concat([f('gymType', 'Art', 'enum', { optional: true, options: ['fullbody', 'upper', 'lower', 'push', 'pull', 'legs', 'sport_specific', 'free'] }), RPE, NOTE]) },
    tennis: { sportId: 'tennis', detailProfile: 'session_kind', fields: COMMON.concat([f('tennisType', 'Art', 'enum', { options: ['training', 'single', 'double', 'serve', 'ballmachine', 'technique', 'tournament'] }), f('format', 'Spielart', 'enum', { optional: true, options: ['single', 'double'] }), f('sets', 'Sätze', 'text', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), f('surface', 'Belag', 'enum', { optional: true, options: ['Sand', 'Hartplatz', 'Rasen', 'Teppich', 'Indoor'] }), RPE, NOTE]) },
    padel: { sportId: 'padel', detailProfile: 'session_kind', fields: COMMON.concat([f('padelType', 'Art', 'enum', { options: ['training', 'match', 'technique', 'serve', 'tournament'] }), f('side', 'Gespielte Seite', 'enum', { optional: true, options: ['Links', 'Rechts'] }), f('sets', 'Sätze', 'text', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), RPE, NOTE]) },
    football: { sportId: 'football', detailProfile: 'session_kind', fields: COMMON.concat([
      f('footballType', 'Art', 'enum', { options: ['team_training', 'match', 'individual', 'athletics'] }),
      f('position', 'Position', 'enum', { optional: true, options: ['goalkeeper', 'centre_back', 'full_back', 'wing_back', 'defensive_midfield', 'central_midfield', 'attacking_midfield', 'winger', 'striker'], onlyWhen: { footballType: 'match' } }),
      f('gameMinutes', 'Einsatzminuten', 'number', { optional: true, onlyWhen: { footballType: 'match' } }),
      RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), NOTE]) },
    basketball: teamAct('basketball', ['team_training', 'match', 'individual', 'athletics', 'shooting', 'tournament'], ['point_guard', 'shooting_guard', 'small_forward', 'power_forward', 'center']),
    handball: teamAct('handball', ['team_training', 'match', 'shooting', 'technique', 'athletics', 'tournament'], ['goalkeeper', 'left_wing', 'right_wing', 'left_back', 'centre_back_hb', 'right_back', 'pivot']),
    volleyball: teamAct('volleyball', ['team_training', 'match', 'beach', 'technique', 'jump', 'athletics', 'tournament'], ['setter', 'outside_hitter', 'opposite', 'middle_blocker', 'libero']),
    hockey: teamAct('hockey', ['team_training', 'match', 'technique', 'individual', 'athletics', 'tournament'], ['goalkeeper', 'defence', 'midfield', 'attack']),
    rugby: teamAct('rugby', ['team_training', 'match', 'contact', 'technique', 'athletics', 'tournament'], ['front_row', 'locks', 'back_row', 'half_backs', 'centres', 'back_three']),
    triathlon: { sportId: 'triathlon', detailProfile: 'duration', fields: COMMON.concat([f('triType', 'Art', 'enum', { options: ['brick', 'bike_run', 'swim_bike', 'transition', 'race', 'discipline'] }), RPE, NOTE]) },
    hiking: { sportId: 'hiking', detailProfile: 'distance', fields: COMMON.concat([f('hikingType', 'Art', 'enum', { optional: true, options: ['hike', 'mountain', 'trekking', 'multiday'] }), f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('elevationM', 'Höhenmeter', 'number', { optional: true }), f('packWeightKg', 'Rucksackgewicht (kg)', 'number', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    walking: { sportId: 'walking', detailProfile: 'distance', fields: COMMON.concat([f('walkingType', 'Art', 'enum', { optional: true, options: ['walk', 'brisk', 'recovery', 'walking_workout', 'treadmill'] }), f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('steps', 'Schritte', 'number', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    athletics: { sportId: 'athletics', detailProfile: 'duration', fields: COMMON.concat([f('athleticsType', 'Art', 'enum', { options: ['sprint', 'endurance_run', 'technique', 'jump', 'throw', 'strength', 'competition'] }), RPE, NOTE]) },
    badminton: { sportId: 'badminton', detailProfile: 'session_kind', fields: COMMON.concat([f('badmintonType', 'Art', 'enum', { options: ['training', 'single', 'double', 'mixed', 'technique', 'tournament'] }), f('sets', 'Sätze', 'text', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), RPE, NOTE]) },
    golf: { sportId: 'golf', detailProfile: 'duration', fields: COMMON.concat([f('golfType', 'Art', 'enum', { options: ['round9', 'round18', 'range', 'shortgame', 'putting', 'tournament'] }), f('strokes', 'Schläge', 'number', { optional: true }), f('stableford', 'Stableford-Punkte', 'number', { optional: true }), f('handicapRelevant', 'Handicaprelevante Runde', 'bool', { optional: true }), f('walkDistanceKm', 'Gehstrecke (km)', 'number', { optional: true }), RPE, NOTE]) },
    rowing: { sportId: 'rowing', detailProfile: 'distance', fields: COMMON.concat([f('rowingType', 'Art', 'enum', { optional: true, options: ['erg_easy', 'erg_intervals', 'water', 'technique', 'longdistance', 'race'] }), f('distanceM', 'Distanz (m)', 'number', { unit: 'm', optional: true }), f('strokeRate', 'Schlagfrequenz', 'number', { optional: true }), f('pace500', '500-m-Pace', 'text', { optional: true }), RPE, NOTE]) },
    climbing: { sportId: 'climbing', detailProfile: 'duration', fields: COMMON.concat([f('climbingType', 'Art', 'enum', { options: ['bouldering', 'sport', 'toprope', 'technique', 'fingerboard', 'strength', 'outdoor'] }), f('grade', 'Schwierigkeitsgrad', 'text', { optional: true }), f('routes', 'Routen/Boulder', 'number', { optional: true }), f('attempts', 'Versuche', 'number', { optional: true }), RPE, NOTE]) },
    yoga: { sportId: 'yoga', detailProfile: 'duration', fields: COMMON.concat([f('yogaType', 'Art', 'enum', { options: ['hatha', 'vinyasa', 'yin', 'power', 'restorative', 'guided', 'free'] }), RPE, NOTE]) },
    mobility: { sportId: 'mobility', detailProfile: 'duration', fields: COMMON.concat([f('mobilityType', 'Art', 'enum', { options: ['fullbody', 'lower', 'upper', 'shoulder', 'hip', 'ankle', 'recovery'] }), RPE, NOTE]) },
    hyrox: { sportId: 'hyrox', detailProfile: 'duration', fields: COMMON.concat([f('hyroxType', 'Art', 'enum', { options: ['simulation', 'intervals', 'run_station', 'station_technique', 'sled', 'erg', 'strength_endurance', 'race', 'recovery'] }), f('runKm', 'Gelaufene Kilometer', 'number', { optional: true }), f('stations', 'Absolvierte Stationen', 'number', { optional: true }), f('sledPushKg', 'Sled-Push-Gewicht (kg)', 'number', { optional: true }), f('sledPullKg', 'Sled-Pull-Gewicht (kg)', 'number', { optional: true }), f('wallBallKg', 'Wall-Ball-Gewicht (kg)', 'number', { optional: true }), f('wallBalls', 'Anzahl Wall Balls', 'number', { optional: true }), f('skiErgM', 'SkiErg-Meter', 'number', { optional: true }), f('rowM', 'Ruder-Meter', 'number', { optional: true }), f('farmersKg', 'Farmers-Carry-Gewicht (kg)', 'number', { optional: true }), f('sandbagKg', 'Sandbag-Gewicht (kg)', 'number', { optional: true }), f('raceTime', 'Wettkampfzeit', 'text', { optional: true }), RPE, NOTE]) },
    other: { sportId: 'other', detailProfile: 'duration', fields: COMMON.concat([f('name', 'Name', 'text', { required: true }), RPE, NOTE]) }
  };
  function racket(id) { return { sportId: id, detailProfile: 'session_kind', fields: COMMON.concat([f('sessionKind', 'Training/Match', 'enum', { options: ['training', 'match'] }), f('format', 'Einzel/Doppel', 'enum', { options: ['single', 'double'] }), RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), NOTE]) }; }
  function team(id) { return { sportId: id, detailProfile: 'session_kind', fields: COMMON.concat([f('sessionKind', 'Training/Spiel', 'enum', { options: ['training', 'match'] }), f('role', 'Position/Rolle', 'text', { optional: true }), RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('distanceKm', 'Distanz (km, falls vorhanden)', 'number', { optional: true }), NOTE]) }; }
  // Mannschaftssport-Aktivität: <id>Type-Enum + Position/Einsatzminuten/Ergebnis nur bei „Spiel".
  function teamAct(id, typeOptions, positionCodes) {
    var typeKey = id + 'Type';
    return { sportId: id, detailProfile: 'session_kind', fields: COMMON.concat([
      f(typeKey, 'Art', 'enum', { options: typeOptions }),
      f('position', 'Position', 'enum', { optional: true, options: positionCodes, onlyWhen: (function () { var o = {}; o[typeKey] = 'match'; return o; })() }),
      f('gameMinutes', 'Einsatzminuten', 'number', { optional: true, onlyWhen: (function () { var o = {}; o[typeKey] = 'match'; return o; })() }),
      RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true, onlyWhen: (function () { var o = {}; o[typeKey] = 'match'; return o; })() }), NOTE]) };
  }

  function formSchemaForSport(sportId) { var k = canonSportId(sportId); return (k && ACTIVITY_FORM_SCHEMAS[k]) || ACTIVITY_FORM_SCHEMAS.other; }
  function allowedFieldKeys(sportId) { return formSchemaForSport(sportId).fields.map(function (x) { return x.key; }); }
  // Sportfremde Felder beim Sportwechsel entfernen; gemeinsame (date/time/duration/rpe/note) bleiben.
  function stripForeignFields(values, sportId) {
    values = values || {}; var keep = {}; var allowed = allowedFieldKeys(sportId);
    Object.keys(values).forEach(function (k) { if (allowed.indexOf(k) >= 0) keep[k] = values[k]; });
    return keep;
  }

  // Kanonische ID katalog-first auflösen. WICHTIG: NICHT über normSport() raten — dessen
  // Fallback ist 'athletics' und würde rowing/hiking/walking/basketball fälschlich auf
  // 'athletics' (Label „Leichtathletik") kollabieren. Direkter Katalogtreffer hat Vorrang;
  // normSport nur für deutsche Legacy-Labels (z. B. 'Gym'→'gym'). Kein stiller Sport-Fallback.
  // Kanonische Aktivitäts-Sportarten, die NICHT im Onboarding-Auswahlkatalog stehen (z. B. Mobility).
  var EXTRA_SPORTS = { mobility: { label: 'Mobility', icon: 'stretch' } };
  function normStrict(v) { return (O.trainingDomain && O.trainingDomain.normSportStrict) ? O.trainingDomain.normSportStrict(v) : null; }
  function canonSportId(sportId) {
    var c = SL() && SL().CATALOG_BY_ID;
    var low = String(sportId == null ? '' : sportId).trim().toLowerCase();
    if (c && c[low]) return low;            // direkte kanonische ID (rowing, hiking, walking, basketball, ...)
    var n = normStrict(sportId);            // bekannte deutsche/Legacy-Labels → kanonisch; unbekannt → null (kein Raten)
    if (n && c && c[n]) return n;
    if (EXTRA_SPORTS[low]) return low;      // mobility u. ä. (nicht im Onboarding-Katalog, aber kanonisch)
    if (n && EXTRA_SPORTS[n]) return n;
    return null;
  }
  function sportLabel(sportId) { var c = SL() && SL().CATALOG_BY_ID; var k = canonSportId(sportId); if (c && k && c[k]) return c[k].label; if (k && EXTRA_SPORTS[k]) return EXTRA_SPORTS[k].label; try { console.warn('[ORVIA activity] kein Label für Sport-ID', sportId); } catch (e) {} return 'Aktivität'; }
  function sportIcon(sportId) { var c = SL() && SL().CATALOG_BY_ID; var k = canonSportId(sportId); if (c && k && c[k] && c[k].icon) return c[k].icon; if (k && EXTRA_SPORTS[k]) return EXTRA_SPORTS[k].icon; return 'pulse'; }

  // Dynamische Sport-Kacheln aus der Nutzerauswahl: Haupt → geplant (Priorität) → sichtbar gelegentlich → „Weitere Aktivität".
  // Inkrement 4d: Kacheln direkt aus den AKTIVEN Profilsportarten (activeInApp). Hauptsportart zuerst.
  // Eigene Sportarten bleiben erhalten (customName). Liefert null, wenn kein modernes Profil vorliegt.
  function activeSportTilesFromProfile() {
    var P = root.ORVIA && root.ORVIA.profile;
    if (!(P && typeof P.activeSports === 'function')) return null;
    var sports;
    try { sports = P.activeSports(); } catch (e) { return null; }
    if (!Array.isArray(sports) || !sports.length) return null;
    sports = sports.slice().sort(function (a, b) {
      var pa = a.role === 'primary' ? 0 : 1, pb = b.role === 'primary' ? 0 : 1; return pa - pb;
    });
    var seen = {}, out = [];
    sports.forEach(function (s) {
      var custom = !!s.customName;
      var canon = custom ? 'custom' : (canonSportId(s.sportId) || s.sportId);
      var key = custom ? ('custom:' + s.customName) : canon;
      if (seen[key]) return; seen[key] = true;
      out.push(custom
        ? { sportId: 'custom', label: s.customName, icon: 'pulse', custom: true, customSportName: s.customName }
        : { sportId: canon, label: sportLabel(canon), icon: sportIcon(canon) });
    });
    out.push({ sportId: 'other', label: 'Weitere Aktivität', icon: 'pulse', isMore: true });
    return out;
  }
  function userSportTiles(selection) {
    // Profil (activeInApp) ist authoritative; Onboarding-Auswahl nur Fallback für Altnutzer.
    var fromProfile = activeSportTilesFromProfile();
    if (fromProfile && fromProfile.length > 1) return fromProfile;
    var sl = SL(); var out = [];
    if (sl && selection) {
      var primary = sl.getPrimarySport(selection);
      var planned = sl.getPlannedSports(selection);   // [primary, ...] nach Priorität
      var occ = sl.getOccasionalSports(selection);
      var visible = sl.getVisibleSports(selection);
      var seen = {};
      var push = function (id) { if (id && !seen[id]) { seen[id] = true; out.push({ sportId: id, label: sportLabel(id), icon: sportIcon(id) }); } };
      push(primary);
      planned.forEach(push);                          // primary ist schon drin (seen), Rest nach Priorität
      occ.filter(function (id) { return visible.indexOf(id) >= 0; }).forEach(push);
    }
    out.push({ sportId: 'other', label: 'Weitere Aktivität', icon: 'pulse', isMore: true });
    return out;
  }

  function dayOf(a) { return (a && a.startedAt) ? a.startedAt.slice(0, 10) : (a && a._legacy && a._legacy.date) || null; }
  // Legacy-Datensatz „leer"/unvollständig? (kein verlässlicher Inhalt → kein eigenständiges Workout)
  function isEmptyLegacy(session, summary) {
    var hasDur = session && session.dur != null && session.dur > 0;
    var hasContent = summary && (summary.distanceKm != null || summary.distanceM != null || summary.avgHr != null || summary.rpe != null);
    var hasLog = session && ((session.exLog && session.exLog.length) || (session.exercises && session.exercises.length));
    var hasNote = session && session.note && session.note !== 'Manuell';
    return !(hasDur || hasContent || hasLog || hasNote);
  }
  // Deterministische Legacy-ID: legacy:<date>:<sportId>. source 'legacy_local'.
  // Verknüpfungsfelder (workoutSessionId/clientSessionId) für semantische Dedup gegen kanonische Workouts.
  function legacySessionToActivity(date, type, session) {
    session = session || {}; var an = AN();
    var sportId = normSport(type);
    var durSec = an ? an.durationSecondsOf({ duration_min: session.dur != null ? session.dur : null }) : (session.dur != null ? Math.round(session.dur * 60) : null);
    var startedAt = date ? (date + 'T00:00:00.000Z') : null;
    var summary = {};
    if (session.dist != null) { if (sportId === 'swimming') summary.distanceM = session.dist; else summary.distanceKm = session.dist; }
    if (session.hr != null) summary.avgHr = session.hr;
    if (session.elev != null && sportId !== 'swimming') summary.elevationM = session.elev;
    if (session.rpe != null) summary.rpe = session.rpe;
    return {
      id: null, clientRecordId: 'legacy:' + date + ':' + sportId, userId: (O.user && O.user.id) || 'local',
      sportId: sportId, source: 'legacy_local', sourceRecordId: date + ':' + sportId,
      workoutSessionId: session.workoutSessionId || null, clientSessionId: session.clientSessionId || null,
      startedAt: startedAt, endedAt: null, durationSeconds: durSec, status: 'completed',
      summary: summary, workoutSnapshot: null, syncStatus: 'local', isEmpty: isEmptyLegacy(session, summary),
      _legacy: { date: date, type: type }
    };
  }

  // Kanonische + Legacy zusammenführen. Dedup:
  //  1) exakt: source+sourceRecordId,
  //  2) semantisch (NUR Legacy↔Canonical): gleiche workoutSessionId/clientSessionId → Legacy verwerfen,
  //  3) leerer Legacy-Eintrag + kanonisches Gegenstück am selben Tag/Sportart → Legacy verwerfen.
  // Kanonisch (mit Snapshot) gewinnt immer. Zwei echte getrennte Workouts werden NICHT gemerged.
  function mergeActivities(canonical, legacy) {
    canonical = Array.isArray(canonical) ? canonical : []; legacy = Array.isArray(legacy) ? legacy : [];
    var byKey = {}, byWid = {}, byDay = {}, out = [];
    canonical.forEach(function (a) {
      byKey[a.source + '|' + a.sourceRecordId] = true;
      [a.workoutSessionId, a.sourceRecordId].forEach(function (w) { if (w) byWid[String(w)] = true; });
      var d = dayOf(a); if (d) { var key = normSport(a.sportId) + '|' + d; (byDay[key] = byDay[key] || []).push(a); }
      out.push(a);
    });
    legacy.forEach(function (a) {
      if (byKey[a.source + '|' + a.sourceRecordId]) return;                       // 1
      var wid = a.workoutSessionId || a.clientSessionId;
      if (wid && byWid[String(wid)]) return;                                       // 2 — Spiegel desselben Workouts
      if (a.isEmpty) { var sameDay = byDay[normSport(a.sportId) + '|' + dayOf(a)]; if (sameDay && sameDay.length) return; } // 3
      out.push(a);
    });
    out.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    return out;
  }

  // Server-Activity-Zeile (snake_case) → kanonische Client-Form.
  function normalizeServerActivity(r) {
    r = r || {};
    var sportId = r.sport_id || 'other';
    /* Batch 3b.1b: Summary über DIESELBE zentrale Normalisierung wie
       activityNormalize.normalizeActivityRecord (Garmin snake_case → camelCase),
       damit beide Serverpfade byte-identische kanonische Felder liefern. */
    var an = AN();
    var summary = (an && typeof an.normalizeActivitySummary === 'function')
      ? an.normalizeActivitySummary(r.summary || {}, sportId)
      : (r.summary || {});
    return {
      id: r.id || null, clientRecordId: r.client_record_id || null, userId: r.user_id || null,
      sportId: sportId, source: r.source || 'manual', sourceRecordId: r.source_record_id || null,
      workoutSessionId: r.workout_session_id || null, startedAt: r.started_at || null, endedAt: r.ended_at || null,
      durationSeconds: r.duration_seconds != null ? r.duration_seconds : null, status: r.status || 'completed',
      summary: summary, metrics: r.metrics || {}, workoutSnapshot: null, syncStatus: 'synced', _server: true
    };
  }
  // Dedup-Schlüssel einer Activity (mehrere stabile Identitäten).
  function activityKeys(a) {
    var ks = [];
    if (a.id) ks.push('id:' + a.id);
    if (a.clientRecordId) ks.push('crid:' + a.clientRecordId);
    if (a.source && a.sourceRecordId) ks.push('src:' + a.source + '|' + a.sourceRecordId);
    if (a.workoutSessionId) ks.push('wsid:' + a.workoutSessionId);
    return ks;
  }
  function dayOfAct(a) { return (a && a.startedAt) ? a.startedAt.slice(0, 10) : (a && a._legacy && a._legacy.date) || null; }
  /* Batch 2c: timezone-sichere Tageszuordnung. startedAt ist UTC-ISO; der
     TRAININGSTAG ist das LOKALE Datum (Europe/Vienna: 22:30Z = nächster Tag).
     timeZone wird injiziert (deterministisch/testbar); ungültige Zone oder
     fehlendes Intl ⇒ dokumentierter UTC-Fallback (Bestandsverhalten). */
  var _dtfCache = {};
  function dayOfActLocal(a, timeZone) {
    var iso = a && a.startedAt;
    if (!iso) return (a && a._legacy && a._legacy.date) || null;
    if (!timeZone) return iso.slice(0, 10);
    try {
      var f = _dtfCache[timeZone] || (_dtfCache[timeZone] = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
      var t = Date.parse(iso);
      if (!isFinite(t)) return iso.slice(0, 10);
      return f.format(new Date(t));                                   // en-CA ⇒ YYYY-MM-DD
    } catch (e) { return iso.slice(0, 10); }
  }
  // „Leer": keine Dauer UND keine Inhalte (Distanz/Sätze/Übungen/Snapshot). Für Dubletten-Unterdrückung.
  function isEmptyActivity(a) {
    if (a && a.isEmpty) return true;
    var hasDur = a && a.durationSeconds != null && a.durationSeconds > 0;
    var s = (a && a.summary) || {};
    var hasContent = s.distanceKm != null || s.distanceM != null || (s.workingSetCount != null && s.workingSetCount > 0) || (s.exerciseCount != null && s.exerciseCount > 0) || s.avgHr != null || s.rpe != null;
    var hasSnap = a && a.workoutSnapshot && a.workoutSnapshot.length;
    return !(hasDur || hasContent || hasSnap);
  }
  // Drei Quellen vereinen. Priorität: Server > lokal pending > Legacy. Dedup über alle Schlüssel.
  // opts.isTombstoned(a): true → Eintrag (offline gelöscht) ausblenden.
  function mergeAllActivities(server, local, legacy, opts) {
    opts = opts || {};
    server = Array.isArray(server) ? server : []; local = Array.isArray(local) ? local : []; legacy = Array.isArray(legacy) ? legacy : [];
    var ts = typeof opts.isTombstoned === 'function' ? opts.isTombstoned : function () { return false; };
    var seen = {}, out = [];
    function add(a) {
      if (ts(a)) return false;                                  // gelöscht (Tombstone) → ausblenden
      var ks = activityKeys(a);
      for (var i = 0; i < ks.length; i++) { if (seen[ks[i]]) return false; }
      ks.forEach(function (k) { seen[k] = true; }); out.push(a); return true;
    }
    server.forEach(add); local.forEach(add); legacy.forEach(add);
    // Leer-Unterdrückung: existiert je Sportart+Tag ein NICHT-leerer Eintrag, werden leere dort verworfen
    // (echtes einzelnes Leer-Workout ohne Gegenstück bleibt erhalten → bleibt löschbar).
    var nonEmptyDay = {};
    out.forEach(function (a) { if (!isEmptyActivity(a)) { var k = normSport(a.sportId) + '|' + dayOfAct(a); nonEmptyDay[k] = true; } });
    out = out.filter(function (a) { if (!isEmptyActivity(a)) return true; return !nonEmptyDay[normSport(a.sportId) + '|' + dayOfAct(a)]; });
    out.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    return out;
  }

  // Sportartspezifische Zusammenfassungszeile (kein universelles Distanz/Pace für alle).
  function summaryLine(activity) {
    activity = activity || {}; var an = AN(); var s = activity.summary || {};
    var dur = an ? an.fmtDurationSeconds(activity.durationSeconds) : (activity.durationSeconds != null ? Math.round(activity.durationSeconds / 60) + ' min' : 'Dauer nicht erfasst');
    var prof = formSchemaForSport(activity.sportId).detailProfile;
    var parts = [];
    if (prof === 'gym') { parts.push(dur); if (s.exerciseCount != null) parts.push(s.exerciseCount + ' Übungen'); if (s.workingSetCount != null) parts.push(s.workingSetCount + ' Sätze'); return parts.join(' · '); }
    if (prof === 'distance_pace' && s.distanceKm) { parts.push(s.distanceKm.toFixed ? s.distanceKm.toFixed(1) + ' km' : s.distanceKm + ' km'); parts.push(dur); var sec = activity.durationSeconds; if (sec && s.distanceKm) parts.push(fmtPaceKm(sec / s.distanceKm)); return parts.join(' · '); }
    if (prof === 'distance_pace_swim' && s.distanceM) { parts.push(s.distanceM + ' m'); parts.push(dur); var sec2 = activity.durationSeconds; if (sec2 && s.distanceM) parts.push(fmtPace100(sec2 / (s.distanceM / 100))); return parts.join(' · '); }
    if ((prof === 'distance' || prof === 'distance_speed') && (s.distanceKm != null)) { parts.push((s.distanceKm.toFixed ? s.distanceKm.toFixed(1) : s.distanceKm) + ' km'); parts.push(dur); return parts.join(' · '); }
    if (prof === 'session_kind') { parts.push(dur); if (s.sessionKind) parts.push(s.sessionKind === 'match' ? 'Match' : 'Training'); if (s.rpe != null) parts.push('RPE ' + s.rpe); return parts.join(' · '); }
    parts.push(dur); return parts.join(' · ');
  }
  function fmtPaceKm(secPerKm) { var m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60); return m + ':' + String(s).padStart(2, '0') + '/km'; }
  function fmtPace100(secPer100) { var m = Math.floor(secPer100 / 60), s = Math.round(secPer100 % 60); return m + ':' + String(s).padStart(2, '0') + '/100 m'; }

  // Verständliche deutsche Labels für Enum-Rohwerte (intern bleiben stabile technische Werte).
  var ENUM_LABELS = {
    environment: { pool: 'Pool', open_water: 'Freiwasser', outdoor: 'Outdoor', indoor: 'Indoor' },
    sessionKind: { training: 'Training', match: 'Match' },
    format: { single: 'Einzel', double: 'Doppel' },
    discipline: { run: 'Lauf', sprint: 'Sprint', jump: 'Sprung', throw: 'Wurf', multi: 'Mehrkampf', other: 'Sonstige' },
    triType: { brick: 'Koppeltraining', bike_run: 'Rad-Lauf-Koppel', swim_bike: 'Schwimm-Rad-Koppel', transition: 'Wechseltraining', race: 'Triathlon-Wettkampf', discipline: 'Disziplinspezifisches Training' },
    runType: { easy: 'Lockerer Lauf', long: 'Langer Lauf', tempo: 'Tempolauf', intervals: 'Intervalle', recovery: 'Regenerationslauf', race: 'Wettkampf', trail: 'Trailrun', treadmill: 'Laufband' },
    rideType: { easy: 'Lockere Ausfahrt', long: 'Lange Ausfahrt', intervals: 'Intervalle', indoor: 'Indoor-Training', climbing: 'Bergtraining', gravel: 'Gravel', mtb: 'Mountainbike', tt: 'Zeitfahren', race: 'Wettkampf' },
    swimType: { technique: 'Techniktraining', easy: 'Lockeres Schwimmen', endurance: 'Ausdauertraining', intervals: 'Intervalltraining', sprint: 'Sprinttraining', open_water: 'Freiwasser', race: 'Wettkampf' },
    footballType: { team_training: 'Mannschaftstraining', match: 'Spiel', individual: 'Individuelles Fußballtraining', athletics: 'Athletiktraining' },
    position: { goalkeeper: 'Torwart', centre_back: 'Innenverteidiger', full_back: 'Außenverteidiger', wing_back: 'Schienenspieler', defensive_midfield: 'Sechser', central_midfield: 'Achter', attacking_midfield: 'Zehner', winger: 'Flügelspieler', striker: 'Mittelstürmer' },
    athleticsType: { sprint: 'Sprinttraining', endurance_run: 'Lauftraining', technique: 'Techniktraining', jump: 'Sprungtraining', throw: 'Wurftraining', strength: 'Kraft-/Athletiktraining', competition: 'Wettkampf' },
    badmintonType: { training: 'Training', single: 'Einzelmatch', double: 'Doppelmatch', mixed: 'Mixed', tournament: 'Turnier', technique: 'Techniktraining' },
    golfType: { round9: '9-Loch-Runde', round18: '18-Loch-Runde', range: 'Driving Range', shortgame: 'Kurzspieltraining', putting: 'Putting', tournament: 'Turnier' },
    tennisType: { training: 'Training', single: 'Einzelmatch', double: 'Doppelmatch', serve: 'Aufschlagtraining', ballmachine: 'Ballmaschine', technique: 'Techniktraining', tournament: 'Turnier' },
    padelType: { training: 'Training', match: 'Match', technique: 'Techniktraining', serve: 'Aufschlagtraining', tournament: 'Turnier' },
    gymType: { fullbody: 'Ganzkörper', upper: 'Oberkörper', lower: 'Unterkörper', push: 'Push', pull: 'Pull', legs: 'Beine', sport_specific: 'Sportartspezifisches Krafttraining', free: 'Freies Krafttraining' },
    rowingType: { erg_easy: 'Ergometer locker', erg_intervals: 'Ergometer Intervalle', water: 'Wassertraining', technique: 'Techniktraining', longdistance: 'Langdistanz', race: 'Wettkampf' },
    hikingType: { hike: 'Wanderung', mountain: 'Bergwanderung', trekking: 'Trekking', multiday: 'Mehrtagestour' },
    walkingType: { walk: 'Spaziergang', brisk: 'Zügiges Gehen', recovery: 'Regenerationsgang', walking_workout: 'Walking', treadmill: 'Laufband-Gehen' },
    climbingType: { bouldering: 'Bouldern', sport: 'Sportklettern', toprope: 'Toprope', technique: 'Techniktraining', fingerboard: 'Fingerboard', strength: 'Krafttraining', outdoor: 'Outdoor-Session' },
    yogaType: { hatha: 'Hatha', vinyasa: 'Vinyasa', yin: 'Yin', power: 'Power Yoga', restorative: 'Restorative', guided: 'Geführte Einheit', free: 'Freie Praxis' },
    mobilityType: { fullbody: 'Ganzkörper-Mobility', lower: 'Unterkörper', upper: 'Oberkörper', shoulder: 'Schulter', hip: 'Hüfte', ankle: 'Sprunggelenk', recovery: 'Regeneration' },
    hyroxType: { simulation: 'Kompletter HYROX-Simulationstest', intervals: 'HYROX-Intervalltraining', run_station: 'Lauf-Station-Koppeltraining', station_technique: 'Stationstechnik', sled: 'Sled-Training', erg: 'Ergometer-Training', strength_endurance: 'Kraftausdauer', race: 'Wettkampf', recovery: 'Recovery-/Technikeinheit' }
  };
  // Mannschaftssport-Aktivitätstypen (gemeinsame deutsche Labels) + Positionslabels.
  var TEAM_ACT_TYPE = { team_training: 'Mannschaftstraining', match: 'Spiel', individual: 'Individuelles Training', athletics: 'Athletiktraining', tournament: 'Turnier', shooting: 'Wurftraining', technique: 'Techniktraining', beach: 'Beachvolleyball', jump: 'Sprungtraining', contact: 'Kontakttraining' };
  ['basketballType', 'handballType', 'volleyballType', 'hockeyType', 'rugbyType'].forEach(function (k) { ENUM_LABELS[k] = TEAM_ACT_TYPE; });
  Object.assign(ENUM_LABELS.position, {
    point_guard: 'Point Guard', shooting_guard: 'Shooting Guard', small_forward: 'Small Forward', power_forward: 'Power Forward', center: 'Center',
    left_wing: 'Linksaußen', right_wing: 'Rechtsaußen', left_back: 'Rückraum links', centre_back_hb: 'Rückraum Mitte', right_back: 'Rückraum rechts', pivot: 'Kreis',
    setter: 'Zuspiel', outside_hitter: 'Außenangriff', opposite: 'Diagonal', middle_blocker: 'Mittelblock', libero: 'Libero',
    defence: 'Verteidigung', midfield: 'Mittelfeld', attack: 'Angriff',
    front_row: 'Front Row', locks: 'Locks', back_row: 'Back Row', half_backs: 'Half Backs', centres: 'Centres', back_three: 'Back Three'
  });
  var TEAM_SPORTS = { football: 1, handball: 1, basketball: 1 };
  function enumLabel(key, value, sportId) {
    if (key === 'sessionKind' && value === 'match' && TEAM_SPORTS[normSport(sportId)]) return 'Spiel';   // Team: „Spiel" statt „Match"
    return (ENUM_LABELS[key] && ENUM_LABELS[key][value]) || value;
  }
  function activityTitle(sportId) { return sportLabel(sportId) + ' erfassen'; }

  // Gruppierter Katalog für „Weitere Aktivität" (nur kanonisch unterstützte; bereits sichtbare ausschließen).
  var MORE_GROUPS = [
    { label: 'Ausdauer', ids: ['running', 'cycling', 'swimming', 'rowing', 'walking', 'hiking', 'athletics', 'triathlon'] },
    { label: 'Kraft & Bewegung', ids: ['gym', 'hyrox', 'climbing'] },
    { label: 'Mannschaftssport', ids: ['football', 'handball', 'basketball', 'volleyball', 'hockey', 'rugby'] },
    { label: 'Racketsport', ids: ['padel', 'tennis', 'badminton'] },
    { label: 'Körper & Geist', ids: ['yoga', 'mobility'] },
    { label: 'Sonstige', ids: ['golf', 'other'] }
  ];
  function moreActivityGroups(excludeSportIds) {
    var ex = {}; (excludeSportIds || []).forEach(function (id) { var k = canonSportId(id) || String(id || '').toLowerCase(); if (k) ex[k] = 1; });
    var cat = (SL() && SL().CATALOG_BY_ID) || {};
    return MORE_GROUPS.map(function (g) {
      // Dedup primär über sportId; nur kanonisch unterstützte (im Katalog) bzw. 'other'.
      var seen = {};
      var ids = g.ids.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return (id === 'other' || cat[id]) && !ex[id]; });
      return { label: g.label, items: ids.map(function (id) { return { sportId: id, label: id === 'other' ? 'Andere Aktivität' : sportLabel(id), icon: sportIcon(id) }; }) };
    }).filter(function (g) { return g.items.length; });
  }

  /* R1.1 · ZENTRALE Ableitung des Legacy-Tagesspeicher-Keys (DB[date].sessions).
     Ein Live-Workout behält seine konkrete Sportidentität: die 5 historischen
     Kern-Keys bleiben für ihre Sportarten erhalten (Analytics-Kompatibilität),
     JEDE andere bekannte Sportart läuft unter ihrem Katalog-Label weiter,
     Unbekanntes wird 'other' + eigener Text-Key. NIEMALS 'Gym' als Fallback —
     das hat vorher Fußball/Tennis/… als Krafttraining verbucht (Master-Matrix #2). */
  var LEGACY_SESSION_KEYS = { running: 'Laufen', cycling: 'Rad', swimming: 'Schwimmen', gym: 'Gym', mobility: 'Mobilität' };
  function legacySessionKey(sportOrLabel) {
    var canon = canonSportId(sportOrLabel);
    if (canon && LEGACY_SESSION_KEYS[canon]) return { key: LEGACY_SESSION_KEYS[canon], sportId: canon };
    if (canon) return { key: sportLabel(canon), sportId: canon };
    var raw = String(sportOrLabel == null ? '' : sportOrLabel).trim();
    return { key: raw || 'Aktivität', sportId: 'other' };
  }

  /* ============================================================
     Batch 2a/2b (2026-07-18) · Kanonische Tageslast (sRPE) — PURE.
     Ziel: EINE Lastwahrheit je Tag aus kanonischen Activities + Legacy-
     Sessions OHNE Doppelzählung (Prompt §6; Gap-Analyse P0).

     VERBINDLICHER DEDUPE-VERTRAG (Batch-2b-Freigabe, 2026-07-18 —
     ausführlich: docs/ACTIVITY-DEDUPE-GROUPING-CONTRACT.md):
       P1  Stabile explizite Verknüpfungen haben Vorrang:
           derivedFromActivity=true (Manual-Projektion, activity.js:798)
           sowie workoutSessionId/clientSessionId/canonicalActivityId-
           Referenz auf eine vorhandene Activity (Live-Spiegel,
           workout-ui:669) ⇒ Legacy-Eintrag ist DERSELBE Vorgang.
       P2  Danach source+source_record_id bzw. stabile Client-IDs
           (activityKeys: id/crid/src/wsid — bereits im Store/Merge
           erzwungen; Eingabeliste ist darüber eindeutig).
       P3  Fingerprint (ähnliche Dauer/Distanz) ist OHNE stabile Referenz
           oder ausreichend genaue Zeitidentität KEIN Duplikat, sondern
           nur AMBIGUITÄT (Batch 2c): Legacy-Sessions tragen keine
           Startzeit ⇒ beide Beiträge zählen, beide werden als
           ambiguity 'possible_duplicate' markiert und die Ambiguität
           senkt die Load-Confidence (Gates feuern darauf nicht).
           KEIN automatischer RPE-Transfer bei bloß ähnlicher
           Dauer/Distanz.
       P4  Gleicher Tag + gleiche Sportart allein sind NIEMALS ein
           Duplikat — zwei echte Einheiten zählen beide.
       P5  Rohaktivitäten bleiben unverändert erhalten (reine Leselogik).
       P6  Gruppierung (groupActivitySessions) und Deduplizierung sind
           GETRENNTE Konzepte: Gruppen fassen echte, einzeln gezählte
           Aktivitäten zusammen, sie dedupen nie.

     LAST-AUSWEIS je Beitrag (Bedingung 4 der Freigabe): source,
     Berechnungsweg (loadBasis), Einheiten (durationUnit/loadUnit),
     Confidence und Dedupe-Entscheidung. Fehlende Belastungsdaten sind
     'unknown' (load null) — kein stilles 0, kein pauschaler Default.
     Ohne RPE wird KEIN RPE-Wert erfunden (rpe bleibt null); eine Last-
     SCHÄTZUNG über die dokumentierte Intensitätsannahme (Faktor 5,
     mobility 2 — identisch zur historischen Calc.sessionLoad-Konvention)
     wird als loadBasis 'duration_default_intensity' mit confidence 'low'
     ausgewiesen, damit Garmin-Einheiten nicht lastblind bleiben.

     HÄRTE-SIGNALE (Batch 2c — ersetzt die globale distKm≥14-Regel, die
     eine lockere 40-km-Radfahrt fälschlich als hochintensiv wertete).
     Getrennt ausgewiesen je Beitrag:
       intensityHard  gemessene/notierte Intensität (RPE ≥ 7)
       longSession    sportartspezifischer Umfang (LONG_SESSION_RULES)
       mechanicalImpact  Impact-/Stoßbelastung der Sportart
       hardDay        tatsächlicher harter Tag = intensityHard ODER
                      (longSession UND mechanicalImpact) — ein langer
                      Lauf ist mechanisch hart, eine lange lockere
                      Radfahrt nicht automatisch.
     Schwellen sind versionierte Heuristiken (keine Naturgesetze).
     ============================================================ */
  var LOAD_INTENSITY_DEFAULT = 5, LOAD_INTENSITY_MOBILITY = 2;
  var FP_DUR_TOL_MIN = 5, FP_DUR_TOL_PCT = 0.15, FP_DIST_TOL_PCT = 0.10;
  var IMPACT_SPORTS = { running: 1, football: 1, handball: 1, basketball: 1, athletics: 1, tennis: 1, padel: 1, volleyball: 1, hyrox: 1 };
  var LONG_SESSION_RULES = {
    running: { distKm: 14, minutes: 90 },
    cycling: { distKm: 80, minutes: 150 },
    swimming: { distM: 3000, minutes: 90 },
    _default: { minutes: 120 }
  };
  function _longSession(sportId, minutes, distKm, distM) {
    var r = LONG_SESSION_RULES[sportId] || LONG_SESSION_RULES._default;
    if (r.distKm != null && distKm != null && distKm >= r.distKm) return true;
    if (r.distM != null && distM != null && distM >= r.distM) return true;
    if (r.minutes != null && minutes != null && minutes >= r.minutes) return true;
    return false;
  }
  function _defaultIntensity(sportId) { return sportId === 'mobility' ? LOAD_INTENSITY_MOBILITY : LOAD_INTENSITY_DEFAULT; }
  function _distKmOf(sportId, distKm, distM) {
    if (distKm != null) return distKm;
    if (distM != null) return distM / 1000;
    return null;
  }
  /* PURE · konservativer Fingerprint (Vertrag P3). */
  function _fingerprintMatch(legacyMin, legacyDistKm, actMin, actDistKm) {
    if (!(legacyMin > 0) || !(actMin > 0)) return false;                 // beide Dauern Pflicht
    var tol = Math.max(FP_DUR_TOL_MIN, Math.max(legacyMin, actMin) * FP_DUR_TOL_PCT);
    if (Math.abs(legacyMin - actMin) > tol) return false;
    if (legacyDistKm != null && actDistKm != null) {
      var dtol = Math.max(legacyDistKm, actDistKm) * FP_DIST_TOL_PCT;
      if (Math.abs(legacyDistKm - actDistKm) > dtol) return false;
    }
    return true;
  }
  /* PURE · dailyLoadUnits(activities, sessions):
     activities = kanonische Activities EINES Tages (Tombstones vorher
     ausfiltern), sessions = DB[date].sessions ({} erlaubt).
     Rückgabe { load, loadUnit, units[], excluded[], unknownUnits,
     estimatedShare } — deterministisch, nicht-mutierend.
     unit = { kind, sportId, source, minutes, durationUnit, rpe, rpeSource,
              loadBasis, load, loadUnit, confidence, hard, dedupe }. */
  function dailyLoadUnits(activities, sessions) {
    activities = Array.isArray(activities) ? activities : [];
    sessions = (sessions && typeof sessions === 'object') ? sessions : {};
    var canonRefs = {};
    activities.forEach(function (a) { if (a) activityKeys(a).forEach(function (k) { canonRefs[k] = true; }); });
    var excluded = [];
    // Kanonische Beiträge vorbereiten (P2: Liste ist über activityKeys eindeutig).
    var canonUnits = activities.filter(Boolean).map(function (a) {
      var sp = normSport(a.sportId);
      var min = a.durationSeconds != null ? Math.round(a.durationSeconds / 60) : null;
      var rpe = (a.summary && a.summary.rpe != null && a.summary.rpe > 0) ? a.summary.rpe : null;
      return {
        kind: 'activity', sportId: sp, source: a.source || 'unknown',
        minutes: min, durationUnit: 'min',
        rpe: rpe, rpeSource: rpe != null ? 'measured' : null,
        distKm: _distKmOf(sp, a.summary && a.summary.distanceKm, a.summary && a.summary.distanceM),
        _a: a
      };
    });
    // Legacy-Sessions gegen den Vertrag prüfen.
    var legacyCounted = [];
    Object.keys(sessions).forEach(function (t) {
      if (t === '_ts') return;
      var s = sessions[t];
      if (!s || typeof s !== 'object') return;
      var sp = normSport(s.sportId || t);
      var base = { kind: 'legacy_session', sportId: sp, source: s.source || 'legacy_db' };
      if (s.derivedFromActivity === true) {                                          // P1
        excluded.push(Object.assign({}, base, { dedupe: { decision: 'excluded_projection', rule: 'derivedFromActivity' } }));
        return;
      }
      var refs = [s.workoutSessionId, s.clientSessionId, s.canonicalActivityId];
      for (var i = 0; i < refs.length; i++) {
        var r = refs[i];
        if (r && (canonRefs['wsid:' + r] || canonRefs['crid:' + r] || canonRefs['id:' + r] || canonRefs['src:orvia_workout|' + r])) {
          excluded.push(Object.assign({}, base, { dedupe: { decision: 'excluded_mirror', rule: 'explicit_link', matchedBy: String(r) } }));   // P1
          return;
        }
      }
      var dur = s.dur != null && s.dur > 0 ? Math.round(s.dur) : null;
      var rpe = (s.rpe && s.rpe > 0) ? s.rpe : null;                                 // ||-Semantik wie Calc.sessionLoad
      var distKm = (s.dist != null && sp !== 'swimming') ? s.dist : null;
      var distM = (s.dist != null && sp === 'swimming') ? s.dist : null;
      if (dur == null && rpe == null && distKm == null && distM == null) {           // datenlos (z. B. plan_done)
        excluded.push(Object.assign({}, base, { dedupe: { decision: 'excluded_no_data', rule: 'no_load_evidence' } }));
        return;
      }
      /* P3 (Batch 2c): Fingerprint OHNE stabile Referenz/Zeitidentität dedupliziert
         NICHT — er markiert nur Ambiguität. Beide Beiträge zählen; die Ambiguität
         senkt die Load-Confidence (Konsument: recentLoad/Decision-Gates). */
      var ambiguousWith = null;
      for (var c = 0; c < canonUnits.length; c++) {
        var cu = canonUnits[c];
        if (cu.sportId !== sp || cu._fpMatched) continue;
        if (_fingerprintMatch(dur, distKm, cu.minutes, cu.distKm)) {
          cu._fpMatched = true;
          cu.ambiguity = 'possible_duplicate';
          ambiguousWith = cu._a.clientRecordId || cu._a.id || cu._a.sourceRecordId || null;
          break;
        }
      }
      legacyCounted.push({ kind: 'legacy_session', sportId: sp, source: base.source, minutes: dur, durationUnit: 'min', rpe: rpe, rpeSource: rpe != null ? 'measured' : null, distKm: distKm, distM: distM, ambiguity: ambiguousWith ? 'possible_duplicate' : null, ambiguousWith: ambiguousWith });   // P4
    });
    // Beiträge finalisieren: Berechnungsweg, Confidence, Härte-Signale, Last.
    function finalize(u) {
      var out = {
        kind: u.kind, sportId: u.sportId, source: u.source,
        minutes: u.minutes, durationUnit: 'min',
        rpe: u.rpe != null ? u.rpe : null, rpeSource: u.rpeSource || null,
        loadBasis: null, load: null, loadUnit: 'srpe_au', confidence: null,
        intensityHard: false, longSession: false, mechanicalImpact: !!IMPACT_SPORTS[u.sportId], hardDay: false,
        ambiguity: u.ambiguity || null, ambiguousWith: u.ambiguousWith || null,
        dedupe: { decision: 'counted', rule: null }
      };
      if (u.minutes != null && u.minutes > 0) {
        if (u.rpe != null) {
          out.loadBasis = 'srpe_measured';
          out.load = Math.round(u.minutes * u.rpe);
          out.loadUnit = 'srpe_au';                                                  // echt gemessene sRPE-Last
          out.confidence = u.ambiguity ? 'low' : 'high';
        } else {
          out.loadBasis = 'duration_default_intensity';                              // dokumentierte Annahme, KEIN erfundenes RPE
          out.load = Math.round(u.minutes * _defaultIntensity(u.sportId));
          out.loadUnit = 'est_load_au';                                              // Batch 2d: Schätz-Proxy, KEINE gemessene srpe_au
          out.confidence = 'low';
        }
      } else {
        out.loadBasis = 'unknown';                                                    // Belastungsdaten fehlen ⇒ unknown, nicht 0
        out.load = null;
        out.confidence = 'unknown';
      }
      // Batch 2c: getrennte Härte-Signale statt globaler Distanzregel.
      out.intensityHard = u.rpe != null && u.rpe >= 7;
      var _dM = u.distM != null ? u.distM : (u.distKm != null ? u.distKm * 1000 : null);
      out.longSession = _longSession(u.sportId, u.minutes, u.distKm != null ? u.distKm : null, _dM);
      out.hardDay = out.intensityHard || (out.longSession && out.mechanicalImpact);
      return out;
    }
    var units = canonUnits.map(finalize).concat(legacyCounted.map(finalize));
    var load = 0, est = 0, unknown = 0, ambiguous = 0, measuredLoad = 0, estimatedLoad = 0;
    units.forEach(function (u) {
      if (u.load != null) {
        load += u.load;
        if (u.loadBasis === 'srpe_measured') measuredLoad += u.load; else estimatedLoad += u.load;
      } else unknown++;
      if (u.loadBasis === 'duration_default_intensity') est++;
      if (u.ambiguity) ambiguous++;
    });
    /* Batch 2d: die GEMISCHTE Aggregation ist keine gemessene sRPE-Größe.
       Ehrliche Einheit 'orvia_load_au' + vollständiger Methodenanteil;
       gemessene (srpe_au) und geschätzte (est_load_au) Last stehen getrennt. */
    return {
      load: load, loadUnit: 'orvia_load_au', units: units, excluded: excluded,
      unknownUnits: unknown, ambiguousUnits: ambiguous,
      measuredLoad: measuredLoad, measuredLoadUnit: 'srpe_au',
      estimatedLoad: estimatedLoad, estimatedLoadUnit: 'est_load_au',
      methodShare: load > 0 ? { measured: Math.round(measuredLoad / load * 100) / 100, estimated: Math.round(estimatedLoad / load * 100) / 100 } : { measured: null, estimated: null },
      estimatedShare: units.length ? Math.round(est / units.length * 100) / 100 : 0
    };
  }

  /* ============================================================
     Batch 2b · Session-GRUPPIERUNG (getrennt von Dedupe, Vertrag P6) — PURE.
     Fasst direkt aufeinanderfolgende ECHTE Aktivitäten zusammen (z. B. ein
     in Segmente geteilter Long Run oder ein Brick), ohne Rohaktivitäten zu
     verändern und ohne Last zu verdoppeln (Last zählt je Aktivität, die
     Gruppe ist reine Sicht). gapMinutes default 15. Aktivitäten ohne
     startedAt sind nicht gruppierbar und bleiben ungruppiert außen vor. */
  function groupActivitySessions(dayActivities, opts) {
    opts = opts || {};
    var gapMs = (opts.gapMinutes != null ? opts.gapMinutes : 15) * 60000;
    var acts = (Array.isArray(dayActivities) ? dayActivities : [])
      .filter(function (a) { return a && a.startedAt; })
      .slice()
      .sort(function (a, b) { return String(a.startedAt).localeCompare(String(b.startedAt)); });
    function endOf(a) {
      if (a.endedAt) return Date.parse(a.endedAt);
      var st = Date.parse(a.startedAt);
      return a.durationSeconds != null ? st + a.durationSeconds * 1000 : st;
    }
    function refOf(a) { return a.clientRecordId || a.id || (a.source + '|' + a.sourceRecordId); }
    var groups = [];
    var cur = null, lastEnd = null;
    acts.forEach(function (a) {
      var sp = normSport(a.sportId);
      var st = Date.parse(a.startedAt);
      var contiguous = lastEnd != null && isFinite(st) && (st - lastEnd) <= gapMs && (st - lastEnd) >= -60000;
      if (cur && contiguous && cur.sportId === sp) {
        cur.activityRefs.push(refOf(a)); cur.segments++;
        cur._acts.push(a);
      } else {
        var g = { groupId: 'grp:' + refOf(a), sportId: sp, brickId: null, activityRefs: [refOf(a)], segments: 1, _acts: [a] };
        // Brick-Verkettung: direkt anschließende Gruppe ANDERER Sportart (Vertrag P6).
        if (cur && contiguous && cur.sportId !== sp) {
          var bid = cur.brickId || ('brick:' + cur.groupId);
          cur.brickId = bid; g.brickId = bid;
        }
        groups.push(g); cur = g;
      }
      var e = endOf(a);
      lastEnd = isFinite(e) ? e : st;
    });
    // Aggregation je Gruppe (Rohaktivitäten bleiben unangetastet).
    groups.forEach(function (g) {
      var durS = 0, hasDur = false, km = 0, hasKm = false, m = 0, hasM = false;
      var first = g._acts[0], last = g._acts[g._acts.length - 1];
      g.startedAt = first.startedAt;
      g.endedAt = last.endedAt || null;
      g._acts.forEach(function (a) {
        if (a.durationSeconds != null) { durS += a.durationSeconds; hasDur = true; }
        var s = a.summary || {};
        if (s.distanceKm != null) { km += s.distanceKm; hasKm = true; }
        if (s.distanceM != null) { m += s.distanceM; hasM = true; }
      });
      g.totalDurationSeconds = hasDur ? durS : null;
      g.totalDistanceKm = hasKm ? Math.round(km * 100) / 100 : null;
      g.totalDistanceM = hasM ? Math.round(m) : null;
      delete g._acts;
    });
    return { groups: groups, gapMinutes: gapMs / 60000 };
  }

  var api = {
    ACTIVITY_FORM_SCHEMAS: ACTIVITY_FORM_SCHEMAS, formSchemaForSport: formSchemaForSport, allowedFieldKeys: allowedFieldKeys,
    ENUM_LABELS: ENUM_LABELS, enumLabel: enumLabel, activityTitle: activityTitle, moreActivityGroups: moreActivityGroups,
    normalizeServerActivity: normalizeServerActivity, mergeAllActivities: mergeAllActivities, activityKeys: activityKeys,
    stripForeignFields: stripForeignFields, sportLabel: sportLabel, sportIcon: sportIcon, userSportTiles: userSportTiles, activeSportTilesFromProfile: activeSportTilesFromProfile,
    legacySessionToActivity: legacySessionToActivity, legacySessionKey: legacySessionKey, mergeActivities: mergeActivities, summaryLine: summaryLine,
    dayOfAct: dayOfAct, dayOfActLocal: dayOfActLocal, dailyLoadUnits: dailyLoadUnits, groupActivitySessions: groupActivitySessions,
    LONG_SESSION_RULES: LONG_SESSION_RULES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
