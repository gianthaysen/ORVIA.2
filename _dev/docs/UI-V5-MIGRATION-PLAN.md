# ORVIA · UI-v5-Migrationsplan (Prototyp `orvia_dashboard_5_1.html` → produktive App)

Stand: 25.07.2026 · Grundlage: byte-identisch mit v5-Prototyp (1.988 Zeilen, 282 KB).
Bereits produktiv migriert: uiDetailMode-Fundament, Muskelkarten-Pilot (Engine-gebunden),
v3/v5-Shell Schritt 1 (5-Ziel-Liquid-Tabbar + Indicator + Drag, FAB→Quick-Actions,
v5-Header aus echten Quellen, Hero-Skin für renderCommand, SW `orvia-v8-195`, Vertragstest 26/26).

## 1. Machbarkeitsurteil

**Machbar — als kontrollierte, vertikale Migration in 8 Phasen.** Belegt durch die drei bereits
produktiven Migrationen (Modus, Muskelkarte, Shell): Das Muster „kanonischer Engine-Output →
v5-Darstellung, Test zuerst, additive CSS" funktioniert im echten Code. Nicht machbar (und nicht
nötig) ist die 1:1-Übernahme der Prototyp-*Mechanik* (Voll-Re-Render einer `#screen`-Fläche):
Die App hat zustandsbehaftete Formulare im statischen DOM (Check-in, Training). Die Migration
übernimmt Optik, Struktur, Komponenten und Interaktionen des Prototyps auf dem bestehenden
containerbasierten Routing.

**Günstigste Erkenntnis der Analyse:** Die App besitzt für fast alle v5-Module bereits echte
Backends — mehr als der Prototyp braucht:

| v5-Modul | Echte Quelle (vorhanden) | Status |
|---|---|---|
| Score/Hero/Empfehlung | decision-engine-v2, `orviaScore()`, `renderCommand` | ✅ migriert (Skin) |
| Modus A/F/P global | `uiDetailMode()` (persistent, seitenerhaltend) | ✅ migriert |
| Muskelkarte + Detail | `ORVIA.gymVolume` (computeMuscleVolume/explain) | ✅ migriert |
| Liquid Bar/FAB/Header | Shell Schritt 1 | ✅ migriert |
| Check-in-Karte | echtes Check-in-System (`renderMorning`) | vorhanden, Restyle offen |
| Analyse-Segmente | `dashSegs` ueber/ausdauer/erholung/koerper | strukturidentisch, Restyle offen |
| Bestzeiten | `renderBestTimes()` (real + Riegel-Schätzung) | vorhanden, Restyle offen |
| Pace-Rechner | `calc.js`: `riegelHM`, `swimPace100`, Pace-Utils | Rechenkern vorhanden, Seite fehlt |
| Phasen bis zum Ziel | `Calc.racePhases()` | vorhanden, UI fehlt |
| Wochenumfang Plan/Ist | `weekKmTarget`, `runsWindow`, `planStatus` | vorhanden, UI fehlt |
| Planqualität | `planQualityChecks()` | vorhanden, Restyle offen |
| Aktivitäten-Hub/Detail | activity-store, `renderAkt`, AD1-Kontrakt | vorhanden, Hub-Aggregation fehlt |
| Training-Start-Flow | quick-actions (`training_start` → workoutUI) | Einstieg vorhanden, Sheet fehlt |
| Meilensteine | `engine/goal-portfolio.js` | Engine teilweise, UI fehlt |
| Profil/Einstellungen | profile-model/-center, Auth-Accountkarte | vorhanden, Restyle offen |
| Medaillen | — | **keine Engine** → Neubau |
| Plan-Varianten A/B/C | scheduler-v1/plan-engine-v2 (ohne Variantenkonzept) | **Engine-Erweiterung** → Neubau |
| Body Battery/Stress-Kacheln | metric-registry/Garmin (teils befüllt) | Anbindung + Empty-States |
| Routen-Karte in Aktivität | GPS-Daten je nach Import | Datenprüfung + Renderer |

## 2. Schritt-für-Schritt-Plan (jede Phase: Test zuerst → Implementierung → Suite → visuelle Prüfung)

**Phase B — Dashboard-Vollausbau (Heute).** „Insights"→„Analyse" (sichtbare Titel), Gold-Flächen
auf v5-Dunkeltext, Check-in-/Banner-/Adapt-Karten in v5-Kartensprache, Kennzahlen-Kacheln
(`kgrid/kcard`) nur aus echten Metriken (metric-resolver; fehlend ⇒ Empty-State, nie 0).
Aufwand: klein. Risiko: gering.

**Phase C — Chart-Modul portieren.** `richChart` (Catmull-Rom-Splines, Scrubbing Touch/Maus/
Tastatur, Baseline, Reduced-Motion) als eigenständiges `js/orvia-charts.js` mit Vertragstests;
ersetzt schrittweise die Minimal-Charts. Grundlage für C–E. Aufwand: mittel. Risiko: gering
(additiv, alte Charts bleiben bis zur Umstellung).

**Phase D — Analyse-Segmente v5.** Überblick als „Entscheidungsraum" (insights/intelligence
liefern die Texte), Ausdauer mit Form/Fitness-Chart (calc-Lastmodell) + Prognosen (riegel),
Erholung mit echten Metrik-Kacheln + Detail-Sheets, Körper bleibt (Pilot). Aufwand: mittel.

**Phase E — Plan-Seite v5 (ohne A/B/C).** Phasen-Timeline (`racePhases`), Wochenumfang-Balken
(Plan vs. Ist), Planqualität-Karte, Wochenliste in v5-Session-Cards; Tagesziele über bestehende
Ziele. Aufwand: mittel.

**Phase F — Aktivitäten-Hub + Training-Start.** Hub-Kopf (Primäraktionen als `hub-act`-Grid auf
bestehende Quick-Actions), Wochen-/Monats-KPIs aus activity-store-Aggregation, Sportverteilung,
Filter; Start-Sheet (Sportwahl → Pre-Start mit echtem Readiness-Hinweis aus der Decision Engine).
Aktivitätsdetail in v5-Optik (Route nur bei echten GPS-Daten). Aufwand: mittel–groß.

**Phase G — Profil, Einstellungen, Bestzeiten-Seite, Pace-Rechner.** Profil-Overlay in v5-Optik,
Einstellungen als v5-Settings-Seiten (bestehende Inhalte), Bestzeiten-Vollseite auf
`renderBestTimes`-Daten, Pace-Rechner als reine UI über calc-Funktionen. Aufwand: klein–mittel.

**Phase H — Release-Politur.** A11y-Durchgang (Fokus, ARIA, Kontrast), Performance
(Navigation < 100 ms, keine Listener-Akkumulation), 320/390/430/Desktop, Light-Mode-Entscheidung,
SW-Bump genau einmal pro Release, voller Regressionslauf (161 Tests + neue).

Reihenfolge-Logik: B→C zuerst (sichtbarster Effekt + Fundament), dann D/E/F parallelisierbar,
G/H zum Schluss. Nach jeder Phase ist die App vollständig funktionsfähig — kein Big Bang.

## 3. Zusätzlich zu bauen für die fertige Produktvariante (über Restyling hinaus)

1. **Medaillen-Engine** (neu): Kriterien, Fortschritt, Persistenz (Supabase-Tabelle + Repo),
   Safety-Regel „keine Belohnung für Raubbau"; UI existiert im Prototyp.
2. **Plan-Varianten A/B/C** (Engine-Erweiterung): Variantenkonzept in scheduler-v1/plan-engine-v2
   (Bedingungen, Kernreize, geschützte Ruhetage, Prognose-Impact) + Kontrakttests. Größtes
   Einzelstück; eigenes Design-Dokument empfohlen (Anschluss an GOAL-CAPACITY-Contract).
3. **Meilenstein-Vervollständigung**: goal-portfolio um Fortschritts-/Unsicherheitsfelder und
   sportartspezifische Meilensteine erweitern.
4. **Metrik-Kacheln live**: Body Battery, Stress, Schlafphasen aus Garmin über metric-resolver
   in die Erholungs-Kacheln; Missingness-Regeln (unbekannt ≠ 0) durchziehen.
5. **Routen-Rendering**: Prüfen, ob GPS-Polylines im Import vorliegen; wenn ja, leichtes
   Karten-Rendering (statisch/SVG), sonst ehrlicher Platzhalter.
6. **Debrief-Texte**: intelligence/insights auf die v5-„ORVIA Debrief"-Karte mappen
   (Safety-Gate beachten).
7. **Light Mode** (Prototyp-Einstellung „Hell/Auto"): App ist dark-only; Token-Layer existiert,
   Aufwand liegt im Audit aller Legacy-Farben. Optional, eigenes Arbeitspaket.
8. **Onboarding-Anpassung** an die neue Shell (Coachmarks-Ziele, erste Schritte).
9. **SW-Assetliste** um neue Dateien (`orvia-charts.js`, ggf. Seiten) ergänzen; ein Bump pro Release.
10. **Aufräumen**: Legacy-Zweitpfade (alte `renderBodyMap`/`Calc.muscleVolumeStatus`-Kette,
    alte Icon-Tabbar-Styles) nach Abschluss entfernen.

## 4. Risiken & Leitplanken

Formulare nie neu rendern (Check-in/Training); Engines/Stores unangetastet; jede Phase mit
scheiterndem Vertragstest beginnen; keine Demo-Werte — fehlende Quelle ⇒ Empty/Coming-soon;
fremde Arbeitsbaum-Änderungen respektieren (nur verankerte Ersetzungen); keine destruktiven
Git-Operationen; Commit/Push/Deploy nur auf ausdrücklichen Auftrag.
