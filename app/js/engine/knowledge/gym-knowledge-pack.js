/* ============================================================
   ORVIA · Wissenspaket für "gym" — EINGESPEIST, nicht von Hand geschrieben.

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
  var pack = {
    packId: "gym",
    version: 1,
    knowledgeVersion: "kb-gym-v1.0.0",
    sport: "gym",
    rules: [
      {
        "ruleId": "GYM-HYP-001",
        "version": 1,
        "packVersion": 1,
        "sport": "gym",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "pausenlaenge",
        "statement": "Zwischen den Saetzen eines auf Muskelaufbau ausgerichteten Krafttrainings liegen zwei bis drei Minuten Pause.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "session.rest_seconds"
        ],
        "applicability": {
          "populations": [
            "freizeitsportler",
            "krafttraining_fortgeschritten"
          ]
        },
        "excludedPopulations": [
          "krafttraining_anfaenger",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel laenger pausieren. Eine zu kurze Pause kostet Last im naechsten Satz, eine zu lange kostet nur Zeit.",
        "claims": [
          {
            "claimId": "GYM-HYP-001-C1",
            "statement": "Zwischen den Saetzen eines auf Muskelaufbau ausgerichteten Krafttrainings liegen zwei bis drei Minuten Pause.",
            "sourceRefs": [
              "SRC-FRIEDMANN-2007"
            ],
            "decisionRole": "evidence",
            "population": "freizeitsportler, krafttraining_fortgeschritten",
            "applicability": "freizeitsportler, krafttraining_fortgeschritten",
            "outcome": "pausenlaenge",
            "directness": "direct",
            "use": "quantitative",
            "uncertainties": [
              "Die Angabe beschreibt, was in den referierten Studien angewendet wurde, nicht eine abgeleitete Optimaldosis",
              "Uebersichtsarbeit von 2007 — neuere Arbeiten zur Pausenlaenge sind nicht beruecksichtigt",
              "Kein Unterschied nach Uebung, Muskelgruppe oder Trainingszustand angegeben"
            ],
            "essential": true,
            "quantitative": {
              "schemaVersion": 1,
              "inputUnits": "Minuten Pause zwischen zwei Saetzen",
              "outputUnits": "Sekunden Satzpause",
              "validRange": {
                "min": 120,
                "max": 180
              },
              "population": "Hypertrophieorientiertes Krafttraining bei gesunden Erwachsenen zwischen achtzehn und vierzig Jahren",
              "exclusions": [
                "akute Verletzung",
                "Krafttraining-Anfaenger ohne Technikgrundlage"
              ],
              "sourceQuantitativeStatement": "Die Autorin nennt eine Pausendauer von zwei bis drei Minuten zwischen den einzelnen Saetzen als Teil dessen, was sich fuer Hypertrophie als besonders wirksam gezeigt hat.",
              "allowedTransformation": "Minuten mal sechzig",
              "uncertaintyRange": "Spannbreite aus referierten Studien, keine gemessene Dosis-Wirkungs-Kurve. Der untere Rand ist der vorsichtige Wert.",
              "independentValidation": false,
              "safetyBounds": "Die Pause ist eine Untergrenze, keine Obergrenze — sie darf jederzeit verlaengert werden. Wird die Bewegungsqualitaet im Folgesatz schlechter, gilt das vor der Zahl."
            },
            "supportBasis": "Aussage der Quelle zu: pausenlaenge",
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
        "ruleId": "GYM-HYP-002",
        "version": 1,
        "packVersion": 1,
        "sport": "gym",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "satzzahl",
        "statement": "Der Umfang wird je Muskelgruppe geplant, nicht je Uebung: fuenf bis sechs Saetze pro Muskelgruppe und Einheit, verteilt ueber alle Uebungen, die diese Muskelgruppe belasten.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.saetze_je_muskelgruppe"
        ],
        "applicability": {
          "populations": [
            "freizeitsportler",
            "krafttraining_fortgeschritten"
          ]
        },
        "excludedPopulations": [
          "krafttraining_anfaenger",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel am unteren Rand bleiben. Zusaetzliches Volumen erhoeht die Ermuedung zuverlaessiger als den Zuwachs.",
        "claims": [
          {
            "claimId": "GYM-HYP-002-C1",
            "statement": "Der Umfang wird je Muskelgruppe geplant, nicht je Uebung: fuenf bis sechs Saetze pro Muskelgruppe und Einheit, verteilt ueber alle Uebungen, die diese Muskelgruppe belasten.",
            "sourceRefs": [
              "SRC-FRIEDMANN-2007"
            ],
            "decisionRole": "evidence",
            "population": "freizeitsportler, krafttraining_fortgeschritten",
            "applicability": "freizeitsportler, krafttraining_fortgeschritten",
            "outcome": "satzzahl",
            "directness": "direct",
            "use": "quantitative",
            "uncertainties": [
              "Die Einheit ist Muskelgruppe, nicht Uebung — wer das verwechselt, verdoppelt oder verdreifacht den Umfang",
              "Uebersichtsarbeit von 2007; die Volumen-Wirkungs-Diskussion ist seither weitergegangen",
              "Keine Angabe zur Wochenfrequenz, ohne die eine Satzzahl je Einheit wenig aussagt"
            ],
            "essential": true,
            "quantitative": {
              "schemaVersion": 1,
              "inputUnits": "Saetze pro Muskelgruppe und Trainingseinheit",
              "outputUnits": "Saetze pro Muskelgruppe und Trainingseinheit",
              "validRange": {
                "min": 5,
                "max": 6
              },
              "population": "Hypertrophieorientiertes Krafttraining bei gesunden Erwachsenen zwischen achtzehn und vierzig Jahren",
              "exclusions": [
                "akute Verletzung",
                "Krafttraining-Anfaenger ohne Technikgrundlage"
              ],
              "sourceQuantitativeStatement": "Die Autorin nennt fuenf bis sechs Saetze pro Muskelgruppe. Ausdruecklich pro Muskelgruppe, nicht pro Uebung.",
              "allowedTransformation": "keine — und ausdruecklich KEINE Umrechnung auf Saetze je Uebung. Diese Zahl darf session.sets nicht speisen.",
              "uncertaintyRange": "Beschreibung aus referierten Studien, keine abgeleitete Optimaldosis. Ohne Wochenfrequenz nur begrenzt aussagekraeftig.",
              "independentValidation": false,
              "safetyBounds": "Gilt nur bei sauberer Technik. Wird die Bewegungsausfuehrung schlechter, endet die Einheit vor der Satzzahl."
            },
            "supportBasis": "Aussage der Quelle zu: satzzahl",
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
        "ruleId": "GYM-HYP-003",
        "version": 1,
        "packVersion": 1,
        "sport": "gym",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "last_und_wiederholungen",
        "statement": "Muskelaufbau entsteht ueber einen breiten Lastbereich von etwa sechzig bis fuenfundachtzig Prozent des Einwiederholungsmaximums bei sechs bis zwanzig Wiederholungen je Satz. Es gibt keinen engen Wiederholungskorridor, ausserhalb dessen nichts passiert.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "session.last_prozent_1rm",
          "session.repetitions"
        ],
        "applicability": {
          "populations": [
            "freizeitsportler",
            "krafttraining_fortgeschritten"
          ]
        },
        "excludedPopulations": [
          "krafttraining_anfaenger",
          "kinder_jugendliche",
          "akute_verletzung"
        ],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel in der Mitte des Bereichs arbeiten und die Last ueber Wochen steigern, statt den Rand zu suchen.",
        "claims": [
          {
            "claimId": "GYM-HYP-003-C1",
            "statement": "Muskelaufbau entsteht ueber einen breiten Lastbereich von etwa sechzig bis fuenfundachtzig Prozent des Einwiederholungsmaximums bei sechs bis zwanzig Wiederholungen je Satz. Es gibt keinen engen Wiederholungskorridor, ausserhalb dessen nichts passiert.",
            "sourceRefs": [
              "SRC-FRIEDMANN-2007"
            ],
            "decisionRole": "evidence",
            "population": "freizeitsportler, krafttraining_fortgeschritten",
            "applicability": "freizeitsportler, krafttraining_fortgeschritten",
            "outcome": "last_und_wiederholungen",
            "directness": "direct",
            "use": "qualitative",
            "uncertainties": [
              "Der Bereich ist breit, weil die referierten Studien breit streuen — nicht, weil die Breite selbst belegt waere",
              "Ohne Angabe des Abstands zum Muskelversagen ist eine Prozentangabe allein nicht steuerbar",
              "Uebersichtsarbeit von 2007"
            ],
            "essential": true,
            "supportBasis": "Aussage der Quelle zu: last_und_wiederholungen",
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
        "ruleId": "GYM-VAR-001",
        "version": 1,
        "packVersion": 1,
        "sport": "gym",
        "discipline": "general",
        "positionRole": null,
        "seasonPhase": "any",
        "topic": "erwartungsrahmen",
        "statement": "Die Reaktion auf dasselbe Krafttraining faellt zwischen einzelnen Menschen extrem unterschiedlich aus: nach zwoelf Wochen standardisiertem Armkrafttraining reichten die Querschnittsaenderungen von minus drei bis plus neunundfuenfzig Prozent, die Kraftzuwaechse von null bis zweihundertfuenfzig Prozent. Eine App darf deshalb keinen individuellen Zuwachs versprechen.",
        "inputs": [
          "profile.sports"
        ],
        "outputs": [
          "plan.erwartungsrahmen"
        ],
        "applicability": {
          "populations": [
            "freizeitsportler",
            "krafttraining_anfaenger",
            "krafttraining_fortgeschritten"
          ]
        },
        "excludedPopulations": [],
        "safetyLimits": [],
        "contraindications": [],
        "conservativeFallback": "Im Zweifel keine Prognose ausgeben. Eine Spannbreite ohne Einordnung ist irrefuehrender als gar keine Zahl.",
        "claims": [
          {
            "claimId": "GYM-VAR-001-C1",
            "statement": "Die Reaktion auf dasselbe Krafttraining faellt zwischen einzelnen Menschen extrem unterschiedlich aus: nach zwoelf Wochen standardisiertem Armkrafttraining reichten die Querschnittsaenderungen von minus drei bis plus neunundfuenfzig Prozent, die Kraftzuwaechse von null bis zweihundertfuenfzig Prozent. Eine App darf deshalb keinen individuellen Zuwachs versprechen.",
            "sourceRefs": [
              "SRC-FRIEDMANN-2007"
            ],
            "decisionRole": "evidence",
            "population": "freizeitsportler, krafttraining_anfaenger, krafttraining_fortgeschritten",
            "applicability": "freizeitsportler, krafttraining_anfaenger, krafttraining_fortgeschritten",
            "outcome": "erwartungsrahmen",
            "directness": "direct",
            "use": "qualitative",
            "uncertainties": [
              "Die Streuung stammt aus einer einzelnen grossen Untersuchung, die in der Uebersicht referiert wird",
              "Die Ursachen der Streuung sind darin nicht aufgeloest — genetisch, methodisch und messbedingt ist nicht getrennt",
              "Die Spannbreite ist eine beobachtete Streuung, keine Vorhersage — sie darf nie als erwartbarer Zuwachs angezeigt werden"
            ],
            "essential": true,
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
      }
    ],
    contentHash: null
  };
  if (O.knowledgeContracts && typeof O.knowledgeContracts.packContentHash === 'function') {
    pack.contentHash = O.knowledgeContracts.packContentHash(pack);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = pack;
  O.knowledgePack_gym = pack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
