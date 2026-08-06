/* ============================================================
   ORVIA · capacity-adapter — S3 (Phase 7, 2026-08-05): kanonische Lastserie
   → capacity.perSport (SHADOW-ONLY, steuert nichts).

   Vertrag 2 (ENGINE-VERTRAEGE-2026-08.md, Entscheidung ①):
   - EINZIGE Ist-Wahrheit ist die kanonische Tageslast (dailyLoadUnits /
     dailyLoadSeries, activity-config.js). Dieser Adapter AGGREGIERT sie nur —
     er führt KEINE neue Lastformel ein.
   - Ausgabe ist BESCHREIBENDE Ist-Kapazität (source:'observed_history') je
     Sportart in exakt der Form, die scheduler-input-factory für
     capacity.perSport erwartet. Planungskapazität (prescriptiv) bleibt
     ausschließlich Sache der Sport-Pack-Factories (running-capacity-factory).
   - Für 'running' liefert buildLoadHistoryForSport() zusätzlich die
     loadHistory-Vertragsform, die running-capacity-factory als Snapshot-Input
     validiert — Fensterinvarianten IDENTISCH zum Producer
     training-input-resolver (activeLoadDays zählt L>0 ODER unbekannte Units;
     dataDays NUR L>0; winConf-Regel identisch; chronic28 = acute7 + prior21).
   - Fehlende Daten ⇒ null + missingFields / 'not_assessable' — NIE Schätzwerte.

   Reinheit: Kern ist pure (Eingaben rein als Argumente, kein Date.now(), kein
   DOM/Storage); die I/O-Hülle buildPerSport() injiziert dailyLoadUnits/
   dayOfActLocal aus O.activityConfig. Deterministisch bei gleichen Eingaben.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'cap-adapter-v1.0.0';

  function _isFin(n) { return typeof n === 'number' && isFinite(n); }

  /* winConf — IDENTISCHE Regel wie training-input-resolver (Batch 2d):
     unknown/ambiguous > 0 oder estimatedShare > 0.5 ⇒ low; > 0.25 ⇒ medium. */
  function winConf(w) {
    var tot = w.measuredLoad + w.estimatedLoad;
    var es = tot > 0 ? w.estimatedLoad / tot : 0;
    w.estimatedShare = Math.round(es * 100) / 100;
    if (w.ambiguousUnits > 0 || w.unknownUnits > 0 || es > 0.5) return 'low';
    if (es > 0.25) return 'medium';
    return 'high';
  }

  /* PURE · entries[i] = Tag mit Offset i (0 = Bezugstag), je:
     { load, measuredLoad, estimatedLoad, unknownUnits, ambiguousUnits, hardDay }
     → recentLoad-/loadHistory-Vertragsform (siehe Producer-Kommentar oben). */
  function windowsFromDayEntries(entries) {
    if (!Array.isArray(entries) || entries.length !== 28) return null;
    var win = {
      acute7: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 },
      prior21: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 },
      chronic28: { measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, activeLoadDays: 0 }
    };
    var acute = 0, chronic = 0, dataDays = 0, oldestActiveOffset = -1;
    var hardByOffset = [];
    for (var i = 0; i < 28; i++) {
      var e = entries[i] || { load: 0, measuredLoad: 0, estimatedLoad: 0, unknownUnits: 0, ambiguousUnits: 0, hardDay: false };
      var L = _isFin(e.load) ? e.load : 0;
      if (L < 0) return null;                                    // fail-closed wie dailyLoadSeries
      var active = L > 0 || (e.unknownUnits || 0) > 0;
      if (active) oldestActiveOffset = i;
      var tgt = [win.chronic28, i < 7 ? win.acute7 : win.prior21];
      tgt.forEach(function (w) {
        w.measuredLoad += e.measuredLoad || 0; w.estimatedLoad += e.estimatedLoad || 0;
        w.unknownUnits += e.unknownUnits || 0; w.ambiguousUnits += e.ambiguousUnits || 0;
        if (active) w.activeLoadDays++;
      });
      if (L > 0) dataDays++;
      if (i < 7) acute += L;
      chronic += L;
      hardByOffset[i] = !!e.hardDay;
    }
    var streak = 0;
    for (var s = 1; s < 28 && hardByOffset[s]; s++) streak++;
    var ORDER = { high: 0, medium: 1, low: 2 };
    var ca = winConf(win.acute7), cp = winConf(win.prior21), cc = winConf(win.chronic28);
    var ratioConfidence = [ca, cp, cc].reduce(function (worst, c) { return ORDER[c] > ORDER[worst] ? c : worst; }, 'high');
    var historySpanDays = oldestActiveOffset >= 0 ? oldestActiveOffset + 1 : 0;
    var insufficientChronic = win.prior21.activeLoadDays < 4 || historySpanDays < 14;
    if (insufficientChronic) ratioConfidence = 'low';
    return {
      acute7: Math.round(acute), chronic28PerWeek: Math.round(chronic / 4), dataDays: dataDays,
      loadUnit: 'orvia_load_au',
      hardYesterday: !!hardByOffset[1], hardStreak: streak,
      estimatedShare: win.acute7.estimatedShare,
      unknownUnits: win.acute7.unknownUnits, ambiguousUnits: win.acute7.ambiguousUnits,
      quality: {
        acute7: win.acute7, prior21: win.prior21, chronic28: win.chronic28,
        acuteConfidence: ca, priorConfidence: cp, chronicConfidence: cc,
        historySpanDays: historySpanDays,
        insufficientChronicHistory: insufficientChronic,
        ratioConfidence: ratioConfidence
      },
      ratioConfidence: ratioConfidence, loadConfidence: ratioConfidence,
      source: 'canonical_activities'
    };
  }

  /* PURE · beschreibende Ist-Kapazität aus 28 Tagen: NUR Aggregation echter Werte.
     extras: { totalMinutes, minutesComplete, totalKm, kmComplete, maxSessionMinutes, sessionCount } */
  function observedCapacity(loadHistory, extras) {
    if (!loadHistory) return 'not_assessable';
    var missing = [];
    if (loadHistory.quality.chronic28.activeLoadDays === 0) return 'not_assessable';
    var weeklySessions = Math.round(extras.sessionCount / 4 * 10) / 10;
    var weeklyMinutes = extras.minutesComplete ? Math.round(extras.totalMinutes / 4) : null;
    if (!extras.minutesComplete) missing.push('duration_incomplete');
    var weeklyKm = extras.kmComplete && extras.totalKm > 0 ? Math.round(extras.totalKm / 4 * 10) / 10 : null;
    if (!extras.kmComplete) missing.push('distance_incomplete');
    return {
      weeklySessions: weeklySessions,
      weeklyMinutes: weeklyMinutes,
      weeklyDistanceKm: weeklyKm,
      weeklyLoadAU: loadHistory.chronic28PerWeek,
      longSessionCeiling: extras.maxSessionMinutes != null ? Math.round(extras.maxSessionMinutes) : null,
      confidence: loadHistory.ratioConfidence,
      missingFields: missing,
      source: 'observed_history',                                 // beschreibend, NIE prescriptiv
      adapterVersion: VERSION
    };
  }

  /* I/O-Hülle · aktivitäten+Legacy-Sessions → { perSport, loadHistoryBySport }.
     opts: { today:'YYYY-MM-DD' (Pflicht), timezone, sessionsByDay (DB-Form),
             mapSport(fn), isTombstoned(fn) }. Kanonische Formel wird INJIZIERT
     (O.activityConfig.dailyLoadUnits) — kein zweiter Rechenweg. */
  function buildPerSport(activities, opts) {
    opts = opts || {};
    var AC = opts.activityConfig || O.activityConfig;
    if (!AC || typeof AC.dailyLoadUnits !== 'function' || typeof AC.dayOfActLocal !== 'function') {
      return { ok: false, error: 'activity_config_unavailable', perSport: null };
    }
    if (!opts.today || !/^\d{4}-\d{2}-\d{2}$/.test(opts.today)) {
      return { ok: false, error: 'today_required', perSport: null };
    }
    var tz = opts.timezone || 'UTC';
    var mapSport = typeof opts.mapSport === 'function' ? opts.mapSport : function (s) { return s || 'unknown'; };
    var isTomb = typeof opts.isTombstoned === 'function' ? opts.isTombstoned : function () { return false; };
    var sessByDay = opts.sessionsByDay || {};
    function shift(day, delta) { var d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); }

    /* 🔴 P0-FIX (2026-08-06): Das Sportfeld wurde nur als `a.sport` gelesen. Die
       KANONISCHEN Aktivitäten aus activityStore.listActivities() heißen aber
       `sportId` (activity-store.js: `sportId: row.sport_id`) — `a.sport` ist dort
       schlicht undefined.

       WIRKUNG im Produktivpfad: shadow-runner reicht genau diese kanonischen
       Aktivitäten herein. mapSport(undefined) liefert einen einzigen Pseudo-Sport
       ("null"/"unknown"), unter dem ALLE Sportarten zusammenfielen. Damit fand
       scheduler-v2 unter `capacityPerSport['running']` nie etwas, setzte
       `conservative_generic_no_capacity` und baute eine generische Minimalwoche.
       Das Shadow-Gate hätte 14 Tage lang diese Minimalwoche gegen den echten Plan
       verglichen — die Datensammlung wäre wertlos gewesen, genau wie beim
       DB/RACE-Bindungsbefund vom 2026-08-05.

       Gefunden beim Prüfen der 8.3-Voraussetzung, VOR der Datensammlung.
       Reihenfolge: kanonisch zuerst, Legacy-/Testform als Rückfall. */
    function sportFieldOf(a) {
      if (!a) return null;
      if (a.sportId != null) return a.sportId;
      if (a.sport != null) return a.sport;
      if (a.sport_id != null) return a.sport_id;
      return null;
    }
    /* Aktivitäten je Sport je Tag gruppieren (kanonische Tageszuordnung). */
    var bySport = {};
    (Array.isArray(activities) ? activities : []).forEach(function (a) {
      if (!a || isTomb(a)) return;
      var sp = mapSport(sportFieldOf(a));
      var day = AC.dayOfActLocal(a, tz); if (!day) return;
      var b = bySport[sp] || (bySport[sp] = { byDay: {}, minutes: 0, minutesComplete: true, km: 0, kmComplete: true, maxMin: null, count: 0 });
      (b.byDay[day] || (b.byDay[day] = [])).push(a);
    });
    /* Legacy-Sessions: je Tag je Typ — Typ → Sport über mapSport (z. B. 'Laufen'→'running'). */
    var legacyBySport = {};
    Object.keys(sessByDay).forEach(function (day) {
      var sy = (sessByDay[day] && sessByDay[day].sessions) || {};
      Object.keys(sy).forEach(function (t) {
        if (t === '_ts') return;
        var sp = mapSport(t);
        var l = legacyBySport[sp] || (legacyBySport[sp] = {});
        (l[day] || (l[day] = {}))[t] = sy[t];
      });
    });
    var sports = {}; Object.keys(bySport).forEach(function (s) { sports[s] = 1; }); Object.keys(legacyBySport).forEach(function (s) { sports[s] = 1; });

    var perSport = {}, loadHistoryBySport = {};
    Object.keys(sports).sort().forEach(function (sp) {
      var b = bySport[sp] || { byDay: {}, minutes: 0, minutesComplete: true, km: 0, kmComplete: true, maxMin: null, count: 0 };
      var entries = [];
      for (var i = 0; i < 28; i++) {
        var day = shift(opts.today, -i);
        var dayActs = b.byDay[day] || [];
        var daySess = (legacyBySport[sp] && legacyBySport[sp][day]) || {};
        var du = AC.dailyLoadUnits(dayActs, daySess);
        entries.push({ load: du.load, measuredLoad: du.measuredLoad, estimatedLoad: du.estimatedLoad,
          unknownUnits: du.unknownUnits, ambiguousUnits: du.ambiguousUnits,
          hardDay: (du.units || []).some(function (u) { return u.hardDay; }) });
        /* Fensterstatistik für die beschreibende Kapazität — nur echte Felder. */
        dayActs.forEach(function (a) {
          b.count++;
          /* Kanonische Form: durationSeconds (activity-normalize); durationMin nur Fallback. */
          var min = _isFin(a.durationSeconds) ? a.durationSeconds / 60 : (_isFin(a.durationMin) ? a.durationMin : null);
          if (min == null) b.minutesComplete = false; else { b.minutes += min; if (b.maxMin == null || min > b.maxMin) b.maxMin = min; }
          var km = _isFin(a.distanceKm) ? a.distanceKm : null;
          if (km == null) b.kmComplete = false; else b.km += km;
        });
        Object.keys(daySess).forEach(function () { b.count++; b.minutesComplete = false; b.kmComplete = false; });
      }
      var lh = windowsFromDayEntries(entries);
      loadHistoryBySport[sp] = lh;
      perSport[sp] = observedCapacity(lh, { totalMinutes: b.minutes, minutesComplete: b.minutesComplete && b.count > 0,
        totalKm: b.km, kmComplete: b.kmComplete && b.count > 0, maxSessionMinutes: b.maxMin, sessionCount: b.count });
    });
    return { ok: true, perSport: perSport, loadHistoryBySport: loadHistoryBySport, adapterVersion: VERSION };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.capacityAdapter = _freeze({
    VERSION: VERSION,
    windowsFromDayEntries: windowsFromDayEntries,
    observedCapacity: observedCapacity,
    buildPerSport: buildPerSport
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.capacityAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : this);
