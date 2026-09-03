/* ============================================================
   ORVIA · engine/strength-progression — B-08 (satzgenaue Progression)

   WOFÜR. `progression@9` entscheidet ueber die WOCHENLAST (Umfang, Deload,
   Taper). Es sagt nichts darueber, ob im naechsten Krafttraining 60 oder 62,5 kg
   auf der Stange liegen. Genau diese Luecke schliesst dieses Modul — und zwar
   PRO SATZ, nicht pro Uebung: Satz 1 kann steigen, waehrend Satz 3 haelt.

   VERFAHREN: DOPPELTE PROGRESSION. Erst Wiederholungen bis zur Obergrenze des
   Zielbereichs steigern, dann Gewicht erhoehen und Wiederholungen auf die
   Untergrenze zuruecksetzen. Das ist das im Krafttraining am breitesten
   belegte, robusteste Schema fuer Fortgeschrittene und braucht keine
   1RM-Schaetzung — die waere aus Trainingssaetzen ohnehin unsicher.

   ANSTRENGUNG DECKELT DIE STEIGERUNG. Wurde die Obergrenze nur mit RIR 0
   erreicht (nichts mehr in Reserve), wird NICHT gesteigert. Sonst empfiehlt
   das Modul eine Erhoehung genau dann, wenn der Satz schon am Limit lief —
   der sicherste Weg in Fehlversuche und Technikverlust. Fehlt die RIR-Angabe,
   wird sie NICHT geraten: dann gilt die Steigerung als unbelegt und der Satz
   haelt (`rir_unknown`) — dieselbe Regel wie in progression@9: „Historie kann
   eine Steigerung nicht begruenden — sie kann sie nur verhindern."

   STAGNATION IST EIN BEFUND, KEIN FEHLER. Bleiben Gewicht UND Wiederholungen
   ueber mehrere Einheiten unveraendert, empfiehlt das Modul eine Reduktion
   (Deload) statt weiter gegen die Wand zu laufen. Der Schwellwert ist ein
   Parameter, keine versteckte Konstante.

   REIN & DETERMINISTISCH. Kein DOM, kein Date, kein Zufall. Ganzzahl-
   Arithmetik in Hundertsteln gegen Gleitkommadrift (2,5 / 1,25 kg).
   „Datenluecke != Wert": fehlt Gewicht oder Wiederholung, gibt es KEINE
   Empfehlung fuer diesen Satz, sondern `no_data`.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'strength-progression@1';

  var DEFAULT_RANGE = { min: 6, max: 10 };
  var DEFAULT_INCREMENT = 2.5;          /* kleinste sinnvolle Laststufe (kg) */
  var DEFAULT_STAGNATION = 3;           /* Einheiten ohne Fortschritt bis Deload */
  var DELOAD_FACTOR = 0.9;              /* -10 %, konservativ und ueblich */

  function _num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function _c(x) { return Math.round(x * 100); }
  function _r2(x) { return Math.round(x * 100) / 100; }

  /* Auf ein Vielfaches des Inkrements ABRUNDEN — nie mehr empfehlen, als
     ladbar ist (dieselbe Haltung wie im Scheibenrechner, B-07). */
  function _toStep(kg, increment) {
    var i = _c(increment); if (i <= 0) return _r2(kg);
    return _r2((Math.floor(_c(kg) / i) * i) / 100);
  }

  /* Ein Satz, eine Empfehlung. */
  function suggestSet(opts) {
    var o = opts || {};
    var range = o.repRange || DEFAULT_RANGE;
    var min = _num(range.min), max = _num(range.max);
    var inc = _num(o.increment); if (inc == null || inc <= 0) inc = DEFAULT_INCREMENT;
    var w = _num(o.weight), reps = _num(o.reps), rir = _num(o.rir);

    var base = { setNumber: o.setNumber != null ? o.setNumber : null,
      weight: null, reps: null, action: null, reason: null };

    if (min == null || max == null || min > max) return Object.assign(base, { action: 'none', reason: 'range_invalid' });
    if (w == null || reps == null)               return Object.assign(base, { action: 'none', reason: 'no_data' });

    /* Stagnation schlaegt alles: lieber reduzieren als weiter anrennen. */
    if (o.stagnant === true)
      return Object.assign(base, { weight: _toStep(w * DELOAD_FACTOR, inc), reps: min,
        action: 'deload', reason: 'stagnation' });

    if (reps < min)
      return Object.assign(base, { weight: _toStep(Math.max(0, w - inc), inc), reps: min,
        action: 'reduce', reason: 'below_range' });

    if (reps >= max) {
      if (rir == null)
        return Object.assign(base, { weight: _r2(w), reps: max, action: 'hold', reason: 'rir_unknown' });
      if (rir < 1)
        return Object.assign(base, { weight: _r2(w), reps: max, action: 'hold', reason: 'effort_capped' });
      return Object.assign(base, { weight: _toStep(w + inc, inc), reps: min,
        action: 'increase', reason: 'range_topped' });
    }

    /* Innerhalb des Bereichs: Gewicht halten, eine Wiederholung mehr. */
    return Object.assign(base, { weight: _r2(w), reps: Math.min(max, reps + 1),
      action: 'hold', reason: 'within_range' });
  }

  /* Stagnation ueber die Historie: Gewicht UND Wiederholungen unveraendert in
     den letzten `n` Einheiten (je Satznummer betrachtet). Weniger als `n`
     Einheiten ⇒ keine Aussage (false), nicht „stagniert". */
  function isStagnant(history, setNumber, n) {
    var k = (typeof n === 'number' && n > 1) ? Math.trunc(n) : DEFAULT_STAGNATION;
    var vals = (Array.isArray(history) ? history : []).map(function (s) {
      var sets = (s && Array.isArray(s.sets)) ? s.sets : [];
      return sets.filter(function (x) { return x && x.setNumber === setNumber; })[0] || null;
    }).filter(Boolean).slice(-k);
    if (vals.length < k) return false;
    var w0 = _num(vals[0].weight), r0 = _num(vals[0].reps);
    if (w0 == null || r0 == null) return false;
    return vals.every(function (v) { return _num(v.weight) === w0 && _num(v.reps) === r0; });
  }

  /* Ganze Uebung: letzte Einheit als Grundlage, Stagnation je Satznummer. */
  function suggest(opts) {
    var o = opts || {};
    var hist = Array.isArray(o.history) ? o.history.filter(function (s) { return s && Array.isArray(s.sets); }) : [];
    var base = { version: VERSION, perSet: [], reason: null };
    if (!hist.length) return Object.assign(base, { reason: 'no_history' });

    var last = hist[hist.length - 1];
    if (!last.sets.length) return Object.assign(base, { reason: 'no_sets' });

    var perSet = last.sets.map(function (s) {
      var sn = s && s.setNumber != null ? s.setNumber : null;
      return suggestSet({ setNumber: sn, weight: s && s.weight, reps: s && s.reps, rir: s && s.rir,
        repRange: o.repRange, increment: o.increment,
        stagnant: sn == null ? false : isStagnant(hist, sn, o.stagnationSessions) });
    });
    return Object.assign(base, { perSet: perSet });
  }

  var api = { VERSION: VERSION, DEFAULT_RANGE: DEFAULT_RANGE, DEFAULT_INCREMENT: DEFAULT_INCREMENT,
    DEFAULT_STAGNATION: DEFAULT_STAGNATION, DELOAD_FACTOR: DELOAD_FACTOR,
    suggestSet: suggestSet, isStagnant: isStagnant, suggest: suggest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.strengthProgression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
