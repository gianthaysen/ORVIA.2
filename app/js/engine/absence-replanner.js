/* ============================================================
   ORVIA · engine/absence-replanner — B-09 Ausfall-/Krankheitslogik (Woche)

   WOFÜR. Band 1, B-09: „Krank/verpasst-Meldung; Plan-Neuberechnung (Woche
   strecken vs. kürzen), Interaktion mit Taper." DoD: „Alle definierten
   Ausfallszenarien erzeugen einen gültigen Folgeplan; kein Plan-Totalverlust."

   WAS ES SCHON GIBT — und was nicht. progression@9 regelt die WOCHENLAST
   nach einer Unterbrechung (Krankheit: Symptomfreiheit zuerst, kein
   Einstiegsprozent). Calc.adaptWeekPlan regelt den HEUTIGEN Tag (harte
   Einheit bei ORANGE/RED verschieben) und schreibt bei Krankheit nur eine
   Notiz „REBUILD_WEEK" — gebaut wird nichts. Calc.illnessReturnWindow
   deckelt den Tageszustand nach Krankheit. Die Luecke: der REST DER WOCHE
   stand mit Intervallen und Long Run da, waehrend der Nutzer krank im Bett
   lag, und verpasste Kernreize verschwanden still.

   DIESES MODUL rechnet aus einem Wochenplan (Mo..So) und einer Ausfall-
   Meldung den gueltigen Restwochenplan — rein, nicht persistierend, im
   Lesepfad (wie goal-phase-plan). Es faellt NIE auf null zurueck.

   REGELN (konservativ, aus dem Coaching-Konsens; Zahlen sind Annahmen):
   - Krank HEUTE: heute frei; die restliche Woche verliert jeden harten Reiz
     (Intervalle/Tempo → Z2, Long Run/Long Ride fallen weg, Kraft → Mobility).
     Strategie „kuerzen": nichts wird nachgeholt. Liegt ein Rennen in dieser
     Woche oder ist Rennwoche: raceAtRisk — die Entscheidung trifft der Mensch.
   - Nach Krankheit (Symptomfrei seit N Tagen, Dauer D): Rueckkehrfenster
     min(max(D,1),7) Tage (dieselbe Laenge wie Calc.illnessReturnWindow).
     Innerhalb des Fensters keine harten Einheiten, Long Run wird kurz und
     locker, Kraft leicht. Danach unveraendert. Nichts nachholen.
   - Verletzung (aktiv): Laufen (Aufprall) faellt weg → Mobility; beinlastige
     Kraft → Oberkoerper; Rad/Schwimmen bleiben. Rueckkehr ueber Kriterien
     (progression@9), nicht ueber Prozent.
   - Verpasst (Kernreiz an einem vergangenen Tag dieser Woche nicht gemacht):
     in `build` wird HOECHSTENS EIN Kernreiz nachgeholt — auf einen freien
     spaeteren Tag mit >= 1 Tag Abstand zu jedem harten Tag, nie am Vortag
     des Rennens, nie nach dem Rennen. Alle weiteren verpassten Reize werden
     gestrichen (Woche bleibt realistisch, kein Stapeln). In taper/race_week
     wird NICHTS nachgeholt — ein Taper ist Frische, ein verpasster Reiz
     darin ist kein Verlust.
   - Nie zwei harte Tage hintereinander ERZEUGEN. Nie mehr Einheiten als im
     Eingabeplan. Eingabe wird nicht mutiert.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'absence-replanner@2';

  function _kind(it) {
    if (!it || typeof it !== 'object') return null;
    var l = String(it.l || '').toLowerCase(), d = it.d;
    if (it.t === 'Gym') return /bein|ganzk|squat|leg/.test(l) ? 'gym_leg' : 'gym';
    if (it.t === 'Mobilität') return 'mob';
    if (it.t === 'Schwimmen') return 'swim';
    if (it.t === 'Rad') return /long/.test(l) ? 'bike_long' : (/interval/.test(l) ? 'bike_hard' : 'bike');
    if (it.t !== 'Laufen') return 'other';
    if (d === 'iv' || l.indexOf('interval') >= 0) return 'interval';
    if (d === 'lr' || l.indexOf('long') >= 0) return 'long';
    if (l.indexOf('tempo') >= 0 || l.indexOf('schwelle') >= 0) return 'tempo';
    return 'easy';
  }
  var HARD = { interval: 1, tempo: 1, long: 1, bike_long: 1, bike_hard: 1 };
  var KEY = HARD;
  function _isHard(it) { return !!HARD[_kind(it)]; }
  function _mob() { return { t: 'Mobilität', l: 'Mobility', d: '15 min', absenceAdjusted: true }; }
  function _easyRun(label) { return { t: 'Laufen', l: label || 'Z2 Dauerlauf', d: 'ez', absenceAdjusted: true }; }
  function _copy(it, patch) { return Object.assign({}, it, patch || {}, { absenceAdjusted: true }); }
  function _int(x) { return (typeof x === 'number' && isFinite(x)) ? Math.trunc(x) : null; }

  /* harte Einheit → lockere Variante (Rueckkehrfenster / krank) */
  function _soften(it, note, day) {
    var k = _kind(it);
    if (k === 'interval' || k === 'tempo') { note(day, 'softened', it); return _easyRun('Z2 Dauerlauf'); }
    if (k === 'long')      { note(day, 'softened', it); return _easyRun('Z2 Dauerlauf kurz'); }
    if (k === 'bike_long' || k === 'bike_hard') { note(day, 'softened', it); return _copy(it, { l: 'Easy Z2', d: '45 min' }); }
    if (k === 'gym' || k === 'gym_leg') { note(day, 'lightened', it); return _copy(it, { l: String(it.l) + ' · leicht' }); }
    return it;
  }

  /* replan(days, ctx) → { days, changed, changes[], strategy, raceAtRisk, notes[] }
       ctx: { todayIndex, illness:{activeToday, sinceEnd, duration}, injury:{active},
              missed:[dayIdx…], phase, raceDayIndex } */
  function replan(days, ctx) {
    var c = ctx || {};
    var out = { days: days, changed: false, changes: [], strategy: null, raceAtRisk: false, notes: [], version: VERSION };
    if (!Array.isArray(days) || days.length !== 7) return out;
    var today = _int(c.todayIndex); if (today == null || today < 0 || today > 6) today = 0;
    var ill = c.illness || {}, inj = c.injury || {};
    var illToday = ill.activeToday === true;
    var sinceEnd = _int(ill.sinceEnd), dur = _int(ill.duration);
    var afterIll = !illToday && sinceEnd != null && sinceEnd >= 1 && dur != null && dur >= 1;
    var injury = inj.active === true;
    var missed = (Array.isArray(c.missed) ? c.missed : []).map(_int).filter(function (d) { return d != null && d >= 0 && d < today; });
    var phase = c.phase || null;
    var raceIdx = _int(c.raceDayIndex);
    if (!illToday && !afterIll && !injury && !missed.length) return out;

    var w = days.map(function (d) { return Array.isArray(d) ? d.slice() : []; });
    var changes = [];
    var note = function (day, what, it) { changes.push({ day: day, what: what, label: it ? (it.l || null) : null }); };
    var strategy = null;

    /* 1 · krank heute */
    if (illToday) {
      strategy = 'shorten';
      if (w[today].length) { note(today, 'cleared_sick', null); w[today] = []; }
      for (var d = today + 1; d < 7; d++) {
        w[d] = w[d].map(function (it) {
          var k = _kind(it);
          if (k === 'long' || k === 'bike_long') { note(d, 'removed', it); return null; }
          if (k === 'interval' || k === 'tempo' || k === 'bike_hard') return _soften(it, note, d);
          if (k === 'gym' || k === 'gym_leg') { note(d, 'replaced', it); return _mob(); }
          return it;
        }).filter(Boolean);
      }
      if (phase === 'race_week' || raceIdx != null) { out.raceAtRisk = true; out.notes.push('race_at_risk_illness'); }
      out.notes.push('sick_today_no_hard_sessions');
    }

    /* 2 · Rueckkehrfenster nach Krankheit */
    if (afterIll) {
      strategy = strategy || 'shorten';
      var win = Math.min(Math.max(dur, 1), 7);
      for (var e = today; e < 7; e++) {
        var daysAfterEnd = sinceEnd + (e - today);
        if (daysAfterEnd > win) break;
        w[e] = w[e].map(function (it) { return _isHard(it) || _kind(it) === 'gym' || _kind(it) === 'gym_leg' ? _soften(it, note, e) : it; });
      }
      out.notes.push('return_window_' + win + 'd');
    }

    /* 3 · Verletzung: kein Aufprall */
    if (injury) {
      strategy = strategy || 'shorten';
      for (var f = today; f < 7; f++) {
        w[f] = w[f].map(function (it) {
          var k = _kind(it);
          if (it.t === 'Laufen') { note(f, 'replaced_no_impact', it); return _mob(); }
          if (k === 'gym_leg') { note(f, 'replaced_no_leg', it); return _copy(it, { l: 'Oberkörper' }); }
          return it;
        });
      }
      out.notes.push('injury_criteria_return');
    }

    /* 4 · verpasste Kernreize (nur wenn heute nichts dagegen spricht) */
    if (missed.length && !illToday && !afterIll && !injury) {
      var keys = [];
      missed.sort(function (a, b) { return a - b; }).forEach(function (md) {
        (days[md] || []).forEach(function (it) { if (KEY[_kind(it)]) keys.push({ day: md, it: it }); });
      });
      if (!keys.length) { out.notes.push('missed_no_key_session'); }
      else if (phase === 'taper' || phase === 'race_week') {
        strategy = 'drop';
        keys.forEach(function (k) { note(k.day, 'dropped_taper', k.it); });
        out.notes.push('taper_no_catchup');
      } else {
        strategy = 'reinsert';
        var placed = false;
        var hardDay = function (x) { return x >= 0 && x < 7 && w[x].some(_isHard); };
        keys.forEach(function (k) {
          if (placed) { note(k.day, 'dropped_extra', k.it); return; }
          for (var t = today + 1; t < 7; t++) {
            if (w[t].length) continue;
            if (raceIdx != null && t >= raceIdx - 1) break;
            if (hardDay(t - 1) || hardDay(t + 1)) continue;
            w[t] = [_copy(k.it, { l: String(k.it.l) + ' · nachgeholt' })];
            note(t, 'reinserted', k.it); placed = true; break;
          }
          if (!placed) note(k.day, 'dropped_no_slot', k.it);
        });
        if (!placed) { strategy = 'drop'; out.notes.push('missed_no_slot'); }
      }
    }

    out.days = w; out.changes = changes; out.changed = changes.length > 0; out.strategy = strategy;
    return out;
  }

  /* Aus der Tages-Historie (heute zuerst) eine Krankheits-Episode ableiten.
     illFlags: [heute, gestern, vorgestern, …] als boolean. */
  function illnessFromHistory(illFlags) {
    var f = Array.isArray(illFlags) ? illFlags.map(Boolean) : [];
    if (!f.length) return { activeToday: false, sinceEnd: null, duration: 0 };
    if (f[0]) { var n = 0; while (n < f.length && f[n]) n++; return { activeToday: true, sinceEnd: 0, duration: n }; }
    var i = 0; while (i < f.length && !f[i]) i++;
    if (i >= f.length) return { activeToday: false, sinceEnd: null, duration: 0 };
    var m = 0; while (i + m < f.length && f[i + m]) m++;
    return { activeToday: false, sinceEnd: i, duration: m };
  }

  /* Verletzung aus den Beschwerden des Profils ableiten (constraintsList). „Verletzt"
     im Sinne dieses Moduls = Aufprall (Laufen) heute nicht sinnvoll. Kriterien,
     jedes fuer sich hinreichend, alle nur bei status 'active':
       - currentlyTrainable === false (ausdrueckliche Nutzerangabe)
       - Laufen unter affectedActivities
       - Region der unteren Extremitaet UND Intensitaet >= 7 (von 10)
     Alles andere (Schulter 4/10, „beobachtet") ist KEINE Verletzung — sonst
     verloere jeder mit einer Notiz seinen Laufplan. */
  var LOWER = { hip: 1, thigh: 1, knee: 1, lower_leg: 1, ankle: 1, foot: 1 };
  function injuryFromConstraints(list) {
    var arr = Array.isArray(list) ? list : [], hits = [];
    arr.forEach(function (c) {
      if (!c || c.status !== 'active') return;
      var it = (c.intensity != null) ? parseInt(c.intensity, 10) : null;
      var aff = Array.isArray(c.affectedActivities) ? c.affectedActivities : [];
      var why = c.currentlyTrainable === false ? 'not_trainable'
        : (aff.indexOf('running') >= 0 ? 'affects_running'
        : (LOWER[c.bodyRegion] && it != null && it >= 7 ? 'lower_body_high' : null));
      if (why) hits.push({ id: c.id || null, bodyRegion: c.bodyRegion || null, intensity: it, why: why });
    });
    return { active: hits.length > 0, hits: hits };
  }

  var api = { VERSION: VERSION, replan: replan, illnessFromHistory: illnessFromHistory, injuryFromConstraints: injuryFromConstraints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.absenceReplanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
