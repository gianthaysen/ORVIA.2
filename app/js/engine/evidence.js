/* ============================================================
   ORVIA · evidence — Herkunftsvertrag der Engine (Bauplan Stufe 0b)

   WOFÜR: Ohne einen gemeinsamen Vertrag erfindet jedes Modul seine eigene
   Sicherheitsangabe. Dann steht auf EINEM Bildschirm „stark", „gemessen" und
   „hoch" nebeneinander und bedeutet dreimal etwas anderes. Ab hier trägt jeder
   entscheidungsrelevante Wert dieselbe Hülle: Wert + woher + wann + wie sicher.

   ZWEI GETRENNTE ACHSEN — das ist die zentrale Entwurfsentscheidung:

     evidence   unknown < weak < moderate < strong     (wie belastbar?)
     freshness  unknown | fresh | current | stale      (wie alt?)

   Ein starker Beleg von vor einem Jahr bleibt ein STARKER Beleg — nur ein
   alter. Beides in eine Zahl zu falten vernichtet Information: „mittel" könnte
   dann eine frische Selbstauskunft oder ein alter Wettkampf sein, und die
   beiden verlangen völlig verschiedene Reaktionen (einmal messen lassen,
   einmal nachtesten). Deshalb senkt Alterung `evidence` NIE automatisch.
   Wer trotzdem einen einzelnen Entscheidungswert braucht, ruft effective() —
   das Ergebnis ist ausdrücklich als abgeleitet gekennzeichnet und überschreibt
   die Rohachsen nicht.

   DRITTE FRAGE, DIE KEINE DER BEIDEN ACHSEN BEANTWORTET: „Darf dieser Wert den
   aktuellen Plan steuern?" Das ist nicht dasselbe wie „hat einen Beleg". Ein
   Wettkampf von vor zwanzig Jahren bleibt ein starker Beleg — als historische
   Aussage; als Grundlage heutiger Intensitaetszonen ist er unbrauchbar.
   usability() beantwortet genau das und nichts anderes.

   VIER STUFEN, ORDINAL — KEINE PROZENTZAHL: Es gibt keine Rechnung, die aus
   „10-km-Wettkampf vor 18 Tagen" seriös „78 %" macht. Eine Prozentzahl
   behauptet eine Genauigkeit, die die Herleitung nicht hat. Vier Stufen sind
   das, was sich verteidigen lässt.

   ALTER IST RELATIV, NICHT ABSOLUT: Ein Wettkampfergebnis altert anders als
   eine Schmerzangabe. Deshalb bringt jede Quelle ihr eigenes `staleAfter` mit,
   und `freshness` misst das Alter GEGEN diese Grenze. Genau deshalb reichen
   drei Zustände: die quellenspezifische Kenntnis steckt in der Schwelle, nicht
   im Etikett. Die Feinheit „wie weit darüber" bleibt als Zahl `ageRatio`
   erhalten — dort, wo sie gebraucht wird (Prognoseband), rechnet man mit ihr
   und nicht mit einem Etikett.

   MIGRATION STATT PARALLELBETRIEB: performance-zones sprach bisher
   measured/derived/estimated/none. Zwei Taxonomien nebeneinander sind ein
   garantierter Widerspruch. fromLegacy() bildet ab, toLegacy() existiert NUR,
   damit der Test die Verlustfreiheit in beide Richtungen prüfen kann — im
   Produktivcode wird das alte Vokabular entfernt, nicht ergänzt.

   ABGRENZUNG zu js/metrics/source-contract.js: Das ist die Messwertschicht
   (Gewicht, HFmax, Geräteabgleich) mit eigenem, gewachsenem Vokabular. Sie
   wird hier NICHT umgeschrieben — das wäre Aufwand ohne Nutzen und ein
   Regressionsrisiko in einem Bereich, der nichts plant. Sie betritt die Engine
   ausschließlich über fromSourceContract(). Eine Brücke, keine zweite Sprache.

   Kein DOM, keine Uhr, kein Zufall, kein Storage. `today` kommt herein.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'evidence@2';

  /* Ordinal — die Reihenfolge IST der Vertrag. */
  var LEVELS = ['unknown', 'weak', 'moderate', 'strong'];
  var FRESHNESS = ['unknown', 'fresh', 'current', 'stale'];

  /* Welche Quelle wie belastbar ist. Bewusst konservativ: Im Zweifel die
     niedrigere Stufe — eine zu hoch angesetzte Evidenz führt dazu, dass die
     Engine handelt, wo sie hätte fragen sollen. */
  var SOURCE_EVIDENCE = {
    race_result: 'strong',     // Wettkampf unter Wettkampfbedingungen
    test: 'strong',            // Protokoll absichtlich ausgefahren
    medical: 'strong',         // ärztlich dokumentiert (Constraints)
    device: 'moderate',        // Gerätemessung ohne Protokollkontrolle
    workout_derived: 'moderate', // harte Einheit — systematisch unter Wettkampfform
    checkin_trend: 'moderate', // wiederholte Check-ins mit erkennbarem Verlauf
    self_report: 'weak',       // Selbstauskunft, Zielzeit, Schätzung
    user_checkin: 'weak',      // einzelne Selbstauskunft
    default: 'unknown'         // Vorbelegung ist KEIN Beleg
  };

  /* Nach wie vielen Tagen ein Wert seine Aussagekraft verliert. Die Spreizung
     ist der eigentliche Inhalt: Eine Schmerzangabe von gestern sagt etwas, eine
     von vor drei Monaten nicht mehr; bei einem Wettkampfergebnis ist es
     umgekehrt. [A] — Erfahrungswerte, keine Messgrößen. */
  var STALE_AFTER = {
    race_result: 180,
    test: 120,
    medical: 180,
    device: 30,
    workout_derived: 60,
    checkin_trend: 21,
    self_report: 90,
    user_checkin: 14,
    default: 30
  };

  /* Klartext für die Oberfläche — eine Quelle für die Benennung, damit nicht
     drei Bildschirme drei Wörter für dasselbe zeigen. */
  var LEVEL_LABEL = { unknown: 'unbekannt', weak: 'schwach', moderate: 'mittel', strong: 'stark' };
  var FRESH_LABEL = { unknown: 'ohne Datum', fresh: 'frisch', current: 'aktuell', stale: 'veraltet' };
  var SOURCE_LABEL = {
    race_result: 'Wettkampf', test: 'Test', medical: 'ärztlich dokumentiert',
    device: 'Gerät', workout_derived: 'harte Einheit', checkin_trend: 'Verlauf aus Check-ins',
    self_report: 'Selbstauskunft', user_checkin: 'Check-in', default: 'Vorbelegung'
  };

  /* Kurzform auf den Plankarten. Identisch zur bisherigen Auszeichnung, damit
     die Oberfläche eine Skala behält und nicht zwei. */
  var MARKER = { strong: '', moderate: '≈', weak: '~', unknown: '—' };

  function rank(level) { var i = LEVELS.indexOf(level); return i < 0 ? 0 : i; }
  function isLevel(x) { return LEVELS.indexOf(x) >= 0; }

  /* Ein abgeleiteter Wert kann nie stärker sein als seine schwächste Eingabe.
     Das ist der Grund, warum es diese Funktion gibt: Ohne sie rechnet irgendwann
     jemand aus einer starken und einer schwachen Größe ein starkes Ergebnis. */
  function weakest(levels) {
    var arr = Array.isArray(levels) ? levels : [];
    if (!arr.length) return 'unknown';
    var lo = 'strong', i;
    for (i = 0; i < arr.length; i++) {
      var l = isLevel(arr[i]) ? arr[i] : 'unknown';
      if (rank(l) < rank(lo)) lo = l;
    }
    return lo;
  }

  function _days(fromIso, toIso) {
    try {
      var a = Date.parse(String(fromIso).slice(0, 10) + 'T12:00:00Z');
      var b = Date.parse(String(toIso).slice(0, 10) + 'T12:00:00Z');
      if (isNaN(a) || isNaN(b)) return null;
      return Math.round((b - a) / 86400000);
    } catch (e) { return null; }
  }

  /* Alter GEGEN die quellenspezifische Grenze.
       ≤ 50 % der Grenze  → fresh
       ≤ 100 %            → current
       darüber            → stale
     Ohne Datum: unknown — NICHT „frisch". Ein fehlendes Datum ist keine
     Bestätigung von Aktualität (Bauplan-Regel 3). */
  function freshnessOf(measuredAt, today, staleAfter) {
    var lim = (typeof staleAfter === 'number' && staleAfter > 0) ? staleAfter : STALE_AFTER.default;
    if (!measuredAt || !today) return { freshness: 'unknown', ageDays: null, ageRatio: null, staleAfter: lim };
    var d = _days(measuredAt, today);
    if (d == null) return { freshness: 'unknown', ageDays: null, ageRatio: null, staleAfter: lim };
    /* Ein Datum in der Zukunft ist ein Datenfehler, kein besonders frischer
       Wert — es wird auf 0 geklemmt und nicht belohnt. */
    if (d < 0) d = 0;
    var ratio = d / lim;
    return {
      freshness: ratio <= 0.5 ? 'fresh' : ratio <= 1 ? 'current' : 'stale',
      ageDays: d, ageRatio: Math.round(ratio * 100) / 100, staleAfter: lim
    };
  }

  /* ---- Die Hülle ----
     Liefert IMMER ein vollständiges Objekt. Eine unbekannte Quelle ergibt
     evidence 'unknown' — sie wird nicht geraten (Bauplan-Regel 2). */
  function make(opts) {
    var o = opts || {};
    var src = o.source || 'default';
    var known = Object.prototype.hasOwnProperty.call(SOURCE_EVIDENCE, src);
    var lim = (typeof o.staleAfter === 'number' && o.staleAfter > 0)
      ? o.staleAfter : (known ? STALE_AFTER[src] : STALE_AFTER.default);
    var f = freshnessOf(o.measuredAt, o.today, lim);

    /* Eine ausdrücklich übergebene Stufe darf die Quellentabelle überschreiben
       (z. B. ein Test, der abgebrochen wurde), aber nur mit einem gültigen Wert.
       Ein Tippfehler soll nicht still zu 'strong' werden. */
    var ev = isLevel(o.evidence) ? o.evidence : (known ? SOURCE_EVIDENCE[src] : 'unknown');

    return {
      value: o.value === undefined ? null : o.value,
      source: src,
      sourceId: o.sourceId || null,
      measuredAt: o.measuredAt || null,
      method: o.method || null,
      evidence: ev,
      staleAfter: lim,
      freshness: f.freshness,
      ageDays: f.ageDays,
      ageRatio: f.ageRatio
    };
  }

  /* ---- Abgeleitete Gesamtsicht ----
     NUR für Konsumenten, die genau einen Entscheidungswert brauchen. Sie
     überschreibt nichts; `evidence` und `freshness` bleiben unberührt.
     Regel: veraltet zieht um eine Stufe herunter, fehlendes Datum ebenfalls —
     aber nie unter 'weak', solange überhaupt ein Beleg existiert. Ein alter
     Wettkampf ist schwächer als ein frischer, aber immer noch besser als eine
     Vermutung. */
  function effective(hull) {
    var h = hull || {};
    var base = isLevel(h.evidence) ? h.evidence : 'unknown';
    if (base === 'unknown') return { level: 'unknown', derivedFrom: 'no_evidence' };
    if (h.freshness === 'stale' || h.freshness === 'unknown') {
      var lowered = LEVELS[Math.max(1, rank(base) - 1)];
      return { level: lowered, derivedFrom: h.freshness === 'stale' ? 'aged_out' : 'no_date' };
    }
    return { level: base, derivedFrom: 'current' };
  }

  /* ---- Verwendbarkeit ----
     „Hat einen Beleg" und „darf den aktuellen Plan steuern" sind NICHT dasselbe.
     Ein Wettkampf von vor zwanzig Jahren ist unverändert ein starker Beleg —
     als historische Aussage. Als Grundlage heutiger Intensitätszonen ist er
     unbrauchbar. effective() kann diese Frage nicht beantworten, weil es nur
     eine Stufe herabsetzt und bei 'weak' aufhört; ohne eine eigene Achse bliebe
     jeder beliebig alte Wert planungswirksam.

       decision_eligible  darf Zonen, Progression und Vorgaben steuern
       informational      wird angezeigt und eingeordnet, steuert aber nichts
       retest_required    war einmal planungsfähig und ist es nicht mehr —
                          hier lohnt sich ein neuer Test, weil eine gute Quelle
                          existiert und nur veraltet ist

     Die Schwelle ist ein Vielfaches der quellenspezifischen Haltbarkeit, nicht
     eine feste Tageszahl: Eine Schmerzangabe ist nach Wochen unbrauchbar, ein
     Wettkampfergebnis erst nach Jahren. */
  var USABILITY_LIMIT = 3;      // ab dem Dreifachen der Haltbarkeit: nicht mehr steuernd [A]

  function usability(hull) {
    var h = hull || {};
    var ev = isLevel(h.evidence) ? h.evidence : 'unknown';
    if (ev === 'unknown') return { usability: 'informational', reason: 'no_evidence' };
    /* Ohne Datum lässt sich Verderb nicht ausschließen. Fail-closed: anzeigen ja,
       steuern nein. */
    if (h.ageRatio == null) return { usability: 'informational', reason: 'no_date' };
    if (h.ageRatio <= 1) return { usability: 'decision_eligible', reason: 'current' };
    if (h.ageRatio <= USABILITY_LIMIT) return { usability: 'decision_eligible', reason: 'aging_within_tolerance' };
    /* Über der Grenze: Eine starke Quelle rechtfertigt einen Nachtest, eine
       schwache nicht — dort wäre „teste nach" ein leerer Rat. */
    return { usability: rank(ev) >= rank('moderate') ? 'retest_required' : 'informational',
      reason: 'aged_out', ageRatio: h.ageRatio };
  }

  /* Breite eines Prognosebands. Rechnet mit ageRatio statt mit einem Etikett:
     Ein Wert 10 % über der Grenze ist nicht dasselbe wie einer, der dreimal so
     alt ist wie erlaubt. Ohne Beleg gibt es KEIN Band, sondern null — eine
     Prognose ohne Grundlage wäre eine erfundene Zahl. */
  function bandFor(hull) {
    var h = hull || {};
    var base = h.evidence === 'strong' ? .03 : h.evidence === 'moderate' ? .05 : h.evidence === 'weak' ? .08 : null;
    if (base == null) return null;
    var extra = 0;
    if (h.ageRatio == null) extra = .02;                     // Datum fehlt
    else if (h.ageRatio > 1) extra = Math.min(.06, (h.ageRatio - 1) * .04);
    return Math.round((base + extra) * 1000) / 1000;
  }

  /* ---- Migration ----
     measured→strong · derived→moderate · estimated→weak · none→unknown.
     Bijektiv über diese vier Werte; toLegacy() existiert nur für den
     Verlustfreiheits-Test, nicht für den Produktivpfad. */
  var LEGACY_IN = { measured: 'strong', derived: 'moderate', estimated: 'weak', none: 'unknown' };
  var LEGACY_OUT = { strong: 'measured', moderate: 'derived', weak: 'estimated', unknown: 'none' };
  function fromLegacy(x) { return Object.prototype.hasOwnProperty.call(LEGACY_IN, x) ? LEGACY_IN[x] : 'unknown'; }
  function toLegacy(x) { return Object.prototype.hasOwnProperty.call(LEGACY_OUT, x) ? LEGACY_OUT[x] : 'none'; }

  /* Brücke aus der Messwertschicht (js/metrics/source-contract.js). Deren
     Vokabular bleibt dort; hier kommt es nur übersetzt an. */
  var METRIC_QUALITY = { measured: 'moderate', reported: 'weak', estimated: 'weak' };
  var METRIC_SOURCE = {
    measured_validated: 'strong', device_sync: 'moderate',
    profile_manual: 'weak', derived_estimate: 'weak'
  };
  function fromSourceContract(x) {
    if (Object.prototype.hasOwnProperty.call(METRIC_SOURCE, x)) return METRIC_SOURCE[x];
    if (Object.prototype.hasOwnProperty.call(METRIC_QUALITY, x)) return METRIC_QUALITY[x];
    return 'unknown';
  }

  function marker(level) {
    return Object.prototype.hasOwnProperty.call(MARKER, level) ? MARKER[level] : MARKER.unknown;
  }

  /* Die verbindliche Anzeigezeile. Eine Funktion, damit nicht drei Bildschirme
     drei Formulierungen erfinden.
       „Beleg: stark · Quelle: Wettkampf · Alter: 18 Tage · Status: aktuell" */
  function describe(hull) {
    var h = hull || {};
    var parts = ['Beleg: ' + (LEVEL_LABEL[h.evidence] || LEVEL_LABEL.unknown)];
    parts.push('Quelle: ' + (SOURCE_LABEL[h.source] || SOURCE_LABEL.default));
    if (h.ageDays != null) parts.push('Alter: ' + h.ageDays + (h.ageDays === 1 ? ' Tag' : ' Tage'));
    parts.push('Status: ' + (FRESH_LABEL[h.freshness] || FRESH_LABEL.unknown));
    return parts.join(' · ');
  }

  var api = {
    VERSION: VERSION,
    LEVELS: LEVELS, FRESHNESS: FRESHNESS,
    SOURCE_EVIDENCE: SOURCE_EVIDENCE, STALE_AFTER: STALE_AFTER,
    LEVEL_LABEL: LEVEL_LABEL, FRESH_LABEL: FRESH_LABEL, SOURCE_LABEL: SOURCE_LABEL,
    MARKER: MARKER,
    USABILITY_LIMIT: USABILITY_LIMIT,
    make: make, freshnessOf: freshnessOf, effective: effective, usability: usability, bandFor: bandFor,
    rank: rank, isLevel: isLevel, weakest: weakest,
    fromLegacy: fromLegacy, toLegacy: toLegacy, fromSourceContract: fromSourceContract,
    marker: marker, describe: describe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.evidence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
