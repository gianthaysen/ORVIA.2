# ORVIA MASTER-MATRIX v8-183 — FINALER PRODUKTINVENTAR-STAND

Status: **ABGENOMMEN (Gian, 2026-07-11).** Basis: 4 read-only Code-Audits (UI/Navigation/Training/Branding · Datenmodell · Aktivitäten/Datenquellen/Analysen · Backend/Engine/Qualität), konsolidiert.
Status-Vokabular: VOLLSTÄNDIG · TEILWEISE · FEHLT · FRAGIL · LEGACY · DOPPELT · TOT · NICHT VERIFIZIERT. Evidence = file:line im Repo `app/`.

---

## 1. Executive Verdict

**Gesamt-Reifegrad: fortgeschrittene Private-Alpha.** Datenfundament ~70 %, Produktflächen ~40 %, Engine ~35 % des Zielbilds. Betreibbar für 2 reale Nutzer, nicht beta-fähig (Safety-Erfassung, Recht, Export, Provider fehlen).

| Bereich | Reifegrad |
|---|---|
| Profil-/Datenmodell + Cloud-Zyklen | solide |
| Readiness/Baselines/Confidence | stark |
| Check-ins | brauchbar (Felder unvollständig) |
| Beschwerden/Safety | rudimentär (Red Flags nicht erfassbar) |
| Trainingsseite/Live-Tracking | brauchbar (mit Datenbug) |
| Aktivitäten kanonisch | solide (Detailseite rudimentär) |
| Analysen/Insights | brauchbar, aber auf falscher Datenquelle |
| Plan/Engine | v1 brauchbar, v2 Skelett im Shadow |
| Provider/Garmin | fehlt (0 Codezeilen) |
| Backend/Konto | solide (UX rudimentär, Live-E2E offen) |
| Recht/Export/Error-Tracking | fehlt |

- Größte Stärke: Baseline-/Confidence-System (readiness-source.js:15–90) + 4 Sektions-Cloud-Zyklen mit K1/K2/K3.
- Größter Datenfehler: Live-Fremdsport → „Gym"-Spiegelung (workout-ui.js:644–646); Analysen rechnen auf genau diesem Legacy-Blob.
- Größte Safety-Lücke: Red-Flag-Felder gelesen (ui.js:599–600), nie erfasst.
- Größter UX-Vertrauensbruch: „v6.0"-Anzeige (index.html:372), prompt()-Kontoflows (auth.js:654–706), persönliches Supplement-Lexikon (supplements.js:16–45).
- Größtes Sync-Risiko: Gewichtshistorie/Wochenplan/Equipment/Routinen nur im app_state-LWW-Blob (sync.js:13–36).
- Größter Beta-Blocker: Rechtstexte-Platzhalter (orvia-pro.js:243) + unvollständiger Export (data.js:96) + kein Error-Tracking — DSGVO-Risiko besteht JETZT (echte Zweitnutzerin).
- Engine-Reifegrad: v1 = laufzentrierte Tagesentscheidung, Prioritätsordnung korrekt, ohne Verfügbarkeits-Eingang; Generator ohne Periodisierung/Zeitbudget; v2 = Shadow-Skelett. „Engine zuletzt" ist korrekt.
- Provider: keine Fundstelle; oauth_tokens/data_sources/imports Schema-Leichen; Records ohne Provider-Metadaten (0009).

Zusatzverifikation: renderDecision leert für HEUTE readyOut+ampelOut (ui.js:750); renderAmpel/renderReadiness nur Vergangenheit (ui.js:786, P3-Design) → heute existiert genau EINE sichtbare Entscheidung; ampel()-Dopplung betrifft nur ui.js:350, 1787, 2275 + insights.js:23.

## 2. Top 25 Findings

1. `[HOCH] — SAFETY` — Red-Flag-Erfassung existiert nicht: Decision liest fever/swelling/instability/chestPain, kein UI/Store schreibt sie — ui.js:599–600; calc.js:782–806 — Safety-Gate wirkt nur über Krankheit+Schmerz — Erfassung als dynamische Check-in-Fragen (R2).
2. `[HOCH] — DATENINTEGRITÄT` — Live-Sport außerhalb der 5 Legacy-Typen wird als „Gym" gespeichert — workout-ui.js:644–646; ui.js:10 — verfälscht Tagesspeicher/Insights/Planerfüllung — kanonische sportId durch den gesamten Fluss (R1).
3. `[HOCH] — MODELLBRUCH` — Alle Analysen lesen DB[date].sessions (Legacy-Blob), kanonische Activities fließen nicht ein — charts.js:13–61; ui.js:2158–2356; insights.js; nutrition.js:32–41 — Analyse-Layer auf activity-store (R7).
4. `[HOCH] — SYNC` — Gewichtshistorie, weekPlan, Equipment, Routinen, Ernährung nur app_state-LWW — sync.js:13–36; 0002:89–112 — Cloud-Pfade ergänzen (R4).
5. `[HOCH] — RECHT` — Impressum/Datenschutz Platzhalter bei öffentlichem Deploy — orvia-pro.js:243 — echte Texte (Gian: Betreiberangaben) (R18).
6. `[HOCH] — RECHT` — Export nur lokaler DB-Blob; PROFILE + Cloud-Tabellen fehlen — data.js:96 — Vollexport (R4).
7. `[HOCH] — DOPPLUNG` — Sport-Namespace dreigeteilt (16/24/26) + 2 Alias-Tabellen; normSport kollabiert 8 Sportarten auf 'other' — training-domain.js:13; onboarding-sports-logic.js:51–88; activity-config.js:22–51,80–89 — EIN Katalog in training-domain (R6).
8. `[HOCH] — TOT` — Bodymap erhält immer `{}` + Klick-Key-Mismatch — ui.js:1190,1133–1136 — anbinden oder reduzieren (R12).
9. `[HOCH] — UX` — Konto-Kernflows über prompt()/alert(); confirm in story.js — auth.js:654–706; story.js:14 — Sheet-System (R3).
10. `[HOCH] — PROVIDER` — Garmin/Strava/Apple: 0 Code; keine Provider-Metadaten am Record — profile.js:1433; 0009; schema.sql:331 — Metadaten-Migration vor Connector; Garmin-Antrag (Gian) (R10).
11. `[MITTEL] — DOPPLUNG` — ampel() weiter aktiv in ui.js:350,1787,2275 + insights.js:23 (heute-Pfad sauber, ui.js:750/786) — Konsumenten auf decisionState/Historie-API (R1).
12. `[MITTEL] — DOPPLUNG` — Calc.loadModel ohne UI-Konsument; drawForm + ACWR-Karte rechnen parallel — calc.js:70–86; charts.js:44–61; ui.js:2201 — loadModel als SSoT (R1).
13. `[MITTEL] — MODELLBRUCH` — Ziel-ID-Namespace dual (half_marathon vs. halfmarathon) — profile-model.js:20,37; ui.js:45,60 — kanonisieren mit Lese-Normalisierung (R1).
14. `[MITTEL] — TOT/UX` — „Alle Sportarten" tot; Live-Start generisch — workout-ui.js:161–162,318–330 — Katalog-Picker (R6).
15. `[MITTEL] — UI` — Icon-Vergabe dreifach; Hub-EKG-Fallback trotz vorhandener Symbole; triathlon/athletics ohne Sprite — workout-ui.js:147–148; onboarding-ui.js:977; index.html:58–59 — eine Registry (R6).
16. `[MITTEL] — LEGACY` — Personenbezogene Inhalte generalisiert (Supplement-Lexikon, „deiner Patella-Reizung", Squat-Badges, Knie-Heuristiken) — supplements.js:16–45; ui.js:2208,2224; insights.js:27,44 — neutralisieren (R3).
17. `[MITTEL] — FEHLT` — Availability-Details ohne Wirkung; availability kein Decision-Eingang — profile-model.js:1049–1055; ui.js:107–151; calc.js:925ff — Konsumenten in Engine-Paketen.
18. `[MITTEL] — FEHLT` — Preferences ohne Konsument + trainingPrefs-Dopplung — profile-model.js:466–488; profile.js:809–814 — Konsumenten + Legacy stilllegen (R5).
19. `[MITTEL] — MODELLBRUCH` — Beschwerde-Region-Namespaces; fehlende Bereiche (Achilles/Leiste/Hamstring/Wade); constraintsList nur Shadow — issues.js:12–78,161–183; profile-model.js:442; shadow-runner.js:97 — R2.
20. `[MITTEL] — ENGINE` — Generator ohne Periodisierung/Zeitbudget/Doppeleinheiten; sessionsPerWeek ignoriert; weekPlan nur Blob — ui.js:46–151; 0003:133 — R15.
21. `[MITTEL] — FEHLT` — Kein currentValue-Update; Prognose nur Lauf-Riegel; FTP-Kategorie tot — ui.js:2182–2197; profile-model.js:40 — R9.
22. `[MITTEL] — UX` — Nutzermodi fast kosmetisch; isPro() liest nur PROFILE.level, Default true — styles.css:1648; ui.js:305–317; workout-ui.js:29 — R1 (isPro) + R5.
23. `[MITTEL] — SYNC` — Queue ohne Backoff/failed-UI; Badge nur Blob; Activity-Fetch limit 200 ohne Cursor — offline-queue.js:93–178; sync.js:56–64; activity.js:271–284 — R4.
24. `[MITTEL] — FEHLT` — Error-Tracking 0; Consent nur localStorage — orvia-pro.js:166–200 — R4/R18.
25. `[NIEDRIG] — LEGACY` — „v6.0", HM-Pace-Karte, PHASES-Konstante, story-Demo, Emoji-Flächen, onboarding-steps.js veraltet, Legacy openOnboarding, Schema-Leichen — index.html:372,198–199; ui.js:177–181; story.js:8–14,149; profile.js:321 — R3.

## 3. Master-Matrix (30 Bereiche) — Kurzform

Vollständige Bereichs-Tabellen: siehe Abnahme-Bericht 2026-07-11 (Chat). Kernstatus je Bereich:

| # | Bereich | Kernstatus |
|---|---|---|
| 1 | Positionierung | TEILWEISE — laufzentriert; Insights-Überladung (15 Karten, index.html:223–246) |
| 2 | Branding | Tokens/Logo/Splash ✓; v6.0 LEGACY; PWA-Hilfe FEHLT; Emoji TEILWEISE; prompt() FRAGIL; Bilder FEHLT |
| 3 | Navigation | ✓; aktiv=weiß statt gold (styles.css:80); Verlauf nur via Insights |
| 4 | Trainingsseite | Kacheln dynamisch ✓; „Alle Sportarten" TOT; Notiz/Schmerz/Equipment im Workout FEHLT; GPS FEHLT; Gym-Logger ✓; Fremdsport-Spiegelung FRAGIL |
| 5 | Quick Add | ✓; Cloud-Sync FEHLT; Soll-Tagesaktionen TEILWEISE (Schlaf/HRV/Wasser/Notiz… fehlen) |
| 6 | Onboarding | v2 ✓; Sportdynamik TEILWEISE (sport_profile inactive); Steps-Metadaten DOPPELT; Consent/PWA FEHLT |
| 7 | Profil | Sektionen/Editoren/Completion ✓; Einheiten FEHLT; Zeitzone TEILWEISE; RHR/HFmax 3 Welten DOPPELT |
| 8 | Availability | Modell+Editor+Cloud ✓; harte Ruhetage im Plan ✓ (profile-model.js:1357–1366; ui.js:107–151); Details 'prepared' FEHLT (Wirkung) |
| 9 | Preferences | 12 Felder ✓ (Modell) / TOT (Wirkung); trainingPrefs DOPPELT; Wettkampf/Detailtiefe FEHLT |
| 10 | Ziele | ~50 Typen+Wizard+Cloud ✓; ID-Namespace DOPPELT; FTP TOT; Fortschritt/Prognose/Wahrscheinlichkeit FEHLT |
| 11 | Check-ins | 5 Typen Cloud ✓; morning ohne Energie/Motivation; pre ohne Bereitschaft; post ohne RPE-Soll; evening ohne Fazit; Krankheits-Follow-ups FEHLT |
| 12 | Beschwerden/Safety | Red-Flags FEHLT (Kernlücke); Regionen TEILWEISE+DOPPELT; Seite/Differenzierung FEHLT; Lifecycle TEILWEISE; constraints→Decision nur Shadow |
| 13 | Recovery | Erfassung+Cloud ✓; Baselines stark ✓; Gewichtshistorie FRAGIL (Blob); VO2max prepared |
| 14 | Aktivitäten | Modell+Cloud+Outbox ✓; Detailseite TEILWEISE (rudimentär); Briefing/Debriefing FEHLT; GPX-Samples verworfen; FIT abgelehnt |
| 15 | Verlauf | Liste+Dedupe ✓; Filter/Mini-Map FEHLT; Workout-Verlauf offline FEHLT |
| 16 | Equipment | Basis+km ✓; Katalog-Lücken (Tennis/Padel/TT/Brustgurt); Cloud FEHLT |
| 17 | Datenquellen | Devices-Editor ✓ ehrlich; Provider FEHLT komplett; Dedupe zweigleisig |
| 18 | Insights | 3 Systeme DOPPELT; Analysen ✓ aber Legacy-Blob; Monat/Plateau/Wahrscheinlichkeit FEHLT |
| 19 | Gym/Bodymap | Logging+Volumen+Confidence ✓ stark; Bodymap TOT ({}); eigene Übungen TOT (kein UI); PRs/Progression FEHLT |
| 20 | Ernährung | Makros+ehrliche Zustände ✓; Fueling nur Texte; Supplements LEGACY (Personen-Lexikon) |
| 21 | Wissensbereich | FEHLT komplett |
| 22 | Backend/Konto | Flows ✓ (Code); RLS ✓ (KNOWN_ISSUES #3 widerlegt — schema.sql:399–413); Export TEILWEISE; Consent lokal; Error-Tracking FEHLT |
| 23 | Recht | FEHLT (Platzhalter); Medical-Disclaimer ✓ |
| 24 | Offline/PWA | Queue ✓; Retry FRAGIL; Merge v8-183 ✓; SW ✓ |
| 25 | Datenaufbereitung | loadModel/Baselines/Schlafschuld ✓ berechnet; loadModel UI-tot; Belastungsreaktion/Trend-API FEHLT |
| 26 | Sportmodelle | 6 Cluster per Ziel-Regex (calc.js:763–771); Energiesysteme/Saison FEHLT |
| 27 | Positionen | Modell ✓; Wirkung FEHLT („später", profile.js:980) |
| 28 | Plan | Ruhetage+Kappung ✓; Periodisierung/Budget/Cloud FEHLT |
| 29 | Engine | v1 ✓ (Nische); v2 Shadow-Skelett; Gate offen |
| 30 | Tests | ~105 Suiten, Live getrennt; ungetestet: nutrition/insights/intelligence/charts/story/race/extras/orvia-pro/supplements/CSV; keine v1↔v2-Diff-Tests |

## 4. Kanonische Datenmodell-Matrix

| Sachverhalt | kanonisch | Legacy/zweite Wahrheit | Cloud | Risiko |
|---|---|---|---|---|
| Sportarten | PROFILE.sports[] (sportId) | dt. TYPES (ui.js:10) + 65 Logik-Treffer; 3 Kataloge | user_sports | Fremdsport→Gym; normSport-Kollaps |
| Level | sports[primary].kit.level | PROFILE.level (ui.js:305; workout-ui.js:29) | user_sports | isPro-Default true |
| Ziele | PROFILE.goals[] (goalOf) | PROFILE.goal-Mirror; Legacy-IDs ui.js:45,60 | user_goals | ID-Dualität |
| Zielzeit | goal.targetValue (s) | hmTargetMin↔DB._hmTargetMin (profile.js:376; ui.js:1946,2082) | user_goals | Spiegel-Drift |
| Availability/RestDays | PROFILE.availability | trainingDays-Fallback | weekly_availability | Details wirkungslos; Decision liest sie nicht |
| Feste Termine | fixedCommitments | fixedEvents (eigener Decision-Pfad) | fixed_schedule_items | zwei Begriffe |
| Gewicht | performance.weightHistory | user_profiles.weight_kg (nur aktuell) | **nur Blob (Historie)** | LWW-Verlust |
| HFmax/Ruhepuls | performance.body | flach + performance.* (3 Welten) | user_profiles + readiness_baselines | Drift |
| Recovery/Check-ins | daily_checkins PRIMÄR | Blob-Mirror (dokumentiert) | ✓ | Charts lesen Blob |
| Constraints | PROFILE.constraintsList | Issues-Module (eigene Keys) | user_constraints | Region-Drift; produktiv wirkungslos |
| Equipment | devices.equipment | Legacy gear (migriert) | **nur Blob** | LWW |
| WeekPlan | PROFILE.weekPlan | — | **nur Blob** (user_training_plans ungenutzt) | LWW |
| Activities | activity-store | DB[date].sessions = primäre Analysequelle | activities (0009) | Doppelwahrheit produktiv |
| Training Load | Calc.loadModel | drawForm/ACWR-Eigenrechnung; training_load_daily ohne Rücklese | training_load_daily | SSoT ungenutzt |

## 5. Sport-/Session-/Activity-Mapping (Kern)

24 Katalog-Sportarten (onboarding-sports-logic.js:51–76). Domain-SSoT kennt 16 (training-domain.js); **8 kollabieren via normSport auf 'other'**: volleyball, hockey, rugby, badminton, golf, climbing, yoga, hyrox. Live-Spiegelung erzwingt 5 dt. Legacy-Typen, Fremdsport→„Gym" (workout-ui.js:644–646). Hub-Icons: nur run/bike/swim/dumbbell/stretch/pulse (workout-ui.js:147–148) → Ball-/Racket-/Outdoor-Sport = EKG; triathlon/athletics ohne Sprite-Symbol. Fehlend im Katalog: Trailrunning (nur runType), Skifahren, Kampfsport, Tanzen, CrossFit/Pilates (nur Import-Map data.js:160–161). Vollmatrix: Abnahme-Bericht.

## 6. Cloud-/Persistenzmatrix (Kern)

Tabellenzyklen ✓: user_profiles (MAPPED), user_sports, weekly_availability+fixed_schedule_items, user_goals, user_constraints, daily_checkins (5 Typen), activities (Outbox), workout_* (RPC), readiness_*, training_load_daily (ohne Rücklese).
**LWW-Blob-only (hohes Risiko):** weekPlan+Undo, Gewichtshistorie, Equipment/Devices, Preferences/Recovery-Sektion, Routinen/Supplements/Ernährung, Consent. Gerätelokal: Quick-Add-Favoriten, Shadow-Log (ok).

## 7. UI-Erreichbarkeit (Auffälligkeiten)

Red Flags melden: **keine Fundstelle**. Eigene Übung anlegen: kein UI (Repo fertig). Konto-Aktionen: prompt()-Flows. Aktivitätsdetail kanonisch schwächer als Legacy-Karte. Export unvollständig. Rechtstexte Platzhalter. Rest: 1–4 Klicks, kanonische Flows vorhanden (Matrix im Abnahme-Bericht).

## 8. TOT / DOPPELT / LEGACY — Inventar

**TOT:** „Alle Sportarten"-Kachel (workout-ui.js:161); Bodymap-`{}` (ui.js:1190); createUserExercise ohne UI; FTP-Metrik ohne Kategorie (profile-model.js:40); Legacy openOnboarding (profile.js:321); openWhatIf/openCoach/openWhy; PHASES (ui.js:177–181); Schema-Leichen tips/trends/live_updates/activity_routes/data_sources/imports/issue_* ; **anbinden statt löschen:** consents/legal_acceptance/oauth_tokens/user_training_plans.

**DOPPELT:** Entscheidung (ampel-Restkonsumenten); Belastung (loadModel vs. drawForm/ACWR); Sport-Namespace (3+2 Aliase); Ziel-IDs; hmTargetMin-Spiegel; RHR/HFmax (3 Welten); 3 Insight-Systeme; 3 Icon-Zuordnungen; ≥4 Modal-Systeme (17× ad-hoc); preferences vs. trainingPrefs; profiles vs. user_profiles; onboarding-steps vs. STEP_CONFIG; 2 Dedupe-Logiken; Beschwerde-Regionen.

**LEGACY sichtbar:** „v6.0"; HM-Pace-Karte; story-Demo+HM-Satz+confirm; supplements-Personenlexikon; „Patella"-Texte/Badges; Knie-Labels; prompt()-Kontoflows; Emoji-Flächen; Free/Pro-Karte.

## 9. Fehlende Inhalte (nach Release-Stufe)

**Private-Beta-Must-have:** Red-Flag-Erfassung; Fremdsport-Fix; Entscheidungs-/Last-SSoT; Gewicht/Equipment/weekPlan-Cloud; Export-Vollabdeckung; Minimal-Error-Tracking; prompt()→Sheets; v6.0-Fix; Sync-Status inkl. failed; Auth-Live-E2E.
**Public-Beta:** Rechtstexte+Server-Consent; Garmin (Metadaten+Cursor+Connector); Sportkatalog-Picker+Icons; Detailseite mit Route; Verlauf-Filter; PWA-Hilfe; Check-in-Sollfelder; Onboarding-Consent; Strava.
**Paid:** finale Engine (§28) inkl. Periodisierung/Gym/Mobility/Positionen; Zielfortschritt generisch; Stripe; KI-Coach.
**Premium später:** Karten-Tiles/Heatmap; Bilder/Wissensbereich; Bodymap-Premium; SWOLF/Power-Tiefe; Monatsreports/Plateau.
**Vorerst nicht:** eigener FIT-Parser; Browser-GPS; Voll-Ernährungstracker; Coach-/Team-Dashboards; Präferenz-Konsumenten vor Engine-Neubau.

## 10. Roadmap R1–R19 (abgenommen)

| Paket | Scope-Kern | Abhängigkeit |
|---|---|---|
| **R1 Kritische Datenintegrität** | Fremdsport-Fix; Ziel-ID-Kanonisierung; ampel-Konsumenten→SSoT; Charts/ACWR→loadModel; isPro→Kit-Level | — |
| R2 Safety | Red-Flags; Region-Kanonik; Bereiche+Seite; constraints→Decision; Archiv-Vorschlag | R1 |
| R3 Sichtbare Legacy | v6.0; HM-Karten; Personen-Texte; prompt()→Sheets; Emoji; Alt-Code | — |
| R4 Kanonische Persistenz | Gewicht/Equipment/weekPlan-Cloud; Vollexport; Error-Tracking; Queue-Robustheit; Server-Consent | R1 |
| R5 Profil/Check-ins komplett | Sollfelder; Follow-ups; Einheiten; Quick-Add-Aktionen; Preferences-Konsumenten | R2 |
| R6 Trainingsseite/Sport-SSoT | Katalog-Merge; „Alle Sportarten"; Icon-Registry; Workout-Notiz/Schmerz/Equipment | R1 |
| R7 Aktivitäten/Detail/Verlauf | Analyse auf kanonisch; Detail-Hero/Route/Splits; Soll-Ist/Debrief; Filter; Cursor | R6 |
| R8 Premium-UI/Bilder/Karten | Bildstrategie; PWA-Install; Modal-Konsolidierung; Insights-Reduktion | R7 |
| R9 Ziele/Fortschritt | currentValue; generische Prognose; FTP; Meilensteine; hmTargetMin-Abbau | R7 |
| R10 Provider | Metadaten-Migration; Garmin-Connector; Strava | R7 + Gian |
| R11 Insights/Aufbereitung | EIN System; Monat/Plateau; Trend-API; Belastungsreaktion | R7 |
| R12 Gym/Mobility | Bodymap-Anbindung; eigene Übungen; PRs; Progression/Deload | R6 |
| R13/R14 Sport-/Positionsverträge | Energiesysteme/Risiken/Saison; Positions-Wirkung | R9 |
| R15 Periodisierung | Makrozyklus; Budget; Doppeleinheiten; Plan-Cloud | R14 |
| R16/R17 Finale Engine + Shadow-Gate | §28-Invarianten; §29-Gate; Rollout | R15 |
| R18 Public Beta/Recht | Rechtstexte; Beta-Checkliste | R4,R10 + Gian |
| R19 Paid/KI | Stripe; KI-Coach | R17,R18 |

## 11. Offene Gian-Punkte

1. Garmin Connect Developer Program (blockiert R10). 2. Betreiberangaben Impressum/DSE (R18; Risiko besteht jetzt). 3. Live-Bestätigung v8-183. 4. Shadow-Tage sammeln (Report ≥14 Tage).
