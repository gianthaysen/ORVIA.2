/* ============================================================
   ORVIA · engine/plate-calculator — B-07 (Gym-UX)

   WOFÜR. Aus der Satzansicht heraus beantwortet der Rechner die eine Frage,
   die im Studio jeder von Hand rechnet: „Welche Scheiben pro Seite ergeben
   dieses Gewicht?" — mit konfigurierbarer Hantelstange und in kg oder lb.

   REIN & DETERMINISTISCH. Kein DOM, kein Date, kein Zufall, kein Storage.
   Gleiche Eingabe ⇒ byte-gleiche Ausgabe. Damit ist die Rundungslogik — der
   eigentlich fehleranfaellige Teil — vollstaendig testbar (DoD B-07).

   RUNDUNG. Selten geht ein Zielgewicht exakt auf. Der Rechner rundet
   konservativ NACH UNTEN auf das groesste mit den vorhandenen Scheiben
   erreichbare Gewicht, das das Ziel nicht ueberschreitet (im Studio laedt man
   nicht versehentlich mehr auf) — und meldet die Differenz ehrlich, statt ein
   „passt schon" vorzutaeuschen. `exact:false` + `delta<0` macht sichtbar, dass
   das Ziel mit diesem Scheibensatz nicht punktgenau ladbar ist.

   GANZZAHL-ARITHMETIK. Scheiben wie 1.25 oder 0.25 kg erzeugen in Gleitkomma
   die bekannten 0.1+0.2-Fehler. Intern wird deshalb in Hundertsteln gerechnet
   (×100 → Ganzzahl), erst die Ausgabe konvertiert zurueck. „Datenluecke ≠ Wert":
   ein unmoegliches Ziel liefert feasible:false mit Grund, keinen geratenen Plan.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'plate-calculator@1';

  /* Uebliche Studio-Saetze. Bewusst ohne Mikroscheiben < 1.25 kg / < 1.25 lb im
     Default — wer sie hat, gibt sie explizit mit. */
  var DEFAULTS = {
    kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
    lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] }
  };

  function _num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  /* In Hundertstel-Ganzzahl, sauber gerundet (vermeidet 249.99999). */
  function _c(x) { return Math.round(x * 100); }

  /* compute({ target, bar, unit, plates }) → Ergebnisobjekt (siehe unten). */
  function compute(opts) {
    var o = opts || {};
    var unit = (o.unit === 'lb') ? 'lb' : 'kg';
    var def = DEFAULTS[unit];

    var target = _num(o.target);
    var bar = _num(o.bar); if (bar == null) bar = def.bar;
    var platesIn = Array.isArray(o.plates) && o.plates.length ? o.plates : def.plates;

    /* Scheiben normalisieren: nur positive Zahlen, absteigend, dedupliziert. */
    var plates = platesIn.map(_num).filter(function (p) { return p != null && p > 0; })
      .sort(function (a, b) { return b - a; });
    plates = plates.filter(function (p, i) { return i === 0 || p !== plates[i - 1]; });

    var base = { version: VERSION, unit: unit, bar: bar, target: target,
      perSide: [], achieved: null, delta: null, exact: false, feasible: false, reason: null };

    if (target == null || bar == null || bar < 0)
      return Object.assign(base, { reason: 'invalid_input' });
    if (!plates.length)
      return Object.assign(base, { reason: 'no_plates' });
    if (_c(target) < _c(bar))
      return Object.assign(base, { reason: 'below_bar', achieved: bar, delta: _round2(target - bar) });

    /* Ab hier in Hundersteln. Pro Seite ist die Haelfte des Ueberschusses ueber
       die Stange zu laden — die Stange traegt beide Seiten. */
    var perSideC = Math.floor((_c(target) - _c(bar)) / 2);   // floor: nie ueber Ziel
    var platesC = plates.map(_c);

    var perSide = [], rest = perSideC;
    for (var i = 0; i < platesC.length; i++) {
      var n = Math.floor(rest / platesC[i]);
      if (n > 0) { perSide.push({ plate: plates[i], count: n }); rest -= n * platesC[i]; }
    }

    var loadedPerSideC = perSideC - rest;
    var achievedC = _c(bar) + 2 * loadedPerSideC;
    var achieved = achievedC / 100;
    var delta = _round2((achievedC - _c(target)) / 100);   // <= 0

    return Object.assign(base, {
      feasible: true,
      perSide: perSide,
      achieved: achieved,
      delta: delta,
      exact: delta === 0
    });
  }

  function _round2(x) { return Math.round(x * 100) / 100; }

  /* Kompakte Textform fuer die Satzansicht: „2×20 + 1×5 je Seite". */
  function describe(res) {
    if (!res || !res.feasible) return null;
    if (!res.perSide.length) return 'nur Stange (' + res.bar + ' ' + res.unit + ')';
    return res.perSide.map(function (p) { return p.count + '×' + p.plate; }).join(' + ')
      + ' je Seite';
  }

  var api = { VERSION: VERSION, DEFAULTS: DEFAULTS, compute: compute, describe: describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.plateCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
