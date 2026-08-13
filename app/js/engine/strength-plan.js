/* ============================================================
   ORVIA · strength-plan — Datenvertrag fuer geplante Kraft-Einheiten
   Kraftplan v2, Baustein K1/K2 (der „minimale K2-Datenvertrag ohne grosse UI",
   Plan §6 Phase A Schritt 4).

   WARUM ES DIESES MODUL GIBT
   Eine Gym-Karte im Wochenplan ist heute {t:'Gym', l:'Push', d:'45 min'} —
   und `d` ist eine KONSTANTE aus gpG() (js/ui.js:239), kein Datenfeld. Es gibt
   also keine Stelle, an der Uebungen, Saetze, Wiederholungen oder ein
   Zielgewicht ueberhaupt stehen koennten. Dieses Modul definiert genau EINE
   Form fuer diese Vorgaben, die Wochenplanansicht, Detaileditor, Sessionstart
   und Garmin-Export gemeinsam lesen (Plan §0 Leitprinzip 3: eine Datenquelle
   fuer alle Ansichten).

   REIN. Keine DOM-, Netz-, Zeit- oder Zufallszugriffe. Gleiche Eingabe ⇒
   identische Ausgabe. Die Eingabe wird nie veraendert.

   FAIL-CLOSED. Unbrauchbare Angaben werden ABGEWIESEN und benannt, nicht in
   einen plausiblen Wert repariert. Ausnahmen sind ausdruecklich zwei, und
   beide sind Bedeutungs- statt Ratefaelle:
     · genau eine Wiederholungsgrenze angegeben ⇒ feste Wiederholungszahl
       (min = max). Das ist die Bedeutung von „4 x 8", nicht geraten.
     · `order` fehlt ⇒ Reihenfolge = Position in der Liste.
   Eine fehlende Satzanzahl wird NICHT auf 3 gesetzt. „3" waere geraten.

   ANNAHMEN [A] (bewusst gesetzt, keine Messung — dieselbe Kennzeichnung wie
   in calc.js seit v8-318):
     [A1] Zielgewicht 0..500 kg, 0 = ausdruecklich ohne Zusatzlast. Negative
          Zusatzlast (assistierte Uebungen) ist im MVP nicht modelliert.
     [A2] Arbeitszeit je Satz 40 s und Uebungswechsel 60 s fuer die
          Dauerschaetzung. Beides sind Faustwerte; sie ersetzen die bisherige
          Konstante '45 min' durch etwas, das wenigstens auf den tatsaechlich
          geplanten Umfang reagiert — nicht durch eine Messung.
     [A3] Fehlt eine Pausenangabe, rechnet die Dauerschaetzung mit 120 s.
          Gespeichert wird dabei NICHTS: restSeconds bleibt null.

   BEWUSST NICHT ENTHALTEN (Plan §12): prozentuale Zielgewichte, getrennte
   Gewichte je Aufwaerm-/Top-/Backoff-Satz, Supersaetze, automatische
   Progression. Unterschiedliche Lasten loest das MVP dadurch, dass dieselbe
   Uebung zweimal geplant wird — das ist eine bewusste Modellgrenze und keine
   Luecke, die stillschweigend zugerechnet werden darf.
   ============================================================ */
(function () {
  window.ORVIA = window.ORVIA || {};
  var O = window.ORVIA;

  var VERSION = 'strength-plan@1';
  var PLANNED_KEY = 'plannedExercises';

  var LIMITS = {
    maxExercises: 20,
    sets: [1, 20],
    reps: [1, 100],
    weightKg: [0, 500],
    rir: [0, 10],
    restSeconds: [0, 900],
    noteChars: 200
  };

  /* [A2]/[A3] — Faustwerte der Dauerschaetzung, an einer Stelle. */
  var TIME = { setWorkSeconds: 40, exerciseSwitchSeconds: 60, defaultRestSeconds: 120 };

  /* --- kleine reine Helfer -------------------------------------------- */
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function inRange(v, r) { return v >= r[0] && v <= r[1]; }
  function str(v) {
    if (typeof v !== 'string') return null;
    var s = v.trim();
    return s ? s : null;
  }

  /* Sportart NICHT per Teilstring vergleichen (der v8-316-Fehler). Ohne
     Normalisierer wird NICHTS geraten: dann gilt die Einheit als nicht
     sicher als Kraft erkennbar. */
  function isStrengthItem(item) {
    if (!isObj(item)) return false;
    var td = O.trainingDomain;
    if (!td || typeof td.normSportStrict !== 'function') return false;
    return td.normSportStrict(item.t) === 'gym';
  }

  /* --- Einzelne geplante Uebung --------------------------------------- */
  /* -> { ok, value, errors:[{field, code, got}] }
     Fehlercodes sind maschinenlesbar (missing | not_object | not_integer |
     not_finite | out_of_range | reversed_range) — die Oberflaeche uebersetzt
     sie, Tests haengen nicht an deutschen Saetzen. */
  function normalizeExercise(raw) {
    var errors = [];
    if (!isObj(raw)) return { ok: false, value: null, errors: [{ field: '_', code: 'not_object', got: raw }] };

    var id = str(raw.exerciseId);
    if (!id) errors.push({ field: 'exerciseId', code: 'missing', got: raw.exerciseId });

    /* Satzanzahl ist Pflicht. Kein Default — 3 waere geraten. */
    var sets = num(raw.sets);
    if (sets === null) errors.push({ field: 'sets', code: 'missing', got: raw.sets });
    else if (!isInt(sets)) errors.push({ field: 'sets', code: 'not_integer', got: raw.sets });
    else if (!inRange(sets, LIMITS.sets)) errors.push({ field: 'sets', code: 'out_of_range', got: raw.sets });

    /* Wiederholungen sind optional — „4 Saetze Bankdruecken" ist eine
       zulaessige, wenn auch duenne Vorgabe. Ist genau eine Grenze gesetzt,
       ist eine feste Wiederholungszahl gemeint. */
    var minR = num(raw.minReps), maxR = num(raw.maxReps);
    if (minR === null && maxR !== null) minR = maxR;
    if (maxR === null && minR !== null) maxR = minR;
    if (minR !== null) {
      if (!isInt(minR)) errors.push({ field: 'minReps', code: 'not_integer', got: raw.minReps });
      else if (!inRange(minR, LIMITS.reps)) errors.push({ field: 'minReps', code: 'out_of_range', got: raw.minReps });
      if (!isInt(maxR)) errors.push({ field: 'maxReps', code: 'not_integer', got: raw.maxReps });
      else if (!inRange(maxR, LIMITS.reps)) errors.push({ field: 'maxReps', code: 'out_of_range', got: raw.maxReps });
      if (isInt(minR) && isInt(maxR) && minR > maxR) {
        errors.push({ field: 'maxReps', code: 'reversed_range', got: [raw.minReps, raw.maxReps] });
      }
    }

    /* Zielgewicht. null = keine Vorgabe. 0 ist erlaubt und bedeutet [A1]
       ausdruecklich „ohne Zusatzlast"; ein negativer Wert wird abgewiesen
       statt auf 0 gezogen — assistierte Uebungen sind nicht modelliert. */
    var w = null;
    if (raw.targetWeightKg !== null && raw.targetWeightKg !== undefined && raw.targetWeightKg !== '') {
      w = num(raw.targetWeightKg);
      if (w === null) errors.push({ field: 'targetWeightKg', code: 'not_finite', got: raw.targetWeightKg });
      else if (!inRange(w, LIMITS.weightKg)) errors.push({ field: 'targetWeightKg', code: 'out_of_range', got: raw.targetWeightKg });
    }

    var rir = null;
    if (raw.targetRir !== null && raw.targetRir !== undefined && raw.targetRir !== '') {
      rir = num(raw.targetRir);
      if (rir === null) errors.push({ field: 'targetRir', code: 'not_finite', got: raw.targetRir });
      else if (!inRange(rir, LIMITS.rir)) errors.push({ field: 'targetRir', code: 'out_of_range', got: raw.targetRir });
    }

    var rest = null;
    if (raw.restSeconds !== null && raw.restSeconds !== undefined && raw.restSeconds !== '') {
      rest = num(raw.restSeconds);
      if (rest === null) errors.push({ field: 'restSeconds', code: 'not_finite', got: raw.restSeconds });
      else if (!isInt(rest)) errors.push({ field: 'restSeconds', code: 'not_integer', got: raw.restSeconds });
      else if (!inRange(rest, LIMITS.restSeconds)) errors.push({ field: 'restSeconds', code: 'out_of_range', got: raw.restSeconds });
    }

    var note = str(raw.note);
    if (note && note.length > LIMITS.noteChars) note = note.slice(0, LIMITS.noteChars);

    var ord = num(raw.order);
    if (ord !== null && (!isInt(ord) || ord < 1)) {
      errors.push({ field: 'order', code: 'out_of_range', got: raw.order });
      ord = null;
    }

    if (errors.length) return { ok: false, value: null, errors: errors };

    /* Nur bekannte Felder wandern weiter. Unbekanntes wird bewusst NICHT
       durchgereicht — sonst waechst der persistierte Plan unkontrolliert. */
    return {
      ok: true,
      errors: [],
      value: {
        exerciseId: id,
        order: ord,
        sets: sets,
        minReps: minR === null ? null : minR,
        maxReps: maxR === null ? null : maxR,
        targetWeightKg: w,
        targetRir: rir,
        restSeconds: rest,
        note: note
      }
    };
  }

  /* --- Liste geplanter Uebungen ---------------------------------------- */
  /* -> { ok, exercises, errors, dropped }
     `ok` ist nur dann true, wenn NICHTS verworfen wurde. Eine teilweise
     brauchbare Liste liefert trotzdem `exercises` — die Oberflaeche kann den
     guten Teil zeigen und die verworfenen Zeilen benennen, statt die ganze
     Einheit zu verlieren. */
  function normalizePlanned(list) {
    if (list === null || list === undefined) return { ok: true, exercises: [], errors: [], dropped: 0 };
    if (!Array.isArray(list)) {
      return { ok: false, exercises: [], errors: [{ index: -1, field: '_', code: 'not_array', got: list }], dropped: 0 };
    }

    var out = [], errors = [], dropped = 0;
    for (var i = 0; i < list.length; i++) {
      if (out.length >= LIMITS.maxExercises) {
        errors.push({ index: i, field: '_', code: 'too_many', got: list.length });
        dropped++;
        continue;
      }
      var r = normalizeExercise(list[i]);
      if (!r.ok) {
        dropped++;
        for (var e = 0; e < r.errors.length; e++) {
          errors.push({ index: i, field: r.errors[e].field, code: r.errors[e].code, got: r.errors[e].got });
        }
        continue;
      }
      out.push(r.value);
    }

    /* Reihenfolge wird IMMER neu vergeben: 1..n, lueckenlos. Eine mitgelieferte
       `order` bestimmt nur die Sortierung, nicht den Endwert — sonst
       entstuenden nach dem Loeschen einer Zeile Luecken, die der Exporter
       spaeter als Schrittabstaende missdeuten koennte. */
    var idx = out.map(function (x, i) { return { x: x, i: i }; });
    idx.sort(function (a, b) {
      var ao = a.x.order, bo = b.x.order;
      if (ao === null && bo === null) return a.i - b.i;
      if (ao === null) return 1;
      if (bo === null) return -1;
      if (ao !== bo) return ao - bo;
      return a.i - b.i;
    });
    var sorted = idx.map(function (p, i) {
      var c = p.x; c.order = i + 1; return c;
    });

    return { ok: dropped === 0 && errors.length === 0, exercises: sorted, errors: errors, dropped: dropped };
  }

  /* --- Lesen/Schreiben am Plan-Item ------------------------------------ */
  /* Liefert IMMER ein Array. Ein Gym-Item ohne Vorgaben ist gueltiger
     Altbestand und darf nicht als Fehler erscheinen (Plan K2-Test 1). */
  function readPlanned(item) {
    if (!isObj(item)) return [];
    return normalizePlanned(item[PLANNED_KEY]).exercises;
  }

  function hasPlanned(item) { return readPlanned(item).length > 0; }

  /* Gibt eine KOPIE zurueck; das uebergebene Item bleibt unveraendert. Eine
     leere Liste entfernt das Feld wieder, damit im persistierten Plan kein
     leeres Array liegen bleibt (kleinerer Blob, klarere Altbestandspruefung). */
  function attachPlanned(item, list) {
    var base = isObj(item) ? item : {};
    var copy = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) copy[k] = base[k];
    var r = normalizePlanned(list);
    if (r.exercises.length) copy[PLANNED_KEY] = r.exercises;
    else delete copy[PLANNED_KEY];
    return copy;
  }

  /* --- Listenoperationen fuer den Editor (rein) -------------------------
     Die Oberflaeche soll KEINE eigene Listenlogik haben. Alle vier Operationen
     geben eine neue, normalisierte Liste zurueck und lassen die Eingabe
     unveraendert. Reihenfolge wird dabei immer neu auf 1..n gesetzt.

     FAIL-CLOSED beim Bearbeiten: schlaegt die Pruefung fehl, kommt die
     UNVERAENDERTE Liste zurueck. Eine ungueltige Eingabe in Zeile 2 darf nicht
     die Zeilen 1 und 3 mitreissen — genau das waere passiert, wenn man die
     Gesamtliste einfach neu normalisiert und die kaputte Zeile fallen laesst. */
  function _raw(list) {
    /* Kopie der bereits normalisierten Liste, damit Operationen nichts teilen. */
    return normalizePlanned(list).exercises.map(function (e) {
      return { exerciseId: e.exerciseId, order: e.order, sets: e.sets, minReps: e.minReps,
        maxReps: e.maxReps, targetWeightKg: e.targetWeightKg, targetRir: e.targetRir,
        restSeconds: e.restSeconds, note: e.note };
    });
  }
  function _renumber(arr) { for (var i = 0; i < arr.length; i++) arr[i].order = i + 1; return arr; }

  function insertExercise(list, ex, at) {
    var cur = _raw(list);
    if (cur.length >= LIMITS.maxExercises) {
      return { ok: false, exercises: cur, errors: [{ index: -1, field: '_', code: 'too_many', got: cur.length }] };
    }
    var one = normalizeExercise(ex);
    if (!one.ok) return { ok: false, exercises: cur, errors: one.errors.map(function (e) { return { index: -1, field: e.field, code: e.code, got: e.got }; }) };
    var idx = (typeof at === 'number' && at >= 0 && at <= cur.length) ? at : cur.length;
    cur.splice(idx, 0, one.value);
    return { ok: true, exercises: normalizePlanned(_renumber(cur)).exercises, errors: [] };
  }

  function removeExerciseAt(list, index) {
    var cur = _raw(list);
    if (!(index >= 0 && index < cur.length)) {
      return { ok: false, exercises: cur, errors: [{ index: index, field: '_', code: 'out_of_range', got: index }] };
    }
    cur.splice(index, 1);
    return { ok: true, exercises: normalizePlanned(_renumber(cur)).exercises, errors: [] };
  }

  function moveExercise(list, from, to) {
    var cur = _raw(list);
    if (!(from >= 0 && from < cur.length) || !(to >= 0 && to < cur.length)) {
      return { ok: false, exercises: cur, errors: [{ index: from, field: '_', code: 'out_of_range', got: [from, to] }] };
    }
    var it = cur.splice(from, 1)[0];
    cur.splice(to, 0, it);
    return { ok: true, exercises: normalizePlanned(_renumber(cur)).exercises, errors: [] };
  }

  function updateExerciseAt(list, index, patch) {
    var cur = _raw(list);
    if (!(index >= 0 && index < cur.length)) {
      return { ok: false, exercises: cur, errors: [{ index: index, field: '_', code: 'out_of_range', got: index }] };
    }
    if (!isObj(patch)) {
      return { ok: false, exercises: cur, errors: [{ index: index, field: '_', code: 'not_object', got: patch }] };
    }
    var merged = {};
    for (var k in cur[index]) if (Object.prototype.hasOwnProperty.call(cur[index], k)) merged[k] = cur[index][k];
    for (var p in patch) if (Object.prototype.hasOwnProperty.call(patch, p)) merged[p] = patch[p];
    var one = normalizeExercise(merged);
    if (!one.ok) {
      /* Unveraendert zurueck — die uebrigen Zeilen bleiben unangetastet. */
      return { ok: false, exercises: cur, errors: one.errors.map(function (e) { return { index: index, field: e.field, code: e.code, got: e.got }; }) };
    }
    one.value.order = cur[index].order;
    cur[index] = one.value;
    return { ok: true, exercises: normalizePlanned(_renumber(cur)).exercises, errors: [] };
  }

  /* --- Anzeige --------------------------------------------------------- */
  /* `nameOf` loest exerciseId -> Anzeigename auf. Fehlt der Name, wird er
     NICHT erfunden: dann steht dort die unaufgeloeste Kennung, damit im
     Zweifel sichtbar ist, dass etwas nicht gefunden wurde. */
  function summarizeExercise(ex, nameOf) {
    if (!isObj(ex)) return '';
    var name = (typeof nameOf === 'function' && nameOf(ex.exerciseId)) || ex.exerciseId || '?';
    var parts = [];
    if (ex.minReps === null || ex.maxReps === null) {
      parts.push(ex.sets + ' ' + (ex.sets === 1 ? 'Satz' : 'Sätze'));
    } else if (ex.minReps === ex.maxReps) {
      parts.push(ex.sets + ' × ' + ex.minReps);
    } else {
      parts.push(ex.sets + ' × ' + ex.minReps + '–' + ex.maxReps);
    }
    if (ex.targetWeightKg !== null && ex.targetWeightKg !== undefined) {
      parts.push(ex.targetWeightKg === 0 ? 'ohne Zusatzlast' : ex.targetWeightKg + ' kg');
    }
    /* v8-323: Pause gehoert sichtbar dazu — sie unterscheidet eine schwere
       Grunduebung von einer Zusatzuebung deutlicher als jede andere Angabe.
       Fehlt sie, steht dort NICHTS (keine erfundenen 90 s). */
    if (ex.restSeconds !== null && ex.restSeconds !== undefined) {
      parts.push(ex.restSeconds + ' s Pause');
    }
    return name + ' — ' + parts.join(' · ');
  }

  function summarizePlanned(list, nameOf) {
    var ex = normalizePlanned(list).exercises;
    var out = [];
    for (var i = 0; i < ex.length; i++) out.push(summarizeExercise(ex[i], nameOf));
    return out;
  }

  /* --- Dauerschaetzung ------------------------------------------------- */
  /* Ersetzt die feste Zeichenkette '45 min' durch etwas, das auf den
     tatsaechlich geplanten Umfang reagiert. Liefert null statt einer Zahl,
     wenn nichts geplant ist — eine „0 min"-Anzeige waere eine Aussage, die
     hier niemand treffen kann. */
  function estimateDurationMin(list) {
    var ex = normalizePlanned(list).exercises;
    if (!ex.length) return null;
    var s = 0;
    for (var i = 0; i < ex.length; i++) {
      var e = ex[i];
      var rest = e.restSeconds === null ? TIME.defaultRestSeconds : e.restSeconds;
      s += e.sets * TIME.setWorkSeconds + Math.max(0, e.sets - 1) * rest;
    }
    s += Math.max(0, ex.length - 1) * TIME.exerciseSwitchSeconds;
    return Math.max(5, Math.round(s / 60 / 5) * 5);
  }

  /* Geplantes Volumen in kg. Uebungen ohne Zielgewicht zaehlen NICHT als 0 —
     sie sind schlicht nicht bewertbar (dasselbe Prinzip wie plan-quality.js
     v8-316: nicht bewertbar ist nicht „schlecht"). */
  function plannedVolumeKg(list) {
    var ex = normalizePlanned(list).exercises;
    var total = 0, counted = 0, skipped = 0;
    for (var i = 0; i < ex.length; i++) {
      var e = ex[i];
      if (e.targetWeightKg === null || e.minReps === null) { skipped++; continue; }
      var reps = (e.minReps + e.maxReps) / 2;
      total += e.sets * reps * e.targetWeightKg;
      counted++;
    }
    if (!counted) return { applicable: false, kg: null, counted: 0, skipped: skipped };
    return { applicable: true, kg: Math.round(total), counted: counted, skipped: skipped };
  }

  /* --- Fingerabdruck fuer strength_workout_exports.payload_hash --------- */
  /* Deterministisch und rein (FNV-1a ueber die kanonische Feldfolge). Kein
     Sicherheitsmerkmal — nur die Frage „hat sich die Vorgabe seit dem Push
     geaendert?", die sonst still unbeantwortet bliebe. */
  function fingerprint(list) {
    var ex = normalizePlanned(list).exercises;
    var s = VERSION + '|';
    for (var i = 0; i < ex.length; i++) {
      var e = ex[i];
      s += [e.order, e.exerciseId, e.sets, e.minReps, e.maxReps,
        e.targetWeightKg, e.targetRir, e.restSeconds].join(',') + ';';
    }
    var h = 0x811c9dc5;
    for (var c = 0; c < s.length; c++) {
      h ^= s.charCodeAt(c);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return VERSION + ':' + ('00000000' + h.toString(16)).slice(-8);
  }

  O.strengthPlan = {
    VERSION: VERSION,
    PLANNED_KEY: PLANNED_KEY,
    LIMITS: LIMITS,
    TIME: TIME,
    isStrengthItem: isStrengthItem,
    normalizeExercise: normalizeExercise,
    normalizePlanned: normalizePlanned,
    readPlanned: readPlanned,
    hasPlanned: hasPlanned,
    attachPlanned: attachPlanned,
    insertExercise: insertExercise,
    removeExerciseAt: removeExerciseAt,
    moveExercise: moveExercise,
    updateExerciseAt: updateExerciseAt,
    summarizeExercise: summarizeExercise,
    summarizePlanned: summarizePlanned,
    estimateDurationMin: estimateDurationMin,
    plannedVolumeKg: plannedVolumeKg,
    fingerprint: fingerprint
  };
})();
