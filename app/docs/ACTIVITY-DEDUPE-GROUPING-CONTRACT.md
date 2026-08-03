# ORVIA · Activity-Dedupe- und Gruppierungs-Vertrag

Status: IMPLEMENTED (Batch 2b, 2026-07-18) · Kanonische Umsetzung: `js/activity-config.js` (`dailyLoadUnits`, `groupActivitySessions`), `js/activity-store.js` (`mergeServerActivities`), `js/activity-normalize.js` (`normalizeActivityRecord`).
Vertragstests: `supabase/tests/batch2b_dedupe_grouping_test.mjs`, `batch2a_canonical_load_test.mjs`.

## 1. Deduplizierung (Prioritätenkette — verbindlich)

P1 **Stabile explizite Verknüpfungen haben Vorrang.** Ein Legacy-Eintrag (`DB[date].sessions`) ist derselbe Vorgang wie eine kanonische Activity, wenn `derivedFromActivity=true` (Manual-Projektion) oder wenn `workoutSessionId`/`clientSessionId`/`canonicalActivityId` eine vorhandene Activity referenziert (Live-Spiegel). Solche Einträge zählen in keiner Analytik doppelt.

P2 **Danach `source + source_record_id` bzw. stabile Client-IDs.** Identität kanonischer Activities läuft über `activityKeys`: `id`, `clientRecordId`, `source|sourceRecordId`, `workoutSessionId`. Store-Upsert und `mergeServerActivities` sind über diese Schlüssel idempotent; Tombstones matchen über dieselben Schlüssel und gewinnen (gelöschte Aktivitäten erscheinen nie wieder).

P3 **Fingerprint markiert nur Ambiguität, dedupliziert aber NICHT** (Batch 2c): Ähnliche Dauer/Distanz ohne stabile Referenz und ohne ausreichend genaue Zeitidentität (Legacy-Sessions tragen keine Startzeit) ist KEIN Duplikatsbeweis — zwei echte, ähnliche Einheiten sind möglich. Beide Beiträge zählen; beide Seiten werden als `ambiguity:'possible_duplicate'` markiert und die Ambiguität senkt die Load-Confidence (Ratio-Gates feuern darauf nicht). Es findet KEIN automatischer RPE-Transfer statt. Toleranzen des Ambiguitätsmarkers: |Δ Dauer| ≤ max(5 min, 15 %); Distanzen, falls beide vorhanden, |Δ| ≤ 10 %.

P4 **Gleicher Tag + gleiche Sportart allein sind niemals ein Duplikat.** Zwei echte Einheiten derselben Sportart am selben Tag zählen beide.

P5 **Rohaktivitäten bleiben unverändert erhalten.** Dedupe ist reine Leselogik; keine Funktion dieses Vertrags schreibt, löscht oder mutiert Aktivitäten.

P6 **Gruppierung und Deduplizierung sind getrennte Konzepte.** Gruppen (unten) fassen echte, einzeln gezählte Aktivitäten zusammen; sie dedupen nie und verändern keine Last.

## 2. Last-Ausweis je Beitrag (`dailyLoadUnits`)

Jeder Beitrag weist aus: `source`, Berechnungsweg (`loadBasis`), Einheiten (`durationUnit:'min'`, `loadUnit:'srpe_au'`), `confidence` und die Dedupe-Entscheidung (`dedupe.decision` inkl. Regel/Match-Referenz; ausgeschlossene Beiträge stehen auditierbar in `excluded[]`).

| loadBasis | Bedeutung | confidence |
|---|---|---|
| `srpe_measured` | Dauer × gemessenes RPE | high (bei Ambiguität: low) |
| `duration_default_intensity` | Dauer × dokumentierte Intensitätsannahme (5, mobility 2 — historische `Calc.sessionLoad`-Konvention); **es wird KEIN RPE-Wert erfunden** (`rpe` bleibt `null`) | low |
| `unknown` | keine berechenbare Belastungsbasis (z. B. keine Dauer) — `load:null`, zählt in `unknownUnits`, **nie still 0 oder Default** | unknown |

**Härte-Signale (Batch 2c — ersetzt die globale „≥14 km = hart"-Regel):** je Beitrag getrennt `intensityHard` (gemessenes RPE ≥ 7), `longSession` (sportartspezifisch: Laufen ≥ 14 km oder ≥ 90 min; Rad ≥ 80 km oder ≥ 150 min; Schwimmen ≥ 3000 m oder ≥ 90 min; sonst ≥ 120 min — versionierte Heuristik `LONG_SESSION_RULES`), `mechanicalImpact` (Impact-Sportarten) und `hardDay` = intensityHard ODER (longSession UND mechanicalImpact). Eine lockere 40-km-Radfahrt ist damit `longSession:false, hardDay:false`; ein 16-km-Long-Run ist mechanisch hart, auch bei lockerem Tempo.

**Propagation (Batch 2c/2d):** `dailyLoadUnits` weist je Beitrag die ehrliche Einheit aus (`srpe_au` nur für gemessene sRPE, `est_load_au` für den Dauer×Default-Proxy); die gemischte Aggregation trägt die Einheit **`orvia_load_au`** mit vollständigem Methodenanteil (`measuredLoad`/`estimatedLoad`/`methodShare`). `recentLoad.quality` berechnet die Qualität GETRENNT je Quotienten-Fenster (`acute7` und volle `chronic28`-Basis: gemessene/geschätzte Last, unknown-/ambige Beiträge, `estimatedShare`, `coverageDays`, Fenster-Confidence) und leitet daraus die kombinierte **`ratioConfidence` = MIN(acute, chronic)** ab — NUR sie steuert `load_spike`/`high_recent_load` (legacy_sessions-Fallback: 'medium'). Konservatives Verhalten bei `ratioConfidence:'low'`: lockere Einheit bleibt bestehen (mit sichtbar gesenkter Confidence via missingData `load_quality`); eine geplante HARTE Einheit erscheint nie als GREEN/KEEP (mind. YELLOW + REDUCE_INTENSITY). Geschätzte Last kann Warnungen weiterhin nie unterdrücken. `hardStreak` zählt tatsächlich aufeinanderfolgende harte Tage bis gestern.

## 3. Gruppierung (`groupActivitySessions`)

Direkt aufeinanderfolgende Aktivitäten (Lücke ≤ 15 min, konfigurierbar) desselben Sports bilden EINE Session-Gruppe (`groupId`, `segments`, Summen für Dauer/Distanz); direkt anschließende Gruppen unterschiedlicher Sportarten teilen eine `brickId` (Koppel-/Brick-Einheit). Referenzfall: der 12,41-km-Long-Run aus drei Segmenten (7,00 + 2,65 + 2,76 km, 03.06.2026) ergibt eine Gruppe mit 3 Segmenten — die Last bleibt die einmalige Summe der drei Segmente, niemals das Dreifache. Aktivitäten ohne `startedAt` sind nicht gruppierbar. Nutzerbestätigung/Persistenz von Gruppen ist bewusst NICHT Teil dieses Batches (folgt mit dem Debrief-/Capacity-Konsum).

## 4. Server-Pull-Erhalt (`metrics`-Roundtrip)

`normalizeActivityRecord` reicht `metrics` durch (fehlend ⇒ `{}`, nichts erfunden). **Autoritätsregel (Batch 2c):** `mergeServerActivities` merged bei Updates JE SCHLÜSSEL — der Server gewinnt pro geliefertem Key, lokale Zusatz-Keys bleiben erhalten (ein partielles, nichtleeres Serverobjekt löscht nie unbeteiligte lokale Metrics); ein leeres Serverobjekt ändert nichts. Damit bleiben Garmin-Metriken vom Server bis ins kanonische Client-Modell erhalten — Voraussetzung für den späteren Detailimport (Splits/Laps).

## 4b. Tageszuordnung (Batch 2c)

Der Trainingstag einer Activity ist das LOKALE Datum: `dayOfActLocal(activity, timeZone)` (Intl-basiert, Zeitzone wird injiziert — Europe/Vienna: `22:30Z` gehört zum Folgetag). Ungültige Zone/fehlendes Intl ⇒ dokumentierter UTC-Fallback (`dayOfAct`). Engine-Konsument: `training-input-resolver.collectRaw`.

## 5. Plan-Actual-Link (Batch 2d: Template ≠ Instanz)

- **templateSessionId** = `item.id` der weekPlan-Einheit (`ps:…` persistiert einmalig vergeben; `psg:<tag>:<pos>:<slug>` deterministisch für generierte Pläne) — die stabile Identität des Wochen-SLOTS, bewusst wochenübergreifend gleich.
- **plannedOccurrenceId** = `po:<geplantes lokales Datum>:<templateSessionId>` — die konkrete Planinstanz: gleiche Woche über Reloads identisch, dieselbe Template-Einheit in der Folgewoche erhält eine ANDERE Occurrence-ID, durch Availability verschobene Einheiten verwenden das tatsächlich geplante Datum (die ausgerichtete Ansicht liefert den realen Wochentag).
- `workout_sessions.planned_session_id` erhält die **Occurrence-ID** (online Repository-Mapping, offline `buildSessionRow`, Queue-Parität; `offlineTerminal` übernimmt seit Batch 2e alle bestehenden Session-Felder — Folge-Upserts nullen den Anker nicht). Zusätzlich sichert `planned_session_snapshot` (Migration 0025) die geplante Vorgabe als unveränderlichen, tief kopierten Snapshot `{occurrenceId, templateSessionId, plannedDate, t, l, d, capturedAt}` — Anker für den späteren Plan-Ist-Vergleich. Ein DB-Trigger (**Migration 0026**, append-only nach der bereits ausgeführten 0025) erhält einmal gesetzte Anker bei jedem späteren Update und lehnt widersprüchliche Erstbefüllung (planned_session_id ≠ snapshot.occurrenceId) ab; Bestandszeilen bleiben unangetastet. `markPlannedDone` („erledigt ohne Messwerte") ist seit Batch 2f FAIL CLOSED: speichert Occurrence-/Template-ID + Snapshot nur in einen freien Tages-Slot (nie überschreiben; idempotent je Occurrence; Erfolgstoast nur nach verifizierter Speicherung; ohne Plan-Referenz ehrliche Ablehnung) — ohne Messwerte/RPE, bleibt `excluded_no_data` in der Last.
- **VERBINDLICHE RELEASE-REIHENFOLGE:** Migrationen 0025 UND 0026 MÜSSEN vor dem Client-Bundle aktiv sein. Geplante Workout-Starts senden `planned_session_snapshot` real — „H3: nur senden wenn belegt" schützt ausschließlich ungeplante Starts, NICHT die Kompatibilität geplanter Workouts ohne Migration. Live-Stand von 0025: laut SQL-Editor ausgeführt, technisch nicht verifiziert (Prüfsequenz im Batch-2f-Bericht).
- **Historienreife (Batch 2e):** `recentLoad.quality` führt drei Fenster (`acute7`, `prior21` = Tage 8–28, `chronic28`) mit `activeLoadDays` (ehrlich: nur Tage mit Last/unknown-Beiträgen) und `historySpanDays`; `ratioConfidence` = MIN aller Fenster UND wird bei fehlender Historienreife (prior21 < 4 aktive Lasttage oder Spanne < 14 Tage — versionierte Heuristik) hart 'low' mit eigenem Reason-Code `insufficient_chronic_history`. Eine reine letzte Woche ohne ältere Historie ergibt nie 'high'.
