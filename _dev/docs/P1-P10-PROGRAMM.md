# ORVIA · Produktreife-Programm P1–P10 (Ausführungsprotokoll)

Status: ABGESCHLOSSEN 2026-07-11 · Release-Buendel v8-180 (NICHT deployt — Deploy durch Gian nach DEPLOY_CHECKLISTE inkl. Migrationen 0012-0014).
Baseline: sw.js `orvia-v8-179` (live), Migrationen 0001–0011 (0011 live ausgeführt),
Offline-Regression 87/87 grün, 5 Live-Suiten übersprungen (Credentials:
rls, training_rls_phase41, live_workout_rls_phase42, live_workout_rpc_smoke_phase42,
muscle_volume_sql_phase43). Kein .git (Ordner-Deploy). Cache-Bump: EINMAL am Ende (P10).

## P1 — Globaler Profil-State und Rerender · FERTIG
Root Cause: `orvia:profile-updated` hatte keinen globalen UI-Konsumenten; `showTab('heute')`
renderte nie; `PROFILE.age` nur bei Onboarding/Hydration berechnet; `DB._hmTargetMin` stale Kopie.
Fix: NEU `js/ui-refresh.js` (purer `targetsFor(sections, activeTab)`-Mapper + fail-softer
Renderer-Dispatch, Coalescing pro Tick, Burst-Drossel 5/s, Einmal-Registrierung);
`ui.js`: showTab('heute')→renderDay + `orviaGoalCacheInvalidate`-Hook (let-Scope);
`profile.js`: `_profileSave` berechnet age bei personal-Änderung neu;
index.html + sw-ASSETS um ui-refresh.js ergänzt (kein Bump — kommt in P10).
Tests: ui_refresh_p1_test 20/20 (RED→GREEN) · Regression 88/88.

## P2 — Feldwelten Körper/Leistung + Hardcodes + Recovery-Responsive · FERTIG
Root Cause: Editor schrieb nur `PROFILE.performance.body`, Karten/Zonen/calc/nutrition lesen
die flachen Felder — Altdaten (198/58/75/175) unlöschbar; nutrition erfand 75/175/30;
Flensburg + Du-Bezüge in supplements; `input[type=time]` ohne appearance-Fix (Overlap).
Fix: flache Felder als KANONISCH festgeschrieben; `_perfSeedFromCanonical` (Altdaten in den
Editor) + `_perfMirrorCanonical` (Save spiegelt zurück, hfMax==hfMaxMeasured, Löschen⇒null,
rhrBaseline nie genullt); HFmax in Editor-Karte sichtbar; nutrition ohne Fake-Defaults
(nutToday/nutWeekly⇒null + ehrlicher Leerzustand, trainingBurn 0 ohne Gewicht);
supplements neutralisiert; Demo-Geodaten fiktiv; CSS: time-Inputs in die date-Regel.
Dateien: profile.js, nutrition.js, supplements.js, activity.js, styles.css.
Tests: body_fields_p2_test 20/20 (RED→GREEN) · Regression 89/89.

## P3 — Today-Decision vereinheitlichen · FERTIG
Root Cause: tipEngine (intelligence.js:113) krankheits-blind — `m.ill` weder in readiness
noch issueMax → „Guter Tag für Qualität" parallel zur reduzierenden Tagesentscheidung.
Fix: intelCtx trägt `illness` + `decisionState` (currentDecision, nur heute); Safety-Gate:
positive Freigabe-Tips NUR bei gesund + issueMax<3 + decision GREEN; bei Krankheit
erklärender Tipp (sev 4) mit Verweis auf die Tagesentscheidung; bei ≠GREEN Hinweis-Tipp;
riskCard/recoveryDebt zeigen Krankheit als Grund (+20/+25 Anzeige-Subscore) und sagen bei
≠GREEN nie mehr „wie geplant"; Legacy-Ampel (nur Vergangenheit) als „Historische
Einordnung" gekennzeichnet („Empfehlung heute"→„Einordnung dieses Tages" + .amp-hist).
Dateien: intelligence.js, ui.js, styles.css.
Tests: today_decision_p3_test 15/15 (RED→GREEN, Live-Konflikt-Fixture) · Regression 90/90.

## P4 — Trainings-Setup entkoppelt, Profil als SSoT · FERTIG
Root Cause: Plan-Templates verdrahteten fix 3 Tage (ui.js Lauf-Template w[1]/w[3]/w[6]);
trainingDays wirkte nur als Deckel; availability wurde von keiner Planlogik gelesen;
Setup-Card war zweite Eingabestelle für trainingDays/gymDays/adaptationMode/riskTolerance.
Fix: NEU `profileModel.effectiveTrainingConfig(profile)` (pur; availability>legacy>none,
maxSessionsPerWeek deckelt, gym aus sports.gym.sessionsPerWeek, Modi aus preferences mit
Legacy-Fallback); generateWeekPlan: (1) verschiebt Einheiten von nicht verfügbaren auf
freie verfügbare Tage, (2) deckelt wie bisher (A-Einheiten bleiben), (3) füllt bis zur
Zieltagzahl NUR mit lockeren Einheiten auf (Nachbar-Heuristik gegen Blöcke); Setup-Card
jetzt READ-ONLY-Zusammenfassung + Links (Verfügbarkeits-/Präferenzen-Editor); Preferences-
Editor um Anpassungs-Modus/Risikobereitschaft erweitert (normalizePreferences-Whitelist,
Legacy-Spiegel für bestehende Leser); Setter deprecated (keine UI-Aufrufer); adaptWeekPlan
als volumen-neutral dokumentiert (KNOWN_ISSUES #13 geklärt). Datierte fixe Termine:
weiterhin einziger Editor in der Setup-Card; Tagesebene via buildTrainingDecision.
Migration: KEINE Datenmigration nötig (reine Ableitung; gespeicherte weekPlans bleiben
unangetastet — neue Logik greift bei Neu-Generierung). Dateien: profile-model.js, ui.js,
profile.js, calc.js. Tests: plan_ssot_p4_test 26/26 (Fixtures 3/4/5/6 Tage, Verschieben,
kein Intensitäts-Zuwachs) · Regression 91/91.

## P5 — Zielsystem produktreif · FERTIG
Lücken: Zielzeiten nur Freitext; customCategory/motivation nicht editierbar; DB-Enums
(3 Prioritäten/3 Status) inkompatibel zum Modell (4 Rollen/5 Status); goalRepository
erwartete Legacy-Feldnamen. Fix: metricType-Vokabular + goalMetricTypeFor-Inferenz
(HM/Marathon/Ironman/Tri ⇒ time; ftp⇒power; Gewichts-Kategorien⇒weight) im Modell,
normalizeGoal parst „1:50:00"-Strings zu Sekunden (idempotent), unit default 's';
Wizard: echtes Zielzeit-/Aktuelle-Zeit-Feld (parseDuration, Fehlerhinweis),
customCategory-Feld bei custom, Motivation-Feld; goalToRow/goalToRowFull-Adapter
(category→goal_type, unit→target_unit, id→client_goal_id, Rollen 1..4→primary/
secondary/maintain/longterm; 0012-Spalten NUR wenn belegt → Blob-Migration bricht auf
Alt-Instanzen nicht); NEU Migration 0012_goal_enums_and_fields.sql (ug_enums erweitert
— rückwärtskompatibel —, metric_type/current_value/description/section_updated_at;
manuell VOR P9-Goals-Sync ausführen). „Ironman Sub 10 2028", „HM sub 1:50", FTP-,
Gewichts- und freie Ziele sind vollständig über den Flow anlegbar (M2–M7-Fixtures).
Dateien: profile-model.js, profile.js, repos/goalRepository.js, migrations/0012.
Tests: goals_p5_test 23/23 (RED→GREEN) · Regression 92/92.

## P6 — Equipment sportartspezifisch konsolidiert · FERTIG
Lücken: zwei disjunkte Systeme (PROFILE.gear shoe/bike-Verschleiß vs. devices.equipment
generisch), keine Sportart-Kopplung, fehlende Katalogtypen (Laufschuhe, Helm, Neo, Gürtel…).
Fix: kanonischer `EQUIPMENT_CATALOG` in profile-model ({id,label,compatibleSports[],
category,metrics[]}; ALLE Alt-Typcodes bleiben gültig — keine Typ-Migration);
`equipmentCatalogFor(activeSports)` (pur, gefilterte segGrouped-Paare);
`normalizeEquipment` + sports[] (aus Katalog) + wear{limitKm,startKm,since};
`migrateGearToEquipment` idempotent, ID-ERHALTEND (sessions[..].gearId-Zuordnung bleibt),
gear bleibt als Altbestand liegen (Datenerhalt). profile.js: Verschleiß-View/gearKm auf
devices.equipment umgestellt (_wearItems/_eqIsBike), saveGear schreibt kanonisch,
delGear/gearName per ID, Devices-Editor filtert nach aktiven Sportarten (bestehende
Items mit inaktiver Sportart bleiben sichtbar/wählbar, Kennzeichnung „Sportart inaktiv"),
wear-Felder im Editor. Cloud-Status: bewusst blob-only (kein Repo/Tabelle) — für einen
späteren Zyklus vorbereitet über das konsolidierte Modell. Dateien: profile-model.js,
profile.js. Tests: equipment_p6_test 26/26 (RED→GREEN) · Regression 93/93.

## P7 — Navigation + Routinen kuratiert · FERTIG
Fix: tab-train-Dauerhervorhebung (permanenter Gold-Ring/::before + Icon-Farbe unabhängig
von .on, styles.css) entfernt — Ring/Gold nur noch `.on`; alle Tabs inaktiv grau/aktiv
gold, Plus bleibt einzige Dauer-Sonderaktion. Routinen&Supplements: statisches Accordion
→ dynamische Karte: `openRoutineTasks()` (Roll-up: unerledigte aktive Routinen +
empfohlene ungenommene Supplements), heute nur sichtbar bei >0 offen (mit „x offen"-Badge),
Vergangenheit nur bei Bestandseinträgen; ssRepsIn-/routineChips-Null-Guards (warf vorher).
Dateien: styles.css, ui.js, index.html. Tests: today_nav_p7_test 13/13 · Regression 94/94.

## P8 — Quick-Add-Favoriten + Aktionskatalog · FERTIG
Fix: ACTIONS klassifiziert (frequency daily/occasional/setup; goal_add/appointment_add/
profile_complete = setup, nie Default-Favorit); `composeQuickMenu` (pur): Kontext-Overlay
max 2 (aktives Training dominiert, Check-in nach Tageszeit, Beschwerde/Profil) → Favoriten
in Nutzer-Reihenfolge (ohne Kontext-Dubletten) → „Alle Aktionen" (aufklappbar, ohne
context-Aktionen); Favoriten max 6, sortierbar, user-scoped persistiert
(orvia_qa_favs_<uid>, korrupter Storage ⇒ Defaults); Verwaltungs-Sheet (Hinzufügen/
Entfernen/↑↓, sofort gespeichert); NEUE Aktion routines_check → gotoRoutines (öffnet
Heute + Routinen-Karte, P7-Anschluss); fail-soft (nur auflösbare Entry-Points) bleibt.
Alt-Suite quick_actions_b präzisiert (B4: einzige erlaubte Persistenz = Favoriten-Key;
S2: neues Layout) — bewusste Produktänderung, kein Test-Weichspülen.
Dateien: quick-actions.js, styles.css. Tests: quick_add_p8_test 21/21 + quick_actions_b
21/21 · Regression 95/95.

## P9 — Cloud-Nachzug (Sektions-Zyklen) · FERTIG
Reife-Triage: VERDRAHTET wurden (a) MAPPED-Autopush — Editor-Saves personal/body pushen
user_profiles jetzt automatisch (vorher nur beim Onboarding-Abschluss!), inkl. NEU
constraintsAcknowledgedAt als MAPPED-Feld; (b) availability ↔ weekly_availability
(7 Zeilen/user, Slots-Details+fixedCommitments bleiben Ebene B und werden beim Apply je
Tag erhalten; Wochenlimits redundant je Zeile, Lesekonvention weekday=0);
(c) goals ↔ user_goals (Set-Sync über client_goal_id=Ziel-ID; Kernfelder inkl.
metric_type/current_value/description; categoryData/milestones/sports/motivation bleiben
Ebene B mit Apply-Erhalt); (d) constraints ↔ NEUE Tabelle user_constraints (E2: kein
JSONB; volle Zeilen; RLS owner-only nach 0002-Muster). Technik: generische Fabrik
`_makeSectionCycle` (K1-LWW, K2, Offline-Queue-Upserts) + NEUE Regel **K3**: stempellose
Cloud-Zeilen sind Legacy-Seeds (alte Einmal-Migration) und verlieren gegen nicht-leere
lokale Daten — ohne K3 hätten magere Alt-Projektionen die reichen Blob-Ziele
ÜBERSCHRIEBEN. sports-Zyklus (2B-①) bewusst unangetastet. clear() leert jetzt alle vier
Sektionen (kein A→B-Leak, getestet). auth.js hydriert nach hydrateSports auch
availability/goals/constraints (fail-soft). BEWUSST blob+app_state bleiben: recovery,
preferences, equipment, quick-add-Favoriten (kein Tabellenmodell; app_state-Snapshot
deckt Zweitgerät-Basis, E4). Migrationen: 0013 (weekly_availability additiv +
user_profiles.constraints_acknowledged_at), 0014 (user_constraints + RLS) — beide
manuell VOR dem Bündel-Deploy ausführen (zusammen mit 0012); ohne sie schlagen die
neuen Upserts kontrolliert fehl (Blob bleibt Quelle, kein Datenverlust). Client bleibt
alt-kompatibel (bedingte Spalten). Dateien: profile-store.js, repos/profileRepository.js,
repos/availabilityRepository.js, repos/goalRepository.js, NEU repos/constraintRepository.js,
auth.js, index.html, sw.js-ASSETS. Tests: cloud_sync_p9_test 31/31 (RED→GREEN; Roundtrips,
Zweitgerät, K1/K3, Ebene-B-Erhalt, Kontowechsel, Offline, Hook, Migrations-Verträge) ·
Regression 96/96.

## P10 — Gesamtkonsolidierung · FERTIG
Legacy entfernt: SECTION_DEFS.body (dritte Koerper-Feldwelt, totgelegt); Profil-Uebersicht
liest Gewicht kanonisch (flach zuerst). sw.js → orvia-v8-180 (EIN Bump fuers Gesamtbuendel;
ASSETS +ui-refresh.js +constraintRepository.js). Statische Checks: kein Flensburg/keine
Secrets/keine Parallel-Feldwelten. Versions-Vertrag in profile_editor_bugfix_test auf
>=v8-179 robustifiziert. Finale Regression: 96/96 offline gruen (5 Live-Suiten
credentials-bedingt uebersprungen). Bewusste Restpunkte: KNOWN_ISSUES #1(Rest)/#2(Rest)/
#7/#8/#9/#10/#11/#12/#16/#19/#20. Export/Loeschung: user_constraints haengt an auth.users
(on delete cascade) — kuenftige Account-Loeschung (#10) deckt sie ab; Export muss sie aufnehmen.
