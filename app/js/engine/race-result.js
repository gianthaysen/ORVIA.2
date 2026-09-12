/* ============================================================
   ORVIA · race-result — Wettkampfergebnis aus Aktivitaeten erkennen (S1/E2, 12.09.2026)

   BEFUND (Produktionskonto): Halbmarathon Flensburg am Zieldatum gelaufen — das Ziel
   blieb „aktiv", der Plan-Kopf zeigte „noch 0 Wochen". Es gab keinen Abgleich zwischen
   Ziel und Aktivitaet; nur ein manuelles „Erreicht".

   VERTRAG:
     • match(goal, activities, opts) findet die EINE Aktivitaet, die als Wettkampf zum Ziel
       passt: gleiche Sportfamilie, Datum = Zieldatum (± dayTolerance, Standard 1 Tag),
       Distanz im Zielfenster (>= Zieldistanz, <= Zieldistanz × (1 + slack)). Mehrere
       Kandidaten ⇒ die mit der geringsten Distanzabweichung.
     • verdict: 'achieved' (Zeit <= Zielzeit), 'missed' (Zeit > Zielzeit), 'finished' (kein
       Zielwert). deltaSec = Zeit − Zielzeit (negativ = schneller).
     • Das Modul ENTSCHEIDET NICHT ueber den Zielstatus. Es liefert einen Vorschlag; die
       Bestaetigung (profile.js goalConfirmResult) setzt Status + result. Ohne Bestaetigung
       aendert sich nichts.
     • pending(goal, today): Zieldatum vorbei, kein result, keine passende Aktivitaet ⇒
       { daysSince } — die Oberflaeche fragt nach dem Ergebnis statt „noch 0 Wochen".
     • Nur Laufkategorien mit bekannter Distanz (v1). Triathlon/Rad/Schwimmen: null — ehrlich
       „nicht erkennbar", keine Raterei.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'race-result@1';
  var RUN_DIST_KM = { run_5k: 5, run_10k: 10, half_marathon: 21.0975, marathon: 42.195 };
  var CANON = { halfmarathon: 'half_marathon', hm: 'half_marathon', fast5k: 'run_5k', fast10k: 'run_10k', '5k': 'run_5k', '10k': 'run_10k' };
  var SLACK = 0.05, DAY_TOL = 1;

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function canonCat(g) { var c = String((g && (g.category || g.type)) || '').toLowerCase(); return CANON[c] || c; }
  function goalDistanceKm(g) { var c = canonCat(g); return RUN_DIST_KM[c] != null ? RUN_DIST_KM[c] : null; }
  function targetSec(g) {
    if (!g) return null; var v = num(g.targetValue); if (v == null || v <= 0) return null;
    if (g.unit === 'min') return Math.round(v * 60);
    if (g.unit === 's' || g.metricType === 'time') return Math.round(v);
    return null;
  }
  function dayDiff(a, b) { try { return Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 864e5); } catch (e) { return null; } }
  function actDay(a) { return a && a.startedAt ? String(a.startedAt).slice(0, 10) : (a && a.localDate) || null; }
  function actKm(a) { var s = (a && a.summary) || {}; var m = num(s.distance_m) != null ? num(s.distance_m) : num(s.distanceM); if (m != null) return m / 1000; return num(s.distanceKm) != null ? num(s.distanceKm) : num(a && a.distanceKm); }
  function family(a) { try { if (O.runBests && O.runBests.sportFamily) return O.runBests.sportFamily(a); } catch (e) {} var n = String((a && a.sportId) || '').toLowerCase(); return n === 'running' ? 'running' : null; }
  function isDismissed(g, id) { var r = g && g.result; return !!(r && r.dismissed && Array.isArray(r.dismissed) && r.dismissed.indexOf(String(id)) >= 0); }

  function match(goal, activities, opts) {
    var o = opts || {}, g = goal || null;
    if (!g || !g.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(g.targetDate))) return null;
    var dist = goalDistanceKm(g); if (dist == null) return null;
    var slack = typeof o.slack === 'number' ? o.slack : SLACK, tol = typeof o.dayTolerance === 'number' ? o.dayTolerance : DAY_TOL;
    var isTomb = typeof o.isTombstoned === 'function' ? o.isTombstoned : null;
    var best = null;
    (Array.isArray(activities) ? activities : []).forEach(function (a) {
      if (!a || (a.status && a.status !== 'completed')) return;
      if (isTomb) { try { if (isTomb(a)) return; } catch (e) {} }
      if (family(a) !== 'running') return;
      var day = actDay(a); if (!day) return;
      var dd = dayDiff(day, g.targetDate); if (dd == null || Math.abs(dd) > tol) return;
      var km = actKm(a), sec = num(a.durationSeconds);
      if (km == null || sec == null || sec <= 0) return;
      if (km + 1e-9 < dist || km > dist * (1 + slack) + 1e-9) return;
      var id = a.clientRecordId || a.id || a.sourceRecordId || null; if (!id) return;
      if (isDismissed(g, id)) return;
      var dev = Math.abs(km - dist) + Math.abs(dd) * 1000;   /* Renntag vor Nachbartag */
      if (!best || dev < best._dev) best = { _dev: dev, activityId: String(id), date: day, distanceKm: Math.round(km * 100) / 100, timeSec: Math.round(sec) };
    });
    if (!best) return null;
    var t = targetSec(g);
    var out = { activityId: best.activityId, date: best.date, distanceKm: best.distanceKm, timeSec: best.timeSec,
      sport: 'running', goalDistanceKm: dist, targetSec: t, deltaSec: t != null ? best.timeSec - t : null,
      verdict: t == null ? 'finished' : (best.timeSec <= t ? 'achieved' : 'missed') };
    return out;
  }

  /* Ergebnis, das nach der Bestaetigung am Ziel gespeichert wird. */
  function toResult(m, now) {
    if (!m) return null;
    return { activityId: m.activityId, date: m.date, distanceKm: m.distanceKm, timeSec: m.timeSec, targetSec: m.targetSec,
      deltaSec: m.deltaSec, verdict: m.verdict, confirmedAt: now || new Date().toISOString() };
  }
  function statusFor(m) { return !m ? null : (m.verdict === 'missed' ? 'missed' : 'achieved'); }

  function pending(goal, today) {
    var g = goal || null;
    if (!g || g.status !== 'active' || !g.targetDate || g.result && g.result.verdict) return null;
    var dd = dayDiff(String(today || '').slice(0, 10), g.targetDate);
    if (dd == null || dd <= 0) return null;
    return { daysSince: dd };
  }

  /* IDs aller Aktivitaeten, die als Wettkampf zu irgendeinem Ziel passen (fuer pb-sync: Kontext 'Wettkampf'). */
  function raceActivityIds(goals, activities, opts) {
    var ids = {};
    (Array.isArray(goals) ? goals : []).forEach(function (g) {
      if (g && g.result && g.result.activityId) ids[String(g.result.activityId)] = true;
      var m = match(g, activities, opts); if (m) ids[m.activityId] = true;
    });
    return Object.keys(ids);
  }

  var api = { VERSION: VERSION, SLACK: SLACK, DAY_TOL: DAY_TOL, RUN_DIST_KM: RUN_DIST_KM,
    match: match, toResult: toResult, statusFor: statusFor, pending: pending, raceActivityIds: raceActivityIds,
    goalDistanceKm: goalDistanceKm, targetSec: targetSec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.raceResult = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
