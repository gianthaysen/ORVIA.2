# B-04 · Onboarding v3 — Stand und Plan

**Stand:** 11.09.2026 · Band 1: 24 h, Abhängigkeit B-01 (✅) · **DoD:** *Kein inaktiver Schritt mehr; neuer Nutzer erreicht ohne Support einen zielbasierten Plan; Schritt-Logging liefert Daten.*

## 1 · Was schon erfüllt ist

| DoD-Teil | Stand | Beleg |
|---|---|---|
| Neuer Nutzer erreicht ohne Support einen zielbasierten Plan | ✅ seit M5–M8: neun aktive Essential-Schritte (welcome, profile, sports, training_level, goals, availability, safety, body, review), alle fail-closed validiert; Ziel-Schritt ist die A-07-Zielerhebung; mit Flag `goal_plan_input` liest die Planung genau dieses Ziel | `onboarding-logic.js` STEP_CONFIG, `onboarding_completion_m4` u. a. |
| Schritt-Logging liefert Daten | ✅ **v8-368**: `engine/onboarding-log.js` + `onboarding_step_log` (0041), Ereignisse open/enter/complete/skip/back/finish mit Verweildauer, Quelle, resumed; Auswertung `_onboarding-funnel.sql` | `a6e6a90` |
| Kein inaktiver Schritt mehr | ⬜ acht IDs mit `active:false`: sport_profile, goals_detail, availability_detail, performance, recovery, preferences, devices, equipment_locations | — |

## 2 · Die acht inaktiven Schritte — Bewertung

Sie sind **keine Platzhalter, die Nutzer sehen** (v2-Placeholder wurden in M6 abgelöst), sondern reservierte kanonische IDs ohne UI. Jeder Bereich ist heute **bereits in der Profilzentrale editierbar** (Sections recovery, preferences, devices, body, sports, goals, availability). Die Frage ist also nicht „bauen oder nicht", sondern: **welche davon gehören ins Onboarding, welche bleiben Profilpflege?**

| Schritt | Datenziel (existiert) | Planwirkung heute | Empfehlung |
|---|---|---|---|
| **performance** | `profile.performance.tests[]` / Bestzeiten → performance-resolver → Zonen, Prognose | **hoch** — die eine Lücke, die Profilstärke bei jedem Ausdauerziel meldet | **aktivieren, optional, skippable** (Schritt nach `goals`): „Letzter Wettkampf oder Test: Distanz, Zeit, Datum" — ein Formular, 3 Felder |
| **preferences** | `preferences.adaptationMode / riskTolerance` → effectiveTrainingConfig | mittel (Adaptionsverhalten) | aktivieren als **zwei Chips** im availability-Schritt statt eigener Seite |
| goals_detail | Zielwert/Datum sind schon im goals-Schritt | — | **streichen** (ID entfernen) |
| availability_detail | Slots/Ruhetage — Profilzentrale | gering im Onboarding | **streichen**, bleibt Profilpflege |
| sport_profile | Nebensport-Level — Profilzentrale | gering | **streichen** |
| recovery | Schlaf/Stress — Check-in liefert das täglich | keine (planImpact:false) | **streichen** |
| devices | Garmin-Kopplung — eigener Flow (GARMIN-INTEGRATION-DESIGN) | keine direkt | **streichen** aus dem Onboarding; Hinweis auf dem Done-Screen |
| equipment_locations | Gerätepark — B-06 hat kein Übung→Gerät-Mapping | keine | **streichen** |

**Konsequenz:** „Kein inaktiver Schritt mehr" wird durch **einen neuen Schritt (performance) plus zwei Chips (preferences) plus Entfernen von sechs reservierten IDs** erfüllt — nicht durch acht Formulare. Aufwand ≈ 6 h statt 24 h. Die Drafts-Migration (v4 → v5) ist nötig, weil STEP_CONFIG die Wahrheitsquelle für Navigation/Progress ist; Muster M6 (Alias-Tabelle, keine Datenverwerfung).

## 3 · Warum ich das nicht ohne dich baue

- Der performance-Schritt ist ein **Formular mit Produktentscheidungen** (welche Distanzen als Auswahl, Test vs. Wettkampf, Pflicht-Datum?), und es ist die erste Seite, die ein neuer Nutzer sieht, wo er etwas *nicht wissen* kann — Wortlaut und Skip-Verhalten brauchen dein Auge.
- Das Streichen von sechs IDs ist eine **Architekturentscheidung gegen die Ebene-B/C-Planung** aus M8/M11. Reversibel, aber nicht still.

## 4 · Was du jetzt tun kannst

1. Migration **0041** einspielen (ohne sie schreibt der Beobachter nichts — er zählt nur, `ORVIA.onboardingLog.stats()`).
2. Einmal das Onboarding als Bearbeitung öffnen und durchklicken → `_onboarding-funnel.sql` F1 zeigt die Schritte.
3. Entscheidung zu §2: **„performance + preferences, Rest streichen"** — dann baue ich es in einem Zug.
