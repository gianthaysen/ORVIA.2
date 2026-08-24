/* ============================================================
   ORVIA · engine/exercise-alternatives — B-06 (Gym-UX), Kern

   WOFÜR. „Uebung im laufenden Workout in maximal zwei Taps tauschen." Der erste
   Tap oeffnet die Liste, der zweite waehlt. Damit das traegt, muss die Liste
   KURZ und RICHTIG SORTIERT sein — die passende Alternative steht oben, nicht
   auf Platz sieben. Genau das leistet dieses Modul.

   REIN & DETERMINISTISCH. Kein DOM, keine DB, kein Date, kein Zufall. Katalog,
   Ausruestung und kuratierte Paare kommen als Argument herein. Gleiche Eingabe
   ⇒ byte-gleiche Ausgabe (stabiler Tie-Break ueber die ID).

   RANGFOLGE, in dieser Reihenfolge:
     1. KURATIERTE Paare (Tabelle `exercise_alternatives`) — eine bewusst
        gepflegte Empfehlung schlaegt jede Rechnung.
     2. MUSKELDECKUNG — Anteil der Zielmuskulatur, den die Alternative
        tatsaechlich trifft (0..1), gewichtet wie in gym-volume ('direct' = 1).
     3. GLEICHES BEWEGUNGSMUSTER als Gleichstandsloeser.
     4. ID aufsteigend — damit die Liste sich nie ohne Grund umsortiert.

   AUSRUESTUNG IST EIN FILTER, KEIN MALUS. Eine Uebung, fuer die das Geraet
   fehlt, ist im Studio nicht ausfuehrbar — sie gehoert nicht in eine
   Zwei-Tap-Liste. Sie wird ausgeschlossen und der Grund benannt, statt sie
   schlecht bewertet mitzufuehren. Ist die Ausruestung UNBEKANNT (kein
   Argument), wird NICHT gefiltert: Datenluecke ist kein Verbot.

   KEINE ERFINDUNG. Eine unbekannte Uebung liefert eine leere Liste mit Grund,
   keine geratenen Alternativen.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'exercise-alternatives@1';

  /* 'direct' -> 1.0, Zahl bleibt, alles andere 0. Lesart wie gym-volume. */
  function _w(v) {
    if (v === 'direct') return 1;
    if (v === 'indirect') return 0.5;
    return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0;
  }
  function _muscles(x) {
    var out = {}, m = (x && x.muscles) || null;
    if (m && typeof m === 'object') Object.keys(m).forEach(function (k) { var w = _w(m[k]); if (w > 0) out[k] = w; });
    return out;
  }
  function _sum(o) { var s = 0; Object.keys(o).forEach(function (k) { s += o[k]; }); return s; }

  /* Anteil der Zielmuskulatur, den `cand` abdeckt: 0..1. Ueberdeckung zaehlt
     NICHT extra — wer mehr trifft, ersetzt nicht besser. */
  function coverage(orig, cand) {
    var a = _muscles(orig), b = _muscles(cand), total = _sum(a);
    if (!total) return 0;
    var hit = 0;
    Object.keys(a).forEach(function (k) { if (b[k]) hit += Math.min(a[k], b[k]); });
    return Math.round((hit / total) * 1000) / 1000;
  }

  function _equipOk(cand, available) {
    if (!Array.isArray(available)) return true;
    var need = (cand && cand.equipment) || [];
    if (!Array.isArray(need) || !need.length) return true;
    for (var i = 0; i < need.length; i++)
      if (available.indexOf(need[i]) < 0) return false;
    return true;
  }

  function suggest(opts) {
    var o = opts || {};
    var id = o.exerciseId;
    var cat = Array.isArray(o.catalog) ? o.catalog.filter(function (e) { return e && e.id != null; }) : [];
    var base = { version: VERSION, exerciseId: id == null ? null : id, alternatives: [], excluded: [], reason: null };

    if (id == null) return Object.assign(base, { reason: 'no_exercise' });
    var orig = cat.filter(function (e) { return e.id === id; })[0] || null;
    if (!orig) return Object.assign(base, { reason: 'exercise_unknown' });
    if (cat.length < 2) return Object.assign(base, { reason: 'catalog_too_small' });

    var curatedFor = {};
    (Array.isArray(o.curated) ? o.curated : []).forEach(function (c) {
      if (c && c.exerciseId === id && c.alternativeExerciseId != null)
        curatedFor[c.alternativeExerciseId] = c.relation || 'alternative';
    });

    var excluded = [], rows = [];
    cat.forEach(function (c) {
      if (c.id === id) return;
      if (!_equipOk(c, o.equipmentAvailable)) {
        excluded.push({ id: c.id, excluded: 'equipment_unavailable' });
        return;
      }
      var cov = coverage(orig, c);
      var cur = Object.prototype.hasOwnProperty.call(curatedFor, c.id);
      var samePattern = !!(orig.pattern && c.pattern && orig.pattern === c.pattern);
      if (!cur && cov <= 0 && !samePattern) return;
      rows.push({ id: c.id, coverage: cov, curated: cur,
        relation: cur ? curatedFor[c.id] : null,
        samePattern: samePattern,
        reason: cur ? 'curated' : (cov > 0 ? 'muscle_overlap' : 'same_pattern') });
    });

    rows.sort(function (a, b) {
      if (a.curated !== b.curated) return a.curated ? -1 : 1;
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (a.samePattern !== b.samePattern) return a.samePattern ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : (String(a.id) > String(b.id) ? 1 : 0);
    });

    var lim = (typeof o.limit === 'number' && o.limit > 0) ? Math.trunc(o.limit) : 5;
    return Object.assign(base, { alternatives: rows.slice(0, lim), excluded: excluded });
  }

  var api = { VERSION: VERSION, suggest: suggest, coverage: coverage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.exerciseAlternatives = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
