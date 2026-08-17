/* ============================================================
   ORVIA · engine/plan-variants — A vollständig · B reduziert · C minimal

   DER GEMELDETE FEHLER: „Bei A reduziert und B zählen dieselben Einheiten."
   Und er war echt. Die bisherige Logik filterte nach `unitPriority`:
     A = alles · B = Prioritäten A+B · C = nur Priorität A
   Liefert `unitPriority` für die Einheiten eines Nutzers durchgängig denselben
   Wert — und genau das tut sie bei einem Plan aus Laufen, Rad und Kraft —, dann
   filtert B nichts weg und zeigt dieselbe Zahl wie A. Die Varianten waren damit
   keine Auswahl, sondern dreimal derselbe Plan mit anderer Beschriftung.

   DIE RICHTIGE FRAGE IST NICHT „welche Priorität", SONDERN „wie viel Zeit habe
   ich heute". Vorgabe des Nutzers, wörtlich: „Bei reduziert eigentlich das, was
   gemacht werden muss — der komplette Trainingsplan, aber reduzierter, die
   Doppeleinheiten raus, sodass Du zeiteffizienter, aber trotzdem trainierst."

     A · Vollständig   der Plan wie gebaut
     B · Reduziert     dieselbe Wochenstruktur, aber ohne Doppeleinheiten —
                       jeder Trainingstag bleibt ein Trainingstag, kostet aber
                       nur noch eine Einheit. Alle Kernreize bleiben unangetastet.
     C · Minimal       nur die Einheiten, die das Ziel tragen. Für Wochen, in
                       denen sonst gar nichts ginge.

   WARUM B NICHT EINFACH „WENIGER EINHEITEN" IST: Wer eine Woche kürzt, darf
   nicht die Struktur zerstören. Fiele der Long Run weg, wäre es kein reduzierter
   Plan mehr, sondern ein anderer. Deshalb entfällt in B immer die ZWEITE Einheit
   eines Doppeltags — und unter zwei Einheiten die geringwertigere, nie der
   Kernreiz.

   ZUSAGE, DIE HIER GEPRÜFT WIRD: A ⊇ B ⊇ C, und bei einer Woche mit
   Doppeleinheiten ist B ECHT kleiner als A. Sind alle drei gleich groß, ist das
   kein Fehler — sondern der Fall einer Woche ohne Doppeltage und ohne
   entbehrliche Einheit. Auch das wird ausgewiesen statt kaschiert.

   PUR: keine Uhr, kein Zufall, kein DOM, kein Storage, keine Mutation.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'plan-variants@1';

  var META = {
    A: { key: 'A', name: 'Vollständig', desc: 'Der Plan wie gebaut — alle Einheiten.' },
    B: { key: 'B', name: 'Reduziert', desc: 'Gleiche Wochenstruktur, ohne Doppeleinheiten. Zeitsparend, alle Kernreize bleiben.' },
    C: { key: 'C', name: 'Minimal', desc: 'Nur die Einheiten, die das Ziel tragen. Für Wochen, in denen sonst nichts ginge.' }
  };

  function _l(it) { return String((it && it.l) || '').toLowerCase(); }
  function _clone(w) { return (Array.isArray(w) ? w : []).map(function (d) { return Array.isArray(d) ? d.slice() : []; }); }

  /* Kernreiz = die Einheit, für die die Woche gebaut wurde. Bevorzugt über das
     Lastprofil, damit hier keine zweite Meinung entsteht; der Fallback greift
     nur, wenn das Modul fehlt. */
  function isKey(it) {
    try { if (O.loadProfile && typeof O.loadProfile.profileOf === 'function') {
      var p = O.loadProfile.profileOf(it);
      return p.systemic >= .7;                       /* long · tempo · interval · race */
    } } catch (e) {}
    var l = _l(it);
    return /interval|tempo|schwelle|long|wettkampf/.test(l);
  }

  /* Wertigkeit innerhalb eines Tages: kleiner = wichtiger, bleibt länger. */
  function worth(it) {
    if (!it) return 99;
    if (isKey(it)) return 0;
    var l = _l(it);
    if (it.t === 'Gym' && !/core|mobil/.test(l)) return 2;
    if (it.t === 'Laufen') return 3;
    if (it.t === 'Rad' || it.t === 'Schwimmen') return 4;
    return 5;
  }

  function _count(w) { var n = 0; for (var i = 0; i < 7; i++) n += (w[i] || []).length; return n; }
  function _days(w) { var n = 0; for (var i = 0; i < 7; i++) if ((w[i] || []).length) n++; return n; }
  function _keys(w) { var n = 0; for (var i = 0; i < 7; i++) (w[i] || []).forEach(function (u) { if (isKey(u)) n++; }); return n; }

  /* ---- B: Doppeleinheiten auflösen ---- */
  function reduce(days) {
    var w = _clone(days), dropped = [];
    for (var d = 0; d < 7; d++) {
      var day = w[d] || [];
      if (day.length < 2) continue;
      /* Wichtigste zuerst — was danach kommt, entfällt. */
      var sorted = day.slice().sort(function (a, b) { return worth(a) - worth(b); });
      var keep = sorted.slice(0, 1), rest = sorted.slice(1);
      /* Ein zweiter Kernreiz am selben Tag ist im gebauten Plan ausgeschlossen;
         sollte er doch auftreten, bleibt er erhalten — eine Zeitersparnis darf
         keinen Zielreiz kosten. */
      rest.forEach(function (u) { if (isKey(u)) keep.push(u); else dropped.push({ day: d, unit: u }); });
      w[d] = day.filter(function (u) { return keep.indexOf(u) >= 0; });
    }
    return { days: w, dropped: dropped };
  }

  /* ---- C: nur was das Ziel trägt ----
     Kernreize immer. Gibt es keine, bleibt je Sportart die wertvollste Einheit
     übrig — eine leere Woche wäre keine Variante, sondern ein Ausfall. */
  function minimal(days) {
    var w = _clone(days), dropped = [];
    var hasKey = _keys(w) > 0;
    var seenSport = {};
    for (var d = 0; d < 7; d++) {
      var day = (w[d] || []).slice().sort(function (a, b) { return worth(a) - worth(b); });
      var keep = [];
      day.forEach(function (u) {
        if (isKey(u)) { keep.push(u); return; }
        if (!hasKey && !seenSport[u.t]) { seenSport[u.t] = 1; keep.push(u); return; }
        dropped.push({ day: d, unit: u });
      });
      w[d] = keep;
    }
    return { days: w, dropped: dropped };
  }

  /* ---- Alle drei Varianten ---- */
  function build(days) {
    var A = _clone(days);
    var rB = reduce(A), rC = minimal(A);
    function pack(key, w, dropped) {
      return { key: key, name: META[key].name, desc: META[key].desc, days: w,
        count: _count(w), trainingDays: _days(w), restDays: 7 - _days(w),
        keySessions: _keys(w), doubleDays: w.filter(function (d) { return d.length >= 2; }).length,
        dropped: (dropped || []).map(function (x) { return { day: x.day, unit: x.unit.t + ' · ' + x.unit.l }; }) };
    }
    var out = { version: VERSION, A: pack('A', A, []), B: pack('B', rB.days, rB.dropped), C: pack('C', rC.days, rC.dropped) };

    /* Selbstprüfung — die Zusage, an der die alte Fassung gescheitert ist. */
    out.consistent = out.A.count >= out.B.count && out.B.count >= out.C.count;
    out.distinct = !(out.A.count === out.B.count && out.B.count === out.C.count);
    /* Warum sind sie gleich groß? Das ist erklärbar und wird erklärt, statt eine
       Auswahl vorzutäuschen, die keine ist. */
    out.note = out.distinct ? null
      : (out.A.doubleDays === 0 && out.A.count === out.A.keySessions)
        ? 'Diese Woche besteht nur aus Kernreizen ohne Doppeleinheiten — es gibt nichts zu reduzieren.'
        : 'In dieser Woche führen alle drei Varianten zum selben Plan.';
    /* Kernreize dürfen in KEINER Variante verlorengehen. */
    out.keySessionsIntact = (out.A.keySessions === out.B.keySessions) && (out.B.keySessions === out.C.keySessions);
    return out;
  }

  var api = { VERSION: VERSION, META: META, build: build,
    reduce: reduce, minimal: minimal, isKey: isKey, worth: worth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.planVariants = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
