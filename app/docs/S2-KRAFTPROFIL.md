# S2 · Kraftprofil (Prototyp v14 „scrStr") — Stand 14.09.2026, Build v8-379

## Was gebaut ist
- `js/engine/strength-profile.js` (rein, Node-testbar): aus `gymVolume.gymPipeline`-Snapshots je Übung Einheiten → bester Arbeitssatz → e1RM (Epley, RIR eingerechnet, Kappung > 12 eff. Wdh.), Serie (ein Punkt je Einheit, 1RM-Tests als Marker), Δ im 12-Wochen-Fenster, PRs (Test, bester Satz, schwerstes Gewicht, Volumen-Woche / Wdh.-Rekord / Haltezeit), Historie mit Δ, Stagnation (strength-progression, Satz 1, 3 Einheiten, nur ab Schwelle), relative Kraft, Gruppen (Beine/Druck/Zug/Rumpf aus gym-volume-Mapping, Namens-Fallback nur für die Gruppe), harte Sätze + Tonnage (Woche vs. 4-W-Schnitt), Sätze je Muskel 7 Tage gegen `targetCorridor` (individuell, KEINE 10–20-Regel), Balance auf Satzbasis (Druck:Zug 0,8–1,2 · Beine:Oberkörper ≥ 0,8), Kraftziel-Prognose (Regression ≥ 6 Punkte/≥ 4 Wochen, sonst `insufficient`/`flat`), Beschwerden-Kopplung (Injury-Lead ohne `legStrength` ⇒ Beine `blocked`, kein Vorschlag).
- `js/screens/strength-profile.js`: Sheet `_strengthProfile` (openSheet, size full) mit Filter Gruppe → Übung, Übungskarte (load/reps/time/Leerzustand n/6), Bestwerte, Letzte Einheiten (nicht Einsteiger), Sätze je Muskel, Zielkarte, Tonnage, Balance. Tiefe über `gmLevel()`. `openStrengthProfile({exercise|goalTitle})`, `strengthProfileScreen.teaser()`.
- Einstiege: Analyse · Körper (Teaser-Karte, Slot `analysis-strength`), Profil · Leistung · Kraftwerte (Kopfzeile), Ziel-Detail bei Kraftziel (Zeile „Kraftprofil").
- Tests: `strength_profile_test` (40: A e1RM, B Übungen/Serie, C Gruppen/Korridor/Balance/Ziel, D Screen-HTML, E Verdrahtung).

## Abweichungen vom Prototyp (begründet)
1. RIR-korrigiertes e1RM statt reinem Epley.
2. Punkte je Einheit statt 12-Wochen-Raster.
3. Korridor aus gym-volume je Muskel statt pauschal 10–20 je Gruppe.
4. Balance auf harten Sätzen statt Tonnage (Tonnage nur als eigene Karte).
5. Stagnationsbefund aus strength-progression (fehlt im Prototyp).
6. Beschwerden-Kopplung (Stufe D).
7. Relative Kraft (e1RM/kg) im Fortgeschrittenen-/Profi-Modus.
8. Prognose nur mit Mindestdaten, Regression statt Zwei-Punkte-Steigung.

## Offen / Entscheidung
- Analyse → Aktivität (Segment „Zentrale | Analyse") wie im Prototyp; Umbau zusammen mit S7 (Community-Tab), nicht als halber Umzug. Fünf Tests fixieren die Tabbar-Labels (gm1_shell, shell_v3_migration, dashboard_v5_phaseb, gm4_analysis_parity, liquid_glass_tabbar).
- Zielkarte-Aktionen des Prototyps („Progression ab … anheben", „Richtwert setzen") brauchen die Plan-Engine (S3).

## S2b-1 · Katalog als Basisbewegung × Variante + Niveau-Vertrag (Build v8-380, Migration 0047)
- Migration `0047_exercise_catalog_variants.sql` (generiert aus `app/tools/catalog-gen.mjs`, lokal gegen Postgres 16 geprüft, idempotent): `exercises.base_slug`, `exercises.variant jsonb {equipment, grip, angle, execution}`; 224 Systemübungen in 46 Basisbewegungen (Gerät Langhantel/Kurzhantel/Kabel/Maschine/Smith/Körpergewicht/Band/SZ/Trap-Bar/T-Bar, Griffe breit/eng/neutral/Ober-/Untergriff/Seil/V, Winkel flach/schräg/negativ/von oben/unten, Ausführung ein-/beidseitig, sitzend/stehend/brustgestützt …); jede Übung mit Muskelzuordnung (529 Zeilen) und Gerät (289 Zeilen). Bestehende Slugs behalten ihren Namen (Historie bleibt lesbar).
- Datenfluss: `exerciseRepository.list` liest Muskeln + Gerät per Embed (Fallback ohne Embed) und füllt `gymVolume.setCatalog`; `exerciseFromRow` liefert `baseSlug/variant/muscles/equipment`; der Workout-Snapshot friert `slug/baseSlug/movementPattern/muscles` ein; `gymVolume.musclesFor` liest zuerst Snapshot-Muskeln, dann den Katalog-Cache per ID/Slug, erst dann die alten Namens-/Slug-/Muster-Tabellen (nur noch Fallback für Alt-Daten). Unbekannte Muskelschlüssel werden auf die Muskelkarte gefaltet (traps→upper_back, adductors→quads, abductors→glutes, hip_flexors→abs) — Näherung, dokumentiert.
- Picker (`workout-ui`): ohne Suchbegriff eine Zeile je Basisbewegung mit „n Varianten" (aufklappbar; genau eine Variante ⇒ direkt), „Zuletzt verwendet" oben, bei Suche flache Liste mit Variantenlabel.
- Eigene Übungen: `createUserExercise` schreibt Muskeln + Gerät mit (UI folgt in S2b-2).
- Niveau-Vertrag Kraftprofil (`DEPTH` in `screens/strength-profile.js`): Anfänger = Maximum + Bestwerte + Ziel + Balance als Satz, kein Jargon; Fortgeschritten = alles außer relativer Kraft; Profi = alles inkl. Methode/relative Kraft/Korridorzahlen.
- Tests: `exercise_catalog_test` (16), `strength_profile_test` +3 (D10–D12 Niveau).

## S2b-2 · Eigene Übungen (Build v8-381)
- `js/workout-custom-exercise.js`: Sheet „Eigene Übung anlegen/bearbeiten" im Picker (Zeile oben, Stift an eigenen Übungen). Basisbewegung wählen ⇒ Muskeln (primär ●/sekundär ◐), Bewegungsmuster und Kategorie aus der Katalogvorlage; Gerät/Griff/Ausführung = Variante; Notiz. Validierung: Name ≥ 2 Zeichen, ≥ 1 Muskel. Nach Anlegen wird die Übung sofort gewählt (Workout/Callback) und ist in Muskelkarte + Kraftprofil klassifiziert.
- Repository: `createUserExercise` schreibt `exercise_muscles`/`exercise_equipment` mit; `updateUserExercise` akzeptiert das Domain-Objekt (exerciseToRow) und ersetzt Muskeln/Gerät; Löschen nur eigene (RLS), Snapshots behalten den Namen.
- Test `custom_exercise_test` (9).

## Niveau-Pass Ziel-Detail + Profil (Build v8-382)
- `goal-detail.js` `DEPTH`: Anfänger = Zielzeit, Machbarkeit als Satz (ohne Gründeliste), Vertrag, Plan, eine Stellschraube, Meilensteine, Verwalten; Fortgeschritten = + Gründe, Prognoseverlauf, Einzahlungen, Historie, Wechselwirkungen; Profi = alles.
- `profile-v14.js` Leistung: Anfänger = Ausdauerwert / Fitness / Belastung (✓ ↑ ↓ mit Worten) statt VO₂max-Quelle / CTL / ACWR, keine Zonen & Schwellen; Fortgeschritten/Profi unverändert.
- Tests: goal_detail_test +2 (B7/B8), profile_v14_test +1 (H6).
- Offen (bewusst): Über-/Ziele-Reiter und Kennzahlen-Karten sind für alle Niveaus gleich — Texte dort sind bereits alltagssprachlich.

## Befund 15.09. · „Sätze weg" (Build v8-383)
- Server (gianthaysen76@gmail.com): 13 abgeschlossene Sessions Jun–Aug mit 5–7 Übungen / 9–15 Sätzen — **die Sätze waren nie weg.** Die App las sie nicht zurück: (1) Kraftprofil/Kraftwerte nutzten nur den synchronen Pfad (lokale Snapshots), (2) der Nachlade-Pfad (`_gymPipelineFetch`, refresh) gab Baum-Übungen nur mit Namen weiter → ohne exakten Namenstreffer „unklassifiziert" (Muskelkarte 90 T zeigte 1–3 Sätze), (3) drei Juni-Sessions ohne `activities`-Zeile wurden nie nachgeladen.
- Fix: `ensureCatalog()` vor dem Nachladen; Baum-Übungen tragen `exerciseId/slug/movementPattern/muscles`; `listSessions` ergänzt verwaiste abgeschlossene Gym-Sessions; `_lastTreeSessions` speist den synchronen Pfad; Kraftprofil und Teaser laden per `gymPipelineAsync({days:365, refresh:true})` nach und rendern danach neu (Ladehinweis); `gymPipelineAsync` exportiert.
- Kosmetik: Teaser-Dopplung, Muskelkarte ohne Korridor zeigt nur den Hinweis.
- Test `gym_server_reload_test` (9).
- Offen: `activities`-Zeilen für die drei Juni-Sessions fehlen weiterhin (Aktivitätsliste); Backfill über `orvia_upsert_activity_from_session` als Folgeaufgabe.

## Wurzelursache „Sätze weg" (Build v8-384)
- `workoutRepository.loadWorkoutTree` nutzte den Embed `exercise:exercises(*)`. `workout_exercises` hat zwei FKs auf `exercises` (`exercise_id`, `replaced_by_exercise_id`) ⇒ PostgREST lehnt den mehrdeutigen Embed ab ⇒ **jeder** Baum-Abruf scheiterte still (Aktivitäts-Detail, Muskelkarte, Kraftprofil). Perf-Log zeigte „16 round-trips", Ergebnis leer.
- Fix: Embed mit FK-Hinweis `exercises!workout_exercises_exercise_id_fkey(*)`; bei Fehler Fallback ohne Embed (Übungen + Sätze, Übungszeilen per `in('id', …)`). gym-volume: Einzelausfall eines Baums = `WORKOUT_DETAILS_PARTIAL` (Warnung), nur Totalausfall = Fehler.
- Test gym_server_reload C1/C2.
