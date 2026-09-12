# S1 · Profil, Ziele, Leistung — Umsetzungsplan (Schnittplan v14, Schnitt 1)

Stand: 12.09.2026 · Entscheidungen Gian: v14 = Endzustand; Ziel-Sheet ersetzt den Wizard (Wizard hinter „Mehr Optionen"); „% Wochenvolumen" als ehrlicher Leerzustand bis S3.

## 1 · Aktueller Zustand (Befunde vom Produktionskonto, 12.09.)

| # | Befund | Ursache im Code |
|---|---|---|
| F1 | Halbmarathon (Flensburg, 06.09., 21,1 km) gelaufen — Ziel bleibt „aktiv", nichts erkannt; nur manuelles „Erreicht" | Es gibt keinen Abgleich Ziel ↔ Aktivität. Kein `result` am Ziel, kein Status „verfehlt" (`GOAL_STATUSES`: active/paused/achieved/abandoned/archived). |
| F2 | „06.09.26 · noch 0 Wochen" eine Woche nach dem Rennen | `ui.js:10278` `Math.max(0, …)`; Phase `past` aus goal-plan-input wird dort nicht gelesen. |
| F3 | „so weit vom Ziel entfernt" fehlt | `goal-detail` braucht `engine.tPred` (Prognose); die Prognose kennt den Wettkampf nicht (F5). |
| F4 | Zielzeit als „6600 s" (Plan-Kopf `ui.js:4745`, Ziel-Detail `goal-detail.js:49/61`, Editor-Zusammenfassung `profile.js:818/898`) | Kein zentraler Formatierer; Zielliste am 12.09. lokal repariert (`_goalValueLabel`). |
| F5 | Bestzeiten: HM 21,1 km, Rad 20 km, Schwimmen 400 m werden nicht erkannt | `run-bests.js` kennt nur 1/5/10 km und nur Laufen. |
| F6 | Profilstärke „80 % · solide", „Leistungswert" nicht auffindbar, nicht anlegbar | Lücke `performance_reference` öffnet Sektion `body`; der Resolver liest **nur** `profile.performance.personalBests[]/tests[]` (manuell) — nie Aktivitäten. Der reale Wettkampf zählt nicht als Leistungsbeleg. |
| F7 | Verletzungshistorie im Ziel eintragbar, nirgends gelesen | `GOAL_CATEGORY_FIELDS.running.injuryHistory` → `categoryData`, kein Konsument. |
| F8 | „Viele Eingaben ohne Einfluss" | `GOAL_CATEGORY_FIELDS` (running/triathlon/gym/shredded/…) werden nur gespeichert; Konsumenten: keine (Audit in §3, E7). |

Gemeinsamer Kern von F1/F3/F5/F6: **Aktivitäten fließen nicht in Leistungsbelege, Bestzeiten und Zielergebnisse.** Die Screens von v14 (Über/Ziele/Leistung) würden ohne diese Kette Leerzustände zeigen, wo Daten längst vorhanden sind. Deshalb zuerst die Kette, dann die Screens.

## 2 · Zielzustand

- Jede abgeschlossene Aktivität liefert automatisch: Bestzeiten je Sport und Standarddistanz (gemessen, mit Herkunft), einen Leistungsbeleg für den Resolver (Zonen, Prognose, Profilstärke) und — bei Hauptziel mit Datum und Distanz — ein **erkanntes Wettkampfergebnis** mit Urteil (erreicht / verfehlt um Δ), das du mit einem Tipp bestätigst.
- Ziel-Lebenszyklus: `active → achieved | missed` (neu) mit `result {activityId, date, timeSec, deltaSec, verdict}`; nach dem Datum ohne Aktivität: „Rennen war am … — Ergebnis eintragen".
- Zielwerte überall lesbar (`formatGoalValue`), Countdown mit `past`-Zustand.
- Ziel-Sheet zeigt nur Felder mit Wirkung; Verletzungshistorie wird zu einem Link auf „Beschwerden/Einschränkungen" (dort liest sie B-09).
- Profil-Screen nach v14: Tabs Über / Ziele / Leistung; „Ziele verwalten"-Modal entfällt.

## 3 · Reihenfolge, betroffene Dateien, Tests

| Schritt | Inhalt | Dateien | Test |
|---|---|---|---|
| **E5** Zielwert-Format + Countdown | `profileModel.formatGoalValue(goal, value)` (time → h:mm:ss, pace → min/km, sonst Wert+Einheit); Plan-Kopf, Ziel-Detail, Editor, Liste nutzen es; „noch n Wochen" → `past`: „Rennen war vor n Tagen" | profile-model.js, ui.js (4745, 10278), goal-detail.js, profile.js | goal_value_format_test |
| **E1** Bestzeiten je Sport | `run-bests` → sportbewusst: running 1/5/10/21,1/42,2 km; cycling 20/40/90/180 km; swimming 400/750/1500/1900/3800 m; gleiche Fensterlogik (Runden > Streams > Gesamtaktivität), keine Hochrechnung | run-bests.js (+ `measuredBests(activities,{sport})`), ui.js Bestzeiten-Karte, activity.js | run_bests_test (erweitern: k21/k42, cycling, swimming) |
| **E4** Leistungsbelege aus Aktivitäten | Adapter `engine/pb-sync.js`: gemessene Bestzeiten → `profile.performance.personalBests[]` mit `source:'activity'`, `activityId`, Datum; Dedupe je (sport, distanz, activityId); läuft nach Hydration/Import; Resolver bleibt unverändert (Kohorte) → Profilstärke/Zonen/Prognose sehen den Wettkampf | engine/pb-sync.js, auth.js (nach Hydration), activity-sync.js (nach Import), profile-center (Herkunft „aus Aktivität") | pb_sync_test |
| **E2/E3** Wettkampfergebnis + Lebenszyklus | `engine/race-result.js`: `match(goal, activities)` — Datum ±1 Tag, Sport der Zielfamilie, Distanz im Zielfenster (Slack 5 %) → `{activity, timeSec, deltaSec, verdict}`; Status `missed` (Client `GOAL_STATUSES` + Migration 0044: CHECK + Spalte `result jsonb`); Karte „Wettkampf erkannt" im Plan-Kopf und Ziel-Detail mit Bestätigen; ohne Aktivität nach dem Datum: Aufforderung | engine/race-result.js, profile-model.js, repos/goalRepository.js, supabase/migrations/0044, ui.js Plan-Kopf, goal-detail.js | race_result_test, goal_lifecycle_test |
| **E6/E7** Feld-Audit Ziel | Tabelle Feld → Konsument; Felder ohne Konsument raus aus dem Sheet (bleiben im Datenmodell, keine Migration); `injuryHistory` → Link Beschwerden | profile-model.js (Schema-Flag `effective`), Sheet | goal_fields_audit_test |
| **S1-UI** Profil-Screen v14 | `js/screens/profile-v14.js`: Tabs Über (Sportarten, Saison, Zielreise, Kennzahlen), Ziele (Aktiv/Erreicht/Konflikte, Karten mit Prognose, Wettkampfergebnis, Leerzustand Zielanteil), Leistung (VO₂max/Fitness/ACWR, Bestzeiten je Sport mit Herkunft, Kraftwerte, HFmax/Ruhepuls/Schwellenpace mit Quelle); Sheets Neues Ziel / Ziel bearbeiten (mit Auswirkungszeile aus `planKey`-Vergleich), „Mehr Optionen" → Wizard | screens/profile-v14.js, styles.css (`.pf2-*`, `.gs-*`), index.html, sw.js, profile-center.js (Weiche), profile.js (Modal entfernt) | profile_v14_test (Mini-DOM je Tab + Zustände), Paritätstest gegen v14-Struktur |

## 4 · Risiken

- E4 schreibt ins Profil (Bestzeiten) — deshalb Dedupe über `activityId` und Herkunft `activity`; manuelle Einträge werden nie überschrieben. Löschung/Tombstone einer Aktivität entfernt ihren Eintrag.
- E2 Fehlzuordnung (Trainingslauf am Renntag): Distanzfenster + Bestätigung durch dich; ohne Bestätigung ändert sich kein Status.
- Migration 0044 erweitert nur CHECK + eine jsonb-Spalte; Bestand unberührt.
- Plan-Kopf/Ziel-Detail sind in `gm2_plan_parity`, `goal_detail_test`, `goal_editor_g0` verankert — werden mitgezogen.

## 5 · Definition of Done (S1)

1. Dein Flensburg-HM erscheint als Wettkampfergebnis mit Zeit, Δ zur Zielzeit und Urteil; ein Tipp setzt das Ziel auf erreicht/verfehlt.
2. Bestzeiten HM, Rad 20 km, Schwimmen 400 m stehen mit Datum und Herkunft im Leistungs-Tab.
3. Profilstärke meldet keine fehlende Leistungsreferenz mehr, solange ein gemessener Wettkampf/Test der letzten 12 Wochen existiert.
4. Kein Zielwert mehr in Sekunden; kein „noch 0 Wochen" nach dem Datum.
5. Ziel-Sheet zeigt nur wirksame Felder; Verletzungshistorie ist ein Link.
6. Profil-Screen = v14-Struktur (Über/Ziele/Leistung), Modal „Ziele verwalten" entfernt; Suite grün; Deploy; Sichtprüfung.
