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

## 6 · Stand 12.09. abends — E5/E1/E4/E2/E6/E7 umgesetzt (`808efbb` ff.)

| Schritt | Ergebnis |
|---|---|
| E5 | `formatGoalValue` zentral; Plan-Kopf/Ziel-Detail/Editor/Liste zeigen h:mm:ss; Countdown „vor n Tagen" nach dem Datum |
| E1 | Bestzeiten je Sport (Laufen bis Marathon, Rad 20–180 km, Schwimmen 400–3800 m); Profil-Bestzeiten füllen 21,1 km / 400 m / 20 km; gemessener HM schlägt Riegel |
| E4 | `pb-sync`: Aktivitäten → `personalBests` (source `activity`) → Resolver wertet den Wettkampf als race-Beleg → Profilstärke-Lücke „Leistungsreferenz" schließt sich, sobald ein Wettkampf/Test der letzten Wochen existiert |
| E2/E3 | `race-result`: Wettkampf erkannt → Übernehmen / Nicht mein Rennen; nach dem Datum ohne Treffer: Erreicht / Verfehlt / Neu terminieren; Status `missed`; **Migration 0044 vor Deploy** |
| E6 | Verletzungshistorie am Ziel → Link auf Beschwerden & Einschränkungen (dort liest B-09) |
| E7 | **Feld-Audit:** 77 Felder in `GOAL_CATEGORY_FIELDS` (shredded 15, triathlon 13, football 11, running 9, strength 9, cycling 10, swimming 10) — **kein** Engine-/Planer-Modul liest `categoryData` (Probe `goal_fields_audit`). Der Wizard sagt das jetzt im Schritt „Konkretisieren"; das v14-Ziel-Sheet (S1-UI) enthält diese Felder nicht. Was den Plan steuert: Zielart, Zielwert, Datum, Priorität + Profil (Verfügbarkeit, Leistungswerte, Beschwerden). |

**Offen in S1:** S1-UI (Profil-Screen v14 mit Tabs Über/Ziele/Leistung, Ziel-Sheets, Modal entfernen). Nach Deploy prüfen (DoD 1–4) am Produktionskonto: Flensburg-HM als „Wettkampf erkannt" im Plan-Kopf, Bestzeiten 21,1 km / 400 m / 20 km, Profilstärke ohne „Leistungsreferenz"-Lücke.

## 7 · S1-UI gebaut (13.09., Build v8-371)

`js/screens/profile-v14.js` (`ORVIA.screens.profileV14`): Kopf aus ui.js (`gmProfHeaderHTML`), darunter Profilstärke-Karte (v14 `ps-card` mit Ring und bis zu drei Lücken, Tipp öffnet Sektion/Editor), Reiter **Übersicht / Ziele / Leistung** (Reiter im localStorage gemerkt), Community erst mit S7.

- **Übersicht:** Sportarten mit Rolle · Saison (Phasen aus dem Zieldatum, aktive Phase, km diese Woche, Einheiten/Woche Ø 4 Wo, ACWR, Quelle) · Zielreise (bis 3 aktive Ziele; Prognose nur für das Hauptziel) · Profil & Kontrolle.
- **Ziele:** Kennzahlen Aktiv/Erreicht/Konflikte · aktive Ziele mit Pill (Im Korridor / Knapp / Konflikt), Wettkampf erkannt/Ergebnis, Zielanteil als Leerzustand · Pausiert · Zielkonflikte mit den vier Entscheidungen · Erreicht & verfehlt mit Datum/Zeit/Δ · „Alle Ziele verwalten" (Modal bleibt als Verwaltungsansicht).
- **Leistung:** VO₂max (Quelle) / Fitness CTL / ACWR · Bestzeiten Laufen 5/10/HM/M (gemessen/geschätzt + Datum) · Rad & Schwimmen (nur wenn Messung) · Kraftwerte (Kniebeuge/Kreuzheben/Bankdrücken 1RM, Klimmzüge max.; fehlende benannt) · Zonen & Schwellen (HFmax mit Herkunft, Ruhepuls, Schwellenpace aus Referenz) · Medaillen/Meilensteine/Pace-Rechner.
- **Ziel-Sheet** (Neues Ziel / Ziel bearbeiten): Kategorie-Chips → Ziel-Chips → Titel → Zielzeit bzw. Zielwert → Datum → Priorität mit Erklärung; „Auswirkung dieser Änderung" über `planKey`-Vergleich; „Mehr Optionen" öffnet den Wizard. Speichert über `goalAdd`/`goalUpdate`.
- Rückfall: ohne geladenes Modul rendert `renderGMProfile` den v5-Aufbau (gm5-Vertrag bleibt für den Rückfall).
- Tests: `profile_v14_test` (30), i18n_guard führt das Modul (0 Literale, 130 Keys `pv.*`).

**Sichtprüfung offen (Gian):** Profil-Tab öffnen → drei Reiter, Profilstärke-Karte, Zielreise; Ziele-Tab → HM unter „Erreicht & verfehlt" mit Zeit; Leistung-Tab → Bestzeiten, Kraftwerte, Zonen; „Neues Ziel" → Sheet.

## 8 · Sichtprüfung v8-371 (13.09., Gian: „ganz schwach noch") → Korrekturpaket S1b

Befund aus den Screenshots (Ursache jeweils belegt):

| Symptom | Ursache | Fix |
|---|---|---|
| Profil & Kontrolle, Zonen, Medaillen-Links, Erreicht/Verfehlt als unformatierter Textblock | `.prow/.p-ic/.p-b/.p-t/.p-d/.p-v` aus Prototyp v14 nie nach `styles.css` übernommen | Regeln portiert (S1b-Block am Ende von styles.css) |
| KPI-Beschriftungen zerhackt („AK-TIV", „VO ₂M AX", „A C W R") | altes Dashboard-`.kpi{display:grid;1fr 1fr 1fr}` traf die v14-Kacheln; dazu `hyphens:auto` | `.kpi-row>.kpi{display:block}` + Trennung aus |
| Profilstärke ohne Ring, Prozent als dunkler Kasten | Prozent-Element hieß `.pv` — globaler Kartenstil `.pv{background;border;padding}` | Klasse `.ps-pct` |
| Sportarten-Chips abgeschnitten („Krafttraini…") | horizontaler Scroll wie im Prototyp, am Desktop unsichtbar | Chips umbrechen |
| „400 m Schwimmen" überlappt „gemessen" | `.pv-btd` 64 px, Sportart im selben `<b>` | Distanz fett + Sportart als kleine Zeile, 78 px |
| Ziel „12%" als Titel, „Kein Zielwert" | Titel bestand nur aus dem Wert; `targetValue` als String gespeichert | `goalTitle()` (Wert-Titel → Kategorie), `numLoose()` |
| Leere Fortschrittsleiste bei jedem Ziel | 0 %-Balken bei fehlender Prognose | ohne `pct` gedämpfte Leiste (`goal-line none`) |
| „Zielanteil …"-Hinweis 4× | je Karte gerendert | einmal unter der Liste |
| Saison „Aufbau · noch 357 Tage" | Countdown zum Wettkampf am Phasennamen | „Aufbau · Wettkampf in 357 Tagen", Phasen „bis dd.mm.yyyy" |
| „1 Einheiten / Woche (Ø 4 Wo)" | Heuristik über `listActivitiesUnified` + `startedAt`; Legacy-Aktivitäten ohne dieses Feld fielen raus | Ø aus `weeklyActivityTotals` (gleicher Vertrag wie km/Woche), Heuristik nur als Rückfall |
| Kraftwerte alle „—" trotz Gym-Training | nur manuelle `strengthRecords` gelesen | e1RM (Epley, ganze kg) aus abgeschlossenen Arbeitssätzen 1–12 Wdh. der Gym-Snapshots; Klimmzüge = max. Wdh. ohne Zusatzgewicht; Quelle je Kachel |
| VO₂max-Quelle „automatic" | Enum unübersetzt | `srcLabel`: automatic → „automatisch", garmin_unofficial → Garmin |
| Kopf „Zielaufbau —" | dauerhaft leerer Slot | vierter Slot = aktive Ziele (`listGoals`) |

Nicht geändert (bewusst): HM-Ergebnis 2:22:12 (ganze Aktivität, 21,3 km) vs. Bestzeit 2:20:13 (schnellste 21,1 km innerhalb) — beides korrekt, zwei verschiedene Größen. „0 km diese Woche" / ACWR 0,36 sind echte Werte der Woche nach dem Wettkampf.

Verifikation: `profile_v14_test` 39 (neu G1–G8), Vorschau der drei Reiter mit Prototyp-nahen Daten per Playwright gerendert (Cloud) — Layout stimmt jetzt mit v14 überein. Offen bleibt S2 (Kraftprofil) für die Pflege der Kraftwerte im Editor.
