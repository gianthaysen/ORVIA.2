/* ============================================================
   ORVIA · knowledge-consumer@1 — der fehlende Anschluss (v8-341)

   BEFUND, der zu diesem Modul führte. Nach v8-339 hatte Gym ein
   Wissenspaket, es war in index.html eingebunden, im Offline-Vorrat, und
   ein Test bewachte beides. Trotzdem änderte es am Verhalten der App
   NICHTS — denn eine Suche über das gesamte Projekt ergab:

       applyKnowledge wird von KEINER Stelle der App aufgerufen.

   Die Kette Quelle → Regel → Vorgabe → Verordnung → Karte lief bis dahin
   ausschließlich in meinen Prüfskripten. In der laufenden App endete sie
   an `scheduler-v2`, das `buildPrescription` OHNE `knowledge` aufruft.
   Das ist derselbe Befund wie v8-335 („eingespeist, aber niemand liest
   es"), nur eine Ebene höher — und er wäre wieder nicht aufgefallen, weil
   alles grün war.

   WAS DIESES MODUL TUT: es hält die Liste der bekannten Pakete je Sportart
   samt ihren Pins und reicht sie an `applyKnowledge`. Mehr nicht. Es
   entscheidet nichts, es rechnet nichts, es kennt keine Trainingslehre.

   WARUM DIE PINS HIER STEHEN UND NICHT IM PAKET: der Wissensvertrag
   verlangt, dass der Consumer die erwartete Version und den erwarteten
   Inhaltshash UNABHÄNGIG hinterlegt. Läse man sie zur Laufzeit aus dem
   Paket, bestätigte das Paket sich selbst und die Prüfung wäre wertlos.
   Konkret heißt das: wird ein Paket neu erzeugt, ändert sich sein Hash,
   und es BLOCKIERT — bis jemand die Zahl hier bewusst nachzieht. Das ist
   Absicht und keine Unbequemlichkeit, die man wegautomatisieren sollte.

   FAIL-CLOSED: fehlt ein Modul, ist ein Hash falsch oder wirft etwas, gibt
   es kein Wissen und einen benannten Grund — nie ein stilles Teilergebnis.
   Der Aufrufer verhält sich dann exakt wie vor diesem Modul.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'knowledge-consumer@1';

  /* Die Registrierung je Sportart. `packGlobal`/`registryGlobal` sind die
     Namen, unter denen die erzeugten Module sich eintragen — sie werden
     erst beim Aufruf aufgelöst, damit die Ladereihenfolge egal ist. */
  var PAKETE = {
    gym: [{
      id: 'gym-friedmann-2007',
      packGlobal: 'knowledgePack_gym',
      registryGlobal: 'knowledgeSources_gym',
      /* [PIN] Erzeugt aus docs/wissen/QUELLE-05-friedmann-krafttraining-2007.json
         am 2026-08-13. Ändert sich das Paket, gehören diese beiden Zeilen
         bewusst nachgezogen — sonst blockiert es, und das ist richtig so. */
      pins: {
        expectedKnowledgeContractVersion: 6,
        expectedKnowledgeVersion: 'kb-gym-v1.0.0',
        expectedPackContentHash: 'fnv1a-6d2e4658',
        expectedSourceRegistryVersion: 1,
        expectedSourceRegistryHash: 'fnv1a-60e813e0'
      }
    }]
    /* running: das handgepflegte Paket läuft weiterhin über seinen eigenen
       Consumer (running-capacity-factory, Shadow-Modus). Es hier zusätzlich
       einzuhängen würde zwei Wege auf dieselben Regeln öffnen — erst
       zusammenführen, dann eintragen. */
  };

  function _global(name) {
    if (typeof name !== 'string' || !name) return null;
    var v = O[name];
    return (v && typeof v === 'object') ? v : null;
  }

  /* wissenFuer(sportId) → { ok, vorgaben, konflikte, … } | { ok:false, grund }
     Der Rückgabewert ist genau das, was `prescription-factory` als
     `req.knowledge` erwartet. */
  function wissenFuer(sportId) {
    var leer = function (grund) {
      return { ok: false, grund: grund, vorgaben: [], konflikte: [], ausgeschlossen: [], version: VERSION };
    };
    if (typeof sportId !== 'string' || !sportId) return leer('sport_fehlt');
    var eintraege = PAKETE[sportId];
    if (!Array.isArray(eintraege) || !eintraege.length) return leer('kein_paket_fuer_sportart');

    var KA = O.knowledgeApplication;
    if (!KA || typeof KA.applyKnowledge !== 'function') return leer('anwendung_fehlt');

    var pakete = [];
    for (var i = 0; i < eintraege.length; i++) {
      var e = eintraege[i];
      var pack = _global(e.packGlobal), registry = _global(e.registryGlobal);
      /* Ein fehlendes Modul ist kein leeres Wissen, sondern ein Ladefehler.
         Der Unterschied zählt: das eine heißt "nichts zu sagen", das
         andere "die Datei ist nicht da". */
      if (!pack || !registry) return leer('modul_fehlt:' + e.id);
      pakete.push({ pack: pack, registry: registry, pins: e.pins, sport: sportId });
    }

    var erg;
    try { erg = KA.applyKnowledge({ packs: pakete }); }
    catch (ex) { return leer('anwendung_warf'); }
    if (!erg || erg.ok !== true) return leer((erg && erg.grund) || 'anwendung_blockiert');
    return erg;
  }

  /* Für Diagnose und Tests: was ist überhaupt registriert? */
  function registrierteSportarten() { return Object.keys(PAKETE); }

  var api = { VERSION: VERSION, wissenFuer: wissenFuer, registrierteSportarten: registrierteSportarten };
  if (typeof Object.freeze === 'function') Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.knowledgeConsumer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
