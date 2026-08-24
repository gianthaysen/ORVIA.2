/* ============================================================
   ORVIA · engine/superset-model — B-05 (Gym-UX), Schritt 1

   WOFÜR. Ein Superset sind zwei oder mehr Übungen, die ABWECHSELND ausgeführt
   werden (A1 → B1 → A2 → B2 …) statt nacheinander. Dieses Modul beantwortet die
   eine Frage, an der Implementierungen typisch scheitern: In welcher Reihenfolge
   kommen die Sätze — auch dann, wenn die Übungen UNGLEICH viele Sätze haben?

   REIN & DETERMINISTISCH. Kein DOM, kein Date, kein Storage, keine DB. Die
   Gruppierung kommt als Datensatz herein, die Reihenfolge geht als Liste heraus.
   Damit ist der fehleranfaellige Teil vollstaendig offline pruefbar, bevor
   Migration, Player und Sync ueberhaupt angefasst werden.

   DATENMODELL (Entscheidung §4 des Umsetzungsplans). Die Gruppe ist ein
   nullable `supersetGroup` auf der Uebung — KEINE eigene Tabelle. Zwei Uebungen
   derselben Session mit demselben Wert bilden einen Superset; `null` heisst
   „normale Uebung". Die Reihenfolge INNERHALB der Gruppe ist der vorhandene
   `orderIndex`.

   BESTANDSSCHUTZ IST DIE WICHTIGSTE ZUSICHERUNG. Ohne Gruppen (alles null) ist
   die Ausgabe exakt die sequenzielle Reihenfolge von heute. Ein bestehendes
   Workout darf sich durch dieses Modul NICHT anders verhalten.

   EINE GRUPPE MIT EINER UEBUNG IST KEIN SUPERSET. Sie degeneriert zu einer
   normalen Uebung — ein „Superset" aus einer Uebung waere ein erfundener
   Zustand, keine Gruppierung.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'superset-model@1';

  function _int(x) { return (typeof x === 'number' && isFinite(x)) ? Math.trunc(x) : null; }
  function _sets(ex) { var n = _int(ex && ex.plannedSets); return (n != null && n > 0) ? n : 0; }

  /* Uebungen normalisieren: nur Objekte, orderIndex als Zahl, stabil sortiert.
     Ein fehlender orderIndex faellt ans Ende (statt die Sortierung zu kippen). */
  function _normalize(list) {
    var arr = (Array.isArray(list) ? list : []).filter(function (e) { return e && typeof e === 'object'; });
    return arr.map(function (e, i) {
      var oi = _int(e.orderIndex);
      return { ref: e, id: e.id != null ? e.id : null,
        orderIndex: oi == null ? (1e9 + i) : oi,
        group: _int(e.supersetGroup), sets: _sets(e), _pos: i };
    }).sort(function (a, b) {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a._pos - b._pos;                       /* stabil bei Gleichstand */
    });
  }

  /* groupsOf(exercises) → [{ group, exercises:[...], rounds }] nur ECHTE
     Supersets (>= 2 Uebungen). Reihenfolge nach der ersten Uebung der Gruppe. */
  function groupsOf(exercises) {
    var norm = _normalize(exercises), map = {}, order = [];
    norm.forEach(function (e) {
      if (e.group == null) return;
      var k = String(e.group);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(e);
    });
    return order.map(function (k) {
      return { group: Number(k), exercises: map[k].map(function (e) { return e.ref; }),
        rounds: map[k].reduce(function (m, e) { return Math.max(m, e.sets); }, 0) };
    }).filter(function (g) { return g.exercises.length >= 2; });   /* 1 Uebung = kein Superset */
  }

  /* executionOrder(exercises) → flache Satzliste in AUSFUEHRUNGSREIHENFOLGE.
       [{ exerciseId, setNumber, group, round }]
     Normale Uebungen: alle Saetze am Stueck (heutiges Verhalten).
     Supersets: rundenweise A1→B1→A2→B2… Hat eine Uebung WENIGER Saetze, wird sie
     in spaeteren Runden einfach uebersprungen — sie bekommt keine erfundenen
     Saetze, und die laengere Uebung verliert keine. Genau dieser Fall ist der
     Grund fuer dieses Modul. */
  function executionOrder(exercises) {
    var norm = _normalize(exercises);
    /* echte Supersetgruppen bestimmen (>=2 Uebungen) */
    var count = {};
    norm.forEach(function (e) { if (e.group != null) count[String(e.group)] = (count[String(e.group)] || 0) + 1; });
    function realGroup(e) { return (e.group != null && count[String(e.group)] >= 2) ? e.group : null; }

    var out = [], seen = {};
    norm.forEach(function (e) {
      var g = realGroup(e);
      if (g == null) {
        for (var s = 1; s <= e.sets; s++)
          out.push({ exerciseId: e.id, setNumber: s, group: null, round: s });
        return;
      }
      var k = String(g);
      if (seen[k]) return;                       /* Gruppe an ihrer ERSTEN Uebung abarbeiten */
      seen[k] = true;
      var members = norm.filter(function (x) { return realGroup(x) === g; });
      var rounds = members.reduce(function (m, x) { return Math.max(m, x.sets); }, 0);
      for (var r = 1; r <= rounds; r++) {
        for (var i = 0; i < members.length; i++) {
          if (members[i].sets >= r)               /* kuerzere Uebung faellt still aus */
            out.push({ exerciseId: members[i].id, setNumber: r, group: g, round: r });
        }
      }
    });
    return out;
  }

  /* Ist die Uebung Teil eines ECHTEN Supersets? Fuer Badge/Anzeige. */
  function isSuperset(exercises, exerciseId) {
    return groupsOf(exercises).some(function (g) {
      return g.exercises.some(function (e) { return e && e.id === exerciseId; });
    });
  }

  var api = { VERSION: VERSION, groupsOf: groupsOf, executionOrder: executionOrder, isSuperset: isSuperset };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.supersetModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
