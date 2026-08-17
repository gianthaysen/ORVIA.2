/* ============================================================
   ORVIA · running-knowledge-pack v3 (Batch 3b.0b) — Running-Wissenspack
   nach Wissensvertrag v3.

   Änderungen v2 → v3 (Versionen werden nie wiederverwendet):
   - Claims führen KEINE Appraisal-Felder mehr (Design/Qualität/RoB liegen
     zentral im Quellenregister v2); claimseitig bleiben Direktheit,
     Anwendbarkeit und synthesis.consistency.
   - Mehrquellen-Claims deklarieren die Kombinationsart explizit
     (DIM-C1 each_sufficient; RTR-C1 all_required ⇒ schwächste notwendige
     Basis zählt).
   - SAFE-C2 atomar auf den tatsächlichen Collins-2018-Gehalt reduziert
     (Übungstherapie, hüft-+kniefokussiert, Outcomes Schmerz/Funktion);
     die Inferenz „belastungsmodifizierend statt pauschal stoppen" ist
     als getrennter D-Claim SAFE-P3 gekennzeichnet.

   Änderungen v1 → v2 (Historie):
   - Jede Regel besteht aus atomaren claims[] mit eigener Quellenbasis,
     supportBasis (welche Stelle/welches Ergebnis stützt die Aussage),
     Appraisal und decisionRole; ORVIA-Heuristiken und Fallbacks sind
     sichtbar product_policy/fallback (Klasse D, abgeleitet) und
     übernehmen NIE die Evidenzklasse zitierter Studien.
   - Evidence Ceiling = schwächste essenzielle Behauptung. Da jede
     Engine-Wirkung eine essenzielle ORVIA-Produktentscheidung enthält,
     ist der Ceiling ALLER Regeln derzeit D ⇒ nie hohe Confidence.
   - Governance getrennt: alle 14 Regeln sind technisch geprüft,
     WISSENSCHAFTLICH UNGEPRÜFT und NICHT für Produktionsentscheidungen
     zugelassen; RUN-SAFE-001 und RUN-RTR-001 sind zusätzlich medizinisch
     prüfpflichtig und bleiben auch im Shadow ausgeschlossen.
   - Quellenkorrekturen: Nielsen (Hauptvergleich nicht signifikant,
     Subgruppenbefund p=.07), Damsted (zeitlich begrenzter, später nicht
     signifikanter Befund), Crossley Teil 1 (nur Terminologie/Verlauf;
     Intervention getrennt via Collins 2018), Seiler/Haugen (deskriptive
     Leistungs-/Weltklassedaten, keine Freizeitläufer-Budgets).

   Dieses Pack erzeugt weiterhin KEINEN Plan, KEINE Capacity-Formel,
   KEINE Wochenumfangs- oder Pace-Vorgabe.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var PACK_VERSION = 3;
  var KNOWLEDGE_VERSION = 'kb-run-v3.0.0';
  var TECH_REVIEWED = '2026-07-19';

  /* Governance-Grundzustand: technisch geprüft, wissenschaftlich
     UNGEPRÜFT, keine Produktionszulassung. KEINE fingierte Freigabe. */
  function gov(medicalRelevant) {
    return {
      technicalStatus: 'reviewed',
      technicalReviewedAt: TECH_REVIEWED,
      scientificReviewStatus: 'unreviewed',
      medicalSafetyReviewStatus: medicalRelevant ? 'required_unreviewed' : 'not_required',
      reviews: []   // Freigaben erfordern identifizierte, qualifizierte Prüfer (Vertrag v2)
    };
  }
  function rule(r) {
    return Object.assign({
      version: 3, packVersion: PACK_VERSION, sport: 'running', discipline: 'road_endurance',
      positionRole: null, seasonPhase: 'any', contraindications: [],
      medicalSafetyRelevant: false, governance: gov(false),
      changeReason: 'batch_3b0b_pinning_registry_review_binding_appraisal_authority', previousVersion: 2
    }, r);
  }
  function evClaim(c) {
    return Object.assign({ decisionRole: 'evidence', use: 'qualitative', essential: false }, c);
  }
  function podClaim(c) {   // sichtbar gekennzeichnete ORVIA-Produktregel (Klasse D, abgeleitet)
    return Object.assign({ decisionRole: 'product_policy', sourceRefs: ['SRC-ORVIA-BATCH2-CONTRACT'], population: 'orvia_users', applicability: 'orvia_engine', outcome: 'engine_policy', directness: 'direct', use: 'qualitative', essential: true }, c);
  }

  var RULES = [
    rule({
      ruleId: 'RUN-HIST-001', topic: 'training_history',
      statement: 'Trainingshistorie und -erfahrung moderieren die Belastungsverträglichkeit; die Historienreife der Daten begrenzt jede Aussage.',
      inputs: ['loadHistory.chronic28PerWeek', 'loadHistory.quality.historySpanDays', 'athlete.experienceLevel', 'loadHistory.ratioConfidence'],
      outputs: ['experienceTier', 'historyReliability'],
      applicability: { populations: ['novice_runners', 'recreational_runners'] },
      excludedPopulations: ['minors', 'medically_restricted'],
      safetyLimits: ['insufficient_history_forces_conservative_tier'],
      conservativeFallback: 'Ohne belastbare Historie: niedrigste Stufe + niedrige Confidence.',
      claims: [
        evClaim({
          claimId: 'HIST-C1', statement: 'Anfänger haben pro Laufstunde eine deutlich höhere Verletzungsinzidenz als erfahrene Freizeitläufer.',
          sourceRefs: ['SRC-VIDEBAEK-2015'], supportBasis: 'Metaanalyse-Hauptergebnis: gepoolte Inzidenzraten je 1000 h nach Läufertyp (Novizen vs. Freizeitläufer).',
          synthesis: { consistency: 'consistent' },
          population: 'novice_and_recreational_runners', applicability: 'risk_stratification', outcome: 'running_related_injury_incidence',
          directness: 'direct', uncertainties: ['Heterogene Verletzungsdefinitionen', 'Gruppenraten ≠ Individualprognose'], essential: false
        }),
        evClaim({
          claimId: 'HIST-C2', statement: 'Verletzungen entstehen im Rahmenmodell, wenn sessionbezogene Belastung die individuell variable Belastbarkeit übersteigt.',
          sourceRefs: ['SRC-BERTELSEN-2017'], supportBasis: 'Konzeptuelles Ätiologie-Framework (Belastung vs. Belastbarkeit), Abb./Kernthese des Artikels.',
          synthesis: { consistency: 'single_source' },
          population: 'runners_all_levels', applicability: 'conceptual_basis', outcome: 'injury_etiology_model',
          directness: 'partial', uncertainties: ['Konzeptmodell ohne quantitative Grenzwerte'], essential: false
        }),
        podClaim({
          claimId: 'HIST-P1', statement: 'ORVIA stuft Erfahrung/Historienreife in Tiers und erzwingt bei unzureichender Historie die konservativste Stufe (Datenbasis: kanonischer Batch-2-Lastvertrag).',
          uncertainties: ['Tier-Grenzen sind Produktheuristik, wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-CONS-001', topic: 'frequency_consistency',
      statement: 'Häufigkeit und Konsistenz der letzten Wochen sind Voraussetzung jeder Umfangsbasis-Aussage.',
      inputs: ['loadHistory.quality.acute7.activeLoadDays', 'loadHistory.quality.prior21.activeLoadDays', 'loadHistory.dataDays'],
      outputs: ['consistencyIndex', 'frequencyBand'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['low_consistency_blocks_volume_progression_claims'],
      conservativeFallback: 'Bei geringer Konsistenz keine Umfangsbasis-Behauptung, sondern Konsistenzaufbau als Vorstufe.',
      claims: [
        evClaim({
          claimId: 'CONS-C1', statement: 'Leitlinien empfehlen regelmäßige, über die Woche verteilte Ausdaueraktivität mit gradueller Progression.',
          sourceRefs: ['SRC-ACSM-2011'], supportBasis: 'Position-Stand-Empfehlungen zu Frequenz (Tage/Woche) und gradueller Progression bei gesunden Erwachsenen.',
          synthesis: { consistency: 'consistent' },
          population: 'healthy_adults', applicability: 'general_fitness_guidance', outcome: 'training_structure',
          directness: 'partial', uncertainties: ['Fitness-/Gesundheitskontext, nicht wettkampfspezifisch'], essential: false
        }),
        podClaim({
          claimId: 'CONS-P1', statement: 'ORVIA bestimmt Konsistenz aus aktiven Lasttagen der Batch-2-Fenster und blockiert Volumenaussagen bei geringer Konsistenz.',
          uncertainties: ['Konsistenz-Schwellen sind Produktheuristik, wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-VOL-001', topic: 'weekly_volume',
      statement: 'Das aktuelle Wochenvolumen wird als Bandbreite aus mehreren robusten jüngeren Wochen bestimmt — nie aus einer Spitzenwoche.',
      inputs: ['loadHistory.acute7', 'loadHistory.chronic28PerWeek', 'loadHistory.quality', 'activities.canonicalDailyLoad'],
      outputs: ['currentWeeklyVolumeRange'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['single_peak_week_must_not_define_baseline'],
      conservativeFallback: 'Bei Lücken untere plausible Bandbreite + Missingness-Ausweis.',
      claims: [
        evClaim({
          claimId: 'VOL-C1', statement: 'Belastungssteuerung soll sich an der gewohnten (chronischen) Belastung orientieren; große Abweichungen davon sind Risikokontext.',
          sourceRefs: ['SRC-IOC-LOAD-2016'], supportBasis: 'IOC-Konsens-Kernaussage zu Lastspitzen relativ zur gewohnten Belastung und gradueller Steuerung.',
          synthesis: { consistency: 'consistent' },
          population: 'athletes_all_levels', applicability: 'load_management', outcome: 'injury_illness_risk_context',
          directness: 'partial', uncertainties: ['Keine sportart-/populationsspezifischen Grenzwerte'], essential: false
        }),
        podClaim({
          claimId: 'VOL-P1', statement: 'ORVIA aggregiert die Bandbreite ausschließlich aus der kanonischen, deduplizierten Tageslast (Batch-2-Vertrag); die Fensterwahl ist eine versionierte Produktheuristik.',
          uncertainties: ['Aggregationsfenster/Bandbreitenbildung wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-LONG-001', topic: 'long_run_evidence',
      statement: 'Die längste zusammenhängend gruppierte Laufeinheit ist eine eigene Evidenzeinheit und zählt genau einmal (Split-Aufzeichnungen = EINE Einheit).',
      inputs: ['activities.groupedSessions.longestGroupedSession'],
      outputs: ['longestRecentSessionEvidence'],
      evidenceUnit: { kind: 'longest_grouped_session', countingRule: 'grouped_session_counts_once' },
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['split_recordings_must_not_double_count'],
      conservativeFallback: 'Ohne gruppierbare Einheiten gilt die Long-Run-Basis als unbekannt (kein Schätzwert).',
      claims: [
        podClaim({
          claimId: 'LONG-P1', statement: 'Gruppierungs- und Einmalzählungs-Mechanik folgt dem technisch getesteten Batch-2-Vertrag (Gap-Toleranz, Rohaktivitäten bleiben erhalten).',
          sourceRefs: ['SRC-ORVIA-BATCH2-CONTRACT', 'SRC-ORVIA-PORTFOLIO-CONTRACT'],
          uncertainties: ['Gap-Toleranz ist Produktparameter; fachliche Eignung der Long-Run-Evidenz ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-RESP-001', topic: 'load_response',
      statement: 'Interne Last (Session-RPE) und die beobachtete Reaktion nach belastenden Einheiten kalibrieren die individuelle Verträglichkeit.',
      inputs: ['activities.srpe', 'checkin.morning.soreness', 'checkin.morning.feel', 'loadHistory.hardYesterday', 'outcomeHistory.post24h48hResponse'],
      outputs: ['loadResponseSignal'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['negative_response_forces_conservative_recalibration'],
      conservativeFallback: 'Ohne Reaktionsdaten wird Verträglichkeit als unbeobachtet markiert, nie optimistisch geschätzt.',
      claims: [
        evClaim({
          claimId: 'RESP-C1', statement: 'Session-RPE (RPE × Dauer) ist ein valides, praxistaugliches Maß interner Trainingslast.',
          sourceRefs: ['SRC-FOSTER-2001'], supportBasis: 'Validierungsergebnis: Korrelation der Session-RPE-Last mit HF-basierten Lastmaßen über verschiedene Trainingsformen.',
          synthesis: { consistency: 'consistent' },
          population: 'trained_adults', applicability: 'internal_load_measurement', outcome: 'training_load_quantification',
          directness: 'direct', uncertainties: ['Subjektiv, kontextsensitiv (Schlaf/Stress/Hitze)'], essential: false
        }),
        podClaim({
          claimId: 'RESP-P1', statement: 'Das konkrete ORVIA-Reaktionsfenster von 24–48 Stunden nach belastenden Einheiten ist eine EIGENE, von der sRPE-Validität GETRENNTE Produktannahme.',
          uncertainties: ['Fensterlänge und Bewertungslogik wissenschaftlich ungeprüft'], essential: true
        })
      ]
    }),
    rule({
      ruleId: 'RUN-INT-001', topic: 'intensity_control_prerequisites',
      statement: 'Intensitätssteuerung hat getrennte Voraussetzungen je Steuergröße; ohne belastbare Basis wird konservativ ohne Pace-Vorgabe gesteuert.',
      inputs: ['currentMetrics.provenance', 'athlete.hfMaxMeasured', 'activities.recentComparablePerformance', 'checkin.rpeHistory'],
      outputs: ['intensityControlMode', 'intensityControlConfidence'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['no_pace_prescription_without_recent_comparable_evidence'],
      conservativeFallback: 'Ohne Pace-Basis: RPE-/HF-Steuerung + Kalibrierungshinweis, niedrige Confidence.',
      claims: [
        evClaim({
          claimId: 'INT-C1', statement: 'Altersformeln für die maximale Herzfrequenz haben große individuelle Streuung; formelbasierte HF-Zonen sind Näherungen.',
          sourceRefs: ['SRC-TANAKA-2001'], supportBasis: 'Regressionsergebnis (208 − 0,7 × Alter) inkl. berichteter individueller Streuung um die Vorhersage.',
          synthesis: { consistency: 'consistent' },
          population: 'healthy_adults', applicability: 'hr_zone_derivation', outcome: 'hrmax_prediction_error',
          directness: 'direct', uncertainties: ['Individuelle HFmax kann deutlich abweichen'], essential: false
        }),
        evClaim({
          claimId: 'INT-C2', statement: 'RPE-basierte Laststeuerung ist validiert und ohne Gerätevoraussetzungen verfügbar.',
          sourceRefs: ['SRC-FOSTER-2001'], supportBasis: 'Session-RPE-Validierung (siehe RESP-C1) — Grundlage der RPE-Verfügbarkeitsaussage.',
          synthesis: { consistency: 'consistent' },
          population: 'trained_adults', applicability: 'intensity_control', outcome: 'internal_load_control',
          directness: 'partial', uncertainties: ['Validiert als Lastmaß, nicht als Zonensteuerung im Einzelnen'], essential: false
        }),
        podClaim({
          claimId: 'INT-P1', statement: 'Die ORVIA-Hierarchie (RPE immer; HF nur mit belastbarer Referenz; Pace nur mit jüngerer vergleichbarer Leistungs-Evidenz) und die Definition von „recent comparable performance" sind Produktregeln und übernehmen keine Studienklasse.',
          uncertainties: ['Hierarchie und Vergleichbarkeitskriterien wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-DIM-001', topic: 'intensity_dimensions',
      statement: 'Easy-, Long-, Schwellen- und hochintensive Belastung werden als getrennte Dimensionen geführt; harte Anteile bleiben konservativ begrenzt.',
      inputs: ['activities.intensityDistribution', 'loadHistory.quality'],
      outputs: ['dimensionBudgets.easy', 'dimensionBudgets.long', 'dimensionBudgets.threshold', 'dimensionBudgets.highIntensity'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['high_intensity_share_stays_minor_fraction'],
      conservativeFallback: 'Ohne Intensitätsdaten nur locker/hart-Unterscheidung mit konservativ begrenztem hartem Anteil.',
      claims: [
        evClaim({
          claimId: 'DIM-C1', sourceCombination: 'each_sufficient', statement: 'Bei gut trainierten bis Weltklasse-Ausdauerathleten ist BEOBACHTET, dass der Großteil des Trainingsvolumens niedrig-intensiv absolviert wird.',
          sourceRefs: ['SRC-SEILER-2010', 'SRC-HAUGEN-2022'], supportBasis: 'Deskriptive Trainingsverteilungs-Daten (Intensitätsverteilung) in beiden Übersichten — reine Beschreibung von Leistungs-/Elitepraxis.',
          synthesis: { consistency: 'consistent' },
          population: 'well_trained_and_world_class_endurance_athletes', applicability: 'descriptive_only', outcome: 'observed_intensity_distribution',
          directness: 'indirect', uncertainties: ['Elitepraxis validiert keine Freizeitläufer-Budgets', 'Beobachtung ≠ Kausalität'], essential: false
        }),
        podClaim({
          claimId: 'DIM-P1', statement: 'Die Übertragung auf Freizeitläufer (getrennte Dimensionen, konservativ kleiner harter Anteil, keinerlei Quoten) ist eine ORVIA-Produktheuristik — KEIN validiertes 80/20-Budget.',
          uncertainties: ['Übertragbarkeit auf Freizeitläufer ungeprüft; Quoten bewusst nicht definiert']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-PROG-001', topic: 'progression_limits',
      statement: 'Es gibt kein belegtes universelles Steigerungsgesetz; Progressionssignale sind unsichere Risikokontexte und werden konservativ, individualisiert und mit sichtbarer Unsicherheit verarbeitet.',
      inputs: ['loadHistory.acute7', 'loadHistory.chronic28PerWeek', 'loadHistory.quality', 'experienceTier', 'loadResponseSignal', 'returnToRunStatus'],
      outputs: ['progressionRiskFlags', 'progressionEnvelopeQualitative'],
      applicability: { populations: ['novice_runners', 'recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['multiweek_rapid_spikes_are_flagged_never_prescribed', 'ratio_signals_are_context_not_thresholds'],
      conservativeFallback: 'Bei unklarer Basis konservativste plausible Progressionsstufe; Feasibility bleibt Szenario (3c).',
      claims: [
        evClaim({
          claimId: 'PROG-C1', statement: 'Ein an der festen Zehn-Prozent-Regel orientiertes graduiertes Programm senkte die Verletzungsrate bei Laufanfängern nicht (RCT).',
          sourceRefs: ['SRC-BUIST-2008'], supportBasis: 'Primäres RCT-Ergebnis: kein Unterschied der Verletzungsinzidenz zwischen graduiertem 10-Prozent-Programm und Standardaufbau.',
          synthesis: { consistency: 'single_source' },
          population: 'novice_runners', applicability: 'progression_rule_evaluation', outcome: 'running_related_injuries',
          directness: 'direct', uncertainties: ['Ein Programmvergleich; widerlegt Universalität, nicht graduelle Progression generell'], essential: false
        }),
        evClaim({
          claimId: 'PROG-C2', statement: 'Der Hauptvergleich bei Nielsen war statistisch NICHT signifikant; nur ein Subgruppenbefund (distanzassoziierte Verletzungen bei Steigerung über ~30 %) deutete mit p = .07 UNSICHER auf erhöhtes Risiko.',
          sourceRefs: ['SRC-NIELSEN-2014'], supportBasis: 'Ergebnisteil: nicht-signifikanter Gesamtvergleich; Subgruppenanalyse distanzassoziierter Verletzungen (p = .07).',
          synthesis: { consistency: 'mixed' },
          population: 'novice_runners', applicability: 'risk_signal_only', outcome: 'running_related_injuries_by_type',
          directness: 'direct', uncertainties: ['Statistisch unsicher (p = .07)', 'Subgruppenanalyse, kein Schwellenwertbeleg'], essential: false
        }),
        evClaim({
          claimId: 'PROG-C3', statement: 'Bei Damsted war der Zusammenhang zwischen Distanzänderung und Verletzung nur zeitlich begrenzt signifikant und später nicht mehr — ein instabiles Signal.',
          sourceRefs: ['SRC-DAMSTED-2019'], supportBasis: 'Zeitraumabhängige Effektschätzer der HM-Vorbereitungskohorte (früh signifikant, später nicht).',
          synthesis: { consistency: 'mixed' },
          population: 'recreational_half_marathon_preparation', applicability: 'risk_signal_only', outcome: 'running_related_injury',
          directness: 'direct', uncertainties: ['Zeitlich instabiler Effekt', 'Selbstauskunft'], essential: false
        }),
        evClaim({
          claimId: 'PROG-C4', statement: 'Quotientenmodelle wie ACWR sind konzeptionell/methodisch nicht als präzise Verletzungsprädiktoren belastbar.',
          sourceRefs: ['SRC-IMPELLIZZERI-2020'], supportBasis: 'Methodenkritik: mathematische Kopplung, fehlende Kausalbasis, Klassifikationsprobleme des ACWR.',
          synthesis: { consistency: 'consistent' },
          population: 'athletes_all_levels', applicability: 'model_limitation', outcome: 'acwr_validity',
          directness: 'direct', uncertainties: ['Kritik entwertet das Grundprinzip „viel mehr als gewohnt ist riskant" nicht, nur dessen naive Quantifizierung'], essential: false
        }),
        podClaim({
          claimId: 'PROG-P1', statement: 'ORVIA verarbeitet Progressionssignale ausschließlich als unsichere Risiko-KONTEXTE (Flags, qualitative Envelope) — nie als Schwellenwerte oder Vorgaben; die konkrete Flag-Logik ist eine ungeprüfte Produktregel.',
          uncertainties: ['Kein validierter individueller Grenzwert existiert; Flag-Logik wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-RTR-001', topic: 'return_to_run', medicalSafetyRelevant: true, governance: gov(true),
      statement: 'Nach Laufunterbrechung wird unterhalb des früheren Niveaus graduiert wieder aufgebaut; Krankheits-/Beschwerde-Gates haben Vorrang vor jedem Zielpfad.',
      inputs: ['loadHistory.interruption.lengthDays', 'loadHistory.interruption.reason', 'safety.flags', 'constraints'],
      outputs: ['returnToRunStatus', 'reentryTier'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['no_immediate_return_to_previous_volume', 'illness_gate_precedes_goal_pursuit'],
      conservativeFallback: 'Bei unbekannter Unterbrechungsursache wird wie nach relevanter Unterbrechung aufgebaut.',
      claims: [
        evClaim({
          claimId: 'RTR-C1', sourceCombination: 'all_required', statement: 'Das allgemeine Prinzip gradueller Wiederbelastung nach Belastungsunterbrechung ist konsensbasiert — ein KONKRETES Return-to-Run-Protokoll belegen die zitierten Quellen NICHT.',
          sourceRefs: ['SRC-IOC-LOAD-2016', 'SRC-BERTELSEN-2017'], supportBasis: 'IOC: graduelle Laststeuerung/Rückkehr als Konsensprinzip; Bertelsen: reduzierte Belastbarkeit nach Unterbrechung im Rahmenmodell. Keine Protokolldetails.',
          synthesis: { consistency: 'consistent' },
          population: 'athletes_all_levels', applicability: 'principle_only', outcome: 'reinjury_risk_context',
          directness: 'indirect', uncertainties: ['Kein konkretes Protokoll in den Quellen'], essential: false
        }),
        podClaim({
          claimId: 'RTR-P1', statement: 'Rückstufungs-Tiers und Wiedereinstiegslogik sind eine UNGEPRÜFTE Experten-/Produktregel und bleiben bis zur medizinisch-fachlichen Prüfung gesperrt.',
          uncertainties: ['Rückstufungsgrößen wissenschaftlich/medizinisch ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-SAFE-001', topic: 'safety_gates', medicalSafetyRelevant: true, governance: gov(true),
      statement: 'Beschwerden verschärfen Belastungsgrenzen ausschließlich (tighten only); unklare oder eskalierende Beschwerdebilder werden zur professionellen Abklärung ausgewiesen. ORVIA diagnostiziert nicht.',
      inputs: ['safety.flags', 'constraints', 'checkin.morning.redFlags', 'outcomeHistory.painTrend'],
      outputs: ['safetyGateState', 'loadModificationRequirement', 'escalationAdvice'],
      applicability: { populations: ['recreational_runners', 'patellofemoral_pain_context'] },
      excludedPopulations: ['acute_traumatic_injury', 'medically_restricted'],
      safetyLimits: ['tighten_only_never_relax', 'red_flags_stop_training_evaluation'],
      contraindications: ['Belastungssteigerung bei zunehmendem Schmerztrend', 'Weitertraining bei Red-Flag-Symptomen'],
      conservativeFallback: 'Im Zweifel restriktivere Auslegung + Hinweis auf professionelle Abklärung.',
      claims: [
        evClaim({
          claimId: 'SAFE-C1', statement: 'Patellofemoraler Schmerz ist ein belastungssensitives Beschwerdebild (Provokation u. a. durch tiefe Beugung, Treppen, Laufen) mit häufig persistierendem Verlauf.',
          sourceRefs: ['SRC-CROSSLEY-PFP-2016'], supportBasis: 'Teil 1: Terminologie/Definition (belastungsabhängiger peripatellarer Schmerz) und Daten zum natürlichen Verlauf — NICHT: Therapie oder Eskalation.',
          synthesis: { consistency: 'consistent' },
          population: 'patellofemoral_pain', applicability: 'condition_characterization', outcome: 'symptom_behavior',
          directness: 'partial', uncertainties: ['Golden-Case-Kniebefund medizinisch nicht gesichert'], essential: false
        }),
        evClaim({
          claimId: 'SAFE-C2', statement: 'Bei patellofemoralem Schmerz wird Übungstherapie im Konsens unterstützt — insbesondere die Kombination hüft- und kniefokussierter Übungen — mit den Zielgrößen Schmerz und Funktion. Mehr trägt die Quelle nicht.',
          sourceRefs: ['SRC-COLLINS-PFP-2018'], supportBasis: 'Konsensusempfehlung „exercise therapy" (2018 Retreat): Übungstherapie empfohlen, kombinierte hüft- + kniefokussierte Übungen bevorzugt; Outcomes Schmerz/Funktion.',
          synthesis: { consistency: 'consistent' },
          population: 'patellofemoral_pain', applicability: 'exercise_therapy_recommendation', outcome: 'pain_and_function',
          directness: 'partial', uncertainties: ['Konsens für diagnostiziertes PFP, nicht für unklare Kniebeschwerden generell'], essential: false
        }),
        podClaim({
          claimId: 'SAFE-P3', statement: 'Die Ableitung „belastungsmodifizierend statt pauschal stoppen" ist eine NACHGELAGERTE ORVIA-Produktinferenz aus der Übungstherapie-Empfehlung — sie steht NICHT in Collins 2018 und bleibt bis zur medizinischen Prüfung Produktannahme.',
          sourceRefs: ['SRC-ORVIA-PORTFOLIO-CONTRACT'],
          uncertainties: ['Produktinferenz ohne direkte Quellenaussage; der medizinischen Prüfung vorzulegen']
        }),
        podClaim({
          claimId: 'SAFE-P1', statement: 'Der tighten-only-Mechanismus (Beschwerden können Grenzen nur verschärfen, nie lockern) ist ORVIA-Produktpolitik.',
          sourceRefs: ['SRC-ORVIA-PORTFOLIO-CONTRACT'],
          uncertainties: ['Produktpolitik, der medizinischen Prüfung vorzulegen']
        }),
        podClaim({
          claimId: 'SAFE-P2', statement: 'Die konkrete ORVIA-Eskalations-/Warnzeichenliste (Schmerztrend, Ruhe-/Nachtschmerz, Schwellung/Instabilität, Red-Flag-Symptome) ist eine UNGEPRÜFTE Produkt-/Expertenregel ohne belegende Konsensquelle und bleibt bis zur medizinischen Prüfung gesperrt.',
          uncertainties: ['Liste medizinisch ungeprüft; Quellenlage für Eskalationskriterien offen']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-ENV-001', topic: 'environment_comparability',
      statement: 'Umweltkontext begrenzt die Vergleichbarkeit von Pace-/HF-Daten; die Faktoren sind GETRENNT zu bewerten und nur Hitze ist konsensbelegt.',
      inputs: ['activities.environment.surface', 'activities.environment.elevationGain', 'activities.environment.temperature'],
      outputs: ['comparabilityFlags'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['heat_degraded_sessions_not_used_as_fitness_regression_evidence'],
      conservativeFallback: 'Fehlen Umweltdaten, wird Vergleichbarkeit als unbekannt markiert, nie angenommen.',
      claims: [
        evClaim({
          claimId: 'ENV-C1', statement: 'HITZE erhöht die physiologische Beanspruchung bei gleicher äußerer Leistung deutlich; Leistungs-/HF-Daten aus Hitzebedingungen sind mit Normalbedingungen eingeschränkt vergleichbar.',
          sourceRefs: ['SRC-RACINAIS-2015'], supportBasis: 'Konsensaussagen zu Thermoregulation, Leistungsabfall und Anpassung von Intensität/Erwartung unter Hitze.',
          synthesis: { consistency: 'consistent' },
          population: 'athletes_all_levels', applicability: 'heat_only', outcome: 'performance_physiological_strain',
          directness: 'direct', uncertainties: ['Konsens fokussiert Hitze/Wettkampf'], essential: false
        }),
        podClaim({
          claimId: 'ENV-P1', statement: 'Höhenmeter, Untergrund und sonstiges Wetter werden als GETRENNTE Vergleichbarkeits-Flags geführt; dafür liegt derzeit KEINE eigene Quellenbasis im Register vor — Produktannahme bis zur Nachrecherche.',
          uncertainties: ['Höhe/Untergrund/Wetter ohne eigene Registerquellen — als Produktannahme sichtbar']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-MECH-001', topic: 'mechanical_load',
      statement: 'Harte Einheiten und lange Läufe werden als mechanische Spitzen gezählt; aufeinanderfolgende harte Tage werden von ORVIA VORSICHTSHALBER als erhöht belastend behandelt — ein spezifischer Überproportionalitäts-Beleg liegt nicht vor.',
      inputs: ['loadHistory.hardStreak', 'activities.hardSignals', 'loadHistory.hardYesterday'],
      outputs: ['mechanicalLoadState', 'hardDaySpacingRequirement'],
      applicability: { populations: ['recreational_runners'] },
      excludedPopulations: [],
      safetyLimits: ['consecutive_hard_days_flagged'],
      conservativeFallback: 'Bei unbekannter Härteklassifikation wird eine Einheit im Zweifel als hart gewertet.',
      claims: [
        evClaim({
          claimId: 'MECH-C1', statement: 'Im Ätiologie-Rahmenmodell hängt das Verletzungsrisiko von der Abfolge von Belastung und (unvollständiger) Wiederherstellung der Belastbarkeit ab.',
          sourceRefs: ['SRC-BERTELSEN-2017'], supportBasis: 'Rahmenmodell: zeitlicher Verlauf von Belastung und Belastbarkeit zwischen Sessions.',
          synthesis: { consistency: 'single_source' },
          population: 'runners_all_levels', applicability: 'conceptual_basis', outcome: 'injury_etiology_model',
          directness: 'partial', uncertainties: ['Konzeptmodell — kein empirischer Beleg für „überproportionale" Kumulation aufeinanderfolgender harter Lauftage'], essential: false
        }),
        podClaim({
          claimId: 'MECH-P1', statement: 'Die Zählung harter Tage/mechanischer Spitzen (Batch-2-Härtemodell) und die Abstandsanforderung sind konservative Produktregeln ohne spezifischen Quellenbeleg.',
          uncertainties: ['Härteschwellen und Abstandslogik wissenschaftlich ungeprüft']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-GOAL-001', topic: 'goal_aspiration',
      statement: 'Zielzeiten sind Wunschgrößen (Aspiration) und niemals Eingangsgröße einer Kapazitätsberechnung; Erreichbarkeit wird später ausschließlich als Szenario bewertet.',
      inputs: ['portfolio.allocations.target.interpretationAspirationOnly'],
      outputs: ['aspirationSeparationFlag'],
      applicability: { populations: ['orvia_users'] },
      excludedPopulations: [],
      safetyLimits: ['target_time_must_never_seed_capacity_zones'],
      conservativeFallback: 'Fehlt jede Ist-Basis, bleibt die Kapazität unbekannt — die Zielzeit füllt die Lücke nicht.',
      claims: [
        podClaim({
          claimId: 'GOAL-P1', statement: 'Aspiration-/Capacity-Trennung folgt dem Portfolio-Vertrag v2 (interpretation aspiration; capacity getrennt).',
          sourceRefs: ['SRC-ORVIA-PORTFOLIO-CONTRACT'],
          uncertainties: ['Produktvertrag; Feasibility-Kriterien folgen in 3c']
        })
      ]
    }),
    rule({
      ruleId: 'RUN-DATA-001', topic: 'data_comparability',
      statement: 'Zulässige Datengrundlage sind ausschließlich kanonische, deduplizierte Aktivitäten mit Provenienz und expliziten Einheiten; Unklares trägt keine Last und geringe ratioConfidence begrenzt lastbasierte Aussagen.',
      inputs: ['activities.canonicalDailyLoad', 'loadHistory.ratioConfidence', 'loadHistory.quality', 'provenance'],
      outputs: ['dataEligibilityState'],
      applicability: { populations: ['orvia_users'] },
      excludedPopulations: [],
      safetyLimits: ['unknown_units_carry_no_load', 'low_ratio_confidence_blocks_ratio_gates'],
      conservativeFallback: 'Nicht einzuordnende Daten werden ausgeschlossen und als Lücke ausgewiesen, nie geschätzt.',
      claims: [
        podClaim({
          claimId: 'DATA-P1', statement: 'Datenzulässigkeit folgt dem technisch getesteten Batch-2-Vertrag (Dedupe P1–P6, loadBasis/loadUnit, ratioConfidence-Fenster).',
          uncertainties: ['Produktvertrag; fachliche Eignung der Confidence-Schwellen ungeprüft']
        })
      ]
    })
  ];

  /* Golden-Case-Anker (Wissen, kein Plan). */
  var GOLDEN_CASE = {
    caseId: 'gian_half_marathon_reference',
    anchors: [
      { ruleId: 'RUN-LONG-001', claim: 'Der längste reale Long Run ist eine GRUPPIERTE Einheit und zählt genau einmal als Evidenz.' },
      { ruleId: 'RUN-GOAL-001', claim: 'Die Halbmarathon-Zielzeit ist Wunschwert, nie Capacity-Quelle.' },
      { ruleId: 'RUN-INT-001', claim: 'Ohne belastbare Pace-Evidenz keine hochintensive Pace-Vorgabe — RPE/HF + Kalibrierung, niedrige Confidence.' },
      { ruleId: 'RUN-SAFE-001', claim: 'Der Knie-/Beschwerdekontext kann Safety ausschließlich verschärfen (Regel bis zur medizinischen Prüfung gesperrt).' },
      { ruleId: 'RUN-PROG-001', claim: 'Kein universelles Steigerungsgesetz; Progressionssignale sind statistisch unsichere Kontexte.' }
    ],
    schedulingNote: 'Fester Donnerstag-Ruhetag und alle Termine werden erst im Scheduler (Batch 4) terminiert.',
    longTermNote: 'Mittel-/Langfristziele (70.3, Ironman) bleiben Abhängigkeiten des Portfolio-Vertrags, nicht dieses Packs.'
  };

  function _freeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { _freeze(o[k]); }); Object.freeze(o); } return o; }

  var pack = {
    packId: 'running',
    version: PACK_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
    sport: 'running',
    rules: RULES,
    goldenCase: GOLDEN_CASE,
    contentHash: null
  };
  /* Deklarierter Content-Hash aus dem Vertrag (fail-closed: ohne geladenen
     Vertrag bleibt er null und validatePack/selectRules blockieren). */
  if (O.knowledgeContracts && typeof O.knowledgeContracts.packContentHash === 'function') {
    pack.contentHash = O.knowledgeContracts.packContentHash(pack);
  }

  O.runningKnowledgePack = _freeze(pack);
  if (typeof module !== 'undefined' && module.exports) module.exports = O.runningKnowledgePack;
})(typeof globalThis !== 'undefined' ? globalThis : this);
