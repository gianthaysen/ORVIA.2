/* ============================================================
   ORVIA · planned-volume@1 — Saetze je Muskelgruppe in einer GEPLANTEN
   Einheit (v8-351).

   WOZU ES DIESES MODUL GIBT. Regel GYM-HYP-002 (Friedmann 2007) nennt
   „fuenf bis sechs Saetze pro Muskelgruppe und Einheit, verteilt ueber alle
   Uebungen, die diese Muskelgruppe belasten". Um das ueberhaupt pruefen zu
   koennen, muss jemand die geplanten Saetze je MUSKELGRUPPE summieren — und
   genau das konnte bisher niemand.

   WARUM NICHT IN gym-volume. Dort geht es um ABSOLVIERTE Saetze: jeder Satz
   traegt `completed`, einen Satztyp und Ausschlussgruende (Aufwaermsatz,
   Techniksatz, ohne Wiederholungen). Ein GEPLANTER Satz hat nichts davon —
   er ist eine Zahl in einer Vorgabe. Beides in `computeMuscleVolume` zu
   mischen hiesse, dort eine zweite Bedeutung von „Satz" einzufuehren, und
   die Funktion beantwortet dann zwei Fragen, von denen der Aufrufer nur eine
   gestellt hat.

   WAS VON gym-volume BENUTZT WIRD: `musclesFor`, `coeffOf`, `roleOf` — die
   Zuordnung selbst. Sie wird BENUTZT, nicht kopiert. Eine zweite
   Zuordnungstabelle waere die dritte Stelle im Projekt, an der zwei
   Wahrheiten nebeneinander stehen (v8-336 Satzzahl, v8-342 Coverage-Matrix);
   beide Male ist es teuer geworden.

   VERTRAG
     • REIN: kein DOM, kein Speicher, keine Uhrzeit, kein Zufall.
       Gleicher Input ⇒ zeichengleicher Output.
     • FAIL-CLOSED: eine Uebung ohne Satzzahl oder ohne Muskelzuordnung wird
       NICHT geschaetzt und NICHT stillschweigend uebergangen — sie erscheint
       in `unclassified` mit Grund. Wer 3 Saetze annimmt, weil `strength-plan`
       meistens 3 hat, faelscht die Summe, gegen die geprueft wird.
     • KEINE BEWERTUNG: dieses Modul zaehlt. Ob 7 Saetze zu viel sind,
       entscheidet die Verordnung anhand einer Quelle — nicht dieser Zaehler.

   plannedMuscleSets(exercises, opts) → {
     byMuscle: { quads: { muscle, directSets, indirectSetEquivalents,
                          effectiveSets, contributions:[…] }, … },
     unclassified: [{ exerciseId, name, sets, reason }],
     gezaehlteUebungen, version }
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'planned-volume@1';

  function _isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  /* Eine geplante Satzzahl ist eine ganze Zahl groesser null. Alles andere —
     null, "3", 2.5, -1 — ist KEINE Satzzahl und wird als solche gemeldet.
     `strength-plan@1` sagt es woertlich: „Satzanzahl ist Pflicht. Kein
     Default — 3 waere geraten." */
  function _saetze(e) {
    var s = e && e.sets;
    if (typeof s !== 'number' || !isFinite(s)) return null;
    if (Math.floor(s) !== s || s < 1) return null;
    return s;
  }

  /* Der Anzeigename fuer die Meldung — nie erfunden. Ist nichts da, steht da
     die Kennung; ist auch die nicht da, steht da null und der Aufrufer sieht
     eine Uebung ohne Kennung, so wie die Verordnung sie auch sperrt. */
  function _name(e) {
    if (!e) return null;
    return e.exerciseNameSnapshot || e.exerciseName || e.name
      || e.exerciseId || e.exercise_id || null;
  }

  function plannedMuscleSets(exercises, opts) {
    opts = opts || {};
    var GV = opts.gymVolume || O.gymVolume;
    var leer = { byMuscle: {}, unclassified: [], gezaehlteUebungen: 0, version: VERSION };
    /* Ohne Zuordnungsmodul wird NICHT gezaehlt. Ein Ergebnis ohne
       Muskelzuordnung saehe aus wie „keine Muskelgruppe belastet" — das ist
       etwas anderes als „ich kann es nicht sagen". */
    if (!GV || typeof GV.musclesFor !== 'function') {
      leer.grund = 'zuordnung_fehlt';
      return leer;
    }
    if (!Array.isArray(exercises) || !exercises.length) return leer;

    var byMuscle = {}, unclassified = [], gezaehlt = 0;

    exercises.forEach(function (e) {
      if (!_isObj(e)) { unclassified.push({ exerciseId: null, name: null, sets: null, reason: 'kein_objekt' }); return; }
      var sets = _saetze(e);
      if (sets === null) {
        unclassified.push({ exerciseId: e.exerciseId || e.exercise_id || null, name: _name(e), sets: null, reason: 'ohne_satzzahl' });
        return;
      }
      var muskeln = GV.musclesFor(e, opts.mapping || null);
      if (!muskeln) {
        unclassified.push({ exerciseId: e.exerciseId || e.exercise_id || null, name: _name(e), sets: sets, reason: 'nicht_zuordenbar' });
        return;
      }
      gezaehlt++;
      Object.keys(muskeln).forEach(function (mk) {
        var c = GV.coeffOf(muskeln[mk]);
        var rolle = GV.roleOf(muskeln[mk]);
        var m = byMuscle[mk] || (byMuscle[mk] = { muscle: mk, directSets: 0,
          indirectSetEquivalents: 0, effectiveSets: 0, contributions: [] });
        /* SUMME, nicht Maximum. Zwei Uebungen auf denselben Muskel ergeben
           die Summe ihrer Saetze — das ist der ganze Punkt der Regel
           („verteilt ueber alle Uebungen, die diese Muskelgruppe belasten").
           Wer hier das Maximum nimmt, meldet 4 statt 10 und die Pruefung
           schlaegt nie an. */
        if (rolle === 'direct') m.directSets += sets;
        else m.indirectSetEquivalents += sets * c;
        m.effectiveSets += sets * c;
        m.contributions.push({ exerciseId: e.exerciseId || e.exercise_id || null,
          name: _name(e), sets: sets, relationship: rolle, coefficient: c });
      });
    });

    /* Rundung erst am Ende und nur der Anzeigewert: 0.5er-Koeffizienten
       summieren sich sonst zu 4.499999999999999. */
    Object.keys(byMuscle).forEach(function (k) {
      var m = byMuscle[k];
      m.indirectSetEquivalents = Math.round(m.indirectSetEquivalents * 100) / 100;
      m.effectiveSets = Math.round(m.effectiveSets * 100) / 100;
    });

    return { byMuscle: byMuscle, unclassified: unclassified,
      gezaehlteUebungen: gezaehlt, version: VERSION };
  }

  /* Welche Muskelgruppen liegen ausserhalb eines Bereichs? Reine Auswertung
     ueber DIREKTE Saetze — die Regel spricht von Saetzen fuer eine
     Muskelgruppe, nicht von Satzaequivalenten aus Nebenbeteiligung. Wer
     indirekte Anteile mitzaehlt, kommt beim Bankdruecken auf Trizeps-Saetze,
     die niemand geplant hat.

     Rueckgabe: [{ muscle, sets, lage:'unter'|'ueber' }] — sortiert, damit
     dieselbe Einheit immer dieselbe Reihenfolge ergibt. */
  function ausserhalb(byMuscle, min, max) {
    if (!_isObj(byMuscle)) return [];
    if (typeof min !== 'number' || typeof max !== 'number') return [];
    var out = [];
    Object.keys(byMuscle).sort().forEach(function (k) {
      var d = byMuscle[k].directSets;
      if (!(d > 0)) return;                      /* nur indirekt beteiligt: keine Aussage */
      if (d < min) out.push({ muscle: k, sets: d, lage: 'unter' });
      else if (d > max) out.push({ muscle: k, sets: d, lage: 'ueber' });
    });
    return out;
  }

  var api = { VERSION: VERSION, plannedMuscleSets: plannedMuscleSets, ausserhalb: ausserhalb };
  if (typeof Object.freeze === 'function') Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.plannedVolume = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
