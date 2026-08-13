/* ============================================================
   ORVIA · Wissenspaket für "running" — EINGESPEIST, nicht von Hand geschrieben.

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
  var pack = {
    packId: "running-notizen",
    version: 1,
    knowledgeVersion: "kb-running-notizen-v1.0.0",
    sport: "running",
    rules: [
      {
        "ruleId": "RUN-KRAFT-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "krafttraining_fuer_laeufer",
        "statement": "Laeufer trainieren Kraft, um die Laufoekonomie zu verbessern, nicht um die maximale Sauerstoffaufnahme zu steigern. Wirksam sind schwere Lasten und kombinierte Programme; submaximales und isometrisches Training zeigt keinen belastbaren Effekt.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "session.exercises",
          "plan.strength_focus"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "krafttraining_anfaenger",
          "wettkampfwoche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel bei schwerer Last mit deutlichem Abstand zum Muskelversagen bleiben und die Krafteinheit nicht in die 48 Stunden vor einer harten Laufeinheit legen.",
        "claims": [
          {
            "statement": "Laeufer trainieren Kraft, um die Laufoekonomie zu verbessern, nicht um die maximale Sauerstoffaufnahme zu steigern. Wirksam sind schwere Lasten und kombinierte Programme; submaximales und isometrisches Training zeigt keinen belastbaren Effekt.",
            "sourceRefs": [
              "SRC-LLANOS-2024",
              "SRC-RAMOS-2025"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "krafttraining_fuer_laeufer",
            "directness": "direct",
            "uncertainties": [
              "Die Effektgroessen sind klein bis mittel (ES -0,27 fuer hohe Last, -0,43 fuer kombinierte Methoden) — messbar, aber kein Leistungssprung",
              "Die Sicherheit der Evidenz wird von den Autoren als moderat bis niedrig bewertet",
              "Beide Arbeiten nur als Abstract gelesen, nicht im Volltext",
              "Der Uebertrag auf eine konkrete Halbmarathonzeit ist in keiner der beiden Quellen beziffert"
            ],
            "essential": true,
            "claimId": "RUN-KRAFT-001-C1",
            "use": "qualitative",
            "sourceCombination": "primary_plus_supplementary",
            "supportBasis": "Aussage der Quelle zu: krafttraining_fuer_laeufer",
            "synthesis": {
              "consistency": "consistent"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KRAFT-002",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "plyometrie",
        "statement": "Sprungkrafttraining wirkt auf die Laufoekonomie nur im langsameren Geschwindigkeitsbereich bis etwa zwoelf Kilometer pro Stunde und traegt zur Ausdauerleistung insgesamt wenig bei. Es ersetzt kein schweres Krafttraining.",
        "inputs": [
          "profile.goal"
        ],
        "outputs": [
          "session.exercises"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer"
          ]
        },
        "excludedPopulations": [
          "krafttraining_anfaenger",
          "wettkampfwoche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel weglassen. Der belegte Nutzen ist klein, die Belastung fuer Achillessehne und Knie ist es nicht.",
        "claims": [
          {
            "statement": "Sprungkrafttraining wirkt auf die Laufoekonomie nur im langsameren Geschwindigkeitsbereich bis etwa zwoelf Kilometer pro Stunde und traegt zur Ausdauerleistung insgesamt wenig bei. Es ersetzt kein schweres Krafttraining.",
            "sourceRefs": [
              "SRC-LLANOS-2024",
              "SRC-RAMOS-2025"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer",
            "applicability": "freizeitlaeufer",
            "outcome": "plyometrie",
            "directness": "direct",
            "uncertainties": [
              "Die Geschwindigkeitsgrenze von zwoelf Kilometern pro Stunde stammt aus der Moderatoranalyse einer Meta-Analyse, nicht aus einer eigens dafuer angelegten Untersuchung",
              "Sprungbelastung erhoeht die Sehnenbelastung — dazu sagen beide Quellen nichts"
            ],
            "essential": true,
            "claimId": "RUN-KRAFT-002-C1",
            "use": "qualitative",
            "sourceCombination": "primary_plus_supplementary",
            "supportBasis": "Aussage der Quelle zu: plyometrie",
            "synthesis": {
              "consistency": "consistent"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-RE-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "krafttraining_fuer_laeufer",
        "statement": "Krafttraining zusaetzlich zum Lauftraining verbessert die Laufoekonomie um drei bis sieben Prozent und die Laufleistung um zwei bis sechs Prozent. Es veraendert dabei weder Koerpermasse noch fettfreie Masse noch Extremitaetenumfaenge — der Gewinn ist neuromuskulaer, nicht muskelaufbaubedingt.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "session.exercises",
          "plan.strength_focus"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "halbmarathon",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung",
          "wettkampfwoche"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel Krafttraining ergaenzend zum Laufumfang planen, nicht anstelle davon.",
        "claims": [
          {
            "statement": "Krafttraining zusaetzlich zum Lauftraining verbessert die Laufoekonomie um drei bis sieben Prozent und die Laufleistung um zwei bis sechs Prozent. Es veraendert dabei weder Koerpermasse noch fettfreie Masse noch Extremitaetenumfaenge — der Gewinn ist neuromuskulaer, nicht muskelaufbaubedingt.",
            "sourceRefs": [
              "SRC-SPERLICH-2015"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "outcome": "krafttraining_fuer_laeufer",
            "directness": "direct",
            "uncertainties": [
              "Die Datenlage zum Maximalkrafttraining nennen die Autoren ausdruecklich widerspruechlich: Studien mit aehnlicher Intensitaet, Dauer und Haeufigkeit zeigten teils keine Veraenderung",
              "Fast alle eingeschlossenen Studien fuehrten das Krafttraining ZUSAETZLICH zum normalen Lauftraining durch — ueber einen Ersatz sagt die Arbeit nichts",
              "Untersuchungen mit Laeuferinnen fehlen nach Angabe der Autoren fast gaenzlich",
              "Interventionsdauer der Studien bis zehn Wochen — laengerfristige Effekte sind nicht abgedeckt"
            ],
            "essential": true,
            "claimId": "RUN-RE-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: krafttraining_fuer_laeufer",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-RE-002",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "kraftausdauertraining",
        "statement": "Kraftausdauertraining mit hoher Wiederholungszahl und wenig oder keinem Zusatzgewicht verbessert die Laufoekonomie in der Mehrheit der Studien nicht. Fuer Laeufer ist es die am schlechtesten belegte Kraftform und keine Alternative zu schwerem Training.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "session.exercises"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "halbmarathon",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung",
          "wettkampfwoche"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel weglassen und die Zeit in schweres Krafttraining oder Laufumfang stecken. Wer es aus anderen Gruenden macht, sollte es nicht als Oekonomietraining verbuchen.",
        "claims": [
          {
            "statement": "Kraftausdauertraining mit hoher Wiederholungszahl und wenig oder keinem Zusatzgewicht verbessert die Laufoekonomie in der Mehrheit der Studien nicht. Fuer Laeufer ist es die am schlechtesten belegte Kraftform und keine Alternative zu schwerem Training.",
            "sourceRefs": [
              "SRC-SPERLICH-2015"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "outcome": "kraftausdauertraining",
            "directness": "direct",
            "uncertainties": [
              "Zwei der eingeschlossenen Studien fanden doch eine Verbesserung um 2,4 bis 4 Prozent — der Befund ist nicht einstimmig",
              "Die 3-km-Laufleistung blieb auch dort unveraendert",
              "Ueber andere Ziele als Laufoekonomie — etwa Verletzungspraevention oder Technikgrundlage — sagt der Befund nichts",
              "Untersuchungen mit Laeuferinnen fehlen fast gaenzlich"
            ],
            "essential": true,
            "claimId": "RUN-RE-002-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: kraftausdauertraining",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-RE-003",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "maximalkraft_dosis",
        "statement": "Die in den erfolgreichen Studien verwendete Maximalkraftdosis waren hohe Lasten mit etwa vier bis fuenf Serien zu drei bis vier Wiederholungen je Trainingseinheit ueber sechs bis zehn Wochen.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "plan.maximalkraft_dosis"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "halbmarathon",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung",
          "wettkampfwoche"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel wenige schwere Saetze einer Grunduebung statt vieler Saetze ueber viele Uebungen — und nicht innerhalb von 48 Stunden vor einer harten Laufeinheit.",
        "claims": [
          {
            "statement": "Die in den erfolgreichen Studien verwendete Maximalkraftdosis waren hohe Lasten mit etwa vier bis fuenf Serien zu drei bis vier Wiederholungen je Trainingseinheit ueber sechs bis zehn Wochen.",
            "sourceRefs": [
              "SRC-SPERLICH-2015"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "outcome": "maximalkraft_dosis",
            "directness": "direct",
            "uncertainties": [
              "Die Arbeit schreibt 'pro Trainingseinheit' und laesst offen, ob sich das auf die Haupthebung oder auf die gesamte Einheit bezieht — deshalb speist diese Zahl NICHT session.sets",
              "Es ist die in Studien angewendete Dosis, keine abgeleitete Optimaldosis",
              "Studien mit gleicher Dosis zeigten teils keinen Effekt — die Zahl garantiert nichts",
              "Untersuchungen mit Laeuferinnen fehlen fast gaenzlich"
            ],
            "essential": true,
            "claimId": "RUN-RE-003-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: maximalkraft_dosis",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-RE-004",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "plyometrie",
        "statement": "Plyometrisches und Explosivkrafttraining wurde in den erfolgreichen Studien ueber sechs bis zwoelf Wochen mit zwei bis drei Einheiten pro Woche durchgefuehrt, mit Spruengen und Sprints bei geringem bis keinem Zusatzgewicht. Die Ergebnislage ist uneinheitlich.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "session.exercises",
          "plan.plyometrie_frequenz"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "halbmarathon",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung",
          "wettkampfwoche"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel weglassen. Bei uneinheitlicher Wirksamkeit und unbezifferter Sehnenbelastung ist die vorsichtige Variante der Verzicht.",
        "claims": [
          {
            "statement": "Plyometrisches und Explosivkrafttraining wurde in den erfolgreichen Studien ueber sechs bis zwoelf Wochen mit zwei bis drei Einheiten pro Woche durchgefuehrt, mit Spruengen und Sprints bei geringem bis keinem Zusatzgewicht. Die Ergebnislage ist uneinheitlich.",
            "sourceRefs": [
              "SRC-SPERLICH-2015"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "outcome": "plyometrie",
            "directness": "direct",
            "uncertainties": [
              "Von elf Studien zeigten sieben Untergruppen eine Verbesserung und sieben weitere keine signifikante Veraenderung — das ist ein Muenzwurf, kein Befund",
              "Die neuere Meta-Analyse Llanos-Lagos 2024 stuft Plyometrie zurueckhaltender ein: kleiner Effekt und nur bis etwa zwoelf Kilometer pro Stunde. Diese Uebersicht von 2015 zaehlt sie dagegen zu den wirksamsten Formen — ein offener Widerspruch zwischen zwei Quellen",
              "Zur Sehnenbelastung durch Sprungtraining sagt die Arbeit nichts",
              "Untersuchungen mit Laeuferinnen fehlen fast gaenzlich"
            ],
            "essential": true,
            "claimId": "RUN-RE-004-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: plyometrie",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-RE-005",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "erwartungsrahmen",
        "statement": "Den staerksten Zusammenhang mit der Laufoekonomie zeigen nicht einzelne Trainingsformen, sondern die ueber Jahre angesammelten Trainingsjahre und Trainingsumfaenge. Kurzfristige Interventionen bewegen sich im Bereich weniger Prozent.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "plan.erwartungsrahmen"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "halbmarathon",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung",
          "wettkampfwoche"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keine Prozentprognose ausgeben, sondern die Groessenordnung nennen und auf die Dauer verweisen.",
        "claims": [
          {
            "statement": "Den staerksten Zusammenhang mit der Laufoekonomie zeigen nicht einzelne Trainingsformen, sondern die ueber Jahre angesammelten Trainingsjahre und Trainingsumfaenge. Kurzfristige Interventionen bewegen sich im Bereich weniger Prozent.",
            "sourceRefs": [
              "SRC-SPERLICH-2015"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, halbmarathon, marathon",
            "outcome": "erwartungsrahmen",
            "directness": "direct",
            "uncertainties": [
              "Es handelt sich um einen Zusammenhang, nicht um einen nachgewiesenen Ursache-Wirkungs-Beleg — wer jahrelang viel laeuft, unterscheidet sich auch sonst",
              "Die Autoren beziffern den Zusammenhang im Text nicht als Effektgroesse",
              "Untersuchungen mit Laeuferinnen fehlen fast gaenzlich"
            ],
            "essential": true,
            "claimId": "RUN-RE-005-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: erwartungsrahmen",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-DOSE-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "maximalkraft_dosis",
        "statement": "Das in der Ausdauerliteratur wiederkehrende Maximalkraftprotokoll besteht aus vier Serien zu vier Wiederholungen EINER halbtiefen Kniebeuge mit betont maximaler Beschleunigung in der ueberwindenden Phase. Die Satzzahl bezieht sich auf die Grunduebung, nicht auf die Summe aller Uebungen einer Einheit.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.maximalkraft_dosis"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel weniger Saetze einer sauber beherrschten Grunduebung statt vieler Saetze ueber viele Uebungen.",
        "claims": [
          {
            "statement": "Das in der Ausdauerliteratur wiederkehrende Maximalkraftprotokoll besteht aus vier Serien zu vier Wiederholungen EINER halbtiefen Kniebeuge mit betont maximaler Beschleunigung in der ueberwindenden Phase. Die Satzzahl bezieht sich auf die Grunduebung, nicht auf die Summe aller Uebungen einer Einheit.",
            "sourceRefs": [
              "SRC-HOFF-2006"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "maximalkraft_dosis",
            "directness": "direct",
            "uncertainties": [
              "Untersucht wurden Elitefussballer, nicht Laeufer — die Uebertragung ist meine Schlussfolgerung",
              "Die Ausgangswerte lagen hoch (Kniebeuge 120-180 kg); fuer Einsteiger sagt das Protokoll nichts",
              "Uebersicht der eigenen Arbeitsgruppe, keine unabhaengige Synthese",
              "Der Bewegungsauftrag maximale Beschleunigung ist wesentlich und laesst sich nicht als Zahl abbilden"
            ],
            "essential": true,
            "claimId": "RUN-DOSE-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: maximalkraft_dosis",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-DOSE-002",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "progression",
        "statement": "Die berichtete Kraftzunahme lag bei etwa zwei Prozent des Einwiederholungsmaximums je Trainingseinheit, bei bis zu drei Einheiten pro Woche. Das ist eine beobachtete Rate unter Studienbedingungen, keine planbare Zusage.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.erwartungsrahmen"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keine Zuwachsrate anzeigen. Eine hochgerechnete Prozentrate erzeugt Erwartungen, die niemand belegt hat.",
        "claims": [
          {
            "statement": "Die berichtete Kraftzunahme lag bei etwa zwei Prozent des Einwiederholungsmaximums je Trainingseinheit, bei bis zu drei Einheiten pro Woche. Das ist eine beobachtete Rate unter Studienbedingungen, keine planbare Zusage.",
            "sourceRefs": [
              "SRC-HOFF-2006"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "progression",
            "directness": "direct",
            "uncertainties": [
              "Beobachtete Rate bei Elitefussballern mit hoher Ausgangskraft, nicht bei Freizeitlaeufern",
              "Eine gleichbleibende Prozentrate je Einheit ist ueber laengere Zeitraeume rechnerisch unmoeglich — sie gilt nur fuer die untersuchte Phase",
              "Uebersicht der eigenen Arbeitsgruppe"
            ],
            "essential": true,
            "claimId": "RUN-DOSE-002-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: progression",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-ACH-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "achillessehne",
        "statement": "Laeufer mit chronischen Achillessehnenbeschwerden zeigen im Gruppenvergleich geringere Wadenkraft bei gleichzeitig hoeherer Muskelansteuerung. Ob das Defizit Ursache oder Folge der Beschwerden ist, ist ungeklaert — und eine Einzelfallbeurteilung ist daraus ausdruecklich nicht ableitbar.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.achillessehne_hinweis"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "laeuferinnen_evidenzluecke",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [
          "Diese Regel darf nie zu einer Verdachtsdiagnose oder Entwarnung im Einzelfall fuehren",
          "Bei Schmerz an der Achillessehne endet die Zustaendigkeit der App: Verweis auf aerztliche oder physiotherapeutische Abklaerung",
          "Kein Trainingsvorschlag zur Behandlung von Sehnenbeschwerden ohne fachliche Freigabe"
        ],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keine Aussage machen. Bei Achillesbeschwerden gehoert die Beurteilung zu Aerztin oder Physiotherapie, nicht in eine App.",
        "claims": [
          {
            "statement": "Laeufer mit chronischen Achillessehnenbeschwerden zeigen im Gruppenvergleich geringere Wadenkraft bei gleichzeitig hoeherer Muskelansteuerung. Ob das Defizit Ursache oder Folge der Beschwerden ist, ist ungeklaert — und eine Einzelfallbeurteilung ist daraus ausdruecklich nicht ableitbar.",
            "sourceRefs": [
              "SRC-HIRSCHMUELLER-2005"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "achillessehne",
            "directness": "direct",
            "uncertainties": [
              "Querschnittstudie — Zusammenhang, kein Ursache-Wirkungs-Beleg",
              "Die Autoren schliessen eine diagnostische Erkennung im Einzelfall ausdruecklich aus",
              "Die Gruppen unterschieden sich im Alter deutlich (39 gegen 28 Jahre); das haben die Autoren selbst als Schwachpunkt benannt",
              "Nur maennliche Laeufer mit mehr als 32 km pro Woche",
              "Kein Unterschied zwischen betroffenem und gesundem Bein — das spricht gegen eine einfache lokale Erklaerung"
            ],
            "essential": true,
            "claimId": "RUN-ACH-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: achillessehne",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": true,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "required_unreviewed",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KRAFTPROFIL-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "kraftvergleich",
        "statement": "Kraftwerte von Laeuferinnen und Laeufern werden auf die Koerpermasse normiert verglichen, nicht absolut. Absolut erscheinen Maenner deutlich staerker; nach Normierung gleichen sich die Werte weitgehend an. Ein absoluter Vergleich bildet vor allem Koerpergroesse ab.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.kraftvergleich_normierung"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "akute_verletzung",
          "krafttraining_anfaenger"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel gar keinen Kraftvergleich zwischen Personen anzeigen.",
        "claims": [
          {
            "statement": "Kraftwerte von Laeuferinnen und Laeufern werden auf die Koerpermasse normiert verglichen, nicht absolut. Absolut erscheinen Maenner deutlich staerker; nach Normierung gleichen sich die Werte weitgehend an. Ein absoluter Vergleich bildet vor allem Koerpergroesse ab.",
            "sourceRefs": [
              "SRC-KANJUH-2026"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "kraftvergleich",
            "directness": "direct",
            "uncertainties": [
              "Querschnittdesign mit siebenundvierzig Personen, davon dreizehn Frauen",
              "Masterthesis, nicht begutachtet",
              "Die Angleichung nach Normierung ist deutlich, aber nicht vollstaendig: bei Plantarflexion und Hueftabduktion bleiben Maenner tendenziell hoeher",
              "Nur die dominante Seite gemessen"
            ],
            "essential": true,
            "claimId": "RUN-KRAFTPROFIL-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: kraftvergleich",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KRAFTPROFIL-002",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "leistungsprognose",
        "statement": "Aus isolierten isometrischen Krafttests laesst sich weder die Laufoekonomie noch das Leistungsniveau vorhersagen. In der untersuchten Stichprobe lagen die Zusammenhaenge nahe null und ueberstanden die Korrektur fuer multiples Testen nicht. Eine App darf aus einem Krafttest keine Leistungsprognose ableiten.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.leistungsprognose"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "akute_verletzung",
          "krafttraining_anfaenger"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keine Prognose ausgeben. Ein Krafttest beschreibt einen Ist-Zustand, keine Laufleistung.",
        "claims": [
          {
            "statement": "Aus isolierten isometrischen Krafttests laesst sich weder die Laufoekonomie noch das Leistungsniveau vorhersagen. In der untersuchten Stichprobe lagen die Zusammenhaenge nahe null und ueberstanden die Korrektur fuer multiples Testen nicht. Eine App darf aus einem Krafttest keine Leistungsprognose ableiten.",
            "sourceRefs": [
              "SRC-KANJUH-2026"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "leistungsprognose",
            "directness": "direct",
            "uncertainties": [
              "Das ist ein Nullbefund bei begrenzter statistischer Empfindlichkeit — der Autor warnt ausdruecklich davor, ihn als Beleg fuer fehlende Zusammenhaenge zu lesen",
              "Fehlende Evidenz ist nicht dasselbe wie belegte Wirkungslosigkeit",
              "Nur vier Krafttests; Rumpf, Hueftstrecker, Knieheber und Kniebeuger wurden nicht gemessen",
              "Reaktive Kraft und sehnenspezifische Kennwerte liegen dem Laufen naeher als isolierte Maximalkrafttests und fehlen hier",
              "Kein Widerspruch zu Sperlich 2015 oder Llanos-Lagos 2024: die messen, ob KrafttraiNING die Oekonomie verbessert, nicht ob ein KraftWERT sie vorhersagt"
            ],
            "essential": true,
            "claimId": "RUN-KRAFTPROFIL-002-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: leistungsprognose",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KRAFTPROFIL-003",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "hueftabduktion",
        "statement": "Eine hoehere absolute Hueftabduktionskraft ging mit einer geringeren seitlichen Knieabweichung beim Laufen einher. Es ist der einzige Zusammenhang der Arbeit, der die Korrektur fuer multiples Testen ueberstanden hat, und der mit dem groessten erklaerten Varianzanteil.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "session.exercises",
          "plan.stabilitaetsfokus"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "akute_verletzung",
          "krafttraining_anfaenger"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel Hueftabduktion als sinnvolle, risikoarme Ergaenzung behandeln — ohne Versprechen zur Knie- oder Verletzungssituation.",
        "claims": [
          {
            "statement": "Eine hoehere absolute Hueftabduktionskraft ging mit einer geringeren seitlichen Knieabweichung beim Laufen einher. Es ist der einzige Zusammenhang der Arbeit, der die Korrektur fuer multiples Testen ueberstanden hat, und der mit dem groessten erklaerten Varianzanteil.",
            "sourceRefs": [
              "SRC-KANJUH-2026"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "hueftabduktion",
            "directness": "direct",
            "uncertainties": [
              "Querschnittdesign — der Zusammenhang belegt keine Ursache und kein Trainingseffekt ist damit gezeigt",
              "Der Befund gilt fuer die ABSOLUTE Kraft; normiert auf die Koerpermasse war er nicht signifikant, was gegen eine einfache Deutung spricht",
              "Ein Zusammenhang mit Verletzungen wird in der Arbeit NICHT untersucht und darf daraus nicht abgeleitet werden",
              "Die Richtung des Befunds haengt an Achsdefinition und Vorzeichenkonvention des Modells"
            ],
            "essential": true,
            "claimId": "RUN-KRAFTPROFIL-003-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: hueftabduktion",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KRAFTPROFIL-004",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "referenzbereiche",
        "statement": "Die gemessenen Kraftbereiche dieser Stichprobe dienen der Einordnung, nicht als Zielwert: Beinpresse rund vierunddreissig Newton je Kilogramm, Plantarflexion rund drei Newtonmeter je Kilogramm, Hueftabduktion rund zwei Komma drei, Inversion rund null Komma drei fuenf — jeweils mit erheblicher Streuung zwischen einzelnen Personen.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.kraftreferenz"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "akute_verletzung",
          "krafttraining_anfaenger"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keinen Referenzwert anzeigen. Ein Wert ohne belegten Leistungsbezug erzeugt Vergleichsdruck ohne Nutzen.",
        "claims": [
          {
            "statement": "Die gemessenen Kraftbereiche dieser Stichprobe dienen der Einordnung, nicht als Zielwert: Beinpresse rund vierunddreissig Newton je Kilogramm, Plantarflexion rund drei Newtonmeter je Kilogramm, Hueftabduktion rund zwei Komma drei, Inversion rund null Komma drei fuenf — jeweils mit erheblicher Streuung zwischen einzelnen Personen.",
            "sourceRefs": [
              "SRC-KANJUH-2026"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer",
            "outcome": "referenzbereiche",
            "directness": "direct",
            "uncertainties": [
              "Es sind BESCHREIBENDE Werte einer Stichprobe von siebenundvierzig Personen, keine Norm und kein Zielwert",
              "Die Streuung ist erheblich: die Beinpresse reichte von siebzehn bis achtundvierzig Newton je Kilogramm",
              "Gemessen isometrisch auf der dominanten Seite mit einem bestimmten Geraeteaufbau — mit anderer Messung nicht vergleichbar",
              "Da die Arbeit selbst keinen Zusammenhang zwischen diesen Werten und der Laufleistung findet, sagt ein Platz in diesem Bereich nichts ueber die Leistung"
            ],
            "essential": true,
            "claimId": "RUN-KRAFTPROFIL-004-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: referenzbereiche",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-ERHOL-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "erholung_nach_wettkampf",
        "statement": "Nach einem Marathonlauf war die diastolische Herzfunktion ueber den gesamten beobachteten Zeitraum von zweiundsiebzig Stunden eingeschraenkt, waehrend die systolische Funktion unbeeintraechtigt blieb und die Herzschaedigungsmarker sich in derselben Zeit normalisierten.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "plan.wettkampf_nachlauf"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "herzerkrankung",
          "akute_verletzung"
        ],
        "safetyLimits": [
          "Diese Regel darf nie zu einer Aussage ueber die Herzgesundheit einer einzelnen Person werden",
          "Kein Freigabe- oder Entwarnungssignal fuer die Rueckkehr ins Training",
          "Bei Beschwerden nach einem Wettkampf endet die Zustaendigkeit der App: Verweis auf aerztliche Abklaerung"
        ],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel nach einem Marathon laenger locker bleiben, als sich der Koerper anfuehlt — und keine Freigabe zu harten Einheiten aus einer App ableiten.",
        "claims": [
          {
            "statement": "Nach einem Marathonlauf war die diastolische Herzfunktion ueber den gesamten beobachteten Zeitraum von zweiundsiebzig Stunden eingeschraenkt, waehrend die systolische Funktion unbeeintraechtigt blieb und die Herzschaedigungsmarker sich in derselben Zeit normalisierten.",
            "sourceRefs": [
              "SRC-ROEH-2022"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "outcome": "erholung_nach_wettkampf",
            "directness": "direct",
            "uncertainties": [
              "Ob es sich um voruebergehende Anpassungen oder um bleibende Veraenderungen handelt, konnte die Arbeit nicht klaeren",
              "Der Beobachtungszeitraum endete nach zweiundsiebzig Stunden — was danach geschah, ist nicht erfasst",
              "Andere Arbeiten fanden Marker fuer Zellschaeden bis zu sieben Tage erhoeht",
              "Gemessen an Marathonteilnehmenden, nicht an Halbmarathon oder kuerzeren Wettkaempfen"
            ],
            "essential": true,
            "claimId": "RUN-ERHOL-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: erholung_nach_wettkampf",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": true,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "required_unreviewed",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-ERHOL-002",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "belastungsobergrenze",
        "statement": "Fuer sehr hohe und exzessive Belastungsumfaenge sind in der Literatur nachteilige Effekte bis hin zur Gesamtsterblichkeit beschrieben, unter anderem ueber ein hoeheres Risiko fuer Herzrhythmusstoerungen. Ab welchem Umfang das gilt, ist nicht abschliessend definiert.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "plan.umfangsobergrenze"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "herzerkrankung",
          "akute_verletzung"
        ],
        "safetyLimits": [
          "Aus dieser Regel darf keine Zahl fuer eine maximale Wochenbelastung abgeleitet werden",
          "Sie darf nie als Warnung vor dem Training einer einzelnen Person angezeigt werden",
          "Fragen zu Herzrhythmus oder Belastbarkeit gehoeren zur aerztlichen Abklaerung, nicht in die App"
        ],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel Umfangssteigerungen langsam halten und keine Obergrenze behaupten, die niemand kennt.",
        "claims": [
          {
            "statement": "Fuer sehr hohe und exzessive Belastungsumfaenge sind in der Literatur nachteilige Effekte bis hin zur Gesamtsterblichkeit beschrieben, unter anderem ueber ein hoeheres Risiko fuer Herzrhythmusstoerungen. Ab welchem Umfang das gilt, ist nicht abschliessend definiert.",
            "sourceRefs": [
              "SRC-ROEH-2022"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "outcome": "belastungsobergrenze",
            "directness": "direct",
            "uncertainties": [
              "Die Grenze ist nach Angabe der Autorin nicht abschliessend definiert — es gibt keine Zahl, die eine App anwenden koennte",
              "Die Datenlage zu nachteiligen Effekten ist deutlich duenner als die zu positiven",
              "Beobachtungsdaten, keine Interventionsstudien: wer sehr viel trainiert, unterscheidet sich auch sonst",
              "Der weit ueberwiegende Teil der Belege spricht fuer den Nutzen regelmaessiger Aktivitaet"
            ],
            "essential": true,
            "claimId": "RUN-ERHOL-002-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: belastungsobergrenze",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": true,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "required_unreviewed",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      },
      {
        "ruleId": "RUN-KOGN-001",
        "version": 1,
        "packVersion": 1,
        "sport": "running",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "kognitiver_nutzen",
        "statement": "Der kognitive Nutzen von Sport entstand am staerksten aus der Kombination von regelmaessigem Training und zusaetzlichen akuten intensiven Einheiten. Regelmaessiges Training allein zeigte diesen Effekt nicht im selben Ausmass.",
        "inputs": [
          "profile.sports",
          "profile.goal"
        ],
        "outputs": [
          "plan.kognitiver_nutzen"
        ],
        "applicability": {
          "populations": [
            "freizeitlaeufer",
            "gut_trainierte_laeufer",
            "marathon"
          ]
        },
        "excludedPopulations": [
          "kinder_jugendliche",
          "herzerkrankung",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel nichts zur Kognition versprechen. Der Befund begruendet, warum eine Mischung aus ruhigem Umfang und wenigen harten Einheiten sinnvoll ist — mehr nicht.",
        "claims": [
          {
            "statement": "Der kognitive Nutzen von Sport entstand am staerksten aus der Kombination von regelmaessigem Training und zusaetzlichen akuten intensiven Einheiten. Regelmaessiges Training allein zeigte diesen Effekt nicht im selben Ausmass.",
            "sourceRefs": [
              "SRC-ROEH-2022"
            ],
            "decisionRole": "evidence",
            "population": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "applicability": "freizeitlaeufer, gut_trainierte_laeufer, marathon",
            "outcome": "kognitiver_nutzen",
            "directness": "direct",
            "uncertainties": [
              "Die Zielgroesse ist KOGNITION, nicht Laufleistung — eine Uebertragung auf die sportliche Leistung waere unbelegt",
              "Beobachtet an einer Marathongruppe gegen eine sitzende Kontrollgruppe, ohne Zufallszuteilung",
              "Der zugrunde liegende Wirkweg ueber retinale Gefaessanpassungen ist ein Erklaerungsversuch, kein Nachweis"
            ],
            "essential": true,
            "claimId": "RUN-KOGN-001-C1",
            "use": "qualitative",
            "supportBasis": "Aussage der Quelle zu: kognitiver_nutzen",
            "synthesis": {
              "consistency": "single_source"
            }
          }
        ],
        "medicalSafetyRelevant": false,
        "governance": {
          "technicalStatus": "reviewed",
          "scientificReviewStatus": "unreviewed",
          "medicalSafetyReviewStatus": "not_required",
          "reviews": [],
          "technicalReviewedAt": "2026-08-13"
        },
        "changeReason": "eingespeist ueber knowledge-ingest",
        "previousVersion": null
      }
    ],
    contentHash: null
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.packContentHash === 'function') {
    pack.contentHash = O.knowledgeContracts.packContentHash(pack);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
  O.knowledgePack_running_notizen = pack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
