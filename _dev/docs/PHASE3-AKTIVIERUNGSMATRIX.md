# Phase 3 · Aktivierungsmatrix (Stand 2026-08-05, v8-227 — Block 1 + 2)

Verbindliche Matrix je Feature (Umsetzungsplan Phase 3). **Rollback gilt überall:
Flag aus ⇒ Einfluss weg, Daten bleiben** (`gmFeatureFlag()` / `orvia_flag_<id>`).

## Block 1 — umgesetzt

| | Routinen & Supplements | Abend-Check-in | Ernährung | Tip-Engine | Workout fortsetzen | Vor-Start-Werte (E-21) |
|---|---|---|---|---|---|---|
| **Entry Point** | Heute-Karte (kontextuell: nur mit konfigurierten Routinen) + „⚙ Anpassen" | Heute, ab 17 Uhr bzw. bei vorhandenen Tagesdaten | Heute-Karte; Konfiguration direkt aus der Karte (`openNutritionEditor`) | GM4-Analyse-Insight-Slots (füllt nur freie Slots) | `#resumeBanner` auf Heute (Boot-Hydrierung) | Start-Sheet vor jedem Training |
| **Datenquelle** | `PROFILE.routinesCustom` + `DB[tag].routines` | `DB[tag].eve` + `daily_checkins('evening')` | `PROFILE.nutrition` + Trainingstag | `tipEngine()` (Check-ins, HRV/RHR, Wochenvolumen) | `workout_sessions` + lokaler Cache | `gmMetric` (body_battery, stress_avg) + `orviaScore` |
| **fachl. Konsument** | Streak/Abend-Review (bestehend) | Empfehlung Folgetag (bestehend, H3) | Anzeige; keine Engine-Wirkung | Anzeige mit Konfidenz; überstimmt NIE die Tagesentscheidung (Safety-Gate) | `workoutUI.resumeActiveSync` | Anzeige + `snapshotDecision` beim Start |
| **Sichtbarkeit** | heute, Routinen konfiguriert; leer = gültige Wahl ⇒ weg | ≥ 17 Uhr / Daten vorhanden | heute | nur freie Slots | nur aktive/pausierte Session | immer im Start-Sheet |
| **Offline** | Blob lokal, Sync bestehend | Blob + Checkin-Store (pending) | lokal | lokal | lokaler Cache maßgeblich (P0-Fix) | „—" statt erfundener Werte |
| **Bestandsnutzer** | alte Haken-Schlüssel bleiben gültig; Defaults unverändert bis Konfiguration | unverändertes Formular + Statuskopf | unverändert | zusätzliche Slots, keine entfernt | Banner neu, kein Doppelweg (todaySummary bleibt aus) | Zusatzanzeige |
| **Rollback-Flag** | `routines` | `eveCheckin` | `nutrition` | `anaTips` | (P0, kein Flag — Datenverlust-Schutz) | `preWorkoutGarmin` |
| **Test** | phase3_reactivation_test | phase3_reactivation_test | phase3_reactivation_test | phase3_reactivation_test | p0_workout_persistence_test | phase3_reactivation_test |

## Block 2 + Sonderfälle

| Feature | Status | Einstieg / Details |
|---|---|---|
| **Wochenreview + Coach Briefing** | **umgesetzt (Block 2)** | Plan → ⚙ → „Wochenreview" (Sheet, `gmOpenWeekReviewSheet`); Daten aus `weeklyReviewHTML()` (kanonischer Wochenvertrag, EINE Berechnung); „Coach Briefing kopieren" = bestehendes `copyAIReview()` (Prompt in Zwischenablage, verlässt das Gerät nicht automatisch). Flag `weekReview`. |
| **Belastungsrisiko + Regenerationsdefizit** | **umgesetzt (Block 2)** | Analyse → Erholung, Slot `recovery-risk`: zwei Karten aus `riskCard()`/`recoveryDebt()` mit Status, Gründen, Empfehlung + sichtbarer Regel-/Datenbasis-Zeile; < 4 Datentage ⇒ ehrlicher Leerzustand. Safety-Gate der Produzenten unangetastet. Flag `recoveryIntel`. |
| **Equipment-Verschleiß** | **umgesetzt (Block 2)** | Profil → Geräte & Daten → „Equipment & Verschleiß" (Sheet, `gmOpenEquipmentSheet`); identische Quelle wie Legacy (`equipmentHTML()`), km-Zähler + Limit-Warnung ab 90 %. Flag `equipment`. |
| **Zyklus** | **umgesetzt (Block 2)** | Profil → Gesundheit → Zeile „Zyklus" (nur weibliches Profil bzw. konfiguriert) → bestehender Editor (`openCycleEditor`). Flag `cycle`. |
| **Baselines** | **umgesetzt (Block 2)** | Profil → Gesundheit → Abschnitt „Baselines (7/28 Tage, read-only)" aus `baselineRows()`; < 4 Datentage ⇒ NA. Flag `baselines`. |
| **Live-/Pre-/Post-Check-in (manuell)** | **zurückgestellt (E-21)** | Verhaltensänderung (schreibt in `buildTrainingDecision`-Eingaben). Zuerst kam die Garmin-basierte Vor-Start-Anzeige — keine Fragen stellen, deren Antwort gemessen vorliegt. Reaktivierung später nur mit Flag + Messplan (Änderungsrate/Richtung/Widersprüche/Override, ≥ 14 Tage). |
| **HR-Zonen** | blockiert | Kein Zonen-Datenpfad (Phase 2.2: Modell vorbereitet, leer). Erst Worker-Zeitachse/Zonenquelle. |

**DoD-Stand (nach Block 2):** 11 von 11 Features entschieden — **10 mit genau
einem Einstieg + Matrix umgesetzt bzw. ersetzt**, 1 bewusst zurückgestellt
(E-21, dokumentiert), HR-Zonen datenblockiert (kein Einstieg, keine Attrappe).
Kein Feature ist über zwei Wege mit unterschiedlichem Zustand erreichbar —
Doppelquellen (Wochenreview, Equipment) wurden auf EINE Funktion extrahiert.
