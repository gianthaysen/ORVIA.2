/* ============================================================
   ORVIA · goal-taper-resolver — A-09

   WOFÜR. Zwei Teile existieren, verbunden waren sie nie: progression.js WEISS,
   wie ein Taper aussieht (phase === 'taper' → metaanalytische −40…−60 %
   Volumenreduktion bei erhaltener Intensität), und race.js LIEST das Zieldatum
   — aber nur fuer Hinweistexte. Niemand LEITET aus dem Zieldatum die
   Trainingsphase ab und reicht sie an die Engine. Dieser Resolver schliesst die
   Luecke: aus dem Zieldatum des Hauptziels (mainGoalOf, seit A-06 kanonisch)
   wird die Phase im Vokabular, das progression versteht.

   BEOBACHTER, NICHT STEUERND. In Phase A wird die Phase nur AUFGELOEST und
   protokolliert (ORVIA._lastTaperPhase). Sie SCHARF zu schalten — also den Plan
   wirklich zu reduzieren — ist ausdruecklich B-01 („Taper (A-09) scharf
   schalten"). Hier entsteht der Beleg, dass die Ableitung korrekt auf das Datum
   reagiert, bevor sie etwas veraendert.

   GRENZEN WIE IN race.js. Die Tagesgrenzen (race_week ≤6, taper 7…13) sind
   dieselben, die race.js fuer seine Hinweise nutzt — bewusst deckungsgleich,
   damit Anzeige und kuenftige Steuerung nicht auseinanderlaufen. Die
   Zusammenfuehrung zu EINER Quelle gehoert in B-01; bis dahin haelt der Test
   `A6` beide Grenzen gegeneinander.

   REIN. `today` kommt herein — kein `new Date()` im Rechenweg, damit die
   Ableitung testbar und reproduzierbar bleibt.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'goal-taper-resolver@1';

  /* Grenzen in Tagen bis zum Wettkampf. Deckungsgleich mit race.js. */
  var RACE_WEEK_MAX = 6;   // 0..6 Tage  → Wettkampfwoche
  var TAPER_MAX     = 13;  // 7..13 Tage → Taper (klassisch ~2 Wochen)

  /* Dieselbe Arithmetik wie ui.js daysTo — bewusst gespiegelt statt importiert,
     weil daysTo im UI lebt und dieser Resolver ohne DOM auskommen muss. */
  function daysBetween(today, date) {
    if (!today || !date) return null;
    var a = new Date(date + 'T00:00'), b = new Date(today + 'T00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((a - b) / 864e5);
  }

  /* Aus Zieldatum + heute die Phase ableiten. Rueckgabe IMMER ein Objekt.
     phase ist null, wenn keine Ableitung moeglich/sinnvoll ist — das ist eine
     Aussage, kein Fehler. */
  function resolve(opts) {
    opts = opts || {};
    var today = opts.today || null;
    var date = opts.targetDate || null;
    if (!date) return { phase: null, daysToRace: null, active: false, reason: 'no_target_date', version: VERSION };

    var d = daysBetween(today, date);
    if (d == null) return { phase: null, daysToRace: null, active: false, reason: 'unreadable_date', version: VERSION };
    if (d < 0)     return { phase: null, daysToRace: d, active: false, reason: 'race_passed', version: VERSION };

    var phase;
    if (d <= RACE_WEEK_MAX) phase = 'race_week';
    else if (d <= TAPER_MAX) phase = 'taper';
    else phase = 'build';   // ausserhalb des Taper-Fensters: keine geplante Absenkung

    return {
      phase: phase,
      daysToRace: d,
      /* „active" heisst: die Phase begruendet eine geplante Absenkung. `build`
         ist eine echte Phase, aber KEINE Absenkung — deshalb active:false. */
      active: phase === 'race_week' || phase === 'taper',
      /* progression fuehrt race_week/race_taper als eigene Freigabegruende; der
         Reduktions-Rechenweg dort haengt an phase === 'taper'. Wir geben beide
         mit, damit die kuenftige Steuerung (B-01) nicht raten muss. */
      progressionPhase: phase === 'race_week' ? 'race_week' : (phase === 'taper' ? 'taper' : null),
      reason: null,
      version: VERSION
    };
  }

  /* Aus dem Zielobjekt bequem ableiten (nimmt targetDate ODER raceDate). */
  function fromGoal(goal, today) {
    var g = goal || {};
    return resolve({ targetDate: g.targetDate || g.raceDate || null, today: today || null });
  }

  var api = {
    VERSION: VERSION, RACE_WEEK_MAX: RACE_WEEK_MAX, TAPER_MAX: TAPER_MAX,
    daysBetween: daysBetween, resolve: resolve, fromGoal: fromGoal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalTaperResolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
