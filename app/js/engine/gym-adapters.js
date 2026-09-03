/* ============================================================
   ORVIA · engine/gym-adapters — Phase B, Gym-Strang (B-05/06/08)

   WOFÜR. Die vier Gym-Module (superset-model, exercise-alternatives,
   plate-calculator, strength-progression) sind REIN: sie kennen weder die
   Datenbankzeilen (`workout_exercises`, `workout_sets`, `exercises`) noch den
   Store-Baum des Players. Diese Datei ist die EINZIGE Stelle, an der die
   App-Datenformen in die Modul-Eingaben uebersetzt werden. Damit bleibt die
   Kopplung an einem Ort — aendert sich eine Spalte, aendert sich genau
   diese Datei, nicht vier Module und nicht die UI.

   REIN & DETERMINISTISCH. Kein DOM, kein Date.now, kein Netz. Alles, was
   von aussen kommt (Muskelzuordnung), wird INJIZIERT, nicht importiert —
   so laesst sich jede Uebersetzung ohne Laufzeit testen.

   „Datenluecke != Wert": fehlende Felder werden als null weitergereicht,
   nie durch Annahmen ersetzt. Unvollstaendige Zeilen fallen aus, statt
   erfundene Werte zu erzeugen.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'gym-adapters@1';

  function _num(x) { return (typeof x === 'number' && isFinite(x)) ? x : (x != null && x !== '' && isFinite(+x) ? +x : null); }
  function _int(x) { var n = _num(x); return n == null ? null : Math.trunc(n); }

  /* Satztypen, die fuer die Progression NICHT zaehlen: Aufwaermen, Technik,
     Test. Ein Aufwaermsatz mit 40 kg darf nie als „Satz 1 stagniert bei 40 kg"
     gelesen werden. Gleiche Lesart wie gym-volume.NONCOUNT_TYPES. */
  var NONPROGRESSION_TYPES = { warmup: true, technique: true, test: true };

  /* ---------- B-08: workout_exercises(+session,+workout_sets) → history ----------
     Eingabe: Zeilen wie sie workoutRepository.getPreviousExercisePerformance
     liest: { session:{local_date,status}, workout_sets:[{set_number,set_type,
     weight,reps,rir,completed}] }. Ausgabe: strength-progression.suggest-Form
       [{ date, sets:[{ setNumber, weight, reps, rir }] }]  — AUFSTEIGEND nach
     Datum (die letzte Einheit ist die Grundlage), nur ABGESCHLOSSENE
     Sessions, nur abgeschlossene, zaehlbare Saetze. Satznummern werden NEU
     durchnummeriert (1..n) ueber die zaehlbaren Saetze, damit Satz 1 ueber
     Einheiten hinweg vergleichbar bleibt, auch wenn mal ein Aufwaermsatz
     davor lag und mal nicht. */
  function historyFromExerciseRows(rows, opts) {
    var o = opts || {};
    var before = typeof o.beforeDate === 'string' ? o.beforeDate : null;
    var limit = (typeof o.limit === 'number' && o.limit > 0) ? Math.trunc(o.limit) : 6;
    var list = (Array.isArray(rows) ? rows : []).filter(function (r) {
      var s = r && r.session;
      if (!s || s.status !== 'completed' || typeof s.local_date !== 'string') return false;
      return !before || s.local_date < before;
    }).map(function (r) {
      var raw = (Array.isArray(r.workout_sets) ? r.workout_sets : []).slice()
        .sort(function (a, b) { return (_int(a && a.set_number) || 0) - (_int(b && b.set_number) || 0); })
        .filter(function (s) {
          if (!s || s.completed !== true) return false;
          var t = s.set_type || 'working';
          return !NONPROGRESSION_TYPES[t];
        });
      return { date: r.session.local_date,
        sets: raw.map(function (s, i) { return { setNumber: i + 1, weight: _num(s.weight), reps: _int(s.reps), rir: _int(s.rir), setType: s.set_type || 'working' }; }) };
    });
    list.sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    /* gleiche Uebung zweimal am selben Tag: beide bleiben, Reihenfolge stabil */
    return list.slice(-limit);
  }

  /* Zielbereich fuer die Progression aus der geplanten Uebung; fehlt er,
     bekommt das Modul KEINEN Bereich (nutzt seinen Default) — nicht 0–0. */
  function repRangeFromWorkoutExercise(we) {
    var lo = _int(we && we.min_reps), hi = _int(we && we.max_reps);
    if (lo == null && hi == null) return null;
    if (lo == null) lo = hi;
    if (hi == null) hi = lo;
    if (lo < 1 || hi < lo) return null;
    return { min: lo, max: hi };
  }

  /* ---------- B-06: exercises-Katalog → alternatives-Katalog ----------
     `musclesFor` wird injiziert (gymVolume.musclesFor): Name → Slug → Pattern.
     Uebungen ohne Muskelzuordnung UND ohne Pattern fallen aus dem Katalog —
     sie koennten weder gefunden noch vorgeschlagen werden (Datenluecke). */
  function catalogFromExercises(exercises, musclesFor) {
    var fn = typeof musclesFor === 'function' ? musclesFor : function () { return null; };
    var out = [];
    (Array.isArray(exercises) ? exercises : []).forEach(function (e) {
      if (!e || e.id == null) return;
      var pattern = e.movementPattern || e.movement_pattern || null;
      var m = null;
      try { m = fn({ name: e.name, exerciseId: e.slug || null, movementPattern: pattern }); } catch (_) { m = null; }
      if (!m && !pattern) return;
      out.push({ id: e.id, name: e.name || null, slug: e.slug || null, muscles: m || {}, pattern: pattern, equipment: null });
    });
    return out;
  }

  /* ---------- B-05: Store-Baum → superset-model-Eingabe ----------
     Store: [{ workoutExercise:{ id, client_exercise_id, order_index,
     planned_sets, superset_group }, sets:[...] }]. Die Modul-ID ist der
     INDEX im Baum (stabil innerhalb einer Ansicht, unabhaengig davon, ob die
     Zeile schon eine Server-ID hat). Geplante Saetze: planned_sets, sonst
     die tatsaechlich geloggten — sonst haette eine frei gestartete Uebung
     0 Runden und fiele aus jeder Gruppe. */
  function supersetInputFromTree(exercises) {
    return (Array.isArray(exercises) ? exercises : []).map(function (e, i) {
      var we = (e && e.workoutExercise) || {};
      var planned = _int(we.planned_sets);
      var logged = Array.isArray(e && e.sets) ? e.sets.length : 0;
      return { id: i, orderIndex: _int(we.order_index) == null ? i : _int(we.order_index),
        plannedSets: (planned != null && planned > 0) ? Math.max(planned, logged) : Math.max(logged, 1),
        supersetGroup: _int(we.superset_group) };
    });
  }

  /* Naechste Uebung in derselben Superset-Gruppe (Wechsel A→B→A). Gibt den
     Baum-Index zurueck oder null, wenn die Uebung in keiner ECHTEN Gruppe
     ist (dann bleibt das heutige Verhalten: bei der Uebung bleiben). */
  function nextInSuperset(exercises, index, supersetModel) {
    if (!supersetModel || typeof supersetModel.groupsOf !== 'function') return null;
    var input = supersetInputFromTree(exercises);
    var groups = supersetModel.groupsOf(input);
    for (var g = 0; g < groups.length; g++) {
      var ids = groups[g].exercises.map(function (x) { return x.id; });
      var pos = ids.indexOf(index);
      if (pos < 0) continue;
      return ids[(pos + 1) % ids.length];
    }
    return null;
  }

  /* Anzeige-Label der Gruppe: 1 → „A", 2 → „B" … (Gruppen-NUMMER bleibt
     Datenmodell, der Buchstabe ist nur Darstellung). */
  function groupLabel(group) {
    var g = _int(group);
    if (g == null || g < 1) return null;
    return g <= 26 ? String.fromCharCode(64 + g) : String(g);
  }

  var api = { VERSION: VERSION, NONPROGRESSION_TYPES: NONPROGRESSION_TYPES,
    historyFromExerciseRows: historyFromExerciseRows, repRangeFromWorkoutExercise: repRangeFromWorkoutExercise,
    catalogFromExercises: catalogFromExercises, supersetInputFromTree: supersetInputFromTree,
    nextInSuperset: nextInSuperset, groupLabel: groupLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.gymAdapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
