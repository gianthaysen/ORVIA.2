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
