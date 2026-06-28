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
    running: { sportId: 'running', detailProfile: 'distance_pace', fields: COMMON.concat([f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('avgHr', 'HF Ø', 'number', { optional: true }), f('elevationM', 'Höhenmeter', 'number', { optional: true }), RPE, NOTE]) },
    cycling: { sportId: 'cycling', detailProfile: 'distance_speed', fields: COMMON.concat([f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('environment', 'Indoor/Outdoor', 'enum', { options: ['outdoor', 'indoor'] }), f('avgHr', 'HF Ø', 'number', { optional: true }), f('elevationM', 'Höhenmeter (nur Outdoor)', 'number', { optional: true, onlyWhen: { environment: 'outdoor' } }), f('avgSpeedKmh', 'Ø Geschwindigkeit (km/h)', 'number', { optional: true }), f('avgPowerW', 'Ø Leistung (W)', 'number', { optional: true }), RPE, NOTE]) },
    swimming: { sportId: 'swimming', detailProfile: 'distance_pace_swim', fields: COMMON.concat([f('distanceM', 'Distanz (m)', 'number', { unit: 'm' }), f('environment', 'Pool/Freiwasser', 'enum', { options: ['pool', 'open_water'] }), f('poolLengthM', 'Beckenlänge (m, nur Pool)', 'number', { optional: true, onlyWhen: { environment: 'pool' } }), f('stroke', 'Schwimmstil', 'text', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    gym: { sportId: 'gym', detailProfile: 'gym', fields: COMMON.concat([RPE, NOTE]) },
    tennis: racket('tennis'), padel: racket('padel'),
    football: team('football'), handball: team('handball'), basketball: team('basketball'),
    triathlon: { sportId: 'triathlon', detailProfile: 'duration', fields: COMMON.concat([f('triType', 'Art', 'enum', { options: ['brick', 'race', 'other'] }), RPE, NOTE]) },
    hiking: { sportId: 'hiking', detailProfile: 'distance', fields: COMMON.concat([f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('elevationM', 'Höhenmeter', 'number', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    walking: { sportId: 'walking', detailProfile: 'distance', fields: COMMON.concat([f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('elevationM', 'Höhenmeter', 'number', { optional: true }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    athletics: { sportId: 'athletics', detailProfile: 'duration', fields: COMMON.concat([f('discipline', 'Disziplin', 'enum', { options: ['run', 'sprint', 'jump', 'throw', 'multi', 'other'] }), RPE, NOTE]) },
    rowing: { sportId: 'rowing', detailProfile: 'distance', fields: COMMON.concat([f('distanceKm', 'Distanz (km)', 'number', { unit: 'km' }), f('avgHr', 'HF Ø', 'number', { optional: true }), RPE, NOTE]) },
    other: { sportId: 'other', detailProfile: 'duration', fields: COMMON.concat([f('name', 'Name', 'text', { required: true }), RPE, NOTE]) }
  };
  function racket(id) { return { sportId: id, detailProfile: 'session_kind', fields: COMMON.concat([f('sessionKind', 'Training/Match', 'enum', { options: ['training', 'match'] }), f('format', 'Einzel/Doppel', 'enum', { options: ['single', 'double'] }), RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('result', 'Ergebnis', 'text', { optional: true }), NOTE]) }; }
  function team(id) { return { sportId: id, detailProfile: 'session_kind', fields: COMMON.concat([f('sessionKind', 'Training/Spiel', 'enum', { options: ['training', 'match'] }), f('role', 'Position/Rolle', 'text', { optional: true }), RPE, f('avgHr', 'HF Ø', 'number', { optional: true }), f('distanceKm', 'Distanz (km, falls vorhanden)', 'number', { optional: true }), NOTE]) }; }

  function formSchemaForSport(sportId) { return ACTIVITY_FORM_SCHEMAS[normSport(sportId)] || ACTIVITY_FORM_SCHEMAS.other; }
  function allowedFieldKeys(sportId) { return formSchemaForSport(sportId).fields.map(function (x) { return x.key; }); }
  // Sportfremde Felder beim Sportwechsel entfernen; gemeinsame (date/time/duration/rpe/note) bleiben.
  function stripForeignFields(values, sportId) {
    values = values || {}; var keep = {}; var allowed = allowedFieldKeys(sportId);
    Object.keys(values).forEach(function (k) { if (allowed.indexOf(k) >= 0) keep[k] = values[k]; });
    return keep;
  }

  function sportLabel(sportId) { var c = SL() && SL().CATALOG_BY_ID; return (c && c[normSport(sportId)] && c[normSport(sportId)].label) || sportId; }
  function sportIcon(sportId) { var c = SL() && SL().CATALOG_BY_ID; return (c && c[normSport(sportId)] && c[normSport(sportId)].icon) || 'pulse'; }

  // Dynamische Sport-Kacheln aus der Nutzerauswahl: Haupt → geplant (Priorität) → sichtbar gelegentlich → „Weitere Aktivität".
  function userSportTiles(selection) {
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

  // Deterministische Legacy-ID: legacy:<date>:<sportId>. source 'legacy_local'.
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
      sportId: sportId, source: 'legacy_local', sourceRecordId: date + ':' + sportId, workoutSessionId: null,
      startedAt: startedAt, endedAt: null, durationSeconds: durSec, status: 'completed',
      summary: summary, workoutSnapshot: null, syncStatus: 'local', _legacy: { date: date, type: type }
    };
  }

  // Kanonische + Legacy-Activities zusammenführen; Dublette über source+sourceRecordId.
  // Kanonisch gewinnt gegen Legacy bei gleichem Schlüssel. Sortiert nach startedAt desc.
  function mergeActivities(canonical, legacy) {
    canonical = Array.isArray(canonical) ? canonical : []; legacy = Array.isArray(legacy) ? legacy : [];
    var byKey = {}, out = [];
    canonical.forEach(function (a) { var k = a.source + '|' + a.sourceRecordId; byKey[k] = true; out.push(a); });
    legacy.forEach(function (a) { var k = a.source + '|' + a.sourceRecordId; if (!byKey[k]) { byKey[k] = true; out.push(a); } });
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

  var api = {
    ACTIVITY_FORM_SCHEMAS: ACTIVITY_FORM_SCHEMAS, formSchemaForSport: formSchemaForSport, allowedFieldKeys: allowedFieldKeys,
    stripForeignFields: stripForeignFields, sportLabel: sportLabel, sportIcon: sportIcon, userSportTiles: userSportTiles,
    legacySessionToActivity: legacySessionToActivity, mergeActivities: mergeActivities, summaryLine: summaryLine
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
