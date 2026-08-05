/* ============================================================
   ORVIA · constraint-solver — S4 (Phase 7, 2026-08-05, SHADOW-ONLY).

   Liest ERSTMALS die kanonischen Verfügbarkeitsfelder, die der Live-Pfad heute
   ignoriert: availability.days[].restDay (HART) und fixedCommitments[] —
   plus maxSessionsPerWeek / maxIntenseSessions / minimumFullRestDays (HART)
   und preferredRestDays (WEICH). Drei-Ebenen-Trennung wie scheduler-input-factory
   (Hard #1/#13/#14): restDay ≠ preferredRestDay ≠ nicht verfügbar.

   Vertrag 3 (ENGINE-VERTRAEGE §3), fail-closed:
   - widersprüchliche Verfügbarkeit (restDay UND available:true) ⇒ Tag unzulässig
     + Konflikt sichtbar — NIE stille Auflösung, NIE automatisches Verschieben.
   - available:null (unbekannt) ⇒ unzulässig mit Grund — nie raten.
   - Unplatzierbares bleibt unplatziert MIT Grund; es wird nichts "irgendwo
     hingequetscht".

   Reinheit: pure + deterministisch (kein Date/Math.random/DOM/Storage; stabile
   Sortierungen). Ausgabe ist byte-stabil bei gleichem Input.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'constraint-solver-v1.0.0';
  var WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];   // KANONISCH (profile-model.js WEEKDAYS / scheduler-input-factory WEEKDAY_ORDER) — nie englische Keys
  var PRIO = { key: 0, build: 1, optional: 2 };

  /* ---- Tageszulässigkeit: HARTE Regeln + Konflikte (Vertrag 3). ---- */
  function daySlot(wd, day) {
    var s = { weekday: wd, admissible: false, reasons: [], conflicts: [],
      maxMinutes: null, maxMinutesKnown: false, intensityAllowed: null,
      doubleSession: false, preloaded: [], intenseFixedCount: 0 };
    if (!day || typeof day !== 'object') { s.reasons.push('availability_unknown'); return s; }
    var rest = day.restDay === true;
    var avail = day.available;
    if (rest && avail === true) {                                  // Widerspruch ⇒ fail-closed
      s.conflicts.push({ code: 'contradictory_rest_and_available', weekday: wd });
      s.reasons.push('contradictory_availability');
      return s;
    }
    if (rest) { s.reasons.push('rest_day'); return s; }            // HART (Hard #1)
    if (avail === false) { s.reasons.push('not_available'); return s; }
    if (avail == null) { s.reasons.push('availability_unknown'); return s; }   // nie raten
    s.admissible = true;
    var single = day.singleSession || null;
    if (single && typeof single.maxMinutes === 'number' && isFinite(single.maxMinutes) && single.maxMinutes > 0) {
      s.maxMinutes = single.maxMinutes; s.maxMinutesKnown = true;
    }
    s.intensityAllowed = (single && single.intensityAllowed) || null;
    s.doubleSession = !!(day.doubleSession && day.doubleSession.enabled);
    (Array.isArray(day.fixedCommitments) ? day.fixedCommitments : []).forEach(function (c) {
      if (!c) return;
      s.preloaded.push({ id: c.id || null, type: c.type || 'other_load', sportId: c.sportId || null,
        durationMinutes: (typeof c.durationMinutes === 'number' && isFinite(c.durationMinutes)) ? c.durationMinutes : null,
        intensity: c.intensity || null });
      if (c.intensity === 'intense' || c.type === 'match') s.intenseFixedCount++;
    });
    return s;
  }

  function admissibleSlots(availability) {
    if (!availability || !availability.days || typeof availability.days !== 'object') {
      return { ok: false, error: 'availability_missing', slots: null, conflicts: [] };
    }
    var slots = {}, conflicts = [];
    WEEKDAYS.forEach(function (wd) {
      var s = daySlot(wd, availability.days[wd]);
      slots[wd] = s;
      s.conflicts.forEach(function (c) { conflicts.push(c); });
    });
    return { ok: true, slots: slots, conflicts: conflicts, solverVersion: VERSION };
  }

  /* ---- Platzierung: deterministisch, HART vor WEICH, fail-closed. ----
     requirements: [{ id, sportId, durationMin|null, intensity:'easy'|'moderate'|'intense',
                      priority:'key'|'build'|'optional' }]
     availability: SchedulerInput-Form (siehe scheduler-input-factory). */
  function place(requirements, availability) {
    var base = admissibleSlots(availability);
    if (!base.ok) return { ok: false, error: base.error, placements: null, unplaced: null, conflicts: [] };
    var maxWeek = availability.maxSessionsPerWeek;
    var maxIntense = availability.maxIntenseSessions;
    var minFullRest = availability.minimumFullRestDays;
    var preferredRest = Array.isArray(availability.preferredRestDays) ? availability.preferredRestDays.slice() : [];

    /* Feste Termine zählen mit: intense Fixtermine belasten das Intensitätsbudget. */
    var intenseUsed = 0;
    WEEKDAYS.forEach(function (wd) { intenseUsed += base.slots[wd].intenseFixedCount; });

    var reqs = (Array.isArray(requirements) ? requirements : []).slice()
      .sort(function (a, b) {
        var pa = PRIO[a && a.priority] != null ? PRIO[a.priority] : 1;
        var pb = PRIO[b && b.priority] != null ? PRIO[b.priority] : 1;
        if (pa !== pb) return pa - pb;
        return String(a && a.id).localeCompare(String(b && b.id));   // stabil + deterministisch
      });

    var used = {}; WEEKDAYS.forEach(function (wd) { used[wd] = 0; });
    var placements = [], unplaced = [], placedCount = 0;

    function fullyFreeDays() {
      return WEEKDAYS.filter(function (wd) {
        var s = base.slots[wd];
        return used[wd] === 0 && s.preloaded.length === 0;          // frei = keine Einheit UND kein Fixtermin
      }).length;
    }
    function capacityOk(s, req) {
      if (req.durationMin == null) return true;                     // ohne Angabe keine erfundene Grenze
      if (!s.maxMinutesKnown) return true;                          // unbekannt ≠ Nullwert (Hard #18) — Flag unten
      return req.durationMin <= s.maxMinutes;
    }
    function intensityOk(s, req) {
      if (req.intensity !== 'intense') return true;
      if (s.intensityAllowed === 'intense') return true;
      if (s.intensityAllowed == null) return true;                  // unbekannt ⇒ zulassen + Flag
      return false;
    }
    function tryDay(wd, req, soft) {
      var s = base.slots[wd];
      if (!s.admissible) return null;
      var cap = s.doubleSession ? 2 : 1;
      if (used[wd] >= cap) return null;
      if (!capacityOk(s, req) || !intensityOk(s, req)) return null;
      if (!soft && preferredRest.indexOf(wd) >= 0) return null;     // WEICH: erst meiden …
      return s;
    }
    reqs.forEach(function (req) {
      req = req || {};
      if (maxWeek != null && placedCount >= maxWeek) { unplaced.push({ id: req.id || null, reason: 'max_sessions_per_week_reached' }); return; }
      if (req.intensity === 'intense' && maxIntense != null && intenseUsed >= maxIntense) {
        unplaced.push({ id: req.id || null, reason: 'max_intense_sessions_reached_incl_fixed' }); return;
      }
      var chosen = null, softUsed = false;
      for (var pass = 0; pass < 2 && !chosen; pass++) {
        for (var i = 0; i < WEEKDAYS.length && !chosen; i++) {
          var s = tryDay(WEEKDAYS[i], req, pass === 1);
          if (s) { chosen = s; softUsed = pass === 1; }
        }
      }
      if (!chosen) { unplaced.push({ id: req.id || null, reason: 'no_admissible_slot' }); return; }
      /* HART #13: minimumFullRestDays darf durch die Platzierung nicht unterschritten werden. */
      if (minFullRest != null) {
        used[chosen.weekday]++;
        var freeAfter = fullyFreeDays();
        used[chosen.weekday]--;
        if (freeAfter < minFullRest) { unplaced.push({ id: req.id || null, reason: 'minimum_full_rest_days_violated' }); return; }
      }
      used[chosen.weekday]++;
      placedCount++;
      if (req.intensity === 'intense') intenseUsed++;
      var flags = [];
      if (softUsed) flags.push('soft_preferred_rest_day_used');
      if (req.durationMin != null && !chosen.maxMinutesKnown) flags.push('day_capacity_unknown');
      if (req.intensity === 'intense' && chosen.intensityAllowed == null) flags.push('intensity_allowance_unknown');
      if (chosen.preloaded.length) flags.push('day_has_fixed_commitments');
      placements.push({ id: req.id || null, weekday: chosen.weekday, sportId: req.sportId || null,
        intensity: req.intensity || null, durationMin: req.durationMin != null ? req.durationMin : null, flags: flags });
    });
    return { ok: true, placements: placements, unplaced: unplaced, conflicts: base.conflicts,
      slots: base.slots, solverVersion: VERSION };
  }

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }
  O.constraintSolver = _freeze({ VERSION: VERSION, WEEKDAYS: WEEKDAYS.slice(), admissibleSlots: admissibleSlots, place: place });
  if (typeof module !== 'undefined' && module.exports) module.exports = O.constraintSolver;
})(typeof globalThis !== 'undefined' ? globalThis : this);
