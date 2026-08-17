/* ============================================================
   ORVIA · Quellenregister für "running" — EINGESPEIST, nicht von Hand geschrieben.

   Erzeugt von tools/knowledge-ingest.mjs aus:
     · QUELLE-04-kraft-fuer-laeufer.json
     · QUELLE-07-sperlich-laufoekonomie-2015.json
     · QUELLE-08-hoff-helgerud-2006.json
     · QUELLE-09-hirschmueller-achilles-2005.json
     · QUELLE-11-kanjuh-kraftprofile-2026.json
     · QUELLE-13-roeh-erholung-2022.json
   Änderungen gehören in die Notizdateien, nicht hierher: beim nächsten Lauf
   wird diese Datei überschrieben.

   Governance: technisch geprüft von Claude (technische Struktur, 2026-08-13),
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
        "sourceId": "SRC-LLANOS-2024",
        "title": "Effect of Strength Training Programs in Middle- and Long-Distance Runners' Economy at Different Running Speeds",
        "authorsOrOrg": "Llanos-Lagos, Ramirez-Campillo, Moran, Saez de Villarreal — Sports Medicine",
        "year": 2024,
        "sourceType": "systematic_review",
        "identifier": {
          "doi": "10.1007/s40279-023-01978-y"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer"
        ],
        "outcomes": [
          "laufoekonomie",
          "krafttraining"
        ],
        "appraisal": {
          "studyDesign": "systematic_review",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Krafttraining verbessert die Laufoekonomie von Mittel- und Langstreckenlaeufern, aber die Groesse des Effekts haengt stark von der Methode ab. Am besten schnitten kombinierte Programme ab, danach schweres Training mit hoher Last; plyometrisches Training half nur bei langsameren Geschwindigkeiten bis etwa 12 km/h. Submaximales und isometrisches Training zeigte keinen belastbaren Effekt. Die eingeschlossenen Programme liefen sechs bis vierundzwanzig Wochen mit ein bis vier Einheiten pro Woche.",
        "limitsAndTransferability": "Ich habe nur das Abstract gelesen, nicht den Volltext. Die Arbeit vergleicht Methoden, sie leitet keine optimale Dosis ab — die Angabe ein bis vier Einheiten pro Woche beschreibt, was untersucht wurde, nicht was empfohlen wird. Die Autoren bewerten die Sicherheit der Evidenz als moderat, fuer kombinierte Verfahren als niedrig. Konkrete Satz- und Wiederholungszahlen waren zwischen den Studien uneinheitlich und werden deshalb hier nicht uebernommen. Keine Aussage fuer Anfaenger ohne Krafterfahrung und keine fuer Wettkampfwochen.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-RAMOS-2025",
        "title": "The Effect of Strength Training on Endurance Performance Determinants in Middle- and Long-Distance Endurance Athletes: An Umbrella Review",
        "authorsOrOrg": "Ramos-Campo, Andreu-Caravaca, Clemente-Suarez, Rubio-Arias — Journal of Strength and Conditioning Research",
        "year": 2025,
        "sourceType": "systematic_review",
        "identifier": {
          "doi": "10.1519/JSC.0000000000005056"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer"
        ],
        "outcomes": [
          "laufoekonomie",
          "vo2max",
          "krafttraining"
        ],
        "appraisal": {
          "studyDesign": "systematic_review",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Diese Dachuebersicht fasst siebzehn systematische Reviews zusammen und findet ueber alle hinweg mittlere bis grosse Verbesserungen der Laufoekonomie durch Krafttraining, waehrend sich die maximale Sauerstoffaufnahme nicht bedeutsam veraendert. Plyometrisches Training wirkte auf die Ausdauerleistung nur schwach. Der Nutzen von Krafttraining fuer Ausdauersportler liegt danach in der Oekonomie der Bewegung, nicht in der aeroben Kapazitaet.",
        "limitsAndTransferability": "Ich habe nur das Abstract gelesen, nicht den Volltext. Die Autoren benennen selbst die entscheidende Schwaeche: die meisten eingeschlossenen Reviews hatten niedrige oder sehr niedrige methodische Vertrauenswuerdigkeit, mit Maengeln bei der Literatursuche, bei der Begruendung von Ausschluessen und im Umgang mit Publikationsbias. Eine Dachuebersicht ist nicht besser als das, was sie zusammenfasst. Keine Dosisangabe, keine Aussage fuer Anfaenger, keine fuer Wettkampfwochen.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-SPERLICH-2015",
        "title": "Trainingsinterventionen zur Modifikation der Laufoekonomie im Mittel- und Langstreckenlauf",
        "authorsOrOrg": "Sperlich B, Engel FA, Zinner C — Deutsche Zeitschrift fuer Sportmedizin 66(9), S. 229-234; Univ. Wuerzburg / KIT",
        "year": 2015,
        "sourceType": "systematic_review",
        "identifier": {
          "doi": "10.5960/dzsm.2015.192"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer",
          "halbmarathon",
          "marathon"
        ],
        "outcomes": [
          "laufoekonomie",
          "krafttraining",
          "intervalltraining",
          "hoehentraining"
        ],
        "appraisal": {
          "studyDesign": "systematic_review",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Die Uebersicht wertet sechsundvierzig begutachtete Studien dazu aus, welche Trainingsformen die Laufoekonomie veraendern. Krafttraining parallel zum Lauftraining verbessert sie bei Freizeit- und trainierten Laeufern um drei bis sieben Prozent, die Laufleistung um zwei bis sechs Prozent; negative Effekte sind in keiner Studie dokumentiert. Am staerksten wirken Maximalkraft und plyometrisches Explosivkrafttraining, waehrend Kraftausdauertraining in der Mehrheit der Studien nichts bewirkt. Hochintensives Intervalltraining bringt im Mittel gut drei Prozent. Den groessten Zusammenhang mit der Laufoekonomie zeigen jedoch die ueber Jahre angesammelten Trainingsumfaenge.",
        "limitsAndTransferability": "Uebersichtsarbeit, keine eigene Untersuchung. Erschienen 2015 — die neuere Meta-Analyse von Llanos-Lagos 2024 kommt bei Plyometrie zu einem zurueckhaltenderen Ergebnis. Die Autoren nennen die Datenlage bei Maximalkraft ausdruecklich widerspruechlich und bei Hoehentraining uneinheitlich. Entscheidend fuer eine Mehrnutzer-App: Untersuchungen mit Laeuferinnen fehlen nach Angabe der Autoren fast gaenzlich — die Befunde stuetzen sich praktisch auf maennliche Laeufer. Keine Aussage fuer Verletzte, Kinder oder Jugendliche. Angaben zu finanziellen Interessen: keine. Ich habe den Volltext als Textextraktion der PDF gelesen, nicht das Layout.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-HOFF-2006",
        "title": "Training und Testing physischer Kapazitaeten bei Elitefussballern",
        "authorsOrOrg": "Hoff J, Kaehler N, Helgerud J — Deutsche Zeitschrift fuer Sportmedizin 57(5), S. 116-124",
        "year": 2006,
        "sourceType": "systematic_review",
        "identifier": {
          "url": "https://www.germanjournalsportsmedicine.com/fileadmin/content/archiv2006/heft05/116-124.pdf"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer"
        ],
        "outcomes": [
          "krafttraining",
          "laufoekonomie"
        ],
        "appraisal": {
          "studyDesign": "systematic_review",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Die Uebersicht beschreibt Test- und Trainingsverfahren fuer Elitefussballer. Zwei Protokolle sind auch ausserhalb des Fussballs von Bedeutung, weil sie in der Ausdauerliteratur immer wieder auftauchen: vier Laufintervalle von vier Minuten bei neunzig bis fuenfundneunzig Prozent der maximalen Herzfrequenz mit je drei Minuten lockerem Traben dazwischen, und vier Serien zu vier Wiederholungen halbtiefer Kniebeugen mit betont maximaler Beschleunigung in der ueberwindenden Phase. Das Kraftprotokoll verbesserte die Laufoekonomie um vier Komma sieben Prozent und das Einwiederholungsmaximum um etwa zwei Prozent je Trainingseinheit bei bis zu drei Einheiten pro Woche.",
        "limitsAndTransferability": "Die Arbeit untersucht FUSSBALLSPIELER auf Elite- und Champions-League-Niveau, nicht Laeufer. Jede Uebertragung auf Freizeitlauf ist eine Schlussfolgerung von mir, kein Befund der Arbeit. Die Stichproben sind klein und die Ausgangswerte hoch (VO2max fuenfundfuenfzig bis achtundsechzig, Kniebeuge hundertzwanzig bis hundertachtzig Kilogramm) — wer dort startet, reagiert anders als ein Einsteiger. Es ist eine Uebersicht der eigenen Arbeitsgruppe, keine unabhaengige Synthese. Keine Aussage fuer Frauen, Jugendliche oder Verletzte. Ich habe die Arbeit als Textextraktion der PDF gelesen.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-HIRSCHMUELLER-2005",
        "title": "Quantifizierung der Kraftfaehigkeiten und der neuromuskulaeren Effizienz bei Gesunden und Laeufern mit chronischen Achillessehnenbeschwerden",
        "authorsOrOrg": "Hirschmueller A, Baur H, Mueller S, Mayer F — Deutsche Zeitschrift fuer Sportmedizin 56(2), S. 39-44",
        "year": 2005,
        "sourceType": "primary_study",
        "identifier": {
          "url": "https://www.germanjournalsportsmedicine.com/fileadmin/content/archiv2005/heft02/39-44.pdf"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer"
        ],
        "outcomes": [
          "achillessehne",
          "kraftdefizit"
        ],
        "appraisal": {
          "studyDesign": "primary_study",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Die Querschnittstudie vergleicht zweiundsiebzig maennliche Laeufer mit chronischen, einseitigen Achillessehnenbeschwerden mit zwanzig beschwerdefreien Laeufern, alle mit mehr als zweiunddreissig Kilometern pro Woche. Die Betroffenen zeigten geringere maximale Drehmomente der Plantarflexion, gleichzeitig aber HOEHERE Muskelaktivitaet — sie brauchten also mehr Ansteuerung fuer weniger Kraft. Der daraus gebildete Quotient neuromuskulaerer Effizienz war in der Patientengruppe deutlich niedriger. Bei der Dorsalextension fanden sich keine Unterschiede, und zwischen dem betroffenen und dem gesunden Bein ebenfalls nicht.",
        "limitsAndTransferability": "Querschnittstudie: sie zeigt einen Zusammenhang und KEINE Ursache. Ob das Kraftdefizit die Beschwerden mitverursacht oder aus ihnen folgt, laesst sich daraus nicht entscheiden. Die Autoren sagen ausdruecklich, dass eine diagnostische Erkennung im EINZELFALL nicht moeglich ist und dass sich die Ursache eines Unterschieds aus dem Quotienten allein nicht ablesen laesst. Ein von ihnen selbst benannter Schwachpunkt ist der Altersunterschied der Gruppen, neununddreissig gegen achtundzwanzig Jahre. Nur maennliche Laeufer. Ich habe die Arbeit als Textextraktion der PDF gelesen.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-KANJUH-2026",
        "title": "Erstellung von Kraftprofilen bei Mittel- und Langstreckenlaeufer*innen (Masterthesis)",
        "authorsOrOrg": "Mario Kanjuh — Hochschule Offenburg, M.Sc. Applied Research, Human Motion and Emotion",
        "year": 2026,
        "sourceType": "primary_study",
        "identifier": {
          "url": "https://opus.hs-offenburg.de/frontdoor/index/index/docId/11984"
        },
        "sports": [
          "running",
          "gym"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer"
        ],
        "outcomes": [
          "kraftprofil",
          "laufoekonomie",
          "laufbiomechanik",
          "geschlechtsunterschiede"
        ],
        "appraisal": {
          "studyDesign": "primary_study",
          "methodQuality": "low",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Die Querschnittarbeit misst bei siebenundvierzig Mittel- und Langstreckenlaeuferinnen und -laeufern vier isometrische Kraftwerte der unteren Extremitaet und prueft, ob sie mit Laufoekonomie, Leistungsniveau und Laufbiomechanik zusammenhaengen. Von sechs Hypothesen wurde eine teilweise bestaetigt, fuenf nicht. Weder normierte noch mittlere Kraft hing mit dem Energieaufwand pro Strecke oder der Zehn-Kilometer-Leistung zusammen; die Effekte lagen nahe null. Einzig die absolute Hueftabduktionskraft blieb nach Korrektur fuer multiples Testen mit einer geringeren seitlichen Knieabweichung verbunden. Absolut sind Maenner staerker, nach Normierung gleichen sich die Werte weitgehend an.",
        "limitsAndTransferability": "Masterthesis, nicht begutachtet — methodisch aber sorgfaeltiger als der Abstract vermuten laesst: Korrektur fuer multiples Testen nach FDR, geschwindigkeitslinearisierte Kennwerte als primaere Auswertung. Querschnittdesign, also Zusammenhang und keine Ursache. Der Autor warnt ausdruecklich davor, die Nullbefunde als Beleg fuer fehlende Zusammenhaenge zu lesen: die Teilgruppen sind klein, die Elite-Gruppe der Frauen umfasst eine Person, und die statistische Empfindlichkeit ist begrenzt. Nur vier Krafttests, nur die dominante Seite; Rumpf, Hueftstrecker, Knieheber und Kniebeuger fehlen. Isometrische Messungen reagieren auf Aufwaermen, Instruktion und Motivation. Urheberrechtlich geschuetzt.",
        "lastCheckedAt": "2026-08-13"
      },
      {
        "sourceId": "SRC-ROEH-2022",
        "title": "Auswirkungen von regelmaessiger Bewegung, akuter sportlicher Extrembelastung und Erholung anhand eines Marathonlaufes auf neurokognitive, psychopathologische und kardiovaskulaere Funktionen (Habilitationsschrift)",
        "authorsOrOrg": "Dr. Astrid Roeh — Klinik und Poliklinik fuer Psychiatrie und Psychotherapie, LMU Muenchen",
        "year": 2022,
        "sourceType": "primary_study",
        "identifier": {
          "url": "https://edoc.ub.uni-muenchen.de/"
        },
        "sports": [
          "running",
          "triathlon"
        ],
        "populations": [
          "freizeitlaeufer",
          "gut_trainierte_laeufer",
          "marathon"
        ],
        "outcomes": [
          "erholung",
          "herzfunktion",
          "extrembelastung",
          "kognition"
        ],
        "appraisal": {
          "studyDesign": "primary_study",
          "methodQuality": "moderate",
          "riskOfBias": "not_formally_assessed"
        },
        "summary": "Die kumulative Habilitationsschrift buendelt eigene begutachtete Originalarbeiten zu den Wirkungen von regelmaessigem Training, einer akuten Extrembelastung in Form eines Marathonlaufs und der anschliessenden Erholung. Drei Befunde stechen heraus. Nach dem Marathon war die diastolische Herzfunktion eingeschraenkt, und zwar ueber den gesamten Beobachtungszeitraum von zweiundsiebzig Stunden hinweg; die systolische Funktion blieb unberuehrt. Herzschaedigungsmarker normalisierten sich in derselben Zeit. Und kognitiv profitierten die Teilnehmenden am staerksten von der Kombination aus regelmaessigem Training UND zusaetzlichen akuten intensiven Einheiten, nicht vom regelmaessigen Training allein.",
        "limitsAndTransferability": "Habilitationsschrift, kumulativ auf begutachteten Originalarbeiten aufgebaut — das ist eine hoehere Stufe als eine Master- oder Bachelorarbeit, aber weiterhin die Darstellung der eigenen Arbeitsgruppe. Ob die beobachteten Herzveraenderungen bleibende Schaeden oder voruebergehende Anpassungen sind, konnte die Autorin nicht abschliessend klaeren; die Datenlage zu nachteiligen Effekten sehr hoher Belastungen ist insgesamt duenner als die zu positiven. Ein Teil der berichteten Messungen war zum Zeitpunkt der Schrift unveroeffentlicht; darauf stuetzt sich hier nichts. Die Autorin nennt als uebergreifendes Problem, dass Sportstudien mangels einheitlicher Vorgaben schlecht vergleichbar sind. Keine Aussage fuer Kinder oder Menschen mit Herzerkrankungen.",
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
  O.knowledgeSources_running_notizen = registry;
})(typeof globalThis !== 'undefined' ? globalThis : this);
