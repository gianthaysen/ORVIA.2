# ORVIA · Wissenschaftlicher Review — Dokumentations-Skelett (Phase 6.2)

**Stand:** 2026-08-05 · **GENERIERT aus** `running-knowledge-pack.js` (knowledgeVersion kb-run-v3.0.0, packContentHash `fnv1a-544d89fa…`)

**VERBINDLICH (Entscheidung ②, E-27-Nachtrag):** Dieses Dokument ändert KEINEN Review-Status. Alle Regeln bleiben `unreviewed`; das Production-Gate in `selectRules` bleibt geschlossen, bis ein qualifizierter Review real existiert. Ein Review ist nur gültig mit exakt passendem reviewedRuleEvidenceHash + reviewedSourceRegistryHash + Qualifikationsnachweis (Vertrag v3) — jede fachliche Änderung invalidiert ihn automatisch.

**Regelbestand:** 14 Regeln über 14 Topics · 2 davon medicalSafetyRelevant (in JEDEM Modus gesperrt bis medizinischer Review).

---

## RUN-HIST-001 · training_history

**Regelinhalt:** Trainingshistorie und -erfahrung moderieren die Belastungsverträglichkeit; die Historienreife der Daten begrenzt jede Aussage.

**Zielgruppe:** novice_runners, recreational_runners
**Ausgeschlossen:** minors, medically_restricted
**Konservative Grenze / Fallback:** Ohne belastbare Historie: niedrigste Stufe + niedrige Confidence.
**Safety-Limits:** insufficient_history_forces_conservative_tier

**Evidenz (3 Claims):**

- `HIST-C1` Anfänger haben pro Laufstunde eine deutlich höhere Verletzungsinzidenz als erfahrene Freizeitläufer.
  - Quelle(n): SRC-VIDEBAEK-2015 — Incidence of Running-Related Injuries Per 1000 h of Running in Different Types of Runners: Systematic Review and Meta-Analysis
  - Unsicherheiten: Heterogene Verletzungsdefinitionen; Gruppenraten ≠ Individualprognose
- `HIST-C2` Verletzungen entstehen im Rahmenmodell, wenn sessionbezogene Belastung die individuell variable Belastbarkeit übersteigt.
  - Quelle(n): SRC-BERTELSEN-2017 — A framework for the etiology of running-related injuries
  - Unsicherheiten: Konzeptmodell ohne quantitative Grenzwerte
- `HIST-P1` ORVIA stuft Erfahrung/Historienreife in Tiers und erzwingt bei unzureichender Historie die konservativste Stufe (Datenbasis: kanonischer Batch-2-Lastvertrag).
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Tier-Grenzen sind Produktheuristik, wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-CONS-001 · frequency_consistency

**Regelinhalt:** Häufigkeit und Konsistenz der letzten Wochen sind Voraussetzung jeder Umfangsbasis-Aussage.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Bei geringer Konsistenz keine Umfangsbasis-Behauptung, sondern Konsistenzaufbau als Vorstufe.
**Safety-Limits:** low_consistency_blocks_volume_progression_claims

**Evidenz (2 Claims):**

- `CONS-C1` Leitlinien empfehlen regelmäßige, über die Woche verteilte Ausdaueraktivität mit gradueller Progression.
  - Quelle(n): SRC-ACSM-2011 — ACSM Position Stand: Quantity and Quality of Exercise for Developing and Maintaining Fitness in Apparently Healthy Adults
  - Unsicherheiten: Fitness-/Gesundheitskontext, nicht wettkampfspezifisch
- `CONS-P1` ORVIA bestimmt Konsistenz aus aktiven Lasttagen der Batch-2-Fenster und blockiert Volumenaussagen bei geringer Konsistenz.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Konsistenz-Schwellen sind Produktheuristik, wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-VOL-001 · weekly_volume

**Regelinhalt:** Das aktuelle Wochenvolumen wird als Bandbreite aus mehreren robusten jüngeren Wochen bestimmt — nie aus einer Spitzenwoche.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Bei Lücken untere plausible Bandbreite + Missingness-Ausweis.
**Safety-Limits:** single_peak_week_must_not_define_baseline

**Evidenz (2 Claims):**

- `VOL-C1` Belastungssteuerung soll sich an der gewohnten (chronischen) Belastung orientieren; große Abweichungen davon sind Risikokontext.
  - Quelle(n): SRC-IOC-LOAD-2016 — How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury
  - Unsicherheiten: Keine sportart-/populationsspezifischen Grenzwerte
- `VOL-P1` ORVIA aggregiert die Bandbreite ausschließlich aus der kanonischen, deduplizierten Tageslast (Batch-2-Vertrag); die Fensterwahl ist eine versionierte Produktheuristik.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Aggregationsfenster/Bandbreitenbildung wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-LONG-001 · long_run_evidence

**Regelinhalt:** Die längste zusammenhängend gruppierte Laufeinheit ist eine eigene Evidenzeinheit und zählt genau einmal (Split-Aufzeichnungen = EINE Einheit).

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Ohne gruppierbare Einheiten gilt die Long-Run-Basis als unbekannt (kein Schätzwert).
**Safety-Limits:** split_recordings_must_not_double_count

**Evidenz (1 Claims):**

- `LONG-P1` Gruppierungs- und Einmalzählungs-Mechanik folgt dem technisch getesteten Batch-2-Vertrag (Gap-Toleranz, Rohaktivitäten bleiben erhalten).
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2) · SRC-ORVIA-PORTFOLIO-CONTRACT — ORVIA Goal/Capacity/Periodization-Vertrag (Batch 3a, Portfolio v2)
  - Unsicherheiten: Gap-Toleranz ist Produktparameter; fachliche Eignung der Long-Run-Evidenz ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-RESP-001 · load_response

**Regelinhalt:** Interne Last (Session-RPE) und die beobachtete Reaktion nach belastenden Einheiten kalibrieren die individuelle Verträglichkeit.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Ohne Reaktionsdaten wird Verträglichkeit als unbeobachtet markiert, nie optimistisch geschätzt.
**Safety-Limits:** negative_response_forces_conservative_recalibration

**Evidenz (2 Claims):**

- `RESP-C1` Session-RPE (RPE × Dauer) ist ein valides, praxistaugliches Maß interner Trainingslast.
  - Quelle(n): SRC-FOSTER-2001 — A New Approach to Monitoring Exercise Training (Session-RPE)
  - Unsicherheiten: Subjektiv, kontextsensitiv (Schlaf/Stress/Hitze)
- `RESP-P1` Das konkrete ORVIA-Reaktionsfenster von 24–48 Stunden nach belastenden Einheiten ist eine EIGENE, von der sRPE-Validität GETRENNTE Produktannahme.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Fensterlänge und Bewertungslogik wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-INT-001 · intensity_control_prerequisites

**Regelinhalt:** Intensitätssteuerung hat getrennte Voraussetzungen je Steuergröße; ohne belastbare Basis wird konservativ ohne Pace-Vorgabe gesteuert.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Ohne Pace-Basis: RPE-/HF-Steuerung + Kalibrierungshinweis, niedrige Confidence.
**Safety-Limits:** no_pace_prescription_without_recent_comparable_evidence

**Evidenz (3 Claims):**

- `INT-C1` Altersformeln für die maximale Herzfrequenz haben große individuelle Streuung; formelbasierte HF-Zonen sind Näherungen.
  - Quelle(n): SRC-TANAKA-2001 — Age-predicted maximal heart rate revisited
  - Unsicherheiten: Individuelle HFmax kann deutlich abweichen
- `INT-C2` RPE-basierte Laststeuerung ist validiert und ohne Gerätevoraussetzungen verfügbar.
  - Quelle(n): SRC-FOSTER-2001 — A New Approach to Monitoring Exercise Training (Session-RPE)
  - Unsicherheiten: Validiert als Lastmaß, nicht als Zonensteuerung im Einzelnen
- `INT-P1` Die ORVIA-Hierarchie (RPE immer; HF nur mit belastbarer Referenz; Pace nur mit jüngerer vergleichbarer Leistungs-Evidenz) und die Definition von „recent comparable performance" sind Produktregeln und übernehmen keine Studienklasse.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Hierarchie und Vergleichbarkeitskriterien wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-DIM-001 · intensity_dimensions

**Regelinhalt:** Easy-, Long-, Schwellen- und hochintensive Belastung werden als getrennte Dimensionen geführt; harte Anteile bleiben konservativ begrenzt.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Ohne Intensitätsdaten nur locker/hart-Unterscheidung mit konservativ begrenztem hartem Anteil.
**Safety-Limits:** high_intensity_share_stays_minor_fraction

**Evidenz (2 Claims):**

- `DIM-C1` Bei gut trainierten bis Weltklasse-Ausdauerathleten ist BEOBACHTET, dass der Großteil des Trainingsvolumens niedrig-intensiv absolviert wird.
  - Quelle(n): SRC-SEILER-2010 — What is Best Practice for Training Intensity and Duration Distribution in Endurance Athletes? · SRC-HAUGEN-2022 — The Training Characteristics of World-Class Distance Runners: An Integration of Scientific Literature and Results-Proven Practice
  - Unsicherheiten: Elitepraxis validiert keine Freizeitläufer-Budgets; Beobachtung ≠ Kausalität
- `DIM-P1` Die Übertragung auf Freizeitläufer (getrennte Dimensionen, konservativ kleiner harter Anteil, keinerlei Quoten) ist eine ORVIA-Produktheuristik — KEIN validiertes 80/20-Budget.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Übertragbarkeit auf Freizeitläufer ungeprüft; Quoten bewusst nicht definiert

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-PROG-001 · progression_limits

**Regelinhalt:** Es gibt kein belegtes universelles Steigerungsgesetz; Progressionssignale sind unsichere Risikokontexte und werden konservativ, individualisiert und mit sichtbarer Unsicherheit verarbeitet.

**Zielgruppe:** novice_runners, recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Bei unklarer Basis konservativste plausible Progressionsstufe; Feasibility bleibt Szenario (3c).
**Safety-Limits:** multiweek_rapid_spikes_are_flagged_never_prescribed; ratio_signals_are_context_not_thresholds

**Evidenz (5 Claims):**

- `PROG-C1` Ein an der festen Zehn-Prozent-Regel orientiertes graduiertes Programm senkte die Verletzungsrate bei Laufanfängern nicht (RCT).
  - Quelle(n): SRC-BUIST-2008 — No Effect of a Graded Training Program on the Number of Running-Related Injuries in Novice Runners (GRONORUN RCT)
  - Unsicherheiten: Ein Programmvergleich; widerlegt Universalität, nicht graduelle Progression generell
- `PROG-C2` Der Hauptvergleich bei Nielsen war statistisch NICHT signifikant; nur ein Subgruppenbefund (distanzassoziierte Verletzungen bei Steigerung über ~30 %) deutete mit p = .07 UNSICHER auf erhöhtes Risiko.
  - Quelle(n): SRC-NIELSEN-2014 — Excessive Progression in Weekly Running Distance and Risk of Running-Related Injuries
  - Unsicherheiten: Statistisch unsicher (p = .07); Subgruppenanalyse, kein Schwellenwertbeleg
- `PROG-C3` Bei Damsted war der Zusammenhang zwischen Distanzänderung und Verletzung nur zeitlich begrenzt signifikant und später nicht mehr — ein instabiles Signal.
  - Quelle(n): SRC-DAMSTED-2019 — The Association Between Changes in Weekly Running Distance and Running-Related Injury: Preparing for a Half Marathon
  - Unsicherheiten: Zeitlich instabiler Effekt; Selbstauskunft
- `PROG-C4` Quotientenmodelle wie ACWR sind konzeptionell/methodisch nicht als präzise Verletzungsprädiktoren belastbar.
  - Quelle(n): SRC-IMPELLIZZERI-2020 — Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls
  - Unsicherheiten: Kritik entwertet das Grundprinzip „viel mehr als gewohnt ist riskant" nicht, nur dessen naive Quantifizierung
- `PROG-P1` ORVIA verarbeitet Progressionssignale ausschließlich als unsichere Risiko-KONTEXTE (Flags, qualitative Envelope) — nie als Schwellenwerte oder Vorgaben; die konkrete Flag-Logik ist eine ungeprüfte Produktregel.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Kein validierter individueller Grenzwert existiert; Flag-Logik wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-RTR-001 · return_to_run · ⚠️ medicalSafetyRelevant

**Regelinhalt:** Nach Laufunterbrechung wird unterhalb des früheren Niveaus graduiert wieder aufgebaut; Krankheits-/Beschwerde-Gates haben Vorrang vor jedem Zielpfad.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Bei unbekannter Unterbrechungsursache wird wie nach relevanter Unterbrechung aufgebaut.
**Safety-Limits:** no_immediate_return_to_previous_volume; illness_gate_precedes_goal_pursuit

**Evidenz (2 Claims):**

- `RTR-C1` Das allgemeine Prinzip gradueller Wiederbelastung nach Belastungsunterbrechung ist konsensbasiert — ein KONKRETES Return-to-Run-Protokoll belegen die zitierten Quellen NICHT.
  - Quelle(n): SRC-IOC-LOAD-2016 — How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury · SRC-BERTELSEN-2017 — A framework for the etiology of running-related injuries
  - Unsicherheiten: Kein konkretes Protokoll in den Quellen
- `RTR-P1` Rückstufungs-Tiers und Wiedereinstiegslogik sind eine UNGEPRÜFTE Experten-/Produktregel und bleiben bis zur medizinisch-fachlichen Prüfung gesperrt.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Rückstufungsgrößen wissenschaftlich/medizinisch ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-SAFE-001 · safety_gates · ⚠️ medicalSafetyRelevant

**Regelinhalt:** Beschwerden verschärfen Belastungsgrenzen ausschließlich (tighten only); unklare oder eskalierende Beschwerdebilder werden zur professionellen Abklärung ausgewiesen. ORVIA diagnostiziert nicht.

**Zielgruppe:** recreational_runners, patellofemoral_pain_context
**Ausgeschlossen:** acute_traumatic_injury, medically_restricted
**Konservative Grenze / Fallback:** Im Zweifel restriktivere Auslegung + Hinweis auf professionelle Abklärung.
**Safety-Limits:** tighten_only_never_relax; red_flags_stop_training_evaluation

**Evidenz (5 Claims):**

- `SAFE-C1` Patellofemoraler Schmerz ist ein belastungssensitives Beschwerdebild (Provokation u. a. durch tiefe Beugung, Treppen, Laufen) mit häufig persistierendem Verlauf.
  - Quelle(n): SRC-CROSSLEY-PFP-2016 — 2016 Patellofemoral pain consensus statement (4th International PFP Research Retreat, Manchester), Part 1
  - Unsicherheiten: Golden-Case-Kniebefund medizinisch nicht gesichert
- `SAFE-C2` Bei patellofemoralem Schmerz wird Übungstherapie im Konsens unterstützt — insbesondere die Kombination hüft- und kniefokussierter Übungen — mit den Zielgrößen Schmerz und Funktion. Mehr trägt die Quelle nicht.
  - Quelle(n): SRC-COLLINS-PFP-2018 — 2018 Consensus statement on exercise therapy and physical interventions for patellofemoral pain (5th International PFP Research Retreat)
  - Unsicherheiten: Konsens für diagnostiziertes PFP, nicht für unklare Kniebeschwerden generell
- `SAFE-P3` Die Ableitung „belastungsmodifizierend statt pauschal stoppen" ist eine NACHGELAGERTE ORVIA-Produktinferenz aus der Übungstherapie-Empfehlung — sie steht NICHT in Collins 2018 und bleibt bis zur medizinischen Prüfung Produktannahme.
  - Quelle(n): SRC-ORVIA-PORTFOLIO-CONTRACT — ORVIA Goal/Capacity/Periodization-Vertrag (Batch 3a, Portfolio v2)
  - Unsicherheiten: Produktinferenz ohne direkte Quellenaussage; der medizinischen Prüfung vorzulegen
- `SAFE-P1` Der tighten-only-Mechanismus (Beschwerden können Grenzen nur verschärfen, nie lockern) ist ORVIA-Produktpolitik.
  - Quelle(n): SRC-ORVIA-PORTFOLIO-CONTRACT — ORVIA Goal/Capacity/Periodization-Vertrag (Batch 3a, Portfolio v2)
  - Unsicherheiten: Produktpolitik, der medizinischen Prüfung vorzulegen
- `SAFE-P2` Die konkrete ORVIA-Eskalations-/Warnzeichenliste (Schmerztrend, Ruhe-/Nachtschmerz, Schwellung/Instabilität, Red-Flag-Symptome) ist eine UNGEPRÜFTE Produkt-/Expertenregel ohne belegende Konsensquelle und bleibt bis zur medizinischen Prüfung gesperrt.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Liste medizinisch ungeprüft; Quellenlage für Eskalationskriterien offen

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-ENV-001 · environment_comparability

**Regelinhalt:** Umweltkontext begrenzt die Vergleichbarkeit von Pace-/HF-Daten; die Faktoren sind GETRENNT zu bewerten und nur Hitze ist konsensbelegt.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Fehlen Umweltdaten, wird Vergleichbarkeit als unbekannt markiert, nie angenommen.
**Safety-Limits:** heat_degraded_sessions_not_used_as_fitness_regression_evidence

**Evidenz (2 Claims):**

- `ENV-C1` HITZE erhöht die physiologische Beanspruchung bei gleicher äußerer Leistung deutlich; Leistungs-/HF-Daten aus Hitzebedingungen sind mit Normalbedingungen eingeschränkt vergleichbar.
  - Quelle(n): SRC-RACINAIS-2015 — Consensus recommendations on training and competing in the heat
  - Unsicherheiten: Konsens fokussiert Hitze/Wettkampf
- `ENV-P1` Höhenmeter, Untergrund und sonstiges Wetter werden als GETRENNTE Vergleichbarkeits-Flags geführt; dafür liegt derzeit KEINE eigene Quellenbasis im Register vor — Produktannahme bis zur Nachrecherche.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Höhe/Untergrund/Wetter ohne eigene Registerquellen — als Produktannahme sichtbar

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-MECH-001 · mechanical_load

**Regelinhalt:** Harte Einheiten und lange Läufe werden als mechanische Spitzen gezählt; aufeinanderfolgende harte Tage werden von ORVIA VORSICHTSHALBER als erhöht belastend behandelt — ein spezifischer Überproportionalitäts-Beleg liegt nicht vor.

**Zielgruppe:** recreational_runners
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Bei unbekannter Härteklassifikation wird eine Einheit im Zweifel als hart gewertet.
**Safety-Limits:** consecutive_hard_days_flagged

**Evidenz (2 Claims):**

- `MECH-C1` Im Ätiologie-Rahmenmodell hängt das Verletzungsrisiko von der Abfolge von Belastung und (unvollständiger) Wiederherstellung der Belastbarkeit ab.
  - Quelle(n): SRC-BERTELSEN-2017 — A framework for the etiology of running-related injuries
  - Unsicherheiten: Konzeptmodell — kein empirischer Beleg für „überproportionale" Kumulation aufeinanderfolgender harter Lauftage
- `MECH-P1` Die Zählung harter Tage/mechanischer Spitzen (Batch-2-Härtemodell) und die Abstandsanforderung sind konservative Produktregeln ohne spezifischen Quellenbeleg.
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Härteschwellen und Abstandslogik wissenschaftlich ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-GOAL-001 · goal_aspiration

**Regelinhalt:** Zielzeiten sind Wunschgrößen (Aspiration) und niemals Eingangsgröße einer Kapazitätsberechnung; Erreichbarkeit wird später ausschließlich als Szenario bewertet.

**Zielgruppe:** orvia_users
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Fehlt jede Ist-Basis, bleibt die Kapazität unbekannt — die Zielzeit füllt die Lücke nicht.
**Safety-Limits:** target_time_must_never_seed_capacity_zones

**Evidenz (1 Claims):**

- `GOAL-P1` Aspiration-/Capacity-Trennung folgt dem Portfolio-Vertrag v2 (interpretation aspiration; capacity getrennt).
  - Quelle(n): SRC-ORVIA-PORTFOLIO-CONTRACT — ORVIA Goal/Capacity/Periodization-Vertrag (Batch 3a, Portfolio v2)
  - Unsicherheiten: Produktvertrag; Feasibility-Kriterien folgen in 3c

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

## RUN-DATA-001 · data_comparability

**Regelinhalt:** Zulässige Datengrundlage sind ausschließlich kanonische, deduplizierte Aktivitäten mit Provenienz und expliziten Einheiten; Unklares trägt keine Last und geringe ratioConfidence begrenzt lastbasierte Aussagen.

**Zielgruppe:** orvia_users
**Ausgeschlossen:** 
**Konservative Grenze / Fallback:** Nicht einzuordnende Daten werden ausgeschlossen und als Lücke ausgewiesen, nie geschätzt.
**Safety-Limits:** unknown_units_carry_no_load; low_ratio_confidence_blocks_ratio_gates

**Evidenz (1 Claims):**

- `DATA-P1` Datenzulässigkeit folgt dem technisch getesteten Batch-2-Vertrag (Dedupe P1–P6, loadBasis/loadUnit, ratioConfidence-Fenster).
  - Quelle(n): SRC-ORVIA-BATCH2-CONTRACT — ORVIA Activity-Dedupe-/Grouping-/Load-Vertrag (Batch 2)
  - Unsicherheiten: Produktvertrag; fachliche Eignung der Confidence-Schwellen ungeprüft

**Review (AUSZUFÜLLEN — bleibt leer bis realer Review):**

| Feld | Wert |
|---|---|
| Review-Datum | — |
| Reviewer (Name, Qualifikation) | — |
| Qualifikationsnachweis verifiziert | — |
| Zulässiger Anwendungsbereich (bestätigt) | — |
| Kontraindikationen (ergänzt) | — |
| Einschätzung Unsicherheit | — |
| reviewedRuleEvidenceHash | — |
| Ergebnis (approved/rejected/needs_changes) | — |

---

