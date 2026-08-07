/* ============================================================
   ORVIA · plan-engine-v2 — Track C (C2): „Wie sollte die Woche gebaut sein?"
   PARALLEL, NICHT AKTIV (Aktivierungsgate C8).

   Input:  { sports[] (kanonische PROFILE.sports-Einträge), goal { category,
             targetDate }, availability (kanonisch, days.mo..so), today (Date|ISO),
             constraints[], history { weeklySessionsAvg } (optional) }
   Output: { week[7] { day, available, sessions[] }, reasons[], confidence,
             volumeSummary } — Struktur, keine Scheingenauigkeit bei Minuten.

   Invarianten (C7):
   - Plan NUR auf verfügbaren Tagen (Verfügbarkeit nie ignorieren).
   - Keine Doppeleinheiten (Essential erlaubt sie nicht).
   - Keine zwei harten Tage in Folge; mindestens 1 voller Ruhetag, wenn
     weniger als 7 Tage verfügbar sind ohnehin, sonst erzwungen.
   - Anfänger: höchstens 1 harte Einheit/Woche, Gesamtzahl ≤ sessionsPerWeek.
   - Wiedereinstieg (return_after_break-Ziel): keine harte Einheit in Woche 1.
   - Wettkampf ≤ 7 Tage: Taper — reduzierte Umfänge, letzte harte Einheit
     ≥ 3 Tage vor dem Event.
   - Nur Sportarten mit includeInPlan; niemals Einheiten außerhalb der
     aktiven Sportarten; keine negativen Minuten.
   - Aktive Beschwerde ≥ 5 an Impact-Region: keine harten Impact-Einheiten.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  function C() { return O.engineContracts; }
  var WD = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
  var IMPACT = ['running', 'football', 'handball', 'basketball', 'athletics', 'tennis', 'padel', 'volleyball', 'hyrox'];

  function availableDays(av) {
    var d = av && av.days ? av.days : {};
    return WD.filter(function (k) { var day = d[k]; return day === true || !!(day && (day.available === true || (Array.isArray(day.slots) && day.slots.length > 0))); });
  }
  function maxMinutesFor(av, dayKey, fallback) {
    try { var m = av.days[dayKey].singleSession.maxMinutes; return m != null ? m : fallback; } catch (e) { return fallback; }
  }
  function daysToEvent(goal, today) {
    if (!goal || !goal.targetDate) return null;
    try {
      var t = today instanceof Date ? today : new Date(String(today || Date.now()));
      var e = new Date(String(goal.targetDate) + 'T00:00:00');
      return Math.round((e.getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5);
    } catch (e) { return null; }
  }

  function build(input) {
    input = input || {};
    var CT = C();
    var reasons = [], missing = [];
    var sports = (input.sports || []).filter(function (s) { return s && s.includeInPlan !== false && s.sportId; });
    var prim = sports.filter(function (s) { return s.role === 'primary'; })[0] || sports[0] || null;
    var avDays = availableDays(input.availability);
    var week = WD.map(function (k) { return { day: k, available: avDays.indexOf(k) >= 0, sessions: [] }; });
    if (!prim) {
      reasons.push(CT.reason('low_data_confidence', { marker: 'sports' }));
      return { week: week, reasons: reasons, confidence: 'low', volumeSummary: { sessions: 0, hard: 0 } };
    }
    if (!avDays.length) {
      reasons.push(CT.reason('availability_limited', { days: 0 }));
      return { week: week, reasons: reasons, confidence: 'low', volumeSummary: { sessions: 0, hard: 0 } };
    }
    var isBeginner = prim.level === 'beginner';
    var isReturner = !!(input.goal && input.goal.category === 'return_after_break');
    var target = prim.sessionsPerWeek != null ? prim.sessionsPerWeek : null;
    if (target == null) { missing.push('sessionsPerWeek'); target = Math.min(3, avDays.length); reasons.push(CT.reason('low_data_confidence', { marker: 'sessionsPerWeek' })); }
    var sessionsCount = Math.max(1, Math.min(target, avDays.length));
    if (avDays.length < target) reasons.push(CT.reason('availability_limited', { available: avDays.length, wanted: target }));
    // Ruhetag-Invariante: nie 7/7 planen.
    if (sessionsCount >= 7) { sessionsCount = 6; reasons.push(CT.reason('availability_limited', { forcedRestDay: true })); }
    var dte = daysToEvent(input.goal, input.today);
    var taper = dte != null && dte >= 0 && dte <= 7;
    // Harte Einheiten: Anfänger/Wiedereinstieg ≤ 1 bzw. 0; sonst grob 1 pro 3 Einheiten, max 2.
    var hardCount = isReturner ? 0 : isBeginner ? Math.min(1, Math.max(0, sessionsCount - 1) ? 1 : 0) : Math.min(2, Math.floor(sessionsCount / 3) || (sessionsCount >= 2 ? 1 : 0));
    if (isBeginner) reasons.push(CT.reason('beginner_progression', { hardPerWeek: hardCount, sessions: sessionsCount }));
    if (isReturner) reasons.push(CT.reason('return_after_break', { hardPerWeek: 0 }));
    if (taper) { hardCount = Math.min(hardCount, 1); reasons.push(CT.reason('target_event_near', { daysToEvent: dte })); }
    // Beschwerden-Gate: Impact-Hauptsport + aktive Beschwerde ≥5 an Bein/Impact-Region → keine harten Impact-Einheiten.
    var legPain = (input.constraints || []).some(function (c) { return c && (c.status === 'active') && c.intensity >= 5 && ['knee', 'ankle', 'foot', 'lower_leg', 'hip', 'thigh'].indexOf(c.bodyRegion) >= 0; });
    if (legPain && IMPACT.indexOf(prim.sportId) >= 0) { hardCount = 0; reasons.push(CT.reason('active_constraint', { planScope: true })); }
    // Einheiten auf verfügbare Tage verteilen (gleichmäßig, deterministisch).
    var chosen = [];
    if (sessionsCount >= avDays.length) chosen = avDays.slice(0, sessionsCount);
    else {
      var step = avDays.length / sessionsCount;
      for (var i = 0; i < sessionsCount; i++) { var idx = Math.min(avDays.length - 1, Math.round(i * step)); if (chosen.indexOf(avDays[idx]) >= 0) idx = Math.min(avDays.length - 1, idx + 1); chosen.push(avDays[idx]); }
      chosen = chosen.filter(function (v, i, a) { return a.indexOf(v) === i; });
      var k = 0; while (chosen.length < sessionsCount && k < avDays.length) { if (chosen.indexOf(avDays[k]) < 0) chosen.push(avDays[k]); k++; }
    }
    chosen.sort(function (a, b) { return WD.indexOf(a) - WD.indexOf(b); });
    // Harte Tage setzen: nie zwei in Folge (Kalendertage), Taper: nichts Hartes in den letzten 2 Tagen vor Event.
    var hardDays = [];
    for (var h = 0; h < chosen.length && hardDays.length < hardCount; h++) {
      var dKey = chosen[h];
      var dIdx = WD.indexOf(dKey);
      var neighborHard = hardDays.some(function (x) { return Math.abs(WD.indexOf(x) - dIdx) <= 1; });
      if (neighborHard) continue;
      if (taper && dte != null && dte - (chosen.length - 1 - h) < 3) continue;   // grobe Taper-Sperre am Wochenende vor Event
      hardDays.push(dKey);
    }
    var fallbackMin = prim.typicalDuration != null ? prim.typicalDuration : null;
    var secondary = sports.filter(function (s) { return s !== prim; });
    var si = 0;
    chosen.forEach(function (dKey, idx) {
      var hard = hardDays.indexOf(dKey) >= 0;
      // Sekundär-Sportarten bekommen jede 3. lockere Einheit (Multisport, ohne Doppeleinheiten).
      var sport = prim.sportId;
      if (!hard && secondary.length && idx % 3 === 2) { sport = secondary[si % secondary.length].sportId; si++; }
      var minutes = maxMinutesFor(input.availability, dKey, fallbackMin);
      if (taper && minutes != null) minutes = Math.max(15, Math.round(minutes * 0.6));
      var day = week[WD.indexOf(dKey)];
      day.sessions.push({ sport: sport, intensity: hard ? 'hard' : 'easy', minutes: minutes != null ? Math.max(0, minutes) : null, note: hard ? 'Qualitätseinheit' : 'Grundlage' });
    });
    if (fallbackMin == null) missing.push('typicalDuration');
    // C7: JEDE Plan-Ausgabe ist erklärbar — Strukturgrund immer voranstellen.
    reasons.unshift(CT.reason('plan_structure', { sessions: chosen.length, hard: hardDays.length, restDays: 7 - chosen.length, level: prim.level || null }));
    var conf = CT.confidenceFrom(missing, { coreCount: 3 });
    return {
      week: week,
      reasons: reasons,
      confidence: conf,
      volumeSummary: { sessions: chosen.length, hard: hardDays.length, restDays: 7 - chosen.length }
    };
  }

  O.planEngineV2 = { build: build, _availableDays: availableDays, _daysToEvent: daysToEvent };
  if (typeof module !== 'undefined' && module.exports) module.exports = O.planEngineV2;
})(typeof globalThis !== 'undefined' ? globalThis : this);
