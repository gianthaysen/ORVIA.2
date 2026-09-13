# A-12 · Shadow-Gate-Report (13.09.2026, Safari/Mac, Build v8-376)

`ORVIA.engineShadow.gateReport()` → **gateReady: false** · Blocker **S2** · ausstehend **S1**

| Kriterium | Status | Befund |
|---|---|---|
| S1 ≥ 14 vergleichbare Tage | insufficient_data | **5 von 14** (9 Tage protokolliert seit 21.08. — der Tages-Shadow läuft nur, wenn die App auf diesem Gerät geöffnet wird; das Protokoll ist gerätelokal) |
| S2 keine Safety-Divergenz (v2 nachsichtiger als v1) | **fail** | 2 von 3 Divergenzen safety-relevant, Übereinstimmung 40 % |
| S3 deterministisch | pass | 4/4 Wochen |
| S4 keine ungültigen Sessions | pass | 0 |
| S5 Provenienz vollständig | pass | 4/4 |
| Wochen | 4 geplant, 4 ok, 0 blockiert | Flags: `no_pace_evidence_shadow`, `quality_withheld_low_confidence:running`, `conservative_generic_no_capacity:padel/swimming` |

## Die zwei S2-Divergenzen — und die Korrektur (decision-engine-v2, RULE_VERSION v2.0.1-parallel)

1. **21.08.** v1 YELLOW / v2 GREEN, beide KEEP. v2-Grund `low_data_confidence` (info). **Korrektur (nach Suite-Befund Batch 2c/2d):** v2 bleibt bewusst GREEN — eine Datenlücke ist keine Warnung, die Unsicherheit trägt `confidence` („Datenlücke ≠ Wert“). v1s YELLOW ist genau die Semantik, die v2 ersetzt. Stattdessen stuft **shadow-eval v1.1** eine Divergenz als `v2_confidence_carried` (kein Blocker) ein, wenn NUR der Zustand lockerer ist, die Aktion identisch ist und v2 ausschließlich Info-Gründe zur Datenqualität nennt. Jeder Nicht-Info-Grund oder eine lockerere Aktion bleibt Blocker.
2. **13.09.** v1 RED/REST / v2 RED/REPLACE_WITH_RECOVERY bei `severe_pain` Intensität **9**. v2 sagte „kein belastendes Training“ und plante trotzdem 20 min aktive Erholung. **Fix:** Schmerz ≥ 8 ⇒ REST. Die v2-Invariante „Knie 4 + Oberkörper ≠ Stopp“ bleibt für moderaten Schmerz unberührt.

Tests: engine_v2 D2b–D2d (133), phase8_shadow_eval +3 (41), batch2c/2d unverändert grün.

## Was jetzt fehlt
- **S1**: 9 weitere vergleichbare Tage. Der Shadow läuft je Gerät beim Öffnen der App; ein Tag zählt nur mit Check-in (vergleichbar). Alternative: Tages-Shadow-Protokoll serverseitig sammeln (wie A-06 goal-shadow), damit Handy und Mac zusammen zählen — noch nicht gebaut.
- Nach 14 Tagen erneut `gateReport()`; bei `gateReady: true` → Canary (`nextStep` verweist dann auf die Aktivierung, docs/ENGINE-PLAN-AKTIVIEREN.md).
- Die Wochen-Flags zeigen den nächsten Engpass der Wochen-Engine: `no_pace_evidence_shadow` / `quality_withheld_low_confidence:running` — die Wochen-Engine hält Qualitätseinheiten zurück, solange keine Pace-Evidenz vorliegt. Mit performance-zones v3 (Schwelle aus 10 km) liegt sie jetzt vor; ob der Shadow sie liest, prüft der nächste Report.
