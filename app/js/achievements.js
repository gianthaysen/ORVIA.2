/* ============================================================
   ORVIA · achievements — GEMESSENE Meilensteine und Medaillen

   VERTRAG:
     • Jeder Wert entsteht durch reine Arithmetik ueber ECHTE, abgeschlossene
       Aktivitaeten (die vereinheitlichte kanonische Liste). Nichts wird
       geschaetzt, hochgerechnet oder erfunden.
     • Eine Stufe gilt als ERREICHT, wenn eine konkrete Aktivitaet bzw. ein
       konkreter Zeitraum sie belegt — mit Datum. Nicht erreichte Stufen
       zeigen den gemessenen Ist-Wert und den naechsten Schwellwert.
     • Fortschrittsbalken zeigen ausschliesslich gemessenen Ist/Soll-Quotient.
     • Ohne auswertbare Daten liefert das Modul leere Listen — die Oberflaeche
       zeigt dann weiterhin den ehrlichen Leerzustand.

   Kein DOM, kein Store, kein Supabase — reine Funktionen, in node testbar.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function normSport(v) {
    try { if (O.trainingDomain && O.trainingDomain.normSport) return O.trainingDomain.normSport(v); } catch (e) {}
    return String(v == null ? '' : v).toLowerCase();
  }
  function distanceKm(a) {
    var s = (a && a.summary) || {};
    var m = num(s.distance_m) != null ? num(s.distance_m) : num(s.distanceM);
    if (m != null) return m / 1000;
    return num(s.distanceKm);
  }
  function dayOf(a) { return (a && a.startedAt) ? String(a.startedAt).slice(0, 10) : null; }
  /* ISO-Wochenschluessel (Montag) — rein aus dem Datum, keine Zeitzonenmagie:
     der Kalendertag der Aktivitaet zaehlt. */
  function weekKey(day) {
    var d = new Date(day + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    var wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return d.toISOString().slice(0, 10);
  }

  /* Die Leitern. Schwellwerte sind sportlich uebliche Marken — sie bewerten
     nichts, sie markieren nur, WELCHE gemessene Groesse wann belegt wurde. */
  var LADDERS = [
    { id: 'run_longest', label: 'Längster Lauf', unit: ' km', icon: 'run',
      steps: [5, 10, 15, 21.1, 25, 30, 42.2],
      metric: 'maxSingle', sport: 'running' },
    { id: 'run_week_km', label: 'Lauf-Wochenumfang', unit: ' km', icon: 'activity',
      steps: [20, 30, 40, 50, 60, 80],
      metric: 'maxWeekSum', sport: 'running' },
    { id: 'ride_longest', label: 'Längste Radeinheit', unit: ' km', icon: 'activity',
      steps: [30, 50, 80, 100, 150],
      metric: 'maxSingle', sport: 'cycling' },
    { id: 'sessions_total', label: 'Einheiten gesamt', unit: '', icon: 'bolt',
      steps: [10, 25, 50, 100, 250, 500],
      metric: 'count', sport: null },
    { id: 'week_streak', label: 'Konstanz (Wochen in Folge ≥ 3 Einheiten)', unit: ' Wo.', icon: 'calendar',
      steps: [2, 4, 8, 12, 26],
      metric: 'weekStreak', sport: null }
  ];

  /* activities: vereinheitlichte kanonische Liste (Server > lokal > Legacy,
     bereits dedupliziert). Nur abgeschlossene Einheiten zaehlen. */
  function computeAchievements(activities, opts) {
    opts = opts || {};
    var acts = (Array.isArray(activities) ? activities : []).filter(function (a) {
      return a && (!a.status || a.status === 'completed') && dayOf(a);
    });
    var per = {};   /* sport -> [{day, km}] */
    var weeks = {}; /* weekKey -> {count, kmBySport} */
    acts.forEach(function (a) {
      var sp = normSport(a.sportId);
      var day = dayOf(a);
      var km = distanceKm(a);
      (per[sp] = per[sp] || []).push({ day: day, km: km });
      var wk = weekKey(day);
      if (wk) {
        var w = weeks[wk] = weeks[wk] || { count: 0, km: {} };
        w.count++;
        if (km != null) w.km[sp] = (w.km[sp] || 0) + km;
      }
    });

    function measure(l) {
      if (l.metric === 'count') {
        /* Datum der Stufe = Tag der n-ten Einheit (chronologisch). */
        var days = acts.map(dayOf).sort();
        return { value: days.length, dateForStep: function (s) { return days.length >= s ? days[s - 1] : null; } };
      }
      if (l.metric === 'maxSingle') {
        var list = (per[l.sport] || []).filter(function (x) { return x.km != null; });
        var best = null;
        list.forEach(function (x) { if (!best || x.km > best.km) best = x; });
        var sorted = list.slice().sort(function (a, b) { return a.day < b.day ? -1 : 1; });
        return { value: best ? Math.round(best.km * 10) / 10 : 0,
          dateForStep: function (s) {
            for (var i = 0; i < sorted.length; i++) if (sorted[i].km + 1e-9 >= s) return sorted[i].day;
            return null;
          } };
      }
      if (l.metric === 'maxWeekSum') {
        var rows = Object.keys(weeks).sort().map(function (wk) { return { wk: wk, km: weeks[wk].km[l.sport] || 0 }; });
        var mx = 0; rows.forEach(function (r) { if (r.km > mx) mx = r.km; });
        return { value: Math.round(mx * 10) / 10,
          dateForStep: function (s) {
            for (var i = 0; i < rows.length; i++) if (rows[i].km + 1e-9 >= s) return rows[i].wk;
            return null;
          } };
      }
      if (l.metric === 'weekStreak') {
        var keys = Object.keys(weeks).sort();
        var bestRun = 0, cur = 0, prev = null, bestEnd = null, curEnd = null;
        var stepEnd = {};   /* laenge -> Wochenschluessel, an dem diese Serienlaenge ERSTMALS stand */
        keys.forEach(function (wk) {
          var qualifies = weeks[wk].count >= 3;
          var contiguous = prev != null && (new Date(wk) - new Date(prev)) === 7 * 86400000;
          if (qualifies) { cur = (contiguous && cur > 0) ? cur + 1 : 1; curEnd = wk;
            if (!stepEnd[cur]) stepEnd[cur] = wk;
            if (cur > bestRun) { bestRun = cur; bestEnd = curEnd; } }
          else cur = 0;
          prev = wk;
        });
        return { value: bestRun, dateForStep: function (s) { return stepEnd[s] || (bestRun >= s ? bestEnd : null); } };
      }
      return { value: 0, dateForStep: function () { return null; } };
    }

    var milestones = [], medals = [];
    LADDERS.forEach(function (l) {
      var m = measure(l);
      var next = null, achieved = [];
      l.steps.forEach(function (s) {
        if (m.value + 1e-9 >= s) achieved.push({ step: s, date: m.dateForStep(s) });
        else if (next == null) next = s;
      });
      var last = achieved.length ? achieved[achieved.length - 1] : null;
      milestones.push({
        id: l.id, label: l.label, unit: l.unit, icon: l.icon,
        current: m.value, next: next, lastAchieved: last,
        progress: next != null ? Math.max(0, Math.min(100, Math.round(m.value / next * 100))) : 100,
        done: next == null && achieved.length > 0,
        assessable: m.value > 0 || acts.length > 0
      });
      achieved.forEach(function (a2) {
        medals.push({ ladderId: l.id, icon: l.icon, label: l.label,
          step: a2.step, unit: l.unit, date: a2.date,
          title: l.label + ': ' + (a2.step % 1 ? a2.step.toFixed(1).replace('.', ',') : a2.step) + l.unit });
      });
    });
    /* Neueste Medaille zuerst; Meilensteine: angefangene (mit echtem Ist) zuerst,
       danach nach Naehe zur naechsten Stufe. */
    medals.sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
    milestones.sort(function (a, b) {
      if ((b.current > 0) !== (a.current > 0)) return (b.current > 0) ? 1 : -1;
      return (b.progress - a.progress);
    });
    return { milestones: milestones, medals: medals,
      activityCount: acts.length,
      provenance: 'Gemessen aus deinen abgeschlossenen Aktivitäten — reine Arithmetik, keine Schätzung.' };
  }

  var api = { LADDERS: LADDERS, computeAchievements: computeAchievements, weekKey: weekKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.achievements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
