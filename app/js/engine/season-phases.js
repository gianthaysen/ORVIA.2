/* ============================================================
   ORVIA · engine/season-phases — Saisonphasen zwischen Planstart und Zieldatum

   WOFÜR. Calc.racePhases kennt nur die letzten fünf Wochen vor dem Rennen
   (Peak 3 Wo, Taper ~2 Wo, Renntag); alles davor ist ein offenes „Aufbau".
   Für die Profil-Übersicht (Prototyp v14: „Aufbauphase · Woche 7 von 14",
   Phasen mit Wochenzahl, erledigte Phasen markiert) braucht es die GANZE
   Strecke: Basis → Aufbau → Spitze → Tapering, jede mit Dauer in Wochen.

   REGELN (klassische Periodisierung, bewusst einfach und erklärbar):
     Tapering  2 Wo  (ab 10 Wochen Gesamtdauer; 1 Wo bei 6–9; sonst 0)
     Spitze    4 Wo  (ab 16 Wochen; 3 Wo bei 10–15; 2 Wo bei 6–9; sonst 0)
     Basis/Aufbau teilen den Rest ≈ 45 % / 55 %; unter 5 Restwochen nur Aufbau.
   Die Tapering-Dauer deckt sich mit A-09 (goal-taper-resolver: taper 7–13 Tage
   + Rennwoche 0–6 Tage = 2 Wochen), damit Plan und Profil nicht widersprechen.

   Anker: Planstart = opts.startDate (z. B. Anlage des Ziels), sonst heute.
   Wochen laufen ab Planstart in 7-Tage-Schritten bis zum Renntag (inklusive).
   REIN: kein DOM, kein Date.now — alles wird injiziert. Bei fehlendem oder
   vergangenem Zieldatum: null (kein erfundener Stand).
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'season-phases@1';
  var DAY = 864e5;

  function _d(iso) { var t = Date.parse(String(iso || '').slice(0, 10) + 'T12:00:00Z'); return isNaN(t) ? null : t; }
  function _iso(ms) { return new Date(ms).toISOString().slice(0, 10); }

  function allocate(totalWeeks) {
    var W = Math.max(0, Math.round(totalWeeks));
    var taper = W >= 10 ? 2 : (W >= 6 ? 1 : 0);
    var peak = W >= 16 ? 4 : (W >= 10 ? 3 : (W >= 6 ? 2 : 0));
    var rest = Math.max(0, W - taper - peak);
    var base = rest >= 5 ? Math.round(rest * 0.45) : 0;
    var build = rest - base;
    return [{ key: 'base', n: 'Basis', weeks: base }, { key: 'build', n: 'Aufbau', weeks: build },
      { key: 'peak', n: 'Spitze', weeks: peak }, { key: 'taper', n: 'Tapering', weeks: taper }]
      .filter(function (p) { return p.weeks > 0; });
  }

  function seasonPhases(targetDate, todayISO, opts) {
    var o = opts || {};
    var race = _d(targetDate), today = _d(todayISO);
    if (race == null || today == null || race < today) return null;
    var start = _d(o.startDate); if (start == null || start > today) start = today;
    var totalDays = Math.round((race - start) / DAY) + 1;
    var totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    var alloc = allocate(totalWeeks);
    var weekIdx = Math.floor((today - start) / DAY / 7);            /* 0-basiert ab Planstart */
    var cursor = 0, phases = [], current = null;
    alloc.forEach(function (p) {
      var from = start + cursor * 7 * DAY, to = Math.min(race, start + (cursor + p.weeks) * 7 * DAY - DAY);
      var on = weekIdx >= cursor && weekIdx < cursor + p.weeks;
      var ph = { key: p.key, n: p.n, weeks: p.weeks, from: _iso(from), to: _iso(to), on: on, done: weekIdx >= cursor + p.weeks,
        week: on ? (weekIdx - cursor + 1) : null };
      if (on) current = ph;
      phases.push(ph); cursor += p.weeks;
    });
    if (!current && phases.length) { current = phases[phases.length - 1]; current.on = true; current.done = false; current.week = current.weeks; }
    return { version: VERSION, startDate: _iso(start), targetDate: _iso(race), totalWeeks: totalWeeks, weekIndex: Math.min(totalWeeks, weekIdx + 1),
      weeksToRace: Math.max(0, Math.ceil((race - today) / DAY / 7)), daysToRace: Math.round((race - today) / DAY),
      phases: phases, current: current };
  }

  var api = { VERSION: VERSION, seasonPhases: seasonPhases, allocate: allocate };
  O.seasonPhases = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
