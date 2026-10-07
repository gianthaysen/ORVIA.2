/* ============================================================
   ORVIA · activity-time (v8-447) — wann eine Aktivitaet stattfand, als ORTSZEIT.

   Befund bis v8-446: Datum und Uhrzeit wurden aus dem Text von `startedAt` geschnitten
   (slice(0,10) / slice(11,16)). `startedAt` ist bei Garmin und bei ORVIA-Workouts ein
   UTC-Zeitpunkt — die Anzeige lag im deutschen Sommer zwei Stunden, im Winter eine Stunde
   zu frueh; zwischen 0 und 2 Uhr stand der Vortag da.

   Zeitmodell (was `startedAt` je Quelle bedeutet):
     Zeitpunkt   garmin, orvia_workout, live und alles Uebrige: echter UTC-Zeitpunkt.
     Wandzeit    manual, import, legacy_local: der Nutzer hat Datum + Uhrzeit EINGEGEBEN;
                 gespeichert ist diese Wandzeit ohne Zone (nach dem Weg ueber den Server
                 traegt sie ein „Z", gemeint bleibt die eingegebene Uhrzeit).

   Anzeige, in dieser Reihenfolge:
     1. metrics.garmin.start_local — Wandzeit AM ORT der Aktivitaet, von Garmin geliefert
        (richtig auch auf Reisen). basis 'activity_local'
     2. Wandzeit-Quelle — der eingegebene Text.                    basis 'wall_clock'
     3. Zeitpunkt in der Zeitzone des Nutzers (Intl; Sommer-/Winterzeit automatisch,
        keine feste Verschiebung, keine fest eingetragene Zone).   basis 'timezone'
     4. Ohne Zone / ohne Intl: UTC-Text wie bisher.                basis 'utc_fallback'

   NICHT Teil dieses Moduls: die Tageszuordnung fuer Summen (activityConfig.dayOfActLocal).
   Sie behandelt jede Quelle als Zeitpunkt — fuer spaet abends EINGEGEBENE Einheiten ist das
   ein bekannter, dokumentierter Rest (docs/GARMIN-CAPABILITY-MATRIX.md, Abschnitt Zeit).

   Rein: kein DOM, kein Speicher. Die Zeitzone kommt herein oder aus dem Profil.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var WALL_SOURCES = { manual: 1, 'import': 1, legacy_local: 1 };

  function hasZone(s) { return /(?:Z|[+-]\d{2}:?\d{2})$/.test(String(s || '')); }
  function isWallText(s) { return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(String(s || '')); }

  /* Wandzeit am Ort der Aktivitaet, falls die Quelle sie mitliefert. */
  function startLocalOf(a) {
    var m = a && a.metrics, g = m && m.garmin;
    var s = (g && g.start_local) || null;
    return (typeof s === 'string' && isWallText(s)) ? s.replace(' ', 'T') : null;
  }
  function kind(a) {
    if (!a) return 'instant';
    if (a._legacy || WALL_SOURCES[a.source]) return 'wall';
    if (a.startedAt && !hasZone(a.startedAt)) return 'wall';
    return 'instant';
  }

  function defaultTimezone() {
    try { if (O.profileStore && O.profileStore.effectiveTimezone) { var z = O.profileStore.effectiveTimezone(); if (z) return z; } } catch (e) {}
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e2) { return null; }
  }

  var _dtf = {};
  function partsInZone(iso, tz) {
    var t = Date.parse(iso);
    if (!isFinite(t) || !tz) return null;
    var f = _dtf[tz] || (_dtf[tz] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    var p = {}; f.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    if (!p.year || !p.hour) return null;
    return { date: p.year + '-' + p.month + '-' + p.day, time: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
  }
  function sliceParts(s) {
    s = String(s || '');
    return { date: s.length >= 10 ? s.slice(0, 10) : null, time: s.length >= 16 ? s.slice(11, 16) : null };
  }

  /* { date:'YYYY-MM-DD'|null, time:'HH:MM'|null, basis } — nie eine Ausnahme. */
  function localParts(a, timeZone) {
    var out = { date: null, time: null, basis: null };
    if (!a) return out;
    var sl = startLocalOf(a);
    if (sl) { var ps = sliceParts(sl); return { date: ps.date, time: ps.time, basis: 'activity_local' }; }
    var iso = a.startedAt;
    if (!iso) { if (a._legacy && a._legacy.date) return { date: a._legacy.date, time: null, basis: 'wall_clock' }; return out; }
    if (!isWallText(iso)) return out;                       // kein lesbarer Zeittext: nichts behaupten
    if (kind(a) === 'wall') { var pw = sliceParts(iso); return { date: pw.date, time: pw.time, basis: 'wall_clock' }; }
    var tz = timeZone === undefined ? defaultTimezone() : timeZone;
    if (tz) {
      try { var pz = partsInZone(iso, tz); if (pz) return { date: pz.date, time: pz.time, basis: 'timezone' }; } catch (e) {}
    }
    var pu = sliceParts(iso);
    return { date: pu.date, time: pu.time, basis: 'utc_fallback' };
  }

  var api = {
    localParts: localParts, kind: kind, startLocalOf: startLocalOf, defaultTimezone: defaultTimezone,
    WALL_SOURCES: Object.keys(WALL_SOURCES)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.activityTime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
