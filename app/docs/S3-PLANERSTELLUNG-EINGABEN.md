# S3 · Planerstellung — was ORVIA fragen soll (Runna-Abgleich)

Stand 24.09.2026 · Grundlage: Gians Runna-Screenshots (Eingaben beim Anlegen
eines neuen Plans: Verletzungshistorie, Trainingsumfang/Schwierigkeit,
Wochenkilometer, längster Lauf) gegen den Code-Ist-Stand von ORVIA v8-395.

## Kernergebnis

ORVIA **fragt bereits mehr als Runna** — das Problem ist nicht die Abfrage,
sondern dass ein Teil der Antworten **nie gelesen** wird und dass der
Leistungsstand in **drei Vokabularen** existiert. Konkret gefunden und in
v8-396 behoben: ein Einsteiger aus dem Onboarding v2 bekam ohne Lauf-Historie
den Mittelwert-Seed (12 km/Woche, 5 km Long Run, 3 Läufe) statt des
Einsteiger-Seeds (6/3/2) — doppelter Startumfang für genau die Gruppe mit dem
höchsten Überlastungsrisiko. Für dich selbst irrelevant (du hast Garmin-
Historie, die Seeds greifen nur unter 3 echten Läufen in 28 Tagen).

Leitregel für S3, aus dem Runna-Abgleich abgeleitet:

> **Frage nur, was nicht messbar ist. Was messbar ist, wird gemessen —
> die Selbstauskunft ist nur der Seed und verliert gegen die Messung.**

## Ausgangslage — was ORVIA heute erhebt und was davon ankommt

| Eingabe (Runna) | ORVIA fragt es? | Wo | Liest die Engine es? | Messbar aus Garmin/Store? |
|---|---|---|---|---|
| Verletzungshistorie | ja | `constraintsList` (Beschwerden, S1/E6), Onboarding & Profil | **ja** — decision-engine-v2, return-ladder, absence-replanner, training-input-resolver | nein (bleibt Frage) |
| Umfang / Schwierigkeit (Level) | ja | Onboarding v2 `sports[primary].level`; Legacy `PROFILE.level`; Sport-Kit-Schema `level` | **teilweise** — plan-engine-v2, goal-feasibility, performance-zones normalisieren; `calc.calculateRecommendedWeeklyRunVolume` las bis v8-395 nur das Legacy-Vokabular | indirekt (Historie), aber Erfahrung ≠ aktueller Umfang → bleibt Frage |
| Wochenkilometer | ja, **doppelt** | Kit-Schema `weeklyKm` + `desiredWeeklyKm`; Legacy `typicalRunKm` × `recentRunsPerWeek` | `weeklyKm`/`desiredWeeklyKm`: **nein, tot**. `typicalRunKm`: ja, als Seed unter 3 Läufen/28 Tage (`ui.recommendedRunVolume`) | **ja** — `runsWindow(28)`, capacity-adapter (`weeklyDistanceKm`), running-capacity-factory |
| Längster Lauf | ja, **doppelt** | Kit-Schema `longestRun`; Legacy `longestRunKm` | `longestRun` (Kit): **nein, tot**. `longestRunKm`: Seed | **ja** — `_longestRunKm(28)` distanzbasiert, Session-genau |
| Trainingstage / Zeit | ja | Onboarding `availability` (Tage, Einzel-/Doppeleinheit, feste Termine, Ruhetage, Tagesdeckel) | **ja** — scheduler-input-factory, week-plan-designer | teilweise (Muster aus Historie), Präferenz bleibt Frage |
| Ziel + Datum + Zielzeit | ja | kanonisches Hauptziel (`mainGoalOf`), goal-plan-input | ja | nein |

## Befunde

**B1 · Leistungsstand: drei Vokabulare, ein stiller Fehlpfad (behoben v8-396).**
`profile-model.LEVEL_ALIASES` ist kanonisch (beginner/intermediate/advanced/
competitive). `calc.calculateRecommendedWeeklyRunVolume` prüfte `p.level ===
'anfaenger'|'wiedereinstieg'` bzw. `'profi'|'leistung'` und kannte weder die
v2-Schreibweise noch `sports[primary].level`. Gemessen vor dem Fix:
`{sports:[{role:'primary',level:'beginner'}]}` → 12/5/3 statt 6/3/2.
Fix: `calc.runLevelOf()` mit byte-gleicher Alias-Tabelle (Paritätstest
`run_volume_level_test.mjs`, Abschnitt B), Hauptsportart vor `p.level`,
Unbekanntes → Mittelwert, nie Wettkampf.

**B2 · Tote Eingaben.** `weeklyKm`, `desiredWeeklyKm`, `longestRun` aus dem
Sport-Kit-Schema (`profile-model.js:1061`) werden von keinem Engine-Modul
gelesen. Der Nutzer beantwortet Fragen ohne Wirkung — das ist schlimmer als
nicht fragen, weil es Einfluss vortäuscht. Parallel existiert der Legacy-Satz
`typicalRunKm`/`recentRunsPerWeek`/`longestRunKm`, der als Seed tatsächlich
wirkt. Zwei Feldsätze für dieselbe Größe = Drift vorprogrammiert.

**B3 · Renn-Long-Run ignoriert den Athleten.** `ui.lrKm(wk)` nutzt bei
Lauf-Distanzziel mit Renndatum eine feste Progression (`max(7, min(20, wk−2))`,
Taper 12/10/8) — ohne Leistungsstand, ohne gemessenen längsten Lauf, ohne
Historie. Ein Einsteiger in Woche 3 bekommt 7 km Long Run, egal ob sein
längster Lauf 3 km war. Das ist die Runna-Form ohne Runna-Eingaben. Der
Nicht-Renn-Pfad (`recommendedRunVolume`) ist hier ehrlicher als der Renn-Pfad.

**B4 · Verletzungshistorie ist gut gelöst.** `constraintsList` ist die eine
Quelle, wird normalisiert, hat aktive/inaktive Sicht und vier Engine-Konsumenten.
Runna fragt „hattest du in den letzten 6 Monaten eine Verletzung" als Ja/Nein
— ORVIA hat Region, Schwere, Zeitraum. Hier nichts nachbauen.

**B5 · Was Runna fragt und ORVIA nicht braucht.** Wochenkilometer und
längster Lauf sind bei Garmin-Nutzern **gemessen** (28-Tage-Fenster,
distanzbasiert, dedupliziert). Runna muss fragen, weil es beim Anlegen keine
Daten hat. ORVIA darf hier nur fragen, wenn `runsWindow(28)` < 3 Läufe liefert
— und muss die Antwort dann sichtbar als Selbstauskunft mit niedriger
Konfidenz führen, die mit dem ersten gemessenen Block verdrängt wird.

## Empfehlung: Eingaben beim Anlegen eines Plans (S3)

Reihenfolge = Priorität. Jede Frage nur, wenn die Antwort nicht schon im
Profil oder in den Daten liegt (Regel E-21 aus Phase 3: keine Frage, deren
Antwort gemessen vorliegt).

1. **Ziel** — Distanz/Art, Datum, Zielzeit optional. (vorhanden, kanonisch)
2. **Verfügbarkeit** — Tage, typische Dauer, harte Ruhetage. (vorhanden)
3. **Beschwerden/Einschränkungen** — aus `constraintsList`; beim Plan-Anlegen
   nur noch „gilt das noch?" für aktive Einträge, keine Neuerhebung. (vorhanden)
4. **Leistungsstand** — kanonisch, ein Vokabular, eine Frage. (vorhanden; B1)
5. **Risikopräferenz** — konservativ/ausgewogen/ambitioniert. Wirkt heute
   bereits als Faktor 0,9/1,0/1,1 in `calc` (`riskTolerance`), wird aber nur
   im Legacy-Wizard und im Profil-Editor abgefragt, **nicht im Onboarding v2**
   — ein neuer Nutzer sieht die Frage nie. Das ist die eigentliche
   Runna-„Schwierigkeit".
6. **Umfang-Seed nur bei Datenlücke** — wenn < 3 Läufe in 28 Tagen: typische
   Distanz, Läufe/Woche, längster Lauf (Legacy-Feldsatz behalten, Kit-Felder
   entfernen). Kennzeichnung „Selbstauskunft", Konfidenz niedrig.

Nicht fragen: Wochenkilometer und längster Lauf bei vorhandener Historie;
Alter/Gewicht/HFmax (Profil bzw. Garmin); RHR/HRV/Schlaf (Morgenbericht).

## Priorisierte Umsetzung

| P | Maßnahme | Aufwand | Risiko | Status |
|---|---|---|---|---|
| P0 | Level-Normalisierung in `calc` (B1) | klein | gering, nur Seeds ohne Historie, Richtung konservativ | **v8-396** |
| P1 | Ein Leser `Calc.runSeedHistory` (Kit vor Legacy), Seed-Ergebnis als Selbstauskunft gekennzeichnet (`basis`), `desiredWeeklyKm` entfernt (B2) | klein | keine Migration: Kit-Felder bleiben, Legacy-Felder bleiben als Rückfall | **v8-400** |
| P2 | `lrKm` Renn-Pfad: Startpunkt aus gemessenem längsten Lauf und Level, Progression ≤ +10 %/Woche, statt fester Tabelle (B3) | mittel | ändert Long-Run-Vorgaben aktiver Rennpläne → Umsetzungsplan + Shadow-Vergleich nötig | offen, braucht dein OK |
| P3 | Risikopräferenz ins Onboarding v2 / Plan-Anlegen holen (5.) | klein | gering | offen |
| P4 | Plan-Anlegen-Dialog als eigener Flow (1.–6.) statt verstreut über Profil/Onboarding | mittel–groß | UI-Umbau, i18n | S3-Umsetzungsplan |

## Offene Unsicherheiten

- Die Runna-Screenshots liegen mir nicht mehr vor; ich habe die vier
  genannten Eingaben verwendet. Falls Runna weitere Felder zeigt (z. B.
  bevorzugter Long-Run-Tag, Tempo-Präferenz), bitte nachreichen.
- B3 ist ein Befund, kein Fix: die feste Progression stammt vermutlich aus
  einer bewussten Vereinfachung. Ob sie durch eine datengetriebene ersetzt
  wird, ist eine Produktentscheidung (P2).
