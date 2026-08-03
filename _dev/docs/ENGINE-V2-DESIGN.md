# ORVIA · ENGINE-V2-DESIGN (C2–C8)

Status: IMPLEMENTIERT ALS PARALLELE SCHICHT (2026-07-03) — **NICHT AKTIV**. Die Dateien liegen unter `js/engine/`, sind bewusst NICHT in index.html/sw.js eingebunden und werden ausschließlich von `supabase/tests/engine_v2_test.mjs` (130 Fälle grün) konsumiert. Die alte Engine (calc.js buildTrainingDecision) bleibt die einzige produktive Quelle.

## 1. Architektur — drei getrennte Schichten

| Schicht | Datei | Frage | Output |
|---|---|---|---|
| Readiness | js/engine/readiness-engine-v2.js | Wie belastbar bin ich heute? | { score(0–100\|null), confidence, factors[], warnings[], missingData[] } |
| Decision | js/engine/decision-engine-v2.js | Was sollte ich heute tun? | { dayState, action, recommendedSession, adjustment, reasons[], safeguards[], confidence, missingData[] } |
| Plan | js/engine/plan-engine-v2.js | Wie ist die Woche gebaut? | { week[7], reasons[], confidence, volumeSummary } |
| Verträge | js/engine/engine-contracts.js | Reason-Katalog, Confidence-Aggregation, Ergebnis-Validatoren | — |

Trennungsregeln: Readiness bewertet NUR physiologische Erholung (Schmerz/Beschwerden sind Decision-Gates, kein Erholungsabzug); der Score trägt keine Entscheidungs-Caps; Plan-Aufbau ist von der Tagesentscheidung getrennt.

## 2. Korrekturen gegenüber v1 (aus ENGINE-CONTRACT-AUDIT)

1. **Keine erfundenen Werte:** fehlende Inputs → missingData[] + Renormalisierung; <2 echte Marker → score:null (V2-Vergleichstest dokumentiert die beabsichtigte Differenz zur Alt-Engine).
2. **Ein Input, eine Wirkung:** Schmerz wirkt nur in der Decision (Gate + Kontext), BodyBattery ist Zusatzinfo mit Gewicht 0 (Doppelzählung beseitigt).
3. **Konsistente Baselines:** ln-HRV vs. 7-T-Basislinie, SWC 0,5×SD28, Mindesthistorie 14 T; Ruhepuls nur gegen persönliche Basislinie (≥7 T); sonst `missing_baseline` statt Strafe. Schlaf gegen das PROFIL-Schlafziel, nicht gegen fixe 480 min.
4. **Lastmodell:** acute7 vs. chronic28PerWeek mit Datengate (≥7 Tage), Spike >1,5 / erhöht >1,25; harte-Tage-Streak als eigener Input.
5. **Safety als Input-Vertrag:** safetyFlags werden als ERHOBENE Felder erwartet; der M7-Sicherheitscheck liefert kanonische constraintsList-Einträge. Schmerz ≥8 → RED immer; Kontextregel Knie↔Oberkörper implementiert und getestet.
6. **Explainability (C3):** jeder Grund als `{ code, severity, title, explanation, inputValues, ruleVersion }` aus zentralem Katalog (poor_sleep, elevated_resting_hr, low_hrv, high_recent_load, load_spike, insufficient_recovery, active_constraint, severe_pain, red_flag_symptom, illness, consecutive_hard_days, target_event_near, availability_limited, beginner_progression, return_after_break, plan_structure, missing_baseline, missing_checkin, low_data_confidence, schedule_conflict, high_monotony).
7. **Confidence (C4):** deterministisch aus missingData; Decision-Confidence nie besser als die Readiness-Confidence; fehlende Daten führen IMMER zur vorsichtigeren Aktion.

## 3. Invarianten (C7) — alle testgesichert (engine_v2_test.mjs)

Akute starke Beschwerden → keine harte Einheit · sehr schlechte Regeneration → keine Steigerung · keine harten Tage in Folge (Plan UND Decision-Streak) · Verfügbarkeit nie ignoriert · Taper ≤7 T (Plan) bzw. ≤2 T (Decision MOVE_SESSION) · Anfänger ≤1 harte Einheit, Wiedereinstieg 0 · keine negativen Minuten · nur aktive Sportarten · keine Doppeleinheiten · nie 7/7 (erzwungener Ruhetag) · fehlende Daten senken Confidence · jede Ausgabe trägt Gründe.

## 4. Bewusste Grenzen (ehrlich)

- Minuten-/Volumenangaben sind Strukturwerte aus Verfügbarkeit/typischer Dauer — keine km-Ziele, keine Pace-Vorgaben (das braucht Leistungsdaten-Historie; Folgepaket).
- Monotony/Strain (Foster) als Reason-Code vorgesehen, Berechnung folgt mit der Tabellen-Lastserie.
- Kein Shadow-Mode-Logging im Client (bewusst: erst nach Produktentscheidung Telemetrie).

## 5. Aktivierungsgate (C8) — Checkliste

- [x] Invarianten grün (130/130)
- [x] Vergleichsbericht Alt/Neu (V1–V3 in engine_v2_test.mjs; dokumentierte Differenz: leerer Check-in → neu score:null)
- [ ] UI kann neue Outputs darstellen (Reasons/Confidence/missingData-Rendering; orviaScore-Adapter ersetzen)
- [ ] Feature-Flag (z. B. ORVIA_CFG.engineV2) + Legacy-Fallback
- [ ] Shadow-Mode über ≥14 reale Tage (alte und neue Ausgabe je Check-in protokolliert, Differenzen fachlich bewertet)
- [ ] Ablösungsplan für die 6 Duplikat-Leser (ampel/unitGuidance/insights/intelligence/CSV/renderReadiness) — Risikoliste in ENGINE-CONTRACT-AUDIT §5 und Sessions-Audit G1–G10
- [ ] Persistenz-Versionierung: readiness_scores.engine_version hochziehen; workout_sessions-Snapshot-Wording einfrieren

**Aktivierung erfolgt in einem eigenen Paket** (Script-Tags + sw-ASSETS + Adapter + Flag) — ausdrücklich NICHT Teil des v8-177-Bündels.
