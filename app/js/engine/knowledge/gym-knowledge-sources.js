/* ============================================================
   ORVIA · Quellenregister für "gym" — EINGESPEIST, nicht von Hand geschrieben.

   Erzeugt von tools/knowledge-ingest.mjs aus QUELLE-05-friedmann-krafttraining-2007.json.
   Änderungen gehören in die Notizdatei, nicht hierher: beim nächsten Lauf
   wird diese Datei überschrieben.

   Governance: technisch geprüft von Claude (Aufbereitung, Zahlen doppelt ausgelesen),
   wissenschaftlich ungeprüft. Eine wissenschaftliche Freigabe vergibt das
   Werkzeug nicht — sie erfordert einen qualifizierten Prüfer über den
   Vertragsweg.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var registry = {
    registryVersion: 1,
    sources: [
      {
        "sourceId": "SRC-FRIEDMANN-2007",
        "title": "Neuere Entwicklungen im Krafttraining. Muskulaere Anpassungsreaktionen bei verschiedenen Krafttrainingsmethoden",
        "authorsOrOrg": "Birgit Friedmann — Deutsche Zeitschrift fuer Sportmedizin 58(1), S. 12-18",
        "year": 2007,
        "sourceType": "narrative_review",
        "identifier": {
          "url": "https://www.germanjournalsportsmedicine.com/fileadmin/content/archiv2007/heft01/11-18.pdf"
        },
        "sports": [
          "gym"
        ],
        "populations": [
          "freizeitsportler",
          "krafttraining_fortgeschritten"
        ],
        "outcomes": [
          "hypertrophie",
          "trainingsmethoden",
          "anpassungsreaktionen"
        ],
        "appraisal": {
          "studyDesign": "narrative_review",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Der Uebersichtsartikel ordnet die muskulaeren Anpassungen an verschiedene Krafttrainingsmethoden ein. Zuerst passt sich die Ansteuerung an, erst danach folgen morphologische Veraenderungen: groesserer Muskelquerschnitt und eine Verschiebung der Fasertypen von Typ IIX zu Typ IIA. Fuer Hypertrophie beschreibt die Autorin als besonders wirksam sechzig bis fuenfundachtzig Prozent des Einwiederholungsmaximums, sechs bis zwanzig Wiederholungen, fuenf bis sechs Saetze je Muskelgruppe und zwei bis drei Minuten Satzpause. Der fuer eine Trainings-App wichtigste Befund ist ein anderer: die Streuung zwischen einzelnen Menschen ist enorm. Fuer neuere Verfahren reicht die Datenlage nicht aus.",
        "limitsAndTransferability": "Uebersichtsarbeit, keine eigene Untersuchung — sie referiert Studienlage, sie erzeugt sie nicht. Erschienen 2007, also rund neunzehn Jahre alt; gerade beim Krafttraining hat sich die Studienlage seither bewegt, etwa bei Volumen-Wirkungs-Beziehung und Abstand zum Muskelversagen. Die Zahlenangaben sind Beschreibungen dessen, was sich in den zitierten Studien als wirksam zeigte, nicht als Empfehlung der Autorin formuliert. Die Autorin sagt ausdruecklich, dass es fuer die neueren Methoden weiterer Untersuchungen bedarf, bevor allgemeine Empfehlungen moeglich sind. Keine Aussage fuer Kinder, Jugendliche, Aeltere ueber vierzig oder Personen mit Vorerkrankungen. Ich habe die PDF ueber ein Abrufwerkzeug gelesen, nicht Seite fuer Seite selbst — die Zahlen sind mit einem zweiten unabhaengigen Auslesen gegengeprueft, ein Uebertragungsfehler bleibt trotzdem moeglich.",
        "lastCheckedAt": "2026-08-13"
      }
    ],
    contentHash: null
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.registryContentHash === 'function') {
    registry.contentHash = O.knowledgeContracts.registryContentHash(registry);
  }
  registry.byId = {};
  registry.sources.forEach(function (s) { registry.byId[s.sourceId] = s; });
  if (typeof module !== 'undefined' && module.exports) module.exports = registry;
  O.knowledgeSources_gym = registry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
